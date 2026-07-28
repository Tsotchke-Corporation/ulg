import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_EPOCH_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_EPOCH_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_EPOCH_STATUS_READY,
  SCHROEDER_SPATIAL_EPOCH_V2_ACTIVE_COUNT_AUTHORITY_WORD,
  SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI,
  SCHROEDER_SPATIAL_QUERY_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
  createSchroederBoundedAtlasPlan,
  createSchroederSpatialEpochBuildPlan,
  createSchroederSpatialEpochLayout,
  decodeSchroederSignedOrderKey,
  encodeSchroederSignedOrderKey,
  validateSchroederSpatialEpochConsumerDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  schroederSpatialEpochAssembleWgsl,
  schroederSpatialEpochKeyWgsl,
  schroederSpatialEpochV2AssembleWgsl,
  schroederSpatialEpochV2KeyWgsl
} from '../ulg-gpu-abi/src/schroederSpatialEpochWgsl.js';
import {
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_OFFSET_WORDS,
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES,
  SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_WORDS
} from '../ulg-gpu-abi/src/schroederMechanicsSpatialAuthorityWgsl.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_PARAMS_BYTES,
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
  ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
  createSchroederSpatialMechanicsViewPlan,
  validateSchroederSpatialMechanicsViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  schroederSpatialMechanicsViewWgsl
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsViewWgsl.js';
import {
  validateSchroederSpatialHierarchyViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialHierarchyView.js';
import {
  validateSchroederSpatialParentFieldViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import {
  validateSchroederSpatialPhaseVolumeMomentDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeMoment.js';
import {
  validateSchroederSpatialPhaseVolumeReceiptDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceipt.js';
import {
  validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeInterfaceProposal.js';
import {
  validateSchroederSpatialAggregateViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialAggregateView.js';
import {
  ULG_SCHROEDER_SPATIAL_GPU_LOGICAL_COUNT_SOURCE_SCHEMA,
  acquireSchroederSpatialEpochGenerationConsumerLease,
  armSchroederSpatialLegacyLevelAssignmentDirectoryV1ForNativeTest,
  createSchroederSpatialEpochGpu,
  ownsSchroederSpatialEpochGenerationConsumerLease,
  quarantineSchroederSpatialEpochGenerationAfterDeviceLoss,
  releaseSchroederSpatialEpochGenerationConsumerLease,
  releaseSchroederSpatialEpochGenerationConsumerLeaseAfter,
  releaseSchroederSpatialEpochGenerationAfterQueue,
  resolveSchroederSpatialDirectoryActiveNodeSource,
  schroederSpatialEpochGenerationRetirementCapability,
  runSchroederSpatialEpochGenerationWebGpu,
  runSchroederSpatialEpochGenerationWithBackpressureWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  createSchroederSpatialActiveSourceViewGpu
} from '../src/runtime/sph/schroederSpatialActiveSourceViewGpu.js';

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
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        writes.push({
          buffer,
          offset,
          byteLength: data.byteLength,
          snapshot: bytes.slice().buffer
        });
      },
      submit(commandBuffers) {
        submissions.push(commandBuffers);
      },
      onSubmittedWorkDone() {
        return Promise.resolve();
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          this.destroyCount += 1;
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
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
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
    },
    finish() {
      return { label: 'fake-spatial-command-buffer', events };
    }
  };
}

function createDirectSpatialActiveNodeList(device, overrides = {}) {
  const activeNodeBuffer = overrides.activeNodeBuffer ?? device.createBuffer({
    label: 'direct-spatial-active-node-source',
    size: 2 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  return {
    schema: 'peercompute.ulg.schroeder-active-node-list-execution.v0',
    status: 'schroeder-active-node-list-submitted',
    spatialDirectorySourceSchema:
      'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
    spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
    spatialDirectorySourceReady: true,
    spatialEpochSourceSchema: 'peercompute.ulg.schroeder-spatial-active-node-source.v1',
    spatialEpochSourceStatus: 'schroeder-spatial-active-node-source-ready',
    spatialEpochSourceReady: true,
    spatialEpochLevelSpacingMode: 'base-grid-spacing-times-pow2-level',
    spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
    spatialEpochMinLevel: -1,
    spatialEpochMaxLevel: 1,
    spatialEpochBaseGridSpacingM: 0.25,
    spatialEpochChartId: 0,
    activeCandidateCount: 2,
    activeNodeStrideFloats: 16,
    activeNodeBuffer,
    spatialEpochStorageGeneration: 11,
    spatialEpochPhysicsTick: 13,
    spatialEpochPhysicsSubstep: 0,
    spatialEpochPositionEpoch: 17,
    spatialEpochTopologyEpoch: 19,
    spatialEpochChartEpoch: 23,
    spatialEpochLevelEpoch: 29,
    spatialEpochSupportEpoch: 31,
    phaseVolumeAssignmentOverlayEnabled: false,
    ...overrides,
    activeNodeBuffer
  };
}

function createDirectSpatialLevelAssignment(device, overrides = {}) {
  const particleCount = overrides.particleCount ?? 2;
  const assignmentBuffer = overrides.assignmentBuffer ?? device.createBuffer({
    label: 'direct-spatial-level-assignment-source',
    size: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const sourceStateBuffer = overrides.sourceStateBuffer ?? device.createBuffer({
    label: 'direct-spatial-level-assignment-state-source',
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
    minLevel: -1,
    maxLevel: 1,
    chartId: 0,
    baseGridSpacingM: 0.25,
    ...overrides,
    assignmentBuffer,
    sourceStateBuffer
  };
}

function createFullTwoLevelSpatialGeneration(
  device,
  {
    directArenaCount = undefined,
    phaseVolumeInterfaceProposalEnabled = false,
    gpuTimestampRecorder = null
  } = {}
) {
  const particleCount = 2;
  const sourceMechanicsBuffer = phaseVolumeInterfaceProposalEnabled
    ? device.createBuffer({
        label: 'loss-two-level-phase-volume-mechanics-source',
        size: particleCount * 32 * Float32Array.BYTES_PER_ELEMENT,
        usage: 128
      })
    : null;
  const levelAssignment = createDirectSpatialLevelAssignment(device, {
    ...(sourceMechanicsBuffer ? {
      sourceMechanicsBuffer,
      sourceMechanicsBufferBorrowed: true,
      sourceMechanicsBufferByteLength: sourceMechanicsBuffer.size
    } : {})
  });
  const particleIdentityBuffer = device.createBuffer({
    label: 'loss-two-level-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const particleThermoBuffer = device.createBuffer({
    label: 'loss-two-level-thermo-source',
    size: levelAssignment.particleCount * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const particleBufferSet = {
    status: 'webgpu-uploaded',
    particleCount: levelAssignment.particleCount,
    stateStrideBytes: 8 * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes: 12 * Float32Array.BYTES_PER_ELEMENT,
    identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
    stateBuffer: levelAssignment.sourceStateBuffer,
    thermoBuffer: particleThermoBuffer,
    identityBuffer: particleIdentityBuffer,
    storageGeneration: levelAssignment.storageGeneration,
    physicsTick: levelAssignment.physicsTick,
    physicsSubstep: levelAssignment.physicsSubstep,
    positionEpoch: levelAssignment.positionEpoch,
    topologyEpoch: levelAssignment.topologyEpoch,
    chartEpoch: levelAssignment.chartEpoch,
    levelEpoch: levelAssignment.levelEpoch,
    supportEpoch: levelAssignment.supportEpoch
  };
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    particleBufferSet,
    ...(directArenaCount == null ? {} : { directArenaCount }),
    phaseVolumeInterfaceProposalEnabled,
    gpuTimestampRecorder,
    mechanicsLevels: [
      {
        selectedLevel: 0,
        mechanicsGrid: {
          gridNodeCount: 512,
          gridDims: [8, 8, 8],
          gridShift: 2,
          gridSpacingM: 0.25
        }
      },
      {
        selectedLevel: 1,
        mechanicsGrid: {
          gridNodeCount: 125,
          gridDims: [5, 5, 5],
          gridShift: 2,
          gridSpacingM: 0.5
        }
      }
    ]
  });
  return {
    generation,
    levelAssignment,
    particleIdentityBuffer,
    particleThermoBuffer,
    particleBufferSet,
    sourceMechanicsBuffer
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
  assert.equal(layout.queryEvidenceCapacityOffsetWords, 113);
  assert.equal(layout.queryEvidenceWordCapacity, SCHROEDER_SPATIAL_QUERY_EVIDENCE_WORDS);
  assert.equal(SCHROEDER_SPATIAL_QUERY_EVIDENCE_WORDS, 6);
  assert.equal(layout.wordLength, 119);
  assert.equal(layout.byteLength, 476);
  assert.deepEqual(
    SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI.queryGeometryEvidence.layout.slice(4),
    ['occupiedLevelMaskLow:u32', 'occupiedLevelMaskHigh:u32']
  );
  assert.equal(SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS, 1);
  assert.equal(SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY, 2);
  assert.match(SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI.consumerDispatchLinearization, /workgroup\.y/);
});

test('compact mechanics view ABI fixes authenticated header, indirect, and node regions', () => {
  const plan = createSchroederSpatialMechanicsViewPlan({
    sourceCount: 2,
    sourceRowLayoutId: SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    selectedLevel: 0,
    gridNodeCount: 512,
    gridDims: [8, 8, 8],
    gridShift: 2,
    gridSpacingM: 0.25,
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
    completionOrdinal: 43
  });
  assert.equal(plan.schema, ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA);
  assert.equal(SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_OFFSET_WORDS, 20);
  assert.equal(SCHROEDER_SPATIAL_MECHANICS_VIEW_HEADER_WORDS, 40);
  assert.equal(SCHROEDER_SPATIAL_MECHANICS_VIEW_DISPATCH_OFFSET_WORDS, 60);
  assert.equal(SCHROEDER_SPATIAL_MECHANICS_VIEW_NODE_OFFSET_WORDS, 64);
  assert.equal(SCHROEDER_SPATIAL_MECHANICS_VIEW_PARAMS_BYTES, 192);
  assert.equal(plan.layout.nodeCapacity, 512);
  assert.equal(plan.layout.occupancyWordCount, 16);
  assert.equal(plan.layout.wordLength, 576);
  assert.equal(plan.particleAligned, undefined);
  assert.match(schroederSpatialMechanicsViewWgsl, /fn spatial_directory_admitted/);
  assert.match(schroederSpatialMechanicsViewWgsl, /fn mark_mechanics_nodes/);
  assert.match(schroederSpatialMechanicsViewWgsl, /fn scatter_mechanics_nodes/);
  assert.match(schroederSpatialMechanicsViewWgsl, /strict|destination/);
  assert.throws(
    () => createSchroederSpatialMechanicsViewPlan({
      ...plan,
      gridNodeCount: 511,
      gridDims: [8, 8, 8]
    }),
    /gridNodeCount/
  );
});

test('direct level-assignment generation publishes and retires its active-source and compact mechanics views', async () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const particleIdentityBuffer = device.createBuffer({
    label: 'direct-spatial-level-assignment-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    }
  });
  assert.equal(generation.ready, true, generation.reason);
  assert.equal(generation.selected, true);
  assert.equal(generation.runtime.schema, ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA);
  assert.equal(generation.runtime.directoryAbiVersion, SCHROEDER_SPATIAL_EPOCH_V2_VERSION);
  assert.equal(generation.execution.schema, ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA);
  assert.equal(generation.execution.abiVersion, SCHROEDER_SPATIAL_EPOCH_V2_VERSION);
  assert.equal(generation.execution.cellCapacity, generation.runtime.cellCapacity);
  assert.equal(generation.execution.cellCapacity, levelAssignment.particleCount);
  assert.equal(
    generation.execution.reverseEncoding,
    SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE
  );
  assert.equal(device.submissions.length, 1);
  assert.equal(generation.execution.sourceBuffer, levelAssignment.assignmentBuffer);
  assert.equal(generation.activeSourceView.sourceBuffer, levelAssignment.assignmentBuffer);
  assert.equal(generation.execution.activeSourceView, generation.activeSourceView);
  assert.equal(
    generation.execution.activeSourceViewBuffer,
    generation.activeSourceView.activeSourceViewBuffer
  );
  assert.equal(generation.activeSourceView.submitPerformed, true);
  assert.equal(generation.activeSourceViewRuntime.activeExecutionCount(), 1);
  assert.equal(generation.execution.activeSourceCount, null);
  assert.equal(generation.execution.activeSourceCountReadbackPerformed, false);
  assert.equal(generation.execution.readbackPerformed, false);
  assert.equal(
    generation.execution.activeSourceCountAuthority.activeSourceView,
    generation.activeSourceView
  );
  assert.equal(
    generation.execution.activeSourceCountAuthority.offsetWords,
    SCHROEDER_SPATIAL_EPOCH_V2_ACTIVE_COUNT_AUTHORITY_WORD
  );
  assert.equal(
    generation.execution.logicalSourceCountAuthority,
    generation.execution.activeSourceCountAuthority
  );
  assert.equal(
    generation.mechanicsView.activeSourceCountAuthority,
    generation.execution.activeSourceCountAuthority
  );
  assert.equal(
    generation.mechanicsFieldView.activeSourceCountAuthority,
    generation.execution.activeSourceCountAuthority
  );
  assert.equal(
    generation.mechanicsFieldView.directoryBuffer,
    generation.execution.directoryBuffer
  );
  assert.equal(generation.mechanicsFieldView.forceRadixFallbackRequested, false);
  assert.equal(generation.source.sourceStateBuffer, levelAssignment.sourceStateBuffer);
  assert.equal(generation.mechanicsView.sourceBuffer, generation.execution.sourceBuffer);
  assert.equal(generation.mechanicsView.directoryBuffer, generation.execution.directoryBuffer);
  assert.equal(generation.mechanicsView.sourceRowLayoutId,
    SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0);
  assert.equal(generation.mechanicsView.indirectDispatchBuffer,
    generation.mechanicsView.mechanicsViewBuffer);
  assert.equal(generation.mechanicsView.indirectDispatchOffsetBytes, 240);
  assert.equal(generation.mechanicsView.bufferAllocationCountDuringEncode, 0);
  assert.equal(generation.mechanicsView.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(validateSchroederSpatialMechanicsViewDescriptor(
    generation.mechanicsView,
    {
      generationId: generation.execution.generationId,
      completionOrdinal: generation.execution.buildOrdinal,
      gridDims: [8, 8, 8]
    }
  ).admitted, true);
  assert.equal(validateSchroederSpatialMechanicsViewDescriptor({
    ...generation.mechanicsView
  }).status, 'schroeder-spatial-mechanics-view-rejected-owner');

  const submittedEvents = device.submissions[0][0].events;
  const entryPoints = submittedEvents
    .filter((event) => event.kind === 'pass')
    .flatMap((event) => event.commands.map((command) => command.pipeline));
  assert.ok(entryPoints.some((label) => /mechanics-view.*mark/.test(label)));
  assert.ok(entryPoints.some((label) => /mechanics-view.*count/.test(label)));
  assert.ok(entryPoints.some((label) => /mechanics-view.*scatter/.test(label)));
  assert.ok(entryPoints.some((label) => /mechanics-view.*finalize/.test(label)));
  const activeSourceClassifyIndex = entryPoints.findIndex(
    (label) => /active-source-view.*classify/.test(label)
  );
  const directoryKeyIndex = entryPoints.findIndex(
    (label) => /spatial-epoch.*key-pipeline/.test(label)
  );
  const activeSourceFinalizeIndex = entryPoints.findIndex(
    (label) => /active-source-view.*finalize/.test(label)
  );
  const directoryRadixIndex = entryPoints.findIndex(
    (label) => /spatial-epoch.*gpu-count-prepare/.test(label)
  );
  const directoryAssembleIndex = entryPoints.findIndex(
    (label) => /spatial-epoch.*assemble-pipeline/.test(label)
  );
  const directoryFinalizeIndex = entryPoints.findIndex(
    (label) => /spatial-epoch.*finalize-pipeline/.test(label)
  );
  assert.ok(activeSourceClassifyIndex >= 0);
  assert.ok(activeSourceFinalizeIndex > activeSourceClassifyIndex);
  assert.ok(directoryKeyIndex > activeSourceFinalizeIndex);
  assert.ok(directoryRadixIndex > directoryKeyIndex);
  assert.ok(directoryAssembleIndex > directoryRadixIndex);
  assert.ok(directoryFinalizeIndex > directoryAssembleIndex);

  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(
    generation,
    device
  ), true);
  assert.equal(await generation.releasePromise, true);
  assert.equal(generation.activeSourceView.released, true);
  assert.equal(generation.activeSourceViewRuntime.activeExecutionCount(), 0);
  assert.equal(generation.execution.released, true);
  assert.equal(generation.mechanicsView.released, true);

  const legacyGeneration = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList: createDirectSpatialActiveNodeList(device),
    particleCount: 2
  });
  assert.equal(legacyGeneration.ready, true, legacyGeneration.reason);
  assert.notEqual(legacyGeneration.runtime, generation.runtime);
  assert.equal(legacyGeneration.runtime.schema, ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA);
  assert.equal(legacyGeneration.runtime.directoryAbiVersion, SCHROEDER_SPATIAL_EPOCH_VERSION);
  assert.equal(legacyGeneration.execution.schema, ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA);
  assert.equal(legacyGeneration.execution.abiVersion, SCHROEDER_SPATIAL_EPOCH_VERSION);
  assert.equal(legacyGeneration.activeSourceView, null);
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(
    legacyGeneration,
    device
  ), true);
  assert.equal(await legacyGeneration.releasePromise, true);
});

test('native-test legacy level assignment keeps an owned directory-v1 ActiveRank generation', async () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  assert.throws(
    () => runSchroederSpatialEpochGenerationWebGpu({
      device,
      levelAssignment,
      particleCount: levelAssignment.particleCount,
      mechanicsLevels: [],
      nativeTestLegacyLevelAssignmentDirectoryV1: true
    }),
    /boolean selection is forbidden/
  );
  const nativeTestLegacyLevelAssignmentDirectoryV1Arm =
    armSchroederSpatialLegacyLevelAssignmentDirectoryV1ForNativeTest({
      device,
      levelAssignment
    });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    mechanicsLevels: [],
    nativeTestLegacyLevelAssignmentDirectoryV1Arm
  });
  assert.equal(
    nativeTestLegacyLevelAssignmentDirectoryV1Arm.consumed,
    true
  );
  assert.equal(generation.ready, true, generation.reason);
  assert.equal(generation.selected, true);
  assert.equal(generation.nativeTestLegacyLevelAssignmentDirectoryV1, true);
  assert.equal(generation.directoryAbiVersion, SCHROEDER_SPATIAL_EPOCH_VERSION);
  assert.equal(generation.runtime.schema, ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA);
  assert.equal(generation.execution.schema, ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA);
  assert.equal(generation.execution.abiVersion, SCHROEDER_SPATIAL_EPOCH_VERSION);
  assert.equal(generation.activeSourceView, null);
  assert.equal(generation.execution.activeSourceView, null);
  assert.equal(generation.activeRankView, generation.execution.activeRankView);
  assert.ok(generation.activeRankView);
  assert.equal(generation.execution.submitPerformed, true);
  assert.equal(generation.exactNearCellTree.submitPerformed, true);
  const lease = acquireSchroederSpatialEpochGenerationConsumerLease(
    generation,
    { consumerId: 'native-test-v1-active-rank-owned-generation' }
  );
  assert.equal(
    ownsSchroederSpatialEpochGenerationConsumerLease(lease, generation),
    true
  );
  assert.equal(
    releaseSchroederSpatialEpochGenerationConsumerLease(
      lease,
      { discardedEncoder: true }
    ),
    true
  );
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    true
  );
  assert.equal(await generation.releasePromise, true);
  assert.equal(generation.execution.released, true);

  assert.throws(
    () => runSchroederSpatialEpochGenerationWebGpu({
      device,
      levelAssignment,
      particleCount: levelAssignment.particleCount,
      mechanicsLevels: [],
      nativeTestLegacyLevelAssignmentDirectoryV1Arm
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_NATIVE_TEST_LEGACY_DIRECTORY_V1_ARM_CONSUMED'
    }
  );

  const otherLevelAssignment = createDirectSpatialLevelAssignment(device);
  const swappedArm =
    armSchroederSpatialLegacyLevelAssignmentDirectoryV1ForNativeTest({
      device,
      levelAssignment
    });
  assert.throws(
    () => runSchroederSpatialEpochGenerationWebGpu({
      device,
      levelAssignment: otherLevelAssignment,
      particleCount: otherLevelAssignment.particleCount,
      mechanicsLevels: [],
      nativeTestLegacyLevelAssignmentDirectoryV1Arm: swappedArm
    }),
    {
      code: 'ERR_SCHROEDER_SPATIAL_NATIVE_TEST_LEGACY_DIRECTORY_V1_ARM'
    }
  );
});

test('directory v2 keeps sparse physical identity GPU-resident and fail-closes forged ActiveSource reuse', () => {
  const device = createFakeDevice();
  const physicalSourceCount = 1001;
  const activeSourceCapacity = 64;
  const sourceBuffer = device.createBuffer({
    label: 'directory-v2-sparse-high-physical-source',
    size: physicalSourceCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const activeSourceRuntime = createSchroederSpatialActiveSourceViewGpu(device, {
    maxPhysicalSourceCount: physicalSourceCount,
    activeSourceCapacity,
    arenaCount: 1,
    label: 'directory-v2-active-source'
  });
  const directoryRuntime = createSchroederSpatialEpochGpu(device, {
    maxSourceCount: physicalSourceCount,
    activeSourceCapacity,
    cellCapacity: activeSourceCapacity,
    directoryAbiVersion: SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
    arenaCount: 1,
    label: 'directory-v2'
  });
  const exactNearQueryProfile = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
    status: 'schroeder-spatial-exact-near-query-profile-ready',
    ready: true,
    sourceCount: physicalSourceCount,
    chartId: 0,
    minLevel: -1,
    maxLevel: 1,
    levelCount: 3,
    baseGridSpacingM: 0.25,
    levelSpacingMode: 'base-grid-spacing-times-pow2-level',
    positionAuthority: 'same-epoch-pre-integration-particle-state'
  });
  const identity = Object.freeze({
    generationId: 7,
    deviceOrdinal: 3,
    laneOrdinal: 5,
    leaseToken: 11,
    sourceFamily: 'directory-v2-sparse-physical-family',
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
  });
  const encoder = createFakeEncoder();
  const retainedBufferCount = device.buffers.length;
  const activeSourceView = activeSourceRuntime.encode(encoder, {
    sourceBuffer,
    physicalSourceCount,
    sourceRowLayoutId: SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    exactNearQueryProfile,
    ...identity
  });
  const directoryArgs = {
    sourceBuffer,
    sourceCount: physicalSourceCount,
    sourceRowLayoutId: SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sortMode: 'lexicographic-u32x5',
    exactNearQueryProfile,
    activeSourceView,
    ...identity
  };
  const execution = directoryRuntime.encode(encoder, directoryArgs);

  assert.equal(device.buffers.length, retainedBufferCount);
  assert.equal(directoryRuntime.schema, ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA);
  assert.equal(directoryRuntime.gpuCountRadixPrepared, true);
  assert.equal(execution.schema, ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA);
  assert.equal(execution.abiVersion, SCHROEDER_SPATIAL_EPOCH_V2_VERSION);
  assert.equal(execution.physicalSourceCount, physicalSourceCount);
  assert.equal(execution.activeSourceCapacity, activeSourceCapacity);
  assert.equal(execution.activeSourceCount, null);
  assert.equal(execution.activeSourceCountReadbackPerformed, false);
  assert.equal(execution.readbackPerformed, false);
  assert.equal(execution.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(execution.bufferAllocationCountDuringEncode, 0);
  assert.equal(
    execution.activeSourceCountAuthority.activeSourceView,
    activeSourceView
  );
  assert.equal(
    execution.activeSourceCountAuthority.buffer,
    activeSourceView.activeSourceViewBuffer
  );
  assert.equal(
    execution.activeSourceCountAuthority.offsetWords,
    SCHROEDER_SPATIAL_EPOCH_V2_ACTIVE_COUNT_AUTHORITY_WORD
  );
  assert.equal(execution.activeSourceGenerationSeal.offsetWords, 30);
  assert.equal(
    execution.activeSourceGenerationSeal.expected,
    activeSourceView.buildOrdinal
  );
  assert.equal(
    execution.keyDispatchIndirectBuffer,
    activeSourceView.activeSourceViewBuffer
  );
  assert.equal(
    execution.keyDispatchIndirectOffsetBytes,
    activeSourceView.activeDispatchOffsetBytes
  );
  assert.equal(
    execution.assembleDispatchIndirectBuffer,
    activeSourceView.activeSourceViewBuffer
  );
  assert.equal(
    execution.assembleDispatchIndirectOffsetBytes,
    activeSourceView.activeDispatchOffsetBytes
  );
  assert.equal(
    execution.exactKeyBuffer.size,
    physicalSourceCount * 6 * Uint32Array.BYTES_PER_ELEMENT
  );
  assert.equal(
    execution.sortKeyBuffer.size,
    activeSourceCapacity * 5 * Uint32Array.BYTES_PER_ELEMENT
  );
  const paramsWrite = device.writes.find(
    ({ buffer, byteLength }) => (
      buffer.label === 'directory-v2-arena-0-params'
        && byteLength === 192
    )
  );
  assert.ok(paramsWrite);
  assert.equal(
    new DataView(paramsWrite.snapshot).getUint32(188, true),
    activeSourceCapacity
  );
  assert.match(
    schroederSpatialEpochV2KeyWgsl,
    /active_capacity == params\.physical_radix_count/
  );
  assert.match(
    schroederSpatialEpochV2AssembleWgsl,
    /arrayLength\(&sorted_group_indices\) >= params\.physical_radix_count/
  );
  assert.equal(
    execution.reverseEncoding,
    SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE
  );

  const physicalReverseClear = encoder.events.find((event) => (
    event.kind === 'clear'
      && event.label === execution.directoryBuffer.label
      && event.offset === execution.layout.physicalToCellPlusOneOffsetWords
        * Uint32Array.BYTES_PER_ELEMENT
      && event.size === execution.layout.physicalToCellPlusOneWords
        * Uint32Array.BYTES_PER_ELEMENT
  ));
  assert.ok(physicalReverseClear);
  const commands = encoder.events
    .filter((event) => event.kind === 'pass')
    .flatMap((event) => event.commands);
  const keyIndex = commands.findIndex(({ pipeline }) => (
    pipeline === 'directory-v2-key-pipeline'
  ));
  const radixPrepareIndex = commands.findIndex(({ pipeline }) => (
    pipeline === 'directory-v2-arena-0-radix-gpu-count-prepare'
  ));
  const assembleIndex = commands.findIndex(({ pipeline }) => (
    pipeline === 'directory-v2-assemble-pipeline'
  ));
  const finalizeIndex = commands.findIndex(({ pipeline }) => (
    pipeline === 'directory-v2-finalize-pipeline'
  ));
  assert.ok(keyIndex >= 0);
  assert.ok(radixPrepareIndex > keyIndex);
  assert.ok(assembleIndex > radixPrepareIndex);
  assert.ok(finalizeIndex > assembleIndex);
  assert.deepEqual(commands[keyIndex].dispatchIndirect, {
    label: activeSourceView.activeSourceViewBuffer.label,
    byteOffset: activeSourceView.activeDispatchOffsetBytes
  });
  assert.deepEqual(commands[assembleIndex].dispatchIndirect, {
    label: activeSourceView.activeSourceViewBuffer.label,
    byteOffset: activeSourceView.activeDispatchOffsetBytes
  });

  assert.throws(
    () => directoryRuntime.encode(createFakeEncoder(), {
      ...directoryArgs,
      activeSourceView: { ...activeSourceView }
    }),
    (error) => error.code === 'ERR_SCHROEDER_SPATIAL_V2_ACTIVE_SOURCE_AUTHORITY'
  );
  activeSourceView.buildOrdinal += 1;
  assert.throws(
    () => directoryRuntime.encode(createFakeEncoder(), directoryArgs),
    (error) => error.code === 'ERR_SCHROEDER_SPATIAL_V2_ACTIVE_SOURCE_AUTHORITY'
  );
  activeSourceView.buildOrdinal -= 1;

  assert.equal(
    directoryRuntime.releaseExecution(execution, { discardedEncoder: true }),
    true
  );
  assert.equal(
    activeSourceRuntime.releaseExecution(
      activeSourceView,
      { discardedEncoder: true }
    ),
    true
  );
  assert.throws(
    () => directoryRuntime.encode(createFakeEncoder(), directoryArgs),
    (error) => error.code === 'ERR_SCHROEDER_SPATIAL_V2_ACTIVE_SOURCE_AUTHORITY'
  );
  assert.equal(directoryRuntime.destroy(), true);
  assert.equal(activeSourceRuntime.destroy(), true);
});

test('generation consumer lease holds the complete spatial artifact family past an earlier owner fence', async () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    }
  });
  const lease = acquireSchroederSpatialEpochGenerationConsumerLease(
    generation,
    { consumerId: 'generation-family-retirement-unit' }
  );
  assert.equal(
    ownsSchroederSpatialEpochGenerationConsumerLease(lease, generation),
    true
  );

  const ownerFence = deferred();
  device.queue.onSubmittedWorkDone = () => ownerFence.promise;
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    true
  );
  assert.equal(generation.releaseScheduled, true);
  assert.equal(
    ownsSchroederSpatialEpochGenerationConsumerLease(lease, generation),
    true
  );
  ownerFence.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(generation.execution.released, false);
  assert.equal(generation.exactNearCellTree.released, false);

  const consumerFence = deferred();
  const leaseRelease =
    releaseSchroederSpatialEpochGenerationConsumerLeaseAfter(
      lease,
      consumerFence.promise
    );
  assert.equal(lease.releaseScheduled, true);
  assert.equal(
    ownsSchroederSpatialEpochGenerationConsumerLease(lease, generation),
    false
  );
  assert.throws(
    () => releaseSchroederSpatialEpochGenerationConsumerLease(
      lease,
      { discardedEncoder: true }
    ),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_GENERATION_CONSUMER_LEASE_RELEASE_SCHEDULED'
    }
  );
  assert.equal(generation.execution.released, false);
  consumerFence.resolve();
  assert.equal(await leaseRelease, true);
  assert.equal(await generation.releasePromise, true);
  assert.equal(lease.released, true);
  assert.equal(generation.execution.released, true);
  assert.equal(generation.exactNearCellTree.released, true);
  assert.equal(generation.mechanicsView.released, true);
});

