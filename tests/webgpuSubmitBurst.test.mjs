import test from 'node:test';
import assert from 'node:assert/strict';
import {
  armWorkerQueueSubmitBurst,
  openWorkerQueueSubmitBurst,
  flushWorkerQueueSubmitBurst,
  closeWorkerQueueSubmitBurst,
  workerQueueSubmitBurstStats,
  withWorkerQueueSubmitBurstWriteThrough,
  deferSubmittedWorkCleanup
} from '../src/runtime/webgpuComputeLayout.js';

function createFakeDevice({ commandEncoder = true } = {}) {
  const ops = [];
  let bufferOrdinal = 0;
  const device = {
    queue: {
      submit(commandBuffers) {
        ops.push({ op: 'submit', commandBuffers: [...commandBuffers] });
      },
      writeBuffer(buffer, offset, data) {
        ops.push({ op: 'writeBuffer', buffer, offset, data });
      },
      onSubmittedWorkDone() {
        ops.push({ op: 'fence' });
        return Promise.resolve();
      }
    },
    createBuffer(descriptor) {
      bufferOrdinal += 1;
      let mapped = descriptor?.mappedAtCreation
        ? new ArrayBuffer(descriptor.size)
        : null;
      const buffer = {
        label: descriptor?.label ?? `buffer-${bufferOrdinal}`,
        getMappedRange() {
          return mapped;
        },
        unmap() {
          mapped = null;
        },
        destroy() {
          ops.push({ op: 'destroy', buffer });
        }
      };
      return buffer;
    }
  };
  if (commandEncoder) {
    device.createCommandEncoder = (descriptor) => {
      const copies = [];
      return {
        copyBufferToBuffer(source, sourceOffset, target, targetOffset, size) {
          copies.push({ source, sourceOffset, target, targetOffset, size });
        },
        finish() {
          return { label: descriptor?.label ?? 'encoder', copies };
        }
      };
    };
  }
  return { device, ops };
}

test('held submits flush as one submit in original order', () => {
  const { device, ops } = createFakeDevice();
  openWorkerQueueSubmitBurst(device, { label: 'test' });
  device.queue.submit(['a']);
  device.queue.submit(['b', 'c']);
  assert.equal(ops.length, 0, 'submits are held while the burst is open');
  flushWorkerQueueSubmitBurst(device, 'step-cadence');
  assert.deepEqual(ops, [{ op: 'submit', commandBuffers: ['a', 'b', 'c'] }]);
  const stats = closeWorkerQueueSubmitBurst(device);
  assert.equal(stats.heldSubmitTotal, 2);
  assert.equal(stats.flushCount, 1);
  assert.equal(stats.cadenceFlushCount, 1);
});

test('writeBuffer to a fresh buffer passes through without flushing', () => {
  const { device, ops } = createFakeDevice();
  armWorkerQueueSubmitBurst(device);
  openWorkerQueueSubmitBurst(device);
  device.queue.submit(['held']);
  const fresh = device.createBuffer({ label: 'fresh-uniform' });
  device.queue.writeBuffer(fresh, 0, 'data');
  assert.deepEqual(ops, [{ op: 'writeBuffer', buffer: fresh, offset: 0, data: 'data' }]);
  closeWorkerQueueSubmitBurst(device);
  assert.deepEqual(ops[1], { op: 'submit', commandBuffers: ['held'] });
});

test('non-copyable stale write to a buffer predating the held submit flushes first', () => {
  const { device, ops } = createFakeDevice({ commandEncoder: false });
  armWorkerQueueSubmitBurst(device);
  const stale = device.createBuffer({ label: 'persistent' });
  openWorkerQueueSubmitBurst(device);
  device.queue.submit(['held']);
  device.queue.writeBuffer(stale, 0, 'update');
  assert.deepEqual(ops, [
    { op: 'submit', commandBuffers: ['held'] },
    { op: 'writeBuffer', buffer: stale, offset: 0, data: 'update' }
  ]);
  const stats = workerQueueSubmitBurstStats(device);
  assert.equal(stats.staleWriteFlushCount, 1);
  closeWorkerQueueSubmitBurst(device);
});

