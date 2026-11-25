import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  LOG10_SPAN_MAX,
  LOG10_SPAN_MIN,
  QUALITY_PRESETS,
  UNIVERSES_ELEMENT_CHOICES,
  UNIVERSES_SCALES,
  buildAboutScaleHtml,
  buildAboutUlgUniversesHtml,
  formatPhysicalSpan
} from '../src/demos/ulgUniversesDocs.js';
import {
  buildEmissionLinesForContext,
  createRealisticSpiralGalaxyBodies,
  mulberry32
} from '../src/demos/ulgUniversesPhysics.js';
import { resolvePrimaryLevelFromSpan } from '../src/demos/ulgUniversesDemo.js';
import {
  AU_METERS,
  G_AU_SOLAR_YR,
  REAL_SOLAR_SYSTEM_CATALOG,
  SOLAR_BODY_STRIDE_FLOATS,
  buildRealSolarSystemInitialConditions,
  keplerianElementsToCartesian
} from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('ULG Universes spans all 8 nested physical regimes continuously across 40+ orders of magnitude', () => {
  assert.equal(UNIVERSES_SCALES.length, 8);
  assert.equal(UNIVERSES_SCALES[0].level, 0);
  assert.ok(LOG10_SPAN_MAX - LOG10_SPAN_MIN >= 40.0, 'continuous zoom must span >= 40 OOM');
  assert.ok(UNIVERSES_SCALES[0].log10SpanM >= 24.5);
  assert.equal(UNIVERSES_SCALES[7].level, 7);
  assert.ok(UNIVERSES_SCALES[7].log10SpanM <= -14.0);

  for (let i = 0; i < UNIVERSES_SCALES.length; i += 1) {
    const sc = UNIVERSES_SCALES[i];
    assert.equal(sc.level, i);
    assert.ok(sc.equations.length > 20);
    assert.ok(sc.kernels.length > 10);
    assert.ok(sc.minLog10 < sc.maxLog10);
    assert.ok(buildAboutScaleHtml(sc).includes('scientificValidation: false'));
  }
  assert.ok(buildAboutUlgUniversesHtml().includes('40-order-of-magnitude'));
  assert.ok(Object.keys(QUALITY_PRESETS).length === 4);
  assert.ok(UNIVERSES_ELEMENT_CHOICES.length >= 10);

  // Continuous scale label & level mapping sanity
  assert.ok(formatPhysicalSpan(24.8).endsWith('Mpc'));
  assert.ok(formatPhysicalSpan(21.0).endsWith('kly'));
  assert.ok(formatPhysicalSpan(12.6).endsWith('AU'));
  assert.ok(formatPhysicalSpan(7.2).endsWith('km'));
  assert.ok(formatPhysicalSpan(-8.2).endsWith('nm'));
  assert.ok(formatPhysicalSpan(-14.3).endsWith('fm'));

  assert.equal(resolvePrimaryLevelFromSpan(24.8), 0);
  assert.equal(resolvePrimaryLevelFromSpan(21.0), 1);
  assert.equal(resolvePrimaryLevelFromSpan(12.6), 2);
  assert.equal(resolvePrimaryLevelFromSpan(9.2, { focusedSolarBodyIndex: 0 }), 3);
  assert.equal(resolvePrimaryLevelFromSpan(7.2, { focusedSolarBodyIndex: 3 }), 4);
  assert.equal(resolvePrimaryLevelFromSpan(-8.2), 5);
  assert.equal(resolvePrimaryLevelFromSpan(-10.0), 6);
  assert.equal(resolvePrimaryLevelFromSpan(-14.3), 7);
});

