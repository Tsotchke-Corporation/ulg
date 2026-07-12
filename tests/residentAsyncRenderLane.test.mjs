import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  acquireResidentExecutionConsumerLease,
  createLatestWinsAsyncLane,
  createResidentRenderSourceSubmissionGate,
  deferResidentExecutionCleanupUntilConsumersRelease,
  residentExecutionConsumerLeaseState
} from '../src/runtime/residentAsyncRenderLane.js';
import {
  residentNativePresentationBackpressureDecision,
  residentRenderEnqueueAdmission,
  residentRenderSourceAuthorityAdmission,
  residentRenderPublicationAdmission
} from '../src/visualization/sphPhaseDemoMount.js';
import {
  SPH_RESIDENT_RENDER_COMMIT_STALE_ERROR_CODE,
  assertSphResidentRenderCommitCurrent
} from '../src/visualization/sphPhaseScene.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test('render source submission gate settles once at command submission', async () => {
  const gate = createResidentRenderSourceSubmissionGate();
  const evidence = {
    status: 'resident-render-source-consumers-command-submitted'
  };
  assert.equal(gate.settled, false);
  assert.equal(gate.publish(evidence), true);
  assert.equal(gate.publish({ status: 'late-render-settlement' }), false);
  assert.equal(await gate.promise, evidence);
  assert.equal(gate.settled, true);
});

test('latest-wins render lane invalidates an active cadence request and retains only the newest pending request', async () => {
  const gates = new Map();
  const calls = [];
  const publications = [];
  const releases = [];
  let activeCount = 0;
  let maxActiveCount = 0;
  const lane = createLatestWinsAsyncLane({
    async execute(request) {
      calls.push(request.id);
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);
      await gates.get(request.id).promise;
      activeCount -= 1;
      return { id: request.id };
    },
    onSuccess(value) {
      publications.push(value.id);
    }
  });
  for (const id of [1, 2, 3]) gates.set(id, deferred());

  const first = lane.enqueue({ id: 1, release: (reason) => releases.push([1, reason]) });
  await flushMicrotasks();
  const second = lane.enqueue({ id: 2, release: (reason) => releases.push([2, reason]) });
  const third = lane.enqueue({ id: 3, release: (reason) => releases.push([3, reason]) });

  const secondResult = await second;
  assert.equal(secondResult.status, 'resident-async-render-pending-superseded');
  assert.deepEqual(calls, [1]);
  assert.equal(maxActiveCount, 1);
  assert.equal(lane.getState().pending, true);

  gates.get(1).resolve();
  const firstResult = await first;
  await flushMicrotasks();
  assert.deepEqual(calls, [1, 3]);
  gates.get(3).resolve();
  await third;

  assert.equal(firstResult.status, 'resident-async-render-active-superseded');
  assert.equal(firstResult.supersededBySequence, 3);
  assert.deepEqual(publications, [3]);
  assert.equal(maxActiveCount, 1);
  assert.deepEqual(releases.map(([id]) => id).sort(), [1, 2, 3]);
  assert.equal(lane.getState().active, false);
  assert.equal(lane.getState().pending, false);
});

test('required active render transfers its visibility obligation to the newest request', async () => {
  const activeGate = deferred();
  const calls = [];
  const publications = [];
  const lane = createLatestWinsAsyncLane({
    async execute(request) {
      calls.push(request.id);
      if (request.id === 'required') await activeGate.promise;
      return request.id;
    },
    onSuccess(value) {
      publications.push(value);
    }
  });

  const required = lane.enqueue({ id: 'required', requiredVisible: true });
  await flushMicrotasks();
  const cadence = lane.enqueue({ id: 'cadence' });

  assert.equal(lane.getState().activeSuperseded, true);
  activeGate.resolve();
  const requiredResult = await required;
  const cadenceResult = await cadence;

  assert.equal(requiredResult.status, 'resident-async-render-active-superseded');
  assert.equal(cadenceResult.status, 'resident-async-render-published');
  assert.deepEqual(calls, ['required', 'cadence']);
  assert.deepEqual(publications, ['cadence']);
});

