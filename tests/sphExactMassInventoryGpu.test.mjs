import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat, encodeSphExactMass }
  from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactMassInventoryWebGpu, acquireSphExactMassRead, validateSphExactMassRead,
  releaseSphExactMassRead, releaseSphExactMassInventory, runSphExactMassTransferCandidateWebGpu,
  runSphExactMassPartitionCandidateWebGpu, forkSphExactMassRead, sliceSphExactMassRead }
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

function secondSource(f, format = f.format, device = f.device) {
  const family = createSphExactMassInventoryWebGpu({ device, format, massesKg: [2 ** -100],
    provenance: { kind: 'initial-conditions', reference: 'independent cold numeric source' } });
  return { family, read: acquireSphExactMassRead({ family, device }) };
}

test('partition admission rejects missing, copied, repeated or foreign original reads without allocation', async () => {
  const f = fixture(), first = acquireSphExactMassRead(f.expected);
  const second = secondSource(f), fork = forkSphExactMassRead(first, { device: f.device });
  const lookalike = secondSource(f, createSphExactMassFormat());
  const foreignDevice = fakeDevice(), foreign = secondSource(f, f.format, foreignDevice);
  const accessor = [first]; Object.defineProperty(accessor, '1', { get() { throw new Error('must not run'); } });
  const count = f.device.allocated.length;
  for (const sourceReads of [[], [first, { ...second.read }], [first, first], [first, fork],
    [first, , second.read], accessor, [first, foreign.read], [first, lookalike.read]]) {
    await assert.rejects(runSphExactMassPartitionCandidateWebGpu({ device: f.device,
      sourceReads, edgeFormat: f.format, outputRowCount: 3 }), /original|repeat|explicit|nonempty/);
    assert.equal(f.device.allocated.length, count);
    assert.equal(validateSphExactMassRead(first, f.expected), true);
  }
  for (const { family, read } of [second, lookalike, foreign]) {
    releaseSphExactMassInventory(family); await releaseSphExactMassRead(read);
  }
  releaseSphExactMassInventory(f.family); await releaseSphExactMassRead(first); await releaseSphExactMassRead(fork);
  await f.device.drain(); await foreignDevice.drain();
  assert.ok([...f.device.allocated, ...foreignDevice.allocated].every(buffer => buffer.destroyed === 1));
});

test('partition validation pins every source before a destination getter requests their retirement', async () => {
  const f = fixture(), first = acquireSphExactMassRead(f.expected), second = secondSource(f);
  const mapping = tagWebGpuBufferDevice({ usage: 4, get size() {
    for (const read of [first, second.read]) {
      releaseSphExactMassInventory(read.family); void releaseSphExactMassRead(read);
      assert.equal(read.buffer.destroyed, 0);
    }
    return 4; // Three complete source rows are required.
  } }, f.device);
  await assert.rejects(runSphExactMassPartitionCandidateWebGpu({ device: f.device,
    sourceReads: [first, second.read], outputRowCount: 4, destinationBuffer: mapping,
    edgeFormat: f.format }), /complete same-device COPY_SRC destination/);
  await f.device.drain();
  assert.ok(f.device.allocated.every(buffer => buffer.destroyed === 1));
});

test('partial partition admission awaits all reserved-source retirement after a rejected fence', async () => {
  const f = fixture(), first = acquireSphExactMassRead(f.expected);
  f.device.failFence = 'reject';
  let settled = false;
  const request = runSphExactMassPartitionCandidateWebGpu({ device: f.device,
    sourceReads: [first, {}], outputRowCount: 3, edgeFormat: f.format })
    .finally(() => { settled = true; });
  request.catch(() => {});
  releaseSphExactMassInventory(f.family); void releaseSphExactMassRead(first);
  await tick(); assert.equal(settled, false); assert.equal(first.buffer.destroyed, 0);
  await f.device.lose(); await assert.rejects(request, /original live retained read/);
  assert.equal(first.buffer.destroyed, 1);
});

// These synthetic verdicts test host lifetime/control validation only; native
// tests independently execute WGSL and compare every limb against BigInt.
function installSyntheticVerdict(device, mutate = () => {}) {
  device.copies = [];
  device.createShaderModule = args => args;
  device.createComputePipeline = () => ({ getBindGroupLayout() { return {}; } });
  device.createBindGroup = args => args;
  device.createCommandEncoder = () => ({
    clearBuffer() {}, copyBufferToBuffer(...args) { device.copies.push(args); }, finish() { return {}; },
    beginComputePass() { return { setPipeline() {}, setBindGroup() {}, dispatchWorkgroups() {}, end() {} }; }
  });
  const create = device.createBuffer;
  device.createBuffer = args => {
    const buffer = create(args);
    buffer.mapAsync = async () => {};
    buffer.getMappedRange = () => {
      const params = new Uint32Array(device.allocated.findLast(value => value.label === 'ulg-exact-mass-params').bytes);
      const header = new Uint32Array(16);
      header.set([0x454d5431, params.length === 8 ? 2 : 1, 1, 0, params[0], params[1], params[0], params[3], params[2]]);
      if (params.length === 8) { header[9] = params[4]; header[10] = params[5]; }
      mutate(header);
      return header.buffer;
    };
    buffer.unmap = () => {};
    return buffer;
  };
}

