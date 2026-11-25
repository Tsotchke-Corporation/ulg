import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  ORGANIC_MOLECULAR_GRAPH_LAW_ADAPTER,
  ORGANIC_MOLECULE_INITIAL_CONDITIONS,
  buildOrganicMolecularGraph,
  mirrorOrganicMolecularGraph,
  solvePiMolecularOrbitalsAnalytic,
  solveQeqCharges
} from '../src/runtime/organic/organicMolecularGraphGpu.js';
import {
  REACTIVE_BOND_ORDER_MD_LAW_ADAPTER
} from '../src/runtime/organic/reactiveBondOrderMdGpu.js';
import {
  ACID_BASE_CATALYSIS_LAW_ADAPTER,
  evaluateAcidBaseEquilibrium
} from '../src/runtime/organic/acidBaseCatalysisGpu.js';
import {
  FUNDAMENTAL_LAW_FAMILIES,
  UNIVERSAL_LAW_GRAPH_NODES,
  resolveActiveUniversalLaws,
  validateUniversalLawGraphContracts
} from '../src/runtime/universalLawGraph.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('Organic Chemistry Law Nodes #17-19 validate against Law Adapter Contract with 0 debt and 0 @workgroup_size(1)', () => {
  const check = validateUniversalLawGraphContracts();
  assert.equal(check.valid, true, `Contract errors: ${check.errors.join(', ')} debt: ${check.debt.join(', ')}`);
  assert.equal(check.debt.length, 0);
  assert.equal(UNIVERSAL_LAW_GRAPH_NODES.length, 24);
  assert.equal(FUNDAMENTAL_LAW_FAMILIES.CHEMICAL_BONDING, 'chemical-bonding');

  assert.equal(ORGANIC_MOLECULAR_GRAPH_LAW_ADAPTER.id, 'organic-molecular-graph-hybridization');
  assert.equal(REACTIVE_BOND_ORDER_MD_LAW_ADAPTER.id, 'reactive-bond-order-md');
  assert.equal(ACID_BASE_CATALYSIS_LAW_ADAPTER.id, 'acid-base-catalysis-kinetics');

  for (const rel of [
    'src/runtime/organic/organicMolecularGraphGpu.js',
    'src/runtime/organic/reactiveBondOrderMdGpu.js',
    'src/runtime/organic/acidBaseCatalysisGpu.js'
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.equal(src.includes('@workgroup_size(1)'), false, `${rel} must not contain @workgroup_size(1)`);
    assert.equal(src.includes('phase_mode'), false, `${rel} must not contain phase_mode hacks`);
  }
});