test('typed-array stale write becomes a held write-through copy when opted in', () => {
  const { device, ops } = createFakeDevice();
  armWorkerQueueSubmitBurst(device);
  const stale = device.createBuffer({ label: 'arena-params' });
  openWorkerQueueSubmitBurst(device, { writeThrough: true });
  device.queue.submit(['held']);
  const payload = new Float32Array([1, 2, 3, 4]);
  device.queue.writeBuffer(stale, 16, payload);
  assert.equal(ops.length, 0, 'no flush and no direct write while holding');
  const stats = workerQueueSubmitBurstStats(device);
  assert.equal(stats.writeThroughCount, 1);
  assert.equal(stats.staleWriteFlushCount, 0);
  assert.deepEqual(stats.writeThroughLabels, { 'arena-params': 1 });
  closeWorkerQueueSubmitBurst(device);
  assert.equal(ops[0].op, 'submit');
  assert.equal(ops[0].commandBuffers.length, 2, 'held work plus the copy in one submit');
  const copyCommandBuffer = ops[0].commandBuffers[1];
  assert.equal(copyCommandBuffer.copies.length, 1);
  const copy = copyCommandBuffer.copies[0];
  assert.equal(copy.target, stale);
  assert.equal(copy.targetOffset, 16);
  assert.equal(copy.size, 16);
  assert.equal(copy.source.label, 'ulg-submit-burst-write-through-staging');
});

test('owned write-through scope submits final proxy commands in one ordered batch without a fence', async () => {
  const { device, ops } = createFakeDevice();
  armWorkerQueueSubmitBurst(device);
  const levelParams = device.createBuffer({ label: 'level-params' });
  const activeParams = device.createBuffer({ label: 'active-params' });

  const result = await withWorkerQueueSubmitBurstWriteThrough(
    device,
    async () => {
      device.queue.writeBuffer(levelParams, 0, new Uint32Array([1]));
      device.queue.submit(['final-level-assignment']);
      device.queue.writeBuffer(activeParams, 0, new Uint32Array([2]));
      device.queue.submit(['final-active-node-list']);
      return 'complete';
    },
    {
      label: 'final-render-proxy-test',
      flushReason: 'final-render-proxy-test'
    }
  );

  assert.equal(result, 'complete');
  const submitIndex = ops.findIndex((entry) => entry.op === 'submit');
  const destroyIndex = ops.findIndex((entry) => entry.op === 'destroy');
  assert.ok(submitIndex >= 0);
  assert.ok(destroyIndex > submitIndex, 'staging retires only after real submit');
  assert.deepEqual(
    ops[submitIndex].commandBuffers.map((commandBuffer) => (
      typeof commandBuffer === 'string' ? commandBuffer : commandBuffer.label
    )),
    [
      'final-level-assignment',
      'ulg-submit-burst-write-through',
      'final-active-node-list'
    ]
  );
  assert.equal(
    ops.some((entry) => entry.op === 'fence'),
    false,
    'one-use staging retirement must not manufacture a host fence'
  );
  const stats = workerQueueSubmitBurstStats(device);
  assert.equal(stats.open, false);
  assert.equal(stats.openCount, 1);
  assert.equal(stats.heldSubmitTotal, 2);
  assert.equal(stats.flushCount, 1);
  assert.equal(stats.flushSubmitCount, 3);
  assert.equal(stats.writeThroughCount, 1);
  assert.equal(stats.staleWriteFlushCount, 0);
  assert.equal(stats.postSubmitCleanupTotal, 1);
  assert.equal(stats.immediateDestroyTotal, 1);
});

test('owned write-through scope reports an order-preserving two-submit fallback', async () => {
  const { device, ops } = createFakeDevice({ commandEncoder: false });
  armWorkerQueueSubmitBurst(device);
  const activeParams = device.createBuffer({ label: 'active-params' });

  await withWorkerQueueSubmitBurstWriteThrough(device, async () => {
    device.queue.submit(['final-level-assignment']);
    device.queue.writeBuffer(activeParams, 0, new Uint32Array([2]));
    device.queue.submit(['final-active-node-list']);
  });

  assert.deepEqual(ops.map((entry) => entry.op), [
    'submit',
    'writeBuffer',
    'submit'
  ]);
  const stats = workerQueueSubmitBurstStats(device);
  assert.equal(stats.open, false);
  assert.equal(stats.flushCount, 2);
  assert.equal(stats.flushSubmitCount, 2);
  assert.equal(stats.heldSubmitTotal, 2);
  assert.equal(stats.writeThroughCount, 0);
  assert.equal(stats.staleWriteFlushCount, 1);
});

