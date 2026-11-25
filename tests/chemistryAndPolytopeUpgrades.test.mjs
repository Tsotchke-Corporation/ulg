import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildValenceIntegrals,
  buildValenceSto3gAtomSpec,
  computeWibergBondOrders,
  rhf
} from '../src/runtime/electronicStructure/molecularHartreeFock.js';
import { registerMolecularRhfSimulationModule } from '../src/runtime/electronicStructure/molecularHartreeFockWebGpu.js';
import { discoverReactionCandidates } from '../src/runtime/chemistry/reactionCandidates.js';
import {
  buildReactionComplexGeometries,
  computeReactionThermodynamicsCurve,
  registerReactionPathwaySimulationModule
} from '../src/runtime/chemistry/reactionPathwayWebGpu.js';
import {
  buildEckartProjectionBasis,
  registerMolecularVibrationsSimulationModule
} from '../src/runtime/chemistry/molecularVibrationsWebGpu.js';
import {
  buildReactiveMdParams,
  registerReactiveChemistrySimulationModule
} from '../src/runtime/chemistry/reactiveChemistryMdWebGpu.js';
import {
  buildOrbital3dProfileTables,
  registerAtomTdks3dSimulationModule
} from '../src/runtime/electronicStructure/atomTdks3dWebGpu.js';
import { buildMultiSpeciesCrystalLattice } from '../src/runtime/material/recursiveCompoundPipeline.js';
import { buildIupacPeriodicTableEntries } from '../src/demos/periodicTableMetadata.js';
import {
  formatElementsLabPageTitle,
  parseElementsLabUrlState,
  serializeElementsLabUrlState
} from '../src/demos/elementsLabUrlState.js';
import { createSimulationModuleRegistry } from '../src/runtime/simulationModuleRegistry.js';

test('Slater-shielded valence STO-3G ECP spec covers ALL Z=1..118 with exact parity conservation', () => {
  for (let Z = 1; Z <= 118; Z += 1) {
    const spec = buildValenceSto3gAtomSpec(Z);
    assert.equal(spec.Z, Z);
    assert.ok(spec.zVal >= 1 && spec.zVal <= 8, `Z=${Z} zVal=${spec.zVal} out of [1,8]`);
    assert.equal((Z - spec.zVal) % 2, 0, `Z=${Z} parity broken: Z-zVal=${Z - spec.zVal}`);
    assert.ok(Array.isArray(spec.shells) && spec.shells.length >= 1);
    for (const sh of spec.shells) {
      assert.ok(sh.exps.every((e) => Number.isFinite(e) && e > 0), `Z=${Z} invalid exponents`);
    }
  }
});

test('Exact Wiberg bond orders classify single (H2O), double (CO2), triple (N2), and heavy Z>18 valence-STO3G molecules', () => {
  // 1. H2O (all-electron STO-3G): two O-H single bonds (~0.94)
  const h2o = rhf([
    { Z: 8, position: [0, 0, 0] },
    { Z: 1, position: [1.4304, 1.1072, 0] },
    { Z: 1, position: [-1.4304, 1.1072, 0] }
  ]);
  const h2oBonds = computeWibergBondOrders(h2o.P, h2o.S, h2o.basis, [
    { Z: 8, position: [0, 0, 0] },
    { Z: 1, position: [1.4304, 1.1072, 0] },
    { Z: 1, position: [-1.4304, 1.1072, 0] }
  ]);
  const ohBonds = h2oBonds.bonds.filter((b) => b.a === 0);
  assert.equal(ohBonds.length, 2);
  assert.ok(ohBonds.every((b) => b.kind === 'single' && b.order > 0.75 && b.order < 1.2), `H2O bonds: ${JSON.stringify(ohBonds)}`);

  // 2. CO2 (all-electron STO-3G): two C=O double bonds (~1.95)
  const co2Atoms = [
    { Z: 6, position: [0, 0, 0] },
    { Z: 8, position: [2.19, 0, 0] },
    { Z: 8, position: [-2.19, 0, 0] }
  ];
  const co2 = rhf(co2Atoms);
  const co2Bonds = computeWibergBondOrders(co2.P, co2.S, co2.basis, co2Atoms);
  const coPairs = co2Bonds.bonds.filter((b) => b.a === 0);
  assert.equal(coPairs.length, 2);
  assert.ok(coPairs.every((b) => b.kind === 'double' && b.order > 1.6), `CO2 bonds: ${JSON.stringify(coPairs)}`);

  // 3. N2 (all-electron STO-3G): one N≡N triple bond (~3.0)
  const n2Atoms = [
    { Z: 7, position: [0, 0, 0] },
    { Z: 7, position: [2.08, 0, 0] }
  ];
  const n2 = rhf(n2Atoms);
  const n2Bonds = computeWibergBondOrders(n2.P, n2.S, n2.basis, n2Atoms);
  assert.equal(n2Bonds.bonds.length, 1);
  assert.equal(n2Bonds.bonds[0].kind, 'triple');
  assert.ok(n2Bonds.bonds[0].order >= 2.45, `N2 bond order=${n2Bonds.bonds[0].order}`);

  // 4. Heavy Z > 18 molecules via valence-sto3g ECP: CsF (Z=55,9), FeO (Z=26,8), AuH (Z=79,1)
  for (const [label, atoms] of [
    ['CsF', [{ Z: 55, position: [0, 0, 0] }, { Z: 9, position: [4.4, 0, 0] }]],
    ['FeO', [{ Z: 26, position: [0, 0, 0] }, { Z: 8, position: [3.1, 0, 0] }]],
    ['AuH', [{ Z: 79, position: [0, 0, 0] }, { Z: 1, position: [2.9, 0, 0] }]]
  ]) {
    const integ = buildValenceIntegrals(atoms, 0);
    assert.equal(integ.nElectrons % 2, 0, `${label} closed-shell valence count`);
    const sol = rhf(atoms, { basis: 'valence-sto3g', maxIter: 80 });
    assert.ok(Number.isFinite(sol.totalEnergyHa) && sol.totalEnergyHa < 0, `${label} finite negative energy`);
    const w = computeWibergBondOrders(sol.P, sol.S, sol.basis, atoms);
    assert.ok(Number.isFinite(w.bondOrderMatrix[0][1]), `${label} finite Wiberg bond order`);
  }
});

