import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_PARAMS_BYTES,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA,
  createSchroederSpatialPhaseVolumeInterfaceProposalLayout,
  createSchroederSpatialPhaseVolumeInterfaceProposalPlan,
  validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeInterfaceProposal.js';
import {
  createSchroederSpatialPhaseVolumeInterfaceProposalWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeInterfaceProposalWgsl.js';
import {
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
  validateSchroederSpatialPhaseVolumeReceiptDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceipt.js';
import {
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
  createSchroederSpatialParentFieldViewLayout
} from '../../../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function interfaceProposalError(message, code, ErrorType = Error) {
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
    throw new TypeError('phase-volume interface proposal requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (!encoder?.clearBuffer || !encoder?.beginComputePass) {
    throw new TypeError(
      'phase-volume interface proposal encoding requires a caller-owned GPUCommandEncoder-like object'
    );
  }
}

function createOwnedBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function bufferSizeAtLeast(buffer, byteLength, label) {
  const size = Number(buffer?.size);
  if (!buffer || (Number.isFinite(size) && size < byteLength)) {
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
    'supportEpoch'
  ].every((field) => Object.is(left?.[field], right?.[field]));
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
    execution?.status === encodedStatus
    && execution?.submitPerformed === false
    && submittedByOwner === false
  ) return 'encoded';
  if (
    execution?.status === submittedStatus
    && execution?.submitPerformed === true
    && submittedByOwner === true
  ) return 'submitted';
  return null;
}

function paramsData(plan) {
  const data = new ArrayBuffer(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (word, value) => view.setUint32(word * UINT32_BYTES, Number(value) >>> 0, true);
  const i32 = (word, value) => view.setInt32(word * UINT32_BYTES, Number(value) | 0, true);
  u32(0, plan.fineFieldCapacity);
  u32(1, plan.coarseFieldCapacity);
  i32(2, plan.fineLevel);
  i32(3, plan.coarseLevel);
  u32(4, plan.twoLevel ? 1 : 0);
  u32(5, plan.hasParentFieldView ? 1 : 0);
  u32(6, plan.generationId);
  u32(7, plan.deviceOrdinal);
  u32(8, plan.laneOrdinal);
  u32(9, plan.leaseToken);
  u32(10, plan.sourceFamilyId);
  u32(11, plan.storageGeneration);
  u32(12, plan.physicsTick);
  u32(13, plan.physicsSubstep);
  u32(14, plan.positionEpoch);
  u32(15, plan.topologyEpoch);
  u32(16, plan.chartEpoch);
  u32(17, plan.levelEpoch);
  u32(18, plan.supportEpoch);
  u32(19, plan.fineReceiptCompletionOrdinal);
  u32(20, plan.coarseReceiptCompletionOrdinal);
  u32(21, plan.parentFieldCompletionOrdinal);
  u32(22, plan.layout.fineLocalHeadOffsetWords);
  u32(23, plan.layout.coarseLocalHeadOffsetWords);
  u32(24, plan.layout.localHeadCapacity);
  u32(25, plan.layout.refluxRouteCapacity);
  u32(26, plan.localPolicyId);
  u32(27, plan.refluxPolicyId);
  u32(28, 64);
  u32(29, 12);
  u32(30, 80);
  u32(31, plan.layout.localHeadWords);
  u32(32, plan.layout.refluxRouteWords);
  u32(33, plan.layout.controlWords);
  return data;
}

function encodePass(encoder, pipeline, bindGroup, workgroups, label, {
  gpuTimestampRecorder = null,
  timestampMetadata = null,
  producerId,
  stage
} = {}) {
  const timestampActive = gpuTimestampRecorder?.active === true
    && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
    && typeof gpuTimestampRecorder.endEncoderSpan === 'function';
  const span = timestampActive
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
      throw new TypeError('phase-volume interface proposal compute pass is missing required WebGPU commands');
    }
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(...workgroups);
  } finally {
    pass?.end?.();
  }
  if (span) gpuTimestampRecorder.endEncoderSpan(encoder, span);
  return 1;
}

