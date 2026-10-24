import assert from 'node:assert/strict';
import test from 'node:test';

import * as publicGpuAbi from '../ulg-gpu-abi/src/index.js';
import {
  SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_OFFSETS,
  SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_WORDS,
  SPH_SPATIAL_GAS_FREE_VOLUME_MAGIC,
  SPH_SPATIAL_GAS_FREE_VOLUME_PARAMS_BYTES,
  SPH_SPATIAL_GAS_FREE_VOLUME_ROW_LAYOUT,
  SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS,
  SPH_SPATIAL_GAS_FREE_VOLUME_STATUS,
  SPH_SPATIAL_GAS_FREE_VOLUME_VERSION,
  ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EXECUTION_SCHEMA,
  ULG_SPH_SPATIAL_GAS_FREE_VOLUME_SOURCE_SCHEMA,
  computeSphSpatialGasFreeVolumeCpuOracle,
  createSphSpatialGasFreeVolumeLayout,
  createSphSpatialGasFreeVolumePlan,
  validateSphSpatialGasFreeVolumeDescriptor
} from '../ulg-gpu-abi/src/sphSpatialGasFreeVolume.js';
import {
  createSphSpatialGasFreeVolumeWgsl
} from '../ulg-gpu-abi/src/sphSpatialGasFreeVolumeWgsl.js';
import {
  schroederQuadraticControlVolumeAxisProjection
} from '../ulg-gpu-abi/src/schroederQuadraticControlVolumeProjection.js';
import {
  abandonSphSpatialGasFreeVolumeEosAuthority,
  activeSphSpatialGasFreeVolumeExecutionCount,
  canReleaseSphSpatialGasFreeVolumeExecutionQueueOrdered,
  createSphSpatialGasFreeVolumeGpu,
  describeSphSpatialGasFreeVolumeExecution,
  destroySphSpatialGasFreeVolumeGpu,
  encodeSphSpatialGasFreeVolumeEosAuthority,
  encodeSphSpatialGasFreeVolumeGpu,
  isExactSphSpatialGasFreeVolumeExecution,
  isSphSpatialGasFreeVolumeExecutionSubmitted,
  ownsSphSpatialGasFreeVolumeExecution,
  releaseSphSpatialGasFreeVolumeExecution,
  releaseSphSpatialGasFreeVolumeExecutionAfter,
  releaseSphSpatialGasFreeVolumeExecutionAfterDeviceLoss,
  releaseSphSpatialGasFreeVolumeExecutionQueueOrdered,
  submitSphSpatialGasFreeVolumeEosAuthority
} from '../src/runtime/sph/sphSpatialGasFreeVolumeGpu.js';
import {
  acquireSchroederSpatialEpochGenerationConsumerLease,
  armSchroederSpatialLegacyLevelAssignmentDirectoryV1ForNativeTest,
  releaseSchroederSpatialEpochGenerationConsumerLease,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  createSphAerosolParcelFamilyWebGpu,
  releaseSphAerosolParcelFamily
} from '../src/runtime/sph/sphAerosolParcelGpu.js';
import {
  createSchroederSpatialEpochTransaction,
  abortSchroederSpatialEpochTransaction
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

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

function createFakeCommandEncoder() {
  const events = [];
  return {
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', buffer, offset, size });
    },
    copyBufferToBuffer(
      source,
      sourceOffset,
      destination,
      destinationOffset,
      size
    ) {
      events.push({
        kind: 'copy',
        source,
        sourceOffset,
        destination,
        destinationOffset,
        size
      });
    },
    beginComputePass(descriptor = {}) {
      const event = { kind: 'pass', descriptor, commands: [] };
      events.push(event);
      return {
        setPipeline(pipeline) {
          event.commands.push({ kind: 'pipeline', pipeline });
        },
        setBindGroup(index, bindGroup, dynamicOffsets = []) {
          event.commands.push({
            kind: 'bind-group',
            index,
            bindGroup,
            dynamicOffsets
          });
        },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({ kind: 'dispatch', x, y, z });
        },
        dispatchWorkgroupsIndirect(buffer, offset = 0) {
          event.commands.push({ kind: 'dispatch-indirect', buffer, offset });
        },
        end() {
          event.ended = true;
        }
      };
    },
    finish() {
      return { events };
    }
  };
}

function createFakeDevice({
  failCreateBufferAt = 0,
  failTagBufferAt = 0,
  failDestroyBufferAt = 0,
  failShaderModule = false,
  failComputePipelineAt = 0,
  failCreateBindGroupAt = 0,
  failSubmitAt = 0,
  failRetainedSizeRead = false
} = {}) {
  const createdBuffers = [];
  const shaderModules = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  const submissions = [];
  const lost = deferred();
  let createBufferCount = 0;
  let createComputePipelineCount = 0;
  let createBindGroupCount = 0;
  let submitCount = 0;
  const device = {
    lost: lost.promise,
    limits: {
      maxStorageBuffersPerShaderStage: 8,
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 256 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      minUniformBufferOffsetAlignment: 256,
      maxComputeWorkgroupsPerDimension: 65_535
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, data });
      },
      submit(commandBuffers) {
        submitCount += 1;
        if (submitCount === failSubmitAt) {
          throw new Error(`injected submit failure at ${submitCount}`);
        }
        submissions.push(commandBuffers);
      },
      onSubmittedWorkDone() {
        return Promise.resolve();
      }
    },
    createBuffer(descriptor) {
      createBufferCount += 1;
      if (createBufferCount === failCreateBufferAt) {
        throw new Error(
          `injected createBuffer failure at allocation ${createBufferCount}`
        );
      }
      const allocationOrdinal = createBufferCount;
      const target = {
        ...descriptor,
        destroyCount: 0,
        destroy() {
          this.destroyCount += 1;
          if (allocationOrdinal === failDestroyBufferAt) {
            throw new Error(
              `injected destroy failure at allocation ${allocationOrdinal}`
            );
          }
        }
      };
      if (failRetainedSizeRead) {
        Object.defineProperty(target, 'size', {
          get() {
            throw new Error('injected retained size read failure');
          }
        });
      }
      const buffer = createBufferCount === failTagBufferAt
        ? new Proxy(target, {
            get(object, key, receiver) {
              if (key === Symbol.for('peercompute.ulg.webgpu.device')) {
                throw new Error('injected buffer provenance tagging failure');
              }
              return Reflect.get(object, key, receiver);
            }
          })
        : target;
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      if (failShaderModule) {
        throw new Error('injected shader-module construction failure');
      }
      const module = { descriptor };
      shaderModules.push(module);
      return module;
    },
    createBindGroupLayout: (descriptor) => descriptor,
    createPipelineLayout: (descriptor) => descriptor,
    createComputePipeline(descriptor) {
      createComputePipelineCount += 1;
      if (createComputePipelineCount === failComputePipelineAt) {
        throw new Error(
          `injected compute-pipeline failure at ${createComputePipelineCount}`
        );
      }
      const pipeline = {
        descriptor,
        getBindGroupLayout() {
          return { entryPoint: descriptor.compute.entryPoint };
        }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      createBindGroupCount += 1;
      if (createBindGroupCount === failCreateBindGroupAt) {
        throw new Error(
          `injected createBindGroup failure at ${createBindGroupCount}`
        );
      }
      const group = { descriptor };
      bindGroups.push(group);
      return group;
    },
    createCommandEncoder() {
      return createFakeCommandEncoder();
    }
  };
  return {
    device,
    createdBuffers,
    shaderModules,
    pipelines,
    bindGroups,
    writes,
    submissions,
    resolveLost: lost.resolve
  };
}

