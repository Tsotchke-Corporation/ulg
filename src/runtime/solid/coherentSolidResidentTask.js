import {
  COHERENT_SOLID_DERIVED_ADMITTED,
  COHERENT_SOLID_FRAME_WORDS,
  COHERENT_SOLID_STATE_MANAGER_ADMITTED,
  ULG_COHERENT_SOLID_COMMIT_DELTA_SCHEMA,
  ULG_COHERENT_SOLID_COMPUTE_TASK_RESULT_SCHEMA,
  ULG_COHERENT_SOLID_COMPUTE_TASK_SCHEMA,
  ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
  ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_SCHEMA,
  ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
  ULG_COHERENT_SOLID_LOCAL_RETAINED_REFS_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_SCHEMA,
  ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA,
  ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
  ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
  ULG_COHERENT_SOLID_STATE_DELTA_SCHEMA
} from '../../../ulg-gpu-abi/src/coherentSolid.js';
import {
  COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE,
  createCoherentSolidFrameGpuPlan
} from './coherentSolidFrameGpu.js';
import { COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE } from './coherentSolidResidentGpu.js';
import { acquireCoherentSolidResidentLaneRuntime } from './coherentSolidResidentLaneCache.js';
import {
  createWebGpuTimestampProfiler,
  summarizeWebGpuBufferAllocations
} from '../webgpuTimestampProfiler.js';

export const COHERENT_SOLID_RESIDENT_TASK_MODULE_PATH =
  '/src/runtime/solid/coherentSolidResidentTask.js';
export const COHERENT_SOLID_RESIDENT_COMMIT_SCOPE = 'ulg-coherent-solid-frame';
export const COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY = 'ulg-coherent-solid-bootstrap-validation';
export const PEERCOMPUTE_GPU_RESIDENT_LANE_LEASE_IDENTITY_SCHEMA =
  'peercompute.compute.gpu-resident-lane-lease-identity.v0';

const RETAINED_BUFFER_REFS = Object.freeze([
  'coherent-solid-frame-buffer',
  'coherent-solid-member-buffer',
  'coherent-solid-world-contact-proxy-buffer',
  'coherent-solid-body-invariant-buffer',
  'coherent-solid-invariant-evidence-buffer',
  'coherent-solid-proxy-compaction-evidence-buffer',
  'coherent-solid-draw-instance-index-buffer',
  'coherent-solid-draw-indexed-indirect-buffer'
]);

const TIMESTAMP_UNSUPPORTED_STATUSES = new Set([
  'unsupported',
  'unsupported-api',
  'allocation-failed'
]);

function coherentSolidTimestampCoverage(profile, {
  proxyCount = 0,
  proxyOrderReused = false
} = {}) {
  const requiredStageLabels = [
    COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.adaptMemberWrenches,
    COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.wrenchReduce,
    COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.integrate,
    COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.transformMembers,
    COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.invariantReduce,
    COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.invariantFinalize,
    COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.failClose,
    COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.directDrawInitialize,
    COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.directDrawCompact
  ];
  if (proxyCount > 0) {
    requiredStageLabels.push(
      COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.proxyPrepare,
      COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.proxyTransform,
      COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.proxyFinalize
    );
    if (!proxyOrderReused) {
      requiredStageLabels.push(COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.proxyKeyBuild);
    }
  }
  const validLabels = new Set((profile?.spans || [])
    .filter((span) => span?.valid === true)
    .map((span) => span.label));
  const missingStageLabels = requiredStageLabels.filter((label) => !validLabels.has(label));
  const radixRequired = proxyCount > 0 && !proxyOrderReused;
  const radixPresent = !radixRequired || (profile?.spans || []).some((span) => (
    span?.valid === true && span?.metadata?.coherentSolidStage === 'contact-proxy-radix'
  ));
  if (!radixPresent) missingStageLabels.push('coherentSolidContactProxyRadix');
  return Object.freeze({
    schema: 'peercompute.ulg.coherent-solid-gpu-timestamp-coverage.v0',
    status: missingStageLabels.length === 0
      ? 'coherent-solid-required-gpu-stages-attributed'
      : 'coherent-solid-required-gpu-stages-missing',
    requiredStageLabels,
    missingStageLabels,
    radixRequired,
    radixPresent
  });
}

