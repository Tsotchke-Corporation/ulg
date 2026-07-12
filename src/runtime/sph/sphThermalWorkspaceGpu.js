import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const ULG_SPH_THERMAL_WORKSPACE_GPU_SCHEMA =
  'peercompute.ulg.sph-thermal-workspace-gpu.v0';
export const SPH_THERMAL_PARTICLE_PROPERTY_FLOATS = 4;
export const SPH_THERMAL_PARAMS_BYTE_LENGTH = 144;

const GPU_BUFFER_USAGE = {
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};

function positiveCapacity(value) {
  const capacity = Number(value);
  if (!Number.isSafeInteger(capacity) || capacity < 1) {
    throw new RangeError('particleCapacity must be a positive safe integer');
  }
  return capacity;
}

function positiveSequenceStepCapacity(value) {
  const capacity = Number(value);
  if (!Number.isSafeInteger(capacity) || capacity < 1) {
    throw new RangeError('sequenceStepCapacity must be a positive safe integer');
  }
  return capacity;
}

function uniformAlignment(device) {
  const alignment = Number(device?.limits?.minUniformBufferOffsetAlignment ?? 256);
  if (!Number.isSafeInteger(alignment) || alignment < 1) {
    throw new RangeError('minUniformBufferOffsetAlignment must be a positive safe integer');
  }
  return Math.max(256, alignment);
}

function alignTo(value, alignment) {
  const aligned = Math.ceil(value / alignment) * alignment;
  if (!Number.isSafeInteger(aligned)) {
    throw new RangeError('thermal workspace aligned byte length exceeds safe integer range');
  }
  return aligned;
}

function checkedByteLength(device, capacity) {
  const byteLength = capacity
    * SPH_THERMAL_PARTICLE_PROPERTY_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const maxBufferSize = Number(device?.limits?.maxBufferSize ?? Number.MAX_SAFE_INTEGER);
  const maxStorageBindingSize = Number(
    device?.limits?.maxStorageBufferBindingSize ?? maxBufferSize
  );
  if (!Number.isSafeInteger(byteLength)
    || byteLength > maxBufferSize
    || byteLength > maxStorageBindingSize) {
    throw new RangeError(`thermal property workspace requires ${byteLength} bytes beyond device capacity`);
  }
  return byteLength;
}

function checkedParamsArenaByteLength(device, slotCount, slotStrideBytes) {
  const byteLength = slotCount * slotStrideBytes;
  const maxBufferSize = Number(device?.limits?.maxBufferSize ?? Number.MAX_SAFE_INTEGER);
  const maxUniformBindingSize = Number(
    device?.limits?.maxUniformBufferBindingSize ?? Number.MAX_SAFE_INTEGER
  );
  if (!Number.isSafeInteger(byteLength)
    || byteLength > maxBufferSize
    || SPH_THERMAL_PARAMS_BYTE_LENGTH > maxUniformBindingSize) {
    throw new RangeError(
      `thermal params workspace requires ${byteLength} bytes beyond device capacity`
    );
  }
  return byteLength;
}

function assertParamsSlotIndex(value, slotCount) {
  const slotIndex = Number(value);
  if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= slotCount) {
    throw new RangeError(
      `thermal params slot index must be an integer in [0, ${slotCount - 1}]`
    );
  }
  return slotIndex;
}

function signaturesMatch(left, right) {
  return left?.length === right?.length
    && left.every((value, index) => Object.is(value, right[index]));
}

