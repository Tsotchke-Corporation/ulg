import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_EPOCH_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_EPOCH_STATUS_READY,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  createSchroederBoundedAtlasPlan,
  createSchroederSpatialEpochBuildPlan,
  createSchroederSpatialEpochLayout,
  decodeSchroederSignedOrderKey,
  encodeSchroederSignedOrderKey,
  validateSchroederSpatialEpochConsumerDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  schroederSpatialEpochAssembleWgsl,
  schroederSpatialEpochKeyWgsl
} from '../ulg-gpu-abi/src/schroederSpatialEpochWgsl.js';
import { createSchroederSpatialEpochGpu } from '../src/runtime/sph/schroederSpatialEpochGpu.js';

function createFakeDevice(overrides = {}) {
  const buffers = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  const submissions = [];
  const commandEncoders = [];
  const device = {
    buffers,
    pipelines,
    bindGroups,
    writes,
    submissions,
    commandEncoders,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256,
      ...overrides.limits
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, byteLength: data.byteLength });
      },
      submit(commandBuffers) {
        submissions.push(commandBuffers);
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      return descriptor;
    },
    createComputePipeline(descriptor) {
      const pipeline = {
        ...descriptor,
        getBindGroupLayout(index) {
          return { pipeline: descriptor.label, entryPoint: descriptor.compute.entryPoint, index };
        }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder(descriptor) {
      commandEncoders.push(descriptor);
      return createFakeEncoder();
    }
  };
  return device;
}

function createFakeEncoder() {
  const events = [];
  return {
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', label: buffer.label, offset, size });
    },
    beginComputePass(descriptor = {}) {
      const event = { kind: 'pass', descriptor, commands: [] };
      events.push(event);
      let pipeline = null;
      let bindGroup = null;
      return {
        setPipeline(value) { pipeline = value.label; },
        setBindGroup(index, value) { bindGroup = { index, label: value.label }; },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({ pipeline, bindGroup, dispatch: [x, y, z] });
        },
        dispatchWorkgroupsIndirect(buffer, byteOffset = 0) {
          event.commands.push({
            pipeline,
            bindGroup,
            dispatchIndirect: { label: buffer.label, byteOffset }
          });
        },
        end() { event.ended = true; }
      };
    }
  };
}

test('spatial epoch ABI fixes exact keys, identity header, and compact directory offsets', () => {
  assert.equal(SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT.length, 48);
  assert.equal(SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS, 48);
  assert.equal(SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT[20], 'logicalRequiredWords:u32');
  assert.equal(SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT[21], 'logicalAdmittedWords:u32');
  assert.equal(
    SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT[47],
    'physicalAddressUpperBoundWords:u32'
  );
  assert.deepEqual(SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT.slice(3, 11), [
    'generationId:u32',
    'deviceOrdinal:u32',
    'laneOrdinal:u32',
    'leaseToken:u32',
    'sourceFamilyId:u32',
    'storageGeneration:u32',
    'physicsTick:u32',
    'physicsSubstep:u32'
  ]);
  const layout = createSchroederSpatialEpochLayout({ sourceCapacity: 8, cellCapacity: 8 });
  assert.equal(layout.cellKeysOffsetWords, 48);
  assert.equal(layout.cellOffsetsOffsetWords, 88);
  assert.equal(layout.cellMembersOffsetWords, 97);
  assert.equal(layout.particleToCellOffsetWords, 105);
  assert.equal(layout.wordLength, 113);
  assert.equal(layout.byteLength, 452);
  assert.match(SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI.consumerDispatchLinearization, /workgroup\.y/);
});

test('signed structural order keys round trip and preserve i32 ordering', () => {
  const values = [-0x8000_0000, -17, -1, 0, 1, 29, 0x7fff_ffff];
  const keys = values.map(encodeSchroederSignedOrderKey);
  assert.deepEqual(keys, [...keys].sort((left, right) => left - right));
  assert.deepEqual(keys.map(decodeSchroederSignedOrderKey), values);
});