test('latest pending source inherits a superseded forced visibility requirement', async () => {
  const firstGate = deferred();
  const executed = [];
  const lane = createLatestWinsAsyncLane({
    async execute(request) {
      executed.push({
        id: request.id,
        requiredVisible: request.requiredVisible === true,
        inheritedRequiredVisible: request.inheritedRequiredVisible === true
      });
      if (request.id === 'active') await firstGate.promise;
      return request.id;
    }
  });

  const active = lane.enqueue({ id: 'active' });
  await flushMicrotasks();
  const forced = lane.enqueue({
    id: 'forced-pending',
    requiredVisible: true,
    requiredReason: 'initial-visible-frame'
  });
  const latest = lane.enqueue({ id: 'latest-source' });

  const forcedResult = await forced;
  assert.equal(forcedResult.status, 'resident-async-render-pending-superseded');
  firstGate.resolve();
  await active;
  await latest;

  assert.deepEqual(executed, [
    { id: 'active', requiredVisible: false, inheritedRequiredVisible: false },
    { id: 'latest-source', requiredVisible: true, inheritedRequiredVisible: true }
  ]);
});

test('render errors remain lane telemetry and do not prevent the latest request from running', async () => {
  const errors = [];
  const publications = [];
  const lane = createLatestWinsAsyncLane({
    async execute(request) {
      if (request.id === 'bad') throw new Error('surface refresh failed');
      return request.id;
    },
    onError(error) {
      errors.push(error.message);
    },
    onSuccess(value) {
      publications.push(value);
    }
  });

  const failed = lane.enqueue({ id: 'bad', requiredVisible: true });
  const failedResult = await failed;
  const recovered = lane.enqueue({ id: 'good' });
  const recoveredResult = await recovered;

  assert.equal(failedResult.status, 'resident-async-render-error');
  assert.equal(recoveredResult.status, 'resident-async-render-published');
  assert.deepEqual(errors, ['surface refresh failed']);
  assert.deepEqual(publications, ['good']);
});

test('a slow render lane does not block physics progress and coalesces visual requests', async () => {
  const renderGate = deferred();
  const executed = [];
  const lane = createLatestWinsAsyncLane({
    async execute(request) {
      executed.push(request.physicsStep);
      if (request.physicsStep === 1) await renderGate.promise;
      return request.physicsStep;
    }
  });

  let physicsStep = 1;
  const firstRender = lane.enqueue({ physicsStep });
  await flushMicrotasks();
  const pendingCompletions = [];
  for (physicsStep = 2; physicsStep <= 8; physicsStep += 1) {
    pendingCompletions.push(lane.enqueue({ physicsStep }));
  }

  assert.equal(physicsStep, 9);
  assert.deepEqual(executed, [1]);
  assert.equal(lane.getState().pending, true);
  renderGate.resolve();
  await firstRender;
  await Promise.all(pendingCompletions);
  assert.deepEqual(executed, [1, 8]);
});

test('resident execution cleanup waits for every async render consumer lease', () => {
  const execution = {};
  const firstLease = acquireResidentExecutionConsumerLease(execution, { consumer: 'render-a' });
  const secondLease = acquireResidentExecutionConsumerLease(execution, { consumer: 'render-b' });
  let cleanupCount = 0;

  const disposition = deferResidentExecutionCleanupUntilConsumersRelease(
    execution,
    () => { cleanupCount += 1; }
  );
  assert.equal(disposition.deferred, true);
  assert.deepEqual(residentExecutionConsumerLeaseState(execution), {
    schema: 'peercompute.ulg.resident-execution-consumer-lease.v0',
    status: 'resident-execution-consumer-lease-state-ready',
    activeLeaseCount: 2,
    deferredCleanupCount: 1
  });

  firstLease.release('first-render-finished');
  assert.equal(cleanupCount, 0);
  secondLease.release('second-render-finished');
  assert.equal(cleanupCount, 1);
  assert.equal(residentExecutionConsumerLeaseState(execution).activeLeaseCount, 0);
  assert.equal(residentExecutionConsumerLeaseState(execution).deferredCleanupCount, 0);
});

