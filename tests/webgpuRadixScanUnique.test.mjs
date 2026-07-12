import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWebGpuRadixUniquePlan,
  createWebGpuStableRadixScanUnique,
  createWebGpuU32ExclusiveScan,
  createWebGpuU32ScanPlan,
  WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT,
  webGpuDispatchShapeId,
  webGpuStableRadixWgsl,
  webGpuU32ExclusiveScanWgsl,
  webGpuSortedUniqueWgsl
} from '../src/runtime/webgpuRadixScanUnique.js';
import {
  ULG_WEBGPU_RADIX_UNIQUE_ABI,
  ULG_WEBGPU_U32_SCAN_ABI,
  WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT,
  WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';

function createFakeDevice() {
  const buffers = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  const device = {
    buffers,
    pipelines,
    bindGroups,
    writes,
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, byteLength: data.byteLength });
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
        getBindGroupLayout(index) { return { pipeline: descriptor.label, index }; }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
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

function computePasses(encoder) {
  return encoder.events.filter((event) => event.kind === 'pass');
}

function computeCommands(encoder) {
  return computePasses(encoder).flatMap((event) => event.commands);
}

test('hierarchical exclusive scan plan remains bounded beyond one block', () => {
  const plan = createWebGpuU32ScanPlan({ elementCount: 1_000_000 });
  assert.equal(plan.levelCount, 3);
  assert.deepEqual(plan.levels.map((level) => level.groupCount), [1954, 4, 1]);
  assert.ok(plan.scratchByteLength > 0);
  assert.equal(plan.readbackRequired, false);
});

test('parallel primitive ABI fixes u32 evidence, CSR, and indirect-dispatch ownership', () => {
  assert.equal(ULG_WEBGPU_U32_SCAN_ABI.scalarEncoding, 'u32');
  assert.equal(ULG_WEBGPU_RADIX_UNIQUE_ABI.sortPayload, 'stable-u32-permutation-indices');
  assert.equal(ULG_WEBGPU_RADIX_UNIQUE_ABI.submissionOwnership, 'caller');
  assert.equal(WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT.length, 8);
  assert.equal(WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT.length, 3);
});

test('multiword radix plan is stable lexicographic and scans one flattened histogram', () => {
  const plan = createWebGpuRadixUniquePlan({
    elementCount: 300_000,
    keyWordCount: 5,
    keyStrideWords: 8
  });
  assert.equal(plan.workgroupCount, 1172);
  assert.equal(plan.histogramElementCount, 18_752);
  assert.equal(plan.passCount, 40);
  assert.equal(plan.stable, true);
  assert.equal(plan.recordsMoved, false);
  assert.equal(plan.readbackRequired, false);
});

test('300k five-word radix topology fuses bounded scan tops to 168 ordered dispatches', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const keyBuffer = device.createBuffer({
    label: 'large-command-topology-keys',
    size: 300_000 * 5 * 4,
    usage: 128
  });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 300_000,
    maxKeyWordCount: 5,
    label: 'large-command-topology',
    retainConstantScanParamsBuffers: true
  });
  const result = runtime.encodeSortUnique(encoder, {
    keyBuffer,
    elementCount: 300_000,
    keyWordCount: 5,
    keyStrideWords: 5,
    generationId: 7
  });

  assert.equal(result.encodedDispatchCount, 168);
  assert.equal(computeCommands(encoder).length, 168);
  assert.equal(
    computeCommands(encoder).filter((command) => (
      command.pipeline.endsWith('-histogram-scan-fused-top-add')
    )).length,
    40
  );
  assert.equal(
    computeCommands(encoder).filter((command) => (
      command.pipeline.endsWith('-head-scan-fused-top-add')
    )).length,
    1
  );
  runtime.releaseTransientBuffers(result);
  runtime.destroy();
});

test('scan and radix plans linearize workgroups into bounded 2D dispatches', () => {
  const scan = createWebGpuU32ScanPlan({
    elementCount: 8192,
    maxComputeWorkgroupsPerDimension: 4
  });
  assert.deepEqual(scan.levels[0].dispatch, [4, 4, 1]);
  const radix = createWebGpuRadixUniquePlan({
    elementCount: 3000,
    keyWordCount: 2,
    maxComputeWorkgroupsPerDimension: 4
  });
  assert.deepEqual(radix.workgroupDispatch, [4, 3, 1]);
});

