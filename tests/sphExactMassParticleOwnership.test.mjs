import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat, encodeSphExactMass } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import {
  buildSphGpuParticleBuffers, uploadSphGpuParticleBuffers, destroySphGpuParticleBuffers,
  ensureSphGpuParticleBufferSetBorrowLifecycle, sphGpuParticleUploadMatchesDevice,
  sphGpuParticleUploadAdvertisesExactMass, acquireSphParticleExactMassRead,
  releaseSphParticleExactMassRead, runSphGpuParticleBufferSetCleanupAfterBorrows,
  forkSphParticleExactMassRead, validateSphParticleExactMassRead,
  buildMlsMpmGpuParticleBuffers, uploadMlsMpmGpuParticleBuffers, destroyMlsMpmGpuParticleBuffers,
  assertSphLegacyMassPathAllowed
} from '../src/runtime/sph/sphGpuBuffers.js';
import { createSphPhaseCarrierTransferWebGpuEncoderStage } from '../src/runtime/sph/sphPhaseCarrierTransferGpu.js';
import { runSphReactionStepWebGpu, runSphReactionStepCpu } from '../src/runtime/sph/sphReactionGpuKernel.js';
import { createSphThermalStepWebGpuEncoderStage, runSphThermalStepCpu } from '../src/runtime/sph/sphThermalGpuKernel.js';
import { runMlsMpmG2pWebGpu, reconstructMlsMpmG2pCpu } from '../src/runtime/sph/sphG2pGpuKernel.js';
import { runSchroederParticleStorageCompactionWebGpu } from '../src/runtime/sph/schroederParticleStorageCompactionGpu.js';
import { runSphAerosolCondensateExtractionWebGpu } from '../src/runtime/sph/sphAerosolParcelGpu.js';
import { createSchroederSpatialReactionProductPlacementAuthorityWebGpu } from '../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function deviceFixture() {
  let lose;
  const device = { allocated: [], fences: [], submissions: 0,
    lost: new Promise(resolve => { lose = resolve; }),
    createBuffer(description) {
      const buffer = { ...description, bytes: new ArrayBuffer(description.size), destroyed: 0,
        destroy() { this.destroyed++; } };
      this.allocated.push(buffer); return buffer;
    },
    createCommandEncoder() { throw new Error('No solver dispatch is admitted in cold-ownership tests'); },
    queue: {
      writeBuffer(buffer, offset, data) {
        device.beforeWrite?.(buffer, data);
        if (device.failExactWrite && buffer.label === 'ulg-exact-mass-initial') throw new Error('exact write failure');
        new Uint8Array(buffer.bytes).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), offset);
      },
      submit() { device.submissions++; },
      onSubmittedWorkDone() { return device.defer ? new Promise(resolve => device.fences.push(resolve)) : Promise.resolve(); }
    },
    async drain() { for (let i = 0; i < 8; i++) { this.fences.splice(0).forEach(resolve => resolve()); await tick(); } },
    async lose() { lose({ reason: 'destroyed' }); await tick(); }
  };
  return device;
}
function fixture({ exact = true, masses = [1 + 2 ** -30, 2 ** -10 + 2 ** -50, 0] } = {}) {
  const state = { smoothingLengthM: .1, step: 0, time: 0,
    particles: masses.map((massKg, index) => ({ id: `row-${index}`, material: 'unknown',
      massKg, x: [.1 * index, 0, 0], v: [0, 0, 0], specificInternalEnergyJPerKg: 0 })) };
  const format = createSphExactMassFormat();
  const options = exact ? { exactMass: { format, reference: 'explicit cold particle ownership fixture' } } : {};
  return { state, format, options, packed: buildSphGpuParticleBuffers(state, options), device: deviceFixture(), masses };
}

test('actual cold particle upload preserves binary64 masses outside the f32 projection', async () => {
  const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  assert.equal(f.packed.state[3], 1); assert.equal(f.packed.state[11], 2 ** -10);
  const held = acquireSphParticleExactMassRead(upload, f.device), words = new Uint32Array(held.read.buffer.bytes);
  for (let row = 0; row < f.masses.length; row++) {
    assert.deepEqual(words.slice(row * 9, (row + 1) * 9), encodeSphExactMass(f.masses[row], f.format));
  }
  assert.equal(upload.exactMassInventory, held.read.family);
  assert.equal(sphGpuParticleUploadMatchesDevice(upload, f.device), true);
  await releaseSphParticleExactMassRead(held); destroySphGpuParticleBuffers(upload); await f.device.drain();
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
});

