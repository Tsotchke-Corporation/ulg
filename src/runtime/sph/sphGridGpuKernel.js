import {
  MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmP2gGridProjectionWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS
} from './sphGpuBuffers.js';

export {
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  mlsMpmP2gGridProjectionWgsl
};

export const MLS_MPM_GPU_GRID_NODE_FLOATS = MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT.length;

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

const DEFAULT_BOX_DIMS_M = Object.freeze([5, 5, 5]);
const DEFAULT_GRID_SHIFT = 1;
const GRID_SCOPE = 'gather-form-p2g-mass-momentum-projection';

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

function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM grid projection requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM grid projection requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle buffer counts must match');
  }
}

export function createMlsMpmGridSpec({
  boxDimsM = DEFAULT_BOX_DIMS_M,
  gridSpacingM,
  shift = DEFAULT_GRID_SHIFT
} = {}) {
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const dx = finiteNumber(gridSpacingM, 0);
  if (!(dx > 0)) throw new RangeError('createMlsMpmGridSpec requires a positive gridSpacingM');
  const gridDims = [
    Math.round(dims[0] / dx) + 5,
    Math.round(dims[1] / dx) + 5,
    Math.round(dims[2] / dx) + 5
  ];
  return {
    gridSpacingM: dx,
    invGridSpacingM: 1 / dx,
    boxDimsM: dims,
    shift,
    gridDims,
    gridNodeCount: gridDims[0] * gridDims[1] * gridDims[2]
  };
}

function quadraticWeights(fx) {
  const a = 1.5 - fx;
  const b = fx - 1;
  const c = fx - 0.5;
  return [0.5 * a * a, 0.75 - b * b, 0.5 * c * c];
}

function gridNodeCoords(nodeIndex, gridSpec) {
  const [, gny, gnz] = gridSpec.gridDims;
  const plane = gny * gnz;
  const i = Math.floor(nodeIndex / plane);
  const rem = nodeIndex - i * plane;
  const j = Math.floor(rem / gnz);
  const k = rem - j * gnz;
  return {
    i,
    j,
    k,
    nodeI: i - gridSpec.shift,
    nodeJ: j - gridSpec.shift,
    nodeK: k - gridSpec.shift
  };
}

