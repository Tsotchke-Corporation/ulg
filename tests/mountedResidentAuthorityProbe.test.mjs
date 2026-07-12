import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMountedResidentAuthorityUrl,
  compactMountedResidentFinalStepPerformance,
  compactMountedResidentPerf,
  compactMountedRenderRefreshTrace,
  evaluateMountedResidentAuthoritySnapshot,
  snapshotMountedBrowserErrors,
  STRICT_SCHROEDER_AUTHORITY_STAGE_ORDER,
  summarizeMountedScheduleTrace
} from '../scripts/mounted-resident-authority-probe.mjs';

function passingSnapshot() {
  const laneId = 'ulg:sph-resident:demo-auto:state-0';
  const stateKey = 'ulg:sph-resident-state:0';
  const laneLeaseId = 'ulg:resident-lane:lease-0';
  const sourceConsumerLeaseId = 'material-interface-source-consumer:0';
  const taskId = 'ulg:sph-resident-steps:0';
  const deviceId = 'webgpu-device-0';
  const sourceStep = 3;
  const sourceEpoch = 6;
  const pressureIdentity = {
    status: 'material-interface-source-field-consumed-by-submitted-gpu-sequence',
    sourceStep,
    sourcePositionEpoch: sourceEpoch,
    sourceNeighborhoodGeneration: sourceEpoch,
    sourceNeighborhoodLaneId: null,
    sourceNeighborhoodStateKey: null,
    sourceDeviceId: deviceId,
    consumerDeviceId: deviceId,
    pressureEpochCount: 1,
    pressureAppliedSubstepCount: 1,
    physicsStepCount: 1,
    laneId,
    stateKey,
    leaseId: laneLeaseId,
    consumerLaneTaskId: taskId,
    consumerLaneAuthoritative: true,
    consumerLeaseId: sourceConsumerLeaseId,
    consumerLeaseStatus: 'released-after-pressure-sequence-submit',
    neighborhoodGenerationBase: sourceEpoch,
    neighborhoodPositionEpochBase: sourceEpoch,
    neighborhoodGenerationCount: 2,
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'queue.onSubmittedWorkDone',
    consumedNeighborhoodIdentity: {
      generation: sourceEpoch,
      positionEpoch: sourceEpoch,
      sourceCount: 152,
      sourceFamily: 'sph-particle-state',
      consumerBit: 1,
      leaseId: laneLeaseId,
      laneId,
      stateKey,
      deviceId,
      authoritative: true,
      taskId
    }
  };
  const consumption = {
    ...pressureIdentity,
    consumerLaneId: laneId,
    consumerStateKey: stateKey,
    consumerLaneLeaseId: laneLeaseId
  };
  const payload = {
    schema: 'peercompute.ulg.mls-mpm-resident-steps-state-delta.v0',
    status: 'resident-steps-executed',
    stateKey,
    completedStepCount: 1,
    pressureSourceFieldRequested: true,
    pressureRequestedSourceStep: sourceStep,
    pressureEpochCount: 1,
    pressureAppliedSubstepCount: 1,
    pressurePhysicsStepCount: 1,
    pressureStateManagerAdmissionApproved: true,
    pressureStateManagerAdmissionStatus: 'pressure-coupling-state-mutation-admitted',
    pressureStateManagerAdmissionBlockers: [],
    pressureSourceFieldConsumptionIdentity: pressureIdentity
  };
  return {
    host: {
      schema: 'peercompute.ulg.browser-resident-authority-host.v0',
      status: 'ready',
      computeManagerReady: true,
      stateManagerReady: true
    },
    computeManager: {
      source: 'peercompute-resident-authority-host',
      submitTask: true
    },
    stateManager: {
      source: 'peercompute-resident-authority-host'
    },
    execution: {
      schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
      backend: 'webgpu',
      residentComputeManagerMode: 'compute-manager',
      residentComputeManagerActive: true,
      completedStepCount: 1,
      computeManagerTask: {
        status: 'state-manager-committed-inline-execution-returned',
        laneId,
        requestedLaneId: 'ulg:sph-resident:demo-auto',
        stateKey,
        acceptedTaskId: taskId,
        stateManagerCommitAccepted: true,
        stateManagerCommitStatus: 'committed'
      },
      stateManagerCommit: {
        accepted: true,
        status: 'committed',
        issues: [],
        taskId,
        stateKey,
        gpuFenceSatisfied: true,
        gpuFenceLaneId: laneId,
        gpuFenceStateKey: stateKey
      },
      commitDelta: {
        schema: 'peercompute.ulg.mls-mpm-resident-steps-commit-delta.v0',
        taskId,
        scope: 'ulg-sph-resident-pass-dag',
        version: 4,
        payload
      },
      residentNeighborhoodLane: {
        laneId,
        stateKey,
        leaseId: laneLeaseId,
        authoritative: true,
        singleFlight: true,
        generationBase: sourceEpoch,
        positionEpochBase: sourceEpoch,
        generationCount: 2,
        initialGenerationEncodedBeforeFirstP2g: true
      },
      materialInterfaceSourceFieldConsumption: consumption
    },
    stateManagerWarmEntry: {
      found: true,
      taskId,
      scope: 'ulg-sph-resident-pass-dag',
      version: 4,
      payloadSchema: payload.schema,
      payloadStateKey: stateKey,
      payloadCompletedStepCount: 1,
      payloadPressureRequestedSourceStep: sourceStep,
      payloadPressureEpochCount: 1,
      payloadPressureAppliedSubstepCount: 1,
      payloadPressureIdentityLaneId: laneId,
      payloadPressureIdentityLeaseId: laneLeaseId,
      payloadPressureIdentityStateKey: stateKey,
      payloadPressureIdentityConsumerLeaseId: sourceConsumerLeaseId
    },
    nativeSurface: {
      rendererBridge: 'native-webgpu-surface-consumer',
      source: 'scene-native-webgpu-surface-consumer',
      nativeWebGpuSurfaceConsumer: true,
      deviceReady: true,
      canvasReady: true,
      drawStateReady: true,
      cameraBufferReady: true,
      failureReason: null,
      nativeMarchingCubesExtractionBatchStatus:
        'native-marching-cubes-multi-surface-batch-submitted',
      nativeMarchingCubesExtractionBatchMode: 'external-command-encoder-one-submit',
      nativeMarchingCubesExtractionBatchJobCount: 2,
      nativeMarchingCubesExtractionBatchSharedCommandEncoder: true,
      nativeMarchingCubesExtractionBatchCallerSubmitCount: 1,
      nativeMarchingCubesExtractionBatchInternalSubmitCount: 0,
      nativeMarchingCubesExtractionBatchCpuSurfaceReadback: false,
      nativeMarchingCubesExtractionBatchPointFallback: false,
      nativeMarchingCubesExtractionBatchTemporaryResourceCount: 8,
      nativeMarchingCubesExtractionBatchRetiredTemporaryResourceCount: 8
    },
    scheduleTrace: [
      { scheduleToken: 1, stage: 'scheduled', atMs: 1 },
      { scheduleToken: 1, stage: 'refresh-invoked', atMs: 2 },
      { scheduleToken: 1, stage: 'refresh-settled', atMs: 3 },
      { scheduleToken: 1, stage: 'published', atMs: 4 }
    ],
    pendingSchedule: null,
    browserErrors: { console: [], page: [], request: [], http: [], harness: [] },
    webGpuErrors: []
  };
}

