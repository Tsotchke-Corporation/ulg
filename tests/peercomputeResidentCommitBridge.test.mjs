import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA,
  ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_DESCRIPTOR_SCHEMA,
  MLS_MPM_RESIDENT_COMPUTE_TASK_QUEUE_FENCE_POLICY_SAME_DEVICE_ORDERED
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_TOKEN_SCHEMA
} from '../src/runtime/sph/schroederParticleStorageAdoptionGpu.js';
import {
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_MAGIC,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_VERSION,
  ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_SCHEMA
} from '../src/runtime/sph/schroederParticleStorageResidencyGpu.js';
import {
  createResidentStateManagerCommitHandler,
  createStateManagerCommittedResidentStepsDelta,
  promoteResidentStepsExecutionGpuAuthority,
  readResidentStepsCommittedWarmDelta,
  validateResidentStepsCommitDelta,
  validateResidentStepsCommittedWarmEntry
} from '../src/runtime/peercomputeResidentCommitBridge.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function residentDeltaWithSchroederAdoptedStorageDescriptor() {
  const delta = {
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
      normalHotLoopReadbackFree: true,
      gpuResidentAuthoritativeContinuationCandidate: true,
      gpuAuthorityAdmissionRequired: true,
      gpuAuthorityAdmissionSatisfied: false,
      gpuAuthorityStatus:
        'gpu-resident-continuation-candidate-awaiting-state-manager-commit',
      gpuAuthorityCandidateBlockers: [],
      gpuAuthoritativeState: false,
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
        gpuResidentAuthoritativeContinuationCandidate: true,
        gpuAuthorityAdmissionRequired: true,
        gpuAuthorityAdmissionSatisfied: false,
        gpuAuthorityStatus:
          'gpu-resident-continuation-candidate-awaiting-state-manager-commit',
        gpuAuthorityCandidateBlockers: [],
        gpuAuthoritativeState: false,
        schroederParticleStorageAdopted: true,
        schroederParticleStorageAuthoritativeParticleCount: 4,
        nextParticleCount: 4
      },
      stepSummaries: []
    }
  };
  const residentSequenceLaneContract = {
    schema: 'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0',
    authority: 'compute-manager-gpuhub-resident-lane-contract',
    laneId: delta.payload.gpuFence.laneId,
    stateKey: delta.payload.stateKey,
    queueFencePolicy: 'queue.onSubmittedWorkDone-before-admission',
    laneMustRetainBuffers: [...delta.payload.retainedBufferRefs]
  };
  delta.payload.gpuFence.queueFencePolicy = residentSequenceLaneContract.queueFencePolicy;
  delta.payload.residentSequenceLaneContract = residentSequenceLaneContract;
  delta.payload.gpuResidentLaneRequirement = {
    schema: 'peercompute.compute.gpu-resident-lane-task.v0',
    enabled: true,
    laneId: delta.payload.gpuFence.laneId,
    stateKey: delta.payload.stateKey,
    queueFencePolicy: residentSequenceLaneContract.queueFencePolicy,
    retainedBufferRefs: [...delta.payload.retainedBufferRefs],
    residentSequenceLaneContract: clone(residentSequenceLaneContract)
  };
  delta.payload.stepSummaries = [clone(delta.payload.finalStep)];
  return delta;
}

function residentDeltaWithSchroederParticleStorageResidencyToken() {
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  const payload = delta.payload;
  delete payload.schroederAdoptedParticleStorageDescriptor;
  const retainedBufferRefs = [
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer',
    'schroeder-particle-storage-residency-metadata-buffer',
    'schroeder-particle-storage-residency-dispatch-indirect-buffer'
  ];
  payload.retainedBufferRefs = [...retainedBufferRefs];
  payload.gpuFence.retainedBufferRefs = [...retainedBufferRefs];
  payload.gpuResidentLaneRequirement.retainedBufferRefs = [...retainedBufferRefs];
  payload.gpuResidentLaneRequirement.residentSequenceLaneContract
    .laneMustRetainBuffers = [...retainedBufferRefs];
  payload.residentSequenceLaneContract.laneMustRetainBuffers = [...retainedBufferRefs];
  const token = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_TOKEN_SCHEMA,
    status: 'schroeder-particle-storage-residency-token-awaiting-state-manager-admission',
    ready: true,
    adopted: false,
    taskId: delta.taskId,
    stateKey: payload.stateKey,
    laneId: payload.gpuFence.laneId,
    leaseId: 'ulg:test:sph-resident-storage-lease',
    sourceFamily: 'schroeder-particle-storage',
    generationId: 4,
    sourceParticleCount: 3,
    outputParticleCapacity: 6,
    authoritativeParticleCount: null,
    authoritativeParticleCountAuthority: 'gpu-authored-residency-metadata',
    authoritativeParticleCountMetadataWord:
      SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.authoritativeActiveCount,
    metadataSchema: ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_SCHEMA,
    metadataExpectedMagic: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_MAGIC,
    metadataExpectedVersion: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_VERSION,
    metadataStatusWord: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.status,
    metadataInvalidReasonMaskWord:
      SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.invalidReasonMask,
    metadataGenerationWord: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.generationId,
    activeDispatchIndirectByteOffset: 0,
    selectionDispatchIndirectByteOffset: 12,
    consumerGuardProtocol:
      'metadata-magic-version-ready-generation-zero-invalid-mask-and-gid-before-active-count',
    failCloseProtocol: 'invalid-no-topology-or-stale-generation-authors-zero-indirect-x',
    targetStateFamilies: [
      'sph-particle-state',
      'mls-mpm-particle-mechanics',
      'sph-particle-thermo'
    ],
    retainedBufferRefs: [...retainedBufferRefs],
    retainedRefs: retainedBufferRefs.map((ref) => ({ ref })),
    stateBufferRef: retainedBufferRefs[0],
    thermoBufferRef: retainedBufferRefs[1],
    mechanicsBufferRef: retainedBufferRefs[2],
    metadataBufferRef: retainedBufferRefs[3],
    dispatchIndirectBufferRef: retainedBufferRefs[4],
    stateManagerAdmissionRequired: true,
    stateManagerAdmissionCommitted: false,
    authoritativeStateMutation: true,
    conditionalGpuAdoption: true,
    copyMode: 'descriptor-only-no-raw-gpubuffer-transfer',
    rawGpuBufferTransferAllowed: false,
    rawGpuBufferTransferDetected: false,
    normalHotLoopReadbackFree: true,
    mapAsyncCalled: false,
    fullParticleReadbackPerformed: false
  };
  payload.schroederParticleStorageResidencyAdoptionToken = token;
  payload.finalStep.schroederParticleStorageAdopted = false;
  payload.finalStep.schroederParticleStorageAuthoritativeParticleCount = null;
  payload.finalStep.schroederParticleStorageAuthoritativeParticleCountMetadataWord = 4;
  payload.finalStep.schroederParticleStorageResidencyAdoptionToken = clone(token);
  payload.stepSummaries = [clone(payload.finalStep)];
  return delta;
}

