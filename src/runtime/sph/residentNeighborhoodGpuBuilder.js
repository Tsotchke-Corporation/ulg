import {
  RESIDENT_NEIGHBORHOOD_BUILDER_PARAM_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_BUILDER_STATUS_FLAG,
  RESIDENT_NEIGHBORHOOD_CELL_CSR_HEADER_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CHART_LEVEL_U32_LAYOUT,
  ULG_RESIDENT_NEIGHBORHOOD_DENSE_UNIFORM_CHART_SCHEMA,
  ULG_RESIDENT_NEIGHBORHOOD_GPU_BUILDER_SCHEMA,
  residentNeighborhoodBuilderWgsl
} from '../../../ulg-gpu-abi/src/residentNeighborhoodBuilderWgsl.js';
import {
  RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY,
  RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS,
  RESIDENT_NEIGHBORHOOD_CELL_KEY_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_STATUS_FLAG,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG,
  RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_U32_LAYOUT,
  ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA
} from '../../../ulg-gpu-abi/src/residentNeighborhood.js';
import {
  WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT,
  WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX,
  createWebGpuRadixUniquePlan,
  createWebGpuStableRadixScanUnique,
  createWebGpuU32ScanPlan,
  createWebGpuU32ExclusiveScan,
  webGpuU32ScanEncodedDispatchCount
} from '../webgpuRadixScanUnique.js';
import { validateResidentNeighborhoodLease } from './residentNeighborhoodGpu.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';

export {
  RESIDENT_NEIGHBORHOOD_BUILDER_PARAM_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_BUILDER_STATUS_FLAG,
  RESIDENT_NEIGHBORHOOD_CELL_CSR_HEADER_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CHART_LEVEL_U32_LAYOUT,
  ULG_RESIDENT_NEIGHBORHOOD_DENSE_UNIFORM_CHART_SCHEMA,
  ULG_RESIDENT_NEIGHBORHOOD_GPU_BUILDER_SCHEMA,
  residentNeighborhoodBuilderWgsl
};

export const RESIDENT_NEIGHBORHOOD_BUILDER_WORKGROUP_SIZE = 64;
export const RESIDENT_NEIGHBORHOOD_BUILDER_VERSION = 0;
export const RESIDENT_NEIGHBORHOOD_GENERATION_CONTROL_SLOT_COUNT_DEFAULT =
  WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT;
export const RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE = Object.freeze({
  keyBuild: 'residentNeighborhoodKeyBuild',
  cellAssemble: 'residentNeighborhoodCellAssemble',
  candidateCount: 'residentNeighborhoodCandidateCount',
  finalize: 'residentNeighborhoodFinalize',
  candidateFill: 'residentNeighborhoodCandidateFill'
});

const UINT32_MAX = 0xffff_ffff;
const U32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const UNIFORM_BYTES = 256;
const BUILDER_PARAM_U32_CAPACITY = UNIFORM_BYTES / U32_BYTES;
const BUILD_STATUS_U32_COUNT = 4;
const CELL_KEY_STRIDE_U32 = RESIDENT_NEIGHBORHOOD_CELL_KEY_U32_LAYOUT.length;
const CELL_HEADER_STRIDE_U32 = RESIDENT_NEIGHBORHOOD_CELL_CSR_HEADER_U32_LAYOUT.length;
const CHART_LEVEL_STRIDE_U32 = RESIDENT_NEIGHBORHOOD_CHART_LEVEL_U32_LAYOUT.length;
const SUPPORT_CLASS_STRIDE_U32 = RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_U32_LAYOUT.length;
const ASSIGNMENT_STRIDE_U32 = RESIDENT_NEIGHBORHOOD_SOURCE_SUPPORT_ASSIGNMENT_U32_LAYOUT.length;
const CANDIDATE_STRIDE_U32 = 2;
const CANDIDATE_SCRATCH_STRIDE_U32 = 4;
const PACKED_HEADER_STRIDE_U32 = RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT.length;
const EVIDENCE_STRIDE_U32 = RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT.length;
const PRIMITIVE_UNIFORM_ROW_BYTES = 256;
const DIRECT_PAIR_COMMAND_EQUIVALENT_WORK = 512;
const SIGNED_CELL_SAFE_LIMIT = 2147483520;
const RADIX_RECORD_TOUCHES_PER_SOURCE = 1
  + 2 * RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS * 8
  + 2;

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function uint32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > UINT32_MAX) {
    throw new RangeError(`${label} must be a uint32`);
  }
  return number >>> 0;
}

function positiveInteger(value, label, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function safeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return number;
}

function checkedAdd(left, right, label) {
  const value = left + right;
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} exceeds safe integer range`);
  return value;
}

function checkedMultiply(left, right, label) {
  const value = left * right;
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} exceeds safe integer range`);
  return value;
}

function shaderWordCount(value, label) {
  const count = safeInteger(value, label);
  if (count > UINT32_MAX) {
    throw new RangeError(`${label} exceeds u32 shader addressability`);
  }
  return count;
}

function alignU32(value, alignment = 4) {
  return Math.ceil(safeInteger(value, 'u32 offset') / alignment) * alignment;
}

function alignedBytes(value, alignment = 4) {
  return Math.max(4, Math.ceil(safeInteger(value, 'byte length') / alignment) * alignment);
}

function alignedByteOffset(value, alignment = 4) {
  const offset = safeInteger(value, 'byte offset');
  const divisor = positiveInteger(alignment, 'byte alignment');
  return Math.ceil(offset / divisor) * divisor;
}

function greatestCommonDivisor(left, right) {
  let a = positiveInteger(left, 'alignment left');
  let b = positiveInteger(right, 'alignment right');
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function leastCommonMultiple(left, right) {
  return checkedMultiply(
    left / greatestCommonDivisor(left, right),
    right,
    'combined buffer offset alignment'
  );
}

function createGenerationControlArenaLayout({
  slotCount,
  minUniformBufferOffsetAlignment = UNIFORM_BYTES,
  minStorageBufferOffsetAlignment = UNIFORM_BYTES
} = {}) {
  const slots = positiveInteger(slotCount, 'retainedGenerationSlotCount', {
    max: WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX
  });
  const uniformAlignment = Math.max(
    UNIFORM_BYTES,
    positiveInteger(
      minUniformBufferOffsetAlignment,
      'minUniformBufferOffsetAlignment',
      { max: UINT32_MAX }
    )
  );
  const storageAlignment = Math.max(
    UNIFORM_BYTES,
    positiveInteger(
      minStorageBufferOffsetAlignment,
      'minStorageBufferOffsetAlignment',
      { max: UINT32_MAX }
    )
  );
  const slotAlignment = leastCommonMultiple(uniformAlignment, storageAlignment);
  const paramsByteOffset = 0;
  const paramsSlotStrideByteLength = alignedByteOffset(UNIFORM_BYTES, uniformAlignment);
  const capacityEvidenceByteOffset = 0;
  const cellHeaderByteOffset = alignedByteOffset(
    EVIDENCE_STRIDE_U32 * U32_BYTES,
    U32_BYTES
  );
  const packedHeaderByteOffset = alignedByteOffset(
    cellHeaderByteOffset + CELL_HEADER_STRIDE_U32 * U32_BYTES,
    U32_BYTES
  );
  const dataSlotStrideByteLength = alignedByteOffset(
    packedHeaderByteOffset + PACKED_HEADER_STRIDE_U32 * U32_BYTES,
    storageAlignment
  );
  const paramsArenaByteLength = checkedMultiply(
    slots,
    paramsSlotStrideByteLength,
    'generation params arena bytes'
  );
  const dataArenaByteLength = checkedMultiply(
    slots,
    dataSlotStrideByteLength,
    'generation data arena bytes'
  );
  return Object.freeze({
    slotCount: slots,
    uniformAlignment,
    storageAlignment,
    slotAlignment,
    capacityEvidenceByteOffset,
    paramsByteOffset,
    cellHeaderByteOffset,
    packedHeaderByteOffset,
    paramsSlotStrideByteLength,
    dataSlotStrideByteLength,
    slotStrideByteLength: paramsSlotStrideByteLength + dataSlotStrideByteLength,
    paramsArenaByteLength,
    dataArenaByteLength,
    byteLength: checkedAdd(paramsArenaByteLength, dataArenaByteLength, 'generation arena bytes')
  });
}

function float32Bits(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new RangeError(`${label} must be finite`);
  }
  const data = new DataView(new ArrayBuffer(U32_BYTES));
  data.setFloat32(0, number, true);
  return data.getUint32(0, true);
}

function int32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < -0x8000_0000 || number > 0x7fff_ffff) {
    throw new RangeError(`${label} must be an int32`);
  }
  return number;
}

function signedOrderKey(value, label) {
  return (int32(value, label) ^ 0x8000_0000) >>> 0;
}

function finiteVector3(value, label) {
  if ((!Array.isArray(value) && !ArrayBuffer.isView(value)) || value.length !== 3) {
    throw new TypeError(`${label} must contain exactly three values`);
  }
  return [0, 1, 2].map((axis) => {
    const number = Number(value[axis]);
    if (!Number.isFinite(number)) throw new RangeError(`${label}[${axis}] must be finite`);
    return number;
  });
}

function integerVector3(value, label, { minimum, maximum }) {
  if ((!Array.isArray(value) && !ArrayBuffer.isView(value)) || value.length !== 3) {
    throw new TypeError(`${label} must contain exactly three values`);
  }
  return [0, 1, 2].map((axis) => {
    const number = Number(value[axis]);
    if (!Number.isInteger(number) || number < minimum || number > maximum) {
      throw new RangeError(`${label}[${axis}] must be an integer in [${minimum}, ${maximum}]`);
    }
    return number;
  });
}

export function normalizeResidentNeighborhoodDenseUniformChart(value, {
  sourceCount,
  maxCellRadius = 0,
  sourceMetadataMode = 'uniform-gpu-expanded',
  supportClasses = []
} = {}) {
  if (value == null) return null;
  if (typeof value !== 'object') {
    throw new TypeError('denseUniformChart must be an object when provided');
  }
  const count = positiveInteger(sourceCount, 'sourceCount', { max: UINT32_MAX - 1 });
  const radius = uint32(maxCellRadius, 'maxCellRadius');
  const chartId = uint32(value.chartId ?? 0, 'denseUniformChart.chartId');
  const level = int32(value.level ?? 0, 'denseUniformChart.level');
  const cellSizeM = Number(value.cellSizeM);
  if (!Number.isFinite(cellSizeM) || cellSizeM <= 0) {
    throw new RangeError('denseUniformChart.cellSizeM must be finite and positive');
  }
  const originM = finiteVector3(value.originM, 'denseUniformChart.originM');
  const minCell = integerVector3(value.minCell, 'denseUniformChart.minCell', {
    minimum: -SIGNED_CELL_SAFE_LIMIT,
    maximum: SIGNED_CELL_SAFE_LIMIT
  });
  const dimensions = integerVector3(value.dimensions, 'denseUniformChart.dimensions', {
    minimum: 1,
    maximum: 0x7fff_ffff
  });
  let gridCellCount = 1;
  for (const dimension of dimensions) {
    gridCellCount = checkedMultiply(gridCellCount, dimension, 'dense grid cell count');
  }
  if (gridCellCount > UINT32_MAX) {
    throw new RangeError('dense grid cell count exceeds u32 addressability');
  }
  const lowerBound = -SIGNED_CELL_SAFE_LIMIT + radius;
  const upperBound = SIGNED_CELL_SAFE_LIMIT - radius;
  for (let axis = 0; axis < 3; axis += 1) {
    const maximumCell = checkedAdd(
      minCell[axis],
      dimensions[axis] - 1,
      `denseUniformChart maximum cell axis ${axis}`
    );
    if (minCell[axis] < lowerBound || maximumCell > upperBound) {
      throw new RangeError(
        `denseUniformChart axis ${axis} exceeds the cell-search-safe signed range`
      );
    }
  }
  const multichartOrLevel = supportClasses.some((entry) => (
    Number(entry?.minLevelDelta) !== 0
      || Number(entry?.maxLevelDelta) !== 0
      || ((Number(entry?.flags) >>> 0) & (
        RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.CROSS_LEVEL
          | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.CROSS_CHART
      )) !== 0
  ));
  let admitted = true;
  let admissionReason = 'grid-cell-count-within-source-count';
  if (String(sourceMetadataMode) !== 'uniform-gpu-expanded') {
    admitted = false;
    admissionReason = 'source-metadata-is-not-uniform-single-chart';
  } else if (multichartOrLevel) {
    admitted = false;
    admissionReason = 'support-classes-require-multichart-or-multilevel-search';
  } else if (gridCellCount > count) {
    admitted = false;
    admissionReason = 'grid-cell-count-exceeds-source-count';
  }
  return Object.freeze({
    schema: ULG_RESIDENT_NEIGHBORHOOD_DENSE_UNIFORM_CHART_SCHEMA,
    chartId,
    level,
    levelOrderKey: signedOrderKey(level, 'denseUniformChart.level'),
    cellSizeM,
    cellSizeBits: float32Bits(cellSizeM, 'denseUniformChart.cellSizeM'),
    originM: Object.freeze(originM),
    originBits: Object.freeze(originM.map(
      (component, axis) => float32Bits(component, `denseUniformChart.originM[${axis}]`)
    )),
    minCell: Object.freeze(minCell),
    minCellOrderKeys: Object.freeze(minCell.map(
      (component, axis) => signedOrderKey(component, `denseUniformChart.minCell[${axis}]`)
    )),
    dimensions: Object.freeze(dimensions),
    gridCellCount,
    admitted,
    admissionReason,
    deterministicMemberOrder: 'stable-source-index',
    particleReadbackRequired: false,
    cpuMirrorRequired: false
  });
}

function assertDevice(device) {
  if (!device?.createBuffer || !device?.createShaderModule
    || !device?.createComputePipeline || !device?.createBindGroup
    || !device?.queue?.writeBuffer) {
    throw new TypeError('resident neighborhood builder requires a WebGPU-like device');
  }
}

function assertEncoder(encoder) {
  if (!encoder?.beginComputePass || !encoder?.clearBuffer || !encoder?.copyBufferToBuffer) {
    throw new TypeError('resident neighborhood encoding requires a caller-owned command encoder');
  }
}

