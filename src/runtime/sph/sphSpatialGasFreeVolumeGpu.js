import {
  SPH_SPATIAL_GAS_FREE_VOLUME_PARAMS_BYTES,
  SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS,
  SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE,
  ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EXECUTION_SCHEMA,
  ULG_SPH_SPATIAL_GAS_FREE_VOLUME_SOURCE_SCHEMA,
  createSphSpatialGasFreeVolumeLayout,
  createSphSpatialGasFreeVolumePlan
} from '../../../ulg-gpu-abi/src/sphSpatialGasFreeVolume.js';
import {
  createSphSpatialGasFreeVolumeWgsl
} from '../../../ulg-gpu-abi/src/sphSpatialGasFreeVolumeWgsl.js';
import {
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeMoment.js';
import {
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import {
  ownsSchroederSpatialEpochGenerationConsumerLease
} from './schroederSpatialEpochGpu.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};

export const ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EOS_RECEIPT_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-free-volume-eos-receipt.v1';
export const ULG_SPH_SPATIAL_GAS_FREE_VOLUME_TELEMETRY_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-free-volume-telemetry.v1';

const EOS_CONSUMER_PASSES = Object.freeze([
  'aggregate',
  'gradient',
  'finalize'
]);
const retainedGasFreeVolumeRuntimes = new WeakMap();
const retainedGasFreeVolumeExecutions = new WeakMap();
const retainedGasFreeVolumeEosReceipts = new WeakMap();

function gasFreeVolumeError(code, message, ErrorType = Error) {
  const error = new ErrorType(message);
  error.code = code;
  return error;
}

function exactRuntimeRecord(runtime) {
  const record = retainedGasFreeVolumeRuntimes.get(runtime);
  return record?.runtime === runtime ? record : null;
}

function exactExecutionRecord(execution) {
  const record = retainedGasFreeVolumeExecutions.get(execution);
  return record?.execution === execution ? record : null;
}

function authorityError(code, message, ErrorType = Error) {
  return gasFreeVolumeError(code, message, ErrorType);
}

function authorityInspectionError(code, message, cause = null) {
  const error = authorityError(code, message);
  if (cause != null) error.cause = cause;
  return error;
}

function ownAuthorityDataDescriptor(target, key, label, code) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(target, key);
  } catch (cause) {
    throw authorityInspectionError(code, `${label} could not be inspected`, cause);
  }
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
    throw authorityInspectionError(code, `${label} must be an own data property`);
  }
  return descriptor;
}

function snapshotAuthorityPublicEntries(publicEntries, device) {
  const code = 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_ENTRIES_INVALID';
  if (!Array.isArray(publicEntries)) {
    throw authorityInspectionError(code, 'publicEntries must be a dense Array');
  }
  const length = ownAuthorityDataDescriptor(
    publicEntries,
    'length',
    'publicEntries.length',
    code
  ).value;
  if (!Number.isSafeInteger(length) || length < 0 || length > 64) {
    throw authorityInspectionError(code, 'publicEntries length is invalid');
  }
  let arrayKeys;
  try {
    arrayKeys = Reflect.ownKeys(publicEntries);
  } catch (cause) {
    throw authorityInspectionError(
      code,
      'publicEntries keys could not be inspected',
      cause
    );
  }
  const allowedArrayKeys = new Set([
    'length',
    ...Array.from({ length }, (_, index) => String(index))
  ]);
  if (arrayKeys.some((key) => !allowedArrayKeys.has(key))) {
    throw authorityInspectionError(
      code,
      'publicEntries must not contain extra properties'
    );
  }
  const seenBindings = new Set();
  const snapshot = [];
  for (let index = 0; index < length; index += 1) {
    const entry = ownAuthorityDataDescriptor(
      publicEntries,
      String(index),
      `publicEntries[${index}]`,
      code
    ).value;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw authorityInspectionError(
        code,
        `publicEntries[${index}] must be an object`
      );
    }
    let entryKeys;
    try {
      entryKeys = Reflect.ownKeys(entry);
    } catch (cause) {
      throw authorityInspectionError(
        code,
        `publicEntries[${index}] keys could not be inspected`,
        cause
      );
    }
    if (
      entryKeys.length !== 2
      || !entryKeys.includes('binding')
      || !entryKeys.includes('resource')
    ) {
      throw authorityInspectionError(
        code,
        `publicEntries[${index}] must contain only binding and resource`
      );
    }
    const binding = ownAuthorityDataDescriptor(
      entry,
      'binding',
      `publicEntries[${index}].binding`,
      code
    ).value;
    if (!Number.isInteger(binding) || binding < 0 || binding > 0xffff_ffff) {
      throw authorityInspectionError(
        code,
        `publicEntries[${index}].binding must be a u32`
      );
    }
    if (binding === 5 || binding === 6) {
      throw authorityError(
        'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_RESERVED_BINDING',
        `Gas free-volume authority privately owns binding ${binding}`
      );
    }
    if (seenBindings.has(binding)) {
      throw authorityInspectionError(
        code,
        `publicEntries repeats binding ${binding}`
      );
    }
    seenBindings.add(binding);
    const resource = ownAuthorityDataDescriptor(
      entry,
      'resource',
      `publicEntries[${index}].resource`,
      code
    ).value;
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
      throw authorityInspectionError(
        code,
        `publicEntries[${index}].resource must be a buffer binding object`
      );
    }
    let resourceKeys;
    try {
      resourceKeys = Reflect.ownKeys(resource);
    } catch (cause) {
      throw authorityInspectionError(
        code,
        `publicEntries[${index}].resource keys could not be inspected`,
        cause
      );
    }
    if (
      !resourceKeys.includes('buffer')
      || resourceKeys.some((key) => (
        key !== 'buffer' && key !== 'offset' && key !== 'size'
      ))
    ) {
      throw authorityInspectionError(
        code,
        `publicEntries[${index}].resource is not a canonical buffer binding`
      );
    }
    const buffer = ownAuthorityDataDescriptor(
      resource,
      'buffer',
      `publicEntries[${index}].resource.buffer`,
      code
    ).value;
    if (
      (!buffer || (typeof buffer !== 'object' && typeof buffer !== 'function'))
      || !webGpuBufferMatchesDevice(buffer, device)
    ) {
      throw authorityInspectionError(
        code,
        `publicEntries[${index}].resource.buffer is not a same-device buffer`
      );
    }
    const resourceSnapshot = { buffer };
    if (resourceKeys.includes('offset')) {
      const offset = ownAuthorityDataDescriptor(
        resource,
        'offset',
        `publicEntries[${index}].resource.offset`,
        code
      ).value;
      if (!Number.isSafeInteger(offset) || offset < 0) {
        throw authorityInspectionError(
          code,
          `publicEntries[${index}].resource.offset must be a non-negative safe integer`
        );
      }
      resourceSnapshot.offset = offset;
    }
    if (resourceKeys.includes('size')) {
      const size = ownAuthorityDataDescriptor(
        resource,
        'size',
        `publicEntries[${index}].resource.size`,
        code
      ).value;
      if (!Number.isSafeInteger(size) || size < 1) {
        throw authorityInspectionError(
          code,
          `publicEntries[${index}].resource.size must be a positive safe integer`
        );
      }
      resourceSnapshot.size = size;
    }
    snapshot.push(Object.freeze({
      binding,
      resource: Object.freeze(resourceSnapshot)
    }));
  }
  return Object.freeze(snapshot);
}

