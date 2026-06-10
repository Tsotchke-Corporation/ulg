import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMlsMpmCarrier } from '../src/runtime/sph/mlsMpmCarrier.js';
import { createPhaseAwareEos } from '../src/runtime/sph/multiMaterialEos.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';

function waterBlock(rho0, spacing, u) {
  const mass = rho0 * spacing ** 3;
  const parts = [];
  for (let i = 0; i < 6; i += 1) for (let j = 0; j < 6; j += 1) for (let k = 0; k < 6; k += 1) {
    parts.push({ x: [2.3 + i * spacing, 1.5 + j * spacing, 2.3 + k * spacing], v: [0, 0, 0], massKg: mass, specificInternalEnergyJPerKg: u, material: 'h2o' });
  }
  return parts;
}

test('MLS-MPM: water block falls under gravity (free-fall) and the fluid stays incompressible', () => {
  const closures = createReferenceMaterialClosures();
  const mp = { fe: closures.fe.properties, h2o: closures.h2o.properties, air: closures.air.properties };
  const eos = createPhaseAwareEos(mp, { condensedSoundSpeedMPerS: 180, gasSoundSpeedMPerS: 70 });
  const u = specificInternalEnergyJPerKg(mp.h2o, 300);
  const rho0 = 1000;
  const parts = waterBlock(rho0, 0.15, u);
  const state = { particles: parts };
  const carrier = createMlsMpmCarrier({ gridSpacingM: 0.15, boxEdgeM: 5, dt: 4e-4, eos, restDensityOf: () => rho0 });

  const y0 = parts.reduce((a, p) => a + p.x[1], 0) / parts.length;
  const dt = 4e-4;
  const N = 200;
  for (let s = 0; s < N; s += 1) carrier.step(state);
  const y1 = parts.reduce((a, p) => a + p.x[1], 0) / parts.length;
  // Early free fall: Δy ≈ ½ g t².
  const expected = 0.5 * 9.80665 * (N * dt) ** 2;
  assert.ok(Math.abs((y0 - y1) - expected) < 0.3 * expected, `fell ${(y0 - y1).toFixed(4)} vs free-fall ${expected.toFixed(4)}`);
  // Water remains near-incompressible.
  assert.ok(parts.every((p) => Math.abs(p.mpmJ - 1) < 0.05));
});

test('MLS-MPM: stays stable settling on the floor over a long run (no NaN, no blow-up)', () => {
  const closures = createReferenceMaterialClosures();
  const mp = { fe: closures.fe.properties, h2o: closures.h2o.properties, air: closures.air.properties };
  const eos = createPhaseAwareEos(mp);
  const u = specificInternalEnergyJPerKg(mp.h2o, 300);
  const rho0 = 1000;
  const parts = waterBlock(rho0, 0.15, u);
  const state = { particles: parts };
  const carrier = createMlsMpmCarrier({ gridSpacingM: 0.15, boxEdgeM: 5, dt: 4e-4, eos, restDensityOf: () => rho0 });
  for (let s = 0; s < 1500; s += 1) carrier.step(state);
  assert.ok(parts.every((p) => Number.isFinite(p.x[1]) && Number.isFinite(p.v[1])));
  assert.ok(parts.every((p) => p.x[1] >= 0 && p.x[1] <= 5)); // contained
  assert.ok(Math.min(...parts.map((p) => p.x[1])) < 0.3); // settled near the floor
  assert.ok(parts.every((p) => Math.hypot(...p.v) < 30)); // no explosion
});
