import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  SCIENTIFIC_CALIBRATION_SCENARIOS,
  STANDARD_SCENARIOS,
  STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE,
  STANDARD_VISUAL_MATRIX_RENDERER_MODE,
  STANDARD_VISUAL_MATRIX_RESIDENT_COMPUTE_MODE,
  STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS,
  STANDARD_VISUAL_MATRIX_WORKER_SCHEDULE_MAX_STEPS,
  checkpointMassWeightedMeanTemperature,
  durableVisualMatrixReleasePublicationEnabled,
  deterministicRandomPairScenarios,
  evaluateAuthoritativeTwoLevelMechanicsEvidence,
  evaluateStandardScenarioBehavior,
  evaluateSurfaceStressExecutionEvidence,
  evaluateWorkerOwnedSsFrameworkEvidence,
  persistVisualMatrixArtifact,
  resolveVisualMatrixScenarioTimeoutMs,
  scenarioEnv,
  scaleStandardPhaseAcceptance,
  SPH_VISUAL_MATRIX_DURABLE_RELEASE_PUBLICATION_ENV,
  standardScenarioPhysicalLengthScale,
  synthesizeStandardScenarioIssues,
  workerOwnedStandardScenarioSchedulePlan,
  workerOwnedVisualRouteIssues
} from '../scripts/sph-visual-sanity-matrix.mjs';
import {
  probeStdoutPayload
} from '../scripts/sph-long-horizon-probe.mjs';
import {
  parseSphInitialBodies
} from '../src/runtime/sphInitialBodies.js';
import {
  buildSphPhaseDemoState
} from '../src/runtime/sphPhaseDemo.js';
import {
  SPH_PHASE_SCENARIO_PRESETS
} from '../src/runtime/sphPhaseScenarioPresets.js';
import {
  createSphPhaseScenario
} from '../src/runtime/thermoPreflight.js';
import {
  estimateSchroederLevelFromSupportRadius
} from '../src/runtime/sph/schroederHierarchyGpu.js';
import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
  SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE,
  SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
} from '../src/runtime/sph/schroederDynamicLawRoutingContract.js';

test('an explicit matrix timeout overrides a scenario timeout', () => {
  assert.equal(resolveVisualMatrixScenarioTimeoutMs({
    scenarioTimeoutMs: 360_000,
    matrixTimeoutMs: 900_000,
    matrixTimeoutExplicit: true
  }), 900_000);
  assert.equal(resolveVisualMatrixScenarioTimeoutMs({
    scenarioTimeoutMs: 360_000,
    matrixTimeoutMs: 180_000,
    matrixTimeoutExplicit: false
  }), 360_000);
});

test('standard scenario issue synthesis is ordered and deduplicated', () => {
  const scenario = {
    expectedMechanics: 'mlsmpm',
    visualRendererMode: 'native-webgpu',
    visualRenderOwnershipMode: 'worker-renderer',
    residentComputeManagerMode: 'worker-lane'
  };
  const probe = {
    issues: ['probe-top-level', 'shared'],
    analysis: {
      issues: ['shared', 'probe-analysis']
    }
  };
  assert.deepEqual(
    synthesizeStandardScenarioIssues(scenario, probe, {
      mechanicsIntegrator: 'sph',
      rendererModes: ['webgl'],
      renderOwnershipModes: ['main-thread-renderer'],
      residentComputeManagerModes: ['direct-schroeder-scene'],
      expectedBehavior: {
        status: 'fail',
        checks: [
          { id: 'steam-forms', status: 'fail' },
          { id: 'steam-rises', status: 'inconclusive' },
          { id: 'iron-cools', status: 'pass' },
          { id: 'steam-forms', status: 'fail' }
        ]
      }
    }),
    [
      'probe-top-level',
      'shared',
      'probe-analysis',
      'mechanics-integrator-mismatch',
      'visual-renderer-mode-mismatch',
      'visual-render-ownership-mode-mismatch',
      'resident-compute-manager-mode-mismatch',
      'expected-behavior:steam-forms',
      'expected-behavior:steam-rises'
    ]
  );
});