test('render publication admits bounded lag while physics advances independently', () => {
  const admission = residentRenderPublicationAdmission({
    connected: true,
    requestGeneration: 4,
    currentGeneration: 4,
    requestedMode: 'native-webgpu-surface-consumer',
    currentMode: 'native-webgpu-surface-consumer',
    requestStillCurrent: true,
    sceneIdentityMatches: true,
    presentedSourceSnapshot: {
      residentExecutionGeneration: 9,
      nextStep: 10
    },
    sourceSnapshot: {
      residentExecutionGeneration: 9,
      nextStep: 12
    },
    renderState: {
      status: 'resident-render-field-applied',
      sourceResidentExecutionGeneration: 9,
      sourceResidentNextStep: 12
    }
  });

  assert.equal(admission.accepted, true);
  assert.equal(admission.sourceAheadOfPresentedState, true);
  assert.equal(admission.expectedNextStep, 12);
  assert.equal(admission.actualNextStep, 12);
});

test('render admission rejects visible regression, wrong scene, and result-source mismatch', () => {
  const admission = residentRenderPublicationAdmission({
    connected: true,
    requestGeneration: 4,
    currentGeneration: 4,
    requestedMode: 'native-webgpu-surface-consumer',
    currentMode: 'native-webgpu-surface-consumer',
    requestStillCurrent: true,
    sceneIdentityMatches: false,
    presentedSourceSnapshot: {
      residentExecutionGeneration: 8,
      nextStep: 21
    },
    sourceSnapshot: {
      residentExecutionGeneration: 8,
      nextStep: 20
    },
    renderState: {
      status: 'resident-render-field-applied',
      sourceResidentExecutionGeneration: 8,
      sourceResidentNextStep: 22
    }
  });

  assert.equal(admission.accepted, false);
  assert.deepEqual(admission.issues, [
    'render-scene-identity-stale',
    'resident-visible-source-step-regression',
    'resident-render-source-step-mismatch'
  ]);
});

test('render source authority ignores newer physics and rejects only presentation regression', () => {
  const admitted = residentRenderSourceAuthorityAdmission({
    connected: true,
    requestGeneration: 5,
    currentGeneration: 5,
    requestedMode: 'native-webgpu-surface-consumer',
    currentMode: 'native-webgpu-surface-consumer',
    sceneIdentityMatches: true,
    sourceSnapshot: { residentExecutionGeneration: 3, nextStep: 40 },
    presentedSourceSnapshot: { residentExecutionGeneration: 3, nextStep: 35 }
  });
  const rejected = residentRenderSourceAuthorityAdmission({
    connected: true,
    requestGeneration: 5,
    currentGeneration: 5,
    requestedMode: 'native-webgpu-surface-consumer',
    currentMode: 'native-webgpu-surface-consumer',
    sceneIdentityMatches: true,
    sourceSnapshot: { residentExecutionGeneration: 3, nextStep: 34 },
    presentedSourceSnapshot: { residentExecutionGeneration: 3, nextStep: 35 }
  });

  assert.equal(admitted.accepted, true);
  assert.equal(rejected.accepted, false);
  assert.deepEqual(rejected.issues, ['resident-visible-source-step-regression']);
});

test('resident render commit authority rejects a lane-superseded cadence request', async () => {
  const activeGate = deferred();
  const publications = [];
  const discarded = [];
  const lane = createLatestWinsAsyncLane({
    async execute(request) {
      if (request.id === 'stale') await activeGate.promise;
      const admission = residentRenderSourceAuthorityAdmission({
        connected: true,
        requestGeneration: 5,
        currentGeneration: 5,
        requestedMode: 'native-webgpu-surface-consumer',
        currentMode: 'native-webgpu-surface-consumer',
        sceneIdentityMatches: true,
        requestStillCurrent: request.laneSuperseded !== true,
        sourceSnapshot: { residentExecutionGeneration: 3, nextStep: request.step },
        presentedSourceSnapshot: { residentExecutionGeneration: 3, nextStep: 35 }
      });
      if (!admission.accepted) throw new Error(admission.issues[0]);
      return request.id;
    },
    onSuccess(value) {
      publications.push(value);
    },
    onDiscardedResult(value, request) {
      discarded.push(request.id);
    }
  });

  const stale = lane.enqueue({ id: 'stale', step: 36 });
  await flushMicrotasks();
  const latest = lane.enqueue({ id: 'latest', step: 37 });
  activeGate.resolve();

  const staleResult = await stale;
  const latestResult = await latest;
  assert.equal(staleResult.status, 'resident-async-render-active-superseded');
  assert.equal(latestResult.status, 'resident-async-render-published');
  assert.deepEqual(publications, ['latest']);
  assert.deepEqual(discarded, ['stale']);
});

