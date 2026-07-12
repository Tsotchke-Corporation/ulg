import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MLS_MPM_RESIDENT_COMPUTE_TASK_MAX_IN_FLIGHT_SUBMISSIONS,
  MLS_MPM_RESIDENT_COMPUTE_TASK_QUEUE_FENCE_POLICY_LEGACY,
  MLS_MPM_RESIDENT_COMPUTE_TASK_QUEUE_FENCE_POLICY_SAME_DEVICE_ORDERED,
  acquireMlsMpmResidentComputeQueuePacingSlot,
  awaitResidentComputeTaskQueueFence,
  registerMlsMpmResidentComputeQueueSubmission,
  validateMlsMpmResidentSameDeviceQueueOrderContext
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import { webGpuDeviceId } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function controlledDevice() {
  const completions = [];
  let observerCallCount = 0;
  return {
    completions,
    get observerCallCount() {
      return observerCallCount;
    },
    queue: {
      onSubmittedWorkDone() {
        observerCallCount += 1;
        const completion = deferred();
        completions.push(completion);
        return completion.promise;
      }
    }
  };
}

function sameDeviceContext(device, {
  taskId = 'ulg:test:resident-queue-order',
  laneId = 'ulg:test:resident-queue-lane',
  stateKey = 'ulg:test:resident-queue-state',
  localExecution = 'inline',
  compactSummaryMode = 'none',
  expectedDeviceId = webGpuDeviceId(device),
  measureGpuTimestamps = false
} = {}) {
  const sourceFamily = 'sph-particle-state';
  const requirement = {
    required: true,
    queueFencePolicy:
      MLS_MPM_RESIDENT_COMPUTE_TASK_QUEUE_FENCE_POLICY_SAME_DEVICE_ORDERED,
    laneId,
    stateKey,
    sourceFamily,
    deviceId: expectedDeviceId,
    localExecution
  };
  const gpuResidentLane = {
    localExecution,
    laneId,
    stateKey,
    sourceFamily,
    deviceId: expectedDeviceId
  };
  const gpuResidentLaneLeaseIdentity = {
    schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
    authoritative: true,
    leaseId: `${taskId}:lease`,
    laneId,
    stateKey,
    sourceFamily,
    taskId
  };
  const admission = validateMlsMpmResidentSameDeviceQueueOrderContext({
    requirement,
    gpuResidentLane,
    gpuResidentLaneLeaseIdentity,
    device,
    computeTaskId: taskId,
    readbackMode: 'no-full-readback',
    compactSummaryMode,
    measureGpuTimestamps,
    residentNeighborhoodMaxInFlightSubmissions:
      MLS_MPM_RESIDENT_COMPUTE_TASK_MAX_IN_FLIGHT_SUBMISSIONS
  });
  return {
    taskId,
    requirement,
    gpuResidentLane,
    gpuResidentLaneLeaseIdentity,
    admission
  };
}

function orderedExecution() {
  return {
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    normalHotLoopReadbackFree: true,
    fusedResidentSequence: {
      residentNeighborhoodLane: {
        orderedReuseWindow: true,
        maxInFlightSubmissions:
          MLS_MPM_RESIDENT_COMPUTE_TASK_MAX_IN_FLIGHT_SUBMISSIONS,
        inFlightSubmissionCountAtAcquire: 1
      }
    }
  };
}

test('same-device ordered fence returns without awaiting queue completion', async () => {
  const device = controlledDevice();
  const context = sameDeviceContext(device);
  assert.equal(context.admission.admitted, true);
  const pacing = await acquireMlsMpmResidentComputeQueuePacingSlot({
    device,
    admission: context.admission
  });
  const fence = await awaitResidentComputeTaskQueueFence(
    orderedExecution(),
    context.requirement,
    device,
    {
      gpuResidentLane: context.gpuResidentLane,
      gpuResidentLaneLeaseIdentity: context.gpuResidentLaneLeaseIdentity,
      computeTaskId: context.taskId,
      pacingAdmission: context.admission,
      pacing
    }
  );

  assert.equal(fence.status, 'ordered-before-consumer-queue-completed');
  assert.equal(fence.method, 'same-device-queue-order');
  assert.equal(fence.fenceSatisfied, true);
  assert.equal(fence.completed, false);
  assert.equal(fence.queueCompletionObserved, false);
  assert.equal(fence.pacing.capacity, 2);
  assert.equal(fence.pacing.pendingAfterSubmission, 1);
  await Promise.resolve();
  assert.equal(device.observerCallCount, 1);
  assert.equal(fence.pacing.settlementStatus, 'pending');
  device.completions[0].resolve();
  await Promise.resolve();
  await Promise.resolve();
});

