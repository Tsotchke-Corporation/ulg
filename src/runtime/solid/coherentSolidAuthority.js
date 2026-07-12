import {
  COHERENT_SOLID_STATE_MANAGER_ADMITTED,
  ULG_COHERENT_SOLID_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA,
  ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA,
  ULG_COHERENT_SOLID_DRAW_GROUP_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_SCHEMA,
  ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA,
  ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
  ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
  ULG_COHERENT_SOLID_STATE_MANAGER_ADMISSION_SCHEMA,
  COHERENT_SOLID_DERIVED_ADMITTED
} from '../../../ulg-gpu-abi/src/coherentSolid.js';
import { readResidentStepsCommittedWarmDelta } from '../peercomputeResidentCommitBridge.js';
import {
  COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY,
  COHERENT_SOLID_RESIDENT_COMMIT_SCOPE,
  createCoherentSolidBootstrapComputeTask,
  createCoherentSolidFrameComputeTask
} from './coherentSolidResidentTask.js';
import { createCoherentSolidPresentationLeaseRegistry } from './coherentSolidPresentationLease.js';
import { destroyCoherentSolidResidentLaneCaches } from './coherentSolidResidentLaneCache.js';

const PUBLICATION_HOT_BUFFER_SCHEMA =
  'peercompute.ulg.schroeder-solid-local-hot-buffer-publication.v0';