test('strict raw V0J sidecar attaches only to an exact borrowed mechanics family', async () => {
  const device = createFakeDevice();
  const timestampBegins = [];
  const timestampEnds = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(encoder, descriptor) {
      const token = { encoder, descriptor };
      timestampBegins.push(token);
      return token;
    },
    endEncoderSpan(encoder, token) {
      timestampEnds.push({ encoder, token });
      return true;
    }
  };
  const sourceMechanicsBuffer = device.createBuffer({
    label: 'direct-spatial-phase-volume-mechanics-source',
    size: 2 * 32 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const levelAssignment = createDirectSpatialLevelAssignment(device, {
    sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: sourceMechanicsBuffer.size
  });
  const particleIdentityBuffer = device.createBuffer({
    label: 'direct-spatial-phase-volume-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    },
    gpuTimestampRecorder
  });
  assert.equal(generation.ready, true, generation.reason);
  assert.equal(
    generation.source.sourceMechanicsProvenanceStatus,
    'schroeder-spatial-directory-source-mechanics-v0j-ready'
  );
  assert.ok(generation.phaseVolumeMoment);
  assert.equal(
    generation.phaseVolumeMoment,
    generation.mechanicsLevelViews[0].phaseVolumeMoment
  );
  assert.equal(
    generation.phaseVolumeMoment.sourceMechanicsBuffer,
    sourceMechanicsBuffer
  );
  assert.equal(
    generation.phaseVolumeMoment.mechanicsFieldView,
    generation.mechanicsFieldView
  );
  assert.equal(
    validateSchroederSpatialPhaseVolumeMomentDescriptor(
      generation.phaseVolumeMoment,
      { generationId: generation.execution.generationId }
    ).admitted,
    true
  );
  assert.ok(generation.phaseVolumeReceipt);
  assert.equal(
    generation.phaseVolumeReceipt,
    generation.mechanicsLevelViews[0].phaseVolumeReceipt
  );
  assert.equal(
    generation.phaseVolumeReceipt.phaseVolumeMoment,
    generation.phaseVolumeMoment
  );
  assert.equal(
    generation.phaseVolumeReceipt.sourceBuffer,
    generation.phaseVolumeMoment.sourceBuffer
  );
  assert.equal(generation.phaseVolumeReceipt.sourceBufferBorrowed, true);
  assert.equal(
    generation.phaseVolumeReceipt.mechanicsFieldView,
    generation.mechanicsFieldView
  );
  assert.equal(
    generation.phaseVolumeReceipt.storageBindingCount,
    8
  );
  assert.equal(
    validateSchroederSpatialPhaseVolumeReceiptDescriptor(
      generation.phaseVolumeReceipt,
      { generationId: generation.execution.generationId }
    ).admitted,
    true
  );
  const entryPoints = device.submissions[0][0].events
    .filter((event) => event.kind === 'pass')
    .flatMap((event) => event.commands.map((command) => command.pipeline));
  assert.equal(
    entryPoints.filter((label) => /phase-volume-moment/.test(label)).length,
    4
  );
  assert.equal(
    entryPoints.filter((label) => /phase-volume-receipt/.test(label)).length,
    3
  );
  const phaseVolumeTimestampProducerIds = timestampBegins
    .map(({ descriptor }) => descriptor.producerId)
    .filter((producerId) => producerId.startsWith(
      'schroeder-spatial-phase-volume-moment'
    ));
  assert.deepEqual(phaseVolumeTimestampProducerIds, [
    'schroeder-spatial-phase-volume-moment-build',
    'schroeder-spatial-phase-volume-moment-emit',
    'schroeder-spatial-phase-volume-moment-ranges',
    'schroeder-spatial-phase-volume-moment-reduce',
    'schroeder-spatial-phase-volume-moment-finalize'
  ]);
  assert.equal(timestampEnds.filter(({ token }) => (
    token.descriptor.producerId.startsWith(
      'schroeder-spatial-phase-volume-moment'
    )
  )).length, 5);
  const receiptTimestampProducerIds = timestampBegins
    .map(({ descriptor }) => descriptor.producerId)
    .filter((producerId) => producerId.startsWith(
      'schroeder-spatial-phase-volume-receipt'
    ));
  assert.deepEqual(receiptTimestampProducerIds, [
    'schroeder-spatial-phase-volume-receipt-build',
    'schroeder-spatial-phase-volume-receipt-source-reduction',
    'schroeder-spatial-phase-volume-receipt-field-reduction',
    'schroeder-spatial-phase-volume-receipt-finalize'
  ]);
  assert.equal(timestampEnds.filter(({ token }) => (
    token.descriptor.producerId.startsWith(
      'schroeder-spatial-phase-volume-receipt'
    )
  )).length, 4);
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
  assert.equal(generation.phaseVolumeReceipt.released, true);
  assert.equal(generation.phaseVolumeMoment.released, true);
  assert.equal(sourceMechanicsBuffer.destroyCount, 0);
  assert.ok(generation.releaseOperationResults.some(
    (result) => result.owner === 'phase-volume-receipt-level-0'
      && result.confirmed === true
  ));
  assert.ok(generation.releaseOperationResults.some(
    (result) => result.owner === 'phase-volume-moment-level-0'
      && result.confirmed === true
  ));
});

test('diagnostic receipt A/B opt-out retains the exact S9-A sidecar without a mechanics fallback', async () => {
  const device = createFakeDevice();
  const sourceMechanicsBuffer = device.createBuffer({
    label: 'direct-spatial-phase-volume-ab-mechanics-source',
    size: 2 * 32 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const levelAssignment = createDirectSpatialLevelAssignment(device, {
    sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: sourceMechanicsBuffer.size
  });
  const particleIdentityBuffer = device.createBuffer({
    label: 'direct-spatial-phase-volume-ab-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    },
    phaseVolumeReceiptEnabled: false
  });
  assert.equal(generation.ready, true, generation.reason);
  assert.equal(generation.phaseVolumeReceiptEnabled, false);
  assert.ok(generation.phaseVolumeMoment);
  assert.equal(generation.phaseVolumeReceipt, null);
  assert.equal(generation.mechanicsLevelViews[0].phaseVolumeReceipt, null);
  const entryPoints = device.submissions[0][0].events
    .filter((event) => event.kind === 'pass')
    .flatMap((event) => event.commands.map((command) => command.pipeline));
  assert.equal(
    entryPoints.filter((label) => /phase-volume-moment/.test(label)).length,
    4
  );
  assert.equal(
    entryPoints.filter((label) => /phase-volume-receipt/.test(label)).length,
    0
  );
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
  assert.equal(generation.phaseVolumeMoment.released, true);
  assert.equal(sourceMechanicsBuffer.destroyCount, 0);
});

test('missing or unborrowed mechanics provenance leaves spatial generation intact without V0J sidecar', () => {
  const device = createFakeDevice();
  const sourceMechanicsBuffer = device.createBuffer({
    label: 'direct-spatial-unborrowed-mechanics-source',
    size: 2 * 32 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const levelAssignment = createDirectSpatialLevelAssignment(device, {
    sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: false
  });
  const particleIdentityBuffer = device.createBuffer({
    label: 'direct-spatial-unborrowed-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    }
  });
  assert.equal(generation.ready, true, generation.reason);
  assert.equal(generation.phaseVolumeMoment, null);
  assert.equal(generation.phaseVolumeReceipt, null);
  assert.equal(generation.mechanicsLevelViews[0].phaseVolumeMoment, null);
  assert.equal(generation.mechanicsLevelViews[0].phaseVolumeReceipt, null);
  assert.equal(
    generation.source.sourceMechanicsProvenanceStatus,
    'schroeder-spatial-directory-source-mechanics-v0j-not-borrowed'
  );
});

test('manufactured frozen fine refresh is rejected without controller-issued authority', () => {
  const device = createFakeDevice();
  const sourceMechanicsBuffer = device.createBuffer({
    label: 'direct-spatial-frozen-mechanics-source',
    size: 2 * 32 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const levelAssignment = createDirectSpatialLevelAssignment(device, {
    sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: sourceMechanicsBuffer.size,
    refreshMode: 'frozen-fine-substep'
  });
  const particleIdentityBuffer = device.createBuffer({
    label: 'direct-spatial-frozen-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    }
  });
  assert.equal(generation.ready, false);
  assert.equal(generation.selected, false);
  assert.equal(generation.directoryBuildCount, 0);
  assert.equal(generation.privateLookupBuildCount, 0);
  assert.equal(
    generation.status,
    'schroeder-spatial-directory-source-rejected-frozen-refresh-authority'
  );
  assert.match(generation.reason, /controller-issued topology\/generation proof/);
});

test('one spatial generation owns exactly two adjacent compact mechanics and field views', async () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const particleIdentityBuffer = device.createBuffer({
    label: 'direct-spatial-two-level-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const particleThermoBuffer = device.createBuffer({
    label: 'direct-spatial-two-level-thermo-source',
    size: levelAssignment.particleCount * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const particleBufferSet = {
    status: 'webgpu-uploaded',
    particleCount: levelAssignment.particleCount,
    stateStrideBytes: 8 * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes: 12 * Float32Array.BYTES_PER_ELEMENT,
    identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
    stateBuffer: levelAssignment.sourceStateBuffer,
    thermoBuffer: particleThermoBuffer,
    identityBuffer: particleIdentityBuffer,
    storageGeneration: levelAssignment.storageGeneration,
    physicsTick: levelAssignment.physicsTick,
    physicsSubstep: levelAssignment.physicsSubstep,
    positionEpoch: levelAssignment.positionEpoch,
    topologyEpoch: levelAssignment.topologyEpoch,
    chartEpoch: levelAssignment.chartEpoch,
    levelEpoch: levelAssignment.levelEpoch,
    supportEpoch: levelAssignment.supportEpoch
  };
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    particleBufferSet,
    mechanicsLevels: [
      {
        selectedLevel: 0,
        mechanicsGrid: {
          gridNodeCount: 512,
          gridDims: [8, 8, 8],
          gridShift: 2,
          gridSpacingM: 0.25
        }
      },
      {
        selectedLevel: 1,
        mechanicsGrid: {
          gridNodeCount: 125,
          gridDims: [5, 5, 5],
          gridShift: 2,
          gridSpacingM: 0.5
        }
      }
    ]
  });
  assert.equal(generation.ready, true, generation.reason);
  assert.equal(generation.directoryBuildCount, 1);
  assert.equal(generation.mechanicsLevelCount, 2);
  assert.deepEqual(generation.mechanicsLevels, [0, 1]);
  assert.equal(generation.hierarchyView.fineLevel, 0);
  assert.equal(generation.hierarchyView.coarseLevel, 1);
  assert.equal(generation.hierarchyView.spatialExecution, generation.execution);
  assert.equal(
    generation.hierarchyView.fineMechanicsView,
    generation.mechanicsLevelViews[0].mechanicsView
  );
  assert.equal(
    generation.hierarchyView.coarseMechanicsView,
    generation.mechanicsLevelViews[1].mechanicsView
  );
  assert.equal(validateSchroederSpatialHierarchyViewDescriptor(
    generation.hierarchyView,
    { generationId: generation.execution.generationId, fineLevel: 0, coarseLevel: 1 }
  ).admitted, true);
  assert.equal(validateSchroederSpatialParentFieldViewDescriptor(
    generation.parentFieldView,
    { generationId: generation.execution.generationId, fineLevel: 0, coarseLevel: 1 }
  ).admitted, true);
  assert.equal(generation.parentFieldView.hierarchyView, generation.hierarchyView);
  assert.equal(validateSchroederSpatialAggregateViewDescriptor(
    generation.aggregateView,
    { generationId: generation.execution.generationId }
  ).admitted, true);
  assert.equal(generation.aggregateView.particleBufferSet, particleBufferSet);
  assert.equal(generation.mechanicsView, generation.mechanicsLevelViews[0].mechanicsView);
  assert.equal(
    generation.mechanicsFieldView,
    generation.mechanicsLevelViews[0].mechanicsFieldView
  );
  for (const [index, levelView] of generation.mechanicsLevelViews.entries()) {
    assert.equal(levelView.selectedLevel, index);
    assert.equal(levelView.mechanicsView.directoryBuffer, generation.execution.directoryBuffer);
    assert.equal(levelView.mechanicsFieldView.parentMechanicsView, levelView.mechanicsView);
    assert.equal(levelView.mechanicsView.sourceBuffer, levelAssignment.assignmentBuffer);
    assert.equal(levelView.mechanicsFieldView.sourceBuffer, levelAssignment.assignmentBuffer);
    assert.equal(levelView.mechanicsView.released, false);
    assert.equal(levelView.mechanicsFieldView.released, false);
  }

  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
  assert.equal(generation.execution.released, true);
  for (const levelView of generation.mechanicsLevelViews) {
    assert.equal(levelView.mechanicsView.released, true);
    assert.equal(levelView.mechanicsFieldView.released, true);
  }
  assert.equal(generation.hierarchyView.released, true);
  assert.equal(generation.parentFieldView.released, true);
  assert.equal(generation.aggregateView.released, true);
  assert.equal(generation.exactNearCellTree.released, true);
  assert.deepEqual(
    generation.releaseOperationResults.map((result) => result.owner),
    [
      'spatial-active-source-view',
      'spatial-directory',
      'compact-mechanics-view-level-0',
      'mechanics-field-view-level-0',
      'compact-mechanics-view-level-1',
      'mechanics-field-view-level-1',
      'spatial-parent-field-view',
      'spatial-aggregate-view',
      'spatial-exact-near-cell-tree',
      'spatial-hierarchy-view'
    ]
  );
});

test('two-level V0J generation mounts and retires the opt-in read-only S9-C interface topology', async () => {
  const device = createFakeDevice();
  const timestampBegins = [];
  const timestampEnds = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(encoder, descriptor) {
      const token = { encoder, descriptor };
      timestampBegins.push(token);
      return token;
    },
    endEncoderSpan(encoder, token) {
      timestampEnds.push({ encoder, token });
      return true;
    }
  };
  const { generation, sourceMechanicsBuffer } = createFullTwoLevelSpatialGeneration(
    device,
    {
      phaseVolumeInterfaceProposalEnabled: true,
      gpuTimestampRecorder
    }
  );
  assert.equal(generation.ready, true, generation.reason);
  assert.equal(generation.phaseVolumeInterfaceProposalEnabled, true);
  assert.ok(sourceMechanicsBuffer);
  const proposal = generation.phaseVolumeInterfaceProposal;
  assert.ok(proposal);
  assert.equal(
    generation.phaseVolumeInterfaceProposalRuntime.ownsExecution(proposal),
    true
  );
  assert.equal(proposal.fineReceipt, generation.mechanicsLevelViews[0].phaseVolumeReceipt);
  assert.equal(proposal.coarseReceipt, generation.mechanicsLevelViews[1].phaseVolumeReceipt);
  assert.equal(proposal.parentFieldView, generation.parentFieldView);
  assert.equal(proposal.twoLevel, true);
  assert.equal(proposal.submitPerformed, true);
  assert.equal(proposal.diagnosticOnly, true);
  assert.equal(proposal.stateMutationAllowed, false);
  assert.equal(proposal.readbackPerformed, false);
  assert.equal(proposal.fullParticleReadbackPerformed, false);
  assert.equal(proposal.encodedDispatchCount, 3);
  assert.equal(
    validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor(proposal, {
      generationId: generation.execution.generationId,
      fineLevel: 0,
      coarseLevel: 1
    }).admitted,
    true
  );
  const proposalProducerIds = timestampBegins
    .map(({ descriptor }) => descriptor.producerId)
    .filter((producerId) => producerId.startsWith(
      'schroeder-spatial-phase-volume-interface-'
    ));
  assert.deepEqual(proposalProducerIds, [
    'schroeder-spatial-phase-volume-interface-local-topology',
    'schroeder-spatial-phase-volume-interface-reflux-topology',
    'schroeder-spatial-phase-volume-interface-finalize'
  ]);
  assert.equal(timestampEnds.filter(({ token }) => (
    token.descriptor.producerId.startsWith(
      'schroeder-spatial-phase-volume-interface-'
    )
  )).length, 3);

  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
  assert.equal(proposal.released, true);
  assert.equal(generation.mechanicsLevelViews[0].phaseVolumeReceipt.released, true);
  assert.equal(generation.mechanicsLevelViews[1].phaseVolumeReceipt.released, true);
  assert.equal(generation.parentFieldView.released, true);
  assert.equal(generation.releaseOperationResults[0].owner, 'phase-volume-interface-proposal');
  assert.equal(generation.releaseOperationResults[0].confirmed, true);
  assert.equal(sourceMechanicsBuffer.destroyCount, 0);
});

test('opt-in S9-C topology fails closed outside its exact two-level S9-B route', () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    },
    phaseVolumeInterfaceProposalEnabled: true
  });
  assert.equal(generation.ready, false);
  assert.equal(
    generation.status,
    'schroeder-spatial-phase-volume-interface-proposal-rejected-level-contract'
  );
  assert.equal(
    generation.errorCode,
    'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_PROPOSAL_IDENTITY'
  );
});

test('direct arena-depth selection keys the runtime and configures every owned view coherently', async () => {
  const device = createFakeDevice();
  const baseline = createFullTwoLevelSpatialGeneration(device);
  const wide = createFullTwoLevelSpatialGeneration(device, {
    directArenaCount: 8
  });
  assert.equal(baseline.generation.ready, true, baseline.generation.reason);
  assert.equal(wide.generation.ready, true, wide.generation.reason);
  assert.equal(baseline.generation.directArenaCount, 3);
  assert.equal(baseline.generation.arenaCapacity, 3);
  assert.equal(wide.generation.directArenaCount, 8);
  assert.equal(wide.generation.arenaCapacity, 8);
  assert.notEqual(wide.generation.runtime, baseline.generation.runtime);
  assert.notEqual(
    wide.generation.directRuntimeEntry.runtimeCacheKey,
    baseline.generation.directRuntimeEntry.runtimeCacheKey
  );
  assert.equal(baseline.generation.activeSourceViewRuntime.arenaCount, 3);
  assert.equal(wide.generation.activeSourceViewRuntime.arenaCount, 8);
  assert.equal(
    wide.generation.directRuntimeEntry.mechanicsFieldViewDrainingRuntimeLimit,
    16
  );
  for (const levelView of wide.generation.mechanicsLevelViews) {
    assert.equal(levelView.mechanicsViewRuntime.arenaCount, 8);
    assert.equal(levelView.mechanicsFieldViewRuntime.arenaCount, 8);
  }
  assert.equal(wide.generation.hierarchyViewRuntime.arenaCount, 8);
  assert.equal(wide.generation.parentFieldViewRuntime.arenaCount, 8);
  assert.equal(wide.generation.aggregateViewRuntime.arenaCount, 8);

  for (const generation of [baseline.generation, wide.generation]) {
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
  }
  assert.deepEqual(
    await Promise.all([
      baseline.generation.releasePromise,
      wide.generation.releasePromise
    ]),
    [true, true]
  );
});

test('generation retirement permanently retires an already-quarantined mechanics field', async () => {
  const device = createFakeDevice();
  const { generation } = createFullTwoLevelSpatialGeneration(device);
  assert.equal(generation.ready, true, generation.reason);
  const field = generation.mechanicsLevelViews[1].mechanicsFieldView;
  const runtime = generation.mechanicsLevelViews[1].mechanicsFieldViewRuntime;
  const state = runtime.stateMutationState(field);
  runtime.quarantineCurrentStateArtifact(field, {
    mutationOrdinal: state.ordinal,
    stateEncoding: state.encoding,
    reason: new Error('injected post-submit field publication failure')
  });
  assert.equal(runtime.stateMutationState(field).quarantined, true);

  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    true
  );
  assert.equal(await generation.releasePromise, true);
  assert.equal(field.released, true);
  assert.equal(runtime.retiredArenaCount(), 1);
  assert.equal(generation.releaseStatus,
    'spatial-epoch-generation-released-after-final-consumer');
  assert.equal(
    generation.releaseOperationResults.find(
      ({ owner }) => owner === 'mechanics-field-view-level-1'
    )?.confirmed,
    true
  );
});

