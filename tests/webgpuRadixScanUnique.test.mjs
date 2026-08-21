import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWebGpuRadixGpuCountControlLayout,
  createWebGpuRadixUniquePlan,
  createWebGpuStableRadixScanUnique,
  createWebGpuU32ExclusiveScan,
  createWebGpuU32ScanPlan,
  WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT,
  WEBGPU_RADIX_SCATTER_WORKGROUP_STORAGE_BYTES,
  WEBGPU_RADIX_UNIQUE_CLEARED_WORD_COUNT,
  webGpuDispatchShapeId,
  webGpuRadixGpuCountPrepareWgsl,
  webGpuRadixGpuCountScanWgsl,
  webGpuRadixGpuCountUniqueWgsl,
  webGpuRadixGpuCountWgsl,
  webGpuSerialRadixHistogramScanWgsl,
  webGpuStableRadixWgsl,
  webGpuU32ExclusiveScanWgsl,
  webGpuSortedUniqueWgsl
} from '../src/runtime/webgpuRadixScanUnique.js';
import {
  ULG_WEBGPU_RADIX_GPU_COUNT_ABI,
  ULG_WEBGPU_RADIX_UNIQUE_ABI,
  ULG_WEBGPU_U32_SCAN_ABI,
  WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT,
  WEBGPU_PARALLEL_PRIMITIVE_STATUS_ADMITTED,
  WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW,
  WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED,
  WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_SEAL,
  WEBGPU_PARALLEL_PRIMITIVE_STATUS_READY,
  WEBGPU_RADIX_GPU_COUNT_CONTROL_HEADER_LAYOUT,
  WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';

const RUN_NATIVE_GPU_COUNT =
  process.env.ULG_RUN_NATIVE_WEBGPU_RADIX_COUNT === '1';
const NATIVE_GPU_COUNT_BASE_URL =
  process.env.ULG_WEBGPU_RADIX_COUNT_BASE_URL
  || 'https://127.0.0.1:5174/';

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
        const byteOffset = data.byteOffset ?? 0;
        const wordLength = Math.min(32, Math.floor(data.byteLength / 4));
        writes.push({
          buffer,
          offset,
          byteLength: data.byteLength,
          words: Array.from(new Uint32Array(data.buffer, byteOffset, wordLength))
        });
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCallCount: 0,
        destroy() {
          this.destroyCallCount += 1;
          this.destroyed = true;
        }
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

function createFailureInjectedDevice() {
  const device = createFakeDevice();
  const counts = {
    createBuffer: 0,
    createShaderModule: 0,
    createComputePipeline: 0,
    createBindGroup: 0,
    writeBuffer: 0
  };
  const failAt = {
    createBuffer: null,
    createShaderModule: null,
    createComputePipeline: null,
    createBindGroup: null,
    writeBuffer: null
  };
  const wrap = (operation, invoke) => (...args) => {
    counts[operation] += 1;
    if (counts[operation] === failAt[operation]) {
      throw new Error(`injected ${operation} failure ${counts[operation]}`);
    }
    return invoke(...args);
  };
  device.createBuffer = wrap('createBuffer', device.createBuffer);
  device.createShaderModule = wrap(
    'createShaderModule',
    device.createShaderModule
  );
  device.createComputePipeline = wrap(
    'createComputePipeline',
    device.createComputePipeline
  );
  device.createBindGroup = wrap('createBindGroup', device.createBindGroup);
  device.queue.writeBuffer = wrap('writeBuffer', device.queue.writeBuffer);
  device.failureInjection = {
    counts,
    failAt,
    failRelative(operation, relativeCall) {
      failAt[operation] = counts[operation] + relativeCall;
    },
    clear(operation) {
      failAt[operation] = null;
    },
    clearAll() {
      for (const operation of Object.keys(failAt)) failAt[operation] = null;
    }
  };
  return device;
}

function assertDestroyedExactlyOnce(buffers, context) {
  for (const buffer of buffers) {
    assert.equal(buffer.destroyed, true, `${context}: ${buffer.label} destroyed`);
    assert.equal(
      buffer.destroyCallCount,
      1,
      `${context}: ${buffer.label} destroyed exactly once`
    );
  }
}

function assertBuffersRemainLive(buffers, context) {
  for (const buffer of buffers) {
    assert.equal(buffer.destroyed, false, `${context}: ${buffer.label} remains live`);
    assert.equal(
      buffer.destroyCallCount,
      0,
      `${context}: ${buffer.label} was not rolled back`
    );
  }
}

function createFakeEncoder() {
  const events = [];
  return {
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', label: buffer.label, offset, size });
    },
    writeTimestamp(querySet, queryIndex) {
      events.push({ kind: 'timestamp', querySet, queryIndex });
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

function createFailureInjectedEncoder(operation, failAtCall = 1) {
  const encoder = createFakeEncoder();
  let operationCallCount = 0;
  const fail = () => {
    operationCallCount += 1;
    if (operationCallCount === failAtCall) {
      throw new Error(`injected encoder ${operation} failure`);
    }
  };
  if (operation === 'clearBuffer') {
    const clearBuffer = encoder.clearBuffer.bind(encoder);
    encoder.clearBuffer = (...args) => {
      fail();
      return clearBuffer(...args);
    };
    return encoder;
  }
  const beginComputePass = encoder.beginComputePass.bind(encoder);
  encoder.beginComputePass = (...args) => {
    if (operation === 'beginComputePass') fail();
    const pass = beginComputePass(...args);
    if (operation in pass) {
      const invoke = pass[operation].bind(pass);
      pass[operation] = (...passArgs) => {
        fail();
        return invoke(...passArgs);
      };
    }
    return pass;
  };
  return encoder;
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
  assert.equal(
    ULG_WEBGPU_RADIX_UNIQUE_ABI.sortedGroupIndexPayload,
    'exclusive-unique-head-prefix-per-sorted-row'
  );
  assert.equal(ULG_WEBGPU_RADIX_UNIQUE_ABI.submissionOwnership, 'caller');
  assert.equal(WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT.length, 8);
  assert.equal(WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT.length, 3);
});

test('GPU-count ABI seals authority publication and fixes a zero-dispatch control topology', () => {
  assert.equal(ULG_WEBGPU_RADIX_GPU_COUNT_ABI.countOwnership,
    'authenticated-gpu-authority-buffer');
  assert.equal(ULG_WEBGPU_RADIX_GPU_COUNT_ABI.inactiveDispatchPolicy,
    'zero-workgroup-indirect-row');
  assert.equal(ULG_WEBGPU_RADIX_GPU_COUNT_ABI.overflowPolicy,
    'fail-closed-zero-dispatch');
  assert.equal(ULG_WEBGPU_RADIX_GPU_COUNT_ABI.resourcePreparation,
    'explicit-prewarm-outside-encode');
  assert.equal(ULG_WEBGPU_RADIX_GPU_COUNT_ABI.executionConcurrency,
    'single-flight-per-runtime-until-discard-or-submission-fence');
  assert.match(ULG_WEBGPU_RADIX_GPU_COUNT_ABI.authorityPublication,
    /writes-count-before-generation-seal/);
  assert.equal(WEBGPU_RADIX_GPU_COUNT_CONTROL_HEADER_LAYOUT.length, 32);
  assert.ok(WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_SEAL
    > WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED);
  assert.ok(WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW
    > WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_SEAL);

  const layout = createWebGpuRadixGpuCountControlLayout({
    maxElementCount: 1024
  });
  assert.deepEqual(layout, {
    headerWordCount: 32,
    histogramScanLevelCount: 1,
    headScanLevelCount: 2,
    histogramScanCountOffsetWords: 32,
    headScanCountOffsetWords: 33,
    radixDispatchOffsetWords: 35,
    radixDispatchOffsetBytes: 140,
    histogramScanDispatchOffsetWords: 38,
    headScanDispatchOffsetWords: 44,
    indirectRowCount: 7,
    controlWordCount: 56,
    controlByteLength: 224,
    dispatchRowWordCount: 3
  });
});

test('GPU-count shaders authenticate and recheck the authority while bounding every stage', () => {
  assert.match(
    webGpuRadixGpuCountPrepareWgsl,
    /observed_count[\s\S]*observed_seal[\s\S]*expected_generation_seal/
  );
  assert.match(
    webGpuRadixGpuCountPrepareWgsl,
    /STATUS_FAIL_CLOSED \| STATUS_INVALID_SEAL/
  );
  assert.match(
    webGpuRadixGpuCountPrepareWgsl,
    /STATUS_FAIL_CLOSED \| STATUS_COUNT_OVERFLOW/
  );
  assert.match(
    webGpuRadixGpuCountPrepareWgsl,
    /gpu_count_control\[offset\] = 0u;[\s\S]*offset \+ 2u\] = 0u/
  );
  assert.match(
    webGpuRadixGpuCountPrepareWgsl,
    /prepare_scan\([\s\S]*histogram_scan_level_count[\s\S]*prepare_scan\(/
  );
  assert.match(
    webGpuRadixGpuCountScanWgsl,
    /fn sealed_count\(\)[\s\S]*CONTROL_COMPLETION_SEAL/
  );
  assert.match(
    webGpuRadixGpuCountScanWgsl,
    /first < count[\s\S]*second < count/
  );
  assert.match(
    webGpuRadixGpuCountWgsl,
    /fn sealed_count\(\)[\s\S]*min\([\s\S]*CONTROL_LIVE_COUNT/
  );
  assert.match(
    webGpuRadixGpuCountWgsl,
    /linear_group < gpu_count_control\[CONTROL_RADIX_GROUP_COUNT\][\s\S]*index < count/
  );
  assert.match(
    webGpuRadixGpuCountUniqueWgsl,
    /authority_count == gpu_count_control\[CONTROL_LIVE_COUNT\]/
  );
  assert.match(
    webGpuRadixGpuCountUniqueWgsl,
    /preflight_admitted && !authority_stable[\s\S]*STATUS_FAIL_CLOSED/
  );
});

test('sealed GPU-authored count encodes one fixed maximum indirect topology without a count write', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const authorityBuffer = device.createBuffer({
    label: 'active-source-authority',
    size: 256,
    usage: 128
  });
  const keyBuffer = device.createBuffer({
    label: 'gpu-count-keys',
    size: 1024 * 2 * 4,
    usage: 128
  });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 1024,
    maxKeyWordCount: 2,
    label: 'sealed-radix'
  });
  assert.equal(runtime.pipelineCount, 12);
  assert.equal(runtime.gpuCountPipelineCount, 0);
  assert.equal(runtime.totalPipelineCount, 12);
  assert.throws(
    () => runtime.encodeSortUniqueGpuCount(createFakeEncoder(), {
      keyBuffer,
      authorityBuffer,
      generationSeal: 77,
      maxElementCount: 700,
      keyWordCount: 2,
      keyStrideWords: 2
    }),
    (error) => error?.code === 'ERR_WEBGPU_RADIX_GPU_COUNT_NOT_PREPARED'
  );
  const bufferCountBeforePrewarm = device.buffers.length;
  const prepared = runtime.prepareGpuCountResources();
  assert.equal(prepared.status, 'webgpu-radix-gpu-count-resources-prepared');
  assert.equal(prepared.configSlotCount, 1);
  assert.equal(prepared.executionConcurrency, 'single-flight-per-runtime');
  assert.equal(runtime.gpuCountPipelineCount, 10);
  assert.equal(runtime.totalPipelineCount, 22);
  assert.ok(device.buffers.length > bufferCountBeforePrewarm);
  const bufferCountAfterPrewarm = device.buffers.length;
  assert.equal(
    runtime.prepareGpuCountResources().controlBuffer,
    prepared.controlBuffer
  );
  assert.equal(device.buffers.length, bufferCountAfterPrewarm);
  const bufferCountBeforeEncode = device.buffers.length;
  const timestampBegins = [];
  const timestampEnds = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(timestampEncoder, descriptor) {
      const token = { timestampEncoder, descriptor };
      timestampBegins.push(token);
      return token;
    },
    endEncoderSpan(timestampEncoder, token) {
      timestampEnds.push({ timestampEncoder, token });
    }
  };
  const result = runtime.encodeSortUniqueGpuCount(encoder, {
    keyBuffer,
    authorityBuffer,
    authorityCountByteOffset: 8,
    generationSeal: { byteOffset: 40, expected: 77 },
    maxElementCount: 700,
    keyWordCount: 2,
    keyStrideWords: 2,
    generationId: 19,
    consumerWorkgroupSize: 64,
    gpuTimestampRecorder,
    timestampProducerId: 'test-gpu-count-radix',
    timestampMetadata: { parentProducerId: 'test-parent' }
  });

  assert.equal(runtime.pipelineCount, 12);
  assert.equal(device.buffers.length, bufferCountBeforeEncode);
  assert.equal(result.status,
    'webgpu-stable-radix-sort-unique-gpu-count-encoded');
  assert.equal(result.elementCount, null);
  assert.equal(result.elementCountSource, 'authenticated-gpu-authority');
  assert.equal(result.readbackPerformed, false);
  assert.equal(result.fixedMaximumTopology, true);
  assert.equal(result.radixPassCount, 16);
  assert.equal(result.encodedIndirectDispatchCount, 53);
  assert.equal(result.encodedDispatchCount, 55);
  assert.equal(result.encodedComputePassCount, 2);
  assert.equal(result.histogramScanFusedTopAddEnabled, false);
  assert.equal(result.headScanFusedTopAddEnabled, true);
  assert.equal(result.histogramScanEncodedDispatchCount, 1);
  assert.equal(result.headScanEncodedDispatchCount, 2);
  assert.equal(result.authorityCountByteOffset, 8);
  assert.equal(result.authoritySealByteOffset, 40);
  assert.equal(result.generationSeal, 77);
  assert.equal(result.gpuCountControlLayout.controlWordCount, 56);
  assert.equal(result.gpuCountControlBuffer.usage & 256, 256);
  assert.equal(result.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(result.bindGroupCreationCount, 37);
  assert.equal(result.bindGroupReuseCount, 0);
  assert.equal(result.paramsBufferCreationCount, 0);
  assert.equal(result.paramsSlotIndex, 0);
  assert.equal(result.paramsBufferResidency,
    'retained-gpu-count-config-arena');
  assert.equal(result.timestampProducerId, 'test-gpu-count-radix');
  assert.deepEqual(result.transientBuffers, []);
  assert.deepEqual(
    timestampBegins.map(({ timestampEncoder, descriptor }) => ({
      sameEncoder: timestampEncoder === encoder,
      ...descriptor
    })),
    [{
      sameEncoder: true,
      producerId: 'test-gpu-count-radix',
      stage: 'gpu-count-radix-sort-unique',
      spanClass: 'same-grouped-production-compute-pass',
      parentProducerId: 'test-parent',
      elementCount: null,
      elementCountSource: 'authenticated-gpu-authority',
      maxElementCount: 700,
      keyWordCount: 2
    }]
  );
  assert.equal(timestampEnds.length, 1);
  assert.equal(timestampEnds[0].timestampEncoder, encoder);
  assert.equal(timestampEnds[0].token, timestampBegins[0]);

  const passes = computePasses(encoder);
  const commands = computeCommands(encoder);
  assert.deepEqual(
    passes.map(({ descriptor }) => descriptor.label),
    ['sealed-radixGpuCountPrepare', 'sealed-radixGroupedGpuCountRadixUnique']
  );
  assert.equal(commands.length, 55);
  assert.deepEqual(commands[0].dispatch, [1, 1, 1]);
  assert.equal(commands[0].pipeline, 'sealed-radix-gpu-count-prepare');
  assert.equal(commands.at(-1).pipeline,
    'sealed-radix-gpu-count-finalize-unique');
  assert.deepEqual(commands.at(-1).dispatch, [1, 1, 1]);
  assert.equal(
    commands.slice(1, -1).every(({ dispatchIndirect }) => (
      dispatchIndirect?.label === 'sealed-radix-gpu-count-control'
      && dispatchIndirect.byteOffset % 12 === 8
    )),
    true
  );
  assert.equal(
    commands.filter(({ pipeline }) => (
      pipeline === 'sealed-radix-gpu-count-scan-blocks'
    )).length,
    17
  );
  assert.equal(
    commands.filter(({ pipeline }) => (
      pipeline === 'sealed-radix-gpu-count-scan-add'
    )).length,
    0
  );
  assert.equal(
    commands.filter(({ pipeline }) => (
      pipeline === 'sealed-radix-gpu-count-scan-fused-top-add'
    )).length,
    1
  );
  assert.deepEqual(
    commands.filter(({ pipeline }) => (
      pipeline === 'sealed-radix-gpu-count-scan-fused-top-add'
    )).map(({ dispatchIndirect }) => dispatchIndirect.byteOffset),
    [200]
  );
  assert.equal(
    encoder.events.filter(({ kind }) => kind === 'clear').length,
    4
  );

  const configWrite = device.writes.find(
    ({ buffer, offset }) => (
      buffer.label === 'sealed-radix-gpu-count-config-retained-arena'
      && offset === 0
    )
  );
  assert.deepEqual(configWrite.words.slice(0, 19), [
    2, 10, 77, 700, 2, 2, 64, 19, 65535,
    32, 33, 35, 38, 44, 1, 2, 7, 56, 1024
  ]);
  assert.equal(
    device.writes.some(({ buffer, words }) => (
      buffer.label === 'sealed-radix-gpu-count-config-retained-arena'
      && words.includes(0xdead_beef)
    )),
    false
  );

  const configArena = runtime.allocationEntries().find(
    ({ role }) => role === 'radix-gpu-count-config-retained-arena'
  ).buffer;
  assert.equal(configArena.destroyed, false);
  runtime.releaseExecution(result, { discardedEncoder: true });
  assert.equal(configArena.destroyed, false);
  assert.equal(result.gpuCountControlBuffer.destroyed, false);
  runtime.destroy();
  assert.equal(configArena.destroyed, true);
  assert.equal(result.gpuCountControlBuffer.destroyed, true);
});

test('GPU-count radix skips producer-proven uniform digits in stable LSD order', () => {
  const device = createFakeDevice();
  const authorityBuffer = device.createBuffer({
    label: 'significant-digit-authority',
    size: 256,
    usage: 128
  });
  const keyBuffer = device.createBuffer({
    label: 'significant-digit-keys',
    size: 1024 * 2 * 4,
    usage: 128
  });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 1024,
    maxKeyWordCount: 2,
    label: 'significant-digit-radix'
  });
  runtime.prepareGpuCountResources();
  const encode = (significantDigitRows) => runtime.encodeSortUniqueGpuCount(
    createFakeEncoder(),
    {
      keyBuffer,
      authorityBuffer,
      generationSeal: 17,
      maxElementCount: 1024,
      keyWordCount: 2,
      keyStrideWords: 2,
      significantDigitRows
    }
  );
  const result = encode([0, 1, 8]);
  assert.equal(result.radixPassCount, 3);
  assert.deepEqual(result.significantDigitRows, [0, 1, 8]);
  assert.equal(result.encodedIndirectDispatchCount, 14);
  assert.equal(result.encodedDispatchCount, 16);
  runtime.releaseExecution(result, { discardedEncoder: true });
  assert.throws(() => encode([]), /retain at least one digit/);
  assert.throws(() => encode([1, 0]), /strictly increasing/);
  runtime.destroy();
});

