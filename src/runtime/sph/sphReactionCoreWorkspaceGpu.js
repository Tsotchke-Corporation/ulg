import {
  SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_ROW_LAYOUT,
  SCHROEDER_LAW_QUEUE_ROW_LAYOUT
} from '../../../ulg-gpu-abi/src/index.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const ULG_SPH_REACTION_CORE_WORKSPACE_GPU_SCHEMA =
  'peercompute.ulg.sph-reaction-core-workspace-gpu.v1';
export const SPH_REACTION_PROPOSAL_FLOATS = 4;
export const SPH_REACTION_CORE_WORKSPACE_BYTES_PER_PARTICLE =
  SPH_REACTION_PROPOSAL_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const SPH_REACTION_MAIN_PARAMS_BYTE_LENGTH = 48;
export const SPH_REACTION_BIN_PARAMS_BYTE_LENGTH = 64;
export const SPH_REACTION_LAW_QUEUE_PARAMS_BYTE_LENGTH = 16;
export const SPH_REACTION_NEIGHBOR_PARAMS_BYTE_LENGTH = 64;

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};
const MIN_BINDING_OFFSET_ALIGNMENT = 256;
const DISABLED_STORAGE_BYTE_LENGTHS = Object.freeze({
  binCounts: Uint32Array.BYTES_PER_ELEMENT,
  binIndices: Uint32Array.BYTES_PER_ELEMENT,
  binMetadata: 4 * Uint32Array.BYTES_PER_ELEMENT,
  lawQueue: SCHROEDER_LAW_QUEUE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
  lawNeighborSourceSpans:
    SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT
});
const DISABLED_WRITABLE_STORAGE_ROLES = Object.freeze([
  'binCounts',
  'binIndices',
  'binMetadata'
]);
const DISABLED_READ_ONLY_STORAGE_ROLES = Object.freeze([
  'lawQueue',
  'lawNeighborSourceSpans'
]);
const PARAM_BYTE_LENGTHS = Object.freeze({
  main: SPH_REACTION_MAIN_PARAMS_BYTE_LENGTH,
  bin: SPH_REACTION_BIN_PARAMS_BYTE_LENGTH,
  lawQueue: SPH_REACTION_LAW_QUEUE_PARAMS_BYTE_LENGTH,
  neighbor: SPH_REACTION_NEIGHBOR_PARAMS_BYTE_LENGTH
});

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

