import {
  ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_DESCRIPTOR_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA
} from './sph/sphMlsMpmGpuStep.js';

export const ULG_RESIDENT_STATE_COMMIT_BRIDGE_SCHEMA = 'peercompute.ulg.resident-state-commit-bridge.v0';
export const ULG_RESIDENT_STATE_COMMIT_ADMISSION_SCHEMA = 'peercompute.ulg.resident-state-commit-admission.v0';

const DEFAULT_ACCEPTED_SCOPES = Object.freeze(['ulg-sph-resident-pass-dag']);

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function finiteNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function completedGpuFenceStatus(status) {
  return [
    'gpu-fence-completed',
    'queue-work-completed',
    'readback-map-completed',
    'same-device-queue-ordering-established'
  ].includes(String(status || ''));
}

function schroederParticleStorageDescriptorFromPayload(payload = null) {
  return plainObject(payload?.schroederAdoptedParticleStorageDescriptor)
    ? payload.schroederAdoptedParticleStorageDescriptor
    : null;
}

function createAdmission({
  accepted,
  status,
  reason = null,
  delta = null,
  payload = null,
  issues = []
} = {}) {
  const gpuFence = plainObject(payload?.gpuFence) ? payload.gpuFence : null;
  const schroederParticleStorageDescriptor = schroederParticleStorageDescriptorFromPayload(payload);
  return {
    schema: ULG_RESIDENT_STATE_COMMIT_ADMISSION_SCHEMA,
    accepted: accepted === true,
    status,
    reason,
    issues: [...issues],
    taskId: delta?.taskId ?? null,
    scope: delta?.scope ?? null,
    stateKey: payload?.stateKey ?? null,
    completedStepCount: payload?.completedStepCount ?? null,
    gpuFenceSatisfied: gpuFence?.fenceSatisfied === true,
    gpuFenceStatus: gpuFence?.status ?? null,
    gpuFenceLaneId: gpuFence?.laneId ?? null,
    gpuFenceStateKey: gpuFence?.stateKey ?? null,
    retainedBufferRefs: Array.isArray(payload?.retainedBufferRefs)
      ? [...payload.retainedBufferRefs]
      : [],
    outputFamilies: Array.isArray(payload?.outputFamilies)
      ? [...payload.outputFamilies]
      : [],
    schroederParticleStorageContinuationAvailable:
      payload?.schroederParticleStorageContinuationAvailable === true,
    schroederAdoptedParticleStorageDescriptorStatus:
      schroederParticleStorageDescriptor?.status ?? null,
    schroederAdoptedParticleStorageReady:
      schroederParticleStorageDescriptor?.ready === true,
    schroederAdoptedParticleStorageAuthoritativeParticleCount:
      finiteNonNegativeNumber(schroederParticleStorageDescriptor?.authoritativeParticleCount)
        ? Number(schroederParticleStorageDescriptor.authoritativeParticleCount)
        : null,
    schroederParticleStorageStateManagerAdmissionRequired:
      payload?.schroederParticleStorageStateManagerAdmissionRequired === true
      || schroederParticleStorageDescriptor?.stateManagerAdmissionRequired === true,
    schroederParticleStorageRawGpuBufferTransferDetected:
      payload?.schroederParticleStorageRawGpuBufferTransferDetected === true
      || schroederParticleStorageDescriptor?.rawGpuBufferTransferDetected === true,
    timestamp: Date.now()
  };
}

