import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeTimeline,
  resolveProbeScenarioSelection
} from '../scripts/sph-long-horizon-probe.mjs';

const IDS = Object.freeze({
  scheduleId: 'lane:1:schedule:7',
  laneId: 'lane:1',
  stateKey: 'lane:1:state'
});

function workerIsosurfaceMetric() {
  const frameProof = {
    presentationFrameSchema:
      'peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0',
    presentationFrameStatus: 'worker-owned-isosurface-presentation-opportunity',
    presentationFrameAdmitted: true,
    presentationFrameGpuCompleted: true,
    presentationFrameGpuCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    presentationFramePresentationOpportunity: true,
    presentationFramePresentationOpportunityMethod:
      'worker-request-animation-frame-after-gpu-completion',
    presentationQueueCompletionCount: 7,
    presentationQueueCompletionSerial: 7,
    presentationQueueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    presentationQueueCompletionScope:
      'worker-offscreen-shared-device-queue-frame-proof'
  };
  const authorityProof = {
    residentScheduleCandidatePresentation: true,
    stateManagerCommittedPresentation: true,
    authorityStatus: 'state-manager-committed-worker-schedule',
    computeManagerCompletionSchema:
      'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
    computeManagerLeaseId: 'lane:1:lease:7',
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
  };
  const identity = {
    ...IDS,
    sphStep: 127,
    requestGeneration: 7,
    presentationLaneEpoch: 1,
    residentExecutionGeneration: 259,
    stepOrdinal: 128
  };
  const renderedContent = {
    schema: 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0',
    renderRowsSchema: 'peercompute.ulg.worker-offscreen-render-rows.v0',
    status: 'worker-offscreen-resident-isosurface-presentation-rendered',
    ...identity,
    ...authorityProof,
    ...frameProof,
    particleCount: 608,
    frameCount: 9,
    readyFrameCount: 9,
    workerFramebufferEpoch: 6,
    displayOwnerEpoch: 3,
    presentationGeometry: 'worker-owned-true-isosurface',
    sameDevicePresentation: true,
    indirectDrawCount: 4,
    participatingMediumAggregateDrawCount: 1
  };
  const workerRows = {
    schema: 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0',
    status: 'worker-offscreen-resident-isosurface-presentation-rendered',
    ...identity,
    ...frameProof,
    particleCount: 608,
    frameCount: 9,
    readyFrameCount: 9,
    displayHandoff: 'transferControlToOffscreen',
    frameCopyBackRejected: true,
    workerReady: true,
    contextStatus: 'webgpu-context-ready',
    presentationGeometry: 'worker-owned-true-isosurface',
    sameDevicePresentation: true
  };
  return {
    sceneTimeS: 0.064,
    renderModeSelection: {
      selectedByUrl: false,
      requestProvenance: {
        schema: 'peercompute.ulg.sph-resident-surface-draw-mode-request.v0',
        status: 'surface-draw-mode-preset-runtime-serialized',
        requestedMode: 'native-webgpu-surface-consumer',
        requestedUrlMode: 'native-webgpu-surface-consumer',
        presetMode: 'native-webgpu-surface-consumer',
        explicit: false,
        explicitDiagnosticMarker: false,
        presetSerializedRuntime: true,
        hashMatchesSelectedPreset: true
      }
    },
    peerComputeRenderOwnershipPolicy: {
      schema: 'peercompute.ulg.render-ownership-policy.v0',
      effectiveMode: 'worker-owned-resident-render-producer',
      inputTransport: 'worker-owned-resident-render-producer',
      displayTransport: 'worker-owned-presented-canvas',
      displayHandoff: 'transferControlToOffscreen',
      frameCopyBackRejected: true,
      workerOffscreenPresentationRequested: true,
      workerOwnedResidentProducerReady: true
    },
    residentSteps: {
      workerOwnedResidentLane: {
        schema: 'peercompute.ulg.sph-scene-worker-owned-resident-lane-execution.v0',
        ...IDS,
        residentScheduleStatus: 'worker-resident-schedule-completed',
        terminalStatus:
          'worker-offscreen-resident-schedule-on-presentation-device-completed',
        cancelled: false,
        requestedStepCount: 128,
        completedStepCount: 128,
        laneCompletedStepTotal: 128,
        authority: {
          status: 'state-manager-committed-worker-schedule',
          computeManagerLeaseStatus: 'completed',
          computeManagerFenceSatisfied: true,
          stateManagerCommitStatus: 'committed'
        },
        gpuFence: {
          scope: 'resident-schedule-terminal',
          terminalScheduleFence: true,
          fenceSatisfied: true,
          queueCompletionStatus: 'queue-work-completed',
          queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
          authorityAdmissionReady: true
        },
        finalEpochIdentity: {
          storageGeneration: 259,
          physicsTick: 127,
          // Product placement and other position writers have their own epoch;
          // it is not required to equal the mechanics tick.
          positionEpoch: 191
        },
        committedPresentation: {
          status: 'worker-offscreen-resident-isosurface-presentation-enqueued',
          ...IDS,
          presentationLaneEpoch: 1,
          sphStep: 127,
          residentExecutionGeneration: 259,
          stepOrdinal: 128
        }
      }
    },
    workerOffscreenCanvas: {
      count: 1,
      visibleCount: 1,
      visible: true
    },
    sceneCanvasVisibility: {
      count: 2,
      visibleCount: 1,
      workerCount: 1,
      visibleWorkerCount: 1
    },
    workerOffscreenRenderRows: workerRows,
    workerOffscreenPresentation: {
      requested: true,
      displayHandoff: 'transferControlToOffscreen',
      frameCopyBackRejected: true,
      canvasTransferred: true,
      workerReady: true,
      contextStatus: 'webgpu-context-ready',
      displayOwner: 'worker',
      displayOwnerEpoch: 3,
      displayOwnerContentReady: true,
      displayOwnerContentFrameSerial: 7,
      displayOwnerPresentedSphStep: 127,
      displayCanvasVisible: true,
      workerFramebufferEpoch: 6,
      frameCount: 9,
      readyFrameCount: 9,
      displayOwnerLastRenderedContent: renderedContent
    }
  };
}