function bindingAlignment(device, limitName) {
  const alignment = Number(device?.limits?.[limitName] ?? MIN_BINDING_OFFSET_ALIGNMENT);
  if (!Number.isSafeInteger(alignment) || alignment < 1) {
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

function assertSlotIndex(value, capacity) {
  const slotIndex = Number(value);
  if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= capacity) {
    throw new RangeError(`reaction params slot index must be an integer in [0, ${capacity - 1}]`);
  }
  return slotIndex;
}

function signaturesMatch(left, right) {
  return left?.length === right?.length
    && left.every((value, index) => Object.is(value, right[index]));
}

function checkedByteLength(device, capacity, floatsPerParticle, label) {
  const byteLength = capacity * floatsPerParticle * Float32Array.BYTES_PER_ELEMENT;
  const maxBufferSize = Number(device?.limits?.maxBufferSize ?? Number.MAX_SAFE_INTEGER);
  const maxStorageBindingSize = Number(
    device?.limits?.maxStorageBufferBindingSize ?? maxBufferSize
  );
  if (!Number.isSafeInteger(byteLength)
    || byteLength > maxBufferSize
    || byteLength > maxStorageBindingSize) {
    throw new RangeError(`${label} requires ${byteLength} bytes beyond device capacity`);
  }
  return byteLength;
}

function checkedArenaByteLength(device, byteLength, label) {
  const maxBufferSize = Number(device?.limits?.maxBufferSize ?? Number.MAX_SAFE_INTEGER);
  if (!Number.isSafeInteger(byteLength) || byteLength < 4 || byteLength > maxBufferSize) {
    throw new RangeError(`${label} requires ${byteLength} bytes beyond device capacity`);
  }
  return byteLength;
}

function createParamsArenaLayout(device, sequenceStepCapacity) {
  const alignment = bindingAlignment(device, 'minUniformBufferOffsetAlignment');
  const kindOffsets = {};
  let byteOffset = 0;
  for (const [kind, byteLength] of Object.entries(PARAM_BYTE_LENGTHS)) {
    byteOffset = alignTo(byteOffset, alignment, 'reaction params offset');
    kindOffsets[kind] = byteOffset;
    byteOffset += byteLength;
  }
  const slotStrideBytes = alignTo(byteOffset, alignment, 'reaction params slot stride');
  const byteLength = checkedArenaByteLength(
    device,
    sequenceStepCapacity * slotStrideBytes,
    'reaction params workspace'
  );
  const maxUniformBindingSize = Number(
    device?.limits?.maxUniformBufferBindingSize ?? Number.MAX_SAFE_INTEGER
  );
  if (Object.values(PARAM_BYTE_LENGTHS).some((size) => size > maxUniformBindingSize)) {
    throw new RangeError('reaction params binding exceeds maxUniformBufferBindingSize');
  }
  return Object.freeze({ alignment, kindOffsets: Object.freeze(kindOffsets), slotStrideBytes, byteLength });
}

function createDisabledStorageLayout(device, roles, label) {
  const alignment = bindingAlignment(device, 'minStorageBufferOffsetAlignment');
  const regions = {};
  let byteOffset = 0;
  const maxStorageBindingSize = Number(
    device?.limits?.maxStorageBufferBindingSize ?? Number.MAX_SAFE_INTEGER
  );
  for (const role of roles) {
    const byteLength = DISABLED_STORAGE_BYTE_LENGTHS[role];
    if (byteLength > maxStorageBindingSize) {
      throw new RangeError(`${role} disabled binding exceeds maxStorageBufferBindingSize`);
    }
    byteOffset = alignTo(byteOffset, alignment, 'reaction disabled-storage offset');
    regions[role] = Object.freeze({ byteOffset, byteLength });
    byteOffset += byteLength;
  }
  return Object.freeze({
    alignment,
    regions: Object.freeze(regions),
    byteLength: checkedArenaByteLength(
      device,
      alignTo(byteOffset, alignment, 'reaction disabled-storage arena'),
      label
    )
  });
}

function bufferByteLength(buffer) {
  const byteLength = Number(buffer?.size ?? buffer?.byteLength ?? 0);
  return Number.isFinite(byteLength) && byteLength > 0 ? byteLength : 0;
}

export function createSphReactionCoreWorkspaceGpu({
  device,
  particleCapacity,
  sequenceStepCapacity = 1,
  label = 'ulg-sph-reaction-core-workspace'
} = {}) {
  if (!device?.createBuffer) {
    throw new TypeError('createSphReactionCoreWorkspaceGpu requires a WebGPU-like device');
  }
  const capacity = positiveCapacity(particleCapacity);
  const stepCapacity = positiveSequenceStepCapacity(sequenceStepCapacity);
  const proposalBufferByteLength = checkedByteLength(
    device,
    capacity,
    SPH_REACTION_PROPOSAL_FLOATS,
    'reaction proposal workspace'
  );
  const paramsLayout = createParamsArenaLayout(device, stepCapacity);
  const disabledWritableStorageLayout = createDisabledStorageLayout(
    device,
    DISABLED_WRITABLE_STORAGE_ROLES,
    'reaction disabled writable-storage workspace'
  );
  const disabledReadOnlyStorageLayout = createDisabledStorageLayout(
    device,
    DISABLED_READ_ONLY_STORAGE_ROLES,
    'reaction disabled read-only-storage workspace'
  );
  const prefix = String(label || 'ulg-sph-reaction-core-workspace');
  const usage = GPU_BUFFER_USAGE.STORAGE
    | GPU_BUFFER_USAGE.COPY_SRC
    | GPU_BUFFER_USAGE.COPY_DST;
  const created = [];
  const create = (suffix, size, bufferUsage = usage) => {
    const buffer = tagWebGpuBufferDevice(device.createBuffer({
      label: `${prefix}-${suffix}`,
      size,
      usage: bufferUsage
    }), device);
    created.push(buffer);
    return buffer;
  };
  try {
    const proposalBuffer = create('proposals', proposalBufferByteLength);
    const paramsBuffer = create(
      'params-arena',
      paramsLayout.byteLength,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    );
    const disabledWritableStorageBuffer = create(
      'disabled-writable-storage-arena',
      disabledWritableStorageLayout.byteLength,
      GPU_BUFFER_USAGE.STORAGE
    );
    const disabledReadOnlyStorageBuffer = create(
      'disabled-read-only-storage-arena',
      disabledReadOnlyStorageLayout.byteLength,
      GPU_BUFFER_USAGE.STORAGE
    );
    const paramsSlots = Object.freeze(Array.from({ length: stepCapacity }, (_, slotIndex) => {
      const slotBase = slotIndex * paramsLayout.slotStrideBytes;
      const resources = Object.fromEntries(Object.entries(PARAM_BYTE_LENGTHS).map(
        ([kind, byteLength]) => [kind, Object.freeze({
          buffer: paramsBuffer,
          byteOffset: slotBase + paramsLayout.kindOffsets[kind],
          byteLength
        })]
      ));
      return Object.freeze({ slotIndex, resources: Object.freeze(resources) });
    }));
    const disabledStorageBindings = Object.freeze(Object.fromEntries([
      ...Object.entries(disabledWritableStorageLayout.regions).map(([role, region]) => [
        role,
        Object.freeze({ buffer: disabledWritableStorageBuffer, ...region })
      ]),
      ...Object.entries(disabledReadOnlyStorageLayout.regions).map(([role, region]) => [
        role,
        Object.freeze({ buffer: disabledReadOnlyStorageBuffer, ...region })
      ])
    ]));
    const bindGroupCaches = {
      propose: Array.from({ length: stepCapacity }, () => null),
      resolve: Array.from({ length: stepCapacity }, () => null)
    };
    const bindGroupCacheEvidence = {
      proposeHitCount: 0,
      proposeMissCount: 0,
      resolveHitCount: 0,
      resolveMissCount: 0
    };
    const usedParamsSlotIndices = [];
    let destroyed = false;
    const allocationEntries = Object.freeze([
      Object.freeze({
        role: 'reaction-core-proposals',
        buffer: proposalBuffer,
        owned: true,
        lifetime: 'persistent-workspace',
        createdThisSubmission: true
      }),
      Object.freeze({
        role: 'reaction-core-params-arena',
        buffer: paramsBuffer,
        owned: true,
        lifetime: 'persistent-workspace',
        createdThisSubmission: true
      }),
      Object.freeze({
        role: 'reaction-core-disabled-writable-storage-arena',
        buffer: disabledWritableStorageBuffer,
        owned: true,
        lifetime: 'persistent-workspace',
        createdThisSubmission: true
      }),
      Object.freeze({
        role: 'reaction-core-disabled-read-only-storage-arena',
        buffer: disabledReadOnlyStorageBuffer,
        owned: true,
        lifetime: 'persistent-workspace',
        createdThisSubmission: true
      })
    ]);
    const paramsSlot = (slotIndex = 0) => {
      if (destroyed) throw new Error('reactionCoreWorkspace is destroyed');
      return paramsSlots[assertSlotIndex(slotIndex, stepCapacity)];
    };
    const workspace = {
      schema: ULG_SPH_REACTION_CORE_WORKSPACE_GPU_SCHEMA,
      status: 'reaction-core-workspace-ready',
      device,
      deviceId: webGpuDeviceId(device),
      particleCapacity: capacity,
      sequenceStepCapacity: stepCapacity,
      proposalBuffer,
      proposalBufferByteLength,
      paramsBuffer,
      paramsBufferByteLength: paramsLayout.byteLength,
      paramsSlotStrideBytes: paramsLayout.slotStrideBytes,
      paramsSlotByteLengths: PARAM_BYTE_LENGTHS,
      disabledWritableStorageBuffer,
      disabledWritableStorageBufferByteLength: disabledWritableStorageLayout.byteLength,
      disabledReadOnlyStorageBuffer,
      disabledReadOnlyStorageBufferByteLength: disabledReadOnlyStorageLayout.byteLength,
      disabledStorageBufferByteLength:
        disabledWritableStorageLayout.byteLength + disabledReadOnlyStorageLayout.byteLength,
      disabledStorageBindings,
      totalByteLength:
        proposalBufferByteLength
          + paramsLayout.byteLength
          + disabledWritableStorageLayout.byteLength
          + disabledReadOnlyStorageLayout.byteLength,
      allocationEntries,
      usedParamsSlotIndices,
      paramsSlot,
      writeParamsSlot(slotIndex, valuesByKind) {
        const slot = paramsSlot(slotIndex);
        if (!valuesByKind || typeof valuesByKind !== 'object') {
          throw new TypeError('reaction params slot write requires params by kind');
        }
        if (!device.queue?.writeBuffer) {
          throw new TypeError('reaction params slot write requires device.queue.writeBuffer');
        }
        for (const [kind, expectedByteLength] of Object.entries(PARAM_BYTE_LENGTHS)) {
          const data = valuesByKind[kind];
          if (Number(data?.byteLength) !== expectedByteLength) {
            throw new RangeError(
              `reaction ${kind} params must contain ${expectedByteLength} bytes`
            );
          }
          const resource = slot.resources[kind];
          device.queue.writeBuffer(paramsBuffer, resource.byteOffset, data);
        }
        if (!usedParamsSlotIndices.includes(slot.slotIndex)) {
          usedParamsSlotIndices.push(slot.slotIndex);
        }
        return slot;
      },
      bindGroupForSlot(kind, slotIndex, signature, createBindGroup) {
        if (!Object.hasOwn(bindGroupCaches, kind)) {
          throw new RangeError('reaction bind-group cache kind must be propose or resolve');
        }
        const slot = paramsSlot(slotIndex);
        if (!Array.isArray(signature) || signature.length === 0) {
          throw new TypeError('reaction bind-group cache signature must be a non-empty array');
        }
        if (typeof createBindGroup !== 'function') {
          throw new TypeError('reaction bind-group cache requires a creation function');
        }
        const cached = bindGroupCaches[kind][slot.slotIndex];
        if (cached && signaturesMatch(cached.signature, signature)) {
          bindGroupCacheEvidence[`${kind}HitCount`] += 1;
          return Object.freeze({ bindGroup: cached.bindGroup, cacheHit: true, slot });
        }
        const bindGroup = createBindGroup(slot);
        if (!bindGroup) throw new Error('reaction bind-group creation returned no bind group');
        bindGroupCaches[kind][slot.slotIndex] = { signature: [...signature], bindGroup };
        bindGroupCacheEvidence[`${kind}MissCount`] += 1;
        return Object.freeze({ bindGroup, cacheHit: false, slot });
      },
      bindGroupCacheEvidence() {
        return Object.freeze({
          slotCapacity: stepCapacity,
          proposePopulatedSlotCount: bindGroupCaches.propose.filter(Boolean).length,
          resolvePopulatedSlotCount: bindGroupCaches.resolve.filter(Boolean).length,
          ...bindGroupCacheEvidence
        });
      },
      destroyed: false,
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        workspace.destroyed = true;
        workspace.status = 'reaction-core-workspace-destroyed';
        proposalBuffer.destroy?.();
        paramsBuffer.destroy?.();
        disabledWritableStorageBuffer.destroy?.();
        disabledReadOnlyStorageBuffer.destroy?.();
        bindGroupCaches.propose.fill(null);
        bindGroupCaches.resolve.fill(null);
        usedParamsSlotIndices.length = 0;
        return true;
      }
    };
    return workspace;
  } catch (error) {
    for (const buffer of new Set(created)) buffer.destroy?.();
    throw error;
  }
}