test('GPU-count mechanics-field radix fuses each bounded parallel histogram top', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const authorityBuffer = device.createBuffer({
    label: 'mechanics-field-active-source-authority',
    size: 256,
    usage: 128
  });
  const keyBuffer = device.createBuffer({
    label: 'mechanics-field-candidate-keys',
    size: 221_184 * 3 * 4,
    usage: 128
  });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    // The retained arena follows the 8,192-row capacity tier (8,192 * 27).
    maxElementCount: 221_184,
    maxKeyWordCount: 3,
    label: 'mechanics-field-radix'
  });
  runtime.prepareGpuCountResources();

  const result = runtime.encodeSortUniqueGpuCount(encoder, {
    keyBuffer,
    authorityBuffer,
    generationSeal: 91,
    // The exact generation contains 4,608 physical rows (4,608 * 27).
    maxElementCount: 124_416,
    keyWordCount: 3,
    keyStrideWords: 3,
    generationId: 91
  });

  assert.equal(result.radixPassCount, 24);
  assert.equal(
    result.histogramScanMode,
    'gpu-count-fixed-hierarchical-fused-top'
  );
  assert.equal(result.histogramScanFusedTopAddEnabled, true);
  assert.equal(result.headScanFusedTopAddEnabled, false);
  assert.equal(result.histogramScanEncodedDispatchCount, 2);
  assert.equal(result.headScanEncodedDispatchCount, 3);
  assert.equal(result.encodedIndirectDispatchCount, 102);
  assert.equal(result.encodedDispatchCount, 104);

  const commands = computeCommands(encoder);
  assert.equal(commands.length, 104);
  assert.equal(
    commands.filter(({ pipeline }) => (
      pipeline === 'mechanics-field-radix-gpu-count-scan-fused-top-add'
    )).length,
    24
  );
  assert.deepEqual(
    commands.filter(({ pipeline }) => (
      pipeline === 'mechanics-field-radix-gpu-count-scan-fused-top-add'
    )).map(({ dispatchIndirect }) => dispatchIndirect.byteOffset),
    Array.from({ length: 24 }, () => 180)
  );
  assert.equal(
    commands.filter(({ pipeline }) => (
      pipeline === 'mechanics-field-radix-gpu-count-scan-add'
    )).length,
    1
  );
  assert.equal(
    commands.slice(1, -1).every(({ dispatchIndirect }) => (
      dispatchIndirect?.label
        === 'mechanics-field-radix-gpu-count-control'
    )),
    true
  );

  runtime.releaseExecution(result, { discardedEncoder: true });
  runtime.destroy();
});

test('GPU-authored count API rejects ambiguous or unsafe host-side capacity contracts', () => {
  const device = createFakeDevice();
  const authorityBuffer = device.createBuffer({
    label: 'contract-authority',
    size: 64,
    usage: 128
  });
  const keyBuffer = device.createBuffer({
    label: 'contract-keys',
    size: 64 * 4,
    usage: 128
  });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 64,
    maxKeyWordCount: 1,
    label: 'contract-radix'
  });
  const base = {
    keyBuffer,
    authorityBuffer,
    generationSeal: 9,
    maxElementCount: 64,
    keyWordCount: 1
  };
  const bufferCountBeforeRejectedEncodes = device.buffers.length;

  assert.throws(
    () => runtime.encodeSortUniqueGpuCount(createFakeEncoder(), {
      ...base,
      generationSeal: 0
    }),
    /generationSeal/
  );
  assert.throws(
    () => runtime.encodeSortUniqueGpuCount(createFakeEncoder(), {
      ...base,
      authorityCountByteOffset: 2
    }),
    /u32 aligned/
  );
  assert.throws(
    () => runtime.encodeSortUniqueGpuCount(createFakeEncoder(), {
      ...base,
      authoritySealByteOffset: 0
    }),
    /distinct u32 words/
  );
  assert.throws(
    () => runtime.encodeSortUniqueGpuCount(createFakeEncoder(), {
      ...base,
      maxElementCount: 65
    }),
    /maxElementCount/
  );
  assert.throws(
    () => runtime.encodeSortUniqueGpuCount(createFakeEncoder(), {
      ...base,
      keyStrideWords: 2
    }),
    /keyBuffer must cover/
  );
  assert.equal(device.buffers.length, bufferCountBeforeRejectedEncodes);
  runtime.destroy();
});

