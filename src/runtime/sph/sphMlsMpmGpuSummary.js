import {
  MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmResidentSummaryWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS
} from './sphGpuBuffers.js';

export {
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
  mlsMpmResidentSummaryWgsl
};

export const MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS = MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.length;
export const MLS_MPM_GPU_RESIDENT_SUMMARY_ROWS = MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS / 4;

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

const SUMMARY_SCOPE = 'mls-mpm-resident-compact-gpu-summary';

function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM resident summary requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM resident summary requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle counts must match for resident summary');
  }
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

function createSummaryParamsArray({ particleCount, gridNodeCount }) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, gridNodeCount, true);
  return buffer;
}

function outputBufferFromG2p(g2pReconstruction, key) {
  return g2pReconstruction?.gpuResult?.[key] ?? g2pReconstruction?.[key] ?? null;
}

function updatedGridBufferFromGridUpdate(gridUpdate) {
  return gridUpdate?.gpuResult?.updatedGridBuffer ?? gridUpdate?.updatedGridBuffer ?? null;
}

function optionalSourceStateBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
}

function optionalSourceMechanicsBuffer(mlsMpmParticleUpload) {
  return mlsMpmParticleUpload?.status === 'webgpu-uploaded' ? mlsMpmParticleUpload.mechanicsBuffer : null;
}

export function decodeMlsMpmResidentSummaryValues(values, {
  particleCount = values?.[0] ?? 0,
  gridNodeCount = values?.[1] ?? 0,
  readbackMode = 'compact-summary-readback'
} = {}) {
  if (!(values instanceof Float32Array) || values.length < MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS) {
    throw new TypeError('decodeMlsMpmResidentSummaryValues requires a compact resident summary Float32Array');
  }
  const sourceMomentumKgMPerS = [values[6], values[7], values[8]];
  const nextMomentumKgMPerS = [values[9], values[10], values[11]];
  const momentumDeltaKgMPerS = [values[12], values[13], values[14]];
  return {
    schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
    executionSchema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
    backend: 'webgpu',
    status: values[19] > 0 ? 'compact-summary-ready' : 'compact-summary-empty',
    kernelScope: SUMMARY_SCOPE,
    reductionStrategy: 'single-invocation-gpu-loop',
    particleCount,
    gridNodeCount,
    activeGridNodeCount: values[2],
    sourceMassKg: values[3],
    nextMassKg: values[4],
    massDeltaKg: values[5],
    sourceMomentumKgMPerS,
    nextMomentumKgMPerS,
    momentumDeltaKgMPerS,
    maxSpeedMPerS: values[15],
    maxDisplacementM: values[16],
    minVolumeRatioJ: values[17],
    maxVolumeRatioJ: values[18],
    readbackMode,
    compactGpuSummaryAvailable: true,
    fullParticleReadbackPerformed: false,
    fullGridReadbackPerformed: false,
    rowLayout: [...MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT],
    summaryStrideFloats: MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS,
    summaryStrideBytes: MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export async function runMlsMpmResidentSummaryWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  gridUpdate,
  g2pReconstruction
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmResidentSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const particleCount = sphParticleState.particleCount;
  const gridNodeCount = gridUpdate?.gridNodeCount ?? g2pReconstruction?.gridNodeCount ?? 0;
  const nextStateBuffer = outputBufferFromG2p(g2pReconstruction, 'stateBuffer');
  const nextMechanicsBuffer = outputBufferFromG2p(g2pReconstruction, 'mechanicsBuffer');
  const updatedGridBuffer = updatedGridBufferFromGridUpdate(gridUpdate);
  if (!nextStateBuffer || !nextMechanicsBuffer || !updatedGridBuffer) {
    throw new TypeError('MLS-MPM resident summary requires retained G2P state/mechanics and updated-grid buffers');
  }
  const borrowedSourceStateBuffer = optionalSourceStateBuffer(sphParticleUpload);
  const borrowedSourceMechanicsBuffer = optionalSourceMechanicsBuffer(mlsMpmParticleUpload);
  const sourceStateBuffer = borrowedSourceStateBuffer
    || writeStorageBuffer(device, 'ulg-mls-mpm-summary-source-sph-state', sphParticleState.state);
  const sourceMechanicsBuffer = borrowedSourceMechanicsBuffer
    || writeStorageBuffer(device, 'ulg-mls-mpm-summary-source-mechanics', mlsMpmParticleState.mechanics);
  const summaryByteLength = MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const summaryBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-resident-summary-out',
    size: summaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const readBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-resident-summary-readback',
    size: summaryByteLength,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-resident-summary-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSummaryParamsArray({ particleCount, gridNodeCount }));
    const module = device.createShaderModule({ code: mlsMpmResidentSummaryWgsl });
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: sourceStateBuffer } },
        { binding: 1, resource: { buffer: nextStateBuffer } },
        { binding: 2, resource: { buffer: sourceMechanicsBuffer } },
        { binding: 3, resource: { buffer: nextMechanicsBuffer } },
        { binding: 4, resource: { buffer: updatedGridBuffer } },
        { binding: 5, resource: { buffer: summaryBuffer } },
        { binding: 6, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(summaryBuffer, 0, readBuffer, 0, summaryByteLength);
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPU_MAP_MODE.READ);
    const values = new Float32Array(readBuffer.getMappedRange()).slice(0, MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
    readBuffer.unmap();
    return {
      ...decodeMlsMpmResidentSummaryValues(values, {
        particleCount,
        gridNodeCount,
        readbackMode: 'compact-summary-readback'
      }),
      compactReadbackFloatCount: MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS,
      compactReadbackByteLength: summaryByteLength,
      sourceStateBufferMode: borrowedSourceStateBuffer ? 'borrowed-webgpu-upload' : 'temporary-source-upload',
      sourceMechanicsBufferMode: borrowedSourceMechanicsBuffer ? 'borrowed-webgpu-upload' : 'temporary-source-upload',
      sourceStateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
      sourceMechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
    };
  } finally {
    if (!borrowedSourceStateBuffer) sourceStateBuffer.destroy?.();
    if (!borrowedSourceMechanicsBuffer) sourceMechanicsBuffer.destroy?.();
    summaryBuffer.destroy?.();
    readBuffer.destroy?.();
    paramsBuffer.destroy?.();
  }
}
