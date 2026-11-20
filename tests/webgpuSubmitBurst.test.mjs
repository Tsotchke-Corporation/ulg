import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireQueueOrderedPooledBuffer,
  armWorkerQueueSubmitBurst,
  openWorkerQueueSubmitBurst,
  flushWorkerQueueSubmitBurst,
  closeWorkerQueueSubmitBurst,
  releaseQueueOrderedPooledBuffer,
  workerQueueSubmitBurstStats,
  withWorkerQueueSubmitBurstWriteThrough,
  deferConfirmedSubmittedWorkCleanup,
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

function confirmedBurstDeferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('confirmed cleanup stays behind held commands with one raw fence per registration', async () => {
  const { device, ops } = createFakeDevice();
  const fences = [];
  let fenceRequests = 0;
  device.queue.onSubmittedWorkDone = () => {
    const fence = confirmedBurstDeferred(); fences.push(fence); ops.push({ op: 'fence' });
    return fence.promise;
  };
  armWorkerQueueSubmitBurst(device);
  const first = device.createBuffer({ label: 'first-owned' });
  const second = device.createBuffer({ label: 'second-owned' });
  openWorkerQueueSubmitBurst(device);
  device.queue.submit(['uses-both']);
  const completions = [first, second].map(buffer => deferConfirmedSubmittedWorkCleanup(device, () => buffer.destroy(), {
    onQueueFenceRequested() { fenceRequests++; }
  }));
  assert.deepEqual(ops, []); assert.equal(fences.length, 0);
  assert.equal(fenceRequests, 0, 'parking a cleanup is not a fence request');
  assert.equal(workerQueueSubmitBurstStats(device).fenceFlushCount, 0);
  flushWorkerQueueSubmitBurst(device);
  assert.deepEqual(ops.map(op => op.op), ['submit', 'fence', 'fence']);
  assert.equal(fenceRequests, 2, 'observers run when flush requests the real fences');
  fences[1].resolve(); assert.equal(await completions[1], true);
  assert.deepEqual(ops.filter(op => op.op === 'destroy').map(op => op.buffer), [second]);
  fences[0].resolve(); assert.equal(await completions[0], true);
  assert.equal(ops.filter(op => op.op === 'destroy').length, 2);
  const stats = closeWorkerQueueSubmitBurst(device);
  assert.equal(stats.deferredCleanupTotal, 2); assert.equal(stats.fenceFlushCount, 0);
  assert.equal(fences.length, 2, 'closing an empty burst adds no cleanup fence');
  assert.equal(fenceRequests, 2);
});

test('confirmed retirement does not re-park destruction behind later held work', async () => {
  const { device, ops } = createFakeDevice();
  const fences = [];
  device.queue.onSubmittedWorkDone = () => {
    const fence = confirmedBurstDeferred(); fences.push(fence); ops.push({ op: 'fence' });
    return fence.promise;
  };
  armWorkerQueueSubmitBurst(device);
  const retired = device.createBuffer({ label: 'earlier-owned' });
  const later = device.createBuffer({ label: 'later-owned' });
  openWorkerQueueSubmitBurst(device);
  device.queue.submit(['uses-earlier']);
  const completion = deferConfirmedSubmittedWorkCleanup(device, () => retired.destroy());
  flushWorkerQueueSubmitBurst(device);
  device.queue.submit(['uses-later']);
  fences[0].resolve();
  assert.equal(await completion, true);
  assert.deepEqual(ops.map(op => op.op), ['submit', 'fence', 'destroy']);
  assert.equal(ops.at(-1).buffer, retired);
  assert.equal(workerQueueSubmitBurstStats(device).deferredDestroyTotal, 0);
  assert.equal(fences.length, 1, 'confirmed destruction does not add a second fence');
  later.destroy();
  assert.equal(workerQueueSubmitBurstStats(device).deferredDestroyTotal, 1,
    'ordinary destruction outside the confirmed callback remains protected');
  closeWorkerQueueSubmitBurst(device);
  assert.equal(fences.length, 2, 'only the unrelated ordinary cleanup adds a fence');
  fences[1].resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ops.filter(op => op.op === 'destroy').length, 2);
});

