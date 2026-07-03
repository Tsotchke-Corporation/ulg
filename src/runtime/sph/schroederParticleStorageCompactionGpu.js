import {
  SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_ROW_LAYOUT,
  ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { schroederParticleStorageCompactionWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';

export {
  ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_SCHEMA
};

export const SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_FLOATS =
  SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_ROW_LAYOUT.length;

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

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.round(finiteNumber(value, fallback)));
}

export function createSchroederParticleStorageCompactionPlan({
  scanSlotCount = 0,
  sourceParticleCount = 0,
  outputParticleCapacity = scanSlotCount,
  stateStrideVec4s = SPH_GPU_PARTICLE_STATE_FLOATS / 4,
  thermoStrideVec4s = SPH_GPU_PARTICLE_THERMO_FLOATS / 4,
  mechanicsStrideVec4s = MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS / 4,
  flags = 0
} = {}) {
  const slots = nonNegativeInteger(scanSlotCount, 0);
  const capacity = Math.max(slots, nonNegativeInteger(outputParticleCapacity, slots));
  const stateVec4s = Math.max(1, nonNegativeInteger(stateStrideVec4s, SPH_GPU_PARTICLE_STATE_FLOATS / 4));
  const thermoVec4s = Math.max(1, nonNegativeInteger(thermoStrideVec4s, SPH_GPU_PARTICLE_THERMO_FLOATS / 4));
  const mechanicsVec4s = Math.max(
    1,
    nonNegativeInteger(mechanicsStrideVec4s, MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS / 4)
  );
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_SCHEMA,
    status: 'schroeder-particle-storage-compaction-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-particle-storage-compaction',
    compactionMode: 'order-preserving-live-slot-stream-compaction',
    scanSlotCount: slots,
    sourceParticleCount: nonNegativeInteger(sourceParticleCount, 0),
    outputParticleCapacity: capacity,
    stateStrideVec4s: stateVec4s,
    thermoStrideVec4s: thermoVec4s,
    mechanicsStrideVec4s: mechanicsVec4s,
    stateByteLength: Math.max(16, capacity * stateVec4s * 16),
    thermoByteLength: Math.max(16, capacity * thermoVec4s * 16),
    mechanicsByteLength: Math.max(16, capacity * mechanicsVec4s * 16),
    summaryRowLayout: [...SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_ROW_LAYOUT],
    summaryStrideFloats: SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_FLOATS,
    summaryByteLength: SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    conservedQuantities: ['mass', 'momentum', 'particle-identity-order'],
    flags: nonNegativeInteger(flags, 0),
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederParticleStorageCompactionParamsArray(plan) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, plan.scanSlotCount, true);
  view.setUint32(4, plan.stateStrideVec4s, true);
  view.setUint32(8, plan.thermoStrideVec4s, true);
  view.setUint32(12, plan.mechanicsStrideVec4s, true);
  view.setUint32(16, plan.sourceParticleCount, true);
  view.setUint32(20, plan.flags, true);
  return buffer;
}

export function decodeSchroederParticleStorageCompactionSummaryRow(row) {
  if (!(row instanceof Float32Array) || row.length < SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_FLOATS) {
    return null;
  }
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_SCHEMA,
    scannedSlotCount: row[0],
    liveParticleCount: row[1],
    freedHoleCount: row[2],
    liveMassKg: row[3],
    sourceParticleCount: row[4],
    admittedParticleCountDelta: row[5],
    authoritativeParticleCount: row[11],
    status: row[14],
    flags: row[15]
  };
}

/**
 * Order-preserving GPU stream compaction over an admitted materialized
 * particle range: freed zero-mass holes (from splits and merges) are removed
 * so live particles occupy a dense [0, liveCount) range in freshly created
 * retained output buffers. The result presents the same retained-buffer
 * interface as a materialization execution, so storage adoption can consume
 * it directly with `admittedParticleCountDelta = liveCount - sourceCount`
 * (negative for merges). Only the compact 16-float summary row is read back.
 */
