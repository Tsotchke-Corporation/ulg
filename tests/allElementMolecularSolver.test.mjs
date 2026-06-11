import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allElementBondDepthEv,
  allElementBondLengthMeters,
  allElementMolecularEnergy,
  allElementReactionEnergyHa
} from '../src/runtime/electronicStructure/allElementMolecularSolver.js';

const BOHR_TO_M = 5.29177210903e-11;
const FAST_ATOMIC_OPTIONS = { gridPointsN: 220, rMaxBohr: 30, maxScf: 120 };

const atom = (Z, zBohr = 0) => ({ Z, position: [0, 0, zBohr] });

test('all-element molecular solver gives finite attractive Fe-O bonding from atomic Kohn-Sham inputs', () => {
  const bondBohr = allElementBondLengthMeters(26, 8, FAST_ATOMIC_OPTIONS) / BOHR_TO_M;
  const depthEv = allElementBondDepthEv(26, 8, FAST_ATOMIC_OPTIONS);
  assert.ok(Number.isFinite(bondBohr) && bondBohr > 0.5);
  assert.ok(Number.isFinite(depthEv) && depthEv > 0);

  const energy = allElementMolecularEnergy([atom(26), atom(8, bondBohr)], FAST_ATOMIC_OPTIONS);
  assert.equal(energy.method, 'atomic-kohn-sham-tight-binding-v0');
  assert.ok(Number.isFinite(energy.totalEnergyHa));
  assert.ok(energy.totalEnergyHa < energy.atomicReferenceEnergyHa);
  assert.ok(energy.pairEnergyHa < 0);
  assert.equal(energy.descriptors[0].Z, 26);
  assert.equal(energy.descriptors[1].Z, 8);
  assert.equal(energy.provenance.validation, false);
});

test('all-element reaction energy enforces balance and resolves Fe + O -> FeO', () => {
  const bondBohr = allElementBondLengthMeters(26, 8, FAST_ATOMIC_OPTIONS) / BOHR_TO_M;
  const fe = atom(26);
  const o = atom(8);
  const feo = { atoms: [atom(26), atom(8, bondBohr)] };
  const rx = allElementReactionEnergyHa([{ atoms: [fe] }, { atoms: [o] }], [feo], FAST_ATOMIC_OPTIONS);
  assert.equal(rx.method, 'atomic-kohn-sham-tight-binding-v0');
  assert.ok(rx.reactionEnergyHa < 0);
  const o2 = { atoms: [atom(8), atom(8, 2.28)], count: 0.5 };
  const oxideFormation = allElementReactionEnergyHa([{ atoms: [fe] }, o2], [feo], FAST_ATOMIC_OPTIONS);
  assert.ok(Number.isFinite(oxideFormation.reactionEnergyHa));
  assert.throws(() => allElementReactionEnergyHa([{ atoms: [fe] }], [feo], FAST_ATOMIC_OPTIONS), /not balanced/);
});
