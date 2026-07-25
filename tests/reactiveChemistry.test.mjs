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

test('reactive step resets MPM reference state to the product density', () => {
  const parts = [
    {
      x: [0, 0, 0],
      v: [0, 0, 0],
      massKg: 2,
      material: 'a',
      specificInternalEnergyJPerKg: 0,
      restDensityKgPerM3: 100,
      mpmVolume0: 0.02,
      mpmF: new Float64Array([2, 0, 0, 0, 2, 0, 0, 0, 2]),
      mpmJ: 8,
      mpmC: new Float64Array(9).fill(3),
      mpmSolid: true
    },
    {
      x: [0.01, 0, 0],
      v: [0, 0, 0],
      massKg: 4,
      material: 'b',
      specificInternalEnergyJPerKg: 0,
      restDensityKgPerM3: 200,
      mpmVolume0: 0.02,
      mpmF: new Float64Array([0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5]),
      mpmJ: 0.125,
      mpmC: new Float64Array(9).fill(2),
      mpmSolid: true
    }
  ];
  const productDensity = 500;
  const events = reactiveStep({ particles: parts }, {
    reactions: [{ a: 'a', b: 'b', product: 'ab', activationTemperatureK: 300, specificEnthalpyJPerKg: -1000 }],
    materialProperties: {
      ab: {
        molarMassKgPerMol: 0.01,
        phases: [{ name: 'liquid', cpJPerKgK: 1000, densityKgPerM3: productDensity, temperatureRange: [0, 10000] }],
        transitions: []
      }
    },
    contactRadiusM: 0.05,
    temperatureOf: () => 400
  });
  assert.equal(events, 1);
  for (const particle of parts) {
    assert.equal(particle.material, 'ab');
    assert.equal(particle.restDensityKgPerM3, productDensity);
    assert.equal(particle.mpmVolume0, particle.massKg / productDensity);
    assert.equal(particle.mpmJ, 1);
    assert.deepEqual(Array.from(particle.mpmF), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    assert.deepEqual(Array.from(particle.mpmC), new Array(9).fill(0));
    assert.equal(particle.mpmSolid, false);
  }
});

test('active metal reacts with liquid water at room temperature without requiring molten metal', () => {
  const parts = [
    { x: [0, 0, 0], v: [0, 0, 0], massKg: 1, material: 'Na', specificInternalEnergyJPerKg: 0 },
    { x: [0.01, 0, 0], v: [0, 0, 0], massKg: 1, material: 'h2o', specificInternalEnergyJPerKg: 0 }
  ];
  const events = reactiveStep({ particles: parts }, {
    reactions: [{
      // Network discovery canonicalizes material keys while particle metadata
      // preserves display casing. The CPU reference path must join the two by
      // canonical material identity, just like the packed GPU table does.
      a: 'na',
      b: 'h2o',
      product: 'naoh',
      activationTemperatureK: 0,
      phaseRequirements: { H2O: ['liquid', 'gas'] },
      specificEnthalpyJPerKg: -8.5e6
    }],
    contactRadiusM: 0.05,
    temperatureOf: () => 293.15,
    phaseOf: (particle) => (particle.material === 'h2o' ? 'liquid' : 'solid')
  });
  assert.equal(events, 1);
  assert.equal(parts.filter((p) => p.material === 'naoh').length, 2);
});

test('balanced active metal water reaction produces hydroxide and hydrogen byproduct', () => {
  const parts = [
    { x: [0, 0, 0], v: [0, 0, 0], massKg: 1, material: 'Na', specificInternalEnergyJPerKg: 0 },
    { x: [0.01, 0, 0], v: [0, 0, 0], massKg: 1, material: 'h2o', specificInternalEnergyJPerKg: 0 }
  ];
  const mass0 = parts.reduce((sum, particle) => sum + particle.massKg, 0);
  const events = reactiveStep({ particles: parts }, {
    reactions: [{
      a: 'Na',
      b: 'h2o',
      product: 'naoh',
      activationTemperatureK: 0,
      phaseRequirements: { h2o: ['liquid', 'gas'] },
      specificEnthalpyJPerKg: -8.5e6,
      stoichiometry: {
        equation: '2 Na + 2 H2O -> 2 NaOH + H2',
        products: [
          { coefficient: 2, formula: 'NaOH', atomCounts: { 11: 1, 8: 1, 1: 1 } },
          { coefficient: 1, formula: 'H2', atomCounts: { 1: 2 } }
        ]
      }
    }],
    materialProperties: {
      naoh: {
        molarMassKgPerMol: 0.039997,
        phases: [{ name: 'liquid', cpJPerKgK: 1600, densityKgPerM3: 1800, temperatureRange: [0, 10000] }],
        transitions: []
      },
      h2: {
        molarMassKgPerMol: 0.002016,
        phases: [{ name: 'gas', cpJPerKgK: 14300, densityKgPerM3: 0.09, temperatureRange: [0, 10000] }],
        transitions: []
      }
    },
    contactRadiusM: 0.05,
    temperatureOf: () => 293.15,
    phaseOf: (particle) => (particle.material === 'h2o' ? 'liquid' : 'solid')
  });
  assert.equal(events, 1);
  assert.equal(parts.filter((p) => p.material === 'naoh').length, 1);
  assert.equal(parts.filter((p) => p.material === 'h2').length, 1);
  assert.ok(Math.abs(parts.reduce((sum, particle) => sum + particle.massKg, 0) - mass0) < 1e-5);
  assert.ok(parts.find((p) => p.material === 'h2').massKg < parts.find((p) => p.material === 'naoh').massKg);
  assert.equal(parts.find((p) => p.material === 'h2').reactionProductTerm.sourceEquation, '2 Na + 2 H2O -> 2 NaOH + H2');
});

test('stoichiometric extent consumes limiting reactant and preserves leftover reactant inventory', () => {
  const parts = [
    { x: [0, 0, 0], v: [1, 0, 0], massKg: 1, material: 'Na', specificInternalEnergyJPerKg: 100 },
    { x: [0.01, 0, 0], v: [0, 0, 0], massKg: 1, material: 'h2o', specificInternalEnergyJPerKg: 200 }
  ];
  const mass0 = parts.reduce((sum, particle) => sum + particle.massKg, 0);
  const events = reactiveStep({ particles: parts }, {
    reactions: [{
      a: 'Na',
      b: 'h2o',
      product: 'naoh',
      activationTemperatureK: 0,
      phaseRequirements: { h2o: ['liquid', 'gas'] },
      specificEnthalpyJPerKg: -8.5e6,
      stoichiometry: {
        equation: '2 Na + 2 H2O -> 2 NaOH + H2',
        reactants: [
          { coefficient: 2, formula: 'Na', material: 'Na' },
          { coefficient: 2, formula: 'H2O', material: 'h2o' }
        ],
        products: [
          { coefficient: 2, formula: 'NaOH', material: 'naoh' },
          { coefficient: 1, formula: 'H2', material: 'h2' }
        ]
      }
    }],
    materialProperties: {
      Na: {
        molarMassKgPerMol: 0.02298976928,
        phases: [{ name: 'solid', cpJPerKgK: 1200, densityKgPerM3: 970, temperatureRange: [0, 10000] }],
        transitions: []
      },
      h2o: {
        molarMassKgPerMol: 0.01801528,
        phases: [{ name: 'liquid', cpJPerKgK: 4184, densityKgPerM3: 1000, temperatureRange: [0, 10000] }],
        transitions: []
      },
      naoh: {
        molarMassKgPerMol: 0.039997,
        phases: [{ name: 'liquid', cpJPerKgK: 1600, densityKgPerM3: 1800, temperatureRange: [0, 10000] }],
        transitions: []
      },
      h2: {
        molarMassKgPerMol: 0.002016,
        phases: [{ name: 'gas', cpJPerKgK: 14300, densityKgPerM3: 0.09, temperatureRange: [0, 10000] }],
        transitions: []
      }
    },
    contactRadiusM: 0.05,
    temperatureOf: () => 293.15,
    phaseOf: (particle) => (particle.material === 'h2o' ? 'liquid' : 'solid')
  });
  assert.equal(events, 1);
  assert.ok(Math.abs(parts.reduce((sum, particle) => sum + particle.massKg, 0) - mass0) < 1e-5);
  assert.equal(parts.filter((p) => p.material === 'Na').length, 0);
  assert.equal(parts.filter((p) => p.material === 'h2o').length, 1);
  assert.equal(parts.filter((p) => p.material === 'naoh').length, 1);
  assert.equal(parts.filter((p) => p.material === 'h2').length, 1);
  const leftoverWater = parts.find((p) => p.material === 'h2o');
  assert.ok(leftoverWater.massKg > 0.21 && leftoverWater.massKg < 0.22);
  const naoh = parts.find((p) => p.material === 'naoh');
  const h2 = parts.find((p) => p.material === 'h2');
  assert.ok(Math.abs(naoh.massKg - 1.739) < 0.002);
  assert.ok(Math.abs(h2.massKg - 0.04385) < 0.0002);
  assert.equal(parts.length, 3);
  assert.equal(h2.reactionProductTerm.routing, 'gas');
  assert.equal(parts[0].reactionProductTerm.sourceEquation, '2 Na + 2 H2O -> 2 NaOH + H2');
});

test('stoichiometric products preserve momentum and thermalize relative kinetic energy', () => {
  const parts = [
    { x: [0, 0, 0], v: [4, -1, 0.5], massKg: 2, material: 'a', specificInternalEnergyJPerKg: 100 },
    { x: [0.01, 0, 0], v: [-2, 3, -0.5], massKg: 3, material: 'b', specificInternalEnergyJPerKg: 200 }
  ];
  const momentum = (particles) => particles.reduce(
    (sum, particle) => sum.map(
      (component, axis) => component + particle.massKg * particle.v[axis]
    ),
    [0, 0, 0]
  );
  const totalEnergy = (particles) => particles.reduce((sum, particle) => (
    sum + particle.massKg * (
      particle.specificInternalEnergyJPerKg
      + 0.5 * particle.v.reduce(
        (speedSquared, velocity) => speedSquared + velocity * velocity,
        0
      )
    )
  ), 0);
  const beforeMomentum = momentum(parts);
  const beforeEnergy = totalEnergy(parts);
  const specificEnthalpyJPerKg = -1000;
  const events = reactiveStep({ particles: parts }, {
    reactions: [{
      a: 'a',
      b: 'b',
      product: 'c',
      activationTemperatureK: 0,
      specificEnthalpyJPerKg,
      stoichiometry: {
        equation: 'A + B -> C + D',
        reactants: [
          { coefficient: 1, formula: 'A', material: 'a' },
          { coefficient: 1, formula: 'B', material: 'b' }
        ],
        products: [
          { coefficient: 1, formula: 'C', material: 'c' },
          { coefficient: 1, formula: 'D', material: 'd' }
        ]
      }
    }],
    materialProperties: {
      a: { molarMassKgPerMol: 1, phases: [{ name: 'solid', densityKgPerM3: 1, cpJPerKgK: 1, temperatureRange: [0, 10000] }], transitions: [] },
      b: { molarMassKgPerMol: 1.5, phases: [{ name: 'solid', densityKgPerM3: 1, cpJPerKgK: 1, temperatureRange: [0, 10000] }], transitions: [] },
      c: { molarMassKgPerMol: 1.75, phases: [{ name: 'liquid', densityKgPerM3: 1, cpJPerKgK: 1, temperatureRange: [0, 10000] }], transitions: [] },
      d: { molarMassKgPerMol: 0.75, phases: [{ name: 'gas', densityKgPerM3: 1, cpJPerKgK: 1, temperatureRange: [0, 10000] }], transitions: [] }
    },
    contactRadiusM: 0.05,
    temperatureOf: () => 1000
  });

  assert.equal(events, 1);
  const afterMomentum = momentum(parts);
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(Math.abs(afterMomentum[axis] - beforeMomentum[axis]) < 1e-9);
  }
  const reactedMass = parts.reduce((sum, particle) => sum + particle.massKg, 0);
  const expectedEnergy = beforeEnergy - specificEnthalpyJPerKg * reactedMass;
  assert.ok(Math.abs(totalEnergy(parts) - expectedEnergy) < 1e-8);
});