for (const word of [1, 7, 8, 9, 10, 11]) test(`partition rejects malformed verdict word ${word}`, async () => {
  const f = fixture(), first = acquireSphExactMassRead(f.expected), second = secondSource(f);
  installSyntheticVerdict(f.device, words => { words[word]++; });
  const mapping = tagWebGpuBufferDevice({ size: 12, usage: 4 }, f.device);
  await assert.rejects(runSphExactMassPartitionCandidateWebGpu({ device: f.device,
    sourceReads: [first, second.read], destinationBuffer: mapping, outputRowCount: 4,
    edgeFormat: f.format }), /Malformed exact-mass transfer verdict/);
  for (const read of [first, second.read]) {
    releaseSphExactMassInventory(read.family); await releaseSphExactMassRead(read);
  }
  await f.device.drain(); assert.ok(f.device.allocated.every(buffer => buffer.destroyed === 1));
});

for (const partition of [false, true]) test(`loss during final ${partition ? 'partition' : 'transfer'} cleanup cannot deliver a dead successful family`, async () => {
  const f = fixture(), first = acquireSphExactMassRead(f.expected), second = partition ? secondSource(f) : null;
  installSyntheticVerdict(f.device);
  let fences = 0;
  f.device.queue.onSubmittedWorkDone = () => {
    if (++fences === 3) { void f.device.lose(); return new Promise(() => {}); }
    return Promise.resolve();
  };
  const candidate = partition
    ? runSphExactMassPartitionCandidateWebGpu({ device: f.device, sourceReads: [first, second.read],
      outputRowCount: 4, destinationBuffer: tagWebGpuBufferDevice({ size: 12, usage: 4 }, f.device), edgeFormat: f.format })
    : runSphExactMassTransferCandidateWebGpu({ device: f.device, sourceRead: first, edgeCount: 1,
      edgeBuffer: tagWebGpuBufferDevice({ size: 44, usage: 4 }, f.device), edgeFormat: f.format });
  await assert.rejects(candidate, /device lost before candidate delivery/);
  for (const read of [first, second?.read].filter(Boolean)) await releaseSphExactMassRead(read);
  await f.device.drain(); assert.ok(f.device.allocated.every(buffer => buffer.destroyed === 1));
});

test('numeric windows are original bounded relative slices, and forks cannot widen them', async () => {
  const f = fixture(), root = acquireSphExactMassRead(f.expected);
  const window = sliceSphExactMassRead(root, { device: f.device, rowOffset: 1, rowCount: 1 });
  assert.deepEqual([window.rowOffset, window.rowCount, window.byteOffset, window.byteLength], [1, 1, 36, 36]);
  assert.equal(window.buffer, root.buffer);
  assert.equal(Object.isFrozen(window), true);
  for (const [rowOffset, rowCount] of [[-0, 1], [-1, 1], [0, 0], [0, -0], [0, 1.5], [0, '1'], [0, 3], [1, 2], [2, 1], [0xffffffff, 1]]) {
    assert.throws(() => sliceSphExactMassRead(root, { device: f.device, rowOffset, rowCount }), /exact|range/);
  }
  assert.throws(() => sliceSphExactMassRead(window, { device: f.device, rowOffset: 1, rowCount: 1 }), /outside/);
  assert.throws(() => sliceSphExactMassRead({ ...window }, { device: f.device, rowOffset: 0, rowCount: 1 }), /original/);
  assert.throws(() => sliceSphExactMassRead(window, { device: fakeDevice(), rowOffset: 0, rowCount: 1 }), /original/);
  assert.throws(() => forkSphExactMassRead(window, { device: f.device, rowOffset: 0, rowCount: 2 }), /original/);
  releaseSphExactMassInventory(f.family);
  await releaseSphExactMassRead(root);
  assert.throws(() => acquireSphExactMassRead(f.expected), /live original/);
  const nested = sliceSphExactMassRead(window, { device: f.device, rowOffset: 0, rowCount: 1 });
  const fork = forkSphExactMassRead(nested, { device: f.device });
  assert.equal(validateSphExactMassRead(fork, { ...f.expected, rowOffset: 1, rowCount: 1 }), true);
  assert.equal(validateSphExactMassRead(fork, { ...f.expected, rowOffset: 0, rowCount: 2 }), false);
  await releaseSphExactMassRead(window); await releaseSphExactMassRead(nested);
  assert.equal(root.buffer.destroyed, 0);
  await releaseSphExactMassRead(fork); await f.device.drain();
  assert.equal(root.buffer.destroyed, 1);
});