function createDirectLevelAssignment(device) {
  const particleCount = 2;
  const assignmentBuffer = device.createBuffer({
    label: 'gas-free-volume-test-level-assignment',
    size: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const sourceStateBuffer = device.createBuffer({
    label: 'gas-free-volume-test-state',
    size: particleCount * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const sourceMechanicsBuffer = device.createBuffer({
    label: 'gas-free-volume-test-mechanics',
    size: particleCount * 32 * Float32Array.BYTES_PER_ELEMENT,
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
    sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: sourceMechanicsBuffer.size,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31,
    minLevel: -1,
    maxLevel: 1,
    chartId: 0,
    baseGridSpacingM: 0.25
  };
}

function createLiveGasFreeVolumeAuthority(fake, { phaseVolumeReceiptEnabled = false } = {}) {
  const { device } = fake;
  const levelAssignment = createDirectLevelAssignment(device);
  const particleIdentityBuffer = device.createBuffer({
    label: 'gas-free-volume-test-identity',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const nativeTestLegacyLevelAssignmentDirectoryV1Arm =
    armSchroederSpatialLegacyLevelAssignmentDirectoryV1ForNativeTest({
      device,
      levelAssignment
    });
  const grid = {
    gridNodeCount: 512,
    gridDims: [8, 8, 8],
    gridShift: 2,
    gridSpacingM: 0.25
  };
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: grid,
    exactNearCellTreeEnabled: false,
    phaseVolumeReceiptEnabled,
    nativeTestLegacyLevelAssignmentDirectoryV1Arm
  });
  assert.equal(generation.ready, true, generation.reason);
  assert.ok(generation.phaseVolumeMoment);
  const generationReadFamily =
    acquireSchroederSpatialEpochGenerationConsumerLease(
      generation,
      { consumerId: 'gas-free-volume-release-race-test' }
    );
  return {
    generation,
    generationReadFamily,
    levelAssignment,
    particleIdentityBuffer,
    grid
  };
}

function createLiveAerosolVolumeAuthority(fake, { capacity = 130 } = {}) {
  const authority = createLiveGasFreeVolumeAuthority(fake, { phaseVolumeReceiptEnabled: true });
  const family = createSphAerosolParcelFamilyWebGpu({ device: fake.device, capacity,
    parcels: [], provenance: { kind: 'initial-conditions', reference: 'explicit empty sparse inventory' } });
  const level = authority.levelAssignment;
  const thermo = tagWebGpuBufferDevice(fake.device.createBuffer({
    size: 2 * 48, usage: 128 | 4 | 8, label: 'aerosol-volume-transaction-thermo'
  }), fake.device);
  const epochs = Object.fromEntries(['storageGeneration', 'physicsTick', 'physicsSubstep',
    'positionEpoch', 'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch'].map((key) => [key, level[key]]));
  const sphParticleUpload = { particleCount: 2, stateBuffer: level.sourceStateBuffer,
    thermoBuffer: thermo, identityBuffer: authority.particleIdentityBuffer,
    aerosolFamily: family, ...epochs };
  const mlsMpmParticleUpload = { particleCount: 2, mechanicsBuffer: level.sourceMechanicsBuffer, ...epochs };
  const transaction = createSchroederSpatialEpochTransaction({ device: fake.device,
    generation: authority.generation, sphParticleUpload, mlsMpmParticleUpload });
  return { ...authority, family, transaction, sphParticleUpload, mlsMpmParticleUpload };
}

const gasFreeVolumeEncoders = new WeakMap();

function encodeGasFreeVolume(runtime, authority) {
  const encoder = createFakeCommandEncoder();
  const execution = encodeSphSpatialGasFreeVolumeGpu(runtime, encoder, {
    gasDirectory: authority.generation.execution,
    generationReadFamily: authority.generationReadFamily,
    grid: authority.grid,
    boxMinM: [0, 0, 0],
    boxMaxM: [2, 2, 2]
  });
  gasFreeVolumeEncoders.set(execution, encoder);
  return execution;
}

function encodeAllGasFreeVolumeEosPasses(
  fake,
  execution,
  { publicEntries = [], encoder = gasFreeVolumeEncoders.get(execution) } = {}
) {
  let action = null;
  for (const pass of ['aggregate', 'gradient', 'finalize']) {
    const passEncoder = encoder.beginComputePass({
      label: `test-gas-free-volume-${pass}`
    });
    action = encodeSphSpatialGasFreeVolumeEosAuthority(
      execution,
      action?.receipt ?? null,
      {
        device: fake.device,
        encoder,
        pass,
        passEncoder,
        bindGroupLayout: { pass },
        bindGroupIndex: 0,
        publicEntries
      }
    );
    passEncoder.end();
  }
  return action;
}

function submitGasFreeVolumeExecution(fake, execution) {
  const action = encodeAllGasFreeVolumeEosPasses(fake, execution);
  assert.equal(
    submitSphSpatialGasFreeVolumeEosAuthority(
      action.receipt,
      fake.device
    ),
    true
  );
  return action;
}

function reachableCreatedBuffers(roots, createdBuffers) {
  const created = new Set(createdBuffers);
  const seen = new Set();
  const found = new Set();
  const pending = [...roots];
  while (pending.length > 0) {
    const value = pending.pop();
    if (
      value == null
      || (typeof value !== 'object' && typeof value !== 'function')
      || seen.has(value)
    ) continue;
    seen.add(value);
    if (created.has(value)) found.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && Object.hasOwn(descriptor, 'value')) {
        pending.push(descriptor.value);
      }
    }
  }
  return [...found];
}

function reachableFunctions(roots) {
  const seen = new Set();
  const found = new Set();
  const pending = [...roots];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'function') {
      found.add(value);
      continue;
    }
    if (value == null || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && Object.hasOwn(descriptor, 'value')) {
        pending.push(descriptor.value);
      }
    }
  }
  return [...found];
}

test('gas free-volume ABI is public, exact, and plans one or two levels only', () => {
  assert.equal(
    publicGpuAbi.ULG_SPH_SPATIAL_GAS_FREE_VOLUME_SOURCE_SCHEMA,
    ULG_SPH_SPATIAL_GAS_FREE_VOLUME_SOURCE_SCHEMA
  );
  assert.equal(
    publicGpuAbi.ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EXECUTION_SCHEMA,
    ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EXECUTION_SCHEMA
  );
  assert.equal(SPH_SPATIAL_GAS_FREE_VOLUME_MAGIC, 0x5347_4631);
  assert.equal(SPH_SPATIAL_GAS_FREE_VOLUME_VERSION, 3);
  assert.match(ULG_SPH_SPATIAL_GAS_FREE_VOLUME_SOURCE_SCHEMA, /\.v3$/);
  assert.match(ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EXECUTION_SCHEMA, /\.v3$/);
  assert.equal(SPH_SPATIAL_GAS_FREE_VOLUME_PARAMS_BYTES, 288);
  assert.equal(SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_WORDS, 64);
  assert.equal(SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS, 4);
  assert.deepEqual(SPH_SPATIAL_GAS_FREE_VOLUME_ROW_LAYOUT, [
    'geometricVolumeM3:f32-bits',
    'condensedVolumeM3:f32-bits',
    'freeVolumeM3:f32-bits',
    'statusFlags:u32'
  ]);
  assert.equal(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.READY, 1);
  assert.equal(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.ADMITTED, 2);
  assert.equal(SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.FAIL_CLOSED, 4);
  assert.equal(
    SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_OFFSETS.GAS_FREE_VOLUME_GENERATION,
    4
  );
  assert.equal(
    SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_OFFSETS.REDUCTION_VERSION,
    27
  );
  assert.equal(SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_OFFSETS.PROJECTION_VERSION, 33);
  assert.equal(
    SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_OFFSETS.CONTROL_VOLUME_GEOMETRY_SEAL,
    34
  );
  const layout = createSphSpatialGasFreeVolumeLayout({ cellCapacity: 128 });
  assert.equal(layout.rowsWordLength, 512);
  assert.equal(layout.rowsByteLength, 2048);
  const plan = createSphSpatialGasFreeVolumePlan({
    cellCapacity: 128,
    fineFieldCapacity: 256,
    coarseFieldCapacity: 64,
    exactLevelCount: 2,
    grid: {
      gridDims: [4, 4, 4],
      gridNodeCount: 64,
      gridShift: 2,
      gridSpacingM: 0.5,
      chartId: 7,
      selectedLevel: 1
    },
    boxMinM: [-1, -1, -1],
    boxMaxM: [1, 1, 1],
    gasFreeVolumeGeneration: 71,
    sourceGeneration: 41,
    directoryGeneration: 43,
    storageGeneration: 47,
    fineMomentGeneration: 41,
    coarseMomentGeneration: 41,
    parentCompletionOrdinal: 53,
    parentCapacityWords: 1024
  });
  assert.equal(plan.exactLevelCount, 2);
  assert.equal(plan.parentCapacityWords, 1024);
  assert.equal(plan.reductionVersion, 3);
  assert.equal(
    plan.reductionAlgorithm,
    'quadratic-capacity-overlap-keyed-atomic-f32-scatter'
  );
  assert.equal(plan.reductionWorkComplexity, 'O(C + (F + E + K) log C)');
  assert.equal(plan.readbackRequired, false);
  assert.ok(Object.isFrozen(plan.gasControlVolumeDescriptor));
  assert.ok(Object.isFrozen(plan.gasControlVolumeDescriptor.boundsWords));
  assert.equal(plan.gasControlVolumeDescriptor.version, 1);
  assert.equal(plan.gasControlVolumeDescriptor.boundsWords.length, 12);
  assert.equal(
    createSphSpatialGasFreeVolumePlan(plan).gasControlVolumeDescriptor,
    plan.gasControlVolumeDescriptor,
    'provided canonical descriptor must retain its exact metadata identity'
  );
  assert.throws(() => createSphSpatialGasFreeVolumePlan({
    ...plan, boxMinM: [-0.9, -1, -1]
  }), /bound|descriptor|mismatch/i);
  assert.throws(() => createSphSpatialGasFreeVolumePlan({
    ...plan, gasControlVolumeDescriptor: {
      ...plan.gasControlVolumeDescriptor,
      seal: plan.gasControlVolumeDescriptor.seal ^ 1
    }
  }), /seal|descriptor/i);
  const translated = createSphSpatialGasFreeVolumePlan({
    ...plan,
    gasControlVolumeDescriptor: undefined,
    boxMinM: [1_000_000, 0, 0],
    boxMaxM: [1_000_000.015625, 1, 1]
  });
  assert.equal(translated.boxMaxM[0] - translated.boxMinM[0], 0.015625);
  assert.notEqual(translated.gasControlVolumeDescriptor.boundsWords[3], 0);
  assert.throws(
    () => createSphSpatialGasFreeVolumePlan({
      ...plan,
      exactLevelCount: 3
    }),
    /exactLevelCount/
  );
});

