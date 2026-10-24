import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  runSphSpatialVaporAerosolExchangeCandidate,
  observeSphSpatialVaporAerosolExchangeCandidate,
  releaseSphSpatialVaporAerosolExchangeCandidate
} from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';

test('public transfer cannot substitute descriptors for a private retained EOS', async () => {
  for (const source of [null, {}, { ready: true, particleProductSourcePaired: true,
    caloricMemberAdmissionEnabled: true, executionGeneration: 1 }]) {
    let accessed = false;
    const options = { get edges() { accessed = true; throw new Error('must not access'); } };
    await assert.rejects(runSphSpatialVaporAerosolExchangeCandidate(source, options), /exact paired caloric EOS/);
    assert.equal(accessed, false);
  }
});

test('unissued and copied numerical receipts cannot expose or retire candidate storage', async () => {
  for (const source of [null, {}, Object.freeze({ schema: 'peercompute.ulg.spatial-vapor-aerosol-candidate.v1',
    ready: true, conservativeTransferAdmitted: true })]) {
    await assert.rejects(observeSphSpatialVaporAerosolExchangeCandidate(source), /Unissued/);
    assert.equal(releaseSphSpatialVaporAerosolExchangeCandidate(source), false);
  }
});

test('source and pressure retirement explicitly protect the distinct exchange consumer', async () => {
  // Structural lifecycle regression checks complement the real pending-fence
  // and post-origin-retirement numerical cases in the native test.
  const source = await readFile(new URL('../src/runtime/sph/sphSpatialGasLedgerEosGpu.js', import.meta.url), 'utf8');
  const body = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start) + start.length));
  assert.match(body('function queueOrderedPressureRetirementContext(', 'function '), /record\.activeExchangeOperation/);
  assert.match(body('export function releaseSphSpatialGasLedgerEosAfterQueue(', 'async function mappedBufferCopy('), /record\.activeExchangeOperation/);
  assert.match(body('function livePressureSourceRecord(', 'function '), /record\.activeExchangeOperation/);
  assert.match(source, /mechanicsContinuationAdmitted: false, pressureRequiresRefresh: true/);
});