test('stoichiometric extent writes mass, heat, and gas-product reaction ledger', () => {
  const state = {
    particles: [
      { x: [0, 0, 0], v: [0, 0, 0], massKg: 0.04597953856, material: 'Na', specificInternalEnergyJPerKg: 0 },
      { x: [0.01, 0, 0], v: [0, 0, 0], massKg: 0.03603056, material: 'h2o', specificInternalEnergyJPerKg: 0 }
    ]
  };
  reactiveStep(state, {
    reactions: [{
      a: 'Na',
      b: 'h2o',
      product: 'naoh',
      activationTemperatureK: 0,
      specificEnthalpyJPerKg: -1000,
      stoichiometry: {
        equation: '2 Na + 2 H2O -> 2 NaOH + H2',
        reactants: [
          { coefficient: 2, formula: 'Na', material: 'Na' },
          { coefficient: 2, formula: 'H2O', material: 'h2o' }
        ],
        products: [
          { coefficient: 2, formula: 'NaOH', material: 'naoh' },
          { coefficient: 1, formula: 'H2', material: 'h2' }
        ]
      }
    }],
    materialProperties: {
      Na: { molarMassKgPerMol: 0.02298976928, phases: [{ name: 'solid', densityKgPerM3: 970 }] },
      h2o: { molarMassKgPerMol: 0.01801528, phases: [{ name: 'liquid', densityKgPerM3: 1000 }] },
      naoh: { molarMassKgPerMol: 0.039997, phases: [{ name: 'liquid', densityKgPerM3: 1800 }] },
      h2: { molarMassKgPerMol: 0.002016, phases: [{ name: 'gas', densityKgPerM3: 0.09 }] }
    },
    contactRadiusM: 0.05,
    temperatureOf: () => 293.15
  });
  assert.equal(state.reactionLedger.schema, 'peercompute.ulg.sph-reaction-ledger.v0');
  assert.equal(state.reactionLedger.eventCount, 1);
  assert.ok(Math.abs(state.reactionLedger.massResidualKg) < 2e-6);
  assert.ok(state.reactionLedger.maxAbsAtomResidualMol < 1e-9);
  assert.equal(state.reactionLedger.chargeResidualMol, 0);
  assert.ok(Math.abs(state.reactionLedger.events[0].atomResidualMolByZ['1']) < 1e-9);
  assert.ok(Math.abs(state.reactionLedger.events[0].atomResidualMolByZ['8']) < 1e-9);
  assert.ok(Math.abs(state.reactionLedger.events[0].atomResidualMolByZ['11']) < 1e-9);
  assert.ok(state.reactionLedger.heatJ > 80);
  assert.ok(state.reactionLedger.gasMassKgByMaterial.h2 > 0.002);
  assert.equal(state.reactionLedger.events[0].extentMol, 1);
});

