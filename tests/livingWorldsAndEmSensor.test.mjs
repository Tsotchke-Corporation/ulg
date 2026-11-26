// Host-side Verification Suite for P3 (Living Worlds: Dynamic Sky, Reversed-Z, Tectonics,
// Exotic Oceans, Emergent Seasons, Xenobiology) & P4 (Dual-Caret Full-Spectrum EM Sensor Stack).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildLiveSurfaceCelestialSky,
  buildOrbitalCfdStreamlines,
  evaluateSolarEclipseOccultation
} from '../src/runtime/astrophysics/surfaceCelestialSkyAndSeasons.js';
import {
  deriveAtmosphereParamsFromBody
} from '../src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js';
import {
  XENOBIOLOGY_PLANET_PRESETS,
  buildLifeLabXenobiologyUrl,
  deriveStellarPigmentRgb,
  deriveXenobiologyProfile,
  parseXenobiologyFromSearch
} from '../src/runtime/biology/xenobiologySynthesizer.js';
import {
  REAL_SOLAR_SYSTEM_CATALOG
} from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';
import {
  deriveStarSystemFromGalacticLocation,
  synthesizeNebularPlanetarySystem
} from '../src/runtime/astrophysics/causalNebularSystemGenerator.js';
import {
  deriveSurfaceEnvironmentState
} from '../src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js';
import {
  buildFloraTemplateMeshFloats
} from '../src/runtime/astrophysics/surfaceFloraPlacementGpu.js';

function makeMockSolarEngine(catalog, positionsAuByIndex = {}) {
  return {
    catalog,
    massiveCount: catalog.length,
    simTimeYr: 0.25,
    getMassiveBodyState64(idx) {
      const spec = catalog[idx];
      const pos = positionsAuByIndex[idx] || [spec.aAu || 0, 0, 0];
      return {
        posAu: pos,
        velAuPerYr: [0, 0, 0],
        massSolar: spec.massSolar || 0
      };
    }
  };
}

