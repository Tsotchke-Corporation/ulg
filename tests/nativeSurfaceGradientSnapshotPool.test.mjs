import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_SCHEMA,
  createNativeSurfaceGradientSnapshotPool
} from '../src/visualization/nativeSurfaceGradientSnapshotPool.js';

function createMockDevice(name = 'device') {
  const buffers = [];
  let queueAccessCount = 0;
  const queue = new Proxy({}, {
    get() {
      queueAccessCount += 1;
      throw new Error('snapshot pool must not access the GPU queue');
    }
  });
  const device = {
    name,
    queue,
    createBuffer(descriptor) {
      const buffer = {
        descriptor: { ...descriptor },
        size: descriptor.size,
        destroyCount: 0,
        mapAsync() {
          throw new Error('snapshot pool must not map buffers');
        },
        getMappedRange() {
          throw new Error('snapshot pool must not read buffers');
        },
        destroy() {
          this.destroyCount += 1;
        }
      };
      buffers.push(buffer);
      return buffer;
    }
  };
  return {
    device,
    buffers,
    get queueAccessCount() {
      return queueAccessCount;
    }
  };
}

test('committed and reserved gradient snapshots are never overwritten or destroyed', () => {
  const mock = createMockDevice();
  const pool = createNativeSurfaceGradientSnapshotPool({ maxSlotsPerKey: 2 });
  const firstReservation = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 16
  });
  const first = firstReservation.commit({ ownerGeneration: 10 });
  const second = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 64
  });

  assert.equal(firstReservation.status, 'committed');
  assert.equal(first.status, 'committed');
  assert.equal(first.ownerGeneration, 10);
  assert.notEqual(second.buffer, first.buffer);
  assert.equal(first.buffer.destroyCount, 0);
  assert.equal(second.status, 'reserved');

  const exhausted = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 128
  });
  assert.equal(exhausted.accepted, false);
  assert.equal(exhausted.code, 'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_EXHAUSTED');
  assert.equal(first.buffer.destroyCount, 0);
  assert.equal(second.buffer.destroyCount, 0);
  assert.equal(pool.summarize().committedSlotCount, 1);
  assert.equal(pool.summarize().reservedSlotCount, 1);
});

test('aborting a stale candidate preserves the active owner and makes only its own slot reusable', () => {
  const mock = createMockDevice();
  const pool = createNativeSurfaceGradientSnapshotPool({ maxSlotsPerKey: 2 });
  const active = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 32
  }).commit({ ownerGeneration: 20 });
  const staleCandidate = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 32
  });
  const staleBuffer = staleCandidate.buffer;

  assert.equal(staleCandidate.abort(), true);
  assert.equal(staleCandidate.abort(), false);
  assert.equal(staleCandidate.status, 'aborted');
  assert.equal(active.status, 'committed');
  assert.equal(active.buffer.destroyCount, 0);

  const replacementCandidate = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 24
  });
  assert.equal(replacementCandidate.buffer, staleBuffer);
  assert.notEqual(replacementCandidate.buffer, active.buffer);
});

test('growth replaces only an idle slot while the committed generation remains intact', () => {
  const mock = createMockDevice();
  const pool = createNativeSurfaceGradientSnapshotPool({ maxSlotsPerKey: 2 });
  const active = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 16
  }).commit({ ownerGeneration: 30 });
  const candidate = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 32
  });
  const candidateBuffer = candidate.buffer;
  candidate.abort();

  const grown = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 96
  });
  assert.notEqual(grown.buffer, candidateBuffer);
  assert.equal(candidateBuffer.destroyCount, 1);
  assert.equal(active.buffer.destroyCount, 0);
  assert.equal(grown.capacityByteLength, 96);
  assert.equal(pool.summarize().allocationCount, 3);
  assert.equal(pool.summarize().bufferDestroyCount, 1);
});

test('failed growth keeps the prior idle allocation intact and rejects the transaction', () => {
  const mock = createMockDevice();
  const pool = createNativeSurfaceGradientSnapshotPool({ maxSlotsPerKey: 1 });
  const idle = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 16
  });
  const originalBuffer = idle.buffer;
  idle.abort();
  const createBuffer = mock.device.createBuffer.bind(mock.device);
  let failAllocation = true;
  mock.device.createBuffer = (descriptor) => {
    if (failAllocation) throw new Error('injected allocation failure');
    return createBuffer(descriptor);
  };

  const rejected = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 64
  });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.code, 'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_ALLOCATION_FAILED');
  assert.equal(originalBuffer.destroyCount, 0);

  failAllocation = false;
  const reused = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 16
  });
  assert.equal(reused.buffer, originalBuffer);
});