test('render enqueue remains blocked for reset, drain, and the complete scene mutation window', () => {
  assert.equal(residentRenderEnqueueAdmission().accepted, true);
  assert.deepEqual(residentRenderEnqueueAdmission({
    resetRebuildPending: true,
    sceneMutationBarrierPending: true,
    sceneMutationCount: 1
  }).issues, [
    'resident-reset-rebuild-pending',
    'resident-render-scene-mutation-barrier-active',
    'resident-render-scene-mutation-active'
  ]);
  assert.equal(residentRenderEnqueueAdmission({ sceneMutationCount: 1 }).accepted, false);
});

test('native presentation backpressure gates due refreshes without requiring readback', () => {
  const due = residentNativePresentationBackpressureDecision({
    nativeSurfaceConsumer: true,
    cadenceDue: true,
    renderRefreshScheduled: true
  });
  const forced = residentNativePresentationBackpressureDecision({
    nativeSurfaceConsumer: true,
    requiredVisible: true,
    renderRefreshScheduled: true
  });
  const skippedCadence = residentNativePresentationBackpressureDecision({
    nativeSurfaceConsumer: true,
    cadenceDue: false,
    renderRefreshScheduled: false
  });
  const nonNative = residentNativePresentationBackpressureDecision({
    nativeSurfaceConsumer: false,
    cadenceDue: true,
    renderRefreshScheduled: true
  });

  assert.equal(due.required, true);
  assert.equal(forced.required, true);
  assert.equal(due.maxComputeSubmissionsAheadOfPresentation, 1);
  assert.equal(due.readbackRequired, false);
  assert.equal(skippedCadence.required, false);
  assert.equal(nonNative.required, false);
});

test('scene render commit guard fails closed before stale resources can swap', () => {
  assert.doesNotThrow(() => assertSphResidentRenderCommitCurrent(
    () => ({ accepted: true }),
    { stage: 'native-bridge-commit' }
  ));
  assert.throws(
    () => assertSphResidentRenderCommitCurrent(
      () => ({ accepted: false, reason: 'generation-changed' }),
      { stage: 'native-bridge-commit' }
    ),
    (error) => (
      error.code === SPH_RESIDENT_RENDER_COMMIT_STALE_ERROR_CODE
      && error.stage === 'native-bridge-commit'
      && error.admission?.reason === 'generation-changed'
    )
  );
});

test('lane close drops pending work and becomes idle after the active request settles', async () => {
  const activeGate = deferred();
  const releases = [];
  const lane = createLatestWinsAsyncLane({
    async execute(request) {
      if (request.id === 'active') await activeGate.promise;
      return request.id;
    }
  });
  const active = lane.enqueue({
    id: 'active',
    release: (reason) => releases.push(['active', reason])
  });
  await flushMicrotasks();
  const pending = lane.enqueue({
    id: 'pending',
    release: (reason) => releases.push(['pending', reason])
  });
  lane.close('test-close');
  const pendingResult = await pending;
  assert.equal(pendingResult.status, 'resident-async-render-pending-discarded-on-close');

  let idleResolved = false;
  const idle = lane.whenIdle().then(() => { idleResolved = true; });
  await flushMicrotasks();
  assert.equal(idleResolved, false);
  activeGate.resolve();
  await active;
  await idle;
  assert.equal(idleResolved, true);
  assert.deepEqual(releases.map(([id]) => id).sort(), ['active', 'pending']);
});

