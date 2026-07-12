import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SPH_RESIDENT_PRODUCT_EVENT_ARENA_CAPACITY_BUCKET_ROWS,
  SPH_RESIDENT_PRODUCT_EVENT_ARENA_MAX_BYTES_DEFAULT,
  SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA,
  SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_WORDS,
  ULG_SPH_RESIDENT_PRODUCT_EVENT_ARENA_SCHEMA,
  appendResidentProductEventArenaGpu,
  createResidentProductEventArenaGpu,
  createResidentProductEventArenaCapacityDescriptor,
  decodeResidentProductEventArenaMetadata,
  prepareResidentProductEventArenaGpuEncoderSequence,
  reserveResidentProductEventArenaBatchCapacity,
  reserveResidentProductEventArenaCapacity
} from '../src/runtime/sph/residentProductEventArenaGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function createFakeDevice() {
  const buffers = [];
  const copies = [];
  const dispatches = [];
  const clears = [];
  const submissions = [];
  const writes = [];
  let fenceCount = 0;
  let mapCount = 0;
  return {
    buffers,
    copies,
    dispatches,
    clears,
    submissions,
    writes,
    get fenceCount() { return fenceCount; },
    get mapCount() { return mapCount; },
    limits: {
      maxBufferSize: 1 << 30,
      maxStorageBufferBindingSize: 1 << 30,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        new Uint8Array(buffer.data, offset, bytes.byteLength).set(bytes);
        writes.push({ buffer, offset, byteLength: bytes.byteLength });
      },
      submit(commands) { submissions.push(commands); },
      async onSubmittedWorkDone() { fenceCount += 1; }
    },
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        data: new ArrayBuffer(size),
        destroyed: false,
        destroy() { this.destroyed = true; },
        async mapAsync() { mapCount += 1; },
        getMappedRange() { return this.data; },
        unmap() {}
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) { return { index, label: descriptor.label }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder(descriptor = {}) {
      const commands = [];
      return {
        clearBuffer(buffer, offset = 0, size = buffer.size - offset) {
          const command = { kind: 'clear', buffer, offset, size };
          commands.push(command);
          clears.push(command);
          new Uint8Array(buffer.data, offset, size).fill(0);
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          const command = { kind: 'copy', source, sourceOffset, destination, destinationOffset, size };
          commands.push(command);
          copies.push(command);
        },
        beginComputePass(passDescriptor = {}) {
          const command = { kind: 'compute', descriptor: passDescriptor };
          commands.push(command);
          return {
            setPipeline(pipeline) { command.pipeline = pipeline; },
            setBindGroup(index, bindGroup) { command.bindGroup = { index, bindGroup }; },
            dispatchWorkgroups(x, y = 1, z = 1) {
              command.dispatch = [x, y, z];
              dispatches.push(command);
            },
            dispatchWorkgroupsIndirect(buffer, offset) {
              command.indirectDispatch = { buffer, offset };
              dispatches.push(command);
            },
            end() { command.ended = true; }
          };
        },
        finish() { return { descriptor, commands }; }
      };
    }
  };
}

function sourceBuffer(device, label, rowCount, strideBytes = 128) {
  return device.createBuffer({
    label,
    size: Math.max(strideBytes, rowCount * strideBytes),
    usage: 128
  });
}

test('arena capacity grows geometrically, covers 300k rows at 64 MiB, and fails closed', () => {
  assert.equal(SPH_RESIDENT_PRODUCT_EVENT_ARENA_CAPACITY_BUCKET_ROWS, 4096);
  assert.equal(SPH_RESIDENT_PRODUCT_EVENT_ARENA_MAX_BYTES_DEFAULT, 128 * 1024 * 1024);
  assert.equal(reserveResidentProductEventArenaCapacity({ requiredRowCount: 5 }).reservedCapacityRows, 4096);
  assert.equal(reserveResidentProductEventArenaCapacity({ requiredRowCount: 4097 }).reservedCapacityRows, 8192);
  assert.equal(reserveResidentProductEventArenaCapacity({ requiredRowCount: 8193 }).reservedCapacityRows, 16384);
  const production = reserveResidentProductEventArenaCapacity({
    requiredRowCount: 300000,
    maxCapacityRows: 1048576
  });
  assert.equal(production.reservedCapacityRows, 524288);
  assert.equal(production.reservedCapacityRows * 128, 64 * 1024 * 1024);
  assert.throws(() => reserveResidentProductEventArenaCapacity({
    requiredRowCount: 1048577,
    maxCapacityRows: 1048576
  }), (error) => error?.status === 'resident-product-event-arena-capacity-overflow-fail-closed');
  const twoStep300k = reserveResidentProductEventArenaBatchCapacity({
    requiredRowCount: 600_000,
    maxCapacityRows: 1_048_576
  });
  assert.equal(twoStep300k.reservedCapacityRows, 600_000);
  assert.equal(twoStep300k.capacityHeadroomRows, 0);
  assert.equal(twoStep300k.reservedCapacityRows * 128, 76_800_000);
  assert.equal(twoStep300k.growthPolicy,
    'exact-conservative-batch-upper-bound-no-geometric-overreservation');
});

