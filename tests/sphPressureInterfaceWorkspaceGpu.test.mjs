import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_INTERFACE_SOURCE_KEY_FLOATS,
  SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS
} from '../src/runtime/sph/sphRenderGpuKernel.js';
import {
  SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS,
  SPH_PRESSURE_INTERFACE_FORCE_FLOATS
} from '../src/runtime/sph/sphPressureInterfaceGpuKernel.js';
import {
  ULG_SPH_PRESSURE_INTERFACE_WORKSPACE_GPU_SCHEMA,
  createSphPressureInterfaceWorkspaceGpu
} from '../src/runtime/sph/sphPressureInterfaceWorkspaceGpu.js';

function mockDevice({ maxBufferSize = 1 << 28, allowQueue = false } = {}) {
  const buffers = [];
  const writes = [];
  let queueAccessCount = 0;
  const device = {
    limits: { maxBufferSize },
    queue: allowQueue
      ? {
          writeBuffer(buffer, offset, data) {
            queueAccessCount += 1;
            writes.push({ buffer, offset, byteLength: data.byteLength });
          }
        }
      : new Proxy({}, {
          get() {
            queueAccessCount += 1;
            throw new Error('workspace allocation must not touch the queue');
          }
        }),
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyCount: 0,
        destroy() {
          this.destroyCount += 1;
        }
      };
      buffers.push(buffer);
      return buffer;
    }
  };
  return { device, buffers, writes, get queueAccessCount() { return queueAccessCount; } };
}

test('pressure/interface workspace owns one command-ordered output set at candidate capacity', () => {
  const mock = mockDevice();
  const capacity = 4096;
  const workspace = createSphPressureInterfaceWorkspaceGpu({
    device: mock.device,
    candidateCapacity: capacity,
    sequenceStepCapacity: 4
  });

  assert.equal(workspace.schema, ULG_SPH_PRESSURE_INTERFACE_WORKSPACE_GPU_SCHEMA);
  assert.equal(workspace.candidateCapacity, capacity);
  assert.equal(workspace.byteLengths.candidateRows, capacity * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS * 4);
  assert.equal(workspace.byteLengths.interfaceSourceKeys, capacity * SPH_INTERFACE_SOURCE_KEY_FLOATS * 4);
  assert.equal(workspace.byteLengths.contactKinematics, capacity * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS * 4);
  assert.equal(workspace.byteLengths.forceRows, capacity * SPH_PRESSURE_INTERFACE_FORCE_FLOATS * 4);
  assert.equal(workspace.sequenceStepCapacity, 4);
  assert.equal(workspace.controlSlotStrideBytes % 256, 0);
  assert.equal(mock.buffers.length, 11);
  assert.equal(workspace.allocationEntries.length, 11);
  assert.equal(mock.queueAccessCount, 0);
  assert.equal(
    workspace.targetBuffers.targetCandidateRowsBuffer,
    mock.buffers.find(({ label }) => label.endsWith('-candidateRows'))
  );
  assert.equal(
    workspace.targetBuffers.targetForceRowsBuffer,
    mock.buffers.find(({ label }) => label.endsWith('-forceRows'))
  );

  assert.equal(workspace.destroy(), true);
  assert.equal(workspace.destroy(), false);
  assert.equal(workspace.destroyed, true);
  assert.equal(mock.buffers.every(({ destroyCount }) => destroyCount === 1), true);
  assert.equal(mock.queueAccessCount, 0);
});

test('pressure/interface workspace recycles substep parameter and policy slots', () => {
  const mock = mockDevice({ allowQueue: true });
  const workspace = createSphPressureInterfaceWorkspaceGpu({
    device: mock.device,
    candidateCapacity: 32,
    sequenceStepCapacity: 2
  });
  const first = workspace.substepResources(0, { contactPolicyByteLength: 64 });
  assert.equal(first.contactPolicyByteLength, 64);
  const bufferCountAfterFirst = mock.buffers.length;
  const second = workspace.substepResources(0, { contactPolicyByteLength: 64 });
  assert.equal(second.forceParamsBuffer, first.forceParamsBuffer);
  assert.equal(second.contactPolicyBuffer, first.contactPolicyBuffer);
  assert.equal(second.forceParamsByteOffset, first.forceParamsByteOffset);
  assert.equal(mock.buffers.length, bufferCountAfterFirst);
  const next = workspace.substepResources(1, { contactPolicyByteLength: 64 });
  assert.equal(next.forceParamsBuffer, first.forceParamsBuffer);
  assert.notEqual(next.forceParamsByteOffset, first.forceParamsByteOffset);
  assert.equal(next.forceParamsByteOffset % 256, 0);
  assert.equal(next.contactPolicyBuffer, first.contactPolicyBuffer);
  assert.notEqual(next.contactPolicyByteOffset, first.contactPolicyByteOffset);
  assert.equal(next.contactPolicyByteOffset % 256, 0);
  assert.equal(mock.buffers.length, bufferCountAfterFirst);
  assert.equal(workspace.substepSlotCount, 2);
  assert.equal(mock.writes.length, 3, 'shared disabled rows initialize once');
  assert.equal(workspace.destroy(), true);
  assert.equal(mock.buffers.every(({ destroyCount }) => destroyCount === 1), true);
});

