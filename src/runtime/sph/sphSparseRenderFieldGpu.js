import {
  createWebGpuRadixUniquePlan,
  createWebGpuStableRadixScanUnique,
  createWebGpuU32ScanPlan,
  createWebGpuU32ExclusiveScan
} from '../webgpuRadixScanUnique.js';
import { ULG_SPH_GPU_SPARSE_RENDER_FIELD_SCHEMA } from '../../../ulg-gpu-abi/src/sparseRenderField.js';
import {
  SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_VOXEL_UNUSED,
  SPH_GPU_SPARSE_RENDER_FIELD_CANDIDATE_SLICE_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_RANGE_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_EXECUTION_SCHEMA,
  sphSparseRenderFieldDirectoryWgsl,
  sphSparseRenderFieldGatherAtlasWgsl,
  sphSparseRenderFieldHomeRouteWgsl,
  sphSparseRenderFieldInitializeWgsl
} from '../../../ulg-gpu-abi/src/sparseRenderFieldGpuWgsl.js';
import {
  SPH_SPARSE_RENDER_FIELD_ACTIVE_BRICK_UINTS,
  SPH_SPARSE_RENDER_FIELD_ADMISSION_APPROVED,
  SPH_SPARSE_RENDER_FIELD_ADMISSION_FAIL_CLOSED,
  SPH_SPARSE_RENDER_FIELD_ADMISSION_RETAIN_PREVIOUS,
  SPH_SPARSE_RENDER_FIELD_OVERFLOW_ROUTES,
  SPH_SPARSE_RENDER_FIELD_OVERFLOW_TOTAL_BYTES,
  SPH_SPARSE_RENDER_FIELD_ROUTE_UINTS,
  SPH_SPARSE_RENDER_FIELD_ROW_STATUS_BLOCKED,
  SPH_SPARSE_RENDER_FIELD_SURFACE_UINTS
} from './sphSparseRenderFieldPlan.js';

export {
  SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_VOXEL_UNUSED,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_EXECUTION_SCHEMA
};

export const SPH_SPARSE_RENDER_FIELD_GPU_BRICK_SIZE = 8;
export const SPH_SPARSE_RENDER_FIELD_GPU_BRICK_VOLUME = 512;
export const SPH_SPARSE_RENDER_FIELD_GPU_ATLAS_CELL_FLOATS = 8;
export const SPH_SPARSE_RENDER_FIELD_GPU_WORKGROUP_SIZE = 64;
export const SPH_SPARSE_RENDER_FIELD_CANDIDATE_CONSUMER_WORKGROUP_SIZE = 32;
export const SPH_SPARSE_RENDER_FIELD_REQUIRED_STORAGE_BUFFERS_PER_STAGE = 10;
export const SPH_SPARSE_RENDER_FIELD_PARTICLE_CAPACITY_BUCKET = 4096;
export const SPH_SPARSE_RENDER_FIELD_PRODUCT_EVENT_CAPACITY_BUCKET = 4096;

const U32_BYTES = 4;
const F32_BYTES = 4;
const U32_MAX = 0xffffffff;
const U32_BASE = 0x100000000;
const PARAM_BYTES = 256;
const USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

function u32(value, label, { min = 0, max = U32_MAX } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

export function reserveSphSparseRenderFieldProductEventCapacity({
  productEventCount = 0,
  currentCapacity = 0,
  bucketSize = SPH_SPARSE_RENDER_FIELD_PRODUCT_EVENT_CAPACITY_BUCKET
} = {}) {
  const activeCount = u32(productEventCount, 'productEventCount');
  const previousCapacity = u32(currentCapacity, 'currentCapacity');
  const resolvedBucketSize = u32(bucketSize, 'bucketSize', { min: 1 });
  const fitsCurrentCapacity = activeCount <= previousCapacity;
  const roundedRequiredCapacity = activeCount === 0
    ? 0
    : Math.min(
        U32_MAX,
        Math.ceil(activeCount / resolvedBucketSize) * resolvedBucketSize
      );
  const reservedProductEventCapacity = fitsCurrentCapacity
    ? previousCapacity
    : Math.max(activeCount, roundedRequiredCapacity);
  if (reservedProductEventCapacity < activeCount) {
    throw new RangeError('reserved product-event capacity cannot cover the exact active count');
  }
  return {
    schema: 'peercompute.ulg.sph-sparse-render-field-product-event-capacity-reservation.v0',
    status: fitsCurrentCapacity
      ? 'product-event-count-fits-reserved-capacity'
      : 'product-event-capacity-grown-to-bucket',
    productEventCount: activeCount,
    previousCapacity,
    reservedProductEventCapacity,
    bucketSize: resolvedBucketSize,
    bucketIndex: reservedProductEventCapacity === 0
      ? 0
      : Math.ceil(reservedProductEventCapacity / resolvedBucketSize),
    capacityHeadroom: reservedProductEventCapacity - activeCount,
    fitsCurrentCapacity,
    growthRequired: !fitsCurrentCapacity,
    exactActiveCountPreserved: true,
    growthPolicy: 'grow-only-fixed-bucket',
    overflowPolicy: 'fail-closed-before-encode-when-active-count-exceeds-reserved-capacity'
  };
}

export function reserveSphSparseRenderFieldParticleCapacity({
  particleCount = 0,
  currentCapacity = 0,
  bucketSize = SPH_SPARSE_RENDER_FIELD_PARTICLE_CAPACITY_BUCKET
} = {}) {
  const activeCount = u32(particleCount, 'particleCount');
  const previousCapacity = u32(currentCapacity, 'currentCapacity');
  const resolvedBucketSize = u32(bucketSize, 'bucketSize', { min: 1 });
  const fitsCurrentCapacity = activeCount <= previousCapacity;
  const roundedRequiredCapacity = activeCount === 0
    ? 0
    : Math.min(
        U32_MAX,
        Math.ceil(activeCount / resolvedBucketSize) * resolvedBucketSize
      );
  const reservedParticleCapacity = fitsCurrentCapacity
    ? previousCapacity
    : Math.max(activeCount, roundedRequiredCapacity);
  if (reservedParticleCapacity < activeCount) {
    throw new RangeError('reserved particle capacity cannot cover the exact active count');
  }
  return {
    schema: 'peercompute.ulg.sph-sparse-render-field-particle-capacity-reservation.v0',
    status: fitsCurrentCapacity
      ? 'particle-count-fits-reserved-capacity'
      : 'particle-capacity-grown-to-bucket',
    particleCount: activeCount,
    previousCapacity,
    reservedParticleCapacity,
    bucketSize: resolvedBucketSize,
    bucketIndex: reservedParticleCapacity === 0
      ? 0
      : Math.ceil(reservedParticleCapacity / resolvedBucketSize),
    capacityHeadroom: reservedParticleCapacity - activeCount,
    fitsCurrentCapacity,
    growthRequired: !fitsCurrentCapacity,
    exactActiveCountPreserved: true,
    growthPolicy: 'grow-only-fixed-bucket',
    overflowPolicy: 'fail-closed-before-encode-when-active-count-exceeds-reserved-capacity'
  };
}

function product(values, label, max = U32_MAX) {
  let result = 1;
  for (const value of values) {
    result *= value;
    if (!Number.isSafeInteger(result) || result > max) throw new RangeError(`${label} exceeds ${max}`);
  }
  return result;
}

function align(value, alignment = 4) {
  return Math.max(4, Math.ceil(value / alignment) * alignment);
}

function rowBytes(count, words) {
  return align(count * words * U32_BYTES);
}

function records(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.metadata)) return value.metadata;
  return [];
}

function numeric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function declaredSurfaceSupportRadiusProof(surface, metadata, configuredRadiusBricks) {
  const strengthInput = metadata?.strength;
  const subtractInput = metadata?.subtract;
  const strength = Math.fround(Number(strengthInput));
  const subtract = Math.fround(Number(subtractInput));
  const declared = strengthInput != null && subtractInput != null
    && Number.isFinite(strength) && Number.isFinite(subtract);
  if (!declared) {
    return {
      surfaceIndex: surface.surfaceIndex,
      declared: false,
      strength: null,
      subtract: null,
      requiredSupportCells: null,
      requiredSupportRadiusBricks: null,
      configuredSupportRadiusBricks: configuredRadiusBricks,
      admitted: false
    };
  }
  const denominator = Math.max(subtract, Math.fround(1e-12));
  const supportSquared = Math.fround(
    Math.fround(strength / denominator) - Math.fround(0.000001)
  );
  const supportNorm = Math.fround(Math.sqrt(Math.max(0, supportSquared)));
  const maxDimension = Math.max(...surface.dimensions);
  const supportExtent = Math.fround(supportNorm * Math.fround(maxDimension));
  const requiredSupportCells = Number.isFinite(supportExtent)
    ? Math.ceil(supportExtent)
    : null;
  const requiredSupportRadiusBricks = requiredSupportCells == null
    ? null
    : Math.ceil(requiredSupportCells / surface.brickSize);
  return {
    surfaceIndex: surface.surfaceIndex,
    declared: true,
    strength,
    subtract,
    requiredSupportCells,
    requiredSupportRadiusBricks,
    configuredSupportRadiusBricks: configuredRadiusBricks,
    admitted: requiredSupportRadiusBricks != null
      && requiredSupportRadiusBricks <= configuredRadiusBricks
  };
}

