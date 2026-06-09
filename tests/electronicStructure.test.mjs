import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  correlationPerElectronHa,
  exchangePerElectronHa,
  kineticPerElectronHa,
  uegEnergyPerElectronHa
} from '../src/runtime/electronicStructure/uniformElectronGas.js';
import {
  equilibriumRsBohr,
  simpleMetalColdCurve
} from '../src/runtime/electronicStructure/jelliumCohesion.js';

const NA_MASS_KG = 22.989769e-3 / 6.02214076e23;

test('UEG kinetic and exchange match the exact Thomas–Fermi / Dirac values', () => {
  for (const rs of [1, 2, 5]) {
    assert.ok(Math.abs(kineticPerElectronHa(rs) - 1.10495 / rs ** 2) < 1e-4);
    assert.ok(Math.abs(exchangePerElectronHa(rs) - -0.458165 / rs) < 1e-4);
  }
});

test('UEG correlation matches Ceperley–Alder QMC within a few percent', () => {
  // Ceperley–Alder / PZ benchmark correlation energies per electron (Ha).
  const ca = { 1: -0.0598, 2: -0.0448, 5: -0.0287 };
  for (const rs of [1, 2, 5]) {
    const ec = correlationPerElectronHa(rs);
    assert.ok(Math.abs(ec - ca[rs]) / Math.abs(ca[rs]) < 0.05, `r_s=${rs}: ${ec} vs ${ca[rs]}`);
  }
});

test('jellium cohesion derives sodium density and bulk modulus from electronic structure', () => {
  // Sodium with its Ashcroft empty-core radius (~1.76 Bohr): the one element-specific input.
  const na = simpleMetalColdCurve({ atomicMassKg: NA_MASS_KG, valenceElectronsPerAtom: 1, emptyCoreRadiusBohr: 1.76 });
  assert.ok(na.equilibriumRsBohr > 3.7 && na.equilibriumRsBohr < 4.2, `r_s ${na.equilibriumRsBohr}`);
  // Experimental Na: density 971 kg/m^3, bulk modulus 6.3 GPa.
  assert.ok(Math.abs(na.equilibriumDensityKgPerM3 - 971) / 971 < 0.1, `density ${na.equilibriumDensityKgPerM3}`);
  assert.ok(na.bulkModulusPa / 1e9 > 4 && na.bulkModulusPa / 1e9 < 10, `B ${na.bulkModulusPa / 1e9} GPa`);
});

test('a bare point ion (no pseudopotential core) overbinds — the empty core is physically required', () => {
  const pointIon = equilibriumRsBohr({ emptyCoreRadiusBohr: 0 });
  const withCore = equilibriumRsBohr({ emptyCoreRadiusBohr: 1.76 });
  assert.ok(pointIon < 2.0, `point-ion r_s ${pointIon} is unphysically small (overbound)`);
  assert.ok(withCore > pointIon, 'the empty core expands the lattice to the physical density');
});

test('UEG total energy is negative (bound) at metallic densities', () => {
  assert.ok(uegEnergyPerElectronHa(4) < 0);
});
