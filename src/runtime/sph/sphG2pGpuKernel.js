import {
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmG2pReconstructWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import { MLS_MPM_GPU_GRID_VELOCITY_FLOATS } from './sphGridUpdateGpuKernel.js';

export {
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  mlsMpmG2pReconstructWgsl
};

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
const G2P_SCOPE = 'mls-mpm-g2p-velocity-affine-deformation-reconstruction';

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

function assertInputs({ sphParticleState, mlsMpmParticleState, gridUpdate }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM G2P requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM G2P requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle counts must match');
  }
  if (
    gridUpdate?.schema !== ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
    && gridUpdate?.schema !== ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA
    && gridUpdate?.updateSchema !== ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
  ) {
    throw new TypeError('MLS-MPM G2P requires a grid update artifact');
  }
  if (!(gridUpdate.updatedGridNodes instanceof Float32Array)) {
    throw new TypeError('MLS-MPM G2P requires Float32Array updatedGridNodes');
  }
}

function quadraticWeights(fx) {
  const a = 1.5 - fx;
  const b = fx - 1;
  const c = fx - 0.5;
  return [0.5 * a * a, 0.75 - b * b, 0.5 * c * c];
}

function det3(F) {
  return F[0] * (F[4] * F[8] - F[5] * F[7])
    - F[1] * (F[3] * F[8] - F[5] * F[6])
    + F[2] * (F[3] * F[7] - F[4] * F[6]);
}

function multiplyGradF(F, C, dt) {
  const grad = [
    1 + dt * C[0], dt * C[1], dt * C[2],
    dt * C[3], 1 + dt * C[4], dt * C[5],
    dt * C[6], dt * C[7], 1 + dt * C[8]
  ];
  return [
    grad[0] * F[0] + grad[1] * F[3] + grad[2] * F[6],
    grad[0] * F[1] + grad[1] * F[4] + grad[2] * F[7],
    grad[0] * F[2] + grad[1] * F[5] + grad[2] * F[8],
    grad[3] * F[0] + grad[4] * F[3] + grad[5] * F[6],
    grad[3] * F[1] + grad[4] * F[4] + grad[5] * F[7],
    grad[3] * F[2] + grad[4] * F[5] + grad[5] * F[8],
    grad[6] * F[0] + grad[7] * F[3] + grad[8] * F[6],
    grad[6] * F[1] + grad[7] * F[4] + grad[8] * F[7],
    grad[6] * F[2] + grad[7] * F[5] + grad[8] * F[8]
  ];
}

function isotropicF(volumeRatioJ) {
  const s = Math.cbrt(Math.max(volumeRatioJ, 1e-12));
  return [s, 0, 0, 0, s, 0, 0, 0, s];
}

function gridIndex(gridUpdate, i, j, k) {
  const [, gny, gnz] = gridUpdate.gridDims;
  return ((i + gridUpdate.gridShift) * gny + (j + gridUpdate.gridShift)) * gnz + (k + gridUpdate.gridShift);
}

function inRange(gridUpdate, i, j, k) {
  const [gnx, gny, gnz] = gridUpdate.gridDims;
  return i + gridUpdate.gridShift >= 0 && i + gridUpdate.gridShift < gnx
    && j + gridUpdate.gridShift >= 0 && j + gridUpdate.gridShift < gny
    && k + gridUpdate.gridShift >= 0 && k + gridUpdate.gridShift < gnz;
}