export function deriveSphSparseRenderFieldEligibilityBounds(surfaceMetadata, {
  surfaceCount = records(surfaceMetadata).length
} = {}) {
  const count = u32(surfaceCount, 'surfaceCount');
  if (count === 0) {
    return {
      status: 'sparse-render-field-eligibility-empty',
      maxParticleSurfacesPerSource: 0,
      maxProductSurfacesPerEvent: 0,
      conservativeFallback: false
    };
  }
  const rows = records(surfaceMetadata);
  if (rows.length < count) {
    return {
      status: 'sparse-render-field-eligibility-conservative-surface-count',
      maxParticleSurfacesPerSource: count,
      maxProductSurfacesPerEvent: count,
      conservativeFallback: true
    };
  }
  const particle = new Map();
  const productEvents = new Map();
  for (let index = 0; index < count; index += 1) {
    const row = rows[index] || {};
    const materialId = numeric(row.materialId ?? row.material_id ?? row.materialIndex, -1);
    const domainId = Math.max(0, Math.round(numeric(row.renderDomainId ?? row.render_domain_id, 0)));
    let materialDomains = particle.get(materialId);
    if (!materialDomains) {
      materialDomains = { wildcard: 0, specific: new Map() };
      particle.set(materialId, materialDomains);
    }
    if (domainId === 0) {
      materialDomains.wildcard += 1;
    } else {
      materialDomains.specific.set(
        domainId,
        (materialDomains.specific.get(domainId) || 0) + 1
      );
    }
    const eventKey = `${materialId}`;
    productEvents.set(eventKey, (productEvents.get(eventKey) || 0) + 1);
  }
  const particleBounds = [...particle.values()].map(({ wildcard, specific }) =>
    wildcard + Math.max(0, ...specific.values()));
  return {
    status: 'sparse-render-field-eligibility-bounds-derived',
    maxParticleSurfacesPerSource: Math.max(...particleBounds),
    maxProductSurfacesPerEvent: Math.max(...productEvents.values()),
    particleMaterialDomainGroupCount: [...particle.values()].reduce(
      (sum, entry) => sum + 1 + entry.specific.size,
      0
    ),
    productMaterialGroupCount: productEvents.size,
    conservativeFallback: false
  };
}

export function createSphSparseRenderFieldCandidateVoxelSlices({
  surfaces,
  totalCapacity,
  capacities = null,
  minStorageBufferOffsetAlignment = 256
} = {}) {
  if (!Array.isArray(surfaces) || surfaces.length === 0) {
    throw new TypeError('candidate voxel slices require sparse surface plans');
  }
  const total = u32(totalCapacity, 'totalCapacity', { min: 1 });
  const alignmentBytes = u32(minStorageBufferOffsetAlignment, 'minStorageBufferOffsetAlignment', {
    min: 4
  });
  const alignmentU32 = Math.ceil(alignmentBytes / U32_BYTES);
  let resolved;
  if (capacities != null) {
    if (!Array.isArray(capacities) || capacities.length !== surfaces.length) {
      throw new RangeError('candidate voxel capacities must match the surface count');
    }
    resolved = capacities.map((value, index) => u32(value, `candidateVoxelCapacities[${index}]`));
  } else {
    const weights = surfaces.map((surface) => Math.max(1, Number(surface.dualVoxelCount) || 1));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    resolved = weights.map((weight) => Math.floor(total * weight / weightTotal));
    let remainder = total - resolved.reduce((sum, value) => sum + value, 0);
    for (let index = 0; remainder > 0; index = (index + 1) % resolved.length) {
      resolved[index] += 1;
      remainder -= 1;
    }
  }
  const capacityTotal = resolved.reduce((sum, value) => sum + value, 0);
  if (capacityTotal > total) {
    throw new RangeError('candidate voxel slice capacities exceed the admitted total capacity');
  }
  let cursor = 0;
  const slices = surfaces.map((surface, index) => {
    cursor = Math.ceil(cursor / alignmentU32) * alignmentU32;
    if (!Number.isSafeInteger(cursor) || cursor > U32_MAX) {
      throw new RangeError('aligned candidate voxel slice offset exceeds u32 addressability');
    }
    const slice = {
      surfaceIndex: surface.surfaceIndex,
      surfaceSlot: index,
      offsetU32: cursor,
      offsetBytes: cursor * U32_BYTES,
      capacity: resolved[index],
      counterIndex: index,
      counterOffsetBytes: index * U32_BYTES,
      dispatchIndirectOffsetBytes: index * 3 * U32_BYTES,
      candidateDispatchIndirectOffsetBytes: index * 3 * U32_BYTES,
      countMode: 'gpu-atomic-u32',
      unusedSentinel: SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_VOXEL_UNUSED
    };
    cursor += slice.capacity;
    if (!Number.isSafeInteger(cursor) || cursor > U32_MAX) {
      throw new RangeError('candidate voxel slice end exceeds u32 addressability');
    }
    return slice;
  });
  return {
    schema: 'peercompute.ulg.sph-gpu-sparse-render-field-candidate-slices.v0',
    status: 'candidate-voxel-slices-ready',
    minStorageBufferOffsetAlignment: alignmentBytes,
    alignmentU32,
    capacityTotal,
    bufferWordLength: cursor,
    bufferByteLength: align(cursor * U32_BYTES),
    slices,
    rows: new Uint32Array(slices.flatMap((slice) => [
      slice.offsetU32,
      slice.capacity,
      slice.counterIndex,
      slice.surfaceIndex
    ]))
  };
}

function byteLayout(plan) {
  const retained = {
    surfaceTable: rowBytes(plan.surfaceCount, SPH_SPARSE_RENDER_FIELD_SURFACE_UINTS),
    directory: rowBytes(plan.directoryCapacity, 1),
    routeRows: rowBytes(plan.routeCapacity, SPH_SPARSE_RENDER_FIELD_ROUTE_UINTS),
    routeRanges: rowBytes(plan.directoryCapacity, SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_RANGE_ROW_LAYOUT.length),
    activeBrickRows: rowBytes(plan.activeBrickCapacity, SPH_SPARSE_RENDER_FIELD_ACTIVE_BRICK_UINTS),
    atlas: align(plan.atlasCellCapacity * SPH_SPARSE_RENDER_FIELD_GPU_ATLAS_CELL_FLOATS * F32_BYTES),
    candidateVoxelIds: plan.candidateVoxelSlices.bufferByteLength,
    candidateVoxelSlices: rowBytes(
      plan.surfaceCount,
      SPH_GPU_SPARSE_RENDER_FIELD_CANDIDATE_SLICE_ROW_LAYOUT.length
    ),
    candidateVoxelCounters: rowBytes(plan.surfaceCount, 1),
    candidateDispatchIndirect: rowBytes(plan.surfaceCount, 3),
    evidence: rowBytes(1, SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT.length)
  };
  const scratch = {
    eligibilityFlags: rowBytes(plan.eligibilityCandidateCapacity, 1),
    eligibilityOffsets: rowBytes(plan.eligibilityCandidateCapacity, 1),
    routeKeys: rowBytes(plan.routeCapacity, 1),
    activationFlags: rowBytes(plan.directoryCapacity, 1),
    activePresence: rowBytes(plan.directoryCapacity, 1),
    activeOffsets: rowBytes(plan.directoryCapacity, 1),
    uniqueHomeDispatch: 12,
    activeDispatch: 12,
    emptySource: 128
  };
  const scanLayout = (scanPlan, role) => {
    const persistentBuffers = {};
    for (const level of scanPlan.levels) {
      persistentBuffers[`${role}Level${level.level}BlockSums`] = level.blockSumsByteLength;
      if (level.blockOffsetsByteLength > 0) {
        persistentBuffers[`${role}Level${level.level}BlockOffsets`] = level.blockOffsetsByteLength;
      }
    }
    return {
      persistentBuffers,
      transientBuffers: {
        [`${role}Params`]: scanPlan.levelCount * PARAM_BYTES
      }
    };
  };
  const eligibilityScan = scanLayout(plan.primitivePlans.eligibilityScan, 'eligibilityScan');
  const directoryScan = scanLayout(plan.primitivePlans.directoryScan, 'directoryScan');
  const radixPlan = plan.primitivePlans.routeRadix;
  const radixHistogramScan = scanLayout(radixPlan.histogramScanPlan, 'routeRadixHistogramScan');
  const radixHeadScan = scanLayout(radixPlan.headScanPlan, 'routeRadixHeadScan');
  const primitivePersistent = {
    ...eligibilityScan.persistentBuffers,
    routeRadixSortedIndicesA: radixPlan.sortedIndexByteLength,
    routeRadixSortedIndicesB: radixPlan.sortedIndexByteLength,
    routeRadixHistograms: radixPlan.histogramByteLength,
    routeRadixHistogramOffsets: radixPlan.histogramByteLength,
    routeRadixHeadFlags: radixPlan.headByteLength,
    routeRadixHeadOffsets: radixPlan.headByteLength,
    routeRadixUniqueKeys: radixPlan.uniqueKeyByteLength,
    routeRadixUniqueOffsets: radixPlan.uniqueOffsetByteLength,
    routeRadixEvidence: radixPlan.evidenceByteLength,
    routeRadixIndirectDispatch: radixPlan.indirectDispatchByteLength,
    ...radixHistogramScan.persistentBuffers,
    ...radixHeadScan.persistentBuffers,
    ...directoryScan.persistentBuffers
  };
  const primitiveTransient = {
    ...eligibilityScan.transientBuffers,
    routeRadixParams: Math.max(PARAM_BYTES, radixPlan.passCount * PARAM_BYTES),
    ...radixHistogramScan.transientBuffers,
    routeRadixUniqueParams: PARAM_BYTES,
    ...radixHeadScan.transientBuffers,
    ...directoryScan.transientBuffers,
    generationParams: PARAM_BYTES
  };
  const retainedByteLength = Object.values(retained).reduce((sum, value) => sum + value, 0);
  const directScratchByteLength = Object.values(scratch).reduce((sum, value) => sum + value, 0);
  const primitivePersistentByteLength = Object.values(primitivePersistent)
    .reduce((sum, value) => sum + value, 0);
  const primitiveTransientByteLength = Object.values(primitiveTransient)
    .reduce((sum, value) => sum + value, 0);
  const directAllocatedByteLength = retainedByteLength + directScratchByteLength;
  return {
    retained,
    scratch,
    primitivePersistent,
    primitiveTransient,
    retainedByteLength,
    directScratchByteLength,
    primitivePersistentByteLength,
    primitiveTransientByteLength,
    directAllocatedByteLength,
    plannedAllocatedByteLength: directAllocatedByteLength
      + primitivePersistentByteLength
      + primitiveTransientByteLength,
    peakAllocatedByteLength: directAllocatedByteLength
      + primitivePersistentByteLength
      + primitiveTransientByteLength
  };
}