test('generation retirement joins a prestarted quarantined-field retirement', async () => {
  const device = createFakeDevice();
  const { generation } = createFullTwoLevelSpatialGeneration(device);
  assert.equal(generation.ready, true, generation.reason);
  const queueFence = deferred();
  device.queue.onSubmittedWorkDone = () => queueFence.promise;
  const field = generation.mechanicsLevelViews[1].mechanicsFieldView;
  const runtime = generation.mechanicsLevelViews[1].mechanicsFieldViewRuntime;
  const state = runtime.stateMutationState(field);
  runtime.quarantineCurrentStateArtifact(field, {
    mutationOrdinal: state.ordinal,
    stateEncoding: state.encoding,
    reason: new Error('prestarted quarantine retirement')
  });
  const fieldRetirement = runtime.retireQuarantinedExecutionAfter(field);

  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    true
  );
  queueFence.resolve();
  assert.equal(await fieldRetirement, true);
  assert.equal(await generation.releasePromise, true);
  assert.equal(field.released, true);
  assert.equal(runtime.retiredArenaCount(), 1);
});

test('depleted mechanics-field cache rolls an exact active owner and destroys it only after retirement', async () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const particleIdentityBuffer = device.createBuffer({
    label: 'active-rollover-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const options = {
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    },
    selectedLevel: 0
  };
  const permanentlyRetireThenRelease = async (generation, ordinal) => {
    const runtime = generation.mechanicsFieldViewRuntime;
    const field = generation.mechanicsFieldView;
    const state = runtime.stateMutationState(field);
    runtime.quarantineCurrentStateArtifact(field, {
      mutationOrdinal: state.ordinal,
      stateEncoding: state.encoding,
      reason: new Error(`intentional active-rollover depletion ${ordinal}`)
    });
    assert.equal(await runtime.retireQuarantinedExecutionAfter(field), true);
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
    assert.equal(await generation.releasePromise, true);
  };

  const first = runSchroederSpatialEpochGenerationWebGpu(options);
  assert.equal(first.ready, true, first.reason);
  const depletedRuntime = first.mechanicsFieldViewRuntime;
  let destroyCount = 0;
  const originalDestroy = depletedRuntime.destroy;
  depletedRuntime.destroy = (...args) => {
    destroyCount += 1;
    return originalDestroy(...args);
  };
  await permanentlyRetireThenRelease(first, 1);
  const second = runSchroederSpatialEpochGenerationWebGpu(options);
  assert.equal(second.mechanicsFieldViewRuntime, depletedRuntime);
  await permanentlyRetireThenRelease(second, 2);

  const retained = runSchroederSpatialEpochGenerationWebGpu(options);
  assert.equal(retained.ready, true, retained.reason);
  assert.equal(retained.mechanicsFieldViewRuntime, depletedRuntime);
  assert.equal(depletedRuntime.retiredArenaCount(), 2);
  assert.equal(depletedRuntime.activeExecutionCount(), 1);
  assert.equal(depletedRuntime.availableArenaCount(), 0);

  const entry = retained.directRuntimeEntry;
  const compactRuntime = retained.mechanicsViewRuntime;
  const seededDrains = Array.from({ length: 6 }, (_, index) => ({
    key: `inert-drain-${index}`,
    retirementConfirmed: false,
    destroyed: false
  }));
  for (const record of seededDrains) {
    entry.mechanicsFieldViewDrainingRuntimes.add(record);
  }
  const submissionCountBeforeBoundedAttempt = device.submissions.length;
  const bounded = runSchroederSpatialEpochGenerationWebGpu(options);
  assert.equal(bounded.ready, false);
  assert.equal(
    bounded.errorCode,
    'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_CACHE_BACKPRESSURE'
  );
  assert.equal(entry.mechanicsFieldViewRuntimes.size, 1);
  assert.equal(
    [...entry.mechanicsFieldViewRuntimes.values()][0],
    depletedRuntime
  );
  assert.equal(depletedRuntime.activeExecutionCount(), 1);
  assert.equal(compactRuntime.activeExecutionCount(), 1);
  assert.equal(entry.runtime.ownsExecution(retained.execution), true);
  assert.equal(entry.liveGenerations.length, 1);
  assert.equal(device.submissions.length, submissionCountBeforeBoundedAttempt);
  for (const record of seededDrains) {
    entry.mechanicsFieldViewDrainingRuntimes.delete(record);
  }

  const replacementGeneration = runSchroederSpatialEpochGenerationWebGpu(options);
  assert.equal(replacementGeneration.ready, true, replacementGeneration.reason);
  assert.notEqual(
    replacementGeneration.mechanicsFieldViewRuntime,
    depletedRuntime
  );
  assert.equal(destroyCount, 0);
  assert.equal(entry.mechanicsFieldViewRuntimes.size, 1);
  assert.equal(
    entry.mechanicsFieldViewDrainingRuntimes.size,
    1
  );
  const [drainingRecord] =
    entry.mechanicsFieldViewDrainingRuntimes;
  assert.equal(drainingRecord.runtime, depletedRuntime);
  assert.deepEqual(drainingRecord.executions, [retained.mechanicsFieldView]);

  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(retained, device),
    true
  );
  assert.equal(await retained.releasePromise, true);
  assert.equal(await drainingRecord.completionPromise, true);
  assert.equal(depletedRuntime.activeExecutionCount(), 0);
  assert.equal(destroyCount, 1);
  assert.equal(
    entry.mechanicsFieldViewDrainingRuntimes.size,
    0
  );

  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(
      replacementGeneration,
      device
    ),
    true
  );
  assert.equal(await replacementGeneration.releasePromise, true);
});