test('gas free-volume CPU oracle clips boundary cells and subtracts only supplied condensed occupancy', () => {
  const rows = computeSphSpatialGasFreeVolumeCpuOracle({
    cells: [[-1, 0, 0], [0, 0, 0]],
    condensedContributions: [0.025, 0.5],
    boxMinM: [-0.25, 0, 0],
    boxMaxM: [1, 1, 1],
    gridSpacingM: 1
  });
  assert.equal(rows.length, 2);
  assert.ok(Math.abs(rows[0].geometricVolumeM3 - 0.25) < 1e-7);
  assert.ok(Math.abs(rows[0].freeVolumeM3 - 0.225) < 1e-7);
  assert.equal(rows[1].geometricVolumeM3, 1);
  assert.equal(rows[1].condensedVolumeM3, 0.5);
  assert.equal(rows[1].freeVolumeM3, 0.5);
  assert.equal(rows[1].statusFlags, 3);
  const translated = computeSphSpatialGasFreeVolumeCpuOracle({
    cells: [[1_000_000, 0, 0]],
    condensedContributions: [0.00390625],
    boxMinM: [1_000_000, 0, 0],
    boxMaxM: [1_000_000.015625, 1, 1],
    gridSpacingM: 1
  });
  assert.equal(translated[0].geometricVolumeM3, 0.015625);
  assert.equal(translated[0].freeVolumeM3, 0.01171875);
  assert.throws(
    () => computeSphSpatialGasFreeVolumeCpuOracle({
      cells: [[0, 0, 0]],
      condensedContributions: [1.1],
      boxMinM: [0, 0, 0],
      boxMaxM: [1, 1, 1],
      gridSpacingM: 1
    }),
    /overfills/
  );
});

test('gas free-volume shared overlap accounts for wall halos and does not renormalize sparse support', () => {
  // Mathematical geometry fixtures only; native GPU forward/transpose checks
  // provide execution acceptance. Node -1 has positive quadratic wall support
  // despite having no clipped conventional dual cell.
  const halo = schroederQuadraticControlVolumeAxisProjection(-1, 0, 0, 4, 0);
  assert.equal(halo.valid, 1);
  assert.ok(Math.abs(halo.capacity - 1 / 48) < 1e-15);
  assert.equal(halo.cell0, 0);
  assert.equal(halo.weight0, 1);
  const wall = schroederQuadraticControlVolumeAxisProjection(0, 0, 0, 4, 0);
  assert.equal(wall.capacity, 0.5);
  const interior = schroederQuadraticControlVolumeAxisProjection(2, 0, 0, 4, 0);
  assert.deepEqual([interior.cell0, interior.cell1], [1, 2]);
  assert.deepEqual([interior.weight0, interior.weight1], [0.5, 0.5]);
  const wgsl = createSphSpatialGasFreeVolumeWgsl(
    createSphSpatialGasFreeVolumeLayout({ cellCapacity: 8 })
  );
  assert.match(wgsl, /cell != 0xffffffffu\s*&& !atomic_add_condensed\(cell, contribution \* wx \* wy \* wz\)/);
  assert.doesNotMatch(wgsl, /present_weight|weight_sum|renormaliz(?:e|ation)_/);
  // If only primal key [1,1,1] is resident, one-eighth of an interior node's
  // volume is relevant to that cell. Missing seven cells do not multiply it.
  assert.equal(interior.weight0 ** 3, 0.125);
});

