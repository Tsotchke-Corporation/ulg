import {
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_FINE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_PARAMS_BYTES,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
  createSchroederSpatialParentFieldViewPlan
} from '../../../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import {
  schroederSpatialParentFieldViewWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialParentFieldViewWgsl.js';
import {
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialHierarchyView.js';
import {
  createWebGpuStableRadixScanUnique,
  createWebGpuU32ExclusiveScan
} from '../webgpuRadixScanUnique.js';
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
    throw new TypeError('spatial parent-field view requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
    throw new TypeError(
      'spatial parent-field encoding requires a GPUCommandEncoder-like object'
    );
  }
}

function createOwnedBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function gridFromFieldView(fieldView) {
  return {
    gridNodeCount: fieldView.gridNodeCount,
    gridDims: Array.from(fieldView.gridDims || []),
    gridShift: fieldView.gridShift,
    gridSpacingM: fieldView.gridSpacingM
  };
}

function parentFieldParamsData(
  plan,
  hierarchyView,
  fineFieldView,
  coarseFieldView,
  maxComputeWorkgroupsPerDimension
) {
  const data = new ArrayBuffer(SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (offset, value) => view.setUint32(offset, Number(value) >>> 0, true);
  const i32 = (offset, value) => view.setInt32(offset, Number(value) | 0, true);
  const f32 = (offset, value) => view.setFloat32(
    offset,
    Math.fround(Number(value)),
    true
  );
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
  u32(64, layout.fineFieldCapacity);
  u32(68, layout.coarseFieldCapacity);
  u32(72, layout.fineCandidateCapacity);
  u32(76, layout.candidateCapacity);
  u32(80, layout.parentFieldCapacity);
  u32(84, layout.edgeCapacity);
  u32(88, layout.parentKeyOffsetWords);
  u32(92, layout.keyWords);
  u32(96, layout.fineEdgeCountOffsetWords);
  u32(100, layout.fineEdgeOffsetOffsetWords);
  u32(104, layout.fineEdgeParentOffsetWords);
  u32(108, layout.fineEdgeWeightOffsetWords);
  u32(112, layout.coarseNativeMapOffsetWords);
  u32(116, plan.requiredWords);
  u32(120, plan.capacityWords);
  u32(124, plan.generationId);
  u32(128, plan.deviceOrdinal);
  u32(132, plan.laneOrdinal);
  u32(136, plan.leaseToken);
  u32(140, plan.sourceFamilyId);
  u32(144, plan.storageGeneration);
  u32(148, plan.physicsTick);
  u32(152, plan.physicsSubstep);
  u32(156, plan.positionEpoch);
  u32(160, plan.topologyEpoch);
  u32(164, plan.chartEpoch);
  u32(168, plan.levelEpoch);
  u32(172, plan.supportEpoch);
  u32(176, plan.completionOrdinal);
  u32(180, hierarchyView.completionOrdinal);
  u32(184, fineFieldView.completionOrdinal);
  u32(188, coarseFieldView.completionOrdinal);
  u32(192, SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_WORKGROUP_SIZE);
  u32(196, plan.exactLevelCount);
  u32(200, plan.requiredWords);
  u32(204, maxComputeWorkgroupsPerDimension);
  return data;
}

function dispatchShapeForInvocationCount(
  invocationCount,
  maxComputeWorkgroupsPerDimension
) {
  const groupCount = Math.max(
    1,
    Math.ceil(
      positiveInteger(invocationCount, 'parent-field invocationCount')
        / SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_WORKGROUP_SIZE
    )
  );
  const dispatchX = Math.min(groupCount, maxComputeWorkgroupsPerDimension);
  const dispatchY = Math.ceil(groupCount / dispatchX);
  if (dispatchY > maxComputeWorkgroupsPerDimension) {
    throw new RangeError(
      'spatial parent-field dispatch exceeds '
      + 'maxComputeWorkgroupsPerDimension squared'
    );
  }
  return Object.freeze([dispatchX, dispatchY, 1]);
}

function encodePass(encoder, pipeline, bindGroup, workgroups, label) {
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...workgroups);
  pass.end();
  return 1;
}