test('failed write-through encoding destroys its allocated staging buffer before fallback', async () => {
  const { device, ops } = createFakeDevice();
  const createEncoder = device.createCommandEncoder;
  device.createCommandEncoder = (descriptor) => {
    if (descriptor?.label === 'ulg-submit-burst-write-through') {
      return {
        copyBufferToBuffer() {},
        finish() {
          throw new Error('staging encoder failed');
        }
      };
    }
    return createEncoder(descriptor);
  };
  armWorkerQueueSubmitBurst(device);
  const activeParams = device.createBuffer({ label: 'active-params' });

  await withWorkerQueueSubmitBurstWriteThrough(device, async () => {
    device.queue.submit(['final-level-assignment']);
    device.queue.writeBuffer(activeParams, 0, new Uint32Array([2]));
    device.queue.submit(['final-active-node-list']);
  });

  const stagingDestroy = ops.find((entry) => (
    entry.op === 'destroy'
    && entry.buffer?.label === 'ulg-submit-burst-write-through-staging'
  ));
  assert.ok(stagingDestroy, 'failed staging allocation is not leaked');
  assert.equal(workerQueueSubmitBurstStats(device).staleWriteFlushCount, 1);
});

test('real submit failure retires staging, closes the scope, and preserves the boundary error', async () => {
  const { device, ops } = createFakeDevice();
  const expected = new Error('real submit rejected');
  device.queue.submit = () => {
    ops.push({ op: 'submit-attempt' });
    throw expected;
  };
  armWorkerQueueSubmitBurst(device);
  const activeParams = device.createBuffer({ label: 'active-params' });

  await assert.rejects(
    withWorkerQueueSubmitBurstWriteThrough(device, async () => {
      device.queue.submit(['final-level-assignment']);
      device.queue.writeBuffer(activeParams, 0, new Uint32Array([2]));
      device.queue.submit(['final-active-node-list']);
    }),
    (error) => error === expected
  );
  const submitIndex = ops.findIndex((entry) => entry.op === 'submit-attempt');
  const destroyIndex = ops.findIndex((entry) => (
    entry.op === 'destroy'
    && entry.buffer?.label === 'ulg-submit-burst-write-through-staging'
  ));
  assert.ok(destroyIndex > submitIndex);
  assert.equal(workerQueueSubmitBurstStats(device).open, false);
  assert.equal(ops.some((entry) => entry.op === 'fence'), false);
});

test('runner error remains primary when the write-through boundary also fails', async () => {
  const { device } = createFakeDevice();
  const boundaryError = new Error('boundary failed');
  device.queue.submit = () => {
    throw boundaryError;
  };
  armWorkerQueueSubmitBurst(device);
  const runnerError = new Error('runner failed');
  runnerError.code = 'ERR_RUNNER_PRIMARY';

  await assert.rejects(
    withWorkerQueueSubmitBurstWriteThrough(device, async () => {
      device.queue.submit(['held-before-runner-failure']);
      throw runnerError;
    }),
    (error) => (
      error === runnerError
      && error.code === 'ERR_RUNNER_PRIMARY'
      && error.submitBurstBoundaryError === boundaryError
    )
  );
  assert.equal(workerQueueSubmitBurstStats(device).open, false);
});

