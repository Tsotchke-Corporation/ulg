// The banked molecular vibrations (offline RHF/STO-3G Hessian derivations)
// and their consumption as temperature-dependent gas heat capacities in the
// material derivation chain.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import bank from '../data/material-properties/molecular-vibrations.json' with { type: 'json' };
import { idealGasHeatCapacity } from '../src/runtime/electronicStructure/molecularThermochemistry.js';
import { deriveFormulaMaterialProperties } from '../src/runtime/material/materialDerivation.js';

const R = 8.314462618;
const closed = new Map(bank.records
  .filter((r) => r.status === 'harmonic-minimum-closed')
  .map((r) => [r.key, r]));

test('closed bank records are bound, unfragmented minima with real modes', () => {
  for (const record of closed.values()) {
    const atoms = record.optimizedAtoms;
    assert.ok(atoms.length >= 3, `${record.key}: polyatomic-only scope`);
    // Connectivity: every atom within bonding range (4 Bohr) of a neighbor —
    // a dissociated fragment set must never be banked as a closed minimum
    // (the pre-fix generator banked CO2 split into O2 + a carbon 14 A away).
    for (const [i, a] of atoms.entries()) {
      const nearest = Math.min(...atoms
        .filter((_, j) => j !== i)
        .map((b) => Math.hypot(
          a.positionBohr[0] - b.positionBohr[0],
          a.positionBohr[1] - b.positionBohr[1],
          a.positionBohr[2] - b.positionBohr[2]
        )));
      assert.ok(nearest < 4, `${record.key}: atom ${i} nearest neighbor ${nearest.toFixed(2)} Bohr`);
    }
    assert.ok(record.vibrationsCm1.every((nu) => nu > 50), `${record.key}: no imaginary/soft modes`);
    // Physical harmonic modes top out near the H2 stretch (~4400 cm^-1);
    // collapsed/SCF-failed geometries produced 74k-129k cm^-1 pseudo-modes.
    assert.ok(record.vibrationsCm1.every((nu) => nu < 8000), `${record.key}: modes within physical range`);
    assert.equal(record.vibrationsCm1.length, record.expectedModeCount);
  }
});

test('H2O record closes on the textbook STO-3G geometry', () => {
  const h2o = closed.get('H2O');
  assert.ok(h2o, 'H2O must be banked (bends matter for steam Cp(T))');
  const [o, h1] = [h2o.optimizedAtoms.find((a) => a.Z === 8), h2o.optimizedAtoms.find((a) => a.Z === 1)];
  const oh = Math.hypot(...o.positionBohr.map((x, d) => x - h1.positionBohr[d]));
  // STO-3G O-H is 0.989 A = 1.869 Bohr; a broad window still catches a
  // collapsed or dissociated geometry.
  assert.ok(oh > 1.6 && oh < 2.2, `O-H ${oh.toFixed(3)} Bohr`);
});

test('banked vibrations give Cp(T) that rises from ambient toward the classical limit', () => {
  for (const record of closed.values()) {
    const atoms = record.optimizedAtoms.map((a) => ({ Z: a.Z, position: [...a.positionBohr] }));
    const ambient = idealGasHeatCapacity(atoms, record.vibrationsCm1, 298.15).cpJPerMolK;
    const hot = idealGasHeatCapacity(atoms, record.vibrationsCm1, 2500).cpJPerMolK;
    const classicalCp = (1.5 + (record.linear ? 1 : 1.5) + record.vibrationsCm1.length + 1) * R;
    assert.ok(hot > ambient, `${record.key}: Cp(2500K) ${hot.toFixed(2)} > Cp(298K) ${ambient.toFixed(2)}`);
    assert.ok(hot <= classicalCp + 1e-6, `${record.key}: Cp(2500K) below classical limit ${classicalCp.toFixed(2)}`);
  }
});