test('P3: Dynamic Surface Celestial Sky computes diurnal sunrise/sunset, eclipses, Milankovitch seasons & freeze-thaw', () => {
  const earthIdx = REAL_SOLAR_SYSTEM_CATALOG.findIndex((b) => b.id === 'earth');
  const moonIdx = REAL_SOLAR_SYSTEM_CATALOG.findIndex((b) => b.id === 'moon');
  const earthSpec = REAL_SOLAR_SYSTEM_CATALOG[earthIdx];
  assert.ok(earthIdx > 0 && moonIdx > 0);
  assert.ok(Math.abs((earthSpec.axialObliquityDeg || 0) - 23.44) < 0.2);

  const engine = makeMockSolarEngine(REAL_SOLAR_SYSTEM_CATALOG, {
    0: [0, 0, 0],
    [earthIdx]: [1.0, 0, 0],
    [moonIdx]: [1.0 + 0.00257, 0, 0]
  });
  const env = deriveSurfaceEnvironmentState(earthSpec);

  // Sample across one full 24h planetary rotation -> Sun altitude must cross horizon (sunrise & sunset!)
  let minSinAlt = 2;
  let maxSinAlt = -2;
  let minHour = 25;
  let maxHour = -1;
  for (let h = 0; h < 24; h += 2) {
    const sky = buildLiveSurfaceCelestialSky({
      solarEngine: engine,
      catalog: REAL_SOLAR_SYSTEM_CATALOG,
      focusIdx: earthIdx,
      cameraPos: [0, 12, 0],
      env,
      surfaceSimSec: h * 3600,
      observerLatDeg: 32
    });
    const sunY = sky.lightDir[1];
    if (sunY < minSinAlt) minSinAlt = sunY;
    if (sunY > maxSinAlt) maxSinAlt = sunY;
    minHour = Math.min(minHour, sky.climate.localHour);
    maxHour = Math.max(maxHour, sky.climate.localHour);
    // True physical metric distance inside ULG's unified Reversed Logarithmic Depth Buffer [5e4 m .. 1e14 m]!
    for (const sp of sky.spheres) {
      const dist = Math.hypot(sp.pos[0], sp.pos[1], sp.pos[2]);
      assert.ok(dist >= 50_000 && dist <= 1.0e14, `Sky body distance ${dist} outside unified 10^14 m logarithmic depth range`);
    }
    const sunSp = sky.spheres.find((s) => s.kind === 0);
    if (sunY > 0.05) {
      assert.ok(sunSp, 'Host star sphere must be visible above horizon in daylight');
      const sunDistM = Math.hypot(sunSp.pos[0], sunSp.pos[1], sunSp.pos[2]);
      assert.ok(sunDistM > 1.0e11 && sunDistM < 2.0e11, `Sun must be at true ~1 AU metric distance (got ${sunDistM} m)`);
    } else if (sunY < -0.10) {
      assert.equal(sunSp, undefined, 'Host star below horizon must be physically occluded by the opaque planet');
    }
  }
  assert.ok(maxSinAlt > 0.35 && minSinAlt < -0.25,
    `Planetary spin must drive real sunrises & sunsets (minY=${minSinAlt.toFixed(3)}, maxY=${maxSinAlt.toFixed(3)})`);
  assert.ok(maxHour - minHour > 16, `Local solar clock must advance around the day (min=${minHour}, max=${maxHour})`);

  // Flying across the curved surface (craftPosM) must physically cross the terminator onto the pitch-black night side!
  const dayStart = buildLiveSurfaceCelestialSky({
    solarEngine: engine,
    catalog: REAL_SOLAR_SYSTEM_CATALOG,
    focusIdx: earthIdx,
    cameraPos: [0, 30, 0],
    craftPosM: [0, 30, 0],
    navRadiusM: 2800,
    env,
    surfaceSimSec: 0,
    observerLatDeg: 28
  });
  const nightFlown = buildLiveSurfaceCelestialSky({
    solarEngine: engine,
    catalog: REAL_SOLAR_SYSTEM_CATALOG,
    focusIdx: earthIdx,
    cameraPos: [6200, 30, 0],
    craftPosM: [6200, 30, 0],
    navRadiusM: 2800,
    env,
    surfaceSimSec: 0,
    observerLatDeg: 28
  });
  assert.ok(dayStart.primarySunElevDeg > 10, `Landing origin must start in daylight (got ${dayStart.primarySunElevDeg} deg)`);
  assert.ok(nightFlown.primarySunElevDeg < -10 && nightFlown.climate.isNightSide === true,
    `Flying across spherical horizon must reach true dark side (got elev=${nightFlown.primarySunElevDeg} deg)`);

  // Exact Solar Eclipse test: place Moon directly between Earth and Sun along -X line
  const eclipseEngine = makeMockSolarEngine(REAL_SOLAR_SYSTEM_CATALOG, {
    0: [0, 0, 0],
    [earthIdx]: [1.0, 0, 0],
    [moonIdx]: [1.0 - 0.00257, 0, 0]
  });
  const skyEcl = buildLiveSurfaceCelestialSky({
    solarEngine: eclipseEngine,
    catalog: REAL_SOLAR_SYSTEM_CATALOG,
    focusIdx: earthIdx,
    cameraPos: [0, 12, 0],
    env,
    surfaceSimSec: 12 * 3600,
    observerLatDeg: 0
  });
  assert.ok(skyEcl.climate.eclipseFactor < 0.35,
    `Aligned Moon between Earth and Sun must trigger solar eclipse (got eclipseFactor=${skyEcl.climate.eclipseFactor})`);

  // Exact circle-circle occultation unit verification (returns occluded fraction [0..1])
  const occFull = evaluateSolarEclipseOccultation(0.0, 0.00465, 0.0047);
  const occNone = evaluateSolarEclipseOccultation(0.25, 0.00465, 0.0047);
  assert.equal(occFull, 1.0, 'Concentric larger occulting disk must give total occultation (1.0)');
  assert.equal(occNone, 0.0, 'Separated disks must give 0 occultation');

  // Emergent seasons across orbital phase (opposite sides of Sun along spin axis) on tilted Earth
  const summerEng = makeMockSolarEngine(REAL_SOLAR_SYSTEM_CATALOG, { 0: [0, 0, 0], [earthIdx]: [0, 0, 1.0] });
  const winterEng = makeMockSolarEngine(REAL_SOLAR_SYSTEM_CATALOG, { 0: [0, 0, 0], [earthIdx]: [0, 0, -1.0] });
  const sumSky = buildLiveSurfaceCelestialSky({
    solarEngine: summerEng, catalog: REAL_SOLAR_SYSTEM_CATALOG, focusIdx: earthIdx, env, surfaceSimSec: 0, observerLatDeg: 52
  });
  const winSky = buildLiveSurfaceCelestialSky({
    solarEngine: winterEng, catalog: REAL_SOLAR_SYSTEM_CATALOG, focusIdx: earthIdx, env, surfaceSimSec: 0, observerLatDeg: 52
  });
  assert.notEqual(sumSky.climate.seasonName, winSky.climate.seasonName,
    `Opposite orbital points must exhibit opposite seasons (${sumSky.climate.seasonName} vs ${winSky.climate.seasonName})`);
  assert.ok(Math.abs(sumSky.climate.surfaceTempK - winSky.climate.surfaceTempK) > 10,
    `Seasonal temperature swing on tilted planet at 52 deg lat must exceed 10 K (got ${sumSky.climate.surfaceTempK} vs ${winSky.climate.surfaceTempK} K)`);
  assert.ok(Math.abs(sumSky.climate.snowlineM - winSky.climate.snowlineM) > 15,
    `Snowline altitude must shift dynamically with seasonal temperature (${sumSky.climate.snowlineM} vs ${winSky.climate.snowlineM} m)`);
});

