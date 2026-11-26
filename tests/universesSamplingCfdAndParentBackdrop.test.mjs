import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveSurfaceEnvironmentState,
  evaluatePlanetaryCrustElevation,
  sampleLocalPlanetaryMaterial
} from '../src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js';
import {
  deriveAtmosphericColumnProfile,
  evaluateAtmosphericChemistryAtAltitude
} from '../src/runtime/astrophysics/planetaryAtmosphere3dCfdGpu.js';
import {
  computeScaleAdaptiveTimeDilation
} from '../src/demos/ulgUniversesPhysics.js';
import { REAL_SOLAR_SYSTEM_CATALOG } from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';

test('Local planetary material sampler varies spatially across terrain biomes and atmospheric depth without planet-name hacks', () => {
  const earthSpec = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'earth');
  const marsSpec = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'mars');
  const jupSpec = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'jupiter');

  // 1. Earth-like solid ocean world: find distinct samples across ocean vs land/highland/ridge!
  const earthEnv = deriveSurfaceEnvironmentState(earthSpec, { seed: 20261125 });
  const earthSamples = new Map();
  for (let gx = -120; gx <= 120; gx += 12) {
    for (let gz = -120; gz <= 120; gz += 12) {
      const h = evaluatePlanetaryCrustElevation(gx, gz, earthEnv);
      const s = sampleLocalPlanetaryMaterial(earthEnv, [gx, Math.max(h, earthEnv.seaLevelM), gz], {
        activeVehicle: 'rover',
        worldName: 'Earth-like'
      });
      if (!earthSamples.has(s.id)) earthSamples.set(s.id, s);
    }
  }
  assert.ok(
    earthSamples.size >= 3,
    `Expected >= 3 distinct local surface samples across temperate ocean world, got ${earthSamples.size}: ${[...earthSamples.keys()].join(', ')}`
  );
  assert.ok(earthSamples.has('saline-ocean-water'), 'Ocean coordinates must sample liquid saline H2O');
  const oceanSample = earthSamples.get('saline-ocean-water');
  assert.equal(oceanSample.phasePreset, 'melt');
  assert.equal(oceanSample.primaryZ, 8);
  assert.ok(oceanSample.compounds.some((c) => c.id === 'H2O'));
  assert.ok(oceanSample.elements.some((e) => e.Z === 8) && oceanSample.elements.some((e) => e.Z === 1));

  // 2. Dry dusty Mars-like world: yields ferric regolith + crater/basalt ridge variation!
  const marsEnv = deriveSurfaceEnvironmentState(marsSpec, { seed: 20261125 });
  const marsSamples = new Map();
  for (let gx = -120; gx <= 120; gx += 12) {
    for (let gz = -120; gz <= 120; gz += 12) {
      const h = evaluatePlanetaryCrustElevation(gx, gz, marsEnv);
      const s = sampleLocalPlanetaryMaterial(marsEnv, [gx, h, gz], {
        activeVehicle: 'rover',
        worldName: 'Mars-like'
      });
      if (!marsSamples.has(s.id)) marsSamples.set(s.id, s);
    }
  }
  assert.ok(
    marsSamples.size >= 2,
    `Expected >= 2 distinct geological samples on arid desert world, got ${marsSamples.size}: ${[...marsSamples.keys()].join(', ')}`
  );
  assert.ok(marsSamples.has('ferric-oxide-regolith'), 'Arid iron-dust world must sample ferric oxide regolith');

  // 3. Deep gas giant UFO dive: upper NH3 cirrus deck (+14 km) vs deep H2O supercell deck (-55 km)!
  const jupEnv = deriveSurfaceEnvironmentState(jupSpec, { seed: 20261125 });
  const jupProf = deriveAtmosphericColumnProfile(jupSpec, jupEnv);
  const upperChem = evaluateAtmosphericChemistryAtAltitude(jupProf, 14.0);
  const deepChem = evaluateAtmosphericChemistryAtAltitude(jupProf, -55.0);
  const sUpper = sampleLocalPlanetaryMaterial(jupEnv, [0, 10, 0], {
    activeVehicle: 'ufo',
    cfdTelemetry: { chemistry: upperChem },
    worldName: 'Gas Giant'
  });
  const sDeep = sampleLocalPlanetaryMaterial(jupEnv, [0, 10, 0], {
    activeVehicle: 'ufo',
    cfdTelemetry: { chemistry: deepChem },
    worldName: 'Gas Giant'
  });
  assert.equal(sUpper.category, 'atmosphere-stratum');
  assert.equal(sDeep.category, 'atmosphere-stratum');
  assert.notEqual(
    sUpper.id,
    sDeep.id,
    `Gas giant UFO dive must sample distinct cloud chemistry at different depths (got ${sUpper.id} vs ${sDeep.id})`
  );
  assert.ok(sDeep.pressureBar > sUpper.pressureBar * 3, 'Deeper gas giant sample must have substantially higher hydrostatic pressure');
  assert.ok(sUpper.compounds.length >= 3 && sUpper.elements.length >= 2);
});

test('Automatic scale-adaptive time dilation strictly slows physical clock rate when zooming inward across 40 OOM', () => {
  const spans = [25.0, 22.5, 21.0, 17.0, 14.0, 12.0, 9.5, 7.2, 2.0, -8.2, -10.0, -14.3];
  const rates = spans.map((sp) => computeScaleAdaptiveTimeDilation(sp, { surfaceActive: sp === 2.0, userTimeScale: 1.0 }));
  for (let i = 1; i < rates.length; i += 1) {
    assert.ok(
      rates[i].secondsPerWallSecond < rates[i - 1].secondsPerWallSecond,
      `Expected strictly slower clock when zooming from 10^${spans[i - 1]}m (${rates[i - 1].clockLabel}) to 10^${spans[i]}m (${rates[i].clockLabel})`
    );
  }
  assert.equal(rates[0].clockLabel.endsWith('Myr/s'), true, `L0 should run in Myr/s, got ${rates[0].clockLabel}`);
  assert.equal(rates[8].clockLabel, '1.0 s/s', `Surface should run at 1.0 s/s real-time, got ${rates[8].clockLabel}`);
  assert.equal(rates[9].clockLabel.endsWith('fs/s'), true, `L5 lattice should run in fs/s, got ${rates[9].clockLabel}`);
  assert.equal(rates[11].clockLabel.endsWith('zs/s'), true, `L7 nucleus should run in zs/s, got ${rates[11].clockLabel}`);

  // User time-scale slider scales smoothly and linearly
  const half = computeScaleAdaptiveTimeDilation(12.2, { userTimeScale: 0.5 });
  const full = computeScaleAdaptiveTimeDilation(12.2, { userTimeScale: 1.0 });
  assert.ok(Math.abs(full.secondsPerWallSecond / half.secondsPerWallSecond - 2.0) < 1e-6);
});
