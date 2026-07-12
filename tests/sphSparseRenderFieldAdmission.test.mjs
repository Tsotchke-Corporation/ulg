import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT
} from '../ulg-gpu-abi/src/sparseRenderFieldGpuWgsl.js';
import {
  SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH,
  createSphSparseRenderFieldEvidenceReadbackBuffer,
  decodeSphSparseRenderFieldRuntimeEvidence,
  encodeSphSparseRenderFieldEvidenceCopy,
  mapSphSparseRenderFieldEvidenceReadback
} from '../src/runtime/sph/sphSparseRenderFieldAdmission.js';

const index = Object.fromEntries(
  SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT.map((entry, offset) => [
    entry.split(':', 1)[0],
    offset
  ])
);

function readyEvidence(generationId = 7) {
  const words = new Uint32Array(SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT.length);
  words[index.generationId] = generationId;
  words[index.surfaceCount] = 2;
  words[index.generationPublicationAllowed] = 1;
  words[index.failClosed] = 0;
  words[index.retainPreviousAcceptedGeneration] = 0;
  words[index.status] = 1;
  words[index.retainedByteLengthLow] = 64;
  words[index.allocatedByteLengthLow] = 128;
  return words;
}

test('fixed evidence decoder admits only a matching complete GPU generation', () => {
  const evidence = decodeSphSparseRenderFieldRuntimeEvidence(readyEvidence(), {
    expectedGenerationId: 7
  });
  assert.equal(evidence.admitted, true);
  assert.equal(evidence.failClosed, false);
  assert.equal(evidence.retainedByteLength, 64);
  assert.equal(evidence.allocatedByteLength, 128);
  assert.deepEqual(evidence.reasons, []);
  assert.equal(
    SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH,
    SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT.length * 4
  );
});

test('fixed evidence decoder rejects overflow and stale generations fail closed', () => {
  const overflow = readyEvidence();
  overflow[index.overflowFlags] = 4;
  overflow[index.generationPublicationAllowed] = 0;
  overflow[index.failClosed] = 1;
  overflow[index.retainPreviousAcceptedGeneration] = 1;
  overflow[index.status] = 2;
  const rejected = decodeSphSparseRenderFieldRuntimeEvidence(overflow, {
    expectedGenerationId: 8
  });
  assert.equal(rejected.admitted, false);
  assert.equal(rejected.failClosed, true);
  assert.equal(rejected.retainPreviousAcceptedGeneration, true);
  assert.deepEqual(rejected.reasons, [
    'generation-mismatch',
    'gpu-overflow',
    'publication-not-allowed',
    'gpu-fail-closed',
    'retain-previous-requested',
    'runtime-status-not-ready'
  ]);
});

test('fixed evidence helper encodes one copy and maps only the evidence row', async () => {
  const copies = [];
  const encoder = {
    copyBufferToBuffer(...args) {
      copies.push(args);
    }
  };
  const source = { label: 'evidence' };
  const mappedWords = readyEvidence(12);
  const readback = {
    size: SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH,
    async mapAsync(mode, offset, size) {
      assert.equal(mode, 1);
      assert.equal(offset, 0);
      assert.equal(size, SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH);
    },
    getMappedRange() {
      return mappedWords.buffer;
    },
    unmapCalled: false,
    unmap() {
      this.unmapCalled = true;
    }
  };
  const encoded = encodeSphSparseRenderFieldEvidenceCopy(encoder, {
    evidenceBuffer: source,
    readbackBuffer: readback
  });
  assert.equal(encoded.byteLength, SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH);
  assert.deepEqual(copies[0], [
    source,
    0,
    readback,
    0,
    SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH
  ]);
  const evidence = await mapSphSparseRenderFieldEvidenceReadback(readback, {
    expectedGenerationId: 12
  });
  assert.equal(evidence.admitted, true);
  assert.equal(readback.unmapCalled, true);
});

test('fixed evidence readback allocation is exactly one compact row', () => {
  const allocations = [];
  const device = {
    createBuffer(descriptor) {
      allocations.push(descriptor);
      return descriptor;
    }
  };
  const buffer = createSphSparseRenderFieldEvidenceReadbackBuffer(device);
  assert.equal(buffer.size, SPH_SPARSE_RENDER_FIELD_FIXED_EVIDENCE_BYTE_LENGTH);
  assert.equal(allocations.length, 1);
});