test('gas free-volume WGSL keeps eight storage bindings and uses keyed scatter instead of per-cell field scans', () => {
  const layout = createSphSpatialGasFreeVolumeLayout({ cellCapacity: 64 });
  const wgsl = createSphSpatialGasFreeVolumeWgsl(layout);
  assert.equal(
    [...wgsl.matchAll(/@group\(0\) @binding\((\d+)\) var<storage/g)]
      .map((match) => Number(match[1])).sort((a, b) => a - b).join(','),
    '0,1,2,3,4,5,6,7'
  );
  assert.match(wgsl, /fn find_gas_cell/);
  assert.match(wgsl, /fn find_gas_cell\(sought_cell: vec3<i32>\)/);
  assert.doesNotMatch(wgsl, /\b(?:let|var) target\b|\btarget: vec3/);
  assert.match(wgsl, /qcv_axis_projection\(node\.x/);
  assert.match(wgsl, /qcv_primal_axis_extent\(x/);
  assert.match(wgsl, /contribution \* wx \* wy \* wz/);
  assert.match(wgsl, /params\.control_volume_geometry_seal == qcv_descriptor_seal/);
  assert.match(wgsl, /output_control\[33u\], params\.projection_version/);
  assert.match(wgsl, /output_control\[34u\], params\.control_volume_geometry_seal/);
  assert.doesNotMatch(wgsl, /dense_node_for_cell/);
  assert.match(wgsl, /fn scatter_fine_condensed_volume/);
  assert.match(wgsl, /fn scatter_coarse_condensed_volume/);
  assert.match(wgsl, /atomicCompareExchangeWeak/);
  assert.match(wgsl, /edge_parent_offset/);
  assert.match(wgsl, /coarse_map_offset/);
  assert.match(wgsl, /geometric - condensed/);
  assert.match(wgsl, /condensed > geometric \+ tolerance/);
  assert.doesNotMatch(wgsl, /fn single_level_condensed/);
  assert.doesNotMatch(wgsl, /fn two_level_condensed/);
  assert.doesNotMatch(
    wgsl,
    /for \(var field = 0u; field < (fine|coarse)_moment_control/
  );
  assert.match(wgsl, /fn finalize_gas_free_volume/);
  assert.doesNotMatch(wgsl, /mapAsync|copyBufferToBuffer/);
});

test('gas free-volume runtime retains fixed arenas and fails closed before encoding a foreign read family', () => {
  const fake = createFakeDevice();
  const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: 64,
    fineFieldCapacity: 128,
    coarseFieldCapacity: 32,
    arenaCount: 2
  });
  assert.equal(runtime.pipelineCount, 5);
  assert.equal(runtime.reductionVersion, 3);
  assert.equal(
    runtime.reductionWorkComplexity,
    'O(C + (F + E + K) log C)'
  );
  assert.equal(runtime.arenaCount, 2);
  assert.equal(activeSphSpatialGasFreeVolumeExecutionCount(runtime), 0);
  assert.equal(Object.isFrozen(runtime), true);
  assert.equal(Object.hasOwn(runtime, 'allocationEntries'), false);
  assert.equal(Object.hasOwn(runtime, 'destroy'), false);
  assert.equal(Object.hasOwn(runtime, 'encode'), false);
  assert.deepEqual(reachableCreatedBuffers([runtime], fake.createdBuffers), []);
  assert.deepEqual(reachableFunctions([runtime]), []);
  assert.equal(fake.shaderModules.length, 1);
  assert.deepEqual(
    fake.pipelines.map((entry) => entry.descriptor.compute.entryPoint),
    [
      'validate_gas_free_volume_authority',
      'scatter_fine_condensed_volume',
      'scatter_coarse_condensed_volume',
      'build_gas_free_volume',
      'finalize_gas_free_volume'
    ]
  );
  assert.equal(fake.createdBuffers.length, 6);
  const encoder = {
    clearBuffer() {
      assert.fail('foreign authority must be rejected before buffer clears');
    },
    beginComputePass() {
      assert.fail('foreign authority must be rejected before compute encoding');
    }
  };
  assert.throws(
    () => encodeSphSpatialGasFreeVolumeGpu(runtime, encoder, {
      gasDirectory: {},
      generationReadFamily: {},
      grid: {},
      boxMinM: [0, 0, 0],
      boxMaxM: [1, 1, 1]
    }),
    /exact active spatial-generation consumer lease/
  );
  assert.deepEqual(
    validateSphSpatialGasFreeVolumeDescriptor(null),
    {
      admitted: false,
      status: 'sph-spatial-gas-free-volume-rejected-shape'
    }
  );
  assert.equal(destroySphSpatialGasFreeVolumeGpu(runtime), true);
  assert.equal(destroySphSpatialGasFreeVolumeGpu(runtime), false);
  assert.ok(fake.createdBuffers.every((buffer) => buffer.destroyCount === 1));
});

test('gas free-volume shares unchanged kernels across capacities and labels, not device or arena state', () => {
  const fake = createFakeDevice();
  const code = createSphSpatialGasFreeVolumeWgsl(
    createSphSpatialGasFreeVolumeLayout({ cellCapacity: 1 })
  );
  const runtimes = [];
  for (const cellCapacity of [1, 8192, 16384, 32768, 65536, 131072, 262144]) {
    assert.equal(createSphSpatialGasFreeVolumeWgsl(
      createSphSpatialGasFreeVolumeLayout({ cellCapacity })
    ), code);
    runtimes.push(createSphSpatialGasFreeVolumeGpu(fake.device, {
      cellCapacity, fineFieldCapacity: cellCapacity * 2,
      coarseFieldCapacity: cellCapacity, arenaCount: 2,
      label: `independent-runtime-${cellCapacity}`
    }));
  }
  assert.equal(fake.shaderModules.length, 1);
  assert.equal(fake.shaderModules[0].descriptor.code, code);
  assert.equal(fake.pipelines.length, 5);
  assert.equal(fake.createdBuffers.length, runtimes.length * 6);
  assert.equal(new Set(fake.createdBuffers).size, fake.createdBuffers.length);
  for (const [index, runtime] of runtimes.entries()) {
    assert.equal(destroySphSpatialGasFreeVolumeGpu(runtime), true);
    assert.ok(fake.createdBuffers.slice(0, (index + 1) * 6)
      .every(buffer => buffer.destroyCount === 1));
    assert.ok(fake.createdBuffers.slice((index + 1) * 6)
      .every(buffer => buffer.destroyCount === 0));
  }
  // Warm pipelines remain useful after all buffer-owning runtimes retire.
  const replacement = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: 8, fineFieldCapacity: 16, arenaCount: 1
  });
  assert.equal(fake.shaderModules.length, 1);
  assert.equal(fake.pipelines.length, 5);
  destroySphSpatialGasFreeVolumeGpu(replacement);
  const other = createFakeDevice();
  const foreign = createSphSpatialGasFreeVolumeGpu(other.device, {
    cellCapacity: 8, fineFieldCapacity: 16, arenaCount: 1
  });
  assert.equal(other.shaderModules.length, 1);
  assert.equal(other.pipelines.length, 5);
  assert.ok(other.pipelines.every(pipeline => !fake.pipelines.includes(pipeline)));
  destroySphSpatialGasFreeVolumeGpu(foreign);
  // Cache hits must not bypass the original device/capacity validation.
  fake.device.limits.maxStorageBuffersPerShaderStage = 7;
  assert.throws(() => createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: 8, fineFieldCapacity: 16
  }), /eight storage bindings/);
});

test('gas free-volume shared pipelines encode independent bindings after another runtime retires', () => {
  const fake = createFakeDevice();
  const authority = createLiveGasFreeVolumeAuthority(fake);
  const options = {
    cellCapacity: authority.generation.execution.cellCapacity,
    fineFieldCapacity: authority.generation.phaseVolumeMoment.fieldCapacity,
    arenaCount: 1
  };
  const first = createSphSpatialGasFreeVolumeGpu(fake.device, { ...options, label: 'first' });
  const second = createSphSpatialGasFreeVolumeGpu(fake.device, { ...options, label: 'second' });
  const firstExecution = encodeGasFreeVolume(first, authority);
  const secondExecution = encodeGasFreeVolume(second, authority);
  const commands = execution => gasFreeVolumeEncoders.get(execution).events
    .filter(event => event.kind === 'pass').flatMap(event => event.commands);
  const firstCommands = commands(firstExecution);
  const secondCommands = commands(secondExecution);
  const selected = list => list.filter(command => command.kind === 'pipeline');
  assert.equal(selected(firstCommands).length, 4);
  selected(firstCommands).forEach((command, index) => {
    assert.equal(command.pipeline, selected(secondCommands)[index].pipeline);
  });
  const firstGroups = firstCommands.filter(command => command.kind === 'bind-group');
  const secondGroups = secondCommands.filter(command => command.kind === 'bind-group');
  firstGroups.forEach((command, index) => {
    assert.notEqual(command.bindGroup, secondGroups[index].bindGroup);
    for (const binding of [6, 7, 8]) {
      const buffer = group => group.descriptor.entries
        .find(entry => entry.binding === binding)?.resource.buffer;
      if (buffer(command.bindGroup)) {
        assert.notEqual(buffer(command.bindGroup), buffer(secondGroups[index].bindGroup));
      }
    }
  });
  releaseSphSpatialGasFreeVolumeExecution(first, firstExecution, { discardedEncoder: true });
  assert.equal(destroySphSpatialGasFreeVolumeGpu(first), true);
  assert.equal(ownsSphSpatialGasFreeVolumeExecution(second, secondExecution), true);
  const action = encodeAllGasFreeVolumeEosPasses(fake, secondExecution);
  assert.equal(abandonSphSpatialGasFreeVolumeEosAuthority(action.receipt), true);
  releaseSphSpatialGasFreeVolumeExecution(second, secondExecution, { discardedEncoder: true });
  const thirdExecution = encodeGasFreeVolume(second, authority);
  selected(commands(thirdExecution)).forEach((command, index) => {
    assert.equal(command.pipeline, selected(firstCommands)[index].pipeline);
  });
  releaseSphSpatialGasFreeVolumeExecution(second, thirdExecution, { discardedEncoder: true });
  destroySphSpatialGasFreeVolumeGpu(second);
  releaseSchroederSpatialEpochGenerationConsumerLease(
    authority.generationReadFamily, { discardedEncoder: true });
});

test('gas free-volume retries a failed pipeline bundle without caching partial construction', () => {
  for (const failComputePipelineAt of [1, 2, 3, 4, 5]) {
    const fake = createFakeDevice({ failComputePipelineAt });
    const options = { cellCapacity: 8, fineFieldCapacity: 16, arenaCount: 1 };
    assert.throws(() => createSphSpatialGasFreeVolumeGpu(fake.device, options),
      /injected compute-pipeline failure/);
    assert.equal(fake.createdBuffers.length, 0);
    const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, options);
    assert.equal(fake.shaderModules.length, 2);
    assert.equal(fake.pipelines.length, failComputePipelineAt - 1 + 5);
    const warm = createSphSpatialGasFreeVolumeGpu(fake.device, { ...options, cellCapacity: 16 });
    assert.equal(fake.shaderModules.length, 2);
    assert.equal(fake.pipelines.length, failComputePipelineAt - 1 + 5);
    destroySphSpatialGasFreeVolumeGpu(runtime);
    destroySphSpatialGasFreeVolumeGpu(warm);
  }
});