test('GPU-count config lease keeps zero-count encodes allocation-free and rejects concurrent scratch aliasing', async () => {
  const device = createFakeDevice();
  const keyBuffer = device.createBuffer({
    label: 'leased-gpu-count-keys',
    size: 64 * 2 * 4,
    usage: 128
  });
  const zeroCountAuthority = device.createBuffer({
    label: 'zero-count-authority-count-0-seal-41',
    size: 16,
    usage: 128
  });
  const liveCountAuthority = device.createBuffer({
    label: 'live-count-authority',
    size: 16,
    usage: 128
  });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 64,
    maxKeyWordCount: 2,
    label: 'leased-gpu-count'
  });
  const prepared = runtime.prepareGpuCountResources();
  assert.equal(prepared.configSlotCount, 1);
  const bufferCountAfterRuntimeCreation = device.buffers.length;
  const encode = (authorityBuffer, generationSeal) => (
    runtime.encodeSortUniqueGpuCount(createFakeEncoder(), {
      keyBuffer,
      authorityBuffer,
      generationSeal,
      maxElementCount: 64,
      keyWordCount: 2,
      keyStrideWords: 2
    })
  );

  const zero = encode(zeroCountAuthority, 41);
  assert.equal(device.buffers.length, bufferCountAfterRuntimeCreation);
  assert.equal(zero.paramsSlotIndex, 0);
  assert.equal(zero.elementCount, null);
  assert.equal(zero.elementCountSource, 'authenticated-gpu-authority');
  assert.equal(zero.encodedDispatchCount, 54);
  assert.equal(zero.encodedIndirectDispatchCount, 52);
  assert.equal(zero.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(zero.bindGroupCreationCount, 37);
  assert.equal(zero.bindGroupReuseCount, 0);
  assert.throws(
    () => encode(liveCountAuthority, 42),
    (error) => (
      error?.code === 'ERR_WEBGPU_RADIX_GPU_COUNT_EXECUTION_IN_FLIGHT'
      && error.slotCapacity === 1
    )
  );
  assert.equal(device.buffers.length, bufferCountAfterRuntimeCreation);
  assert.throws(
    () => runtime.releaseExecution(zero),
    /discarded encoder.*releaseExecutionAfter/
  );
  await assert.rejects(
    runtime.releaseExecutionAfter(zero, null),
    /submission-fence thenable/
  );

  assert.equal(await runtime.releaseExecutionAfter(zero, Promise.resolve()), true);
  assert.equal(await runtime.releaseExecutionAfter(zero, Promise.resolve()), false);
  const repeated = encode(zeroCountAuthority, 42);
  assert.equal(repeated.paramsSlotIndex, 0);
  assert.equal(repeated.bindGroupCreationCount, 0);
  assert.equal(repeated.bindGroupReuseCount, 37);
  runtime.releaseExecution(repeated, { discardedEncoder: true });

  const live = encode(liveCountAuthority, 43);
  assert.equal(live.paramsSlotIndex, 0);
  assert.equal(live.bindGroupCreationCount, 2);
  assert.equal(live.bindGroupReuseCount, 35);
  assert.equal(device.buffers.length, bufferCountAfterRuntimeCreation);
  runtime.releaseExecution(live, { discardedEncoder: true });

  const alternateKeyBuffer = device.createBuffer({
    label: 'leased-gpu-count-alternate-keys',
    size: 64 * 2 * 4,
    usage: 128
  });
  const changedKey = runtime.encodeSortUniqueGpuCount(createFakeEncoder(), {
    keyBuffer: alternateKeyBuffer,
    authorityBuffer: liveCountAuthority,
    generationSeal: 44,
    maxElementCount: 64,
    keyWordCount: 2,
    keyStrideWords: 2
  });
  assert.equal(changedKey.paramsSlotIndex, 0);
  assert.equal(changedKey.bindGroupCreationCount, 34);
  assert.equal(changedKey.bindGroupReuseCount, 3);
  runtime.releaseExecution(changedKey, { discardedEncoder: true });

  const narrowerKey = runtime.encodeSortUniqueGpuCount(createFakeEncoder(), {
    keyBuffer: alternateKeyBuffer,
    authorityBuffer: liveCountAuthority,
    generationSeal: 45,
    maxElementCount: 64,
    keyWordCount: 1,
    keyStrideWords: 2
  });
  assert.equal(narrowerKey.bindGroupCreationCount, 0);
  assert.equal(narrowerKey.bindGroupReuseCount, 21);
  runtime.releaseExecution(narrowerKey, { discardedEncoder: true });
  runtime.destroy();
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
  runtime.releaseExecution(result, { discardedEncoder: true });
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

test('coarse timestamp recorder preserves grouped radix and unique production passes', () => {
  const device = createFakeDevice();
  const keyBuffer = device.createBuffer({
    label: 'coarse-profiled-keys', size: 4096, usage: 128
  });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 1024,
    maxKeyWordCount: 1,
    label: 'coarse-profiled-radix'
  });
  const encoder = createFakeEncoder();
  const spans = [];
  let queryIndex = 0;
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(targetEncoder, descriptor) {
      const token = { descriptor, startQueryIndex: queryIndex++ };
      targetEncoder.writeTimestamp({}, token.startQueryIndex);
      spans.push(token);
      return token;
    },
    endEncoderSpan(targetEncoder, token) {
      token.endQueryIndex = queryIndex++;
      targetEncoder.writeTimestamp({}, token.endQueryIndex);
    }
  };

  runtime.encodeSortUnique(encoder, {
    keyBuffer,
    elementCount: 1000,
    keyWordCount: 1,
    keyStrideWords: 1,
    generationId: 17,
    gpuTimestampRecorder,
    sortTimestampProducerId: 'test-coarse-radix-sort',
    uniqueTimestampProducerId: 'test-coarse-radix-unique',
    timestampMetadata: { taskId: 'coarse-production-shape' }
  });

  assert.equal(computePasses(encoder).length, 2);
  assert.deepEqual(
    computePasses(encoder).map((pass) => pass.descriptor.label),
    ['coarse-profiled-radixGroupedRadixSort', 'coarse-profiled-radixGroupedUnique']
  );
  assert.equal(spans.length, 2);
  assert.deepEqual(
    spans.map((span) => span.descriptor.producerId),
    ['test-coarse-radix-sort', 'test-coarse-radix-unique']
  );
  assert.deepEqual(spans.map((span) => span.descriptor.stage), ['sort', 'unique']);
  assert.equal(spans.every((span) => (
    span.descriptor.taskId === 'coarse-production-shape'
    && Number.isInteger(span.startQueryIndex)
    && Number.isInteger(span.endQueryIndex)
  )), true);
  assert.equal(
    encoder.events.filter((event) => event.kind === 'timestamp').length,
    4
  );
  runtime.destroy();
});

test('general scan and radix shaders remain parallel while the bounded serial kernel is isolated', () => {
  assert.match(webGpuU32ExclusiveScanWgsl, /@workgroup_size\(256\)[\s\S]*fn scan_blocks/);
  assert.match(webGpuU32ExclusiveScanWgsl, /var<workgroup> scan_values: array<u32, 512>/);
  assert.match(webGpuU32ExclusiveScanWgsl, /group_valid = linear_group < scan_group_count/);
  assert.match(webGpuU32ExclusiveScanWgsl, /fn scan_top_and_add_lower/);
  assert.match(webGpuU32ExclusiveScanWgsl, /lower_index = lower_index \+ 256u/);
  assert.match(webGpuStableRadixWgsl, /var<workgroup> digit_prefix: array<vec4<u32>, 1024>/);
  assert.equal(WEBGPU_RADIX_SCATTER_WORKGROUP_STORAGE_BYTES, 16 * 1024);
  assert.match(webGpuStableRadixWgsl, /linear_group < radix_params\.workgroup_count/);
  assert.match(webGpuStableRadixWgsl, /for \(var offset = 1u; offset < 256u;/);
  assert.doesNotMatch(webGpuStableRadixWgsl, /@workgroup_size\(1\)[\s\S]*prefix/i);
  assert.match(
    webGpuSerialRadixHistogramScanWgsl,
    /@compute @workgroup_size\(1\)[\s\S]*fn scan_histogram_serial/
  );
  assert.match(
    webGpuSerialRadixHistogramScanWgsl,
    /radix_histogram_offsets\[index\] = running;[\s\S]*running = running \+ radix_histograms\[index\]/
  );
  assert.match(webGpuSortedUniqueWgsl, /fn mark_heads/);
  assert.match(webGpuSortedUniqueWgsl, /fn scatter_unique/);
  assert.match(webGpuSortedUniqueWgsl, /unique_output_offsets\[unique_count\]/);
});

test('opt-in bounded serial histogram scan removes one dispatch per measured mechanics radix digit', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const keyBuffer = device.createBuffer({
    label: 'serial-mechanics-keys',
    size: 124_416 * 3 * 4,
    usage: 128
  });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 124_416,
    maxKeyWordCount: 3,
    label: 'serial-mechanics-radix',
    retainConstantScanParamsBuffers: true,
    retainVariableScanParamsBuffers: true,
    serialHistogramScanMaxElementCount: 8_192,
    retainedParamsSlotCount: 1
  });
  const result = runtime.encodeSortUnique(encoder, {
    keyBuffer,
    elementCount: 124_416,
    keyWordCount: 3,
    keyStrideWords: 3,
    generationId: 19
  });
  const commands = computeCommands(encoder);

  assert.equal(result.histogramElementCount, 7_776);
  assert.equal(result.radixPassCount, 24);
  assert.equal(result.histogramScanMode, 'serial-small');
  assert.equal(result.encodedDispatchCount, 79);
  assert.equal(commands.length, 79);
  assert.equal(
    commands.filter((command) => (
      command.pipeline === 'serial-mechanics-radix-serial-histogram-scan'
    )).length,
    24
  );
  assert.equal(
    commands.some((command) => command.pipeline.includes('-histogram-scan-blocks')),
    false
  );
  assert.equal(result.paramsWriteCount, 3);
  assert.equal(runtime.pipelineCount, 13);
  assert.equal(runtime.serialHistogramScanMaxElementCount, 8_192);

  runtime.releaseExecution(result, { discardedEncoder: true });
  runtime.destroy();
});

test('bounded serial histogram scan keeps tiny and over-threshold sorts on the parallel path', () => {
  const device = createFakeDevice();
  const keyBuffer = device.createBuffer({ label: 'serial-boundary-keys', size: 9000 * 4, usage: 128 });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 9000,
    maxKeyWordCount: 1,
    label: 'serial-boundary-radix',
    serialHistogramScanMaxElementCount: 527
  });
  const tiny = runtime.encodeSort(createFakeEncoder(), {
    keyBuffer,
    elementCount: 8192,
    keyWordCount: 1,
    generationId: 1
  });
  assert.equal(tiny.histogramElementCount, 512);
  assert.equal(tiny.histogramScanMode, 'parallel-scan');
  runtime.releaseExecution(tiny, { discardedEncoder: true });

  const aboveThreshold = runtime.encodeSort(createFakeEncoder(), {
    keyBuffer,
    elementCount: 8193,
    keyWordCount: 1,
    generationId: 2
  });
  assert.equal(aboveThreshold.histogramElementCount, 528);
  assert.equal(aboveThreshold.histogramScanMode, 'parallel-scan');
  runtime.releaseExecution(aboveThreshold, { discardedEncoder: true });
  runtime.destroy();
});

test('bounded serial histogram scan preserves timestamp attribution and indirect gating', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const keyBuffer = device.createBuffer({ label: 'serial-gated-keys', size: 9000 * 4, usage: 128 });
  const gateBuffer = device.createBuffer({ label: 'serial-gated-dispatches', size: 4096, usage: 384 });
  const shapeOffsets = new Map();
  const provider = {
    buffer: gateBuffer,
    byteOffsetFor(dispatch, shapeId) {
      assert.equal(shapeId, webGpuDispatchShapeId(dispatch));
      if (!shapeOffsets.has(shapeId)) shapeOffsets.set(shapeId, shapeOffsets.size * 12);
      return shapeOffsets.get(shapeId);
    }
  };
  const spans = [];
  const timestampProfiler = {
    active: true,
    beginComputePassDescriptor(label, metadata) {
      spans.push({ label, metadata });
      return { label, metadata, timestampWrites: { querySet: {} } };
    }
  };
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 9000,
    maxKeyWordCount: 1,
    label: 'serial-gated-radix',
    serialHistogramScanMaxElementCount: 8_192
  });
  const result = runtime.encodeSortUnique(encoder, {
    keyBuffer,
    elementCount: 8193,
    keyWordCount: 1,
    generationId: 23,
    timestampProfiler,
    timestampMetadata: { taskId: 'serial-gated-test' },
    dispatchIndirectProvider: provider
  });
  const commands = computeCommands(encoder);

  assert.equal(result.histogramScanMode, 'serial-small');
  assert.equal(result.histogramElementCount, 528);
  assert.equal(computePasses(encoder).length, result.encodedComputePassCount);
  assert.equal(commands.length, result.encodedDispatchCount);
  assert.equal(commands.every(({ dispatch, dispatchIndirect }) => (
    dispatch === undefined
      && dispatchIndirect?.label === gateBuffer.label
      && dispatchIndirect.byteOffset % 12 === 0
  )), true);
  assert.equal(
    spans.filter(({ label }) => label === 'serial-gated-radixRadixHistogramSerialScan').length,
    8
  );
  assert.equal(spans.every(({ metadata }) => metadata.taskId === 'serial-gated-test'), true);
  assert.ok(shapeOffsets.has(webGpuDispatchShapeId([1, 1, 1])));
  assert.ok(shapeOffsets.has(webGpuDispatchShapeId([33, 1, 1])));

  runtime.releaseExecution(result, { discardedEncoder: true });
  runtime.destroy();
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
  assert.equal(result.paramsWriteCount, 4);
  assert.equal(result.clearedWordCount, WEBGPU_RADIX_UNIQUE_CLEARED_WORD_COUNT);
  assert.equal(WEBGPU_RADIX_UNIQUE_CLEARED_WORD_COUNT, 12);
  assert.equal(result.readbackPerformed, false);
  assert.equal(result.generationId, 9);
  assert.equal(result.uniqueHeadFlagsBuffer.label, 'test-radix-head-flags');
  assert.equal(
    result.uniqueGroupIndexBySortedPositionBuffer.label,
    'test-radix-head-offsets'
  );
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

  runtime.releaseExecution(result, { discardedEncoder: true });
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

  runtime.releaseExecution(result, { discardedEncoder: true });
  runtime.destroy();
});

