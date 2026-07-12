import {
  COHERENT_SOLID_DERIVED_ADMITTED,
  COHERENT_SOLID_BODY_INVARIANT_WORDS,
  COHERENT_SOLID_FRAME_WORDS,
  COHERENT_SOLID_MEMBER_WORDS,
  COHERENT_SOLID_MEMBER_WRENCH_WORDS,
  COHERENT_SOLID_PARTICLE_MEMBER_WRENCH_WORDS,
  COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_WORDS,
  COHERENT_SOLID_STATE_MANAGER_ADMITTED,
  COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS,
  ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
  ULG_COHERENT_SOLID_GPU_DRAW_RANGE_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_WRENCH_INPUT_SCHEMA,
  ULG_COHERENT_SOLID_PARTICLE_MEMBER_WRENCH_SCHEMA,
  ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA,
  ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
  ULG_COHERENT_SOLID_WORLD_CONTACT_PROXY_SCHEMA
} from '../../../ulg-gpu-abi/src/coherentSolid.js';
import {
  coherentSolidContactCompactionWgsl,
  coherentSolidContactKeyWgsl,
  coherentSolidIndirectDrawWgsl,
  coherentSolidParticleWrenchAdapterWgsl,
  coherentSolidResidentWgslForWorkgroupSize
} from '../../../ulg-gpu-abi/src/coherentSolidResidentWgsl.js';
import { createWebGpuStableRadixScanUnique } from '../webgpuRadixScanUnique.js';

export const COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE = Object.freeze({
  adaptMemberWrenches: 'coherentSolidAdaptMemberWrenches',
  proxyKeyBuild: 'coherentSolidContactProxyKeyBuild',
  proxyPrepare: 'coherentSolidContactProxyPrepare',
  proxyTransform: 'coherentSolidContactProxyTransform',
  proxyFinalize: 'coherentSolidContactProxyFinalize',
  directDrawInitialize: 'coherentSolidDirectDrawInitialize',
  directDrawCompact: 'coherentSolidDirectDrawCompact'
});

const PARAM_BYTES = 112;
const U32_BYTES = 4;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDEX: globalThis.GPUBufferUsage?.INDEX ?? 16,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};

function u32(value, label, { min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > 0xffffffff) {
    throw new RangeError(`${label} must be a u32${min > 0 ? ` >= ${min}` : ''}`);
  }
  return number;
}

function i32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < -0x80000000 || number > 0x7fffffff) {
    throw new RangeError(`${label} must be an i32`);
  }
  return number;
}

function assertBuffer(buffer, bytes, label) {
  if (!buffer) throw new TypeError(`${label} requires a GPUBuffer`);
  const size = Number(buffer.size ?? buffer.byteLength);
  if (Number.isFinite(size) && size < bytes) {
    throw new RangeError(`${label} requires ${bytes} bytes, received ${size}`);
  }
  return buffer;
}

