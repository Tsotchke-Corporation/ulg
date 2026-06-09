import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  atomicNumberDensity,
  debyeHeatCapacityJPerKgK,
  debyeInternalEnergyJPerKg,
  debyeTemperatureFromSoundSpeed,
  gasMixtureThermal
} from '../src/runtime/material/statisticalMechanics.js';

const R = 8.314462618;

test('air heat capacity from equipartition matches the measured value', () => {
  const air = gasMixtureThermal();
  assert.ok(Math.abs(air.molarMassKgPerMol - 0.028965) < 5e-5, `M ${air.molarMassKgPerMol}`);
  // Measured air cv ~718, cp ~1005, gamma ~1.40 — equipartition recovers them to <1%.
  assert.ok(Math.abs(air.cvJPerKgK - 718) < 6, `cv ${air.cvJPerKgK}`);
  assert.ok(Math.abs(air.cpJPerKgK - 1005) < 6, `cp ${air.cpJPerKgK}`);
  assert.ok(Math.abs(air.gamma - 1.40) < 0.01, `gamma ${air.gamma}`);
});

test('Debye heat capacity reaches Dulong–Petit at high T and falls below it at low T', () => {
  const fe = { debyeTemperatureK: 470, molarMassKgPerMol: 0.055845 };
  const dulongPetit = (3 * R) / fe.molarMassKgPerMol; // ~446.7 J/kgK
  const cvHigh = debyeHeatCapacityJPerKgK(5000, fe);
  assert.ok(Math.abs(cvHigh - dulongPetit) / dulongPetit < 0.02, `high-T ${cvHigh} vs ${dulongPetit}`);
  // At 233 K iron's real heat capacity is ~370 J/kgK, well below Dulong–Petit.
  const cv233 = debyeHeatCapacityJPerKgK(233.15, fe);
  assert.ok(cv233 > 350 && cv233 < 390, `cv(233) ${cv233}`);
  assert.ok(cv233 < dulongPetit);
});

test('Debye temperature of iron from sound speed + atomic density is ~470 K', () => {
  const n = atomicNumberDensity({ densityKgPerM3: 7874, molarMassKgPerMol: 0.055845 });
  assert.ok(Math.abs(n - 8.49e28) / 8.49e28 < 0.02);
  const theta = debyeTemperatureFromSoundSpeed({ soundSpeedMPerS: 3600, numberDensityPerM3: n });
  assert.ok(theta > 440 && theta < 500, `theta_D ${theta}`);
});

test('Debye internal energy is the integral of the heat capacity (dU/dT = cv)', () => {
  const fe = { debyeTemperatureK: 470, molarMassKgPerMol: 0.055845 };
  const T = 400;
  const dT = 0.5;
  const dUdT = (debyeInternalEnergyJPerKg(T + dT, fe) - debyeInternalEnergyJPerKg(T - dT, fe)) / (2 * dT);
  const cv = debyeHeatCapacityJPerKgK(T, fe);
  assert.ok(Math.abs(dUdT - cv) / cv < 1e-3, `dU/dT ${dUdT} vs cv ${cv}`);
});