test('legacy packing and upload allocate no exact inventory', async () => {
  const f = fixture({ exact: false }), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  assert.equal('exactMass' in f.packed, false); assert.equal('exactMassInventory' in upload, false);
  assert.equal(f.device.allocated.length, 3); assert.equal(sphGpuParticleUploadMatchesDevice(upload, f.device), true);
  assertSphLegacyMassPathAllowed({ sphParticleState: f.packed, sphParticleUpload: upload }, 'legacy');
  destroySphGpuParticleBuffers(upload); await f.device.drain();
});

test('cold SPH and MLS owners carry the same complete epoch tuple before sealing', async () => {
  const f = fixture();
  const epochs = { storageGeneration: 2, physicsTick: 3, physicsSubstep: 1,
    positionEpoch: 4, topologyEpoch: 5, chartEpoch: 6, levelEpoch: 7, supportEpoch: 8 };
  const state = { ...f.state, ...epochs };
  const packed = buildSphGpuParticleBuffers(state, f.options);
  const mls = buildMlsMpmGpuParticleBuffers(state);
  const upload = uploadSphGpuParticleBuffers(f.device, packed);
  const mlsUpload = uploadMlsMpmGpuParticleBuffers(f.device, mls);
  for (const [key, value] of Object.entries(epochs)) {
    assert.equal(packed[key], value); assert.equal(mls[key], value);
    assert.equal(upload[key], value); assert.equal(mlsUpload[key], value);
  }
  const held = acquireSphParticleExactMassRead(upload, f.device);
  upload.physicsSubstep++;
  assert.equal(validateSphParticleExactMassRead(held, { device: f.device, sourceSphUpload: upload }), false);
  upload.physicsSubstep--;
  await releaseSphParticleExactMassRead(held);
  destroySphGpuParticleBuffers(upload); destroyMlsMpmGpuParticleBuffers(mlsUpload);
  await f.device.drain();
});

test('a live held physical read can fork during retirement without reopening fresh admission', async () => {
  const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  const held = acquireSphParticleExactMassRead(upload, f.device);
  destroySphGpuParticleBuffers(upload);
  assert.throws(() => acquireSphParticleExactMassRead(upload, f.device), /original live upload/);
  const args = { device: f.device, sourceSphUpload: upload };
  assert.throws(() => forkSphParticleExactMassRead({ ...held }, args), /original held/);
  assert.throws(() => forkSphParticleExactMassRead(held, { ...args, sourceSphUpload: { ...upload } }), /original held/);
  const fork = forkSphParticleExactMassRead(held, args);
  await releaseSphParticleExactMassRead(held); await f.device.drain();
  assert.notEqual(upload.destroyed, true);
  assert.equal(validateSphParticleExactMassRead(fork, args), true);
  assert.throws(() => forkSphParticleExactMassRead(held, args), /original held/);
  await releaseSphParticleExactMassRead(fork); await f.device.drain();
  assert.equal(upload.destroyed, true);
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
});

test('cold capture refuses sparse, accessor, nonnumeric, negative and unprojectable masses', () => {
  const f = fixture();
  const badParticles = [Array(1), [undefined], [{ massKg: '1' }], [{ massKg: -1 }],
    [{ massKg: Infinity }], [{ massKg: 2 ** -149 }], [{ get massKg() { throw new Error('must not invoke mass getter'); } }]];
  for (const particles of badParticles) {
    assert.throws(() => buildSphGpuParticleBuffers({ ...f.state, particles }, f.options));
  }
  for (const extra of [{ step: 1 }, { time: .1 }, { cpuStateStale: true }, { cpuThermoStale: true }]) {
    assert.throws(() => buildSphGpuParticleBuffers({ ...f.state, ...extra }, f.options), /cold initial/);
  }
});