function residentDeltaWithPressureSourceConsumption() {
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  const payload = delta.payload;
  payload.pressureSourceFieldRequested = true;
  payload.pressureRequestedSourceStep = 3;
  payload.pressureEpochCount = 1;
  payload.pressureAppliedSubstepCount = 1;
  payload.pressurePhysicsStepCount = 1;
  payload.pressureStateManagerAdmissionApproved = true;
  payload.pressureStateManagerAdmissionStatus =
    'pressure-coupling-state-mutation-admitted';
  payload.pressureStateManagerAdmissionBlockers = [];
  payload.pressureSourceFieldConsumptionIdentity = {
    status: 'material-interface-source-field-consumed-by-submitted-gpu-sequence',
    sourceStep: 3,
    pressureEpochCount: 1,
    pressureAppliedSubstepCount: 1,
    physicsStepCount: 1,
    laneId: payload.gpuFence.laneId,
    stateKey: payload.stateKey,
    leaseId: 'compute-manager-pressure-source-lease',
    consumerLeaseId: 'material-interface-source-consumer-lease:3',
    consumerLeaseStatus: 'released-after-pressure-sequence-submit',
    consumerLaneTaskId: 'compute-manager-pressure-task:3',
    consumerLaneAuthoritative: true,
    sourcePositionEpoch: 6,
    sourceNeighborhoodGeneration: 6,
    sourceNeighborhoodLaneId: payload.gpuFence.laneId,
    sourceNeighborhoodStateKey: payload.stateKey,
    sourceDeviceId: 'webgpu-device:test-pressure',
    consumerDeviceId: 'webgpu-device:test-pressure',
    finalSourceStep: 3,
    finalSourcePositionEpoch: 6,
    finalSourceNeighborhoodGeneration: 6,
    consumedNeighborhoodIdentity: {
      schema: 'peercompute.ulg.pressure-consumed-resident-neighborhood-identity.v0',
      generation: 6,
      positionEpoch: 6,
      sourceCount: 4,
      sourceFamily: 'sph-particle-state',
      consumerBit: 32,
      leaseId: 'compute-manager-pressure-source-lease',
      laneId: payload.gpuFence.laneId,
      stateKey: payload.stateKey,
      deviceId: 'webgpu-device:test-pressure',
      leaseTokenLow: 123,
      leaseTokenHigh: 456,
      tokenBinding: 'compute-manager-authority-token-v0',
      leaseIdentitySchema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
      authoritative: true,
      taskId: 'compute-manager-pressure-task:3'
    },
    neighborhoodGenerationBase: 6,
    neighborhoodPositionEpochBase: 6,
    neighborhoodGenerationCount: 3,
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'queue.onSubmittedWorkDone'
  };
  payload.pressureSourceFieldConsumptionIdentity.sourceFieldEpochs = [{
    schema: 'peercompute.ulg.sph-material-interface-source-field-consumption-epoch.v0',
    status: 'material-interface-source-field-lane-generation-submitted',
    substepIndex: 0,
    sourceFieldGeneration: 1,
    sourceStep: 3,
    sourcePositionEpoch: 6,
    sourceNeighborhoodGeneration: 6,
    sourceNeighborhoodLaneId: payload.gpuFence.laneId,
    sourceNeighborhoodStateKey: payload.stateKey,
    sourceNeighborhoodLeaseId: 'compute-manager-pressure-source-lease',
    sourceNeighborhoodTaskId: 'compute-manager-pressure-task:3',
    sourceDeviceId: 'webgpu-device:test-pressure',
    consumedNeighborhoodIdentity: clone(
      payload.pressureSourceFieldConsumptionIdentity.consumedNeighborhoodIdentity
    )
  }];
  payload.pressureSourceFieldConsumptionIdentity.sourceFieldEpochCount = 1;
  return delta;
}