test('active metal does not react with solid ice just because the metal is hot', () => {
  const parts = [
    { x: [0, 0, 0], v: [0, 0, 0], massKg: 1, material: 'Na', specificInternalEnergyJPerKg: 0 },
    { x: [0.01, 0, 0], v: [0, 0, 0], massKg: 1, material: 'h2o', specificInternalEnergyJPerKg: 0 }
  ];
  const events = reactiveStep({ particles: parts }, {
    reactions: [{
      a: 'Na',
      b: 'h2o',
      product: 'naoh',
      activationTemperatureK: 0,
      phaseRequirements: { h2o: ['liquid', 'gas'] },
      specificEnthalpyJPerKg: -8.5e6
    }],
    contactRadiusM: 0.05,
    temperatureOf: (particle) => (particle.material === 'Na' ? 600 : 233.15),
    phaseOf: (particle) => (particle.material === 'h2o' ? 'solid' : 'solid')
  });
  assert.equal(events, 0);
  assert.ok(parts.every((p) => p.material !== 'naoh'));
});

test('reactive step spatially culls distant reactants before thermal gates', () => {
  const parts = [];
  for (let index = 0; index < 80; index += 1) {
    parts.push({
      x: [index * 0.2, 0, 0],
      v: [0, 0, 0],
      massKg: 1,
      material: 'a',
      specificInternalEnergyJPerKg: 0
    });
    parts.push({
      x: [100 + index * 0.2, 0, 0],
      v: [0, 0, 0],
      massKg: 1,
      material: 'b',
      specificInternalEnergyJPerKg: 0
    });
  }
  let temperatureCalls = 0;
  const events = reactiveStep({ particles: parts }, {
    reactions: [{ a: 'a', b: 'b', product: 'ab', activationTemperatureK: 100, specificEnthalpyJPerKg: -1000 }],
    contactRadiusM: 0.05,
    temperatureOf: () => {
      temperatureCalls += 1;
      return 300;
    }
  });
  assert.equal(events, 0);
  assert.equal(temperatureCalls, 0);
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
