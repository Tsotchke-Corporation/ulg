import {
  COHERENT_SOLID_FRAME_WORDS,
  COHERENT_SOLID_REST_VERTEX_FLOATS,
  COHERENT_SOLID_STATE_MANAGER_ADMITTED,
  ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA,
  ULG_COHERENT_SOLID_DRAW_ENTRY_SCHEMA,
  ULG_COHERENT_SOLID_DRAW_GROUP_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_SCHEMA,
  ULG_COHERENT_SOLID_GPU_DRAW_RANGE_SCHEMA,
  ULG_COHERENT_SOLID_NATIVE_EXECUTOR_SCHEMA,
  ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
  ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
  ULG_COHERENT_SOLID_STATE_MANAGER_ADMISSION_SCHEMA
} from '../../../ulg-gpu-abi/src/coherentSolid.js';
import { coherentSolidNativeBridgeWgsl } from '../../../ulg-gpu-abi/src/coherentSolidRenderWgsl.js';
import { COHERENT_SOLID_PRESENTATION_CONSUMER_LEASE_SCHEMA } from './coherentSolidPresentationLease.js';

const ENTRY_PARAM_BYTES = 32;
const NATIVE_PIPELINE_BUNDLE_SCHEMA =
  'peercompute.ulg.schroeder-solid-native-pipeline-bundle.v0';
const GPU_BUFFER_USAGE = {
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};
const GPU_SHADER_STAGE = {
  VERTEX: globalThis.GPUShaderStage?.VERTEX ?? 1,
  FRAGMENT: globalThis.GPUShaderStage?.FRAGMENT ?? 2
};
const objectIds = new WeakMap();
let nextObjectId = 1;

function objectIdentity(value) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return 'none';
  let id = objectIds.get(value);
  if (!id) {
    id = nextObjectId;
    nextObjectId += 1;
    objectIds.set(value, id);
  }
  return id;
}

function u32(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 0xffffffff ? number : null;
}

