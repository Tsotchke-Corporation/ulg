import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
  createSchroederSpatialMechanicsViewPlan,
  validateSchroederSpatialMechanicsViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  schroederSpatialMechanicsViewV2Wgsl
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsViewWgsl.js';
import {
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
  createSchroederSpatialEpochV2Layout
} from '../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
  createSchroederSpatialActiveSourceFingerprint,
  createSchroederSpatialActiveSourceViewLayout
} from '../ulg-gpu-abi/src/schroederSpatialActiveSourceView.js';
import {
  createSchroederSpatialMechanicsViewGpu
} from '../src/runtime/sph/schroederSpatialMechanicsViewGpu.js';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const SOURCE_STRIDE_BYTES = 16 * Float32Array.BYTES_PER_ELEMENT;

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createFakeDevice() {
  const buffers = [];
  const bindGroups = [];
  const writes = [];
  const device = {
    buffers,
    bindGroups,
    writes,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : new Uint8Array(data);
        writes.push({
          buffer,
          offset,
          byteLength: data.byteLength,
          snapshot: bytes.slice().buffer
        });
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
    },
    createShaderModule(descriptor) {
      return descriptor;
    },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) {
          return {
            pipeline: descriptor.label,
            entryPoint: descriptor.compute.entryPoint,
            index
          };
        }
      };
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
      events.push({ kind: 'clear', buffer, offset, size });
    },
    beginComputePass(descriptor = {}) {
      const event = { kind: 'pass', descriptor, commands: [] };
      events.push(event);
      let pipeline = null;
      let bindGroup = null;
      return {
        setPipeline(value) {
          pipeline = value;
        },
        setBindGroup(index, value) {
          bindGroup = { index, value };
        },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({
            pipeline,
            bindGroup,
            dispatch: [x, y, z]
          });
        },
        dispatchWorkgroupsIndirect(buffer, byteOffset) {
          event.commands.push({
            pipeline,
            bindGroup,
            dispatchIndirect: { buffer, byteOffset }
          });
        },
        end() {
          event.ended = true;
        }
      };
    }
  };
}

