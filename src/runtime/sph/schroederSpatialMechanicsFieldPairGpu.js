import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
  createSchroederSpatialMechanicsFieldViewPlan
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  schroederSpatialMechanicsFieldPairWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldPairWgsl.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
  ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  validateSchroederSpatialActiveSourceViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialActiveSourceView.js';
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
import {
  createSchroederSpatialMechanicsFieldPairLifecycle
} from './schroederSpatialMechanicsFieldPairLifecycle.js';

export const ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_PAIR_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanics-field-pair.v1';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const PAIR_PARAMS_BYTES = 256;
const PAIR_CONTROL_WORDS = 20;
const FIELD_RADIX_KEY_WORDS = 3;
const FIELD_P2G_CONTRIBUTION_WORDS = 12;
const FIELD_SERIAL_HISTOGRAM_SCAN_MAX_ELEMENT_COUNT = 8_192;
const INVALID_RADIX_KEY = 0xffff_ffff;
const PAIR_PROJECTION_SCAN_ELEMENTS_PER_WORKGROUP = 512;
const PAIR_PROJECTION_SCAN_MAX_LEVELS = 4;
const PAIR_PROJECTION_SCAN_VALUE_BYTES = 2 * UINT32_BYTES;
const PAIR_PROJECTION_SCAN_DISPATCH_BASE_WORDS = 0;
const PAIR_PROJECTION_SCAN_DISPATCH_STRIDE_WORDS = 6;
const PAIR_PROJECTION_DISPATCH_WORDS =
  PAIR_PROJECTION_SCAN_MAX_LEVELS
  * PAIR_PROJECTION_SCAN_DISPATCH_STRIDE_WORDS;
const PAIR_PROJECTION_PIPELINE_COUNT = 14;
const PAIR_PROJECTION_WRAPPER_COMPUTE_PASS_COUNT = 7;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function significantNibblesForMaximum(maximum, fallback = 8) {
  if (!Number.isInteger(maximum) || maximum < 0 || maximum > 0xffff_ffff) {
    return fallback;
  }
  return Math.max(
    1,
    Math.ceil(Math.max(1, Math.floor(Math.log2(Math.max(1, maximum))) + 1) / 4)
  );
}

function mechanicsFieldPairSignificantDigitRows(
  combinedNodeSpan,
  identityBuffer
) {
  const maximumCombinedNode = Math.max(0, Number(combinedNodeSpan) - 1);
  const combinedNodeNibbles = significantNibblesForMaximum(maximumCombinedNode);
  const continuityDomainNibbles = significantNibblesForMaximum(
    sphGpuIdentityValueMaxForBuffer(identityBuffer)
  );
  return Object.freeze([
    ...Array.from({ length: continuityDomainNibbles }, (_, index) => index),
    ...Array.from({ length: 7 }, (_, index) => 8 + index),
    ...Array.from({ length: combinedNodeNibbles }, (_, index) => 16 + index)
  ]);
}

