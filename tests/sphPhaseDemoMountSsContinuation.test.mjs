import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  SPH_PHASE_URL_PARAM_KEYS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,
  resolveSphReactionActivationConfiguration,
  resolveSphMountedArchitectureControlState,
  resolveSphMountedScheduleControlEvidence,
  resolveSphResidentInterfaceRefreshContinuationPolicy,
  resolveSphMountedWorkerLaneScheduleStepCount,
  resolveSphWorkerLanePostCommitFastContinuation,
  residentWorkerLaneContinuationReady,
  residentWorkerLaneIsosurfacePresentationConsumerReady,
  residentWorkerLaneIsosurfacePresentationEnqueued,
  shouldSkipSphResidentPressureInterfaceForRenderRefresh,
  sphResidentChainedContinuationAllowed,
  sphResidentInterfaceRefreshPublicationIsCurrent,
  sphResidentInterfaceSchedulePublicationIsCurrent,
  sphResidentRenderSchedulePublicationIsCurrent,
  sphResidentSchedulePublicationIsCurrent,
  sphResidentPlaybackRestartAllowed
} from '../src/visualization/sphPhaseDemoMount.js';
import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_DISABLED,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_SHADOW
} from '../src/runtime/sph/schroederDynamicLawRoutingContract.js';

test('reaction activation defaults to shadow without conflating the reactions checkbox', () => {
  assert.deepEqual(resolveSphReactionActivationConfiguration(), {
    schema: 'peercompute.ulg.sph-reaction-activation-configuration.v0',
    reactionsEnabled: true,
    schroederSimulationEnabled: false,
    reactionActivationPolicy:
      SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_SHADOW,
    hardUserOff: false,
    staticReactionExecution: true,
    authoritativeDynamicActivation: false
  });

  const authoritative = resolveSphReactionActivationConfiguration({
    reactionsEnabled: true,
    schroederSimulationEnabled: true,
    reactionActivationPolicy:
      SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE
  });
  assert.equal(authoritative.reactionsEnabled, true);
  assert.equal(authoritative.schroederSimulationEnabled, true);
  assert.equal(authoritative.staticReactionExecution, false);
  assert.equal(authoritative.authoritativeDynamicActivation, true);

  const hardOff = resolveSphReactionActivationConfiguration({
    reactionsEnabled: false,
    schroederSimulationEnabled: true,
    reactionActivationPolicy:
      SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE
  });
  assert.equal(hardOff.reactionsEnabled, false);
  assert.equal(
    hardOff.reactionActivationPolicy,
    SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE
  );
  assert.equal(hardOff.hardUserOff, true);
  assert.equal(hardOff.staticReactionExecution, false);
  assert.equal(hardOff.authoritativeDynamicActivation, false);

  const nonSsAuthoritativePolicy =
    resolveSphReactionActivationConfiguration({
      reactionsEnabled: true,
      schroederSimulationEnabled: false,
      reactionActivationPolicy:
        SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE
    });
  assert.equal(nonSsAuthoritativePolicy.staticReactionExecution, true);
  assert.equal(
    nonSsAuthoritativePolicy.authoritativeDynamicActivation,
    false
  );

  const staticWithoutSelector = resolveSphReactionActivationConfiguration({
    reactionsEnabled: true,
    reactionActivationPolicy: SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_DISABLED
  });
  assert.equal(staticWithoutSelector.staticReactionExecution, true);
  assert.equal(staticWithoutSelector.authoritativeDynamicActivation, false);

  const invalidFallsBackToShadow = resolveSphReactionActivationConfiguration({
    reactionActivationPolicy: 'unknown-policy'
  });
  assert.equal(
    invalidFallsBackToShadow.reactionActivationPolicy,
    SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_SHADOW
  );
  assert.equal(Object.isFrozen(invalidFallsBackToShadow), true);
});

test('mounted reaction activation policy is URL-bound and provisions a dormant authoritative catalog', () => {
  assert.equal(SPH_PHASE_URL_PARAM_KEYS.includes('reactionActivationPolicy'), true);
  assert.equal(
    SPH_PHASE_URL_PARAM_KEYS.includes('reactionProductReserveExactDiscovery'),
    true
  );
  const source = readFileSync(
    new URL('../src/visualization/sphPhaseDemoMount.js', import.meta.url),
    'utf8'
  );
  assert.match(
    source,
    /reactionActivationPolicy:\s*reactionActivationPolicySelect,/
  );
  assert.match(
    source,
    /physicalLawGroups:\s*physicalLawGroupsForInitialExecutionFromControls\(\),/
  );
  assert.match(
    source,
    /reactionProductReserveExactDiscovery:\s*initialReactionProductReserveExactDiscovery,/
  );
  assert.match(
    source,
    /emptyCatalogAuthority:\s*reactionDiscovery\.emptyCatalogAuthority \|\| null,/
  );
  assert.match(
    source,
    /const sceneReactions = reactionActivation\.authoritativeDynamicActivation[\s\S]*?viewState\.reactionDiscovery\?\.reactions \?\? viewState\.reactions/
  );
  assert.equal(
    (source.match(
      /reactionActivationPolicy:\s*\n\s*reactionActivation\.reactionActivationPolicy,/g
    ) || []).length,
    2
  );
  assert.match(
    source,
    /const requestedPhysicalLawGroups = physicalLawGroupsFromControls\(\);[\s\S]*?const activePhysicalLawGroups = effectivePhysicalLawGroups/
  );

  const query = new URLSearchParams({
    lawr: '1',
    reactionActivationPolicy:
      SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE
  });
  const restored = resolveSphReactionActivationConfiguration({
    reactionsEnabled: query.get('lawr') !== '0',
    schroederSimulationEnabled: true,
    reactionActivationPolicy: query.get('reactionActivationPolicy')
  });
  const canonical = new URLSearchParams();
  canonical.set('lawr', restored.reactionsEnabled ? '1' : '0');
  canonical.set(
    'reactionActivationPolicy',
    restored.reactionActivationPolicy
  );
  assert.equal(canonical.toString(), query.toString());
});

