import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildGate1StellarNuclearNetwork,
  getGate1StellarBurnConstants,
  solveLaneEmdenPolytrope
} from '../src/runtime/astrophysics/stellarNucleosynthesisBridge.js';
import {
  solvePlanetaryInteriorFromBundles
} from '../src/runtime/astrophysics/planetaryStructureGpu.js';
import {
  evaluateIsmRadiativeCoolingErgCm3PerS
} from '../src/runtime/astrophysics/galacticIsmCoolingGpu.js';
import {
  createDistributedSpatialPartitioner,
  encodeTileMultipolePayload,
  decodeTileMultipolePayload
} from '../src/services/distributedSpatialPartitioner.js';
import {
  lookupFoundationPolytopeRecord
} from '../src/runtime/material/foundationPolytopeAtlasGpuBridge.js';
import {
  schroederScaleAtlasMultipoleWgsl
} from '../src/runtime/sph/schroederScaleAtlasMultipoleGpu.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('Gate 5B: Stellar nuclear network derives exact beta+/EC atomic-mass Q-values from Gate 1 binding energies & RK4 Lane-Emden matches n=1.5 and n=3.0', () => {
  const net = buildGate1StellarNuclearNetwork();
  const byId = net.byId;
  // Exact pp-chain atomic mass Q-value: 28.2957 + 2*(m_p + m_e - m_n) = 26.7310 MeV total, 26.2010 MeV thermal!
  assert.ok(byId['pp-chain'].qValueTotalMeV > 26.5 && byId['pp-chain'].qValueTotalMeV < 27.0,
    `pp total Q must include exact beta+/EC nucleon+electron mass shift (~26.73 MeV), got ${byId['pp-chain'].qValueTotalMeV}`);
  assert.ok(byId['pp-chain'].qValueThermalMeV > 26.0 && byId['pp-chain'].qValueThermalMeV < 26.4,
    `pp thermal Q after neutrino escape expected ~26.20 MeV, got ${byId['pp-chain'].qValueThermalMeV}`);
  assert.ok(byId['triple-alpha'].exothermic, 'triple-alpha exothermic');
  assert.ok(byId['si28-to-fe56'].exothermic, 'Si-28 -> Fe-56 exothermic');
  assert.equal(byId['fe56-photodisintegration'].exothermic, false, 'Fe-56 photodisintegration is strongly endothermic');

  const burn = getGate1StellarBurnConstants();
  assert.ok(burn.ppJPerKgH > 6.1e14 && burn.ppJPerKgH < 6.4e14, `pp J/kg=${burn.ppJPerKgH}`);
  assert.ok(burn.tripleAlphaJPerKgHe > 5.0e13 && burn.tripleAlphaJPerKgHe < 9.5e13, `3a J/kg=${burn.tripleAlphaJPerKgHe}`);

  // Static canonical Scale-Atlas unification check: ZERO @workgroup_size(1) in multipole WGSL and ZERO private octree in selfGravitatingHydroGpu.js
  assert.equal(schroederScaleAtlasMultipoleWgsl.includes('@workgroup_size(1)'), false);
  const sghSrc = fs.readFileSync(path.join(ROOT, 'src/runtime/sph/selfGravitatingHydroGpu.js'), 'utf8');
  assert.equal(sghSrc.includes('outer_tree'), false, 'selfGravitatingHydroGpu.js must have zero private outer_tree octree');
  assert.equal(sghSrc.includes('sgh_reduce_coarse'), false, 'selfGravitatingHydroGpu.js must have zero private octree coarse rollup');
  assert.ok(sghSrc.includes('createSchroederScaleAtlasGravitySolverWebGpu'), 'selfGravitatingHydroGpu.js must use canonical SchroederScaleAtlas gravity');

  // Exact Lane-Emden polytrope invariants (Chandrasekhar 1939)
  const le15 = solveLaneEmdenPolytrope(1.5, { dXi: 0.002 });
  assert.ok(Math.abs(le15.xi1 - 3.65375) < 0.01, `n=1.5 xi1=${le15.xi1}`);
  assert.ok(Math.abs(le15.massIntegral - 2.71406) < 0.01, `n=1.5 M=${le15.massIntegral}`);
  assert.ok(Math.abs(le15.centralToMeanDensityRatio - 5.9907) < 0.05, `n=1.5 rho ratio=${le15.centralToMeanDensityRatio}`);

  const le30 = solveLaneEmdenPolytrope(3.0, { dXi: 0.002 });
  assert.ok(Math.abs(le30.xi1 - 6.89685) < 0.02, `n=3.0 xi1=${le30.xi1}`);
  assert.ok(Math.abs(le30.massIntegral - 2.01824) < 0.01, `n=3.0 M=${le30.massIntegral}`);
  assert.ok(Math.abs(le30.centralToMeanDensityRatio - 54.1825) < 0.35, `n=3.0 rho ratio=${le30.centralToMeanDensityRatio}`);
});

