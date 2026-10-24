import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  acquireSphAerosolSpatialGenerationRead as acquire,
  validateSphAerosolSpatialGenerationRead as validate,
  releaseSphAerosolSpatialGenerationRead as release,
  captureSphAerosolSpatialGeneration as capture,
  releaseSphAerosolSpatialTransaction as releaseCapture
} from '../src/runtime/sph/sphAerosolSpatialBinding.js';
import { releaseSphAerosolParcelFamily } from '../src/runtime/sph/sphAerosolParcelGpu.js';
import {
  createSchroederSpatialEpochTransaction, validateSchroederSpatialEpochTransactionSourceFamily,
  admitSchroederSpatialEpochTransactionReader, sealSchroederSpatialEpochTransactionReaders,
  sealSchroederSpatialEpochTransactionProposals, commitSchroederSpatialEpochTransaction,
  validateSchroederSpatialEpochTransactionCommit, SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE, abortSchroederSpatialEpochTransaction as abort,
  scheduleSchroederSpatialEpochTransactionRelease as retire
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { spatialFixture, initialFamily, fakeAerosolDevice } from './sphAerosolSpatialFixtures.mjs';

test('real SS transaction seals exact aerosol family and automatically selects it for volume', async () => {
  const f = spatialFixture(), read = acquire(f);
  assert.equal(read.family, f.family); assert.equal(read.spatialGeneration, f.generation);
  assert.equal(validate(read, f), true);
  assert.equal(validate({ ...read }, f), false);
  assert.equal(validate(read, { ...f, generation: { ...f.generation } }), false);
  assert.equal(validate(read, { ...f, device: fakeAerosolDevice() }), false);
  assert.equal(validate(read, { ...f, aerosolFamily: null }), false);
  assert.throws(() => acquire({ ...f, aerosolFamily: null }), /omitted or replaced/);
  assert.throws(() => acquire({ ...f, aerosolFamily: { ...f.family } }), /omitted or replaced/);
  assert.equal(release(read), true); assert.equal(release(read), false);
  assert.equal(validate(read, f), false);
  releaseSphAerosolParcelFamily(f.family); await f.device.finishQueue();
  assert.equal(read.buffer.destroyed, 0);
  abort(f.transaction); await f.device.finishQueue();
  assert.equal(read.buffer.destroyed, 1);
});

test('absent aerosol keeps legacy and captured paths allocation/dispatch free', () => {
  const f = spatialFixture({ withFamily: false, create: false });
  const count = f.device.buffers.length, dispatches = f.device.dispatches;
  assert.equal(acquire(f), null); assert.equal(validate(null, f), true);
  f.transaction = createSchroederSpatialEpochTransaction(f);
  assert.equal(acquire(f), null); assert.equal(validate(null, f), true);
  assert.equal(f.device.buffers.length, count); assert.equal(f.device.dispatches, dispatches);
});

test('no opaque family can be attached after SS captured absence, including a fresh transaction', () => {
  const f = spatialFixture({ withFamily: false });
  const family = initialFamily(f.device);
  assert.throws(() => acquire({ ...f, aerosolFamily: family }), /omitted or replaced/);
  f.sphParticleUpload.aerosolFamily = family;
  assert.equal(validateSchroederSpatialEpochTransactionSourceFamily(f.transaction, f), false);
  assert.throws(() => createSchroederSpatialEpochTransaction(f), /cannot replace or omit/);
  delete f.sphParticleUpload.aerosolFamily;
  assert.equal(acquire(f), null);
});

test('unsealed or forged SS source cannot provide aerosol authority', () => {
  const f = spatialFixture({ create: false });
  assert.throws(() => acquire({ ...f, aerosolFamily: f.family }), /omitted or replaced|not sealed/);
  assert.throws(() => capture({ ...f, transaction: {} }), /exact SS transaction/);
  const foreign = spatialFixture();
  assert.throws(() => capture({ ...f, transaction: foreign.transaction }), /exact SS transaction/);
});

test('same generation cannot omit or replace aerosol through another actual transaction', () => {
  const f = spatialFixture();
  assert.doesNotThrow(() => createSchroederSpatialEpochTransaction(f));
  for (const family of [null, initialFamily(f.device)]) {
    f.sphParticleUpload.aerosolFamily = family;
    assert.throws(() => createSchroederSpatialEpochTransaction(f), /cannot replace or omit/);
  }
  f.sphParticleUpload.aerosolFamily = f.family;
  assert.equal(validateSchroederSpatialEpochTransactionSourceFamily(f.transaction, f), true);
});

test('source metadata or buffer mutation invalidates an existing spatial read', async () => {
  const f = spatialFixture(), read = acquire(f);
  const state = f.sphParticleUpload.stateBuffer;
  delete f.sphParticleUpload.aerosolFamily;
  assert.equal(validate(read, f), false); assert.throws(() => acquire(f), /stale/);
  f.sphParticleUpload.aerosolFamily = f.family;
  f.sphParticleUpload.stateBuffer = f.sphParticleUpload.thermoBuffer;
  assert.equal(validate(read, f), false);
  f.sphParticleUpload.stateBuffer = state;
  assert.equal(validate(read, f), true);
  release(read); releaseSphAerosolParcelFamily(f.family); await f.device.finishQueue();
});

test('generation retirement invalidates reads without prematurely freeing submitted buffers', async () => {
  const f = spatialFixture(), read = acquire(f);
  f.generation.releaseScheduled = true;
  assert.equal(validate(read, f), false); assert.throws(() => acquire(f), /stale/);
  releaseSphAerosolParcelFamily(f.family); await f.device.finishQueue();
  assert.equal(read.buffer.destroyed, 0);
  release(read); await f.device.finishQueue(); assert.equal(read.buffer.destroyed, 0);
  abort(f.transaction); await f.device.finishQueue(); assert.equal(read.buffer.destroyed, 1);
});

test('actual transaction capture retains aerosol before its first consumer and permits exact consumer forks', async () => {
  const f = spatialFixture();
  releaseSphAerosolParcelFamily(f.family); await f.device.finishQueue();
  const read = acquire(f), second = acquire(f);
  assert.equal(validate(read, f), true); assert.equal(read.buffer.destroyed, 0);
  assert.equal(second.buffer, read.buffer);
  release(read); release(second); await f.device.finishQueue();
  assert.equal(read.buffer.destroyed, 0);
  abort(f.transaction); await f.device.finishQueue(); assert.equal(read.buffer.destroyed, 1);
  assert.throws(() => acquire(f), /stale/);
  assert.throws(() => capture(f), /exact SS transaction/);
});

test('one aborted transaction cannot retire a shared generation still owned by another actual transaction', async () => {
  const f = spatialFixture(), read = acquire(f);
  releaseSphAerosolParcelFamily(f.family); await f.device.finishQueue();
  const other = createSchroederSpatialEpochTransaction(f);
  assert.throws(() => releaseCapture(f.transaction, f.generation), /terminal transaction/);
  assert.equal(releaseCapture({ ...f.transaction, state: 'aborted' }, f.generation), false);
  abort(f.transaction); release(read); await f.device.finishQueue();
  const second = acquire(f);
  assert.equal(validate(second, f), true); assert.equal(second.buffer.destroyed, 0);
  abort(other); await f.device.finishQueue();
  assert.equal(validate(second, f), false); assert.equal(second.buffer.destroyed, 0);
  release(second); await f.device.finishQueue(); assert.equal(second.buffer.destroyed, 1);
});

for (const failure of ['false', 'reject']) test(`generation-owner ${failure} retains aerosol until actual retirement retry`, async () => {
  const f = spatialFixture(), read = acquire(f); seal(f);
  releaseSphAerosolParcelFamily(f.family);
  const next = { sphParticleUpload: { ...f.sphParticleUpload }, mlsMpmParticleUpload: { ...f.mlsMpmParticleUpload } };
  assert.equal(commitSchroederSpatialEpochTransaction(f.transaction, { nextParticleUploads: next }).published, true);
  const after = failure === 'false' ? Promise.resolve(false) : Promise.reject(new Error('unconfirmed generation'));
  if (failure === 'false') assert.equal(await retire(f.transaction, { after }), false);
  else await assert.rejects(retire(f.transaction, { after }), /unconfirmed generation/);
  assert.equal(f.transaction.state, 'release-blocked');
  release(read); await f.device.finishQueue(); assert.equal(read.buffer.destroyed, 0);
  assert.equal(await retire(f.transaction, { after: Promise.resolve(true) }), true);
  assert.equal(f.transaction.state, 'released');
  await f.device.finishQueue(); assert.equal(read.buffer.destroyed, 1);
  assert.throws(() => acquire(f), /stale/);
});

for (const failure of ['throw', 'reject']) test(`capture retirement ${failure} fence quarantines until device loss`, async () => {
  const f = spatialFixture(), read = acquire(f);
  release(read); releaseSphAerosolParcelFamily(f.family); await f.device.finishQueue();
  f.device.fenceFailure = failure;
  abort(f.transaction);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(read.buffer.destroyed, 0);
  await f.device.lose(); assert.equal(read.buffer.destroyed, 1);
});

test('SS source rejects a copied or cross-device family at transaction creation', () => {
  const f = spatialFixture({ create: false });
  for (const family of [{ ...f.family }, initialFamily(fakeAerosolDevice())]) {
    f.sphParticleUpload.aerosolFamily = family;
    assert.throws(() => createSchroederSpatialEpochTransaction(f), /exact live same-device/);
  }
});

function seal(f) {
  for (const [readerId, phase] of [
    [SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G, SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION],
    [SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P, SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT]
  ]) admitSchroederSpatialEpochTransactionReader(f.transaction, { ...f, readerId, phase });
  sealSchroederSpatialEpochTransactionReaders(f.transaction);
  sealSchroederSpatialEpochTransactionProposals(f.transaction);
}

test('actual SS commit preserves aerosol identity and rejects later omission or copied receipts', () => {
  const f = spatialFixture(); seal(f);
  const next = { sphParticleUpload: { ...f.sphParticleUpload }, mlsMpmParticleUpload: { ...f.mlsMpmParticleUpload } };
  const receipt = commitSchroederSpatialEpochTransaction(f.transaction, { nextParticleUploads: next });
  assert.equal(receipt.nextAerosolFamily, f.family);
  const input = { nextParticleUploads: next, expectedGeneration: f.generation };
  assert.equal(validateSchroederSpatialEpochTransactionCommit(f.transaction, receipt, input), true);
  assert.equal(validateSchroederSpatialEpochTransactionCommit(f.transaction, { ...receipt }, input), false);
  delete next.sphParticleUpload.aerosolFamily;
  assert.equal(validateSchroederSpatialEpochTransactionCommit(f.transaction, receipt, input), false);
});

test('unpaired reservoir replacement or deletion rejects before SS commit and permits a correct retry', () => {
  const f = spatialFixture(); seal(f);
  const next = { sphParticleUpload: { ...f.sphParticleUpload }, mlsMpmParticleUpload: { ...f.mlsMpmParticleUpload } };
  for (const family of [null, initialFamily(f.device), { ...f.family }]) {
    next.sphParticleUpload.aerosolFamily = family;
    assert.throws(() => commitSchroederSpatialEpochTransaction(f.transaction,
      { nextParticleUploads: next }), /paired carrier\/aerosol commit authority/);
    assert.equal(f.transaction.state, 'proposals-sealed');
  }
  next.sphParticleUpload.aerosolFamily = f.family;
  assert.equal(commitSchroederSpatialEpochTransaction(f.transaction, { nextParticleUploads: next }).published, true);
});

test('SS aerosol source metadata never invokes accessors or accepts inherited declarations', () => {
  for (const inherited of [false, true]) {
    const f = spatialFixture({ create: false }); let reads = 0;
    const target = inherited ? {} : f.sphParticleUpload;
    if (inherited) {
      delete f.sphParticleUpload.aerosolFamily;
      Object.setPrototypeOf(f.sphParticleUpload, target);
    }
    Object.defineProperty(target, 'aerosolFamily', { get() { reads++; return f.family; }, configurable: true });
    assert.throws(() => createSchroederSpatialEpochTransaction(f), /own data property|inherited metadata/);
    assert.equal(reads, 0);
  }
});
