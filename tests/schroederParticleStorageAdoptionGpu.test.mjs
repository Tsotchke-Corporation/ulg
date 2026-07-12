import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND
} from '../src/runtime/sph/schroederParticleStorageResidencyGpu.js';
import {
  ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_TOKEN_SCHEMA,
  createSchroederParticleStorageResidencyAdoptionCandidate,
  createStateManagerAdmittedSchroederParticleStorageResidencyAdoption,
  validateSchroederParticleStorageResidencyAdoptionToken
} from '../src/runtime/sph/schroederParticleStorageAdoptionGpu.js';

function fixture() {
  const device = {};
  const buffer = (label) => ({ label, destroy() { this.destroyed = true; } });
  const countResidency = {
    device,
    generationId: 7,
    summaryKind: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND.count,
    sourceParticleCount: 3,
    outputParticleCapacity: 6,
    metadataBuffer: buffer('count-metadata'),
    dispatchIndirectBuffer: buffer('count-indirect')
  };
  const compactionResidency = {
    device,
    generationId: 7,
    summaryKind: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND.compaction,
    sourceParticleCount: 3,
    outputParticleCapacity: 6,
    metadataBuffer: buffer('compaction-metadata'),
    metadataBufferByteLength: 64,
    dispatchIndirectBuffer: buffer('compaction-indirect'),
    dispatchIndirectBufferByteLength: 24
  };
  const materialization = {
    particleStorageMaterializationAdmissionApproved: true,
    targetStateFamilies: [
      'sph-particle-state',
      'mls-mpm-particle-mechanics',
      'sph-particle-thermo'
    ]
  };
  const compaction = {
    residency: compactionResidency,
    sourceParticleCount: 3,
    outputParticleCapacity: 6,
    targetStateFamilies: [...materialization.targetStateFamilies],
    particleStateBuffer: buffer('state'),
    particleThermoBuffer: buffer('thermo'),
    particleMechanicsBuffer: buffer('mechanics'),
    stateBufferByteLength: 192,
    thermoBufferByteLength: 288,
    mechanicsBufferByteLength: 768,
    normalHotLoopReadbackFree: true,
    compactSummaryReadbackPerformed: false,
    mapAsyncCalled: false,
    authoritativeParticleCount: null,
    destroyParticleBuffers() {
      this.particleStateBuffer.destroy();
      this.particleThermoBuffer.destroy();
      this.particleMechanicsBuffer.destroy();
      this.residency.metadataBuffer.destroy();
      this.residency.dispatchIndirectBuffer.destroy();
    }
  };
  const laneIdentity = {
    authoritative: true,
    taskId: 'ulg:test:ss-storage-task',
    stateKey: 'ulg:test:ss-storage-state',
    laneId: 'ulg:test:ss-storage-lane',
    leaseId: 'ulg:test:ss-storage-lease',
    sourceFamily: 'schroeder-particle-storage'
  };
  return {
    device,
    materialization,
    count: {
      residency: countResidency,
      normalHotLoopReadbackFree: true,
      compactSummaryReadbackPerformed: false,
      mapAsyncCalled: false,
      authoritativeParticleCount: null
    },
    compaction,
    laneIdentity
  };
}

test('residency adoption candidate publishes clone-safe GPU count and indirect descriptors', () => {
  const value = fixture();
  const candidate = createSchroederParticleStorageResidencyAdoptionCandidate({
    device: value.device,
    particleStorageMaterialization: value.materialization,
    particleStorageCountSummary: value.count,
    particleStorageCompaction: value.compaction,
    computeManagerLaneIdentity: value.laneIdentity
  });

  assert.equal(candidate.ready, true);
  assert.equal(candidate.adopted, false);
  assert.equal(candidate.authoritativeParticleCount, null);
  assert.equal(
    candidate.authoritativeParticleCountMetadataWord,
    SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.authoritativeActiveCount
  );
  assert.equal(candidate.outputParticleCapacity, 6);
  assert.equal(candidate.stateBuffer, value.compaction.particleStateBuffer);
  const token = candidate.admissionToken;
  assert.equal(token.schema, ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_TOKEN_SCHEMA);
  assert.equal(token.authoritativeParticleCount, null);
  assert.equal(token.outputParticleCapacity, 6);
  assert.equal(token.activeDispatchIndirectByteOffset, 0);
  assert.equal(token.selectionDispatchIndirectByteOffset, 12);
  assert.equal(token.rawGpuBufferTransferDetected, false);
  assert.equal(validateSchroederParticleStorageResidencyAdoptionToken(token).accepted, true);
  const portable = JSON.parse(JSON.stringify(token));
  assert.deepEqual(portable, token);
  assert.equal(JSON.stringify(token).includes('compaction-metadata'), false);
  assert.ok(token.retainedBufferRefs.includes(
    'schroeder-particle-storage-residency-metadata-buffer'
  ));
});

