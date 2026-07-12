import { createSphPressureInterfaceWorkspaceGpu } from './sphPressureInterfaceWorkspaceGpu.js';
import { createSphReactionCoreWorkspaceGpu } from './sphReactionCoreWorkspaceGpu.js';
import { createSphReactionProductEventPlacementWorkspaceGpu } from './sphReactionProductEventGpu.js';
import { createSphThermalWorkspaceGpu } from './sphThermalWorkspaceGpu.js';
import {
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

export const ULG_SPH_RESIDENT_SEQUENCE_WORKSPACE_GPU_SCHEMA =
  'peercompute.ulg.sph-resident-sequence-workspace-gpu.v0';
export const ULG_SPH_RESIDENT_SEQUENCE_WORKSPACE_ACQUISITION_SCHEMA =
  'peercompute.ulg.sph-resident-sequence-workspace-acquisition.v0';
export const ULG_SPH_RESIDENT_SEQUENCE_PUBLICATION_TOKEN_SCHEMA =
  'peercompute.ulg.sph-resident-sequence-publication-token.v0';
export const ULG_SPH_RESIDENT_SEQUENCE_SUBMISSION_SEAL_SCHEMA =
  'peercompute.ulg.sph-resident-sequence-submission-seal.v0';
export const SPH_RESIDENT_SEQUENCE_WORKSPACE_MAX_IN_FLIGHT_SUBMISSIONS = 2;

const COMPUTE_MANAGER_LEASE_IDENTITY_SCHEMA =
  'peercompute.compute.gpu-resident-lane-lease-identity.v0';
const DEVICE_POOLS = new WeakMap();
const DEVICE_LOSS_OBSERVERS = new WeakSet();
const WORKSPACE_BUFFERS = new WeakSet();
const U32_BYTES = Uint32Array.BYTES_PER_ELEMENT;

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};

let workspaceGenerationSequence = 0;
let acquisitionSequence = 0;

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function nonNegativeSafeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return number;
}

function positiveSafeInteger(value, label) {
  const number = nonNegativeSafeInteger(value, label);
  if (number < 1) throw new RangeError(`${label} must be at least one`);
  return number;
}

function alignedByteLength(value, label) {
  const byteLength = positiveSafeInteger(Math.max(4, Number(value)), label);
  return Math.ceil(byteLength / U32_BYTES) * U32_BYTES;
}

function checkedBufferByteLength(device, value, label) {
  const byteLength = alignedByteLength(value, label);
  const maxBufferSize = Number(device?.limits?.maxBufferSize ?? Number.MAX_SAFE_INTEGER);
  const maxStorageBufferBindingSize = Number(
    device?.limits?.maxStorageBufferBindingSize ?? maxBufferSize
  );
  if (byteLength > maxBufferSize || byteLength > maxStorageBufferBindingSize) {
    throw new RangeError(
      `${label} requires ${byteLength} bytes beyond the WebGPU storage-buffer limit`
    );
  }
  return byteLength;
}

function normalizeRequirements(device, options) {
  const particleCapacity = positiveSafeInteger(options.particleCapacity, 'particleCapacity');
  const gridNodeCapacity = positiveSafeInteger(options.gridNodeCapacity, 'gridNodeCapacity');
  const stateByteLength = checkedBufferByteLength(
    device,
    options.stateByteLength,
    'stateByteLength'
  );
  const thermoByteLength = checkedBufferByteLength(
    device,
    options.thermoByteLength,
    'thermoByteLength'
  );
  const mechanicsByteLength = checkedBufferByteLength(
    device,
    options.mechanicsByteLength,
    'mechanicsByteLength'
  );
  const gridByteLength = checkedBufferByteLength(
    device,
    options.gridByteLength,
    'gridByteLength'
  );
  const p2gAccumulatorByteLength = checkedBufferByteLength(
    device,
    options.p2gAccumulatorByteLength,
    'p2gAccumulatorByteLength'
  );
  const updatedGridByteLength = checkedBufferByteLength(
    device,
    options.updatedGridByteLength,
    'updatedGridByteLength'
  );
  const thermalParticleCapacity = nonNegativeSafeInteger(
    options.thermalParticleCapacity ?? 0,
    'thermalParticleCapacity'
  );
  const reactionProductEventCapacityRows = nonNegativeSafeInteger(
    options.reactionProductEventCapacityRows ?? 0,
    'reactionProductEventCapacityRows'
  );
  const reactionCoreParticleCapacity = nonNegativeSafeInteger(
    options.reactionCoreParticleCapacity ?? 0,
    'reactionCoreParticleCapacity'
  );
  const reactionParticleCapacity = nonNegativeSafeInteger(
    options.reactionParticleCapacity ?? 0,
    'reactionParticleCapacity'
  );
  const pressureCandidateCapacity = nonNegativeSafeInteger(
    options.pressureCandidateCapacity ?? 0,
    'pressureCandidateCapacity'
  );
  const sequenceStepCapacity = positiveSafeInteger(
    options.sequenceStepCapacity ?? 1,
    'sequenceStepCapacity'
  );
  if (reactionProductEventCapacityRows > 0 && reactionParticleCapacity < 1) {
    throw new RangeError(
      'reactionParticleCapacity must be positive when reaction product placement is requested'
    );
  }
  return Object.freeze({
    particleCapacity,
    gridNodeCapacity,
    stateByteLength,
    thermoByteLength,
    mechanicsByteLength,
    gridByteLength,
    p2gAccumulatorByteLength,
    updatedGridByteLength,
    thermalParticleCapacity,
    reactionProductEventCapacityRows,
    reactionCoreParticleCapacity,
    reactionParticleCapacity,
    pressureCandidateCapacity,
    sequenceStepCapacity,
    layoutKey: nonEmptyString(options.layoutKey, 'layoutKey')
  });
}

export function planSphResidentSequenceWorkspaceGpu(options = {}) {
  const particleCapacity = positiveSafeInteger(options.particleCapacity, 'particleCapacity');
  const gridNodeCapacity = positiveSafeInteger(options.gridNodeCapacity, 'gridNodeCapacity');
  const stateByteLength = alignedByteLength(options.stateByteLength, 'stateByteLength');
  const thermoByteLength = alignedByteLength(options.thermoByteLength, 'thermoByteLength');
  const mechanicsByteLength = alignedByteLength(
    options.mechanicsByteLength,
    'mechanicsByteLength'
  );
  const gridByteLength = alignedByteLength(options.gridByteLength, 'gridByteLength');
  const p2gAccumulatorByteLength = alignedByteLength(
    options.p2gAccumulatorByteLength,
    'p2gAccumulatorByteLength'
  );
  const updatedGridByteLength = alignedByteLength(
    options.updatedGridByteLength,
    'updatedGridByteLength'
  );
  const particleFamilyByteLength = 2 * (
    stateByteLength + thermoByteLength + mechanicsByteLength
  );
  const gridScratchByteLength = gridByteLength
    + p2gAccumulatorByteLength
    + updatedGridByteLength;
  return Object.freeze({
    schema: 'peercompute.ulg.sph-resident-sequence-workspace-plan.v0',
    status: 'sph-resident-sequence-workspace-plan-ready',
    exact: true,
    particleCapacity,
    gridNodeCapacity,
    stateBufferCount: 2,
    thermoBufferCount: 2,
    mechanicsBufferCount: 2,
    stateByteLength,
    thermoByteLength,
    mechanicsByteLength,
    particleFamilyByteLength,
    gridByteLength,
    p2gAccumulatorByteLength,
    updatedGridByteLength,
    gridScratchByteLength,
    coreByteLength: particleFamilyByteLength + gridScratchByteLength,
    mutableArenaPolicy: 'same-device-same-queue-read-before-write-two-family-pings',
    immutableSnapshotBuffers: false
  });
}

