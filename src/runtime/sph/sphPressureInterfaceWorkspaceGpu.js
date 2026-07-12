import {
  SPH_INTERFACE_SOURCE_KEY_FLOATS,
  SPH_MATERIAL_INTERFACE_CANDIDATE_DISPATCH_INDIRECT_BYTE_LENGTH,
  SPH_MATERIAL_INTERFACE_CANDIDATE_FINALIZE_PARAMS_BYTE_LENGTH,
  SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS,
  SPH_MATERIAL_INTERFACE_CANDIDATE_INITIAL_STATE_BYTE_LENGTH,
  SPH_MATERIAL_INTERFACE_CANDIDATE_PARAMS_BYTE_LENGTH
} from './sphRenderGpuKernel.js';
import {
  SPH_ALGORITHM_CONTACT_POLICY_FLOATS,
  SPH_PRESSURE_INTERFACE_CONTACT_KINEMATICS_PARAMS_BYTE_LENGTH,
  SPH_PRESSURE_INTERFACE_DISABLED_LAW_QUEUE_BYTE_LENGTH,
  SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS,
  SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
  SPH_PRESSURE_INTERFACE_FORCE_PARAMS_BYTE_LENGTH,
  SPH_PRESSURE_INTERFACE_LAW_NEIGHBOR_PARAMS_BYTE_LENGTH,
  SPH_PRESSURE_INTERFACE_LAW_QUEUE_PARAMS_BYTE_LENGTH,
  SPH_PRESSURE_INTERFACE_SCATTER_PARAMS_BYTE_LENGTH,
  SPH_PRESSURE_INTERFACE_SOURCE_KEY_PARAMS_BYTE_LENGTH,
  SPH_PRESSURE_INTERFACE_SOURCE_SPAN_PARAMS_BYTE_LENGTH
} from './sphPressureInterfaceGpuKernel.js';
import { tagWebGpuBufferDevice, webGpuDeviceId } from './sphGpuDeviceIdentity.js';

export const ULG_SPH_PRESSURE_INTERFACE_WORKSPACE_GPU_SCHEMA =
  'peercompute.ulg.sph-pressure-interface-workspace-gpu.v1';

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};
const MIN_BINDING_OFFSET_ALIGNMENT = 256;
const CONTROL_BYTE_LENGTHS = Object.freeze({
  candidateInit: SPH_MATERIAL_INTERFACE_CANDIDATE_INITIAL_STATE_BYTE_LENGTH,
  candidate: SPH_MATERIAL_INTERFACE_CANDIDATE_PARAMS_BYTE_LENGTH,
  candidateFinalize: SPH_MATERIAL_INTERFACE_CANDIDATE_FINALIZE_PARAMS_BYTE_LENGTH,
  contactKinematics: SPH_PRESSURE_INTERFACE_CONTACT_KINEMATICS_PARAMS_BYTE_LENGTH,
  lawQueue: SPH_PRESSURE_INTERFACE_LAW_QUEUE_PARAMS_BYTE_LENGTH,
  lawNeighbor: SPH_PRESSURE_INTERFACE_LAW_NEIGHBOR_PARAMS_BYTE_LENGTH,
  sourceSpan: SPH_PRESSURE_INTERFACE_SOURCE_SPAN_PARAMS_BYTE_LENGTH,
  sourceKey: SPH_PRESSURE_INTERFACE_SOURCE_KEY_PARAMS_BYTE_LENGTH,
  force: SPH_PRESSURE_INTERFACE_FORCE_PARAMS_BYTE_LENGTH,
  scatter: SPH_PRESSURE_INTERFACE_SCATTER_PARAMS_BYTE_LENGTH
});
const BIND_GROUP_CACHE_KINDS = Object.freeze([
  'candidate',
  'candidateFinalize',
  'contactKinematics',
  'force',
  'pressureScatter'
]);

function normalizedCapacity(value) {
  const capacity = Number(value);
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new RangeError('candidateCapacity must be a positive safe integer');
  }
  return capacity;
}

