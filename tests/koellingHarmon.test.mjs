import assert from 'node:assert/strict';
import { test } from 'node:test';
import { radialStatesKH, solveKohnShamAtomKH, solveAtom } from '../src/runtime/electronicStructure/radialKohnSham.js';
import { electronConfiguration } from '../src/runtime/electronicStructure/periodicTable.js';

const ALPHA = 7.2973525693e-3;
const C2 = 1 / (ALPHA * ALPHA);

// For an s-state there is only j = 1/2, so the Koelling-Harmon scalar-relativistic energy is the
// exact Dirac energy: ε_1s = c²(√(1 − (αZ)²) − 1).
test('KH bare-hydrogenic 1s reproduces the exact Dirac energy', () => {
  for (const Z of [20, 40, 80]) {
    const N = 4000;
    const rMin = 1e-7;
    const rMax = (40 / Z) * 15;
    const xMin = Math.log(rMin);
    const dx = (Math.log(rMax) - xMin) / (N - 1);
    const r = new Float64Array(N);
    for (let i = 0; i < N; i += 1) r[i] = Math.exp(xMin + i * dx);
    const vElec = new Float64Array(N); // bare Coulomb
    const states = radialStatesKH(vElec, r, dx, 0, 1, Z, [-Z * Z / 2]);
    const dirac = C2 * (Math.sqrt(1 - (ALPHA * Z) ** 2) - 1);
    assert.ok(Math.abs((states[0].energyHa - dirac) / dirac) < 1e-4, `Z=${Z}: KH ${states[0].energyHa.toFixed(3)} vs Dirac ${dirac.toFixed(3)}`);
    // And it is below the non-relativistic -Z^2/2.
    assert.ok(states[0].energyHa < -Z * Z / 2);
  }
});

test('KH SCF: stable, electron-count exact, lowers the total energy vs non-relativistic', () => {
  const Z = 18; // Argon, small grid for test speed
  const cfg = electronConfiguration(Z);
  const kh = solveKohnShamAtomKH({ atomicNumberZ: Z, configuration: cfg, gridPointsN: 900, rMaxBohr: 20 });
  const nr = solveAtom(Z, { gridPointsN: 900, rMaxBohr: 20 });
  assert.ok(Math.abs(kh.integratedElectrons - Z) < 1e-2);
  assert.ok(Number.isFinite(kh.totalEnergyHa));
  assert.ok(kh.totalEnergyHa < nr.totalEnergyHa, 'KH should lower the energy (relativistic stabilization)');
  assert.equal(kh.relativisticMethod, 'koelling-harmon');
  // 1s is the most relativistic: KH 1s well below the non-relativistic 1s.
  const kh1s = kh.orbitals.find((o) => o.n === 1 && o.l === 0).energyHa;
  const nr1s = nr.orbitals.find((o) => o.n === 1 && o.l === 0).energyHa;
  assert.ok(kh1s < nr1s);
});

test('solveAtom dispatches the KH scalar-relativistic path', () => {
  const res = solveAtom(18, { scalarRelativistic: true, gridPointsN: 900, rMaxBohr: 20 });
  assert.equal(res.symbol, 'Ar');
  assert.equal(res.relativisticMethod, 'koelling-harmon');
  assert.ok(Math.abs(res.integratedElectrons - 18) < 1e-2);
});
