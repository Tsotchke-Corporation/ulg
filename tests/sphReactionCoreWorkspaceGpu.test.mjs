import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPH_REACTION_BIN_PARAMS_BYTE_LENGTH,
  SPH_REACTION_CORE_WORKSPACE_BYTES_PER_PARTICLE,
  SPH_REACTION_LAW_QUEUE_PARAMS_BYTE_LENGTH,
  SPH_REACTION_MAIN_PARAMS_BYTE_LENGTH,
  SPH_REACTION_NEIGHBOR_PARAMS_BYTE_LENGTH,
  SPH_REACTION_PROPOSAL_FLOATS,
  ULG_SPH_REACTION_CORE_WORKSPACE_GPU_SCHEMA,
  assertSphReactionCoreWorkspaceGpu,
  createSphReactionCoreWorkspaceGpu
} from '../src/runtime/sph/sphReactionCoreWorkspaceGpu.js';

function fakeDevice({
  maxBufferSize = 1 << 30,
  maxStorageBufferBindingSize = 1 << 30,
  maxUniformBufferBindingSize = 1 << 16,
  minUniformBufferOffsetAlignment = 256,
  minStorageBufferOffsetAlignment = 256
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
      minUniformBufferOffsetAlignment,
      minStorageBufferOffsetAlignment
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
        destroyCount: 0,
        destroy() {
          this.destroyed = true;
          this.destroyCount += 1;
        }
      };
      buffers.push(buffer);
      return buffer;
    }
  };
}