function createBuffer(device, label, size, usage = GPU_BUFFER_USAGE.STORAGE) {
  return device.createBuffer({
    label,
    size: Math.max(4, Math.ceil(size / 4) * 4),
    usage: usage | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
}

function createPipeline(device, label, code, entryPoint) {
  const module = device.createShaderModule({ label: `${label}-shader`, code });
  return device.createComputePipeline({
    label,
    layout: 'auto',
    compute: { module, entryPoint }
  });
}

function timestampPassDescriptor(timestampProfiler, label, metadata = {}) {
  return timestampProfiler?.beginComputePassDescriptor
    ? timestampProfiler.beginComputePassDescriptor(label, metadata)
    : { label };
}

function dispatchShapeFor(count, workgroupSize, maxWorkgroupsPerDimension) {
  const groups = Math.max(1, Math.ceil(count / workgroupSize));
  const x = Math.min(groups, maxWorkgroupsPerDimension);
  const y = Math.ceil(groups / x);
  if (y > maxWorkgroupsPerDimension) {
    throw new RangeError('coherent-solid resident dispatch exceeds the admitted 2D limit');
  }
  return [x, y, 1];
}

function paramsArray({
  bodyCount,
  memberCount,
  proxyCount,
  sourceGenerationId,
  targetGenerationId,
  leaseId,
  leaseEpoch,
  chartId,
  levelId,
  hierarchyGeneration,
  sourcePositionEpoch,
  targetPositionEpoch,
  geometryKey,
  topologyGeneration,
  indexCount,
  hasParticleWrenches,
  sourceChartId,
  sourceLevelId,
  sourceHierarchyGeneration,
  maxDispatchWorkgroupsPerDimension,
  bodyDispatch,
  memberDispatch,
  proxyDispatch,
  proxyOutputLimit,
  workgroupSize,
  proxyGenerationId,
  chartTransitionEnabled,
  proxyOrderReused
}) {
  const buffer = new ArrayBuffer(PARAM_BYTES);
  const view = new DataView(buffer);
  const setU32 = (index, value) => view.setUint32(index * 4, value, true);
  const setI32 = (index, value) => view.setInt32(index * 4, value, true);
  setU32(0, bodyCount);
  setU32(1, memberCount);
  setU32(2, proxyCount);
  setU32(3, sourceGenerationId);
  setU32(4, targetGenerationId);
  setU32(5, leaseId);
  setU32(6, leaseEpoch);
  setI32(7, chartId);
  setI32(8, levelId);
  setU32(9, hierarchyGeneration);
  setU32(10, sourcePositionEpoch);
  setU32(11, geometryKey);
  setU32(12, topologyGeneration);
  setU32(13, indexCount);
  setU32(14, hasParticleWrenches ? 1 : 0);
  setU32(15, targetPositionEpoch);
  setI32(16, sourceChartId);
  setI32(17, sourceLevelId);
  setU32(18, sourceHierarchyGeneration);
  setU32(19, maxDispatchWorkgroupsPerDimension);
  setU32(20, bodyDispatch[0]);
  setU32(21, memberDispatch[0]);
  setU32(22, proxyDispatch[0]);
  setU32(23, proxyOutputLimit);
  setU32(24, workgroupSize);
  setU32(25, proxyGenerationId);
  setU32(26, chartTransitionEnabled ? 1 : 0);
  setU32(27, proxyOrderReused ? 1 : 0);
  return buffer;
}

export function createCoherentSolidResidentGpu(device, {
  bodyCapacity,
  memberCapacity,
  contactProxyCapacity,
  workgroupSize = 64,
  maxComputeWorkgroupsPerDimension =
    device?.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
  label = 'ulg-coherent-solid-resident',
  pipelineBundle = null,
  proxyOrderRuntime = null
} = {}) {
  if (!device?.createBuffer || !device?.createComputePipeline || !device?.queue?.writeBuffer) {
    throw new TypeError('coherent-solid resident runtime requires a WebGPU device');
  }
  const bodies = u32(bodyCapacity, 'bodyCapacity', { min: 1 });
  const members = u32(memberCapacity, 'memberCapacity', { min: 1 });
  const proxies = u32(contactProxyCapacity, 'contactProxyCapacity');
  const workgroup = u32(workgroupSize, 'workgroupSize', { min: 16 });
  if (workgroup > 256 || (workgroup & (workgroup - 1)) !== 0) {
    throw new RangeError('workgroupSize must be a power of two no greater than 256');
  }
  const maxDispatch = u32(
    Math.min(
      Number(device.limits?.maxComputeWorkgroupsPerDimension ?? 65535),
      Number(maxComputeWorkgroupsPerDimension)
    ),
    'maxComputeWorkgroupsPerDimension',
    { min: 1 }
  );
  const memberWrenchBuffer = createBuffer(
    device,
    `${label}-member-wrenches`,
    members * COHERENT_SOLID_MEMBER_WRENCH_WORDS * U32_BYTES
  );
  const worldContactProxyBuffer = createBuffer(
    device,
    `${label}-world-contact-proxies`,
    Math.max(1, proxies) * COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS * U32_BYTES
  );
  const transitionedLocalContactProxyBuffer = createBuffer(
    device,
    `${label}-transitioned-local-contact-proxies`,
    Math.max(1, proxies) * 32 * U32_BYTES
  );
  const proxyIdentityKeyBuffer = createBuffer(
    device,
    `${label}-proxy-identity-keys`,
    Math.max(1, proxies) * 2 * U32_BYTES
  );
  const proxyCompactionEvidenceBuffer = createBuffer(
    device,
    `${label}-proxy-compaction-evidence`,
    COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_WORDS * U32_BYTES
  );
  const proxyDispatchIndirectBuffer = createBuffer(
    device,
    `${label}-proxy-dispatch-indirect`,
    3 * U32_BYTES,
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT
  );
  const instanceBodyIndexBuffer = createBuffer(
    device,
    `${label}-draw-instance-body-indices`,
    bodies * U32_BYTES
  );
  const drawIndexedIndirectBuffer = createBuffer(
    device,
    `${label}-draw-indexed-indirect`,
    5 * U32_BYTES,
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT
  );
  const dummyParticleWrenchBuffer = createBuffer(
    device,
    `${label}-dummy-particle-wrench`,
    COHERENT_SOLID_PARTICLE_MEMBER_WRENCH_WORDS * U32_BYTES
  );
  const variant = (code) => coherentSolidResidentWgslForWorkgroupSize(code, workgroup);
  const pipelines = pipelineBundle || {
    wrench: createPipeline(
      device,
      `${label}-adapt-particle-wrenches`,
      variant(coherentSolidParticleWrenchAdapterWgsl),
      'adapt_particle_member_wrenches'
    ),
    contactKey: createPipeline(
      device,
      `${label}-build-contact-proxy-keys`,
      variant(coherentSolidContactKeyWgsl),
      'build_contact_proxy_identity_keys'
    ),
    contactPrepare: createPipeline(
      device,
      `${label}-prepare-contact-proxies`,
      variant(coherentSolidContactCompactionWgsl),
      'prepare_contact_proxy_compaction'
    ),
    contactPrepareReused: createPipeline(
      device,
      `${label}-prepare-reused-contact-proxy-order`,
      variant(coherentSolidContactCompactionWgsl),
      'prepare_reused_contact_proxy_order'
    ),
    contactTransform: createPipeline(
      device,
      `${label}-transform-contact-proxies`,
      variant(coherentSolidContactCompactionWgsl),
      'transform_compacted_contact_proxies'
    ),
    contactFinalize: createPipeline(
      device,
      `${label}-finalize-contact-proxies`,
      variant(coherentSolidContactCompactionWgsl),
      'finalize_contact_proxy_compaction'
    ),
    drawInit: createPipeline(
      device,
      `${label}-initialize-draw`,
      variant(coherentSolidIndirectDrawWgsl),
      'initialize_solid_draw'
    ),
    drawCompact: createPipeline(
      device,
      `${label}-compact-draw`,
      variant(coherentSolidIndirectDrawWgsl),
      'compact_solid_draw_instances'
    )
  };
  const ownsProxyOrderRuntime = proxies > 0 && !proxyOrderRuntime;
  const proxyOrder = proxies > 0
    ? (proxyOrderRuntime || createWebGpuStableRadixScanUnique(device, {
      maxElementCount: proxies,
      maxKeyWordCount: 2,
      maxComputeWorkgroupsPerDimension: maxDispatch,
      label: `${label}-proxy-order`
    }))
    : null;
  const proxyOrderAllocations = proxyOrder?.allocationEntries?.() || [];
  const proxyOrderBuffer = (role) => proxyOrderAllocations.find(
    (entry) => entry.role === role
  )?.buffer;
  const paramsBuffers = new Set();
  let destroyed = false;

  function encodeInputs(encoder, {
    memberSource,
    particleMemberWrenchSource = null,
    bodyCount,
    sourceGenerationId,
    targetGenerationId,
    leaseId,
    leaseEpoch,
    chartId,
    levelId,
    hierarchyGeneration,
    sourceChartId = chartId,
    sourceLevelId = levelId,
    sourceHierarchyGeneration = hierarchyGeneration,
    sourcePositionEpoch,
    targetPositionEpoch,
    geometryKey,
    topologyGeneration,
    indexCount,
    proxyCount = 0,
    proxyGenerationId = sourceGenerationId,
    proxyOutputLimit = proxyCount,
    chartTransitionEnabled = false,
    proxyOrderReused = false,
    timestampProfiler = null,
    timestampMetadata = {}
  } = {}) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (!encoder?.beginComputePass) throw new TypeError('caller-owned encoder is required');
    const bodyTotal = u32(bodyCount, 'bodyCount', { min: 1 });
    const memberTotal = u32(memberSource?.memberCount, 'memberSource.memberCount', { min: 1 });
    const proxyTotal = u32(proxyCount, 'proxyCount');
    if (bodyTotal > bodies || memberTotal > members || proxyTotal > proxies) {
      throw new RangeError('coherent-solid resident encode exceeds admitted capacity');
    }
    const outputLimit = u32(proxyOutputLimit, 'proxyOutputLimit');
    if (outputLimit > proxies) {
      throw new RangeError('proxyOutputLimit exceeds the admitted resident proxy capacity');
    }
    const bodyDispatch = dispatchShapeFor(bodyTotal, workgroup, maxDispatch);
    const memberDispatch = dispatchShapeFor(memberTotal, workgroup, maxDispatch);
    const proxyDispatch = dispatchShapeFor(Math.max(1, proxyTotal), workgroup, maxDispatch);
    if (
      memberSource?.schema !== ULG_COHERENT_SOLID_MEMBER_SCHEMA
      || memberSource.authorityStatus !== COHERENT_SOLID_STATE_MANAGER_ADMITTED
      || memberSource.device !== device
    ) {
      throw new TypeError('memberSource must be a StateManager-admitted same-device member buffer');
    }
    const memberBuffer = assertBuffer(
      memberSource.buffer,
      memberTotal * COHERENT_SOLID_MEMBER_WORDS * U32_BYTES,
      'memberSource.buffer'
    );
    let particleBuffer = dummyParticleWrenchBuffer;
    if (particleMemberWrenchSource) {
      if (
        particleMemberWrenchSource.schema !== ULG_COHERENT_SOLID_PARTICLE_MEMBER_WRENCH_SCHEMA
        || particleMemberWrenchSource.authorityStatus !== COHERENT_SOLID_DERIVED_ADMITTED
        || particleMemberWrenchSource.device !== device
        || particleMemberWrenchSource.memberCount !== memberTotal
        || particleMemberWrenchSource.positionEpoch !== sourcePositionEpoch
      ) {
        throw new TypeError('particleMemberWrenchSource must match member count, device, and position epoch');
      }
      particleBuffer = assertBuffer(
        particleMemberWrenchSource.buffer,
        memberTotal * COHERENT_SOLID_PARTICLE_MEMBER_WRENCH_WORDS * U32_BYTES,
        'particleMemberWrenchSource.buffer'
      );
    }
    const metadata = {
      bodyCount: bodyTotal,
      memberCount: memberTotal,
      proxyCount: proxyTotal,
      sourceGenerationId: u32(sourceGenerationId, 'sourceGenerationId'),
      targetGenerationId: u32(targetGenerationId, 'targetGenerationId', { min: 1 }),
      leaseId: u32(leaseId, 'leaseId', { min: 1 }),
      leaseEpoch: u32(leaseEpoch, 'leaseEpoch'),
      chartId: i32(chartId, 'chartId'),
      levelId: i32(levelId, 'levelId'),
      hierarchyGeneration: u32(hierarchyGeneration, 'hierarchyGeneration'),
      sourceChartId: i32(sourceChartId, 'sourceChartId'),
      sourceLevelId: i32(sourceLevelId, 'sourceLevelId'),
      sourceHierarchyGeneration: u32(
        sourceHierarchyGeneration,
        'sourceHierarchyGeneration'
      ),
      sourcePositionEpoch: u32(sourcePositionEpoch, 'sourcePositionEpoch'),
      targetPositionEpoch: u32(targetPositionEpoch, 'targetPositionEpoch'),
      geometryKey: u32(geometryKey, 'geometryKey'),
      topologyGeneration: u32(topologyGeneration, 'topologyGeneration'),
      indexCount: u32(indexCount, 'indexCount', { min: 1 }),
      hasParticleWrenches: Boolean(particleMemberWrenchSource),
      maxDispatchWorkgroupsPerDimension: maxDispatch,
      bodyDispatch,
      memberDispatch,
      proxyDispatch,
      proxyOutputLimit: outputLimit,
      workgroupSize: workgroup,
      proxyGenerationId: u32(proxyGenerationId, 'proxyGenerationId'),
      chartTransitionEnabled: chartTransitionEnabled === true,
      proxyOrderReused: proxyOrderReused === true
    };
    const paramsBuffer = device.createBuffer({
      label: `${label}-params-${metadata.targetGenerationId}`,
      size: PARAM_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    paramsBuffers.add(paramsBuffer);
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray(metadata));
    const bindGroup = device.createBindGroup({
      label: `${label}-wrench-bind-group-${metadata.targetGenerationId}`,
      layout: pipelines.wrench.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: memberBuffer } },
        { binding: 1, resource: { buffer: particleBuffer } },
        { binding: 2, resource: { buffer: memberWrenchBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer, size: PARAM_BYTES } }
      ]
    });
    const pass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.adaptMemberWrenches,
      {
        ...timestampMetadata,
        coherentSolidStage: 'adapt-member-wrenches',
        sourceGenerationId: metadata.sourceGenerationId,
        targetGenerationId: metadata.targetGenerationId
      }
    ));
    pass.setPipeline(pipelines.wrench);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(...metadata.memberDispatch);
    pass.end();
    return {
      metadata,
      paramsBuffer,
      memberWrenchSource: {
        schema: ULG_COHERENT_SOLID_MEMBER_WRENCH_INPUT_SCHEMA,
        authorityStatus: COHERENT_SOLID_DERIVED_ADMITTED,
        device,
        buffer: memberWrenchBuffer,
        memberCount: memberTotal,
        strideWords: COHERENT_SOLID_MEMBER_WRENCH_WORDS,
        generationId: metadata.sourceGenerationId,
        leaseId: metadata.leaseId,
        leaseEpoch: metadata.leaseEpoch,
        positionEpoch: metadata.sourcePositionEpoch,
        source: particleMemberWrenchSource
          ? 'gpu-particle-member-wrench-adapter'
          : 'gpu-zero-wrench-member-adapter'
      }
    };
  }

  function encodeOutputs(encoder, {
    prepared,
    frameExecution,
    localContactProxySource = null,
    restMesh,
    timestampProfiler = null,
    timestampMetadata = {}
  } = {}) {
    const { metadata, paramsBuffer } = prepared || {};
    if (!metadata || !paramsBuffer) throw new TypeError('prepared resident input encoding is required');
    if (
      restMesh?.schema !== ULG_COHERENT_SOLID_REST_MESH_SCHEMA
      || restMesh.device !== device
      || restMesh.geometryKey !== metadata.geometryKey
      || restMesh.topologyGeneration !== metadata.topologyGeneration
    ) {
      throw new TypeError('same-device rest mesh must match the resident geometry generation');
    }
    const frame = frameExecution?.frameMutationCandidate;
    const invariants = frameExecution?.bodyInvariants;
    const stageMetadata = (coherentSolidStage) => ({
      ...timestampMetadata,
      coherentSolidStage,
      sourceGenerationId: metadata.sourceGenerationId,
      targetGenerationId: metadata.targetGenerationId
    });
    assertBuffer(frame?.buffer, metadata.bodyCount * COHERENT_SOLID_FRAME_WORDS * U32_BYTES, 'frame candidate');
    assertBuffer(
      invariants?.buffer,
      metadata.bodyCount * COHERENT_SOLID_BODY_INVARIANT_WORDS * U32_BYTES,
      'body invariants'
    );
    let proxyOrderEncoding = null;
    let localProxyBuffer = dummyParticleWrenchBuffer;
    encoder.clearBuffer(worldContactProxyBuffer);
    encoder.clearBuffer(transitionedLocalContactProxyBuffer);
    encoder.clearBuffer(proxyCompactionEvidenceBuffer);
    encoder.clearBuffer(proxyDispatchIndirectBuffer);
    if (metadata.proxyCount > 0) {
      if (
        localContactProxySource?.schema !== ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA
        || localContactProxySource.authorityStatus !== COHERENT_SOLID_DERIVED_ADMITTED
        || localContactProxySource.device !== device
        || localContactProxySource.proxyCount !== metadata.proxyCount
        || localContactProxySource.hierarchyGeneration !== metadata.sourceHierarchyGeneration
        || localContactProxySource.chartId !== metadata.sourceChartId
        || localContactProxySource.levelId !== metadata.sourceLevelId
        || localContactProxySource.topologyGeneration !== metadata.topologyGeneration
        || localContactProxySource.generationId !== metadata.proxyGenerationId
        || localContactProxySource.thirdLevelHold !== true
      ) {
        throw new TypeError(
          'body-local contact proxies must match source chart, level, hierarchy, and topology generation'
        );
      }
      const reusedOrderEvidence = localContactProxySource.orderingEvidence;
      if (metadata.proxyOrderReused && (
        localContactProxySource.ordering !== 'stable-gpu-radix-unique-body-id-proxy-id'
        || reusedOrderEvidence?.schema !== ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA
        || reusedOrderEvidence.device !== device
        || reusedOrderEvidence.generationId !== metadata.sourceGenerationId
        || reusedOrderEvidence.leaseId !== metadata.leaseId
        || reusedOrderEvidence.inputProxyCount !== metadata.proxyCount
        || !reusedOrderEvidence.buffer
      )) {
        throw new TypeError('reused contact proxy order requires exact prior same-device GPU evidence');
      }
      localProxyBuffer = assertBuffer(
        localContactProxySource.buffer,
        metadata.proxyCount * 32 * U32_BYTES,
        'localContactProxySource.buffer'
      );
      let sortedIndicesBuffer = proxyOrderBuffer('radix-sorted-indices-a');
      let uniqueOffsetsBuffer = proxyOrderBuffer('unique-offsets');
      let orderEvidenceBuffer = reusedOrderEvidence?.buffer;
      if (!metadata.proxyOrderReused) {
        encoder.clearBuffer(proxyIdentityKeyBuffer);
        const keyBindGroup = device.createBindGroup({
          label: `${label}-contact-key-bind-group-${metadata.targetGenerationId}`,
          layout: pipelines.contactKey.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: localProxyBuffer } },
            { binding: 1, resource: { buffer: proxyIdentityKeyBuffer } },
            { binding: 2, resource: { buffer: paramsBuffer, size: PARAM_BYTES } }
          ]
        });
        let keyPass = encoder.beginComputePass(timestampPassDescriptor(
          timestampProfiler,
          COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.proxyKeyBuild,
          stageMetadata('contact-proxy-key-build')
        ));
        keyPass.setPipeline(pipelines.contactKey);
        keyPass.setBindGroup(0, keyBindGroup);
        keyPass.dispatchWorkgroups(...metadata.proxyDispatch);
        keyPass.end();
        proxyOrderEncoding = proxyOrder.encodeSortUnique(encoder, {
          keyBuffer: proxyIdentityKeyBuffer,
          elementCount: metadata.proxyCount,
          keyWordCount: 2,
          keyStrideWords: 2,
          generationId: metadata.targetGenerationId,
          consumerWorkgroupSize: metadata.workgroupSize,
          timestampProfiler,
          timestampMetadata: stageMetadata('contact-proxy-radix')
        });
        sortedIndicesBuffer = proxyOrderEncoding.sortedIndicesBuffer;
        uniqueOffsetsBuffer = proxyOrderEncoding.uniqueOffsetsBuffer;
        orderEvidenceBuffer = proxyOrderEncoding.uniqueEvidenceBuffer;
      }
      const compactionEntries = [
        { binding: 0, resource: { buffer: frame.buffer } },
        { binding: 1, resource: { buffer: localProxyBuffer } },
        { binding: 2, resource: { buffer: sortedIndicesBuffer } },
        { binding: 3, resource: { buffer: uniqueOffsetsBuffer } },
        { binding: 4, resource: { buffer: orderEvidenceBuffer } },
        { binding: 5, resource: { buffer: worldContactProxyBuffer } },
        { binding: 6, resource: { buffer: proxyCompactionEvidenceBuffer } },
        { binding: 7, resource: { buffer: proxyDispatchIndirectBuffer } },
        { binding: 8, resource: { buffer: paramsBuffer, size: PARAM_BYTES } },
        { binding: 9, resource: { buffer: transitionedLocalContactProxyBuffer } },
        { binding: 10, resource: { buffer: proxyDispatchIndirectBuffer } }
      ];
      const preparePipeline = metadata.proxyOrderReused
        ? pipelines.contactPrepareReused
        : pipelines.contactPrepare;
      const prepareBindGroup = device.createBindGroup({
        label: `${label}-contact-prepare-bind-group-${metadata.targetGenerationId}`,
        layout: preparePipeline.getBindGroupLayout(0),
        entries: compactionEntries.filter(({ binding }) => [4, 6, 7, 8].includes(binding))
      });
      let contactPass = encoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.proxyPrepare,
        stageMetadata('contact-proxy-prepare')
      ));
      contactPass.setPipeline(preparePipeline);
      contactPass.setBindGroup(0, prepareBindGroup);
      contactPass.dispatchWorkgroups(1);
      contactPass.end();

      const transformBindGroup = device.createBindGroup({
        label: `${label}-contact-transform-bind-group-${metadata.targetGenerationId}`,
        layout: pipelines.contactTransform.getBindGroupLayout(0),
        entries: compactionEntries.filter(({ binding }) => ![4, 7].includes(binding))
      });
      contactPass = encoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.proxyTransform,
        stageMetadata('contact-proxy-transform')
      ));
      contactPass.setPipeline(pipelines.contactTransform);
      contactPass.setBindGroup(0, transformBindGroup);
      contactPass.dispatchWorkgroupsIndirect(proxyDispatchIndirectBuffer, 0);
      contactPass.end();

      const finalizeBindGroup = device.createBindGroup({
        label: `${label}-contact-finalize-bind-group-${metadata.targetGenerationId}`,
        layout: pipelines.contactFinalize.getBindGroupLayout(0),
        entries: compactionEntries.filter(({ binding }) => [6, 8].includes(binding))
      });
      contactPass = encoder.beginComputePass(timestampPassDescriptor(
        timestampProfiler,
        COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.proxyFinalize,
        stageMetadata('contact-proxy-finalize')
      ));
      contactPass.setPipeline(pipelines.contactFinalize);
      contactPass.setBindGroup(0, finalizeBindGroup);
      contactPass.dispatchWorkgroups(1);
      contactPass.end();
    }
    const drawInitBindGroup = device.createBindGroup({
      label: `${label}-draw-init-bind-group-${metadata.targetGenerationId}`,
      layout: pipelines.drawInit.getBindGroupLayout(0),
      entries: [
        { binding: 3, resource: { buffer: drawIndexedIndirectBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer, size: PARAM_BYTES } }
      ]
    });
    const drawCompactBindGroup = device.createBindGroup({
      label: `${label}-draw-compact-bind-group-${metadata.targetGenerationId}`,
      layout: pipelines.drawCompact.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: frame.buffer } },
        { binding: 1, resource: { buffer: invariants.buffer } },
        { binding: 2, resource: { buffer: instanceBodyIndexBuffer } },
        { binding: 3, resource: { buffer: drawIndexedIndirectBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer, size: PARAM_BYTES } },
        { binding: 5, resource: { buffer: proxyCompactionEvidenceBuffer } }
      ]
    });
    const initPass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.directDrawInitialize,
      stageMetadata('direct-draw-initialize')
    ));
    initPass.setPipeline(pipelines.drawInit);
    initPass.setBindGroup(0, drawInitBindGroup);
    initPass.dispatchWorkgroups(1);
    initPass.end();
    const compactPass = encoder.beginComputePass(timestampPassDescriptor(
      timestampProfiler,
      COHERENT_SOLID_RESIDENT_GPU_TIMESTAMP_STAGE.directDrawCompact,
      stageMetadata('direct-draw-compact')
    ));
    compactPass.setPipeline(pipelines.drawCompact);
    compactPass.setBindGroup(0, drawCompactBindGroup);
    compactPass.dispatchWorkgroups(...metadata.bodyDispatch);
    compactPass.end();
    const proxyCompactionEvidence = Object.freeze({
      schema: ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA,
      authorityStatus: COHERENT_SOLID_DERIVED_ADMITTED,
      device,
      buffer: proxyCompactionEvidenceBuffer,
      wordCount: COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_WORDS,
      byteLength: COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_WORDS * U32_BYTES,
      generationId: metadata.targetGenerationId,
      leaseId: metadata.leaseId,
      leaseEpoch: metadata.leaseEpoch,
      inputProxyCount: metadata.proxyCount,
      outputCapacity: metadata.proxyOutputLimit,
      dispatchIndirectBuffer: proxyDispatchIndirectBuffer,
      dispatchIndirectByteLength: 12,
      ordering: 'stable-gpu-radix-unique-body-id-proxy-id',
      orderReused: metadata.proxyOrderReused,
      consumerGate: 'zero-native-indirect-instances-unless-gpu-evidence-admissible'
    });
    const nextLocalContactProxySource = Object.freeze({
      ...localContactProxySource,
      schema: ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
      authorityStatus: COHERENT_SOLID_DERIVED_ADMITTED,
      device,
      buffer: transitionedLocalContactProxyBuffer,
      proxyCount: metadata.proxyCount,
      generationId: metadata.proxyGenerationId,
      leaseId: metadata.leaseId,
      leaseEpoch: metadata.leaseEpoch,
      chartId: metadata.chartId,
      levelId: metadata.levelId,
      hierarchyGeneration: metadata.hierarchyGeneration,
      topologyGeneration: metadata.topologyGeneration,
      positionEpoch: metadata.targetPositionEpoch,
      thirdLevelHold: true,
      ordering: 'stable-gpu-radix-unique-body-id-proxy-id',
      orderingEvidence: proxyCompactionEvidence
    });
    return {
      worldContactProxies: {
        schema: ULG_COHERENT_SOLID_WORLD_CONTACT_PROXY_SCHEMA,
        authorityStatus: COHERENT_SOLID_DERIVED_ADMITTED,
        device,
        buffer: worldContactProxyBuffer,
        proxyCount: metadata.proxyCount,
        strideWords: COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS,
        generationId: metadata.targetGenerationId,
        leaseId: metadata.leaseId,
        leaseEpoch: metadata.leaseEpoch,
        chartId: metadata.chartId,
        levelId: metadata.levelId,
        hierarchyGeneration: metadata.hierarchyGeneration,
        positionEpoch: metadata.targetPositionEpoch,
        thirdLevelHold: true
      },
      localContactProxySource: nextLocalContactProxySource,
      proxyCompactionEvidence,
      gpuDrawRange: {
        schema: ULG_COHERENT_SOLID_GPU_DRAW_RANGE_SCHEMA,
        status: 'gpu-compacted-indirect-awaiting-state-manager-admission',
        device,
        drawIndexedIndirectBuffer,
        indirectOffsetBytes: 0,
        indirectByteLength: 20,
        instanceBodyIndexBuffer,
        instanceCapacity: metadata.bodyCount,
        frameSource: frame,
        restMesh,
        generationId: metadata.targetGenerationId,
        leaseId: metadata.leaseId,
        leaseEpoch: metadata.leaseEpoch,
        geometryKey: metadata.geometryKey,
        topologyGeneration: metadata.topologyGeneration,
        compaction: 'gpu-body-invariant-gated-no-per-body-host-draw-loop'
      },
      proxyOrderEncoding,
      releaseTransientBuffers() {
        if (proxyOrderEncoding) proxyOrder.releaseTransientBuffers(proxyOrderEncoding);
      }
    };
  }

  return {
    status: 'coherent-solid-resident-gpu-ready',
    device,
    pipelineBundle: pipelines,
    pipelineCount:
      Object.keys(pipelines).length
      + (ownsProxyOrderRuntime ? proxyOrder.pipelineCount : 0),
    capacities: { bodyCapacity: bodies, memberCapacity: members, contactProxyCapacity: proxies },
    encodeInputs,
    encodeOutputs,
    allocationEntries() {
      return [
        ['member-wrenches', memberWrenchBuffer],
        ['world-contact-proxies', worldContactProxyBuffer],
        ['transitioned-local-contact-proxies', transitionedLocalContactProxyBuffer],
        ['proxy-identity-keys', proxyIdentityKeyBuffer],
        ['proxy-compaction-evidence', proxyCompactionEvidenceBuffer],
        ['proxy-dispatch-indirect', proxyDispatchIndirectBuffer],
        ['draw-instance-body-indices', instanceBodyIndexBuffer],
        ['draw-indexed-indirect', drawIndexedIndirectBuffer],
        ['dummy-particle-wrench', dummyParticleWrenchBuffer]
      ].map(([role, buffer]) => ({ role, buffer, owned: true })).concat(
        ownsProxyOrderRuntime
          ? proxyOrder.allocationEntries().map((entry) => ({ ...entry, owned: true }))
          : []
      );
    },
    releaseParamsBuffer(buffer) {
      if (paramsBuffers.delete(buffer)) buffer.destroy?.();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const buffer of [
        memberWrenchBuffer,
        worldContactProxyBuffer,
        transitionedLocalContactProxyBuffer,
        proxyIdentityKeyBuffer,
        proxyCompactionEvidenceBuffer,
        proxyDispatchIndirectBuffer,
        instanceBodyIndexBuffer,
        drawIndexedIndirectBuffer,
        dummyParticleWrenchBuffer
      ]) buffer.destroy?.();
      if (ownsProxyOrderRuntime) proxyOrder.destroy();
      for (const buffer of paramsBuffers) buffer.destroy?.();
      paramsBuffers.clear();
    }
  };
}
