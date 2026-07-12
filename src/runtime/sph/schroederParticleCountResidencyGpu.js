import {
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET
} from './schroederParticleStorageResidencyGpu.js';

export const ULG_SCHROEDER_PARTICLE_COUNT_RESIDENCY_LOCAL_SCHEMA =
  'peercompute.ulg.schroeder-particle-count-residency-local.v0';

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function localDescriptor(value = null) {
  if (!value || typeof value !== 'object') return null;
  if (value.schema === ULG_SCHROEDER_PARTICLE_COUNT_RESIDENCY_LOCAL_SCHEMA) return value;
  if (value.residencyMetadataBuffer && value.residencyDispatchIndirectBuffer) {
    return createSchroederParticleCountResidencyDescriptor(value);
  }
  const metadataBuffer = value.particleCountResidencyMetadataBuffer ?? null;
  const dispatchIndirectBuffer = value.particleCountDispatchIndirectBuffer ?? null;
  if (!metadataBuffer || !dispatchIndirectBuffer) return null;
  return {
    schema: ULG_SCHROEDER_PARTICLE_COUNT_RESIDENCY_LOCAL_SCHEMA,
    status: value.particleCountResidencyStatus
      ?? 'gpu-authored-particle-count-residency-ready',
    ready: value.particleCountAuthority === 'gpu-authored-residency-metadata'
      && value.authoritativeParticleCount == null,
    metadataBuffer,
    dispatchIndirectBuffer,
    activeDispatchIndirectByteOffset:
      value.particleCountDispatchIndirectByteOffset
      ?? SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET,
    selectionDispatchIndirectByteOffset:
      value.particleCountSelectionIndirectByteOffset
      ?? SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET,
    authoritativeParticleCountMetadataWord:
      value.particleCountMetadataWord
      ?? SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.authoritativeActiveCount,
    outputParticleCapacity: nonNegativeInteger(value.particleCapacity),
    generationId: nonNegativeInteger(value.particleCountResidencyGenerationId),
    authoritativeParticleCount: null,
    authoritativeParticleCountAuthority: value.particleCountAuthority,
    admissionToken: value.particleCountResidencyToken ?? null,
    normalHotLoopReadbackFree: value.normalHotLoopReadbackFree !== false
  };
}

export function createSchroederParticleCountResidencyDescriptor(candidate = null) {
  if (!candidate?.residencyMetadataBuffer || !candidate?.residencyDispatchIndirectBuffer) {
    return null;
  }
  const token = candidate.admissionToken ?? null;
  const descriptor = {
    schema: ULG_SCHROEDER_PARTICLE_COUNT_RESIDENCY_LOCAL_SCHEMA,
    status: 'gpu-authored-particle-count-residency-ready',
    ready: candidate.ready === true,
    metadataBuffer: candidate.residencyMetadataBuffer,
    dispatchIndirectBuffer: candidate.residencyDispatchIndirectBuffer,
    activeDispatchIndirectByteOffset:
      candidate.activeDispatchIndirectByteOffset
      ?? token?.activeDispatchIndirectByteOffset
      ?? SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET,
    selectionDispatchIndirectByteOffset:
      candidate.selectionDispatchIndirectByteOffset
      ?? token?.selectionDispatchIndirectByteOffset
      ?? SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET,
    authoritativeParticleCountMetadataWord:
      candidate.authoritativeParticleCountMetadataWord
      ?? token?.authoritativeParticleCountMetadataWord
      ?? SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.authoritativeActiveCount,
    outputParticleCapacity: nonNegativeInteger(
      candidate.outputParticleCapacity ?? token?.outputParticleCapacity
    ),
    generationId: nonNegativeInteger(candidate.generationId ?? token?.generationId),
    authoritativeParticleCount: null,
    authoritativeParticleCountAuthority: 'gpu-authored-residency-metadata',
    admissionToken: token,
    normalHotLoopReadbackFree: true
  };
  if (
    descriptor.ready !== true
    || descriptor.outputParticleCapacity <= 0
    || descriptor.generationId <= 0
    || descriptor.authoritativeParticleCountMetadataWord
      !== SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.authoritativeActiveCount
  ) {
    return null;
  }
  return descriptor;
}