export function createSphSparseRenderFieldGpuPlan({
  sparsePlan,
  particleCapacity,
  productEventCapacity = 0,
  surfaceMetadata = null,
  maxParticleSurfacesPerSource = null,
  maxProductSurfacesPerEvent = null,
  maxSupportRadiusBricks = 1,
  candidateVoxelCapacities = null,
  minStorageBufferOffsetAlignment = 256,
  maxBufferSize = null,
  maxStorageBufferBindingSize = null,
  maxStorageBuffersPerShaderStage = null,
  maxComputeWorkgroupsPerDimension = 65535
} = {}) {
  if (!sparsePlan?.surfaceTable?.surfaces || !sparsePlan?.capacity?.capacity) {
    throw new TypeError('sparsePlan must be a sparse render-field plan');
  }
  const surfaceCount = u32(sparsePlan.surfaceTable.surfaceCount, 'surfaceCount', { min: 1 });
  const particles = u32(particleCapacity, 'particleCapacity');
  const products = u32(productEventCapacity, 'productEventCapacity');
  const supportRadius = u32(maxSupportRadiusBricks, 'maxSupportRadiusBricks', { max: 64 });
  const derived = deriveSphSparseRenderFieldEligibilityBounds(surfaceMetadata, { surfaceCount });
  const particleBound = u32(
    maxParticleSurfacesPerSource ?? derived.maxParticleSurfacesPerSource,
    'maxParticleSurfacesPerSource',
    { min: 1, max: surfaceCount }
  );
  const productBound = products > 0
    ? u32(
        maxProductSurfacesPerEvent ?? derived.maxProductSurfacesPerEvent,
        'maxProductSurfacesPerEvent',
        { min: 1, max: surfaceCount }
      )
    : 0;
  const eligibilityCandidateCapacity = product(
    [particles + products, surfaceCount],
    'eligibility candidate capacity'
  );
  const routeCapacity = product([
    particles * particleBound + products * productBound,
    1
  ], 'home route capacity');
  const upstream = sparsePlan.capacity.capacity;
  const directoryCapacity = u32(upstream.directoryEntryCount, 'directoryCapacity');
  const activeBrickCapacity = u32(upstream.activeBrickCount, 'activeBrickCapacity');
  const atlasCellCapacity = u32(upstream.atlasCellCount, 'atlasCellCapacity');
  const activeVoxelCapacity = u32(upstream.activeVoxelCount, 'activeVoxelCapacity');
  const candidateVoxelSlices = createSphSparseRenderFieldCandidateVoxelSlices({
    surfaces: sparsePlan.surfaceTable.surfaces,
    totalCapacity: activeVoxelCapacity,
    capacities: candidateVoxelCapacities,
    minStorageBufferOffsetAlignment
  });
  const plan = {
    schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_EXECUTION_SCHEMA,
    generationId: sparsePlan.generationId,
    sparsePlan,
    surfaceCount,
    surfaceMetadata: records(surfaceMetadata),
    particleCapacity: particles,
    productEventCapacity: products,
    eligibility: {
      ...derived,
      maxParticleSurfacesPerSource: particleBound,
      maxProductSurfacesPerEvent: productBound
    },
    eligibilityCandidateCapacity,
    routeCapacity,
    maxSupportRadiusBricks: supportRadius,
    routeFanoutRadiusBricks: supportRadius,
    directoryCapacity,
    activeBrickCapacity,
    atlasCellCapacity,
    activeVoxelCapacity: candidateVoxelSlices.capacityTotal,
    candidateVoxelSlices,
    requiredStorageBuffersPerShaderStage:
      SPH_SPARSE_RENDER_FIELD_REQUIRED_STORAGE_BUFFERS_PER_STAGE,
    maxComputeWorkgroupsPerDimension: u32(
      maxComputeWorkgroupsPerDimension,
      'maxComputeWorkgroupsPerDimension',
      { min: 1 }
    ),
    primitivePlans: {
      eligibilityScan: createWebGpuU32ScanPlan({
        elementCount: Math.max(1, eligibilityCandidateCapacity),
        maxComputeWorkgroupsPerDimension
      }),
      routeRadix: createWebGpuRadixUniquePlan({
        elementCount: Math.max(1, routeCapacity),
        keyWordCount: 1,
        keyStrideWords: 1,
        maxComputeWorkgroupsPerDimension
      }),
      directoryScan: createWebGpuU32ScanPlan({
        elementCount: Math.max(1, directoryCapacity),
        maxComputeWorkgroupsPerDimension
      })
    }
  };
  plan.byteLayout = byteLayout(plan);
  const supportRadiusSurfaces = sparsePlan.surfaceTable.surfaces.map((surface, index) =>
    declaredSurfaceSupportRadiusProof(surface, plan.surfaceMetadata[index], supportRadius));
  const reasons = [];
  let overflowFlags = sparsePlan.capacity.overflowFlags || 0;
  if (!sparsePlan.admission.admitted) reasons.push('sparse-plan-capacity-not-admitted');
  if (supportRadiusSurfaces.some((surface) => !surface.declared)) {
    reasons.push('surface-support-radius-bound-not-proven');
  } else if (supportRadiusSurfaces.some((surface) => !surface.admitted)) {
    reasons.push('surface-support-radius-exceeds-declared-brick-bound');
  }
  if (!derived.conservativeFallback
    && particleBound < derived.maxParticleSurfacesPerSource) {
    reasons.push('particle-surface-bound-below-wildcard-derived-multiplicity');
  }
  if (!derived.conservativeFallback && products > 0
    && productBound < derived.maxProductSurfacesPerEvent) {
    reasons.push('product-surface-bound-below-derived-multiplicity');
  }
  if (sparsePlan.surfaceTable.surfaces.some((surface) => surface.brickSize !== 8)) {
    reasons.push('gpu-sparse-render-field-requires-8-cell-bricks');
  }
  if (u32(upstream.routeCount, 'upstream route capacity') < routeCapacity) {
    reasons.push('home-route-capacity-exceeds-admitted-route-capacity');
    overflowFlags |= SPH_SPARSE_RENDER_FIELD_OVERFLOW_ROUTES;
  }
  if (candidateVoxelSlices.slices.some((slice) => slice.capacity < 1)) {
    reasons.push('candidate-voxel-slice-capacity-must-be-positive');
  }
  if (activeBrickCapacity > Math.floor(U32_MAX / SPH_SPARSE_RENDER_FIELD_GPU_BRICK_VOLUME)) {
    reasons.push('active-brick-atlas-addressing-exceeds-u32');
  }
  for (const [name, value] of Object.entries({
    eligibilityCandidateCapacity,
    routeCapacity,
    directoryCapacity,
    activeBrickCapacity,
    atlasCellCapacity,
    activeVoxelCapacity: plan.activeVoxelCapacity
  })) if (value < 1) reasons.push(`${name}-must-be-positive`);
  for (const [role, bytes] of Object.entries({ ...plan.byteLayout.retained, ...plan.byteLayout.scratch })) {
    if (Number(maxBufferSize) > 0 && bytes > Number(maxBufferSize)) reasons.push(`${role}-exceeds-max-buffer-size`);
    if (Number(maxStorageBufferBindingSize) > 0 && bytes > Number(maxStorageBufferBindingSize)) {
      reasons.push(`${role}-exceeds-max-storage-buffer-binding-size`);
    }
  }
  for (const [role, bytes] of Object.entries({
    ...plan.byteLayout.primitivePersistent,
    ...plan.byteLayout.primitiveTransient
  })) {
    if (Number(maxBufferSize) > 0 && bytes > Number(maxBufferSize)) reasons.push(`${role}-exceeds-max-buffer-size`);
    if (role !== 'generationParams'
      && Number(maxStorageBufferBindingSize) > 0
      && bytes > Number(maxStorageBufferBindingSize)) {
      reasons.push(`${role}-exceeds-max-storage-buffer-binding-size`);
    }
  }
  const maxTotalByteLength = Number(sparsePlan.capacity?.maxTotalByteLength);
  if (maxTotalByteLength > 0 && plan.byteLayout.peakAllocatedByteLength > maxTotalByteLength) {
    reasons.push('planned-allocation-exceeds-max-total-byte-length');
  }
  if (Number(maxStorageBuffersPerShaderStage) > 0
    && Number(maxStorageBuffersPerShaderStage)
      < SPH_SPARSE_RENDER_FIELD_REQUIRED_STORAGE_BUFFERS_PER_STAGE) {
    reasons.push('device-storage-buffers-per-stage-below-field-requirement');
  }
  const maxGroups = plan.maxComputeWorkgroupsPerDimension ** 2;
  if (routeCapacity > maxGroups) {
    reasons.push('unique-home-dispatch-exceeds-2d-dispatch-limit');
  }
  if (candidateVoxelSlices.slices.some((slice) =>
    Math.ceil(slice.capacity / SPH_SPARSE_RENDER_FIELD_CANDIDATE_CONSUMER_WORKGROUP_SIZE)
      > plan.maxComputeWorkgroupsPerDimension)) {
    reasons.push('candidate-consumer-dispatch-exceeds-1d-dispatch-limit');
  }
  if (Math.ceil(eligibilityCandidateCapacity / 64) > maxGroups
    || Math.ceil(directoryCapacity / 64) > maxGroups
    || activeBrickCapacity * 8 > maxGroups) {
    reasons.push('execution-capacity-exceeds-2d-dispatch-limit');
  }
  if (reasons.length > 0) overflowFlags |= SPH_SPARSE_RENDER_FIELD_OVERFLOW_TOTAL_BYTES;
  plan.overflowFlags = overflowFlags;
  plan.reasons = reasons;
  plan.admitted = reasons.length === 0 && overflowFlags === 0;
  plan.failClosed = !plan.admitted;
  plan.retainPreviousAcceptedGeneration = !plan.admitted;
  plan.generationPublicationAllowed = plan.admitted;
  plan.admissionFlags = plan.admitted
    ? SPH_SPARSE_RENDER_FIELD_ADMISSION_APPROVED
    : SPH_SPARSE_RENDER_FIELD_ADMISSION_FAIL_CLOSED
      | SPH_SPARSE_RENDER_FIELD_ADMISSION_RETAIN_PREVIOUS;
  plan.statusId = plan.admitted ? 1 : SPH_SPARSE_RENDER_FIELD_ROW_STATUS_BLOCKED;
  plan.status = plan.admitted
    ? 'sparse-render-field-gpu-plan-ready'
    : 'sparse-render-field-gpu-plan-blocked-fail-closed';
  const fullCartesianEligibilityCount = (particles + products) * surfaceCount;
  const wildcardAwareParticleBound = derived.conservativeFallback
    ? particleBound
    : Math.max(particleBound, derived.maxParticleSurfacesPerSource);
  const wildcardAwareProductBound = derived.conservativeFallback
    ? productBound
    : Math.max(productBound, derived.maxProductSurfacesPerEvent);
  const declaredParticleRouteCount = particles * wildcardAwareParticleBound;
  const declaredProductRouteCount = products * wildcardAwareProductBound;
  const declaredRouteCount = declaredParticleRouteCount + declaredProductRouteCount;
  const fullPaddedDirectoryCellCount = directoryCapacity
    * SPH_SPARSE_RENDER_FIELD_GPU_BRICK_VOLUME;
  const candidateSurfaces = sparsePlan.surfaceTable.surfaces.map((surface, index) => {
    const slice = candidateVoxelSlices.slices[index];
    const requiredDualVoxelCount = Number(surface.dualVoxelCount) || surface.dimensions
      .reduce((count, dimension) => count * Math.max(0, dimension - 1), 1);
    return {
      surfaceIndex: surface.surfaceIndex,
      requiredDualVoxelCount,
      candidateSliceCapacity: slice?.capacity ?? 0,
      candidateSliceOffsetU32: slice?.offsetU32 ?? null,
      admitted: Boolean(slice) && slice.capacity >= requiredDualVoxelCount
    };
  });
  const exactBytePlan = plan.byteLayout.peakAllocatedByteLength
    === plan.byteLayout.retainedByteLength
      + plan.byteLayout.directScratchByteLength
      + plan.byteLayout.primitivePersistentByteLength
      + plan.byteLayout.primitiveTransientByteLength;
  const totalByteLimitAdmitted = !(maxTotalByteLength > 0)
    || plan.byteLayout.peakAllocatedByteLength <= maxTotalByteLength;
  const resourceLimitReasons = reasons.filter((reason) =>
    reason.includes('exceeds-max-buffer-size')
      || reason.includes('exceeds-max-storage-buffer-binding-size')
      || reason.includes('dispatch-exceeds')
      || reason === 'execution-capacity-exceeds-2d-dispatch-limit'
      || reason === 'device-storage-buffers-per-stage-below-field-requirement');
  const exactCapacityProof = {
    schema: 'peercompute.ulg.sph-gpu-sparse-render-field-exact-capacity-proof.v0',
    status: 'sparse-render-field-exact-capacity-proof-pending',
    eligibility: {
      requiredFullCartesianCount: fullCartesianEligibilityCount,
      candidateCapacity: eligibilityCandidateCapacity,
      admitted: eligibilityCandidateCapacity === fullCartesianEligibilityCount
    },
    routes: {
      declaredParticleSourceMultiplicity: declaredParticleRouteCount,
      declaredProductSourceMultiplicity: declaredProductRouteCount,
      requiredDeclaredSourceMultiplicity: declaredRouteCount,
      runtimeRouteCapacity: routeCapacity,
      upstreamRouteCapacity: upstream.routeCount,
      maxParticleSurfacesPerSource: particleBound,
      maxProductSurfacesPerEvent: productBound,
      wildcardAwareParticleSurfacesPerSource: wildcardAwareParticleBound,
      wildcardAwareProductSurfacesPerEvent: wildcardAwareProductBound,
      wildcardAwareEligibilityStatus: derived.status,
      conservativeFallback: derived.conservativeFallback,
      admitted: routeCapacity >= declaredRouteCount && upstream.routeCount >= declaredRouteCount
    },
    activeBricks: {
      requiredFullDirectoryCount: directoryCapacity,
      activeBrickCapacity,
      admitted: activeBrickCapacity >= directoryCapacity
    },
    atlas: {
      requiredFullPaddedDirectoryCellCount: fullPaddedDirectoryCellCount,
      atlasCellCapacity,
      brickCellCount: SPH_SPARSE_RENDER_FIELD_GPU_BRICK_VOLUME,
      admitted: atlasCellCapacity >= fullPaddedDirectoryCellCount
    },
    candidates: {
      surfaces: candidateSurfaces,
      admitted: candidateSurfaces.every((surface) => surface.admitted)
    },
    supportRadius: {
      configuredSupportRadiusBricks: supportRadius,
      surfaces: supportRadiusSurfaces,
      admitted: supportRadiusSurfaces.every((surface) => surface.admitted)
    },
    bytes: {
      retainedByteLength: plan.byteLayout.retainedByteLength,
      directScratchByteLength: plan.byteLayout.directScratchByteLength,
      primitivePersistentByteLength: plan.byteLayout.primitivePersistentByteLength,
      primitiveTransientByteLength: plan.byteLayout.primitiveTransientByteLength,
      peakAllocatedByteLength: plan.byteLayout.peakAllocatedByteLength,
      maxTotalByteLength: maxTotalByteLength > 0 ? maxTotalByteLength : null,
      exactPlan: exactBytePlan,
      admitted: exactBytePlan && totalByteLimitAdmitted
    },
    resources: {
      requiredStorageBuffersPerShaderStage:
        SPH_SPARSE_RENDER_FIELD_REQUIRED_STORAGE_BUFFERS_PER_STAGE,
      maxStorageBuffersPerShaderStage: Number(maxStorageBuffersPerShaderStage) > 0
        ? Number(maxStorageBuffersPerShaderStage)
        : null,
      maxComputeWorkgroupsPerDimension: plan.maxComputeWorkgroupsPerDimension,
      reasons: resourceLimitReasons,
      admitted: resourceLimitReasons.length === 0
    }
  };
  plan.runtimeOverflowImpossibleForDeclaredInputBounds = plan.admitted
    && exactCapacityProof.eligibility.admitted
    && exactCapacityProof.routes.admitted
    && exactCapacityProof.activeBricks.admitted
    && exactCapacityProof.atlas.admitted
    && exactCapacityProof.candidates.admitted
    && exactCapacityProof.supportRadius.admitted
    && exactCapacityProof.bytes.admitted
    && exactCapacityProof.resources.admitted;
  exactCapacityProof.status = plan.runtimeOverflowImpossibleForDeclaredInputBounds
    ? 'sparse-render-field-runtime-overflow-impossible-for-declared-input-bounds'
    : 'sparse-render-field-runtime-overflow-not-proven-for-declared-input-bounds';
  exactCapacityProof.admitted = plan.runtimeOverflowImpossibleForDeclaredInputBounds;
  plan.exactCapacityProof = exactCapacityProof;
  plan.keyWordCount = 1;
  plan.routeKey = 'home-directory-index-u32';
  plan.routeMultiplicity = 'one-route-per-eligible-source-surface';
  plan.activeDiscovery = 'dense-directory-atomic-flags-scan-compact';
  plan.atlasGather = 'bounded-neighbor-home-directory-csr';
  plan.readbackRequired = false;
  plan.submissionOwnership = 'caller';
  plan.maxInFlightEncodedGenerations = 1;
  plan.singleFlightEncodingRequired = true;
  return plan;
}

