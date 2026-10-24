import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_FLOATS,
  computeSphSpatialGasCandidateUnionCpuOracle
} from '../ulg-gpu-abi/src/index.js';
import {
  decodeSphSpatialGasMixtureMomentRows,
  sphSpatialGasMixtureMomentsWgsl
} from '../src/runtime/sph/sphSpatialGasMixtureMoments.js';
import { sphSpatialGasLedgerEosWgsl } from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';

test('compact mixture members preserve source signed u, original T, phase and donor address', () => {
  const events = new Float32Array(64);
  events.set([0.25, 0.25, 0.25, 1, 17, 7, 0, 99, 0, 4, 1, 3,
    0.75, 0.25, 1, 0.25, 400, 2, 1, -50]);
  events.set([0.25, 0.25, 0.25, 2, 17, 8, 0, 99, 0, 8, 1, 3,
    2, 0, 1, 0.25, 0, 2, 1, NaN], 32);
  const state = new Float32Array([0.3, 0.25, 0.25, 0.5, 0, 0, 0, -100]);
  const thermo = new Float32Array([31, 3, 300, 2, 0, 0, 1, 0, 1, 3.01107038e23, 1, 0.1]);
  const result = computeSphSpatialGasCandidateUnionCpuOracle({
    productEventRows: events, particleStateRows: state, particleThermoRows: thermo
  });
  assert.equal(result.admitted, true);
  assert.equal(SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_FLOATS, 16);
  assert.equal(result.liveCount, 2);
  assert.deepEqual(result.rows.map(row => [row.sourceKind, row.sourceIndex,
    row.massKg, row.sourceSpecificInternalEnergyJPerKg, row.sourceTemperatureK, row.sourcePhaseId]),
  [['product-event', 0, 0.25, -50, 400, 3], ['particle', 0, 0.5, -100, 300, 3]]);
  assert.equal(result.rows[0].massKg * result.rows[0].sourceSpecificInternalEnergyJPerKg, -12.5);
  // Neither malformed source energy nor fallback T is laundered into a
  // physical caloric input by the legacy pressure reference.
  events[16] = NaN;
  events[19] = Infinity;
  const fallback = computeSphSpatialGasCandidateUnionCpuOracle({ productEventRows: events });
  assert.equal(fallback.admitted, true);
  assert.equal(fallback.rows[0].temperatureK, Math.fround(293.15));
  assert.ok(Number.isNaN(fallback.rows[0].sourceTemperatureK));
  assert.equal(fallback.rows[0].sourceSpecificInternalEnergyJPerKg, Infinity);
});

test('mixture observation distinguishes unavailable inventory from physical zero and caloric authority', () => {
  const cells = decodeSphSpatialGasMixtureMomentRows(new Float32Array([
    1, -12.5, 1.75, 675, 300, 500, 3, 1,
    0, 0, 0, 0, 0, 0, 0, 6
  ]));
  assert.equal(cells[0].internalEnergyJ, -12.5);
  assert.equal(cells[0].ready, true);
  assert.equal(cells[0].caloricClosureAdmitted, false);
  assert.equal(cells[0].exchangeAuthority, false);
  assert.equal(cells[1].ready, false);
  assert.equal(cells[1].internalEnergyJ, null);
  assert.equal(cells[1].massKg, null);
  assert.equal(cells[1].statusFlags, 6);
  assert.throws(() => decodeSphSpatialGasMixtureMomentRows(new Float32Array(7)), /eight-float/);
  assert.throws(() => decodeSphSpatialGasMixtureMomentRows([]), /eight-float/);
});

test('mixture reduction is part of the existing SS aggregate, with no new spatial traversal pass', () => {
  assert.ok(sphSpatialGasLedgerEosWgsl.includes(sphSpatialGasMixtureMomentsWgsl));
  assert.match(sphSpatialGasLedgerEosWgsl, /mixture = gas_mixture_add\(mixture, row\)/);
  assert.match(sphSpatialGasLedgerEosWgsl, /gas_mixture_write\(cell_index, mixture\)/);
  assert.equal((sphSpatialGasLedgerEosWgsl.match(/@compute/g) ?? []).length, 3);
  assert.doesNotMatch(sphSpatialGasMixtureMomentsWgsl, /fallback_temperature|latent.*\+/);
});
