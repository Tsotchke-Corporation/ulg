import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_HIERARCHY_MAX_INTERPOLATION_EDGES_PER_FINE_NODE,
  SCHROEDER_SPATIAL_HIERARCHY_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_HIERARCHY_VIEW_FINE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_HIERARCHY_VIEW_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_HIERARCHY_VIEW_HEADER_WORDS,
  ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA,
  createSchroederSpatialHierarchyViewLayout,
  createSchroederSpatialHierarchyViewPlan,
  validateSchroederSpatialHierarchyViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialHierarchyView.js';
import {
  schroederSpatialHierarchyViewWgsl
} from '../ulg-gpu-abi/src/schroederSpatialHierarchyViewWgsl.js';
import {
  createSchroederSpatialHierarchyViewGpu
} from '../src/runtime/sph/schroederSpatialHierarchyViewGpu.js';

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
    },
    finish() { return { label: 'fake-hierarchy-command-buffer', events }; }
  };
}

function createFakeDevice() {
  const buffers = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  return {
    buffers,
    pipelines,
    bindGroups,
    writes,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, byteLength: data.byteLength });
      },
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
    createCommandEncoder() { return createFakeEncoder(); }
  };
}

function identity() {
  return {
    generationId: 7,
    deviceOrdinal: 0,
    laneOrdinal: 0,
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
}

function createEncodedInputs(device) {
  const ids = identity();
  const sourceBuffer = device.createBuffer({ label: 'hierarchy-source', size: 2048, usage: 128 });
  const directoryBuffer = device.createBuffer({ label: 'hierarchy-directory', size: 4096, usage: 128 });
  const spatialOwner = { ownsExecution: (value) => value === spatialExecution };
  const spatialExecution = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
    status: 'schroeder-spatial-epoch-gpu-encoded',
    submitPerformed: false,
    released: false,
    sourceBuffer,
    directoryBuffer,
    ...ids
  };
  Object.defineProperty(spatialExecution, 'ownerRuntime', { value: spatialOwner });
  const mechanics = ({ level, dims, spacing, label }) => {
    const gridNodeCount = dims.reduce((product, value) => product * value, 1);
    const mechanicsViewBuffer = device.createBuffer({
      label,
      size: (64 + gridNodeCount) * Uint32Array.BYTES_PER_ELEMENT,
      usage: 128 | 256
    });
    const owner = { ownsExecution: (value) => value === view };
    const view = {
      schema: 'peercompute.ulg.schroeder-spatial-mechanics-view.v1',
      status: 'schroeder-spatial-mechanics-view-gpu-encoded',
      submitPerformed: false,
      released: false,
      sourceBuffer,
      directoryBuffer,
      mechanicsViewBuffer,
      indirectDispatchBuffer: mechanicsViewBuffer,
      indirectDispatchOffsetBytes: 240,
      selectedLevel: level,
      gridNodeCount,
      gridDims: dims,
      gridShift: 1,
      gridSpacingM: spacing,
      completionOrdinal: ids.buildOrdinal,
      ...ids
    };
    Object.defineProperty(view, 'ownerRuntime', { value: owner });
    return view;
  };
  return {
    spatialExecution,
    fineMechanicsView: mechanics({ level: 0, dims: [8, 8, 8], spacing: 0.25, label: 'fine-view' }),
    coarseMechanicsView: mechanics({ level: 1, dims: [5, 5, 5], spacing: 0.5, label: 'coarse-view' })
  };
}

test('two-level hierarchy ABI has compact CSR ranges and one fail-closed dispatch', () => {
  assert.equal(SCHROEDER_SPATIAL_HIERARCHY_VIEW_HEADER_LAYOUT.length, 64);
  assert.equal(SCHROEDER_SPATIAL_HIERARCHY_VIEW_HEADER_WORDS, 64);
  assert.equal(SCHROEDER_SPATIAL_HIERARCHY_VIEW_DISPATCH_OFFSET_WORDS, 60);
  assert.equal(SCHROEDER_SPATIAL_HIERARCHY_VIEW_FINE_DISPATCH_OFFSET_WORDS, 64);
  assert.equal(SCHROEDER_SPATIAL_HIERARCHY_MAX_INTERPOLATION_EDGES_PER_FINE_NODE, 8);
  const layout = createSchroederSpatialHierarchyViewLayout({
    fineNodeCapacity: 512,
    coarseNodeCapacity: 125
  });
  assert.equal(layout.edgeCapacity, 4096);
  assert.equal(layout.childEdgeCapacity, 512);
  assert.equal(layout.edgeOffsetOffsetWords, layout.edgeCountOffsetWords + 512);
  assert.equal(layout.edgeParentOffsetWords, layout.edgeOffsetOffsetWords + 513);
  assert.equal(layout.edgeWeightOffsetWords, layout.edgeParentOffsetWords + 4096);
  assert.equal(layout.childIndexOffsetWords, layout.childOffsetOffsetWords + 126);
  assert.equal(layout.wordLength, layout.childIndexOffsetWords + 512);
  const plan = createSchroederSpatialHierarchyViewPlan({
    fineLevel: 0,
    coarseLevel: 1,
    fineGrid: { gridNodeCount: 512, gridDims: [8, 8, 8], gridShift: 1, gridSpacingM: 0.25 },
    coarseGrid: { gridNodeCount: 125, gridDims: [5, 5, 5], gridShift: 1, gridSpacingM: 0.5 },
    ...identity(),
    completionOrdinal: identity().buildOrdinal
  });
  assert.equal(plan.schema, ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA);
  assert.equal(plan.maxMechanicsLevelCount, 2);
  assert.throws(
    () => createSchroederSpatialHierarchyViewPlan({
      ...plan,
      coarseLevel: 2
    }),
    /fineLevel \+ 1/
  );
  assert.match(schroederSpatialHierarchyViewWgsl, /fn mark_from_fine/);
  assert.match(schroederSpatialHierarchyViewWgsl, /fn scatter_fine_edges_and_count_children/);
  assert.match(schroederSpatialHierarchyViewWgsl, /fn scatter_children/);
  assert.match(schroederSpatialHierarchyViewWgsl, /fn finalize_hierarchy/);
  assert.doesNotMatch(schroederSpatialHierarchyViewWgsl, /candidate_budget/);
});

