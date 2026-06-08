import { carrierStepWgsl } from '../../ulg-gpu-abi/src/wgsl.js';
import { createCarrierRuntime } from './carrierRuntime.js';
import { normalizeClosureTableSamples } from './closureHandle.js';
import { computeInvariants, invariantDriftReport } from './invariants.js';

export const ULG_CARRIER_WEBGPU_PARITY_SCHEMA = 'peercompute.ulg.carrier-webgpu-parity.v0';

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

function cloneState(state) {
  return {
    ...state,
    bodies: state.bodies.map((body) => ({ ...body }))
  };
}

function createBodyArray(state) {
  const array = new Float32Array(8);
  for (let index = 0; index < 2; index += 1) {
    const body = state.bodies[index];
    const offset = index * 4;
    array[offset] = finiteNumber(body.x);
    array[offset + 1] = finiteNumber(body.v);
    array[offset + 2] = finiteNumber(body.mass, 1);
    array[offset + 3] = 0;
  }
  return array;
}

function stateFromBodyArray(template, bodyArray, { step, dt }) {
  const state = cloneState(template);
  state.step = step;
  state.time = finiteNumber(template.time) + step * dt;
  for (let index = 0; index < 2; index += 1) {
    const offset = index * 4;
    state.bodies[index] = {
      ...state.bodies[index],
      x: bodyArray[offset],
      v: bodyArray[offset + 1],
      mass: bodyArray[offset + 2]
    };
  }
  return state;
}

function derivativeAtSample(samples, index) {
  if (samples[index].derivative != null) {
    return samples[index].derivative;
  }
  const left = samples[Math.max(0, index - 1)];
  const right = samples[Math.min(samples.length - 1, index + 1)];
  if (right.axis === left.axis) {
    return 0;
  }
  return (right.value - left.value) / (right.axis - left.axis);
}

function normalizeTableSamples(closureArtifact) {
  const table = closureArtifact?.execution?.table || closureArtifact?.table || {};
  const { samples } = normalizeClosureTableSamples(table);
  return samples.map((sample, index) => ({
    r: finiteNumber(sample.axis),
    energy: finiteNumber(sample.value),
    dEdr: finiteNumber(derivativeAtSample(samples, index))
  }));
}

function createSampleArray(samples) {
  const array = new Float32Array(samples.length * 4);
  samples.forEach((sample, index) => {
    const offset = index * 4;
    array[offset] = sample.r;
    array[offset + 1] = sample.energy;
    array[offset + 2] = sample.dEdr;
    array[offset + 3] = 0;
  });
  return array;
}

function createParamsArray({ dt, sampleCount, step }) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setFloat32(0, dt, true);
  view.setUint32(4, sampleCount, true);
  view.setUint32(8, step, true);
  view.setUint32(12, 0, true);
  return buffer;
}

function createDelta({ before, next, closureHandle, dt }) {
  const separation = Math.abs(next.bodies[1].x - next.bodies[0].x);
  const sample = closureHandle.sample({ r: separation });
  return {
    schema: 'peercompute.ulg.carrier-delta.v0',
    step: next.step,
    time: next.time,
    dt,
    integrator: 'velocity-verlet',
    closureId: closureHandle.closureId,
    separation,
    sampledPotentialEnergy: sample.value,
    sampledDerivative: sample.derivatives.dEdr,
    bodies: next.bodies.map((body, index) => ({
      id: body.id,
      x: body.x,
      v: body.v,
      dx: body.x - before.bodies[index].x,
      dv: body.v - before.bodies[index].v
    }))
  };
}

