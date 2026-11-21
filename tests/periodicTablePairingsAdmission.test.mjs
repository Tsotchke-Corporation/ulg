import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discoverReactionCandidates } from '../src/runtime/chemistry/reactionCandidates.js';
import { createSphPhaseDemo } from '../src/runtime/sphPhaseDemo.js';
import { createSphPhaseViewState } from '../src/runtime/sphPhaseViewState.js';
import { sphStaticTableInputsFromViewState } from '../src/runtime/sph/sphStaticTableInputs.js';
import { sphEnvironmentOptionsFromControls } from '../src/runtime/sphEnvironmentControls.js';

const ROOM_AIR_ENV = sphEnvironmentOptionsFromControls({
  environmentMode: 'air',
  environmentTemperatureK: '293.15',
  environmentPressurePa: '101325',
  environmentHumidityPercent: '50',
  environmentCellsPerAxis: '2',
  environmentNucleiPerCm3: '5000',
  environmentAirParcels: 'mixture'
});

function buildPairDemo(materialA, materialB, { air = false } = {}) {
  const driver = createSphPhaseDemo({
    boxDimensionsM: [1.0, 1.0, 1.0],
    initialBodies: [
      {
        id: 'body-1',
        domainId: 1,
        material: materialA,
        sizeM: [0.25, 0.25, 0.25],
        centerM: [0.5, 0.15, 0.5],
        temperatureK: 293.15,
        particlesPerEdge: [2, 2, 2],
        velocityMPerS: [0, 0, 0]
      },
      {
        id: 'body-2',
        domainId: 2,
        material: materialB,
        sizeM: [0.25, 0.25, 0.25],
        centerM: [0.5, 0.55, 0.5],
        temperatureK: 293.15,
        particlesPerEdge: [2, 2, 2],
        velocityMPerS: [0, 0, 0]
      }
    ],
    ...(air ? { ...ROOM_AIR_ENV, exactEnergyLedger: true } : { exactEnergyLedger: true }),
    coherentRigidSolids: true,
    allowReducedProductProperties: true
  });
  const viewState = createSphPhaseViewState(driver);
  const staticTables = sphStaticTableInputsFromViewState(viewState);
  return { driver, viewState, staticTables };
}

test('binary covalent synthesis discovers balanced nonmetal compounds and excludes endothermic N2 pairs', () => {
  const expected = [
    ['C', 'O2', 'CO2', 'C + O2 -> CO2'],
    ['S', 'O2', 'SO2', 'S + O2 -> SO2'],
    ['N2', 'H2', 'NH3', '3 H2 + N2 -> 2 NH3'],
    ['Si', 'O2', 'SiO2', 'Si + O2 -> SiO2'],
    ['P', 'Cl2', 'PCl3', '2 P + 3 Cl2 -> 2 PCl3'],
    ['N2', 'F2', 'NF3', 'N2 + 3 F2 -> 2 NF3']
  ];
  for (const [left, right, productFormula, equation] of expected) {
    const result = discoverReactionCandidates(left, right);
    const covalent = result.candidates.filter((c) => c.familyId === 'binary-covalent-synthesis');
    assert.equal(covalent.length, 1, `expected one binary-covalent-synthesis for ${left}+${right}`);
    assert.equal(covalent[0].productFormula, productFormula);
    assert.equal(covalent[0].equation, equation);
    assert.equal(covalent[0].atomBalance.balanced, true);
    assert.ok(covalent[0].energetics.specificEnthalpyJPerKgProduct < 0);
  }

  // H + O is excluded from binary-covalent-synthesis so hydrogenOxygenReaction
  // in reactionDiscovery.js remains its sole balanced owner (2 H2 + O2 -> 2 H2O).
  const ho = discoverReactionCandidates('H2', 'O2');
  assert.equal(ho.candidates.filter((c) => c.familyId === 'binary-covalent-synthesis').length, 0);

  // Endothermic N≡N triple-bond pairs must not emit spontaneous binary covalent synthesis.
  for (const [left, right] of [['N2', 'O2'], ['N2', 'Cl2'], ['N2', 'S'], ['C', 'N2']]) {
    const res = discoverReactionCandidates(left, right);
    assert.equal(
      res.candidates.filter((c) => c.familyId === 'binary-covalent-synthesis').length,
      0,
      `expected no spontaneous binary-covalent-synthesis for endothermic ${left}+${right}`
    );
  }
});

test('periodic-table pairings across ionic, covalent, heavy Debye, case-colliding, and noble-gas families admit in vacuum and humid room air', () => {
  const matrix = [
    { pair: ['H', 'O'], vacuumMinRxns: 1, airRequiresEnergyAuthority: true },
    { pair: ['N', 'H'], vacuumMinRxns: 1, airRequiresEnergyAuthority: true },
    { pair: ['C', 'O'], vacuumMinRxns: 1 },
    { pair: ['S', 'O'], vacuumMinRxns: 1 },
    { pair: ['Si', 'O'], vacuumMinRxns: 1 },
    { pair: ['P', 'Cl'], vacuumMinRxns: 1 },
    { pair: ['K', 'Br'], vacuumMinRxns: 1 },
    { pair: ['Al', 'Cl'], vacuumMinRxns: 1 },
    { pair: ['Ca', 'O'], vacuumMinRxns: 1 },
    { pair: ['Fe', 'S'], vacuumMinRxns: 1 },
    { pair: ['Fe', 'Cl'], vacuumMinRxns: 1 },
    { pair: ['K', 'h2o'], vacuumMinRxns: 1 },
    { pair: ['He', 'Ne'], vacuumMinRxns: 0, exactVacuumRxns: 0 }
  ];

  for (const entry of matrix) {
    const [a, b] = entry.pair;
    const vac = buildPairDemo(a, b, { air: false });
    if (entry.exactVacuumRxns != null) {
      assert.equal(vac.staticTables.reactionTable.reactionCount, entry.exactVacuumRxns, `vacuum ${a}+${b}`);
    } else {
      assert.ok(
        vac.staticTables.reactionTable.reactionCount >= entry.vacuumMinRxns,
        `expected >= ${entry.vacuumMinRxns} vacuum reaction(s) for ${a}+${b}`
      );
    }

    const air = buildPairDemo(a, b, { air: true });
    assert.ok(air.staticTables.thermalMaterialTable.materialCount > 0, `air thermal table for ${a}+${b}`);
    if (entry.airRequiresEnergyAuthority) {
      assert.ok(
        air.staticTables.reactionTable.energyAuthority,
        `expected physical reaction energy authority in room air for ${a}+${b}`
      );
    }
  }
});