function workerOwnedVisualMetric(overrides = {}) {
  return {
    phase: 'resident-batch',
    peerComputeRenderOwnershipPolicy: {
      effectiveMode: STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE
    },
    schroederTelemetry: {
      residentComputeManagerMode:
        STANDARD_VISUAL_MATRIX_RESIDENT_COMPUTE_MODE
    },
    workerOffscreenRenderRows: {
      status: 'worker-offscreen-presentation-superseded-stale-step',
      displayHandoff: 'transferControlToOffscreen',
      frameCopyBackRejected: true,
      workerReady: true,
      contextStatus: 'webgpu-context-ready',
      particleCount: 760,
      frameCount: 23,
      readyEver: true,
      sphStep: 0,
      lastPresentedSphStep: 63,
      readyFrameCount: 23
    },
    workerOffscreenPresentation: {
      canvasTransferred: true,
      workerReady: true,
      contextStatus: 'webgpu-context-ready',
      displayOwner: 'worker',
      displayOwnerContentReady: true,
      displayOwnerContentFrameSerial: 23,
      displayOwnerPresentedSphStep: 63,
      displayCanvasVisible: true,
      frameCount: 23,
      readyFrameCount: 23,
      displayOwnerLastRenderedContent: {
        schema:
          'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0',
        renderRowsSchema: 'peercompute.ulg.worker-offscreen-render-rows.v0',
        status: 'worker-offscreen-resident-particle-state-producer-rendered',
        sphStep: 63,
        particleCount: 760,
        frameCount: 23,
        readyFrameCount: 23,
        displayOwnerEpoch: 2,
        residentScheduleCandidatePresentation: true,
        stateManagerCommittedPresentation: true,
        committedPresentationSchema:
          'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
        committedPresentationStatus:
          'state-manager-committed-resident-schedule-presentation-admission',
        scheduleId: 'schedule:visual:1',
        laneId: 'lane:visual',
        stateKey: 'state:visual',
        presentationLaneEpoch: 1,
        residentExecutionGeneration: 194,
        stepOrdinal: 64,
        authorityStatus: 'state-manager-committed-worker-schedule',
        computeManagerCompletionSchema:
          'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
        computeManagerLeaseId: 'lease:visual:1',
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
    },
    residentSteps: {
      residentComputeManagerMode:
        STANDARD_VISUAL_MATRIX_RESIDENT_COMPUTE_MODE,
      workerLaneFallback: null,
      workerOwnedResidentLane: {
        laneId: 'lane:visual',
        stateKey: 'state:visual',
        scheduleId: 'schedule:visual:1',
        residentScheduleStatus: 'worker-resident-schedule-completed',
        terminalStatus:
          'worker-offscreen-resident-schedule-on-presentation-device-completed',
        requestedStepCount: 64,
        completedStepCount: 64,
        laneCompletedStepTotal: 64,
        progressEverySteps:
          STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS,
        cancelled: false,
        retainedBufferRefCount: 7,
        finalEpochIdentity: {
          storageGeneration: 194,
          physicsTick: 63,
          positionEpoch: 126
        },
        gpuFence: {
          scope: 'resident-schedule-terminal',
          terminalScheduleFence: true,
          fenceSatisfied: true,
          queueCompletionStatus: 'queue-work-completed',
          authorityAdmissionReady: true
        },
        authority: {
          status: 'state-manager-committed-worker-schedule',
          computeManagerLeaseStatus: 'completed',
          computeManagerFenceSatisfied: true,
          stateManagerCommitStatus: 'committed'
        },
        hierarchyStageSummary: {
          schema:
            'peercompute.ulg.worker-schroeder-hierarchy-stage-summary.v0',
          status: 'worker-schroeder-hierarchy-stage-summary-ready',
          mechanicsLevelCount: 1,
          twoLevelMechanicsEnabled: false,
          twoLevelMechanicsAuthority: 'observation',
          twoLevelAuthoritativeCommitVerified: false,
          mechanicsFieldPairV2Enabled: false,
          lawQueueStatus: 'schroeder-law-queue-submitted',
          lawNeighborCandidateStatus:
            'schroeder-law-neighbor-candidates-submitted',
          residentStageStatus: {
            thermal: 'thermal-step-executed',
            reaction: 'missing'
          },
          residentStageBackends: {
            thermal: 'webgpu',
            reaction: null
          },
          staticGpuTableUploadStatus: {
            thermalResponseGraph: 'webgpu-uploaded',
            mechanicsMaterialPhase: 'webgpu-uploaded',
            retainedAcrossSteps: true
          },
          thermalRequested: true,
          reactionRequested: false,
          fullParticleReadbackFree: true
        },
        committedPresentation: {
          status: 'worker-offscreen-resident-particle-state-producer-rendered',
          scheduleId: 'schedule:visual:1',
          laneId: 'lane:visual',
          stateKey: 'state:visual',
          presentationLaneEpoch: 1,
          sphStep: 63,
          stateManagerCommittedPresentation: true
        }
      }
    },
    ...overrides
  };
}

function workerOwnedNativeSurfaceMetric(overrides = {}) {
  const metric = structuredClone(workerOwnedVisualMetric());
  const lane = metric.residentSteps.workerOwnedResidentLane;
  lane.laneSimTimeS = 0.032;
  metric.workerLaneNativeSurfacePresentation = {
    schema: 'peercompute.ulg.worker-lane-native-surface-presentation-source.v0',
    status: 'worker-lane-native-surface-presentation-source-ready',
    scheduleId: lane.scheduleId,
    laneId: lane.laneId,
    stateKey: lane.stateKey,
    requestId: `${lane.scheduleId}:native-surface:1:1`,
    cacheKey: `${lane.scheduleId}:native-surface:1:1`,
    sourceStageId: 'schroederSameLevelMechanics',
    sourceStep: 64,
    sourceTimeS: lane.laneSimTimeS,
    particleCount: 760,
    readbackScope: 'resident-schedule-terminal-presentation',
    terminalPresentationFullParticleReadbackPerformed: true,
    physicsHotLoopParticipation: false
  };
  metric.workerLaneNativeSurfaceSnapshotHandoff = {
    ...metric.workerLaneNativeSurfacePresentation,
    status: 'worker-lane-native-surface-presentation-source-admitted',
    sharedSlotIdentityVerified: true,
    workerLineageMetadataStatus:
      'worker-retained-compact-snapshot-lineage-metadata-ready',
    terminalCompactSnapshotReadback: true
  };
  metric.workerOffscreenPresentation = {
    ...metric.workerOffscreenPresentation,
    displayOwner: 'main-native',
    displayCanvasVisible: false
  };
  metric.workerOffscreenCanvas = {
    count: 1,
    visibleCount: 0,
    visibility: 'hidden',
    display: 'block',
    opacity: '0',
    width: 1280,
    height: 800,
    visible: false
  };
  metric.sceneCanvasVisibility = {
    count: 2,
    visibleCount: 1,
    workerCount: 1,
    visibleWorkerCount: 0
  };
  metric.renderState = {
    status: 'resident-render-field-applied',
    sourceResidentRenderSourceStatus: 'resident-render-source-current',
    sourceResidentExecutionGenerationMatchesCurrent: true,
    sourceResidentNextStep: 64,
    sourceResidentNextTimeS: lane.laneSimTimeS,
    surfaceDrawVisibleRendererBridge:
      STANDARD_VISUAL_MATRIX_RENDERER_MODE,
    surfaceDrawOverlayPolicyStatus: 'surface-draw-native-webgpu-main-canvas',
    workerOffscreenPresentationStatus:
      'worker-offscreen-display-hidden-main-native-owner',
    workerOffscreenRetainedCompactSnapshotStatus:
      'presentation-worker-retained-compact-snapshot-exported',
    workerOffscreenRetainedCompactSnapshotAvailable: true,
    workerOffscreenRetainedCompactSnapshotStep: 64
  };
  metric.surfaceDraw = {
    status: 'native-webgpu-surface-consumer-ready',
    visibleRendererBridge: STANDARD_VISUAL_MATRIX_RENDERER_MODE,
    gpuBufferHandoffReady: true,
    visibleGpuConsumerReady: true,
    visibleGpuConsumerRuntimePresentationAdmitted: true,
    sourceResidentRenderSourceStatus: 'resident-render-source-current',
    sourceResidentExecutionGenerationMatchesCurrent: true,
    sourceResidentNextStep: 64,
    sourceResidentNextTimeS: lane.laneSimTimeS
  };
  metric.nativeSurfaceValidation = {
    native: true,
    ready: true,
    admitted: true,
    runtimePresentationAdmitted: true,
    sourceGenerationMatchesCurrent: true,
    sourceRetainedPrevious: false,
    sourceMarkedStale: false,
    sourceCurrent: true,
    status: 'native-surface-presentation-admitted',
    bridgeMode: STANDARD_VISUAL_MATRIX_RENDERER_MODE,
    gpuBufferHandoffReady: true
  };
  return Object.assign(metric, overrides);
}

test('worker-owned native surface route rejects a visible particle overlay', () => {
  const scenario = {
    visualRenderOwnershipMode: STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE,
    visualRendererMode: STANDARD_VISUAL_MATRIX_RENDERER_MODE,
    workerProgressEverySteps:
      STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS
  };
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [workerOwnedNativeSurfaceMetric()] }
  }), []);

  const visibleOverlay = workerOwnedNativeSurfaceMetric();
  visibleOverlay.workerOffscreenPresentation.displayOwner = 'worker';
  visibleOverlay.workerOffscreenPresentation.displayCanvasVisible = true;
  visibleOverlay.workerOffscreenCanvas.visibility = 'visible';
  visibleOverlay.workerOffscreenCanvas.opacity = '1';
  visibleOverlay.workerOffscreenCanvas.visible = true;
  visibleOverlay.workerOffscreenCanvas.visibleCount = 1;
  visibleOverlay.sceneCanvasVisibility.visibleCount = 2;
  visibleOverlay.sceneCanvasVisibility.visibleWorkerCount = 1;
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [visibleOverlay] }
  }), [
    'worker-owned-render-presentation-unproven',
    'worker-particle-overlay-visible-over-native-surface'
  ]);

  const staleHandoff = workerOwnedNativeSurfaceMetric();
  staleHandoff.workerLaneNativeSurfaceSnapshotHandoff.scheduleId =
    'schedule:visual:stale';
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [staleHandoff] }
  }), ['worker-owned-render-presentation-unproven']);

  const unadmittedNative = workerOwnedNativeSurfaceMetric();
  unadmittedNative.nativeSurfaceValidation.admitted = false;
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [unadmittedNative] }
  }), ['worker-owned-render-presentation-unproven']);

  const emptyNativeSource = workerOwnedNativeSurfaceMetric();
  emptyNativeSource.workerLaneNativeSurfacePresentation.particleCount = 0;
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [emptyNativeSource] }
  }), ['worker-owned-render-presentation-unproven']);

  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [workerOwnedNativeSurfaceMetric()] },
    analysis: { workerOffscreenResidentParticleStateVisibleSampleCount: 1 }
  }), ['worker-particle-overlay-visible-over-native-surface']);
});

test('worker-owned visual route requires a committed lane and rendered OffscreenCanvas', () => {
  const scenario = {
    visualRenderOwnershipMode: STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE,
    workerProgressEverySteps:
      STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS
  };
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [workerOwnedVisualMetric()] }
  }), []);

  const staleWithoutPriorRenderMetric = workerOwnedVisualMetric();
  staleWithoutPriorRenderMetric.workerOffscreenRenderRows = {
    ...staleWithoutPriorRenderMetric.workerOffscreenRenderRows,
    frameCount: 0,
    readyEver: false,
    readyFrameCount: 0,
    lastPresentedSphStep: null
  };
  staleWithoutPriorRenderMetric.workerOffscreenPresentation = {
    ...staleWithoutPriorRenderMetric.workerOffscreenPresentation,
    displayOwnerContentReady: false,
    displayOwnerContentFrameSerial: 0,
    displayOwnerPresentedSphStep: null,
    displayCanvasVisible: false,
    displayOwnerLastRenderedContent: null
  };
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [staleWithoutPriorRenderMetric] },
    analysis: { workerOffscreenResidentParticleStateVisibleSampleCount: 0 }
  }), ['worker-owned-render-presentation-unproven']);

  const cadenceMismatchMetric = workerOwnedVisualMetric();
  cadenceMismatchMetric.residentSteps.workerOwnedResidentLane
    .progressEverySteps = 1;
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [cadenceMismatchMetric] }
  }), ['worker-owned-resident-progress-cadence-mismatch']);

  const finalIdentityMismatchMetric = workerOwnedVisualMetric();
  finalIdentityMismatchMetric.residentSteps.workerOwnedResidentLane
    .finalEpochIdentity.physicsTick = 62;
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [finalIdentityMismatchMetric] }
  }), ['worker-owned-render-presentation-unproven']);

  const uncommittedPresentationMetric = workerOwnedVisualMetric();
  uncommittedPresentationMetric.workerOffscreenPresentation
    .displayOwnerLastRenderedContent.stateManagerCommittedPresentation = false;
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [uncommittedPresentationMetric] }
  }), ['worker-owned-render-presentation-unproven']);

  const fallbackMetric = workerOwnedVisualMetric();
  fallbackMetric.residentSteps = {
    ...fallbackMetric.residentSteps,
    workerLaneFallback: { reason: 'worker-lane-schedule-error' },
    workerOwnedResidentLane: {
      ...fallbackMetric.residentSteps.workerOwnedResidentLane,
      cancelled: true,
      authority: {
        computeManagerLeaseStatus: 'rejected',
        computeManagerFenceSatisfied: false,
        stateManagerCommitStatus: 'rejected'
      }
    }
  };
  fallbackMetric.workerOffscreenRenderRows = null;
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [fallbackMetric] },
    analysis: { workerOffscreenResidentParticleStateVisibleSampleCount: 0 }
  }), [
    'worker-owned-resident-fallback',
    'worker-owned-resident-schedule-incomplete',
    'worker-owned-resident-authority-uncommitted',
    'worker-owned-render-presentation-unproven'
  ]);

  const missingSealMetric = workerOwnedVisualMetric();
  missingSealMetric.residentSteps.workerOwnedResidentLane = {
    ...missingSealMetric.residentSteps.workerOwnedResidentLane,
    terminalStatus: null,
    requestedStepCount: null,
    completedStepCount: null,
    cancelled: null,
    retainedBufferRefCount: null
  };
  missingSealMetric.workerOffscreenPresentation = {
    ...missingSealMetric.workerOffscreenPresentation,
    displayOwnerLastRenderedContent: {
      ...missingSealMetric.workerOffscreenPresentation
        .displayOwnerLastRenderedContent,
      particleCount: 0
    }
  };
  assert.deepEqual(workerOwnedVisualRouteIssues(scenario, {
    timeline: { metrics: [missingSealMetric] },
    analysis: { workerOffscreenResidentParticleStateVisibleSampleCount: 0 }
  }), [
    'worker-owned-resident-schedule-incomplete',
    'worker-owned-render-presentation-unproven'
  ]);
});