function assertLeaseIdentity(device, identity, options) {
  if (identity?.schema !== COMPUTE_MANAGER_LEASE_IDENTITY_SCHEMA
    || identity.authoritative !== true) {
    throw new TypeError(
      'resident sequence workspace requires an authoritative ComputeManager lane lease identity'
    );
  }
  for (const field of ['leaseId', 'laneId', 'stateKey', 'sourceFamily', 'taskId']) {
    nonEmptyString(identity[field], `leaseIdentity.${field}`);
  }
  for (const [field, expected] of [
    ['laneId', options.laneId],
    ['stateKey', options.stateKey],
    ['sourceFamily', options.sourceFamily]
  ]) {
    if (identity[field] !== expected) {
      throw new RangeError(`leaseIdentity.${field} does not match the requested workspace lane`);
    }
  }
  const deviceId = webGpuDeviceId(device);
  if (identity.deviceId != null && identity.deviceId !== deviceId) {
    throw new RangeError('leaseIdentity.deviceId does not match the workspace device');
  }
  return Object.freeze({
    schema: identity.schema,
    authoritative: true,
    leaseId: identity.leaseId,
    laneId: identity.laneId,
    stateKey: identity.stateKey,
    sourceFamily: identity.sourceFamily,
    taskId: identity.taskId,
    deviceId
  });
}

function lanePoolKey({ laneId, stateKey, sourceFamily }) {
  return JSON.stringify([laneId, stateKey, sourceFamily]);
}

function devicePool(device) {
  let pool = DEVICE_POOLS.get(device);
  if (!pool) {
    pool = {
      device,
      deviceId: webGpuDeviceId(device),
      lanes: new Map(),
      poisoned: false,
      poisonReason: null,
      deviceLossInfo: null
    };
    DEVICE_POOLS.set(device, pool);
  }
  if (!DEVICE_LOSS_OBSERVERS.has(device) && device?.lost?.then) {
    DEVICE_LOSS_OBSERVERS.add(device);
    Promise.resolve(device.lost).then(
      (info) => poisonDevicePool(pool, 'webgpu-device-lost', info),
      (error) => poisonDevicePool(pool, 'webgpu-device-loss-observer-rejected', error)
    );
  }
  return pool;
}

function createTrackedBuffer(device, descriptor) {
  const buffer = tagWebGpuBufferDevice(device.createBuffer(descriptor), device);
  WORKSPACE_BUFFERS.add(buffer);
  return buffer;
}