function outputEnvelope({ backend, sphParticleState, mlsMpmParticleState, gridSpec, gridNodes }) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
    backend,
    status: 'projected',
    kernelScope: GRID_SCOPE,
    particleCount: sphParticleState.particleCount,
    sourceSchemas: {
      sphParticleState: sphParticleState.schema,
      mlsMpmParticleState: mlsMpmParticleState.schema
    },
    sourceStep: sphParticleState.step ?? mlsMpmParticleState.step ?? 0,
    sourceTime: sphParticleState.time ?? mlsMpmParticleState.time ?? 0,
    gridSpacingM: gridSpec.gridSpacingM,
    gridDims: [...gridSpec.gridDims],
    gridNodeCount: gridSpec.gridNodeCount,
    gridShift: gridSpec.shift,
    gridNodeLayout: [...MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT],
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_NODE_FLOATS,
    gridNodeStrideBytes: MLS_MPM_GPU_GRID_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    gridNodes,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridValidation: false,
    g2pValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function projectMlsMpmP2gGridCpu({
  sphParticleState,
  mlsMpmParticleState,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const gridSpec = createMlsMpmGridSpec({ boxDimsM, gridSpacingM });
  const gridNodes = new Float32Array(gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS);

  for (let nodeIndex = 0; nodeIndex < gridSpec.gridNodeCount; nodeIndex += 1) {
    const { nodeI, nodeJ, nodeK } = gridNodeCoords(nodeIndex, gridSpec);
    const nodePosition = [
      nodeI * gridSpec.gridSpacingM,
      nodeJ * gridSpec.gridSpacingM,
      nodeK * gridSpec.gridSpacingM
    ];
    let mass = 0;
    const momentum = [0, 0, 0];

    for (let particleIndex = 0; particleIndex < sphParticleState.particleCount; particleIndex += 1) {
      const stateOffset = particleIndex * SPH_GPU_PARTICLE_STATE_FLOATS;
      const mechanicsOffset = particleIndex * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
      const position = [
        sphParticleState.state[stateOffset],
        sphParticleState.state[stateOffset + 1],
        sphParticleState.state[stateOffset + 2]
      ];
      const pGrid = position.map((value) => value * gridSpec.invGridSpacingM);
      const base = pGrid.map((value) => Math.floor(value - 0.5));
      const offsets = [nodeI - base[0], nodeJ - base[1], nodeK - base[2]];
      if (offsets.some((offset) => offset < 0 || offset > 2)) continue;
      const wx = quadraticWeights(pGrid[0] - base[0]);
      const wy = quadraticWeights(pGrid[1] - base[1]);
      const wz = quadraticWeights(pGrid[2] - base[2]);
      const weight = wx[offsets[0]] * wy[offsets[1]] * wz[offsets[2]];
      if (weight === 0) continue;
      const particleMass = sphParticleState.state[stateOffset + 3];
      const velocity = [
        sphParticleState.state[stateOffset + 4],
        sphParticleState.state[stateOffset + 5],
        sphParticleState.state[stateOffset + 6]
      ];
      const dpos = [
        nodePosition[0] - position[0],
        nodePosition[1] - position[1],
        nodePosition[2] - position[2]
      ];
      const C = [
        mlsMpmParticleState.mechanics[mechanicsOffset + 9],
        mlsMpmParticleState.mechanics[mechanicsOffset + 10],
        mlsMpmParticleState.mechanics[mechanicsOffset + 11],
        mlsMpmParticleState.mechanics[mechanicsOffset + 12],
        mlsMpmParticleState.mechanics[mechanicsOffset + 13],
        mlsMpmParticleState.mechanics[mechanicsOffset + 14],
        mlsMpmParticleState.mechanics[mechanicsOffset + 15],
        mlsMpmParticleState.mechanics[mechanicsOffset + 16],
        mlsMpmParticleState.mechanics[mechanicsOffset + 17]
      ];
      const apic = [
        C[0] * dpos[0] + C[1] * dpos[1] + C[2] * dpos[2],
        C[3] * dpos[0] + C[4] * dpos[1] + C[5] * dpos[2],
        C[6] * dpos[0] + C[7] * dpos[1] + C[8] * dpos[2]
      ];
      mass += weight * particleMass;
      momentum[0] += weight * particleMass * (velocity[0] + apic[0]);
      momentum[1] += weight * particleMass * (velocity[1] + apic[1]);
      momentum[2] += weight * particleMass * (velocity[2] + apic[2]);
    }

    const offset = nodeIndex * MLS_MPM_GPU_GRID_NODE_FLOATS;
    gridNodes.set([
      mass,
      momentum[0],
      momentum[1],
      momentum[2],
      nodePosition[0],
      nodePosition[1],
      nodePosition[2],
      mass > 0 ? 1 : 0
    ], offset);
  }

  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    mlsMpmParticleState,
    gridSpec,
    gridNodes
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

function createProjectionParamsArray(gridSpec, particleCount) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, gridSpec.gridNodeCount, true);
  view.setUint32(8, gridSpec.gridDims[0], true);
  view.setUint32(12, gridSpec.gridDims[1], true);
  view.setUint32(16, gridSpec.gridDims[2], true);
  view.setUint32(20, gridSpec.shift, true);
  view.setFloat32(24, gridSpec.gridSpacingM, true);
  view.setFloat32(28, gridSpec.invGridSpacingM, true);
  return buffer;
}

export async function runMlsMpmP2gGridProjectionWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmP2gGridProjectionWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const gridSpec = createMlsMpmGridSpec({ boxDimsM, gridSpacingM });
  const outputByteLength = gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const borrowedStateBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
  const borrowedThermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
  const borrowedMechanicsBuffer = mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    ? mlsMpmParticleUpload.mechanicsBuffer
    : null;
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-p2g-sph-state-in', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-p2g-sph-thermo-in', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-p2g-mechanics-in', mlsMpmParticleState.mechanics);
  const gridBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-p2g-grid-out',
    size: Math.max(4, outputByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-p2g-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-p2g-grid-readback',
    size: Math.max(4, outputByteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createProjectionParamsArray(gridSpec, sphParticleState.particleCount));
    const module = device.createShaderModule({ code: mlsMpmP2gGridProjectionWgsl });
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: mechanicsBuffer } },
        { binding: 3, resource: { buffer: gridBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(gridSpec.gridNodeCount / 64)));
    pass.end();
    encoder.copyBufferToBuffer(gridBuffer, 0, readBuffer, 0, Math.max(4, outputByteLength));
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPU_MAP_MODE.READ);
    const gridNodes = new Float32Array(readBuffer.getMappedRange()).slice(0, gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS);
    readBuffer.unmap();
    return outputEnvelope({
      backend: 'webgpu',
      sphParticleState,
      mlsMpmParticleState,
      gridSpec,
      gridNodes
    });
  } finally {
    if (!borrowedStateBuffer) stateBuffer.destroy?.();
    if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
    if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
    gridBuffer.destroy?.();
    paramsBuffer.destroy?.();
    readBuffer.destroy?.();
  }
}

