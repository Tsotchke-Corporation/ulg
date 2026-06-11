import {
  MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  mlsMpmResidentSummaryFinalizeWgsl,
  mlsMpmResidentSummaryPartialsWgsl,
  mlsMpmResidentSummaryWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import { computeBufferBinding, createExplicitComputePipeline } from '../webgpuComputeLayout.js';

export {
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
  mlsMpmResidentSummaryFinalizeWgsl,
  mlsMpmResidentSummaryPartialsWgsl,
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
const SUMMARY_WORKGROUP_SIZE = 64;

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

function createSummaryParamsArray({ particleCount, gridNodeCount, partialCount }) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, gridNodeCount, true);
  view.setUint32(8, partialCount, true);
  return buffer;
}

function outputBufferFromG2p(g2pReconstruction, key) {
  return g2pReconstruction?.gpuResult?.[key] ?? g2pReconstruction?.[key] ?? null;
}

function outputBufferFromStage(stage, key) {
  return stage?.result?.gpuResult?.[key]
    ?? stage?.result?.[key]
    ?? stage?.gpuResult?.[key]
    ?? stage?.[key]
    ?? null;
}

function updatedGridBufferFromGridUpdate(gridUpdate) {
  return gridUpdate?.gpuResult?.updatedGridBuffer ?? gridUpdate?.updatedGridBuffer ?? null;
}

function optionalSourceStateBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
}

function optionalSourceThermoBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
}

function optionalSourceMechanicsBuffer(mlsMpmParticleUpload) {
  return mlsMpmParticleUpload?.status === 'webgpu-uploaded' ? mlsMpmParticleUpload.mechanicsBuffer : null;
}

function sourceThermoArray(sphParticleState) {
  return sphParticleState.thermo instanceof Float32Array
    ? sphParticleState.thermo
    : new Float32Array(sphParticleState.particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS);
}