test('Expanded general reaction families discover acid-base, combustion, thermite redox, metal-acid, and Haber-Bosch stoichiometries', () => {
  const cases = [
    ['HCl', 'NaOH', 'acid-base-neutralization', 'HCl + NaOH -> NaCl + H2O'],
    ['HCl', 'NH3', 'acid-base-neutralization', 'HCl + NH3 -> NH4Cl'],
    ['H2SO4', 'NaOH', 'acid-base-neutralization', 'H2SO4 + 2 NaOH -> Na2SO4 + 2 H2O'],
    ['CH4', 'O2', 'fuel-and-hydrocarbon-combustion', 'CH4 + 2 O2 -> CO2 + 2 H2O'],
    ['CO', 'O2', 'fuel-and-hydrocarbon-combustion', '2 CO + O2 -> 2 CO2'],
    ['Al', 'Fe2O3', 'metal-oxide-redox-displacement', '2 Al + Fe2O3 -> Al2O3 + 2 Fe'],
    ['CuO', 'H2', 'metal-oxide-redox-displacement', 'H2 + CuO -> Cu + H2O'],
    ['Zn', 'HCl', 'metal-acid-displacement', 'Zn + 2 HCl -> ZnCl2 + H2'],
    ['H2', 'N2', 'binary-covalent-synthesis', '3 H2 + N2 -> 2 NH3']
  ];
  for (const [a, b, fam, eq] of cases) {
    const res = discoverReactionCandidates(a, b);
    const match = res.candidates.find((c) => c.familyId === fam);
    assert.ok(match, `Missing ${fam} candidate for ${a} + ${b}; got ${JSON.stringify(res.candidates.map((c) => c.equation))}`);
    assert.equal(match.equation, eq);
    assert.equal(match.atomBalance.balanced, true);
    assert.equal(match.scientificValidation, false);
  }
  // Noble metal Au must NOT displace H2 from HCl
  const auHcl = discoverReactionCandidates('Au', 'HCl');
  assert.equal(auHcl.candidates.filter((c) => c.familyId === 'metal-acid-displacement').length, 0);
});

