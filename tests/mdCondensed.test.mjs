import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lennardJones } from '../src/runtime/md/pairPotential.js';
import { BOLTZMANN_J_PER_K, createMdSystem, runMd } from '../src/runtime/md/mdEngine.js';
import { cubicLattice, maxwellBoltzmannVelocities } from '../src/runtime/md/mdInit.js';
import {
  bulkModulusPa,
  densityAtPressure,
  diffusionCoefficientM2PerS,
  equationOfStateScan,
  meltingScan
} from '../src/runtime/md/propertyEstimators.js';

const ARGON = { epsilonJ: 120 * BOLTZMANN_J_PER_K, sigmaM: 3.4e-10, massKg: 6.63e-26 };
const N_PER_SIDE = 4;

function makeSystemAtBox(boxLengthM, temperatureK, seed = 11) {
  const spacingM = boxLengthM / N_PER_SIDE;
  const { positions } = cubicLattice({ nPerSide: N_PER_SIDE, spacingM });
  const velocities = maxwellBoltzmannVelocities({ n: positions.length, massKg: ARGON.massKg, temperatureK, seed });
  const potential = lennardJones({ epsilonJ: ARGON.epsilonJ, sigmaM: ARGON.sigmaM });
  return createMdSystem({ positions, velocities, massKg: ARGON.massKg, boxLengthM, potential });
}

test('diffusion distinguishes solid from liquid (the general melting order parameter)', () => {
  const dense = 1.12 * ARGON.sigmaM; // near the LJ minimum spacing
  const box = N_PER_SIDE * dense;
  const cold = makeSystemAtBox(box, 15);
  const hot = makeSystemAtBox(box, 250);
  const dCold = diffusionCoefficientM2PerS(runMd(cold, { steps: 1500, dtS: 4e-15, thermostatTempK: 15, equilibrationSteps: 500 }));
  const dHot = diffusionCoefficientM2PerS(runMd(hot, { steps: 1500, dtS: 4e-15, thermostatTempK: 250, equilibrationSteps: 500 }));
  // A cold dense solid barely diffuses; a hot one diffuses freely.
  assert.ok(dHot > 10 * Math.max(dCold, 1e-30), `D_hot ${dHot} should greatly exceed D_cold ${dCold}`);
  assert.ok(dHot > 0);
});

test('EOS scan: pressure rises under compression and the bulk modulus is positive', () => {
  const boxLengthsM = [1.05, 1.15, 1.3, 1.5].map((s) => N_PER_SIDE * s * ARGON.sigmaM);
  const scan = equationOfStateScan({
    makeSystem: (box) => makeSystemAtBox(box, 150),
    boxLengthsM,
    temperatureK: 150,
    runParams: { steps: 900, dtS: 4e-15, equilibrationSteps: 350 }
  });
  // Smallest box (highest density) has the highest pressure.
  const compressed = scan[0];
  const expanded = scan[scan.length - 1];
  assert.ok(compressed.pressurePa > expanded.pressurePa, `P(compressed) ${compressed.pressurePa} > P(expanded) ${expanded.pressurePa}`);
  assert.ok(compressed.densityKgPerM3 > expanded.densityKgPerM3);
  // Bulk modulus B = -V dP/dV between the two most-compressed points is positive.
  const B = bulkModulusPa(scan[0], scan[1]);
  assert.ok(B > 0, `bulk modulus ${B}`);
  // Density at a higher target pressure exceeds that at a lower one.
  const pHi = compressed.pressurePa;
  const pLo = Math.max(expanded.pressurePa, 0) + 0.1 * (pHi - expanded.pressurePa);
  assert.ok(densityAtPressure(scan, pHi) >= densityAtPressure(scan, pLo));
});

test('melting scan: potential energy and diffusion both rise across the transition', () => {
  const dense = 1.12 * ARGON.sigmaM;
  const box = N_PER_SIDE * dense;
  const scan = meltingScan({
    makeSystem: (T) => makeSystemAtBox(box, T),
    temperaturesK: [15, 250],
    runParams: { steps: 1200, dtS: 4e-15, equilibrationSteps: 400 }
  });
  const [solid, liquid] = scan;
  assert.ok(liquid.potentialEnergyJ > solid.potentialEnergyJ, 'liquid branch sits higher in potential energy');
  assert.ok(liquid.diffusionM2PerS > solid.diffusionM2PerS, 'liquid branch diffuses more');
});
