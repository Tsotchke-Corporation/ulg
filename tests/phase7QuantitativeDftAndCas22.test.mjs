import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CRYSTAL_STRUCTURES,
  G7_ADVISORY_BULK_REFERENCES,
  PERIODIC_BULK_DFT_SCHEMA,
  birchMurnaghanEnergyHa,
  compareBulkDftAgainstNistAdvisory,
  evaluatePeriodicCrystalPoint,
  fitBirchMurnaghanEos,
  generateMonkhorstPackGrid,
  generatePlaneWaveBasis,
  solvePeriodicBulkCrystalDft
} from '../src/runtime/electronicStructure/periodicBulkDft.js';
import {
  cas22,
  puhf,
  rhf,
  uhf
} from '../src/runtime/electronicStructure/molecularHartreeFock.js';

test('Monkhorst-Pack k-point grid preserves exact weight normalization and plane-wave cutoff ordering', () => {
  const fcc = CRYSTAL_STRUCTURES.fcc.primitiveVectors(7.6);
  // Build reciprocal lattice through a point solve check
  const pt = evaluatePeriodicCrystalPoint({ Z: 13, structure: 'fcc', aBohr: 7.65, mpGrid: [3, 3, 3], eCutHa: 5.5, maxPw: 21 });
  assert.ok(pt.nPlaneWaves >= 13 && pt.nPlaneWaves <= 21);
  assert.ok(pt.nKPointsFolded > 0 && pt.nKPointsFolded <= 27);
  assert.ok(Number.isFinite(pt.totalEnergyPerAtomHa));
  assert.ok(Number.isFinite(pt.fermiEnergyEv));

  const bUnit = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const mp = generateMonkhorstPackGrid(bUnit, [3, 3, 3]);
  const wSum = mp.reduce((s, p) => s + p.weight, 0);
  assert.ok(Math.abs(wSum - 1.0) < 1e-12, `Monkhorst-Pack weights must sum to 1, got ${wSum}`);
  const pw = generatePlaneWaveBasis(bUnit, { eCutHa: 3.0, maxPw: 27 });
  assert.equal(pw[0].g2, 0, 'G=0 plane wave must appear first');
  for (let i = 1; i < pw.length; i += 1) {
    assert.ok(pw[i].g2 >= pw[i - 1].g2, 'plane waves must be ordered by |G|^2');
  }
  void fcc;
});

test('fitBirchMurnaghanEos recovers exact synthetic V0, E0, B0, and B0Prime to machine precision', () => {
  const truth = { E0Ha: -2.45, V0Bohr3: 112.0, B0HaPerBohr3: 0.0028, B0Prime: 4.35 };
  const pts = [0.88, 0.92, 0.96, 1.0, 1.04, 1.08, 1.12].map((f) => {
    const V = truth.V0Bohr3 * f;
    return {
      volumePerAtomBohr3: V,
      totalEnergyPerAtomHa: birchMurnaghanEnergyHa(V, truth)
    };
  });
  const fit = fitBirchMurnaghanEos(pts);
  assert.ok(Math.abs(fit.V0Bohr3 - truth.V0Bohr3) < 1e-6, `V0 err: ${fit.V0Bohr3}`);
  assert.ok(Math.abs(fit.E0Ha - truth.E0Ha) < 1e-9, `E0 err: ${fit.E0Ha}`);
  assert.ok(Math.abs(fit.B0HaPerBohr3 - truth.B0HaPerBohr3) < 1e-8, `B0 err: ${fit.B0HaPerBohr3}`);
  assert.ok(Math.abs(fit.B0Prime - truth.B0Prime) < 1e-4, `B0Prime err: ${fit.B0Prime}`);
  assert.ok(fit.fitRmsHa < 1e-10);
});