function positiveU32(value) {
  const number = u32(value);
  return number !== null && number > 0 ? number : null;
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function alignTo(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
}

function blockedContract(source, reason, input = null) {
  return {
    schema: ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA,
    status: 'blocked-coherent-solid-draw-entries',
    reason,
    ready: false,
    source,
    inputSchema: input?.schema ?? null,
    inputStatus: input?.status ?? null,
    publicationGeneration: input?.publicationGeneration ?? null,
    admissionId: input?.admissionId ?? null,
    entryCount: Array.isArray(input?.entries) ? input.entries.length : 0,
    entries: [],
    schedulerOwnedByPresentation: false,
    cpuTransformRequired: false,
    densityFieldRequired: false,
    fullStateReadbackRequired: false
  };
}

export function validateCoherentSolidPresentationConsumerLease(lease, {
  device = null,
  publicationGeneration = null,
  admissionId = null
} = {}) {
  if (
    lease?.schema !== COHERENT_SOLID_PRESENTATION_CONSUMER_LEASE_SCHEMA
    || lease.ready !== true
    || typeof lease.validate !== 'function'
  ) {
    return Object.freeze({
      valid: false,
      status: 'blocked-coherent-solid-presentation-consumer-lease',
      reason: 'presentation consumer lease is missing or malformed'
    });
  }
  if (
    lease.device !== device
    || lease.publicationGeneration !== publicationGeneration
    || lease.admissionId !== admissionId
  ) {
    return Object.freeze({
      valid: false,
      status: 'blocked-coherent-solid-presentation-consumer-lease',
      reason: 'presentation consumer lease does not match device, generation, or admission'
    });
  }
  let validation = null;
  try {
    validation = lease.validate();
  } catch (error) {
    return Object.freeze({
      valid: false,
      status: 'blocked-coherent-solid-presentation-consumer-lease',
      reason: error instanceof Error ? error.message : String(error)
    });
  }
  if (validation?.valid !== true) {
    return Object.freeze({
      valid: false,
      status: validation?.status || 'blocked-coherent-solid-presentation-consumer-lease',
      reason: validation?.reason || 'presentation consumer lease authority is no longer live',
      validation
    });
  }
  return Object.freeze({
    valid: true,
    status: 'coherent-solid-presentation-consumer-lease-live',
    reason: null,
    validation
  });
}

function admittedEntrySnapshot(entry) {
  return Object.freeze({
    ...entry,
    frameSource: Object.freeze({ ...entry.frameSource }),
    restMesh: Object.freeze({ ...entry.restMesh }),
    shapeCarrier: Object.freeze({ ...entry.shapeCarrier })
  });
}

function admittedDrawGroupSnapshot(group) {
  return Object.freeze({
    ...group,
    frameSource: Object.freeze({ ...group.frameSource }),
    restMesh: Object.freeze({ ...group.restMesh }),
    shapeCarrier: Object.freeze({ ...group.shapeCarrier }),
    gpuDrawRange: Object.freeze({ ...group.gpuDrawRange })
  });
}

function validateSolidDrawGroup(group, {
  device,
  publicationGeneration,
  collectionAdmissionId
} = {}) {
  if (group?.schema !== ULG_COHERENT_SOLID_DRAW_GROUP_SCHEMA) {
    return 'solid draw group schema mismatch';
  }
  if (
    group.status !== 'state-manager-admitted-solid-draw-group'
    || group.authorityStatus !== COHERENT_SOLID_STATE_MANAGER_ADMITTED
    || group.stateManagerAdmissionId !== collectionAdmissionId
    || group.publicationGeneration !== publicationGeneration
  ) {
    return 'solid draw group is not part of the committed StateManager admission';
  }
  const frameSource = group.frameSource;
  if (
    frameSource?.schema !== ULG_COHERENT_SOLID_FRAME_SCHEMA
    || frameSource.authorityStatus !== COHERENT_SOLID_STATE_MANAGER_ADMITTED
    || frameSource.stateManagerAdmissionId !== collectionAdmissionId
    || frameSource.device !== device
    || !frameSource.buffer
  ) {
    return 'solid draw group requires its admitted same-device frame source';
  }
  if (
    group.generationId !== frameSource.generationId
    || group.leaseId !== frameSource.leaseId
    || group.leaseEpoch !== frameSource.leaseEpoch
    || frameSource.strideWords !== COHERENT_SOLID_FRAME_WORDS
    || positiveU32(frameSource.bodyCount) === null
    || Number(frameSource.buffer.size) < frameSource.bodyCount * COHERENT_SOLID_FRAME_WORDS * 4
  ) {
    return 'solid draw group frame generation, lease, count, or stride mismatch';
  }
  const restMesh = group.restMesh;
  if (
    restMesh?.schema !== ULG_COHERENT_SOLID_REST_MESH_SCHEMA
    || restMesh.device !== device
    || !restMesh.vertexBuffer
    || !restMesh.indexBuffer
    || positiveU32(restMesh.vertexCount) === null
    || positiveU32(restMesh.indexCount) === null
    || restMesh.vertexStrideFloats !== COHERENT_SOLID_REST_VERTEX_FLOATS
    || restMesh.indexFormat !== 'uint32'
    || Number(restMesh.vertexBuffer.size) < restMesh.vertexCount * COHERENT_SOLID_REST_VERTEX_FLOATS * 4
    || Number(restMesh.indexBuffer.size) < restMesh.indexCount * 4
    || restMesh.persistent !== true
    || restMesh.cpuVertexTransformPerformed !== false
  ) {
    return 'solid draw group requires a persistent same-device untransformed rest mesh';
  }
  const shapeCarrier = group.shapeCarrier;
  if (
    shapeCarrier?.schema !== ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA
    || shapeCarrier.status !== 'state-manager-admitted-coherent-solid-shape-carrier'
    || shapeCarrier.authorityStatus !== COHERENT_SOLID_STATE_MANAGER_ADMITTED
    || shapeCarrier.stateManagerAdmissionId !== collectionAdmissionId
    || shapeCarrier.geometryKey !== restMesh.geometryKey
    || shapeCarrier.topologyGeneration !== restMesh.topologyGeneration
  ) {
    return 'solid draw group requires its admitted shape carrier and topology';
  }
  const range = group.gpuDrawRange;
  if (
    range?.schema !== ULG_COHERENT_SOLID_GPU_DRAW_RANGE_SCHEMA
    || range.device !== device
    || range.generationId !== frameSource.generationId
    || range.leaseId !== frameSource.leaseId
    || range.leaseEpoch !== frameSource.leaseEpoch
    || range.geometryKey !== restMesh.geometryKey
    || range.topologyGeneration !== restMesh.topologyGeneration
    || !range.instanceBodyIndexBuffer
    || !range.drawIndexedIndirectBuffer
    || Number(range.instanceBodyIndexBuffer.size) < frameSource.bodyCount * 4
    || Number(range.drawIndexedIndirectBuffer.size) < 20
    || Number(range.indirectOffsetBytes) % 4 !== 0
  ) {
    return 'solid draw group requires a matching GPU-compacted indexed-indirect range';
  }
  if (
    group.presentationOwnsPhysicsCadence === true
    || group.transformedVertices != null
    || group.cpuTransform != null
    || group.densityField != null
  ) {
    return 'solid draw group contains a prohibited CPU transform, density field, or presentation scheduler';
  }
  const opacity = group.opacity == null ? 1 : Number(group.opacity);
  const exposure = group.exposure == null ? 1 : Number(group.exposure);
  const renderOrder = group.renderOrder == null ? 0 : Number(group.renderOrder);
  const depthWriteFlag = group.depthWriteFlag == null ? 1 : Number(group.depthWriteFlag);
  if (
    opacity !== 1
    || !Number.isFinite(exposure)
    || exposure < 0
    || !Number.isFinite(renderOrder)
    || depthWriteFlag !== 1
    || (group.flags != null && u32(group.flags) === null)
  ) {
    return 'solid draw group contains invalid render parameters';
  }
  return null;
}

function validateSolidDrawEntry(entry, {
  device,
  publicationGeneration,
  collectionAdmissionId
} = {}) {
  if (entry?.schema !== ULG_COHERENT_SOLID_DRAW_ENTRY_SCHEMA) {
    return 'solid draw entry schema mismatch';
  }
  if (
    entry.status !== 'state-manager-admitted-solid-draw-entry'
    || entry.authorityStatus !== COHERENT_SOLID_STATE_MANAGER_ADMITTED
  ) {
    return 'solid draw entry is not StateManager-admitted';
  }
  if (positiveU32(entry.stateManagerAdmissionId) === null) {
    return 'solid draw entry requires a positive StateManager admission id';
  }
  if (u32(entry.bodyId) === null) {
    return 'solid draw entry requires a u32 body id';
  }
  if (
    collectionAdmissionId !== null
    && entry.stateManagerAdmissionId !== collectionAdmissionId
  ) {
    return 'solid draw entry admission id does not match its collection';
  }
  if (
    publicationGeneration !== null
    && entry.publicationGeneration !== publicationGeneration
  ) {
    return 'solid draw entry publication generation does not match its collection';
  }
  const frameSource = entry.frameSource;
  if (
    frameSource?.schema !== ULG_COHERENT_SOLID_FRAME_SCHEMA
    || frameSource.authorityStatus !== COHERENT_SOLID_STATE_MANAGER_ADMITTED
  ) {
    return 'solid draw entry requires an admitted coherent-solid frame source';
  }
  if (frameSource.device !== device || !frameSource.buffer) {
    return 'solid draw frame source is not retained on the bridge device';
  }
  if (
    u32(frameSource.generationId) === null
    || u32(frameSource.leaseId) === null
    || u32(frameSource.leaseEpoch) === null
    || frameSource.generationId !== entry.generationId
    || frameSource.leaseId !== entry.leaseId
    || frameSource.leaseEpoch !== entry.leaseEpoch
  ) {
    return 'solid draw frame generation or lease does not match the admitted entry';
  }
  if (
    frameSource.strideWords !== COHERENT_SOLID_FRAME_WORDS
    || Number(frameSource.buffer.size) < frameSource.bodyCount * COHERENT_SOLID_FRAME_WORDS * 4
  ) {
    return 'solid draw frame source stride or retained buffer size does not match the ABI';
  }
  const bodyIndex = u32(entry.bodyIndex);
  const bodyCount = positiveU32(frameSource.bodyCount);
  if (bodyIndex === null || bodyCount === null || bodyIndex >= bodyCount) {
    return 'solid draw body index is outside the admitted frame source';
  }
  if (u32(entry.componentGeneration) === null) {
    return 'solid draw entry requires a component generation';
  }
  const restMesh = entry.restMesh;
  if (
    restMesh?.schema !== ULG_COHERENT_SOLID_REST_MESH_SCHEMA
    || restMesh.device !== device
    || !restMesh.vertexBuffer
    || !restMesh.indexBuffer
    || positiveU32(restMesh.vertexCount) === null
    || positiveU32(restMesh.indexCount) === null
    || restMesh.vertexStrideFloats !== COHERENT_SOLID_REST_VERTEX_FLOATS
    || restMesh.indexFormat !== 'uint32'
    || Number(restMesh.vertexBuffer.size)
      < restMesh.vertexCount * COHERENT_SOLID_REST_VERTEX_FLOATS * 4
    || Number(restMesh.indexBuffer.size) < restMesh.indexCount * 4
    || restMesh.persistent !== true
    || restMesh.cpuVertexTransformPerformed !== false
  ) {
    return 'solid draw entry requires a persistent same-device untransformed rest mesh';
  }
  const shapeCarrier = entry.shapeCarrier;
  if (shapeCarrier?.schema !== ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA) {
    return 'solid draw entry requires an admitted shape-carrier descriptor';
  }
  if (
    shapeCarrier.geometryKey !== restMesh.geometryKey
    || shapeCarrier.topologyGeneration !== restMesh.topologyGeneration
    || entry.topologyGeneration !== restMesh.topologyGeneration
  ) {
    return 'solid draw shape-carrier and rest-mesh topology identity mismatch';
  }
  const opacity = entry.opacity == null ? 1 : Number(entry.opacity);
  const exposure = entry.exposure == null ? 1 : Number(entry.exposure);
  const renderOrder = entry.renderOrder == null ? 0 : Number(entry.renderOrder);
  const depthWriteFlag = entry.depthWriteFlag == null ? 1 : Number(entry.depthWriteFlag);
  if (
    !Number.isFinite(opacity)
    || opacity !== 1
    || !Number.isFinite(exposure)
    || exposure < 0
    || !Number.isFinite(renderOrder)
    || depthWriteFlag !== 1
    || (entry.flags != null && u32(entry.flags) === null)
  ) {
    return 'solid draw entry contains invalid render parameters';
  }
  if (
    entry.transformedVertices != null
    || entry.cpuTransform != null
    || entry.densityField != null
    || entry.marchingCubesSurface != null
  ) {
    return 'solid draw entry contains a prohibited CPU or density-derived visible transform';
  }
  if (
    entry.presentationOwnsPhysicsCadence === true
    || entry.schedulerOwner === 'scene'
  ) {
    return 'solid draw entry cannot transfer physics scheduling to presentation';
  }
  return null;
}

export function resolveAdmittedCoherentSolidDrawEntries({
  solidDrawEntries = null,
  device = solidDrawEntries?.device ?? null,
  source = 'native-webgpu-surface-bridge',
  stateManagerAdmissionValidated = false,
  presentationLease = null,
  presentationLeaseRequired = false
} = {}) {
  if (solidDrawEntries?.schema !== ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA) {
    return blockedContract(source, 'coherent-solid draw-entry collection schema mismatch', solidDrawEntries);
  }
  if (
    solidDrawEntries.status !== 'state-manager-admitted-solid-draw-entries'
    || solidDrawEntries.authorityStatus !== COHERENT_SOLID_STATE_MANAGER_ADMITTED
  ) {
    return blockedContract(source, 'coherent-solid draw entries are not StateManager-admitted', solidDrawEntries);
  }
  if (!device || solidDrawEntries.device !== device) {
    return blockedContract(source, 'coherent-solid draw entries are not on the native bridge device', solidDrawEntries);
  }
  if (stateManagerAdmissionValidated !== true) {
    return blockedContract(source, 'coherent-solid publication lacks live StateManager authority validation', solidDrawEntries);
  }
  const publicationGeneration = positiveU32(solidDrawEntries.publicationGeneration);
  const admissionId = positiveU32(solidDrawEntries.admissionId);
  if (publicationGeneration === null || admissionId === null) {
    return blockedContract(source, 'coherent-solid draw entries require publication and admission ids', solidDrawEntries);
  }
  const requiresPresentationLease = presentationLeaseRequired === true || Boolean(presentationLease);
  const presentationLeaseValidation = requiresPresentationLease
    ? validateCoherentSolidPresentationConsumerLease(presentationLease, {
      device,
      publicationGeneration,
      admissionId
    })
    : null;
  if (requiresPresentationLease && presentationLeaseValidation?.valid !== true) {
    return blockedContract(
      source,
      presentationLeaseValidation?.reason || 'coherent-solid presentation consumer lease is not live',
      solidDrawEntries
    );
  }
  const stateManagerAdmission = solidDrawEntries.stateManagerAdmission;
  if (
    stateManagerAdmission?.schema !== ULG_COHERENT_SOLID_STATE_MANAGER_ADMISSION_SCHEMA
    || stateManagerAdmission.accepted !== true
    || stateManagerAdmission.committed !== true
    || stateManagerAdmission.admissionId !== admissionId
    || stateManagerAdmission.publicationGeneration !== publicationGeneration
  ) {
    return blockedContract(source, 'coherent-solid publication has no matching committed StateManager admission', solidDrawEntries);
  }
  const drawGroups = Array.isArray(solidDrawEntries.drawGroups)
    ? solidDrawEntries.drawGroups
    : null;
  if (!drawGroups) {
    return blockedContract(source, 'coherent-solid publication must provide GPU draw groups', solidDrawEntries);
  }
  for (let index = 0; index < drawGroups.length; index += 1) {
    const reason = validateSolidDrawGroup(drawGroups[index], {
      device,
      publicationGeneration,
      collectionAdmissionId: admissionId
    });
    if (reason) {
      return blockedContract(source, `entry ${index}: ${reason}`, solidDrawEntries);
    }
  }
  const admittedGroups = Object.freeze(drawGroups.map(admittedDrawGroupSnapshot));
  return Object.freeze({
    schema: ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA,
    status: 'admitted-coherent-solid-draw-entries-ready',
    reason: null,
    ready: true,
    source,
    inputSchema: solidDrawEntries.schema,
    inputStatus: solidDrawEntries.status,
    authorityStatus: solidDrawEntries.authorityStatus,
    device,
    publicationGeneration,
    admissionId,
    sourceEpoch: solidDrawEntries.sourceEpoch ?? null,
    entryCount: admittedGroups.reduce((count, group) => count + group.frameSource.bodyCount, 0),
    drawGroupCount: admittedGroups.length,
    drawGroups: admittedGroups,
    entries: Object.freeze([]),
    frameGenerationIds: Object.freeze(admittedGroups.map((group) => group.generationId)),
    topologyGenerations: Object.freeze(admittedGroups.map((group) => group.topologyGeneration)),
    stateManagerAdmissionIds: Object.freeze(admittedGroups.map((group) => group.stateManagerAdmissionId)),
    stateManagerAdmission,
    presentationLease,
    presentationLeaseRequired: requiresPresentationLease,
    presentationLeaseValidation,
    schedulerOwner: 'peercompute-node-kernel-compute-manager',
    residentBufferOwner: 'peercompute-gpu-hub',
    authoritativeMutationOwner: 'peercompute-state-manager',
    presentationOwnsPhysicsCadence: false,
    sameDeviceRequired: true,
    directFrameStorageBinding: true,
    persistentRestMeshBinding: true,
    cpuTransformRequired: false,
    densityFieldRequired: false,
    marchingCubesRequired: false,
    fullStateReadbackRequired: false,
    hotLoopReadbackRequired: false
  });
}

export function coherentSolidDrawEntriesSignature(contract) {
  if (!contract?.ready) return `blocked:${contract?.status || 'missing'}:${contract?.reason || ''}`;
  return [
    contract.publicationGeneration,
    contract.admissionId,
    objectIdentity(contract.device),
    ...contract.drawGroups.map((group) => [
      group.generationId,
      group.leaseId,
      group.leaseEpoch,
      group.topologyGeneration,
      group.geometryKey,
      group.renderOrder ?? 0,
      group.depthWriteFlag ?? 1,
      group.opacity ?? 1,
      group.exposure ?? 1,
      group.flags ?? 0,
      objectIdentity(group.frameSource?.buffer),
      objectIdentity(group.restMesh?.vertexBuffer),
      objectIdentity(group.restMesh?.indexBuffer),
      objectIdentity(group.gpuDrawRange?.instanceBodyIndexBuffer),
      objectIdentity(group.gpuDrawRange?.drawIndexedIndirectBuffer)
    ].join(':'))
  ].join('|');
}

function entryParamsArray(entry) {
  const buffer = new ArrayBuffer(ENTRY_PARAM_BYTES);
  const view = new DataView(buffer);
  const setU32 = (index, value) => view.setUint32(index * 4, u32(value) ?? 0, true);
  const setF32 = (index, value) => view.setFloat32(index * 4, finiteOr(value, 0), true);
  setU32(0, entry.generationId);
  setU32(1, entry.leaseId);
  setU32(2, entry.leaseEpoch);
  setU32(3, entry.geometryKey ?? entry.restMesh?.geometryKey);
  setU32(4, entry.topologyGeneration);
  setU32(5, entry.flags ?? 0);
  setF32(6, Math.max(0, finiteOr(entry.exposure, 1)));
  setF32(7, 1);
  return buffer;
}

function createPipeline(device, {
  module,
  pipelineLayout,
  format,
  depthFormat,
  label
}) {
  return device.createRenderPipeline({
    label,
    layout: pipelineLayout,
    vertex: { module, entryPoint: 'native_solid_vertex' },
    fragment: {
      module,
      entryPoint: 'native_solid_fragment',
      targets: [{ format }]
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    ...(depthFormat ? {
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less-equal'
      }
    } : {})
  });
}

export function createCoherentSolidNativeWebGpuPipelineBundle({
  device,
  format,
  depthFormat = null
} = {}) {
  if (!device || !format) {
    throw new TypeError('coherent-solid native pipeline bundle requires a device and format');
  }
  for (const method of [
    'createShaderModule',
    'createBindGroupLayout',
    'createPipelineLayout',
    'createRenderPipeline'
  ]) {
    if (typeof device[method] !== 'function') {
      throw new TypeError(`coherent-solid native pipeline bundle requires device.${method}`);
    }
  }
  const module = device.createShaderModule({
    label: 'ulg-coherent-solid-native-bridge',
    code: coherentSolidNativeBridgeWgsl
  });
  const bindGroupLayout = device.createBindGroupLayout({
    label: 'ulg-coherent-solid-native-bridge-bind-group-layout',
    entries: [
      { binding: 0, visibility: GPU_SHADER_STAGE.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPU_SHADER_STAGE.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPU_SHADER_STAGE.VERTEX, buffer: { type: 'uniform' } },
      {
        binding: 3,
        visibility: GPU_SHADER_STAGE.VERTEX | GPU_SHADER_STAGE.FRAGMENT,
        buffer: { type: 'uniform' }
      },
      {
        binding: 4,
        visibility: GPU_SHADER_STAGE.VERTEX,
        buffer: { type: 'read-only-storage' }
      }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    label: 'ulg-coherent-solid-native-bridge-pipeline-layout',
    bindGroupLayouts: [bindGroupLayout]
  });
  const opaquePipeline = createPipeline(device, {
    module,
    pipelineLayout,
    format,
    depthFormat,
    label: 'ulg-coherent-solid-native-opaque-pipeline'
  });
  return Object.freeze({
    schema: NATIVE_PIPELINE_BUNDLE_SCHEMA,
    status: 'coherent-solid-native-pipeline-bundle-ready',
    device,
    format,
    depthFormat: depthFormat || null,
    module,
    bindGroupLayout,
    pipelineLayout,
    opaquePipeline,
    transparentPipeline: null,
    surfaceAlphaMode: 'opaque',
    surfaceBlendEnabled: false,
    surfaceDepthWriteEnabled: true
  });
}

function reusablePipelineBundle(bundle, { device, format, depthFormat }) {
  return bundle?.schema === NATIVE_PIPELINE_BUNDLE_SCHEMA
    && bundle.device === device
    && bundle.format === format
    && bundle.depthFormat === (depthFormat || null);
}

export function createCoherentSolidNativeWebGpuExecutor({
  contract = null,
  device = contract?.device ?? null,
  format = null,
  depthFormat = null,
  cameraBuffer = null,
  pipelineBundle = null,
  presentationLease = contract?.presentationLease ?? null,
  presentationLeaseRequired = contract?.presentationLeaseRequired === true,
  source = 'native-webgpu-surface-bridge'
} = {}) {
  const authorityRevalidationRequired = presentationLeaseRequired || Boolean(presentationLease);
  const validatePresentationAuthority = () => (
    authorityRevalidationRequired
      ? validateCoherentSolidPresentationConsumerLease(presentationLease, {
        device,
        publicationGeneration: contract?.publicationGeneration ?? null,
        admissionId: contract?.admissionId ?? null
      })
      : Object.freeze({
        valid: true,
        status: 'coherent-solid-presentation-consumer-lease-not-required',
        reason: null
      })
  );
  const base = {
    schema: ULG_COHERENT_SOLID_NATIVE_EXECUTOR_SCHEMA,
    source,
    contractSchema: contract?.schema ?? null,
    contractStatus: contract?.status ?? null,
    publicationGeneration: contract?.publicationGeneration ?? null,
    admissionId: contract?.admissionId ?? null,
    ready: false,
    drawCommands: [],
    opaqueDrawCommands: [],
    transparentDrawCommands: [],
    presentationLease,
    presentationLeaseRequired: authorityRevalidationRequired,
    validatePresentationAuthority,
    presentationOwnsPhysicsCadence: false,
    submissionOwnership: 'caller-native-surface-bridge',
    fullStateReadbackRequired: false
  };
  if (!contract?.ready) {
    return { ...base, status: 'blocked-coherent-solid-native-executor-contract', reason: contract?.reason || 'admitted contract required' };
  }
  if (contract.device !== device) {
    return { ...base, status: 'blocked-coherent-solid-native-executor-device', reason: 'contract device differs from executor device' };
  }
  const initialAuthority = validatePresentationAuthority();
  if (initialAuthority.valid !== true) {
    return {
      ...base,
      status: 'blocked-coherent-solid-native-executor-retired-authority',
      reason: initialAuthority.reason,
      presentationAuthorityValidation: initialAuthority
    };
  }
  if (!format || !cameraBuffer) {
    return { ...base, status: 'blocked-coherent-solid-native-executor-render-target', reason: 'format and shared native camera buffer are required' };
  }
  for (const method of ['createBuffer', 'createBindGroup']) {
    if (typeof device?.[method] !== 'function') {
      return { ...base, status: 'blocked-coherent-solid-native-executor-device-api', reason: `device.${method} is required` };
    }
  }
  if (typeof device.queue?.writeBuffer !== 'function') {
    return { ...base, status: 'blocked-coherent-solid-native-executor-device-api', reason: 'device.queue.writeBuffer is required' };
  }
  const pipelineBundleReused = reusablePipelineBundle(pipelineBundle, {
    device,
    format,
    depthFormat
  });
  const bundle = pipelineBundleReused
    ? pipelineBundle
    : createCoherentSolidNativeWebGpuPipelineBundle({ device, format, depthFormat });
  const {
    module,
    bindGroupLayout,
    pipelineLayout,
    opaquePipeline,
    transparentPipeline
  } = bundle;
  const paramAlignment = Math.max(
    1,
    Math.trunc(Number(device.limits?.minUniformBufferOffsetAlignment) || 256)
  );
  const paramStrideBytes = alignTo(ENTRY_PARAM_BYTES, paramAlignment);
  const paramsBufferByteLength = contract.drawGroupCount > 0
    ? (contract.drawGroupCount - 1) * paramStrideBytes + ENTRY_PARAM_BYTES
    : 0;
  const maxBufferSize = Number(device.limits?.maxBufferSize) || Number.POSITIVE_INFINITY;
  if (paramsBufferByteLength > maxBufferSize) {
    return {
      ...base,
      status: 'blocked-coherent-solid-native-executor-params-capacity',
      reason: 'aligned draw-entry parameter storage exceeds device maxBufferSize',
      paramsBufferByteLength,
      maxBufferSize
    };
  }
  const paramsBuffer = paramsBufferByteLength > 0
    ? device.createBuffer({
      label: 'ulg-coherent-solid-native-entry-params',
      size: paramsBufferByteLength,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    })
    : null;
  if (paramsBuffer) {
    const packedParams = new Uint8Array(paramsBufferByteLength);
    contract.drawGroups.forEach((entry, index) => {
      packedParams.set(new Uint8Array(entryParamsArray(entry)), index * paramStrideBytes);
    });
    device.queue.writeBuffer(paramsBuffer, 0, packedParams);
  }
  const drawCommands = contract.drawGroups.map((entry, index) => {
    const transparent = false;
    const bindGroup = device.createBindGroup({
      label: `ulg-coherent-solid-native-entry-${index}-bind-group`,
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: entry.frameSource.buffer } },
        { binding: 1, resource: { buffer: entry.restMesh.vertexBuffer } },
        { binding: 2, resource: { buffer: cameraBuffer } },
        {
          binding: 3,
          resource: {
            buffer: paramsBuffer,
            offset: index * paramStrideBytes,
            size: ENTRY_PARAM_BYTES
          }
        },
        {
          binding: 4,
          resource: { buffer: entry.gpuDrawRange.instanceBodyIndexBuffer }
        }
      ]
    });
    return {
      index,
      entry,
      transparent,
      pipeline: opaquePipeline,
      paramsBuffer,
      paramsOffsetBytes: index * paramStrideBytes,
      bindGroup,
      indexBuffer: entry.restMesh.indexBuffer,
      drawIndexedIndirectBuffer: entry.gpuDrawRange.drawIndexedIndirectBuffer,
      indirectOffsetBytes: entry.gpuDrawRange.indirectOffsetBytes,
      renderOrder: finiteOr(entry.renderOrder, 0)
    };
  }).sort((left, right) => left.renderOrder - right.renderOrder);
  const opaqueDrawCommands = drawCommands.filter((command) => !command.transparent);
  const transparentDrawCommands = [];
  let destroyed = false;
  const executeCommands = (pass, commands, kind) => {
    if (destroyed) {
      return {
        status: 'blocked-coherent-solid-native-executor-destroyed',
        reason: 'coherent-solid native executor was destroyed',
        drawCommandCount: 0,
        indexedIndirectDrawCount: 0
      };
    }
    const presentationAuthorityValidation = validatePresentationAuthority();
    if (presentationAuthorityValidation.valid !== true) {
      return {
        status: 'blocked-coherent-solid-native-executor-retired-authority',
        reason: presentationAuthorityValidation.reason,
        drawCommandCount: 0,
        indexedIndirectDrawCount: 0,
        presentationAuthorityValidation
      };
    }
    if (!pass?.setPipeline || !pass?.setBindGroup || !pass?.setIndexBuffer || !pass?.drawIndexedIndirect) {
      throw new TypeError('coherent-solid native execution requires a GPURenderPassEncoder-like pass');
    }
    for (const command of commands) {
      pass.setPipeline(command.pipeline);
      pass.setBindGroup(0, command.bindGroup);
      pass.setIndexBuffer(command.indexBuffer, 'uint32');
      pass.drawIndexedIndirect(command.drawIndexedIndirectBuffer, command.indirectOffsetBytes);
    }
    return {
      status: `coherent-solid-native-${kind}-submitted-to-pass`,
      drawCommandCount: commands.length,
      indexedIndirectDrawCount: commands.length
    };
  };
  return {
    ...base,
    status: 'coherent-solid-native-executor-ready',
    reason: null,
    ready: true,
    device,
    format,
    depthFormat: depthFormat || null,
    module,
    bindGroupLayout,
    pipelineLayout,
    opaquePipeline,
    transparentPipeline,
    pipelineBundle: bundle,
    pipelineBundleReused,
    cameraBuffer,
    paramsBuffer,
    paramsBufferByteLength,
    paramStrideBytes,
    drawCommands,
    opaqueDrawCommands,
    transparentDrawCommands,
    surfaceAlphaMode: 'opaque',
    surfaceBlendEnabled: false,
    surfaceDepthWriteEnabled: true,
    directResidentFrameStorageBinding: true,
    persistentRestMeshBinding: true,
    cpuFrameTransformUploadPerformed: false,
    densityFieldPathUsed: false,
    gpuCompactedIndirectDraw: true,
    perBodyCpuDrawLoopUsed: false,
    executeOpaque(pass) {
      return executeCommands(pass, opaqueDrawCommands, 'opaque');
    },
    executeTransparent(pass) {
      return executeCommands(pass, transparentDrawCommands, 'transparent');
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      paramsBuffer?.destroy?.();
    }
  };
}
