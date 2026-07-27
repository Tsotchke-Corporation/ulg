import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_CAPACITY_OVERFLOW,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_INVALID_SOURCE,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION,
  createSchroederSpatialActiveSourceFingerprint,
  createSchroederSpatialActiveSourceViewLayout,
  validateSchroederSpatialActiveSourceViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialActiveSourceView.js';
import {
  createSchroederSpatialActiveSourceViewWgsl
} from '../ulg-gpu-abi/src/schroederSpatialActiveSourceViewWgsl.js';
import {
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  createSchroederSpatialActiveSourceViewGpu
} from '../src/runtime/sph/schroederSpatialActiveSourceViewGpu.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_ACTIVE_SOURCE_VIEW === '1';
const NATIVE_BASE_URL = process.env.ULG_ACTIVE_SOURCE_VIEW_BASE_URL
  || 'https://127.0.0.1:5174/';

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
      return {
        setPipeline(pipeline) { event.pipeline = pipeline; },
        setBindGroup(index, bindGroup) { event.bindGroup = { index, bindGroup }; },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({ dispatch: [x, y, z] });
        },
        dispatchWorkgroupsIndirect(buffer, byteOffset = 0) {
          event.commands.push({ dispatchIndirect: { buffer, byteOffset } });
        },
        end() { event.ended = true; }
      };
    },
    finish() { return { events }; }
  };
}

function createFakeDevice({ limits: limitOverrides = {} } = {}) {
  const buffers = [];
  const writes = [];
  const bindGroups = [];
  return {
    buffers,
    writes,
    bindGroups,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxComputeWorkgroupsPerDimension: 64,
      minUniformBufferOffsetAlignment: 256,
      ...limitOverrides
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({
          buffer,
          offset,
          data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice()
        });
      },
      submit() {},
      onSubmittedWorkDone() { return Promise.resolve(); }
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
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) {
          return { label: descriptor.label, index };
        }
      };
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    }
  };
}

function cpuActiveProjection(rows, activeCapacity) {
  const flags = rows.map((row) => {
    const geometry = row.slice(2, 7);
    const dormant = geometry.every((value) => Object.is(value, 0));
    const active = Number.isFinite(row[2])
      && Number.isFinite(row[3])
      && Number.isFinite(row[4])
      && Number.isFinite(row[5])
      && Number.isFinite(row[6])
      && row[2] >= 0
      && row[3] >= 0
      && row[4] > 0
      && row[5] > 0
      && row[6] > 0
      && row[7] > 0
      && Number.isInteger(row[10])
      && (row[10] & 31) > 0
      && (row[10] & 192) === 0;
    if (active) return 1;
    if (dormant) return 0;
    return -1;
  });
  const invalidCount = flags.filter((flag) => flag < 0).length;
  const activeToPhysical = flags.flatMap((flag, index) => flag === 1 ? [index] : []);
  const overflow = activeToPhysical.length > activeCapacity;
  const physicalToActive = Array(rows.length).fill(
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL
  );
  if (!invalidCount && !overflow) {
    activeToPhysical.forEach((physical, active) => {
      physicalToActive[physical] = active;
    });
  }
  return {
    activeToPhysical: invalidCount || overflow ? [] : activeToPhysical,
    physicalToActive,
    requiredActiveCount: activeToPhysical.length,
    invalidCount,
    overflow
  };
}

function levelRow({ active = false, invalid = false, index = 0 } = {}) {
  return [
    0,
    0.25,
    active ? 0.1 : 0,
    active ? 0.001 : 0,
    active ? 0.001 : 0,
    active ? 0.001 : 0,
    active ? 1 : 0,
    1000,
    1,
    7,
    invalid ? 0 : 1,
    0,
    index * 0.01,
    0,
    0,
    0
  ];
}

test('active-source v1 ABI uses a 64-word header and asymmetric compact maps', () => {
  const layout = createSchroederSpatialActiveSourceViewLayout({
    physicalSourceCapacity: 16,
    activeSourceCapacity: 4
  });
  assert.equal(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_LAYOUT.length, 64);
  assert.equal(layout.headerWords, 64);
  assert.equal(layout.activeToPhysicalOffsetWords, 64);
  assert.equal(layout.physicalToActiveOffsetWords, 68);
  assert.equal(layout.wordLength, 84);
  assert.equal(layout.activeCandidateCapacity, 108);
  assert.equal(
    layout.activeDispatchOffsetWords,
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS
  );
  assert.equal(
    layout.candidateDispatchOffsetWords,
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS
  );
  assert.equal(
    layout.physicalDispatchOffsetWords,
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS
  );
  assert.throws(
    () => createSchroederSpatialActiveSourceViewLayout({
      physicalSourceCapacity: 4,
      activeSourceCapacity: 5
    }),
    /activeSourceCapacity/
  );
});

