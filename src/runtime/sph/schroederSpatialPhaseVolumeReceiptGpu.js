import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_PARAMS_BYTES,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
  createSchroederSpatialPhaseVolumeReceiptLayout,
  createSchroederSpatialPhaseVolumeReceiptPlan
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceipt.js';
import {
  createSchroederSpatialPhaseVolumeReceiptWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceiptWgsl.js';
import {
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA,
  validateSchroederSpatialPhaseVolumeMomentDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeMoment.js';
import {
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const FIELD_VIEW_DISPATCH_OFFSET_BYTES = 60 * UINT32_BYTES;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function phaseVolumeReceiptError(message, code, ErrorType = Error) {
  const error = new ErrorType(message);
  error.code = code;
  return error;
}

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
    throw new TypeError('phase-volume receipt requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (!encoder?.clearBuffer || !encoder?.beginComputePass) {
    throw new TypeError(
      'phase-volume receipt encoding requires a caller-owned GPUCommandEncoder-like object'
    );
  }
}

function timestampSpansActive(gpuTimestampRecorder) {
  return gpuTimestampRecorder?.active === true
    && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
    && typeof gpuTimestampRecorder.endEncoderSpan === 'function';
}

function createOwnedBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function bufferSizeAtLeast(buffer, byteLength, label) {
  const size = Number(buffer?.size);
  if (Number.isFinite(size) && size < byteLength) {
    throw new RangeError(`${label} has ${size} bytes; ${byteLength} required`);
  }
}

function sameIdentity(left, right) {
  return [
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
    'supportEpoch',
    'completionOrdinal'
  ].every((field) => Object.is(left?.[field], right?.[field]));
}

function paramsData(plan) {
  const data = new ArrayBuffer(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (word, value) => view.setUint32(word * UINT32_BYTES, Number(value) >>> 0, true);
  u32(0, plan.sourceCount);
  u32(1, plan.sourceCapacity);
  u32(2, plan.fieldCapacity);
  u32(3, plan.candidateCount);
  view.setInt32(4 * UINT32_BYTES, plan.selectedLevel, true);
  u32(5, plan.gridNodeCount);
  view.setFloat32(6 * UINT32_BYTES, plan.gridSpacingM, true);
  view.setFloat32(7 * UINT32_BYTES, 1 / plan.gridSpacingM, true);
  u32(8, plan.generationId);
  u32(9, plan.deviceOrdinal);
  u32(10, plan.laneOrdinal);
  u32(11, plan.leaseToken);
  u32(12, plan.sourceFamilyId);
  u32(13, plan.storageGeneration);
  u32(14, plan.physicsTick);
  u32(15, plan.physicsSubstep);
  u32(16, plan.positionEpoch);
  u32(17, plan.topologyEpoch);
  u32(18, plan.chartEpoch);
  u32(19, plan.levelEpoch);
  u32(20, plan.supportEpoch);
  u32(21, plan.completionOrdinal);
  u32(22, plan.layout.sourceGroupCapacity);
  u32(23, plan.layout.fieldGroupCapacity);
  u32(24, plan.layout.sourcePartialOffsetVec4);
  u32(25, plan.layout.fieldPartialOffsetVec4);
  u32(26, plan.layout.fieldConditioningOffsetVec4);
  u32(27, plan.layout.partialVec4Capacity);
  u32(28, plan.sourceMechanicsStrideFloats);
  u32(29, plan.rawVolumeRatioJMechanicsWord);
  u32(30, plan.rawRestVolumeMechanicsWord);
  return data;
}

function encodePass(encoder, pipeline, bindGroup, workgroups, label, {
  gpuTimestampRecorder = null,
  timestampMetadata = null,
  producerId,
  stage
} = {}) {
  const timestampSpan = timestampSpansActive(gpuTimestampRecorder)
    ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
        producerId,
        stage,
        spanClass: 'same-production-command-encoder',
        ...(timestampMetadata || {})
      })
    : null;
  const pass = encoder.beginComputePass({ label });
  try {
    if (
      typeof pass?.setPipeline !== 'function'
      || typeof pass?.setBindGroup !== 'function'
      || typeof pass?.dispatchWorkgroups !== 'function'
      || typeof pass?.end !== 'function'
    ) {
      throw new TypeError('phase-volume receipt compute pass is missing required WebGPU commands');
    }
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(...workgroups);
  } finally {
    pass?.end?.();
  }
  if (timestampSpan) {
    gpuTimestampRecorder.endEncoderSpan(encoder, timestampSpan);
  }
  return 1;
}

function encodeIndirectPass(encoder, pipeline, bindGroup, buffer, offset, label, options) {
  const { gpuTimestampRecorder = null, timestampMetadata = null, producerId, stage } = options;
  const timestampSpan = timestampSpansActive(gpuTimestampRecorder)
    ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
        producerId,
        stage,
        spanClass: 'same-production-command-encoder',
        ...(timestampMetadata || {})
      })
    : null;
  const pass = encoder.beginComputePass({ label });
  try {
    if (
      typeof pass?.setPipeline !== 'function'
      || typeof pass?.setBindGroup !== 'function'
      || typeof pass?.dispatchWorkgroupsIndirect !== 'function'
      || typeof pass?.end !== 'function'
    ) {
      throw new TypeError('phase-volume receipt field reduction requires indirect WebGPU dispatch');
    }
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroupsIndirect(buffer, offset);
  } finally {
    pass?.end?.();
  }
  if (timestampSpan) {
    gpuTimestampRecorder.endEncoderSpan(encoder, timestampSpan);
  }
  return 1;
}