test('borrowed write-through scope flushes its boundary and restores the outer burst mode', async () => {
  const { device, ops } = createFakeDevice();
  armWorkerQueueSubmitBurst(device);
  const levelParams = device.createBuffer({ label: 'level-params' });
  const activeParams = device.createBuffer({ label: 'active-params' });
  openWorkerQueueSubmitBurst(device, { label: 'outer-schedule' });
  device.queue.submit(['prior-held-work']);

  await withWorkerQueueSubmitBurstWriteThrough(device, async () => {
    device.queue.writeBuffer(levelParams, 0, new Uint32Array([1]));
    device.queue.submit(['final-level-assignment']);
    device.queue.writeBuffer(activeParams, 0, new Uint32Array([2]));
    device.queue.submit(['final-active-node-list']);
  });

  let stats = workerQueueSubmitBurstStats(device);
  assert.equal(stats.open, true, 'the schedule-owned burst remains open');
  assert.equal(stats.openCount, 1, 'borrowing does not claim another open');
  assert.equal(stats.flushCount, 1, 'the result cannot escape while held');
  assert.equal(stats.writeThroughCount, 2);
  assert.equal(stats.staleWriteFlushCount, 0);
  assert.equal(ops.filter((entry) => entry.op === 'submit').length, 1);

  device.queue.submit(['post-scope-held-work']);
  device.queue.writeBuffer(activeParams, 0, new Uint32Array([3]));
  stats = workerQueueSubmitBurstStats(device);
  assert.equal(
    stats.staleWriteFlushCount,
    1,
    'the outer burst regains its original non-write-through behavior'
  );
  assert.equal(stats.open, true);
  closeWorkerQueueSubmitBurst(device);
  assert.equal(ops.some((entry) => entry.op === 'fence'), false);
});

test('borrowed write-through scope flushes and restores after its runner rejects', async () => {
  const { device } = createFakeDevice();
  armWorkerQueueSubmitBurst(device);
  const stale = device.createBuffer({ label: 'persistent' });
  openWorkerQueueSubmitBurst(device, { label: 'outer-schedule' });
  const expected = new Error('scope runner failed');

  await assert.rejects(
    withWorkerQueueSubmitBurstWriteThrough(device, async () => {
      device.queue.submit(['held-before-failure']);
      throw expected;
    }),
    (error) => error === expected
  );
  assert.equal(workerQueueSubmitBurstStats(device).open, true);
  device.queue.submit(['held-after-failure']);
  device.queue.writeBuffer(stale, 0, new Uint32Array([1]));
  assert.equal(workerQueueSubmitBurstStats(device).staleWriteFlushCount, 1);
  closeWorkerQueueSubmitBurst(device);
});

test('a fence request flushes held work before the real fence starts', () => {
  const { device, ops } = createFakeDevice();
  openWorkerQueueSubmitBurst(device);
  device.queue.submit(['held']);
  device.queue.onSubmittedWorkDone();
  assert.deepEqual(ops, [
    { op: 'submit', commandBuffers: ['held'] },
    { op: 'fence' }
  ]);
  assert.equal(workerQueueSubmitBurstStats(device).fenceFlushCount, 1);
  closeWorkerQueueSubmitBurst(device);
});

test('destroy of a possibly-referenced buffer defers to after the flush', async () => {
  const { device, ops } = createFakeDevice();
  armWorkerQueueSubmitBurst(device);
  const input = device.createBuffer({ label: 'prior-step-state' });
  openWorkerQueueSubmitBurst(device);
  device.queue.submit(['reads-input']);
  input.destroy();
  assert.equal(ops.length, 0, 'destroy is parked while its consumer is held');
  closeWorkerQueueSubmitBurst(device);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(ops[0], { op: 'submit', commandBuffers: ['reads-input'] });
  assert.ok(
    ops.some((entry) => entry.op === 'destroy' && entry.buffer === input),
    'the parked destroy runs after the flush'
  );
  const fenceIndex = ops.findIndex((entry) => entry.op === 'fence');
  const destroyIndex = ops.findIndex((entry) => entry.op === 'destroy');
  assert.ok(fenceIndex >= 0 && fenceIndex < destroyIndex, 'destroy waits on a real fence');
});

test('destroy of a buffer created after the last held submit runs immediately', () => {
  const { device, ops } = createFakeDevice();
  armWorkerQueueSubmitBurst(device);
  openWorkerQueueSubmitBurst(device);
  device.queue.submit(['held']);
  const scratch = device.createBuffer({ label: 'post-submit-scratch' });
  scratch.destroy();
  assert.deepEqual(ops, [{ op: 'destroy', buffer: scratch }]);
  closeWorkerQueueSubmitBurst(device);
});

