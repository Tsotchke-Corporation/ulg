import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createSphGpuTimestampProfiler,
  createSphGpuQueueStageRecorder,
  encodeSphGpuTimestampMarkerPass,
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
        getMappedRange: () => new BigUint64Array(descriptor.size / 8).buffer,
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

function stubMarkerEncoder() {
  const descriptors = [];
  let endedPassCount = 0;
  return {
    descriptors,
    get endedPassCount() { return endedPassCount; },
    beginComputePass(descriptor) {
      descriptors.push(descriptor);
      return {
        end() {
          endedPassCount += 1;
        }
      };
    }
  };
}

test('portable marker passes bracket arbitrary commands without encoder.writeTimestamp', () => {
  const querySet = { label: 'timestamp-query-set' };
  const encoder = stubMarkerEncoder();

  const startDescriptor = encodeSphGpuTimestampMarkerPass(encoder, {
    querySet,
    queryIndex: 4,
    boundary: 'start',
    label: 'stage-start'
  });
  const endDescriptor = encodeSphGpuTimestampMarkerPass(encoder, {
    querySet,
    queryIndex: 5,
    boundary: 'end',
    label: 'stage-end'
  });

  assert.equal(encoder.endedPassCount, 2);
  assert.equal(startDescriptor.timestampWrites.querySet, querySet);
  assert.equal(startDescriptor.timestampWrites.endOfPassWriteIndex, 4);
  assert.equal(
    'beginningOfPassWriteIndex' in startDescriptor.timestampWrites,
    false
  );
  assert.equal(endDescriptor.timestampWrites.querySet, querySet);
  assert.equal(endDescriptor.timestampWrites.beginningOfPassWriteIndex, 5);
  assert.equal('endOfPassWriteIndex' in endDescriptor.timestampWrites, false);
});

test('portable marker passes reject incomplete or ambiguous marker contracts', () => {
  const querySet = {};
  assert.throws(
    () => encodeSphGpuTimestampMarkerPass({}, {
      querySet,
      queryIndex: 0,
      boundary: 'start'
    }),
    /beginComputePass/
  );
  assert.throws(
    () => encodeSphGpuTimestampMarkerPass(stubMarkerEncoder(), {
      querySet,
      queryIndex: -1,
      boundary: 'start'
    }),
    /non-negative integer/
  );
  assert.throws(
    () => encodeSphGpuTimestampMarkerPass(stubMarkerEncoder(), {
      querySet,
      queryIndex: 0,
      boundary: 'middle'
    }),
    /boundary/
  );
});

test('the browser probe uses portable marker passes instead of writeTimestamp', async () => {
  const source = await readFile(
    new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /\.\s*writeTimestamp\s*\(/);
  assert.match(source, /empty-compute-pass-timestampWrites/);
  assert.match(source, /encodeSphGpuTimestampMarkerPass/);
});

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

test('the queue-stage recorder satisfies the gpuTimestampRecorder contract', () => {
  // 17 modules and 51 call sites consume this contract and nothing implemented
  // it, so every consumer took its inert branch permanently.
  const recorder = createSphGpuQueueStageRecorder({
    device: { queue: { onSubmittedWorkDone: async () => {} } }
  });
  assert.equal(recorder.active, true);
  assert.equal(typeof recorder.measureQueueStage, 'function');
  assert.equal(typeof recorder.beginEncoderSpan, 'function');
  assert.equal(typeof recorder.endEncoderSpan, 'function');
  assert.equal(typeof recorder.discardEncoderSpans, 'function');
  assert.equal(typeof recorder.stageGpuMs, 'function');
  assert.equal(typeof recorder.stageGpuStats, 'function');
  assert.equal(recorder.recorderKind, 'queue-fence-stage-summary');
  assert.equal(recorder.capabilities.queueStageSummary, true);
  assert.equal(recorder.capabilities.encoderSpans, false);
});

test('measureQueueStage fences around the stage and attributes GPU time', async () => {
  const fences = [];
  const device = { queue: { onSubmittedWorkDone: async () => { fences.push(1); } } };
  const recorder = createSphGpuQueueStageRecorder({ device });
  const result = await recorder.measureQueueStage(
    { stage: 'fusedMechanics', producerId: 'p' },
    async () => 'stage-result'
  );
  assert.equal(result, 'stage-result');
  // One fence before and one after: without the leading fence the measurement
  // would include work already in flight from earlier stages.
  assert.equal(fences.length, 2);
  assert.equal(recorder.spanCount(), 1);
  assert.ok('fusedMechanics' in recorder.stageGpuMs());
});

test('an inert recorder still runs the stage and reports itself inactive', async () => {
  const recorder = createSphGpuQueueStageRecorder({ device: null });
  assert.equal(recorder.active, false);
  assert.equal(await recorder.measureQueueStage({ stage: 's' }, async () => 42), 42);
  assert.equal(recorder.spanCount(), 0);
});

test('encoder spans are inert rather than fabricated', async () => {
  // Current WebGPU has no encoder.writeTimestamp; timestamps come only from
  // timestampWrites on a pass descriptor. Returning null is honest, and every
  // consumer already guards on it.
  const recorder = createSphGpuQueueStageRecorder({
    device: { queue: { onSubmittedWorkDone: async () => {} } }
  });
  assert.equal(recorder.encoderSpansSupported, false);
  assert.equal(recorder.beginEncoderSpan({}, { stage: 'sort' }), null);
});