test('fully depleted idle mechanics-field cache replaces and destroys immediately', async () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const particleIdentityBuffer = device.createBuffer({
    label: 'idle-rollover-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const options = {
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    },
    selectedLevel: 0
  };
  let depletedRuntime = null;
  let destroyCount = 0;
  for (let index = 0; index < 3; index += 1) {
    const generation = runSchroederSpatialEpochGenerationWebGpu(options);
    assert.equal(generation.ready, true, generation.reason);
    depletedRuntime ??= generation.mechanicsFieldViewRuntime;
    assert.equal(generation.mechanicsFieldViewRuntime, depletedRuntime);
    if (index === 0) {
      const originalDestroy = depletedRuntime.destroy;
      depletedRuntime.destroy = (...args) => {
        destroyCount += 1;
        return originalDestroy(...args);
      };
    }
    const state = depletedRuntime.stateMutationState(
      generation.mechanicsFieldView
    );
    depletedRuntime.quarantineCurrentStateArtifact(
      generation.mechanicsFieldView,
      {
        mutationOrdinal: state.ordinal,
        stateEncoding: state.encoding,
        reason: new Error(`intentional idle-rollover depletion ${index + 1}`)
      }
    );
    assert.equal(await depletedRuntime.retireQuarantinedExecutionAfter(
      generation.mechanicsFieldView
    ), true);
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
    assert.equal(await generation.releasePromise, true);
  }
  assert.equal(depletedRuntime.activeExecutionCount(), 0);
  assert.equal(depletedRuntime.availableArenaCount(), 0);
  assert.equal(depletedRuntime.retiredArenaCount(), 3);

  const replacementGeneration = runSchroederSpatialEpochGenerationWebGpu(options);
  assert.equal(replacementGeneration.ready, true, replacementGeneration.reason);
  assert.notEqual(
    replacementGeneration.mechanicsFieldViewRuntime,
    depletedRuntime
  );
  assert.equal(destroyCount, 1);
  assert.equal(
    replacementGeneration.directRuntimeEntry
      .mechanicsFieldViewDrainingRuntimes.size,
    0
  );
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(
      replacementGeneration,
      device
    ),
    true
  );
  assert.equal(await replacementGeneration.releasePromise, true);
});