test('CPU reference preserves sparse physical order and fails closed on invalid or overflow', () => {
  const live = new Set([0, 5, 11, 15]);
  const rows = Array.from(
    { length: 16 },
    (_, index) => levelRow({ active: live.has(index), index })
  );
  const sparse = cpuActiveProjection(rows, 4);
  assert.deepEqual(sparse.activeToPhysical, [0, 5, 11, 15]);
  assert.deepEqual(
    sparse.physicalToActive,
    [
      0,
      ...Array(4).fill(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL),
      1,
      ...Array(5).fill(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL),
      2,
      ...Array(3).fill(SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL),
      3
    ]
  );
  const invalidRows = rows.map((row) => [...row]);
  invalidRows[5][10] = 0;
  assert.deepEqual(cpuActiveProjection(invalidRows, 4), {
    activeToPhysical: [],
    physicalToActive: Array(16).fill(
      SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL
    ),
    requiredActiveCount: 3,
    invalidCount: 1,
    overflow: false
  });
  const overflowRows = Array.from(
    { length: 8 },
    (_, index) => levelRow({ active: index < 5, index })
  );
  const overflow = cpuActiveProjection(overflowRows, 4);
  assert.equal(overflow.requiredActiveCount, 5);
  assert.equal(overflow.overflow, true);
  assert.deepEqual(overflow.activeToPhysical, []);
});

test('WGSL uses scalable scan inputs, stable scatter, exact row admission, and 2D linearization', () => {
  const wgsl = createSchroederSpatialActiveSourceViewWgsl(
    createSchroederSpatialActiveSourceViewLayout({
      physicalSourceCapacity: 20_000,
      activeSourceCapacity: 4_500
    })
  );
  assert.match(wgsl, /fn classify_active_sources/);
  assert.match(wgsl, /fn scatter_active_sources/);
  assert.match(wgsl, /fn finalize_active_source_view/);
  assert.match(wgsl, /active_prefix\[source_index\]/);
  assert.match(wgsl, /VIEW_ACTIVE_TO_PHYSICAL_OFFSET \+ active_ordinal/);
  assert.match(wgsl, /VIEW_PHYSICAL_TO_ACTIVE_OFFSET \+ source_index/);
  assert.match(wgsl, /workgroup_id\.y \* dispatch_x/);
  assert.match(wgsl, /bitcast<u32>\(native_spacing\) == bitcast<u32>\(expected_spacing\)/);
  assert.match(wgsl, /bitcast<u32>\(mass\) == 0u/);
  assert.match(wgsl, /required_count > VIEW_ACTIVE_CAPACITY/);
  assert.match(wgsl, /STATUS_CAPACITY_OVERFLOW/);
  assert.doesNotMatch(wgsl, /let active\s*=/);
  assert.doesNotMatch(wgsl, /8192/);
});

