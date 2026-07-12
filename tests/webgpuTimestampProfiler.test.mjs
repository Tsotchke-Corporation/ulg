import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEBGPU_TIMESTAMP_PROFILE_MAX_SPANS,
  WEBGPU_TIMESTAMP_QUERY_SET_MAX_QUERIES,
  createWebGpuTimestampProfiler,
  summarizeWebGpuBufferAllocations,
  webGpuTimestampQueryCapability
} from '../src/runtime/webgpuTimestampProfiler.js';

function fakeTimestampDevice() {
  const destroyed = [];
  const querySets = [];
  const device = {
    features: new Set(['timestamp-query']),
    createQuerySet({ label, count }) {
      const querySet = {
        label,
        count,
        values: new BigUint64Array(count),
        destroy() {
          destroyed.push(label);
        }
      };
      querySets.push(querySet);
      return querySet;
    },
    createBuffer({ label, size }) {
      return {
        label,
        size,
        data: new ArrayBuffer(size),
        async mapAsync() {},
        getMappedRange(offset = 0, byteLength = size) {
          return this.data.slice(offset, offset + byteLength);
        },
        unmap() {},
        destroy() {
          destroyed.push(label);
        }
      };
    }
  };
  return { device, destroyed, querySets };
}

test('timestamp profiler reports explicit unsupported evidence without CPU substitution', async () => {
  const device = { features: new Set() };
  const capability = webGpuTimestampQueryCapability(device, { requested: true });
  const profiler = createWebGpuTimestampProfiler(device, {
    requested: true,
    label: 'unsupported-test'
  });

  assert.equal(capability.status, 'unsupported');
  assert.equal(profiler.active, false);
  assert.deepEqual(profiler.beginComputePassDescriptor('p2g'), { label: 'p2g' });
  assert.equal((await profiler.read()).status, 'unsupported');
  assert.equal((await profiler.read()).mapAsyncWaitMs, null);
});

test('timestamp profiler resolves nanosecond pass spans and stage aggregates', async () => {
  const { device, destroyed } = fakeTimestampDevice();
  const profiler = createWebGpuTimestampProfiler(device, {
    requested: true,
    label: 'resident-sequence',
    maxSpans: 2
  });
  const p2g = profiler.beginComputePassDescriptor('p2g', { substepIndex: 0 });
  const grid = profiler.beginComputePassDescriptor('gridUpdate', { substepIndex: 0 });
  const overflow = profiler.beginComputePassDescriptor('g2p', { substepIndex: 0 });
  p2g.timestampWrites.querySet.values[p2g.timestampWrites.beginningOfPassWriteIndex] = 1_000_000n;
  p2g.timestampWrites.querySet.values[p2g.timestampWrites.endOfPassWriteIndex] = 2_500_000n;
  grid.timestampWrites.querySet.values[grid.timestampWrites.beginningOfPassWriteIndex] = 3_000_000n;
  grid.timestampWrites.querySet.values[grid.timestampWrites.endOfPassWriteIndex] = 7_000_000n;

  const encoder = {
    resolveQuerySet(querySet, firstQuery, queryCount, destination, destinationOffset) {
      const bytes = new Uint8Array(
        querySet.values.buffer,
        firstQuery * BigUint64Array.BYTES_PER_ELEMENT,
        queryCount * BigUint64Array.BYTES_PER_ELEMENT
      );
      new Uint8Array(destination.data).set(bytes, destinationOffset);
    },
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, byteLength) {
      new Uint8Array(destination.data).set(
        new Uint8Array(source.data, sourceOffset, byteLength),
        destinationOffset
      );
    }
  };
  assert.equal(profiler.encodeResolve(encoder), true);
  const profile = await profiler.read();

  assert.equal(profiler.active, true);
  assert.deepEqual(overflow, { label: 'g2p' });
  assert.equal(profile.status, 'timestamp-profile-partial');
  assert.equal(profile.reason, 'timestamp query capacity was exceeded');
  assert.equal(profile.timestampUnit, 'nanoseconds');
  assert.equal(profile.spanCount, 2);
  assert.equal(profile.skippedSpanCount, 1);
  assert.equal(profile.stageTotals.p2g.totalMs, 1.5);
  assert.equal(profile.stageTotals.gridUpdate.totalMs, 4);
  assert.equal(profile.mappedByteLength, 32);
  assert.deepEqual(
    destroyed.sort(),
    [
      'resident-sequence-timestamp-queries',
      'resident-sequence-timestamp-readback',
      'resident-sequence-timestamp-resolve'
    ].sort()
  );
});

