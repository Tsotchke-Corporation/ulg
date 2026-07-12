import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPH_THERMAL_PARAMS_BYTE_LENGTH,
  SPH_THERMAL_PARTICLE_PROPERTY_FLOATS,
  ULG_SPH_THERMAL_WORKSPACE_GPU_SCHEMA,
  assertSphThermalWorkspaceGpu,
  createSphThermalWorkspaceGpu
} from '../src/runtime/sph/sphThermalWorkspaceGpu.js';

function fakeDevice({
  maxBufferSize = 1 << 24,
  maxStorageBufferBindingSize = 1 << 24,
  maxUniformBufferBindingSize = 1 << 16,
  minUniformBufferOffsetAlignment = 256
} = {}) {
  const buffers = [];
  const writes = [];
  return {
    buffers,
    writes,
    limits: {
      maxBufferSize,
      maxStorageBufferBindingSize,
      maxUniformBufferBindingSize,
      minUniformBufferOffsetAlignment
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, byteLength: data.byteLength });
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        }
      };
      buffers.push(buffer);
      return buffer;
    }
  };
}

test('thermal workspace owns capacity-bounded property and aligned sequence params arenas', () => {
  const device = fakeDevice({ minUniformBufferOffsetAlignment: 512 });
  const workspace = createSphThermalWorkspaceGpu({
    device,
    particleCapacity: 300_000,
    sequenceStepCapacity: 3,
    label: 'test-thermal-workspace'
  });

  assert.equal(workspace.schema, ULG_SPH_THERMAL_WORKSPACE_GPU_SCHEMA);
  assert.equal(workspace.status, 'thermal-workspace-ready');
  assert.equal(workspace.particleCapacity, 300_000);
  assert.equal(
    workspace.propertyBufferByteLength,
    300_000 * SPH_THERMAL_PARTICLE_PROPERTY_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(workspace.sequenceStepCapacity, 3);
  assert.equal(workspace.paramsSlotByteLength, SPH_THERMAL_PARAMS_BYTE_LENGTH);
  assert.equal(workspace.paramsSlotStrideBytes, 512);
  assert.equal(workspace.paramsBufferByteLength, 3 * 512);
  assert.equal(device.buffers.length, 2);
  assert.equal(workspace.allocationEntries.length, 2);
  assert.ok(workspace.allocationEntries.every(
    ({ lifetime }) => lifetime === 'persistent-workspace'
  ));
  assert.deepEqual(
    [0, 1, 2].map((slotIndex) => workspace.paramsSlot(slotIndex).byteOffset),
    [0, 512, 1024]
  );
  workspace.writeParamsSlot(2, new ArrayBuffer(SPH_THERMAL_PARAMS_BYTE_LENGTH));
  assert.equal(device.writes.at(-1).buffer, workspace.paramsBuffer);
  assert.equal(device.writes.at(-1).offset, 1024);
  const signature = [{ stable: true }];
  let creationCount = 0;
  const firstGroup = workspace.bindGroupForSlot(2, signature, () => {
    creationCount += 1;
    return { generation: creationCount };
  });
  const cachedGroup = workspace.bindGroupForSlot(2, signature, () => {
    creationCount += 1;
    return { generation: creationCount };
  });
  assert.equal(firstGroup.cacheHit, false);
  assert.equal(cachedGroup.cacheHit, true);
  assert.equal(firstGroup.bindGroup, cachedGroup.bindGroup);
  assert.equal(creationCount, 1);
  assert.deepEqual(workspace.bindGroupCacheEvidence(), {
    slotCapacity: 3,
    populatedSlotCount: 1,
    hitCount: 1,
    missCount: 1
  });
  assert.equal(assertSphThermalWorkspaceGpu(device, workspace, 300_000), workspace);
  assert.equal(workspace.destroy(), true);
  assert.equal(workspace.destroy(), false);
  assert.equal(workspace.propertyBuffer.destroyed, true);
  assert.equal(workspace.paramsBuffer.destroyed, true);
});

test('thermal workspace fails closed across capacity, device, lifecycle, and limits', () => {
  const device = fakeDevice();
  const otherDevice = fakeDevice();
  const workspace = createSphThermalWorkspaceGpu({ device, particleCapacity: 4 });

  assert.throws(
    () => assertSphThermalWorkspaceGpu(device, workspace, 5),
    /capacity 4 is smaller than 5/
  );
  assert.throws(
    () => assertSphThermalWorkspaceGpu(otherDevice, workspace, 4),
    /device mismatch/
  );
  workspace.destroy();
  assert.throws(
    () => assertSphThermalWorkspaceGpu(device, workspace, 4),
    /is destroyed/
  );
  assert.throws(
    () => createSphThermalWorkspaceGpu({
      device: fakeDevice({ maxBufferSize: 63, maxStorageBufferBindingSize: 63 }),
      particleCapacity: 4
    }),
    /requires 64 bytes beyond device capacity/
  );
  assert.throws(
    () => createSphThermalWorkspaceGpu({
      device: fakeDevice({ maxBufferSize: 512 }),
      particleCapacity: 4,
      sequenceStepCapacity: 3
    }),
    /thermal params workspace requires 768 bytes beyond device capacity/
  );
  assert.throws(
    () => createSphThermalWorkspaceGpu({
      device: fakeDevice(),
      particleCapacity: 4,
      sequenceStepCapacity: 0
    }),
    /sequenceStepCapacity must be a positive safe integer/
  );
});