test('caller-owned encoder sequence appends fixed product rows in order without submit, map, or poisoned tails', () => {
  const device = createFakeDevice();
  const sequence = prepareResidentProductEventArenaGpuEncoderSequence(device, {
    strideFloats: 32,
    sourceRowCount: 4,
    appendCount: 2,
    bucketRows: 8
  });
  const encoder = device.createCommandEncoder({ label: 'reactive-sequence' });
  const initialization = sequence.encodeInitialization(encoder);
  assert.equal(initialization.queueSubmitPerformed, false);
  assert.equal(initialization.mapPerformed, false);
  assert.equal(sequence.occupiedRowCountUpperBound, 0);
  const first = sequence.encodeAppend(encoder, {
    source: { buffer: sourceBuffer(device, 'reaction-events-0', 4), rowCount: 4 },
    sourceEpoch: 10,
    sourceGeneration: 20
  });
  assert.equal(sequence.occupiedRowCountUpperBound, 4);
  const second = sequence.encodeAppend(encoder, {
    source: { buffer: sourceBuffer(device, 'reaction-events-1', 4), rowCount: 4 },
    sourceEpoch: 11,
    sourceGeneration: 21
  });
  assert.deepEqual([first.sourceEpoch, second.sourceEpoch], [10, 11]);
  assert.deepEqual([first.sourceGeneration, second.sourceGeneration], [20, 21]);
  assert.equal(sequence.encodedAppendCount, 2);
  assert.equal(sequence.capacityDescriptor().occupiedRowCountUpperBound, 8);
  assert.equal(sequence.occupiedRowCountUpperBound, 8);
  assert.equal(device.submissions.length, 0);
  assert.equal(device.mapCount, 0);
  assert.equal(device.fenceCount, 0);
  const slotWrites = device.writes.filter((write) => write.buffer === sequence.paramsSlotsBuffer);
  assert.deepEqual(slotWrites.map((write) => write.offset), [0, 256]);
  const entryPoints = device.dispatches.map((command) => command.pipeline?.compute?.entryPoint);
  assert.deepEqual(entryPoints.filter((entryPoint) => (
    entryPoint === 'mark_live_source_rows'
      || entryPoint === 'finalize_append'
      || entryPoint === 'scatter_live_source_rows'
  )), [
    'mark_live_source_rows',
    'finalize_append',
    'scatter_live_source_rows',
    'mark_live_source_rows',
    'finalize_append',
    'scatter_live_source_rows'
  ]);
  const appendShader = device.dispatches.find((command) => (
    command.pipeline?.compute?.entryPoint === 'mark_live_source_rows'
  )).pipeline.compute.module.code;
  assert.match(appendShader, /source_row >= exact_count/);
  assert.match(appendShader, /source_row >= params\.source_capacity_rows/);
  assert.match(appendShader, /status == 1\.0 && unplaced_mass_kg > params\.min_live_mass_kg/);
  assert.equal(sequence.markSubmitted().status,
    'resident-product-event-arena-encoder-sequence-submitted');
  assert.equal(device.submissions.length, 0);
  assert.equal(sequence.releaseSubmittedWork(), true);
});

