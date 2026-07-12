import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_DISPATCH_BYTES,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_MAGIC,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_BYTES,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_VERSION,
  createSchroederParticleStorageResidencyFinalizeParamsArray,
  schroederParticleStorageResidencyFinalizeWgsl,
  schroederParticleStorageResidentCompactionWgsl
} from '../src/runtime/sph/schroederParticleStorageResidencyGpu.js';
import {
  encodeSchroederParticleStorageCountSummaryWebGpu
} from '../src/runtime/sph/schroederParticleStorageCountGpu.js';
import {
  encodeSchroederParticleStorageCompactionWebGpu
} from '../src/runtime/sph/schroederParticleStorageCompactionGpu.js';

function fakeGpu() {
  const buffers = [];
  const passes = [];
  const clears = [];
  const writes = [];
  const submissions = [];
  const bindGroups = [];
  const commandEncoder = {
    clearBuffer(buffer, offset = 0, size = buffer.size) {
      clears.push({ buffer, offset, size });
    },
    beginComputePass(descriptor = {}) {
      const record = { label: descriptor.label || null };
      passes.push(record);
      return {
        setPipeline(pipeline) { record.pipeline = pipeline.label; },
        setBindGroup(index, bindGroup) { record.bindGroup = { index, bindGroup }; },
        dispatchWorkgroups(x, y = 1, z = 1) { record.dispatch = [x, y, z]; },
        dispatchWorkgroupsIndirect(buffer, offset) {
          record.dispatchIndirect = { buffer, offset };
        },
        end() { record.ended = true; }
      };
    }
  };
  const device = {
    buffers,
    passes,
    clears,
    writes,
    submissions,
    bindGroups,
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, byteLength: data.byteLength });
      },
      submit(commandBuffers) { submissions.push(commandBuffers); }
    },
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
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) { return { ...descriptor, label: descriptor.label }; },
    createBindGroup(descriptor) {
      const bindGroup = { ...descriptor };
      bindGroups.push(bindGroup);
      return bindGroup;
    }
  };
  return { device, commandEncoder };
}

function borrowedBuffer(label, size = 4096) {
  return { label, size, destroyed: false, destroy() { this.destroyed = true; } };
}

test('residency metadata layout separates authoritative active count from capacity', () => {
  assert.equal(SCHROEDER_PARTICLE_STORAGE_RESIDENCY_MAGIC, 0x53535052);
  assert.equal(SCHROEDER_PARTICLE_STORAGE_RESIDENCY_VERSION, 1);
  assert.equal(SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_BYTES, 64);
  assert.equal(SCHROEDER_PARTICLE_STORAGE_RESIDENCY_DISPATCH_BYTES, 24);
  assert.equal(SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.authoritativeActiveCount, 4);
  assert.equal(SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.outputParticleCapacity, 6);
  assert.equal(SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET, 0);
  assert.equal(SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET, 12);

  const params = new DataView(createSchroederParticleStorageResidencyFinalizeParamsArray({
    outputParticleCapacity: 400,
    consumerWorkgroupSize: 64,
    summaryKind: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND.count,
    generationId: 17,
    sourceParticleCount: 250,
    flags: 3
  }));
  assert.equal(params.getUint32(0, true), 400);
  assert.equal(params.getUint32(4, true), 64);
  assert.equal(params.getUint32(8, true), 1);
  assert.equal(params.getUint32(12, true), 17);
  assert.equal(params.getUint32(16, true), 3);
  assert.equal(params.getUint32(20, true), 250);
});

test('resident count encoder authors retained metadata without local submit or map', () => {
  const { device, commandEncoder } = fakeGpu();
  const materializationBuffer = borrowedBuffer('materialization');
  const result = encodeSchroederParticleStorageCountSummaryWebGpu({
    device,
    commandEncoder,
    materializationBuffer,
    materializationRowCount: 6,
    sourceParticleCount: 5,
    outputParticleCapacity: 12,
    generationId: 9
  });

  assert.equal(result.status, 'schroeder-particle-storage-count-summary-encoded-awaiting-submit');
  assert.equal(result.outputParticleCapacity, 12);
  assert.equal(result.authoritativeParticleCount, null);
  assert.equal(result.authoritativeParticleCountMetadataWord, 4);
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(result.compactSummaryReadbackPerformed, false);
  assert.equal(result.mapAsyncCalled, false);
  assert.equal(result.queueSubmitPerformed, false);
  assert.equal(device.submissions.length, 0);
  assert.equal(device.buffers.some((buffer) => (buffer.usage & 1) !== 0), false);
  assert.equal(device.passes.length, 2);
  assert.deepEqual(device.passes[0].dispatch, [1, 1, 1]);
  assert.deepEqual(device.passes[1].dispatch, [1, 1, 1]);
  assert.ok((result.particleStorageResidencyDispatchIndirectBuffer.usage & 256) !== 0);
  assert.ok(device.clears.some(({ buffer }) => buffer === result.summaryBuffer));
  assert.ok(device.clears.some(
    ({ buffer }) => buffer === result.particleStorageResidencyMetadataBuffer
  ));
  assert.ok(device.clears.some(
    ({ buffer }) => buffer === result.particleStorageResidencyDispatchIndirectBuffer
  ));

  result.releaseTransientBuffers();
  assert.equal(materializationBuffer.destroyed, false);
  result.destroyRetainedEvidenceBuffers();
  assert.equal(result.summaryBuffer.destroyed, true);
  assert.equal(result.particleStorageResidencyMetadataBuffer.destroyed, true);
  assert.equal(result.particleStorageResidencyDispatchIndirectBuffer.destroyed, true);
});