function normalizedSequenceStepCapacity(value) {
  const capacity = Number(value);
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new RangeError('sequenceStepCapacity must be a positive safe integer');
  }
  return capacity;
}

function bindingAlignment(device, limitName) {
  const alignment = Number(device?.limits?.[limitName] ?? MIN_BINDING_OFFSET_ALIGNMENT);
  if (!Number.isSafeInteger(alignment) || alignment <= 0) {
    throw new RangeError(`${limitName} must be a positive safe integer`);
  }
  return Math.max(MIN_BINDING_OFFSET_ALIGNMENT, alignment);
}

function alignTo(value, alignment, label) {
  const aligned = Math.ceil(value / alignment) * alignment;
  if (!Number.isSafeInteger(aligned)) {
    throw new RangeError(`${label} exceeds safe integer range`);
  }
  return aligned;
}

function checkedByteLength(device, label, value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} byte length is invalid`);
  }
  const maximum = Math.max(0, Number(device?.limits?.maxBufferSize) || Number.MAX_SAFE_INTEGER);
  if (value > maximum) {
    throw new RangeError(`${label} byte length ${value} exceeds maxBufferSize ${maximum}`);
  }
  return value;
}

function createControlArenaLayout(device, sequenceStepCapacity) {
  const alignment = bindingAlignment(device, 'minUniformBufferOffsetAlignment');
  const kindOffsets = {};
  let byteOffset = 0;
  const maximumUniformBindingSize = Number(
    device?.limits?.maxUniformBufferBindingSize ?? Number.MAX_SAFE_INTEGER
  );
  for (const [kind, byteLength] of Object.entries(CONTROL_BYTE_LENGTHS)) {
    if (kind !== 'candidateInit' && byteLength > maximumUniformBindingSize) {
      throw new RangeError(`${kind} control binding exceeds maxUniformBufferBindingSize`);
    }
    byteOffset = alignTo(byteOffset, alignment, 'pressure/interface control offset');
    kindOffsets[kind] = byteOffset;
    byteOffset += byteLength;
  }
  const slotStrideBytes = alignTo(
    byteOffset,
    alignment,
    'pressure/interface control slot stride'
  );
  return Object.freeze({
    alignment,
    kindOffsets: Object.freeze(kindOffsets),
    slotStrideBytes,
    byteLength: checkedByteLength(
      device,
      'pressure/interface control arena',
      sequenceStepCapacity * slotStrideBytes
    )
  });
}

function assertSlotIndex(value, sequenceStepCapacity) {
  const slotIndex = Number(value);
  if (!Number.isSafeInteger(slotIndex)
    || slotIndex < 0
    || slotIndex >= sequenceStepCapacity) {
    throw new RangeError(
      `pressure/interface slot index must be an integer in [0, ${sequenceStepCapacity - 1}]`
    );
  }
  return slotIndex;
}

function signaturesMatch(left, right) {
  return left?.length === right?.length
    && left.every((value, index) => Object.is(value, right[index]));
}

function bufferByteLength(buffer) {
  const byteLength = Number(buffer?.size ?? buffer?.byteLength ?? 0);
  return Number.isFinite(byteLength) && byteLength > 0 ? byteLength : 0;
}

export function createSphPressureInterfaceWorkspaceGpu({
  device,
  candidateCapacity,
  sequenceStepCapacity = 1,
  registerBuffer = null,
  labelPrefix = 'ulg-sph-pressure-interface-workspace'
} = {}) {
  if (!device?.createBuffer) {
    throw new TypeError('createSphPressureInterfaceWorkspaceGpu requires a WebGPU-like device');
  }
  const capacity = normalizedCapacity(candidateCapacity);
  const stepCapacity = normalizedSequenceStepCapacity(sequenceStepCapacity);
  const prefix = String(labelPrefix || '').trim();
  if (!prefix) throw new TypeError('labelPrefix must be a non-empty string');
  if (registerBuffer != null && typeof registerBuffer !== 'function') {
    throw new TypeError('registerBuffer must be a function when provided');
  }
  const registerCreatedBuffer = (buffer) => {
    try {
      registerBuffer?.(buffer);
    } catch (error) {
      buffer?.destroy?.();
      throw error;
    }
    return buffer;
  };
  const controlLayout = createControlArenaLayout(device, stepCapacity);
  const storageAlignment = bindingAlignment(device, 'minStorageBufferOffsetAlignment');
  const byteLengths = Object.freeze({
    candidateRows: checkedByteLength(
      device,
      'candidate rows',
      capacity * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
    ),
    compactMetadata: 16,
    interfaceSourceKeys: checkedByteLength(
      device,
      'interface source keys',
      capacity * SPH_INTERFACE_SOURCE_KEY_FLOATS * Float32Array.BYTES_PER_ELEMENT
    ),
    candidateDispatchIndirect: SPH_MATERIAL_INTERFACE_CANDIDATE_DISPATCH_INDIRECT_BYTE_LENGTH,
    contactKinematics: checkedByteLength(
      device,
      'contact kinematics',
      capacity * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS * Float32Array.BYTES_PER_ELEMENT
    ),
    forceRows: checkedByteLength(
      device,
      'force rows',
      capacity * SPH_PRESSURE_INTERFACE_FORCE_FLOATS * Float32Array.BYTES_PER_ELEMENT
    ),
    controlArena: controlLayout.byteLength
  });
  const descriptors = [
    ['candidateRows', byteLengths.candidateRows, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST],
    ['compactMetadata', byteLengths.compactMetadata, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST],
    ['interfaceSourceKeys', byteLengths.interfaceSourceKeys, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST],
    ['candidateDispatchIndirect', byteLengths.candidateDispatchIndirect, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST],
    ['contactKinematics', byteLengths.contactKinematics, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST],
    ['forceRows', byteLengths.forceRows, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST],
    ['controlArena', byteLengths.controlArena, GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST]
  ];
  const buffers = {};
  const retiredContactPolicyBuffers = [];
  const allocationEntries = [];
  let contactPolicyArenaBuffer = null;
  let contactPolicySlotStrideBytes = 0;
  let contactPolicyBindingByteLength = 0;
  let disabledBuffersInitialized = false;
  try {
    for (const [role, size, usage] of descriptors) {
      buffers[role] = registerCreatedBuffer(tagWebGpuBufferDevice(device.createBuffer({
        label: `${prefix}-${role}`,
        size,
        usage
      }), device));
      allocationEntries.push({
        role: `pressure-interface-workspace-${role}`,
        buffer: buffers[role],
        owned: true,
        lifetime: 'persistent-workspace',
        createdThisSubmission: true
      });
    }
    buffers.disabledParticleBinCounts = registerCreatedBuffer(tagWebGpuBufferDevice(device.createBuffer({
      label: `${prefix}-disabled-particle-bin-counts`,
      size: Uint32Array.BYTES_PER_ELEMENT,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    }), device));
    buffers.disabledParticleBinIndices = registerCreatedBuffer(tagWebGpuBufferDevice(device.createBuffer({
      label: `${prefix}-disabled-particle-bin-indices`,
      size: Uint32Array.BYTES_PER_ELEMENT,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    }), device));
    buffers.disabledLawQueue = registerCreatedBuffer(tagWebGpuBufferDevice(device.createBuffer({
      label: `${prefix}-disabled-law-queue`,
      size: Math.max(4, SPH_PRESSURE_INTERFACE_DISABLED_LAW_QUEUE_BYTE_LENGTH),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    }), device));
    for (const role of [
      'disabledParticleBinCounts',
      'disabledParticleBinIndices',
      'disabledLawQueue'
    ]) {
      allocationEntries.push({
        role: `pressure-interface-workspace-${role}`,
        buffer: buffers[role],
        owned: true,
        lifetime: 'persistent-workspace',
        createdThisSubmission: true
      });
    }
  } catch (error) {
    for (const buffer of Object.values(buffers)) buffer?.destroy?.();
    throw error;
  }

  const controlSlots = Object.freeze(Array.from({ length: stepCapacity }, (_, slotIndex) => {
    const slotBase = slotIndex * controlLayout.slotStrideBytes;
    const controlResources = Object.freeze(Object.fromEntries(
      Object.entries(CONTROL_BYTE_LENGTHS).map(([kind, byteLength]) => [kind, Object.freeze({
        buffer: buffers.controlArena,
        byteOffset: slotBase + controlLayout.kindOffsets[kind],
        byteLength
      })])
    ));
    return Object.freeze({ slotIndex, controlResources });
  }));
  const bindGroupCaches = Object.fromEntries(BIND_GROUP_CACHE_KINDS.map((kind) => [
    kind,
    Array.from({ length: stepCapacity }, () => null)
  ]));
  const cacheEvidence = Object.fromEntries(BIND_GROUP_CACHE_KINDS.flatMap((kind) => [
    [`${kind}HitCount`, 0],
    [`${kind}MissCount`, 0]
  ]));
  const usedControlSlotIndices = [];
  let destroyed = false;
  const targetBuffers = Object.freeze({
    targetCandidateRowsBuffer: buffers.candidateRows,
    targetCompactMetadataBuffer: buffers.compactMetadata,
    targetInterfaceSourceKeyBuffer: buffers.interfaceSourceKeys,
    targetCandidateDispatchIndirectBuffer: buffers.candidateDispatchIndirect,
    targetContactKinematicsBuffer: buffers.contactKinematics,
    targetForceRowsBuffer: buffers.forceRows
  });

  const controlSlot = (slotIndex = 0) => {
    if (destroyed) throw new Error('pressure-interface workspace is destroyed');
    return controlSlots[assertSlotIndex(slotIndex, stepCapacity)];
  };

  const ensureContactPolicyArena = (requiredByteLength) => {
    const minimumBindingByteLength = Math.max(
      SPH_ALGORITHM_CONTACT_POLICY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      Math.ceil(Math.max(0, Number(requiredByteLength) || 0) / 4) * 4
    );
    if (contactPolicyArenaBuffer && contactPolicyBindingByteLength >= minimumBindingByteLength) {
      return;
    }
    const maximumStorageBindingSize = Number(
      device?.limits?.maxStorageBufferBindingSize ?? Number.MAX_SAFE_INTEGER
    );
    if (minimumBindingByteLength > maximumStorageBindingSize) {
      throw new RangeError('contact policy binding exceeds maxStorageBufferBindingSize');
    }
    const nextSlotStrideBytes = alignTo(
      minimumBindingByteLength,
      storageAlignment,
      'pressure/interface contact policy slot stride'
    );
    const nextBuffer = registerCreatedBuffer(tagWebGpuBufferDevice(device.createBuffer({
      label: `${prefix}-contact-policy-arena`,
      size: checkedByteLength(
        device,
        'pressure/interface contact policy arena',
        stepCapacity * nextSlotStrideBytes
      ),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    }), device));
    if (contactPolicyArenaBuffer) retiredContactPolicyBuffers.push(contactPolicyArenaBuffer);
    contactPolicyArenaBuffer = nextBuffer;
    contactPolicySlotStrideBytes = nextSlotStrideBytes;
    contactPolicyBindingByteLength = minimumBindingByteLength;
    allocationEntries.push({
      role: 'pressure-interface-workspace-contact-policy-arena',
      buffer: nextBuffer,
      owned: true,
      lifetime: 'persistent-workspace',
      createdThisSubmission: true
    });
  };

  try {
    ensureContactPolicyArena(0);
  } catch (error) {
    for (const buffer of new Set([
      ...Object.values(buffers),
      contactPolicyArenaBuffer,
      ...retiredContactPolicyBuffers
    ])) buffer?.destroy?.();
    throw error;
  }

  function substepResources(substepIndex, { contactPolicyByteLength = 0 } = {}) {
    if (destroyed) throw new Error('pressure-interface workspace is destroyed');
    if (!device.queue?.writeBuffer) {
      throw new TypeError('pressure-interface workspace substeps require queue.writeBuffer');
    }
    if (!disabledBuffersInitialized) {
      device.queue.writeBuffer(buffers.disabledParticleBinCounts, 0, new Uint32Array(1));
      device.queue.writeBuffer(
        buffers.disabledParticleBinIndices,
        0,
        new Uint32Array([0xffff_ffff])
      );
      device.queue.writeBuffer(
        buffers.disabledLawQueue,
        0,
        new Uint8Array(buffers.disabledLawQueue.size)
      );
      disabledBuffersInitialized = true;
    }
    const slot = controlSlot(substepIndex);
    if (!usedControlSlotIndices.includes(slot.slotIndex)) {
      usedControlSlotIndices.push(slot.slotIndex);
    }
    ensureContactPolicyArena(contactPolicyByteLength);
    const contactPolicyByteOffset = slot.slotIndex * contactPolicySlotStrideBytes;
    const resources = {
      index: slot.slotIndex,
      slotIndex: slot.slotIndex,
      controlResources: slot.controlResources,
      candidateInitBuffer: slot.controlResources.candidateInit.buffer,
      candidateInitByteOffset: slot.controlResources.candidateInit.byteOffset,
      candidateInitByteLength: slot.controlResources.candidateInit.byteLength,
      candidateParamsBuffer: slot.controlResources.candidate.buffer,
      candidateParamsByteOffset: slot.controlResources.candidate.byteOffset,
      candidateParamsByteLength: slot.controlResources.candidate.byteLength,
      candidateFinalizeParamsBuffer: slot.controlResources.candidateFinalize.buffer,
      candidateFinalizeParamsByteOffset: slot.controlResources.candidateFinalize.byteOffset,
      candidateFinalizeParamsByteLength: slot.controlResources.candidateFinalize.byteLength,
      contactKinematicsParamsBuffer: slot.controlResources.contactKinematics.buffer,
      contactKinematicsParamsByteOffset: slot.controlResources.contactKinematics.byteOffset,
      contactKinematicsParamsByteLength: slot.controlResources.contactKinematics.byteLength,
      lawQueueParamsBuffer: slot.controlResources.lawQueue.buffer,
      lawQueueParamsByteOffset: slot.controlResources.lawQueue.byteOffset,
      lawQueueParamsByteLength: slot.controlResources.lawQueue.byteLength,
      lawNeighborParamsBuffer: slot.controlResources.lawNeighbor.buffer,
      lawNeighborParamsByteOffset: slot.controlResources.lawNeighbor.byteOffset,
      lawNeighborParamsByteLength: slot.controlResources.lawNeighbor.byteLength,
      sourceSpanParamsBuffer: slot.controlResources.sourceSpan.buffer,
      sourceSpanParamsByteOffset: slot.controlResources.sourceSpan.byteOffset,
      sourceSpanParamsByteLength: slot.controlResources.sourceSpan.byteLength,
      sourceKeyParamsBuffer: slot.controlResources.sourceKey.buffer,
      sourceKeyParamsByteOffset: slot.controlResources.sourceKey.byteOffset,
      sourceKeyParamsByteLength: slot.controlResources.sourceKey.byteLength,
      forceParamsBuffer: slot.controlResources.force.buffer,
      forceParamsByteOffset: slot.controlResources.force.byteOffset,
      forceParamsByteLength: slot.controlResources.force.byteLength,
      scatterParamsBuffer: slot.controlResources.scatter.buffer,
      scatterParamsByteOffset: slot.controlResources.scatter.byteOffset,
      scatterParamsByteLength: slot.controlResources.scatter.byteLength,
      contactPolicyBuffer: contactPolicyArenaBuffer,
      contactPolicyByteOffset,
      contactPolicyByteLength: contactPolicyBindingByteLength,
      disabledParticleBins: Object.freeze({
        countsBuffer: buffers.disabledParticleBinCounts,
        indicesBuffer: buffers.disabledParticleBinIndices
      }),
      disabledLawQueueBuffer: buffers.disabledLawQueue,
      workspaceOwned: true,
      writeControl(kind, values) {
        return workspace.writeControl(slot.slotIndex, kind, values);
      },
      bindGroupForKind(kind, signature, createBindGroup) {
        return workspace.bindGroupForSlot(kind, slot.slotIndex, signature, createBindGroup);
      }
    };
    return Object.freeze(resources);
  }

  const workspace = {
    schema: ULG_SPH_PRESSURE_INTERFACE_WORKSPACE_GPU_SCHEMA,
    status: 'pressure-interface-workspace-ready',
    device,
    deviceId: webGpuDeviceId(device),
    candidateCapacity: capacity,
    sequenceStepCapacity: stepCapacity,
    byteLengths,
    controlBuffer: buffers.controlArena,
    controlBufferByteLength: controlLayout.byteLength,
    controlSlotStrideBytes: controlLayout.slotStrideBytes,
    controlSlotByteLengths: CONTROL_BYTE_LENGTHS,
    usedControlSlotIndices,
    targetBuffers,
    allocationEntries,
    controlSlot,
    substepResources,
    writeControl(slotIndex, kind, values) {
      const slot = controlSlot(slotIndex);
      const resource = slot.controlResources[kind];
      if (!resource) throw new RangeError(`unknown pressure/interface control kind: ${kind}`);
      if (Number(values?.byteLength) !== resource.byteLength) {
        throw new RangeError(
          `pressure/interface ${kind} control must contain ${resource.byteLength} bytes`
        );
      }
      device.queue.writeBuffer(resource.buffer, resource.byteOffset, values);
      if (!usedControlSlotIndices.includes(slot.slotIndex)) {
        usedControlSlotIndices.push(slot.slotIndex);
      }
      return resource;
    },
    bindGroupForSlot(kind, slotIndex, signature, createBindGroup) {
      if (!Object.hasOwn(bindGroupCaches, kind)) {
        throw new RangeError(
          `pressure/interface bind-group cache kind must be one of ${BIND_GROUP_CACHE_KINDS.join(', ')}`
        );
      }
      const slot = controlSlot(slotIndex);
      if (!Array.isArray(signature) || signature.length === 0) {
        throw new TypeError('pressure/interface bind-group cache signature must be non-empty');
      }
      if (typeof createBindGroup !== 'function') {
        throw new TypeError('pressure/interface bind-group cache requires a creation function');
      }
      const cached = bindGroupCaches[kind][slot.slotIndex];
      if (cached && signaturesMatch(cached.signature, signature)) {
        cacheEvidence[`${kind}HitCount`] += 1;
        return Object.freeze({ bindGroup: cached.bindGroup, cacheHit: true, slot });
      }
      const bindGroup = createBindGroup(slot);
      if (!bindGroup) throw new Error('pressure/interface bind-group creation returned no bind group');
      bindGroupCaches[kind][slot.slotIndex] = { signature: [...signature], bindGroup };
      cacheEvidence[`${kind}MissCount`] += 1;
      return Object.freeze({ bindGroup, cacheHit: false, slot });
    },
    bindGroupCacheEvidence() {
      return Object.freeze({
        slotCapacity: stepCapacity,
        ...Object.fromEntries(BIND_GROUP_CACHE_KINDS.map((kind) => [
          `${kind}PopulatedSlotCount`,
          bindGroupCaches[kind].filter(Boolean).length
        ])),
        ...cacheEvidence
      });
    },
    get substepSlotCount() {
      return usedControlSlotIndices.length;
    },
    get totalByteLength() {
      return [...new Set(allocationEntries.map((entry) => entry.buffer))]
        .reduce((sum, buffer) => sum + bufferByteLength(buffer), 0);
    },
    destroyed: false,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      workspace.destroyed = true;
      workspace.status = 'pressure-interface-workspace-destroyed';
      for (const buffer of new Set([
        ...Object.values(buffers),
        contactPolicyArenaBuffer,
        ...retiredContactPolicyBuffers
      ])) buffer?.destroy?.();
      for (const cache of Object.values(bindGroupCaches)) cache.fill(null);
      usedControlSlotIndices.length = 0;
      return true;
    }
  };
  return workspace;
}
