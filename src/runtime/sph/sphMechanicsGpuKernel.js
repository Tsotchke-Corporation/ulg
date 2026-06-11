import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_MECHANICS_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_MECHANICS_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_MECHANICS_PREDICTION_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmMechanicsPredictWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';

export {
  ULG_MLS_MPM_GPU_MECHANICS_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_MECHANICS_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_MECHANICS_PREDICTION_SCHEMA,
  mlsMpmMechanicsPredictWgsl
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

const DEFAULT_GRAVITY_M_PER_S2 = Object.freeze([0, -9.80665, 0]);
const DEFAULT_BOX_DIMS_M = Object.freeze([5, 5, 5]);
const MECHANICS_SCOPE = 'particle-local-ballistic-apic-deformation-predictor';

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
    throw new TypeError('MLS-MPM mechanics prediction requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM mechanics prediction requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle buffer counts must match');
  }
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

function outputEnvelope({
  backend,
  sphParticleState,
  mlsMpmParticleState,
  state,
  mechanics,
  dt,
  gravityMPerS2,
  boxDimsM
}) {
  return {
    schema: ULG_MLS_MPM_GPU_MECHANICS_PREDICTION_SCHEMA,
    backend,
    status: 'predicted',
    kernelScope: MECHANICS_SCOPE,
    particleCount: sphParticleState.particleCount,
    sourceSchemas: {
      sphParticleState: sphParticleState.schema,
      mlsMpmParticleState: mlsMpmParticleState.schema
    },
    sourceStep: sphParticleState.step ?? mlsMpmParticleState.step ?? 0,
    step: (sphParticleState.step ?? mlsMpmParticleState.step ?? 0) + 1,
    sourceTime: sphParticleState.time ?? mlsMpmParticleState.time ?? 0,
    time: finiteNumber(sphParticleState.time ?? mlsMpmParticleState.time, 0) + dt,
    dt,
    gravityMPerS2: [...gravityMPerS2],
    boxDimsM: [...boxDimsM],
    stateLayout: [...SPH_GPU_PARTICLE_STATE_ROW_LAYOUT],
    thermoLayout: [...SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT],
    mechanicsLayout: [...MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT],
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    state,
    mechanics,
    p2gValidation: false,
    gridValidation: false,
    g2pValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function predictMlsMpmMechanicsCpu({
  sphParticleState,
  mlsMpmParticleState,
  dt = 4e-4,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  boxDimsM = DEFAULT_BOX_DIMS_M
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const particleCount = sphParticleState.particleCount;
  const dtSeconds = finiteNumber(dt, 4e-4);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const state = new Float32Array(sphParticleState.state);
  const mechanics = new Float32Array(mlsMpmParticleState.mechanics);

  for (let index = 0; index < particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const mechanicsOffset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const position = [
      state[stateOffset],
      state[stateOffset + 1],
      state[stateOffset + 2]
    ];
    const velocity = [
      state[stateOffset + 4] + gravity[0] * dtSeconds,
      state[stateOffset + 5] + gravity[1] * dtSeconds,
      state[stateOffset + 6] + gravity[2] * dtSeconds
    ];
    for (let axis = 0; axis < 3; axis += 1) {
      position[axis] += velocity[axis] * dtSeconds;
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

    const F = [
      mechanics[mechanicsOffset],
      mechanics[mechanicsOffset + 1],
      mechanics[mechanicsOffset + 2],
      mechanics[mechanicsOffset + 3],
      mechanics[mechanicsOffset + 4],
      mechanics[mechanicsOffset + 5],
      mechanics[mechanicsOffset + 6],
      mechanics[mechanicsOffset + 7],
      mechanics[mechanicsOffset + 8]
    ];
    const C = [
      mechanics[mechanicsOffset + 9],
      mechanics[mechanicsOffset + 10],
      mechanics[mechanicsOffset + 11],
      mechanics[mechanicsOffset + 12],
      mechanics[mechanicsOffset + 13],
      mechanics[mechanicsOffset + 14],
      mechanics[mechanicsOffset + 15],
      mechanics[mechanicsOffset + 16],
      mechanics[mechanicsOffset + 17]
    ];
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
    mechanics[mechanicsOffset + 18] = nextJ;
  }

  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    mlsMpmParticleState,
    state,
    mechanics,
    dt: dtSeconds,
    gravityMPerS2: gravity,
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

function createParamsArray({ particleCount, dt, gravityMPerS2, boxDimsM }) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setFloat32(4, dt, true);
  view.setFloat32(8, gravityMPerS2[0], true);
  view.setFloat32(12, gravityMPerS2[1], true);
  view.setFloat32(16, gravityMPerS2[2], true);
  view.setFloat32(20, boxDimsM[0], true);
  view.setFloat32(24, boxDimsM[1], true);
  view.setFloat32(28, boxDimsM[2], true);
  return buffer;
}

export async function runMlsMpmMechanicsPredictWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  dt = 4e-4,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  boxDimsM = DEFAULT_BOX_DIMS_M
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmMechanicsPredictWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const dtSeconds = finiteNumber(dt, 4e-4);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const particleCount = sphParticleState.particleCount;
  const stateByteLength = sphParticleState.state.byteLength;
  const mechanicsByteLength = mlsMpmParticleState.mechanics.byteLength;
  const borrowedStateBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
  const borrowedThermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
  const borrowedMechanicsBuffer = mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    ? mlsMpmParticleUpload.mechanicsBuffer
    : null;
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-predict-sph-state-in', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-predict-sph-thermo-in', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-predict-mechanics-in', mlsMpmParticleState.mechanics);
  const stateOutputBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-predict-sph-state-out',
    size: Math.max(4, stateByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const mechanicsOutputBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-predict-mechanics-out',
    size: Math.max(4, mechanicsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-predict-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const stateReadBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-predict-sph-state-readback',
    size: Math.max(4, stateByteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const mechanicsReadBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-predict-mechanics-readback',
    size: Math.max(4, mechanicsByteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
      particleCount,
      dt: dtSeconds,
      gravityMPerS2: gravity,
      boxDimsM: dims
    }));
    const module = device.createShaderModule({ code: mlsMpmMechanicsPredictWgsl });
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
        { binding: 3, resource: { buffer: stateOutputBuffer } },
        { binding: 4, resource: { buffer: mechanicsOutputBuffer } },
        { binding: 5, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 64)));
    pass.end();
    encoder.copyBufferToBuffer(stateOutputBuffer, 0, stateReadBuffer, 0, Math.max(4, stateByteLength));
    encoder.copyBufferToBuffer(mechanicsOutputBuffer, 0, mechanicsReadBuffer, 0, Math.max(4, mechanicsByteLength));
    device.queue.submit([encoder.finish()]);

    await stateReadBuffer.mapAsync(GPU_MAP_MODE.READ);
    const state = new Float32Array(stateReadBuffer.getMappedRange()).slice(0, sphParticleState.state.length);
    stateReadBuffer.unmap();
    await mechanicsReadBuffer.mapAsync(GPU_MAP_MODE.READ);
    const mechanics = new Float32Array(mechanicsReadBuffer.getMappedRange()).slice(0, mlsMpmParticleState.mechanics.length);
    mechanicsReadBuffer.unmap();

    return outputEnvelope({
      backend: 'webgpu',
      sphParticleState,
      mlsMpmParticleState,
      state,
      mechanics,
      dt: dtSeconds,
      gravityMPerS2: gravity,
      boxDimsM: dims
    });
  } finally {
    if (!borrowedStateBuffer) stateBuffer.destroy?.();
    if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
    if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
    stateOutputBuffer.destroy?.();
    mechanicsOutputBuffer.destroy?.();
    paramsBuffer.destroy?.();
    stateReadBuffer.destroy?.();
    mechanicsReadBuffer.destroy?.();
  }
}

export function createMlsMpmMechanicsParityReport({ cpuReference, gpuResult, tolerance = 2e-5 } = {}) {
  const cpuState = cpuReference?.state;
  const gpuState = gpuResult?.state;
  const cpuMechanics = cpuReference?.mechanics;
  const gpuMechanics = gpuResult?.mechanics;
  if (
    !(cpuState instanceof Float32Array)
    || !(gpuState instanceof Float32Array)
    || !(cpuMechanics instanceof Float32Array)
    || !(gpuMechanics instanceof Float32Array)
  ) {
    return {
      schema: ULG_MLS_MPM_GPU_MECHANICS_PARITY_SCHEMA,
      status: 'fail',
      tolerance,
      maxStateAbs: Number.POSITIVE_INFINITY,
      maxMechanicsAbs: Number.POSITIVE_INFINITY,
      lengthMismatch: true,
      reason: 'missing mechanics prediction buffers',
      cpuBackend: cpuReference?.backend || null,
      gpuBackend: gpuResult?.backend || null,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const stateComparisonCount = Math.min(cpuState.length, gpuState.length);
  const mechanicsComparisonCount = Math.min(cpuMechanics.length, gpuMechanics.length);
  let maxStateAbs = 0;
  let maxMechanicsAbs = 0;
  for (let index = 0; index < stateComparisonCount; index += 1) {
    maxStateAbs = Math.max(maxStateAbs, Math.abs(cpuState[index] - gpuState[index]));
  }
  for (let index = 0; index < mechanicsComparisonCount; index += 1) {
    maxMechanicsAbs = Math.max(maxMechanicsAbs, Math.abs(cpuMechanics[index] - gpuMechanics[index]));
  }
  const lengthMismatch = cpuState.length !== gpuState.length || cpuMechanics.length !== gpuMechanics.length;
  const passed = !lengthMismatch && maxStateAbs <= tolerance && maxMechanicsAbs <= tolerance;
  return {
    schema: ULG_MLS_MPM_GPU_MECHANICS_PARITY_SCHEMA,
    status: passed ? 'pass' : 'fail',
    tolerance,
    maxStateAbs,
    maxMechanicsAbs,
    lengthMismatch,
    particleCount: cpuReference?.particleCount ?? gpuResult?.particleCount ?? 0,
    cpuBackend: cpuReference.backend,
    gpuBackend: gpuResult.backend,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function executionFromPrediction(prediction, {
  cpuReference = null,
  gpuResult = null,
  webgpuStatus,
  webgpuParity = null
} = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_MECHANICS_EXECUTION_SCHEMA,
    predictionSchema: prediction?.schema || ULG_MLS_MPM_GPU_MECHANICS_PREDICTION_SCHEMA,
    backend: prediction?.backend || 'cpu-reference',
    status: prediction?.status || 'predicted',
    kernelScope: MECHANICS_SCOPE,
    particleCount: prediction?.particleCount ?? 0,
    dt: prediction?.dt ?? 0,
    step: prediction?.step ?? 0,
    time: prediction?.time ?? 0,
    stateLayout: [...SPH_GPU_PARTICLE_STATE_ROW_LAYOUT],
    mechanicsLayout: [...MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT],
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    state: prediction?.state ?? new Float32Array(),
    mechanics: prediction?.mechanics ?? new Float32Array(),
    cpuReference,
    gpuResult,
    webgpuStatus,
    webgpuParity,
    p2gValidation: false,
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

export async function runMlsMpmMechanicsPredictWithOptionalWebGpu({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  dt = 4e-4,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerance = 2e-5,
  onDeviceLost = null,
  webGpuRunner = runMlsMpmMechanicsPredictWebGpu
} = {}) {
  const cpuReference = predictMlsMpmMechanicsCpu({
    sphParticleState,
    mlsMpmParticleState,
    dt,
    gravityMPerS2,
    boxDimsM
  });
  if (!preferWebGpu) {
    return executionFromPrediction(cpuReference, {
      cpuReference,
      webgpuStatus: {
        status: 'not-requested',
        reason: 'WebGPU MLS-MPM mechanics prediction path not requested'
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
      return executionFromPrediction(cpuReference, {
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
      return executionFromPrediction(cpuReference, {
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
      dt,
      gravityMPerS2,
      boxDimsM
    });
    await Promise.resolve();
    if (lostInfo) {
      return executionFromPrediction(cpuReference, {
        cpuReference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    const webgpuParity = createMlsMpmMechanicsParityReport({
      cpuReference,
      gpuResult,
      tolerance: parityTolerance
    });
    if (webgpuParity.status !== 'pass') {
      return executionFromPrediction(cpuReference, {
        cpuReference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-parity-failed',
          reason: 'CPU/WebGPU MLS-MPM mechanics prediction parity exceeded tolerance',
          fallback: 'cpu-reference'
        },
        webgpuParity
      });
    }
    return executionFromPrediction(gpuResult, {
      cpuReference,
      gpuResult,
      webgpuStatus: {
        status: 'webgpu-executed',
        reason: 'CPU/WebGPU MLS-MPM mechanics prediction parity passed'
      },
      webgpuParity
    });
  } catch (error) {
    return executionFromPrediction(cpuReference, {
      cpuReference,
      webgpuStatus: {
        status: 'webgpu-error-fallback',
        reason: error instanceof Error ? error.message : String(error),
        fallback: 'cpu-reference'
      }
    });
  }
}
