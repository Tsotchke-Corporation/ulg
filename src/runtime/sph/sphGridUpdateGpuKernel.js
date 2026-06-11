import {
  MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT,
  MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmGridUpdateWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import { MLS_MPM_GPU_GRID_NODE_FLOATS } from './sphGridGpuKernel.js';

export {
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  mlsMpmGridUpdateWgsl
};

export const MLS_MPM_GPU_GRID_VELOCITY_FLOATS = MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT.length;

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

const DEFAULT_GRAVITY_M_PER_S2 = Object.freeze([0, -9.80665, 0]);
const DEFAULT_BOX_DIMS_M = Object.freeze([5, 5, 5]);
const DEFAULT_CFL_FACTOR = 0.6;
const GRID_UPDATE_SCOPE = 'mls-mpm-grid-velocity-update-gravity-cfl-walls';
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteVector3(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  return [
    finiteNumber(source?.[0], fallback[0]),
    finiteNumber(source?.[1], fallback[1]),
    finiteNumber(source?.[2], fallback[2])
  ];
}

function assertP2gGridProjection(p2gGridProjection, { requireGridNodes = true } = {}) {
  const projectionSchema = p2gGridProjection?.projectionSchema || p2gGridProjection?.schema;
  if (
    p2gGridProjection?.schema !== ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA
    && p2gGridProjection?.schema !== ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA
    && projectionSchema !== ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA
  ) {
    throw new TypeError('MLS-MPM grid update requires a P2G grid projection artifact');
  }
  if (requireGridNodes && !(p2gGridProjection.gridNodes instanceof Float32Array)) {
    throw new TypeError('MLS-MPM grid update requires Float32Array gridNodes');
  }
  if (p2gGridProjection.gridNodeStrideFloats !== MLS_MPM_GPU_GRID_NODE_FLOATS) {
    throw new RangeError('MLS-MPM grid update requires the packed P2G grid node stride');
  }
}

function outputEnvelope({
  backend,
  p2gGridProjection,
  updatedGridNodes,
  dt,
  gravityMPerS2,
  boxDimsM,
  cflFactor,
  readbackMode = FULL_READBACK_MODE
}) {
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  return {
    schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
    backend,
    status: 'updated',
    kernelScope: GRID_UPDATE_SCOPE,
    sourceSchema: p2gGridProjection.schema,
    sourceProjectionSchema: p2gGridProjection.projectionSchema || p2gGridProjection.schema,
    sourceBackend: p2gGridProjection.backend,
    particleCount: p2gGridProjection.particleCount ?? 0,
    gridSpacingM: p2gGridProjection.gridSpacingM ?? 0,
    gridDims: [...(p2gGridProjection.gridDims ?? [])],
    gridNodeCount: p2gGridProjection.gridNodeCount ?? 0,
    gridShift: p2gGridProjection.gridShift ?? 1,
    dt,
    gravityMPerS2: [...gravityMPerS2],
    boxDimsM: [...boxDimsM],
    cflFactor,
    sourceGridNodeLayout: [...MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT],
    gridNodeLayout: [...MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT],
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_VELOCITY_FLOATS,
    gridNodeStrideBytes: MLS_MPM_GPU_GRID_VELOCITY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    updatedGridNodes,
    readbackMode,
    fullReadbackPerformed: !noFullReadback,
    normalHotLoopReadbackFree: noFullReadback,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridUpdateValidation: false,
    gridValidation: false,
    g2pValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function updateMlsMpmGridCpu({
  p2gGridProjection,
  dt = p2gGridProjection?.dt ?? 0,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  cflFactor = DEFAULT_CFL_FACTOR
} = {}) {
  const dtSeconds = finiteNumber(dt, 0);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const cfl = finiteNumber(cflFactor, DEFAULT_CFL_FACTOR);
  const gridSpacingM = finiteNumber(p2gGridProjection.gridSpacingM, 0);
  const vmax = dtSeconds > 0 ? (cfl * gridSpacingM) / dtSeconds : Number.POSITIVE_INFINITY;
  const vmax2 = vmax * vmax;
  const source = p2gGridProjection.gridNodes;
  const updatedGridNodes = new Float32Array(p2gGridProjection.gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS);

  for (let offset = 0; offset < source.length; offset += MLS_MPM_GPU_GRID_NODE_FLOATS) {
    const mass = source[offset];
    const out = offset;
    const nodePosition = [source[offset + 4], source[offset + 5], source[offset + 6]];
    let velocity = [0, 0, 0];
    let status = 0;
    if (mass > 0) {
      velocity = [
        source[offset + 1] / mass + dtSeconds * gravity[0],
        source[offset + 2] / mass + dtSeconds * gravity[1],
        source[offset + 3] / mass + dtSeconds * gravity[2]
      ];
      const speed2 = velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2;
      if (speed2 > vmax2) {
        const scale = vmax / Math.sqrt(speed2);
        velocity = velocity.map((component) => component * scale);
      }
      if ((nodePosition[0] < gridSpacingM && velocity[0] < 0) || (nodePosition[0] > dims[0] - gridSpacingM && velocity[0] > 0)) velocity[0] = 0;
      if ((nodePosition[1] < gridSpacingM && velocity[1] < 0) || (nodePosition[1] > dims[1] - gridSpacingM && velocity[1] > 0)) velocity[1] = 0;
      if ((nodePosition[2] < gridSpacingM && velocity[2] < 0) || (nodePosition[2] > dims[2] - gridSpacingM && velocity[2] > 0)) velocity[2] = 0;
      status = 1;
    }
    updatedGridNodes.set([
      mass,
      velocity[0],
      velocity[1],
      velocity[2],
      nodePosition[0],
      nodePosition[1],
      nodePosition[2],
      status
    ], out);
  }

  return outputEnvelope({
    backend: 'cpu-reference',
    p2gGridProjection,
    updatedGridNodes,
    dt: dtSeconds,
    gravityMPerS2: gravity,
    boxDimsM: dims,
    cflFactor: cfl
  });
}

function writeStorageBuffer(device, label, data) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function createGridUpdateParamsArray({ p2gGridProjection, dt, gravityMPerS2, boxDimsM, cflFactor }) {
  const buffer = new ArrayBuffer(80);
  const view = new DataView(buffer);
  const gridDims = p2gGridProjection.gridDims ?? [1, 1, 1];
  view.setUint32(0, p2gGridProjection.gridNodeCount ?? 0, true);
  view.setUint32(4, gridDims[0] ?? 1, true);
  view.setUint32(8, gridDims[1] ?? 1, true);
  view.setUint32(12, gridDims[2] ?? 1, true);
  view.setUint32(16, p2gGridProjection.gridShift ?? 1, true);
  view.setFloat32(32, finiteNumber(p2gGridProjection.gridSpacingM, 0), true);
  view.setFloat32(36, dt, true);
  view.setFloat32(40, gravityMPerS2[0], true);
  view.setFloat32(44, gravityMPerS2[1], true);
  view.setFloat32(48, gravityMPerS2[2], true);
  view.setFloat32(52, boxDimsM[0], true);
  view.setFloat32(56, boxDimsM[1], true);
  view.setFloat32(60, boxDimsM[2], true);
  view.setFloat32(64, cflFactor, true);
  return buffer;
}

export async function runMlsMpmGridUpdateWebGpu({
  device,
  p2gGridProjection,
  p2gGridBuffer = null,
  dt = p2gGridProjection?.dt ?? 0,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  cflFactor = DEFAULT_CFL_FACTOR,
  retainUpdatedGridBuffer = false,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmGridUpdateWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertP2gGridProjection(p2gGridProjection);
  const dtSeconds = finiteNumber(dt, 0);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const cfl = finiteNumber(cflFactor, DEFAULT_CFL_FACTOR);
  const outputByteLength = p2gGridProjection.gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const borrowedGridBuffer = p2gGridBuffer || p2gGridProjection.gridBuffer || p2gGridProjection.gpuResult?.gridBuffer || null;
  assertP2gGridProjection(p2gGridProjection, { requireGridNodes: !borrowedGridBuffer });
  const sourceGridBuffer = borrowedGridBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-grid-update-p2g-in', p2gGridProjection.gridNodes);
  const updatedGridBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-grid-update-out',
    size: Math.max(4, outputByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-grid-update-params',
    size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-mls-mpm-grid-update-readback',
      size: Math.max(4, outputByteLength),
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedUpdatedGridBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createGridUpdateParamsArray({
      p2gGridProjection,
      dt: dtSeconds,
      gravityMPerS2: gravity,
      boxDimsM: dims,
      cflFactor: cfl
    }));
    const module = device.createShaderModule({ code: mlsMpmGridUpdateWgsl });
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: sourceGridBuffer } },
        { binding: 1, resource: { buffer: updatedGridBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(p2gGridProjection.gridNodeCount / 64)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(updatedGridBuffer, 0, readBuffer, 0, Math.max(4, outputByteLength));
    }
    device.queue.submit([encoder.finish()]);
    let updatedGridNodes = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      updatedGridNodes = new Float32Array(readBuffer.getMappedRange()).slice(0, p2gGridProjection.gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS);
      readBuffer.unmap();
    } else if (device.queue?.onSubmittedWorkDone) {
      await device.queue.onSubmittedWorkDone();
    }
    const update = outputEnvelope({
      backend: 'webgpu',
      p2gGridProjection,
      updatedGridNodes,
      dt: dtSeconds,
      gravityMPerS2: gravity,
      boxDimsM: dims,
      cflFactor: cfl,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE
    });
    if (retainUpdatedGridBuffer) {
      update.updatedGridBuffer = updatedGridBuffer;
      update.updatedGridBufferByteLength = outputByteLength;
      update.destroyUpdatedGridBuffer = () => updatedGridBuffer.destroy?.();
      returnedRetainedUpdatedGridBuffer = true;
    }
    return update;
  } finally {
    if (!borrowedGridBuffer) sourceGridBuffer.destroy?.();
    if (!retainUpdatedGridBuffer || !returnedRetainedUpdatedGridBuffer) updatedGridBuffer.destroy?.();
    paramsBuffer.destroy?.();
    readBuffer?.destroy?.();
  }
}

function createNoFullReadbackParityReport(tolerance = 1e-5) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
    status: 'not-run-no-full-readback',
    tolerance,
    maxGridAbs: null,
    lengthMismatch: null,
    reason: 'Full grid-update readback and CPU parity were skipped for resident WebGPU execution',
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function createMlsMpmGridUpdateParityReport({ cpuReference, gpuResult, tolerance = 1e-5 } = {}) {
  const cpuGrid = cpuReference?.updatedGridNodes;
  const gpuGrid = gpuResult?.updatedGridNodes;
  if (!(cpuGrid instanceof Float32Array) || !(gpuGrid instanceof Float32Array)) {
    return {
      schema: ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
      status: 'fail',
      tolerance,
      maxGridAbs: Number.POSITIVE_INFINITY,
      lengthMismatch: true,
      reason: 'missing updated grid buffers',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const comparisonCount = Math.min(cpuGrid.length, gpuGrid.length);
  let maxGridAbs = 0;
  for (let index = 0; index < comparisonCount; index += 1) {
    maxGridAbs = Math.max(maxGridAbs, Math.abs(cpuGrid[index] - gpuGrid[index]));
  }
  const lengthMismatch = cpuGrid.length !== gpuGrid.length;
  return {
    schema: ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
    status: !lengthMismatch && maxGridAbs <= tolerance ? 'pass' : 'fail',
    tolerance,
    maxGridAbs,
    lengthMismatch,
    gridNodeCount: cpuReference?.gridNodeCount ?? gpuResult?.gridNodeCount ?? 0,
    cpuBackend: cpuReference?.backend ?? null,
    gpuBackend: gpuResult?.backend ?? null,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function executionFromUpdate(update, {
  cpuReference = null,
  gpuResult = null,
  webgpuStatus,
  webgpuParity = null
} = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
    updateSchema: update?.schema || ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
    backend: update?.backend || 'cpu-reference',
    status: update?.status || 'updated',
    kernelScope: GRID_UPDATE_SCOPE,
    particleCount: update?.particleCount ?? 0,
    gridSpacingM: update?.gridSpacingM ?? 0,
    gridDims: update?.gridDims ?? [],
    gridNodeCount: update?.gridNodeCount ?? 0,
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_VELOCITY_FLOATS,
    dt: update?.dt ?? 0,
    gravityMPerS2: update?.gravityMPerS2 ?? [],
    boxDimsM: update?.boxDimsM ?? [],
    cflFactor: update?.cflFactor ?? 0,
    updatedGridNodes: update?.updatedGridNodes ?? new Float32Array(),
    readbackMode: update?.readbackMode ?? FULL_READBACK_MODE,
    fullReadbackPerformed: update?.fullReadbackPerformed ?? true,
    normalHotLoopReadbackFree: update?.normalHotLoopReadbackFree ?? false,
    cpuReference,
    gpuResult,
    webgpuStatus,
    webgpuParity,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridUpdateValidation: false,
    gridValidation: false,
    g2pValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function describeDeviceLost(info) {
  return info?.reason || info?.message || 'device lost';
}

function watchDeviceLost(device, onDeviceLost) {
  if (!device?.lost?.then) return;
  device.lost.then((info) => onDeviceLost(info)).catch((error) => onDeviceLost(error));
}

export async function runMlsMpmGridUpdateWithOptionalWebGpu({
  p2gGridProjection,
  p2gGridBuffer = null,
  dt = p2gGridProjection?.dt ?? 0,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  cflFactor = DEFAULT_CFL_FACTOR,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerance = 1e-5,
  retainUpdatedGridBuffer = false,
  onDeviceLost = null,
  webGpuRunner = runMlsMpmGridUpdateWebGpu,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  let cpuReference = null;
  const getCpuReference = () => {
    if (!cpuReference) {
      cpuReference = updateMlsMpmGridCpu({
        p2gGridProjection,
        dt,
        gravityMPerS2,
        boxDimsM,
        cflFactor
      });
    }
    return cpuReference;
  };
  if (!preferWebGpu) {
    const reference = getCpuReference();
    return executionFromUpdate(reference, {
      cpuReference: reference,
      webgpuStatus: {
        status: 'not-requested',
        reason: 'WebGPU MLS-MPM grid update path not requested'
      }
    });
  }
  try {
    let lostInfo = null;
    const resolvedDeviceResult = device
      ? { status: 'webgpu-device-ready', reason: 'provided device', device }
      : (deviceResult || await requestOpticalGpuDevice(navigatorRef, {
        onDeviceLost(info) {
          lostInfo = info;
          if (typeof onDeviceLost === 'function') onDeviceLost(info);
        }
      }));
    if (resolvedDeviceResult.device && device) {
      watchDeviceLost(resolvedDeviceResult.device, (info) => {
        lostInfo = info;
        if (typeof onDeviceLost === 'function') onDeviceLost(info);
      });
    }
    if (!resolvedDeviceResult.device) {
      const reference = getCpuReference();
      return executionFromUpdate(reference, {
        cpuReference: reference,
        webgpuStatus: {
          status: resolvedDeviceResult.status,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-reference'
        }
      });
    }
    await Promise.resolve();
    if (lostInfo) {
      const reference = getCpuReference();
      return executionFromUpdate(reference, {
        cpuReference: reference,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    const gpuResult = await webGpuRunner({
      device: resolvedDeviceResult.device,
      p2gGridProjection,
      p2gGridBuffer,
      dt,
      gravityMPerS2,
      boxDimsM,
      cflFactor,
      retainUpdatedGridBuffer,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE
    });
    await Promise.resolve();
    if (lostInfo) {
      gpuResult.destroyUpdatedGridBuffer?.();
      const reference = getCpuReference();
      return executionFromUpdate(reference, {
        cpuReference: reference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    if (noFullReadback) {
      return executionFromUpdate(gpuResult, {
        cpuReference: null,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-executed-no-full-readback',
          reason: 'WebGPU MLS-MPM grid update executed without full grid readback'
        },
        webgpuParity: createNoFullReadbackParityReport(parityTolerance)
      });
    }
    const reference = getCpuReference();
    const webgpuParity = createMlsMpmGridUpdateParityReport({
      cpuReference: reference,
      gpuResult,
      tolerance: parityTolerance
    });
    if (webgpuParity.status !== 'pass') {
      gpuResult.destroyUpdatedGridBuffer?.();
      return executionFromUpdate(reference, {
        cpuReference: reference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-parity-failed',
          reason: 'CPU/WebGPU MLS-MPM grid update parity exceeded tolerance',
          fallback: 'cpu-reference'
        },
        webgpuParity
      });
    }
    return executionFromUpdate(gpuResult, {
      cpuReference: reference,
      gpuResult,
      webgpuStatus: {
        status: 'webgpu-executed',
        reason: 'CPU/WebGPU MLS-MPM grid update parity passed'
      },
      webgpuParity
    });
  } catch (error) {
    const reference = getCpuReference();
    return executionFromUpdate(reference, {
      cpuReference: reference,
      webgpuStatus: {
        status: 'webgpu-error-fallback',
        reason: error instanceof Error ? error.message : String(error),
        fallback: 'cpu-reference'
      }
    });
  }
}
