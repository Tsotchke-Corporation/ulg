import {
  SCHROEDER_SPATIAL_HIERARCHY_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_HIERARCHY_VIEW_FINE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_HIERARCHY_VIEW_PARAMS_BYTES,
  SCHROEDER_SPATIAL_HIERARCHY_VIEW_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA,
  createSchroederSpatialHierarchyViewPlan
} from '../../../ulg-gpu-abi/src/schroederSpatialHierarchyView.js';
import {
  ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import { ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA } from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  schroederSpatialHierarchyViewWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialHierarchyViewWgsl.js';
import { createWebGpuU32ExclusiveScan } from '../webgpuRadixScanUnique.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function positiveInteger(value, label, max = 0xffff_ffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function assertDevice(device) {
  if (
    !device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer
  ) {
    throw new TypeError('spatial hierarchy view requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (
    !encoder?.beginComputePass
    || !encoder?.clearBuffer
  ) {
    throw new TypeError('spatial hierarchy view encoding requires a GPUCommandEncoder-like object');
  }
}

function createOwnedBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function gridFromMechanicsView(view) {
  return {
    gridNodeCount: view.gridNodeCount,
    gridDims: Array.from(view.gridDims || []),
    gridShift: view.gridShift,
    gridSpacingM: view.gridSpacingM
  };
}

function hierarchyParamsData(plan, fineMechanicsView, coarseMechanicsView) {
  const data = new ArrayBuffer(SCHROEDER_SPATIAL_HIERARCHY_VIEW_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (offset, value) => view.setUint32(offset, Number(value) >>> 0, true);
  const i32 = (offset, value) => view.setInt32(offset, Number(value) | 0, true);
  const f32 = (offset, value) => view.setFloat32(offset, Math.fround(Number(value)), true);
  const fine = plan.fineGrid;
  const coarse = plan.coarseGrid;
  const layout = plan.layout;
  u32(0, fine.gridNodeCount);
  u32(4, coarse.gridNodeCount);
  u32(8, fine.gridDims[0]);
  u32(12, fine.gridDims[1]);
  u32(16, fine.gridDims[2]);
  u32(20, coarse.gridDims[0]);
  u32(24, coarse.gridDims[1]);
  u32(28, coarse.gridDims[2]);
  i32(32, fine.gridShift);
  i32(36, coarse.gridShift);
  i32(40, plan.fineLevel);
  i32(44, plan.coarseLevel);
  f32(48, fine.gridSpacingM);
  f32(52, coarse.gridSpacingM);
  f32(56, Math.max(16 * Number.EPSILON, 2 ** -20));
  f32(60, Math.max(fine.gridSpacingM * 2 ** -18, 1e-8));
  u32(64, layout.fineNodeCapacity);
  u32(68, layout.coarseNodeCapacity);
  u32(72, layout.edgeCapacity);
  u32(76, layout.childEdgeCapacity);
  u32(80, layout.coarseOccupancyWordCount);
  u32(84, layout.fineNodeOffsetWords);
  u32(88, layout.coarseNodeOffsetWords);
  u32(92, layout.edgeCountOffsetWords);
  u32(96, layout.edgeOffsetOffsetWords);
  u32(100, layout.edgeParentOffsetWords);
  u32(104, layout.edgeWeightOffsetWords);
  u32(108, layout.parentOfFineOffsetWords);
  u32(112, layout.childCountOffsetWords);
  u32(116, layout.childOffsetOffsetWords);
  u32(120, layout.childIndexOffsetWords);
  u32(124, plan.requiredWords);
  u32(128, plan.capacityWords);
  u32(132, plan.generationId);
  u32(136, plan.deviceOrdinal);
  u32(140, plan.laneOrdinal);
  u32(144, plan.leaseToken);
  u32(148, plan.sourceFamilyId);
  u32(152, plan.storageGeneration);
  u32(156, plan.physicsTick);
  u32(160, plan.physicsSubstep);
  u32(164, plan.positionEpoch);
  u32(168, plan.topologyEpoch);
  u32(172, plan.chartEpoch);
  u32(176, plan.levelEpoch);
  u32(180, plan.supportEpoch);
  u32(184, plan.completionOrdinal);
  u32(188, fineMechanicsView.completionOrdinal);
  u32(192, coarseMechanicsView.completionOrdinal);
  u32(196, SCHROEDER_SPATIAL_HIERARCHY_VIEW_WORKGROUP_SIZE);
  u32(200, plan.requiredWords);
  return data;
}

function encodeDirectPass(encoder, pipeline, bindGroup, workgroups, label) {
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...workgroups);
  pass.end();
  return 1;
}

function encodeIndirectPass(encoder, pipeline, bindGroup, buffer, offset, label) {
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroupsIndirect(buffer, offset);
  pass.end();
  return 1;
}

export function createSchroederSpatialHierarchyViewGpu(device, {
  fineGrid,
  coarseGrid,
  arenaCount = 2,
  label = 'ulg-schroeder-spatial-hierarchy-view'
} = {}) {
  assertDevice(device);
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const template = createSchroederSpatialHierarchyViewPlan({
    fineLevel: 0,
    coarseLevel: 1,
    fineGrid,
    coarseGrid,
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
  const maxStorageBuffersPerShaderStage = positiveInteger(
    device.limits?.maxStorageBuffersPerShaderStage ?? 8,
    'device.limits.maxStorageBuffersPerShaderStage',
    0xffff
  );
  if (maxStorageBuffersPerShaderStage < 8) {
    throw new RangeError('spatial hierarchy view requires eight storage bindings');
  }
  const maxBufferSize = positiveInteger(
    device.limits?.maxBufferSize ?? 256 * 1024 * 1024,
    'device.limits.maxBufferSize',
    Number.MAX_SAFE_INTEGER
  );
  const maxStorageBufferBindingSize = positiveInteger(
    device.limits?.maxStorageBufferBindingSize ?? maxBufferSize,
    'device.limits.maxStorageBufferBindingSize',
    Number.MAX_SAFE_INTEGER
  );
  for (const [role, byteLength] of [
    ['hierarchy view', template.layout.byteLength],
    ['coarse occupancy', template.layout.coarseOccupancyByteLength],
    ['fine edge counts', template.layout.fineCountByteLength],
    ['coarse child counts', template.layout.coarseCountByteLength]
  ]) {
    if (byteLength > maxBufferSize || byteLength > maxStorageBufferBindingSize) {
      throw new RangeError(`${role} exceeds the WebGPU storage buffer limit`);
    }
  }
  const maxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension'
  );
  for (const count of [
    template.layout.fineNodeCapacity,
    template.layout.coarseNodeCapacity,
    template.layout.coarseOccupancyWordCount
  ]) {
    if (
      Math.ceil(count / SCHROEDER_SPATIAL_HIERARCHY_VIEW_WORKGROUP_SIZE)
        > maxComputeWorkgroupsPerDimension
    ) {
      throw new RangeError('spatial hierarchy view dispatch exceeds maxComputeWorkgroupsPerDimension');
    }
  }

  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: schroederSpatialHierarchyViewWgsl
  });
  const pipeline = (entryPoint) => device.createComputePipeline({
    label: `${label}-${entryPoint.replaceAll('_', '-')}-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  const pipelines = Object.freeze({
    markFine: pipeline('mark_from_fine'),
    markCoarse: pipeline('mark_from_coarse'),
    countCoarse: pipeline('count_coarse_occupancy'),
    scatterCoarse: pipeline('scatter_coarse_nodes'),
    prepareFine: pipeline('prepare_fine_edges'),
    scatterEdges: pipeline('scatter_fine_edges_and_count_children'),
    scatterChildren: pipeline('scatter_children'),
    finalize: pipeline('finalize_hierarchy')
  });
  const deviceId = webGpuDeviceId(device);
  let destroyed = false;
  let serial = 0;
  let runtime = null;
  const executionOwnership = new WeakMap();
  const releasedExecutions = new WeakSet();
  const submittedExecutions = new WeakSet();
  const releaseInFlight = new WeakSet();

  const storageUsage = GPU_BUFFER_USAGE.STORAGE
    | GPU_BUFFER_USAGE.COPY_SRC
    | GPU_BUFFER_USAGE.COPY_DST;
  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const arenaLabel = `${label}-arena-${arenaIndex}`;
    const makeU32 = (role, count, extraUsage = 0) => createOwnedBuffer(
      device,
      `${arenaLabel}-${role}`,
      Math.max(UINT32_BYTES, count * UINT32_BYTES),
      storageUsage | extraUsage
    );
    return {
      arenaIndex,
      inUse: false,
      token: null,
      paramsBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-params`,
        SCHROEDER_SPATIAL_HIERARCHY_VIEW_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      coarseOccupancyBuffer: makeU32(
        'coarse-occupancy',
        template.layout.coarseOccupancyWordCount
      ),
      coarseOccupancyCountBuffer: makeU32(
        'coarse-occupancy-counts',
        template.layout.coarseOccupancyWordCount
      ),
      coarseOccupancyOffsetBuffer: makeU32(
        'coarse-occupancy-offsets',
        template.layout.coarseOccupancyWordCount
      ),
      fineEdgeCountBuffer: makeU32('fine-edge-counts', template.layout.fineNodeCapacity),
      fineEdgeOffsetBuffer: makeU32('fine-edge-offsets', template.layout.fineNodeCapacity),
      childCountBuffer: makeU32('child-counts', template.layout.coarseNodeCapacity),
      childOffsetBuffer: makeU32('child-offsets', template.layout.coarseNodeCapacity),
      childCursorBuffer: makeU32('child-cursors', template.layout.coarseNodeCapacity),
      hierarchyViewBuffer: makeU32(
        'view',
        template.layout.wordLength,
        GPU_BUFFER_USAGE.INDIRECT
      ),
      occupancyScan: createWebGpuU32ExclusiveScan(device, {
        maxElementCount: template.layout.coarseOccupancyWordCount,
        fixedElementCount: template.layout.coarseOccupancyWordCount,
        retainParamsBuffer: true,
        label: `${arenaLabel}-coarse-occupancy-scan`
      }),
      edgeScan: createWebGpuU32ExclusiveScan(device, {
        maxElementCount: template.layout.fineNodeCapacity,
        fixedElementCount: template.layout.fineNodeCapacity,
        retainParamsBuffer: true,
        label: `${arenaLabel}-fine-edge-scan`
      }),
      childScan: createWebGpuU32ExclusiveScan(device, {
        maxElementCount: template.layout.coarseNodeCapacity,
        fixedElementCount: template.layout.coarseNodeCapacity,
        retainParamsBuffer: true,
        label: `${arenaLabel}-child-scan`
      })
    };
  });

  const arenaBuffers = (arena) => [
    arena.paramsBuffer,
    arena.coarseOccupancyBuffer,
    arena.coarseOccupancyCountBuffer,
    arena.coarseOccupancyOffsetBuffer,
    arena.fineEdgeCountBuffer,
    arena.fineEdgeOffsetBuffer,
    arena.childCountBuffer,
    arena.childOffsetBuffer,
    arena.childCursorBuffer,
    arena.hierarchyViewBuffer
  ];
  const retainedGpuBufferBytes = arenas.reduce((total, arena) => (
    total + arenaBuffers(arena).reduce((sum, buffer) => sum + Number(buffer.size ?? 0), 0)
      + [arena.occupancyScan, arena.edgeScan, arena.childScan].reduce(
        (sum, scan) => sum + scan.allocationEntries().reduce(
          (scanSum, entry) => scanSum + Number(entry.buffer?.size ?? 0),
          0
        ),
        0
      )
  ), 0);

  function acquireArena() {
    const arena = arenas.find((candidate) => candidate.inUse === false);
    if (!arena) {
      const error = new Error('spatial hierarchy view arenas are under backpressure');
      error.code = 'ERR_SCHROEDER_HIERARCHY_VIEW_ARENA_EXHAUSTED';
      throw error;
    }
    const token = Object.freeze({ serial: ++serial, arenaIndex: arena.arenaIndex });
    arena.inUse = true;
    arena.token = token;
    return { arena, token };
  }

  function releaseArena(arena, token) {
    if (!arena.inUse || arena.token !== token) return false;
    arena.inUse = false;
    arena.token = null;
    return true;
  }

  function createBindings(pipelineObject, resources, bindings, bindLabel) {
    return device.createBindGroup({
      label: bindLabel,
      layout: pipelineObject.getBindGroupLayout(0),
      entries: bindings.map((binding) => ({
        binding,
        resource: { buffer: resources.get(binding) }
      }))
    });
  }

  function assertEncodedMechanicsView(view, spatialExecution, expectedLevel, expectedGrid) {
    let ownerAdmitted = false;
    try {
      ownerAdmitted = view?.ownerRuntime?.ownsExecution?.(view) === true;
    } catch {
      ownerAdmitted = false;
    }
    if (
      view?.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA
      || view.status !== 'schroeder-spatial-mechanics-view-gpu-encoded'
      || view.submitPerformed !== false
      || view.released === true
      || !ownerAdmitted
      || view.directoryBuffer !== spatialExecution.directoryBuffer
      || view.sourceBuffer !== spatialExecution.sourceBuffer
      || view.generationId !== spatialExecution.generationId
      || view.completionOrdinal !== spatialExecution.buildOrdinal
      || view.selectedLevel !== expectedLevel
      || view.gridNodeCount !== expectedGrid.gridNodeCount
      || view.gridShift !== expectedGrid.gridShift
      || view.gridSpacingM !== expectedGrid.gridSpacingM
      || Array.from(view.gridDims || []).some(
        (value, axis) => value !== expectedGrid.gridDims[axis]
      )
      || !view.mechanicsViewBuffer
      || !webGpuBufferMatchesDevice(view.mechanicsViewBuffer, device)
    ) {
      throw new TypeError(
        'spatial hierarchy view requires exact live encoded mechanics views from one generation'
      );
    }
  }

  function encode(encoder, {
    spatialExecution,
    fineMechanicsView,
    coarseMechanicsView
  } = {}) {
    if (destroyed) throw new Error('spatial hierarchy view runtime is destroyed');
    assertEncoder(encoder);
    let spatialOwnerAdmitted = false;
    try {
      spatialOwnerAdmitted = spatialExecution?.ownerRuntime?.ownsExecution?.(
        spatialExecution
      ) === true;
    } catch {
      spatialOwnerAdmitted = false;
    }
    if (
      spatialExecution?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
      || spatialExecution.status !== 'schroeder-spatial-epoch-gpu-encoded'
      || spatialExecution.submitPerformed !== false
      || spatialExecution.released === true
      || !spatialOwnerAdmitted
    ) {
      throw new TypeError('spatial hierarchy view requires the exact encoded spatial generation');
    }
    assertEncodedMechanicsView(
      fineMechanicsView,
      spatialExecution,
      fineMechanicsView?.selectedLevel,
      template.fineGrid
    );
    assertEncodedMechanicsView(
      coarseMechanicsView,
      spatialExecution,
      fineMechanicsView.selectedLevel + 1,
      template.coarseGrid
    );
    const plan = createSchroederSpatialHierarchyViewPlan({
      fineLevel: fineMechanicsView.selectedLevel,
      coarseLevel: coarseMechanicsView.selectedLevel,
      fineGrid: gridFromMechanicsView(fineMechanicsView),
      coarseGrid: gridFromMechanicsView(coarseMechanicsView),
      generationId: spatialExecution.generationId,
      deviceOrdinal: spatialExecution.deviceOrdinal,
      laneOrdinal: spatialExecution.laneOrdinal,
      leaseToken: spatialExecution.leaseToken,
      sourceFamilyId: spatialExecution.sourceFamilyId,
      storageGeneration: spatialExecution.storageGeneration,
      physicsTick: spatialExecution.physicsTick,
      physicsSubstep: spatialExecution.physicsSubstep,
      positionEpoch: spatialExecution.positionEpoch,
      topologyEpoch: spatialExecution.topologyEpoch,
      chartEpoch: spatialExecution.chartEpoch,
      levelEpoch: spatialExecution.levelEpoch,
      supportEpoch: spatialExecution.supportEpoch,
      completionOrdinal: spatialExecution.buildOrdinal
    });
    const { arena, token } = acquireArena();
    try {
      device.queue.writeBuffer(
        arena.paramsBuffer,
        0,
        hierarchyParamsData(plan, fineMechanicsView, coarseMechanicsView)
      );
      for (const buffer of [
        arena.coarseOccupancyBuffer,
        arena.coarseOccupancyCountBuffer,
        arena.coarseOccupancyOffsetBuffer,
        arena.fineEdgeCountBuffer,
        arena.fineEdgeOffsetBuffer,
        arena.childCountBuffer,
        arena.childOffsetBuffer,
        arena.childCursorBuffer,
        arena.hierarchyViewBuffer
      ]) encoder.clearBuffer(buffer);
      const resources = new Map([
        [0, fineMechanicsView.mechanicsViewBuffer],
        [1, coarseMechanicsView.mechanicsViewBuffer],
        [2, arena.coarseOccupancyBuffer],
        [3, arena.coarseOccupancyCountBuffer],
        [4, arena.coarseOccupancyOffsetBuffer],
        [5, arena.fineEdgeCountBuffer],
        [6, arena.fineEdgeOffsetBuffer],
        [7, arena.childCountBuffer],
        [8, arena.childOffsetBuffer],
        [9, arena.childCursorBuffer],
        [10, arena.hierarchyViewBuffer],
        [11, arena.paramsBuffer]
      ]);
      const group = (pipelineObject, bindings, suffix) => createBindings(
        pipelineObject,
        resources,
        bindings,
        `${label}-arena-${arena.arenaIndex}-${suffix}-bindings`
      );
      const groups = {
        markFine: group(pipelines.markFine, [0, 2, 10, 11], 'mark-fine'),
        markCoarse: group(pipelines.markCoarse, [1, 2, 10, 11], 'mark-coarse'),
        countCoarse: group(pipelines.countCoarse, [2, 3, 11], 'count-coarse'),
        scatterCoarse: group(pipelines.scatterCoarse, [2, 4, 10, 11], 'scatter-coarse'),
        prepareFine: group(pipelines.prepareFine, [0, 5, 10, 11], 'prepare-fine'),
        scatterEdges: group(
          pipelines.scatterEdges,
          [0, 2, 4, 6, 7, 10, 11],
          'scatter-edges'
        ),
        scatterChildren: group(
          pipelines.scatterChildren,
          [0, 7, 8, 9, 10, 11],
          'scatter-children'
        ),
        finalize: group(
          pipelines.finalize,
          [0, 1, 3, 4, 5, 6, 10, 11],
          'finalize'
        )
      };
      let encodedDispatchCount = 0;
      encodedDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.markFine,
        groups.markFine,
        fineMechanicsView.indirectDispatchBuffer,
        fineMechanicsView.indirectDispatchOffsetBytes,
        `${label}MarkFromFine`
      );
      encodedDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.markCoarse,
        groups.markCoarse,
        coarseMechanicsView.indirectDispatchBuffer,
        coarseMechanicsView.indirectDispatchOffsetBytes,
        `${label}MarkFromCoarse`
      );
      encodedDispatchCount += encodeDirectPass(
        encoder,
        pipelines.countCoarse,
        groups.countCoarse,
        [Math.ceil(plan.layout.coarseOccupancyWordCount
          / SCHROEDER_SPATIAL_HIERARCHY_VIEW_WORKGROUP_SIZE), 1, 1],
        `${label}CountCoarseOccupancy`
      );
      const occupancyScan = arena.occupancyScan.prepare({
        inputBuffer: arena.coarseOccupancyCountBuffer,
        outputBuffer: arena.coarseOccupancyOffsetBuffer,
        elementCount: plan.layout.coarseOccupancyWordCount
      });
      arena.occupancyScan.encodePrepared(encoder, occupancyScan, {
        labelPrefix: `${label}CoarseOccupancy`
      });
      encodedDispatchCount += occupancyScan.encodedDispatchCount;
      encodedDispatchCount += encodeDirectPass(
        encoder,
        pipelines.scatterCoarse,
        groups.scatterCoarse,
        [Math.ceil(plan.layout.coarseOccupancyWordCount
          / SCHROEDER_SPATIAL_HIERARCHY_VIEW_WORKGROUP_SIZE), 1, 1],
        `${label}ScatterCoarseNodes`
      );
      encodedDispatchCount += encodeDirectPass(
        encoder,
        pipelines.prepareFine,
        groups.prepareFine,
        [Math.ceil(plan.fineNodeCapacity
          / SCHROEDER_SPATIAL_HIERARCHY_VIEW_WORKGROUP_SIZE), 1, 1],
        `${label}PrepareFineEdges`
      );
      const edgeScan = arena.edgeScan.prepare({
        inputBuffer: arena.fineEdgeCountBuffer,
        outputBuffer: arena.fineEdgeOffsetBuffer,
        elementCount: plan.fineNodeCapacity
      });
      arena.edgeScan.encodePrepared(encoder, edgeScan, {
        labelPrefix: `${label}FineEdges`
      });
      encodedDispatchCount += edgeScan.encodedDispatchCount;
      encodedDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.scatterEdges,
        groups.scatterEdges,
        fineMechanicsView.indirectDispatchBuffer,
        fineMechanicsView.indirectDispatchOffsetBytes,
        `${label}ScatterFineEdges`
      );
      const childScan = arena.childScan.prepare({
        inputBuffer: arena.childCountBuffer,
        outputBuffer: arena.childOffsetBuffer,
        elementCount: plan.coarseNodeCapacity
      });
      arena.childScan.encodePrepared(encoder, childScan, {
        labelPrefix: `${label}Children`
      });
      encodedDispatchCount += childScan.encodedDispatchCount;
      encodedDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.scatterChildren,
        groups.scatterChildren,
        fineMechanicsView.indirectDispatchBuffer,
        fineMechanicsView.indirectDispatchOffsetBytes,
        `${label}ScatterChildren`
      );
      encodedDispatchCount += encodeDirectPass(
        encoder,
        pipelines.finalize,
        groups.finalize,
        [1, 1, 1],
        `${label}Finalize`
      );
      const execution = {
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA,
        status: 'schroeder-spatial-hierarchy-view-gpu-encoded',
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        spatialExecution,
        fineMechanicsView,
        coarseMechanicsView,
        hierarchyViewBuffer: arena.hierarchyViewBuffer,
        indirectDispatchBuffer: arena.hierarchyViewBuffer,
        indirectDispatchOffsetBytes:
          SCHROEDER_SPATIAL_HIERARCHY_VIEW_DISPATCH_OFFSET_WORDS * UINT32_BYTES,
        coarseIndirectDispatchBuffer: arena.hierarchyViewBuffer,
        coarseIndirectDispatchOffsetBytes:
          SCHROEDER_SPATIAL_HIERARCHY_VIEW_DISPATCH_OFFSET_WORDS * UINT32_BYTES,
        fineIndirectDispatchBuffer: arena.hierarchyViewBuffer,
        fineIndirectDispatchOffsetBytes:
          SCHROEDER_SPATIAL_HIERARCHY_VIEW_FINE_DISPATCH_OFFSET_WORDS * UINT32_BYTES,
        coarseOccupancyBuffer: arena.coarseOccupancyBuffer,
        coarseOccupancyCountBuffer: arena.coarseOccupancyCountBuffer,
        coarseOccupancyOffsetBuffer: arena.coarseOccupancyOffsetBuffer,
        fineEdgeCountBuffer: arena.fineEdgeCountBuffer,
        fineEdgeOffsetBuffer: arena.fineEdgeOffsetBuffer,
        childCountBuffer: arena.childCountBuffer,
        childOffsetBuffer: arena.childOffsetBuffer,
        encodedDispatchCount,
        encodedComputePassCount: 8
          + occupancyScan.encodedComputePassCount
          + edgeScan.encodedComputePassCount
          + childScan.encodedComputePassCount,
        retainedGpuBufferBytes,
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        readbackPerformed: false,
        submitPerformed: false,
        submissionOwnership: 'caller',
        topology: 'two-level-compact-parent-child-csr',
        transferStencil: 'normalized-trilinear-up-to-eight-edges'
      };
      Object.defineProperty(execution, 'ownerRuntime', { value: runtime, enumerable: false });
      Object.defineProperty(execution, 'released', {
        get() { return releasedExecutions.has(execution); },
        enumerable: true
      });
      executionOwnership.set(execution, {
        arena,
        token,
        spatialExecution,
        fineMechanicsView,
        coarseMechanicsView
      });
      return execution;
    } catch (error) {
      releaseArena(arena, token);
      throw error;
    }
  }

  function ownershipFor(execution) {
    const ownership = executionOwnership.get(execution);
    if (
      !ownership
      || releasedExecutions.has(execution)
      || releaseInFlight.has(execution)
      || ownership.arena.token !== ownership.token
      || ownership.arena.inUse !== true
      || execution.ownerRuntime !== runtime
      || execution.hierarchyViewBuffer !== ownership.arena.hierarchyViewBuffer
      || execution.indirectDispatchBuffer !== ownership.arena.hierarchyViewBuffer
      || execution.spatialExecution !== ownership.spatialExecution
      || execution.fineMechanicsView !== ownership.fineMechanicsView
      || execution.coarseMechanicsView !== ownership.coarseMechanicsView
    ) {
      const error = new Error('spatial hierarchy view execution is not owned by this runtime');
      error.code = 'ERR_SCHROEDER_HIERARCHY_VIEW_FOREIGN_EXECUTION';
      throw error;
    }
    return ownership;
  }

  function ownsExecution(execution) {
    try {
      ownershipFor(execution);
      return true;
    } catch {
      return false;
    }
  }

  function markExecutionSubmitted(execution) {
    ownershipFor(execution);
    if (submittedExecutions.has(execution)) return false;
    submittedExecutions.add(execution);
    Object.defineProperty(execution, 'submitPerformed', { value: true, enumerable: true });
    Object.defineProperty(execution, 'status', {
      value: 'schroeder-spatial-hierarchy-view-gpu-build-submitted',
      enumerable: true
    });
    return true;
  }

  function isExecutionSubmitted(execution) {
    return submittedExecutions.has(execution)
      && ownsExecution(execution)
      && execution.submitPerformed === true;
  }

  function finalizeRelease(execution, ownership) {
    const released = releaseArena(ownership.arena, ownership.token);
    if (released) {
      releasedExecutions.add(execution);
      submittedExecutions.delete(execution);
      executionOwnership.delete(execution);
    }
    return released;
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError('releaseExecution requires { discardedEncoder: true }');
    }
    if (submittedExecutions.has(execution)) {
      throw new Error('submitted spatial hierarchy view requires a queue fence');
    }
    return finalizeRelease(execution, ownershipFor(execution));
  }

  async function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    const ownership = ownershipFor(execution);
    if (!submittedExecutions.has(execution)) {
      throw new Error('unsubmitted spatial hierarchy view requires discarded-encoder release');
    }
    releaseInFlight.add(execution);
    try {
      await submissionFence;
      return finalizeRelease(execution, ownership);
    } finally {
      releaseInFlight.delete(execution);
    }
  }

  function activeExecutionCount() {
    return arenas.reduce((count, arena) => count + (arena.inUse ? 1 : 0), 0);
  }

  function allocationEntries() {
    return arenas.flatMap((arena) => [
      ...arenaBuffers(arena).map((buffer) => ({
        role: 'hierarchy-view-arena-buffer',
        arenaIndex: arena.arenaIndex,
        buffer
      })),
      ...[arena.occupancyScan, arena.edgeScan, arena.childScan].flatMap((scan, scanIndex) => (
        scan.allocationEntries().map((entry) => ({
          ...entry,
          role: `hierarchy-view-scan-${scanIndex}-${entry.role}`,
          arenaIndex: arena.arenaIndex
        }))
      ))
    ]);
  }

  function destroy() {
    if (destroyed) return false;
    if (arenas.some((arena) => arena.inUse)) {
      throw new Error('spatial hierarchy view runtime still has active executions');
    }
    destroyed = true;
    for (const arena of arenas) {
      for (const buffer of arenaBuffers(arena)) buffer.destroy?.();
      arena.occupancyScan.destroy();
      arena.edgeScan.destroy();
      arena.childScan.destroy();
    }
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA,
    status: 'schroeder-spatial-hierarchy-view-gpu-runtime-ready',
    deviceId,
    arenaCount: resolvedArenaCount,
    fineGrid: template.fineGrid,
    coarseGrid: template.coarseGrid,
    layout: template.layout,
    pipelineCount: Object.keys(pipelines).length + arenas.reduce(
      (sum, arena) => sum
        + arena.occupancyScan.pipelineCount
        + arena.edgeScan.pipelineCount
        + arena.childScan.pipelineCount,
      0
    ),
    retainedGpuBufferBytes,
    encode,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    releaseExecution,
    releaseExecutionAfter,
    activeExecutionCount,
    allocationEntries,
    destroy
  };
  return runtime;
}