function outputEnvelope({ backend, sphParticleState, mlsMpmParticleState, gridUpdate, state, mechanics, dt, boxDimsM }) {
  return {
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
    backend,
    status: 'reconstructed',
    kernelScope: G2P_SCOPE,
    sourceSchemas: {
      sphParticleState: sphParticleState.schema,
      mlsMpmParticleState: mlsMpmParticleState.schema,
      gridUpdate: gridUpdate.schema
    },
    particleCount: sphParticleState.particleCount,
    gridNodeCount: gridUpdate.gridNodeCount,
    gridSpacingM: gridUpdate.gridSpacingM,
    gridDims: [...gridUpdate.gridDims],
    gridShift: gridUpdate.gridShift,
    dt,
    boxDimsM: [...boxDimsM],
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    state,
    mechanics,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridUpdateValidation: false,
    g2pValidation: false,
    gridValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function reconstructMlsMpmG2pCpu({
  sphParticleState,
  mlsMpmParticleState,
  gridUpdate,
  dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0,
  boxDimsM = DEFAULT_BOX_DIMS_M
} = {}) {
  assertInputs({ sphParticleState, mlsMpmParticleState, gridUpdate });
  const dtSeconds = finiteNumber(dt, 0);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const invDx = 1 / gridUpdate.gridSpacingM;
  const state = new Float32Array(sphParticleState.state);
  const mechanics = new Float32Array(mlsMpmParticleState.mechanics);

  for (let particleIndex = 0; particleIndex < sphParticleState.particleCount; particleIndex += 1) {
    const stateOffset = particleIndex * SPH_GPU_PARTICLE_STATE_FLOATS;
    const mechanicsOffset = particleIndex * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const position0 = [state[stateOffset], state[stateOffset + 1], state[stateOffset + 2]];
    const pGrid = position0.map((value) => value * invDx);
    const base = pGrid.map((value) => Math.floor(value - 0.5));
    const weights = [
      quadraticWeights(pGrid[0] - base[0]),
      quadraticWeights(pGrid[1] - base[1]),
      quadraticWeights(pGrid[2] - base[2])
    ];
    const velocity = [0, 0, 0];
    const C = new Array(9).fill(0);
    for (let a = 0; a < 3; a += 1) for (let b = 0; b < 3; b += 1) for (let c = 0; c < 3; c += 1) {
      const i = base[0] + a;
      const j = base[1] + b;
      const k = base[2] + c;
      if (!inRange(gridUpdate, i, j, k)) continue;
      const w = weights[0][a] * weights[1][b] * weights[2][c];
      const nodeIndex = gridIndex(gridUpdate, i, j, k);
      const gridOffset = nodeIndex * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
      const gv = [
        gridUpdate.updatedGridNodes[gridOffset + 1],
        gridUpdate.updatedGridNodes[gridOffset + 2],
        gridUpdate.updatedGridNodes[gridOffset + 3]
      ];
      velocity[0] += w * gv[0];
      velocity[1] += w * gv[1];
      velocity[2] += w * gv[2];
      const dpos = [
        (i - pGrid[0]) * gridUpdate.gridSpacingM,
        (j - pGrid[1]) * gridUpdate.gridSpacingM,
        (k - pGrid[2]) * gridUpdate.gridSpacingM
      ];
      const s = 4 * invDx * invDx * w;
      C[0] += s * gv[0] * dpos[0]; C[1] += s * gv[0] * dpos[1]; C[2] += s * gv[0] * dpos[2];
      C[3] += s * gv[1] * dpos[0]; C[4] += s * gv[1] * dpos[1]; C[5] += s * gv[1] * dpos[2];
      C[6] += s * gv[2] * dpos[0]; C[7] += s * gv[2] * dpos[1]; C[8] += s * gv[2] * dpos[2];
    }
    const position = [
      position0[0] + dtSeconds * velocity[0],
      position0[1] + dtSeconds * velocity[1],
      position0[2] + dtSeconds * velocity[2]
    ];
    for (let axis = 0; axis < 3; axis += 1) {
      if (position[axis] < 0) {
        position[axis] = 0;
        if (velocity[axis] < 0) velocity[axis] = 0;
      } else if (position[axis] > dims[axis]) {
        position[axis] = dims[axis];
        if (velocity[axis] > 0) velocity[axis] = 0;
      }
    }
    state[stateOffset] = position[0];
    state[stateOffset + 1] = position[1];
    state[stateOffset + 2] = position[2];
    state[stateOffset + 4] = velocity[0];
    state[stateOffset + 5] = velocity[1];
    state[stateOffset + 6] = velocity[2];

    const F = Array.from(mechanics.slice(mechanicsOffset, mechanicsOffset + 9));
    let nextF = multiplyGradF(F, C, dtSeconds);
    let nextJ = det3(nextF);
    if (mechanics[mechanicsOffset + 20] < 0.5) {
      nextF = isotropicF(Math.max(nextJ, 0.05));
      nextJ = det3(nextF);
    }
    if (nextJ < 0.1) {
      nextF = isotropicF(0.1);
      nextJ = det3(nextF);
    }
    mechanics.set(nextF, mechanicsOffset);
    mechanics.set(C, mechanicsOffset + 9);
    mechanics[mechanicsOffset + 18] = nextJ;
  }

  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    state,
    mechanics,
    dt: dtSeconds,
    boxDimsM: dims
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

function createParamsArray({ particleCount, gridUpdate, dt, boxDimsM }) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, gridUpdate.gridNodeCount, true);
  view.setUint32(8, gridUpdate.gridDims[0], true);
  view.setUint32(12, gridUpdate.gridDims[1], true);
  view.setUint32(16, gridUpdate.gridDims[2], true);
  view.setUint32(20, gridUpdate.gridShift, true);
  view.setFloat32(32, gridUpdate.gridSpacingM, true);
  view.setFloat32(36, 1 / gridUpdate.gridSpacingM, true);
  view.setFloat32(40, dt, true);
  view.setFloat32(44, boxDimsM[0], true);
  view.setFloat32(48, boxDimsM[1], true);
  view.setFloat32(52, boxDimsM[2], true);
  return buffer;
}

export async function runMlsMpmG2pWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  gridUpdate,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  updatedGridBuffer = null,
  dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  retainOutputParticleBuffers = false
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmG2pWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertInputs({ sphParticleState, mlsMpmParticleState, gridUpdate });
  const dtSeconds = finiteNumber(dt, 0);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const stateByteLength = sphParticleState.state.byteLength;
  const mechanicsByteLength = mlsMpmParticleState.mechanics.byteLength;
  const borrowedStateBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
  const borrowedThermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
  const borrowedMechanicsBuffer = mlsMpmParticleUpload?.status === 'webgpu-uploaded' ? mlsMpmParticleUpload.mechanicsBuffer : null;
  const borrowedGridBuffer = updatedGridBuffer || gridUpdate.gpuResult?.updatedGridBuffer || gridUpdate.updatedGridBuffer || null;
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-g2p-sph-state-in', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-g2p-sph-thermo-in', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-g2p-mechanics-in', mlsMpmParticleState.mechanics);
  const gridBuffer = borrowedGridBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-g2p-grid-in', gridUpdate.updatedGridNodes);
  const outStateBuffer = device.createBuffer({ label: 'ulg-mls-mpm-g2p-state-out', size: Math.max(4, stateByteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const outMechanicsBuffer = device.createBuffer({ label: 'ulg-mls-mpm-g2p-mechanics-out', size: Math.max(4, mechanicsByteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const paramsBuffer = device.createBuffer({ label: 'ulg-mls-mpm-g2p-params', size: 64, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const stateReadBuffer = device.createBuffer({ label: 'ulg-mls-mpm-g2p-state-readback', size: Math.max(4, stateByteLength), usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const mechanicsReadBuffer = device.createBuffer({ label: 'ulg-mls-mpm-g2p-mechanics-readback', size: Math.max(4, mechanicsByteLength), usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  let returnedRetainedOutputBuffers = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({ particleCount: sphParticleState.particleCount, gridUpdate, dt: dtSeconds, boxDimsM: dims }));
    const module = device.createShaderModule({ code: mlsMpmG2pReconstructWgsl });
    const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: mechanicsBuffer } },
        { binding: 3, resource: { buffer: gridBuffer } },
        { binding: 4, resource: { buffer: outStateBuffer } },
        { binding: 5, resource: { buffer: outMechanicsBuffer } },
        { binding: 6, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(sphParticleState.particleCount / 64)));
    pass.end();
    encoder.copyBufferToBuffer(outStateBuffer, 0, stateReadBuffer, 0, Math.max(4, stateByteLength));
    encoder.copyBufferToBuffer(outMechanicsBuffer, 0, mechanicsReadBuffer, 0, Math.max(4, mechanicsByteLength));
    device.queue.submit([encoder.finish()]);
    await stateReadBuffer.mapAsync(GPU_MAP_MODE.READ);
    await mechanicsReadBuffer.mapAsync(GPU_MAP_MODE.READ);
    const state = new Float32Array(stateReadBuffer.getMappedRange()).slice(0, sphParticleState.state.length);
    const mechanics = new Float32Array(mechanicsReadBuffer.getMappedRange()).slice(0, mlsMpmParticleState.mechanics.length);
    stateReadBuffer.unmap();
    mechanicsReadBuffer.unmap();
    const reconstruction = outputEnvelope({
      backend: 'webgpu',
      sphParticleState,
      mlsMpmParticleState,
      gridUpdate,
      state,
      mechanics,
      dt: dtSeconds,
      boxDimsM: dims
    });
    if (retainOutputParticleBuffers) {
      reconstruction.stateBuffer = outStateBuffer;
      reconstruction.mechanicsBuffer = outMechanicsBuffer;
      reconstruction.stateBufferByteLength = stateByteLength;
      reconstruction.mechanicsBufferByteLength = mechanicsByteLength;
      reconstruction.retainedOutputParticleBuffers = true;
      reconstruction.destroyOutputParticleBuffers = () => {
        outStateBuffer.destroy?.();
        outMechanicsBuffer.destroy?.();
      };
      returnedRetainedOutputBuffers = true;
    }
    return reconstruction;
  } finally {
    if (!borrowedStateBuffer) stateBuffer.destroy?.();
    if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
    if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
    if (!borrowedGridBuffer) gridBuffer.destroy?.();
    if (!retainOutputParticleBuffers || !returnedRetainedOutputBuffers) {
      outStateBuffer.destroy?.();
      outMechanicsBuffer.destroy?.();
    }
    paramsBuffer.destroy?.();
    stateReadBuffer.destroy?.();
    mechanicsReadBuffer.destroy?.();
  }
}

export function createMlsMpmG2pParityReport({ cpuReference, gpuResult, tolerance = 5e-2 } = {}) {
  if (!(cpuReference?.state instanceof Float32Array) || !(gpuResult?.state instanceof Float32Array)) {
    return { schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA, status: 'fail', tolerance, maxStateAbs: Infinity, maxMechanicsAbs: Infinity, lengthMismatch: true, scientificValidation: false, sphValidation: false, phaseChangeValidation: false, fullPhysicsValidation: false };
  }
  const stateCount = Math.min(cpuReference.state.length, gpuResult.state.length);
  const mechanicsCount = Math.min(cpuReference.mechanics.length, gpuResult.mechanics.length);
  let maxStateAbs = 0;
  let maxMechanicsAbs = 0;
  for (let i = 0; i < stateCount; i += 1) maxStateAbs = Math.max(maxStateAbs, Math.abs(cpuReference.state[i] - gpuResult.state[i]));
  for (let i = 0; i < mechanicsCount; i += 1) maxMechanicsAbs = Math.max(maxMechanicsAbs, Math.abs(cpuReference.mechanics[i] - gpuResult.mechanics[i]));
  const lengthMismatch = cpuReference.state.length !== gpuResult.state.length || cpuReference.mechanics.length !== gpuResult.mechanics.length;
  return {
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
    status: !lengthMismatch && maxStateAbs <= tolerance && maxMechanicsAbs <= tolerance ? 'pass' : 'fail',
    tolerance,
    maxStateAbs,
    maxMechanicsAbs,
    lengthMismatch,
    particleCount: cpuReference.particleCount ?? gpuResult.particleCount ?? 0,
    cpuBackend: cpuReference.backend,
    gpuBackend: gpuResult.backend,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function executionFromReconstruction(reconstruction, { cpuReference = null, gpuResult = null, webgpuStatus, webgpuParity = null } = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
    reconstructionSchema: reconstruction?.schema || ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
    backend: reconstruction?.backend || 'cpu-reference',
    status: reconstruction?.status || 'reconstructed',
    kernelScope: G2P_SCOPE,
    particleCount: reconstruction?.particleCount ?? 0,
    gridNodeCount: reconstruction?.gridNodeCount ?? 0,
    dt: reconstruction?.dt ?? 0,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    state: reconstruction?.state ?? new Float32Array(),
    mechanics: reconstruction?.mechanics ?? new Float32Array(),
    stateBuffer: reconstruction?.stateBuffer ?? null,
    mechanicsBuffer: reconstruction?.mechanicsBuffer ?? null,
    stateBufferByteLength: reconstruction?.stateBufferByteLength ?? 0,
    mechanicsBufferByteLength: reconstruction?.mechanicsBufferByteLength ?? 0,
    retainedOutputParticleBuffers: Boolean(reconstruction?.retainedOutputParticleBuffers),
    destroyOutputParticleBuffers: reconstruction?.destroyOutputParticleBuffers ?? null,
    cpuReference,
    gpuResult,
    webgpuStatus,
    webgpuParity,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridUpdateValidation: false,
    g2pValidation: false,
    gridValidation: false,
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

export async function runMlsMpmG2pWithOptionalWebGpu({
  sphParticleState,
  mlsMpmParticleState,
  gridUpdate,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  updatedGridBuffer = null,
  dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerance = 5e-2,
  retainOutputParticleBuffers = false,
  onDeviceLost = null,
  webGpuRunner = runMlsMpmG2pWebGpu
} = {}) {
  const cpuReference = reconstructMlsMpmG2pCpu({ sphParticleState, mlsMpmParticleState, gridUpdate, dt, boxDimsM });
  if (!preferWebGpu) {
    return executionFromReconstruction(cpuReference, { cpuReference, webgpuStatus: { status: 'not-requested', reason: 'WebGPU MLS-MPM G2P path not requested' } });
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
      return executionFromReconstruction(cpuReference, { cpuReference, webgpuStatus: { status: resolvedDeviceResult.status, reason: resolvedDeviceResult.reason, fallback: 'cpu-reference' } });
    }
    await Promise.resolve();
    if (lostInfo) {
      return executionFromReconstruction(cpuReference, { cpuReference, webgpuStatus: { status: 'webgpu-device-lost-fallback', reason: describeDeviceLost(lostInfo), fallback: 'cpu-reference' } });
    }
    const gpuResult = await webGpuRunner({
      device: resolvedDeviceResult.device,
      sphParticleState,
      mlsMpmParticleState,
      gridUpdate,
      sphParticleUpload,
      mlsMpmParticleUpload,
      updatedGridBuffer,
      dt,
      boxDimsM,
      retainOutputParticleBuffers
    });
    await Promise.resolve();
    if (lostInfo) {
      gpuResult.destroyOutputParticleBuffers?.();
      return executionFromReconstruction(cpuReference, { cpuReference, gpuResult, webgpuStatus: { status: 'webgpu-device-lost-fallback', reason: describeDeviceLost(lostInfo), fallback: 'cpu-reference' } });
    }
    const webgpuParity = createMlsMpmG2pParityReport({ cpuReference, gpuResult, tolerance: parityTolerance });
    if (webgpuParity.status !== 'pass') {
      gpuResult.destroyOutputParticleBuffers?.();
      return executionFromReconstruction(cpuReference, { cpuReference, gpuResult, webgpuStatus: { status: 'webgpu-parity-failed', reason: 'CPU/WebGPU MLS-MPM G2P parity exceeded tolerance', fallback: 'cpu-reference' }, webgpuParity });
    }
    return executionFromReconstruction(gpuResult, { cpuReference, gpuResult, webgpuStatus: { status: 'webgpu-executed', reason: 'CPU/WebGPU MLS-MPM G2P parity passed' }, webgpuParity });
  } catch (error) {
    return executionFromReconstruction(cpuReference, { cpuReference, webgpuStatus: { status: 'webgpu-error-fallback', reason: error instanceof Error ? error.message : String(error), fallback: 'cpu-reference' } });
  }
}
