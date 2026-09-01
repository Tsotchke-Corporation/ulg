import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
  validateSchroederSpatialMechanicsFieldViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
  createSchroederSpatialActiveSourceViewLayout
} from '../ulg-gpu-abi/src/schroederSpatialActiveSourceView.js';
import {
  SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
  ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
  createSchroederSpatialEpochV2Layout
} from '../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_READY,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_VERSION
} from '../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
  ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
  createSchroederSpatialMechanicsViewPlan
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  createSchroederSpatialMechanicsFieldPairGpu
} from '../src/runtime/sph/schroederSpatialMechanicsFieldPairGpu.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const RUN_NATIVE_COMPILE =
  process.env.ULG_RUN_NATIVE_MECHANICS_FIELD_PAIR_COMPILE === '1';
const NATIVE_BASE_URL = process.env.ULG_MECHANICS_FIELD_PAIR_BASE_URL
  || 'https://127.0.0.1:5174/';
const PAIR_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanics-field-pair.v1';
const FINE_GRID = Object.freeze({
  gridNodeCount: 8,
  gridDims: Object.freeze([2, 2, 2]),
  gridShift: 1,
  gridSpacingM: 0.25
});
const COARSE_GRID = Object.freeze({
  gridNodeCount: 8,
  gridDims: Object.freeze([2, 2, 2]),
  gridShift: 1,
  gridSpacingM: 0.5
});
const INVALID_KEY = 0xffff_ffff;

function pairProjectionFlags(key, fineNodeCount, combinedNodeSpan) {
  const keyValid = key !== INVALID_KEY && key < combinedNodeSpan;
  return {
    fineTail: !(keyValid && key < fineNodeCount),
    coarseTail: !(keyValid && key >= fineNodeCount)
  };
}

function serialPairProjectionOracle({
  candidateKeys,
  sortedCandidateIndices,
  fineNodeCount,
  combinedNodeSpan
}) {
  const finePrefix = [];
  const coarsePrefix = [];
  for (const candidate of sortedCandidateIndices) {
    const flags = pairProjectionFlags(
      candidateKeys[candidate],
      fineNodeCount,
      combinedNodeSpan
    );
    if (!flags.fineTail) finePrefix.push(candidate);
    if (!flags.coarseTail) coarsePrefix.push(candidate);
  }
  const fineTail = [];
  const coarseTail = [];
  for (let candidate = 0; candidate < candidateKeys.length; candidate += 1) {
    const flags = pairProjectionFlags(
      candidateKeys[candidate],
      fineNodeCount,
      combinedNodeSpan
    );
    if (flags.fineTail) fineTail.push(candidate);
    if (flags.coarseTail) coarseTail.push(candidate);
  }
  return {
    fine: [...finePrefix, ...fineTail],
    coarse: [...coarsePrefix, ...coarseTail]
  };
}

function parallelPairProjectionOracle({
  candidateKeys,
  sortedCandidateIndices,
  fineNodeCount,
  combinedNodeSpan
}) {
  const flags = candidateKeys.map((key) => pairProjectionFlags(
    key,
    fineNodeCount,
    combinedNodeSpan
  ));
  const ranks = [];
  let fineTailCount = 0;
  let coarseTailCount = 0;
  for (const candidateFlags of flags) {
    ranks.push({
      fine: fineTailCount,
      coarse: coarseTailCount
    });
    fineTailCount += Number(candidateFlags.fineTail);
    coarseTailCount += Number(candidateFlags.coarseTail);
  }
  const finePrefix = sortedCandidateIndices.filter(
    (candidate) => !flags[candidate].fineTail
  );
  const coarsePrefix = sortedCandidateIndices.filter(
    (candidate) => !flags[candidate].coarseTail
  );
  const fine = Array(candidateKeys.length);
  const coarse = Array(candidateKeys.length);
  finePrefix.forEach((candidate, position) => { fine[position] = candidate; });
  coarsePrefix.forEach((candidate, position) => {
    coarse[position] = candidate;
  });
  for (let candidate = 0; candidate < candidateKeys.length; candidate += 1) {
    if (flags[candidate].fineTail) {
      fine[finePrefix.length + ranks[candidate].fine] = candidate;
    }
    if (flags[candidate].coarseTail) {
      coarse[coarsePrefix.length + ranks[candidate].coarse] = candidate;
    }
  }
  return { fine, coarse };
}

function stableCandidateOrder(candidateKeys) {
  return candidateKeys
    .map((_, candidate) => candidate)
    .sort((left, right) => (
      candidateKeys[left] - candidateKeys[right] || left - right
    ));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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
          event.commands.push({
            pipeline,
            bindGroup,
            dispatchIndirect: { buffer, byteOffset }
          });
        },
        end() { event.ended = true; }
      };
    },
    finish() {
      return {
        label: 'mechanics-field-pair-test-command-buffer',
        events
      };
    }
  };
}

function createFakeDevice({
  limits: limitOverrides = {},
  lost = null
} = {}) {
  const buffers = [];
  const bindGroups = [];
  const submissions = [];
  const encoders = [];
  const writes = [];
  const queueFences = [];
  const device = {
    buffers,
    bindGroups,
    submissions,
    encoders,
    writes,
    queueFences,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 12,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256,
      ...limitOverrides
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : new Uint8Array(data);
        writes.push({ buffer, offset, data: bytes.slice() });
      },
      submit(commandBuffers) { submissions.push(commandBuffers); },
      onSubmittedWorkDone() {
        const fence = Promise.resolve();
        queueFences.push(fence);
        return fence;
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
    createCommandEncoder() {
      const encoder = createFakeEncoder();
      encoders.push(encoder);
      return encoder;
    }
  };
  if (lost) device.lost = lost;
  return device;
}

function createOwnedTestBuffer(device, descriptor) {
  return tagWebGpuBufferDevice(device.createBuffer(descriptor), device);
}

