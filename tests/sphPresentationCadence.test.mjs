import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createSphPresentationCadenceTracker,
  installSphDashboardCadenceLifecycle,
  observeSphPresentation,
  readVisiblePresentationObservation,
  sampleSphDashboardFrameCounters,
  sphDashboardCadenceText,
  summarizeVisiblePresentationCadence
} from '../src/visualization/sphPresentationCadence.js';
import {
  summarizeVisiblePresentationCadence as sweepCadence
} from '../scripts/sph-headed-cadence-metrics.mjs';

function workerSnapshot({ timestampMs = 0, sourceStep = 0, frameCount = 1,
  geometry = 'particle', motionSerial = null, isosurfaceMotionAgeS = null } = {}) {
  const isosurface = geometry === 'isosurface';
  const rows = {
    schema: isosurface
      ? 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0'
      : 'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0',
    status: isosurface
      ? 'worker-offscreen-resident-isosurface-presentation-rendered'
      : 'worker-offscreen-resident-particle-state-producer-rendered',
    presentationGeometry: isosurface
      ? 'worker-owned-true-isosurface' : 'sphere-impostor-depth-fallback',
    renderRowsSchema: 'peercompute.ulg.worker-offscreen-render-rows.v0',
    workerLocalRenderRowsProduced: true,
    sameDevicePresentation: true,
    depthAttachmentReady: true,
    laneId: 'lane-a',
    stateKey: 'state-a',
    sphStep: sourceStep,
    particleCount: 16,
    surfaceCount: 1,
    indirectDrawCount: 1,
    displayOwnerEpoch: 1,
    frameCount,
    readyFrameCount: frameCount,
    presentationFrameSchema: isosurface
      ? 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0'
      : 'peercompute.ulg.worker-offscreen-particle-keyframe-presentation-frame.v0',
    presentationFrameStatus: isosurface
      ? 'worker-owned-isosurface-presentation-opportunity'
      : 'worker-particle-keyframe-presentation-opportunity',
    presentationFrameAdmitted: true,
    presentationFrameGpuCompleted: true,
    presentationFrameGpuCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    presentationFramePresentationOpportunity: true,
    presentationFramePresentationOpportunityMethod:
      'worker-request-animation-frame-after-gpu-completion',
    presentationQueueCompletionCount: frameCount,
    presentationQueueCompletionSerial: frameCount,
    presentationQueueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    presentationQueueCompletionScope: 'worker-offscreen-shared-device-queue-frame-proof',
    physicsQueuePrefixCoverage: 'physics-queue-prefix-not-attributed',
    physicsHostQueueFenceParticipation: false
  };
  if (motionSerial != null) Object.assign(rows, {
    motionFrameSchema: 'peercompute.ulg.worker-offscreen-particle-temporal-motion-frame.v0',
    motionFrameStatus: 'worker-particle-temporal-motion-frame-presentation-opportunity',
    motionFrameAdmitted: true,
    motionFrameGpuCompleted: true,
    motionFramePresentationOpportunity: true,
    motionFramePresentationOpportunityMethod:
      'worker-request-animation-frame-after-gpu-completion',
    motionFrameSerial: motionSerial,
    motionFrameSubmittedSerial: motionSerial,
    motionSourceSphStep: sourceStep,
    motionSourceFrameCount: 1,
    motionMethod: 'bounded-keyframe-velocity-extrapolation',
    motionVelocityBufferRetained: true
  });
  if (isosurfaceMotionAgeS != null) Object.assign(rows, {
    presentationLaneEpoch: 1, residentExecutionGeneration: 1,
    stepOrdinal: 1, requestGeneration: 1,
    isosurfaceTemporalPresentation: isosurfaceMotionAgeS > 0,
    isosurfacePresentationMotionAgeS: isosurfaceMotionAgeS,
    isosurfacePresentationSourceTimeS: sourceStep / 1000,
    isosurfacePresentationMotionMethod: isosurfaceMotionAgeS > 0
      ? 'bounded-gpu-field-velocity-extrapolation' : 'committed-source-mesh',
    presentationOnly: isosurfaceMotionAgeS > 0,
    authoritativeStateMutation: false
  });
  return {
    timestampMs,
    presentation: {
      displayOwner: 'worker',
      lifecycleGeneration: 1,
      displayOwnerEpoch: 1,
      displayOwnerContentReady: true,
      displayOwnerContentFrameSerial: frameCount,
      displayOwnerPresentedSphStep: sourceStep,
      displayCanvasVisible: true,
      frameCount,
      readyFrameCount: frameCount,
      displayOwnerLastRenderedContent: rows,
      workerOffscreenRenderRows: rows
    },
    steps: { workerOwnedResidentLane: { laneId: 'lane-a', stateKey: 'state-a' } },
    workerCanvasVisible: true,
    mainCanvasOpacity: '0',
    compositorOwner: 'worker'
  };
}