function passingSchroederSnapshot() {
  const snapshot = passingSnapshot();
  const task = snapshot.execution.computeManagerTask;
  const commit = snapshot.execution.stateManagerCommit;
  const payload = snapshot.execution.commitDelta.payload;
  const warm = snapshot.stateManagerWarmEntry;
  const laneIdentity = {
    schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
    authoritative: true,
    ready: true,
    leaseId: 'compute-manager-schroeder-lease-0',
    laneId: task.laneId,
    stateKey: task.stateKey,
    sourceFamily: 'sph-particle-state',
    domainKey: 'sph-phase-demo',
    solverId: 'ulg-mls-mpm-sph-resident-steps',
    taskId: task.acceptedTaskId,
    owner: 'peercompute-compute-manager'
  };
  Object.assign(payload, {
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    residentSourceMode: 'compute-manager-gpu-resident-schroeder',
    normalHotLoopReadbackFree: true,
    gpuAuthoritativeState: true,
    pressureSourceFieldRequested: false,
    pressureRequestedSourceStep: null,
    pressureSourceFieldConsumptionIdentity: null,
    pressureEpochCount: 0,
    pressureAppliedSubstepCount: 0,
    pressurePhysicsStepCount: 1
  });
  Object.assign(warm, {
    payloadBackend: payload.backend,
    payloadReadbackMode: payload.readbackMode,
    payloadResidentSourceMode: payload.residentSourceMode,
    payloadNormalHotLoopReadbackFree: true,
    payloadGpuAuthoritativeState: true
  });
  commit.gpuFenceLaneId = task.laneId;
  commit.gpuFenceStateKey = task.stateKey;
  Object.assign(snapshot.execution, {
    schroederSimulation: true,
    schroederSameLevelSequenceStatus:
      'compute-manager-schroeder-resident-steps-executed',
    residentSourceMode: 'compute-manager-gpu-resident-schroeder',
    normalHotLoopReadbackFree: true,
    gpuAuthoritativeState: true
  });
  snapshot.requireSchroeder = true;
  snapshot.schroederEvidence = {
    executionSchroederSimulation: true,
    sameLevelSequenceStatus: 'compute-manager-schroeder-resident-steps-executed',
    residentSourceMode: 'compute-manager-gpu-resident-schroeder',
    normalHotLoopReadbackFree: true,
    gpuAuthoritativeState: true,
    finalStepSchema: 'peercompute.ulg.schroeder-two-level-authoritative-step.v0',
    finalStepStatus: 'schroeder-two-level-authoritative-step-executed',
    finalStepTwoLevelMechanicsAuthority: 'authoritative',
    twoLevelMechanicsSchema:
      'peercompute.ulg.schroeder-two-level-mechanics-step-execution.v0',
    twoLevelMechanicsStatus: 'schroeder-two-level-mechanics-step-submitted',
    twoLevelMechanicsAuthority: 'two-level-authoritative-resident-mechanics-replaced',
    twoLevelFineLevel: 0,
    twoLevelCoarseLevel: 1,
    sparseHierarchyStatus: 'schroeder-sparse-two-level-hierarchy-encoded',
    sparseHierarchyCompaction: 'exact-stable-u32-radix-unique-csr',
    sparseHierarchyFineLevel: 0,
    sparseHierarchyCoarseLevel: 1,
    sparseHierarchyLevelCount: 2,
    sparseHierarchyThirdLevelHold: true,
    sparseHierarchyRetainedCompactNodeBuffer: true,
    sparseHierarchyRetainedSourceMembershipBuffers: true,
    sparseHierarchyRetainedEvidenceBuffer: true,
    sparseHierarchyReadbackMode: 'no-full-readback',
    sparseHierarchyFullParticleReadbackPerformed: false,
    executionAuthoritySubmissionCount: 1,
    executionNormalPathMapCount: 0,
    executionNormalPathReadbackBytes: 0,
    executionThirdLevelHold: true,
    authoritySequence: {
      schema: 'peercompute.ulg.schroeder-two-level-authority-sequence.v0',
      status: 'schroeder-two-level-authority-sequence-completed',
      commandEncoderOwnership: 'caller',
      sharedCommandEncoder: true,
      commandSubmissionCount: 1,
      stageList: [
        'sparse-hierarchy-compaction',
        'fine-sparse-grid-view-build',
        'fine-compact-p2g',
        'coarse-sparse-grid-view-build',
        'coarse-compact-p2g',
        'cross-level-grid-restriction',
        'coarse-pre-update-grid-copy',
        'coarse-compact-grid-update',
        'fine-compact-grid-update-0',
        'cross-level-velocity-delta-transfer-0',
        'fine-compact-g2p-0',
        'coarse-compact-g2p',
        'cross-level-retained-conservation-evidence'
      ],
      stageCount: 13,
      sparseHierarchyStatus: 'schroeder-sparse-two-level-hierarchy-encoded',
      sparseHierarchyCompaction: 'exact-stable-u32-radix-unique-csr',
      sparseHierarchyThirdLevelHold: true,
      sparseFineGridStatus: 'schroeder-sparse-grid-view-encoded',
      sparseCoarseGridStatus: 'schroeder-sparse-grid-view-encoded',
      compactP2gStatus: 'fine-and-coarse-compact-p2g-encoded',
      compactGridUpdateStatus: 'fine-and-coarse-compact-grid-update-encoded',
      compactG2pStatus: 'fine-and-coarse-compact-g2p-encoded',
      crossLevelTransferStatus: 'restriction-and-velocity-delta-prolongation-encoded',
      conservationEvidenceStatus:
        'schroeder-cross-level-grid-conservation-summary-submitted',
      conservationEvidenceRetained: true,
      conservationEvidenceBufferByteLength: 32,
      normalPathMapCount: 0,
      normalPathReadbackBytes: 0,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      queueCompletionStatus: 'queue-work-completed',
      queueCompletionMethod: 'queue.onSubmittedWorkDone',
      queueFenceCompleted: true,
      computeManagerLaneIdentityStatus: 'actual-compute-manager-lane-identity-bound',
      computeManagerLaneIdentity: laneIdentity
    }
  };
  return snapshot;
}