test('field-arena backpressure discards the current compact mechanics acquisition', async () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const particleIdentityBuffer = device.createBuffer({
    label: 'field-backpressure-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const mechanicsGrid = {
    gridNodeCount: 512,
    gridDims: [8, 8, 8],
    gridShift: 2,
    gridSpacingM: 0.25
  };
  const retained = [];
  for (let index = 0; index < 3; index += 1) {
    const generation = runSchroederSpatialEpochGenerationWebGpu({
      device,
      levelAssignment,
      particleCount: levelAssignment.particleCount,
      particleIdentityBuffer,
      particleIdentityStrideWords: 1,
      mechanicsGrid,
      selectedLevel: 0
    });
    assert.equal(generation.ready, true, generation.reason);
    retained.push(generation);
    assert.equal(await generation.runtime.releaseExecutionAfter(
      generation.execution,
      Promise.resolve()
    ), true);
    assert.equal(await generation.activeSourceViewRuntime.releaseExecutionAfter(
      generation.activeSourceView,
      Promise.resolve()
    ), true);
    assert.equal(await generation.mechanicsViewRuntime.releaseExecutionAfter(
      generation.mechanicsView,
      Promise.resolve()
    ), true);
    assert.equal(await generation.exactNearCellTreeRuntime.releaseExecutionAfter(
      generation.exactNearCellTree,
      Promise.resolve()
    ), true);
  }

  const compactRuntime = retained[0].mechanicsViewRuntime;
  const activeSourceRuntime = retained[0].activeSourceViewRuntime;
  const fieldRuntime = retained[0].mechanicsFieldViewRuntime;
  assert.equal(activeSourceRuntime.activeExecutionCount(), 0);
  assert.equal(compactRuntime.activeExecutionCount(), 0);
  assert.equal(fieldRuntime.activeExecutionCount(), 3);

  const timestampBegins = [];
  const timestampEnds = [];
  const timestampDiscards = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(encoder, descriptor) {
      const token = { encoder, descriptor };
      timestampBegins.push(token);
      return token;
    },
    endEncoderSpan(encoder, token) {
      timestampEnds.push({ encoder, token });
      return true;
    },
    discardEncoderSpans(encoder) {
      timestampDiscards.push(encoder);
      return timestampBegins.filter((token) => token.encoder === encoder).length;
    }
  };

  const rejected = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    mechanicsGrid,
    selectedLevel: 0,
    gpuTimestampRecorder
  });
  assert.equal(rejected.ready, false);
  assert.equal(
    rejected.status,
    'schroeder-spatial-epoch-generation-backpressure'
  );
  assert.equal(
    rejected.errorCode,
    'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_ARENA_EXHAUSTED'
  );
  assert.equal(compactRuntime.activeExecutionCount(), 0);
  assert.equal(fieldRuntime.activeExecutionCount(), 3);
  assert.equal(timestampBegins.length, 10);
  assert.equal(timestampEnds.length, 7);
  assert.equal(timestampDiscards.length, 1);
  const discardedEncoder = timestampDiscards[0];
  assert.ok(timestampBegins.every((token) => token.encoder === discardedEncoder));
  assert.ok(timestampEnds.every(({ encoder, token }) => (
    encoder === discardedEncoder && token.encoder === discardedEncoder
  )));
  assert.deepEqual(
    timestampBegins.map((token) => token.descriptor.producerId),
    [
      'schroeder-spatial-generation-command-encoder',
      'schroeder-spatial-active-source-view-build',
      'schroeder-spatial-directory-prepare',
      'schroeder-spatial-key-emission',
      'schroeder-spatial-directory-gpu-count-radix-sort-unique',
      'schroeder-spatial-directory-assemble-finalize',
      'schroeder-spatial-exact-near-cell-tree-build',
      'schroeder-spatial-derived-view-build',
      'schroeder-spatial-mechanics-view-build',
      'schroeder-spatial-mechanics-field-view-build'
    ]
  );
  assert.equal(device.submissions.length, 3);

  for (const generation of retained) {
    assert.equal(await generation.mechanicsFieldViewRuntime.releaseExecutionAfter(
      generation.mechanicsFieldView,
      Promise.resolve()
    ), true);
  }
  assert.equal(fieldRuntime.activeExecutionCount(), 0);
});

test('exact device loss retires all ten generation artifacts without fencing or borrowed-buffer destruction', async () => {
  const device = createFakeDevice();
  const deviceLoss = deferred();
  device.lost = deviceLoss.promise;
  const {
    generation,
    levelAssignment,
    particleIdentityBuffer,
    particleThermoBuffer
  } = createFullTwoLevelSpatialGeneration(device);
  assert.equal(generation.ready, true, generation.reason);
  let queueFenceCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    queueFenceCount += 1;
    throw new Error('generation device-loss retirement must not fence the queue');
  };
  const directoryArenaBuffers = generation.runtime.allocationEntries()
    .filter((entry) => entry.arenaIndex === generation.execution.arenaIndex)
    .map((entry) => entry.buffer);
  const borrowedBuffers = [
    levelAssignment.assignmentBuffer,
    levelAssignment.sourceStateBuffer,
    particleIdentityBuffer,
    particleThermoBuffer
  ];
  const capability = schroederSpatialEpochGenerationRetirementCapability(
    generation,
    device
  );
  assert.equal(
    schroederSpatialEpochGenerationRetirementCapability(generation, device),
    capability
  );
  const lossRetirement =
    quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
      generation,
      device
    );
  assert.equal(
    quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
      generation,
      device
    ),
    lossRetirement
  );
  assert.equal(queueFenceCount, 0);
  assert.equal(directoryArenaBuffers.every((buffer) => !buffer.destroyed), true);
  assert.equal(borrowedBuffers.every((buffer) => !buffer.destroyed), true);

  deviceLoss.resolve({ reason: 'destroyed', message: 'injected generation loss' });
  assert.equal(await lossRetirement, true);
  assert.equal(await capability.completionPromise, true);
  assert.equal(queueFenceCount, 0);
  const artifactExecutions = [
    generation.activeSourceView,
    generation.execution,
    ...generation.mechanicsLevelViews.flatMap((levelView) => [
      levelView.mechanicsView,
      levelView.mechanicsFieldView
    ]),
    generation.parentFieldView,
    generation.aggregateView,
    generation.exactNearCellTree,
    generation.hierarchyView
  ];
  assert.equal(artifactExecutions.length, 10);
  assert.equal(artifactExecutions.every((execution) => execution.released), true);
  assert.deepEqual(
    generation.releaseOperationResults.map((result) => result.owner),
    [
      'spatial-active-source-view',
      'spatial-directory',
      'compact-mechanics-view-level-0',
      'mechanics-field-view-level-0',
      'compact-mechanics-view-level-1',
      'mechanics-field-view-level-1',
      'spatial-parent-field-view',
      'spatial-aggregate-view',
      'spatial-exact-near-cell-tree',
      'spatial-hierarchy-view'
    ]
  );
  assert.equal(generation.releaseOperationResults.every(
    (result) => result.confirmed
  ), true);
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-device-loss-retired'
  );
  assert.equal(directoryArenaBuffers.every((buffer) => buffer.destroyed), true);
  assert.equal(directoryArenaBuffers.every(
    (buffer) => buffer.destroyCount === 1
  ), true);
  assert.equal(borrowedBuffers.every((buffer) => !buffer.destroyed), true);
  assert.equal(
    quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
      generation,
      device
    ),
    capability.completionPromise
  );
  assert.throws(
    () => generation.mechanicsViewRuntime.encode(createFakeEncoder(), {}),
    (error) => error.code === 'ERR_SCHROEDER_SPATIAL_DEVICE_LOST'
  );
  assert.throws(
    () => createFullTwoLevelSpatialGeneration(device),
    (error) => error.code === 'ERR_SCHROEDER_SPATIAL_DEVICE_LOST'
  );
  assert.equal(generation.runtime.destroy(), true);
  assert.equal(directoryArenaBuffers.every(
    (buffer) => buffer.destroyCount === 1
  ), true);
});

test('generation loss supersedes unresolved owner and prestarted mechanics-field fences', async () => {
  const device = createFakeDevice();
  const deviceLoss = deferred();
  device.lost = deviceLoss.promise;
  const { generation, levelAssignment, particleIdentityBuffer, particleThermoBuffer } =
    createFullTwoLevelSpatialGeneration(device);
  const queueFence = deferred();
  let queueFenceCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    queueFenceCount += 1;
    return queueFence.promise;
  };
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    true
  );
  const normalAttempt = generation.releasePromise;
  const lossCompletion =
    quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
      generation,
      device
    );
  assert.equal(
    quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
      generation,
      device
    ),
    lossCompletion
  );
  assert.equal(
    queueFenceCount,
    1 + generation.mechanicsLevelViews.length,
    'one owner fence and one contemporaneous private fence per mechanics field'
  );
  deviceLoss.resolve({ reason: 'destroyed', message: 'loss beat owner fence' });
  assert.equal(await lossCompletion, true);
  assert.equal(await normalAttempt, true);
  assert.equal(queueFenceCount, 1 + generation.mechanicsLevelViews.length);
  assert.equal(generation.mechanicsLevelViews.every(({ mechanicsFieldView }) => (
    mechanicsFieldView.released === true
  )), true);
  queueFence.reject(new Error('stale generation owner fence rejected'));
  await Promise.resolve();
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-device-loss-retired'
  );
  assert.equal(levelAssignment.assignmentBuffer.destroyed, false);
  assert.equal(levelAssignment.sourceStateBuffer.destroyed, false);
  assert.equal(particleIdentityBuffer.destroyed, false);
  assert.equal(particleThermoBuffer.destroyed, false);
});

