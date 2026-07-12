import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  encodeSchroederParticleStorageContinuationSelectionWebGpu,
  schroederParticleStorageContinuationSelectionWgsl
} from '../src/runtime/sph/schroederParticleStorageContinuationGpu.js';

function fakeGpu() {
  const passes = [];
  const buffers = [];
  const bindGroupLayouts = [];
  const device = {
    limits: {},
    queue: { writeBuffer() {} },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { buffer.destroyed = true; }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createBindGroupLayout(descriptor) {
      bindGroupLayouts.push(descriptor);
      return descriptor;
    },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return { label: descriptor.label, descriptor };
    },
    createBindGroup(descriptor) { return descriptor; }
  };
  const commandEncoder = {
    beginComputePass(descriptor) {
      const pass = { label: descriptor.label };
      passes.push(pass);
      return {
        setPipeline(pipeline) { pass.pipeline = pipeline.label; },
        setBindGroup() {},
        dispatchWorkgroups(x, y = 1, z = 1) { pass.direct = [x, y, z]; },
        dispatchWorkgroupsIndirect(buffer, offset) { pass.indirect = { buffer, offset }; },
        end() { pass.ended = true; }
      };
    }
  };
  return { device, commandEncoder, passes, buffers, bindGroupLayouts };
}

function buffer(label) {
  return { label, destroyed: false, destroy() { this.destroyed = true; } };
}

test('continuation selector copies fallback then uses active and selection indirect offsets', () => {
  const { device, commandEncoder, passes, bindGroupLayouts } = fakeGpu();
  const original = {
    destroyed: false,
    ready: true,
    device,
    generationId: 7,
    sourceParticleCount: 3,
    outputParticleCapacity: 6,
    stateBuffer: buffer('candidate-state'),
    thermoBuffer: buffer('candidate-thermo'),
    mechanicsBuffer: buffer('candidate-mechanics'),
    residencyMetadataBuffer: buffer('candidate-metadata'),
    residencyDispatchIndirectBuffer: buffer('candidate-dispatch'),
    activeDispatchIndirectByteOffset: 0,
    selectionDispatchIndirectByteOffset: 12,
    authoritativeParticleCountMetadataWord: 4,
    admissionToken: { schema: 'clone-safe-token' },
    destroy() { original.destroyed = true; }
  };
  const selected = encodeSchroederParticleStorageContinuationSelectionWebGpu({
    device,
    commandEncoder,
    particleStorageResidencyAdoptionCandidate: original,
    fallbackStateBuffer: buffer('fallback-state'),
    fallbackThermoBuffer: buffer('fallback-thermo'),
    fallbackMechanicsBuffer: buffer('fallback-mechanics'),
    fallbackParticleCount: 3
  });

  assert.equal(selected.authoritativeParticleCount, null);
  assert.equal(selected.outputParticleCapacity, 6);
  assert.equal(selected.mapAsyncCalled, false);
  assert.equal(passes[0].label.endsWith('copy-fallback-pass'), true);
  assert.deepEqual(passes[0].direct, [1, 1, 1]);
  assert.equal(passes[1].indirect.offset, 0);
  assert.deepEqual(passes[2].direct, [1, 1, 1]);
  assert.equal(passes[3].indirect.offset, 12);
  assert.deepEqual(
    bindGroupLayouts.map((layout) => layout.entries.filter(
      (entry) => entry.buffer?.type !== 'uniform'
    ).length),
    [6, 7, 2, 4]
  );
  selected.releaseTransientBuffers();
  selected.destroy();
  assert.equal(selected.stateBuffer.destroyed, true);
  assert.equal(selected.residencyMetadataBuffer.destroyed, true);
  assert.equal(original.destroyed, true);
});

test('continuation selector shader keeps fallback and candidate decisions GPU-side', () => {
  assert.match(schroederParticleStorageContinuationSelectionWgsl, /fn copy_fallback/);
  assert.match(schroederParticleStorageContinuationSelectionWgsl, /fn copy_candidate/);
  assert.match(schroederParticleStorageContinuationSelectionWgsl, /fn init_fallback_metadata/);
  assert.match(schroederParticleStorageContinuationSelectionWgsl, /fn select_candidate_metadata/);
  assert.match(schroederParticleStorageContinuationSelectionWgsl, /candidate_metadata\[4\]/);
  assert.match(schroederParticleStorageContinuationSelectionWgsl, /candidate_metadata\[9\] == 0u/);
});