function createV2Authority(
  device,
  {
    physicalSourceCount = 1024,
    activeSourceCapacity = 8,
    generationId = 7
  } = {}
) {
  const sourceBuffer = device.createBuffer({
    label: 'sparse-physical-level-assignment',
    size: physicalSourceCount * SOURCE_STRIDE_BYTES,
    usage: 128
  });
  const activeLayout = createSchroederSpatialActiveSourceViewLayout({
    physicalSourceCapacity: physicalSourceCount,
    activeSourceCapacity
  });
  const activeSourceViewBuffer = device.createBuffer({
    label: 'gpu-active-source-authority',
    size: activeLayout.byteLength,
    usage: 128 | 256
  });
  const directoryLayout = createSchroederSpatialEpochV2Layout({
    physicalSourceCapacity: physicalSourceCount,
    activeSourceCapacity,
    cellCapacity: activeSourceCapacity
  });
  const directoryBuffer = device.createBuffer({
    label: 'gpu-directory-v2-authority',
    size: directoryLayout.byteLength,
    usage: 128
  });
  const identity = {
    generationId,
    deviceOrdinal: 3,
    laneOrdinal: 5,
    leaseToken: 11,
    sourceFamilyId: 13,
    storageGeneration: 17,
    physicsTick: 19,
    physicsSubstep: 0,
    positionEpoch: 23,
    topologyEpoch: 29,
    chartEpoch: 31,
    levelEpoch: 37,
    supportEpoch: 41,
    buildOrdinal: 43
  };
  const sourceFingerprint = createSchroederSpatialActiveSourceFingerprint({
    ...identity,
    physicalSourceCount,
    physicalSourceCapacity: physicalSourceCount,
    activeSourceCapacity,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceRowStrideFloats: 16,
    queryGeometryMode: 1,
    queryChartId: 0,
    queryMinLevel: 0,
    queryMaxLevel: 0,
    queryBaseGridSpacingM: 0.25
  });
  let activeSourceView;
  const activeOwnerRuntime = {
    ownsExecution(candidate) {
      return candidate === activeSourceView;
    }
  };
  activeSourceView = {
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
    status: 'schroeder-spatial-active-source-view-gpu-encoded',
    ready: true,
    selected: true,
    sourceBuffer,
    activeSourceViewBuffer,
    layout: activeLayout,
    physicalSourceCount,
    physicalSourceCapacity: physicalSourceCount,
    activeSourceCapacity,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceRowStrideFloats: 16,
    ...identity,
    sourceFingerprint,
    queryGeometryMode: 1,
    queryChartId: 0,
    queryMinLevel: 0,
    queryMaxLevel: 0,
    queryBaseGridSpacingM: 0.25,
    activeDispatchOffsetBytes: activeLayout.activeDispatchOffsetBytes,
    candidateDispatchOffsetBytes: activeLayout.candidateDispatchOffsetBytes,
    physicalDispatchOffsetBytes: activeLayout.physicalDispatchOffsetBytes,
    ownerRuntime: activeOwnerRuntime
  };
  const activeSourceCountAuthority = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
    activeSourceView,
    buffer: activeSourceViewBuffer,
    offsetWords: 18,
    offsetBytes: 18 * UINT32_BYTES,
    capacity: activeSourceCapacity,
    residency: 'gpu-only'
  });
  const exactNearQueryProfile = {
    ready: true,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    chartId: 0,
    minLevel: 0,
    maxLevel: 0,
    baseGridSpacingM: 0.25
  };
  let spatialExecution;
  const spatialOwnerRuntime = {
    ownsExecution(candidate) {
      return candidate === spatialExecution;
    }
  };
  spatialExecution = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
    status: 'schroeder-spatial-epoch-v2-gpu-encoded',
    abiVersion: SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
    submitPerformed: false,
    released: false,
    sourceBuffer,
    sourceCount: physicalSourceCount,
    physicalSourceCount,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    exactNearQueryProfile,
    queryGeometryEvidence: exactNearQueryProfile,
    queryGeometryMode: 1,
    queryChartId: 0,
    queryMinLevel: 0,
    queryMaxLevel: 0,
    queryBaseGridSpacingM: 0.25,
    queryEvidenceWordCount: 6,
    ...identity,
    directoryBuffer,
    layout: directoryLayout,
    activeSourceView,
    activeSourceViewBuffer,
    activeSourceCountAuthority,
    ownerRuntime: spatialOwnerRuntime
  };
  return {
    sourceBuffer,
    activeSourceView,
    activeSourceViewBuffer,
    activeSourceCountAuthority,
    spatialExecution,
    directoryBuffer,
    activeLayout,
    directoryLayout
  };
}

function createRuntime(device, maxSourceCount = 1024) {
  return createSchroederSpatialMechanicsViewGpu(device, {
    maxSourceCount,
    gridNodeCount: 512,
    gridDims: [8, 8, 8],
    gridShift: 2,
    gridSpacingM: 0.25,
    arenaCount: 2,
    label: 'test-mechanics-view-v2'
  });
}

function encodeV2(runtime, encoder, authority) {
  return runtime.encode(encoder, {
    sourceBuffer: authority.sourceBuffer,
    sourceCount: authority.spatialExecution.physicalSourceCount,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    selectedLevel: 0,
    spatialExecution: authority.spatialExecution
  });
}

test('mechanics-view v2 plan preserves physical identity without a host active count', () => {
  const plan = createSchroederSpatialMechanicsViewPlan({
    sourceCount: 1024,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    directoryAbiVersion:
      SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
    selectedLevel: 0,
    gridNodeCount: 512,
    gridDims: [8, 8, 8],
    gridShift: 2,
    gridSpacingM: 0.25,
    generationId: 1,
    deviceOrdinal: 0,
    laneOrdinal: 0,
    leaseToken: 0,
    sourceFamilyId: 0,
    storageGeneration: 1,
    physicsTick: 0,
    physicsSubstep: 0,
    positionEpoch: 0,
    topologyEpoch: 0,
    chartEpoch: 0,
    levelEpoch: 0,
    supportEpoch: 0
  });
  assert.equal(plan.sourceCount, 1024);
  assert.equal(plan.physicalSourceCount, 1024);
  assert.equal(
    plan.sourceWorkIdentity,
    SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY
  );
  assert.equal(plan.gpuAuthoredActiveSourceCount, true);
  assert.equal(Object.hasOwn(plan, 'activeSourceCount'), false);
  assert.match(
    schroederSpatialMechanicsViewV2Wgsl,
    /dispatchWorkgroupsIndirect|ACTIVE_SOURCE_ACTIVE_DISPATCH_OFFSET/
  );
  assert.match(
    schroederSpatialMechanicsViewV2Wgsl,
    /active_count == 0u \|\| cell_count > 0u/
  );
  assert.match(
    schroederSpatialMechanicsViewV2Wgsl,
    /physical_to_active_offset_words \+ physical_source/
  );
  assert.match(
    schroederSpatialMechanicsViewV2Wgsl,
    /encoded_cell - 1u/
  );
});

