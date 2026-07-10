import {
  MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_ROW_LAYOUT,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  schroederCrossLevelGridConservationSummaryWgsl,
  schroederCrossLevelGridProlongationWgsl,
  schroederCrossLevelGridRestrictionWgsl,
  schroederCrossLevelGridVelocityDeltaProlongationWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import {
  MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL,
  runMlsMpmResidentSummaryWebGpu
} from './sphMlsMpmGpuSummary.js';
import { DEFAULT_CFL_FACTOR } from './sphGridUpdateGpuKernel.js';

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
// momentum; prolongation copies parent velocity onto massive fine nodes.
export const SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS = 4;
export const SCHROEDER_GRID_COUPLING_PARAMS_BYTES = 96;
// Index order of the flat grid-node arrays. The standalone operator tests use
// 'x-fastest'; real MLS-MPM P2G grids from createMlsMpmGridSpec use
// 'z-fastest' with gridShift 1 (see gridNodeCoords in sphGridGpuKernel.js).
export const SCHROEDER_GRID_INDEX_ORDER_X_FASTEST = 'x-fastest';
export const SCHROEDER_GRID_INDEX_ORDER_Z_FASTEST = 'z-fastest';
export const SCHROEDER_NO_FULL_READBACK_MODE = 'no-full-readback';
export const SCHROEDER_COMPACT_GRID_CONSERVATION_READBACK_MODE =
  'compact-grid-conservation-summary-readback';

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
 * the adjacent coarse level (spacing exactly doubles). Every fine node maps to
 * exactly one coarse parent (component-wise floor(index / 2)), so restriction
 * conserves mass and momentum exactly in infinite precision, and
 * mass-weighted piecewise-constant prolongation returns the parent momentum
 * exactly when the coarse grid was produced by restriction of the same fine
 * masses.
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
  coarseGridDims = null,
  boxDimsM = null,
  deltaScale = 0,
  sharedAccelerationDtMPerS = null,
  maxCoarseVelocityMPerS = 0,
  flags = 0
} = {}) {
  const fineDims = gridDims3(fineGridDims);
  const shift = Math.max(0, Math.round(finiteNumber(gridShift, 0)));
  // With a shift, coarse cell c covers fine logical cells 2(c-shift)..2(c-shift)+1
  // (plus the shared shift border), so the coarse grid needs
  // ceil((n - shift) / 2) + shift indices to cover every fine node.
  const coarseDims = coarseGridDims
    ? gridDims3(coarseGridDims)
    : fineDims.map((n) => Math.max(1, Math.ceil((n - shift) / 2) + shift));
  const zFastest = indexOrder === SCHROEDER_GRID_INDEX_ORDER_Z_FASTEST;
  const resolvedFlags = (Math.max(0, Math.round(finiteNumber(flags, 0)))
    | (accumulate ? SCHROEDER_GRID_COUPLING_FLAG_ACCUMULATE : 0)
    | (zFastest ? SCHROEDER_GRID_COUPLING_FLAG_Z_FASTEST : 0)
    | (velocityGrids ? SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS : 0)) >>> 0;
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
    couplingMode: 'agglomeration-restriction-piecewise-constant-prolongation',
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
    conservedQuantities: ['mass', 'momentum'],
    couplingEpoch: Math.max(0, Math.round(finiteNumber(couplingEpoch, 0))),
    indexOrder: zFastest
      ? SCHROEDER_GRID_INDEX_ORDER_Z_FASTEST
      : SCHROEDER_GRID_INDEX_ORDER_X_FASTEST,
    gridShift: shift,
    accumulate: (resolvedFlags & SCHROEDER_GRID_COUPLING_FLAG_ACCUMULATE) !== 0,
    velocityGrids: (resolvedFlags & SCHROEDER_GRID_COUPLING_FLAG_VELOCITY_GRIDS) !== 0,
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
  retainCoarseGridBuffer = true,
  ...planOptions
} = {}) {
  assertWebGpuDevice(device, 'runSchroederCrossLevelGridRestrictionWebGpu');
  const resolvedPlan = plan || createSchroederCrossLevelGridCouplingPlan(planOptions);
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
      cacheKey: 'ulg-schroeder-cross-level-grid-restriction.v0',
      label: 'ulg-schroeder-cross-level-grid-restriction',
      code: schroederCrossLevelGridRestrictionWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'uniform')
      ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: fine.gridBuffer } },
        { binding: 1, resource: { buffer: coarse.gridBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(resolvedPlan.coarseNodeCount / SCHROEDER_GRID_COUPLING_WORKGROUP_SIZE));
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
      retainedCoarseGridBuffer: Boolean(retainCoarseGridBuffer || coarse.borrowed),
      conservativeTransferStatus: 'grid-restriction-submitted-mass-momentum-agglomeration',
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
  retainFineGridBuffer = true,
  ...planOptions
} = {}) {
  assertWebGpuDevice(device, 'runSchroederCrossLevelGridProlongationWebGpu');
  const resolvedPlan = plan || createSchroederCrossLevelGridCouplingPlan(planOptions);
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
      cacheKey: 'ulg-schroeder-cross-level-grid-prolongation.v0',
      label: 'ulg-schroeder-cross-level-grid-prolongation',
      code: schroederCrossLevelGridProlongationWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'uniform')
      ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: coarse.gridBuffer } },
        { binding: 1, resource: { buffer: fine.gridBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(resolvedPlan.fineNodeCount / SCHROEDER_GRID_COUPLING_WORKGROUP_SIZE));
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
      retainedFineGridBuffer: Boolean(retainFineGridBuffer || fine.borrowed),
      conservativeTransferStatus:
        'grid-prolongation-submitted-mass-weighted-parent-velocity',
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
 * receives the change in its parent's velocity across the coarse grid update
 * (`fine_v += post_v(parent) - pre_v(parent)`). Because a force-free field
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
  retainFineGridBuffer = true,
  ...planOptions
} = {}) {
  assertWebGpuDevice(device, 'runSchroederCrossLevelGridVelocityDeltaProlongationWebGpu');
  const resolvedPlan = plan || createSchroederCrossLevelGridCouplingPlan(planOptions);
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
      cacheKey: 'ulg-schroeder-cross-level-grid-velocity-delta-prolongation.v0',
      label: 'ulg-schroeder-cross-level-grid-velocity-delta-prolongation',
      code: schroederCrossLevelGridVelocityDeltaProlongationWgsl,
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
    pass.dispatchWorkgroups(Math.ceil(resolvedPlan.fineNodeCount / SCHROEDER_GRID_COUPLING_WORKGROUP_SIZE));
    pass.end();
    device.queue.submit([encoder.finish()]);

    const result = {
      ...resolvedPlan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_EXECUTION_SCHEMA,
      couplingPlanSchema: ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_SCHEMA,
      status: 'schroeder-cross-level-grid-velocity-delta-prolongation-submitted',
      prolongationMode: 'coarse-velocity-delta-correction',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      retainedFineGridBuffer: Boolean(retainFineGridBuffer || fine.borrowed),
      conservativeTransferStatus:
        'grid-velocity-delta-prolongation-submitted-parent-update-correction',
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

function fineChildAxisForPlan(plan, coarseAxis, child) {
  const shift = plan.gridShift ?? 0;
  return 2 * (coarseAxis - shift) + shift + child;
}

function coarseParentAxisForPlan(plan, fineAxis, coarseN) {
  const shift = plan.gridShift ?? 0;
  const logical = fineAxis - shift;
  const parent = logical >= 0 ? Math.floor(logical / 2) : -Math.floor((-logical + 1) / 2);
  return Math.min(Math.max(parent + shift, 0), coarseN - 1);
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
        for (let dz = 0; dz < 2; dz += 1) {
          const fz = fineChildAxisForPlan(plan, cz, dz);
          if (fz < 0 || fz >= nz) continue;
          for (let dy = 0; dy < 2; dy += 1) {
            const fy = fineChildAxisForPlan(plan, cy, dy);
            if (fy < 0 || fy >= ny) continue;
            for (let dx = 0; dx < 2; dx += 1) {
              const fx = fineChildAxisForPlan(plan, cx, dx);
              if (fx < 0 || fx >= nx) continue;
              const fineOffset = gridAxisIndexForPlan(plan, fx, fy, fz, plan.fineGridDims) * stride;
              mass += Math.max(0, fineRows[fineOffset]);
              px += fineRows[fineOffset + 1];
              py += fineRows[fineOffset + 2];
              pz += fineRows[fineOffset + 3];
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
        const cx = coarseParentAxisForPlan(plan, fx, cnx);
        const cy = coarseParentAxisForPlan(plan, fy, cny);
        const cz = coarseParentAxisForPlan(plan, fz, cnz);
        const coarseOffset = gridAxisIndexForPlan(plan, cx, cy, cz, plan.coarseGridDims) * stride;
        const coarseMass = coarseRows[coarseOffset];
        if (!(coarseMass > 0)) continue;
        const fineOffset = gridAxisIndexForPlan(plan, fx, fy, fz, plan.fineGridDims) * stride;
        const fineMass = Math.max(0, out[fineOffset]);
        if (plan.velocityGrids === true) {
          if (fineMass > 0) {
            out[fineOffset + 1] = coarseRows[coarseOffset + 1];
            out[fineOffset + 2] = coarseRows[coarseOffset + 2];
            out[fineOffset + 3] = coarseRows[coarseOffset + 3];
          }
        } else {
          out[fineOffset + 1] = (fineMass * coarseRows[coarseOffset + 1]) / coarseMass;
          out[fineOffset + 2] = (fineMass * coarseRows[coarseOffset + 2]) / coarseMass;
          out[fineOffset + 3] = (fineMass * coarseRows[coarseOffset + 3]) / coarseMass;
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

// --- Two-level coupled mechanics step -----------------------------------

export const ULG_SCHROEDER_TWO_LEVEL_MECHANICS_STEP_SCHEMA =
  'peercompute.ulg.schroeder-two-level-mechanics-step.v0';
export const ULG_SCHROEDER_TWO_LEVEL_MECHANICS_STEP_EXECUTION_SCHEMA =
  'peercompute.ulg.schroeder-two-level-mechanics-step-execution.v0';

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
  fineLevel = 0,
  baseGridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = [4, 4, 4],
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  gravityMPerS2 = [0, -9.80665, 0],
  internalPressureScale = 1,
  fineSubstepCount = 1,
  gridSpecFactory,
  p2gRunner,
  gridUpdateRunner,
  g2pRunner,
  retainOutputParticleBuffers = true,
  conservationSummaryReadback = true,
  compactSummaryReadback = false
} = {}) {
  assertWebGpuDevice(device, 'runSchroederTwoLevelMechanicsStepWebGpu');
  if (typeof gridSpecFactory !== 'function'
    || typeof p2gRunner !== 'function'
    || typeof gridUpdateRunner !== 'function'
    || typeof g2pRunner !== 'function') {
    throw new TypeError(
      'runSchroederTwoLevelMechanicsStepWebGpu requires gridSpecFactory, p2gRunner, gridUpdateRunner, and g2pRunner functions'
    );
  }
  if (!levelAssignment) {
    throw new TypeError('runSchroederTwoLevelMechanicsStepWebGpu requires a Schroeder level assignment');
  }
  const resolvedFineLevel = Math.round(finiteNumber(fineLevel, 0));
  const coarseLevel = resolvedFineLevel + 1;
  const baseDx = Math.max(1e-9, finiteNumber(baseGridSpacingM, 0));
  const fineDx = baseDx * (2 ** resolvedFineLevel);
  const coarseDx = fineDx * 2;
  const dtSeconds = finiteNumber(dt, 0);
  // Subcycling: the coarse level advances one full dt while the fine level
  // takes fineSubstepCount substeps of dt / fineSubstepCount, each applying
  // its time-interpolated share of the coarse velocity correction.
  const substeps = Math.max(1, Math.round(finiteNumber(fineSubstepCount, 1)));
  const dtFine = dtSeconds / substeps;

  const fineProjection = await p2gRunner({
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederLevelAssignment: levelAssignment,
    schroederSelectedLevel: resolvedFineLevel,
    gridSpacingM: fineDx,
    boxDimsM,
    dt: dtFine,
    internalPressureScale,
    retainGridBuffer: true,
    readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
  });
  const coarseProjection = await p2gRunner({
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederLevelAssignment: levelAssignment,
    schroederSelectedLevel: coarseLevel,
    gridSpacingM: coarseDx,
    boxDimsM,
    dt: dtSeconds,
    internalPressureScale,
    retainGridBuffer: true,
    readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
  });
  const fineSpec = gridSpecFactory({ boxDimsM, gridSpacingM: fineDx });
  const coarseSpec = gridSpecFactory({ boxDimsM, gridSpacingM: coarseDx });
  const couplingPlan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: fineSpec.gridDims,
    coarseGridDims: coarseSpec.gridDims,
    fineGridSpacingM: fineDx,
    indexOrder: SCHROEDER_GRID_INDEX_ORDER_Z_FASTEST,
    gridShift: fineSpec.shift,
    accumulate: true
  });

  // Snapshot the combined pre-update coarse momentum grid for the
  // delta-form prolongation.
  const coarseGridByteLength = coarseSpec.gridNodeCount
    * MLS_MPM_GPU_GRID_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const coarsePreGridBuffer = device.createBuffer({
    label: 'ulg-schroeder-two-level-coarse-pre-update',
    size: Math.max(16, coarseGridByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });

  await runSchroederCrossLevelGridRestrictionWebGpu({
    device,
    plan: couplingPlan,
    fineGridBuffer: fineProjection.gridBuffer,
    coarseGridBuffer: coarseProjection.gridBuffer
  });
  {
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(
      coarseProjection.gridBuffer,
      0,
      coarsePreGridBuffer,
      0,
      Math.max(16, coarseGridByteLength)
    );
    device.queue.submit([encoder.finish()]);
  }

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
  }

  // Fine substep loop: each substep projects the current fine particle
  // state, updates the fine grid with dt/substeps, applies 1/substeps of
  // the coarse correction, and reconstructs the fine particles. Later
  // substeps consume the previous substep's retained outputs so
  // copy-through preserves coarse particles throughout.
  const intermediateBuffers = [];
  const fineGridUpdates = [];
  let currentSphUpload = sphParticleUpload;
  let currentMlsUpload = mlsMpmParticleUpload;
  let lastFineG2p = null;
  for (let substep = 0; substep < substeps; substep += 1) {
    const substepProjection = substep === 0
      ? fineProjection
      : await p2gRunner({
        device,
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload: currentSphUpload,
        mlsMpmParticleUpload: currentMlsUpload,
        schroederLevelAssignment: levelAssignment,
        schroederSelectedLevel: resolvedFineLevel,
        gridSpacingM: fineDx,
        boxDimsM,
        dt: dtFine,
        internalPressureScale,
        retainGridBuffer: true,
        readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
      });
    if (substep > 0) {
      intermediateBuffers.push(() => substepProjection.destroyGridBuffer?.());
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
    await runSchroederCrossLevelGridVelocityDeltaProlongationWebGpu({
      device,
      fineGridDims: fineSpec.gridDims,
      coarseGridDims: coarseSpec.gridDims,
      fineGridSpacingM: fineDx,
      indexOrder: SCHROEDER_GRID_INDEX_ORDER_Z_FASTEST,
      gridShift: fineSpec.shift,
      boxDimsM,
      deltaScale: 1 / substeps,
      // CFL ceiling the coarse grid update itself applied (same default
      // cfl factor; gridUpdateRunner above is invoked without an override).
      maxCoarseVelocityMPerS: (DEFAULT_CFL_FACTOR * coarseDx) / Math.max(dtSeconds, 1e-12),
      // The fine grid updates integrate gravity themselves; exclude it from
      // the transferred coarse correction.
      sharedAccelerationDtMPerS: [
        finiteNumber(gravityMPerS2?.[0], 0) * dtSeconds,
        finiteNumber(gravityMPerS2?.[1], 0) * dtSeconds,
        finiteNumber(gravityMPerS2?.[2], 0) * dtSeconds
      ],
      coarsePreGridBuffer,
      coarsePostGridBuffer: coarseGridUpdate.updatedGridBuffer,
      fineGridBuffer: substepGridUpdate.updatedGridBuffer
    });
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
      schroederLevelAssignment: levelAssignment,
      schroederSelectedLevel: resolvedFineLevel,
      retainOutputParticleBuffers: true,
      readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
    });
    if (lastFineG2p) {
      const previous = lastFineG2p;
      intermediateBuffers.push(() => {
        previous.stateBuffer?.destroy?.();
        previous.mechanicsBuffer?.destroy?.();
      });
    }
    lastFineG2p = substepG2p;
    currentSphUpload = {
      status: 'webgpu-uploaded',
      stateBuffer: substepG2p.stateBuffer,
      thermoBuffer,
      slot: 0
    };
    currentMlsUpload = {
      status: 'webgpu-uploaded',
      mechanicsBuffer: substepG2p.mechanicsBuffer,
      slot: 0
    };
  }
  const fineGridUpdate = fineGridUpdates[fineGridUpdates.length - 1];
  const fineG2p = lastFineG2p;
  const coarseG2p = await g2pRunner({
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload: currentSphUpload,
    mlsMpmParticleUpload: currentMlsUpload,
    gridUpdate: coarseGridUpdate,
    updatedGridBuffer: coarseGridUpdate.updatedGridBuffer,
    dt: dtSeconds,
    boxDimsM,
    internalPressureScale,
    schroederLevelAssignment: levelAssignment,
    schroederSelectedLevel: coarseLevel,
    retainOutputParticleBuffers: true,
    readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
  });

  const conservation = conservationSummaryReadback
    ? await runSchroederCrossLevelGridConservationSummaryWebGpu({
      device,
      plan: couplingPlan,
      fineGridBuffer: fineProjection.gridBuffer,
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
    ? await runMlsMpmResidentSummaryWebGpu({
      device,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      gridUpdate: coarseGridUpdate,
      g2pReconstruction: coarseG2p,
      summaryScope: MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL,
      readCompactSummary: true
    })
    : null;

  // Intermediates are released behind the queue; the caller owns the final
  // G2P outputs (and destroys pass-1 outputs once consumed).
  const transferThermoOwnership = retainOutputParticleBuffers && ownsThermoBuffer;
  const cleanup = () => {
    fineProjection.destroyGridBuffer?.();
    coarseProjection.destroyGridBuffer?.();
    coarsePreGridBuffer.destroy?.();
    for (const update of fineGridUpdates) update.destroyUpdatedGridBuffer?.();
    coarseGridUpdate.destroyUpdatedGridBuffer?.();
    for (const destroyIntermediate of intermediateBuffers) destroyIntermediate();
    fineG2p.stateBuffer?.destroy?.();
    fineG2p.mechanicsBuffer?.destroy?.();
    if (ownsThermoBuffer && !transferThermoOwnership) thermoBuffer?.destroy?.();
  };
  deferSubmittedWorkCleanup(device, cleanup);

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
    readbackMode: conservationSummaryReadback
      ? SCHROEDER_COMPACT_GRID_CONSERVATION_READBACK_MODE
      : SCHROEDER_NO_FULL_READBACK_MODE,
    fullParticleReadbackPerformed: false,
    normalHotLoopReadbackFree: !conservationSummaryReadback,
    conservation: conservation?.conservation ?? null,
    compactSummary,
    conservativeTransferStatus:
      'two-level-composite-grid-step-submitted-restriction-and-delta-prolongation',
    scientificValidation: false,
    fullPhysicsValidation: false
  };
  if (retainOutputParticleBuffers) {
    result.stateBuffer = coarseG2p.stateBuffer;
    result.mechanicsBuffer = coarseG2p.mechanicsBuffer;
    result.destroyOutputParticleBuffers = () => {
      coarseG2p.stateBuffer?.destroy?.();
      coarseG2p.mechanicsBuffer?.destroy?.();
      if (transferThermoOwnership) thermoBuffer?.destroy?.();
    };
    // Resident-compatible continuation envelope: the next scheduled step
    // (or a chained two-level step) can consume these retained buffers as
    // webgpu-uploaded particle inputs without any CPU readback.
    const nextStep = (finiteNumber(sphParticleState.step, 0)) + 1;
    const nextTime = finiteNumber(sphParticleState.time, 0) + dtSeconds;
    result.nextSphParticleState = {
      ...sphParticleState,
      status: 'gpu-resident-unread-ready',
      step: nextStep,
      time: nextTime,
      cpuStateStale: true
    };
    result.nextMlsMpmParticleState = {
      ...mlsMpmParticleState,
      status: 'gpu-resident-unread-ready',
      step: nextStep,
      time: nextTime,
      cpuStateStale: true
    };
    result.nextParticleUploads = {
      sphParticleUpload: {
        status: 'webgpu-uploaded',
        sourceStage: 'schroeder-two-level-mechanics-step',
        particleCount: sphParticleState.particleCount,
        stateBuffer: coarseG2p.stateBuffer,
        thermoBuffer,
        ownsStateBuffer: true,
        ownsThermoBuffer: transferThermoOwnership,
        slot: 0,
        step: nextStep,
        time: nextTime
      },
      mlsMpmParticleUpload: {
        status: 'webgpu-uploaded',
        sourceStage: 'schroeder-two-level-mechanics-step',
        particleCount: mlsMpmParticleState.particleCount,
        mechanicsBuffer: coarseG2p.mechanicsBuffer,
        ownsMechanicsBuffer: true,
        slot: 0,
        step: nextStep,
        time: nextTime
      }
    };
  }
  return result;
}