test('worker-owned SS framework evidence requires law dispatch and monotonic persistent-lane schedules', () => {
  const scenario = {
    acceptanceTrack: 'framework-liveness',
    visualRenderOwnershipMode: STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE,
    residentComputeManagerMode: STANDARD_VISUAL_MATRIX_RESIDENT_COMPUTE_MODE,
    workerProgressEverySteps:
      STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS,
    workerSchedulePlan: {
      scheduleCount: 2,
      scheduleStepCount: 64,
      totalStepCount: 128
    }
  };
  const first = workerOwnedVisualMetric();
  const second = structuredClone(first);
  const secondLane = second.residentSteps.workerOwnedResidentLane;
  secondLane.scheduleId = 'schedule:visual:2';
  secondLane.laneCompletedStepTotal = 128;
  secondLane.finalEpochIdentity = {
    storageGeneration: 388,
    physicsTick: 127,
    positionEpoch: 254
  };

  const passing = evaluateWorkerOwnedSsFrameworkEvidence(scenario, {
    timeline: { metrics: [first, second] }
  });
  assert.equal(passing.status, 'pass');
  assert.equal(passing.observed.residentExecutionSampleCount, 2);

  const missingLaw = structuredClone(second);
  missingLaw.residentSteps.workerOwnedResidentLane.hierarchyStageSummary
    .lawNeighborCandidateStatus = 'disabled-local-law-queue';
  const missingLawEvidence = evaluateWorkerOwnedSsFrameworkEvidence(
    scenario,
    { timeline: { metrics: [first, missingLaw] } }
  );
  assert.equal(missingLawEvidence.status, 'fail');
  assert.ok(
    missingLawEvidence.observed.samples[1].blockers.includes(
      'local-law-queue-path-unproven'
    )
  );

  const staleLane = structuredClone(second);
  staleLane.residentSteps.workerOwnedResidentLane.laneCompletedStepTotal = 64;
  const staleLaneEvidence = evaluateWorkerOwnedSsFrameworkEvidence(
    scenario,
    { timeline: { metrics: [first, staleLane] } }
  );
  assert.equal(staleLaneEvidence.status, 'fail');
  assert.ok(
    staleLaneEvidence.observed.samples[1].blockers.includes(
      'lane-step-total-not-monotonic'
    )
  );

  const dynamicScenario = {
    ...scenario,
    presetId: 'sodium-water'
  };
  const dynamicFirst = structuredClone(first);
  dynamicFirst.residentSteps.workerOwnedResidentLane
    .dynamicReactionActivation = {
      state: 'dormant',
      transitionFingerprint: null,
      committedScheduleId: null
    };
  dynamicFirst.residentSteps.workerOwnedResidentLane
    .dynamicReactionActivationReceipt = null;
  const dynamicSecond = structuredClone(second);
  const dynamicSecondLane =
    dynamicSecond.residentSteps.workerOwnedResidentLane;
  const transitionFingerprint = 'transition:dynamic-reaction:visual:1';
  dynamicSecondLane.dynamicReactionActivation = {
    state: 'active',
    transitionFingerprint,
    committedScheduleId: dynamicSecondLane.scheduleId
  };
  dynamicSecondLane.dynamicReactionActivationReceipt = {
    schema: 'peercompute.ulg.sph-scene-dynamic-reaction-activation.v0',
    status: 'dynamic-reaction-activation-consumed-and-admitted',
    predecessorScheduleId:
      dynamicFirst.residentSteps.workerOwnedResidentLane.scheduleId,
    consumerScheduleId: dynamicSecondLane.scheduleId,
    targetScheduleRequestId: dynamicSecondLane.scheduleId,
    configurationContinuityMode:
      'prospective-reaction-dormant-to-executing',
    transitionKind: 'reaction-dormant-watch-to-executing-reaction',
    transitionFingerprint,
    route: 'canonical-schroeder',
    routeTransition: 'fresh-or-canonical-continuation',
    reactionExecution: true,
    sourceParticleCount: 760,
    terminalParticleCount: 760,
    sourcePhaseLaneCount: 4,
    terminalPhaseLaneCount: 4,
    phaseCarrierTopologyAuthority: 'preexisting-four-carrier-plan',
    phaseCarrierTrigger: null,
    phaseCarrierMapAsyncCount: 0,
    phaseCarrierReadbackBytes: 0,
    terminalGpuFenceSatisfied: true,
    stateManagerCommitted: true,
    consumedBeforeLeaseAcquisition: true,
    consumedBeforeRouteSelection: true,
    consumedBeforeGpuWork: true,
    shadowOnly: SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY,
    routingAuthority: SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
    executionGating: SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE
  };
  dynamicSecondLane.hierarchyStageSummary.reactionRequested = true;
  dynamicSecondLane.hierarchyStageSummary.residentStageStatus.reaction =
    'reaction-step-executed';
  dynamicSecondLane.hierarchyStageSummary.residentStageBackends.reaction =
    'webgpu';

  const dynamicPassing = evaluateWorkerOwnedSsFrameworkEvidence(
    dynamicScenario,
    { timeline: { metrics: [dynamicFirst, dynamicSecond] } }
  );
  assert.equal(dynamicPassing.status, 'pass');
  assert.equal(dynamicPassing.observed.dynamicReactionDormantObserved, true);
  assert.equal(dynamicPassing.observed.dynamicReactionActiveObserved, true);

  const activeWithoutReceipt = structuredClone(dynamicSecond);
  activeWithoutReceipt.residentSteps.workerOwnedResidentLane
    .dynamicReactionActivationReceipt = null;
  const activeWithoutReceiptEvidence =
    evaluateWorkerOwnedSsFrameworkEvidence(dynamicScenario, {
      timeline: { metrics: [dynamicFirst, activeWithoutReceipt] }
    });
  assert.equal(activeWithoutReceiptEvidence.status, 'fail');
  assert.ok(
    activeWithoutReceiptEvidence.observed.samples[1].blockers.includes(
      'dynamic-reaction-activation-receipt-unproven'
    )
  );

  const dormantReactionExecution = structuredClone(dynamicFirst);
  dormantReactionExecution.residentSteps.workerOwnedResidentLane
    .hierarchyStageSummary.reactionRequested = true;
  dormantReactionExecution.residentSteps.workerOwnedResidentLane
    .hierarchyStageSummary.residentStageStatus.reaction =
      'reaction-step-executed';
  dormantReactionExecution.residentSteps.workerOwnedResidentLane
    .hierarchyStageSummary.residentStageBackends.reaction = 'webgpu';
  const dormantReactionExecutionEvidence =
    evaluateWorkerOwnedSsFrameworkEvidence(dynamicScenario, {
      timeline: { metrics: [dormantReactionExecution, dynamicSecond] }
    });
  assert.equal(dormantReactionExecutionEvidence.status, 'fail');
  assert.ok(
    dormantReactionExecutionEvidence.observed.samples[0].blockers.includes(
      'reaction-law-path-unproven'
    )
  );
});

test('visual matrix keeps authoritative probe JSON off the child stdout pipe', () => {
  const outputPath = '/tmp/ulg-probe-output.json';
  const env = scenarioEnv({
    scenario: { url: '/?preset=iron-ice-quench' },
    outputPath,
    frameDir: '/tmp/ulg-probe-frames',
    port: 5310,
    batches: 16,
    batchSteps: 512,
    timeoutMs: 900_000
  });
  assert.equal(env.ULG_PROBE_OUTPUT, outputPath);
  assert.equal(env.ULG_PROBE_STDOUT_MODE, 'none');
  assert.equal(env.ULG_PROBE_ARTIFACT_DETAIL_MODE, 'visual-compact');
  assert.equal(env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION, undefined);
  const inheritedDurableFlag = process.env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION;
  try {
    process.env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION = '1';
    const inheritedEnv = scenarioEnv({
      scenario: { url: '/?preset=iron-ice-quench' },
      outputPath,
      frameDir: '/tmp/ulg-probe-frames',
      port: 5310,
      batches: 16,
      batchSteps: 512,
      timeoutMs: 900_000
    });
    assert.equal(inheritedEnv.ULG_PROBE_DURABLE_RELEASE_PUBLICATION, undefined);
    const durableEnv = scenarioEnv({
      scenario: { url: '/?preset=iron-ice-quench' },
      outputPath,
      frameDir: '/tmp/ulg-probe-frames',
      port: 5310,
      batches: 16,
      batchSteps: 512,
      timeoutMs: 900_000,
      durableReleasePublication: true
    });
    assert.equal(durableEnv.ULG_PROBE_DURABLE_RELEASE_PUBLICATION, '1');
  } finally {
    if (inheritedDurableFlag == null) {
      delete process.env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION;
    } else {
      process.env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION = inheritedDurableFlag;
    }
  }

  const result = {
    status: 'good',
    probeMode: 'scene',
    scenarioUrl: '/?preset=iron-ice-quench',
    analysis: { issues: [] }
  };
  assert.equal(probeStdoutPayload({
    output: outputPath,
    stdoutMode: 'none',
    result,
    fullText: '{"large":"payload"}\n'
  }), null);
  const summary = JSON.parse(probeStdoutPayload({
    output: outputPath,
    stdoutMode: 'summary',
    result,
    fullText: '{"large":"payload"}\n'
  }));
  assert.equal(summary.output, outputPath);
  assert.equal(summary.status, 'good');
  assert.equal(probeStdoutPayload({
    output: null,
    stdoutMode: 'none',
    result,
    fullText: '{"large":"payload"}\n'
  }), '{"large":"payload"}\n');
});