export function decodeMlsMpmResidentSummaryValues(values, {
  particleCount = values?.[0] ?? 0,
  gridNodeCount = values?.[1] ?? 0,
  readbackMode = 'compact-summary-readback',
  reductionStrategy = 'two-pass-workgroup-reduction'
} = {}) {
  if (!(values instanceof Float32Array) || values.length < MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS) {
    throw new TypeError('decodeMlsMpmResidentSummaryValues requires a compact resident summary Float32Array');
  }
  const sourceMomentumKgMPerS = [values[6], values[7], values[8]];
  const nextMomentumKgMPerS = [values[9], values[10], values[11]];
  const momentumDeltaKgMPerS = [values[12], values[13], values[14]];
  const phaseMassKg = {
    solid: values[20],
    liquid: values[21],
    gas: values[22],
    plasma: values[23]
  };
  return {
    schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
    executionSchema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
    backend: 'webgpu',
    status: values[19] > 0 ? 'compact-summary-ready' : 'compact-summary-empty',
    kernelScope: SUMMARY_SCOPE,
    reductionStrategy,
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
    phaseMassKg,
    temperatureMassWeightedMeanK: values[24],
    minTemperatureK: values[25],
    maxTemperatureK: values[26],
    thermalReadyCount: values[27],
    thermalProblemCount: values[28],
    finiteTemperatureCount: values[29],
    phaseMassTotalKg: values[30],
    thermalSummaryStatus: values[31] > 0 ? 'thermal-phase-summary-ready' : 'thermal-phase-summary-empty',
    thermalPhaseSummaryAvailable: values[31] > 0,
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
  g2pReconstruction,
  thermalStep = null,
  reactionStep = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmResidentSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const particleCount = sphParticleState.particleCount;
  const gridNodeCount = gridUpdate?.gridNodeCount ?? g2pReconstruction?.gridNodeCount ?? 0;
  const partialCount = Math.max(1, Math.ceil(Math.max(particleCount, gridNodeCount) / SUMMARY_WORKGROUP_SIZE));
  const nextStateBuffer = outputBufferFromG2p(g2pReconstruction, 'stateBuffer');
  const nextMechanicsBuffer = outputBufferFromG2p(g2pReconstruction, 'mechanicsBuffer');
  const retainedReactionThermoBuffer = outputBufferFromStage(reactionStep, 'thermoBuffer');
  const retainedThermalThermoBuffer = outputBufferFromStage(thermalStep, 'thermoBuffer');
  const updatedGridBuffer = updatedGridBufferFromGridUpdate(gridUpdate);
  if (!nextStateBuffer || !nextMechanicsBuffer || !updatedGridBuffer) {
    throw new TypeError('MLS-MPM resident summary requires retained G2P state/mechanics and updated-grid buffers');
  }
  const borrowedSourceStateBuffer = optionalSourceStateBuffer(sphParticleUpload);
  const borrowedSourceThermoBuffer = optionalSourceThermoBuffer(sphParticleUpload);
  const borrowedSourceMechanicsBuffer = optionalSourceMechanicsBuffer(mlsMpmParticleUpload);
  const sourceStateBuffer = borrowedSourceStateBuffer
    || writeStorageBuffer(device, 'ulg-mls-mpm-summary-source-sph-state', sphParticleState.state);
  let nextThermoBuffer = retainedReactionThermoBuffer || retainedThermalThermoBuffer || borrowedSourceThermoBuffer || null;
  let nextThermoBufferMode = retainedReactionThermoBuffer
    ? 'retained-reaction-output'
    : (retainedThermalThermoBuffer
      ? 'retained-thermal-output'
      : (borrowedSourceThermoBuffer ? 'borrowed-webgpu-upload' : 'temporary-source-upload'));
  if (!nextThermoBuffer) {
    nextThermoBuffer = writeStorageBuffer(device, 'ulg-mls-mpm-summary-source-sph-thermo', sourceThermoArray(sphParticleState));
    nextThermoBufferMode = 'temporary-source-upload';
  }
  const sourceMechanicsBuffer = borrowedSourceMechanicsBuffer
    || writeStorageBuffer(device, 'ulg-mls-mpm-summary-source-mechanics', mlsMpmParticleState.mechanics);
  const summaryByteLength = MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const partialsByteLength = partialCount * summaryByteLength;
  const partialsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-resident-summary-partials',
    size: Math.max(4, partialsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE
  });
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
    device.queue.writeBuffer(paramsBuffer, 0, createSummaryParamsArray({ particleCount, gridNodeCount, partialCount }));
    const partialsModule = device.createShaderModule({ code: mlsMpmResidentSummaryPartialsWgsl });
    const { pipeline: partialsPipeline, bindGroupLayout: partialsBindGroupLayout } = createExplicitComputePipeline(device, {
      label: 'ulg-mls-mpm-resident-summary-partials',
      module: partialsModule,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'read-only-storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform'),
        computeBufferBinding(7, 'read-only-storage')
      ]
    });
    const partialsBindGroup = device.createBindGroup({
      layout: partialsBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: sourceStateBuffer } },
        { binding: 1, resource: { buffer: nextStateBuffer } },
        { binding: 2, resource: { buffer: sourceMechanicsBuffer } },
        { binding: 3, resource: { buffer: nextMechanicsBuffer } },
        { binding: 4, resource: { buffer: updatedGridBuffer } },
        { binding: 5, resource: { buffer: partialsBuffer } },
        { binding: 6, resource: { buffer: paramsBuffer } },
        { binding: 7, resource: { buffer: nextThermoBuffer } }
      ]
    });
    const finalizeModule = device.createShaderModule({ code: mlsMpmResidentSummaryFinalizeWgsl });
    const { pipeline: finalizePipeline, bindGroupLayout: finalizeBindGroupLayout } = createExplicitComputePipeline(device, {
      label: 'ulg-mls-mpm-resident-summary-finalize',
      module: finalizeModule,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'uniform')
      ]
    });
    const finalizeBindGroup = device.createBindGroup({
      layout: finalizeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: partialsBuffer } },
        { binding: 1, resource: { buffer: summaryBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const partialsPass = encoder.beginComputePass();
    partialsPass.setPipeline(partialsPipeline);
    partialsPass.setBindGroup(0, partialsBindGroup);
    partialsPass.dispatchWorkgroups(partialCount);
    partialsPass.end();
    const finalizePass = encoder.beginComputePass();
    finalizePass.setPipeline(finalizePipeline);
    finalizePass.setBindGroup(0, finalizeBindGroup);
    finalizePass.dispatchWorkgroups(1);
    finalizePass.end();
    encoder.copyBufferToBuffer(summaryBuffer, 0, readBuffer, 0, summaryByteLength);
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPU_MAP_MODE.READ);
    const values = new Float32Array(readBuffer.getMappedRange()).slice(0, MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
    readBuffer.unmap();
    return {
      ...decodeMlsMpmResidentSummaryValues(values, {
        particleCount,
        gridNodeCount,
        readbackMode: 'compact-summary-readback',
        reductionStrategy: 'two-pass-workgroup-reduction'
      }),
      compactReadbackFloatCount: MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS,
      compactReadbackByteLength: summaryByteLength,
      compactPartialSummaryCount: partialCount,
      compactPartialSummaryByteLength: partialsByteLength,
      compactReductionWorkgroupSize: SUMMARY_WORKGROUP_SIZE,
      sourceStateBufferMode: borrowedSourceStateBuffer ? 'borrowed-webgpu-upload' : 'temporary-source-upload',
      thermoBufferMode: nextThermoBufferMode,
      sourceMechanicsBufferMode: borrowedSourceMechanicsBuffer ? 'borrowed-webgpu-upload' : 'temporary-source-upload',
      sourceStateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
      thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
      sourceMechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
    };
  } finally {
    if (!borrowedSourceStateBuffer) sourceStateBuffer.destroy?.();
    if (nextThermoBufferMode === 'temporary-source-upload') nextThermoBuffer.destroy?.();
    if (!borrowedSourceMechanicsBuffer) sourceMechanicsBuffer.destroy?.();
    partialsBuffer.destroy?.();
    summaryBuffer.destroy?.();
    readBuffer.destroy?.();
    paramsBuffer.destroy?.();
  }
}