test('stable dispatch-shape ids route grouped and timestamp passes through one GPU gate bank', () => {
  const device = createFakeDevice();
  const keyBuffer = device.createBuffer({ label: 'gated-keys', size: 4096, usage: 128 });
  const gateBuffer = device.createBuffer({ label: 'gpu-dispatch-gates', size: 4096, usage: 384 });
  const shapeOffsets = new Map();
  const provider = {
    buffer: gateBuffer,
    byteOffsetFor(dispatch, shapeId) {
      assert.equal(shapeId, webGpuDispatchShapeId(dispatch));
      if (!shapeOffsets.has(shapeId)) shapeOffsets.set(shapeId, shapeOffsets.size * 12);
      return shapeOffsets.get(shapeId);
    }
  };
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 1024,
    maxKeyWordCount: 1,
    label: 'gated-radix'
  });
  const encoder = createFakeEncoder();
  runtime.encodeSortUnique(encoder, {
    keyBuffer,
    elementCount: 1000,
    keyWordCount: 1,
    keyStrideWords: 1,
    generationId: 11,
    dispatchIndirectProvider: provider
  });
  const commands = computeCommands(encoder);
  assert.ok(commands.length > 0);
  assert.equal(commands.every((command) => command.dispatch === undefined), true);
  assert.equal(commands.every((command) => (
    command.dispatchIndirect?.label === 'gpu-dispatch-gates'
    && command.dispatchIndirect.byteOffset % 12 === 0
  )), true);
  assert.ok(shapeOffsets.has(webGpuDispatchShapeId([4, 1, 1])));
  assert.ok(shapeOffsets.has(webGpuDispatchShapeId([1, 1, 1])));
  const profiledEncoder = createFakeEncoder();
  const timestampProfiler = {
    active: true,
    beginComputePassDescriptor(label, metadata) {
      return { label, metadata, timestampWrites: { querySet: {} } };
    }
  };
  runtime.encodeSortUnique(profiledEncoder, {
    keyBuffer,
    elementCount: 1000,
    keyWordCount: 1,
    keyStrideWords: 1,
    generationId: 12,
    timestampProfiler,
    dispatchIndirectProvider: provider
  });
  assert.equal(computePasses(profiledEncoder).length, 30);
  assert.equal(computeCommands(profiledEncoder).every((command) => (
    command.dispatch === undefined && command.dispatchIndirect?.label === 'gpu-dispatch-gates'
  )), true);
  runtime.destroy();
});

test('scan and radix shaders use parallel portable workgroups without serial prefix kernels', () => {
  assert.match(webGpuU32ExclusiveScanWgsl, /@workgroup_size\(256\)[\s\S]*fn scan_blocks/);
  assert.match(webGpuU32ExclusiveScanWgsl, /var<workgroup> scan_values: array<u32, 512>/);
  assert.match(webGpuU32ExclusiveScanWgsl, /group_valid = linear_group < scan_group_count/);
  assert.match(webGpuU32ExclusiveScanWgsl, /fn scan_top_and_add_lower/);
  assert.match(webGpuU32ExclusiveScanWgsl, /lower_index = lower_index \+ 256u/);
  assert.match(webGpuStableRadixWgsl, /var<workgroup> digit_prefix: array<vec4<u32>, 1024>/);
  assert.match(webGpuStableRadixWgsl, /linear_group < radix_params\.workgroup_count/);
  assert.match(webGpuStableRadixWgsl, /for \(var offset = 1u; offset < 256u;/);
  assert.doesNotMatch(webGpuStableRadixWgsl, /@workgroup_size\(1\)[\s\S]*prefix/i);
  assert.match(webGpuSortedUniqueWgsl, /fn mark_heads/);
  assert.match(webGpuSortedUniqueWgsl, /fn scatter_unique/);
  assert.match(webGpuSortedUniqueWgsl, /unique_output_offsets\[unique_count\]/);
});

test('radix sort and unique encode a no-readback GPU CSR with indirect dispatch', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const keyBuffer = device.createBuffer({ label: 'keys', size: 4096, usage: 128 });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 1024,
    maxKeyWordCount: 5,
    label: 'test-radix'
  });
  const result = runtime.encodeSortUnique(encoder, {
    keyBuffer,
    elementCount: 1000,
    keyWordCount: 5,
    keyStrideWords: 5,
    generationId: 9,
    consumerWorkgroupSize: 64
  });

  assert.equal(result.status, 'webgpu-stable-radix-sort-unique-csr-encoded');
  assert.equal(result.radixPassCount, 40);
  assert.equal(result.readbackPerformed, false);
  assert.equal(result.generationId, 9);
  assert.equal(result.uniqueDispatchIndirectBuffer.usage & 256, 256);
  const passes = computePasses(encoder);
  const commands = computeCommands(encoder);
  assert.deepEqual(
    passes.map((pass) => pass.descriptor.label),
    ['test-radixGroupedRadixSort', 'test-radixGroupedUnique']
  );
  assert.equal(passes.every((pass) => pass.ended), true);
  assert.equal(commands.length, 126);
  assert.ok(commands.some((command) => command.pipeline === 'test-radix-initialize'));
  assert.equal(
    commands.filter((command) => command.pipeline === 'test-radix-histogram').length,
    40
  );
  assert.equal(
    commands.filter((command) => command.pipeline === 'test-radix-scatter').length,
    40
  );
  assert.ok(commands.some((command) => command.pipeline === 'test-radix-mark-heads'));
  assert.ok(commands.some((command) => command.pipeline === 'test-radix-scatter-unique'));
  assert.ok(commands.some((command) => command.pipeline === 'test-radix-finalize-unique'));
  assert.equal(
    encoder.events.filter((event) => event.kind === 'clear').length,
    3
  );
  assert.equal(
    encoder.events.some((event) => event.kind === 'clear' && event.label.endsWith('-histograms')),
    false
  );
  assert.ok(result.transientBuffers.length > 0);

  runtime.releaseTransientBuffers(result);
  assert.ok(result.transientBuffers.every((buffer) => buffer.destroyed));
  runtime.destroy();
});

