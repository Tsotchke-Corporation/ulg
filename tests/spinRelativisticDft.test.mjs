import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  solveAtom,
  relativisticOrbitalCorrectionHa
} from '../src/runtime/electronicStructure/radialKohnSham.js';
import {
  spinScalingF,
  xcEnergyPerElectronSpinHa,
  exchangePerElectronSpinHa,
  exchangePerElectronHa
} from '../src/runtime/electronicStructure/uniformElectronGas.js';
import { unpairedElectronCount } from '../src/runtime/electronicStructure/periodicTable.js';

test('spin-scaling f(zeta): 0 unpolarized, 1 fully polarized; exchange enhances by 2^{1/3}', () => {
  assert.ok(Math.abs(spinScalingF(0)) < 1e-12);
  assert.ok(Math.abs(spinScalingF(1) - 1) < 1e-12);
  // Fully polarized exchange = 2^{1/3} * unpolarized.
  const rs = 3;
  assert.ok(Math.abs(exchangePerElectronSpinHa(rs, 1) - 2 ** (1 / 3) * exchangePerElectronHa(rs)) < 1e-12);
  // Unpolarized spin xc reduces to the para limit at zeta = 0.
  assert.ok(xcEnergyPerElectronSpinHa(rs, 0) < 0);
});

test('LSDA spin moments match Hund unpaired counts: N=3, O=2, Cr=6, Fe=4 (Fe ~4 muB)', () => {
  for (const [Z, expect] of [[7, 3], [8, 2], [24, 6], [26, 4]]) {
    const res = solveAtom(Z, { spinPolarized: true });
    assert.ok(Math.abs(res.spinMoment - expect) < 0.02, `Z=${Z}: moment ${res.spinMoment.toFixed(3)} != ${expect}`);
    assert.ok(Math.abs(res.integratedElectrons - Z) < 1e-2);
  }
});

test('spin polarization lowers the open-shell total energy (Hund stabilization)', () => {
  for (const Z of [8, 26]) {
    const lda = solveAtom(Z);
    const lsda = solveAtom(Z, { spinPolarized: true });
    assert.ok(lsda.totalEnergyHa < lda.totalEnergyHa, `Z=${Z}: LSDA not below LDA`);
  }
});

test('scalar-relativistic orbital correction is exact for a hydrogenic 1s: -alpha^2 Z^4/8', () => {
  const ALPHA = 7.2973525693e-3;
  for (const Z of [10, 20, 40]) {
    const N = 6000;
    const rMin = 1e-7;
    const rMax = (300 / Z);
    const xMin = Math.log(rMin);
    const dx = (Math.log(rMax) - xMin) / (N - 1);
    const r = new Float64Array(N);
    const u = new Float64Array(N);
    for (let i = 0; i < N; i += 1) {
      r[i] = Math.exp(xMin + i * dx);
      u[i] = r[i] * 2 * Z ** 1.5 * Math.exp(-Z * r[i]); // exact hydrogenic 1s, u = rR
    }
    let nrm = 0;
    for (let i = 0; i < N; i += 1) nrm += u[i] * u[i] * r[i] * dx;
    nrm = Math.sqrt(nrm);
    for (let i = 0; i < N; i += 1) u[i] /= nrm;
    const vFull = new Float64Array(N);
    for (let i = 0; i < N; i += 1) vFull[i] = -Z / r[i];
    const corr = relativisticOrbitalCorrectionHa({ u, energyHa: -Z * Z / 2, vFull, r, dx, l: 0, atomicNumberZ: Z });
    const exact = -ALPHA * ALPHA * Z ** 4 / 8;
    assert.ok(Math.abs((corr - exact) / exact) < 0.01, `Z=${Z}: ${corr.toFixed(5)} vs exact ${exact.toFixed(5)}`);
  }
});

test('atomic scalar-relativistic correction is negative and grows steeply with Z', () => {
  const ne = solveAtom(10, { relativistic: true });
  const kr = solveAtom(36, { relativistic: true });
  assert.ok(ne.relativisticCorrectionHa < 0);
  assert.ok(kr.relativisticCorrectionHa < ne.relativisticCorrectionHa); // more negative
  assert.ok(kr.totalEnergyRelHa < kr.totalEnergyHa);
  // Rough Z^4 core scaling: Kr/Ne correction ratio is large.
  assert.ok(kr.relativisticCorrectionHa / ne.relativisticCorrectionHa > 20);
});

test('unpaired electron counts: Hund for representative open shells', () => {
  assert.equal(unpairedElectronCount(7), 3); // N 2p3
  assert.equal(unpairedElectronCount(26), 4); // Fe 3d6 -> 5up 1down
  assert.equal(unpairedElectronCount(2), 0); // He closed
});