test('Huckel 4n+2 Aromaticity emerges strictly from pi-eigenproblem: Benzene aromatic vs Cyclobutadiene anti-aromatic vs Naphthalene red-shifted', () => {
  const benzene = buildOrganicMolecularGraph('benzene');
  const piBenz = solvePiMolecularOrbitalsAnalytic(benzene);
  assert.equal(benzene.formula, 'C6H6');
  assert.equal(piBenz.piAtomCount, 6);
  assert.equal(piBenz.totalPiElectrons, 6);
  assert.equal(piBenz.isAromatic4nPlus2, true, 'Benzene (6 pi electrons) must be detected as 4n+2 aromatic');
  assert.ok(piBenz.resonanceEnergyEv < -3.0, `Benzene must show strong aromatic stabilization (got ${piBenz.resonanceEnergyEv} eV)`);
  assert.ok(piBenz.homoLumoGapEv > 4.0, `Benzene must have large closed-shell HOMO-LUMO gap (got ${piBenz.homoLumoGapEv} eV)`);

  // Cyclobutadiene (4n = 4 pi electrons): exact degenerate non-bonding diradical -> 0 gap & 0 resonance stabilization!
  const cbd = buildOrganicMolecularGraph('cyclobutadiene');
  const piCbd = solvePiMolecularOrbitalsAnalytic(cbd);
  assert.equal(cbd.formula, 'C4H4');
  assert.equal(piCbd.totalPiElectrons, 4);
  assert.equal(piCbd.isAromatic4nPlus2, false, 'Cyclobutadiene (4 pi electrons) MUST NOT be aromatic');
  assert.ok(Math.abs(piCbd.resonanceEnergyEv) < 0.15, `Cyclobutadiene resonance energy expected ~0 (got ${piCbd.resonanceEnergyEv} eV)`);
  assert.ok(piCbd.homoLumoGapEv < 0.05, `Cyclobutadiene must exhibit degenerate diradical zero gap (got ${piCbd.homoLumoGapEv} eV)`);

  // Naphthalene (10 pi electrons): aromatic with narrower HOMO-LUMO gap (red-shifted UV-Vis lambda_max) than Benzene!
  const naph = buildOrganicMolecularGraph('naphthalene');
  const piNaph = solvePiMolecularOrbitalsAnalytic(naph);
  assert.equal(piNaph.isAromatic4nPlus2, true, 'Naphthalene (10 pi electrons) must be aromatic');
  assert.ok(piNaph.homoLumoGapEv < piBenz.homoLumoGapEv, 'Larger conjugated ring must narrow HOMO-LUMO gap');
  assert.ok(piNaph.uvVisLambdaMaxNm > piBenz.uvVisLambdaMaxNm, 'Naphthalene UV-Vis absorption must be red-shifted vs Benzene');

  // 1,3-Butadiene: linear conjugated polyene (partial central C2-C3 pi bond order, non-aromatic!)
  const buta = buildOrganicMolecularGraph('butadiene');
  const piButa = solvePiMolecularOrbitalsAnalytic(buta);
  assert.equal(piButa.isAromatic4nPlus2, false);
  assert.ok(piButa.coulsonBondOrders.get('1:2') > 0.35, 'Central C2-C3 bond must acquire partial double-bond character');
});

test('3D CIP Chirality & Mirror Invariance: L-Alanine vs D-Alanine flip R<->S with identical dipole & charge conservation', () => {
  const lAla = buildOrganicMolecularGraph('l-alanine');
  const dAla = buildOrganicMolecularGraph('d-alanine');
  const lMirrored = mirrorOrganicMolecularGraph(lAla);

  assert.equal(lAla.formula, 'C3H7NO2');
  assert.equal(lAla.chiralCenters.length, 1, 'Alanine must identify exactly 1 stereogenic sp3 carbon');
  assert.equal(dAla.chiralCenters.length, 1);
  assert.equal(lMirrored.chiralCenters.length, 1);
  assert.notEqual(lAla.chiralCenters[0].configuration, dAla.chiralCenters[0].configuration, 'L and D alanine must have opposite R/S configurations');
  assert.notEqual(lAla.chiralCenters[0].configuration, lMirrored.chiralCenters[0].configuration, 'Exact mirror reflection must invert R<->S');
  assert.equal(lMirrored.chiralCenters[0].configuration, dAla.chiralCenters[0].configuration);

  const qL = solveQeqCharges(lAla, { dielectricEr: 78.4 });
  const qM = solveQeqCharges(lMirrored, { dielectricEr: 78.4 });
  const sumQ = qL.charges.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sumQ) < 1e-5, `Total charge must be conserved (got ${sumQ})`);
  assert.ok(Math.abs(qL.dipoleDebye - qM.dipoleDebye) < 1e-5, 'Mirror reflection must preserve dipole magnitude exactly');

  // Achiral molecules must report 0 chiral centers
  assert.equal(buildOrganicMolecularGraph('ethanol').chiralCenters.length, 0);
  assert.equal(buildOrganicMolecularGraph('benzene').chiralCenters.length, 0);
});