function checkStorageByteLength(device, byteLength, label) {
  const maxBufferSize = Number(device.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY);
  const maxBindingSize = Number(
    device.limits?.maxStorageBufferBindingSize ?? Number.POSITIVE_INFINITY
  );
  if (byteLength > maxBufferSize) {
    throw new RangeError(`${label} byte length ${byteLength} exceeds maxBufferSize ${maxBufferSize}`);
  }
  if (byteLength > maxBindingSize) {
    throw new RangeError(
      `${label} byte length ${byteLength} exceeds maxStorageBufferBindingSize ${maxBindingSize}`
    );
  }
}

function createStorageBuffer(device, label, byteLength, extraUsage = 0) {
  const size = alignedBytes(byteLength);
  checkStorageByteLength(device, size, label);
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
      | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  }), device);
}

function bufferRange(buffer, byteOffset, byteLength, label) {
  if (!buffer) throw new TypeError(`${label} requires a GPUBuffer-like object`);
  const offset = safeInteger(byteOffset, `${label}.byteOffset`);
  const length = safeInteger(byteLength, `${label}.byteLength`);
  if ((offset & 3) !== 0 || (length & 3) !== 0) {
    throw new RangeError(`${label} range must be u32 aligned`);
  }
  const end = checkedAdd(offset, length, `${label} range end`);
  if (Number.isFinite(Number(buffer.size)) && end > Number(buffer.size)) {
    throw new RangeError(`${label} range ${end} exceeds buffer size ${buffer.size}`);
  }
  return { buffer, byteOffset: offset, byteLength: length };
}

function dispatchShape(elementCount, maxDimension) {
  const groupCount = Math.max(
    1,
    Math.ceil(elementCount / RESIDENT_NEIGHBORHOOD_BUILDER_WORKGROUP_SIZE)
  );
  const x = Math.min(groupCount, maxDimension);
  const y = Math.ceil(groupCount / x);
  if (y > maxDimension) {
    throw new RangeError(`builder workgroup count ${groupCount} exceeds 2D dispatch capacity`);
  }
  return [x, y, 1];
}

function createCellCsrLayout(sourceCount) {
  const cellKeyBaseU32 = alignU32(CELL_HEADER_STRIDE_U32);
  const cellOffsetBaseU32 = alignU32(checkedAdd(
    cellKeyBaseU32,
    checkedMultiply(sourceCount, CELL_KEY_STRIDE_U32, 'cell-key physical words'),
    'cell-key physical end'
  ));
  const cellMemberBaseU32 = alignU32(checkedAdd(
    cellOffsetBaseU32,
    sourceCount + 1,
    'cell-offset physical end'
  ));
  const backingCapacityU32 = alignU32(checkedAdd(
    cellMemberBaseU32,
    sourceCount,
    'cell-member physical end'
  ));
  shaderWordCount(backingCapacityU32, 'cell CSR backing words');
  return {
    headerStrideU32: CELL_HEADER_STRIDE_U32,
    cellKeyBaseU32,
    cellOffsetBaseU32,
    cellMemberBaseU32,
    physicalUniqueCellCapacity: sourceCount,
    physicalCellOffsetCapacity: sourceCount + 1,
    physicalCellMemberCapacity: sourceCount,
    backingCapacityU32,
    byteLength: backingCapacityU32 * U32_BYTES
  };
}

function createMetadataLayout(sourceCount, supportClassCount) {
  const chartBaseU32 = 0;
  const supportClassBaseU32 = alignU32(
    checkedMultiply(sourceCount, CHART_LEVEL_STRIDE_U32, 'chart-level metadata words')
  );
  const backingCapacityU32 = alignU32(checkedAdd(
    supportClassBaseU32,
    checkedMultiply(
      supportClassCount,
      SUPPORT_CLASS_STRIDE_U32,
      'support-class metadata words'
    ),
    'support-class metadata end'
  ));
  shaderWordCount(backingCapacityU32, 'builder metadata backing words');
  return {
    chartBaseU32,
    supportClassBaseU32,
    backingCapacityU32,
    byteLength: backingCapacityU32 * U32_BYTES
  };
}

function createResidentNeighborhoodPackedCsrByteLength({ sourceCount, candidateCapacity }) {
  const sourceOffsetBaseU32 = PACKED_HEADER_STRIDE_U32;
  const assignmentBaseU32 = alignU32(sourceOffsetBaseU32 + sourceCount + 1);
  const candidateBaseU32 = alignU32(
    assignmentBaseU32 + sourceCount * ASSIGNMENT_STRIDE_U32
  );
  return alignU32(candidateBaseU32 + candidateCapacity * CANDIDATE_STRIDE_U32) * U32_BYTES;
}

export function planResidentNeighborhoodGpuBuilderStrategy({
  sourceCount,
  requestedStrategy = 'auto',
  denseUniformChart = null,
  maxComputeWorkgroupsPerDimension = 65535
} = {}) {
  const count = positiveInteger(sourceCount, 'sourceCount', { max: UINT32_MAX - 1 });
  const request = String(requestedStrategy || 'auto').trim().toLowerCase();
  const strategies = Object.values(RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY);
  if (!strategies.includes(request)) {
    throw new RangeError('requestedStrategy must be auto, direct, dense-grid, or radix');
  }
  const denseGridAdmitted = denseUniformChart?.schema
      === ULG_RESIDENT_NEIGHBORHOOD_DENSE_UNIFORM_CHART_SCHEMA
    && denseUniformChart.admitted === true
    && positiveInteger(
      denseUniformChart.gridCellCount,
      'denseUniformChart.gridCellCount',
      { max: UINT32_MAX }
    ) <= count;
  if (request === RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DENSE_UNIFORM_CHART
    && !denseGridAdmitted) {
    throw new RangeError('dense-grid strategy requires an admitted dense uniform chart');
  }
  const candidateScanPlan = createWebGpuU32ScanPlan({
    elementCount: count,
    maxComputeWorkgroupsPerDimension
  });
  const radixPlan = createWebGpuRadixUniquePlan({
    elementCount: count,
    keyWordCount: RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS,
    keyStrideWords: CELL_KEY_STRIDE_U32,
    maxComputeWorkgroupsPerDimension
  });
  const denseGridRadixPlan = createWebGpuRadixUniquePlan({
    elementCount: count,
    keyWordCount: 1,
    keyStrideWords: CELL_KEY_STRIDE_U32,
    maxComputeWorkgroupsPerDimension
  });
  const scanDispatchCount = webGpuU32ScanEncodedDispatchCount(candidateScanPlan);
  const histogramScanDispatchCount = webGpuU32ScanEncodedDispatchCount(
    radixPlan.histogramScanPlan
  );
  const headScanDispatchCount = webGpuU32ScanEncodedDispatchCount(radixPlan.headScanPlan);
  const radixSortDispatchCount = 1 + radixPlan.passCount * (
    2 + histogramScanDispatchCount
  );
  const denseGridHistogramScanDispatchCount = webGpuU32ScanEncodedDispatchCount(
    denseGridRadixPlan.histogramScanPlan
  );
  const denseGridHeadScanDispatchCount = webGpuU32ScanEncodedDispatchCount(
    denseGridRadixPlan.headScanPlan
  );
  const denseGridRadixSortDispatchCount = 1 + denseGridRadixPlan.passCount * (
    2 + denseGridHistogramScanDispatchCount
  );
  const denseGridUniqueDispatchCount = 3 + denseGridHeadScanDispatchCount;
  const radixUniqueDispatchCount = 3 + headScanDispatchCount;
  const directDispatchCount = 3 + scanDispatchCount;
  const radixDispatchCount = 5 + scanDispatchCount
    + radixSortDispatchCount + radixUniqueDispatchCount;
  const denseGridDispatchCount = 5 + scanDispatchCount
    + denseGridRadixSortDispatchCount + denseGridUniqueDispatchCount;
  const directWorkEstimate = 2 * count * count
    + directDispatchCount * DIRECT_PAIR_COMMAND_EQUIVALENT_WORK;
  const radixWorkEstimate = RADIX_RECORD_TOUCHES_PER_SOURCE * count
    + radixDispatchCount * DIRECT_PAIR_COMMAND_EQUIVALENT_WORK;
  const denseGridRecordTouchesPerSource = 1 + 2 * 8 + 2;
  const denseGridWorkEstimate = denseGridRecordTouchesPerSource * count
    + denseGridDispatchCount * DIRECT_PAIR_COMMAND_EQUIVALENT_WORK;
  const baselineAutoStrategy = directWorkEstimate <= radixWorkEstimate
    ? RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DIRECT
    : RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.RADIX;
  const strategy = request === RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.AUTO
    ? (baselineAutoStrategy === RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.RADIX
        && denseGridAdmitted
      ? RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DENSE_UNIFORM_CHART
      : baselineAutoStrategy)
    : request;
  return Object.freeze({
    schema: 'peercompute.ulg.resident-neighborhood-builder-strategy-plan.v0',
    status: 'resident-neighborhood-builder-strategy-planned',
    requestedStrategy: request,
    strategy,
    sourceCount: count,
    directPairEvaluationCount: 2 * count * count,
    directDispatchCount,
    radixDispatchCount,
    denseGridDispatchCount,
    candidateScanDispatchCount: scanDispatchCount,
    radixSortDispatchCount,
    radixUniqueDispatchCount,
    denseGridRadixSortDispatchCount,
    denseGridUniqueDispatchCount,
    directWorkEstimate,
    radixWorkEstimate,
    denseGridWorkEstimate,
    commandEquivalentWork: DIRECT_PAIR_COMMAND_EQUIVALENT_WORK,
    radixRecordTouchesPerSource: RADIX_RECORD_TOUCHES_PER_SOURCE,
    denseGridRecordTouchesPerSource,
    denseGridAdmitted,
    denseGridCellCount: denseGridAdmitted ? denseUniformChart.gridCellCount : 0,
    selectionAuthority: request === 'auto'
      ? (strategy === RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DENSE_UNIFORM_CHART
          ? 'bounded-uniform-chart-and-static-command-topology'
          : 'source-count-and-static-command-topology-cost-model')
      : 'validation-only-forced-strategy',
    materialPairSpecific: false,
    scenarioSpecific: false
  });
}

export function planResidentNeighborhoodGpuBuilderAllocations({
  sourceCount,
  supportClassCount = 1,
  candidateCapacity,
  generationCount = 1,
  maxComputeWorkgroupsPerDimension = 65535,
  retainConstantScanParamsBuffers = false,
  retainedParamsSlotCount = WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT,
  minUniformBufferOffsetAlignment = UNIFORM_BYTES,
  minStorageBufferOffsetAlignment = UNIFORM_BYTES,
  retainGenerationControlArena = true,
  retainedGenerationSlotCount = RESIDENT_NEIGHBORHOOD_GENERATION_CONTROL_SLOT_COUNT_DEFAULT
} = {}) {
  const count = positiveInteger(sourceCount, 'sourceCount', { max: UINT32_MAX - 1 });
  const classCount = positiveInteger(supportClassCount, 'supportClassCount', { max: UINT32_MAX });
  const candidates = positiveInteger(candidateCapacity, 'candidateCapacity', { max: UINT32_MAX });
  const liveGenerations = positiveInteger(generationCount, 'generationCount', { max: UINT32_MAX });
  const paramsOffsetAlignment = Math.max(
    UNIFORM_BYTES,
    positiveInteger(
      minUniformBufferOffsetAlignment,
      'minUniformBufferOffsetAlignment',
      { max: UINT32_MAX }
    )
  );
  const generationControlArenaLayout = retainGenerationControlArena
    ? createGenerationControlArenaLayout({
        slotCount: retainedGenerationSlotCount,
        minUniformBufferOffsetAlignment,
        minStorageBufferOffsetAlignment
      })
    : null;
  if (generationControlArenaLayout && liveGenerations > generationControlArenaLayout.slotCount) {
    throw new RangeError(
      `generationCount ${liveGenerations} exceeds retained generation slot capacity `
        + generationControlArenaLayout.slotCount
    );
  }
  const resolvedRetainedParamsSlotCount = retainConstantScanParamsBuffers
    ? positiveInteger(retainedParamsSlotCount, 'retainedParamsSlotCount', {
        max: WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX
      })
    : 0;
  const metadataLayout = createMetadataLayout(count, classCount);
  const cellLayout = createCellCsrLayout(count);
  const packedCsrByteLength = createResidentNeighborhoodPackedCsrByteLength({
    sourceCount: count,
    candidateCapacity: candidates
  });
  const radixPlan = createWebGpuRadixUniquePlan({
    elementCount: count,
    keyWordCount: RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS,
    keyStrideWords: CELL_KEY_STRIDE_U32,
    maxComputeWorkgroupsPerDimension
  });
  const candidateScanPlan = createWebGpuU32ScanPlan({
    elementCount: count,
    maxComputeWorkgroupsPerDimension
  });
  const retainedRadixParamsArenaByteLength = retainConstantScanParamsBuffers
    ? checkedMultiply(
        checkedMultiply(
          resolvedRetainedParamsSlotCount,
          radixPlan.passCount,
          'retained radix params slot rows'
        ),
        paramsOffsetAlignment,
        'retained radix params arena bytes'
      )
    : 0;
  const retainedUniqueParamsArenaByteLength = retainConstantScanParamsBuffers
    ? checkedMultiply(
        resolvedRetainedParamsSlotCount,
        paramsOffsetAlignment,
        'retained unique params arena bytes'
      )
    : 0;
  const radixPersistentByteLength =
    radixPlan.sortedIndexByteLength * 2
    + radixPlan.histogramByteLength * 2
    + radixPlan.headByteLength * 2
    + radixPlan.uniqueKeyByteLength
    + radixPlan.uniqueOffsetByteLength
    + radixPlan.evidenceByteLength
    + radixPlan.indirectDispatchByteLength
    + radixPlan.histogramScanPlan.scratchByteLength
    + radixPlan.headScanPlan.scratchByteLength
    + retainedRadixParamsArenaByteLength
    + retainedUniqueParamsArenaByteLength;
  const builderArenaByteLength =
    alignedBytes(count * CELL_KEY_STRIDE_U32 * U32_BYTES)
    + alignedBytes(metadataLayout.byteLength)
    + alignedBytes(cellLayout.byteLength)
    + alignedBytes(packedCsrByteLength)
    + alignedBytes(candidates * CANDIDATE_SCRATCH_STRIDE_U32 * U32_BYTES)
    + alignedBytes(count * U32_BYTES) * 2
    + alignedBytes(BUILD_STATUS_U32_COUNT * U32_BYTES)
    + alignedBytes(3 * U32_BYTES);
  const constantScanParamsByteLength = (
    radixPlan.histogramScanPlan.levelCount
    + radixPlan.headScanPlan.levelCount
    + candidateScanPlan.levelCount
  ) * PRIMITIVE_UNIFORM_ROW_BYTES;
  const primitiveTransientPerGenerationByteLength = retainConstantScanParamsBuffers
    ? 0
    : radixPlan.passCount * paramsOffsetAlignment
      + paramsOffsetAlignment
      + constantScanParamsByteLength;
  const transientGenerationControlByteLength = retainGenerationControlArena
    ? 0
    : UNIFORM_BYTES
      + CELL_HEADER_STRIDE_U32 * U32_BYTES
      + PACKED_HEADER_STRIDE_U32 * U32_BYTES
      + EVIDENCE_STRIDE_U32 * U32_BYTES;
  const generationLocalByteLength = transientGenerationControlByteLength
    + primitiveTransientPerGenerationByteLength;
  const persistentByteLength = builderArenaByteLength
    + radixPersistentByteLength
    + candidateScanPlan.scratchByteLength
    + (retainConstantScanParamsBuffers ? constantScanParamsByteLength : 0)
    + (generationControlArenaLayout?.byteLength ?? 0);
  const transientByteLength = generationLocalByteLength * liveGenerations;
  return {
    schema: 'peercompute.ulg.resident-neighborhood-builder-allocation-plan.v0',
    status: 'resident-neighborhood-builder-allocation-plan-ready',
    exact: true,
    sourceCount: count,
    supportClassCount: classCount,
    candidateCapacity: candidates,
    liveGenerationCount: liveGenerations,
    persistentByteLength,
    transientByteLength,
    peakAllocatedByteLength: persistentByteLength + transientByteLength,
    builderArenaByteLength,
    radixPersistentByteLength,
    retainedRadixParamsArenaByteLength,
    retainedUniqueParamsArenaByteLength,
    retainedParamsSlotCount: resolvedRetainedParamsSlotCount,
    paramsOffsetAlignment,
    candidateScanPersistentByteLength: candidateScanPlan.scratchByteLength,
    generationLocalByteLength,
    primitiveTransientPerGenerationByteLength,
    constantScanParamsByteLength,
    retainedGenerationSlotCount: generationControlArenaLayout?.slotCount ?? 0,
    retainedGenerationControlArenaByteLength: generationControlArenaLayout?.byteLength ?? 0,
    retainedGenerationParamsArenaByteLength:
      generationControlArenaLayout?.paramsArenaByteLength ?? 0,
    retainedGenerationDataArenaByteLength:
      generationControlArenaLayout?.dataArenaByteLength ?? 0,
    generationControlSlotStrideByteLength:
      generationControlArenaLayout?.slotStrideByteLength ?? 0,
    generationParamsSlotStrideByteLength:
      generationControlArenaLayout?.paramsSlotStrideByteLength ?? 0,
    generationDataSlotStrideByteLength:
      generationControlArenaLayout?.dataSlotStrideByteLength ?? 0,
    generationControlUniformAlignment:
      generationControlArenaLayout?.uniformAlignment ?? 0,
    generationControlStorageAlignment:
      generationControlArenaLayout?.storageAlignment ?? 0,
    transientGenerationControlByteLength,
    generationControlResidency: generationControlArenaLayout
      ? 'bounded-retained-fence-leased-slots'
      : 'transient-per-generation',
    constantScanParamsResidency: retainConstantScanParamsBuffers
      ? 'retained-lane-fixed-count'
      : 'transient-per-generation',
    arenaPolicy: 'single-shared-arena-command-ordered-reuse',
    liveGenerationPolicy: generationControlArenaLayout
      ? 'two-submission-window-with-bounded-retained-control-slots'
      : 'single-flight-submission-with-generation-local-headers',
    includes: [
      'occupancy-keys',
      'metadata',
      'cell-csr',
      'packed-candidate-csr',
      'candidate-staging',
      'candidate-count-scan',
      'radix-sort-unique',
      'capacity-evidence',
      'indirect-dispatch',
      'generation-headers-and-uniforms'
    ]
  };
}

