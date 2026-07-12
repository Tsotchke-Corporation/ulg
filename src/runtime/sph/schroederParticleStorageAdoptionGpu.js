import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_MAGIC,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_VERSION,
  ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_SCHEMA
} from './schroederParticleStorageResidencyGpu.js';

export const ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_TOKEN_SCHEMA =
  'peercompute.ulg.schroeder-particle-storage-residency-adoption-token.v0';
export const ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_CANDIDATE_SCHEMA =
  'peercompute.ulg.schroeder-particle-storage-residency-adoption-candidate.v0';
export const ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_SCHEMA =
  'peercompute.ulg.schroeder-particle-storage-residency-adoption.v0';

export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS = Object.freeze({
  state: 'sph-state-buffer',
  thermo: 'sph-thermo-buffer',
  mechanics: 'mls-mpm-mechanics-buffer',
  metadata: 'schroeder-particle-storage-residency-metadata-buffer',
  dispatchIndirect: 'schroeder-particle-storage-residency-dispatch-indirect-buffer'
});

const REQUIRED_TARGET_STATE_FAMILIES = Object.freeze([
  'sph-particle-state',
  'mls-mpm-particle-mechanics',
  'sph-particle-thermo'
]);

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(nonEmptyString))];
}

function laneIdentityReady(identity = null) {
  return identity?.authoritative === true
    && [identity.leaseId, identity.laneId, identity.stateKey, identity.sourceFamily, identity.taskId]
      .every(nonEmptyString);
}

function retainedRef({ ref, family, role, byteLength, strideBytes, capacity }) {
  return Object.freeze({
    ref,
    family,
    role,
    byteLength: nonNegativeInteger(byteLength),
    strideBytes: nonNegativeInteger(strideBytes),
    capacity: nonNegativeInteger(capacity),
    transferMode: 'same-device-private-ref-resolved-after-state-manager-admission',
    rawGpuBufferSerialized: false,
    rawGpuBufferTransferable: false
  });
}

function blockedCandidate(reason, details = {}) {
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_CANDIDATE_SCHEMA,
    status: 'schroeder-particle-storage-residency-adoption-candidate-blocked',
    ready: false,
    adopted: false,
    reason,
    blockers: [reason],
    authoritativeParticleCount: null,
    normalHotLoopReadbackFree: true,
    ...details
  };
}