test('mounted resident-authority URL preserves scenarios and forces only authority gates', () => {
  const target = new URL(buildMountedResidentAuthorityUrl(
    'https://127.0.0.1:5173/?scenario=iron-ice&drop=Fe&base=h2o&residentComputeManagerMode=direct&surfaceDraw=three-render-row-spheres'
  ));
  assert.equal(target.searchParams.get('scenario'), 'iron-ice');
  assert.equal(target.searchParams.get('drop'), 'Fe');
  assert.equal(target.searchParams.get('base'), 'h2o');
  assert.equal(target.searchParams.get('mech'), 'mlsmpm');
  assert.equal(target.searchParams.get('lawp'), '1');
  assert.equal(target.searchParams.get('residentAuto'), '1');
  assert.equal(target.searchParams.get('residentStepsPerSchedule'), '1');
  assert.equal(target.searchParams.get('residentComputeManagerMode'), 'compute-manager');
  assert.equal(target.searchParams.get('renderer'), 'native-webgpu');
  assert.equal(target.searchParams.get('renderOwnership'), 'main-thread-renderer');
  assert.equal(target.searchParams.get('surfaceDraw'), 'native-webgpu-surface-consumer');
  assert.equal(target.searchParams.get('visualCapture'), '1');

  const multiStepTarget = new URL(buildMountedResidentAuthorityUrl(
    'https://127.0.0.1:5173/?residentStepsPerSchedule=999',
    { residentStepsPerSchedule: 16 }
  ));
  assert.equal(multiStepTarget.searchParams.get('residentStepsPerSchedule'), '16');
  const invalidStepTarget = new URL(buildMountedResidentAuthorityUrl(
    'https://127.0.0.1:5173/',
    { residentStepsPerSchedule: 0 }
  ));
  assert.equal(invalidStepTarget.searchParams.get('residentStepsPerSchedule'), '1');

  const schroederTarget = new URL(buildMountedResidentAuthorityUrl(
    'https://127.0.0.1:5173/?scenario=iron-ice&ss=0&ssLevel=4',
    { requireSchroeder: true }
  ));
  assert.equal(schroederTarget.searchParams.get('scenario'), 'iron-ice');
  assert.equal(schroederTarget.searchParams.get('ss'), '1');
  assert.equal(schroederTarget.searchParams.get('ssLevel'), '0');
  assert.equal(schroederTarget.searchParams.get('ssTwoLevel'), '1');
  assert.equal(
    schroederTarget.searchParams.get('schroederTwoLevelAuthority'),
    'authoritative'
  );
  assert.equal(schroederTarget.searchParams.get('schroederCrossLevelCoupling'), '1');
  assert.equal(schroederTarget.searchParams.get('lawp'), '0');
  assert.equal(schroederTarget.searchParams.get('lawt'), '0');
  assert.equal(schroederTarget.searchParams.get('lawr'), '0');
  assert.equal(schroederTarget.searchParams.get('schroederActiveNodeIndex'), '0');
  assert.equal(schroederTarget.searchParams.get('schroederActiveNodeSortedIndex'), '0');
  assert.equal(schroederTarget.searchParams.get('schroederLawQueue'), '0');
  assert.equal(schroederTarget.searchParams.get('schroederLawNeighbors'), '0');
  assert.equal(schroederTarget.searchParams.get('schroederLawNeighborCandidates'), '0');
});

