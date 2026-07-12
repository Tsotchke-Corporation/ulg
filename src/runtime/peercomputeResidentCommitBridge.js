import {
  ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_DESCRIPTOR_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
  ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA,
  MLS_MPM_RESIDENT_COMPUTE_TASK_QUEUE_FENCE_POLICY_SAME_DEVICE_ORDERED,
  MLS_MPM_RESIDENT_COMPUTE_TASK_MAX_IN_FLIGHT_SUBMISSIONS
} from './sph/sphMlsMpmGpuStep.js';
import {
  ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_TOKEN_SCHEMA,
  createStateManagerAdmittedSchroederParticleStorageResidencyAdoption,
  validateSchroederParticleStorageResidencyAdoptionToken
} from './sph/schroederParticleStorageAdoptionGpu.js';
import {
  ULG_COHERENT_SOLID_COMMIT_DELTA_SCHEMA,
  ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA,
  ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
  ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA,
  ULG_COHERENT_SOLID_STATE_DELTA_SCHEMA
} from '../../ulg-gpu-abi/src/coherentSolid.js';
import {
  COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY,
  COHERENT_SOLID_RESIDENT_COMMIT_SCOPE
} from './solid/coherentSolidResidentTask.js';

export const ULG_RESIDENT_STATE_COMMIT_BRIDGE_SCHEMA = 'peercompute.ulg.resident-state-commit-bridge.v0';
export const ULG_RESIDENT_STATE_COMMIT_ADMISSION_SCHEMA = 'peercompute.ulg.resident-state-commit-admission.v0';

const GPU_AUTHORITY_CANDIDATE_STATUS =
  'gpu-resident-continuation-candidate-awaiting-state-manager-commit';
const GPU_AUTHORITY_COMMITTED_STATUS =
  'gpu-resident-authority-admitted-by-state-manager-commit';
const GPU_RESIDENT_LANE_TASK_SCHEMA =
  'peercompute.compute.gpu-resident-lane-task.v0';
const RESIDENT_SEQUENCE_LANE_CONTRACT_SCHEMA =
  'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0';
const GPU_RESIDENT_LANE_LEASE_IDENTITY_SCHEMA =
  'peercompute.compute.gpu-resident-lane-lease-identity.v0';

const REQUIRED_RESIDENT_BUFFER_REF_BY_OUTPUT_FAMILY = Object.freeze({
  'sph-particle-state': 'sph-state-buffer',
  'sph-thermo-phase': 'sph-thermo-buffer',
  'mls-mpm-mechanics': 'mls-mpm-mechanics-buffer'
});

const CANONICAL_RESIDENT_BUFFER_REFS = new Set([
  'p2g-grid-buffer',
  'updated-grid-buffer',
  'sph-state-buffer',
  'sph-thermo-buffer',
  'mls-mpm-mechanics-buffer',
  'material-interface-source-field-rows-buffer',
  'material-interface-source-surface-buffer',
  'material-interface-source-index-field-buffer',
  'pressure-interface-force-rows-buffer',
  'sph-interface-source-key-buffer',
  'resident-product-mass-buffer',
  'resident-product-event-buffer',
  'resident-spatial-gas-species-ledger-buffer',
  'resident-gas-pressure-cells-buffer',
  'resident-gas-pressure-cell-metadata-buffer',
  'resident-gas-pressure-cell-lookup-buffer',
  'schroeder-particle-storage-residency-metadata-buffer',
  'schroeder-particle-storage-residency-dispatch-indirect-buffer',
  'compact-summary-diagnostics'
]);

const DEFAULT_ACCEPTED_SCOPES = Object.freeze([
  'ulg-sph-resident-pass-dag',
  COHERENT_SOLID_RESIDENT_COMMIT_SCOPE
]);

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

function finiteNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0;
}

function pressureSourceFieldEpochValidationIssues(payload, pressureIdentity) {
  const issues = [];
  const epochs = Array.isArray(pressureIdentity?.sourceFieldEpochs)
    ? pressureIdentity.sourceFieldEpochs
    : [];
  const completedStepCount = Number(payload?.completedStepCount);
  const requestedSourceStep = Number(payload?.pressureRequestedSourceStep);
  if (!Array.isArray(pressureIdentity?.sourceFieldEpochs)) {
    issues.push('pressure-source-field-epochs-missing');
    return issues;
  }
  if (epochs.length !== completedStepCount) {
    issues.push('pressure-source-field-epoch-count-mismatch');
  }
  if (Number(pressureIdentity.sourceFieldEpochCount) !== epochs.length) {
    issues.push('pressure-source-field-epoch-declared-count-mismatch');
  }
  let previousFieldGeneration = null;
  let previousPositionEpoch = null;
  for (const [index, epoch] of epochs.entries()) {
    const prefix = `pressure-source-field-epoch-${index}`;
    if (!plainObject(epoch)) {
      issues.push(`${prefix}-invalid`);
      continue;
    }
    const expectedStep = requestedSourceStep + index;
    const sourcePositionEpoch = Number(epoch.sourcePositionEpoch);
    const sourceNeighborhoodGeneration = Number(epoch.sourceNeighborhoodGeneration);
    if (epoch.schema
      !== 'peercompute.ulg.sph-material-interface-source-field-consumption-epoch.v0') {
      issues.push(`${prefix}-schema-invalid`);
    }
    if (epoch.status !== 'material-interface-source-field-lane-generation-submitted') {
      issues.push(`${prefix}-not-submitted`);
    }
    if (Number(epoch.substepIndex) !== index) issues.push(`${prefix}-substep-index-mismatch`);
    if (!finiteNonNegativeInteger(epoch.sourceStep)
      || Number(epoch.sourceStep) !== expectedStep) {
      issues.push(`${prefix}-step-mismatch`);
    }
    if (!finiteNonNegativeInteger(epoch.sourcePositionEpoch)) {
      issues.push(`${prefix}-position-epoch-mismatch`);
    }
    if (!finiteNonNegativeInteger(epoch.sourceNeighborhoodGeneration)) {
      issues.push(`${prefix}-neighborhood-generation-mismatch`);
    }
    if (sourceNeighborhoodGeneration !== sourcePositionEpoch) {
      issues.push(`${prefix}-generation-position-epoch-mismatch`);
    }
    if (index === 0
      && sourcePositionEpoch !== Number(pressureIdentity.sourcePositionEpoch)) {
      issues.push(`${prefix}-initial-position-epoch-mismatch`);
    }
    if (previousPositionEpoch !== null) {
      const positionAdvance = sourcePositionEpoch - previousPositionEpoch;
      if (!Number.isInteger(positionAdvance) || positionAdvance < 1 || positionAdvance > 3) {
        issues.push(`${prefix}-mutation-phase-transition-invalid`);
      }
    }
    previousPositionEpoch = sourcePositionEpoch;
    if (!finiteNonNegativeInteger(epoch.sourceFieldGeneration)
      || Number(epoch.sourceFieldGeneration) < 1) {
      issues.push(`${prefix}-field-generation-invalid`);
    } else if (
      previousFieldGeneration !== null
      && Number(epoch.sourceFieldGeneration) <= previousFieldGeneration
    ) {
      issues.push(`${prefix}-field-generation-not-monotonic`);
    }
    previousFieldGeneration = Number(epoch.sourceFieldGeneration);
    const stringBindings = [
      ['sourceNeighborhoodLaneId', pressureIdentity.laneId, 'lane'],
      ['sourceNeighborhoodStateKey', pressureIdentity.stateKey, 'state'],
      ['sourceNeighborhoodLeaseId', pressureIdentity.leaseId, 'lease'],
      ['sourceNeighborhoodTaskId', pressureIdentity.consumerLaneTaskId, 'task'],
      ['sourceDeviceId', pressureIdentity.consumerDeviceId, 'device']
    ];
    for (const [field, expected, label] of stringBindings) {
      if (!nonEmptyString(epoch[field]) || epoch[field] !== expected) {
        issues.push(`${prefix}-${label}-binding-mismatch`);
      }
    }
    const consumed = plainObject(epoch.consumedNeighborhoodIdentity)
      ? epoch.consumedNeighborhoodIdentity
      : null;
    if (!consumed) {
      issues.push(`${prefix}-consumed-neighborhood-missing`);
      continue;
    }
    if (consumed.schema
      !== 'peercompute.ulg.pressure-consumed-resident-neighborhood-identity.v0') {
      issues.push(`${prefix}-consumed-neighborhood-schema-invalid`);
    }
    if (Number(consumed.generation) !== sourceNeighborhoodGeneration
      || Number(consumed.positionEpoch) !== sourcePositionEpoch) {
      issues.push(`${prefix}-consumed-neighborhood-epoch-mismatch`);
    }
    if (consumed.laneId !== epoch.sourceNeighborhoodLaneId) {
      issues.push(`${prefix}-consumed-lane-binding-mismatch`);
    }
    if (consumed.stateKey !== epoch.sourceNeighborhoodStateKey) {
      issues.push(`${prefix}-consumed-state-binding-mismatch`);
    }
    if (consumed.leaseId !== epoch.sourceNeighborhoodLeaseId) {
      issues.push(`${prefix}-consumed-lease-binding-mismatch`);
    }
    if (consumed.taskId !== epoch.sourceNeighborhoodTaskId) {
      issues.push(`${prefix}-consumed-task-binding-mismatch`);
    }
    if (consumed.deviceId !== epoch.sourceDeviceId) {
      issues.push(`${prefix}-consumed-device-binding-mismatch`);
    }
    if (consumed.sourceFamily !== 'sph-particle-state') {
      issues.push(`${prefix}-consumed-source-family-mismatch`);
    }
    if (!finiteNonNegativeInteger(consumed.sourceCount)
      || Number(consumed.sourceCount) < 1) {
      issues.push(`${prefix}-consumed-source-count-invalid`);
    }
    if (consumed.authoritative !== true) issues.push(`${prefix}-not-authoritative`);
  }
  const first = epochs[0] ?? null;
  const last = epochs.at(-1) ?? null;
  for (const field of [
    'sourceStep',
    'sourcePositionEpoch',
    'sourceNeighborhoodGeneration',
    'sourceNeighborhoodLaneId',
    'sourceNeighborhoodStateKey',
    'sourceDeviceId'
  ]) {
    if (first && pressureIdentity[field] !== first[field]) {
      issues.push(`pressure-source-field-initial-${field}-mismatch`);
    }
  }
  const finalBindings = [
    ['finalSourceStep', 'sourceStep'],
    ['finalSourcePositionEpoch', 'sourcePositionEpoch'],
    ['finalSourceNeighborhoodGeneration', 'sourceNeighborhoodGeneration']
  ];
  for (const [field, epochField] of finalBindings) {
    if (last && pressureIdentity[field] !== last[epochField]) {
      issues.push(`pressure-source-field-${field}-mismatch`);
    }
  }
  return issues;
}