for (const mode of ['reject', 'throw', 'missing', 'submit-throws']) {
  test(`confirmed burst cleanup retains resources through ${mode}`, async () => {
    const { device, ops } = createFakeDevice();
    const loss = confirmedBurstDeferred(), fence = confirmedBurstDeferred();
    device.lost = loss.promise;
    if (mode === 'missing') delete device.queue.onSubmittedWorkDone;
    else device.queue.onSubmittedWorkDone = () => {
      ops.push({ op: 'fence' });
      if (mode === 'throw') throw new Error('fence creation failed');
      if (mode === 'reject') return Promise.reject(new Error('fence rejected'));
      return fence.promise;
    };
    if (mode === 'submit-throws') device.queue.submit = commandBuffers => {
      ops.push({ op: 'submit', commandBuffers: [...commandBuffers] });
      throw new Error('submit failed after delegation');
    };
    armWorkerQueueSubmitBurst(device);
    const buffer = device.createBuffer({ label: 'owned' });
    openWorkerQueueSubmitBurst(device); device.queue.submit(['uses-owned']);
    let completed = false;
    const completion = deferConfirmedSubmittedWorkCleanup(device, () => buffer.destroy());
    completion.then(() => { completed = true; });
    if (mode === 'submit-throws') assert.throws(() => closeWorkerQueueSubmitBurst(device), /after delegation/);
    else closeWorkerQueueSubmitBurst(device);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(completed, false); assert.equal(ops.filter(op => op.op === 'destroy').length, 0);
    if (mode === 'submit-throws') {
      fence.resolve(); assert.equal(await completion, true);
    } else {
      loss.resolve({ reason: 'destroyed' }); assert.equal(await completion, false);
    }
    loss.resolve({ reason: 'destroyed' }); fence.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ops.filter(op => op.op === 'destroy').length, 1);
  });
}

