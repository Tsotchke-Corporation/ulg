import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ELEMENT_CONFIGURATIONS, solveKohnShamAtomConfig } from '../src/runtime/electronicStructure/radialKohnSham.js';

test('multi-shell KS-LDA reproduces beryllium and neon total energies and electron counts', () => {
  const be = solveKohnShamAtomConfig({ atomicNumberZ: 4, configuration: ELEMENT_CONFIGURATIONS.Be.config, gridPointsN: 5000, rMaxBohr: 14 });
  assert.ok(Math.abs(be.integratedElectrons - 4) < 0.02);
  assert.ok(Math.abs(be.totalEnergyHa - -14.45) < 0.2, `Be ${be.totalEnergyHa}`); // LDA ref ~ -14.45 Ha

  const ne = solveKohnShamAtomConfig({ atomicNumberZ: 10, configuration: ELEMENT_CONFIGURATIONS.Ne.config, gridPointsN: 5000, rMaxBohr: 12 });
  assert.ok(Math.abs(ne.integratedElectrons - 10) < 0.02);
  assert.ok(Math.abs(ne.totalEnergyHa - -128.2) < 1.0, `Ne ${ne.totalEnergyHa}`); // LDA ref ~ -128.2 Ha
});

test('all-electron KS-LDA solves the iron atom: 26 electrons, full shell structure, 3d below 4s', () => {
  const fe = solveKohnShamAtomConfig({
    atomicNumberZ: 26, configuration: ELEMENT_CONFIGURATIONS.Fe.config,
    gridPointsN: 5000, rMaxBohr: 12, mixing: 0.15, maxScf: 400
  });
  // Charge conservation: integrates to exactly 26 electrons.
  assert.ok(Math.abs(fe.integratedElectrons - 26) < 0.1, `electrons ${fe.integratedElectrons}`);
  // Total energy near the non-relativistic LDA reference (~-1261 Ha); grid-limited deep core.
  assert.ok(fe.totalEnergyHa > -1290 && fe.totalEnergyHa < -1230, `total ${fe.totalEnergyHa}`);
  // The full 1s..4s,3d structure is present and every shell is bound.
  assert.equal(fe.orbitals.length, 7);
  assert.ok(fe.orbitals.every((o) => o.energyHa < 0));
  // The famous LDA atomic ordering: 3d lies below 4s in the neutral iron atom.
  const e4s = fe.orbitals.find((o) => o.n === 4 && o.l === 0).energyHa;
  const e3d = fe.orbitals.find((o) => o.l === 2).energyHa;
  assert.ok(e3d < e4s, `3d ${e3d} should be below 4s ${e4s}`);
  // Deep 1s core on the order of -250 Ha.
  const e1s = fe.orbitals.find((o) => o.n === 1).energyHa;
  assert.ok(e1s < -240 && e1s > -270, `1s ${e1s}`);
});