function hostSearchReasonCodes(descriptor, { maxCellRadius, maxLevelSpan }) {
  const reasons = [];
  for (const supportClass of descriptor.supportClasses) {
    if (supportClass.cellRadius > maxCellRadius) {
      reasons.push(`support-class-${supportClass.supportClassId}-cell-radius-exceeds-builder-bound`);
    }
    const levelSpan = supportClass.maxLevelDelta - supportClass.minLevelDelta + 1;
    if (levelSpan > maxLevelSpan) {
      reasons.push(`support-class-${supportClass.supportClassId}-level-span-exceeds-builder-bound`);
    }
  }
  return reasons;
}

function pendingStatusFlags(descriptor) {
  const clear = RESIDENT_NEIGHBORHOOD_STATUS_FLAG.READY
    | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.CONSUMER_DISPATCH_ADMITTED;
  return ((descriptor.capacityEvidence.statusFlags & ~clear)
    | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.FAIL_CLOSED
    | RESIDENT_NEIGHBORHOOD_STATUS_FLAG.REBUILD_REQUIRED) >>> 0;
}

function createPendingPackedHeader(descriptor, failureStatusFlags, target = null) {
  const header = target || new Uint32Array(descriptor.packedCsr.headerU32.length);
  header.set(descriptor.packedCsr.headerU32);
  header[10] = 0;
  header[14] = 0;
  header[19] = 0;
  header[30] = failureStatusFlags;
  header[31] = 0;
  header[32] = 0;
  header[33] = 1;
  return header;
}

function createPendingEvidence(descriptor, failureStatusFlags, target = null) {
  const evidence = target || new Uint32Array(descriptor.capacityEvidenceU32.length);
  evidence.set(descriptor.capacityEvidenceU32);
  for (const index of [6, 10, 14, 18, 22, 26, 31, 32]) evidence[index] = 0;
  evidence[39] = failureStatusFlags;
  evidence[40] = 1;
  evidence[41] = 0;
  return evidence;
}

function createCellHeader(descriptor, layout, failureStatusFlags, target = null) {
  const header = target || new Uint32Array(CELL_HEADER_STRIDE_U32);
  header[0] = RESIDENT_NEIGHBORHOOD_BUILDER_VERSION;
  header[1] = descriptor.generation;
  header[2] = descriptor.lease.tokenLow;
  header[3] = descriptor.lease.tokenHigh;
  header[4] = descriptor.positionValidity.positionEpoch;
  header[5] = descriptor.capacityEvidence.sourceCount;
  header[6] = 0;
  header[7] = 0;
  header[8] = descriptor.capacityEvidence.capacity.uniqueCellCount;
  header[9] = layout.physicalUniqueCellCapacity;
  header[10] = layout.cellKeyBaseU32;
  header[11] = layout.cellOffsetBaseU32;
  header[12] = layout.cellMemberBaseU32;
  header[13] = failureStatusFlags;
  header[14] = 1;
  header[15] = 0;
  return header;
}

function createBuilderParams({
  descriptor,
  positionStrideU32,
  positionOffsetU32,
  metadataLayout,
  cellLayout,
  candidateScratchCapacity,
  maxCellRadius,
  maxLevelSpan,
  dispatchX,
  maxComputeWorkgroupsPerDimension,
  hostAdmission,
  denseUniformChart = null,
  target = null
}) {
  const packed = descriptor.packedCsr;
  const capacity = descriptor.capacityEvidence.capacity;
  const data = target || new Uint32Array(BUILDER_PARAM_U32_CAPACITY);
  if (data.length !== BUILDER_PARAM_U32_CAPACITY
    || RESIDENT_NEIGHBORHOOD_BUILDER_PARAM_U32_LAYOUT.length !== BUILDER_PARAM_U32_CAPACITY) {
    throw new Error('resident neighborhood builder parameter layout drift');
  }
  data[0] = descriptor.capacityEvidence.sourceCount;
  data[1] = descriptor.generation;
  data[2] = descriptor.lease.tokenLow;
  data[3] = descriptor.lease.tokenHigh;
  data[4] = descriptor.positionValidity.positionEpoch;
  data[5] = positionStrideU32;
  data[6] = positionOffsetU32;
  data[7] = metadataLayout.chartBaseU32;
  data[8] = metadataLayout.supportClassBaseU32;
  data[9] = descriptor.supportClasses.length;
  data[10] = CANDIDATE_SCRATCH_STRIDE_U32;
  data[11] = metadataLayout.backingCapacityU32;
  data[12] = CELL_KEY_STRIDE_U32;
  data[13] = cellLayout.cellKeyBaseU32;
  data[14] = cellLayout.cellOffsetBaseU32;
  data[15] = cellLayout.cellMemberBaseU32;
  data[16] = cellLayout.physicalUniqueCellCapacity;
  data[17] = packed.regions.sourceOffsets.baseU32;
  data[18] = packed.regions.sourceSupportAssignments.baseU32;
  data[19] = packed.regions.candidates.baseU32;
  data[20] = ASSIGNMENT_STRIDE_U32;
  data[21] = CANDIDATE_STRIDE_U32;
  data[22] = candidateScratchCapacity;
  data[23] = capacity.uniqueCellCount;
  data[24] = capacity.cellOffsetCount;
  data[25] = capacity.cellMemberCount;
  data[26] = capacity.sourceOffsetCount;
  data[27] = capacity.sourceSupportAssignmentCount;
  data[28] = capacity.candidateCount;
  data[29] = descriptor.capacityEvidenceU32[33];
  data[30] = descriptor.capacityEvidenceU32[34];
  data[31] = EVIDENCE_STRIDE_U32;
  data[32] = float32Bits(descriptor.positionValidity.skinDistanceM, 'skinDistanceM');
  data[33] = descriptor.selfInclusionPolicy.includeConsumerMask;
  data[34] = descriptor.selfInclusionPolicy.excludeConsumerMask;
  data[35] = descriptor.consumerMask;
  data[36] = descriptor.capacityEvidence.statusFlags;
  data[37] = pendingStatusFlags(descriptor);
  data[38] = maxCellRadius;
  data[39] = maxLevelSpan;
  data[40] = cellLayout.backingCapacityU32;
  data[41] = packed.backingCapacityU32;
  data[42] = CELL_HEADER_STRIDE_U32;
  data[43] = PACKED_HEADER_STRIDE_U32;
  data[44] = SUPPORT_CLASS_STRIDE_U32;
  data[45] = CHART_LEVEL_STRIDE_U32;
  data[46] = RESIDENT_NEIGHBORHOOD_BUILDER_VERSION;
  data[47] = dispatchX;
  data[48] = hostAdmission ? 1 : 0;
  data[49] = maxComputeWorkgroupsPerDimension;
  data[50] = denseUniformChart?.gridCellCount ?? 0;
  data[51] = denseUniformChart?.dimensions?.[0] ?? 0;
  data[52] = denseUniformChart?.dimensions?.[1] ?? 0;
  data[53] = denseUniformChart?.dimensions?.[2] ?? 0;
  data[54] = denseUniformChart?.minCellOrderKeys?.[0] ?? 0;
  data[55] = denseUniformChart?.minCellOrderKeys?.[1] ?? 0;
  data[56] = denseUniformChart?.minCellOrderKeys?.[2] ?? 0;
  data[57] = denseUniformChart?.chartId ?? 0;
  data[58] = denseUniformChart?.levelOrderKey ?? 0;
  data[59] = denseUniformChart?.cellSizeBits ?? 0;
  data[60] = denseUniformChart?.originBits?.[0] ?? 0;
  data[61] = denseUniformChart?.originBits?.[1] ?? 0;
  data[62] = denseUniformChart?.originBits?.[2] ?? 0;
  data[63] = denseUniformChart?.admitted === true ? 1 : 0;
  return data;
}

function pipelineSet(device, label) {
  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: residentNeighborhoodBuilderWgsl
  });
  const create = (suffix, entryPoint) => device.createComputePipeline({
    label: `${label}-${suffix}`,
    layout: 'auto',
    compute: { module, entryPoint }
  });
  return {
    initializeConditional: create(
      'initialize-conditional-generation',
      'initialize_conditional_generation'
    ),
    copyCellOffsetsConditional: create(
      'copy-cell-offsets-conditional',
      'copy_cell_offsets_conditional'
    ),
    copyCellMembersConditional: create(
      'copy-cell-members-conditional',
      'copy_cell_members_conditional'
    ),
    copySourceOffsetsConditional: create(
      'copy-source-offsets-conditional',
      'copy_source_offsets_conditional'
    ),
    emitOccupancy: create('emit-occupancy', 'emit_occupancy_keys'),
    emitDenseUniformChart: create(
      'emit-dense-uniform-chart-keys',
      'emit_dense_uniform_chart_keys'
    ),
    assembleCellCsr: create('assemble-cell-csr', 'assemble_cell_csr'),
    assembleDenseUniformChartCellCsr: create(
      'assemble-dense-uniform-chart-cell-csr',
      'assemble_dense_uniform_chart_cell_csr'
    ),
    countCandidates: create('count-candidates', 'count_candidates'),
    countCandidatesDirect: create('count-candidates-direct', 'count_candidates_direct'),
    buildCandidatesDirectSegmentedMasked: create(
      'build-candidates-direct-segmented-masked',
      'build_candidates_direct_segmented_masked'
    ),
    finalizeAdmission: create('finalize-admission', 'finalize_admission'),
    fillCandidates: create('fill-candidates', 'fill_candidates'),
    fillCandidatesDirect: create('fill-candidates-direct', 'fill_candidates_direct')
  };
}

function bindGroup(device, pipeline, label, entries) {
  return device.createBindGroup({
    label,
    layout: pipeline.getBindGroupLayout(0),
    entries
  });
}

function retainedSlotBindGroup(
  slot,
  cacheKey,
  device,
  pipeline,
  label,
  entriesFactory,
  telemetry
) {
  const cached = slot?.conditionalBindGroups?.[cacheKey] ?? null;
  if (cached) {
    telemetry.reused += 1;
    return cached;
  }
  const created = bindGroup(device, pipeline, label, entriesFactory());
  telemetry.created += 1;
  if (slot) slot.conditionalBindGroups[cacheKey] = created;
  return created;
}

function timestampPassDescriptor(timestampProfiler, label, metadata = {}) {
  return timestampProfiler?.beginComputePassDescriptor
    ? timestampProfiler.beginComputePassDescriptor(label, metadata)
    : { label };
}

