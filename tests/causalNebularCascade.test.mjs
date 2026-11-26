import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCosmicEpochState } from '../src/runtime/astrophysics/cosmicEpochState.js';
import {
  deriveGalaxyEnvironmentFromCosmicContext,
  deriveStarSystemFromGalacticLocation,
  evaluateHolmanWiegertLimits,
  synthesizeNebularPlanetarySystem
} from '../src/runtime/astrophysics/causalNebularSystemGenerator.js';
import {
  buildProceduralStarSystemInitialConditions,
  G_AU_SOLAR_YR
} from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';
import {
  deriveSurfaceEnvironmentState,
  evaluatePlanetaryTerrainHeight,
  evaluateRenderedTerrainTriangleHeight,
  resolveRoverMultiWheelSupport
} from '../src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js';
import { REAL_SOLAR_SYSTEM_CATALOG } from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';

test('Causal Astrophysical Cascade: Universe Epoch & Cosmic Density govern Galaxy Morphology, Metallicity, & Pop III vs Disk Stars', () => {
  const epDawn = evaluateCosmicEpochState({ redshiftZ: 10.0 });
  const epNow = evaluateCosmicEpochState({ redshiftZ: 0.0 });
  const epFuture = evaluateCosmicEpochState({ redshiftZ: -0.35 });

  const gDawn = deriveGalaxyEnvironmentFromCosmicContext({ cosmicEpoch: epDawn, localOverdensity: 1.4, seed: 101 });
  const gDisk = deriveGalaxyEnvironmentFromCosmicContext({ cosmicEpoch: epNow, localOverdensity: 1.1, seed: 101 });
  const gCluster = deriveGalaxyEnvironmentFromCosmicContext({ cosmicEpoch: epNow, localOverdensity: 4.2, seed: 101 });
  const gFuture = deriveGalaxyEnvironmentFromCosmicContext({ cosmicEpoch: epFuture, localOverdensity: 2.0, seed: 101 });

  assert.equal(gDawn.morphology, 'proto', 'Cosmic Dawn (z=10) must yield primordial protogalaxy');
  assert.equal(gDawn.isPrimordialPopIII, true);
  assert.ok(gDawn.meanMetallicitySolar < 0.01, `z=10 must be ultra-metal-poor (got ${gDawn.meanMetallicitySolar})`);
  assert.ok(gDawn.gasFraction > gDisk.gasFraction, 'High-z protogalaxies must be more gas-rich than z=0 disks');
  assert.ok(gCluster.morphology === 'sphere' || gCluster.morphology === 'binary', 'High-density cluster core must yield elliptical or merger');
  assert.equal(gFuture.morphology, 'sphere', 'Far-future dense environment must be evolved elliptical');

  // Primordial Pop III star system at z=10: massive stars & ZERO rocky/Earth-like planets!
  let pop3Planets = 0;
  let pop3EarthLike = 0;
  let pop3MeanMass = 0;
  for (let i = 0; i < 20; i += 1) {
    const st = deriveStarSystemFromGalacticLocation({ cosmicEpoch: epDawn, galaxyEnv: gDawn, starPosGal: [2.0 + i * 0.2, 0.1, 1.0], starIndex: i, seed: 500 + i });
    const sys = synthesizeNebularPlanetarySystem(st);
    pop3Planets += sys.planetCount;
    if (sys.hasEarthLike) pop3EarthLike += 1;
    pop3MeanMass += st.stars[0].initialMassSolar;
  }
  assert.equal(pop3EarthLike, 0, 'Metal-free Cosmic Dawn Pop III stars must NEVER form Earth-like worlds');
  assert.equal(pop3Planets, 0, 'Metal-free Pop III stars must form 0 metal-rich planets');
  assert.ok(pop3MeanMass / 20 > 8.0, `Pop III IMF must be top-heavy (> 8 M_sun mean, got ${pop3MeanMass / 20})`);
});