test('one captured mass drives the initial projection even if another particle getter changes the input', () => {
  const f = fixture(), mass = f.state.particles[0].massKg;
  Object.defineProperty(f.state.particles[0], 'material', { enumerable: true, get() {
    f.state.particles[0].massKg = 2; return 'unknown';
  } });
  const packed = buildSphGpuParticleBuffers(f.state, f.options);
  assert.equal(packed.state[3], Math.fround(mass));
});

for (const [name, mutate] of [
  ['mass bytes', p => { p.state[3] = 2; }],
  ['thermo phase', p => { p.thermo[1] = 7; }],
  ['identity bytes', p => { p.identity[0] = 9; }],
  ['row id', p => { p.metadata[0].id = 'substituted'; }],
  ['material', p => { p.metadata[0].material = 'water'; }],
  ['row order', p => { p.metadata.reverse(); }],
  ['topology', p => { p.topologyEpoch++; }],
  ['stride', p => { p.stateStrideBytes += 4; }],
  ['stale mirror', p => { p.cpuStateStale = true; }]
]) test(`changed cold ${name} rejects before GPU allocation`, () => {
  const f = fixture(); mutate(f.packed);
  assert.throws(() => uploadSphGpuParticleBuffers(f.device, f.packed), /changed|stale/);
  assert.equal(f.device.allocated.length, 0);
});

test('copied packed envelopes cannot drop the seed marker while retaining initial arrays', () => {
  const f = fixture();
  for (const omit of [false, true]) {
    const copied = { ...f.packed }; if (omit) delete copied.exactMass;
    assert.throws(() => uploadSphGpuParticleBuffers(f.device, copied), /copied|lost/);
  }
  assert.equal(f.device.allocated.length, 0);
});

test('upload uses private snapshots if caller changes public arrays during device allocation/write', async () => {
  const f = fixture();
  f.device.beforeWrite = () => { f.packed.state.fill(0); f.packed.thermo.fill(0); f.packed.identity.fill(99); };
  const upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  assert.equal(new Float32Array(upload.stateBuffer.bytes)[3], 1);
  assert.equal(new Uint32Array(upload.identityBuffer.bytes)[0], 0);
  destroySphGpuParticleBuffers(upload); await f.device.drain();
});

test('copied uploads cannot drop exact inventory or borrow the original buffers as legacy state', async () => {
  const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  for (const omit of [false, true]) {
    const copy = { ...upload }; if (omit) delete copy.exactMassInventory;
    assert.equal(sphGpuParticleUploadAdvertisesExactMass(copy), true);
    assert.equal(ensureSphGpuParticleBufferSetBorrowLifecycle(copy), false);
    assert.equal(sphGpuParticleUploadMatchesDevice(copy, f.device), false);
    assert.throws(() => acquireSphParticleExactMassRead(copy, f.device), /original live upload/);
    assert.throws(() => destroySphGpuParticleBuffers(copy), /original private upload owner/);
  }
  destroySphGpuParticleBuffers(upload); await f.device.drain();
});

test('mutable typed-array constructor cannot replace private upload bytes', async () => {
  const f = fixture();
  f.packed.state.constructor = function (buffer) { const changed = new Float32Array(buffer); changed[3] = 2; return changed; };
  const upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  assert.equal(new Float32Array(upload.stateBuffer.bytes)[3], 1);
  destroySphGpuParticleBuffers(upload); await f.device.drain();
});

test('changed upload row sizing or epoch rejects the physical read while original resources remain owned', async () => {
  for (const key of ['stateStrideBytes', 'thermoBufferByteLength', 'positionEpoch', 'storageGeneration']) {
    const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
    upload[key] = (upload[key] ?? 0) + 1;
    assert.equal(sphGpuParticleUploadMatchesDevice(upload, f.device), false);
    assert.throws(() => acquireSphParticleExactMassRead(upload, f.device), /original live upload/);
    destroySphGpuParticleBuffers(upload); await f.device.drain();
    assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
  }
});

test('replacing public borrow accounting neither unpins a held exact read nor admits new reads', async () => {
  const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  const held = acquireSphParticleExactMassRead(upload, f.device);
  Object.defineProperty(upload, '__ulgActiveBorrowCount', { value: 0, writable: true, configurable: true });
  assert.throws(() => acquireSphParticleExactMassRead(upload, f.device), /original live upload/);
  assert.equal(destroySphGpuParticleBuffers(upload), false);
  assert.equal(upload.stateBuffer.destroyed, 0);
  await releaseSphParticleExactMassRead(held); await f.device.drain();
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
});