test('standalone scans fuse the bounded top scan with its lower offset add', () => {
  const device = createFakeDevice();
  const inputBuffer = device.createBuffer({ label: 'scan-input', size: 4_000_000, usage: 128 });
  const outputBuffer = device.createBuffer({ label: 'scan-output', size: 4_000_000, usage: 128 });
  const runtime = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: 1_000_000,
    label: 'test-scan'
  });

  const groupedEncoder = createFakeEncoder();
  const grouped = runtime.encode(groupedEncoder, {
    inputBuffer,
    outputBuffer,
    elementCount: 1_000_000
  });
  assert.equal(grouped.plan.levelCount, 3);
  assert.equal(computePasses(groupedEncoder).length, 1);
  assert.equal(grouped.fusedTopAddEnabled, true);
  assert.equal(computeCommands(groupedEncoder).length, 4);
  assert.deepEqual(
    computeCommands(groupedEncoder).map((command) => command.pipeline),
    [
      'test-scan-blocks',
      'test-scan-blocks',
      'test-scan-fused-top-add',
      'test-scan-add-block-offsets'
    ]
  );

  const spans = [];
  const timestampProfiler = {
    active: true,
    beginComputePassDescriptor(label, metadata) {
      spans.push({ label, metadata });
      return { label, timestampWrites: { querySet: {}, beginningOfPassWriteIndex: 0 } };
    }
  };
  const profiledEncoder = createFakeEncoder();
  const profiled = runtime.encode(profiledEncoder, {
    inputBuffer,
    outputBuffer,
    elementCount: 1_000_000
  }, { timestampProfiler });
  assert.equal(computePasses(profiledEncoder).length, 4);
  assert.equal(computeCommands(profiledEncoder).length, 4);
  assert.equal(spans.length, 4);
  assert.deepEqual(spans.map((span) => span.metadata.scanLevel), [0, 1, 2, 0]);
  assert.equal(spans[2].metadata.fusedLowerLevel, 1);

  runtime.releaseTransientBuffers(grouped);
  runtime.releaseTransientBuffers(profiled);
  runtime.destroy();
});

