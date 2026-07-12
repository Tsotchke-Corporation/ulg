import {
  COHERENT_SOLID_BODY_INVARIANT_WORDS,
  COHERENT_SOLID_BODY_WRENCH_WORDS,
  COHERENT_SOLID_DERIVED_ADMITTED,
  COHERENT_SOLID_DEFAULT_TOLERANCES,
  COHERENT_SOLID_FRAME_WORDS,
  COHERENT_SOLID_INVARIANT_EVIDENCE_WORDS,
  COHERENT_SOLID_MEMBER_WORDS,
  COHERENT_SOLID_MEMBER_WRENCH_WORDS,
  COHERENT_SOLID_STATE_MANAGER_ADMITTED,
  COHERENT_SOLID_TRANSFORMED_MEMBER_WORDS,
  ULG_COHERENT_SOLID_BODY_INVARIANT_SCHEMA,
  ULG_COHERENT_SOLID_BODY_WRENCH_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_MUTATION_CANDIDATE_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_GPU_PLAN_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_STEP_EXECUTION_SCHEMA,
  ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_WRENCH_INPUT_SCHEMA,
  ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY,
  ULG_COHERENT_SOLID_TRANSFORMED_MEMBER_SCHEMA
} from '../../../ulg-gpu-abi/src/coherentSolid.js';
import {
  coherentSolidFailCloseFramesWgsl,
  coherentSolidFinalizeEvidenceWgsl,
  coherentSolidIntegrateWgsl,
  coherentSolidInvariantWgsl,
  coherentSolidTransformWgsl,
  coherentSolidWgslForWorkgroupSize,
  coherentSolidWrenchWgsl
} from '../../../ulg-gpu-abi/src/coherentSolidWgsl.js';

export * from '../../../ulg-gpu-abi/src/coherentSolid.js';
export * from '../../../ulg-gpu-abi/src/coherentSolidWgsl.js';

export const COHERENT_SOLID_FRAME_WORKGROUP_SIZE = 64;
export const COHERENT_SOLID_FRAME_DEFAULT_ARENA_BYTES = 256 * 1024 * 1024;
export const COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE = Object.freeze({
  wrenchReduce: 'coherentSolidFrameWrenchReduce',
  integrate: 'coherentSolidFrameIntegrate',
  transformMembers: 'coherentSolidFrameTransformMembers',
  invariantReduce: 'coherentSolidInvariantReduce',
  invariantFinalize: 'coherentSolidInvariantFinalize',
  failClose: 'coherentSolidFrameFailClose'
});

