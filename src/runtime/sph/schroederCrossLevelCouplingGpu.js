import {
  MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_ROW_LAYOUT,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_BYTES,
  ULG_SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_EXECUTION_SCHEMA,
  decodeSchroederCrossLevelInvariantEvidence
} from '../../../ulg-gpu-abi/src/schroederCrossLevelInvariantEvidence.js';
import {
  schroederCrossLevelInvariantEvidenceWgsl
} from '../../../ulg-gpu-abi/src/schroederCrossLevelInvariantEvidenceWgsl.js';
import {
  validateSchroederSpatialHierarchyViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialHierarchyView.js';
import {
  schroederCrossLevelGridConservationSummaryWgsl,
  schroederCrossLevelGridProlongationCompactWgsl,
  schroederCrossLevelGridProlongationWgsl,
  schroederCrossLevelGridRestrictionCompactWgsl,
  schroederCrossLevelGridRestrictionWgsl,
  schroederCrossLevelGridVelocityDeltaProlongationCompactWgsl,
  schroederCrossLevelGridVelocityDeltaProlongationWgsl,
  schroederSameGridMomentumAccumulationWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import { webGpuBufferMatchesDevice } from './sphGpuDeviceIdentity.js';
import {
  createSchroederCrossLevelRefluxLedgerGpu,
  directSchroederSpatialParentFieldMechanicsWorkspaceGpu
} from './schroederSpatialParentFieldMechanicsWorkspaceGpu.js';
import {
  abandonSchroederFusedMechanicsPendingClosureAfter,
  abortSchroederTwoLevelMacroAuthorityAfter,
  createSchroederCanonicalParticleContinuation,
  createSchroederFineMicroepochAuthority,
  createSchroederFusedCoarseTerminalTransaction,
  createSchroederFusedFineSubstepTransaction,
  createSchroederFusedMechanicsPendingClosure,
  createSchroederTwoLevelMacroAuthority,
  retireSchroederCanonicalParticleContinuationOutputAfter,
  retireSchroederFineMicroepochAfter
} from './schroederFusedFineSubstepGpu.js';
import {
  MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL,
  runMlsMpmResidentSummaryWebGpu
} from './sphMlsMpmGpuSummary.js';
import { DEFAULT_CFL_FACTOR } from './sphGridUpdateGpuKernel.js';
import {
  MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
} from './sphGridGpuKernel.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  sphParticleStateRequiresExplicitIdentity
} from './sphGpuBuffers.js';

export {
  ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_SCHEMA
};

export const MLS_MPM_GPU_GRID_NODE_FLOATS = MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_FLOATS =
  SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_ROW_LAYOUT.length;
export const SCHROEDER_GRID_COUPLING_WORKGROUP_SIZE = 64;
export const SCHROEDER_GRID_COUPLING_FLAG_ACCUMULATE = 1;
export const SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST = 2;
// Grid slots 1-3 hold velocity (post-grid-update layout) instead of
// momentum; prolongation interpolates coarse velocity onto massive fine nodes.
export const SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS = 4;
export const SCHROEDER_GRID_COUPLING_FLAG_PRE_VELOCITY_GRID = 8;
export const SCHROEDER_GRID_COUPLING_PARAMS_BYTES = 96;
// Index order of the flat grid-node arrays. The standalone operator tests use
// 'x-fastest'; real MLS-MPM P2G grids from createMlsMpmGridSpec use
// 'z-fastest' with gridShift 1 (see gridNodeCoords in sphGridGpuKernel.js).
export const SCHROEDER_GRID_INDEX_ORDER_X_FASTEST = 'x-fastest';
export const SCHROEDER_GRID_INDEX_ORDER_Z_FASTEST = 'z-fastest';
export const SCHROEDER_NO_FULL_READBACK_MODE = 'no-full-readback';
export const SCHROEDER_COMPACT_GRID_CONSERVATION_READBACK_MODE =
  'compact-grid-conservation-summary-readback';

const DIRECT_PARENT_FIELD_MECHANICS_ARENA_COUNT = (() => {
  const requested = Number(
    import.meta.env?.VITE_ULG_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_COUNT
      ?? import.meta.env?.VITE_ULG_SCHROEDER_SPATIAL_ARENA_COUNT
      ?? 3
  );
  return Number.isInteger(requested) && requested >= 1 && requested <= 8
    ? requested
    : 3;
})();

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveInteger(value, fallback = 1) {
  const number = Math.round(finiteNumber(value, fallback));
  return number > 0 ? number : fallback;
}

function gridDims3(dims, fallback = [2, 2, 2]) {
  const source = Array.isArray(dims) ? dims : [];
  return [
    positiveInteger(source[0], fallback[0]),
    positiveInteger(source[1], fallback[1]),
    positiveInteger(source[2], fallback[2])
  ];
}

function minimumCoarseAxisForAffineSupport(fineAxis, shift) {
  return Math.max(1, Math.ceil((fineAxis - 1 + shift) / 2) + 1);
}

function writeStorageBuffer(device, label, rows, extraUsage = 0) {
  const buffer = device.createBuffer({
    label,
    size: Math.max(16, rows.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC | extraUsage
  });
  device.queue.writeBuffer(buffer, 0, rows);
  return buffer;
}

/**
 * Plan for one restriction/prolongation coupling between an SS fine level and
 * the adjacent coarse level (spacing exactly doubles). Restriction and
 * prolongation use the same tensor-product linear basis. Every fine node has
 * one, two, four, or eight exactly representable (1, 1/2, 1/4, 1/8) parent
 * weights, so the transfer is a partition of unity and reproduces first
 * moments/affine coarse fields when the padded support is complete.
 */
export function createSchroederCrossLevelGridCouplingPlan({
  fineGridDims,
  fineGridSpacingM = 1,
  gridOriginM = [0, 0, 0],
  gridStrideFloats = MLS_MPM_GPU_GRID_NODE_FLOATS,
  couplingEpoch = 0,
  indexOrder = SCHROEDER_GRID_INDEX_ORDER_X_FASTEST,
  gridShift = 0,
  accumulate = false,
  velocityGrids = false,
  preVelocityGrid = false,
  coarseGridDims = null,
  boxDimsM = null,
  deltaScale = 0,
  sharedAccelerationDtMPerS = null,
  maxCoarseVelocityMPerS = 0,
  flags = 0
} = {}) {
  const fineDims = gridDims3(fineGridDims);
  const shift = Math.max(0, Math.round(finiteNumber(gridShift, 0)));
  // Linear transfer needs both coarse endpoints around every odd fine node.
  // This is one more endpoint than the old disjoint 2x2x2 agglomeration for
  // some even/shifted synthetic grids. Mounted MLS-MPM grids carry +5 ghost
  // padding and satisfy this contract naturally.
  const minimumCoarseDims = fineDims.map((n) => (
    minimumCoarseAxisForAffineSupport(n, shift)
  ));
  const coarseDims = coarseGridDims
    ? gridDims3(coarseGridDims)
    : minimumCoarseDims;
  if (coarseDims.some((value, axis) => value < minimumCoarseDims[axis])) {
    throw new RangeError(
      `coarseGridDims must provide complete affine support; minimum is ${minimumCoarseDims.join('x')}`
    );
  }
  const zFastest = indexOrder === SCHROEDER_GRID_INDEX_ORDER_Z_FASTEST;
  const resolvedFlags = (Math.max(0, Math.round(finiteNumber(flags, 0)))
    | (accumulate ? SCHROEDER_GRID_COUPLING_FLAG_ACCUMULATE : 0)
    | (zFastest ? SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST : 0)
    | (velocityGrids ? SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS : 0)
    | (preVelocityGrid ? SCHROEDER_GRID_COUPLING_FLAG_PRE_VELOCITY_GRID : 0)) >>> 0;
  const strideFloats = positiveInteger(gridStrideFloats, MLS_MPM_GPU_GRID_NODE_FLOATS);
  const fineNodeCount = fineDims[0] * fineDims[1] * fineDims[2];
  const coarseNodeCount = coarseDims[0] * coarseDims[1] * coarseDims[2];
  const origin = [
    finiteNumber(gridOriginM?.[0], 0),
    finiteNumber(gridOriginM?.[1], 0),
    finiteNumber(gridOriginM?.[2], 0)
  ];
  return {
    schema: ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_SCHEMA,
    status: 'schroeder-cross-level-grid-coupling-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-cross-level-grid-coupling',
    couplingMode: 'full-weighting-restriction-trilinear-prolongation',
    fineGridDims: fineDims,
    coarseGridDims: coarseDims,
    fineNodeCount,
    coarseNodeCount,
    fineGridSpacingM: Math.max(1e-12, finiteNumber(fineGridSpacingM, 1)),
    coarseGridSpacingM: Math.max(1e-12, finiteNumber(fineGridSpacingM, 1)) * 2,
    gridOriginM: origin,
    gridStrideFloats: strideFloats,
    gridStrideBytes: strideFloats * Float32Array.BYTES_PER_ELEMENT,
    fineGridByteLength: Math.max(16, fineNodeCount * strideFloats * Float32Array.BYTES_PER_ELEMENT),
    coarseGridByteLength: Math.max(16, coarseNodeCount * strideFloats * Float32Array.BYTES_PER_ELEMENT),
    summaryRowLayout: [...SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_ROW_LAYOUT],
    summaryStrideFloats: SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_FLOATS,
    summaryByteLength: SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_FLOATS
      * Float32Array.BYTES_PER_ELEMENT,
    conservedQuantities: [
      'mass',
      'first-mass-moment',
      'linear-momentum',
      'grid-orbital-angular-momentum'
    ],
    partitionOfUnity: 'exact-dyadic-interior-fail-closed-incomplete-support',
    affineReproduction: 'coarse-affine-field-exact-dyadic-interpolation',
    representedInternalEnergyPolicy: 'particle-owned-unchanged-by-grid-transfer',
    minimumCoarseGridDims: minimumCoarseDims,
    couplingEpoch: Math.max(0, Math.round(finiteNumber(couplingEpoch, 0))),
    indexOrder: zFastest
      ? SCHROEDER_GRID_INDEX_ORDER_Z_FASTEST
      : SCHROEDER_GRID_INDEX_ORDER_X_FASTEST,
    gridShift: shift,
    accumulate: (resolvedFlags & SCHROEDER_GRID_COUPLING_FLAG_ACCUMULATE) !== 0,
    velocityGrids: (resolvedFlags & SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS) !== 0,
    preVelocityGrid:
      (resolvedFlags & SCHROEDER_GRID_COUPLING_FLAG_PRE_VELOCITY_GRID) !== 0,
    deltaScale: Math.max(0, finiteNumber(deltaScale, 0)),
    // Velocity change per coarse dt that the fine level integrates itself
    // (gravity etc.); the delta prolongation subtracts it to avoid double
    // counting shared forces.
    sharedAccelerationDtMPerS: [
      finiteNumber(sharedAccelerationDtMPerS?.[0], 0),
      finiteNumber(sharedAccelerationDtMPerS?.[1], 0),
      finiteNumber(sharedAccelerationDtMPerS?.[2], 0)
    ],
    // CFL velocity ceiling of the coarse grid update (cfl * coarse_dx /
    // coarse_dt); the delta prolongation clamps its raw momentum/mass
    // parent read to it. Zero disables the clamp.
    maxCoarseVelocityMPerS: Math.max(0, finiteNumber(maxCoarseVelocityMPerS, 0)),
    // Sealed-box dims enable the delta-prolongation boundary-band mask; zero
    // dims disable it (open/chartless grids).
    boxDimsM: [
      Math.max(0, finiteNumber(boxDimsM?.[0], 0)),
      Math.max(0, finiteNumber(boxDimsM?.[1], 0)),
      Math.max(0, finiteNumber(boxDimsM?.[2], 0))
    ],
    flags: resolvedFlags,
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederCrossLevelGridCouplingParamsArray(plan) {
  const buffer = new ArrayBuffer(SCHROEDER_GRID_COUPLING_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, plan.fineGridDims[0], true);
  view.setUint32(4, plan.fineGridDims[1], true);
  view.setUint32(8, plan.fineGridDims[2], true);
  view.setUint32(12, plan.coarseGridDims[0], true);
  view.setUint32(16, plan.coarseGridDims[1], true);
  view.setUint32(20, plan.coarseGridDims[2], true);
  view.setUint32(24, plan.gridStrideFloats, true);
  view.setUint32(28, plan.flags, true);
  view.setFloat32(32, plan.fineGridSpacingM, true);
  view.setFloat32(36, plan.gridOriginM[0], true);
  view.setFloat32(40, plan.gridOriginM[1], true);
  view.setFloat32(44, plan.gridOriginM[2], true);
  view.setInt32(48, plan.gridShift ?? 0, true);
  view.setFloat32(52, plan.boxDimsM?.[0] ?? 0, true);
  view.setFloat32(56, plan.boxDimsM?.[1] ?? 0, true);
  view.setFloat32(60, plan.boxDimsM?.[2] ?? 0, true);
  // Subcycled fine substeps apply their share of the coarse correction;
  // zero encodes the default full delta.
  view.setFloat32(64, finiteNumber(plan.deltaScale, 0), true);
  view.setFloat32(68, finiteNumber(plan.sharedAccelerationDtMPerS?.[0], 0), true);
  view.setFloat32(72, finiteNumber(plan.sharedAccelerationDtMPerS?.[1], 0), true);
  view.setFloat32(76, finiteNumber(plan.sharedAccelerationDtMPerS?.[2], 0), true);
  view.setFloat32(80, finiteNumber(plan.maxCoarseVelocityMPerS, 0), true);
  return buffer;
}

function resolveGridInput(device, label, { buffer = null, rows = null } = {}) {
  if (buffer) return { gridBuffer: buffer, borrowed: true };
  if (rows instanceof Float32Array) {
    return { gridBuffer: writeStorageBuffer(device, label, rows), borrowed: false };
  }
  throw new TypeError(`${label} requires a retained GPU grid buffer or explicit Float32Array rows`);
}

function assertWebGpuDevice(device, caller) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError(`${caller} requires a WebGPU-like device with queue.writeBuffer`);
  }
}

function resolveCompactHierarchyView(device, hierarchyView, plan) {
  if (!hierarchyView) return null;
  const admission = validateSchroederSpatialHierarchyViewDescriptor(hierarchyView);
  const fineDims = Array.from(hierarchyView.fineGrid?.gridDims || []);
  const coarseDims = Array.from(hierarchyView.coarseGrid?.gridDims || []);
  const shapeAdmitted = admission.admitted === true
    && fineDims.length === 3
    && coarseDims.length === 3
    && fineDims.every((value, axis) => value === plan.fineGridDims[axis])
    && coarseDims.every((value, axis) => value === plan.coarseGridDims[axis])
    && hierarchyView.fineGrid?.gridShift === plan.gridShift
    && hierarchyView.coarseGrid?.gridShift === plan.gridShift
    && hierarchyView.fineGrid?.gridSpacingM === plan.fineGridSpacingM
    && hierarchyView.coarseGrid?.gridSpacingM === plan.coarseGridSpacingM
    && hierarchyView.hierarchyViewBuffer
    && webGpuBufferMatchesDevice(hierarchyView.hierarchyViewBuffer, device);
  if (!shapeAdmitted) {
    const error = new TypeError(
      `cross-level compact hierarchy rejected: ${admission.status}`
    );
    error.code = 'ERR_SCHROEDER_CROSS_LEVEL_HIERARCHY_REJECTED';
    error.admission = admission;
    throw error;
  }
  return hierarchyView;
}

/**
 * Restrict fine-level grid mass/momentum into the adjacent coarse level.
 * Emits a retained coarse grid buffer in the standard MLS-MPM grid-node row
 * layout without any full readback on the default path.
 */
export async function runSchroederCrossLevelGridRestrictionWebGpu({
  device,
  plan = null,
  fineGridBuffer = null,
  fineGridRows = null,
  coarseGridBuffer = null,
  hierarchyView = null,
  retainCoarseGridBuffer = true,
  ...planOptions
} = {}) {
  assertWebGpuDevice(device, 'runSchroederCrossLevelGridRestrictionWebGpu');
  const resolvedPlan = plan || createSchroederCrossLevelGridCouplingPlan(planOptions);
  const compactHierarchy = resolveCompactHierarchyView(device, hierarchyView, resolvedPlan);
  const fine = resolveGridInput(device, 'ulg-schroeder-grid-restriction-fine-in', {
    buffer: fineGridBuffer,
    rows: fineGridRows
  });
  const coarse = coarseGridBuffer
    ? { gridBuffer: coarseGridBuffer, borrowed: true }
    : {
      gridBuffer: device.createBuffer({
        label: 'ulg-schroeder-grid-restriction-coarse-out',
        size: resolvedPlan.coarseGridByteLength,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      }),
      borrowed: false
    };
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-grid-restriction-params',
    size: SCHROEDER_GRID_COUPLING_PARAMS_BYTES,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  let returnedRetainedCoarseBuffer = false;
  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelGridCouplingParamsArray(resolvedPlan));
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: compactHierarchy
        ? 'ulg-schroeder-cross-level-grid-restriction.compact-hierarchy.v1'
        : 'ulg-schroeder-cross-level-grid-restriction.v0',
      label: compactHierarchy
        ? 'ulg-schroeder-cross-level-grid-restriction-compact-hierarchy'
        : 'ulg-schroeder-cross-level-grid-restriction',
      code: compactHierarchy
        ? schroederCrossLevelGridRestrictionCompactWgsl
        : schroederCrossLevelGridRestrictionWgsl,
      entryPoint: 'main',
      bindings: compactHierarchy
        ? [
            computeBufferBinding(0, 'read-only-storage'),
            computeBufferBinding(1, 'storage'),
            computeBufferBinding(2, 'read-only-storage'),
            computeBufferBinding(3, 'uniform')
          ]
        : [
            computeBufferBinding(0, 'read-only-storage'),
            computeBufferBinding(1, 'storage'),
            computeBufferBinding(2, 'uniform')
          ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: compactHierarchy
        ? [
            { binding: 0, resource: { buffer: fine.gridBuffer } },
            { binding: 1, resource: { buffer: coarse.gridBuffer } },
            { binding: 2, resource: { buffer: compactHierarchy.hierarchyViewBuffer } },
            { binding: 3, resource: { buffer: paramsBuffer } }
          ]
        : [
            { binding: 0, resource: { buffer: fine.gridBuffer } },
            { binding: 1, resource: { buffer: coarse.gridBuffer } },
            { binding: 2, resource: { buffer: paramsBuffer } }
          ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    if (compactHierarchy) {
      pass.dispatchWorkgroupsIndirect(
        compactHierarchy.coarseIndirectDispatchBuffer
          || compactHierarchy.indirectDispatchBuffer,
        compactHierarchy.coarseIndirectDispatchOffsetBytes
          ?? compactHierarchy.indirectDispatchOffsetBytes
      );
    } else {
      pass.dispatchWorkgroups(
        Math.ceil(resolvedPlan.coarseNodeCount / SCHROEDER_GRID_COUPLING_WORKGROUP_SIZE)
      );
    }
    pass.end();
    device.queue.submit([encoder.finish()]);

    const result = {
      ...resolvedPlan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_EXECUTION_SCHEMA,
      couplingPlanSchema: resolvedPlan.schema,
      status: 'schroeder-cross-level-grid-restriction-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      compactHierarchyViewConsumed: Boolean(compactHierarchy),
      dispatchMode: compactHierarchy
        ? 'compact-coarse-node-indirect'
        : 'dense-coarse-grid-direct',
      retainedCoarseGridBuffer: Boolean(retainCoarseGridBuffer || coarse.borrowed),
      conservativeTransferStatus:
        'grid-restriction-submitted-full-weighting-mass-first-moment-linear-angular-momentum',
      scientificValidation: false,
      fullPhysicsValidation: false
    };
    if (retainCoarseGridBuffer || coarse.borrowed) {
      result.coarseGridBuffer = coarse.gridBuffer;
      if (!coarse.borrowed) {
        result.destroyCoarseGridBuffer = () => coarse.gridBuffer.destroy?.();
      }
      returnedRetainedCoarseBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!fine.borrowed) fine.gridBuffer.destroy?.();
      if (!coarse.borrowed && !returnedRetainedCoarseBuffer) coarse.gridBuffer.destroy?.();
      paramsBuffer.destroy?.();
    };
    deferSubmittedWorkCleanup(device, cleanup);
  }
}

export async function runSchroederSameGridMomentumAccumulationWebGpu({
  device,
  sourceGridBuffer = null,
  sourceGridRows = null,
  targetGridBuffer = null,
  targetGridRows = null,
  gridNodeCount,
  gridStrideFloats = MLS_MPM_GPU_GRID_NODE_FLOATS
} = {}) {
  assertWebGpuDevice(device, 'runSchroederSameGridMomentumAccumulationWebGpu');
  const nodeCount = positiveInteger(gridNodeCount, 1);
  const stride = positiveInteger(gridStrideFloats, MLS_MPM_GPU_GRID_NODE_FLOATS);
  const source = resolveGridInput(device, 'ulg-schroeder-same-grid-accumulate-source', {
    buffer: sourceGridBuffer,
    rows: sourceGridRows
  });
  const target = resolveGridInput(device, 'ulg-schroeder-same-grid-accumulate-target', {
    buffer: targetGridBuffer,
    rows: targetGridRows
  });
  const requiredBytes = nodeCount * stride * Float32Array.BYTES_PER_ELEMENT;
  for (const [label, buffer] of [
    ['source', source.gridBuffer],
    ['target', target.gridBuffer]
  ]) {
    if (Number.isFinite(Number(buffer?.size)) && Number(buffer.size) < requiredBytes) {
      throw new RangeError(`${label} same-grid accumulation buffer is smaller than the grid`);
    }
  }
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-same-grid-accumulation-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    device.queue.writeBuffer(
      paramsBuffer,
      0,
      new Uint32Array([nodeCount, stride, 0, 0])
    );
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(
      device,
      {
        cacheKey: 'ulg-schroeder-same-grid-momentum-accumulation.v0',
        label: 'ulg-schroeder-same-grid-momentum-accumulation',
        code: schroederSameGridMomentumAccumulationWgsl,
        entryPoint: 'main',
        bindings: [
          computeBufferBinding(0, 'read-only-storage'),
          computeBufferBinding(1, 'storage'),
          computeBufferBinding(2, 'uniform')
        ]
      }
    );
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: source.gridBuffer } },
        { binding: 1, resource: { buffer: target.gridBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(nodeCount / SCHROEDER_GRID_COUPLING_WORKGROUP_SIZE));
    pass.end();
    device.queue.submit([encoder.finish()]);
    return {
      status: 'schroeder-same-grid-momentum-accumulation-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      gridNodeCount: nodeCount,
      gridStrideFloats: stride,
      targetGridBuffer: target.gridBuffer,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      normalHotLoopReadbackFree: true
    };
  } finally {
    const cleanup = () => {
      if (!source.borrowed) source.gridBuffer.destroy?.();
      if (!target.borrowed) target.gridBuffer.destroy?.();
      paramsBuffer.destroy?.();
    };
    deferSubmittedWorkCleanup(device, cleanup);
  }
}