test('selected-false post-submit cleanup exposes a fresh retry instead of a rejected cached promise', async () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const options = {
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    }
  };
  const seed = runSchroederSpatialEpochGenerationWebGpu(options);
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(seed, device), true);
  assert.equal(await seed.releasePromise, true);
  const originalMark = seed.runtime.markExecutionSubmitted;
  let rejectSubmissionOnce = true;
  seed.runtime.markExecutionSubmitted = (execution) => {
    if (rejectSubmissionOnce) {
      rejectSubmissionOnce = false;
      return false;
    }
    return originalMark(execution);
  };
  device.queue.onSubmittedWorkDone = () => Promise.reject(
    new Error('injected post-submit cleanup fence failure')
  );
  const rejected = runSchroederSpatialEpochGenerationWebGpu(options);
  seed.runtime.markExecutionSubmitted = originalMark;
  assert.equal(rejected.ready, false);
  assert.equal(rejected.selected, false);
  const failedAttempt = rejected.releasePromise;
  assert.equal(await failedAttempt, false);
  const capability = schroederSpatialEpochGenerationRetirementCapability(
    rejected,
    device
  );
  assert.equal(
    schroederSpatialEpochGenerationRetirementCapability(rejected, device),
    capability
  );
  device.queue.onSubmittedWorkDone = () => Promise.resolve(true);
  const retry = capability.retry();
  assert.notEqual(retry, failedAttempt);
  assert.equal(await retry, true);
  assert.equal(await capability.completionPromise, true);
  assert.equal(capability.retry(), capability.completionPromise);
});

test('direct spatial generation rejects a third, nonadjacent, or non-2:1 mechanics level', () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const grid = (gridSpacingM) => ({
    gridNodeCount: 64,
    gridDims: [4, 4, 4],
    gridShift: 1,
    gridSpacingM
  });
  for (const mechanicsLevels of [
    [
      { selectedLevel: 0, mechanicsGrid: grid(0.25) },
      { selectedLevel: 1, mechanicsGrid: grid(0.5) },
      { selectedLevel: 2, mechanicsGrid: grid(1) }
    ],
    [
      { selectedLevel: 0, mechanicsGrid: grid(0.25) },
      { selectedLevel: 2, mechanicsGrid: grid(0.5) }
    ],
    [
      { selectedLevel: 0, mechanicsGrid: grid(0.25) },
      { selectedLevel: 1, mechanicsGrid: grid(0.75) }
    ]
  ]) {
    const generation = runSchroederSpatialEpochGenerationWebGpu({
      device,
      levelAssignment,
      particleCount: levelAssignment.particleCount,
      mechanicsLevels
    });
    assert.equal(generation.ready, false);
    assert.equal(
      generation.status,
      'schroeder-spatial-mechanics-view-rejected-level-contract'
    );
    assert.equal(generation.directoryBuildCount, 0);
  }
  assert.equal(device.submissions.length, 0);
});

test('compact mechanics generations retire under resident arena backpressure', async () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const options = {
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    }
  };
  const retained = Array.from({ length: 3 }, () => (
    runSchroederSpatialEpochGenerationWebGpu(options)
  ));
  for (const generation of retained) {
    assert.equal(generation.ready, true);
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
  }
  const next = await runSchroederSpatialEpochGenerationWithBackpressureWebGpu(
    options
  );
  assert.equal(next.ready, true);
  assert.equal(next.execution.generationId, 4);
  assert.equal(next.backpressureWaitCount, 1);
  assert.deepEqual(
    await Promise.all(retained.map((generation) => generation.releasePromise)),
    [true, true, true]
  );
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(next, device),
    true
  );
  assert.equal(await next.releasePromise, true);
});

test('post-submit admission failure schedules queue-fenced directory and view cleanup', async () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const options = {
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    }
  };
  const seed = runSchroederSpatialEpochGenerationWebGpu(options);
  assert.equal(seed.ready, true);
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(seed, device), true);
  assert.equal(await seed.releasePromise, true);

  const originalMarkExecutionSubmitted = seed.runtime.markExecutionSubmitted;
  let rejectOnce = true;
  seed.runtime.markExecutionSubmitted = (execution) => {
    if (rejectOnce) {
      rejectOnce = false;
      return false;
    }
    return originalMarkExecutionSubmitted(execution);
  };
  const rejected = runSchroederSpatialEpochGenerationWebGpu(options);
  seed.runtime.markExecutionSubmitted = originalMarkExecutionSubmitted;
  assert.equal(rejected.ready, false);
  assert.equal(rejected.status, 'schroeder-spatial-epoch-generation-rejected');
  assert.equal(rejected.releaseScheduled, true);
  assert.ok(rejected.releasePromise);
  assert.equal(await rejected.releasePromise, true);
  assert.equal(rejected.releaseStatus,
    'spatial-epoch-generation-release-scheduled-after-final-consumer');
});

test('partial directory/view release can retry only the still-live owner', async () => {
  const device = createFakeDevice();
  const levelAssignment = createDirectSpatialLevelAssignment(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 2,
      gridSpacingM: 0.25
    }
  });
  assert.equal(generation.ready, true);
  const originalReleaseExecutionAfter =
    generation.mechanicsViewRuntime.releaseExecutionAfter;
  generation.mechanicsViewRuntime.releaseExecutionAfter = async () => {
    throw new Error('intentional mechanics-view release failure');
  };
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(
    generation,
    device
  ), true);
  assert.equal(await generation.releasePromise, false);
  assert.equal(generation.execution.released, true);
  assert.equal(generation.mechanicsView.released, false);
  generation.mechanicsViewRuntime.releaseExecutionAfter =
    originalReleaseExecutionAfter;
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(
    generation,
    device
  ), true);
  assert.equal(await generation.releasePromise, true);
  assert.equal(generation.mechanicsView.released, true);
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

test('exact-near plans reserve immutable live query evidence and reject ambiguous geometry', () => {
  const exactNearQueryProfile = {
    schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
    status: 'schroeder-spatial-exact-near-query-profile-ready',
    ready: true,
    sourceCount: 3,
    chartId: 7,
    minLevel: -2,
    maxLevel: 1,
    levelCount: 4,
    baseGridSpacingM: 0.125,
    levelSpacingMode: 'base-grid-spacing-times-pow2-level',
    positionAuthority: 'same-epoch-pre-integration-particle-state'
  };
  const plan = createSchroederSpatialEpochBuildPlan({
    sourceCount: 3,
    sourceCapacity: 8,
    sortMode: 'lexicographic-u32x5',
    exactNearQueryProfile
  });
  assert.equal(plan.sourceAdapterId, SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY);
  assert.equal(plan.queryEvidenceOffsetWords, plan.layout.particleToCellOffsetWords + 3);
  assert.equal(plan.queryEvidenceWordCount, SCHROEDER_SPATIAL_QUERY_EVIDENCE_WORDS);
  assert.deepEqual([
    plan.queryGeometryEvidence.chartId,
    plan.queryGeometryEvidence.minLevel,
    plan.queryGeometryEvidence.maxLevel,
    plan.queryGeometryEvidence.baseGridSpacingM
  ], [7, -2, 1, 0.125]);
  assert.equal(Object.isFrozen(plan.queryGeometryEvidence), true);
  assert.equal(plan.exactNearQueryProfile, plan.queryGeometryEvidence);

  assert.throws(
    () => createSchroederSpatialEpochBuildPlan({
      sourceCount: 3,
      sourceCapacity: 8,
      exactNearQueryProfile: { ...exactNearQueryProfile, sourceCount: 2 }
    }),
    /sourceCount/
  );
  assert.throws(
    () => createSchroederSpatialEpochBuildPlan({
      sourceCount: 3,
      sourceCapacity: 8,
      exactNearQueryProfile: {
        ...exactNearQueryProfile,
        minLevel: -40,
        maxLevel: -40,
        levelCount: 1,
        baseGridSpacingM: 0.125
      }
    }),
    /active-row clamp/
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
  assert.match(schroederSpatialEpochKeyWgsl, /\(u32\(round\(status_f\)\) & 31u\) > 0u/);
  assert.match(schroederSpatialEpochKeyWgsl, /\(u32\(round\(status_f\)\) & 128u\) == 0u/);
  assert.match(schroederSpatialEpochKeyWgsl, /source_index <= 16777215u/);
  assert.match(schroederSpatialEpochKeyWgsl, /value == trunc\(value\)/);
  assert.match(schroederSpatialEpochKeyWgsl, /source_particle_f == f32\(source_index\)/);
  assert.doesNotMatch(schroederSpatialEpochKeyWgsl, /0\.0001/);
  assert.match(schroederSpatialEpochKeyWgsl, /floor\(position \/ native_spacing\)/);
  assert.doesNotMatch(schroederSpatialEpochKeyWgsl, /max\(native_spacing, 0\.000001\)/);
  assert.match(schroederSpatialEpochKeyWgsl, /row_chart == params\.query_chart_id/);
  assert.match(
    schroederSpatialEpochKeyWgsl,
    /bitcast<u32>\(native_spacing\) == bitcast<u32>\(expected_spacing\)/
  );
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
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /directory\[query_evidence_offset_words \+ 3u\]/
  );
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /directory\[query_evidence_offset_words \+ 4u\] = occupied_level_mask_low/
  );
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /atomicOr\(&epoch_evidence\[5\]/
  );
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /SOURCE_ADAPTER_EXACT_NEAR_QUERY/
  );
  assert.match(
    schroederSpatialEpochKeyWgsl,
    /source_index >= effective_source_count\(\)[\s\S]*write_invalid_keys\(source_index\)/
  );
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /fn admitted_unique_count[\s\S]*sorted_group_indices\[params\.source_count\]/
  );
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /primitive_input_count == params\.physical_radix_count/
  );
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /directory\[params\.cell_offsets_offset_words \+ logical_unique_count\][\s\S]*live_source_count/
  );
  assert.match(
    schroederSpatialEpochAssembleWgsl,
    /directory\[37\] = live_source_count;[\s\S]*directory\[38\] = admitted_cell_count;/
  );
});

test('direct spatial generation copies an exact GPU logical count while retaining a capacity-sized radix plan', async () => {
  const device = createFakeDevice();
  const sourceCapacity = 6;
  const runtimeCapacity = 8;
  const activeNodeBuffer = device.createBuffer({
    label: 'gpu-count-spatial-active-node-source',
    size: sourceCapacity * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const logicalCountBuffer = device.createBuffer({
    label: 'gpu-count-spatial-control',
    size: 128,
    usage: 4 | 8 | 128
  });
  const logicalSourceCountAuthority = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_GPU_LOGICAL_COUNT_SOURCE_SCHEMA,
    status: 'schroeder-spatial-gpu-logical-count-source-ready',
    ready: true,
    buffer: logicalCountBuffer,
    byteOffset: 32,
    sourceCapacity,
    storageGeneration: 11
  });
  const activeNodeList = createDirectSpatialActiveNodeList(device, {
    activeCandidateCount: sourceCapacity,
    activeNodeBuffer,
    logicalSourceCountAuthority
  });

  const resolved = resolveSchroederSpatialDirectoryActiveNodeSource(
    activeNodeList,
    { device, particleCount: sourceCapacity }
  );
  assert.equal(resolved.ready, true, resolved.reason);
  assert.equal(resolved.logicalSourceCountAuthority, logicalSourceCountAuthority);
  assert.equal(resolved.logicalSourceCountGpuAuthored, true);
  assert.equal(resolved.exactNearQueryProfile.ready, false);

  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: sourceCapacity
  });
  assert.equal(generation.ready, true, generation.reason);
  assert.equal(generation.activeSourceView, null);
  assert.equal(generation.activeSourceViewRuntime, null);
  assert.equal(generation.execution.sourceCount, sourceCapacity);
  assert.equal(generation.execution.physicalSourceCount, sourceCapacity);
  assert.equal(generation.execution.physicalRadixCount, sourceCapacity);
  assert.equal(generation.execution.runtimeSourceCapacity, runtimeCapacity);
  assert.equal(generation.execution.physicalSourceCapacity, sourceCapacity);
  assert.equal(generation.execution.logicalSourceCountGpuAuthored, true);
  assert.equal(
    generation.execution.logicalSourceCountAuthority,
    logicalSourceCountAuthority
  );
  const commandBuffer = device.submissions[0][0];
  const countCopy = commandBuffer.events.find((event) => (
    event.kind === 'copy'
      && event.source === logicalCountBuffer
      && event.sourceOffset === 32
      && event.destinationOffset === 0
      && event.size === Uint32Array.BYTES_PER_ELEMENT
  ));
  assert.ok(countCopy, 'logical count must be copied into the retained SS params');
  const paramsWrite = device.writes.find(
    ({ buffer, byteLength }) => /-arena-0-params$/.test(buffer.label)
      && byteLength === 192
  );
  assert.ok(paramsWrite);
  assert.equal(new DataView(paramsWrite.snapshot).getUint32(184, true), 1);
  assert.equal(
    new DataView(paramsWrite.snapshot).getUint32(188, true),
    sourceCapacity
  );

  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(
    generation,
    device
  ), true);
  assert.equal(await generation.releasePromise, true);
});