function createDirectoryV2PairFixture(device, {
  physicalSourceCount = 4,
  physicalSourceCapacity = 8,
  activeSourceCapacity = physicalSourceCapacity,
  buildOrdinal = 37
} = {}) {
  const sourceBuffer = createOwnedTestBuffer(device, {
    label: 'mechanics-field-pair-source',
    size: physicalSourceCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const identityBuffer = createOwnedTestBuffer(device, {
    label: 'mechanics-field-pair-identity',
    size: physicalSourceCount * UINT32_BYTES,
    usage: 128
  });
  const identity = Object.freeze({
    generationId: 41,
    deviceOrdinal: 2,
    laneOrdinal: 3,
    leaseToken: 5,
    sourceFamilyId: 7,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31
  });
  const activeLayout = createSchroederSpatialActiveSourceViewLayout({
    physicalSourceCapacity,
    activeSourceCapacity
  });
  const activeSourceViewBuffer = createOwnedTestBuffer(device, {
    label: 'mechanics-field-pair-active-source-view',
    size: activeLayout.byteLength,
    usage: 128 | 256
  });
  let activeSourceView;
  const activeOwner = {
    ownsExecution(execution) {
      return execution === activeSourceView;
    }
  };
  activeSourceView = {
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
    status: 'schroeder-spatial-active-source-view-gpu-encoded',
    ready: true,
    selected: true,
    submitPerformed: false,
    sourceBuffer,
    activeSourceViewBuffer,
    layout: activeLayout,
    physicalSourceCount,
    physicalSourceCapacity,
    activeSourceCapacity,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceRowStrideFloats: 16,
    ...identity,
    buildOrdinal,
    sourceFingerprint: 0x1234_5678,
    activeDispatchOffsetBytes: activeLayout.activeDispatchOffsetBytes,
    candidateDispatchOffsetBytes: activeLayout.candidateDispatchOffsetBytes,
    physicalDispatchOffsetBytes: activeLayout.physicalDispatchOffsetBytes,
    ownerRuntime: activeOwner
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
  const directoryLayout = createSchroederSpatialEpochV2Layout({
    physicalSourceCapacity,
    activeSourceCapacity,
    cellCapacity: activeSourceCapacity
  });
  const directoryBuffer = createOwnedTestBuffer(device, {
    label: 'mechanics-field-pair-directory',
    size: directoryLayout.byteLength,
    usage: 128
  });
  let spatialExecution;
  const spatialOwner = {
    ownsExecution(execution) {
      return execution === spatialExecution;
    }
  };
  spatialExecution = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
    status: 'schroeder-spatial-epoch-v2-gpu-encoded',
    abiVersion: SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
    reverseEncoding: SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
    submitPerformed: false,
    sourceBuffer,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceRowStrideFloats: 16,
    physicalSourceCount,
    physicalSourceCapacity,
    activeSourceCapacity,
    ...identity,
    buildOrdinal,
    layout: directoryLayout,
    directoryBuffer,
    activeSourceView,
    activeSourceViewBuffer,
    activeSourceCountAuthority,
    ownerRuntime: spatialOwner
  };

  let parentSubmitted = false;
  const parentMechanicsViews = [];
  // Fine and coarse compact views may legitimately share one retained compact
  // runtime. Pair ownership must not mistake that for aliased field ownership.
  const parentOwner = {
    ownsExecution(execution) {
      return parentMechanicsViews.includes(execution);
    },
    isExecutionSubmitted(execution) {
      return parentSubmitted && parentMechanicsViews.includes(execution);
    }
  };
  for (const [selectedLevel, grid] of [
    [0, FINE_GRID],
    [1, COARSE_GRID]
  ]) {
    const parentPlan = createSchroederSpatialMechanicsViewPlan({
      sourceCount: physicalSourceCount,
      sourceRowLayoutId:
        SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
      directoryAbiVersion:
        SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
      selectedLevel,
      gridNodeCount: grid.gridNodeCount,
      gridDims: grid.gridDims,
      gridShift: grid.gridShift,
      gridSpacingM: grid.gridSpacingM,
      ...identity,
      completionOrdinal: buildOrdinal
    });
    const mechanicsViewBuffer = createOwnedTestBuffer(device, {
      label: `mechanics-field-pair-parent-level-${selectedLevel}`,
      size: parentPlan.layout.byteLength,
      usage: 128 | 256
    });
    parentMechanicsViews.push({
      ...parentPlan,
      schema: ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
      status: 'schroeder-spatial-mechanics-view-gpu-encoded',
      submitPerformed: false,
      released: false,
      sourceBuffer,
      sourceAuthorityVersion:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
      directorySchema: ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
      directoryAbiVersion:
        SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
      sourceWorkIdentity:
        SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY,
      physicalSourceCount,
      spatialExecution,
      directoryBuffer,
      activeSourceView,
      activeSourceViewBuffer,
      activeSourceCountAuthority,
      activeSourceDispatchOffsetBytes: activeLayout.activeDispatchOffsetBytes,
      mechanicsViewBuffer,
      indirectDispatchBuffer: mechanicsViewBuffer,
      indirectDispatchOffsetBytes:
        parentPlan.layout.dispatchOffsetWords * UINT32_BYTES,
      ownerRuntime: parentOwner
    });
  }

  return {
    sourceBuffer,
    identityBuffer,
    physicalSourceCount,
    activeSourceView,
    activeSourceCountAuthority,
    spatialExecution,
    parentMechanicsViews,
    levelViews: parentMechanicsViews.map((parentMechanicsView) => ({
      selectedLevel: parentMechanicsView.selectedLevel,
      parentMechanicsView
    })),
    markParentsSubmitted() {
      parentSubmitted = true;
      for (const parent of parentMechanicsViews) {
        parent.status =
          'schroeder-spatial-mechanics-view-gpu-build-submitted';
        parent.submitPerformed = true;
      }
    },
    borrowedBuffers: [
      sourceBuffer,
      identityBuffer,
      activeSourceViewBuffer,
      directoryBuffer,
      ...parentMechanicsViews.map(({ mechanicsViewBuffer }) => (
        mechanicsViewBuffer
      ))
    ]
  };
}

function createPairRuntime(device, {
  maxPhysicalSourceCount = 8,
  activeSourceCapacity = maxPhysicalSourceCount,
  arenaCount = 1,
  label = 'ulg-schroeder-spatial-mechanics-field-pair-test'
} = {}) {
  return createSchroederSpatialMechanicsFieldPairGpu(device, {
    maxPhysicalSourceCount,
    activeSourceCapacity,
    levelGrids: [FINE_GRID, COARSE_GRID],
    identityStrideWords: 1,
    arenaCount,
    label
  });
}

function encodePair(
  runtime,
  device,
  fixture,
  encoder = device.createCommandEncoder(),
  extra = {}
) {
  const execution = runtime.encode(encoder, {
    sourceBuffer: fixture.sourceBuffer,
    identityBuffer: fixture.identityBuffer,
    sourceCount: fixture.physicalSourceCount,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    identityStrideWords: 1,
    levelViews: fixture.levelViews,
    ...extra
  });
  return { execution, encoder };
}

test('paired mechanics-field construction publishes two exact v5 children from one shared radix', async () => {
  const device = createFakeDevice();
  const fixture = createDirectoryV2PairFixture(device);
  const runtime = createPairRuntime(device);
  const retainedBufferCount = device.buffers.length;
  const { execution: pair, encoder } = encodePair(runtime, device, fixture);

  assert.equal(device.buffers.length, retainedBufferCount);
  assert.equal(pair.schema, PAIR_SCHEMA);
  assert.equal(pair.status, 'schroeder-spatial-mechanics-field-pair-gpu-encoded');
  assert.equal(pair.readbackPerformed, false);
  assert.equal(pair.submitPerformed, false);
  assert.equal(pair.mechanicsFieldViews.length, 2);
  assert.equal(runtime.ownsExecution(pair), true);
  assert.equal(
    fixture.parentMechanicsViews[0].ownerRuntime,
    fixture.parentMechanicsViews[1].ownerRuntime,
    'shared compact-parent ownership is a valid input'
  );

  const [fine, coarse] = pair.mechanicsFieldViews;
  for (const [ordinal, child] of pair.mechanicsFieldViews.entries()) {
    const grid = [FINE_GRID, COARSE_GRID][ordinal];
    assert.equal(child.schema, ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA);
    assert.equal(child.pairExecution, pair);
    assert.equal(child.ownerRuntime, runtime);
    assert.equal(runtime.ownsExecution(child), true);
    assert.equal(child.selectedLevel, ordinal);
    assert.equal(child.gridNodeCount, grid.gridNodeCount);
    assert.deepEqual(Array.from(child.gridDims), Array.from(grid.gridDims));
    assert.equal(child.gridShift, grid.gridShift);
    assert.equal(child.gridSpacingM, grid.gridSpacingM);
    assert.equal(child.parentMechanicsView, fixture.parentMechanicsViews[ordinal]);
    assert.equal(child.sourceBuffer, fixture.sourceBuffer);
    assert.equal(child.identityBuffer, fixture.identityBuffer);
    assert.equal(child.spatialExecution, fixture.spatialExecution);
    assert.equal(
      child.activeSourceCountAuthority,
      fixture.activeSourceCountAuthority
    );
    assert.equal(child.sourceAuthorityVersion,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2);
    assert.equal(child.candidateCount, null);
    assert.equal(child.readbackPerformed, false);
    assert.equal(child.stableCandidateOrderCountAuthority.buffer,
      fixture.activeSourceView.activeSourceViewBuffer);
    assert.equal(child.stableCandidateOrderCountAuthority.offsetWords, 43);
    assert.equal(child.stableCandidateOrderCountAuthority.sealOffsetWords, 30);
    assert.equal(
      child.stableCandidateOrderPolicy,
      'stable-radix-equal-key-preserves-particle-stencil-candidate-order'
    );
  }
  assert.notEqual(fine.fieldViewBuffer, coarse.fieldViewBuffer);
  assert.notEqual(
    fine.stableCandidateOrderBuffer,
    coarse.stableCandidateOrderBuffer,
    'one shared radix is projected into exact child-local P2G index streams'
  );
  assert.equal(fine.pairExecution, coarse.pairExecution);

  const radixOwners = runtime.allocationEntries().filter(({ role }) => (
    role.endsWith('radix-gpu-count-control')
  ));
  assert.equal(radixOwners.length, 1, 'one arena retains one shared radix owner');
  const projectionScratch = runtime.allocationEntries().filter(({ role }) => (
    role === 'mechanics-field-pair-stable-order-projection-scan'
  ));
  assert.equal(
    projectionScratch.length,
    1,
    'one arena retains one packed dual-predicate projection scan'
  );
  assert.equal(
    pair.stableOrderProjectionPolicy,
    'gpu-authenticated-dual-predicate-exclusive-scan-stable-scatter'
  );
  assert.equal(pair.stableOrderProjectionEncodedIndirectDispatchCount, 8);
  assert.equal(pair.stableOrderProjectionHostCountReadbackRequired, false);
  assert.equal(
    projectionScratch[0].buffer.size,
    pair.stableOrderProjectionScratchBytes
  );
  const passes = encoder.events.filter(({ kind }) => kind === 'pass');
  const groupedRadixPasses = passes.filter(({ descriptor }) => (
    descriptor.label?.endsWith('GroupedGpuCountRadixUnique')
  ));
  assert.equal(groupedRadixPasses.length, 1);
  assert.equal(
    pair.encodedComputePassCount,
    passes.length,
    'published topology count covers every paired and shared-radix pass'
  );
  assert.equal(
    pair.encodedDispatchCount,
    passes.reduce((sum, { commands }) => sum + commands.length, 0),
    'published dispatch count covers the exact command topology'
  );
  assert.equal(pair.radixSortKeyWordCount, 3);
  assert.equal(pair.radixPassCount, 16);
  assert.deepEqual(pair.radixSignificantDigitRows, [
    0, 1, 2, 3, 4, 5, 6, 7,
    8, 9, 10, 11, 12, 13, 14,
    16
  ]);
  assert.deepEqual(fine.radixSignificantDigitRows, pair.radixSignificantDigitRows);
  assert.deepEqual(coarse.radixSignificantDigitRows, pair.radixSignificantDigitRows);
  assert.equal(pair.encodedDispatchCount, 68);
  assert.equal(pair.encodedComputePassCount, 9);
  assert.equal(pair.sharedRadixExecutionCount, 1);
  assert.equal(
    pair.candidateCountAuthority.buffer,
    fixture.activeSourceView.activeSourceViewBuffer
  );
  assert.equal(pair.candidateCountAuthority.offsetWords, 43);
  assert.equal(
    pair.candidateCountAuthority.multiplier,
    1,
    'active-view word 43 is already the exact A×27 candidate count'
  );
  assert.equal(pair.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(pair.bufferAllocationCountDuringEncode, 0);
  const projectionPass = passes.find(({ descriptor }) => (
    descriptor.label?.endsWith('ParallelStableOrderProjection')
  ));
  assert.equal(projectionPass?.commands.length, 8);
  const projectionDispatch = runtime.allocationEntries().find(({ role }) => (
    role === 'mechanics-field-pair-stable-order-projection-dispatch'
  ))?.buffer;
  assert.ok(projectionPass.commands.every(({ dispatchIndirect }) => (
    dispatchIndirect?.buffer === projectionDispatch
  )));

  fixture.markParentsSubmitted();
  assert.equal(runtime.markExecutionSubmitted(coarse), true);
  assert.equal(runtime.isExecutionSubmitted(pair), true);
  assert.equal(runtime.isExecutionSubmitted(fine), true);
  assert.equal(runtime.isExecutionSubmitted(coarse), true);
  for (const child of pair.mechanicsFieldViews) {
    assert.equal(
      validateSchroederSpatialMechanicsFieldViewDescriptor(child).admitted,
      true
    );
  }
  assert.equal(await runtime.releaseExecutionAfter(coarse), true);
  assert.equal(pair.released, true);
  assert.equal(fine.released, true);
  assert.equal(coarse.released, true);
  assert.equal(runtime.destroy(), true);
});

test('parallel projection retains one exact partition timestamp span across its bounded passes', () => {
  const device = createFakeDevice();
  const fixture = createDirectoryV2PairFixture(device);
  const runtime = createPairRuntime(device);
  const begins = [];
  const ends = [];
  const recorder = {
    active: true,
    beginEncoderSpan(_encoder, descriptor) {
      const token = { descriptor };
      begins.push(token);
      return token;
    },
    endEncoderSpan(_encoder, token) {
      ends.push(token);
    }
  };
  const { execution: pair } = encodePair(
    runtime,
    device,
    fixture,
    device.createCommandEncoder(),
    {
      gpuTimestampRecorder: recorder,
      timestampMetadata: { diagnosticLane: 'parallel-projection-test' }
    }
  );
  const partitionBegins = begins.filter(({ descriptor }) => (
    descriptor.producerId
      === 'schroeder-spatial-mechanics-field-pair-partition'
  ));
  assert.equal(partitionBegins.length, 1);
  assert.equal(
    partitionBegins[0].descriptor.stage,
    'parallel-partition-and-stable-order-projection'
  );
  assert.equal(
    partitionBegins[0].descriptor.diagnosticLane,
    'parallel-projection-test'
  );
  assert.equal(ends.filter((token) => token === partitionBegins[0]).length, 1);
  assert.equal(
    runtime.releaseExecution(pair, { discardedEncoder: true }),
    true
  );
  assert.equal(runtime.destroy(), true);
});

test('paired field retains physical P while authenticating exact active tier A', () => {
  const device = createFakeDevice();
  const physicalSourceCapacity = 20_000;
  const activeSourceCapacity = 4_500;
  const fixture = createDirectoryV2PairFixture(device, {
    physicalSourceCount: physicalSourceCapacity,
    physicalSourceCapacity,
    activeSourceCapacity
  });
  const runtime = createPairRuntime(device, {
    maxPhysicalSourceCount: physicalSourceCapacity,
    activeSourceCapacity
  });
  const { execution: pair } = encodePair(runtime, device, fixture);
  const expectedCandidateCapacity = activeSourceCapacity * 27;

  assert.equal(runtime.maxPhysicalSourceCount, physicalSourceCapacity);
  assert.equal(runtime.maxSourceCount, physicalSourceCapacity);
  assert.equal(runtime.activeSourceCapacity, activeSourceCapacity);
  assert.equal(runtime.pairCandidateCapacity, expectedCandidateCapacity);
  assert.equal(pair.sourceCapacity, physicalSourceCapacity);
  assert.equal(pair.activeSourceCapacity, activeSourceCapacity);
  assert.equal(pair.pairCandidateCapacity, expectedCandidateCapacity);
  assert.deepEqual(
    Array.from(runtime.stableOrderProjectionScanLevelCounts),
    [121_500, 238]
  );
  assert.equal(runtime.stableOrderProjectionScratchBytes, 973_904);
  assert.equal(pair.stableOrderProjectionScratchBytes, 973_904);
  assert.equal(
    runtime.allocationEntries().find(({ role }) => (
      role === 'mechanics-field-pair-stable-order-projection-dispatch'
    ))?.buffer.size,
    96
  );
  assert.equal(
    runtime.allocationEntries().find(({ role }) => (
      role === 'mechanics-field-pair-control'
    ))?.buffer.size,
    80
  );
  for (const child of pair.mechanicsFieldViews) {
    assert.equal(child.sourceCapacity, physicalSourceCapacity);
    assert.equal(child.activeSourceCapacity, activeSourceCapacity);
    assert.equal(child.layout.sourceCapacity, physicalSourceCapacity);
    assert.equal(child.candidateCapacity, expectedCandidateCapacity);
    assert.equal(child.fieldCapacity, expectedCandidateCapacity);
    assert.equal(child.layout.candidateCapacity, expectedCandidateCapacity);
    assert.equal(child.layout.fieldCapacity, expectedCandidateCapacity);
  }
  assert.equal(pair.readbackPerformed, false);
  assert.equal(runtime.releaseExecution(pair, { discardedEncoder: true }), true);

  const forgedFixture = createDirectoryV2PairFixture(device, {
    physicalSourceCount: physicalSourceCapacity,
    physicalSourceCapacity,
    activeSourceCapacity: activeSourceCapacity + 1
  });
  assert.throws(
    () => encodePair(runtime, device, forgedFixture),
    /active|capacity|authority|lineage|exact/i,
    'a forged A+1 lineage cannot borrow the retained A-tier buffers'
  );
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.destroy(), true);
});

test('all-active P8192 tier retains the exact bounded projection hierarchy', () => {
  const device = createFakeDevice();
  const runtime = createPairRuntime(device, {
    maxPhysicalSourceCount: 8_192,
    activeSourceCapacity: 8_192
  });
  assert.equal(runtime.pairCandidateCapacity, 221_184);
  assert.equal(runtime.stableOrderProjectionScanLevelCount, 2);
  assert.deepEqual(
    Array.from(runtime.stableOrderProjectionScanLevelCounts),
    [221_184, 432]
  );
  assert.equal(runtime.stableOrderProjectionScratchBytes, 1_772_928);
  assert.equal(runtime.stableOrderProjectionEncodedIndirectDispatchCount, 8);
  assert.equal(runtime.stableOrderProjectionHostCountReadbackRequired, false);
  assert.equal(runtime.destroy(), true);
});

test('paired WGSL keeps disjoint monotone levels, material, and solid domains in one stable total order', () => {
  const source = readFileSync(
    new URL(
      '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldPairWgsl.js',
      import.meta.url
    ),
    'utf8'
  );
  assert.match(
    source,
    /let\s+combined_node\s*=\s*node[\s\S]{0,120}select\(\s*params\.fine_grid_node_count\s*,\s*0u\s*,\s*level_ordinal\s*==\s*0u\s*\)/,
    'coarse keys occupy the monotone range immediately after fine nodes'
  );
  assert.match(
    source,
    /combined_node\s*-\s*params\.fine_grid_node_count/,
    'child materialization restores coarse child-local node ordering'
  );
  assert.match(
    source,
    /(?:mechanical_family_id|family)\s*<<\s*24u[\s\S]{0,120}(?:material_id|material)/,
    'mechanical family and material remain distinct packed-key components'
  );
  assert.match(
    source,
    /select\(\s*0u\s*,\s*(?:identity_id|identity)\s*,\s*(?:mechanical_family_id|family)\s*==\s*1u\s*\)/,
    'solid identity is retained as a continuity domain while fluids use domain zero'
  );
  assert.match(
    source,
    /stable[\s\S]{0,100}(?:candidate|radix)|(?:candidate|radix)[\s\S]{0,100}stable/i
  );
  assert.match(
    source,
    /active_count\s*\*\s*27u/,
    'canonical active ordinals are expanded once to the exact A×27 radix input'
  );
  assert.match(
    source,
    /fn\s+pair_quadratic_weight_at\([\s\S]*fraction\s*-\s*0\.5[\s\S]*let\s+support_weight\s*=[\s\S]*if\s*\(support_weight\s*==\s*0\.0\)\s*\{[\s\S]*pair_write_invalid_candidate\(candidate_index\);[\s\S]*continue;[\s\S]*let\s+node\s*=\s*pair_grid_index/,
    'exact-zero quadratic support is omitted before field keys or clipping evidence'
  );
  assert.doesNotMatch(
    source,
    /active_count\s*\*\s*54u|candidate_count\s*\*\s*2u/,
    'paired construction must not duplicate candidate emission per level'
  );
  assert.match(
    source,
    /var<workgroup>\s+pair_scan_values:\s*array<vec2<u32>,\s*512>/,
    'fine and coarse tail predicates share one packed retained scan'
  );
  assert.match(
    source,
    /fn\s+scan_pair_tail_level\([\s\S]*pair_scan_values\[right\]\s*=[\s\S]*pair_scan_values\[right\]\s*\+\s*pair_scan_values\[left\]/,
    'projection uses a bounded parallel exclusive scan hierarchy'
  );
  assert.match(
    source,
    /let\s+destination\s*=\s*fine_valid_count\s*\+\s*ranks\.x[\s\S]*fine_stable_order\[destination\]\s*=\s*position[\s\S]*let\s+destination\s*=\s*coarse_valid_count\s*\+\s*ranks\.y[\s\S]*coarse_stable_order\[destination\]\s*=\s*position/,
    'canonical candidate ranks append both non-child tails after valid prefixes'
  );
  assert.doesNotMatch(
    source,
    /fn\s+partition_pair_unique_and_stable_order|for\s*\(\s*var\s+candidate\s*=\s*0u;\s*candidate\s*<\s*candidate_count/,
    'no single invocation serially traverses the complete candidate domain'
  );
  assert.match(
    source,
    /fine_store\(\s*fine_destination\s*,\s*FIELD_INVALID_KEY\s*\)[\s\S]*coarse_store\(\s*coarse_destination\s*,\s*FIELD_INVALID_KEY\s*\)/,
    'opposite-child stencil slots fail closed to UINT_MAX'
  );
  const fineSentinelWord = Number(
    /const\s+PAIR_CONTROL_FINE_SENTINEL_PRESENT:\s*u32\s*=\s*(\d+)u/.exec(
      source
    )?.[1]
  );
  const coarseSentinelWord = Number(
    /const\s+PAIR_CONTROL_COARSE_SENTINEL_PRESENT:\s*u32\s*=\s*(\d+)u/.exec(
      source
    )?.[1]
  );
  assert.equal(Number.isInteger(fineSentinelWord), true);
  assert.equal(Number.isInteger(coarseSentinelWord), true);
  assert.notEqual(
    fineSentinelWord,
    coarseSentinelWord,
    'fine and coarse sentinel presence have distinct control words'
  );
  assert.match(
    source,
    /pair_store\(\s*PAIR_CONTROL_FINE_SENTINEL_PRESENT\s*,\s*select\(\s*0u\s*,\s*1u\s*,\s*fine_valid_candidate_count\s*<\s*candidate_count\s*\)\s*\)/,
    'other-level or clipped candidates mark the fine child sentinel'
  );
  assert.match(
    source,
    /pair_store\(\s*PAIR_CONTROL_COARSE_SENTINEL_PRESENT\s*,\s*select\(\s*0u\s*,\s*1u\s*,\s*coarse_valid_candidate_count\s*<\s*candidate_count\s*\)\s*\)/,
    'other-level or clipped candidates mark the coarse child sentinel'
  );
  assert.match(
    source,
    /let\s+child_sentinel_present\s*=\s*select\(\s*pair_load\(\s*PAIR_CONTROL_COARSE_SENTINEL_PRESENT\s*\)\s*,\s*pair_load\(\s*PAIR_CONTROL_FINE_SENTINEL_PRESENT\s*\)\s*,\s*fine\s*\)[\s\S]{0,100}let\s+child_unique_count\s*=\s*field_count\s*\+\s*child_sentinel_present/,
    'child-local sentinel evidence feeds the published unique count'
  );
  assert.match(
    source,
    /params\.pair_candidate_capacity\s*==\s*active_capacity\s*\*\s*27u/,
    'the GPU admits only the exact authenticated A×27 candidate tier'
  );
  assert.match(
    source,
    /active_count\s*<=\s*active_capacity/,
    'A+1 active rows fail closed before any paired field work is published'
  );
});

test('paired mechanics-field support omission matches the canonical half-cell zero', () => {
  const f32 = Math.fround;
  const quadraticWeight = (fraction, offset) => {
    if (offset === 0) {
      const value = f32(f32(1.5) - fraction);
      return f32(f32(0.5) * f32(value * value));
    }
    if (offset === 1) {
      const value = f32(fraction - f32(1));
      return f32(f32(0.75) - f32(value * value));
    }
    const value = f32(fraction - f32(0.5));
    return f32(f32(0.5) * f32(value * value));
  };
  const supportWeight = (fraction, offsets) => f32(
    f32(
      quadraticWeight(fraction[0], offsets[0])
        * quadraticWeight(fraction[1], offsets[1])
    ) * quadraticWeight(fraction[2], offsets[2])
  );

  assert.equal(supportWeight([0.5, 1, 1], [2, 1, 1]), 0);
  assert.ok(supportWeight([0.5, 1, 1], [1, 1, 1]) > 0);
  let positiveCount = 0;
  for (let ox = 0; ox < 3; ox += 1) {
    for (let oy = 0; oy < 3; oy += 1) {
      for (let oz = 0; oz < 3; oz += 1) {
        positiveCount += Number(
          supportWeight([0.5, 0.5, 0.5], [ox, oy, oz]) > 0
        );
      }
    }
  }
  assert.equal(positiveCount, 8);
  assert.equal(27 - positiveCount, 19);
});

test('parallel paired projection is exact to the serial oracle for sparse, all-active, mixed, clipped, and A=0 domains', () => {
  const fineNodeCount = 10;
  const combinedNodeSpan = 20;
  const cases = [
    {
      name: 'A=0',
      candidateKeys: []
    },
    {
      name: 'all-active fine',
      candidateKeys: [3, 1, 2, 1]
    },
    {
      name: 'all-active coarse',
      candidateKeys: [13, 11, 12, 11]
    },
    {
      name: 'mixed fine/coarse',
      candidateKeys: [12, 2, 11, 1, 15, 4]
    },
    {
      name: 'sparse mixed with clipped sentinels',
      candidateKeys: [0, 12, INVALID_KEY, 4, 15, INVALID_KEY, 2]
    }
  ];
  for (const { name, candidateKeys } of cases) {
    const sortedCandidateIndices = stableCandidateOrder(candidateKeys);
    const input = {
      candidateKeys,
      sortedCandidateIndices,
      fineNodeCount,
      combinedNodeSpan
    };
    const serial = serialPairProjectionOracle(input);
    const parallel = parallelPairProjectionOracle(input);
    assert.deepEqual(parallel, serial, `${name}: exact serial parity`);
    assert.equal(parallel.fine.length, candidateKeys.length, `${name}: fine`);
    assert.equal(
      parallel.coarse.length,
      candidateKeys.length,
      `${name}: coarse`
    );
  }
});

test('parallel paired projection remains GPU-authenticated and fails forged count/seal authority closed', () => {
  const source = readFileSync(
    new URL(
      '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldPairWgsl.js',
      import.meta.url
    ),
    'utf8'
  );
  assert.match(
    source,
    /active_source_view\[ACTIVE_SOURCE_CANDIDATE_COUNT_WORD\][\s\S]*unique_evidence\[1u\]\s*==\s*candidate_count/,
    'the live candidate count is GPU-authored and must match radix evidence'
  );
  assert.match(
    source,
    /pair_load\(PAIR_CONTROL_SEAL\)\s*==\s*params\.completion_ordinal[\s\S]*unique_evidence\[0u\]\s*==\s*params\.generation_id/,
    'generation and completion seals authenticate projection preparation'
  );
  assert.match(
    source,
    /params\.pair_candidate_capacity\s*==\s*active_capacity\s*\*\s*27u[\s\S]*candidate_count\s*<=\s*params\.pair_candidate_capacity/,
    'forged A+1 candidate authority cannot overrun the retained active tier'
  );
  assert.match(
    source,
    /PAIR_STATUS_READY\s*\|\s*PAIR_STATUS_FAIL_CLOSED[\s\S]*PAIR_CONTROL_BUILD_SEAL,\s*0u/,
    'invalid authority clears the completion seal and fails closed'
  );
});

test('paired mechanics-field authority is GPU-only and malformed or one-level inputs fail atomically', () => {
  const device = createFakeDevice();
  assert.throws(
    () => createSchroederSpatialMechanicsFieldPairGpu(device, {
      maxSourceCount: 8,
      levelGrids: [FINE_GRID],
      identityStrideWords: 1
    }),
    /levelGrids|two|fine.*coarse/i
  );
  assert.throws(
    () => createSchroederSpatialMechanicsFieldPairGpu(device, {
      maxSourceCount: 8,
      levelGrids: [FINE_GRID, FINE_GRID],
      identityStrideWords: 1
    }),
    /distinct|fine.*coarse|grid/i
  );
  assert.throws(
    () => createSchroederSpatialMechanicsFieldPairGpu(device, {
      maxSourceCount: 1,
      levelGrids: [
        {
          gridNodeCount: 0xffff_ffff,
          gridDims: [65_535, 65_537, 1],
          gridShift: 1,
          gridSpacingM: 0.25
        },
        {
          gridNodeCount: 1,
          gridDims: [1, 1, 1],
          gridShift: 1,
          gridSpacingM: 0.5
        }
      ],
      identityStrideWords: 1
    }),
    /combined|sum|u32|overflow|node.*capacity/i
  );
  const fixture = createDirectoryV2PairFixture(device);
  const runtime = createPairRuntime(device);
  const availableBefore = runtime.availableArenaCount();
  assert.throws(
    () => runtime.encode(device.createCommandEncoder(), {
      sourceBuffer: fixture.sourceBuffer,
      identityBuffer: fixture.identityBuffer,
      sourceCount: 4,
      sourceRowLayoutId:
        SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
      identityStrideWords: 1,
      levelViews: fixture.levelViews.slice(0, 1)
    }),
    /levelViews|two|fine.*coarse/i
  );
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.availableArenaCount(), availableBefore);

  const exactAuthority =
    fixture.parentMechanicsViews[1].activeSourceCountAuthority;
  fixture.parentMechanicsViews[1].activeSourceCountAuthority = {
    ...exactAuthority
  };
  assert.throws(
    () => encodePair(runtime, device, fixture),
    /authority|lineage|exact/i
  );
  fixture.parentMechanicsViews[1].activeSourceCountAuthority = exactAuthority;
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.availableArenaCount(), availableBefore);

  // A is intentionally absent from every host descriptor. A=0 is represented
  // only by word 18/43 and zero indirect rows inside this exact GPU authority.
  const { execution: pair, encoder } = encodePair(runtime, device, fixture);
  assert.equal(Object.hasOwn(pair, 'activeSourceCount'), false);
  assert.equal(pair.candidateCount, null);
  assert.equal(pair.readbackPerformed, false);
  for (const child of pair.mechanicsFieldViews) {
    assert.equal(Object.hasOwn(child, 'activeSourceCount'), false);
    assert.equal(child.candidateCount, null);
  }
  const indirectCommands = encoder.events
    .filter(({ kind }) => kind === 'pass')
    .flatMap(({ commands }) => commands)
    .filter(({ dispatchIndirect }) => dispatchIndirect);
  assert.ok(indirectCommands.length > 0);
  assert.ok(indirectCommands.every(({ dispatchIndirect }) => (
    dispatchIndirect.buffer === fixture.activeSourceView.activeSourceViewBuffer
      || runtime.allocationEntries().some(({ buffer }) => (
        buffer === dispatchIndirect.buffer
      ))
  )));
  assert.equal(runtime.releaseExecution(pair.mechanicsFieldViews[1], {
    discardedEncoder: true
  }), true);
  assert.equal(pair.released, true);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.destroy(), true);
});

test('paired runtime construction retires every earlier arena after a later-arena allocation failure', () => {
  const device = createFakeDevice();
  const originalCreateBuffer = device.createBuffer.bind(device);
  const originalError = new Error(
    'manufactured second-arena pair allocation failure'
  );
  device.createBuffer = (descriptor) => {
    if (descriptor?.label === 'pair-construction-later-arena-1-params') {
      throw originalError;
    }
    return originalCreateBuffer(descriptor);
  };

  let observedError = null;
  try {
    createPairRuntime(device, {
      arenaCount: 2,
      label: 'pair-construction-later'
    });
  } catch (error) {
    observedError = error;
  }

  assert.equal(observedError, originalError);
  assert.ok(
    device.buffers.some(({ label }) => label?.includes('-arena-0-')),
    'the manufactured failure occurs after one complete earlier arena'
  );
  assert.ok(
    device.buffers.some(({ label }) => (
      label?.includes('-arena-1-shared-radix-')
    )),
    'the failing arena had already prepared its retained radix owner'
  );
  assert.ok(device.buffers.length > 0);
  for (const buffer of device.buffers) {
    assert.equal(
      buffer.destroyCount,
      1,
      `${buffer.label} retired exactly once after later-arena failure`
    );
  }
});

test('paired runtime construction preserves the allocation error while retiring a partial current arena exactly once', () => {
  const device = createFakeDevice();
  const originalCreateBuffer = device.createBuffer.bind(device);
  const originalError = new Error(
    'manufactured mid-current-arena pair allocation failure'
  );
  const cleanupError = new Error(
    'manufactured cleanup error must not replace construction failure'
  );
  device.createBuffer = (descriptor) => {
    if (descriptor?.label === 'pair-construction-mid-arena-0-control') {
      throw originalError;
    }
    const buffer = originalCreateBuffer(descriptor);
    if (descriptor?.label === 'pair-construction-mid-arena-0-params') {
      buffer.destroy = function destroyWithManufacturedFailure() {
        this.destroyCount += 1;
        this.destroyed = true;
        throw cleanupError;
      };
    }
    return buffer;
  };

  let observedError = null;
  try {
    createPairRuntime(device, {
      label: 'pair-construction-mid'
    });
  } catch (error) {
    observedError = error;
  }

  assert.equal(
    observedError,
    originalError,
    'cleanup failures cannot replace the exact allocation failure'
  );
  assert.ok(
    device.buffers.some(({ label }) => (
      label === 'pair-construction-mid-arena-0-candidate-keys'
    )),
    'the manufactured failure occurs after pair-owned current-arena buffers'
  );
  assert.ok(
    device.buffers.some(({ label }) => (
      label?.includes('-arena-0-shared-radix-')
    )),
    'the partial arena had already prepared one retained radix owner'
  );
  for (const buffer of device.buffers) {
    assert.equal(
      buffer.destroyCount,
      1,
      `${buffer.label} retired exactly once after partial-arena failure`
    );
  }
});

test('paired mechanics-field ownership rejects foreign runtimes and retires both children from a reverse child handle', async () => {
  const device = createFakeDevice();
  const fixture = createDirectoryV2PairFixture(device);
  const owner = createPairRuntime(device, { label: 'pair-owner' });
  const foreign = createPairRuntime(device, { label: 'pair-foreign' });
  const { execution: pair } = encodePair(owner, device, fixture);
  const [fine, coarse] = pair.mechanicsFieldViews;

  for (const execution of [pair, fine, coarse]) {
    assert.equal(foreign.ownsExecution(execution), false);
    assert.throws(
      () => foreign.markExecutionSubmitted(execution),
      (error) => (
        error?.code === 'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_FOREIGN_EXECUTION'
      )
    );
    assert.throws(
      () => foreign.releaseExecution(execution, { discardedEncoder: true }),
      (error) => (
        error?.code === 'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_FOREIGN_EXECUTION'
      )
    );
  }

  fixture.markParentsSubmitted();
  assert.equal(owner.markExecutionSubmitted(fine), true);
  assert.equal(pair.submitPerformed, true);
  assert.equal(fine.submitPerformed, true);
  assert.equal(coarse.submitPerformed, true);
  assert.equal(await owner.releaseExecutionAfter(coarse), true);
  assert.equal(device.queueFences.length, 1);
  assert.equal(owner.ownsExecution(pair), false);
  assert.equal(owner.ownsExecution(fine), false);
  assert.equal(owner.ownsExecution(coarse), false);
  assert.equal(owner.activeExecutionCount(), 0);
  assert.equal(pair.released, true);
  assert.equal(fine.released, true);
  assert.equal(coarse.released, true);
  assert.equal(owner.destroy(), true);
  assert.equal(foreign.destroy(), true);
});

test('paired mechanics-field children retain independent mutation states', async () => {
  const device = createFakeDevice();
  const fixture = createDirectoryV2PairFixture(device);
  const runtime = createPairRuntime(device);
  const { execution: pair } = encodePair(runtime, device, fixture);
  const [fine, coarse] = pair.mechanicsFieldViews;
  fixture.markParentsSubmitted();
  runtime.markExecutionSubmitted(pair);

  assert.deepEqual(runtime.stateMutationState(fine), {
    ordinal: 0,
    encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    operation: 'topology-ready',
    pending: false,
    publicationLocked: false,
    quarantined: false
  });
  assert.deepEqual(runtime.stateMutationState(coarse), {
    ordinal: 0,
    encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    operation: 'topology-ready',
    pending: false,
    publicationLocked: false,
    quarantined: false
  });

  const fineMutation = runtime.reserveStateMutation(fine, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
    operation: 'fine-p2g-finalized'
  });
  const coarseMutation = runtime.reserveStateMutation(coarse, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    operation: 'coarse-local-finalized',
    mutationCount: 2
  });
  assert.equal(
    runtime.isStateMutationReservationActive(fine, fineMutation),
    true
  );
  assert.equal(
    runtime.isStateMutationReservationActive(coarse, coarseMutation),
    true
  );

  runtime.markStateMutationSubmitted(fineMutation);
  assert.deepEqual(runtime.stateMutationState(fine), {
    ordinal: 1,
    encoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
    operation: 'fine-p2g-finalized',
    pending: false,
    publicationLocked: false,
    quarantined: false
  });
  assert.deepEqual(runtime.stateMutationState(coarse), {
    ordinal: 0,
    encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    operation: 'topology-ready',
    pending: true,
    publicationLocked: false,
    quarantined: false
  });

  runtime.markStateMutationSubmitted(coarseMutation);
  assert.deepEqual(runtime.stateMutationState(coarse), {
    ordinal: 2,
    encoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    operation: 'coarse-local-finalized',
    pending: false,
    publicationLocked: false,
    quarantined: false
  });
  assert.equal(fine.stateMutationOrdinal, 1);
  assert.equal(coarse.stateMutationOrdinal, 2);
  assert.equal(
    fine.stateMutationEncoding,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
  );
  assert.equal(
    coarse.stateMutationEncoding,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
  );

  assert.equal(await runtime.releaseExecutionAfter(coarse), true);
  assert.equal(pair.released, true);
  assert.equal(runtime.destroy(), true);
});

test('paired publication-lock retirement is idempotent for one exact child and lock', async () => {
  const device = createFakeDevice();
  const fixture = createDirectoryV2PairFixture(device);
  const runtime = createPairRuntime(device);
  const { execution: pair } = encodePair(runtime, device, fixture);
  const [fine] = pair.mechanicsFieldViews;
  fixture.markParentsSubmitted();
  runtime.markExecutionSubmitted(pair);
  const publicationLock = runtime.acquireStatePublicationLock(fine, {
    owner: Object.freeze({ kind: 'paired-idempotent-retirement-test' })
  });

  const fence = deferred();
  let fenceCallCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    fenceCallCount += 1;
    return fence.promise;
  };
  const first = runtime.retireStatePublicationLockAfter(
    fine,
    publicationLock
  );
  const second = runtime.retireStatePublicationLockAfter(
    fine,
    publicationLock
  );
  assert.equal(second, first);
  assert.equal(fenceCallCount, 1);
  assert.equal(
    runtime.isStatePublicationLockActive(fine, publicationLock),
    false
  );

  fence.resolve();
  assert.equal(await first, true);
  assert.equal(
    await runtime.executionRetirementCompletionPromise(pair),
    true
  );
  assert.equal(fenceCallCount, 1);
  assert.equal(pair.released, true);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.destroy(), true);
});