test('visual matrix worker progress cadence is standard-only and fail-closed', () => {
  const inheritedProbeCadence =
    process.env.ULG_PROBE_WORKER_PROGRESS_EVERY_STEPS;
  const inheritedMatrixCadence =
    process.env.ULG_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS;
  try {
    process.env.ULG_PROBE_WORKER_PROGRESS_EVERY_STEPS = '7';
    delete process.env.ULG_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS;
    const legacyEnv = scenarioEnv({
      scenario: { url: '/?drop=h2o&base=h2o' },
      outputPath: '/tmp/legacy.json',
      frameDir: '/tmp/legacy-frames',
      port: 5310,
      batches: 1,
      batchSteps: 1,
      timeoutMs: 1000
    });
    assert.equal(legacyEnv.ULG_PROBE_WORKER_PROGRESS_EVERY_STEPS, undefined);

    process.env.ULG_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS = 'invalid';
    assert.throws(() => scenarioEnv({
      scenario: STANDARD_SCENARIOS[0],
      outputPath: '/tmp/standard.json',
      frameDir: '/tmp/standard-frames',
      port: 5310,
      batches: 1,
      batchSteps: 1,
      timeoutMs: 1000
    }), /must be a positive integer/);

    process.env.ULG_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS = '17';
    const overrideEnv = scenarioEnv({
      scenario: STANDARD_SCENARIOS[0],
      outputPath: '/tmp/standard.json',
      frameDir: '/tmp/standard-frames',
      port: 5310,
      batches: 1,
      batchSteps: 1,
      timeoutMs: 1000
    });
    assert.equal(overrideEnv.ULG_PROBE_WORKER_PROGRESS_EVERY_STEPS, '17');
  } finally {
    if (inheritedProbeCadence == null) {
      delete process.env.ULG_PROBE_WORKER_PROGRESS_EVERY_STEPS;
    } else {
      process.env.ULG_PROBE_WORKER_PROGRESS_EVERY_STEPS =
        inheritedProbeCadence;
    }
    if (inheritedMatrixCadence == null) {
      delete process.env.ULG_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS;
    } else {
      process.env.ULG_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS =
        inheritedMatrixCadence;
    }
  }
});