test('direct spatial generation retains one directory through the final queue fence', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const { activeNodeBuffer } = activeNodeList;

  const source = resolveSchroederSpatialDirectoryActiveNodeSource(activeNodeList, {
    device,
    particleCount: 2
  });
  assert.equal(source.ready, true);
  assert.equal(source.storageGeneration, 11);
  assert.equal(source.exactNearQueryProfile.ready, true);
  assert.equal(
    source.exactNearQueryProfile.status,
    'schroeder-spatial-exact-near-query-profile-ready'
  );
  assert.equal(source.exactNearQueryProfile.activeNodeBuffer, activeNodeBuffer);
  assert.deepEqual(
    [
      source.exactNearQueryProfile.minLevel,
      source.exactNearQueryProfile.maxLevel,
      source.exactNearQueryProfile.levelCount,
      source.exactNearQueryProfile.baseGridSpacingM,
      source.exactNearQueryProfile.positionEpoch,
      source.exactNearQueryProfile.supportEpoch
    ],
    [-1, 1, 3, 0.25, 17, 31]
  );

  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  assert.equal(generation.ready, true);
  assert.equal(generation.selected, true);
  assert.equal(generation.directoryBuildCount, 1);
  assert.equal(generation.privateLookupBuildCount, 0);
  assert.equal(generation.execution.submitPerformed, true);
  assert.equal(generation.execution.activeNodeBuffer, activeNodeBuffer);
  assert.equal(
    generation.execution.sourceAdapterId,
    SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
  );
  assert.equal(generation.execution.exactNearQueryProfile.ready, true);
  assert.equal(generation.execution.exactNearQueryProfile.chartId, 0);
  assert.equal(generation.execution.exactNearQueryProfile.minLevel, -1);
  assert.equal(generation.execution.exactNearQueryProfile.maxLevel, 1);
  assert.equal(generation.execution.exactNearQueryProfile.baseGridSpacingM, 0.25);
  assert.equal(Object.isFrozen(generation.execution.queryGeometryEvidence), true);
  assert.equal(
    Object.getOwnPropertyDescriptor(generation.execution, 'sourceAdapterId')?.writable,
    false
  );
  assert.equal(
    Object.getOwnPropertyDescriptor(generation.execution, 'exactNearQueryProfile')?.writable,
    false
  );
  const spatialParamsWrite = device.writes.find(
    ({ buffer, byteLength }) => /-arena-0-params$/.test(buffer.label) && byteLength === 192
  );
  assert.ok(spatialParamsWrite);
  const spatialParamsView = new DataView(spatialParamsWrite.snapshot);
  assert.deepEqual([
    spatialParamsView.getUint32(160, true),
    spatialParamsView.getUint32(164, true),
    spatialParamsView.getInt32(168, true),
    spatialParamsView.getInt32(172, true),
    spatialParamsView.getFloat32(176, true)
  ], [1, 0, -1, 1, 0.25]);
  assert.equal(generation.execution.ownerRuntime, generation.runtime);
  assert.equal(generation.runtime.ownsExecution(generation.execution), true);
  assert.equal(generation.runtime.isExecutionSubmitted(generation.execution), true);
  assert.throws(
    () => { generation.execution.submitPerformed = false; },
    TypeError
  );
  assert.equal(generation.execution.submitPerformed, true);
  assert.throws(
    () => generation.runtime.releaseExecution(
      generation.execution,
      { discardedEncoder: true }
    ),
    (error) => error?.code
      === 'ERR_SCHROEDER_SPATIAL_SUBMITTED_EXECUTION_REQUIRES_FENCE'
  );
  assert.equal(generation.runtime.ownsExecution(generation.execution), true);
  assert.equal(generation.releaseScheduled, false);
  assert.equal(device.submissions.length, 1);
  const foreignDevice = createFakeDevice();
  let foreignFenceCount = 0;
  foreignDevice.queue.onSubmittedWorkDone = () => {
    foreignFenceCount += 1;
    throw new Error('foreign queue must not fence an owner generation');
  };
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, foreignDevice),
    false
  );
  assert.equal(foreignFenceCount, 0);
  assert.equal(generation.releaseScheduled, false);
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-retained-device-mismatch'
  );
  const ownerRuntime = generation.runtime;
  const ownerFence = device.queue.onSubmittedWorkDone;
  let ownerFenceCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    ownerFenceCount += 1;
    return ownerFence();
  };
  generation.runtime = { ...ownerRuntime };
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    false
  );
  assert.equal(ownerFenceCount, 0);
  assert.equal(generation.releaseScheduled, false);
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-retained-owner-mismatch'
  );
  generation.runtime = ownerRuntime;
  device.queue.onSubmittedWorkDone = () => {
    ownerFenceCount += 1;
    throw new Error('transient owner fence failure');
  };
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    false
  );
  assert.equal(generation.releaseScheduled, false);
  assert.equal(generation.releasePromise, null);
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-retained-fence-error'
  );
  assert.match(generation.releaseReason, /transient owner fence failure/);
  device.queue.onSubmittedWorkDone = () => {
    ownerFenceCount += 1;
    return ownerFence();
  };
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(ownerFenceCount, 2);
  assert.equal(await generation.releasePromise, true);
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-released-after-final-consumer'
  );
  assert.equal(generation.releaseReason, null);

  const overlay = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList: {
      ...activeNodeList,
      phaseVolumeAssignmentOverlayEnabled: true
    },
    particleCount: 2
  });
  assert.equal(overlay.ready, false);
  assert.equal(
    overlay.status,
    'schroeder-spatial-directory-source-rejected-overlay-for-mechanics'
  );
  assert.equal(overlay.directoryBuildCount, 0);
  assert.equal(device.submissions.length, 1);
});

test('direct spatial generation backpressure preserves one fresh generation per tick', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const pendingFenceResolvers = [];
  device.queue.onSubmittedWorkDone = () => new Promise((resolve) => {
    pendingFenceResolvers.push(resolve);
  });
  const generations = [];

  for (let index = 0; index < 8; index += 1) {
    const pendingGeneration =
      runSchroederSpatialEpochGenerationWithBackpressureWebGpu({
        device,
        activeNodeList,
        particleCount: 2
      });
    if (index >= 3) {
      assert.equal(pendingFenceResolvers.length, 3);
      pendingFenceResolvers.shift()();
    }
    const generation = await pendingGeneration;
    generations.push(generation);
    assert.equal(generation.selected, true);
    assert.equal(generation.arenaCapacity, 3);
    assert.equal(generation.directoryBuildCount, 1);
    assert.equal(generation.privateLookupBuildCount, 0);
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
  }

  assert.deepEqual(
    generations.map((generation) => generation.execution.generationId),
    [1, 2, 3, 4, 5, 6, 7, 8]
  );
  assert.deepEqual(
    generations.map((generation) => generation.backpressureWaitCount),
    [0, 0, 0, 1, 1, 1, 1, 1]
  );
  assert.equal(device.submissions.length, 8);
  for (const resolveFence of pendingFenceResolvers.splice(0)) resolveFence();
  assert.deepEqual(
    await Promise.all(generations.map((generation) => generation.releasePromise)),
    Array(8).fill(true)
  );
});

test('direct spatial generation backpressure fails closed without an owner release', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const generations = Array.from({ length: 3 }, () => (
    runSchroederSpatialEpochGenerationWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    })
  ));
  await assert.rejects(
    runSchroederSpatialEpochGenerationWithBackpressureWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    }),
    (error) => error?.code
      === 'ERR_SCHROEDER_SPATIAL_ARENA_BACKPRESSURE_UNRELEASABLE'
  );
  assert.equal(device.submissions.length, 3);
  for (const generation of generations) {
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
  }
  await Promise.all(generations.map((generation) => generation.releasePromise));
});

test('failed generation-owner fence preserves the live arena and permits a confirmed retry', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  device.queue.onSubmittedWorkDone = () => Promise.reject(
    new Error('intentional owner fence rejection')
  );

  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    true
  );
  const failedAttempt = generation.releasePromise;
  assert.equal(await failedAttempt, false);
  assert.equal(generation.releaseScheduled, false);
  assert.equal(generation.releasePromise, null);
  assert.equal(generation.runtime.ownsExecution(generation.execution), true);
  assert.equal(
    generation.releaseStatus,
    'spatial-epoch-generation-release-unconfirmed'
  );
  assert.match(generation.releaseReason, /intentional owner fence rejection/);
  assert.equal(generation.releaseAttemptCount, 1);
  assert.equal(generation.releaseFailureCount, 1);

  device.queue.onSubmittedWorkDone = () => Promise.resolve(true);
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    true
  );
  assert.equal(await generation.releasePromise, true);
  assert.equal(generation.releaseScheduled, true);
  assert.equal(generation.runtime.ownsExecution(generation.execution), false);
  assert.equal(generation.releaseAttemptCount, 2);
  assert.equal(generation.releaseFailureCount, 1);
});

test('arena backpressure rejects an unconfirmed owner release instead of reusing its arena', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const generations = Array.from({ length: 3 }, () => (
    runSchroederSpatialEpochGenerationWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    })
  ));
  device.queue.onSubmittedWorkDone = () => Promise.reject(
    new Error('intentional backpressure fence rejection')
  );
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generations[0], device),
    true
  );

  await assert.rejects(
    runSchroederSpatialEpochGenerationWithBackpressureWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    }),
    (error) => error?.code
      === 'ERR_SCHROEDER_SPATIAL_ARENA_BACKPRESSURE_RELEASE_FAILED'
  );
  assert.equal(generations[0].runtime.ownsExecution(generations[0].execution), true);
  assert.equal(device.submissions.length, 3);

  device.queue.onSubmittedWorkDone = () => Promise.resolve(true);
  for (const generation of generations) {
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
  }
  assert.deepEqual(
    await Promise.all(generations.map((generation) => generation.releasePromise)),
    [true, true, true]
  );
});

test('arena backpressure proceeds when any scheduled owner release is confirmed', async () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const generations = Array.from({ length: 3 }, () => (
    runSchroederSpatialEpochGenerationWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    })
  ));
  const fenceSettlers = [];
  device.queue.onSubmittedWorkDone = () => new Promise((resolve, reject) => {
    fenceSettlers.push({ resolve, reject });
  });
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generations[0], device),
    true
  );
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generations[1], device),
    true
  );

  const pendingGeneration =
    runSchroederSpatialEpochGenerationWithBackpressureWebGpu({
      device,
      activeNodeList,
      particleCount: 2
    });
  fenceSettlers[0].reject(new Error('intentional first owner fence rejection'));
  await Promise.resolve();
  fenceSettlers[1].resolve();
  const nextGeneration = await pendingGeneration;

  assert.equal(nextGeneration.selected, true);
  assert.equal(nextGeneration.execution.generationId, 4);
  assert.equal(nextGeneration.backpressureWaitCount, 1);
  assert.equal(generations[0].runtime.ownsExecution(generations[0].execution), true);
  assert.equal(generations[1].runtime.ownsExecution(generations[1].execution), false);
  assert.equal(device.submissions.length, 4);

  device.queue.onSubmittedWorkDone = () => Promise.resolve(true);
  for (const generation of [generations[0], generations[2], nextGeneration]) {
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
      true
    );
  }
  assert.deepEqual(
    await Promise.all(
      [generations[0], generations[2], nextGeneration]
        .map((generation) => generation.releasePromise)
    ),
    [true, true, true]
  );
});

test('directory generation identity accepts only exact numeric u32 fields and preserves zero', () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const missing = Symbol('missing');
  const invalidIdentityFields = [
    ['missing physics tick', 'spatialEpochPhysicsTick', missing],
    ['null physics substep', 'spatialEpochPhysicsSubstep', null],
    ['boolean position epoch', 'spatialEpochPositionEpoch', false],
    ['empty topology epoch', 'spatialEpochTopologyEpoch', ''],
    ['coercible chart epoch', 'spatialEpochChartEpoch', '23'],
    ['array level epoch', 'spatialEpochLevelEpoch', []],
    ['object support epoch', 'spatialEpochSupportEpoch', { valueOf: () => 31 }],
    ['bigint storage generation', 'spatialEpochStorageGeneration', 11n]
  ];

  for (const [label, field, value] of invalidIdentityFields) {
    const candidate = { ...activeNodeList };
    if (value === missing) delete candidate[field];
    else candidate[field] = value;
    const source = resolveSchroederSpatialDirectoryActiveNodeSource(candidate, {
      device,
      particleCount: 2
    });
    assert.equal(source.ready, false, label);
    assert.equal(
      source.status,
      'schroeder-spatial-directory-source-rejected-generation',
      label
    );
  }

  const zeroEpochSource = resolveSchroederSpatialDirectoryActiveNodeSource({
    ...activeNodeList,
    spatialEpochStorageGeneration: 1,
    spatialEpochPhysicsTick: 0,
    spatialEpochPhysicsSubstep: 0,
    spatialEpochPositionEpoch: 0,
    spatialEpochTopologyEpoch: 0,
    spatialEpochChartEpoch: 0,
    spatialEpochLevelEpoch: 0,
    spatialEpochSupportEpoch: 0,
    spatialEpochMinLevel: 0,
    spatialEpochMaxLevel: 0,
    spatialEpochChartId: 0
  }, {
    device,
    particleCount: 2
  });
  assert.equal(zeroEpochSource.ready, true);
  assert.deepEqual(
    [
      zeroEpochSource.physicsTick,
      zeroEpochSource.physicsSubstep,
      zeroEpochSource.positionEpoch,
      zeroEpochSource.topologyEpoch,
      zeroEpochSource.chartEpoch,
      zeroEpochSource.levelEpoch,
      zeroEpochSource.supportEpoch,
      zeroEpochSource.exactNearQueryProfile.chartId,
      zeroEpochSource.exactNearQueryProfile.minLevel,
      zeroEpochSource.exactNearQueryProfile.maxLevel
    ],
    Array(10).fill(0)
  );
  assert.equal(zeroEpochSource.exactNearQueryProfile.ready, true);
  assert.equal(zeroEpochSource.exactNearQueryProfile.levelCount, 1);
});

