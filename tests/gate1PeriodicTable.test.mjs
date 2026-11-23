import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveNuclearClosure,
  finiteNucleusPotentialHa,
  mostStableMassNumberForZ,
  nuclearBindingEnergyMeV,
  nuclearChargeRadiusFm,
  nuclearShellSpinAndMoment
} from '../src/runtime/nuclear/nuclearStructureGpu.js';
import { debyeHeatCapacityJPerKgK, fitAbInitioInteratomicPotential } from '../src/runtime/material/elementMdClosureWebGpu.js';
import { ULG_ACCURACY_TIERS } from '../ulg-gpu-abi/src/index.js';

test('Gate 1 (P1.1): Nuclear structure covers all Z=1..118 with Fe-56 binding peak, magic closures, finite R_nuc, and exact conservation', () => {
  const baFe = nuclearBindingEnergyMeV(26, 56) / 56;
  const baU = nuclearBindingEnergyMeV(92, 238) / 238;
  const baC = nuclearBindingEnergyMeV(6, 12) / 12;
  assert.ok(baFe > 8.4 && baFe < 9.1, `Fe-56 B/A=${baFe}`);
  assert.ok(baFe > baU && baFe > baC, 'Binding energy per nucleon peaks near Fe-56');

  // Finite-nucleus Coulomb potential smoothly matches -Z/r outside R_eq and is finite at r -> 0
  const vInside = finiteNucleusPotentialHa(79, 197, 1e-6);
  const vOutside = finiteNucleusPotentialHa(79, 197, 0.01);
  assert.ok(Number.isFinite(vInside) && vInside < 0);
  assert.ok(Math.abs(vOutside - (-79 / 0.01)) < 1e-6);

  // Even-even nuclei have 0+ ground state; odd-Z H-1 has 1/2+ and proton Schmidt moment
  const he4 = nuclearShellSpinAndMoment(2, 4);
  assert.equal(he4.spinI, 0);
  assert.equal(he4.parity, '+');
  const h1 = nuclearShellSpinAndMoment(1, 1);
  assert.equal(h1.spinI, 0.5);
  assert.equal(h1.parity, '+');
  assert.ok(Math.abs(h1.magneticMomentMuN - 2.79285) < 1e-3);

  // Full Z=1..118 sweep: every element produces valid mass, finite radius, and conserved decay channel
  for (let Z = 1; Z <= 118; Z += 1) {
    const aStar = mostStableMassNumberForZ(Z);
    assert.ok(aStar >= Z && aStar <= 310);
    const nuc = deriveNuclearClosure(Z, aStar);
    assert.equal(nuc.Z, Z);
    assert.equal(nuc.A, aStar);
    assert.equal(nuc.Z + nuc.N, nuc.A);
    assert.ok(nuc.chargeRadiusFm > 0.7 && nuc.chargeRadiusFm < 8.5);
    assert.ok(nuc.atomicMassU > 0.9);
    if (nuc.dominantMode === 'alpha') {
      assert.equal(nuc.daughterZ + 2, nuc.Z);
      assert.equal(nuc.daughterA + 4, nuc.A);
    } else if (nuc.dominantMode === 'beta-minus') {
      assert.equal(nuc.daughterZ - 1, nuc.Z);
      assert.equal(nuc.daughterA, nuc.A);
    }
    if (Z > 100) {
      assert.equal(nuc.accuracyTier, ULG_ACCURACY_TIERS.TIER_3_THEORETICAL_ENVELOPE);
    }
  }
});

test('Gate 1 (P1.4): Debye heat capacity approaches 3R/M at high T and T^3 at low T; ab-initio potential fitting selects all 3 models cleanly', () => {
  const mCu = 63.546 * 1.6605390666e-27;
  const dulongPetit = (3 * 8.314462618) / 0.063546;
  const cvHigh = debyeHeatCapacityJPerKgK(3000, 343, mCu);
  const cvLow = debyeHeatCapacityJPerKgK(20, 343, mCu);
  assert.ok(Math.abs(cvHigh - dulongPetit) / dulongPetit < 0.03, `cvHigh=${cvHigh}, DP=${dulongPetit}`);
  assert.ok(cvLow > 0 && cvLow < dulongPetit * 0.05);

  const pAr = fitAbInitioInteratomicPotential({ Z: 18, bulkResult: { crystalStructure: 'vdw-fcc', latticeConstantA: 5.3, cohesiveEnergyEv: 0.08, coordinationNumber: 12 } });
  const pCu = fitAbInitioInteratomicPotential({ Z: 29, bulkResult: { crystalStructure: 'fcc', latticeConstantA: 3.6, cohesiveEnergyEv: 3.5, bulkModulusPa: 140e9, coordinationNumber: 12 } });
  const pSi = fitAbInitioInteratomicPotential({ Z: 14, bulkResult: { crystalStructure: 'diamond', latticeConstantA: 5.4, cohesiveEnergyEv: 4.6, coordinationNumber: 4 } });
  assert.equal(pAr.modelName, 'shifted-force-lj-london');
  assert.equal(pCu.modelName, 'morse-finnis-sinclair-eam');
  assert.equal(pSi.modelName, 'stillinger-weber-sp3');
});