test('paired device loss supersedes an unresolved publication-lock fence exactly once', async () => {
  const loss = deferred();
  const device = createFakeDevice({ lost: loss.promise });
  const fixture = createDirectoryV2PairFixture(device);
  const runtime = createPairRuntime(device);
  const { execution: pair } = encodePair(runtime, device, fixture);
  const [fine, coarse] = pair.mechanicsFieldViews;
  fixture.markParentsSubmitted();
  runtime.markExecutionSubmitted(pair);
  const publicationLock = runtime.acquireStatePublicationLock(fine, {
    owner: Object.freeze({ kind: 'paired-device-loss-supersession-test' })
  });
  const mutation = runtime.reserveStateMutation(fine, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
    operation: 'fine-submitted-before-device-loss',
    publicationLock
  });
  runtime.markStateMutationSubmitted(mutation);

  const staleFence = deferred();
  let fenceCallCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    fenceCallCount += 1;
    return staleFence.promise;
  };
  const normalRetirement = runtime.retireStatePublicationLockAfter(
    fine,
    publicationLock
  );
  assert.equal(
    runtime.retireStatePublicationLockAfter(fine, publicationLock),
    normalRetirement
  );
  assert.equal(fenceCallCount, 1);
  const pairCompletion =
    runtime.executionRetirementCompletionPromise(pair);
  const originalReason = new Error(
    'device loss superseded paired private retirement'
  );
  const lossRetirement = runtime.quarantineExecutionAfterDeviceLoss(coarse, {
    reason: originalReason
  });
  assert.equal(
    runtime.quarantineExecutionAfterDeviceLoss(pair, {
      reason: new Error('later reason must not replace the first')
    }),
    lossRetirement
  );

  const ownedBuffers = runtime.allocationEntries()
    .filter(({ arenaIndex }) => arenaIndex === pair.arenaIndex)
    .map(({ buffer }) => buffer);
  loss.resolve({
    reason: 'destroyed',
    message: 'paired publication retirement supersession'
  });
  assert.equal(await lossRetirement, true);
  assert.equal(await normalRetirement, true);
  assert.equal(await pairCompletion, true);
  for (const execution of [pair, fine, coarse]) {
    assert.equal(execution.released, true);
    assert.equal(execution.quarantineReason, originalReason);
    assert.equal(runtime.ownsExecution(execution), false);
  }
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.retiredArenaCount(), 1);
  for (const buffer of ownedBuffers) {
    assert.equal(buffer.destroyCount, 1, `${buffer.label} retired exactly once`);
  }
  for (const buffer of fixture.borrowedBuffers) {
    assert.equal(buffer.destroyCount, 0, `${buffer.label} remains borrowed`);
  }

  const terminalDestroyCounts = ownedBuffers.map(
    ({ destroyCount }) => destroyCount
  );
  staleFence.reject(new Error('stale queue fence after device loss'));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(
    ownedBuffers.map(({ destroyCount }) => destroyCount),
    terminalDestroyCounts
  );
  assert.equal(runtime.destroy(), true);
  assert.deepEqual(
    ownedBuffers.map(({ destroyCount }) => destroyCount),
    terminalDestroyCounts
  );
});