test('mounted resident-authority evaluator accepts exact live identity and commit evidence', () => {
  const report = evaluateMountedResidentAuthoritySnapshot(passingSnapshot());
  assert.equal(report.status, 'passed');
  assert.equal(report.checkCount, 17);
  assert.equal(report.passedCheckCount, 17);
  assert.deepEqual(report.failedCheckIds, []);
  assert.equal(report.schedule.maximumInFlight, 1);
  assert.equal(report.schedule.remainingInFlight, 0);
});

test('mounted resident-authority evaluator admits requested sequential schedules and steps', () => {
  const snapshot = passingSnapshot();
  const stepCount = 4;
  const submissionCount = 3;
  snapshot.probeConfig = {
    targetResidentSubmissionCount: submissionCount,
    residentStepsPerSchedule: stepCount
  };
  snapshot.scheduleTrace = Array.from({ length: submissionCount }, (_, index) => {
    const token = index + 1;
    const start = index * 10;
    return [
      { scheduleToken: token, stage: 'scheduled', atMs: start + 1 },
      { scheduleToken: token, stage: 'refresh-settled', atMs: start + 4 },
      { scheduleToken: token, stage: 'published', atMs: start + 8 }
    ];
  }).flat();
  snapshot.residentScheduleSnapshots = summarizeMountedScheduleTrace(
    snapshot.scheduleTrace
  ).schedules;
  snapshot.residentPerf = {
    residentSubmissions: submissionCount,
    residentStepsPerSchedule: stepCount
  };
  snapshot.execution.completedStepCount = stepCount;
  const payload = snapshot.execution.commitDelta.payload;
  const identity = payload.pressureSourceFieldConsumptionIdentity;
  const consumption = snapshot.execution.materialInterfaceSourceFieldConsumption;
  Object.assign(payload, {
    completedStepCount: stepCount,
    pressurePhysicsStepCount: stepCount,
    pressureEpochCount: stepCount,
    pressureAppliedSubstepCount: stepCount
  });
  Object.assign(identity, {
    physicsStepCount: stepCount,
    pressureEpochCount: stepCount,
    pressureAppliedSubstepCount: stepCount
  });
  Object.assign(consumption, {
    physicsStepCount: stepCount,
    pressureEpochCount: stepCount,
    pressureAppliedSubstepCount: stepCount
  });
  Object.assign(snapshot.stateManagerWarmEntry, {
    payloadCompletedStepCount: stepCount,
    payloadPressureEpochCount: stepCount,
    payloadPressureAppliedSubstepCount: stepCount
  });

  const report = evaluateMountedResidentAuthoritySnapshot(snapshot);
  assert.equal(report.status, 'passed');
  assert.equal(report.targetResidentSubmissionCount, submissionCount);
  assert.equal(report.residentStepsPerSchedule, stepCount);
  assert.equal(report.schedule.scheduledCount, submissionCount);
  assert.equal(report.schedule.publishedCount, submissionCount);
  assert.equal(report.schedule.maximumInFlight, 1);
  assert.deepEqual(report.failedCheckIds, []);
});