test('directory-v2 encoding dispatches sparse work from the exact GPU ActiveSource authority', async () => {
  const device = createFakeDevice();
  const runtime = createRuntime(device);
  const authority = createV2Authority(device);
  const retainedBufferCount = device.buffers.length;
  const encoder = createFakeEncoder();
  encoder.events.push({
    kind: 'producer-order',
    stages: ['active-source-finalize', 'directory-v2-finalize']
  });
  const execution = encodeV2(runtime, encoder, authority);

  assert.equal(device.buffers.length, retainedBufferCount);
  assert.equal(execution.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(execution.bufferAllocationCountDuringEncode, 0);
  assert.equal(execution.readbackPerformed, false);
  assert.equal(execution.sourceCount, 1024);
  assert.equal(execution.physicalSourceCount, 1024);
  assert.equal(Object.hasOwn(execution, 'activeSourceCount'), false);
  assert.equal(
    execution.sourceWorkIdentity,
    SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY
  );
  assert.equal(
    execution.activeSourceView,
    authority.activeSourceView
  );
  assert.equal(
    execution.activeSourceViewBuffer,
    authority.activeSourceViewBuffer
  );
  assert.equal(
    execution.activeSourceCountAuthority.buffer,
    authority.activeSourceViewBuffer
  );
  assert.equal(
    execution.activeSourceCountAuthority,
    authority.activeSourceCountAuthority
  );
  assert.equal(
    execution.activeSourceCountAuthority,
    authority.spatialExecution.activeSourceCountAuthority
  );
  assert.deepEqual(execution.encodedProducerPassOrder.slice(0, 3), [
    'borrowed-active-source-finalize',
    'borrowed-directory-v2-finalize',
    'mechanics-active-ordinal-mark'
  ]);

  const markPass = encoder.events.find(
    (event) => event.kind === 'pass'
      && /MarkNodesActiveOrdinal/.test(event.descriptor.label)
  );
  assert.ok(markPass);
  assert.deepEqual(markPass.commands[0].dispatchIndirect, {
    buffer: authority.activeSourceViewBuffer,
    byteOffset: 48 * UINT32_BYTES
  });
  const markBindingSix = markPass.commands[0].bindGroup.value.entries.find(
    (entry) => entry.binding === 6
  );
  assert.equal(
    markBindingSix.resource.buffer,
    authority.activeSourceViewBuffer
  );
  const paramsWrite = device.writes.find(
    (write) => write.buffer.label ===
      'test-mechanics-view-v2-arena-0-params'
  );
  const params = new Uint32Array(paramsWrite.snapshot);
  assert.equal(params[41], SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2);
  assert.equal(params[42], authority.activeLayout.activeSourceCapacity);
  assert.equal(params[43], authority.activeLayout.wordLength);
  assert.equal(params[44], authority.activeLayout.activeToPhysicalOffsetWords);
  assert.equal(params[45], authority.activeLayout.physicalToActiveOffsetWords);
  assert.equal(params[47], authority.activeSourceView.sourceFingerprint);

  const exactCountAuthority = execution.activeSourceCountAuthority;
  execution.activeSourceCountAuthority = { ...exactCountAuthority };
  assert.equal(runtime.ownsExecution(execution), false);
  assert.throws(
    () => runtime.markExecutionSubmitted(execution),
    /not owned/
  );
  execution.activeSourceCountAuthority = exactCountAuthority;
  assert.equal(runtime.ownsExecution(execution), true);
  assert.equal(runtime.markExecutionSubmitted(execution), true);
  assert.equal(validateSchroederSpatialMechanicsViewDescriptor(
    execution,
    {
      directorySchema: ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
      directoryAbiVersion: SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
      sourceAuthorityVersion: SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
      physicalSourceCount: 1024,
      sourceWorkIdentity:
        SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY
    }
  ).admitted, true);
  const fence = deferred();
  const release = runtime.releaseExecutionAfter(execution, fence.promise);
  assert.equal(runtime.activeExecutionCount(), 1);
  fence.resolve();
  assert.equal(await release, true);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(execution.released, true);
  assert.equal(runtime.destroy(), true);
});

test('stale or tampered directory-v2 lineage is rejected before any GPU work', () => {
  const device = createFakeDevice();
  const runtime = createRuntime(device);
  const authority = createV2Authority(device);
  const retainedBufferCount = device.buffers.length;

  authority.activeSourceView.generationId += 1;
  const staleEncoder = createFakeEncoder();
  assert.throws(
    () => encodeV2(runtime, staleEncoder, authority),
    /exact retained ActiveSourceView authority/
  );
  assert.equal(staleEncoder.events.length, 0);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(device.buffers.length, retainedBufferCount);
  authority.activeSourceView.generationId -= 1;

  const originalActiveBuffer = authority.spatialExecution.activeSourceViewBuffer;
  authority.spatialExecution.activeSourceViewBuffer = device.createBuffer({
    label: 'foreign-active-authority',
    size: authority.activeLayout.byteLength,
    usage: 128 | 256
  });
  const mismatchEncoder = createFakeEncoder();
  assert.throws(
    () => encodeV2(runtime, mismatchEncoder, authority),
    /exact retained ActiveSourceView authority/
  );
  assert.equal(mismatchEncoder.events.length, 0);
  assert.equal(runtime.activeExecutionCount(), 0);
  authority.spatialExecution.activeSourceViewBuffer = originalActiveBuffer;

  const originalCountAuthority =
    authority.spatialExecution.activeSourceCountAuthority;
  authority.spatialExecution.activeSourceCountAuthority = Object.freeze({
    ...originalCountAuthority,
    offsetBytes: originalCountAuthority.offsetBytes + UINT32_BYTES
  });
  const authorityMismatchEncoder = createFakeEncoder();
  assert.throws(
    () => encodeV2(runtime, authorityMismatchEncoder, authority),
    /exact retained ActiveSourceView authority/
  );
  assert.equal(authorityMismatchEncoder.events.length, 0);
  assert.equal(runtime.activeExecutionCount(), 0);
  authority.spatialExecution.activeSourceCountAuthority =
    originalCountAuthority;

  const discardEncoder = createFakeEncoder();
  const execution = encodeV2(runtime, discardEncoder, authority);
  assert.equal(
    execution.activeSourceCountAuthority,
    originalCountAuthority
  );
  assert.equal(runtime.releaseExecution(
    execution,
    { discardedEncoder: true }
  ), true);
  assert.equal(execution.released, true);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.destroy(), true);
});