function assertDevice(device) {
  if (!device?.createBuffer || !device?.createShaderModule || !device?.createComputePipeline
    || !device?.createBindGroup || !device?.queue?.writeBuffer) {
    throw new TypeError('sparse render-field runtime requires a WebGPU-like device');
  }
}

function createBuffer(device, label, bytes, extraUsage = 0) {
  return device.createBuffer({
    label,
    size: align(bytes),
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST | extraUsage
  });
}

function pipeline(device, label, code, entryPoint) {
  const module = device.createShaderModule({ label: `${label}-shader`, code });
  return device.createComputePipeline({ label, layout: 'auto', compute: { module, entryPoint } });
}

function bindGroup(device, target, label, entries) {
  return device.createBindGroup({
    label,
    layout: target.getBindGroupLayout(0),
    entries: Object.entries(entries).map(([binding, buffer]) => ({
      binding: Number(binding), resource: { buffer }
    }))
  });
}

function dispatch(count, maxDimension) {
  const groups = Math.max(1, Math.ceil(Math.max(1, count) / 64));
  const x = Math.min(groups, maxDimension);
  return [x, Math.ceil(groups / x), 1];
}

function encodePass(encoder, target, group, workgroups, profiler, metadata) {
  const descriptor = profiler?.beginComputePassDescriptor
    ? profiler.beginComputePassDescriptor(target.label, metadata)
    : { label: target.label };
  const pass = encoder.beginComputePass(descriptor);
  pass.setPipeline(target);
  pass.setBindGroup(0, group);
  pass.dispatchWorkgroups(...workgroups);
  pass.end();
}

