import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat, encodeSphExactMass } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { encodeSphExactSigned, decodeSphExactSignedUnits, sphExactUnitsFromF32Bits }
  from '../ulg-gpu-abi/src/sphExactSignedLedger.js';
import { resolveSphExactParticleMassSeed } from '../src/runtime/sph/sphExactMassParticleSeed.js';
import { acquireSphExactMassRead, forkSphExactMassRead, sliceSphExactMassRead,
  releaseSphExactMassRead, releaseSphExactMassInventory } from '../src/runtime/sph/sphExactMassInventoryGpu.js';
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

test('cold upload seeds signed energy rows as the rounded f32 product of the solver mass and specific energy', async () => {
  const f = fixture({ masses: [1 + 2 ** -30, 2 ** -10 + 2 ** -50, 3.5] });
  f.state.particles.forEach((particle, index) => { particle.specificInternalEnergyJPerKg = [3.25e5, -1234.5, 77.125][index]; });
  f.packed = buildSphGpuParticleBuffers(f.state, f.options);
  const upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  const held = acquireSphParticleExactMassRead(upload, f.device);
  const energyBuffers = f.device.allocated.filter(buffer => buffer.label === 'ulg-exact-energy-initial');
  assert.equal(energyBuffers.length, 1);
  assert.equal(held.energy.energyBuffer, energyBuffers[0]);
  assert.equal(held.energy.rowCount, 3); assert.equal(held.energy.format, held.read.format);
  const words = new Uint32Array(energyBuffers[0].bytes);
  // [U rows][S rows][control]: three rows of nine words, twice, then four.
  assert.equal(words.length, 2 * 3 * 9 + 4);
  for (let row = 0; row < 3; row++) {
    const m = f.packed.state[row * 8 + 3], u = f.packed.state[row * 8 + 7];
    const product = Math.fround(m * u);
    assert.notEqual(product, 0);
    // U0 = fl32(m*u): the GPU recomputes this product bit for bit.
    assert.deepEqual(words.slice(row * 9, (row + 1) * 9), encodeSphExactSigned(product, f.format));
    assert.equal(decodeSphExactSignedUnits(words.slice(row * 9, (row + 1) * 9), f.format),
      sphExactUnitsFromF32Bits(new Uint32Array(new Float32Array([product]).buffer)[0], f.format));
  }
  assert.ok(words.slice(27).every(word => word === 0), 'cold S rows and control are clear');
  await releaseSphParticleExactMassRead(held); destroySphGpuParticleBuffers(upload); await f.device.drain();
  assert.equal(energyBuffers[0].destroyed, 1);
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
});