test('mounted schedule controls publish requested, policy maximum, and effective cadence', () => {
  const evidence = resolveSphMountedScheduleControlEvidence({
    requestedStepCount: 64,
    residentStepsPerScheduleMax: 1,
    workerLaneActive: true
  });
  assert.deepEqual(evidence, {
    schema: 'peercompute.ulg.sph-mounted-schedule-control-evidence.v0',
    status: 'mounted-schedule-control-evidence-ready',
    requestedStepCount: 64,
    policyMaxStepCount: 1,
    effectiveStepCount: 1,
    workerLaneActive: true,
    requestCappedByPolicy: true
  });
  assert.equal(Object.isFrozen(evidence), true);
});

test('authoritative worker profile normalizes dependent controls and fine substeps', () => {
  const state = resolveSphMountedArchitectureControlState({
    mechanicsMode: 'mlsmpm',
    ss: true,
    twoLevel: true,
    activeNodeIndex: true,
    activeNodeSortedIndex: true,
    lawQueue: true,
    lawNeighborCandidates: true,
    crossLevelCoupling: true,
    phaseVolumeMigration: true,
    mechanicsFieldPairV2: true,
    contactSolver: true,
    surfaceDraw: 'native-webgpu-surface-consumer',
    surfaceOverlay: false,
    workerParticleOverlay: false,
    twoLevelAuthority: 'authoritative',
    fineSubsteps: 1,
    normalizeDependencies: true
  });
  assert.equal(state.fineSubsteps, 2);
  assert.equal(state.crossLevelCoupling, false);
  assert.equal(state.disabled.crossLevelCoupling, true);
  assert.equal(
    state.crossLevelTransportMode,
    'authoritative-paired-fields-terminal-reflux'
  );
  assert.equal(state.authoritativeFineSubstepMinimum, 2);
  assert.equal(state.contactSolver, true);
  assert.equal(state.disabled.contactSolver, false);
  assert.equal(state.contactSolverMode, 'canonical-spatial-contact');
  assert.equal(state.profile, 'ss-two-authoritative-worker');
  assert.deepEqual(state.dependencyIssues, []);
});

test('worker SS admits explicit contact-off as the contact-free bulk profile', () => {
  const raw = resolveSphMountedArchitectureControlState({
    mechanicsMode: 'mlsmpm',
    ss: true,
    contactSolver: false
  });
  assert.equal(raw.ss, true);
  assert.equal(raw.contactSolver, false);
  assert.equal(raw.disabled.contactSolver, false);
  assert.deepEqual(raw.dependencyIssues, []);
  assert.equal(raw.contactSolverMode, 'explicit-contact-free-bulk');
  assert.equal(raw.profile, 'custom');

  // Normalization preserves the explicit choice: contact-off never turns
  // SS off and is never silently forced back on (the worker lane enforces
  // eligibility against its law-activation receipt instead).
  const normalized = resolveSphMountedArchitectureControlState({
    mechanicsMode: 'mlsmpm',
    ss: true,
    contactSolver: false,
    normalizeDependencies: true
  });
  assert.equal(normalized.ss, true);
  assert.equal(normalized.contactSolver, false);
  assert.equal(normalized.disabled.contactSolver, false);
  assert.equal(normalized.contactSolverMode, 'explicit-contact-free-bulk');
  assert.deepEqual(normalized.dependencyIssues, []);
});