function positiveInteger(value, label, max = 0xffff_ffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function assertDevice(device) {
  if (
    !device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer
  ) {
    throw new TypeError('gas free-volume runtime requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (
    !encoder?.clearBuffer
    || !encoder?.beginComputePass
  ) {
    throw new TypeError(
      'gas free-volume encode requires a caller-owned GPUCommandEncoder-like object'
    );
  }
}

function createOwnedBuffer(device, ownedBuffers, label, size, usage) {
  const buffer = device.createBuffer({ label, size, usage });
  // Track the raw allocation before provenance tagging. Although the normal
  // tagger is deliberately tolerant of non-extensible host objects, keeping
  // this ordering makes a hostile host object unable to strand an allocation
  // if any bookkeeping performed after createBuffer throws.
  ownedBuffers.push(buffer);
  return tagWebGpuBufferDevice(buffer, device);
}

function destroyOwnedBuffersExactlyOnce(buffers, destroyed = new Set()) {
  for (const buffer of buffers) {
    if (buffer == null || destroyed.has(buffer)) continue;
    // Record the retirement before invoking host code. A throwing destroy
    // hook must not make a later cleanup path invoke the same allocation a
    // second time.
    destroyed.add(buffer);
    try {
      buffer.destroy?.();
    } catch {
      // Cleanup is best-effort at the WebGPU host boundary. Preserve the
      // originating construction/encoding failure and never double-retire.
    }
  }
  return destroyed;
}

function bufferSizeAtLeast(buffer, required, label) {
  const size = Number(buffer?.size);
  if (Number.isFinite(size) && size < required) {
    throw new RangeError(`${label} has ${size} bytes; ${required} required`);
  }
}

function workgroupDispatch(itemCapacity, workgroupSize, maxDimension, label) {
  if (itemCapacity === 0) {
    return Object.freeze({ x: 0, y: 0, z: 1, workgroupCount: 0 });
  }
  const workgroupCount = Math.ceil(itemCapacity / workgroupSize);
  const x = Math.min(workgroupCount, maxDimension);
  const y = Math.ceil(workgroupCount / x);
  if (y > maxDimension) {
    throw new RangeError(
      `${label} exceeds two-dimensional WebGPU dispatch limits`
    );
  }
  return Object.freeze({ x, y, z: 1, workgroupCount });
}

function sameGrid(left, right) {
  return left?.gridNodeCount === right?.gridNodeCount
    && left?.gridShift === right?.gridShift
    && left?.gridSpacingM === right?.gridSpacingM
    && Array.isArray(left?.gridDims)
    && Array.isArray(right?.gridDims)
    && left.gridDims.length === 3
    && right.gridDims.length === 3
    && left.gridDims.every((value, axis) => value === right.gridDims[axis]);
}

function exactMoment(moment, device) {
  let owned = false;
  try {
    owned = moment?.ownerRuntime?.ownsExecution?.(moment) === true;
  } catch {
    owned = false;
  }
  return Boolean(
    moment?.schema === ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_SCHEMA
    && moment.status
      === 'schroeder-spatial-phase-volume-moment-gpu-build-submitted'
    && moment.submitPerformed === true
    && moment.released !== true
    && moment.releaseScheduled !== true
    && owned
    && moment.controlBuffer
    && moment.momentBuffer
    && moment.mechanicsFieldView
    && webGpuBufferMatchesDevice(moment.controlBuffer, device)
    && webGpuBufferMatchesDevice(moment.momentBuffer, device)
  );
}

function exactParent(parent, device) {
  let owned = false;
  try {
    owned = parent?.ownerRuntime?.ownsExecution?.(parent) === true;
  } catch {
    owned = false;
  }
  return Boolean(
    parent?.schema === ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA
    && parent.status
      === 'schroeder-spatial-parent-field-view-gpu-build-submitted'
    && parent.submitPerformed === true
    && parent.released !== true
    && owned
    && parent.parentFieldViewBuffer
    && webGpuBufferMatchesDevice(parent.parentFieldViewBuffer, device)
  );
}

function normalizeGenerationReadFamily(generationReadFamily, device, {
  fineFieldCapacity,
  coarseFieldCapacity
}) {
  const generation = generationReadFamily?.generation;
  if (
    !generation
    || !ownsSchroederSpatialEpochGenerationConsumerLease(
      generationReadFamily,
      generation
    )
    || generationReadFamily.released === true
    || generation.ready !== true
    || generation.selected !== true
  ) {
    throw new TypeError(
      'gas free-volume requires one exact active spatial-generation consumer lease'
    );
  }
  const levelViews = Array.isArray(generation.mechanicsLevelViews)
    ? generation.mechanicsLevelViews
    : [{
        selectedLevel: generation.phaseVolumeMoment?.selectedLevel,
        mechanicsGrid: generation.phaseVolumeMoment?.mechanicsFieldView
          ? {
              gridNodeCount:
                generation.phaseVolumeMoment.mechanicsFieldView.gridNodeCount,
              gridDims: generation.phaseVolumeMoment.mechanicsFieldView.gridDims,
              gridShift: generation.phaseVolumeMoment.mechanicsFieldView.gridShift,
              gridSpacingM:
                generation.phaseVolumeMoment.mechanicsFieldView.gridSpacingM
            }
          : null,
        phaseVolumeMoment: generation.phaseVolumeMoment
      }];
  if (levelViews.length < 1 || levelViews.length > 2) {
    throw new RangeError(
      'gas free-volume requires exactly one or two mechanics levels'
    );
  }
  const moments = levelViews.map((entry) => entry.phaseVolumeMoment);
  if (moments.some((moment) => !exactMoment(moment, device))) {
    throw new TypeError(
      'gas free-volume requires live submitted phase-volume moments'
    );
  }
  if (
    moments[0].fieldCapacity !== fineFieldCapacity
    || (
      moments.length === 2
      && moments[1].fieldCapacity !== coarseFieldCapacity
    )
  ) {
    throw new RangeError(
      'gas free-volume moment capacities do not match the retained runtime tier'
    );
  }
  const identityFields = [
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
  ];
  if (
    moments.some((moment) => (
      identityFields.some((field) => moment[field] !== moments[0][field])
    ))
  ) {
    throw new TypeError('gas free-volume moments have torn generation identity');
  }
  const grids = levelViews.map((entry, index) => {
    const field = moments[index].mechanicsFieldView;
    const grid = entry.mechanicsGrid ?? {
      gridNodeCount: field.gridNodeCount,
      gridDims: field.gridDims,
      gridShift: field.gridShift,
      gridSpacingM: field.gridSpacingM
    };
    if (
      !sameGrid(grid, {
        gridNodeCount: field.gridNodeCount,
        gridDims: field.gridDims,
        gridShift: field.gridShift,
        gridSpacingM: field.gridSpacingM
      })
      || moments[index].selectedLevel !== levelViews[index].selectedLevel
    ) {
      throw new TypeError(
        'gas free-volume moment lost its exact mechanics grid lineage'
      );
    }
    return grid;
  });
  const parent = generation.parentFieldView ?? null;
  if (moments.length === 2) {
    if (
      !exactParent(parent, device)
      || parent.fineFieldView !== moments[0].mechanicsFieldView
      || parent.coarseFieldView !== moments[1].mechanicsFieldView
      || parent.generationId !== moments[0].generationId
      || parent.storageGeneration !== moments[0].storageGeneration
      || !sameGrid(parent.fineGrid, grids[0])
      || !sameGrid(parent.coarseGrid, grids[1])
    ) {
      throw new TypeError(
        'gas free-volume requires the exact immutable two-level parent projection'
      );
    }
  } else if (parent != null) {
    throw new TypeError(
      'single-level gas free-volume forbids a parent-field projection'
    );
  }
  return {
    generation,
    levelViews,
    moments,
    grids,
    parent,
    identity: Object.fromEntries(
      identityFields.map((field) => [field, moments[0][field]])
    )
  };
}

function normalizeGasDirectory(gasDirectory, device, cellCapacity, identity) {
  const execution = gasDirectory?.execution ?? gasDirectory;
  if (
    execution?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
    || execution.abiVersion !== 1
    || execution.submitPerformed !== true
    || execution.released === true
    || execution.directoryBuffer == null
    || execution.consumerDispatchBuffer == null
    || execution.cellCapacity !== cellCapacity
    || execution.storageGeneration !== identity.storageGeneration
    || execution.physicsTick !== identity.physicsTick
    || execution.physicsSubstep !== identity.physicsSubstep
    || execution.positionEpoch !== identity.positionEpoch
    || execution.topologyEpoch !== identity.topologyEpoch
    || execution.chartEpoch !== identity.chartEpoch
    || execution.levelEpoch !== identity.levelEpoch
    || execution.supportEpoch !== identity.supportEpoch
    || !webGpuBufferMatchesDevice(execution.directoryBuffer, device)
    || !webGpuBufferMatchesDevice(execution.consumerDispatchBuffer, device)
  ) {
    throw new TypeError(
      'gas free-volume requires an exact same-epoch submitted gas directory-v1'
    );
  }
  bufferSizeAtLeast(
    execution.directoryBuffer,
    execution.layout?.byteLength ?? 48 * UINT32_BYTES,
    'gas free-volume directory'
  );
  bufferSizeAtLeast(
    execution.consumerDispatchBuffer,
    3 * UINT32_BYTES,
    'gas free-volume consumer dispatch'
  );
  if (
    Number.isFinite(Number(execution.consumerDispatchBuffer.usage))
    && (
      Number(execution.consumerDispatchBuffer.usage)
      & GPU_BUFFER_USAGE.INDIRECT
    ) === 0
  ) {
    throw new TypeError(
      'gas free-volume consumer dispatch buffer lacks INDIRECT usage'
    );
  }
  return execution;
}

function paramsData(
  plan,
  identity,
  fineGrid,
  coarseGrid,
  directory,
  moments,
  fineScatterDispatch,
  coarseScatterDispatch,
  keyedLookupMaxSteps
) {
  const data = new ArrayBuffer(SPH_SPATIAL_GAS_FREE_VOLUME_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (word, value) => view.setUint32(
    word * UINT32_BYTES,
    Number(value) >>> 0,
    true
  );
  const i32 = (word, value) => view.setInt32(
    word * UINT32_BYTES,
    Number(value),
    true
  );
  const f32 = (word, value) => view.setFloat32(
    word * UINT32_BYTES,
    Number(value),
    true
  );
  u32(0, plan.cellCapacity);
  u32(1, plan.fineFieldCapacity);
  u32(2, plan.coarseFieldCapacity);
  u32(3, plan.exactLevelCount);
  u32(4, plan.gasFreeVolumeGeneration);
  u32(5, plan.sourceGeneration);
  u32(6, plan.directoryGeneration);
  u32(7, plan.storageGeneration);
  u32(8, plan.grid.chartId);
  i32(9, plan.grid.selectedLevel);
  u32(10, plan.grid.gridDims[0]);
  u32(11, plan.grid.gridDims[1]);
  u32(12, plan.grid.gridDims[2]);
  i32(13, plan.grid.gridShift);
  f32(14, plan.grid.gridSpacingM);
  f32(15, plan.overfillToleranceRelative);
  f32(16, plan.overfillToleranceAbsoluteM3);
  plan.boxMinM.forEach((value, axis) => f32(17 + axis, value));
  plan.boxMaxM.forEach((value, axis) => f32(20 + axis, value));
  u32(23, plan.fineMomentGeneration);
  u32(24, plan.coarseMomentGeneration);
  u32(25, plan.parentCompletionOrdinal);
  u32(26, directory.layout.wordLength);
  u32(27, directory.layout.cellKeysOffsetWords);
  u32(28, moments[0].fieldCapacity);
  u32(29, moments[1]?.fieldCapacity ?? 0);
  u32(
    30,
    plan.exactLevelCount === 2 ? plan.parentCapacityWords : 48
  );
  u32(31, fineGrid.gridNodeCount);
  f32(32, fineGrid.gridSpacingM);
  u32(33, coarseGrid?.gridNodeCount ?? fineGrid.gridNodeCount);
  f32(34, coarseGrid?.gridSpacingM ?? fineGrid.gridSpacingM);
  [
    identity.deviceOrdinal,
    identity.laneOrdinal,
    identity.leaseToken,
    identity.sourceFamilyId,
    identity.physicsTick,
    identity.physicsSubstep,
    identity.positionEpoch,
    identity.topologyEpoch,
    identity.chartEpoch,
    identity.levelEpoch,
    identity.supportEpoch,
    moments[0].completionOrdinal,
    moments[1]?.completionOrdinal ?? 0
  ].forEach((value, index) => u32(35 + index, value));
  u32(48, fineScatterDispatch.x);
  u32(49, fineScatterDispatch.y);
  u32(50, coarseScatterDispatch.x);
  u32(51, coarseScatterDispatch.y);
  u32(52, keyedLookupMaxSteps);
  return data;
}

export function createSphSpatialGasFreeVolumeGpu(device, {
  cellCapacity,
  fineFieldCapacity,
  coarseFieldCapacity = 0,
  arenaCount = 2,
  label = 'ulg-sph-spatial-gas-free-volume'
} = {}) {
  assertDevice(device);
  const capacity = positiveInteger(cellCapacity, 'cellCapacity');
  const fineCapacity = positiveInteger(fineFieldCapacity, 'fineFieldCapacity');
  const coarseCapacity = Number(coarseFieldCapacity) === 0
    ? 0
    : positiveInteger(coarseFieldCapacity, 'coarseFieldCapacity');
  const count = positiveInteger(arenaCount, 'arenaCount', 8);
  const layout = createSphSpatialGasFreeVolumeLayout({
    cellCapacity: capacity
  });
  const maxStorageBindings = positiveInteger(
    device.limits?.maxStorageBuffersPerShaderStage ?? 8,
    'device.limits.maxStorageBuffersPerShaderStage'
  );
  if (maxStorageBindings < 8) {
    throw new RangeError('gas free-volume requires eight storage bindings');
  }
  const maxWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65_535,
    'device.limits.maxComputeWorkgroupsPerDimension'
  );
  const fineScatterDispatch = workgroupDispatch(
    fineCapacity,
    SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE,
    maxWorkgroupsPerDimension,
    'gas free-volume fine scatter'
  );
  const coarseScatterDispatch = workgroupDispatch(
    coarseCapacity,
    SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE,
    maxWorkgroupsPerDimension,
    'gas free-volume coarse scatter'
  );
  const keyedLookupMaxSteps = Math.ceil(Math.log2(capacity + 1)) + 1;
  const maxBufferSize = positiveInteger(
    device.limits?.maxBufferSize ?? 256 * 1024 * 1024,
    'device.limits.maxBufferSize',
    Number.MAX_SAFE_INTEGER
  );
  const maxStorageBinding = positiveInteger(
    device.limits?.maxStorageBufferBindingSize ?? maxBufferSize,
    'device.limits.maxStorageBufferBindingSize',
    Number.MAX_SAFE_INTEGER
  );
  if (
    layout.rowsByteLength > maxBufferSize
    || layout.rowsByteLength > maxStorageBinding
  ) {
    throw new RangeError('gas free-volume rows exceed WebGPU buffer limits');
  }
  const constructionBuffers = [];
  try {
  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: createSphSpatialGasFreeVolumeWgsl(layout)
  });
  const pipeline = (entryPoint) => device.createComputePipeline({
    label: `${label}-${entryPoint.replaceAll('_', '-')}-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  const pipelines = Object.freeze({
    validate: pipeline('validate_gas_free_volume_authority'),
    scatterFine: pipeline('scatter_fine_condensed_volume'),
    scatterCoarse: pipeline('scatter_coarse_condensed_volume'),
    build: pipeline('build_gas_free_volume'),
    finalize: pipeline('finalize_gas_free_volume')
  });
  const arenas = [];
  for (let arenaIndex = 0; arenaIndex < count; arenaIndex += 1) {
    arenas.push({
      arenaIndex,
      inUse: false,
      retired: false,
      token: null,
      destroyedOwnedBuffers: new Set(),
      paramsBuffer: createOwnedBuffer(
        device,
        constructionBuffers,
        `${label}-arena-${arenaIndex}-params`,
        SPH_SPATIAL_GAS_FREE_VOLUME_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      controlBuffer: createOwnedBuffer(
        device,
        constructionBuffers,
        `${label}-arena-${arenaIndex}-control`,
        layout.controlByteLength,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      rowsBuffer: createOwnedBuffer(
        device,
        constructionBuffers,
        `${label}-arena-${arenaIndex}-rows`,
        layout.rowsByteLength,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      )
    });
  }
  const deviceId = webGpuDeviceId(device);
  let serial = 0;
  let destroyed = false;
  let runtimeToken = null;
  const ownership = new WeakMap();
  const submitted = new WeakSet();
  const released = new WeakSet();
  const pendingReleases = new WeakMap();

  const ownBuffers = (arena) => [
    arena.paramsBuffer,
    arena.controlBuffer,
    arena.rowsBuffer
  ];
  const destroyArenaBuffers = (arena) => destroyOwnedBuffersExactlyOnce(
    ownBuffers(arena),
    arena.destroyedOwnedBuffers
  );

  function acquireArena() {
    if (destroyed) {
      throw gasFreeVolumeError(
        'ERR_SPH_GAS_FREE_VOLUME_RUNTIME_DESTROYED',
        'gas free-volume runtime is destroyed'
      );
    }
    const arena = arenas.find((entry) => !entry.inUse && !entry.retired);
    if (!arena) {
      throw gasFreeVolumeError(
        'ERR_SPH_GAS_FREE_VOLUME_ARENA_EXHAUSTED',
        'gas free-volume arenas are under backpressure'
      );
    }
    const token = Object.freeze({
      serial: ++serial,
      arenaIndex: arena.arenaIndex
    });
    arena.inUse = true;
    arena.token = token;
    return { arena, token };
  }

  function ownershipFor(execution) {
    const record = ownership.get(execution);
    if (
      !record
      || record.execution !== execution
      || record.runtime !== runtimeToken
      || retainedGasFreeVolumeExecutions.get(execution) !== record
      || released.has(execution)
      || record.arena.inUse !== true
      || record.arena.token !== record.token
    ) {
      throw gasFreeVolumeError(
        'ERR_SPH_GAS_FREE_VOLUME_FOREIGN_EXECUTION',
        'gas free-volume execution is not owned by this runtime'
      );
    }
    return record;
  }

  function ownsExecution(execution) {
    try {
      ownershipFor(execution);
      return true;
    } catch {
      return false;
    }
  }

  function recordStillOwnsExecution(execution, record, token = record?.token) {
    return Boolean(
      record
      && record.execution === execution
      && record.runtime === runtimeToken
      && retainedGasFreeVolumeExecutions.get(execution) === record
      && ownership.get(execution) === record
      && !released.has(execution)
      && record.token === token
      && record.arena.inUse === true
      && record.arena.token === token
    );
  }

  function exactThenablePromise(value, label) {
    let then;
    try {
      then = value?.then;
    } catch (error) {
      throw error;
    }
    if (typeof then !== 'function') {
      throw new TypeError(`${label} requires a thenable`);
    }
    return new Promise((resolve, reject) => {
      try {
        Reflect.apply(then, value, [resolve, reject]);
      } catch (error) {
        reject(error);
      }
    });
  }

  function encode(encoder, {
    gasDirectory,
    generationReadFamily,
    grid,
    boxMinM,
    boxMaxM,
    chartId = 0,
    overfillToleranceRelative = 1e-5,
    overfillToleranceAbsoluteM3 = 1e-12
  } = {}) {
    assertEncoder(encoder);
    const readFamily = normalizeGenerationReadFamily(
      generationReadFamily,
      device,
      {
        fineFieldCapacity: fineCapacity,
        coarseFieldCapacity: coarseCapacity
      }
    );
    const directory = normalizeGasDirectory(
      gasDirectory,
      device,
      capacity,
      readFamily.identity
    );
    const exactLevelCount = readFamily.moments.length;
    const selectedGrid = readFamily.grids.at(-1);
    const resolvedGrid = {
      ...grid,
      chartId,
      selectedLevel: readFamily.levelViews.at(-1).selectedLevel
    };
    if (!sameGrid(resolvedGrid, selectedGrid)) {
      throw new TypeError(
        'gas free-volume grid must be the exact selected occupancy grid'
      );
    }
    if (
      exactLevelCount === 2
      && (
        readFamily.levelViews[1].selectedLevel
          !== readFamily.levelViews[0].selectedLevel + 1
        || readFamily.grids[1].gridSpacingM
          !== Math.fround(readFamily.grids[0].gridSpacingM * 2)
      )
    ) {
      throw new RangeError(
        'gas free-volume two-level grid requires adjacent exact 2:1 levels'
      );
    }
    if (exactLevelCount === 2 && coarseCapacity < 1) {
      throw new RangeError(
        'gas free-volume runtime lacks the retained coarse field tier'
      );
    }
    const parentCapacityWords =
      readFamily.parent?.layout?.wordLength ?? 0;
    const plan = createSphSpatialGasFreeVolumePlan({
      cellCapacity: capacity,
      fineFieldCapacity: fineCapacity,
      coarseFieldCapacity: exactLevelCount === 2 ? coarseCapacity : 0,
      exactLevelCount,
      grid: resolvedGrid,
      boxMinM,
      boxMaxM,
      gasFreeVolumeGeneration: serial + 1,
      sourceGeneration: readFamily.identity.generationId,
      directoryGeneration: directory.generationId,
      storageGeneration: readFamily.identity.storageGeneration,
      fineMomentGeneration: readFamily.moments[0].generationId,
      coarseMomentGeneration:
        readFamily.moments[1]?.generationId ?? 0,
      parentCompletionOrdinal:
        readFamily.parent?.completionOrdinal ?? 0,
      parentCapacityWords,
      overfillToleranceRelative,
      overfillToleranceAbsoluteM3
    });
    const { arena, token } = acquireArena();
    let encoderMutationStarted = false;
    try {
      const fine = readFamily.moments[0];
      const coarse = readFamily.moments[1] ?? fine;
      const parentBuffer = readFamily.parent?.parentFieldViewBuffer
        ?? directory.directoryBuffer;
      bufferSizeAtLeast(
        fine.controlBuffer,
        64 * UINT32_BYTES,
        'fine gas free-volume moment control'
      );
      bufferSizeAtLeast(
        fine.momentBuffer,
        fine.layout.momentByteLength,
        'fine gas free-volume moment rows'
      );
      if (exactLevelCount === 2) {
        bufferSizeAtLeast(
          coarse.controlBuffer,
          64 * UINT32_BYTES,
          'coarse gas free-volume moment control'
        );
        bufferSizeAtLeast(
          coarse.momentBuffer,
          coarse.layout.momentByteLength,
          'coarse gas free-volume moment rows'
        );
        bufferSizeAtLeast(
          parentBuffer,
          parentCapacityWords * UINT32_BYTES,
          'gas free-volume parent field view'
        );
      }
      device.queue.writeBuffer(
        arena.paramsBuffer,
        0,
        paramsData(
          plan,
          readFamily.identity,
          readFamily.grids[0],
          readFamily.grids[1],
          directory,
          readFamily.moments,
          fineScatterDispatch,
          coarseScatterDispatch,
          keyedLookupMaxSteps
        )
      );
      // A GPUCommandEncoder method is allowed to mutate its command stream
      // before throwing. From this point onward the arena cannot be proven
      // reusable on failure, so quarantine and retire it in the catch path.
      encoderMutationStarted = true;
      encoder.clearBuffer(arena.controlBuffer);
      encoder.clearBuffer(arena.rowsBuffer);
      const resources = new Map([
        [0, directory.directoryBuffer],
        [1, fine.controlBuffer],
        [2, fine.momentBuffer],
        [3, coarse.controlBuffer],
        [4, coarse.momentBuffer],
        [5, parentBuffer],
        [6, arena.controlBuffer],
        [7, arena.rowsBuffer]
      ]);
      const bindGroup = (
        pipelineObject,
        suffix,
        selectedResources = resources
      ) => device.createBindGroup({
        label: `${label}-arena-${arena.arenaIndex}-${suffix}-bindings`,
        layout: pipelineObject.getBindGroupLayout(0),
        entries: [
          ...Array.from(selectedResources, ([binding, buffer]) => ({
            binding,
            resource: { buffer }
          })),
          {
            binding: 8,
            resource: {
              buffer: arena.paramsBuffer,
              offset: 0,
              size: SPH_SPATIAL_GAS_FREE_VOLUME_PARAMS_BYTES
            }
          }
        ]
      });
      const validateGroup = bindGroup(
        pipelines.validate,
        'validate',
        new Map([
          [0, directory.directoryBuffer],
          [1, fine.controlBuffer],
          [3, coarse.controlBuffer],
          [5, parentBuffer],
          [6, arena.controlBuffer]
        ])
      );
      const validatePass = encoder.beginComputePass({
        label: `${label}ValidateAuthority`
      });
      validatePass.setPipeline(pipelines.validate);
      validatePass.setBindGroup(0, validateGroup);
      validatePass.dispatchWorkgroups(1, 1, 1);
      validatePass.end();
      const fineScatterGroup = bindGroup(
        pipelines.scatterFine,
        'scatter-fine',
        new Map([
          [0, directory.directoryBuffer],
          [1, fine.controlBuffer],
          [2, fine.momentBuffer],
          [5, parentBuffer],
          [6, arena.controlBuffer],
          [7, arena.rowsBuffer]
        ])
      );
      const fineScatterPass = encoder.beginComputePass({
        label: `${label}ScatterFine`
      });
      fineScatterPass.setPipeline(pipelines.scatterFine);
      fineScatterPass.setBindGroup(0, fineScatterGroup);
      fineScatterPass.dispatchWorkgroups(
        fineScatterDispatch.x,
        fineScatterDispatch.y,
        fineScatterDispatch.z
      );
      fineScatterPass.end();
      if (exactLevelCount === 2) {
        const coarseScatterGroup = bindGroup(
          pipelines.scatterCoarse,
          'scatter-coarse',
          new Map([
            [0, directory.directoryBuffer],
            [3, coarse.controlBuffer],
            [4, coarse.momentBuffer],
            [5, parentBuffer],
            [6, arena.controlBuffer],
            [7, arena.rowsBuffer]
          ])
        );
        const coarseScatterPass = encoder.beginComputePass({
          label: `${label}ScatterCoarse`
        });
        coarseScatterPass.setPipeline(pipelines.scatterCoarse);
        coarseScatterPass.setBindGroup(0, coarseScatterGroup);
        coarseScatterPass.dispatchWorkgroups(
          coarseScatterDispatch.x,
          coarseScatterDispatch.y,
          coarseScatterDispatch.z
        );
        coarseScatterPass.end();
      }
      const buildGroup = bindGroup(
        pipelines.build,
        'build',
        new Map([
          [0, directory.directoryBuffer],
          [6, arena.controlBuffer],
          [7, arena.rowsBuffer]
        ])
      );
      const buildPass = encoder.beginComputePass({
        label: `${label}Build`
      });
      buildPass.setPipeline(pipelines.build);
      buildPass.setBindGroup(0, buildGroup);
      buildPass.dispatchWorkgroupsIndirect(
        directory.consumerDispatchBuffer,
        0
      );
      buildPass.end();
      const finalizeGroup = bindGroup(
        pipelines.finalize,
        'finalize',
        new Map([
          [0, directory.directoryBuffer],
          [6, arena.controlBuffer]
        ])
      );
      const finalizePass = encoder.beginComputePass({
        label: `${label}Finalize`
      });
      finalizePass.setPipeline(pipelines.finalize);
      finalizePass.setBindGroup(0, finalizeGroup);
      finalizePass.dispatchWorkgroups(1, 1, 1);
      finalizePass.end();
      const execution = Object.freeze({
        schema: ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EXECUTION_SCHEMA,
        status: 'sph-spatial-gas-free-volume-gpu-encoded',
        ready: true,
        deviceId,
        arenaIndex: arena.arenaIndex,
        arenaGeneration: token.serial,
        gasFreeVolumeSchema: ULG_SPH_SPATIAL_GAS_FREE_VOLUME_SOURCE_SCHEMA,
        gasFreeVolumeGeneration: plan.gasFreeVolumeGeneration,
        sourceGeneration: plan.sourceGeneration,
        directoryGeneration: plan.directoryGeneration,
        storageGeneration: plan.storageGeneration,
        gasFreeVolumeCellCapacity: capacity,
        gasFreeVolumeRowStrideFloats:
          SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS,
        exactLevelCount,
        reductionVersion: 2,
        reductionAlgorithm:
          'directory-keyed-binary-lookup-atomic-f32-scatter',
        reductionWorkComplexity: 'O(C + (F + E + K) log C)',
        keyedLookupMaxSteps,
        encodedComputePassCount: exactLevelCount === 2 ? 5 : 4,
        encodedDispatchCount: exactLevelCount === 2 ? 5 : 4,
        indirectDispatchOffsetBytes: 0,
        retainedGpuBufferBytes: ownBuffers(arena).reduce(
          (sum, buffer) => sum + Number(buffer?.size ?? 0),
          0
        ),
        gpuBufferCreationCountDuringEncode: 0,
        bufferAllocationCountDuringEncode: 0,
        readbackPerformed: false,
        fullParticleReadbackPerformed: false,
        submissionOwnership: 'producer-issued-eos-authority-action'
      });
      const record = {
        execution,
        runtime: runtimeToken,
        device,
        deviceId,
        encoder,
        label,
        arena,
        token,
        generationReadFamily,
        gasDirectory,
        activeEosReceipt: null,
        consumerSubmitted: false,
        consumerDiscardRequired: false,
        consumerBindCount: 0,
        consumerSubmitCount: 0,
        consumerAbandonCount: 0,
        released: false,
        isLive: () => recordStillOwnsExecution(execution, record),
        markSubmitted: () => markExecutionSubmitted(execution)
      };
      ownership.set(execution, record);
      retainedGasFreeVolumeExecutions.set(execution, record);
      return execution;
    } catch (error) {
      if (encoderMutationStarted) {
        arena.retired = true;
        destroyArenaBuffers(arena);
      }
      arena.inUse = false;
      arena.token = null;
      throw error;
    }
  }

  function markExecutionSubmitted(execution) {
    ownershipFor(execution);
    if (submitted.has(execution)) return false;
    submitted.add(execution);
    return true;
  }

  function finishRelease(
    execution,
    record,
    { deviceLost = false, token = record?.token } = {}
  ) {
    // A fence callback is stale as soon as any other path releases this
    // execution or the arena is reissued under a new token. Never let such a
    // callback clear or destroy the successor's ownership state.
    if (!recordStillOwnsExecution(execution, record, token)) return false;
    pendingReleases.delete(execution);
    if (deviceLost) {
      record.arena.retired = true;
      destroyArenaBuffers(record.arena);
    }
    record.arena.inUse = false;
    record.arena.token = null;
    const activeReceiptRecord = retainedGasFreeVolumeEosReceipts.get(
      record.activeEosReceipt
    );
    if (activeReceiptRecord?.record === record) {
      activeReceiptRecord.state = 'terminal';
    }
    record.activeEosReceipt = null;
    record.released = true;
    released.add(execution);
    submitted.delete(execution);
    ownership.delete(execution);
    return true;
  }

  function releaseExecution(execution, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        'gas free-volume release requires { discardedEncoder: true }'
      );
    }
    const record = ownershipFor(execution);
    if (record.activeEosReceipt) {
      throw authorityError(
        'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_BORROWED',
        'gas free-volume execution has an outstanding EOS consumer receipt'
      );
    }
    if (submitted.has(execution)) {
      throw new Error(
        'submitted gas free-volume execution requires a queue fence'
      );
    }
    return finishRelease(execution, record);
  }

  function releaseExecutionAfter(execution, submissionFence) {
    const record = ownershipFor(execution);
    if (!submitted.has(execution)) {
      throw new Error(
        'unsubmitted gas free-volume execution requires discarded release'
      );
    }
    const active = pendingReleases.get(execution);
    if (active) {
      if (
        active.kind === 'submission-fence'
        && active.evidence === submissionFence
      ) {
        return active.promise;
      }
      throw gasFreeVolumeError(
        'ERR_SPH_GAS_FREE_VOLUME_RELEASE_ALREADY_PENDING',
        'gas free-volume execution already has a different pending release'
      );
    }
    const fencePromise = exactThenablePromise(
      submissionFence,
      'gas free-volume queue release'
    );
    const pending = {
      kind: 'submission-fence',
      evidence: submissionFence,
      record,
      token: record.token,
      promise: null
    };
    pending.promise = fencePromise.then(
      () => {
        if (pendingReleases.get(execution) !== pending) return false;
        pendingReleases.delete(execution);
        return finishRelease(execution, record, { token: pending.token });
      },
      (error) => {
        // Ordinary queue-fence rejection is not retirement evidence. Clear
        // only this exact attempt so the still-owned execution can retry with
        // a fresh fence.
        if (pendingReleases.get(execution) === pending) {
          pendingReleases.delete(execution);
        }
        throw error;
      }
    );
    pendingReleases.set(execution, pending);
    return pending.promise;
  }

  function queueOrderedReleaseContext(execution) {
    const record = ownershipFor(execution);
    if (
      !recordStillOwnsExecution(execution, record)
      || record.activeEosReceipt
      || pendingReleases.has(execution)
      || !submitted.has(execution)
      || record.consumerSubmitted !== true
      || record.released
    ) {
      throw authorityError(
        'ERR_SPH_GAS_FREE_VOLUME_QUEUE_ORDERED_RELEASE_STALE',
        'queue-ordered gas free-volume release requires one exact submitted idle execution'
      );
    }
    return record;
  }

  function canReleaseExecutionQueueOrdered(execution) {
    try {
      queueOrderedReleaseContext(execution);
      return true;
    } catch {
      return false;
    }
  }

  function releaseExecutionQueueOrdered(execution) {
    const record = queueOrderedReleaseContext(execution);
    return finishRelease(execution, record);
  }

  function releaseExecutionAfterDeviceLoss(execution, deviceLossEvidence) {
    if (deviceLossEvidence !== device.lost) {
      throw new TypeError(
        'gas free-volume device-loss release requires the exact GPUDevice.lost promise'
      );
    }
    const record = ownershipFor(execution);
    const active = pendingReleases.get(execution);
    if (
      active?.kind === 'device-loss'
      && active.evidence === deviceLossEvidence
    ) {
      return active.promise;
    }
    const lossPromise = exactThenablePromise(
      deviceLossEvidence,
      'gas free-volume device-loss release'
    );
    const pending = {
      kind: 'device-loss',
      evidence: deviceLossEvidence,
      record,
      token: record.token,
      promise: null
    };
    const settleDeviceLoss = () => {
      if (pendingReleases.get(execution) !== pending) return false;
      pendingReleases.delete(execution);
      return finishRelease(execution, record, {
        deviceLost: true,
        token: pending.token
      });
    };
    pending.promise = lossPromise.then(
      settleDeviceLoss,
      settleDeviceLoss
    );
    // Exact device-loss evidence supersedes an ordinary fence: loss is
    // terminal, while the older callback becomes harmless through pending
    // identity and arena-token revalidation.
    pendingReleases.set(execution, pending);
    return pending.promise;
  }

  function activeExecutionCount() {
    return arenas.reduce((sum, arena) => sum + (arena.inUse ? 1 : 0), 0);
  }

  function destroy() {
    if (destroyed) return false;
    if (activeExecutionCount() > 0) {
      throw new Error(
        'gas free-volume runtime still has active executions'
      );
    }
    destroyed = true;
    for (const arena of arenas) {
      destroyArenaBuffers(arena);
    }
    return true;
  }

  const retainedGpuBufferBytes = arenas.reduce(
    (sum, arena) => sum + ownBuffers(arena).reduce(
      (arenaSum, buffer) => arenaSum + Number(buffer?.size ?? 0),
      0
    ),
    0
  );
  runtimeToken = Object.freeze({
    schema: ULG_SPH_SPATIAL_GAS_FREE_VOLUME_SOURCE_SCHEMA,
    status: 'sph-spatial-gas-free-volume-gpu-runtime-ready',
    deviceId,
    cellCapacity: capacity,
    fineFieldCapacity: fineCapacity,
    coarseFieldCapacity: coarseCapacity,
    arenaCount: count,
    pipelineCount: Object.keys(pipelines).length,
    reductionVersion: 2,
    reductionAlgorithm:
      'directory-keyed-binary-lookup-atomic-f32-scatter',
    reductionWorkComplexity: 'O(C + (F + E + K) log C)',
    keyedLookupMaxSteps,
    retainedGpuBufferCount: count * 3,
    retainedGpuBufferBytes
  });
  retainedGasFreeVolumeRuntimes.set(runtimeToken, {
    runtime: runtimeToken,
    device,
    deviceId,
    encode,
    ownsExecution,
    isExecutionSubmitted: (execution) => (
      submitted.has(execution) && ownsExecution(execution)
    ),
    releaseExecution,
    releaseExecutionAfter,
    releaseExecutionAfterDeviceLoss,
    canReleaseExecutionQueueOrdered,
    releaseExecutionQueueOrdered,
    activeExecutionCount,
    destroy
  });
  return runtimeToken;
  } catch (error) {
    destroyOwnedBuffersExactlyOnce(constructionBuffers);
    throw error;
  }
}

function requiredRuntimeRecord(runtime) {
  const record = exactRuntimeRecord(runtime);
  if (!record) {
    throw gasFreeVolumeError(
      'ERR_SPH_GAS_FREE_VOLUME_FOREIGN_RUNTIME',
      'gas free-volume operation requires the exact producer-issued runtime'
    );
  }
  return record;
}

/** Encode into the caller-owned command encoder using an exact runtime token. */
export function encodeSphSpatialGasFreeVolumeGpu(runtime, encoder, inputs) {
  return requiredRuntimeRecord(runtime).encode(encoder, inputs);
}

export function ownsSphSpatialGasFreeVolumeExecution(runtime, execution) {
  const record = exactRuntimeRecord(runtime);
  return record?.ownsExecution(execution) === true;
}

export function isSphSpatialGasFreeVolumeExecutionSubmitted(
  runtime,
  execution
) {
  const record = exactRuntimeRecord(runtime);
  return record?.isExecutionSubmitted(execution) === true;
}

export function activeSphSpatialGasFreeVolumeExecutionCount(runtime) {
  return requiredRuntimeRecord(runtime).activeExecutionCount();
}

export function releaseSphSpatialGasFreeVolumeExecution(
  runtime,
  execution,
  options
) {
  return requiredRuntimeRecord(runtime).releaseExecution(execution, options);
}

export function releaseSphSpatialGasFreeVolumeExecutionAfter(
  runtime,
  execution,
  submissionFence
) {
  return requiredRuntimeRecord(runtime).releaseExecutionAfter(
    execution,
    submissionFence
  );
}

export function releaseSphSpatialGasFreeVolumeExecutionAfterDeviceLoss(
  runtime,
  execution,
  deviceLossEvidence
) {
  return requiredRuntimeRecord(runtime).releaseExecutionAfterDeviceLoss(
    execution,
    deviceLossEvidence
  );
}

export function canReleaseSphSpatialGasFreeVolumeExecutionQueueOrdered(
  runtime,
  execution
) {
  const record = exactRuntimeRecord(runtime);
  return record?.canReleaseExecutionQueueOrdered(execution) === true;
}

export function releaseSphSpatialGasFreeVolumeExecutionQueueOrdered(
  runtime,
  execution
) {
  return requiredRuntimeRecord(runtime).releaseExecutionQueueOrdered(execution);
}

export function destroySphSpatialGasFreeVolumeGpu(runtime) {
  const record = exactRuntimeRecord(runtime);
  return record ? record.destroy() : false;
}

export function isExactSphSpatialGasFreeVolumeExecution(execution) {
  return exactExecutionRecord(execution) !== null;
}

export function describeSphSpatialGasFreeVolumeExecution(
  execution,
  options = {}
) {
  const record = exactExecutionRecord(execution);
  if (!record) return null;
  const exactDevice = options?.device === record.device;
  const live = record.isLive();
  const observation = {
    schema: ULG_SPH_SPATIAL_GAS_FREE_VOLUME_TELEMETRY_SCHEMA,
    status: 'sph-spatial-gas-free-volume-telemetry-only',
    telemetryOnly: true,
    bindable: false,
    exactExecutionObserved: true,
    deviceAuthenticated: exactDevice,
    liveObserved: live,
    submittedObserved: record.consumerSubmitted,
    consumerBorrowedObserved: Boolean(record.activeEosReceipt),
    discardRequiredObserved: record.consumerDiscardRequired,
    releasedObserved: record.released
  };
  if (exactDevice) {
    Object.assign(observation, {
      deviceId: record.deviceId,
      arenaIndex: execution.arenaIndex,
      arenaGeneration: execution.arenaGeneration,
      gasFreeVolumeGeneration: execution.gasFreeVolumeGeneration,
      sourceGeneration: execution.sourceGeneration,
      directoryGeneration: execution.directoryGeneration,
      storageGeneration: execution.storageGeneration,
      gasFreeVolumeCellCapacity: execution.gasFreeVolumeCellCapacity,
      gasFreeVolumeRowStrideFloats:
        execution.gasFreeVolumeRowStrideFloats
    });
  }
  return Object.freeze(observation);
}

function liveAuthorityExecutionRecord(execution) {
  const record = exactExecutionRecord(execution);
  if (!record) {
    throw authorityError(
      'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_UNBRANDED',
      'Gas free-volume EOS encoding requires the exact producer-issued execution'
    );
  }
  if (record.released || !record.isLive()) {
    throw authorityError(
      'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_TERMINAL',
      'Gas free-volume execution is released or no longer owns its arena'
    );
  }
  if (record.consumerSubmitted) {
    throw authorityError(
      'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_CONSUMED',
      'Gas free-volume execution was already submitted by its EOS consumer'
    );
  }
  if (record.consumerDiscardRequired) {
    throw authorityError(
      'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_DISCARD_REQUIRED',
      'Gas free-volume execution must be discarded after its abandoned encoder mutation'
    );
  }
  return record;
}

function reserveEosReceipt(record) {
  const receipt = Object.freeze({
    schema: ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EOS_RECEIPT_SCHEMA,
    status: 'sph-spatial-gas-free-volume-eos-consumer-borrowed',
    deviceId: record.deviceId,
    gasFreeVolumeGeneration: record.execution.gasFreeVolumeGeneration,
    sourceGeneration: record.execution.sourceGeneration,
    directoryGeneration: record.execution.directoryGeneration,
    storageGeneration: record.execution.storageGeneration,
    expectedPassCount: EOS_CONSUMER_PASSES.length
  });
  const action = Object.freeze({
    schema: ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EOS_RECEIPT_SCHEMA,
    status: 'sph-spatial-gas-free-volume-eos-authority-encoded',
    receipt,
    gasFreeVolumeGeneration: record.execution.gasFreeVolumeGeneration,
    sourceGeneration: record.execution.sourceGeneration,
    directoryGeneration: record.execution.directoryGeneration,
    storageGeneration: record.execution.storageGeneration,
    gasFreeVolumeCellCapacity:
      record.execution.gasFreeVolumeCellCapacity,
    gasFreeVolumeRowStrideFloats:
      record.execution.gasFreeVolumeRowStrideFloats
  });
  const receiptRecord = {
    receipt,
    action,
    record,
    execution: record.execution,
    state: 'borrowed',
    nextPassIndex: 0,
    encoderMutationStarted: false
  };
  retainedGasFreeVolumeEosReceipts.set(receipt, receiptRecord);
  record.activeEosReceipt = receipt;
  return receiptRecord;
}

/** Abandon only the exact active pre-submit receipt. */
export function abandonSphSpatialGasFreeVolumeEosAuthority(receipt) {
  const receiptRecord = retainedGasFreeVolumeEosReceipts.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || record.activeEosReceipt !== receipt
  ) {
    return false;
  }
  receiptRecord.state = 'abandoned';
  record.activeEosReceipt = null;
  record.consumerDiscardRequired ||= (
    receiptRecord.encoderMutationStarted
    || receiptRecord.nextPassIndex > 0
  );
  record.consumerAbandonCount += 1;
  return true;
}

/**
 * Install private free-volume bindings 5/6 for one declared EOS pass. The
 * first call reserves before inspecting any caller-controlled descriptor; the
 * exact receipt must then advance through aggregate, gradient, and finalize.
 */
export function encodeSphSpatialGasFreeVolumeEosAuthority(
  execution,
  receipt,
  options
) {
  const record = liveAuthorityExecutionRecord(execution);
  let receiptRecord;
  if (receipt == null) {
    if (record.activeEosReceipt) {
      throw authorityError(
        'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_BORROWED',
        'Gas free-volume execution already has an outstanding EOS receipt'
      );
    }
    receiptRecord = reserveEosReceipt(record);
  } else {
    receiptRecord = retainedGasFreeVolumeEosReceipts.get(receipt);
    if (
      !receiptRecord
      || receiptRecord.receipt !== receipt
      || receiptRecord.execution !== execution
      || receiptRecord.record !== record
      || receiptRecord.state !== 'borrowed'
      || record.activeEosReceipt !== receipt
    ) {
      throw authorityError(
        'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_RECEIPT_INVALID',
        'Gas free-volume EOS encoding requires the exact active receipt'
      );
    }
  }

  try {
    const optionsCode = 'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_OPTIONS_INVALID';
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw authorityInspectionError(
        optionsCode,
        'Gas free-volume EOS options must be an object'
      );
    }
    let optionKeys;
    try {
      optionKeys = Reflect.ownKeys(options);
    } catch (cause) {
      throw authorityInspectionError(
        optionsCode,
        'Gas free-volume EOS options could not be inspected',
        cause
      );
    }
    const allowedKeys = new Set([
      'device',
      'encoder',
      'pass',
      'passEncoder',
      'bindGroupLayout',
      'bindGroupIndex',
      'publicEntries'
    ]);
    if (optionKeys.some((key) => !allowedKeys.has(key))) {
      throw authorityInspectionError(
        optionsCode,
        'Gas free-volume EOS options contain an unsupported property'
      );
    }
    const optionValue = (key) => ownAuthorityDataDescriptor(
      options,
      key,
      `gas free-volume EOS options.${key}`,
      optionsCode
    ).value;
    const candidateDevice = optionValue('device');
    const candidateEncoder = optionValue('encoder');
    const pass = optionValue('pass');
    const passEncoder = optionValue('passEncoder');
    const bindGroupLayout = optionValue('bindGroupLayout');
    const publicEntries = optionValue('publicEntries');
    const bindGroupIndex = optionKeys.includes('bindGroupIndex')
      ? optionValue('bindGroupIndex')
      : 0;

    if (candidateDevice !== record.device) {
      throw authorityError(
        'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_DEVICE_MISMATCH',
        'Gas free-volume execution belongs to another WebGPU device'
      );
    }
    if (candidateEncoder !== record.encoder) {
      throw authorityError(
        'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_ENCODER_MISMATCH',
        'Gas free-volume EOS binding requires its exact producing encoder'
      );
    }
    const passIndex = EOS_CONSUMER_PASSES.indexOf(pass);
    if (passIndex < 0) {
      throw authorityError(
        'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_PASS_INVALID',
        'Gas free-volume EOS pass must be aggregate, gradient, or finalize'
      );
    }
    if (passIndex < receiptRecord.nextPassIndex) {
      throw authorityError(
        'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_PASS_REPLAY',
        `Gas free-volume EOS pass ${pass} was already encoded`
      );
    }
    if (passIndex !== receiptRecord.nextPassIndex) {
      throw authorityError(
        'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_PASS_ORDER',
        `Gas free-volume EOS pass ${pass} is out of order`
      );
    }
    if (
      !Number.isInteger(bindGroupIndex)
      || bindGroupIndex < 0
      || bindGroupIndex > 0xffff_ffff
    ) {
      throw authorityError(
        'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_BIND_GROUP_INDEX_INVALID',
        'Gas free-volume EOS bindGroupIndex must be a u32'
      );
    }
    const publicSnapshot = snapshotAuthorityPublicEntries(
      publicEntries,
      candidateDevice
    );
    const createBindGroup = candidateDevice?.createBindGroup;
    const setBindGroup = passEncoder?.setBindGroup;
    if (typeof createBindGroup !== 'function') {
      throw new TypeError('device.createBindGroup must be a function');
    }
    if (typeof setBindGroup !== 'function') {
      throw new TypeError('passEncoder.setBindGroup must be a function');
    }
    if (!bindGroupLayout || (
      typeof bindGroupLayout !== 'object'
      && typeof bindGroupLayout !== 'function'
    )) {
      throw new TypeError('bindGroupLayout must be a WebGPU layout object');
    }
    const passLabel = pass === 'finalize' ? 'finalizer' : pass;
    const bindGroup = createBindGroup.call(candidateDevice, {
      label: `${record.label}-eos-${passLabel}-bind-group`,
      layout: bindGroupLayout,
      entries: [
        ...publicSnapshot,
        { binding: 5, resource: { buffer: record.arena.rowsBuffer } },
        { binding: 6, resource: { buffer: record.arena.controlBuffer } }
      ]
    });
    // A host implementation may mutate the pass before throwing. Mark first;
    // an abandoned receipt after this boundary makes the execution discard-only.
    receiptRecord.encoderMutationStarted = true;
    setBindGroup.call(passEncoder, bindGroupIndex, bindGroup);
    receiptRecord.nextPassIndex += 1;
    record.consumerBindCount += 1;
    return receiptRecord.action;
  } catch (error) {
    abandonSphSpatialGasFreeVolumeEosAuthority(receiptRecord.receipt);
    throw error;
  }
}

/**
 * Finish and submit the exact producing encoder. A successful queue.submit is
 * the sole transition that marks both execution and receipt submitted.
 */
export function submitSphSpatialGasFreeVolumeEosAuthority(receipt, device) {
  const receiptRecord = retainedGasFreeVolumeEosReceipts.get(receipt);
  const record = receiptRecord?.record;
  if (
    !record
    || receiptRecord.receipt !== receipt
    || receiptRecord.state !== 'borrowed'
    || record.activeEosReceipt !== receipt
  ) {
    return false;
  }
  if (device !== record.device) {
    throw authorityError(
      'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_DEVICE_MISMATCH',
      'Gas free-volume EOS submission requires its exact WebGPU device'
    );
  }
  if (!record.isLive() || record.released || record.consumerDiscardRequired) {
    throw authorityError(
      'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_TERMINAL',
      'Gas free-volume EOS submission lost its live execution owner'
    );
  }
  if (receiptRecord.nextPassIndex !== EOS_CONSUMER_PASSES.length) {
    throw authorityError(
      'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_PASSES_INCOMPLETE',
      'Gas free-volume EOS submission requires all three declared passes'
    );
  }
  const finish = record.encoder?.finish;
  const submit = record.device?.queue?.submit;
  if (typeof finish !== 'function' || typeof submit !== 'function') {
    throw new TypeError(
      'Gas free-volume EOS submission requires encoder.finish and queue.submit'
    );
  }
  try {
    const commandBuffer = finish.call(record.encoder);
    submit.call(record.device.queue, [commandBuffer]);
  } catch (error) {
    abandonSphSpatialGasFreeVolumeEosAuthority(receipt);
    throw error;
  }
  // All validation and host calls precede this non-throwing private transition.
  if (record.markSubmitted() !== true) {
    receiptRecord.state = 'terminal';
    record.activeEosReceipt = null;
    record.consumerDiscardRequired = true;
    throw authorityError(
      'ERR_SPH_GAS_FREE_VOLUME_AUTHORITY_SUBMIT_TRANSITION',
      'Gas free-volume EOS queue submitted but owner transition was inconsistent'
    );
  }
  receiptRecord.state = 'submitted';
  record.activeEosReceipt = null;
  record.consumerSubmitted = true;
  record.consumerSubmitCount += 1;
  return true;
}
