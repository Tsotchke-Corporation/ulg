import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  attachSchroederParticleCountResidencyToUpload,
  createSchroederParticleCountResidencyDescriptor,
  dispatchSchroederParticleWorkgroups,
  resolveSchroederParticleCountResidency,
  schroederParticleIterationCapacity
} from '../src/runtime/sph/schroederParticleCountResidencyGpu.js';

function candidate() {
  return {
    ready: true,
    generationId: 9,
    outputParticleCapacity: 12,
    authoritativeParticleCountMetadataWord: 4,
    activeDispatchIndirectByteOffset: 0,
    selectionDispatchIndirectByteOffset: 12,
    residencyMetadataBuffer: { label: 'metadata' },
    residencyDispatchIndirectBuffer: { label: 'dispatch' },
    admissionToken: { schema: 'token' }
  };
}

test('particle-count residency attaches capacity without manufacturing a JS count', () => {
  const residency = createSchroederParticleCountResidencyDescriptor(candidate());
  const sphUpload = attachSchroederParticleCountResidencyToUpload({
    status: 'webgpu-uploaded',
    particleCount: 5
  }, residency);
  const mechanicsUpload = attachSchroederParticleCountResidencyToUpload({
    status: 'webgpu-uploaded',
    particleCount: 5
  }, residency);
  const resolved = resolveSchroederParticleCountResidency({
    sphParticleUpload: sphUpload,
    mlsMpmParticleUpload: mechanicsUpload
  });

  assert.equal(sphUpload.particleCount, 5);
  assert.equal(sphUpload.particleCapacity, 12);
  assert.equal(sphUpload.authoritativeParticleCount, null);
  assert.equal(sphUpload.particleCountCpuDecoded, false);
  assert.equal(resolved.outputParticleCapacity, 12);
  assert.equal(resolveSchroederParticleCountResidency({
    artifact: candidate()
  }).outputParticleCapacity, 12);
  assert.equal(schroederParticleIterationCapacity({
    sphParticleState: { particleCount: 5 },
    sphParticleUpload: sphUpload,
    mlsMpmParticleUpload: mechanicsUpload
  }), 12);
});

test('particle-count residency dispatches indirectly and rejects split lane epochs', () => {
  const residency = createSchroederParticleCountResidencyDescriptor(candidate());
  const calls = [];
  const mode = dispatchSchroederParticleWorkgroups({
    dispatchWorkgroupsIndirect(buffer, offset) { calls.push({ buffer, offset }); }
  }, { residency, fallbackParticleCount: 5 });
  assert.equal(mode, 'gpu-authored-active-count-indirect');
  assert.deepEqual(calls, [{ buffer: residency.dispatchIndirectBuffer, offset: 0 }]);

  const first = attachSchroederParticleCountResidencyToUpload({}, residency);
  const second = attachSchroederParticleCountResidencyToUpload({}, {
    ...residency,
    metadataBuffer: { label: 'wrong-metadata' }
  });
  assert.throws(
    () => resolveSchroederParticleCountResidency({
      sphParticleUpload: first,
      mlsMpmParticleUpload: second
    }),
    /one GPU lane epoch/
  );
});