test('P3: Orbital Atmospheric CFD streamlines are emitted for atmosphere-bearing worlds and zero for airless bodies', () => {
  const earthAtmo = deriveAtmosphereParamsFromBody(REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'earth'));
  const jupAtmo = deriveAtmosphereParamsFromBody(REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'jupiter'));
  const moonAtmo = deriveAtmosphereParamsFromBody(REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'moon'));

  const linesEarth = buildOrbitalCfdStreamlines({ radius: 2.2, atmoState: earthAtmo, timeSec: 1.5, alphaMul: 1.0 });
  const linesJup = buildOrbitalCfdStreamlines({ radius: 2.2, atmoState: jupAtmo, timeSec: 1.5, alphaMul: 1.0 });
  const linesMoon = buildOrbitalCfdStreamlines({ radius: 2.2, atmoState: moonAtmo, timeSec: 1.5, alphaMul: 1.0 });

  assert.ok(linesEarth.length > 500, `Earth orbital CFD must produce 3D wind/cyclone streamlines (got ${linesEarth.length})`);
  assert.ok(linesJup.length > linesEarth.length, `Fast-rotating gas giant Jupiter must produce denser multi-jet zonal CFD bands (${linesJup.length} vs ${linesEarth.length})`);
  assert.equal(linesMoon.length, 0, 'Airless Moon must produce 0 atmospheric CFD streamlines');
});

test('P3: Xenobiology Synthesizer classifies H2O, CH4, NH3, H2SO4 worlds & roundtrips URL cleanly', () => {
  const earth = deriveXenobiologyProfile({ worldName: 'Earth', tempK: 288, pressurePa: 101325, volatileFrac: 0.05 });
  const titan = deriveXenobiologyProfile({ worldName: 'Titan', tempK: 94, pressurePa: 146700, gravityMS2: 1.35, volatileFrac: 0.06 });
  const venus = deriveXenobiologyProfile({ worldName: 'Venus', tempK: 332, pressurePa: 9200000, gravityMS2: 8.87, volatileFrac: 0.02 });
  const europa = deriveXenobiologyProfile({ worldName: 'Europa', tempK: 102, pressurePa: 0, gravityMS2: 1.31, volatileFrac: 0.08, isCryoMoon: true });

  assert.equal(earth.solvent, 'H2O');
  assert.equal(titan.solvent, 'CH4');
  assert.ok(titan.labParams.memTempK >= 80 && titan.labParams.memTempK <= 115,
    `Titan membrane temperature should be cryogenic (got ${titan.labParams.memTempK} K)`);
  assert.equal(venus.solvent, 'H2SO4');
  assert.equal(europa.solvent, 'H2O-subsurface');

  // Red dwarf M-star host produces crimson-redder pigment than G/F-star host via Wien's law
  const rgbM = deriveStellarPigmentRgb(3050, 'H2O');
  const rgbG = deriveStellarPigmentRgb(5778, 'H2O');
  assert.ok(rgbM[0] > rgbM[1] && rgbG[1] > rgbG[0], 'M-dwarf pigment must be crimson-dominant while G-star pigment is green-dominant');

  // URL roundtrip for Titan -> life-lab.html?xeno=1...
  const url = buildLifeLabXenobiologyUrl(titan);
  assert.ok(url.startsWith('./life-lab.html?xeno=1'));
  const qs = url.slice(url.indexOf('?'));
  const parsed = parseXenobiologyFromSearch(qs);
  assert.ok(parsed?.profile);
  assert.equal(parsed.profile.worldName, titan.worldName);
  assert.equal(parsed.profile.solvent, 'CH4');
  assert.ok(Math.abs(parsed.profile.labParams.memTempK - titan.labParams.memTempK) <= 2);
  assert.ok(XENOBIOLOGY_PLANET_PRESETS.length >= 5);
});

