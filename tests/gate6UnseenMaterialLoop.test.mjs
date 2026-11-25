import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_FOUNDATION_POLYTOPE_HOTSWAP_SCHEMA,
  admitDynamicPolytopeAtlasOnDevice,
  getFoundationPolytopeDeviceStatus,
  getFoundationPolytopeGpuBinding,
  lookupDynamicPolytopeRecordOnDevice,
  lookupFoundationPolytopeRecord,
  rebuildFoundationPolytopeBankOnDevice,
  validateAdmissiblePolytopeAtlas
} from '../src/runtime/material/foundationPolytopeAtlasGpuBridge.js';
import { ReservationLedger } from '../src/runtime/peercomputeCore.js';
import { stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import { ULG_ACCURACY_TIERS } from '../ulg-gpu-abi/src/materialFoundationAbi.js';

function createMockGpuDevice() {
  const buffers = [];
  const destroyed = [];
  return {
    buffers,
    destroyed,
    createBuffer(desc) {
      const buf = {
        label: desc.label || '',
        size: desc.size,
        usage: desc.usage,
        data: null,
        destroyed: false,
        destroy() {
          this.destroyed = true;
          destroyed.push(this);
        }
      };
      buffers.push(buf);
      return buf;
    },
    queue: {
      writeBuffer(buf, offset, data) {
        buf.data = new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        buf.writeOffset = offset;
      },
      onSubmittedWorkDone() {
        return Promise.resolve();
      }
    }
  };
}

function makeValidPolytopeAtlas(materialKey, { density = 2750, tMax = 1000 } = {}) {
  const poly = Object.freeze({
    polytopeId: `${materialKey}:solid:0`,
    materialKey,
    family: 'compound',
    phase: 'solid',
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    closureHash: `ulg:test:${materialKey}`,
    invalidationKey: `ulg:test:${materialKey}`,
    axes: Object.freeze([
      Object.freeze({ name: 'temperatureK', unit: 'K', min: 50, max: tMax }),
      Object.freeze({ name: 'pressurePa', unit: 'Pa', min: 1e2, max: 1e10, scale: 'log10' })
    ]),
    inequalities: Object.freeze([
      Object.freeze({ a: [-1, 0], b: -50, scale: tMax - 50 }),
      Object.freeze({ a: [1, 0], b: tMax, scale: tMax - 50 }),
      Object.freeze({ a: [0, -1], b: -2, scale: 8 }),
      Object.freeze({ a: [0, 1], b: 10, scale: 8 })
    ]),
    fit: Object.freeze({
      valid: true,
      degrees: [1, 1],
      coefficients: new Float32Array([density, 0, -0.05 * density, 0]),
      maxRelativeError: 0.005,
      uncertaintyBound: 0.01
    })
  });
  return Object.freeze({
    materialKey,
    family: 'compound',
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    closureHash: `ulg:test:${materialKey}`,
    polytopes: Object.freeze([poly]),
    cacheStatus: 'miss-stored',
    cacheBackend: 'memory',
    cacheKey: `${materialKey}-test`
  });
}

test('Gate 6 Phase E: KBr and GeO2 are genuinely absent from static foundation-polytope-atlas.json', () => {
  assert.equal(lookupFoundationPolytopeRecord('KBr'), null);
  assert.equal(lookupFoundationPolytopeRecord('kbr'), null);
  assert.equal(lookupFoundationPolytopeRecord('GeO2'), null);
  assert.equal(lookupFoundationPolytopeRecord('geo2'), null);
  assert.ok(lookupFoundationPolytopeRecord('H2O') != null, 'static H2O baseline still present');
});

test('Gate 6 Phase E: admitDynamicPolytopeAtlasOnDevice enforces fail-closed validation and PeerCompute ReservationLedger CAS fencing', () => {
  const device = createMockGpuDevice();
  const initialBank = rebuildFoundationPolytopeBankOnDevice(device, ['h2o', 'fe']);
  assert.ok(initialBank && initialBank.generation === 1);
  const initialBuf = getFoundationPolytopeGpuBinding(device).atlasBuffer;

  // 1. Fail-closed validation rejects unfitted / NaN / empty atlases BEFORE mutating device state
  assert.throws(
    () => validateAdmissiblePolytopeAtlas({ polytopes: [] }, 'KBr'),
    (err) => err.code === 'ERR_POLYTOPE_ATLAS_INVALID_FAIL_CLOSED'
  );
  assert.throws(
    () => admitDynamicPolytopeAtlasOnDevice(device, {
      materialKey: 'KBr',
      atlas: {
        materialKey: 'KBr',
        polytopes: [{
          polytopeId: 'KBr:bad',
          phase: 'solid',
          axes: [{ name: 'temperatureK', min: 10, max: 500 }, { name: 'pressurePa', min: 100, max: 1e8 }],
          inequalities: [{ a: [-1, 0], b: -10 }, { a: [1, 0], b: 500 }],
          fit: { valid: false, degrees: [0, 0], coefficients: new Float32Array(0) }
        }]
      }
    }),
    (err) => err.code === 'ERR_POLYTOPE_ATLAS_INVALID_FAIL_CLOSED'
  );
  assert.equal(lookupDynamicPolytopeRecordOnDevice(device, 'KBr'), null);
  assert.equal(getFoundationPolytopeGpuBinding(device).generation, 1);

  // 2. CAS busy rejection: another consumer holding an active reservation blocks admission fail-closed
  const ledger = new ReservationLedger({ name: 'test-phase-e-cas', maxKeys: 16 });
  const competitor = ledger.reserve({ key: 'polytope-bank:kbr', consumerId: 'peer-worker-1' });
  assert.equal(competitor.ok, true);
  assert.throws(
    () => admitDynamicPolytopeAtlasOnDevice(device, {
      materialKey: 'KBr',
      atlas: makeValidPolytopeAtlas('KBr'),
      consumerId: 'peer-worker-2',
      reservationLedger: ledger
    }),
    (err) => err.code === 'ERR_POLYTOPE_HOTSWAP_BUSY'
  );
  assert.equal(lookupDynamicPolytopeRecordOnDevice(device, 'KBr'), null);
  ledger.cancel(competitor.token);

  // 3. Stale expectedEpoch rejected fail-closed
  assert.throws(
    () => admitDynamicPolytopeAtlasOnDevice(device, {
      materialKey: 'KBr',
      atlas: makeValidPolytopeAtlas('KBr'),
      reservationLedger: ledger,
      expectedEpoch: 99
    }),
    (err) => err.code === 'ERR_POLYTOPE_HOTSWAP_STALE_EPOCH'
  );

  // 4. Clean admission succeeds, increments bankGeneration, swaps GPU buffer, and preserves static materials
  const r1 = admitDynamicPolytopeAtlasOnDevice(device, {
    materialKey: 'KBr',
    formula: 'KBr',
    atlas: makeValidPolytopeAtlas('KBr', { density: 2750 }),
    reservationLedger: ledger,
    consumerId: 'quantum-worker-a'
  });
  assert.equal(r1.schema, ULG_FOUNDATION_POLYTOPE_HOTSWAP_SCHEMA);
  assert.equal(r1.admitted, true);
  assert.equal(r1.materialId, stableOpticalMaterialId('kbr'));
  assert.equal(r1.bankGeneration, 2);
  assert.equal(r1.reservationEpoch, 0);
  assert.ok(r1.materialCount > initialBank.materialCount);
  assert.notEqual(r1.atlasBuffer, initialBuf);
  assert.ok(lookupDynamicPolytopeRecordOnDevice(device, 'KBr') != null);

  // 5. Re-admission retires prior epoch cleanly (epoch 0 -> 1) and bumps generation (2 -> 3)
  const r2 = admitDynamicPolytopeAtlasOnDevice(device, {
    materialKey: 'KBr',
    formula: 'KBr',
    atlas: makeValidPolytopeAtlas('KBr', { density: 2760, tMax: 1200 }),
    reservationLedger: ledger,
    consumerId: 'quantum-worker-b'
  });
  assert.equal(r2.admitted, true);
  assert.equal(r2.bankGeneration, 3);
  assert.equal(r2.reservationEpoch, 1);

  // Subsequent rebuildFoundationPolytopeBankOnDevice retains dynamic materials!
  const rebuilt = rebuildFoundationPolytopeBankOnDevice(device, ['h2o']);
  assert.equal(rebuilt.generation, 4);
  assert.equal(rebuilt.materialCount, r2.materialCount);

  const status = getFoundationPolytopeDeviceStatus(device);
  assert.equal(status.dynamicMaterialCount, 1);
  assert.deepEqual(status.dynamicMaterialKeys, ['KBr']);
  assert.equal(status.hotSwapCount, 2);
  assert.equal(status.retiredHotSwapCount, 1);
  ledger.destroy();
});