test('a run format other than the energy ledger format seeds no energy rows and keeps exact mass', async () => {
  const f = fixture({ masses: [2 ** -120, 1] });
  const format = createSphExactMassFormat({ wordCount: 66, quantumExponent: -1074 });
  f.packed = buildSphGpuParticleBuffers(f.state,
    { exactMass: { format, reference: 'wide run format without an energy ledger' } });
  assert.equal(resolveSphExactParticleMassSeed(f.packed).energyRowsStatus,
    'run-format-is-not-the-energy-ledger-format');
  const upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  const held = acquireSphParticleExactMassRead(upload, f.device);
  assert.equal(held.energy, null);
  assert.equal(f.device.allocated.some(buffer => buffer.label === 'ulg-exact-energy-initial'), false);
  assert.deepEqual(new Uint32Array(held.read.buffer.bytes).slice(0, 66), encodeSphExactMass(2 ** -120, format));
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

async function coldQuantityFixture() {
  const { createReferenceMaterialClosures } = await import('../src/runtime/material/materialClosures.js');
  const { specificInternalEnergyJPerKg } = await import('../src/runtime/material/thermoState.js');
  const f = fixture(), materialProperties = { fe: createReferenceMaterialClosures().fe.properties };
  for (const particle of f.state.particles) {
    particle.material = 'fe'; particle.v = [.1, -.2, .3];
    particle.specificInternalEnergyJPerKg = specificInternalEnergyJPerKg(materialProperties.fe, 300);
  }
  f.packed = buildSphGpuParticleBuffers(f.state, { ...f.options,
    exactMass: { ...f.options.exactMass, initialQuantities: true }, materialProperties });
  f.packedMls = buildMlsMpmGpuParticleBuffers(f.state, { materialProperties });
  f.upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  f.mls = uploadMlsMpmGpuParticleBuffers(f.device, f.packedMls);
  return f;
}

test('the original cold pair seeds one conserved quantity owner before its first mechanics read', async () => {
  const f = await coldQuantityFixture();
  const originalMolar = f.packed.metadata[0].molarMassBits;
  // Upload snapshots, rather than later CPU edits, define the initial family.
  f.packed.metadata[0].molarMassBits = 0; f.packed.state[4] = 100;
  f.packedMls.mechanics[19] = 0;
  const options = { mlsMpmParticleUpload: f.mls };
  const a = acquireSphParticleExactMassRead(f.upload, f.device, options);
  const b = acquireSphParticleExactMassRead(f.upload, f.device, options);
  assert.ok(a.quantities);
  assert.equal(a.quantities, b.quantities);
  assert.equal(f.device.allocated.filter(buffer => buffer.label === 'ulg-exact-particle-initial-quantities').length, 1);
  const q = a.quantities.quantityBuffer, words = new Uint32Array(q.bytes);
  assert.equal(words[4], originalMolar);
  assert.equal(words[0], 1); assert.equal(words[1], 0);
  assert.throws(() => assertSphLegacyMassPathAllowed({ sourceStateBuffer: q }, 'initial quantity alias'), /legacy mass path/);
  destroySphGpuParticleBuffers(f.upload); destroyMlsMpmGpuParticleBuffers(f.mls);
  await releaseSphParticleExactMassRead(a); await f.device.drain();
  assert.equal(q.destroyed, 0);
  await releaseSphParticleExactMassRead(b); await f.device.drain();
  assert.equal(q.destroyed, 1);
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
});

test('a failed cold quantity upload frees its candidate and does not acquire a reader', async () => {
  const f = await coldQuantityFixture(), options = { mlsMpmParticleUpload: f.mls };
  f.device.beforeWrite = buffer => {
    if (buffer.label === 'ulg-exact-particle-initial-quantities') throw new Error('quantity write failed');
  };
  assert.throws(() => acquireSphParticleExactMassRead(f.upload, f.device, options), /quantity write failed/);
  assert.equal(f.device.allocated.at(-1).destroyed, 1);
  f.device.beforeWrite = null;
  const held = acquireSphParticleExactMassRead(f.upload, f.device, options);
  assert.ok(held.quantities);
  await releaseSphParticleExactMassRead(held);
  destroySphGpuParticleBuffers(f.upload); destroyMlsMpmGpuParticleBuffers(f.mls);
  await f.device.drain();
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
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

test('scene-issued cold generation seals original SPH and MLS ownership before reads', async () => {
  const f = fixture(), options = { initialStorageGeneration: 7 };
  const packedMls = buildMlsMpmGpuParticleBuffers(f.state);
  const sph = uploadSphGpuParticleBuffers(f.device, f.packed, options);
  const mls = uploadMlsMpmGpuParticleBuffers(f.device, packedMls, options);
  assert.equal(sph.storageGeneration, 7);
  assert.equal(mls.storageGeneration, 7);
  assert.equal(mls.bufferFamilyGeneration, 7);
  const held = acquireSphParticleExactMassRead(sph, f.device, { mlsMpmParticleUpload: mls });
  assert.throws(() => acquireSphParticleExactMassRead(sph, f.device,
    { mlsMpmParticleUpload: { ...mls } }), /original live MLS owner/);
  mls.bufferFamilyGeneration = 8;
  assert.equal(validateSphParticleExactMassRead(held, { device: f.device, sourceSphUpload: sph }), false);
  mls.bufferFamilyGeneration = 7;
  assert.equal(validateSphParticleExactMassRead(held, { device: f.device, sourceSphUpload: sph }), true);
  await releaseSphParticleExactMassRead(held);
  destroySphGpuParticleBuffers(sph); destroyMlsMpmGpuParticleBuffers(mls);
  await f.device.drain();
  assert.equal(f.device.allocated.every(buffer => buffer.destroyed === 1), true);
  const allocations = f.device.allocated.length;
  for (const initialStorageGeneration of [0, -1, 1.5, 2 ** 32]) {
    assert.throws(() => uploadMlsMpmGpuParticleBuffers(f.device, packedMls,
      { initialStorageGeneration }), /Initial upload generation/);
  }
  const declared = buildMlsMpmGpuParticleBuffers({ ...f.state, storageGeneration: 3 });
  assert.throws(() => uploadMlsMpmGpuParticleBuffers(f.device, declared, options), /Initial upload generation/);
  assert.equal(f.device.allocated.length, allocations);
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

for (const numericFirst of [false, true]) test(`numeric-only window and carrier retire independently (${numericFirst ? 'numeric' : 'carrier'} first)`, async () => {
  const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  const physical = acquireSphParticleExactMassRead(upload, f.device);
  const window = sliceSphExactMassRead(physical.read, { device: f.device, rowOffset: 1, rowCount: 1 });
  assert.deepEqual(upload.exactMassInventoryRange, { rowOffset: 0, rowCount: 3 });
  assert.equal(Object.isFrozen(upload.exactMassInventoryRange), true);
  assert.throws(() => { upload.exactMassInventoryRange = { rowOffset: 1, rowCount: 2 }; }, TypeError);
  await releaseSphParticleExactMassRead(physical);
  if (numericFirst) {
    await releaseSphExactMassRead(window);
    assert.equal(window.buffer.destroyed, 0);
    assert.equal(upload.identityBuffer.destroyed, 0);
    const again = acquireSphParticleExactMassRead(upload, f.device);
    await releaseSphParticleExactMassRead(again);
  }
  destroySphGpuParticleBuffers(upload); await f.device.drain();
  assert.equal(upload.stateBuffer.destroyed, 1);
  assert.equal(upload.thermoBuffer.destroyed, 1);
  assert.equal(upload.identityBuffer.destroyed, 1, 'numeric-only reader does not pin carrier identity');
  if (!numericFirst) {
    assert.equal(window.buffer.destroyed, 0);
    assert.throws(() => acquireSphExactMassRead({ family: window.family, device: f.device }), /live original/);
    const fork = forkSphExactMassRead(window, { device: f.device });
    assert.deepEqual([fork.rowOffset, fork.rowCount], [1, 1]);
    await releaseSphExactMassRead(window);
    assert.equal(fork.buffer.destroyed, 0);
    f.device.defer = true;
    const release = releaseSphExactMassRead(fork);
    assert.equal(fork.buffer.destroyed, 0);
    await f.device.drain(); await release;
  }
  await f.device.drain();
  assert.ok(f.device.allocated.every(buffer => buffer.destroyed === 1));
});

test('closing root admission does not prevent genuine physical owner reads from forking their retained range', async () => {
  const f = fixture(), upload = uploadSphGpuParticleBuffers(f.device, f.packed);
  releaseSphExactMassInventory(upload.exactMassInventory);
  assert.throws(() => acquireSphExactMassRead({ family: upload.exactMassInventory, device: f.device }), /live original/);
  const physical = acquireSphParticleExactMassRead(upload, f.device);
  assert.deepEqual([physical.read.rowOffset, physical.read.rowCount], [0, f.packed.particleCount]);
  await releaseSphParticleExactMassRead(physical); destroySphGpuParticleBuffers(upload); await f.device.drain();
  assert.ok(f.device.allocated.every(buffer => buffer.destroyed === 1));
});