function encodePass(
  encoder,
  pipeline,
  group,
  dispatch,
  label,
  timestampProfiler = null,
  timestampMetadata = {},
  dispatchIndirectProvider = null,
  computePass = null
) {
  const pass = computePass || encoder.beginComputePass(
    timestampPassDescriptor(timestampProfiler, label, timestampMetadata)
  );
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, group);
  if (dispatchIndirectProvider) {
    if (!pass.dispatchWorkgroupsIndirect) {
      throw new TypeError('conditional resident rebuild requires dispatchWorkgroupsIndirect support');
    }
    const byteOffset = dispatchIndirectProvider.byteOffsetFor(dispatch);
    pass.dispatchWorkgroupsIndirect(dispatchIndirectProvider.buffer, byteOffset);
  } else {
    pass.dispatchWorkgroups(...dispatch);
  }
  if (!computePass) pass.end();
}

function encodeIndirectPass(
  encoder,
  pipeline,
  group,
  indirectBuffer,
  label,
  timestampProfiler = null,
  timestampMetadata = {},
  computePass = null
) {
  const pass = computePass || encoder.beginComputePass(
    timestampPassDescriptor(timestampProfiler, label, timestampMetadata)
  );
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, group);
  if (!pass.dispatchWorkgroupsIndirect) {
    throw new TypeError('candidate fill requires dispatchWorkgroupsIndirect support');
  }
  pass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
  if (!computePass) pass.end();
}

function resourceDescriptor(role, buffer, byteLength, details = {}) {
  return {
    role,
    buffer,
    byteOffset: 0,
    byteLength,
    retained: true,
    ...details
  };
}

function exactBindingResource(resource) {
  return {
    buffer: resource.buffer,
    offset: resource.byteOffset ?? 0,
    size: resource.byteLength
  };
}

/**
 * Creates a recorder only. The caller owns the command encoder, submission,
 * synchronization, and any fixed-evidence diagnostic readback.
 */
