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
import { createWebGpuStableRadixScanUnique } from '../webgpuRadixScanUnique.js';
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

function fieldParamsData(plan, parentExecution) {
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
  return data;
}

function encodePass(encoder, pipeline, bindGroup, workgroups, label) {
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...workgroups);
  pass.end();
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
    'device.limits.maxComputeWorkgroupsPerDimension'
  );
  const candidateKeyByteLength = template.layout.candidateCapacity
    * SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS
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
  const sourceWorkgroups = Math.ceil(
    resolvedMaxSourceCount / SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE
  );
  const candidateWorkgroups = Math.ceil(
    template.layout.candidateCapacity
      / SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE
  );
  if (
    sourceWorkgroups > maxComputeWorkgroupsPerDimension
    || candidateWorkgroups > maxComputeWorkgroupsPerDimension
  ) {
    throw new RangeError(
      'mechanics field view x-dispatch exceeds maxComputeWorkgroupsPerDimension'
    );
  }
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
  let serial = 0;
  let runtime = null;
  const executionOwnership = new WeakMap();
  const releasedExecutions = new WeakSet();
  const submittedExecutions = new WeakSet();
  const releaseInFlight = new WeakSet();

  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const arenaLabel = `${label}-arena-${arenaIndex}`;
    return {
      arenaIndex,
      inUse: false,
      token: null,
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
        maxKeyWordCount: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS,
        label: `${arenaLabel}-radix`,
        maxComputeWorkgroupsPerDimension,
        retainConstantScanParamsBuffers: true,
        retainVariableScanParamsBuffers: true,
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
    const arena = arenas.find((candidate) => candidate.inUse === false);
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
    parentMechanicsView
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
      device.queue.writeBuffer(arena.paramsBuffer, 0, fieldParamsData(plan, parentMechanicsView));
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
        [Math.max(1, Math.ceil(
          plan.sourceCount / SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE
        )), 1, 1],
        `${label}EmitCandidates`
      );
      radixUnique = arena.radix.encodeSortUnique(encoder, {
        keyBuffer: arena.candidateKeyBuffer,
        elementCount: plan.candidateCount,
        keyWordCount: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS,
        keyStrideWords: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS,
        generationId: plan.generationId,
        consumerWorkgroupSize: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
        retainedParamsSlotIndex: 0
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
        [Math.max(1, Math.ceil(
          plan.candidateCount / SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE
        )), 1, 1],
        `${label}MaterializeStencilMap`
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.assemble,
        assembleBindGroup,
        [Math.max(1, Math.ceil(
          plan.candidateCount / SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE
        )), 1, 1],
        `${label}AssembleKeys`
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.finalize,
        finalizeBindGroup,
        [1, 1, 1],
        `${label}Finalize`
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
      executionOwnership.set(execution, {
        arena,
        token,
        radixUnique,
        sourceBuffer,
        identityBuffer,
        parentMechanicsView
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
      || execution.fieldViewBuffer !== ownership.arena.fieldViewBuffer
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
      throw new Error('submitted mechanics field view requires a queue fence');
    }
    return finalizeRelease(execution, ownershipFor(execution));
  }

  async function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    const ownership = ownershipFor(execution);
    if (!submittedExecutions.has(execution)) {
      throw new Error('unsubmitted mechanics field view requires discarded-encoder release');
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

  function destroy() {
    if (destroyed) return false;
    if (arenas.some((arena) => arena.inUse)) {
      throw new Error('mechanics field view runtime still has active executions');
    }
    destroyed = true;
    for (const arena of arenas) {
      arena.paramsBuffer.destroy?.();
      arena.candidateKeyBuffer.destroy?.();
      arena.fieldViewBuffer.destroy?.();
      arena.radix.destroy();
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
    arenaCount: resolvedArenaCount,
    layout: template.layout,
    pipelineCount: 4 + arenas.reduce((sum, arena) => sum + arena.radix.pipelineCount, 0),
    retainedGpuBufferBytes,
    encode,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    releaseExecution,
    releaseExecutionAfter,
    allocationEntries: () => arenas.flatMap(allocationEntriesForArena),
    activeExecutionCount: () => arenas.filter((arena) => arena.inUse).length,
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