function encodeIndirectPass(encoder, target, group, indirectBuffer, profiler, metadata) {
  const descriptor = profiler?.beginComputePassDescriptor
    ? profiler.beginComputePassDescriptor(target.label, metadata)
    : { label: target.label };
  const pass = encoder.beginComputePass(descriptor);
  pass.setPipeline(target);
  pass.setBindGroup(0, group);
  pass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
  pass.end();
}

function allocationSummary(entries, retainedBuffers) {
  const seen = new Set();
  const buffers = [];
  let allocatedByteLength = 0;
  let retainedByteLength = 0;
  for (const entry of entries) {
    if (!entry?.buffer || seen.has(entry.buffer)) continue;
    seen.add(entry.buffer);
    const byteLength = Number(entry.buffer.size) || 0;
    const retained = retainedBuffers.has(entry.buffer);
    buffers.push({ role: entry.role, byteLength, retained, owned: entry.owned !== false });
    allocatedByteLength += byteLength;
    if (retained) retainedByteLength += byteLength;
  }
  return {
    schema: 'peercompute.ulg.sph-gpu-sparse-render-field-byte-evidence.v0',
    status: 'exact-buffer-byte-evidence-ready',
    allocatedByteLength,
    retainedByteLength,
    scratchByteLength: allocatedByteLength - retainedByteLength,
    bufferCount: buffers.length,
    buffers
  };
}

function words64(value) {
  return [value % U32_BASE, Math.floor(value / U32_BASE)];
}

function writeParams(device, buffer, plan, values, bytes) {
  const data = new ArrayBuffer(PARAM_BYTES);
  const view = new DataView(data);
  const setU32 = (word, value) => view.setUint32(word * 4, value >>> 0, true);
  const setF32 = (word, value) => view.setFloat32(word * 4, Number(value) || 0, true);
  const retained = words64(bytes.retainedByteLength);
  const allocated = words64(bytes.allocatedByteLength);
  setU32(0, values.particleCount);
  setU32(1, values.productEventCount);
  setU32(2, plan.surfaceCount);
  setU32(3, values.eligibilityCandidateCount);
  setU32(4, plan.routeCapacity);
  setU32(5, plan.routeCapacity);
  setU32(6, plan.routeCapacity);
  setU32(7, plan.maxSupportRadiusBricks);
  setU32(8, (plan.maxSupportRadiusBricks * 2 + 1) ** 3);
  setU32(9, plan.generationId);
  setU32(10, plan.directoryCapacity);
  setU32(11, plan.directoryCapacity);
  setU32(12, plan.activeBrickCapacity);
  setU32(13, plan.atlasCellCapacity);
  setU32(14, plan.activeVoxelCapacity);
  setU32(15, plan.overflowFlags);
  setU32(16, plan.admitted ? 1 : 0);
  setU32(17, plan.eligibility.maxParticleSurfacesPerSource);
  setU32(18, plan.eligibility.maxProductSurfacesPerEvent);
  setU32(19, 8);
  setF32(20, values.fieldPadding);
  setF32(21, values.refEdgeM);
  setF32(22, values.renderSmearDtS);
  setU32(24, retained[0]);
  setU32(25, retained[1]);
  setU32(26, allocated[0]);
  setU32(27, allocated[1]);
  setU32(28, plan.maxComputeWorkgroupsPerDimension);
  setU32(29, plan.candidateVoxelSlices.bufferWordLength);
  device.queue.writeBuffer(buffer, 0, data);
}

function sparseRenderFieldStructuralArenaSignature(plan) {
  const retained = plan.byteLayout.retained;
  const scratch = plan.byteLayout.scratch;
  const surfaceTableRows = Array.from(plan.sparsePlan.surfaceTable.rows);
  for (
    let offset = 13;
    offset < surfaceTableRows.length;
    offset += SPH_SPARSE_RENDER_FIELD_SURFACE_UINTS
  ) {
    surfaceTableRows[offset] = 0;
  }
  return JSON.stringify({
    surfaceCount: plan.surfaceCount,
    directoryCapacity: plan.directoryCapacity,
    activeBrickCapacity: plan.activeBrickCapacity,
    atlasCellCapacity: plan.atlasCellCapacity,
    activeVoxelCapacity: plan.activeVoxelCapacity,
    candidateVoxelBufferWordLength: plan.candidateVoxelSlices.bufferWordLength,
    surfaceTableRows,
    candidateVoxelSliceRows: Array.from(plan.candidateVoxelSlices.rows),
    retained: {
      surfaceTable: retained.surfaceTable,
      directory: retained.directory,
      routeRanges: retained.routeRanges,
      activeBrickRows: retained.activeBrickRows,
      atlas: retained.atlas,
      candidateVoxelIds: retained.candidateVoxelIds,
      candidateVoxelSlices: retained.candidateVoxelSlices,
      candidateVoxelCounters: retained.candidateVoxelCounters,
      candidateDispatchIndirect: retained.candidateDispatchIndirect,
      evidence: retained.evidence
    },
    scratch: {
      activationFlags: scratch.activationFlags,
      activePresence: scratch.activePresence,
      activeOffsets: scratch.activeOffsets,
      uniqueHomeDispatch: scratch.uniqueHomeDispatch,
      activeDispatch: scratch.activeDispatch,
      emptySource: scratch.emptySource
    }
  });
}

