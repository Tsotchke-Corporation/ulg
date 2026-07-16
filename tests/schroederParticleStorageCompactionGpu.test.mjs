import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_ROW_LAYOUT,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { schroederParticleStorageCompactionWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_FLOATS,
  ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_SCHEMA,
  createSchroederParticleStorageCompactionParamsArray,
  createSchroederParticleStorageCompactionPlan,
  decodeSchroederParticleStorageCompactionSummaryRow
} from '../src/runtime/sph/schroederParticleStorageCompactionGpu.js';
import { createSchroederParticleStorageAdoption } from '../src/runtime/sph/sphMlsMpmGpuStep.js';

test('compaction schemas, layout, and plan are stable', () => {
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-compaction.v0'
  );
  assert.equal(
    ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_EXECUTION_SCHEMA,
    'peercompute.ulg.schroeder-particle-storage-compaction-execution.v0'
  );
  assert.equal(SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_FLOATS, 16);
  assert.equal(
    SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_ROW_LAYOUT[1],
    'liveParticleCount:f32'
  );
  assert.equal(
    SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_ROW_LAYOUT[5],
    'admittedParticleCountDelta:f32'
  );
  const plan = createSchroederParticleStorageCompactionPlan({
    scanSlotCount: 6,
    sourceParticleCount: 3,
    outputParticleCapacity: 6
  });
  assert.equal(plan.scanSlotCount, 6);
  assert.equal(plan.sourceParticleCount, 3);
  assert.equal(plan.outputParticleCapacity, 6);
  assert.equal(plan.compactionMode, 'order-preserving-live-slot-stream-compaction');
  assert.equal(plan.stateByteLength, 6 * 2 * 16);
  assert.equal(plan.thermoByteLength, 6 * 3 * 16);
  assert.equal(plan.mechanicsByteLength, 6 * 8 * 16);
  assert.equal(plan.identityByteLength, 6 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.identityStrideBytes, Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.identitySchema, ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA);
  assert.deepEqual(plan.conservedQuantities, ['mass', 'momentum', 'particle-identity-order']);
  assert.equal(plan.fullParticleReadbackRequired, false);
});

test('compaction params array encodes slot count, strides, and source count', () => {
  const plan = createSchroederParticleStorageCompactionPlan({
    scanSlotCount: 9,
    sourceParticleCount: 4,
    flags: 5
  });
  const params = createSchroederParticleStorageCompactionParamsArray(plan);
  assert.equal(params.byteLength, 32);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 9);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), 3);
  assert.equal(view.getUint32(12, true), 8);
  assert.equal(view.getUint32(16, true), 4);
  assert.equal(view.getUint32(20, true), 5);
});

test('compaction summary decoder maps live count and negative delta', () => {
  const row = new Float32Array(16);
  row[0] = 6;
  row[1] = 2;
  row[2] = 2;
  row[3] = 6;
  row[4] = 3;
  row[5] = -1;
  row[11] = 2;
  row[14] = 1;
  const decoded = decodeSchroederParticleStorageCompactionSummaryRow(row);
  assert.equal(decoded.scannedSlotCount, 6);
  assert.equal(decoded.liveParticleCount, 2);
  assert.equal(decoded.freedHoleCount, 2);
  assert.equal(decoded.liveMassKg, 6);
  assert.equal(decoded.sourceParticleCount, 3);
  assert.equal(decoded.admittedParticleCountDelta, -1);
  assert.equal(decoded.authoritativeParticleCount, 2);
  assert.equal(decodeSchroederParticleStorageCompactionSummaryRow(new Float32Array(4)), null);
});

test('compaction WGSL declares order-preserving single-workgroup scan and scatter', () => {
  assert.match(schroederParticleStorageCompactionWgsl, /struct SchroederParticleStorageCompactionParams/);
  assert.match(schroederParticleStorageCompactionWgsl, /@compute @workgroup_size\(64\)/);
  assert.match(schroederParticleStorageCompactionWgsl, /var<storage, read> in_sph_state/);
  assert.match(schroederParticleStorageCompactionWgsl, /var<storage, read_write> out_sph_state/);
  assert.match(schroederParticleStorageCompactionWgsl, /var<storage, read> in_particle_identity: array<u32>/);
  assert.match(
    schroederParticleStorageCompactionWgsl,
    /out_particle_identity\[target_slot\] = in_particle_identity\[source_slot\]/
  );
  assert.match(schroederParticleStorageCompactionWgsl, /wg_chunk_bases/);
  assert.match(schroederParticleStorageCompactionWgsl, /workgroupBarrier\(\)/);
});