test('pressure/interface workspace writes aligned control slots and bounds exact bind-group caches', () => {
  const mock = mockDevice({ allowQueue: true });
  const workspace = createSphPressureInterfaceWorkspaceGpu({
    device: mock.device,
    candidateCapacity: 32,
    sequenceStepCapacity: 2
  });
  const slot = workspace.substepResources(1, { contactPolicyByteLength: 64 });
  const values = new Uint8Array(slot.forceParamsByteLength);
  slot.writeControl('force', values);
  const forceWrite = mock.writes.at(-1);
  assert.equal(forceWrite.buffer, workspace.controlBuffer);
  assert.equal(forceWrite.offset, slot.forceParamsByteOffset);
  assert.equal(forceWrite.byteLength, slot.forceParamsByteLength);

  const buffer = {};
  const signature = [buffer, slot.forceParamsByteOffset, slot.forceParamsByteLength];
  const first = slot.bindGroupForKind('force', signature, () => ({ id: 'force-slot-1' }));
  const second = slot.bindGroupForKind('force', signature, () => ({ id: 'unexpected' }));
  assert.equal(first.cacheHit, false);
  assert.equal(second.cacheHit, true);
  assert.equal(second.bindGroup, first.bindGroup);
  const changed = slot.bindGroupForKind(
    'force',
    [buffer, slot.forceParamsByteOffset, slot.forceParamsByteLength + 4],
    () => ({ id: 'force-slot-1-size-change' })
  );
  assert.equal(changed.cacheHit, false);
  assert.notEqual(changed.bindGroup, first.bindGroup);
  assert.deepEqual(workspace.bindGroupCacheEvidence(), {
    slotCapacity: 2,
    candidatePopulatedSlotCount: 0,
    candidateFinalizePopulatedSlotCount: 0,
    contactKinematicsPopulatedSlotCount: 0,
    forcePopulatedSlotCount: 1,
    pressureScatterPopulatedSlotCount: 0,
    candidateHitCount: 0,
    candidateMissCount: 0,
    candidateFinalizeHitCount: 0,
    candidateFinalizeMissCount: 0,
    contactKinematicsHitCount: 0,
    contactKinematicsMissCount: 0,
    forceHitCount: 1,
    forceMissCount: 2,
    pressureScatterHitCount: 0,
    pressureScatterMissCount: 0
  });
  assert.throws(() => workspace.substepResources(2), /slot index/);
  workspace.destroy();
});

test('pressure/interface workspace gives an empty policy slot a complete GPU row', () => {
  const mock = mockDevice({ allowQueue: true });
  const workspace = createSphPressureInterfaceWorkspaceGpu({
    device: mock.device,
    candidateCapacity: 1,
    sequenceStepCapacity: 1
  });
  const slot = workspace.substepResources(0);
  assert.equal(slot.contactPolicyByteLength, 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(slot.contactPolicyByteOffset % 256, 0);
  assert.equal(slot.contactPolicyBuffer.size >= slot.contactPolicyByteLength, true);
  workspace.destroy();
});

test('pressure/interface workspace rejects invalid or device-exceeding capacities transactionally', () => {
  const mock = mockDevice({ maxBufferSize: 1024 });
  assert.throws(
    () => createSphPressureInterfaceWorkspaceGpu({ device: mock.device, candidateCapacity: 0 }),
    /positive safe integer/
  );
  assert.throws(
    () => createSphPressureInterfaceWorkspaceGpu({ device: mock.device, candidateCapacity: 1024 }),
    /exceeds maxBufferSize/
  );
  assert.equal(mock.buffers.length, 0);
  assert.equal(mock.queueAccessCount, 0);
});