export function validateSchroederParticleStorageResidencyAdoptionToken(token, {
  requireCommitted = false
} = {}) {
  const issues = [];
  if (!token || typeof token !== 'object') {
    return { accepted: false, reason: 'token-not-object', issues: ['token-not-object'] };
  }
  if (token.schema !== ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_TOKEN_SCHEMA) {
    issues.push('unexpected-token-schema');
  }
  if (token.ready !== true) issues.push('token-not-ready');
  if (!nonEmptyString(token.taskId)) issues.push('missing-task-id');
  if (!nonEmptyString(token.stateKey)) issues.push('missing-state-key');
  if (!nonEmptyString(token.laneId)) issues.push('missing-lane-id');
  if (!nonEmptyString(token.leaseId)) issues.push('missing-lease-id');
  if (!nonEmptyString(token.sourceFamily)) issues.push('missing-source-family');
  if (!(nonNegativeInteger(token.generationId) > 0)) issues.push('invalid-generation');
  if (!(nonNegativeInteger(token.outputParticleCapacity) > 0)) issues.push('invalid-capacity');
  if (!Number.isInteger(Number(token.sourceParticleCount))
    || Number(token.sourceParticleCount) < 0) {
    issues.push('invalid-source-count');
  }
  if (nonNegativeInteger(token.sourceParticleCount) > nonNegativeInteger(token.outputParticleCapacity)) {
    issues.push('source-count-exceeds-capacity');
  }
  if (token.authoritativeParticleCount !== null) {
    issues.push('cpu-authoritative-count-prohibited');
  }
  if (token.authoritativeParticleCountAuthority !== 'gpu-authored-residency-metadata') {
    issues.push('invalid-authoritative-count-source');
  }
  if (
    token.authoritativeParticleCountMetadataWord
      !== SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.authoritativeActiveCount
  ) {
    issues.push('invalid-authoritative-count-metadata-word');
  }
  if (token.metadataSchema !== ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_SCHEMA) {
    issues.push('invalid-metadata-schema');
  }
  if (
    token.metadataExpectedMagic !== SCHROEDER_PARTICLE_STORAGE_RESIDENCY_MAGIC
    || token.metadataExpectedVersion !== SCHROEDER_PARTICLE_STORAGE_RESIDENCY_VERSION
  ) {
    issues.push('invalid-metadata-magic-or-version');
  }
  if (
    token.activeDispatchIndirectByteOffset
      !== SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET
    || token.selectionDispatchIndirectByteOffset
      !== SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET
  ) {
    issues.push('invalid-indirect-dispatch-offset');
  }
  if (token.copyMode !== 'descriptor-only-no-raw-gpubuffer-transfer') {
    issues.push('invalid-copy-mode');
  }
  if (token.stateManagerAdmissionRequired !== true) {
    issues.push('state-manager-admission-not-required');
  }
  if (token.authoritativeStateMutation !== true || token.conditionalGpuAdoption !== true) {
    issues.push('conditional-gpu-adoption-not-authoritative');
  }
  if (
    token.normalHotLoopReadbackFree !== true
    || token.mapAsyncCalled !== false
    || token.fullParticleReadbackPerformed !== false
  ) {
    issues.push('gpu-resident-no-readback-contract-invalid');
  }
  if (token.rawGpuBufferTransferAllowed !== false || token.rawGpuBufferTransferDetected !== false) {
    issues.push('raw-gpubuffer-transfer-detected');
  }
  const refs = uniqueStrings(token.retainedBufferRefs);
  for (const required of Object.values(SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS)) {
    if (!refs.includes(required)) issues.push(`missing-retained-ref:${required}`);
  }
  for (const family of REQUIRED_TARGET_STATE_FAMILIES) {
    if (!uniqueStrings(token.targetStateFamilies).includes(family)) {
      issues.push(`missing-target-family:${family}`);
    }
  }
  if (requireCommitted && token.stateManagerAdmissionCommitted !== true) {
    issues.push('state-manager-admission-not-committed');
  }
  return {
    accepted: issues.length === 0,
    reason: issues[0] || null,
    issues
  };
}

