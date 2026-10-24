import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as abi from '../ulg-gpu-abi/src/sphAerosolParcel.js';
import {
  sphAerosolParcelInitializeWgsl,
  sphAerosolInventoryPartialsWgsl,
  sphAerosolInventoryFinalizeWgsl
} from '../src/runtime/sph/sphAerosolParcelWgsl.js';

test('aerosol parcel and combined inventory ABIs have disjoint exact integer and physical lanes', () => {
  assert.equal(abi.ULG_SPH_AEROSOL_PARCEL_SCHEMA, 'peercompute.ulg.sph-aerosol-parcel.v0');
  assert.equal(abi.ULG_SPH_AEROSOL_BUDGET_SCHEMA, 'peercompute.ulg.sph-carrier-aerosol-inventory-budget.v0');
  assert.equal(abi.SPH_AEROSOL_PARCEL_BYTES, 96);
  assert.equal(abi.SPH_AEROSOL_BUDGET_BYTES, 160);
  assert.equal(abi.SPH_AEROSOL_PARCEL_WORDS * 4, abi.SPH_AEROSOL_PARCEL_BYTES);
  assert.equal(abi.SPH_AEROSOL_BUDGET_WORDS * 4, abi.SPH_AEROSOL_BUDGET_BYTES);
  assert.equal(abi.SPH_AEROSOL_BUDGET_MAGIC, 0x41494230);
  assert.equal(abi.SPH_AEROSOL_BUDGET_VERSION, 0);
  for (const [offsets, count] of [[abi.SPH_AEROSOL_PARCEL_OFFSETS, 24], [abi.SPH_AEROSOL_BUDGET_OFFSETS, 40]]) {
    assert.equal(Object.isFrozen(offsets), true);
    assert.deepEqual(Object.values(offsets), Array.from({ length: count }, (_, index) => index));
  }
  const p = abi.SPH_AEROSOL_PARCEL_OFFSETS;
  const bytes = new ArrayBuffer(abi.SPH_AEROSOL_PARCEL_BYTES);
  const words = new Uint32Array(bytes), floats = new Float32Array(bytes);
  const n = (1n << 63n) + (1n << 24n) + 7n;
  words[p.MULTIPLICITY_LO] = Number(n & 0xffffffffn);
  words[p.MULTIPLICITY_HI] = Number(n >> 32n);
  floats[p.MASS] = 0.5;
  floats[p.SPECIFIC_INTERNAL_ENERGY] = -10;
  floats[p.RADIUS] = 0.001;
  assert.equal((BigInt(words[p.MULTIPLICITY_HI]) << 32n) | BigInt(words[p.MULTIPLICITY_LO]), n);
  assert.equal(floats[p.SPECIFIC_INTERNAL_ENERGY], -10);
  assert.equal(words[p.STATUS], 0);
});

test('aerosol ABI distinguishes explicit initial mass from paired condensate provenance', () => {
  assert.deepEqual(abi.SPH_AEROSOL_PARCEL_STATUS, { INACTIVE: 0, READY: 1, INVALID: 255 });
  assert.deepEqual(abi.SPH_AEROSOL_PARCEL_SOURCE_KIND, { INITIAL_CONDITIONS: 1, PRE_TRANSFER_CONDENSATE: 2 });
  assert.equal(abi.SPH_AEROSOL_NO_SOURCE_LINEAGE, 0xffffffff);
  const errors = Object.values(abi.SPH_AEROSOL_BUDGET_ERROR);
  assert.equal(new Set(errors).size, errors.length);
  assert.ok(errors.every((value) => value > 0 && (value & (value - 1)) === 0));
  assert.match(abi.SPH_AEROSOL_BUDGET_ENERGY_SCOPE, /internal-plus-translational-kinetic-only/);
  assert.match(abi.SPH_AEROSOL_BUDGET_ENERGY_SCOPE, /excludes-constitutive-apic-surface-and-field-energy/);
});

test('aerosol kernels separate initialization from immutable inventory reduction', () => {
  const bindings = (shader) => [...shader.matchAll(/@binding\((\d+)\)/g)].map((match) => Number(match[1]));
  assert.deepEqual(bindings(sphAerosolParcelInitializeWgsl), [0, 1]);
  assert.deepEqual(bindings(sphAerosolInventoryPartialsWgsl), [0, 1, 2, 3, 4]);
  assert.deepEqual(bindings(sphAerosolInventoryFinalizeWgsl), [0, 1, 2]);
  assert.match(sphAerosolParcelInitializeWgsl, /fn initialize_aerosol\(/);
  assert.match(sphAerosolInventoryPartialsWgsl, /fn inventory_partials\(/);
  assert.match(sphAerosolInventoryFinalizeWgsl, /fn inventory_finalize\(/);
  assert.doesNotMatch(sphAerosolInventoryPartialsWgsl, /var<storage, read_write> (?:carrier_state|carrier_thermo|parcels)/);
  assert.doesNotMatch(sphAerosolInventoryFinalizeWgsl, /var<storage, read_write> partials/);
  for (const shader of [sphAerosolParcelInitializeWgsl, sphAerosolInventoryPartialsWgsl, sphAerosolInventoryFinalizeWgsl]) {
    assert.doesNotMatch(shader, /\b(?:condensation_rate|nucleation_rate|saturation_pressure|record_eos_error)\b/);
  }
});