test('active timestamp profiling preserves radix and unique stage pass attribution', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const keyBuffer = device.createBuffer({ label: 'profiled-keys', size: 4096, usage: 128 });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 1024,
    maxKeyWordCount: 1,
    label: 'profiled-radix'
  });
  const spans = [];
  const timestampProfiler = {
    active: true,
    beginComputePassDescriptor(label, metadata) {
      spans.push({ label, metadata });
      return { label, timestampWrites: { querySet: {}, beginningOfPassWriteIndex: 0 } };
    }
  };

  const result = runtime.encodeSortUnique(encoder, {
    keyBuffer,
    elementCount: 1000,
    keyWordCount: 1,
    generationId: 12,
    timestampProfiler,
    timestampMetadata: { taskId: 'profiled-task' }
  });

  assert.equal(result.readbackPerformed, false);
  assert.equal(computePasses(encoder).length, 30);
  assert.equal(computeCommands(encoder).length, 30);
  assert.equal(computePasses(encoder).every((pass) => pass.commands.length === 1), true);
  assert.equal(spans.length, 30);
  assert.equal(spans.filter((span) => span.label === 'profiled-radixHistogram').length, 8);
  assert.equal(spans.filter((span) => span.label === 'profiled-radixScatter').length, 8);
  assert.equal(spans.some((span) => span.label === 'profiled-radixMarkUniqueHeads'), true);
  assert.equal(spans.some((span) => span.label === 'profiled-radixFinalizeUnique'), true);
  assert.equal(spans.every((span) => span.metadata.taskId === 'profiled-task'), true);
  assert.equal(
    encoder.events.filter((event) => event.kind === 'clear').length,
    3
  );

  runtime.releaseTransientBuffers(result);
  runtime.destroy();
});

test('fixed-count radix scans retain immutable scan params across encodings', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const keyBuffer = device.createBuffer({ label: 'keys', size: 4096, usage: 128 });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 1024,
    maxKeyWordCount: 5,
    label: 'fixed-radix',
    retainConstantScanParamsBuffers: true,
    retainedParamsSlotCount: 2
  });
  const bufferCountBeforeFirst = device.buffers.length;

  const writesBeforeFirst = device.writes.length;
  const bindGroupsBeforeFirst = device.bindGroups.length;
  const first = runtime.encodeSortUnique(encoder, {
    keyBuffer,
    elementCount: 1024,
    keyWordCount: 5,
    keyStrideWords: 5,
    generationId: 1
  });
  const firstWriteCount = device.writes.length - writesBeforeFirst;
  const firstBindGroupCount = device.bindGroups.length - bindGroupsBeforeFirst;
  const bufferCountAfterFirst = device.buffers.length;
  const writesBeforeSecond = device.writes.length;
  const bindGroupsBeforeSecond = device.bindGroups.length;
  const second = runtime.encodeSortUnique(encoder, {
    keyBuffer,
    elementCount: 1024,
    keyWordCount: 5,
    keyStrideWords: 5,
    generationId: 2
  });
  const secondWriteCount = device.writes.length - writesBeforeSecond;
  const secondBindGroupCount = device.bindGroups.length - bindGroupsBeforeSecond;
  const bufferCountAfterSecond = device.buffers.length;
  const roles = runtime.allocationEntries().map((entry) => entry.role);

  assert.equal(roles.filter((role) => role === 'scan-params-retained').length, 2);
  assert.equal(roles.filter((role) => role === 'radix-params-retained-arena').length, 1);
  assert.equal(roles.filter((role) => role === 'unique-params-retained-arena').length, 1);
  assert.equal(roles.includes('scan-params-transient'), false);
  assert.equal(roles.includes('radix-unique-params-transient'), false);
  assert.equal(first.transientBuffers.length, 0);
  assert.equal(second.transientBuffers.length, 0);
  assert.equal(firstWriteCount, 4);
  assert.equal(secondWriteCount, 2);
  assert.equal(first.paramsBufferCreationCount, 0);
  assert.equal(second.paramsBufferCreationCount, 0);
  assert.equal(first.paramsSlotIndex, 0);
  assert.equal(second.paramsSlotIndex, 1);
  assert.equal(runtime.paramsOffsetAlignment, 256);
  assert.deepEqual(
    device.writes
      .filter(({ buffer }) => buffer.label === 'fixed-radix-radix-params-retained-arena')
      .map(({ offset }) => offset),
    [0, runtime.radixParamsSlotStrideBytes]
  );
  assert.deepEqual(
    device.writes
      .filter(({ buffer }) => buffer.label === 'fixed-radix-unique-params-retained-arena')
      .map(({ offset }) => offset),
    [0, runtime.uniqueParamsSlotStrideBytes]
  );
  assert.equal(bufferCountAfterFirst, bufferCountBeforeFirst);
  assert.equal(bufferCountAfterSecond, bufferCountBeforeFirst);
  assert.equal(secondBindGroupCount, firstBindGroupCount - 3);
  assert.equal(second.bindGroupCreationCount, first.bindGroupCreationCount - 3);
  assert.throws(
    () => runtime.encodeSortUnique(encoder, {
      keyBuffer,
      elementCount: 1024,
      keyWordCount: 5,
      keyStrideWords: 5,
      generationId: 3
    }),
    (error) => error?.code === 'ERR_WEBGPU_RADIX_PARAMS_ARENA_EXHAUSTED'
      && error.slotCapacity === 2
  );

  runtime.releaseTransientBuffers(first);
  const bindGroupsBeforeThird = device.bindGroups.length;
  const third = runtime.encodeSortUnique(encoder, {
    keyBuffer,
    elementCount: 1024,
    keyWordCount: 5,
    keyStrideWords: 5,
    generationId: 3
  });
  assert.equal(third.paramsSlotIndex, 0);
  assert.equal(device.bindGroups.length - bindGroupsBeforeThird, 0);
  assert.equal(third.bindGroupCreationCount, 0);
  assert.ok(third.bindGroupReuseCount > 0);
  runtime.releaseTransientBuffers(third);

  const alternateKeyBuffer = device.createBuffer({
    label: 'alternate-keys',
    size: 4096,
    usage: 128
  });
  const changedResource = runtime.encodeSortUnique(encoder, {
    keyBuffer: alternateKeyBuffer,
    elementCount: 1024,
    keyWordCount: 5,
    keyStrideWords: 5,
    generationId: 4
  });
  assert.equal(changedResource.paramsSlotIndex, 0);
  assert.ok(changedResource.bindGroupCreationCount > 0);
  assert.ok(changedResource.bindGroupReuseCount > 0);
  runtime.releaseTransientBuffers(changedResource);
  assert.throws(
    () => runtime.encodeSortUnique(encoder, {
      keyBuffer,
      elementCount: 1000,
      keyWordCount: 5,
      keyStrideWords: 5,
      generationId: 5
    }),
    /fixed elementCount 1024/
  );

  runtime.releaseTransientBuffers(second);
  runtime.destroy();
});

