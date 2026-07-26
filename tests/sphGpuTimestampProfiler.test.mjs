import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSphGpuTimestampProfiler,
  SPH_FUSED_SEQUENCE_UNATTRIBUTED_STAGES
} from '../src/runtime/sph/sphGpuTimestampProfiler.js';

function stubDevice({ features = ['timestamp-query'], onCreateQuerySet = null } = {}) {
  const created = { querySets: [], buffers: [] };
  return {
    created,
    features: new Set(features),
    createQuerySet(descriptor) {
      created.querySets.push(descriptor);
      onCreateQuerySet?.(descriptor);
      return { descriptor, destroy() {} };
    },
    createBuffer(descriptor) {
      created.buffers.push(descriptor);
      return {
        descriptor,
        destroy() {},
        mapAsync: async () => {},
        getMappedRange: () => new BigInt64Array(descriptor.size / 8).buffer,
        unmap() {}
      };
    }
  };
}

function stubEncoder() {
  const calls = { resolves: [], copies: [] };
  return {
    calls,
    resolveQuerySet(querySet, first, count, destination, offset) {
      calls.resolves.push({ first, count, offset });
    },
    copyBufferToBuffer(src, srcOffset, dst, dstOffset, size) {
      calls.copies.push({ size });
    }
  };
}

test('profiler is inert and self-describing when the device lacks timestamp-query', () => {
  const profiler = createSphGpuTimestampProfiler({
    device: stubDevice({ features: [] })
  });
  assert.equal(profiler.enabled, false);
  assert.equal(profiler.status, 'gpu-timestamp-profiling-unsupported-by-device');
  assert.equal(profiler.timestampQuerySupported, false);
  // The spreadable form must stay usable so call sites need no conditional.
  assert.deepEqual(profiler.passDescriptorExtras('gridUpdate'), {});
  assert.equal(profiler.passTimestamps('gridUpdate'), null);
  assert.equal(profiler.resolve(stubEncoder()), false);
});

test('profiler is inert when profiling was not requested even on a capable device', () => {
  const profiler = createSphGpuTimestampProfiler({
    device: stubDevice(),
    enabled: false
  });
  assert.equal(profiler.enabled, false);
  assert.equal(profiler.status, 'gpu-timestamp-profiling-not-requested');
  // Capability is still reported truthfully, so a caller can tell "cannot" from
  // "was not asked to".
  assert.equal(profiler.timestampQuerySupported, true);
});

test('profiler allocates one query pair per profiled pass and resolves them all', () => {
  const device = stubDevice();
  const profiler = createSphGpuTimestampProfiler({ device, capacity: 8 });
  assert.equal(profiler.enabled, true);
  assert.equal(device.created.querySets[0].type, 'timestamp');
  assert.equal(device.created.querySets[0].count, 16);

  const first = profiler.passTimestamps('p2gGridProjection');
  const second = profiler.passTimestamps('gridUpdate');
  assert.equal(first.timestampWrites.beginningOfPassWriteIndex, 0);
  assert.equal(first.timestampWrites.endOfPassWriteIndex, 1);
  assert.equal(second.timestampWrites.beginningOfPassWriteIndex, 2);
  assert.equal(second.timestampWrites.endOfPassWriteIndex, 3);

  const encoder = stubEncoder();
  assert.equal(profiler.resolve(encoder), true);
  assert.equal(encoder.calls.resolves[0].count, 4);
  assert.equal(encoder.calls.copies[0].size, 32);
});

test('profiler reports overflow instead of aliasing query slots', () => {
  const profiler = createSphGpuTimestampProfiler({
    device: stubDevice(),
    capacity: 2
  });
  assert.ok(profiler.passTimestamps('a'));
  assert.ok(profiler.passTimestamps('b'));
  // Third pass exceeds capacity. It must decline rather than reuse indices,
  // which would silently attribute one pass's time to another.
  assert.equal(profiler.passTimestamps('c'), null);
  assert.equal(profiler.overflowCount, 1);
  assert.equal(profiler.profiledPassCount, 2);
});

test('reset clears slots so frames do not accumulate', () => {
  const profiler = createSphGpuTimestampProfiler({ device: stubDevice() });
  profiler.passTimestamps('a');
  profiler.passTimestamps('b');
  assert.equal(profiler.profiledPassCount, 2);
  profiler.reset();
  assert.equal(profiler.profiledPassCount, 0);
  assert.equal(profiler.passTimestamps('a').timestampWrites.beginningOfPassWriteIndex, 0);
});

test('an unwritten query pair reports null rather than a fabricated zero', async () => {
  // The stub buffer maps to all-zero timestamps, which is what a device that
  // declined to write the query looks like. Reporting 0 ms would read as "this
  // stage was free"; the profiler must report null instead.
  const profiler = createSphGpuTimestampProfiler({ device: stubDevice() });
  profiler.passTimestamps('gridUpdate');
  const result = await profiler.read();
  assert.equal(result.status, 'gpu-timestamp-profiling-active');
  assert.equal(result.stageGpuMs.gridUpdate, null);
});

test('read on an inert profiler returns its status and no fabricated stage map', async () => {
  const profiler = createSphGpuTimestampProfiler({
    device: stubDevice({ features: [] })
  });
  const result = await profiler.read();
  assert.equal(result.stageGpuMs, null);
  assert.equal(result.status, 'gpu-timestamp-profiling-unsupported-by-device');
});

test('the unattributed stage list names the stages the fused path reports as zero', () => {
  // These are the stages assigned a literal 0 in the resident fused sequence.
  // The list exists so a profiled frame can be checked for actually
  // attributing them instead of accepting the zeros.
  for (const stage of ['p2gGridProjection', 'gridUpdate', 'g2pReconstruction']) {
    assert.ok(
      SPH_FUSED_SEQUENCE_UNATTRIBUTED_STAGES.includes(stage),
      `${stage} should be listed as unattributed in the fused path`
    );
  }
  assert.ok(Object.isFrozen(SPH_FUSED_SEQUENCE_UNATTRIBUTED_STAGES));
});