test('confirmed loss retires held cleanup immediately and late burst flush cannot retire twice', async () => {
  const { device, ops } = createFakeDevice();
  const loss = confirmedBurstDeferred(); device.lost = loss.promise;
  armWorkerQueueSubmitBurst(device);
  const buffer = device.createBuffer({ label: 'held-owner' });
  openWorkerQueueSubmitBurst(device); device.queue.submit(['uses-owner']);
  let fenceRequests = 0;
  const completion = deferConfirmedSubmittedWorkCleanup(device, () => buffer.destroy(), {
    onQueueFenceRequested() { fenceRequests++; }
  });
  loss.resolve({ reason: 'destroyed' });
  assert.equal(await completion, false);
  assert.deepEqual(ops.map(op => op.op), ['destroy'], 'loss retirement does not re-park destruction on the burst');
  assert.equal(workerQueueSubmitBurstStats(device).deferredDestroyTotal, 0);
  closeWorkerQueueSubmitBurst(device);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ops.filter(op => op.op === 'destroy').length, 1);
  assert.equal(ops.filter(op => op.op === 'fence').length, 0, 'terminal ticket does not request a late fence');
  assert.equal(fenceRequests, 0, 'loss before flush never reports a fence request');
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

test('pooledWriteThrough coalesces stale writeBuffers into one reusable slab upload and one submit', () => {
  const { device, ops } = createFakeDevice();
  let createBufferCount = 0;
  const origCreateBuffer = device.createBuffer.bind(device);
  device.createBuffer = (desc) => {
    createBufferCount += 1;
    return origCreateBuffer(desc);
  };
  armWorkerQueueSubmitBurst(device);
  const paramsA = device.createBuffer({ label: 'params-a', size: 16 });
  const paramsB = device.createBuffer({ label: 'params-b', size: 16 });
  const baselineCreates = createBufferCount;

  openWorkerQueueSubmitBurst(device, { label: 'pooled-test', pooledWriteThrough: true });
  device.queue.submit(['step-1-a']);
  device.queue.writeBuffer(paramsA, 0, new Float32Array([1, 2, 3, 4]));
  device.queue.writeBuffer(paramsB, 0, new Float32Array([5, 6, 7, 8]));
  device.queue.submit(['step-1-b']);
  device.queue.writeBuffer(paramsA, 0, new Float32Array([9, 10, 11, 12]));
  device.queue.submit(['step-2-a']);
  assert.equal(ops.length, 0, 'no submit or writeBuffer until flush');
  const stats = closeWorkerQueueSubmitBurst(device);

  assert.equal(stats.pooledWriteThroughCount, 3);
  assert.equal(stats.staleWriteFlushCount, 0);
  assert.equal(stats.flushCount, 1);
  assert.equal(createBufferCount - baselineCreates, 1, 'exactly one reusable staging slab allocated');
  // One realWriteBuffer to the reusable slab strictly before one realSubmit.
  assert.equal(ops.length, 2);
  assert.equal(ops[0].op, 'writeBuffer');
  assert.equal(ops[0].buffer.label, 'ulg-submit-burst-pooled-staging');
  assert.equal(ops[1].op, 'submit');
  assert.equal(ops[1].commandBuffers.length, 5);
  assert.equal(ops[1].commandBuffers[0], 'step-1-a');
  assert.equal(ops[1].commandBuffers[1].copies.length, 2);
  assert.equal(ops[1].commandBuffers[2], 'step-1-b');
  assert.equal(ops[1].commandBuffers[3].copies.length, 1);
  assert.equal(ops[1].commandBuffers[4], 'step-2-a');

  // Second burst reuses the SAME staging slab with zero new allocations.
  openWorkerQueueSubmitBurst(device, { label: 'pooled-test-2', pooledWriteThrough: true });
  device.queue.submit(['step-3-a']);
  device.queue.writeBuffer(paramsA, 0, new Float32Array([13, 14, 15, 16]));
  device.queue.submit(['step-3-b']);
  closeWorkerQueueSubmitBurst(device);
  assert.equal(createBufferCount - baselineCreates, 1, 'second burst creates zero staging buffers');
});

test('coalesceComputePasses merges consecutive compute passes and splits on clearBuffer/copyBufferToBuffer', () => {
  const realPasses = [];
  const encoderOps = [];
  const { device } = createFakeDevice();
  device.createCommandEncoder = () => ({
    label: 'raw-enc',
    beginComputePass(desc) {
      const pass = { label: desc?.label ?? 'unlabelled', dispatches: 0, ended: false };
      realPasses.push(pass);
      encoderOps.push(`pass:${pass.label}`);
      return {
        setPipeline() {},
        setBindGroup() {},
        dispatchWorkgroups() { pass.dispatches += 1; },
        dispatchWorkgroupsIndirect() { pass.dispatches += 1; },
        end() { pass.ended = true; }
      };
    },
    clearBuffer() { encoderOps.push('clear'); },
    copyBufferToBuffer() { encoderOps.push('copy'); },
    finish() { encoderOps.push('finish'); return { label: 'cmd' }; }
  });
  armWorkerQueueSubmitBurst(device);
  openWorkerQueueSubmitBurst(device, { label: 'coalesce-test', coalesceComputePasses: true });
  const enc = device.createCommandEncoder({ label: 'stage' });
  const p1 = enc.beginComputePass({ label: 'a' }); p1.setPipeline('p1'); p1.dispatchWorkgroups(1); p1.end();
  const p2 = enc.beginComputePass({ label: 'b' }); p2.setPipeline('p2'); p2.dispatchWorkgroups(2); p2.end();
  const p3 = enc.beginComputePass({ label: 'c' }); p3.setPipeline('p3'); p3.dispatchWorkgroups(3); p3.end();
  enc.clearBuffer();
  const p4 = enc.beginComputePass({ label: 'd' }); p4.setPipeline('p4'); p4.dispatchWorkgroups(4); p4.end();
  enc.copyBufferToBuffer();
  const p5 = enc.beginComputePass({ label: 'e' }); p5.setPipeline('p5'); p5.dispatchWorkgroups(5); p5.end();
  enc.finish();
  closeWorkerQueueSubmitBurst(device);

  assert.equal(realPasses.length, 3, '5 consecutive/split passes coalesce into 3 real compute passes');
  assert.equal(realPasses[0].dispatches, 3);
  assert.equal(realPasses[1].dispatches, 1);
  assert.equal(realPasses[2].dispatches, 1);
  assert.ok(realPasses.every((p) => p.ended));
  assert.deepEqual(encoderOps, ['pass:a', 'clear', 'pass:d', 'copy', 'pass:e', 'finish']);
});

test('coalesceComputePasses hoists disjoint clearBuffer and flushes touched clearBuffer', () => {
  const realPasses = [];
  const encoderOps = [];
  const { device } = createFakeDevice();
  device.createBindGroup = (desc) => ({ label: desc?.label ?? 'bg', entries: desc?.entries });
  device.createCommandEncoder = () => ({
    label: 'raw-enc',
    beginComputePass(desc) {
      const pass = { label: desc?.label ?? 'unlabelled', dispatches: 0, ended: false };
      realPasses.push(pass);
      encoderOps.push(`pass:${pass.label}`);
      return {
        setPipeline() {},
        setBindGroup() {},
        dispatchWorkgroups() { pass.dispatches += 1; },
        dispatchWorkgroupsIndirect() { pass.dispatches += 1; },
        end() { pass.ended = true; }
      };
    },
    clearBuffer(buf) { encoderOps.push(`clear:${buf?.label ?? 'none'}`); },
    copyBufferToBuffer() { encoderOps.push('copy'); },
    finish() { encoderOps.push('finish'); return { label: 'cmd' }; }
  });
  armWorkerQueueSubmitBurst(device);
  const bufA = device.createBuffer({ label: 'A', size: 16 });
  const bufB = device.createBuffer({ label: 'B', size: 16 });
  const bgA = device.createBindGroup({ entries: [{ binding: 0, resource: { buffer: bufA } }] });
  const bgAB = device.createBindGroup({
    entries: [
      { binding: 0, resource: { buffer: bufA } },
      { binding: 1, resource: { buffer: bufB } }
    ]
  });
  openWorkerQueueSubmitBurst(device, { label: 'hoist-test', coalesceComputePasses: true });
  const enc = device.createCommandEncoder({ label: 'stage' });
  const p1 = enc.beginComputePass({ label: 'p1' });
  p1.setPipeline('pipe1'); p1.setBindGroup(0, bgA); p1.dispatchWorkgroups(1); p1.end();
  // B has not been touched by p1 -> hoisted before p1, keeping 1 fused pass!
  enc.clearBuffer(bufB);
  const p2 = enc.beginComputePass({ label: 'p2' });
  p2.setPipeline('pipe2'); p2.setBindGroup(0, bgAB); p2.dispatchWorkgroups(2); p2.end();
  // A WAS touched by p1/p2 -> flushes fused pass first, then clears A!
  enc.clearBuffer(bufA);
  const p3 = enc.beginComputePass({ label: 'p3' });
  p3.setPipeline('pipe3'); p3.setBindGroup(0, bgA); p3.dispatchWorkgroups(3); p3.end();
  enc.finish();
  closeWorkerQueueSubmitBurst(device);

  assert.equal(realPasses.length, 2);
  assert.equal(realPasses[0].dispatches, 2);
  assert.equal(realPasses[1].dispatches, 1);
  assert.deepEqual(encoderOps, ['clear:B', 'pass:p1', 'clear:A', 'pass:p3', 'finish']);
});

test('render-pass submit flushes burst immediately and createTexture.destroy defers while held', () => {
  const { device, ops } = createFakeDevice();
  device.createTexture = (desc) => {
    const tex = {
      label: desc?.label ?? 'tex',
      destroy() { ops.push({ op: 'destroy-tex', tex }); }
    };
    return tex;
  };
  const baseEncoder = device.createCommandEncoder;
  device.createCommandEncoder = (desc) => {
    const enc = baseEncoder(desc);
    enc.beginRenderPass = () => ({ end() {} });
    return enc;
  };
  armWorkerQueueSubmitBurst(device);
  const tex = device.createTexture({ label: 'optical-vol' });
  openWorkerQueueSubmitBurst(device, { label: 'render-test', pooledWriteThrough: true });
  device.queue.submit(['compute-1']);
  tex.destroy();
  assert.equal(ops.some((o) => o.op === 'destroy-tex'), false, 'texture destroy deferred while held');
  const renderEnc = device.createCommandEncoder({ label: 'render' });
  renderEnc.beginRenderPass({}).end();
  const renderCmd = renderEnc.finish();
  device.queue.submit([renderCmd]);
  assert.equal(ops[0].op, 'submit', 'render-pass submit flushes burst immediately');
  assert.equal(ops[0].commandBuffers.length, 2);
  closeWorkerQueueSubmitBurst(device);
});

test('buffer.mapAsync flushes held submit burst before mapping', async () => {
  const { device, ops } = createFakeDevice();
  const baseCreateBuffer = device.createBuffer.bind(device);
  device.createBuffer = (desc) => {
    const b = baseCreateBuffer(desc);
    b.mapAsync = async () => { ops.push({ op: 'mapAsync', buffer: b }); };
    return b;
  };
  armWorkerQueueSubmitBurst(device);
  const readBuf = device.createBuffer({ label: 'readback', size: 32 });
  openWorkerQueueSubmitBurst(device, { label: 'map-test', pooledWriteThrough: true });
  device.queue.submit(['copy-to-readback']);
  await readBuf.mapAsync(1);
  assert.deepEqual(ops.map((o) => o.op), ['submit', 'mapAsync']);
  closeWorkerQueueSubmitBurst(device);
});

test('queue-ordered buffer pool recycles FIFO buffers and refuses MAP_READ buffers', () => {
  const { device } = createFakeDevice();
  const b1 = acquireQueueOrderedPooledBuffer(device, { bucketKey: 'out', label: 'out', size: 64, usage: 0x84 });
  const b2 = acquireQueueOrderedPooledBuffer(device, { bucketKey: 'out', label: 'out', size: 64, usage: 0x84 });
  assert.notEqual(b1, b2);
  assert.equal(releaseQueueOrderedPooledBuffer(device, b1, { bucketKey: 'out', size: 64, usage: 0x84 }), true);
  assert.equal(releaseQueueOrderedPooledBuffer(device, b2, { bucketKey: 'out', size: 64, usage: 0x84 }), true);
  assert.equal(acquireQueueOrderedPooledBuffer(device, { bucketKey: 'out', label: 'out', size: 64, usage: 0x84 }), b1);
  assert.equal(acquireQueueOrderedPooledBuffer(device, { bucketKey: 'out', label: 'out', size: 64, usage: 0x84 }), b2);
  // MAP_READ buffers are never pooled (destroyed immediately).
  const mapped = acquireQueueOrderedPooledBuffer(device, { bucketKey: 'read', label: 'read', size: 64, usage: 0x09 });
  assert.equal(releaseQueueOrderedPooledBuffer(device, mapped, { bucketKey: 'read', size: 64, usage: 0x09 }), false);
});
