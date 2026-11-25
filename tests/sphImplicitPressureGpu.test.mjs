// Host contract of the A1 larger-dt slice's semi-implicit pressure flag.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeSphImplicitPressureOptions,
  packSphImplicitPressureParams,
  sphImplicitPressureWgsl,
  SPH_IMPLICIT_PRESSURE_MAX_CFL,
  sphImplicitPressureIterationsFor
} from '../src/runtime/sph/sphImplicitPressureGpu.js';
import { phaseSoundSpeedScaleFor } from '../src/runtime/sph/sphMechanicsMaterialTable.js';

test('the operator K comes from the Eshkol-derived table by default', () => {
  assert.equal(normalizeSphImplicitPressureOptions({}).stiffnessSource, 'eshkol-derived-chebyshev-v1');
  assert.equal(normalizeSphImplicitPressureOptions({ stiffnessSource: 'closed-form' }).stiffnessSource, 'closed-form-tait');
});

test('implicit pressure is off unless requested', () => {
  for (const off of [undefined, null, false, 0, '0', 'off', '', { enabled: false }]) {
    assert.equal(normalizeSphImplicitPressureOptions(off), null, String(off));
  }
  const on = normalizeSphImplicitPressureOptions({});
  assert.equal(on.enabled, true);
  assert.equal(on.iterations, 15); // derived from c dt / dx = 3
  assert.equal(on.theta, 1);
  assert.equal(on.cflSafety, 3);
  assert.equal(normalizeSphImplicitPressureOptions(true).cflSafety, 3);
});

test('CG iterations follow c dt / dx (measured convergence on the dam break)', () => {
  assert.equal(sphImplicitPressureIterationsFor(1), 10);
  assert.equal(sphImplicitPressureIterationsFor(2), 10);
  assert.equal(sphImplicitPressureIterationsFor(4), 20);
  assert.equal(sphImplicitPressureIterationsFor(6.4), 32);
  assert.equal(normalizeSphImplicitPressureOptions({ cflSafety: 2 }).iterations, 10);
  assert.equal(normalizeSphImplicitPressureOptions({ cflSafety: 4, iterations: 7 }).iterations, 7);
  // The envelope clamp applies before the iteration rule.
  assert.equal(normalizeSphImplicitPressureOptions({ cflSafety: 12.8 }).iterations, 32);
});

test('implicit pressure clamps to the measured stability envelope', () => {
  const wide = normalizeSphImplicitPressureOptions({ cflSafety: 12.8, iterations: 500, theta: 0.1 });
  assert.equal(wide.cflSafety, SPH_IMPLICIT_PRESSURE_MAX_CFL);
  assert.equal(wide.envelopeClamped, true);
  assert.equal(wide.requestedCflSafety, 12.8);
  assert.equal(wide.iterations, 64);
  assert.equal(wide.theta, 0.5);
  assert.equal(normalizeSphImplicitPressureOptions({ cflSafety: 2 }).envelopeClamped, false);
});

test('liquid cap raises only liquid stiffness', () => {
  const properties = { phases: [] };
  const liquid = { name: 'liquid', bulkModulusPa: 2.2e9, densityKgPerM3: 1000 };
  const solid = { name: 'solid', bulkModulusPa: 8.8e9, shearModulusPa: 3.5e9, densityKgPerM3: 917 };
  const gas = { name: 'gas', bulkModulusPa: 1.4e5, densityKgPerM3: 1.2 };
  const caps = { cflMaxSoundSpeedMPerS: 100, liquidCflMaxSoundSpeedMPerS: 1000 };
  const c = Math.sqrt(2.2e9 / 1000);
  assert.equal(phaseSoundSpeedScaleFor(properties, liquid, caps), 1000 / c);
  assert.equal(phaseSoundSpeedScaleFor(properties, liquid, { cflMaxSoundSpeedMPerS: 100 }), 100 / c);
  assert.equal(phaseSoundSpeedScaleFor(properties, solid, caps),
    phaseSoundSpeedScaleFor(properties, solid, { cflMaxSoundSpeedMPerS: 100 }));
  assert.equal(phaseSoundSpeedScaleFor(properties, gas, caps),
    phaseSoundSpeedScaleFor(properties, gas, { cflMaxSoundSpeedMPerS: 100 }));
  // Real water at the liquid cap is never stiffer than physical.
  assert.equal(phaseSoundSpeedScaleFor(properties, liquid, { cflMaxSoundSpeedMPerS: 100,
    liquidCflMaxSoundSpeedMPerS: 5000 }), 1);
});