/**
 * Prolong coarse-level grid velocity back onto fine-level nodes as
 * mass-weighted momentum. Mutates the fine grid buffer in place; fine mass
 * and node positions are untouched.
 */
export async function runSchroederCrossLevelGridProlongationWebGpu({
  device,
  plan = null,
  coarseGridBuffer = null,
  coarseGridRows = null,
  fineGridBuffer = null,
  fineGridRows = null,
  hierarchyView = null,
  retainFineGridBuffer = true,
  ...planOptions
} = {}) {
  assertWebGpuDevice(device, 'runSchroederCrossLevelGridProlongationWebGpu');
  const resolvedPlan = plan || createSchroederCrossLevelGridCouplingPlan(planOptions);
  const compactHierarchy = resolveCompactHierarchyView(device, hierarchyView, resolvedPlan);
  const coarse = resolveGridInput(device, 'ulg-schroeder-grid-prolongation-coarse-in', {
    buffer: coarseGridBuffer,
    rows: coarseGridRows
  });
  const fine = resolveGridInput(device, 'ulg-schroeder-grid-prolongation-fine-inout', {
    buffer: fineGridBuffer,
    rows: fineGridRows
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-grid-prolongation-params',
    size: SCHROEDER_GRID_COUPLING_PARAMS_BYTES,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  let returnedRetainedFineBuffer = false;
  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelGridCouplingParamsArray(resolvedPlan));
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: compactHierarchy
        ? 'ulg-schroeder-cross-level-grid-prolongation.compact-hierarchy.v1'
        : 'ulg-schroeder-cross-level-grid-prolongation.v0',
      label: compactHierarchy
        ? 'ulg-schroeder-cross-level-grid-prolongation-compact-hierarchy'
        : 'ulg-schroeder-cross-level-grid-prolongation',
      code: compactHierarchy
        ? schroederCrossLevelGridProlongationCompactWgsl
        : schroederCrossLevelGridProlongationWgsl,
      entryPoint: 'main',
      bindings: compactHierarchy
        ? [
            computeBufferBinding(0, 'read-only-storage'),
            computeBufferBinding(1, 'storage'),
            computeBufferBinding(2, 'read-only-storage'),
            computeBufferBinding(3, 'uniform')
          ]
        : [
            computeBufferBinding(0, 'read-only-storage'),
            computeBufferBinding(1, 'storage'),
            computeBufferBinding(2, 'uniform')
          ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: compactHierarchy
        ? [
            { binding: 0, resource: { buffer: coarse.gridBuffer } },
            { binding: 1, resource: { buffer: fine.gridBuffer } },
            { binding: 2, resource: { buffer: compactHierarchy.hierarchyViewBuffer } },
            { binding: 3, resource: { buffer: paramsBuffer } }
          ]
        : [
            { binding: 0, resource: { buffer: coarse.gridBuffer } },
            { binding: 1, resource: { buffer: fine.gridBuffer } },
            { binding: 2, resource: { buffer: paramsBuffer } }
          ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    if (compactHierarchy) {
      pass.dispatchWorkgroupsIndirect(
        compactHierarchy.fineIndirectDispatchBuffer,
        compactHierarchy.fineIndirectDispatchOffsetBytes
      );
    } else {
      pass.dispatchWorkgroups(
        Math.ceil(resolvedPlan.fineNodeCount / SCHROEDER_GRID_COUPLING_WORKGROUP_SIZE)
      );
    }
    pass.end();
    device.queue.submit([encoder.finish()]);

    const result = {
      ...resolvedPlan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_EXECUTION_SCHEMA,
      couplingPlanSchema: ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_SCHEMA,
      status: 'schroeder-cross-level-grid-prolongation-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      compactHierarchyViewConsumed: Boolean(compactHierarchy),
      dispatchMode: compactHierarchy
        ? 'compact-fine-node-indirect'
        : 'dense-fine-grid-direct',
      retainedFineGridBuffer: Boolean(retainFineGridBuffer || fine.borrowed),
      conservativeTransferStatus:
        'grid-prolongation-submitted-trilinear-partition-of-unity-affine-velocity',
      scientificValidation: false,
      fullPhysicsValidation: false
    };
    if (retainFineGridBuffer || fine.borrowed) {
      result.fineGridBuffer = fine.gridBuffer;
      if (!fine.borrowed) {
        result.destroyFineGridBuffer = () => fine.gridBuffer.destroy?.();
      }
      returnedRetainedFineBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!coarse.borrowed) coarse.gridBuffer.destroy?.();
      if (!fine.borrowed && !returnedRetainedFineBuffer) fine.gridBuffer.destroy?.();
      paramsBuffer.destroy?.();
    };
    deferSubmittedWorkCleanup(device, cleanup);
  }
}

/**
 * Reduce fine and coarse grids into one compact conservation-summary row
 * (total mass/momentum per level plus residuals). The summary is the only
 * readback and is a single 16-float row, matching the compact-counter
 * allowance in the SS GPU-first rules.
 */
/**
 * Delta-form prolongation (AMR velocity correction): every massive fine node
 * receives the trilinearly interpolated change in coarse velocity across the
 * coarse grid update. Because a force-free field
 * has zero delta, this transfer contributes no error of its own, unlike a
 * direct velocity copy which injects quantized tiny-mass parent velocities
 * into fine nodes. Pre grid is momentum-layout, post grid velocity-layout,
 * fine grid velocity-layout; the fine buffer mutates in place.
 */
export async function runSchroederCrossLevelGridVelocityDeltaProlongationWebGpu({
  device,
  plan = null,
  coarsePreGridBuffer = null,
  coarsePreGridRows = null,
  coarsePostGridBuffer = null,
  coarsePostGridRows = null,
  fineGridBuffer = null,
  fineGridRows = null,
  hierarchyView = null,
  retainFineGridBuffer = true,
  ...planOptions
} = {}) {
  assertWebGpuDevice(device, 'runSchroederCrossLevelGridVelocityDeltaProlongationWebGpu');
  const resolvedPlan = plan || createSchroederCrossLevelGridCouplingPlan(planOptions);
  const compactHierarchy = resolveCompactHierarchyView(device, hierarchyView, resolvedPlan);
  const coarsePre = resolveGridInput(device, 'ulg-schroeder-grid-delta-prolongation-coarse-pre-in', {
    buffer: coarsePreGridBuffer,
    rows: coarsePreGridRows
  });
  const coarsePost = resolveGridInput(device, 'ulg-schroeder-grid-delta-prolongation-coarse-post-in', {
    buffer: coarsePostGridBuffer,
    rows: coarsePostGridRows
  });
  const fine = resolveGridInput(device, 'ulg-schroeder-grid-delta-prolongation-fine-inout', {
    buffer: fineGridBuffer,
    rows: fineGridRows
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-grid-delta-prolongation-params',
    size: SCHROEDER_GRID_COUPLING_PARAMS_BYTES,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  let returnedRetainedFineBuffer = false;
  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelGridCouplingParamsArray(resolvedPlan));
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: compactHierarchy
        ? 'ulg-schroeder-cross-level-grid-velocity-delta-prolongation.compact-hierarchy.v1'
        : 'ulg-schroeder-cross-level-grid-velocity-delta-prolongation.v0',
      label: compactHierarchy
        ? 'ulg-schroeder-cross-level-grid-velocity-delta-prolongation-compact-hierarchy'
        : 'ulg-schroeder-cross-level-grid-velocity-delta-prolongation',
      code: compactHierarchy
        ? schroederCrossLevelGridVelocityDeltaProlongationCompactWgsl
        : schroederCrossLevelGridVelocityDeltaProlongationWgsl,
      entryPoint: 'main',
      bindings: compactHierarchy
        ? [
            computeBufferBinding(0, 'read-only-storage'),
            computeBufferBinding(1, 'read-only-storage'),
            computeBufferBinding(2, 'storage'),
            computeBufferBinding(3, 'read-only-storage'),
            computeBufferBinding(4, 'uniform')
          ]
        : [
            computeBufferBinding(0, 'read-only-storage'),
            computeBufferBinding(1, 'read-only-storage'),
            computeBufferBinding(2, 'storage'),
            computeBufferBinding(3, 'uniform')
          ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: compactHierarchy
        ? [
            { binding: 0, resource: { buffer: coarsePre.gridBuffer } },
            { binding: 1, resource: { buffer: coarsePost.gridBuffer } },
            { binding: 2, resource: { buffer: fine.gridBuffer } },
            { binding: 3, resource: { buffer: compactHierarchy.hierarchyViewBuffer } },
            { binding: 4, resource: { buffer: paramsBuffer } }
          ]
        : [
            { binding: 0, resource: { buffer: coarsePre.gridBuffer } },
            { binding: 1, resource: { buffer: coarsePost.gridBuffer } },
            { binding: 2, resource: { buffer: fine.gridBuffer } },
            { binding: 3, resource: { buffer: paramsBuffer } }
          ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    if (compactHierarchy) {
      pass.dispatchWorkgroupsIndirect(
        compactHierarchy.fineIndirectDispatchBuffer,
        compactHierarchy.fineIndirectDispatchOffsetBytes
      );
    } else {
      pass.dispatchWorkgroups(
        Math.ceil(resolvedPlan.fineNodeCount / SCHROEDER_GRID_COUPLING_WORKGROUP_SIZE)
      );
    }
    pass.end();
    device.queue.submit([encoder.finish()]);

    const result = {
      ...resolvedPlan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_EXECUTION_SCHEMA,
      couplingPlanSchema: ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_SCHEMA,
      status: 'schroeder-cross-level-grid-velocity-delta-prolongation-submitted',
      prolongationMode: 'trilinear-coarse-velocity-delta-correction',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      compactHierarchyViewConsumed: Boolean(compactHierarchy),
      dispatchMode: compactHierarchy
        ? 'compact-fine-node-indirect'
        : 'dense-fine-grid-direct',
      retainedFineGridBuffer: Boolean(retainFineGridBuffer || fine.borrowed),
      conservativeTransferStatus:
        'grid-velocity-delta-prolongation-submitted-trilinear-update-correction',
      scientificValidation: false,
      fullPhysicsValidation: false
    };
    if (retainFineGridBuffer || fine.borrowed) {
      result.fineGridBuffer = fine.gridBuffer;
      if (!fine.borrowed) {
        result.destroyFineGridBuffer = () => fine.gridBuffer.destroy?.();
      }
      returnedRetainedFineBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!coarsePre.borrowed) coarsePre.gridBuffer.destroy?.();
      if (!coarsePost.borrowed) coarsePost.gridBuffer.destroy?.();
      if (!fine.borrowed && !returnedRetainedFineBuffer) fine.gridBuffer.destroy?.();
      paramsBuffer.destroy?.();
    };
    deferSubmittedWorkCleanup(device, cleanup);
  }
}

/**
 * Produce one fixed-size, GPU-resident v1 invariant receipt over the compact
 * fine and parent node lists authenticated by a hierarchy view. The ordinary
 * path retains the receipt without mapping it; tests and explicit probes may
 * request the 192-byte readback.
 */
export async function runSchroederCrossLevelInvariantEvidenceWebGpu({
  device,
  plan = null,
  fineGridBuffer = null,
  fineGridRows = null,
  parentGridBuffer = null,
  parentGridRows = null,
  hierarchyView,
  retainEvidenceBuffer = true,
  readback = false,
  ...planOptions
} = {}) {
  assertWebGpuDevice(device, 'runSchroederCrossLevelInvariantEvidenceWebGpu');
  const resolvedPlan = plan || createSchroederCrossLevelGridCouplingPlan(planOptions);
  const compactHierarchy = resolveCompactHierarchyView(
    device,
    hierarchyView,
    resolvedPlan
  );
  if (!compactHierarchy) {
    throw new TypeError(
      'runSchroederCrossLevelInvariantEvidenceWebGpu requires a compact hierarchy view'
    );
  }
  const fine = resolveGridInput(device, 'ulg-schroeder-invariant-fine-grid-in', {
    buffer: fineGridBuffer,
    rows: fineGridRows
  });
  const parent = resolveGridInput(device, 'ulg-schroeder-invariant-parent-grid-in', {
    buffer: parentGridBuffer,
    rows: parentGridRows
  });
  const evidenceBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-invariant-evidence-v1',
    size: SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_BYTES,
    usage: GPU_BUFFER_USAGE.STORAGE
      | GPU_BUFFER_USAGE.COPY_SRC
      | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-invariant-evidence-params',
    size: SCHROEDER_GRID_COUPLING_PARAMS_BYTES,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = readback
    ? device.createBuffer({
        label: 'ulg-schroeder-cross-level-invariant-evidence-readback',
        size: SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_BYTES,
        usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
      })
    : null;
  let returnedRetainedEvidenceBuffer = false;
  try {
    device.queue.writeBuffer(
      paramsBuffer,
      0,
      createSchroederCrossLevelGridCouplingParamsArray(resolvedPlan)
    );
    const { pipeline, bindGroupLayout, cacheStatus } =
      createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-schroeder-cross-level-invariant-evidence.compact.v1',
        label: 'ulg-schroeder-cross-level-invariant-evidence',
        code: schroederCrossLevelInvariantEvidenceWgsl,
        entryPoint: 'main',
        bindings: [
          computeBufferBinding(0, 'read-only-storage'),
          computeBufferBinding(1, 'read-only-storage'),
          computeBufferBinding(2, 'read-only-storage'),
          computeBufferBinding(3, 'storage'),
          computeBufferBinding(4, 'uniform')
        ]
      });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: fine.gridBuffer } },
        { binding: 1, resource: { buffer: parent.gridBuffer } },
        { binding: 2, resource: { buffer: compactHierarchy.hierarchyViewBuffer } },
        { binding: 3, resource: { buffer: evidenceBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder({
      label: 'ulg-schroeder-cross-level-invariant-evidence'
    });
    encoder.clearBuffer(evidenceBuffer);
    const pass = encoder.beginComputePass({
      label: 'ulg-schroeder-cross-level-invariant-evidence-reduce'
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    if (readBuffer) {
      encoder.copyBufferToBuffer(
        evidenceBuffer,
        0,
        readBuffer,
        0,
        SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_BYTES
      );
    }
    device.queue.submit([encoder.finish()]);
    let evidenceWords = new Uint32Array();
    let evidence = null;
    if (readBuffer) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      evidenceWords = new Uint32Array(readBuffer.getMappedRange()).slice();
      readBuffer.unmap();
      evidence = decodeSchroederCrossLevelInvariantEvidence(evidenceWords);
    }
    const result = {
      schema: ULG_SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_EXECUTION_SCHEMA,
      status: 'schroeder-cross-level-invariant-evidence-submitted',
      backend: 'webgpu',
      generationId: compactHierarchy.generationId,
      completionOrdinal: compactHierarchy.completionOrdinal,
      pipelineCacheStatus: cacheStatus,
      compactHierarchyViewConsumed: true,
      invariantQuantities: [...resolvedPlan.conservedQuantities],
      representedInternalEnergyPolicy:
        resolvedPlan.representedInternalEnergyPolicy,
      dispatchMode: 'single-workgroup-compact-node-segmented-reduction',
      readbackMode: readBuffer
        ? SCHROEDER_COMPACT_GRID_CONSERVATION_READBACK_MODE
        : SCHROEDER_NO_FULL_READBACK_MODE,
      compactEvidenceReadbackPerformed: Boolean(readBuffer),
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: !readBuffer,
      evidenceWords,
      evidence,
      retainedEvidenceBuffer: retainEvidenceBuffer,
      scientificValidation: false,
      fullPhysicsValidation: false
    };
    if (retainEvidenceBuffer) {
      result.evidenceBuffer = evidenceBuffer;
      result.evidenceBufferByteLength = SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_BYTES;
      result.destroyEvidenceBuffer = () => evidenceBuffer.destroy?.();
      returnedRetainedEvidenceBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!fine.borrowed) fine.gridBuffer.destroy?.();
      if (!parent.borrowed) parent.gridBuffer.destroy?.();
      if (!returnedRetainedEvidenceBuffer) evidenceBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    deferSubmittedWorkCleanup(device, cleanup);
  }
}

export async function runSchroederCrossLevelGridConservationSummaryWebGpu({
  device,
  plan = null,
  fineGridBuffer = null,
  fineGridRows = null,
  coarseGridBuffer = null,
  coarseGridRows = null,
  readbackMode = SCHROEDER_COMPACT_GRID_CONSERVATION_READBACK_MODE,
  ...planOptions
} = {}) {
  assertWebGpuDevice(device, 'runSchroederCrossLevelGridConservationSummaryWebGpu');
  const resolvedPlan = plan || createSchroederCrossLevelGridCouplingPlan(planOptions);
  const compactReadback = readbackMode !== SCHROEDER_NO_FULL_READBACK_MODE;
  const fine = resolveGridInput(device, 'ulg-schroeder-grid-conservation-fine-in', {
    buffer: fineGridBuffer,
    rows: fineGridRows
  });
  const coarse = resolveGridInput(device, 'ulg-schroeder-grid-conservation-coarse-in', {
    buffer: coarseGridBuffer,
    rows: coarseGridRows
  });
  const summaryBuffer = device.createBuffer({
    label: 'ulg-schroeder-grid-conservation-summary-out',
    size: resolvedPlan.summaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-grid-conservation-summary-params',
    size: SCHROEDER_GRID_COUPLING_PARAMS_BYTES,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = compactReadback
    ? device.createBuffer({
      label: 'ulg-schroeder-grid-conservation-summary-readback',
      size: resolvedPlan.summaryByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    })
    : null;
  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelGridCouplingParamsArray(resolvedPlan));
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-cross-level-grid-conservation-summary.v0',
      label: 'ulg-schroeder-cross-level-grid-conservation-summary',
      code: schroederCrossLevelGridConservationSummaryWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'storage'),
        computeBufferBinding(3, 'uniform')
      ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: fine.gridBuffer } },
        { binding: 1, resource: { buffer: coarse.gridBuffer } },
        { binding: 2, resource: { buffer: summaryBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    if (compactReadback) {
      encoder.copyBufferToBuffer(summaryBuffer, 0, readBuffer, 0, resolvedPlan.summaryByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let summaryRow = new Float32Array();
    if (compactReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      summaryRow = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_FLOATS
      );
      readBuffer.unmap();
    }

    return {
      ...resolvedPlan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
      couplingPlanSchema: ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_SCHEMA,
      status: 'schroeder-cross-level-grid-conservation-summary-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: compactReadback
        ? SCHROEDER_COMPACT_GRID_CONSERVATION_READBACK_MODE
        : SCHROEDER_NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: !compactReadback,
      compactSummaryReadbackPerformed: compactReadback,
      summaryRow,
      conservation: compactReadback
        ? decodeSchroederCrossLevelGridConservationSummaryRow(summaryRow)
        : null,
      conservativeTransferStatus: 'summary-only-no-state-mutation',
      scientificValidation: false,
      fullPhysicsValidation: false
    };
  } finally {
    const cleanup = () => {
      if (!fine.borrowed) fine.gridBuffer.destroy?.();
      if (!coarse.borrowed) coarse.gridBuffer.destroy?.();
      summaryBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    deferSubmittedWorkCleanup(device, cleanup);
  }
}

export function decodeSchroederCrossLevelGridConservationSummaryRow(row) {
  if (!(row instanceof Float32Array) || row.length < SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_FLOATS) {
    return null;
  }
  return {
    schema: ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_SCHEMA,
    fineMassKg: row[0],
    fineMomentumKgMPerS: [row[1], row[2], row[3]],
    coarseMassKg: row[4],
    coarseMomentumKgMPerS: [row[5], row[6], row[7]],
    massResidualKg: row[8],
    momentumResidualKgMPerS: [row[9], row[10], row[11]],
    fineActiveNodeCount: row[12],
    coarseActiveNodeCount: row[13],
    status: row[14],
    flags: row[15]
  };
}

// --- Diagnostic CPU oracles (test-only) --------------------------------
//
// These mirror the WGSL math in float64 so unit tests can assert the
// operator design conserves mass and momentum and preserves constant
// velocity fields. They are numerical oracles for tests and explicitly not
// a runtime execution path: the SS hot path stays GPU-resident.

function gridAxisIndexForPlan(plan, x, y, z, dims) {
  if (plan.indexOrder === SCHROEDER_GRID_INDEX_ORDER_Z_FASTEST) {
    return x * dims[1] * dims[2] + y * dims[2] + z;
  }
  return x + dims[0] * (y + dims[1] * z);
}

function fineSupportAxisForPlan(plan, coarseAxis, offset) {
  const shift = plan.gridShift ?? 0;
  return 2 * (coarseAxis - shift) + shift + offset;
}

function coarseInterpolationAxisForPlan(plan, fineAxis) {
  const shift = plan.gridShift ?? 0;
  const coordinate = (fineAxis - shift) / 2 + shift;
  const lower = Math.floor(coordinate);
  return { lower, fraction: coordinate - lower };
}

export function restrictGridRowsCpuOracle(plan, fineRows, coarseRowsInOut = null) {
  const stride = plan.gridStrideFloats;
  const [nx, ny, nz] = plan.fineGridDims;
  const [cnx, cny, cnz] = plan.coarseGridDims;
  const accumulate = plan.accumulate === true && coarseRowsInOut;
  const coarseRows = coarseRowsInOut
    ? Float64Array.from(coarseRowsInOut)
    : new Float64Array(plan.coarseNodeCount * stride);
  for (let cz = 0; cz < cnz; cz += 1) {
    for (let cy = 0; cy < cny; cy += 1) {
      for (let cx = 0; cx < cnx; cx += 1) {
        const coarseIndex = gridAxisIndexForPlan(plan, cx, cy, cz, plan.coarseGridDims);
        const offset = coarseIndex * stride;
        let mass = 0;
        let px = 0;
        let py = 0;
        let pz = 0;
        for (let dz = -1; dz <= 1; dz += 1) {
          const fz = fineSupportAxisForPlan(plan, cz, dz);
          if (fz < 0 || fz >= nz) continue;
          const wz = dz === 0 ? 1 : 0.5;
          for (let dy = -1; dy <= 1; dy += 1) {
            const fy = fineSupportAxisForPlan(plan, cy, dy);
            if (fy < 0 || fy >= ny) continue;
            const wy = dy === 0 ? 1 : 0.5;
            for (let dx = -1; dx <= 1; dx += 1) {
              const fx = fineSupportAxisForPlan(plan, cx, dx);
              if (fx < 0 || fx >= nx) continue;
              const wx = dx === 0 ? 1 : 0.5;
              const weight = wx * wy * wz;
              const fineOffset = gridAxisIndexForPlan(plan, fx, fy, fz, plan.fineGridDims) * stride;
              mass += weight * Math.max(0, fineRows[fineOffset]);
              px += weight * fineRows[fineOffset + 1];
              py += weight * fineRows[fineOffset + 2];
              pz += weight * fineRows[fineOffset + 3];
            }
          }
        }
        if (accumulate) {
          const total = coarseRows[offset] + mass;
          coarseRows[offset] = total;
          coarseRows[offset + 1] += px;
          coarseRows[offset + 2] += py;
          coarseRows[offset + 3] += pz;
          if (total > 0) coarseRows[offset + 7] = 1;
        } else {
          const shift = plan.gridShift ?? 0;
          coarseRows[offset] = mass;
          coarseRows[offset + 1] = px;
          coarseRows[offset + 2] = py;
          coarseRows[offset + 3] = pz;
          coarseRows[offset + 4] = plan.gridOriginM[0] + (cx - shift) * plan.coarseGridSpacingM;
          coarseRows[offset + 5] = plan.gridOriginM[1] + (cy - shift) * plan.coarseGridSpacingM;
          coarseRows[offset + 6] = plan.gridOriginM[2] + (cz - shift) * plan.coarseGridSpacingM;
          coarseRows[offset + 7] = mass > 0 ? 1 : 0;
        }
      }
    }
  }
  return coarseRows;
}

export function prolongGridRowsCpuOracle(plan, coarseRows, fineRows) {
  const stride = plan.gridStrideFloats;
  const [nx, ny, nz] = plan.fineGridDims;
  const [cnx, cny, cnz] = plan.coarseGridDims;
  const out = Float64Array.from(fineRows);
  for (let fz = 0; fz < nz; fz += 1) {
    for (let fy = 0; fy < ny; fy += 1) {
      for (let fx = 0; fx < nx; fx += 1) {
        const fineOffset = gridAxisIndexForPlan(plan, fx, fy, fz, plan.fineGridDims) * stride;
        const fineMass = Math.max(0, out[fineOffset]);
        if (!(fineMass > 0)) continue;
        const ix = coarseInterpolationAxisForPlan(plan, fx);
        const iy = coarseInterpolationAxisForPlan(plan, fy);
        const iz = coarseInterpolationAxisForPlan(plan, fz);
        const velocity = [0, 0, 0];
        let weightSum = 0;
        let complete = true;
        for (let oz = 0; oz < 2; oz += 1) {
          const cz = iz.lower + oz;
          const wz = oz === 0 ? 1 - iz.fraction : iz.fraction;
          if (!(wz > 0)) continue;
          for (let oy = 0; oy < 2; oy += 1) {
            const cy = iy.lower + oy;
            const wy = oy === 0 ? 1 - iy.fraction : iy.fraction;
            if (!(wy > 0)) continue;
            for (let ox = 0; ox < 2; ox += 1) {
              const cx = ix.lower + ox;
              const wx = ox === 0 ? 1 - ix.fraction : ix.fraction;
              const weight = wx * wy * wz;
              if (!(weight > 0)) continue;
              if (cx < 0 || cx >= cnx || cy < 0 || cy >= cny || cz < 0 || cz >= cnz) {
                complete = false;
                continue;
              }
              const coarseOffset = gridAxisIndexForPlan(
                plan,
                cx,
                cy,
                cz,
                plan.coarseGridDims
              ) * stride;
              const coarseMass = coarseRows[coarseOffset];
              if (!(coarseMass > 0)) {
                complete = false;
                continue;
              }
              weightSum += weight;
              for (let axis = 0; axis < 3; axis += 1) {
                const parentValue = coarseRows[coarseOffset + 1 + axis];
                velocity[axis] += weight * (
                  plan.velocityGrids === true ? parentValue : parentValue / coarseMass
                );
              }
            }
          }
        }
        if (!complete || Math.abs(weightSum - 1) > 1e-12) continue;
        if (plan.velocityGrids === true) {
          out[fineOffset + 1] = velocity[0];
          out[fineOffset + 2] = velocity[1];
          out[fineOffset + 3] = velocity[2];
        } else {
          out[fineOffset + 1] = fineMass * velocity[0];
          out[fineOffset + 2] = fineMass * velocity[1];
          out[fineOffset + 3] = fineMass * velocity[2];
        }
      }
    }
  }
  return out;
}

export function summarizeGridConservationCpuOracle(plan, rows) {
  const stride = plan.gridStrideFloats;
  let mass = 0;
  let px = 0;
  let py = 0;
  let pz = 0;
  let active = 0;
  const nodeCount = Math.floor(rows.length / stride);
  for (let index = 0; index < nodeCount; index += 1) {
    const offset = index * stride;
    const nodeMass = Math.max(0, rows[offset]);
    mass += nodeMass;
    px += rows[offset + 1];
    py += rows[offset + 2];
    pz += rows[offset + 3];
    if (nodeMass > 0) active += 1;
  }
  return { massKg: mass, momentumKgMPerS: [px, py, pz], activeNodeCount: active };
}

export function summarizeGridMomentsCpuOracle(plan, rows, { level = 'fine' } = {}) {
  const coarse = level === 'coarse';
  const dims = coarse ? plan.coarseGridDims : plan.fineGridDims;
  const spacing = coarse ? plan.coarseGridSpacingM : plan.fineGridSpacingM;
  const stride = plan.gridStrideFloats;
  const shift = plan.gridShift ?? 0;
  const firstMassMomentKgM = [0, 0, 0];
  const linearMomentumKgMPerS = [0, 0, 0];
  const orbitalAngularMomentumKgM2PerS = [0, 0, 0];
  let massKg = 0;
  for (let z = 0; z < dims[2]; z += 1) {
    for (let y = 0; y < dims[1]; y += 1) {
      for (let x = 0; x < dims[0]; x += 1) {
        const offset = gridAxisIndexForPlan(plan, x, y, z, dims) * stride;
        const mass = Math.max(0, rows[offset]);
        const position = [
          plan.gridOriginM[0] + (x - shift) * spacing,
          plan.gridOriginM[1] + (y - shift) * spacing,
          plan.gridOriginM[2] + (z - shift) * spacing
        ];
        const momentum = [rows[offset + 1], rows[offset + 2], rows[offset + 3]];
        massKg += mass;
        for (let axis = 0; axis < 3; axis += 1) {
          firstMassMomentKgM[axis] += mass * position[axis];
          linearMomentumKgMPerS[axis] += momentum[axis];
        }
        orbitalAngularMomentumKgM2PerS[0] += position[1] * momentum[2]
          - position[2] * momentum[1];
        orbitalAngularMomentumKgM2PerS[1] += position[2] * momentum[0]
          - position[0] * momentum[2];
        orbitalAngularMomentumKgM2PerS[2] += position[0] * momentum[1]
          - position[1] * momentum[0];
      }
    }
  }
  return {
    massKg,
    firstMassMomentKgM,
    centerOfMassM: massKg > 0
      ? firstMassMomentKgM.map((value) => value / massKg)
      : [0, 0, 0],
    linearMomentumKgMPerS,
    orbitalAngularMomentumKgM2PerS
  };
}

function cpuVector3(value, label) {
  const vector = Array.from(value || []);
  if (vector.length !== 3 || vector.some((entry) => !Number.isFinite(Number(entry)))) {
    throw new RangeError(`${label} must contain three finite values`);
  }
  return vector.map(Number);
}

function cpuVectorMagnitude(value) {
  return Math.hypot(value[0], value[1], value[2]);
}

function cpuClampVelocity(value, ceiling) {
  const magnitude = cpuVectorMagnitude(value);
  if (!(ceiling > 0) || magnitude <= ceiling) return [...value];
  return value.map((entry) => entry * ceiling / magnitude);
}

/**
 * Manufactured float64 oracle for the sparse parent-field macro coupling.
 * It deliberately mirrors the production order: each fine substep applies
 * only its admitted share of the combined-parent delta, records that exact
 * applied impulse, and the final native coarse predictor receives the summed
 * equal-and-opposite reflux exactly once. Removed grid kinetic energy is
 * deposited as nonnegative internal energy.
 */
export function coupleTwoLevelMomentumEnergyCpuOracle({
  fineMassKg,
  coarseMassKg,
  fineVelocityMPerS,
  coarseVelocityMPerS,
  fineSubstepCount = 1,
  maxFineCorrectionMPerS = Infinity,
  fineCflVelocityMPerS = Infinity,
  coarseCflVelocityMPerS = Infinity,
  finePositionM = [0, 0, 0],
  coarsePositionM = finePositionM,
  levelRatio = 2
} = {}) {
  const fineMass = Number(fineMassKg);
  const coarseMass = Number(coarseMassKg);
  const substeps = Number(fineSubstepCount);
  if (!(fineMass > 0) || !(coarseMass > 0)) {
    throw new RangeError('manufactured coupling masses must be positive');
  }
  if (!Number.isInteger(substeps) || substeps < 1) {
    throw new RangeError('fineSubstepCount must be a positive integer');
  }
  if (levelRatio !== 2) {
    throw new RangeError('two-level coupling requires the adjacent 2:1 chart ratio');
  }
  let fineVelocity = cpuVector3(fineVelocityMPerS, 'fineVelocityMPerS');
  const coarseVelocity = cpuVector3(coarseVelocityMPerS, 'coarseVelocityMPerS');
  const finePosition = cpuVector3(finePositionM, 'finePositionM');
  const coarsePosition = cpuVector3(coarsePositionM, 'coarsePositionM');
  const correctionCeiling = Number(maxFineCorrectionMPerS);
  const fineCfl = Number(fineCflVelocityMPerS);
  const coarseCfl = Number(coarseCflVelocityMPerS);
  const initialFineVelocity = [...fineVelocity];
  const initialMomentum = fineVelocity.map((entry, axis) => (
    fineMass * entry + coarseMass * coarseVelocity[axis]
  ));
  const initialKineticEnergyJ = 0.5 * fineMass * fineVelocity.reduce(
    (sum, entry) => sum + entry * entry,
    0
  ) + 0.5 * coarseMass * coarseVelocity.reduce(
    (sum, entry) => sum + entry * entry,
    0
  );
  const refluxImpulse = [0, 0, 0];
  let correctionClampCount = 0;
  let fineKineticEnergyDeltaJ = 0;
  for (let substep = 0; substep < substeps; substep += 1) {
    const combined = fineVelocity.map((entry, axis) => (
      (fineMass * entry + coarseMass * coarseVelocity[axis])
        / (fineMass + coarseMass)
    ));
    let correction = combined.map((entry, axis) => (
      (entry - fineVelocity[axis]) / substeps
    ));
    if (Number.isFinite(correctionCeiling)
      && cpuVectorMagnitude(correction) > correctionCeiling) {
      correction = cpuClampVelocity(correction, correctionCeiling);
      correctionClampCount += 1;
    }
    const prior = [...fineVelocity];
    fineVelocity = fineVelocity.map((entry, axis) => entry + correction[axis]);
    if (Number.isFinite(fineCfl) && cpuVectorMagnitude(fineVelocity) > fineCfl) {
      fineVelocity = cpuClampVelocity(fineVelocity, fineCfl);
      correctionClampCount += 1;
    }
    const appliedCorrection = fineVelocity.map((entry, axis) => entry - prior[axis]);
    for (let axis = 0; axis < 3; axis += 1) {
      refluxImpulse[axis] -= fineMass * appliedCorrection[axis];
    }
    fineKineticEnergyDeltaJ += 0.5 * fineMass * (
      fineVelocity.reduce((sum, entry) => sum + entry * entry, 0)
      - prior.reduce((sum, entry) => sum + entry * entry, 0)
    );
  }
  const finalCoarseVelocity = coarseVelocity.map((entry, axis) => (
    entry + refluxImpulse[axis] / coarseMass
  ));
  const coarseCflRatio = cpuVectorMagnitude(finalCoarseVelocity)
    / Math.max(coarseCfl, Number.MIN_VALUE);
  const admitted = !Number.isFinite(coarseCfl) || coarseCflRatio <= 1 + 1e-12;
  const coarseKineticEnergyDeltaJ = 0.5 * coarseMass * (
    finalCoarseVelocity.reduce((sum, entry) => sum + entry * entry, 0)
    - coarseVelocity.reduce((sum, entry) => sum + entry * entry, 0)
  );
  const internalEnergyDepositJ = Math.max(
    0,
    -(fineKineticEnergyDeltaJ + coarseKineticEnergyDeltaJ)
  );
  const finalMomentum = fineVelocity.map((entry, axis) => (
    fineMass * entry + coarseMass * finalCoarseVelocity[axis]
  ));
  const linearMomentumResidualKgMPerS = finalMomentum.map(
    (entry, axis) => entry - initialMomentum[axis]
  );
  const fineImpulse = fineVelocity.map((entry, axis) => (
    fineMass * (entry - initialFineVelocity[axis])
  ));
  const angular = (position, impulse) => [
    position[1] * impulse[2] - position[2] * impulse[1],
    position[2] * impulse[0] - position[0] * impulse[2],
    position[0] * impulse[1] - position[1] * impulse[0]
  ];
  const fineAngular = angular(finePosition, fineImpulse);
  const coarseAngular = angular(coarsePosition, refluxImpulse);
  const angularMomentumResidualKgM2PerS = fineAngular.map(
    (entry, axis) => entry + coarseAngular[axis]
  );
  const totalEnergyResidualJ = fineKineticEnergyDeltaJ
    + coarseKineticEnergyDeltaJ
    + internalEnergyDepositJ;
  return Object.freeze({
    schema: 'peercompute.ulg.schroeder-two-level-coupling-cpu-oracle.v1',
    admitted,
    fineSubstepCount: substeps,
    levelRatio: [2, 1],
    fineVelocityMPerS: Object.freeze(fineVelocity),
    coarseVelocityMPerS: Object.freeze(finalCoarseVelocity),
    fineImpulseKgMPerS: Object.freeze(fineImpulse),
    coarseRefluxImpulseKgMPerS: Object.freeze(refluxImpulse),
    linearMomentumResidualKgMPerS: Object.freeze(linearMomentumResidualKgMPerS),
    angularMomentumResidualKgM2PerS: Object.freeze(
      angularMomentumResidualKgM2PerS
    ),
    fineKineticEnergyDeltaJ,
    coarseKineticEnergyDeltaJ,
    internalEnergyDepositJ,
    totalEnergyResidualJ,
    initialKineticEnergyJ,
    finalKineticEnergyJ: initialKineticEnergyJ
      + fineKineticEnergyDeltaJ + coarseKineticEnergyDeltaJ,
    correctionClampCount,
    fineCflRatio: cpuVectorMagnitude(fineVelocity)
      / Math.max(fineCfl, Number.MIN_VALUE),
    coarseCflRatio,
    massResidualKg: 0,
    firstMassMomentResidualKgM: Object.freeze([0, 0, 0]),
    minimumInternalEnergyJ: internalEnergyDepositJ,
    positivityAdmitted: internalEnergyDepositJ >= 0
  });
}

// --- Two-level coupled mechanics step -----------------------------------

export const ULG_SCHROEDER_TWO_LEVEL_MECHANICS_STEP_SCHEMA =
  'peercompute.ulg.schroeder-two-level-mechanics-step.v0';
export const ULG_SCHROEDER_TWO_LEVEL_MECHANICS_STEP_EXECUTION_SCHEMA =
  'peercompute.ulg.schroeder-two-level-mechanics-step-execution.v0';

function createCanonicalTwoLevelSubstepUploads({
  sphParticleState,
  mlsMpmParticleState,
  sourceSphParticleUpload,
  sourceMlsMpmParticleUpload,
  epochGeneration,
  g2pReconstruction,
  thermoBuffer,
  identityBuffer,
  identityRequired,
  elapsedDtS = 0,
  sourceStage = 'schroeder-two-level-fine-substep'
} = {}) {
  const execution = epochGeneration?.execution;
  const particleCount = sphParticleState?.particleCount;
  if (
    !execution
    || !Number.isInteger(particleCount)
    || particleCount < 1
    || mlsMpmParticleState?.particleCount !== particleCount
    || !g2pReconstruction?.stateBuffer
    || !g2pReconstruction?.mechanicsBuffer
    || !thermoBuffer
  ) {
    throw new TypeError(
      'Canonical two-level substep publication requires one complete resident output family'
    );
  }
  const sourceStorageGeneration = Number(
    execution.storageGeneration
      ?? sourceSphParticleUpload?.storageGeneration
      ?? sourceSphParticleUpload?.bufferFamilyGeneration
  );
  if (
    !Number.isInteger(sourceStorageGeneration)
    || sourceStorageGeneration < 1
    || sourceStorageGeneration > 0xffff_fffe
  ) {
    throw new RangeError(
      'Canonical two-level storageGeneration cannot advance safely'
    );
  }
  for (const [field, value] of [
    ['physicsSubstep', execution.physicsSubstep],
    ['positionEpoch', execution.positionEpoch]
  ]) {
    if (!Number.isInteger(value) || value < 0 || value >= 0xffff_ffff) {
      throw new RangeError(`Canonical two-level ${field} cannot advance safely`);
    }
  }
  const nextStorageGeneration = sourceStorageGeneration + 1;
  const nextPhysicsSubstep = execution.physicsSubstep + 1;
  const nextPositionEpoch = execution.positionEpoch + 1;
  const stateStrideBytes = sourceSphParticleUpload?.stateStrideBytes
    ?? sphParticleState?.stateStrideBytes
    ?? (SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  const thermoStrideBytes = sourceSphParticleUpload?.thermoStrideBytes
    ?? sphParticleState?.thermoStrideBytes
    ?? (SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  const mechanicsStrideBytes = sourceMlsMpmParticleUpload?.mechanicsStrideBytes
    ?? mlsMpmParticleState?.mechanicsStrideBytes
    ?? (MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  const sourceSlot = sourceSphParticleUpload?.slot ?? 0;
  const nextSlot = sourceSlot === 0 ? 1 : 0;
  const sourceTime = finiteNumber(
    sourceSphParticleUpload?.time ?? sphParticleState?.time,
    0
  );
  const commonEpoch = {
    storageGeneration: nextStorageGeneration,
    bufferFamilyGeneration: nextStorageGeneration,
    bufferFamilyGenerationStatus:
      'schroeder-two-level-substep-buffer-family-generation-advanced',
    physicsTick: execution.physicsTick,
    physicsSubstep: nextPhysicsSubstep,
    positionEpoch: nextPositionEpoch,
    topologyEpoch: execution.topologyEpoch,
    chartEpoch: execution.chartEpoch,
    levelEpoch: execution.levelEpoch,
    supportEpoch: execution.supportEpoch
  };
  return {
    sphParticleUpload: {
      ...sourceSphParticleUpload,
      ...commonEpoch,
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      sourceStage,
      particleCount,
      stateStrideBytes,
      thermoStrideBytes,
      stateBufferByteLength: Math.max(
        Number(g2pReconstruction.stateBufferByteLength) || 0,
        Number(g2pReconstruction.stateBuffer?.size) || 0,
        particleCount * stateStrideBytes
      ),
      thermoBufferByteLength: Math.max(
        Number(sourceSphParticleUpload?.thermoBufferByteLength) || 0,
        Number(thermoBuffer?.size) || 0,
        particleCount * thermoStrideBytes
      ),
      stateBuffer: g2pReconstruction.stateBuffer,
      thermoBuffer,
      identityBuffer,
      identityRequired,
      identitySchema: sourceSphParticleUpload?.identitySchema
        || ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
      identityStrideBytes: sourceSphParticleUpload?.identityStrideBytes
        || (SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT),
      identityBufferByteLength:
        sourceSphParticleUpload?.identityBufferByteLength || 0,
      identityRevision: sourceSphParticleUpload?.identityRevision || null,
      phaseCarrierPlan: sourceSphParticleUpload?.phaseCarrierPlan
        ? { ...sourceSphParticleUpload.phaseCarrierPlan }
        : (sphParticleState?.phaseCarrierPlan
            ? { ...sphParticleState.phaseCarrierPlan }
            : null),
      renderDomainKeys: {
        ...(sourceSphParticleUpload?.renderDomainKeys
          || sphParticleState?.renderDomainKeys
          || {})
      },
      ownsStateBuffer: true,
      ownsThermoBuffer: false,
      ownsIdentityBuffer: false,
      identityOwnership: identityBuffer
        ? 'borrowed-from-macro-step-source'
        : 'legacy-no-identity-buffer',
      slot: nextSlot,
      sourceSlot,
      nextSlot,
      step: sourceSphParticleUpload?.step ?? sphParticleState?.step ?? 0,
      time: sourceTime + finiteNumber(elapsedDtS, 0)
    },
    mlsMpmParticleUpload: {
      ...sourceMlsMpmParticleUpload,
      ...commonEpoch,
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      sourceStage,
      particleCount,
      mechanicsStrideBytes,
      mechanicsBufferByteLength: Math.max(
        Number(g2pReconstruction.mechanicsBufferByteLength) || 0,
        Number(g2pReconstruction.mechanicsBuffer?.size) || 0,
        particleCount * mechanicsStrideBytes
      ),
      mechanicsBuffer: g2pReconstruction.mechanicsBuffer,
      phaseCarrierPlan: sourceMlsMpmParticleUpload?.phaseCarrierPlan
        ? { ...sourceMlsMpmParticleUpload.phaseCarrierPlan }
        : (sourceSphParticleUpload?.phaseCarrierPlan
            ? { ...sourceSphParticleUpload.phaseCarrierPlan }
            : null),
      ownsMechanicsBuffer: true,
      slot: nextSlot,
      sourceSlot,
      nextSlot,
      step: sourceMlsMpmParticleUpload?.step
        ?? mlsMpmParticleState?.step
        ?? 0,
      time: finiteNumber(
        sourceMlsMpmParticleUpload?.time ?? mlsMpmParticleState?.time,
        0
      ) + finiteNumber(elapsedDtS, 0)
    }
  };
}

/**
 * One coupled two-level MLS-MPM step over a single particle set partitioned
 * by Schroeder level assignment (composite-grid form, shared dt; subcycling
 * is a planned extension):
 *
 *   P2G(fine level, dx)          P2G(coarse level, 2dx)
 *            \\                       |
 *      restrict(accumulate) --> combined coarse grid
 *            |                        |
 *      grid update (fine)      grid update (coarse)
 *            |                        |
 *      delta-prolongation  <-- coarse velocity change
 *            |                        |
 *      G2P (fine particles)    G2P (coarse particles)
 *
 * Both G2P passes are level-filtered with copy-through, chained so the
 * second pass preserves the first pass's outputs. All intermediate buffers
 * stay GPU-resident; the optional conservation summary row is the only
 * readback on the default path.
 */
export async function runSchroederTwoLevelMechanicsStepWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  levelAssignment,
  fineActiveNodeList,
  coarseActiveNodeList,
  hierarchyView = null,
  fineLevel = 0,
  baseGridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = [4, 4, 4],
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  gravityMPerS2 = [0, -9.80665, 0],
  internalPressureScale = 1,
  ambientPressurePa = 0,
  fineSubstepCount = 1,
  gridSpecFactory,
  p2gRunner,
  gridUpdateRunner,
  g2pRunner,
  invariantEvidenceRunner = runSchroederCrossLevelInvariantEvidenceWebGpu,
  momentumAccumulationRunner = runSchroederSameGridMomentumAccumulationWebGpu,
  deltaProlongationRunner =
    runSchroederCrossLevelGridVelocityDeltaProlongationWebGpu,
  conservationSummaryRunner =
    runSchroederCrossLevelGridConservationSummaryWebGpu,
  compactSummaryRunner = runMlsMpmResidentSummaryWebGpu,
  parentFieldMechanicsWorkspaceRuntimeFactory =
    directSchroederSpatialParentFieldMechanicsWorkspaceGpu,
  canonicalEpochController = null,
  postMechanicsConsumerReaderIds = [],
  postMechanicsConsumerSupportProfileIds = {},
  retainOutputParticleBuffers = true,
  conservationSummaryReadback = false,
  invariantEvidenceReadback = conservationSummaryReadback,
  compactSummaryReadback = false
} = {}) {
  assertWebGpuDevice(device, 'runSchroederTwoLevelMechanicsStepWebGpu');
  if (typeof gridSpecFactory !== 'function'
    || typeof p2gRunner !== 'function'
    || typeof gridUpdateRunner !== 'function'
    || typeof g2pRunner !== 'function'
    || typeof invariantEvidenceRunner !== 'function'
    || typeof momentumAccumulationRunner !== 'function'
    || typeof deltaProlongationRunner !== 'function'
    || typeof conservationSummaryRunner !== 'function'
    || typeof compactSummaryRunner !== 'function'
    || typeof parentFieldMechanicsWorkspaceRuntimeFactory !== 'function') {
    throw new TypeError(
      'runSchroederTwoLevelMechanicsStepWebGpu requires its grid, transfer, summary, and particle runners'
    );
  }
  if (!levelAssignment) {
    throw new TypeError('runSchroederTwoLevelMechanicsStepWebGpu requires a Schroeder level assignment');
  }
  let activeCanonicalEpoch = canonicalEpochController?.initialEpoch ?? null;
  if (canonicalEpochController && (
    !activeCanonicalEpoch
    || typeof canonicalEpochController.admitP2g !== 'function'
    || typeof canonicalEpochController.admitG2p !== 'function'
    || typeof canonicalEpochController.commitAndRelease !== 'function'
    || typeof canonicalEpochController.refresh !== 'function'
    || typeof canonicalEpochController.releaseFusedPriorEpochAfterSuccessor
      !== 'function'
    || typeof canonicalEpochController.abortAllAfter !== 'function'
    || typeof canonicalEpochController.completionPromise !== 'function'
  )) {
    throw new TypeError(
      'canonicalEpochController requires the fused-private admit/commit/refresh/release contract'
    );
  }
  const epochGeneration = () => activeCanonicalEpoch?.generation ?? null;
  const epochAssignment = () => activeCanonicalEpoch?.levelAssignment ?? levelAssignment;
  const epochHierarchy = () => activeCanonicalEpoch?.generation?.hierarchyView
    ?? activeCanonicalEpoch?.hierarchyView
    ?? hierarchyView;
  const epochProposal = () => activeCanonicalEpoch?.mechanicalProposal ?? null;
  const canonicalMechanicsArgs = () => activeCanonicalEpoch ? {
    schroederSpatialEpochGeneration: epochGeneration(),
    canonicalSpatialRequired: true
  } : {};
  if (activeCanonicalEpoch && (
    activeCanonicalEpoch.levelAssignment !== levelAssignment
    || !epochGeneration()
    || epochHierarchy() == null
    || canonicalEpochController?.summary?.().mechanicsEpochMode
      !== 'fused-private-mechanics'
  )) {
    throw new TypeError(
      'canonicalEpochController initial epoch does not match the supplied two-level authority'
    );
  }
  const identityRequired = sphParticleUpload?.identityRequired === true
    || sphParticleStateRequiresExplicitIdentity(sphParticleState);
  const identityBuffer = sphParticleUpload?.status === 'webgpu-uploaded'
    ? sphParticleUpload.identityBuffer
    : null;
  if (identityRequired && !identityBuffer) {
    throw new TypeError(
      'Schroeder two-level mechanics requires resident identity for arbitrary render domains'
    );
  }
  if (
    identityBuffer
    && sphParticleUpload?.identitySchema
    && sphParticleUpload?.identitySchema !== ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
  ) {
    throw new TypeError('Schroeder two-level mechanics received an incompatible identity schema');
  }
  const resolvedFineLevel = Math.round(finiteNumber(fineLevel, 0));
  const coarseLevel = resolvedFineLevel + 1;
  const baseDx = Math.max(1e-9, finiteNumber(baseGridSpacingM, 0));
  // Spatial mechanics field views publish their grid spacing through the
  // float32 GPU ABI. Normalize the producer arguments to that same value so
  // non-binary particle spacings (for example 1.6 / 8) retain exact identity
  // across the directory -> field-view -> P2G admission chain.
  const fineDx = Math.fround(baseDx * (2 ** resolvedFineLevel));
  const coarseDx = Math.fround(fineDx * 2);
  const dtSeconds = finiteNumber(dt, 0);
  // Subcycling: the coarse level advances one full dt while the fine level
  // takes fineSubstepCount substeps of dt / fineSubstepCount, each applying
  // its time-interpolated share of the coarse velocity correction.
  const requestedSubsteps = Number(fineSubstepCount);
  if (activeCanonicalEpoch && (
    !Number.isInteger(requestedSubsteps)
    || requestedSubsteps < 1
    || requestedSubsteps > 4
  )) {
    throw new RangeError(
      'Canonical fused mechanics fineSubstepCount must be an exact integer from 1 through 4'
    );
  }
  if (activeCanonicalEpoch && (!Number.isFinite(Number(dt)) || Number(dt) <= 0)) {
    throw new RangeError(
      'Canonical fused mechanics macro dt must be finite and positive'
    );
  }
  const substeps = activeCanonicalEpoch
    ? requestedSubsteps
    : Math.max(1, Math.round(finiteNumber(fineSubstepCount, 1)));
  const dtFine = dtSeconds / substeps;
  if (activeCanonicalEpoch && (
    !Number.isFinite(dtFine)
    || dtFine <= 0
    || Math.fround(dtFine * substeps) !== Math.fround(dtSeconds)
  )) {
    throw new RangeError(
      'Canonical fused mechanics requires finite positive fine dt with exact float32 macro identity'
    );
  }
  const fineSpec = gridSpecFactory({ boxDimsM, gridSpacingM: fineDx });
  const coarseSpec = gridSpecFactory({ boxDimsM, gridSpacingM: coarseDx });

  const cleanupEntries = new Map();
  let cleanupScheduled = false;
  let cleanupAttemptPromise = null;
  let cleanupAttemptDeviceLost = false;
  let deviceLossCleanupEvidencePromise = null;
  let resolveTrackedCleanupCompletion;
  const trackedCleanupCompletionPromise = new Promise((resolve) => {
    resolveTrackedCleanupCompletion = resolve;
  });
  const trackCleanup = (resource, destroy) => {
    if (resource && !cleanupEntries.has(resource)) {
      cleanupEntries.set(resource, destroy);
    }
    return resource;
  };
  const releaseCleanup = (resource) => {
    if (resource) cleanupEntries.delete(resource);
  };
  const exactTwoLevelDeviceLossEvidence = () => {
    if (deviceLossCleanupEvidencePromise == null) {
      const lossEvidence = device?.lost;
      if (!lossEvidence || typeof lossEvidence.then !== 'function') {
        throw new Error(
          'device-loss cleanup requires the exact GPUDevice.lost evidence promise'
        );
      }
      deviceLossCleanupEvidencePromise = Promise.resolve(lossEvidence).then(
        () => true
      );
      deviceLossCleanupEvidencePromise.catch(() => {});
    }
    return deviceLossCleanupEvidencePromise;
  };
  const scheduleTrackedCleanup = ({ deviceLost = false } = {}) => {
    if (deviceLost === true) exactTwoLevelDeviceLossEvidence();
    if (cleanupScheduled) {
      return deviceLost === true
        ? deviceLossCleanupEvidencePromise
        : Promise.resolve(true);
    }
    if (cleanupAttemptPromise) {
      if (deviceLost !== true || cleanupAttemptDeviceLost === true) {
        return cleanupAttemptPromise;
      }
      // Loss evidence supersedes a queue-fence attempt, but the old attempt
      // retains its own identity. Its eventual callbacks must not clear or
      // otherwise replace the newer loss-gated attempt below.
      cleanupAttemptPromise.catch(() => {});
    }
    let ownerFence;
    try {
      ownerFence = deviceLost === true
        ? exactTwoLevelDeviceLossEvidence()
        : typeof device?.queue?.onSubmittedWorkDone === 'function'
        ? device.queue.onSubmittedWorkDone()
        : Promise.resolve(true);
    } catch (error) {
      throw error;
    }
    if (!ownerFence || typeof ownerFence.then !== 'function') {
      throw new Error(
        'two-level mechanics cleanup requires a queue-fence thenable'
      );
    }
    let handled = null;
    handled = Promise.resolve(ownerFence).then(() => {
      const errors = [];
      for (const [resource, destroy] of cleanupEntries) {
        try {
          destroy?.();
          cleanupEntries.delete(resource);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) {
        throw errors.length === 1
          ? errors[0]
          : new AggregateError(
            errors,
            'two-level mechanics queue-fenced cleanup was incomplete'
          );
      }
      cleanupScheduled = true;
      if (cleanupAttemptPromise === handled) {
        cleanupAttemptPromise = null;
        cleanupAttemptDeviceLost = false;
      }
      resolveTrackedCleanupCompletion(true);
      return true;
    }).catch((error) => {
      if (cleanupAttemptPromise === handled) {
        cleanupAttemptPromise = null;
        cleanupAttemptDeviceLost = false;
      }
      throw error;
    });
    cleanupAttemptPromise = handled;
    cleanupAttemptDeviceLost = deviceLost === true;
    cleanupAttemptPromise.catch(() => {});
    return cleanupAttemptPromise;
  };
  const trackedCleanupCapability = Object.freeze({
    completionPromise: trackedCleanupCompletionPromise,
    retry: scheduleTrackedCleanup
  });

  let fusedMacroAuthority = null;
  let fusedActiveMicroepochAuthority = null;
  let fusedPendingClosure = null;
  let fusedRetirementRecoveryCapability = null;
  let failureRecoveryAttemptPromise = null;
  let failureRecoveryAttemptDeviceLost = false;
  let failureMechanicsRetired = false;
  let failureControllerRetired = false;
  let failureCleanupComplete = false;
  let resolveFailureCleanupCompletion;
  const failureCleanupCompletionPromise = new Promise((resolve) => {
    resolveFailureCleanupCompletion = resolve;
  });

  const recoverFailedMechanicsCleanup = (
    reason,
    { deviceLost = false } = {}
  ) => {
    if (failureCleanupComplete) {
      return deviceLost === true
        ? exactTwoLevelDeviceLossEvidence()
        : Promise.resolve(true);
    }
    if (failureRecoveryAttemptPromise) {
      if (deviceLost !== true || failureRecoveryAttemptDeviceLost === true) {
        return failureRecoveryAttemptPromise;
      }
      failureRecoveryAttemptPromise.catch(() => {});
    }
    let handled = null;
    handled = (async () => {
      if (deviceLost === true) await exactTwoLevelDeviceLossEvidence();
      if (!failureMechanicsRetired && fusedMacroAuthority) {
        const mechanicsRetirement = fusedPendingClosure
          ? abandonSchroederFusedMechanicsPendingClosureAfter(
              device,
              fusedPendingClosure,
              { reason, deviceLost }
            )
          : abortSchroederTwoLevelMacroAuthorityAfter(
              device,
              fusedMacroAuthority,
              {
                microepochAuthority: fusedActiveMicroepochAuthority,
                reason,
                deviceLost
              }
            );
        if (await mechanicsRetirement !== true) {
          throw new Error('fused mechanics abort retirement was not confirmed');
        }
        failureMechanicsRetired = true;
      } else if (!fusedMacroAuthority) {
        failureMechanicsRetired = true;
      }
      if (fusedRetirementRecoveryCapability?.retry) {
        if (await fusedRetirementRecoveryCapability.retry({ deviceLost }) !== true) {
          throw new Error(
            'fused mechanics prerequisite retirement was not confirmed'
          );
        }
      }
      if (!failureControllerRetired && canonicalEpochController) {
        if (await canonicalEpochController.abortAllAfter(reason, {
          mechanicsRetirement: Promise.resolve(failureMechanicsRetired),
          deviceLost
        }) !== true) {
          throw new Error('canonical epoch controller cleanup was not confirmed');
        }
        failureControllerRetired = true;
      } else if (!canonicalEpochController) {
        failureControllerRetired = true;
      }
      if (await scheduleTrackedCleanup({ deviceLost }) !== true) {
        throw new Error('generic two-level mechanics cleanup was not confirmed');
      }
      failureCleanupComplete = true;
      if (failureRecoveryAttemptPromise === handled) {
        failureRecoveryAttemptPromise = null;
        failureRecoveryAttemptDeviceLost = false;
      }
      resolveFailureCleanupCompletion(true);
      return true;
    })().catch((error) => {
      if (failureRecoveryAttemptPromise === handled) {
        failureRecoveryAttemptPromise = null;
        failureRecoveryAttemptDeviceLost = false;
      }
      throw error;
    });
    failureRecoveryAttemptPromise = handled;
    failureRecoveryAttemptDeviceLost = deviceLost === true;
    failureRecoveryAttemptPromise.catch(() => {});
    return failureRecoveryAttemptPromise;
  };

  const runCanonicalSparseMechanics = async () => {
    if (retainOutputParticleBuffers !== true) {
      throw new TypeError(
        'Canonical fused mechanics requires retained S* buffers for its pending closure'
      );
    }
    if (conservationSummaryReadback || invariantEvidenceReadback) {
      const error = new Error(
        'Canonical sparse mechanics does not yet publish measured conservation or invariant evidence'
      );
      error.code = 'ERR_SCHROEDER_SPARSE_EVIDENCE_UNAVAILABLE';
      throw error;
    }
    if (!device?.createCommandEncoder || !device?.queue?.submit) {
      throw new TypeError(
        'Canonical parent-field mechanics requires command encoding and queue submission'
      );
    }
    if (!device.queue?.onSubmittedWorkDone) {
      throw new TypeError(
        'Canonical parent-field mechanics requires queue-fenced workspace retirement'
      );
    }

    const pendingWorkspaceRetirements = new Set();
    const workspaceRetirementRecords = [];
    const workspaceRetirementByExecution = new Map();
    const workspaceExecutions = [];
    const p2gProjections = [];
    const fineGridUpdates = [];
    const fineLifecycleRetirementRecords = [];
    const pendingFineLifecycleRetirements = new Set();
    let workspaceBuildCount = 0;
    let fineCorrectionCount = 0;
    let coarseTerminalCount = 0;
    const initialParentFieldView = epochGeneration()?.parentFieldView ?? null;
    if (!initialParentFieldView?.parentFieldCapacity) {
      throw new TypeError(
        'Canonical sparse mechanics requires an initial parent-field capacity for reflux'
      );
    }
    const macroRefluxLedger = createSchroederCrossLevelRefluxLedgerGpu(device, {
      parentFieldCapacity: initialParentFieldView.parentFieldCapacity,
      coarseFieldCapacity: initialParentFieldView.coarseFieldCapacity,
      completionOrdinal: epochGeneration()?.execution?.generationId ?? 1,
      fineSubstepCount: substeps,
      fineLevel: resolvedFineLevel,
      coarseLevel,
      coarseGridSpacingM: coarseDx,
      label: 'ulg-schroeder-two-level-macro-reflux-ledger'
    });
    trackCleanup(macroRefluxLedger, () => macroRefluxLedger.destroy());

    const parentFieldViewForEpoch = () => {
      const parentFieldView = epochGeneration()?.parentFieldView ?? null;
      if (
        !parentFieldView
        || parentFieldView.fineLevel !== resolvedFineLevel
        || parentFieldView.coarseLevel !== coarseLevel
        || parentFieldView.exactLevelCount !== 2
      ) {
        throw new TypeError(
          'Canonical sparse mechanics requires the current generation parent-field view'
        );
      }
      return parentFieldView;
    };

    const workspaceRuntimeFor = (parentFieldView) => {
      const runtime = parentFieldMechanicsWorkspaceRuntimeFactory(device, {
        parentFieldCapacity: parentFieldView.parentFieldCapacity,
        fineFieldCapacity: parentFieldView.fineFieldCapacity,
        arenaCount: DIRECT_PARENT_FIELD_MECHANICS_ARENA_COUNT
      });
      if (
        !runtime?.encodePredictors
        || !runtime?.markPredictorsSubmitted
        || !runtime?.encodeFineCorrection
        || !runtime?.encodeCoarseTerminal
        || !runtime?.markTerminalSubmitted
        || !runtime?.releaseExecutionAfter
        || !runtime?.releaseExecution
        || !runtime?.ownsExecution
        || !runtime?.isExecutionSubmitted
        || !runtime?.isTerminalSubmitted
      ) {
        throw new TypeError(
          'Canonical sparse mechanics requires a phased parent-field workspace runtime'
        );
      }
      return runtime;
    };

    const createWorkspaceRetirementRecord = (runtime, execution) => {
      let resolveCompletion;
      const completionPromise = new Promise((resolve) => {
        resolveCompletion = resolve;
      });
      const record = {
        runtime,
        execution,
        released: false,
        inFlight: null,
        inFlightDeviceLost: false,
        failureReason: null,
        completionPromise,
        resolveCompletion,
        attempt: null
      };
      record.attempt = ({ deviceLost = false } = {}) => {
        if (record.released) {
          return deviceLost === true
            ? exactTwoLevelDeviceLossEvidence()
            : Promise.resolve(true);
        }
        if (record.inFlight) {
          if (deviceLost !== true || record.inFlightDeviceLost === true) {
            return record.inFlight;
          }
          // Device loss supersedes a normal fence attempt. Attempt identity
          // guards below prevent the stale callbacks from clearing or
          // poisoning the newer loss-gated attempt.
          record.inFlight.catch(() => {});
        }
        let handled = null;
        handled = (async () => {
          if (deviceLost === true) {
            await exactTwoLevelDeviceLossEvidence();
          }
          if (record.released) return true;
          if (deviceLost === true) {
            if (
              typeof runtime.quarantineExecutionAfterDeviceLoss !== 'function'
            ) {
              throw new Error(
                'parent-field workspace device-loss quarantine is unavailable'
              );
            }
            return runtime.quarantineExecutionAfterDeviceLoss(execution);
          }
          if (!runtime.ownsExecution?.(execution)) {
            if (execution?.released === true) return true;
            throw new Error(
              'parent-field workspace retirement lost its exact owner'
            );
          }
          if (runtime.isExecutionSubmitted?.(execution)) {
            const ownerFence = device.queue.onSubmittedWorkDone();
            if (!ownerFence || typeof ownerFence.then !== 'function') {
              throw new Error(
                'parent-field workspace retirement requires a queue-fence thenable'
              );
            }
            return runtime.releaseExecutionAfter(execution, ownerFence);
          }
          return runtime.releaseExecution?.(
            execution,
            { discardedEncoder: true }
          );
        })().then((retired) => {
          if (record.released) return true;
          if (retired !== true) {
            throw new Error(
              'parent-field mechanics workspace retirement was not confirmed'
            );
          }
          record.released = true;
          record.failureReason = null;
          if (record.inFlight === handled) {
            record.inFlight = null;
            record.inFlightDeviceLost = false;
          }
          pendingWorkspaceRetirements.delete(handled);
          releaseCleanup(execution);
          resolveCompletion(true);
          return true;
        }, (error) => {
          if (record.inFlight === handled && !record.released) {
            record.failureReason = error;
            record.inFlight = null;
            record.inFlightDeviceLost = false;
          }
          pendingWorkspaceRetirements.delete(handled);
          throw error;
        });
        handled.catch(() => {});
        record.inFlight = handled;
        record.inFlightDeviceLost = deviceLost === true;
        pendingWorkspaceRetirements.add(handled);
        return handled;
      };
      workspaceRetirementRecords.push(record);
      workspaceRetirementByExecution.set(execution, record);
      return record;
    };

    const registerWorkspace = (runtime, execution) => {
      workspaceExecutions.push(execution);
      createWorkspaceRetirementRecord(runtime, execution);
      return execution;
    };

    const retireWorkspace = (runtime, execution) => {
      const record = workspaceRetirementByExecution.get(execution);
      if (!record || record.runtime !== runtime) {
        throw new Error('parent-field workspace retirement is stale or foreign');
      }
      return record.attempt();
    };

    const retryWorkspaceRetirements = async ({ deviceLost = false } = {}) => {
      const results = await Promise.all(
        workspaceRetirementRecords.map((record) => record.attempt({ deviceLost }))
      );
      return results.every((retired) => retired === true);
    };
    fusedRetirementRecoveryCapability = Object.freeze({
      retry: retryWorkspaceRetirements
    });

    const runProjection = async ({
      selectedLevel,
      gridSpacingM,
      projectionDt,
      currentSphUpload,
      currentMlsUpload,
      particleContinuation = null,
      fineTransaction = null,
      terminalTransaction = null
    }) => {
      const projection = await p2gRunner({
        device,
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload: currentSphUpload,
        mlsMpmParticleUpload: currentMlsUpload,
        schroederLevelAssignment: epochAssignment(),
        schroederSelectedLevel: selectedLevel,
        gridSpacingM,
        boxDimsM,
        dt: projectionDt,
        internalPressureScale,
        ambientPressurePa,
        mechanicsFieldMode: MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED,
        retainGridBuffer: false,
        readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
        ...canonicalMechanicsArgs(),
        ...(particleContinuation
          ? { canonicalParticleContinuation: particleContinuation }
          : {}),
        ...(fineTransaction
          ? { fusedFineSubstepTransaction: fineTransaction }
          : {}),
        ...(terminalTransaction
          ? { fusedCoarseTerminalTransaction: terminalTransaction }
          : {})
      });
      p2gProjections.push(projection);
      return projection;
    };

    const submitWorkspacePredictors = async ({
      parentFieldView,
      fineProjection,
      coarseProjection,
      predictorDt,
      fineSubstepOrdinal,
      fineTransaction
    }) => {
      let runtime = null;
      for (;;) {
        if (!runtime) {
          try {
            runtime = workspaceRuntimeFor(parentFieldView);
          } catch (error) {
            if (
              error?.code
                === 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_CACHE_BACKPRESSURE'
              && pendingWorkspaceRetirements.size > 0
            ) {
              await Promise.race(pendingWorkspaceRetirements);
              continue;
            }
            throw error;
          }
        }
        const encoder = device.createCommandEncoder();
        let execution = null;
        try {
          execution = runtime.encodePredictors(encoder, {
            parentFieldView,
            fineP2gProjection: fineProjection,
            coarseP2gProjection: coarseProjection,
            dt: predictorDt,
            fineDt: dtFine,
            macroDt: dtSeconds,
            fineSubstepOrdinal,
            fineSubstepCount: substeps,
            terminalOperation: false,
            gravityMPerS2,
            boxDimsM,
            cflFactor: DEFAULT_CFL_FACTOR,
            // Full-J acceptance is governed by the resulting fine/coarse CFL
            // endpoints. A second coarse-dx/macro-dt delta-v ceiling is not
            // ratio invariant and would reject valid r=4 transactions.
            maxCorrectionMPerS: 0,
            wallBarrierElasticStiffnessNPerM: 0,
            wallBarrierContactScale: 1,
            wallBarrierMinGapM: 1e-6,
            refluxLedger: macroRefluxLedger,
            fusedFineSubstepTransaction: fineTransaction
          });
          device.queue.submit([encoder.finish()]);
          runtime.markPredictorsSubmitted(execution);
          workspaceBuildCount += 1;
          return {
            runtime,
            execution: registerWorkspace(runtime, execution)
          };
        } catch (error) {
          if (execution && runtime.ownsExecution?.(execution)) {
            try {
              if (runtime.isExecutionSubmitted?.(execution)) {
                runtime.releaseExecutionAfter(
                  execution,
                  device.queue.onSubmittedWorkDone()
                ).catch(() => false);
              } else {
                runtime.releaseExecution?.(execution, { discardedEncoder: true });
              }
            } catch {
              // Preserve the originating admission/submission error.
            }
          }
          if (
            error?.code === 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_EXHAUSTED'
            && pendingWorkspaceRetirements.size > 0
          ) {
            await Promise.race(pendingWorkspaceRetirements);
            continue;
          }
          throw error;
        }
      }
    };

    const submitFineCorrection = ({
      runtime,
      execution,
      fineGridUpdate,
      fineTransaction
    }) => {
      const encoder = device.createCommandEncoder();
      const correctedGridUpdate = runtime.encodeFineCorrection(encoder, execution, {
        fineGridUpdate,
        deltaScale: 1,
        maxCorrectionMPerS: 0,
        fusedFineSubstepTransaction: fineTransaction
      });
      try {
        device.queue.submit([encoder.finish()]);
      } catch (error) {
        if (
          execution?.fusedFineSubstepTransaction != null
          && typeof runtime.resetUnsubmittedFineCorrection === 'function'
        ) {
          runtime.resetUnsubmittedFineCorrection(execution, {
            discardedEncoder: true
          });
        }
        throw error;
      }
      runtime.markTerminalSubmissionObserved?.(execution);
      runtime.markTerminalSubmitted(execution);
      fineCorrectionCount += 1;
      return correctedGridUpdate ?? fineGridUpdate;
    };

    const submitCoarseTerminal = async ({
      parentFieldView,
      coarseGridUpdate,
      terminalTransaction
    }) => {
      let runtime = null;
      for (;;) {
        if (!runtime) {
          try {
            runtime = workspaceRuntimeFor(parentFieldView);
          } catch (error) {
            if (
              error?.code
                === 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_CACHE_BACKPRESSURE'
              && pendingWorkspaceRetirements.size > 0
            ) {
              await Promise.race(pendingWorkspaceRetirements);
              continue;
            }
            throw error;
          }
        }
        const encoder = device.createCommandEncoder();
        let artifact = null;
        let execution = null;
        try {
          artifact = runtime.encodeCoarseTerminal(encoder, {
            parentFieldView,
            coarseGridUpdate,
            refluxLedger: macroRefluxLedger,
            fineSubstepCount: substeps,
            fineDt: dtFine,
            fusedCoarseTerminalTransaction: terminalTransaction
          });
          execution = artifact.parentFieldMechanicsWorkspaceExecution;
          device.queue.submit([encoder.finish()]);
          runtime.markTerminalSubmissionObserved(execution);
          runtime.markTerminalSubmitted(execution);
          workspaceBuildCount += 1;
          coarseTerminalCount += 1;
          return {
            runtime,
            execution: registerWorkspace(runtime, execution),
            artifact
          };
        } catch (error) {
          if (execution && runtime.ownsExecution?.(execution)) {
            try {
              if (runtime.isExecutionSubmitted?.(execution)) {
                runtime.releaseExecutionAfter(
                  execution,
                  device.queue.onSubmittedWorkDone()
                ).catch(() => false);
              } else {
                runtime.releaseExecution?.(execution, {
                  discardedEncoder: true
                });
              }
            } catch {
              // Preserve the originating terminal admission/submission error.
            }
          }
          if (
            error?.code === 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_ARENA_EXHAUSTED'
            && pendingWorkspaceRetirements.size > 0
          ) {
            await Promise.race(pendingWorkspaceRetirements);
            continue;
          }
          throw error;
        }
      }
    };

    let ownsThermoBuffer = false;
    let thermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded'
      ? sphParticleUpload.thermoBuffer
      : null;
    if (!thermoBuffer) {
      thermoBuffer = writeStorageBuffer(
        device,
        'ulg-schroeder-two-level-sparse-thermo-in',
        sphParticleState.thermo
      );
      ownsThermoBuffer = true;
      trackCleanup(thermoBuffer, () => thermoBuffer?.destroy?.());
    }

    let currentSphUpload = sphParticleUpload;
    let currentMlsUpload = mlsMpmParticleUpload;
    let lastFineG2p = null;
    let lastFineGridUpdate = null;
    let activeParticleContinuation = null;
    let activeLifecycleCanonicalEpoch = Object.freeze({
      generation: epochGeneration(),
      sphParticleUpload: currentSphUpload,
      mlsMpmParticleUpload: currentMlsUpload
    });

    fusedMacroAuthority = createSchroederTwoLevelMacroAuthority({
      device,
      canonicalEpoch: activeLifecycleCanonicalEpoch,
      refluxLedger: macroRefluxLedger,
      fineSubstepCount: substeps,
      fineLevel: resolvedFineLevel,
      coarseLevel,
      fineDt: dtFine,
      macroDt: dtSeconds
    });
    // The authenticated macro authority is now the sole H7 ledger owner. Its
    // close/abort path must retire the ledger exactly once after its GPU fence.
    releaseCleanup(macroRefluxLedger);
    activeParticleContinuation = createSchroederCanonicalParticleContinuation({
      device,
      macroAuthority: fusedMacroAuthority,
      sphParticleUpload: currentSphUpload,
      mlsMpmParticleUpload: currentMlsUpload,
      ordinal: 0
    });
    fusedActiveMicroepochAuthority = createSchroederFineMicroepochAuthority({
      device,
      macroAuthority: fusedMacroAuthority,
      canonicalEpoch: activeLifecycleCanonicalEpoch,
      particleContinuation: activeParticleContinuation,
      substepOrdinal: 0
    });

    for (let substep = 0; substep < substeps; substep += 1) {
      const priorCanonicalEpoch = activeCanonicalEpoch;
      const priorMicroepochAuthority = fusedActiveMicroepochAuthority;
      const priorParticleContinuation = activeParticleContinuation;
      const parentFieldView = parentFieldViewForEpoch();
      const predictorThetaDt = Math.fround(
        ((substep + 1) / substeps) * dtSeconds
      );
      const fineTransaction = createSchroederFusedFineSubstepTransaction({
        device,
        macroAuthority: fusedMacroAuthority,
        microepochAuthority: priorMicroepochAuthority,
        particleContinuation: activeParticleContinuation,
        substepOrdinal: substep
      });
      canonicalEpochController.admitP2g(priorCanonicalEpoch);
      const fineProjection = await runProjection({
        selectedLevel: resolvedFineLevel,
        gridSpacingM: fineDx,
        projectionDt: dtFine,
        currentSphUpload,
        currentMlsUpload,
        particleContinuation: activeParticleContinuation,
        fineTransaction
      });
      const coarsePredictorProjection = await runProjection({
        selectedLevel: coarseLevel,
        gridSpacingM: coarseDx,
        projectionDt: predictorThetaDt,
        currentSphUpload,
        currentMlsUpload
      });
      const workspace = await submitWorkspacePredictors({
        parentFieldView,
        fineProjection,
        coarseProjection: coarsePredictorProjection,
        predictorDt: predictorThetaDt,
        fineSubstepOrdinal: substep,
        fineTransaction
      });
      const fineGridUpdate = await gridUpdateRunner({
        device,
        p2gGridProjection: fineProjection,
        mechanicsFieldMode: MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED,
        fusedFineSubstepTransaction: fineTransaction,
        dt: dtFine,
        gravityMPerS2,
        boxDimsM,
        mechanicsFieldEnergyReceipt: { deferSeal: true },
        retainUpdatedGridBuffer: false,
        readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
      });
      fineGridUpdates.push(fineGridUpdate);
      const correctedFineGridUpdate = submitFineCorrection({
        ...workspace,
        fineGridUpdate,
        fineTransaction
      });
      lastFineGridUpdate = correctedFineGridUpdate;
      canonicalEpochController.admitG2p(priorCanonicalEpoch);
      const fineG2p = await g2pRunner({
        device,
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload: currentSphUpload,
        mlsMpmParticleUpload: currentMlsUpload,
        gridUpdate: correctedFineGridUpdate,
        mechanicsFieldMode: MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED,
        dt: dtFine,
        boxDimsM,
        internalPressureScale,
        liquidWallDampingAlpha: 0,
        liquidWallDampingDistanceM: 0,
        schroederLevelAssignment: epochAssignment(),
        schroederSelectedLevel: resolvedFineLevel,
        fusedFineSubstepTransaction: fineTransaction,
        retainOutputParticleBuffers: true,
        readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
        ...canonicalMechanicsArgs(),
        schroederSpatialMechanicalProposal: null
      });
      trackCleanup(fineG2p.stateBuffer, () => fineG2p.stateBuffer?.destroy?.());
      trackCleanup(
        fineG2p.mechanicsBuffer,
        () => fineG2p.mechanicsBuffer?.destroy?.()
      );
      lastFineG2p = fineG2p;

      const nextUploads = createCanonicalTwoLevelSubstepUploads({
        sphParticleState,
        mlsMpmParticleState,
        sourceSphParticleUpload: currentSphUpload,
        sourceMlsMpmParticleUpload: currentMlsUpload,
        epochGeneration: epochGeneration(),
        g2pReconstruction: fineG2p,
        thermoBuffer,
        identityBuffer,
        identityRequired,
        elapsedDtS: dtFine,
        sourceStage: `schroeder-two-level-sparse-fine-substep-${substep}`
      });
      canonicalEpochController.commitAndRelease(priorCanonicalEpoch, {
        nextParticleUploads: nextUploads,
        terminal: false,
        status: `two-level-fused-fine-substep-${substep}-submitted-unverified`
      });
      const nextParticleContinuation =
        createSchroederCanonicalParticleContinuation({
          device,
          macroAuthority: fusedMacroAuthority,
          sphParticleUpload: nextUploads.sphParticleUpload,
          mlsMpmParticleUpload: nextUploads.mlsMpmParticleUpload,
          ordinal: substep + 1,
          priorContinuation: activeParticleContinuation,
          sourceTransaction: fineTransaction,
          g2pReconstruction: fineG2p
        });
      // The fine G2P producer validates the exact live correction workspace
      // while atomically transferring C_{j+1} ownership. Start workspace
      // retirement only after that claim; scheduling it earlier places the
      // runtime in release-in-flight and invalidates the producer lineage.
      retireWorkspace(workspace.runtime, workspace.execution);
      releaseCleanup(fineG2p.stateBuffer);
      releaseCleanup(fineG2p.mechanicsBuffer);
      currentSphUpload = nextUploads.sphParticleUpload;
      currentMlsUpload = nextUploads.mlsMpmParticleUpload;
      let successorCanonicalEpoch = null;
      for (;;) {
        try {
          successorCanonicalEpoch = await canonicalEpochController.refresh({
            priorEpoch: priorCanonicalEpoch,
            currentSphParticleUpload: currentSphUpload,
            currentMlsMpmParticleUpload: currentMlsUpload
          });
          break;
        } catch (error) {
          const retryableBackpressure = [
            'ERR_SCHROEDER_SPATIAL_ARENA_BACKPRESSURE_UNRELEASABLE',
            'ERR_SCHROEDER_FROZEN_REFRESH_BACKPRESSURE'
          ].includes(error?.code);
          const retryableRetirements = fineLifecycleRetirementRecords.filter(
            (record) => record.retired !== true
          );
          if (!retryableBackpressure || retryableRetirements.length === 0) {
            throw error;
          }
          const released = await Promise.any(
            retryableRetirements.map((record) => record.attempt())
          );
          if (released !== true) throw error;
        }
      }
      activeCanonicalEpoch = successorCanonicalEpoch;
      activeLifecycleCanonicalEpoch = Object.freeze({
        generation: successorCanonicalEpoch.generation,
        sphParticleUpload: currentSphUpload,
        mlsMpmParticleUpload: currentMlsUpload
      });
      activeParticleContinuation = nextParticleContinuation;
      fusedActiveMicroepochAuthority = createSchroederFineMicroepochAuthority({
        device,
        macroAuthority: fusedMacroAuthority,
        canonicalEpoch: activeLifecycleCanonicalEpoch,
        particleContinuation: activeParticleContinuation,
        priorMicroepochAuthority,
        substepOrdinal: substep + 1
      });
      let resolveRetirementCompletion;
      const retirementCompletionPromise = new Promise((resolve) => {
        resolveRetirementCompletion = resolve;
      });
      const retirementRecord = {
        priorCanonicalEpoch,
        successorCanonicalEpoch,
        priorMicroepochAuthority,
        successorMicroepochAuthority: fusedActiveMicroepochAuthority,
        priorParticleContinuation,
        nextParticleContinuation,
        releaseReceipt: null,
        microepochRetired: false,
        generationRetired: false,
        continuationRetired: substep === 0,
        quarantined: false,
        terminalAbandoned: false,
        failureReason: null,
        inFlight: null,
        retired: false,
        completionPromise: retirementCompletionPromise,
        resolveCompletion: resolveRetirementCompletion,
        attempt: null
      };
      retirementRecord.attempt = () => {
        if (retirementRecord.retired || retirementRecord.terminalAbandoned) {
          return Promise.resolve(true);
        }
        if (retirementRecord.inFlight) return retirementRecord.inFlight;
        if (retirementRecord.quarantined) {
          const error = new Error(
            'fine lifecycle retirement is quarantined and requires macro abandonment'
          );
          error.code = 'ERR_SCHROEDER_FINE_LIFECYCLE_QUARANTINED';
          error.cause = retirementRecord.failureReason;
          return Promise.reject(error);
        }
        let handled = null;
        handled = Promise.resolve().then(async () => {
          if (!retirementRecord.microepochRetired) {
            const retired = await retireSchroederFineMicroepochAfter(
              device,
              priorMicroepochAuthority,
              {
                successorMicroepochAuthority:
                  retirementRecord.successorMicroepochAuthority
              }
            );
            if (retired !== true) {
              throw new Error('Fused fine microepoch retirement was not confirmed');
            }
            if (retirementRecord.terminalAbandoned) return true;
            retirementRecord.microepochRetired = true;
          }
          if (!retirementRecord.generationRetired) {
            if (!retirementRecord.releaseReceipt) {
              retirementRecord.releaseReceipt =
                canonicalEpochController.releaseFusedPriorEpochAfterSuccessor(
                  priorCanonicalEpoch,
                  { successorEpoch: successorCanonicalEpoch }
                );
            }
            let ownedEpochRetirements;
            try {
              const requiredReleasePromises = [
                retirementRecord.releaseReceipt.generationReleasePromise,
                retirementRecord.releaseReceipt.transactionReleasePromise
              ];
              if (priorCanonicalEpoch.assignmentRuntime) {
                requiredReleasePromises.push(
                  retirementRecord.releaseReceipt.assignmentReleasePromise
                );
              }
              if (requiredReleasePromises.some(
                (promise) => !promise || typeof promise.then !== 'function'
              )) {
                throw new Error(
                  'Fused prior epoch release omitted an ownership-required promise'
                );
              }
              ownedEpochRetirements = await Promise.all(
                requiredReleasePromises.map((promise) => Promise.resolve(promise))
              );
            } catch (error) {
              retirementRecord.releaseReceipt = null;
              throw error;
            }
            if (ownedEpochRetirements.some((retired) => retired !== true)) {
              retirementRecord.releaseReceipt = null;
              throw new Error(
                'Fused prior epoch retirement was not fully confirmed'
              );
            }
            if (retirementRecord.terminalAbandoned) return true;
            retirementRecord.generationRetired = true;
          }
          if (!retirementRecord.continuationRetired) {
            const continuationRetired = await
              retireSchroederCanonicalParticleContinuationOutputAfter(
                device,
                priorParticleContinuation,
                {
                  successorContinuation: nextParticleContinuation,
                  after: Promise.resolve(true)
                }
              );
            if (continuationRetired !== true) {
              throw new Error(
                'intermediate continuation retirement was not confirmed'
              );
            }
            if (retirementRecord.terminalAbandoned) return true;
            retirementRecord.continuationRetired = true;
          }
          retirementRecord.retired = true;
          if (retirementRecord.inFlight === handled) {
            retirementRecord.inFlight = null;
          }
          pendingFineLifecycleRetirements.delete(handled);
          resolveRetirementCompletion(true);
          return true;
        }).catch((error) => {
          if (retirementRecord.terminalAbandoned) return true;
          if (!retirementRecord.microepochRetired) {
            retirementRecord.quarantined = true;
          }
          if (retirementRecord.inFlight === handled) {
            retirementRecord.failureReason = error;
            retirementRecord.inFlight = null;
          }
          pendingFineLifecycleRetirements.delete(handled);
          throw error;
        });
        handled.catch(() => {});
        retirementRecord.inFlight = handled;
        pendingFineLifecycleRetirements.add(handled);
        return handled;
      };
      fineLifecycleRetirementRecords.push(retirementRecord);
      retirementRecord.attempt();
    }

    const terminalTransaction = createSchroederFusedCoarseTerminalTransaction({
      device,
      macroAuthority: fusedMacroAuthority,
      microepochAuthority: fusedActiveMicroepochAuthority,
      particleContinuation: activeParticleContinuation
    });
    canonicalEpochController.admitP2g(activeCanonicalEpoch);
    const finalParentFieldView = parentFieldViewForEpoch();
    const finalCoarseProjection = await runProjection({
      selectedLevel: coarseLevel,
      gridSpacingM: coarseDx,
      projectionDt: dtSeconds,
      currentSphUpload,
      currentMlsUpload,
      particleContinuation: activeParticleContinuation,
      terminalTransaction
    });
    const terminalGridUpdate = await gridUpdateRunner({
      device,
      p2gGridProjection: finalCoarseProjection,
      mechanicsFieldMode: MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED,
      fusedCoarseTerminalTransaction: terminalTransaction,
      dt: dtSeconds,
      gravityMPerS2,
      boxDimsM,
      mechanicsFieldEnergyReceipt: { deferSeal: true },
      retainUpdatedGridBuffer: false,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
    });
    const finalWorkspace = await submitCoarseTerminal({
      parentFieldView: finalParentFieldView,
      coarseGridUpdate: terminalGridUpdate,
      terminalTransaction
    });
    const finalCoarseGridUpdate = finalWorkspace.artifact;
    canonicalEpochController.admitG2p(activeCanonicalEpoch);
    const coarseG2p = await g2pRunner({
      device,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload: currentSphUpload,
      mlsMpmParticleUpload: currentMlsUpload,
      gridUpdate: finalCoarseGridUpdate,
      mechanicsFieldMode: MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED,
      dt: dtSeconds,
      boxDimsM,
      internalPressureScale,
      liquidWallDampingAlpha: 0,
      liquidWallDampingDistanceM: 0,
      schroederLevelAssignment: epochAssignment(),
      schroederSelectedLevel: coarseLevel,
      fusedCoarseTerminalTransaction: terminalTransaction,
      retainOutputParticleBuffers: true,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
      ...canonicalMechanicsArgs(),
      schroederSpatialMechanicalProposal: null
    });
    trackCleanup(coarseG2p.stateBuffer, () => coarseG2p.stateBuffer?.destroy?.());
    trackCleanup(
      coarseG2p.mechanicsBuffer,
      () => coarseG2p.mechanicsBuffer?.destroy?.()
    );
    // The fused terminal transaction owns rollback from the moment its exact
    // G2P artifact is published, even before S* is claimed by a pending token.
    // Remove it from generic cleanup now to prevent double retirement if token
    // construction or terminal private advancement fails.
    releaseCleanup(coarseG2p.stateBuffer);
    releaseCleanup(coarseG2p.mechanicsBuffer);

    const compactSummary = compactSummaryReadback
      ? await compactSummaryRunner({
          device,
          sphParticleState,
          mlsMpmParticleState,
          sphParticleUpload: currentSphUpload,
          mlsMpmParticleUpload: currentMlsUpload,
          gridUpdate: finalCoarseGridUpdate,
          g2pReconstruction: coarseG2p,
          summaryScope: MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL,
          readCompactSummary: true
        })
      : null;
    const rawFinalCanonicalUploads = createCanonicalTwoLevelSubstepUploads({
      sphParticleState,
      mlsMpmParticleState,
      sourceSphParticleUpload: currentSphUpload,
      sourceMlsMpmParticleUpload: currentMlsUpload,
      epochGeneration: epochGeneration(),
      g2pReconstruction: coarseG2p,
      thermoBuffer,
      identityBuffer,
      identityRequired,
      elapsedDtS: 0,
      sourceStage: 'schroeder-two-level-sparse-final-coarse-integration'
    });
    const transferThermoOwnership = retainOutputParticleBuffers
      && ownsThermoBuffer;
    const nextStep = finiteNumber(sphParticleState.step, 0) + 1;
    const nextTime = finiteNumber(sphParticleState.time, 0) + dtSeconds;
    const nextPositionEpoch =
      rawFinalCanonicalUploads.sphParticleUpload.positionEpoch
      ?? currentSphUpload?.positionEpoch
      ?? sphParticleState.positionEpoch
      ?? nextStep;
    const nextTopologyEpoch = currentSphUpload?.topologyEpoch
      ?? sphParticleState.topologyEpoch
      ?? 0;
    const nextChartEpoch = currentSphUpload?.chartEpoch
      ?? sphParticleState.chartEpoch
      ?? 0;
    const finalCanonicalUploads = Object.freeze({
      sphParticleUpload: Object.freeze({
        ...rawFinalCanonicalUploads.sphParticleUpload,
        // S* is still the terminal private state of macro tick N. The
        // hierarchy owner performs one fresh full classification before it
        // may publish the same buffers as E* at N+1/substep 0.
        sourceStage: 'schroeder-two-level-private-terminal-s-star',
        ownsStateBuffer: true,
        ownsThermoBuffer: transferThermoOwnership
          || rawFinalCanonicalUploads.sphParticleUpload.ownsThermoBuffer === true
      }),
      mlsMpmParticleUpload: Object.freeze({
        ...rawFinalCanonicalUploads.mlsMpmParticleUpload,
        sourceStage: 'schroeder-two-level-private-terminal-s-star',
        ownsMechanicsBuffer: true
      })
    });
    // Every workspace already owns a stable completion/retry record. Keep the
    // terminal record live until the synchronous S* claim below: merely
    // scheduling release marks its runtime release-in-flight and would make
    // the exact terminal producer lineage stale before ownership transfers.
    const diagnosticArtifactRetirementPromise = Promise.all(
      workspaceRetirementRecords.map(
        (record) => Promise.resolve(record.completionPromise)
      )
    ).then((retirements) => {
      if (retirements.some((retired) => retired !== true)) {
        throw new Error(
          'Canonical fused mechanics did not confirm every workspace retirement'
        );
      }
      return true;
    });
    diagnosticArtifactRetirementPromise.catch(() => {});
    const workspaceRetirementCapability = Object.freeze({
      completionPromise: diagnosticArtifactRetirementPromise,
      retry: retryWorkspaceRetirements
    });
    fusedRetirementRecoveryCapability = workspaceRetirementCapability;
    const intermediateContinuationRetirementPromise = Promise.all(
      fineLifecycleRetirementRecords.map(
        (record) => Promise.resolve(record.completionPromise)
      )
    ).then((retirements) => retirements.every((retired) => retired === true));
    intermediateContinuationRetirementPromise.catch(() => {});
    const retryIntermediateContinuationRetirements = async () => {
      const retirements = await Promise.all(
        fineLifecycleRetirementRecords.map((record) => record.attempt())
      );
      return retirements.every((retired) => retired === true);
    };
    const reconcileIntermediateRetirementsAfterMacroAbandon = async () => {
      for (const record of fineLifecycleRetirementRecords) {
        if (record.retired) continue;
        // The authenticated macro abort has now retired/quarantined every
        // microepoch and continuation it owns. Controller cleanup separately
        // retires E0..Er, so reconcile this local diagnostic ledger without
        // issuing another queue operation or leaving its stable completion
        // promise permanently pending.
        record.terminalAbandoned = true;
        record.quarantined = true;
        record.failureReason = null;
        if (record.inFlight) {
          record.inFlight.catch(() => {});
          pendingFineLifecycleRetirements.delete(record.inFlight);
          record.inFlight = null;
        }
        record.retired = true;
        record.resolveCompletion(true);
      }
      return true;
    };
    const controllerRetirementCapability = Object.freeze({
      completionPromise: canonicalEpochController.completionPromise(),
      requiredOnAbandon: true,
      afterMacroAbandon: true,
      retry: ({ deviceLost = false, reason = null } = {}) => (
        canonicalEpochController.abortAllAfter(reason, {
          // This capability runs only after the pending closure has confirmed
          // exact macro retirement, so the controller may now retire E0..Er.
          mechanicsRetirement: Promise.resolve(true),
          deviceLost
        })
      )
    });
    const terminalControllerReceipt =
      canonicalEpochController.commitAndRelease(activeCanonicalEpoch, {
        nextParticleUploads: finalCanonicalUploads,
        terminal: true,
        status: 'two-level-fused-terminal-s-star-private-advanced-pending-closure'
      });
    fusedPendingClosure = createSchroederFusedMechanicsPendingClosure({
        device,
        terminalTransaction,
        g2pReconstruction: coarseG2p,
        finalSphParticleUpload: finalCanonicalUploads.sphParticleUpload,
        finalMlsMpmParticleUpload:
          finalCanonicalUploads.mlsMpmParticleUpload,
        terminalControllerEpoch: activeCanonicalEpoch,
        terminalSpatialEpochTransaction:
          terminalControllerReceipt.spatialEpochTransaction,
        terminalPrivateAdvanceReceipt:
          terminalControllerReceipt.privateAdvanceReceipt,
        ownedThermoBuffer: transferThermoOwnership ? thermoBuffer : null,
        retirementPrerequisites: [
          workspaceRetirementCapability,
          Object.freeze({
            completionPromise: intermediateContinuationRetirementPromise,
            retry: retryIntermediateContinuationRetirements,
            requiredOnAbandon: false
          }),
          Object.freeze({
            completionPromise: intermediateContinuationRetirementPromise,
            retry: reconcileIntermediateRetirementsAfterMacroAbandon,
            requiredOnAbandon: true,
            afterMacroAbandon: true,
            // Loss can make an already-scheduled microepoch fence complete
            // through its stable terminal capability.  Cancel the diagnostic
            // ledger before that happens so its stale continuation cannot
            // schedule a fresh normal generation-owner fence after loss.
            beforeDeviceLossMacroAbandon: true
          }),
          trackedCleanupCapability,
          controllerRetirementCapability
        ]
      });
    // S* is now owned by the authenticated pending token, so the terminal
    // workspace can begin queue-fenced retirement without invalidating claim
    // provenance. A scheduling failure is recovered through that same token.
    retireWorkspace(finalWorkspace.runtime, finalWorkspace.execution);
    // S* ownership transfers atomically at closure claim. It must leave the
    // generic cleanup ledger before any later controller/publication step can
    // fail; only the fused lifecycle may retire these buffers from here on.
    if (transferThermoOwnership) releaseCleanup(thermoBuffer);
    scheduleTrackedCleanup();
    const pendingPostMechanicsClosure = fusedPendingClosure;
    currentSphUpload = finalCanonicalUploads.sphParticleUpload;
    currentMlsUpload = finalCanonicalUploads.mlsMpmParticleUpload;
    const postMechanicsEpoch = null;
    const canonicalMacroStatus = Object.freeze({
      schema: 'peercompute.ulg.schroeder-two-level-macro-status.v2',
      status: 'fused-producer-chain-authenticated-submitted',
      operationCount: substeps + 1,
      mandatoryReadbackPerformed: false,
      producerChainAuthenticated: true,
      verified: false,
      verificationStatus: 'pending-post-mechanics-closure'
    });

    const retiredGridUpdateSummary = (update, role) => update
      ? Object.freeze({
          schema: update.schema ?? null,
          status: 'consumed-retirement-pending',
          role,
          backend: update.backend ?? 'webgpu',
          gridStateAuthority: update.gridStateAuthority ?? null,
          mechanicsFieldMode: update.mechanicsFieldMode ?? null,
          gridNodeCount: update.gridNodeCount ?? 0,
          gridDims: Object.freeze([...(update.gridDims ?? [])]),
          gridSpacingM: update.gridSpacingM ?? 0,
          dt: update.dt ?? 0,
          fieldStateUpdateSubmittedInPlace:
            update.fieldStateUpdateSubmittedInPlace === true,
          fieldStateUpdatedInPlace: role === 'final-coarse',
          macroStatusVerified: false,
          bufferReferencesRetired: false
        })
      : null;
    const retiredG2pSummary = lastFineG2p
      ? Object.freeze({
          schema: lastFineG2p.schema ?? null,
          status: 'consumed-retirement-pending',
          backend: lastFineG2p.backend ?? 'webgpu',
          readbackMode: lastFineG2p.readbackMode ?? SCHROEDER_NO_FULL_READBACK_MODE,
          bufferReferencesRetired: false
        })
      : null;
    const result = {
      schema: ULG_SCHROEDER_TWO_LEVEL_MECHANICS_STEP_EXECUTION_SCHEMA,
      twoLevelMechanicsStepSchema: ULG_SCHROEDER_TWO_LEVEL_MECHANICS_STEP_SCHEMA,
      status: 'schroeder-two-level-mechanics-step-submitted',
      algorithm: 'schroeder-algorithm',
      dataStructure: 'schroeder-tree',
      couplingMode: substeps > 1
        ? 'sparse-parent-field-subcycled-transpose-delta'
        : 'sparse-parent-field-shared-dt-transpose-delta',
      fineSubstepCount: substeps,
      fineSubstepDt: dtFine,
      backend: 'webgpu',
      fineLevel: resolvedFineLevel,
      coarseLevel,
      fineGridSpacingM: fineDx,
      coarseGridSpacingM: coarseDx,
      fineGridDims: fineSpec.gridDims,
      coarseGridDims: coarseSpec.gridDims,
      dt: dtSeconds,
      particleCount: sphParticleState.particleCount,
      compactHierarchyViewConsumed: true,
      parentFieldViewConsumed: true,
      mechanicsFieldAuthority: 'schroeder-spatial-mechanics-field-view-v1',
      hierarchyGenerationId:
        epochGeneration()?.execution?.generationId
        ?? epochHierarchy()?.generationId
        ?? hierarchyView?.generationId
        ?? null,
      initialHierarchyGenerationId: hierarchyView?.generationId ?? null,
      canonicalEpochControllerSummary:
        canonicalEpochController?.summary?.() ?? null,
      invariantEvidenceStatus:
        'schroeder-cross-level-reflux-invariant-evidence-gpu-resident',
      invariantEvidenceGenerationId:
        epochGeneration()?.execution?.generationId ?? null,
      invariantEvidence: null,
      invariantQuantities: [
        'mass',
        'center-of-mass',
        'linear-momentum',
        'orbital-angular-momentum',
        'kinetic-plus-internal-energy',
        'internal-energy-positivity',
        'fine-and-coarse-cfl'
      ],
      invariantEvidenceBuffer: macroRefluxLedger.evidenceBuffer,
      invariantEvidenceBufferByteLength: macroRefluxLedger.evidenceByteLength,
      parentFieldMechanicsWorkspaceBuildCount: workspaceBuildCount,
      parentFieldMechanicsFineCorrectionCount: fineCorrectionCount,
      parentFieldMechanicsCoarsePublishCount: 0,
      parentFieldMechanicsCoarseTerminalCount: coarseTerminalCount,
      parentFieldMechanicsWorkspaceStatuses: workspaceExecutions.map(
        (execution) => execution.status
      ),
      canonicalMacroStatus,
      authoritativeCommitVerified: false,
      authoritativeCommitStatus: 'pending-post-mechanics-closure',
      internalEnergyTransferStatus:
        'nonnegative-reflux-kinetic-loss-deposited-by-transpose-g2p',
      refluxEvidenceStatus:
        'gpu-measured-equal-opposite-linear-angular-energy-ledger',
      internalPressureScale,
      ambientPressurePa: Math.max(0, finiteNumber(ambientPressurePa, 0)),
      ambientPressureAppliedInStressProjection: p2gProjections.length > 0
        && p2gProjections.every(
          (projection) =>
            projection?.ambientPressureAppliedInStressProjection === true
        ),
      readbackMode: compactSummaryReadback
        ? SCHROEDER_COMPACT_GRID_CONSERVATION_READBACK_MODE
        : SCHROEDER_NO_FULL_READBACK_MODE,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      mandatoryMacroStatusReadbackPerformed: false,
      conservation: null,
      compactSummary,
      postMechanicsEpoch,
      postMechanicsCanonicalUploads: null,
      pendingPostMechanicsClosure,
      fusedLifecycleStatus: 'pending-post-mechanics-closure',
      intermediateContinuationRetirementPromise,
      diagnosticArtifactRetirementPromise,
      genericArtifactRetirementPromise: trackedCleanupCompletionPromise,
      fineGridUpdate: retiredGridUpdateSummary(
        lastFineGridUpdate,
        'last-fine-substep'
      ),
      fineG2p: retiredG2pSummary,
      coarseGridUpdate: retiredGridUpdateSummary(
        finalCoarseGridUpdate,
        'final-coarse'
      ),
      diagnosticArtifactsRetired: false,
      diagnosticArtifactRetirementStatus: 'queue-fenced-retirement-pending',
      conservativeTransferStatus:
        'gpu-resident-parent-field-transfer-complete-keyed-reflux-measured',
      scientificValidation: false,
      fullPhysicsValidation: false
    };

    if (retainOutputParticleBuffers) {
      result.outputParticleBufferOwnership =
        'authenticated-pending-post-mechanics-closure';
      result.destroyOutputParticleBuffers = () => false;
      result.pendingNextSphParticleState = {
        ...sphParticleState,
        status: 'gpu-resident-unread-ready',
        step: nextStep,
        time: nextTime,
        physicsTick: nextStep,
        physicsSubstep: 0,
        positionEpoch: nextPositionEpoch,
        topologyEpoch: nextTopologyEpoch,
        chartEpoch: nextChartEpoch,
        levelEpoch: nextPositionEpoch,
        supportEpoch: nextPositionEpoch,
        cpuStateStale: true
      };
      result.pendingNextMlsMpmParticleState = {
        ...mlsMpmParticleState,
        status: 'gpu-resident-unread-ready',
        step: nextStep,
        time: nextTime,
        physicsTick: nextStep,
        physicsSubstep: 0,
        positionEpoch: nextPositionEpoch,
        topologyEpoch: nextTopologyEpoch,
        chartEpoch: nextChartEpoch,
        levelEpoch: nextPositionEpoch,
        supportEpoch: nextPositionEpoch,
        cpuStateStale: true
      };
      // Exact S*/owned-thermo/H7 ownership was already transferred to the
      // pending fused lifecycle before terminal controller advancement.
    }
    return result;
  };

  try {

  if (activeCanonicalEpoch) {
    return await runCanonicalSparseMechanics();
  }

  if (activeCanonicalEpoch) {
    await canonicalEpochController.admitP2g(activeCanonicalEpoch);
  }

  const fineProjection = await p2gRunner({
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederLevelAssignment: epochAssignment(),
    schroederSelectedLevel: resolvedFineLevel,
    gridSpacingM: fineDx,
    boxDimsM,
    dt: dtFine,
    internalPressureScale,
    ambientPressurePa,
    retainGridBuffer: true,
    readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
    ...canonicalMechanicsArgs()
  });
  trackCleanup(
    fineProjection.gridBuffer,
    () => {
      if (typeof fineProjection.destroyGridBuffer === 'function') {
        fineProjection.destroyGridBuffer();
      } else {
        fineProjection.gridBuffer?.destroy?.();
      }
    }
  );
  // APIC parent predictor for the fine cohort. Projecting the resident fine
  // particles directly at H=2h over the full coarse dt preserves arbitrary-
  // mass affine fields; restricting the dt/r fine-grid stress impulse would
  // underweight it by the substep ratio.
  const fineParentProjection = await p2gRunner({
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederLevelAssignment: epochAssignment(),
    schroederSelectedLevel: resolvedFineLevel,
    gridSpacingM: coarseDx,
    boxDimsM,
    dt: dtSeconds,
    internalPressureScale,
    ambientPressurePa,
    retainGridBuffer: true,
    readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
    ...canonicalMechanicsArgs()
  });
  trackCleanup(
    fineParentProjection.gridBuffer,
    () => {
      if (typeof fineParentProjection.destroyGridBuffer === 'function') {
        fineParentProjection.destroyGridBuffer();
      } else {
        fineParentProjection.gridBuffer?.destroy?.();
      }
    }
  );
  const coarseProjection = await p2gRunner({
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederLevelAssignment: epochAssignment(),
    schroederSelectedLevel: coarseLevel,
    gridSpacingM: coarseDx,
    boxDimsM,
    dt: dtSeconds,
    internalPressureScale,
    ambientPressurePa,
    retainGridBuffer: true,
    readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
    ...canonicalMechanicsArgs()
  });
  trackCleanup(
    coarseProjection.gridBuffer,
    () => {
      if (typeof coarseProjection.destroyGridBuffer === 'function') {
        coarseProjection.destroyGridBuffer();
      } else {
        coarseProjection.gridBuffer?.destroy?.();
      }
    }
  );
  const couplingPlan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: fineSpec.gridDims,
    coarseGridDims: coarseSpec.gridDims,
    fineGridSpacingM: fineDx,
    indexOrder: SCHROEDER_GRID_INDEX_ORDER_Z_FASTEST,
    gridShift: fineSpec.shift,
    accumulate: true
  });

  // Compare the fine-grid projection with the independent fine-on-parent
  // APIC projection before the latter is accumulated into the native coarse
  // grid. This is the actual cross-scale transfer invariant; comparing the
  // fine cohort against the later combined grid would incorrectly count the
  // native coarse cohort as a residual.
  const invariantEvidenceExecution = epochHierarchy()
    ? await invariantEvidenceRunner({
        device,
        plan: couplingPlan,
        fineGridBuffer: fineProjection.gridBuffer,
        parentGridBuffer: fineParentProjection.gridBuffer,
        hierarchyView: epochHierarchy(),
        retainEvidenceBuffer: false,
        readback: invariantEvidenceReadback === true
      })
    : null;

  await momentumAccumulationRunner({
    device,
    sourceGridBuffer: fineParentProjection.gridBuffer,
    targetGridBuffer: coarseProjection.gridBuffer,
    gridNodeCount: coarseSpec.gridNodeCount,
    gridStrideFloats: MLS_MPM_GPU_GRID_NODE_FLOATS
  });

  // Two parent-grid predictors over the same dt. Their difference contains
  // only coarse-cohort coupling/wall/contact response; shared gravity and the
  // fine cohort's own parent-scale stress cancel without a hand-maintained
  // shared-acceleration subtraction.
  const fineParentGridUpdate = await gridUpdateRunner({
    device,
    p2gGridProjection: fineParentProjection,
    p2gGridBuffer: fineParentProjection.gridBuffer,
    dt: dtSeconds,
    gravityMPerS2,
    boxDimsM,
    retainUpdatedGridBuffer: true,
    readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
  });
  trackCleanup(
    fineParentGridUpdate.updatedGridBuffer,
    () => {
      if (typeof fineParentGridUpdate.destroyUpdatedGridBuffer === 'function') {
        fineParentGridUpdate.destroyUpdatedGridBuffer();
      } else {
        fineParentGridUpdate.updatedGridBuffer?.destroy?.();
      }
    }
  );
  const coarseGridUpdate = await gridUpdateRunner({
    device,
    p2gGridProjection: coarseProjection,
    p2gGridBuffer: coarseProjection.gridBuffer,
    dt: dtSeconds,
    gravityMPerS2,
    boxDimsM,
    retainUpdatedGridBuffer: true,
    readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
  });
  trackCleanup(
    coarseGridUpdate.updatedGridBuffer,
    () => {
      if (typeof coarseGridUpdate.destroyUpdatedGridBuffer === 'function') {
        coarseGridUpdate.destroyUpdatedGridBuffer();
      } else {
        coarseGridUpdate.updatedGridBuffer?.destroy?.();
      }
    }
  );

  // Shared thermo buffer for chained passes.
  let ownsThermoBuffer = false;
  let thermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded'
    ? sphParticleUpload.thermoBuffer
    : null;
  if (!thermoBuffer) {
    thermoBuffer = writeStorageBuffer(
      device,
      'ulg-schroeder-two-level-thermo-in',
      sphParticleState.thermo
    );
    ownsThermoBuffer = true;
    trackCleanup(thermoBuffer, () => thermoBuffer?.destroy?.());
  }

  // Fine substep loop: each substep projects the current fine particle
  // state, updates the fine grid with dt/substeps, applies 1/substeps of
  // the coarse correction, and reconstructs the fine particles. Later
  // substeps consume the previous substep's retained outputs so
  // copy-through preserves coarse particles throughout.
  const fineGridUpdates = [];
  const p2gProjections = [fineProjection, fineParentProjection, coarseProjection];
  let currentSphUpload = sphParticleUpload;
  let currentMlsUpload = mlsMpmParticleUpload;
  let lastFineG2p = null;
  for (let substep = 0; substep < substeps; substep += 1) {
    if (substep > 0 && activeCanonicalEpoch) {
      canonicalEpochController.admitP2g(activeCanonicalEpoch);
    }
    const substepProjection = substep === 0
      ? fineProjection
      : await p2gRunner({
        device,
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload: currentSphUpload,
        mlsMpmParticleUpload: currentMlsUpload,
        schroederLevelAssignment: epochAssignment(),
        schroederSelectedLevel: resolvedFineLevel,
        gridSpacingM: fineDx,
        boxDimsM,
        dt: dtFine,
        internalPressureScale,
        ambientPressurePa,
        retainGridBuffer: true,
        readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
        ...canonicalMechanicsArgs()
      });
    if (substep > 0) {
      p2gProjections.push(substepProjection);
      trackCleanup(
        substepProjection.gridBuffer,
        () => {
          if (typeof substepProjection.destroyGridBuffer === 'function') {
            substepProjection.destroyGridBuffer();
          } else {
            substepProjection.gridBuffer?.destroy?.();
          }
        }
      );
    }
    const substepGridUpdate = await gridUpdateRunner({
      device,
      p2gGridProjection: substepProjection,
      p2gGridBuffer: substepProjection.gridBuffer,
      dt: dtFine,
      gravityMPerS2,
      boxDimsM,
      retainUpdatedGridBuffer: true,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
    });
    fineGridUpdates.push(substepGridUpdate);
    trackCleanup(
      substepGridUpdate.updatedGridBuffer,
      () => {
        if (typeof substepGridUpdate.destroyUpdatedGridBuffer === 'function') {
          substepGridUpdate.destroyUpdatedGridBuffer();
        } else {
          substepGridUpdate.updatedGridBuffer?.destroy?.();
        }
      }
    );
    await deltaProlongationRunner({
      device,
      fineGridDims: fineSpec.gridDims,
      coarseGridDims: coarseSpec.gridDims,
      fineGridSpacingM: fineDx,
      indexOrder: SCHROEDER_GRID_INDEX_ORDER_Z_FASTEST,
      gridShift: fineSpec.shift,
      boxDimsM,
      deltaScale: 1 / substeps,
      preVelocityGrid: true,
      // CFL ceiling the coarse grid update itself applied (same default
      // cfl factor; gridUpdateRunner above is invoked without an override).
      maxCoarseVelocityMPerS: (DEFAULT_CFL_FACTOR * coarseDx) / Math.max(dtSeconds, 1e-12),
      sharedAccelerationDtMPerS: [0, 0, 0],
      coarsePreGridBuffer: fineParentGridUpdate.updatedGridBuffer,
      coarsePostGridBuffer: coarseGridUpdate.updatedGridBuffer,
      fineGridBuffer: substepGridUpdate.updatedGridBuffer,
      hierarchyView: epochHierarchy()
    });
    if (activeCanonicalEpoch) {
      canonicalEpochController.admitG2p(activeCanonicalEpoch);
    }
    const substepG2p = await g2pRunner({
      device,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload: currentSphUpload,
      mlsMpmParticleUpload: currentMlsUpload,
      gridUpdate: substepGridUpdate,
      updatedGridBuffer: substepGridUpdate.updatedGridBuffer,
      dt: dtFine,
      boxDimsM,
      internalPressureScale,
      schroederLevelAssignment: epochAssignment(),
      schroederSelectedLevel: resolvedFineLevel,
      retainOutputParticleBuffers: true,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
      ...canonicalMechanicsArgs(),
      ...(activeCanonicalEpoch ? {
        schroederSpatialMechanicalProposal: epochProposal()
      } : {})
    });
    trackCleanup(
      substepG2p.stateBuffer,
      () => substepG2p.stateBuffer?.destroy?.()
    );
    trackCleanup(
      substepG2p.mechanicsBuffer,
      () => substepG2p.mechanicsBuffer?.destroy?.()
    );
    lastFineG2p = substepG2p;
    if (activeCanonicalEpoch) {
      const nextUploads = createCanonicalTwoLevelSubstepUploads({
        sphParticleState,
        mlsMpmParticleState,
        sourceSphParticleUpload: currentSphUpload,
        sourceMlsMpmParticleUpload: currentMlsUpload,
        epochGeneration: epochGeneration(),
        g2pReconstruction: substepG2p,
        thermoBuffer,
        identityBuffer,
        identityRequired,
        elapsedDtS: dtFine,
        sourceStage: `schroeder-two-level-fine-substep-${substep}`
      });
      canonicalEpochController.commitAndRelease(activeCanonicalEpoch, {
        nextParticleUploads: nextUploads,
        terminal: false,
        status: `two-level-fine-substep-${substep}-submitted`
      });
      currentSphUpload = nextUploads.sphParticleUpload;
      currentMlsUpload = nextUploads.mlsMpmParticleUpload;
      activeCanonicalEpoch = await canonicalEpochController.refresh({
        priorEpoch: activeCanonicalEpoch,
        currentSphParticleUpload: currentSphUpload,
        currentMlsMpmParticleUpload: currentMlsUpload
      });
    } else {
      currentSphUpload = {
        status: 'webgpu-uploaded',
        stateBuffer: substepG2p.stateBuffer,
        thermoBuffer,
        identityBuffer,
        identityRequired,
        identitySchema: sphParticleUpload?.identitySchema
          || ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
        identityStrideBytes: sphParticleUpload?.identityStrideBytes
          || (SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT),
        identityBufferByteLength: sphParticleUpload?.identityBufferByteLength || 0,
        identityRevision: sphParticleUpload?.identityRevision || null,
        renderDomainKeys: { ...(sphParticleUpload?.renderDomainKeys || {}) },
        slot: 0
      };
      currentMlsUpload = {
        status: 'webgpu-uploaded',
        mechanicsBuffer: substepG2p.mechanicsBuffer,
        slot: 0
      };
    }
  }
  const fineGridUpdate = fineGridUpdates[fineGridUpdates.length - 1];
  const fineG2p = lastFineG2p;
  let finalCoarseProjection = coarseProjection;
  let finalCoarseGridUpdate = coarseGridUpdate;
  let finalFineParentProjection = null;
  let finalCanonicalUploads = null;
  let postMechanicsEpoch = null;
  if (activeCanonicalEpoch) {
    // The initial parent-grid pair is only a coarse predictor for the fine
    // subcycles. Once the fine cohort reaches x_(n+1), rebuild both parent
    // projections from that current resident state before advancing the
    // coarse cohort. Reusing the x_n coarse grid here makes the final G2P
    // stale and violates the one-position-epoch-per-directory contract.
    canonicalEpochController.admitP2g(activeCanonicalEpoch);
    finalFineParentProjection = await p2gRunner({
      device,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload: currentSphUpload,
      mlsMpmParticleUpload: currentMlsUpload,
      schroederLevelAssignment: epochAssignment(),
      schroederSelectedLevel: resolvedFineLevel,
      gridSpacingM: coarseDx,
      boxDimsM,
      dt: dtSeconds,
      internalPressureScale,
      ambientPressurePa,
      retainGridBuffer: true,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
      ...canonicalMechanicsArgs()
    });
    trackCleanup(
      finalFineParentProjection.gridBuffer,
      () => {
        if (typeof finalFineParentProjection.destroyGridBuffer === 'function') {
          finalFineParentProjection.destroyGridBuffer();
        } else {
          finalFineParentProjection.gridBuffer?.destroy?.();
        }
      }
    );
    finalCoarseProjection = await p2gRunner({
      device,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload: currentSphUpload,
      mlsMpmParticleUpload: currentMlsUpload,
      schroederLevelAssignment: epochAssignment(),
      schroederSelectedLevel: coarseLevel,
      gridSpacingM: coarseDx,
      boxDimsM,
      dt: dtSeconds,
      internalPressureScale,
      ambientPressurePa,
      retainGridBuffer: true,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
      ...canonicalMechanicsArgs()
    });
    trackCleanup(
      finalCoarseProjection.gridBuffer,
      () => {
        if (typeof finalCoarseProjection.destroyGridBuffer === 'function') {
          finalCoarseProjection.destroyGridBuffer();
        } else {
          finalCoarseProjection.gridBuffer?.destroy?.();
        }
      }
    );
    p2gProjections.push(finalFineParentProjection, finalCoarseProjection);
    await momentumAccumulationRunner({
      device,
      sourceGridBuffer: finalFineParentProjection.gridBuffer,
      targetGridBuffer: finalCoarseProjection.gridBuffer,
      gridNodeCount: coarseSpec.gridNodeCount,
      gridStrideFloats: MLS_MPM_GPU_GRID_NODE_FLOATS
    });
    finalCoarseGridUpdate = await gridUpdateRunner({
      device,
      p2gGridProjection: finalCoarseProjection,
      p2gGridBuffer: finalCoarseProjection.gridBuffer,
      dt: dtSeconds,
      gravityMPerS2,
      boxDimsM,
      retainUpdatedGridBuffer: true,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
    });
    trackCleanup(
      finalCoarseGridUpdate.updatedGridBuffer,
      () => {
        if (typeof finalCoarseGridUpdate.destroyUpdatedGridBuffer === 'function') {
          finalCoarseGridUpdate.destroyUpdatedGridBuffer();
        } else {
          finalCoarseGridUpdate.updatedGridBuffer?.destroy?.();
        }
      }
    );
    canonicalEpochController.admitG2p(activeCanonicalEpoch);
  }
  const coarseG2p = await g2pRunner({
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload: currentSphUpload,
    mlsMpmParticleUpload: currentMlsUpload,
    gridUpdate: finalCoarseGridUpdate,
    updatedGridBuffer: finalCoarseGridUpdate.updatedGridBuffer,
    dt: dtSeconds,
    boxDimsM,
    internalPressureScale,
    schroederLevelAssignment: epochAssignment(),
    schroederSelectedLevel: coarseLevel,
    retainOutputParticleBuffers: true,
    readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
    ...canonicalMechanicsArgs(),
    ...(activeCanonicalEpoch ? {
      schroederSpatialMechanicalProposal: epochProposal()
    } : {})
  });
  trackCleanup(coarseG2p.stateBuffer, () => coarseG2p.stateBuffer?.destroy?.());
  trackCleanup(
    coarseG2p.mechanicsBuffer,
    () => coarseG2p.mechanicsBuffer?.destroy?.()
  );
  if (activeCanonicalEpoch) {
    finalCanonicalUploads = createCanonicalTwoLevelSubstepUploads({
      sphParticleState,
      mlsMpmParticleState,
      sourceSphParticleUpload: currentSphUpload,
      sourceMlsMpmParticleUpload: currentMlsUpload,
      epochGeneration: epochGeneration(),
      g2pReconstruction: coarseG2p,
      thermoBuffer,
      identityBuffer,
      identityRequired,
      // Fine subcycles already advanced the shared clock by the full macro
      // dt; this selected-level pass advances only the coarse cohort.
      elapsedDtS: 0,
      sourceStage: 'schroeder-two-level-final-coarse-integration'
    });
    canonicalEpochController.commitAndRelease(activeCanonicalEpoch, {
      nextParticleUploads: finalCanonicalUploads,
      terminal: postMechanicsConsumerReaderIds.length === 0,
      status: 'two-level-final-coarse-state-submitted'
    });
    currentSphUpload = finalCanonicalUploads.sphParticleUpload;
    currentMlsUpload = finalCanonicalUploads.mlsMpmParticleUpload;
    if (postMechanicsConsumerReaderIds.length > 0) {
      postMechanicsEpoch = await canonicalEpochController.refreshForPostMechanics({
        priorEpoch: activeCanonicalEpoch,
        currentSphParticleUpload: currentSphUpload,
        currentMlsMpmParticleUpload: currentMlsUpload,
        enabledConsumerReaderIds: postMechanicsConsumerReaderIds,
        consumerSupportProfileIds: postMechanicsConsumerSupportProfileIds
      });
      activeCanonicalEpoch = postMechanicsEpoch;
    }
  }

  const conservation = conservationSummaryReadback
    ? await conservationSummaryRunner({
      device,
      plan: couplingPlan,
      fineGridBuffer: fineProjection.gridBuffer,
      // fineParentProjection was accumulated into the native coarse cohort
      // above, so coarseProjection is the composite-grid authority. This
      // compact telemetry reports the full shared particle-set mass and
      // momentum; the transfer-only invariant is measured separately against
      // the untouched fineParentProjection.
      coarseGridBuffer: coarseProjection.gridBuffer
    })
    : null;

  // Optional compact particle summary (fixed-size readback, allowed on the
  // hot path): displacement/speed of the coupled step measured against the
  // step's original source state. This is the numeric motion proof the demo
  // banner consumes when the two-level step is the state authority. It must
  // run before the deferred cleanup below queues destruction of the
  // coarse-grid and G2P buffers it binds.
  const compactSummary = compactSummaryReadback
    ? await compactSummaryRunner({
      device,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      gridUpdate: finalCoarseGridUpdate,
      g2pReconstruction: coarseG2p,
      summaryScope: MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL,
      readCompactSummary: true
    })
    : null;

  // Intermediates remain in the identity-deduplicated cleanup ledger. The
  // caller owns only the retained final G2P family (and an internally packed
  // thermo buffer when one was required).
  const transferThermoOwnership = retainOutputParticleBuffers && ownsThermoBuffer;

  const result = {
    schema: ULG_SCHROEDER_TWO_LEVEL_MECHANICS_STEP_EXECUTION_SCHEMA,
    twoLevelMechanicsStepSchema: ULG_SCHROEDER_TWO_LEVEL_MECHANICS_STEP_SCHEMA,
    status: 'schroeder-two-level-mechanics-step-submitted',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    couplingMode: substeps > 1
      ? 'composite-grid-subcycled-delta-prolongation'
      : 'composite-grid-shared-dt-delta-prolongation',
    fineSubstepCount: substeps,
    fineSubstepDt: dtFine,
    backend: 'webgpu',
    fineLevel: resolvedFineLevel,
    coarseLevel,
    fineGridSpacingM: fineDx,
    coarseGridSpacingM: coarseDx,
    fineGridDims: fineSpec.gridDims,
    coarseGridDims: coarseSpec.gridDims,
    dt: dtSeconds,
    particleCount: sphParticleState.particleCount,
    compactHierarchyViewConsumed: Boolean(epochHierarchy()),
    hierarchyGenerationId:
      epochGeneration()?.execution?.generationId
      ?? epochHierarchy()?.generationId
      ?? hierarchyView?.generationId
      ?? null,
    initialHierarchyGenerationId: hierarchyView?.generationId ?? null,
    canonicalEpochControllerSummary:
      canonicalEpochController?.summary?.() ?? null,
    invariantEvidenceStatus: invariantEvidenceExecution?.status ?? null,
    invariantEvidenceGenerationId:
      invariantEvidenceExecution?.generationId ?? null,
    invariantEvidence: invariantEvidenceExecution?.evidence ?? null,
    invariantQuantities:
      invariantEvidenceExecution?.invariantQuantities ?? [],
    internalPressureScale,
    ambientPressurePa: Math.max(0, finiteNumber(ambientPressurePa, 0)),
    ambientPressureAppliedInStressProjection: p2gProjections.length > 0
      && p2gProjections.every(
        (projection) => projection?.ambientPressureAppliedInStressProjection === true
      ),
    readbackMode: conservationSummaryReadback
      || invariantEvidenceReadback
      || compactSummaryReadback
      ? SCHROEDER_COMPACT_GRID_CONSERVATION_READBACK_MODE
      : SCHROEDER_NO_FULL_READBACK_MODE,
    fullParticleReadbackPerformed: false,
    normalHotLoopReadbackFree:
      !conservationSummaryReadback
        && !invariantEvidenceReadback
        && !compactSummaryReadback,
    conservation: conservation?.conservation ?? null,
    compactSummary,
    postMechanicsEpoch,
    postMechanicsCanonicalUploads: postMechanicsEpoch
      ? finalCanonicalUploads
      : null,
    conservativeTransferStatus:
      'two-level-composite-grid-step-submitted-restriction-and-delta-prolongation',
    scientificValidation: false,
    fullPhysicsValidation: false
  };
    if (retainOutputParticleBuffers) {
    let outputParticleBuffersDestroyed = false;
    result.stateBuffer = coarseG2p.stateBuffer;
    result.mechanicsBuffer = coarseG2p.mechanicsBuffer;
    result.destroyOutputParticleBuffers = () => {
      if (outputParticleBuffersDestroyed) return false;
      outputParticleBuffersDestroyed = true;
      coarseG2p.stateBuffer?.destroy?.();
      coarseG2p.mechanicsBuffer?.destroy?.();
      if (transferThermoOwnership) thermoBuffer?.destroy?.();
      return true;
    };
    // Resident-compatible continuation envelope: the next scheduled step
    // (or a chained two-level step) can consume these retained buffers as
    // webgpu-uploaded particle inputs without any CPU readback.
    const nextStep = (finiteNumber(sphParticleState.step, 0)) + 1;
    const nextTime = finiteNumber(sphParticleState.time, 0) + dtSeconds;
    const nextPositionEpoch = currentSphUpload?.positionEpoch
      ?? sphParticleState.positionEpoch
      ?? nextStep;
    const nextTopologyEpoch = currentSphUpload?.topologyEpoch
      ?? sphParticleState.topologyEpoch
      ?? 0;
    const nextChartEpoch = currentSphUpload?.chartEpoch
      ?? sphParticleState.chartEpoch
      ?? 0;
    const macroSourceSlot = sphParticleUpload?.slot ?? 0;
    const macroNextSlot = macroSourceSlot === 0 ? 1 : 0;
    result.nextSphParticleState = {
      ...sphParticleState,
      status: 'gpu-resident-unread-ready',
      step: nextStep,
      time: nextTime,
      physicsTick: nextStep,
      physicsSubstep: 0,
      positionEpoch: nextPositionEpoch,
      topologyEpoch: nextTopologyEpoch,
      chartEpoch: nextChartEpoch,
      levelEpoch: nextPositionEpoch,
      supportEpoch: nextPositionEpoch,
      cpuStateStale: true
    };
    result.nextMlsMpmParticleState = {
      ...mlsMpmParticleState,
      status: 'gpu-resident-unread-ready',
      step: nextStep,
      time: nextTime,
      physicsTick: nextStep,
      physicsSubstep: 0,
      positionEpoch: nextPositionEpoch,
      topologyEpoch: nextTopologyEpoch,
      chartEpoch: nextChartEpoch,
      levelEpoch: nextPositionEpoch,
      supportEpoch: nextPositionEpoch,
      cpuStateStale: true
    };
    const fallbackSphUpload = {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      particleCount: sphParticleState.particleCount,
      stateStrideBytes: sphParticleState.stateStrideBytes,
      thermoStrideBytes: sphParticleState.thermoStrideBytes,
      stateBuffer: coarseG2p.stateBuffer,
      thermoBuffer,
      identityBuffer,
      identityRequired,
      identitySchema: sphParticleUpload?.identitySchema
        || ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
      identityStrideBytes: sphParticleUpload?.identityStrideBytes
        || (SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT),
      identityBufferByteLength: sphParticleUpload?.identityBufferByteLength || 0,
      identityRevision: sphParticleUpload?.identityRevision || null,
      renderDomainKeys: { ...(sphParticleUpload?.renderDomainKeys || {}) },
      ownsStateBuffer: true,
      ownsThermoBuffer: transferThermoOwnership,
      ownsIdentityBuffer: false,
      identityOwnership: identityBuffer
        ? 'borrowed-from-source-upload'
        : 'legacy-no-identity-buffer',
      slot: 0
    };
    const fallbackMlsUpload = {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      particleCount: mlsMpmParticleState.particleCount,
      mechanicsStrideBytes: mlsMpmParticleState.mechanicsStrideBytes,
      mechanicsBuffer: coarseG2p.mechanicsBuffer,
      ownsMechanicsBuffer: true,
      slot: 0
    };
    const publishedSphUpload = finalCanonicalUploads?.sphParticleUpload
      ?? fallbackSphUpload;
    const publishedMlsUpload = finalCanonicalUploads?.mlsMpmParticleUpload
      ?? fallbackMlsUpload;
    result.nextParticleUploads = {
      sphParticleUpload: {
        ...publishedSphUpload,
        sourceStage: 'schroeder-two-level-mechanics-step',
        ownsStateBuffer: true,
        ownsThermoBuffer: transferThermoOwnership
          || publishedSphUpload.ownsThermoBuffer === true,
        physicsTick: nextStep,
        physicsSubstep: 0,
        positionEpoch: nextPositionEpoch,
        topologyEpoch: nextTopologyEpoch,
        chartEpoch: nextChartEpoch,
        levelEpoch: nextPositionEpoch,
        supportEpoch: nextPositionEpoch,
        slot: macroNextSlot,
        sourceSlot: macroSourceSlot,
        nextSlot: macroNextSlot,
        step: nextStep,
        time: nextTime
      },
      mlsMpmParticleUpload: {
        ...publishedMlsUpload,
        sourceStage: 'schroeder-two-level-mechanics-step',
        ownsMechanicsBuffer: true,
        physicsTick: nextStep,
        physicsSubstep: 0,
        positionEpoch: nextPositionEpoch,
        topologyEpoch: nextTopologyEpoch,
        chartEpoch: nextChartEpoch,
        levelEpoch: nextPositionEpoch,
        supportEpoch: nextPositionEpoch,
        slot: macroNextSlot,
        sourceSlot: macroSourceSlot,
        nextSlot: macroNextSlot,
        step: nextStep,
        time: nextTime
      }
    };
  }
  if (retainOutputParticleBuffers) {
    releaseCleanup(coarseG2p.stateBuffer);
    releaseCleanup(coarseG2p.mechanicsBuffer);
      if (transferThermoOwnership) releaseCleanup(thermoBuffer);
  }
  scheduleTrackedCleanup();
  return result;
  } catch (error) {
    const cleanupErrors = [];
    try {
      await recoverFailedMechanicsCleanup(error);
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError);
    }
    if (cleanupErrors.length > 0) {
      try {
        Object.defineProperty(error, 'schroederCleanupErrors', {
          value: Object.freeze([...cleanupErrors]),
          enumerable: false
        });
      } catch {
        // Preserve the originating mechanics error even when it is frozen.
      }
      try {
        Object.defineProperties(error, {
          schroederCleanupRecovery: {
            value: (options = {}) => recoverFailedMechanicsCleanup(
              error,
              options
            ),
            enumerable: false
          },
          schroederCleanupCompletionPromise: {
            value: failureCleanupCompletionPromise,
            enumerable: false
          }
        });
      } catch {
        // A frozen originating error still leaves resources quarantined; the
        // caller cannot be given a retry capability in that exceptional case.
      }
    }
    throw error;
  }
}