test('storage adoption accepts a compaction execution with a negative admitted delta', () => {
  const fakeBuffer = (label) => ({ label, destroy() {} });
  const adoption = createSchroederParticleStorageAdoption({
    schroederParticleStorageMaterialization: {
      schema: ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_EXECUTION_SCHEMA,
      status: 'schroeder-particle-storage-compaction-submitted',
      particleStorageMaterializationAdmissionApproved: true,
      retainedParticleBuffers: true,
      sourceParticleCount: 3,
      outputParticleCapacity: 6,
      admittedParticleCountDelta: -1,
      targetStateFamilies: [
        'sph-particle-state',
        'mls-mpm-particle-mechanics',
        'sph-particle-thermo'
      ],
      particleStateBuffer: fakeBuffer('compacted-state'),
      particleThermoBuffer: fakeBuffer('compacted-thermo'),
      particleMechanicsBuffer: fakeBuffer('compacted-mechanics'),
      stateBufferByteLength: 6 * 8 * 4,
      thermoBufferByteLength: 6 * 12 * 4,
      mechanicsBufferByteLength: 6 * 32 * 4
    },
    sphParticleState: { particleCount: 3 },
    mlsMpmParticleState: { particleCount: 3 }
  });
  assert.equal(adoption.adopted, true);
  assert.equal(adoption.status, 'schroeder-particle-storage-adopted');
  assert.equal(adoption.sourceParticleCount, 3);
  assert.equal(adoption.admittedParticleCountDelta, -1);
  // A merge shrinks the authoritative count while capacity stays headroom.
  assert.equal(adoption.authoritativeParticleCount, 2);
  assert.equal(adoption.outputParticleCapacity, 6);
});

test('storage adoption fails closed when arbitrary domains lose their identity sidecar', () => {
  const fakeBuffer = (label, size = 0) => ({ label, size, destroy() {} });
  const materialization = {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_EXECUTION_SCHEMA,
    status: 'schroeder-particle-storage-compaction-submitted',
    particleStorageMaterializationAdmissionApproved: true,
    retainedParticleBuffers: true,
    sourceParticleCount: 3,
    outputParticleCapacity: 6,
    admittedParticleCountDelta: -1,
    targetStateFamilies: [
      'sph-particle-state',
      'mls-mpm-particle-mechanics',
      'sph-particle-thermo',
      'sph-particle-identity'
    ],
    particleStateBuffer: fakeBuffer('compacted-state'),
    particleThermoBuffer: fakeBuffer('compacted-thermo'),
    particleMechanicsBuffer: fakeBuffer('compacted-mechanics'),
    stateBufferByteLength: 6 * 8 * 4,
    thermoBufferByteLength: 6 * 12 * 4,
    mechanicsBufferByteLength: 6 * 32 * 4,
    identityRequired: true
  };
  const blocked = createSchroederParticleStorageAdoption({
    schroederParticleStorageMaterialization: materialization,
    sphParticleState: { particleCount: 3, identityRequired: true },
    mlsMpmParticleState: { particleCount: 3 }
  });
  assert.equal(blocked.adopted, false);
  assert.ok(blocked.blockers.includes(
    'schroeder-particle-storage-identity-buffer-missing-for-arbitrary-domains'
  ));

  materialization.particleIdentityBuffer = fakeBuffer(
    'compacted-identity',
    6 * Uint32Array.BYTES_PER_ELEMENT
  );
  materialization.identityBufferByteLength = 6 * Uint32Array.BYTES_PER_ELEMENT;
  materialization.identityStrideBytes = Uint32Array.BYTES_PER_ELEMENT;
  materialization.identitySchema = ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA;
  materialization.particleIdentityMutationApproved = true;
  const adopted = createSchroederParticleStorageAdoption({
    schroederParticleStorageMaterialization: materialization,
    sphParticleState: { particleCount: 3, identityRequired: true },
    mlsMpmParticleState: { particleCount: 3 }
  });
  assert.equal(adopted.adopted, true);
  assert.equal(adopted.identityBuffer, materialization.particleIdentityBuffer);
  assert.equal(adopted.identityCapacityAccepted, true);
});