export function createSphThermalWorkspaceGpu({
  device,
  particleCapacity,
  sequenceStepCapacity = 1,
  label = 'ulg-sph-thermal-workspace'
} = {}) {
  if (!device?.createBuffer) {
    throw new TypeError('createSphThermalWorkspaceGpu requires a WebGPU-like device');
  }
  const capacity = positiveCapacity(particleCapacity);
  const stepCapacity = positiveSequenceStepCapacity(sequenceStepCapacity);
  const byteLength = checkedByteLength(device, capacity);
  const paramsSlotStrideBytes = alignTo(
    SPH_THERMAL_PARAMS_BYTE_LENGTH,
    uniformAlignment(device)
  );
  const paramsBufferByteLength = checkedParamsArenaByteLength(
    device,
    stepCapacity,
    paramsSlotStrideBytes
  );
  const prefix = String(label || 'ulg-sph-thermal-workspace');
  const propertyBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `${prefix}-particle-properties`,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE
  }), device);
  let paramsBuffer = null;
  try {
    paramsBuffer = tagWebGpuBufferDevice(device.createBuffer({
      label: `${prefix}-params-arena`,
      size: paramsBufferByteLength,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }), device);
  } catch (error) {
    propertyBuffer.destroy?.();
    throw error;
  }
  const bindGroupCache = Array.from({ length: stepCapacity }, () => null);
  const paramsSlots = Object.freeze(Array.from({ length: stepCapacity }, (_, slotIndex) => (
    Object.freeze({
      slotIndex,
      buffer: paramsBuffer,
      byteOffset: slotIndex * paramsSlotStrideBytes,
      byteLength: SPH_THERMAL_PARAMS_BYTE_LENGTH,
      slotStrideBytes: paramsSlotStrideBytes
    })
  )));
  const usedParamsSlotIndices = [];
  let bindGroupCacheHitCount = 0;
  let bindGroupCacheMissCount = 0;
  let destroyed = false;
  const paramsSlot = (slotIndex = 0) => {
    if (destroyed) throw new Error('thermalWorkspace is destroyed');
    const resolvedSlotIndex = assertParamsSlotIndex(slotIndex, stepCapacity);
    return paramsSlots[resolvedSlotIndex];
  };
  const workspace = {
    schema: ULG_SPH_THERMAL_WORKSPACE_GPU_SCHEMA,
    status: 'thermal-workspace-ready',
    device,
    deviceId: webGpuDeviceId(device),
    particleCapacity: capacity,
    sequenceStepCapacity: stepCapacity,
    propertyBuffer,
    propertyBufferByteLength: byteLength,
    paramsBuffer,
    paramsBufferByteLength,
    paramsSlotByteLength: SPH_THERMAL_PARAMS_BYTE_LENGTH,
    paramsSlotStrideBytes,
    totalByteLength: byteLength + paramsBufferByteLength,
    usedParamsSlotIndices,
    allocationEntries: Object.freeze([
      Object.freeze({
        role: 'thermal-particle-property-workspace',
        buffer: propertyBuffer,
        owned: true,
        lifetime: 'persistent-workspace',
        createdThisSubmission: true
      }),
      Object.freeze({
        role: 'thermal-params-workspace',
        buffer: paramsBuffer,
        owned: true,
        lifetime: 'persistent-workspace',
        createdThisSubmission: true
      })
    ]),
    paramsSlot,
    writeParamsSlot(slotIndex, params) {
      const slot = paramsSlot(slotIndex);
      const byteLength = Number(params?.byteLength);
      if (byteLength !== SPH_THERMAL_PARAMS_BYTE_LENGTH) {
        throw new RangeError(
          `thermal params slot write must contain ${SPH_THERMAL_PARAMS_BYTE_LENGTH} bytes`
        );
      }
      if (!device.queue?.writeBuffer) {
        throw new TypeError('thermal params slot write requires device.queue.writeBuffer');
      }
      device.queue.writeBuffer(paramsBuffer, slot.byteOffset, params);
      if (!usedParamsSlotIndices.includes(slot.slotIndex)) {
        usedParamsSlotIndices.push(slot.slotIndex);
      }
      return slot;
    },
    bindGroupForSlot(slotIndex, signature, createBindGroup) {
      const slot = paramsSlot(slotIndex);
      if (!Array.isArray(signature) || signature.length === 0) {
        throw new TypeError('thermal bind-group cache signature must be a non-empty array');
      }
      if (typeof createBindGroup !== 'function') {
        throw new TypeError('thermal bind-group cache requires a creation function');
      }
      const cached = bindGroupCache[slot.slotIndex];
      if (cached && signaturesMatch(cached.signature, signature)) {
        bindGroupCacheHitCount += 1;
        return Object.freeze({ bindGroup: cached.bindGroup, cacheHit: true, slot });
      }
      const bindGroup = createBindGroup(slot);
      if (!bindGroup) throw new Error('thermal bind-group creation returned no bind group');
      bindGroupCache[slot.slotIndex] = {
        signature: [...signature],
        bindGroup
      };
      bindGroupCacheMissCount += 1;
      return Object.freeze({ bindGroup, cacheHit: false, slot });
    },
    bindGroupCacheEvidence() {
      return Object.freeze({
        slotCapacity: stepCapacity,
        populatedSlotCount: bindGroupCache.filter(Boolean).length,
        hitCount: bindGroupCacheHitCount,
        missCount: bindGroupCacheMissCount
      });
    },
    destroyed: false,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      workspace.destroyed = true;
      workspace.status = 'thermal-workspace-destroyed';
      propertyBuffer.destroy?.();
      paramsBuffer.destroy?.();
      bindGroupCache.fill(null);
      usedParamsSlotIndices.length = 0;
      return true;
    }
  };
  return workspace;
}

export function assertSphThermalWorkspaceGpu(device, workspace, particleCount) {
  if (workspace?.schema !== ULG_SPH_THERMAL_WORKSPACE_GPU_SCHEMA) {
    throw new TypeError('thermalWorkspace schema mismatch');
  }
  if (workspace.destroyed === true) {
    throw new Error('thermalWorkspace is destroyed');
  }
  if (workspace.device !== device
    || !webGpuBufferMatchesDevice(workspace.propertyBuffer, device)
    || !webGpuBufferMatchesDevice(workspace.paramsBuffer, device)) {
    throw new Error('thermalWorkspace device mismatch');
  }
  const requiredCount = Number(particleCount);
  if (!Number.isSafeInteger(requiredCount) || requiredCount < 0) {
    throw new RangeError('particleCount must be a non-negative safe integer');
  }
  if (workspace.particleCapacity < requiredCount) {
    throw new RangeError(
      `thermalWorkspace capacity ${workspace.particleCapacity} is smaller than ${requiredCount}`
    );
  }
  const requiredByteLength = requiredCount
    * SPH_THERMAL_PARTICLE_PROPERTY_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  if (Number(workspace.propertyBuffer?.size ?? 0) < requiredByteLength) {
    throw new RangeError(`thermalWorkspace property buffer is smaller than ${requiredByteLength} bytes`);
  }
  if (!Number.isSafeInteger(workspace.sequenceStepCapacity)
    || workspace.sequenceStepCapacity < 1
    || !Number.isSafeInteger(workspace.paramsSlotStrideBytes)
    || workspace.paramsSlotStrideBytes < SPH_THERMAL_PARAMS_BYTE_LENGTH
    || Number(workspace.paramsBuffer?.size ?? 0)
      < workspace.sequenceStepCapacity * workspace.paramsSlotStrideBytes) {
    throw new RangeError('thermalWorkspace params arena is invalid');
  }
  return workspace;
}