test('public borrow decrements cannot release the private exact read hold', async () => {
  const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  const held = acquireSphParticleExactMassRead(upload, f.device);
  upload.__ulgActiveBorrowCount = 0;
  assert.equal(upload.__ulgActiveBorrowCount, 1);
  assert.equal(destroySphGpuParticleBuffers(upload), false);
  await releaseSphParticleExactMassRead(held); await f.device.drain();
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
});

test('active physical read delays both parent and inventory retirement until the queue completes', async () => {
  const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  const held = acquireSphParticleExactMassRead(upload, f.device);
  f.device.defer = true;
  assert.equal(destroySphGpuParticleBuffers(upload), false);
  assert.throws(() => acquireSphParticleExactMassRead(upload, f.device), /original live upload/);
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 0), true);
  const completion = releaseSphParticleExactMassRead(held); await tick();
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 0), true);
  await f.device.drain(); await completion;
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
  assert.equal(destroySphGpuParticleBuffers(upload), false);
  await releaseSphParticleExactMassRead(held);
});

test('terminal custom cleanup retires exact storage once after existing readers finish', async () => {
  const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  const held = acquireSphParticleExactMassRead(upload, f.device); let called = 0;
  assert.equal(runSphGpuParticleBufferSetCleanupAfterBorrows(upload, () => { called++; }, { terminalSourceRetirement: true }), true);
  assert.throws(() => acquireSphParticleExactMassRead(upload, f.device), /original live upload/);
  assert.equal(called, 0);
  await releaseSphParticleExactMassRead(held); await f.device.drain();
  assert.equal(called, 1); assert.equal(held.read.buffer.destroyed, 1);
  destroySphGpuParticleBuffers(upload); await f.device.drain();
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
});

test('failed exact allocation/write cleans up the already-uploaded particle family', async () => {
  const f = fixture(); f.device.failExactWrite = true;
  assert.throws(() => uploadSphGpuParticleBuffers(f.device, f.packed), /exact write failure/);
  await f.device.drain(); assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
});

test('confirmed device loss invalidates exact particle admission and permits held-read cleanup', async () => {
  const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  const held = acquireSphParticleExactMassRead(upload, f.device);
  await f.device.lose();
  assert.equal(sphGpuParticleUploadMatchesDevice(upload, f.device), false);
  assert.throws(() => acquireSphParticleExactMassRead(upload, f.device), /original live upload/);
  await releaseSphParticleExactMassRead(held); destroySphGpuParticleBuffers(upload); await f.device.drain();
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
});

test('unsupported raw-buffer writers and CPU fallbacks reject before any allocation or submit', async () => {
  const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed), allocated = f.device.allocated.length;
  const inputs = { device: f.device, sourceStateBuffer: upload.stateBuffer, sourceThermoBuffer: upload.thermoBuffer };
  for (const call of [
    () => createSphPhaseCarrierTransferWebGpuEncoderStage(inputs),
    () => createSphThermalStepWebGpuEncoderStage(inputs),
    () => runSphReactionStepWebGpu(inputs),
    () => runMlsMpmG2pWebGpu({ device: f.device, sphParticleUpload: upload }),
    () => runSphAerosolCondensateExtractionWebGpu(inputs),
    () => createSchroederSpatialReactionProductPlacementAuthorityWebGpu(inputs),
    () => runSchroederParticleStorageCompactionWebGpu({ device: f.device, stateBuffer: upload.stateBuffer }),
    () => runSphThermalStepCpu({ sphParticleState: f.packed }),
    () => runSphReactionStepCpu({ sphParticleState: f.packed }),
    () => reconstructMlsMpmG2pCpu({ sphParticleState: f.packed })
  ]) {
    await assert.rejects(async () => call(), /exact-inventory continuation/);
    assert.equal(f.device.allocated.length, allocated); assert.equal(f.device.submissions, 0);
  }
  destroySphGpuParticleBuffers(upload); await f.device.drain();
});