test('reaction core workspace owns reusable proposal and aligned control arenas', () => {
  const device = fakeDevice({ minUniformBufferOffsetAlignment: 512 });
  const workspace = createSphReactionCoreWorkspaceGpu({
    device,
    particleCapacity: 300_000,
    sequenceStepCapacity: 3,
    label: 'test-reaction-core'
  });

  assert.equal(workspace.schema, ULG_SPH_REACTION_CORE_WORKSPACE_GPU_SCHEMA);
  assert.equal(workspace.status, 'reaction-core-workspace-ready');
  assert.equal(workspace.particleCapacity, 300_000);
  assert.equal(
    workspace.proposalBufferByteLength,
    300_000 * SPH_REACTION_PROPOSAL_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(workspace.sequenceStepCapacity, 3);
  assert.equal(workspace.paramsSlotStrideBytes, 4 * 512);
  assert.equal(workspace.paramsBufferByteLength, 3 * 4 * 512);
  assert.equal(workspace.disabledStorageBufferByteLength, 5 * 256);
  assert.equal(workspace.disabledWritableStorageBufferByteLength, 3 * 256);
  assert.equal(workspace.disabledReadOnlyStorageBufferByteLength, 2 * 256);
  assert.notEqual(
    workspace.disabledStorageBindings.binCounts.buffer,
    workspace.disabledStorageBindings.lawQueue.buffer
  );
  assert.equal(
    workspace.totalByteLength,
    300_000 * SPH_REACTION_CORE_WORKSPACE_BYTES_PER_PARTICLE
      + workspace.paramsBufferByteLength
      + workspace.disabledStorageBufferByteLength
  );
  assert.equal(workspace.totalByteLength, 4_807_424);
  assert.equal(device.buffers.length, 4);
  assert.equal(workspace.allocationEntries.length, 4);
  assert.equal(
    workspace.allocationEntries.every(({ lifetime }) => lifetime === 'persistent-workspace'),
    true
  );
  const slot = workspace.writeParamsSlot(2, {
    main: new ArrayBuffer(SPH_REACTION_MAIN_PARAMS_BYTE_LENGTH),
    bin: new ArrayBuffer(SPH_REACTION_BIN_PARAMS_BYTE_LENGTH),
    lawQueue: new ArrayBuffer(SPH_REACTION_LAW_QUEUE_PARAMS_BYTE_LENGTH),
    neighbor: new ArrayBuffer(SPH_REACTION_NEIGHBOR_PARAMS_BYTE_LENGTH)
  });
  assert.deepEqual(
    Object.values(slot.resources).map(({ byteOffset }) => byteOffset),
    [4096, 4608, 5120, 5632]
  );
  assert.deepEqual(device.writes.map(({ offset }) => offset), [4096, 4608, 5120, 5632]);
  assert.deepEqual(
    Object.values(workspace.disabledStorageBindings).map(({ byteOffset }) => byteOffset),
    [0, 256, 512, 0, 256]
  );
  const signature = [{ exact: true }, 2];
  let creationCount = 0;
  const firstPropose = workspace.bindGroupForSlot('propose', 2, signature, () => {
    creationCount += 1;
    return { creationCount };
  });
  const cachedPropose = workspace.bindGroupForSlot('propose', 2, signature, () => {
    creationCount += 1;
    return { creationCount };
  });
  const replacedPropose = workspace.bindGroupForSlot('propose', 2, [{ exact: false }, 2], () => {
    creationCount += 1;
    return { creationCount };
  });
  const firstResolve = workspace.bindGroupForSlot('resolve', 2, signature, () => ({
    resolve: true
  }));
  assert.equal(firstPropose.cacheHit, false);
  assert.equal(cachedPropose.cacheHit, true);
  assert.equal(firstPropose.bindGroup, cachedPropose.bindGroup);
  assert.equal(replacedPropose.cacheHit, false);
  assert.notEqual(replacedPropose.bindGroup, cachedPropose.bindGroup);
  assert.equal(firstResolve.cacheHit, false);
  assert.equal(creationCount, 2);
  assert.deepEqual(workspace.bindGroupCacheEvidence(), {
    slotCapacity: 3,
    proposePopulatedSlotCount: 1,
    resolvePopulatedSlotCount: 1,
    proposeHitCount: 1,
    proposeMissCount: 2,
    resolveHitCount: 0,
    resolveMissCount: 1
  });
  assert.equal(assertSphReactionCoreWorkspaceGpu(device, workspace, 300_000), workspace);
  assert.equal(workspace.destroy(), true);
  assert.equal(workspace.destroy(), false);
  assert.equal(device.buffers.every(({ destroyed }) => destroyed), true);
});

test('reaction core workspace fails closed across capacity, size, device, and lifecycle', () => {
  const device = fakeDevice();
  const otherDevice = fakeDevice();
  const workspace = createSphReactionCoreWorkspaceGpu({ device, particleCapacity: 4 });

  assert.throws(
    () => assertSphReactionCoreWorkspaceGpu(device, workspace, 5),
    /capacity 4 is smaller than 5/
  );
  assert.throws(
    () => assertSphReactionCoreWorkspaceGpu(otherDevice, workspace, 4),
    /device mismatch/
  );
  const originalSize = workspace.proposalBuffer.size;
  workspace.proposalBuffer.size = originalSize - Float32Array.BYTES_PER_ELEMENT;
  assert.throws(
    () => assertSphReactionCoreWorkspaceGpu(device, workspace, 4),
    /proposalBuffer is smaller/
  );
  workspace.proposalBuffer.size = originalSize;
  workspace.destroy();
  assert.throws(
    () => assertSphReactionCoreWorkspaceGpu(device, workspace, 4),
    /is destroyed/
  );

  assert.throws(
    () => createSphReactionCoreWorkspaceGpu({
      device: fakeDevice({ maxBufferSize: 15, maxStorageBufferBindingSize: 15 }),
      particleCapacity: 1
    }),
    /requires 16 bytes beyond device capacity/
  );
  assert.throws(
    () => createSphReactionCoreWorkspaceGpu({
      device: fakeDevice({ maxBufferSize: 2048 }),
      particleCapacity: 1,
      sequenceStepCapacity: 3
    }),
    /reaction params workspace requires 3072 bytes beyond device capacity/
  );
  assert.throws(
    () => createSphReactionCoreWorkspaceGpu({
      device: fakeDevice(),
      particleCapacity: 1,
      sequenceStepCapacity: 0
    }),
    /sequenceStepCapacity must be a positive safe integer/
  );
});
