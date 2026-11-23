import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGate1StellarNuclearNetwork,
  solveLaneEmdenPolytrope
} from '../src/runtime/astrophysics/stellarNucleosynthesisBridge.js';
import {
  solvePlanetaryInteriorFromBundles
} from '../src/runtime/astrophysics/planetaryStructureGpu.js';
import {
  evaluateIsmRadiativeCoolingErgCm3PerS
} from '../src/runtime/astrophysics/galacticIsmCoolingGpu.js';
import {
  createDistributedSpatialPartitioner
} from '../src/services/distributedSpatialPartitioner.js';
import {
  ULG_ACCURACY_TIERS,
  createMaterialPropertyBundle
} from '../ulg-gpu-abi/src/index.js';

test('Gate 5B: Stellar nuclear network derives exact Q-values from Gate 1 binding energies & RK4 Lane-Emden matches analytical n=1.5 and n=3.0', () => {
  const net = buildGate1StellarNuclearNetwork();
  const byId = Object.fromEntries(net.channels.map((c) => [c.id, c]));
  assert.ok(byId['pp-chain'].qValueMeV > 25 && byId['pp-chain'].qValueMeV < 30, `pp Q=${byId['pp-chain'].qValueMeV}`);
  assert.ok(byId['triple-alpha'].exothermic, 'triple-alpha exothermic');
  assert.ok(byId['si28-to-fe56'].exothermic, 'Si-28 -> Fe-56 exothermic');
  assert.equal(byId['fe56-photodisintegration'].exothermic, false, 'Fe-56 photodisintegration is strongly endothermic (triggers core collapse!)');

  // Exact Lane-Emden polytrope invariants (Chandrasekhar 1939):
  //   n=1.5: xi1 = 3.65375, -xi1^2 theta'(xi1) = 2.71406, rho_c/rho_bar = 5.9907
  //   n=3.0: xi1 = 6.89685, -xi1^2 theta'(xi1) = 2.01824, rho_c/rho_bar = 54.1825
  const le15 = solveLaneEmdenPolytrope(1.5, { dXi: 0.002 });
  assert.ok(Math.abs(le15.xi1 - 3.65375) < 0.01, `n=1.5 xi1=${le15.xi1}`);
  assert.ok(Math.abs(le15.massIntegral - 2.71406) < 0.01, `n=1.5 M=${le15.massIntegral}`);
  assert.ok(Math.abs(le15.centralToMeanDensityRatio - 5.9907) < 0.05, `n=1.5 rho ratio=${le15.centralToMeanDensityRatio}`);

  const le30 = solveLaneEmdenPolytrope(3.0, { dXi: 0.002 });
  assert.ok(Math.abs(le30.xi1 - 6.89685) < 0.02, `n=3.0 xi1=${le30.xi1}`);
  assert.ok(Math.abs(le30.massIntegral - 2.01824) < 0.01, `n=3.0 M=${le30.massIntegral}`);
  assert.ok(Math.abs(le30.centralToMeanDensityRatio - 54.1825) < 0.35, `n=3.0 rho ratio=${le30.centralToMeanDensityRatio}`);
});