test('bounded atlas plans prove a collision-free u32 product and are always normalized', () => {
  const atlas = createSchroederBoundedAtlasPlan({
    chartMin: 0,
    chartCount: 2,
    levelMin: -1,
    levelCount: 2,
    cellMin: [-1, -1, 0],
    cellCount: [2, 2, 2]
  });
  assert.equal(atlas.ordinalCount, 32);
  assert.equal(atlas.sortKeyWordCount, 1);
  const plan = createSchroederSpatialEpochBuildPlan({
    sourceCount: 8,
    sourceCapacity: 8,
    atlas: { ...atlas, chartCount: 1 }
  });
  assert.equal(plan.atlas.chartCount, 1);
  assert.notEqual(plan.atlas, atlas);
  assert.throws(
    () => createSchroederSpatialEpochBuildPlan({
      sourceCount: 1,
      sourceCapacity: 1,
      atlas: { chartCount: 0 }
    }),
    /chartCount/
  );
  assert.throws(
    () => createSchroederBoundedAtlasPlan({
      chartCount: 65536,
      levelCount: 65536,
      cellCount: [2, 1, 1]
    }),
    /ordinal count/
  );
});

test('host descriptor validation never converts encode-time identity into GPU completion', () => {
  const identity = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    magic: SCHROEDER_SPATIAL_EPOCH_MAGIC,
    abiVersion: SCHROEDER_SPATIAL_EPOCH_VERSION,
    generationId: 7,
    deviceId: 'device-a',
    laneId: 'lane-a',
    leaseToken: 11
  };
  assert.deepEqual(validateSchroederSpatialEpochConsumerDescriptor(identity, {
    generationId: 7,
    deviceId: 'device-a'
  }), {
    admitted: false,
    compatible: true,
    status: 'schroeder-spatial-epoch-gpu-admission-unproven'
  });
  assert.equal(validateSchroederSpatialEpochConsumerDescriptor({
    ...identity,
    statusFlags: SCHROEDER_SPATIAL_EPOCH_STATUS_READY,
    gpuCompletionProven: true
  }).status, 'schroeder-spatial-epoch-rejected-not-admitted');
  assert.equal(validateSchroederSpatialEpochConsumerDescriptor({
    ...identity,
    statusFlags: SCHROEDER_SPATIAL_EPOCH_STATUS_READY
      | SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED
      | SCHROEDER_SPATIAL_EPOCH_STATUS_FAIL_CLOSED,
    gpuCompletionProven: true
  }).status, 'schroeder-spatial-epoch-rejected-fail-closed');
  assert.equal(validateSchroederSpatialEpochConsumerDescriptor({
    ...identity,
    statusFlags: SCHROEDER_SPATIAL_EPOCH_STATUS_READY
      | SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED,
    gpuCompletionProven: true
  }).admitted, true);
  assert.equal(validateSchroederSpatialEpochConsumerDescriptor(identity, {
    leaseToken: 12
  }).field, 'leaseToken');
});

test('spatial WGSL admits the established active-row status and derives duplicate groups safely', () => {
  assert.match(schroederSpatialEpochKeyWgsl, /status_f > 0\.0/);
  assert.match(schroederSpatialEpochKeyWgsl, /status_f < 32\.0/);
  assert.match(schroederSpatialEpochKeyWgsl, /source_index <= 16777215u/);
  assert.match(schroederSpatialEpochKeyWgsl, /value == trunc\(value\)/);
  assert.match(schroederSpatialEpochKeyWgsl, /source_particle_f == f32\(source_index\)/);
  assert.doesNotMatch(schroederSpatialEpochKeyWgsl, /0\.0001/);
  assert.match(schroederSpatialEpochKeyWgsl, /floor\(position \/ native_spacing\)/);
  assert.doesNotMatch(schroederSpatialEpochKeyWgsl, /max\(native_spacing, 0\.000001\)/);
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /inclusive_head_count = sorted_group_indices\[sorted_position \+ 1u\]/
  );
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /let is_head = sorted_position == unique_offsets\[group_index\]/
  );
  assert.match(schroederSpatialEpochAssembleWgsl, /fn saturating_add_u32/);
  assert.match(schroederSpatialEpochAssembleWgsl, /consumer_dispatch\[1\] = dispatch_y/);
});