test('variable-count retained scan rewrites params when the active range changes', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const inputBuffer = device.createBuffer({ label: 'variable-scan-input', size: 4096, usage: 128 });
  const outputBuffer = device.createBuffer({ label: 'variable-scan-output', size: 4096, usage: 128 });
  const scan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: 1024,
    label: 'variable-retained-scan',
    retainParamsBuffer: true
  });
  const first = scan.encode(encoder, { inputBuffer, outputBuffer, elementCount: 1024 });
  const writesAfterFirst = device.writes.filter(
    ({ buffer }) => buffer.label === 'variable-retained-scan-params-retained'
  ).length;
  const second = scan.encode(encoder, { inputBuffer, outputBuffer, elementCount: 256 });
  const writesAfterSecond = device.writes.filter(
    ({ buffer }) => buffer.label === 'variable-retained-scan-params-retained'
  ).length;
  assert.equal(first.paramsWritePerformed, true);
  assert.equal(second.paramsWritePerformed, true);
  assert.equal(writesAfterFirst, 1);
  assert.equal(writesAfterSecond, 2);
  assert.equal(first.transientBuffers.length, 0);
  assert.equal(second.transientBuffers.length, 0);
  scan.destroy();
});

test('retained parameter slots preserve direct reentrant sort and unique callers', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const keyBuffer = device.createBuffer({ label: 'direct-retained-keys', size: 256, usage: 128 });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 64,
    maxKeyWordCount: 1,
    label: 'direct-retained',
    retainConstantScanParamsBuffers: true,
    retainedParamsSlotCount: 2
  });
  const spans = [];
  const timestampProfiler = {
    active: true,
    beginComputePassDescriptor(label, metadata) {
      spans.push({ label, metadata });
      return { label, metadata, timestampWrites: { querySet: {} } };
    }
  };

  const sorted = runtime.encodeSort(encoder, {
    keyBuffer,
    elementCount: 64,
    keyWordCount: 1,
    generationId: 11,
    retainedParamsSlotIndex: 1,
    timestampProfiler,
    timestampMetadata: { taskId: 'direct-retained-task' }
  });
  const unique = runtime.encodeUnique(encoder, {
    keyBuffer,
    sortedIndicesBuffer: sorted.sortedIndicesBuffer,
    elementCount: 64,
    keyWordCount: 1,
    generationId: 11,
    retainedParamsSlotIndex: 0,
    timestampProfiler,
    timestampMetadata: { taskId: 'direct-retained-task' }
  });

  assert.equal(sorted.paramsSlotIndex, 1);
  assert.equal(unique.paramsSlotIndex, 0);
  assert.equal(sorted.paramsBufferCreationCount, 0);
  assert.equal(unique.paramsBufferCreationCount, 0);
  assert.equal(sorted.transientBuffers.length, 0);
  assert.equal(unique.transientBuffers.length, 0);
  assert.equal(sorted.readbackPerformed ?? false, false);
  assert.equal(unique.readbackPerformed, false);
  assert.equal(spans.some(({ label }) => label === 'direct-retainedInitialize'), true);
  assert.equal(spans.some(({ label }) => label === 'direct-retainedFinalizeUnique'), true);
  assert.equal(spans.every(({ metadata }) => metadata.taskId === 'direct-retained-task'), true);
  assert.throws(
    () => runtime.encodeSort(encoder, {
      keyBuffer,
      elementCount: 64,
      keyWordCount: 1,
      generationId: 12
    }),
    (error) => error?.code === 'ERR_WEBGPU_RADIX_PARAMS_ARENA_EXHAUSTED'
  );

  runtime.releaseTransientBuffers(sorted);
  runtime.releaseTransientBuffers(unique);
  runtime.destroy();
});

