import assert from 'node:assert/strict';
import test from 'node:test';
import {
  retainSphPostMechanicsGasSourcePair,
  resolveSphPostMechanicsGasSpatialSource,
  canReleaseSphPostMechanicsGasSpatialBinding,
  releaseSphPostMechanicsGasStateAfterQueue
} from '../src/runtime/sph/sphPostMechanicsGasStateGpu.js';
import {
  captureSphAerosolPostMechanicsGasGeneration,
  releaseSphAerosolPostMechanicsGasGeneration
} from '../src/runtime/sph/sphAerosolSpatialBinding.js';
import { sphSpatialGasLedgerCandidateUnionAdapterWgsl } from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  runSchroederSpatialEpochGenerationWebGpu,
  isUnsubmittedSchroederSpatialEpochGeneration
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';

test('unsubmitted generation evidence requires the actual rejected build and exact device', () => {
  const device = { createCommandEncoder() { throw new Error('no GPU build expected'); },
    queue: { submit() { throw new Error('no submission expected'); } } };
  const rejected = runSchroederSpatialEpochGenerationWebGpu({ device });
  assert.equal(rejected.ready, false);
  assert.equal(isUnsubmittedSchroederSpatialEpochGeneration(rejected, device), true);
  assert.equal(isUnsubmittedSchroederSpatialEpochGeneration({ ...rejected }, device), false);
  assert.equal(isUnsubmittedSchroederSpatialEpochGeneration(rejected, {}), false);
  assert.equal(isUnsubmittedSchroederSpatialEpochGeneration(null, undefined), false);
  rejected.releaseScheduled = true;
  rejected.ready = true;
  assert.equal(isUnsubmittedSchroederSpatialEpochGeneration(rejected, device), true);
});

test('private current gas source cannot be manufactured from structural EOS/generation metadata', () => {
  const device = {}, generation = { ready: true, selected: true };
  const source = Object.freeze({ schema: 'peercompute.ulg.post-mechanics-gas-source.v1',
    generation, epochIdentity: {}, particleCount: 1 });
  assert.throws(() => resolveSphPostMechanicsGasSpatialSource(source, { device, generation }), /exact live private source/);
  assert.throws(() => retainSphPostMechanicsGasSourcePair(source, { device, generation }), /exact live private source/);
  assert.equal(canReleaseSphPostMechanicsGasSpatialBinding(source, generation), false);
});

test('unissued and copied current gas results cannot trigger retirement or device access', () => {
  const device = new Proxy({}, { get() { throw new Error('must not touch device'); } });
  for (const result of [null, {}, Object.freeze({ ready: true,
    schema: 'peercompute.ulg.post-mechanics-gas-state.v1' })]) {
    assert.throws(() => releaseSphPostMechanicsGasStateAfterQueue(result, { device }), /exact same-device result/);
  }
});

test('derived aerosol binding refuses a caller-issued source, including sealed-looking absence', async () => {
  const device = {}, generation = { ready: true, selected: true };
  const source = { aerosolFamily: null, generation };
  await assert.rejects(captureSphAerosolPostMechanicsGasGeneration(source, { device, generation }), /exact live private source/);
  assert.throws(() => releaseSphAerosolPostMechanicsGasGeneration(source, generation), /completed private geometry owner/);
});

test('current complete occupancy veto is runtime data and preserves the default gas selection branch', () => {
  assert.match(sphSpatialGasLedgerCandidateUnionAdapterWgsl, /require_complete_occupancy: u32/);
  const branch = sphSpatialGasLedgerCandidateUnionAdapterWgsl.slice(
    sphSpatialGasLedgerCandidateUnionAdapterWgsl.indexOf('if (!gas_routed_ready)'));
  assert.match(branch, /if \(params\.require_complete_occupancy != 0u\)/);
  assert.match(branch, /!finite_f32\(residual_mass\) \|\| residual_mass != 0\.0/);
  assert.match(branch, /atomicOr\(&authority\[3u\], ERROR_INVALID_CANDIDATE\)/);
});