function nonEmpty(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} must be non-empty`);
  return text;
}

function u32(value, label, { min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > 0xffffffff) {
    throw new RangeError(`${label} must be a u32`);
  }
  return number;
}

function validateLeaseIdentity(identity, {
  laneId,
  stateKey,
  sourceFamily,
  taskId
} = {}) {
  if (
    identity?.schema !== PEERCOMPUTE_GPU_RESIDENT_LANE_LEASE_IDENTITY_SCHEMA
    || identity.authoritative !== true
  ) {
    throw new Error('coherent-solid task requires authoritative ComputeManager lane lease identity');
  }
  for (const [label, expected] of Object.entries({ laneId, stateKey, sourceFamily, taskId })) {
    if (identity[label] !== expected) {
      throw new Error(`coherent-solid task ${label} does not match its ComputeManager lease`);
    }
  }
  return Object.freeze({ ...identity });
}

export function createCoherentSolidChartTransition({
  sourceChartId,
  sourceLevelId,
  sourceHierarchyGeneration,
  sourcePositionEpoch,
  targetChartId,
  targetLevelId,
  targetHierarchyGeneration,
  targetPositionEpoch,
  geometryKey,
  topologyGeneration,
  proxyGenerationId
} = {}) {
  return Object.freeze({
    schema: ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA,
    sourceChartId: Number(sourceChartId),
    sourceLevelId: Number(sourceLevelId),
    sourceHierarchyGeneration: Number(sourceHierarchyGeneration),
    sourcePositionEpoch: Number(sourcePositionEpoch),
    targetChartId: Number(targetChartId),
    targetLevelId: Number(targetLevelId),
    targetHierarchyGeneration: Number(targetHierarchyGeneration),
    targetPositionEpoch: Number(targetPositionEpoch),
    geometryKey: Number(geometryKey),
    topologyGeneration: Number(topologyGeneration),
    proxyGenerationId: Number(proxyGenerationId),
    preserveWorldPose: true,
    preserveWorldMomentum: true,
    preserveRestShape: true,
    preserveContactIdentity: true,
    thirdLevelHold: true
  });
}

function resolveChartTransition({
  frameSource,
  chartId,
  levelId,
  hierarchyGeneration,
  sourcePositionEpoch,
  targetPositionEpoch,
  restMesh,
  localContactProxySource,
  chartTransition
}) {
  const sourceChartId = Number(frameSource?.chartId ?? 0);
  const sourceLevelId = Number(frameSource?.levelId ?? 0);
  const sourceHierarchyGeneration = Number(frameSource?.hierarchyGeneration ?? 0);
  const changed = chartId !== sourceChartId
    || levelId !== sourceLevelId
    || hierarchyGeneration !== sourceHierarchyGeneration;
  if (targetPositionEpoch !== sourcePositionEpoch + 1) {
    throw new RangeError('coherent-solid position epoch must advance exactly once per task');
  }
  if (![0, 1].includes(sourceLevelId) || ![0, 1].includes(levelId)) {
    throw new RangeError('coherent-solid chart transition supports the admitted two SS levels only');
  }
  if (hierarchyGeneration < sourceHierarchyGeneration) {
    throw new RangeError('coherent-solid hierarchy generation cannot move backward');
  }
  if (!changed) return { enabled: false, descriptor: null };
  if (
    chartTransition?.schema !== ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA
    || chartTransition.sourceChartId !== sourceChartId
    || chartTransition.sourceLevelId !== sourceLevelId
    || chartTransition.sourceHierarchyGeneration !== sourceHierarchyGeneration
    || chartTransition.sourcePositionEpoch !== sourcePositionEpoch
    || chartTransition.targetChartId !== chartId
    || chartTransition.targetLevelId !== levelId
    || chartTransition.targetHierarchyGeneration !== hierarchyGeneration
    || chartTransition.targetPositionEpoch !== targetPositionEpoch
    || chartTransition.geometryKey !== restMesh?.geometryKey
    || chartTransition.topologyGeneration !== restMesh?.topologyGeneration
    || chartTransition.proxyGenerationId !== localContactProxySource?.generationId
    || chartTransition.preserveWorldPose !== true
    || chartTransition.preserveWorldMomentum !== true
    || chartTransition.preserveRestShape !== true
    || chartTransition.preserveContactIdentity !== true
    || chartTransition.thirdLevelHold !== true
  ) {
    throw new TypeError('coherent-solid chart transition descriptor does not match its admitted source and target');
  }
  return {
    enabled: true,
    descriptor: Object.freeze({
      ...chartTransition,
      status: 'gpu-chart-transition-awaiting-state-manager-admission'
    })
  };
}

function beginGpuErrorScopes(device) {
  const supported = typeof device?.pushErrorScope === 'function'
    && typeof device?.popErrorScope === 'function';
  const scopes = supported ? ['validation', 'out-of-memory', 'internal'] : [];
  for (const scope of scopes) device.pushErrorScope(scope);
  let finished = false;
  let result = null;
  return async function finishGpuErrorScopes() {
    if (finished) return result;
    finished = true;
    const errors = [];
    for (const scope of [...scopes].reverse()) {
      const error = await device.popErrorScope();
      if (error) errors.push({ scope, message: error.message || String(error) });
    }
    result = errors;
    return errors;
  };
}

function descriptorOnlyCommitDelta({
  taskId,
  stateKey,
  identity,
  frameSource,
  targetGenerationId,
  bodyCount,
  memberCount,
  proxyCount,
  chartId,
  levelId,
  hierarchyGeneration,
  sourcePositionEpoch,
  targetPositionEpoch,
  restMesh,
  shapeCarrier,
  gpuFence,
  chartTransition,
  executionShape,
  proxyCompactionEvidence
}) {
  const timestamp = Date.now();
  return {
    schema: ULG_COHERENT_SOLID_COMMIT_DELTA_SCHEMA,
    taskId,
    scope: COHERENT_SOLID_RESIDENT_COMMIT_SCOPE,
    version: targetGenerationId,
    timestamp,
    payload: {
      schema: ULG_COHERENT_SOLID_STATE_DELTA_SCHEMA,
      status: 'coherent-solid-gpu-candidate-awaiting-state-manager-admission',
      stateKey,
      laneId: identity.laneId,
      leaseId: identity.leaseId,
      producerTaskId: taskId,
      frameLeaseId: frameSource.leaseId,
      frameLeaseEpoch: frameSource.leaseEpoch,
      sourceFamily: identity.sourceFamily,
      sourceGenerationId: frameSource.generationId,
      targetGenerationId,
      bodyCount,
      memberCount,
      contactProxyCount: proxyCount,
      sourceChartId: frameSource.chartId ?? 0,
      sourceLevelId: frameSource.levelId ?? 0,
      sourceHierarchyGeneration: frameSource.hierarchyGeneration ?? 0,
      chartId,
      levelId,
      hierarchyGeneration,
      sourcePositionEpoch,
      targetPositionEpoch,
      thirdLevelHold: true,
      geometryKey: restMesh.geometryKey,
      topologyGeneration: restMesh.topologyGeneration,
      shapeCarrierType: shapeCarrier.carrierType,
      chartTransition,
      executionShape,
      proxyCompactionGate: {
        schema: proxyCompactionEvidence.schema,
        generationId: proxyCompactionEvidence.generationId,
        inputProxyCount: proxyCompactionEvidence.inputProxyCount,
        outputCapacity: proxyCompactionEvidence.outputCapacity,
        evidenceByteLength: proxyCompactionEvidence.byteLength,
        ordering: proxyCompactionEvidence.ordering,
        failedCompactionProducesZeroIndirectInstances: true,
        readbackRequiredForAdmission: false
      },
      retainedBufferRefs: [...RETAINED_BUFFER_REFS],
      gpuFence,
      invariantGate: {
        mode: 'gpu-resident-fail-closed-consumer-gate',
        evidenceSchema: 'peercompute.ulg.schroeder-solid-invariant-evidence.v0',
        evidenceByteLength: 128,
        readbackRequiredForAdmission: false,
        failedBodiesProduceZeroIndirectInstances: true,
        candidateFramesFailClosedOnGlobalRejection: true,
        consumerGate: 'frame-row-status-consumed-by-next-step-and-indirect-draw'
      },
      copyBudget: {
        uploadBytes: 0,
        readbackBytes: 0,
        compactSummaryBytes: 0,
        fullStateReadbackBytes: 0
      },
      rawGpuBufferTransferDetected: false,
      authoritativeMutation: 'state-manager-admitted-after-committed-warm-delta'
    }
  };
}

function createTaskDescriptor({
  modulePath = COHERENT_SOLID_RESIDENT_TASK_MODULE_PATH,
  taskId = null,
  solverId = 'ulg-coherent-solid-frame',
  owner = 'ulg-coherent-solid-frame',
  laneId = 'ulg:coherent-solid:active',
  stateKey = 'ulg:coherent-solid-state',
  domainKey = 'coherent-solid',
  sourceFamily = 'coherent-solid-frame',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  taskFamily = 'ulg-coherent-solid-frame',
  exportName = 'runCoherentSolidFrameComputeTask',
  idPrefix = 'ulg-coherent-solid-frame',
  ...data
} = {}) {
  const frameSource = data.frameSource;
  const id = taskId || `${idPrefix}:${stateKey}:${frameSource.generationId + 1}`;
  const leaseId = String(frameSource.leaseId);
  const readFamilies = ['coherent-solid-frame', 'coherent-solid-members', 'coherent-solid-contact-proxies'];
  const writeFamilies = ['coherent-solid-frame', 'coherent-solid-world-contact-proxies', 'coherent-solid-draw-range'];
  const gpuResidentLane = {
    laneId,
    stateKey,
    sourceFamily,
    domainKey,
    solverId,
    taskId: id,
    owner,
    leaseId,
    localExecution: 'inline',
    queueFencePolicy,
    readFamilies,
    writeFamilies,
    retainedBufferRefs: [...RETAINED_BUFFER_REFS],
    copyBudget: { uploadBytes: 0, readbackBytes: 0, compactSummaryBytes: 0 }
  };
  return {
    schema: ULG_COHERENT_SOLID_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: nonEmpty(modulePath, 'modulePath'),
    exportName,
    returnEnvelope: true,
    suppressCommitDelta: false,
    residency: 'gpu-lane',
    localExecution: 'inline',
    readFamilies,
    writeFamilies,
    expectedOutputFamilies: writeFamilies,
    gpuResidentLane,
    gpuFence: {
      required: true,
      laneId,
      stateKey,
      queueFencePolicy,
      retainedBufferRefs: [...RETAINED_BUFFER_REFS]
    },
    webgpu: {
      residency: 'gpu-lane',
      requiresQueueFence: true,
      laneId,
      stateKey,
      domainKey,
      sourceFamily,
      retainedBufferRefs: [...RETAINED_BUFFER_REFS]
    },
    data: {
      ...data,
      computeTaskId: id,
      solverId,
      laneId,
      stateKey,
      domainKey,
      sourceFamily,
      queueFencePolicy,
      retainedBufferRefs: [...RETAINED_BUFFER_REFS]
    }
  };
}

export function createCoherentSolidFrameComputeTask(options = {}) {
  const frameSource = options.frameSource;
  if (
    frameSource?.schema !== ULG_COHERENT_SOLID_FRAME_SCHEMA
    || frameSource.authorityStatus !== COHERENT_SOLID_STATE_MANAGER_ADMITTED
  ) {
    throw new TypeError('coherent-solid ComputeManager task requires an admitted frame source');
  }
  return createTaskDescriptor(options);
}

export function createCoherentSolidBootstrapComputeTask(options = {}) {
  const {
    frameSource,
    memberSource,
    membershipSource,
    localContactProxySource,
    restMesh,
    shapeCarrier,
    device
  } = options;
  if (
    frameSource?.schema !== ULG_COHERENT_SOLID_FRAME_SCHEMA
    || memberSource?.schema !== ULG_COHERENT_SOLID_MEMBER_SCHEMA
    || membershipSource?.schema !== ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA
    || localContactProxySource?.schema !== ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA
    || restMesh?.schema !== ULG_COHERENT_SOLID_REST_MESH_SCHEMA
    || shapeCarrier?.schema !== ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA
  ) {
    throw new TypeError('coherent-solid bootstrap requires exact raw GPU source schemas');
  }
  if (
    !device
    || frameSource.device !== device
    || memberSource.device !== device
    || membershipSource.device !== device
    || localContactProxySource.device !== device
    || restMesh.device !== device
  ) {
    throw new TypeError('coherent-solid bootstrap requires one same-device raw GPU source set');
  }
  if (
    memberSource.leaseId !== frameSource.leaseId
    || memberSource.leaseEpoch !== frameSource.leaseEpoch
    || membershipSource.leaseId !== frameSource.leaseId
    || membershipSource.leaseEpoch !== frameSource.leaseEpoch
    || localContactProxySource.leaseId !== frameSource.leaseId
    || localContactProxySource.leaseEpoch !== frameSource.leaseEpoch
  ) {
    throw new RangeError('coherent-solid bootstrap source leases must match');
  }
  return createTaskDescriptor({
    ...options,
    solverId: options.solverId || COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY,
    owner: options.owner || COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY,
    taskFamily: COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY,
    exportName: 'runCoherentSolidBootstrapComputeTask',
    idPrefix: 'ulg-coherent-solid-bootstrap'
  });
}

export async function runCoherentSolidFrameComputeTask(data = {}) {
  const {
    gpuResidentLaneLeaseIdentity,
    computeTaskId,
    laneId,
    stateKey,
    sourceFamily,
    device,
    frameSource,
    memberSource,
    membershipSource,
    particleMemberWrenchSource = null,
    localContactProxySource = null,
    restMesh,
    shapeCarrier,
    targetGenerationId = frameSource?.generationId + 1,
    dtS,
    externalAcceleration = [0, 0, 0],
    tolerances = {},
    finiteMagnitudeLimit = 1e30,
    workgroupSize = 64,
    dispatchWorkgroupLimit = device?.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    proxyOutputLimit = localContactProxySource?.proxyCount ?? 0,
    chartTransition = null,
    chartId = frameSource?.chartId ?? 0,
    levelId = frameSource?.levelId ?? 0,
    hierarchyGeneration = frameSource?.hierarchyGeneration ?? 0,
    sourcePositionEpoch = frameSource?.positionEpoch ?? 0,
    targetPositionEpoch = sourcePositionEpoch + 1,
    measureGpuTimestamps = false
  } = data;
  const identity = validateLeaseIdentity(gpuResidentLaneLeaseIdentity, {
    laneId,
    stateKey,
    sourceFamily,
    taskId: computeTaskId
  });
  if (!device?.createCommandEncoder || !device?.queue?.submit || !device?.queue?.onSubmittedWorkDone) {
    throw new TypeError('coherent-solid ComputeManager task requires its GPUHub lane device');
  }
  const bodyCount = u32(frameSource?.bodyCount, 'frameSource.bodyCount', { min: 1 });
  const memberCount = u32(memberSource?.memberCount, 'memberSource.memberCount', { min: 1 });
  const proxyCount = u32(localContactProxySource?.proxyCount ?? 0, 'contactProxyCount');
  const generation = u32(targetGenerationId, 'targetGenerationId', { min: 1 });
  if (generation !== frameSource.generationId + 1) {
    throw new RangeError('targetGenerationId must advance the admitted frame generation exactly once');
  }
  if (sourcePositionEpoch !== frameSource.positionEpoch) {
    throw new RangeError('sourcePositionEpoch must match the admitted frame position epoch');
  }
  for (const [label, source] of Object.entries({
    memberSource,
    membershipSource,
    localContactProxySource
  })) {
    if (
      source?.leaseId !== frameSource.leaseId
      || source?.leaseEpoch !== frameSource.leaseEpoch
    ) {
      throw new RangeError(`${label} lease must match the admitted frame lease`);
    }
  }
  if (shapeCarrier?.geometryKey !== restMesh?.geometryKey
    || shapeCarrier?.topologyGeneration !== restMesh?.topologyGeneration) {
    throw new TypeError('shape carrier and rest mesh topology identity must match');
  }
  const transition = resolveChartTransition({
    frameSource,
    chartId,
    levelId,
    hierarchyGeneration,
    sourcePositionEpoch,
    targetPositionEpoch,
    restMesh,
    localContactProxySource,
    chartTransition
  });
  const proxyOrderReused = localContactProxySource?.ordering
      === 'stable-gpu-radix-unique-body-id-proxy-id'
    && localContactProxySource?.orderingEvidence?.schema
      === ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA;
  const finishGpuErrorScopes = beginGpuErrorScopes(device);
  let frameRuntime = null;
  let residentRuntime = null;
  let cacheLease = null;
  let prepared = null;
  let frameExecution = null;
  let outputs = null;
  let plan = null;
  let gpuTimestampProfile = null;
  let gpuTimestampCoverage = null;
  let gpuAllocationEvidence = null;
  const gpuTimestampProfiler = createWebGpuTimestampProfiler(device, {
    requested: Boolean(measureGpuTimestamps),
    label: 'ulg-coherent-solid-compute-manager-task',
    maxSpans: 128
  });
  try {
    plan = createCoherentSolidFrameGpuPlan({
      bodyCapacity: bodyCount,
      memberCapacity: memberCount,
      membershipIndexCapacity: membershipSource?.indexCount,
      arenaByteBudget: data.arenaByteBudget ?? 256 * 1024 * 1024,
      maxBufferSize: device.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY,
      maxStorageBufferBindingSize:
        device.limits?.maxStorageBufferBindingSize ?? Number.POSITIVE_INFINITY,
      maxComputeWorkgroupsPerDimension:
        Math.min(
          device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
          u32(dispatchWorkgroupLimit, 'dispatchWorkgroupLimit', { min: 1 })
        ),
      workgroupSize
    });
    cacheLease = acquireCoherentSolidResidentLaneRuntime({
      device,
      laneId,
      stateKey,
      sourceFamily,
      taskId: computeTaskId,
      frameLeaseId: frameSource.leaseId,
      geometryKey: restMesh.geometryKey,
      topologyGeneration: restMesh.topologyGeneration,
      bodyCapacity: bodyCount,
      memberCapacity: memberCount,
      membershipIndexCapacity: membershipSource?.indexCount,
      contactProxyCapacity: proxyCount,
      workgroupSize: plan.workgroupSize,
      maxComputeWorkgroupsPerDimension: plan.maxComputeWorkgroupsPerDimension,
      plan,
      sourceFrameBuffer: frameSource.buffer,
      targetGenerationId: generation,
      label: 'ulg-coherent-solid-resident-lane'
    });
    frameRuntime = cacheLease.frameRuntime;
    residentRuntime = cacheLease.residentRuntime;
    const encoder = device.createCommandEncoder({
      label: `ulg-coherent-solid-compute-manager-task-${generation}`
    });
    prepared = residentRuntime.encodeInputs(encoder, {
      memberSource,
      particleMemberWrenchSource,
      bodyCount,
      proxyCount,
      sourceGenerationId: frameSource.generationId,
      targetGenerationId: generation,
      leaseId: frameSource.leaseId,
      leaseEpoch: frameSource.leaseEpoch,
      chartId,
      levelId,
      hierarchyGeneration,
      sourceChartId: frameSource.chartId ?? 0,
      sourceLevelId: frameSource.levelId ?? 0,
      sourceHierarchyGeneration: frameSource.hierarchyGeneration ?? 0,
      sourcePositionEpoch,
      targetPositionEpoch,
      geometryKey: restMesh.geometryKey,
      topologyGeneration: restMesh.topologyGeneration,
      indexCount: restMesh.indexCount,
      proxyGenerationId: localContactProxySource?.generationId ?? frameSource.generationId,
      proxyOutputLimit,
      chartTransitionEnabled: transition.enabled,
      proxyOrderReused,
      timestampProfiler: gpuTimestampProfiler,
      timestampMetadata: { computeTaskId, laneId, stateKey }
    });
    frameExecution = frameRuntime.encode(encoder, {
      frameSource,
      memberSource,
      membershipSource,
      memberWrenchSource: prepared.memberWrenchSource,
      targetGenerationId: generation,
      dtS,
      externalAcceleration,
      tolerances,
      finiteMagnitudeLimit,
      targetChartId: chartId,
      targetLevelId: levelId,
      targetHierarchyGeneration: hierarchyGeneration,
      chartTransitionEnabled: transition.enabled,
      timestampProfiler: gpuTimestampProfiler,
      timestampMetadata: { computeTaskId, laneId, stateKey }
    });
    outputs = residentRuntime.encodeOutputs(encoder, {
      prepared,
      frameExecution,
      localContactProxySource,
      restMesh,
      timestampProfiler: gpuTimestampProfiler,
      timestampMetadata: { computeTaskId, laneId, stateKey }
    });
    if (measureGpuTimestamps) gpuTimestampProfiler.encodeResolve(encoder);
    device.queue.submit([encoder.finish()]);
    cacheLease.markSubmitted();
    await device.queue.onSubmittedWorkDone();
    const gpuErrors = await finishGpuErrorScopes();
    if (gpuErrors.length > 0) {
      throw new Error(`coherent-solid GPU task validation failed: ${gpuErrors
        .map(({ scope, message }) => `${scope}: ${message}`)
        .join('; ')}`);
    }
    if (measureGpuTimestamps) {
      gpuTimestampProfile = await gpuTimestampProfiler.read();
      if (!TIMESTAMP_UNSUPPORTED_STATUSES.has(gpuTimestampProfile.status)) {
        gpuTimestampCoverage = coherentSolidTimestampCoverage(gpuTimestampProfile, {
          proxyCount,
          proxyOrderReused
        });
      }
    }
    gpuAllocationEvidence = summarizeWebGpuBufferAllocations([
      ...(frameRuntime?.allocationEntries?.() || []),
      ...(residentRuntime?.allocationEntries?.() || []),
      ...gpuTimestampProfiler.allocationEntries()
    ], { scope: 'coherent-solid-compute-manager-task' });
    frameExecution.releaseTransientBuffers();
    outputs.releaseTransientBuffers();
    residentRuntime.releaseParamsBuffer(prepared.paramsBuffer);
  } catch (error) {
    await finishGpuErrorScopes();
    frameExecution?.releaseTransientBuffers?.();
    outputs?.releaseTransientBuffers?.();
    if (prepared?.paramsBuffer) residentRuntime?.releaseParamsBuffer?.(prepared.paramsBuffer);
    cacheLease?.release?.();
    gpuTimestampProfiler.destroy();
    throw error;
  }
  if (!measureGpuTimestamps) gpuTimestampProfiler.destroy();
  const gpuFence = {
    status: 'queue-work-completed',
    method: 'queue.onSubmittedWorkDone',
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'queue.onSubmittedWorkDone',
    fenceSatisfied: true,
    required: true,
    laneId,
    stateKey,
    retainedBufferRefs: [...RETAINED_BUFFER_REFS]
  };
  const commitDelta = descriptorOnlyCommitDelta({
    taskId: computeTaskId,
    stateKey,
    identity,
    frameSource,
    targetGenerationId: generation,
    bodyCount,
    memberCount,
    proxyCount,
    chartId,
    levelId,
    hierarchyGeneration,
    sourcePositionEpoch,
    targetPositionEpoch,
    restMesh,
    shapeCarrier,
    gpuFence,
    chartTransition: transition.descriptor,
    executionShape: {
      workgroupSize: plan.workgroupSize,
      maxComputeWorkgroupsPerDimension: plan.maxComputeWorkgroupsPerDimension,
      bodyReductionDispatch: frameExecution.params.bodyReductionDispatch,
      bodyLinearDispatch: frameExecution.params.bodyLinearDispatch,
      memberLinearDispatch: frameExecution.params.memberLinearDispatch,
      proxyIndirectDispatch: true
    },
    proxyCompactionEvidence: outputs.proxyCompactionEvidence
  });
  const localRetainedRefs = {
    schema: ULG_COHERENT_SOLID_LOCAL_RETAINED_REFS_SCHEMA,
    status: 'compute-manager-gpuhub-local-retained-refs',
    device,
    leaseIdentity: identity,
    frameMutationCandidate: frameExecution.frameMutationCandidate,
    transformedMembers: frameExecution.transformedMembers,
    bodyWrenches: frameExecution.bodyWrenches,
    bodyInvariants: frameExecution.bodyInvariants,
    invariantEvidence: frameExecution.invariantEvidence,
    worldContactProxies: outputs.worldContactProxies,
    proxyCompactionEvidence: outputs.proxyCompactionEvidence,
    gpuDrawRange: outputs.gpuDrawRange,
    memberSource,
    membershipSource,
    localContactProxySource: outputs.localContactProxySource,
    restMesh,
    shapeCarrier,
    residentLaneCache: Object.freeze({
      ...cacheLease.snapshot(),
      cacheHit: cacheLease.cacheHit,
      slotIndex: cacheLease.slotIndex,
      pipelinesCreatedThisExecution: cacheLease.cacheHit ? 0 : cacheLease.snapshot().pipelineCreationCount,
      retainedBuffersAllocatedThisExecution:
        cacheLease.cacheHit ? 0 : cacheLease.snapshot().retainedBufferAllocationCount
    }),
    getResidentLaneCacheEvidence() {
      return Object.freeze({
        ...cacheLease.snapshot(),
        cacheHit: cacheLease.cacheHit,
        slotIndex: cacheLease.slotIndex
      });
    },
    acquirePresentationConsumer(options = {}) {
      return cacheLease.acquirePresentationConsumer(options);
    },
    destroy() {
      cacheLease.release();
    }
  };
  return {
    schema: ULG_COHERENT_SOLID_COMPUTE_TASK_RESULT_SCHEMA,
    status: 'coherent-solid-frame-candidate-gpu-complete-awaiting-state-manager-admission',
    computeTaskId,
    laneLeaseIdentity: identity,
    sourceGenerationId: frameSource.generationId,
    targetGenerationId: generation,
    bodyCount,
    memberCount,
    contactProxyCount: proxyCount,
    chartId,
    levelId,
    hierarchyGeneration,
    chartTransition: transition.descriptor,
    sourcePositionEpoch,
    targetPositionEpoch,
    thirdLevelHold: true,
    gpuFence,
    gpuFenceReport: gpuFence,
    localRetainedRefs,
    commitDelta,
    queueSubmissionCount: 1,
    residentLaneCache: localRetainedRefs.residentLaneCache,
    gpuTimestampRequested: Boolean(measureGpuTimestamps),
    gpuTimestampProfile,
    gpuTimestampStatus: !measureGpuTimestamps
      ? 'not-requested'
      : (TIMESTAMP_UNSUPPORTED_STATUSES.has(gpuTimestampProfile?.status)
          ? 'inconclusive-unsupported'
          : (gpuTimestampCoverage?.missingStageLabels?.length === 0
              ? 'gpu-attribution-ready'
              : 'gpu-attribution-incomplete')),
    gpuTimestampMappedByteLength: gpuTimestampProfile?.mappedByteLength ?? 0,
    gpuTimestampCoverage,
    gpuAllocationEvidence,
    fullStateReadbackPerformed: false,
    compactEvidenceReadbackPerformed: false,
    cpuMirrorRequired: false
  };
}

export async function runCoherentSolidBootstrapComputeTask(data = {}) {
  const {
    frameSource,
    memberSource,
    membershipSource,
    localContactProxySource,
    chartId = 0,
    levelId = 0,
    hierarchyGeneration = 0,
    positionEpoch = 1
  } = data;
  const provisionalFrame = Object.freeze({
    ...frameSource,
    authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED,
    chartId,
    levelId,
    hierarchyGeneration,
    positionEpoch,
    thirdLevelHold: true
  });
  const provisionalMembers = Object.freeze({
    ...memberSource,
    authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED
  });
  const provisionalMembership = Object.freeze({
    ...membershipSource,
    authorityStatus: COHERENT_SOLID_DERIVED_ADMITTED
  });
  const provisionalContacts = Object.freeze({
    ...localContactProxySource,
    authorityStatus: COHERENT_SOLID_DERIVED_ADMITTED,
    chartId,
    levelId,
    hierarchyGeneration,
    topologyGeneration: data.restMesh?.topologyGeneration,
    positionEpoch,
    thirdLevelHold: true
  });
  const result = await runCoherentSolidFrameComputeTask({
    ...data,
    frameSource: provisionalFrame,
    memberSource: provisionalMembers,
    membershipSource: provisionalMembership,
    localContactProxySource: provisionalContacts,
    particleMemberWrenchSource: null,
    targetGenerationId: frameSource.generationId + 1,
    dtS: 0,
    externalAcceleration: [0, 0, 0],
    sourcePositionEpoch: positionEpoch,
    targetPositionEpoch: positionEpoch + 1
  });
  const evidence = result.localRetainedRefs.invariantEvidence;
  return {
    ...result,
    bootstrapTaskFamily: COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY,
    bootstrapValidation: true,
    bootstrapEvidence: {
      schema: ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
      status: 'compute-manager-gpu-bootstrap-evidence-retained-same-device',
      device: evidence.device,
      buffer: evidence.buffer,
      byteLength: evidence.byteLength,
      generationId: evidence.generationId,
      leaseId: evidence.leaseId,
      leaseEpoch: evidence.leaseEpoch,
      producerTaskId: result.computeTaskId,
      gpuGlobalInvariantFailCloseApplied:
        result.localRetainedRefs.frameMutationCandidate.gpuGlobalInvariantFailCloseApplied === true
    },
    localRetainedRefs: {
      ...result.localRetainedRefs,
      status: 'compute-manager-gpuhub-bootstrap-local-retained-refs'
    },
    commitDelta: {
      ...result.commitDelta,
      payload: {
        ...result.commitDelta.payload,
        status: 'coherent-solid-bootstrap-gpu-candidate-awaiting-state-manager-admission',
        initialState: true,
        bootstrapTaskFamily: COHERENT_SOLID_BOOTSTRAP_TASK_FAMILY,
        bootstrapEvidence: {
          schema: ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
          byteLength: evidence.byteLength,
          generationId: evidence.generationId,
          frameLeaseId: evidence.leaseId,
          leaseEpoch: evidence.leaseEpoch,
          producerTaskId: result.computeTaskId,
          sameDeviceRetained: true,
          gpuGlobalInvariantFailCloseApplied: true,
          consumerGate: 'frame-row-status-consumed-by-next-step-and-indirect-draw'
        }
      }
    }
  };
}