test('buildReactionComplexGeometries assembles atom-conserved 3D encounter complexes for multi-molecule GPU CI-NEB', () => {
  for (const [a, b] of [['HCl', 'NaOH'], ['HCl', 'NH3'], ['Na', 'H2O'], ['Zn', 'HCl'], ['CuO', 'H2'], ['Al', 'Fe2O3'], ['CH4', 'O2']]) {
    const cand = discoverReactionCandidates(a, b).candidates[0];
    assert.ok(cand, `Candidate missing for ${a}+${b}`);
    const complex = buildReactionComplexGeometries(cand, { maxAtoms: 10 });
    assert.equal(complex.reactantAtoms.length, complex.productAtoms.length);
    assert.equal(complex.isClosedShell, true, `${cand.equation} must have even electron count`);
    for (let i = 0; i < complex.reactantAtoms.length; i += 1) {
      assert.equal(complex.reactantAtoms[i].Z, complex.productAtoms[i].Z, `Atom ${i} Z mismatch in ${cand.equation}`);
    }
  }
  const thermo = computeReactionThermodynamicsCurve(0.85, -1.5, { deltaSJPerMolK: -40 });
  assert.equal(thermo.spontaneousAt298K, true);
  assert.ok(thermo.deltaG298KjPerMol < 0);
  assert.ok(thermo.log10KRate[thermo.log10KRate.length - 1] > thermo.log10KRate[0]);
});

test('Multi-species 3D crystal lattice builder generates authentic distinct cation/anion cells across prototypes', () => {
  for (const [formula, proto] of [
    ['NaCl', 'rocksalt-B1'],
    ['CsCl', 'cscl-B2'],
    ['ZnS', 'zincblende-B3'],
    ['CaF2', 'fluorite-C1'],
    ['TiO2', 'rutile-C4'],
    ['Al2O3', 'corundum-D51']
  ]) {
    const cry = buildMultiSpeciesCrystalLattice(formula, { crystalStructure: proto, latticeConstantA: 5.4, cellsPerSide: 2 });
    assert.ok(cry.atomCount >= 16, `${formula} ${proto} atomCount=${cry.atomCount}`);
    assert.ok(cry.bondCount > 0, `${formula} ${proto} must have coordination bonds`);
    assert.equal(cry.speciesLegend.length, 2, `${formula} must distinguish 2 distinct species`);
    assert.ok(cry.speciesLegend[0].formalCharge > 0 && cry.speciesLegend[1].formalCharge < 0);
  }
});

test('Eckart projection projects exact 5 null modes for linear CO2 and 6 for nonlinear H2O', () => {
  const linBasis = buildEckartProjectionBasis([[0, 0, 0], [2.2, 0, 0], [-2.2, 0, 0]], [12, 16, 16]);
  assert.equal(linBasis.length, 5);
  const nonLinBasis = buildEckartProjectionBasis([[0, 0, 0], [1.43, 1.1, 0], [-1.43, 1.1, 0]], [16, 1, 1]);
  assert.equal(nonLinBasis.length, 6);
});

test('Authentic 18-column IUPAC Periodic Table metadata covers all 118 elements without collisions', () => {
  const entries = buildIupacPeriodicTableEntries();
  assert.equal(entries.length, 118);
  const occupied = new Set();
  for (const e of entries) {
    assert.ok(e.col >= 1 && e.col <= 18, `Z=${e.Z} col=${e.col}`);
    assert.ok(e.row >= 1 && e.row <= 9, `Z=${e.Z} row=${e.row}`);
    const k = `${e.row},${e.col}`;
    assert.equal(occupied.has(k), false, `Duplicate IUPAC cell at ${k} (Z=${e.Z})`);
    occupied.add(k);
  }
  assert.equal(entries[0].col, 1);  // H col 1
  assert.equal(entries[1].col, 18); // He col 18
  assert.equal(entries[56].row, 8); // La in Lanthanide row 8
  assert.equal(entries[88].row, 9); // Ac in Actinide row 9
});

test('All 5 new canonical chemistry & 3D Maxwell-KS modules register cleanly on SimulationModuleRegistry', () => {
  const reg = createSimulationModuleRegistry();
  registerMolecularRhfSimulationModule(reg);
  registerReactionPathwaySimulationModule(reg);
  registerMolecularVibrationsSimulationModule(reg);
  registerReactiveChemistrySimulationModule(reg);
  registerAtomTdks3dSimulationModule(reg);
  const keys = reg.listModules().map((m) => m.methodKey);
  for (const k of [
    'molecular-rhf-gpu@1',
    'molecular-reaction-path@1',
    'molecular-vibrations-gpu@1',
    'reactive-chemistry-md@1',
    'quantum-tdks-maxwell3d@1'
  ]) {
    assert.ok(keys.includes(k), `missing registered module ${k}`);
  }
  const rxP = buildReactiveMdParams({ forwardBarrierEv: 0.9, reactionEnthalpyEv: -1.4 });
  assert.ok(rxP.eaRevSim > rxP.eaFwdSim, 'exothermic reverse barrier must exceed forward barrier');

  const d2 = buildOrbital3dProfileTables({ Z: 79, n0: 5, l0: 2, n1: 6, l1: 3, m: 2 });
  const p0 = buildOrbital3dProfileTables({ Z: 79, n0: 2, l0: 1, n1: 3, l1: 0, m: 0 });
  assert.equal(d2.m, 2);
  assert.equal(p0.m, 0);
  // At polar equator (mu = 0, bin 128), d_{m=2} peaks (|Y| ~ 1) while p_{m=0} has a strict nodal plane (Y ~ 0)!
  const eqBin = 128;
  assert.ok(Math.abs(d2.polarTable[eqBin * 4 + 1]) > 0.9, '5d m=2 must peak on equatorial plane');
  assert.ok(Math.abs(p0.polarTable[eqBin * 4 + 1]) < 0.05, '2p m=0 must have equatorial nodal plane');
});