export function createSchroederParticleStorageResidencyAdoptionCandidate({
  device,
  particleStorageMaterialization = null,
  particleStorageCountSummary = null,
  particleStorageCompaction = null,
  computeManagerLaneIdentity = null,
  generationId = particleStorageCompaction?.residency?.generationId ?? 0
} = {}) {
  const countResidency = particleStorageCountSummary?.residency;
  const compactionResidency = particleStorageCompaction?.residency;
  const capacity = nonNegativeInteger(particleStorageCompaction?.outputParticleCapacity);
  const sourceParticleCount = nonNegativeInteger(particleStorageCompaction?.sourceParticleCount);
  const generation = nonNegativeInteger(generationId);
  const targetStateFamilies = uniqueStrings(
    particleStorageCompaction?.targetStateFamilies?.length
      ? particleStorageCompaction.targetStateFamilies
      : particleStorageMaterialization?.targetStateFamilies
  );
  if (!laneIdentityReady(computeManagerLaneIdentity)) {
    return blockedCandidate('compute-manager-lane-identity-required');
  }
  if (
    countResidency?.device !== device
    || compactionResidency?.device !== device
    || countResidency?.summaryKind !== SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND.count
    || compactionResidency?.summaryKind !== SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND.compaction
  ) {
    return blockedCandidate('same-device-count-and-compaction-residency-required');
  }
  if (
    particleStorageCountSummary?.normalHotLoopReadbackFree !== true
    || particleStorageCompaction?.normalHotLoopReadbackFree !== true
    || particleStorageCountSummary?.compactSummaryReadbackPerformed === true
    || particleStorageCompaction?.compactSummaryReadbackPerformed === true
    || particleStorageCountSummary?.mapAsyncCalled === true
    || particleStorageCompaction?.mapAsyncCalled === true
    || particleStorageCountSummary?.authoritativeParticleCount !== null
    || particleStorageCompaction?.authoritativeParticleCount !== null
  ) {
    return blockedCandidate('particle-storage-residency-no-map-gpu-count-contract-required');
  }
  if (
    generation <= 0
    || generation !== nonNegativeInteger(countResidency.generationId)
    || generation !== nonNegativeInteger(compactionResidency.generationId)
  ) {
    return blockedCandidate('particle-storage-residency-generation-mismatch');
  }
  if (
    capacity <= 0
    || capacity !== nonNegativeInteger(countResidency.outputParticleCapacity)
    || capacity !== nonNegativeInteger(compactionResidency.outputParticleCapacity)
    || sourceParticleCount !== nonNegativeInteger(countResidency.sourceParticleCount)
    || sourceParticleCount !== nonNegativeInteger(compactionResidency.sourceParticleCount)
  ) {
    return blockedCandidate('particle-storage-residency-count-or-capacity-mismatch');
  }
  if (
    !particleStorageCompaction?.particleStateBuffer
    || !particleStorageCompaction?.particleThermoBuffer
    || !particleStorageCompaction?.particleMechanicsBuffer
    || !compactionResidency.metadataBuffer
    || !compactionResidency.dispatchIndirectBuffer
  ) {
    return blockedCandidate('particle-storage-residency-retained-buffers-required');
  }
  if (particleStorageMaterialization?.particleStorageMaterializationAdmissionApproved !== true) {
    return blockedCandidate('particle-storage-materialization-admission-required');
  }
  if (!REQUIRED_TARGET_STATE_FAMILIES.every((family) => targetStateFamilies.includes(family))) {
    return blockedCandidate('particle-storage-target-state-families-incomplete');
  }
  const stateStrideBytes = SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const thermoStrideBytes = SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const mechanicsStrideBytes = MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const retainedBufferRefs = Object.values(SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS);
  const retainedRefs = [
    retainedRef({
      ref: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS.state,
      family: 'sph-particle-state',
      role: 'particle-state',
      byteLength: particleStorageCompaction.stateBufferByteLength,
      strideBytes: stateStrideBytes,
      capacity
    }),
    retainedRef({
      ref: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS.thermo,
      family: 'sph-particle-thermo',
      role: 'particle-thermo',
      byteLength: particleStorageCompaction.thermoBufferByteLength,
      strideBytes: thermoStrideBytes,
      capacity
    }),
    retainedRef({
      ref: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS.mechanics,
      family: 'mls-mpm-particle-mechanics',
      role: 'particle-mechanics',
      byteLength: particleStorageCompaction.mechanicsBufferByteLength,
      strideBytes: mechanicsStrideBytes,
      capacity
    }),
    retainedRef({
      ref: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS.metadata,
      family: 'schroeder-particle-storage',
      role: 'authoritative-count-status-metadata',
      byteLength: compactionResidency.metadataBufferByteLength,
      strideBytes: Uint32Array.BYTES_PER_ELEMENT,
      capacity: compactionResidency.metadataBufferByteLength / Uint32Array.BYTES_PER_ELEMENT
    }),
    retainedRef({
      ref: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS.dispatchIndirect,
      family: 'schroeder-particle-storage',
      role: 'active-and-adoption-indirect-dispatch',
      byteLength: compactionResidency.dispatchIndirectBufferByteLength,
      strideBytes: 3 * Uint32Array.BYTES_PER_ELEMENT,
      capacity: 2
    })
  ];
  const admissionToken = Object.freeze({
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_TOKEN_SCHEMA,
    status: 'schroeder-particle-storage-residency-token-awaiting-state-manager-admission',
    ready: true,
    adopted: false,
    taskId: computeManagerLaneIdentity.taskId,
    stateKey: computeManagerLaneIdentity.stateKey,
    laneId: computeManagerLaneIdentity.laneId,
    leaseId: computeManagerLaneIdentity.leaseId,
    sourceFamily: computeManagerLaneIdentity.sourceFamily,
    generationId: generation,
    sourceParticleCount,
    outputParticleCapacity: capacity,
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
    activeDispatchIndirectByteOffset:
      SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET,
    selectionDispatchIndirectByteOffset:
      SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET,
    consumerGuardProtocol:
      'metadata-magic-version-ready-generation-zero-invalid-mask-and-gid-before-active-count',
    failCloseProtocol: 'invalid-no-topology-or-stale-generation-authors-zero-indirect-x',
    targetStateFamilies,
    retainedBufferRefs,
    retainedRefs,
    stateBufferRef: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS.state,
    thermoBufferRef: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS.thermo,
    mechanicsBufferRef: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS.mechanics,
    metadataBufferRef: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS.metadata,
    dispatchIndirectBufferRef:
      SCHROEDER_PARTICLE_STORAGE_RESIDENCY_RETAINED_REFS.dispatchIndirect,
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
  });
  const validation = validateSchroederParticleStorageResidencyAdoptionToken(admissionToken);
  if (!validation.accepted) {
    return blockedCandidate(validation.reason, { validation });
  }
  let destroyed = false;
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_CANDIDATE_SCHEMA,
    status: 'schroeder-particle-storage-residency-candidate-awaiting-state-manager-admission',
    ready: true,
    adopted: false,
    device,
    generationId: generation,
    sourceParticleCount,
    outputParticleCapacity: capacity,
    authoritativeParticleCount: null,
    authoritativeParticleCountAuthority: admissionToken.authoritativeParticleCountAuthority,
    authoritativeParticleCountMetadataWord:
      admissionToken.authoritativeParticleCountMetadataWord,
    admissionToken,
    stateBuffer: particleStorageCompaction.particleStateBuffer,
    thermoBuffer: particleStorageCompaction.particleThermoBuffer,
    mechanicsBuffer: particleStorageCompaction.particleMechanicsBuffer,
    stateBufferByteLength: particleStorageCompaction.stateBufferByteLength,
    thermoBufferByteLength: particleStorageCompaction.thermoBufferByteLength,
    mechanicsBufferByteLength: particleStorageCompaction.mechanicsBufferByteLength,
    stateStrideBytes,
    thermoStrideBytes,
    mechanicsStrideBytes,
    residencyMetadataBuffer: compactionResidency.metadataBuffer,
    residencyDispatchIndirectBuffer: compactionResidency.dispatchIndirectBuffer,
    activeDispatchIndirectByteOffset: admissionToken.activeDispatchIndirectByteOffset,
    selectionDispatchIndirectByteOffset: admissionToken.selectionDispatchIndirectByteOffset,
    targetStateFamilies,
    retainedBufferRefs,
    normalHotLoopReadbackFree: true,
    fullParticleReadbackPerformed: false,
    mapAsyncCalled: false,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      particleStorageCompaction.destroyParticleBuffers?.();
    }
  };
}