test('conservative multi-append overflow reserves a fixed arena and leaves admission on GPU', () => {
  const device = createFakeDevice();
  const sequence = prepareResidentProductEventArenaGpuEncoderSequence(device, {
    strideFloats: 32,
    sourceRowCount: 4,
    appendCount: 4,
    maxCapacityRows: 10
  });
  assert.equal(sequence.reservation.requiredRowCount, 10);
  assert.equal(sequence.reservation.conservativeUpperBoundSaturated, true);
  assert.equal(sequence.reservation.requestedAppendCount, 4);
  assert.equal(sequence.reservation.appendCountBeforeCapacity, 2);
  assert.equal(
    sequence.reservation.growthPolicy,
    'fixed-approved-capacity-with-gpu-authored-overflow-admission'
  );
  assert.equal(sequence.reservation.overflowAdmission, 'gpu-metadata-capacity-flag-fail-closed');
  const encoder = device.createCommandEncoder();
  sequence.encodeInitialization(encoder);
  for (let index = 0; index < 4; index += 1) {
    sequence.encodeAppend(encoder, {
      source: {
        buffer: sourceBuffer(device, `bounded-overflow-source-${index}`, 4),
        rowCount: 4
      },
      sourceEpoch: index,
      sourceGeneration: index
    });
  }
  assert.equal(sequence.occupiedRowCountUpperBound, 10);
  assert.equal(sequence.markSubmitted().status,
    'resident-product-event-arena-encoder-sequence-submitted');
  assert.equal(sequence.releaseSubmittedWork(), true);
  sequence.arena.destroy();
});

test('arena mark and scatter consume only a GPU-authored exact product-event prefix', () => {
  const device = createFakeDevice();
  const sequence = prepareResidentProductEventArenaGpuEncoderSequence(device, {
    strideFloats: 32,
    sourceRowCount: 8,
    appendCount: 1,
    bucketRows: 8
  });
  const prefixMetadataBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'exact-prefix-metadata',
    size: 80,
    usage: 128
  }), device);
  const prefixDispatchIndirectBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'exact-prefix-dispatch',
    size: 12,
    usage: 128 | 256
  }), device);
  const encoder = device.createCommandEncoder({ label: 'exact-prefix-append' });
  sequence.encodeInitialization(encoder);
  const evidence = sequence.encodeAppend(encoder, {
    source: {
      buffer: sourceBuffer(device, 'exact-prefix-events', 8),
      rowCount: 8,
      prefixMetadataBuffer,
      prefixDispatchIndirectBuffer
    }
  });
  assert.equal(evidence.exactPrefixDispatchEncoded, true);
  assert.equal(evidence.exactPrefixCountAuthority, 'source-prefix-metadata-word-6');
  const exactPasses = device.dispatches.filter((command) => (
    command.pipeline?.compute?.entryPoint === 'mark_live_source_rows'
      || command.pipeline?.compute?.entryPoint === 'scatter_live_source_rows'
  ));
  assert.equal(exactPasses.length, 2);
  assert.ok(exactPasses.every((command) => (
    command.indirectDispatch?.buffer === prefixDispatchIndirectBuffer
      && command.indirectDispatch.offset === 0
  )));
  assert.equal(device.clears.filter(
    ({ buffer }) => buffer === sequence.arena.workspace.flagsBuffer
  ).at(-1)?.size, 8 * Uint32Array.BYTES_PER_ELEMENT);
  const shader = exactPasses[0].pipeline.compute.module.code;
  assert.match(shader, /source_prefix_metadata\[6\]/);
  assert.match(shader, /source_prefix_metadata\[17\] == 4u/);
  assert.match(shader, /workgroup_id\.y \* max\(source_prefix_metadata\[12\], 1u\)/);
  assert.equal(device.submissions.length, 0);
  assert.equal(device.mapCount, 0);
  sequence.markSubmitted();
  sequence.releaseSubmittedWork();
});

test('caller-owned encoder sequence fails closed on incomplete submission and wrong source shape', () => {
  const device = createFakeDevice();
  const sequence = prepareResidentProductEventArenaGpuEncoderSequence(device, {
    strideFloats: 32,
    sourceRowCount: 4,
    appendCount: 2,
    bucketRows: 8
  });
  const encoder = device.createCommandEncoder();
  sequence.encodeInitialization(encoder);
  assert.throws(() => sequence.encodeAppend(encoder, {
    source: { buffer: sourceBuffer(device, 'short-shape', 3), rowCount: 3 }
  }), /fixed source row count 4/);
  sequence.encodeAppend(encoder, {
    source: { buffer: sourceBuffer(device, 'valid-shape', 4), rowCount: 4 }
  });
  assert.throws(() => sequence.markSubmitted(), /encoded 1\/2 appends/);
  assert.equal(sequence.cancelBeforeSubmit('manufactured-abort'), true);
  assert.equal(sequence.arena.destroyed, true);
});

