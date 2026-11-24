import test from 'node:test';
import assert from 'node:assert/strict';

import { describeIsotopologueFormula } from '../src/runtime/chemistry/formula.js';
import {
  resolveNuclearDecayChannel,
  deriveNuclearDecayChain,
  stepIsotopeInventoryLedger
} from '../src/runtime/material/nuclearCherenkovClosure.js';
import {
  canonicalMaterialIsotopeKey,
  createMaterialPolytopeRegistry
} from '../src/runtime/material/materialPolytopeRegistry.js';

test('Priority 1: describeIsotopologueFormula parses D/T, bracketed, hyphenated, and leading-mass isotopologues', () => {
  const h2o = describeIsotopologueFormula('H2O');
  const d2o = describeIsotopologueFormula('D2O');
  const t2o = describeIsotopologueFormula('T2O');
  const bracketD2o = describeIsotopologueFormula('[2H]2O');
  const uf235 = describeIsotopologueFormula('235UF6');
  const uf238 = describeIsotopologueFormula('238UF6');
  const co60 = describeIsotopologueFormula('Co-60');
  const co60Lead = describeIsotopologueFormula('60Co');
  const c14o2 = describeIsotopologueFormula('14CO2');
  const he3 = describeIsotopologueFormula('3He');

  assert.equal(h2o.hasExplicitIsotopes, false);
  assert.equal(d2o.hasExplicitIsotopes, true);
  assert.equal(t2o.hasExplicitIsotopes, true);
  assert.equal(d2o.canonicalFormula, 'H2O');
  assert.equal(d2o.canonicalIsotopologue, bracketD2o.canonicalIsotopologue);
  assert.ok(d2o.molarMassKgPerMol > h2o.molarMassKgPerMol * 1.1, 'D2O must be >10% heavier than H2O');
  assert.ok(t2o.molarMassKgPerMol > d2o.molarMassKgPerMol * 1.08, 'T2O must be heavier than D2O');

  assert.equal(uf235.canonicalFormula, 'F6U');
  assert.equal(uf238.canonicalFormula, 'F6U');
  assert.notEqual(uf235.canonicalIsotopologue, uf238.canonicalIsotopologue);
  assert.ok(
    Math.abs((uf238.molarMassKgPerMol - uf235.molarMassKgPerMol) * 1000 - 3.0) < 0.08,
    '238UF6 - 235UF6 molar mass diff should be ~3 g/mol'
  );

  assert.equal(co60.canonicalIsotopologue, co60Lead.canonicalIsotopologue);
  assert.equal(co60.sites[0].Z, 27);
  assert.equal(co60.sites[0].A, 60);
  assert.equal(c14o2.sites.find((s) => s.Z === 6).A, 14);
  assert.equal(he3.sites[0].Z, 2);
  assert.equal(he3.sites[0].A, 3);
});

test('Priority 1: nuclearCherenkovClosure resolves arbitrary Gate 1 (Z, A) decay channels and multi-step chains', () => {
  // Preserved Phase-8 reference isotopes
  const co60 = resolveNuclearDecayChannel('Co-60');
  assert.equal(co60.Z, 27);
  assert.equal(co60.A, 60);
  assert.equal(co60.daughterIsotope, 'Ni-60');

  // Arbitrary nuclide outside the old 4-isotope hardcoded table: Po-210 (Z=84, A=210), Na-24 (Z=11, A=24), F-18 (Z=9, A=18)
  const po210 = resolveNuclearDecayChannel(84, 210);
  assert.equal(po210.Z, 84);
  assert.equal(po210.A, 210);
  assert.equal(po210.mode, 'alpha');
  assert.equal(po210.daughterIsotope, 'Pb-206');
  assert.ok(po210.halfLifeS > 0 && Number.isFinite(po210.halfLifeS));
  assert.ok(po210.qValueMeV > 0);

  const na24 = resolveNuclearDecayChannel('Na-24');
  assert.equal(na24.Z, 11);
  assert.equal(na24.A, 24);
  assert.equal(na24.mode, 'beta-minus');
  assert.equal(na24.daughterIsotope, 'Mg-24');

  const u238Chain = deriveNuclearDecayChain(92, 238, { maxDepth: 20 });
  assert.ok(u238Chain.steps.length >= 2, 'U-238 must have a multi-step decay chain');
  assert.ok(u238Chain.totalEnergyMeV > 4.0);

  // Bateman inventory ledger accepts arbitrary non-hardcoded nuclides (e.g. Na-24 & Ra-226)
  const step = stepIsotopeInventoryLedger([
    { isotope: 'Na-24', atomCount: 1e15 },
    { isotope: 'Ra-226', atomCount: 1e18 }
  ], 3600);
  assert.ok(step.totalDecays > 0, 'Arbitrary (Z, A) nuclides must decay in Bateman ledger');
  assert.ok(step.thermalPowerW > 0);
  assert.ok(step.nucleonConservationRelError < 1e-12, 'Exact nucleon conservation must hold');
  const mg24 = step.nextInventory.find((e) => e.isotope === 'Mg-24');
  assert.ok(mg24 && mg24.atomCount > 0, 'Daughter Mg-24 must accumulate from Na-24 beta-minus decay');
});

test('Priority 1: materialPolytopeRegistry supports distinct canonical (Z/formula, A) isotope keys without colliding', () => {
  assert.equal(canonicalMaterialIsotopeKey('Fe'), 'fe');
  assert.equal(canonicalMaterialIsotopeKey('Fe', 56), 'fe-56');
  assert.equal(canonicalMaterialIsotopeKey('Fe-56', 56), 'fe-56');
  assert.equal(canonicalMaterialIsotopeKey('D2O'), 'd2o');

  const reg = createMaterialPolytopeRegistry();
  reg.discoverMaterialPolytopes({
    materialKey: 'U',
    massNumberA: 235,
    meltingPointK: 1405,
    boilingPointK: 4404,
    closureHash: 'u235-v1'
  });
  reg.discoverMaterialPolytopes({
    materialKey: 'U',
    massNumberA: 238,
    meltingPointK: 1408,
    boilingPointK: 4409,
    closureHash: 'u238-v1'
  });
  const q235 = reg.resolveState('U', { massNumberA: 235, temperatureK: 1406, pressurePa: 101325 });
  const q238 = reg.resolveState('U', { massNumberA: 238, temperatureK: 1406, pressurePa: 101325 });
  assert.equal(q235.found, true);
  assert.equal(q238.found, true);
  assert.equal(q235.polytope.phase, 'liquid');
  assert.equal(q238.polytope.phase, 'solid');
  assert.notEqual(q235.polytope.polytopeId, q238.polytope.polytopeId);
});
