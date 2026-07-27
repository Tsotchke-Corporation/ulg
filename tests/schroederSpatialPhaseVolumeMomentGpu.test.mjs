import assert from 'node:assert/strict';
import test from 'node:test';

import * as publicGpuAbi from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS,
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA,
  createSchroederSpatialPhaseVolumeMomentLayout,
  createSchroederSpatialPhaseVolumeMomentPlan,
  resolveSchroederRawCurrentVolumeM3,
  schroederQuadraticSplineAxis,
  validateSchroederSpatialPhaseVolumeMomentDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeMoment.js';
import {
  createSchroederSpatialPhaseVolumeMomentWgsl
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeMomentWgsl.js';
import {
  createSchroederSpatialMechanicsFieldViewPlan
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  createSchroederSpatialPhaseVolumeMomentGpu
} from '../src/runtime/sph/schroederSpatialPhaseVolumeMomentGpu.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PHASE_VOLUME_MOMENT === '1';
const RUN_NATIVE_RECEIPT_PERF =
  process.env.ULG_RUN_NATIVE_PHASE_VOLUME_RECEIPT_PERF === '1';
const NATIVE_BASE_URL = process.env.ULG_PHASE_VOLUME_MOMENT_BASE_URL
  || 'https://127.0.0.1:5174/';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

function createFakeDevice() {
  const createdBuffers = [];
  const shaderModules = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  const lost = deferred();
  const device = {
    lost: lost.promise,
    limits: {
      maxStorageBuffersPerShaderStage: 8,
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 256 * 1024 * 1024,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, data });
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyCount: 0,
        get destroyed() { return this.destroyCount > 0; },
        destroy() { this.destroyCount += 1; }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      const module = { descriptor };
      shaderModules.push(module);
      return module;
    },
    createComputePipeline(descriptor) {
      const pipeline = {
        descriptor,
        getBindGroupLayout() { return { entryPoint: descriptor.compute.entryPoint }; }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      const group = { descriptor };
      bindGroups.push(group);
      return group;
    }
  };
  return {
    device,
    createdBuffers,
    shaderModules,
    pipelines,
    bindGroups,
    writes,
    resolveLost: lost.resolve
  };
}

function createFakeEncoder() {
  const clears = [];
  const passes = [];
  return {
    clears,
    passes,
    clearBuffer(buffer) { clears.push(buffer); },
    beginComputePass(descriptor = {}) {
      const pass = {
        descriptor,
        pipeline: null,
        bindGroup: null,
        dispatch: null,
        indirect: null,
        ended: false,
        setPipeline(value) { this.pipeline = value; },
        setBindGroup(index, value) { this.bindGroup = { index, value }; },
        dispatchWorkgroups(...value) { this.dispatch = value; },
        dispatchWorkgroupsIndirect(buffer, offset) { this.indirect = { buffer, offset }; },
        end() { this.ended = true; }
      };
      passes.push(pass);
      return pass;
    }
  };
}

function taggedBuffer(device, label, size) {
  return tagWebGpuBufferDevice({
    label,
    size,
    destroyCount: 0,
    destroy() { this.destroyCount += 1; }
  }, device);
}