const IDENTITY_FIELDS = Object.freeze([
  'generationId',
  'deviceOrdinal',
  'laneOrdinal',
  'leaseToken',
  'sourceFamilyId',
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);

function exactIdentityMatches(view, authority) {
  return IDENTITY_FIELDS.every((field) => Object.is(view?.[field], authority?.[field]));
}

function executionSubmissionState(execution, encodedStatus, submittedStatus) {
  let owned = false;
  let submittedByOwner = false;
  try {
    owned = execution?.ownerRuntime?.ownsExecution?.(execution) === true;
    submittedByOwner = execution?.ownerRuntime?.isExecutionSubmitted?.(execution) === true;
  } catch {
    owned = false;
    submittedByOwner = false;
  }
  if (!owned || execution?.released === true) return null;
  if (
    execution.status === encodedStatus
    && execution.submitPerformed === false
    && submittedByOwner === false
  ) return 'encoded';
  if (
    execution.status === submittedStatus
    && execution.submitPerformed === true
    && submittedByOwner === true
  ) return 'submitted';
  return null;
}

export function createSchroederSpatialParentFieldViewGpu(device, {
  fineGrid,
  coarseGrid,
  fineFieldCapacity,
  coarseFieldCapacity,
  arenaCount = 2,
  label = 'ulg-schroeder-spatial-parent-field-view'
} = {}) {
  assertDevice(device);
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const template = createSchroederSpatialParentFieldViewPlan({
    fineLevel: 0,
    coarseLevel: 1,
    fineGrid,
    coarseGrid,
    fineFieldCapacity,
    coarseFieldCapacity,
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
  const maxUniformBufferBindingSize = positiveInteger(
    device.limits?.maxUniformBufferBindingSize ?? 64 * 1024,
    'device.limits.maxUniformBufferBindingSize',
    Number.MAX_SAFE_INTEGER
  );
  if (maxUniformBufferBindingSize < SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_PARAMS_BYTES) {
    throw new RangeError('spatial parent-field params exceed the uniform-buffer limit');
  }
  const maxStorageBuffersPerShaderStage = positiveInteger(
    device.limits?.maxStorageBuffersPerShaderStage ?? 8,
    'device.limits.maxStorageBuffersPerShaderStage',
    0xffff
  );
  if (maxStorageBuffersPerShaderStage < 8) {
    throw new RangeError('spatial parent-field finalization requires eight storage bindings');
  }
  for (const [role, byteLength] of [
    ['parent-field view', template.layout.byteLength],
    ['parent-field candidate keys', template.layout.candidateKeyByteLength],
    ['parent-field candidate map', template.layout.candidateMapByteLength],
    ['parent-field fine counts', template.layout.fineCountByteLength]
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
    template.fineFieldCapacity,
    template.coarseFieldCapacity,
    template.candidateCapacity,
    template.parentFieldCapacity
  ]) {
    dispatchShapeForInvocationCount(
      count,
      maxComputeWorkgroupsPerDimension
    );
  }

  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: schroederSpatialParentFieldViewWgsl
  });
  const pipeline = (entryPoint) => device.createComputePipeline({
    label: `${label}-${entryPoint.replaceAll('_', '-')}-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  const pipelines = Object.freeze({
    emitFine: pipeline('emit_fine_parent_candidates'),
    emitCoarse: pipeline('emit_coarse_native_candidates'),
    materialize: pipeline('materialize_candidate_union_indices'),
    assemble: pipeline('assemble_parent_field_keys'),
    scatterFine: pipeline('scatter_fine_field_edges'),
    finalize: pipeline('finalize_parent_field_view')
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
    return {
      arenaIndex,
      inUse: false,
      token: null,
      paramsBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-params`,
        SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      candidateKeyBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-candidate-keys`,
        template.layout.candidateKeyByteLength,
        storageUsage
      ),
      candidateUnionIndexBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-candidate-union-indices`,
        template.layout.candidateMapByteLength,
        storageUsage
      ),
      fineEdgeCountBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-fine-edge-counts`,
        template.layout.fineCountByteLength,
        storageUsage
      ),
      fineEdgeOffsetBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-fine-edge-offsets`,
        template.layout.fineCountByteLength,
        storageUsage
      ),
      parentFieldViewBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-view`,
        template.layout.byteLength,
        storageUsage | GPU_BUFFER_USAGE.INDIRECT
      ),
      radix: createWebGpuStableRadixScanUnique(device, {
        maxElementCount: template.layout.candidateCapacity,
        maxKeyWordCount: SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS,
        label: `${arenaLabel}-radix`,
        maxComputeWorkgroupsPerDimension,
        retainConstantScanParamsBuffers: true,
        retainVariableScanParamsBuffers: true,
        retainedParamsSlotCount: 1
      }),
      edgeScan: createWebGpuU32ExclusiveScan(device, {
        maxElementCount: template.layout.fineFieldCapacity,
        fixedElementCount: template.layout.fineFieldCapacity,
        retainParamsBuffer: true,
        label: `${arenaLabel}-fine-edge-scan`
      })
    };
  });

  const arenaBuffers = (arena) => [
    arena.paramsBuffer,
    arena.candidateKeyBuffer,
    arena.candidateUnionIndexBuffer,
    arena.fineEdgeCountBuffer,
    arena.fineEdgeOffsetBuffer,
    arena.parentFieldViewBuffer
  ];
  const allocationEntriesForArena = (arena) => [
    ...arenaBuffers(arena).map((buffer) => ({
      role: 'parent-field-view-arena-buffer',
      arenaIndex: arena.arenaIndex,
      buffer
    })),
    ...arena.radix.allocationEntries().map((entry) => ({
      ...entry,
      role: `parent-field-${entry.role}`,
      arenaIndex: arena.arenaIndex
    })),
    ...arena.edgeScan.allocationEntries().map((entry) => ({
      ...entry,
      role: `parent-field-edge-${entry.role}`,
      arenaIndex: arena.arenaIndex
    }))
  ];
  const retainedGpuBufferBytes = arenas.reduce((total, arena) => (
    total + allocationEntriesForArena(arena).reduce(
      (sum, entry) => sum + Number(entry.buffer?.size ?? 0),
      0
    )
  ), 0);

  function acquireArena() {
    if (destroyed) throw new Error('spatial parent-field runtime is destroyed');
    const arena = arenas.find((candidate) => candidate.inUse === false);
    if (!arena) {
      const error = new Error('spatial parent-field arenas are under backpressure');
      error.code = 'ERR_SCHROEDER_PARENT_FIELD_VIEW_ARENA_EXHAUSTED';
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

  function assertExactInputs(mechanicsFieldViews, hierarchyView) {
    if (!Array.isArray(mechanicsFieldViews) || mechanicsFieldViews.length !== 2) {
      throw new RangeError(
        'spatial parent-field topology requires exactly two mechanics field views'
      );
    }
    const [fineFieldView, coarseFieldView] = mechanicsFieldViews;
    const hierarchyState = executionSubmissionState(
      hierarchyView,
      'schroeder-spatial-hierarchy-view-gpu-encoded',
      'schroeder-spatial-hierarchy-view-gpu-build-submitted'
    );
    const fineState = executionSubmissionState(
      fineFieldView,
      'schroeder-spatial-mechanics-field-view-gpu-encoded',
      'schroeder-spatial-mechanics-field-view-gpu-build-submitted'
    );
    const coarseState = executionSubmissionState(
      coarseFieldView,
      'schroeder-spatial-mechanics-field-view-gpu-encoded',
      'schroeder-spatial-mechanics-field-view-gpu-build-submitted'
    );
    if (
      hierarchyView?.schema !== ULG_SCHROEDER_SPATIAL_HIERARCHY_VIEW_SCHEMA
      || fineFieldView?.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
      || coarseFieldView?.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
      || !hierarchyState
      || fineState !== hierarchyState
      || coarseState !== hierarchyState
      || hierarchyView.fineLevel !== fineFieldView.selectedLevel
      || hierarchyView.coarseLevel !== coarseFieldView.selectedLevel
      || coarseFieldView.selectedLevel !== fineFieldView.selectedLevel + 1
      || coarseFieldView.gridSpacingM
        !== Math.fround(fineFieldView.gridSpacingM * 2)
      || hierarchyView.fineMechanicsView !== fineFieldView.parentMechanicsView
      || hierarchyView.coarseMechanicsView !== coarseFieldView.parentMechanicsView
      || fineFieldView.fieldCapacity !== template.fineFieldCapacity
      || coarseFieldView.fieldCapacity !== template.coarseFieldCapacity
      || !exactIdentityMatches(fineFieldView, hierarchyView)
      || !exactIdentityMatches(coarseFieldView, hierarchyView)
      || !webGpuBufferMatchesDevice(hierarchyView.hierarchyViewBuffer, device)
      || !webGpuBufferMatchesDevice(fineFieldView.fieldViewBuffer, device)
      || !webGpuBufferMatchesDevice(coarseFieldView.fieldViewBuffer, device)
      || !webGpuBufferMatchesDevice(fineFieldView.sourceBuffer, device)
      || coarseFieldView.sourceBuffer !== fineFieldView.sourceBuffer
      || coarseFieldView.identityBuffer !== fineFieldView.identityBuffer
    ) {
      throw new TypeError(
        'spatial parent-field view requires exact live two-level fields and hierarchy from one generation'
      );
    }
    for (const [fieldView, expectedGrid] of [
      [fineFieldView, template.fineGrid],
      [coarseFieldView, template.coarseGrid]
    ]) {
      if (
        fieldView.gridNodeCount !== expectedGrid.gridNodeCount
        || fieldView.gridShift !== expectedGrid.gridShift
        || fieldView.gridSpacingM !== expectedGrid.gridSpacingM
        || Array.from(fieldView.gridDims || []).length !== 3
        || Array.from(fieldView.gridDims || []).some(
          (value, axis) => value !== expectedGrid.gridDims[axis]
        )
      ) {
        throw new TypeError(
          'spatial parent-field view requires exact retained fine/coarse grid descriptors'
        );
      }
    }
    return { fineFieldView, coarseFieldView, parentSubmissionState: hierarchyState };
  }

  function encode(encoder, {
    mechanicsFieldViews,
    hierarchyView
  } = {}) {
    assertEncoder(encoder);
    const {
      fineFieldView,
      coarseFieldView,
      parentSubmissionState
    } = assertExactInputs(mechanicsFieldViews, hierarchyView);
    const plan = createSchroederSpatialParentFieldViewPlan({
      fineLevel: fineFieldView.selectedLevel,
      coarseLevel: coarseFieldView.selectedLevel,
      levelCount: mechanicsFieldViews.length,
      fineGrid: gridFromFieldView(fineFieldView),
      coarseGrid: gridFromFieldView(coarseFieldView),
      fineFieldCapacity: fineFieldView.fieldCapacity,
      coarseFieldCapacity: coarseFieldView.fieldCapacity,
      generationId: hierarchyView.generationId,
      deviceOrdinal: hierarchyView.deviceOrdinal,
      laneOrdinal: hierarchyView.laneOrdinal,
      leaseToken: hierarchyView.leaseToken,
      sourceFamilyId: hierarchyView.sourceFamilyId,
      storageGeneration: hierarchyView.storageGeneration,
      physicsTick: hierarchyView.physicsTick,
      physicsSubstep: hierarchyView.physicsSubstep,
      positionEpoch: hierarchyView.positionEpoch,
      topologyEpoch: hierarchyView.topologyEpoch,
      chartEpoch: hierarchyView.chartEpoch,
      levelEpoch: hierarchyView.levelEpoch,
      supportEpoch: hierarchyView.supportEpoch,
      completionOrdinal: hierarchyView.completionOrdinal
    });
    const { arena, token } = acquireArena();
    let radixUnique = null;
    try {
      device.queue.writeBuffer(
        arena.paramsBuffer,
        0,
        parentFieldParamsData(
          plan,
          hierarchyView,
          fineFieldView,
          coarseFieldView,
          maxComputeWorkgroupsPerDimension
        )
      );
      for (const buffer of [
        arena.candidateUnionIndexBuffer,
        arena.fineEdgeCountBuffer,
        arena.fineEdgeOffsetBuffer,
        arena.parentFieldViewBuffer
      ]) encoder.clearBuffer(buffer);
      const resources = new Map([
        [0, fineFieldView.fieldViewBuffer],
        [1, coarseFieldView.fieldViewBuffer],
        [2, hierarchyView.hierarchyViewBuffer],
        [3, arena.candidateKeyBuffer],
        [4, arena.candidateUnionIndexBuffer],
        [5, arena.fineEdgeCountBuffer],
        [6, arena.fineEdgeOffsetBuffer],
        [7, arena.parentFieldViewBuffer],
        [12, arena.paramsBuffer]
      ]);
      const group = (pipelineObject, bindings, suffix, source = resources) => (
        createBindings(
          pipelineObject,
          source,
          bindings,
          `${label}-arena-${arena.arenaIndex}-${suffix}-bindings`
        )
      );
      let encodedDispatchCount = 0;
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.emitFine,
        group(pipelines.emitFine, [0, 2, 3, 5, 7, 12], 'emit-fine'),
        dispatchShapeForInvocationCount(
          plan.fineFieldCapacity,
          maxComputeWorkgroupsPerDimension
        ),
        `${label}EmitFineParentCandidates`
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.emitCoarse,
        group(pipelines.emitCoarse, [1, 2, 3, 7, 12], 'emit-coarse'),
        dispatchShapeForInvocationCount(
          plan.coarseFieldCapacity,
          maxComputeWorkgroupsPerDimension
        ),
        `${label}EmitCoarseNativeCandidates`
      );
      radixUnique = arena.radix.encodeSortUnique(encoder, {
        keyBuffer: arena.candidateKeyBuffer,
        elementCount: plan.candidateCapacity,
        keyWordCount: SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS,
        keyStrideWords: SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS,
        generationId: plan.generationId,
        consumerWorkgroupSize: SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_WORKGROUP_SIZE,
        retainedParamsSlotIndex: 0
      });
      encodedDispatchCount += radixUnique.encodedDispatchCount;
      const radixResources = new Map([
        ...resources,
        [8, radixUnique.uniqueKeysBuffer],
        [9, radixUnique.uniqueEvidenceBuffer],
        [10, radixUnique.sortedIndicesBuffer],
        [11, radixUnique.uniqueGroupIndexBySortedPositionBuffer]
      ]);
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.materialize,
        group(
          pipelines.materialize,
          [3, 4, 7, 9, 10, 11, 12],
          'materialize-map',
          radixResources
        ),
        dispatchShapeForInvocationCount(
          plan.candidateCapacity,
          maxComputeWorkgroupsPerDimension
        ),
        `${label}MaterializeCandidateUnionMap`
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.assemble,
        group(
          pipelines.assemble,
          [7, 8, 9, 12],
          'assemble-keys',
          radixResources
        ),
        dispatchShapeForInvocationCount(
          plan.parentFieldCapacity,
          maxComputeWorkgroupsPerDimension
        ),
        `${label}AssembleParentFieldKeys`
      );
      const edgeScan = arena.edgeScan.prepare({
        inputBuffer: arena.fineEdgeCountBuffer,
        outputBuffer: arena.fineEdgeOffsetBuffer,
        elementCount: plan.fineFieldCapacity
      });
      arena.edgeScan.encodePrepared(encoder, edgeScan, {
        labelPrefix: `${label}FineFieldEdges`
      });
      encodedDispatchCount += edgeScan.encodedDispatchCount;
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.scatterFine,
        group(
          pipelines.scatterFine,
          [0, 2, 4, 5, 6, 7, 12],
          'scatter-fine',
          radixResources
        ),
        dispatchShapeForInvocationCount(
          plan.fineFieldCapacity,
          maxComputeWorkgroupsPerDimension
        ),
        `${label}ScatterFineFieldEdges`
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.finalize,
        group(
          pipelines.finalize,
          [0, 1, 2, 5, 6, 7, 8, 9, 12],
          'finalize',
          radixResources
        ),
        [1, 1, 1],
        `${label}Finalize`
      );
      const execution = {
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
        status: 'schroeder-spatial-parent-field-view-gpu-encoded',
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        mechanicsFieldViews: Object.freeze([fineFieldView, coarseFieldView]),
        fineFieldView,
        coarseFieldView,
        hierarchyView,
        parentSubmissionState,
        parentFieldViewBuffer: arena.parentFieldViewBuffer,
        candidateKeyBuffer: arena.candidateKeyBuffer,
        candidateUnionIndexBuffer: arena.candidateUnionIndexBuffer,
        fineEdgeCountBuffer: arena.fineEdgeCountBuffer,
        fineEdgeOffsetBuffer: arena.fineEdgeOffsetBuffer,
        indirectDispatchBuffer: arena.parentFieldViewBuffer,
        indirectDispatchOffsetBytes:
          SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_DISPATCH_OFFSET_WORDS * UINT32_BYTES,
        fineIndirectDispatchBuffer: arena.parentFieldViewBuffer,
        fineIndirectDispatchOffsetBytes:
          SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_FINE_DISPATCH_OFFSET_WORDS
            * UINT32_BYTES,
        coarseIndirectDispatchBuffer: arena.parentFieldViewBuffer,
        coarseIndirectDispatchOffsetBytes:
          SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS
            * UINT32_BYTES,
        encodedDispatchCount,
        encodedComputePassCount: 6
          + radixUnique.encodedComputePassCount
          + edgeScan.encodedComputePassCount,
        maxComputeWorkgroupsPerDimension,
        retainedGpuBufferBytes,
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        readbackPerformed: false,
        submitPerformed: false,
        submissionOwnership: 'caller',
        topology: 'field-aware-two-level-parent-union-weighted-csr',
        transferStateStatus: 'topology-only-no-mechanics-state-transfer'
      };
      Object.defineProperty(execution, 'ownerRuntime', {
        value: runtime,
        enumerable: false
      });
      Object.defineProperty(execution, 'released', {
        get() { return releasedExecutions.has(execution); },
        enumerable: true
      });
      executionOwnership.set(execution, {
        arena,
        token,
        radixUnique,
        hierarchyView,
        fineFieldView,
        coarseFieldView
      });
      return execution;
    } catch (error) {
      if (radixUnique) {
        try {
          arena.radix.releaseExecution(radixUnique, { discardedEncoder: true });
        } catch {
          // Preserve the original encoding error.
        }
      }
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
      || execution.parentFieldViewBuffer !== ownership.arena.parentFieldViewBuffer
      || execution.hierarchyView !== ownership.hierarchyView
      || execution.fineFieldView !== ownership.fineFieldView
      || execution.coarseFieldView !== ownership.coarseFieldView
    ) {
      const error = new Error('spatial parent-field execution is not owned by this runtime');
      error.code = 'ERR_SCHROEDER_PARENT_FIELD_VIEW_FOREIGN_EXECUTION';
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

  function parentsAreSubmitted(ownership) {
    return [
      ownership.hierarchyView,
      ownership.fineFieldView,
      ownership.coarseFieldView
    ].every((parent) => {
      try {
        return parent.ownerRuntime?.ownsExecution?.(parent) === true
          && parent.ownerRuntime?.isExecutionSubmitted?.(parent) === true;
      } catch {
        return false;
      }
    });
  }

  function markExecutionSubmitted(execution) {
    const ownership = ownershipFor(execution);
    if (submittedExecutions.has(execution)) return false;
    if (!parentsAreSubmitted(ownership)) {
      throw new Error(
        'spatial parent-field parents must be marked submitted before the child'
      );
    }
    submittedExecutions.add(execution);
    Object.defineProperty(execution, 'submitPerformed', {
      value: true,
      enumerable: true
    });
    Object.defineProperty(execution, 'status', {
      value: 'schroeder-spatial-parent-field-view-gpu-build-submitted',
      enumerable: true
    });
    return true;
  }

  function isExecutionSubmitted(execution) {
    return submittedExecutions.has(execution)
      && ownsExecution(execution)
      && execution.submitPerformed === true;
  }

  function finalizeRelease(execution, ownership, { radixReleased = false } = {}) {
    if (!radixReleased) {
      ownership.arena.radix.releaseExecution(
        ownership.radixUnique,
        { discardedEncoder: true }
      );
    }
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
      throw new Error('submitted spatial parent-field view requires a queue fence');
    }
    return finalizeRelease(execution, ownershipFor(execution));
  }

  async function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    const ownership = ownershipFor(execution);
    if (!submittedExecutions.has(execution)) {
      throw new Error('unsubmitted spatial parent-field view requires discarded release');
    }
    releaseInFlight.add(execution);
    try {
      await ownership.arena.radix.releaseExecutionAfter(
        ownership.radixUnique,
        submissionFence
      );
      return finalizeRelease(execution, ownership, { radixReleased: true });
    } finally {
      releaseInFlight.delete(execution);
    }
  }

  function activeExecutionCount() {
    return arenas.reduce((count, arena) => count + (arena.inUse ? 1 : 0), 0);
  }

  function destroy() {
    if (destroyed) return false;
    if (arenas.some((arena) => arena.inUse)) {
      throw new Error('spatial parent-field runtime still has active executions');
    }
    destroyed = true;
    for (const arena of arenas) {
      for (const buffer of arenaBuffers(arena)) buffer.destroy?.();
      arena.radix.destroy();
      arena.edgeScan.destroy();
    }
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
    status: 'schroeder-spatial-parent-field-view-gpu-runtime-ready',
    deviceId,
    arenaCount: resolvedArenaCount,
    fineGrid: template.fineGrid,
    coarseGrid: template.coarseGrid,
    fineFieldCapacity: template.fineFieldCapacity,
    coarseFieldCapacity: template.coarseFieldCapacity,
    layout: template.layout,
    pipelineCount: Object.keys(pipelines).length + arenas.reduce(
      (sum, arena) => sum + arena.radix.pipelineCount + arena.edgeScan.pipelineCount,
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
    allocationEntries: () => arenas.flatMap(allocationEntriesForArena),
    destroy
  };
  return runtime;
}

export {
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_FINE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS,
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
  schroederSpatialParentFieldViewWgsl
};