test('retained runtime accepts 20k physical rows with a 4.5k active tier and emits 2D passes', () => {
  const device = createFakeDevice();
  const runtime = createSchroederSpatialActiveSourceViewGpu(device, {
    maxPhysicalSourceCount: 20_000,
    activeSourceCapacity: 4_500,
    arenaCount: 1,
    label: 'active-source-large-test'
  });
  const sourceBuffer = device.createBuffer({
    label: 'active-source-large-input',
    size: 20_000 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const encoder = createFakeEncoder();
  const execution = runtime.encode(encoder, {
    sourceBuffer,
    physicalSourceCount: 20_000,
    generationId: 3,
    storageGeneration: 5,
    buildOrdinal: 7,
    exactNearQueryProfile: {
      ready: true,
      chartId: 0,
      minLevel: 0,
      maxLevel: 0,
      baseGridSpacingM: 0.25
    }
  });
  assert.deepEqual(execution.classifyDispatchWorkgroups, [64, 5, 1]);
  assert.deepEqual(execution.scatterDispatchWorkgroups, [64, 5, 1]);
  assert.equal(execution.physicalSourceCount, 20_000);
  assert.equal(execution.activeSourceCapacity, 4_500);
  assert.ok(execution.encodedDispatchCount > 4);
  assert.equal(execution.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(runtime.ownsExecution(execution), true);
  assert.equal(validateSchroederSpatialActiveSourceViewDescriptor(execution, {
    sourceBuffer,
    physicalSourceCount: 20_000,
    activeSourceCapacity: 4_500,
    sourceFingerprint: execution.sourceFingerprint
  }).admitted, true);
  assert.equal(runtime.releaseExecution(execution, { discardedEncoder: true }), true);
  assert.equal(runtime.destroy(), true);
});

test('source fingerprint authenticates the immutable epoch and exact query profile', () => {
  const base = {
    generationId: 1,
    deviceOrdinal: 2,
    laneOrdinal: 3,
    leaseToken: 4,
    sourceFamilyId: 5,
    storageGeneration: 6,
    physicsTick: 7,
    physicsSubstep: 8,
    positionEpoch: 9,
    topologyEpoch: 10,
    chartEpoch: 11,
    levelEpoch: 12,
    supportEpoch: 13,
    physicalSourceCount: 16,
    physicalSourceCapacity: 16,
    activeSourceCapacity: 4,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceRowStrideFloats: 16,
    buildOrdinal: 14,
    queryGeometryMode: 1,
    queryChartId: 0,
    queryMinLevel: -1,
    queryMaxLevel: 1,
    queryBaseGridSpacingM: 0.25
  };
  const fingerprint = createSchroederSpatialActiveSourceFingerprint(base);
  assert.equal(fingerprint, createSchroederSpatialActiveSourceFingerprint(base));
  assert.notEqual(
    fingerprint,
    createSchroederSpatialActiveSourceFingerprint({
      ...base,
      supportEpoch: base.supportEpoch + 1
    })
  );
});

test('native ActiveSourceView classifies sparse, large, invalid, and overflow projections', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_ACTIVE_SOURCE_VIEW=1 for native Vulkan WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_ACTIVE_SOURCE_VIEW_CHROME
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
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const deviceLimits = await import('/src/runtime/webgpuDeviceLimits.js');
      const runtimeModule = await import(
        `/src/runtime/sph/schroederSpatialActiveSourceViewGpu.js?native=${Date.now()}`
      );
      const abi = await import(
        `/ulg-gpu-abi/src/schroederSpatialActiveSourceView.js?native=${Date.now()}`
      );
      const device = await adapter.requestDevice(
        deviceLimits.webGpuDeviceDescriptorForResidentSph(adapter)
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');

      const profile = {
        ready: true,
        chartId: 0,
        minLevel: 0,
        maxLevel: 0,
        baseGridSpacingM: 0.25
      };
      const makeRows = (count, liveIndices, invalidIndex = -1) => {
        const live = new Set(liveIndices);
        const rows = new Float32Array(count * 16);
        for (let index = 0; index < count; index += 1) {
          const activeRow = live.has(index);
          rows.set([
            0,
            0.25,
            activeRow ? 0.1 : 0,
            activeRow ? 0.001 : 0,
            activeRow ? 0.001 : 0,
            activeRow ? 0.001 : 0,
            activeRow ? 1 : 0,
            1000,
            1,
            7,
            index === invalidIndex ? 0 : 1,
            0,
            index * 0.01,
            0,
            0,
            0
          ], index * 16);
        }
        return rows;
      };
      const run = async ({
        physicalCount,
        activeCapacity,
        liveIndices,
        invalidIndex = -1,
        label
      }) => {
        const rows = makeRows(physicalCount, liveIndices, invalidIndex);
        const source = device.createBuffer({
          label: `${label}-source`,
          size: rows.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(source, 0, rows);
        const runtime = runtimeModule.createSchroederSpatialActiveSourceViewGpu(
          device,
          {
            maxPhysicalSourceCount: physicalCount,
            activeSourceCapacity: activeCapacity,
            arenaCount: 1,
            label
          }
        );
        const encoder = device.createCommandEncoder({ label: `${label}-encoder` });
        const execution = runtime.encode(encoder, {
          sourceBuffer: source,
          physicalSourceCount: physicalCount,
          generationId: 1,
          storageGeneration: 1,
          buildOrdinal: 1,
          exactNearQueryProfile: profile
        });
        const readback = device.createBuffer({
          label: `${label}-readback`,
          size: execution.layout.byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        encoder.copyBufferToBuffer(
          execution.activeSourceViewBuffer,
          0,
          readback,
          0,
          execution.layout.byteLength
        );
        device.queue.submit([encoder.finish()]);
        runtime.markExecutionSubmitted(execution);
        const fence = device.queue.onSubmittedWorkDone();
        await readback.mapAsync(GPUMapMode.READ);
        const words = new Uint32Array(readback.getMappedRange()).slice();
        readback.unmap();
        await runtime.releaseExecutionAfter(execution, fence);
        runtime.destroy();
        source.destroy();
        readback.destroy();
        return {
          words: Array.from(words),
          layout: execution.layout
        };
      };

      const sparse = await run({
        physicalCount: 16,
        activeCapacity: 4,
        liveIndices: [0, 5, 11, 15],
        label: 'native-active-source-sparse'
      });
      const largeLive = Array.from({ length: 4_500 }, (_, index) => index * 4);
      const large = await run({
        physicalCount: 20_000,
        activeCapacity: 4_500,
        liveIndices: largeLive,
        label: 'native-active-source-large'
      });
      const invalid = await run({
        physicalCount: 8,
        activeCapacity: 8,
        liveIndices: [0, 2],
        invalidIndex: 2,
        label: 'native-active-source-invalid'
      });
      const overflow = await run({
        physicalCount: 8,
        activeCapacity: 4,
        liveIndices: [0, 1, 2, 3, 4],
        label: 'native-active-source-overflow'
      });

      const outOfMemoryError = await device.popErrorScope();
      const internalError = await device.popErrorScope();
      const validationError = await device.popErrorScope();
      device.destroy();
      return {
        status: 'ok',
        sparse,
        large: {
          ...large,
          words: [
            ...large.words.slice(0, 64),
            ...large.words.slice(
              large.layout.activeToPhysicalOffsetWords,
              large.layout.activeToPhysicalOffsetWords + 4_500
            )
          ]
        },
        invalid,
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

  if (native.status === 'unsupported') {
    assert.fail(native.reason);
  }
  assert.equal(native.status, 'ok');
  assert.deepEqual(native.errors, []);
  const sparse = native.sparse;
  assert.equal(sparse.words[0], SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC);
  assert.equal(sparse.words[1], SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION);
  assert.equal(
    sparse.words[2],
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY
      | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED
  );
  assert.equal(sparse.words[18], 4);
  assert.equal(sparse.words[20], 12);
  assert.deepEqual(
    sparse.words.slice(
      sparse.layout.activeToPhysicalOffsetWords,
      sparse.layout.activeToPhysicalOffsetWords + 4
    ),
    [0, 5, 11, 15]
  );
  const sparseReverse = sparse.words.slice(
    sparse.layout.physicalToActiveOffsetWords,
    sparse.layout.physicalToActiveOffsetWords + 16
  );
  assert.equal(sparseReverse[0], 0);
  assert.equal(sparseReverse[5], 1);
  assert.equal(sparseReverse[11], 2);
  assert.equal(sparseReverse[15], 3);
  assert.equal(sparseReverse[1], SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL);

  assert.equal(native.large.words[18], 4_500);
  assert.deepEqual(
    native.large.words.slice(64, 64 + 4_500),
    Array.from({ length: 4_500 }, (_, index) => index * 4)
  );

  assert.equal(
    native.invalid.words[2]
      & (
        SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_FAIL_CLOSED
        | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_INVALID_SOURCE
      ),
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_FAIL_CLOSED
      | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_INVALID_SOURCE
  );
  assert.equal(native.invalid.words[18], 0);
  for (const offset of [
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS,
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS,
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS
  ]) {
    assert.deepEqual(native.invalid.words.slice(offset, offset + 3), [0, 0, 0]);
  }

  assert.equal(
    native.overflow.words[2]
      & (
        SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_FAIL_CLOSED
        | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_CAPACITY_OVERFLOW
      ),
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_FAIL_CLOSED
      | SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_CAPACITY_OVERFLOW
  );
  assert.equal(native.overflow.words[18], 0);
  assert.equal(native.overflow.words[22], 1);
  assert.equal(native.overflow.words[46], 5);
  for (const offset of [
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_ACTIVE_DISPATCH_OFFSET_WORDS,
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_CANDIDATE_DISPATCH_OFFSET_WORDS,
    SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_PHYSICAL_DISPATCH_OFFSET_WORDS
  ]) {
    assert.deepEqual(native.overflow.words.slice(offset, offset + 3), [0, 0, 0]);
  }
});