test('Galactic Disk Statistical Distribution: Earth-like worlds are RARE (not in every system!), with authentic Binary/Trinary & Spectral Variety', () => {
  const epNow = evaluateCosmicEpochState({ redshiftZ: 0.0 });
  const gDisk = deriveGalaxyEnvironmentFromCosmicContext({ cosmicEpoch: epNow, localOverdensity: 1.15, seed: 2026 });

  let nSingle = 0; let nBinary = 0; let nTrinary = 0;
  let nEarthLike = 0; let nCarbonWorlds = 0;
  const spectralSet = new Set();

  for (let i = 0; i < 120; i += 1) {
    const r = 0.8 + (i % 10) * 0.85;
    const th = i * 0.618 * Math.PI * 2;
    const st = deriveStarSystemFromGalacticLocation({
      cosmicEpoch: epNow,
      galaxyEnv: gDisk,
      starPosGal: [Math.cos(th) * r, (i % 5 === 0 ? 0.5 : 0.04), Math.sin(th) * r],
      popTag: r < 2.2 ? 0.15 : (i % 4 === 0 ? 0.85 : 0.48),
      starIndex: i,
      seed: 9001 + i * 17
    });
    const sys = synthesizeNebularPlanetarySystem(st);
    if (st.multiplicity === 1) nSingle += 1;
    else if (st.multiplicity === 2) nBinary += 1;
    else if (st.multiplicity === 3) nTrinary += 1;
    if (sys.hasEarthLike) nEarthLike += 1;
    for (const b of sys.catalog) {
      if (b.isStar) spectralSet.add(b.spectralCode[0]);
      if (b.planetClass === 'carbon-world') nCarbonWorlds += 1;
      // Ensure NO procedurally synthesized world is hardcoded to the bare name "Earth"
      assert.notEqual(b.name, 'Earth', 'Procedural systems must use "Earth-like", never hardcoded "Earth"');
    }
  }

  assert.ok(nSingle >= 40, `Expected substantial single stars (got ${nSingle})`);
  assert.ok(nBinary >= 20, `Expected substantial binary star systems (got ${nBinary})`);
  assert.ok(nTrinary >= 4, `Expected hierarchical trinary star systems (got ${nTrinary})`);
  assert.ok(nEarthLike >= 1 && nEarthLike <= 45, `Earth-like worlds must be emergent & NOT in every system (got ${nEarthLike}/120)`);
  assert.ok(nCarbonWorlds >= 1, `High-C/O bulge nebulae must produce Carbon Worlds (got ${nCarbonWorlds})`);
  assert.ok(spectralSet.size >= 4, `Expected broad spectral star variety (got ${[...spectralSet].join(', ')})`);
});