test('fixed-count radix scans retain immutable scan params across encodings', () => {
  const device = createFakeDevice();
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
  const first = runtime.encodeSortUnique(createFakeEncoder(), {
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
  const second = runtime.encodeSortUnique(createFakeEncoder(), {
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
  assert.equal(first.paramsWriteCount, 4);
  assert.equal(second.paramsWriteCount, 2);
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
    () => runtime.encodeSortUnique(createFakeEncoder(), {
      keyBuffer,
      elementCount: 1024,
      keyWordCount: 5,
      keyStrideWords: 5,
      generationId: 3
    }),
    (error) => error?.code === 'ERR_WEBGPU_RADIX_PARAMS_ARENA_EXHAUSTED'
      && error.slotCapacity === 2
  );

  runtime.releaseExecution(first, { discardedEncoder: true });
  const bindGroupsBeforeThird = device.bindGroups.length;
  const third = runtime.encodeSortUnique(createFakeEncoder(), {
    keyBuffer,
    elementCount: 1024,
    keyWordCount: 5,
    keyStrideWords: 5,
    generationId: 3
  });
  assert.equal(third.paramsSlotIndex, 0);
  assert.equal(third.paramsWriteCount, 2);
  assert.equal(device.bindGroups.length - bindGroupsBeforeThird, 0);
  assert.equal(third.bindGroupCreationCount, 0);
  assert.ok(third.bindGroupReuseCount > 0);
  runtime.releaseExecution(third, { discardedEncoder: true });

  const alternateKeyBuffer = device.createBuffer({
    label: 'alternate-keys',
    size: 4096,
    usage: 128
  });
  const changedResource = runtime.encodeSortUnique(createFakeEncoder(), {
    keyBuffer: alternateKeyBuffer,
    elementCount: 1024,
    keyWordCount: 5,
    keyStrideWords: 5,
    generationId: 4
  });
  assert.equal(changedResource.paramsSlotIndex, 0);
  assert.ok(changedResource.bindGroupCreationCount > 0);
  assert.ok(changedResource.bindGroupReuseCount > 0);
  runtime.releaseExecution(changedResource, { discardedEncoder: true });
  assert.throws(
    () => runtime.encodeSortUnique(createFakeEncoder(), {
      keyBuffer,
      elementCount: 1000,
      keyWordCount: 5,
      keyStrideWords: 5,
      generationId: 5
    }),
    /fixed elementCount 1024/
  );

  runtime.releaseExecution(second, { discardedEncoder: true });
  runtime.destroy();
});

test('variable retained scan rejects same-slot reuse until discard or fence-proven release', async () => {
  const device = createFakeDevice();
  const discardedEncoder = createFakeEncoder();
  const inputBuffer = device.createBuffer({ label: 'leased-scan-input', size: 4096, usage: 128 });
  const outputBuffer = device.createBuffer({ label: 'leased-scan-output', size: 4096, usage: 128 });
  const scan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: 1024,
    label: 'leased-variable-scan',
    retainParamsBuffer: true,
    retainedParamsSlotCount: 2
  });

  const first = scan.encode(discardedEncoder, {
    inputBuffer,
    outputBuffer,
    elementCount: 1024
  });
  const writesAfterFirst = device.writes.length;
  const bindGroupsAfterFirst = device.bindGroups.length;
  assert.equal(first.retainedParamsSlotIndex, 0);
  assert.throws(
    () => scan.encode(discardedEncoder, { inputBuffer, outputBuffer, elementCount: 256 }),
    (error) => error?.code === 'ERR_WEBGPU_SCAN_PARAMS_SLOT_IN_USE'
      && error.slotIndex === 0
      && error.slotCapacity === 2
  );
  assert.equal(device.writes.length, writesAfterFirst);
  assert.equal(device.bindGroups.length, bindGroupsAfterFirst);

  const parallel = scan.encode(discardedEncoder, {
    inputBuffer,
    outputBuffer,
    elementCount: 256,
    retainedParamsSlotIndex: 1
  });
  assert.equal(parallel.retainedParamsSlotIndex, 1);
  assert.throws(() => scan.releasePrepared(first), /discardedEncoder.*releasePreparedAfter/);
  assert.equal(scan.releasePrepared(first, { discardedEncoder: true }), true);
  assert.equal(scan.releasePrepared(first, { discardedEncoder: true }), false);
  assert.equal(scan.releasePrepared(parallel, { discardedEncoder: true }), true);

  const submittedEncoder = createFakeEncoder();
  const reused = scan.encode(submittedEncoder, {
    inputBuffer,
    outputBuffer,
    elementCount: 256
  });
  assert.equal(reused.retainedParamsSlotIndex, 0);
  assert.throws(
    () => scan.releasePreparedAfter(reused, null),
    /submissionFence must be a thenable/
  );
  assert.equal(await scan.releasePreparedAfter(reused, Promise.resolve()), true);
  const afterFence = scan.encode(createFakeEncoder(), {
    inputBuffer,
    outputBuffer,
    elementCount: 128
  });

  scan.releasePrepared(afterFence, { discardedEncoder: true });
  scan.destroy();
});

test('fixed-count retained scan authenticates queue-ordered release without a variable params lease', () => {
  const device = createFakeDevice();
  const inputBuffer = device.createBuffer({
    label: 'fixed-queue-scan-input',
    size: 4096,
    usage: 128
  });
  const outputBuffer = device.createBuffer({
    label: 'fixed-queue-scan-output',
    size: 4096,
    usage: 128
  });
  const scan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: 1024,
    fixedElementCount: 1024,
    label: 'fixed-queue-scan',
    retainParamsBuffer: true
  });
  const prepared = scan.encode(createFakeEncoder(), {
    inputBuffer,
    outputBuffer,
    elementCount: 1024
  });
  const forged = { ...prepared };

  assert.equal(scan.canReleasePreparedQueueOrdered(forged), false);
  assert.equal(scan.releasePreparedQueueOrdered(forged), false);
  assert.equal(scan.canReleasePreparedQueueOrdered(prepared), true);
  assert.equal(scan.releasePreparedQueueOrdered(prepared), true);
  assert.equal(scan.canReleasePreparedQueueOrdered(prepared), false);
  assert.equal(scan.releasePreparedQueueOrdered(prepared), false);
  scan.destroy();
});

test('transient scan refuses queue-ordered release and discard destroys its params buffer', () => {
  const device = createFakeDevice();
  const inputBuffer = device.createBuffer({
    label: 'transient-queue-scan-input',
    size: 4096,
    usage: 128
  });
  const outputBuffer = device.createBuffer({
    label: 'transient-queue-scan-output',
    size: 4096,
    usage: 128
  });
  const scan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: 1024,
    label: 'transient-queue-scan'
  });
  const prepared = scan.encode(createFakeEncoder(), {
    inputBuffer,
    outputBuffer,
    elementCount: 1024
  });
  assert.equal(prepared.transientBuffers.length, 1);
  assert.equal(scan.canReleasePreparedQueueOrdered(prepared), false);
  assert.equal(scan.releasePreparedQueueOrdered(prepared), false);
  assert.equal(prepared.transientBuffers[0].destroyed, false);
  assert.equal(scan.releasePrepared(
    prepared,
    { discardedEncoder: true }
  ), true);
  assert.equal(prepared.transientBuffers[0].destroyed, true);
  scan.destroy();
});

test('transient scan release rejects forged targets and ignores authentic public-array poisoning', () => {
  const device = createFakeDevice();
  const scan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: 1024,
    label: 'authenticated-transient-scan-release'
  });
  const prepare = (suffix) => scan.prepare({
    inputBuffer: { label: `authenticated-input-${suffix}` },
    outputBuffer: { label: `authenticated-output-${suffix}` },
    elementCount: 1024
  });
  const first = prepare('first');
  const second = prepare('second');
  const third = prepare('third');
  const firstBuffer = first.transientBuffers[0];
  const secondBuffer = second.transientBuffers[0];
  const thirdBuffer = third.transientBuffers[0];

  assert.equal(scan.releaseTransientBuffers({
    transientBuffers: [secondBuffer]
  }, { discardedEncoder: true }), false);
  assert.equal(secondBuffer.destroyed, false);

  first.transientBuffers = [secondBuffer];
  assert.equal(scan.releasePrepared(first, { discardedEncoder: true }), true);
  assert.equal(firstBuffer.destroyed, true);
  assert.equal(secondBuffer.destroyed, false);

  second.transientBuffers.push(thirdBuffer);
  assert.equal(scan.releaseTransientBuffers(
    second,
    { discardedEncoder: true }
  ), true);
  assert.equal(secondBuffer.destroyed, true);
  assert.equal(thirdBuffer.destroyed, false);
  assert.equal(scan.releasePrepared(third, { discardedEncoder: true }), true);
  assert.equal(thirdBuffer.destroyed, true);
  assert.deepEqual(
    [firstBuffer, secondBuffer, thirdBuffer].map(
      ({ destroyCallCount }) => destroyCallCount
    ),
    [1, 1, 1]
  );
  scan.destroy();
});

test('transient scan releaseAfter snapshots private ownership before its await', async () => {
  const device = createFakeDevice();
  const scan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: 1024,
    label: 'authenticated-transient-scan-release-after'
  });
  const prepare = (suffix) => scan.prepare({
    inputBuffer: { label: `release-after-input-${suffix}` },
    outputBuffer: { label: `release-after-output-${suffix}` },
    elementCount: 1024
  });
  const first = prepare('first');
  const second = prepare('second');
  const firstBuffer = first.transientBuffers[0];
  const secondBuffer = second.transientBuffers[0];
  let resolveFence;
  const fence = new Promise((resolve) => { resolveFence = resolve; });
  const releasePromise = scan.releasePreparedAfter(first, fence);
  let publicArrayReadCount = 0;
  Object.defineProperty(first, 'transientBuffers', {
    configurable: true,
    get() {
      publicArrayReadCount += 1;
      return [secondBuffer];
    }
  });
  resolveFence();

  assert.equal(await releasePromise, true);
  assert.equal(publicArrayReadCount, 0);
  assert.equal(firstBuffer.destroyed, true);
  assert.equal(secondBuffer.destroyed, false);
  assert.equal(scan.releasePrepared(second, { discardedEncoder: true }), true);
  assert.equal(secondBuffer.destroyCallCount, 1);
  scan.destroy();
});

test('transient scan releaseAfter rejects a truthy non-callable fence without releasing', async () => {
  const device = createFakeDevice();
  const scan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: 1024,
    label: 'authenticated-transient-scan-exact-fence'
  });
  const prepared = scan.prepare({
    inputBuffer: { label: 'exact-fence-input' },
    outputBuffer: { label: 'exact-fence-output' },
    elementCount: 1024
  });
  const [paramsBuffer] = prepared.transientBuffers;

  assert.throws(
    () => scan.releasePreparedAfter(prepared, { then: 1 }),
    /submissionFence must be a thenable/
  );
  assert.equal(paramsBuffer.destroyed, false);
  assert.equal(scan.releasePrepared(
    prepared,
    { discardedEncoder: true }
  ), true);
  assert.equal(paramsBuffer.destroyCallCount, 1);
  scan.destroy();
});

test('variable-count retained scan bounds topology caching and reports params writes truthfully', () => {
  const device = createFakeDevice();
  const inputBuffer = device.createBuffer({ label: 'variable-scan-input', size: 4096, usage: 128 });
  const outputBuffer = device.createBuffer({ label: 'variable-scan-output', size: 4096, usage: 128 });
  const scan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: 1024,
    label: 'variable-retained-scan',
    retainParamsBuffer: true
  });
  const encode = (elementCount) => scan.encode(
    createFakeEncoder(),
    { inputBuffer, outputBuffer, elementCount }
  );
  const first = encode(1024);
  const writesAfterFirst = device.writes.filter(
    ({ buffer }) => buffer.label === 'variable-retained-scan-params-retained'
  ).length;
  scan.releasePrepared(first, { discardedEncoder: true });
  const second = encode(256);
  const writesAfterSecond = device.writes.filter(
    ({ buffer }) => buffer.label === 'variable-retained-scan-params-retained'
  ).length;
  const bindGroupsAfterSecond = device.bindGroups.length;
  scan.releasePrepared(second, { discardedEncoder: true });
  const third = encode(128);
  const writesAfterThird = device.writes.filter(
    ({ buffer }) => buffer.label === 'variable-retained-scan-params-retained'
  ).length;
  scan.releasePrepared(third, { discardedEncoder: true });
  const fourth = encode(128);
  const writesAfterFourth = device.writes.filter(
    ({ buffer }) => buffer.label === 'variable-retained-scan-params-retained'
  ).length;
  assert.equal(first.paramsWritePerformed, true);
  assert.equal(second.paramsWritePerformed, true);
  assert.equal(third.paramsWritePerformed, true);
  assert.equal(fourth.paramsWritePerformed, false);
  assert.deepEqual(
    [first, second, third, fourth].map(({ paramsWriteCount }) => paramsWriteCount),
    [1, 1, 1, 0]
  );
  assert.equal(writesAfterFirst, 1);
  assert.equal(writesAfterSecond, 2);
  assert.equal(writesAfterThird, 3);
  assert.equal(writesAfterFourth, 3);
  assert.equal(third.preparedScanCacheHit, true);
  assert.equal(fourth.preparedScanCacheHit, true);
  assert.equal(third.bindGroupCreationCount, 0);
  assert.equal(fourth.bindGroupCreationCount, 0);
  assert.equal(device.bindGroups.length, bindGroupsAfterSecond);
  assert.equal(first.transientBuffers.length, 0);
  assert.equal(second.transientBuffers.length, 0);
  scan.releasePrepared(fourth, { discardedEncoder: true });
  scan.destroy();
});

test('variable retained radix telemetry includes first, changed, and reused scan params writes', () => {
  const device = createFakeDevice();
  const keyBuffer = device.createBuffer({ label: 'variable-radix-keys', size: 4096, usage: 128 });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 1024,
    maxKeyWordCount: 1,
    label: 'variable-retained-radix',
    retainConstantScanParamsBuffers: true,
    retainVariableScanParamsBuffers: true,
    retainedParamsSlotCount: 1
  });

  const encode = (elementCount, generationId) => {
    const writesBefore = device.writes.length;
    const result = runtime.encodeSortUnique(createFakeEncoder(), {
      keyBuffer,
      elementCount,
      keyWordCount: 1,
      generationId
    });
    assert.equal(device.writes.length - writesBefore, result.paramsWriteCount);
    return result;
  };
  const first = encode(1024, 1);
  runtime.releaseExecution(first, { discardedEncoder: true });
  const changed = encode(256, 2);
  runtime.releaseExecution(changed, { discardedEncoder: true });
  const reused = encode(256, 3);

  assert.deepEqual(
    [first, changed, reused].map(({ paramsWriteCount }) => paramsWriteCount),
    [4, 4, 2]
  );
  assert.equal(
    [first, changed, reused].every(
      ({ clearedWordCount }) => clearedWordCount === WEBGPU_RADIX_UNIQUE_CLEARED_WORD_COUNT
    ),
    true
  );

  runtime.releaseExecution(reused, { discardedEncoder: true });
  runtime.destroy();
});