function bufferByteLength(buffer) {
  const value = Number(buffer?.size ?? buffer?.byteLength ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function workspaceAllocationEntries(entry, createdThisSubmission) {
  const persistent = (role, buffer) => ({
    role,
    buffer,
    owned: true,
    lifetime: 'persistent-workspace',
    createdThisSubmission
  });
  return [
    persistent('resident-sequence-grid', entry.gridBuffer),
    persistent('resident-sequence-p2g-accumulator', entry.p2gAccumulatorBuffer),
    persistent('resident-sequence-updated-grid', entry.updatedGridBuffer),
    persistent('resident-sequence-p2g-params', entry.p2gParamsBuffer),
    persistent('resident-sequence-grid-update-params', entry.gridUpdateParamsBuffer),
    persistent('resident-sequence-g2p-params', entry.g2pParamsBuffer),
    persistent(
      'resident-sequence-empty-schroeder-level-assignments',
      entry.emptySchroederLevelAssignmentsBuffer
    ),
    persistent(
      'resident-sequence-empty-schroeder-active-nodes',
      entry.emptySchroederActiveNodesBuffer
    ),
    persistent('resident-sequence-empty-pressure-force-rows', entry.emptyPressureForceRowsBuffer),
    persistent('resident-sequence-empty-product-events', entry.emptyProductEventsBuffer),
    persistent('resident-sequence-separation-params', entry.separationScratch.paramsBuffer),
    persistent(
      'resident-sequence-separation-corrections',
      entry.separationScratch.correctionsBuffer
    ),
    ...entry.statePingBuffers.map((buffer, index) => persistent(
      `resident-sequence-state-ping-${index}`,
      buffer
    )),
    ...entry.thermoPingBuffers.map((buffer, index) => persistent(
      `resident-sequence-thermo-ping-${index}`,
      buffer
    )),
    ...entry.mechanicsPingBuffers.map((buffer, index) => persistent(
      `resident-sequence-mechanics-ping-${index}`,
      buffer
    )),
    ...(entry.thermalWorkspace?.allocationEntries || []).map((allocation) => ({
      ...allocation,
      role: `resident-sequence:${allocation.role}`,
      lifetime: 'persistent-workspace',
      createdThisSubmission
    })),
    ...(entry.reactionCoreWorkspace?.allocationEntries || []).map((allocation) => ({
      ...allocation,
      role: `resident-sequence:${allocation.role}`,
      lifetime: 'persistent-workspace',
      createdThisSubmission
    })),
    ...(entry.reactionProductEventPlacementWorkspace?.allocationEntries || []).map(
      (allocation) => ({
        ...allocation,
        role: allocation.role === 'product-event-target-claims'
          ? 'reaction-product-event-placement-candidates'
          : `reaction-${allocation.role}`,
        owned: true,
        lifetime: 'persistent-workspace',
        createdThisSubmission
      })
    ),
    ...(entry.pressureInterfaceWorkspace?.allocationEntries || []).map((allocation) => ({
      ...allocation,
      role: `resident-sequence:${allocation.role}`,
      lifetime: 'persistent-workspace',
      createdThisSubmission
    }))
  ];
}

function createWorkspaceEntry(device, requirements, labelPrefix) {
  const generation = ++workspaceGenerationSequence;
  const label = String(labelPrefix || 'ulg-mls-mpm-fused-sequence');
  const usage = GPU_BUFFER_USAGE.STORAGE
    | GPU_BUFFER_USAGE.COPY_SRC
    | GPU_BUFFER_USAGE.COPY_DST;
  const created = [];
  const create = (suffix, size, bufferUsage = usage) => {
    const buffer = createTrackedBuffer(device, {
      label: `${label}-${suffix}`,
      size,
      usage: bufferUsage
    });
    created.push(buffer);
    return buffer;
  };
  let thermalWorkspace = null;
  let reactionCoreWorkspace = null;
  let reactionProductEventPlacementWorkspace = null;
  let pressureInterfaceWorkspace = null;
  try {
    const gridBuffer = create('p2g-grid-out', requirements.gridByteLength);
    const p2gAccumulatorBuffer = create(
      'p2g-grid-accumulators',
      requirements.p2gAccumulatorByteLength
    );
    const updatedGridBuffer = create(
      'grid-update-out',
      requirements.updatedGridByteLength
    );
    const statePingBuffers = [
      create('g2p-state-ping-a', requirements.stateByteLength),
      create('g2p-state-ping-b', requirements.stateByteLength)
    ];
    const thermoPingBuffers = [
      create('thermo-ping-a', requirements.thermoByteLength),
      create('thermo-ping-b', requirements.thermoByteLength)
    ];
    const mechanicsPingBuffers = [
      create('g2p-mechanics-ping-a', requirements.mechanicsByteLength),
      create('g2p-mechanics-ping-b', requirements.mechanicsByteLength)
    ];
    const uniformUsage = GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST;
    const storageInputUsage = GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST;
    const p2gParamsBuffer = create('p2g-params', 112, uniformUsage);
    const gridUpdateParamsBuffer = create('grid-update-params', 112, uniformUsage);
    const g2pParamsBuffer = create('g2p-params', 80, uniformUsage);
    const emptySchroederLevelAssignmentsBuffer = create(
      'empty-schroeder-level-assignments',
      64,
      storageInputUsage
    );
    const emptySchroederActiveNodesBuffer = create(
      'empty-schroeder-active-nodes',
      64,
      storageInputUsage
    );
    const emptyPressureForceRowsBuffer = create(
      'empty-pressure-force-rows',
      64,
      storageInputUsage
    );
    const emptyProductEventsBuffer = create('empty-product-events', 128, storageInputUsage);
    const separationParamsSlotStrideBytes = Math.max(
      256,
      Math.round(Number(device.limits?.minUniformBufferOffsetAlignment) || 256)
    );
    const separationScratch = {
      particleCount: requirements.particleCapacity,
      particleRowCapacity: requirements.particleCapacity,
      cellCount: 0,
      residentMode: true,
      paramsBuffer: create(
        'separation-params',
        requirements.sequenceStepCapacity * separationParamsSlotStrideBytes,
        uniformUsage
      ),
      paramsSlotCount: requirements.sequenceStepCapacity,
      paramsSlotStrideBytes: separationParamsSlotStrideBytes,
      usedParamsSlotIndices: [],
      correctionsBuffer: create(
        'separation-corrections',
        requirements.stateByteLength,
        GPU_BUFFER_USAGE.STORAGE
      ),
      binsBuffer: null,
      neighborBins: null,
      transientBuffers: []
    };
    if (requirements.thermalParticleCapacity > 0) {
      thermalWorkspace = createSphThermalWorkspaceGpu({
        device,
        particleCapacity: requirements.thermalParticleCapacity,
        sequenceStepCapacity: requirements.sequenceStepCapacity,
        label: `${label}-thermal-workspace`
      });
      for (const allocation of thermalWorkspace.allocationEntries) {
        WORKSPACE_BUFFERS.add(allocation.buffer);
      }
    }
    if (requirements.reactionCoreParticleCapacity > 0) {
      reactionCoreWorkspace = createSphReactionCoreWorkspaceGpu({
        device,
        particleCapacity: requirements.reactionCoreParticleCapacity,
        sequenceStepCapacity: requirements.sequenceStepCapacity,
        label: `${label}-reaction-core-workspace`
      });
      for (const allocation of reactionCoreWorkspace.allocationEntries) {
        WORKSPACE_BUFFERS.add(allocation.buffer);
      }
    }
    if (requirements.reactionProductEventCapacityRows > 0) {
      reactionProductEventPlacementWorkspace =
        createSphReactionProductEventPlacementWorkspaceGpu(device, {
          eventCapacityRows: requirements.reactionProductEventCapacityRows,
          particleCapacity: requirements.reactionParticleCapacity,
          sequenceStepCapacity: requirements.sequenceStepCapacity,
          label: `${label}-reaction-product-placement-workspace`
        });
      for (const allocation of reactionProductEventPlacementWorkspace.allocationEntries) {
        WORKSPACE_BUFFERS.add(allocation.buffer);
      }
    }
    if (requirements.pressureCandidateCapacity > 0) {
      pressureInterfaceWorkspace = createSphPressureInterfaceWorkspaceGpu({
        device,
        candidateCapacity: requirements.pressureCandidateCapacity,
        sequenceStepCapacity: requirements.sequenceStepCapacity,
        registerBuffer: (buffer) => WORKSPACE_BUFFERS.add(buffer),
        labelPrefix: `${label}-pressure-workspace`
      });
      for (const allocation of pressureInterfaceWorkspace.allocationEntries) {
        WORKSPACE_BUFFERS.add(allocation.buffer);
      }
    }
    const entry = {
      schema: ULG_SPH_RESIDENT_SEQUENCE_WORKSPACE_GPU_SCHEMA,
      status: 'sph-resident-sequence-workspace-ready',
      device,
      deviceId: webGpuDeviceId(device),
      generation,
      requirements,
      labelPrefix: label,
      gridBuffer,
      p2gAccumulatorBuffer,
      updatedGridBuffer,
      statePingBuffers,
      thermoPingBuffers,
      mechanicsPingBuffers,
      p2gParamsBuffer,
      gridUpdateParamsBuffer,
      g2pParamsBuffer,
      emptySchroederLevelAssignmentsBuffer,
      emptySchroederActiveNodesBuffer,
      emptyPressureForceRowsBuffer,
      emptyProductEventsBuffer,
      separationScratch,
      thermalWorkspace,
      reactionCoreWorkspace,
      reactionProductEventPlacementWorkspace,
      pressureInterfaceWorkspace,
      activeAcquisitionCount: 0,
      totalAcquisitionCount: 0,
      totalSubmissionCount: 0,
      retireRequested: false,
      retirementFenceSettled: false,
      destroyed: false
    };
    entry.allocationEntries = workspaceAllocationEntries(entry, true);
    entry.totalByteLength = entry.allocationEntries.reduce(
      (sum, allocation) => sum + bufferByteLength(allocation.buffer),
      0
    );
    entry.particleFamilyByteLength = 2 * (
      requirements.stateByteLength
      + requirements.thermoByteLength
      + requirements.mechanicsByteLength
    );
    entry.gridScratchByteLength = requirements.gridByteLength
      + requirements.p2gAccumulatorByteLength
      + requirements.updatedGridByteLength;
    return entry;
  } catch (error) {
    thermalWorkspace?.destroy?.();
    reactionCoreWorkspace?.destroy?.();
    reactionProductEventPlacementWorkspace?.destroy?.();
    pressureInterfaceWorkspace?.destroy?.();
    for (const buffer of created) buffer.destroy?.();
    throw error;
  }
}

function workspaceFits(entry, requirements) {
  if (!entry || entry.destroyed || entry.requirements.layoutKey !== requirements.layoutKey) {
    return false;
  }
  for (const field of [
    'particleCapacity',
    'gridNodeCapacity',
    'stateByteLength',
    'thermoByteLength',
    'mechanicsByteLength',
    'gridByteLength',
    'p2gAccumulatorByteLength',
    'updatedGridByteLength',
    'thermalParticleCapacity',
    'reactionProductEventCapacityRows',
    'reactionCoreParticleCapacity',
    'reactionParticleCapacity',
    'pressureCandidateCapacity',
    'sequenceStepCapacity'
  ]) {
    if (entry.requirements[field] < requirements[field]) return false;
  }
  if (requirements.reactionParticleCapacity > 0
    && entry.requirements.reactionParticleCapacity !== requirements.reactionParticleCapacity) {
    return false;
  }
  return true;
}

function destroyWorkspaceEntry(entry) {
  if (!entry || entry.destroyed) return false;
  entry.destroyed = true;
  entry.status = 'sph-resident-sequence-workspace-destroyed';
  for (const buffer of [
    entry.gridBuffer,
    entry.p2gAccumulatorBuffer,
    entry.updatedGridBuffer,
    entry.p2gParamsBuffer,
    entry.gridUpdateParamsBuffer,
    entry.g2pParamsBuffer,
    entry.emptySchroederLevelAssignmentsBuffer,
    entry.emptySchroederActiveNodesBuffer,
    entry.emptyPressureForceRowsBuffer,
    entry.emptyProductEventsBuffer,
    entry.separationScratch.paramsBuffer,
    entry.separationScratch.correctionsBuffer,
    ...entry.statePingBuffers,
    ...entry.thermoPingBuffers,
    ...entry.mechanicsPingBuffers
  ]) buffer.destroy?.();
  entry.thermalWorkspace?.destroy?.();
  entry.reactionCoreWorkspace?.destroy?.();
  entry.reactionProductEventPlacementWorkspace?.destroy?.();
  entry.pressureInterfaceWorkspace?.destroy?.();
  return true;
}

function settleRecord(lane, record, settlement) {
  if (record.settled) return false;
  record.settled = true;
  record.status = settlement.status;
  record.settlementReason = settlement.reason ?? null;
  record.entry.activeAcquisitionCount = Math.max(
    0,
    record.entry.activeAcquisitionCount - 1
  );
  const index = lane.pendingAcquisitions.indexOf(record);
  if (index >= 0) lane.pendingAcquisitions.splice(index, 1);
  record.resolveSettlement(settlement);
  return true;
}

function retireSettledEntries(lane) {
  let destroyedCount = 0;
  for (const entry of [...lane.retiredEntries]) {
    if (!entry.retirementFenceSettled || entry.activeAcquisitionCount > 0) continue;
    if (destroyWorkspaceEntry(entry)) destroyedCount += 1;
    lane.retiredEntries.delete(entry);
  }
  lane.retiredWorkspaceDestroyCount += destroyedCount;
  return destroyedCount;
}

function poisonDevicePool(pool, reason, info = null) {
  if (!pool || pool.poisoned) return false;
  pool.poisoned = true;
  pool.poisonReason = reason;
  pool.deviceLossInfo = info ?? null;
  for (const lane of pool.lanes.values()) {
    lane.poisoned = true;
    lane.poisonReason = reason;
    for (const record of [...lane.pendingAcquisitions]) {
      settleRecord(lane, record, {
        status: 'sph-resident-sequence-workspace-device-lost',
        reason
      });
    }
    destroyWorkspaceEntry(lane.activeEntry);
    for (const entry of lane.retiredEntries) destroyWorkspaceEntry(entry);
    lane.retiredEntries.clear();
  }
  return true;
}

function laneSnapshot(lane) {
  const entry = lane.activeEntry;
  return Object.freeze({
    schema: 'peercompute.ulg.sph-resident-sequence-workspace-lane-evidence.v0',
    status: lane.poisoned
      ? 'sph-resident-sequence-workspace-lane-poisoned'
      : 'sph-resident-sequence-workspace-lane-ready',
    deviceId: lane.deviceId,
    laneId: lane.laneId,
    stateKey: lane.stateKey,
    sourceFamily: lane.sourceFamily,
    layoutKey: entry?.requirements.layoutKey ?? null,
    workspaceGeneration: entry?.generation ?? null,
    pendingSubmissionCount: lane.pendingAcquisitions.length,
    peakPendingSubmissionCount: lane.peakPendingSubmissionCount,
    maxInFlightSubmissions: SPH_RESIDENT_SEQUENCE_WORKSPACE_MAX_IN_FLIGHT_SUBMISSIONS,
    totalAcquisitionCount: lane.totalAcquisitionCount,
    totalSubmissionCount: lane.totalSubmissionCount,
    totalBackpressureWaitCount: lane.totalBackpressureWaitCount,
    totalWorkspaceCreationCount: lane.totalWorkspaceCreationCount,
    totalWorkspaceReuseCount: lane.totalWorkspaceReuseCount,
    totalWorkspaceGrowthCount: lane.totalWorkspaceGrowthCount,
    authorityEpoch: lane.authorityEpoch,
    authorityRebaseCount: lane.authorityRebaseCount,
    authorityRebasePending: Boolean(lane.authorityRebasePromise),
    retiredWorkspaceCount: lane.retiredEntries.size,
    retiredWorkspaceDestroyCount: lane.retiredWorkspaceDestroyCount,
    totalByteLength: entry?.totalByteLength ?? 0,
    particleFamilyByteLength: entry?.particleFamilyByteLength ?? 0,
    gridScratchByteLength: entry?.gridScratchByteLength ?? 0,
    authoritativeBuffersPublished: Boolean(lane.authoritativeBuffers),
    authoritativePublicationToken: lane.authoritativePublicationToken,
    publicationVersion: lane.publicationVersion,
    mutableArenaPolicy: 'same-device-same-queue-read-before-write-two-family-pings',
    priorConsumersMustBeCommandSubmittedBeforeReuse: true,
    immutableSnapshotBuffers: false,
    poisoned: lane.poisoned,
    poisonReason: lane.poisonReason
  });
}

function publicationTokenMatches(expected, candidate) {
  if (!expected || !candidate) return false;
  return [
    'schema',
    'deviceId',
    'laneId',
    'stateKey',
    'sourceFamily',
    'authorityEpoch',
    'workspaceGeneration',
    'acquisitionId',
    'submissionVersion'
  ].every((field) => candidate[field] === expected[field]);
}

function publicationTokenForRecord(lane, record) {
  lane.nextPublicationVersion += 1;
  return Object.freeze({
    schema: ULG_SPH_RESIDENT_SEQUENCE_PUBLICATION_TOKEN_SCHEMA,
    deviceId: lane.deviceId,
    laneId: lane.laneId,
    stateKey: lane.stateKey,
    sourceFamily: lane.sourceFamily,
    authorityEpoch: record.authorityEpoch,
    workspaceGeneration: record.entry.generation,
    acquisitionId: record.acquisitionId,
    submissionVersion: lane.nextPublicationVersion
  });
}

function sourceContinuityError(message, reason, expected = null, received = null) {
  const error = new Error(message);
  error.code = 'ULG_SPH_RESIDENT_SEQUENCE_PREDECESSOR_TOKEN_REJECTED';
  error.reason = reason;
  error.expectedPublicationToken = expected;
  error.receivedPublicationToken = received;
  return error;
}

function assertSourceContinuity(lane, sourceBuffers, record) {
  if (!sourceBuffers?.stateBuffer || !sourceBuffers?.thermoBuffer
    || !sourceBuffers?.mechanicsBuffer) {
    throw new TypeError('resident sequence source continuity requires all particle families');
  }
  if (!lane.authoritativeBuffers) return true;
  const predecessorPublicationToken = sourceBuffers.predecessorPublicationToken ?? null;
  if (!predecessorPublicationToken) {
    throw sourceContinuityError(
      'resident sequence source continuity requires the current predecessor publication token',
      'predecessor-publication-token-missing',
      lane.authoritativePublicationToken,
      null
    );
  }
  if (!publicationTokenMatches(
    lane.authoritativePublicationToken,
    predecessorPublicationToken
  )) {
    throw sourceContinuityError(
      'resident sequence predecessor publication token is not current for the lane',
      'predecessor-publication-token-stale',
      lane.authoritativePublicationToken,
      predecessorPublicationToken
    );
  }
  const mismatches = Object.entries(lane.authoritativeBuffers).filter(
    ([field, expected]) => sourceBuffers[field] !== expected
  );
  if (mismatches.length > 0) {
    for (const [field] of mismatches) {
      const error = new Error(
        `resident sequence ${field} is not the current authoritative lane buffer`
      );
      error.code = 'ULG_SPH_RESIDENT_SEQUENCE_SOURCE_CONTINUITY_REJECTED';
      error.field = field;
      throw error;
    }
  }
  return true;
}

function selectDestination(entry, family, sourceBuffer) {
  const buffers = family === 'state'
    ? entry.statePingBuffers
    : family === 'thermo'
    ? entry.thermoPingBuffers
    : family === 'mechanics'
    ? entry.mechanicsPingBuffers
    : null;
  if (!buffers) throw new RangeError(`unknown resident particle family ${family}`);
  const destination = sourceBuffer === buffers[0] ? buffers[1] : buffers[0];
  if (!destination || destination === sourceBuffer) {
    throw new Error(`resident sequence ${family} source/destination alias rejected`);
  }
  return destination;
}

function createLane(pool, identity) {
  return {
    device: pool.device,
    deviceId: pool.deviceId,
    laneId: identity.laneId,
    stateKey: identity.stateKey,
    sourceFamily: identity.sourceFamily,
    activeEntry: null,
    retiredEntries: new Set(),
    pendingAcquisitions: [],
    authoritativeBuffers: null,
    authoritativePublicationToken: null,
    publicationVersion: 0,
    nextPublicationVersion: 0,
    authorityEpoch: null,
    authorityRebasePromise: null,
    authorityRebaseTargetEpoch: null,
    totalAcquisitionCount: 0,
    totalSubmissionCount: 0,
    totalBackpressureWaitCount: 0,
    totalWorkspaceCreationCount: 0,
    totalWorkspaceReuseCount: 0,
    totalWorkspaceGrowthCount: 0,
    authorityRebaseCount: 0,
    retiredWorkspaceDestroyCount: 0,
    peakPendingSubmissionCount: 0,
    poisoned: false,
    poisonReason: null
  };
}

async function admitAuthorityEpoch(lane, pool, requestedEpoch) {
  let waitedForAuthorityRebase = false;
  while (true) {
    if (lane.poisoned || pool.poisoned) {
      throw new Error(`resident sequence workspace became unavailable: ${lane.poisonReason}`);
    }
    if (lane.authorityRebasePromise) {
      waitedForAuthorityRebase = true;
      await lane.authorityRebasePromise;
      continue;
    }
    if (lane.authorityEpoch == null) {
      lane.authorityEpoch = requestedEpoch;
      return { authorityRebased: false, waitedForAuthorityRebase };
    }
    if (requestedEpoch < lane.authorityEpoch) {
      const error = new Error(
        `resident sequence authority epoch ${requestedEpoch} is older than lane epoch ${lane.authorityEpoch}`
      );
      error.code = 'ULG_SPH_RESIDENT_SEQUENCE_STALE_AUTHORITY_EPOCH';
      error.requestedAuthorityEpoch = requestedEpoch;
      error.currentAuthorityEpoch = lane.authorityEpoch;
      throw error;
    }
    if (requestedEpoch === lane.authorityEpoch) {
      return { authorityRebased: false, waitedForAuthorityRebase };
    }

    const newestPendingAcquisition = lane.pendingAcquisitions.at(-1) ?? null;
    if (newestPendingAcquisition && newestPendingAcquisition.submitted !== true) {
      const error = new Error(
        'resident sequence authority rebase requires the prior acquisition to be command-submitted'
      );
      error.code = 'ULG_SPH_RESIDENT_SEQUENCE_AUTHORITY_REBASE_BEFORE_SUBMIT';
      error.priorAcquisitionId = newestPendingAcquisition.acquisitionId;
      throw error;
    }

    const priorSettlements = lane.pendingAcquisitions.map((record) => record.settlement);
    lane.authorityRebaseTargetEpoch = requestedEpoch;
    lane.authorityRebasePromise = Promise.all(priorSettlements).then(() => {
      if (lane.poisoned || pool.poisoned) {
        throw new Error(`resident sequence workspace became unavailable: ${lane.poisonReason}`);
      }
      lane.authoritativeBuffers = null;
      lane.authoritativePublicationToken = null;
      lane.authorityEpoch = requestedEpoch;
      lane.authorityRebaseCount += 1;
    }).finally(() => {
      lane.authorityRebasePromise = null;
      lane.authorityRebaseTargetEpoch = null;
    });
    waitedForAuthorityRebase = priorSettlements.length > 0;
    await lane.authorityRebasePromise;
    return { authorityRebased: true, waitedForAuthorityRebase };
  }
}

export async function acquireSphResidentSequenceWorkspaceGpu({
  device,
  leaseIdentity,
  laneId = leaseIdentity?.laneId,
  stateKey = leaseIdentity?.stateKey,
  sourceFamily = leaseIdentity?.sourceFamily,
  authorityEpoch = 0,
  waitForCapacity = true,
  labelPrefix = 'ulg-mls-mpm-fused-sequence',
  ...options
} = {}) {
  if (!device?.createBuffer || typeof device.queue?.onSubmittedWorkDone !== 'function') {
    throw new TypeError(
      'resident sequence workspace requires WebGPU createBuffer and queue completion observation'
    );
  }
  const identity = assertLeaseIdentity(device, leaseIdentity, {
    laneId: nonEmptyString(laneId, 'laneId'),
    stateKey: nonEmptyString(stateKey, 'stateKey'),
    sourceFamily: nonEmptyString(sourceFamily, 'sourceFamily')
  });
  const requirements = normalizeRequirements(device, options);
  const pool = devicePool(device);
  if (pool.poisoned) {
    throw new Error(`resident sequence workspace device is poisoned: ${pool.poisonReason}`);
  }
  const key = lanePoolKey(identity);
  let lane = pool.lanes.get(key);
  if (!lane) {
    lane = createLane(pool, identity);
    pool.lanes.set(key, lane);
  }
  if (lane.poisoned) {
    throw new Error(`resident sequence workspace lane is poisoned: ${lane.poisonReason}`);
  }
  const requestedAuthorityEpoch = nonNegativeSafeInteger(
    authorityEpoch,
    'authorityEpoch'
  );
  const authorityAdmission = await admitAuthorityEpoch(
    lane,
    pool,
    requestedAuthorityEpoch
  );
  const newestPendingAcquisition = lane.pendingAcquisitions.at(-1) ?? null;
  if (newestPendingAcquisition && newestPendingAcquisition.submitted !== true) {
    const error = new Error(
      'resident sequence workspace reuse requires the prior acquisition to be command-submitted'
    );
    error.code = 'ULG_SPH_RESIDENT_SEQUENCE_PRIOR_ACQUISITION_NOT_SUBMITTED';
    error.priorAcquisitionId = newestPendingAcquisition.acquisitionId;
    throw error;
  }
  let waitedForCapacity = false;
  while (lane.pendingAcquisitions.length
    >= SPH_RESIDENT_SEQUENCE_WORKSPACE_MAX_IN_FLIGHT_SUBMISSIONS) {
    if (!waitForCapacity) {
      const error = new Error('resident sequence workspace in-flight window is full');
      error.code = 'ULG_SPH_RESIDENT_SEQUENCE_WORKSPACE_IN_FLIGHT';
      error.inFlightCount = lane.pendingAcquisitions.length;
      error.maxInFlightSubmissions =
        SPH_RESIDENT_SEQUENCE_WORKSPACE_MAX_IN_FLIGHT_SUBMISSIONS;
      throw error;
    }
    waitedForCapacity = true;
    lane.totalBackpressureWaitCount += 1;
    await lane.pendingAcquisitions[0].settlement;
    if (lane.poisoned || pool.poisoned) {
      throw new Error(`resident sequence workspace became unavailable: ${lane.poisonReason}`);
    }
  }

  let created = false;
  let grew = false;
  if (!workspaceFits(lane.activeEntry, requirements)) {
    const previous = lane.activeEntry;
    const entry = createWorkspaceEntry(device, requirements, labelPrefix);
    lane.activeEntry = entry;
    lane.totalWorkspaceCreationCount += 1;
    created = true;
    if (previous) {
      previous.retireRequested = true;
      previous.status = 'sph-resident-sequence-workspace-retire-pending';
      lane.retiredEntries.add(previous);
      lane.totalWorkspaceGrowthCount += 1;
      grew = true;
    }
  } else {
    lane.totalWorkspaceReuseCount += 1;
  }
  const entry = lane.activeEntry;
  entry.activeAcquisitionCount += 1;
  entry.totalAcquisitionCount += 1;
  lane.totalAcquisitionCount += 1;
  const acquisitionId = ++acquisitionSequence;
  let resolveSettlement;
  const settlement = new Promise((resolve) => { resolveSettlement = resolve; });
  const record = {
    acquisitionId,
    identity,
    entry,
    status: 'acquired-before-submit',
    commandEncoder: null,
    sealed: false,
    submitted: false,
    settled: false,
    publicationToken: null,
    sealEvidence: null,
    commitEvidence: null,
    settlement,
    resolveSettlement
  };
  record.familyTransitions = {
    state: [],
    thermo: [],
    mechanics: []
  };
  record.authorityEpoch = requestedAuthorityEpoch;
  record.authorityRebased = authorityAdmission.authorityRebased;
  lane.pendingAcquisitions.push(record);
  lane.peakPendingSubmissionCount = Math.max(
    lane.peakPendingSubmissionCount,
    lane.pendingAcquisitions.length
  );

  const acquisition = {
    schema: ULG_SPH_RESIDENT_SEQUENCE_WORKSPACE_ACQUISITION_SCHEMA,
    status: created
      ? (grew
          ? 'sph-resident-sequence-workspace-grown'
          : 'sph-resident-sequence-workspace-created')
      : 'sph-resident-sequence-workspace-reused',
    deviceId: pool.deviceId,
    laneId: lane.laneId,
    stateKey: lane.stateKey,
    sourceFamily: lane.sourceFamily,
    leaseId: identity.leaseId,
    taskId: identity.taskId,
    authorityEpoch: requestedAuthorityEpoch,
    authorityRebased: authorityAdmission.authorityRebased,
    waitedForAuthorityRebase: authorityAdmission.waitedForAuthorityRebase,
    acquisitionId,
    workspaceGeneration: entry.generation,
    layoutKey: entry.requirements.layoutKey,
    createdThisAcquisition: created,
    reused: !created,
    grew,
    waitedForCapacity,
    maxInFlightSubmissions: SPH_RESIDENT_SEQUENCE_WORKSPACE_MAX_IN_FLIGHT_SUBMISSIONS,
    inFlightSubmissionCountAtAcquire: lane.pendingAcquisitions.length,
    mutableArenaPolicy: 'same-device-same-queue-read-before-write-two-family-pings',
    priorConsumersMustBeCommandSubmittedBeforeReuse: true,
    immutableSnapshotBuffers: false,
    sourceDestinationAliasAllowed: false,
    finalBufferMayReuseSubmittedSourceAfterOrderedTransitions: true,
    gridBuffer: entry.gridBuffer,
    p2gAccumulatorBuffer: entry.p2gAccumulatorBuffer,
    updatedGridBuffer: entry.updatedGridBuffer,
    p2gParamsBuffer: entry.p2gParamsBuffer,
    gridUpdateParamsBuffer: entry.gridUpdateParamsBuffer,
    g2pParamsBuffer: entry.g2pParamsBuffer,
    emptySchroederLevelAssignmentsBuffer: entry.emptySchroederLevelAssignmentsBuffer,
    emptySchroederActiveNodesBuffer: entry.emptySchroederActiveNodesBuffer,
    emptyPressureForceRowsBuffer: entry.emptyPressureForceRowsBuffer,
    emptyProductEventsBuffer: entry.emptyProductEventsBuffer,
    separationScratch: entry.separationScratch,
    statePingBuffers: entry.statePingBuffers,
    thermoPingBuffers: entry.thermoPingBuffers,
    mechanicsPingBuffers: entry.mechanicsPingBuffers,
    thermalWorkspace: entry.thermalWorkspace,
    reactionCoreWorkspace: entry.reactionCoreWorkspace,
    reactionProductEventPlacementWorkspace:
      entry.reactionProductEventPlacementWorkspace,
    pressureInterfaceWorkspace: entry.pressureInterfaceWorkspace,
    totalByteLength: entry.totalByteLength,
    particleFamilyByteLength: entry.particleFamilyByteLength,
    gridScratchByteLength: entry.gridScratchByteLength,
    allocationEntries: workspaceAllocationEntries(entry, created),
    assertAuthoritativeSourceBuffers(sourceBuffers) {
      if (record.settled) throw new Error('resident sequence workspace acquisition is settled');
      const accepted = assertSourceContinuity(lane, sourceBuffers, record);
      record.sourceBuffers = {
        stateBuffer: sourceBuffers.stateBuffer,
        thermoBuffer: sourceBuffers.thermoBuffer,
        mechanicsBuffer: sourceBuffers.mechanicsBuffer,
        predecessorPublicationToken: sourceBuffers.predecessorPublicationToken ?? null
      };
      return accepted;
    },
    bindCommandEncoder(commandEncoder) {
      if (record.settled) throw new Error('resident sequence workspace acquisition is settled');
      if (!commandEncoder || (typeof commandEncoder !== 'object'
        && typeof commandEncoder !== 'function')) {
        throw new TypeError('resident sequence workspace requires the actual GPU command encoder');
      }
      if (record.commandEncoder && record.commandEncoder !== commandEncoder) {
        const error = new Error(
          'resident sequence workspace acquisition is already bound to another command encoder'
        );
        error.code = 'ULG_SPH_RESIDENT_SEQUENCE_COMMAND_ENCODER_MISMATCH';
        throw error;
      }
      record.commandEncoder = commandEncoder;
      return true;
    },
    selectDestination(family, sourceBuffer) {
      if (record.settled) throw new Error('resident sequence workspace acquisition is settled');
      if (record.sealed) {
        throw new Error('resident sequence workspace acquisition is sealed for submission');
      }
      if (!record.commandEncoder) {
        const error = new Error(
          'resident sequence transition planning requires a bound GPU command encoder'
        );
        error.code = 'ULG_SPH_RESIDENT_SEQUENCE_COMMAND_ENCODER_REQUIRED';
        throw error;
      }
      const destinationBuffer = selectDestination(entry, family, sourceBuffer);
      record.familyTransitions[family].push({
        sourceBuffer,
        destinationBuffer,
        commandEncoder: record.commandEncoder
      });
      return destinationBuffer;
    },
    sealForSubmission({
      commandEncoder,
      finalStateBuffer,
      finalThermoBuffer,
      finalMechanicsBuffer,
      mutatedFamilies = ['state', 'thermo', 'mechanics']
    } = {}) {
      if (record.sealed) {
        const sealed = record.sealedPlan;
        const samePlan = sealed.commandEncoder === commandEncoder
          && sealed.finalStateBuffer === finalStateBuffer
          && sealed.finalThermoBuffer === finalThermoBuffer
          && sealed.finalMechanicsBuffer === finalMechanicsBuffer
          && sealed.mutatedFamilies.length === mutatedFamilies.length
          && sealed.mutatedFamilies.every((family, index) => family === mutatedFamilies[index]);
        if (samePlan) return record.sealEvidence;
        const error = new Error(
          'resident sequence workspace acquisition was already sealed with another plan'
        );
        settleRecord(lane, record, {
          status: 'resident-sequence-submission-preflight-rejected',
          reason: error.message
        });
        throw error;
      }
      try {
        if (record.submitted || record.settled) {
          throw new Error(
            'resident sequence workspace acquisition was already submitted or settled'
          );
        }
        if (!record.sourceBuffers) {
          throw new Error(
            'resident sequence source continuity must be admitted before submission'
          );
        }
        if (!record.commandEncoder || record.commandEncoder !== commandEncoder) {
          const error = new Error(
            'resident sequence submission seal does not match the transition command encoder'
          );
          error.code = 'ULG_SPH_RESIDENT_SEQUENCE_COMMAND_ENCODER_MISMATCH';
          throw error;
        }
        const mutatedFamilyList = [...mutatedFamilies];
        const mutated = new Set(mutatedFamilyList);
        if (mutated.size !== mutatedFamilyList.length) {
          throw new RangeError('resident sequence mutated particle families must be unique');
        }
        for (const family of mutated) {
          if (!['state', 'thermo', 'mechanics'].includes(family)) {
            throw new RangeError(`unknown mutated resident particle family ${family}`);
          }
        }
        for (const [family, field, buffer] of [
          ['state', 'stateBuffer', finalStateBuffer],
          ['thermo', 'thermoBuffer', finalThermoBuffer],
          ['mechanics', 'mechanicsBuffer', finalMechanicsBuffer]
        ]) {
          const familyBuffers = family === 'state'
            ? entry.statePingBuffers
            : family === 'thermo'
            ? entry.thermoPingBuffers
            : entry.mechanicsPingBuffers;
          if (mutated.has(family) && !familyBuffers.includes(buffer)) {
            throw new Error(`resident sequence final ${family} buffer is outside the lane workspace`);
          }
          const transitions = record.familyTransitions[family];
          if (transitions.some((transition) => (
            transition.commandEncoder !== commandEncoder
          ))) {
            throw new Error(
              `resident sequence ${family} transition was planned on another command encoder`
            );
          }
          if (mutated.has(family)) {
            if (transitions.length === 0) {
              throw new Error(`resident sequence mutated ${family} family has no ordered transitions`);
            }
            let expectedSource = record.sourceBuffers[field];
            for (const transition of transitions) {
              if (transition.sourceBuffer !== expectedSource) {
                throw new Error(`resident sequence ${family} transition chain is discontinuous`);
              }
              if (transition.destinationBuffer === transition.sourceBuffer) {
                throw new Error(`resident sequence ${family} transition aliases its source`);
              }
              expectedSource = transition.destinationBuffer;
            }
            if (buffer !== expectedSource) {
              throw new Error(
                `resident sequence final ${family} buffer does not match its transition chain`
              );
            }
          } else {
            if (transitions.length > 0) {
              throw new Error(`unmutated resident sequence ${family} family recorded transitions`);
            }
            if (buffer !== record.sourceBuffers[field]) {
              throw new Error(`unmutated resident sequence ${family} family changed buffers`);
            }
          }
        }
        record.publicationToken = publicationTokenForRecord(lane, record);
        record.sealedPlan = Object.freeze({
          commandEncoder,
          finalStateBuffer,
          finalThermoBuffer,
          finalMechanicsBuffer,
          mutatedFamilies: Object.freeze([...mutatedFamilyList])
        });
        record.sealed = true;
        record.status = 'sealed-before-queue-submit';
        record.sealEvidence = Object.freeze({
          schema: ULG_SPH_RESIDENT_SEQUENCE_SUBMISSION_SEAL_SCHEMA,
          status: 'resident-sequence-submission-preflight-sealed',
          acquisitionId,
          workspaceGeneration: entry.generation,
          commandEncoderBound: true,
          publicationToken: record.publicationToken
        });
        return record.sealEvidence;
      } catch (error) {
        settleRecord(lane, record, {
          status: 'resident-sequence-submission-preflight-rejected',
          reason: error instanceof Error ? error.message : String(error)
        });
        retireSettledEntries(lane);
        throw error;
      }
    },
    commitSubmitted({ commandEncoder, completedWork = null } = {}) {
      if (record.commitEvidence) return record.commitEvidence;
      const failClosed = (status, reason) => {
        record.submitted = true;
        lane.poisoned = true;
        lane.poisonReason = status;
        record.commitEvidence = Object.freeze({
          status,
          accepted: false,
          reason,
          publicationToken: null,
          settlement
        });
        let completion;
        try {
          completion = completedWork ?? device.queue.onSubmittedWorkDone();
        } catch (error) {
          settleRecord(lane, record, {
            status,
            reason: `${reason}: ${error instanceof Error ? error.message : String(error)}`
          });
          return record.commitEvidence;
        }
        Promise.resolve(completion).then(
          () => ({ status, reason }),
          (error) => ({
            status,
            reason: `${reason}: ${error instanceof Error ? error.message : String(error)}`
          })
        ).then((result) => settleRecord(lane, record, result));
        return record.commitEvidence;
      };
      if (record.settled) {
        record.commitEvidence = Object.freeze({
          status: 'resident-sequence-submission-commit-rejected-settled',
          accepted: false,
          reason: record.settlementReason ?? 'acquisition-already-settled',
          publicationToken: null,
          settlement
        });
        return record.commitEvidence;
      }
      if (!record.sealed || !record.sealedPlan) {
        return failClosed(
          'resident-sequence-submission-commit-rejected-unsealed',
          'submission was not sealed before queue submit'
        );
      }
      if (record.sealedPlan.commandEncoder !== commandEncoder) {
        return failClosed(
          'resident-sequence-submission-commit-rejected-encoder-mismatch',
          'submitted command encoder does not match the sealed transition plan'
        );
      }
      record.submitted = true;
      record.status = 'queue-submitted';
      entry.totalSubmissionCount += 1;
      lane.totalSubmissionCount += 1;
      lane.publicationVersion = record.publicationToken.submissionVersion;
      lane.authoritativeBuffers = {
        stateBuffer: record.sealedPlan.finalStateBuffer,
        thermoBuffer: record.sealedPlan.finalThermoBuffer,
        mechanicsBuffer: record.sealedPlan.finalMechanicsBuffer
      };
      lane.authoritativePublicationToken = record.publicationToken;
      const retiredAtSubmit = [...lane.retiredEntries];
      record.commitEvidence = Object.freeze({
        status: 'resident-sequence-submission-committed',
        accepted: true,
        reason: null,
        publicationToken: record.publicationToken,
        settlement
      });
      let completion;
      try {
        completion = completedWork ?? device.queue.onSubmittedWorkDone();
      } catch (error) {
        lane.poisoned = true;
        lane.poisonReason = 'resident-sequence-queue-completion-observer-threw';
        settleRecord(lane, record, {
          status: 'queue-completion-observer-threw',
          reason: error instanceof Error ? error.message : String(error)
        });
        return record.commitEvidence;
      }
      Promise.resolve(completion).then(
        () => ({ status: 'queue-work-completed', reason: null }),
        (error) => ({
          status: 'queue-completion-observer-rejected',
          reason: error instanceof Error ? error.message : String(error)
        })
      ).then((result) => {
        for (const retired of retiredAtSubmit) retired.retirementFenceSettled = true;
        settleRecord(lane, record, result);
        retireSettledEntries(lane);
      });
      return record.commitEvidence;
    },
    markSubmitted(options = {}) {
      return acquisition.commitSubmitted(options);
    },
    cancelBeforeSubmit(reason = 'resident-sequence-encoding-cancelled') {
      if (record.submitted) return false;
      return settleRecord(lane, record, {
        status: 'cancelled-before-submit',
        reason: String(reason)
      });
    },
    snapshot() {
      return Object.freeze({
        ...laneSnapshot(lane),
        acquisitionId,
        leaseId: identity.leaseId,
        taskId: identity.taskId,
        acquisitionStatus: record.status,
        acquisitionSettled: record.settled,
        commandEncoderBound: Boolean(record.commandEncoder),
        submissionSealed: record.sealed,
        publicationToken: record.publicationToken,
        createdThisAcquisition: created,
        reused: !created,
        grew,
        waitedForCapacity,
        authorityRebased: record.authorityRebased === true,
        waitedForAuthorityRebase: authorityAdmission.waitedForAuthorityRebase,
        particleFamilyTransitionCounts: Object.fromEntries(
          Object.entries(record.familyTransitions).map(([family, transitions]) => [
            family,
            transitions.length
          ])
        )
      });
    },
    get publicationToken() {
      return record.publicationToken;
    },
    settlement
  };
  return Object.freeze(acquisition);
}

export function isSphResidentSequenceWorkspaceBufferGpu(buffer) {
  return Boolean(buffer && WORKSPACE_BUFFERS.has(buffer));
}

export function summarizeSphResidentSequenceWorkspaceGpuPool(device) {
  const pool = DEVICE_POOLS.get(device);
  return Object.freeze({
    schema: 'peercompute.ulg.sph-resident-sequence-workspace-pool-evidence.v0',
    status: !pool
      ? 'sph-resident-sequence-workspace-pool-empty'
      : (pool.poisoned
          ? 'sph-resident-sequence-workspace-pool-poisoned'
          : 'sph-resident-sequence-workspace-pool-ready'),
    deviceId: pool?.deviceId ?? null,
    laneCount: pool?.lanes.size ?? 0,
    poisoned: pool?.poisoned ?? false,
    poisonReason: pool?.poisonReason ?? null,
    lanes: Object.freeze(pool ? [...pool.lanes.values()].map(laneSnapshot) : [])
  });
}

export function destroySphResidentSequenceWorkspaceGpuPool(device) {
  const pool = DEVICE_POOLS.get(device);
  if (!pool) return 0;
  let destroyedCount = 0;
  for (const lane of pool.lanes.values()) {
    for (const record of [...lane.pendingAcquisitions]) {
      settleRecord(lane, record, {
        status: 'sph-resident-sequence-workspace-pool-destroyed',
        reason: 'explicit-pool-destroy'
      });
    }
    if (destroyWorkspaceEntry(lane.activeEntry)) destroyedCount += 1;
    for (const entry of lane.retiredEntries) {
      if (destroyWorkspaceEntry(entry)) destroyedCount += 1;
    }
    lane.retiredEntries.clear();
  }
  pool.lanes.clear();
  DEVICE_POOLS.delete(device);
  return destroyedCount;
}