test('visual matrix durable publication uses no-clobber private external artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-visual-matrix-publication-'));
  try {
    const repoDir = path.join(root, 'repo');
    const releaseDir = path.join(root, 'release');
    const artifactPath = path.join(releaseDir, 'matrix.log');
    await mkdir(repoDir);
    assert.equal(durableVisualMatrixReleasePublicationEnabled('1'), true);
    assert.equal(durableVisualMatrixReleasePublicationEnabled('true'), false);
    assert.equal(
      SPH_VISUAL_MATRIX_DURABLE_RELEASE_PUBLICATION_ENV,
      'ULG_VISUAL_MATRIX_DURABLE_RELEASE_PUBLICATION'
    );
    await persistVisualMatrixArtifact({
      artifactPath,
      repoDir,
      value: 'durable log\n',
      label: 'test durable matrix log',
      durableReleasePublication: true
    });
    assert.deepEqual(await readFile(artifactPath), Buffer.from('durable log\n'));
    assert.equal((await lstat(artifactPath)).mode & 0o777, 0o600);
    assert.equal((await lstat(releaseDir)).mode & 0o777, 0o700);
    for (const [name, value] of [
      ['fallback.json', '{"status":"bad"}\n'],
      ['summary.json', '{"failedCount":0}\n']
    ]) {
      const target = path.join(releaseDir, name);
      await persistVisualMatrixArtifact({
        artifactPath: target,
        repoDir,
        value,
        label: `test durable matrix ${name}`,
        durableReleasePublication: true
      });
      assert.equal(await readFile(target, 'utf8'), value);
      assert.equal((await lstat(target)).mode & 0o777, 0o600);
    }
    await assert.rejects(
      persistVisualMatrixArtifact({
        artifactPath,
        repoDir,
        value: 'replacement\n',
        label: 'test durable matrix log',
        durableReleasePublication: true
      }),
      /already exists and will not be replaced/u
    );
    assert.deepEqual(await readFile(artifactPath), Buffer.from('durable log\n'));
    await assert.rejects(
      persistVisualMatrixArtifact({
        artifactPath: path.join(repoDir, 'forbidden.log'),
        repoDir,
        value: 'forbidden\n',
        durableReleasePublication: true
      }),
      /outside the repository/u
    );
    const legacyPath = path.join(repoDir, 'legacy.log');
    await persistVisualMatrixArtifact({ artifactPath: legacyPath, repoDir, value: 'first' });
    await persistVisualMatrixArtifact({ artifactPath: legacyPath, repoDir, value: 'second' });
    assert.equal(await readFile(legacyPath, 'utf8'), 'second');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('visual displacement acceptance follows the scenario length scale', () => {
  const source = Object.freeze({
    generatedGas: Object.freeze({
      selector: Object.freeze({ materials: Object.freeze(['h2o']) }),
      minimumSustainedRiseM: 0.05,
      tailSampleCount: 2,
      upperWallTerminal: Object.freeze({
        boundaryCondition: 'closed-g2p-clamped',
        boxMaxYM: 3,
        wallInsetM: 0.125,
        contactToleranceM: 1e-6,
        maximumTailRetreatM: 0.01
      })
    }),
    condensedLaunch: Object.freeze({
      selector: Object.freeze({ excludePhases: Object.freeze(['gas']) }),
      maxUpwardExcursionM: 0.35,
      minimumSampleCount: 4
    }),
    coldCeilingCondensation: Object.freeze({
      selector: Object.freeze({ materials: Object.freeze(['h2o']) }),
      minimumCeilingContactYM: 4.75,
      minimumReturnDropM: 0.25
    })
  });
  const scaled = scaleStandardPhaseAcceptance(source, 0.028);

  assert.ok(
    Math.abs(scaled.generatedGas.minimumSustainedRiseM - 0.0014) < 1e-15
  );
  assert.ok(
    Math.abs(scaled.condensedLaunch.maxUpwardExcursionM - 0.0098) < 1e-15
  );
  assert.equal(scaled.generatedGas.tailSampleCount, 2);
  assert.equal(
    scaled.generatedGas.upperWallTerminal.boundaryCondition,
    'closed-g2p-clamped'
  );
  assert.ok(
    Math.abs(scaled.generatedGas.upperWallTerminal.boxMaxYM - 0.084)
      < 1e-15
  );
  assert.ok(
    Math.abs(scaled.generatedGas.upperWallTerminal.wallInsetM - 0.0035)
      < 1e-15
  );
  assert.ok(
    Math.abs(
      scaled.generatedGas.upperWallTerminal.contactToleranceM - 2.8e-8
    ) < 1e-20
  );
  assert.ok(
    Math.abs(
      scaled.generatedGas.upperWallTerminal.maximumTailRetreatM - 0.00028
    ) < 1e-15
  );
  assert.notEqual(
    scaled.generatedGas.upperWallTerminal,
    source.generatedGas.upperWallTerminal
  );
  assert.equal(scaled.condensedLaunch.minimumSampleCount, 4);
  assert.ok(
    Math.abs(
      scaled.coldCeilingCondensation.minimumCeilingContactYM - 0.133
    ) < 1e-15
  );
  assert.ok(
    Math.abs(
      scaled.coldCeilingCondensation.minimumReturnDropM - 0.007
    ) < 1e-15
  );
  assert.equal(source.generatedGas.minimumSustainedRiseM, 0.05);
  assert.equal(source.generatedGas.upperWallTerminal.boxMaxYM, 3);
  assert.equal(source.condensedLaunch.maxUpwardExcursionM, 0.35);
});

test('standard generated-gas gates route one exact material and mass floor to the probe', () => {
  const expectations = new Map([
    ['water-cycle', 'h2o'],
    ['iron-ice-quench', 'h2o'],
    ['sodium-water', 'h2']
  ]);
  for (const [presetId, targetMaterial] of expectations) {
    const scenario = STANDARD_SCENARIOS.find(
      (candidate) => candidate.presetId === presetId
    );
    assert.ok(scenario);
    const env = scenarioEnv({
      scenario,
      outputPath: `/tmp/${presetId}.json`,
      frameDir: `/tmp/${presetId}-frames`,
      port: 5310,
      batches: 1,
      batchSteps: 1,
      timeoutMs: 1000
    });
    assert.equal(
      env.ULG_PROBE_GENERATED_GAS_TARGET_MATERIAL,
      targetMaterial
    );
    assert.equal(
      env.ULG_PROBE_GENERATED_GAS_MINIMUM_MASS_KG,
      '0'
    );
    assert.equal(
      env.ULG_PROBE_GENERATED_GAS_MINIMUM_MASS_FRACTION_OF_SYSTEM,
      '0.000001'
    );
  }

  assert.throws(() => scenarioEnv({
    scenario: {
      label: 'ambiguous-gas',
      url: '/',
      phaseAwareAcceptance: {
        generatedGas: {
          selector: { materials: ['h2o', 'h2'] }
        }
      }
    },
    outputPath: '/tmp/ambiguous.json',
    frameDir: '/tmp/ambiguous-frames',
    port: 5310,
    batches: 1,
    batchSteps: 1,
    timeoutMs: 1000
  }), /requires exactly one target material/);
});

test('visual acceptance rejects invalid similarity scales', () => {
  assert.throws(
    () => scaleStandardPhaseAcceptance({ generatedGas: {} }, 0),
    /sceneLengthScale must be a positive finite number/
  );
  assert.equal(scaleStandardPhaseAcceptance(null, 0), null);
});

test('sodium wall-contact acceptance cannot mask frozen authoritative mechanics', () => {
  const scenario = STANDARD_SCENARIOS.find(
    (candidate) => candidate.presetId === 'sodium-water'
  );
  assert.ok(scenario);
  const terminalYM = 3 - 0.12407009817988002;
  const materialRow = ({
    material,
    materialId,
    phase,
    phaseId,
    massKg,
    liveParticleCount,
    yMinM,
    yMaxM,
    meanVyMPerS,
    temperatureK
  }) => ({
    material,
    materialId,
    phase,
    phaseId,
    massKg,
    liveParticleCount,
    phaseWeightedParticleCount: liveParticleCount,
    speedSampleCount: liveParticleCount,
    mechanicsSampleCount: liveParticleCount,
    mechanicsProblemParticleCount: 0,
    minVolumeRatioJ: 1,
    maxVolumeRatioJ: 1,
    yMinM,
    yMaxM,
    yCenterMassWeightedM: (yMinM + yMaxM) / 2,
    meanVyMPerS,
    minVyMPerS: meanVyMPerS,
    maxVyMPerS: meanVyMPerS,
    maxSpeedMPerS: Math.abs(meanVyMPerS),
    vySampleMassKg: massKg,
    temperatureMinK: temperatureK,
    temperatureMaxK: temperatureK,
    temperatureMassWeightedMeanK: temperatureK
  });
  const checkpoints = Array.from({ length: 5 }, (_, index) => {
    const hasProducts = index > 0;
    const atWall = index >= 2;
    const naMassKg = 0.2 - index * 0.02;
    const h2MassKg = hasProducts ? 0.01 : 0;
    const naohMassKg = hasProducts ? 0.02 : 0;
    const h2oMassKg = 1 - naMassKg - h2MassKg - naohMassKg;
    const h2YMinM = atWall ? terminalYM - 0.001 : 1.49;
    const h2YMaxM = atWall ? terminalYM : 1.51;
    const h2VyMPerS = atWall ? -0.03 : 7.7;
    const rows = [
      materialRow({
        material: 'h2o', materialId: 3061144, phase: 'liquid', phaseId: 2,
        massKg: h2oMassKg, liveParticleCount: 10,
        yMinM: 0.1 + index * 0.01, yMaxM: 0.9 + index * 0.01,
        meanVyMPerS: 0.1, temperatureK: 300 + index * 30
      }),
      materialRow({
        material: 'Na', materialId: 11, phase: 'solid', phaseId: 1,
        massKg: naMassKg, liveParticleCount: 2,
        yMinM: 1 + index * 0.01, yMaxM: 1.2 + index * 0.01,
        meanVyMPerS: -0.1, temperatureK: 300 + index * 30
      }),
      ...(hasProducts ? [
        materialRow({
          material: 'naoh', materialId: 665383, phase: 'liquid', phaseId: 2,
          massKg: naohMassKg, liveParticleCount: 1,
          yMinM: 0.5 + index * 0.01, yMaxM: 0.6 + index * 0.01,
          meanVyMPerS: -0.1, temperatureK: 300 + index * 30
        }),
        materialRow({
          material: 'h2', materialId: 3022823, phase: 'gas', phaseId: 3,
          massKg: h2MassKg, liveParticleCount: 9,
          yMinM: h2YMinM, yMaxM: h2YMaxM,
          meanVyMPerS: h2VyMPerS, temperatureK: 300 + index * 30
        })
      ] : [])
    ];
    const liveParticleCount = rows.reduce(
      (sum, row) => sum + row.liveParticleCount,
      0
    );
    return {
      status: 'captured',
      schema:
        'peercompute.ulg.sph-authoritative-gpu-material-phase-reduction.v1',
      aggregationStatus: 'gpu-reduced',
      backend: 'webgpu-compute',
      phase: index === 0 ? 'initial' : 'batch',
      source: index === 0
        ? 'retained-resident-particle-buffers'
        : 'worker-retained-terminal-compact-snapshot',
      authority: index === 0
        ? 'gpu-resident-retained-state'
        : 'worker-terminal-fence-and-state-manager-commit',
      sourceStep: index * 128,
      sourceTimeS: index * 0.128,
      uploadPairCoherenceStatus: 'ready',
      uploadPairMetadataCoherent: true,
      uploadPairSharedSlotIdentityVerified: true,
      materialMappingStatus: 'complete',
      speedEvidenceStatus: 'complete',
      mechanicsEvidenceStatus: 'complete',
      invalidMassParticleCount: 0,
      invalidMechanicsParticleCount: 0,
      overflowContributionCount: 0,
      liveParticleCount,
      speedSampleCount: liveParticleCount,
      mechanicsSampleCount: liveParticleCount,
      totals: { massKg: 1 },
      materialPhases: rows,
      generatedGasCohortCapture: {
        schema:
          'peercompute.ulg.sph-authoritative-generated-gas-cohort-capture.v0',
        status: 'captured',
        authority: 'gpu-resident-frozen-phase-lineage-bitmask',
        checkpointIndex: index,
        sourceStep: index * 128,
        sourceTimeS: index * 0.128,
        sameCarrierLineageProven: true,
        topologyEpoch: 0,
        identityRevision: 'sodium-wall-fixture'
      },
      generatedGasCohorts: hasProducts ? [{
        schema: 'peercompute.ulg.sph-authoritative-generated-gas-cohort.v0',
        status: 'captured',
        authority: 'gpu-resident-frozen-phase-lineage-bitmask',
        checkpointIndex: index,
        sourceStep: index * 128,
        sourceTimeS: index * 0.128,
        sameCarrierLineageProven: true,
        material: 'h2',
        materialId: 3022823,
        phase: 'gas',
        massKg: h2MassKg,
        activeGasCarrierCount: 9,
        inactiveFrozenLineageCount: 0,
        frozenLineageCount: 9,
        invalidActiveCarrierCount: 0,
        phasePurityProblemCount: 0,
        frozenLineageMaskHash: 'sodium-wall-fixture-mask',
        topologySignature: 'sodium-wall-fixture-topology',
        formedAtCheckpointIndex: 1,
        yCenterMassWeightedM: (h2YMinM + h2YMaxM) / 2,
        yMinM: h2YMinM,
        yMaxM: h2YMaxM,
        meanVyMPerS: h2VyMPerS,
        vySampleMassKg: h2MassKg
      }] : []
    };
  });
  const behavior = evaluateStandardScenarioBehavior(scenario, {
    timeline: {
      metrics: checkpoints.map((authoritativeGpuCheckpoint) => ({
        authoritativeGpuCheckpoint
      }))
    }
  });
  const checkById = new Map(behavior.checks.map((check) => [check.id, check]));

  assert.equal(
    behavior.phaseAwareEvidence.generatedGas.upperWallTerminalPassed,
    true
  );
  assert.equal(checkById.get('hydrogen-rises').status, 'pass');
  assert.equal(checkById.get('mechanics-state-advanced').status, 'fail');
  assert.equal(
    checkById.get('mechanics-state-advanced').observed.reason,
    'frozen-active-content'
  );
  assert.equal(behavior.status, 'fail');
});

test('spatial refinement preserves physical visual acceptance distances', () => {
  const ironIce = STANDARD_SCENARIOS.find(
    (scenario) => scenario.presetId === 'iron-ice-quench'
  );
  assert.ok(ironIce);
  assert.ok(Math.abs(standardScenarioPhysicalLengthScale({
    controls: { basen: '10' },
    runtime: { sceneLengthScale: '0.014' }
  }) - 0.028) < 1e-15);
  assert.ok(
    Math.abs(
      ironIce.phaseAwareAcceptance.generatedGas.minimumSustainedRiseM
      - 0.0014
    ) < 1e-15
  );
  assert.ok(
    Math.abs(
      ironIce.phaseAwareAcceptance.condensedLaunch.maxUpwardExcursionM
      - 0.0098
    ) < 1e-15
  );
});

test('iron cooling statistic is mass weighted across phase rows', () => {
  const checkpoint = {
    materialPhases: [
      {
        material: 'fe',
        phase: 'solid',
        massKg: 1,
        temperatureMassWeightedMeanK: 1700
      },
      {
        material: 'fe',
        phase: 'liquid',
        massKg: 3,
        temperatureMassWeightedMeanK: 1800
      },
      {
        material: 'h2o',
        phase: 'liquid',
        massKg: 10,
        temperatureMassWeightedMeanK: 300
      }
    ]
  };
  assert.equal(
    checkpointMassWeightedMeanTemperature(checkpoint, 'fe'),
    1775
  );
});

test('standard canned scenarios use worker-owned SS with a native surface consumer', () => {
  const presetsById = new Map(
    SPH_PHASE_SCENARIO_PRESETS.map((preset) => [preset.id, preset])
  );
  const expectedTimeoutMsByPreset = new Map([
    ['water-cycle', 1_200_000],
    ['iron-ice-quench', 2_700_000],
    ['sodium-water', 1_800_000],
    ['cesium-fluorine', 1_800_000]
  ]);
  const expectedFrameEveryByPreset = new Map([
    ['water-cycle', '1'],
    ['iron-ice-quench', '1'],
    ['sodium-water', '1'],
    ['cesium-fluorine', '1']
  ]);
  for (const scenario of STANDARD_SCENARIOS) {
    const preset = presetsById.get(scenario.presetId);
    assert.ok(preset, scenario.label);
    const validation = preset.frameworkValidation ?? preset.validation;
    const url = new URL(scenario.url, 'https://ulg.invalid');
    for (const [key, expectedValue] of Object.entries(preset.runtime)) {
      assert.equal(
        url.searchParams.get(key),
        String(expectedValue),
        `${scenario.label} must inherit preset.runtime.${key} without a matrix-only override`
      );
    }
    assert.equal(
      url.searchParams.get('renderer'),
      'native-webgpu',
      `${scenario.label} must select WebGPU without reclaiming presentation ownership`
    );
    assert.equal(
      url.searchParams.get('renderOwnership'),
      STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE,
      scenario.label
    );
    assert.equal(
      url.searchParams.get('surfaceDraw'),
      STANDARD_VISUAL_MATRIX_RENDERER_MODE,
      `${scenario.label} must present the worker-authenticated terminal snapshot through the native surface`
    );
    assert.equal(
      url.searchParams.get('residentAuto'),
      '0',
      `${scenario.label} probe must own the exact mounted schedule cadence`
    );
    assert.equal(
      scenario.visualRendererMode,
      STANDARD_VISUAL_MATRIX_RENDERER_MODE,
      scenario.label
    );
    assert.equal(
      scenario.residentComputeManagerMode,
      STANDARD_VISUAL_MATRIX_RESIDENT_COMPUTE_MODE,
      scenario.label
    );
    assert.equal(
      scenario.workerProgressEverySteps,
      STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS,
      scenario.label
    );
    assert.equal(
      scenario.timeoutMs,
      expectedTimeoutMsByPreset.get(scenario.presetId),
      scenario.label
    );
    if (scenario.presetId === 'sodium-water') {
      assert.equal(
        scenario.phaseAwareAcceptance.generatedGas
          .minimumSustainedMeanVyMPerS,
        0.001
      );
      assert.deepEqual(
        scenario.phaseAwareAcceptance.generatedGas.upperWallTerminal,
        {
          boundaryCondition: 'closed-g2p-clamped',
          boxMaxYM: 3,
          wallInsetM: 0.12407009817988002,
          contactToleranceM: 2.4814019635976003e-7,
          maximumTailRetreatM: 0.0024814019635976003
        }
      );
    } else {
      assert.equal(
        scenario.phaseAwareAcceptance?.generatedGas?.upperWallTerminal,
        undefined,
        scenario.label
      );
    }
    const plan = workerOwnedStandardScenarioSchedulePlan(preset, validation);
    assert.deepEqual(scenario.workerSchedulePlan, plan, scenario.label);
    assert.equal(
      scenario.acceptanceTrack,
      validation.acceptanceTrack ?? 'framework-liveness',
      scenario.label
    );
    assert.equal(scenario.batches, plan.scheduleCount, scenario.label);
    assert.equal(scenario.batchSteps, plan.scheduleStepCount, scenario.label);
    assert.equal(
      scenario.minVisualFrameTimeSpanS,
      0.128,
      `${scenario.label} must span both bounded framework schedules visually`
    );
    assert.ok(
      scenario.batchSteps <= STANDARD_VISUAL_MATRIX_WORKER_SCHEDULE_MAX_STEPS,
      scenario.label
    );
    assert.equal(
      scenario.batches * scenario.batchSteps,
      validation.batches * validation.batchSteps,
      scenario.label
    );
    assert.deepEqual(
      scenario.expectedCheckpoints,
      validation.checkpoints,
      scenario.label
    );
    const env = scenarioEnv({
      scenario,
      outputPath: `/tmp/${scenario.label}.json`,
      frameDir: `/tmp/${scenario.label}-frames`,
      port: 5310,
      batches: 1,
      batchSteps: 1,
      timeoutMs: 1000
    });
    assert.equal(env.ULG_PROBE_READBACK_MODE, 'no-full-readback');
    assert.equal(env.ULG_PROBE_RENDER_READBACK_MODE, 'no-full-readback');
    assert.equal(env.ULG_PROBE_RENDER_ROWS_READBACK_MODE, 'no-full-readback');
    assert.equal(
      env.ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE,
      STANDARD_VISUAL_MATRIX_RENDERER_MODE
    );
    assert.equal(env.ULG_PROBE_USE_MOUNTED_RESIDENT_SCHEDULER, '1');
    assert.equal(
      env.ULG_PROBE_WORKER_PROGRESS_EVERY_STEPS,
      String(STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS),
      scenario.label
    );
    assert.equal(
      env.ULG_PROBE_FRAME_EVERY,
      expectedFrameEveryByPreset.get(scenario.presetId),
      `${scenario.label} should capture every bounded framework schedule`
    );
  }
  for (const scenario of STANDARD_SCENARIOS) {
    const url = new URL(scenario.url, 'https://ulg.invalid');
    assert.equal(
      url.searchParams.get('reactionProductReserveMinimumLiveFraction'),
      scenario.presetId === 'sodium-water' ? '1' : null,
      `${scenario.label} must keep the enlarged product reserve sodium-only`
    );
    assert.equal(
      url.searchParams.get('reactionProductReserveExactDiscovery'),
      scenario.presetId === 'iron-ice-quench' ? '1' : null,
      `${scenario.label} must keep exact empty-catalog reserve pruning iron-only`
    );
  }
  assert.equal(
    STANDARD_SCENARIOS.find((scenario) => scenario.presetId === 'sodium-water')
      ?.batchSteps,
    128
  );
  const cesiumFramework = STANDARD_SCENARIOS.find(
    (scenario) => scenario.presetId === 'cesium-fluorine'
  );
  assert.equal(cesiumFramework?.acceptanceTrack, 'framework-liveness');
  assert.equal(cesiumFramework?.workerSchedulePlan.totalStepCount, 256);
  assert.equal(cesiumFramework?.batches, 2);
  assert.equal(cesiumFramework?.batchSteps, 128);
  assert.deepEqual(
    cesiumFramework?.expectedCheckpoints.map((checkpoint) => checkpoint.id),
    ['initial', 'reaction-active', 'bounded-terminal']
  );

  assert.equal(SCIENTIFIC_CALIBRATION_SCENARIOS.length, 4);
  assert.deepEqual(
    SCIENTIFIC_CALIBRATION_SCENARIOS.map((scenario) => scenario.label),
    [
      'scientific-calibration-water-cycle',
      'scientific-calibration-iron-ice-quench',
      'scientific-calibration-sodium-water',
      'scientific-calibration-cesium-fluorine'
    ]
  );
  const calibrationTotals = Object.fromEntries(
    SCIENTIFIC_CALIBRATION_SCENARIOS.map((scenario) => [
      scenario.presetId,
      scenario.workerSchedulePlan.totalStepCount
    ])
  );
  assert.deepEqual(calibrationTotals, {
    'water-cycle': 9216,
    'iron-ice-quench': 8192,
    'sodium-water': 2560,
    'cesium-fluorine': 2560
  });
  assert.deepEqual(
    Object.fromEntries(
      SCIENTIFIC_CALIBRATION_SCENARIOS.map((scenario) => [
        scenario.presetId,
        scenario.minVisualFrameTimeSpanS ?? null
      ])
    ),
    {
      'water-cycle': 4.5,
      'iron-ice-quench': 2,
      'sodium-water': null,
      'cesium-fluorine': null
    },
    'bounded framework spans must not weaken scientific calibration horizons'
  );
  const cesiumCalibration = SCIENTIFIC_CALIBRATION_SCENARIOS.find(
    (scenario) => scenario.presetId === 'cesium-fluorine'
  );
  assert.equal(
    cesiumCalibration.label,
    'scientific-calibration-cesium-fluorine'
  );
  assert.equal(cesiumCalibration.acceptanceTrack, 'scientific-calibration');
  assert.equal(cesiumCalibration.workerSchedulePlan.totalStepCount, 2560);
  assert.equal(cesiumCalibration.batches, 20);
  assert.equal(cesiumCalibration.batchSteps, 128);
  assert.deepEqual(
    cesiumCalibration.expectedCheckpoints.map((checkpoint) => checkpoint.id),
    ['initial', 'ignition', 'runaway', 'late']
  );
  assert.equal(
    STANDARD_SCENARIOS.some(
      (scenario) => scenario.label === cesiumCalibration.label
    ),
    false,
    'scientific calibration stays outside the default standard matrix'
  );
});

test('visual scenarios restore one authoritative adjacent-level arm and keep the remaining matrix single-level', () => {
  const cesiumFluorine = STANDARD_SCENARIOS.find(
    (scenario) => scenario.presetId === 'cesium-fluorine'
  );
  assert.ok(cesiumFluorine);
  const scenarios = [
    ...STANDARD_SCENARIOS.filter(
      (scenario) => scenario !== cesiumFluorine
    ),
    ...deterministicRandomPairScenarios()
  ];
  assert.ok(scenarios.length >= 6);
  for (const scenario of scenarios) {
    const url = new URL(scenario.url, 'https://ulg.invalid');
    assert.equal(url.searchParams.get('schroederLevel'), '0', scenario.label);
    assert.equal(url.searchParams.get('schroederMinLevel'), '0', scenario.label);
    assert.equal(url.searchParams.get('schroederMaxLevel'), '0', scenario.label);
    assert.equal(url.searchParams.get('schroederTwoLevel'), '0', scenario.label);
    assert.equal(
      url.searchParams.get('schroederTwoLevelAuthority'),
      null,
      scenario.label
    );
    assert.equal(
      url.searchParams.get('schroederTwoLevelSubsteps'),
      null,
      scenario.label
    );
    assert.equal(
      url.searchParams.get('schroederCrossLevelCoupling'),
      '0',
      scenario.label
    );
    assert.equal(
      url.searchParams.get('schroederMechanicsFieldPairV2'),
      '0',
      scenario.label
    );
    assert.equal(
      url.searchParams.get('schroederActiveNodeSortedIndex'),
      '1',
      scenario.label
    );
    assert.equal(url.searchParams.get('ss'), '1', scenario.label);
  }

  for (const scenario of deterministicRandomPairScenarios()) {
    assert.equal(scenario.acceptanceTrack, 'framework-liveness');
    assert.equal(scenario.batches, 3);
    assert.equal(scenario.batchSteps, 64);
    assert.equal(scenario.workerSchedulePlan.sourceBatches, 3);
    assert.equal(scenario.workerSchedulePlan.sourceBatchSteps, 64);
    assert.equal(scenario.workerSchedulePlan.scheduleCount, 3);
    assert.equal(scenario.workerSchedulePlan.scheduleStepCount, 64);
    assert.equal(scenario.workerSchedulePlan.totalStepCount, 192);
    assert.equal(
      scenario.workerProgressEverySteps,
      STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS
    );
  }

  const url = new URL(cesiumFluorine.url, 'https://ulg.invalid');
  assert.equal(url.searchParams.get('schroederLevel'), '0');
  assert.equal(url.searchParams.get('schroederMinLevel'), '0');
  assert.equal(url.searchParams.get('schroederMaxLevel'), '1');
  assert.equal(url.searchParams.get('schroederTwoLevel'), '1');
  assert.equal(
    url.searchParams.get('schroederTwoLevelAuthority'),
    'authoritative'
  );
  assert.equal(url.searchParams.get('schroederTwoLevelSubsteps'), '2');
  assert.equal(url.searchParams.get('cfl'), '0.8');
  assert.equal(url.searchParams.get('cflSafety'), '0.2');
  assert.equal(
    url.searchParams.get('schroederCrossLevelCoupling'),
    '0',
    'authoritative paired fields and terminal reflux supersede generic coupling candidates'
  );
  assert.equal(
    url.searchParams.get('schroederMechanicsFieldPairV2'),
    '1'
  );
  assert.ok(Number(url.searchParams.get('schroederBaseGridSpacingM')) > 0);
  assert.ok(url.searchParams.get('bodies'));
  assert.equal(cesiumFluorine.expectAuthoritativeTwoLevelMechanics, true);
  assert.equal(cesiumFluorine.expectedTwoLevelCflFactor, 0.8);
});

test('cesium-fluorine matrix URL bodies physically populate both declared Schroeder levels', () => {
  const matrixScenario = STANDARD_SCENARIOS.find(
    (scenario) => scenario.presetId === 'cesium-fluorine'
  );
  assert.ok(matrixScenario);
  const url = new URL(matrixScenario.url, 'https://ulg.invalid');
  const initialBodies = parseSphInitialBodies(
    url.searchParams.get('bodies')
  );
  const demo = buildSphPhaseDemoState({
    scenario: createSphPhaseScenario({
      boxDimensionsM: [4, 4, 4]
    }),
    initialBodies,
    allowFixtureMaterialProperties: true,
    mechanics: 'mlsmpm'
  });
  const baseDx = Number(
    url.searchParams.get('schroederBaseGridSpacingM')
  );
  const levelForBody = (bodyId) => {
    const particle = demo.state.particles.find(
      (candidate) => candidate.initialBodyId === bodyId
    );
    assert.ok(particle, `missing ${bodyId} initial-body particle`);
    const supportRadiusM = Math.cbrt(
      (3 * particle.continuumCellVolumeM3) / (4 * Math.PI)
    );
    return {
      supportRadiusM,
      level: estimateSchroederLevelFromSupportRadius({
        supportRadiusM,
        baseGridSpacingM: baseDx,
        targetSupportCells: 1.5,
        minLevel: 0,
        maxLevel: 1
      })
    };
  };
  const cesium = levelForBody('drop');
  const fluorine = levelForBody('base');
  assert.ok(Math.abs(cesium.supportRadiusM - 0.074442058907928) < 1e-12);
  assert.ok(
    Math.abs(fluorine.supportRadiusM - 0.12407009817988002) < 1e-12
  );
  assert.deepEqual(
    { Cs: cesium.level, F: fluorine.level },
    { Cs: 0, F: 1 }
  );
  assert.deepEqual(
    [...new Set([cesium.level, fluorine.level])].sort(),
    [0, 1]
  );
});

test('iron-ice surface-stress visual evidence is exact and fail-closed', () => {
  const scenario = STANDARD_SCENARIOS.find(
    (entry) => entry.presetId === 'iron-ice-quench'
  );
  assert.ok(scenario);
  assert.equal(
    new URL(scenario.url, 'https://ulg.invalid').searchParams.get('lawst'),
    '1'
  );
  const receipt = {
    schema: 'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2',
    status: 'eighteen-pass-central-bond-surface-stress-submitted-unverified',
    requested: true,
    submitted: true,
    dispatchCount: 18,
    lifecycleDispatchCount: 21,
    lifecycleMode:
      'standalone-s9ab-initialize-ambient-eighteen-central-bonds-validate-commit',
    ambientBuoyancyMode:
      'field-local-s9ab-current-volume-ambient-source',
    selectedLevel: 0,
    levelRole: 'single',
    twoLevel: false,
    positiveSurfaceTensionPhaseRecordCount: 1,
    surfaceTensionCoefficientStatus:
      'positive-surface-tension-coefficient-ready',
    verification: 'queue-submitted-no-full-readback'
  };
  const probe = {
    timeline: {
      metrics: [
        {
          phase: 'resident-batch',
          residentSteps: {
            completedStepCount: 1,
            finalStepPhaseVolumeSurfaceStressSubmission: receipt,
            phaseVolumeSurfaceStressRequired: true,
            phaseVolumeSurfaceStressExpectedSubmissionCount: 1,
            phaseVolumeSurfaceStressSubmissionCount: 1,
            phaseVolumeSurfaceStressSubmissionEvidenceComplete: true,
            phaseVolumeSurfaceStressSubmissions: [receipt]
          }
        },
        {
          phase: 'resident-batch',
          residentStep: {
            status: 'submitted-unverified',
            phaseVolumeSurfaceStressSubmission: { ...receipt }
          }
        }
      ]
    }
  };
  const directScenario = {
    ...scenario,
    visualRenderOwnershipMode: 'main-thread-renderer',
    residentComputeManagerMode: 'direct',
    workerSchedulePlan: null,
    batches: null
  };

  const pass = evaluateSurfaceStressExecutionEvidence(directScenario, probe);
  assert.equal(pass.status, 'pass');
  assert.equal(pass.observed.exactSubmissionCount, 2);

  const missing = structuredClone(probe);
  delete missing.timeline.metrics[1].residentStep
    .phaseVolumeSurfaceStressSubmission;
  const fail = evaluateSurfaceStressExecutionEvidence(directScenario, missing);
  assert.equal(fail.status, 'fail');
  assert.equal(fail.observed.exactSubmissionCount, 1);

  const workerProbe = {
    timeline: {
      metrics: [{
        phase: 'resident-batch',
        residentSteps: {
          residentComputeManagerMode: 'worker-owned-resident-lane',
          workerLaneFallback: null,
          completedStepCount: 3,
          finalStepPhaseVolumeSurfaceStressSubmission: receipt,
          phaseVolumeSurfaceStressWorkerEvidence: {
            schema:
              'peercompute.ulg.worker-resident-schedule-surface-stress-evidence.v0',
            required: true,
            observedStepCount: 3,
            expectedSubmissionCount: 3,
            exactSubmissionCount: 3,
            submissionEvidenceComplete: true,
            firstIncompleteStepOrdinal: null,
            finalSubmissionStepOrdinal: 3,
            finalSubmission: receipt
          },
          workerOwnedResidentLane: {
            scheduleId: 'worker-surface:schedule:1',
            residentScheduleStatus: 'worker-resident-schedule-completed',
            terminalStatus:
              'worker-offscreen-resident-schedule-on-presentation-device-completed',
            requestedStepCount: 3,
            completedStepCount: 3,
            progressEverySteps:
              STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS,
            laneCompletedStepTotal: 3,
            cancelled: false,
            gpuFence: {
              scope: 'resident-schedule-terminal',
              terminalScheduleFence: true,
              fenceSatisfied: true,
              authorityAdmissionReady: true
            },
            authority: {
              status: 'state-manager-committed-worker-schedule',
              computeManagerLeaseStatus: 'completed',
              computeManagerFenceSatisfied: true,
              stateManagerCommitStatus: 'committed'
            }
          }
        }
      }]
    }
  };
  const oneScheduleScenario = {
    ...scenario,
    workerSchedulePlan: {
      ...scenario.workerSchedulePlan,
      scheduleCount: 1,
      scheduleStepCount: 3,
      totalStepCount: 3
    },
    batches: 1
  };
  assert.equal(
    evaluateSurfaceStressExecutionEvidence(
      oneScheduleScenario,
      workerProbe
    ).status,
    'pass'
  );
  const workerCountMismatch = structuredClone(workerProbe);
  workerCountMismatch.timeline.metrics[0].residentSteps
    .phaseVolumeSurfaceStressWorkerEvidence.exactSubmissionCount = 2;
  assert.equal(
    evaluateSurfaceStressExecutionEvidence(
      oneScheduleScenario,
      workerCountMismatch
    ).status,
    'fail'
  );

  const staleErrorMetric = structuredClone(workerProbe.timeline.metrics[0]);
  staleErrorMetric.phase = 'resident-batch-error';
  workerProbe.timeline.metrics.push(staleErrorMetric);
  const staleFiltered = evaluateSurfaceStressExecutionEvidence(
    oneScheduleScenario,
    workerProbe
  );
  assert.equal(staleFiltered.status, 'fail');
  assert.equal(staleFiltered.observed.residentExecutionSampleCount, 1);
  assert.equal(staleFiltered.observed.exactSubmissionCount, 1);
  assert.equal(staleFiltered.observed.invalidExecutionSampleCount, 1);

  const duplicate = structuredClone(workerProbe);
  duplicate.timeline.metrics[1].phase = 'resident-batch';
  const duplicateResult = evaluateSurfaceStressExecutionEvidence(
    oneScheduleScenario,
    duplicate
  );
  assert.equal(duplicateResult.status, 'fail');
  assert.equal(duplicateResult.observed.duplicateScheduleIdCount, 1);

  const incompleteHorizon = evaluateSurfaceStressExecutionEvidence(
    {
      ...oneScheduleScenario,
      workerSchedulePlan: {
        ...oneScheduleScenario.workerSchedulePlan,
        scheduleCount: 2,
        totalStepCount: 6
      },
      batches: 2
    },
    workerProbe
  );
  assert.equal(incompleteHorizon.status, 'fail');
  assert.equal(incompleteHorizon.observed.expectedExecutionSampleCount, 2);
});

test('authoritative two-level matrix evidence is complete for every retained resident sample', () => {
  const scenario = {
    expectAuthoritativeTwoLevelMechanics: true
  };
  const probe = {
    timeline: {
      metrics: [
        {
          residentStep: { status: 'submitted-unverified' },
          schroederTelemetry: {
            twoLevelMechanicsCoverageComplete: true
          }
        },
        {
          residentSteps: {
            completedStepCount: 2,
            workerOwnedResidentLane: {
              scheduleId: 'schedule:two-level:1',
              laneId: 'lane:two-level',
              stateKey: 'state:two-level',
              completedStepCount: 2,
              twoLevelMechanics: {
                schema:
                  'peercompute.ulg.worker-resident-schedule-two-level-mechanics-evidence.v0',
                requested: true,
                authorityRequested: 'authoritative',
                fineSubstepCountRequested: 2,
                cflFactorEvidenceRequired: true,
                cflFactorRequested: 0.8,
                cflFactorObservedStepCount: 2,
                exactCflFactorCount: 2,
                firstCflFactorMismatchStepOrdinal: null,
                lastCflFactor: 0.8,
                observedStepCount: 2,
                exactAuthoritativeStepCount: 2,
                terminalRefluxReceiptRequired: true,
                terminalRefluxReceipt: {
                  schema:
                    'peercompute.ulg.worker-resident-schedule-terminal-reflux-receipt.v0',
                  required: true,
                  scheduleId: 'schedule:two-level:1',
                  laneId: 'lane:two-level',
                  stateKey: 'state:two-level',
                  expectedStepCount: 2,
                  observedStepCount: 2,
                  admittedStepCount: 2,
                  firstRejectedStepOrdinal: null,
                  allStepsAdmitted: true,
                  status: 'terminal-reflux-schedule-receipt-admitted',
                  reason: null,
                  firstRejectedDiagnostic: null
                },
                terminalRefluxAdmittedStepCount: 2,
                firstIncompleteStepOrdinal: null,
                coverageComplete: true,
                lastStep: {
                  status:
                    'schroeder-two-level-authoritative-step-executed',
                  mechanicsLevelCount: 2,
                  twoLevelMechanicsEnabled: true,
                  twoLevelMechanicsAuthority: 'authoritative',
                  twoLevelFineSubstepCount: 2,
                  twoLevelAuthoritativeCommitVerified: true
                }
              }
            }
          },
          schroederTelemetry: {
            twoLevelMechanicsCoverageComplete: true
          }
        }
      ]
    }
  };
  const pass = evaluateAuthoritativeTwoLevelMechanicsEvidence(
    scenario,
    probe
  );
  assert.equal(pass.status, 'pass');
  assert.equal(pass.observed.completeSampleCount, 2);

  const exactCflProbe = structuredClone(probe);
  exactCflProbe.timeline.metrics = [exactCflProbe.timeline.metrics[1]];
  const exactCflPass = evaluateAuthoritativeTwoLevelMechanicsEvidence(
    {
      ...scenario,
      expectedTwoLevelCflFactor: 0.8
    },
    exactCflProbe
  );
  assert.equal(exactCflPass.status, 'pass');
  assert.equal(exactCflPass.observed.expectedCflFactor, 0.8);
  const missingTerminalReflux = structuredClone(exactCflProbe);
  delete missingTerminalReflux.timeline.metrics[0].residentSteps
    .workerOwnedResidentLane.twoLevelMechanics.terminalRefluxReceipt;
  assert.equal(
    evaluateAuthoritativeTwoLevelMechanicsEvidence(
      {
        ...scenario,
        expectedTwoLevelCflFactor: 0.8
      },
      missingTerminalReflux
    ).status,
    'fail'
  );
  const mismatchedTerminalReflux = structuredClone(exactCflProbe);
  mismatchedTerminalReflux.timeline.metrics[0].residentSteps
    .workerOwnedResidentLane.twoLevelMechanics
    .terminalRefluxReceipt.scheduleId = 'schedule:foreign';
  assert.equal(
    evaluateAuthoritativeTwoLevelMechanicsEvidence(
      {
        ...scenario,
        expectedTwoLevelCflFactor: 0.8
      },
      mismatchedTerminalReflux
    ).status,
    'fail'
  );
  const cflMismatch = structuredClone(exactCflProbe);
  cflMismatch.timeline.metrics[0].residentSteps.workerOwnedResidentLane
    .twoLevelMechanics.lastCflFactor = 0.6;
  assert.equal(
    evaluateAuthoritativeTwoLevelMechanicsEvidence(
      {
        ...scenario,
        expectedTwoLevelCflFactor: 0.8
      },
      cflMismatch
    ).status,
    'fail'
  );

  const missing = structuredClone(probe);
  missing.timeline.metrics[1].residentSteps.workerOwnedResidentLane
    .twoLevelMechanics.exactAuthoritativeStepCount = 1;
  const fail = evaluateAuthoritativeTwoLevelMechanicsEvidence(
    scenario,
    missing
  );
  assert.equal(fail.status, 'fail');
  assert.equal(fail.observed.completeSampleCount, 1);
  assert.equal(
    evaluateAuthoritativeTwoLevelMechanicsEvidence({}, probe),
    null
  );
});