function completedGpuFenceStatus(status) {
  return [
    'gpu-fence-completed',
    'queue-work-completed',
    'readback-map-completed',
    'ordered-before-consumer-queue-completed'
  ].includes(String(status || ''));
}

function rawGpuBufferDetected(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (
    value.constructor?.name === 'GPUBuffer'
    || typeof value.mapAsync === 'function'
    || (typeof value.destroy === 'function' && Number.isFinite(Number(value.size)))
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.some((entry) => rawGpuBufferDetected(entry, seen));
  return Object.values(value).some((entry) => rawGpuBufferDetected(entry, seen));
}

function schroederParticleStorageDescriptorFromPayload(payload = null) {
  return plainObject(payload?.schroederAdoptedParticleStorageDescriptor)
    ? payload.schroederAdoptedParticleStorageDescriptor
    : null;
}

function schroederParticleStorageResidencyTokenFromPayload(payload = null) {
  return plainObject(payload?.schroederParticleStorageResidencyAdoptionToken)
    ? payload.schroederParticleStorageResidencyAdoptionToken
    : null;
}

function promoteSchroederParticleStorageResidencyToken(token = null) {
  if (!plainObject(token)
    || token.schema !== ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_TOKEN_SCHEMA) {
    return token;
  }
  return {
    ...token,
    status: 'state-manager-admitted-schroeder-particle-storage-residency-token',
    adopted: true,
    stateManagerAdmissionCommitted: true
  };
}

function demoteSchroederParticleStorageResidencyToken(token = null) {
  if (!plainObject(token)
    || token.schema !== ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ADOPTION_TOKEN_SCHEMA) {
    return token;
  }
  const demoted = {
    ...token,
    status: 'schroeder-particle-storage-residency-token-awaiting-state-manager-admission',
    adopted: false,
    stateManagerAdmissionCommitted: false
  };
  delete demoted.stateManagerAdmissionId;
  return demoted;
}

function schroederParticleStorageResidencyTokenValidationIssues(delta, payload, token) {
  if (!token) return [];
  const issues = [];
  const validation = validateSchroederParticleStorageResidencyAdoptionToken(token);
  for (const issue of validation.issues) {
    issues.push(`schroeder-particle-storage-residency-token-${issue}`);
  }
  if (token.stateManagerAdmissionCommitted === true || token.adopted === true) {
    issues.push('schroeder-particle-storage-residency-token-claimed-before-commit');
  }
  if (rawGpuBufferDetected(token)) {
    issues.push('schroeder-particle-storage-residency-token-raw-gpubuffer-detected');
  }
  if (token.taskId !== delta?.taskId) {
    issues.push('schroeder-particle-storage-residency-token-task-id-mismatch');
  }
  if (token.stateKey !== payload?.stateKey) {
    issues.push('schroeder-particle-storage-residency-token-state-key-mismatch');
  }
  if (token.laneId !== payload?.gpuFence?.laneId) {
    issues.push('schroeder-particle-storage-residency-token-lane-id-mismatch');
  }
  const laneRequirement = plainObject(payload?.gpuResidentLaneRequirement)
    ? payload.gpuResidentLaneRequirement
    : null;
  const sequenceContract = plainObject(payload?.residentSequenceLaneContract)
    ? payload.residentSequenceLaneContract
    : null;
  if (nonEmptyString(laneRequirement?.leaseIdentity?.leaseId)
    && token.leaseId !== laneRequirement.leaseIdentity.leaseId) {
    issues.push('schroeder-particle-storage-residency-token-lease-id-mismatch');
  }
  if (nonEmptyString(laneRequirement?.sourceFamily)
    && token.sourceFamily !== laneRequirement.sourceFamily) {
    issues.push('schroeder-particle-storage-residency-token-source-family-mismatch');
  }
  const requiredRefs = Array.isArray(token.retainedBufferRefs)
    ? token.retainedBufferRefs
    : [];
  for (const [field, refs] of [
    ['payload', payload?.retainedBufferRefs],
    ['gpu-fence', payload?.gpuFence?.retainedBufferRefs],
    ['resident-lane', laneRequirement?.retainedBufferRefs],
    ['sequence-lane', sequenceContract?.laneMustRetainBuffers]
  ]) {
    if (!Array.isArray(refs)
      || requiredRefs.some((ref) => !refs.includes(ref))) {
      issues.push(`schroeder-particle-storage-residency-token-${field}-retained-ref-missing`);
    }
  }
  if (payload?.schroederParticleStorageContinuationAvailable !== true) {
    issues.push('schroeder-particle-storage-residency-token-continuation-not-available');
  }
  if (payload?.schroederParticleStorageStateManagerAdmissionRequired !== true) {
    issues.push('schroeder-particle-storage-residency-token-admission-not-required');
  }
  if (payload?.gpuResidentAuthoritativeContinuationCandidate !== true) {
    issues.push('schroeder-particle-storage-residency-token-authority-candidate-not-declared');
  }
  if (payload?.schroederParticleStorageRawGpuBufferTransferDetected === true) {
    issues.push('schroeder-particle-storage-residency-token-raw-gpubuffer-transfer-declared');
  }
  return [...new Set(issues)];
}

function residentAuthorityBufferRefEvidence(payload = null) {
  const outputFamilies = new Set(Array.isArray(payload?.outputFamilies) ? payload.outputFamilies : []);
  const retainedBufferRefs = Array.isArray(payload?.retainedBufferRefs)
    ? payload.retainedBufferRefs
    : [];
  const fenceRetainedBufferRefs = Array.isArray(payload?.gpuFence?.retainedBufferRefs)
    ? payload.gpuFence.retainedBufferRefs
    : [];
  const retainedSet = new Set(retainedBufferRefs);
  const fenceRetainedSet = new Set(fenceRetainedBufferRefs);
  const blockers = [];
  if (
    retainedBufferRefs.some((ref) => !nonEmptyString(ref))
    || fenceRetainedBufferRefs.some((ref) => !nonEmptyString(ref))
  ) {
    blockers.push('retained-buffer-ref-invalid');
  }
  if (
    retainedBufferRefs.some((ref) => !CANONICAL_RESIDENT_BUFFER_REFS.has(ref))
    || fenceRetainedBufferRefs.some((ref) => !CANONICAL_RESIDENT_BUFFER_REFS.has(ref))
  ) {
    blockers.push('retained-buffer-ref-noncanonical');
  }
  if (
    retainedSet.size !== retainedBufferRefs.length
    || fenceRetainedSet.size !== fenceRetainedBufferRefs.length
  ) {
    blockers.push('retained-buffer-ref-duplicate');
  }
  for (const [family, ref] of Object.entries(REQUIRED_RESIDENT_BUFFER_REF_BY_OUTPUT_FAMILY)) {
    if (!outputFamilies.has(family)) continue;
    if (!retainedSet.has(ref)) blockers.push(`required-${ref}-missing`);
    if (!fenceRetainedSet.has(ref)) blockers.push(`gpu-fence-required-${ref}-missing`);
  }
  if (
    retainedSet.size !== fenceRetainedSet.size
    || [...retainedSet].some((ref) => !fenceRetainedSet.has(ref))
  ) {
    blockers.push('gpu-fence-retained-buffer-refs-mismatch');
  }
  return { blockers };
}

function residentAuthorityLaneBindingEvidence(payload = null) {
  const gpuFence = plainObject(payload?.gpuFence) ? payload.gpuFence : null;
  const laneRequirement = plainObject(payload?.gpuResidentLaneRequirement)
    ? payload.gpuResidentLaneRequirement
    : null;
  const sequenceContract = plainObject(payload?.residentSequenceLaneContract)
    ? payload.residentSequenceLaneContract
    : null;
  const laneRetainedBufferRefs = Array.isArray(laneRequirement?.retainedBufferRefs)
    ? laneRequirement.retainedBufferRefs
    : [];
  const sequenceRetainedBufferRefs = Array.isArray(sequenceContract?.laneMustRetainBuffers)
    ? sequenceContract.laneMustRetainBuffers
    : [];
  const blockers = [
    !laneRequirement ? 'gpu-resident-lane-requirement-missing' : null,
    laneRequirement?.schema !== GPU_RESIDENT_LANE_TASK_SCHEMA
      ? 'gpu-resident-lane-requirement-schema-invalid'
      : null,
    laneRequirement?.enabled !== true ? 'gpu-resident-lane-requirement-not-enabled' : null,
    !nonEmptyString(laneRequirement?.laneId)
      ? 'gpu-resident-lane-requirement-lane-id-missing'
      : null,
    !nonEmptyString(laneRequirement?.stateKey)
      ? 'gpu-resident-lane-requirement-state-key-missing'
      : null,
    !sequenceContract ? 'resident-sequence-lane-contract-missing' : null,
    sequenceContract?.schema !== RESIDENT_SEQUENCE_LANE_CONTRACT_SCHEMA
      ? 'resident-sequence-lane-contract-schema-invalid'
      : null,
    sequenceContract?.authority !== 'compute-manager-gpuhub-resident-lane-contract'
      ? 'resident-sequence-lane-contract-authority-invalid'
      : null,
    !nonEmptyString(sequenceContract?.laneId)
      ? 'resident-sequence-lane-contract-lane-id-missing'
      : null,
    !nonEmptyString(sequenceContract?.stateKey)
      ? 'resident-sequence-lane-contract-state-key-missing'
      : null,
    !nonEmptyString(gpuFence?.laneId) ? 'gpu-fence-lane-id-missing' : null,
    !nonEmptyString(gpuFence?.stateKey) ? 'gpu-fence-state-key-missing' : null,
    gpuFence?.required !== true ? 'gpu-fence-not-required' : null,
    nonEmptyString(payload?.stateKey)
      && nonEmptyString(gpuFence?.stateKey)
      && payload.stateKey !== gpuFence.stateKey
      ? 'gpu-fence-state-key-mismatch'
      : null
  ];
  const nestedSequenceContract = plainObject(laneRequirement?.residentSequenceLaneContract)
    ? laneRequirement.residentSequenceLaneContract
    : null;
  if (!nestedSequenceContract) {
    blockers.push('gpu-resident-lane-nested-sequence-contract-missing');
  } else if (
    nestedSequenceContract.schema !== RESIDENT_SEQUENCE_LANE_CONTRACT_SCHEMA
    || nestedSequenceContract.laneId !== sequenceContract?.laneId
    || nestedSequenceContract.stateKey !== sequenceContract?.stateKey
    || !exactStringArrayMatch(
      nestedSequenceContract.laneMustRetainBuffers,
      sequenceRetainedBufferRefs
    )
  ) {
    blockers.push('gpu-resident-lane-nested-sequence-contract-mismatch');
  }
  for (const evidence of [laneRequirement, sequenceContract].filter(Boolean)) {
    if (
      nonEmptyString(evidence.laneId)
      && nonEmptyString(gpuFence?.laneId)
      && evidence.laneId !== gpuFence.laneId
    ) {
      blockers.push('gpu-fence-lane-id-mismatch');
    }
    if (
      nonEmptyString(evidence.stateKey)
      && nonEmptyString(gpuFence?.stateKey)
      && evidence.stateKey !== gpuFence.stateKey
    ) {
      blockers.push('gpu-fence-state-key-mismatch');
    }
  }
  if (!exactStringArrayMatch(laneRetainedBufferRefs, sequenceRetainedBufferRefs)) {
    blockers.push('resident-lane-plan-retained-buffer-refs-mismatch');
  }
  if (
    laneRetainedBufferRefs.some((ref) => !CANONICAL_RESIDENT_BUFFER_REFS.has(ref))
    || sequenceRetainedBufferRefs.some((ref) => !CANONICAL_RESIDENT_BUFFER_REFS.has(ref))
  ) {
    blockers.push('resident-lane-plan-retained-buffer-ref-noncanonical');
  }
  if (
    new Set(laneRetainedBufferRefs).size !== laneRetainedBufferRefs.length
    || new Set(sequenceRetainedBufferRefs).size !== sequenceRetainedBufferRefs.length
  ) {
    blockers.push('resident-lane-plan-retained-buffer-ref-duplicate');
  }
  const outputFamilies = new Set(Array.isArray(payload?.outputFamilies) ? payload.outputFamilies : []);
  for (const [family, ref] of Object.entries(REQUIRED_RESIDENT_BUFFER_REF_BY_OUTPUT_FAMILY)) {
    if (!outputFamilies.has(family)) continue;
    if (!laneRetainedBufferRefs.includes(ref)) {
      blockers.push(`resident-lane-plan-required-${ref}-missing`);
    }
  }
  const queueFencePolicies = [
    gpuFence?.queueFencePolicy,
    laneRequirement?.queueFencePolicy,
    sequenceContract?.queueFencePolicy
  ].filter(nonEmptyString);
  if (new Set(queueFencePolicies).size > 1) {
    blockers.push('gpu-resident-lane-queue-fence-policy-mismatch');
  }
  const deviceIds = [
    gpuFence?.deviceId,
    laneRequirement?.deviceId,
    laneRequirement?.leaseIdentity?.deviceId,
    sequenceContract?.deviceId,
    payload?.pressureSourceFieldConsumptionIdentity?.sourceDeviceId,
    payload?.pressureSourceFieldConsumptionIdentity?.consumerDeviceId,
    ...(Array.isArray(payload?.pressureSourceFieldConsumptionIdentity?.sourceFieldEpochs)
      ? payload.pressureSourceFieldConsumptionIdentity.sourceFieldEpochs.flatMap((epoch) => [
          epoch?.sourceDeviceId,
          epoch?.consumedNeighborhoodIdentity?.deviceId
        ])
      : [])
  ].filter(nonEmptyString);
  if (new Set(deviceIds).size > 1) blockers.push('gpu-device-identity-mismatch');
  return { blockers: blockers.filter(Boolean) };
}

function residentAuthorityStepEvidence(payload = null) {
  const completedStepCount = Number(payload?.completedStepCount);
  const stepSummaries = Array.isArray(payload?.stepSummaries) ? payload.stepSummaries : [];
  const finalStep = plainObject(payload?.finalStep) ? payload.finalStep : null;
  const blockers = [];
  if (!Number.isInteger(completedStepCount) || completedStepCount < 1) {
    blockers.push('completed-step-count-not-positive');
  }
  if (stepSummaries.length !== completedStepCount) {
    blockers.push('completed-step-summary-count-mismatch');
  }
  for (const [index, summary] of stepSummaries.entries()) {
    if (!plainObject(summary)) {
      blockers.push('completed-step-summary-invalid');
      continue;
    }
    if (Number(summary.stepIndex) !== index) {
      blockers.push('completed-step-summary-index-mismatch');
    }
    if (summary.backend !== 'webgpu') blockers.push('completed-step-backend-not-webgpu');
    if (summary.readbackMode !== 'no-full-readback') {
      blockers.push('completed-step-readback-mode-not-resident');
    }
    if (summary.normalHotLoopReadbackFree !== true) {
      blockers.push('completed-step-hot-loop-readback-not-free');
    }
    if (summary.gpuResidentAuthoritativeContinuationCandidate !== true) {
      blockers.push('completed-step-candidate-not-declared');
    }
    if (summary.gpuAuthorityAdmissionRequired !== true) {
      blockers.push('completed-step-admission-not-required');
    }
    if (summary.gpuAuthorityAdmissionSatisfied === true) {
      blockers.push('completed-step-admission-claimed-before-commit');
    }
    if (summary.gpuAuthoritativeState === true) {
      blockers.push('completed-step-global-authority-claimed-before-commit');
    }
    if (summary.gpuAuthorityStatus !== GPU_AUTHORITY_CANDIDATE_STATUS) {
      blockers.push('completed-step-candidate-status-invalid');
    }
    if ((summary.gpuAuthorityCandidateBlockers || []).length > 0) {
      blockers.push('completed-step-candidate-blockers-present');
    }
  }
  const lastSummary = stepSummaries.at(-1);
  if (
    finalStep
    && plainObject(lastSummary)
    && (
      Number(finalStep.stepIndex) !== Number(lastSummary.stepIndex)
      || finalStep.backend !== lastSummary.backend
      || finalStep.readbackMode !== lastSummary.readbackMode
      || finalStep.normalHotLoopReadbackFree !== lastSummary.normalHotLoopReadbackFree
      || finalStep.gpuResidentAuthoritativeContinuationCandidate
        !== lastSummary.gpuResidentAuthoritativeContinuationCandidate
    )
  ) {
    blockers.push('final-step-summary-mismatch');
  }
  return { blockers: [...new Set(blockers)] };
}

function exactStringArrayMatch(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function demoteCommittedGpuAuthorityRecord(record = null) {
  if (!plainObject(record) || record.gpuResidentAuthoritativeContinuationCandidate !== true) {
    return record;
  }
  return {
    ...record,
    gpuAuthorityAdmissionRequired: true,
    gpuAuthorityAdmissionSatisfied: false,
    gpuAuthorityStatus: GPU_AUTHORITY_CANDIDATE_STATUS,
    gpuAuthoritativeState: false,
    schroederParticleStorageResidencyAdoptionToken:
      demoteSchroederParticleStorageResidencyToken(
        record.schroederParticleStorageResidencyAdoptionToken
      )
  };
}

function demoteCommittedGpuAuthorityPayload(payload = null) {
  if (!plainObject(payload)) return payload;
  return {
    ...payload,
    gpuAuthorityAdmissionRequired: true,
    gpuAuthorityAdmissionSatisfied: false,
    gpuAuthorityStatus: GPU_AUTHORITY_CANDIDATE_STATUS,
    gpuAuthoritativeState: false,
    schroederParticleStorageResidencyAdoptionToken:
      demoteSchroederParticleStorageResidencyToken(
        payload.schroederParticleStorageResidencyAdoptionToken
      ),
    finalStep: demoteCommittedGpuAuthorityRecord(payload.finalStep),
    stepSummaries: Array.isArray(payload.stepSummaries)
      ? payload.stepSummaries.map((summary) => demoteCommittedGpuAuthorityRecord(summary))
      : []
  };
}

function residentGpuAuthorityCandidateEvidence(payload = null) {
  const finalStep = plainObject(payload?.finalStep) ? payload.finalStep : null;
  const outputFamilies = new Set(Array.isArray(payload?.outputFamilies) ? payload.outputFamilies : []);
  const bufferEvidence = residentAuthorityBufferRefEvidence(payload);
  const laneEvidence = residentAuthorityLaneBindingEvidence(payload);
  const stepEvidence = residentAuthorityStepEvidence(payload);
  const blockers = [
    payload?.gpuResidentAuthoritativeContinuationCandidate !== true
      ? 'candidate-not-declared'
      : null,
    payload?.backend !== 'webgpu' ? 'backend-not-webgpu' : null,
    payload?.readbackMode !== 'no-full-readback' ? 'readback-mode-not-resident' : null,
    payload?.normalHotLoopReadbackFree !== true ? 'hot-loop-readback-not-free' : null,
    payload?.continuationAvailable !== true ? 'continuation-not-available' : null,
    payload?.gpuAuthorityAdmissionRequired !== true ? 'state-manager-admission-not-required' : null,
    payload?.gpuAuthorityAdmissionSatisfied === true ? 'admission-claimed-before-commit' : null,
    payload?.gpuAuthoritativeState === true ? 'global-authority-claimed-before-commit' : null,
    finalStep?.gpuResidentAuthoritativeContinuationCandidate !== true
      ? 'final-step-candidate-not-declared'
      : null,
    finalStep?.backend !== 'webgpu' ? 'final-step-backend-not-webgpu' : null,
    finalStep?.readbackMode !== 'no-full-readback' ? 'final-step-readback-mode-not-resident' : null,
    finalStep?.normalHotLoopReadbackFree !== true ? 'final-step-hot-loop-readback-not-free' : null,
    finalStep?.gpuAuthorityAdmissionRequired !== true
      ? 'final-step-admission-not-required'
      : null,
    finalStep?.gpuAuthorityAdmissionSatisfied === true
      ? 'final-step-admission-claimed-before-commit'
      : null,
    finalStep?.gpuAuthoritativeState === true
      ? 'final-step-global-authority-claimed-before-commit'
      : null,
    finalStep?.gpuAuthorityStatus !== GPU_AUTHORITY_CANDIDATE_STATUS
      ? 'final-step-candidate-status-invalid'
      : null,
    (finalStep?.gpuAuthorityCandidateBlockers || []).length > 0
      ? 'final-step-candidate-blockers-present'
      : null,
    !outputFamilies.has('sph-particle-state') ? 'particle-state-output-family-missing' : null,
    !outputFamilies.has('sph-thermo-phase') ? 'thermo-output-family-missing' : null,
    !outputFamilies.has('mls-mpm-mechanics') ? 'mechanics-output-family-missing' : null,
    !Array.isArray(payload?.retainedBufferRefs) || payload.retainedBufferRefs.length < 3
      ? 'retained-continuation-buffer-refs-incomplete'
      : null,
    ...bufferEvidence.blockers,
    ...laneEvidence.blockers,
    ...stepEvidence.blockers
  ].filter(Boolean);
  return {
    eligible: blockers.length === 0,
    blockers
  };
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
  const schroederParticleStorageResidencyToken =
    schroederParticleStorageResidencyTokenFromPayload(payload);
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
    gpuResidentAuthoritativeContinuationCandidate:
      payload?.gpuResidentAuthoritativeContinuationCandidate === true,
    gpuAuthorityAdmissionRequired: payload?.gpuAuthorityAdmissionRequired === true,
    gpuAuthorityAdmissionSatisfied: payload?.gpuAuthorityAdmissionSatisfied === true,
    gpuAuthorityStatus: payload?.gpuAuthorityStatus ?? null,
    gpuAuthoritativeState: payload?.gpuAuthoritativeState === true,
    pressureSourceFieldRequested: payload?.pressureSourceFieldRequested === true,
    pressureRequestedSourceStep: payload?.pressureRequestedSourceStep ?? null,
    pressureEpochCount: payload?.pressureEpochCount ?? null,
    pressureAppliedSubstepCount: payload?.pressureAppliedSubstepCount ?? null,
    pressureStateManagerAdmissionApproved:
      payload?.pressureStateManagerAdmissionApproved === true,
    pressureStateManagerAdmissionStatus:
      payload?.pressureStateManagerAdmissionStatus ?? null,
    pressureStateManagerAdmissionBlockers: Array.isArray(
      payload?.pressureStateManagerAdmissionBlockers
    ) ? [...payload.pressureStateManagerAdmissionBlockers] : [],
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
    schroederParticleStorageResidencyTokenStatus:
      schroederParticleStorageResidencyToken?.status ?? null,
    schroederParticleStorageResidencyTokenReady:
      schroederParticleStorageResidencyToken?.ready === true,
    schroederParticleStorageResidencyTokenCommitted:
      schroederParticleStorageResidencyToken?.stateManagerAdmissionCommitted === true,
    schroederParticleStorageResidencyGenerationId:
      finiteNonNegativeInteger(schroederParticleStorageResidencyToken?.generationId)
        ? Number(schroederParticleStorageResidencyToken.generationId)
        : null,
    schroederParticleStorageResidencyOutputParticleCapacity:
      finiteNonNegativeInteger(schroederParticleStorageResidencyToken?.outputParticleCapacity)
        ? Number(schroederParticleStorageResidencyToken.outputParticleCapacity)
        : null,
    schroederParticleStorageResidencyAuthoritativeParticleCount:
      schroederParticleStorageResidencyToken?.authoritativeParticleCount ?? null,
    schroederParticleStorageResidencyAuthoritativeParticleCountMetadataWord:
      finiteNonNegativeInteger(
        schroederParticleStorageResidencyToken?.authoritativeParticleCountMetadataWord
      )
        ? Number(schroederParticleStorageResidencyToken.authoritativeParticleCountMetadataWord)
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
  if (delta?.schema === ULG_COHERENT_SOLID_COMMIT_DELTA_SCHEMA) {
    return validateCoherentSolidCommitDelta(delta, { acceptedScopes, requireFenceSatisfied });
  }
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
        && gpuFence.status === 'ordered-before-consumer-queue-completed'
      ) {
        const pacing = plainObject(gpuFence.pacing) ? gpuFence.pacing : null;
        if (gpuFence.method !== 'same-device-queue-order') {
          issues.push('gpu-fence-same-device-order-method-invalid');
        }
        if (
          gpuFence.queueFencePolicy
          !== MLS_MPM_RESIDENT_COMPUTE_TASK_QUEUE_FENCE_POLICY_SAME_DEVICE_ORDERED
        ) {
          issues.push('gpu-fence-same-device-order-policy-invalid');
        }
        if (gpuFence.completed !== false || gpuFence.queueCompletionObserved !== false) {
          issues.push('gpu-fence-same-device-order-mislabeled-completed');
        }
        if (gpuFence.orderingSatisfied !== true) {
          issues.push('gpu-fence-same-device-order-unsatisfied');
        }
        if (!nonEmptyString(gpuFence.deviceId)) {
          issues.push('gpu-fence-same-device-order-device-id-missing');
        }
        if (!nonEmptyString(gpuFence.leaseId)) {
          issues.push('gpu-fence-same-device-order-lease-id-missing');
        }
        if (!nonEmptyString(gpuFence.taskId) || gpuFence.taskId !== delta.taskId) {
          issues.push('gpu-fence-same-device-order-task-id-mismatch');
        }
        if (!nonEmptyString(gpuFence.sourceFamily)) {
          issues.push('gpu-fence-same-device-order-source-family-missing');
        }
        if (
          gpuFence.leaseIdentitySchema !== GPU_RESIDENT_LANE_LEASE_IDENTITY_SCHEMA
          || gpuFence.leaseAuthoritative !== true
        ) {
          issues.push('gpu-fence-same-device-order-lease-authority-invalid');
        }
        if (gpuFence.localExecution !== 'inline') {
          issues.push('gpu-fence-same-device-order-not-inline');
        }
        if (!pacing) {
          issues.push('gpu-fence-same-device-order-pacing-missing');
        } else {
          if (
            Number(pacing.configuredCapacity)
              !== MLS_MPM_RESIDENT_COMPUTE_TASK_MAX_IN_FLIGHT_SUBMISSIONS
            || Number(pacing.capacity)
              !== MLS_MPM_RESIDENT_COMPUTE_TASK_MAX_IN_FLIGHT_SUBMISSIONS
          ) {
            issues.push('gpu-fence-same-device-order-pacing-capacity-invalid');
          }
          if (
            Number(pacing.pendingAfterSubmission) < 1
            || Number(pacing.pendingAfterSubmission)
              > MLS_MPM_RESIDENT_COMPUTE_TASK_MAX_IN_FLIGHT_SUBMISSIONS
            || Number(pacing.peakPendingSubmissionCount)
              > MLS_MPM_RESIDENT_COMPUTE_TASK_MAX_IN_FLIGHT_SUBMISSIONS
          ) {
            issues.push('gpu-fence-same-device-order-pacing-window-invalid');
          }
          if (Array.isArray(pacing.capacityBlockers) && pacing.capacityBlockers.length > 0) {
            issues.push('gpu-fence-same-device-order-pacing-capacity-blocked');
          }
          if (pacing.residentNeighborhoodOrderedReuseWindow !== true) {
            issues.push('gpu-fence-same-device-order-neighborhood-window-missing');
          }
          if (
            Number(pacing.residentNeighborhoodMaxInFlightSubmissions)
              < MLS_MPM_RESIDENT_COMPUTE_TASK_MAX_IN_FLIGHT_SUBMISSIONS
          ) {
            issues.push('gpu-fence-same-device-order-neighborhood-window-too-small');
          }
        }
      }
      if (payload.stateKey && gpuFence.stateKey && payload.stateKey !== gpuFence.stateKey) {
        issues.push('state-key-fence-mismatch');
      }
    }
    const schroederParticleStorageDescriptor = schroederParticleStorageDescriptorFromPayload(payload);
    const schroederParticleStorageResidencyToken =
      schroederParticleStorageResidencyTokenFromPayload(payload);
    if (schroederParticleStorageDescriptor && schroederParticleStorageResidencyToken) {
      issues.push('multiple-schroeder-particle-storage-authority-contracts');
    }
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
    issues.push(...schroederParticleStorageResidencyTokenValidationIssues(
      delta,
      payload,
      schroederParticleStorageResidencyToken
    ));
    if (payload.pressureSourceFieldRequested === true) {
      const pressureIdentity = plainObject(payload.pressureSourceFieldConsumptionIdentity)
        ? payload.pressureSourceFieldConsumptionIdentity
        : null;
      if (payload.pressureStateManagerAdmissionApproved !== true) {
        issues.push('pressure-state-manager-admission-not-approved');
      }
      if (!finiteNonNegativeInteger(payload.pressureRequestedSourceStep)) {
        issues.push('invalid-pressure-requested-source-step');
      }
      if (!finiteNonNegativeInteger(payload.pressureEpochCount)
        || Number(payload.pressureEpochCount) !== Number(payload.completedStepCount)) {
        issues.push('pressure-epoch-count-mismatch');
      }
      if (!finiteNonNegativeInteger(payload.pressureAppliedSubstepCount)
        || Number(payload.pressureAppliedSubstepCount) !== Number(payload.completedStepCount)) {
        issues.push('pressure-applied-substep-count-mismatch');
      }
      if (!finiteNonNegativeInteger(payload.pressurePhysicsStepCount)
        || Number(payload.pressurePhysicsStepCount) !== Number(payload.completedStepCount)) {
        issues.push('pressure-physics-step-count-mismatch');
      }
      if (!pressureIdentity) {
        issues.push('missing-pressure-source-field-consumption-identity');
      } else {
        const pressureQueueCompletionObserved = Boolean(
          pressureIdentity.queueCompletionStatus === 'queue-work-completed'
          && pressureIdentity.queueCompletionMethod === 'queue.onSubmittedWorkDone'
        );
        const pressureSameDeviceOrderingAdmitted = Boolean(
          pressureIdentity.queueCompletionStatus
            === 'ordered-before-consumer-queue-completed'
          && pressureIdentity.queueCompletionMethod === 'same-device-queue-order'
          && pressureIdentity.queueFencePolicy
            === MLS_MPM_RESIDENT_COMPUTE_TASK_QUEUE_FENCE_POLICY_SAME_DEVICE_ORDERED
          && pressureIdentity.queueCompletionObserved === false
          && pressureIdentity.sameDeviceQueueOrderingAdmitted === true
          && gpuFence?.status === 'ordered-before-consumer-queue-completed'
          && gpuFence?.method === 'same-device-queue-order'
          && gpuFence?.queueFencePolicy
            === MLS_MPM_RESIDENT_COMPUTE_TASK_QUEUE_FENCE_POLICY_SAME_DEVICE_ORDERED
          && gpuFence?.deviceId === pressureIdentity.sourceDeviceId
          && gpuFence?.deviceId === pressureIdentity.consumerDeviceId
          && gpuFence?.laneId === pressureIdentity.laneId
          && gpuFence?.stateKey === pressureIdentity.stateKey
          && gpuFence?.leaseId === pressureIdentity.leaseId
          && gpuFence?.taskId === pressureIdentity.consumerLaneTaskId
        );
        const pressureQueueAdmissionSatisfied = pressureQueueCompletionObserved
          || pressureSameDeviceOrderingAdmitted;
        if (pressureIdentity.status
          !== 'material-interface-source-field-consumed-by-submitted-gpu-sequence') {
          issues.push('pressure-source-field-consumption-not-submitted');
        }
        if (!nonEmptyString(pressureIdentity.laneId)) {
          issues.push('missing-pressure-neighborhood-lane-id');
        }
        if (!nonEmptyString(pressureIdentity.stateKey)) {
          issues.push('missing-pressure-neighborhood-state-key');
        }
        if (!nonEmptyString(pressureIdentity.leaseId)) {
          issues.push('missing-pressure-neighborhood-lease-id');
        }
        if (!nonEmptyString(pressureIdentity.consumerLeaseId)) {
          issues.push('missing-pressure-source-consumer-lease-id');
        }
        if (!nonEmptyString(pressureIdentity.consumerLeaseStatus)) {
          issues.push('missing-pressure-source-consumer-lease-status');
        }
        if (!nonEmptyString(pressureIdentity.consumerLaneTaskId)) {
          issues.push('missing-pressure-consumer-lane-task-id');
        }
        if (pressureIdentity.consumerLaneAuthoritative !== true) {
          issues.push('pressure-consumer-lane-not-authoritative');
        }
        if (!finiteNonNegativeInteger(pressureIdentity.sourceStep)
          || Number(pressureIdentity.sourceStep)
            !== Number(payload.pressureRequestedSourceStep)) {
          issues.push('pressure-source-step-identity-mismatch');
        }
        if (!finiteNonNegativeInteger(pressureIdentity.pressureEpochCount)
          || Number(pressureIdentity.pressureEpochCount)
            !== Number(payload.pressureEpochCount)) {
          issues.push('pressure-epoch-count-identity-mismatch');
        }
        if (!finiteNonNegativeInteger(pressureIdentity.pressureAppliedSubstepCount)
          || Number(pressureIdentity.pressureAppliedSubstepCount)
            !== Number(payload.pressureAppliedSubstepCount)) {
          issues.push('pressure-applied-count-identity-mismatch');
        }
        if (!finiteNonNegativeInteger(pressureIdentity.physicsStepCount)
          || Number(pressureIdentity.physicsStepCount)
            !== Number(payload.completedStepCount)) {
          issues.push('pressure-physics-step-count-identity-mismatch');
        }
        if (!finiteNonNegativeInteger(pressureIdentity.neighborhoodGenerationBase)) {
          issues.push('invalid-pressure-neighborhood-generation-base');
        }
        if (!finiteNonNegativeInteger(pressureIdentity.neighborhoodPositionEpochBase)) {
          issues.push('invalid-pressure-neighborhood-position-epoch-base');
        }
        if (!finiteNonNegativeInteger(pressureIdentity.sourcePositionEpoch)) {
          issues.push('invalid-pressure-source-position-epoch');
        }
        if (!finiteNonNegativeInteger(pressureIdentity.sourceNeighborhoodGeneration)) {
          issues.push('invalid-pressure-source-neighborhood-generation');
        }
        if (pressureIdentity.sourceNeighborhoodLaneId !== null
          && !nonEmptyString(pressureIdentity.sourceNeighborhoodLaneId)) {
          issues.push('invalid-pressure-source-neighborhood-lane-id');
        }
        if (
          Number(payload.pressureRequestedSourceStep) > 0
          && !nonEmptyString(pressureIdentity.sourceNeighborhoodLaneId)
        ) {
          issues.push('missing-pressure-source-neighborhood-lane-id');
        }
        if (pressureIdentity.sourceNeighborhoodStateKey !== null
          && !nonEmptyString(pressureIdentity.sourceNeighborhoodStateKey)) {
          issues.push('invalid-pressure-source-neighborhood-state-key');
        }
        if (
          Number(payload.pressureRequestedSourceStep) > 0
          && !nonEmptyString(pressureIdentity.sourceNeighborhoodStateKey)
        ) {
          issues.push('missing-pressure-source-neighborhood-state-key');
        }
        if (!nonEmptyString(pressureIdentity.sourceDeviceId)) {
          issues.push('missing-pressure-source-device-id');
        }
        if (!nonEmptyString(pressureIdentity.consumerDeviceId)) {
          issues.push('missing-pressure-consumer-device-id');
        }
        if (!pressureQueueAdmissionSatisfied) {
          issues.push('pressure-source-consumption-queue-not-completed');
        }
        if (!pressureQueueAdmissionSatisfied) {
          issues.push('pressure-source-consumption-queue-method-invalid');
        }
        if (
          finiteNonNegativeInteger(pressureIdentity.sourceNeighborhoodGeneration)
          && finiteNonNegativeInteger(pressureIdentity.neighborhoodGenerationBase)
          && Number(pressureIdentity.sourceNeighborhoodGeneration)
            !== Number(pressureIdentity.neighborhoodGenerationBase)
        ) {
          issues.push('pressure-source-neighborhood-generation-identity-mismatch');
        }
        if (
          finiteNonNegativeInteger(pressureIdentity.sourcePositionEpoch)
          && finiteNonNegativeInteger(pressureIdentity.neighborhoodPositionEpochBase)
          && Number(pressureIdentity.sourcePositionEpoch)
            !== Number(pressureIdentity.neighborhoodPositionEpochBase)
        ) {
          issues.push('pressure-source-position-epoch-consumption-mismatch');
        }
        if (
          nonEmptyString(pressureIdentity.sourceNeighborhoodLaneId)
          && pressureIdentity.sourceNeighborhoodLaneId !== pressureIdentity.laneId
        ) {
          issues.push('pressure-source-neighborhood-lane-identity-mismatch');
        }
        if (
          nonEmptyString(pressureIdentity.sourceNeighborhoodStateKey)
          && pressureIdentity.sourceNeighborhoodStateKey !== pressureIdentity.stateKey
        ) {
          issues.push('pressure-source-neighborhood-state-key-identity-mismatch');
        }
        if (
          nonEmptyString(pressureIdentity.sourceDeviceId)
          && nonEmptyString(pressureIdentity.consumerDeviceId)
          && pressureIdentity.sourceDeviceId !== pressureIdentity.consumerDeviceId
        ) {
          issues.push('pressure-source-device-identity-mismatch');
        }
        const consumedNeighborhoodIdentity = plainObject(
          pressureIdentity.consumedNeighborhoodIdentity
        )
          ? pressureIdentity.consumedNeighborhoodIdentity
          : null;
        if (!consumedNeighborhoodIdentity) {
          issues.push('missing-pressure-consumed-neighborhood-identity');
        } else {
          if (consumedNeighborhoodIdentity.schema
            !== 'peercompute.ulg.pressure-consumed-resident-neighborhood-identity.v0') {
            issues.push('unexpected-pressure-consumed-neighborhood-identity-schema');
          }
          for (const field of [
            'generation',
            'positionEpoch',
            'sourceCount',
            'consumerBit',
            'leaseTokenLow',
            'leaseTokenHigh'
          ]) {
            if (!finiteNonNegativeInteger(consumedNeighborhoodIdentity[field])) {
              issues.push(`invalid-pressure-consumed-neighborhood-${field}`);
            }
          }
          if (Number(consumedNeighborhoodIdentity.sourceCount) < 1) {
            issues.push('invalid-pressure-consumed-neighborhood-source-count');
          }
          for (const field of [
            'sourceFamily',
            'leaseId',
            'laneId',
            'stateKey',
            'deviceId',
            'tokenBinding',
            'taskId'
          ]) {
            if (!nonEmptyString(consumedNeighborhoodIdentity[field])) {
              issues.push(`missing-pressure-consumed-neighborhood-${field}`);
            }
          }
          if (consumedNeighborhoodIdentity.leaseIdentitySchema
            !== 'peercompute.compute.gpu-resident-lane-lease-identity.v0') {
            issues.push('pressure-consumed-neighborhood-lease-schema-invalid');
          }
          if (consumedNeighborhoodIdentity.authoritative !== true) {
            issues.push('pressure-consumed-neighborhood-not-authoritative');
          }
          if (Number(consumedNeighborhoodIdentity.generation)
            !== Number(pressureIdentity.sourceNeighborhoodGeneration)) {
            issues.push('pressure-consumed-neighborhood-generation-mismatch');
          }
          if (Number(consumedNeighborhoodIdentity.positionEpoch)
            !== Number(pressureIdentity.sourcePositionEpoch)) {
            issues.push('pressure-consumed-neighborhood-position-epoch-mismatch');
          }
          if (consumedNeighborhoodIdentity.leaseId !== pressureIdentity.leaseId) {
            issues.push('pressure-consumed-neighborhood-lease-id-mismatch');
          }
          if (consumedNeighborhoodIdentity.laneId !== pressureIdentity.laneId) {
            issues.push('pressure-consumed-neighborhood-lane-id-mismatch');
          }
          if (consumedNeighborhoodIdentity.stateKey !== pressureIdentity.stateKey) {
            issues.push('pressure-consumed-neighborhood-state-key-mismatch');
          }
          if (consumedNeighborhoodIdentity.deviceId !== pressureIdentity.consumerDeviceId) {
            issues.push('pressure-consumed-neighborhood-device-id-mismatch');
          }
          if (consumedNeighborhoodIdentity.taskId !== pressureIdentity.consumerLaneTaskId) {
            issues.push('pressure-consumed-neighborhood-task-id-mismatch');
          }
        }
        const expectedSourceEpoch = Number(pressureIdentity.sourcePositionEpoch);
        if (
          finiteNonNegativeInteger(payload.pressureRequestedSourceStep)
          && (
            Number(pressureIdentity.sourcePositionEpoch) !== expectedSourceEpoch
            || Number(pressureIdentity.sourceNeighborhoodGeneration) !== expectedSourceEpoch
            || Number(pressureIdentity.neighborhoodGenerationBase) !== expectedSourceEpoch
            || Number(pressureIdentity.neighborhoodPositionEpochBase) !== expectedSourceEpoch
          )
        ) {
          issues.push('pressure-source-position-epoch-identity-mismatch');
        }
        if (payload.stateKey && pressureIdentity.stateKey !== payload.stateKey) {
          issues.push('pressure-state-key-identity-mismatch');
        }
        if (gpuFence?.laneId && pressureIdentity.laneId !== gpuFence.laneId) {
          issues.push('pressure-lane-fence-identity-mismatch');
        }
        if (gpuFence?.stateKey && pressureIdentity.stateKey !== gpuFence.stateKey) {
          issues.push('pressure-state-key-fence-identity-mismatch');
        }
        issues.push(...pressureSourceFieldEpochValidationIssues(payload, pressureIdentity));
      }
    }
    const finalStep = plainObject(payload.finalStep) ? payload.finalStep : null;
    const stepSummaries = Array.isArray(payload.stepSummaries) ? payload.stepSummaries : [];
    if (
      payload.gpuAuthoritativeState === true
      || finalStep?.gpuAuthoritativeState === true
      || stepSummaries.some((summary) => summary?.gpuAuthoritativeState === true)
    ) {
      issues.push('gpu-authority-claimed-before-state-manager-commit');
    }
    if (
      payload.gpuAuthorityAdmissionSatisfied === true
      || finalStep?.gpuAuthorityAdmissionSatisfied === true
      || stepSummaries.some((summary) => summary?.gpuAuthorityAdmissionSatisfied === true)
    ) {
      issues.push('gpu-authority-admission-claimed-before-state-manager-commit');
    }
    if (payload.gpuResidentAuthoritativeContinuationCandidate === true) {
      const candidateEvidence = residentGpuAuthorityCandidateEvidence(payload);
      for (const blocker of candidateEvidence.blockers) {
        issues.push(`gpu-authority-candidate-${blocker}`);
      }
      if (payload.gpuAuthorityStatus !== GPU_AUTHORITY_CANDIDATE_STATUS) {
        issues.push('gpu-authority-candidate-status-invalid');
      }
    } else {
      if (payload.gpuAuthorityAdmissionRequired === true) {
        issues.push('gpu-authority-admission-required-without-candidate');
      }
      if (payload.gpuAuthorityStatus === GPU_AUTHORITY_CANDIDATE_STATUS) {
        issues.push('gpu-authority-candidate-status-without-candidate');
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

export function validateCoherentSolidCommitDelta(delta, {
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
  if (delta.schema !== ULG_COHERENT_SOLID_COMMIT_DELTA_SCHEMA) issues.push('unexpected-delta-schema');
  if (!nonEmptyString(delta.taskId)) issues.push('missing-task-id');
  if (!nonEmptyString(delta.scope) || !scopes.has(delta.scope)) issues.push('scope-not-accepted');
  const payload = plainObject(delta.payload) ? delta.payload : null;
  if (!payload) {
    issues.push('missing-payload');
  } else {
    if (payload.schema !== ULG_COHERENT_SOLID_STATE_DELTA_SCHEMA) issues.push('unexpected-payload-schema');
    if (!nonEmptyString(payload.stateKey)) issues.push('missing-state-key');
    if (!nonEmptyString(payload.laneId)) issues.push('missing-lane-id');
    if (!nonEmptyString(payload.leaseId)) issues.push('missing-lease-id');
    if (!nonEmptyString(payload.sourceFamily)) issues.push('missing-source-family');
    if (payload.producerTaskId !== delta.taskId) issues.push('producer-task-id-mismatch');
    if (!finiteNonNegativeNumber(payload.frameLeaseId)) issues.push('invalid-frame-lease-id');
    if (!finiteNonNegativeNumber(payload.frameLeaseEpoch)) issues.push('invalid-frame-lease-epoch');
    if (!finiteNonNegativeNumber(payload.sourceGenerationId)
      || !finiteNonNegativeNumber(payload.targetGenerationId)
      || Number(payload.targetGenerationId) !== Number(payload.sourceGenerationId) + 1) {
      issues.push('invalid-generation-advance');
    }
    for (const field of ['bodyCount', 'memberCount', 'contactProxyCount', 'sourcePositionEpoch', 'targetPositionEpoch']) {
      if (!finiteNonNegativeNumber(payload[field])) issues.push(`invalid-${field}`);
    }
    if (Number(payload.targetPositionEpoch) !== Number(payload.sourcePositionEpoch) + 1) {
      issues.push('invalid-position-epoch-advance');
    }
    if (payload.thirdLevelHold !== true) issues.push('third-level-hold-required');
    for (const field of [
      'sourceChartId',
      'sourceLevelId',
      'sourceHierarchyGeneration',
      'chartId',
      'levelId',
      'hierarchyGeneration'
    ]) {
      if (!Number.isInteger(Number(payload[field]))) issues.push(`invalid-${field}`);
    }
    if (![0, 1].includes(Number(payload.sourceLevelId))
      || ![0, 1].includes(Number(payload.levelId))) {
      issues.push('coherent-solid-third-ss-level-rejected');
    }
    if (Number(payload.hierarchyGeneration) < Number(payload.sourceHierarchyGeneration)) {
      issues.push('coherent-solid-hierarchy-generation-regressed');
    }
    if (!Array.isArray(payload.retainedBufferRefs) || payload.retainedBufferRefs.length === 0) {
      issues.push('retained-buffer-refs-required');
    }
    const fence = plainObject(payload.gpuFence) ? payload.gpuFence : null;
    if (!fence) {
      issues.push('missing-gpu-fence');
    } else {
      if (requireFenceSatisfied && fence.fenceSatisfied !== true) issues.push('gpu-fence-unsatisfied');
      if (fence.laneId !== payload.laneId) issues.push('lane-id-fence-mismatch');
      if (fence.stateKey !== payload.stateKey) issues.push('state-key-fence-mismatch');
    }
    const gate = plainObject(payload.invariantGate) ? payload.invariantGate : null;
    if (!gate) {
      issues.push('missing-invariant-gate');
    } else {
      if (gate.mode !== 'gpu-resident-fail-closed-consumer-gate') issues.push('invalid-invariant-gate-mode');
      if (gate.failedBodiesProduceZeroIndirectInstances !== true) issues.push('invariant-gate-not-fail-closed');
      if (gate.readbackRequiredForAdmission !== false) issues.push('invariant-gate-requires-readback');
      if (gate.candidateFramesFailClosedOnGlobalRejection !== true) {
        issues.push('invariant-gate-does-not-fail-close-candidate-frames');
      }
    }
    const executionShape = plainObject(payload.executionShape) ? payload.executionShape : null;
    if (!executionShape) issues.push('missing-coherent-solid-execution-shape');
    else {
      const workgroupSize = Number(executionShape.workgroupSize);
      if (!Number.isInteger(workgroupSize)
        || workgroupSize < 16
        || workgroupSize > 256
        || (workgroupSize & (workgroupSize - 1)) !== 0) {
        issues.push('invalid-coherent-solid-workgroup-size');
      }
      if (!finiteNonNegativeNumber(executionShape.maxComputeWorkgroupsPerDimension)
        || Number(executionShape.maxComputeWorkgroupsPerDimension) < 1) {
        issues.push('invalid-coherent-solid-dispatch-limit');
      }
      for (const field of ['bodyReductionDispatch', 'bodyLinearDispatch', 'memberLinearDispatch']) {
        const dispatch = executionShape[field];
        if (!Array.isArray(dispatch) || dispatch.length !== 3
          || dispatch.some((value) => !finiteNonNegativeNumber(value) || Number(value) < 1)) {
          issues.push(`invalid-${field}`);
        }
      }
      if (executionShape.proxyIndirectDispatch !== true) {
        issues.push('coherent-solid-proxy-indirect-dispatch-required');
      }
    }
    const proxyGate = plainObject(payload.proxyCompactionGate)
      ? payload.proxyCompactionGate
      : null;
    if (!proxyGate) issues.push('missing-proxy-compaction-gate');
    else {
      if (proxyGate.schema !== ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA) {
        issues.push('unexpected-proxy-compaction-evidence-schema');
      }
      if (proxyGate.generationId !== payload.targetGenerationId) {
        issues.push('proxy-compaction-generation-mismatch');
      }
      if (proxyGate.inputProxyCount !== payload.contactProxyCount) {
        issues.push('proxy-compaction-input-count-mismatch');
      }
      if (!finiteNonNegativeNumber(proxyGate.outputCapacity)) {
        issues.push('invalid-proxy-compaction-output-capacity');
      }
      if (proxyGate.evidenceByteLength !== 64) {
        issues.push('invalid-proxy-compaction-evidence-byte-length');
      }
      if (proxyGate.ordering !== 'stable-gpu-radix-unique-body-id-proxy-id') {
        issues.push('invalid-proxy-compaction-ordering');
      }
      if (proxyGate.failedCompactionProducesZeroIndirectInstances !== true) {
        issues.push('proxy-compaction-not-fail-closed');
      }
      if (proxyGate.readbackRequiredForAdmission !== false) {
        issues.push('proxy-compaction-requires-readback');
      }
    }
    const chartChanged = payload.chartId !== payload.sourceChartId
      || payload.levelId !== payload.sourceLevelId
      || payload.hierarchyGeneration !== payload.sourceHierarchyGeneration;
    const transition = plainObject(payload.chartTransition) ? payload.chartTransition : null;
    if (chartChanged && !transition) issues.push('missing-coherent-solid-chart-transition');
    if (transition) {
      if (transition.schema !== ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA) {
        issues.push('unexpected-coherent-solid-chart-transition-schema');
      }
      for (const [field, expected] of Object.entries({
        sourceChartId: payload.sourceChartId,
        sourceLevelId: payload.sourceLevelId,
        sourceHierarchyGeneration: payload.sourceHierarchyGeneration,
        sourcePositionEpoch: payload.sourcePositionEpoch,
        targetChartId: payload.chartId,
        targetLevelId: payload.levelId,
        targetHierarchyGeneration: payload.hierarchyGeneration,
        targetPositionEpoch: payload.targetPositionEpoch,
        geometryKey: payload.geometryKey,
        topologyGeneration: payload.topologyGeneration
      })) {
        if (transition[field] !== expected) issues.push(`chart-transition-${field}-mismatch`);
      }
      if (transition.preserveWorldPose !== true
        || transition.preserveWorldMomentum !== true
        || transition.preserveRestShape !== true
        || transition.preserveContactIdentity !== true
        || transition.thirdLevelHold !== true) {
        issues.push('chart-transition-continuity-contract-incomplete');
      }
    }
    if (payload.initialState === true) {
      if (payload.bootstrapTaskFamily !== COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY) {
        issues.push('unexpected-bootstrap-task-family');
      }
      const bootstrap = plainObject(payload.bootstrapEvidence) ? payload.bootstrapEvidence : null;
      if (!bootstrap) issues.push('missing-bootstrap-gpu-evidence-descriptor');
      else {
        if (bootstrap.schema !== ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA) {
          issues.push('unexpected-bootstrap-gpu-evidence-schema');
        }
        if (bootstrap.byteLength !== 128) issues.push('invalid-bootstrap-gpu-evidence-byte-length');
        if (bootstrap.generationId !== payload.targetGenerationId) {
          issues.push('bootstrap-gpu-evidence-generation-mismatch');
        }
        if (bootstrap.frameLeaseId !== payload.frameLeaseId) {
          issues.push('bootstrap-gpu-evidence-frame-lease-mismatch');
        }
        if (bootstrap.producerTaskId !== delta.taskId) {
          issues.push('bootstrap-gpu-evidence-task-mismatch');
        }
        if (bootstrap.sameDeviceRetained !== true) {
          issues.push('bootstrap-gpu-evidence-not-same-device-retained');
        }
        if (bootstrap.gpuGlobalInvariantFailCloseApplied !== true) {
          issues.push('bootstrap-gpu-evidence-not-fail-closed');
        }
      }
    }
    if (payload.rawGpuBufferTransferDetected === true || rawGpuBufferDetected(payload)) {
      issues.push('raw-gpu-buffer-transfer-detected');
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
  return createAdmission({ accepted: true, status: 'accepted', delta, payload });
}

function promoteGpuAuthorityRecord(record = null) {
  if (!plainObject(record) || record.gpuResidentAuthoritativeContinuationCandidate !== true) {
    return record;
  }
  return {
    ...record,
    gpuAuthorityAdmissionRequired: true,
    gpuAuthorityAdmissionSatisfied: true,
    gpuAuthorityStatus: GPU_AUTHORITY_COMMITTED_STATUS,
    gpuAuthoritativeState: true,
    schroederParticleStorageResidencyAdoptionToken:
      promoteSchroederParticleStorageResidencyToken(
        record.schroederParticleStorageResidencyAdoptionToken
      )
  };
}

function residentCommittedGpuAuthorityEvidence(payload = null) {
  const finalStep = plainObject(payload?.finalStep) ? payload.finalStep : null;
  return Boolean(
    payload?.gpuResidentAuthoritativeContinuationCandidate === true
    && payload?.gpuAuthorityAdmissionRequired === true
    && payload?.gpuAuthorityAdmissionSatisfied === true
    && payload?.gpuAuthorityStatus === GPU_AUTHORITY_COMMITTED_STATUS
    && payload?.gpuAuthoritativeState === true
    && payload?.backend === 'webgpu'
    && payload?.readbackMode === 'no-full-readback'
    && payload?.normalHotLoopReadbackFree === true
    && payload?.continuationAvailable === true
    && finalStep?.gpuResidentAuthoritativeContinuationCandidate === true
    && finalStep?.gpuAuthorityAdmissionSatisfied === true
    && finalStep?.gpuAuthorityStatus === GPU_AUTHORITY_COMMITTED_STATUS
    && finalStep?.gpuAuthoritativeState === true
  );
}

export function createStateManagerCommittedResidentStepsDelta(delta, admission = null) {
  if (
    delta?.schema !== ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA
    || admission?.accepted !== true
  ) {
    return delta;
  }
  const payload = plainObject(delta.payload) ? delta.payload : null;
  const candidateEvidence = residentGpuAuthorityCandidateEvidence(payload);
  if (!candidateEvidence.eligible) return delta;
  return {
    ...delta,
    payload: {
      ...payload,
      gpuAuthorityAdmissionRequired: true,
      gpuAuthorityAdmissionSatisfied: true,
      gpuAuthorityStatus: GPU_AUTHORITY_COMMITTED_STATUS,
      gpuAuthoritativeState: true,
      schroederParticleStorageResidencyAdoptionToken:
        promoteSchroederParticleStorageResidencyToken(
          payload.schroederParticleStorageResidencyAdoptionToken
        ),
      finalStep: promoteGpuAuthorityRecord(payload.finalStep),
      stepSummaries: Array.isArray(payload.stepSummaries)
        ? payload.stepSummaries.map((summary) => promoteGpuAuthorityRecord(summary))
        : []
    }
  };
}

export function promoteResidentStepsExecutionGpuAuthority(execution, committedAdmission) {
  const warmPayload = committedAdmission?.warmEntry?.payload;
  const proposedPayload = execution?.commitDelta?.payload;
  const candidateDeclared = execution?.gpuResidentAuthoritativeContinuationCandidate === true
    && proposedPayload?.gpuResidentAuthoritativeContinuationCandidate === true;
  const proposedDelta = execution?.commitDelta;
  const committedTaskMatches = nonEmptyString(proposedDelta?.taskId)
    && committedAdmission?.taskId === proposedDelta.taskId;
  const committedScopeMatches = nonEmptyString(proposedDelta?.scope)
    && committedAdmission?.scope === proposedDelta.scope;
  const warmBindingAdmission = plainObject(committedAdmission?.warmEntry)
    && plainObject(proposedDelta)
    ? validateResidentStepsCommittedWarmEntry(
        committedAdmission.warmEntry,
        proposedDelta,
        {
          acceptedScopes: [...new Set([...DEFAULT_ACCEPTED_SCOPES, proposedDelta.scope])],
          requireFenceSatisfied: true
        }
      )
    : null;
  const schroederParticleStorageResidencyCandidate =
    execution?.schroederParticleStorageResidencyAdoptionCandidate
    ?? execution?.finalStep?.schroederParticleStorageResidencyAdoptionCandidate
    ?? null;
  const schroederParticleStorageResidencyToken =
    proposedPayload?.schroederParticleStorageResidencyAdoptionToken ?? null;
  const schroederParticleStorageResidencyAdoption =
    schroederParticleStorageResidencyToken && schroederParticleStorageResidencyCandidate
      ? createStateManagerAdmittedSchroederParticleStorageResidencyAdoption({
          candidate: schroederParticleStorageResidencyCandidate,
          stateManagerAdmission: committedAdmission
        })
      : null;
  const residencyPromotionSatisfied = !schroederParticleStorageResidencyToken
    || schroederParticleStorageResidencyAdoption?.adopted === true;
  const committed = committedAdmission?.accepted === true
    && committedAdmission?.status === 'committed'
    && candidateDeclared
    && committedTaskMatches
    && committedScopeMatches
    && warmBindingAdmission?.accepted === true
    && warmBindingAdmission?.status === 'committed'
    && residentCommittedGpuAuthorityEvidence(warmPayload)
    && residencyPromotionSatisfied;
  if (!committed) {
    return {
      promoted: false,
      status: candidateDeclared
        ? (committedAdmission?.accepted === true && committedAdmission?.status === 'committed'
            ? 'gpu-authority-committed-evidence-not-bound-to-execution'
            : 'gpu-authority-candidate-not-committed')
        : 'gpu-authority-promotion-not-applicable',
      gpuAuthoritativeState: false,
      committedStateDelta: null,
      committedTaskMatches,
      committedScopeMatches,
      schroederParticleStorageResidencyPromotionStatus:
        schroederParticleStorageResidencyAdoption?.status ?? null,
      schroederParticleStorageResidencyPromotionBlockers:
        [...(schroederParticleStorageResidencyAdoption?.blockers || [])],
      warmBindingIssues: [...(warmBindingAdmission?.issues || [])]
    };
  }

  const committedStateDelta = {
    ...execution.commitDelta,
    payload: { ...warmPayload }
  };
  execution.gpuAuthorityAdmissionRequired = true;
  execution.gpuAuthorityAdmissionSatisfied = true;
  execution.gpuAuthorityStatus = GPU_AUTHORITY_COMMITTED_STATUS;
  execution.gpuAuthoritativeState = true;
  execution.committedStateDelta = committedStateDelta;
  if (schroederParticleStorageResidencyAdoption?.adopted === true) {
    execution.schroederParticleStorageResidencyAdoption =
      schroederParticleStorageResidencyAdoption;
    execution.schroederParticleStorageResidencyAdoptionStatus =
      schroederParticleStorageResidencyAdoption.status;
    execution.schroederParticleStorageResidencyAdoptionToken =
      schroederParticleStorageResidencyAdoption.admissionToken;
    execution.schroederParticleStorageAuthoritativeParticleCount = null;
    execution.schroederParticleStorageAuthoritativeParticleCountMetadataWord =
      schroederParticleStorageResidencyAdoption.authoritativeParticleCountMetadataWord;
    if (execution.finalStep) {
      execution.finalStep.schroederParticleStorageResidencyAdoption =
        schroederParticleStorageResidencyAdoption;
      execution.finalStep.schroederParticleStorageResidencyAdoptionStatus =
        schroederParticleStorageResidencyAdoption.status;
      execution.finalStep.schroederParticleStorageResidencyAdoptionToken =
        schroederParticleStorageResidencyAdoption.admissionToken;
      execution.finalStep.schroederParticleStorageAdopted = true;
      execution.finalStep.schroederParticleStorageAuthoritativeParticleCount = null;
      execution.finalStep.schroederParticleStorageAuthoritativeParticleCountMetadataWord =
        schroederParticleStorageResidencyAdoption.authoritativeParticleCountMetadataWord;
    }
  }
  if (execution.finalStep?.gpuResidentAuthoritativeContinuationCandidate === true) {
    Object.assign(execution.finalStep, promoteGpuAuthorityRecord(execution.finalStep));
  }
  for (const summary of execution.stepSummaries || []) {
    if (summary?.gpuResidentAuthoritativeContinuationCandidate === true) {
      Object.assign(summary, promoteGpuAuthorityRecord(summary));
    }
  }
  return {
    promoted: true,
    status: GPU_AUTHORITY_COMMITTED_STATUS,
    gpuAuthoritativeState: true,
    schroederParticleStorageResidencyAdoption,
    committedStateDelta
  };
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
    if (!admission.accepted) {
      if (typeof onAdmission === 'function') {
        onAdmission(admission, delta);
      }
      const error = new Error(`ULG resident commit delta rejected: ${admission.reason || 'invalid-delta'}`);
      error.code = 'ERR_ULG_RESIDENT_DELTA_REJECTED';
      error.admission = admission;
      throw error;
    }
    const committedDelta = createStateManagerCommittedResidentStepsDelta(delta, admission);
    stateManager.commitDelta(committedDelta);
    const committedAdmission = createAdmission({
      accepted: true,
      status: admission.status,
      delta: committedDelta,
      payload: committedDelta?.payload
    });
    if (typeof onAdmission === 'function') {
      onAdmission(committedAdmission, delta);
    }
    return committedAdmission;
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
  if (delta?.schema === ULG_COHERENT_SOLID_COMMIT_DELTA_SCHEMA) {
    const deltaAdmission = validateCoherentSolidCommitDelta(delta, {
      acceptedScopes,
      requireFenceSatisfied
    });
    if (!deltaAdmission.accepted) return deltaAdmission;
    const payload = plainObject(entry?.payload) ? entry.payload : null;
    const expected = delta.payload;
    const issues = [];
    if (!payload) issues.push('warm-entry-payload-missing');
    else {
      if (payload.schema !== ULG_COHERENT_SOLID_STATE_DELTA_SCHEMA) issues.push('warm-entry-unexpected-payload-schema');
      for (const field of ['stateKey', 'laneId', 'leaseId', 'targetGenerationId', 'targetPositionEpoch']) {
        if (payload[field] !== expected[field]) issues.push(`warm-entry-${field}-mismatch`);
      }
      if (payload.gpuFence?.fenceSatisfied !== true) issues.push('warm-entry-gpu-fence-unsatisfied');
      if (rawGpuBufferDetected(payload)) issues.push('warm-entry-raw-gpu-buffer-detected');
    }
    if (entry?.version !== undefined && delta.version !== undefined && entry.version !== delta.version) {
      issues.push('warm-entry-version-mismatch');
    }
    return issues.length > 0
      ? { ...deltaAdmission, accepted: false, status: 'rejected', reason: issues[0], issues }
      : {
          ...deltaAdmission,
          status: 'committed',
          warmEntryVersion: entry?.version ?? null,
          warmEntryTimestamp: entry?.ts ?? null
        };
  }
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
    if (deltaPayload?.pressureSourceFieldRequested === true) {
      const proposedEpochs = deltaPayload.pressureSourceFieldConsumptionIdentity
        ?.sourceFieldEpochs;
      const committedEpochs = payload.pressureSourceFieldConsumptionIdentity
        ?.sourceFieldEpochs;
      if (
        !Array.isArray(proposedEpochs)
        || !Array.isArray(committedEpochs)
        || JSON.stringify(committedEpochs) !== JSON.stringify(proposedEpochs)
      ) {
        issues.push('warm-entry-pressure-source-field-epochs-mismatch');
      }
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
    const deltaSchroederResidencyToken =
      schroederParticleStorageResidencyTokenFromPayload(deltaPayload);
    const warmSchroederResidencyToken =
      schroederParticleStorageResidencyTokenFromPayload(payload);
    if (deltaSchroederResidencyToken) {
      if (!warmSchroederResidencyToken) {
        issues.push('warm-entry-schroeder-particle-storage-residency-token-missing');
      } else {
        const warmTokenValidation =
          validateSchroederParticleStorageResidencyAdoptionToken(
            warmSchroederResidencyToken,
            { requireCommitted: true }
          );
        for (const issue of warmTokenValidation.issues) {
          issues.push(`warm-entry-schroeder-particle-storage-residency-token-${issue}`);
        }
        if (rawGpuBufferDetected(warmSchroederResidencyToken)) {
          issues.push(
            'warm-entry-schroeder-particle-storage-residency-token-raw-gpubuffer-detected'
          );
        }
        if (JSON.stringify(
          demoteSchroederParticleStorageResidencyToken(warmSchroederResidencyToken)
        ) !== JSON.stringify(deltaSchroederResidencyToken)) {
          issues.push('warm-entry-schroeder-particle-storage-residency-token-mismatch');
        }
      }
    } else if (warmSchroederResidencyToken) {
      issues.push('warm-entry-unexpected-schroeder-particle-storage-residency-token');
    }
    const authorityCandidate =
      deltaPayload?.gpuResidentAuthoritativeContinuationCandidate === true;
    if (authorityCandidate) {
      if (payload.gpuResidentAuthoritativeContinuationCandidate !== true) {
        issues.push('warm-entry-gpu-authority-candidate-missing');
      }
      if (payload.gpuAuthorityAdmissionRequired !== true) {
        issues.push('warm-entry-gpu-authority-admission-requirement-missing');
      }
      if (payload.gpuAuthorityAdmissionSatisfied !== true) {
        issues.push('warm-entry-gpu-authority-admission-not-satisfied');
      }
      if (payload.gpuAuthorityStatus !== GPU_AUTHORITY_COMMITTED_STATUS) {
        issues.push('warm-entry-gpu-authority-status-not-committed');
      }
      if (payload.gpuAuthoritativeState !== true) {
        issues.push('warm-entry-gpu-authoritative-state-not-promoted');
      }
      if (!residentCommittedGpuAuthorityEvidence(payload)) {
        issues.push('warm-entry-gpu-authority-committed-evidence-incomplete');
      }
      const warmCandidateAdmission = validateResidentStepsCommitDelta({
        ...delta,
        payload: demoteCommittedGpuAuthorityPayload(payload)
      }, {
        acceptedScopes,
        requireFenceSatisfied
      });
      for (const issue of warmCandidateAdmission.issues || []) {
        issues.push(`warm-entry-${issue}`);
      }
      if (!exactStringArrayMatch(payload.outputFamilies, deltaPayload.outputFamilies)) {
        issues.push('warm-entry-output-families-mismatch');
      }
      if (!exactStringArrayMatch(payload.retainedBufferRefs, deltaPayload.retainedBufferRefs)) {
        issues.push('warm-entry-retained-buffer-refs-mismatch');
      }
      if (!exactStringArrayMatch(
        payload.gpuFence?.retainedBufferRefs,
        deltaPayload.gpuFence?.retainedBufferRefs
      )) {
        issues.push('warm-entry-gpu-fence-retained-buffer-refs-mismatch');
      }
      for (const field of ['laneId', 'stateKey', 'deviceId', 'status', 'method']) {
        if (payload.gpuFence?.[field] !== deltaPayload.gpuFence?.[field]) {
          issues.push(`warm-entry-gpu-fence-${field}-mismatch`);
        }
      }
      const warmSummaries = Array.isArray(payload.stepSummaries) ? payload.stepSummaries : [];
      const proposedSummaries = Array.isArray(deltaPayload.stepSummaries)
        ? deltaPayload.stepSummaries
        : [];
      for (let index = 0; index < proposedSummaries.length; index += 1) {
        const warmSummary = warmSummaries[index];
        const proposedSummary = proposedSummaries[index];
        for (const field of [
          'stepIndex',
          'backend',
          'status',
          'readbackMode',
          'normalHotLoopReadbackFree',
          'gpuResidentAuthoritativeContinuationCandidate',
          'nextParticleCount'
        ]) {
          if (warmSummary?.[field] !== proposedSummary?.[field]) {
            issues.push(`warm-entry-step-summary-${index}-${field}-mismatch`);
          }
        }
      }
    } else if (
      payload.gpuAuthoritativeState === true
      || payload.gpuAuthorityAdmissionSatisfied === true
    ) {
      issues.push('warm-entry-gpu-authority-promoted-without-candidate');
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
    gpuResidentAuthoritativeContinuationCandidate:
      payload?.gpuResidentAuthoritativeContinuationCandidate === true,
    gpuAuthorityAdmissionRequired: payload?.gpuAuthorityAdmissionRequired === true,
    gpuAuthorityAdmissionSatisfied: payload?.gpuAuthorityAdmissionSatisfied === true,
    gpuAuthorityStatus: payload?.gpuAuthorityStatus ?? null,
    gpuAuthoritativeState: payload?.gpuAuthoritativeState === true,
    schroederParticleStorageResidencyTokenStatus:
      schroederParticleStorageResidencyTokenFromPayload(payload)?.status ?? null,
    schroederParticleStorageResidencyTokenCommitted:
      schroederParticleStorageResidencyTokenFromPayload(payload)
        ?.stateManagerAdmissionCommitted === true,
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