test('plain SPH is an explicit hierarchy opt-out with a repairable dirty state', () => {
  const raw = resolveSphMountedArchitectureControlState({
    mechanicsMode: 'sph',
    ss: true
  });
  assert.equal(raw.ss, true);
  assert.equal(raw.normalizedWorkerSs, false);
  assert.equal(raw.disabled.ss, false);
  assert.deepEqual(raw.dependencyIssues, ['ss-requires-mlsmpm']);
  assert.equal(raw.profile, 'custom');

  const normalized = resolveSphMountedArchitectureControlState({
    mechanicsMode: 'sph',
    ss: true,
    twoLevel: true,
    lawQueue: true,
    normalizeDependencies: true
  });
  assert.equal(normalized.mechanicsMode, 'sph');
  assert.equal(normalized.ss, false);
  assert.equal(normalized.twoLevel, false);
  assert.equal(normalized.lawQueue, false);
  assert.equal(normalized.disabled.ss, true);
  assert.deepEqual(normalized.dependencyIssues, []);
  assert.equal(normalized.profile, 'main-thread-diagnostic');
});

test('architecture dependencies fail closed and every profile deviation is Custom', () => {
  const invalid = resolveSphMountedArchitectureControlState({
    mechanicsMode: 'mlsmpm',
    ss: false,
    twoLevel: true,
    activeNodeIndex: false,
    activeNodeSortedIndex: true,
    lawQueue: false,
    lawNeighborCandidates: true,
    crossLevelCoupling: true,
    mechanicsFieldPairV2: true,
    workerParticleOverlay: true,
    twoLevelAuthority: 'authoritative',
    fineSubsteps: 1
  });
  assert.deepEqual(invalid.dependencyIssues, [
    'two-level-requires-worker-ss',
    'sorted-active-index-requires-active-index',
    'law-neighbor-candidates-require-law-queue',
    'cross-level-coupling-requires-two-level',
    'paired-fields-require-two-level',
    'worker-particle-overlay-requires-worker-ss'
  ]);
  assert.equal(invalid.profile, 'custom');

  const canonical = {
    mechanicsMode: 'mlsmpm',
    ss: true,
    twoLevel: false,
    activeNodeIndex: true,
    activeNodeSortedIndex: true,
    lawQueue: true,
    lawNeighborCandidates: true,
    crossLevelCoupling: false,
    phaseVolumeMigration: true,
    mechanicsFieldPairV2: false,
    contactSolver: true,
    surfaceDraw: 'native-webgpu-surface-consumer',
    surfaceOverlay: false,
    workerParticleOverlay: false,
    twoLevelAuthority: 'observation',
    fineSubsteps: 2
  };
  assert.equal(
    resolveSphMountedArchitectureControlState(canonical).profile,
    'ss-single-worker'
  );
  for (const deviation of [
    { activeNodeIndex: false },
    { activeNodeSortedIndex: false },
    { lawQueue: false },
    { lawNeighborCandidates: false },
    { phaseVolumeMigration: false },
    { contactSolver: false },
    { surfaceDraw: 'three-render-row-spheres' },
    { surfaceOverlay: true },
    { workerParticleOverlay: true }
  ]) {
    assert.equal(
      resolveSphMountedArchitectureControlState({
        ...canonical,
        ...deviation
      }).profile,
      'custom',
      JSON.stringify(deviation)
    );
  }
});

test('mounted SS worker playback honors the renderer policy chunk cap', () => {
  assert.equal(resolveSphMountedWorkerLaneScheduleStepCount({
    requestedStepCount: 64,
    residentStepsPerScheduleMax: 1,
    workerLaneActive: true
  }), 1);
  assert.equal(resolveSphMountedWorkerLaneScheduleStepCount({
    requestedStepCount: 64,
    residentStepsPerScheduleMax: 4,
    workerLaneActive: true
  }), 4);
  assert.equal(resolveSphMountedWorkerLaneScheduleStepCount({
    requestedStepCount: 128,
    residentStepsPerScheduleMax: null,
    workerLaneActive: true
  }), 128);
});

