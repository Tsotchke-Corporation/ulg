import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  idealGasHeatCapacity,
  isLinearMolecule,
  principalMomentsOfInertia,
  zeroPointEnergyHa
} from '../src/runtime/electronicStructure/molecularThermochemistry.js';

const N2 = [{ Z: 7, position: [0, 0, 0] }, { Z: 7, position: [0, 0, 2.07] }];
const H2O = [{ Z: 8, position: [0, 0, 0] }, { Z: 1, position: [1.43, 0, 1.108] }, { Z: 1, position: [-1.43, 0, 1.108] }];
const CO2 = [{ Z: 6, position: [0, 0, 0] }, { Z: 8, position: [0, 0, 2.2] }, { Z: 8, position: [0, 0, -2.2] }];

test('linear / nonlinear geometry is detected from the inertia tensor', () => {
  assert.equal(isLinearMolecule(N2), true);
  assert.equal(isLinearMolecule(CO2), true); // linear triatomic
  assert.equal(isLinearMolecule(H2O), false); // bent
  const m = principalMomentsOfInertia(CO2);
  assert.ok(m[0] < 1e-6 * m[2]); // one vanishing moment for a linear molecule
});

test('ideal-gas heat capacity matches experiment for the air gases and water vapour', () => {
  // At 298 K the (high) vibrations are mostly frozen, so Cp is set by translation+rotation.
  assert.ok(Math.abs(idealGasHeatCapacity(N2, [2400], 298).cpJPerMolK - 29.1) < 0.5); // exp 29.1
  assert.ok(Math.abs(idealGasHeatCapacity(H2O, [3700, 3800, 1600], 298).cpJPerMolK - 33.6) < 0.5); // exp 33.6
  assert.ok(Math.abs(idealGasHeatCapacity(CO2, [1330, 2349, 667, 667], 298).cpJPerMolK - 37.1) < 1.0); // exp 37.1
});

test('heat capacity rises with temperature as vibrations activate', () => {
  const lowT = idealGasHeatCapacity(CO2, [1330, 2349, 667, 667], 298).cpJPerMolK;
  const highT = idealGasHeatCapacity(CO2, [1330, 2349, 667, 667], 1500).cpJPerMolK;
  assert.ok(highT > lowT + 10, `Cp 298->1500: ${lowT.toFixed(1)} -> ${highT.toFixed(1)}`);
});

test('zero-point energy is positive and scales with the modes', () => {
  assert.ok(zeroPointEnergyHa([4400]) > 0);
  assert.ok(zeroPointEnergyHa([3700, 3800, 1600]) > zeroPointEnergyHa([1600]));
});