test('paired device loss supersedes an unresolved direct release before its stale fence', async () => {
  const loss = deferred();
  const device = createFakeDevice({ lost: loss.promise });
  const fixture = createDirectoryV2PairFixture(device);
  const runtime = createPairRuntime(device);
  const { execution: pair } = encodePair(runtime, device, fixture);
  const [fine, coarse] = pair.mechanicsFieldViews;
  fixture.markParentsSubmitted();
  runtime.markExecutionSubmitted(pair);

  const staleFence = deferred();
  device.queue.onSubmittedWorkDone = () => staleFence.promise;
  const normalRetirement = runtime.releaseExecutionAfter(pair);
  assert.equal(
    runtime.releaseExecutionAfter(coarse),
    normalRetirement,
    'pair and either child expose one direct-release retirement promise'
  );
  const pairCompletion =
    runtime.executionRetirementCompletionPromise(fine);
  const originalReason = new Error(
    'device loss superseded paired direct queue-fence release'
  );
  const lossRetirement = runtime.quarantineExecutionAfterDeviceLoss(coarse, {
    reason: originalReason
  });
  const ownedBuffers = runtime.allocationEntries()
    .filter(({ arenaIndex }) => arenaIndex === pair.arenaIndex)
    .map(({ buffer }) => buffer);

  loss.resolve({
    reason: 'destroyed',
    message: 'paired direct-release supersession'
  });
  let timeoutId;
  const terminalResults = await Promise.race([
    Promise.all([normalRetirement, lossRetirement, pairCompletion]),
    new Promise((resolve) => {
      timeoutId = setTimeout(
        () => resolve(['timeout-before-stale-fence']),
        1_000
      );
    })
  ]);
  clearTimeout(timeoutId);
  assert.deepEqual(
    terminalResults,
    [true, true, true],
    'all terminal paths resolve without waiting for the stale queue fence'
  );
  assert.equal(pair.released, true);
  assert.equal(fine.quarantineReason, originalReason);
  assert.equal(coarse.quarantineReason, originalReason);
  assert.equal(runtime.retiredArenaCount(), 1);
  for (const buffer of ownedBuffers) {
    assert.equal(buffer.destroyCount, 1, `${buffer.label} retired exactly once`);
  }
  for (const buffer of fixture.borrowedBuffers) {
    assert.equal(buffer.destroyCount, 0, `${buffer.label} remains borrowed`);
  }

  const terminalDestroyCounts = ownedBuffers.map(
    ({ destroyCount }) => destroyCount
  );
  staleFence.reject(new Error('stale direct-release fence after device loss'));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(
    ownedBuffers.map(({ destroyCount }) => destroyCount),
    terminalDestroyCounts
  );
  assert.equal(runtime.destroy(), true);
  assert.deepEqual(
    ownedBuffers.map(({ destroyCount }) => destroyCount),
    terminalDestroyCounts
  );
});

test('device loss retires a paired field atomically and destroys only pair-owned buffers', async () => {
  const loss = deferred();
  const device = createFakeDevice({ lost: loss.promise });
  const fixture = createDirectoryV2PairFixture(device);
  const runtime = createPairRuntime(device);
  const { execution: pair } = encodePair(runtime, device, fixture);
  const [fine, coarse] = pair.mechanicsFieldViews;
  fixture.markParentsSubmitted();
  runtime.markExecutionSubmitted(pair);

  const ownedBuffers = runtime.allocationEntries()
    .filter(({ arenaIndex }) => arenaIndex === pair.arenaIndex)
    .map(({ buffer }) => buffer);
  const originalReason = new Error('paired field device loss');
  const retirement = runtime.quarantineExecutionAfterDeviceLoss(coarse, {
    reason: originalReason
  });
  assert.equal(
    runtime.quarantineExecutionAfterDeviceLoss(fine, {
      reason: new Error('later reason must not replace the first')
    }),
    retirement,
    'pair and either child expose one exact terminal retirement promise'
  );
  let settled = false;
  retirement.finally(() => { settled = true; }).catch(() => {});
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(runtime.ownsExecution(pair), false);
  assert.equal(runtime.isExecutionRetirementInFlight(pair), true);

  loss.resolve({ reason: 'destroyed', message: 'paired field test loss' });
  assert.equal(await retirement, true);
  assert.equal(
    await runtime.executionRetirementCompletionPromise(pair),
    true
  );
  for (const execution of [pair, fine, coarse]) {
    assert.equal(runtime.ownsExecution(execution), false);
    assert.equal(execution.released, true);
    assert.equal(execution.quarantineReason, originalReason);
  }
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.retiredArenaCount(), 1);
  for (const buffer of ownedBuffers) {
    assert.equal(buffer.destroyCount, 1, `${buffer.label} retired exactly once`);
  }
  for (const buffer of fixture.borrowedBuffers) {
    assert.equal(buffer.destroyCount, 0, `${buffer.label} remains borrowed`);
  }
  assert.throws(
    () => encodePair(runtime, device, fixture),
    (error) => (
      error?.code === 'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_DEVICE_LOST'
    )
  );
});