function integer(value, label, min = 0, max = 0xffff_ffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

function positiveInteger(value, label, max = 0xffff_ffff) {
  return integer(value, label, 1, max);
}

function checkedProduct(left, right, label, max = 0xffff_ffff) {
  const result = left * right;
  if (!Number.isSafeInteger(result) || result > max) {
    throw new RangeError(`${label} exceeds the u32 range`);
  }
  return result;
}

function createPairProjectionScanPlan(maxElementCount) {
  const maximum = positiveInteger(
    maxElementCount,
    'mechanics field pair projection maximum'
  );
  const levelCounts = [];
  const levelOffsets = [];
  let elementCount = maximum;
  let elementOffset = 0;
  while (elementCount > 0) {
    if (levelCounts.length >= PAIR_PROJECTION_SCAN_MAX_LEVELS) {
      throw new RangeError(
        'mechanics field pair projection exceeds the retained scan hierarchy'
      );
    }
    levelOffsets.push(elementOffset);
    levelCounts.push(elementCount);
    elementOffset += elementCount;
    if (!Number.isSafeInteger(elementOffset) || elementOffset > 0xffff_ffff) {
      throw new RangeError(
        'mechanics field pair projection scratch exceeds the u32 index domain'
      );
    }
    const groupCount = Math.ceil(
      elementCount / PAIR_PROJECTION_SCAN_ELEMENTS_PER_WORKGROUP
    );
    if (groupCount <= 1) break;
    elementCount = groupCount;
  }
  const scratchByteLength = checkedProduct(
    elementOffset,
    PAIR_PROJECTION_SCAN_VALUE_BYTES,
    'mechanics field pair projection scratch',
    Number.MAX_SAFE_INTEGER
  );
  return Object.freeze({
    maxElementCount: maximum,
    elementsPerWorkgroup: PAIR_PROJECTION_SCAN_ELEMENTS_PER_WORKGROUP,
    levelCount: levelCounts.length,
    levelCounts: Object.freeze(levelCounts),
    levelOffsets: Object.freeze(levelOffsets),
    scratchElementCount: elementOffset,
    scratchByteLength,
    encodedScanDispatchCount: PAIR_PROJECTION_SCAN_MAX_LEVELS,
    encodedAddDispatchCount: PAIR_PROJECTION_SCAN_MAX_LEVELS - 1,
    encodedScatterDispatchCount: 1,
    encodedIndirectDispatchCount:
      PAIR_PROJECTION_SCAN_MAX_LEVELS
      + PAIR_PROJECTION_SCAN_MAX_LEVELS - 1
      + 1
  });
}

function assertDevice(device) {
  if (
    !device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer
  ) {
    throw new TypeError('mechanics field pair requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
    throw new TypeError(
      'mechanics field pair encoding requires a GPUCommandEncoder-like object'
    );
  }
}

function createOwnedBuffer(
  device,
  label,
  size,
  usage,
  constructionBuffers = null
) {
  const buffer = device.createBuffer({
    label,
    size,
    usage
  });
  constructionBuffers?.add(buffer);
  return tagWebGpuBufferDevice(buffer, device);
}

function createBufferTrackingDevice(device, onBufferCreated) {
  return new Proxy(device, {
    get(target, property) {
      if (property === 'createBuffer') {
        return (descriptor) => {
          const buffer = target.createBuffer(descriptor);
          onBufferCreated(buffer);
          return buffer;
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

function beginTimestampSpan(gpuTimestampRecorder, encoder, descriptor) {
  return gpuTimestampRecorder?.active === true
    && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
    ? gpuTimestampRecorder.beginEncoderSpan(encoder, descriptor)
    : null;
}

function endTimestampSpan(gpuTimestampRecorder, encoder, token) {
  if (token) gpuTimestampRecorder.endEncoderSpan(encoder, token);
}

function encodeDirectPass(
  encoder,
  pipeline,
  bindGroup,
  workgroups,
  label,
  gpuTimestampRecorder,
  timestampDescriptor
) {
  const span = timestampDescriptor
    ? beginTimestampSpan(gpuTimestampRecorder, encoder, timestampDescriptor)
    : null;
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...workgroups);
  pass.end();
  endTimestampSpan(gpuTimestampRecorder, encoder, span);
  return 1;
}

function encodeIndirectPass(
  encoder,
  pipeline,
  bindGroup,
  indirectBuffer,
  indirectOffsetBytes,
  label,
  gpuTimestampRecorder,
  timestampDescriptor
) {
  const span = timestampDescriptor
    ? beginTimestampSpan(gpuTimestampRecorder, encoder, timestampDescriptor)
    : null;
  const pass = encoder.beginComputePass({ label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
    throw new TypeError(
      'mechanics field pair requires indirect compute dispatch support'
    );
  }
  pass.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffsetBytes);
  pass.end();
  endTimestampSpan(gpuTimestampRecorder, encoder, span);
  return 1;
}

function encodeGroupedIndirectPass(
  encoder,
  commands,
  indirectBuffer,
  label
) {
  const pass = encoder.beginComputePass({ label });
  for (const {
    pipeline,
    bindGroup,
    indirectOffsetBytes
  } of commands) {
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
      throw new TypeError(
        'mechanics field pair projection requires indirect compute dispatch support'
      );
    }
    pass.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffsetBytes);
  }
  pass.end();
  return commands.length;
}

function createPairParamsData(plans, parents, pairCandidateCapacity, combinedNodeSpan, {
  sourceCount,
  sourceCapacity,
  sourceRowLayoutId,
  identityStrideWords,
  maxComputeWorkgroupsPerDimension
}) {
  const data = new ArrayBuffer(PAIR_PARAMS_BYTES);
  const view = new DataView(data);
  let word = 0;
  const u32 = (value) => {
    view.setUint32(word * UINT32_BYTES, Number(value) >>> 0, true);
    word += 1;
  };
  const i32 = (value) => {
    view.setInt32(word * UINT32_BYTES, Number(value) | 0, true);
    word += 1;
  };
  const f32 = (value) => {
    view.setFloat32(word * UINT32_BYTES, Math.fround(Number(value)), true);
    word += 1;
  };
  const fine = plans[0];
  u32(sourceCount);
  u32(sourceCapacity);
  u32(fine.sourceRowStrideFloats);
  u32(sourceRowLayoutId);
  u32(identityStrideWords);
  u32(fine.completionOrdinal);
  u32(fine.generationId);
  u32(fine.deviceOrdinal);
  u32(fine.laneOrdinal);
  u32(fine.leaseToken);
  u32(fine.sourceFamilyId);
  u32(fine.storageGeneration);
  u32(fine.physicsTick);
  u32(fine.physicsSubstep);
  u32(fine.positionEpoch);
  u32(fine.topologyEpoch);
  u32(fine.chartEpoch);
  u32(fine.levelEpoch);
  u32(fine.supportEpoch);
  u32(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE);
  u32(27);
  u32(maxComputeWorkgroupsPerDimension);
  i32(plans[0].selectedLevel);
  i32(plans[1].selectedLevel);
  for (let level = 0; level < 2; level += 1) {
    const plan = plans[level];
    const parent = parents[level];
    u32(plan.gridNodeCount);
    u32(plan.gridDims[0]);
    u32(plan.gridDims[1]);
    u32(plan.gridDims[2]);
    u32(plan.gridShift);
    f32(plan.gridSpacingM);
    f32(1 / plan.gridSpacingM);
    u32(plan.fieldCapacity);
    u32(plan.layout.descriptorOffsetWords);
    u32(plan.layout.descriptorWords);
    u32(plan.layout.keyOffsetWords);
    u32(plan.layout.keyWords);
    u32(plan.layout.accumulatorOffsetWords);
    u32(plan.layout.accumulatorWords);
    u32(plan.layout.stateOffsetWords);
    u32(plan.layout.stateWords);
    u32(plan.layout.wordLength);
    u32(parent.layout.wordLength);
    u32(parent.nodeCapacity);
  }
  u32(pairCandidateCapacity);
  u32(combinedNodeSpan);
  if (word !== PAIR_PARAMS_BYTES / UINT32_BYTES) {
    throw new Error(`mechanics field pair params wrote ${word} words, expected 64`);
  }
  return data;
}

function lineageMatches(left, right) {
  return [
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
    'supportEpoch',
    'completionOrdinal'
  ].every((field) => Object.is(left?.[field], right?.[field]));
}

/**
 * Build two field-v5 dictionaries with one exact ActiveSource-sized radix.
 */
export function createSchroederSpatialMechanicsFieldPairGpu(device, {
  maxSourceCount,
  maxPhysicalSourceCount = maxSourceCount,
  activeSourceCapacity = maxPhysicalSourceCount,
  levelGrids,
  identityStrideWords = 1,
  arenaCount = 2,
  label = 'ulg-schroeder-spatial-mechanics-field-pair'
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
  if (!Array.isArray(levelGrids) || levelGrids.length !== 2) {
    throw new TypeError('levelGrids must contain exact fine and coarse grid specs');
  }
  const templatePlans = levelGrids.map((grid, levelOrdinal) => (
    createSchroederSpatialMechanicsFieldViewPlan({
      sourceCount: 1,
      sourceCapacity: resolvedMaxSourceCount,
      activeSourceCapacity: resolvedActiveSourceCapacity,
      sourceAuthorityVersion:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
      identityStrideWords: resolvedIdentityStrideWords,
      selectedLevel: levelOrdinal,
      gridNodeCount: grid?.gridNodeCount,
      gridDims: grid?.gridDims,
      gridShift: grid?.gridShift,
      gridSpacingM: grid?.gridSpacingM,
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
      supportEpoch: 0,
      completionOrdinal: 1
    })
  ));
  if (
    templatePlans[0].gridNodeCount === templatePlans[1].gridNodeCount
    && templatePlans[0].gridShift === templatePlans[1].gridShift
    && Object.is(
      templatePlans[0].gridSpacingM,
      templatePlans[1].gridSpacingM
    )
    && templatePlans[0].gridDims.every(
      (value, axis) => value === templatePlans[1].gridDims[axis]
    )
  ) {
    throw new RangeError(
      'paired mechanics field fine and coarse grids must be distinct'
    );
  }
  const combinedNodeSpan =
    templatePlans[0].gridNodeCount + templatePlans[1].gridNodeCount;
  if (
    !Number.isSafeInteger(combinedNodeSpan)
    || combinedNodeSpan >= INVALID_RADIX_KEY
  ) {
    throw new RangeError(
      'fine and coarse grid node domains exceed the non-sentinel u32 key range'
    );
  }
  const pairCandidateCapacity = checkedProduct(
    resolvedActiveSourceCapacity,
    27,
    'mechanics field pair candidate capacity'
  );
  const projectionScanPlan = createPairProjectionScanPlan(
    pairCandidateCapacity
  );
  const candidateKeyByteLength =
    pairCandidateCapacity * FIELD_P2G_CONTRIBUTION_WORDS * UINT32_BYTES;
  const stableOrderByteLength = pairCandidateCapacity * UINT32_BYTES;
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
  for (const [role, bytes] of [
    ['candidate keys', candidateKeyByteLength],
    ['fine stable order', stableOrderByteLength],
    ['coarse stable order', stableOrderByteLength],
    ['stable-order projection scratch', projectionScanPlan.scratchByteLength],
    ['fine field view', templatePlans[0].layout.byteLength],
    ['coarse field view', templatePlans[1].layout.byteLength]
  ]) {
    if (bytes > maxBufferSize || bytes > maxStorageBufferBindingSize) {
      throw new RangeError(`${role} requires ${bytes} bytes beyond device capacity`);
    }
  }

  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: schroederSpatialMechanicsFieldPairWgsl
  });
  const pipeline = (suffix, entryPoint) => device.createComputePipeline({
    label: `${label}-${suffix}-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  const pipelines = Object.freeze({
    emit: pipeline('emit', 'emit_pair_candidates'),
    preparePartition: pipeline(
      'prepare-partition',
      'prepare_pair_unique_partition'
    ),
    scanTailLevels: Object.freeze(Array.from(
      { length: PAIR_PROJECTION_SCAN_MAX_LEVELS },
      (_, level) => pipeline(
        `scan-tail-level-${level}`,
        `scan_pair_tail_level_${level}`
      )
    )),
    addTailLevels: Object.freeze([2, 1, 0].map((level) => pipeline(
      `add-tail-level-${level}`,
      `add_pair_tail_level_${level}`
    ))),
    scatterStableOrder: pipeline(
      'scatter-stable-order',
      'scatter_pair_stable_order'
    ),
    completePartition: pipeline(
      'complete-partition',
      'complete_pair_unique_partition'
    ),
    materialize: pipeline(
      'materialize-stencil-map',
      'materialize_pair_stencil_indices'
    ),
    assemble: pipeline('assemble', 'assemble_pair_field_keys'),
    finalize: pipeline('finalize', 'finalize_pair_fields')
  });
  const deviceId = webGpuDeviceId(device);
  let runtime = null;
  let destroyed = false;
  let deviceLossObserved = false;
  let serial = 0;

  const arenas = [];
  const constructionOwnedBuffers = new Set();
  const constructionOrphanedRadixBuffers = new Set();
  const constructionRadixes = new Set();
  const cleanupFailedConstruction = () => {
    const destroyedBuffers = new Set();
    for (const buffer of [
      ...constructionOwnedBuffers,
      ...constructionOrphanedRadixBuffers
    ]) {
      if (!buffer || destroyedBuffers.has(buffer)) continue;
      destroyedBuffers.add(buffer);
      try {
        buffer.destroy?.();
      } catch {
        // Construction failure remains authoritative. Continue retiring every
        // allocation that is still reachable from this construction attempt.
      }
    }
    for (const radix of constructionRadixes) {
      try {
        radix.destroy();
      } catch {
        // Preserve the originating construction error.
      }
    }
  };
  try {
    for (let arenaIndex = 0; arenaIndex < resolvedArenaCount; arenaIndex += 1) {
      const arenaLabel = `${label}-arena-${arenaIndex}`;
      let radixBufferSink = new Set();
      const radixConstructionBuffers = radixBufferSink;
      const radixDevice = createBufferTrackingDevice(
        device,
        (buffer) => radixBufferSink?.add(buffer)
      );
      let radix;
      try {
        radix = createWebGpuStableRadixScanUnique(radixDevice, {
          maxElementCount: pairCandidateCapacity,
          maxKeyWordCount: FIELD_RADIX_KEY_WORDS,
          label: `${arenaLabel}-shared-radix`,
          maxComputeWorkgroupsPerDimension,
          retainConstantScanParamsBuffers: true,
          retainVariableScanParamsBuffers: true,
          serialHistogramScanMaxElementCount:
            FIELD_SERIAL_HISTOGRAM_SCAN_MAX_ELEMENT_COUNT,
          retainedParamsSlotCount: 1
        });
      } catch (error) {
        for (const buffer of radixConstructionBuffers) {
          constructionOrphanedRadixBuffers.add(buffer);
        }
        radixBufferSink = null;
        throw error;
      }
      constructionRadixes.add(radix);
      const preparationBuffers = new Set();
      radixBufferSink = preparationBuffers;
      try {
        radix.prepareGpuCountResources();
      } catch (error) {
        // GPU-count resources are committed to the radix owner only after the
        // complete retained population is prepared. A partial population is
        // therefore caller-reachable only through this construction tracker.
        for (const buffer of preparationBuffers) {
          constructionOrphanedRadixBuffers.add(buffer);
        }
        throw error;
      } finally {
        radixBufferSink = null;
      }
      const arena = {
        arenaIndex,
        inUse: false,
        token: null,
        retired: false,
        quarantined: false,
        radixDeviceLossRetired: false,
        destroyedBuffers: new Set(),
        paramsBuffer: createOwnedBuffer(
          device,
          `${arenaLabel}-params`,
          PAIR_PARAMS_BYTES,
          GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
          constructionOwnedBuffers
        ),
        candidateKeyBuffer: createOwnedBuffer(
          device,
          `${arenaLabel}-candidate-keys`,
          candidateKeyByteLength,
          GPU_BUFFER_USAGE.STORAGE
            | GPU_BUFFER_USAGE.COPY_SRC
            | GPU_BUFFER_USAGE.COPY_DST,
          constructionOwnedBuffers
        ),
        pairControlBuffer: createOwnedBuffer(
          device,
          `${arenaLabel}-control`,
          PAIR_CONTROL_WORDS * UINT32_BYTES,
          GPU_BUFFER_USAGE.STORAGE
            | GPU_BUFFER_USAGE.INDIRECT
            | GPU_BUFFER_USAGE.COPY_SRC
            | GPU_BUFFER_USAGE.COPY_DST,
          constructionOwnedBuffers
        ),
        projectionDispatchBuffer: createOwnedBuffer(
          device,
          `${arenaLabel}-stable-order-projection-dispatch`,
          PAIR_PROJECTION_DISPATCH_WORDS * UINT32_BYTES,
          GPU_BUFFER_USAGE.STORAGE
            | GPU_BUFFER_USAGE.INDIRECT
            | GPU_BUFFER_USAGE.COPY_SRC
            | GPU_BUFFER_USAGE.COPY_DST,
          constructionOwnedBuffers
        ),
        fieldViewBuffers: templatePlans.map((plan, levelOrdinal) => (
          createOwnedBuffer(
            device,
            `${arenaLabel}-level-${levelOrdinal}-field-view`,
            plan.layout.byteLength,
            GPU_BUFFER_USAGE.STORAGE
              | GPU_BUFFER_USAGE.INDIRECT
              | GPU_BUFFER_USAGE.COPY_SRC
              | GPU_BUFFER_USAGE.COPY_DST,
            constructionOwnedBuffers
          )
        )),
        stableOrderBuffers: [0, 1].map((levelOrdinal) => createOwnedBuffer(
          device,
          `${arenaLabel}-level-${levelOrdinal}-stable-order`,
          stableOrderByteLength,
          GPU_BUFFER_USAGE.STORAGE
            | GPU_BUFFER_USAGE.COPY_SRC
            | GPU_BUFFER_USAGE.COPY_DST,
          constructionOwnedBuffers
        )),
        projectionScanBuffer: createOwnedBuffer(
          device,
          `${arenaLabel}-stable-order-projection-scan`,
          projectionScanPlan.scratchByteLength,
          GPU_BUFFER_USAGE.STORAGE
            | GPU_BUFFER_USAGE.COPY_SRC
            | GPU_BUFFER_USAGE.COPY_DST,
          constructionOwnedBuffers
        ),
        radix
      };
      arenas.push(arena);
    }
  } catch (error) {
    cleanupFailedConstruction();
    throw error;
  }

  const allocationEntriesForArena = (arena) => [
    { role: 'mechanics-field-pair-params', arenaIndex: arena.arenaIndex, buffer: arena.paramsBuffer },
    { role: 'mechanics-field-pair-candidate-keys', arenaIndex: arena.arenaIndex, buffer: arena.candidateKeyBuffer },
    { role: 'mechanics-field-pair-control', arenaIndex: arena.arenaIndex, buffer: arena.pairControlBuffer },
    {
      role: 'mechanics-field-pair-stable-order-projection-dispatch',
      arenaIndex: arena.arenaIndex,
      buffer: arena.projectionDispatchBuffer
    },
    ...arena.fieldViewBuffers.map((buffer, levelOrdinal) => ({
      role: `mechanics-field-pair-level-${levelOrdinal}-view`,
      arenaIndex: arena.arenaIndex,
      buffer
    })),
    ...arena.stableOrderBuffers.map((buffer, levelOrdinal) => ({
      role: `mechanics-field-pair-level-${levelOrdinal}-stable-order`,
      arenaIndex: arena.arenaIndex,
      buffer
    })),
    {
      role: 'mechanics-field-pair-stable-order-projection-scan',
      arenaIndex: arena.arenaIndex,
      buffer: arena.projectionScanBuffer
    },
    ...arena.radix.allocationEntries().map((entry) => ({
      ...entry,
      role: `mechanics-field-pair-shared-${entry.role}`,
      arenaIndex: arena.arenaIndex
    }))
  ];
  let retainedGpuBufferBytes;
  let totalPipelineCount;
  try {
    retainedGpuBufferBytes = arenas.reduce((total, arena) => (
      total + allocationEntriesForArena(arena).reduce(
        (sum, entry) => sum + Number(entry.buffer?.size ?? 0),
        0
      )
    ), 0);
    totalPipelineCount = PAIR_PROJECTION_PIPELINE_COUNT + arenas.reduce(
      (sum, arena) => sum + arena.radix.totalPipelineCount,
      0
    );
  } catch (error) {
    cleanupFailedConstruction();
    throw error;
  }

  function acquireArena() {
    if (destroyed) throw new Error('mechanics field pair runtime is destroyed');
    if (deviceLossObserved) {
      const error = new Error('mechanics field pair runtime observed device loss');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_DEVICE_LOST';
      throw error;
    }
    const arena = arenas.find((candidate) => (
      candidate.inUse !== true && candidate.retired !== true
    ));
    if (!arena) {
      const error = new Error('mechanics field pair arenas are under backpressure');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_ARENA_EXHAUSTED';
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

  function createBindings(pipelineObject, resources, bindings, bindLabel) {
    return device.createBindGroup({
      label: bindLabel,
      layout: pipelineObject.getBindGroupLayout(0),
      entries: bindings.map((binding) => ({
        binding,
        resource: resources.get(binding)
      }))
    });
  }

  function admitParent(parent, plan, {
    sourceBuffer,
    sourceCount,
    sourceRowLayoutId
  }) {
    let parentOwned = false;
    let spatialOwned = false;
    try {
      parentOwned = parent?.ownerRuntime?.ownsExecution?.(parent) === true;
      spatialOwned = parent?.spatialExecution?.ownerRuntime?.ownsExecution?.(
        parent.spatialExecution
      ) === true;
    } catch {
      parentOwned = false;
      spatialOwned = false;
    }
    const activeSourceView = parent?.activeSourceView;
    let activeAdmission = { admitted: false };
    try {
      activeAdmission = validateSchroederSpatialActiveSourceViewDescriptor(
        activeSourceView,
        {
          sourceBuffer,
          activeSourceViewBuffer: parent.activeSourceViewBuffer,
          physicalSourceCount: sourceCount,
          physicalSourceCapacity: resolvedMaxSourceCount,
          generationId: parent.generationId,
          deviceOrdinal: parent.deviceOrdinal,
          laneOrdinal: parent.laneOrdinal,
          leaseToken: parent.leaseToken,
          sourceFamilyId: parent.sourceFamilyId,
          storageGeneration: parent.storageGeneration,
          physicsTick: parent.physicsTick,
          physicsSubstep: parent.physicsSubstep,
          positionEpoch: parent.positionEpoch,
          topologyEpoch: parent.topologyEpoch,
          chartEpoch: parent.chartEpoch,
          levelEpoch: parent.levelEpoch,
          supportEpoch: parent.supportEpoch,
          buildOrdinal: parent.completionOrdinal
        }
      );
    } catch {
      activeAdmission = { admitted: false };
    }
    const spatial = parent?.spatialExecution;
    const authority = parent?.activeSourceCountAuthority;
    const gridMatches =
      parent?.gridNodeCount === plan.gridNodeCount
      && parent.gridShift === plan.gridShift
      && Object.is(parent.gridSpacingM, plan.gridSpacingM)
      && Array.from(parent.gridDims || []).length === 3
      && Array.from(parent.gridDims || []).every(
        (value, axis) => value === plan.gridDims[axis]
      );
    if (
      parent?.schema !== ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA
      || parent.status !== 'schroeder-spatial-mechanics-view-gpu-encoded'
      || parent.submitPerformed !== false
      || parent.released === true
      || !parentOwned
      || parent.sourceBuffer !== sourceBuffer
      || parent.sourceCount !== sourceCount
      || parent.sourceRowLayoutId !== sourceRowLayoutId
      || parent.selectedLevel !== plan.selectedLevel
      || !gridMatches
      || parent.sourceAuthorityVersion
        !== SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
      || parent.directoryAbiVersion
        !== SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2
      || parent.sourceWorkIdentity !== 'gpu-active-ordinal'
      || parent.physicalSourceCount !== sourceCount
      || parent.directorySchema !== ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
      || spatial?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
      || spatial.abiVersion !== SCHROEDER_SPATIAL_EPOCH_V2_VERSION
      || spatial.reverseEncoding
        !== SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE
      || spatial.physicalSourceCount !== sourceCount
      || spatial.physicalSourceCapacity !== resolvedMaxSourceCount
      || spatial.activeSourceCapacity !== resolvedActiveSourceCapacity
      || spatial.sourceBuffer !== sourceBuffer
      || spatial.buildOrdinal !== parent.completionOrdinal
      || spatial.directoryBuffer !== parent.directoryBuffer
      || spatial.activeSourceView !== activeSourceView
      || spatial.activeSourceCountAuthority !== authority
      || spatial.activeSourceViewBuffer !== parent.activeSourceViewBuffer
      || !spatialOwned
      || activeAdmission.admitted !== true
      || authority?.activeSourceView !== activeSourceView
      || authority?.buffer !== parent.activeSourceViewBuffer
      || authority?.offsetWords !== 18
      || authority?.offsetBytes !== 18 * UINT32_BYTES
      || authority?.capacity !== activeSourceView?.activeSourceCapacity
      || activeSourceView?.activeSourceCapacity
        !== resolvedActiveSourceCapacity
      || !webGpuBufferMatchesDevice(parent.mechanicsViewBuffer, device)
      || !webGpuBufferMatchesDevice(spatial.directoryBuffer, device)
      || !webGpuBufferMatchesDevice(parent.activeSourceViewBuffer, device)
    ) {
      throw new TypeError(
        'mechanics field pair requires exact live directory-v2 parent lineage'
      );
    }
    return { spatial, activeSourceView, authority };
  }

  function encode(encoder, {
    sourceBuffer,
    identityBuffer,
    sourceCount,
    sourceRowLayoutId,
    identityStrideWords: requestedIdentityStrideWords =
      resolvedIdentityStrideWords,
    levelViews,
    gpuTimestampRecorder = null,
    timestampMetadata = {}
  } = {}) {
    assertEncoder(encoder);
    if (destroyed) {
      throw new Error('mechanics field pair runtime is destroyed');
    }
    if (deviceLossObserved) {
      const error = new Error(
        'mechanics field pair runtime observed device loss'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_DEVICE_LOST';
      throw error;
    }
    if (!sourceBuffer || !webGpuBufferMatchesDevice(sourceBuffer, device)) {
      throw new TypeError(
        'mechanics field pair sourceBuffer must belong to the runtime device'
      );
    }
    if (!identityBuffer || !webGpuBufferMatchesDevice(identityBuffer, device)) {
      throw new TypeError(
        'mechanics field pair identityBuffer must belong to the runtime device'
      );
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
      throw new RangeError(
        'mechanics field pair identity stride does not match the retained runtime'
      );
    }
    if (!Array.isArray(levelViews) || levelViews.length !== 2) {
      throw new TypeError(
        'levelViews must contain exact fine and coarse mechanics parents'
      );
    }
    const selectedLevels = levelViews.map((view, levelOrdinal) => integer(
      view?.selectedLevel,
      `levelViews[${levelOrdinal}].selectedLevel`,
      -0x8000_0000,
      0x7fff_ffff
    ));
    if (selectedLevels[0] === selectedLevels[1]) {
      throw new RangeError('paired mechanics field selected levels must be distinct');
    }
    const firstParent = levelViews[0]?.parentMechanicsView;
    if (!firstParent) {
      throw new TypeError('levelViews[0].parentMechanicsView is required');
    }
    const plans = templatePlans.map((template, levelOrdinal) => (
      createSchroederSpatialMechanicsFieldViewPlan({
        sourceCount: resolvedSourceCount,
        sourceCapacity: resolvedMaxSourceCount,
        activeSourceCapacity: resolvedActiveSourceCapacity,
        sourceAuthorityVersion:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
        sourceRowLayoutId,
        identityStrideWords: resolvedStride,
        selectedLevel: selectedLevels[levelOrdinal],
        gridNodeCount: template.gridNodeCount,
        gridDims: template.gridDims,
        gridShift: template.gridShift,
        gridSpacingM: template.gridSpacingM,
        generationId: firstParent.generationId,
        deviceOrdinal: firstParent.deviceOrdinal,
        laneOrdinal: firstParent.laneOrdinal,
        leaseToken: firstParent.leaseToken,
        sourceFamilyId: firstParent.sourceFamilyId,
        storageGeneration: firstParent.storageGeneration,
        physicsTick: firstParent.physicsTick,
        physicsSubstep: firstParent.physicsSubstep,
        positionEpoch: firstParent.positionEpoch,
        topologyEpoch: firstParent.topologyEpoch,
        chartEpoch: firstParent.chartEpoch,
        levelEpoch: firstParent.levelEpoch,
        supportEpoch: firstParent.supportEpoch,
        completionOrdinal: firstParent.completionOrdinal
      })
    ));
    const parents = levelViews.map((view) => view?.parentMechanicsView);
    const admissions = parents.map((parent, levelOrdinal) => admitParent(
      parent,
      plans[levelOrdinal],
      {
        sourceBuffer,
        sourceCount: resolvedSourceCount,
        sourceRowLayoutId
      }
    ));
    if (
      !lineageMatches(parents[0], parents[1])
      || admissions[0].spatial !== admissions[1].spatial
      || admissions[0].activeSourceView !== admissions[1].activeSourceView
      || admissions[0].authority !== admissions[1].authority
    ) {
      throw new TypeError(
        'paired mechanics parents must project one exact spatial generation'
      );
    }
    const spatialExecution = admissions[0].spatial;
    const activeSourceView = admissions[0].activeSourceView;
    const activeSourceCountAuthority = admissions[0].authority;
    const requiredSourceBytes =
      resolvedSourceCount * 16 * Float32Array.BYTES_PER_ELEMENT;
    const requiredIdentityBytes =
      resolvedSourceCount * resolvedStride * UINT32_BYTES;
    if (Number(sourceBuffer.size) < requiredSourceBytes) {
      throw new RangeError(
        'mechanics field pair sourceBuffer is smaller than the admitted family'
      );
    }
    if (Number(identityBuffer.size) < requiredIdentityBytes) {
      throw new RangeError(
        'mechanics field pair identityBuffer is smaller than the admitted family'
      );
    }
    const { arena, token } = acquireArena();
    let radixUnique = null;
    try {
      encoder.clearBuffer(arena.pairControlBuffer);
      encoder.clearBuffer(arena.projectionDispatchBuffer);
      for (let level = 0; level < 2; level += 1) {
        encoder.clearBuffer(
          arena.fieldViewBuffers[level],
          0,
          plans[level].layout.keyOffsetWords * UINT32_BYTES
        );
      }
      const resources = new Map([
        [0, { buffer: sourceBuffer, offset: 0, size: requiredSourceBytes }],
        [1, { buffer: identityBuffer, offset: 0, size: requiredIdentityBytes }],
        [2, { buffer: arena.candidateKeyBuffer }],
        [3, { buffer: arena.fieldViewBuffers[0] }],
        [4, { buffer: arena.fieldViewBuffers[1] }],
        [7, { buffer: parents[0].mechanicsViewBuffer }],
        [8, { buffer: parents[1].mechanicsViewBuffer }],
        [9, { buffer: arena.paramsBuffer }],
        [12, {
          buffer: spatialExecution.directoryBuffer,
          offset: 0,
          size: spatialExecution.layout.byteLength
        }],
        [13, {
          buffer: activeSourceView.activeSourceViewBuffer,
          offset: 0,
          size: activeSourceView.layout.byteLength
        }],
        [14, { buffer: arena.pairControlBuffer }],
        [15, { buffer: arena.stableOrderBuffers[0] }],
        [16, { buffer: arena.stableOrderBuffers[1] }],
        [17, { buffer: arena.projectionScanBuffer }],
        [18, { buffer: arena.projectionDispatchBuffer }]
      ]);
      const emitBindings = createBindings(
        pipelines.emit,
        resources,
        [0, 1, 2, 3, 4, 9, 12, 13],
        `${label}-arena-${arena.arenaIndex}-emit-bindings`
      );
      const commonTimestamp = {
        parentProducerId: 'schroeder-spatial-mechanics-field-pair-build',
        generationId: plans[0].generationId,
        selectedLevels,
        sourceCount: plans[0].sourceCount,
        candidateCount: null,
        candidateCountSource: 'active-source-view-word-43',
        ...timestampMetadata
      };
      let encodedDispatchCount = encodeIndirectPass(
        encoder,
        pipelines.emit,
        emitBindings,
        activeSourceView.activeSourceViewBuffer,
        activeSourceView.activeDispatchOffsetBytes,
        `${label}EmitPairCandidates`,
        gpuTimestampRecorder,
        {
          producerId: 'schroeder-spatial-mechanics-field-pair-candidate-emission',
          stage: 'paired-candidate-emission',
          spanClass: 'same-production-command-encoder',
          ...commonTimestamp
        }
      );
      radixUnique = arena.radix.encodeSortUniqueGpuCount(encoder, {
        keyBuffer: arena.candidateKeyBuffer,
        authorityBuffer: activeSourceView.activeSourceViewBuffer,
        authorityCountByteOffset: 43 * UINT32_BYTES,
        generationSeal: {
          expected: activeSourceView.buildOrdinal,
          byteOffset: 30 * UINT32_BYTES
        },
        maxElementCount: pairCandidateCapacity,
        keyWordCount: FIELD_RADIX_KEY_WORDS,
        keyStrideWords: FIELD_RADIX_KEY_WORDS,
        significantDigitRows: mechanicsFieldPairSignificantDigitRows(
          combinedNodeSpan,
          identityBuffer
        ),
        generationId: plans[0].generationId,
        consumerWorkgroupSize:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
        retainedParamsSlotIndex: 0,
        gpuTimestampRecorder,
        timestampProducerId:
          'schroeder-spatial-mechanics-field-pair-shared-radix-gpu-count',
        timestampMetadata: commonTimestamp
      });
      encodedDispatchCount += radixUnique.encodedDispatchCount;
      resources.set(5, { buffer: radixUnique.uniqueKeysBuffer });
      resources.set(6, { buffer: radixUnique.uniqueEvidenceBuffer });
      resources.set(10, { buffer: radixUnique.sortedIndicesBuffer });
      resources.set(
        11,
        { buffer: radixUnique.uniqueGroupIndexBySortedPositionBuffer }
      );
      const preparePartitionBindings = createBindings(
        pipelines.preparePartition,
        resources,
        [2, 5, 6, 9, 10, 13, 14, 17, 18],
        `${label}-arena-${arena.arenaIndex}-prepare-partition-bindings`
      );
      const scanTailBindings = pipelines.scanTailLevels.map(
        (pipelineObject, level) => createBindings(
          pipelineObject,
          resources,
          [2, 9, 14, 17],
          `${label}-arena-${arena.arenaIndex}-scan-tail-${level}-bindings`
        )
      );
      const addTailBindings = pipelines.addTailLevels.map(
        (pipelineObject, index) => createBindings(
          pipelineObject,
          resources,
          [9, 14, 17],
          `${label}-arena-${arena.arenaIndex}-add-tail-${2 - index}-bindings`
        )
      );
      const scatterStableOrderBindings = createBindings(
        pipelines.scatterStableOrder,
        resources,
        [2, 9, 10, 14, 15, 16, 17],
        `${label}-arena-${arena.arenaIndex}-scatter-stable-order-bindings`
      );
      const completePartitionBindings = createBindings(
        pipelines.completePartition,
        resources,
        [2, 9, 14, 17],
        `${label}-arena-${arena.arenaIndex}-complete-partition-bindings`
      );
      const materializeBindings = createBindings(
        pipelines.materialize,
        resources,
        [2, 3, 4, 6, 9, 10, 11, 13, 14],
        `${label}-arena-${arena.arenaIndex}-materialize-bindings`
      );
      const assembleBindings = createBindings(
        pipelines.assemble,
        resources,
        [3, 4, 5, 7, 8, 9, 13, 14],
        `${label}-arena-${arena.arenaIndex}-assemble-bindings`
      );
      const finalizeBindings = createBindings(
        pipelines.finalize,
        resources,
        [3, 4, 6, 7, 8, 9, 12, 13, 14],
        `${label}-arena-${arena.arenaIndex}-finalize-bindings`
      );
      const partitionTimestampSpan = beginTimestampSpan(
        gpuTimestampRecorder,
        encoder,
        {
          producerId: 'schroeder-spatial-mechanics-field-pair-partition',
          stage: 'parallel-partition-and-stable-order-projection',
          spanClass: 'same-production-command-encoder',
          ...commonTimestamp
        }
      );
      encodedDispatchCount += encodeDirectPass(
        encoder,
        pipelines.preparePartition,
        preparePartitionBindings,
        [1, 1, 1],
        `${label}PreparePairPartition`,
        null,
        null
      );
      const projectionCommands = [
        ...pipelines.scanTailLevels.map((pipelineObject, level) => ({
          pipeline: pipelineObject,
          bindGroup: scanTailBindings[level],
          indirectOffsetBytes: (
            PAIR_PROJECTION_SCAN_DISPATCH_BASE_WORDS
            + level * PAIR_PROJECTION_SCAN_DISPATCH_STRIDE_WORDS
          ) * UINT32_BYTES
        })),
        ...pipelines.addTailLevels.map((pipelineObject, index) => {
          const level = 2 - index;
          return {
            pipeline: pipelineObject,
            bindGroup: addTailBindings[index],
            indirectOffsetBytes: (
              PAIR_PROJECTION_SCAN_DISPATCH_BASE_WORDS
              + level * PAIR_PROJECTION_SCAN_DISPATCH_STRIDE_WORDS
              + 3
            ) * UINT32_BYTES
          };
        }),
        {
          pipeline: pipelines.scatterStableOrder,
          bindGroup: scatterStableOrderBindings,
          indirectOffsetBytes:
            PAIR_PROJECTION_SCAN_DISPATCH_BASE_WORDS * UINT32_BYTES
        }
      ];
      encodedDispatchCount += encodeGroupedIndirectPass(
        encoder,
        projectionCommands,
        arena.projectionDispatchBuffer,
        `${label}ParallelStableOrderProjection`
      );
      encodedDispatchCount += encodeDirectPass(
        encoder,
        pipelines.completePartition,
        completePartitionBindings,
        [1, 1, 1],
        `${label}CompletePairPartition`,
        null,
        null
      );
      endTimestampSpan(gpuTimestampRecorder, encoder, partitionTimestampSpan);
      encodedDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.materialize,
        materializeBindings,
        activeSourceView.activeSourceViewBuffer,
        activeSourceView.candidateDispatchOffsetBytes,
        `${label}MaterializePairStencilMap`,
        gpuTimestampRecorder,
        {
          producerId: 'schroeder-spatial-mechanics-field-pair-stencil-map',
          stage: 'paired-stencil-map',
          spanClass: 'same-production-command-encoder',
          ...commonTimestamp
        }
      );
      encodedDispatchCount += encodeIndirectPass(
        encoder,
        pipelines.assemble,
        assembleBindings,
        activeSourceView.activeSourceViewBuffer,
        activeSourceView.candidateDispatchOffsetBytes,
        `${label}AssemblePairKeys`,
        gpuTimestampRecorder,
        {
          producerId: 'schroeder-spatial-mechanics-field-pair-key-assembly',
          stage: 'paired-key-assembly',
          spanClass: 'same-production-command-encoder',
          ...commonTimestamp
        }
      );
      encodedDispatchCount += encodeDirectPass(
        encoder,
        pipelines.finalize,
        finalizeBindings,
        [1, 1, 1],
        `${label}FinalizePair`,
        gpuTimestampRecorder,
        {
          producerId: 'schroeder-spatial-mechanics-field-pair-finalize',
          stage: 'paired-finalize',
          spanClass: 'same-production-command-encoder',
          ...commonTimestamp
        }
      );
      device.queue.writeBuffer(
        arena.paramsBuffer,
        0,
        createPairParamsData(
          plans,
          parents,
          pairCandidateCapacity,
          combinedNodeSpan,
          {
            sourceCount: resolvedSourceCount,
            sourceCapacity: resolvedMaxSourceCount,
            sourceRowLayoutId,
            identityStrideWords: resolvedStride,
            maxComputeWorkgroupsPerDimension
          }
        )
      );

      const group = {
        arena,
        token,
        radixUnique,
        pairExecution: null,
        children: null,
        submitted: false,
        released: false,
        releaseInFlight: false,
        retirementAttempt: null,
        deviceLossEvidence: null,
        completionPromise: null,
        resolveCompletion: null,
        mutations: [0, 1].map(() => ({
          ordinal: 0,
          encoding: 0,
          operation: 'topology-ready',
          pending: null,
          publicationLock: null,
          quarantined: false,
          quarantineReason: null
        }))
      };
      group.completionPromise = new Promise((resolve) => {
        group.resolveCompletion = resolve;
      });
      const stableCandidateOrderCountAuthority = Object.freeze({
        buffer: activeSourceView.activeSourceViewBuffer,
        offsetWords: 43,
        sealOffsetWords: 30,
        expectedSeal: activeSourceView.buildOrdinal
      });
      const constructionDispatchEvidence = Object.freeze({
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
      });
      const children = plans.map((plan, levelOrdinal) => {
        const execution = {
          ...plan,
          schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
          status: 'schroeder-spatial-mechanics-field-view-gpu-encoded',
          deviceId,
          arenaIndex: arena.arenaIndex,
          arenaGeneration: token.serial,
          sourceBuffer,
          identityBuffer,
          parentMechanicsView: parents[levelOrdinal],
          sourceAuthorityVersion:
            SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
          physicalSourceCount: plan.sourceCount,
          directorySchema: ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
          directoryAbiVersion: SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
          spatialExecution,
          directoryBuffer: spatialExecution.directoryBuffer,
          activeSourceView,
          activeSourceViewBuffer: activeSourceView.activeSourceViewBuffer,
          activeSourceCountAuthority,
          candidateKeyBuffer: arena.candidateKeyBuffer,
          stableCandidateOrderBuffer: arena.stableOrderBuffers[levelOrdinal],
          stableCandidateOrderCount: null,
          stableCandidateOrderCountAuthority,
          stableCandidateOrderPolicy:
            'stable-radix-equal-key-preserves-particle-stencil-candidate-order',
          ownsStableCandidateOrderBuffer: false,
          radixSortKeyWordCount: FIELD_RADIX_KEY_WORDS,
          radixPassCount: radixUnique.radixPassCount,
          radixSignificantDigitRows: radixUnique.significantDigitRows,
          radixHistogramScanMode: radixUnique.histogramScanMode,
          routeControlBuffer: null,
          routeControlWordLength: 0,
          routeDispatchOffsetWords: 0,
          radixGateOffsetWords: 0,
          radixGateCount: 0,
          forceRadixFallbackRequested: false,
          constructionRoutePolicy:
            'gpu-authenticated-paired-directory-v2-single-gpu-count-radix',
          directDispatchLinearization:
            'linearGroup=workgroup.x+workgroup.y*dispatchX',
          sourceDispatchWorkgroups: null,
          candidateDispatchWorkgroups: null,
          sourceDispatchIndirectBuffer:
            activeSourceView.activeSourceViewBuffer,
          sourceDispatchIndirectOffsetBytes:
            activeSourceView.activeDispatchOffsetBytes,
          candidateDispatchIndirectBuffer:
            activeSourceView.activeSourceViewBuffer,
          candidateDispatchIndirectOffsetBytes:
            activeSourceView.candidateDispatchOffsetBytes,
          maxComputeWorkgroupsPerDimension,
          constructionDispatchEvidence,
          consumerDispatchWorkgroupSize:
            SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_WORKGROUP_SIZE,
          consumerDispatchDimensions: 2,
          consumerDispatchLinearization:
            'linearGroup=workgroup.x+workgroup.y*dispatchX',
          consumerDispatchCapacityPolicy:
            'gpu-finalized-device-limit-bounded-x-y-zero-on-reject',
          fieldViewBuffer: arena.fieldViewBuffers[levelOrdinal],
          indirectDispatchBuffer: arena.fieldViewBuffers[levelOrdinal],
          indirectDispatchOffsetBytes:
            SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DISPATCH_OFFSET_WORDS
              * UINT32_BYTES,
          encodedDispatchCount,
          encodedComputePassCount:
            PAIR_PROJECTION_WRAPPER_COMPUTE_PASS_COUNT
            + radixUnique.encodedComputePassCount,
          stableOrderProjectionPolicy:
            'gpu-authenticated-dual-predicate-exclusive-scan-stable-scatter',
          stableOrderProjectionScanLevelCount: projectionScanPlan.levelCount,
          stableOrderProjectionScratchBytes:
            projectionScanPlan.scratchByteLength,
          stableOrderProjectionHostCountReadbackRequired: false,
          retainedGpuBufferBytes,
          retainedMemoryScaling: 'physical-source-capacity',
          computeDispatchScaling:
            'gpu-active-source-count-and-occupied-field-count',
          gpuBufferCreationCountDuringEncode: 0,
          bufferAllocationCountDuringEncode: 0,
          readbackPerformed: false,
          submitPerformed: false,
          submissionOwnership: 'caller',
          uniqueOrdering: 'stable-lexicographic-u32x4',
          pairLevelOrdinal: levelOrdinal
        };
        Object.defineProperty(execution, 'ownerRuntime', {
          value: runtime,
          enumerable: false
        });
        Object.defineProperty(execution, 'released', {
          get: () => group.released,
          enumerable: true
        });
        Object.defineProperty(execution, 'quarantineReason', {
          get: () => group.mutations[levelOrdinal].quarantineReason,
          enumerable: true
        });
        Object.defineProperties(execution, {
          stateMutationOrdinal: {
            get: () => group.mutations[levelOrdinal].ordinal,
            enumerable: true
          },
          stateMutationEncoding: {
            get: () => group.mutations[levelOrdinal].encoding,
            enumerable: true
          },
          stateMutationOperation: {
            get: () => group.mutations[levelOrdinal].operation,
            enumerable: true
          }
        });
        return execution;
      });
      const pairExecution = {
        schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_PAIR_SCHEMA,
        status: 'schroeder-spatial-mechanics-field-pair-gpu-encoded',
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        sourceBuffer,
        identityBuffer,
        sourceCount: resolvedSourceCount,
        sourceCapacity: resolvedMaxSourceCount,
        activeSourceCapacity: resolvedActiveSourceCapacity,
        generationId: plans[0].generationId,
        completionOrdinal: plans[0].completionOrdinal,
        spatialExecution,
        activeSourceView,
        activeSourceViewBuffer: activeSourceView.activeSourceViewBuffer,
        mechanicsFieldViews: Object.freeze(children),
        sharedRadixExecutionCount: 1,
        radixSortKeyWordCount: FIELD_RADIX_KEY_WORDS,
        radixPassCount: radixUnique.radixPassCount,
        radixSignificantDigitRows: radixUnique.significantDigitRows,
        pairCandidateCapacity,
        candidateCount: null,
        candidateCountAuthority: Object.freeze({
          buffer: activeSourceView.activeSourceViewBuffer,
          offsetWords: 43,
          multiplier: 1,
          sealOffsetWords: 30,
          expectedSeal: activeSourceView.buildOrdinal
        }),
        combinedNodeRangePolicy:
          'fine-node;fine-grid-node-count-plus-coarse-node',
        combinedNodeSpan,
        childStableOrderProjectionCount: 2,
        stableOrderProjectionPolicy:
          'gpu-authenticated-dual-predicate-exclusive-scan-stable-scatter',
        stableOrderProjectionScanLevelCount: projectionScanPlan.levelCount,
        stableOrderProjectionScratchBytes:
          projectionScanPlan.scratchByteLength,
        stableOrderProjectionEncodedIndirectDispatchCount:
          projectionScanPlan.encodedIndirectDispatchCount,
        stableOrderProjectionHostCountReadbackRequired: false,
        encodedDispatchCount,
        encodedComputePassCount:
          PAIR_PROJECTION_WRAPPER_COMPUTE_PASS_COUNT
          + radixUnique.encodedComputePassCount,
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        readbackPerformed: false,
        submitPerformed: false,
        submissionOwnership: 'caller'
      };
      Object.defineProperty(pairExecution, 'ownerRuntime', {
        value: runtime,
        enumerable: false
      });
      Object.defineProperty(pairExecution, 'released', {
        get: () => group.released,
        enumerable: true
      });
      Object.defineProperty(pairExecution, 'quarantineReason', {
        get: () => group.mutations
          .map((mutation) => mutation.quarantineReason)
          .find((reason) => reason != null) ?? null,
        enumerable: true
      });
      for (const child of children) {
        Object.defineProperty(child, 'pairExecution', {
          value: pairExecution,
          enumerable: true
        });
      }
      group.pairExecution = pairExecution;
      group.children = children;
      lifecycle.registerExecutionGroup(group);
      return pairExecution;
    } catch (error) {
      if (radixUnique) {
        try {
          arena.radix.releaseExecution(radixUnique, { discardedEncoder: true });
        } catch {
          // Preserve the original encoding failure.
        }
      }
      releaseArena(arena, token);
      throw error;
    }
  }

  let lifecycle;
  try {
    lifecycle = createSchroederSpatialMechanicsFieldPairLifecycle({
      device,
      getRuntime: () => runtime,
      nextSerial: () => ++serial,
      markDeviceLossObserved: () => {
        deviceLossObserved = true;
      },
      allocationEntriesForArena,
      releaseArena
    });
  } catch (error) {
    cleanupFailedConstruction();
    throw error;
  }

  function destroy() {
    if (destroyed) return false;
    if (arenas.some((arena) => arena.inUse)) {
      throw new Error(
        'mechanics field pair runtime still has active executions'
      );
    }
    destroyed = true;
    for (const arena of arenas) {
      for (const buffer of [
        arena.paramsBuffer,
        arena.candidateKeyBuffer,
        arena.pairControlBuffer,
        arena.projectionDispatchBuffer,
        ...arena.fieldViewBuffers,
        ...arena.stableOrderBuffers,
        arena.projectionScanBuffer
      ]) {
        if (arena.destroyedBuffers.has(buffer)) continue;
        buffer.destroy?.();
        arena.destroyedBuffers.add(buffer);
      }
      if (!arena.radixDeviceLossRetired) arena.radix.destroy();
    }
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_PAIR_SCHEMA,
    status: 'schroeder-spatial-mechanics-field-pair-gpu-runtime-ready',
    deviceId,
    maxSourceCount: resolvedMaxSourceCount,
    maxPhysicalSourceCount: resolvedMaxSourceCount,
    activeSourceCapacity: resolvedActiveSourceCapacity,
    identityStrideWords: resolvedIdentityStrideWords,
    levelGrids: Object.freeze(templatePlans.map((plan) => Object.freeze({
      gridNodeCount: plan.gridNodeCount,
      gridDims: plan.gridDims,
      gridShift: plan.gridShift,
      gridSpacingM: plan.gridSpacingM
    }))),
    pairCandidateCapacity,
    combinedNodeSpan,
    stableOrderProjectionPolicy:
      'gpu-authenticated-dual-predicate-exclusive-scan-stable-scatter',
    stableOrderProjectionScanLevelCount: projectionScanPlan.levelCount,
    stableOrderProjectionScanLevelCounts: projectionScanPlan.levelCounts,
    stableOrderProjectionScratchBytes: projectionScanPlan.scratchByteLength,
    stableOrderProjectionEncodedIndirectDispatchCount:
      projectionScanPlan.encodedIndirectDispatchCount,
    stableOrderProjectionHostCountReadbackRequired: false,
    sharedRadixExecutionCount: 1,
    radixSortKeyWordCount: FIELD_RADIX_KEY_WORDS,
    maxComputeWorkgroupsPerDimension,
    arenaCount: resolvedArenaCount,
    releaseFencePolicy: 'runtime-owned-current-queue-at-invocation',
    pipelineCount: totalPipelineCount,
    retainedGpuBufferBytes,
    encode,
    ownsExecution: lifecycle.ownsExecution,
    markExecutionSubmitted: lifecycle.markExecutionSubmitted,
    isExecutionSubmitted: lifecycle.isExecutionSubmitted,
    isExecutionRetirementInFlight:
      lifecycle.isExecutionRetirementInFlight,
    executionRetirementCompletionPromise:
      lifecycle.executionRetirementCompletionPromise,
    stateMutationState: lifecycle.stateMutationState,
    isStateMutationReservationActive:
      lifecycle.isStateMutationReservationActive,
    reserveStateMutation: lifecycle.reserveStateMutation,
    markStateMutationSubmitted: lifecycle.markStateMutationSubmitted,
    discardStateMutation: lifecycle.discardStateMutation,
    quarantineStateMutation: lifecycle.quarantineStateMutation,
    reserveStateMutationSequence: lifecycle.reserveStateMutationSequence,
    stateMutationSequenceState: lifecycle.stateMutationSequenceState,
    isStateMutationSequenceSegmentReady:
      lifecycle.isStateMutationSequenceSegmentReady,
    isStateMutationSequenceSegmentSubmitted:
      lifecycle.isStateMutationSequenceSegmentSubmitted,
    markStateMutationSequenceStageSubmissionObserved:
      lifecycle.markStateMutationSequenceStageSubmissionObserved,
    isStateMutationSequenceStageSubmissionObserved:
      lifecycle.isStateMutationSequenceStageSubmissionObserved,
    markStateMutationSequenceStageSubmitted:
      lifecycle.markStateMutationSequenceStageSubmitted,
    completeStateMutationSequence: lifecycle.completeStateMutationSequence,
    discardStateMutationSequence: lifecycle.discardStateMutationSequence,
    quarantineStateMutationSequence:
      lifecycle.quarantineStateMutationSequence,
    acquireStatePublicationLock: lifecycle.acquireStatePublicationLock,
    isStatePublicationLockActive: lifecycle.isStatePublicationLockActive,
    discardStatePublicationLock: lifecycle.discardStatePublicationLock,
    mintStatePublicationCapability:
      lifecycle.mintStatePublicationCapability,
    promoteStatePublicationLock: lifecycle.promoteStatePublicationLock,
    retireStatePublicationLockAfter:
      lifecycle.retireStatePublicationLockAfter,
    retireStatePublicationLockQueueOrdered:
      lifecycle.retireStatePublicationLockQueueOrdered,
    quarantineCurrentStateArtifact:
      lifecycle.quarantineCurrentStateArtifact,
    isStateArtifactQuarantined: lifecycle.isStateArtifactQuarantined,
    isCurrentStateArtifact: lifecycle.isCurrentStateArtifact,
    retireQuarantinedExecutionAfter:
      lifecycle.retireQuarantinedExecutionAfter,
    quarantineExecutionAfterDeviceLoss:
      lifecycle.quarantineExecutionAfterDeviceLoss,
    releaseExecution: lifecycle.releaseExecution,
    canReleaseExecutionQueueOrdered:
      lifecycle.canReleaseExecutionQueueOrdered,
    releaseExecutionQueueOrdered:
      lifecycle.releaseExecutionQueueOrdered,
    releaseExecutionAfter: lifecycle.releaseExecutionAfter,
    allocationEntries: () => arenas.flatMap(allocationEntriesForArena),
    activeExecutionCount: () => arenas.filter((arena) => arena.inUse).length,
    availableArenaCount: () => arenas.filter((arena) => (
      !arena.inUse && !arena.retired && !arena.quarantined
    )).length,
    usableArenaCount: () => arenas.filter((arena) => (
      !arena.retired && !arena.quarantined
    )).length,
    quarantinedArenaCount: () => arenas.filter((arena) => (
      !arena.retired && arena.quarantined
    )).length,
    retiredArenaCount: () => arenas.filter((arena) => arena.retired).length,
    destroy
  };
  return runtime;
}

export {
  schroederSpatialMechanicsFieldPairWgsl
};