test('variable retained radix outer slots require discard or fence-proven release', async () => {
  const device = createFakeDevice();
  const keyBuffer = device.createBuffer({ label: 'concurrent-variable-keys', size: 4096, usage: 128 });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 1024,
    maxKeyWordCount: 1,
    label: 'concurrent-variable-radix',
    retainConstantScanParamsBuffers: true,
    retainVariableScanParamsBuffers: true,
    retainedParamsSlotCount: 2
  });
  const encode = (elementCount, generationId) => runtime.encodeSortUnique(createFakeEncoder(), {
    keyBuffer,
    elementCount,
    keyWordCount: 1,
    generationId
  });

  const first = encode(1024, 1);
  const second = encode(256, 2);
  assert.deepEqual([first.paramsSlotIndex, second.paramsSlotIndex], [0, 1]);
  assert.throws(
    () => encode(128, 3),
    (error) => error?.code === 'ERR_WEBGPU_RADIX_PARAMS_ARENA_EXHAUSTED'
      && error.slotCapacity === 2
  );

  assert.throws(() => runtime.releaseExecution(first), /discarded encoder.*releaseExecutionAfter/);
  await assert.rejects(runtime.releaseExecutionAfter(first, null), /submission-fence thenable/);
  assert.equal(await runtime.releaseExecutionAfter(first, Promise.resolve()), true);
  const replacement = encode(128, 3);
  assert.equal(replacement.paramsSlotIndex, 0);

  runtime.releaseExecution(second, { discardedEncoder: true });
  runtime.releaseExecution(replacement, { discardedEncoder: true });
  runtime.destroy();
});

test('radix runtimes reject foreign executions without releasing the owner lease', () => {
  const device = createFakeDevice();
  const keyBuffer = device.createBuffer({ label: 'foreign-release-keys', size: 256, usage: 128 });
  const createRuntime = (label) => createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 64,
    maxKeyWordCount: 1,
    label,
    retainConstantScanParamsBuffers: true,
    retainVariableScanParamsBuffers: true,
    retainedParamsSlotCount: 1
  });
  const owner = createRuntime('foreign-release-owner');
  const foreign = createRuntime('foreign-release-other');
  const execution = owner.encodeSortUnique(createFakeEncoder(), {
    keyBuffer,
    elementCount: 64,
    keyWordCount: 1,
    generationId: 1
  });

  assert.throws(
    () => foreign.releaseExecution(execution, { discardedEncoder: true }),
    (error) => error?.code === 'ERR_WEBGPU_RADIX_FOREIGN_EXECUTION'
  );
  assert.throws(
    () => owner.encodeSortUnique(createFakeEncoder(), {
      keyBuffer,
      elementCount: 32,
      keyWordCount: 1,
      generationId: 2
    }),
    (error) => error?.code === 'ERR_WEBGPU_RADIX_PARAMS_ARENA_EXHAUSTED'
  );
  assert.equal(owner.releaseExecution(execution, { discardedEncoder: true }), true);
  const replacement = owner.encodeSortUnique(createFakeEncoder(), {
    keyBuffer,
    elementCount: 32,
    keyWordCount: 1,
    generationId: 2
  });
  owner.releaseExecution(replacement, { discardedEncoder: true });
  owner.destroy();
  foreign.destroy();
});

test('radix release authenticates immutable per-execution transient ownership', () => {
  const device = createFakeDevice();
  const keyBuffer = device.createBuffer({
    label: 'authenticated-radix-release-keys',
    size: 256,
    usage: 128
  });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 64,
    maxKeyWordCount: 1,
    label: 'authenticated-radix-release'
  });
  const encode = (generationId) => runtime.encodeSortUnique(
    createFakeEncoder(),
    {
      keyBuffer,
      elementCount: 64,
      keyWordCount: 1,
      generationId
    }
  );
  const first = encode(1);
  const second = encode(2);
  const third = encode(3);
  const fourth = encode(4);
  const firstOwnedBuffers = [...first.transientBuffers];
  const secondOwnedBuffers = [...second.transientBuffers];
  const thirdOwnedBuffers = [...third.transientBuffers];
  const fourthOwnedBuffers = [...fourth.transientBuffers];

  assert.throws(
    () => runtime.releaseExecution({
      ...first,
      transientBuffers: [secondOwnedBuffers[0]]
    }, { discardedEncoder: true }),
    (error) => error?.code === 'ERR_WEBGPU_RADIX_FOREIGN_EXECUTION'
  );
  assert.equal(secondOwnedBuffers.every(({ destroyed }) => !destroyed), true);

  first.transientBuffers = [...secondOwnedBuffers];
  assert.equal(runtime.releaseExecution(
    first,
    { discardedEncoder: true }
  ), true);
  assert.equal(firstOwnedBuffers.every(({ destroyed }) => destroyed), true);
  assert.equal(secondOwnedBuffers.every(({ destroyed }) => !destroyed), true);

  second.transientBuffers.push(...thirdOwnedBuffers);
  assert.equal(runtime.releaseExecution(
    second,
    { discardedEncoder: true }
  ), true);
  assert.equal(secondOwnedBuffers.every(({ destroyed }) => destroyed), true);
  assert.equal(thirdOwnedBuffers.every(({ destroyed }) => !destroyed), true);
  third.transientBuffers = [...fourthOwnedBuffers];
  assert.equal(runtime.canReleaseExecutionQueueOrdered(third), true);
  assert.equal(runtime.releaseExecutionQueueOrdered(third), true);
  assert.equal(thirdOwnedBuffers.every(({ destroyed }) => destroyed), true);
  assert.equal(fourthOwnedBuffers.every(({ destroyed }) => !destroyed), true);
  assert.equal(runtime.releaseExecution(
    fourth,
    { discardedEncoder: true }
  ), true);
  assert.equal(fourthOwnedBuffers.every(({ destroyed }) => destroyed), true);
  assert.equal(
    [
      ...firstOwnedBuffers,
      ...secondOwnedBuffers,
      ...thirdOwnedBuffers,
      ...fourthOwnedBuffers
    ].every(({ destroyCallCount }) => destroyCallCount === 1),
    true
  );
  runtime.destroy();
  keyBuffer.destroy();
});

test('radix releaseExecutionAfter never reads public transient targets after await', async () => {
  const device = createFakeDevice();
  const keyBuffer = device.createBuffer({
    label: 'authenticated-radix-release-after-keys',
    size: 256,
    usage: 128
  });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 64,
    maxKeyWordCount: 1,
    label: 'authenticated-radix-release-after'
  });
  const encode = (generationId) => runtime.encodeSortUnique(
    createFakeEncoder(),
    {
      keyBuffer,
      elementCount: 64,
      keyWordCount: 1,
      generationId
    }
  );
  const first = encode(1);
  const second = encode(2);
  const firstOwnedBuffers = [...first.transientBuffers];
  const secondOwnedBuffers = [...second.transientBuffers];
  let resolveFence;
  const fence = new Promise((resolve) => { resolveFence = resolve; });
  const releasePromise = runtime.releaseExecutionAfter(first, fence);
  let publicArrayReadCount = 0;
  Object.defineProperty(first, 'transientBuffers', {
    configurable: true,
    get() {
      publicArrayReadCount += 1;
      return [...secondOwnedBuffers];
    }
  });
  resolveFence();

  assert.equal(await releasePromise, true);
  assert.equal(publicArrayReadCount, 0);
  assert.equal(firstOwnedBuffers.every(({ destroyed }) => destroyed), true);
  assert.equal(secondOwnedBuffers.every(({ destroyed }) => !destroyed), true);
  assert.equal(runtime.releaseExecution(
    second,
    { discardedEncoder: true }
  ), true);
  assert.equal(
    [...firstOwnedBuffers, ...secondOwnedBuffers].every(
      ({ destroyCallCount }) => destroyCallCount === 1
    ),
    true
  );
  runtime.destroy();
  keyBuffer.destroy();
});