test('Constitutional Isomers (Ethanol vs Dimethyl Ether) & First-Principles Bronsted-Lowry pKa + Born Dielectric Shift', () => {
  const eth = buildOrganicMolecularGraph('ethanol');
  const dme = buildOrganicMolecularGraph('dimethyl-ether');
  const acid = buildOrganicMolecularGraph('acetic-acid');

  // Same formula C2H6O, completely different functional groups & properties!
  assert.equal(eth.formula, dme.formula);
  assert.equal(eth.formula, 'C2H6O');

  const abEth = evaluateAcidBaseEquilibrium(eth, { pH: 7.0, dielectricEr: 78.4 });
  const abDme = evaluateAcidBaseEquilibrium(dme, { pH: 7.0, dielectricEr: 78.4 });
  const abAcidWater = evaluateAcidBaseEquilibrium(acid, { pH: 7.0, dielectricEr: 78.4 });
  const abAcidVac = evaluateAcidBaseEquilibrium(acid, { pH: 7.0, dielectricEr: 2.0 });

  assert.equal(abEth.sites.length, 1, 'Ethanol has 1 protic O-H acid site');
  assert.equal(abDme.sites.length, 0, 'Dimethyl ether has 0 protic O-H acid sites');
  assert.equal(abAcidWater.sites.length, 1, 'Acetic acid has 1 carboxylic O-H acid site');

  // Carboxylate resonance stabilization must dramatically lower acetic acid pKa relative to ethanol!
  const pKaEth = abEth.sites[0].pKa;
  const pKaAcidWater = abAcidWater.sites[0].pKa;
  const pKaAcidVac = abAcidVac.sites[0].pKa;
  assert.ok(pKaEth > 12.0 && pKaEth < 18.0, `Ethanol pKa expected ~15 (got ${pKaEth})`);
  assert.ok(pKaAcidWater > 2.5 && pKaAcidWater < 7.0, `Acetic acid aqueous pKa expected ~4.7 (got ${pKaAcidWater})`);
  assert.ok(pKaEth - pKaAcidWater > 7.0, 'Carboxylate pi-resonance must lower pKa by > 7 units');

  // Born dielectric solvation: lowering epsilon_r penalizes ionic dissociation -> raises acid pKa!
  assert.ok(pKaAcidVac > pKaAcidWater + 5.0, `Lower dielectric epsilon_r=2 must raise acid pKa (${pKaAcidVac} vs ${pKaAcidWater})`);

  // At pH 7.0 in water, acetic acid is largely deprotonated (netCharge ~ -1), while at pH 1.0 it is neutral (~0)!
  const abAcidLowPh = evaluateAcidBaseEquilibrium(acid, { pH: 1.0, dielectricEr: 78.4 });
  assert.ok(abAcidWater.netChargeAtPh < -0.8, `Acetic acid at pH 7 should be anionic (got ${abAcidWater.netChargeAtPh})`);
  assert.ok(Math.abs(abAcidLowPh.netChargeAtPh) < 0.05, `Acetic acid at pH 1 should be neutral (got ${abAcidLowPh.netChargeAtPh})`);

  // All 15 molecular graph ICs build cleanly with finite coordinates and non-empty bonds
  for (const id of Object.keys(ORGANIC_MOLECULE_INITIAL_CONDITIONS)) {
    const g = buildOrganicMolecularGraph(id);
    assert.ok(g.atomCount >= 6, `${id} must have atoms`);
    assert.ok(g.bondCount >= 4, `${id} must have bonds`);
  }
});

test('Universal Law Graph dynamically activates Organic Chemistry laws only when organic molecules are present', () => {
  const vacuumRes = resolveActiveUniversalLaws({});
  assert.equal(vacuumRes.active.some((l) => l.id === 'organic-molecular-graph-hybridization'), false);
  assert.equal(vacuumRes.active.some((l) => l.id === 'reactive-bond-order-md'), false);
  assert.equal(vacuumRes.active.some((l) => l.id === 'acid-base-catalysis-kinetics'), false);

  const orgRes = resolveActiveUniversalLaws({
    organicChemistryActive: true,
    organicAtomCount: 12,
    covalentBondCount: 12,
    dielectricEr: 78.4
  });
  assert.equal(orgRes.active.some((l) => l.id === 'organic-molecular-graph-hybridization'), true);
  assert.equal(orgRes.active.some((l) => l.id === 'reactive-bond-order-md'), true);
  assert.equal(orgRes.active.some((l) => l.id === 'acid-base-catalysis-kinetics'), true);
  assert.equal(orgRes.activeFamilies.includes(FUNDAMENTAL_LAW_FAMILIES.CHEMICAL_BONDING), true);
});