test('resident compaction consumes count selection indirectly and keeps count GPU-owned', () => {
  const { device, commandEncoder } = fakeGpu();
  const materialization = {
    materializationBuffer: borrowedBuffer('materialization'),
    particleStateBuffer: borrowedBuffer('state'),
    particleThermoBuffer: borrowedBuffer('thermo'),
    particleMechanicsBuffer: borrowedBuffer('mechanics'),
    assignmentRowCount: 6,
    materializationStrideFloats: 32,
    sourceParticleCount: 5,
    outputParticleCapacity: 12,
    targetStateFamilies: [
      'sph-particle-state',
      'mls-mpm-particle-mechanics',
      'sph-particle-thermo'
    ],
    particleStorageMaterializationAdmissionApproved: true
  };
  const count = encodeSchroederParticleStorageCountSummaryWebGpu({
    device,
    commandEncoder,
    particleStorageMaterialization: materialization,
    generationId: 11
  });
  const compacted = encodeSchroederParticleStorageCompactionWebGpu({
    device,
    commandEncoder,
    particleStorageMaterialization: materialization,
    countResidency: count.residency
  });

  const compactionPass = device.passes.find(
    (pass) => pass.label === 'ulg-schroeder-particle-storage-compaction-resident-pass'
  );
  assert.equal(compactionPass.dispatchIndirect.buffer, count.residency.dispatchIndirectBuffer);
  assert.equal(
    compactionPass.dispatchIndirect.offset,
    SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET
  );
  assert.equal(compacted.authoritativeParticleCount, null);
  assert.equal(compacted.liveParticleCount, null);
  assert.equal(compacted.admittedParticleCountDelta, null);
  assert.equal(compacted.outputParticleCapacity, 12);
  assert.equal(compacted.scanCountAuthority, 'gpu-authored-count-residency-metadata-high-water');
  assert.equal(compacted.capacityTailPolicy, 'ignored-beyond-gpu-authoritative-high-water-count');
  assert.equal(compacted.normalHotLoopReadbackFree, true);
  assert.equal(compacted.queueSubmitPerformed, false);
  assert.equal(device.submissions.length, 0);
  assert.equal(device.buffers.some((buffer) => (buffer.usage & 1) !== 0), false);
  assert.equal(compacted.particleStateBuffer.size, 12 * 2 * 16);
  assert.equal(compacted.particleThermoBuffer.size, 12 * 3 * 16);
  assert.equal(compacted.particleMechanicsBuffer.size, 12 * 8 * 16);
  assert.deepEqual(compacted.targetStateFamilies, materialization.targetStateFamilies);

  count.releaseTransientBuffers();
  compacted.releaseTransientBuffers();
  count.destroyRetainedEvidenceBuffers();
  compacted.destroyParticleBuffers();
});

test('resident compaction rejects capacity or generation drift before encoding', () => {
  const { device, commandEncoder } = fakeGpu();
  const materialization = {
    materializationBuffer: borrowedBuffer('materialization'),
    particleStateBuffer: borrowedBuffer('state'),
    particleThermoBuffer: borrowedBuffer('thermo'),
    particleMechanicsBuffer: borrowedBuffer('mechanics'),
    assignmentRowCount: 2,
    materializationStrideFloats: 32,
    sourceParticleCount: 2,
    outputParticleCapacity: 4
  };
  const count = encodeSchroederParticleStorageCountSummaryWebGpu({
    device,
    commandEncoder,
    particleStorageMaterialization: materialization,
    generationId: 5
  });
  assert.throws(
    () => encodeSchroederParticleStorageCompactionWebGpu({
      device,
      commandEncoder,
      particleStorageMaterialization: { ...materialization, outputParticleCapacity: 5 },
      countResidency: count.residency
    }),
    /capacity must match/
  );
  assert.throws(
    () => encodeSchroederParticleStorageCompactionWebGpu({
      device,
      commandEncoder,
      particleStorageMaterialization: materialization,
      countResidency: count.residency,
      generationId: 6
    }),
    /generation must match/
  );
  assert.throws(
    () => encodeSchroederParticleStorageCompactionWebGpu({
      device,
      commandEncoder,
      particleStorageMaterialization: { ...materialization, sourceParticleCount: 3 },
      countResidency: count.residency
    }),
    /source count must match/
  );
  count.releaseTransientBuffers();
  count.destroyRetainedEvidenceBuffers();
});

test('manufactured invalid summary and poisoned capacity tail fail closed in GPU shaders', () => {
  assert.match(
    schroederParticleStorageResidencyFinalizeWgsl,
    /residency_dispatch\[0\] = 0u;/
  );
  assert.match(
    schroederParticleStorageResidencyFinalizeWgsl,
    /residency_dispatch\[3\] = 0u;/
  );
  assert.match(
    schroederParticleStorageResidencyFinalizeWgsl,
    /holes_value > 0\.0[\s\S]*written_value <= 0\.0/
  );
  assert.match(
    schroederParticleStorageResidencyFinalizeWgsl,
    /active_value != source_value \+ delta_value/
  );
  assert.match(
    schroederParticleStorageResidentCompactionWgsl,
    /min\(params\.scan_slot_count, count_residency_metadata\[4\]\)/
  );
  assert.match(
    schroederParticleStorageResidentCompactionWgsl,
    /count_residency_metadata\[2\] == RESIDENCY_STATUS_READY/
  );
  assert.doesNotMatch(
    schroederParticleStorageResidentCompactionWgsl,
    /for \(var slot = chunk_start; slot < params\.scan_slot_count;/
  );
});