test('cancelled reused encoder sequence restores occupancy and rejects unresolved branching', () => {
  const device = createFakeDevice();
  const arena = createResidentProductEventArenaGpu(device, {
    strideFloats: 32,
    capacityRows: 16,
    sourceCapacityRows: 4,
    maxCapacityRows: 16
  });
  arena.occupiedRowCountUpperBound = 4;
  const sequence = prepareResidentProductEventArenaGpuEncoderSequence(device, {
    arena,
    strideFloats: 32,
    sourceRowCount: 4,
    appendCount: 2
  });
  const encoder = device.createCommandEncoder();
  sequence.encodeInitialization(encoder);
  sequence.encodeAppend(encoder, {
    source: { buffer: sourceBuffer(device, 'cancelled-reuse-source', 4), rowCount: 4 }
  });
  assert.equal(arena.occupiedRowCountUpperBound, 8);
  assert.throws(() => prepareResidentProductEventArenaGpuEncoderSequence(device, {
    arena,
    strideFloats: 32,
    sourceRowCount: 4,
    appendCount: 1
  }), (error) => error?.code === 'ULG_RESIDENT_PRODUCT_EVENT_ENCODER_SEQUENCE_IN_FLIGHT');
  assert.equal(sequence.cancelBeforeSubmit('retryable-command-recording-failure'), true);
  assert.equal(arena.occupiedRowCountUpperBound, 4);
  assert.equal(arena.pendingEncoderSequenceToken, null);
  const retry = prepareResidentProductEventArenaGpuEncoderSequence(device, {
    arena,
    strideFloats: 32,
    sourceRowCount: 4,
    appendCount: 1
  });
  assert.equal(retry.cancelBeforeSubmit('test-cleanup'), true);
  arena.destroy();
});

test('caller-owned encoder sequence rejects a source tagged to another GPU device', () => {
  const device = createFakeDevice();
  const otherDevice = createFakeDevice();
  const sequence = prepareResidentProductEventArenaGpuEncoderSequence(device, {
    strideFloats: 32,
    sourceRowCount: 4,
    appendCount: 1,
    bucketRows: 8
  });
  const encoder = device.createCommandEncoder();
  sequence.encodeInitialization(encoder);
  const foreignSource = tagWebGpuBufferDevice(
    sourceBuffer(otherDevice, 'foreign-reaction-events', 4),
    otherDevice
  );
  assert.throws(() => sequence.encodeAppend(encoder, {
    source: { buffer: foreignSource, rowCount: 4 }
  }), (error) => (
    error?.code === 'ULG_RESIDENT_PRODUCT_EVENT_ARENA_SOURCE_DEVICE_MISMATCH'
  ));
  assert.equal(sequence.cancelBeforeSubmit('cross-device-source-rejected'), true);
});

