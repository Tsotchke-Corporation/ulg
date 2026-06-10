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

import { mp2 } from '../src/runtime/electronicStructure/molecularHartreeFock.js';

test('MP2 adds the correlation energy HF misses (H2 correlation is exact for STO-3G)', () => {
  const r = mp2([{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.4] }]);
  assert.ok(r.mp2CorrelationHa < 0, 'correlation must lower the energy');
  assert.ok(Math.abs(r.mp2CorrelationHa - (-0.0131)) < 1e-3, `H2 Ecorr ${r.mp2CorrelationHa}`);
  assert.ok(r.totalEnergyHa < r.hfEnergyHa);
  // Water: all-electron MP2 correlation is a few ×10^-2 Ha and lowers the energy.
  const w = mp2([{ Z: 8, position: [0, 0, 0] }, { Z: 1, position: [1.43, 0, 1.108] }, { Z: 1, position: [-1.43, 0, 1.108] }]);
  assert.ok(w.mp2CorrelationHa < -0.01 && w.mp2CorrelationHa > -0.1);
  assert.ok(w.totalEnergyHa < w.hfEnergyHa);
});

import { optimizeGeometry, bondLength, bondAngle } from '../src/runtime/electronicStructure/molecularHartreeFock.js';

test('geometry optimization predicts molecular structure from first principles', () => {
  // H2 relaxes from a stretched guess to near the STO-3G equilibrium (~1.39 bohr).
  const h2 = optimizeGeometry([{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.7] }]);
  const r = bondLength(h2.atoms, 0, 1);
  assert.ok(r > 1.25 && r < 1.45, `H2 R ${r.toFixed(3)} bohr`);
  // Water: bond length ~0.99 A (1.87 bohr) and angle ~100 deg come out of the energy.
  const w = optimizeGeometry([{ Z: 8, position: [0, 0, 0] }, { Z: 1, position: [1.7, 0, 0.9] }, { Z: 1, position: [-1.6, 0, 1.0] }]);
  const oh = bondLength(w.atoms, 0, 1);
  const angle = bondAngle(w.atoms, 1, 0, 2);
  assert.ok(oh > 1.7 && oh < 2.0, `OH ${oh.toFixed(3)} bohr`);
  assert.ok(angle > 95 && angle < 112, `HOH angle ${angle.toFixed(1)} deg`);
});