test('same-device queue window admits two and makes the third wait for the oldest', async () => {
  const device = controlledDevice();
  const { admission } = sameDeviceContext(device, { taskId: 'ulg:test:queue-window' });
  const first = await acquireMlsMpmResidentComputeQueuePacingSlot({ device, admission });
  registerMlsMpmResidentComputeQueueSubmission({ device, pacing: first });
  const second = await acquireMlsMpmResidentComputeQueuePacingSlot({ device, admission });
  registerMlsMpmResidentComputeQueueSubmission({ device, pacing: second });
  await Promise.resolve();

  assert.equal(first.pendingAfterSubmission, 1);
  assert.equal(second.pendingAfterSubmission, 2);
  assert.equal(second.peakPendingSubmissionCount, 2);
  let thirdAdmitted = false;
  const thirdPromise = acquireMlsMpmResidentComputeQueuePacingSlot({ device, admission })
    .then((slot) => {
      thirdAdmitted = true;
      return slot;
    });
  await Promise.resolve();
  assert.equal(thirdAdmitted, false);

  device.completions[0].resolve();
  const third = await thirdPromise;
  assert.equal(third.waitedForOldestSubmission, true);
  assert.equal(third.oldestSettlementStatus, 'queue-work-completed');
  assert.equal(third.pendingAfterBackpressure, 1);
  assert.equal(third.backpressureWaitCount, 1);
  device.completions[1].resolve();
  await Promise.resolve();
  await Promise.resolve();
});

test('legacy resident compute fence still awaits queue completion', async () => {
  const completion = deferred();
  let observerCallCount = 0;
  const device = {
    queue: {
      onSubmittedWorkDone() {
        observerCallCount += 1;
        return completion.promise;
      }
    }
  };
  let fenceResolved = false;
  const fencePromise = awaitResidentComputeTaskQueueFence(
    { backend: 'webgpu', readbackMode: 'no-full-readback' },
    {
      required: true,
      queueFencePolicy: MLS_MPM_RESIDENT_COMPUTE_TASK_QUEUE_FENCE_POLICY_LEGACY
    },
    device
  ).then((fence) => {
    fenceResolved = true;
    return fence;
  });
  await Promise.resolve();
  assert.equal(observerCallCount, 1);
  assert.equal(fenceResolved, false);
  completion.resolve();
  const fence = await fencePromise;
  assert.equal(fence.status, 'queue-work-completed');
  assert.equal(fence.completed, true);
});

test('same-device ordered policy fails closed for device, worker, and diagnostic mismatches', () => {
  const sourceDevice = controlledDevice();
  const otherDevice = controlledDevice();
  const differentDevice = sameDeviceContext(otherDevice, {
    expectedDeviceId: webGpuDeviceId(sourceDevice)
  }).admission;
  assert.equal(differentDevice.admitted, false);
  assert.ok(differentDevice.blockers.includes('same-device-ordered-policy-device-id-mismatch'));

  const worker = sameDeviceContext(controlledDevice(), {
    localExecution: 'worker'
  }).admission;
  assert.equal(worker.admitted, false);
  assert.ok(worker.blockers.includes('same-device-ordered-policy-requires-inline-execution'));

  const diagnostic = sameDeviceContext(controlledDevice(), {
    compactSummaryMode: 'final-only',
    measureGpuTimestamps: true
  }).admission;
  assert.equal(diagnostic.admitted, false);
  assert.ok(diagnostic.blockers.includes(
    'same-device-ordered-policy-rejects-compact-summary-diagnostics'
  ));
  assert.ok(diagnostic.blockers.includes(
    'same-device-ordered-policy-rejects-gpu-timestamp-diagnostics'
  ));
});