test('gas free-volume rejects devices below the portable eight-storage-binding floor', () => {
  const fake = createFakeDevice();
  fake.device.limits.maxStorageBuffersPerShaderStage = 7;
  assert.throws(
    () => createSphSpatialGasFreeVolumeGpu(fake.device, {
      cellCapacity: 8,
      fineFieldCapacity: 8
    }),
    /eight storage bindings/
  );
});

test('gas free-volume construction rolls back every completed arena allocation exactly once', () => {
  const arenaCount = 8;
  const allocationCount = arenaCount * 3;
  for (let failCreateBufferAt = 1;
    failCreateBufferAt <= allocationCount;
    failCreateBufferAt += 1) {
    const fake = createFakeDevice({ failCreateBufferAt });
    assert.throws(
      () => createSphSpatialGasFreeVolumeGpu(fake.device, {
        cellCapacity: 64,
        fineFieldCapacity: 128,
        coarseFieldCapacity: 32,
        arenaCount
      }),
      new RegExp(`injected createBuffer failure at allocation ${
        failCreateBufferAt
      }`)
    );
    assert.equal(fake.createdBuffers.length, failCreateBufferAt - 1);
    assert.equal(
      fake.createdBuffers.every((buffer) => buffer.destroyCount === 1),
      true,
      `allocation boundary ${failCreateBufferAt} leaked or double-retired`
    );
  }
});

test('gas free-volume construction tracks raw buffers before provenance tagging', () => {
  const fake = createFakeDevice({ failTagBufferAt: 4 });
  assert.throws(
    () => createSphSpatialGasFreeVolumeGpu(fake.device, {
      cellCapacity: 64,
      fineFieldCapacity: 128,
      coarseFieldCapacity: 32,
      arenaCount: 2
    }),
    /injected buffer provenance tagging failure/
  );
  assert.equal(fake.createdBuffers.length, 4);
  assert.equal(
    fake.createdBuffers.every((buffer) => buffer.destroyCount === 1),
    true
  );
});

test('gas free-volume rollback preserves the origin and visits every buffer when destroy throws', () => {
  const fake = createFakeDevice({
    failCreateBufferAt: 6,
    failDestroyBufferAt: 3
  });
  assert.throws(
    () => createSphSpatialGasFreeVolumeGpu(fake.device, {
      cellCapacity: 64,
      fineFieldCapacity: 128,
      coarseFieldCapacity: 32,
      arenaCount: 2
    }),
    /injected createBuffer failure at allocation 6/
  );
  assert.equal(fake.createdBuffers.length, 5);
  assert.equal(
    fake.createdBuffers.every((buffer) => buffer.destroyCount === 1),
    true
  );
});

test('gas free-volume construction rolls back allocations on post-allocation assembly failure', () => {
  const fake = createFakeDevice({ failRetainedSizeRead: true });
  assert.throws(
    () => createSphSpatialGasFreeVolumeGpu(fake.device, {
      cellCapacity: 64,
      fineFieldCapacity: 128,
      coarseFieldCapacity: 32,
      arenaCount: 2
    }),
    /injected retained size read failure/
  );
  assert.equal(fake.createdBuffers.length, 6);
  assert.equal(
    fake.createdBuffers.every((buffer) => buffer.destroyCount === 1),
    true
  );
});

test('gas free-volume pipeline construction fails before any arena allocation', () => {
  const shaderFailure = createFakeDevice({ failShaderModule: true });
  assert.throws(
    () => createSphSpatialGasFreeVolumeGpu(shaderFailure.device, {
      cellCapacity: 64,
      fineFieldCapacity: 128,
      arenaCount: 2
    }),
    /injected shader-module construction failure/
  );
  assert.equal(shaderFailure.createdBuffers.length, 0);

  for (let failComputePipelineAt = 1;
    failComputePipelineAt <= 5;
    failComputePipelineAt += 1) {
    const fake = createFakeDevice({ failComputePipelineAt });
    assert.throws(
      () => createSphSpatialGasFreeVolumeGpu(fake.device, {
        cellCapacity: 64,
        fineFieldCapacity: 128,
        arenaCount: 2
      }),
      new RegExp(`injected compute-pipeline failure at ${
        failComputePipelineAt
      }`)
    );
    assert.equal(fake.createdBuffers.length, 0);
  }
});

test('gas free-volume execution and EOS receipt are exact opaque authorities with private bindings', async () => {
  const fake = createFakeDevice();
  const authority = createLiveGasFreeVolumeAuthority(fake);
  const arenaBufferStart = fake.createdBuffers.length;
  const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: authority.generation.execution.cellCapacity,
    fineFieldCapacity: authority.generation.phaseVolumeMoment.fieldCapacity,
    arenaCount: 1
  });
  const arenaBuffers = fake.createdBuffers.slice(arenaBufferStart);
  assert.equal(arenaBuffers.length, 3);
  const execution = encodeGasFreeVolume(runtime, authority);
  assert.equal(Object.isFrozen(execution), true);
  assert.equal(Object.isFrozen(execution.gasControlVolumeDescriptor), true);
  const paramsWrite = fake.writes.findLast((entry) => (
    entry.buffer.label === 'ulg-sph-spatial-gas-free-volume-arena-0-params'
  ));
  assert.ok(paramsWrite, 'the retained uniform must carry the sealed projection');
  const paramsWords = new Uint32Array(paramsWrite.data);
  assert.equal(paramsWords.byteLength, 288);
  assert.equal(paramsWords[53], execution.gasControlVolumeDescriptor.version);
  assert.equal(paramsWords[54], execution.gasControlVolumeDescriptor.seal);
  assert.deepEqual(
    [...paramsWords.slice(55, 67)],
    execution.gasControlVolumeDescriptor.boundsWords
  );
  assert.equal(isExactSphSpatialGasFreeVolumeExecution(execution), true);
  assert.equal(
    ownsSphSpatialGasFreeVolumeExecution(runtime, execution),
    true
  );
  for (const forbidden of [
    'gasFreeVolumeBuffer',
    'gasFreeVolumeControlBuffer',
    'gasDirectory',
    'gasDirectoryBuffer',
    'generationReadFamily',
    'sourceSpatialGeneration',
    'finePhaseVolumeMoment',
    'coarsePhaseVolumeMoment',
    'parentFieldView',
    'parentFieldViewBuffer',
    'paramsBuffer',
    'indirectDispatchBuffer',
    'ownerRuntime',
    'destroy',
    'releaseExecution',
    'bind'
  ]) {
    assert.equal(Object.hasOwn(execution, forbidden), false, forbidden);
  }
  assert.deepEqual(
    reachableCreatedBuffers([runtime, execution], fake.createdBuffers),
    []
  );
  assert.deepEqual(reachableFunctions([runtime, execution]), []);
  const clone = { ...execution };
  assert.equal(isExactSphSpatialGasFreeVolumeExecution(clone), false);

  const before = describeSphSpatialGasFreeVolumeExecution(execution, {
    device: fake.device
  });
  assert.equal(Object.isFrozen(before), true);
  assert.equal(before.deviceAuthenticated, true);
  assert.equal(before.consumerBorrowedObserved, false);
  assert.equal(before.submittedObserved, false);
  assert.deepEqual(reachableCreatedBuffers([before], fake.createdBuffers), []);
  assert.deepEqual(reachableFunctions([before]), []);

  const action = encodeAllGasFreeVolumeEosPasses(fake, execution);
  assert.equal(Object.isFrozen(action), true);
  assert.equal(Object.isFrozen(action.receipt), true);
  assert.deepEqual(
    reachableCreatedBuffers([action, action.receipt], fake.createdBuffers),
    []
  );
  assert.deepEqual(reachableFunctions([action, action.receipt]), []);
  assert.equal(
    describeSphSpatialGasFreeVolumeExecution(execution)
      .consumerBorrowedObserved,
    true
  );
  const consumerBindGroups = fake.bindGroups.slice(-3);
  assert.equal(consumerBindGroups.length, 3);
  for (const group of consumerBindGroups) {
    assert.equal(
      group.descriptor.entries.find((entry) => entry.binding === 5)
        .resource.buffer,
      arenaBuffers[2]
    );
    assert.equal(
      group.descriptor.entries.find((entry) => entry.binding === 6)
        .resource.buffer,
      arenaBuffers[1]
    );
  }
  assert.equal(
    submitSphSpatialGasFreeVolumeEosAuthority(
      action.receipt,
      fake.device
    ),
    true
  );
  assert.equal(
    isSphSpatialGasFreeVolumeExecutionSubmitted(runtime, execution),
    true
  );
  assert.equal(
    describeSphSpatialGasFreeVolumeExecution(execution).submittedObserved,
    true
  );
  assert.equal(
    submitSphSpatialGasFreeVolumeEosAuthority(action.receipt, fake.device),
    false
  );
  assert.throws(
    () => encodeSphSpatialGasFreeVolumeEosAuthority(
      execution,
      action.receipt,
      {
        device: fake.device,
        encoder: gasFreeVolumeEncoders.get(execution),
        pass: 'aggregate',
        passEncoder: { setBindGroup() {} },
        bindGroupLayout: {},
        bindGroupIndex: 0,
        publicEntries: []
      }
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_CONSUMED' }
  );
  assert.equal(
    abandonSphSpatialGasFreeVolumeEosAuthority(action.receipt),
    false
  );

  const fence = deferred();
  const release = releaseSphSpatialGasFreeVolumeExecutionAfter(
    runtime,
    execution,
    fence.promise
  );
  fence.resolve();
  assert.equal(await release, true);
  assert.equal(releaseSchroederSpatialEpochGenerationConsumerLease(
    authority.generationReadFamily,
    { discardedEncoder: true }
  ), true);
  assert.equal(destroySphSpatialGasFreeVolumeGpu(runtime), true);
});