test('worker lane continuation separates exact admission from asynchronous isosurface completion', () => {
  const execution = {
    residentComputeManagerMode: 'worker-owned-resident-lane',
    workerLaneFallback: null,
    workerOwnedResidentLane: {
      laneId: 'lane:continuation',
      stateKey: 'state:continuation',
      scheduleId: 'schedule:continuation',
      residentScheduleStatus: 'worker-resident-schedule-completed',
      cancelled: false,
      completedStepCount: 1,
      finalEpochIdentity: { storageGeneration: 8, physicsTick: 3 },
      retainedBufferRefs: ['worker:state'],
      committedPresentation: {
        status: 'worker-offscreen-resident-particle-state-producer-rendered',
        committedPresentationSchema:
          'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
        committedPresentationStatus:
          'state-manager-committed-resident-schedule-presentation-admission',
        residentScheduleCandidatePresentation: true,
        stateManagerCommittedPresentation: true,
        scheduleId: 'schedule:continuation',
        laneId: 'lane:continuation',
        stateKey: 'state:continuation',
        residentExecutionGeneration: 8,
        sphStep: 3,
        stepOrdinal: 1,
        authorityStatus: 'state-manager-committed-worker-schedule',
        computeManagerCompletionSchema:
          'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
        computeManagerLeaseId: 'lease:continuation',
        computeManagerLeaseStatus: 'completed',
        computeManagerFenceSatisfied: true,
        stateManagerCommitStatus: 'committed',
        stateManagerCommitAccepted: true,
        terminalScheduleFence: true,
        terminalFenceScope: 'resident-schedule-terminal',
        terminalFenceSatisfied: true,
        terminalFenceAuthorityAdmissionReady: true,
        producerSourceKind: 'worker-retained-resident-stage-output',
        producerSourceTransport: 'worker-retained-resident-stage-output',
        sourceStageId: 'schroederSameLevelMechanics',
        retainedParticleStateStatus: 'worker-retained-particle-state-ready'
      }
    }
  };
  assert.equal(residentWorkerLaneContinuationReady(execution), true);
  assert.equal(residentWorkerLaneContinuationReady({
    ...execution,
    workerOwnedResidentLane: {
      ...execution.workerOwnedResidentLane,
      committedPresentation: {
        ...execution.workerOwnedResidentLane.committedPresentation,
        stateManagerCommittedPresentation: false
      }
    }
  }), false);
  const requiredFields = [
    ['committedPresentationSchema', null],
    ['committedPresentationStatus', null],
    ['computeManagerCompletionSchema', null],
    ['computeManagerLeaseId', null],
    ['computeManagerLeaseStatus', 'active'],
    ['computeManagerFenceSatisfied', false],
    ['stateManagerCommitStatus', 'rejected'],
    ['terminalFenceScope', 'resident-schedule-checkpoint'],
    ['terminalFenceAuthorityAdmissionReady', false],
    ['producerSourceKind', 'worker-progress-candidate'],
    ['producerSourceTransport', 'worker-progress-candidate'],
    ['sourceStageId', 'g2p'],
    ['retainedParticleStateStatus', 'worker-retained-particle-state-missing-buffer']
  ];
  for (const [field, value] of requiredFields) {
    assert.equal(residentWorkerLaneContinuationReady({
      ...execution,
      workerOwnedResidentLane: {
        ...execution.workerOwnedResidentLane,
        committedPresentation: {
          ...execution.workerOwnedResidentLane.committedPresentation,
          [field]: value
        }
      }
    }), false, `${field} must fail closed`);
  }

  const isosurfaceEnqueuedPresentation = {
    ...execution.workerOwnedResidentLane.committedPresentation,
    schema: ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,
    status:
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,
    presentationGeometry:
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,
    sourceCapturedBeforePhysicsContinuation: true
  };
  const isosurfaceExecution = {
    ...execution,
    workerOwnedResidentLane: {
      ...execution.workerOwnedResidentLane,
      committedPresentation: isosurfaceEnqueuedPresentation
    }
  };
  assert.equal(
    residentWorkerLaneIsosurfacePresentationEnqueued(isosurfaceExecution),
    true
  );
  assert.equal(residentWorkerLaneContinuationReady(isosurfaceExecution), true);
  for (const [field, value] of [
    ['schema', null],
    ['presentationGeometry', 'sphere-impostor-depth-fallback'],
    ['sourceCapturedBeforePhysicsContinuation', false],
    ['computeManagerFenceSatisfied', false]
  ]) {
    const rejectedExecution = {
      ...isosurfaceExecution,
      workerOwnedResidentLane: {
        ...isosurfaceExecution.workerOwnedResidentLane,
        committedPresentation: {
          ...isosurfaceEnqueuedPresentation,
          [field]: value
        }
      }
    };
    assert.equal(
      residentWorkerLaneIsosurfacePresentationEnqueued(rejectedExecution),
      false,
      `enqueue ${field} must fail closed`
    );
    assert.equal(residentWorkerLaneContinuationReady(rejectedExecution), false);
  }

  const renderedIsosurfacePresentation = {
    ...isosurfaceEnqueuedPresentation,
    status:
      ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
  };
  assert.equal(
    residentWorkerLaneIsosurfacePresentationConsumerReady({
      execution: isosurfaceExecution,
      presentation: renderedIsosurfacePresentation
    }),
    true
  );
  assert.equal(
    residentWorkerLaneContinuationReady({
      ...isosurfaceExecution,
      workerOwnedResidentLane: {
        ...isosurfaceExecution.workerOwnedResidentLane,
        committedPresentation: renderedIsosurfacePresentation
      }
    }),
    false,
    'a rendered terminal receipt cannot replace the enqueue admission'
  );
  for (const [field, value] of [
    ['schema', null],
    ['presentationGeometry', 'sphere-impostor-depth-fallback'],
    ['stateManagerCommitAccepted', false],
    ['scheduleId', 'schedule:other']
  ]) {
    assert.equal(
      residentWorkerLaneIsosurfacePresentationConsumerReady({
        execution: isosurfaceExecution,
        presentation: {
          ...renderedIsosurfacePresentation,
          [field]: value
        }
      }),
      false,
      `terminal ${field} must fail closed`
    );
  }

  const tier0Execution = {
    ...execution,
    fullParticleReadbackPerformed: false,
    fullParticleReadbackFree: true,
    workerOwnedResidentLane: {
      ...execution.workerOwnedResidentLane,
      executionRoute: {
        schema:
          'peercompute.ulg.worker-schedule-execution-route-receipt.v6',
        status: 'tier0-fused-resident-sequence-admitted',
        route: 'tier0-fused-resident-sequence',
        routeDecisionStatus: 'tier0-fused-resident-sequence-selected',
        transition: 'tier0-continuation',
        blockers: [],
        requestedStepCount: 64,
        completedStepCount: 64,
        atomicSchedule: true,
        submissionMode: 'queue-ordered-presentation-qos-chunks',
        commandSubmissionCount: 8,
        submissionStepCounts: [8, 8, 8, 8, 8, 8, 8, 8],
        maxSubstepsPerSubmission: 8,
        presentationBoundaryCount: 7,
        presentationBoundaryCompletedCount: 7,
        presentationBoundaryFailureCount: 0,
        presentationQosHostQueueFenceCount: 7,
        logicalAuthorityPublicationCount: 1,
        intermediateAuthorityPublicationCount: 0,
        internalPositionSubstepCount: 64,
        fullParticleReadbackPerformed: false,
        fullParticleReadbackFree: true,
        mapAsyncCount: 0,
        readbackBytes: 0,
        residentContinuationReady: true,
        terminalFenceSatisfied: true
      }
    }
  };
  const fast = resolveSphWorkerLanePostCommitFastContinuation({
    execution: tier0Execution,
    workerLivePreviewEnabled: true
  });
  assert.equal(fast.eligible, true);
  assert.equal(fast.status, 'tier0-post-commit-fast-continuation-ready');
  assert.equal(
    fast.physicsAuthority,
    'terminal-fence-compute-manager-state-manager-committed'
  );
  assert.equal(
    fast.presentationConsumer,
    'worker-live-preview-versioned-mailbox'
  );
  assert.equal(fast.presentationCompletionReady, true);
  assert.equal(Object.isFrozen(fast), true);
  assert.equal(Object.isFrozen(fast.blockers), true);

  for (const executionRoutePatch of [
    { submissionStepCounts: [8, 8, 8, 8, 8, 8, 8, 7] },
    { presentationBoundaryCount: 6 },
    { presentationBoundaryFailureCount: null },
    { presentationQosHostQueueFenceCount: null },
    { logicalAuthorityPublicationCount: 2 },
    { intermediateAuthorityPublicationCount: 1 }
  ]) {
    const malformed = resolveSphWorkerLanePostCommitFastContinuation({
      execution: {
        ...tier0Execution,
        workerOwnedResidentLane: {
          ...tier0Execution.workerOwnedResidentLane,
          executionRoute: {
            ...tier0Execution.workerOwnedResidentLane.executionRoute,
            ...executionRoutePatch
          }
        }
      },
      workerLivePreviewEnabled: true
    });
    assert.equal(malformed.eligible, false);
    assert.ok(malformed.blockers.includes('tier0-atomic-execution-incomplete'));
  }

  const noPreview = resolveSphWorkerLanePostCommitFastContinuation({
    execution: tier0Execution,
    workerLivePreviewEnabled: false
  });
  assert.equal(noPreview.eligible, false);
  assert.ok(noPreview.blockers.includes('worker-live-preview-not-enabled'));

  const isosurfaceFast = resolveSphWorkerLanePostCommitFastContinuation({
    execution: {
      ...tier0Execution,
      workerOwnedResidentLane: {
        ...tier0Execution.workerOwnedResidentLane,
        committedPresentation: isosurfaceEnqueuedPresentation
      }
    },
    workerLivePreviewEnabled: false
  });
  assert.equal(isosurfaceFast.eligible, true);
  assert.equal(
    isosurfaceFast.presentationConsumer,
    ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY
  );
  assert.equal(isosurfaceFast.presentationCompletionReady, false);
  assert.equal(
    isosurfaceFast.blockers.includes('worker-live-preview-not-enabled'),
    false
  );

  const readback = resolveSphWorkerLanePostCommitFastContinuation({
    execution: {
      ...tier0Execution,
      workerOwnedResidentLane: {
        ...tier0Execution.workerOwnedResidentLane,
        executionRoute: {
          ...tier0Execution.workerOwnedResidentLane.executionRoute,
          mapAsyncCount: 1,
          readbackBytes: 4
        }
      }
    },
    workerLivePreviewEnabled: true
  });
  assert.equal(readback.eligible, false);
  assert.ok(readback.blockers.includes('tier0-readback-contract-incomplete'));
});

