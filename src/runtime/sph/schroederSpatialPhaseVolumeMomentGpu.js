import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_PARAMS_BYTES,
  SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA,
  createSchroederSpatialPhaseVolumeMomentLayout,
  createSchroederSpatialPhaseVolumeMomentPlan
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeMoment.js';
import {
  createSchroederSpatialPhaseVolumeMomentWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeMomentWgsl.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  validateSchroederSpatialActiveSourceViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialActiveSourceView.js';
import {
  SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
  ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
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

function phaseVolumeMomentError(message, code, ErrorType = Error) {
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
    throw new TypeError('phase-volume moment sidecar requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (
    !encoder?.clearBuffer
    || !encoder?.beginComputePass
  ) {
    throw new TypeError(
      'phase-volume moment encoding requires a caller-owned GPUCommandEncoder-like object'
    );
  }
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
  const data = new ArrayBuffer(SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (word, value) => view.setUint32(word * UINT32_BYTES, Number(value) >>> 0, true);
  u32(0, plan.sourceCount);
  u32(1, plan.sourceCapacity);
  u32(2, plan.fieldCapacity);
  u32(3, plan.candidateCount ?? plan.candidateCapacity);
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
  u32(22, plan.assignmentStrideFloats);
  u32(23, plan.mechanicsStrideFloats);
  u32(24, plan.rawVolumeRatioJMechanicsWord);
  u32(25, plan.rawRestVolumeMechanicsWord);
  u32(26, plan.sourceRowLayoutId);
  return data;
}

function encodePass(encoder, pipeline, bindGroup, workgroups, label, {
  gpuTimestampRecorder = null,
  timestampMetadata = null,
  producerId,
  stage
} = {}) {
  const timestampSpan = gpuTimestampRecorder?.active === true
    && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
    ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
        producerId,
        stage,
        spanClass: 'same-production-command-encoder',
        ...(timestampMetadata || {})
      })
    : null;
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...workgroups);
  pass.end();
  if (timestampSpan && typeof gpuTimestampRecorder.endEncoderSpan === 'function') {
    gpuTimestampRecorder.endEncoderSpan(encoder, timestampSpan);
  }
  return 1;
}

function encodeIndirectPass(
  encoder,
  pipeline,
  bindGroup,
  indirectBuffer,
  indirectOffsetBytes,
  label,
  {
    gpuTimestampRecorder = null,
    timestampMetadata = null,
    producerId,
    stage
  } = {}
) {
  const timestampSpan = gpuTimestampRecorder?.active === true
    && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
    ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
        producerId,
        stage,
        spanClass: 'same-production-command-encoder',
        ...(timestampMetadata || {})
      })
    : null;
  const pass = encoder.beginComputePass({ label });
  if (
    typeof pass?.setPipeline !== 'function'
    || typeof pass?.setBindGroup !== 'function'
    || typeof pass?.dispatchWorkgroupsIndirect !== 'function'
    || typeof pass?.end !== 'function'
  ) {
    pass?.end?.();
    throw new TypeError(
      'phase-volume moment v2 requires indirect WebGPU dispatch support'
    );
  }
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffsetBytes);
  pass.end();
  if (timestampSpan && typeof gpuTimestampRecorder.endEncoderSpan === 'function') {
    gpuTimestampRecorder.endEncoderSpan(encoder, timestampSpan);
  }
  return 1;
}

/**
 * Create a retained GPU diagnostic sidecar for strict per-field V0*J volume
 * moments. Its source and field-view buffers are borrowed read-only; only the
 * sidecar's own arena buffers are released or destroyed here.
 */