export function assertSphReactionCoreWorkspaceGpu(device, workspace, particleCount) {
  if (workspace?.schema !== ULG_SPH_REACTION_CORE_WORKSPACE_GPU_SCHEMA) {
    throw new TypeError('reactionCoreWorkspace schema mismatch');
  }
  if (workspace.destroyed === true) {
    throw new Error('reactionCoreWorkspace is destroyed');
  }
  const buffers = [
    workspace.proposalBuffer,
    workspace.paramsBuffer,
    workspace.disabledWritableStorageBuffer,
    workspace.disabledReadOnlyStorageBuffer
  ];
  if (workspace.device !== device
    || buffers.some((buffer) => !webGpuBufferMatchesDevice(buffer, device))) {
    throw new Error('reactionCoreWorkspace device mismatch');
  }
  const requiredCount = Number(particleCount);
  if (!Number.isSafeInteger(requiredCount) || requiredCount < 0) {
    throw new RangeError('particleCount must be a non-negative safe integer');
  }
  if (workspace.particleCapacity < requiredCount) {
    throw new RangeError(
      `reactionCoreWorkspace capacity ${workspace.particleCapacity} is smaller than ${requiredCount}`
    );
  }
  const proposalRequiredByteLength = requiredCount
    * SPH_REACTION_PROPOSAL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  for (const [label, buffer, requiredByteLength] of [
    ['proposalBuffer', workspace.proposalBuffer, proposalRequiredByteLength]
  ]) {
    if (bufferByteLength(buffer) < requiredByteLength) {
      throw new RangeError(
        `reactionCoreWorkspace ${label} is smaller than ${requiredByteLength} bytes`
      );
    }
  }
  if (!Number.isSafeInteger(workspace.sequenceStepCapacity)
    || workspace.sequenceStepCapacity < 1
    || !Number.isSafeInteger(workspace.paramsSlotStrideBytes)
    || workspace.paramsSlotStrideBytes < 4 * MIN_BINDING_OFFSET_ALIGNMENT
    || bufferByteLength(workspace.paramsBuffer)
      < workspace.sequenceStepCapacity * workspace.paramsSlotStrideBytes
    || bufferByteLength(workspace.disabledWritableStorageBuffer)
      < Number(workspace.disabledWritableStorageBufferByteLength ?? 0)
    || bufferByteLength(workspace.disabledReadOnlyStorageBuffer)
      < Number(workspace.disabledReadOnlyStorageBufferByteLength ?? 0)) {
    throw new RangeError('reactionCoreWorkspace control arenas are invalid');
  }
  return workspace;
}