export function createMlsMpmP2gGridProjectionParityReport({ cpuReference, gpuResult, tolerance = 5e-2 } = {}) {
  const cpuGrid = cpuReference?.gridNodes;
  const gpuGrid = gpuResult?.gridNodes;
  if (!(cpuGrid instanceof Float32Array) || !(gpuGrid instanceof Float32Array)) {
    return {
      schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
      status: 'fail',
      tolerance,
      maxGridAbs: Number.POSITIVE_INFINITY,
      lengthMismatch: true,
      reason: 'missing grid projection buffers',
      cpuBackend: cpuReference?.backend || null,
      gpuBackend: gpuResult?.backend || null,
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
  const passed = !lengthMismatch && maxGridAbs <= tolerance;
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
    status: passed ? 'pass' : 'fail',
    tolerance,
    maxGridAbs,
    lengthMismatch,
    gridNodeCount: cpuReference?.gridNodeCount ?? gpuResult?.gridNodeCount ?? 0,
    cpuBackend: cpuReference.backend,
    gpuBackend: gpuResult.backend,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function executionFromProjection(projection, {
  cpuReference = null,
  gpuResult = null,
  webgpuStatus,
  webgpuParity = null
} = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
    projectionSchema: projection?.schema || ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
    backend: projection?.backend || 'cpu-reference',
    status: projection?.status || 'projected',
    kernelScope: GRID_SCOPE,
    particleCount: projection?.particleCount ?? 0,
    gridSpacingM: projection?.gridSpacingM ?? 0,
    gridDims: projection?.gridDims ?? [],
    gridNodeCount: projection?.gridNodeCount ?? 0,
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_NODE_FLOATS,
    gridNodes: projection?.gridNodes ?? new Float32Array(),
    cpuReference,
    gpuResult,
    webgpuStatus,
    webgpuParity,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
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

export async function runMlsMpmP2gGridProjectionWithOptionalWebGpu({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerance = 5e-2,
  onDeviceLost = null,
  webGpuRunner = runMlsMpmP2gGridProjectionWebGpu
} = {}) {
  const cpuReference = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM,
    boxDimsM
  });
  if (!preferWebGpu) {
    return executionFromProjection(cpuReference, {
      cpuReference,
      webgpuStatus: {
        status: 'not-requested',
        reason: 'WebGPU MLS-MPM P2G grid projection path not requested'
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
      return executionFromProjection(cpuReference, {
        cpuReference,
        webgpuStatus: {
          status: resolvedDeviceResult.status,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-reference'
        }
      });
    }
    await Promise.resolve();
    if (lostInfo) {
      return executionFromProjection(cpuReference, {
        cpuReference,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    const gpuResult = await webGpuRunner({
      device: resolvedDeviceResult.device,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      gridSpacingM,
      boxDimsM
    });
    await Promise.resolve();
    if (lostInfo) {
      return executionFromProjection(cpuReference, {
        cpuReference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    const webgpuParity = createMlsMpmP2gGridProjectionParityReport({
      cpuReference,
      gpuResult,
      tolerance: parityTolerance
    });
    if (webgpuParity.status !== 'pass') {
      return executionFromProjection(cpuReference, {
        cpuReference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-parity-failed',
          reason: 'CPU/WebGPU MLS-MPM P2G grid projection parity exceeded tolerance',
          fallback: 'cpu-reference'
        },
        webgpuParity
      });
    }
    return executionFromProjection(gpuResult, {
      cpuReference,
      gpuResult,
      webgpuStatus: {
        status: 'webgpu-executed',
        reason: 'CPU/WebGPU MLS-MPM P2G grid projection parity passed'
      },
      webgpuParity
    });
  } catch (error) {
    return executionFromProjection(cpuReference, {
      cpuReference,
      webgpuStatus: {
        status: 'webgpu-error-fallback',
        reason: error instanceof Error ? error.message : String(error),
        fallback: 'cpu-reference'
      }
    });
  }
}