function createParityReport({ cpuResult, gpuResult, tolerance = 1e-4 }) {
  const cpuBodies = cpuResult.finalState.bodies;
  const gpuBodies = gpuResult.finalState.bodies;
  let maxPositionAbs = 0;
  let maxVelocityAbs = 0;
  for (let index = 0; index < cpuBodies.length; index += 1) {
    maxPositionAbs = Math.max(maxPositionAbs, Math.abs(cpuBodies[index].x - gpuBodies[index].x));
    maxVelocityAbs = Math.max(maxVelocityAbs, Math.abs(cpuBodies[index].v - gpuBodies[index].v));
  }
  const passed = maxPositionAbs <= tolerance && maxVelocityAbs <= tolerance;
  return {
    schema: ULG_CARRIER_WEBGPU_PARITY_SCHEMA,
    status: passed ? 'pass' : 'fail',
    tolerance,
    maxPositionAbs,
    maxVelocityAbs,
    cpuBackend: cpuResult.backend,
    gpuBackend: gpuResult.backend,
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

async function requestWebGpuDevice(navigatorRef, { onDeviceLost = null } = {}) {
  if (!navigatorRef?.gpu) {
    return { status: 'blocked-webgpu-unavailable', reason: 'navigator.gpu unavailable', device: null };
  }
  const adapter = await navigatorRef.gpu.requestAdapter();
  if (!adapter) {
    return { status: 'blocked-webgpu-unavailable', reason: 'requestAdapter returned null', device: null };
  }
  const device = await adapter.requestDevice();
  if (device?.lost?.then && typeof onDeviceLost === 'function') {
    device.lost.then((info) => {
      onDeviceLost(info);
    }).catch((error) => {
      onDeviceLost(error);
    });
  }
  return { status: 'webgpu-device-ready', reason: 'device acquired', device };
}

async function runWebGpuCarrierSteps({
  device,
  closureArtifact,
  closureHandle,
  initialState,
  steps,
  dt,
  toleranceProfile
}) {
  const samples = normalizeTableSamples(closureArtifact);
  const bodyByteLength = 8 * Float32Array.BYTES_PER_ELEMENT;
  const sampleArray = createSampleArray(samples);
  const bodyBuffer = device.createBuffer({
    size: bodyByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const sampleBuffer = device.createBuffer({
    size: sampleArray.byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = device.createBuffer({
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = device.createBuffer({
    size: bodyByteLength,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(bodyBuffer, 0, createBodyArray(initialState));
  device.queue.writeBuffer(sampleBuffer, 0, sampleArray);
  const module = device.createShaderModule({ code: carrierStepWgsl });
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' }
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: bodyBuffer } },
      { binding: 1, resource: { buffer: sampleBuffer } },
      { binding: 2, resource: { buffer: paramsBuffer } }
    ]
  });
  let before = cloneState(initialState);
  const deltas = [];
  const invariantSeries = [computeInvariants(before, closureHandle)];
  try {
    for (let step = 1; step <= steps; step += 1) {
      device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({ dt, sampleCount: samples.length, step }));
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(1);
      pass.end();
      encoder.copyBufferToBuffer(bodyBuffer, 0, readBuffer, 0, bodyByteLength);
      device.queue.submit([encoder.finish()]);
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      const mapped = new Float32Array(readBuffer.getMappedRange()).slice();
      readBuffer.unmap();
      const next = stateFromBodyArray(initialState, mapped, { step, dt });
      deltas.push(createDelta({ before, next, closureHandle, dt }));
      invariantSeries.push(computeInvariants(next, closureHandle));
      before = next;
    }
  } finally {
    bodyBuffer.destroy?.();
    sampleBuffer.destroy?.();
    paramsBuffer.destroy?.();
    readBuffer.destroy?.();
  }
  return {
    backend: 'webgpu',
    integrator: 'velocity-verlet',
    dt,
    steps,
    finalState: before,
    deltas,
    invariantSeries,
    invariants: invariantDriftReport(invariantSeries, toleranceProfile)
  };
}

export async function runCarrierRuntimeWithOptionalWebGpu({
  closureArtifact,
  closureHandle,
  initialState,
  steps = 1,
  dt = 0.002,
  toleranceProfile = {},
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  parityTolerance = 1e-4,
  onDeviceLost = null,
  webGpuRunner = runWebGpuCarrierSteps
} = {}) {
  const cpuRuntime = createCarrierRuntime({ closureHandle, dt, toleranceProfile });
  const cpuResult = cpuRuntime.run(initialState, steps);
  if (!preferWebGpu) {
    return {
      ...cpuResult,
      webgpuStatus: { status: 'not-requested', reason: 'WebGPU carrier path not requested' }
    };
  }
  try {
    let lostInfo = null;
    const deviceResult = await requestWebGpuDevice(navigatorRef, {
      onDeviceLost(info) {
        lostInfo = info;
        if (typeof onDeviceLost === 'function') {
          onDeviceLost(info);
        }
      }
    });
    if (!deviceResult.device) {
      return {
        ...cpuResult,
        webgpuStatus: {
          status: deviceResult.status,
          reason: deviceResult.reason,
          fallback: 'cpu-reference'
        }
      };
    }
    await Promise.resolve();
    if (lostInfo) {
      return {
        ...cpuResult,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: lostInfo?.reason || lostInfo?.message || 'device lost',
          fallback: 'cpu-reference'
        }
      };
    }
    const gpuResult = await webGpuRunner({
      device: deviceResult.device,
      closureArtifact,
      closureHandle,
      initialState,
      steps,
      dt,
      toleranceProfile
    });
    await Promise.resolve();
    if (lostInfo) {
      return {
        ...cpuResult,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: lostInfo?.reason || lostInfo?.message || 'device lost',
          fallback: 'cpu-reference'
        }
      };
    }
    const webgpuParity = createParityReport({ cpuResult, gpuResult, tolerance: parityTolerance });
    if (webgpuParity.status !== 'pass') {
      return {
        ...cpuResult,
        webgpuStatus: { status: 'webgpu-parity-failed', reason: 'CPU/WebGPU carrier parity exceeded tolerance' },
        webgpuParity
      };
    }
    return {
      ...gpuResult,
      webgpuStatus: { status: 'webgpu-executed', reason: 'CPU/WebGPU carrier parity passed' },
      webgpuParity
    };
  } catch (error) {
    return {
      ...cpuResult,
      webgpuStatus: {
        status: 'webgpu-error-fallback',
        reason: error instanceof Error ? error.message : String(error),
        fallback: 'cpu-reference'
      }
    };
  }
}