function withSameDeviceOrderedFence(delta) {
  const payload = delta.payload;
  const gpuFence = payload.gpuFence;
  const pressureIdentity = payload.pressureSourceFieldConsumptionIdentity;
  const deviceId = pressureIdentity?.consumerDeviceId || 'webgpu-device:test-ordered';
  const leaseId = pressureIdentity?.leaseId || 'ulg:test:ordered-lease';
  gpuFence.status = 'ordered-before-consumer-queue-completed';
  gpuFence.method = 'same-device-queue-order';
  gpuFence.fenceSatisfied = true;
  gpuFence.queueFencePolicy =
    MLS_MPM_RESIDENT_COMPUTE_TASK_QUEUE_FENCE_POLICY_SAME_DEVICE_ORDERED;
  gpuFence.queueCompletionStatus = gpuFence.status;
  gpuFence.queueCompletionMethod = gpuFence.method;
  gpuFence.queueCompletionObserved = false;
  gpuFence.completed = false;
  gpuFence.orderingSatisfied = true;
  gpuFence.deviceId = deviceId;
  gpuFence.leaseId = leaseId;
  gpuFence.taskId = delta.taskId;
  gpuFence.sourceFamily = 'sph-particle-state';
  gpuFence.leaseIdentitySchema =
    'peercompute.compute.gpu-resident-lane-lease-identity.v0';
  gpuFence.leaseAuthoritative = true;
  gpuFence.localExecution = 'inline';
  gpuFence.pacing = {
    schema: 'peercompute.ulg.mls-mpm-resident-compute-queue-pacing.v0',
    status: 'same-device-compute-queue-submission-pending',
    configuredCapacity: 2,
    capacity: 2,
    capacityBlockers: [],
    pendingAfterSubmission: 2,
    peakPendingSubmissionCount: 2,
    queueCompletionObserved: false,
    settlementStatus: 'pending',
    residentNeighborhoodOrderedReuseWindow: true,
    residentNeighborhoodMaxInFlightSubmissions: 2,
    residentNeighborhoodInFlightSubmissionCountAtAcquire: 2
  };
  payload.residentSequenceLaneContract.queueFencePolicy = gpuFence.queueFencePolicy;
  payload.gpuResidentLaneRequirement.queueFencePolicy = gpuFence.queueFencePolicy;
  payload.gpuResidentLaneRequirement.residentSequenceLaneContract.queueFencePolicy =
    gpuFence.queueFencePolicy;
  if (pressureIdentity) {
    pressureIdentity.queueCompletionStatus = gpuFence.status;
    pressureIdentity.queueCompletionMethod = gpuFence.method;
    pressureIdentity.queueFencePolicy = gpuFence.queueFencePolicy;
    pressureIdentity.queueCompletionObserved = false;
    pressureIdentity.sameDeviceQueueOrderingAdmitted = true;
    pressureIdentity.consumerLaneTaskId = delta.taskId;
    pressureIdentity.leaseId = leaseId;
    pressureIdentity.consumedNeighborhoodIdentity.taskId = delta.taskId;
    pressureIdentity.consumedNeighborhoodIdentity.leaseId = leaseId;
    for (const epoch of pressureIdentity.sourceFieldEpochs || []) {
      epoch.sourceNeighborhoodTaskId = delta.taskId;
      epoch.sourceNeighborhoodLeaseId = leaseId;
      epoch.consumedNeighborhoodIdentity.taskId = delta.taskId;
      epoch.consumedNeighborhoodIdentity.leaseId = leaseId;
    }
  }
  return delta;
}

function residentDeltaWithPressureSourceEpochs({ count = 3, sourceStep = 3 } = {}) {
  const delta = residentDeltaWithPressureSourceConsumption();
  const payload = delta.payload;
  const identity = payload.pressureSourceFieldConsumptionIdentity;
  payload.completedStepCount = count;
  payload.pressureEpochCount = count;
  payload.pressureAppliedSubstepCount = count;
  payload.pressurePhysicsStepCount = count;
  identity.pressureEpochCount = count;
  identity.pressureAppliedSubstepCount = count;
  identity.physicsStepCount = count;
  identity.sourceStep = sourceStep;
  payload.pressureRequestedSourceStep = sourceStep;
  identity.sourcePositionEpoch = sourceStep * 3;
  identity.sourceNeighborhoodGeneration = sourceStep * 3;
  identity.neighborhoodGenerationBase = sourceStep * 3;
  identity.neighborhoodPositionEpochBase = sourceStep * 3;
  identity.consumedNeighborhoodIdentity.generation = sourceStep * 3;
  identity.consumedNeighborhoodIdentity.positionEpoch = sourceStep * 3;
  identity.sourceFieldEpochs = Array.from({ length: count }, (_, index) => {
    const step = sourceStep + index;
    const positionEpoch = step * 3;
    return {
      schema: 'peercompute.ulg.sph-material-interface-source-field-consumption-epoch.v0',
      status: 'material-interface-source-field-lane-generation-submitted',
      substepIndex: index,
      sourceFieldGeneration: index + 11,
      sourceStep: step,
      sourcePositionEpoch: positionEpoch,
      sourceNeighborhoodGeneration: positionEpoch,
      sourceNeighborhoodLaneId: identity.laneId,
      sourceNeighborhoodStateKey: identity.stateKey,
      sourceNeighborhoodLeaseId: identity.leaseId,
      sourceNeighborhoodTaskId: identity.consumerLaneTaskId,
      sourceDeviceId: identity.consumerDeviceId,
      consumedNeighborhoodIdentity: {
        ...clone(identity.consumedNeighborhoodIdentity),
        generation: positionEpoch,
        positionEpoch
      }
    };
  });
  identity.sourceFieldEpochCount = count;
  identity.consumedNeighborhoodIdentity = clone(
    identity.sourceFieldEpochs[0].consumedNeighborhoodIdentity
  );
  identity.finalSourceStep = sourceStep + count - 1;
  identity.finalSourcePositionEpoch = (sourceStep + count - 1) * 3;
  identity.finalSourceNeighborhoodGeneration = identity.finalSourcePositionEpoch;
  payload.stepSummaries = Array.from({ length: count }, (_, index) => ({
    ...clone(payload.finalStep),
    stepIndex: index,
    status: index === count - 1
      ? payload.finalStep.status
      : 'resident-step-fused-sequence-intermediate'
  }));
  payload.finalStep = clone(payload.stepSummaries.at(-1));
  return delta;
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
  assert.equal(admission.gpuResidentAuthoritativeContinuationCandidate, true);
  assert.equal(admission.gpuAuthorityAdmissionSatisfied, false);
  assert.equal(admission.gpuAuthoritativeState, false);

  const committedDelta = createStateManagerCommittedResidentStepsDelta(delta, admission);
  const warmEntry = {
    version: delta.version,
    ts: delta.timestamp,
    payload: clone(committedDelta.payload)
  };
  const warmAdmission = validateResidentStepsCommittedWarmEntry(warmEntry, delta);
  assert.equal(warmAdmission.accepted, true);
  assert.equal(warmAdmission.status, 'committed');
  assert.equal(warmAdmission.gpuAuthorityAdmissionSatisfied, true);
  assert.equal(warmAdmission.gpuAuthoritativeState, true);
  assert.equal(delta.payload.gpuAuthoritativeState, false);
  assert.equal(committedDelta.payload.gpuAuthoritativeState, true);
  assert.equal(warmAdmission.schroederAdoptedParticleStorageAuthoritativeParticleCount, 4);
});