export function createSchroederSpatialPhaseVolumeMomentGpu(device, {
  maxSourceCount,
  fieldCapacity = null,
  arenaCount = 2,
  label = 'ulg-schroeder-spatial-phase-volume-moment'
} = {}) {
  assertDevice(device);
  const resolvedMaxSourceCount = positiveInteger(
    maxSourceCount,
    'maxSourceCount',
    Math.floor(0xffff_ffff / 27)
  );
  const candidateCapacity = resolvedMaxSourceCount * 27;
  const resolvedFieldCapacity = positiveInteger(
    fieldCapacity ?? candidateCapacity,
    'fieldCapacity',
    candidateCapacity
  );
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const template = createSchroederSpatialPhaseVolumeMomentPlan({
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
  if (maxStorageBuffersPerShaderStage < 8) {
    throw new RangeError('phase-volume moment sidecar requires eight storage bindings');
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
    ['phase-volume control', layout.controlByteLength],
    ['phase-volume moments', layout.momentByteLength],
    ['phase-volume contributions', layout.candidateContributionByteLength],
    ['phase-volume scratch', layout.scratchByteLength]
  ]) {
    if (byteLength > maxBufferSize || byteLength > maxStorageBufferBindingSize) {
      throw new RangeError(`${name} exceeds the WebGPU storage buffer limit`);
    }
  }
  const maxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension'
  );
  if (
    Math.ceil(layout.candidateCapacity / SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_WORKGROUP_SIZE)
      > maxComputeWorkgroupsPerDimension
  ) {
    throw new RangeError('phase-volume moment candidate dispatch exceeds the WebGPU limit');
  }

  const modules = Object.freeze({
    v1: device.createShaderModule({
      label: `${label}-v1-shader`,
      code: createSchroederSpatialPhaseVolumeMomentWgsl(layout, {
        sourceAuthorityVersion:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1
      })
    }),
    v2: device.createShaderModule({
      label: `${label}-v2-shader`,
      code: createSchroederSpatialPhaseVolumeMomentWgsl(layout, {
        sourceAuthorityVersion:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
      })
    })
  });
  const pipeline = (entryPoint, route, module) => device.createComputePipeline({
    label: `${label}-${route}-${entryPoint.replaceAll('_', '-')}-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  const createPipelineSet = (route, module) => Object.freeze({
    emit: pipeline('emit_phase_volume_moment_contributions', route, module),
    ranges: pipeline('materialize_phase_volume_moment_ranges', route, module),
    reduce: pipeline('reduce_phase_volume_moments', route, module),
    finalize: pipeline('finalize_phase_volume_moments', route, module)
  });
  const pipelineSets = Object.freeze({
    v1: createPipelineSet('v1', modules.v1),
    v2: createPipelineSet('v2', modules.v2)
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
      bindGroupCache: new Map(),
      paramsBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-params`,
        SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      controlBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-control`,
        layout.controlByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      momentBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-moments`,
        layout.momentByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      candidateContributionBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-contributions`,
        layout.candidateContributionByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      ),
      scratchBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-scratch`,
        layout.scratchByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      )
    };
  });

  const allocationEntriesForArena = (arena) => [
    { role: 'phase-volume-moment-params', arenaIndex: arena.arenaIndex, buffer: arena.paramsBuffer },
    { role: 'phase-volume-moment-control', arenaIndex: arena.arenaIndex, buffer: arena.controlBuffer },
    { role: 'phase-volume-moment-rows', arenaIndex: arena.arenaIndex, buffer: arena.momentBuffer },
    { role: 'phase-volume-moment-contributions', arenaIndex: arena.arenaIndex, buffer: arena.candidateContributionBuffer },
    { role: 'phase-volume-moment-scratch', arenaIndex: arena.arenaIndex, buffer: arena.scratchBuffer }
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
      throw phaseVolumeMomentError(
        'phase-volume moment runtime is destroyed',
        'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_RUNTIME_DESTROYED'
      );
    }
    if (deviceLossObserved) {
      throw phaseVolumeMomentError(
        'phase-volume moment runtime observed device loss',
        'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_DEVICE_LOST'
      );
    }
    const arena = arenas.find((candidate) => (
      candidate.inUse !== true && candidate.retired !== true
    ));
    if (!arena) {
      throw phaseVolumeMomentError(
        'phase-volume moment arenas are under backpressure',
        'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_ARENA_EXHAUSTED'
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
      || execution?.momentBuffer !== ownership.arena.momentBuffer
      || execution?.candidateContributionBuffer !== ownership.arena.candidateContributionBuffer
      || execution?.scratchBuffer !== ownership.arena.scratchBuffer
      || execution?.sourceBuffer !== ownership.sourceBuffer
      || execution?.sourceMechanicsBuffer !== ownership.sourceMechanicsBuffer
      || execution?.mechanicsFieldView !== ownership.mechanicsFieldView
      || execution?.parentMechanicsFieldView !== ownership.mechanicsFieldView
      || execution?.spatialExecution !== ownership.spatialExecution
      || execution?.activeSourceView !== ownership.activeSourceView
      || execution?.activeSourceCountAuthority
        !== ownership.activeSourceCountAuthority
      || execution?.candidateCountAuthority
        !== ownership.candidateCountAuthority
    ) {
      throw phaseVolumeMomentError(
        'phase-volume moment execution is not owned by this runtime',
        'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_FOREIGN_EXECUTION'
      );
    }
    return ownership;
  }

  function retirementFor(execution) {
    const record = retirementRecords.get(execution);
    if (!record || record.execution !== execution) {
      throw phaseVolumeMomentError(
        'phase-volume moment execution lacks an exact retirement record',
        'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_FOREIGN_EXECUTION'
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
          'phase-volume moment device-loss arena retirement was incomplete'
        );
    }
    return true;
  }

  function finishRetirement(record, { deviceLost = false } = {}) {
    if (record.completed) return true;
    const { execution, ownership } = record;
    const { arena, token } = ownership;
    if (arena.inUse !== true || arena.token !== token) {
      throw phaseVolumeMomentError(
        'phase-volume moment arena ownership changed before retirement',
        'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_FOREIGN_EXECUTION'
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
      ? 'schroeder-spatial-phase-volume-moment-device-loss-retired'
      : 'schroeder-spatial-phase-volume-moment-released';
    record.activeAttempt = null;
    record.completed = true;
    record.resolveCompletion(true);
    return true;
  }

  function assertMechanicsFieldView(mechanicsFieldView, sourceBuffer) {
    let owned = false;
    try {
      owned = mechanicsFieldView?.ownerRuntime?.ownsExecution?.(mechanicsFieldView) === true;
    } catch {
      owned = false;
    }
    const sourceAuthorityVersion = Number(
      mechanicsFieldView?.sourceAuthorityVersion
        ?? SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1
    );
    const directoryV2 =
      sourceAuthorityVersion
        === SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2;
    if (
      mechanicsFieldView?.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
      || mechanicsFieldView.status !== 'schroeder-spatial-mechanics-field-view-gpu-encoded'
      || mechanicsFieldView.submitPerformed !== false
      || mechanicsFieldView.released === true
      || !owned
      || mechanicsFieldView.sourceBuffer !== sourceBuffer
      || !mechanicsFieldView.fieldViewBuffer
      || !mechanicsFieldView.stableCandidateOrderBuffer
      || mechanicsFieldView.indirectDispatchBuffer !== mechanicsFieldView.fieldViewBuffer
      || mechanicsFieldView.indirectDispatchOffsetBytes !== FIELD_VIEW_DISPATCH_OFFSET_BYTES
      || (
        directoryV2
          ? mechanicsFieldView.stableCandidateOrderCount !== null
            || mechanicsFieldView.candidateCount !== null
          : mechanicsFieldView.stableCandidateOrderCount
              !== mechanicsFieldView.candidateCount
      )
      || mechanicsFieldView.sourceCapacity !== resolvedMaxSourceCount
      || mechanicsFieldView.fieldCapacity !== resolvedFieldCapacity
      || mechanicsFieldView.sourceRowLayoutId !== 1
      || !webGpuBufferMatchesDevice(mechanicsFieldView.fieldViewBuffer, device)
      || !webGpuBufferMatchesDevice(mechanicsFieldView.stableCandidateOrderBuffer, device)
    ) {
      throw new TypeError(
        'phase-volume moment requires one exact live encoded mechanics-field view'
      );
    }
    bufferSizeAtLeast(
      mechanicsFieldView.fieldViewBuffer,
      Math.max(mechanicsFieldView.layout?.byteLength ?? 0, FIELD_VIEW_DISPATCH_OFFSET_BYTES + 12),
      'phase-volume mechanics field view'
    );
    bufferSizeAtLeast(
      mechanicsFieldView.stableCandidateOrderBuffer,
      (
        directoryV2
          ? mechanicsFieldView.candidateCapacity
          : mechanicsFieldView.candidateCount
      ) * UINT32_BYTES,
      'phase-volume stable candidate order'
    );
    if (directoryV2) {
      const spatialExecution = mechanicsFieldView.spatialExecution;
      const activeSourceView = mechanicsFieldView.activeSourceView;
      const activeSourceCountAuthority =
        mechanicsFieldView.activeSourceCountAuthority;
      const candidateCountAuthority =
        mechanicsFieldView.stableCandidateOrderCountAuthority;
      let activeAdmission = { admitted: false };
      try {
        activeAdmission = validateSchroederSpatialActiveSourceViewDescriptor(
          activeSourceView,
          {
            physicalSourceCount: mechanicsFieldView.sourceCount,
            physicalSourceCapacity: mechanicsFieldView.sourceCapacity,
            sourceBuffer,
            activeSourceViewBuffer:
              mechanicsFieldView.activeSourceViewBuffer,
            generationId: mechanicsFieldView.generationId,
            deviceOrdinal: mechanicsFieldView.deviceOrdinal,
            laneOrdinal: mechanicsFieldView.laneOrdinal,
            leaseToken: mechanicsFieldView.leaseToken,
            sourceFamilyId: mechanicsFieldView.sourceFamilyId,
            storageGeneration: mechanicsFieldView.storageGeneration,
            physicsTick: mechanicsFieldView.physicsTick,
            physicsSubstep: mechanicsFieldView.physicsSubstep,
            positionEpoch: mechanicsFieldView.positionEpoch,
            topologyEpoch: mechanicsFieldView.topologyEpoch,
            chartEpoch: mechanicsFieldView.chartEpoch,
            levelEpoch: mechanicsFieldView.levelEpoch,
            supportEpoch: mechanicsFieldView.supportEpoch,
            buildOrdinal: mechanicsFieldView.completionOrdinal
          }
        );
      } catch {
        activeAdmission = { admitted: false };
      }
      if (
        activeAdmission.admitted !== true
        || mechanicsFieldView.directorySchema
          !== ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
        || mechanicsFieldView.directoryAbiVersion
          !== SCHROEDER_SPATIAL_EPOCH_V2_VERSION
        || mechanicsFieldView.sourceWorkIdentity !== 'gpu-active-ordinal'
        || spatialExecution?.schema
          !== ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
        || spatialExecution.abiVersion
          !== SCHROEDER_SPATIAL_EPOCH_V2_VERSION
        || spatialExecution.reverseEncoding
          !== SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE
        || spatialExecution.physicalSourceCount
          !== mechanicsFieldView.sourceCount
        || spatialExecution.physicalSourceCapacity
          !== mechanicsFieldView.sourceCapacity
        || spatialExecution.sourceBuffer !== sourceBuffer
        || spatialExecution.directoryBuffer
          !== mechanicsFieldView.directoryBuffer
        || spatialExecution.activeSourceView !== activeSourceView
        || spatialExecution.activeSourceViewBuffer
          !== mechanicsFieldView.activeSourceViewBuffer
        || spatialExecution.activeSourceCountAuthority
          !== activeSourceCountAuthority
        || activeSourceCountAuthority?.activeSourceView !== activeSourceView
        || activeSourceCountAuthority?.buffer
          !== mechanicsFieldView.activeSourceViewBuffer
        || activeSourceCountAuthority?.offsetWords !== 18
        || activeSourceCountAuthority?.offsetBytes !== 18 * UINT32_BYTES
        || activeSourceCountAuthority?.capacity
          !== activeSourceView.activeSourceCapacity
        || candidateCountAuthority?.buffer
          !== mechanicsFieldView.activeSourceViewBuffer
        || candidateCountAuthority?.offsetWords !== 43
        || candidateCountAuthority?.sealOffsetWords !== 30
        || candidateCountAuthority?.expectedSeal
          !== mechanicsFieldView.completionOrdinal
        || !webGpuBufferMatchesDevice(
          mechanicsFieldView.activeSourceViewBuffer,
          device
        )
      ) {
        throw new TypeError(
          'phase-volume moment requires exact directory-v2 ActiveSource lineage'
        );
      }
      bufferSizeAtLeast(
        mechanicsFieldView.activeSourceViewBuffer,
        activeSourceView.layout?.byteLength ?? 0,
        'phase-volume ActiveSource view'
      );
      return {
        sourceAuthorityVersion,
        directoryV2,
        spatialExecution,
        activeSourceView,
        activeSourceCountAuthority,
        candidateCountAuthority
      };
    }
    if (
      sourceAuthorityVersion
        !== SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1
      || mechanicsFieldView.directorySchema != null
      || mechanicsFieldView.directoryAbiVersion != null
      || mechanicsFieldView.spatialExecution != null
      || mechanicsFieldView.activeSourceView != null
      || mechanicsFieldView.activeSourceCountAuthority != null
    ) {
      throw new TypeError(
        'phase-volume moment requires an exact v1 or v2 source authority'
      );
    }
    return {
      sourceAuthorityVersion,
      directoryV2,
      spatialExecution: null,
      activeSourceView: null,
      activeSourceCountAuthority: null,
      candidateCountAuthority: null
    };
  }

  function encode(encoder, {
    sourceBuffer,
    sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed = false,
    mechanicsFieldView,
    gpuTimestampRecorder = null,
    timestampMetadata = null
  } = {}) {
    assertEncoder(encoder);
    if (!sourceBuffer || !webGpuBufferMatchesDevice(sourceBuffer, device)) {
      throw new TypeError('phase-volume source assignment buffer must belong to the runtime device');
    }
    if (
      !sourceMechanicsBuffer
      || sourceMechanicsBufferBorrowed !== true
      || !webGpuBufferMatchesDevice(sourceMechanicsBuffer, device)
    ) {
      throw new TypeError(
        'phase-volume moment requires the exact borrowed mechanics source buffer'
      );
    }
    const authority = assertMechanicsFieldView(mechanicsFieldView, sourceBuffer);
    const plan = createSchroederSpatialPhaseVolumeMomentPlan({
      sourceCount: mechanicsFieldView.sourceCount,
      sourceCapacity: resolvedMaxSourceCount,
      fieldCapacity: resolvedFieldCapacity,
      selectedLevel: mechanicsFieldView.selectedLevel,
      gridNodeCount: mechanicsFieldView.gridNodeCount,
      gridSpacingM: mechanicsFieldView.gridSpacingM,
      generationId: mechanicsFieldView.generationId,
      deviceOrdinal: mechanicsFieldView.deviceOrdinal,
      laneOrdinal: mechanicsFieldView.laneOrdinal,
      leaseToken: mechanicsFieldView.leaseToken,
      sourceFamilyId: mechanicsFieldView.sourceFamilyId,
      storageGeneration: mechanicsFieldView.storageGeneration,
      physicsTick: mechanicsFieldView.physicsTick,
      physicsSubstep: mechanicsFieldView.physicsSubstep,
      positionEpoch: mechanicsFieldView.positionEpoch,
      topologyEpoch: mechanicsFieldView.topologyEpoch,
      chartEpoch: mechanicsFieldView.chartEpoch,
      levelEpoch: mechanicsFieldView.levelEpoch,
      supportEpoch: mechanicsFieldView.supportEpoch,
      completionOrdinal: mechanicsFieldView.completionOrdinal,
      sourceAuthorityVersion: authority.sourceAuthorityVersion
    });
    if (!sameIdentity(plan, mechanicsFieldView)) {
      throw new TypeError('phase-volume moment plan lost exact mechanics-field lineage');
    }
    bufferSizeAtLeast(
      sourceBuffer,
      plan.sourceCount * plan.assignmentStrideFloats * Float32Array.BYTES_PER_ELEMENT,
      'phase-volume source assignment buffer'
    );
    bufferSizeAtLeast(
      sourceMechanicsBuffer,
      plan.sourceCount * plan.mechanicsStrideFloats * Float32Array.BYTES_PER_ELEMENT,
      'phase-volume source mechanics buffer'
    );
    const { arena, token } = acquireArena();
    try {
      device.queue.writeBuffer(arena.paramsBuffer, 0, paramsData(plan));
      encoder.clearBuffer(arena.controlBuffer);
      encoder.clearBuffer(arena.momentBuffer);
      encoder.clearBuffer(arena.scratchBuffer);
      const resource = (buffer) => ({ buffer });
      const paramsResource = {
        buffer: arena.paramsBuffer,
        offset: 0,
        size: SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_PARAMS_BYTES
      };
      const entries = Object.freeze({
        assignment: { binding: 0, resource: resource(sourceBuffer) },
        mechanics: { binding: 1, resource: resource(sourceMechanicsBuffer) },
        field: { binding: 2, resource: resource(mechanicsFieldView.fieldViewBuffer) },
        sorted: { binding: 3, resource: resource(mechanicsFieldView.stableCandidateOrderBuffer) },
        contribution: { binding: 4, resource: resource(arena.candidateContributionBuffer) },
        scratch: { binding: 5, resource: resource(arena.scratchBuffer) },
        control: { binding: 6, resource: resource(arena.controlBuffer) },
        moments: { binding: 7, resource: resource(arena.momentBuffer) },
        params: { binding: 8, resource: paramsResource },
        activeSource: authority.directoryV2
          ? {
              binding: 9,
              resource: resource(
                authority.activeSourceView.activeSourceViewBuffer
              )
            }
          : null
      });
      const pipelines = authority.directoryV2
        ? pipelineSets.v2
        : pipelineSets.v1;
      const withActiveSource = (bindingEntries) => authority.directoryV2
        ? [...bindingEntries, entries.activeSource]
        : bindingEntries;
      const bindGroup = (pipelineObject, bindingEntries, suffix) => {
        const cached = arena.bindGroupCache.get(suffix);
        const entriesMatch = cached?.entries.length === bindingEntries.length
          && cached.entries.every((left, index) => {
            const right = bindingEntries[index];
            return left.binding === right.binding
              && left.resource?.buffer === right.resource?.buffer
              && (left.resource?.offset ?? 0) === (right.resource?.offset ?? 0)
              && (left.resource?.size ?? null) === (right.resource?.size ?? null);
          });
        if (cached?.pipeline === pipelineObject && entriesMatch) {
          return cached.bindGroup;
        }
        const created = device.createBindGroup({
          label: `${label}-arena-${arena.arenaIndex}-${suffix}-bindings`,
          layout: pipelineObject.getBindGroupLayout(0),
          entries: bindingEntries
        });
        arena.bindGroupCache.set(suffix, {
          pipeline: pipelineObject,
          entries: bindingEntries.map(({ binding, resource: bindingResource }) => ({
            binding,
            resource: bindingResource
          })),
          bindGroup: created
        });
        return created;
      };
      const emitBindGroup = bindGroup(pipelines.emit, withActiveSource([
        entries.assignment,
        entries.mechanics,
        entries.field,
        entries.sorted,
        entries.contribution,
        entries.scratch,
        entries.control,
        entries.params
      ]), 'emit');
      const rangesBindGroup = bindGroup(pipelines.ranges, withActiveSource([
        entries.field,
        entries.scratch,
        entries.control,
        entries.params
      ]), 'ranges');
      const reduceBindGroup = bindGroup(pipelines.reduce, withActiveSource([
        entries.field,
        entries.contribution,
        entries.scratch,
        entries.control,
        entries.moments,
        entries.params
      ]), 'reduce');
      const finalizeBindGroup = bindGroup(pipelines.finalize, withActiveSource([
        entries.field,
        entries.control,
        entries.params
      ]), 'finalize');
      const dispatch = authority.directoryV2
        ? null
        : Math.ceil(
            plan.candidateCount
              / SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_WORKGROUP_SIZE
          );
      // V1 visits the complete retained row capacity and zeros its inactive
      // tail. V2 clears the whole arena first, then dispatches only the
      // mechanics field's authenticated GPU shape.
      const fieldCapacityDispatch = Math.ceil(
        plan.fieldCapacity
          / SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_WORKGROUP_SIZE
      );
      let encodedDispatchCount = 0;
      const commonTimestamp = {
        generationId: plan.generationId,
        selectedLevel: plan.selectedLevel,
        ...timestampMetadata
      };
      const encodeCandidatePass = (pipelineObject, bindGroupObject, passLabel, options) => (
        authority.directoryV2
          ? encodeIndirectPass(
              encoder,
              pipelineObject,
              bindGroupObject,
              authority.activeSourceView.activeSourceViewBuffer,
              authority.activeSourceView.candidateDispatchOffsetBytes,
              passLabel,
              options
            )
          : encodePass(
              encoder,
              pipelineObject,
              bindGroupObject,
              [dispatch, 1, 1],
              passLabel,
              options
            )
      );
      encodedDispatchCount += encodeCandidatePass(
        pipelines.emit,
        emitBindGroup,
        `${label}EmitContributions`,
        {
          gpuTimestampRecorder,
          timestampMetadata: commonTimestamp,
          producerId: 'schroeder-spatial-phase-volume-moment-emit',
          stage: 'emit-contributions'
        }
      );
      encodedDispatchCount += encodeCandidatePass(
        pipelines.ranges,
        rangesBindGroup,
        `${label}MaterializeRanges`,
        {
          gpuTimestampRecorder,
          timestampMetadata: commonTimestamp,
          producerId: 'schroeder-spatial-phase-volume-moment-ranges',
          stage: 'materialize-ranges'
        }
      );
      encodedDispatchCount += authority.directoryV2
        ? encodeIndirectPass(
            encoder,
            pipelines.reduce,
            reduceBindGroup,
            mechanicsFieldView.indirectDispatchBuffer,
            mechanicsFieldView.indirectDispatchOffsetBytes,
            `${label}Reduce`,
            {
              gpuTimestampRecorder,
              timestampMetadata: commonTimestamp,
              producerId: 'schroeder-spatial-phase-volume-moment-reduce',
              stage: 'reduce-fields'
            }
          )
        : encodePass(
            encoder,
            pipelines.reduce,
            reduceBindGroup,
            [fieldCapacityDispatch, 1, 1],
            `${label}Reduce`,
            {
              gpuTimestampRecorder,
              timestampMetadata: commonTimestamp,
              producerId: 'schroeder-spatial-phase-volume-moment-reduce',
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
          producerId: 'schroeder-spatial-phase-volume-moment-finalize',
          stage: 'finalize'
        }
      );
      const execution = {
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA,
        status: 'schroeder-spatial-phase-volume-moment-gpu-encoded',
        ready: true,
        selected: true,
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        sourceBuffer,
        sourceMechanicsBuffer,
        sourceMechanicsBufferBorrowed: true,
        mechanicsFieldView,
        parentMechanicsFieldView: mechanicsFieldView,
        sourceAuthorityVersion: authority.sourceAuthorityVersion,
        physicalSourceCount: plan.sourceCount,
        directorySchema: authority.directoryV2
          ? ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
          : null,
        directoryAbiVersion: authority.directoryV2
          ? SCHROEDER_SPATIAL_EPOCH_V2_VERSION
          : null,
        spatialExecution: authority.spatialExecution,
        directoryBuffer:
          authority.spatialExecution?.directoryBuffer ?? null,
        activeSourceView: authority.activeSourceView,
        activeSourceViewBuffer:
          authority.activeSourceView?.activeSourceViewBuffer ?? null,
        activeSourceCountAuthority: authority.activeSourceCountAuthority,
        candidateCountAuthority: authority.candidateCountAuthority,
        controlBuffer: arena.controlBuffer,
        momentBuffer: arena.momentBuffer,
        candidateContributionBuffer: arena.candidateContributionBuffer,
        scratchBuffer: arena.scratchBuffer,
        paramsBuffer: arena.paramsBuffer,
        encodedDispatchCount,
        encodedComputePassCount: 4,
        retainedGpuBufferBytes: retainedGpuBufferBytesPerArena[arena.arenaIndex],
        retainedGpuBufferBytesAllArenas: retainedGpuBufferBytes,
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        sourceDispatchScaling: authority.directoryV2
          ? 'gpu-active-source-count'
          : 'physical-source-count',
        readbackPerformed: false,
        fullParticleReadbackRequired: false,
        fullParticleReadbackPerformed: false,
        diagnosticOnly: true,
        stateMutationAllowed: false,
        submitPerformed: false,
        releaseScheduled: false,
        submissionOwnership: 'caller'
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
        sourceBuffer,
        sourceMechanicsBuffer,
        mechanicsFieldView,
        spatialExecution: authority.spatialExecution,
        activeSourceView: authority.activeSourceView,
        activeSourceCountAuthority: authority.activeSourceCountAuthority,
        candidateCountAuthority: authority.candidateCountAuthority
      };
      executionOwnership.set(execution, ownership);
      createRetirementRecord(execution, ownership);
      return execution;
    } catch (error) {
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
    if (submittedExecutions.has(execution)) return false;
    submittedExecutions.add(execution);
    execution.submitPerformed = true;
    execution.status = 'schroeder-spatial-phase-volume-moment-gpu-build-submitted';
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
      throw new Error('submitted phase-volume moment requires a queue fence');
    }
    if (record.activeAttempt) {
      throw new Error('phase-volume moment retirement is already in flight');
    }
    return finishRetirement(record);
  }

  function canReleaseExecutionQueueOrdered(execution) {
    try {
      const record = retirementFor(execution);
      return !record.completed
        && !deviceLossObserved
        && submittedExecutions.has(execution)
        && !record.activeAttempt;
    } catch {
      return false;
    }
  }

  function releaseExecutionQueueOrdered(execution) {
    if (!canReleaseExecutionQueueOrdered(execution)) {
      throw new Error(
        'queue-ordered phase-volume moment release requires an exact submitted idle execution'
      );
    }
    const record = retirementFor(execution);
    return finishRetirement(record);
  }

  function releaseExecutionAfter(execution, submissionFence) {
    if (!submissionFence?.then) {
      throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
    }
    const record = retirementFor(execution);
    if (record.completed) return record.completionPromise;
    if (deviceLossObserved) return quarantineExecutionAfterDeviceLoss(execution);
    if (!submittedExecutions.has(execution)) {
      throw new Error('unsubmitted phase-volume moment requires discarded-encoder release');
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
        execution.status = 'schroeder-spatial-phase-volume-moment-release-blocked';
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
      throw phaseVolumeMomentError(
        'phase-volume moment device-loss quarantine requires the exact GPUDevice.lost promise',
        'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_DEVICE_LOSS_EVIDENCE',
        TypeError
      );
    }
    if (
      record.deviceLossEvidence != null
      && record.deviceLossEvidence !== exactLossEvidence
    ) {
      throw phaseVolumeMomentError(
        'phase-volume moment device-loss evidence changed for one execution',
        'ERR_SCHROEDER_PHASE_VOLUME_MOMENT_DEVICE_LOSS_EVIDENCE'
      );
    }
    record.deviceLossEvidence = exactLossEvidence;
    deviceLossObserved = true;
    runtime.status = 'schroeder-spatial-phase-volume-moment-runtime-device-loss-quarantined';
    if (record.activeAttempt?.mode === 'device-loss') return record.activeAttempt.promise;
    record.activeAttempt?.promise?.catch?.(() => {});
    const attempt = {
      mode: 'device-loss',
      ordinal: ++record.nextAttemptOrdinal,
      promise: null
    };
    record.activeAttempt = attempt;
    execution.releaseScheduled = true;
    execution.status = 'schroeder-spatial-phase-volume-moment-device-loss-quarantined';
    const promise = Promise.resolve(exactLossEvidence).then(
      () => {
        if (record.activeAttempt !== attempt) return record.completionPromise;
        return finishRetirement(record, { deviceLost: true });
      },
      (error) => {
        if (record.activeAttempt !== attempt) return record.completionPromise;
        record.activeAttempt = null;
        execution.releaseScheduled = false;
        execution.status = 'schroeder-spatial-phase-volume-moment-device-loss-retirement-blocked';
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
      arena.bindGroupCache.clear();
    }
    runtime.status = 'schroeder-spatial-phase-volume-moment-runtime-destroyed';
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA,
    status: 'schroeder-spatial-phase-volume-moment-gpu-runtime-ready',
    deviceId,
    maxSourceCount: resolvedMaxSourceCount,
    fieldCapacity: resolvedFieldCapacity,
    arenaCount: resolvedArenaCount,
    layout,
    pipelineCount: Object.values(pipelineSets)
      .reduce((count, set) => count + Object.keys(set).length, 0),
    retainedGpuBufferBytes,
    normalHotLoopReadbackFree: true,
    encode,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    releaseExecution,
    canReleaseExecutionQueueOrdered,
    releaseExecutionQueueOrdered,
    releaseExecutionAfter,
    quarantineExecutionAfterDeviceLoss,
    executionRetirementCompletionPromise,
    activeExecutionCount,
    allocationEntries,
    destroy
  };
  return runtime;
}