/**
 * Create a retained S9-B receipt runtime. It owns only receipt control,
 * reduction scratch, and params buffers; S9-A and mechanics-field inputs are
 * borrowed read-only and must remain live through receipt retirement.
 */
export function createSchroederSpatialPhaseVolumeReceiptGpu(device, {
  maxSourceCount,
  fieldCapacity = null,
  arenaCount = 2,
  label = 'ulg-schroeder-spatial-phase-volume-receipt'
} = {}) {
  assertDevice(device);
  const resolvedMaxSourceCount = positiveInteger(
    maxSourceCount,
    'maxSourceCount',
    Math.floor(0xffff_ffff / 32)
  );
  const candidateCapacity = resolvedMaxSourceCount * 27;
  const resolvedFieldCapacity = positiveInteger(
    fieldCapacity ?? candidateCapacity,
    'fieldCapacity',
    candidateCapacity
  );
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const template = createSchroederSpatialPhaseVolumeReceiptPlan({
    sourceCount: 1,
    sourceCapacity: resolvedMaxSourceCount,
    fieldCapacity: resolvedFieldCapacity,
    selectedLevel: 0,
    gridNodeCount: 1,
    gridSpacingM: 1,
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
    supportEpoch: 0,
    completionOrdinal: 1
  });
  const layout = template.layout;
  const maxStorageBuffersPerShaderStage = positiveInteger(
    device.limits?.maxStorageBuffersPerShaderStage ?? 8,
    'device.limits.maxStorageBuffersPerShaderStage',
    0xffff
  );
  if (maxStorageBuffersPerShaderStage < 7) {
    throw new RangeError('phase-volume receipt requires seven storage bindings');
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
  for (const [name, byteLength] of [
    ['phase-volume receipt control', layout.controlByteLength],
    ['phase-volume receipt partials', layout.partialByteLength]
  ]) {
    if (byteLength > maxBufferSize || byteLength > maxStorageBufferBindingSize) {
      throw new RangeError(`${name} exceeds the WebGPU storage buffer limit`);
    }
  }
  const maxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension'
  );
  if (layout.sourceGroupCapacity > maxComputeWorkgroupsPerDimension) {
    throw new RangeError('phase-volume receipt source dispatch exceeds the WebGPU limit');
  }

  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: createSchroederSpatialPhaseVolumeReceiptWgsl(layout)
  });
  const pipeline = (entryPoint) => device.createComputePipeline({
    label: `${label}-${entryPoint.replaceAll('_', '-')}-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  const pipelines = Object.freeze({
    sources: pipeline('reduce_phase_volume_receipt_sources'),
    fields: pipeline('reduce_phase_volume_receipt_fields'),
    finalize: pipeline('finalize_phase_volume_receipt')
  });
  const deviceId = webGpuDeviceId(device);
  let destroyed = false;
  let deviceLossObserved = false;
  let serial = 0;
  let runtime = null;
  const executionOwnership = new WeakMap();
  const retirementRecords = new WeakMap();
  const releasedExecutions = new WeakSet();
  const submittedExecutions = new WeakSet();

  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const arenaLabel = `${label}-arena-${arenaIndex}`;
    return {
      arenaIndex,
      inUse: false,
      retired: false,
      token: null,
      destroyedOwnedBuffers: new Set(),
      paramsBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-params`,
        SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      controlBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-control`,
        layout.controlByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      partialBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-partials`,
        layout.partialByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      )
    };
  });

  const allocationEntriesForArena = (arena) => [
    { role: 'phase-volume-receipt-params', arenaIndex: arena.arenaIndex, buffer: arena.paramsBuffer },
    { role: 'phase-volume-receipt-control', arenaIndex: arena.arenaIndex, buffer: arena.controlBuffer },
    { role: 'phase-volume-receipt-partials', arenaIndex: arena.arenaIndex, buffer: arena.partialBuffer }
  ];
  const retainedGpuBufferBytesPerArena = Object.freeze(arenas.map((arena) => (
    allocationEntriesForArena(arena).reduce(
      (sum, entry) => sum + Number(entry.buffer?.size ?? 0),
      0
    )
  )));
  const retainedGpuBufferBytes = retainedGpuBufferBytesPerArena.reduce(
    (sum, bytes) => sum + bytes,
    0
  );

  function acquireArena() {
    if (destroyed) {
      throw phaseVolumeReceiptError(
        'phase-volume receipt runtime is destroyed',
        'ERR_SCHROEDER_PHASE_VOLUME_RECEIPT_RUNTIME_DESTROYED'
      );
    }
    if (deviceLossObserved) {
      throw phaseVolumeReceiptError(
        'phase-volume receipt runtime observed device loss',
        'ERR_SCHROEDER_PHASE_VOLUME_RECEIPT_DEVICE_LOST'
      );
    }
    const arena = arenas.find((candidate) => (
      candidate.inUse !== true && candidate.retired !== true
    ));
    if (!arena) {
      throw phaseVolumeReceiptError(
        'phase-volume receipt arenas are under backpressure',
        'ERR_SCHROEDER_PHASE_VOLUME_RECEIPT_ARENA_EXHAUSTED'
      );
    }
    const token = Object.freeze({ serial: ++serial, arenaIndex: arena.arenaIndex });
    arena.inUse = true;
    arena.token = token;
    return { arena, token };
  }

  function createRetirementRecord(execution, ownership) {
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
    retirementRecords.set(execution, record);
    return record;
  }

  function ownershipFor(execution) {
    const ownership = executionOwnership.get(execution);
    if (
      !ownership
      || releasedExecutions.has(execution)
      || ownership.arena.inUse !== true
      || ownership.arena.token !== ownership.token
      || execution?.ownerRuntime !== runtime
      || execution?.arenaIndex !== ownership.arena.arenaIndex
      || execution?.arenaGeneration !== ownership.token.serial
      || execution?.controlBuffer !== ownership.arena.controlBuffer
      || execution?.partialBuffer !== ownership.arena.partialBuffer
      || execution?.paramsBuffer !== ownership.arena.paramsBuffer
      || execution?.phaseVolumeMoment !== ownership.phaseVolumeMoment
      || execution?.parentPhaseVolumeMoment !== ownership.phaseVolumeMoment
      || execution?.sourceMechanicsBuffer !== ownership.sourceMechanicsBuffer
      || execution?.sourceBuffer !== ownership.sourceBuffer
      || execution?.sourceBufferBorrowed !== true
      || execution?.mechanicsFieldView !== ownership.mechanicsFieldView
    ) {
      throw phaseVolumeReceiptError(
        'phase-volume receipt execution is not owned by this runtime',
        'ERR_SCHROEDER_PHASE_VOLUME_RECEIPT_FOREIGN_EXECUTION'
      );
    }
    return ownership;
  }

  function retirementFor(execution) {
    const record = retirementRecords.get(execution);
    if (!record || record.execution !== execution) {
      throw phaseVolumeReceiptError(
        'phase-volume receipt execution lacks an exact retirement record',
        'ERR_SCHROEDER_PHASE_VOLUME_RECEIPT_FOREIGN_EXECUTION'
      );
    }
    if (!record.completed) ownershipFor(execution);
    return record;
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
          'phase-volume receipt device-loss arena retirement was incomplete'
        );
    }
    return true;
  }

  function finishRetirement(record, { deviceLost = false } = {}) {
    if (record.completed) return true;
    const { execution, ownership } = record;
    const { arena, token } = ownership;
    if (arena.inUse !== true || arena.token !== token) {
      throw phaseVolumeReceiptError(
        'phase-volume receipt arena ownership changed before retirement',
        'ERR_SCHROEDER_PHASE_VOLUME_RECEIPT_FOREIGN_EXECUTION'
      );
    }
    if (deviceLost) destroyArenaOwnedBuffersAfterDeviceLoss(arena);
    arena.inUse = false;
    arena.token = null;
    arena.retired = deviceLost;
    releasedExecutions.add(execution);
    submittedExecutions.delete(execution);
    executionOwnership.delete(execution);
    execution.releaseScheduled = false;
    execution.status = deviceLost
      ? 'schroeder-spatial-phase-volume-receipt-device-loss-retired'
      : 'schroeder-spatial-phase-volume-receipt-released';
    record.activeAttempt = null;
    record.completed = true;
    record.resolveCompletion(true);
    return true;
  }

  function assertPhaseVolumeMoment(phaseVolumeMoment) {
    const admission = validateSchroederSpatialPhaseVolumeMomentDescriptor(
      phaseVolumeMoment,
      {
        sourceCapacity: resolvedMaxSourceCount,
        fieldCapacity: resolvedFieldCapacity
      }
    );
    const mechanicsFieldView = phaseVolumeMoment?.mechanicsFieldView;
    let phaseOwned = false;
    let fieldOwned = false;
    try {
      phaseOwned = phaseVolumeMoment?.ownerRuntime?.ownsExecution?.(phaseVolumeMoment) === true;
      fieldOwned = mechanicsFieldView?.ownerRuntime?.ownsExecution?.(mechanicsFieldView) === true;
    } catch {
      phaseOwned = false;
      fieldOwned = false;
    }
    if (
      admission.admitted !== true
      || phaseVolumeMoment?.schema !== ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA
      || phaseVolumeMoment.status !== 'schroeder-spatial-phase-volume-moment-gpu-encoded'
      || phaseVolumeMoment.submitPerformed !== false
      || phaseVolumeMoment.released === true
      || !phaseOwned
      || !mechanicsFieldView
      || mechanicsFieldView.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
      || mechanicsFieldView.submitPerformed !== false
      || mechanicsFieldView.released === true
      || !fieldOwned
      || phaseVolumeMoment.sourceMechanicsBufferBorrowed !== true
      || !phaseVolumeMoment.sourceBuffer
      || phaseVolumeMoment.parentMechanicsFieldView !== mechanicsFieldView
      || mechanicsFieldView.sourceBuffer !== phaseVolumeMoment.sourceBuffer
      || mechanicsFieldView.fieldViewBuffer !== mechanicsFieldView.indirectDispatchBuffer
      || mechanicsFieldView.indirectDispatchOffsetBytes !== FIELD_VIEW_DISPATCH_OFFSET_BYTES
      || phaseVolumeMoment.sourceCapacity !== resolvedMaxSourceCount
      || phaseVolumeMoment.fieldCapacity !== resolvedFieldCapacity
      || phaseVolumeMoment.mechanicsStrideFloats !== 32
      || phaseVolumeMoment.rawVolumeRatioJMechanicsWord !== 18
      || phaseVolumeMoment.rawRestVolumeMechanicsWord !== 19
      || !webGpuBufferMatchesDevice(phaseVolumeMoment.sourceMechanicsBuffer, device)
      || !webGpuBufferMatchesDevice(phaseVolumeMoment.sourceBuffer, device)
      || !webGpuBufferMatchesDevice(phaseVolumeMoment.controlBuffer, device)
      || !webGpuBufferMatchesDevice(phaseVolumeMoment.momentBuffer, device)
      || !webGpuBufferMatchesDevice(mechanicsFieldView.fieldViewBuffer, device)
    ) {
      throw new TypeError(
        'phase-volume receipt requires one exact live encoded S9-A moment sidecar'
      );
    }
    bufferSizeAtLeast(
      phaseVolumeMoment.sourceMechanicsBuffer,
      phaseVolumeMoment.sourceCount * 32 * Float32Array.BYTES_PER_ELEMENT,
      'phase-volume receipt source mechanics buffer'
    );
    bufferSizeAtLeast(
      phaseVolumeMoment.sourceBuffer,
      phaseVolumeMoment.sourceCount * 16 * Float32Array.BYTES_PER_ELEMENT,
      'phase-volume receipt source assignment buffer'
    );
    bufferSizeAtLeast(
      phaseVolumeMoment.controlBuffer,
      64 * UINT32_BYTES,
      'phase-volume receipt S9-A control buffer'
    );
    bufferSizeAtLeast(
      phaseVolumeMoment.momentBuffer,
      resolvedFieldCapacity * 12 * UINT32_BYTES,
      'phase-volume receipt S9-A moment rows'
    );
    bufferSizeAtLeast(
      mechanicsFieldView.fieldViewBuffer,
      Math.max(mechanicsFieldView.layout?.byteLength ?? 0, FIELD_VIEW_DISPATCH_OFFSET_BYTES + 12),
      'phase-volume receipt mechanics field view'
    );
    return mechanicsFieldView;
  }

  function encode(encoder, {
    phaseVolumeMoment,
    gpuTimestampRecorder = null,
    timestampMetadata = null
  } = {}) {
    assertEncoder(encoder);
    const mechanicsFieldView = assertPhaseVolumeMoment(phaseVolumeMoment);
    const plan = createSchroederSpatialPhaseVolumeReceiptPlan({
      sourceCount: phaseVolumeMoment.sourceCount,
      sourceCapacity: resolvedMaxSourceCount,
      fieldCapacity: resolvedFieldCapacity,
      selectedLevel: phaseVolumeMoment.selectedLevel,
      gridNodeCount: phaseVolumeMoment.gridNodeCount,
      gridSpacingM: phaseVolumeMoment.gridSpacingM,
      generationId: phaseVolumeMoment.generationId,
      deviceOrdinal: phaseVolumeMoment.deviceOrdinal,
      laneOrdinal: phaseVolumeMoment.laneOrdinal,
      leaseToken: phaseVolumeMoment.leaseToken,
      sourceFamilyId: phaseVolumeMoment.sourceFamilyId,
      storageGeneration: phaseVolumeMoment.storageGeneration,
      physicsTick: phaseVolumeMoment.physicsTick,
      physicsSubstep: phaseVolumeMoment.physicsSubstep,
      positionEpoch: phaseVolumeMoment.positionEpoch,
      topologyEpoch: phaseVolumeMoment.topologyEpoch,
      chartEpoch: phaseVolumeMoment.chartEpoch,
      levelEpoch: phaseVolumeMoment.levelEpoch,
      supportEpoch: phaseVolumeMoment.supportEpoch,
      completionOrdinal: phaseVolumeMoment.completionOrdinal
    });
    if (!sameIdentity(plan, phaseVolumeMoment)) {
      throw new TypeError('phase-volume receipt plan lost exact S9-A lineage');
    }
    const { arena, token } = acquireArena();
    let execution = null;
    let recordingStarted = false;
    let encodedDispatchCount = 0;
    try {
      device.queue.writeBuffer(arena.paramsBuffer, 0, paramsData(plan));
      const resource = (buffer) => ({ buffer });
      const paramsResource = {
        buffer: arena.paramsBuffer,
        offset: 0,
        size: SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_PARAMS_BYTES
      };
      const entries = Object.freeze({
        sourceMechanics: { binding: 0, resource: resource(phaseVolumeMoment.sourceMechanicsBuffer) },
        momentControl: { binding: 1, resource: resource(phaseVolumeMoment.controlBuffer) },
        momentRows: { binding: 2, resource: resource(phaseVolumeMoment.momentBuffer) },
        mechanicsField: { binding: 3, resource: resource(mechanicsFieldView.fieldViewBuffer) },
        partials: { binding: 4, resource: resource(arena.partialBuffer) },
        control: { binding: 5, resource: resource(arena.controlBuffer) },
        params: { binding: 6, resource: paramsResource },
        sourceAssignments: { binding: 7, resource: resource(phaseVolumeMoment.sourceBuffer) }
      });
      const bindGroup = (pipelineObject, bindingEntries, suffix) => device.createBindGroup({
        label: `${label}-arena-${arena.arenaIndex}-${suffix}-bindings`,
        layout: pipelineObject.getBindGroupLayout(0),
        entries: bindingEntries
      });
      const sourceBindGroup = bindGroup(pipelines.sources, [
        entries.sourceMechanics,
        // Header pairing is checked before source reduction, so this pass
        // intentionally sees the complete read-only S9-A evidence set.
        entries.momentControl,
        entries.momentRows,
        entries.mechanicsField,
        entries.partials,
        entries.control,
        entries.params,
        entries.sourceAssignments
      ], 'sources');
      const fieldBindGroup = bindGroup(pipelines.fields, [
        entries.momentControl,
        entries.momentRows,
        entries.mechanicsField,
        entries.partials,
        entries.control,
        entries.params
      ], 'fields');
      const finalizeBindGroup = bindGroup(pipelines.finalize, [
        entries.momentControl,
        entries.momentRows,
        entries.mechanicsField,
        entries.partials,
        entries.control,
        entries.params
      ], 'finalize');
      const commonTimestamp = {
        generationId: plan.generationId,
        selectedLevel: plan.selectedLevel,
        ...timestampMetadata
      };
      // Install ownership before the first command touches receipt-owned
      // memory.  If a later encoder/pass/timestamp operation fails, the
      // failed execution pins this arena until the caller explicitly proves
      // that its encoder was discarded.  Releasing it eagerly here would let
      // a later encode overwrite buffers still referenced by recorded work.
      execution = {
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
        status: 'schroeder-spatial-phase-volume-receipt-gpu-encoding',
        ready: false,
        selected: false,
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        phaseVolumeMoment,
        parentPhaseVolumeMoment: phaseVolumeMoment,
        sourceMechanicsBuffer: phaseVolumeMoment.sourceMechanicsBuffer,
        sourceMechanicsBufferBorrowed: true,
        sourceBuffer: phaseVolumeMoment.sourceBuffer,
        sourceBufferBorrowed: true,
        mechanicsFieldView,
        controlBuffer: arena.controlBuffer,
        partialBuffer: arena.partialBuffer,
        paramsBuffer: arena.paramsBuffer,
        encodedDispatchCount: 0,
        encodedComputePassCount: 0,
        storageBindingCount: 7,
        retainedGpuBufferBytes: retainedGpuBufferBytesPerArena[arena.arenaIndex],
        retainedGpuBufferBytesAllArenas: retainedGpuBufferBytes,
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        readbackPerformed: false,
        fullParticleReadbackRequired: false,
        fullParticleReadbackPerformed: false,
        diagnosticOnly: true,
        stateMutationAllowed: false,
        submitPerformed: false,
        releaseScheduled: false,
        submissionOwnership: 'caller',
        failureRequiresDiscardedEncoder: false,
        terminalSealPolicy: 'gpu-finalizer-writes-last;future-consumer-requires-sealed-ready-admitted'
      };
      Object.defineProperty(execution, 'ownerRuntime', {
        value: runtime,
        enumerable: false
      });
      Object.defineProperty(execution, 'released', {
        get() { return releasedExecutions.has(execution); },
        enumerable: true
      });
      const ownership = {
        arena,
        token,
        phaseVolumeMoment,
        sourceMechanicsBuffer: phaseVolumeMoment.sourceMechanicsBuffer,
        sourceBuffer: phaseVolumeMoment.sourceBuffer,
        mechanicsFieldView
      };
      executionOwnership.set(execution, ownership);
      createRetirementRecord(execution, ownership);

      recordingStarted = true;
      encoder.clearBuffer(arena.controlBuffer);
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.sources,
        sourceBindGroup,
        [plan.sourceGroupCount, 1, 1],
        `${label}ReduceSources`,
        {
          gpuTimestampRecorder,
          timestampMetadata: commonTimestamp,
          producerId: 'schroeder-spatial-phase-volume-receipt-source-reduction',
          stage: 'reduce-sources'
        }
      );
      encodedDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.fields,
        fieldBindGroup,
        mechanicsFieldView.fieldViewBuffer,
        FIELD_VIEW_DISPATCH_OFFSET_BYTES,
        `${label}ReduceFields`,
        {
          gpuTimestampRecorder,
          timestampMetadata: commonTimestamp,
          producerId: 'schroeder-spatial-phase-volume-receipt-field-reduction',
          stage: 'reduce-fields'
        }
      );
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.finalize,
        finalizeBindGroup,
        [1, 1, 1],
        `${label}Finalize`,
        {
          gpuTimestampRecorder,
          timestampMetadata: commonTimestamp,
          producerId: 'schroeder-spatial-phase-volume-receipt-finalize',
          stage: 'finalize'
        }
      );
      execution.encodedDispatchCount = encodedDispatchCount;
      execution.encodedComputePassCount = 3;
      execution.ready = true;
      execution.selected = true;
      execution.status = 'schroeder-spatial-phase-volume-receipt-gpu-encoded';
      return execution;
    } catch (error) {
      if (execution && recordingStarted) {
        execution.encodedDispatchCount = encodedDispatchCount;
        execution.encodedComputePassCount = encodedDispatchCount;
        execution.ready = false;
        execution.selected = false;
        execution.status = 'schroeder-spatial-phase-volume-receipt-encode-failed-awaiting-discard';
        execution.failureRequiresDiscardedEncoder = true;
        try {
          Object.defineProperty(error, 'phaseVolumeReceiptExecution', {
            value: execution,
            enumerable: true,
            configurable: true
          });
        } catch {
          // Native Error objects are extensible, but retain the original
          // failure even for an exotic non-extensible host error.
        }
        throw error;
      }
      arena.inUse = false;
      arena.token = null;
      throw error;
    }
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
    if (
      execution.status !== 'schroeder-spatial-phase-volume-receipt-gpu-encoded'
      || execution.ready !== true
      || execution.selected !== true
      || execution.failureRequiresDiscardedEncoder === true
    ) {
      throw phaseVolumeReceiptError(
        'failed phase-volume receipt encoding requires discarded-encoder release',
        'ERR_SCHROEDER_PHASE_VOLUME_RECEIPT_FAILED_ENCODING'
      );
    }
    if (submittedExecutions.has(execution)) return false;
    submittedExecutions.add(execution);
    execution.submitPerformed = true;
    execution.status = 'schroeder-spatial-phase-volume-receipt-gpu-build-submitted';
    return true;
  }

  function isExecutionSubmitted(execution) {
    return submittedExecutions.has(execution)
      && ownsExecution(execution)
      && execution.submitPerformed === true;
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError('releaseExecution requires { discardedEncoder: true }');
    }
    const record = retirementFor(execution);
    if (record.completed) return false;
    if (submittedExecutions.has(execution)) {
      throw new Error('submitted phase-volume receipt requires a queue fence');
    }
    if (record.activeAttempt) {
      throw new Error('phase-volume receipt retirement is already in flight');
    }
    return finishRetirement(record);
  }

  function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    const record = retirementFor(execution);
    if (record.completed) return record.completionPromise;
    if (deviceLossObserved) return quarantineExecutionAfterDeviceLoss(execution);
    if (execution.failureRequiresDiscardedEncoder === true) {
      throw new Error('failed phase-volume receipt encoding requires discarded-encoder release');
    }
    if (!submittedExecutions.has(execution)) {
      throw new Error('unsubmitted phase-volume receipt requires discarded-encoder release');
    }
    if (record.activeAttempt) return record.activeAttempt.promise;
    const attempt = {
      mode: 'queue-fence',
      ordinal: ++record.nextAttemptOrdinal,
      promise: null
    };
    record.activeAttempt = attempt;
    execution.releaseScheduled = true;
    const promise = Promise.resolve(submissionFence).then(
      () => {
        if (record.activeAttempt !== attempt) return record.completionPromise;
        return finishRetirement(record);
      },
      (error) => {
        if (record.activeAttempt !== attempt) return record.completionPromise;
        record.activeAttempt = null;
        execution.releaseScheduled = false;
        execution.status = 'schroeder-spatial-phase-volume-receipt-release-blocked';
        throw error;
      }
    );
    attempt.promise = promise;
    promise.catch(() => {});
    return promise;
  }

  function quarantineExecutionAfterDeviceLoss(execution) {
    const record = retirementFor(execution);
    if (record.completed) return record.completionPromise;
    const exactLossEvidence = record.deviceLossEvidence ?? device?.lost;
    if (!exactLossEvidence || typeof exactLossEvidence.then !== 'function') {
      throw phaseVolumeReceiptError(
        'phase-volume receipt device-loss quarantine requires the exact GPUDevice.lost promise',
        'ERR_SCHROEDER_PHASE_VOLUME_RECEIPT_DEVICE_LOSS_EVIDENCE',
        TypeError
      );
    }
    if (
      record.deviceLossEvidence != null
      && record.deviceLossEvidence !== exactLossEvidence
    ) {
      throw phaseVolumeReceiptError(
        'phase-volume receipt device-loss evidence changed for one execution',
        'ERR_SCHROEDER_PHASE_VOLUME_RECEIPT_DEVICE_LOSS_EVIDENCE'
      );
    }
    record.deviceLossEvidence = exactLossEvidence;
    deviceLossObserved = true;
    runtime.status = 'schroeder-spatial-phase-volume-receipt-runtime-device-loss-quarantined';
    if (record.activeAttempt?.mode === 'device-loss') return record.activeAttempt.promise;
    record.activeAttempt?.promise?.catch?.(() => {});
    const attempt = {
      mode: 'device-loss',
      ordinal: ++record.nextAttemptOrdinal,
      promise: null
    };
    record.activeAttempt = attempt;
    execution.releaseScheduled = true;
    execution.status = 'schroeder-spatial-phase-volume-receipt-device-loss-quarantined';
    const promise = Promise.resolve(exactLossEvidence).then(
      () => {
        if (record.activeAttempt !== attempt) return record.completionPromise;
        return finishRetirement(record, { deviceLost: true });
      },
      (error) => {
        if (record.activeAttempt !== attempt) return record.completionPromise;
        record.activeAttempt = null;
        execution.releaseScheduled = false;
        execution.status = 'schroeder-spatial-phase-volume-receipt-device-loss-retirement-blocked';
        throw error;
      }
    );
    attempt.promise = promise;
    promise.catch(() => {});
    return promise;
  }

  function executionRetirementCompletionPromise(execution) {
    return retirementFor(execution).completionPromise;
  }

  function activeExecutionCount() {
    return arenas.reduce((count, arena) => count + (arena.inUse ? 1 : 0), 0);
  }

  function allocationEntries() {
    return arenas.flatMap(allocationEntriesForArena);
  }

  function destroy() {
    if (destroyed) return true;
    if (arenas.some((arena) => arena.inUse)) return false;
    destroyed = true;
    for (const arena of arenas) {
      for (const { buffer } of allocationEntriesForArena(arena)) {
        if (!buffer || arena.destroyedOwnedBuffers.has(buffer)) continue;
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      }
    }
    runtime.status = 'schroeder-spatial-phase-volume-receipt-runtime-destroyed';
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
    status: 'schroeder-spatial-phase-volume-receipt-gpu-runtime-ready',
    deviceId,
    maxSourceCount: resolvedMaxSourceCount,
    fieldCapacity: resolvedFieldCapacity,
    arenaCount: resolvedArenaCount,
    layout,
    pipelineCount: Object.keys(pipelines).length,
    storageBindingCount: 7,
    retainedGpuBufferBytes,
    normalHotLoopReadbackFree: true,
    encode,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    releaseExecution,
    releaseExecutionAfter,
    quarantineExecutionAfterDeviceLoss,
    executionRetirementCompletionPromise,
    activeExecutionCount,
    allocationEntries,
    destroy
  };
  return runtime;
}
