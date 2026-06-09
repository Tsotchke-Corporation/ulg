import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lennardJones } from '../src/runtime/md/pairPotential.js';
import { BOLTZMANN_J_PER_K, createMdSystem, runMd } from '../src/runtime/md/mdEngine.js';
import { cubicLattice, maxwellBoltzmannVelocities } from '../src/runtime/md/mdInit.js';
import { densityKgPerM3, equilibriumAverages, heatCapacityFromScan } from '../src/runtime/md/propertyEstimators.js';

// Argon-like Lennard-Jones parameters — a *generic* material; only the potential is specific.
const ARGON = { epsilonJ: 120 * BOLTZMANN_J_PER_K, sigmaM: 3.4e-10, massKg: 6.63e-26 };

function buildDiluteGas({ temperatureK, nPerSide = 4, spacingM = 5 * ARGON.sigmaM, seed = 7 }) {
  const { positions, boxLengthM } = cubicLattice({ nPerSide, spacingM });
  const n = positions.length;
  const velocities = maxwellBoltzmannVelocities({ n, massKg: ARGON.massKg, temperatureK, seed });
  const potential = lennardJones({ epsilonJ: ARGON.epsilonJ, sigmaM: ARGON.sigmaM });
  return createMdSystem({ positions, velocities, massKg: ARGON.massKg, boxLengthM, potential });
}

test('the general engine recovers equipartition: measured T tracks the thermostat target', () => {
  const sys = buildDiluteGas({ temperatureK: 300 });
  const samples = runMd(sys, { steps: 1200, dtS: 4e-15, thermostatTempK: 300, equilibrationSteps: 400 });
  const avg = equilibriumAverages(samples);
  assert.ok(Math.abs(avg.temperatureK - 300) < 6, `measured T ${avg.temperatureK}`);
});

test('the general engine recovers the ideal-gas law PV = N kB T at low density (virial pressure)', () => {
  const T = 300;
  const sys = buildDiluteGas({ temperatureK: T });
  const samples = runMd(sys, { steps: 1500, dtS: 4e-15, thermostatTempK: T, equilibrationSteps: 500 });
  const avg = equilibriumAverages(samples);
  const volume = sys.boxLengthM ** 3;
  const idealPressure = (sys.n * BOLTZMANN_J_PER_K * T) / volume;
  // Dilute LJ gas (spacing 5σ ≫ cutoff) is nearly ideal: measured P within ~10% of N kB T / V.
  assert.ok(Math.abs(avg.pressurePa - idealPressure) / idealPressure < 0.1, `P ${avg.pressurePa} vs ideal ${idealPressure}`);
  // Density estimator is material-agnostic.
  assert.ok(densityKgPerM3(sys) > 0);
});

test('heat capacity is measured uniformly (dE/dT): a monatomic gas gives ~3/2 N kB', () => {
  const run = (T) => {
    const sys = buildDiluteGas({ temperatureK: T });
    const samples = runMd(sys, { steps: 1500, dtS: 4e-15, thermostatTempK: T, equilibrationSteps: 500 });
    return { ...equilibriumAverages(samples), n: sys.n };
  };
  const lo = run(250);
  const hi = run(350);
  const heatCapacity = heatCapacityFromScan(lo, hi); // J/K for the whole system
  const idealMonatomic = 1.5 * lo.n * BOLTZMANN_J_PER_K;
  // Ideal monatomic gas: Cv = (3/2) N kB. Measured from dE/dT within ~15%.
  assert.ok(Math.abs(heatCapacity - idealMonatomic) / idealMonatomic < 0.15, `Cv ${heatCapacity} vs ${idealMonatomic}`);
});
