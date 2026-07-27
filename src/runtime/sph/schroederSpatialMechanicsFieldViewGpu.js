import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PARAMS_BYTES,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
  createSchroederSpatialMechanicsFieldViewPlan
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  schroederSpatialMechanicsFieldViewWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldViewWgsl.js';
import {
  ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  createWebGpuStableRadixScanUnique
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
// The published field ABI remains lexicographic u32x4.  The radix scratch key
// packs the bounded family/material pair into one word, preserving that exact
// order while eliminating eight radix digit rounds per generation.
const FIELD_RADIX_KEY_WORDS = 3;
// The current maximum production mechanics histogram is 7,776 rows. In that
// bounded band one exact GPU invocation removes one command boundary per radix
// digit; larger/general histograms retain the parallel scan.
const FIELD_SERIAL_HISTOGRAM_SCAN_MAX_ELEMENT_COUNT = 8_192;

function positiveInteger(value, label, max = 0xffff_ffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function dispatchShapeForInvocationCount(
  invocationCount,
  workgroupSize,
  maxComputeWorkgroupsPerDimension,
  label
) {
  const count = positiveInteger(invocationCount, `${label} invocationCount`);
  const width = positiveInteger(workgroupSize, `${label} workgroupSize`, 1024);
  const maxDimension = positiveInteger(
    maxComputeWorkgroupsPerDimension,
    `${label} maxComputeWorkgroupsPerDimension`
  );
  const groupCount = Math.ceil(count / width);
  const x = Math.min(groupCount, maxDimension);
  const y = Math.ceil(groupCount / x);
  if (y > maxDimension) {
    throw new RangeError(
      `${label} dispatch requires ${groupCount} workgroups beyond `
      + `${maxDimension}x${maxDimension}`
    );
  }
  return Object.freeze([x, y, 1]);
}

function assertDevice(device) {
  if (
    !device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer
  ) {
    throw new TypeError('mechanics field view requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
    throw new TypeError('mechanics field view encoding requires a GPUCommandEncoder-like object');
  }
}

function createOwnedBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function fieldParamsData(plan, parentExecution, {
  sourceDispatchWorkgroups,
  candidateDispatchWorkgroups,
  dispatchXLimit
}) {
  const data = new ArrayBuffer(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (offset, value) => view.setUint32(offset, Number(value) >>> 0, true);
  const i32 = (offset, value) => view.setInt32(offset, Number(value) | 0, true);
  const f32 = (offset, value) => view.setFloat32(offset, Math.fround(Number(value)), true);
  u32(0, plan.sourceCount);
  u32(4, plan.sourceCapacity);
  u32(8, plan.sourceRowStrideFloats);
  u32(12, plan.sourceRowLayoutId);
  u32(16, plan.identityStrideWords);
  i32(20, plan.selectedLevel);
  u32(24, plan.gridNodeCount);
  u32(28, plan.gridDims[0]);
  u32(32, plan.gridDims[1]);
  u32(36, plan.gridDims[2]);
  u32(40, plan.gridShift);
  u32(44, plan.candidateCount);
  u32(48, plan.fieldCapacity);
  u32(52, plan.generationId);
  u32(56, plan.deviceOrdinal);
  u32(60, plan.laneOrdinal);
  u32(64, plan.leaseToken);
  u32(68, plan.sourceFamilyId);
  u32(72, plan.storageGeneration);
  u32(76, plan.physicsTick);
  u32(80, plan.physicsSubstep);
  u32(84, plan.positionEpoch);
  u32(88, plan.topologyEpoch);
  u32(92, plan.chartEpoch);
  u32(96, plan.levelEpoch);
  u32(100, plan.supportEpoch);
  u32(104, plan.completionOrdinal);
  u32(108, plan.layout.descriptorOffsetWords);
  u32(112, plan.layout.descriptorWords);
  u32(116, plan.layout.keyOffsetWords);
  u32(120, plan.layout.keyWords);
  u32(124, plan.layout.accumulatorOffsetWords);
  u32(128, plan.layout.accumulatorWords);
  u32(132, plan.layout.stateOffsetWords);
  u32(136, plan.layout.stateWords);
  u32(140, plan.layout.wordLength);
  f32(144, plan.gridSpacingM);
  f32(148, 1 / plan.gridSpacingM);
  u32(152, parentExecution.layout.wordLength);
  u32(156, parentExecution.nodeCapacity);
  u32(160, SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE);
  u32(164, 27);
  // The former route-control words are retained inside the same private
  // 192-byte parameter ABI and now authenticate direct 2D dispatch shapes.
  u32(168, sourceDispatchWorkgroups[0]);
  u32(172, candidateDispatchWorkgroups[0]);
  u32(176, dispatchXLimit);
  u32(180, sourceDispatchWorkgroups[1]);
  u32(184, candidateDispatchWorkgroups[1]);
  u32(188, 0);
  return data;
}

function beginTimestampSpan(gpuTimestampRecorder, encoder, descriptor) {
  return gpuTimestampRecorder?.active === true
    && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
    ? gpuTimestampRecorder.beginEncoderSpan(encoder, descriptor)
    : null;
}

function endTimestampSpan(gpuTimestampRecorder, encoder, token) {
  if (!token) return;
  gpuTimestampRecorder.endEncoderSpan(encoder, token);
}

function encodePass(
  encoder,
  pipeline,
  bindGroup,
  workgroups,
  label,
  gpuTimestampRecorder = null,
  timestampDescriptor = null
) {
  const timestampSpan = timestampDescriptor
    ? beginTimestampSpan(gpuTimestampRecorder, encoder, timestampDescriptor)
    : null;
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...workgroups);
  pass.end();
  endTimestampSpan(gpuTimestampRecorder, encoder, timestampSpan);
  return 1;
}

function encodeIndirectPass(
  encoder,
  pipeline,
  bindGroup,
  indirectBuffer,
  indirectOffsetBytes,
  label,
  gpuTimestampRecorder = null,
  timestampDescriptor = null
) {
  const timestampSpan = timestampDescriptor
    ? beginTimestampSpan(gpuTimestampRecorder, encoder, timestampDescriptor)
    : null;
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
    throw new TypeError('mechanics field route requires indirect compute dispatch support');
  }
  pass.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffsetBytes);
  pass.end();
  endTimestampSpan(gpuTimestampRecorder, encoder, timestampSpan);
  return 1;
}

export function createSchroederSpatialMechanicsFieldViewGpu(device, {
  maxSourceCount,
  gridNodeCount,
  gridDims,
  gridShift,
  gridSpacingM,
  identityStrideWords = 1,
  arenaCount = 2,
  label = 'ulg-schroeder-spatial-mechanics-field-view'
} = {}) {
  assertDevice(device);
  const resolvedMaxSourceCount = positiveInteger(maxSourceCount, 'maxSourceCount');
  const resolvedIdentityStrideWords = positiveInteger(
    identityStrideWords,
    'identityStrideWords',
    16
  );
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const template = createSchroederSpatialMechanicsFieldViewPlan({
    sourceCount: 1,
    sourceCapacity: resolvedMaxSourceCount,
    identityStrideWords: resolvedIdentityStrideWords,
    selectedLevel: 0,
    gridNodeCount,
    gridDims,
    gridShift,
    gridSpacingM,
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
  const maxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension',
    65535
  );
  const candidateKeyByteLength = template.layout.candidateCapacity
    * FIELD_RADIX_KEY_WORDS
    * UINT32_BYTES;
  const sourceByteLength = resolvedMaxSourceCount * 16 * Float32Array.BYTES_PER_ELEMENT;
  const identityByteLength = resolvedMaxSourceCount
    * resolvedIdentityStrideWords
    * UINT32_BYTES;
  for (const [role, byteLength] of [
    ['mechanics field view', template.layout.byteLength],
    ['mechanics field candidates', candidateKeyByteLength],
    ['mechanics field source', sourceByteLength],
    ['mechanics field identity', identityByteLength]
  ]) {
    if (byteLength > maxBufferSize || byteLength > maxStorageBufferBindingSize) {
      throw new RangeError(`${role} requires ${byteLength} bytes beyond device capacity`);
    }
  }
  dispatchShapeForInvocationCount(
    resolvedMaxSourceCount,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
    maxComputeWorkgroupsPerDimension,
    'mechanics field source'
  );
  dispatchShapeForInvocationCount(
    template.layout.candidateCapacity,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
    maxComputeWorkgroupsPerDimension,
    'mechanics field candidate'
  );
  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: schroederSpatialMechanicsFieldViewWgsl
  });
  const pipelines = Object.freeze({
    emit: device.createComputePipeline({
      label: `${label}-emit-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'emit_field_candidates' }
    }),
    assemble: device.createComputePipeline({
      label: `${label}-assemble-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'assemble_field_keys' }
    }),
    materializeStencilMap: device.createComputePipeline({
      label: `${label}-materialize-stencil-map-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'materialize_stencil_field_indices' }
    }),
    finalize: device.createComputePipeline({
      label: `${label}-finalize-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'finalize_field_view' }
    })
  });
  const deviceId = webGpuDeviceId(device);
  let destroyed = false;
  let deviceLossObserved = false;
  let serial = 0;
  let runtime = null;
  const executionOwnership = new WeakMap();
  const executionRetirements = new WeakMap();
  const mutationSequenceOwnership = new WeakMap();
  const mutationSegmentOwnership = new WeakMap();
  const mutationTokenSequenceOwnership = new WeakMap();
  const publicationLockOwnership = new WeakMap();
  const publicationCapabilityOwnership = new WeakMap();
  const retiredQuarantineReasons = new WeakMap();
  const releasedExecutions = new WeakSet();
  const submittedExecutions = new WeakSet();
  const releaseInFlight = new WeakSet();

  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const arenaLabel = `${label}-arena-${arenaIndex}`;
    return {
      arenaIndex,
      inUse: false,
      token: null,
      retired: false,
      quarantined: false,
      destroyedOwnedBuffers: new Set(),
      radixDeviceLossRetired: false,
      paramsBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-params`,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      candidateKeyBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-candidate-keys`,
        candidateKeyByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      fieldViewBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-field-view`,
        template.layout.byteLength,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.INDIRECT
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      radix: createWebGpuStableRadixScanUnique(device, {
        maxElementCount: template.layout.candidateCapacity,
        maxKeyWordCount: FIELD_RADIX_KEY_WORDS,
        label: `${arenaLabel}-radix`,
        maxComputeWorkgroupsPerDimension,
        retainConstantScanParamsBuffers: true,
        retainVariableScanParamsBuffers: true,
        serialHistogramScanMaxElementCount:
          FIELD_SERIAL_HISTOGRAM_SCAN_MAX_ELEMENT_COUNT,
        retainedParamsSlotCount: 1
      })
    };
  });

  const allocationEntriesForArena = (arena) => [
    { role: 'mechanics-field-params', arenaIndex: arena.arenaIndex, buffer: arena.paramsBuffer },
    { role: 'mechanics-field-candidate-keys', arenaIndex: arena.arenaIndex, buffer: arena.candidateKeyBuffer },
    { role: 'mechanics-field-view', arenaIndex: arena.arenaIndex, buffer: arena.fieldViewBuffer },
    ...arena.radix.allocationEntries().map((entry) => ({
      ...entry,
      role: `mechanics-field-${entry.role}`,
      arenaIndex: arena.arenaIndex
    }))
  ];
  const retainedGpuBufferBytes = arenas.reduce((sum, arena) => (
    sum + allocationEntriesForArena(arena).reduce(
      (arenaSum, entry) => arenaSum + Number(entry.buffer?.size ?? 0),
      0
    )
  ), 0);

  function acquireArena() {
    if (destroyed) throw new Error('mechanics field view runtime is destroyed');
    if (deviceLossObserved) {
      const error = new Error('mechanics field view runtime observed device loss');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_DEVICE_LOST';
      throw error;
    }
    const arena = arenas.find((candidate) => (
      candidate.inUse === false && candidate.retired !== true
    ));
    if (!arena) {
      const error = new Error('mechanics field view arenas are under backpressure');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_ARENA_EXHAUSTED';
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

  function destroyArenaOwnedBuffersAfterDeviceLoss(arena) {
    const failures = [];
    for (const { buffer } of allocationEntriesForArena(arena)) {
      if (!buffer || arena.destroyedOwnedBuffers.has(buffer)) continue;
      try {
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      } catch (error) {
        if (buffer.destroyed === true) {
          arena.destroyedOwnedBuffers.add(buffer);
        } else {
          failures.push(error);
        }
      }
    }
    if (failures.length > 0) {
      throw failures.length === 1
        ? failures[0]
        : new AggregateError(
          failures,
          'mechanics field device-loss arena retirement was incomplete'
        );
    }
    arena.radixDeviceLossRetired = true;
    return true;
  }

  function createExecutionRetirementRecord(execution, ownership) {
    let resolveCompletion;
    const completionPromise = new Promise((resolve) => {
      resolveCompletion = resolve;
    });
    const record = {
      execution,
      ownership,
      completed: false,
      completionPromise,
      resolveCompletion,
      activeAttempt: null,
      nextAttemptOrdinal: 0,
      deviceLossEvidence: null
    };
    executionRetirements.set(execution, record);
    return record;
  }

  function retirementRecordFor(execution) {
    const record = executionRetirements.get(execution);
    if (
      !record
      || execution?.ownerRuntime !== runtime
      || execution.arenaIndex !== record.ownership.arena.arenaIndex
      || execution.arenaGeneration !== record.ownership.token.serial
    ) {
      const error = new Error(
        'mechanics field view execution is not owned by this runtime'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_FOREIGN_EXECUTION';
      throw error;
    }
    return record;
  }

  function createBindings(pipeline, resources, bindings, bindLabel) {
    return device.createBindGroup({
      label: bindLabel,
      layout: pipeline.getBindGroupLayout(0),
      entries: bindings.map((binding) => ({
        binding,
        resource: resources.get(binding)
      }))
    });
  }

  function encode(encoder, {
    sourceBuffer,
    identityBuffer,
    sourceCount,
    sourceRowLayoutId,
    identityStrideWords: requestedIdentityStrideWords = resolvedIdentityStrideWords,
    selectedLevel,
    parentMechanicsView,
    forceRadixFallback = false,
    gpuTimestampRecorder = null,
    timestampMetadata = {}
  } = {}) {
    assertEncoder(encoder);
    if (!sourceBuffer || !webGpuBufferMatchesDevice(sourceBuffer, device)) {
      throw new TypeError('mechanics field sourceBuffer must belong to the runtime device');
    }
    if (!identityBuffer || !webGpuBufferMatchesDevice(identityBuffer, device)) {
      throw new TypeError('mechanics field identityBuffer must belong to the runtime device');
    }
    const resolvedSourceCount = positiveInteger(
      sourceCount,
      'sourceCount',
      resolvedMaxSourceCount
    );
    const resolvedStride = positiveInteger(
      requestedIdentityStrideWords,
      'identityStrideWords',
      16
    );
    if (resolvedStride !== resolvedIdentityStrideWords) {
      throw new RangeError('mechanics field identity stride does not match the retained runtime');
    }
    if (typeof forceRadixFallback !== 'boolean') {
      throw new TypeError('forceRadixFallback must be a boolean');
    }
    let parentOwned = false;
    try {
      parentOwned = parentMechanicsView?.ownerRuntime?.ownsExecution?.(
        parentMechanicsView
      ) === true;
    } catch {
      parentOwned = false;
    }
    if (
      parentMechanicsView?.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA
      || parentMechanicsView.status !== 'schroeder-spatial-mechanics-view-gpu-encoded'
      || parentMechanicsView.submitPerformed !== false
      || parentMechanicsView.released === true
      || !parentOwned
      || parentMechanicsView.sourceBuffer !== sourceBuffer
      || parentMechanicsView.sourceCount !== resolvedSourceCount
      || parentMechanicsView.sourceRowLayoutId !== sourceRowLayoutId
      || parentMechanicsView.selectedLevel !== selectedLevel
      || parentMechanicsView.gridNodeCount !== template.gridNodeCount
      || parentMechanicsView.gridShift !== template.gridShift
      || !Object.is(parentMechanicsView.gridSpacingM, template.gridSpacingM)
      || Array.from(parentMechanicsView.gridDims || []).length !== 3
      || Array.from(parentMechanicsView.gridDims || []).some(
        (value, axis) => value !== template.gridDims[axis]
      )
      || !webGpuBufferMatchesDevice(parentMechanicsView.mechanicsViewBuffer, device)
    ) {
      throw new TypeError(
        'mechanics field view requires the exact live encoded compact mechanics parent'
      );
    }
    const requiredSourceBytes = resolvedSourceCount * 16 * Float32Array.BYTES_PER_ELEMENT;
    const requiredIdentityBytes = resolvedSourceCount * resolvedStride * UINT32_BYTES;
    if (Number(sourceBuffer.size) < requiredSourceBytes) {
      throw new RangeError('mechanics field sourceBuffer is smaller than the admitted source family');
    }
    if (Number(identityBuffer.size) < requiredIdentityBytes) {
      throw new RangeError('mechanics field identityBuffer is smaller than the admitted source family');
    }
    const plan = createSchroederSpatialMechanicsFieldViewPlan({
      sourceCount: resolvedSourceCount,
      sourceCapacity: resolvedMaxSourceCount,
      sourceRowLayoutId,
      identityStrideWords: resolvedStride,
      selectedLevel,
      gridNodeCount: template.gridNodeCount,
      gridDims: template.gridDims,
      gridShift: template.gridShift,
      gridSpacingM: template.gridSpacingM,
      generationId: parentMechanicsView.generationId,
      deviceOrdinal: parentMechanicsView.deviceOrdinal,
      laneOrdinal: parentMechanicsView.laneOrdinal,
      leaseToken: parentMechanicsView.leaseToken,
      sourceFamilyId: parentMechanicsView.sourceFamilyId,
      storageGeneration: parentMechanicsView.storageGeneration,
      physicsTick: parentMechanicsView.physicsTick,
      physicsSubstep: parentMechanicsView.physicsSubstep,
      positionEpoch: parentMechanicsView.positionEpoch,
      topologyEpoch: parentMechanicsView.topologyEpoch,
      chartEpoch: parentMechanicsView.chartEpoch,
      levelEpoch: parentMechanicsView.levelEpoch,
      supportEpoch: parentMechanicsView.supportEpoch,
      completionOrdinal: parentMechanicsView.completionOrdinal
    });
    const { arena, token } = acquireArena();
    let radixUnique = null;
    try {
      const stageTimestampMetadata = {
        ...timestampMetadata,
        generationId: plan.generationId,
        selectedLevel: plan.selectedLevel,
        sourceCount: plan.sourceCount,
        candidateCount: plan.candidateCount
      };
      const sourceDispatchWorkgroups = dispatchShapeForInvocationCount(
        plan.sourceCount,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
        maxComputeWorkgroupsPerDimension,
        'mechanics field source'
      );
      const candidateDispatchWorkgroups = dispatchShapeForInvocationCount(
        plan.candidateCount,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
        maxComputeWorkgroupsPerDimension,
        'mechanics field candidate'
      );
      encoder.clearBuffer(
        arena.fieldViewBuffer,
        0,
        plan.layout.keyOffsetWords * UINT32_BYTES
      );
      const commonResources = new Map([
        [0, { buffer: sourceBuffer, offset: 0, size: requiredSourceBytes }],
        [1, { buffer: identityBuffer, offset: 0, size: requiredIdentityBytes }],
        [2, { buffer: arena.candidateKeyBuffer }],
        [3, { buffer: arena.fieldViewBuffer }],
        [6, { buffer: parentMechanicsView.mechanicsViewBuffer }],
        [7, { buffer: arena.paramsBuffer }]
      ]);
      const emitBindGroup = createBindings(
        pipelines.emit,
        commonResources,
        [0, 1, 2, 3, 6, 7],
        `${label}-arena-${arena.arenaIndex}-emit-bindings`
      );
      let encodedDispatchCount = encodePass(
        encoder,
        pipelines.emit,
        emitBindGroup,
        sourceDispatchWorkgroups,
        `${label}EmitCandidates`,
        gpuTimestampRecorder,
        {
          producerId: 'schroeder-spatial-mechanics-field-candidate-emission',
          stage: 'candidate-emission',
          spanClass: 'same-production-command-encoder',
          ...stageTimestampMetadata
        }
      );
      radixUnique = arena.radix.encodeSortUnique(encoder, {
        keyBuffer: arena.candidateKeyBuffer,
        elementCount: plan.candidateCount,
        keyWordCount: FIELD_RADIX_KEY_WORDS,
        keyStrideWords: FIELD_RADIX_KEY_WORDS,
        generationId: plan.generationId,
        consumerWorkgroupSize: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
        retainedParamsSlotIndex: 0,
        gpuTimestampRecorder,
        sortTimestampProducerId: 'schroeder-spatial-mechanics-field-radix-sort',
        uniqueTimestampProducerId: 'schroeder-spatial-mechanics-field-radix-unique',
        timestampMetadata: {
          parentProducerId: 'schroeder-spatial-mechanics-field-view-build',
          ...stageTimestampMetadata
        }
      });
      encodedDispatchCount += radixUnique.encodedDispatchCount;
      const finalResources = new Map([
        ...commonResources,
        [4, { buffer: radixUnique.uniqueKeysBuffer }],
        [5, { buffer: radixUnique.uniqueEvidenceBuffer }],
        [8, { buffer: radixUnique.sortedIndicesBuffer }],
        [9, { buffer: radixUnique.uniqueGroupIndexBySortedPositionBuffer }]
      ]);
      const stencilMapBindGroup = createBindings(
        pipelines.materializeStencilMap,
        finalResources,
        [2, 3, 5, 7, 8, 9],
        `${label}-arena-${arena.arenaIndex}-stencil-map-bindings`
      );
      const assembleBindGroup = createBindings(
        pipelines.assemble,
        finalResources,
        [3, 4, 5, 6, 7],
        `${label}-arena-${arena.arenaIndex}-assemble-bindings`
      );
      const finalizeBindGroup = createBindings(
        pipelines.finalize,
        finalResources,
        [3, 4, 5, 6, 7],
        `${label}-arena-${arena.arenaIndex}-finalize-bindings`
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.materializeStencilMap,
        stencilMapBindGroup,
        candidateDispatchWorkgroups,
        `${label}MaterializeStencilMap`,
        gpuTimestampRecorder,
        {
          producerId: 'schroeder-spatial-mechanics-field-stencil-map',
          stage: 'stencil-map',
          spanClass: 'same-production-command-encoder',
          ...stageTimestampMetadata
        }
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.assemble,
        assembleBindGroup,
        candidateDispatchWorkgroups,
        `${label}AssembleKeys`,
        gpuTimestampRecorder,
        {
          producerId: 'schroeder-spatial-mechanics-field-key-assembly',
          stage: 'key-assembly',
          spanClass: 'same-production-command-encoder',
          ...stageTimestampMetadata
        }
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.finalize,
        finalizeBindGroup,
        [1, 1, 1],
        `${label}Finalize`,
        gpuTimestampRecorder,
        {
          producerId: 'schroeder-spatial-mechanics-field-finalize',
          stage: 'finalize',
          spanClass: 'same-production-command-encoder',
          ...stageTimestampMetadata
        }
      );
      device.queue.writeBuffer(
        arena.paramsBuffer,
        0,
        fieldParamsData(plan, parentMechanicsView, {
          sourceDispatchWorkgroups,
          candidateDispatchWorkgroups,
          dispatchXLimit: maxComputeWorkgroupsPerDimension
        })
      );
      const execution = {
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
        status: 'schroeder-spatial-mechanics-field-view-gpu-encoded',
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        sourceBuffer,
        identityBuffer,
        parentMechanicsView,
        candidateKeyBuffer: arena.candidateKeyBuffer,
        stableCandidateOrderBuffer: radixUnique.sortedIndicesBuffer,
        stableCandidateOrderCount: plan.candidateCount,
        stableCandidateOrderPolicy:
          'stable-radix-equal-key-preserves-particle-stencil-candidate-order',
        ownsStableCandidateOrderBuffer: false,
        radixSortKeyWordCount: FIELD_RADIX_KEY_WORDS,
        radixHistogramScanMode: radixUnique.histogramScanMode,
        routeControlBuffer: null,
        routeControlWordLength: 0,
        routeDispatchOffsetWords: 0,
        radixGateOffsetWords: 0,
        radixGateCount: 0,
        forceRadixFallbackRequested: forceRadixFallback,
        constructionRoutePolicy: 'gpu-authenticated-direct-exact-radix',
        directDispatchLinearization:
          'linearGroup=workgroup.x+workgroup.y*dispatchX',
        sourceDispatchWorkgroups,
        candidateDispatchWorkgroups,
        maxComputeWorkgroupsPerDimension,
        constructionDispatchEvidence: Object.freeze({
          workgroupSize:
            SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
          linearization:
            'linearGroup=workgroup.x+workgroup.y*dispatchX',
          maxComputeWorkgroupsPerDimension,
          sourceInvocationCount: plan.sourceCount,
          sourceWorkgroups: sourceDispatchWorkgroups,
          candidateInvocationCount: plan.candidateCount,
          candidateWorkgroups: candidateDispatchWorkgroups,
          authenticatedByGpuFinalizer: true
        }),
        consumerDispatchWorkgroupSize:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
        consumerDispatchDimensions: 2,
        consumerDispatchLinearization:
          'linearGroup=workgroup.x+workgroup.y*dispatchX',
        consumerDispatchCapacityPolicy:
          'gpu-finalized-device-limit-bounded-x-y-zero-on-reject',
        fieldViewBuffer: arena.fieldViewBuffer,
        indirectDispatchBuffer: arena.fieldViewBuffer,
        indirectDispatchOffsetBytes:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS * UINT32_BYTES,
        encodedDispatchCount,
        encodedComputePassCount: 4 + radixUnique.encodedComputePassCount,
        retainedGpuBufferBytes,
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        readbackPerformed: false,
        submitPerformed: false,
        submissionOwnership: 'caller',
        uniqueOrdering: 'stable-lexicographic-u32x4'
      };
      Object.defineProperty(execution, 'ownerRuntime', {
        value: runtime,
        enumerable: false
      });
      Object.defineProperty(execution, 'released', {
        get() {
          return releasedExecutions.has(execution);
        },
        enumerable: true
      });
      const ownership = {
        arena,
        token,
        radixUnique,
        stableCandidateOrderBuffer: radixUnique.sortedIndicesBuffer,
        stableCandidateOrderCount: plan.candidateCount,
        stableCandidateOrderPolicy:
          'stable-radix-equal-key-preserves-particle-stencil-candidate-order',
        sourceBuffer,
        identityBuffer,
        parentMechanicsView,
        stateMutation: {
          ordinal: 0,
          encoding: 0,
          operation: 'topology-ready',
          pending: null,
          publicationLock: null,
          quarantined: false,
          quarantineReason: null
        }
      };
      executionOwnership.set(execution, ownership);
      createExecutionRetirementRecord(execution, ownership);
      Object.defineProperties(execution, {
        stateMutationOrdinal: {
          get() {
            return executionOwnership.get(execution)?.stateMutation?.ordinal ?? null;
          },
          enumerable: true
        },
        stateMutationEncoding: {
          get() {
            return executionOwnership.get(execution)?.stateMutation?.encoding ?? null;
          },
          enumerable: true
        },
        stateMutationOperation: {
          get() {
            return executionOwnership.get(execution)?.stateMutation?.operation ?? null;
          },
          enumerable: true
        },
        quarantineReason: {
          get() {
            return executionOwnership.get(execution)?.stateMutation?.quarantineReason
              ?? retiredQuarantineReasons.get(execution)
              ?? null;
          },
          enumerable: true
        }
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

  function rawOwnershipFor(execution) {
    const ownership = executionOwnership.get(execution);
    if (
      !ownership
      || releasedExecutions.has(execution)
      || ownership.arena.token !== ownership.token
      || ownership.arena.inUse !== true
      || execution.ownerRuntime !== runtime
      || execution.fieldViewBuffer !== ownership.arena.fieldViewBuffer
      || execution.stableCandidateOrderBuffer
        !== ownership.stableCandidateOrderBuffer
      || execution.stableCandidateOrderCount
        !== ownership.stableCandidateOrderCount
      || execution.stableCandidateOrderPolicy
        !== ownership.stableCandidateOrderPolicy
      || execution.ownsStableCandidateOrderBuffer !== false
      || execution.sourceBuffer !== ownership.sourceBuffer
      || execution.identityBuffer !== ownership.identityBuffer
      || execution.parentMechanicsView !== ownership.parentMechanicsView
    ) {
      const error = new Error('mechanics field view execution is not owned by this runtime');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_FOREIGN_EXECUTION';
      throw error;
    }
    return ownership;
  }

  function ownershipFor(execution) {
    const ownership = rawOwnershipFor(execution);
    if (releaseInFlight.has(execution)) {
      const error = new Error('mechanics field view execution is not owned by this runtime');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_FOREIGN_EXECUTION';
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

  function isExecutionRetirementInFlight(execution) {
    try {
      rawOwnershipFor(execution);
      return submittedExecutions.has(execution)
        && execution.submitPerformed === true
        && releaseInFlight.has(execution)
        && retirementRecordFor(execution).activeAttempt !== null;
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
      value: 'schroeder-spatial-mechanics-field-view-gpu-build-submitted',
      enumerable: true
    });
    return true;
  }

  function isExecutionSubmitted(execution) {
    return submittedExecutions.has(execution)
      && ownsExecution(execution)
      && execution.submitPerformed === true;
  }

  function stateMutationState(execution) {
    const mutation = ownershipFor(execution).stateMutation;
    return Object.freeze({
      ordinal: mutation.ordinal,
      encoding: mutation.encoding,
      operation: mutation.operation,
      pending: mutation.pending !== null,
      publicationLocked: mutation.publicationLock !== null,
      quarantined: mutation.quarantined === true
    });
  }

  function isStateMutationReservationActive(execution, token) {
    try {
      const mutation = ownershipFor(execution).stateMutation;
      return token?.execution === execution
        && mutation.pending === token
        && mutation.quarantined !== true
        && mutation.ordinal === token.expectedOrdinal
        && mutation.encoding === token.expectedEncoding
        && token.outputOrdinal === token.expectedOrdinal + token.mutationCount
        && token.publicationLock === mutation.publicationLock
        && (token.publicationLock === null
          || publicationLockOwnership.get(token.publicationLock)?.status
            === 'active');
    } catch {
      return false;
    }
  }

  function reserveStateMutation(execution, {
    expectedOrdinal,
    expectedEncoding,
    outputEncoding,
    operation,
    mutationCount = 1,
    publicationLock = null
  } = {}) {
    const ownership = ownershipFor(execution);
    if (!submittedExecutions.has(execution)) {
      throw new Error('mechanics field mutation requires a submitted field view');
    }
    const expected = Number(expectedOrdinal);
    const expectedState = Number(expectedEncoding);
    const outputState = Number(outputEncoding);
    const count = Number(mutationCount);
    const mutation = ownership.stateMutation;
    const activePublicationLock = mutation.publicationLock;
    const publicationLockAdmitted = activePublicationLock === null
      ? publicationLock == null
      : publicationLock === activePublicationLock
        && publicationLockOwnership.get(publicationLock)?.execution === execution
        && publicationLockOwnership.get(publicationLock)?.status === 'active';
    if (
      !Number.isSafeInteger(expected)
      || expected < 0
      || !Number.isSafeInteger(expectedState)
      || expectedState < 0
      || !Number.isSafeInteger(outputState)
      || outputState < 0
      || !Number.isSafeInteger(count)
      || count < 1
      || expected > 0xffff_ffff - count
      || mutation.ordinal !== expected
      || mutation.encoding !== expectedState
      || mutation.pending !== null
      || mutation.quarantined === true
      || !publicationLockAdmitted
      || typeof operation !== 'string'
      || operation.length === 0
    ) {
      const error = new Error(
        'mechanics field mutation ordinal is stale or malformed'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    const token = Object.freeze({
      execution,
      expectedOrdinal: expected,
      outputOrdinal: expected + count,
      expectedEncoding: expectedState,
      outputEncoding: outputState,
      mutationCount: count,
      operation,
      publicationLock: activePublicationLock
    });
    mutation.pending = token;
    return token;
  }

  function markStateMutationSubmitted(token) {
    const execution = token?.execution;
    const mutation = ownershipFor(execution).stateMutation;
    if (mutation.pending !== token || mutation.quarantined === true) {
      const error = new Error('mechanics field mutation token is not pending');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    if (
      token.publicationLock !== mutation.publicationLock
      || (token.publicationLock !== null
        && publicationLockOwnership.get(token.publicationLock)?.status !== 'active')
    ) {
      const error = new Error('mechanics field publication lock changed during mutation');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    mutation.ordinal = token.outputOrdinal;
    mutation.encoding = token.outputEncoding;
    mutation.operation = token.operation;
    mutation.pending = null;
    return stateMutationState(execution);
  }

  function discardStateMutation(token, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError('discardStateMutation requires { discardedEncoder: true }');
    }
    const execution = token?.execution;
    const mutation = ownershipFor(execution).stateMutation;
    if (mutation.pending !== token || mutation.quarantined === true) {
      const error = new Error('mechanics field mutation token is not pending');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    mutation.pending = null;
    return true;
  }

  function quarantineStateMutation(token, {
    submissionObserved = false,
    reason = null
  } = {}) {
    if (submissionObserved !== true) {
      throw new TypeError(
        'quarantineStateMutation requires { submissionObserved: true }'
      );
    }
    const execution = token?.execution;
    const ownership = ownershipFor(execution);
    const mutation = ownership.stateMutation;
    if (mutation.pending !== token || mutation.quarantined === true) {
      const error = new Error('mechanics field mutation token is not pending');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    mutation.quarantined = true;
    mutation.quarantineReason = reason ?? null;
    ownership.arena.quarantined = true;
    const lockOwnership = publicationLockOwnership.get(mutation.publicationLock);
    if (lockOwnership?.status === 'active') lockOwnership.status = 'quarantined';
    return true;
  }

  function reserveStateMutationSequence(execution, {
    expectedOrdinal,
    expectedEncoding,
    stages,
    operation = 'mechanics-field-mutation-sequence',
    publicationLock = null
  } = {}) {
    if (!Array.isArray(stages) || stages.length < 1 || stages.length > 16) {
      throw new RangeError('mechanics field mutation sequence requires 1-16 stages');
    }
    let ordinal = Number(expectedOrdinal);
    let encoding = Number(expectedEncoding);
    if (!Number.isSafeInteger(ordinal) || ordinal < 0
        || !Number.isSafeInteger(encoding) || encoding < 0) {
      throw new RangeError(
        'mechanics field mutation sequence requires exact initial provenance'
      );
    }
    const normalizedStages = stages.map((stage, stageIndex) => {
      const mutationCount = stage?.mutationCount == null
        ? 1
        : Number(stage.mutationCount);
      const outputEncoding = Number(stage?.outputEncoding);
      const stageOperation = stage?.operation;
      if (!Number.isSafeInteger(mutationCount) || mutationCount < 1
          || !Number.isSafeInteger(outputEncoding) || outputEncoding < 0
          || typeof stageOperation !== 'string' || stageOperation.length === 0
          || ordinal > 0xffff_ffff - mutationCount) {
        throw new RangeError(
          `mechanics field mutation sequence stage ${stageIndex} is malformed`
        );
      }
      const segment = {
        execution,
        stageIndex,
        expectedOrdinal: ordinal,
        outputOrdinal: ordinal + mutationCount,
        expectedEncoding: encoding,
        outputEncoding,
        mutationCount,
        operation: stageOperation
      };
      ordinal = segment.outputOrdinal;
      encoding = outputEncoding;
      return segment;
    });
    const mutationCount = normalizedStages.reduce(
      (sum, stage) => sum + stage.mutationCount,
      0
    );
    const token = reserveStateMutation(execution, {
      expectedOrdinal,
      expectedEncoding,
      outputEncoding: encoding,
      operation,
      mutationCount,
      publicationLock
    });
    const sequence = {
      execution,
      expectedOrdinal: token.expectedOrdinal,
      outputOrdinal: token.outputOrdinal,
      expectedEncoding: token.expectedEncoding,
      outputEncoding: token.outputEncoding,
      mutationCount: token.mutationCount,
      operation,
      stages: null
    };
    const frozenStages = normalizedStages.map((stage) => {
      const segment = { ...stage };
      Object.defineProperty(segment, 'sequence', {
        value: sequence,
        enumerable: false,
        configurable: false,
        writable: false
      });
      Object.freeze(segment);
      mutationSegmentOwnership.set(segment, {
        sequence,
        stageIndex: stage.stageIndex
      });
      return segment;
    });
    sequence.stages = Object.freeze(frozenStages);
    Object.freeze(sequence);
    mutationSequenceOwnership.set(sequence, {
      token,
      stages: sequence.stages,
      submittedStageCount: 0,
      submissionObservedStageIndex: null,
      completed: false,
      discarded: false,
      quarantined: false,
      quarantineReason: null
    });
    mutationTokenSequenceOwnership.set(token, sequence);
    return sequence;
  }

  function sequenceOwnershipFor(sequence) {
    const ownership = mutationSequenceOwnership.get(sequence);
    const execution = sequence?.execution;
    const mutation = ownershipFor(execution).stateMutation;
    if (
      !ownership
      || ownership.discarded
      || ownership.completed
      || mutation.pending !== ownership.token
      || sequence.stages !== ownership.stages
    ) {
      const error = new Error('mechanics field mutation sequence is stale or foreign');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_STALE';
      throw error;
    }
    return ownership;
  }

  function sequenceSegmentOwnershipFor(sequence, segment) {
    const sequenceOwnership = sequenceOwnershipFor(sequence);
    const segmentOwnership = mutationSegmentOwnership.get(segment);
    if (
      !segmentOwnership
      || segmentOwnership.sequence !== sequence
      || sequence.stages[segmentOwnership.stageIndex] !== segment
    ) {
      const error = new Error('mechanics field mutation segment is stale or foreign');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_STALE';
      throw error;
    }
    return { sequenceOwnership, segmentOwnership };
  }

  function stateMutationSequenceState(sequence) {
    const ownership = sequenceOwnershipFor(sequence);
    return Object.freeze({
      submittedStageCount: ownership.submittedStageCount,
      submissionObservedStageIndex: ownership.submissionObservedStageIndex,
      stageCount: ownership.stages.length,
      completed: ownership.completed,
      discarded: ownership.discarded,
      quarantined: ownership.quarantined,
      quarantineReason: ownership.quarantineReason
    });
  }

  function isStateMutationSequenceSegmentReady(execution, sequence, segment) {
    try {
      if (sequence?.execution !== execution || segment?.execution !== execution) {
        return false;
      }
      const { sequenceOwnership, segmentOwnership } =
        sequenceSegmentOwnershipFor(sequence, segment);
      return sequenceOwnership.quarantined !== true
        && sequenceOwnership.submissionObservedStageIndex === null
        && sequenceOwnership.submittedStageCount === segmentOwnership.stageIndex;
    } catch {
      return false;
    }
  }

  function isStateMutationSequenceSegmentSubmitted(execution, sequence, segment) {
    try {
      if (sequence?.execution !== execution || segment?.execution !== execution) {
        return false;
      }
      const { sequenceOwnership, segmentOwnership } =
        sequenceSegmentOwnershipFor(sequence, segment);
      return sequenceOwnership.quarantined !== true
        && sequenceOwnership.submittedStageCount > segmentOwnership.stageIndex;
    } catch {
      return false;
    }
  }

  function markStateMutationSequenceStageSubmissionObserved(sequence, segment) {
    const { sequenceOwnership, segmentOwnership } =
      sequenceSegmentOwnershipFor(sequence, segment);
    if (
      sequenceOwnership.quarantined
      || sequenceOwnership.submissionObservedStageIndex !== null
      || sequenceOwnership.submittedStageCount !== segmentOwnership.stageIndex
    ) {
      const error = new Error(
        'mechanics field mutation sequence stage submission is replayed or out of order'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_ORDER';
      throw error;
    }
    sequenceOwnership.submissionObservedStageIndex = segmentOwnership.stageIndex;
    return stateMutationSequenceState(sequence);
  }

  function isStateMutationSequenceStageSubmissionObserved(
    execution,
    sequence,
    segment
  ) {
    try {
      if (sequence?.execution !== execution || segment?.execution !== execution) {
        return false;
      }
      const { sequenceOwnership, segmentOwnership } =
        sequenceSegmentOwnershipFor(sequence, segment);
      return sequenceOwnership.quarantined !== true
        && sequenceOwnership.submittedStageCount === segmentOwnership.stageIndex
        && sequenceOwnership.submissionObservedStageIndex
          === segmentOwnership.stageIndex;
    } catch {
      return false;
    }
  }

  function markStateMutationSequenceStageSubmitted(sequence, segment) {
    const { sequenceOwnership, segmentOwnership } =
      sequenceSegmentOwnershipFor(sequence, segment);
    if (
      sequenceOwnership.quarantined
      || sequenceOwnership.submittedStageCount !== segmentOwnership.stageIndex
      || sequenceOwnership.submissionObservedStageIndex
        !== segmentOwnership.stageIndex
    ) {
      const error = new Error(
        'mechanics field mutation sequence stage is replayed or out of order'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_ORDER';
      throw error;
    }
    sequenceOwnership.submissionObservedStageIndex = null;
    sequenceOwnership.submittedStageCount += 1;
    return stateMutationSequenceState(sequence);
  }

  function completeStateMutationSequence(sequence) {
    const ownership = sequenceOwnershipFor(sequence);
    if (
      ownership.quarantined
      || ownership.submittedStageCount !== ownership.stages.length
    ) {
      const error = new Error(
        'mechanics field mutation sequence cannot publish before every stage submits'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_INCOMPLETE';
      throw error;
    }
    const state = markStateMutationSubmitted(ownership.token);
    ownership.completed = true;
    return state;
  }

  function discardStateMutationSequence(sequence, {
    discardedEncoder = false
  } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        'discardStateMutationSequence requires { discardedEncoder: true }'
      );
    }
    const ownership = sequenceOwnershipFor(sequence);
    if (
      ownership.submittedStageCount !== 0
      || ownership.submissionObservedStageIndex !== null
      || ownership.quarantined
    ) {
      const error = new Error(
        'submitted mechanics field mutation sequence cannot be discarded'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_SUBMITTED';
      throw error;
    }
    discardStateMutation(ownership.token, { discardedEncoder: true });
    ownership.discarded = true;
    return true;
  }

  function quarantineStateMutationSequence(sequence, reason = null) {
    const ownership = sequenceOwnershipFor(sequence);
    if (
      ownership.submittedStageCount === 0
      && ownership.submissionObservedStageIndex === null
    ) {
      throw new Error(
        'unsubmitted mechanics field mutation sequence must be discarded, not quarantined'
      );
    }
    ownership.quarantined = true;
    ownership.quarantineReason = reason ?? null;
    const mutation = ownershipFor(sequence.execution).stateMutation;
    mutation.quarantined = true;
    mutation.quarantineReason = reason ?? null;
    ownershipFor(sequence.execution).arena.quarantined = true;
    const lockOwnership = publicationLockOwnership.get(mutation.publicationLock);
    if (lockOwnership?.status === 'active') lockOwnership.status = 'quarantined';
    return true;
  }

  function acquireStatePublicationLock(execution, {
    owner = null,
    publicationReceiptValidator = null
  } = {}) {
    const ownership = ownershipFor(execution);
    const mutation = ownership.stateMutation;
    if (
      !submittedExecutions.has(execution)
      || mutation.pending !== null
      || mutation.publicationLock !== null
      || mutation.quarantined === true
    ) {
      const error = new Error('mechanics field publication lock cannot be acquired');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    const publicationLock = Object.freeze({
      schema: 'peercompute.ulg.schroeder-mechanics-field-publication-lock.v0',
      execution,
      owner,
      acquisitionOrdinal: mutation.ordinal,
      acquisitionEncoding: mutation.encoding,
      serial: ++serial
    });
    publicationLockOwnership.set(publicationLock, {
      execution,
      owner,
      status: 'active',
      publicationReceiptValidator: typeof publicationReceiptValidator === 'function'
        ? publicationReceiptValidator
        : null,
      acquisitionOrdinal: mutation.ordinal,
      acquisitionEncoding: mutation.encoding
    });
    mutation.publicationLock = publicationLock;
    return publicationLock;
  }

  function isStatePublicationLockActive(execution, publicationLock) {
    try {
      const ownership = ownershipFor(execution);
      const lockOwnership = publicationLockOwnership.get(publicationLock);
      return ownership.stateMutation.publicationLock === publicationLock
        && lockOwnership?.execution === execution
        && lockOwnership.status === 'active';
    } catch {
      return false;
    }
  }

  function discardStatePublicationLock(execution, publicationLock) {
    const ownership = ownershipFor(execution);
    const mutation = ownership.stateMutation;
    const lockOwnership = publicationLockOwnership.get(publicationLock);
    if (
      !submittedExecutions.has(execution)
      || mutation.publicationLock !== publicationLock
      || lockOwnership?.execution !== execution
      || lockOwnership.status !== 'active'
      || mutation.pending !== null
      || mutation.quarantined === true
      || mutation.ordinal !== lockOwnership.acquisitionOrdinal
      || mutation.encoding !== lockOwnership.acquisitionEncoding
    ) {
      const error = new Error(
        'only an unmodified mechanics field publication lock can be discarded'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    mutation.publicationLock = null;
    lockOwnership.status = 'discarded';
    return true;
  }

  function mintStatePublicationCapability(execution, publicationLock, {
    terminalClosureReceipt,
    closureOrdinal
  } = {}) {
    const ownership = ownershipFor(execution);
    const mutation = ownership.stateMutation;
    const lockOwnership = publicationLockOwnership.get(publicationLock);
    const resolvedClosureOrdinal = Number(closureOrdinal);
    let receiptAdmitted = false;
    try {
      receiptAdmitted = terminalClosureReceipt?.schema
          === 'peercompute.ulg.schroeder-mechanics-field-publication-receipt.v0'
        && terminalClosureReceipt?.status === 'macro-closure-gpu-verified-private'
        && terminalClosureReceipt?.particlePublicationAllowed === true
        && lockOwnership?.publicationReceiptValidator?.(
          device,
          terminalClosureReceipt,
          {
          execution,
          publicationLock,
          mutationOrdinal: mutation.ordinal,
          stateEncoding: mutation.encoding,
          closureOrdinal: resolvedClosureOrdinal
          }
        ) === true;
    } catch {
      receiptAdmitted = false;
    }
    if (
      mutation.publicationLock !== publicationLock
      || lockOwnership?.execution !== execution
      || lockOwnership.status !== 'active'
      || mutation.pending !== null
      || mutation.quarantined === true
      || !Number.isSafeInteger(resolvedClosureOrdinal)
      || resolvedClosureOrdinal < 0
      || !receiptAdmitted
    ) {
      const error = new Error('mechanics field publication capability is stale');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    const capability = Object.freeze({
      schema: 'peercompute.ulg.schroeder-mechanics-field-publication-capability.v0',
      closureOrdinal: resolvedClosureOrdinal,
      serial: ++serial
    });
    publicationCapabilityOwnership.set(capability, {
      execution,
      publicationLock,
      terminalClosureReceipt,
      closureOrdinal: resolvedClosureOrdinal,
      mutationOrdinal: mutation.ordinal,
      stateEncoding: mutation.encoding,
      status: 'ready'
    });
    return capability;
  }

  function promoteStatePublicationLock(
    execution,
    publicationLock,
    publicationCapability
  ) {
    const ownership = ownershipFor(execution);
    const mutation = ownership.stateMutation;
    const lockOwnership = publicationLockOwnership.get(publicationLock);
    const capabilityOwnership = publicationCapabilityOwnership.get(
      publicationCapability
    );
    if (
      mutation.publicationLock !== publicationLock
      || lockOwnership?.execution !== execution
      || lockOwnership.status !== 'active'
      || mutation.pending !== null
      || mutation.quarantined === true
      || capabilityOwnership?.execution !== execution
      || capabilityOwnership?.publicationLock !== publicationLock
      || capabilityOwnership.status !== 'ready'
      || capabilityOwnership.mutationOrdinal !== mutation.ordinal
      || capabilityOwnership.stateEncoding !== mutation.encoding
    ) {
      const error = new Error('mechanics field publication promotion is stale');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    capabilityOwnership.status = 'consumed';
    lockOwnership.status = 'promoted';
    mutation.publicationLock = null;
    return true;
  }

  function markExecutionQuarantined(execution, ownership, reason = null) {
    const mutation = ownership.stateMutation;
    mutation.quarantined = true;
    if (mutation.quarantineReason == null && reason != null) {
      mutation.quarantineReason = reason;
    }
    ownership.arena.quarantined = true;
    const lockOwnership = publicationLockOwnership.get(mutation.publicationLock);
    if (
      lockOwnership?.execution === execution
      && (lockOwnership.status === 'active' || lockOwnership.status === 'retiring')
    ) {
      lockOwnership.status = 'quarantined';
    }
  }

  function retireStatePublicationLockAfter(execution, publicationLock) {
    try {
      const retirementRecord = retirementRecordFor(execution);
      if (retirementRecord.completed) return retirementRecord.completionPromise;
      if (retirementRecord.activeAttempt) {
        if (
          retirementRecord.activeAttempt.mode === 'publication-lock-fence'
          && retirementRecord.activeAttempt.publicationLock === publicationLock
        ) {
          return retirementRecord.activeAttempt.promise;
        }
        if (retirementRecord.activeAttempt.mode === 'device-loss') {
          return retirementRecord.activeAttempt.promise;
        }
        const error = new Error('mechanics field private retirement is stale');
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
        throw error;
      }
      const ownership = ownershipFor(execution);
      const mutation = ownership.stateMutation;
      const lockOwnership = publicationLockOwnership.get(publicationLock);
      if (
        !submittedExecutions.has(execution)
        || mutation.publicationLock !== publicationLock
        || lockOwnership?.execution !== execution
        || lockOwnership.status !== 'active'
        || mutation.pending !== null
        || mutation.quarantined === true
      ) {
        const error = new Error('mechanics field private retirement is stale');
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
        throw error;
      }
      if (typeof device.queue?.onSubmittedWorkDone !== 'function') {
        throw new TypeError(
          'retireStatePublicationLockAfter requires runtime-owned queue-fence support'
        );
      }
      let submissionFence;
      try {
        submissionFence = device.queue.onSubmittedWorkDone();
        if (!submissionFence?.then) {
          throw new TypeError('queue fence did not return a thenable');
        }
      } catch (error) {
        markExecutionQuarantined(execution, ownership, error);
        throw error;
      }
      const attempt = {
        mode: 'publication-lock-fence',
        publicationLock,
        ordinal: ++retirementRecord.nextAttemptOrdinal,
        promise: null
      };
      retirementRecord.activeAttempt = attempt;
      lockOwnership.status = 'retiring';
      releaseInFlight.add(execution);
      let radixRelease;
      try {
        radixRelease = ownership.arena.radix.releaseExecutionAfter(
          ownership.radixUnique,
          submissionFence
        );
      } catch (error) {
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        markExecutionQuarantined(execution, ownership, error);
        throw error;
      }
      const retirementAttempt = Promise.race([
        Promise.resolve(radixRelease).then((released) => ({
          kind: 'radix-release',
          released
        })),
        retirementRecord.completionPromise.then(() => ({
          kind: 'terminal-completion',
          released: true
        }))
      ]).then((result) => {
        if (result.kind === 'terminal-completion') return true;
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        if (result.released !== true) {
          throw new Error('mechanics field radix owner did not confirm release');
        }
        mutation.publicationLock = null;
        lockOwnership.status = 'retired';
        return finalizeRelease(execution, ownership, {
          radixReleased: true,
          retirementRecord
        });
      }).catch((error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        markExecutionQuarantined(execution, ownership, error);
        throw error;
      });
      attempt.promise = retirementAttempt;
      retirementAttempt.catch(() => {});
      return retirementAttempt;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function permanentlyRetireArena(
    execution,
    ownership,
    retirementRecord = retirementRecordFor(execution)
  ) {
    if (retirementRecord.completed) return true;
    const { arena } = ownership;
    destroyArenaOwnedBuffersAfterDeviceLoss(arena);
    arena.retired = true;
    arena.quarantined = false;
    const released = releaseArena(arena, ownership.token);
    if (released) {
      retiredQuarantineReasons.set(
        execution,
        ownership.stateMutation.quarantineReason ?? null
      );
      releasedExecutions.add(execution);
      submittedExecutions.delete(execution);
      executionOwnership.delete(execution);
      releaseInFlight.delete(execution);
      retirementRecord.activeAttempt = null;
      retirementRecord.completed = true;
      retirementRecord.resolveCompletion(true);
    }
    return released;
  }

  function retireQuarantinedExecutionAfter(
    execution,
    { deviceLost = false } = {}
  ) {
    try {
      const retirementRecord = retirementRecordFor(execution);
      if (retirementRecord.completed) return retirementRecord.completionPromise;
      if (deviceLost === true) return quarantineExecutionAfterDeviceLoss(execution);
      if (retirementRecord.activeAttempt?.mode === 'quarantine-fence') {
        return retirementRecord.activeAttempt.promise;
      }
      if (retirementRecord.activeAttempt) {
        return retirementRecord.activeAttempt.promise;
      }
      const ownership = rawOwnershipFor(execution);
      const mutation = ownership.stateMutation;
      if (
        !submittedExecutions.has(execution)
        || mutation.quarantined !== true
      ) {
        const error = new Error('mechanics field quarantine retirement is stale');
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_QUARANTINE_STALE';
        throw error;
      }
      const retirementEvidence = device.queue?.onSubmittedWorkDone?.();
      if (!retirementEvidence?.then) {
        throw new TypeError(
          'retireQuarantinedExecutionAfter requires runtime-owned queue-fence evidence'
        );
      }
      const attempt = {
        mode: 'quarantine-fence',
        ordinal: ++retirementRecord.nextAttemptOrdinal,
        promise: null
      };
      retirementRecord.activeAttempt = attempt;
      releaseInFlight.add(execution);
      const retirementAttempt = Promise.race([
        Promise.resolve(retirementEvidence).then(() => 'queue-fence'),
        retirementRecord.completionPromise.then(() => 'terminal-completion')
      ]).then((kind) => {
        if (kind === 'terminal-completion') return true;
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        return permanentlyRetireArena(execution, ownership, retirementRecord);
      }).catch((error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        throw error;
      });
      attempt.promise = retirementAttempt;
      retirementAttempt.catch(() => {});
      return retirementAttempt;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function quarantineExecutionAfterDeviceLoss(execution, { reason = null } = {}) {
    try {
      const retirementRecord = retirementRecordFor(execution);
      if (retirementRecord.completed) return retirementRecord.completionPromise;
      const ownership = rawOwnershipFor(execution);
      if (retirementRecord.activeAttempt?.mode === 'device-loss') {
        return retirementRecord.activeAttempt.promise;
      }
      const exactLossEvidence = device?.lost;
      if (!exactLossEvidence || typeof exactLossEvidence.then !== 'function') {
        const error = new TypeError(
          'mechanics field device-loss quarantine requires the exact GPUDevice.lost promise'
        );
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_DEVICE_LOSS_EVIDENCE';
        throw error;
      }
      if (
        retirementRecord.deviceLossEvidence != null
        && retirementRecord.deviceLossEvidence !== exactLossEvidence
      ) {
        const error = new Error(
          'mechanics field device-loss evidence changed for one execution'
        );
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_DEVICE_LOSS_EVIDENCE';
        throw error;
      }
      retirementRecord.deviceLossEvidence = exactLossEvidence;
      deviceLossObserved = true;
      markExecutionQuarantined(execution, ownership, reason);
      if (retirementRecord.activeAttempt) {
        retirementRecord.activeAttempt.promise.catch(() => {});
      }
      const attempt = {
        mode: 'device-loss',
        ordinal: ++retirementRecord.nextAttemptOrdinal,
        promise: null
      };
      retirementRecord.activeAttempt = attempt;
      releaseInFlight.add(execution);
      runtime.status =
        'schroeder-spatial-mechanics-field-view-gpu-runtime-device-loss-quarantined';
      const lossAttempt = Promise.resolve(exactLossEvidence).then(() => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        return permanentlyRetireArena(execution, ownership, retirementRecord);
      }).catch((error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        throw error;
      });
      attempt.promise = lossAttempt;
      lossAttempt.catch(() => {});
      return lossAttempt;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function executionRetirementCompletionPromise(execution) {
    return retirementRecordFor(execution).completionPromise;
  }

  function quarantineCurrentStateArtifact(execution, {
    mutationOrdinal,
    stateEncoding,
    reason = null
  } = {}) {
    const mutation = ownershipFor(execution).stateMutation;
    if (
      mutation.pending !== null
      || mutation.ordinal !== mutationOrdinal
      || mutation.encoding !== stateEncoding
      || mutation.quarantined === true
    ) {
      const error = new Error('mechanics field current state cannot be quarantined');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_QUARANTINE_STALE';
      throw error;
    }
    mutation.quarantined = true;
    mutation.quarantineReason = reason ?? null;
    const ownership = ownershipFor(execution);
    ownership.arena.quarantined = true;
    const lockOwnership = publicationLockOwnership.get(mutation.publicationLock);
    if (lockOwnership?.status === 'active') lockOwnership.status = 'quarantined';
    return true;
  }

  function isStateArtifactQuarantined(execution) {
    try {
      return ownershipFor(execution).stateMutation.quarantined === true;
    } catch {
      return false;
    }
  }

  function isCurrentStateArtifact(execution, {
    mutationOrdinal,
    stateEncoding,
    publicationLock = null
  } = {}) {
    try {
      const mutation = ownershipFor(execution).stateMutation;
      const activePublicationLock = mutation.publicationLock;
      const publicationAdmitted = activePublicationLock === null
        ? publicationLock == null
        : activePublicationLock === publicationLock
          && publicationLockOwnership.get(publicationLock)?.status === 'active';
      return mutation.pending === null
        && mutation.quarantined !== true
        && publicationAdmitted
        && mutation.ordinal === mutationOrdinal
        && mutation.encoding === stateEncoding;
    } catch {
      return false;
    }
  }

  function finalizeRelease(execution, ownership, {
    radixReleased = false,
    retirementRecord = retirementRecordFor(execution)
  } = {}) {
    if (retirementRecord.completed) return true;
    if (ownership.stateMutation.pending !== null) {
      throw new Error('mechanics field view has a pending state mutation');
    }
    if (ownership.stateMutation.publicationLock !== null) {
      throw new Error('mechanics field view has an active publication lock');
    }
    if (ownership.stateMutation.quarantined === true) {
      throw new Error('quarantined mechanics field requires exact retirement evidence');
    }
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
      releaseInFlight.delete(execution);
      retirementRecord.activeAttempt = null;
      retirementRecord.completed = true;
      retirementRecord.resolveCompletion(true);
    }
    return released;
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError('releaseExecution requires { discardedEncoder: true }');
    }
    const retirementRecord = retirementRecordFor(execution);
    if (retirementRecord.completed) return false;
    if (submittedExecutions.has(execution)) {
      throw new Error('submitted mechanics field view requires a queue fence');
    }
    return finalizeRelease(execution, ownershipFor(execution), { retirementRecord });
  }

  function releaseExecutionAfter(execution) {
    try {
      const retirementRecord = retirementRecordFor(execution);
      if (retirementRecord.completed) return retirementRecord.completionPromise;
      if (deviceLossObserved) return quarantineExecutionAfterDeviceLoss(execution);
      if (retirementRecord.activeAttempt) {
        return retirementRecord.activeAttempt.promise;
      }
      const ownership = rawOwnershipFor(execution);
      if (!submittedExecutions.has(execution)) {
        throw new Error('unsubmitted mechanics field view requires discarded-encoder release');
      }
      if (
        ownership.stateMutation.pending !== null
        || ownership.stateMutation.publicationLock !== null
        || ownership.stateMutation.quarantined === true
      ) {
        throw new Error(
          'mechanics field view requires exact pending/locked/quarantine retirement'
        );
      }
      if (typeof device.queue?.onSubmittedWorkDone !== 'function') {
        throw new TypeError('releaseExecutionAfter requires runtime-owned queue-fence support');
      }
      const submissionFence = device.queue.onSubmittedWorkDone();
      if (!submissionFence?.then) {
        throw new TypeError('runtime-owned queue fence did not return a thenable');
      }
      const attempt = {
        mode: 'release-fence',
        ordinal: ++retirementRecord.nextAttemptOrdinal,
        promise: null
      };
      retirementRecord.activeAttempt = attempt;
      releaseInFlight.add(execution);
      let radixRelease;
      try {
        radixRelease = ownership.arena.radix.releaseExecutionAfter(
          ownership.radixUnique,
          submissionFence
        );
      } catch (error) {
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        throw error;
      }
      const releaseAttempt = Promise.race([
        Promise.resolve(radixRelease).then((released) => ({
          kind: 'radix-release',
          released
        })),
        retirementRecord.completionPromise.then(() => ({
          kind: 'terminal-completion',
          released: true
        }))
      ]).then((result) => {
        if (result.kind === 'terminal-completion') return true;
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        if (result.released !== true) {
          throw new Error('mechanics field radix owner did not confirm release');
        }
        return finalizeRelease(execution, ownership, {
          radixReleased: true,
          retirementRecord
        });
      }).catch((error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        throw error;
      });
      attempt.promise = releaseAttempt;
      releaseAttempt.catch(() => {});
      return releaseAttempt;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function destroy() {
    if (destroyed) return false;
    if (arenas.some((arena) => arena.inUse)) {
      throw new Error('mechanics field view runtime still has active executions');
    }
    destroyed = true;
    for (const arena of arenas) {
      for (const buffer of [
        arena.paramsBuffer,
        arena.candidateKeyBuffer,
        arena.fieldViewBuffer
      ]) {
        if (arena.destroyedOwnedBuffers.has(buffer)) continue;
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      }
      if (!arena.radixDeviceLossRetired) arena.radix.destroy();
    }
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
    status: 'schroeder-spatial-mechanics-field-view-gpu-runtime-ready',
    deviceId,
    maxSourceCount: resolvedMaxSourceCount,
    identityStrideWords: resolvedIdentityStrideWords,
    gridNodeCount: template.gridNodeCount,
    gridDims: template.gridDims,
    gridShift: template.gridShift,
    gridSpacingM: template.gridSpacingM,
    maxComputeWorkgroupsPerDimension,
    arenaCount: resolvedArenaCount,
    layout: template.layout,
    releaseFencePolicy: 'runtime-owned-current-queue-at-invocation',
    pipelineCount: 4 + arenas.reduce((sum, arena) => sum + arena.radix.pipelineCount, 0),
    retainedGpuBufferBytes,
    encode,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    stateMutationState,
    isStateMutationReservationActive,
    reserveStateMutation,
    markStateMutationSubmitted,
    discardStateMutation,
    quarantineStateMutation,
    reserveStateMutationSequence,
    stateMutationSequenceState,
    isStateMutationSequenceSegmentReady,
    isStateMutationSequenceSegmentSubmitted,
    markStateMutationSequenceStageSubmissionObserved,
    isStateMutationSequenceStageSubmissionObserved,
    markStateMutationSequenceStageSubmitted,
    completeStateMutationSequence,
    discardStateMutationSequence,
    quarantineStateMutationSequence,
    acquireStatePublicationLock,
    isStatePublicationLockActive,
    discardStatePublicationLock,
    mintStatePublicationCapability,
    promoteStatePublicationLock,
    retireStatePublicationLockAfter,
    retireQuarantinedExecutionAfter,
    quarantineExecutionAfterDeviceLoss,
    executionRetirementCompletionPromise,
    isExecutionRetirementInFlight,
    quarantineCurrentStateArtifact,
    isStateArtifactQuarantined,
    isCurrentStateArtifact,
    releaseExecution,
    releaseExecutionAfter,
    allocationEntries: () => arenas.flatMap(allocationEntriesForArena),
    activeExecutionCount: () => arenas.filter((arena) => arena.inUse).length,
    availableArenaCount: () => arenas.filter((arena) => (
      arena.inUse !== true
      && arena.retired !== true
      && arena.quarantined !== true
    )).length,
    usableArenaCount: () => arenas.filter((arena) => (
      arena.retired !== true && arena.quarantined !== true
    )).length,
    quarantinedArenaCount: () => arenas.filter((arena) => (
      arena.retired !== true && arena.quarantined === true
    )).length,
    retiredArenaCount: () => arenas.filter((arena) => arena.retired === true).length,
    destroy
  };
  return runtime;
}

export {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
  schroederSpatialMechanicsFieldViewWgsl
};
