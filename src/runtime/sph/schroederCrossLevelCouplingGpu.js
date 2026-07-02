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
  schroederCrossLevelGridRestrictionWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';

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
  flags = 0
} = {}) {
  const fineDims = gridDims3(fineGridDims);
  const coarseDims = fineDims.map((n) => Math.max(1, Math.ceil(n / 2)));
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
    flags: Math.max(0, Math.round(finiteNumber(flags, 0))),
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederCrossLevelGridCouplingParamsArray(plan) {
  const buffer = new ArrayBuffer(48);
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
    size: 48,
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
    size: 48,
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
    size: 48,
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

export function restrictGridRowsCpuOracle(plan, fineRows) {
  const stride = plan.gridStrideFloats;
  const [nx, ny, nz] = plan.fineGridDims;
  const [cnx, cny, cnz] = plan.coarseGridDims;
  const coarseRows = new Float64Array(plan.coarseNodeCount * stride);
  for (let cz = 0; cz < cnz; cz += 1) {
    for (let cy = 0; cy < cny; cy += 1) {
      for (let cx = 0; cx < cnx; cx += 1) {
        const coarseIndex = cx + cnx * (cy + cny * cz);
        const offset = coarseIndex * stride;
        let mass = 0;
        let px = 0;
        let py = 0;
        let pz = 0;
        for (let dz = 0; dz < 2; dz += 1) {
          const fz = cz * 2 + dz;
          if (fz >= nz) continue;
          for (let dy = 0; dy < 2; dy += 1) {
            const fy = cy * 2 + dy;
            if (fy >= ny) continue;
            for (let dx = 0; dx < 2; dx += 1) {
              const fx = cx * 2 + dx;
              if (fx >= nx) continue;
              const fineOffset = (fx + nx * (fy + ny * fz)) * stride;
              mass += Math.max(0, fineRows[fineOffset]);
              px += fineRows[fineOffset + 1];
              py += fineRows[fineOffset + 2];
              pz += fineRows[fineOffset + 3];
            }
          }
        }
        coarseRows[offset] = mass;
        coarseRows[offset + 1] = px;
        coarseRows[offset + 2] = py;
        coarseRows[offset + 3] = pz;
        coarseRows[offset + 4] = plan.gridOriginM[0] + cx * plan.coarseGridSpacingM;
        coarseRows[offset + 5] = plan.gridOriginM[1] + cy * plan.coarseGridSpacingM;
        coarseRows[offset + 6] = plan.gridOriginM[2] + cz * plan.coarseGridSpacingM;
        coarseRows[offset + 7] = mass > 0 ? 1 : 0;
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
        const cx = Math.min(Math.floor(fx / 2), cnx - 1);
        const cy = Math.min(Math.floor(fy / 2), cny - 1);
        const cz = Math.min(Math.floor(fz / 2), cnz - 1);
        const coarseOffset = (cx + cnx * (cy + cny * cz)) * stride;
        const coarseMass = coarseRows[coarseOffset];
        if (!(coarseMass > 0)) continue;
        const fineOffset = (fx + nx * (fy + ny * fz)) * stride;
        const fineMass = Math.max(0, out[fineOffset]);
        out[fineOffset + 1] = (fineMass * coarseRows[coarseOffset + 1]) / coarseMass;
        out[fineOffset + 2] = (fineMass * coarseRows[coarseOffset + 2]) / coarseMass;
        out[fineOffset + 3] = (fineMass * coarseRows[coarseOffset + 3]) / coarseMass;
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
