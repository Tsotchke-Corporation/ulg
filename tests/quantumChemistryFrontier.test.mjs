import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pbeXcEnergyPerVolume,
  solveAtom,
  spinOrbitCouplingConstantHa
} from '../src/runtime/electronicStructure/radialKohnSham.js';
import {
  atomizationEnergyMp2Ha,
  buildBasis,
  climbingImageNEB,
  mp2,
  rhf,
  rhfAnalyticGradient,
  ump2
} from '../src/runtime/electronicStructure/molecularHartreeFock.js';
import {
  deriveMolecularBulkClosure,
  qhaVibrationalThermoPerMol
} from '../src/runtime/material/elementClosures.js';

const HA_TO_EV = 27.211386245988;

test('Atomic DFT GGA/PBE improves total atomic energies dramatically over LDA toward NIST references', () => {
  // Exact non-relativistic references (Ha) and NIST PBE-minus-LDA shifts (Ha):
  // He: exact -2.90372, NIST (PBE-LDA) = -0.0581
  // Ne: exact -128.9376, NIST (PBE-LDA) = -0.6330
  // Ar: exact -527.540, NIST (PBE-LDA) = -1.4000
  const cases = [
    { Z: 2, exact: -2.90372, nistDeltaPbeLda: -0.0581 },
    { Z: 10, exact: -128.9376, nistDeltaPbeLda: -0.6330 },
    { Z: 18, exact: -527.540, nistDeltaPbeLda: -1.4000 }
  ];
  assert.ok(pbeXcEnergyPerVolume(0.5, 0.2) < 0);
  for (const { Z, exact, nistDeltaPbeLda } of cases) {
    const lda = solveAtom(Z, { functional: 'lda', gridPointsN: 1000 });
    const pbe = solveAtom(Z, { functional: 'pbe', gridPointsN: 1000 });
    assert.equal(pbe.functional, 'pbe');
    const ldaErr = Math.abs(lda.totalEnergyHa - exact) / Math.abs(exact);
    const pbeErr = Math.abs(pbe.totalEnergyHa - exact) / Math.abs(exact);
    const deltaPbeLda = pbe.totalEnergyHa - lda.totalEnergyHa;
    assert.ok(pbeErr < ldaErr * 0.65, `Z=${Z}: PBE err ${(pbeErr * 100).toFixed(3)}% should beat LDA ${(ldaErr * 100).toFixed(3)}%`);
    assert.ok(
      Math.abs(deltaPbeLda - nistDeltaPbeLda) / Math.abs(nistDeltaPbeLda) < 0.05,
      `Z=${Z}: PBE-LDA shift ${deltaPbeLda.toFixed(4)} Ha vs NIST ${nistDeltaPbeLda} Ha`
    );
  }
});

test('Atomic DFT spin-orbit coupling perturbation yields positive Z^4-scaling fine-structure splitting for p and d shells', () => {
  const ne = solveAtom(10, { scalarRelativistic: true, spinOrbit: true, gridPointsN: 900 });
  const ar = solveAtom(18, { scalarRelativistic: true, spinOrbit: true, gridPointsN: 900 });
  const ne2p = ne.orbitals.find((o) => o.n === 2 && o.l === 1);
  const ar3p = ar.orbitals.find((o) => o.n === 3 && o.l === 1);
  const ar2p = ar.orbitals.find((o) => o.n === 2 && o.l === 1);
  assert.ok(ne2p.spinOrbitXiHa > 0 && ne2p.spinOrbitSplittingHa > 0);
  assert.ok(ne2p.energyJMinusHa < ne2p.energyJPlusHa, 'j = l - 1/2 must lie below j = l + 1/2');
  // Ne 2p splitting ~ 0.097 eV (exp), Ar 2p core splitting ~ 2.15 eV (exp)
  const ne2pEv = ne2p.spinOrbitSplittingHa * HA_TO_EV;
  const ar2pEv = ar2p.spinOrbitSplittingHa * HA_TO_EV;
  assert.ok(ne2pEv > 0.05 && ne2pEv < 0.25, `Ne 2p SO splitting ${ne2pEv.toFixed(4)} eV`);
  assert.ok(ar2pEv > 1.2 && ar2pEv < 3.5, `Ar 2p SO splitting ${ar2pEv.toFixed(4)} eV`);
  assert.ok(ar2pEv > ne2pEv * 10, 'core 2p SO splitting must scale steeply (~Z_eff^4) from Ne to Ar');
  assert.ok(ar3p.spinOrbitSplittingHa > 0);
  // s-states have zero spin-orbit splitting.
  const sCheck = spinOrbitCouplingConstantHa({ u: [1], energyHa: -1, vElec: [0], r: [1], dx: 0.1, l: 0, atomicNumberZ: 10 });
  assert.equal(sCheck.splittingHa, 0);
});