function fakeDashboardDom(snapshot) {
  const canvas = {
    isConnected: true,
    getBoundingClientRect: () => ({ width: 800, height: 600 })
  };
  const mainCanvas = {
    ...canvas,
    getAttribute: () => 'worker'
  };
  const overlay = {
    __sphScene: {
      getWorkerOffscreenPresentation: () => snapshot.presentation,
      getMlsMpmResidentSteps: () => snapshot.steps
    },
    querySelector: () => null
  };
  return {
    document: {
      visibilityState: 'visible',
      querySelector: (selector) => selector === '#sph-phase-overlay' ? overlay
        : selector.startsWith('#sph-scene') ? mainCanvas : canvas
    },
    getComputedStyle: (element) => ({
      display: 'block', visibility: 'visible', opacity: element === mainCanvas ? '0' : '1'
    })
  };
}

test('sweep and dashboard share the exact pure wall-clock counter and DOM observer', async () => {
  assert.equal(sweepCadence, summarizeVisiblePresentationCadence);
  const sweep = await readFile(new URL('../scripts/sph-headed-all-preset-cadence-sweep.mjs', import.meta.url), 'utf8');
  const mount = await readFile(new URL('../src/visualization/sphPhaseDemoMount.js', import.meta.url), 'utf8');
  assert.match(sweep, /readVisiblePresentationObservation.*= await import\(\s*'\/src\/visualization\/sphPresentationCadence.js'/);
  assert.match(mount, /sampleSphDashboardFrameCounters\(\{[\s\S]*?observation: readVisiblePresentationObservation\(now\)/);
  assert.match(mount, /fpsEl.textContent = `\$\{sphDashboardCadenceText\(frameCounters\)\}/);
  assert.doesNotMatch(mount, /physics fps|resident fps/);
});

test('a completed batch is one presented/source state update for either worker geometry', () => {
  for (const geometry of ['particle', 'isosurface']) {
    const tracker = createSphPresentationCadenceTracker();
    for (let i = 0; i <= 480; i += 1) {
      tracker.observe(observeSphPresentation(workerSnapshot({
        timestampMs: i * 1000 / 120,
        sourceStep: Math.floor(i / 240) * 128,
        frameCount: i + 1,
        geometry
      })));
    }
    const result = tracker.sample();
    assert.equal(result.presentationCadenceStatus, 'available');
    assert.equal(result.presentationCadenceWindowMs, 4000);
    assert.equal(result.visualTransitionCount, 2);
    assert.equal(result.presentedStatesPerSecond, 0.5);
    assert.equal(result.sourceStatesPerSecond, 0.5);
  }
});

test('unproven or hidden output is unavailable; an observed held frame is zero', () => {
  const tracker = createSphPresentationCadenceTracker();
  assert.equal(tracker.sample().presentedStatesPerSecond, null);
  tracker.observe(observeSphPresentation(workerSnapshot()));
  assert.equal(tracker.sample().presentedStatesPerSecond, null);
  tracker.observe(observeSphPresentation(workerSnapshot({ timestampMs: 2000, frameCount: 121 })));
  assert.equal(tracker.sample().presentedStatesPerSecond, 0);
  for (const [field, value] of [
    ['presentationFrameGpuCompleted', false],
    ['presentationFramePresentationOpportunity', false],
    ['presentationFrameAdmitted', false],
    ['presentationQueueCompletionSerial', null],
    ['displayOwnerEpoch', 2],
    ['laneId', 'stale-lane']
  ]) {
    const snapshot = workerSnapshot({ timestampMs: 3000, sourceStep: 128, frameCount: 122 });
    snapshot.presentation.displayOwnerLastRenderedContent[field] = value;
    const observation = observeSphPresentation(snapshot);
    assert.equal(observation.admitted, false, field);
    tracker.observe(observation);
    assert.equal(tracker.sample().presentedStatesPerSecond, null, field);
    assert.equal(tracker.sample().sourceStatesPerSecond, null, field);
    assert.ok(tracker.sample().presentationCadenceBlockers.length > 0, field);
  }
  const dom = fakeDashboardDom(workerSnapshot());
  assert.equal(readVisiblePresentationObservation(0, dom).admitted, true);
  dom.document.visibilityState = 'hidden';
  assert.equal(readVisiblePresentationObservation(1000, dom).admitted, false);
  assert.equal(observeSphPresentation({ timestampMs: 0 }).admitted, false);
});

test('a pending newer receipt cannot advance the durable visible framebuffer', () => {
  const tracker = createSphPresentationCadenceTracker();
  const initial = workerSnapshot();
  tracker.observe(observeSphPresentation(initial));
  const pending = workerSnapshot({ timestampMs: 2000, sourceStep: 128, frameCount: 2 });
  pending.presentation.displayOwnerLastRenderedContent = initial.presentation.displayOwnerLastRenderedContent;
  pending.presentation.displayOwnerPresentedSphStep = 0;
  tracker.observe(observeSphPresentation(pending));
  assert.equal(tracker.sample().presentedStatesPerSecond, 0);
  tracker.observe(observeSphPresentation(workerSnapshot({ timestampMs: 4000, sourceStep: 128, frameCount: 2 })));
  assert.equal(tracker.sample().visualTransitionCount, 1);
  assert.equal(tracker.sample().presentedStatesPerSecond, 0.25);
});

test('temporal motion requires GPU completion and a later presentation opportunity', () => {
  const tracker = createSphPresentationCadenceTracker();
  tracker.observe(observeSphPresentation(workerSnapshot()));
  for (let i = 1; i <= 60; i += 1) {
    tracker.observe(observeSphPresentation(workerSnapshot({
      timestampMs: i * 1000 / 60, frameCount: i + 1, motionSerial: i
    })));
  }
  assert.equal(tracker.sample().presentedStatesPerSecond, 60);
  assert.equal(tracker.sample().sourceStatesPerSecond, 0);
  for (const field of ['motionFrameGpuCompleted', 'motionFramePresentationOpportunity']) {
    const snapshot = workerSnapshot({ timestampMs: 2000, frameCount: 62, motionSerial: 61 });
    snapshot.presentation.displayOwnerLastRenderedContent[field] = false;
    const observation = observeSphPresentation(snapshot);
    assert.equal(observation.admitted, false);
    assert.equal(observation.motionFrameAdmitted, false);
    tracker.observe(observation);
    assert.equal(tracker.sample().presentedStatesPerSecond, null);
  }
});

test('isosurface cadence counts admitted temporal input changes, not camera redraws or pixel FPS', () => {
  const tracker = createSphPresentationCadenceTracker();
  const observations = [];
  for (let index = 0; index <= 120; index += 1) {
    const observation = observeSphPresentation(workerSnapshot({
      timestampMs: index * 1000 / 120, frameCount: index + 1,
      geometry: 'isosurface', isosurfaceMotionAgeS: Math.floor(index / 2) / 1000
    }));
    assert.equal(observation.admitted, true);
    assert.equal(observation.isosurfaceTemporalInputAdmitted, true);
    observations.push(observation);
    tracker.observe(observation);
  }
  const summary = tracker.sample();
  assert.equal(summary.presentedStatesPerSecond, 60);
  assert.equal(summary.sourceStatesPerSecond, 0);
  assert.equal(summary.temporalInputStatesPerSecond, 60);
  assert.equal(summary.temporalTransitionCount, 60);
  assert.equal(summary.visibleUpdatesPerSecond, null);
  assert.equal(summary.visibleMotionCadenceVerified, false);
  assert.equal(sweepCadence(observations, { sampleDurationMs: 1000 }).visualTransitionCount, 60);
  tracker.observe(observeSphPresentation(workerSnapshot({
    timestampMs: 2000, frameCount: 122, sourceStep: 128,
    geometry: 'isosurface', isosurfaceMotionAgeS: 0
  })));
  assert.equal(tracker.sample().sourceTransitionCount, 1);
  assert.equal(tracker.sample().visualTransitionCount, 61, 'batched source jump is one input');
});

test('isosurface included-prefix inputs retain exact QoS boundary proof without conflating autonomous frames', () => {
  const tracker = createSphPresentationCadenceTracker();
  tracker.observe(observeSphPresentation(workerSnapshot({
    geometry: 'isosurface', isosurfaceMotionAgeS: 0
  })));
  const snapshot = workerSnapshot({ timestampMs: 1000, frameCount: 2,
    geometry: 'isosurface', isosurfaceMotionAgeS: 0.01 });
  const rows = snapshot.presentation.displayOwnerLastRenderedContent;
  Object.assign(rows, {
    physicsQueuePrefixCoverage: 'physics-queue-prefix-included',
    physicsHostQueueFenceParticipation: true,
    physicsContinuationBlocked: true,
    presentationQosHostQueueFenceCount: 1,
    motionPresentationQosBoundary: {
      submissionOrdinal: 1, completedSubstepCount: 2,
      totalSubstepCount: 64, chunkStepCount: 2
    }
  });
  const observation = observeSphPresentation(snapshot);
  assert.equal(observation.admitted, true);
  tracker.observe(observation);
  assert.equal(tracker.sample().temporalInputStatesPerSecond, 1);
  assert.equal(tracker.sample().sourceStatesPerSecond, 0);
  assert.equal(tracker.sample().visibleUpdatesPerSecond, null);
  for (const mutate of [
    (row) => {
      delete row.isosurfaceTemporalPresentation;
      delete row.isosurfacePresentationMotionAgeS;
      delete row.isosurfacePresentationMotionMethod;
      delete row.isosurfacePresentationSourceTimeS;
    },
    (row) => {
      row.isosurfaceTemporalPresentation = false;
      row.isosurfacePresentationMotionAgeS = 0;
      row.isosurfacePresentationMotionMethod = 'committed-source-mesh';
      row.presentationOnly = false;
    },
    (row) => { row.motionPresentationQosBoundary = null; },
    (row) => { row.motionPresentationQosBoundary.submissionOrdinal = 0; },
    (row) => { row.motionPresentationQosBoundary.completedSubstepCount = 64; },
    (row) => { row.motionPresentationQosBoundary.chunkStepCount = 3; },
    (row) => { row.physicsHostQueueFenceParticipation = null; },
    (row) => { row.physicsContinuationBlocked = false; },
    (row) => { row.presentationQosHostQueueFenceCount = 2; },
    (row) => { row.physicsQueuePrefixCoverage = 'physics-queue-prefix-not-attributed'; }
  ]) {
    const invalid = structuredClone(snapshot);
    mutate(invalid.presentation.displayOwnerLastRenderedContent);
    const rejected = observeSphPresentation(invalid);
    assert.equal(rejected.admitted, false);
    assert.equal(rejected.isosurfaceTemporalInputAdmitted, false);
  }
});

test('isosurface temporal input rejects malformed proofs and missing retained lineage', () => {
  for (const [field, value] of [
    ['isosurfacePresentationMotionAgeS', NaN],
    ['isosurfacePresentationMotionAgeS', Infinity],
    ['isosurfacePresentationMotionAgeS', -1],
    ['isosurfacePresentationMotionAgeS', null],
    ['isosurfacePresentationSourceTimeS', null],
    ['isosurfacePresentationSourceTimeS', Infinity],
    ['isosurfacePresentationMotionMethod', 'camera-redraw'],
    ['isosurfaceTemporalPresentation', false],
    ['presentationOnly', false], ['authoritativeStateMutation', true],
    ['requestGeneration', 0], ['stepOrdinal', null],
    ['presentationLaneEpoch', null], ['residentExecutionGeneration', null],
    ['presentationFrameGpuCompleted', false],
    ['presentationFramePresentationOpportunity', false]
  ]) {
    const snapshot = workerSnapshot({ geometry: 'isosurface', isosurfaceMotionAgeS: 0.01 });
    snapshot.presentation.displayOwnerLastRenderedContent[field] = value;
    const observation = observeSphPresentation(snapshot);
    assert.equal(observation.admitted, false, field);
    assert.equal(observation.isosurfaceTemporalInputAdmitted, false, field);
  }
});

test('isosurface age and source-time regression invalidate cadence; a new retained request establishes a baseline', () => {
  for (const [field, value] of [
    ['isosurfacePresentationMotionAgeS', 0.005],
    ['isosurfacePresentationSourceTimeS', 3],
    ['requestGeneration', 1]
  ]) {
    const tracker = createSphPresentationCadenceTracker();
    const observations = [0, 1000].map((timestampMs, index) => {
      const snapshot = workerSnapshot({ timestampMs, frameCount: index + 1,
        geometry: 'isosurface', isosurfaceMotionAgeS: index * 0.01 });
      snapshot.presentation.displayOwnerLastRenderedContent.requestGeneration = 2;
      return observeSphPresentation(snapshot);
    });
    observations.forEach((observation) => tracker.observe(observation));
    const next = workerSnapshot({ timestampMs: 2000, frameCount: 3,
      geometry: 'isosurface', isosurfaceMotionAgeS: 0.02 });
    next.presentation.displayOwnerLastRenderedContent.requestGeneration = 2;
    next.presentation.displayOwnerLastRenderedContent[field] = value;
    const regressed = observeSphPresentation(next);
    assert.equal(regressed.admitted, true, 'cross-frame regression is checked by the observer');
    tracker.observe(regressed);
    assert.equal(tracker.sample().presentationCadenceStatus, 'presentation-evidence-regressed', field);
    assert.equal(tracker.sample().presentedStatesPerSecond, null, field);
    assert.equal(sweepCadence([...observations, regressed], { sampleDurationMs: 2000 }).motionFrameRegressionCount, 1, field);
  }
  const tracker = createSphPresentationCadenceTracker();
  for (let index = 0; index < 3; index += 1) {
    const snapshot = workerSnapshot({ timestampMs: index * 1000, frameCount: index + 1,
      geometry: 'isosurface', isosurfaceMotionAgeS: index === 1 ? 0.02 : 0.01 });
    snapshot.presentation.displayOwnerLastRenderedContent.requestGeneration = index === 2 ? 2 : 1;
    tracker.observe(observeSphPresentation(snapshot));
  }
  assert.equal(tracker.sample().visualTransitionCount, 1);
  assert.equal(tracker.sample().sourceTransitionCount, 0);
});

test('held terminal time stays in the denominator and expires with the rolling window', () => {
  const tracker = createSphPresentationCadenceTracker();
  for (const [timestampMs, sourceStep, frameCount] of [
    [0, 0, 1], [1000, 128, 2], [2000, 256, 3], [4000, 256, 3]
  ]) tracker.observe(observeSphPresentation(workerSnapshot({ timestampMs, sourceStep, frameCount })));
  assert.equal(tracker.sample().presentedStatesPerSecond, 0.5);
  tracker.observe(observeSphPresentation(workerSnapshot({ timestampMs: 6000, sourceStep: 256, frameCount: 3 })));
  assert.equal(tracker.sample().presentationCadenceWindowMs, 5000);
  assert.equal(tracker.sample().presentedStatesPerSecond, 0.2);
  tracker.observe(observeSphPresentation(workerSnapshot({ timestampMs: 14000, sourceStep: 256, frameCount: 3 })));
  assert.equal(tracker.sample().presentedStatesPerSecond, 0);
});

test('owner, lane, lifecycle, epoch, and explicit reset scopes start new windows', () => {
  for (const mutate of [
    (o) => { o.owner = 'main-native'; },
    (o) => { o.cohortIdentity = 'lane-b|state-a|1|1'; },
    (o) => { o.cohortIdentity = 'lane-a|state-b|1|1'; },
    (o) => { o.cohortIdentity = 'lane-a|state-a|2|1'; },
    (o) => { o.cohortIdentity = 'lane-a|state-a|1|2'; }
  ]) {
    const tracker = createSphPresentationCadenceTracker();
    tracker.observe(observeSphPresentation(workerSnapshot()));
    tracker.observe(observeSphPresentation(workerSnapshot({ timestampMs: 1000, sourceStep: 128, frameCount: 2 })));
    assert.equal(tracker.sample().presentedStatesPerSecond, 1);
    const changed = observeSphPresentation(workerSnapshot({ timestampMs: 2000 }));
    mutate(changed);
    tracker.observe(changed);
    assert.equal(tracker.sample().presentedStatesPerSecond, null);
    assert.equal(tracker.sample().presentationCadenceWindowMs, 0);
    tracker.observe({ ...changed, timestampMs: 3000 });
    assert.equal(tracker.sample().presentedStatesPerSecond, 0);
  }
  const tracker = createSphPresentationCadenceTracker();
  tracker.observe(observeSphPresentation(workerSnapshot()), 'preset-a|generation-1');
  tracker.observe(observeSphPresentation(workerSnapshot({ timestampMs: 1000 })), 'preset-a|generation-2');
  assert.equal(tracker.sample().presentedStatesPerSecond, null);
  tracker.reset('preset-changed');
  assert.equal(tracker.sample().presentationCadenceStatus, 'preset-changed');
});

test('regressing timestamp, source, framebuffer, or temporal serial invalidates the window', () => {
  for (const mutate of [
    (o) => { o.timestampMs = 999; },
    (o) => { o.sourceStep = 8; },
    (o) => { o.presentationSerial = 1; },
    (o) => { o.motionFrameSerial = 0; }
  ]) {
    const tracker = createSphPresentationCadenceTracker();
    tracker.observe(observeSphPresentation(workerSnapshot({ sourceStep: 9 })));
    const admittedMotion = observeSphPresentation(workerSnapshot({
      timestampMs: 1000, sourceStep: 9, frameCount: 2, motionSerial: 1
    }));
    tracker.observe(admittedMotion);
    assert.equal(tracker.sample().presentedStatesPerSecond, 1);
    const regressed = { ...admittedMotion, timestampMs: 2000 };
    mutate(regressed);
    tracker.observe(regressed);
    assert.equal(tracker.sample().presentationCadenceStatus, 'presentation-evidence-regressed');
    assert.equal(tracker.sample().presentedStatesPerSecond, null);
    assert.equal(tracker.sample().sourceStatesPerSecond, null);
    assert.equal(tracker.sample().visibleUpdatesPerSecond, null);
    tracker.observe({ ...admittedMotion, timestampMs: 3000 });
    assert.equal(tracker.sample().presentedStatesPerSecond, null, 'new baseline has no duration');
    tracker.observe({ ...admittedMotion, timestampMs: 4000 });
    assert.equal(tracker.sample().presentedStatesPerSecond, 0);
  }
});

test('changed source over a stalled framebuffer serial cannot yield a display rate', () => {
  const tracker = createSphPresentationCadenceTracker();
  tracker.observe(observeSphPresentation(workerSnapshot()));
  tracker.observe(observeSphPresentation(workerSnapshot({ timestampMs: 2000, sourceStep: 128 })));
  assert.equal(tracker.sample().presentationCadenceStatus, 'presentation-serial-stalled');
  assert.equal(tracker.sample().presentedStatesPerSecond, null);
  assert.equal(tracker.sample().sourceStatesPerSecond, null);
  assert.equal(tracker.sample().visibleUpdatesPerSecond, null);
});

test('dashboard integration distinguishes 120 callbacks, 64 steps, and 0.5 presented states per second', () => {
  const tracker = createSphPresentationCadenceTracker();
  tracker.observe(observeSphPresentation(workerSnapshot()));
  const counters = {
    renderFrames: 0, physicsFrames: 0, residentFrames: 0,
    lastSampleMs: 0, lastSimulationSampleTimeS: 0
  };
  let simulationTimeS = 0;
  for (let i = 1; i <= 480; i += 1) {
    if (i % 120 === 0) {
      counters.physicsFrames += 64;
      counters.residentFrames += 64;
      simulationTimeS += 0.064;
    }
    const timestampMs = i * 1000 / 120;
    const snapshot = workerSnapshot({
      timestampMs, sourceStep: Math.floor(i / 240) * 128,
      frameCount: Math.floor(i / 240) + 1
    });
    sampleSphDashboardFrameCounters({
      frameCounters: counters, presentationTracker: tracker,
      observation: readVisiblePresentationObservation(timestampMs, fakeDashboardDom(snapshot)),
      simulationTimeS
    });
  }
  assert.equal(counters.uiCallbacksPerSecond, 120);
  assert.equal(counters.physicsStepsPerSecond, 64);
  assert.equal(counters.residentStepsPerSecond, 64);
  assert.equal(counters.presentedStatesPerSecond, 0.5);
  assert.equal(counters.sourceStatesPerSecond, 0.5);
  assert.equal(counters.visibleUpdatesPerSecond, null);
  assert.equal(counters.visibleMotionCadenceVerified, false);
  assert.equal(counters.measurementSemantics, 'admitted-render-input-transitions-not-pixel-motion');
  assert.equal(counters.simulatedSecondsPerWallSecond, 0.064);
  assert.equal(sphDashboardCadenceText(counters),
    'visible unavailable updates/s | presented 0.5 states/s | source 0.5 states/s | ui raf 120.0 callbacks/s | physics 64.0 steps/s | resident 64.0 steps/s | sim speed 0.064 sim s/wall s');
  assert.equal(counters.renderFps, counters.uiCallbacksPerSecond);
  assert.equal(counters.physicsFps, counters.physicsStepsPerSecond);
  assert.equal(counters.residentFps, counters.residentStepsPerSecond);
  assert.match(sphDashboardCadenceText(), /visible unavailable updates\/s/);
});

test('visibility lifecycle resets hidden time without any hidden rAF and cleans up on close', async () => {
  const tracker = createSphPresentationCadenceTracker();
  tracker.observe(observeSphPresentation(workerSnapshot()));
  tracker.observe(observeSphPresentation(workerSnapshot({ timestampMs: 1000, sourceStep: 64, frameCount: 2 })));
  const counters = {
    ...tracker.sample(),
    renderFrames: 120, physicsFrames: 64, residentFrames: 64,
    uiCallbacksPerSecond: 120, physicsStepsPerSecond: 64, residentStepsPerSecond: 64,
    simulatedSecondsPerWallSecond: 0.064,
    lastSampleMs: 1000, lastSimulationSampleTimeS: 0.064
  };
  const presentationDocument = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const page = new EventTarget();
  let nowMs = 2000;
  let resetCount = 0;
  const cleanup = installSphDashboardCadenceLifecycle({
    frameCounters: counters,
    presentationTracker: tracker,
    document: presentationDocument,
    page,
    now: () => nowMs,
    onReset: () => { resetCount += 1; }
  });
  presentationDocument.visibilityState = 'hidden';
  presentationDocument.dispatchEvent(new Event('visibilitychange'));
  assert.equal(counters.presentationCadenceStatus, 'presentation-visibilitychange-hidden');
  assert.equal(counters.presentedStatesPerSecond, null);
  assert.equal(counters.physicsStepsPerSecond, null);
  assert.equal(counters.residentStepsPerSecond, null);
  assert.equal(counters.simulatedSecondsPerWallSecond, null);
  page.dispatchEvent(new Event('pagehide'));
  assert.equal(counters.presentationCadenceStatus, 'presentation-pagehide-hidden');

  // GPU work may complete during a background interval containing ZERO rAFs.
  // Its steps and adopted simulation time must not enter a foreground window.
  counters.physicsFrames += 640;
  counters.residentFrames += 640;
  nowMs = 12000;
  page.dispatchEvent(new Event('pageshow'));
  assert.equal(counters.presentationCadenceStatus, 'presentation-pageshow-hidden');
  assert.equal(counters.physicsFrames, 0);
  assert.equal(counters.residentFrames, 0);
  presentationDocument.visibilityState = 'visible';
  presentationDocument.dispatchEvent(new Event('visibilitychange'));
  assert.equal(counters.lastSampleMs, 12000);
  assert.equal(counters.lastSimulationSampleTimeS, undefined);
  assert.equal(tracker.sample().presentationCadenceWindowMs, 0);
  assert.equal(tracker.sample().presentedStatesPerSecond, null);

  for (let i = 1; i <= 120; i += 1) {
    if (i === 120) {
      counters.physicsFrames += 64;
      counters.residentFrames += 64;
    }
    sampleSphDashboardFrameCounters({
      frameCounters: counters,
      presentationTracker: tracker,
      observation: observeSphPresentation(workerSnapshot({
        timestampMs: 12000 + i * 1000 / 120, sourceStep: 704, frameCount: 12
      })),
      simulationTimeS: i === 120 ? 100.064 : 100
    });
  }
  assert.equal(counters.uiCallbacksPerSecond, 120);
  assert.equal(counters.physicsStepsPerSecond, 64);
  assert.equal(counters.residentStepsPerSecond, 64);
  assert.ok(Math.abs(counters.simulatedSecondsPerWallSecond - 0.064) < 1e-10);
  assert.equal(counters.presentedStatesPerSecond, 0, 'hidden source transition is only the new baseline');
  assert.equal(counters.sourceStatesPerSecond, 0);
  assert.ok(counters.presentationCadenceWindowMs < 1000);
  assert.equal(resetCount, 4);

  cleanup();
  nowMs = 20000;
  presentationDocument.dispatchEvent(new Event('visibilitychange'));
  page.dispatchEvent(new Event('pagehide'));
  page.dispatchEvent(new Event('pageshow'));
  assert.equal(resetCount, 4);
  assert.equal(counters.lastSampleMs, 13000);
  const mount = await readFile(new URL('../src/visualization/sphPhaseDemoMount.js', import.meta.url), 'utf8');
  assert.match(mount, /const stopDashboardCadenceLifecycle = installSphDashboardCadenceLifecycle\(/);
  assert.match(mount, /function close\(\) \{[\s\S]*?stopDashboardCadenceLifecycle\(\);/);
});