test('mounted resident-authority evaluator rejects fallback and forged authority evidence', () => {
  const cases = [
    {
      id: 'compute-manager-owned-resident-step',
      mutate(snapshot) { snapshot.execution.residentComputeManagerMode = 'direct'; }
    },
    {
      id: 'single-in-flight-mounted-schedule',
      mutate(snapshot) {
        snapshot.scheduleTrace.splice(1, 0, {
          scheduleToken: 2,
          stage: 'scheduled',
          atMs: 1.5
        });
        snapshot.scheduleTrace.push({ scheduleToken: 2, stage: 'published', atMs: 5 });
      }
    },
    {
      id: 'state-manager-commit-accepted',
      mutate(snapshot) { snapshot.execution.stateManagerCommit.accepted = false; }
    },
    {
      id: 'state-manager-exact-warm-entry',
      mutate(snapshot) { snapshot.stateManagerWarmEntry.payloadPressureIdentityLeaseId = 'forged'; }
    },
    {
      id: 'pressure-state-mutation-admitted',
      mutate(snapshot) { snapshot.execution.commitDelta.payload.pressureStateManagerAdmissionApproved = false; }
    },
    {
      id: 'requested-pressure-epochs-and-applied-substeps',
      mutate(snapshot) { snapshot.execution.commitDelta.payload.pressureAppliedSubstepCount = 2; }
    },
    {
      id: 'injected-lane-identity-exact',
      mutate(snapshot) {
        snapshot.execution.commitDelta.payload
          .pressureSourceFieldConsumptionIdentity.sourceNeighborhoodLaneId = 'forged';
      }
    },
    {
      id: 'injected-lane-identity-exact',
      mutate(snapshot) {
        snapshot.execution.commitDelta.payload
          .pressureSourceFieldConsumptionIdentity.sourceNeighborhoodLaneId = 'forged';
        snapshot.execution.materialInterfaceSourceFieldConsumption
          .sourceNeighborhoodLaneId = 'forged';
      }
    },
    {
      id: 'injected-lane-lease-identity-exact',
      mutate(snapshot) {
        snapshot.execution.commitDelta.payload
          .pressureSourceFieldConsumptionIdentity.leaseId = 'forged';
      }
    },
    {
      id: 'injected-state-identity-exact',
      mutate(snapshot) {
        snapshot.execution.materialInterfaceSourceFieldConsumption.consumerStateKey = 'forged';
      }
    },
    {
      id: 'injected-state-identity-exact',
      mutate(snapshot) {
        snapshot.execution.commitDelta.payload
          .pressureSourceFieldConsumptionIdentity.sourceNeighborhoodStateKey = 'forged';
        snapshot.execution.materialInterfaceSourceFieldConsumption
          .sourceNeighborhoodStateKey = 'forged';
      }
    },
    {
      id: 'injected-device-identity-exact',
      mutate(snapshot) {
        snapshot.execution.commitDelta.payload
          .pressureSourceFieldConsumptionIdentity.consumerDeviceId = 'forged';
      }
    },
    {
      id: 'source-consumer-lease-non-null',
      mutate(snapshot) {
        snapshot.execution.commitDelta.payload
          .pressureSourceFieldConsumptionIdentity.consumerLeaseId = null;
      }
    },
    {
      id: 'source-step-epoch-generation-exact',
      mutate(snapshot) {
        snapshot.execution.commitDelta.payload
          .pressureSourceFieldConsumptionIdentity.sourceNeighborhoodGeneration += 1;
      }
    },
    {
      id: 'scene-native-webgpu-surface-bridge',
      mutate(snapshot) { snapshot.nativeSurface.source = 'standalone-fallback'; }
    },
    {
      id: 'native-surface-extraction-one-submit',
      mutate(snapshot) { snapshot.nativeSurface.nativeMarchingCubesExtractionBatchInternalSubmitCount = 2; }
    },
    {
      id: 'zero-browser-errors',
      mutate(snapshot) { snapshot.browserErrors.page.push('page failed'); }
    },
    {
      id: 'zero-browser-errors',
      mutate(snapshot) { snapshot.residentError = 'resident commit rejected'; }
    },
    {
      id: 'zero-webgpu-errors',
      mutate(snapshot) { snapshot.webGpuErrors.push({ message: 'validation failed' }); }
    }
  ];

  for (const fixture of cases) {
    const snapshot = passingSnapshot();
    fixture.mutate(snapshot);
    const report = evaluateMountedResidentAuthoritySnapshot(snapshot);
    assert.equal(report.status, 'failed', fixture.id);
    assert.ok(report.failedCheckIds.includes(fixture.id), fixture.id);
  }
});

test('strict Schroeder profile accepts admitted two-level sparse authority evidence', () => {
  const snapshot = passingSchroederSnapshot();
  assert.deepEqual(
    snapshot.schroederEvidence.authoritySequence.stageList,
    STRICT_SCHROEDER_AUTHORITY_STAGE_ORDER
  );
  const report = evaluateMountedResidentAuthoritySnapshot(snapshot, {
    requireSchroeder: true
  });
  assert.equal(report.status, 'passed');
  assert.equal(report.profile, 'strict-schroeder');
  assert.equal(report.checkCount, 19);
  assert.equal(report.passedCheckCount, 19);
  assert.deepEqual(report.failedCheckIds, []);
  assert.equal(
    report.deferredCrossComposition,
    'priority-5-pressure-thermal-reaction-composition-not-required-by-this-profile'
  );
});