test('same-root joins copy only disjoint selected byte ranges in requested order', async () => {
  const f = fixture(), root = acquireSphExactMassRead(f.expected);
  const left = sliceSphExactMassRead(root, { device: f.device, rowOffset: 0, rowCount: 1 });
  const right = sliceSphExactMassRead(root, { device: f.device, rowOffset: 1, rowCount: 1 });
  const fork = forkSphExactMassRead(right, { device: f.device });
  const count = f.device.allocated.length;
  for (const sourceReads of [[root, left], [right, root], [right, fork], [left, right, left]]) {
    await assert.rejects(runSphExactMassPartitionCandidateWebGpu({ device: f.device, sourceReads,
      edgeFormat: f.format, outputRowCount: 2 }), /repeat or overlap/);
    assert.equal(f.device.allocated.length, count);
  }
  installSyntheticVerdict(f.device);
  const result = await runSphExactMassPartitionCandidateWebGpu({ device: f.device, sourceReads: [right, left],
    outputRowCount: 2, destinationBuffer: tagWebGpuBufferDevice({ size: 8, usage: 4 }, f.device), edgeFormat: f.format });
  const copies = f.device.copies.filter(copy => copy[0] === root.buffer);
  assert.deepEqual(copies.map(copy => [copy[1], copy[3], copy[4]]), [[36, 0, 36], [0, 36, 36]]);
  assert.equal(result.sourceRowCount, 2); assert.equal(result.sourceCount, 2);
  assert.deepEqual(result.family.provenance.sources.map(source => [source.rowOffset, source.rowCount]), [[1, 1], [0, 1]]);
  releaseSphExactMassInventory(result.family); releaseSphExactMassInventory(f.family);
  for (const read of [root, left, right, fork]) await releaseSphExactMassRead(read);
  await f.device.drain(); assert.ok(f.device.allocated.every(buffer => buffer.destroyed === 1));
});

test('ordinary transfer snapshots the selected window instead of binding the entire unaligned root', async () => {
  const f = fixture(), root = acquireSphExactMassRead(f.expected);
  const window = sliceSphExactMassRead(root, { device: f.device, rowOffset: 1, rowCount: 1 });
  installSyntheticVerdict(f.device);
  const result = await runSphExactMassTransferCandidateWebGpu({ device: f.device, sourceRead: window,
    edgeBuffer: tagWebGpuBufferDevice({ size: 44, usage: 4 }, f.device), edgeCount: 1, edgeFormat: f.format });
  assert.equal(result.rowCount, 1);
  const copy = f.device.copies.find(copy => copy[0] === root.buffer);
  assert.deepEqual([copy[1], copy[2].size, copy[3], copy[4]], [36, 36, 0, 36]);
  assert.equal(result.family.provenance.sourceRowOffset, 1);
  assert.equal(result.family.provenance.sourceRowCount, 1);
  releaseSphExactMassInventory(result.family); releaseSphExactMassInventory(f.family);
  await releaseSphExactMassRead(window); await releaseSphExactMassRead(root); await f.device.drain();
});

test('a rejected window-release fence quarantines its whole shared root until confirmed loss', async () => {
  const f = fixture(), root = acquireSphExactMassRead(f.expected);
  const first = sliceSphExactMassRead(root, { device: f.device, rowOffset: 0, rowCount: 1 });
  const second = sliceSphExactMassRead(root, { device: f.device, rowOffset: 1, rowCount: 1 });
  f.device.failFence = 'reject';
  let settled = false;
  const pending = releaseSphExactMassRead(first).then(() => { settled = true; });
  await tick();
  assert.equal(settled, false); assert.equal(root.buffer.destroyed, 0);
  assert.throws(() => forkSphExactMassRead(second, { device: f.device }), /original/);
  assert.throws(() => sliceSphExactMassRead(root, { device: f.device, rowOffset: 0, rowCount: 1 }), /original/);
  await f.device.lose(); await pending;
  await releaseSphExactMassRead(root); await releaseSphExactMassRead(second);
  assert.equal(root.buffer.destroyed, 1);
});