test('residency adoption candidate rejects cross-device, generation, and capacity drift', () => {
  const value = fixture();
  assert.equal(createSchroederParticleStorageResidencyAdoptionCandidate({
    device: {},
    particleStorageMaterialization: value.materialization,
    particleStorageCountSummary: value.count,
    particleStorageCompaction: value.compaction,
    computeManagerLaneIdentity: value.laneIdentity
  }).reason, 'same-device-count-and-compaction-residency-required');

  value.compaction.residency.generationId = 8;
  assert.equal(createSchroederParticleStorageResidencyAdoptionCandidate({
    device: value.device,
    particleStorageMaterialization: value.materialization,
    particleStorageCountSummary: value.count,
    particleStorageCompaction: value.compaction,
    computeManagerLaneIdentity: value.laneIdentity
  }).reason, 'particle-storage-residency-generation-mismatch');

  value.compaction.residency.generationId = 7;
  value.compaction.outputParticleCapacity = 7;
  assert.equal(createSchroederParticleStorageResidencyAdoptionCandidate({
    device: value.device,
    particleStorageMaterialization: value.materialization,
    particleStorageCountSummary: value.count,
    particleStorageCompaction: value.compaction,
    computeManagerLaneIdentity: value.laneIdentity
  }).reason, 'particle-storage-residency-count-or-capacity-mismatch');
});

test('StateManager admission promotes the local buffers without materializing a CPU count', () => {
  const value = fixture();
  const candidate = createSchroederParticleStorageResidencyAdoptionCandidate({
    device: value.device,
    particleStorageMaterialization: value.materialization,
    particleStorageCountSummary: value.count,
    particleStorageCompaction: value.compaction,
    computeManagerLaneIdentity: value.laneIdentity
  });
  const adoption = createStateManagerAdmittedSchroederParticleStorageResidencyAdoption({
    candidate,
    stateManagerAdmission: {
      accepted: true,
      status: 'committed',
      taskId: value.laneIdentity.taskId,
      stateKey: value.laneIdentity.stateKey,
      laneId: value.laneIdentity.laneId,
      admissionId: 19,
      gpuFence: { fenceSatisfied: true }
    }
  });

  assert.equal(adoption.schema, ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_SCHEMA);
  assert.equal(adoption.adopted, true);
  assert.equal(adoption.authoritativeParticleCount, null);
  assert.equal(adoption.authoritativeParticleCountMetadataWord, 4);
  assert.equal(adoption.stateBuffer, candidate.stateBuffer);
  assert.equal(adoption.admissionToken.stateManagerAdmissionCommitted, true);
  assert.equal(validateSchroederParticleStorageResidencyAdoptionToken(
    adoption.admissionToken,
    { requireCommitted: true }
  ).accepted, true);

  const stale = createStateManagerAdmittedSchroederParticleStorageResidencyAdoption({
    candidate,
    stateManagerAdmission: {
      accepted: true,
      status: 'committed',
      taskId: 'wrong-task',
      stateKey: value.laneIdentity.stateKey,
      laneId: value.laneIdentity.laneId,
      gpuFence: { fenceSatisfied: true }
    }
  });
  assert.equal(stale.adopted, false);
  assert.equal(stale.reason, 'state-manager-admission-identity-mismatch');
});

test('token validation refuses capacity disguised as an authoritative count', () => {
  const value = fixture();
  const token = createSchroederParticleStorageResidencyAdoptionCandidate({
    device: value.device,
    particleStorageMaterialization: value.materialization,
    particleStorageCountSummary: value.count,
    particleStorageCompaction: value.compaction,
    computeManagerLaneIdentity: value.laneIdentity
  }).admissionToken;
  const poisoned = { ...token, authoritativeParticleCount: token.outputParticleCapacity };
  const validation = validateSchroederParticleStorageResidencyAdoptionToken(poisoned);
  assert.equal(validation.accepted, false);
  assert.ok(validation.issues.includes('cpu-authoritative-count-prohibited'));
});

test('candidate validation rejects a mapped summary relabeled as resident', () => {
  const value = fixture();
  value.count.mapAsyncCalled = true;
  const candidate = createSchroederParticleStorageResidencyAdoptionCandidate({
    device: value.device,
    particleStorageMaterialization: value.materialization,
    particleStorageCountSummary: value.count,
    particleStorageCompaction: value.compaction,
    computeManagerLaneIdentity: value.laneIdentity
  });
  assert.equal(candidate.ready, false);
  assert.equal(candidate.reason, 'particle-storage-residency-no-map-gpu-count-contract-required');
});
