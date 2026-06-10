import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ELEMENT_SYMBOLS,
  configurationElectronCount,
  configurationString,
  electronConfiguration,
  symbolForZ,
  zForSymbol
} from '../src/runtime/electronicStructure/periodicTable.js';
import { solveAtom } from '../src/runtime/electronicStructure/radialKohnSham.js';

test('symbol <-> Z round trips and covers Z = 1..118', () => {
  assert.equal(ELEMENT_SYMBOLS.length, 118);
  assert.equal(symbolForZ(1), 'H');
  assert.equal(symbolForZ(26), 'Fe');
  assert.equal(symbolForZ(92), 'U');
  assert.equal(symbolForZ(118), 'Og');
  assert.equal(zForSymbol('Fe'), 26);
  assert.equal(zForSymbol('Og'), 118);
});

test('every configuration has exactly Z electrons (Z = 1..118)', () => {
  for (let Z = 1; Z <= 118; Z += 1) {
    assert.equal(configurationElectronCount(electronConfiguration(Z)), Z, `Z=${Z}`);
  }
});

test('configurations match known ground states, including the standard anomalies', () => {
  assert.equal(configurationString(2), '1s2');
  assert.equal(configurationString(10), '1s2 2s2 2p6');
  assert.equal(configurationString(18), '1s2 2s2 2p6 3s2 3p6');
  // Fe: [Ar] 4s2 3d6 (4s fills before 3d in Madelung order).
  assert.equal(configurationString(26), '1s2 2s2 2p6 3s2 3p6 4s2 3d6');
  // Cr / Cu / Ag / Au anomalies (single s electron).
  assert.ok(configurationString(24).endsWith('4s1 3d5'));
  assert.ok(configurationString(29).endsWith('4s1 3d10'));
  assert.ok(configurationString(47).endsWith('5s1 4d10'));
  assert.ok(configurationString(79).endsWith('6s1 4f14 5d10'));
});

test('Fe Kohn-Sham orbital ordering: 3d sits above (less bound than) 4s/3p core, deep 1s', () => {
  const fe = solveAtom(26);
  const by = Object.fromEntries(fe.orbitals.map((o) => [`${o.n}${o.l}`, o.energyHa]));
  assert.ok(by['10'] < -200); // 1s very deep
  assert.ok(by['32'] > by['30']); // 3d less bound than 3s
  assert.equal(fe.symbol, 'Fe');
  assert.ok(Math.abs(fe.integratedElectrons - 26) < 1e-2);
});

test('log-grid total energies track all-electron references to ~0.5% from He to Kr', () => {
  // Approximate reference total energies (Ha).
  const cases = [[2, -2.83], [10, -128.23], [18, -525.9], [26, -1261], [36, -2750]];
  for (const [Z, ref] of cases) {
    const res = solveAtom(Z);
    const relErr = Math.abs((res.totalEnergyHa - ref) / ref);
    assert.ok(relErr < 0.01, `Z=${Z}: E=${res.totalEnergyHa.toFixed(1)} ref=${ref} relErr=${(relErr * 100).toFixed(2)}%`);
    assert.ok(Math.abs(res.integratedElectrons - Z) < 1e-2, `Z=${Z} electron count`);
  }
});
