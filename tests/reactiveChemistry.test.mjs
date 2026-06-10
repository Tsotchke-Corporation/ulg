import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveReactionEnthalpyJPerKg, reactiveStep } from '../src/runtime/sph/reactiveChemistry.js';

const H2 = { atoms: [{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.39] }], count: 2 };
const O2 = { atoms: [{ Z: 8, position: [0, 0, 0] }, { Z: 8, position: [0, 0, 2.28] }], multiplicity: 3, count: 1 };
const H2O = { atoms: [{ Z: 8, position: [0, 0, 0] }, { Z: 1, position: [1.43, 0, 1.108] }, { Z: 1, position: [-1.43, 0, 1.108] }], count: 2 };

test('reaction enthalpy is derived from the bonding engine and exothermic for H2 + O2 -> H2O', () => {
  const dH = deriveReactionEnthalpyJPerKg({ reactants: [H2, O2], products: [H2O], productMassKgPerMol: 0.018016 });
  assert.ok(dH < 0, 'combustion must be exothermic');
  // Order of magnitude (HF/STO-3G overestimates; experiment ~ -13.4 MJ/kg).
  assert.ok(dH < -5e6 && dH > -40e6, `dH ${(dH / 1e6).toFixed(1)} MJ/kg`);
});

test('reactive step converts reactants in contact above activation, conserves mass, releases heat', () => {
  const parts = [];
  for (let i = 0; i < 5; i += 1) {
    parts.push({ x: [i * 0.1, 0, 0], v: [0, 0, 0], massKg: 1, material: 'h2', specificInternalEnergyJPerKg: 1e6 });
    parts.push({ x: [i * 0.1 + 0.02, 0, 0], v: [0, 0, 0], massKg: 8, material: 'o2', specificInternalEnergyJPerKg: 1e6 });
  }
  const mass0 = parts.reduce((a, p) => a + p.massKg, 0);
  const energy0 = parts.reduce((a, p) => a + p.specificInternalEnergyJPerKg * p.massKg, 0);
  const events = reactiveStep({ particles: parts }, {
    reactions: [{ a: 'h2', b: 'o2', product: 'h2o', activationTemperatureK: 773, specificEnthalpyJPerKg: -22.7e6 }],
    contactRadiusM: 0.05,
    temperatureOf: () => 3000
  });
  assert.equal(events, 5);
  assert.equal(parts.filter((p) => p.material === 'h2o').length, 10);
  assert.equal(parts.reduce((a, p) => a + p.massKg, 0), mass0); // mass conserved
  assert.ok(parts.reduce((a, p) => a + p.specificInternalEnergyJPerKg * p.massKg, 0) > energy0); // heat released
});

test('no reaction below the activation temperature', () => {
  const parts = [
    { x: [0, 0, 0], v: [0, 0, 0], massKg: 1, material: 'h2', specificInternalEnergyJPerKg: 0 },
    { x: [0.01, 0, 0], v: [0, 0, 0], massKg: 8, material: 'o2', specificInternalEnergyJPerKg: 0 }
  ];
  const events = reactiveStep({ particles: parts }, {
    reactions: [{ a: 'h2', b: 'o2', product: 'h2o', activationTemperatureK: 773, specificEnthalpyJPerKg: -22.7e6 }],
    contactRadiusM: 0.05,
    temperatureOf: () => 300 // below activation
  });
  assert.equal(events, 0);
  assert.ok(parts.every((p) => p.material !== 'h2o'));
});