test('canonical direct SS continuation excludes legacy post-step interface readback from the hot loop', () => {
  for (const interfaceRefreshMode of ['blocking', 'pipelined', 'disabled']) {
    const policy = resolveSphResidentInterfaceRefreshContinuationPolicy({
      schroederSimulationEnabled: true,
      residentComputeManagerMode: 'direct',
      pressureEnabled: true,
      reactionsEnabled: true,
      reactionCount: 3,
      interfaceRefreshMode
    });

    assert.deepEqual(policy, {
      canonicalSchroederDirectHotLoop: true,
      canonicalSchroederWorkerHotLoop: false,
      canonicalSchroederHotLoop: true,
      startLegacyPostStepInterfaceRefresh: false,
      requireInterfaceBeforeNextResidentContinuation: false,
      awaitLegacyPostStepInterfaceRefresh: false
    });
    assert.equal(Object.isFrozen(policy), true);
  }
});

test('canonical direct SS exclusion does not depend on a current reaction count', () => {
  const policy = resolveSphResidentInterfaceRefreshContinuationPolicy({
    schroederSimulationEnabled: true,
    residentComputeManagerMode: 'direct',
    pressureEnabled: false,
    reactionsEnabled: false,
    reactionCount: 0,
    interfaceRefreshMode: 'blocking'
  });

  assert.equal(policy.canonicalSchroederDirectHotLoop, true);
  assert.equal(policy.canonicalSchroederWorkerHotLoop, false);
  assert.equal(policy.canonicalSchroederHotLoop, true);
  assert.equal(policy.startLegacyPostStepInterfaceRefresh, false);
  assert.equal(policy.requireInterfaceBeforeNextResidentContinuation, false);
  assert.equal(policy.awaitLegacyPostStepInterfaceRefresh, false);
});

