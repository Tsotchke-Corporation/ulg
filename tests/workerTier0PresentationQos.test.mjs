import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_SCHEMA,
  ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS,
  ULG_WORKER_TIER0_ISOSURFACE_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS,
  isExactWorkerIsosurfacePresentationQueueAttributionProof,
  isExactWorkerTier0PresentationQosBoundaryProof,
  workerTier0PresentationQosBoundaryFrameSerials
} from '../src/runtime/sph/sphWorkerPresentationQos.js';

const boundary = Object.freeze({
  submissionOrdinal: 1,
  completedSubstepCount: 2,
  totalSubstepCount: 7,
  chunkStepCount: 2
});

function fixture(isosurface = true) {
  const receipt = {
    schema: ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_SCHEMA,
    status: isosurface
      ? ULG_WORKER_TIER0_ISOSURFACE_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS
      : ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS,
    ...boundary,
    gpuCompleted: true,
    gpuCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    presentationOpportunity: true,
    presentationOpportunityMethod: 'worker-request-animation-frame-after-gpu-completion',
    queuePrefixCoveredPhysics: true,
    presentationQueueCompletionCount: 41,
    presentationQueueCompletionSerial: 41,
    presentationQueueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    presentationQueueCompletionScope: 'worker-offscreen-shared-device-queue-frame-proof',
    physicsQueuePrefixCoverage: 'physics-queue-prefix-included',
    physicsContinuationBlocked: true,
    presentationQosHostQueueFenceCount: 1,
    motionPresentationQosBoundary: { ...boundary }
  };
  if (!isosurface) return { ...receipt, motionFrameSubmittedSerial: 17, motionFrameSerial: 16 };
  receipt.isosurfaceFrameProof = {
    presentationFrameSchema: 'peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0',
    presentationFrameStatus: 'worker-owned-isosurface-presentation-opportunity',
    presentationFrameAdmitted: true,
    isosurfaceTemporalPresentation: true,
    isosurfacePresentationMotionMethod: 'bounded-gpu-field-velocity-extrapolation',
    isosurfacePresentationMotionAgeS: 0.001,
    isosurfacePresentationSourceTimeS: 0.016,
    presentationOnly: true,
    authoritativeStateMutation: false,
    presentationFrameGpuCompleted: receipt.gpuCompleted,
    presentationFrameGpuCompletionMethod: receipt.gpuCompletionMethod,
    presentationFramePresentationOpportunity: receipt.presentationOpportunity,
    presentationFramePresentationOpportunityMethod: receipt.presentationOpportunityMethod,
    presentationQueueCompletionCount: receipt.presentationQueueCompletionCount,
    presentationQueueCompletionSerial: receipt.presentationQueueCompletionSerial,
    presentationQueueCompletionMethod: receipt.presentationQueueCompletionMethod,
    presentationQueueCompletionScope: receipt.presentationQueueCompletionScope,
    physicsQueuePrefixCoverage: receipt.physicsQueuePrefixCoverage,
    physicsHostQueueFenceParticipation: true,
    physicsContinuationBlocked: true,
    presentationQosHostQueueFenceCount: 1,
    motionPresentationQosBoundary: { ...boundary }
  };
  return receipt;
}

test('Tier0 isosurface boundary proof uses its own completed mesh identity, not particle serials', () => {
  const receipt = fixture();
  assert.equal(isExactWorkerTier0PresentationQosBoundaryProof(receipt, boundary), true);
  assert.deepEqual(workerTier0PresentationQosBoundaryFrameSerials(receipt), {
    submitted: 41, completed: 41
  });
  assert.equal(Object.hasOwn(receipt, 'motionFrameSerial'), false);
  const particle = fixture(false);
  assert.equal(isExactWorkerTier0PresentationQosBoundaryProof(particle, boundary), true);
  assert.deepEqual(workerTier0PresentationQosBoundaryFrameSerials(particle), {
    submitted: 17, completed: 16
  });
});