function committedAdmissionIdentity(admission = null) {
  const payload = admission?.payload
    ?? admission?.warmEntry?.payload
    ?? admission?.committedDelta?.payload
    ?? null;
  return {
    accepted: admission?.accepted === true,
    committed: admission?.status === 'committed' || admission?.committed === true,
    taskId: admission?.taskId ?? admission?.committedDelta?.taskId ?? payload?.producerTaskId ?? null,
    stateKey: admission?.stateKey ?? payload?.stateKey ?? null,
    laneId: admission?.laneId ?? payload?.gpuFence?.laneId ?? null,
    gpuFenceSatisfied:
      admission?.gpuFence?.fenceSatisfied === true
      || payload?.gpuFence?.fenceSatisfied === true,
    admissionId: admission?.admissionId ?? admission?.sequence ?? null
  };
}

export function createStateManagerAdmittedSchroederParticleStorageResidencyAdoption({
  candidate,
  stateManagerAdmission
} = {}) {
  if (candidate?.schema !== ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_CANDIDATE_SCHEMA
    || candidate.ready !== true) {
    return blockedCandidate('ready-particle-storage-residency-candidate-required');
  }
  const token = candidate.admissionToken;
  const validation = validateSchroederParticleStorageResidencyAdoptionToken(token);
  if (!validation.accepted) {
    return blockedCandidate(validation.reason, { validation });
  }
  const admission = committedAdmissionIdentity(stateManagerAdmission);
  if (!admission.accepted || !admission.committed || !admission.gpuFenceSatisfied) {
    return blockedCandidate('committed-state-manager-admission-with-satisfied-gpu-fence-required');
  }
  if (
    admission.taskId !== token.taskId
    || admission.stateKey !== token.stateKey
    || admission.laneId !== token.laneId
  ) {
    return blockedCandidate('state-manager-admission-identity-mismatch');
  }
  const committedToken = Object.freeze({
    ...token,
    status: 'state-manager-admitted-schroeder-particle-storage-residency-token',
    adopted: true,
    stateManagerAdmissionCommitted: true,
    stateManagerAdmissionId: admission.admissionId
  });
  const committedValidation = validateSchroederParticleStorageResidencyAdoptionToken(
    committedToken,
    { requireCommitted: true }
  );
  if (!committedValidation.accepted) {
    return blockedCandidate(committedValidation.reason, { validation: committedValidation });
  }
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_SCHEMA,
    status: 'state-manager-admitted-schroeder-particle-storage-residency-adoption',
    ready: true,
    adopted: true,
    conditionalGpuAdoption: true,
    device: candidate.device,
    generationId: candidate.generationId,
    sourceParticleCount: candidate.sourceParticleCount,
    outputParticleCapacity: candidate.outputParticleCapacity,
    authoritativeParticleCount: null,
    authoritativeParticleCountAuthority: candidate.authoritativeParticleCountAuthority,
    authoritativeParticleCountMetadataWord: candidate.authoritativeParticleCountMetadataWord,
    stateBuffer: candidate.stateBuffer,
    thermoBuffer: candidate.thermoBuffer,
    mechanicsBuffer: candidate.mechanicsBuffer,
    stateBufferByteLength: candidate.stateBufferByteLength,
    thermoBufferByteLength: candidate.thermoBufferByteLength,
    mechanicsBufferByteLength: candidate.mechanicsBufferByteLength,
    stateStrideBytes: candidate.stateStrideBytes,
    thermoStrideBytes: candidate.thermoStrideBytes,
    mechanicsStrideBytes: candidate.mechanicsStrideBytes,
    residencyMetadataBuffer: candidate.residencyMetadataBuffer,
    residencyDispatchIndirectBuffer: candidate.residencyDispatchIndirectBuffer,
    activeDispatchIndirectByteOffset: candidate.activeDispatchIndirectByteOffset,
    selectionDispatchIndirectByteOffset: candidate.selectionDispatchIndirectByteOffset,
    targetStateFamilies: [...candidate.targetStateFamilies],
    retainedBufferRefs: [...candidate.retainedBufferRefs],
    admissionToken: committedToken,
    stateManagerAdmission,
    stateManagerAdmissionId: admission.admissionId,
    normalHotLoopReadbackFree: true,
    fullParticleReadbackPerformed: false,
    mapAsyncCalled: false,
    destroy: candidate.destroy
  };
}