test('normal append compacts only the new source with retained scan state and no copy, map, or fence', () => {
  const device = createFakeDevice();
  const first = appendResidentProductEventArenaGpu(device, {
    strideFloats: 32,
    sources: [{ buffer: sourceBuffer(device, 'first-events', 2), rowCount: 2 }]
  });
  assert.equal(first.arena.schema, ULG_SPH_RESIDENT_PRODUCT_EVENT_ARENA_SCHEMA);
  assert.equal(first.sourceCompactionPolicy,
    'deterministic-mark-exclusive-scan-finalize-scatter-live-source-prefix');
  assert.equal(first.stableSourceOrderingPreserved, true);
  assert.equal(first.historyCopiedRowCount, 0);
  assert.equal(first.queueFenceAwaited, false);
  assert.equal(first.mapPerformed, false);
  assert.equal(first.occupiedRowCount, null);
  assert.equal(first.activeEventCount, null);
  assert.equal(first.activeEventCountAuthority, 'gpu-authored-metadata-word-3');
  assert.equal(device.copies.length, 0);
  assert.equal(device.fenceCount, 0);
  assert.equal(device.mapCount, 0);

  const retainedBuffer = first.arena.buffer;
  const bufferCountBefore = device.buffers.length;
  const dispatchCountBefore = device.dispatches.length;
  const second = appendResidentProductEventArenaGpu(device, {
    arena: first.arena,
    strideFloats: 32,
    sources: [{ buffer: sourceBuffer(device, 'second-events', 3), rowCount: 3 }]
  });
  const secondSourceAllocationCount = 1;
  assert.equal(second.reused, true);
  assert.equal(second.normalAppendAllocationFree, true);
  assert.equal(second.arena.buffer, retainedBuffer);
  assert.equal(second.historyCopiedRowCount, 0);
  assert.equal(device.copies.length, 0);
  assert.equal(device.buffers.length, bufferCountBefore + secondSourceAllocationCount);
  assert.equal(device.fenceCount, 0);
  assert.equal(device.mapCount, 0);
  const newEntryPoints = device.dispatches.slice(dispatchCountBefore)
    .map((command) => command.pipeline?.compute?.entryPoint);
  assert.equal(newEntryPoints[0], 'mark_live_source_rows');
  assert.ok(newEntryPoints.includes('scan_blocks'));
  assert.equal(newEntryPoints.at(-2), 'finalize_append');
  assert.equal(newEntryPoints.at(-1), 'scatter_live_source_rows');
  const appendShader = device.dispatches.find((command) => (
    command.pipeline?.compute?.entryPoint === 'finalize_append'
  ))?.pipeline?.compute?.module?.code;
  assert.match(appendShader, /dispatch_indirect\[0\] = 0u;/);

  const descriptor = createResidentProductEventArenaCapacityDescriptor(second.arena);
  assert.equal(descriptor.activeEventCount, null);
  assert.equal(descriptor.occupiedRowCount, null);
  assert.equal(descriptor.occupiedRowCountUpperBound, 5);
  assert.equal(descriptor.reservedRowCapacity, 4096);
  assert.equal(descriptor.dispatchIndirectBuffer, second.arena.dispatchIndirectBuffer);
  assert.equal(descriptor.consumerDispatchPolicy,
    'dispatch-workgroups-indirect-from-exact-gpu-active-prefix');
  assert.match(descriptor.capacityPlanningLimitation, /conservative/);
});

test('geometric growth copies the prior bounded prefix once, then compacts only the new source', () => {
  const device = createFakeDevice();
  const first = appendResidentProductEventArenaGpu(device, {
    strideFloats: 32,
    sources: [{ buffer: sourceBuffer(device, 'initial-events', 4095), rowCount: 4095 }]
  });
  const growthSource = sourceBuffer(device, 'growth-events', 2);
  const growth = appendResidentProductEventArenaGpu(device, {
    arena: first.arena,
    strideFloats: 32,
    sources: [{ buffer: growthSource, rowCount: 2 }]
  });
  assert.equal(growth.grew, true);
  assert.equal(growth.arena.capacityRows, 8192);
  assert.equal(growth.historyCopiedRowCount, 4095);
  assert.equal(growth.occupiedRowCountUpperBound, 4097);
  assert.equal(device.copies.length, 3);
  assert.equal(device.copies[0].source, first.arena.buffer);
  assert.equal(device.copies[0].size, 4095 * 128);
  assert.equal(device.copies[1].source, first.arena.metadataBuffer);
  assert.equal(device.copies[2].source, first.arena.dispatchIndirectBuffer);
  assert.ok(device.copies.every((copy) => copy.source !== growthSource));
  assert.equal(device.fenceCount, 0);
  assert.equal(device.mapCount, 0);
});

test('metadata decoding admits only an exact dense active prefix without overflow', () => {
  const words = new Uint32Array(SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA_WORDS);
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.magic] = 0x554c4750;
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.version] = 1;
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.occupiedRowCount] = 37;
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.activeRowCount] = 37;
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.capacityRows] = 4096;
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.appendedRowCount] = 5;
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.appendAdmitted] = 1;
  const metadata = decodeResidentProductEventArenaMetadata(words);
  assert.equal(metadata.occupiedRowCount, 37);
  assert.equal(metadata.activeRowCount, 37);
  assert.equal(metadata.appendAdmitted, true);
  assert.equal(metadata.admitted, true);
  words[SPH_RESIDENT_PRODUCT_EVENT_ARENA_METADATA.activeRowCount] = 36;
  assert.equal(decodeResidentProductEventArenaMetadata(words).admitted, false);
});