function positiveAdmissionId(value) {
  const text = String(value ?? '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function assertStateManager(stateManager) {
  if (!stateManager?.setHotBuffer || !stateManager?.getHotBuffer || !stateManager?.commitDelta) {
    throw new TypeError('coherent-solid authority requires StateManager hot/warm storage');
  }
}

const COHERENT_SOLID_SOURCE_ROLES = Object.freeze([
  'frameSource',
  'memberSource',
  'membershipSource',
  'localContactProxySource',
  'restMesh',
  'shapeCarrier'
]);

export function validateCoherentSolidCurrentSourceBundle({
  publication = null,
  sourceBundle = null,
  options = {}
} = {}) {
  if (!publication || !sourceBundle) {
    return { accepted: false, reason: 'current-publication-source-bundle-missing' };
  }
  for (const role of COHERENT_SOLID_SOURCE_ROLES) {
    if (options[role] !== sourceBundle[role]) {
      return { accepted: false, reason: `${role}-not-owned-by-current-publication` };
    }
  }
  for (const [field, expected] of Object.entries({
    device: publication.device,
    stateKey: publication.stateKey,
    laneId: publication.laneId,
    sourceFamily: publication.leaseIdentity?.sourceFamily
  })) {
    if (options[field] != null && options[field] !== expected) {
      return { accepted: false, reason: `${field}-current-publication-mismatch` };
    }
  }
  const frameSource = sourceBundle.frameSource;
  const contactSource = sourceBundle.localContactProxySource;
  const shapeCarrier = sourceBundle.shapeCarrier;
  if (
    frameSource?.device !== publication.device
    || frameSource?.generationId !== publication.publicationGeneration
    || frameSource?.positionEpoch !== publication.sourceEpoch
    || frameSource?.stateManagerAdmissionId !== publication.admissionId
  ) {
    return { accepted: false, reason: 'mutable-frame-source-authority-mismatch' };
  }
  if (
    contactSource?.device !== publication.device
    || contactSource?.positionEpoch !== publication.sourceEpoch
    || contactSource?.stateManagerAdmissionId !== publication.admissionId
  ) {
    return { accepted: false, reason: 'mutable-contact-source-authority-mismatch' };
  }
  if (
    shapeCarrier?.generationId !== publication.publicationGeneration
    || shapeCarrier?.positionEpoch !== publication.sourceEpoch
    || shapeCarrier?.stateManagerAdmissionId !== publication.admissionId
  ) {
    return { accepted: false, reason: 'mutable-shape-source-authority-mismatch' };
  }
  const targetGenerationId = options.targetGenerationId
    ?? publication.publicationGeneration + 1;
  if (targetGenerationId !== publication.publicationGeneration + 1) {
    return { accepted: false, reason: 'target-generation-not-current-plus-one' };
  }
  const sourcePositionEpoch = options.sourcePositionEpoch ?? publication.sourceEpoch;
  const targetPositionEpoch = options.targetPositionEpoch ?? sourcePositionEpoch + 1;
  if (sourcePositionEpoch !== publication.sourceEpoch) {
    return { accepted: false, reason: 'source-position-epoch-not-current' };
  }
  if (targetPositionEpoch !== sourcePositionEpoch + 1) {
    return { accepted: false, reason: 'target-position-epoch-not-current-plus-one' };
  }
  return {
    accepted: true,
    reason: null,
    targetGenerationId,
    sourcePositionEpoch,
    targetPositionEpoch
  };
}

export function createCoherentSolidAuthorityController({
  computeManager,
  stateManager,
  nodeKernel = null
} = {}) {
  if (!computeManager?.submitTask) {
    throw new TypeError('coherent-solid authority requires ComputeManager.submitTask');
  }
  assertStateManager(stateManager);
  const admittedPublications = new WeakSet();
  const completedComputeResults = new WeakSet();
  const publicationByComputeResult = new WeakMap();
  const sourceBundleByPublication = new WeakMap();
  const admissionByStateKey = new Map();
  const activePublications = new Set();
  const pendingComputeResults = new Set();
  const devices = new Set();
  const trackedDeviceLoss = new WeakSet();
  const terminalDevices = new WeakSet();
  const deviceTerminalEvidence = new WeakMap();
  let destroyed = false;
  const presentationLeases = createCoherentSolidPresentationLeaseRegistry({
    validatePublication(publication) {
      return validateDrawPublication(publication);
    }
  });

  function assertControllerLive() {
    if (destroyed) throw new Error('coherent-solid authority controller is destroyed');
  }

  function registerPublicationSourceBundle(publication, sourceBundle) {
    sourceBundleByPublication.set(publication, Object.freeze({ ...sourceBundle }));
  }

  function abortComputeResult(result) {
    if (!result || !completedComputeResults.has(result)) return false;
    pendingComputeResults.delete(result);
    completedComputeResults.delete(result);
    result.localRetainedRefs?.destroy?.();
    return true;
  }

  function terminateAuthorityDevice(device, reason = 'coherent-solid-device-lost') {
    if (!device || (typeof device !== 'object' && typeof device !== 'function')) {
      return Object.freeze({
        schema: 'peercompute.ulg.coherent-solid-device-terminal-release.v0',
        status: 'coherent-solid-device-terminal-release-skipped',
        reason: 'device-required',
        retiredPublicationCount: 0,
        abortedResultCount: 0,
        terminalPresentationCount: 0,
        destroyedCacheCount: 0
      });
    }
    terminalDevices.add(device);
    let retiredPublicationCount = 0;
    let abortedResultCount = 0;
    for (const publication of [...activePublications]) {
      if (publication.device !== device) continue;
      if (retirePublicationRecord(publication, { terminalDeviceLoss: true })) {
        retiredPublicationCount += 1;
      }
    }
    for (const result of [...pendingComputeResults]) {
      if (result?.localRetainedRefs?.device !== device) continue;
      if (abortComputeResult(result)) abortedResultCount += 1;
    }
    const terminalPresentationCount = presentationLeases.terminateDevice(device, { reason });
    const destroyedCacheCount = destroyCoherentSolidResidentLaneCaches(device);
    const evidence = Object.freeze({
      schema: 'peercompute.ulg.coherent-solid-device-terminal-release.v0',
      status: 'coherent-solid-device-terminal-release-requested',
      reason,
      retiredPublicationCount,
      abortedResultCount,
      terminalPresentationCount,
      destroyedCacheCount
    });
    deviceTerminalEvidence.set(device, evidence);
    return evidence;
  }

  function trackDevice(device) {
    if (!device || (typeof device !== 'object' && typeof device !== 'function')) return;
    devices.add(device);
    if (trackedDeviceLoss.has(device) || typeof device.lost?.then !== 'function') return;
    trackedDeviceLoss.add(device);
    Promise.resolve(device.lost).then(
      (info) => terminateAuthorityDevice(
        device,
        `coherent-solid-device-lost:${info?.reason || 'unknown'}`
      ),
      (error) => terminateAuthorityDevice(
        device,
        `coherent-solid-device-lost-promise-rejected:${error instanceof Error ? error.message : String(error)}`
      )
    );
  }

  function retirePublicationRecord(publication, {
    replacedBy = null,
    terminalDeviceLoss = false
  } = {}) {
    if (!admittedPublications.has(publication)) return false;
    const hotBufferKey = publication.stateManagerAdmission?.hotBufferKey;
    presentationLeases.retire(publication, {
      reason: replacedBy
        ? 'coherent-solid-publication-replaced'
        : (terminalDeviceLoss
          ? 'coherent-solid-publication-device-lost'
          : 'coherent-solid-publication-retired'),
      replacedByGeneration: replacedBy?.publicationGeneration ?? null,
      releaseConsumers: terminalDeviceLoss
    });
    const dataState = stateManager.getDataState?.();
    if (typeof dataState?.deleteHotBuffer === 'function') {
      dataState.deleteHotBuffer(hotBufferKey);
    } else if (hotBufferKey) {
      stateManager.setHotBuffer(hotBufferKey, Object.freeze({
        schema: PUBLICATION_HOT_BUFFER_SCHEMA,
        status: 'coherent-solid-publication-retired-descriptor-only',
        hotBufferKey,
        stateKey: publication.stateKey,
        publicationGeneration: publication.publicationGeneration,
        replacedByGeneration: replacedBy?.publicationGeneration ?? null,
        rawGpuBufferTransferDetected: false
      }));
    }
    admittedPublications.delete(publication);
    activePublications.delete(publication);
    sourceBundleByPublication.delete(publication);
    if (admissionByStateKey.get(publication.stateKey) === publication) {
      admissionByStateKey.delete(publication.stateKey);
    }
    return true;
  }

  async function admitInitialState({
    stateKey = 'ulg:coherent-solid-state',
    laneId = 'ulg:coherent-solid:active',
    sourceFamily = 'coherent-solid-frame',
    frameSource,
    memberSource,
    membershipSource,
    localContactProxySource,
    restMesh,
    shapeCarrier,
    chartId = 0,
    levelId = 0,
    hierarchyGeneration = 0,
    positionEpoch = 1,
    thirdLevelHold = true,
    workgroupSize = 64,
    dispatchWorkgroupLimit = null,
    proxyOutputLimit = localContactProxySource?.proxyCount ?? 0,
    presentation = {}
  } = {}) {
    assertControllerLive();
    const device = frameSource?.device;
    if (
      !device
      || memberSource?.device !== device
      || membershipSource?.device !== device
      || localContactProxySource?.device !== device
      || restMesh?.device !== device
      || thirdLevelHold !== true
    ) {
      throw new Error('initial coherent-solid state requires same-device GPU sources and third-level hold');
    }
    trackDevice(device);
    const result = await computeManager.submitTask(createCoherentSolidBootstrapComputeTask({
      stateKey,
      laneId,
      sourceFamily,
      device,
      frameSource,
      memberSource,
      membershipSource,
      localContactProxySource,
      restMesh,
      shapeCarrier,
      chartId,
      levelId,
      hierarchyGeneration,
      positionEpoch,
      thirdLevelHold: true,
      workgroupSize,
      dispatchWorkgroupLimit:
        dispatchWorkgroupLimit ?? device?.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
      proxyOutputLimit
    }));
    if (result && typeof result === 'object') {
      completedComputeResults.add(result);
      pendingComputeResults.add(result);
    }
    if (terminalDevices.has(device)) {
      abortComputeResult(result);
      throw new Error('coherent-solid bootstrap device is terminal');
    }
    const evidence = result?.bootstrapEvidence;
    const refs = result?.localRetainedRefs;
    const candidate = result?.localRetainedRefs?.frameMutationCandidate;
    const identity = result?.laneLeaseIdentity;
    const descriptor = result?.commitDelta?.payload?.bootstrapEvidence;
    if (
      result?.bootstrapTaskFamily !== COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY
      || result.commitDelta?.payload?.bootstrapTaskFamily !== COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY
      || result.commitDelta?.payload?.initialState !== true
      || identity?.schema !== 'peercompute.compute.gpu-resident-lane-lease-identity.v0'
      || identity.authoritative !== true
      || identity.taskId !== result.computeTaskId
      || identity.stateKey !== stateKey
      || identity.laneId !== laneId
      || identity.sourceFamily !== sourceFamily
      || evidence?.schema !== 'peercompute.ulg.schroeder-solid-invariant-evidence.v0'
      || evidence.device !== device
      || !evidence.buffer
      || evidence.buffer !== refs?.invariantEvidence?.buffer
      || evidence.byteLength !== 128
      || evidence.generationId !== result.targetGenerationId
      || evidence.generationId !== candidate?.generationId
      || evidence.leaseId !== frameSource.leaseId
      || evidence.leaseEpoch !== frameSource.leaseEpoch
      || evidence.producerTaskId !== result.computeTaskId
      || evidence.gpuGlobalInvariantFailCloseApplied !== true
      || candidate?.gpuGlobalInvariantFailCloseApplied !== true
      || candidate?.buffer !== refs?.gpuDrawRange?.frameSource?.buffer
      || descriptor?.producerTaskId !== result.computeTaskId
      || descriptor?.generationId !== result.targetGenerationId
      || descriptor?.frameLeaseId !== frameSource.leaseId
      || descriptor?.sameDeviceRetained !== true
      || descriptor?.gpuGlobalInvariantFailCloseApplied !== true
    ) {
      abortComputeResult(result);
      throw new Error('coherent-solid bootstrap task did not produce exact same-device GPU evidence');
    }
    const publication = await admitTaskResult(result, presentation);
    const admission = publication.stateManagerAdmission;
    const admissionId = admission.admissionId;
    const retainedRefs = result.localRetainedRefs;
    const generation = result.targetGenerationId;
    const taskId = result.computeTaskId;
    const admittedFrameSource = publication.drawGroups[0].frameSource;
    const admittedMemberSource = Object.freeze({
      ...retainedRefs.memberSource,
      schema: ULG_COHERENT_SOLID_MEMBER_SCHEMA,
      authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED,
      stateManagerAdmissionId: admissionId
    });
    const admittedMembershipSource = Object.freeze({
      ...retainedRefs.membershipSource,
      schema: ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
      authorityStatus: COHERENT_SOLID_DERIVED_ADMITTED,
      stateManagerAdmissionId: admissionId
    });
    const admittedContactProxySource = publication.localContactProxySource;
    const admittedShapeCarrier = publication.drawGroups[0].shapeCarrier;
    registerPublicationSourceBundle(publication, {
      frameSource: admittedFrameSource,
      memberSource: admittedMemberSource,
      membershipSource: admittedMembershipSource,
      localContactProxySource: admittedContactProxySource,
      restMesh,
      shapeCarrier: admittedShapeCarrier
    });
    const hotBufferKey = admission.hotBufferKey;
    const existingHotRecord = stateManager.getHotBuffer(hotBufferKey);
    try {
      stateManager.setHotBuffer(hotBufferKey, {
        ...existingHotRecord,
        schema: PUBLICATION_HOT_BUFFER_SCHEMA,
        status: 'coherent-solid-bootstrap-local-retained-refs-admitted',
        delta: result.commitDelta,
        publication,
        bootstrapEvidence: evidence,
        frameSource: admittedFrameSource,
        memberSource: admittedMemberSource,
        membershipSource: admittedMembershipSource,
        localContactProxySource: admittedContactProxySource,
        restMesh,
        shapeCarrier: admittedShapeCarrier
      });
    } catch (error) {
      retirePublicationRecord(publication);
      throw error;
    }
    return Object.freeze({
      schema: ULG_COHERENT_SOLID_STATE_MANAGER_ADMISSION_SCHEMA,
      status: 'coherent-solid-bootstrap-state-manager-admitted',
      accepted: true,
      committed: true,
      admissionId,
      taskId,
      scope: result.commitDelta.scope,
      stateKey,
      laneId,
      sourceFamily,
      frameSource: admittedFrameSource,
      memberSource: admittedMemberSource,
      membershipSource: admittedMembershipSource,
      localContactProxySource: admittedContactProxySource,
      restMesh,
      shapeCarrier: admittedShapeCarrier,
      bootstrapEvidence: evidence,
      residentLaneCacheEvidence: retainedRefs.getResidentLaneCacheEvidence?.() || null,
      bootstrapTaskEvidence: Object.freeze({
        queueSubmissionCount: result.queueSubmissionCount,
        laneLeaseIdentity: result.laneLeaseIdentity,
        fullStateReadbackPerformed: result.fullStateReadbackPerformed,
        compactEvidenceReadbackPerformed: result.compactEvidenceReadbackPerformed,
        cpuMirrorRequired: result.cpuMirrorRequired
      }),
      publication,
      hotBufferKey
    });
  }

  async function admitTaskResult(result, {
    opacity = 1,
    exposure = 1,
    renderOrder = 100,
    depthWriteFlag = opacity < 0.999 ? 0 : 1
  } = {}) {
    assertControllerLive();
    if (!result || typeof result !== 'object' || !completedComputeResults.has(result)) {
      throw new Error('coherent-solid admission requires this controller\'s ComputeManager result identity');
    }
    const existingPublication = publicationByComputeResult.get(result);
    if (existingPublication) return existingPublication;
    if (
      result?.schema !== ULG_COHERENT_SOLID_COMPUTE_TASK_RESULT_SCHEMA
      || result.status !== 'coherent-solid-frame-candidate-gpu-complete-awaiting-state-manager-admission'
      || result.gpuFence?.fenceSatisfied !== true
    ) {
      abortComputeResult(result);
      throw new Error('coherent-solid admission requires a completed ComputeManager GPU result');
    }
    let warm = null;
    try {
      warm = readResidentStepsCommittedWarmDelta(stateManager, {
        delta: result.commitDelta,
        acceptedScopes: [COHERENT_SOLID_RESIDENT_COMMIT_SCOPE],
        requireFenceSatisfied: true
      });
    } catch (error) {
      abortComputeResult(result);
      throw error;
    }
    if (!warm.accepted || warm.status !== 'committed' || !warm.warmEntryFound) {
      abortComputeResult(result);
      throw new Error(`coherent-solid StateManager warm admission missing: ${warm.reason || warm.status}`);
    }
    const refs = result.localRetainedRefs;
    if (terminalDevices.has(refs?.device)) {
      abortComputeResult(result);
      throw new Error('coherent-solid admission device is terminal');
    }
    const payload = result.commitDelta.payload;
    const identity = refs?.leaseIdentity;
    const proxyEvidence = refs?.proxyCompactionEvidence;
    const proxyGate = payload?.proxyCompactionGate;
    const transition = payload?.chartTransition ?? null;
    if (
      !refs?.device
      || typeof refs.acquirePresentationConsumer !== 'function'
      || typeof refs.destroy !== 'function'
      || identity?.authoritative !== true
      || identity.laneId !== payload.laneId
      || identity.stateKey !== payload.stateKey
      || String(identity.leaseId) !== String(payload.leaseId)
      || identity.taskId !== result.computeTaskId
      || result.computeTaskId !== result.commitDelta?.taskId
      || payload.producerTaskId !== result.computeTaskId
      || payload.frameLeaseId !== refs.frameMutationCandidate?.leaseId
      || payload.frameLeaseEpoch !== refs.frameMutationCandidate?.leaseEpoch
      || refs.frameMutationCandidate?.generationId !== payload.targetGenerationId
      || refs.gpuDrawRange?.generationId !== payload.targetGenerationId
      || proxyEvidence?.schema !== ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA
      || proxyEvidence.device !== refs.device
      || proxyEvidence.generationId !== payload.targetGenerationId
      || proxyEvidence.leaseId !== refs.frameMutationCandidate?.leaseId
      || proxyEvidence.inputProxyCount !== payload.contactProxyCount
      || proxyGate?.schema !== proxyEvidence.schema
      || proxyGate.generationId !== proxyEvidence.generationId
      || proxyGate.inputProxyCount !== proxyEvidence.inputProxyCount
      || proxyGate.outputCapacity !== proxyEvidence.outputCapacity
      || proxyGate.failedCompactionProducesZeroIndirectInstances !== true
      || proxyGate.readbackRequiredForAdmission !== false
      || refs.localContactProxySource?.device !== refs.device
      || !refs.localContactProxySource?.buffer
      || refs.localContactProxySource?.proxyCount !== payload.contactProxyCount
      || refs.localContactProxySource?.chartId !== payload.chartId
      || refs.localContactProxySource?.levelId !== payload.levelId
      || refs.localContactProxySource?.hierarchyGeneration !== payload.hierarchyGeneration
      || refs.localContactProxySource?.positionEpoch !== payload.targetPositionEpoch
      || refs.localContactProxySource?.topologyGeneration !== payload.topologyGeneration
      || refs.localContactProxySource?.ordering
        !== 'stable-gpu-radix-unique-body-id-proxy-id'
      || refs.localContactProxySource?.orderingEvidence !== proxyEvidence
      || refs.worldContactProxies?.chartId !== payload.chartId
      || refs.worldContactProxies?.levelId !== payload.levelId
      || refs.worldContactProxies?.hierarchyGeneration !== payload.hierarchyGeneration
      || refs.worldContactProxies?.positionEpoch !== payload.targetPositionEpoch
      || refs.worldContactProxies?.device !== refs.device
      || refs.worldContactProxies?.proxyCount !== payload.contactProxyCount
      || refs.restMesh?.device !== refs.device
      || refs.restMesh?.geometryKey !== payload.geometryKey
      || refs.restMesh?.topologyGeneration !== payload.topologyGeneration
      || refs.shapeCarrier?.geometryKey !== payload.geometryKey
      || refs.shapeCarrier?.topologyGeneration !== payload.topologyGeneration
      || refs.gpuDrawRange?.frameSource?.buffer !== refs.frameMutationCandidate?.buffer
      || refs.gpuDrawRange?.geometryKey !== payload.geometryKey
      || refs.gpuDrawRange?.topologyGeneration !== payload.topologyGeneration
      || (transition && (
        transition.schema !== ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA
        || transition !== result.chartTransition
        || transition.targetChartId !== payload.chartId
        || transition.targetLevelId !== payload.levelId
        || transition.targetHierarchyGeneration !== payload.hierarchyGeneration
        || transition.targetPositionEpoch !== payload.targetPositionEpoch
        || transition.geometryKey !== payload.geometryKey
        || transition.topologyGeneration !== payload.topologyGeneration
      ))
    ) {
      abortComputeResult(result);
      throw new Error('coherent-solid local retained refs do not match the committed warm delta');
    }
    const previousPublication = admissionByStateKey.get(payload.stateKey) || null;
    const admissionId = positiveAdmissionId(
      `${payload.stateKey}:${payload.targetGenerationId}:${payload.leaseId}`
    );
    const hotBufferKey = `ulg:coherent-solid:${payload.stateKey}:${payload.targetGenerationId}`;
    const frameSource = Object.freeze({
      ...refs.frameMutationCandidate,
      schema: ULG_COHERENT_SOLID_FRAME_SCHEMA,
      status: 'state-manager-admitted-coherent-solid-frame',
      authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED,
      stateManagerAdmissionId: admissionId,
      admissionTaskId: result.commitDelta.taskId,
      admissionScope: result.commitDelta.scope,
      chartId: payload.chartId,
      levelId: payload.levelId,
      hierarchyGeneration: payload.hierarchyGeneration,
      positionEpoch: payload.targetPositionEpoch,
      thirdLevelHold: true
    });
    const shapeCarrier = Object.freeze({
      ...refs.shapeCarrier,
      schema: ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
      status: 'state-manager-admitted-coherent-solid-shape-carrier',
      authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED,
      stateManagerAdmissionId: admissionId,
      admissionTaskId: result.commitDelta.taskId,
      generationId: payload.targetGenerationId,
      chartId: payload.chartId,
      levelId: payload.levelId,
      hierarchyGeneration: payload.hierarchyGeneration,
      positionEpoch: payload.targetPositionEpoch
    });
    const localContactProxySource = Object.freeze({
      ...refs.localContactProxySource,
      schema: ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
      authorityStatus: COHERENT_SOLID_DERIVED_ADMITTED,
      stateManagerAdmissionId: admissionId,
      admissionTaskId: result.commitDelta.taskId,
      chartId: payload.chartId,
      levelId: payload.levelId,
      hierarchyGeneration: payload.hierarchyGeneration,
      positionEpoch: payload.targetPositionEpoch,
      thirdLevelHold: true
    });
    const drawGroup = Object.freeze({
      schema: ULG_COHERENT_SOLID_DRAW_GROUP_SCHEMA,
      status: 'state-manager-admitted-solid-draw-group',
      authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED,
      stateManagerAdmissionId: admissionId,
      publicationGeneration: payload.targetGenerationId,
      componentGeneration: 0,
      generationId: payload.targetGenerationId,
      leaseId: frameSource.leaseId,
      leaseEpoch: frameSource.leaseEpoch,
      topologyGeneration: payload.topologyGeneration,
      geometryKey: payload.geometryKey,
      frameSource,
      restMesh: refs.restMesh,
      shapeCarrier,
      gpuDrawRange: refs.gpuDrawRange,
      opacity,
      exposure,
      renderOrder,
      depthWriteFlag,
      presentationOwnsPhysicsCadence: false
    });
    const admission = Object.freeze({
      schema: ULG_COHERENT_SOLID_STATE_MANAGER_ADMISSION_SCHEMA,
      status: 'coherent-solid-state-manager-admission-committed',
      accepted: true,
      committed: true,
      authority: nodeKernel ? 'nodekernel-state-manager' : 'state-manager-local-authority',
      nodeId: nodeKernel?.nodeId || null,
      stateKey: payload.stateKey,
      laneId: payload.laneId,
      leaseId: payload.leaseId,
      admissionId,
      publicationGeneration: payload.targetGenerationId,
      taskId: result.commitDelta.taskId,
      scope: result.commitDelta.scope,
      hotBufferKey,
      warmEntryVersion: warm.warmEntryVersion,
      warmEntryTimestamp: warm.warmEntryTimestamp,
      frameSource,
      worldContactProxies: refs.worldContactProxies,
      bodyInvariants: refs.bodyInvariants,
      invariantEvidence: refs.invariantEvidence,
      proxyCompactionEvidence: proxyEvidence,
      localContactProxySource,
      restMesh: refs.restMesh,
      chartTransition: transition,
      restShapeContinuity: Object.freeze({
        geometryKey: payload.geometryKey,
        topologyGeneration: payload.topologyGeneration,
        sameDevice: refs.restMesh?.device === refs.device,
        preservedAcrossChartTransition: transition?.preserveRestShape === true || !transition
      }),
      drawGroup,
      replacesPublicationGeneration: previousPublication?.publicationGeneration ?? null
    });
    const publication = Object.freeze({
      schema: ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA,
      status: 'state-manager-admitted-solid-draw-entries',
      authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED,
      device: refs.device,
      admissionId,
      publicationGeneration: payload.targetGenerationId,
      sourceEpoch: payload.targetPositionEpoch,
      stateKey: payload.stateKey,
      laneId: payload.laneId,
      leaseIdentity: identity,
      chartId: payload.chartId,
      levelId: payload.levelId,
      hierarchyGeneration: payload.hierarchyGeneration,
      chartTransition: transition,
      localContactProxySource,
      worldContactProxies: refs.worldContactProxies,
      proxyCompactionEvidence: proxyEvidence,
      restMesh: refs.restMesh,
      stateManagerAdmission: admission,
      drawGroups: Object.freeze([drawGroup]),
      entries: Object.freeze([]),
      presentationOwnsPhysicsCadence: false,
      replacesPublicationGeneration: previousPublication?.publicationGeneration ?? null,
      rolloverPolicy: 'presentation-consumer-fenced-single-live-publication-two-slot-ping-pong'
    });
    const hotRecord = {
      schema: PUBLICATION_HOT_BUFFER_SCHEMA,
      status: 'coherent-solid-local-retained-refs-admitted',
      hotBufferKey,
      stateKey: payload.stateKey,
      admission,
      publication,
      commitDelta: result.commitDelta,
      localRetainedRefs: refs,
      retainedBufferRefs: [...payload.retainedBufferRefs]
    };
    try {
      presentationLeases.register(publication, { localRetainedRefs: refs });
      stateManager.setHotBuffer(hotBufferKey, hotRecord);
    } catch (error) {
      presentationLeases.retire(publication, {
        reason: 'coherent-solid-publication-admission-failed'
      });
      abortComputeResult(result);
      throw error;
    }
    admissionByStateKey.set(payload.stateKey, publication);
    admittedPublications.add(publication);
    activePublications.add(publication);
    registerPublicationSourceBundle(publication, {
      frameSource,
      memberSource: refs.memberSource,
      membershipSource: refs.membershipSource,
      localContactProxySource,
      restMesh: refs.restMesh,
      shapeCarrier
    });
    publicationByComputeResult.set(result, publication);
    pendingComputeResults.delete(result);
    trackDevice(refs.device);
    if (previousPublication && previousPublication !== publication) {
      retirePublicationRecord(previousPublication, { replacedBy: publication });
    }
    return publication;
  }

  function validateDrawPublication(publication) {
    if (!admittedPublications.has(publication)) return null;
    if (terminalDevices.has(publication.device)) return null;
    const admission = publication.stateManagerAdmission;
    const hotRecord = stateManager.getHotBuffer(admission.hotBufferKey);
    if (
      hotRecord?.publication !== publication
      || hotRecord.admission !== admission
      || admission.committed !== true
    ) {
      return null;
    }
    const warm = readResidentStepsCommittedWarmDelta(stateManager, {
      delta: hotRecord.commitDelta,
      acceptedScopes: [COHERENT_SOLID_RESIDENT_COMMIT_SCOPE],
      requireFenceSatisfied: true
    });
    return warm.accepted && warm.warmEntryFound ? publication : null;
  }

  async function submitFrameTask(options = {}) {
    assertControllerLive();
    const stateKey = String(options.stateKey ?? '').trim();
    const currentPublication = admissionByStateKey.get(stateKey) || null;
    if (
      !currentPublication
      || validateDrawPublication(currentPublication) !== currentPublication
    ) {
      throw new Error('coherent-solid frame task requires the current live publication');
    }
    const sourceBundle = sourceBundleByPublication.get(currentPublication) || null;
    const sourceValidation = validateCoherentSolidCurrentSourceBundle({
      publication: currentPublication,
      sourceBundle,
      options
    });
    if (!sourceValidation.accepted) {
      throw new Error(`coherent-solid current source bundle rejected: ${sourceValidation.reason}`);
    }
    const taskOptions = {
      ...options,
      device: currentPublication.device,
      stateKey: currentPublication.stateKey,
      laneId: currentPublication.laneId,
      sourceFamily: currentPublication.leaseIdentity.sourceFamily,
      targetGenerationId: sourceValidation.targetGenerationId,
      sourcePositionEpoch: sourceValidation.sourcePositionEpoch,
      targetPositionEpoch: sourceValidation.targetPositionEpoch
    };
    trackDevice(currentPublication.device);
    const result = await computeManager.submitTask(createCoherentSolidFrameComputeTask(taskOptions));
    if (result && typeof result === 'object') {
      completedComputeResults.add(result);
      pendingComputeResults.add(result);
    }
    if (terminalDevices.has(currentPublication.device)) {
      abortComputeResult(result);
      throw new Error('coherent-solid frame task device is terminal');
    }
    const publication = await admitTaskResult(result, options.presentation || {});
    return {
      result,
      publication,
      localContactProxySource: publication.localContactProxySource,
      shapeCarrier: publication.drawGroups[0].shapeCarrier
    };
  }

  return {
    status: 'coherent-solid-authority-controller-ready',
    admitInitialState,
    submitFrameTask,
    admitTaskResult,
    validateDrawPublication,
    acquireDrawPublicationPresentationLease(publication, options = {}) {
      if (validateDrawPublication(publication) !== publication) return null;
      return presentationLeases.acquire(publication, options);
    },
    validateDrawPublicationPresentationLease(publication, lease) {
      return presentationLeases.validate(publication, lease);
    },
    getDrawPublicationPresentationLeaseState(publication) {
      return presentationLeases.snapshot(publication);
    },
    getPublication(stateKey) {
      return admissionByStateKey.get(String(stateKey)) || null;
    },
    async retirePublication(publication) {
      assertControllerLive();
      if (!admittedPublications.has(publication)) return false;
      return retirePublicationRecord(publication);
    },
    terminateDevice(device, reason = 'coherent-solid-device-lost') {
      return terminateAuthorityDevice(device, reason);
    },
    getDeviceTerminalEvidence(device) {
      return deviceTerminalEvidence.get(device) || null;
    },
    destroy({ reason = 'coherent-solid-authority-controller-destroyed' } = {}) {
      if (destroyed) {
        return Object.freeze({
          schema: 'peercompute.ulg.coherent-solid-authority-controller-destroy.v0',
          status: 'coherent-solid-authority-controller-already-destroyed',
          reason,
          retiredPublicationCount: 0,
          abortedResultCount: 0,
          destroyedCacheCount: 0
        });
      }
      destroyed = true;
      let retiredPublicationCount = 0;
      let abortedResultCount = 0;
      let destroyedCacheCount = 0;
      for (const publication of [...activePublications]) {
        if (retirePublicationRecord(publication)) retiredPublicationCount += 1;
      }
      for (const result of [...pendingComputeResults]) {
        if (abortComputeResult(result)) abortedResultCount += 1;
      }
      for (const device of devices) {
        destroyedCacheCount += destroyCoherentSolidResidentLaneCaches(device);
      }
      return Object.freeze({
        schema: 'peercompute.ulg.coherent-solid-authority-controller-destroy.v0',
        status: 'coherent-solid-authority-controller-destroyed',
        reason,
        retiredPublicationCount,
        abortedResultCount,
        destroyedCacheCount
      });
    }
  };
}