test('Gate 5A: Real Gate 1-2 foundation-polytope-atlas Fe & Al2O3 bundles derive realistic terrestrial planet structure (host reference)', () => {
  const feRec = lookupFoundationPolytopeRecord('Fe');
  const oxideRec = lookupFoundationPolytopeRecord('Al2O3');
  assert.ok(feRec && oxideRec, 'Gate 1-2 foundation-polytope-atlas.json must provide real derived Fe and Al2O3 records');
  assert.equal(feRec.provenance?.status, 'webgpu-derived');
  assert.equal(oxideRec.provenance?.status, 'webgpu-derived');

  const earthLike = solvePlanetaryInteriorFromBundles({
    centralPressurePa: 360e9,
    layers: [
      { name: 'iron-core', bundle: feRec, phase: 'solid', massFractionTarget: 0.325, tempK: 5200 },
      { name: 'oxide-mantle', bundle: oxideRec, phase: 'solid', massFractionTarget: 0.675, tempK: 2200 }
    ]
  });
  assert.equal(earthLike.provenance.status, 'analytic-murnaghan-cpu-reference');
  assert.ok(earthLike.radiusM > 4.5e6 && earthLike.radiusM < 1.2e7, `Earth-like R=${earthLike.radiusM}`);
  assert.ok(earthLike.totalMassKg > 1.5e24 && earthLike.totalMassKg < 2.5e25, `Earth-like M=${earthLike.totalMassKg}`);
  assert.ok(earthLike.moiFactor > 0.20 && earthLike.moiFactor < 0.40, `Differentiated core lowers MoI below 0.4: ${earthLike.moiFactor}`);
  assert.equal(earthLike.dynamoCapable, true);
});

test('Gate 5C & 5D: ISM cooling peaks at Gate 1 H Ly-alpha; PeerCompute SpatialTileLeaseBroker strictly rejects unclaimed, wrong-owner, expired-TTL, and stale-epoch submissions', () => {
  const coolCold = evaluateIsmRadiativeCoolingErgCm3PerS(100, 1.0);
  const coolLyA = evaluateIsmRadiativeCoolingErgCm3PerS(20000, 1.0);
  const coolHot = evaluateIsmRadiativeCoolingErgCm3PerS(1e7, 1.0);
  assert.ok(coolLyA > coolCold * 100, 'H Ly-alpha peak dominates over cold ISM');
  assert.ok(coolHot > 0 && Number.isFinite(coolHot));

  // Verify binary multipole payload round-trip
  const packed = encodeTileMultipolePayload({ totalMass: 123.5, com: [-10, 4.5, 2.25], quadrupoleTrace: 88.25, particleCount: 500, scaleFactorA: 0.12, stepIndex: 4 });
  assert.equal(packed.byteLength, 32);
  const decoded = decodeTileMultipolePayload(packed);
  assert.ok(Math.abs(decoded.totalMass - 123.5) < 1e-4);
  assert.equal(decoded.particleCount, 500);

  let fakeNow = 10_000;
  const part = createDistributedSpatialPartitioner({
    boxLength: 200,
    tileCount: 4,
    leaseTtlMs: 1_000,
    now: () => fakeNow
  });
  try {
    // 1. Submitting an UNCLAIMED tile MUST FAIL CLOSED (`no-active-lease`)
    const unclaimed = part.submitTileMultipoleSummary({
      tileIndex: 0,
      peerId: 'rogue-peer',
      summaryEpoch: 1,
      totalMass: 100,
      com: [-75, 0, 0]
    });
    assert.equal(unclaimed.accepted, false);
    assert.equal(unclaimed.reason, 'no-active-lease');

    // 2. Single-winner CAS tile acquisition
    const claims = [];
    for (let i = 0; i < 4; i += 1) {
      const c = part.claimTile(i, `peer-${i}`);
      assert.equal(c.claimed, true);
      claims.push(c);
    }
    const c0Dup = part.claimTile(0, 'peer-stealer');
    assert.equal(c0Dup.claimed, false);
    assert.equal(c0Dup.reason, 'already-leased');

    // 3. Wrong-owner submission MUST FAIL CLOSED (`not-owner`)
    const wrongOwner = part.submitTileMultipoleSummary({
      tileIndex: 0,
      peerId: 'peer-1',
      summaryEpoch: 1,
      totalMass: 100,
      com: [-75, 0, 0]
    });
    assert.equal(wrongOwner.accepted, false);
    assert.equal(wrongOwner.reason, 'not-owner');

    // 4. Valid owners submit all 4 tiles -> admitted with SHA-256 & exact global COM
    for (let i = 0; i < 4; i += 1) {
      const sub = part.submitTileMultipoleSummary({
        tileIndex: i,
        peerId: `peer-${i}`,
        token: claims[i].token,
        summaryEpoch: 1,
        totalMass: 100,
        com: [-75 + i * 50, 0, 0],
        particleCount: 250
      });
      assert.equal(sub.accepted, true);
      assert.ok(typeof sub.sha256 === 'string' && sub.sha256.length === 64);
    }
    const glob = part.globalMultipoleSummary();
    assert.equal(glob.complete, true);
    assert.equal(glob.totalMass, 400);
    assert.equal(glob.totalParticles, 1000);
    assert.ok(Math.abs(glob.com[0]) < 1e-5);

    // 5. Lease TTL expiry MUST fail closed when time advances past leaseTtlMs!
    fakeNow += 2_000;
    const expiredSub = part.submitTileMultipoleSummary({
      tileIndex: 0,
      peerId: 'peer-0',
      token: claims[0].token,
      summaryEpoch: 1,
      totalMass: 100,
      com: [-75, 0, 0]
    });
    assert.equal(expiredSub.accepted, false);
    assert.ok(expiredSub.reason === 'stale-epoch' || expiredSub.reason === 'no-active-lease',
      `Expired TTL lease must reject fail-closed, got ${expiredSub.reason}`);

    // 6. Epoch fence rejects stale epoch after advanceEpoch()
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