export function validateResidentStepsCommitDelta(delta, {
  acceptedScopes = DEFAULT_ACCEPTED_SCOPES,
  requireFenceSatisfied = true
} = {}) {
  const issues = [];
  const scopes = new Set(Array.isArray(acceptedScopes) ? acceptedScopes : DEFAULT_ACCEPTED_SCOPES);

  if (!plainObject(delta)) {
    return createAdmission({
      accepted: false,
      status: 'rejected',
      reason: 'delta-not-object',
      issues: ['delta-not-object']
    });
  }

  if (delta.schema !== ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA) {
    issues.push('unexpected-delta-schema');
  }
  if (!nonEmptyString(delta.taskId)) {
    issues.push('missing-task-id');
  }
  if (!nonEmptyString(delta.scope) || !scopes.has(delta.scope)) {
    issues.push('scope-not-accepted');
  }

  const payload = plainObject(delta.payload) ? delta.payload : null;
  if (!payload) {
    issues.push('missing-payload');
  } else {
    if (payload.schema !== ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA) {
      issues.push('unexpected-payload-schema');
    }
    if (!nonEmptyString(payload.stateKey)) {
      issues.push('missing-state-key');
    }
    if (!finiteNonNegativeNumber(payload.completedStepCount)) {
      issues.push('invalid-completed-step-count');
    }
    const gpuFence = plainObject(payload.gpuFence) ? payload.gpuFence : null;
    if (!gpuFence) {
      issues.push('missing-gpu-fence');
    } else {
      if (requireFenceSatisfied && gpuFence.fenceSatisfied !== true) {
        issues.push('gpu-fence-unsatisfied');
      }
      if (requireFenceSatisfied && !completedGpuFenceStatus(gpuFence.status)) {
        issues.push('gpu-fence-status-not-completed');
      }
      if (
        requireFenceSatisfied
        && gpuFence.status === 'queue-work-completed'
        && gpuFence.method !== 'queue.onSubmittedWorkDone'
      ) {
        issues.push('gpu-fence-completion-method-invalid');
      }
      if (
        requireFenceSatisfied
        && gpuFence.status === 'same-device-queue-ordering-established'
        && gpuFence.method !== 'same-device-queue-submit-order'
      ) {
        issues.push('gpu-fence-completion-method-invalid');
      }
      if (payload.stateKey && gpuFence.stateKey && payload.stateKey !== gpuFence.stateKey) {
        issues.push('state-key-fence-mismatch');
      }
    }
    const schroederParticleStorageDescriptor = schroederParticleStorageDescriptorFromPayload(payload);
    if (schroederParticleStorageDescriptor) {
      if (schroederParticleStorageDescriptor.schema !== ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_DESCRIPTOR_SCHEMA) {
        issues.push('unexpected-schroeder-particle-storage-descriptor-schema');
      }
      if (schroederParticleStorageDescriptor.ready !== true) {
        issues.push('schroeder-particle-storage-descriptor-not-ready');
      }
      if (schroederParticleStorageDescriptor.copyMode !== 'descriptor-only-no-raw-gpubuffer-transfer') {
        issues.push('schroeder-particle-storage-descriptor-copy-mode-not-portable');
      }
      if (
        payload.schroederParticleStorageRawGpuBufferTransferDetected === true
        || schroederParticleStorageDescriptor.rawGpuBufferTransferDetected === true
        || schroederParticleStorageDescriptor.rawGpuBufferTransferAllowed === true
      ) {
        issues.push('schroeder-particle-storage-raw-gpubuffer-transfer-detected');
      }
      if (!finiteNonNegativeNumber(schroederParticleStorageDescriptor.authoritativeParticleCount)) {
        issues.push('invalid-schroeder-particle-storage-authoritative-count');
      }
    }
  }

  if (issues.length > 0) {
    return createAdmission({
      accepted: false,
      status: 'rejected',
      reason: issues[0],
      delta,
      payload,
      issues
    });
  }

  return createAdmission({
    accepted: true,
    status: 'accepted',
    delta,
    payload
  });
}

export function createResidentStateManagerCommitHandler(stateManager, {
  acceptedScopes = DEFAULT_ACCEPTED_SCOPES,
  requireFenceSatisfied = true,
  onAdmission = null
} = {}) {
  if (!stateManager || typeof stateManager.commitDelta !== 'function') {
    throw new TypeError('createResidentStateManagerCommitHandler requires a StateManager-compatible commitDelta() method');
  }
  return (delta) => {
    const admission = validateResidentStepsCommitDelta(delta, {
      acceptedScopes,
      requireFenceSatisfied
    });
    if (typeof onAdmission === 'function') {
      onAdmission(admission, delta);
    }
    if (!admission.accepted) {
      const error = new Error(`ULG resident commit delta rejected: ${admission.reason || 'invalid-delta'}`);
      error.code = 'ERR_ULG_RESIDENT_DELTA_REJECTED';
      error.admission = admission;
      throw error;
    }
    stateManager.commitDelta(delta);
    return admission;
  };
}

function readWarmEntry(stateManager, { taskId, scope } = {}) {
  if (!stateManager || !nonEmptyString(taskId)) return undefined;
  if (typeof stateManager.getWarmDeltas === 'function') {
    const deltas = stateManager.getWarmDeltas(scope);
    if (deltas && Object.prototype.hasOwnProperty.call(deltas, taskId)) {
      return deltas[taskId];
    }
  }
  if (typeof stateManager.readWarm === 'function') {
    const entry = stateManager.readWarm(taskId, scope);
    if (entry !== undefined) return entry;
  }
  const dataState = typeof stateManager.getDataState === 'function'
    ? stateManager.getDataState()
    : null;
  if (typeof dataState?.readWarm === 'function') {
    return dataState.readWarm(taskId, scope);
  }
  return undefined;
}

