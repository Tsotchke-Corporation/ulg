import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeChemicalFormula } from '../src/runtime/chemistry/formula.js';
import {
  PROVISIONAL_ENERGETICS_STATUS,
  discoverReactionCandidates
} from '../src/runtime/chemistry/reactionCandidates.js';

function onlyCandidate(result, familyId) {
  const matches = result.candidates.filter((candidate) => candidate.familyId === familyId);
  assert.equal(matches.length, 1, `expected one ${familyId} candidate`);
  return matches[0];
}

function assertUnvalidated(candidate) {
  assert.equal(candidate.scientificValidation, false);
  assert.equal(candidate.validation.scientificValidation, false);
  assert.equal(candidate.energetics.status, PROVISIONAL_ENERGETICS_STATUS);
  assert.equal(candidate.energetics.validation.scientificValidation, false);
  assert.match(candidate.energetics.notes.join(' '), /provisional|heuristic|not validated/i);
}

test('formula parser accepts lowercase demo keys and binary compound formulas', () => {
  assert.deepEqual(describeChemicalFormula('h2o').atomCounts, { 1: 2, 8: 1 });
  assert.equal(describeChemicalFormula('h2o').formula, 'H2O');
  assert.deepEqual(describeChemicalFormula('nacl').atomCounts, { 11: 1, 17: 1 });
  assert.equal(describeChemicalFormula('naoh').formula, 'NaOH');
  assert.deepEqual(describeChemicalFormula('Cl2').atomCounts, { 17: 2 });
});

test('Li, Na, and Cs water reactions are discovered by the same hydroxide family', () => {
  const metals = ['Li', 'Na', 'Cs'];
  const familyIds = new Set();
  for (const metal of metals) {
    const result = discoverReactionCandidates(metal, 'H2O');
    const candidate = onlyCandidate(result, 'active-metal-water-hydroxide');
    familyIds.add(candidate.familyId);
    assert.equal(candidate.productFormula, `${metal}OH`);
    assert.equal(candidate.equation, `2 ${metal} + 2 H2O -> 2 ${metal}OH + H2`);
    assert.equal(candidate.atomBalance.balanced, true);
    assert.deepEqual(candidate.reactants.map(({ coefficient, formula }) => [coefficient, formula]), [[2, metal], [2, 'H2O']]);
    assert.deepEqual(candidate.products.map(({ coefficient, formula }) => [coefficient, formula]), [[2, `${metal}OH`], [1, 'H2']]);
    assert.ok(candidate.energetics.specificEnthalpyJPerKgProduct < 0);
    assertUnvalidated(candidate);
  }
  assert.deepEqual([...familyIds], ['active-metal-water-hydroxide']);
});

test('iron is not scoped as a zero-barrier active-metal water candidate', () => {
  const result = discoverReactionCandidates('Fe', 'H2O');
  assert.equal(result.candidates.filter((candidate) => candidate.familyId === 'active-metal-water-hydroxide').length, 0);
});

test('Na + Cl and Na + Cl2 are parsed and balanced as the same binary ionic family', () => {
  const atomChlorine = onlyCandidate(discoverReactionCandidates('Na', 'Cl'), 'binary-ionic-synthesis');
  assert.equal(atomChlorine.productFormula, 'NaCl');
  assert.equal(atomChlorine.equation, 'Na + Cl -> NaCl');
  assert.equal(atomChlorine.atomBalance.balanced, true);
  assertUnvalidated(atomChlorine);

  const molecularChlorineResult = discoverReactionCandidates('Na', 'Cl2');
  assert.equal(molecularChlorineResult.inputs.right.formula, 'Cl2');
  const molecularChlorine = onlyCandidate(molecularChlorineResult, 'binary-ionic-synthesis');
  assert.equal(molecularChlorine.productFormula, 'NaCl');
  assert.equal(molecularChlorine.equation, '2 Na + Cl2 -> 2 NaCl');
  assert.equal(molecularChlorine.atomBalance.balanced, true);
  assertUnvalidated(molecularChlorine);
});

test('binary ionic synthesis balances charge-derived formula units beyond 1:1 salts', () => {
  const magnesiumChloride = onlyCandidate(discoverReactionCandidates('Mg', 'Cl2'), 'binary-ionic-synthesis');
  assert.equal(magnesiumChloride.productFormula, 'MgCl2');
  assert.equal(magnesiumChloride.equation, 'Mg + Cl2 -> MgCl2');
  assert.equal(magnesiumChloride.atomBalance.balanced, true);

  const aluminumOxide = onlyCandidate(discoverReactionCandidates('Al', 'O2'), 'binary-ionic-synthesis');
  assert.equal(aluminumOxide.productFormula, 'Al2O3');
  assert.equal(aluminumOxide.equation, '4 Al + 3 O2 -> 2 Al2O3');
  assert.equal(aluminumOxide.atomBalance.balanced, true);
  assertUnvalidated(aluminumOxide);
});
