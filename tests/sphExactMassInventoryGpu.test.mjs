import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat, encodeSphExactMass }
  from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactMassInventoryWebGpu, acquireSphExactMassRead, validateSphExactMassRead,
  releaseSphExactMassRead, releaseSphExactMassInventory, runSphExactMassTransferCandidateWebGpu }
  from '../src/runtime/sph/sphExactMassInventoryGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function fakeDevice() {
  let lose;
  const allocated = [], fences = [];
  const device = {
    allocated, fences, lost: new Promise(resolve => { lose = resolve; }),
    limits: { maxBufferSize: 4096, maxStorageBufferBindingSize: 4096 },
    createBuffer({ size, usage, label }) {
      const buffer = { size, usage, label, bytes: new ArrayBuffer(size), destroyed: 0,
        destroy() { this.destroyed++; } };
      allocated.push(buffer); return buffer;
    },
    createCommandEncoder() { throw new Error('unexpected execution in ownership-only fixture'); },
    queue: {
      writeBuffer(buffer, offset, values) {
        if (device.failWrite) throw new Error('write failed');
        new Uint8Array(buffer.bytes).set(new Uint8Array(values.buffer, values.byteOffset, values.byteLength), offset);
      },
      submit() {},
      onSubmittedWorkDone() {
        if (device.failFence === 'throw') throw new Error('fence failed');
        if (device.failFence === 'reject') return Promise.reject(new Error('fence failed'));
        if (device.failFence === 'missing') return undefined;
        return device.defer ? new Promise(resolve => fences.push(resolve)) : Promise.resolve();
      }
    },
    async drain() { for (let i = 0; i < 5; i++) { fences.splice(0).forEach(resolve => resolve()); await tick(); } },
    async lose() { lose({ reason: 'destroyed' }); await tick(); }
  };
  return device;
}
function fixture() {
  const device = fakeDevice(), format = createSphExactMassFormat();
  const family = createSphExactMassInventoryWebGpu({ device, format, massesKg: [.01, 0],
    provenance: { kind: 'initial-conditions', reference: 'explicit cold fixture' } });
  const expected = { device, family, format, expectedGeneration: 0 };
  return { device, format, family, expected };
}

test('initial inventory preserves binary64 low bits and declares its mass-only scope', async () => {
  const f = fixture();
  assert.equal(f.family.physicalPublicationAdmitted, false);
  const read = acquireSphExactMassRead(f.expected);
  assert.deepEqual(new Uint32Array(read.buffer.bytes).slice(0, 9), encodeSphExactMass(.01, f.format));
  assert.equal(validateSphExactMassRead(read, f.expected), true);
  releaseSphExactMassInventory(f.family); await releaseSphExactMassRead(read); await f.device.drain();
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
});

test('family, read, device, format and generation all require exact identity', async () => {
  const f = fixture(), read = acquireSphExactMassRead(f.expected);
  for (const override of [{ family: { ...f.family } }, { device: fakeDevice() },
    { format: createSphExactMassFormat() }, { expectedGeneration: 1 }]) {
    assert.throws(() => acquireSphExactMassRead({ ...f.expected, ...override }), /live original/);
    assert.equal(validateSphExactMassRead(read, { ...f.expected, ...override }), false);
  }
  assert.equal(validateSphExactMassRead({ ...read }, f.expected), false);
  assert.throws(() => releaseSphExactMassRead({ ...read }), /original read/);
  assert.throws(() => releaseSphExactMassInventory({ ...f.family }), /original family/);
  await releaseSphExactMassRead(read); releaseSphExactMassInventory(f.family); await f.device.drain();
});

test('retirement forbids new reads while held source remains valid through its latest queue fence', async () => {
  const f = fixture(), first = acquireSphExactMassRead(f.expected), second = acquireSphExactMassRead(f.expected);
  f.device.defer = true;
  releaseSphExactMassInventory(f.family);
  assert.throws(() => acquireSphExactMassRead(f.expected), /live original/);
  assert.equal(validateSphExactMassRead(first, f.expected), true);
  const pending = releaseSphExactMassRead(first);
  assert.equal(validateSphExactMassRead(first, f.expected), false);
  assert.equal(validateSphExactMassRead(second, f.expected), true);
  assert.equal(first.buffer.destroyed, 0);
  await f.device.drain(); await pending;
  assert.equal(second.buffer.destroyed, 0);
  const last = releaseSphExactMassRead(second); await f.device.drain(); await last;
  assert.equal(second.buffer.destroyed, 1);
  assert.equal(await releaseSphExactMassRead(second), true);
});

for (const failure of ['throw', 'reject', 'missing']) {
  test(`an unconfirmed ${failure} fence quarantines resources until confirmed loss`, async () => {
    const f = fixture(), read = acquireSphExactMassRead(f.expected);
    f.device.failFence = failure;
    releaseSphExactMassInventory(f.family);
    let completed = false;
    const pending = releaseSphExactMassRead(read).then(() => { completed = true; });
    await tick(); assert.equal(read.buffer.destroyed, 0); assert.equal(completed, false);
    await f.device.lose(); await pending;
    assert.equal(read.buffer.destroyed, 1); assert.equal(completed, true);
    assert.equal(validateSphExactMassRead(read, f.expected), false);
  });
}