export function validateResidentStepsCommittedWarmEntry(entry, delta, {
  acceptedScopes = DEFAULT_ACCEPTED_SCOPES,
  requireFenceSatisfied = true
} = {}) {
  const deltaAdmission = validateResidentStepsCommitDelta(delta, {
    acceptedScopes,
    requireFenceSatisfied
  });
  if (!deltaAdmission.accepted) return deltaAdmission;
  if (!plainObject(entry)) {
    return {
      ...deltaAdmission,
      accepted: false,
      status: 'rejected',
      reason: 'warm-entry-missing',
      issues: ['warm-entry-missing']
    };
  }
  const payload = plainObject(entry.payload) ? entry.payload : null;
  const deltaPayload = plainObject(delta?.payload) ? delta.payload : null;
  const issues = [];
  if (!payload) {
    issues.push('warm-entry-payload-missing');
  } else {
    if (payload.schema !== ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA) {
      issues.push('warm-entry-unexpected-payload-schema');
    }
    if (deltaPayload?.stateKey && payload.stateKey !== deltaPayload.stateKey) {
      issues.push('warm-entry-state-key-mismatch');
    }
    if (
      finiteNonNegativeNumber(deltaPayload?.completedStepCount)
      && Number(payload.completedStepCount) !== Number(deltaPayload.completedStepCount)
    ) {
      issues.push('warm-entry-completed-step-count-mismatch');
    }
    const gpuFence = plainObject(payload.gpuFence) ? payload.gpuFence : null;
    if (!gpuFence) {
      issues.push('warm-entry-gpu-fence-missing');
    } else if (requireFenceSatisfied && gpuFence.fenceSatisfied !== true) {
      issues.push('warm-entry-gpu-fence-unsatisfied');
    }
    const deltaSchroederDescriptor = schroederParticleStorageDescriptorFromPayload(deltaPayload);
    const warmSchroederDescriptor = schroederParticleStorageDescriptorFromPayload(payload);
    if (deltaSchroederDescriptor) {
      if (!warmSchroederDescriptor) {
        issues.push('warm-entry-schroeder-particle-storage-descriptor-missing');
      } else {
        if (warmSchroederDescriptor.schema !== ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_DESCRIPTOR_SCHEMA) {
          issues.push('warm-entry-schroeder-particle-storage-descriptor-schema-mismatch');
        }
        if (warmSchroederDescriptor.rawGpuBufferTransferDetected === true) {
          issues.push('warm-entry-schroeder-particle-storage-raw-gpubuffer-transfer-detected');
        }
        if (
          finiteNonNegativeNumber(deltaSchroederDescriptor.authoritativeParticleCount)
          && Number(warmSchroederDescriptor.authoritativeParticleCount)
            !== Number(deltaSchroederDescriptor.authoritativeParticleCount)
        ) {
          issues.push('warm-entry-schroeder-particle-storage-authoritative-count-mismatch');
        }
      }
    }
  }
  if (entry.version !== undefined && delta?.version !== undefined && entry.version !== delta.version) {
    issues.push('warm-entry-version-mismatch');
  }
  if (issues.length > 0) {
    return {
      ...deltaAdmission,
      accepted: false,
      status: 'rejected',
      reason: issues[0],
      issues
    };
  }
  return {
    ...deltaAdmission,
    status: 'committed',
    warmEntryVersion: entry.version ?? null,
    warmEntryTimestamp: entry.ts ?? null
  };
}

export function readResidentStepsCommittedWarmDelta(stateManager, {
  delta,
  taskId = delta?.taskId,
  scope = delta?.scope || DEFAULT_ACCEPTED_SCOPES[0],
  acceptedScopes = DEFAULT_ACCEPTED_SCOPES,
  requireFenceSatisfied = true
} = {}) {
  const entry = readWarmEntry(stateManager, { taskId, scope });
  const admission = validateResidentStepsCommittedWarmEntry(entry, delta, {
    acceptedScopes,
    requireFenceSatisfied
  });
  return {
    ...admission,
    taskId,
    scope,
    warmEntryFound: Boolean(entry),
    warmEntry: entry ?? null
  };
}

export function attachResidentStateManagerCommitBridge({
  computeManager,
  stateManager,
  acceptedScopes = DEFAULT_ACCEPTED_SCOPES,
  requireFenceSatisfied = true,
  onAdmission = null
} = {}) {
  if (!computeManager || typeof computeManager.setCommitDeltaHandler !== 'function') {
    throw new TypeError('attachResidentStateManagerCommitBridge requires a ComputeManager-compatible setCommitDeltaHandler() method');
  }
  const handler = createResidentStateManagerCommitHandler(stateManager, {
    acceptedScopes,
    requireFenceSatisfied,
    onAdmission
  });
  computeManager.setCommitDeltaHandler(handler);
  return {
    schema: ULG_RESIDENT_STATE_COMMIT_BRIDGE_SCHEMA,
    status: 'attached',
    acceptedScopes: [...acceptedScopes],
    requireFenceSatisfied: requireFenceSatisfied === true,
    handler
  };
}