function createMechanicsFieldAuthority(device, {
  sourceCount = 2,
  sourceCapacity = 4,
  selectedLevel = 0
} = {}) {
  const sourceBuffer = taggedBuffer(
    device,
    'phase-volume-source-assignment',
    sourceCount * 16 * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceMechanicsBuffer = taggedBuffer(
    device,
    'phase-volume-source-mechanics',
    sourceCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const plan = createSchroederSpatialMechanicsFieldViewPlan({
    sourceCount,
    sourceCapacity,
    sourceRowLayoutId: 1,
    identityStrideWords: 1,
    selectedLevel,
    gridNodeCount: 8,
    gridDims: [2, 2, 2],
    gridShift: 1,
    gridSpacingM: 0.25,
    generationId: 31,
    deviceOrdinal: 5,
    laneOrdinal: 7,
    leaseToken: 11,
    sourceFamilyId: 13,
    storageGeneration: 17,
    physicsTick: 19,
    physicsSubstep: 0,
    positionEpoch: 23,
    topologyEpoch: 29,
    chartEpoch: 37,
    levelEpoch: 41,
    supportEpoch: 43,
    completionOrdinal: 47
  });
  const fieldViewBuffer = taggedBuffer(
    device,
    'phase-volume-mechanics-field',
    plan.layout.byteLength
  );
  const stableCandidateOrderBuffer = taggedBuffer(
    device,
    'phase-volume-stable-candidate-order',
    plan.candidateCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const field = {
    ...plan,
    status: 'schroeder-spatial-mechanics-field-view-gpu-encoded',
    submitPerformed: false,
    released: false,
    sourceBuffer,
    fieldViewBuffer,
    indirectDispatchBuffer: fieldViewBuffer,
    indirectDispatchOffsetBytes: 240,
    stableCandidateOrderBuffer,
    stableCandidateOrderCount: plan.candidateCount
  };
  Object.defineProperty(field, 'ownerRuntime', {
    value: { ownsExecution: (candidate) => candidate === field },
    enumerable: false
  });
  return { sourceBuffer, sourceMechanicsBuffer, field, plan };
}

test('strict raw V0J oracle and quadratic 27-stencil moments conserve volume', () => {
  assert.equal(resolveSchroederRawCurrentVolumeM3({ restVolumeM3: 3, volumeRatioJ: 2 }), 6);
  for (const [restVolumeM3, volumeRatioJ] of [
    [0, 2],
    [-1, 2],
    [2, 0],
    [2, -1],
    [Number.NaN, 1],
    [1, Number.POSITIVE_INFINITY],
    [3.4e38, 3.4e38]
  ]) {
    assert.equal(resolveSchroederRawCurrentVolumeM3({ restVolumeM3, volumeRatioJ }), null);
  }
  const spacing = 0.25;
  const axes = [
    schroederQuadraticSplineAxis(0.21, spacing),
    schroederQuadraticSplineAxis(0.57, spacing),
    schroederQuadraticSplineAxis(0.83, spacing)
  ];
  for (const axis of axes) {
    assert.ok(Math.abs(axis.weights.reduce((sum, value) => sum + value, 0) - 1) < 1e-6);
    assert.ok(Math.abs(axis.gradientsPerM.reduce((sum, value) => sum + value, 0)) < 1e-6);
  }
  const volume = resolveSchroederRawCurrentVolumeM3({ restVolumeM3: 3, volumeRatioJ: 2 });
  const moment = [0, 0, 0, 0];
  for (let x = 0; x < 3; x += 1) {
    for (let y = 0; y < 3; y += 1) {
      for (let z = 0; z < 3; z += 1) {
        const wx = axes[0].weights[x];
        const wy = axes[1].weights[y];
        const wz = axes[2].weights[z];
        moment[0] += volume * wx * wy * wz;
        moment[1] += volume * axes[0].gradientsPerM[x] * wy * wz;
        moment[2] += volume * wx * axes[1].gradientsPerM[y] * wz;
        moment[3] += volume * wx * wy * axes[2].gradientsPerM[z];
      }
    }
  }
  assert.ok(Math.abs(moment[0] - volume) < 1e-5);
  assert.ok(Math.abs(moment[1]) < 1e-5);
  assert.ok(Math.abs(moment[2]) < 1e-5);
  assert.ok(Math.abs(moment[3]) < 1e-5);
});

test('phase-volume moment ABI keeps a separate bounded scratch arena and strict shader contract', () => {
  assert.equal(
    publicGpuAbi.createSchroederSpatialPhaseVolumeMomentLayout,
    createSchroederSpatialPhaseVolumeMomentLayout
  );
  assert.equal(
    publicGpuAbi.createSchroederSpatialPhaseVolumeMomentWgsl,
    createSchroederSpatialPhaseVolumeMomentWgsl
  );
  const layout = createSchroederSpatialPhaseVolumeMomentLayout({
    sourceCapacity: 4,
    fieldCapacity: 17
  });
  assert.equal(layout.controlWords, SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_HEADER_WORDS);
  assert.equal(layout.momentRowWords, SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS);
  assert.equal(layout.candidateCapacity, 108);
  assert.equal(layout.fieldRangeOffsetWords, layout.candidateCapacity);
  assert.equal(layout.scratchWords, layout.candidateCapacity + layout.fieldRangeWords);
  const plan = createSchroederSpatialPhaseVolumeMomentPlan({
    sourceCount: 2,
    sourceCapacity: 4,
    fieldCapacity: 17,
    selectedLevel: -1,
    gridNodeCount: 8,
    gridSpacingM: 0.25,
    generationId: 3,
    deviceOrdinal: 5,
    laneOrdinal: 7,
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
    completionOrdinal: 43
  });
  assert.equal(plan.candidateCapacity, 108);
  assert.equal(plan.candidateCount, 54);
  assert.equal(plan.rawVolumeRatioJMechanicsWord, 18);
  assert.equal(plan.rawRestVolumeMechanicsWord, 19);
  const wgsl = createSchroederSpatialPhaseVolumeMomentWgsl(layout);
  for (const entryPoint of [
    'emit_phase_volume_moment_contributions',
    'materialize_phase_volume_moment_ranges',
    'reduce_phase_volume_moments',
    'finalize_phase_volume_moments'
  ]) assert.match(wgsl, new RegExp(`fn ${entryPoint}`));
  assert.match(wgsl, /mechanics_rows\[mechanics_offset \+ RAW_VOLUME_RATIO_J_WORD\]/);
  assert.match(wgsl, /mechanics_rows\[mechanics_offset \+ RAW_REST_VOLUME_WORD\]/);
  assert.match(wgsl, /@binding\(2\) var<storage, read> mechanics_field/);
  assert.match(
    wgsl,
    /fn mechanics_field_dispatch_shape_admitted\(field_count: u32\)[\s\S]*dispatch_y == expected_y[\s\S]*mechanics_field\[44u\] == dispatch_x[\s\S]*mechanics_field\[45u\] == dispatch_y[\s\S]*mechanics_field\[46u\] == dispatch_z/
  );
  assert.doesNotMatch(
    wgsl,
    /mechanics_field\[60u\] == group_count[\s\S]*mechanics_field\[61u\] == 1u[\s\S]*mechanics_field\[62u\] == 1u/
  );
  assert.match(wgsl, /MOMENT_STATUS_FAIL_CLOSED/);
  assert.doesNotMatch(wgsl, /rest_density|phase_volume_reference|render_radius/i);
  assert.doesNotMatch(wgsl, /candidate_field_indices|field_ranges/);
});

test('phase-volume moment runtime preserves exact field provenance and caller-owned submission', async () => {
  const tracker = createFakeDevice();
  const authority = createMechanicsFieldAuthority(tracker.device);
  const runtime = createSchroederSpatialPhaseVolumeMomentGpu(tracker.device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity,
    arenaCount: 2
  });
  assert.equal(runtime.schema, ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA);
  assert.equal(runtime.pipelineCount, 4);
  const createdBeforeEncode = tracker.createdBuffers.length;
  const encoder = createFakeEncoder();
  const execution = runtime.encode(encoder, {
    sourceBuffer: authority.sourceBuffer,
    sourceMechanicsBuffer: authority.sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    mechanicsFieldView: authority.field
  });
  assert.equal(tracker.createdBuffers.length, createdBeforeEncode);
  assert.equal(execution.status, 'schroeder-spatial-phase-volume-moment-gpu-encoded');
  assert.equal(execution.encodedComputePassCount, 4);
  assert.equal(execution.encodedDispatchCount, 4);
  assert.equal(execution.readbackPerformed, false);
  assert.equal(execution.fullParticleReadbackPerformed, false);
  assert.equal(execution.diagnosticOnly, true);
  assert.equal(execution.stateMutationAllowed, false);
  assert.equal(encoder.clears.length, 3);
  assert.equal(encoder.passes.length, 4);
  assert.deepEqual(encoder.passes[0].dispatch, [1, 1, 1]);
  assert.deepEqual(encoder.passes[1].dispatch, [1, 1, 1]);
  assert.deepEqual(encoder.passes[2].dispatch, [2, 1, 1]);
  assert.equal(encoder.passes[2].indirect, null);
  assert.deepEqual(encoder.passes[3].dispatch, [1, 1, 1]);
  assert.deepEqual(
    tracker.bindGroups.map(({ descriptor }) => descriptor.entries.map(({ binding }) => binding)),
    [[0, 1, 2, 3, 4, 5, 6, 8], [2, 5, 6, 8], [2, 4, 5, 6, 7, 8], [2, 6, 8]]
  );
  const paramsWrite = tracker.writes.at(-1);
  const params = new DataView(paramsWrite.data);
  assert.equal(params.getUint32(0, true), authority.field.sourceCount);
  assert.equal(params.getUint32(96, true), 18);
  assert.equal(params.getUint32(100, true), 19);
  assert.equal(validateSchroederSpatialPhaseVolumeMomentDescriptor(execution).admitted, true);
  assert.equal(runtime.ownsExecution(execution), true);
  assert.equal(runtime.markExecutionSubmitted(execution), true);
  assert.equal(validateSchroederSpatialPhaseVolumeMomentDescriptor(execution).admitted, true);
  assert.equal(await runtime.releaseExecutionAfter(execution, Promise.resolve()), true);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(authority.sourceMechanicsBuffer.destroyCount, 0);
  assert.equal(runtime.destroy(), true);
});

test('phase-volume moment rejects missing borrowed provenance and enforces arena release discipline', () => {
  const tracker = createFakeDevice();
  const authority = createMechanicsFieldAuthority(tracker.device);
  const runtime = createSchroederSpatialPhaseVolumeMomentGpu(tracker.device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity,
    arenaCount: 1
  });
  const encode = (overrides = {}) => runtime.encode(createFakeEncoder(), {
    sourceBuffer: authority.sourceBuffer,
    sourceMechanicsBuffer: authority.sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    mechanicsFieldView: authority.field,
    ...overrides
  });
  assert.throws(
    () => encode({ sourceMechanicsBufferBorrowed: false }),
    /exact borrowed mechanics source/
  );
  const foreignTracker = createFakeDevice();
  assert.throws(
    () => encode({ sourceMechanicsBuffer: taggedBuffer(foreignTracker.device, 'foreign-mechanics', 256) }),
    /mechanics source buffer/
  );
  const execution = encode();
  assert.throws(
    () => encode(),
    (error) => error.code === 'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_ARENA_EXHAUSTED'
  );
  assert.throws(() => runtime.releaseExecution(execution), /discardedEncoder/);
  assert.equal(runtime.releaseExecution(execution, { discardedEncoder: true }), true);
  assert.equal(runtime.destroy(), true);
});

test('phase-volume moment device-loss retirement destroys only owned sidecar buffers', async () => {
  const tracker = createFakeDevice();
  const authority = createMechanicsFieldAuthority(tracker.device);
  const runtime = createSchroederSpatialPhaseVolumeMomentGpu(tracker.device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity,
    arenaCount: 1
  });
  const execution = runtime.encode(createFakeEncoder(), {
    sourceBuffer: authority.sourceBuffer,
    sourceMechanicsBuffer: authority.sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    mechanicsFieldView: authority.field
  });
  runtime.markExecutionSubmitted(execution);
  const unresolvedFence = deferred();
  const normalRelease = runtime.releaseExecutionAfter(execution, unresolvedFence.promise);
  const lossRelease = runtime.quarantineExecutionAfterDeviceLoss(execution);
  tracker.resolveLost({ reason: 'destroyed', message: 'test loss' });
  assert.equal(await lossRelease, true);
  assert.equal(execution.released, true);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.ok(runtime.allocationEntries().every((entry) => entry.buffer.destroyCount === 1));
  assert.equal(authority.sourceBuffer.destroyCount, 0);
  assert.equal(authority.sourceMechanicsBuffer.destroyCount, 0);
  assert.equal(authority.field.fieldViewBuffer.destroyCount, 0);
  unresolvedFence.resolve();
  assert.equal(await normalRelease, true);
});

