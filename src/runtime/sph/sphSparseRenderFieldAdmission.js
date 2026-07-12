import {
  SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT
} from '../../../ulg-gpu-abi/src/sparseRenderFieldGpuWgsl.js';

const U32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const GPU_BUFFER_USAGE = globalThis.GPUBufferUsage || {
  MAP_READ: 1,
  COPY_DST: 8
};
const GPU_MAP_MODE = globalThis.GPUMapMode || { READ: 1 };

export const SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH =
  SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT.length * U32_BYTES;

function evidenceKey(layoutEntry) {
  return String(layoutEntry || '').split(':', 1)[0];
}

function asEvidenceWords(value) {
  if (value instanceof Uint32Array) return value;
  if (value instanceof ArrayBuffer) return new Uint32Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint32Array(value.buffer, value.byteOffset, Math.floor(value.byteLength / U32_BYTES));
  }
  throw new TypeError('sparse render-field evidence must be an ArrayBuffer or typed-array view');
}

function u64(low, high) {
  return Number(BigInt(low >>> 0) | (BigInt(high >>> 0) << 32n));
}

export function decodeSphSparseRenderFieldRuntimeEvidence(value, {
  expectedGenerationId = null
} = {}) {
  const words = asEvidenceWords(value);
  const requiredWords = SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT.length;
  if (words.length < requiredWords) {
    throw new RangeError(
      `sparse render-field evidence requires ${requiredWords} u32 words; received ${words.length}`
    );
  }
  const row = Object.fromEntries(
    SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT.map((entry, index) => [
      evidenceKey(entry),
      words[index] >>> 0
    ])
  );
  const generationMatches = expectedGenerationId == null
    || row.generationId === (Number(expectedGenerationId) >>> 0);
  const admitted = generationMatches
    && row.overflowFlags === 0
    && row.generationPublicationAllowed === 1
    && row.failClosed === 0
    && row.retainPreviousAcceptedGeneration === 0
    && row.status === 1;
  const reasons = [];
  if (!generationMatches) reasons.push('generation-mismatch');
  if (row.overflowFlags !== 0) reasons.push('gpu-overflow');
  if (row.generationPublicationAllowed !== 1) reasons.push('publication-not-allowed');
  if (row.failClosed !== 0) reasons.push('gpu-fail-closed');
  if (row.retainPreviousAcceptedGeneration !== 0) reasons.push('retain-previous-requested');
  if (row.status !== 1) reasons.push('runtime-status-not-ready');
  return {
    schema: 'peercompute.ulg.sph-gpu-sparse-render-field-fixed-evidence.v0',
    status: admitted
      ? 'sparse-render-field-fixed-evidence-admitted'
      : 'sparse-render-field-fixed-evidence-rejected',
    admitted,
    generationMatches,
    expectedGenerationId: expectedGenerationId == null
      ? null
      : (Number(expectedGenerationId) >>> 0),
    byteLength: SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH,
    mappedByteLength: SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH,
    row,
    overflowFlags: row.overflowFlags,
    admissionFlags: row.admissionFlags,
    generationPublicationAllowed: admitted,
    failClosed: !admitted,
    retainPreviousAcceptedGeneration: !admitted,
    retainedByteLength: u64(row.retainedByteLengthLow, row.retainedByteLengthHigh),
    allocatedByteLength: u64(row.allocatedByteLengthLow, row.allocatedByteLengthHigh),
    reasons
  };
}

export function createSphSparseRenderFieldEvidenceReadbackBuffer(device, {
  label = 'ulg-sph-sparse-render-field-fixed-evidence-readback'
} = {}) {
  if (!device?.createBuffer) {
    throw new TypeError('fixed sparse render-field evidence readback requires a WebGPU device');
  }
  return device.createBuffer({
    label,
    size: SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
}

export function encodeSphSparseRenderFieldEvidenceCopy(encoder, {
  evidenceBuffer,
  readbackBuffer
} = {}) {
  if (!encoder?.copyBufferToBuffer) {
    throw new TypeError('fixed sparse render-field evidence copy requires a command encoder');
  }
  if (!evidenceBuffer || !readbackBuffer) {
    throw new TypeError('fixed sparse render-field evidence copy requires source and readback buffers');
  }
  encoder.copyBufferToBuffer(
    evidenceBuffer,
    0,
    readbackBuffer,
    0,
    SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH
  );
  return {
    schema: 'peercompute.ulg.sph-gpu-sparse-render-field-evidence-copy.v0',
    status: 'sparse-render-field-fixed-evidence-copy-encoded',
    byteLength: SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH
  };
}

export async function mapSphSparseRenderFieldEvidenceReadback(readbackBuffer, options = {}) {
  if (!readbackBuffer?.mapAsync || !readbackBuffer?.getMappedRange) {
    throw new TypeError('fixed sparse render-field evidence mapping requires a mappable GPUBuffer');
  }
  await readbackBuffer.mapAsync(GPU_MAP_MODE.READ, 0,
    SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH);
  try {
    const mapped = readbackBuffer.getMappedRange(
      0,
      SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH
    );
    return decodeSphSparseRenderFieldRuntimeEvidence(
      new Uint32Array(mapped).slice(),
      options
    );
  } finally {
    readbackBuffer.unmap?.();
  }
}