function createSparseRenderFieldStructuralArena(device, plan, label) {
  const entries = [];
  const retainedBuffers = new Set();
  const allocate = (role, bytes, { retained = false, extraUsage = 0 } = {}) => {
    const buffer = createBuffer(device, `${label}-${role}`, bytes, extraUsage);
    entries.push({ role, buffer, owned: true });
    if (retained) retainedBuffers.add(buffer);
    return buffer;
  };
  const rb = plan.byteLayout.retained;
  const sb = plan.byteLayout.scratch;
  const buffers = {
    surfaceTableBuffer: allocate('surface-table', rb.surfaceTable, { retained: true }),
    directoryBuffer: allocate('directory', rb.directory, { retained: true }),
    routeRangeBuffer: allocate('route-ranges', rb.routeRanges, { retained: true }),
    activeBrickRowsBuffer: allocate('active-brick-rows', rb.activeBrickRows, { retained: true }),
    atlasBuffer: allocate('atlas', rb.atlas, { retained: true }),
    candidateVoxelIdsBuffer: allocate('candidate-voxel-ids', rb.candidateVoxelIds, {
      retained: true
    }),
    candidateVoxelSlicesBuffer: allocate('candidate-voxel-slices', rb.candidateVoxelSlices, {
      retained: true
    }),
    candidateVoxelCountersBuffer: allocate(
      'candidate-voxel-counters', rb.candidateVoxelCounters, { retained: true }
    ),
    candidateDispatchIndirectBuffer: allocate(
      'candidate-dispatch-indirect',
      rb.candidateDispatchIndirect,
      { retained: true, extraUsage: USAGE.INDIRECT }
    ),
    evidenceBuffer: allocate('runtime-evidence', rb.evidence, { retained: true }),
    activationFlagsBuffer: allocate('activation-flags', sb.activationFlags),
    activePresenceBuffer: allocate('active-presence', sb.activePresence),
    activeOffsetsBuffer: allocate('active-offsets', sb.activeOffsets),
    uniqueHomeDispatchBuffer: allocate('unique-home-dispatch', sb.uniqueHomeDispatch, {
      extraUsage: USAGE.INDIRECT
    }),
    activeDispatchBuffer: allocate('active-dispatch', sb.activeDispatch, {
      extraUsage: USAGE.INDIRECT
    }),
    emptySourceBuffer: allocate('empty-source', sb.emptySource)
  };
  device.queue.writeBuffer(buffers.surfaceTableBuffer, 0, plan.sparsePlan.surfaceTable.rows);
  device.queue.writeBuffer(
    buffers.candidateVoxelSlicesBuffer,
    0,
    plan.candidateVoxelSlices.rows
  );
  const directoryScan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: plan.directoryCapacity,
    label: `${label}-directory-scan`
  });
  const signature = sparseRenderFieldStructuralArenaSignature(plan);
  let referenceCount = 1;
  let destroyed = false;
  const arena = {
    schema: 'peercompute.ulg.sph-sparse-render-field-structural-arena.v0',
    status: 'sparse-render-field-structural-arena-ready',
    device,
    signature,
    buffers,
    entries,
    retainedBuffers,
    directoryScan,
    get referenceCount() { return referenceCount; },
    get destroyed() { return destroyed; },
    retain(expectedSignature = signature) {
      if (destroyed) throw new Error('sparse render-field structural arena is destroyed');
      if (expectedSignature !== signature) {
        throw new RangeError('sparse render-field structural arena signature mismatch');
      }
      referenceCount += 1;
      return arena;
    },
    release() {
      if (destroyed || referenceCount < 1) return;
      referenceCount -= 1;
      if (referenceCount > 0) return;
      destroyed = true;
      arena.status = 'sparse-render-field-structural-arena-destroyed';
      directoryScan.destroy();
      for (const entry of entries) entry.buffer.destroy?.();
    }
  };
  return arena;
}