function compositorFrame(overrides = {}) {
  return {
    status: 'captured',
    sampleIndex: 0,
    visibleCanvasCount: 1,
    captureSource: 'playwright-compositor-screenshot',
    png: {
      status: 'ready',
      hasVisiblePixels: true,
      hasSurfaceLikeVariation: true
    },
    ...overrides
  };
}

function analyzeWorkerMetric(metric, frame = compositorFrame()) {
  return analyzeTimeline({
    status: 'complete',
    probeMode: 'scene',
    surfaceDrawDiagnosticMode: 'native-webgpu-surface-consumer',
    renderReadbackMode: 'no-full-readback',
    renderFieldSurfaceSummaryMode: 'skip',
    metrics: [metric],
    visualFrames: [frame]
  }, {
    scenarioUrl: '/?drop=Na&base=F&dropt=293.15&baset=293.15',
    visualOnly: true
  });
}

test('ULG_PROBE_PRESET selects the registered canonical hash route', () => {
  const selection = resolveProbeScenarioSelection({
    presetId: 'water-cycle',
    scenarioUrl: null
  });
  const url = new URL(selection.scenarioUrl, 'http://ulg-probe.local/');
  const params = new URLSearchParams(url.hash.slice(1));

  assert.equal(selection.status, 'preset-canonical-hash-selected');
  assert.equal(selection.presetId, 'water-cycle');
  assert.equal(url.search, '');
  assert.equal(params.get('scenario'), 'water-cycle');
  assert.equal(params.get('surfaceDraw'), 'native-webgpu-surface-consumer');
  assert.equal(
    params.get('renderOwnership'),
    'worker-owned-resident-render-producer'
  );

  const explicitUrl = '/?surfaceDraw=native-webgpu-surface-consumer&drop=Na';
  assert.equal(resolveProbeScenarioSelection({
    presetId: null,
    scenarioUrl: explicitUrl
  }).scenarioUrl, explicitUrl);
  assert.throws(() => resolveProbeScenarioSelection({
    presetId: 'water-cycle',
    scenarioUrl: explicitUrl
  }), /mutually exclusive/);
  assert.throws(() => resolveProbeScenarioSelection({
    presetId: 'not-a-preset',
    scenarioUrl: null
  }), /unknown SPH phase scenario preset/);
});

test('canonical worker isosurface acceptance couples current authority to compositor pixels', () => {
  const analysis = analyzeWorkerMetric(workerIsosurfaceMetric());

  assert.equal(analysis.status, 'good', JSON.stringify(analysis.issues));
  assert.deepEqual(analysis.issues, []);
  assert.equal(analysis.presetWorkerPresentationRequestSampleCount, 1);
  assert.equal(analysis.explicitNativePresentationRequestSampleCount, 0);
  assert.equal(analysis.presetWorkerPresentationExpected, true);
  assert.equal(analysis.explicitNativePresentationExpected, false);
  assert.equal(analysis.workerOffscreenResidentIsosurfaceVisibleSampleCount, 1);
  assert.equal(analysis.workerIsosurfaceCompositorFrameCount, 1);
  assert.equal(analysis.presetWorkerPresentationAccepted, true);
  assert.equal(analysis.residentSurfaceBufferHandoffAccepted, false);
  assert.equal(analysis.nativeWebGpuSurfaceConsumerAccepted, false);
  assert.equal(analysis.visibleSurfaceSampleCount, 1);
  assert.equal(
    analysis.issues.includes('native-surface-presentation-not-admitted'),
    false
  );
  assert.equal(
    analysis.issues.includes('worker-isosurface-presentation-not-admitted'),
    false
  );
});