test('strict Schroeder profile rejects direct, forged, dense, readback, and third-level paths', () => {
  const cases = [
    {
      id: 'compute-manager-owned-resident-step',
      mutate(snapshot) { snapshot.execution.residentComputeManagerMode = 'direct-schroeder-scene'; }
    },
    {
      id: 'state-manager-exact-warm-entry',
      mutate(snapshot) { snapshot.stateManagerWarmEntry.payloadStateKey = 'forged'; }
    },
    {
      id: 'schroeder-authoritative-compute-manager-execution',
      mutate(snapshot) { snapshot.schroederEvidence.gpuAuthoritativeState = false; }
    },
    {
      id: 'schroeder-compute-manager-lane-identity-exact',
      mutate(snapshot) {
        snapshot.schroederEvidence.authoritySequence
          .computeManagerLaneIdentity.leaseId = null;
      }
    },
    {
      id: 'schroeder-two-level-only',
      mutate(snapshot) { snapshot.schroederEvidence.sparseHierarchyLevelCount = 3; }
    },
    {
      id: 'schroeder-caller-owned-single-submit',
      mutate(snapshot) {
        snapshot.schroederEvidence.authoritySequence.commandSubmissionCount = 2;
      }
    },
    {
      id: 'schroeder-caller-owned-single-submit',
      mutate(snapshot) {
        const stages = snapshot.schroederEvidence.authoritySequence.stageList;
        [stages[5], stages[6]] = [stages[6], stages[5]];
      }
    },
    {
      id: 'schroeder-caller-owned-single-submit',
      mutate(snapshot) {
        snapshot.schroederEvidence.authoritySequence.stageList.push('unexpected-extra-stage');
        snapshot.schroederEvidence.authoritySequence.stageCount += 1;
      }
    },
    {
      id: 'schroeder-sparse-hierarchy-retained',
      mutate(snapshot) {
        snapshot.schroederEvidence.sparseHierarchyRetainedEvidenceBuffer = false;
      }
    },
    {
      id: 'schroeder-sparse-grid-views',
      mutate(snapshot) {
        snapshot.schroederEvidence.authoritySequence.sparseCoarseGridStatus =
          'dense-grid-fallback';
      }
    },
    {
      id: 'schroeder-compact-p2g-update-g2p',
      mutate(snapshot) {
        snapshot.schroederEvidence.authoritySequence.compactG2pStatus = 'dense-g2p';
      }
    },
    {
      id: 'schroeder-cross-level-retained-evidence',
      mutate(snapshot) {
        snapshot.schroederEvidence.authoritySequence.conservationEvidenceRetained = false;
      }
    },
    {
      id: 'schroeder-normal-path-readback-free',
      mutate(snapshot) {
        snapshot.schroederEvidence.authoritySequence.normalPathMapCount = 1;
      }
    },
    {
      id: 'schroeder-third-level-hold',
      mutate(snapshot) {
        snapshot.schroederEvidence.authoritySequence.sparseHierarchyThirdLevelHold = false;
      }
    }
  ];

  for (const fixture of cases) {
    const snapshot = passingSchroederSnapshot();
    fixture.mutate(snapshot);
    const report = evaluateMountedResidentAuthoritySnapshot(snapshot, {
      requireSchroeder: true
    });
    assert.equal(report.status, 'failed', fixture.id);
    assert.ok(report.failedCheckIds.includes(fixture.id), fixture.id);
  }
});

test('mounted schedule trace summary exposes overlap and unbalanced publication', () => {
  const report = summarizeMountedScheduleTrace([
    { scheduleToken: 1, stage: 'scheduled' },
    { scheduleToken: 2, stage: 'scheduled' },
    { scheduleToken: 1, stage: 'published' },
    { scheduleToken: 3, stage: 'published' }
  ]);
  assert.equal(report.scheduledCount, 2);
  assert.equal(report.publishedCount, 2);
  assert.equal(report.maximumInFlight, 2);
  assert.equal(report.remainingInFlight, 1);
  assert.equal(report.publishWithoutScheduleCount, 1);
  assert.deepEqual(report.schedules, [
    {
      scheduleToken: 1,
      scheduledAtMs: null,
      publishedAtMs: null,
      durationMs: null,
      status: null,
      stale: null,
      requestedStepCount: null,
      continueFromResidentState: null,
      residentSequenceAuthorityEpoch: null
    },
    {
      scheduleToken: 2,
      scheduledAtMs: null,
      publishedAtMs: null,
      durationMs: null,
      status: null,
      stale: null,
      requestedStepCount: null,
      continueFromResidentState: null,
      residentSequenceAuthorityEpoch: null
    }
  ]);

  const live = {
    console: [],
    page: [],
    request: [{ url: '/before.js', errorText: 'ERR_FAILED' }],
    http: [],
    harness: []
  };
  const captured = snapshotMountedBrowserErrors(live);
  live.request[0].errorText = 'ERR_CHANGED_AFTER_CAPTURE';
  live.request.push({ url: '/late-vite-import.js', errorText: 'ERR_ABORTED' });
  live.page.push('browser-close event');
  assert.deepEqual(captured, {
    console: [],
    page: [],
    request: [{ url: '/before.js', errorText: 'ERR_FAILED' }],
    http: [],
    harness: []
  });
});

