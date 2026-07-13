import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA,
  ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_DESCRIPTOR_SCHEMA
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  validateResidentStepsCommitDelta,
  validateResidentStepsCommittedWarmEntry
} from '../src/runtime/peercomputeResidentCommitBridge.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function residentDeltaWithSchroederAdoptedStorageDescriptor() {
  return {
    schema: ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
    taskId: 'ulg:test:resident-steps-schroeder-adopted-storage',
    scope: 'ulg-sph-resident-pass-dag',
    version: 4,
    timestamp: 123,
    payload: {
      schema: ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA,
      status: 'resident-steps-delta-ready',
      stateKey: 'ulg:test:sph-state-steps',
      backend: 'webgpu',
      readbackMode: 'no-full-readback',
      completedStepCount: 1,
      continuationAvailable: true,
      outputFamilies: [
        'sph-particle-state',
        'sph-thermo-phase',
        'mls-mpm-mechanics'
      ],
      gpuFence: {
        schema: 'peercompute.compute.gpu-fence-report.v0',
        status: 'queue-work-completed',
        method: 'queue.onSubmittedWorkDone',
        fenceSatisfied: true,
        required: true,
        laneId: 'ulg:test:sph-resident-steps',
        stateKey: 'ulg:test:sph-state-steps',
        retainedBufferRefs: [
          'sph-state-buffer',
          'sph-thermo-buffer',
          'mls-mpm-mechanics-buffer'
        ]
      },
      retainedBufferRefs: [
        'sph-state-buffer',
        'sph-thermo-buffer',
        'mls-mpm-mechanics-buffer'
      ],
      schroederParticleStorageContinuationAvailable: true,
      schroederParticleStorageStateManagerAdmissionRequired: true,
      schroederParticleStorageRawGpuBufferTransferDetected: false,
      schroederAdoptedParticleStorageDescriptor: {
        schema: ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_DESCRIPTOR_SCHEMA,
        status: 'schroeder-adopted-particle-storage-descriptor-ready',
        ready: true,
        copyMode: 'descriptor-only-no-raw-gpubuffer-transfer',
        rawGpuBufferTransferAllowed: false,
        rawGpuBufferTransferDetected: false,
        stateManagerAdmissionRequired: true,
        authoritativeStateMutation: true,
        authoritativeParticleCount: 4,
        retainedBufferRefs: [
          'sph-state-buffer',
          'sph-thermo-buffer',
          'mls-mpm-mechanics-buffer'
        ],
        retainedRefs: [
          { ref: 'sph-state-buffer', transferMode: 'descriptor-only-no-raw-gpubuffer-transfer' },
          { ref: 'sph-thermo-buffer', transferMode: 'descriptor-only-no-raw-gpubuffer-transfer' },
          { ref: 'mls-mpm-mechanics-buffer', transferMode: 'descriptor-only-no-raw-gpubuffer-transfer' }
        ]
      },
      finalStep: {
        schema: 'peercompute.ulg.mls-mpm-resident-step-sequence-summary.v0',
        stepIndex: 0,
        backend: 'webgpu',
        status: 'resident-step-webgpu-executed',
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        schroederParticleStorageAdopted: true,
        schroederParticleStorageAuthoritativeParticleCount: 4,
        nextParticleCount: 4
      },
      stepSummaries: []
    }
  };
}

test('resident commit bridge admits descriptor-only Schroeder adopted particle storage metadata', () => {
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  const admission = validateResidentStepsCommitDelta(delta);

  assert.equal(admission.accepted, true);
  assert.equal(admission.status, 'accepted');
  assert.equal(admission.schroederParticleStorageContinuationAvailable, true);
  assert.equal(admission.schroederAdoptedParticleStorageReady, true);
  assert.equal(
    admission.schroederAdoptedParticleStorageDescriptorStatus,
    'schroeder-adopted-particle-storage-descriptor-ready'
  );
  assert.equal(admission.schroederAdoptedParticleStorageAuthoritativeParticleCount, 4);
  assert.equal(admission.schroederParticleStorageStateManagerAdmissionRequired, true);
  assert.equal(admission.schroederParticleStorageRawGpuBufferTransferDetected, false);

  const warmEntry = {
    version: delta.version,
    ts: delta.timestamp,
    payload: clone(delta.payload)
  };
  const warmAdmission = validateResidentStepsCommittedWarmEntry(warmEntry, delta);
  assert.equal(warmAdmission.accepted, true);
  assert.equal(warmAdmission.status, 'committed');
  assert.equal(warmAdmission.schroederAdoptedParticleStorageAuthoritativeParticleCount, 4);
});

test('resident commit bridge rejects deferred cleanup mislabeled as a satisfied fence', () => {
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  delta.payload.gpuFence.status = 'queue-submitted-cleanup-deferred';
  delta.payload.gpuFence.method = 'deferred queue.onSubmittedWorkDone cleanup';
  delta.payload.gpuFence.fenceSatisfied = true;

  const admission = validateResidentStepsCommitDelta(delta);

  assert.equal(admission.accepted, false);
  assert.equal(admission.reason, 'gpu-fence-status-not-completed');
  assert.ok(admission.issues.includes('gpu-fence-status-not-completed'));
});

test('resident commit bridge rejects a completed status without the completion method', () => {
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  delta.payload.gpuFence.method = 'resident-step-retained-webgpu-chain';

  const admission = validateResidentStepsCommitDelta(delta);

  assert.equal(admission.accepted, false);
  assert.equal(admission.reason, 'gpu-fence-completion-method-invalid');
  assert.ok(admission.issues.includes('gpu-fence-completion-method-invalid'));
});

test('resident commit bridge rejects Schroeder adopted storage descriptors with raw GPUBuffer transfer', () => {
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  delta.payload.schroederParticleStorageRawGpuBufferTransferDetected = true;
  delta.payload.schroederAdoptedParticleStorageDescriptor.rawGpuBufferTransferDetected = true;

  const admission = validateResidentStepsCommitDelta(delta);
  assert.equal(admission.accepted, false);
  assert.equal(admission.reason, 'schroeder-particle-storage-raw-gpubuffer-transfer-detected');
  assert.equal(admission.schroederParticleStorageRawGpuBufferTransferDetected, true);
});
