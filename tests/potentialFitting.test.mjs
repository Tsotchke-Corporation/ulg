import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitMoonlabH2Potential, fitMorsePotential, morsePotential } from '../src/runtime/md/potentialFitting.js';
import { createMdSystem, runMd } from '../src/runtime/md/mdEngine.js';

const HARTREE_TO_J = 4.3597447222071e-18;

test('Morse fit to the MoonLab H2 curve recovers the bond length and dissociation energy', () => {
  const { fitAngstromHartree: fit, potential } = fitMoonlabH2Potential();
  // Equilibrium bond length 0.7414 Å (experimental), well depth ~3.87 eV (0.142 Ha).
  assert.ok(Math.abs(fit.equilibrium - 0.7414) < 0.02, `re ${fit.equilibrium}`);
  assert.ok(Math.abs(fit.dissociationEnergy - 0.142) < 0.02, `De ${fit.dissociationEnergy} Ha`);
  // Force vanishes at the equilibrium separation, energy = −De there.
  const reM = fit.equilibrium * 1e-10;
  assert.ok(Math.abs(potential.forceScalarN(reM)) < 1e-15);
  assert.ok(Math.abs(potential.energyJ(reM) / HARTREE_TO_J + fit.dissociationEnergy) < 1e-3);
});

test('the fitter round-trips a known Morse potential', () => {
  const trueParams = { equilibrium: 1.2, dissociationEnergy: 0.2, width: 2.5 };
  const samples = [];
  for (let r = 0.7; r <= 3.0; r += 0.05) {
    const e = Math.exp(-trueParams.width * (r - trueParams.equilibrium));
    samples.push({ r, E: trueParams.dissociationEnergy * ((1 - e) ** 2 - 1) }); // asymptote 0
  }
  const fit = fitMorsePotential({ samples, dissociationEnergy: 0, fitMaxR: 3.0 });
  assert.ok(Math.abs(fit.equilibrium - 1.2) < 0.05);
  assert.ok(Math.abs(fit.dissociationEnergy - 0.2) < 0.01);
  assert.ok(Math.abs(fit.width - 2.5) < 0.1);
  assert.ok(fit.rmsErr < 1e-3);
});

test('the fitted potential drives the MD engine: a bound pair oscillates around r_e', () => {
  const { fitAngstromHartree: fit, potential } = fitMoonlabH2Potential();
  const reM = fit.equilibrium * 1e-10;
  const massH = 1.6735e-27;
  const boxLengthM = 2e-9;
  // Two atoms ~r_e apart with a small stretch; thermal energy ≪ De so they stay bound.
  const sys = createMdSystem({
    positions: [[boxLengthM / 2 - reM / 2, boxLengthM / 2, boxLengthM / 2], [boxLengthM / 2 + reM * 0.6, boxLengthM / 2, boxLengthM / 2]],
    velocities: [[0, 0, 0], [0, 0, 0]],
    massKg: massH,
    boxLengthM,
    potential
  });
  const samples = runMd(sys, { steps: 2000, dtS: 1e-16, equilibrationSteps: 0 });
  const dx = sys.x[0][0] - sys.x[1][0];
  const finalSeparation = Math.abs(dx - boxLengthM * Math.round(dx / boxLengthM));
  // Stayed bound: separation oscillates near r_e, never dissociates past the cutoff.
  assert.ok(finalSeparation > 0.5 * reM && finalSeparation < 2.0 * reM, `separation ${finalSeparation} vs re ${reM}`);
  assert.ok(Number.isFinite(samples.totalEnergyJ.at(-1)));
});