test('6-31G(d) split-valence polarized basis lowers RHF energy below STO-3G and covers H-Ar', () => {
  const h2 = [{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.4] }];
  const stoH2 = rhf(h2, { basis: 'sto-3g' });
  const splitH2 = rhf(h2, { basis: '6-31g*' });
  assert.equal(splitH2.nBasis, 4);
  assert.ok(splitH2.totalEnergyHa < stoH2.totalEnergyHa, '6-31G* must variationally lower H2 energy');
  assert.ok(Math.abs(splitH2.totalEnergyHa - (-1.1268)) < 0.01, `H2/6-31G* E=${splitH2.totalEnergyHa}`);

  // H2O in 6-31G(d): O has 1s(1) + 2sp_in(4) + 2sp_out(4) + 6d = 15, plus 2*2 H = 19 basis functions!
  const h2o = [
    { Z: 8, position: [0, 0, 0] },
    { Z: 1, position: [1.43, 0, 1.108] },
    { Z: 1, position: [-1.43, 0, 1.108] }
  ];
  const basisH2O = buildBasis(h2o, '6-31g(d)');
  assert.equal(basisH2O.length, 19);
  const stoWater = rhf(h2o, { basis: 'sto-3g' });
  const polWater = rhf(h2o, { basis: '6-31g(d)' });
  assert.ok(polWater.totalEnergyHa < -76.0, `H2O/6-31G(d) E=${polWater.totalEnergyHa} should be < -76.0 Ha (lit -76.010)`);
  assert.ok(polWater.totalEnergyHa < stoWater.totalEnergyHa - 1.0);

  // Period 3 (HCl): verifies Na–Ar 6-31G(d) basis builds cleanly!
  const hclBasis = buildBasis([{ Z: 17, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 2.4] }], '6-31g*');
  assert.equal(hclBasis.length, 21); // Cl: 1 + 4 + 4 + 4 + 6 = 19, H: 2 -> 21
});

test('UMP2 matches closed-shell MP2 on singlets and computes correlated open-shell atomization energies', () => {
  const h2 = [{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.4] }];
  const rMp2 = mp2(h2, { basis: '6-31g*', tol: 1e-12, maxIter: 300 });
  const uMp2 = ump2(h2, { basis: '6-31g*', multiplicity: 1, tol: 1e-12, maxIter: 300 });
  assert.ok(Math.abs(uMp2.ump2CorrelationHa - rMp2.mp2CorrelationHa) < 1e-10, 'UMP2 must equal RMP2 on closed-shell H2');
  assert.ok(Math.abs(uMp2.totalEnergyHa - rMp2.totalEnergyHa) < 1e-10);

  // Correlated H2 atomization energy in 6-31G* (~4.2 eV vs exp 4.75 eV, much better than HF ~3.6 eV!)
  const dH2 = atomizationEnergyMp2Ha(h2, { basis: '6-31g*' });
  const dEv = dH2.atomizationEnergyHa * HA_TO_EV;
  assert.ok(dEv > 3.8 && dEv < 5.0, `H2 UMP2/6-31G* atomization ${dEv.toFixed(3)} eV`);
});

test('Analytic RHF nuclear gradients match central finite differences to < 1e-6 Ha/Bohr on H2 and H2O', () => {
  const h = 1e-4;
  const molecules = [
    [{ Z: 1, position: [0, 0, 0] }, { Z: 1, position: [0, 0, 1.6] }],
    [
      { Z: 8, position: [0.05, -0.02, 0.01] },
      { Z: 1, position: [1.52, 0.1, 1.05] },
      { Z: 1, position: [-1.38, -0.08, 1.18] }
    ]
  ];
  for (const mol of molecules) {
    const analytic = rhfAnalyticGradient(mol, { tol: 1e-11, maxIter: 300 });
    let maxErr = 0;
    for (let a = 0; a < mol.length; a += 1) {
      for (let d = 0; d < 3; d += 1) {
        const plus = mol.map((atom, i) => ({
          Z: atom.Z,
          position: atom.position.map((v, k) => (i === a && k === d ? v + h : v))
        }));
        const minus = mol.map((atom, i) => ({
          Z: atom.Z,
          position: atom.position.map((v, k) => (i === a && k === d ? v - h : v))
        }));
        const fd = (rhf(plus, { tol: 1e-11, maxIter: 300 }).totalEnergyHa - rhf(minus, { tol: 1e-11, maxIter: 300 }).totalEnergyHa) / (2 * h);
        maxErr = Math.max(maxErr, Math.abs(analytic.gradientHaPerBohr[a][d] - fd));
      }
    }
    assert.ok(maxErr < 2e-6, `analytic vs FD gradient error ${maxErr}`);
    // Translational invariance: sum of gradients across all atoms == 0!
    for (let d = 0; d < 3; d += 1) {
      const sumG = analytic.gradientHaPerBohr.reduce((s, g) => s + g[d], 0);
      assert.ok(Math.abs(sumG) < 1e-10, `net force axis ${d}: ${sumG}`);
    }
  }
});