test('Tier0 isosurface proof rejects absent, source-only, wrong-geometry and uncompleted frames', () => {
  for (const override of [
    { presentationFrameSchema: 'peercompute.ulg.worker-offscreen-particle-temporal-motion-frame.v0' },
    { presentationFrameStatus: 'submitted' },
    { presentationFrameAdmitted: false },
    { isosurfaceTemporalPresentation: false },
    { isosurfacePresentationMotionMethod: 'committed-source-mesh' },
    { isosurfacePresentationMotionAgeS: 0 },
    { isosurfacePresentationMotionAgeS: NaN },
    { isosurfacePresentationMotionAgeS: Infinity },
    { isosurfacePresentationSourceTimeS: null },
    { presentationOnly: false },
    { authoritativeStateMutation: true },
    { presentationFrameGpuCompleted: false },
    { presentationFrameGpuCompletionMethod: 'submit-only' },
    { presentationFramePresentationOpportunity: false },
    { presentationFramePresentationOpportunityMethod: 'raf-before-gpu-completion' },
    { presentationQueueCompletionSerial: 40 },
    { presentationQueueCompletionMethod: 'submit-only' },
    { physicsQueuePrefixCoverage: 'physics-queue-prefix-not-attributed' },
    { physicsContinuationBlocked: false },
    { motionPresentationQosBoundary: null },
    { motionPresentationQosBoundary: { ...boundary, completedSubstepCount: 1 } },
    { presentationQosHostQueueFenceCount: 0 }
  ]) {
    const receipt = fixture();
    Object.assign(receipt.isosurfaceFrameProof, override);
    assert.equal(isExactWorkerTier0PresentationQosBoundaryProof(receipt, boundary), false,
      JSON.stringify(override));
  }
  for (const isosurfaceFrameProof of [null, false, undefined]) {
    assert.equal(isExactWorkerTier0PresentationQosBoundaryProof({
      ...fixture(), isosurfaceFrameProof
    }, boundary), false);
  }
});

test('Tier0 boundary metadata and shared queue/presentation proof remain exact for both geometries', () => {
  for (const isosurface of [false, true]) {
    for (const override of [
      { schema: 'not-a-boundary' },
      { status: 'unknown-geometry-boundary' },
      { submissionOrdinal: 2 },
      { completedSubstepCount: 4 },
      { totalSubstepCount: 8 },
      { chunkStepCount: 1 },
      { gpuCompleted: false },
      { presentationOpportunity: false },
      { queuePrefixCoveredPhysics: false },
      { presentationQueueCompletionCount: 40 },
      { presentationQueueCompletionSerial: 0 },
      { physicsQueuePrefixCoverage: 'physics-queue-prefix-not-attributed' },
      { physicsContinuationBlocked: false },
      { presentationQosHostQueueFenceCount: 0 }
    ]) {
      assert.equal(isExactWorkerTier0PresentationQosBoundaryProof({
        ...fixture(isosurface), ...override
      }, boundary), false, JSON.stringify({ isosurface, override }));
    }
  }
});

test('raw isosurface queue attribution accepts autonomous completion without inventing a physics boundary', () => {
  const autonomous = {
    ...fixture().isosurfaceFrameProof,
    physicsQueuePrefixCoverage: 'physics-queue-prefix-not-attributed',
    physicsHostQueueFenceParticipation: null
  };
  delete autonomous.physicsContinuationBlocked;
  delete autonomous.presentationQosHostQueueFenceCount;
  delete autonomous.motionPresentationQosBoundary;
  for (const physicsHostQueueFenceParticipation of [null, undefined, false]) {
    assert.equal(isExactWorkerIsosurfacePresentationQueueAttributionProof({
      ...autonomous, physicsHostQueueFenceParticipation
    }), true);
  }
  for (const override of [
    { physicsHostQueueFenceParticipation: true },
    { physicsHostQueueFenceParticipation: 'false' },
    { physicsContinuationBlocked: true },
    { presentationQosHostQueueFenceCount: 1 },
    { presentationQosHostQueueFenceCount: -1 },
    { presentationQueueCompletionSerial: 0 },
    { presentationQueueCompletionCount: 40 },
    { presentationQueueCompletionMethod: 'submit-only' },
    { physicsQueuePrefixCoverage: 'unknown' }
  ]) {
    assert.equal(isExactWorkerIsosurfacePresentationQueueAttributionProof({
      ...autonomous, ...override
    }), false, JSON.stringify(override));
  }
});