test('gas free-volume EOS authority rejects clones, hostile borrows, duplicate passes, and submit failure without leaking ownership', () => {
  const fake = createFakeDevice();
  const authority = createLiveGasFreeVolumeAuthority(fake);
  const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: authority.generation.execution.cellCapacity,
    fineFieldCapacity: authority.generation.phaseVolumeMoment.fieldCapacity,
    arenaCount: 1
  });
  let execution = encodeGasFreeVolume(runtime, authority);
  let encoder = gasFreeVolumeEncoders.get(execution);
  const publicBuffer = authority.generation.execution.directoryBuffer;
  const publicEntries = [
    { binding: 0, resource: { buffer: publicBuffer } }
  ];
  const actionOptions = (pass, overrides = {}) => ({
    device: fake.device,
    encoder,
    pass,
    passEncoder: { setBindGroup() {} },
    bindGroupLayout: { pass },
    bindGroupIndex: 0,
    publicEntries,
    ...overrides
  });
  const assertUnborrowed = () => {
    assert.equal(
      describeSphSpatialGasFreeVolumeExecution(execution)
        .consumerBorrowedObserved,
      false
    );
  };

  assert.throws(
    () => encodeSphSpatialGasFreeVolumeEosAuthority(
      { ...execution },
      null,
      actionOptions('aggregate')
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_UNBRANDED' }
  );
  assertUnborrowed();
  const other = createFakeDevice();
  assert.throws(
    () => encodeSphSpatialGasFreeVolumeEosAuthority(
      execution,
      null,
      actionOptions('aggregate', { device: other.device })
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_DEVICE_MISMATCH' }
  );
  assertUnborrowed();
  assert.throws(
    () => encodeSphSpatialGasFreeVolumeEosAuthority(
      execution,
      null,
      actionOptions('aggregate', { encoder: createFakeCommandEncoder() })
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_ENCODER_MISMATCH' }
  );
  assertUnborrowed();
  for (const binding of [5, 6]) {
    assert.throws(
      () => encodeSphSpatialGasFreeVolumeEosAuthority(
        execution,
        null,
        actionOptions('aggregate', {
          publicEntries: [{ binding, resource: { buffer: publicBuffer } }]
        })
      ),
      { code: 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_RESERVED_BINDING' }
    );
    assertUnborrowed();
  }
  assert.throws(
    () => encodeSphSpatialGasFreeVolumeEosAuthority(
      execution,
      null,
      actionOptions('aggregate', {
        publicEntries: [
          { binding: 0, resource: { buffer: publicBuffer } },
          { binding: 0, resource: { buffer: publicBuffer } }
        ]
      })
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_ENTRIES_INVALID' }
  );
  assertUnborrowed();

  let reentrantRelease = null;
  const hostileOptions = new Proxy(actionOptions('aggregate'), {
    ownKeys() {
      try {
        reentrantRelease = releaseSphSpatialGasFreeVolumeExecution(
          runtime,
          execution,
          { discardedEncoder: true }
        );
      } catch (error) {
        reentrantRelease = error?.code;
      }
      throw new Error('injected reentrant options trap');
    }
  });
  assert.throws(
    () => encodeSphSpatialGasFreeVolumeEosAuthority(
      execution,
      null,
      hostileOptions
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_OPTIONS_INVALID' }
  );
  assert.equal(
    reentrantRelease,
    'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_BORROWED'
  );
  assertUnborrowed();

  const first = encodeSphSpatialGasFreeVolumeEosAuthority(
    execution,
    null,
    actionOptions('aggregate')
  );
  assert.throws(
    () => submitSphSpatialGasFreeVolumeEosAuthority(
      first.receipt,
      fake.device
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_PASSES_INCOMPLETE' }
  );
  assert.throws(
    () => encodeSphSpatialGasFreeVolumeEosAuthority(
      execution,
      null,
      actionOptions('gradient')
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_BORROWED' }
  );
  assert.equal(
    describeSphSpatialGasFreeVolumeExecution(execution)
      .consumerBorrowedObserved,
    true
  );
  assert.throws(
    () => encodeSphSpatialGasFreeVolumeEosAuthority(
      execution,
      { ...first.receipt },
      actionOptions('gradient')
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_RECEIPT_INVALID' }
  );
  assert.throws(
    () => encodeSphSpatialGasFreeVolumeEosAuthority(
      execution,
      first.receipt,
      actionOptions('aggregate')
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_PASS_REPLAY' }
  );
  assertUnborrowed();
  assert.equal(releaseSphSpatialGasFreeVolumeExecution(
    runtime,
    execution,
    { discardedEncoder: true }
  ), true);
  execution = encodeGasFreeVolume(runtime, authority);
  encoder = gasFreeVolumeEncoders.get(execution);

  assert.throws(
    () => encodeSphSpatialGasFreeVolumeEosAuthority(
      execution,
      null,
      actionOptions('aggregate', {
        passEncoder: {
          setBindGroup() {
            throw new Error('injected setBindGroup failure');
          }
        }
      })
    ),
    /injected setBindGroup failure/
  );
  assertUnborrowed();
  assert.equal(releaseSphSpatialGasFreeVolumeExecution(
    runtime,
    execution,
    { discardedEncoder: true }
  ), true);
  execution = encodeGasFreeVolume(runtime, authority);
  encoder = gasFreeVolumeEncoders.get(execution);

  const action = encodeAllGasFreeVolumeEosPasses(fake, execution, {
    encoder,
    publicEntries
  });
  const submit = fake.device.queue.submit;
  fake.device.queue.submit = () => {
    throw new Error('injected exact EOS submit failure');
  };
  assert.throws(
    () => submitSphSpatialGasFreeVolumeEosAuthority(
      action.receipt,
      fake.device
    ),
    /injected exact EOS submit failure/
  );
  fake.device.queue.submit = submit;
  assertUnborrowed();
  assert.equal(
    isSphSpatialGasFreeVolumeExecutionSubmitted(runtime, execution),
    false
  );
  assert.equal(releaseSphSpatialGasFreeVolumeExecution(
    runtime,
    execution,
    { discardedEncoder: true }
  ), true);
  assert.equal(releaseSchroederSpatialEpochGenerationConsumerLease(
    authority.generationReadFamily,
    { discardedEncoder: true }
  ), true);
  assert.equal(destroySphSpatialGasFreeVolumeGpu(runtime), true);
});

test('gas free-volume exact submitted execution retires at a queue boundary without observing a host fence', () => {
  const fake = createFakeDevice();
  let hostFenceCount = 0;
  fake.device.queue.onSubmittedWorkDone = () => {
    hostFenceCount += 1;
    return new Promise(() => {});
  };
  const authority = createLiveGasFreeVolumeAuthority(fake);
  const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: authority.generation.execution.cellCapacity,
    fineFieldCapacity: authority.generation.phaseVolumeMoment.fieldCapacity,
    arenaCount: 1
  });
  const execution = encodeGasFreeVolume(runtime, authority);
  const clone = { ...execution };
  submitGasFreeVolumeExecution(fake, execution);

  assert.equal(
    canReleaseSphSpatialGasFreeVolumeExecutionQueueOrdered(runtime, clone),
    false
  );
  assert.equal(
    canReleaseSphSpatialGasFreeVolumeExecutionQueueOrdered({}, execution),
    false
  );
  assert.equal(
    canReleaseSphSpatialGasFreeVolumeExecutionQueueOrdered(runtime, execution),
    true
  );
  assert.equal(
    releaseSphSpatialGasFreeVolumeExecutionQueueOrdered(runtime, execution),
    true
  );
  assert.equal(hostFenceCount, 0);
  assert.equal(activeSphSpatialGasFreeVolumeExecutionCount(runtime), 0);
  assert.equal(
    canReleaseSphSpatialGasFreeVolumeExecutionQueueOrdered(runtime, execution),
    false
  );
  assert.throws(
    () => releaseSphSpatialGasFreeVolumeExecutionQueueOrdered(
      runtime,
      execution
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_FOREIGN_EXECUTION' }
  );
  assert.equal(releaseSchroederSpatialEpochGenerationConsumerLease(
    authority.generationReadFamily,
    { discardedEncoder: true }
  ), true);
  assert.equal(destroySphSpatialGasFreeVolumeGpu(runtime), true);
});

test('gas free-volume queue release is single-flight and a refused stale fence cannot release a successor', async () => {
  const fake = createFakeDevice();
  const authority = createLiveGasFreeVolumeAuthority(fake);
  const arenaBufferStart = fake.createdBuffers.length;
  const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: authority.generation.execution.cellCapacity,
    fineFieldCapacity: authority.generation.phaseVolumeMoment.fieldCapacity,
    arenaCount: 1
  });
  const ownedBuffers = fake.createdBuffers.slice(arenaBufferStart);
  assert.equal(ownedBuffers.length, 3);
  const first = encodeGasFreeVolume(runtime, authority);
  submitGasFreeVolumeExecution(fake, first);
  const acceptedFence = deferred();
  const refusedFence = deferred();
  const release = releaseSphSpatialGasFreeVolumeExecutionAfter(
    runtime,
    first,
    acceptedFence.promise
  );
  assert.equal(
    releaseSphSpatialGasFreeVolumeExecutionAfter(
      runtime,
      first,
      acceptedFence.promise
    ),
    release,
    'the exact repeated fence must share one private release promise'
  );
  assert.throws(
    () => releaseSphSpatialGasFreeVolumeExecutionAfter(
      runtime,
      first,
      refusedFence.promise
    ),
    { code: 'ERR_SPH_GAS_FREE_VOLUME_RELEASE_ALREADY_PENDING' }
  );
  acceptedFence.resolve();
  assert.equal(await release, true);

  const successor = encodeGasFreeVolume(runtime, authority);
  refusedFence.resolve();
  await Promise.resolve();
  assert.equal(ownsSphSpatialGasFreeVolumeExecution(runtime, successor), true);
  assert.equal(activeSphSpatialGasFreeVolumeExecutionCount(runtime), 1);
  assert.equal(ownedBuffers.every((buffer) => buffer.destroyCount === 0), true);

  assert.equal(releaseSphSpatialGasFreeVolumeExecution(
    runtime,
    successor,
    { discardedEncoder: true }
  ), true);
  assert.equal(releaseSchroederSpatialEpochGenerationConsumerLease(
    authority.generationReadFamily,
    { discardedEncoder: true }
  ), true);
  assert.equal(destroySphSpatialGasFreeVolumeGpu(runtime), true);
  assert.equal(ownedBuffers.every((buffer) => buffer.destroyCount === 1), true);
});

test('aerosol free-volume derives the sealed family, spans sparse capacity and keeps its EOS receipt private', async () => {
  const fake = createFakeDevice();
  const authority = createLiveAerosolVolumeAuthority(fake);
  const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: authority.generation.execution.layout.cellCapacity,
    fineFieldCapacity: authority.generation.phaseVolumeMoment.fieldCapacity, arenaCount: 1
  });
  const count = fake.createdBuffers.length;
  const execution = encodeGasFreeVolume(runtime, authority);
  assert.deepEqual(execution.aerosol, { version: 1, familyId: authority.family.familyId,
    generation: 0, capacity: 130, projection: 'quadratic-B-QCV-W', dispatchCount: 1 });
  assert.equal(execution.encodedDispatchCount, 5);
  assert.equal(execution.gpuBufferCreationCountDuringEncode, 1);
  assert.equal(fake.createdBuffers.length, count + 1);
  assert.equal(reachableCreatedBuffers([execution, execution.aerosol], fake.createdBuffers).length, 0);
  const params = fake.writes.filter((write) => write.buffer.label?.endsWith('-params')).at(-1);
  assert.deepEqual(Array.from(new Uint32Array(params.data).slice(67)),
    [1, authority.family.familyId, 0, 130, 1]);
  const encoder = gasFreeVolumeEncoders.get(execution);
  const passes = encoder.events.filter((event) => event.kind === 'pass');
  assert.match(passes[2].descriptor.label, /ScatterAerosol$/);
  const scatter = passes[2].commands.find((command) => command.kind === 'dispatch');
  assert.deepEqual([scatter.x, scatter.y, scatter.z], [3, 1, 1]);
  const group = fake.bindGroups.find((entry) => entry.descriptor.label?.endsWith('-scatter-aerosol-bindings'));
  assert.deepEqual(group.descriptor.entries.map((entry) => entry.binding).sort((a, b) => a - b), [0, 6, 7, 8, 9, 10]);
  const parcelBuffer = group.descriptor.entries.find((entry) => entry.binding === 9).resource.buffer;
  const action = encodeAllGasFreeVolumeEosPasses(fake, execution);
  assert.equal(action.aerosol, execution.aerosol);
  assert.equal(action.receipt.aerosol, execution.aerosol);
  assert.equal(reachableCreatedBuffers([action], fake.createdBuffers).length, 0);
  releaseSphAerosolParcelFamily(authority.family);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(parcelBuffer.destroyCount, 0, 'encoded volume still borrows the original parcel source');
  assert.equal(submitSphSpatialGasFreeVolumeEosAuthority(action.receipt, fake.device), true);
  assert.equal(releaseSphSpatialGasFreeVolumeExecutionQueueOrdered(runtime, execution), true);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(parcelBuffer.destroyCount, 0, 'source transaction independently retains its captured reservoir');
  abortSchroederSpatialEpochTransaction(authority.transaction, 'volume test completed');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(parcelBuffer.destroyCount, 1);
  destroySphSpatialGasFreeVolumeGpu(runtime);
});

test('aerosol volume rejects explicit omission/replacement without consuming an arena or mutating its encoder', () => {
  const fake = createFakeDevice(), authority = createLiveAerosolVolumeAuthority(fake);
  const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: authority.generation.execution.layout.cellCapacity,
    fineFieldCapacity: authority.generation.phaseVolumeMoment.fieldCapacity, arenaCount: 1
  });
  for (const aerosolFamily of [null, { ...authority.family }]) {
    const encoder = createFakeCommandEncoder();
    assert.throws(() => encodeSphSpatialGasFreeVolumeGpu(runtime, encoder, {
      gasDirectory: authority.generation.execution, generationReadFamily: authority.generationReadFamily,
      grid: authority.grid, boxMinM: [0, 0, 0], boxMaxM: [2, 2, 2], aerosolFamily
    }), /omitted or replaced/);
    assert.deepEqual(encoder.events, []);
    assert.equal(activeSphSpatialGasFreeVolumeExecutionCount(runtime), 0);
  }
  const execution = encodeGasFreeVolume(runtime, authority);
  assert.equal(releaseSphSpatialGasFreeVolumeExecution(runtime, execution, { discardedEncoder: true }), true);
  destroySphSpatialGasFreeVolumeGpu(runtime); releaseSphAerosolParcelFamily(authority.family);
  abortSchroederSpatialEpochTransaction(authority.transaction, 'volume omission test completed');
});

test('aerosol source mutation rejects binding and submission but does not prevent exact cleanup', async () => {
  for (const atSubmit of [false, true]) {
    const fake = createFakeDevice(), authority = createLiveAerosolVolumeAuthority(fake);
    const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
      cellCapacity: authority.generation.execution.layout.cellCapacity,
      fineFieldCapacity: authority.generation.phaseVolumeMoment.fieldCapacity, arenaCount: 1
    });
    const execution = encodeGasFreeVolume(runtime, authority);
    const action = atSubmit ? encodeAllGasFreeVolumeEosPasses(fake, execution) : null;
    delete authority.sphParticleUpload.aerosolFamily;
    assert.throws(() => atSubmit
      ? submitSphSpatialGasFreeVolumeEosAuthority(action.receipt, fake.device)
      : encodeAllGasFreeVolumeEosPasses(fake, execution), { code: 'ERR_SPH_GAS_FREE_VOLUME_AEROSOL_SOURCE_STALE' });
    if (action) abandonSphSpatialGasFreeVolumeEosAuthority(action.receipt);
    assert.equal(releaseSphSpatialGasFreeVolumeExecution(runtime, execution, { discardedEncoder: true }), true);
    releaseSphAerosolParcelFamily(authority.family);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const buffer = fake.createdBuffers.find((entry) => entry.label === 'ulg-aerosol-initial-population');
    assert.equal(buffer.destroyCount, 0, 'stale consumer cleanup cannot retire the transaction capture');
    abortSchroederSpatialEpochTransaction(authority.transaction, 'stale source fixture discarded');
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.equal(buffer.destroyCount, 1);
    destroySphSpatialGasFreeVolumeGpu(runtime);
  }
});