const U32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const PARAM_BYTES = 128;
const U32_MAX = 0xffffffff;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function integer(value, label, { min = 0, max = U32_MAX } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

function positiveFinite(value, label, { allowZero = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) {
    throw new RangeError(`${label} must be ${allowZero ? 'non-negative' : 'positive'} and finite`);
  }
  return number;
}

function alignedBytes(byteLength, alignment = 4) {
  return Math.max(4, Math.ceil(byteLength / alignment) * alignment);
}

function dispatchShapeForGroupCount(groupCount, maxComputeWorkgroupsPerDimension) {
  const groups = integer(groupCount, 'groupCount', { min: 1 });
  const limit = integer(maxComputeWorkgroupsPerDimension, 'maxComputeWorkgroupsPerDimension', {
    min: 1
  });
  const x = Math.min(groups, limit);
  const y = Math.ceil(groups / x);
  if (y > limit) {
    throw new RangeError(`coherent-solid dispatch requires ${groups} groups beyond the 2D limit`);
  }
  return [x, y, 1];
}

function bufferByteLength(buffer) {
  const value = Number(buffer?.size ?? buffer?.byteLength);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function assertBufferSize(buffer, requiredBytes, label) {
  if (!buffer) throw new TypeError(`${label} requires a retained GPUBuffer`);
  const byteLength = bufferByteLength(buffer);
  if (byteLength !== null && byteLength < requiredBytes) {
    throw new RangeError(`${label} requires ${requiredBytes} bytes, received ${byteLength}`);
  }
  return buffer;
}

function assertDevice(device) {
  const methods = [
    'createBuffer',
    'createShaderModule',
    'createComputePipeline',
    'createBindGroup'
  ];
  for (const method of methods) {
    if (typeof device?.[method] !== 'function') {
      throw new TypeError(`coherent-solid runtime requires device.${method}`);
    }
  }
  if (typeof device?.queue?.writeBuffer !== 'function') {
    throw new TypeError('coherent-solid runtime requires device.queue.writeBuffer');
  }
}

function createStorageBuffer(device, label, size) {
  return device.createBuffer({
    label,
    size: alignedBytes(size),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
}

function timestampPassDescriptor(timestampProfiler, label, metadata) {
  return timestampProfiler?.beginComputePassDescriptor
    ? timestampProfiler.beginComputePassDescriptor(label, metadata)
    : { label };
}

function exactArtifact({
  artifact,
  schema,
  label,
  device,
  generationId,
  leaseId,
  leaseEpoch,
  authorityStatus
}) {
  if (artifact?.schema !== schema) {
    throw new TypeError(`${label} must use schema ${schema}`);
  }
  if (artifact.device !== device) {
    throw new TypeError(`${label} must belong to the runtime WebGPU device`);
  }
  if (artifact.generationId !== generationId) {
    throw new RangeError(`${label}.generationId must match its admitted generation`);
  }
  if (artifact.leaseId !== leaseId || artifact.leaseEpoch !== leaseEpoch) {
    throw new RangeError(`${label} lease must match the resident lane lease`);
  }
  if (artifact.authorityStatus !== authorityStatus) {
    throw new RangeError(`${label}.authorityStatus must be ${authorityStatus}`);
  }
  return artifact;
}

export function createCoherentSolidFrameGpuPlan({
  bodyCapacity,
  memberCapacity,
  membershipIndexCapacity = memberCapacity,
  arenaByteBudget = COHERENT_SOLID_FRAME_DEFAULT_ARENA_BYTES,
  maxBufferSize = Number.POSITIVE_INFINITY,
  maxStorageBufferBindingSize = Number.POSITIVE_INFINITY,
  maxComputeWorkgroupsPerDimension = 65535,
  workgroupSize = COHERENT_SOLID_FRAME_WORKGROUP_SIZE
} = {}) {
  const bodies = integer(bodyCapacity, 'bodyCapacity', { min: 1 });
  const members = integer(memberCapacity, 'memberCapacity', { min: 1 });
  const membershipIndices = integer(membershipIndexCapacity, 'membershipIndexCapacity', {
    min: members
  });
  const byteBudget = positiveFinite(arenaByteBudget, 'arenaByteBudget');
  const workgroup = integer(workgroupSize, 'workgroupSize', { min: 16, max: 256 });
  if ((workgroup & (workgroup - 1)) !== 0) {
    throw new RangeError('workgroupSize must be a power of two');
  }
  const candidateFrameByteLength = alignedBytes(bodies * COHERENT_SOLID_FRAME_WORDS * U32_BYTES);
  const transformedMemberByteLength = alignedBytes(
    members * COHERENT_SOLID_TRANSFORMED_MEMBER_WORDS * U32_BYTES
  );
  const bodyWrenchByteLength = alignedBytes(
    bodies * COHERENT_SOLID_BODY_WRENCH_WORDS * U32_BYTES
  );
  const bodyInvariantByteLength = alignedBytes(
    bodies * COHERENT_SOLID_BODY_INVARIANT_WORDS * U32_BYTES
  );
  const invariantEvidenceByteLength = alignedBytes(
    COHERENT_SOLID_INVARIANT_EVIDENCE_WORDS * U32_BYTES
  );
  const retainedArenaBytes = candidateFrameByteLength
    + transformedMemberByteLength
    + bodyWrenchByteLength
    + bodyInvariantByteLength
    + invariantEvidenceByteLength;
  const largestStorageBufferBytes = Math.max(
    candidateFrameByteLength,
    transformedMemberByteLength,
    bodyWrenchByteLength,
    bodyInvariantByteLength,
    invariantEvidenceByteLength,
    alignedBytes(membershipIndices * U32_BYTES)
  );
  const admitted = retainedArenaBytes <= byteBudget
    && largestStorageBufferBytes <= maxBufferSize
    && largestStorageBufferBytes <= maxStorageBufferBindingSize;
  const bodyReductionDispatchCapacity = dispatchShapeForGroupCount(
    bodies,
    maxComputeWorkgroupsPerDimension
  );
  const bodyLinearDispatchCapacity = dispatchShapeForGroupCount(
    Math.ceil(bodies / workgroup),
    maxComputeWorkgroupsPerDimension
  );
  const memberLinearDispatchCapacity = dispatchShapeForGroupCount(
    Math.ceil(members / workgroup),
    maxComputeWorkgroupsPerDimension
  );
  return {
    schema: ULG_COHERENT_SOLID_FRAME_GPU_PLAN_SCHEMA,
    status: admitted
      ? 'coherent-solid-frame-gpu-plan-admitted'
      : 'coherent-solid-frame-gpu-plan-fail-closed',
    admitted,
    bodyCapacity: bodies,
    memberCapacity: members,
    membershipIndexCapacity: membershipIndices,
    workgroupSize: workgroup,
    candidateFrameByteLength,
    transformedMemberByteLength,
    bodyWrenchByteLength,
    bodyInvariantByteLength,
    invariantEvidenceByteLength,
    retainedArenaBytes,
    arenaByteBudget: byteBudget,
    largestStorageBufferBytes,
    bodyReductionDispatchCapacity,
    bodyLinearDispatchCapacity,
    memberLinearDispatchCapacity,
    maxComputeWorkgroupsPerDimension,
    frameStrideWords: COHERENT_SOLID_FRAME_WORDS,
    memberStrideWords: COHERENT_SOLID_MEMBER_WORDS,
    memberWrenchStrideWords: COHERENT_SOLID_MEMBER_WRENCH_WORDS,
    transformedMemberStrideWords: COHERENT_SOLID_TRANSFORMED_MEMBER_WORDS,
    bodyWrenchStrideWords: COHERENT_SOLID_BODY_WRENCH_WORDS,
    bodyInvariantStrideWords: COHERENT_SOLID_BODY_INVARIANT_WORDS,
    evidenceWordCount: COHERENT_SOLID_INVARIANT_EVIDENCE_WORDS,
    integration: 'momentum-first-symplectic-euler-plus-quaternion-exponential-map',
    authority: ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY,
    cpuMirrorRequired: false,
    submissionOwnership: 'caller-compute-manager-lane',
    hotStateReadbackRequired: false
  };
}

export function createCoherentSolidFrameGpuParamsArray(plan, {
  bodyCount,
  memberCount,
  membershipIndexCount,
  sourceGenerationId,
  targetGenerationId,
  memberGenerationId,
  leaseId,
  leaseEpoch,
  dtS,
  externalAcceleration = [0, 0, 0],
  tolerances = {},
  finiteMagnitudeLimit = 1e30,
  targetChartId = 0,
  targetLevelId = 0,
  targetHierarchyGeneration = 0,
  chartTransitionEnabled = false
} = {}) {
  const bodies = integer(bodyCount, 'bodyCount', { min: 1, max: plan.bodyCapacity });
  const members = integer(memberCount, 'memberCount', { min: 1, max: plan.memberCapacity });
  const membershipIndices = integer(membershipIndexCount, 'membershipIndexCount', {
    min: members,
    max: plan.membershipIndexCapacity
  });
  const sourceGeneration = integer(sourceGenerationId, 'sourceGenerationId', {
    max: U32_MAX - 1
  });
  const targetGeneration = integer(targetGenerationId, 'targetGenerationId', {
    min: sourceGeneration + 1
  });
  const memberGeneration = integer(memberGenerationId, 'memberGenerationId');
  const lease = integer(leaseId, 'leaseId');
  const leaseGeneration = integer(leaseEpoch, 'leaseEpoch');
  const timeStep = positiveFinite(dtS, 'dtS', { allowZero: true });
  if (!Array.isArray(externalAcceleration) || externalAcceleration.length !== 3) {
    throw new TypeError('externalAcceleration must be a three-component array');
  }
  const acceleration = externalAcceleration.map((value, index) => (
    positiveFinite(Math.abs(Number(value)), `externalAcceleration[${index}]`, { allowZero: true })
      * Math.sign(Number(value) || 1)
  ));
  const mergedTolerances = { ...COHERENT_SOLID_DEFAULT_TOLERANCES, ...tolerances };
  for (const [name, value] of Object.entries(mergedTolerances)) {
    positiveFinite(value, `tolerances.${name}`);
  }
  const finiteLimit = positiveFinite(finiteMagnitudeLimit, 'finiteMagnitudeLimit');
  const bodyReductionDispatch = dispatchShapeForGroupCount(
    bodies,
    plan.maxComputeWorkgroupsPerDimension
  );
  const bodyLinearDispatch = dispatchShapeForGroupCount(
    Math.ceil(bodies / plan.workgroupSize),
    plan.maxComputeWorkgroupsPerDimension
  );
  const memberLinearDispatch = dispatchShapeForGroupCount(
    Math.ceil(members / plan.workgroupSize),
    plan.maxComputeWorkgroupsPerDimension
  );
  const arrayBuffer = new ArrayBuffer(PARAM_BYTES);
  const view = new DataView(arrayBuffer);
  const setU32 = (index, value) => view.setUint32(index * 4, value, true);
  const setF32 = (index, value) => view.setFloat32(index * 4, value, true);
  setU32(0, bodies);
  setU32(1, members);
  setU32(2, plan.bodyCapacity);
  setU32(3, plan.memberCapacity);
  setU32(4, sourceGeneration);
  setU32(5, targetGeneration);
  setU32(6, lease);
  setU32(7, leaseGeneration);
  setU32(8, membershipIndices);
  setU32(9, bodyReductionDispatch[0]);
  setU32(10, memberLinearDispatch[0]);
  setU32(11, plan.workgroupSize);
  setF32(12, timeStep);
  setF32(13, acceleration[0]);
  setF32(14, acceleration[1]);
  setF32(15, acceleration[2]);
  setF32(16, mergedTolerances.quaternionNorm);
  setF32(17, mergedTolerances.massRelative);
  setF32(18, mergedTolerances.localCenterOfMassM);
  setF32(19, mergedTolerances.inertiaSymmetryKgM2);
  setF32(20, mergedTolerances.inertiaInverse);
  setF32(21, mergedTolerances.memberInertiaRelative);
  setF32(22, mergedTolerances.transformPositionM);
  setF32(23, mergedTolerances.transformVelocityMPerS);
  setF32(24, mergedTolerances.momentumUpdate);
  setF32(25, finiteLimit);
  setU32(26, bodyLinearDispatch[0]);
  setU32(27, memberGeneration);
  view.setInt32(28 * 4, Number(targetChartId), true);
  view.setInt32(29 * 4, Number(targetLevelId), true);
  setU32(30, integer(targetHierarchyGeneration, 'targetHierarchyGeneration'));
  setU32(31, chartTransitionEnabled ? 1 : 0);
  return {
    arrayBuffer,
    bodyCount: bodies,
    memberCount: members,
    membershipIndexCount: membershipIndices,
    sourceGenerationId: sourceGeneration,
    targetGenerationId: targetGeneration,
    memberGenerationId: memberGeneration,
    leaseId: lease,
    leaseEpoch: leaseGeneration,
    dtS: timeStep,
    tolerances: mergedTolerances,
    finiteMagnitudeLimit: finiteLimit,
    targetChartId: Number(targetChartId),
    targetLevelId: Number(targetLevelId),
    targetHierarchyGeneration: Number(targetHierarchyGeneration),
    chartTransitionEnabled: chartTransitionEnabled === true,
    bodyReductionDispatch,
    bodyLinearDispatch,
    memberLinearDispatch
  };
}

function createPipelines(device, label, workgroupSize) {
  const shader = (suffix, code) => device.createShaderModule({
    label: `${label}-${suffix}-shader`,
    code
  });
  const pipeline = (suffix, module, entryPoint) => device.createComputePipeline({
    label: `${label}-${suffix}`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  const variant = (code) => coherentSolidWgslForWorkgroupSize(code, workgroupSize);
  const wrenchModule = shader('wrench', variant(coherentSolidWrenchWgsl));
  const integrateModule = shader('integrate', variant(coherentSolidIntegrateWgsl));
  const transformModule = shader('transform', variant(coherentSolidTransformWgsl));
  const invariantModule = shader('invariant', variant(coherentSolidInvariantWgsl));
  const finalizeModule = shader('finalize', variant(coherentSolidFinalizeEvidenceWgsl));
  const failCloseModule = shader('fail-close', variant(coherentSolidFailCloseFramesWgsl));
  return {
    wrench: pipeline('reduce-wrench', wrenchModule, 'reduce_body_wrench'),
    integrate: pipeline('integrate-frames', integrateModule, 'integrate_frames'),
    transform: pipeline('transform-members', transformModule, 'transform_members'),
    invariant: pipeline('reduce-invariants', invariantModule, 'reduce_body_invariants'),
    finalize: pipeline('finalize-evidence', finalizeModule, 'finalize_evidence'),
    failClose: pipeline('fail-close-frames', failCloseModule, 'fail_close_rejected_frames')
  };
}

export function createCoherentSolidFrameGpu(device, {
  plan,
  label = 'ulg-coherent-solid-frame',
  pipelineBundle = null
} = {}) {
  assertDevice(device);
  if (plan?.schema !== ULG_COHERENT_SOLID_FRAME_GPU_PLAN_SCHEMA) {
    throw new TypeError('createCoherentSolidFrameGpu requires a coherent-solid GPU plan');
  }
  if (!plan.admitted) {
    throw new RangeError('coherent-solid GPU plan is not admitted');
  }
  const pipelines = pipelineBundle || createPipelines(device, label, plan.workgroupSize);
  const candidateFrameBuffer = createStorageBuffer(
    device,
    `${label}-frame-mutation-candidate`,
    plan.candidateFrameByteLength
  );
  const transformedMemberBuffer = createStorageBuffer(
    device,
    `${label}-transformed-members`,
    plan.transformedMemberByteLength
  );
  const bodyWrenchBuffer = createStorageBuffer(
    device,
    `${label}-body-wrenches`,
    plan.bodyWrenchByteLength
  );
  const bodyInvariantBuffer = createStorageBuffer(
    device,
    `${label}-body-invariants`,
    plan.bodyInvariantByteLength
  );
  const invariantEvidenceBuffer = createStorageBuffer(
    device,
    `${label}-invariant-evidence`,
    plan.invariantEvidenceByteLength
  );
  const retainedAllocations = [
    { role: 'frame-mutation-candidate', buffer: candidateFrameBuffer },
    { role: 'transformed-material-members', buffer: transformedMemberBuffer },
    { role: 'body-wrench-reduction', buffer: bodyWrenchBuffer },
    { role: 'per-body-invariants', buffer: bodyInvariantBuffer },
    { role: 'fixed-invariant-evidence', buffer: invariantEvidenceBuffer }
  ];
  const transientParams = new Set();
  let destroyed = false;

  function encode(encoder, {
    frameSource,
    memberSource,
    membershipSource,
    memberWrenchSource,
    targetGenerationId,
    dtS,
    externalAcceleration = [0, 0, 0],
    tolerances = {},
    finiteMagnitudeLimit = 1e30,
    targetChartId = frameSource?.chartId ?? 0,
    targetLevelId = frameSource?.levelId ?? 0,
    targetHierarchyGeneration = frameSource?.hierarchyGeneration ?? 0,
    chartTransitionEnabled = false,
    timestampProfiler = null,
    timestampMetadata = {}
  } = {}) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
      throw new TypeError('coherent-solid encoding requires a caller-owned GPUCommandEncoder');
    }
    const sourceGenerationId = integer(frameSource?.generationId, 'frameSource.generationId', {
      max: U32_MAX - 1
    });
    const leaseId = integer(frameSource?.leaseId, 'frameSource.leaseId');
    const leaseEpoch = integer(frameSource?.leaseEpoch, 'frameSource.leaseEpoch');
    const memberGenerationId = integer(
      memberSource?.generationId,
      'memberSource.generationId'
    );
    const exact = (
      artifact,
      schema,
      artifactLabel,
      authorityStatus,
      expectedGenerationId = sourceGenerationId
    ) => exactArtifact({
      artifact,
      schema,
      label: artifactLabel,
      device,
      generationId: expectedGenerationId,
      leaseId,
      leaseEpoch,
      authorityStatus
    });
    exact(
      frameSource,
      ULG_COHERENT_SOLID_FRAME_SCHEMA,
      'frameSource',
      COHERENT_SOLID_STATE_MANAGER_ADMITTED
    );
    exact(
      memberSource,
      ULG_COHERENT_SOLID_MEMBER_SCHEMA,
      'memberSource',
      COHERENT_SOLID_STATE_MANAGER_ADMITTED,
      memberGenerationId
    );
    exact(
      membershipSource,
      ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
      'membershipSource',
      COHERENT_SOLID_DERIVED_ADMITTED,
      memberGenerationId
    );
    exact(
      memberWrenchSource,
      ULG_COHERENT_SOLID_MEMBER_WRENCH_INPUT_SCHEMA,
      'memberWrenchSource',
      COHERENT_SOLID_DERIVED_ADMITTED
    );
    const bodyCount = integer(frameSource.bodyCount, 'frameSource.bodyCount', {
      min: 1,
      max: plan.bodyCapacity
    });
    const memberCount = integer(memberSource.memberCount, 'memberSource.memberCount', {
      min: 1,
      max: plan.memberCapacity
    });
    if (membershipSource.bodyCount !== bodyCount) {
      throw new RangeError('membershipSource.bodyCount must match frameSource.bodyCount');
    }
    if (memberWrenchSource.memberCount !== memberCount) {
      throw new RangeError('memberWrenchSource.memberCount must match memberSource.memberCount');
    }
    if (frameSource.strideWords !== COHERENT_SOLID_FRAME_WORDS) {
      throw new RangeError('frameSource.strideWords does not match the coherent-solid frame ABI');
    }
    if (memberSource.strideWords !== COHERENT_SOLID_MEMBER_WORDS) {
      throw new RangeError('memberSource.strideWords does not match the coherent-solid member ABI');
    }
    if (memberWrenchSource.strideWords !== COHERENT_SOLID_MEMBER_WRENCH_WORDS) {
      throw new RangeError('memberWrenchSource.strideWords does not match the wrench ABI');
    }
    const membershipIndexCount = integer(
      membershipSource.indexCount,
      'membershipSource.indexCount',
      { min: memberCount, max: plan.membershipIndexCapacity }
    );
    if (membershipIndexCount !== memberCount || membershipSource.exactPartition !== true) {
      throw new RangeError(
        'membershipSource must be an admitted exact one-body-per-member partition'
      );
    }
    const frameBuffer = assertBufferSize(
      frameSource.buffer,
      bodyCount * COHERENT_SOLID_FRAME_WORDS * U32_BYTES,
      'frameSource.buffer'
    );
    const memberBuffer = assertBufferSize(
      memberSource.buffer,
      memberCount * COHERENT_SOLID_MEMBER_WORDS * U32_BYTES,
      'memberSource.buffer'
    );
    const offsetBuffer = assertBufferSize(
      membershipSource.offsetBuffer,
      (bodyCount + 1) * U32_BYTES,
      'membershipSource.offsetBuffer'
    );
    const indexBuffer = assertBufferSize(
      membershipSource.indexBuffer,
      membershipIndexCount * U32_BYTES,
      'membershipSource.indexBuffer'
    );
    const memberWrenchInputBuffer = assertBufferSize(
      memberWrenchSource.buffer,
      memberCount * COHERENT_SOLID_MEMBER_WRENCH_WORDS * U32_BYTES,
      'memberWrenchSource.buffer'
    );
    const params = createCoherentSolidFrameGpuParamsArray(plan, {
      bodyCount,
      memberCount,
      membershipIndexCount,
      sourceGenerationId,
      targetGenerationId,
      memberGenerationId,
      leaseId,
      leaseEpoch,
      dtS,
      externalAcceleration,
      tolerances,
      finiteMagnitudeLimit,
      targetChartId,
      targetLevelId,
      targetHierarchyGeneration,
      chartTransitionEnabled
    });
    const paramsBuffer = device.createBuffer({
      label: `${label}-params-${sourceGenerationId}-${params.targetGenerationId}`,
      size: PARAM_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    transientParams.add(paramsBuffer);
    device.queue.writeBuffer(paramsBuffer, 0, params.arrayBuffer);
    for (const buffer of [
      candidateFrameBuffer,
      transformedMemberBuffer,
      bodyWrenchBuffer,
      bodyInvariantBuffer,
      invariantEvidenceBuffer
    ]) {
      encoder.clearBuffer(buffer);
    }
    const uniformEntry = { buffer: paramsBuffer, size: PARAM_BYTES };
    const wrenchBindGroup = device.createBindGroup({
      label: `${label}-wrench-bind-group-${params.targetGenerationId}`,
      layout: pipelines.wrench.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: frameBuffer } },
        { binding: 1, resource: { buffer: memberBuffer } },
        { binding: 2, resource: { buffer: offsetBuffer } },
        { binding: 3, resource: { buffer: indexBuffer } },
        { binding: 4, resource: { buffer: memberWrenchInputBuffer } },
        { binding: 5, resource: { buffer: bodyWrenchBuffer } },
        { binding: 6, resource: { buffer: invariantEvidenceBuffer } },
        { binding: 7, resource: uniformEntry }
      ]
    });
    const integrateBindGroup = device.createBindGroup({
      label: `${label}-integrate-bind-group-${params.targetGenerationId}`,
      layout: pipelines.integrate.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: frameBuffer } },
        { binding: 1, resource: { buffer: bodyWrenchBuffer } },
        { binding: 2, resource: { buffer: candidateFrameBuffer } },
        { binding: 3, resource: { buffer: invariantEvidenceBuffer } },
        { binding: 4, resource: uniformEntry }
      ]
    });
    const transformBindGroup = device.createBindGroup({
      label: `${label}-transform-bind-group-${params.targetGenerationId}`,
      layout: pipelines.transform.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: candidateFrameBuffer } },
        { binding: 1, resource: { buffer: memberBuffer } },
        { binding: 2, resource: { buffer: transformedMemberBuffer } },
        { binding: 3, resource: { buffer: invariantEvidenceBuffer } },
        { binding: 4, resource: uniformEntry }
      ]
    });
    const invariantBindGroup = device.createBindGroup({
      label: `${label}-invariant-bind-group-${params.targetGenerationId}`,
      layout: pipelines.invariant.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: candidateFrameBuffer } },
        { binding: 1, resource: { buffer: memberBuffer } },
        { binding: 2, resource: { buffer: offsetBuffer } },
        { binding: 3, resource: { buffer: indexBuffer } },
        { binding: 4, resource: { buffer: transformedMemberBuffer } },
        { binding: 5, resource: { buffer: bodyInvariantBuffer } },
        { binding: 6, resource: { buffer: invariantEvidenceBuffer } },
        { binding: 7, resource: uniformEntry }
      ]
    });
    const finalizeBindGroup = device.createBindGroup({
      label: `${label}-finalize-bind-group-${params.targetGenerationId}`,
      layout: pipelines.finalize.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bodyInvariantBuffer } },
        { binding: 1, resource: { buffer: invariantEvidenceBuffer } },
        { binding: 2, resource: uniformEntry }
      ]
    });
    const failCloseBindGroup = device.createBindGroup({
      label: `${label}-fail-close-bind-group-${params.targetGenerationId}`,
      layout: pipelines.failClose.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: candidateFrameBuffer } },
        { binding: 1, resource: { buffer: invariantEvidenceBuffer } },
        { binding: 2, resource: uniformEntry }
      ]
    });
    const metadata = {
      ...timestampMetadata,
      sourceGenerationId,
      targetGenerationId: params.targetGenerationId,
      leaseId,
      leaseEpoch
    };
    const encodePass = (pipeline, bindGroup, passLabel, dispatch) => {
      const pass = encoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        passLabel,
        metadata
      ));
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(...dispatch);
      pass.end();
    };
    encodePass(
      pipelines.wrench,
      wrenchBindGroup,
      COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.wrenchReduce,
      params.bodyReductionDispatch
    );
    encodePass(
      pipelines.integrate,
      integrateBindGroup,
      COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.integrate,
      params.bodyLinearDispatch
    );
    encodePass(
      pipelines.transform,
      transformBindGroup,
      COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.transformMembers,
      params.memberLinearDispatch
    );
    encodePass(
      pipelines.invariant,
      invariantBindGroup,
      COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.invariantReduce,
      params.bodyReductionDispatch
    );
    encodePass(
      pipelines.finalize,
      finalizeBindGroup,
      COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.invariantFinalize,
      [1, 1, 1]
    );
    encodePass(
      pipelines.failClose,
      failCloseBindGroup,
      COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE.failClose,
      params.bodyLinearDispatch
    );

    let transientReleased = false;
    const releaseTransientBuffers = () => {
      if (transientReleased) return;
      transientReleased = true;
      if (transientParams.delete(paramsBuffer)) paramsBuffer.destroy?.();
    };
    return {
      schema: ULG_COHERENT_SOLID_FRAME_STEP_EXECUTION_SCHEMA,
      status: 'coherent-solid-frame-step-encoded-awaiting-state-manager-admission',
      sourceGenerationId,
      targetGenerationId: params.targetGenerationId,
      leaseId,
      leaseEpoch,
      bodyCount,
      memberCount,
      frameMutationCandidate: {
        schema: ULG_COHERENT_SOLID_FRAME_MUTATION_CANDIDATE_SCHEMA,
        frameSchema: ULG_COHERENT_SOLID_FRAME_SCHEMA,
        buffer: candidateFrameBuffer,
        bodyCount,
        strideWords: COHERENT_SOLID_FRAME_WORDS,
        generationId: params.targetGenerationId,
        leaseId,
        leaseEpoch,
        device,
        authorityStatus: 'not-authoritative-until-state-manager-admission',
        gpuGlobalInvariantFailCloseApplied: true,
        consumerGate: 'frame-row-status-consumed-by-next-step-and-indirect-draw'
      },
      transformedMembers: {
        schema: ULG_COHERENT_SOLID_TRANSFORMED_MEMBER_SCHEMA,
        buffer: transformedMemberBuffer,
        memberCount,
        strideWords: COHERENT_SOLID_TRANSFORMED_MEMBER_WORDS,
        generationId: params.targetGenerationId,
        leaseId,
        leaseEpoch,
        device,
        authorityStatus: 'derived-generation-scoped'
      },
      bodyWrenches: {
        schema: ULG_COHERENT_SOLID_BODY_WRENCH_SCHEMA,
        buffer: bodyWrenchBuffer,
        bodyCount,
        strideWords: COHERENT_SOLID_BODY_WRENCH_WORDS,
        generationId: sourceGenerationId,
        leaseId,
        leaseEpoch,
        device,
        authorityStatus: 'derived-source-generation'
      },
      bodyInvariants: {
        schema: ULG_COHERENT_SOLID_BODY_INVARIANT_SCHEMA,
        buffer: bodyInvariantBuffer,
        bodyCount,
        strideWords: COHERENT_SOLID_BODY_INVARIANT_WORDS,
        generationId: params.targetGenerationId,
        leaseId,
        leaseEpoch,
        device
      },
      invariantEvidence: {
        schema: ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
        buffer: invariantEvidenceBuffer,
        wordCount: COHERENT_SOLID_INVARIANT_EVIDENCE_WORDS,
        byteLength: plan.invariantEvidenceByteLength,
        generationId: params.targetGenerationId,
        leaseId,
        leaseEpoch,
        device,
        readbackPolicy: 'fixed-evidence-only-explicit-validation'
      },
      authority: ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY,
      stateMutationStatus: 'candidate-awaiting-peercompute-state-manager-admission',
      schedulerStatus: 'caller-compute-manager-owned-no-scene-scheduler',
      submissionOwnership: 'caller',
      queueSubmissionPerformed: false,
      readbackMode: 'no-hot-state-readback',
      fullStateReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      retainedGenerationReusePolicy: 'caller-fence-before-reuse-or-dedicated-runtime-per-in-flight-generation',
      params,
      transientBuffers: [paramsBuffer],
      releaseTransientBuffers
    };
  }

  return {
    schema: ULG_COHERENT_SOLID_FRAME_STEP_EXECUTION_SCHEMA,
    status: 'coherent-solid-frame-gpu-runtime-ready',
    plan,
    pipelineBundle: pipelines,
    pipelineCount: Object.keys(pipelines).length,
    candidateFrameBuffer,
    encode,
    allocationEntries() {
      return retainedAllocations.map((entry) => ({ ...entry, owned: true }));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const { buffer } of retainedAllocations) buffer.destroy?.();
      for (const paramsBuffer of transientParams) paramsBuffer.destroy?.();
      transientParams.clear();
    }
  };
}