test('default retained arena holds two 49-generation submissions without slot aliasing', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const keyBuffer = device.createBuffer({ label: 'window-keys', size: 256, usage: 128 });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 64,
    maxKeyWordCount: 1,
    label: 'retained-window',
    retainConstantScanParamsBuffers: true
  });
  const bufferCount = device.buffers.length;
  const inFlight = Array.from({ length: 98 }, (_, generationId) => (
    runtime.encodeSortUnique(encoder, {
      keyBuffer,
      elementCount: 64,
      keyWordCount: 1,
      generationId: generationId + 1
    })
  ));

  assert.equal(WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT, 128);
  assert.equal(runtime.retainedParamsSlotCount, WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT);
  assert.deepEqual(inFlight.map(({ paramsSlotIndex }) => paramsSlotIndex), [
    ...Array.from({ length: 98 }, (_, index) => index)
  ]);
  assert.equal(inFlight.every(({ paramsBufferCreationCount }) => paramsBufferCreationCount === 0), true);
  assert.equal(inFlight.every(({ transientBuffers }) => transientBuffers.length === 0), true);
  assert.equal(device.buffers.length, bufferCount);

  for (const execution of inFlight.slice(0, 49)) runtime.releaseTransientBuffers(execution);
  const replacements = Array.from({ length: 49 }, (_, index) => (
    runtime.encodeSortUnique(encoder, {
      keyBuffer,
      elementCount: 64,
      keyWordCount: 1,
      generationId: 100 + index
    })
  ));
  assert.deepEqual(
    replacements.map(({ paramsSlotIndex }) => paramsSlotIndex),
    Array.from({ length: 49 }, (_, index) => index)
  );
  assert.equal(replacements.every(({ bindGroupCreationCount }) => bindGroupCreationCount === 0), true);
  assert.equal(replacements.every(({ bindGroupReuseCount }) => bindGroupReuseCount > 0), true);
  assert.equal(device.buffers.length, bufferCount);

  for (const execution of [...inFlight.slice(49), ...replacements]) {
    runtime.releaseTransientBuffers(execution);
  }
  runtime.destroy();
});

test('radix plan rejects capacity and key-stride ambiguity', () => {
  assert.throws(
    () => createWebGpuRadixUniquePlan({ elementCount: 1, keyWordCount: 5, keyStrideWords: 4 }),
    /keyStrideWords/
  );
  assert.throws(
    () => createWebGpuRadixUniquePlan({ elementCount: 1, keyWordCount: 9 }),
    /keyWordCount/
  );
});

test('runtime rejects scratch that exceeds a device storage binding limit', () => {
  const device = createFakeDevice();
  device.limits = {
    maxBufferSize: 16_384,
    maxStorageBufferBindingSize: 128,
    maxComputeWorkgroupsPerDimension: 65535
  };
  assert.throws(
    () => createWebGpuStableRadixScanUnique(device, {
      maxElementCount: 1024,
      maxKeyWordCount: 2
    }),
    /maxStorageBufferBindingSize/
  );
});