test('aerosol borrowed volume survives a rejected fence until exact device loss', async () => {
  const fake = createFakeDevice(), authority = createLiveAerosolVolumeAuthority(fake);
  const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: authority.generation.execution.layout.cellCapacity,
    fineFieldCapacity: authority.generation.phaseVolumeMoment.fieldCapacity, arenaCount: 1
  });
  const execution = encodeGasFreeVolume(runtime, authority);
  submitGasFreeVolumeExecution(fake, execution);
  const parcel = fake.createdBuffers.find((buffer) => buffer.label === 'ulg-aerosol-initial-population');
  releaseSphAerosolParcelFamily(authority.family);
  await assert.rejects(releaseSphSpatialGasFreeVolumeExecutionAfter(runtime, execution,
    Promise.reject(new Error('unconfirmed queue fence'))), /unconfirmed/);
  assert.equal(ownsSphSpatialGasFreeVolumeExecution(runtime, execution), true);
  assert.equal(parcel.destroyCount, 0);
  const release = releaseSphSpatialGasFreeVolumeExecutionAfterDeviceLoss(runtime, execution, fake.device.lost);
  fake.resolveLost({ reason: 'destroyed' });
  assert.equal(await release, true);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(parcel.destroyCount, 1);
  destroySphSpatialGasFreeVolumeGpu(runtime);
});