test('deferSubmittedWorkCleanup parks cleanups on the open burst', async () => {
  const { device, ops } = createFakeDevice();
  openWorkerQueueSubmitBurst(device);
  device.queue.submit(['held']);
  const ran = [];
  deferSubmittedWorkCleanup(device, () => ran.push('cleanup'));
  assert.equal(ran.length, 0);
  closeWorkerQueueSubmitBurst(device);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(ran, ['cleanup']);
  assert.equal(ops[0].op, 'submit');
});

test('close flushes, reports stats, and restores direct submits', () => {
  const { device, ops } = createFakeDevice();
  openWorkerQueueSubmitBurst(device);
  device.queue.submit(['held']);
  const stats = closeWorkerQueueSubmitBurst(device);
  assert.equal(stats.heldSubmitTotal, 1);
  device.queue.submit(['direct']);
  assert.deepEqual(ops, [
    { op: 'submit', commandBuffers: ['held'] },
    { op: 'submit', commandBuffers: ['direct'] }
  ]);
  assert.equal(workerQueueSubmitBurstStats(device).directSubmitTotal, 1);
});

test('stats snapshots own their label maps across later queue work', () => {
  const { device } = createFakeDevice();
  armWorkerQueueSubmitBurst(device);
  const persistent = device.createBuffer({ label: 'persistent' });

  openWorkerQueueSubmitBurst(device);
  device.queue.submit(['stale-before-snapshot']);
  device.queue.writeBuffer(persistent, 0, new Uint32Array([1]));
  closeWorkerQueueSubmitBurst(device);

  openWorkerQueueSubmitBurst(device, { writeThrough: true });
  device.queue.submit(['write-through-before-snapshot']);
  device.queue.writeBuffer(persistent, 0, new Uint32Array([2]));
  const liveSnapshot = workerQueueSubmitBurstStats(device);
  const closeSnapshot = closeWorkerQueueSubmitBurst(device);

  assert.deepEqual(liveSnapshot.staleWriteFlushLabels, { persistent: 1 });
  assert.deepEqual(liveSnapshot.writeThroughLabels, { persistent: 1 });
  assert.deepEqual(closeSnapshot.staleWriteFlushLabels, { persistent: 1 });
  assert.deepEqual(closeSnapshot.writeThroughLabels, { persistent: 1 });
  assert.notStrictEqual(
    liveSnapshot.staleWriteFlushLabels,
    closeSnapshot.staleWriteFlushLabels
  );
  assert.notStrictEqual(
    liveSnapshot.writeThroughLabels,
    closeSnapshot.writeThroughLabels
  );

  openWorkerQueueSubmitBurst(device);
  device.queue.submit(['stale-after-snapshot']);
  device.queue.writeBuffer(persistent, 0, new Uint32Array([3]));
  closeWorkerQueueSubmitBurst(device);
  openWorkerQueueSubmitBurst(device, { writeThrough: true });
  device.queue.submit(['write-through-after-snapshot']);
  device.queue.writeBuffer(persistent, 0, new Uint32Array([4]));
  closeWorkerQueueSubmitBurst(device);

  assert.deepEqual(liveSnapshot.staleWriteFlushLabels, { persistent: 1 });
  assert.deepEqual(liveSnapshot.writeThroughLabels, { persistent: 1 });
  assert.deepEqual(closeSnapshot.staleWriteFlushLabels, { persistent: 1 });
  assert.deepEqual(closeSnapshot.writeThroughLabels, { persistent: 1 });
  const current = workerQueueSubmitBurstStats(device);
  assert.deepEqual(current.staleWriteFlushLabels, { persistent: 2 });
  assert.deepEqual(current.writeThroughLabels, { persistent: 2 });
});

test('reopening after close works; double-open fails closed', () => {
  const { device } = createFakeDevice();
  openWorkerQueueSubmitBurst(device);
  assert.throws(
    () => openWorkerQueueSubmitBurst(device),
    /already open/
  );
  closeWorkerQueueSubmitBurst(device);
  openWorkerQueueSubmitBurst(device);
  closeWorkerQueueSubmitBurst(device);
});