test('CO2 bends are thermally active at ambient (the payoff over equipartition)', () => {
  const co2 = closed.get('CO2');
  assert.ok(co2, 'CO2 must be banked (Boys-precision + internal-coordinate + linear-drop fixes)');
  assert.equal(co2.vibrationsCm1.length, 4, 'linear triatomic: 3N-5 modes with the degenerate bend pair');
  const props = deriveFormulaMaterialProperties({ formula: 'CO2', phaseModel: 'ideal-gas' });
  assert.equal(props.heatCapacityModel.gas, 'molecular-rrho-harmonic-vibrations-banked');
  const cpMolar = props.phases[0].cpJPerKgK * props.molarMassKgPerMol;
  // Equipartition gives 7/2 R = 29.1; experiment is 37.1 at 298 K. The
  // banked ~566 cm^-1 bends must contribute several J/mol/K. (Derivation
  // runs at STANDARD_TEMPERATURE_K = 273.15, slightly below 298.)
  assert.ok(cpMolar > 3.5 * R + 4, `CO2 Cp ${cpMolar.toFixed(2)} J/mol/K must show bend activity`);
  assert.ok(cpMolar < 3.5 * R + 15, `CO2 Cp ${cpMolar.toFixed(2)} J/mol/K within physical range`);
});

test('ideal-gas derivation consumes banked vibrations for H2O', () => {
  const props = deriveFormulaMaterialProperties({ formula: 'H2O', phaseModel: 'ideal-gas' });
  assert.equal(props.heatCapacityModel.gas, 'molecular-rrho-harmonic-vibrations-banked');
  assert.equal(props.gasVibrationsCm1.length, 3);
  const cp = props.phases[0].cpJPerKgK;
  // At standard temperature the H2O modes are frozen, so the banked result
  // must agree with the nonlinear rigid-rotor value 4R/M (~1848 J/kg/K) —
  // and with the measured 33.6 J/mol/K within the model's ~1%.
  const rigidRotor = (4 * R) / props.molarMassKgPerMol;
  assert.ok(Math.abs(cp - rigidRotor) / rigidRotor < 0.02, `cp ${cp.toFixed(1)} vs rigid-rotor ${rigidRotor.toFixed(1)}`);
});

test('unbanked gas species keep the equipartition model tag', () => {
  const props = deriveFormulaMaterialProperties({ formula: 'N2', phaseModel: 'ideal-gas' });
  assert.equal(props.heatCapacityModel.gas, 'molecular-equipartition');
  // Diatomic stretch is frozen at ambient: Cp = 7/2 R exactly.
  const cpMolar = props.phases[0].cpJPerKgK * props.molarMassKgPerMol;
  assert.ok(Math.abs(cpMolar - 3.5 * R) < 0.05, `N2 Cp ${cpMolar.toFixed(3)} J/mol/K`);
});

test('runtime energy ladder gives temperature-dependent gas cp (Einstein sub-segments)', async () => {
  const { specificInternalEnergyJPerKg } = await import('../src/runtime/material/thermoState.js');
  const { equilibriumFromSpecificEnergy } = await import('../src/runtime/material/phaseEquilibrium.js');
  const props = deriveFormulaMaterialProperties({ formula: 'CO2', phaseModel: 'ideal-gas' });
  // Effective cp must RISE with temperature as the 566 cm^-1 bends and the
  // stretches activate: du over [900, 1000] K exceeds du over [200, 300] K.
  const duCold = specificInternalEnergyJPerKg(props, 300) - specificInternalEnergyJPerKg(props, 200);
  const duHot = specificInternalEnergyJPerKg(props, 1000) - specificInternalEnergyJPerKg(props, 900);
  assert.ok(duHot > duCold * 1.15, `cp(950K)/cp(250K) = ${(duHot / duCold).toFixed(3)} must exceed 1.15`);
  // Round trip through the inverse at a hot point: the piecewise-linear
  // ladder must reproduce T within a sub-segment's width.
  const eHot = specificInternalEnergyJPerKg(props, 1234);
  const eq = equilibriumFromSpecificEnergy(props, eHot);
  assert.ok(Math.abs(eq.temperatureK - 1234) < 5, `round trip ${eq.temperatureK.toFixed(1)} K vs 1234 K`);
  assert.equal(eq.stablePhase, 'gas');
});