test('directory-v2 admission requires its fifth storage binding before encoding', () => {
  const device = createFakeDevice();
  device.limits.maxStorageBuffersPerShaderStage = 4;
  const runtime = createRuntime(device);
  const authority = createV2Authority(device);
  const encoder = createFakeEncoder();
  assert.throws(
    () => encodeV2(runtime, encoder, authority),
    /requires five storage bindings/
  );
  assert.equal(encoder.events.length, 0);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.destroy(), true);
});

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_MECHANICS_VIEW_V2 === '1';
const NATIVE_BASE_URL =
  process.env.ULG_MECHANICS_VIEW_V2_BASE_URL || 'https://127.0.0.1:5174/';
const NATIVE_CHROME =
  process.env.ULG_MECHANICS_VIEW_V2_CHROME || '/usr/bin/google-chrome';

test('native Vulkan mechanics view v2 handles sparse high slots and A=0', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_MECHANICS_VIEW_V2=1 for native Vulkan WebGPU'
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: NATIVE_CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    const result = await page.evaluate(async () => {
      let stage = 'request-adapter';
      try {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      stage = 'request-device';
      const device = await adapter.requestDevice();
      stage = 'import-modules';
      const [mechanicsAbi, mechanicsWgsl, epochAbi, activeAbi, runtimeAbi] =
        await Promise.all([
          import('/ulg-gpu-abi/src/schroederSpatialMechanicsView.js'),
          import('/ulg-gpu-abi/src/schroederSpatialMechanicsViewWgsl.js'),
          import('/ulg-gpu-abi/src/schroederSpatialEpoch.js'),
          import('/ulg-gpu-abi/src/schroederSpatialActiveSourceView.js'),
          import('/src/runtime/sph/schroederSpatialMechanicsViewGpu.js')
        ]);
      const compileModule = device.createShaderModule({
        label: 'mechanics-view-v2-native-compile',
        code: mechanicsWgsl.schroederSpatialMechanicsViewV2Wgsl
      });
      stage = 'compile-info';
      const compilation = await compileModule.getCompilationInfo();
      const compilationErrors = compilation.messages
        .filter((message) => message.type === 'error')
        .map(
          (message) => `${message.lineNum}:${message.linePos} ${message.message}`
        );
      if (compilationErrors.length > 0) {
        device.destroy();
        return { status: 'compile-error', compilationErrors };
      }
      const U = GPUBufferUsage;
      const M = GPUMapMode;
      const physicalSourceCount = 1024;
      const activeSourceCapacity = 4;
      const identity = {
        generationId: 7,
        deviceOrdinal: 3,
        laneOrdinal: 5,
        leaseToken: 11,
        sourceFamilyId: 13,
        storageGeneration: 17,
        physicsTick: 19,
        physicsSubstep: 0,
        positionEpoch: 23,
        topologyEpoch: 29,
        chartEpoch: 31,
        levelEpoch: 37,
        supportEpoch: 41,
        buildOrdinal: 43
      };
      const activeLayout = activeAbi.createSchroederSpatialActiveSourceViewLayout({
        physicalSourceCapacity: physicalSourceCount,
        activeSourceCapacity
      });
      const directoryLayout = epochAbi.createSchroederSpatialEpochV2Layout({
        physicalSourceCapacity: physicalSourceCount,
        activeSourceCapacity,
        cellCapacity: activeSourceCapacity
      });
      const sourceFingerprint =
        activeAbi.createSchroederSpatialActiveSourceFingerprint({
          ...identity,
          physicalSourceCount,
          physicalSourceCapacity: physicalSourceCount,
          activeSourceCapacity,
          sourceRowLayoutId:
            mechanicsAbi
              .SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
          sourceRowStrideFloats: 16,
          queryGeometryMode: 1,
          queryChartId: 0,
          queryMinLevel: 0,
          queryMaxLevel: 0,
          queryBaseGridSpacingM: 0.25
        });
      const sourceRows = new Float32Array(physicalSourceCount * 16);
      const activePhysical = [7, 1000];
      const positions = [[0, 0, 0], [0.25, 0, 0]];
      for (let ordinal = 0; ordinal < activePhysical.length; ordinal += 1) {
        const physical = activePhysical[ordinal];
        const row = physical * 16;
        sourceRows[row] = 0;
        sourceRows[row + 1] = 0.25;
        sourceRows[row + 6] = 1;
        sourceRows[row + 10] = 1;
        sourceRows.set(positions[ordinal], row + 12);
        sourceRows[row + 15] = 0;
      }
      const sourceBuffer = device.createBuffer({
        label: 'native-mechanics-v2-source',
        size: sourceRows.byteLength,
        usage: U.STORAGE | U.COPY_DST
      });
      device.queue.writeBuffer(sourceBuffer, 0, sourceRows);

      const signedOrder = (value) =>
        ((value >>> 0) ^ 0x80000000) >>> 0;
      const createGpuAuthority = (
        activeCount,
        { tamperActiveSeal = false } = {}
      ) => {
        const activeWords = new Uint32Array(activeLayout.wordLength);
        activeWords[0] =
          activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC;
        activeWords[1] =
          activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION;
        activeWords[2] =
          activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY
          | activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED;
        [
          identity.generationId,
          identity.deviceOrdinal,
          identity.laneOrdinal,
          identity.leaseToken,
          identity.sourceFamilyId,
          identity.storageGeneration,
          identity.physicsTick,
          identity.physicsSubstep,
          identity.positionEpoch,
          identity.topologyEpoch,
          identity.chartEpoch,
          identity.levelEpoch,
          identity.supportEpoch
        ].forEach((value, index) => {
          activeWords[3 + index] = value;
        });
        activeWords[16] = physicalSourceCount;
        activeWords[17] = physicalSourceCount;
        activeWords[18] = activeCount;
        activeWords[19] = activeSourceCapacity;
        activeWords[20] = physicalSourceCount - activeCount;
        activeWords[23] =
          mechanicsAbi
            .SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0;
        activeWords[24] = 16;
        activeWords[25] = activeLayout.activeToPhysicalOffsetWords;
        activeWords[26] = activeLayout.physicalToActiveOffsetWords;
        activeWords[27] = activeLayout.wordLength;
        activeWords[28] = 64 + activeCount + physicalSourceCount;
        activeWords[29] = identity.buildOrdinal;
        activeWords[30] = identity.buildOrdinal;
        activeWords[31] = sourceFingerprint;
        activeWords[32] = physicalSourceCount;
        activeWords[33] = activeCount;
        activeWords[34] = activeCount;
        activeWords[35] = activeCount;
        activeWords[36] = activeCount === 0 ? 0 : 1001;
        activeWords[37] = 64;
        activeWords[38] = device.limits.maxComputeWorkgroupsPerDimension;
        activeWords[40] = activeLayout.activeDispatchOffsetWords;
        activeWords[41] = activeLayout.candidateDispatchOffsetWords;
        activeWords[42] = activeLayout.physicalDispatchOffsetWords;
        activeWords[43] = activeCount * 27;
        activeWords[44] = activeSourceCapacity * 27;
        activeWords[47] = tamperActiveSeal ? 0 : 0x12345678;
        activeWords[48] = activeCount === 0 ? 0 : 1;
        activeWords[49] = 1;
        activeWords[50] = 1;
        activeWords.fill(
          0xffffffff,
          activeLayout.physicalToActiveOffsetWords,
          activeLayout.wordLength
        );
        for (let ordinal = 0; ordinal < activeCount; ordinal += 1) {
          const physical = activePhysical[ordinal];
          activeWords[
            activeLayout.activeToPhysicalOffsetWords + ordinal
          ] = physical;
          activeWords[
            activeLayout.physicalToActiveOffsetWords + physical
          ] = ordinal;
        }
        const activeSourceViewBuffer = device.createBuffer({
          label: `native-active-source-${activeCount}`,
          size: activeLayout.byteLength,
          usage: U.STORAGE | U.INDIRECT | U.COPY_DST
        });
        device.queue.writeBuffer(activeSourceViewBuffer, 0, activeWords);

        const directory = new Uint32Array(directoryLayout.wordLength);
        directory[0] = epochAbi.SCHROEDER_SPATIAL_EPOCH_MAGIC;
        directory[1] = epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_VERSION;
        directory[2] =
          epochAbi.SCHROEDER_SPATIAL_EPOCH_STATUS_READY
          | epochAbi.SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED;
        [
          identity.generationId,
          identity.deviceOrdinal,
          identity.laneOrdinal,
          identity.leaseToken,
          identity.sourceFamilyId,
          identity.storageGeneration,
          identity.physicsTick,
          identity.physicsSubstep,
          identity.positionEpoch,
          identity.topologyEpoch,
          identity.chartEpoch,
          identity.levelEpoch,
          identity.supportEpoch
        ].forEach((value, index) => {
          directory[3 + index] = value;
        });
        const cellCount = activeCount;
        directory[16] = physicalSourceCount;
        directory[17] = physicalSourceCount;
        directory[18] = cellCount;
        directory[19] = activeSourceCapacity;
        directory[20] =
          48 + cellCount * 5 + cellCount + 1
          + activeCount + physicalSourceCount + 6;
        directory[21] = directory[20];
        directory[22] = directoryLayout.wordLength;
        directory[25] = 5;
        directory[26] = 5;
        directory[27] = 2;
        directory[28] = 48;
        directory[29] = directoryLayout.cellKeysOffsetWords;
        directory[30] = directoryLayout.cellOffsetsOffsetWords;
        directory[31] = directoryLayout.cellMembersOffsetWords;
        directory[32] =
          directoryLayout.physicalToCellPlusOneOffsetWords;
        directory[33] = identity.buildOrdinal;
        directory[34] = identity.buildOrdinal;
        directory[35] = identity.buildOrdinal;
        directory[36] = identity.generationId;
        directory[37] = activeCount;
        directory[38] = cellCount;
        directory[39] = 1;
        directory[41] = 1;
        directory[42] = activeCount === 0 ? 0 : 1;
        directory[43] = activeCount === 0 ? 0 : 1;
        directory[44] = activeCount === 0 ? 0 : 1;
        directory[45] = 67;
        directory[46] =
          epochAbi.SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY;
        directory[47] = directoryLayout.wordLength;
        for (let index = 0; index <= cellCount; index += 1) {
          directory[directoryLayout.cellOffsetsOffsetWords + index] = index;
        }
        for (let ordinal = 0; ordinal < activeCount; ordinal += 1) {
          const physical = activePhysical[ordinal];
          const key = directoryLayout.cellKeysOffsetWords + ordinal * 5;
          directory[key] = 0;
          directory[key + 1] = signedOrder(0);
          directory[key + 2] = signedOrder(ordinal);
          directory[key + 3] = signedOrder(0);
          directory[key + 4] = signedOrder(0);
          directory[directoryLayout.cellMembersOffsetWords + ordinal] =
            physical;
          directory[
            directoryLayout.physicalToCellPlusOneOffsetWords + physical
          ] = ordinal + 1;
        }
        const query = directoryLayout.queryEvidenceCapacityOffsetWords;
        directory[query] = 0;
        directory[query + 1] = 0;
        directory[query + 2] = 0;
        new Float32Array(directory.buffer)[query + 3] = 0.25;
        directory[query + 4] = activeCount === 0 ? 0 : 1;
        const directoryBuffer = device.createBuffer({
          label: `native-directory-v2-${activeCount}`,
          size: directoryLayout.byteLength,
          usage: U.STORAGE | U.COPY_DST
        });
        device.queue.writeBuffer(directoryBuffer, 0, directory);

        let activeSourceView;
        const activeOwnerRuntime = {
          ownsExecution(candidate) {
            return candidate === activeSourceView;
          }
        };
        activeSourceView = {
          schema:
            activeAbi.ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
          status: 'schroeder-spatial-active-source-view-gpu-encoded',
          ready: true,
          selected: true,
          sourceBuffer,
          activeSourceViewBuffer,
          layout: activeLayout,
          physicalSourceCount,
          physicalSourceCapacity: physicalSourceCount,
          activeSourceCapacity,
          sourceRowLayoutId:
            mechanicsAbi
              .SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
          sourceRowStrideFloats: 16,
          ...identity,
          sourceFingerprint,
          queryGeometryMode: 1,
          queryChartId: 0,
          queryMinLevel: 0,
          queryMaxLevel: 0,
          queryBaseGridSpacingM: 0.25,
          activeDispatchOffsetBytes: activeLayout.activeDispatchOffsetBytes,
          candidateDispatchOffsetBytes:
            activeLayout.candidateDispatchOffsetBytes,
          physicalDispatchOffsetBytes:
            activeLayout.physicalDispatchOffsetBytes,
          ownerRuntime: activeOwnerRuntime
        };
        const activeSourceCountAuthority = Object.freeze({
          schema:
            activeAbi.ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
          activeSourceView,
          buffer: activeSourceViewBuffer,
          offsetWords: 18,
          offsetBytes: 18 * Uint32Array.BYTES_PER_ELEMENT,
          capacity: activeSourceCapacity,
          residency: 'gpu-only'
        });
        const exactNearQueryProfile = {
          ready: true,
          sourceAdapterId:
            epochAbi.SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
        };
        let spatialExecution;
        const spatialOwnerRuntime = {
          ownsExecution(candidate) {
            return candidate === spatialExecution;
          }
        };
        spatialExecution = {
          schema: epochAbi.ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
          status: 'schroeder-spatial-epoch-v2-gpu-encoded',
          abiVersion: epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
          submitPerformed: false,
          released: false,
          sourceBuffer,
          sourceCount: physicalSourceCount,
          physicalSourceCount,
          sourceRowLayoutId:
            mechanicsAbi
              .SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
          sourceAdapterId:
            epochAbi.SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
          exactNearQueryProfile,
          queryGeometryEvidence: exactNearQueryProfile,
          queryGeometryMode: 1,
          queryChartId: 0,
          queryMinLevel: 0,
          queryMaxLevel: 0,
          queryBaseGridSpacingM: 0.25,
          queryEvidenceWordCount: 6,
          ...identity,
          directoryBuffer,
          layout: directoryLayout,
          activeSourceView,
          activeSourceViewBuffer,
          activeSourceCountAuthority,
          ownerRuntime: spatialOwnerRuntime
        };
        return {
          activeSourceViewBuffer,
          directoryBuffer,
          activeSourceView,
          spatialExecution
        };
      };

      const runtime = runtimeAbi.createSchroederSpatialMechanicsViewGpu(
        device,
        {
          maxSourceCount: physicalSourceCount,
          gridNodeCount: 512,
          gridDims: [8, 8, 8],
          gridShift: 2,
          gridSpacingM: 0.25,
          arenaCount: 1,
          label: 'native-mechanics-view-v2'
        }
      );
      const runCase = async (
        activeCount,
        { tamperActiveSeal = false } = {}
      ) => {
        stage = `authority-${activeCount}`;
        const authority = createGpuAuthority(
          activeCount,
          { tamperActiveSeal }
        );
        stage = `encode-${activeCount}`;
        device.pushErrorScope('validation');
        const encoder = device.createCommandEncoder();
        const execution = runtime.encode(encoder, {
          sourceBuffer,
          sourceCount: physicalSourceCount,
          sourceRowLayoutId:
            mechanicsAbi
              .SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
          selectedLevel: 0,
          spatialExecution: authority.spatialExecution
        });
        const readback = device.createBuffer({
          label: `native-mechanics-view-readback-${activeCount}`,
          size: execution.layout.byteLength,
          usage: U.COPY_DST | U.MAP_READ
        });
        encoder.copyBufferToBuffer(
          execution.mechanicsViewBuffer,
          0,
          readback,
          0,
          execution.layout.byteLength
        );
        stage = `submit-${activeCount}`;
        device.queue.submit([encoder.finish()]);
        const validationError = await device.popErrorScope();
        if (validationError) {
          throw new Error(
            `native mechanics v2 validation: ${validationError.message}`
          );
        }
        runtime.markExecutionSubmitted(execution);
        const fence = device.queue.onSubmittedWorkDone();
        const release = runtime.releaseExecutionAfter(execution, fence);
        stage = `fence-${activeCount}`;
        await fence;
        stage = `map-${activeCount}`;
        await readback.mapAsync(M.READ);
        const words = new Uint32Array(readback.getMappedRange()).slice();
        readback.unmap();
        readback.destroy();
        await release;
        stage = `cleanup-${activeCount}`;
        authority.activeSourceViewBuffer.destroy();
        authority.directoryBuffer.destroy();
        return {
          statusFlags: words[22],
          physicalSourceCount: words[36],
          nodeCount: words[46],
          invalidSourceCount: words[47],
          attemptedSourceCount: words[49],
          selectedSourceCount: words[50],
          dispatch: Array.from(words.slice(60, 63))
        };
      };
      stage = 'run-sparse';
      const sparse = await runCase(2);
      stage = 'run-dormant';
      const dormant = await runCase(0);
      stage = 'run-tampered-seal';
      const tamperedSeal = await runCase(
        2,
        { tamperActiveSeal: true }
      );
      stage = 'destroy';
      runtime.destroy();
      sourceBuffer.destroy();
      device.destroy();
      return {
        status: 'ok',
        sparse,
        dormant,
        tamperedSeal
      };
      } catch (error) {
        return {
          status: 'exception',
          stage,
          name: error?.name ?? null,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null
        };
      }
    });
    assert.notEqual(result.status, 'unsupported', result.reason);
    assert.equal(
      result.status,
      'ok',
      JSON.stringify(result.compilationErrors || result)
    );
    assert.equal(result.sparse.statusFlags, 3);
    assert.equal(result.sparse.physicalSourceCount, 1024);
    assert.equal(result.sparse.invalidSourceCount, 0);
    assert.equal(result.sparse.attemptedSourceCount, 2);
    assert.equal(result.sparse.selectedSourceCount, 2);
    assert.ok(result.sparse.nodeCount > 0);
    assert.ok(result.sparse.dispatch[0] > 0);
    assert.deepEqual(result.dormant, {
      statusFlags: 3,
      physicalSourceCount: 1024,
      nodeCount: 0,
      invalidSourceCount: 0,
      attemptedSourceCount: 0,
      selectedSourceCount: 0,
      dispatch: [0, 0, 0]
    });
    assert.deepEqual(result.tamperedSeal, {
      statusFlags: 12,
      physicalSourceCount: 1024,
      nodeCount: 0,
      invalidSourceCount: 2,
      attemptedSourceCount: 0,
      selectedSourceCount: 0,
      dispatch: [0, 0, 0]
    });
  } finally {
    await browser.close();
  }
});