test('legacy direct reaction playback preserves approved pressure-row continuation gating', () => {
  const policy = resolveSphResidentInterfaceRefreshContinuationPolicy({
    schroederSimulationEnabled: false,
    residentComputeManagerMode: 'direct',
    pressureEnabled: true,
    reactionsEnabled: true,
    reactionCount: 2,
    interfaceRefreshMode: 'pipelined'
  });

  assert.deepEqual(policy, {
    canonicalSchroederDirectHotLoop: false,
    canonicalSchroederWorkerHotLoop: false,
    canonicalSchroederHotLoop: false,
    startLegacyPostStepInterfaceRefresh: true,
    requireInterfaceBeforeNextResidentContinuation: true,
    awaitLegacyPostStepInterfaceRefresh: true
  });
});

test('legacy interface refresh wires the derived continuation gate explicitly', () => {
  const source = readFileSync(
    new URL('../src/visualization/sphPhaseDemoMount.js', import.meta.url),
    'utf8'
  );
  const policyStart = source.indexOf(
    'const residentInterfaceRefreshContinuationPolicy ='
  );
  const continuationStart = source.indexOf(
    'let requiredInterfaceRefreshReady =',
    policyStart
  );
  assert.notEqual(policyStart, -1);
  assert.notEqual(continuationStart, -1);
  const schedulerRefreshBlock = source.slice(policyStart, continuationStart);

  assert.match(
    schedulerRefreshBlock,
    /startResidentInterfaceRefresh\(\{[\s\S]*requireBeforeNextResidentContinuation:\s*requireInterfaceBeforeNextResidentContinuation,/
  );
  assert.doesNotMatch(
    schedulerRefreshBlock,
    /\n\s*requireBeforeNextResidentContinuation,\s*\n/
  );
});

test('non-SS refresh retains configured blocking and pipelined behavior without a pressure-row gate', () => {
  const blocking = resolveSphResidentInterfaceRefreshContinuationPolicy({
    schroederSimulationEnabled: false,
    residentComputeManagerMode: 'direct',
    reactionCount: 0,
    interfaceRefreshMode: 'blocking'
  });
  assert.equal(blocking.startLegacyPostStepInterfaceRefresh, true);
  assert.equal(blocking.requireInterfaceBeforeNextResidentContinuation, false);
  assert.equal(blocking.awaitLegacyPostStepInterfaceRefresh, true);

  const pipelined = resolveSphResidentInterfaceRefreshContinuationPolicy({
    schroederSimulationEnabled: false,
    residentComputeManagerMode: 'direct',
    reactionCount: 0,
    interfaceRefreshMode: 'pipelined'
  });
  assert.equal(pipelined.startLegacyPostStepInterfaceRefresh, true);
  assert.equal(pipelined.requireInterfaceBeforeNextResidentContinuation, false);
  assert.equal(pipelined.awaitLegacyPostStepInterfaceRefresh, false);
});

test('worker-owned SS excludes the legacy page-owned interface refresh', () => {
  const policy = resolveSphResidentInterfaceRefreshContinuationPolicy({
    schroederSimulationEnabled: true,
    residentComputeManagerMode: 'compute-manager',
    workerOwnedResidentLaneActive: true,
    pressureEnabled: true,
    reactionsEnabled: true,
    reactionCount: 4,
    interfaceRefreshMode: 'blocking'
  });

  assert.deepEqual(policy, {
    canonicalSchroederDirectHotLoop: false,
    canonicalSchroederWorkerHotLoop: true,
    canonicalSchroederHotLoop: true,
    startLegacyPostStepInterfaceRefresh: false,
    requireInterfaceBeforeNextResidentContinuation: false,
    awaitLegacyPostStepInterfaceRefresh: false
  });
});

test('generic ComputeManager compatibility keeps the legacy interface refresh explicit', () => {
  const policy = resolveSphResidentInterfaceRefreshContinuationPolicy({
    schroederSimulationEnabled: true,
    residentComputeManagerMode: 'compute-manager',
    workerOwnedResidentLaneActive: false,
    pressureEnabled: true,
    reactionsEnabled: true,
    reactionCount: 4,
    interfaceRefreshMode: 'blocking'
  });

  assert.deepEqual(policy, {
    canonicalSchroederDirectHotLoop: false,
    canonicalSchroederWorkerHotLoop: false,
    canonicalSchroederHotLoop: false,
    startLegacyPostStepInterfaceRefresh: true,
    requireInterfaceBeforeNextResidentContinuation: false,
    awaitLegacyPostStepInterfaceRefresh: true
  });
});

test('stale interface refresh tokens, generations, and detached overlays cannot republish after reset', () => {
  assert.equal(
    sphResidentInterfaceRefreshPublicationIsCurrent({
      overlayConnected: true
    }),
    false
  );
  const current = {
    interfaceRefreshToken: 8,
    currentInterfaceRefreshToken: 8,
    generation: 4,
    currentGeneration: 4,
    overlayConnected: true
  };
  assert.equal(
    sphResidentInterfaceRefreshPublicationIsCurrent(current),
    true
  );
  assert.equal(
    sphResidentInterfaceRefreshPublicationIsCurrent({
      ...current,
      currentInterfaceRefreshToken: 9
    }),
    false
  );
  assert.equal(
    sphResidentInterfaceRefreshPublicationIsCurrent({
      ...current,
      currentGeneration: 5
    }),
    false
  );
  assert.equal(
    sphResidentInterfaceRefreshPublicationIsCurrent({
      ...current,
      overlayConnected: false
    }),
    false
  );
});

test('only the exact mounted scene schedule may publish after an async boundary', () => {
  const current = {
    overlayConnected: true,
    resetRebuildPending: false,
    sceneCurrent: true,
    generation: 12,
    currentGeneration: 12,
    scheduleToken: 31,
    currentScheduleToken: 31
  };
  assert.equal(sphResidentSchedulePublicationIsCurrent(current), true);
  for (const stale of [
    { overlayConnected: false },
    { resetRebuildPending: true },
    { sceneCurrent: false },
    { currentGeneration: 13 },
    { currentScheduleToken: 32 }
  ]) {
    assert.equal(
      sphResidentSchedulePublicationIsCurrent({ ...current, ...stale }),
      false
    );
  }
});

test('resident render publication additionally requires exact compute and surface modes', () => {
  const current = {
    overlayConnected: true,
    resetRebuildPending: false,
    sceneCurrent: true,
    generation: 12,
    currentGeneration: 12,
    scheduleToken: 31,
    currentScheduleToken: 31,
    residentComputeManagerMode: 'direct',
    currentResidentComputeManagerMode: 'direct',
    surfaceDrawDiagnosticMode: 'native-webgpu-surface-consumer',
    currentSurfaceDrawDiagnosticMode: 'native-webgpu-surface-consumer'
  };
  assert.equal(sphResidentRenderSchedulePublicationIsCurrent(current), true);
  assert.equal(
    sphResidentRenderSchedulePublicationIsCurrent({
      ...current,
      currentResidentComputeManagerMode: 'compute-manager'
    }),
    false
  );
  assert.equal(
    sphResidentRenderSchedulePublicationIsCurrent({
      ...current,
      currentSurfaceDrawDiagnosticMode: 'three-render-row-points'
    }),
    false
  );
  assert.equal(
    sphResidentRenderSchedulePublicationIsCurrent({
      ...current,
      currentScheduleToken: 32
    }),
    false
  );
});

test('an interface refresh cannot publish after a same-generation schedule supersession', () => {
  const current = {
    interfaceRefreshToken: 7,
    currentInterfaceRefreshToken: 7,
    overlayConnected: true,
    resetRebuildPending: false,
    sceneCurrent: true,
    generation: 3,
    currentGeneration: 3,
    scheduleToken: 18,
    currentScheduleToken: 18
  };
  assert.equal(sphResidentInterfaceSchedulePublicationIsCurrent(current), true);
  assert.equal(
    sphResidentInterfaceSchedulePublicationIsCurrent({
      ...current,
      currentScheduleToken: 19
    }),
    false
  );
  assert.equal(
    sphResidentInterfaceSchedulePublicationIsCurrent({
      ...current,
      resetRebuildPending: true
    }),
    false
  );
});

test('legacy playback restart cannot bypass a required pressure-row refresh', () => {
  const ready = {
    scheduleContinuation: false,
    playing: true,
    continuationReady: true,
    generationCurrent: true,
    requiredInterfaceRefreshReady: true
  };
  assert.equal(sphResidentPlaybackRestartAllowed(ready), true);
  assert.equal(sphResidentPlaybackRestartAllowed({
    ...ready,
    requiredInterfaceRefreshReady: false
  }), false);
});

test('a paused page cancels a resident continuation captured before the pause', () => {
  const capturedContinuation = {
    scheduleContinuation: true,
    playing: true,
    scheduleCurrent: true
  };
  assert.equal(
    sphResidentChainedContinuationAllowed(capturedContinuation),
    true
  );
  assert.equal(
    sphResidentChainedContinuationAllowed({
      ...capturedContinuation,
      playing: false
    }),
    false
  );
  assert.equal(
    sphResidentChainedContinuationAllowed({
      ...capturedContinuation,
      scheduleCurrent: false
    }),
    false
  );

  const source = readFileSync(
    new URL('../src/visualization/sphPhaseDemoMount.js', import.meta.url),
    'utf8'
  );
  const branchStart = source.indexOf(
    '} else if (scheduleContinuation && residentScheduleIsCurrent()) {'
  );
  const branchEnd = source.indexOf(
    '} else if (restartPlaybackContinuation && residentScheduleIsCurrent()) {',
    branchStart
  );
  assert.notEqual(branchStart, -1);
  assert.notEqual(branchEnd, -1);
  const branch = source.slice(branchStart, branchEnd);
  assert.match(
    branch,
    /requestAnimationFrame\(\(\) => \{[\s\S]*sphResidentChainedContinuationAllowed\(\{[\s\S]*scheduleContinuation,[\s\S]*playing,[\s\S]*scheduleCurrent:\s*residentScheduleIsCurrent\(\)[\s\S]*\}\)[\s\S]*scheduleMlsMpmResidentSteps/
  );
});

test('mounted schedule cadence survives startup deferral and every recursive continuation', () => {
  const source = readFileSync(
    new URL('../src/visualization/sphPhaseDemoMount.js', import.meta.url),
    'utf8'
  );
  const functionStart = source.indexOf('function scheduleMlsMpmResidentSteps({');
  const functionEnd = source.indexOf(
    '// The long-horizon architecture probe must exercise the mounted scheduler',
    functionStart
  );
  assert.notEqual(functionStart, -1);
  assert.notEqual(functionEnd, -1);
  const scheduler = source.slice(functionStart, functionEnd);

  assert.match(
    scheduler,
    /scheduleOptions:\s*\{[\s\S]*?stepCount,[\s\S]*?workerLaneProgressEverySteps,[\s\S]*?readbackMode,/
  );
  const recursiveContinuationBlock = scheduler.slice(
    scheduler.indexOf('.finally(() => {')
  );
  assert.equal(
    (recursiveContinuationBlock.match(
      /workerLaneProgressEverySteps:\s*requestedWorkerLaneProgressEverySteps/g
    ) || []).length,
    5
  );
  assert.match(
    source,
    /residentNativeSurfaceCameraPresentationRecoveryContext\s*=\s*Object\.freeze\(\{[\s\S]*?workerLaneProgressEverySteps:\s*requestedWorkerLaneProgressEverySteps,[\s\S]*?execution,/
  );
  assert.match(
    source,
    /scheduleMlsMpmResidentSteps\(\{[\s\S]*?workerLaneProgressEverySteps:\s*context\.workerLaneProgressEverySteps,[\s\S]*?continueFromResidentState:/
  );
});

test('same-backend render-mode changes keep the architecture profile truthful', () => {
  const source = readFileSync(
    new URL('../src/visualization/sphPhaseDemoMount.js', import.meta.url),
    'utf8'
  );
  const handlerStart = source.indexOf(
    "renderModeSelect.addEventListener('change', () => {"
  );
  const handlerEnd = source.indexOf('\n  });', handlerStart);
  assert.notEqual(handlerStart, -1);
  assert.notEqual(handlerEnd, -1);
  const handler = source.slice(handlerStart, handlerEnd);
  assert.match(
    handler,
    /syncArchitectureControlDependencies\(\{ normalizeDependencies: false \}\);[\s\S]*syncUrlFromControls\(\);/
  );
});

test('canonical SS render-mode refresh skips the legacy pressure-interface producer', () => {
  assert.equal(
    shouldSkipSphResidentPressureInterfaceForRenderRefresh({
      schroederSimulationEnabled: true,
      residentComputeManagerMode: 'direct'
    }),
    true
  );
  assert.equal(
    shouldSkipSphResidentPressureInterfaceForRenderRefresh({
      schroederSimulationEnabled: false,
      residentComputeManagerMode: 'direct'
    }),
    false
  );
  assert.equal(
    shouldSkipSphResidentPressureInterfaceForRenderRefresh({
      schroederSimulationEnabled: true,
      residentComputeManagerMode: 'compute-manager'
    }),
    false
  );
  assert.equal(
    shouldSkipSphResidentPressureInterfaceForRenderRefresh({
      schroederSimulationEnabled: true,
      residentComputeManagerMode: 'compute-manager',
      workerOwnedResidentLaneActive: true
    }),
    true
  );
});