test('ULG Universes replaces the 3 fragmented trans-scale demos cleanly with zero root-absolute HTML paths and zero serial WG(1) kernels', () => {
  for (const retired of [
    'cosmic-quantum.html',
    'stellar-genesis.html',
    'supergalactic.html',
    'src/cosmicQuantumStandalone.js',
    'src/stellarGenesisStandalone.js',
    'src/demos/cosmicQuantumZoomDemo.js',
    'src/demos/stellarGenesisDemo.js',
    'src/demos/supergalacticDemo.js'
  ]) {
    assert.equal(fs.existsSync(path.join(ROOT, retired)), false, `Retired trans-scale file must be removed: ${retired}`);
  }

  const html = fs.readFileSync(path.join(ROOT, 'universes.html'), 'utf8');
  assert.ok(html.includes('./src/universesStandalone.js'));
  assert.ok(html.includes('./index.html'));
  assert.ok(html.includes('./elements-lab.html'));
  assert.ok(html.includes('id="uv-zoom-slider"'));
  assert.equal(/src=["']\//.test(html), false, 'universes.html must not contain root-absolute script paths');
  assert.equal(/href=["']\//.test(html), false, 'universes.html must not contain root-absolute href paths');

  for (const rel of [
    'src/demos/ulgUniversesDocs.js',
    'src/demos/ulgUniversesRenderer.js',
    'src/demos/ulgUniversesPhysics.js',
    'src/demos/ulgUniversesDemo.js',
    'src/runtime/astrophysics/solarSystemNBodyGpu.js'
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.equal(src.includes('@workgroup_size(1)'), false, `${rel} must add 0 @workgroup_size(1) kernels`);
    assert.equal(src.includes('phase_mode'), false, `${rel} must not contain discrete phase_mode hacks`);
    assert.equal(src.includes('stepCpuFallback'), false, `${rel} must not contain CPU mirror fallback solvers`);
    assert.equal(src.includes('Math.cos(ang) * pl.a'), false, `${rel} must not contain scripted circular planet orbits`);
  }
});

test('buildRealSolarSystemInitialConditions builds exact astronomical radii, zero-momentum barycentric ICs, and translation-invariant double-float states', () => {
  const a = buildRealSolarSystemInitialConditions({ asteroidCount: 64, seed: 4242 });
  const b = buildRealSolarSystemInitialConditions({ asteroidCount: 64, seed: 4242 });
  assert.deepEqual(a.packed, b.packed, 'Solar System ICs must be deterministic');
  assert.equal(a.massiveCount, REAL_SOLAR_SYSTEM_CATALOG.length);
  assert.equal(a.totalCount, REAL_SOLAR_SYSTEM_CATALOG.length + 64);

  // Verify true astronomical relative radii (NO oversized cartoon planets!)
  const sunR = a.packed[0 * SOLAR_BODY_STRIDE_FLOATS + 7];
  const earthR = a.packed[3 * SOLAR_BODY_STRIDE_FLOATS + 7];
  const moonR = a.packed[4 * SOLAR_BODY_STRIDE_FLOATS + 7];
  const jupR = a.packed[6 * SOLAR_BODY_STRIDE_FLOATS + 7];
  assert.ok(Math.abs(sunR - 695700e3 / AU_METERS) < 1e-8);
  assert.ok(Math.abs(earthR / sunR - 6371 / 695700) < 1e-4, 'Earth/Sun radius ratio must be ~0.00916');
  assert.ok(Math.abs(jupR / sunR - 69911 / 695700) < 1e-4, 'Jupiter/Sun radius ratio must be ~0.1005');
  assert.ok(Math.abs(moonR / earthR - 1737.4 / 6371) < 1e-4, 'Moon/Earth radius ratio must be ~0.2727');

  // Verify exact zero-momentum barycentric COM over massive bodies
  let mTot = 0;
  let cx = 0; let cy = 0; let cz = 0;
  let px = 0; let py = 0; let pz = 0;
  for (let i = 0; i < a.massiveCount; i += 1) {
    const o = i * SOLAR_BODY_STRIDE_FLOATS;
    const m = a.packed[o + 3];
    const x = a.packed[o + 0] + a.packed[o + 4];
    const y = a.packed[o + 1] + a.packed[o + 5];
    const z = a.packed[o + 2] + a.packed[o + 6];
    mTot += m;
    cx += m * x; cy += m * y; cz += m * z;
    px += m * a.packed[o + 8]; py += m * a.packed[o + 9]; pz += m * a.packed[o + 10];
  }
  assert.ok(Math.hypot(cx / mTot, cy / mTot, cz / mTot) < 1e-6, 'Solar system COM must be at barycenter');
  assert.ok(Math.hypot(px, py, pz) < 1e-5, 'Solar system net linear momentum must vanish');

  // Verify exact translation invariance of double-float Earth-Moon separation at 1,000 AU offset
  const shifted = buildRealSolarSystemInitialConditions({
    asteroidCount: 16,
    seed: 4242,
    centerOffsetAu: [1234.5, -678.25, 412.75]
  });
  const getPos64 = (buf, idx) => {
    const o = idx * SOLAR_BODY_STRIDE_FLOATS;
    return [buf[o + 0] + buf[o + 4], buf[o + 1] + buf[o + 5], buf[o + 2] + buf[o + 6]];
  };
  const e0 = getPos64(a.packed, 3); const m0 = getPos64(a.packed, 4);
  const e1 = getPos64(shifted.packed, 3); const m1 = getPos64(shifted.packed, 4);
  const d0 = Math.hypot(m0[0] - e0[0], m0[1] - e0[1], m0[2] - e0[2]);
  const d1 = Math.hypot(m1[0] - e1[0], m1[1] - e1[1], m1[2] - e1[2]);
  assert.ok(Math.abs(d1 - d0) < 1e-9, `Double-float Earth-Moon separation must be translation-invariant (err=${Math.abs(d1 - d0)})`);

  // Keplerian IC helper vis-viva sanity (Earth circular speed ~ 2*pi AU/yr)
  const kEarth = keplerianElementsToCartesian({ aAu: 1.0, e: 0 }, G_AU_SOLAR_YR);
  assert.ok(Math.abs(Math.hypot(...kEarth.vel) - 2 * Math.PI) < 1e-10);
});

test('createRealisticSpiralGalaxyBodies builds emergent dark-matter halo + bulge + spiral disk with zero origin pin', () => {
  const gal = createRealisticSpiralGalaxyBodies({ count: 2048, seed: 777, morphology: 'disk' });
  assert.equal(gal.length, 2048 * 8);
  let dmCount = 0; let dmMass = 0; let totalMass = 0;
  for (let i = 0; i < 2048; i += 1) {
    const m = gal[i * 8 + 3];
    const tag = gal[i * 8 + 7];
    assert.ok(m > 0 && Number.isFinite(m));
    totalMass += m;
    if (tag < 0) {
      dmCount += 1;
      dmMass += m;
    }
  }
  assert.ok(dmCount > 300, 'Realistic galaxy must include real GPU dark-matter halo particles');
  assert.ok(dmMass / totalMass > 0.55 && dmMass / totalMass < 0.85, 'DM halo must carry majority gravitational mass for flat rotation curve');

  // Seeded PRNG & physical emission line generator sanity
  const r = mulberry32(12345);
  assert.ok(r() >= 0 && r() < 1);
  const lines = buildEmissionLinesForContext(1, { tempK: 9500 }, null);
  assert.ok(lines.length >= 6);
  assert.ok(lines.every((ln) => ln.wavelengthNm >= 380 && ln.wavelengthNm <= 740 && ln.intensity > 0));
});