test('caller-owned runtime keeps two complete variable-count arenas resident and GPU-gated', async () => {
  const device = createFakeDevice();
  const runtime = createSchroederSpatialEpochGpu(device, {
    maxSourceCount: 8,
    cellCapacity: 8,
    arenaCount: 2,
    label: 'spatial-test'
  });
  const activeNodeBuffer = device.createBuffer({
    label: 'active-node-source',
    size: 8 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const allocationBuffers = runtime.allocationEntries().map(({ buffer }) => buffer);
  const bufferCountBeforeEncode = device.buffers.length;
  const atlas = {
    chartMin: 0,
    chartCount: 2,
    levelMin: -1,
    levelCount: 2,
    cellMin: [-1, -1, 0],
    cellCount: [2, 2, 2]
  };

  const first = runtime.encode(createFakeEncoder(), {
    activeNodeBuffer,
    sourceCount: 8,
    sortMode: 'bounded-atlas-u32',
    atlas,
    generationId: 1,
    deviceOrdinal: 9,
    laneOrdinal: 3,
    sourceFamilyId: 4,
    storageGeneration: 5,
    physicsTick: 6,
    physicsSubstep: 1,
    leaseToken: 7
  });
  const second = runtime.encode(createFakeEncoder(), {
    activeNodeBuffer,
    sourceCount: 6,
    sortMode: 'lexicographic-u32x5',
    generationId: 2,
    timestampProfiler: {
      beginComputePassDescriptor(label, metadata) { return { label, metadata }; }
    }
  });
  assert.equal(first.arenaIndex, 0);
  assert.equal(second.arenaIndex, 1);
  assert.equal(first.status, 'schroeder-spatial-epoch-gpu-encoded');
  assert.equal(first.radixPassCount, 8);
  assert.equal(second.radixPassCount, 40);
  assert.equal(second.timestampMode, 'instrumented-dispatch-granular-nonrepresentative');
  assert.equal(first.statusFlags, null);
  assert.equal(first.gpuCompletionProven, false);
  assert.equal(first.submitPerformed, false);
  assert.equal(first.readbackPerformed, false);
  assert.equal(first.bufferAllocationCountDuringEncode, 0);
  assert.equal(first.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(first.clearedWordCount, 67);
  assert.equal(first.paramsWriteCount, 5);
  assert.equal(first.radixDigitPassCount, 8);
  assert.equal(
    runtime.retainedGpuBufferBytes,
    runtime.retainedGpuBufferBytesPerArena.reduce((sum, bytes) => sum + bytes, 0)
  );
  assert.equal(first.retainedGpuBufferBytes, runtime.retainedGpuBufferBytesPerArena[0]);
  assert.ok(first.retainedGpuBufferBytes > first.layout.byteLength);
  const keyBinding = device.bindGroups.find((entry) => entry.label === 'spatial-test-arena-0-key-bind-group');
  assert.equal(keyBinding.entries[0].resource.size, 8 * 16 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(device.buffers.length, bufferCountBeforeEncode);
  assert.equal(device.submissions.length, 0);
  assert.equal(device.commandEncoders.length, 0);
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      activeNodeBuffer,
      sourceCount: 4,
      atlas
    }),
    (error) => error?.code === 'ERR_SCHROEDER_SPATIAL_ARENA_EXHAUSTED'
  );
  assert.throws(
    () => runtime.destroy(),
    (error) => error?.code === 'ERR_SCHROEDER_SPATIAL_ACTIVE_EXECUTIONS'
  );

  assert.throws(() => runtime.releaseExecution(first), /discarded encoder/);
  assert.equal(runtime.releaseExecution(first, { discardedEncoder: true }), true);
  const bufferCountBeforeReuse = device.buffers.length;
  const third = runtime.encode(createFakeEncoder(), {
    activeNodeBuffer,
    sourceCount: 4,
    atlas,
    generationId: 3
  });
  assert.equal(third.arenaIndex, 0);
  assert.equal(device.buffers.length, bufferCountBeforeReuse);
  assert.ok(third.spatialBindGroupReuseCount >= 3);
  assert.equal(runtime.releaseExecution(third, { discardedEncoder: true }), true);
  assert.equal(runtime.releaseExecution(third, { discardedEncoder: true }), false);
  await assert.rejects(runtime.releaseExecutionAfter(second, null), /submission-fence thenable/);
  assert.equal(await runtime.releaseExecutionAfter(second, Promise.resolve()), true);
  assert.deepEqual(runtime.allocationEntries().map(({ buffer }) => buffer), allocationBuffers);
  assert.equal(runtime.destroy(), true);
  assert.equal(allocationBuffers.every((buffer) => buffer.destroyed), true);
});

test('runtime rejects non-portable stage limits and active-node capacity ambiguity', () => {
  assert.throws(
    () => createSchroederSpatialEpochGpu(createFakeDevice({
      limits: { maxStorageBuffersPerShaderStage: 7 }
    }), { maxSourceCount: 8 }),
    /eight storage bindings/
  );
  const device = createFakeDevice();
  const runtime = createSchroederSpatialEpochGpu(device, {
    maxSourceCount: 8,
    arenaCount: 1
  });
  const undersized = device.createBuffer({ label: 'undersized', size: 16, usage: 128 });
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      activeNodeBuffer: undersized,
      sourceCount: 8
    }),
    /bytes; 512 required/
  );
  runtime.destroy();
});