test('Binary & Hierarchical Trinary Barycentric ICs have exact zero net momentum & Holman-Wiegert stable orbits', () => {
  const epNow = evaluateCosmicEpochState({ redshiftZ: 0.0 });
  const gDisk = deriveGalaxyEnvironmentFromCosmicContext({ cosmicEpoch: epNow, localOverdensity: 1.1, seed: 42 });

  for (const mult of [2, 3]) {
    const st = deriveStarSystemFromGalacticLocation({
      cosmicEpoch: epNow,
      galaxyEnv: gDisk,
      starPosGal: [4.5, 0.05, 1.5],
      popTag: 0.55,
      starIndex: mult * 7,
      seed: 777 + mult,
      forceMultiplicity: mult
    });
    const sys = synthesizeNebularPlanetarySystem(st);
    assert.equal(sys.starCount, mult, `Expected ${mult} stars`);
    const ic = buildProceduralStarSystemInitialConditions(sys.catalog, { asteroidCount: 64, beltZoneAu: sys.beltZoneAu, seed: 42 });
    assert.equal(ic.starCount, mult);
    assert.equal(ic.totalCount, sys.catalog.length + 64);

    // Verify exact zero-momentum barycentric COM across all massive bodies!
    let px = 0; let py = 0; let pz = 0; let mTot = 0; let cx = 0; let cy = 0; let cz = 0;
    for (let i = 0; i < ic.massiveCount; i += 1) {
      const o = i * 16;
      const m = ic.packed[o + 3];
      mTot += m;
      cx += m * (ic.packed[o + 0] + ic.packed[o + 4]);
      cy += m * (ic.packed[o + 1] + ic.packed[o + 5]);
      cz += m * (ic.packed[o + 2] + ic.packed[o + 6]);
      px += m * ic.packed[o + 8];
      py += m * ic.packed[o + 9];
      pz += m * ic.packed[o + 10];
    }
    assert.ok(Math.hypot(cx, cy, cz) / mTot < 1e-6, `Barycentric COM must be at origin for mult=${mult}`);
    assert.ok(Math.hypot(px, py, pz) < 1e-6, `Net linear momentum must be 0 for mult=${mult}`);
  }

  const hw = evaluateHolmanWiegertLimits(0.2, 0.1, 0.4);
  assert.ok(hw.rCritPAu > 0.45 && hw.rCritPAu < 0.85);
  assert.ok(hw.rCritSAu > 0.03 && hw.rCritSAu < 0.12);
});

test('Rover 6-Wheel Barycentric Triangle Collision guarantees ZERO wheel penetration across rough craters & ridges', () => {
  const marsEnv = deriveSurfaceEnvironmentState(REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'mars'), { seed: 20261125 });
  const cellSizeM = 2.35;
  const wheelOffsets = [
    [-1.22, -1.22], [1.22, -1.22],
    [-1.22, 0.0],   [1.22, 0.0],
    [-1.22, 1.22],  [1.22, 1.22]
  ];

  // Probe 50 rugged crater/ridge positions & orientations: EVERY wheel bottom must clear BOTH triangle & analytic terrain!
  for (let k = 0; k < 50; k += 1) {
    const x = -80 + k * 3.7;
    const z = -65 + ((k * 29) % 130);
    const yaw = k * 0.41;
    const sup = resolveRoverMultiWheelSupport(x, z, yaw, cellSizeM, marsEnv);
    const up = sup.normal;
    const sy = Math.sin(yaw); const cy = Math.cos(yaw);
    const dotFU = sy * up[0] + cy * up[2];
    const fRaw = [sy - up[0] * dotFU, -up[1] * dotFU, cy - up[2] * dotFU];
    const fLen = Math.hypot(...fRaw) || 1;
    const fwd = [fRaw[0] / fLen, fRaw[1] / fLen, fRaw[2] / fLen];
    const rRaw = [up[1] * fwd[2] - up[2] * fwd[1], up[2] * fwd[0] - up[0] * fwd[2], up[0] * fwd[1] - up[1] * fwd[0]];
    const rLen = Math.hypot(...rRaw) || 1;
    const right = [rRaw[0] / rLen, rRaw[1] / rLen, rRaw[2] / rLen];

    for (const [rx, rz] of wheelOffsets) {
      const wx = x + cy * rx + sy * rz;
      const wz = z - sy * rx + cy * rz;
      const wheelBottomY = sup.supportY + right[1] * rx + fwd[1] * rz;
      const hTri = evaluateRenderedTerrainTriangleHeight(wx, wz, cellSizeM, marsEnv);
      const hAna = evaluatePlanetaryTerrainHeight(wx, wz, marsEnv);
      assert.ok(
        wheelBottomY >= Math.max(hTri, hAna) + 0.015,
        `Wheel (${rx},${rz}) penetrated terrain at (${wx.toFixed(1)},${wz.toFixed(1)}): wheelY=${wheelBottomY.toFixed(3)} vs ground=${Math.max(hTri, hAna).toFixed(3)}`
      );
    }
  }
});