/**
 * Build a retained read-only S9-C topology artifact.  The runtime owns only
 * proposal buffers; every receipt, field view, moment sidecar, and parent CSR
 * is borrowed and remains immutable throughout the caller-owned submission.
 */
export function createSchroederSpatialPhaseVolumeInterfaceProposalGpu(device, {
  fineFieldCapacity,
  coarseFieldCapacity = 0,
  arenaCount = 2,
  label = 'ulg-schroeder-spatial-phase-volume-interface-proposal'
} = {}) {
  assertDevice(device);
  const template = createSchroederSpatialPhaseVolumeInterfaceProposalPlan({
    fineFieldCapacity: positiveInteger(fineFieldCapacity, 'fineFieldCapacity'),
    coarseFieldCapacity: Number(coarseFieldCapacity) === 0
      ? 0
      : positiveInteger(coarseFieldCapacity, 'coarseFieldCapacity'),
    fineLevel: 0,
    coarseLevel: Number(coarseFieldCapacity) === 0 ? null : 1,
    hasParentFieldView: Number(coarseFieldCapacity) !== 0,
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
    fineReceiptCompletionOrdinal: 1,
    coarseReceiptCompletionOrdinal: Number(coarseFieldCapacity) === 0 ? 0 : 1,
    parentFieldCompletionOrdinal: Number(coarseFieldCapacity) === 0 ? 0 : 1
  });
  const layout = template.layout;
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const maxStorageBuffersPerShaderStage = positiveInteger(
    device.limits?.maxStorageBuffersPerShaderStage ?? 8,
    'device.limits.maxStorageBuffersPerShaderStage',
    0xffff
  );
  if (maxStorageBuffersPerShaderStage < 6) {
    throw new RangeError('phase-volume interface proposal requires at most six storage bindings per pass');
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
  const maxUniformBufferBindingSize = positiveInteger(
    device.limits?.maxUniformBufferBindingSize ?? 64 * 1024,
    'device.limits.maxUniformBufferBindingSize',
    Number.MAX_SAFE_INTEGER
  );
  if (maxUniformBufferBindingSize < SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_PARAMS_BYTES) {
    throw new RangeError('phase-volume interface proposal params exceed the uniform-buffer limit');
  }
  for (const [role, byteLength] of [
    ['phase-volume interface proposal control', layout.controlByteLength],
    ['phase-volume interface local heads', layout.localHeadByteLength],
    ['phase-volume interface reflux routes', layout.refluxRouteByteLength]
  ]) {
    if (byteLength > maxBufferSize || byteLength > maxStorageBufferBindingSize) {
      throw new RangeError(`${role} exceeds the WebGPU storage buffer limit`);
    }
  }
  const maxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension'
  );
  if (
    template.fineLocalDispatchX > maxComputeWorkgroupsPerDimension
    || template.coarseLocalDispatchX > maxComputeWorkgroupsPerDimension
    || template.refluxRouteDispatchX > maxComputeWorkgroupsPerDimension
  ) {
    throw new RangeError('phase-volume interface proposal dispatch exceeds the WebGPU limit');
  }

  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: createSchroederSpatialPhaseVolumeInterfaceProposalWgsl(layout)
  });
  const pipeline = (entryPoint) => device.createComputePipeline({
    label: `${label}-${entryPoint.replaceAll('_', '-')}-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  const pipelines = Object.freeze({
    localHeads: pipeline('emit_phase_volume_interface_local_heads'),
    refluxRoutes: pipeline('emit_phase_volume_interface_reflux_routes'),
    finalize: pipeline('finalize_phase_volume_interface_proposal')
  });
  const deviceId = webGpuDeviceId(device);
  let destroyed = false;
  let deviceLossObserved = false;
  let dummyReadOnlyBufferDestroyed = false;
  let serial = 0;
  let runtime = null;
  const ownershipByExecution = new WeakMap();
  const releasedExecutions = new WeakSet();
  const submittedExecutions = new WeakSet();
  const retirements = new WeakMap();

  const dummyReadOnlyBuffer = createOwnedBuffer(
    device,
    `${label}-dummy-read-only`,
    UINT32_BYTES,
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  );
  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const arenaLabel = `${label}-arena-${arenaIndex}`;
    return {
      arenaIndex,
      inUse: false,
      token: null,
      destroyedOwnedBuffers: new Set(),
      paramsBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-params`,
        layout.paramsByteLength,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      controlBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-control`,
        layout.controlByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      localHeadBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-local-heads`,
        layout.localHeadByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      refluxRouteBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-reflux-routes`,
        layout.refluxRouteByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      )
    };
  });

  const allocationEntriesForArena = (arena) => [
    { role: 'phase-volume-interface-params', arenaIndex: arena.arenaIndex, buffer: arena.paramsBuffer },
    { role: 'phase-volume-interface-control', arenaIndex: arena.arenaIndex, buffer: arena.controlBuffer },
    { role: 'phase-volume-interface-local-heads', arenaIndex: arena.arenaIndex, buffer: arena.localHeadBuffer },
    { role: 'phase-volume-interface-reflux-routes', arenaIndex: arena.arenaIndex, buffer: arena.refluxRouteBuffer }
  ];
  const retainedGpuBufferBytesPerArena = Object.freeze(arenas.map((arena) => (
    allocationEntriesForArena(arena).reduce((total, entry) => total + Number(entry.buffer?.size ?? 0), 0)
  )));
  const retainedGpuBufferBytes = retainedGpuBufferBytesPerArena.reduce(
    (total, bytes) => total + bytes,
    Number(dummyReadOnlyBuffer.size ?? 0)
  );

  function acquireArena() {
    if (destroyed) {
      throw interfaceProposalError(
        'phase-volume interface proposal runtime is destroyed',
        'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_RUNTIME_DESTROYED'
      );
    }
    if (deviceLossObserved) {
      throw interfaceProposalError(
        'phase-volume interface proposal runtime observed device loss',
        'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_DEVICE_LOST'
      );
    }
    const arena = arenas.find((candidate) => candidate.inUse !== true);
    if (!arena) {
      throw interfaceProposalError(
        'phase-volume interface proposal arenas are under backpressure',
        'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_ARENA_EXHAUSTED'
      );
    }
    const token = Object.freeze({ arenaIndex: arena.arenaIndex, serial: ++serial });
    arena.inUse = true;
    arena.token = token;
    return { arena, token };
  }

  function ownershipFor(execution) {
    const ownership = ownershipByExecution.get(execution);
    if (
      !ownership
      || releasedExecutions.has(execution)
      || ownership.arena.inUse !== true
      || ownership.arena.token !== ownership.token
      || execution?.ownerRuntime !== runtime
      || execution?.arenaIndex !== ownership.arena.arenaIndex
      || execution?.arenaGeneration !== ownership.token.serial
      || execution?.controlBuffer !== ownership.arena.controlBuffer
      || execution?.localHeadBuffer !== ownership.arena.localHeadBuffer
      || execution?.refluxRouteBuffer !== ownership.arena.refluxRouteBuffer
      || execution?.paramsBuffer !== ownership.arena.paramsBuffer
      || execution?.fineReceipt !== ownership.fineReceipt
      || execution?.coarseReceipt !== ownership.coarseReceipt
      || execution?.parentFieldView !== ownership.parentFieldView
    ) {
      throw interfaceProposalError(
        'phase-volume interface proposal execution is not owned by this runtime',
        'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_FOREIGN_EXECUTION'
      );
    }
    return ownership;
  }

  function createRetirement(execution, ownership) {
    let resolveCompletion;
    const completionPromise = new Promise((resolve) => { resolveCompletion = resolve; });
    completionPromise.catch(() => {});
    const retirement = { execution, ownership, completed: false, completionPromise, resolveCompletion };
    retirements.set(execution, retirement);
    return retirement;
  }

  function retirementFor(execution) {
    const retirement = retirements.get(execution);
    if (!retirement || retirement.execution !== execution) {
      throw interfaceProposalError(
        'phase-volume interface proposal lacks an exact retirement record',
        'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_FOREIGN_EXECUTION'
      );
    }
    if (!retirement.completed) ownershipFor(execution);
    return retirement;
  }

  function finalizeRetirement(retirement, { deviceLost = false } = {}) {
    if (retirement.completed) return false;
    const { execution, ownership } = retirement;
    const { arena, token } = ownership;
    if (arena.inUse !== true || arena.token !== token) {
      throw interfaceProposalError(
        'phase-volume interface proposal arena ownership changed before retirement',
        'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_FOREIGN_EXECUTION'
      );
    }
    if (deviceLost) {
      for (const { buffer } of allocationEntriesForArena(arena)) {
        if (!buffer || arena.destroyedOwnedBuffers.has(buffer)) continue;
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      }
    }
    arena.inUse = false;
    arena.token = null;
    releasedExecutions.add(execution);
    submittedExecutions.delete(execution);
    ownershipByExecution.delete(execution);
    execution.releaseScheduled = false;
    execution.status = deviceLost
      ? 'schroeder-spatial-phase-volume-interface-proposal-device-loss-retired'
      : 'schroeder-spatial-phase-volume-interface-proposal-released';
    retirement.completed = true;
    retirement.resolveCompletion(true);
    return true;
  }

  function assertReceipt(receipt, expectedCapacity, expectedLevel, expectedCompletion, role) {
    const state = executionSubmissionState(
      receipt,
      'schroeder-spatial-phase-volume-receipt-gpu-encoded',
      'schroeder-spatial-phase-volume-receipt-gpu-build-submitted'
    );
    const momentState = executionSubmissionState(
      receipt?.phaseVolumeMoment,
      'schroeder-spatial-phase-volume-moment-gpu-encoded',
      'schroeder-spatial-phase-volume-moment-gpu-build-submitted'
    );
    const fieldState = executionSubmissionState(
      receipt?.mechanicsFieldView,
      'schroeder-spatial-mechanics-field-view-gpu-encoded',
      'schroeder-spatial-mechanics-field-view-gpu-build-submitted'
    );
    const admission = validateSchroederSpatialPhaseVolumeReceiptDescriptor(receipt, {
      fieldCapacity: expectedCapacity,
      selectedLevel: expectedLevel,
      completionOrdinal: expectedCompletion
    });
    const fieldView = receipt?.mechanicsFieldView;
    if (
      admission.admitted !== true
      || state !== 'encoded'
      || momentState !== 'encoded'
      || fieldState !== 'encoded'
      || receipt?.schema !== ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA
      || receipt?.released === true
      || receipt?.fieldCapacity !== expectedCapacity
      || receipt?.selectedLevel !== expectedLevel
      || receipt?.completionOrdinal !== expectedCompletion
      || !fieldView
      || receipt?.phaseVolumeMoment?.mechanicsFieldView !== fieldView
      || !webGpuBufferMatchesDevice(receipt.controlBuffer, device)
      || !webGpuBufferMatchesDevice(fieldView.fieldViewBuffer, device)
      || !webGpuBufferMatchesDevice(receipt.phaseVolumeMoment?.controlBuffer, device)
      || !webGpuBufferMatchesDevice(receipt.phaseVolumeMoment?.momentBuffer, device)
    ) {
      throw new TypeError(
        `${role} receipt must be one exact live encoded S9-B artifact on this device`
      );
    }
    bufferSizeAtLeast(receipt.controlBuffer, receipt.layout.controlByteLength, `${role} receipt control`);
    bufferSizeAtLeast(
      fieldView.fieldViewBuffer,
      fieldView.layout?.byteLength ?? 64 * UINT32_BYTES,
      `${role} mechanics-field view`
    );
    return { receipt, fieldView };
  }

  function assertParentFieldView(parentFieldView, fine, coarse, plan) {
    const state = executionSubmissionState(
      parentFieldView,
      'schroeder-spatial-parent-field-view-gpu-encoded',
      'schroeder-spatial-parent-field-view-gpu-build-submitted'
    );
    const expectedLayout = createSchroederSpatialParentFieldViewLayout({
      fineFieldCapacity: plan.fineFieldCapacity,
      coarseFieldCapacity: plan.coarseFieldCapacity
    });
    if (
      state !== 'encoded'
      || parentFieldView?.schema !== ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA
      || parentFieldView?.fineFieldView !== fine.fieldView
      || parentFieldView?.coarseFieldView !== coarse.fieldView
      || parentFieldView?.fineLevel !== plan.fineLevel
      || parentFieldView?.coarseLevel !== plan.coarseLevel
      || parentFieldView?.completionOrdinal !== plan.parentFieldCompletionOrdinal
      || !sameIdentity(parentFieldView, fine.receipt)
      || parentFieldView?.layout?.byteLength !== expectedLayout.byteLength
      || parentFieldView?.layout?.wordLength !== expectedLayout.wordLength
      || parentFieldView?.layout?.fineEdgeOffsetOffsetWords !== expectedLayout.fineEdgeOffsetOffsetWords
      || parentFieldView?.layout?.fineEdgeParentOffsetWords !== expectedLayout.fineEdgeParentOffsetWords
      || parentFieldView?.layout?.fineEdgeWeightOffsetWords !== expectedLayout.fineEdgeWeightOffsetWords
      || !webGpuBufferMatchesDevice(parentFieldView?.parentFieldViewBuffer, device)
    ) {
      throw new TypeError(
        'phase-volume interface proposal requires one exact live encoded immutable parent-field CSR'
      );
    }
    bufferSizeAtLeast(
      parentFieldView.parentFieldViewBuffer,
      expectedLayout.byteLength,
      'phase-volume interface parent-field CSR'
    );
    return parentFieldView;
  }

  function encode(encoder, {
    fineReceipt,
    coarseReceipt = null,
    parentFieldView = null,
    gpuTimestampRecorder = null,
    timestampMetadata = null
  } = {}) {
    assertEncoder(encoder);
    if (!fineReceipt) throw new TypeError('phase-volume interface proposal requires fineReceipt');
    const fine = assertReceipt(
      fineReceipt,
      layout.fineFieldCapacity,
      fineReceipt.selectedLevel,
      fineReceipt.completionOrdinal,
      'fine'
    );
    const twoLevel = layout.coarseFieldCapacity > 0;
    if (!twoLevel && (coarseReceipt != null || parentFieldView != null)) {
      throw new TypeError('single-level phase-volume interface proposal cannot borrow coarse or parent evidence');
    }
    let coarse = null;
    let parent = null;
    if (twoLevel) {
      if (!coarseReceipt || !parentFieldView) {
        throw new TypeError('two-level phase-volume interface proposal requires coarse receipt and parent CSR');
      }
      coarse = assertReceipt(
        coarseReceipt,
        layout.coarseFieldCapacity,
        fineReceipt.selectedLevel + 1,
        coarseReceipt.completionOrdinal,
        'coarse'
      );
      if (!sameIdentity(fineReceipt, coarseReceipt)) {
        throw new TypeError('fine and coarse S9-B receipts must share one exact epoch identity');
      }
    }
    const plan = createSchroederSpatialPhaseVolumeInterfaceProposalPlan({
      fineFieldCapacity: layout.fineFieldCapacity,
      coarseFieldCapacity: layout.coarseFieldCapacity,
      fineLevel: fineReceipt.selectedLevel,
      coarseLevel: twoLevel ? coarseReceipt.selectedLevel : null,
      hasParentFieldView: twoLevel,
      generationId: fineReceipt.generationId,
      deviceOrdinal: fineReceipt.deviceOrdinal,
      laneOrdinal: fineReceipt.laneOrdinal,
      leaseToken: fineReceipt.leaseToken,
      sourceFamilyId: fineReceipt.sourceFamilyId,
      storageGeneration: fineReceipt.storageGeneration,
      physicsTick: fineReceipt.physicsTick,
      physicsSubstep: fineReceipt.physicsSubstep,
      positionEpoch: fineReceipt.positionEpoch,
      topologyEpoch: fineReceipt.topologyEpoch,
      chartEpoch: fineReceipt.chartEpoch,
      levelEpoch: fineReceipt.levelEpoch,
      supportEpoch: fineReceipt.supportEpoch,
      fineReceiptCompletionOrdinal: fineReceipt.completionOrdinal,
      coarseReceiptCompletionOrdinal: twoLevel ? coarseReceipt.completionOrdinal : 0,
      parentFieldCompletionOrdinal: twoLevel ? parentFieldView?.completionOrdinal : 0
    });
    if (twoLevel) parent = assertParentFieldView(parentFieldView, fine, coarse, plan);
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
        size: SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_PARAMS_BYTES
      };
      const resources = new Map([
        [0, resource(fineReceipt.controlBuffer)],
        [1, resource(fine.fieldView.fieldViewBuffer)],
        [2, resource(twoLevel ? coarseReceipt.controlBuffer : dummyReadOnlyBuffer)],
        [3, resource(twoLevel ? coarse.fieldView.fieldViewBuffer : dummyReadOnlyBuffer)],
        [4, resource(twoLevel ? parent.parentFieldViewBuffer : dummyReadOnlyBuffer)],
        [5, resource(arena.localHeadBuffer)],
        [6, resource(arena.refluxRouteBuffer)],
        [7, resource(arena.controlBuffer)],
        [8, paramsResource]
      ]);
      // WebGPU auto layouts intentionally omit bindings not referenced by an
      // entry point.  Bind exactly each pass's live subset rather than a
      // superset: this keeps the artifact portable on native Vulkan/Dawn and
      // makes it impossible for a topology pass to acquire mutable state.
      const bindGroup = (pipelineObject, suffix, bindings) => device.createBindGroup({
        label: `${label}-arena-${arena.arenaIndex}-${suffix}-bindings`,
        layout: pipelineObject.getBindGroupLayout(0),
        entries: bindings.map((binding) => ({ binding, resource: resources.get(binding) }))
      });
      const localBindGroup = bindGroup(
        pipelines.localHeads,
        'local-heads',
        [0, 1, 2, 3, 5, 7, 8]
      );
      const routeBindGroup = twoLevel ? bindGroup(
        pipelines.refluxRoutes,
        'reflux-routes',
        [1, 3, 4, 6, 7, 8]
      ) : null;
      const finalizeBindGroup = bindGroup(
        pipelines.finalize,
        'finalize',
        [0, 1, 2, 3, 4, 7, 8]
      );
      execution = {
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA,
        status: 'schroeder-spatial-phase-volume-interface-proposal-gpu-encoding',
        ready: false,
        selected: false,
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        fineReceipt,
        coarseReceipt: twoLevel ? coarseReceipt : null,
        parentFieldView: twoLevel ? parent : null,
        finePhaseVolumeMoment: fineReceipt.phaseVolumeMoment,
        coarsePhaseVolumeMoment: twoLevel ? coarseReceipt.phaseVolumeMoment : null,
        fineMechanicsFieldView: fine.fieldView,
        coarseMechanicsFieldView: twoLevel ? coarse.fieldView : null,
        fineMechanicsFieldViewBuffer: fine.fieldView.fieldViewBuffer,
        coarseMechanicsFieldViewBuffer: twoLevel ? coarse.fieldView.fieldViewBuffer : null,
        parentFieldViewBuffer: twoLevel ? parent.parentFieldViewBuffer : null,
        controlBuffer: arena.controlBuffer,
        localHeadBuffer: arena.localHeadBuffer,
        refluxRouteBuffer: arena.refluxRouteBuffer,
        paramsBuffer: arena.paramsBuffer,
        encodedDispatchCount: 0,
        encodedComputePassCount: 0,
        maxStorageBindingCountPerPass: 6,
        distinctStorageResourceCount: 8,
        storageBindingCount: 6,
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
        terminalSealPolicy: 'gpu-finalizer-writes-last;future-operator-requires-sealed-ready-admitted',
        pairPolicy: 'compressed-exact-local-spans-and-parent-csr;no-materialized-pair-graph'
      };
      Object.defineProperty(execution, 'ownerRuntime', { value: runtime, enumerable: false });
      Object.defineProperty(execution, 'released', {
        get() { return releasedExecutions.has(execution); },
        enumerable: true
      });
      const ownership = { arena, token, fineReceipt, coarseReceipt: execution.coarseReceipt, parentFieldView: execution.parentFieldView };
      ownershipByExecution.set(execution, ownership);
      createRetirement(execution, ownership);
      recordingStarted = true;
      encoder.clearBuffer(arena.controlBuffer);
      encoder.clearBuffer(arena.localHeadBuffer);
      encoder.clearBuffer(arena.refluxRouteBuffer);
      const commonTimestamp = {
        generationId: plan.generationId,
        fineLevel: plan.fineLevel,
        ...(timestampMetadata || {})
      };
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.localHeads,
        localBindGroup,
        [Math.max(plan.fineLocalDispatchX, plan.coarseLocalDispatchX), 1, 1],
        `${label}EmitLocalHeads`,
        {
          gpuTimestampRecorder,
          timestampMetadata: commonTimestamp,
          producerId: 'schroeder-spatial-phase-volume-interface-local-topology',
          stage: 'emit-local-heads'
        }
      );
      if (twoLevel) {
        encodedDispatchCount += encodePass(
          encoder,
          pipelines.refluxRoutes,
          routeBindGroup,
          [plan.refluxRouteDispatchX, 1, 1],
          `${label}EmitRefluxRoutes`,
          {
            gpuTimestampRecorder,
            timestampMetadata: commonTimestamp,
            producerId: 'schroeder-spatial-phase-volume-interface-reflux-topology',
            stage: 'emit-reflux-routes'
          }
        );
      }
      encodedDispatchCount += encodePass(
        encoder,
        pipelines.finalize,
        finalizeBindGroup,
        [1, 1, 1],
        `${label}Finalize`,
        {
          gpuTimestampRecorder,
          timestampMetadata: commonTimestamp,
          producerId: 'schroeder-spatial-phase-volume-interface-finalize',
          stage: 'finalize'
        }
      );
      execution.encodedDispatchCount = encodedDispatchCount;
      execution.encodedComputePassCount = encodedDispatchCount;
      execution.ready = true;
      execution.selected = true;
      execution.status = 'schroeder-spatial-phase-volume-interface-proposal-gpu-encoded';
      return execution;
    } catch (error) {
      if (execution && recordingStarted) {
        execution.encodedDispatchCount = encodedDispatchCount;
        execution.encodedComputePassCount = encodedDispatchCount;
        execution.ready = false;
        execution.selected = false;
        execution.status = 'schroeder-spatial-phase-volume-interface-proposal-encode-failed-awaiting-discard';
        execution.failureRequiresDiscardedEncoder = true;
        try {
          Object.defineProperty(error, 'phaseVolumeInterfaceProposalExecution', {
            value: execution,
            enumerable: true,
            configurable: true
          });
        } catch {
          // Preserve the original error on non-extensible host exceptions.
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

  function parentSubmitted(parent) {
    try {
      const submitted = parent?.ownerRuntime?.ownsExecution?.(parent) === true
        && parent.ownerRuntime?.isExecutionSubmitted?.(parent) === true;
      if (!submitted) return false;
      if (parent?.schema !== ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA) {
        return true;
      }
      const momentSubmitted = executionSubmissionState(
        parent.phaseVolumeMoment,
        'schroeder-spatial-phase-volume-moment-gpu-encoded',
        'schroeder-spatial-phase-volume-moment-gpu-build-submitted'
      ) === 'submitted';
      const fieldSubmitted = executionSubmissionState(
        parent.mechanicsFieldView,
        'schroeder-spatial-mechanics-field-view-gpu-encoded',
        'schroeder-spatial-mechanics-field-view-gpu-build-submitted'
      ) === 'submitted';
      return momentSubmitted
        && fieldSubmitted
        && parent.phaseVolumeMoment?.mechanicsFieldView === parent.mechanicsFieldView;
    } catch {
      return false;
    }
  }

  function markExecutionSubmitted(execution) {
    const ownership = ownershipFor(execution);
    if (
      execution.status !== 'schroeder-spatial-phase-volume-interface-proposal-gpu-encoded'
      || execution.ready !== true
      || execution.selected !== true
      || execution.failureRequiresDiscardedEncoder === true
    ) {
      throw interfaceProposalError(
        'failed phase-volume interface proposal encoding requires discarded-encoder release',
        'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_FAILED_ENCODING'
      );
    }
    if (submittedExecutions.has(execution)) return false;
    const parents = [ownership.fineReceipt, ownership.coarseReceipt, ownership.parentFieldView]
      .filter(Boolean);
    if (!parents.every(parentSubmitted)) {
      throw new Error(
        'phase-volume interface proposal parents must be marked submitted before the child'
      );
    }
    submittedExecutions.add(execution);
    execution.submitPerformed = true;
    execution.status = 'schroeder-spatial-phase-volume-interface-proposal-gpu-build-submitted';
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
    const retirement = retirementFor(execution);
    if (retirement.completed) return false;
    if (submittedExecutions.has(execution)) {
      throw new Error('submitted phase-volume interface proposal requires a queue fence');
    }
    return finalizeRetirement(retirement);
  }

  function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    const retirement = retirementFor(execution);
    if (retirement.completed) return retirement.completionPromise;
    if (!submittedExecutions.has(execution)) {
      throw new Error('unsubmitted phase-volume interface proposal requires discarded-encoder release');
    }
    execution.releaseScheduled = true;
    const promise = Promise.resolve(submissionFence).then(
      () => finalizeRetirement(retirement),
      (error) => {
        execution.releaseScheduled = false;
        execution.status = 'schroeder-spatial-phase-volume-interface-proposal-release-blocked';
        throw error;
      }
    );
    promise.catch(() => {});
    return promise;
  }

  function quarantineExecutionAfterDeviceLoss(execution) {
    const retirement = retirementFor(execution);
    if (retirement.completed) return retirement.completionPromise;
    const loss = device?.lost;
    if (!loss?.then) {
      throw interfaceProposalError(
        'phase-volume interface proposal device-loss quarantine requires GPUDevice.lost',
        'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_DEVICE_LOSS_EVIDENCE',
        TypeError
      );
    }
    deviceLossObserved = true;
    runtime.status = 'schroeder-spatial-phase-volume-interface-proposal-runtime-device-loss-quarantined';
    execution.releaseScheduled = true;
    const promise = Promise.resolve(loss).then(() => finalizeRetirement(retirement, { deviceLost: true }));
    promise.catch(() => {});
    return promise;
  }

  function activeExecutionCount() {
    return arenas.reduce((count, arena) => count + (arena.inUse ? 1 : 0), 0);
  }

  function allocationEntries() {
    return [
      { role: 'phase-volume-interface-dummy-read-only', arenaIndex: null, buffer: dummyReadOnlyBuffer },
      ...arenas.flatMap(allocationEntriesForArena)
    ];
  }

  function destroy() {
    if (destroyed) return true;
    if (arenas.some((arena) => arena.inUse)) return false;
    destroyed = true;
    if (!dummyReadOnlyBufferDestroyed) {
      dummyReadOnlyBuffer.destroy?.();
      dummyReadOnlyBufferDestroyed = true;
    }
    for (const arena of arenas) {
      for (const { buffer } of allocationEntriesForArena(arena)) {
        if (!buffer || arena.destroyedOwnedBuffers.has(buffer)) continue;
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      }
    }
    runtime.status = 'schroeder-spatial-phase-volume-interface-proposal-runtime-destroyed';
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA,
    status: 'schroeder-spatial-phase-volume-interface-proposal-gpu-runtime-ready',
    deviceId,
    fineFieldCapacity: layout.fineFieldCapacity,
    coarseFieldCapacity: layout.coarseFieldCapacity,
    arenaCount: resolvedArenaCount,
    layout,
    pipelineCount: Object.keys(pipelines).length,
    maxStorageBindingCountPerPass: 6,
    distinctStorageResourceCount: 8,
    storageBindingCount: 6,
    retainedGpuBufferBytes,
    normalHotLoopReadbackFree: true,
    encode,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    releaseExecution,
    releaseExecutionAfter,
    quarantineExecutionAfterDeviceLoss,
    activeExecutionCount,
    allocationEntries,
    destroy
  };
  return runtime;
}

export {
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA,
  validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor
};
