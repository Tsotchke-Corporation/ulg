import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  schroederSpatialMechanicsFieldViewWgsl
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldViewWgsl.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW === '1';
const NATIVE_BASE_URL = process.env.ULG_MECHANICS_FIELD_VIEW_BASE_URL
  || 'https://127.0.0.1:5174/';

function duplicateGroupFromExclusiveHeadPrefix({
  exclusiveHeadPrefix,
  sortedPosition,
  elementCount,
  uniqueCount
}) {
  const inclusiveHeadCount = sortedPosition + 1 < elementCount
    ? exclusiveHeadPrefix[sortedPosition + 1]
    : uniqueCount;
  if (inclusiveHeadCount === 0) return null;
  return inclusiveHeadCount - 1;
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
        setPipeline(value) { pipeline = value; },
        setBindGroup(index, value) { bindGroup = { index, value }; },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({ pipeline, bindGroup, dispatch: [x, y, z] });
        },
        dispatchWorkgroupsIndirect(buffer, byteOffset = 0) {
          event.commands.push({ pipeline, bindGroup, dispatchIndirect: { buffer, byteOffset } });
        },
        end() { event.ended = true; }
      };
    },
    finish() { return { label: 'mechanics-field-test-command-buffer', events }; }
  };
}

function createFakeDevice() {
  const buffers = [];
  const bindGroups = [];
  const submissions = [];
  const device = {
    buffers,
    bindGroups,
    submissions,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 10,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer() {},
      submit(commandBuffers) { submissions.push(commandBuffers); },
      onSubmittedWorkDone() { return Promise.resolve(); }
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
    createShaderModule(descriptor) { return descriptor; },
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
    },
    createCommandEncoder() { return createFakeEncoder(); }
  };
  return device;
}