test('timestamp profiler accepts quantized zero-duration spans but rejects reset pairs', async () => {
  const { device } = fakeTimestampDevice();
  const profiler = createWebGpuTimestampProfiler(device, {
    requested: true,
    label: 'quantized-pass-test',
    maxSpans: 2
  });
  const quantized = profiler.beginComputePassDescriptor('quantized');
  const reset = profiler.beginComputePassDescriptor('reset');
  quantized.timestampWrites.querySet.values[quantized.timestampWrites.beginningOfPassWriteIndex] = 8_000n;
  quantized.timestampWrites.querySet.values[quantized.timestampWrites.endOfPassWriteIndex] = 8_000n;

  const encoder = {
    resolveQuerySet(querySet, firstQuery, queryCount, destination, destinationOffset) {
      const bytes = new Uint8Array(
        querySet.values.buffer,
        firstQuery * BigUint64Array.BYTES_PER_ELEMENT,
        queryCount * BigUint64Array.BYTES_PER_ELEMENT
      );
      new Uint8Array(destination.data).set(bytes, destinationOffset);
    },
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, byteLength) {
      new Uint8Array(destination.data).set(
        new Uint8Array(source.data, sourceOffset, byteLength),
        destinationOffset
      );
    }
  };
  assert.equal(profiler.encodeResolve(encoder), true);
  const profile = await profiler.read();

  assert.equal(profile.status, 'timestamp-profile-partial');
  assert.equal(profile.validSpanCount, 1);
  assert.equal(profile.invalidSpanCount, 1);
  assert.equal(profile.spans[0].valid, true);
  assert.equal(profile.spans[0].durationNs, 0);
  assert.equal(profile.spans[1].valid, false);
  assert.equal(profile.spans[1].durationNs, null);
  assert.equal(profile.stageTotals.quantized.totalNs, 0);
  assert.equal(profile.stageTotals.quantized.validSpanCount, 1);
  assert.equal(reset.label, 'reset');
});

test('timestamp profiler caps two-query spans at the WebGPU query-set maximum', async () => {
  const { device, querySets } = fakeTimestampDevice();
  const profiler = createWebGpuTimestampProfiler(device, {
    requested: true,
    label: 'spec-query-limit',
    maxSpans: WEBGPU_TIMESTAMP_QUERY_SET_MAX_QUERIES
  });

  assert.equal(WEBGPU_TIMESTAMP_PROFILE_MAX_SPANS, 2048);
  assert.equal(querySets.length, 1);
  assert.equal(querySets[0].count, WEBGPU_TIMESTAMP_QUERY_SET_MAX_QUERIES);
  for (let index = 0; index < WEBGPU_TIMESTAMP_PROFILE_MAX_SPANS; index += 1) {
    assert.ok(profiler.beginComputePassDescriptor(`span-${index}`).timestampWrites);
  }
  assert.deepEqual(
    profiler.beginComputePassDescriptor('overflow'),
    { label: 'overflow' }
  );
  profiler.destroy();
});

test('allocation evidence separates owned allocations from borrowed resident buffers', () => {
  const evidence = summarizeWebGpuBufferAllocations([
    {
      role: 'output',
      buffer: { label: 'output', size: 128 },
      owned: true,
      lifetime: 'transient-submission'
    },
    {
      role: 'workspace',
      buffer: { label: 'workspace', size: 512 },
      owned: true,
      lifetime: 'persistent-workspace',
      createdThisSubmission: false
    },
    { role: 'source', buffer: { label: 'source', size: 256 }, owned: false },
    { role: 'unknown', buffer: { label: 'unknown' }, owned: true }
  ], { scope: 'test-pass' });

  assert.equal(evidence.scope, 'test-pass');
  assert.equal(evidence.bufferCount, 4);
  assert.equal(evidence.allocatedByteLength, 640);
  assert.equal(evidence.createdThisSubmissionBufferCount, 2);
  assert.equal(evidence.createdThisSubmissionByteLength, 128);
  assert.equal(evidence.persistentWorkspaceBufferCount, 1);
  assert.equal(evidence.persistentWorkspaceByteLength, 512);
  assert.equal(evidence.transientSubmissionBufferCount, 2);
  assert.equal(evidence.transientSubmissionByteLength, 128);
  assert.equal(evidence.borrowedByteLength, 256);
  assert.equal(evidence.unknownByteLengthBufferCount, 1);
});