test('mounted performance compactor retains host, allocation, workspace, and cache evidence', () => {
  const report = compactMountedResidentFinalStepPerformance({
    stageTiming: {
      totalMs: 19.5,
      hostTiming: {
        schema: 'peercompute.ulg.mls-mpm-fused-resident-host-timing.v0',
        workspaceEligible: true,
        preWorkspaceSetupMs: 0.2,
        workspaceAcquireMs: 0.3,
        postWorkspaceSetupMs: 0.4,
        commandRecordingMs: 12.1,
        queueSubmitCallMs: 0.1,
        postSubmitBookkeepingMs: 1.2,
        allocationEvidenceMs: 0.7,
        postAllocationFinalizeMs: 0.2,
        classifiedMs: 15.2,
        unclassifiedMs: 0.1,
        totalMs: 15.3,
        ignored: 'not-copied'
      },
      gpuAllocationEvidence: {
        schema: 'peercompute.ulg.webgpu-buffer-allocation-evidence.v0',
        scope: 'mls-mpm-fused-resident-sequence',
        bufferCount: 12,
        ownedBufferCount: 9,
        borrowedBufferCount: 3,
        createdThisSubmissionBufferCount: 0,
        persistentWorkspaceBufferCount: 9,
        transientSubmissionBufferCount: 0,
        knownByteLengthBufferCount: 12,
        unknownByteLengthBufferCount: 0,
        allocatedByteLength: 4096,
        createdThisSubmissionByteLength: 0,
        persistentWorkspaceByteLength: 4096,
        transientSubmissionByteLength: 0,
        borrowedByteLength: 1024,
        bufferRowsIncluded: false,
        bufferRowsOmittedCount: 12,
        buffers: [{ shouldNotBeCopied: true }]
      },
      residentSequenceWorkspace: {
        schema: 'peercompute.ulg.sph-resident-sequence-workspace-lane-evidence.v0',
        status: 'sph-resident-sequence-workspace-lane-ready',
        workspaceGeneration: 2,
        totalAcquisitionCount: 3,
        totalSubmissionCount: 3,
        totalWorkspaceCreationCount: 1,
        totalWorkspaceReuseCount: 2,
        createdThisAcquisition: false,
        reused: true,
        totalByteLength: 8192
      },
      thermalWorkspaceStatus: 'thermal-workspace-ready',
      thermalWorkspaceBufferCount: 2,
      thermalWorkspaceReusedSubstepCount: 3,
      reactionCoreWorkspaceStatus: 'reaction-core-workspace-ready',
      reactionCoreWorkspaceBufferCount: 4,
      reactionCoreWorkspaceReusedSubstepCount: 3
    },
    fusedResidentSequence: {
      mechanicsBindGroupCacheEntryCount: 7,
      mechanicsBindGroupCreationCount: 7,
      mechanicsBindGroupReuseCount: 13,
      residentGasCellEosLaneCacheStatus: 'gpu-gas-cell-eos-lane-cache-hit',
      dispatchCount: 400,
      mechanicsDispatchCount: 80,
      sidecarFusionDispatchCount: 320,
      residentProductMassProductEventRowCount: 96,
      residentNeighborhoodLane: {
        status: 'resident-neighborhood-production-generations-encoded',
        generationCount: 49,
        encodedDispatchCount: 246,
        encodedComputePassCount: 99,
        bindGroupCreationCount: 0,
        builderStrategy: 'direct'
      },
      reactiveResidentSequence: {
        status: 'reactive-resident-substep-sequence-submitted',
        stepCount: 16,
        gasCellEosSourceRowCountUpperBounds: [64, 66, 68],
        gasCellEosGenerationCount: 16,
        commandSubmissionCount: 1,
        normalHotLoopReadbackFree: true
      },
      residentGasCellEosSourceRowCount: 94,
      residentGasCellEosSourceCapacity: 94,
      residentGasCellEos: {
        status: 'sph-spatial-gas-cell-eos-gpu-encoded',
        aggregationStrategy: 'deterministic-direct-key-sort-unique',
        directPrefix: true,
        radixBypassed: true,
        encodedDispatchCount: 5,
        encodedComputePassCount: 2,
        bindGroupCreationCount: 0,
        bindGroupReuseCount: 5,
        bindGroupCacheEntryCount: 5,
        laneBindGroupCreationCount: 5,
        laneBindGroupReuseCount: 10
      }
    },
    thermalStep: {
      result: {
        thermalBindGroupCacheHit: true,
        thermalBindGroupCacheEvidence: {
          slotCapacity: 4,
          populatedSlotCount: 4,
          hitCount: 4,
          missCount: 4
        }
      }
    },
    reactionStep: {
      result: {
        reactionProposeBindGroupCacheHit: true,
        reactionResolveBindGroupCacheHit: true,
        reactionBindGroupCacheEvidence: {
          slotCapacity: 4,
          proposeHitCount: 4,
          proposeMissCount: 4,
          resolveHitCount: 4,
          resolveMissCount: 4
        }
      }
    }
  });

  assert.equal(
    report.schema,
    'peercompute.ulg.mounted-resident-final-step-performance.v0'
  );
  assert.equal(report.hostTiming.commandRecordingMs, 12.1);
  assert.equal(Object.hasOwn(report.hostTiming, 'ignored'), false);
  assert.equal(report.gpuAllocationEvidence.createdThisSubmissionBufferCount, 0);
  assert.equal(Object.hasOwn(report.gpuAllocationEvidence, 'buffers'), false);
  assert.equal(report.residentSequenceWorkspace.reused, true);
  assert.equal(report.residentSequenceWorkspace.totalWorkspaceReuseCount, 2);
  assert.equal(report.workspaceTelemetry.thermalWorkspaceBufferCount, 2);
  assert.equal(report.workspaceTelemetry.reactionCoreWorkspaceBufferCount, 4);
  assert.equal(report.commandTopology.dispatchCount, 400);
  assert.equal(report.neighborhoodTelemetry.generationCount, 49);
  assert.equal(report.neighborhoodTelemetry.encodedComputePassCount, 99);
  assert.deepEqual(report.reactiveTelemetry.gasCellEosSourceRowCountUpperBounds, [64, 66, 68]);
  assert.equal(report.gasCellEosTelemetry.sourceCapacity, 94);
  assert.equal(report.gasCellEosTelemetry.directPrefix, true);
  assert.deepEqual(report.cacheTelemetry.mechanics, {
    entryCount: 7,
    creationCount: 7,
    reuseCount: 13
  });
  assert.equal(report.cacheTelemetry.thermal.hitCount, 4);
  assert.equal(report.cacheTelemetry.reaction.resolveHitCount, 4);
  assert.equal(report.cacheTelemetry.gasCellEos.bindGroupReuseCount, 5);
});

