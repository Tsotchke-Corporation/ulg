import {
  SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_ROW_LAYOUT,
  SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ROW_LAYOUT,
  ULG_SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { schroederParticleStorageCountSummaryWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import {
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND,
  encodeSchroederParticleStorageResidencyFinalizeWebGpu
} from './schroederParticleStorageResidencyGpu.js';

export {
  ULG_SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_SCHEMA
};

export const SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_FLOATS =
  SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_ROW_LAYOUT.length;
export const SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS =
  SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ROW_LAYOUT.length;

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

export function createSchroederParticleStorageCountSummaryPlan({
  materializationRowCount = 0,
  materializationStrideFloats = SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS,
  sourceParticleCount = 0,
  outputParticleCapacity = sourceParticleCount + materializationRowCount,
  flags = 0
} = {}) {
  const rowCount = Math.max(0, Math.round(finiteNumber(materializationRowCount, 0)));
  const strideFloats = Math.max(
    1,
    Math.round(finiteNumber(materializationStrideFloats, SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS))
  );
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_SCHEMA,
    status: 'schroeder-particle-storage-count-summary-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-particle-storage-count-summary',
    materializationRowCount: rowCount,
    materializationStrideFloats: strideFloats,
    sourceParticleCount: Math.max(0, Math.round(finiteNumber(sourceParticleCount, 0))),
    outputParticleCapacity: Math.max(
      Math.max(0, Math.round(finiteNumber(sourceParticleCount, 0))),
      Math.max(0, Math.round(finiteNumber(outputParticleCapacity, 0)))
    ),
    summaryRowLayout: [...SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_ROW_LAYOUT],
    summaryStrideFloats: SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_FLOATS,
    summaryByteLength: SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    // Append-only until a compaction pass exists: freed source slots are
    // zero-mass holes and never shrink the authoritative count here.
    countPolicy: 'append-only-freed-slots-await-compaction',
    flags: Math.max(0, Math.round(finiteNumber(flags, 0))),
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

/**
 * Encode the materialization count reduction and its GPU-resident adoption
 * evidence into a caller-owned command stream. No queue submit, fence, map,
 * or CPU decode occurs. The returned count is intentionally null: consumers
 * must bind the retained metadata and indirect buffers instead of treating
 * output capacity as a live particle count.
 */
export function encodeSchroederParticleStorageCountSummaryWebGpu({
  device,
  commandEncoder,
  particleStorageMaterialization = null,
  materializationBuffer = particleStorageMaterialization?.materializationBuffer ?? null,
  materializationRows = particleStorageMaterialization?.materializationRows ?? null,
  materializationRowCount = particleStorageMaterialization?.assignmentRowCount ?? 0,
  materializationStrideFloats = particleStorageMaterialization?.materializationStrideFloats
    ?? SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS,
  sourceParticleCount = particleStorageMaterialization?.sourceParticleCount ?? 0,
  outputParticleCapacity = particleStorageMaterialization?.outputParticleCapacity
    ?? sourceParticleCount + materializationRowCount,
  generationId = 0,
  consumerWorkgroupSize = 64,
  flags = 0,
  summaryBuffer: suppliedSummaryBuffer = null,
  residencyMetadataBuffer = null,
  residencyDispatchIndirectBuffer = null,
  label = 'ulg-schroeder-particle-storage-count-summary-resident'
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('Schroeder particle-storage resident count summary requires a WebGPU-like device');
  }
  if (!commandEncoder?.beginComputePass || !commandEncoder?.clearBuffer) {
    throw new TypeError('Schroeder particle-storage resident count summary requires a caller-owned command encoder');
  }
  if (!(Math.round(finiteNumber(generationId, 0)) > 0)) {
    throw new RangeError('Schroeder particle-storage resident count summary requires a positive generation');
  }
  const plan = createSchroederParticleStorageCountSummaryPlan({
    materializationRowCount,
    materializationStrideFloats,
    sourceParticleCount,
    outputParticleCapacity,
    flags
  });
  const borrowedRowsBuffer = materializationBuffer || null;
  const rows = materializationRows instanceof Float32Array ? materializationRows : null;
  if (!borrowedRowsBuffer && !rows) {
    throw new TypeError('Schroeder particle-storage resident count summary requires retained materialization rows');
  }
  let rowsBuffer = borrowedRowsBuffer;
  if (!rowsBuffer) {
    rowsBuffer = device.createBuffer({
      label: `${label}-rows-in`,
      size: Math.max(16, rows.byteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    device.queue.writeBuffer(rowsBuffer, 0, rows);
  }
  const ownsSummaryBuffer = !suppliedSummaryBuffer;
  const summaryBuffer = suppliedSummaryBuffer || device.createBuffer({
    label: `${label}-summary-out`,
    size: plan.summaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = device.createBuffer({
    label: `${label}-params`,
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createSchroederParticleStorageCountSummaryParamsArray(plan));
  commandEncoder.clearBuffer(summaryBuffer);
  const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-particle-storage-count-summary.v0',
    label: 'ulg-schroeder-particle-storage-count-summary',
    code: schroederParticleStorageCountSummaryWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ]
  });
  const bindGroup = device.createBindGroup({
    label: `${label}-bind-group`,
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: rowsBuffer } },
      { binding: 1, resource: { buffer: summaryBuffer } },
      { binding: 2, resource: { buffer: paramsBuffer } }
    ]
  });
  const pass = commandEncoder.beginComputePass({ label: `${label}-pass` });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();

  const residency = encodeSchroederParticleStorageResidencyFinalizeWebGpu({
    device,
    commandEncoder,
    summaryBuffer,
    outputParticleCapacity: plan.outputParticleCapacity,
    summaryKind: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND.count,
    generationId,
    sourceParticleCount: plan.sourceParticleCount,
    consumerWorkgroupSize,
    flags,
    metadataBuffer: residencyMetadataBuffer,
    dispatchIndirectBuffer: residencyDispatchIndirectBuffer,
    label: `${label}-residency`
  });
  let transientReleased = false;
  let retainedReleased = false;
  return {
    ...plan,
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_EXECUTION_SCHEMA,
    countSummarySchema: plan.schema,
    status: 'schroeder-particle-storage-count-summary-encoded-awaiting-submit',
    backend: 'webgpu',
    pipelineCacheStatus: cacheStatus,
    readbackMode: 'gpu-resident-count-metadata-no-readback',
    fullReadbackPerformed: false,
    fullParticleReadbackPerformed: false,
    normalHotLoopReadbackFree: true,
    compactSummaryReadbackPerformed: false,
    mapAsyncCalled: false,
    queueSubmitPerformed: false,
    callerOwnsCommandEncoder: true,
    transientReleaseRequiresCompletedSubmitFence: true,
    summaryBuffer,
    summaryBufferByteLength: plan.summaryByteLength,
    countSummary: null,
    admittedParticleCountDelta: null,
    authoritativeParticleCount: null,
    authoritativeParticleCountAuthority: residency.authoritativeParticleCountAuthority,
    authoritativeParticleCountMetadataWord: residency.authoritativeParticleCountMetadataWord,
    residency,
    particleStorageResidencyMetadataBuffer: residency.metadataBuffer,
    particleStorageResidencyDispatchIndirectBuffer: residency.dispatchIndirectBuffer,
    activeDispatchIndirectByteOffset: residency.activeDispatchIndirectByteOffset,
    selectionDispatchIndirectByteOffset: residency.selectionDispatchIndirectByteOffset,
    conservativeTransferStatus: 'gpu-resident-count-evidence-encoded-no-state-mutation',
    releaseTransientBuffers() {
      if (transientReleased) return;
      transientReleased = true;
      paramsBuffer.destroy?.();
      if (!borrowedRowsBuffer) rowsBuffer.destroy?.();
      residency.releaseTransientBuffers();
    },
    destroyRetainedEvidenceBuffers() {
      if (retainedReleased) return;
      retainedReleased = true;
      if (ownsSummaryBuffer) summaryBuffer.destroy?.();
      residency.destroyRetainedBuffers();
    },
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

export function createSchroederParticleStorageCountSummaryParamsArray(plan) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, plan.materializationRowCount, true);
  view.setUint32(4, plan.materializationStrideFloats, true);
  view.setUint32(8, plan.sourceParticleCount, true);
  view.setUint32(12, plan.flags, true);
  return buffer;
}

export function decodeSchroederParticleStorageCountSummaryRow(row) {
  if (!(row instanceof Float32Array) || row.length < SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_FLOATS) {
    return null;
  }
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_SCHEMA,
    materializationRowCount: row[0],
    admittedRowCount: row[1],
    writtenTargetSlotCount: row[2],
    appendedTargetSlotCount: row[3],
    freedSourceSlotCount: row[4],
    admittedParticleCountDelta: row[5],
    sourceMassKg: row[6],
    targetMassKg: row[7],
    maxMassResidualKg: row[8],
    blockedRowCount: row[9],
    sourceParticleCount: row[10],
    authoritativeParticleCount: row[11],
    status: row[14],
    flags: row[15]
  };
}

/**
 * Reduce admitted particle-storage materialization rows into one compact
 * count-summary row: appended target slots (written at or beyond the source
 * particle count) become the explicit `admittedParticleCountDelta` that
 * storage adoption consumes, and freed source slots are reported without
 * shrinking the count until compaction exists. The single 16-float row is
 * the only readback, per the SS compact-counter allowance.
 */
export async function runSchroederParticleStorageCountSummaryWebGpu({
  device,
  particleStorageMaterialization = null,
  materializationBuffer = particleStorageMaterialization?.materializationBuffer ?? null,
  materializationRows = particleStorageMaterialization?.materializationRows ?? null,
  materializationRowCount = particleStorageMaterialization?.assignmentRowCount ?? 0,
  materializationStrideFloats = particleStorageMaterialization?.materializationStrideFloats
    ?? SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_FLOATS,
  sourceParticleCount = particleStorageMaterialization?.sourceParticleCount ?? 0,
  flags = 0
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederParticleStorageCountSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederParticleStorageCountSummaryPlan({
    materializationRowCount,
    materializationStrideFloats,
    sourceParticleCount,
    flags
  });
  const borrowedRowsBuffer = materializationBuffer || null;
  const rows = materializationRows instanceof Float32Array ? materializationRows : null;
  if (!borrowedRowsBuffer && !rows) {
    throw new TypeError('Schroeder particle-storage count summary requires a retained materialization buffer or explicit rows');
  }
  let rowsBuffer = borrowedRowsBuffer;
  if (!rowsBuffer) {
    rowsBuffer = device.createBuffer({
      label: 'ulg-schroeder-particle-storage-count-summary-rows-in',
      size: Math.max(16, rows.byteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    device.queue.writeBuffer(rowsBuffer, 0, rows);
  }
  const summaryBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-count-summary-out',
    size: plan.summaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-count-summary-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = device.createBuffer({
    label: 'ulg-schroeder-particle-storage-count-summary-readback',
    size: plan.summaryByteLength,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederParticleStorageCountSummaryParamsArray(plan));
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-particle-storage-count-summary.v0',
      label: 'ulg-schroeder-particle-storage-count-summary',
      code: schroederParticleStorageCountSummaryWgsl,
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
        { binding: 0, resource: { buffer: rowsBuffer } },
        { binding: 1, resource: { buffer: summaryBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
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
      SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_FLOATS
    );
    readBuffer.unmap();
    const countSummary = decodeSchroederParticleStorageCountSummaryRow(summaryRow);

    return {
      ...plan,
      schema: ULG_SCHROEDER_PARTICLE_STORAGE_COUNT_SUMMARY_EXECUTION_SCHEMA,
      countSummarySchema: plan.schema,
      status: 'schroeder-particle-storage-count-summary-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: 'compact-count-summary-readback',
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: false,
      compactSummaryReadbackPerformed: true,
      summaryRow,
      countSummary,
      admittedParticleCountDelta: Math.max(0, Math.round(finiteNumber(
        countSummary?.admittedParticleCountDelta,
        0
      ))),
      authoritativeParticleCount: Math.max(0, Math.round(finiteNumber(
        countSummary?.authoritativeParticleCount,
        plan.sourceParticleCount
      ))),
      conservativeTransferStatus: 'count-summary-only-no-state-mutation',
      scientificValidation: false,
      fullPhysicsValidation: false
    };
  } finally {
    const cleanup = () => {
      if (!borrowedRowsBuffer) rowsBuffer.destroy?.();
      summaryBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer.destroy?.();
    };
    deferSubmittedWorkCleanup(device, cleanup);
  }
}