export async function runSchroederParticleStorageCompactionWebGpu({
  device,
  particleStorageMaterialization = null,
  stateBuffer = particleStorageMaterialization?.particleStateBuffer ?? null,
  thermoBuffer = particleStorageMaterialization?.particleThermoBuffer ?? null,
  mechanicsBuffer = particleStorageMaterialization?.particleMechanicsBuffer ?? null,
  scanSlotCount = particleStorageMaterialization?.outputParticleCapacity ?? 0,
  sourceParticleCount = particleStorageMaterialization?.sourceParticleCount ?? 0,
  outputParticleCapacity = particleStorageMaterialization?.outputParticleCapacity ?? scanSlotCount,
  retainParticleBuffers = true,
  flags = 0
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederParticleStorageCompactionWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  if (!stateBuffer || !thermoBuffer || !mechanicsBuffer) {
    throw new TypeError('Schroeder particle-storage compaction requires retained state, thermo, and mechanics buffers');
  }
  const plan = createSchroederParticleStorageCompactionPlan({
    scanSlotCount,
    sourceParticleCount,
    outputParticleCapacity,
    flags
  });
  if (plan.scanSlotCount <= 0) {
    throw new RangeError('Schroeder particle-storage compaction requires a positive scan slot count');
  }
  // WebGPU zero-initializes fresh buffers, so trailing slots past the
  // compacted live range stay empty without an explicit clear pass.
  const outStateBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-compaction-state-out',
    size: plan.stateByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const outThermoBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-compaction-thermo-out',
    size: plan.thermoByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const outMechanicsBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-compaction-mechanics-out',
    size: plan.mechanicsByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const summaryBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-compaction-summary-out',
    size: plan.summaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-compaction-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-compaction-readback',
    size: plan.summaryByteLength,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  let returnedRetainedBuffers = false;
  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederParticleStorageCompactionParamsArray(plan));
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-particle-storage-compaction.v0',
      label: 'ulg-schroeder-particle-storage-compaction',
      code: schroederParticleStorageCompactionWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'storage'),
        computeBufferBinding(4, 'storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'storage'),
        computeBufferBinding(7, 'uniform')
      ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: mechanicsBuffer } },
        { binding: 3, resource: { buffer: outStateBuffer } },
        { binding: 4, resource: { buffer: outThermoBuffer } },
        { binding: 5, resource: { buffer: outMechanicsBuffer } },
        { binding: 6, resource: { buffer: summaryBuffer } },
        { binding: 7, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(summaryBuffer, 0, readBuffer, 0, plan.summaryByteLength);
    device.queue.submit([encoder.finish()]);

    await readBuffer.mapAsync(GPU_MAP_MODE.READ);
    const summaryRow = new Float32Array(readBuffer.getMappedRange()).slice(
      0,
      SCHROEDER_PARTICLE_STORAGE_COMPACTION_SUMMARY_FLOATS
    );
    readBuffer.unmap();
    const compactionSummary = decodeSchroederParticleStorageCompactionSummaryRow(summaryRow);
    const liveParticleCount = nonNegativeInteger(compactionSummary?.liveParticleCount, 0);

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PARTICLE_STORAGE_COMPACTION_EXECUTION_SCHEMA,
      compactionPlanSchema: plan.schema,
      status: 'schroeder-particle-storage-compaction-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: 'compact-compaction-summary-readback',
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: false,
      compactSummaryReadbackPerformed: true,
      summaryRow,
      compactionSummary,
      liveParticleCount,
      admittedParticleCountDelta: liveParticleCount - plan.sourceParticleCount,
      // Adoption-compatible surface: same retained-buffer field names and
      // admission pass-through as a materialization execution result.
      retainedParticleBuffers: Boolean(retainParticleBuffers),
      stateBufferByteLength: plan.stateByteLength,
      thermoBufferByteLength: plan.thermoByteLength,
      mechanicsBufferByteLength: plan.mechanicsByteLength,
      targetStateFamilies: particleStorageMaterialization?.targetStateFamilies
        ? [...particleStorageMaterialization.targetStateFamilies]
        : undefined,
      particleStorageMaterializationAdmissionApproved:
        particleStorageMaterialization?.particleStorageMaterializationAdmissionApproved === true,
      particleStorageMaterializationAdmissionSourceHotBufferKey:
        particleStorageMaterialization?.particleStorageMaterializationAdmissionSourceHotBufferKey ?? null,
      materializationBuffer: particleStorageMaterialization?.materializationBuffer ?? null,
      materializationBufferByteLength:
        particleStorageMaterialization?.materializationBufferByteLength ?? 0,
      conservativeTransferStatus:
        'particle-storage-compaction-submitted-order-preserving-live-range',
      scientificValidation: false,
      fullPhysicsValidation: false
    };
    if (retainParticleBuffers) {
      result.particleStateBuffer = outStateBuffer;
      result.particleThermoBuffer = outThermoBuffer;
      result.particleMechanicsBuffer = outMechanicsBuffer;
      result.destroyParticleBuffers = () => {
        outStateBuffer.destroy?.();
        outThermoBuffer.destroy?.();
        outMechanicsBuffer.destroy?.();
      };
      returnedRetainedBuffers = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!returnedRetainedBuffers) {
        outStateBuffer.destroy?.();
        outThermoBuffer.destroy?.();
        outMechanicsBuffer.destroy?.();
      }
      summaryBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer.destroy?.();
    };
    deferSubmittedWorkCleanup(device, cleanup);
  }
}