test('mounted resident perf compactor retains compute, cycle, postcompute, and render timing', () => {
  const report = compactMountedResidentPerf({
    schema: 'peercompute.ulg.sph-demo-resident-perf.v0',
    residentSubmissions: 3,
    residentStepsPerSchedule: 4,
    lastResidentMs: 41.2,
    lastResidentCycleMs: 47.6,
    lastResidentPostComputeMs: 6.4,
    lastResidentMaterialInterfaceRefreshMs: 1.1,
    lastResidentPressureInterfaceRefreshMs: 1.2,
    lastResidentInterfaceRefreshMs: 2.3,
    lastRenderReadbackMs: 8.8,
    residentPresentationBackpressurePending: false,
    residentPresentationBackpressureStatus: 'native-presentation-backpressure-settled',
    residentPresentationBackpressureWaitCount: 3,
    residentPresentationBackpressureDeferredScheduleCount: 11,
    lastResidentPresentationBackpressureMs: 7.6,
    residentPresentationMaxComputeSubmissionsAhead: 1,
    residentInterfaceRefreshPending: false,
    residentRenderRefreshPending: true,
    lastResidentStageTiming: { shouldNotBeCopied: true }
  });

  assert.deepEqual(report, {
    schema: 'peercompute.ulg.sph-demo-resident-perf.v0',
    residentSubmissions: 3,
    residentStepsPerSchedule: 4,
    lastResidentMs: 41.2,
    lastResidentCycleMs: 47.6,
    lastResidentPostComputeMs: 6.4,
    lastResidentMaterialInterfaceRefreshMs: 1.1,
    lastResidentPressureInterfaceRefreshMs: 1.2,
    lastResidentInterfaceRefreshMs: 2.3,
    lastRenderReadbackMs: 8.8,
    residentPresentationBackpressurePending: false,
    residentPresentationBackpressureStatus: 'native-presentation-backpressure-settled',
    residentPresentationBackpressureWaitCount: 3,
    residentPresentationBackpressureDeferredScheduleCount: 11,
    lastResidentPresentationBackpressureMs: 7.6,
    residentPresentationMaxComputeSubmissionsAhead: 1,
    residentInterfaceRefreshPending: false,
    residentRenderRefreshPending: true
  });
});

test('mounted render refresh trace compactor retains supersession and visibility transfer evidence', () => {
  const report = compactMountedRenderRefreshTrace([{
    status: 'resident-async-render-active-superseded',
    sequence: 1,
    activeSequence: 1,
    pendingSequence: 4,
    entrySuperseded: true,
    supersededBySequence: 4,
    activeSuperseded: true,
    requiredVisible: true,
    visibilityObligationTransferred: true,
    requestSource: 'resident-physics-cadence-refresh',
    sourceResidentNextStep: 16,
    published: false,
    ignoredGpuObject: { shouldNotBeCopied: true }
  }]);

  assert.equal(report.length, 1);
  assert.equal(report[0].status, 'resident-async-render-active-superseded');
  assert.equal(report[0].supersededBySequence, 4);
  assert.equal(report[0].requiredVisible, true);
  assert.equal(report[0].visibilityObligationTransferred, true);
  assert.equal(report[0].published, false);
  assert.equal(Object.hasOwn(report[0], 'ignoredGpuObject'), false);
});