test('Shareable URL state encoder/decoder round-trips elements, isotopes, compounds, reactions, views, and camera', () => {
  // 1. Gold 3D Maxwell-KS 5d(m=2) circular 440nm deep link (with inferred tab from view + slow-mo speed!)
  const pTdks = parseElementsLabUrlState('?el=Au&view=tdks-atom&orb=d2&pol=circ&lam=440&speed=0.25&cam=0.85,0.45,3.05');
  assert.equal(pTdks.specimenKind, 'element');
  assert.equal(pTdks.Z, 79);
  assert.equal(pTdks.tab, 'crystal');
  assert.equal(pTdks.view, 'tdks-atom');
  assert.equal(pTdks.tdksOrbitalPreset, 'd2');
  assert.equal(pTdks.tdksPolMode, 2);
  assert.equal(pTdks.photonModeMono, true);
  assert.equal(pTdks.probeWavelengthNm, 440);
  assert.equal(pTdks.simSpeed, 0.25);
  assert.deepEqual(pTdks.camera, { yaw: 0.85, pitch: 0.45, dist: 3.05 });

  const qTdks = serializeElementsLabUrlState(pTdks, { includeCamera: true });
  assert.ok(qTdks.includes('el=Au') && qTdks.includes('tab=crystal') && qTdks.includes('view=tdks-atom') && qTdks.includes('orb=d2') && qTdks.includes('pol=circ') && qTdks.includes('lam=440') && qTdks.includes('speed=0.25') && qTdks.includes('cam='));

  // 2. Legacy ?z=27&a=60 isotope & ?el=U-235 shorthand
  const pCo = parseElementsLabUrlState('?z=27&a=60');
  assert.equal(pCo.Z, 27);
  assert.equal(pCo.A, 60);
  const pU = parseElementsLabUrlState('?el=U-235&view=fission&b2=0.72');
  assert.equal(pU.Z, 92);
  assert.equal(pU.A, 235);
  assert.equal(pU.tab, 'nuclear');
  assert.equal(pU.view, 'fission');
  assert.equal(pU.fissionBeta2, 0.72);
  assert.ok(serializeElementsLabUrlState(pU).includes('el=U&a=235&tab=nuclear&view=fission&b2=0.72'));

  // 3. Compound deep links (CO2 3D double bonds + H2O Planetary 3D Polytope)
  const pPoly = parseElementsLabUrlState('?compound=H2O&view=3d-surface&regime=planetary');
  assert.equal(pPoly.specimenKind, 'compound');
  assert.equal(pPoly.formula, 'H2O');
  assert.equal(pPoly.tab, 'polytope');
  assert.equal(pPoly.view, '3d-surface');
  assert.equal(pPoly.polytopeRegime, 'planetary');
  assert.equal(serializeElementsLabUrlState(pPoly), '?compound=H2O&tab=polytope&view=3d-surface&regime=planetary');

  // 4. Reaction deep links accept comma, pipe, or plus/space separators!
  for (const raw of ['?react=HCl,NaOH&view=reaction-path', '?react=HCl|NaOH&tab=compound&view=reaction-path', '?react=HCl+NaOH&view=reaction-path']) {
    const pRx = parseElementsLabUrlState(raw);
    assert.equal(pRx.specimenKind, 'reaction');
    assert.deepEqual(pRx.reactants, ['HCl', 'NaOH']);
    assert.equal(pRx.tab, 'compound');
    assert.equal(pRx.view, 'reaction-path');
  }
  assert.ok(formatElementsLabPageTitle({ specimenKind: 'reaction', reactants: ['HCl', 'NaOH'], tab: 'compound', view: 'reaction-path' }).includes('HCl + NaOH'));
});