function createLevelAssignment(device, particleCount = 4) {
  const assignmentBuffer = device.createBuffer({
    label: 'mechanics-field-level-assignment-source',
    size: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const sourceStateBuffer = device.createBuffer({
    label: 'mechanics-field-state-source',
    size: particleCount * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  return {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: 16,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    sourceStateBuffer,
    sourceStateBufferBorrowed: true,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31,
    minLevel: 0,
    maxLevel: 0,
    chartId: 0,
    baseGridSpacingM: 0.25
  };
}

test('mechanics-field duplicate candidates use the inclusive head count from an exclusive scan', () => {
  // Head flags [1, 0, 0, 1, 0, 1] produce this exclusive prefix. Every
  // member of a duplicate run must resolve to the same zero-based group.
  const exclusiveHeadPrefix = [0, 1, 1, 1, 2, 2];
  const groups = exclusiveHeadPrefix.map((_, sortedPosition) => (
    duplicateGroupFromExclusiveHeadPrefix({
      exclusiveHeadPrefix,
      sortedPosition,
      elementCount: exclusiveHeadPrefix.length,
      uniqueCount: 3
    })
  ));
  assert.deepEqual(groups, [0, 0, 0, 1, 1, 2]);

  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /var inclusive_head_count = unique_evidence\[2u\]/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /sorted_position \+ 1u < params\.candidate_count[\s\S]*?unique_group_by_sorted_position\[sorted_position \+ 1u\]/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /if \(inclusive_head_count == 0u\)[\s\S]*?let field_index = inclusive_head_count - 1u/
  );
  assert.doesNotMatch(
    schroederSpatialMechanicsFieldViewWgsl,
    /let field_index = unique_group_by_sorted_position\[sorted_position\]/
  );
});

test('mechanics-field stencil-map runtime binds unique evidence with the exclusive prefix', async () => {
  const device = createFakeDevice();
  const levelAssignment = createLevelAssignment(device);
  const identityBuffer = device.createBuffer({
    label: 'mechanics-field-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer: identityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 13 * 13 * 13,
      gridDims: [13, 13, 13],
      gridShift: 1,
      gridSpacingM: 0.25
    }
  });

  assert.equal(generation.ready, true);
  assert.ok(generation.mechanicsFieldView);
  const stencilMap = device.bindGroups.find(({ label }) => (
    /mechanics-field-view.*stencil-map-bindings/.test(label)
  ));
  assert.ok(stencilMap, 'expected a mechanics-field stencil-map bind group');
  assert.deepEqual(stencilMap.entries.map(({ binding }) => binding), [2, 3, 5, 7, 8, 9]);
  const uniqueEvidence = stencilMap.entries.find(({ binding }) => binding === 5);
  const exclusivePrefix = stencilMap.entries.find(({ binding }) => binding === 9);
  assert.match(uniqueEvidence.resource.buffer.label, /radix-evidence$/);
  assert.match(exclusivePrefix.resource.buffer.label, /radix-head-offsets$/);
  assert.notEqual(uniqueEvidence.resource.buffer, exclusivePrefix.resource.buffer);

  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
});

test('native mechanics field applies gravity across duplicate stencils and copies an inactive carrier', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW=1 for native WebGPU readback',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_MECHANICS_FIELD_VIEW_CHROME
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
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const nonce = Date.now();
      const abi = await import(
        `/ulg-gpu-abi/src/index.js?nativeMechanicsField=${nonce}`
      );
      const buffersModule = await import(
        `/src/runtime/sph/sphGpuBuffers.js?nativeMechanicsField=${nonce}`
      );
      const hierarchyModule = await import(
        `/src/runtime/sph/schroederHierarchyGpu.js?nativeMechanicsField=${nonce}`
      );
      const spatialModule = await import(
        `/src/runtime/sph/schroederSpatialEpochGpu.js?nativeMechanicsField=${nonce}`
      );
      const gridModule = await import(
        `/src/runtime/sph/sphGridGpuKernel.js?nativeMechanicsField=${nonce}`
      );
      const stepModule = await import(
        `/src/runtime/sph/sphMlsMpmGpuStep.js?nativeMechanicsField=${nonce}`
      );

      const liveParticleCount = 4;
      const particleCount = liveParticleCount + 1;
      const state = new Float32Array(particleCount * 8);
      const thermo = new Float32Array(particleCount * 12);
      const identity = new Uint32Array(particleCount);
      const mechanics = new Float32Array(particleCount * 32);
      for (let index = 0; index < particleCount; index += 1) {
        const inactive = index >= liveParticleCount;
        const x = 1 + (index % 2) * 0.1;
        const y = 1 + Math.floor(index / 2) * 0.1;
        state.set([x, y, 1, inactive ? 0 : 1, 0, inactive ? 0.25 : 0, 0, 0], index * 8);
        thermo.set([
          7, 1, 273.15, 1000,
          1, 0, 0, 0,
          0.25, inactive ? 0 : 1, inactive ? 254 : 1, inactive ? 0 : 0.1
        ], index * 12);
        identity[index] = 1;
        const offset = index * 32;
        mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], offset);
        mechanics[offset + 18] = 1;
        mechanics[offset + 19] = inactive ? 0 : 0.001;
        mechanics[offset + 20] = 1;
        mechanics[offset + 21] = inactive ? 254 : 1;
        mechanics[offset + 27] = inactive ? 254 : 1;
        mechanics[offset + 31] = inactive ? 0 : 1;
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
        identityRevision: 'native-mechanics-field-test',
        renderDomainKeys: { 1: 'native-test-body' },
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
        gravityMPerS2: [0, -9.80665, 0],
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
      const gridSpec = gridModule.createMlsMpmGridSpec({
        boxDimsM: [2, 2, 2],
        gridSpacingM: 0.25
      });
      const generation = spatialModule.runSchroederSpatialEpochGenerationWebGpu({
        device,
        levelAssignment,
        particleCount,
        particleIdentityBuffer: sphParticleUpload.identityBuffer,
        particleIdentityStrideWords: 1,
        selectedLevel: 0,
        mechanicsGrid: {
          gridNodeCount: gridSpec.gridNodeCount,
          gridDims: gridSpec.gridDims,
          gridShift: gridSpec.shift,
          gridSpacingM: gridSpec.gridSpacingM
        }
      });
      const spatialMechanicalProposalRunner = async ({
        generation: proposalGeneration
      }) => ({
        ready: true,
        generation: proposalGeneration,
        traversalCount: 0,
        proposalBuffer: null,
        evidence: null,
        consumerReceipts: {},
        encodeApply() {},
        releaseAfterSubmittedWork() { return true; }
      });
      const step = await stepModule.runMlsMpmResidentStepWithOptionalWebGpu({
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload,
        mlsMpmParticleUpload,
        schroederLevelAssignment: levelAssignment,
        schroederSelectedLevel: 0,
        schroederSpatialEpochGeneration: generation,
        spatialMechanicalProposalRunner,
        canonicalSpatialRequired: true,
        gridSpacingM: 0.25,
        boxDimsM: [2, 2, 2],
        dt: 0.01,
        gravityMPerS2: [0, -9.80665, 0],
        cflFactor: 0.4,
        internalPressureScale: 0,
        preferWebGpu: true,
        device,
        readbackMode: 'no-full-readback',
        fuseNoFullResidentMechanics: true,
        summaryRunner: null,
        measureFusedSequenceQueueFence: true
      });

      const fieldView = generation.mechanicsFieldView;
      const read = async (buffer, byteLength, label) => {
        const readback = device.createBuffer({
          label,
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const values = new Uint32Array(readback.getMappedRange()).slice();
        readback.unmap();
        readback.destroy();
        return values;
      };
      const fieldWords = await read(
        fieldView.fieldViewBuffer,
        fieldView.layout.byteLength,
        'native-mechanics-field-header-readback'
      );
      const stateWords = await read(
        step.g2pReconstruction.stateBuffer,
        state.byteLength,
        'native-mechanics-field-state-readback'
      );
      const outputState = new Float32Array(stateWords.buffer);
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const result = {
        status: 'complete',
        mechanicsFieldViewEnabled:
          step.p2gGridProjection.schroederSpatialDirectory.mechanicsFieldViewEnabled,
        flags: fieldWords[2],
        fieldCount: fieldWords[34],
        dispatch: Array.from(fieldWords.slice(60, 63)),
        inactiveDescriptor: Array.from(fieldWords.slice(
          fieldView.layout.descriptorOffsetWords
            + liveParticleCount * fieldView.layout.descriptorWords,
          fieldView.layout.descriptorOffsetWords
            + (liveParticleCount + 1) * fieldView.layout.descriptorWords
        )),
        y: Array.from({ length: particleCount }, (_, index) => outputState[index * 8 + 1]),
        vy: Array.from({ length: particleCount }, (_, index) => outputState[index * 8 + 5]),
        validationError: validationError?.message || null,
        uncapturedErrors
      };

      stepModule.destroyMlsMpmResidentStepBuffers(step);
      spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
      await generation.releasePromise;
      levelAssignment.destroyAssignmentBuffer?.();
      buffersModule.destroySphGpuParticleBuffers(sphParticleUpload);
      buffersModule.destroyMlsMpmGpuParticleBuffers(mlsMpmParticleUpload);
      return result;
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'complete', native.reason || 'native WebGPU did not run');
  assert.equal(native.mechanicsFieldViewEnabled, true);
  assert.equal(
    native.flags,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
      | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED
  );
  assert.equal(native.fieldCount, 27);
  assert.deepEqual(native.dispatch, [1, 1, 1]);
  assert.deepEqual(native.inactiveDescriptor.slice(0, 4), [0, 0, 0, 0]);
  assert.deepEqual(native.inactiveDescriptor.slice(4, 31), new Array(27).fill(0xffff_ffff));
  assert.equal(native.validationError, null);
  assert.deepEqual(native.uncapturedErrors, []);
  for (const velocity of native.vy.slice(0, 4)) {
    assert.ok(Math.abs(velocity - (-9.80665 * 0.01)) <= 2e-7);
  }
  assert.equal(native.vy[4], 0.25);
  assert.ok(Math.abs(native.y[0] - (1 - 9.80665 * 0.01 * 0.01)) <= 2e-7);
  assert.ok(Math.abs(native.y[1] - (1 - 9.80665 * 0.01 * 0.01)) <= 2e-7);
  assert.ok(Math.abs(native.y[2] - (1.1 - 9.80665 * 0.01 * 0.01)) <= 2e-7);
  assert.ok(Math.abs(native.y[3] - (1.1 - 9.80665 * 0.01 * 0.01)) <= 2e-7);
  assert.equal(native.y[4], 1.2000000476837158);
});
