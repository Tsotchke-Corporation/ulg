import test from 'node:test';
import assert from 'node:assert/strict';
import {
  armWorkerQueueSubmitBurst,
  openWorkerQueueSubmitBurst,
  flushWorkerQueueSubmitBurst,
  closeWorkerQueueSubmitBurst,
  workerQueueSubmitBurstStats,
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