export function attachSchroederParticleCountResidencyToUpload(upload, residency) {
  if (!upload || !residency?.ready) return upload;
  return {
    ...upload,
    particleCount: upload.particleCount ?? null,
    particleCapacity: residency.outputParticleCapacity,
    authoritativeParticleCount: null,
    particleCountAuthority: 'gpu-authored-residency-metadata',
    particleCountCpuDecoded: false,
    particleCountMetadataWord: residency.authoritativeParticleCountMetadataWord,
    particleCountResidencyGenerationId: residency.generationId,
    particleCountResidencyMetadataBuffer: residency.metadataBuffer,
    particleCountDispatchIndirectBuffer: residency.dispatchIndirectBuffer,
    particleCountDispatchIndirectByteOffset: residency.activeDispatchIndirectByteOffset,
    particleCountSelectionIndirectByteOffset: residency.selectionDispatchIndirectByteOffset,
    particleCountResidencyToken: residency.admissionToken,
    particleCountResidencyStatus: residency.status,
    normalHotLoopReadbackFree: true
  };
}

export function resolveSchroederParticleCountResidency({
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  artifact = null
} = {}) {
  const sph = localDescriptor(sphParticleUpload);
  const mechanics = localDescriptor(mlsMpmParticleUpload);
  const direct = localDescriptor(artifact);
  const residency = sph || mechanics || direct;
  if (!residency?.ready) return null;
  for (const other of [sph, mechanics, direct].filter(Boolean)) {
    if (
      other.metadataBuffer !== residency.metadataBuffer
      || other.dispatchIndirectBuffer !== residency.dispatchIndirectBuffer
      || other.activeDispatchIndirectByteOffset !== residency.activeDispatchIndirectByteOffset
      || other.outputParticleCapacity !== residency.outputParticleCapacity
      || other.generationId !== residency.generationId
    ) {
      throw new Error('Schroeder particle-count residency descriptors must share one GPU lane epoch');
    }
  }
  return residency;
}

export function schroederParticleIterationCapacity({
  sphParticleState = null,
  mlsMpmParticleState = null,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  artifact = null
} = {}) {
  const residency = resolveSchroederParticleCountResidency({
    sphParticleUpload,
    mlsMpmParticleUpload,
    artifact
  });
  if (residency) return residency.outputParticleCapacity;
  return nonNegativeInteger(
    sphParticleState?.particleCount ?? mlsMpmParticleState?.particleCount
      ?? artifact?.particleRowCapacity ?? artifact?.particleCount
  );
}

export function dispatchSchroederParticleWorkgroups(pass, {
  residency = null,
  fallbackParticleCount = 0,
  workgroupSize = 64
} = {}) {
  if (!pass) throw new TypeError('Schroeder particle dispatch requires a compute pass');
  if (residency?.ready) {
    if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
      throw new TypeError('GPU-authored particle count requires indirect dispatch support');
    }
    pass.dispatchWorkgroupsIndirect(
      residency.dispatchIndirectBuffer,
      residency.activeDispatchIndirectByteOffset
    );
    return 'gpu-authored-active-count-indirect';
  }
  pass.dispatchWorkgroups(Math.max(
    1,
    Math.ceil(nonNegativeInteger(fallbackParticleCount) / Math.max(1, nonNegativeInteger(workgroupSize, 64)))
  ));
  return 'host-known-particle-count-direct';
}

export function schroederParticleCountResidencyPublicFields(residency = null) {
  if (!residency?.ready) return {};
  return {
    authoritativeParticleCount: null,
    authoritativeParticleCountAuthority: residency.authoritativeParticleCountAuthority,
    authoritativeParticleCountMetadataWord:
      residency.authoritativeParticleCountMetadataWord,
    particleRowCapacity: residency.outputParticleCapacity,
    particleCountResidencyGenerationId: residency.generationId,
    particleCountDispatchMode: 'gpu-authored-active-count-indirect',
    particleCountDispatchIndirectByteOffset: residency.activeDispatchIndirectByteOffset,
    particleCountSelectionIndirectByteOffset: residency.selectionDispatchIndirectByteOffset,
    normalHotLoopReadbackFree: true
  };
}