test('resident commit bridge admits and commits a clone-safe GPU count residency token', () => {
  const delta = residentDeltaWithSchroederParticleStorageResidencyToken();
  const admission = validateResidentStepsCommitDelta(delta);

  assert.equal(admission.accepted, true);
  assert.equal(admission.schroederParticleStorageResidencyTokenReady, true);
  assert.equal(admission.schroederParticleStorageResidencyTokenCommitted, false);
  assert.equal(admission.schroederParticleStorageResidencyAuthoritativeParticleCount, null);
  assert.equal(
    admission.schroederParticleStorageResidencyAuthoritativeParticleCountMetadataWord,
    4
  );
  const committedDelta = createStateManagerCommittedResidentStepsDelta(delta, admission);
  const committedToken =
    committedDelta.payload.schroederParticleStorageResidencyAdoptionToken;
  assert.equal(committedToken.stateManagerAdmissionCommitted, true);
  assert.equal(committedToken.adopted, true);
  assert.equal(committedToken.authoritativeParticleCount, null);
  assert.equal(
    committedDelta.payload.finalStep.schroederParticleStorageResidencyAdoptionToken
      .stateManagerAdmissionCommitted,
    true
  );
  const warmAdmission = validateResidentStepsCommittedWarmEntry({
    version: delta.version,
    ts: delta.timestamp,
    payload: clone(committedDelta.payload)
  }, delta);
  assert.equal(warmAdmission.accepted, true);
  assert.equal(warmAdmission.status, 'committed');
  assert.equal(warmAdmission.schroederParticleStorageResidencyTokenCommitted, true);
});

test('resident commit bridge rejects forged CPU counts and incomplete token retention', () => {
  const counted = residentDeltaWithSchroederParticleStorageResidencyToken();
  counted.payload.schroederParticleStorageResidencyAdoptionToken
    .authoritativeParticleCount = 6;
  const countedAdmission = validateResidentStepsCommitDelta(counted);
  assert.equal(countedAdmission.accepted, false);
  assert.ok(countedAdmission.issues.includes(
    'schroeder-particle-storage-residency-token-cpu-authoritative-count-prohibited'
  ));

  const missingRetention = residentDeltaWithSchroederParticleStorageResidencyToken();
  missingRetention.payload.gpuResidentLaneRequirement.retainedBufferRefs.pop();
  missingRetention.payload.gpuResidentLaneRequirement.residentSequenceLaneContract
    .laneMustRetainBuffers.pop();
  missingRetention.payload.residentSequenceLaneContract.laneMustRetainBuffers.pop();
  const missingAdmission = validateResidentStepsCommitDelta(missingRetention);
  assert.equal(missingAdmission.accepted, false);
  assert.ok(missingAdmission.issues.includes(
    'schroeder-particle-storage-residency-token-resident-lane-retained-ref-missing'
  ));
});