test('aerosol scatter allocation is retained across executions; absence still dispatches only the original passes', () => {
  const fake = createFakeDevice(), aerosol = createLiveAerosolVolumeAuthority(fake);
  const absent = createLiveGasFreeVolumeAuthority(fake);
  const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: aerosol.generation.execution.layout.cellCapacity,
    fineFieldCapacity: aerosol.generation.phaseVolumeMoment.fieldCapacity, arenaCount: 1
  });
  const first = encodeGasFreeVolume(runtime, aerosol);
  releaseSphSpatialGasFreeVolumeExecution(runtime, first, { discardedEncoder: true });
  const count = fake.createdBuffers.length, pipelines = fake.pipelines.length;
  const second = encodeGasFreeVolume(runtime, aerosol);
  assert.equal(second.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(fake.createdBuffers.length, count); assert.equal(fake.pipelines.length, pipelines);
  releaseSphSpatialGasFreeVolumeExecution(runtime, second, { discardedEncoder: true });
  const third = encodeGasFreeVolume(runtime, absent);
  assert.equal(third.aerosol, null); assert.equal(third.encodedDispatchCount, 4);
  assert.equal(fake.createdBuffers.length, count); assert.equal(fake.pipelines.length, pipelines);
  const write = fake.writes.filter((entry) => entry.buffer.label?.endsWith('-params')).at(-1);
  assert.deepEqual(Array.from(new Uint32Array(write.data).slice(67)), [0, 0, 0, 0, 0]);
  releaseSphSpatialGasFreeVolumeExecution(runtime, third, { discardedEncoder: true });
  destroySphSpatialGasFreeVolumeGpu(runtime); releaseSphAerosolParcelFamily(aerosol.family);
  abortSchroederSpatialEpochTransaction(aerosol.transaction, 'retained arena fixture completed');
});

test('gas free-volume rejected queue fence leaves ownership intact for an exact retry', async () => {
  const fake = createFakeDevice();
  const authority = createLiveGasFreeVolumeAuthority(fake);
  const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: authority.generation.execution.cellCapacity,
    fineFieldCapacity: authority.generation.phaseVolumeMoment.fieldCapacity,
    arenaCount: 1
  });
  const execution = encodeGasFreeVolume(runtime, authority);
  submitGasFreeVolumeExecution(fake, execution);
  const rejectedFence = deferred();
  const rejectedRelease = releaseSphSpatialGasFreeVolumeExecutionAfter(
    runtime,
    execution,
    rejectedFence.promise
  );
  const rejection = new Error('injected ordinary queue-fence rejection');
  rejectedFence.reject(rejection);
  await assert.rejects(rejectedRelease, rejection);
  assert.equal(ownsSphSpatialGasFreeVolumeExecution(runtime, execution), true);
  assert.equal(activeSphSpatialGasFreeVolumeExecutionCount(runtime), 1);

  const retryFence = deferred();
  const retry = releaseSphSpatialGasFreeVolumeExecutionAfter(
    runtime,
    execution,
    retryFence.promise
  );
  retryFence.resolve();
  assert.equal(await retry, true);
  assert.equal(activeSphSpatialGasFreeVolumeExecutionCount(runtime), 0);
  assert.equal(releaseSchroederSpatialEpochGenerationConsumerLease(
    authority.generationReadFamily,
    { discardedEncoder: true }
  ), true);
  assert.equal(destroySphSpatialGasFreeVolumeGpu(runtime), true);
});

test('gas free-volume stale device-loss completion cannot retire a reissued successor arena', async () => {
  const fake = createFakeDevice();
  const authority = createLiveGasFreeVolumeAuthority(fake);
  const arenaBufferStart = fake.createdBuffers.length;
  const runtime = createSphSpatialGasFreeVolumeGpu(fake.device, {
    cellCapacity: authority.generation.execution.cellCapacity,
    fineFieldCapacity: authority.generation.phaseVolumeMoment.fieldCapacity,
    arenaCount: 1
  });
  const ownedBuffers = fake.createdBuffers.slice(arenaBufferStart);
  assert.equal(ownedBuffers.length, 3);
  const first = encodeGasFreeVolume(runtime, authority);
  const staleLossRelease = releaseSphSpatialGasFreeVolumeExecutionAfterDeviceLoss(
    runtime,
    first,
    fake.device.lost
  );
  assert.equal(
    releaseSphSpatialGasFreeVolumeExecutionAfterDeviceLoss(
      runtime,
      first,
      fake.device.lost
    ),
    staleLossRelease,
    'the exact repeated device-loss evidence must share one private promise'
  );
  assert.equal(releaseSphSpatialGasFreeVolumeExecution(
    runtime,
    first,
    { discardedEncoder: true }
  ), true);
  const successor = encodeGasFreeVolume(runtime, authority);

  fake.resolveLost({ message: 'injected deferred device loss' });
  assert.equal(await staleLossRelease, false);
  assert.equal(ownsSphSpatialGasFreeVolumeExecution(runtime, successor), true);
  assert.equal(activeSphSpatialGasFreeVolumeExecutionCount(runtime), 1);
  assert.equal(ownedBuffers.every((buffer) => buffer.destroyCount === 0), true);

  assert.equal(releaseSphSpatialGasFreeVolumeExecution(
    runtime,
    successor,
    { discardedEncoder: true }
  ), true);
  assert.equal(destroySphSpatialGasFreeVolumeGpu(runtime), true);
  assert.equal(ownedBuffers.every((buffer) => buffer.destroyCount === 1), true);
});