test('native WebGPU executes isolated and production sparse paired fields with exact child work', {
  skip: RUN_NATIVE_COMPILE
    ? false
    : 'set ULG_RUN_NATIVE_MECHANICS_FIELD_PAIR_COMPILE=1 for native execution',
  timeout: 240_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_MECHANICS_FIELD_PAIR_CHROME
      || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    result = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      let executionError = null;
      let summary = null;
      let runtime = null;
      const borrowedBuffers = [];
      try {
        const nonce = Date.now();
        const [
          runtimeModule,
          fieldAbi,
          activeAbi,
          epochAbi,
          mechanicsAbi,
          deviceIdentity,
          spatialModule,
          activeRuntimeModule,
          mechanicsRuntimeModule,
          parentFieldAbi
        ] = await Promise.all([
          import(
            '/src/runtime/sph/schroederSpatialMechanicsFieldPairGpu.js'
              + `?nativePairExecute=${nonce}`
          ),
          import(
            '/ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js'
              + `?nativePairExecute=${nonce}`
          ),
          import(
            '/ulg-gpu-abi/src/schroederSpatialActiveSourceView.js'
              + `?nativePairExecute=${nonce}`
          ),
          import(
            '/ulg-gpu-abi/src/schroederSpatialEpoch.js'
              + `?nativePairExecute=${nonce}`
          ),
          import(
            '/ulg-gpu-abi/src/schroederSpatialMechanicsView.js'
              + `?nativePairExecute=${nonce}`
          ),
          import('/src/runtime/sph/sphGpuDeviceIdentity.js'),
          import(
            '/src/runtime/sph/schroederSpatialEpochGpu.js'
              + `?nativePairProduction=${nonce}`
          ),
          import(
            '/src/runtime/sph/schroederSpatialActiveSourceViewGpu.js'
              + `?nativePairDirect=${nonce}`
          ),
          import(
            '/src/runtime/sph/schroederSpatialMechanicsViewGpu.js'
              + `?nativePairDirect=${nonce}`
          ),
          import(
            '/ulg-gpu-abi/src/schroederSpatialParentFieldView.js'
              + `?nativePairExecute=${nonce}`
          )
        ]);
        const physicalSourceCount = 4;
        const physicalSourceCapacity = 8;
        const activePhysicalSources = [1, 3];
        const activeCount = activePhysicalSources.length;
        const candidateCount = activeCount * 27;
        const buildOrdinal = 37;
        const grids = [
          {
            gridNodeCount: 125,
            gridDims: [5, 5, 5],
            gridShift: 1,
            gridSpacingM: 0.25
          },
          {
            gridNodeCount: 125,
            gridDims: [5, 5, 5],
            gridShift: 1,
            gridSpacingM: 0.5
          }
        ];
        const identity = {
          generationId: 41,
          deviceOrdinal: 2,
          laneOrdinal: 3,
          leaseToken: 5,
          sourceFamilyId: 7,
          storageGeneration: 11,
          physicsTick: 13,
          physicsSubstep: 0,
          positionEpoch: 17,
          topologyEpoch: 19,
          chartEpoch: 23,
          levelEpoch: 29,
          supportEpoch: 31
        };
        const makeBorrowedBuffer = (label, size, usage) => {
          const buffer = deviceIdentity.tagWebGpuBufferDevice(
            device.createBuffer({ label, size, usage }),
            device
          );
          borrowedBuffers.push(buffer);
          return buffer;
        };
        const readWords = async (buffer, byteLength, label) => {
          const readback = device.createBuffer({
            label,
            size: byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          });
          const encoder = device.createCommandEncoder();
          encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength);
          device.queue.submit([encoder.finish()]);
          await readback.mapAsync(GPUMapMode.READ);
          const words = new Uint32Array(readback.getMappedRange()).slice();
          readback.unmap();
          readback.destroy();
          return words;
        };
        const readWordsAt = async (
          buffer,
          sourceOffsetBytes,
          byteLength,
          label
        ) => {
          const readback = device.createBuffer({
            label,
            size: byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          });
          const encoder = device.createCommandEncoder();
          encoder.copyBufferToBuffer(
            buffer,
            sourceOffsetBytes,
            readback,
            0,
            byteLength
          );
          device.queue.submit([encoder.finish()]);
          await readback.mapAsync(GPUMapMode.READ);
          const words = new Uint32Array(readback.getMappedRange()).slice();
          readback.unmap();
          readback.destroy();
          return words;
        };
        const f32Bits = (value) => {
          const words = new Uint32Array(1);
          new Float32Array(words.buffer)[0] = Math.fround(value);
          return words[0];
        };
        const signedOrderKey = (value) => (
          ((value | 0) ^ 0x8000_0000) >>> 0
        );
        const nodesFor = (position, grid) => {
          const base = position.map((value) => (
            Math.floor(value / grid.gridSpacingM - 0.5)
          ));
          const nodes = [];
          for (let ox = 0; ox < 3; ox += 1) {
            for (let oy = 0; oy < 3; oy += 1) {
              for (let oz = 0; oz < 3; oz += 1) {
                const i = base[0] + ox + grid.gridShift;
                const j = base[1] + oy + grid.gridShift;
                const k = base[2] + oz + grid.gridShift;
                nodes.push(
                  (i * grid.gridDims[1] + j) * grid.gridDims[2] + k
                );
              }
            }
          }
          return nodes;
        };

        const sourceRows = new Float32Array(physicalSourceCount * 16);
        const sourceDefinitions = [
          { level: 0, spacing: 0.25, mass: 0, family: 1, material: 11 },
          { level: 0, spacing: 0.25, mass: 1, family: 1, material: 11 },
          { level: 1, spacing: 0.5, mass: 0, family: 2, material: 22 },
          { level: 1, spacing: 0.5, mass: 1, family: 2, material: 22 }
        ];
        for (
          let physicalSource = 0;
          physicalSource < physicalSourceCount;
          physicalSource += 1
        ) {
          const row = physicalSource * 16;
          const source = sourceDefinitions[physicalSource];
          sourceRows[row] = source.level;
          sourceRows[row + 1] = source.spacing;
          sourceRows[row + 6] = source.mass;
          sourceRows[row + 8] = source.family;
          sourceRows[row + 9] = source.material;
          sourceRows[row + 10] = 1;
          sourceRows[row + 12] = 0.5;
          sourceRows[row + 13] = 0.5;
          sourceRows[row + 14] = 0.5;
          sourceRows[row + 15] = 0;
        }
        const sourceBuffer = makeBorrowedBuffer(
          'native-pair-source',
          sourceRows.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const identityWords = new Uint32Array([101, 103, 107, 109]);
        const identityBuffer = makeBorrowedBuffer(
          'native-pair-identity',
          identityWords.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        device.queue.writeBuffer(sourceBuffer, 0, sourceRows);
        device.queue.writeBuffer(identityBuffer, 0, identityWords);

        const activeLayout =
          activeAbi.createSchroederSpatialActiveSourceViewLayout({
            physicalSourceCapacity,
            activeSourceCapacity: physicalSourceCapacity
          });
        const activeWords = new Uint32Array(activeLayout.wordLength);
        activeWords.fill(
          0xffff_ffff,
          activeLayout.activeToPhysicalOffsetWords
        );
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
        ].forEach((word, index) => {
          activeWords[3 + index] = word;
        });
        activeWords[16] = physicalSourceCount;
        activeWords[17] = physicalSourceCapacity;
        activeWords[18] = activeCount;
        activeWords[19] = physicalSourceCapacity;
        activeWords[20] = physicalSourceCount - activeCount;
        activeWords[23] =
          mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0;
        activeWords[24] = 16;
        activeWords[25] = activeLayout.activeToPhysicalOffsetWords;
        activeWords[26] = activeLayout.physicalToActiveOffsetWords;
        activeWords[27] = activeLayout.wordLength;
        activeWords[28] = activeLayout.wordLength;
        activeWords[29] = buildOrdinal;
        activeWords[30] = buildOrdinal;
        activeWords[31] = 0x1234_5678;
        activeWords[32] = physicalSourceCount;
        activeWords[33] = activeCount;
        activeWords[34] = activeCount;
        activeWords[35] = activeCount;
        activeWords[36] = 4;
        activeWords[37] = 64;
        activeWords[38] = device.limits.maxComputeWorkgroupsPerDimension;
        activeWords[39] = activeLayout.wordLength;
        activeWords[40] = activeLayout.activeDispatchOffsetWords;
        activeWords[41] = activeLayout.candidateDispatchOffsetWords;
        activeWords[42] = activeLayout.physicalDispatchOffsetWords;
        activeWords[43] = candidateCount;
        activeWords[44] = activeLayout.activeCandidateCapacity;
        activeWords[47] = 0x51ea_1ed1;
        activeWords[48] = 1;
        activeWords[49] = 1;
        activeWords[50] = 1;
        activeWords[51] = 1;
        activeWords[52] = 1;
        activeWords[53] = 1;
        activeWords[54] = 1;
        activeWords[55] = 1;
        activeWords[56] = 1;
        activePhysicalSources.forEach((physicalSource, activeOrdinal) => {
          activeWords[
            activeLayout.activeToPhysicalOffsetWords + activeOrdinal
          ] = physicalSource;
          activeWords[
            activeLayout.physicalToActiveOffsetWords + physicalSource
          ] = activeOrdinal;
        });
        const activeSourceViewBuffer = makeBorrowedBuffer(
          'native-pair-active-source',
          activeWords.byteLength,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.INDIRECT
            | GPUBufferUsage.COPY_DST
            | GPUBufferUsage.COPY_SRC
        );
        device.queue.writeBuffer(activeSourceViewBuffer, 0, activeWords);
        let activeSourceView;
        const activeOwner = {
          ownsExecution(execution) {
            return execution === activeSourceView;
          }
        };
        activeSourceView = {
          schema: activeAbi.ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
          status: 'schroeder-spatial-active-source-view-gpu-encoded',
          ready: true,
          selected: true,
          submitPerformed: false,
          sourceBuffer,
          activeSourceViewBuffer,
          layout: activeLayout,
          physicalSourceCount,
          physicalSourceCapacity,
          activeSourceCapacity: physicalSourceCapacity,
          sourceRowLayoutId:
            mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
          sourceRowStrideFloats: 16,
          ...identity,
          buildOrdinal,
          sourceFingerprint: 0x1234_5678,
          activeDispatchOffsetBytes: activeLayout.activeDispatchOffsetBytes,
          candidateDispatchOffsetBytes:
            activeLayout.candidateDispatchOffsetBytes,
          physicalDispatchOffsetBytes:
            activeLayout.physicalDispatchOffsetBytes,
          ownerRuntime: activeOwner
        };
        const activeSourceCountAuthority = Object.freeze({
          schema: activeAbi.ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
          activeSourceView,
          buffer: activeSourceViewBuffer,
          offsetWords: 18,
          offsetBytes: 18 * Uint32Array.BYTES_PER_ELEMENT,
          capacity: physicalSourceCapacity,
          residency: 'gpu-only'
        });

        const directoryLayout =
          epochAbi.createSchroederSpatialEpochV2Layout({
            physicalSourceCapacity,
            activeSourceCapacity: physicalSourceCapacity,
            cellCapacity: physicalSourceCapacity
          });
        const cells = activePhysicalSources.map((physicalSource) => {
          const source = sourceDefinitions[physicalSource];
          const cell = Math.floor(0.5 / source.spacing);
          return {
            physicalSource,
            key: [
              0,
              signedOrderKey(source.level),
              signedOrderKey(cell),
              signedOrderKey(cell),
              signedOrderKey(cell)
            ]
          };
        }).sort((left, right) => {
          for (let word = 0; word < left.key.length; word += 1) {
            if (left.key[word] !== right.key[word]) {
              return left.key[word] - right.key[word];
            }
          }
          return 0;
        });
        const directoryWords = new Uint32Array(directoryLayout.wordLength);
        directoryWords[0] = epochAbi.SCHROEDER_SPATIAL_EPOCH_MAGIC;
        directoryWords[1] = epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_VERSION;
        directoryWords[2] =
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
        ].forEach((word, index) => {
          directoryWords[3 + index] = word;
        });
        directoryWords[16] = physicalSourceCount;
        directoryWords[17] = physicalSourceCapacity;
        directoryWords[18] = cells.length;
        directoryWords[19] = physicalSourceCapacity;
        directoryWords[20] = directoryLayout.wordLength;
        directoryWords[21] = directoryLayout.wordLength;
        directoryWords[22] = directoryLayout.wordLength;
        directoryWords[25] = 5;
        directoryWords[26] = 5;
        directoryWords[27] =
          epochAbi.SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5;
        directoryWords[28] = 48;
        directoryWords[29] = directoryLayout.cellKeysOffsetWords;
        directoryWords[30] = directoryLayout.cellOffsetsOffsetWords;
        directoryWords[31] = directoryLayout.cellMembersOffsetWords;
        directoryWords[32] =
          directoryLayout.physicalToCellPlusOneOffsetWords;
        directoryWords[33] = buildOrdinal;
        directoryWords[34] = buildOrdinal;
        directoryWords[35] = buildOrdinal;
        directoryWords[36] = identity.generationId;
        directoryWords[37] = activeCount;
        directoryWords[38] = cells.length;
        directoryWords[39] = 1;
        directoryWords[41] = 1;
        directoryWords[42] = 1;
        directoryWords[43] = 1;
        directoryWords[44] = 1;
        directoryWords[46] = 2;
        directoryWords[47] = directoryLayout.wordLength;
        cells.forEach((cell, cellIndex) => {
          directoryWords.set(
            cell.key,
            directoryLayout.cellKeysOffsetWords + cellIndex * 5
          );
          directoryWords[
            directoryLayout.cellOffsetsOffsetWords + cellIndex
          ] = cellIndex;
          directoryWords[
            directoryLayout.cellOffsetsOffsetWords + cellIndex + 1
          ] = cellIndex + 1;
          directoryWords[
            directoryLayout.cellMembersOffsetWords + cellIndex
          ] = cell.physicalSource;
          directoryWords[
            directoryLayout.physicalToCellPlusOneOffsetWords
              + cell.physicalSource
          ] = cellIndex + 1;
        });
        const directoryBuffer = makeBorrowedBuffer(
          'native-pair-directory',
          directoryWords.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        device.queue.writeBuffer(directoryBuffer, 0, directoryWords);
        let spatialExecution;
        const spatialOwner = {
          ownsExecution(execution) {
            return execution === spatialExecution;
          }
        };
        spatialExecution = {
          schema: epochAbi.ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
          status: 'schroeder-spatial-epoch-v2-gpu-encoded',
          abiVersion: epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
          reverseEncoding:
            epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
          submitPerformed: false,
          sourceBuffer,
          sourceRowLayoutId:
            mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
          sourceRowStrideFloats: 16,
          physicalSourceCount,
          physicalSourceCapacity,
          activeSourceCapacity: physicalSourceCapacity,
          ...identity,
          buildOrdinal,
          layout: directoryLayout,
          directoryBuffer,
          activeSourceView,
          activeSourceViewBuffer,
          activeSourceCountAuthority,
          ownerRuntime: spatialOwner
        };

        const parentMechanicsViews = [];
        let parentsSubmitted = false;
        const parentOwner = {
          ownsExecution(execution) {
            return parentMechanicsViews.includes(execution);
          },
          isExecutionSubmitted(execution) {
            return parentsSubmitted
              && parentMechanicsViews.includes(execution);
          }
        };
        for (let selectedLevel = 0; selectedLevel < 2; selectedLevel += 1) {
          const grid = grids[selectedLevel];
          const parentPlan =
            mechanicsAbi.createSchroederSpatialMechanicsViewPlan({
              sourceCount: physicalSourceCount,
              sourceRowLayoutId:
                mechanicsAbi
                  .SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
              directoryAbiVersion:
                mechanicsAbi
                  .SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
              selectedLevel,
              ...grid,
              ...identity,
              completionOrdinal: buildOrdinal
            });
          const nodes = nodesFor([0.5, 0.5, 0.5], grid);
          const parentWords = new Uint32Array(parentPlan.layout.wordLength);
          parentWords[20] =
            mechanicsAbi.SCHROEDER_SPATIAL_MECHANICS_VIEW_MAGIC;
          parentWords[21] =
            mechanicsAbi.SCHROEDER_SPATIAL_MECHANICS_VIEW_VERSION;
          parentWords[22] =
            mechanicsAbi.SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_READY
            | mechanicsAbi.SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_ADMITTED;
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
          ].forEach((word, index) => {
            parentWords[23 + index] = word;
          });
          parentWords[36] = physicalSourceCount;
          parentWords[37] = selectedLevel;
          parentWords[38] = grid.gridNodeCount;
          parentWords[39] = grid.gridDims[0];
          parentWords[40] = grid.gridDims[1];
          parentWords[41] = grid.gridDims[2];
          parentWords[42] = grid.gridShift;
          parentWords[43] = f32Bits(grid.gridSpacingM);
          parentWords[44] = parentPlan.occupancyWordCount;
          parentWords[45] = grid.gridNodeCount;
          parentWords[46] = nodes.length;
          parentWords[49] = activeCount;
          parentWords[50] = 1;
          parentWords[51] = 27;
          parentWords[52] = buildOrdinal;
          parentWords[53] = parentPlan.layout.nodeOffsetWords;
          parentWords[54] =
            parentPlan.layout.nodeOffsetWords + nodes.length;
          parentWords[55] = parentPlan.layout.wordLength;
          parentWords[56] =
            mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0;
          parentWords[57] = 1;
          parentWords[58] = parentPlan.layout.wordLength;
          parentWords[59] = identity.generationId;
          parentWords[60] = 1;
          parentWords[61] = 1;
          parentWords[62] = 1;
          parentWords.set(nodes, parentPlan.layout.nodeOffsetWords);
          const mechanicsViewBuffer = makeBorrowedBuffer(
            `native-pair-parent-${selectedLevel}`,
            parentWords.byteLength,
            GPUBufferUsage.STORAGE
              | GPUBufferUsage.INDIRECT
              | GPUBufferUsage.COPY_DST
          );
          device.queue.writeBuffer(mechanicsViewBuffer, 0, parentWords);
          parentMechanicsViews.push({
            ...parentPlan,
            schema: mechanicsAbi.ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
            status: 'schroeder-spatial-mechanics-view-gpu-encoded',
            submitPerformed: false,
            released: false,
            sourceBuffer,
            sourceAuthorityVersion:
              fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
            directorySchema: epochAbi.ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
            directoryAbiVersion:
              mechanicsAbi
                .SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
            sourceWorkIdentity:
              mechanicsAbi
                .SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY,
            physicalSourceCount,
            spatialExecution,
            directoryBuffer,
            activeSourceView,
            activeSourceViewBuffer,
            activeSourceCountAuthority,
            activeSourceDispatchOffsetBytes:
              activeLayout.activeDispatchOffsetBytes,
            mechanicsViewBuffer,
            indirectDispatchBuffer: mechanicsViewBuffer,
            indirectDispatchOffsetBytes:
              parentPlan.layout.dispatchOffsetWords
                * Uint32Array.BYTES_PER_ELEMENT,
            ownerRuntime: parentOwner
          });
        }

        runtime =
          runtimeModule.createSchroederSpatialMechanicsFieldPairGpu(device, {
            maxSourceCount: physicalSourceCapacity,
            levelGrids: grids,
            identityStrideWords: 1,
            arenaCount: 1
          });
        const encoder = device.createCommandEncoder();
        const pair = runtime.encode(encoder, {
          sourceBuffer,
          identityBuffer,
          sourceCount: physicalSourceCount,
          sourceRowLayoutId:
            mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
          identityStrideWords: 1,
          levelViews: parentMechanicsViews.map((parentMechanicsView) => ({
            selectedLevel: parentMechanicsView.selectedLevel,
            parentMechanicsView
          }))
        });
        device.queue.submit([encoder.finish()]);
        parentsSubmitted = true;
        for (const parent of parentMechanicsViews) {
          parent.status =
            'schroeder-spatial-mechanics-view-gpu-build-submitted';
          parent.submitPerformed = true;
        }
        runtime.markExecutionSubmitted(pair);
        await device.queue.onSubmittedWorkDone();

        const childWords = await Promise.all(
          pair.mechanicsFieldViews.map((child, levelOrdinal) => (
            readWords(
              child.fieldViewBuffer,
              child.layout.byteLength,
              `native-pair-child-${levelOrdinal}-readback`
            )
          ))
        );
        const stableOrderWords = await Promise.all(
          pair.mechanicsFieldViews.map((child, levelOrdinal) => (
            readWords(
              child.stableCandidateOrderBuffer,
              candidateCount * Uint32Array.BYTES_PER_ELEMENT,
              `native-pair-stable-${levelOrdinal}-readback`
            )
          ))
        );
        const controlEntry = runtime.allocationEntries().find((entry) => (
          entry.role === 'mechanics-field-pair-control'
            && entry.arenaIndex === pair.arenaIndex
        ));
        if (!controlEntry) {
          throw new Error('paired runtime did not expose its retained control');
        }
        const [controlWords, activeReadback] = await Promise.all([
          readWords(
            controlEntry.buffer,
            16 * Uint32Array.BYTES_PER_ELEMENT,
            'native-pair-control-readback'
          ),
          readWords(
            activeSourceViewBuffer,
            activeLayout.byteLength,
            'native-pair-active-source-readback'
          )
        ]);
        const childSummaries = pair.mechanicsFieldViews.map(
          (child, levelOrdinal) => {
            const words = childWords[levelOrdinal];
            const descriptors = Array.from(
              { length: physicalSourceCount },
              (_, physicalSource) => {
                const begin = child.layout.descriptorOffsetWords
                  + physicalSource * child.layout.descriptorWords;
                return {
                  identity: Array.from(words.slice(begin, begin + 4)),
                  stencil: Array.from(words.slice(begin + 4, begin + 31))
                };
              }
            );
            const fieldCount = words[34];
            return {
              hostAdmitted:
                fieldAbi
                  .validateSchroederSpatialMechanicsFieldViewDescriptor(child)
                  .admitted,
              header: Array.from(words.slice(0, 64)),
              descriptors,
              keys: Array.from({ length: fieldCount }, (_, fieldIndex) => {
                const begin = child.layout.keyOffsetWords
                  + fieldIndex * child.layout.keyWords;
                return Array.from(words.slice(begin, begin + 4));
              }),
              stableOrder: Array.from(
                stableOrderWords[levelOrdinal].slice(0, candidateCount)
              )
            };
          }
        );
        summary = {
          pairStatus: pair.status,
          activeHeader: {
            activeCount: activeReadback[18],
            candidateCount: activeReadback[43],
            completionOrdinal: activeReadback[30],
            seal: activeReadback[47]
          },
          activeToPhysical: Array.from(activeReadback.slice(
            activeLayout.activeToPhysicalOffsetWords,
            activeLayout.activeToPhysicalOffsetWords + activeCount
          )),
          physicalToActive: Array.from(activeReadback.slice(
            activeLayout.physicalToActiveOffsetWords,
            activeLayout.physicalToActiveOffsetWords + physicalSourceCount
          )),
          control: Array.from(controlWords),
          children: childSummaries
        };
        await runtime.releaseExecutionAfter(pair);

        const directPhysicalSourceCount = 20_000;
        const directActiveSourceCount = 4_500;
        const directActivePhysical = Array.from(
          { length: directActiveSourceCount },
          (_, ordinal) => (ordinal * 37) % directPhysicalSourceCount
        ).sort((left, right) => left - right);
        const directActiveSet = new Set(directActivePhysical);
        const directActiveOrdinalByPhysical =
          new Int32Array(directPhysicalSourceCount);
        directActiveOrdinalByPhysical.fill(-1);
        directActivePhysical.forEach((physicalSource, activeOrdinal) => {
          directActiveOrdinalByPhysical[physicalSource] = activeOrdinal;
        });
        const directSourceRows =
          new Float32Array(directPhysicalSourceCount * 16);
        const directIdentityWords =
          new Uint32Array(directPhysicalSourceCount);
        for (
          let physicalSource = 0;
          physicalSource < directPhysicalSourceCount;
          physicalSource += 1
        ) {
          const level = physicalSource & 1;
          const active = directActiveSet.has(physicalSource);
          const row = physicalSource * 16;
          directSourceRows[row] = level;
          directSourceRows[row + 1] = level === 0 ? 0.25 : 0.5;
          directSourceRows[row + 2] = active ? 0.1 : 0;
          directSourceRows[row + 3] = active ? 0.001 : 0;
          directSourceRows[row + 4] = active ? 0.001 : 0;
          directSourceRows[row + 5] = active ? 0.001 : 0;
          directSourceRows[row + 6] = active ? 1 : 0;
          directSourceRows[row + 7] = active ? 1000 : 0;
          directSourceRows[row + 8] = 1;
          directSourceRows[row + 9] = level === 0 ? 11 : 22;
          directSourceRows[row + 10] = 1;
          directSourceRows[row + 12] = 0.5;
          directSourceRows[row + 13] = 0.5;
          directSourceRows[row + 14] = 0.5;
          directIdentityWords[physicalSource] =
            (0x0020_0000 + physicalSource) >>> 0;
        }
        const directSourceBuffer = makeBorrowedBuffer(
          'native-pair-direct-20k-assignment',
          directSourceRows.byteLength,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
            | GPUBufferUsage.COPY_SRC
        );
        const directIdentityBuffer = makeBorrowedBuffer(
          'native-pair-direct-20k-identity',
          directIdentityWords.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        device.queue.writeBuffer(
          directSourceBuffer,
          0,
          directSourceRows
        );
        device.queue.writeBuffer(
          directIdentityBuffer,
          0,
          directIdentityWords
        );
        const directGrids = [
          {
            gridNodeCount: 512,
            gridDims: [8, 8, 8],
            gridShift: 2,
            gridSpacingM: 0.25
          },
          {
            gridNodeCount: 125,
            gridDims: [5, 5, 5],
            gridShift: 2,
            gridSpacingM: 0.5
          }
        ];
        const directEpochIdentity = {
          generationId: 211,
          deviceOrdinal: 0,
          laneOrdinal: 0,
          leaseToken: 211,
          sourceFamilyId: 223,
          storageGeneration: 227,
          physicsTick: 229,
          physicsSubstep: 0,
          positionEpoch: 233,
          topologyEpoch: 239,
          chartEpoch: 241,
          levelEpoch: 251,
          supportEpoch: 257,
          buildOrdinal: 211
        };
        const directQueryProfile = {
          schema:
            'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
          status: 'schroeder-spatial-exact-near-query-profile-ready',
          ready: true,
          sourceBuffer: directSourceBuffer,
          assignmentBuffer: directSourceBuffer,
          sourceCount: directPhysicalSourceCount,
          chartId: 0,
          minLevel: 0,
          maxLevel: 1,
          levelCount: 2,
          baseGridSpacingM: 0.25,
          levelSpacingMode: 'base-grid-spacing-times-pow2-level',
          positionAuthority:
            'same-epoch-pre-integration-particle-state',
          storageGeneration: directEpochIdentity.storageGeneration,
          physicsTick: directEpochIdentity.physicsTick,
          physicsSubstep: directEpochIdentity.physicsSubstep,
          positionEpoch: directEpochIdentity.positionEpoch,
          topologyEpoch: directEpochIdentity.topologyEpoch,
          chartEpoch: directEpochIdentity.chartEpoch,
          levelEpoch: directEpochIdentity.levelEpoch,
          supportEpoch: directEpochIdentity.supportEpoch
        };
        const directActiveRuntime =
          activeRuntimeModule.createSchroederSpatialActiveSourceViewGpu(
            device,
            {
              maxPhysicalSourceCount: directPhysicalSourceCount,
              activeSourceCapacity: directPhysicalSourceCount,
              arenaCount: 1,
              label: 'native-pair-direct-20k-active-source'
            }
          );
        const directDirectoryRuntime =
          spatialModule.createSchroederSpatialEpochGpu(device, {
            maxSourceCount: directPhysicalSourceCount,
            activeSourceCapacity: directPhysicalSourceCount,
            cellCapacity: directPhysicalSourceCount,
            directoryAbiVersion:
              epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
            arenaCount: 1,
            label: 'native-pair-direct-20k-directory'
          });
        const directParentRuntimes = directGrids.map(
          (grid, levelOrdinal) => (
            mechanicsRuntimeModule.createSchroederSpatialMechanicsViewGpu(
              device,
              {
                maxSourceCount: directPhysicalSourceCount,
                ...grid,
                arenaCount: 1,
                label:
                  `native-pair-direct-20k-parent-${levelOrdinal}`
              }
            )
          )
        );
        const directPairRuntime =
          runtimeModule.createSchroederSpatialMechanicsFieldPairGpu(
            device,
            {
              maxSourceCount: directPhysicalSourceCount,
              levelGrids: directGrids,
              identityStrideWords: 1,
              arenaCount: 1,
              label: 'native-pair-direct-20k-fields'
            }
          );
        const directEncoder = device.createCommandEncoder();
        const directActiveExecution = directActiveRuntime.encode(
          directEncoder,
          {
            sourceBuffer: directSourceBuffer,
            physicalSourceCount: directPhysicalSourceCount,
            sourceRowLayoutId:
              mechanicsAbi
                .SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
            ...directEpochIdentity,
            sourceFamily: 'native-pair-direct-20k',
            exactNearQueryProfile: directQueryProfile
          }
        );
        const directDirectoryExecution = directDirectoryRuntime.encode(
          directEncoder,
          {
            sourceBuffer: directSourceBuffer,
            sourceCount: directPhysicalSourceCount,
            sourceRowLayoutId:
              mechanicsAbi
                .SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
            sortMode: 'lexicographic-u32x5',
            ...directEpochIdentity,
            sortUniqueOrdinal: directEpochIdentity.buildOrdinal,
            sourceFamily: 'native-pair-direct-20k',
            exactNearQueryProfile: directQueryProfile,
            activeSourceView: directActiveExecution
          }
        );
        const directParentExecutions = directParentRuntimes.map(
          (parentRuntime, selectedLevel) => parentRuntime.encode(
            directEncoder,
            {
              sourceBuffer: directSourceBuffer,
              sourceCount: directPhysicalSourceCount,
              sourceRowLayoutId:
                mechanicsAbi
                  .SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
              selectedLevel,
              spatialExecution: directDirectoryExecution
            }
          )
        );
        const directPairExecution = directPairRuntime.encode(
          directEncoder,
          {
            sourceBuffer: directSourceBuffer,
            identityBuffer: directIdentityBuffer,
            sourceCount: directPhysicalSourceCount,
            sourceRowLayoutId:
              mechanicsAbi
                .SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
            identityStrideWords: 1,
            levelViews: directParentExecutions.map(
              (parentMechanicsView, selectedLevel) => ({
                selectedLevel,
                parentMechanicsView
              })
            )
          }
        );
        device.queue.submit([directEncoder.finish()]);
        directActiveRuntime.markExecutionSubmitted(directActiveExecution);
        directDirectoryRuntime.markExecutionSubmitted(
          directDirectoryExecution
        );
        directParentExecutions.forEach((execution, levelOrdinal) => {
          directParentRuntimes[levelOrdinal].markExecutionSubmitted(execution);
        });
        directPairRuntime.markExecutionSubmitted(directPairExecution);
        await device.queue.onSubmittedWorkDone();
        const directActiveWords = await readWords(
          directActiveExecution.activeSourceViewBuffer,
          directActiveExecution.layout.byteLength,
          'native-pair-direct-20k-active-readback'
        );
        const directChildren = directPairExecution.mechanicsFieldViews;
        const directDescriptorWords = await Promise.all(
          directChildren.map((child, levelOrdinal) => readWords(
            child.fieldViewBuffer,
            child.layout.keyOffsetWords * Uint32Array.BYTES_PER_ELEMENT,
            `native-pair-direct-20k-child-${levelOrdinal}-descriptors`
          ))
        );
        const directKeyWords = await Promise.all(
          directChildren.map((child, levelOrdinal) => {
            const fieldCount = directDescriptorWords[levelOrdinal][34];
            return readWordsAt(
              child.fieldViewBuffer,
              child.layout.keyOffsetWords * Uint32Array.BYTES_PER_ELEMENT,
              fieldCount * child.layout.keyWords
                * Uint32Array.BYTES_PER_ELEMENT,
              `native-pair-direct-20k-child-${levelOrdinal}-keys`
            );
          })
        );
        let directActiveForwardMismatchCount = 0;
        let directActiveReverseMismatchCount = 0;
        directActivePhysical.forEach((physicalSource, activeOrdinal) => {
          if (
            directActiveWords[
              directActiveExecution.layout.activeToPhysicalOffsetWords
                + activeOrdinal
            ] !== physicalSource
          ) {
            directActiveForwardMismatchCount += 1;
          }
        });
        for (
          let physicalSource = 0;
          physicalSource < directPhysicalSourceCount;
          physicalSource += 1
        ) {
          const ordinal =
            directActiveOrdinalByPhysical[physicalSource];
          const expected = ordinal < 0 ? 0xffff_ffff : ordinal;
          if (
            directActiveWords[
              directActiveExecution.layout.physicalToActiveOffsetWords
                + physicalSource
            ] !== expected
          ) {
            directActiveReverseMismatchCount += 1;
          }
        }
        const directChildSummaries = directChildren.map(
          (child, levelOrdinal) => {
            const words = directDescriptorWords[levelOrdinal];
            const keys = directKeyWords[levelOrdinal];
            let admittedDescriptorCount = 0;
            let descriptorIdentityMismatchCount = 0;
            let descriptorStencilMismatchCount = 0;
            for (
              let physicalSource = 0;
              physicalSource < directPhysicalSourceCount;
              physicalSource += 1
            ) {
              const descriptor = child.layout.descriptorOffsetWords
                + physicalSource * child.layout.descriptorWords;
              const active = directActiveSet.has(physicalSource);
              const selected = active
                && (physicalSource & 1) === levelOrdinal;
              const expected = selected
                ? [
                    1,
                    levelOrdinal === 0 ? 11 : 22,
                    directIdentityWords[physicalSource],
                    1
                  ]
                : [0, 0, 0, 0];
              for (let word = 0; word < 4; word += 1) {
                if (words[descriptor + word] !== expected[word]) {
                  descriptorIdentityMismatchCount += 1;
                }
              }
              if (selected) {
                admittedDescriptorCount += 1;
                for (let stencil = 0; stencil < 27; stencil += 1) {
                  const fieldIndex = words[descriptor + 4 + stencil];
                  if (
                    fieldIndex >= words[34]
                    || keys[fieldIndex * 4 + 1] !== 1
                    || keys[fieldIndex * 4 + 2]
                      !== (levelOrdinal === 0 ? 11 : 22)
                    || keys[fieldIndex * 4 + 3]
                      !== directIdentityWords[physicalSource]
                  ) {
                    descriptorStencilMismatchCount += 1;
                  }
                }
              } else if (active) {
                for (let stencil = 0; stencil < 27; stencil += 1) {
                  if (words[descriptor + 4 + stencil] !== 0xffff_ffff) {
                    descriptorStencilMismatchCount += 1;
                  }
                }
              }
            }
            return {
              status: child.status,
              header: Array.from(words.slice(0, 64)),
              ownerMatches:
                child.ownerRuntime === directPairRuntime,
              pairMatches: child.pairExecution === directPairExecution,
              sharedCandidateBuffer:
                child.candidateKeyBuffer
                  === directChildren[1 - levelOrdinal].candidateKeyBuffer,
              readbackPerformed: child.readbackPerformed,
              admittedDescriptorCount,
              descriptorIdentityMismatchCount,
              descriptorStencilMismatchCount
            };
          }
        );
        const directFence = device.queue.onSubmittedWorkDone();
        const directRuntimeActiveBeforeRelease =
          directPairRuntime.activeExecutionCount();
        const directPairStatusBeforeRelease = directPairExecution.status;
        const directReleaseResults = await Promise.all([
          directPairRuntime.releaseExecutionAfter(
            directPairExecution,
            directFence
          ),
          ...directParentExecutions.map((execution, levelOrdinal) => (
            directParentRuntimes[levelOrdinal].releaseExecutionAfter(
              execution,
              directFence
            )
          )),
          directDirectoryRuntime.releaseExecutionAfter(
            directDirectoryExecution,
            directFence
          ),
          directActiveRuntime.releaseExecutionAfter(
            directActiveExecution,
            directFence
          )
        ]);
        summary.direct20k = {
          physicalSourceCount: directPhysicalSourceCount,
          activeSourceCount: directActiveWords[18],
          dormantSourceCount: directActiveWords[20],
          candidateCount: directActiveWords[43],
          activeStatus: directActiveWords[2],
          activeForwardMismatchCount:
            directActiveForwardMismatchCount,
          activeReverseMismatchCount:
            directActiveReverseMismatchCount,
          pairStatus: directPairStatusBeforeRelease,
          sharedRadixExecutionCount:
            directPairExecution.sharedRadixExecutionCount,
          pairReadbackPerformed: directPairExecution.readbackPerformed,
          pairChildrenExact:
            directPairExecution.mechanicsFieldViews === directChildren,
          runtimeActiveBeforeRelease:
            directRuntimeActiveBeforeRelease,
          children: directChildSummaries,
          releaseResults: directReleaseResults,
          pairReleased: directPairExecution.released,
          childrenReleased:
            directChildren.every((child) => child.released === true),
          runtimeActiveAfterRelease:
            directPairRuntime.activeExecutionCount()
        };
        directPairRuntime.destroy();
        directParentRuntimes.forEach((parentRuntime) => {
          parentRuntime.destroy();
        });
        directDirectoryRuntime.destroy();
        directActiveRuntime.destroy();

        // Physical source/identity/directory authority remains at P=20,000,
        // while active-derived field and parent-field storage is retained at
        // the exact authenticated A=4,500 tier.
        const sparsePhysicalSourceCount = 20_000;
        const sparseActiveSourceCount = 4_500;
        const sparseActivePhysical = Array.from(
          { length: sparseActiveSourceCount },
          (_, ordinal) => (ordinal * 37) % sparsePhysicalSourceCount
        ).sort((left, right) => left - right);
        const sparseActiveSet = new Set(sparseActivePhysical);
        const sparseActiveOrdinalByPhysical =
          new Int32Array(sparsePhysicalSourceCount);
        sparseActiveOrdinalByPhysical.fill(-1);
        sparseActivePhysical.forEach((physicalSource, activeOrdinal) => {
          sparseActiveOrdinalByPhysical[physicalSource] = activeOrdinal;
        });
        const sparseSourceRows =
          new Float32Array(sparsePhysicalSourceCount * 16);
        const sparseStateRows =
          new Float32Array(sparsePhysicalSourceCount * 8);
        const sparseIdentityWords =
          new Uint32Array(sparsePhysicalSourceCount);
        for (
          let physicalSource = 0;
          physicalSource < sparsePhysicalSourceCount;
          physicalSource += 1
        ) {
          const level = physicalSource & 1;
          const spacing = level === 0 ? 0.25 : 0.5;
          const active = sparseActiveSet.has(physicalSource);
          const row = physicalSource * 16;
          sparseSourceRows[row] = level;
          sparseSourceRows[row + 1] = spacing;
          sparseSourceRows[row + 2] = active ? 0.1 : 0;
          sparseSourceRows[row + 3] = active ? 0.001 : 0;
          sparseSourceRows[row + 4] = active ? 0.001 : 0;
          sparseSourceRows[row + 5] = active ? 0.001 : 0;
          sparseSourceRows[row + 6] = active ? 1 : 0;
          sparseSourceRows[row + 7] = active ? 1000 : 0;
          sparseSourceRows[row + 8] = 1;
          sparseSourceRows[row + 9] = level === 0 ? 11 : 22;
          sparseSourceRows[row + 10] = 1;
          sparseSourceRows[row + 11] = 0;
          sparseSourceRows[row + 12] = 0.5;
          sparseSourceRows[row + 13] = 0.5;
          sparseSourceRows[row + 14] = 0.5;
          sparseSourceRows[row + 15] = 0;
          const stateRow = physicalSource * 8;
          sparseStateRows[stateRow] = 0.5;
          sparseStateRows[stateRow + 1] = 0.5;
          sparseStateRows[stateRow + 2] = 0.5;
          sparseStateRows[stateRow + 3] = active ? 1 : 0;
          sparseIdentityWords[physicalSource] =
            (0x0010_0000 + physicalSource) >>> 0;
        }
        const sparseSourceBuffer = makeBorrowedBuffer(
          'native-pair-production-sparse-assignment',
          sparseSourceRows.byteLength,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
            | GPUBufferUsage.COPY_SRC
        );
        const sparseStateBuffer = makeBorrowedBuffer(
          'native-pair-production-sparse-state',
          sparseStateRows.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const sparseIdentityBuffer = makeBorrowedBuffer(
          'native-pair-production-sparse-identity',
          sparseIdentityWords.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        device.queue.writeBuffer(sparseSourceBuffer, 0, sparseSourceRows);
        device.queue.writeBuffer(sparseStateBuffer, 0, sparseStateRows);
        device.queue.writeBuffer(
          sparseIdentityBuffer,
          0,
          sparseIdentityWords
        );
        const sparseEpochIdentity = {
          storageGeneration: 101,
          physicsTick: 103,
          physicsSubstep: 0,
          positionEpoch: 107,
          topologyEpoch: 109,
          chartEpoch: 113,
          levelEpoch: 127,
          supportEpoch: 131
        };
        const sparseLevelAssignment = {
          schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
          status: 'schroeder-level-assignment-submitted',
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          particleCount: sparsePhysicalSourceCount,
          assignmentStrideFloats: 16,
          assignmentBuffer: sparseSourceBuffer,
          assignmentBufferByteLength: sparseSourceRows.byteLength,
          sourceStateBuffer: sparseStateBuffer,
          sourceStateBufferBorrowed: true,
          ...sparseEpochIdentity,
          minLevel: 0,
          maxLevel: 1,
          chartId: 0,
          baseGridSpacingM: 0.25
        };
        const sparseGrids = [
          {
            gridNodeCount: 512,
            gridDims: [8, 8, 8],
            gridShift: 2,
            gridSpacingM: 0.25
          },
          {
            gridNodeCount: 125,
            gridDims: [5, 5, 5],
            gridShift: 2,
            gridSpacingM: 0.5
          }
        ];
        const productionGeneration =
          spatialModule.runSchroederSpatialEpochGenerationWebGpu({
            device,
            levelAssignment: sparseLevelAssignment,
            particleCount: sparsePhysicalSourceCount,
            particleIdentityBuffer: sparseIdentityBuffer,
            particleIdentityStrideWords: 1,
            activeSourceCapacity: sparseActiveSourceCount,
            mechanicsLevels: sparseGrids.map(
              (mechanicsGrid, selectedLevel) => ({
                selectedLevel,
                mechanicsGrid
              })
            ),
            directArenaCount: 1,
            mechanicsFieldPairV2Enabled: true,
            phaseVolumeSidecarsEnabled: false,
            exactNearCellTreeEnabled: false
          });
        if (
          productionGeneration.ready !== true
          || productionGeneration.selected !== true
        ) {
          throw new Error(
            'sparse production generation rejected: '
              + `${productionGeneration.status}: `
              + `${productionGeneration.reason || 'no reason'}`
          );
        }
        await device.queue.onSubmittedWorkDone();
        const productionPair = productionGeneration.mechanicsFieldPair;
        const productionChildren =
          productionGeneration.mechanicsLevelViews.map(
            (levelView) => levelView.mechanicsFieldView
          );
        const productionParentField = productionGeneration.parentFieldView;
        const activeView = productionGeneration.activeSourceView;
        const activeViewWords = await readWords(
          activeView.activeSourceViewBuffer,
          activeView.layout.byteLength,
          'native-pair-production-active-source-readback'
        );
        const productionChildWords = await Promise.all(
          productionChildren.map((child, levelOrdinal) => readWords(
            child.fieldViewBuffer,
            child.layout.keyOffsetWords * Uint32Array.BYTES_PER_ELEMENT,
            `native-pair-production-child-${levelOrdinal}-descriptors`
          ))
        );
        const productionKeyWords = await Promise.all(
          productionChildren.map((child, levelOrdinal) => {
            const fieldCount = productionChildWords[levelOrdinal][34];
            return readWordsAt(
              child.fieldViewBuffer,
              child.layout.keyOffsetWords * Uint32Array.BYTES_PER_ELEMENT,
              fieldCount * child.layout.keyWords
                * Uint32Array.BYTES_PER_ELEMENT,
              `native-pair-production-child-${levelOrdinal}-keys`
            );
          })
        );
        const productionStableOrderWords = await Promise.all(
          productionChildren.map((child, levelOrdinal) => readWords(
            child.stableCandidateOrderBuffer,
            sparseActiveSourceCount * 27 * Uint32Array.BYTES_PER_ELEMENT,
            `native-pair-production-child-${levelOrdinal}-stable-order`
          ))
        );
        const productionStateWords = await Promise.all(
          productionChildren.map((child, levelOrdinal) => {
            const fieldCount = productionChildWords[levelOrdinal][34];
            return readWordsAt(
              child.fieldViewBuffer,
              child.layout.stateOffsetWords * Uint32Array.BYTES_PER_ELEMENT,
              fieldCount * child.layout.stateWords
                * Uint32Array.BYTES_PER_ELEMENT,
              `native-pair-production-child-${levelOrdinal}-state`
            );
          })
        );
        const productionParentWords = await readWords(
          productionParentField.parentFieldViewBuffer,
          parentFieldAbi.SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS
            * Uint32Array.BYTES_PER_ELEMENT,
          'native-pair-production-parent-field-header'
        );
        let activeForwardMismatchCount = 0;
        let activeReverseMismatchCount = 0;
        for (
          let activeOrdinal = 0;
          activeOrdinal < sparseActivePhysical.length;
          activeOrdinal += 1
        ) {
          const physicalSource = sparseActivePhysical[activeOrdinal];
          if (
            activeViewWords[
              activeView.layout.activeToPhysicalOffsetWords + activeOrdinal
            ] !== physicalSource
          ) {
            activeForwardMismatchCount += 1;
          }
        }
        for (
          let physicalSource = 0;
          physicalSource < sparsePhysicalSourceCount;
          physicalSource += 1
        ) {
          const expectedOrdinal =
            sparseActiveOrdinalByPhysical[physicalSource];
          const expected = expectedOrdinal < 0
            ? 0xffff_ffff
            : expectedOrdinal;
          if (
            activeViewWords[
              activeView.layout.physicalToActiveOffsetWords + physicalSource
            ] !== expected
          ) {
            activeReverseMismatchCount += 1;
          }
        }
        const expectedStableOrders = [0, 1].map((selectedLevel) => {
          const matching = [];
          const opposite = [];
          const stencilNodes = nodesFor(
            [0.5, 0.5, 0.5],
            sparseGrids[selectedLevel]
          );
          sparseActivePhysical.forEach((physicalSource, activeOrdinal) => {
            for (let stencil = 0; stencil < 27; stencil += 1) {
              const candidate = activeOrdinal * 27 + stencil;
              if ((physicalSource & 1) === selectedLevel) {
                matching.push({
                  candidate,
                  key: [
                    stencilNodes[stencil],
                    (1 << 24)
                      | (selectedLevel === 0 ? 11 : 22),
                    sparseIdentityWords[physicalSource]
                  ]
                });
              } else {
                opposite.push(candidate);
              }
            }
          });
          matching.sort((left, right) => {
            for (let word = 0; word < 3; word += 1) {
              if (left.key[word] !== right.key[word]) {
                return left.key[word] - right.key[word];
              }
            }
            return left.candidate - right.candidate;
          });
          return matching.map((entry) => entry.candidate).concat(opposite);
        });
        const productionChildSummaries = productionChildren.map(
          (child, levelOrdinal) => {
            const words = productionChildWords[levelOrdinal];
            const keys = productionKeyWords[levelOrdinal];
            const stableOrder = productionStableOrderWords[levelOrdinal];
            let descriptorIdentityMismatchCount = 0;
            let descriptorStencilMismatchCount = 0;
            let keyOrderingMismatchCount = 0;
            let stableOrderMismatchCount = 0;
            let stateNonzeroCount = 0;
            let admittedDescriptorCount = 0;
            for (
              let physicalSource = 0;
              physicalSource < sparsePhysicalSourceCount;
              physicalSource += 1
            ) {
              const descriptor = child.layout.descriptorOffsetWords
                + physicalSource * child.layout.descriptorWords;
              const active = sparseActiveSet.has(physicalSource);
              const selected = active
                && (physicalSource & 1) === levelOrdinal;
              const expectedIdentity = selected
                ? [
                    1,
                    levelOrdinal === 0 ? 11 : 22,
                    sparseIdentityWords[physicalSource],
                    1
                  ]
                : [0, 0, 0, 0];
              for (let word = 0; word < 4; word += 1) {
                if (words[descriptor + word] !== expectedIdentity[word]) {
                  descriptorIdentityMismatchCount += 1;
                }
              }
              if (selected) {
                admittedDescriptorCount += 1;
                for (let stencil = 0; stencil < 27; stencil += 1) {
                  const fieldIndex = words[descriptor + 4 + stencil];
                  if (
                    fieldIndex >= words[34]
                    || keys[fieldIndex * 4 + 1] !== 1
                    || keys[fieldIndex * 4 + 2]
                      !== (levelOrdinal === 0 ? 11 : 22)
                    || keys[fieldIndex * 4 + 3]
                      !== sparseIdentityWords[physicalSource]
                  ) {
                    descriptorStencilMismatchCount += 1;
                  }
                }
              } else if (active) {
                for (let stencil = 0; stencil < 27; stencil += 1) {
                  if (words[descriptor + 4 + stencil] !== 0xffff_ffff) {
                    descriptorStencilMismatchCount += 1;
                  }
                }
              }
            }
            for (let key = 1; key < words[34]; key += 1) {
              const prior = (key - 1) * 4;
              const current = key * 4;
              let ordered = false;
              for (let word = 0; word < 4; word += 1) {
                if (keys[prior + word] < keys[current + word]) {
                  ordered = true;
                  break;
                }
                if (keys[prior + word] > keys[current + word]) {
                  break;
                }
              }
              if (!ordered) keyOrderingMismatchCount += 1;
            }
            for (
              let index = 0;
              index < expectedStableOrders[levelOrdinal].length;
              index += 1
            ) {
              if (
                stableOrder[index]
                  !== expectedStableOrders[levelOrdinal][index]
              ) {
                stableOrderMismatchCount += 1;
              }
            }
            for (const word of productionStateWords[levelOrdinal]) {
              if (word !== 0) stateNonzeroCount += 1;
            }
            return {
              schema: child.schema,
              status: child.status,
              selectedLevel: child.selectedLevel,
              ownerMatchesPair: child.ownerRuntime
                === productionGeneration.mechanicsFieldPairRuntime,
              pairExecutionMatches: child.pairExecution === productionPair,
              sourceBufferMatches: child.sourceBuffer === sparseSourceBuffer,
              identityBufferMatches:
                child.identityBuffer === sparseIdentityBuffer,
              candidateKeyBufferShared:
                child.candidateKeyBuffer
                  === productionChildren[1 - levelOrdinal].candidateKeyBuffer,
              stableOrderBufferDistinct:
                child.stableCandidateOrderBuffer
                  !== productionChildren[1 - levelOrdinal]
                    .stableCandidateOrderBuffer,
              readbackPerformed: child.readbackPerformed,
              hostActiveCountReadbackRequired:
                child.constructionDispatchEvidence
                  .hostActiveCountReadbackRequired,
              header: Array.from(words.slice(0, 64)),
              admittedDescriptorCount,
              descriptorIdentityMismatchCount,
              descriptorStencilMismatchCount,
              keyOrderingMismatchCount,
              stableOrderMismatchCount,
              stateNonzeroCount
            };
          }
        );
        const productionPairStatusBeforeRelease = productionPair.status;
        const productionRuntimeActiveBeforeRelease =
          productionGeneration.mechanicsFieldPairRuntime
            .activeExecutionCount();
        const productionReleaseScheduled =
          spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
            productionGeneration,
            device
          );
        const productionReleaseCompleted =
          await productionGeneration.releasePromise;
        summary.production = {
          physicalSourceCount: sparsePhysicalSourceCount,
          activeSourceCount: activeViewWords[18],
          dormantSourceCount: activeViewWords[20],
          candidateCount: activeViewWords[43],
          activeStatus: activeViewWords[2],
          activeForwardMismatchCount,
          activeReverseMismatchCount,
          pairSchema: productionPair.schema,
          pairStatus: productionPairStatusBeforeRelease,
          pairReadbackPerformed: productionPair.readbackPerformed,
          sharedRadixExecutionCount:
            productionPair.sharedRadixExecutionCount,
          pairChildrenExact:
            productionPair.mechanicsFieldViews[0]
                === productionChildren[0]
              && productionPair.mechanicsFieldViews[1]
                === productionChildren[1],
          generationFineAlias:
            productionGeneration.mechanicsFieldView
              === productionChildren[0],
          activeSourceCapacity:
            productionGeneration.activeSourceCapacity,
          parentFieldStatus: productionParentField.status,
          parentFieldReadbackPerformed:
            productionParentField.readbackPerformed,
          parentFieldChildrenExact:
            productionParentField.fineFieldView === productionChildren[0]
              && productionParentField.coarseFieldView
                === productionChildren[1],
          parentFieldHeader: Array.from(productionParentWords),
          runtimeActiveBeforeRelease:
            productionRuntimeActiveBeforeRelease,
          children: productionChildSummaries,
          releaseScheduled: productionReleaseScheduled,
          releaseCompleted: productionReleaseCompleted,
          pairReleased: productionPair.released,
          childrenReleased:
            productionChildren.every((child) => child.released === true),
          runtimeActiveAfterRelease:
            productionGeneration.mechanicsFieldPairRuntime
              .activeExecutionCount(),
          releaseOwners: productionGeneration.releaseOperationResults.map(
            (entry) => entry.owner
          )
        };
      } catch (error) {
        executionError = error?.stack || error?.message || String(error);
      }
      try {
        runtime?.destroy();
      } catch (error) {
        executionError ??= error?.stack || error?.message || String(error);
      }
      for (const buffer of borrowedBuffers) {
        try {
          buffer.destroy();
        } catch {
          // Best-effort fixture cleanup after preserving the first error.
        }
      }
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 50));
      device.destroy?.();
      return {
        status: 'complete',
        executionError,
        validationError: validationError?.message || null,
        uncapturedErrors,
        summary
      };
    });
  } finally {
    await browser.close();
  }
  assert.equal(result.status, 'complete', result.reason);
  assert.equal(result.executionError, null);
  assert.equal(result.validationError, null);
  assert.deepEqual(result.uncapturedErrors, []);
  assert.equal(
    result.summary.pairStatus,
    'schroeder-spatial-mechanics-field-pair-gpu-build-submitted'
  );
  assert.deepEqual(result.summary.activeHeader, {
    activeCount: 2,
    candidateCount: 54,
    completionOrdinal: 37,
    seal: 0x51ea_1ed1
  });
  assert.deepEqual(result.summary.activeToPhysical, [1, 3]);
  assert.deepEqual(
    result.summary.physicalToActive,
    [0xffff_ffff, 0, 0xffff_ffff, 1]
  );
  assert.deepEqual(result.summary.control.slice(0, 15), [
    54,
    37,
    27,
    27,
    3,
    2,
    54,
    0,
    0,
    0,
    0,
    37,
    0,
    1,
    1
  ]);

  const fieldStatus =
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
    | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED;
  const expectedNodes = (minimumCoordinate) => {
    const nodes = [];
    for (let i = minimumCoordinate; i < minimumCoordinate + 3; i += 1) {
      for (let j = minimumCoordinate; j < minimumCoordinate + 3; j += 1) {
        for (let k = minimumCoordinate; k < minimumCoordinate + 3; k += 1) {
          nodes.push((i * 5 + j) * 5 + k);
        }
      }
    }
    return nodes;
  };
  const expectedCandidateIndices = Array.from(
    { length: 27 },
    (_, index) => index
  );
  const expectedCoarseCandidateIndices = expectedCandidateIndices.map(
    (index) => index + 27
  );
  const [fine, coarse] = result.summary.children;
  for (const [levelOrdinal, child] of result.summary.children.entries()) {
    assert.equal(child.hostAdmitted, true);
    assert.equal(
      child.header[0],
      SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC
    );
    assert.equal(
      child.header[1],
      SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
    );
    assert.equal(child.header[2], fieldStatus);
    assert.equal(child.header[16], 4);
    assert.equal(child.header[17], levelOrdinal);
    assert.equal(child.header[18], 125);
    assert.equal(child.header[33], 54);
    assert.equal(child.header[34], 27);
    assert.equal(child.header[35], 0);
    assert.equal(child.header[36], 0);
    assert.equal(child.header[37], 0);
    assert.equal(child.header[38], 37);
    assert.deepEqual(child.header.slice(44, 47), [1, 1, 1]);
    assert.equal(child.header[50], 41);
    assert.equal(child.header[51], 54);
    assert.equal(child.header[52], 28);
    assert.equal(child.header[53], 1);
    assert.equal(child.header[54], 4);
    assert.deepEqual(
      child.header.slice(50, 60),
      [41, 54, 28, 1, 4, 1, 1, 1, 0, 0]
    );
    assert.deepEqual(child.header.slice(60, 63), [1, 1, 1]);
    assert.equal(child.keys.length, 27);
  }

  assert.deepEqual(
    fine.descriptors.map(({ identity }) => identity),
    [
      [0, 0, 0, 0],
      [1, 11, 103, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  );
  assert.deepEqual(fine.descriptors[1].identity, [1, 11, 103, 1]);
  assert.deepEqual(
    fine.descriptors[1].stencil,
    expectedCandidateIndices
  );
  assert.deepEqual(fine.descriptors[3].identity, [0, 0, 0, 0]);
  assert.deepEqual(
    fine.descriptors[3].stencil,
    Array(27).fill(0xffff_ffff)
  );
  assert.deepEqual(
    fine.keys,
    expectedNodes(2).map((node) => [node, 1, 11, 103])
  );
  assert.deepEqual(
    fine.stableOrder,
    [...expectedCandidateIndices, ...expectedCoarseCandidateIndices]
  );

  assert.deepEqual(
    coarse.descriptors.map(({ identity }) => identity),
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 22, 0, 1]
    ]
  );
  assert.deepEqual(coarse.descriptors[3].identity, [2, 22, 0, 1]);
  assert.deepEqual(
    coarse.descriptors[3].stencil,
    expectedCandidateIndices
  );
  assert.deepEqual(coarse.descriptors[1].identity, [0, 0, 0, 0]);
  assert.deepEqual(
    coarse.descriptors[1].stencil,
    Array(27).fill(0xffff_ffff)
  );
  assert.deepEqual(
    coarse.keys,
    expectedNodes(1).map((node) => [node, 2, 22, 0])
  );
  assert.deepEqual(
    coarse.stableOrder,
    [...expectedCoarseCandidateIndices, ...expectedCandidateIndices]
  );

  const direct20k = result.summary.direct20k;
  assert.equal(direct20k.physicalSourceCount, 20_000);
  assert.equal(direct20k.activeSourceCount, 4_500);
  assert.equal(direct20k.dormantSourceCount, 15_500);
  assert.equal(direct20k.candidateCount, 4_500 * 27);
  assert.equal(direct20k.activeStatus, 3);
  assert.equal(direct20k.activeForwardMismatchCount, 0);
  assert.equal(direct20k.activeReverseMismatchCount, 0);
  assert.equal(
    direct20k.pairStatus,
    'schroeder-spatial-mechanics-field-pair-gpu-build-submitted'
  );
  assert.equal(direct20k.sharedRadixExecutionCount, 1);
  assert.equal(direct20k.pairReadbackPerformed, false);
  assert.equal(direct20k.pairChildrenExact, true);
  assert.equal(direct20k.runtimeActiveBeforeRelease, 1);
  let direct20kAdmittedDescriptorCount = 0;
  for (const [levelOrdinal, child] of direct20k.children.entries()) {
    assert.equal(
      child.status,
      'schroeder-spatial-mechanics-field-view-gpu-build-submitted'
    );
    assert.equal(child.ownerMatches, true);
    assert.equal(child.pairMatches, true);
    assert.equal(child.sharedCandidateBuffer, true);
    assert.equal(child.readbackPerformed, false);
    assert.equal(child.header[0], SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC);
    assert.equal(
      child.header[1],
      SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
    );
    assert.equal(child.header[2], fieldStatus);
    assert.equal(child.header[16], 20_000);
    assert.equal(child.header[17], levelOrdinal);
    assert.equal(child.header[33], 4_500 * 27);
    assert.equal(child.header[34], child.admittedDescriptorCount * 27);
    assert.equal(child.header[35], 0);
    assert.equal(child.header[36], 0);
    assert.equal(child.header[37], 0);
    assert.equal(child.header[59], SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY);
    assert.equal(child.header[63], 0);
    assert.equal(child.descriptorIdentityMismatchCount, 0);
    assert.equal(child.descriptorStencilMismatchCount, 0);
    direct20kAdmittedDescriptorCount += child.admittedDescriptorCount;
  }
  assert.equal(direct20kAdmittedDescriptorCount, 4_500);
  assert.deepEqual(direct20k.releaseResults, [true, true, true, true, true]);
  assert.equal(direct20k.pairReleased, true);
  assert.equal(direct20k.childrenReleased, true);
  assert.equal(direct20k.runtimeActiveAfterRelease, 0);

  const production = result.summary.production;
  assert.equal(production.physicalSourceCount, 20_000);
  assert.equal(production.activeSourceCount, 4_500);
  assert.equal(production.dormantSourceCount, 15_500);
  assert.equal(production.candidateCount, 4_500 * 27);
  assert.equal(production.activeSourceCapacity, 4_500);
  assert.equal(production.activeStatus, 3);
  assert.equal(production.activeForwardMismatchCount, 0);
  assert.equal(production.activeReverseMismatchCount, 0);
  assert.equal(production.pairSchema, PAIR_SCHEMA);
  assert.equal(
    production.pairStatus,
    'schroeder-spatial-mechanics-field-pair-gpu-build-submitted'
  );
  assert.equal(production.pairReadbackPerformed, false);
  assert.equal(production.sharedRadixExecutionCount, 1);
  assert.equal(production.pairChildrenExact, true);
  assert.equal(production.generationFineAlias, true);
  assert.equal(
    production.parentFieldStatus,
    'schroeder-spatial-parent-field-view-gpu-build-submitted'
  );
  assert.equal(production.parentFieldReadbackPerformed, false);
  assert.equal(production.parentFieldChildrenExact, true);
  assert.equal(
    production.parentFieldHeader[0],
    SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_MAGIC
  );
  assert.equal(
    production.parentFieldHeader[1],
    SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_VERSION
  );
  assert.equal(
    production.parentFieldHeader[2],
    SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_READY
      | SCHROEDER_SPATIAL_PARENT_FIELD_STATUS_ADMITTED
  );
  assert.equal(production.parentFieldHeader[30], 4_500 * 27);
  assert.equal(production.parentFieldHeader[31], 4_500 * 27);
  assert.equal(production.runtimeActiveBeforeRelease, 1);
  assert.equal(production.children.length, 2);
  let admittedDescriptorCount = 0;
  for (const [levelOrdinal, child] of production.children.entries()) {
    assert.equal(
      child.schema,
      ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
    );
    assert.equal(
      child.status,
      'schroeder-spatial-mechanics-field-view-gpu-build-submitted'
    );
    assert.equal(child.selectedLevel, levelOrdinal);
    assert.equal(child.ownerMatchesPair, true);
    assert.equal(child.pairExecutionMatches, true);
    assert.equal(child.sourceBufferMatches, true);
    assert.equal(child.identityBufferMatches, true);
    assert.equal(child.candidateKeyBufferShared, true);
    assert.equal(child.stableOrderBufferDistinct, true);
    assert.equal(child.readbackPerformed, false);
    assert.equal(child.hostActiveCountReadbackRequired, false);
    assert.equal(child.header[0], SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC);
    assert.equal(
      child.header[1],
      SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
    );
    assert.equal(child.header[2], fieldStatus);
    assert.equal(child.header[16], 20_000);
    assert.equal(child.header[17], levelOrdinal);
    assert.equal(child.header[33], 4_500 * 27);
    assert.equal(child.header[34], child.admittedDescriptorCount * 27);
    assert.equal(child.header[35], 0);
    assert.equal(child.header[36], 0);
    assert.equal(child.header[37], 0);
    assert.equal(child.header[59], SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY);
    assert.equal(child.header[63], 0);
    assert.equal(child.descriptorIdentityMismatchCount, 0);
    assert.equal(child.descriptorStencilMismatchCount, 0);
    assert.equal(child.keyOrderingMismatchCount, 0);
    assert.equal(child.stableOrderMismatchCount, 0);
    assert.equal(child.stateNonzeroCount, 0);
    admittedDescriptorCount += child.admittedDescriptorCount;
  }
  assert.equal(admittedDescriptorCount, 4_500);
  assert.equal(production.releaseScheduled, true);
  assert.equal(production.releaseCompleted, true);
  assert.equal(production.pairReleased, true);
  assert.equal(production.childrenReleased, true);
  assert.equal(production.runtimeActiveAfterRelease, 0);
  assert.equal(
    production.releaseOwners.filter(
      (owner) => owner === 'mechanics-field-pair'
    ).length,
    1
  );
});