test('exact-near query profile rejects missing, coercible, and out-of-range numerics', () => {
  const device = createFakeDevice();
  const activeNodeList = createDirectSpatialActiveNodeList(device);
  const missing = Symbol('missing');
  const invalidQueryFields = [
    ['missing minimum level', 'spatialEpochMinLevel', missing, 'minLevel'],
    ['null maximum level', 'spatialEpochMaxLevel', null, 'maxLevel'],
    ['boolean minimum level', 'spatialEpochMinLevel', false, 'minLevel'],
    ['empty maximum level', 'spatialEpochMaxLevel', '', 'maxLevel'],
    ['coercible minimum level', 'spatialEpochMinLevel', '-1', 'minLevel'],
    ['coercible chart id', 'spatialEpochChartId', '0', 'chartId'],
    ['array chart id', 'spatialEpochChartId', [], 'chartId'],
    ['object maximum level', 'spatialEpochMaxLevel', { valueOf: () => 1 }, 'maxLevel'],
    ['fractional minimum level', 'spatialEpochMinLevel', -0.5, 'minLevel'],
    ['non-finite maximum level', 'spatialEpochMaxLevel', Infinity, 'maxLevel'],
    ['minimum level below i32', 'spatialEpochMinLevel', -0x8000_0001, 'minLevel'],
    ['maximum level above i32', 'spatialEpochMaxLevel', 0x8000_0000, 'maxLevel'],
    ['coercible base spacing', 'spatialEpochBaseGridSpacingM', '0.25', 'baseGridSpacingM']
  ];

  for (const [label, field, value, profileField] of invalidQueryFields) {
    const candidate = { ...activeNodeList };
    if (value === missing) delete candidate[field];
    else candidate[field] = value;
    const source = resolveSchroederSpatialDirectoryActiveNodeSource(candidate, {
      device,
      particleCount: 2
    });
    assert.equal(source.ready, true, label);
    assert.equal(source.exactNearQueryProfile.ready, false, label);
    assert.equal(
      source.exactNearQueryProfile.status,
      'schroeder-spatial-exact-near-query-profile-unavailable',
      label
    );
    assert.equal(source.exactNearQueryProfile[profileField], null, label);
  }
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
  assert.equal(first.activeNodeBuffer, activeNodeBuffer);
  assert.equal(first.sourceAdapterId, SCHROEDER_SPATIAL_SOURCE_ADAPTER_ACTIVE_NODE_ROWS);
  assert.equal(first.exactNearQueryProfile, null);
  assert.equal(first.queryGeometryEvidence.modeName, 'generic-per-row-native-spacing');
  assert.equal(runtime.ownsExecution(first), true);
  assert.equal(runtime.ownsExecution(second), true);
  assert.deepEqual(
    Object.getOwnPropertyDescriptor(first, 'activeNodeBuffer'),
    {
      value: activeNodeBuffer,
      writable: false,
      enumerable: true,
      configurable: false
    }
  );
  assert.equal(first.ownerRuntime, runtime);
  assert.equal(
    Object.getOwnPropertyDescriptor(first, 'ownerRuntime')?.enumerable,
    false
  );
  assert.equal(Object.hasOwn(first, '_arena'), false);
  assert.equal(Object.hasOwn(first, '_executionToken'), false);
  assert.equal(Object.hasOwn(first, 'radixUnique'), false);
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
  assert.equal(SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_WORDS, 16);
  assert.equal(SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_BYTES, 64);
  assert.equal(SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_OFFSET_WORDS, 4);
  assert.equal(SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_WORDS, 20);
  assert.equal(SCHROEDER_SPATIAL_EPOCH_WITH_MECHANICS_EVIDENCE_BYTES, 80);
  assert.equal(first.evidenceBuffer.size, 80);
  assert.equal(first.evidenceBufferByteLength, 80);
  assert.equal(first.mechanicsEvidenceOffsetBytes, 16);
  assert.equal(first.mechanicsEvidenceByteLength, 64);
  assert.equal(first.clearedWordCount, 83);
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

  const transplantedOwnershipFields = [
    'arenaIndex',
    'directoryBuffer',
    'consumerDispatchBuffer',
    'evidenceBuffer',
    'exactKeyBuffer',
    'sortKeyBuffer',
    'sortedIndicesBuffer'
  ];
  const firstOwnershipSnapshot = Object.fromEntries(
    transplantedOwnershipFields.map((field) => [field, first[field]])
  );
  for (const field of transplantedOwnershipFields) first[field] = second[field];
  assert.equal(runtime.ownsExecution(first), false);
  assert.equal(runtime.ownsExecution(second), true);
  assert.throws(
    () => runtime.releaseExecution(first, { discardedEncoder: true }),
    (error) => error?.code === 'ERR_SCHROEDER_SPATIAL_FOREIGN_EXECUTION'
  );
  assert.equal(runtime.ownsExecution(second), true);
  for (const field of transplantedOwnershipFields) {
    first[field] = firstOwnershipSnapshot[field];
  }
  assert.equal(runtime.ownsExecution(first), true);
  await assert.rejects(
    runtime.releaseExecutionAfter(first, Promise.resolve()),
    (error) => error?.code
      === 'ERR_SCHROEDER_SPATIAL_UNSUBMITTED_EXECUTION_REQUIRES_DISCARD'
  );
  assert.equal(runtime.markExecutionSubmitted(second), true);
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      activeNodeBuffer,
      sourceCount: 4,
      atlas,
      arenaIndex: second.arenaIndex
    }),
    (error) => error?.code === 'ERR_SCHROEDER_SPATIAL_ARENA_EXHAUSTED'
  );

  assert.throws(() => runtime.releaseExecution(first), /discarded encoder/);
  const clonedFirst = { ...first };
  assert.throws(
    () => runtime.releaseExecution(clonedFirst, { discardedEncoder: true }),
    /does not belong to this runtime/
  );
  await assert.rejects(
    runtime.releaseExecutionAfter(clonedFirst, Promise.resolve()),
    /does not belong to this runtime/
  );
  const foreignRuntime = createSchroederSpatialEpochGpu(device, {
    maxSourceCount: 8,
    cellCapacity: 8,
    arenaCount: 1,
    label: 'foreign-spatial-test'
  });
  assert.throws(
    () => foreignRuntime.releaseExecution(first, { discardedEncoder: true }),
    /does not belong to this runtime/
  );
  await assert.rejects(
    foreignRuntime.releaseExecutionAfter(first, Promise.resolve()),
    /does not belong to this runtime/
  );
  assert.equal(foreignRuntime.destroy(), true);
  assert.equal(runtime.ownsExecution(first), true);
  assert.equal(runtime.releaseExecution(first, { discardedEncoder: true }), true);
  assert.equal(runtime.ownsExecution(first), false);
  assert.equal(first.released, true);
  const bufferCountBeforeReuse = device.buffers.length;
  const third = runtime.encode(createFakeEncoder(), {
    activeNodeBuffer,
    sourceCount: 4,
    atlas,
    generationId: 3
  });
  assert.equal(third.arenaIndex, 0);
  assert.equal(runtime.ownsExecution(third), true);
  assert.equal(device.buffers.length, bufferCountBeforeReuse);
  assert.ok(third.spatialBindGroupReuseCount >= 3);
  assert.equal(runtime.releaseExecution(third, { discardedEncoder: true }), true);
  assert.equal(runtime.ownsExecution(third), false);
  assert.equal(third.released, true);
  assert.equal(runtime.releaseExecution(third, { discardedEncoder: true }), false);
  await assert.rejects(runtime.releaseExecutionAfter(second, null), /submission-fence thenable/);
  assert.equal(await runtime.releaseExecutionAfter(second, Promise.resolve()), true);
  assert.equal(runtime.ownsExecution(second), false);
  assert.equal(second.released, true);
  assert.deepEqual(runtime.allocationEntries().map(({ buffer }) => buffer), allocationBuffers);
  assert.equal(runtime.destroy(), true);
  assert.equal(allocationBuffers.every((buffer) => buffer.destroyed), true);
});

test('directory runtime loss supersedes radix retirement and never destroys its borrowed source', async () => {
  const device = createFakeDevice();
  const runtime = createSchroederSpatialEpochGpu(device, {
    maxSourceCount: 8,
    cellCapacity: 8,
    arenaCount: 2,
    label: 'spatial-loss-test'
  });
  const sourceBuffer = device.createBuffer({
    label: 'spatial-loss-borrowed-source',
    size: 8 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const execution = runtime.encode(createFakeEncoder(), {
    activeNodeBuffer: sourceBuffer,
    sourceCount: 4,
    sortMode: 'bounded-atlas-u32',
    atlas: {
      chartMin: 0,
      chartCount: 2,
      levelMin: -1,
      levelCount: 2,
      cellMin: [-1, -1, 0],
      cellCount: [2, 2, 2]
    },
    generationId: 1
  });
  runtime.markExecutionSubmitted(execution);
  const owned = runtime.allocationEntries()
    .filter((entry) => entry.arenaIndex === execution.arenaIndex)
    .map((entry) => entry.buffer);
  const queueFence = deferred();
  const deviceLoss = deferred();
  device.lost = deviceLoss.promise;
  const normalAttempt = runtime.releaseExecutionAfter(
    execution,
    queueFence.promise
  );
  const lossAttempt = runtime.quarantineExecutionAfterDeviceLoss(execution);
  assert.equal(runtime.quarantineExecutionAfterDeviceLoss(execution), lossAttempt);
  const completion = runtime.executionRetirementCompletionPromise(execution);
  assert.equal(owned.every((buffer) => !buffer.destroyed), true);
  assert.equal(sourceBuffer.destroyed, false);
  deviceLoss.resolve({ reason: 'destroyed' });
  assert.equal(await lossAttempt, true);
  assert.equal(execution.released, true);
  assert.equal(owned.every((buffer) => buffer.destroyed), true);
  assert.equal(owned.every((buffer) => buffer.destroyCount === 1), true);
  assert.equal(sourceBuffer.destroyed, false);
  queueFence.reject(new Error('stale radix fence rejected after loss'));
  assert.equal(await normalAttempt, true);
  assert.equal(runtime.quarantineExecutionAfterDeviceLoss(execution), completion);
  assert.equal(await completion, true);
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      activeNodeBuffer: sourceBuffer,
      sourceCount: 1
    }),
    (error) => error.code === 'ERR_SCHROEDER_SPATIAL_DEVICE_LOST'
  );
  assert.equal(runtime.destroy(), true);
  assert.equal(owned.every((buffer) => buffer.destroyCount === 1), true);
});

test('directory loss retirement retries one incomplete owned-buffer destruction exactly', async () => {
  const device = createFakeDevice();
  const runtime = createSchroederSpatialEpochGpu(device, {
    maxSourceCount: 4,
    cellCapacity: 4,
    arenaCount: 1,
    label: 'spatial-loss-retry-test'
  });
  const sourceBuffer = device.createBuffer({
    label: 'spatial-loss-retry-borrowed-source',
    size: 4 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const execution = runtime.encode(createFakeEncoder(), {
    activeNodeBuffer: sourceBuffer,
    sourceCount: 2,
    sortMode: 'bounded-atlas-u32',
    atlas: {
      chartMin: 0,
      chartCount: 1,
      levelMin: 0,
      levelCount: 1,
      cellMin: [0, 0, 0],
      cellCount: [2, 2, 2]
    }
  });
  runtime.markExecutionSubmitted(execution);
  const owned = runtime.allocationEntries().map((entry) => entry.buffer);
  const flaky = owned[0];
  const originalDestroy = flaky.destroy;
  let injected = true;
  flaky.destroy = function destroyWithOneFailure() {
    if (injected) {
      injected = false;
      this.destroyCount += 1;
      throw new Error('injected spatial arena destroy failure');
    }
    return originalDestroy.call(this);
  };
  device.lost = Promise.resolve({ reason: 'destroyed' });
  const completion = runtime.executionRetirementCompletionPromise(execution);
  await assert.rejects(
    runtime.quarantineExecutionAfterDeviceLoss(execution),
    /injected spatial arena destroy failure/
  );
  assert.equal(runtime.ownsExecution(execution), true);
  assert.equal(execution.released, false);
  assert.equal(owned.slice(1).every((buffer) => buffer.destroyCount === 1), true);
  assert.equal(await runtime.quarantineExecutionAfterDeviceLoss(execution), true);
  assert.equal(await completion, true);
  assert.equal(flaky.destroyCount, 2);
  assert.equal(owned.slice(1).every((buffer) => buffer.destroyCount === 1), true);
  assert.equal(sourceBuffer.destroyed, false);
  assert.equal(runtime.destroy(), true);
  assert.equal(owned.slice(1).every((buffer) => buffer.destroyCount === 1), true);
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