test('P3: Procedural causal star systems populate axial obliquity, rotation period & emergent civilization index', () => {
  const starSys = deriveStarSystemFromGalacticLocation({ seed: 20261125, siteIndex: 7, radiusKpc: 8.1 });
  const sys = synthesizeNebularPlanetarySystem(starSys);
  const planets = sys.catalog.filter((b) => !b.isStar);
  assert.ok(planets.length >= 2);
  for (const p of planets) {
    assert.ok(Number.isFinite(p.axialObliquityDeg) && p.axialObliquityDeg >= 0 && p.axialObliquityDeg <= 180);
    assert.ok(Number.isFinite(p.rotationPeriodHr) && p.rotationPeriodHr > 1);
    assert.ok(Number.isFinite(p.civTechK) && p.civTechK >= 0 && p.civTechK <= 3.0);
  }
});

test('P3: GPU Flora template mesh builder produces valid non-zero triangle vertices across conifer/broadleaf/settlement', () => {
  const verts = buildFloraTemplateMeshFloats();
  assert.ok(verts instanceof Float32Array);
  const vertCount = Math.floor(verts.length / 8);
  assert.ok(vertCount >= 60 && vertCount % 3 === 0);
  const kindsSeen = new Set();
  for (let i = 0; i < vertCount; i += 1) {
    kindsSeen.add(Math.round(verts[i * 8 + 7]));
  }
  assert.ok(kindsSeen.has(0) && kindsSeen.has(1) && kindsSeen.has(2), 'Template must include conifer (0), broadleaf/xeno (1), and settlement (2)');
});

test('P4 & P3 Structural Invariants: Reversed-Z, Bit-Exact EM Bypass, 3-vec4 CFD flow & Space UFO isolation', () => {
  const rendererSrc = readFileSync(new URL('../src/demos/ulgUniversesRenderer.js', import.meta.url), 'utf8');
  const demoSrc = readFileSync(new URL('../src/demos/ulgUniversesDemo.js', import.meta.url), 'utf8');
  const atmoSrc = readFileSync(new URL('../src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js', import.meta.url), 'utf8');

  // Reversed-Z Infinite Far Plane contracts
  assert.match(rendererSrc, /depthClearValue:\s*0\.0/);
  assert.match(rendererSrc, /depthCompare:\s*'greater-equal'/);
  assert.match(demoSrc, /m\[10\]\s*=\s*0\.0;[\s\S]*m\[11\]\s*=\s*-1\.0;[\s\S]*m\[14\]\s*=\s*near;/);

  // Bit-exact EM sensor passthrough when inactive
  assert.match(rendererSrc, /if\s*\(\s*cam\.em_sensor\.z\s*<\s*0\.5\s*\)\s*\{\s*return\s+vis_rgb;\s*\}/);

  // Dedicated spaceMeshCamBuf fixing neon-yellow UFO nose + 2-pass Kawase HDR Bloom
  assert.match(rendererSrc, /spaceMeshCamBuf/);
  assert.match(rendererSrc, /BLOOM_WGSL/);

  // Smooth filamentary polar aurora & 3-vec4 CFD flow advection
  assert.match(rendererSrc, /fn eval_filament_aurora/);
  assert.match(atmoSrc, /cfd_flow:\s*vec4<f32>/);
  assert.ok(!atmoSrc.includes('sin(lon * 6.0) * cos(lon * 4.0)'), 'Coarse beaded aurora pattern must stay retired');
});