test('canonical worker isosurface acceptance fails closed on hidden, stale, or unproved frames', () => {
  const hidden = workerIsosurfaceMetric();
  hidden.workerOffscreenPresentation.displayCanvasVisible = false;
  hidden.workerOffscreenCanvas.visible = false;
  hidden.workerOffscreenCanvas.visibleCount = 0;
  const hiddenAnalysis = analyzeWorkerMetric(hidden);
  assert.equal(hiddenAnalysis.presetWorkerPresentationAccepted, false);
  assert.ok(hiddenAnalysis.issues.includes(
    'worker-isosurface-presentation-not-admitted'
  ));

  const stale = workerIsosurfaceMetric();
  stale.workerOffscreenPresentation.displayOwnerLastRenderedContent.scheduleId =
    'lane:1:schedule:6';
  const staleAnalysis = analyzeWorkerMetric(stale);
  assert.equal(staleAnalysis.presetWorkerPresentationAccepted, false);
  assert.ok(staleAnalysis.issues.includes(
    'worker-isosurface-presentation-not-admitted'
  ));

  for (const [label, mutate] of [
    ['incomplete lane', (metric) => {
      metric.residentSteps.workerOwnedResidentLane.completedStepCount = 127;
    }],
    ['uncompleted GPU frame', (metric) => {
      metric.workerOffscreenPresentation
        .displayOwnerLastRenderedContent.presentationFrameGpuCompleted = false;
    }],
    ['missing generation identity', (metric) => {
      delete metric.workerOffscreenRenderRows.residentExecutionGeneration;
      delete metric.workerOffscreenPresentation
        .displayOwnerLastRenderedContent.residentExecutionGeneration;
    }],
    ['no submitted geometry', (metric) => {
      const content = metric.workerOffscreenPresentation
        .displayOwnerLastRenderedContent;
      content.indirectDrawCount = 0;
      content.participatingMediumAggregateDrawCount = 0;
    }],
    ['non-exclusive worker canvas', (metric) => {
      metric.sceneCanvasVisibility.visibleCount = 2;
    }]
  ]) {
    const metric = workerIsosurfaceMetric();
    mutate(metric);
    const analysis = analyzeWorkerMetric(metric);
    assert.equal(analysis.presetWorkerPresentationAccepted, false, label);
    assert.ok(
      analysis.issues.includes('worker-isosurface-presentation-not-admitted'),
      label
    );
  }

  for (const [label, frame] of [
    ['stale sample index', compositorFrame({ sampleIndex: 1 })],
    ['non-compositor capture', compositorFrame({ captureSource: 'canvas-data-url' })],
    ['multiple visible canvases', compositorFrame({ visibleCanvasCount: 2 })],
    ['blank frame', compositorFrame({
      png: {
        status: 'ready',
        hasVisiblePixels: false,
        hasSurfaceLikeVariation: false
      }
    })]
  ]) {
    const analysis = analyzeWorkerMetric(workerIsosurfaceMetric(), frame);
    assert.equal(
      analysis.workerOffscreenResidentIsosurfaceVisibleSampleCount,
      1,
      label
    );
    assert.equal(analysis.presetWorkerPresentationAccepted, false, label);
    assert.ok(
      analysis.issues.includes('worker-isosurface-compositor-frame-not-proved'),
      label
    );
  }
});

test('an explicit URL-native route still requires main-native admission', () => {
  const metric = workerIsosurfaceMetric();
  metric.renderModeSelection.selectedByUrl = true;
  metric.renderModeSelection.requestProvenance = {
    ...metric.renderModeSelection.requestProvenance,
    status: 'surface-draw-mode-explicit-diagnostic',
    explicit: true,
    explicitDiagnosticMarker: true,
    presetSerializedRuntime: false,
    hashMatchesSelectedPreset: false
  };
  metric.renderState = {
    surfaceDrawGpuBufferHandoffReady: true,
    surfaceDrawVisibleGpuConsumerReady: true
  };

  const analysis = analyzeWorkerMetric(metric);
  assert.equal(analysis.presetWorkerPresentationExpected, false);
  assert.equal(analysis.explicitNativePresentationExpected, true);
  assert.equal(analysis.presetWorkerPresentationAccepted, false);
  assert.ok(analysis.issues.includes('native-surface-presentation-not-admitted'));
  assert.equal(
    analysis.issues.includes('worker-isosurface-presentation-not-admitted'),
    false
  );
});