export function createResidentNeighborhoodGpuBuilder(device, {
  maxSourceCount,
  maxSupportClassCount = 256,
  maxCandidateScratchCount = Math.floor(UINT32_MAX / CANDIDATE_SCRATCH_STRIDE_U32),
  maxCellRadius = 64,
  maxLevelSpan = 33,
  reuseSingleArena = false,
  retainConstantScanParamsBuffers = false,
  retainedParamsSlotCount = WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_DEFAULT,
  retainedGenerationSlotCount = RESIDENT_NEIGHBORHOOD_GENERATION_CONTROL_SLOT_COUNT_DEFAULT,
  buildStrategy = 'radix',
  directSegmentedMasked = false,
  maxComputeWorkgroupsPerDimension: requestedMaxComputeWorkgroupsPerDimension = null,
  label = 'ulg-resident-neighborhood-builder'
} = {}) {
  assertDevice(device);
  const resolvedMaxSourceCount = positiveInteger(maxSourceCount, 'maxSourceCount', {
    max: UINT32_MAX - 1
  });
  const resolvedMaxSupportClassCount = positiveInteger(
    maxSupportClassCount,
    'maxSupportClassCount',
    { max: UINT32_MAX }
  );
  const resolvedMaxCandidateScratchCount = uint32(
    maxCandidateScratchCount,
    'maxCandidateScratchCount'
  );
  const resolvedMaxCellRadius = positiveInteger(maxCellRadius, 'maxCellRadius', {
    max: 1024
  });
  const resolvedMaxLevelSpan = positiveInteger(maxLevelSpan, 'maxLevelSpan', { max: 1024 });
  const resolvedRetainedParamsSlotCount = retainConstantScanParamsBuffers
    ? positiveInteger(
        retainedParamsSlotCount,
        'retainedParamsSlotCount',
        { max: WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX }
      )
    : 0;
  const resolvedRetainedGenerationSlotCount = reuseSingleArena
    ? positiveInteger(
        retainedGenerationSlotCount,
        'retainedGenerationSlotCount',
        { max: WEBGPU_RADIX_RETAINED_PARAMS_SLOT_COUNT_MAX }
      )
    : 0;
  const resolvedRequestedBuildStrategy = String(buildStrategy || 'auto').trim().toLowerCase();
  if (!Object.values(RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY)
    .includes(resolvedRequestedBuildStrategy)) {
    throw new RangeError('buildStrategy must be auto, direct, dense-grid, or radix');
  }
  const deviceMaxDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension',
    { max: UINT32_MAX }
  );
  const maxComputeWorkgroupsPerDimension = requestedMaxComputeWorkgroupsPerDimension == null
    ? deviceMaxDimension
    : Math.min(
        deviceMaxDimension,
        positiveInteger(
          requestedMaxComputeWorkgroupsPerDimension,
          'maxComputeWorkgroupsPerDimension',
          { max: UINT32_MAX }
        )
      );
  const generationControlArenaLayout = reuseSingleArena
    ? createGenerationControlArenaLayout({
        slotCount: resolvedRetainedGenerationSlotCount,
        minUniformBufferOffsetAlignment:
          device.limits?.minUniformBufferOffsetAlignment ?? UNIFORM_BYTES,
        minStorageBufferOffsetAlignment:
          device.limits?.minStorageBufferOffsetAlignment ?? UNIFORM_BYTES
      })
    : null;
  const pipelines = pipelineSet(device, label);
  const radixUnique = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: resolvedMaxSourceCount,
    maxKeyWordCount: RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS,
    maxComputeWorkgroupsPerDimension,
    label: `${label}-cell-radix-unique`,
    retainConstantScanParamsBuffers,
    retainedParamsSlotCount: resolvedRetainedParamsSlotCount
  });
  const candidateScan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: resolvedMaxSourceCount,
    maxComputeWorkgroupsPerDimension,
    label: `${label}-candidate-scan`,
    retainParamsBuffer: retainConstantScanParamsBuffers,
    fixedElementCount: resolvedMaxSourceCount
  });
  const activeBuilds = new Set();
  const records = new WeakMap();
  let generationParamsArenaBuffer = null;
  let generationDataArenaBuffer = null;
  let generationControlArenaEntries = [];
  const generationArenaSlots = [];
  if (generationControlArenaLayout) {
    const maxBufferSize = Number(device.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY);
    if (generationControlArenaLayout.paramsArenaByteLength > maxBufferSize
      || generationControlArenaLayout.dataArenaByteLength > maxBufferSize) {
      throw new RangeError(
        `generation control arena buffer exceeds maxBufferSize ${maxBufferSize}: `
          + `${generationControlArenaLayout.paramsArenaByteLength} params bytes, `
          + `${generationControlArenaLayout.dataArenaByteLength} data bytes`
      );
    }
    generationParamsArenaBuffer = tagWebGpuBufferDevice(device.createBuffer({
      label: `${label}-generation-params-arena`,
      size: generationControlArenaLayout.paramsArenaByteLength,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }), device);
    generationDataArenaBuffer = tagWebGpuBufferDevice(device.createBuffer({
      label: `${label}-generation-data-arena`,
      size: generationControlArenaLayout.dataArenaByteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    }), device);
    generationControlArenaEntries = [
      {
        role: 'resident-neighborhood-generation-params-arena',
        buffer: generationParamsArenaBuffer,
        byteLength: generationParamsArenaBuffer.size,
        slotCount: generationControlArenaLayout.slotCount,
        slotStrideByteLength: generationControlArenaLayout.paramsSlotStrideByteLength
      },
      {
        role: 'resident-neighborhood-generation-data-arena',
        buffer: generationDataArenaBuffer,
        byteLength: generationDataArenaBuffer.size,
        slotCount: generationControlArenaLayout.slotCount,
        slotStrideByteLength: generationControlArenaLayout.dataSlotStrideByteLength
      }
    ];
    for (let slotIndex = 0; slotIndex < generationControlArenaLayout.slotCount; slotIndex += 1) {
      const paramsSlotBaseByteOffset =
        slotIndex * generationControlArenaLayout.paramsSlotStrideByteLength;
      const dataSlotBaseByteOffset =
        slotIndex * generationControlArenaLayout.dataSlotStrideByteLength;
      generationArenaSlots.push({
        slotIndex,
        paramsSlotBaseByteOffset,
        dataSlotBaseByteOffset,
        inUse: false,
        bindGroupsByPosition: new WeakMap(),
        conditionalInitializeBindGroup: null,
        directConditionalSourceOffsetBindGroup: null,
        conditionalBindGroups: Object.create(null),
        paramsWords: new Uint32Array(BUILDER_PARAM_U32_CAPACITY),
        cellHeaderWords: new Uint32Array(CELL_HEADER_STRIDE_U32),
        packedHeaderWords: new Uint32Array(PACKED_HEADER_STRIDE_U32),
        capacityEvidenceWords: new Uint32Array(EVIDENCE_STRIDE_U32),
        paramsBuffer: generationParamsArenaBuffer,
        paramsByteOffset: paramsSlotBaseByteOffset + generationControlArenaLayout.paramsByteOffset,
        cellHeaderUploadBuffer: generationDataArenaBuffer,
        cellHeaderByteOffset:
          dataSlotBaseByteOffset + generationControlArenaLayout.cellHeaderByteOffset,
        packedHeaderUploadBuffer: generationDataArenaBuffer,
        packedHeaderByteOffset:
          dataSlotBaseByteOffset + generationControlArenaLayout.packedHeaderByteOffset,
        capacityEvidenceBuffer: generationDataArenaBuffer,
        capacityEvidenceByteOffset:
          dataSlotBaseByteOffset + generationControlArenaLayout.capacityEvidenceByteOffset
      });
    }
  }
  let sharedArena = null;
  let destroyed = false;

  function builderArenaSignature({ descriptor, metadataLayout, cellLayout, candidateScratchCapacity }) {
    return [
      descriptor.capacityEvidence.sourceCount,
      descriptor.supportClasses.length,
      descriptor.packedCsr.backingBufferByteLength,
      candidateScratchCapacity,
      metadataLayout.byteLength,
      cellLayout.byteLength
    ].join(':');
  }

  function createBuilderArena({ descriptor, metadataLayout, cellLayout, candidateScratchCapacity }) {
    const entries = [];
    const allocate = (role, byteLength, extraUsage = 0) => {
      const buffer = createStorageBuffer(device, `${label}-${role}`, byteLength, extraUsage);
      entries.push({ role: `resident-neighborhood-arena-${role}`, buffer, byteLength: buffer.size });
      return buffer;
    };
    return {
      signature: builderArenaSignature({
        descriptor,
        metadataLayout,
        cellLayout,
        candidateScratchCapacity
      }),
      entries,
      occupancyKeyBuffer: allocate(
        'occupancy-keys',
        shaderWordCount(
          checkedMultiply(
            descriptor.capacityEvidence.sourceCount,
            CELL_KEY_STRIDE_U32,
            'occupancy-key words'
          ),
          'occupancy-key words'
        ) * U32_BYTES
      ),
      metadataBuffer: allocate('metadata', metadataLayout.byteLength),
      cellCsrBuffer: allocate('cell-csr', cellLayout.byteLength),
      packedCandidateCsrBuffer: allocate(
        'packed-source-candidate-csr',
        descriptor.packedCsr.backingBufferByteLength
      ),
      candidateScratchBuffer: allocate(
        'candidate-staging',
        shaderWordCount(
          checkedMultiply(
            candidateScratchCapacity,
            CANDIDATE_SCRATCH_STRIDE_U32,
            'candidate-staging words'
          ),
          'candidate-staging words'
        ) * U32_BYTES
      ),
      candidateCountsBuffer: allocate(
        'candidate-counts',
        descriptor.capacityEvidence.sourceCount * U32_BYTES
      ),
      scannedSourceOffsetsBuffer: allocate(
        'scanned-source-offsets',
        Math.max(1, descriptor.capacityEvidence.sourceCount) * U32_BYTES
      ),
      buildStatusBuffer: allocate('build-status', BUILD_STATUS_U32_COUNT * U32_BYTES),
      candidateDispatchIndirectBuffer: allocate(
        'candidate-dispatch-indirect',
        3 * U32_BYTES,
        GPU_BUFFER_USAGE.INDIRECT
      )
    };
  }

  function destroyBuilderArena(arena) {
    if (!arena) return;
    for (const entry of arena.entries) entry.buffer.destroy?.();
  }

  function acquireGenerationArenaSlot() {
    const available = generationArenaSlots.find((slot) => !slot.inUse);
    if (available) {
      available.inUse = true;
      return available;
    }
    const error = new Error(
      `resident neighborhood generation control arena exhausted `
        + `(${generationControlArenaLayout?.slotCount ?? 0} unresolved generations)`
    );
    error.code = 'ERR_RESIDENT_NEIGHBORHOOD_GENERATION_CONTROL_ARENA_FULL';
    error.slotCount = generationControlArenaLayout?.slotCount ?? 0;
    throw error;
  }

  function releaseGenerationArenaSlot(slot) {
    if (!slot) return;
    slot.inUse = false;
  }

  function destroyGenerationArenaSlots() {
    generationParamsArenaBuffer?.destroy?.();
    generationDataArenaBuffer?.destroy?.();
    generationParamsArenaBuffer = null;
    generationDataArenaBuffer = null;
    generationControlArenaEntries = [];
    generationArenaSlots.length = 0;
  }

  function prepare({
    descriptor,
    positionBuffer,
    positionStrideU32 = 4,
    positionOffsetU32 = 0,
    chartLevelBuffer,
    chartLevelByteOffset = 0,
    supportClassBuffer,
    supportClassByteOffset = 0,
    sourceSupportAssignmentBuffer,
    sourceSupportAssignmentByteOffset = 0,
    denseUniformChart = null,
    sourceMetadataMode = 'uniform-gpu-expanded',
    sourceMetadataDirectGpuWrite = false,
    generation = descriptor?.generation,
    positionEpoch = descriptor?.positionValidity?.positionEpoch,
    maxDisplacementM = descriptor?.positionValidity?.maxDisplacementM,
    leaseId = descriptor?.lease?.leaseId,
    laneId = descriptor?.lease?.laneId,
    stateKey = descriptor?.lease?.stateKey,
    sourceFamily = descriptor?.lease?.sourceFamily,
    leaseTokenLow = descriptor?.lease?.tokenLow,
    leaseTokenHigh = descriptor?.lease?.tokenHigh
  } = {}) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (descriptor?.schema !== ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA) {
      throw new TypeError('descriptor must be a resident-neighborhood descriptor');
    }
    const sourceCount = descriptor.capacityEvidence.sourceCount;
    const supportClassCount = descriptor.supportClasses.length;
    if (sourceCount > resolvedMaxSourceCount) {
      throw new RangeError(`sourceCount ${sourceCount} exceeds maxSourceCount`);
    }
    if (supportClassCount > resolvedMaxSupportClassCount) {
      throw new RangeError(`supportClassCount ${supportClassCount} exceeds builder capacity`);
    }
    const resolvedDenseUniformChart = normalizeResidentNeighborhoodDenseUniformChart(
      denseUniformChart,
      {
        sourceCount,
        maxCellRadius: resolvedMaxCellRadius,
        sourceMetadataMode,
        supportClasses: descriptor.supportClasses
      }
    );
    const strategyPlan = planResidentNeighborhoodGpuBuilderStrategy({
      sourceCount,
      requestedStrategy: resolvedRequestedBuildStrategy,
      denseUniformChart: resolvedDenseUniformChart,
      maxComputeWorkgroupsPerDimension
    });
    const resolvedPositionStrideU32 = positiveInteger(
      positionStrideU32,
      'positionStrideU32',
      { max: UINT32_MAX }
    );
    const resolvedPositionOffsetU32 = uint32(positionOffsetU32, 'positionOffsetU32');
    if (resolvedPositionOffsetU32 + 3 > resolvedPositionStrideU32) {
      throw new RangeError('positionOffsetU32 must leave three position words inside each row');
    }
    const positionRequiredU32 = sourceCount === 0
      ? 0
      : checkedAdd(
          checkedMultiply(sourceCount - 1, resolvedPositionStrideU32, 'position row words'),
          resolvedPositionOffsetU32 + 3,
          'position input words'
        );
    shaderWordCount(positionRequiredU32, 'position input words');
    const inputRanges = {
      positions: bufferRange(
        positionBuffer,
        0,
        positionRequiredU32 * U32_BYTES,
        'positionBuffer'
      ),
      chartLevels: bufferRange(
        chartLevelBuffer,
        chartLevelByteOffset,
        sourceCount * CHART_LEVEL_STRIDE_U32 * U32_BYTES,
        'chartLevelBuffer'
      ),
      supportClasses: bufferRange(
        supportClassBuffer,
        supportClassByteOffset,
        supportClassCount * SUPPORT_CLASS_STRIDE_U32 * U32_BYTES,
        'supportClassBuffer'
      ),
      sourceSupportAssignments: bufferRange(
        sourceSupportAssignmentBuffer,
        sourceSupportAssignmentByteOffset,
        sourceCount * ASSIGNMENT_STRIDE_U32 * U32_BYTES,
        'sourceSupportAssignmentBuffer'
      )
    };
    checkStorageByteLength(
      device,
      alignedBytes(inputRanges.positions.byteLength),
      'positionBuffer binding'
    );
    const leaseValidation = validateResidentNeighborhoodLease(descriptor, {
      generation,
      positionEpoch,
      maxDisplacementM,
      leaseId,
      laneId,
      stateKey,
      sourceFamily,
      leaseTokenLow,
      leaseTokenHigh
    });
    const searchReasonCodes = hostSearchReasonCodes(descriptor, {
      maxCellRadius: resolvedMaxCellRadius,
      maxLevelSpan: resolvedMaxLevelSpan
    });
    const candidateScratchCapacity = descriptor.capacityEvidence.capacity.candidateCount;
    const directSegmentedCandidateCount = checkedMultiply(
      sourceCount,
      sourceCount,
      'direct segmented candidate count'
    );
    const useDirectSegmentedMasked = Boolean(
      directSegmentedMasked
      && strategyPlan.strategy === 'direct'
      && sourceCount > 0
      && sourceCount <= 65535
      && candidateScratchCapacity >= directSegmentedCandidateCount
      && descriptor.supportClasses.every(
        (supportClass) => supportClass.maxCandidatesPerSource >= sourceCount
      )
    );
    const stagingReasonCodes = candidateScratchCapacity > resolvedMaxCandidateScratchCount
      ? ['candidate-staging-capacity-exceeds-builder-bound']
      : [];
    const hostReasonCodes = [
      ...leaseValidation.mismatches.map((value) => `lease-${value}-mismatch`),
      ...(leaseValidation.positionValid ? [] : ['position-skin-envelope-exhausted']),
      ...descriptor.capacityEvidence.reasonCodes,
      ...searchReasonCodes,
      ...stagingReasonCodes
    ];
    const hostAdmission = leaseValidation.consumerDispatchAllowed
      && descriptor.admission.consumerDispatchAllowed
      && hostReasonCodes.length === 0;
    const metadataLayout = createMetadataLayout(sourceCount, supportClassCount);
    const cellLayout = createCellCsrLayout(sourceCount);
    const dispatch = dispatchShape(sourceCount, maxComputeWorkgroupsPerDimension);
    const candidateDispatch = dispatchShape(
      candidateScratchCapacity,
      maxComputeWorkgroupsPerDimension
    );
    const failureStatusFlags = pendingStatusFlags(descriptor);
    const allocatedStagingCapacity = hostAdmission && !useDirectSegmentedMasked
      ? candidateScratchCapacity
      : 0;
    const ownedEntries = [];
    const allocate = (role, byteLength, extraUsage = 0) => {
      const buffer = createStorageBuffer(device, `${label}-${role}`, byteLength, extraUsage);
      ownedEntries.push({ role, buffer, byteLength: buffer.size });
      return buffer;
    };
    let arena = null;
    if (reuseSingleArena) {
      const nextSignature = builderArenaSignature({
        descriptor,
        metadataLayout,
        cellLayout,
        candidateScratchCapacity: allocatedStagingCapacity
      });
      if (sharedArena && sharedArena.signature !== nextSignature) {
        throw new RangeError('single resident-neighborhood arena requires stable structural capacity');
      }
      if (!sharedArena) {
        sharedArena = createBuilderArena({
          descriptor,
          metadataLayout,
          cellLayout,
          candidateScratchCapacity: allocatedStagingCapacity
        });
      }
      arena = sharedArena;
    }
    const occupancyKeyBuffer = arena?.occupancyKeyBuffer || allocate(
      'occupancy-keys',
      shaderWordCount(
        checkedMultiply(sourceCount, CELL_KEY_STRIDE_U32, 'occupancy-key words'),
        'occupancy-key words'
      ) * U32_BYTES
    );
    const metadataBuffer = arena?.metadataBuffer || allocate('metadata', metadataLayout.byteLength);
    const cellCsrBuffer = arena?.cellCsrBuffer || allocate('cell-csr', cellLayout.byteLength);
    const packedCandidateCsrBuffer = arena?.packedCandidateCsrBuffer || allocate(
      'packed-source-candidate-csr',
      descriptor.packedCsr.backingBufferByteLength
    );
    const candidateScratchBuffer = arena?.candidateScratchBuffer || allocate(
      'candidate-staging',
      shaderWordCount(
        checkedMultiply(
          allocatedStagingCapacity,
          CANDIDATE_SCRATCH_STRIDE_U32,
          'candidate-staging words'
        ),
        'candidate-staging words'
      ) * U32_BYTES
    );
    const candidateCountsBuffer = arena?.candidateCountsBuffer
      || allocate('candidate-counts', sourceCount * U32_BYTES);
    const scannedSourceOffsetsBuffer = arena?.scannedSourceOffsetsBuffer || allocate(
      'scanned-source-offsets',
      Math.max(1, sourceCount) * U32_BYTES
    );
    const buildStatusBuffer = arena?.buildStatusBuffer || allocate(
      'build-status',
      BUILD_STATUS_U32_COUNT * U32_BYTES
    );
    const generationArenaSlot = reuseSingleArena ? acquireGenerationArenaSlot() : null;
    try {
    const capacityEvidenceBuffer = generationArenaSlot?.capacityEvidenceBuffer || allocate(
      'capacity-evidence',
      EVIDENCE_STRIDE_U32 * U32_BYTES
    );
    const candidateDispatchIndirectBuffer = arena?.candidateDispatchIndirectBuffer || allocate(
      'candidate-dispatch-indirect',
      3 * U32_BYTES,
      GPU_BUFFER_USAGE.INDIRECT
    );
    const paramsBuffer = generationArenaSlot?.paramsBuffer || tagWebGpuBufferDevice(
      device.createBuffer({
        label: `${label}-params`,
        size: UNIFORM_BYTES,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      }),
      device
    );
    if (!generationArenaSlot) {
      ownedEntries.push({ role: 'params', buffer: paramsBuffer, byteLength: UNIFORM_BYTES });
    }
    const paramsByteOffset = generationArenaSlot?.paramsByteOffset ?? 0;
    const capacityEvidenceByteOffset = generationArenaSlot?.capacityEvidenceByteOffset ?? 0;

    const cellHeaderUploadBuffer = reuseSingleArena
      ? generationArenaSlot.cellHeaderUploadBuffer
      : null;
    const cellHeaderByteOffset = generationArenaSlot?.cellHeaderByteOffset ?? 0;
    const packedHeaderUploadBuffer = reuseSingleArena
      ? generationArenaSlot.packedHeaderUploadBuffer
      : null;
    const packedHeaderByteOffset = generationArenaSlot?.packedHeaderByteOffset ?? 0;

    const params = createBuilderParams({
      descriptor,
      positionStrideU32: resolvedPositionStrideU32,
      positionOffsetU32: resolvedPositionOffsetU32,
      metadataLayout,
      cellLayout,
      candidateScratchCapacity: allocatedStagingCapacity,
      maxCellRadius: resolvedMaxCellRadius,
      maxLevelSpan: resolvedMaxLevelSpan,
      dispatchX: dispatch[0],
      maxComputeWorkgroupsPerDimension,
      hostAdmission,
      denseUniformChart: strategyPlan.strategy
          === RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DENSE_UNIFORM_CHART
        ? resolvedDenseUniformChart
        : null,
      target: generationArenaSlot?.paramsWords ?? null
    });
    device.queue.writeBuffer(paramsBuffer, paramsByteOffset, params);
    device.queue.writeBuffer(
      cellHeaderUploadBuffer || cellCsrBuffer,
      cellHeaderByteOffset,
      createCellHeader(
        descriptor,
        cellLayout,
        failureStatusFlags,
        generationArenaSlot?.cellHeaderWords ?? null
      )
    );
    device.queue.writeBuffer(
      packedHeaderUploadBuffer || packedCandidateCsrBuffer,
      packedHeaderByteOffset,
      createPendingPackedHeader(
        descriptor,
        failureStatusFlags,
        generationArenaSlot?.packedHeaderWords ?? null
      )
    );
    device.queue.writeBuffer(
      capacityEvidenceBuffer,
      capacityEvidenceByteOffset,
      createPendingEvidence(
        descriptor,
        failureStatusFlags,
        generationArenaSlot?.capacityEvidenceWords ?? null
      )
    );

    const uniformEntry = {
      binding: 11,
      resource: { buffer: paramsBuffer, offset: paramsByteOffset, size: UNIFORM_BYTES }
    };
    const capacityEvidenceEntry = {
      binding: 10,
      resource: {
        buffer: capacityEvidenceBuffer,
        offset: capacityEvidenceByteOffset,
        size: EVIDENCE_STRIDE_U32 * U32_BYTES
      }
    };
    const positionBindingCacheKey = [
      resolvedPositionStrideU32,
      resolvedPositionOffsetU32,
      alignedBytes(inputRanges.positions.byteLength)
    ].join(':');
    const positionBindGroupCache = generationArenaSlot?.bindGroupsByPosition.get(positionBuffer)
      || null;
    const cachedBindGroups = positionBindGroupCache?.get(positionBindingCacheKey) || null;
    const indexedStrategy = strategyPlan.strategy !== RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DIRECT;
    const occupancyPipeline = strategyPlan.strategy
        === RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DENSE_UNIFORM_CHART
      ? pipelines.emitDenseUniformChart
      : pipelines.emitOccupancy;
    const occupancyBindGroup = cachedBindGroups?.occupancy ?? (indexedStrategy
      ? bindGroup(
          device,
          occupancyPipeline,
          `${label}-emit-occupancy-bind-group`,
          [
            {
              binding: 0,
              resource: {
                buffer: positionBuffer,
                size: alignedBytes(inputRanges.positions.byteLength)
              }
            },
            { binding: 1, resource: { buffer: metadataBuffer } },
            { binding: 2, resource: { buffer: occupancyKeyBuffer } },
            { binding: 8, resource: { buffer: buildStatusBuffer } },
            uniformEntry
          ]
        )
      : null);
    const countBindGroup = cachedBindGroups?.count ?? (indexedStrategy
      ? bindGroup(
          device,
          pipelines.countCandidates,
          `${label}-count-candidates-bind-group`,
          [
            {
              binding: 0,
              resource: {
                buffer: positionBuffer,
                size: alignedBytes(inputRanges.positions.byteLength)
              }
            },
            { binding: 1, resource: { buffer: metadataBuffer } },
            { binding: 3, resource: { buffer: cellCsrBuffer } },
            { binding: 4, resource: { buffer: packedCandidateCsrBuffer } },
            { binding: 5, resource: { buffer: candidateScratchBuffer } },
            { binding: 6, resource: { buffer: candidateCountsBuffer } },
            { binding: 8, resource: { buffer: buildStatusBuffer } },
            uniformEntry
          ]
        )
      : null);
    const finalizeBindGroup = cachedBindGroups?.finalize ?? (!useDirectSegmentedMasked
      ? bindGroup(
          device,
          pipelines.finalizeAdmission,
          `${label}-finalize-admission-bind-group`,
          [
            { binding: 3, resource: { buffer: cellCsrBuffer } },
            { binding: 4, resource: { buffer: packedCandidateCsrBuffer } },
            { binding: 6, resource: { buffer: candidateCountsBuffer } },
            { binding: 7, resource: { buffer: scannedSourceOffsetsBuffer } },
            { binding: 8, resource: { buffer: buildStatusBuffer } },
            capacityEvidenceEntry,
            { binding: 13, resource: { buffer: candidateDispatchIndirectBuffer } },
            uniformEntry
          ]
        )
      : null);
    const fillBindGroup = cachedBindGroups?.fill ?? (indexedStrategy
      ? bindGroup(
          device,
          pipelines.fillCandidates,
          `${label}-fill-candidates-bind-group`,
          [
            { binding: 4, resource: { buffer: packedCandidateCsrBuffer } },
            { binding: 5, resource: { buffer: candidateScratchBuffer } },
            { binding: 8, resource: { buffer: buildStatusBuffer } },
            capacityEvidenceEntry,
            uniformEntry
          ]
        )
      : null);
    const directCountBindGroup = cachedBindGroups?.directCount ?? (
      strategyPlan.strategy === 'direct' && !useDirectSegmentedMasked
      ? bindGroup(
          device,
          pipelines.countCandidatesDirect,
          `${label}-count-candidates-direct-bind-group`,
          [
            {
              binding: 0,
              resource: {
                buffer: positionBuffer,
                size: alignedBytes(inputRanges.positions.byteLength)
              }
            },
            { binding: 1, resource: { buffer: metadataBuffer } },
            { binding: 4, resource: { buffer: packedCandidateCsrBuffer } },
            { binding: 6, resource: { buffer: candidateCountsBuffer } },
            { binding: 8, resource: { buffer: buildStatusBuffer } },
            uniformEntry
          ]
        )
      : null);
    const directFillBindGroup = cachedBindGroups?.directFill ?? (
      strategyPlan.strategy === 'direct' && !useDirectSegmentedMasked
      ? bindGroup(
          device,
          pipelines.fillCandidatesDirect,
          `${label}-fill-candidates-direct-bind-group`,
          [
            {
              binding: 0,
              resource: {
                buffer: positionBuffer,
                size: alignedBytes(inputRanges.positions.byteLength)
              }
            },
            { binding: 1, resource: { buffer: metadataBuffer } },
            { binding: 4, resource: { buffer: packedCandidateCsrBuffer } },
            { binding: 8, resource: { buffer: buildStatusBuffer } },
            capacityEvidenceEntry,
            uniformEntry
          ]
        )
      : null);
    const directSegmentedMaskedBindGroup = cachedBindGroups?.directSegmentedMasked
      ?? (useDirectSegmentedMasked
        ? bindGroup(
            device,
            pipelines.buildCandidatesDirectSegmentedMasked,
            `${label}-build-candidates-direct-segmented-masked-bind-group`,
            [
              {
                binding: 0,
                resource: {
                  buffer: positionBuffer,
                  size: alignedBytes(inputRanges.positions.byteLength)
                }
              },
              { binding: 1, resource: { buffer: metadataBuffer } },
              { binding: 3, resource: { buffer: cellCsrBuffer } },
              { binding: 4, resource: { buffer: packedCandidateCsrBuffer } },
              { binding: 6, resource: { buffer: candidateCountsBuffer } },
              { binding: 8, resource: { buffer: buildStatusBuffer } },
              capacityEvidenceEntry,
              uniformEntry,
              { binding: 13, resource: { buffer: candidateDispatchIndirectBuffer } }
            ]
          )
        : null);
    const preparedBindGroups = {
      occupancy: occupancyBindGroup,
      count: countBindGroup,
      finalize: finalizeBindGroup,
      fill: fillBindGroup,
      directCount: directCountBindGroup,
      directFill: directFillBindGroup,
      directSegmentedMasked: directSegmentedMaskedBindGroup
    };
    const preparedBindGroupCount = Object.values(preparedBindGroups).filter(Boolean).length;
    if (generationArenaSlot && !cachedBindGroups) {
      const cache = positionBindGroupCache || new Map();
      cache.set(positionBindingCacheKey, preparedBindGroups);
      if (!positionBindGroupCache) {
        generationArenaSlot.bindGroupsByPosition.set(positionBuffer, cache);
      }
    }

    const prepared = {
      schema: ULG_RESIDENT_NEIGHBORHOOD_GPU_BUILDER_SCHEMA,
      status: hostAdmission
        ? 'resident-neighborhood-gpu-build-prepared'
        : 'resident-neighborhood-gpu-build-host-admission-fail-closed',
      descriptor,
      generation: descriptor.generation,
      positionEpoch: descriptor.positionValidity.positionEpoch,
      lease: { ...descriptor.lease },
      sourceCount,
      strategyPlan,
      denseUniformChart: strategyPlan.strategy
          === RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DENSE_UNIFORM_CHART
        ? resolvedDenseUniformChart
        : null,
      directSegmentedMasked: useDirectSegmentedMasked,
      supportClassCount,
      hostAdmission,
      hostReasonCodes,
      leaseValidation,
      dispatch,
      candidateDispatchCapacityBound: candidateDispatch,
      submissionOwnership: 'caller',
      commandEncoderOwnership: 'caller',
      schedulerCreated: false,
      queueSubmitPerformed: false,
      mapPerformed: false,
      readbackPerformed: false,
      stateMutationAllowed: false,
      sourceMetadataDirectGpuWrite: sourceMetadataDirectGpuWrite === true,
      arenaPolicy: reuseSingleArena
        ? 'single-shared-arena-command-ordered-reuse'
        : 'generation-owned-arena',
      resources: {
        inputs: {
          positions: {
            ...inputRanges.positions,
            rowStrideU32: resolvedPositionStrideU32,
            positionOffsetU32: resolvedPositionOffsetU32,
            ownership: 'caller-retained'
          },
          chartLevels: {
            ...inputRanges.chartLevels,
            rowCount: sourceCount,
            rowStrideU32: CHART_LEVEL_STRIDE_U32,
            ownership: 'caller-retained'
          },
          supportClasses: {
            ...inputRanges.supportClasses,
            rowCount: supportClassCount,
            rowStrideU32: SUPPORT_CLASS_STRIDE_U32,
            ownership: 'caller-retained'
          },
          sourceSupportAssignments: {
            ...inputRanges.sourceSupportAssignments,
            rowCount: sourceCount,
            rowStrideU32: ASSIGNMENT_STRIDE_U32,
            ownership: 'caller-retained'
          }
        },
        outputs: {
          occupancyKeys: resourceDescriptor(
            'occupancy-keys',
            occupancyKeyBuffer,
            occupancyKeyBuffer.size,
            {
              rowCount: sourceCount,
              rowStrideU32: CELL_KEY_STRIDE_U32,
              structuralWordCount: strategyPlan.strategy
                  === RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DENSE_UNIFORM_CHART
                ? 1
                : RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS,
              canonicalCellStructuralWordCount:
                RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS,
              deterministicMemberOrder: strategyPlan.strategy
                  === RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DENSE_UNIFORM_CHART
                ? 'stable-source-index'
                : 'stable-structural-key-source-index'
            }
          ),
          cellCsr: resourceDescriptor('cell-csr', cellCsrBuffer, cellCsrBuffer.size, {
            singleStorageBinding: true,
            headerLayout: [...RESIDENT_NEIGHBORHOOD_CELL_CSR_HEADER_U32_LAYOUT],
            regions: {
              header: { baseU32: 0, count: CELL_HEADER_STRIDE_U32, strideU32: 1 },
              uniqueCellKeys: {
                baseU32: cellLayout.cellKeyBaseU32,
                physicalCapacity: cellLayout.physicalUniqueCellCapacity,
                logicalCapacity: descriptor.capacityEvidence.capacity.uniqueCellCount,
                strideU32: CELL_KEY_STRIDE_U32
              },
              cellOffsets: {
                baseU32: cellLayout.cellOffsetBaseU32,
                physicalCapacity: cellLayout.physicalCellOffsetCapacity,
                logicalCapacity: descriptor.capacityEvidence.capacity.cellOffsetCount,
                strideU32: 1
              },
              memberIndices: {
                baseU32: cellLayout.cellMemberBaseU32,
                physicalCapacity: cellLayout.physicalCellMemberCapacity,
                logicalCapacity: descriptor.capacityEvidence.capacity.cellMemberCount,
                strideU32: 1
              }
            }
          }),
          sourceCandidateCsr: resourceDescriptor(
            'packed-source-candidate-csr',
            packedCandidateCsrBuffer,
            packedCandidateCsrBuffer.size,
            {
              singleStorageBinding: true,
              shaderStorageType: 'array<u32>',
              headerLayout: [...RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_U32_LAYOUT],
              regions: descriptor.packedCsr.regions
            }
          ),
          capacityEvidence: resourceDescriptor(
            'capacity-evidence',
            capacityEvidenceBuffer,
            EVIDENCE_STRIDE_U32 * U32_BYTES,
            {
              byteOffset: capacityEvidenceByteOffset,
              fixedSize: true,
              rowLayout: [...RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT],
              diagnosticReadbackPolicy: 'optional-fixed-size-only'
            }
          ),
          candidateDispatchIndirect: resourceDescriptor(
            'candidate-dispatch-indirect',
            candidateDispatchIndirectBuffer,
            candidateDispatchIndirectBuffer.size,
            {
              rowLayout: ['workgroupCountX:u32', 'workgroupCountY:u32', 'workgroupCountZ:u32'],
              dispatchMode: 'dispatchWorkgroupsIndirect'
            }
          )
        },
        scratch: {
          metadata: resourceDescriptor('metadata', metadataBuffer, metadataBuffer.size, {
            layout: metadataLayout
          }),
          candidateStaging: resourceDescriptor(
            'candidate-staging',
            candidateScratchBuffer,
            candidateScratchBuffer.size,
            {
              rowCapacity: allocatedStagingCapacity,
              rowStrideU32: CANDIDATE_SCRATCH_STRIDE_U32,
              rowLayout: ['sourceIndex:u32', 'localRank:u32', 'targetIndex:u32', 'matchedConsumerMask:u32'],
              distanceEvaluatedDuringCountOnly: !useDirectSegmentedMasked,
              usedBySelectedTopology: !useDirectSegmentedMasked
            }
          ),
          candidateCounts: resourceDescriptor(
            'candidate-counts',
            candidateCountsBuffer,
            candidateCountsBuffer.size
          ),
          scannedSourceOffsets: resourceDescriptor(
            'scanned-source-offsets',
            scannedSourceOffsetsBuffer,
            scannedSourceOffsetsBuffer.size
          ),
          buildStatus: resourceDescriptor(
            'build-status',
            buildStatusBuffer,
            buildStatusBuffer.size
          ),
          params: resourceDescriptor('params', paramsBuffer, UNIFORM_BYTES, {
            byteOffset: paramsByteOffset
          })
        }
      },
      retainedBuffers: {
        occupancyKeyBuffer,
        cellCsrBuffer,
        packedCandidateCsrBuffer,
        capacityEvidenceBuffer,
        metadataBuffer,
        candidateScratchBuffer,
        candidateCountsBuffer,
        scannedSourceOffsetsBuffer,
        buildStatusBuffer,
        candidateDispatchIndirectBuffer,
        paramsBuffer,
        paramsByteOffset,
        capacityEvidenceByteOffset
      },
      _bindGroups: preparedBindGroups,
      _bindGroupCacheHit: Boolean(cachedBindGroups),
      _bindGroupCreationCount: cachedBindGroups ? 0 : preparedBindGroupCount,
      _bindGroupReuseCount: cachedBindGroups ? preparedBindGroupCount : 0,
      _controlTemplateResidency: generationArenaSlot
        ? 'retained-per-generation-slot'
        : 'transient-per-generation',
      _perGenerationControlArrayAllocationCount: generationArenaSlot ? 0 : 4,
      _headerUploads: reuseSingleArena
        ? {
            cellHeaderUploadBuffer,
            cellHeaderByteOffset,
            packedHeaderUploadBuffer,
            packedHeaderByteOffset
          }
        : null
    };
    const record = {
      prepared,
      ownedEntries,
      generationArenaSlot,
      preludeEncoded: false,
      preludeConditionalGeneration: null,
      released: false,
      encodings: []
    };
    records.set(prepared, record);
    activeBuilds.add(record);
    return prepared;
    } catch (error) {
      for (const entry of ownedEntries) entry.buffer.destroy?.();
      releaseGenerationArenaSlot(generationArenaSlot);
      throw error;
    }
  }

  function encodePreparedPrelude(encoder, prepared, {
    conditionalGeneration = false
  } = {}) {
    assertEncoder(encoder);
    const record = records.get(prepared);
    if (!record || record.released) throw new TypeError('prepared build is not active');
    if (record.preludeEncoded) {
      if (record.preludeConditionalGeneration !== conditionalGeneration) {
        throw new Error('prepared build prelude conditional mode changed after encoding');
      }
      return false;
    }
    const { inputs, outputs, scratch } = prepared.resources;
    const packedRegions = outputs.sourceCandidateCsr.regions;
    if (prepared._headerUploads && !conditionalGeneration) {
      encoder.copyBufferToBuffer(
        prepared._headerUploads.cellHeaderUploadBuffer,
        prepared._headerUploads.cellHeaderByteOffset,
        outputs.cellCsr.buffer,
        0,
        CELL_HEADER_STRIDE_U32 * U32_BYTES
      );
      encoder.copyBufferToBuffer(
        prepared._headerUploads.packedHeaderUploadBuffer,
        prepared._headerUploads.packedHeaderByteOffset,
        outputs.sourceCandidateCsr.buffer,
        0,
        PACKED_HEADER_STRIDE_U32 * U32_BYTES
      );
    }
    encoder.clearBuffer(scratch.buildStatus.buffer);
    encoder.clearBuffer(scratch.candidateCounts.buffer);
    encoder.clearBuffer(scratch.scannedSourceOffsets.buffer);
    encoder.clearBuffer(outputs.candidateDispatchIndirect.buffer);
    if (!conditionalGeneration
      && outputs.cellCsr.byteLength > CELL_HEADER_STRIDE_U32 * U32_BYTES) {
      encoder.clearBuffer(
        outputs.cellCsr.buffer,
        CELL_HEADER_STRIDE_U32 * U32_BYTES,
        outputs.cellCsr.byteLength - CELL_HEADER_STRIDE_U32 * U32_BYTES
      );
    }
    if (!conditionalGeneration
      && outputs.sourceCandidateCsr.byteLength > packedRegions.sourceOffsets.baseU32 * U32_BYTES) {
      encoder.clearBuffer(
        outputs.sourceCandidateCsr.buffer,
        packedRegions.sourceOffsets.baseU32 * U32_BYTES,
        outputs.sourceCandidateCsr.byteLength - packedRegions.sourceOffsets.baseU32 * U32_BYTES
      );
    }
    if (!prepared.sourceMetadataDirectGpuWrite && inputs.chartLevels.byteLength > 0) {
      encoder.copyBufferToBuffer(
        inputs.chartLevels.buffer,
        inputs.chartLevels.byteOffset,
        scratch.metadata.buffer,
        scratch.metadata.layout.chartBaseU32 * U32_BYTES,
        inputs.chartLevels.byteLength
      );
    }
    if (inputs.supportClasses.byteLength > 0) {
      encoder.copyBufferToBuffer(
        inputs.supportClasses.buffer,
        inputs.supportClasses.byteOffset,
        scratch.metadata.buffer,
        scratch.metadata.layout.supportClassBaseU32 * U32_BYTES,
        inputs.supportClasses.byteLength
      );
    }
    if (!prepared.sourceMetadataDirectGpuWrite
      && !conditionalGeneration
      && inputs.sourceSupportAssignments.byteLength > 0) {
      encoder.copyBufferToBuffer(
        inputs.sourceSupportAssignments.buffer,
        inputs.sourceSupportAssignments.byteOffset,
        outputs.sourceCandidateCsr.buffer,
        packedRegions.sourceSupportAssignments.baseU32 * U32_BYTES,
        inputs.sourceSupportAssignments.byteLength
      );
    }
    record.preludeEncoded = true;
    record.preludeConditionalGeneration = conditionalGeneration;
    return true;
  }

  function encodePrepared(encoder, prepared, {
    timestampProfiler = null,
    timestampMetadata = {},
    dispatchIndirectProvider = null,
    preserveAuthoritativeOutputs = dispatchIndirectProvider !== null,
    recordDirectConditionalPrefix = null,
    recordDirectConditionalSuffix = null,
    directConditionalComputePass = null,
    recordConditionalPrefix = recordDirectConditionalPrefix,
    recordConditionalSuffix = recordDirectConditionalSuffix,
    conditionalComputePass = directConditionalComputePass
  } = {}) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    assertEncoder(encoder);
    const record = records.get(prepared);
    if (!record || record.released) throw new TypeError('prepared build is not active');
    if (record.encodings.length > 0) throw new Error('prepared build has already been encoded');
    if (!prepared.hostAdmission) {
      prepared.encoded = false;
      prepared.consumerDispatchAllowed = false;
      return prepared;
    }
    const { inputs, outputs, scratch } = prepared.resources;
    const sourceCount = prepared.sourceCount;
    const cellRegions = outputs.cellCsr.regions;
    const packedRegions = outputs.sourceCandidateCsr.regions;
    const conditionalGeneration = preserveAuthoritativeOutputs === true;
    const bindGroupTelemetry = { created: 0, reused: 0 };
    const timestampActive = Boolean(
      timestampProfiler?.beginComputePassDescriptor
        && timestampProfiler.active !== false
    );
    if (conditionalGeneration && !dispatchIndirectProvider) {
      throw new TypeError(
        'preserving authoritative neighborhood outputs requires a GPU indirect dispatch provider'
      );
    }
    const stageMetadata = timestampActive
      ? (residentNeighborhoodStage) => ({
          ...timestampMetadata,
          generation: prepared.generation,
          positionEpoch: prepared.positionEpoch,
          residentNeighborhoodStage
        })
      : () => null;
    encodePreparedPrelude(encoder, prepared, { conditionalGeneration });

    const groupedConditionalPass = conditionalComputePass || (conditionalGeneration
      && !timestampActive
      ? encoder.beginComputePass({ label: `${label}GroupedConditionalBuildPrefix` })
      : null);
    if (groupedConditionalPass && recordConditionalPrefix) {
      if (typeof recordConditionalPrefix !== 'function') {
        throw new TypeError('recordConditionalPrefix must be a function');
      }
      recordConditionalPrefix(groupedConditionalPass);
    }

    if (conditionalGeneration && !prepared.directSegmentedMasked) {
      const initializeConditionalBindGroup = retainedSlotBindGroup(
          record.generationArenaSlot,
          'initialize-conditional',
          device,
          pipelines.initializeConditional,
          `${label}-initialize-conditional-generation-bind-group`,
          () => [
            { binding: 3, resource: { buffer: outputs.cellCsr.buffer } },
            { binding: 4, resource: { buffer: outputs.sourceCandidateCsr.buffer } },
            { binding: 10, resource: exactBindingResource(outputs.capacityEvidence) },
            { binding: 11, resource: exactBindingResource(scratch.params) },
            { binding: 13, resource: { buffer: outputs.candidateDispatchIndirect.buffer } }
          ],
          bindGroupTelemetry
        );
      encodePass(
        encoder,
        pipelines.initializeConditional,
        initializeConditionalBindGroup,
        [1, 1, 1],
        `${label}ConditionalGenerationInitialize`,
        timestampProfiler,
        stageMetadata('conditional-generation-initialize'),
        dispatchIndirectProvider,
        groupedConditionalPass
      );
    }

    if (prepared.directSegmentedMasked) {
      const directSegmentedPass = timestampActive
        ? null
        : (groupedConditionalPass
            || encoder.beginComputePass({ label: `${label}GroupedDirectSegmentedMasked` }));
      encodePass(
        encoder,
        pipelines.buildCandidatesDirectSegmentedMasked,
        prepared._bindGroups.directSegmentedMasked,
        [1, 1, 1],
        `${label}DirectSegmentedMaskedCandidateBuild`,
        timestampProfiler,
        stageMetadata('direct-segmented-masked-candidate-build'),
        dispatchIndirectProvider,
        directSegmentedPass
      );
      if (groupedConditionalPass && recordConditionalSuffix) {
        if (typeof recordConditionalSuffix !== 'function') {
          throw new TypeError('recordConditionalSuffix must be a function');
        }
        recordConditionalSuffix(directSegmentedPass);
      }
      directSegmentedPass?.end();
      const encoding = { radixEncoding: null, candidateScanEncoding: null };
      record.encodings.push(encoding);
      prepared.status = 'resident-neighborhood-gpu-direct-build-encoded-pending-gpu-admission';
      prepared.encoded = true;
      prepared.gpuAdmissionPending = true;
      prepared.consumerDispatchAllowed = 'packed-header-gpu-guarded';
      prepared.radixEncoding = {
        schema: null,
        passCount: 0,
        stable: true,
        structuralKeyWordCount: 0,
        bypassedBy: 'fixed-source-segments-zero-mask-inactive-rows',
        readbackPerformed: false
      };
      prepared.scanEncoding = {
        schema: candidateScan.schema,
        encoded: false,
        elementCount: sourceCount,
        readbackPerformed: false
      };
      prepared.encodingTelemetry = {
        schema: 'peercompute.ulg.resident-neighborhood-builder-encoding-telemetry.v0',
        conditionalGeneration,
        strategy: 'direct',
        directTopology: 'fixed-source-segments-zero-mask-inactive-rows',
        encodedDispatchCount: 1,
        encodedComputePassCount: timestampActive
          ? 1
          : (conditionalComputePass ? 0 : 1),
        bindGroupCreationCount: prepared._bindGroupCreationCount + bindGroupTelemetry.created,
        bindGroupReuseCount: prepared._bindGroupReuseCount + bindGroupTelemetry.reused,
        perGenerationControlArrayAllocationCount:
          prepared._perGenerationControlArrayAllocationCount,
        retainedControlTemplateWriteCount:
          prepared._controlTemplateResidency === 'retained-per-generation-slot' ? 4 : 0,
        hostEncodingAllocationProxyCount:
          prepared._perGenerationControlArrayAllocationCount
            + prepared._bindGroupCreationCount
            + bindGroupTelemetry.created,
        zeroWorkIndirectDispatchesPossible: conditionalGeneration,
        encodedCommandsScaleWithConditionalGenerationCount: conditionalGeneration
      };
      return prepared;
    }

    if (prepared.strategyPlan.strategy === 'direct') {
      const directCountPass = timestampActive
        ? null
        : (groupedConditionalPass
            || encoder.beginComputePass({ label: `${label}GroupedDirectCountScan` }));
      encodePass(
        encoder,
        pipelines.countCandidatesDirect,
        prepared._bindGroups.directCount,
        prepared.dispatch,
        `${label}DirectCandidateCount`,
        timestampProfiler,
        stageMetadata('direct-candidate-count'),
        dispatchIndirectProvider,
        directCountPass
      );
      const candidateScanEncoding = candidateScan.encode(encoder, {
        inputBuffer: scratch.candidateCounts.buffer,
        outputBuffer: scratch.scannedSourceOffsets.buffer,
        elementCount: sourceCount
      }, {
        timestampProfiler,
        timestampMetadata: stageMetadata('direct-candidate-count-scan'),
        labelPrefix: `${label}DirectCandidateCount`,
        dispatchIndirectProvider,
        computePass: directCountPass
      });
      if (conditionalGeneration) {
        const copySourceOffsetsBindGroup = retainedSlotBindGroup(
            record.generationArenaSlot,
            'copy-source-offsets-direct-conditional',
            device,
            pipelines.copySourceOffsetsConditional,
            `${label}-copy-source-offsets-direct-conditional-bind-group`,
            () => [
              { binding: 4, resource: { buffer: outputs.sourceCandidateCsr.buffer } },
              { binding: 7, resource: { buffer: scratch.scannedSourceOffsets.buffer } },
              { binding: 11, resource: exactBindingResource(scratch.params) }
            ],
            bindGroupTelemetry
          );
        encodePass(
          encoder,
          pipelines.copySourceOffsetsConditional,
          copySourceOffsetsBindGroup,
          prepared.dispatch,
          `${label}DirectConditionalSourceOffsetCopy`,
          timestampProfiler,
          stageMetadata('direct-conditional-source-offset-copy'),
          dispatchIndirectProvider,
          directCountPass
        );
      } else {
        directCountPass?.end();
        encoder.copyBufferToBuffer(
          scratch.scannedSourceOffsets.buffer,
          0,
          outputs.sourceCandidateCsr.buffer,
          packedRegions.sourceOffsets.baseU32 * U32_BYTES,
          sourceCount * U32_BYTES
        );
      }
      const directFinalizePass = timestampActive
        ? null
        : (groupedConditionalPass
            || encoder.beginComputePass({ label: `${label}GroupedDirectFinalizeFill` }));
      encodePass(
        encoder,
        pipelines.finalizeAdmission,
        prepared._bindGroups.finalize,
        [1, 1, 1],
        RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.finalize,
        timestampProfiler,
        stageMetadata('direct-finalize'),
        dispatchIndirectProvider,
        directFinalizePass
      );
      encodePass(
        encoder,
        pipelines.fillCandidatesDirect,
        prepared._bindGroups.directFill,
        prepared.dispatch,
        `${label}DirectCandidateFill`,
        timestampProfiler,
        stageMetadata('direct-candidate-fill'),
        dispatchIndirectProvider,
        directFinalizePass
      );
      if (groupedConditionalPass && recordConditionalSuffix) {
        if (typeof recordConditionalSuffix !== 'function') {
          throw new TypeError('recordConditionalSuffix must be a function');
        }
        recordConditionalSuffix(directFinalizePass);
      }
      directFinalizePass?.end();
      const encoding = { radixEncoding: null, candidateScanEncoding };
      record.encodings.push(encoding);
      prepared.status = 'resident-neighborhood-gpu-direct-build-encoded-pending-gpu-admission';
      prepared.encoded = true;
      prepared.gpuAdmissionPending = true;
      prepared.consumerDispatchAllowed = 'packed-header-gpu-guarded';
      prepared.radixEncoding = {
        schema: null,
        passCount: 0,
        stable: true,
        structuralKeyWordCount: 0,
        bypassedBy: 'deterministic-small-source-direct-pair-builder',
        readbackPerformed: false
      };
      prepared.scanEncoding = {
        schema: candidateScan.schema,
        encoded: true,
        elementCount: sourceCount,
        readbackPerformed: false
      };
      prepared.encodingTelemetry = {
        schema: 'peercompute.ulg.resident-neighborhood-builder-encoding-telemetry.v0',
        conditionalGeneration,
        strategy: 'direct',
        encodedDispatchCount: 3 + candidateScanEncoding.encodedDispatchCount
          + (conditionalGeneration ? 2 : 0),
        encodedComputePassCount: timestampActive
          ? 3 + candidateScanEncoding.encodedDispatchCount + (conditionalGeneration ? 2 : 0)
          : (conditionalGeneration ? (conditionalComputePass ? 0 : 1) : 2),
        bindGroupCreationCount: prepared._bindGroupCreationCount
          + bindGroupTelemetry.created
          + candidateScanEncoding.bindGroupCreationCount,
        bindGroupReuseCount: prepared._bindGroupReuseCount
          + bindGroupTelemetry.reused
          + (candidateScanEncoding.bindGroupReuseCount ?? 0),
        perGenerationControlArrayAllocationCount:
          prepared._perGenerationControlArrayAllocationCount,
        retainedControlTemplateWriteCount:
          prepared._controlTemplateResidency === 'retained-per-generation-slot' ? 4 : 0,
        hostEncodingAllocationProxyCount:
          prepared._perGenerationControlArrayAllocationCount
            + prepared._bindGroupCreationCount
            + bindGroupTelemetry.created
            + candidateScanEncoding.bindGroupCreationCount,
        zeroWorkIndirectDispatchesPossible: conditionalGeneration,
        encodedCommandsScaleWithConditionalGenerationCount: conditionalGeneration
      };
      return prepared;
    }

    const denseUniformChartStrategy = prepared.strategyPlan.strategy
      === RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DENSE_UNIFORM_CHART;
    const occupancyPipeline = denseUniformChartStrategy
      ? pipelines.emitDenseUniformChart
      : pipelines.emitOccupancy;
    const structuralSortWordCount = denseUniformChartStrategy
      ? 1
      : RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS;
    encodePass(
      encoder,
      occupancyPipeline,
      prepared._bindGroups.occupancy,
      prepared.dispatch,
      RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.keyBuild,
      timestampProfiler,
      stageMetadata('key-build'),
      dispatchIndirectProvider,
      groupedConditionalPass
    );
    if (groupedConditionalPass) groupedConditionalPass.end();
    const radixEncoding = radixUnique.encodeSortUnique(encoder, {
      keyBuffer: outputs.occupancyKeys.buffer,
      elementCount: sourceCount,
      keyWordCount: structuralSortWordCount,
      keyStrideWords: CELL_KEY_STRIDE_U32,
      generationId: prepared.generation,
      consumerWorkgroupSize: RESIDENT_NEIGHBORHOOD_BUILDER_WORKGROUP_SIZE,
      timestampProfiler,
      timestampMetadata: stageMetadata(denseUniformChartStrategy
        ? 'dense-uniform-chart-cell-sort-unique'
        : 'cell-sort-unique'),
      dispatchIndirectProvider
    });
    let groupedPostBuildPass = conditionalGeneration && !timestampActive
      ? encoder.beginComputePass({ label: `${label}GroupedConditionalPostUnique` })
      : null;
    if (conditionalGeneration) {
      const copyCellOffsetsBindGroup = retainedSlotBindGroup(
        record.generationArenaSlot,
        'copy-cell-offsets-conditional',
        device,
        pipelines.copyCellOffsetsConditional,
        `${label}-copy-cell-offsets-conditional-bind-group`,
        () => [
          { binding: 3, resource: { buffer: outputs.cellCsr.buffer } },
          { binding: 7, resource: { buffer: radixEncoding.uniqueOffsetsBuffer } },
          { binding: 11, resource: exactBindingResource(scratch.params) }
        ],
        bindGroupTelemetry
      );
      encodePass(
        encoder,
        pipelines.copyCellOffsetsConditional,
        copyCellOffsetsBindGroup,
        prepared.dispatch,
        `${label}ConditionalCellOffsetCopy`,
        timestampProfiler,
        stageMetadata('conditional-cell-offset-copy'),
        dispatchIndirectProvider,
        groupedPostBuildPass
      );
    } else {
      encoder.copyBufferToBuffer(
        radixEncoding.uniqueOffsetsBuffer,
        0,
        outputs.cellCsr.buffer,
        cellRegions.cellOffsets.baseU32 * U32_BYTES,
        (sourceCount + 1) * U32_BYTES
      );
    }
    if (sourceCount > 0) {
      if (conditionalGeneration) {
        const copyCellMembersBindGroup = retainedSlotBindGroup(
          record.generationArenaSlot,
          'copy-cell-members-conditional',
          device,
          pipelines.copyCellMembersConditional,
          `${label}-copy-cell-members-conditional-bind-group`,
          () => [
            { binding: 3, resource: { buffer: outputs.cellCsr.buffer } },
            { binding: 7, resource: { buffer: radixEncoding.sortedIndicesBuffer } },
            { binding: 11, resource: exactBindingResource(scratch.params) }
          ],
          bindGroupTelemetry
        );
        encodePass(
          encoder,
          pipelines.copyCellMembersConditional,
          copyCellMembersBindGroup,
          prepared.dispatch,
          `${label}ConditionalCellMemberCopy`,
          timestampProfiler,
          stageMetadata('conditional-cell-member-copy'),
          dispatchIndirectProvider,
          groupedPostBuildPass
        );
      } else {
        encoder.copyBufferToBuffer(
          radixEncoding.sortedIndicesBuffer,
          0,
          outputs.cellCsr.buffer,
          cellRegions.memberIndices.baseU32 * U32_BYTES,
          sourceCount * U32_BYTES
        );
      }
    }
    if (!conditionalGeneration && !timestampActive) {
      groupedPostBuildPass = encoder.beginComputePass({ label: `${label}GroupedPostUnique` });
    }
    const assemblePipeline = denseUniformChartStrategy
      ? pipelines.assembleDenseUniformChartCellCsr
      : pipelines.assembleCellCsr;
    const assembleBindGroup = retainedSlotBindGroup(
      record.generationArenaSlot,
      denseUniformChartStrategy ? 'assemble-dense-cell-csr' : 'assemble-cell-csr',
      device,
      assemblePipeline,
      `${label}-assemble-cell-csr-bind-group`,
      () => [
        { binding: 3, resource: { buffer: outputs.cellCsr.buffer } },
        { binding: 8, resource: { buffer: scratch.buildStatus.buffer } },
        { binding: 9, resource: { buffer: radixEncoding.uniqueEvidenceBuffer } },
        { binding: 11, resource: exactBindingResource(scratch.params) },
        { binding: 12, resource: { buffer: radixEncoding.uniqueKeysBuffer } }
      ],
      bindGroupTelemetry
    );
    encodePass(
      encoder,
      assemblePipeline,
      assembleBindGroup,
      prepared.dispatch,
      RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.cellAssemble,
      timestampProfiler,
      stageMetadata('cell-assemble'),
      dispatchIndirectProvider,
      groupedPostBuildPass
    );
    encodePass(
      encoder,
      pipelines.countCandidates,
      prepared._bindGroups.count,
      prepared.dispatch,
      RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.candidateCount,
      timestampProfiler,
      stageMetadata('candidate-count'),
      dispatchIndirectProvider,
      groupedPostBuildPass
    );
    let candidateScanEncoding = null;
    if (sourceCount > 0) {
      candidateScanEncoding = candidateScan.encode(encoder, {
        inputBuffer: scratch.candidateCounts.buffer,
        outputBuffer: scratch.scannedSourceOffsets.buffer,
        elementCount: sourceCount
      }, {
        timestampProfiler,
        timestampMetadata: stageMetadata('candidate-count-scan'),
        labelPrefix: `${label}CandidateCount`,
        dispatchIndirectProvider,
        computePass: groupedPostBuildPass
      });
      if (conditionalGeneration) {
        const copySourceOffsetsBindGroup = retainedSlotBindGroup(
          record.generationArenaSlot,
          'copy-source-offsets-conditional',
          device,
          pipelines.copySourceOffsetsConditional,
          `${label}-copy-source-offsets-conditional-bind-group`,
          () => [
            { binding: 4, resource: { buffer: outputs.sourceCandidateCsr.buffer } },
            { binding: 7, resource: { buffer: scratch.scannedSourceOffsets.buffer } },
            { binding: 11, resource: exactBindingResource(scratch.params) }
          ],
          bindGroupTelemetry
        );
        encodePass(
          encoder,
          pipelines.copySourceOffsetsConditional,
          copySourceOffsetsBindGroup,
          prepared.dispatch,
          `${label}ConditionalSourceOffsetCopy`,
          timestampProfiler,
          stageMetadata('conditional-source-offset-copy'),
          dispatchIndirectProvider,
          groupedPostBuildPass
        );
      } else {
        groupedPostBuildPass?.end();
        groupedPostBuildPass = null;
        encoder.copyBufferToBuffer(
          scratch.scannedSourceOffsets.buffer,
          0,
          outputs.sourceCandidateCsr.buffer,
          packedRegions.sourceOffsets.baseU32 * U32_BYTES,
          sourceCount * U32_BYTES
        );
      }
    }
    const groupedFinalizePass = !timestampActive
      ? (groupedPostBuildPass
          || encoder.beginComputePass({ label: `${label}GroupedFinalizeFill` }))
      : null;
    encodePass(
      encoder,
      pipelines.finalizeAdmission,
      prepared._bindGroups.finalize,
      [1, 1, 1],
      RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.finalize,
      timestampProfiler,
      stageMetadata('finalize'),
      dispatchIndirectProvider,
      groupedFinalizePass
    );
    encodeIndirectPass(
      encoder,
      pipelines.fillCandidates,
      prepared._bindGroups.fill,
      outputs.candidateDispatchIndirect.buffer,
      RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.candidateFill,
      timestampProfiler,
      stageMetadata('candidate-fill'),
      groupedFinalizePass
    );
    if (conditionalGeneration && groupedFinalizePass && recordConditionalSuffix) {
      if (typeof recordConditionalSuffix !== 'function') {
        throw new TypeError('recordConditionalSuffix must be a function');
      }
      recordConditionalSuffix(groupedFinalizePass);
    }
    groupedFinalizePass?.end();
    const encoding = { radixEncoding, candidateScanEncoding };
    record.encodings.push(encoding);
    prepared.status = 'resident-neighborhood-gpu-build-encoded-pending-gpu-admission';
    prepared.encoded = true;
    prepared.gpuAdmissionPending = true;
    prepared.consumerDispatchAllowed = 'packed-header-gpu-guarded';
    prepared.radixEncoding = {
      schema: radixEncoding.schema,
      passCount: radixEncoding.radixPassCount,
      stable: true,
      structuralKeyWordCount: structuralSortWordCount,
      canonicalCellStructuralKeyWordCount:
        RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS,
      bypassedBy: denseUniformChartStrategy
        ? 'bounded-dense-uniform-chart-linear-cell-key'
        : null,
      deterministicMemberOrder: 'stable-source-index',
      readbackPerformed: false
    };
    prepared.scanEncoding = {
      schema: candidateScan.schema,
      encoded: candidateScanEncoding !== null,
      elementCount: sourceCount,
      readbackPerformed: false
    };
    const conditionalDispatchCount = conditionalGeneration ? 4 : 0;
    const conditionalPassCount = conditionalGeneration ? 4 : 0;
    const nonTimestampBuilderPassCount = (conditionalComputePass ? 0 : 1)
      + (radixEncoding.encodedComputePassCount ?? 0)
      + (conditionalGeneration ? 1 : 2);
    prepared.encodingTelemetry = {
      schema: 'peercompute.ulg.resident-neighborhood-builder-encoding-telemetry.v0',
      conditionalGeneration,
      strategy: prepared.strategyPlan.strategy,
      encodedDispatchCount: 5
        + conditionalDispatchCount
        + (radixEncoding.encodedDispatchCount ?? 0)
        + (candidateScanEncoding?.encodedDispatchCount ?? 0),
      encodedComputePassCount: timestampActive
        ? 5
          + conditionalPassCount
          + (radixEncoding.encodedComputePassCount ?? 0)
          + (candidateScanEncoding?.encodedDispatchCount ?? 0)
        : nonTimestampBuilderPassCount,
      bindGroupCreationCount: prepared._bindGroupCreationCount
        + bindGroupTelemetry.created
        + (radixEncoding.bindGroupCreationCount ?? 0)
        + (candidateScanEncoding?.bindGroupCreationCount ?? 0),
      bindGroupReuseCount: prepared._bindGroupReuseCount
        + bindGroupTelemetry.reused
        + (radixEncoding.bindGroupReuseCount ?? 0)
        + (candidateScanEncoding?.bindGroupReuseCount ?? 0),
      perGenerationControlArrayAllocationCount:
        prepared._perGenerationControlArrayAllocationCount,
      retainedControlTemplateWriteCount:
        prepared._controlTemplateResidency === 'retained-per-generation-slot' ? 4 : 0,
      hostEncodingAllocationProxyCount:
        prepared._perGenerationControlArrayAllocationCount
          + prepared._bindGroupCreationCount
          + bindGroupTelemetry.created
          + (radixEncoding.bindGroupCreationCount ?? 0)
          + (candidateScanEncoding?.bindGroupCreationCount ?? 0),
      zeroWorkIndirectDispatchesPossible: conditionalGeneration,
      encodedCommandsScaleWithConditionalGenerationCount: conditionalGeneration
    };
    prepared.resources.scratch.radixUnique = {
      sortedIndicesBuffer: radixEncoding.sortedIndicesBuffer,
      uniqueKeysBuffer: radixEncoding.uniqueKeysBuffer,
      uniqueOffsetsBuffer: radixEncoding.uniqueOffsetsBuffer,
      uniqueEvidenceBuffer: radixEncoding.uniqueEvidenceBuffer,
      retainedBy: 'builder-runtime-parallel-primitive'
    };
    return prepared;
  }

  function releaseTransientBuffers(value) {
    const record = records.get(value);
    if (!record || record.released) return;
    for (const encoding of record.encodings) {
      radixUnique.releaseTransientBuffers(encoding.radixEncoding);
      if (encoding.candidateScanEncoding) {
        candidateScan.releaseTransientBuffers(encoding.candidateScanEncoding);
      }
    }
    record.encodings.length = 0;
  }

  function release(value) {
    const record = records.get(value);
    if (!record || record.released) return false;
    releaseTransientBuffers(value);
    record.released = true;
    activeBuilds.delete(record);
    for (const entry of record.ownedEntries) entry.buffer.destroy?.();
    releaseGenerationArenaSlot(record.generationArenaSlot);
    value.released = true;
    return true;
  }

  return {
    schema: ULG_RESIDENT_NEIGHBORHOOD_GPU_BUILDER_SCHEMA,
    status: 'resident-neighborhood-gpu-builder-ready',
    maxSourceCount: resolvedMaxSourceCount,
    maxSupportClassCount: resolvedMaxSupportClassCount,
    maxCandidateScratchCount: resolvedMaxCandidateScratchCount,
    maxCellRadius: resolvedMaxCellRadius,
    maxLevelSpan: resolvedMaxLevelSpan,
    requestedBuildStrategy: resolvedRequestedBuildStrategy,
    retainedParamsSlotCount: retainConstantScanParamsBuffers
      ? resolvedRetainedParamsSlotCount
      : 0,
    retainedGenerationSlotCount: reuseSingleArena
      ? resolvedRetainedGenerationSlotCount
      : 0,
    generationControlArenaLayout,
    reuseSingleArena: reuseSingleArena === true,
    workgroupSize: RESIDENT_NEIGHBORHOOD_BUILDER_WORKGROUP_SIZE,
    submissionOwnership: 'caller',
    commandEncoderOwnership: 'caller',
    prepare,
    encodePrelude(encoder, prepared, { conditionalGeneration = false } = {}) {
      return encodePreparedPrelude(encoder, prepared, { conditionalGeneration });
    },
    encodeConditionalPrelude(encoder, prepared) {
      return encodePreparedPrelude(encoder, prepared, { conditionalGeneration: true });
    },
    encodeDirectConditionalPrelude(encoder, prepared) {
      if (prepared?.strategyPlan?.strategy !== 'direct') {
        throw new TypeError('direct conditional prelude requires a direct prepared build');
      }
      return encodePreparedPrelude(encoder, prepared, { conditionalGeneration: true });
    },
    encodePrepared,
    encode(encoder, args, options = {}) {
      return encodePrepared(encoder, prepare(args), options);
    },
    releaseTransientBuffers,
    release,
    allocationEntries(value = null) {
      if (value) {
        const record = records.get(value);
        return [
          ...(sharedArena?.entries || []),
          ...(record?.generationArenaSlot
            ? generationControlArenaEntries
            : []),
          ...(record?.ownedEntries || [])
        ].map((entry) => ({ ...entry }));
      }
      return [
        ...(sharedArena?.entries || []),
        ...generationControlArenaEntries,
        ...radixUnique.allocationEntries(),
        ...candidateScan.allocationEntries(),
        ...[...activeBuilds].flatMap((record) => record.ownedEntries)
      ];
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const record of [...activeBuilds]) release(record.prepared);
      destroyBuilderArena(sharedArena);
      sharedArena = null;
      destroyGenerationArenaSlots();
      radixUnique.destroy();
      candidateScan.destroy();
    }
  };
}