test('hierarchy runtime encodes persistent compact parent-child CSR and retires after a fence', async () => {
  const device = createFakeDevice();
  const inputs = createEncodedInputs(device);
  const runtime = createSchroederSpatialHierarchyViewGpu(device, {
    fineGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 1,
      gridSpacingM: 0.25
    },
    coarseGrid: {
      gridNodeCount: 125,
      gridDims: [5, 5, 5],
      gridShift: 1,
      gridSpacingM: 0.5
    },
    arenaCount: 2
  });
  const encoder = createFakeEncoder();
  const execution = runtime.encode(encoder, inputs);
  assert.equal(execution.status, 'schroeder-spatial-hierarchy-view-gpu-encoded');
  assert.equal(execution.submitPerformed, false);
  assert.equal(execution.topology, 'two-level-compact-parent-child-csr');
  assert.equal(execution.transferStencil, 'normalized-trilinear-up-to-eight-edges');
  assert.equal(execution.bufferAllocationCountDuringEncode, 0);
  assert.equal(execution.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(execution.readbackPerformed, false);
  assert.equal(execution.indirectDispatchBuffer, execution.hierarchyViewBuffer);
  assert.equal(execution.indirectDispatchOffsetBytes, 240);
  assert.equal(execution.coarseIndirectDispatchOffsetBytes, 240);
  assert.equal(execution.fineIndirectDispatchOffsetBytes, 256);
  const passCommands = encoder.events
    .filter((event) => event.kind === 'pass')
    .flatMap((event) => event.commands);
  assert.ok(passCommands.some((command) => /mark-from-fine/.test(command.pipeline)));
  assert.ok(passCommands.some((command) => /mark-from-coarse/.test(command.pipeline)));
  assert.ok(passCommands.some((command) => /prepare-fine-edges/.test(command.pipeline)));
  assert.ok(passCommands.some((command) => /scatter-fine-edges/.test(command.pipeline)));
  assert.ok(passCommands.some((command) => /scatter-children/.test(command.pipeline)));
  assert.ok(passCommands.some((command) => /finalize-hierarchy/.test(command.pipeline)));
  assert.ok(passCommands.filter((command) => command.dispatchIndirect).length >= 4);

  assert.equal(runtime.markExecutionSubmitted(execution), true);
  assert.equal(validateSchroederSpatialHierarchyViewDescriptor(execution, {
    generationId: inputs.spatialExecution.generationId,
    fineLevel: 0,
    coarseLevel: 1
  }).admitted, true);
  assert.equal(validateSchroederSpatialHierarchyViewDescriptor({
    ...execution
  }).status, 'schroeder-spatial-hierarchy-view-rejected-owner');
  assert.equal(await runtime.releaseExecutionAfter(execution, Promise.resolve()), true);
  assert.equal(execution.released, true);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.destroy(), true);
});

test('hierarchy runtime fails before encoding on foreign or nonadjacent mechanics views', () => {
  const device = createFakeDevice();
  const inputs = createEncodedInputs(device);
  const runtime = createSchroederSpatialHierarchyViewGpu(device, {
    fineGrid: {
      gridNodeCount: 512,
      gridDims: [8, 8, 8],
      gridShift: 1,
      gridSpacingM: 0.25
    },
    coarseGrid: {
      gridNodeCount: 125,
      gridDims: [5, 5, 5],
      gridShift: 1,
      gridSpacingM: 0.5
    }
  });
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      ...inputs,
      coarseMechanicsView: { ...inputs.coarseMechanicsView }
    }),
    /exact live encoded mechanics views/
  );
  inputs.coarseMechanicsView.selectedLevel = 2;
  assert.throws(
    () => runtime.encode(createFakeEncoder(), inputs),
    /exact live encoded mechanics views/
  );
  inputs.coarseMechanicsView.selectedLevel = 1;
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.destroy(), true);
});
