import {
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { schroederLevelAssignmentWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';

export {
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA
};

export const SCHROEDER_LEVEL_ASSIGNMENT_FLOATS = SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length;
export const SCHROEDER_LEVEL_ASSIGNMENT_WORKGROUP_SIZE = 64;
export const SCHROEDER_LEVEL_ASSIGNMENT_SCOPE = 'schroeder-gpu-level-assignment';
export const SCHROEDER_NO_FULL_READBACK_MODE = 'no-full-readback';
export const SCHROEDER_FULL_READBACK_MODE = 'full-assignment-readback';

const DEFAULT_MIN_LEVEL = -8;
const DEFAULT_MAX_LEVEL = 8;
const DEFAULT_BASE_GRID_SPACING_M = 1;
const DEFAULT_TARGET_SUPPORT_CELLS = 1.5;
const DEFAULT_SUPPORT_RADIUS_SCALE = 1;
const DEFAULT_HYSTERESIS_BAND = 0.15;

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

function finitePositive(value, fallback) {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
}

function clampInteger(value, min, max) {
  const rounded = Math.round(finiteNumber(value, 0));
  return Math.max(Math.round(min), Math.min(Math.round(max), rounded));
}

function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('Schroeder level assignment requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('Schroeder level assignment requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle counts must match for Schroeder level assignment');
  }
  if (!(sphParticleState.state instanceof Float32Array) || !(sphParticleState.thermo instanceof Float32Array)) {
    throw new TypeError('Schroeder level assignment requires packed Float32Array SPH state and thermo rows');
  }
  if (!(mlsMpmParticleState.mechanics instanceof Float32Array)) {
    throw new TypeError('Schroeder level assignment requires packed Float32Array MLS-MPM mechanics rows');
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

function optionalSourceStateBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
}

function optionalSourceThermoBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
}

function optionalSourceMechanicsBuffer(mlsMpmParticleUpload) {
  return mlsMpmParticleUpload?.status === 'webgpu-uploaded' ? mlsMpmParticleUpload.mechanicsBuffer : null;
}

export function estimateSchroederLevelFromSupportRadius({
  supportRadiusM,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL
} = {}) {
  const supportRadius = finitePositive(supportRadiusM, 0);
  const baseDx = finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M);
  const targetCells = finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS);
  if (!(supportRadius > 0)) {
    return clampInteger(0, minLevel, maxLevel);
  }
  const nativeDx = supportRadius / targetCells;
  const rawLevel = Math.round(Math.log2(Math.max(nativeDx / baseDx, 1e-12)));
  return clampInteger(rawLevel, minLevel, maxLevel);
}

export function estimateSchroederLevelDeltaForVolumeRatio(volumeRatio) {
  const ratio = finitePositive(volumeRatio, 1);
  return Math.round(Math.log2(Math.cbrt(ratio)));
}

export function createSchroederLevelAssignmentParamsArray({
  particleCount = 0,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  chartId = 0,
  minSupportRadiusM = 0,
  maxSupportRadiusM = 0,
  fallbackSupportRadiusM = 0,
  hysteresisBand = DEFAULT_HYSTERESIS_BAND,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setInt32(4, Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)), true);
  view.setInt32(8, Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M), true);
  view.setFloat32(20, finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS), true);
  view.setFloat32(24, Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)), true);
  view.setFloat32(28, finiteNumber(chartId, 0), true);
  view.setFloat32(32, Math.max(0, finiteNumber(minSupportRadiusM, 0)), true);
  view.setFloat32(36, Math.max(0, finiteNumber(maxSupportRadiusM, 0)), true);
  view.setFloat32(40, Math.max(0, finiteNumber(fallbackSupportRadiusM, 0)), true);
  view.setFloat32(44, Math.max(0, finiteNumber(hysteresisBand, DEFAULT_HYSTERESIS_BAND)), true);
  return buffer;
}