test('resident scheduler enqueues surface refresh outside the physics in-flight promise', async () => {
  const mountSource = await readFile(
    new URL('../src/visualization/sphPhaseDemoMount.js', import.meta.url),
    'utf8'
  );
  const sceneSource = await readFile(
    new URL('../src/visualization/sphPhaseScene.js', import.meta.url),
    'utf8'
  );
  const schedulerStart = mountSource.indexOf('function scheduleMlsMpmResidentSteps');
  const schedulerEnd = mountSource.indexOf('async function refreshResidentRenderForCurrentMode', schedulerStart);
  const schedulerSource = mountSource.slice(schedulerStart, schedulerEnd);
  const residentStepStart = sceneSource.indexOf('async function refreshMlsMpmResidentStep');
  const residentStepsStart = sceneSource.indexOf('async function refreshMlsMpmResidentSteps');
  const residentRenderStart = sceneSource.indexOf('async function refreshSphResidentRenderState');
  const residentStepSource = sceneSource.slice(residentStepStart, residentStepsStart);
  const residentStepsSource = sceneSource.slice(residentStepsStart, residentRenderStart);

  assert.ok(schedulerStart >= 0 && schedulerEnd > schedulerStart);
  assert.match(schedulerSource, /enqueueResidentRenderRefresh\(\{/);
  assert.doesNotMatch(schedulerSource, /await\s+scene\.refreshSphResidentRenderState/);
  assert.match(
    schedulerSource,
    /residentExecutionInFlight\s*=\s*false;[\s\S]*?physics-flight-released[\s\S]*?requestAnimationFrame/
  );
  assert.match(
    sceneSource,
    /deferResidentExecutionCleanupUntilConsumersRelease\(\s*captured\.residentSteps,\s*scheduleCleanup/
  );
  assert.match(
    sceneSource,
    /scheduleCleanup[\s\S]*?deferSubmittedWorkCleanup\(deferDevice, cleanup\)/
  );
  assert.match(mountSource, /refreshOptions\.renderCommitGuard\s*=/);
  assert.doesNotMatch(
    residentStepSource,
    /await\s+awaitResidentSurfaceDrawSubmitFence/,
    'normal single-step physics must not wait for native surface queue idle'
  );
  assert.doesNotMatch(
    residentStepsSource,
    /await\s+awaitResidentSurfaceDrawSubmitFence/,
    'normal batched physics must not wait for native surface queue idle'
  );
  assert.match(
    residentStepsSource,
    /normal-physics-does-not-await-surface-draw-submit-fence/
  );
  assert.match(
    mountSource,
    /const normalizedStepCount = pressureSourceCadenceRequired \? 1 : requestedStepCount/
  );
  assert.match(
    schedulerSource,
    /residentNativePresentationBackpressureDecision\(\{[\s\S]*?selectedNativeSurfaceConsumerRefresh[\s\S]*?cadence\.due/
  );
  assert.match(
    schedulerSource,
    /residentPresentationBackpressureBarriers[\s\S]*?whenIdle[\s\S]*?native-presentation-backpressure-settled[\s\S]*?scheduleNextResidentFlight/
  );
  assert.match(
    schedulerSource,
    /if \(residentPresentationBackpressurePending\)[\s\S]*?physics-schedule-deferred-native-presentation-backpressure[\s\S]*?return;/
  );
  assert.match(
    sceneSource,
    /extension-surface-resource-owner-commit[\s\S]*?installSphNativeWebGpuSurfaceResourceOwner/
  );
  assert.match(
    sceneSource,
    /native-surface-bridge-reuse-commit[\s\S]*?Object\.assign\(previousBridge/
  );
  assert.match(
    sceneSource,
    /surface-draw-proxy-backend-selection-commit[\s\S]*?scene\.userData\.schroederRenderProxyBackendSelection/
  );
  assert.match(
    mountSource,
    /particleSyncGeneration \+= 1;[\s\S]*?beginResidentRenderLaneDrain\(reason\)/
  );
  assert.match(
    mountSource,
    /runAfterResidentRenderLaneDrain[\s\S]*?resetSceneForDimensionsNow/
  );
  assert.match(
    sceneSource,
    /SPH_RESIDENT_RENDER_COMMIT_STALE_ERROR_CODE\) throw error/
  );
});