test('Gate 5A: Polytope-Atlas planetary interior integrator derives realistic terrestrial planet mass, radius, moment of inertia, and dynamo capability', () => {
  const feBundle = createMaterialPropertyBundle({
    materialKey: 'Fe', symbol: 'Fe', atomicNumber: 26,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_1_QUANTITATIVE,
    nuclear: { Z: 26, A: 56, atomicMassU: 55.845 },
    atomic: { totalEnergyHa: -1262 },
    electromagnetic: { electricalConductivitySPerM: 1e6, magneticPhase: 'ferromagnetic' },
    mechanical: { crystalStructure: 'bcc', densityKgPerM3: 7874, bulkModulusPa: 170e9 },
    thermodynamic: { temperatureK: 300, thermalExpansionVolPerK: 3.5e-5, meltingPointK: 1811, boilingPointK: 3134 }
  });
  const mantleBundle = createMaterialPropertyBundle({
    materialKey: 'MgSiO3', formula: 'MgSiO3', family: 'compound',
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    nuclear: { totalProtonsZ: 50, totalNucleonsA: 100, molarMassU: 100.39 },
    atomic: { homoLumoGapEv: 7.5 },
    electromagnetic: { electricalConductivitySPerM: 1e-6, magneticPhase: 'diamagnetic' },
    mechanical: { crystalStructure: 'perovskite', densityKgPerM3: 3350, bulkModulusPa: 130e9 },
    thermodynamic: { temperatureK: 300, thermalExpansionVolPerK: 2.5e-5, meltingPointK: 1830, boilingPointK: 3200 }
  });

  const earthLike = solvePlanetaryInteriorFromBundles({
    centralPressurePa: 360e9,
    layers: [
      { name: 'iron-core', bundle: feBundle, phase: 'solid', massFractionTarget: 0.325, tempK: 5200 },
      { name: 'silicate-mantle', bundle: mantleBundle, phase: 'solid', massFractionTarget: 0.675, tempK: 2200 }
    ]
  });
  assert.ok(earthLike.radiusM > 4.5e6 && earthLike.radiusM < 8.5e6, `Earth-like R=${earthLike.radiusM}`);
  assert.ok(earthLike.totalMassKg > 2e24 && earthLike.totalMassKg < 1.5e25, `Earth-like M=${earthLike.totalMassKg}`);
  assert.ok(earthLike.moiFactor > 0.25 && earthLike.moiFactor < 0.40, `Differentiated core lowers MoI below 0.4: ${earthLike.moiFactor}`);
  assert.equal(earthLike.dynamoCapable, true);
});

test('Gate 5C & 5D: ISM atomic cooling peaks around H Ly-alpha & metal lines; Distributed Spatial Partitioner enforces G5 CAS leases and stale-epoch rejection', () => {
  const coolCold = evaluateIsmRadiativeCoolingErgCm3PerS(100, 1.0);
  const coolLyA = evaluateIsmRadiativeCoolingErgCm3PerS(20000, 1.0);
  const coolHot = evaluateIsmRadiativeCoolingErgCm3PerS(1e7, 1.0);
  assert.ok(coolLyA > coolCold * 100, 'H Ly-alpha peak dominates over cold ISM');
  assert.ok(coolHot > 0 && Number.isFinite(coolHot));

  const part = createDistributedSpatialPartitioner({ boxLength: 200, tileCount: 4 });
  try {
    const c0 = part.claimTile(0, 'peer-a');
    assert.equal(c0.claimed, true);
    // Single-winner G5 CAS lease: second peer cannot steal active tile 0 in same epoch
    const c0Dup = part.claimTile(0, 'peer-b');
    assert.equal(c0Dup.claimed, false);

    // Submit all 4 tiles -> global multipole COM matches exact analytic mass-weighted average
    for (let i = 0; i < 4; i += 1) {
      const sub = part.submitTileMultipoleSummary({
        tileIndex: i,
        peerId: `peer-${i}`,
        summaryEpoch: 1,
        totalMass: 100,
        com: [-75 + i * 50, 0, 0]
      });
      assert.equal(sub.accepted, true);
    }
    const glob = part.globalMultipoleSummary();
    assert.equal(glob.complete, true);
    assert.equal(glob.totalMass, 400);
    assert.ok(Math.abs(glob.com[0]) < 1e-6);

    // Epoch fence rejects stale epoch after advanceEpoch()
    const nextEp = part.advanceEpoch();
    assert.equal(nextEp, 2);
    const stale = part.submitTileMultipoleSummary({
      tileIndex: 0,
      peerId: 'peer-0',
      summaryEpoch: 1,
      totalMass: 100,
      com: [0, 0, 0]
    });
    assert.equal(stale.accepted, false);
    assert.equal(stale.reason, 'stale-epoch');
  } finally {
    part.destroy();
  }
});