test('radix releaseExecutionAfter rejects a truthy non-callable fence without releasing', async () => {
  const device = createFakeDevice();
  const keyBuffer = device.createBuffer({
    label: 'authenticated-radix-exact-fence-keys',
    size: 256,
    usage: 128
  });
  const runtime = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: 64,
    maxKeyWordCount: 1,
    label: 'authenticated-radix-exact-fence'
  });
  const execution = runtime.encodeSortUnique(createFakeEncoder(), {
    keyBuffer,
    elementCount: 64,
    keyWordCount: 1,
    generationId: 1
  });
  const ownedBuffers = [...execution.transientBuffers];

  await assert.rejects(
    runtime.releaseExecutionAfter(execution, { then: 1 }),
    /releaseExecutionAfter requires a submission-fence thenable/
  );
  assert.equal(ownedBuffers.every(({ destroyed }) => !destroyed), true);
  assert.equal(runtime.releaseExecution(
    execution,
    { discardedEncoder: true }
  ), true);
  assert.equal(
    ownedBuffers.every(({ destroyCallCount }) => destroyCallCount === 1),
    true
  );
  runtime.destroy();
  keyBuffer.destroy();
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
  assert.equal(sorted.paramsWriteCount, 2);
  assert.equal(unique.paramsWriteCount, 2);
  assert.equal(unique.clearedWordCount, WEBGPU_RADIX_UNIQUE_CLEARED_WORD_COUNT);
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

  runtime.releaseExecution(sorted, { discardedEncoder: true });
  runtime.releaseExecution(unique, { discardedEncoder: true });
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
    runtime.encodeSortUnique(createFakeEncoder(), {
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

  for (const execution of inFlight.slice(0, 49)) {
    runtime.releaseExecution(execution, { discardedEncoder: true });
  }
  const replacements = Array.from({ length: 49 }, (_, index) => (
    runtime.encodeSortUnique(createFakeEncoder(), {
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
    runtime.releaseExecution(execution, { discardedEncoder: true });
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

test('radix runtime validates the scatter entrypoint 16 KiB workgroup-storage requirement', () => {
  const insufficientDevice = createFakeDevice();
  insufficientDevice.limits = {
    maxComputeWorkgroupStorageSize: WEBGPU_RADIX_SCATTER_WORKGROUP_STORAGE_BYTES - 1
  };
  assert.throws(
    () => createWebGpuStableRadixScanUnique(insufficientDevice, {
      maxElementCount: 64,
      maxKeyWordCount: 1,
      label: 'undersized-workgroup-storage'
    }),
    /scatter entry point requires 16384 bytes.*16383/
  );

  const portableMinimumDevice = createFakeDevice();
  portableMinimumDevice.limits = {
    maxComputeWorkgroupStorageSize: WEBGPU_RADIX_SCATTER_WORKGROUP_STORAGE_BYTES
  };
  const runtime = createWebGpuStableRadixScanUnique(portableMinimumDevice, {
    maxElementCount: 64,
    maxKeyWordCount: 1,
    label: 'portable-workgroup-storage'
  });
  assert.equal(runtime.status, 'webgpu-stable-radix-scan-unique-ready');
  runtime.destroy();
});

test('standalone scan construction rolls back every completed buffer allocation exactly once', () => {
  const args = {
    maxElementCount: 300_000,
    label: 'transactional-scan-constructor',
    retainParamsBuffer: true,
    retainedParamsSlotCount: 2
  };
  const referenceDevice = createFailureInjectedDevice();
  const referenceScan = createWebGpuU32ExclusiveScan(referenceDevice, args);
  const allocationBoundaryCount =
    referenceDevice.failureInjection.counts.createBuffer;
  assert.ok(allocationBoundaryCount > 1);
  referenceScan.destroy();
  referenceScan.destroy();
  assertDestroyedExactlyOnce(
    referenceDevice.buffers,
    'successful scan constructor teardown'
  );

  for (let boundary = 1; boundary <= allocationBoundaryCount; boundary += 1) {
    const device = createFailureInjectedDevice();
    device.failureInjection.failRelative('createBuffer', boundary);
    assert.throws(
      () => createWebGpuU32ExclusiveScan(device, args),
      new RegExp(`injected createBuffer failure ${boundary}`)
    );
    assert.equal(device.buffers.length, boundary - 1);
    assertDestroyedExactlyOnce(
      device.buffers,
      `scan constructor createBuffer boundary ${boundary}`
    );
  }

  const hostileDestroyDevice = createFailureInjectedDevice();
  const createBuffer = hostileDestroyDevice.createBuffer;
  let successfulAllocationCount = 0;
  hostileDestroyDevice.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    successfulAllocationCount += 1;
    if (successfulAllocationCount === 2) {
      const destroy = buffer.destroy.bind(buffer);
      buffer.destroy = () => {
        destroy();
        throw new Error('injected destroy failure');
      };
    }
    return buffer;
  };
  hostileDestroyDevice.failureInjection.failRelative('createBuffer', 4);
  assert.throws(
    () => createWebGpuU32ExclusiveScan(hostileDestroyDevice, args),
    /injected createBuffer failure 4/
  );
  assertDestroyedExactlyOnce(
    hostileDestroyDevice.buffers,
    'scan constructor continues rollback after destroy throws'
  );
});

test('composite radix construction rolls back direct and child-scan ownership at every boundary', () => {
  const args = {
    maxElementCount: 1024,
    maxKeyWordCount: 2,
    label: 'transactional-radix-constructor',
    retainConstantScanParamsBuffers: true,
    retainedParamsSlotCount: 2
  };
  const referenceDevice = createFailureInjectedDevice();
  const referenceRuntime = createWebGpuStableRadixScanUnique(
    referenceDevice,
    args
  );
  const operationBoundaryCounts = Object.fromEntries(
    ['createBuffer', 'createShaderModule', 'createComputePipeline'].map(
      (operation) => [
        operation,
        referenceDevice.failureInjection.counts[operation]
      ]
    )
  );
  referenceRuntime.destroy();
  referenceRuntime.destroy();
  assertDestroyedExactlyOnce(
    referenceDevice.buffers,
    'successful composite constructor teardown'
  );

  for (const [operation, boundaryCount] of Object.entries(
    operationBoundaryCounts
  )) {
    assert.ok(boundaryCount > 0, `${operation} has a constructor boundary`);
    for (let boundary = 1; boundary <= boundaryCount; boundary += 1) {
      const device = createFailureInjectedDevice();
      device.failureInjection.failRelative(operation, boundary);
      assert.throws(
        () => createWebGpuStableRadixScanUnique(device, args),
        new RegExp(`injected ${operation} failure ${boundary}`)
      );
      assertDestroyedExactlyOnce(
        device.buffers,
        `composite constructor ${operation} boundary ${boundary}`
      );
    }
  }

  const arenaValidationDevice = createFailureInjectedDevice();
  arenaValidationDevice.limits = {
    maxComputeWorkgroupStorageSize: WEBGPU_RADIX_SCATTER_WORKGROUP_STORAGE_BYTES,
    maxUniformBufferBindingSize: 16
  };
  assert.throws(
    () => createWebGpuStableRadixScanUnique(arenaValidationDevice, args),
    /params binding exceeds maxUniformBufferBindingSize/
  );
  assert.ok(arenaValidationDevice.buffers.length > 0);
  assertDestroyedExactlyOnce(
    arenaValidationDevice.buffers,
    'composite constructor validation rollback'
  );
});

test('lazy GPU-count resource construction rolls back and retries with fresh buffers', () => {
  const args = {
    maxElementCount: 8193,
    maxKeyWordCount: 1,
    label: 'transactional-gpu-count-resources'
  };
  const referenceDevice = createFailureInjectedDevice();
  const referenceRuntime = createWebGpuStableRadixScanUnique(
    referenceDevice,
    args
  );
  const referenceCountsBefore = {
    ...referenceDevice.failureInjection.counts
  };
  referenceRuntime.prepareGpuCountResources();
  const operationBoundaryCounts = Object.fromEntries(
    [
      'createBuffer',
      'createShaderModule',
      'createComputePipeline',
      'createBindGroup',
      'writeBuffer'
    ].map((operation) => [
      operation,
      referenceDevice.failureInjection.counts[operation]
        - referenceCountsBefore[operation]
    ])
  );
  referenceRuntime.destroy();
  assertDestroyedExactlyOnce(
    referenceDevice.buffers,
    'successful GPU-count resource teardown'
  );

  for (const [operation, boundaryCount] of Object.entries(
    operationBoundaryCounts
  )) {
    assert.ok(boundaryCount > 0, `${operation} has a GPU-count boundary`);
    for (let boundary = 1; boundary <= boundaryCount; boundary += 1) {
      const device = createFailureInjectedDevice();
      const runtime = createWebGpuStableRadixScanUnique(device, args);
      const retainedBuffers = [...device.buffers];
      device.failureInjection.failRelative(operation, boundary);
      assert.throws(
        () => runtime.prepareGpuCountResources(),
        new RegExp(`injected ${operation} failure`)
      );
      const rolledBackBuffers = device.buffers.slice(retainedBuffers.length);
      assertDestroyedExactlyOnce(
        rolledBackBuffers,
        `GPU-count ${operation} boundary ${boundary}`
      );
      assertBuffersRemainLive(
        retainedBuffers,
        `GPU-count ${operation} boundary ${boundary}`
      );
      const rolledBackIdentities = new Set(rolledBackBuffers);
      assert.equal(
        runtime.allocationEntries().some(
          ({ buffer }) => rolledBackIdentities.has(buffer)
        ),
        false
      );

      device.failureInjection.clearAll();
      runtime.prepareGpuCountResources();
      const retryBuffers = device.buffers.slice(
        retainedBuffers.length + rolledBackBuffers.length
      );
      assert.equal(
        retryBuffers.some((buffer) => rolledBackIdentities.has(buffer)),
        false,
        'retry must never reissue a rolled-back buffer'
      );
      assertDestroyedExactlyOnce(
        rolledBackBuffers,
        `GPU-count ${operation} retry preserves rollback`
      );
      runtime.destroy();
      assertDestroyedExactlyOnce(
        [...retainedBuffers, ...retryBuffers],
        `GPU-count ${operation} retry teardown`
      );
    }
  }
});

test('standalone transient scan preparation rolls back allocation, bind, and write failures', () => {
  const args = {
    maxElementCount: 300_000,
    label: 'transactional-transient-scan'
  };
  const prepareArgs = {
    inputBuffer: { label: 'transactional-scan-input' },
    outputBuffer: { label: 'transactional-scan-output' },
    elementCount: 300_000
  };
  const referenceDevice = createFailureInjectedDevice();
  const referenceScan = createWebGpuU32ExclusiveScan(referenceDevice, args);
  const referenceCountsBefore = {
    ...referenceDevice.failureInjection.counts
  };
  const referencePrepared = referenceScan.prepare(prepareArgs);
  const operationBoundaryCounts = Object.fromEntries(
    ['createBuffer', 'createBindGroup', 'writeBuffer'].map((operation) => [
      operation,
      referenceDevice.failureInjection.counts[operation]
        - referenceCountsBefore[operation]
    ])
  );
  referenceScan.releasePrepared(referencePrepared, { discardedEncoder: true });
  referenceScan.destroy();
  assertDestroyedExactlyOnce(
    referenceDevice.buffers,
    'successful transient scan teardown'
  );

  for (const [operation, boundaryCount] of Object.entries(
    operationBoundaryCounts
  )) {
    assert.ok(boundaryCount > 0, `${operation} has a scan-prepare boundary`);
    for (let boundary = 1; boundary <= boundaryCount; boundary += 1) {
      const device = createFailureInjectedDevice();
      const scan = createWebGpuU32ExclusiveScan(device, args);
      const retainedBuffers = [...device.buffers];
      device.failureInjection.failRelative(operation, boundary);
      assert.throws(
        () => scan.prepare(prepareArgs),
        new RegExp(`injected ${operation} failure`)
      );
      const rolledBackBuffers = device.buffers.slice(retainedBuffers.length);
      assertDestroyedExactlyOnce(
        rolledBackBuffers,
        `transient scan ${operation} boundary ${boundary}`
      );
      assertBuffersRemainLive(
        retainedBuffers,
        `transient scan ${operation} boundary ${boundary}`
      );
      const rolledBackIdentities = new Set(rolledBackBuffers);
      assert.equal(
        scan.allocationEntries().some(
          ({ buffer }) => rolledBackIdentities.has(buffer)
        ),
        false
      );

      device.failureInjection.clearAll();
      const retryPrepared = scan.prepare(prepareArgs);
      assert.equal(
        retryPrepared.transientBuffers.some(
          (buffer) => rolledBackIdentities.has(buffer)
        ),
        false,
        'retry must allocate a fresh transient params buffer'
      );
      scan.releasePrepared(retryPrepared, { discardedEncoder: true });
      scan.destroy();
      assertDestroyedExactlyOnce(
        device.buffers,
        `transient scan ${operation} retry teardown`
      );
    }
  }
});

test('combined transient radix encoding rolls back every params, bind, and write boundary', () => {
  const runtimeArgs = {
    maxElementCount: 1024,
    maxKeyWordCount: 1,
    label: 'transactional-transient-radix'
  };
  const encodeArgs = (keyBuffer) => ({
    keyBuffer,
    elementCount: 1024,
    keyWordCount: 1,
    keyStrideWords: 1,
    generationId: 41
  });
  const referenceDevice = createFailureInjectedDevice();
  const referenceRuntime = createWebGpuStableRadixScanUnique(
    referenceDevice,
    runtimeArgs
  );
  const referenceKeyBuffer = referenceDevice.createBuffer({
    label: 'transactional-reference-keys',
    size: 4096,
    usage: 128
  });
  const referenceCountsBefore = {
    ...referenceDevice.failureInjection.counts
  };
  const referenceExecution = referenceRuntime.encodeSortUnique(
    createFakeEncoder(),
    encodeArgs(referenceKeyBuffer)
  );
  const operationBoundaryCounts = Object.fromEntries(
    ['createBuffer', 'createBindGroup', 'writeBuffer'].map((operation) => [
      operation,
      referenceDevice.failureInjection.counts[operation]
        - referenceCountsBefore[operation]
    ])
  );
  referenceRuntime.releaseExecution(referenceExecution, {
    discardedEncoder: true
  });
  referenceRuntime.destroy();
  referenceKeyBuffer.destroy();
  assertDestroyedExactlyOnce(
    referenceDevice.buffers,
    'successful transient radix teardown'
  );

  for (const [operation, boundaryCount] of Object.entries(
    operationBoundaryCounts
  )) {
    assert.ok(boundaryCount > 0, `${operation} has a radix-encode boundary`);
    for (let boundary = 1; boundary <= boundaryCount; boundary += 1) {
      const device = createFailureInjectedDevice();
      const runtime = createWebGpuStableRadixScanUnique(device, runtimeArgs);
      const keyBuffer = device.createBuffer({
        label: `transactional-${operation}-${boundary}-keys`,
        size: 4096,
        usage: 128
      });
      const retainedBuffers = [...device.buffers];
      device.failureInjection.failRelative(operation, boundary);
      assert.throws(
        () => runtime.encodeSortUnique(
          createFakeEncoder(),
          encodeArgs(keyBuffer)
        ),
        new RegExp(`injected ${operation} failure`)
      );
      const rolledBackBuffers = device.buffers.slice(retainedBuffers.length);
      assertDestroyedExactlyOnce(
        rolledBackBuffers,
        `transient radix ${operation} boundary ${boundary}`
      );
      assertBuffersRemainLive(
        retainedBuffers,
        `transient radix ${operation} boundary ${boundary}`
      );
      const rolledBackIdentities = new Set(rolledBackBuffers);
      assert.equal(
        runtime.allocationEntries().some(
          ({ buffer }) => rolledBackIdentities.has(buffer)
        ),
        false
      );

      device.failureInjection.clearAll();
      const retryExecution = runtime.encodeSortUnique(
        createFakeEncoder(),
        encodeArgs(keyBuffer)
      );
      assert.equal(
        retryExecution.transientBuffers.some(
          (buffer) => rolledBackIdentities.has(buffer)
        ),
        false,
        'retry must allocate fresh radix and scan params buffers'
      );
      runtime.releaseExecution(retryExecution, { discardedEncoder: true });
      runtime.destroy();
      keyBuffer.destroy();
      assertDestroyedExactlyOnce(
        device.buffers,
        `transient radix ${operation} retry teardown`
      );
    }
  }
});

test('transient radix rollback survives command-encoder failures after allocation', () => {
  const runtimeArgs = {
    maxElementCount: 1024,
    maxKeyWordCount: 1,
    label: 'transactional-encoder-radix'
  };
  for (const operation of [
    'clearBuffer',
    'beginComputePass',
    'setPipeline',
    'dispatchWorkgroups',
    'end'
  ]) {
    const device = createFailureInjectedDevice();
    const runtime = createWebGpuStableRadixScanUnique(device, runtimeArgs);
    const keyBuffer = device.createBuffer({
      label: `transactional-encoder-${operation}-keys`,
      size: 4096,
      usage: 128
    });
    const retainedBuffers = [...device.buffers];
    assert.throws(
      () => runtime.encodeSortUnique(
        createFailureInjectedEncoder(operation),
        {
          keyBuffer,
          elementCount: 1024,
          keyWordCount: 1,
          keyStrideWords: 1,
          generationId: 77
        }
      ),
      new RegExp(`injected encoder ${operation} failure`)
    );
    const rolledBackBuffers = device.buffers.slice(retainedBuffers.length);
    assert.ok(rolledBackBuffers.length > 0);
    assertDestroyedExactlyOnce(
      rolledBackBuffers,
      `encoder ${operation} rollback`
    );
    assertBuffersRemainLive(retainedBuffers, `encoder ${operation} rollback`);
    const rolledBackIdentities = new Set(rolledBackBuffers);
    assert.equal(
      runtime.allocationEntries().some(
        ({ buffer }) => rolledBackIdentities.has(buffer)
      ),
      false
    );

    const retryExecution = runtime.encodeSortUnique(createFakeEncoder(), {
      keyBuffer,
      elementCount: 1024,
      keyWordCount: 1,
      keyStrideWords: 1,
      generationId: 78
    });
    assert.equal(
      retryExecution.transientBuffers.some(
        (buffer) => rolledBackIdentities.has(buffer)
      ),
      false
    );
    runtime.releaseExecution(retryExecution, { discardedEncoder: true });
    runtime.destroy();
    keyBuffer.destroy();
    assertDestroyedExactlyOnce(
      device.buffers,
      `encoder ${operation} retry teardown`
    );
  }
});

test('native sealed GPU count sorts, uniques, admits zero, and fails closed on seal or overflow', {
  skip: RUN_NATIVE_GPU_COUNT
    ? false
    : 'set ULG_RUN_NATIVE_WEBGPU_RADIX_COUNT=1 for native Vulkan WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_WEBGPU_RADIX_COUNT_CHROME
      || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_GPU_COUNT_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const runtimeModule = await import(
        `/src/runtime/webgpuRadixScanUnique.js?nativeGpuCount=${Date.now()}`
      );
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');

      const runtime = runtimeModule.createWebGpuStableRadixScanUnique(device, {
        maxElementCount: 16,
        maxKeyWordCount: 1,
        label: 'native-sealed-radix'
      });
      runtime.prepareGpuCountResources();
      const keys = new Uint32Array([
        2, 1, 2, 0, 1, 3, 0, 2,
        99, 99, 99, 99, 99, 99, 99, 99
      ]);
      const keyBuffer = device.createBuffer({
        label: 'native-sealed-radix-keys',
        size: keys.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      const authorityBuffer = device.createBuffer({
        label: 'native-sealed-radix-authority',
        size: 8,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(keyBuffer, 0, keys);

      const run = async ({
        count,
        authoritySeal,
        expectedSeal,
        maximum
      }) => {
        device.queue.writeBuffer(
          authorityBuffer,
          0,
          new Uint32Array([count, authoritySeal])
        );
        const encoder = device.createCommandEncoder();
        const execution = runtime.encodeSortUniqueGpuCount(encoder, {
          keyBuffer,
          authorityBuffer,
          generationSeal: expectedSeal,
          maxElementCount: maximum,
          keyWordCount: 1,
          consumerWorkgroupSize: 4
        });
        const regions = {
          control: {
            offset: 0,
            size: execution.gpuCountControlLayout.controlByteLength
          }
        };
        regions.evidence = {
          offset: regions.control.offset + regions.control.size,
          size: 8 * 4
        };
        regions.dispatch = {
          offset: regions.evidence.offset + regions.evidence.size,
          size: 3 * 4
        };
        regions.sorted = {
          offset: regions.dispatch.offset + regions.dispatch.size,
          size: 16 * 4
        };
        regions.uniqueKeys = {
          offset: regions.sorted.offset + regions.sorted.size,
          size: 16 * 4
        };
        regions.uniqueOffsets = {
          offset: regions.uniqueKeys.offset + regions.uniqueKeys.size,
          size: 17 * 4
        };
        const readbackSize =
          regions.uniqueOffsets.offset + regions.uniqueOffsets.size;
        const readback = device.createBuffer({
          size: readbackSize,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const copy = (source, region) => encoder.copyBufferToBuffer(
          source,
          0,
          readback,
          region.offset,
          region.size
        );
        copy(execution.gpuCountControlBuffer, regions.control);
        copy(execution.uniqueEvidenceBuffer, regions.evidence);
        copy(execution.uniqueDispatchIndirectBuffer, regions.dispatch);
        copy(execution.sortedIndicesBuffer, regions.sorted);
        copy(execution.uniqueKeysBuffer, regions.uniqueKeys);
        copy(execution.uniqueOffsetsBuffer, regions.uniqueOffsets);
        device.queue.submit([encoder.finish()]);
        const fence = device.queue.onSubmittedWorkDone();
        await readback.mapAsync(GPUMapMode.READ);
        const mapped = readback.getMappedRange();
        const readWords = (region) => Array.from(new Uint32Array(
          mapped,
          region.offset,
          region.size / 4
        ));
        const result = {
          control: readWords(regions.control),
          evidence: readWords(regions.evidence),
          dispatch: readWords(regions.dispatch),
          sorted: readWords(regions.sorted),
          uniqueKeys: readWords(regions.uniqueKeys),
          uniqueOffsets: readWords(regions.uniqueOffsets)
        };
        readback.unmap();
        await runtime.releaseExecutionAfter(execution, fence);
        readback.destroy();
        return result;
      };

      const valid = await run({
        count: 8,
        authoritySeal: 7,
        expectedSeal: 7,
        maximum: 8
      });
      const zero = await run({
        count: 0,
        authoritySeal: 8,
        expectedSeal: 8,
        maximum: 8
      });
      const invalidSeal = await run({
        count: 8,
        authoritySeal: 8,
        expectedSeal: 9,
        maximum: 8
      });
      const overflow = await run({
        count: 9,
        authoritySeal: 10,
        expectedSeal: 10,
        maximum: 8
      });

      runtime.destroy();
      keyBuffer.destroy();
      authorityBuffer.destroy();
      const outOfMemoryError = await device.popErrorScope();
      const internalError = await device.popErrorScope();
      const validationError = await device.popErrorScope();
      device.destroy();
      return {
        status: 'ok',
        valid,
        zero,
        invalidSeal,
        overflow,
        errors: [
          outOfMemoryError?.message,
          internalError?.message,
          validationError?.message,
          ...uncapturedErrors
        ].filter(Boolean)
      };
    });
  } finally {
    await browser.close();
  }

  if (native.status === 'unsupported') assert.fail(native.reason);
  assert.deepEqual(native.errors, []);
  assert.deepEqual(native.valid.evidence, [7, 8, 4, 1, 0, 1, 1, 3]);
  assert.deepEqual(native.valid.dispatch, [1, 1, 1]);
  assert.deepEqual(native.valid.sorted.slice(0, 8), [3, 6, 1, 4, 0, 2, 7, 5]);
  assert.deepEqual(native.valid.uniqueKeys.slice(0, 4), [0, 1, 2, 3]);
  assert.deepEqual(native.valid.uniqueOffsets.slice(0, 5), [0, 2, 4, 7, 8]);

  assert.deepEqual(native.zero.evidence, [8, 0, 0, 1, 0, 1, 1, 3]);
  assert.deepEqual(native.zero.dispatch, [0, 0, 0]);
  assert.deepEqual(native.zero.uniqueOffsets.slice(0, 1), [0]);
  const nativeControlLayout = createWebGpuRadixGpuCountControlLayout({
    maxElementCount: 16
  });
  assert.equal(native.zero.control[2],
    WEBGPU_PARALLEL_PRIMITIVE_STATUS_READY
      | WEBGPU_PARALLEL_PRIMITIVE_STATUS_ADMITTED);
  assert.equal(native.zero.control[5], 0);
  assert.equal(
    native.zero.control
      .slice(nativeControlLayout.radixDispatchOffsetWords)
      .every((word) => word === 0),
    true
  );

  assert.equal(
    native.invalidSeal.evidence[7]
      & (
        WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED
        | WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_SEAL
      ),
    WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED
      | WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_SEAL
  );
  assert.equal(native.invalidSeal.evidence[3], 0);
  assert.equal(native.invalidSeal.evidence[2], 0);
  assert.deepEqual(native.invalidSeal.dispatch, [0, 0, 0]);
  assert.equal(
    native.invalidSeal.control
      .slice(nativeControlLayout.radixDispatchOffsetWords)
      .every((word) => word === 0),
    true
  );

  assert.equal(
    native.overflow.evidence[7]
      & (
        WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED
        | WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW
      ),
    WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED
      | WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW
  );
  assert.equal(native.overflow.evidence[3], 0);
  assert.equal(native.overflow.evidence[4], 1);
  assert.deepEqual(native.overflow.dispatch, [0, 0, 0]);
  assert.equal(
    native.overflow.control
      .slice(nativeControlLayout.radixDispatchOffsetWords)
      .every((word) => word === 0),
    true
  );
});

test('native fused GPU-count scans gate dynamic depth and admit the production capacity tier', {
  skip: RUN_NATIVE_GPU_COUNT
    ? false
    : 'set ULG_RUN_NATIVE_WEBGPU_RADIX_COUNT=1 for native Vulkan WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_WEBGPU_RADIX_COUNT_CHROME
      || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_GPU_COUNT_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const runtimeModule = await import(
        `/src/runtime/webgpuRadixScanUnique.js?nativeGpuCountFused=${Date.now()}`
      );
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');

      const arraysEqual = (left, right) => (
        left.length === right.length
        && left.every((value, index) => value === right[index])
      );
      const readWords = (mapped, region) => Array.from(new Uint32Array(
        mapped,
        region.offset,
        region.size / Uint32Array.BYTES_PER_ELEMENT
      ));
      const addRegion = (regions, cursor, name, wordCount) => {
        regions[name] = {
          offset: cursor,
          size: wordCount * Uint32Array.BYTES_PER_ELEMENT
        };
        return cursor + regions[name].size;
      };
      const copyRegion = (encoder, source, readback, region) => {
        if (region.size === 0) return;
        encoder.copyBufferToBuffer(
          source,
          0,
          readback,
          region.offset,
          region.size
        );
      };

      const boundaryMaximum = 8_193;
      const boundaryRuntime =
        runtimeModule.createWebGpuStableRadixScanUnique(device, {
          maxElementCount: boundaryMaximum,
          maxKeyWordCount: 1,
          label: 'native-fused-boundary-radix'
        });
      boundaryRuntime.prepareGpuCountResources();
      const boundaryKeys = new Uint32Array(boundaryMaximum);
      boundaryKeys.set([2, 1, 2, 0, 1, 3, 0, 2]);
      for (let index = 8; index < boundaryKeys.length; index += 1) {
        boundaryKeys[index] = (index * 37) % 257;
      }
      const boundaryKeyBuffer = device.createBuffer({
        label: 'native-fused-boundary-keys',
        size: boundaryKeys.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      const boundaryAuthorityBuffer = device.createBuffer({
        label: 'native-fused-boundary-authority',
        size: 8,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(boundaryKeyBuffer, 0, boundaryKeys);

      const runBoundary = async ({
        name,
        count,
        authoritySeal,
        expectedSeal,
        maximum = boundaryMaximum
      }) => {
        device.queue.writeBuffer(
          boundaryAuthorityBuffer,
          0,
          new Uint32Array([count, authoritySeal])
        );
        const encoder = device.createCommandEncoder();
        const execution = boundaryRuntime.encodeSortUniqueGpuCount(encoder, {
          keyBuffer: boundaryKeyBuffer,
          authorityBuffer: boundaryAuthorityBuffer,
          generationSeal: expectedSeal,
          maxElementCount: maximum,
          keyWordCount: 1,
          keyStrideWords: 1,
          generationId: expectedSeal,
          consumerWorkgroupSize: 64
        });
        const admitted =
          authoritySeal === expectedSeal && count <= maximum;
        const expectedSorted = admitted
          ? Array.from({ length: count }, (_, index) => index).sort(
              (left, right) => (
                boundaryKeys[left] - boundaryKeys[right] || left - right
              )
            )
          : [];
        const expectedUniqueKeys = [];
        const expectedUniqueOffsets = [];
        if (admitted) {
          for (let position = 0; position < expectedSorted.length; position += 1) {
            const key = boundaryKeys[expectedSorted[position]];
            if (position === 0
              || key !== boundaryKeys[expectedSorted[position - 1]]) {
              expectedUniqueKeys.push(key);
              expectedUniqueOffsets.push(position);
            }
          }
          expectedUniqueOffsets.push(count);
        }

        const regions = {};
        let cursor = 0;
        cursor = addRegion(
          regions,
          cursor,
          'control',
          execution.gpuCountControlLayout.controlWordCount
        );
        cursor = addRegion(regions, cursor, 'evidence', 8);
        cursor = addRegion(regions, cursor, 'dispatch', 3);
        cursor = addRegion(regions, cursor, 'sorted', expectedSorted.length);
        cursor = addRegion(
          regions,
          cursor,
          'uniqueKeys',
          expectedUniqueKeys.length
        );
        cursor = addRegion(
          regions,
          cursor,
          'uniqueOffsets',
          Math.max(1, expectedUniqueOffsets.length)
        );
        const readback = device.createBuffer({
          size: Math.max(Uint32Array.BYTES_PER_ELEMENT, cursor),
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        copyRegion(
          encoder,
          execution.gpuCountControlBuffer,
          readback,
          regions.control
        );
        copyRegion(
          encoder,
          execution.uniqueEvidenceBuffer,
          readback,
          regions.evidence
        );
        copyRegion(
          encoder,
          execution.uniqueDispatchIndirectBuffer,
          readback,
          regions.dispatch
        );
        copyRegion(
          encoder,
          execution.sortedIndicesBuffer,
          readback,
          regions.sorted
        );
        copyRegion(
          encoder,
          execution.uniqueKeysBuffer,
          readback,
          regions.uniqueKeys
        );
        copyRegion(
          encoder,
          execution.uniqueOffsetsBuffer,
          readback,
          regions.uniqueOffsets
        );
        device.queue.submit([encoder.finish()]);
        const fence = device.queue.onSubmittedWorkDone();
        await readback.mapAsync(GPUMapMode.READ);
        const mapped = readback.getMappedRange();
        const control = readWords(mapped, regions.control);
        const evidence = readWords(mapped, regions.evidence);
        const dispatch = readWords(mapped, regions.dispatch);
        const sorted = readWords(mapped, regions.sorted);
        const uniqueKeys = readWords(mapped, regions.uniqueKeys);
        const uniqueOffsets = readWords(mapped, regions.uniqueOffsets);
        readback.unmap();
        await boundaryRuntime.releaseExecutionAfter(execution, fence);
        readback.destroy();

        const layout = execution.gpuCountControlLayout;
        return {
          name,
          count,
          evidence,
          dispatch,
          sortedExact: admitted
            ? arraysEqual(sorted, expectedSorted)
            : null,
          uniqueKeysExact: admitted
            ? arraysEqual(uniqueKeys, expectedUniqueKeys)
            : null,
          uniqueOffsetsExact: admitted
            ? arraysEqual(uniqueOffsets, expectedUniqueOffsets)
            : null,
          expectedUniqueCount: expectedUniqueKeys.length,
          allIndirectRowsZero: control
            .slice(layout.radixDispatchOffsetWords)
            .every((word) => word === 0),
          histogramLowerAddRow: control.slice(
            layout.histogramScanDispatchOffsetWords + 3,
            layout.histogramScanDispatchOffsetWords + 6
          ),
          histogramTopBlockRow: control.slice(
            layout.histogramScanDispatchOffsetWords + 6,
            layout.histogramScanDispatchOffsetWords + 9
          ),
          headLowerAddRow: control.slice(
            layout.headScanDispatchOffsetWords + 3,
            layout.headScanDispatchOffsetWords + 6
          ),
          headTopBlockRow: control.slice(
            layout.headScanDispatchOffsetWords + 6,
            layout.headScanDispatchOffsetWords + 9
          )
        };
      };

      const boundaryCases = [];
      boundaryCases.push(await runBoundary({
        name: 'head-below',
        count: 512,
        authoritySeal: 11,
        expectedSeal: 11
      }));
      boundaryCases.push(await runBoundary({
        name: 'head-above',
        count: 513,
        authoritySeal: 12,
        expectedSeal: 12
      }));
      boundaryCases.push(await runBoundary({
        name: 'histogram-below',
        count: 8_192,
        authoritySeal: 13,
        expectedSeal: 13
      }));
      boundaryCases.push(await runBoundary({
        name: 'histogram-above',
        count: 8_193,
        authoritySeal: 14,
        expectedSeal: 14
      }));
      boundaryCases.push(await runBoundary({
        name: 'zero',
        count: 0,
        authoritySeal: 15,
        expectedSeal: 15
      }));
      boundaryCases.push(await runBoundary({
        name: 'invalid-seal',
        count: 513,
        authoritySeal: 16,
        expectedSeal: 17
      }));
      boundaryCases.push(await runBoundary({
        name: 'overflow',
        count: 8_194,
        authoritySeal: 18,
        expectedSeal: 18
      }));
      boundaryRuntime.destroy();
      boundaryKeyBuffer.destroy();
      boundaryAuthorityBuffer.destroy();

      const productionRuntimeMaximum = 221_184;
      const productionMaximum = 124_416;
      const productionKeyWordCount = 3;
      const productionRuntime =
        runtimeModule.createWebGpuStableRadixScanUnique(device, {
          maxElementCount: productionRuntimeMaximum,
          maxKeyWordCount: productionKeyWordCount,
          label: 'native-fused-production-radix'
        });
      productionRuntime.prepareGpuCountResources();
      const productionKeys = new Uint32Array(
        productionRuntimeMaximum * productionKeyWordCount
      );
      for (let index = 0; index < productionMaximum; index += 1) {
        productionKeys[index * productionKeyWordCount] = index % 17;
        productionKeys[index * productionKeyWordCount + 1] = (index * 7) % 11;
        productionKeys[index * productionKeyWordCount + 2] = (index * 13) % 5;
      }
      const productionKeyBuffer = device.createBuffer({
        label: 'native-fused-production-keys',
        size: productionKeys.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      const productionAuthorityBuffer = device.createBuffer({
        label: 'native-fused-production-authority',
        size: 8,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(productionKeyBuffer, 0, productionKeys);

      const runProduction = async ({
        count,
        authoritySeal,
        expectedSeal
      }) => {
        device.queue.writeBuffer(
          productionAuthorityBuffer,
          0,
          new Uint32Array([count, authoritySeal])
        );
        const admitted =
          authoritySeal === expectedSeal && count <= productionMaximum;
        const expectedSorted = admitted
          ? Array.from({ length: count }, (_, index) => index).sort(
              (left, right) => {
                const leftBase = left * productionKeyWordCount;
                const rightBase = right * productionKeyWordCount;
                for (let word = 0; word < productionKeyWordCount; word += 1) {
                  const difference =
                    productionKeys[leftBase + word]
                    - productionKeys[rightBase + word];
                  if (difference !== 0) return difference;
                }
                return left - right;
              }
            )
          : [];
        const expectedUniqueKeys = [];
        const expectedUniqueOffsets = [];
        if (admitted) {
          for (let position = 0; position < expectedSorted.length; position += 1) {
            const record = expectedSorted[position];
            const base = record * productionKeyWordCount;
            let head = position === 0;
            if (!head) {
              const priorBase =
                expectedSorted[position - 1] * productionKeyWordCount;
              for (let word = 0; word < productionKeyWordCount; word += 1) {
                if (productionKeys[base + word]
                  !== productionKeys[priorBase + word]) {
                  head = true;
                  break;
                }
              }
            }
            if (head) {
              expectedUniqueOffsets.push(position);
              for (let word = 0; word < productionKeyWordCount; word += 1) {
                expectedUniqueKeys.push(productionKeys[base + word]);
              }
            }
          }
          expectedUniqueOffsets.push(count);
        }

        const encoder = device.createCommandEncoder();
        const execution = productionRuntime.encodeSortUniqueGpuCount(encoder, {
          keyBuffer: productionKeyBuffer,
          authorityBuffer: productionAuthorityBuffer,
          generationSeal: expectedSeal,
          maxElementCount: productionMaximum,
          keyWordCount: productionKeyWordCount,
          keyStrideWords: productionKeyWordCount,
          generationId: expectedSeal,
          consumerWorkgroupSize: 64
        });
        const regions = {};
        let cursor = 0;
        cursor = addRegion(
          regions,
          cursor,
          'control',
          execution.gpuCountControlLayout.controlWordCount
        );
        cursor = addRegion(regions, cursor, 'evidence', 8);
        cursor = addRegion(regions, cursor, 'dispatch', 3);
        cursor = addRegion(regions, cursor, 'sorted', expectedSorted.length);
        cursor = addRegion(
          regions,
          cursor,
          'uniqueKeys',
          expectedUniqueKeys.length
        );
        cursor = addRegion(
          regions,
          cursor,
          'uniqueOffsets',
          Math.max(1, expectedUniqueOffsets.length)
        );
        const readback = device.createBuffer({
          size: Math.max(Uint32Array.BYTES_PER_ELEMENT, cursor),
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        copyRegion(
          encoder,
          execution.gpuCountControlBuffer,
          readback,
          regions.control
        );
        copyRegion(
          encoder,
          execution.uniqueEvidenceBuffer,
          readback,
          regions.evidence
        );
        copyRegion(
          encoder,
          execution.uniqueDispatchIndirectBuffer,
          readback,
          regions.dispatch
        );
        copyRegion(
          encoder,
          execution.sortedIndicesBuffer,
          readback,
          regions.sorted
        );
        copyRegion(
          encoder,
          execution.uniqueKeysBuffer,
          readback,
          regions.uniqueKeys
        );
        copyRegion(
          encoder,
          execution.uniqueOffsetsBuffer,
          readback,
          regions.uniqueOffsets
        );
        device.queue.submit([encoder.finish()]);
        const fence = device.queue.onSubmittedWorkDone();
        await readback.mapAsync(GPUMapMode.READ);
        const mapped = readback.getMappedRange();
        const control = readWords(mapped, regions.control);
        const evidence = readWords(mapped, regions.evidence);
        const dispatch = readWords(mapped, regions.dispatch);
        const sorted = readWords(mapped, regions.sorted);
        const uniqueKeys = readWords(mapped, regions.uniqueKeys);
        const uniqueOffsets = readWords(mapped, regions.uniqueOffsets);
        readback.unmap();
        await productionRuntime.releaseExecutionAfter(execution, fence);
        readback.destroy();

        const layout = execution.gpuCountControlLayout;
        return {
          count,
          evidence,
          dispatch,
          encodedDispatchCount: execution.encodedDispatchCount,
          histogramScanFusedTopAddEnabled:
            execution.histogramScanFusedTopAddEnabled,
          headScanFusedTopAddEnabled:
            execution.headScanFusedTopAddEnabled,
          sortedExact: admitted
            ? arraysEqual(sorted, expectedSorted)
            : null,
          uniqueKeysExact: admitted
            ? arraysEqual(uniqueKeys, expectedUniqueKeys)
            : null,
          uniqueOffsetsExact: admitted
            ? arraysEqual(uniqueOffsets, expectedUniqueOffsets)
            : null,
          expectedUniqueCount:
            expectedUniqueKeys.length / productionKeyWordCount,
          allIndirectRowsZero: control
            .slice(layout.radixDispatchOffsetWords)
            .every((word) => word === 0),
          histogramTopBlockRow: control.slice(
            layout.histogramScanDispatchOffsetWords + 6,
            layout.histogramScanDispatchOffsetWords + 9
          )
        };
      };

      const productionValid = await runProduction({
        count: productionMaximum,
        authoritySeal: 91,
        expectedSeal: 91
      });
      const productionOverflow = await runProduction({
        count: productionMaximum + 1,
        authoritySeal: 92,
        expectedSeal: 92
      });
      productionRuntime.destroy();
      productionKeyBuffer.destroy();
      productionAuthorityBuffer.destroy();

      const outOfMemoryError = await device.popErrorScope();
      const internalError = await device.popErrorScope();
      const validationError = await device.popErrorScope();
      device.destroy();
      return {
        status: 'ok',
        boundaryCases,
        productionValid,
        productionOverflow,
        errors: [
          outOfMemoryError?.message,
          internalError?.message,
          validationError?.message,
          ...uncapturedErrors
        ].filter(Boolean)
      };
    });
  } finally {
    await browser.close();
  }

  if (native.status === 'unsupported') assert.fail(native.reason);
  assert.deepEqual(native.errors, []);
  const boundary = Object.fromEntries(
    native.boundaryCases.map((entry) => [entry.name, entry])
  );
  for (const name of [
    'head-below',
    'head-above',
    'histogram-below',
    'histogram-above',
    'zero'
  ]) {
    assert.equal(boundary[name].sortedExact, true, `${name} stable sort`);
    assert.equal(boundary[name].uniqueKeysExact, true, `${name} unique keys`);
    assert.equal(
      boundary[name].uniqueOffsetsExact,
      true,
      `${name} unique offsets`
    );
    assert.equal(
      boundary[name].evidence[2],
      boundary[name].expectedUniqueCount,
      `${name} unique evidence`
    );
    assert.equal(boundary[name].evidence[3], 1, `${name} admitted`);
  }
  assert.deepEqual(boundary['head-below'].headLowerAddRow, [0, 0, 0]);
  assert.deepEqual(boundary['head-below'].headTopBlockRow, [0, 0, 0]);
  assert.deepEqual(boundary['head-above'].headLowerAddRow, [2, 1, 1]);
  assert.deepEqual(boundary['head-above'].headTopBlockRow, [1, 1, 1]);
  assert.deepEqual(
    boundary['histogram-below'].histogramLowerAddRow,
    [0, 0, 0]
  );
  assert.deepEqual(
    boundary['histogram-below'].histogramTopBlockRow,
    [0, 0, 0]
  );
  assert.deepEqual(
    boundary['histogram-above'].histogramLowerAddRow,
    [2, 1, 1]
  );
  assert.deepEqual(
    boundary['histogram-above'].histogramTopBlockRow,
    [1, 1, 1]
  );
  assert.equal(boundary.zero.allIndirectRowsZero, true);
  assert.deepEqual(boundary.zero.dispatch, [0, 0, 0]);

  assert.equal(boundary['invalid-seal'].allIndirectRowsZero, true);
  assert.deepEqual(boundary['invalid-seal'].dispatch, [0, 0, 0]);
  assert.equal(
    boundary['invalid-seal'].evidence[7]
      & (
        WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED
        | WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_SEAL
      ),
    WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED
      | WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_SEAL
  );
  assert.equal(boundary.overflow.allIndirectRowsZero, true);
  assert.deepEqual(boundary.overflow.dispatch, [0, 0, 0]);
  assert.equal(
    boundary.overflow.evidence[7]
      & (
        WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED
        | WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW
      ),
    WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED
      | WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW
  );

  assert.equal(native.productionValid.encodedDispatchCount, 104);
  assert.equal(
    native.productionValid.histogramScanFusedTopAddEnabled,
    true
  );
  assert.equal(native.productionValid.headScanFusedTopAddEnabled, false);
  assert.equal(native.productionValid.sortedExact, true);
  assert.equal(native.productionValid.uniqueKeysExact, true);
  assert.equal(native.productionValid.uniqueOffsetsExact, true);
  assert.equal(native.productionValid.expectedUniqueCount, 935);
  assert.deepEqual(
    native.productionValid.evidence,
    [91, 124_416, 935, 1, 0, 3, 3, 3]
  );
  assert.deepEqual(native.productionValid.histogramTopBlockRow, [1, 1, 1]);
  assert.equal(native.productionOverflow.allIndirectRowsZero, true);
  assert.deepEqual(native.productionOverflow.dispatch, [0, 0, 0]);
  assert.equal(
    native.productionOverflow.evidence[7]
      & (
        WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED
        | WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW
      ),
    WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED
      | WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW
  );
});