test('solvePeriodicBulkCrystalDft derives equilibrium lattice, bulk modulus, and honest G7 advisory report across FCC/BCC/Diamond crystals', () => {
  const al = solvePeriodicBulkCrystalDft({ Z: 13, structure: 'fcc', mpGrid: [3, 3, 3], eCutHa: 5.5, maxPw: 21 });
  assert.equal(al.schema, PERIODIC_BULK_DFT_SCHEMA);
  assert.equal(al.closureBacked, true);
  assert.equal(al.validation.scientificValidation, false);
  assert.equal(al.validation.fullPhysicsValidation, false);
  assert.equal(al.validation.g7Advisory, true);
  assert.ok(al.eos.a0Angstrom > 3.2 && al.eos.a0Angstrom < 5.0, `Al a0 out of physical range: ${al.eos.a0Angstrom}`);
  assert.ok(al.eos.bulkModulusGPa > 25 && al.eos.bulkModulusGPa < 160, `Al B0 out of physical range: ${al.eos.bulkModulusGPa}`);
  assert.ok(al.eos.fitRmsHa < 1e-3, `BM3 EOS fit RMS too large: ${al.eos.fitRmsHa}`);

  const si = solvePeriodicBulkCrystalDft({ Z: 14, structure: 'diamond', mpGrid: [3, 3, 3], eCutHa: 5.5, maxPw: 21 });
  assert.ok(si.eos.a0Angstrom > 4.2 && si.eos.a0Angstrom < 6.8, `Si diamond a0 out of physical range: ${si.eos.a0Angstrom}`);
  assert.ok(si.eos.bulkModulusGPa > 35 && si.eos.bulkModulusGPa < 320, `Si B0 out of physical range: ${si.eos.bulkModulusGPa}`);

  const report = compareBulkDftAgainstNistAdvisory(['Na', 'Al', 'Si', 'Cu', 'Au']);
  assert.equal(report.count, 5);
  assert.equal(report.validation.scientificValidation, false);
  assert.equal(report.validation.g7Advisory, true);
  assert.ok(Number.isFinite(report.meanAbsLatticeRelError) && report.meanAbsLatticeRelError < 0.30,
    `expected physically grounded periodic bulk DFT lattice constants within 30% mean error, got ${(report.meanAbsLatticeRelError * 100).toFixed(1)}%`);
  for (const row of report.rows) {
    assert.ok(row.derived.a0Angstrom > 2.0 && row.derived.a0Angstrom < 7.0, `${row.symbol} a0=${row.derived.a0Angstrom}`);
    assert.ok(row.derived.bulkModulusGPa > 2 && row.derived.bulkModulusGPa < 500, `${row.symbol} B0=${row.derived.bulkModulusGPa}`);
    assert.ok(G7_ADVISORY_BULK_REFERENCES[row.symbol]);
  }
});

test('Phase 7 CAS(2,2) resolves H2 covalent dissociation smoothly with exact RHF identity and diradical natural occupations', () => {
  const h2Eq = [{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.4] }];
  const h2Stretch = [{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 8.0] }];
  const hAtomE = uhf([{ Z: 1, position: [0, 0, 0] }], { multiplicity: 2 }).totalEnergyHa;

  const eq = cas22(h2Eq, { tol: 1e-11 });
  assert.equal(eq.validation.scientificValidation, false);
  assert.ok(eq.h11RhfConsistencyErrorHa < 1e-9, `H11 must equal RHF energy: err=${eq.h11RhfConsistencyErrorHa}`);
  assert.ok(eq.totalEnergyHa < eq.rhfEnergyHa, 'CAS(2,2) must strictly lower energy below RHF');
  assert.ok(Math.abs(eq.naturalOccupations[0] + eq.naturalOccupations[1] - 2.0) < 1e-10);
  assert.ok(eq.naturalOccupations[0] > 1.9, `at equilibrium H2 should be closed-shell dominated: n1=${eq.naturalOccupations[0]}`);

  const st = cas22(h2Stretch);
  assert.ok(st.totalEnergyHa < st.rhfEnergyHa - 0.15,
    `CAS(2,2) must eliminate RHF ionic divergence at R=8 Bohr: CAS=${st.totalEnergyHa}, RHF=${st.rhfEnergyHa}`);
  assert.ok(Math.abs(st.totalEnergyHa - 2 * hAtomE) < 1e-3,
    `stretched H2 CAS(2,2) must converge to 2 * E(H): CAS=${st.totalEnergyHa}, 2*E(H)=${2 * hAtomE}`);
  assert.ok(Math.abs(st.naturalOccupations[0] - 1.0) < 0.05 && Math.abs(st.naturalOccupations[1] - 1.0) < 0.05,
    `stretched H2 must exhibit pure diradical natural occupations ~[1, 1], got ${st.naturalOccupations}`);
});