export function createSphSparseRenderFieldGpu(device, options = {}) {
  assertDevice(device);
  const plan = createSphSparseRenderFieldGpuPlan({
    ...options,
    minStorageBufferOffsetAlignment: options.minStorageBufferOffsetAlignment
      ?? device.limits?.minStorageBufferOffsetAlignment
      ?? 256,
    maxBufferSize: options.maxBufferSize ?? device.limits?.maxBufferSize ?? null,
    maxStorageBufferBindingSize: options.maxStorageBufferBindingSize
      ?? device.limits?.maxStorageBufferBindingSize
      ?? null,
    maxStorageBuffersPerShaderStage: options.maxStorageBuffersPerShaderStage
      ?? device.limits?.maxStorageBuffersPerShaderStage
      ?? null,
    maxComputeWorkgroupsPerDimension: options.maxComputeWorkgroupsPerDimension
      ?? device.limits?.maxComputeWorkgroupsPerDimension
      ?? 65535
  });
  const label = options.label || 'ulg-sph-sparse-render-field';
  if (!plan.admitted) {
    return {
      ...plan,
      runtimeStatus: 'sparse-render-field-gpu-runtime-not-created-fail-closed',
      allocationEntries: () => [],
      encode: () => ({
        schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_SCHEMA,
        execution: { schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_EXECUTION_SCHEMA },
        status: 'sparse-render-field-generation-suppressed-fail-closed',
        generationPublicationAllowed: false,
        retainPreviousAcceptedGeneration: true,
        reasons: [...plan.reasons],
        submitted: false,
        readbackPerformed: false,
        transientBuffers: []
      }),
      releaseTransientBuffers() {},
      destroy() {}
    };
  }

  const owned = [];
  const retainedSet = new Set();
  const allocate = (role, bytes, { retained = false, extraUsage = 0 } = {}) => {
    const buffer = createBuffer(device, `${label}-${role}`, bytes, extraUsage);
    owned.push({ role, buffer, owned: true });
    if (retained) retainedSet.add(buffer);
    return buffer;
  };
  const rb = plan.byteLayout.retained;
  const sb = plan.byteLayout.scratch;
  const structuralArenaSignature = sparseRenderFieldStructuralArenaSignature(plan);
  const requestedStructuralArena = options.structuralArena || null;
  if (requestedStructuralArena && requestedStructuralArena.device !== device) {
    throw new TypeError('sparse render-field structural arena belongs to another device');
  }
  const structuralArena = requestedStructuralArena
    ? requestedStructuralArena.retain(structuralArenaSignature)
    : createSparseRenderFieldStructuralArena(device, plan, label);
  const structuralArenaReused = Boolean(requestedStructuralArena);
  const {
    surfaceTableBuffer,
    directoryBuffer,
    routeRangeBuffer,
    activeBrickRowsBuffer,
    atlasBuffer,
    candidateVoxelIdsBuffer,
    candidateVoxelSlicesBuffer,
    candidateVoxelCountersBuffer,
    candidateDispatchIndirectBuffer,
    evidenceBuffer,
    activationFlagsBuffer,
    activePresenceBuffer,
    activeOffsetsBuffer,
    uniqueHomeDispatchBuffer,
    activeDispatchBuffer,
    emptySourceBuffer
  } = structuralArena.buffers;
  for (const buffer of structuralArena.retainedBuffers) retainedSet.add(buffer);
  if (structuralArenaReused) {
    device.queue.writeBuffer(surfaceTableBuffer, 0, plan.sparsePlan.surfaceTable.rows);
    device.queue.writeBuffer(candidateVoxelSlicesBuffer, 0, plan.candidateVoxelSlices.rows);
  }
  const routeRowsBuffer = allocate('route-rows', rb.routeRows, { retained: true });
  const eligibilityFlagsBuffer = allocate('eligibility-flags', sb.eligibilityFlags);
  const eligibilityOffsetsBuffer = allocate('eligibility-offsets', sb.eligibilityOffsets);
  const routeKeysBuffer = allocate('route-keys', sb.routeKeys);

  const eligibilityScan = createWebGpuU32ExclusiveScan(device, {
    maxElementCount: plan.eligibilityCandidateCapacity,
    label: `${label}-eligibility-scan`
  });
  const routeRadix = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: plan.routeCapacity,
    maxKeyWordCount: 1,
    label: `${label}-route-radix`
  });
  const directoryScan = structuralArena.directoryScan;
  const pipelines = {
    initialize: pipeline(
      device, `${label}-initialize`, sphSparseRenderFieldInitializeWgsl, 'initialize_home_sparse_outputs'
    ),
    markEligibility: pipeline(
      device, `${label}-mark-eligibility`, sphSparseRenderFieldHomeRouteWgsl, 'mark_home_route_eligibility'
    ),
    scatterRoutes: pipeline(
      device, `${label}-scatter-home-routes`, sphSparseRenderFieldHomeRouteWgsl, 'scatter_home_routes'
    ),
    finalizeRoutes: pipeline(
      device, `${label}-finalize-home-routes`, sphSparseRenderFieldHomeRouteWgsl, 'finalize_home_routes'
    ),
    finalizeUniqueHomeDispatch: pipeline(
      device,
      `${label}-finalize-unique-home-dispatch`,
      sphSparseRenderFieldDirectoryWgsl,
      'finalize_unique_home_dispatch'
    ),
    activateUniqueHomes: pipeline(
      device,
      `${label}-activate-unique-homes`,
      sphSparseRenderFieldDirectoryWgsl,
      'build_unique_ranges_and_activation'
    ),
    markActive: pipeline(
      device, `${label}-mark-active-directory`, sphSparseRenderFieldDirectoryWgsl, 'mark_active_presence'
    ),
    scatterActive: pipeline(
      device, `${label}-scatter-active-directory`, sphSparseRenderFieldDirectoryWgsl, 'scatter_active_directory'
    ),
    finalizeActive: pipeline(
      device, `${label}-finalize-active-directory`, sphSparseRenderFieldDirectoryWgsl, 'finalize_active_directory'
    ),
    gatherAtlas: pipeline(
      device, `${label}-gather-atlas`, sphSparseRenderFieldGatherAtlasWgsl, 'gather_atlas'
    ),
    compactVoxels: pipeline(
      device, `${label}-compact-surface-voxels`, sphSparseRenderFieldGatherAtlasWgsl, 'compact_surface_voxels'
    ),
    finalizeCandidates: pipeline(
      device, `${label}-finalize-surface-candidates`, sphSparseRenderFieldGatherAtlasWgsl, 'finalize_surface_candidates'
    )
  };
  let destroyed = false;
  const generationParams = new Set();

  function allocationEntries(extra = []) {
    return [
      ...structuralArena.entries.map((entry) => ({
        ...entry,
        owned: !structuralArenaReused
      })),
      ...owned,
      ...eligibilityScan.allocationEntries(),
      ...routeRadix.allocationEntries(),
      ...directoryScan.allocationEntries(),
      ...extra
    ];
  }

  function encode(encoder, {
    renderRowsBuffer = null,
    surfaceBuffer,
    productEventBuffer = null,
    particleCount = 0,
    productEventCount = 0,
    generationId = plan.generationId,
    fieldPadding = 0.08,
    refEdgeM = 1,
    renderSmearDtS = 0,
    backgroundValue = 0,
    timestampProfiler = null,
    timestampMetadata = {}
  } = {}) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
      throw new TypeError('encoding requires a GPUCommandEncoder-like object');
    }
    if (!surfaceBuffer) throw new TypeError('surfaceBuffer is required');
    const particles = u32(particleCount, 'particleCount', { max: plan.particleCapacity });
    const products = u32(productEventCount, 'productEventCount', { max: plan.productEventCapacity });
    if (particles > 0 && !renderRowsBuffer) throw new TypeError('particleCount requires renderRowsBuffer');
    if (products > 0 && !productEventBuffer) throw new TypeError('productEventCount requires productEventBuffer');
    if (generationId !== plan.generationId) throw new RangeError('generationId does not match the plan');
    if (!Number.isFinite(Number(backgroundValue)) || Number(backgroundValue) !== 0) {
      throw new RangeError('sparse render-field backgroundValue must be 0 to match dense render-field semantics');
    }
    if (generationParams.size > 0) {
      throw Object.assign(
        new Error('sparse render-field runtime permits only one live encoded generation'),
        { status: 'sparse-render-field-encode-blocked-generation-in-flight' }
      );
    }
    const eligibilityCandidateCount = (particles + products) * plan.surfaceCount;
    const paramsBuffer = device.createBuffer({
      label: `${label}-params-${generationId}`,
      size: PARAM_BYTES,
      usage: USAGE.UNIFORM | USAGE.COPY_DST
    });
    generationParams.add(paramsBuffer);
    const sourceRows = renderRowsBuffer || emptySourceBuffer;
    const productRows = productEventBuffer || emptySourceBuffer;
    for (const buffer of [
      directoryBuffer,
      routeRowsBuffer,
      routeRangeBuffer,
      activeBrickRowsBuffer,
      atlasBuffer,
      candidateVoxelCountersBuffer,
      candidateDispatchIndirectBuffer,
      evidenceBuffer,
      eligibilityFlagsBuffer,
      eligibilityOffsetsBuffer,
      activationFlagsBuffer,
      activePresenceBuffer,
      activeOffsetsBuffer,
      uniqueHomeDispatchBuffer,
      activeDispatchBuffer
    ]) encoder.clearBuffer(buffer);
    const meta = (stage) => ({ ...timestampMetadata, stage, generationId });
    const group = (target, suffix, entries) => bindGroup(device, target, `${label}-${suffix}`, entries);
    encodePass(
      encoder,
      pipelines.initialize,
      group(pipelines.initialize, 'initialize-group', {
        0: directoryBuffer,
        1: routeRangeBuffer,
        2: routeKeysBuffer,
        5: candidateVoxelIdsBuffer,
        6: evidenceBuffer,
        7: paramsBuffer
      }),
      dispatch(Math.max(
        plan.directoryCapacity,
        plan.routeCapacity,
        plan.candidateVoxelSlices.bufferWordLength
      ), plan.maxComputeWorkgroupsPerDimension),
      timestampProfiler,
      meta('initialize')
    );
    encodePass(
      encoder,
      pipelines.markEligibility,
      group(pipelines.markEligibility, 'mark-eligibility-group', {
        0: sourceRows,
        1: surfaceBuffer,
        3: productRows,
        4: eligibilityFlagsBuffer,
        9: paramsBuffer
      }),
      dispatch(eligibilityCandidateCount, plan.maxComputeWorkgroupsPerDimension),
      timestampProfiler,
      meta('mark-eligibility')
    );
    const eligibilityScanEncoding = eligibilityScan.encode(encoder, {
      inputBuffer: eligibilityFlagsBuffer,
      outputBuffer: eligibilityOffsetsBuffer,
      elementCount: eligibilityCandidateCount
    }, { timestampProfiler, timestampMetadata: meta('eligibility-scan') });
    encodePass(
      encoder,
      pipelines.scatterRoutes,
      group(pipelines.scatterRoutes, 'scatter-routes-group', {
        0: sourceRows,
        1: surfaceBuffer,
        2: surfaceTableBuffer,
        3: productRows,
        4: eligibilityFlagsBuffer,
        5: eligibilityOffsetsBuffer,
        6: routeRowsBuffer,
        7: routeKeysBuffer,
        8: evidenceBuffer,
        9: paramsBuffer
      }),
      dispatch(eligibilityCandidateCount, plan.maxComputeWorkgroupsPerDimension),
      timestampProfiler,
      meta('scatter-home-routes')
    );
    encodePass(
      encoder,
      pipelines.finalizeRoutes,
      group(pipelines.finalizeRoutes, 'finalize-routes-group', {
        4: eligibilityFlagsBuffer,
        5: eligibilityOffsetsBuffer,
        8: evidenceBuffer,
        9: paramsBuffer
      }),
      [1, 1, 1],
      timestampProfiler,
      meta('finalize-home-routes')
    );
    const routeSort = routeRadix.encodeSortUnique(encoder, {
      keyBuffer: routeKeysBuffer,
      elementCount: plan.routeCapacity,
      keyWordCount: 1,
      keyStrideWords: 1,
      consumerWorkgroupSize: 1,
      generationId,
      timestampProfiler,
      timestampMetadata: meta('route-radix')
    });
    encodePass(
      encoder,
      pipelines.finalizeUniqueHomeDispatch,
      group(pipelines.finalizeUniqueHomeDispatch, 'finalize-unique-home-dispatch-group', {
        10: evidenceBuffer,
        15: routeSort.uniqueEvidenceBuffer,
        16: uniqueHomeDispatchBuffer,
        12: paramsBuffer
      }),
      [1, 1, 1],
      timestampProfiler,
      meta('finalize-unique-home-dispatch')
    );
    encodeIndirectPass(
      encoder,
      pipelines.activateUniqueHomes,
      group(pipelines.activateUniqueHomes, 'activate-unique-homes-group', {
        0: routeSort.sortedIndicesBuffer,
        1: routeRowsBuffer,
        2: routeKeysBuffer,
        3: routeRangeBuffer,
        4: activationFlagsBuffer,
        7: surfaceTableBuffer,
        10: evidenceBuffer,
        12: paramsBuffer,
        13: routeSort.uniqueKeysBuffer,
        14: routeSort.uniqueOffsetsBuffer,
        15: routeSort.uniqueEvidenceBuffer
      }),
      uniqueHomeDispatchBuffer,
      timestampProfiler,
      meta('activate-unique-homes-indirect')
    );
    encodePass(
      encoder,
      pipelines.markActive,
      group(pipelines.markActive, 'mark-active-group', {
        4: activationFlagsBuffer,
        5: activePresenceBuffer,
        12: paramsBuffer
      }),
      dispatch(plan.directoryCapacity, plan.maxComputeWorkgroupsPerDimension),
      timestampProfiler,
      meta('mark-active-directory')
    );
    const directoryScanEncoding = directoryScan.encode(encoder, {
      inputBuffer: activePresenceBuffer,
      outputBuffer: activeOffsetsBuffer,
      elementCount: plan.directoryCapacity
    }, { timestampProfiler, timestampMetadata: meta('directory-scan') });
    encodePass(
      encoder,
      pipelines.scatterActive,
      group(pipelines.scatterActive, 'scatter-active-group', {
        3: routeRangeBuffer,
        4: activationFlagsBuffer,
        5: activePresenceBuffer,
        6: activeOffsetsBuffer,
        7: surfaceTableBuffer,
        8: activeBrickRowsBuffer,
        9: directoryBuffer,
        10: evidenceBuffer,
        12: paramsBuffer
      }),
      dispatch(plan.directoryCapacity, plan.maxComputeWorkgroupsPerDimension),
      timestampProfiler,
      meta('scatter-active-directory')
    );
    encodePass(
      encoder,
      pipelines.finalizeActive,
      group(pipelines.finalizeActive, 'finalize-active-group', {
        5: activePresenceBuffer,
        6: activeOffsetsBuffer,
        10: evidenceBuffer,
        11: activeDispatchBuffer,
        12: paramsBuffer
      }),
      [1, 1, 1],
      timestampProfiler,
      meta('finalize-active-directory')
    );
    encodeIndirectPass(
      encoder,
      pipelines.gatherAtlas,
      group(pipelines.gatherAtlas, 'gather-atlas-group', {
        0: sourceRows,
        1: surfaceBuffer,
        2: surfaceTableBuffer,
        3: productRows,
        4: routeSort.sortedIndicesBuffer,
        5: routeRowsBuffer,
        6: routeRangeBuffer,
        7: activeBrickRowsBuffer,
        8: atlasBuffer,
        14: paramsBuffer
      }),
      activeDispatchBuffer,
      timestampProfiler,
      meta('gather-atlas-indirect')
    );
    encodeIndirectPass(
      encoder,
      pipelines.compactVoxels,
      group(pipelines.compactVoxels, 'compact-voxels-group', {
        1: surfaceBuffer,
        2: surfaceTableBuffer,
        7: activeBrickRowsBuffer,
        8: atlasBuffer,
        9: directoryBuffer,
        10: candidateVoxelSlicesBuffer,
        11: candidateVoxelIdsBuffer,
        12: candidateVoxelCountersBuffer,
        13: evidenceBuffer,
        14: paramsBuffer
      }),
      activeDispatchBuffer,
      timestampProfiler,
      meta('compact-surface-voxels-indirect')
    );
    encodePass(
      encoder,
      pipelines.finalizeCandidates,
      group(pipelines.finalizeCandidates, 'finalize-candidates-group', {
        10: candidateVoxelSlicesBuffer,
        12: candidateVoxelCountersBuffer,
        13: evidenceBuffer,
        14: paramsBuffer,
        15: candidateDispatchIndirectBuffer
      }),
      [1, 1, 1],
      timestampProfiler,
      meta('finalize-surface-candidates')
    );
    const transientEntry = { role: 'generation-params', buffer: paramsBuffer, owned: true };
    const bytes = allocationSummary(allocationEntries([transientEntry]), retainedSet);
    writeParams(device, paramsBuffer, plan, {
      particleCount: particles,
      productEventCount: products,
      eligibilityCandidateCount,
      fieldPadding,
      refEdgeM,
      renderSmearDtS
    }, bytes);
    const execution = {
      schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_EXECUTION_SCHEMA,
      status: 'sparse-render-field-gpu-generation-encoded',
      generationId,
      submitted: false,
      readbackPerformed: false,
      submissionOwnership: 'caller',
      generationPublicationEvidenceRequired: true,
      productEventCount: products,
      productEventCapacity: plan.productEventCapacity,
      productEventCapacityHeadroom: plan.productEventCapacity - products,
      exactProductEventCountPreserved: true,
      runtimeEvidenceBuffer: evidenceBuffer,
      byteEvidence: bytes,
      sharedEncodings: { eligibilityScanEncoding, routeSort, directoryScanEncoding },
      transientBuffers: [
        paramsBuffer,
        ...(eligibilityScanEncoding.transientBuffers || []),
        ...(routeSort.transientBuffers || []),
        ...(directoryScanEncoding.transientBuffers || [])
      ]
    };
    const artifact = {
      schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_SCHEMA,
      status: 'sparse-render-field-gpu-artifact-encoded',
      execution,
      executionSchema: execution.schema,
      generationId,
      plan: plan.sparsePlan,
      gpuPlan: plan,
      productEventCount: products,
      productEventCapacity: plan.productEventCapacity,
      productEventCapacityHeadroom: plan.productEventCapacity - products,
      exactProductEventCountPreserved: true,
      surfaceTable: {
        ...plan.sparsePlan.surfaceTable,
        metadata: [...plan.surfaceMetadata],
        buffer: surfaceTableBuffer,
        byteLength: surfaceTableBuffer.size
      },
      directoryBuffer,
      directoryBufferByteLength: directoryBuffer.size,
      routeRowsBuffer,
      routeRowsBufferByteLength: routeRowsBuffer.size,
      sortedRouteIndicesBuffer: routeSort.sortedIndicesBuffer,
      uniqueRouteKeysBuffer: routeSort.uniqueKeysBuffer,
      uniqueRouteOffsetsBuffer: routeSort.uniqueOffsetsBuffer,
      uniqueRouteEvidenceBuffer: routeSort.uniqueEvidenceBuffer,
      uniqueHomeDispatchBuffer,
      routeRangeBuffer,
      routeRangeBufferByteLength: routeRangeBuffer.size,
      activeBrickRowsBuffer,
      activeBrickRowsBufferByteLength: activeBrickRowsBuffer.size,
      activeBrickCapacity: plan.activeBrickCapacity,
      atlasBuffer,
      atlasCellBuffer: atlasBuffer,
      atlasBufferByteLength: atlasBuffer.size,
      atlasCellCapacity: plan.atlasCellCapacity,
      atlasCellStrideBytes: 32,
      candidateVoxelIdsBuffer,
      activeVoxelIdsBuffer: candidateVoxelIdsBuffer,
      candidateVoxelIdsBufferByteLength: candidateVoxelIdsBuffer.size,
      candidateDispatchIndirectBuffer,
      candidateDispatchIndirectBufferByteLength: candidateDispatchIndirectBuffer.size,
      candidateDispatchWorkgroupSize: SPH_SPARSE_RENDER_FIELD_CANDIDATE_CONSUMER_WORKGROUP_SIZE,
      candidateVoxelSlices: plan.candidateVoxelSlices.slices.map((slice) => ({
        ...slice,
        countBuffer: candidateVoxelCountersBuffer,
        candidateDispatchIndirectBuffer,
        candidateDispatchIndirectByteLength: 3 * U32_BYTES
      })),
      candidateVoxelSlicesBuffer,
      candidateVoxelCountersBuffer,
      candidateVoxelCapacity: plan.activeVoxelCapacity,
      candidateVoxelUnusedSentinel: SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_VOXEL_UNUSED,
      exactCapacityProof: plan.exactCapacityProof,
      runtimeOverflowImpossibleForDeclaredInputBounds:
        plan.runtimeOverflowImpossibleForDeclaredInputBounds,
      runtimeEvidenceBuffer: evidenceBuffer,
      byteEvidence: bytes,
      fieldPadding,
      refEdgeM,
      backgroundValue,
      sameDeviceRequired: true,
      sparse: true,
      denseScatterFinalPath: false,
      generationPublicationAllowed: null,
      generationPublicationEvidenceRequired: true,
      retainPreviousAcceptedGenerationUntilEvidence: true,
      submitted: false,
      readbackPerformed: false,
      transientBuffers: execution.transientBuffers,
      releaseTransientBuffers: () => runtime.releaseTransientBuffers(artifact),
      destroySparseRenderFieldBuffers: () => runtime.destroy(),
      destroyRenderFieldBuffers: () => runtime.destroy(),
      cleanup: {
        submissionOwnership: 'caller',
        releaseTransientBuffers: () => runtime.releaseTransientBuffers(artifact),
        destroyRetainedBuffers: () => runtime.destroy()
      }
    };
    return artifact;
  }

  const runtime = {
    ...plan,
    runtimeStatus: 'sparse-render-field-gpu-runtime-ready',
    structuralArena,
    structuralArenaReused,
    structuralArenaSignature,
    buffers: {
      surfaceTableBuffer,
      directoryBuffer,
      routeRowsBuffer,
      routeRangeBuffer,
      activeBrickRowsBuffer,
      atlasBuffer,
      candidateVoxelIdsBuffer,
      candidateVoxelSlicesBuffer,
      candidateVoxelCountersBuffer,
      candidateDispatchIndirectBuffer,
      evidenceBuffer,
      uniqueHomeDispatchBuffer,
      activeDispatchBuffer
    },
    encode,
    allocationEntries,
    releaseTransientBuffers(artifact) {
      const execution = artifact?.execution || artifact;
      eligibilityScan.releaseTransientBuffers(execution?.sharedEncodings?.eligibilityScanEncoding);
      routeRadix.releaseTransientBuffers(execution?.sharedEncodings?.routeSort);
      directoryScan.releaseTransientBuffers(execution?.sharedEncodings?.directoryScanEncoding);
      const paramsBuffer = execution?.transientBuffers?.[0];
      if (generationParams.delete(paramsBuffer)) paramsBuffer?.destroy?.();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      eligibilityScan.destroy();
      routeRadix.destroy();
      structuralArena.release();
      for (const paramsBuffer of generationParams) paramsBuffer.destroy?.();
      generationParams.clear();
      for (const entry of owned) entry.buffer.destroy?.();
    }
  };
  return runtime;
}