test('resident commit bridge rejects raw GPU-like objects hidden in a residency token', () => {
  const delta = residentDeltaWithSchroederParticleStorageResidencyToken();
  delta.payload.schroederParticleStorageResidencyAdoptionToken.hiddenBuffer = {
    size: 64,
    mapAsync() {}
  };
  const admission = validateResidentStepsCommitDelta(delta);
  assert.equal(admission.accepted, false);
  assert.ok(admission.issues.includes(
    'schroeder-particle-storage-residency-token-raw-gpubuffer-detected'
  ));
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

test('resident commit bridge admits exact pressure source consumption identity', () => {
  const admission = validateResidentStepsCommitDelta(
    residentDeltaWithPressureSourceConsumption()
  );
  assert.equal(admission.accepted, true);
  assert.equal(admission.pressureSourceFieldRequested, true);
  assert.equal(admission.pressureStateManagerAdmissionApproved, true);
  assert.equal(admission.pressureEpochCount, 1);
  assert.equal(admission.pressureAppliedSubstepCount, 1);
});

test('resident commit bridge admits identity-bound same-device queue ordering without claiming completion', () => {
  const delta = withSameDeviceOrderedFence(
    residentDeltaWithPressureSourceConsumption()
  );
  const admission = validateResidentStepsCommitDelta(delta);
  assert.equal(admission.accepted, true);
  assert.deepEqual(admission.issues, []);
  assert.equal(delta.payload.gpuFence.fenceSatisfied, true);
  assert.equal(delta.payload.gpuFence.completed, false);
  assert.equal(delta.payload.gpuFence.queueCompletionObserved, false);
  assert.equal(
    delta.payload.pressureSourceFieldConsumptionIdentity.sameDeviceQueueOrderingAdmitted,
    true
  );
});

test('resident commit bridge rejects forged same-device queue-order identities', () => {
  const delta = withSameDeviceOrderedFence(
    residentDeltaWithPressureSourceConsumption()
  );
  delta.payload.gpuFence.deviceId = 'webgpu-device:forged';
  const admission = validateResidentStepsCommitDelta(delta);
  assert.equal(admission.accepted, false);
  assert.ok(admission.issues.includes('pressure-source-consumption-queue-not-completed'));
});

test('resident commit bridge admits an exact three-step pressure source epoch chain', () => {
  const admission = validateResidentStepsCommitDelta(
    residentDeltaWithPressureSourceEpochs()
  );
  assert.equal(admission.accepted, true);
  assert.deepEqual(admission.issues, []);
  assert.equal(admission.pressureEpochCount, 3);
});

test('resident commit bridge rejects forged middle pressure source epochs', () => {
  const cases = [
    {
      issue: 'pressure-source-field-epoch-1-step-mismatch',
      mutate(epoch) { epoch.sourceStep += 1; }
    },
    {
      issue: 'pressure-source-field-epoch-1-generation-position-epoch-mismatch',
      mutate(epoch) { epoch.sourcePositionEpoch += 1; }
    },
    {
      issue: 'pressure-source-field-epoch-1-field-generation-not-monotonic',
      mutate(epoch, identity) {
        epoch.sourceFieldGeneration = identity.sourceFieldEpochs[0].sourceFieldGeneration;
      }
    },
    {
      issue: 'pressure-source-field-epoch-1-lane-binding-mismatch',
      mutate(epoch) { epoch.sourceNeighborhoodLaneId = 'forged-lane'; }
    },
    {
      issue: 'pressure-source-field-epoch-1-consumed-task-binding-mismatch',
      mutate(epoch) { epoch.consumedNeighborhoodIdentity.taskId = 'forged-task'; }
    },
    {
      issue: 'pressure-source-field-epoch-1-consumed-source-family-mismatch',
      mutate(epoch) { epoch.consumedNeighborhoodIdentity.sourceFamily = 'forged-family'; }
    }
  ];
  for (const entry of cases) {
    const delta = residentDeltaWithPressureSourceEpochs();
    const identity = delta.payload.pressureSourceFieldConsumptionIdentity;
    entry.mutate(identity.sourceFieldEpochs[1], identity);
    const admission = validateResidentStepsCommitDelta(delta);
    assert.equal(admission.accepted, false, entry.issue);
    assert.ok(admission.issues.includes(entry.issue), entry.issue);
  }

  const omitted = residentDeltaWithPressureSourceEpochs();
  omitted.payload.pressureSourceFieldConsumptionIdentity.sourceFieldEpochs.splice(1, 1);
  const omittedAdmission = validateResidentStepsCommitDelta(omitted);
  assert.equal(omittedAdmission.accepted, false);
  assert.ok(omittedAdmission.issues.includes('pressure-source-field-epoch-count-mismatch'));
});

test('resident commit bridge rejects a StateManager middle-epoch substitution', () => {
  const delta = residentDeltaWithPressureSourceEpochs();
  const admission = validateResidentStepsCommitDelta(delta);
  assert.equal(admission.accepted, true);
  const committed = createStateManagerCommittedResidentStepsDelta(delta, admission);
  const warmEntry = {
    version: delta.version,
    ts: delta.timestamp,
    payload: clone(committed.payload)
  };
  warmEntry.payload.pressureSourceFieldConsumptionIdentity
    .sourceFieldEpochs[1].consumedNeighborhoodIdentity.tokenBinding =
      'substituted-but-structurally-valid-token';

  const warmAdmission = validateResidentStepsCommittedWarmEntry(warmEntry, delta);
  assert.equal(warmAdmission.accepted, false);
  assert.ok(
    warmAdmission.issues.includes('warm-entry-pressure-source-field-epochs-mismatch')
  );
});

test('resident commit bridge rejects nullable time-zero producer lane provenance', () => {
  const delta = residentDeltaWithPressureSourceConsumption();
  delta.payload.pressureRequestedSourceStep = 0;
  const identity = delta.payload.pressureSourceFieldConsumptionIdentity;
  identity.sourceStep = 0;
  identity.sourcePositionEpoch = 0;
  identity.sourceNeighborhoodGeneration = 0;
  identity.sourceNeighborhoodLaneId = null;
  identity.sourceNeighborhoodStateKey = null;
  identity.neighborhoodGenerationBase = 0;
  identity.neighborhoodPositionEpochBase = 0;
  identity.consumedNeighborhoodIdentity.generation = 0;
  identity.consumedNeighborhoodIdentity.positionEpoch = 0;
  identity.finalSourceStep = 0;
  identity.finalSourcePositionEpoch = 0;
  identity.finalSourceNeighborhoodGeneration = 0;
  identity.sourceFieldEpochs[0].sourceStep = 0;
  identity.sourceFieldEpochs[0].sourcePositionEpoch = 0;
  identity.sourceFieldEpochs[0].sourceNeighborhoodGeneration = 0;
  identity.sourceFieldEpochs[0].consumedNeighborhoodIdentity.generation = 0;
  identity.sourceFieldEpochs[0].consumedNeighborhoodIdentity.positionEpoch = 0;

  const admission = validateResidentStepsCommitDelta(delta);
  assert.equal(admission.accepted, false);
  assert.ok(
    admission.issues.includes(
      'pressure-source-field-initial-sourceNeighborhoodLaneId-mismatch'
    )
  );
});

test('resident commit bridge rejects dropped and mismatched pressure consumption evidence', () => {
  const dropped = residentDeltaWithPressureSourceConsumption();
  dropped.payload.pressureSourceFieldConsumptionIdentity = null;
  const droppedAdmission = validateResidentStepsCommitDelta(dropped);
  assert.equal(droppedAdmission.accepted, false);
  assert.ok(
    droppedAdmission.issues.includes(
      'missing-pressure-source-field-consumption-identity'
    )
  );

  const mismatched = residentDeltaWithPressureSourceConsumption();
  mismatched.payload.pressureSourceFieldConsumptionIdentity.sourceStep = 4;
  mismatched.payload.pressureSourceFieldConsumptionIdentity.pressureEpochCount = 2;
  mismatched.payload.pressureSourceFieldConsumptionIdentity.neighborhoodPositionEpochBase = 8;
  const mismatchAdmission = validateResidentStepsCommitDelta(mismatched);
  assert.equal(mismatchAdmission.accepted, false);
  assert.ok(mismatchAdmission.issues.includes('pressure-source-step-identity-mismatch'));
  assert.ok(mismatchAdmission.issues.includes('pressure-epoch-count-identity-mismatch'));
  assert.ok(
    mismatchAdmission.issues.includes(
      'pressure-source-position-epoch-identity-mismatch'
    )
  );
});

test('resident commit bridge rejects forged pressure source and consumed-neighborhood identities', () => {
  const cases = [
    {
      issue: 'missing-pressure-source-consumer-lease-id',
      mutate(identity) { identity.consumerLeaseId = null; }
    },
    {
      issue: 'missing-pressure-source-consumer-lease-status',
      mutate(identity) { identity.consumerLeaseStatus = null; }
    },
    {
      issue: 'missing-pressure-consumed-neighborhood-identity',
      mutate(identity) { identity.consumedNeighborhoodIdentity = null; }
    },
    {
      issue: 'pressure-consumed-neighborhood-lease-id-mismatch',
      mutate(identity) { identity.consumedNeighborhoodIdentity.leaseId = 'forged-lease'; }
    },
    {
      issue: 'pressure-consumed-neighborhood-not-authoritative',
      mutate(identity) { identity.consumedNeighborhoodIdentity.authoritative = false; }
    },
    {
      issue: 'invalid-pressure-source-position-epoch',
      mutate(identity) { identity.sourcePositionEpoch = -1; }
    },
    {
      issue: 'pressure-source-position-epoch-consumption-mismatch',
      mutate(identity) { identity.sourcePositionEpoch = 5; }
    },
    {
      issue: 'pressure-source-neighborhood-generation-identity-mismatch',
      mutate(identity) { identity.sourceNeighborhoodGeneration = 5; }
    },
    {
      issue: 'pressure-source-neighborhood-lane-identity-mismatch',
      mutate(identity) { identity.sourceNeighborhoodLaneId = 'forged-pressure-lane'; }
    },
    {
      issue: 'pressure-source-neighborhood-state-key-identity-mismatch',
      mutate(identity) { identity.sourceNeighborhoodStateKey = 'forged-pressure-state'; }
    },
    {
      issue: 'pressure-source-device-identity-mismatch',
      mutate(identity) { identity.sourceDeviceId = 'webgpu-device:forged'; }
    },
    {
      issue: 'missing-pressure-consumer-device-id',
      mutate(identity) { identity.consumerDeviceId = null; }
    },
    {
      issue: 'pressure-applied-count-identity-mismatch',
      mutate(identity) { identity.pressureAppliedSubstepCount = 2; }
    }
  ];
  for (const { issue, mutate } of cases) {
    const forged = residentDeltaWithPressureSourceConsumption();
    mutate(forged.payload.pressureSourceFieldConsumptionIdentity);
    const admission = validateResidentStepsCommitDelta(forged);
    assert.equal(admission.accepted, false, issue);
    assert.ok(admission.issues.includes(issue), issue);
  }
});

test('resident commit bridge rejects deferred cleanup mislabeled as a satisfied fence', () => {
  const delta = residentDeltaWithPressureSourceConsumption();
  delta.payload.gpuFence.status = 'queue-submitted-cleanup-deferred';
  delta.payload.gpuFence.method = 'deferred queue.onSubmittedWorkDone cleanup';
  delta.payload.gpuFence.fenceSatisfied = true;
  const admission = validateResidentStepsCommitDelta(delta);
  assert.equal(admission.accepted, false);
  assert.ok(admission.issues.includes('gpu-fence-status-not-completed'));
});

test('resident commit bridge rejects mixed-step authority candidates', () => {
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  delta.payload.completedStepCount = 2;
  delta.payload.stepSummaries.unshift({
    ...clone(delta.payload.finalStep),
    stepIndex: 0,
    backend: 'cpu-reference',
    readbackMode: 'full-parity-readback',
    normalHotLoopReadbackFree: false,
    gpuResidentAuthoritativeContinuationCandidate: false,
    gpuAuthorityAdmissionRequired: false,
    gpuAuthorityStatus: 'gpu-authority-unavailable-no-resident-continuation-candidate',
    gpuAuthorityCandidateBlockers: ['backend-not-webgpu']
  });
  delta.payload.stepSummaries[1].stepIndex = 1;

  const admission = validateResidentStepsCommitDelta(delta);
  assert.equal(admission.accepted, false);
  assert.ok(admission.issues.includes('gpu-authority-candidate-completed-step-backend-not-webgpu'));
  assert.ok(
    admission.issues.includes('gpu-authority-candidate-completed-step-hot-loop-readback-not-free')
  );
});

test('resident commit bridge rejects arbitrary retained roles and missing lane binding', () => {
  const arbitrary = residentDeltaWithSchroederAdoptedStorageDescriptor();
  arbitrary.payload.retainedBufferRefs = ['a', 'b', 'c'];
  arbitrary.payload.gpuFence.retainedBufferRefs = ['a', 'b', 'c'];
  const arbitraryAdmission = validateResidentStepsCommitDelta(arbitrary);
  assert.equal(arbitraryAdmission.accepted, false);
  assert.ok(
    arbitraryAdmission.issues.includes('gpu-authority-candidate-retained-buffer-ref-noncanonical')
  );
  assert.ok(
    arbitraryAdmission.issues.includes('gpu-authority-candidate-required-sph-state-buffer-missing')
  );

  const missingLane = residentDeltaWithSchroederAdoptedStorageDescriptor();
  missingLane.payload.gpuFence.laneId = null;
  const missingLaneAdmission = validateResidentStepsCommitDelta(missingLane);
  assert.equal(missingLaneAdmission.accepted, false);
  assert.ok(
    missingLaneAdmission.issues.includes('gpu-authority-candidate-gpu-fence-lane-id-missing')
  );

  const missingDescriptors = residentDeltaWithSchroederAdoptedStorageDescriptor();
  delete missingDescriptors.payload.gpuResidentLaneRequirement;
  delete missingDescriptors.payload.residentSequenceLaneContract;
  const missingDescriptorsAdmission = validateResidentStepsCommitDelta(missingDescriptors);
  assert.equal(missingDescriptorsAdmission.accepted, false);
  assert.ok(
    missingDescriptorsAdmission.issues.includes(
      'gpu-authority-candidate-gpu-resident-lane-requirement-missing'
    )
  );
  assert.ok(
    missingDescriptorsAdmission.issues.includes(
      'gpu-authority-candidate-resident-sequence-lane-contract-missing'
    )
  );
});

test('resident commit bridge admits canonical same-lane pressure input roles', () => {
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  const pressureInputRefs = [
    'material-interface-source-field-rows-buffer',
    'material-interface-source-surface-buffer',
    'material-interface-source-index-field-buffer',
    'resident-gas-pressure-cells-buffer',
    'resident-gas-pressure-cell-metadata-buffer',
    'resident-gas-pressure-cell-lookup-buffer'
  ];
  delta.payload.retainedBufferRefs.push(...pressureInputRefs);
  delta.payload.gpuFence.retainedBufferRefs.push(...pressureInputRefs);
  delta.payload.gpuResidentLaneRequirement.retainedBufferRefs.push(...pressureInputRefs);
  delta.payload.gpuResidentLaneRequirement.residentSequenceLaneContract.laneMustRetainBuffers.push(
    ...pressureInputRefs
  );
  delta.payload.residentSequenceLaneContract.laneMustRetainBuffers.push(...pressureInputRefs);

  const admission = validateResidentStepsCommitDelta(delta);
  assert.equal(admission.accepted, true);
  assert.deepEqual(admission.issues, []);
});

test('resident commit bridge permits canonical runtime intermediates beyond the lane plan', () => {
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  const runtimeIntermediateRefs = [
    'p2g-grid-buffer',
    'updated-grid-buffer',
    'compact-summary-diagnostics'
  ];
  delta.payload.retainedBufferRefs.push(...runtimeIntermediateRefs);
  delta.payload.gpuFence.retainedBufferRefs.push(...runtimeIntermediateRefs);

  const admission = validateResidentStepsCommitDelta(delta);
  assert.equal(admission.accepted, true);
  assert.deepEqual(admission.issues, []);
  assert.deepEqual(delta.payload.gpuResidentLaneRequirement.retainedBufferRefs, [
    'sph-state-buffer',
    'sph-thermo-buffer',
    'mls-mpm-mechanics-buffer'
  ]);
});

test('resident commit bridge allows nullable producer provenance only at time zero', () => {
  const delta = residentDeltaWithPressureSourceConsumption();
  const identity = delta.payload.pressureSourceFieldConsumptionIdentity;
  identity.sourceNeighborhoodLaneId = null;
  identity.sourceNeighborhoodStateKey = null;

  const admission = validateResidentStepsCommitDelta(delta);
  assert.equal(admission.accepted, false);
  assert.ok(admission.issues.includes('missing-pressure-source-neighborhood-lane-id'));
  assert.ok(admission.issues.includes('missing-pressure-source-neighborhood-state-key'));
});

test('StateManager commit promotes only a validated GPU continuation candidate', () => {
  const warmByScope = new Map();
  const stateManager = {
    commitDelta(delta) {
      const warm = warmByScope.get(delta.scope) || {};
      warm[delta.taskId] = {
        version: delta.version,
        ts: delta.timestamp,
        payload: clone(delta.payload)
      };
      warmByScope.set(delta.scope, warm);
    },
    getWarmDeltas(scope) {
      return warmByScope.get(scope) || {};
    }
  };
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  const handler = createResidentStateManagerCommitHandler(stateManager);
  const commitAdmission = handler(delta);
  const committed = stateManager.getWarmDeltas(delta.scope)[delta.taskId];

  assert.equal(delta.payload.gpuAuthoritativeState, false);
  assert.equal(commitAdmission.gpuAuthorityAdmissionSatisfied, true);
  assert.equal(commitAdmission.gpuAuthoritativeState, true);
  assert.equal(committed.payload.gpuResidentAuthoritativeContinuationCandidate, true);
  assert.equal(committed.payload.gpuAuthorityAdmissionSatisfied, true);
  assert.equal(
    committed.payload.gpuAuthorityStatus,
    'gpu-resident-authority-admitted-by-state-manager-commit'
  );
  assert.equal(committed.payload.gpuAuthoritativeState, true);
  assert.equal(committed.payload.finalStep.gpuAuthoritativeState, true);

  const warmAdmission = readResidentStepsCommittedWarmDelta(stateManager, { delta });
  const execution = {
    gpuResidentAuthoritativeContinuationCandidate: true,
    gpuAuthorityAdmissionRequired: true,
    gpuAuthorityAdmissionSatisfied: false,
    gpuAuthorityStatus:
      'gpu-resident-continuation-candidate-awaiting-state-manager-commit',
    gpuAuthoritativeState: false,
    finalStep: clone(delta.payload.finalStep),
    stepSummaries: [clone(delta.payload.finalStep)],
    commitDelta: delta
  };
  const promotion = promoteResidentStepsExecutionGpuAuthority(execution, warmAdmission);
  assert.equal(promotion.promoted, true);
  assert.equal(execution.gpuAuthoritativeState, true);
  assert.equal(execution.finalStep.gpuAuthoritativeState, true);
  assert.equal(execution.stepSummaries[0].gpuAuthoritativeState, true);
  assert.equal(execution.commitDelta.payload.gpuAuthoritativeState, false);
  assert.equal(execution.committedStateDelta.payload.gpuAuthoritativeState, true);
});

test('unrelated committed warm state cannot promote another execution', () => {
  const first = residentDeltaWithSchroederAdoptedStorageDescriptor();
  const second = residentDeltaWithSchroederAdoptedStorageDescriptor();
  second.taskId = 'ulg:test:resident-steps-unrelated';
  second.scope = 'ulg-sph-resident-pass-dag';
  second.payload.stateKey = 'ulg:test:unrelated-state';
  second.payload.gpuFence.stateKey = second.payload.stateKey;
  second.payload.gpuResidentLaneRequirement.stateKey = second.payload.stateKey;
  second.payload.gpuResidentLaneRequirement.residentSequenceLaneContract.stateKey =
    second.payload.stateKey;
  second.payload.residentSequenceLaneContract.stateKey = second.payload.stateKey;
  const secondAdmission = validateResidentStepsCommitDelta(second);
  const secondCommitted = createStateManagerCommittedResidentStepsDelta(second, secondAdmission);
  const execution = {
    gpuResidentAuthoritativeContinuationCandidate: true,
    gpuAuthorityAdmissionRequired: true,
    gpuAuthorityAdmissionSatisfied: false,
    gpuAuthoritativeState: false,
    finalStep: clone(first.payload.finalStep),
    stepSummaries: [clone(first.payload.finalStep)],
    commitDelta: first
  };

  const promotion = promoteResidentStepsExecutionGpuAuthority(execution, {
    accepted: true,
    status: 'committed',
    taskId: second.taskId,
    scope: second.scope,
    warmEntry: {
      version: second.version,
      ts: second.timestamp,
      payload: clone(secondCommitted.payload)
    }
  });

  assert.equal(promotion.promoted, false);
  assert.equal(
    promotion.status,
    'gpu-authority-committed-evidence-not-bound-to-execution'
  );
  assert.equal(promotion.committedTaskMatches, false);
  assert.ok(promotion.warmBindingIssues.includes('warm-entry-state-key-mismatch'));
  assert.equal(execution.gpuAuthoritativeState, false);
});

test('warm authority promotion rejects altered step, fence, and retained-role evidence', () => {
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  const admission = validateResidentStepsCommitDelta(delta);
  const committedDelta = createStateManagerCommittedResidentStepsDelta(delta, admission);

  const alteredStep = {
    version: delta.version,
    ts: delta.timestamp,
    payload: clone(committedDelta.payload)
  };
  alteredStep.payload.stepSummaries[0].backend = 'cpu-reference';
  const alteredStepAdmission = validateResidentStepsCommittedWarmEntry(alteredStep, delta);
  assert.equal(alteredStepAdmission.accepted, false);
  assert.ok(alteredStepAdmission.issues.includes('warm-entry-gpu-authority-candidate-completed-step-backend-not-webgpu'));
  assert.ok(alteredStepAdmission.issues.includes('warm-entry-step-summary-0-backend-mismatch'));

  const alteredFence = {
    version: delta.version,
    ts: delta.timestamp,
    payload: clone(committedDelta.payload)
  };
  alteredFence.payload.gpuFence.laneId = 'ulg:test:forged-lane';
  const alteredFenceAdmission = validateResidentStepsCommittedWarmEntry(alteredFence, delta);
  assert.equal(alteredFenceAdmission.accepted, false);
  assert.ok(alteredFenceAdmission.issues.includes('warm-entry-gpu-fence-laneId-mismatch'));

  const alteredRefs = {
    version: delta.version,
    ts: delta.timestamp,
    payload: clone(committedDelta.payload)
  };
  alteredRefs.payload.retainedBufferRefs.push('p2g-grid-buffer');
  alteredRefs.payload.gpuFence.retainedBufferRefs.push('p2g-grid-buffer');
  const alteredRefsAdmission = validateResidentStepsCommittedWarmEntry(alteredRefs, delta);
  assert.equal(alteredRefsAdmission.accepted, false);
  assert.ok(alteredRefsAdmission.issues.includes('warm-entry-retained-buffer-refs-mismatch'));
  assert.ok(
    alteredRefsAdmission.issues.includes('warm-entry-gpu-fence-retained-buffer-refs-mismatch')
  );
});

test('resident commit bridge rejects pre-commit global authority claims without committing', () => {
  const commits = [];
  const handler = createResidentStateManagerCommitHandler({
    commitDelta(delta) { commits.push(delta); }
  });
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  delta.payload.gpuAuthoritativeState = true;
  delta.payload.finalStep.gpuAuthoritativeState = true;

  assert.throws(
    () => handler(delta),
    (error) => {
      assert.equal(error.code, 'ERR_ULG_RESIDENT_DELTA_REJECTED');
      assert.equal(
        error.admission.reason,
        'gpu-authority-claimed-before-state-manager-commit'
      );
      return true;
    }
  );
  assert.equal(commits.length, 0);
});

test('uncommitted GPU continuation candidates remain globally non-authoritative', () => {
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  const execution = {
    gpuResidentAuthoritativeContinuationCandidate: true,
    gpuAuthorityAdmissionRequired: true,
    gpuAuthorityAdmissionSatisfied: false,
    gpuAuthorityStatus:
      'gpu-resident-continuation-candidate-awaiting-state-manager-commit',
    gpuAuthoritativeState: false,
    finalStep: clone(delta.payload.finalStep),
    stepSummaries: [],
    commitDelta: delta
  };
  const promotion = promoteResidentStepsExecutionGpuAuthority(execution, {
    accepted: false,
    status: 'rejected',
    warmEntry: null
  });

  assert.equal(promotion.promoted, false);
  assert.equal(promotion.status, 'gpu-authority-candidate-not-committed');
  assert.equal(execution.gpuAuthorityAdmissionSatisfied, false);
  assert.equal(execution.gpuAuthoritativeState, false);
  assert.equal(execution.committedStateDelta, undefined);
});

test('StateManager commit keeps fallback executions globally non-authoritative', () => {
  const commits = [];
  const handler = createResidentStateManagerCommitHandler({
    commitDelta(delta) { commits.push(clone(delta)); }
  });
  const delta = residentDeltaWithSchroederAdoptedStorageDescriptor();
  Object.assign(delta.payload, {
    backend: 'mixed-fallback',
    readbackMode: 'full-parity-readback',
    continuationAvailable: false,
    normalHotLoopReadbackFree: false,
    gpuResidentAuthoritativeContinuationCandidate: false,
    gpuAuthorityAdmissionRequired: false,
    gpuAuthorityAdmissionSatisfied: false,
    gpuAuthorityStatus: 'gpu-authority-unavailable-no-resident-continuation-candidate',
    gpuAuthorityCandidateBlockers: ['backend-not-webgpu'],
    gpuAuthoritativeState: false
  });
  Object.assign(delta.payload.finalStep, {
    backend: 'mixed-fallback',
    readbackMode: 'full-parity-readback',
    normalHotLoopReadbackFree: false,
    gpuResidentAuthoritativeContinuationCandidate: false,
    gpuAuthorityAdmissionRequired: false,
    gpuAuthorityAdmissionSatisfied: false,
    gpuAuthorityStatus: 'gpu-authority-unavailable-no-resident-continuation-candidate',
    gpuAuthorityCandidateBlockers: ['backend-not-webgpu'],
    gpuAuthoritativeState: false
  });

  const admission = handler(delta);
  assert.equal(admission.accepted, true);
  assert.equal(admission.gpuAuthoritativeState, false);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].payload.gpuAuthorityAdmissionSatisfied, false);
  assert.equal(commits[0].payload.gpuAuthoritativeState, false);
});