test('raw isosurface included-prefix attribution requires its actual bounded physics submission boundary', () => {
  const frame = fixture().isosurfaceFrameProof;
  assert.equal(isExactWorkerIsosurfacePresentationQueueAttributionProof(frame), true);
  for (const override of [
    { physicsHostQueueFenceParticipation: false },
    { physicsHostQueueFenceParticipation: null },
    { physicsContinuationBlocked: false },
    { presentationQosHostQueueFenceCount: 0 },
    { presentationQosHostQueueFenceCount: 2 },
    { motionPresentationQosBoundary: null }
  ]) {
    assert.equal(isExactWorkerIsosurfacePresentationQueueAttributionProof({
      ...frame, ...override
    }), false, JSON.stringify(override));
  }
  for (const override of [
    { submissionOrdinal: 0 },
    { submissionOrdinal: 1.5 },
    { submissionOrdinal: '1' },
    { submissionOrdinal: 3 },
    { completedSubstepCount: 0 },
    { completedSubstepCount: NaN },
    { totalSubstepCount: 2 },
    { totalSubstepCount: 1 },
    { totalSubstepCount: Infinity },
    { chunkStepCount: 0 },
    { chunkStepCount: 3 },
    { chunkStepCount: 1.5 }
  ]) {
    assert.equal(isExactWorkerIsosurfacePresentationQueueAttributionProof({
      ...frame, motionPresentationQosBoundary: { ...boundary, ...override }
    }), false, JSON.stringify(override));
  }
});

test('raw autonomous and included isosurface proofs reject numeric-string queue identities', () => {
  for (const included of [false, true]) {
    const frame = fixture().isosurfaceFrameProof;
    if (!included) {
      frame.physicsQueuePrefixCoverage = 'physics-queue-prefix-not-attributed';
      frame.physicsHostQueueFenceParticipation = null;
      delete frame.physicsContinuationBlocked;
      delete frame.presentationQosHostQueueFenceCount;
      delete frame.motionPresentationQosBoundary;
    }
    assert.equal(isExactWorkerIsosurfacePresentationQueueAttributionProof(frame), true);
    for (const fields of [
      ['presentationQueueCompletionCount'],
      ['presentationQueueCompletionSerial'],
      ['presentationQueueCompletionCount', 'presentationQueueCompletionSerial']
    ]) {
      const malformed = { ...frame };
      for (const field of fields) malformed[field] = String(malformed[field]);
      assert.equal(isExactWorkerIsosurfacePresentationQueueAttributionProof(malformed), false,
        JSON.stringify({ included, fields }));
    }
  }
});

test('isosurface boundary rejects numeric-string queue identities in nested proof, wrapper or both', () => {
  for (const targets of [['nested'], ['wrapper'], ['nested', 'wrapper']]) {
    for (const fields of [
      ['presentationQueueCompletionCount'],
      ['presentationQueueCompletionSerial'],
      ['presentationQueueCompletionCount', 'presentationQueueCompletionSerial']
    ]) {
      const receipt = fixture();
      for (const target of targets) {
        const proof = target === 'nested' ? receipt.isosurfaceFrameProof : receipt;
        for (const field of fields) proof[field] = String(proof[field]);
      }
      assert.equal(isExactWorkerTier0PresentationQosBoundaryProof(receipt, boundary), false,
        JSON.stringify({ targets, fields }));
    }
  }
  const particle = fixture(false);
  particle.presentationQueueCompletionCount = String(particle.presentationQueueCompletionCount);
  particle.presentationQueueCompletionSerial = String(particle.presentationQueueCompletionSerial);
  assert.equal(isExactWorkerTier0PresentationQosBoundaryProof(particle, boundary), true,
    'this isosurface hardening does not change existing particle proof compatibility');
});
