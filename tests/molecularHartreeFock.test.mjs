import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rhf, diatomicCurve, reactionEnergyHa } from '../src/runtime/electronicStructure/molecularHartreeFock.js';

test('H2 RHF/STO-3G energy and bond length match the known reference', () => {
  const { equilibriumRBohr, minEnergyHa } = diatomicCurve(1, 1, [1.0, 1.2, 1.3, 1.39, 1.5, 1.8, 2.5]);
  assert.ok(Math.abs(minEnergyHa - (-1.1167)) < 5e-3, `E ${minEnergyHa}`);
  assert.ok(equilibriumRBohr > 1.2 && equilibriumRBohr < 1.6, `R ${equilibriumRBohr}`);
  // Bonding really emerges: a finite-R minimum below both compressed and separated geometries.
  const short = rhf([{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.0] }]).totalEnergyHa;
  const longR = rhf([{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 2.5] }]).totalEnergyHa;
  assert.ok(minEnergyHa < short && minEnergyHa < longR);
});

test('water (O 2p orbitals) matches the known RHF/STO-3G total energy', () => {
  const e = rhf([
    { Z: 8, position: [0, 0, 0] },
    { Z: 1, position: [1.43, 0, 1.108] },
    { Z: 1, position: [-1.43, 0, 1.108] }
  ]);
  assert.equal(e.nBasis, 7);
  assert.equal(e.nElectrons, 10);
  assert.ok(Math.abs(e.totalEnergyHa - (-74.96)) < 0.02, `E ${e.totalEnergyHa}`);
});

test('CO binds at a sensible bond length with the known energy', () => {
  const { equilibriumRBohr, minEnergyHa } = diatomicCurve(6, 8, [1.8, 2.0, 2.13, 2.2, 2.4, 2.8]);
  assert.ok(equilibriumRBohr > 2.0 && equilibriumRBohr < 2.4, `R ${equilibriumRBohr}`);
  assert.ok(Math.abs(minEnergyHa - (-111.22)) < 0.02, `E ${minEnergyHa}`);
});

test('reaction energy is computed from first principles and conserves nuclei', () => {
  // Water-gas shift: CO + H2O -> CO2 + H2 (all closed-shell).
  const CO = [{ Z: 6, position: [0, 0, 0] }, { Z: 8, position: [0, 0, 2.13] }];
  const H2O = [{ Z: 8, position: [0, 0, 0] }, { Z: 1, position: [1.43, 0, 1.108] }, { Z: 1, position: [-1.43, 0, 1.108] }];
  const CO2 = [{ Z: 6, position: [0, 0, 0] }, { Z: 8, position: [0, 0, 2.2] }, { Z: 8, position: [0, 0, -2.2] }];
  const H2 = [{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.39] }];
  const dE = reactionEnergyHa([CO, H2O], [CO2, H2]);
  assert.ok(Number.isFinite(dE));
  // Nucleus conservation is enforced.
  assert.throws(() => reactionEnergyHa([CO], [H2]), /not balanced/);
});

import { uhf, atomEnergyHa, atomizationEnergyHa } from '../src/runtime/electronicStructure/molecularHartreeFock.js';

test('UHF atom energies match STO-3G HF references and reduce to RHF for closed shells', () => {
  assert.ok(Math.abs(atomEnergyHa(1) - (-0.4666)) < 5e-3); // H
  assert.ok(Math.abs(atomEnergyHa(8) - (-73.804)) < 0.02); // O (triplet)
  const o = uhf([{ Z: 8, position: [0, 0, 0] }], { multiplicity: 3 });
  assert.equal(o.nAlpha, 5);
  assert.equal(o.nBeta, 3);
  // Closed-shell H2: UHF == RHF.
  const u = uhf([{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.39] }], { multiplicity: 1 });
  assert.ok(Math.abs(u.totalEnergyHa - rhf([{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.39] }]).totalEnergyHa) < 1e-4);
});

test('atomization energy is derived, bound, and the right order of magnitude', () => {
  const HA_EV = 27.211386;
  const h2 = atomizationEnergyHa([{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.39] }]);
  const eV = h2.atomizationEnergyHa * HA_EV;
  assert.ok(eV > 0, 'H2 must be bound'); // Σ atoms above the molecule
  assert.ok(eV > 3 && eV < 7, `H2 atomization ${eV.toFixed(2)} eV (exp 4.75; HF/STO-3G qualitative)`);
});
