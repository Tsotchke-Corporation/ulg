import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PARAMS_BYTES,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
  createSchroederSpatialMechanicsFieldViewPlan
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  schroederSpatialMechanicsFieldTopologySuccessorWgsl,
  schroederSpatialMechanicsFieldViewV2Wgsl,
  schroederSpatialMechanicsFieldViewWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldViewWgsl.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V1,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
  ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  validateSchroederSpatialActiveSourceViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialActiveSourceView.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES,
  schroederSpatialPhaseVolumeTransportScratchWordLength
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeTransport.js';
import {
  SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
  ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  createWebGpuStableRadixScanUnique
} from '../webgpuRadixScanUnique.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import { sphGpuIdentityValueMaxForBuffer } from './sphGpuBuffers.js';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};
// The published field ABI remains lexicographic u32x4.  The radix scratch key
// packs the bounded family/material pair into one word, preserving that exact
// order while eliminating eight radix digit rounds per generation.
const FIELD_RADIX_KEY_WORDS = 3;

function significantNibblesForMaximum(maximum, fallback = 8) {
  if (!Number.isInteger(maximum) || maximum < 0 || maximum > 0xffff_ffff) {
    return fallback;
  }
  return Math.max(
    1,
    Math.ceil(Math.max(1, Math.floor(Math.log2(Math.max(1, maximum))) + 1) / 4)
  );
}

function mechanicsFieldSignificantDigitRows(gridNodeCount, identityBuffer) {
  const maximumDenseNode = Math.max(0, Number(gridNodeCount) - 1);
  const denseNodeNibbles = significantNibblesForMaximum(maximumDenseNode);
  const continuityDomainNibbles = significantNibblesForMaximum(
    sphGpuIdentityValueMaxForBuffer(identityBuffer)
  );
  return Object.freeze([
    ...Array.from({ length: continuityDomainNibbles }, (_, index) => index),
    ...Array.from({ length: 7 }, (_, index) => 8 + index),
    ...Array.from({ length: denseNodeNibbles }, (_, index) => 16 + index)
  ]);
}
const FIELD_P2G_CONTRIBUTION_WORDS = 12;
// P2G is a recurring consumer of an in-flight mechanics-field arena. Keep its
// tiny mutable control buffers beside that arena so an exact arena generation
// can reuse both allocations and bind groups after queue-ordered retirement.
// The buffers remain private to the owning execution; no two pending field
// generations can alias them.
const FIELD_P2G_PARAMS_BYTES = 208;
const FIELD_P2G_PRODUCT_ROUTE_CERTIFICATE_PARAMS_BYTES = 32;
const FIELD_P2G_INDIRECT_BYTES = 3 * UINT32_BYTES;
const FIELD_P2G_EMPTY_PRODUCT_EVENT_BYTES = 32 * Float32Array.BYTES_PER_ELEMENT;
const FIELD_GRID_UPDATE_INDIRECT_BYTES = 3 * UINT32_BYTES;
const FIELD_G2P_PARAMS_BYTES = 176;
// The current maximum production mechanics histogram is 7,776 rows. In that
// bounded band one exact GPU invocation removes one command boundary per radix
// digit; larger/general histograms retain the parallel scan.
const FIELD_SERIAL_HISTOGRAM_SCAN_MAX_ELEMENT_COUNT = 8_192;
function positiveInteger(value, label, max = 0xffff_ffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function dispatchShapeForInvocationCount(
  invocationCount,
  workgroupSize,
  maxComputeWorkgroupsPerDimension,
  label
) {
  const count = positiveInteger(invocationCount, `${label} invocationCount`);
  const width = positiveInteger(workgroupSize, `${label} workgroupSize`, 1024);
  const maxDimension = positiveInteger(
    maxComputeWorkgroupsPerDimension,
    `${label} maxComputeWorkgroupsPerDimension`
  );
  const groupCount = Math.ceil(count / width);
  const x = Math.min(groupCount, maxDimension);
  const y = Math.ceil(groupCount / x);
  if (y > maxDimension) {
    throw new RangeError(
      `${label} dispatch requires ${groupCount} workgroups beyond `
      + `${maxDimension}x${maxDimension}`
    );
  }
  return Object.freeze([x, y, 1]);
}

function assertDevice(device) {
  if (
    !device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer
  ) {
    throw new TypeError('mechanics field view requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
    throw new TypeError('mechanics field view encoding requires a GPUCommandEncoder-like object');
  }
}

function createOwnedBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function fieldParamsData(plan, parentExecution, {
  sourceDispatchWorkgroups,
  candidateDispatchWorkgroups,
  dispatchXLimit,
  sourceAuthorityVersion =
    SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1
}) {
  const data = new ArrayBuffer(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (offset, value) => view.setUint32(offset, Number(value) >>> 0, true);
  const i32 = (offset, value) => view.setInt32(offset, Number(value) | 0, true);
  const f32 = (offset, value) => view.setFloat32(offset, Math.fround(Number(value)), true);
  u32(0, plan.sourceCount);
  u32(4, plan.sourceCapacity);
  u32(8, plan.sourceRowStrideFloats);
  u32(12, plan.sourceRowLayoutId);
  u32(16, plan.identityStrideWords);
  i32(20, plan.selectedLevel);
  u32(24, plan.gridNodeCount);
  u32(28, plan.gridDims[0]);
  u32(32, plan.gridDims[1]);
  u32(36, plan.gridDims[2]);
  u32(40, plan.gridShift);
  u32(44, plan.candidateCapacity);
  u32(48, plan.fieldCapacity);
  u32(52, plan.generationId);
  u32(56, plan.deviceOrdinal);
  u32(60, plan.laneOrdinal);
  u32(64, plan.leaseToken);
  u32(68, plan.sourceFamilyId);
  u32(72, plan.storageGeneration);
  u32(76, plan.physicsTick);
  u32(80, plan.physicsSubstep);
  u32(84, plan.positionEpoch);
  u32(88, plan.topologyEpoch);
  u32(92, plan.chartEpoch);
  u32(96, plan.levelEpoch);
  u32(100, plan.supportEpoch);
  u32(104, plan.completionOrdinal);
  u32(108, plan.layout.descriptorOffsetWords);
  u32(112, plan.layout.descriptorWords);
  u32(116, plan.layout.keyOffsetWords);
  u32(120, plan.layout.keyWords);
  u32(124, plan.layout.accumulatorOffsetWords);
  u32(128, plan.layout.accumulatorWords);
  u32(132, plan.layout.stateOffsetWords);
  u32(136, plan.layout.stateWords);
  u32(140, plan.layout.wordLength);
  f32(144, plan.gridSpacingM);
  f32(148, 1 / plan.gridSpacingM);
  u32(152, parentExecution.layout.wordLength);
  u32(156, parentExecution.nodeCapacity);
  u32(160, SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE);
  u32(164, 27);
  // The former route-control words are retained inside the same private
  // 192-byte parameter ABI and now authenticate direct 2D dispatch shapes.
  u32(168, sourceDispatchWorkgroups[0]);
  u32(172, candidateDispatchWorkgroups[0]);
  u32(176, dispatchXLimit);
  u32(180, sourceDispatchWorkgroups[1]);
  u32(184, candidateDispatchWorkgroups[1]);
  // Keep the legacy reserved word bitwise zero. Directory-v2 is the first
  // producer that authenticates this private parameter slot.
  u32(
    188,
    sourceAuthorityVersion
      === SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
      ? sourceAuthorityVersion
      : 0
  );
  return data;
}

function beginTimestampSpan(gpuTimestampRecorder, encoder, descriptor) {
  return gpuTimestampRecorder?.active === true
    && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
    ? gpuTimestampRecorder.beginEncoderSpan(encoder, descriptor)
    : null;
}

function endTimestampSpan(gpuTimestampRecorder, encoder, token) {
  if (!token) return;
  gpuTimestampRecorder.endEncoderSpan(encoder, token);
}

function encodePass(
  encoder,
  pipeline,
  bindGroup,
  workgroups,
  label,
  gpuTimestampRecorder = null,
  timestampDescriptor = null
) {
  const timestampSpan = timestampDescriptor
    ? beginTimestampSpan(gpuTimestampRecorder, encoder, timestampDescriptor)
    : null;
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...workgroups);
  pass.end();
  endTimestampSpan(gpuTimestampRecorder, encoder, timestampSpan);
  return 1;
}

function encodeIndirectPass(
  encoder,
  pipeline,
  bindGroup,
  indirectBuffer,
  indirectOffsetBytes,
  label,
  gpuTimestampRecorder = null,
  timestampDescriptor = null
) {
  const timestampSpan = timestampDescriptor
    ? beginTimestampSpan(gpuTimestampRecorder, encoder, timestampDescriptor)
    : null;
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
    throw new TypeError('mechanics field route requires indirect compute dispatch support');
  }
  pass.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffsetBytes);
  pass.end();
  endTimestampSpan(gpuTimestampRecorder, encoder, timestampSpan);
  return 1;
}