test('failed cold upload retires all allocated resources after queue confirmation', async () => {
  const device = fakeDevice(); device.defer = true; device.failWrite = true;
  assert.throws(() => createSphExactMassInventoryWebGpu({ device, format: createSphExactMassFormat(),
    massesKg: [1], provenance: { kind: 'initial-conditions', reference: 'failure fixture' } }), /write failed/);
  assert.equal(device.allocated[0].destroyed, 0);
  await device.drain(); assert.equal(device.allocated[0].destroyed, 1);
});

test('foreign, untagged, truncated or non-copyable graphs reject before allocation', async () => {
  const f = fixture(), read = acquireSphExactMassRead(f.expected), count = f.device.allocated.length;
  for (const description of [{ size: 44, usage: 4 }, { size: 40, usage: 4, tagged: true },
    { size: 44, usage: 128, tagged: true }, { size: 44, usage: 4, foreign: true }]) {
    const buffer = { ...description };
    if (description.tagged || description.foreign) tagWebGpuBufferDevice(buffer, description.foreign ? fakeDevice() : f.device);
    await assert.rejects(runSphExactMassTransferCandidateWebGpu({ device: f.device, sourceRead: read,
      edgeBuffer: buffer, edgeCount: 1, edgeFormat: f.format }), /same-device COPY_SRC/);
    assert.equal(f.device.allocated.length, count);
  }
  await releaseSphExactMassRead(read); releaseSphExactMassInventory(f.family); await f.device.drain();
});

test('precision shortage rejects cold input before GPU allocation', () => {
  const device = fakeDevice();
  assert.throws(() => createSphExactMassInventoryWebGpu({ device, format: createSphExactMassFormat(), massesKg: [2 ** -150],
    provenance: { kind: 'initial-conditions', reference: 'too coarse' } }), /finer run format/);
  assert.equal(device.allocated.length, 0);
});

test('holes and accessor mass rows cannot silently introduce zero inventory', () => {
  const device = fakeDevice(), accessor = [];
  Object.defineProperty(accessor, '0', { get() { throw new Error('must not run'); } });
  for (const massesKg of [Array(2), accessor]) {
    assert.throws(() => createSphExactMassInventoryWebGpu({ device, format: createSphExactMassFormat(), massesKg,
      provenance: { kind: 'initial-conditions', reference: 'explicit rows' } }), /explicit own data/);
  }
  assert.equal(device.allocated.length, 0);
});

test('caller-owned iteration methods cannot replace explicit mass rows', async () => {
  const device = fakeDevice(), format = createSphExactMassFormat();
  const family = createSphExactMassInventoryWebGpu({ device, format, massesKg: Object.assign([1], { forEach() {} }),
    provenance: { kind: 'initial-conditions', reference: 'explicit indexed read' } });
  const read = acquireSphExactMassRead({ family, device });
  assert.deepEqual(new Uint32Array(read.buffer.bytes), encodeSphExactMass(1, format));
  releaseSphExactMassInventory(family); await releaseSphExactMassRead(read); await device.drain();
});

test('initial provenance must be snapshotted own data', () => {
  const device = fakeDevice();
  assert.throws(() => createSphExactMassInventoryWebGpu({ device, format: createSphExactMassFormat(), massesKg: [1],
    provenance: { kind: 'initial-conditions', get reference() { throw new Error('must not run'); } } }), /provenance required/);
  assert.equal(device.allocated.length, 0);
});

test('a same-width proposal with a different quantum cannot be silently reinterpreted', async () => {
  const f = fixture(), read = acquireSphExactMassRead(f.expected);
  for (const edgeFormat of [undefined, createSphExactMassFormat(), createSphExactMassFormat({ quantumExponent: -150 })]) {
    await assert.rejects(runSphExactMassTransferCandidateWebGpu({ device: f.device, sourceRead: read,
      edgeBuffer: {}, edgeCount: 1, edgeFormat }), /same original exact-mass format/);
  }
  releaseSphExactMassInventory(f.family); await releaseSphExactMassRead(read); await f.device.drain();
  assert.equal(f.device.allocated[0].destroyed, 1);
});

test('proposal validation holds the source before a getter can retire its original owner', async () => {
  const f = fixture(), read = acquireSphExactMassRead(f.expected);
  const edgeBuffer = tagWebGpuBufferDevice({ usage: 4, get size() {
    releaseSphExactMassInventory(f.family); void releaseSphExactMassRead(read);
    assert.equal(read.buffer.destroyed, 0);
    return 40; // Rejection exercises cleanup of the already-reserved hold.
  } }, f.device);
  await assert.rejects(runSphExactMassTransferCandidateWebGpu({ device: f.device, sourceRead: read,
    edgeBuffer, edgeCount: 1, edgeFormat: f.format }), /same-device COPY_SRC/);
  await f.device.drain(); assert.equal(read.buffer.destroyed, 1);
});