test('a released committed snapshot is reusable and release is exactly once', () => {
  const mock = createMockDevice();
  const pool = createNativeSurfaceGradientSnapshotPool({ maxSlotsPerKey: 1 });
  const resource = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 64
  }).commit({ ownerGeneration: 40 });
  const buffer = resource.buffer;

  assert.equal(resource.release(), true);
  assert.equal(resource.release(), false);
  assert.equal(pool.release(resource), false);
  assert.equal(resource.status, 'released');
  assert.equal(resource.released, true);

  const reused = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 48
  });
  assert.equal(reused.buffer, buffer);
  assert.equal(buffer.destroyCount, 0);
});

test('slot keys and devices have independent transactional lifetimes', () => {
  const firstMock = createMockDevice('first');
  const secondMock = createMockDevice('second');
  const pool = createNativeSurfaceGradientSnapshotPool({
    maxSlotsPerKey: 1,
    maxSlotKeys: 2
  });
  const primary = pool.reserve({
    device: firstMock.device,
    slotKey: 'primary',
    byteLength: 16
  }).commit({ ownerGeneration: 50 });
  const secondary = pool.reserve({
    device: firstMock.device,
    slotKey: 'surface:water',
    byteLength: 16
  }).commit({ ownerGeneration: 50 });

  assert.notEqual(primary.buffer, secondary.buffer);
  assert.equal(secondary.release(), true);
  const replacedOnOtherDevice = pool.reserve({
    device: secondMock.device,
    slotKey: 'surface:water',
    byteLength: 16
  });
  assert.equal(secondary.buffer.destroyCount, 1);
  assert.equal(primary.buffer.destroyCount, 0);
  assert.equal(replacedOnOtherDevice.buffer.destroyCount, 0);

  const tooManyKeys = pool.reserve({
    device: secondMock.device,
    slotKey: 'surface:steam',
    byteLength: 16
  });
  assert.equal(tooManyKeys.accepted, false);
  assert.equal(tooManyKeys.code, 'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_SLOT_KEY_LIMIT');
});

test('non-force teardown is atomic while force teardown invalidates and destroys all allocations', () => {
  const mock = createMockDevice();
  const pool = createNativeSurfaceGradientSnapshotPool({ maxSlotsPerKey: 2 });
  const committed = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 16
  }).commit({ ownerGeneration: 60 });
  const reserved = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 32
  });

  const blocked = pool.destroy();
  assert.equal(blocked.destroyed, false);
  assert.equal(blocked.status, 'native-surface-gradient-snapshot-pool-destroy-blocked-busy-slots');
  assert.equal(blocked.blockedReservationCount, 1);
  assert.equal(blocked.blockedResourceCount, 1);
  assert.deepEqual(mock.buffers.map((buffer) => buffer.destroyCount), [0, 0]);

  const forced = pool.destroy({ force: true });
  assert.equal(forced.destroyed, true);
  assert.equal(forced.forced, true);
  assert.equal(forced.destroyedBufferCount, 2);
  assert.equal(forced.invalidatedReservationCount, 1);
  assert.equal(forced.invalidatedResourceCount, 1);
  assert.deepEqual(mock.buffers.map((buffer) => buffer.destroyCount), [1, 1]);
  assert.equal(committed.status, 'invalidated-by-force-destroy');
  assert.equal(reserved.status, 'invalidated-by-force-destroy');
  assert.equal(committed.release(), false);
  assert.equal(reserved.abort(), false);

  const secondDestroy = pool.destroy({ force: true });
  assert.equal(secondDestroy.status, 'native-surface-gradient-snapshot-pool-already-destroyed');
  assert.deepEqual(mock.buffers.map((buffer) => buffer.destroyCount), [1, 1]);
});

test('idle teardown destroys every allocation and reserve then fails closed', () => {
  const mock = createMockDevice();
  const pool = createNativeSurfaceGradientSnapshotPool();
  const reservation = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 10
  });
  assert.equal(reservation.capacityByteLength, 12);
  reservation.abort();

  const result = pool.destroy();
  assert.equal(result.status, 'native-surface-gradient-snapshot-pool-destroyed');
  assert.equal(result.destroyedBufferCount, 1);
  assert.equal(mock.buffers[0].destroyCount, 1);
  assert.equal(pool.summarize().schema, NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_SCHEMA);
  assert.equal(pool.summarize().destroyed, true);

  const rejected = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 16
  });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.code, 'ULG_NATIVE_SURFACE_GRADIENT_SNAPSHOT_POOL_DESTROYED');
});

test('snapshot pool performs no queue access, mapping, readback, or fence wait', () => {
  const mock = createMockDevice();
  const pool = createNativeSurfaceGradientSnapshotPool({ maxSlotsPerKey: 1 });
  const reservation = pool.reserve({
    device: mock.device,
    slotKey: 'primary',
    byteLength: 16
  });
  const resource = pool.commit(reservation, { ownerGeneration: 70 });
  pool.release(resource);
  pool.destroy();

  assert.equal(mock.queueAccessCount, 0);
  assert.equal(pool.summarize().reservationCount, 1);
  assert.equal(pool.summarize().commitCount, 1);
  assert.equal(pool.summarize().releaseCount, 1);
});