export function createSchroederSpatialMechanicsFieldViewGpu(device, {
  maxSourceCount,
  maxPhysicalSourceCount = maxSourceCount,
  activeSourceCapacity = maxPhysicalSourceCount,
  gridNodeCount,
  gridDims,
  gridShift,
  gridSpacingM,
  identityStrideWords = 1,
  arenaCount = 2,
  enableDirectoryV2 = false,
  label = 'ulg-schroeder-spatial-mechanics-field-view'
} = {}) {
  assertDevice(device);
  const resolvedMaxSourceCount = positiveInteger(
    maxPhysicalSourceCount,
    'maxPhysicalSourceCount'
  );
  if (
    maxSourceCount != null
    && positiveInteger(maxSourceCount, 'maxSourceCount')
      !== resolvedMaxSourceCount
  ) {
    throw new RangeError(
      'maxSourceCount must match maxPhysicalSourceCount when both are supplied'
    );
  }
  const resolvedActiveSourceCapacity = positiveInteger(
    activeSourceCapacity,
    'activeSourceCapacity',
    resolvedMaxSourceCount
  );
  const resolvedIdentityStrideWords = positiveInteger(
    identityStrideWords,
    'identityStrideWords',
    16
  );
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const template = createSchroederSpatialMechanicsFieldViewPlan({
    sourceCount: 1,
    sourceCapacity: resolvedMaxSourceCount,
    activeSourceCapacity: resolvedActiveSourceCapacity,
    sourceAuthorityVersion:
      resolvedActiveSourceCapacity === resolvedMaxSourceCount
        ? SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1
        : SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
    identityStrideWords: resolvedIdentityStrideWords,
    selectedLevel: 0,
    gridNodeCount,
    gridDims,
    gridShift,
    gridSpacingM,
    generationId: 1,
    deviceOrdinal: 0,
    laneOrdinal: 0,
    leaseToken: 0,
    sourceFamilyId: 0,
    storageGeneration: 1,
    physicsTick: 0,
    physicsSubstep: 0,
    positionEpoch: 0,
    topologyEpoch: 0,
    chartEpoch: 0,
    levelEpoch: 0,
    supportEpoch: 0
  });
  const maxBufferSize = positiveInteger(
    device.limits?.maxBufferSize ?? 256 * 1024 * 1024,
    'device.limits.maxBufferSize',
    Number.MAX_SAFE_INTEGER
  );
  const maxStorageBufferBindingSize = positiveInteger(
    device.limits?.maxStorageBufferBindingSize ?? maxBufferSize,
    'device.limits.maxStorageBufferBindingSize',
    Number.MAX_SAFE_INTEGER
  );
  const maxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension',
    65535
  );
  const candidateKeyByteLength = template.layout.candidateCapacity
    * FIELD_P2G_CONTRIBUTION_WORDS
    * UINT32_BYTES;
  const sourceByteLength = resolvedMaxSourceCount * 16 * Float32Array.BYTES_PER_ELEMENT;
  const identityByteLength = resolvedMaxSourceCount
    * resolvedIdentityStrideWords
    * UINT32_BYTES;
  for (const [role, byteLength] of [
    ['mechanics field view', template.layout.byteLength],
    ['mechanics field candidates', candidateKeyByteLength],
    ['mechanics field source', sourceByteLength],
    ['mechanics field identity', identityByteLength]
  ]) {
    if (byteLength > maxBufferSize || byteLength > maxStorageBufferBindingSize) {
      throw new RangeError(`${role} requires ${byteLength} bytes beyond device capacity`);
    }
  }
  dispatchShapeForInvocationCount(
    resolvedMaxSourceCount,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
    maxComputeWorkgroupsPerDimension,
    'mechanics field source'
  );
  dispatchShapeForInvocationCount(
    template.layout.candidateCapacity,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
    maxComputeWorkgroupsPerDimension,
    'mechanics field candidate'
  );
  if (typeof enableDirectoryV2 !== 'boolean') {
    throw new TypeError('enableDirectoryV2 must be a boolean');
  }
  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: schroederSpatialMechanicsFieldViewWgsl
  });
  const pipelines = Object.freeze({
    emit: device.createComputePipeline({
      label: `${label}-emit-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'emit_field_candidates' }
    }),
    assemble: device.createComputePipeline({
      label: `${label}-assemble-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'assemble_field_keys' }
    }),
    materializeStencilMap: device.createComputePipeline({
      label: `${label}-materialize-stencil-map-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'materialize_stencil_field_indices' }
    }),
    finalize: device.createComputePipeline({
      label: `${label}-finalize-pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'finalize_field_view' }
    })
  });
  const topologySuccessorModule = device.createShaderModule({
    label: `${label}-topology-successor-shader`,
    code: schroederSpatialMechanicsFieldTopologySuccessorWgsl
  });
  const topologySuccessorPipeline = device.createComputePipeline({
    label: `${label}-topology-successor-pipeline`,
    layout: 'auto',
    compute: {
      module: topologySuccessorModule,
      entryPoint: 'finalize_topology_successor'
    }
  });
  const v2Pipelines = enableDirectoryV2
    ? (() => {
        const v2Module = device.createShaderModule({
          label: `${label}-directory-v2-shader`,
          code: schroederSpatialMechanicsFieldViewV2Wgsl
        });
        return Object.freeze({
          emit: device.createComputePipeline({
            label: `${label}-directory-v2-emit-pipeline`,
            layout: 'auto',
            compute: { module: v2Module, entryPoint: 'emit_field_candidates_v2' }
          }),
          assemble: device.createComputePipeline({
            label: `${label}-directory-v2-assemble-pipeline`,
            layout: 'auto',
            compute: { module: v2Module, entryPoint: 'assemble_field_keys_v2' }
          }),
          materializeStencilMap: device.createComputePipeline({
            label: `${label}-directory-v2-materialize-stencil-map-pipeline`,
            layout: 'auto',
            compute: {
              module: v2Module,
              entryPoint: 'materialize_stencil_field_indices_v2'
            }
          }),
          finalize: device.createComputePipeline({
            label: `${label}-directory-v2-finalize-pipeline`,
            layout: 'auto',
            compute: { module: v2Module, entryPoint: 'finalize_field_view' }
          })
        });
      })()
    : null;
  const deviceId = webGpuDeviceId(device);
  let destroyed = false;
  let deviceLossObserved = false;
  let serial = 0;
  let runtime = null;
  const executionOwnership = new WeakMap();
  const executionRetirements = new WeakMap();
  const mutationSequenceOwnership = new WeakMap();
  const mutationSegmentOwnership = new WeakMap();
  const mutationTokenSequenceOwnership = new WeakMap();
  const publicationLockOwnership = new WeakMap();
  const publicationCapabilityOwnership = new WeakMap();
  const retiredQuarantineReasons = new WeakMap();
  const releasedExecutions = new WeakSet();
  const submittedExecutions = new WeakSet();
  const releaseInFlight = new WeakSet();

  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const arenaLabel = `${label}-arena-${arenaIndex}`;
    const radix = createWebGpuStableRadixScanUnique(device, {
      maxElementCount: template.layout.candidateCapacity,
      maxKeyWordCount: FIELD_RADIX_KEY_WORDS,
      label: `${arenaLabel}-radix`,
      maxComputeWorkgroupsPerDimension,
      retainConstantScanParamsBuffers: true,
      retainVariableScanParamsBuffers: true,
      serialHistogramScanMaxElementCount:
        FIELD_SERIAL_HISTOGRAM_SCAN_MAX_ELEMENT_COUNT,
      retainedParamsSlotCount: 1
    });
    if (enableDirectoryV2) {
      radix.prepareGpuCountResources();
    }
    return {
      arenaIndex,
      inUse: false,
      token: null,
      retired: false,
      quarantined: false,
      destroyedOwnedBuffers: new Set(),
      radixDeviceLossRetired: false,
      bindGroupCache: new Map(),
      p2gWorkspace: Object.freeze({
        paramsBuffer: createOwnedBuffer(
          device,
          'ulg-mls-mpm-p2g-mechanics-field-params',
          FIELD_P2G_PARAMS_BYTES,
          GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        ),
        productRouteCertificateParamsBuffer: createOwnedBuffer(
          device,
          'ulg-mls-mpm-p2g-mechanics-field-product-route-certificate-params',
          FIELD_P2G_PRODUCT_ROUTE_CERTIFICATE_PARAMS_BYTES,
          GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        ),
        compactMechanicsIndirectBuffer: createOwnedBuffer(
          device,
          'ulg-mls-mpm-staged-p2g-compact-mechanics-indirect',
          FIELD_P2G_INDIRECT_BYTES,
          GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.INDIRECT
        ),
        mechanicsFieldIndirectBuffer: createOwnedBuffer(
          device,
          'ulg-mls-mpm-staged-p2g-mechanics-field-indirect',
          FIELD_P2G_INDIRECT_BYTES,
          GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.INDIRECT
        ),
        emptyProductEventBuffer: createOwnedBuffer(
          device,
          'ulg-mls-mpm-p2g-resident-product-events-in',
          FIELD_P2G_EMPTY_PRODUCT_EVENT_BYTES,
          GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
        )
      }),
      gridUpdateWorkspace: Object.freeze({
        paramsBuffer: createOwnedBuffer(
          device,
          'ulg-mls-mpm-mechanics-field-grid-update-params',
          SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES,
          GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        ),
        indirectBuffer: createOwnedBuffer(
          device,
          'ulg-mls-mpm-mechanics-field-grid-update-indirect',
          FIELD_GRID_UPDATE_INDIRECT_BYTES,
          GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.INDIRECT
        ),
        transportScratchBuffer: createOwnedBuffer(
          device,
          'ulg-schroeder-phase-volume-transport-scratch',
          schroederSpatialPhaseVolumeTransportScratchWordLength(
            template.layout.fieldCapacity
          ) * UINT32_BYTES,
          GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
        )
      }),
      g2pWorkspace: Object.freeze({
        paramsBuffer: createOwnedBuffer(
          device,
          'ulg-mls-mpm-g2p-params',
          FIELD_G2P_PARAMS_BYTES,
          GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        )
      }),
      paramsBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-params`,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      candidateKeyBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-candidate-keys`,
        candidateKeyByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      fieldViewBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-field-view`,
        template.layout.byteLength,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.INDIRECT
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      topologySuccessorOrderBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-topology-successor-order`,
        template.layout.candidateCapacity * UINT32_BYTES,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      radix
    };
  });

  const allocationEntriesForArena = (arena) => [
    { role: 'mechanics-field-params', arenaIndex: arena.arenaIndex, buffer: arena.paramsBuffer },
    {
      role: 'mechanics-field-p2g-params',
      arenaIndex: arena.arenaIndex,
      buffer: arena.p2gWorkspace.paramsBuffer
    },
    {
      role: 'mechanics-field-p2g-product-route-certificate-params',
      arenaIndex: arena.arenaIndex,
      buffer: arena.p2gWorkspace.productRouteCertificateParamsBuffer
    },
    {
      role: 'mechanics-field-p2g-compact-mechanics-indirect',
      arenaIndex: arena.arenaIndex,
      buffer: arena.p2gWorkspace.compactMechanicsIndirectBuffer
    },
    {
      role: 'mechanics-field-p2g-mechanics-field-indirect',
      arenaIndex: arena.arenaIndex,
      buffer: arena.p2gWorkspace.mechanicsFieldIndirectBuffer
    },
    {
      role: 'mechanics-field-p2g-empty-product-event',
      arenaIndex: arena.arenaIndex,
      buffer: arena.p2gWorkspace.emptyProductEventBuffer
    },
    {
      role: 'mechanics-field-grid-update-params',
      arenaIndex: arena.arenaIndex,
      buffer: arena.gridUpdateWorkspace.paramsBuffer
    },
    {
      role: 'mechanics-field-grid-update-indirect',
      arenaIndex: arena.arenaIndex,
      buffer: arena.gridUpdateWorkspace.indirectBuffer
    },
    {
      role: 'mechanics-field-grid-update-transport-scratch',
      arenaIndex: arena.arenaIndex,
      buffer: arena.gridUpdateWorkspace.transportScratchBuffer
    },
    {
      role: 'mechanics-field-g2p-params',
      arenaIndex: arena.arenaIndex,
      buffer: arena.g2pWorkspace.paramsBuffer
    },
    { role: 'mechanics-field-candidate-keys', arenaIndex: arena.arenaIndex, buffer: arena.candidateKeyBuffer },
    { role: 'mechanics-field-view', arenaIndex: arena.arenaIndex, buffer: arena.fieldViewBuffer },
    {
      role: 'mechanics-field-topology-successor-order',
      arenaIndex: arena.arenaIndex,
      buffer: arena.topologySuccessorOrderBuffer
    },
    ...arena.radix.allocationEntries().map((entry) => ({
      ...entry,
      role: `mechanics-field-${entry.role}`,
      arenaIndex: arena.arenaIndex
    }))
  ];
  const retainedGpuBufferBytes = arenas.reduce((sum, arena) => (
    sum + allocationEntriesForArena(arena).reduce(
      (arenaSum, entry) => arenaSum + Number(entry.buffer?.size ?? 0),
      0
    )
  ), 0);

  function acquireArena() {
    if (destroyed) throw new Error('mechanics field view runtime is destroyed');
    if (deviceLossObserved) {
      const error = new Error('mechanics field view runtime observed device loss');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_DEVICE_LOST';
      throw error;
    }
    const arena = arenas.find((candidate) => (
      candidate.inUse === false && candidate.retired !== true
    ));
    if (!arena) {
      const error = new Error('mechanics field view arenas are under backpressure');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_ARENA_EXHAUSTED';
      throw error;
    }
    const token = Object.freeze({ serial: ++serial, arenaIndex: arena.arenaIndex });
    arena.inUse = true;
    arena.token = token;
    return { arena, token };
  }

  function releaseArena(arena, token) {
    if (!arena.inUse || arena.token !== token) return false;
    arena.inUse = false;
    arena.token = null;
    return true;
  }

  function destroyArenaOwnedBuffersAfterDeviceLoss(arena) {
    const failures = [];
    for (const { buffer } of allocationEntriesForArena(arena)) {
      if (!buffer || arena.destroyedOwnedBuffers.has(buffer)) continue;
      try {
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      } catch (error) {
        if (buffer.destroyed === true) {
          arena.destroyedOwnedBuffers.add(buffer);
        } else {
          failures.push(error);
        }
      }
    }
    if (failures.length > 0) {
      throw failures.length === 1
        ? failures[0]
        : new AggregateError(
          failures,
          'mechanics field device-loss arena retirement was incomplete'
        );
    }
    arena.radixDeviceLossRetired = true;
    return true;
  }

  function createExecutionRetirementRecord(execution, ownership) {
    let resolveCompletion;
    const completionPromise = new Promise((resolve) => {
      resolveCompletion = resolve;
    });
    const record = {
      execution,
      ownership,
      completed: false,
      completionPromise,
      resolveCompletion,
      activeAttempt: null,
      nextAttemptOrdinal: 0,
      deviceLossEvidence: null
    };
    executionRetirements.set(execution, record);
    return record;
  }

  function retirementRecordFor(execution) {
    const record = executionRetirements.get(execution);
    if (
      !record
      || execution?.ownerRuntime !== runtime
      || execution.arenaIndex !== record.ownership.arena.arenaIndex
      || execution.arenaGeneration !== record.ownership.token.serial
    ) {
      const error = new Error(
        'mechanics field view execution is not owned by this runtime'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_FOREIGN_EXECUTION';
      throw error;
    }
    return record;
  }

  const bindingResourcesMatch = (left, right) => {
    if (left === right) return true;
    const leftBuffer = left?.buffer ?? null;
    const rightBuffer = right?.buffer ?? null;
    return Boolean(
      leftBuffer
      && rightBuffer
      && leftBuffer === rightBuffer
      && (left.offset ?? 0) === (right.offset ?? 0)
      && (left.size ?? null) === (right.size ?? null)
    );
  };

  function createBindings(
    arena,
    cacheKey,
    pipeline,
    resources,
    bindings,
    bindLabel
  ) {
    const boundResources = bindings.map((binding) => resources.get(binding));
    const cached = arena.bindGroupCache.get(cacheKey);
    if (
      cached?.pipeline === pipeline
      && cached.bindings.length === bindings.length
      && cached.bindings.every((binding, index) => (
        binding === bindings[index]
        && bindingResourcesMatch(
          cached.resources[index],
          boundResources[index]
        )
      ))
    ) {
      return cached.bindGroup;
    }
    const bindGroup = device.createBindGroup({
      label: bindLabel,
      layout: pipeline.getBindGroupLayout(0),
      entries: bindings.map((binding, index) => ({
        binding,
        resource: boundResources[index]
      }))
    });
    arena.bindGroupCache.set(cacheKey, {
      pipeline,
      bindings: [...bindings],
      resources: boundResources,
      bindGroup
    });
    return bindGroup;
  }

  function p2gWorkspaceForExecution(execution) {
    return ownershipFor(execution).arena.p2gWorkspace;
  }

  function gridUpdateWorkspaceForExecution(execution) {
    return ownershipFor(execution).arena.gridUpdateWorkspace;
  }

  function g2pWorkspaceForExecution(execution) {
    return ownershipFor(execution).arena.g2pWorkspace;
  }

  function createExactConsumerBindGroup(execution, {
    cacheKey,
    layout,
    entries,
    label: bindLabel
  } = {}) {
    if (typeof cacheKey !== 'string' || cacheKey.length < 1) {
      throw new TypeError('exact consumer bind-group cacheKey is required');
    }
    if (!layout || !Array.isArray(entries) || entries.length < 1) {
      throw new TypeError('exact consumer bind-group layout and entries are required');
    }
    const { arena } = ownershipFor(execution);
    const exactCacheKey = `consumer:${cacheKey}`;
    const cached = arena.bindGroupCache.get(exactCacheKey);
    if (
      cached?.layout === layout
      && cached.entries.length === entries.length
      && cached.entries.every((entry, index) => (
        entry.binding === entries[index].binding
        && bindingResourcesMatch(entry.resource, entries[index].resource)
      ))
    ) {
      return cached.bindGroup;
    }
    const bindGroup = device.createBindGroup({
      label: bindLabel,
      layout,
      entries
    });
    arena.bindGroupCache.set(exactCacheKey, {
      layout,
      entries: entries.map((entry) => ({
        binding: entry.binding,
        resource: entry.resource
      })),
      bindGroup
    });
    return bindGroup;
  }

  function encode(encoder, {
    sourceBuffer,
    identityBuffer,
    sourceCount,
    sourceRowLayoutId,
    identityStrideWords: requestedIdentityStrideWords = resolvedIdentityStrideWords,
    selectedLevel,
    parentMechanicsView,
    forceRadixFallback = false,
    gpuTimestampRecorder = null,
    timestampMetadata = {}
  } = {}) {
    assertEncoder(encoder);
    if (!sourceBuffer || !webGpuBufferMatchesDevice(sourceBuffer, device)) {
      throw new TypeError('mechanics field sourceBuffer must belong to the runtime device');
    }
    if (!identityBuffer || !webGpuBufferMatchesDevice(identityBuffer, device)) {
      throw new TypeError('mechanics field identityBuffer must belong to the runtime device');
    }
    const resolvedSourceCount = positiveInteger(
      sourceCount,
      'sourceCount',
      resolvedMaxSourceCount
    );
    const resolvedStride = positiveInteger(
      requestedIdentityStrideWords,
      'identityStrideWords',
      16
    );
    if (resolvedStride !== resolvedIdentityStrideWords) {
      throw new RangeError('mechanics field identity stride does not match the retained runtime');
    }
    if (typeof forceRadixFallback !== 'boolean') {
      throw new TypeError('forceRadixFallback must be a boolean');
    }
    const sourceAuthorityVersion = parentMechanicsView?.sourceAuthorityVersion
      ?? SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1;
    const parentDirectoryAbiVersion =
      parentMechanicsView?.directoryAbiVersion
        ?? SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V1;
    const directoryV2 =
      sourceAuthorityVersion
        === SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
      && parentDirectoryAbiVersion
        === SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2;
    if (
      !directoryV2
      && resolvedActiveSourceCapacity !== resolvedMaxSourceCount
    ) {
      throw new TypeError(
        'reduced active-capacity field runtime requires directory-v2 authority'
      );
    }
    if (
      (
        sourceAuthorityVersion
          !== SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1
        && sourceAuthorityVersion
          !== SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
      )
      || (
        parentDirectoryAbiVersion
          !== SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V1
        && parentDirectoryAbiVersion
          !== SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2
      )
      || sourceAuthorityVersion !== parentDirectoryAbiVersion
    ) {
      throw new TypeError(
        'mechanics field parent source and directory authorities must agree'
      );
    }
    if (directoryV2 && !enableDirectoryV2) {
      const error = new Error(
        'mechanics field directory-v2 resources were not prepared at runtime creation'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_V2_NOT_PREPARED';
      throw error;
    }
    if (directoryV2 && forceRadixFallback) {
      throw new TypeError(
        'mechanics field directory-v2 requires authenticated GPU-count radix'
      );
    }
    let parentOwned = false;
    try {
      parentOwned = parentMechanicsView?.ownerRuntime?.ownsExecution?.(
        parentMechanicsView
      ) === true;
    } catch {
      parentOwned = false;
    }
    const commonParentAdmitted =
      parentMechanicsView?.schema === ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA
      && parentMechanicsView.status === 'schroeder-spatial-mechanics-view-gpu-encoded'
      && parentMechanicsView.submitPerformed === false
      && parentMechanicsView.released !== true
      && parentOwned
      && parentMechanicsView.sourceBuffer === sourceBuffer
      && parentMechanicsView.sourceCount === resolvedSourceCount
      && parentMechanicsView.sourceRowLayoutId === sourceRowLayoutId
      && parentMechanicsView.selectedLevel === selectedLevel
      && parentMechanicsView.gridNodeCount === template.gridNodeCount
      && parentMechanicsView.gridShift === template.gridShift
      && Object.is(parentMechanicsView.gridSpacingM, template.gridSpacingM)
      && Array.from(parentMechanicsView.gridDims || []).length === 3
      && Array.from(parentMechanicsView.gridDims || []).every(
        (value, axis) => value === template.gridDims[axis]
      )
      && webGpuBufferMatchesDevice(parentMechanicsView.mechanicsViewBuffer, device);
    if (!commonParentAdmitted) {
      throw new TypeError(
        'mechanics field view requires the exact live encoded compact mechanics parent'
      );
    }
    let spatialExecution = null;
    let activeSourceView = null;
    let activeSourceCountAuthority = null;
    if (directoryV2) {
      spatialExecution = parentMechanicsView.spatialExecution;
      activeSourceView = parentMechanicsView.activeSourceView;
      activeSourceCountAuthority = parentMechanicsView.activeSourceCountAuthority;
      let activeAdmission = { admitted: false };
      let spatialOwned = false;
      try {
        activeAdmission = validateSchroederSpatialActiveSourceViewDescriptor(
          activeSourceView,
          {
            sourceBuffer,
            activeSourceViewBuffer: parentMechanicsView.activeSourceViewBuffer,
            physicalSourceCount: resolvedSourceCount,
            physicalSourceCapacity: resolvedMaxSourceCount,
            generationId: parentMechanicsView.generationId,
            deviceOrdinal: parentMechanicsView.deviceOrdinal,
            laneOrdinal: parentMechanicsView.laneOrdinal,
            leaseToken: parentMechanicsView.leaseToken,
            sourceFamilyId: parentMechanicsView.sourceFamilyId,
            storageGeneration: parentMechanicsView.storageGeneration,
            physicsTick: parentMechanicsView.physicsTick,
            physicsSubstep: parentMechanicsView.physicsSubstep,
            positionEpoch: parentMechanicsView.positionEpoch,
            topologyEpoch: parentMechanicsView.topologyEpoch,
            chartEpoch: parentMechanicsView.chartEpoch,
            levelEpoch: parentMechanicsView.levelEpoch,
            supportEpoch: parentMechanicsView.supportEpoch,
            buildOrdinal: parentMechanicsView.completionOrdinal
          }
        );
        spatialOwned = spatialExecution?.ownerRuntime?.ownsExecution?.(
          spatialExecution
        ) === true;
      } catch {
        activeAdmission = { admitted: false };
        spatialOwned = false;
      }
      const spatialLineageMatchesParent = [
        'generationId',
        'deviceOrdinal',
        'laneOrdinal',
        'leaseToken',
        'sourceFamilyId',
        'storageGeneration',
        'physicsTick',
        'physicsSubstep',
        'positionEpoch',
        'topologyEpoch',
        'chartEpoch',
        'levelEpoch',
        'supportEpoch'
      ].every((field) => (
        Object.is(spatialExecution?.[field], parentMechanicsView[field])
      ));
      if (
        parentMechanicsView.directorySchema
          !== ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
        || parentMechanicsView.directoryAbiVersion
          !== SCHROEDER_SPATIAL_EPOCH_V2_VERSION
        || parentMechanicsView.sourceWorkIdentity !== 'gpu-active-ordinal'
        || parentMechanicsView.physicalSourceCount !== resolvedSourceCount
        || spatialExecution?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
        || spatialExecution.abiVersion !== SCHROEDER_SPATIAL_EPOCH_V2_VERSION
        || spatialExecution.layout?.schema
          !== ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
        || spatialExecution.reverseEncoding
          !== SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE
        || spatialExecution.physicalSourceCount !== resolvedSourceCount
        || spatialExecution.physicalSourceCapacity !== resolvedMaxSourceCount
        || spatialExecution.activeSourceCapacity
          !== resolvedActiveSourceCapacity
        || spatialExecution.sourceBuffer !== sourceBuffer
        || spatialExecution.buildOrdinal
          !== parentMechanicsView.completionOrdinal
        || !spatialLineageMatchesParent
        || spatialExecution.directoryBuffer
          !== parentMechanicsView.directoryBuffer
        || spatialExecution.activeSourceView !== activeSourceView
        || spatialExecution.activeSourceCountAuthority
          !== activeSourceCountAuthority
        || spatialExecution.activeSourceViewBuffer
          !== activeSourceView.activeSourceViewBuffer
        || !spatialOwned
        || activeAdmission.admitted !== true
        || activeSourceView.activeSourceViewBuffer
          !== parentMechanicsView.activeSourceViewBuffer
        || activeSourceView.buildOrdinal
          !== parentMechanicsView.completionOrdinal
        || activeSourceCountAuthority?.activeSourceView !== activeSourceView
        || activeSourceCountAuthority?.buffer
          !== activeSourceView.activeSourceViewBuffer
        || activeSourceCountAuthority?.offsetWords !== 18
        || activeSourceCountAuthority?.offsetBytes !== 18 * UINT32_BYTES
        || activeSourceCountAuthority?.capacity
          !== activeSourceView.activeSourceCapacity
        || activeSourceView.activeSourceCapacity
          !== resolvedActiveSourceCapacity
        || parentMechanicsView.activeSourceDispatchOffsetBytes
          !== activeSourceView.activeDispatchOffsetBytes
        || !webGpuBufferMatchesDevice(spatialExecution.directoryBuffer, device)
        || !webGpuBufferMatchesDevice(
          activeSourceView.activeSourceViewBuffer,
          device
        )
      ) {
        throw new TypeError(
          'mechanics field directory-v2 requires exact active-source and spatial lineage'
        );
      }
    }
    const requiredSourceBytes = resolvedSourceCount * 16 * Float32Array.BYTES_PER_ELEMENT;
    const requiredIdentityBytes = resolvedSourceCount * resolvedStride * UINT32_BYTES;
    if (Number(sourceBuffer.size) < requiredSourceBytes) {
      throw new RangeError('mechanics field sourceBuffer is smaller than the admitted source family');
    }
    if (Number(identityBuffer.size) < requiredIdentityBytes) {
      throw new RangeError('mechanics field identityBuffer is smaller than the admitted source family');
    }
    const plan = createSchroederSpatialMechanicsFieldViewPlan({
      sourceCount: resolvedSourceCount,
      sourceCapacity: resolvedMaxSourceCount,
      activeSourceCapacity: resolvedActiveSourceCapacity,
      sourceAuthorityVersion,
      sourceRowLayoutId,
      identityStrideWords: resolvedStride,
      selectedLevel,
      gridNodeCount: template.gridNodeCount,
      gridDims: template.gridDims,
      gridShift: template.gridShift,
      gridSpacingM: template.gridSpacingM,
      generationId: parentMechanicsView.generationId,
      deviceOrdinal: parentMechanicsView.deviceOrdinal,
      laneOrdinal: parentMechanicsView.laneOrdinal,
      leaseToken: parentMechanicsView.leaseToken,
      sourceFamilyId: parentMechanicsView.sourceFamilyId,
      storageGeneration: parentMechanicsView.storageGeneration,
      physicsTick: parentMechanicsView.physicsTick,
      physicsSubstep: parentMechanicsView.physicsSubstep,
      positionEpoch: parentMechanicsView.positionEpoch,
      topologyEpoch: parentMechanicsView.topologyEpoch,
      chartEpoch: parentMechanicsView.chartEpoch,
      levelEpoch: parentMechanicsView.levelEpoch,
      supportEpoch: parentMechanicsView.supportEpoch,
      completionOrdinal: parentMechanicsView.completionOrdinal
    });
    const { arena, token } = acquireArena();
    let radixUnique = null;
    try {
      const stageTimestampMetadata = {
        ...timestampMetadata,
        generationId: plan.generationId,
        selectedLevel: plan.selectedLevel,
        sourceCount: plan.sourceCount,
        candidateCount: plan.candidateCount,
        candidateCountSource: directoryV2
          ? 'active-source-view-word-43'
          : 'host-physical-source-count-times-27'
      };
      const selectedPipelines = directoryV2 ? v2Pipelines : pipelines;
      const sourceDispatchWorkgroups = directoryV2
        ? null
        : dispatchShapeForInvocationCount(
            plan.sourceCount,
            SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
            maxComputeWorkgroupsPerDimension,
            'mechanics field source'
          );
      const candidateDispatchWorkgroups = directoryV2
        ? null
        : dispatchShapeForInvocationCount(
            plan.candidateCount,
            SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
            maxComputeWorkgroupsPerDimension,
            'mechanics field candidate'
          );
      encoder.clearBuffer(
        arena.fieldViewBuffer,
        0,
        plan.layout.keyOffsetWords * UINT32_BYTES
      );
      const commonResources = new Map([
        [0, { buffer: sourceBuffer, offset: 0, size: requiredSourceBytes }],
        [1, { buffer: identityBuffer, offset: 0, size: requiredIdentityBytes }],
        [2, { buffer: arena.candidateKeyBuffer }],
        [3, { buffer: arena.fieldViewBuffer }],
        [6, { buffer: parentMechanicsView.mechanicsViewBuffer }],
        [7, { buffer: arena.paramsBuffer }],
        ...(directoryV2
          ? [
              [10, {
                buffer: spatialExecution.directoryBuffer,
                offset: 0,
                size: spatialExecution.layout.byteLength
              }],
              [11, {
                buffer: activeSourceView.activeSourceViewBuffer,
                offset: 0,
                size: activeSourceView.layout.byteLength
              }]
            ]
          : [])
      ]);
      const emitBindGroup = createBindings(
        arena,
        'emit',
        selectedPipelines.emit,
        commonResources,
        directoryV2
          ? [0, 1, 2, 3, 6, 7, 10, 11]
          : [0, 1, 2, 3, 6, 7],
        `${label}-arena-${arena.arenaIndex}-emit-bindings`
      );
      const emissionTimestamp = {
        producerId: 'schroeder-spatial-mechanics-field-candidate-emission',
        stage: 'candidate-emission',
        spanClass: 'same-production-command-encoder',
        ...stageTimestampMetadata
      };
      let encodedDispatchCount = directoryV2
        ? encodeIndirectPass(
            encoder,
            selectedPipelines.emit,
            emitBindGroup,
            activeSourceView.activeSourceViewBuffer,
            activeSourceView.activeDispatchOffsetBytes,
            `${label}EmitCandidatesV2`,
            gpuTimestampRecorder,
            emissionTimestamp
          )
        : encodePass(
            encoder,
            selectedPipelines.emit,
            emitBindGroup,
            sourceDispatchWorkgroups,
            `${label}EmitCandidates`,
            gpuTimestampRecorder,
            emissionTimestamp
          );
      radixUnique = directoryV2
        ? arena.radix.encodeSortUniqueGpuCount(encoder, {
            keyBuffer: arena.candidateKeyBuffer,
            authorityBuffer: activeSourceView.activeSourceViewBuffer,
            authorityCountByteOffset: 43 * UINT32_BYTES,
            generationSeal: {
              expected: activeSourceView.buildOrdinal,
              byteOffset: 30 * UINT32_BYTES
            },
            maxElementCount: plan.candidateCapacity,
            keyWordCount: FIELD_RADIX_KEY_WORDS,
            keyStrideWords: FIELD_RADIX_KEY_WORDS,
            significantDigitRows: mechanicsFieldSignificantDigitRows(
              plan.gridNodeCount,
              identityBuffer
            ),
            generationId: plan.generationId,
            consumerWorkgroupSize:
              SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
            retainedParamsSlotIndex: 0,
            gpuTimestampRecorder,
            timestampProducerId:
              'schroeder-spatial-mechanics-field-radix-sort-unique-gpu-count',
            timestampMetadata: {
              parentProducerId:
                'schroeder-spatial-mechanics-field-view-build',
              ...stageTimestampMetadata
            }
          })
        : arena.radix.encodeSortUnique(encoder, {
            keyBuffer: arena.candidateKeyBuffer,
            elementCount: plan.candidateCount,
            keyWordCount: FIELD_RADIX_KEY_WORDS,
            keyStrideWords: FIELD_RADIX_KEY_WORDS,
            generationId: plan.generationId,
            consumerWorkgroupSize:
              SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
            retainedParamsSlotIndex: 0,
            gpuTimestampRecorder,
            sortTimestampProducerId: 'schroeder-spatial-mechanics-field-radix-sort',
            uniqueTimestampProducerId: 'schroeder-spatial-mechanics-field-radix-unique',
            timestampMetadata: {
              parentProducerId: 'schroeder-spatial-mechanics-field-view-build',
              ...stageTimestampMetadata
            }
          });
      encodedDispatchCount += radixUnique.encodedDispatchCount;
      const finalResources = new Map([
        ...commonResources,
        [4, { buffer: radixUnique.uniqueKeysBuffer }],
        [5, { buffer: radixUnique.uniqueEvidenceBuffer }],
        [8, { buffer: radixUnique.sortedIndicesBuffer }],
        [9, { buffer: radixUnique.uniqueGroupIndexBySortedPositionBuffer }]
      ]);
      const stencilMapBindGroup = createBindings(
        arena,
        'stencil-map',
        selectedPipelines.materializeStencilMap,
        finalResources,
        directoryV2
          ? [2, 3, 5, 7, 8, 9, 11]
          : [2, 3, 5, 7, 8, 9],
        `${label}-arena-${arena.arenaIndex}-stencil-map-bindings`
      );
      const assembleBindGroup = createBindings(
        arena,
        'assemble',
        selectedPipelines.assemble,
        finalResources,
        directoryV2
          ? [3, 4, 5, 6, 7, 11]
          : [3, 4, 5, 6, 7],
        `${label}-arena-${arena.arenaIndex}-assemble-bindings`
      );
      const finalizeBindGroup = createBindings(
        arena,
        'finalize',
        selectedPipelines.finalize,
        finalResources,
        directoryV2
          ? [3, 4, 5, 6, 7, 10, 11]
          : [3, 4, 5, 6, 7],
        `${label}-arena-${arena.arenaIndex}-finalize-bindings`
      );
      const encodeCandidateStage = (
        pipeline,
        bindGroup,
        passLabel,
        timestampDescriptor
      ) => (
        directoryV2
          ? encodeIndirectPass(
              encoder,
              pipeline,
              bindGroup,
              activeSourceView.activeSourceViewBuffer,
              activeSourceView.candidateDispatchOffsetBytes,
              passLabel,
              gpuTimestampRecorder,
              timestampDescriptor
            )
          : encodePass(
              encoder,
              pipeline,
              bindGroup,
              candidateDispatchWorkgroups,
              passLabel,
              gpuTimestampRecorder,
              timestampDescriptor
            )
      );
      encodedDispatchCount += encodeCandidateStage(
        selectedPipelines.materializeStencilMap,
        stencilMapBindGroup,
        `${label}MaterializeStencilMap${directoryV2 ? 'V2' : ''}`,
        {
          producerId: 'schroeder-spatial-mechanics-field-stencil-map',
          stage: 'stencil-map',
          spanClass: 'same-production-command-encoder',
          ...stageTimestampMetadata
        }
      );
      encodedDispatchCount += encodeCandidateStage(
        selectedPipelines.assemble,
        assembleBindGroup,
        `${label}AssembleKeys${directoryV2 ? 'V2' : ''}`,
        {
          producerId: 'schroeder-spatial-mechanics-field-key-assembly',
          stage: 'key-assembly',
          spanClass: 'same-production-command-encoder',
          ...stageTimestampMetadata
        }
      );
      encodedDispatchCount += encodePass(
        encoder,
        selectedPipelines.finalize,
        finalizeBindGroup,
        [1, 1, 1],
        `${label}Finalize`,
        gpuTimestampRecorder,
        {
          producerId: 'schroeder-spatial-mechanics-field-finalize',
          stage: 'finalize',
          spanClass: 'same-production-command-encoder',
          ...stageTimestampMetadata
        }
      );
      device.queue.writeBuffer(
        arena.paramsBuffer,
        0,
        fieldParamsData(plan, parentMechanicsView, {
          sourceDispatchWorkgroups: sourceDispatchWorkgroups ?? [0, 0, 0],
          candidateDispatchWorkgroups: candidateDispatchWorkgroups ?? [0, 0, 0],
          dispatchXLimit: maxComputeWorkgroupsPerDimension,
          sourceAuthorityVersion
        })
      );
      const execution = {
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
        status: 'schroeder-spatial-mechanics-field-view-gpu-encoded',
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        sourceBuffer,
        identityBuffer,
        parentMechanicsView,
        sourceAuthorityVersion,
        physicalSourceCount: plan.sourceCount,
        directorySchema: directoryV2
          ? ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
          : null,
        directoryAbiVersion: directoryV2
          ? SCHROEDER_SPATIAL_EPOCH_V2_VERSION
          : null,
        spatialExecution,
        directoryBuffer: spatialExecution?.directoryBuffer ?? null,
        activeSourceView,
        activeSourceViewBuffer:
          activeSourceView?.activeSourceViewBuffer ?? null,
        activeSourceCountAuthority,
        candidateKeyBuffer: arena.candidateKeyBuffer,
        stableCandidateOrderBuffer: radixUnique.sortedIndicesBuffer,
        stableCandidateOrderCount: directoryV2 ? null : plan.candidateCount,
        stableCandidateOrderCountAuthority: directoryV2
          ? Object.freeze({
              buffer: activeSourceView.activeSourceViewBuffer,
              offsetWords: 43,
              sealOffsetWords: 30,
              expectedSeal: activeSourceView.buildOrdinal
            })
          : null,
        stableCandidateOrderPolicy:
          'stable-radix-equal-key-preserves-particle-stencil-candidate-order',
        ownsStableCandidateOrderBuffer: false,
        radixSortKeyWordCount: FIELD_RADIX_KEY_WORDS,
        radixHistogramScanMode: radixUnique.histogramScanMode,
        routeControlBuffer: null,
        routeControlWordLength: 0,
        routeDispatchOffsetWords: 0,
        radixGateOffsetWords: 0,
        radixGateCount: 0,
        forceRadixFallbackRequested: forceRadixFallback,
        constructionRoutePolicy: directoryV2
          ? 'gpu-authenticated-directory-v2-indirect-gpu-count-radix'
          : 'gpu-authenticated-direct-exact-radix',
        directDispatchLinearization:
          'linearGroup=workgroup.x+workgroup.y*dispatchX',
        sourceDispatchWorkgroups,
        candidateDispatchWorkgroups,
        sourceDispatchIndirectBuffer: directoryV2
          ? activeSourceView.activeSourceViewBuffer
          : null,
        sourceDispatchIndirectOffsetBytes: directoryV2
          ? activeSourceView.activeDispatchOffsetBytes
          : null,
        candidateDispatchIndirectBuffer: directoryV2
          ? activeSourceView.activeSourceViewBuffer
          : null,
        candidateDispatchIndirectOffsetBytes: directoryV2
          ? activeSourceView.candidateDispatchOffsetBytes
          : null,
        maxComputeWorkgroupsPerDimension,
        constructionDispatchEvidence: directoryV2
          ? Object.freeze({
              workgroupSize:
                SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
              linearization:
                'linearGroup=workgroup.x+workgroup.y*dispatchX',
              sourceWorkIdentity: 'gpu-active-ordinal',
              sourceInvocationCountAuthority: Object.freeze({
                buffer: activeSourceView.activeSourceViewBuffer,
                offsetWords: 18
              }),
              candidateInvocationCountAuthority: Object.freeze({
                buffer: activeSourceView.activeSourceViewBuffer,
                offsetWords: 43
              }),
              generationSealAuthority: Object.freeze({
                buffer: activeSourceView.activeSourceViewBuffer,
                offsetWords: 30,
                expected: activeSourceView.buildOrdinal
              }),
              maxComputeWorkgroupsPerDimension,
              authenticatedByGpuFinalizer: true,
              hostActiveCountReadbackRequired: false
            })
          : Object.freeze({
              workgroupSize:
                SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
              linearization:
                'linearGroup=workgroup.x+workgroup.y*dispatchX',
              maxComputeWorkgroupsPerDimension,
              sourceInvocationCount: plan.sourceCount,
              sourceWorkgroups: sourceDispatchWorkgroups,
              candidateInvocationCount: plan.candidateCount,
              candidateWorkgroups: candidateDispatchWorkgroups,
              authenticatedByGpuFinalizer: true
            }),
        consumerDispatchWorkgroupSize:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
        consumerDispatchDimensions: 2,
        consumerDispatchLinearization:
          'linearGroup=workgroup.x+workgroup.y*dispatchX',
        consumerDispatchCapacityPolicy:
          'gpu-finalized-device-limit-bounded-x-y-zero-on-reject',
        fieldViewBuffer: arena.fieldViewBuffer,
        indirectDispatchBuffer: arena.fieldViewBuffer,
        indirectDispatchOffsetBytes:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS * UINT32_BYTES,
        encodedDispatchCount,
        encodedComputePassCount: 4 + radixUnique.encodedComputePassCount,
        retainedGpuBufferBytes,
        retainedMemoryScaling: 'physical-source-capacity',
        computeDispatchScaling: directoryV2
          ? 'gpu-active-source-count-and-occupied-field-count'
          : 'physical-source-count-and-occupied-field-count',
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        readbackPerformed: false,
        submitPerformed: false,
        submissionOwnership: 'caller',
        uniqueOrdering: 'stable-lexicographic-u32x4'
      };
      Object.defineProperty(execution, 'ownerRuntime', {
        value: runtime,
        enumerable: false
      });
      Object.defineProperty(execution, 'released', {
        get() {
          return releasedExecutions.has(execution);
        },
        enumerable: true
      });
      const ownership = {
        arena,
        token,
        radixUnique,
        stableCandidateOrderBuffer: radixUnique.sortedIndicesBuffer,
        stableCandidateOrderCount: directoryV2 ? null : plan.candidateCount,
        stableCandidateOrderCountAuthority: directoryV2
          ? execution.stableCandidateOrderCountAuthority
          : null,
        stableCandidateOrderPolicy:
          'stable-radix-equal-key-preserves-particle-stencil-candidate-order',
        sourceBuffer,
        identityBuffer,
        parentMechanicsView,
        spatialExecution,
        activeSourceView,
        activeSourceCountAuthority,
        ownsRadixExecution: true,
        topologyPredecessor: null,
        stateMutation: {
          ordinal: 0,
          encoding: 0,
          operation: 'topology-ready',
          pending: null,
          publicationLock: null,
          quarantined: false,
          quarantineReason: null
        }
      };
      executionOwnership.set(execution, ownership);
      createExecutionRetirementRecord(execution, ownership);
      Object.defineProperties(execution, {
        stateMutationOrdinal: {
          get() {
            return executionOwnership.get(execution)?.stateMutation?.ordinal ?? null;
          },
          enumerable: true
        },
        stateMutationEncoding: {
          get() {
            return executionOwnership.get(execution)?.stateMutation?.encoding ?? null;
          },
          enumerable: true
        },
        stateMutationOperation: {
          get() {
            return executionOwnership.get(execution)?.stateMutation?.operation ?? null;
          },
          enumerable: true
        },
        quarantineReason: {
          get() {
            return executionOwnership.get(execution)?.stateMutation?.quarantineReason
              ?? retiredQuarantineReasons.get(execution)
              ?? null;
          },
          enumerable: true
        }
      });
      return execution;
    } catch (error) {
      if (radixUnique) {
        try {
          arena.radix.releaseExecution(radixUnique, { discardedEncoder: true });
        } catch {
          // Preserve the original encoding error.
        }
      }
      releaseArena(arena, token);
      throw error;
    }
  }

  function encodeTopologySuccessor(encoder, {
    topologyPredecessor,
    sourceBuffer,
    identityBuffer,
    sourceCount,
    sourceRowLayoutId,
    identityStrideWords: requestedIdentityStrideWords = resolvedIdentityStrideWords,
    selectedLevel,
    parentMechanicsView,
    gpuTimestampRecorder = null,
    timestampMetadata = {}
  } = {}) {
    assertEncoder(encoder);
    if (typeof encoder.copyBufferToBuffer !== 'function') {
      throw new TypeError(
        'mechanics field topology successor requires GPU buffer-copy support'
      );
    }
    const predecessorOwnership = ownershipFor(topologyPredecessor);
    const predecessorMutation = predecessorOwnership.stateMutation;
    const resolvedSourceCount = positiveInteger(
      sourceCount,
      'sourceCount',
      resolvedMaxSourceCount
    );
    const resolvedStride = positiveInteger(
      requestedIdentityStrideWords,
      'identityStrideWords',
      16
    );
    const predecessorGridMatches =
      Array.from(topologyPredecessor?.gridDims || []).length === 3
      && Array.from(topologyPredecessor.gridDims).every(
        (value, axis) => value === template.gridDims[axis]
      );
    if (
      !enableDirectoryV2
      || topologyPredecessor?.sourceAuthorityVersion
        !== SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
      || !submittedExecutions.has(topologyPredecessor)
      || topologyPredecessor.submitPerformed !== true
      || predecessorMutation.pending !== null
      || predecessorMutation.quarantined === true
      || topologyPredecessor.sourceCount !== resolvedSourceCount
      || topologyPredecessor.sourceCapacity !== resolvedMaxSourceCount
      || topologyPredecessor.activeSourceCapacity
        !== resolvedActiveSourceCapacity
      || topologyPredecessor.identityBuffer !== identityBuffer
      || topologyPredecessor.identityStrideWords !== resolvedStride
      || topologyPredecessor.sourceRowLayoutId !== sourceRowLayoutId
      || topologyPredecessor.selectedLevel !== selectedLevel
      || topologyPredecessor.gridNodeCount !== template.gridNodeCount
      || topologyPredecessor.gridShift !== template.gridShift
      || !Object.is(topologyPredecessor.gridSpacingM, template.gridSpacingM)
      || !predecessorGridMatches
      || topologyPredecessor.layout?.byteLength !== template.layout.byteLength
      || !webGpuBufferMatchesDevice(
        topologyPredecessor.stableCandidateOrderBuffer,
        device
      )
      || Number(topologyPredecessor.stableCandidateOrderBuffer?.size)
        < template.layout.candidateCapacity * UINT32_BYTES
      || !sourceBuffer
      || !webGpuBufferMatchesDevice(sourceBuffer, device)
      || !identityBuffer
      || !webGpuBufferMatchesDevice(identityBuffer, device)
    ) {
      const error = new TypeError(
        'mechanics field topology successor requires one exact submitted directory-v2 predecessor'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_TOPOLOGY_PREDECESSOR';
      throw error;
    }
    const spatialExecution = parentMechanicsView?.spatialExecution ?? null;
    const activeSourceView = parentMechanicsView?.activeSourceView ?? null;
    const activeSourceCountAuthority =
      parentMechanicsView?.activeSourceCountAuthority ?? null;
    let parentOwned = false;
    let activeAdmission = { admitted: false };
    try {
      parentOwned = parentMechanicsView?.ownerRuntime?.ownsExecution?.(
        parentMechanicsView
      ) === true;
      activeAdmission = validateSchroederSpatialActiveSourceViewDescriptor(
        activeSourceView,
        {
          sourceBuffer,
          activeSourceViewBuffer: parentMechanicsView.activeSourceViewBuffer,
          physicalSourceCount: resolvedSourceCount,
          physicalSourceCapacity: resolvedMaxSourceCount,
          generationId: parentMechanicsView.generationId,
          deviceOrdinal: parentMechanicsView.deviceOrdinal,
          laneOrdinal: parentMechanicsView.laneOrdinal,
          leaseToken: parentMechanicsView.leaseToken,
          sourceFamilyId: parentMechanicsView.sourceFamilyId,
          storageGeneration: parentMechanicsView.storageGeneration,
          physicsTick: parentMechanicsView.physicsTick,
          physicsSubstep: parentMechanicsView.physicsSubstep,
          positionEpoch: parentMechanicsView.positionEpoch,
          topologyEpoch: parentMechanicsView.topologyEpoch,
          chartEpoch: parentMechanicsView.chartEpoch,
          levelEpoch: parentMechanicsView.levelEpoch,
          supportEpoch: parentMechanicsView.supportEpoch,
          buildOrdinal: parentMechanicsView.completionOrdinal
        }
      );
    } catch {
      parentOwned = false;
      activeAdmission = { admitted: false };
    }
    const predecessorLineageAdmitted =
      parentMechanicsView?.physicsTick === topologyPredecessor.physicsTick
      && parentMechanicsView.physicsSubstep
        === topologyPredecessor.physicsSubstep + 1
      && parentMechanicsView.positionEpoch
        === topologyPredecessor.positionEpoch + 1
      && parentMechanicsView.storageGeneration
        === topologyPredecessor.storageGeneration + 1
      && parentMechanicsView.topologyEpoch
        === topologyPredecessor.topologyEpoch
      && parentMechanicsView.chartEpoch === topologyPredecessor.chartEpoch
      && parentMechanicsView.levelEpoch === topologyPredecessor.levelEpoch
      && parentMechanicsView.supportEpoch === topologyPredecessor.supportEpoch;
    if (
      parentMechanicsView?.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA
      || parentMechanicsView.status
        !== 'schroeder-spatial-mechanics-view-gpu-encoded'
      || parentMechanicsView.submitPerformed !== false
      || parentMechanicsView.released === true
      || !parentOwned
      || !predecessorLineageAdmitted
      || parentMechanicsView.sourceBuffer !== sourceBuffer
      || parentMechanicsView.sourceCount !== resolvedSourceCount
      || parentMechanicsView.sourceRowLayoutId !== sourceRowLayoutId
      || parentMechanicsView.selectedLevel !== selectedLevel
      || parentMechanicsView.sourceAuthorityVersion
        !== SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
      || parentMechanicsView.directoryAbiVersion
        !== SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2
      || activeAdmission.admitted !== true
      || spatialExecution?.sourceBuffer !== sourceBuffer
      || spatialExecution?.directoryBuffer !== parentMechanicsView.directoryBuffer
      || spatialExecution?.activeSourceView !== activeSourceView
      || activeSourceView?.activeSourceCapacity !== resolvedActiveSourceCapacity
      || activeSourceCountAuthority?.buffer
        !== activeSourceView?.activeSourceViewBuffer
      || activeSourceCountAuthority?.offsetWords !== 18
    ) {
      const error = new TypeError(
        'mechanics field topology successor requires exact fresh parent and frozen lineage'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_TOPOLOGY_SUCCESSOR_LINEAGE';
      throw error;
    }
    const plan = createSchroederSpatialMechanicsFieldViewPlan({
      sourceCount: resolvedSourceCount,
      sourceCapacity: resolvedMaxSourceCount,
      activeSourceCapacity: resolvedActiveSourceCapacity,
      sourceAuthorityVersion:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
      sourceRowLayoutId,
      identityStrideWords: resolvedStride,
      selectedLevel,
      gridNodeCount: template.gridNodeCount,
      gridDims: template.gridDims,
      gridShift: template.gridShift,
      gridSpacingM: template.gridSpacingM,
      generationId: parentMechanicsView.generationId,
      deviceOrdinal: parentMechanicsView.deviceOrdinal,
      laneOrdinal: parentMechanicsView.laneOrdinal,
      leaseToken: parentMechanicsView.leaseToken,
      sourceFamilyId: parentMechanicsView.sourceFamilyId,
      storageGeneration: parentMechanicsView.storageGeneration,
      physicsTick: parentMechanicsView.physicsTick,
      physicsSubstep: parentMechanicsView.physicsSubstep,
      positionEpoch: parentMechanicsView.positionEpoch,
      topologyEpoch: parentMechanicsView.topologyEpoch,
      chartEpoch: parentMechanicsView.chartEpoch,
      levelEpoch: parentMechanicsView.levelEpoch,
      supportEpoch: parentMechanicsView.supportEpoch,
      completionOrdinal: parentMechanicsView.completionOrdinal
    });
    const { arena, token } = acquireArena();
    try {
      const topologyByteLength = plan.layout.accumulatorOffsetWords * UINT32_BYTES;
      const orderByteLength = plan.layout.candidateCapacity * UINT32_BYTES;
      encoder.copyBufferToBuffer(
        topologyPredecessor.fieldViewBuffer,
        0,
        arena.fieldViewBuffer,
        0,
        topologyByteLength
      );
      encoder.clearBuffer(
        arena.fieldViewBuffer,
        topologyByteLength,
        plan.layout.byteLength - topologyByteLength
      );
      encoder.copyBufferToBuffer(
        topologyPredecessor.stableCandidateOrderBuffer,
        0,
        arena.topologySuccessorOrderBuffer,
        0,
        orderByteLength
      );
      device.queue.writeBuffer(
        arena.paramsBuffer,
        0,
        fieldParamsData(plan, parentMechanicsView, {
          sourceDispatchWorkgroups: [0, 0, 0],
          candidateDispatchWorkgroups: [0, 0, 0],
          dispatchXLimit: maxComputeWorkgroupsPerDimension,
          sourceAuthorityVersion:
            SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
        })
      );
      const bindGroup = device.createBindGroup({
        label: `${label}-arena-${arena.arenaIndex}-topology-successor-bindings`,
        layout: topologySuccessorPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: topologyPredecessor.fieldViewBuffer } },
          { binding: 1, resource: { buffer: arena.fieldViewBuffer } },
          { binding: 2, resource: { buffer: parentMechanicsView.mechanicsViewBuffer } },
          { binding: 3, resource: { buffer: activeSourceView.activeSourceViewBuffer } },
          { binding: 4, resource: { buffer: arena.paramsBuffer } }
        ]
      });
      const encodedDispatchCount = encodePass(
        encoder,
        topologySuccessorPipeline,
        bindGroup,
        [1, 1, 1],
        `${label}FinalizeTopologySuccessor`,
        gpuTimestampRecorder,
        {
          producerId: 'schroeder-spatial-mechanics-field-topology-successor',
          stage: 'topology-successor-finalize',
          spanClass: 'same-production-command-encoder',
          ...timestampMetadata,
          generationId: plan.generationId,
          predecessorGenerationId: topologyPredecessor.generationId,
          selectedLevel: plan.selectedLevel,
          sourceCount: plan.sourceCount
        }
      );
      const constructionDispatchEvidence = Object.freeze({
        workgroupSize: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
        linearization: 'linearGroup=workgroup.x+workgroup.y*dispatchX',
        sourceWorkIdentity: 'gpu-active-ordinal',
        sourceInvocationCountAuthority: Object.freeze({
          buffer: activeSourceView.activeSourceViewBuffer,
          offsetWords: 18
        }),
        candidateInvocationCountAuthority: Object.freeze({
          buffer: activeSourceView.activeSourceViewBuffer,
          offsetWords: 43
        }),
        generationSealAuthority: Object.freeze({
          buffer: activeSourceView.activeSourceViewBuffer,
          offsetWords: 30,
          expected: activeSourceView.buildOrdinal
        }),
        maxComputeWorkgroupsPerDimension,
        authenticatedByGpuFinalizer: true,
        hostActiveCountReadbackRequired: false,
        topologySuccessorCopy: true,
        predecessorGenerationId: topologyPredecessor.generationId
      });
      const execution = {
        ...topologyPredecessor,
        ...plan,
        schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
        status: 'schroeder-spatial-mechanics-field-view-gpu-encoded',
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        sourceBuffer,
        identityBuffer,
        parentMechanicsView,
        physicalSourceCount: plan.sourceCount,
        spatialExecution,
        directoryBuffer: spatialExecution.directoryBuffer,
        activeSourceView,
        activeSourceViewBuffer: activeSourceView.activeSourceViewBuffer,
        activeSourceCountAuthority,
        candidateKeyBuffer: arena.candidateKeyBuffer,
        stableCandidateOrderBuffer: arena.topologySuccessorOrderBuffer,
        stableCandidateOrderCount: null,
        stableCandidateOrderCountAuthority: Object.freeze({
          buffer: activeSourceView.activeSourceViewBuffer,
          offsetWords: 43,
          sealOffsetWords: 30,
          expectedSeal: activeSourceView.buildOrdinal
        }),
        ownsStableCandidateOrderBuffer: false,
        radixHistogramScanMode: 'topology-successor-copy',
        constructionRoutePolicy:
          'gpu-authenticated-directory-v2-topology-successor-copy',
        sourceDispatchWorkgroups: null,
        candidateDispatchWorkgroups: null,
        sourceDispatchIndirectBuffer: activeSourceView.activeSourceViewBuffer,
        sourceDispatchIndirectOffsetBytes: activeSourceView.activeDispatchOffsetBytes,
        candidateDispatchIndirectBuffer: activeSourceView.activeSourceViewBuffer,
        candidateDispatchIndirectOffsetBytes:
          activeSourceView.candidateDispatchOffsetBytes,
        constructionDispatchEvidence,
        fieldViewBuffer: arena.fieldViewBuffer,
        indirectDispatchBuffer: arena.fieldViewBuffer,
        indirectDispatchOffsetBytes:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS
            * UINT32_BYTES,
        encodedDispatchCount,
        encodedComputePassCount: 1,
        retainedGpuBufferBytes,
        computeDispatchScaling:
          'gpu-authenticated-coarse-topology-copy-and-occupied-field-count',
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        readbackPerformed: false,
        submitPerformed: false,
        topologyConstructionMode: 'conservative-successor-copy',
        topologyPredecessorGenerationId: topologyPredecessor.generationId
      };
      Object.defineProperty(execution, 'ownerRuntime', {
        value: runtime,
        enumerable: false
      });
      Object.defineProperty(execution, 'released', {
        get() { return releasedExecutions.has(execution); },
        enumerable: true,
        configurable: true
      });
      const ownership = {
        arena,
        token,
        radixUnique: null,
        ownsRadixExecution: false,
        topologyPredecessor,
        stableCandidateOrderBuffer: arena.topologySuccessorOrderBuffer,
        stableCandidateOrderCount: null,
        stableCandidateOrderCountAuthority:
          execution.stableCandidateOrderCountAuthority,
        stableCandidateOrderPolicy: execution.stableCandidateOrderPolicy,
        sourceBuffer,
        identityBuffer,
        parentMechanicsView,
        spatialExecution,
        activeSourceView,
        activeSourceCountAuthority,
        stateMutation: {
          ordinal: 0,
          encoding: 0,
          operation: 'topology-successor-ready',
          pending: null,
          publicationLock: null,
          quarantined: false,
          quarantineReason: null
        }
      };
      executionOwnership.set(execution, ownership);
      createExecutionRetirementRecord(execution, ownership);
      Object.defineProperties(execution, {
        stateMutationOrdinal: {
          get() { return executionOwnership.get(execution)?.stateMutation?.ordinal ?? null; },
          enumerable: true,
          configurable: true
        },
        stateMutationEncoding: {
          get() { return executionOwnership.get(execution)?.stateMutation?.encoding ?? null; },
          enumerable: true,
          configurable: true
        },
        stateMutationOperation: {
          get() { return executionOwnership.get(execution)?.stateMutation?.operation ?? null; },
          enumerable: true,
          configurable: true
        },
        quarantineReason: {
          get() {
            return executionOwnership.get(execution)?.stateMutation?.quarantineReason
              ?? retiredQuarantineReasons.get(execution)
              ?? null;
          },
          enumerable: true,
          configurable: true
        }
      });
      return execution;
    } catch (error) {
      releaseArena(arena, token);
      throw error;
    }
  }

  function rawOwnershipFor(execution) {
    const ownership = executionOwnership.get(execution);
    if (
      !ownership
      || releasedExecutions.has(execution)
      || ownership.arena.token !== ownership.token
      || ownership.arena.inUse !== true
      || execution.ownerRuntime !== runtime
      || execution.fieldViewBuffer !== ownership.arena.fieldViewBuffer
      || execution.candidateKeyBuffer !== ownership.arena.candidateKeyBuffer
      || execution.stableCandidateOrderBuffer
        !== ownership.stableCandidateOrderBuffer
      || execution.stableCandidateOrderCount
        !== ownership.stableCandidateOrderCount
      || execution.stableCandidateOrderCountAuthority
        !== ownership.stableCandidateOrderCountAuthority
      || execution.stableCandidateOrderPolicy
        !== ownership.stableCandidateOrderPolicy
      || execution.ownsStableCandidateOrderBuffer !== false
      || execution.sourceBuffer !== ownership.sourceBuffer
      || execution.identityBuffer !== ownership.identityBuffer
      || execution.parentMechanicsView !== ownership.parentMechanicsView
      || execution.spatialExecution !== ownership.spatialExecution
      || execution.activeSourceView !== ownership.activeSourceView
      || execution.activeSourceCountAuthority
        !== ownership.activeSourceCountAuthority
      || execution.directoryBuffer
        !== (ownership.spatialExecution?.directoryBuffer ?? null)
      || execution.activeSourceViewBuffer
        !== (ownership.activeSourceView?.activeSourceViewBuffer ?? null)
    ) {
      const error = new Error('mechanics field view execution is not owned by this runtime');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_FOREIGN_EXECUTION';
      throw error;
    }
    return ownership;
  }

  function ownershipFor(execution) {
    const ownership = rawOwnershipFor(execution);
    if (releaseInFlight.has(execution)) {
      const error = new Error('mechanics field view execution is not owned by this runtime');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_FOREIGN_EXECUTION';
      throw error;
    }
    return ownership;
  }

  function ownsExecution(execution) {
    try {
      ownershipFor(execution);
      return true;
    } catch {
      return false;
    }
  }

  function isExecutionRetirementInFlight(execution) {
    try {
      rawOwnershipFor(execution);
      return submittedExecutions.has(execution)
        && execution.submitPerformed === true
        && releaseInFlight.has(execution)
        && retirementRecordFor(execution).activeAttempt !== null;
    } catch {
      return false;
    }
  }

  function markExecutionSubmitted(execution) {
    ownershipFor(execution);
    if (submittedExecutions.has(execution)) return false;
    submittedExecutions.add(execution);
    Object.defineProperty(execution, 'submitPerformed', { value: true, enumerable: true });
    Object.defineProperty(execution, 'status', {
      value: 'schroeder-spatial-mechanics-field-view-gpu-build-submitted',
      enumerable: true
    });
    return true;
  }

  function isExecutionSubmitted(execution) {
    return submittedExecutions.has(execution)
      && ownsExecution(execution)
      && execution.submitPerformed === true;
  }

  function stateMutationState(execution) {
    const mutation = ownershipFor(execution).stateMutation;
    return Object.freeze({
      ordinal: mutation.ordinal,
      encoding: mutation.encoding,
      operation: mutation.operation,
      pending: mutation.pending !== null,
      publicationLocked: mutation.publicationLock !== null,
      quarantined: mutation.quarantined === true
    });
  }

  function isStateMutationReservationActive(execution, token) {
    try {
      const mutation = ownershipFor(execution).stateMutation;
      return token?.execution === execution
        && mutation.pending === token
        && mutation.quarantined !== true
        && mutation.ordinal === token.expectedOrdinal
        && mutation.encoding === token.expectedEncoding
        && token.outputOrdinal === token.expectedOrdinal + token.mutationCount
        && token.publicationLock === mutation.publicationLock
        && (token.publicationLock === null
          || publicationLockOwnership.get(token.publicationLock)?.status
            === 'active');
    } catch {
      return false;
    }
  }

  function reserveStateMutation(execution, {
    expectedOrdinal,
    expectedEncoding,
    outputEncoding,
    operation,
    mutationCount = 1,
    publicationLock = null
  } = {}) {
    const ownership = ownershipFor(execution);
    if (!submittedExecutions.has(execution)) {
      throw new Error('mechanics field mutation requires a submitted field view');
    }
    const expected = Number(expectedOrdinal);
    const expectedState = Number(expectedEncoding);
    const outputState = Number(outputEncoding);
    const count = Number(mutationCount);
    const mutation = ownership.stateMutation;
    const activePublicationLock = mutation.publicationLock;
    const publicationLockAdmitted = activePublicationLock === null
      ? publicationLock == null
      : publicationLock === activePublicationLock
        && publicationLockOwnership.get(publicationLock)?.execution === execution
        && publicationLockOwnership.get(publicationLock)?.status === 'active';
    if (
      !Number.isSafeInteger(expected)
      || expected < 0
      || !Number.isSafeInteger(expectedState)
      || expectedState < 0
      || !Number.isSafeInteger(outputState)
      || outputState < 0
      || !Number.isSafeInteger(count)
      || count < 1
      || expected > 0xffff_ffff - count
      || mutation.ordinal !== expected
      || mutation.encoding !== expectedState
      || mutation.pending !== null
      || mutation.quarantined === true
      || !publicationLockAdmitted
      || typeof operation !== 'string'
      || operation.length === 0
    ) {
      const error = new Error(
        'mechanics field mutation ordinal is stale or malformed'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    const token = Object.freeze({
      execution,
      expectedOrdinal: expected,
      outputOrdinal: expected + count,
      expectedEncoding: expectedState,
      outputEncoding: outputState,
      mutationCount: count,
      operation,
      publicationLock: activePublicationLock
    });
    mutation.pending = token;
    return token;
  }

  function markStateMutationSubmitted(token) {
    const execution = token?.execution;
    const mutation = ownershipFor(execution).stateMutation;
    if (mutation.pending !== token || mutation.quarantined === true) {
      const error = new Error('mechanics field mutation token is not pending');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    if (
      token.publicationLock !== mutation.publicationLock
      || (token.publicationLock !== null
        && publicationLockOwnership.get(token.publicationLock)?.status !== 'active')
    ) {
      const error = new Error('mechanics field publication lock changed during mutation');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    mutation.ordinal = token.outputOrdinal;
    mutation.encoding = token.outputEncoding;
    mutation.operation = token.operation;
    mutation.pending = null;
    return stateMutationState(execution);
  }

  function discardStateMutation(token, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError('discardStateMutation requires { discardedEncoder: true }');
    }
    const execution = token?.execution;
    const mutation = ownershipFor(execution).stateMutation;
    if (mutation.pending !== token || mutation.quarantined === true) {
      const error = new Error('mechanics field mutation token is not pending');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    mutation.pending = null;
    return true;
  }

  function quarantineStateMutation(token, {
    submissionObserved = false,
    reason = null
  } = {}) {
    if (submissionObserved !== true) {
      throw new TypeError(
        'quarantineStateMutation requires { submissionObserved: true }'
      );
    }
    const execution = token?.execution;
    const ownership = ownershipFor(execution);
    const mutation = ownership.stateMutation;
    if (mutation.pending !== token || mutation.quarantined === true) {
      const error = new Error('mechanics field mutation token is not pending');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    mutation.quarantined = true;
    mutation.quarantineReason = reason ?? null;
    ownership.arena.quarantined = true;
    const lockOwnership = publicationLockOwnership.get(mutation.publicationLock);
    if (lockOwnership?.status === 'active') lockOwnership.status = 'quarantined';
    return true;
  }

  function reserveStateMutationSequence(execution, {
    expectedOrdinal,
    expectedEncoding,
    stages,
    operation = 'mechanics-field-mutation-sequence',
    publicationLock = null
  } = {}) {
    if (!Array.isArray(stages) || stages.length < 1 || stages.length > 16) {
      throw new RangeError('mechanics field mutation sequence requires 1-16 stages');
    }
    let ordinal = Number(expectedOrdinal);
    let encoding = Number(expectedEncoding);
    if (!Number.isSafeInteger(ordinal) || ordinal < 0
        || !Number.isSafeInteger(encoding) || encoding < 0) {
      throw new RangeError(
        'mechanics field mutation sequence requires exact initial provenance'
      );
    }
    const normalizedStages = stages.map((stage, stageIndex) => {
      const mutationCount = stage?.mutationCount == null
        ? 1
        : Number(stage.mutationCount);
      const outputEncoding = Number(stage?.outputEncoding);
      const stageOperation = stage?.operation;
      if (!Number.isSafeInteger(mutationCount) || mutationCount < 1
          || !Number.isSafeInteger(outputEncoding) || outputEncoding < 0
          || typeof stageOperation !== 'string' || stageOperation.length === 0
          || ordinal > 0xffff_ffff - mutationCount) {
        throw new RangeError(
          `mechanics field mutation sequence stage ${stageIndex} is malformed`
        );
      }
      const segment = {
        execution,
        stageIndex,
        expectedOrdinal: ordinal,
        outputOrdinal: ordinal + mutationCount,
        expectedEncoding: encoding,
        outputEncoding,
        mutationCount,
        operation: stageOperation
      };
      ordinal = segment.outputOrdinal;
      encoding = outputEncoding;
      return segment;
    });
    const mutationCount = normalizedStages.reduce(
      (sum, stage) => sum + stage.mutationCount,
      0
    );
    const token = reserveStateMutation(execution, {
      expectedOrdinal,
      expectedEncoding,
      outputEncoding: encoding,
      operation,
      mutationCount,
      publicationLock
    });
    const sequence = {
      execution,
      expectedOrdinal: token.expectedOrdinal,
      outputOrdinal: token.outputOrdinal,
      expectedEncoding: token.expectedEncoding,
      outputEncoding: token.outputEncoding,
      mutationCount: token.mutationCount,
      operation,
      stages: null
    };
    const frozenStages = normalizedStages.map((stage) => {
      const segment = { ...stage };
      Object.defineProperty(segment, 'sequence', {
        value: sequence,
        enumerable: false,
        configurable: false,
        writable: false
      });
      Object.freeze(segment);
      mutationSegmentOwnership.set(segment, {
        sequence,
        stageIndex: stage.stageIndex
      });
      return segment;
    });
    sequence.stages = Object.freeze(frozenStages);
    Object.freeze(sequence);
    mutationSequenceOwnership.set(sequence, {
      token,
      stages: sequence.stages,
      submittedStageCount: 0,
      submissionObservedStageIndex: null,
      completed: false,
      discarded: false,
      quarantined: false,
      quarantineReason: null
    });
    mutationTokenSequenceOwnership.set(token, sequence);
    return sequence;
  }

  function sequenceOwnershipFor(sequence) {
    const ownership = mutationSequenceOwnership.get(sequence);
    const execution = sequence?.execution;
    const mutation = ownershipFor(execution).stateMutation;
    if (
      !ownership
      || ownership.discarded
      || ownership.completed
      || mutation.pending !== ownership.token
      || sequence.stages !== ownership.stages
    ) {
      const error = new Error('mechanics field mutation sequence is stale or foreign');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_STALE';
      throw error;
    }
    return ownership;
  }

  function sequenceSegmentOwnershipFor(sequence, segment) {
    const sequenceOwnership = sequenceOwnershipFor(sequence);
    const segmentOwnership = mutationSegmentOwnership.get(segment);
    if (
      !segmentOwnership
      || segmentOwnership.sequence !== sequence
      || sequence.stages[segmentOwnership.stageIndex] !== segment
    ) {
      const error = new Error('mechanics field mutation segment is stale or foreign');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_STALE';
      throw error;
    }
    return { sequenceOwnership, segmentOwnership };
  }

  function stateMutationSequenceState(sequence) {
    const ownership = sequenceOwnershipFor(sequence);
    return Object.freeze({
      submittedStageCount: ownership.submittedStageCount,
      submissionObservedStageIndex: ownership.submissionObservedStageIndex,
      stageCount: ownership.stages.length,
      completed: ownership.completed,
      discarded: ownership.discarded,
      quarantined: ownership.quarantined,
      quarantineReason: ownership.quarantineReason
    });
  }

  function isStateMutationSequenceSegmentReady(execution, sequence, segment) {
    try {
      if (sequence?.execution !== execution || segment?.execution !== execution) {
        return false;
      }
      const { sequenceOwnership, segmentOwnership } =
        sequenceSegmentOwnershipFor(sequence, segment);
      return sequenceOwnership.quarantined !== true
        && sequenceOwnership.submissionObservedStageIndex === null
        && sequenceOwnership.submittedStageCount === segmentOwnership.stageIndex;
    } catch {
      return false;
    }
  }

  function isStateMutationSequenceSegmentSubmitted(execution, sequence, segment) {
    try {
      if (sequence?.execution !== execution || segment?.execution !== execution) {
        return false;
      }
      const { sequenceOwnership, segmentOwnership } =
        sequenceSegmentOwnershipFor(sequence, segment);
      return sequenceOwnership.quarantined !== true
        && sequenceOwnership.submittedStageCount > segmentOwnership.stageIndex;
    } catch {
      return false;
    }
  }

  function markStateMutationSequenceStageSubmissionObserved(sequence, segment) {
    const { sequenceOwnership, segmentOwnership } =
      sequenceSegmentOwnershipFor(sequence, segment);
    if (
      sequenceOwnership.quarantined
      || sequenceOwnership.submissionObservedStageIndex !== null
      || sequenceOwnership.submittedStageCount !== segmentOwnership.stageIndex
    ) {
      const error = new Error(
        'mechanics field mutation sequence stage submission is replayed or out of order'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_ORDER';
      throw error;
    }
    sequenceOwnership.submissionObservedStageIndex = segmentOwnership.stageIndex;
    return stateMutationSequenceState(sequence);
  }

  function isStateMutationSequenceStageSubmissionObserved(
    execution,
    sequence,
    segment
  ) {
    try {
      if (sequence?.execution !== execution || segment?.execution !== execution) {
        return false;
      }
      const { sequenceOwnership, segmentOwnership } =
        sequenceSegmentOwnershipFor(sequence, segment);
      return sequenceOwnership.quarantined !== true
        && sequenceOwnership.submittedStageCount === segmentOwnership.stageIndex
        && sequenceOwnership.submissionObservedStageIndex
          === segmentOwnership.stageIndex;
    } catch {
      return false;
    }
  }

  function markStateMutationSequenceStageSubmitted(sequence, segment) {
    const { sequenceOwnership, segmentOwnership } =
      sequenceSegmentOwnershipFor(sequence, segment);
    if (
      sequenceOwnership.quarantined
      || sequenceOwnership.submittedStageCount !== segmentOwnership.stageIndex
      || sequenceOwnership.submissionObservedStageIndex
        !== segmentOwnership.stageIndex
    ) {
      const error = new Error(
        'mechanics field mutation sequence stage is replayed or out of order'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_ORDER';
      throw error;
    }
    sequenceOwnership.submissionObservedStageIndex = null;
    sequenceOwnership.submittedStageCount += 1;
    return stateMutationSequenceState(sequence);
  }

  function completeStateMutationSequence(sequence) {
    const ownership = sequenceOwnershipFor(sequence);
    if (
      ownership.quarantined
      || ownership.submittedStageCount !== ownership.stages.length
    ) {
      const error = new Error(
        'mechanics field mutation sequence cannot publish before every stage submits'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_INCOMPLETE';
      throw error;
    }
    const state = markStateMutationSubmitted(ownership.token);
    ownership.completed = true;
    return state;
  }

  function discardStateMutationSequence(sequence, {
    discardedEncoder = false
  } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        'discardStateMutationSequence requires { discardedEncoder: true }'
      );
    }
    const ownership = sequenceOwnershipFor(sequence);
    if (
      ownership.submittedStageCount !== 0
      || ownership.submissionObservedStageIndex !== null
      || ownership.quarantined
    ) {
      const error = new Error(
        'submitted mechanics field mutation sequence cannot be discarded'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_SUBMITTED';
      throw error;
    }
    discardStateMutation(ownership.token, { discardedEncoder: true });
    ownership.discarded = true;
    return true;
  }

  function quarantineStateMutationSequence(sequence, reason = null) {
    const ownership = sequenceOwnershipFor(sequence);
    if (
      ownership.submittedStageCount === 0
      && ownership.submissionObservedStageIndex === null
    ) {
      throw new Error(
        'unsubmitted mechanics field mutation sequence must be discarded, not quarantined'
      );
    }
    ownership.quarantined = true;
    ownership.quarantineReason = reason ?? null;
    const mutation = ownershipFor(sequence.execution).stateMutation;
    mutation.quarantined = true;
    mutation.quarantineReason = reason ?? null;
    ownershipFor(sequence.execution).arena.quarantined = true;
    const lockOwnership = publicationLockOwnership.get(mutation.publicationLock);
    if (lockOwnership?.status === 'active') lockOwnership.status = 'quarantined';
    return true;
  }

  function acquireStatePublicationLock(execution, {
    owner = null,
    publicationReceiptValidator = null
  } = {}) {
    const ownership = ownershipFor(execution);
    const mutation = ownership.stateMutation;
    if (
      !submittedExecutions.has(execution)
      || mutation.pending !== null
      || mutation.publicationLock !== null
      || mutation.quarantined === true
    ) {
      const error = new Error('mechanics field publication lock cannot be acquired');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    const publicationLock = Object.freeze({
      schema: 'peercompute.ulg.schroeder-mechanics-field-publication-lock.v0',
      execution,
      owner,
      acquisitionOrdinal: mutation.ordinal,
      acquisitionEncoding: mutation.encoding,
      serial: ++serial
    });
    publicationLockOwnership.set(publicationLock, {
      execution,
      owner,
      status: 'active',
      publicationReceiptValidator: typeof publicationReceiptValidator === 'function'
        ? publicationReceiptValidator
        : null,
      acquisitionOrdinal: mutation.ordinal,
      acquisitionEncoding: mutation.encoding
    });
    mutation.publicationLock = publicationLock;
    return publicationLock;
  }

  function isStatePublicationLockActive(execution, publicationLock) {
    try {
      const ownership = ownershipFor(execution);
      const lockOwnership = publicationLockOwnership.get(publicationLock);
      return ownership.stateMutation.publicationLock === publicationLock
        && lockOwnership?.execution === execution
        && lockOwnership.status === 'active';
    } catch {
      return false;
    }
  }

  function discardStatePublicationLock(execution, publicationLock) {
    const ownership = ownershipFor(execution);
    const mutation = ownership.stateMutation;
    const lockOwnership = publicationLockOwnership.get(publicationLock);
    if (
      !submittedExecutions.has(execution)
      || mutation.publicationLock !== publicationLock
      || lockOwnership?.execution !== execution
      || lockOwnership.status !== 'active'
      || mutation.pending !== null
      || mutation.quarantined === true
      || mutation.ordinal !== lockOwnership.acquisitionOrdinal
      || mutation.encoding !== lockOwnership.acquisitionEncoding
    ) {
      const error = new Error(
        'only an unmodified mechanics field publication lock can be discarded'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    mutation.publicationLock = null;
    lockOwnership.status = 'discarded';
    return true;
  }

  function mintStatePublicationCapability(execution, publicationLock, {
    terminalClosureReceipt,
    closureOrdinal
  } = {}) {
    const ownership = ownershipFor(execution);
    const mutation = ownership.stateMutation;
    const lockOwnership = publicationLockOwnership.get(publicationLock);
    const resolvedClosureOrdinal = Number(closureOrdinal);
    let receiptAdmitted = false;
    try {
      receiptAdmitted = terminalClosureReceipt?.schema
          === 'peercompute.ulg.schroeder-mechanics-field-publication-receipt.v0'
        && terminalClosureReceipt?.status === 'macro-closure-gpu-verified-private'
        && terminalClosureReceipt?.particlePublicationAllowed === true
        && lockOwnership?.publicationReceiptValidator?.(
          device,
          terminalClosureReceipt,
          {
          execution,
          publicationLock,
          mutationOrdinal: mutation.ordinal,
          stateEncoding: mutation.encoding,
          closureOrdinal: resolvedClosureOrdinal
          }
        ) === true;
    } catch {
      receiptAdmitted = false;
    }
    if (
      mutation.publicationLock !== publicationLock
      || lockOwnership?.execution !== execution
      || lockOwnership.status !== 'active'
      || mutation.pending !== null
      || mutation.quarantined === true
      || !Number.isSafeInteger(resolvedClosureOrdinal)
      || resolvedClosureOrdinal < 0
      || !receiptAdmitted
    ) {
      const error = new Error('mechanics field publication capability is stale');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    const capability = Object.freeze({
      schema: 'peercompute.ulg.schroeder-mechanics-field-publication-capability.v0',
      closureOrdinal: resolvedClosureOrdinal,
      serial: ++serial
    });
    publicationCapabilityOwnership.set(capability, {
      execution,
      publicationLock,
      terminalClosureReceipt,
      closureOrdinal: resolvedClosureOrdinal,
      mutationOrdinal: mutation.ordinal,
      stateEncoding: mutation.encoding,
      status: 'ready'
    });
    return capability;
  }

  function promoteStatePublicationLock(
    execution,
    publicationLock,
    publicationCapability
  ) {
    const ownership = ownershipFor(execution);
    const mutation = ownership.stateMutation;
    const lockOwnership = publicationLockOwnership.get(publicationLock);
    const capabilityOwnership = publicationCapabilityOwnership.get(
      publicationCapability
    );
    if (
      mutation.publicationLock !== publicationLock
      || lockOwnership?.execution !== execution
      || lockOwnership.status !== 'active'
      || mutation.pending !== null
      || mutation.quarantined === true
      || capabilityOwnership?.execution !== execution
      || capabilityOwnership?.publicationLock !== publicationLock
      || capabilityOwnership.status !== 'ready'
      || capabilityOwnership.mutationOrdinal !== mutation.ordinal
      || capabilityOwnership.stateEncoding !== mutation.encoding
    ) {
      const error = new Error('mechanics field publication promotion is stale');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    capabilityOwnership.status = 'consumed';
    lockOwnership.status = 'promoted';
    mutation.publicationLock = null;
    return true;
  }

  function markExecutionQuarantined(execution, ownership, reason = null) {
    const mutation = ownership.stateMutation;
    mutation.quarantined = true;
    if (mutation.quarantineReason == null && reason != null) {
      mutation.quarantineReason = reason;
    }
    ownership.arena.quarantined = true;
    const lockOwnership = publicationLockOwnership.get(mutation.publicationLock);
    if (
      lockOwnership?.execution === execution
      && (lockOwnership.status === 'active' || lockOwnership.status === 'retiring')
    ) {
      lockOwnership.status = 'quarantined';
    }
  }

  function retireStatePublicationLockAfter(execution, publicationLock) {
    try {
      const retirementRecord = retirementRecordFor(execution);
      if (retirementRecord.completed) return retirementRecord.completionPromise;
      if (retirementRecord.activeAttempt) {
        if (
          retirementRecord.activeAttempt.mode === 'publication-lock-fence'
          && retirementRecord.activeAttempt.publicationLock === publicationLock
        ) {
          return retirementRecord.activeAttempt.promise;
        }
        if (retirementRecord.activeAttempt.mode === 'device-loss') {
          return retirementRecord.activeAttempt.promise;
        }
        const error = new Error('mechanics field private retirement is stale');
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
        throw error;
      }
      const ownership = ownershipFor(execution);
      const mutation = ownership.stateMutation;
      const lockOwnership = publicationLockOwnership.get(publicationLock);
      if (
        !submittedExecutions.has(execution)
        || mutation.publicationLock !== publicationLock
        || lockOwnership?.execution !== execution
        || lockOwnership.status !== 'active'
        || mutation.pending !== null
        || mutation.quarantined === true
      ) {
        const error = new Error('mechanics field private retirement is stale');
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
        throw error;
      }
      if (typeof device.queue?.onSubmittedWorkDone !== 'function') {
        throw new TypeError(
          'retireStatePublicationLockAfter requires runtime-owned queue-fence support'
        );
      }
      let submissionFence;
      try {
        submissionFence = device.queue.onSubmittedWorkDone();
        if (!submissionFence?.then) {
          throw new TypeError('queue fence did not return a thenable');
        }
      } catch (error) {
        markExecutionQuarantined(execution, ownership, error);
        throw error;
      }
      const attempt = {
        mode: 'publication-lock-fence',
        publicationLock,
        ordinal: ++retirementRecord.nextAttemptOrdinal,
        promise: null
      };
      retirementRecord.activeAttempt = attempt;
      lockOwnership.status = 'retiring';
      releaseInFlight.add(execution);
      let radixRelease;
      try {
        radixRelease = ownership.ownsRadixExecution === false
          ? Promise.resolve(submissionFence).then(() => true)
          : ownership.arena.radix.releaseExecutionAfter(
              ownership.radixUnique,
              submissionFence
            );
      } catch (error) {
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        markExecutionQuarantined(execution, ownership, error);
        throw error;
      }
      const retirementAttempt = Promise.race([
        Promise.resolve(radixRelease).then((released) => ({
          kind: 'radix-release',
          released
        })),
        retirementRecord.completionPromise.then(() => ({
          kind: 'terminal-completion',
          released: true
        }))
      ]).then((result) => {
        if (result.kind === 'terminal-completion') return true;
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        if (result.released !== true) {
          throw new Error('mechanics field radix owner did not confirm release');
        }
        mutation.publicationLock = null;
        lockOwnership.status = 'retired';
        return finalizeRelease(execution, ownership, {
          radixReleased: true,
          retirementRecord
        });
      }).catch((error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        markExecutionQuarantined(execution, ownership, error);
        throw error;
      });
      attempt.promise = retirementAttempt;
      retirementAttempt.catch(() => {});
      return retirementAttempt;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function retireStatePublicationLockQueueOrdered(
    execution,
    publicationLock
  ) {
    try {
      const retirementRecord = retirementRecordFor(execution);
      if (retirementRecord.completed) {
        return retirementRecord.completionPromise;
      }
      if (retirementRecord.activeAttempt) {
        if (retirementRecord.activeAttempt.mode === 'device-loss') {
          return retirementRecord.activeAttempt.promise;
        }
        const error = new Error(
          'queue-ordered mechanics field private retirement is stale'
        );
        error.code =
          'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
        throw error;
      }
      const ownership = ownershipFor(execution);
      const mutation = ownership.stateMutation;
      const lockOwnership = publicationLockOwnership.get(publicationLock);
      if (
        deviceLossObserved
        || !submittedExecutions.has(execution)
        || mutation.publicationLock !== publicationLock
        || lockOwnership?.execution !== execution
        || lockOwnership.status !== 'active'
        || mutation.pending !== null
        || mutation.quarantined === true
        || (
          ownership.ownsRadixExecution !== false
          && ownership.arena.radix.canReleaseExecutionQueueOrdered?.(
            ownership.radixUnique
          ) !== true
        )
      ) {
        const error = new Error(
          'queue-ordered mechanics field private retirement is stale'
        );
        error.code =
          'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
        throw error;
      }

      // The exact successor has already submitted every read of this private
      // field on the same device queue. Recycle the bounded arena for later
      // queue work without manufacturing a host-observed completion fence.
      mutation.publicationLock = null;
      lockOwnership.status = 'retired';
      try {
        const released = releaseExecutionQueueOrdered(execution);
        if (released !== true) {
          throw new Error(
            'queue-ordered mechanics field retirement was not confirmed'
          );
        }
      } catch (error) {
        mutation.quarantined = true;
        mutation.quarantineReason = error;
        ownership.arena.quarantined = true;
        lockOwnership.status = 'quarantined';
        throw error;
      }
      return retirementRecord.completionPromise;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function permanentlyRetireArena(
    execution,
    ownership,
    retirementRecord = retirementRecordFor(execution)
  ) {
    if (retirementRecord.completed) return true;
    const { arena } = ownership;
    destroyArenaOwnedBuffersAfterDeviceLoss(arena);
    arena.retired = true;
    arena.quarantined = false;
    const released = releaseArena(arena, ownership.token);
    if (released) {
      retiredQuarantineReasons.set(
        execution,
        ownership.stateMutation.quarantineReason ?? null
      );
      releasedExecutions.add(execution);
      submittedExecutions.delete(execution);
      executionOwnership.delete(execution);
      releaseInFlight.delete(execution);
      retirementRecord.activeAttempt = null;
      retirementRecord.completed = true;
      retirementRecord.resolveCompletion(true);
    }
    return released;
  }

  function retireQuarantinedExecutionAfter(
    execution,
    { deviceLost = false } = {}
  ) {
    try {
      const retirementRecord = retirementRecordFor(execution);
      if (retirementRecord.completed) return retirementRecord.completionPromise;
      if (deviceLost === true) return quarantineExecutionAfterDeviceLoss(execution);
      if (retirementRecord.activeAttempt?.mode === 'quarantine-fence') {
        return retirementRecord.activeAttempt.promise;
      }
      if (retirementRecord.activeAttempt) {
        return retirementRecord.activeAttempt.promise;
      }
      const ownership = rawOwnershipFor(execution);
      const mutation = ownership.stateMutation;
      if (
        !submittedExecutions.has(execution)
        || mutation.quarantined !== true
      ) {
        const error = new Error('mechanics field quarantine retirement is stale');
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_QUARANTINE_STALE';
        throw error;
      }
      const retirementEvidence = device.queue?.onSubmittedWorkDone?.();
      if (!retirementEvidence?.then) {
        throw new TypeError(
          'retireQuarantinedExecutionAfter requires runtime-owned queue-fence evidence'
        );
      }
      const attempt = {
        mode: 'quarantine-fence',
        ordinal: ++retirementRecord.nextAttemptOrdinal,
        promise: null
      };
      retirementRecord.activeAttempt = attempt;
      releaseInFlight.add(execution);
      const retirementAttempt = Promise.race([
        Promise.resolve(retirementEvidence).then(() => 'queue-fence'),
        retirementRecord.completionPromise.then(() => 'terminal-completion')
      ]).then((kind) => {
        if (kind === 'terminal-completion') return true;
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        return permanentlyRetireArena(execution, ownership, retirementRecord);
      }).catch((error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        throw error;
      });
      attempt.promise = retirementAttempt;
      retirementAttempt.catch(() => {});
      return retirementAttempt;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function quarantineExecutionAfterDeviceLoss(execution, { reason = null } = {}) {
    try {
      const retirementRecord = retirementRecordFor(execution);
      if (retirementRecord.completed) return retirementRecord.completionPromise;
      const ownership = rawOwnershipFor(execution);
      if (retirementRecord.activeAttempt?.mode === 'device-loss') {
        return retirementRecord.activeAttempt.promise;
      }
      const exactLossEvidence = device?.lost;
      if (!exactLossEvidence || typeof exactLossEvidence.then !== 'function') {
        const error = new TypeError(
          'mechanics field device-loss quarantine requires the exact GPUDevice.lost promise'
        );
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_DEVICE_LOSS_EVIDENCE';
        throw error;
      }
      if (
        retirementRecord.deviceLossEvidence != null
        && retirementRecord.deviceLossEvidence !== exactLossEvidence
      ) {
        const error = new Error(
          'mechanics field device-loss evidence changed for one execution'
        );
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_DEVICE_LOSS_EVIDENCE';
        throw error;
      }
      retirementRecord.deviceLossEvidence = exactLossEvidence;
      deviceLossObserved = true;
      markExecutionQuarantined(execution, ownership, reason);
      if (retirementRecord.activeAttempt) {
        retirementRecord.activeAttempt.promise.catch(() => {});
      }
      const attempt = {
        mode: 'device-loss',
        ordinal: ++retirementRecord.nextAttemptOrdinal,
        promise: null
      };
      retirementRecord.activeAttempt = attempt;
      releaseInFlight.add(execution);
      runtime.status =
        'schroeder-spatial-mechanics-field-view-gpu-runtime-device-loss-quarantined';
      const lossAttempt = Promise.resolve(exactLossEvidence).then(() => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        return permanentlyRetireArena(execution, ownership, retirementRecord);
      }).catch((error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        throw error;
      });
      attempt.promise = lossAttempt;
      lossAttempt.catch(() => {});
      return lossAttempt;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function executionRetirementCompletionPromise(execution) {
    return retirementRecordFor(execution).completionPromise;
  }

  function quarantineCurrentStateArtifact(execution, {
    mutationOrdinal,
    stateEncoding,
    reason = null
  } = {}) {
    const mutation = ownershipFor(execution).stateMutation;
    if (
      mutation.pending !== null
      || mutation.ordinal !== mutationOrdinal
      || mutation.encoding !== stateEncoding
      || mutation.quarantined === true
    ) {
      const error = new Error('mechanics field current state cannot be quarantined');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_QUARANTINE_STALE';
      throw error;
    }
    mutation.quarantined = true;
    mutation.quarantineReason = reason ?? null;
    const ownership = ownershipFor(execution);
    ownership.arena.quarantined = true;
    const lockOwnership = publicationLockOwnership.get(mutation.publicationLock);
    if (lockOwnership?.status === 'active') lockOwnership.status = 'quarantined';
    return true;
  }

  function isStateArtifactQuarantined(execution) {
    try {
      return ownershipFor(execution).stateMutation.quarantined === true;
    } catch {
      return false;
    }
  }

  function isCurrentStateArtifact(execution, {
    mutationOrdinal,
    stateEncoding,
    publicationLock = null
  } = {}) {
    try {
      const mutation = ownershipFor(execution).stateMutation;
      const activePublicationLock = mutation.publicationLock;
      const publicationAdmitted = activePublicationLock === null
        ? publicationLock == null
        : activePublicationLock === publicationLock
          && publicationLockOwnership.get(publicationLock)?.status === 'active';
      return mutation.pending === null
        && mutation.quarantined !== true
        && publicationAdmitted
        && mutation.ordinal === mutationOrdinal
        && mutation.encoding === stateEncoding;
    } catch {
      return false;
    }
  }

  function finalizeRelease(execution, ownership, {
    radixReleased = false,
    retirementRecord = retirementRecordFor(execution)
  } = {}) {
    if (retirementRecord.completed) return true;
    if (ownership.stateMutation.pending !== null) {
      throw new Error('mechanics field view has a pending state mutation');
    }
    if (ownership.stateMutation.publicationLock !== null) {
      throw new Error('mechanics field view has an active publication lock');
    }
    if (ownership.stateMutation.quarantined === true) {
      throw new Error('quarantined mechanics field requires exact retirement evidence');
    }
    if (ownership.ownsRadixExecution !== false && !radixReleased) {
      ownership.arena.radix.releaseExecution(
        ownership.radixUnique,
        { discardedEncoder: true }
      );
    }
    const released = releaseArena(ownership.arena, ownership.token);
    if (released) {
      releasedExecutions.add(execution);
      submittedExecutions.delete(execution);
      executionOwnership.delete(execution);
      releaseInFlight.delete(execution);
      retirementRecord.activeAttempt = null;
      retirementRecord.completed = true;
      retirementRecord.resolveCompletion(true);
    }
    return released;
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError('releaseExecution requires { discardedEncoder: true }');
    }
    const retirementRecord = retirementRecordFor(execution);
    if (retirementRecord.completed) return false;
    if (submittedExecutions.has(execution)) {
      throw new Error('submitted mechanics field view requires a queue fence');
    }
    return finalizeRelease(execution, ownershipFor(execution), { retirementRecord });
  }

  function canReleaseExecutionQueueOrdered(execution) {
    try {
      const retirementRecord = retirementRecordFor(execution);
      const ownership = rawOwnershipFor(execution);
      return Boolean(
        !retirementRecord.completed
        && !deviceLossObserved
        && !retirementRecord.activeAttempt
        && submittedExecutions.has(execution)
        && ownership.stateMutation.pending === null
        && ownership.stateMutation.publicationLock === null
        && ownership.stateMutation.quarantined !== true
        && (
          ownership.ownsRadixExecution === false
          || ownership.arena.radix.canReleaseExecutionQueueOrdered?.(
            ownership.radixUnique
          ) === true
        )
      );
    } catch {
      return false;
    }
  }

  function releaseExecutionQueueOrdered(execution) {
    if (!canReleaseExecutionQueueOrdered(execution)) {
      throw new Error(
        'queue-ordered mechanics field release requires an exact submitted idle state'
      );
    }
    const retirementRecord = retirementRecordFor(execution);
    const ownership = rawOwnershipFor(execution);
    const radixReleased = ownership.ownsRadixExecution === false
      ? true
      : ownership.arena.radix.releaseExecutionQueueOrdered?.(
          ownership.radixUnique
        );
    if (radixReleased !== true) {
      throw new Error(
        'queue-ordered mechanics field radix owner did not confirm release'
      );
    }
    return finalizeRelease(execution, ownership, {
      radixReleased: true,
      retirementRecord
    });
  }

  function releaseExecutionAfter(execution) {
    try {
      const retirementRecord = retirementRecordFor(execution);
      if (retirementRecord.completed) return retirementRecord.completionPromise;
      if (deviceLossObserved) return quarantineExecutionAfterDeviceLoss(execution);
      if (retirementRecord.activeAttempt) {
        return retirementRecord.activeAttempt.promise;
      }
      const ownership = rawOwnershipFor(execution);
      if (!submittedExecutions.has(execution)) {
        throw new Error('unsubmitted mechanics field view requires discarded-encoder release');
      }
      if (
        ownership.stateMutation.pending !== null
        || ownership.stateMutation.publicationLock !== null
        || ownership.stateMutation.quarantined === true
      ) {
        throw new Error(
          'mechanics field view requires exact pending/locked/quarantine retirement'
        );
      }
      if (typeof device.queue?.onSubmittedWorkDone !== 'function') {
        throw new TypeError('releaseExecutionAfter requires runtime-owned queue-fence support');
      }
      const submissionFence = device.queue.onSubmittedWorkDone();
      if (!submissionFence?.then) {
        throw new TypeError('runtime-owned queue fence did not return a thenable');
      }
      const attempt = {
        mode: 'release-fence',
        ordinal: ++retirementRecord.nextAttemptOrdinal,
        promise: null
      };
      retirementRecord.activeAttempt = attempt;
      releaseInFlight.add(execution);
      let radixRelease;
      try {
        radixRelease = ownership.ownsRadixExecution === false
          ? Promise.resolve(submissionFence).then(() => true)
          : ownership.arena.radix.releaseExecutionAfter(
              ownership.radixUnique,
              submissionFence
            );
      } catch (error) {
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        throw error;
      }
      const releaseAttempt = Promise.race([
        Promise.resolve(radixRelease).then((released) => ({
          kind: 'radix-release',
          released
        })),
        retirementRecord.completionPromise.then(() => ({
          kind: 'terminal-completion',
          released: true
        }))
      ]).then((result) => {
        if (result.kind === 'terminal-completion') return true;
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        if (result.released !== true) {
          throw new Error('mechanics field radix owner did not confirm release');
        }
        return finalizeRelease(execution, ownership, {
          radixReleased: true,
          retirementRecord
        });
      }).catch((error) => {
        if (retirementRecord.activeAttempt !== attempt) {
          return retirementRecord.completionPromise;
        }
        retirementRecord.activeAttempt = null;
        releaseInFlight.delete(execution);
        throw error;
      });
      attempt.promise = releaseAttempt;
      releaseAttempt.catch(() => {});
      return releaseAttempt;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function destroy() {
    if (destroyed) return false;
    if (arenas.some((arena) => arena.inUse)) {
      throw new Error('mechanics field view runtime still has active executions');
    }
    destroyed = true;
    for (const arena of arenas) {
      for (const buffer of [
        ...Object.values(arena.p2gWorkspace),
        ...Object.values(arena.gridUpdateWorkspace),
        ...Object.values(arena.g2pWorkspace),
        arena.paramsBuffer,
        arena.candidateKeyBuffer,
        arena.fieldViewBuffer,
        arena.topologySuccessorOrderBuffer
      ]) {
        if (!buffer) continue;
        if (arena.destroyedOwnedBuffers.has(buffer)) continue;
        buffer.destroy?.();
        arena.destroyedOwnedBuffers.add(buffer);
      }
      if (!arena.radixDeviceLossRetired) arena.radix.destroy();
      arena.bindGroupCache.clear();
    }
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
    status: 'schroeder-spatial-mechanics-field-view-gpu-runtime-ready',
    deviceId,
    maxSourceCount: resolvedMaxSourceCount,
    maxPhysicalSourceCount: resolvedMaxSourceCount,
    activeSourceCapacity: resolvedActiveSourceCapacity,
    identityStrideWords: resolvedIdentityStrideWords,
    gridNodeCount: template.gridNodeCount,
    gridDims: template.gridDims,
    gridShift: template.gridShift,
    gridSpacingM: template.gridSpacingM,
    maxComputeWorkgroupsPerDimension,
    arenaCount: resolvedArenaCount,
    directoryV2Prepared: enableDirectoryV2,
    sourceAuthorityVersions:
      enableDirectoryV2
      && resolvedActiveSourceCapacity !== resolvedMaxSourceCount
      ? Object.freeze([
          SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
        ])
      : enableDirectoryV2
      ? Object.freeze([
          SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1,
          SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
        ])
      : Object.freeze([
          SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V1
        ]),
    layout: template.layout,
    releaseFencePolicy: 'runtime-owned-current-queue-at-invocation',
    pipelineCount: 5
      + (v2Pipelines ? 4 : 0)
      + arenas.reduce(
        (sum, arena) => sum + (
          enableDirectoryV2
            ? arena.radix.totalPipelineCount
            : arena.radix.pipelineCount
        ),
        0
      ),
    retainedGpuBufferBytes,
    encode,
    encodeTopologySuccessor,
    p2gWorkspaceForExecution,
    gridUpdateWorkspaceForExecution,
    g2pWorkspaceForExecution,
    createExactConsumerBindGroup,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    stateMutationState,
    isStateMutationReservationActive,
    reserveStateMutation,
    markStateMutationSubmitted,
    discardStateMutation,
    quarantineStateMutation,
    reserveStateMutationSequence,
    stateMutationSequenceState,
    isStateMutationSequenceSegmentReady,
    isStateMutationSequenceSegmentSubmitted,
    markStateMutationSequenceStageSubmissionObserved,
    isStateMutationSequenceStageSubmissionObserved,
    markStateMutationSequenceStageSubmitted,
    completeStateMutationSequence,
    discardStateMutationSequence,
    quarantineStateMutationSequence,
    acquireStatePublicationLock,
    isStatePublicationLockActive,
    discardStatePublicationLock,
    mintStatePublicationCapability,
    promoteStatePublicationLock,
    retireStatePublicationLockAfter,
    retireStatePublicationLockQueueOrdered,
    retireQuarantinedExecutionAfter,
    quarantineExecutionAfterDeviceLoss,
    executionRetirementCompletionPromise,
    isExecutionRetirementInFlight,
    quarantineCurrentStateArtifact,
    isStateArtifactQuarantined,
    isCurrentStateArtifact,
    releaseExecution,
    canReleaseExecutionQueueOrdered,
    releaseExecutionQueueOrdered,
    releaseExecutionAfter,
    allocationEntries: () => arenas.flatMap(allocationEntriesForArena),
    activeExecutionCount: () => arenas.filter((arena) => arena.inUse).length,
    availableArenaCount: () => arenas.filter((arena) => (
      arena.inUse !== true
      && arena.retired !== true
      && arena.quarantined !== true
    )).length,
    usableArenaCount: () => arenas.filter((arena) => (
      arena.retired !== true && arena.quarantined !== true
    )).length,
    quarantinedArenaCount: () => arenas.filter((arena) => (
      arena.retired !== true && arena.quarantined === true
    )).length,
    retiredArenaCount: () => arenas.filter((arena) => arena.retired === true).length,
    destroy
  };
  return runtime;
}

export {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
  schroederSpatialMechanicsFieldTopologySuccessorWgsl,
  schroederSpatialMechanicsFieldViewV2Wgsl,
  schroederSpatialMechanicsFieldViewWgsl
};