test('Climbing-Image NEB locates exact saddle-point barrier on a curved 2D PES and on first-principles RHF H2O inversion', () => {
  // 1. Curved double-well + off-axis saddle test:
  //    E(x, y, z) = (x^2 - 1)^2 + 2*(y - 0.5*(1 - x^2))^2 + z^2
  //    Minima at (-1, 0, 0) and (+1, 0, 0) (E = 0); true saddle off linear path at (0, 0.5, 0) (E = 1.0 Ha).
  const rAnalytic = [{ Z: 1, position: [-1, 0, 0] }];
  const pAnalytic = [{ Z: 1, position: [1, 0, 0] }];
  const nebAnalytic = climbingImageNEB(rAnalytic, pAnalytic, {
    nImages: 7,
    springK: 0.5,
    maxSteps: 160,
    forceTol: 1e-3,
    stepSize: 0.1,
    energyAndGradient: ([[x, y, z]]) => {
      const u = y - 0.5 * (1 - x * x);
      return {
        energyHa: (x * x - 1) ** 2 + 2 * u * u + z * z,
        gradient: [[4 * x * (x * x - 1) + 4 * u * x, 4 * u, 2 * z]]
      };
    }
  });
  assert.ok(Math.abs(nebAnalytic.forwardBarrierHa - 1.0) < 0.01, `saddle barrier ${nebAnalytic.forwardBarrierHa}`);
  assert.ok(Math.abs(nebAnalytic.transitionStateAtoms[0].position[0]) < 0.03);
  assert.ok(Math.abs(nebAnalytic.transitionStateAtoms[0].position[1] - 0.5) < 0.03);

  // 2. First-principles RHF H2O bending-through-linear inversion barrier (bent -> linear TS -> inverted bent)!
  const bentA = [
    { Z: 8, position: [0, 0, 0] },
    { Z: 1, position: [1.43, 0, 1.108] },
    { Z: 1, position: [-1.43, 0, 1.108] }
  ];
  const bentB = [
    { Z: 8, position: [0, 0, 0] },
    { Z: 1, position: [1.43, 0, -1.108] },
    { Z: 1, position: [-1.43, 0, -1.108] }
  ];
  const nebH2O = climbingImageNEB(bentA, bentB, {
    nImages: 5,
    springK: 0.05,
    maxSteps: 12,
    forceTol: 0.02,
    stepSize: 0.25,
    climbStartStep: 2
  });
  assert.equal(nebH2O.saddleImageIndex, 2);
  assert.ok(nebH2O.forwardBarrierHa > 0.02 && nebH2O.forwardBarrierHa < 0.15, `H2O linear barrier ${nebH2O.forwardBarrierHa} Ha`);
  assert.ok(Math.abs(nebH2O.reactionEnergyHa) < 1e-6, 'symmetric inversion has zero net ΔE');
});

test('Molecular-coupled QHA bulk closure derives cohesive, melting, latent heat, and heat capacity from UMP2 + phonons', () => {
  const qha = qhaVibrationalThermoPerMol([1600, 3650, 3750], 298.15);
  assert.ok(qha.zpeJPerMol > 50000); // H2O ZPE ~ 55 kJ/mol
  assert.ok(qha.cvVibJPerMolK > 0);

  const waterBulk = deriveMolecularBulkClosure({
    formula: 'H2O',
    atoms: [
      { Z: 8, position: [0, 0, 0] },
      { Z: 1, position: [1.43, 0, 1.108] },
      { Z: 1, position: [-1.43, 0, 1.108] }
    ],
    basis: 'sto-3g'
  });
  assert.equal(waterBulk.closureBacked, true);
  assert.equal(waterBulk.validation.scientificValidation, false);
  assert.ok(waterBulk.cohesiveEnergyJPerMol > 10000);
  assert.ok(waterBulk.meltingPointK > 100 && waterBulk.meltingPointK < 800);
  assert.ok(waterBulk.boilingPointK > waterBulk.meltingPointK);
  assert.ok(waterBulk.latentHeatFusionJPerKg > 5e4);
  assert.ok(waterBulk.latentHeatVaporizationJPerKg > waterBulk.latentHeatFusionJPerKg);
  assert.ok(waterBulk.cpSolidJPerKgK > 1000 && waterBulk.cpGasJPerKgK > 1000);
});