test('native phase-volume sidecar conserves strict V0J and fails closed for invalid J', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_VOLUME_MOMENT=1 for native WebGPU readback',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_VOLUME_MOMENT_CHROME
      || '/usr/bin/google-chrome',
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
    await page.goto(NATIVE_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const native = await page.evaluate(async ({ runReceiptPerf }) => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const deviceLimits = await import('/src/runtime/webgpuDeviceLimits.js');
      const timestampQuerySupported = adapter.features?.has('timestamp-query') === true;
      const device = await adapter.requestDevice(
        deviceLimits.webGpuDeviceDescriptorForResidentSph(adapter, {
          timestampProfilingRequested: timestampQuerySupported
        })
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      const nonce = Date.now();
      const abi = await import(`/ulg-gpu-abi/src/index.js?nativePhaseVolume=${nonce}`);
      const buffersModule = await import(
        `/src/runtime/sph/sphGpuBuffers.js?nativePhaseVolume=${nonce}`
      );
      const hierarchyModule = await import(
        `/src/runtime/sph/schroederHierarchyGpu.js?nativePhaseVolume=${nonce}`
      );
      const spatialModule = await import(
        `/src/runtime/sph/schroederSpatialEpochGpu.js?nativePhaseVolume=${nonce}`
      );
      const gridModule = await import(`/src/runtime/sph/sphGridGpuKernel.js?nativePhaseVolume=${nonce}`);
      const readU32 = async (buffer, byteLength, label) => {
        const readback = device.createBuffer({
          label,
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder({ label: `${label}-copy` });
        encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const values = new Uint32Array(readback.getMappedRange()).slice();
        readback.unmap();
        readback.destroy();
        return values;
      };
      const createTimestampRecorder = (queryCapacity = 128) => {
        if (
          device.features?.has('timestamp-query') !== true
          || typeof device.createQuerySet !== 'function'
        ) return null;
        const querySet = device.createQuerySet({
          label: 'native-phase-volume-receipt-timestamps',
          type: 'timestamp',
          count: queryCapacity
        });
        const byteLength = queryCapacity * BigUint64Array.BYTES_PER_ELEMENT;
        const resolveBuffer = device.createBuffer({
          label: 'native-phase-volume-receipt-timestamp-resolve',
          size: byteLength,
          usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });
        const readbackBuffer = device.createBuffer({
          label: 'native-phase-volume-receipt-timestamp-readback',
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const spans = [];
        let nextQueryIndex = 0;
        const nextQuery = () => {
          if (nextQueryIndex >= queryCapacity) {
            throw new RangeError('native phase-volume timestamp query capacity exhausted');
          }
          const value = nextQueryIndex;
          nextQueryIndex += 1;
          return value;
        };
        const recorder = {
          active: true,
          beginEncoderSpan(encoder, descriptor = {}) {
            const token = {
              encoder,
              descriptor: { ...descriptor },
              startQueryIndex: nextQuery(),
              endQueryIndex: null
            };
            encoder.writeTimestamp(querySet, token.startQueryIndex);
            spans.push(token);
            return token;
          },
          endEncoderSpan(encoder, token) {
            if (token?.encoder !== encoder || token.endQueryIndex !== null) {
              throw new Error('native phase-volume timestamp token mismatch');
            }
            token.endQueryIndex = nextQuery();
            encoder.writeTimestamp(querySet, token.endQueryIndex);
          }
        };
        return {
          recorder,
          async complete() {
            if (spans.some((span) => span.endQueryIndex === null)) {
              throw new Error('native phase-volume timestamp span was left open');
            }
            const usedByteLength = nextQueryIndex * BigUint64Array.BYTES_PER_ELEMENT;
            const encoder = device.createCommandEncoder({
              label: 'native-phase-volume-receipt-timestamp-resolve'
            });
            encoder.resolveQuerySet(querySet, 0, nextQueryIndex, resolveBuffer, 0);
            encoder.copyBufferToBuffer(
              resolveBuffer,
              0,
              readbackBuffer,
              0,
              usedByteLength
            );
            device.queue.submit([encoder.finish()]);
            await readbackBuffer.mapAsync(GPUMapMode.READ, 0, usedByteLength);
            const values = new BigUint64Array(
              readbackBuffer.getMappedRange(0, usedByteLength).slice(0)
            );
            readbackBuffer.unmap();
            return spans.map((span) => {
              const start = values[span.startQueryIndex];
              const end = values[span.endQueryIndex];
              return {
                ...span.descriptor,
                durationNs: end >= start ? Number(end - start) : 0,
                durationMs: end >= start ? Number(end - start) / 1e6 : 0
              };
            });
          },
          destroy() {
            querySet.destroy?.();
            resolveBuffer.destroy();
            readbackBuffer.destroy();
          }
        };
      };
      const gridSpec = gridModule.createMlsMpmGridSpec({
        boxDimsM: [2, 2, 2],
        gridSpacingM: 0.25
      });
      const createSourceFixture = async ({ volumeRatioJ, label, particleCount = 1 }) => {
        const state = new Float32Array(particleCount * 8);
        const thermo = new Float32Array(particleCount * 12);
        const identity = new Uint32Array(particleCount);
        const mechanics = new Float32Array(particleCount * 32);
        const side = Math.ceil(Math.cbrt(particleCount));
        for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
          const x = particleIndex % side;
          const y = Math.floor(particleIndex / side) % side;
          const z = Math.floor(particleIndex / (side * side));
          const stateOffset = particleIndex * 8;
          state[stateOffset] = 0.5 + (x + 0.5) / side;
          state[stateOffset + 1] = 0.5 + (y + 0.5) / side;
          state[stateOffset + 2] = 0.5 + (z + 0.5) / side;
          state[stateOffset + 3] = 1;
          thermo.set([
            7, 1, 300, 1000,
            1, 0, 0, 0,
            0.25, 1, 1, 0.1
          ], particleIndex * 12);
          identity[particleIndex] = particleIndex + 1;
          const mechanicsOffset = particleIndex * 32;
          mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], mechanicsOffset);
          mechanics[mechanicsOffset + 18] = volumeRatioJ;
          mechanics[mechanicsOffset + 19] = 0.003;
          mechanics[mechanicsOffset + 20] = 1;
          mechanics[mechanicsOffset + 21] = 1;
          mechanics[mechanicsOffset + 27] = 1;
          mechanics[mechanicsOffset + 31] = 1;
        }
        const sphParticleState = {
          schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          status: 'cpu-derived-gpu-buffer-ready',
          particleCount,
          dimension: 3,
          step: 0,
          time: 0,
          positionEpoch: 0,
          topologyEpoch: 0,
          chartEpoch: 0,
          levelEpoch: 0,
          supportEpoch: 0,
          smoothingLengthM: 0.25,
          storageGeneration: 1,
          stateStrideFloats: 8,
          thermoStrideFloats: 12,
          identityStrideUints: 1,
          stateStrideBytes: 32,
          thermoStrideBytes: 48,
          identityStrideBytes: 4,
          identityRequired: true,
          identityRevision: `native-phase-volume-${label}`,
          renderDomainKeys: { 1: `native-phase-volume-${label}` },
          state,
          thermo,
          identity,
          metadata: []
        };
        const mlsMpmParticleState = {
          schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          status: 'cpu-derived-gpu-buffer-ready',
          particleCount,
          step: 0,
          time: 0,
          storageGeneration: 1,
          mechanicsStrideFloats: 32,
          mechanicsStrideBytes: 128,
          mechanicsDtS: 0.01,
          mechanicalSubsteps: 1,
          gridCflFactor: 0.4,
          gravityMPerS2: [0, 0, 0],
          particleSeparationRelaxation: 0,
          particleSeparationVelocityDamping: 0,
          mechanics,
          metadata: [],
          algorithmMaterialContactRows: null
        };
        const sphParticleUpload = buffersModule.uploadSphGpuParticleBuffers(
          device,
          sphParticleState
        );
        const mlsMpmParticleUpload = buffersModule.uploadMlsMpmGpuParticleBuffers(
          device,
          mlsMpmParticleState
        );
        sphParticleUpload.slot = 0;
        mlsMpmParticleUpload.slot = 0;
        const levelAssignment = await hierarchyModule.runSchroederLevelAssignmentWebGpu({
          device,
          sphParticleState,
          mlsMpmParticleState,
          sphParticleUpload,
          mlsMpmParticleUpload,
          baseGridSpacingM: 0.25,
          minLevel: 0,
          maxLevel: 0,
          targetSupportCells: 1,
          supportRadiusScale: 1,
          chartId: 0,
          retainAssignmentBuffer: true
        });
        return Object.freeze({
          particleCount,
          levelAssignment,
          sphParticleUpload,
          mlsMpmParticleUpload,
          sourceFixtureId: `retained-source-${label}-${particleCount}`,
          sourceFingerprint: `particle-count=${particleCount}:V0=0.003:J=${volumeRatioJ}:grid=${side}`
        });
      };
      const runCase = async ({
        volumeRatioJ,
        label,
        phaseVolumeReceiptEnabled = true,
        timestamp = false,
        sourceFixture = null,
        inspect = true
      }) => {
        const timestampRecorder = timestamp ? createTimestampRecorder() : null;
        const fixture = sourceFixture ?? await createSourceFixture({ volumeRatioJ, label });
        const generation = spatialModule.runSchroederSpatialEpochGenerationWebGpu({
          device,
          levelAssignment: fixture.levelAssignment,
          particleCount: fixture.particleCount,
          particleIdentityBuffer: fixture.sphParticleUpload.identityBuffer,
          particleIdentityStrideWords: 1,
          selectedLevel: 0,
          mechanicsGrid: {
            gridNodeCount: gridSpec.gridNodeCount,
            gridDims: gridSpec.gridDims,
            gridShift: gridSpec.shift,
            gridSpacingM: gridSpec.gridSpacingM
          },
          phaseVolumeReceiptEnabled,
          gpuTimestampRecorder: timestampRecorder?.recorder ?? null
        });
        if (
          generation.ready !== true
          || !generation.phaseVolumeMoment
          || (phaseVolumeReceiptEnabled && !generation.phaseVolumeReceipt)
        ) {
          timestampRecorder?.destroy();
          return {
            generationReady: generation.ready,
            reason: generation.reason || generation.source?.sourceMechanicsProvenanceStatus || null,
            sourceFixtureId: fixture.sourceFixtureId,
            sourceFingerprint: fixture.sourceFingerprint
          };
        }
        const timestampSpans = timestampRecorder
          ? await timestampRecorder.complete()
          : [];
        const generationTimestampMs = timestampSpans.find((span) => (
          span.producerId === 'schroeder-spatial-generation-command-encoder'
        ))?.durationMs ?? null;
        const receiptTimestampMs = timestampSpans
          .filter((span) => (
            span.producerId === 'schroeder-spatial-phase-volume-receipt-build'
          ))
          .reduce((sum, span) => sum + span.durationMs, 0);
        const result = {
          generationReady: generation.ready,
          phaseSourceStatus: generation.source.sourceMechanicsProvenanceStatus,
          phaseVolumeReceiptEnabled,
          sourceFixtureId: fixture.sourceFixtureId,
          sourceFingerprint: fixture.sourceFingerprint,
          generationTimestampMs,
          receiptTimestampMs,
          timestampSpanCount: timestampSpans.length,
          statusFlags: null,
          fieldCount: null,
          volume: null,
          gradient: null,
          receiptStatusFlags: null,
          receiptFieldCount: null,
          receiptSourceVolume: null,
          receiptFieldVolume: null,
          receiptVolumeResidual: null,
          receiptGradient: null,
          receiptTerminalSeal: null,
          releaseScheduled: false
        };
        if (inspect) {
          const sidecar = generation.phaseVolumeMoment;
          const control = await readU32(
            sidecar.controlBuffer,
            sidecar.layout.controlByteLength,
            `native-phase-volume-${label}-control`
          );
          const words = await readU32(
            sidecar.momentBuffer,
            sidecar.layout.momentByteLength,
            `native-phase-volume-${label}-moments`
          );
          const receiptControl = generation.phaseVolumeReceipt
            ? await readU32(
                generation.phaseVolumeReceipt.controlBuffer,
                generation.phaseVolumeReceipt.layout.controlByteLength,
                `native-phase-volume-${label}-receipt-control`
              )
            : null;
          const floats = new Float32Array(words.buffer);
          const receiptFloats = receiptControl
            ? new Float32Array(receiptControl.buffer)
            : null;
          const fieldCount = control[18];
          let volume = 0;
          const gradient = [0, 0, 0];
          for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex += 1) {
            const offset = fieldIndex * 12;
            volume += floats[offset + 4];
            gradient[0] += floats[offset + 5];
            gradient[1] += floats[offset + 6];
            gradient[2] += floats[offset + 7];
          }
          result.statusFlags = control[2];
          result.fieldCount = fieldCount;
          result.volume = volume;
          result.gradient = gradient;
          result.receiptStatusFlags = receiptControl?.[2] ?? null;
          result.receiptFieldCount = receiptControl?.[18] ?? null;
          result.receiptSourceVolume = receiptFloats?.[30] ?? null;
          result.receiptFieldVolume = receiptFloats?.[31] ?? null;
          result.receiptVolumeResidual = receiptFloats?.[32] ?? null;
          result.receiptGradient = receiptFloats
            ? [receiptFloats[33], receiptFloats[34], receiptFloats[35]]
            : null;
          result.receiptTerminalSeal = receiptControl?.[59] ?? null;
        }
        result.releaseScheduled = spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
          generation,
          device
        );
        if (result.releaseScheduled) await generation.releasePromise;
        timestampRecorder?.destroy();
        return result;
      };
      const valid = await runCase({ volumeRatioJ: 2, label: 'valid' });
      const invalid = await runCase({ volumeRatioJ: 0, label: 'invalid-j' });
      const median = (values) => {
        const sorted = [...values].sort((left, right) => left - right);
        return sorted[Math.floor(sorted.length / 2)];
      };
      let receiptBenchmark = null;
      if (runReceiptPerf) {
        if (!timestampQuerySupported) {
          receiptBenchmark = {
            status: 'timestamp-query-unavailable',
            timestampQuerySupported: false
          };
        } else {
          // This is deliberately a retained normal-workload fixture rather
          // than a one-particle microbenchmark.  All A/B arms reuse these
          // exact uploaded buffers and level assignment; only S9-B receipt
          // encoding flips on the same production command path.
          const sourceFixture = await createSourceFixture({
            volumeRatioJ: 2,
            label: 'receipt-ab-retained',
            particleCount: 128
          });
          const runArm = async (phaseVolumeReceiptEnabled, label) => {
            const result = await runCase({
              volumeRatioJ: 2,
              label,
              sourceFixture,
              phaseVolumeReceiptEnabled,
              timestamp: true,
              inspect: false
            });
            if (
              result.generationReady !== true
              || !Number.isFinite(result.generationTimestampMs)
              || !(result.generationTimestampMs > 0)
              || result.sourceFixtureId !== sourceFixture.sourceFixtureId
              || result.sourceFingerprint !== sourceFixture.sourceFingerprint
            ) {
              throw new Error(`native phase-volume receipt benchmark arm failed: ${label}`);
            }
            if (phaseVolumeReceiptEnabled) {
              if (!(result.receiptTimestampMs > 0)) {
                throw new Error(`native receipt-on GPU timestamp was unavailable: ${label}`);
              }
            } else if (result.receiptTimestampMs !== 0) {
              throw new Error(`native receipt-off arm unexpectedly encoded S9-B: ${label}`);
            }
            return result;
          };
          await runArm(false, 'receipt-ab-warmup-off');
          await runArm(true, 'receipt-ab-warmup-on');
          const samples = [];
          for (const order of ['AB', 'BA', 'AB']) {
            const arms = {};
            for (const arm of order) {
              arms[arm] = await runArm(
                arm === 'B',
                `receipt-ab-${order}-${arm}-${samples.length}`
              );
            }
            const off = arms.A;
            const on = arms.B;
            samples.push({
              order,
              sourceFixtureId: sourceFixture.sourceFixtureId,
              offGenerationMs: off.generationTimestampMs,
              onGenerationMs: on.generationTimestampMs,
              receiptBuildMs: on.receiptTimestampMs,
              generationRatio: on.generationTimestampMs / off.generationTimestampMs
            });
          }
          const medianGenerationRatio = median(samples.map((sample) => sample.generationRatio));
          receiptBenchmark = {
            status: 'ok',
            timestampQuerySupported: true,
            sourceFixtureId: sourceFixture.sourceFixtureId,
            sourceFingerprint: sourceFixture.sourceFingerprint,
            orders: samples.map((sample) => sample.order),
            samples,
            medianGenerationRatio,
            medianRegressionPercent: (medianGenerationRatio - 1) * 100
          };
        }
      }
      const validationError = await device.popErrorScope();
      return {
        status: 'ok',
        valid,
        invalid,
        receiptBenchmark,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    }, { runReceiptPerf: RUN_NATIVE_RECEIPT_PERF });
    assert.notEqual(native.status, 'unsupported', native.reason);
    assert.equal(native.status, 'ok');
    assert.equal(native.validationError, null, native.validationError);
    assert.deepEqual(native.uncapturedErrors, []);
    assert.equal(native.valid.generationReady, true, native.valid.reason);
    assert.equal(
      native.valid.phaseSourceStatus,
      'schroeder-spatial-directory-source-mechanics-v0j-ready'
    );
    assert.equal(native.valid.statusFlags & 3, 3);
    assert.ok(native.valid.fieldCount > 0);
    assert.ok(Math.abs(native.valid.volume - 0.006) < 2e-5, native.valid.volume);
    for (const component of native.valid.gradient) {
      assert.ok(Math.abs(component) < 2e-4, component);
    }
    assert.equal(native.valid.receiptStatusFlags & 3, 3);
    assert.ok(native.valid.receiptFieldCount > 0);
    assert.ok(Math.abs(native.valid.receiptSourceVolume - 0.006) < 2e-5);
    assert.ok(Math.abs(native.valid.receiptFieldVolume - 0.006) < 2e-5);
    assert.ok(Math.abs(native.valid.receiptVolumeResidual) < 2e-5);
    for (const component of native.valid.receiptGradient) {
      assert.ok(Math.abs(component) < 2e-4, component);
    }
    assert.notEqual(native.valid.receiptTerminalSeal, 0);
    assert.equal(native.invalid.generationReady, true, native.invalid.reason);
    assert.notEqual(native.invalid.statusFlags & 4, 0);
    assert.equal(native.invalid.fieldCount, 0);
    assert.equal(native.invalid.volume, 0);
    assert.notEqual(native.invalid.receiptStatusFlags & 4, 0);
    assert.equal(native.invalid.receiptFieldCount, 0);
    assert.equal(native.invalid.receiptSourceVolume, 0);
    assert.equal(native.invalid.receiptFieldVolume, 0);
    assert.notEqual(native.invalid.receiptTerminalSeal, 0);
    if (RUN_NATIVE_RECEIPT_PERF) {
      console.info(`S9-B native timestamp A/B: ${JSON.stringify(native.receiptBenchmark)}`);
      assert.equal(
        native.receiptBenchmark?.status,
        'ok',
        JSON.stringify(native.receiptBenchmark)
      );
      assert.equal(native.receiptBenchmark.timestampQuerySupported, true);
      assert.deepEqual(native.receiptBenchmark.orders, ['AB', 'BA', 'AB']);
      assert.equal(native.receiptBenchmark.samples.length, 3);
      assert.ok(
        native.receiptBenchmark.samples.every((sample) => (
          sample.sourceFixtureId === native.receiptBenchmark.sourceFixtureId
          && sample.offGenerationMs > 0
          && sample.onGenerationMs > 0
          && sample.receiptBuildMs > 0
        )),
        JSON.stringify(native.receiptBenchmark)
      );
      assert.ok(
        native.receiptBenchmark.medianGenerationRatio <= 1.05,
        `S9-B receipt median GPU generation regression exceeds 5%: ${JSON.stringify(
          native.receiptBenchmark
        )}`
      );
    }
  } finally {
    await browser.close();
  }
});