export function createSchroederLevelAssignmentPlan({
  sphParticleState,
  mlsMpmParticleState,
  baseGridSpacingM = sphParticleState?.smoothingLengthM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  chartId = 0,
  minSupportRadiusM = 0,
  maxSupportRadiusM = 0,
  fallbackSupportRadiusM = 0,
  hysteresisBand = DEFAULT_HYSTERESIS_BAND
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const particleCount = sphParticleState.particleCount;
  const assignmentByteLength = Math.max(
    4,
    particleCount * SCHROEDER_LEVEL_ASSIGNMENT_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
    status: 'schroeder-level-assignment-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_LEVEL_ASSIGNMENT_SCOPE,
    particleCount,
    minLevel: Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)),
    maxLevel: Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)),
    baseGridSpacingM: finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M),
    targetSupportCells: finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS),
    supportRadiusScale: Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)),
    chartId: finiteNumber(chartId, 0),
    minSupportRadiusM: Math.max(0, finiteNumber(minSupportRadiusM, 0)),
    maxSupportRadiusM: Math.max(0, finiteNumber(maxSupportRadiusM, 0)),
    fallbackSupportRadiusM: Math.max(0, finiteNumber(fallbackSupportRadiusM, 0)),
    hysteresisBand: Math.max(0, finiteNumber(hysteresisBand, DEFAULT_HYSTERESIS_BAND)),
    assignmentRowLayout: [...SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT],
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    assignmentStrideBytes: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    assignmentByteLength,
    sourceStateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    sourceThermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    sourceMechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export async function runSchroederLevelAssignmentWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  baseGridSpacingM = sphParticleState?.smoothingLengthM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  chartId = 0,
  minSupportRadiusM = 0,
  maxSupportRadiusM = 0,
  fallbackSupportRadiusM = 0,
  hysteresisBand = DEFAULT_HYSTERESIS_BAND,
  retainAssignmentBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederLevelAssignmentWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const plan = createSchroederLevelAssignmentPlan({
    sphParticleState,
    mlsMpmParticleState,
    baseGridSpacingM,
    minLevel,
    maxLevel,
    targetSupportCells,
    supportRadiusScale,
    chartId,
    minSupportRadiusM,
    maxSupportRadiusM,
    fallbackSupportRadiusM,
    hysteresisBand
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedStateBuffer = optionalSourceStateBuffer(sphParticleUpload);
  const borrowedThermoBuffer = optionalSourceThermoBuffer(sphParticleUpload);
  const borrowedMechanicsBuffer = optionalSourceMechanicsBuffer(mlsMpmParticleUpload);
  const stateBuffer = borrowedStateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-level-sph-state-in', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-level-sph-thermo-in', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-level-mls-mpm-mechanics-in', mlsMpmParticleState.mechanics);
  const assignmentBuffer = device.createBuffer({
    label: 'ulg-schroeder-level-assignments-out',
    size: plan.assignmentByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-level-assignment-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-level-assignments-readback',
      size: plan.assignmentByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedAssignmentBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederLevelAssignmentParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-level-assignment.v0',
      label: 'ulg-schroeder-level-assignment',
      code: schroederLevelAssignmentWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: mechanicsBuffer } },
        { binding: 3, resource: { buffer: assignmentBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(plan.particleCount / SCHROEDER_LEVEL_ASSIGNMENT_WORKGROUP_SIZE)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(assignmentBuffer, 0, readBuffer, 0, plan.assignmentByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let assignments = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      assignments = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.particleCount * SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
      assignmentSchema: plan.schema,
      status: 'schroeder-level-assignment-submitted',
      backend: 'webgpu',
      kernelScope: SCHROEDER_LEVEL_ASSIGNMENT_SCOPE,
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback ? SCHROEDER_NO_FULL_READBACK_MODE : SCHROEDER_FULL_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedAssignmentBuffer: Boolean(retainAssignmentBuffer),
      assignmentBufferByteLength: plan.assignmentByteLength,
      assignments,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainAssignmentBuffer) {
      result.assignmentBuffer = assignmentBuffer;
      result.destroyAssignmentBuffer = () => assignmentBuffer.destroy?.();
      returnedRetainedAssignmentBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
      if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
      if (!retainAssignmentBuffer || !returnedRetainedAssignmentBuffer) assignmentBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}
