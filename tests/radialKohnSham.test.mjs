import assert from 'node:assert/strict';
import { test } from 'node:test';
import { solveKohnShamAtom } from '../src/runtime/electronicStructure/radialKohnSham.js';

test('Kohn–Sham LDA reproduces the helium atom total energy and 1s orbital energy', () => {
  const he = solveKohnShamAtom({ atomicNumberZ: 2, occupancy: 2, l: 0 });
  // LDA helium: total ~ -2.83 Ha (exact -2.904, HF -2.862); 1s orbital energy ~ -0.57 Ha.
  assert.ok(Math.abs(he.totalEnergyHa - -2.83) < 0.05, `total ${he.totalEnergyHa}`);
  assert.ok(Math.abs(he.orbitalEnergyHa - -0.57) < 0.05, `eps_1s ${he.orbitalEnergyHa}`);
});

test('a more-charged He-like ion is more tightly bound', () => {
  const he = solveKohnShamAtom({ atomicNumberZ: 2, occupancy: 2, l: 0 });
  const liPlus = solveKohnShamAtom({ atomicNumberZ: 3, occupancy: 2, l: 0 }); // Li+ (1s^2)
  assert.ok(liPlus.totalEnergyHa < he.totalEnergyHa, `Li+ ${liPlus.totalEnergyHa} < He ${he.totalEnergyHa}`);
  // Both orbital energies are bound (negative).
  assert.ok(he.orbitalEnergyHa < 0 && liPlus.orbitalEnergyHa < 0);
});

test('the SCF result is deterministic', () => {
  const a = solveKohnShamAtom({ atomicNumberZ: 2, occupancy: 2, l: 0 });
  const b = solveKohnShamAtom({ atomicNumberZ: 2, occupancy: 2, l: 0 });
  assert.equal(a.totalEnergyHa, b.totalEnergyHa);
});