test('Phase 7 CAS(2,2) and Yamaguchi PUHF eliminate RHF dissociation pathology for F2 and N2', () => {
  // Stretched F2 single bond (R = 6.0 Bohr)
  const f2Stretch = [{ Z: 9, position: [0, 0, 0] }, { Z: 9, position: [0, 0, 6.0] }];
  const f2Cas = cas22(f2Stretch);
  const f2Puhf = puhf(f2Stretch, { highSpinMultiplicity: 3, brokenSymmetryPairs: 1 });
  assert.ok(f2Cas.totalEnergyHa < f2Cas.rhfEnergyHa - 0.05,
    `F2 stretched CAS(2,2) (${f2Cas.totalEnergyHa}) must beat RHF (${f2Cas.rhfEnergyHa})`);
  assert.ok(f2Cas.diradicalCharacter > 0.4, `stretched F2 must show strong diradical character: y0=${f2Cas.diradicalCharacter}`);
  assert.equal(f2Puhf.brokeSymmetry, true);
  assert.ok(f2Puhf.sSquaredBrokenSymmetry > 0.5, `BS-UHF F2 must break spin symmetry: <S^2>=${f2Puhf.sSquaredBrokenSymmetry}`);
  assert.ok(f2Puhf.totalEnergyHa < f2Puhf.rhfEnergyHa - 0.1,
    `F2 PUHF (${f2Puhf.totalEnergyHa}) must beat RHF (${f2Puhf.rhfEnergyHa})`);

  // Stretched N2 triple bond (R = 6.0 Bohr) with Yamaguchi septet-projected PUHF
  const n2Eq = [{ Z: 7, position: [0, 0, 0] }, { Z: 7, position: [0, 0, 2.1] }];
  const n2Stretch = [{ Z: 7, position: [0, 0, 0] }, { Z: 7, position: [0, 0, 6.0] }];
  const n2EqPuhf = puhf(n2Eq, { highSpinMultiplicity: 7, brokenSymmetryPairs: 3 });
  const n2StPuhf = puhf(n2Stretch, { highSpinMultiplicity: 7, brokenSymmetryPairs: 3 });
  const n2StCas = cas22(n2Stretch);
  assert.ok(n2StCas.totalEnergyHa < n2StCas.rhfEnergyHa - 0.05,
    `N2 stretched CAS(2,2) must lower energy below RHF`);
  assert.equal(n2StPuhf.brokeSymmetry, true, 'stretched N2 BS-UHF must break spin symmetry');
  assert.ok(n2StPuhf.totalEnergyHa < n2StPuhf.rhfEnergyHa - 0.25,
    `N2 stretched PUHF (${n2StPuhf.totalEnergyHa}) must dramatically lower RHF ionic divergence (${n2StPuhf.rhfEnergyHa})`);
  assert.ok(n2EqPuhf.totalEnergyHa < n2StPuhf.totalEnergyHa,
    `N2 equilibrium (${n2EqPuhf.totalEnergyHa}) must stay bound below stretched N2 (${n2StPuhf.totalEnergyHa})`);
  assert.equal(n2StPuhf.validation.scientificValidation, false);
});