test('params pack the grid ABI the G2P stencil uses', () => {
  const gridSpec = { gridNodeCount: 7 * 8 * 9, gridDims: [7, 8, 9], shift: 2, gridSpacingM: 0.25,
    boxDimsM: [1, 1.5, 1.75] };
  const data = packSphImplicitPressureParams({ particleCount: 33, gridSpec, dt: 0.004, theta: 1,
    internalPressureScale: 0.5, sourceIsDirection: true, maxSpeedMPerS: 37.5, cflNumber: 4 });
  const u = new Uint32Array(data);
  const f = new Float32Array(data);
  assert.deepEqual(Array.from(u.slice(0, 7)), [33, 504, 7, 8, 9, 2, 1]);
  assert.deepEqual(Array.from(f.slice(8, 18)), [0.25, 4, Math.fround(0.004), 1, 1, 1.5, 1.75, 0.5, 37.5, 4]);
  assert.equal(data.byteLength, 96);
  // K comes from the resident A4 response table (rf_table function 0).
  assert.equal(f[20], 1);
  assert.equal(new Float32Array(packSphImplicitPressureParams({ particleCount: 1, gridSpec, dt: 0.004, theta: 1,
    stiffnessTable: null }))[20], 0);
});

test('the solver binds the Eshkol stiffness as an A4 GPU response table', async () => {
  const { SPH_IMPLICIT_PRESSURE_STIFFNESS_TABLE } = await import('../src/runtime/sph/sphImplicitPressureGpu.js');
  const { ESHKOL_TAIT_STIFFNESS_TABLE } = await import('../src/runtime/material/eshkolEosStiffnessTable.js');
  const d = SPH_IMPLICIT_PRESSURE_STIFFNESS_TABLE.data;
  assert.equal(d[0], 1);
  assert.deepEqual([d[4], d[6], d[9], d[10]], [1, ESHKOL_TAIT_STIFFNESS_TABLE.degree + 1,
    Math.fround(ESHKOL_TAIT_STIFFNESS_TABLE.domain[0]), Math.fround(ESHKOL_TAIT_STIFFNESS_TABLE.domain[1])]);
  assert.match(sphImplicitPressureWgsl, /var<storage, read> rf_table: array<f32>/);
  assert.match(sphImplicitPressureWgsl, /rf_eval\(0u, vec3<f32>\(ratio, 0\.0, 0\.0\)\)/);
});

test('WGSL mirrors the packed Tait EOS and wall bands', () => {
  // Physical cavitation floor (P_gauge >= 0 -> dp/drho = 0 when ratio < 0.9999),
  // Tait exponent and liquid-only admission matching P2G.
  assert.match(sphImplicitPressureWgsl, /if \(ratio < 0\.9999\) \{ return 0\.0; \}/);
  assert.match(sphImplicitPressureWgsl, /pow\(ratio, 6\.0\)/);
  assert.match(sphImplicitPressureWgsl, /ip_mech_eos_model_id\(particle_index\)/);
  assert.match(sphImplicitPressureWgsl, /ip_mech_solid_flag\(particle_index\) > 0\.5 && ip_mech_effective_bulk_modulus_pa\(particle_index\) > 0\.0/);
  assert.match(sphImplicitPressureWgsl, /ip_thermo_rest_density_kg_per_m3\(particle_index\)/);
  assert.match(sphImplicitPressureWgsl, /represented_volume_from_mechanics\(particle_index\)/);
  // Every reduction kernel reaches the workgroup barrier from uniform control flow.
  for (const name of ['ip_cg_init', 'ip_cg_apply', 'ip_cg_update_xr', 'ip_particle_kv_max',
    'ip_reduce_scale', 'ip_reduce_rz', 'ip_reduce_alpha', 'ip_reduce_beta', 'ip_cg_update_p', 'ip_reduce_pscale']) {
    const body = sphImplicitPressureWgsl.split(`fn ${name}(`)[1].split('\n}\n')[0];
    assert.doesNotMatch(body, /return;/, name);
  }
});
