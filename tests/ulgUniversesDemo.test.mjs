import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  QUALITY_PRESETS,
  UNIVERSES_ELEMENT_CHOICES,
  UNIVERSES_SCALES,
  buildAboutScaleHtml,
  buildAboutUlgUniversesHtml
} from '../src/demos/ulgUniversesDocs.js';
import {
  buildEmissionLinesForContext,
  buildStarSystemBodies,
  mulberry32
} from '../src/demos/ulgUniversesPhysics.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('ULG Universes spans all 8 nested physical regimes across 40 orders of magnitude (10^+25 m -> 10^-15 m)', () => {
  assert.equal(UNIVERSES_SCALES.length, 8);
  assert.equal(UNIVERSES_SCALES[0].level, 0);
  assert.equal(UNIVERSES_SCALES[0].log10SpanM, 25.0);
  assert.equal(UNIVERSES_SCALES[7].level, 7);
  assert.equal(UNIVERSES_SCALES[7].log10SpanM, -15.0);
  assert.equal(UNIVERSES_SCALES[0].log10SpanM - UNIVERSES_SCALES[7].log10SpanM, 40.0);

  for (let i = 0; i < UNIVERSES_SCALES.length; i += 1) {
    const sc = UNIVERSES_SCALES[i];
    assert.equal(sc.level, i);
    assert.ok(sc.equations.length > 20);
    assert.ok(sc.kernels.length > 10);
    assert.ok(buildAboutScaleHtml(sc).includes('scientificValidation: false'));
  }
  assert.ok(buildAboutUlgUniversesHtml().includes('40 orders of magnitude'));
  assert.ok(Object.keys(QUALITY_PRESETS).length === 4);
  assert.ok(UNIVERSES_ELEMENT_CHOICES.length >= 10);
});

test('ULG Universes replaces the 3 fragmented trans-scale demos cleanly with zero root-absolute HTML paths and zero @workgroup_size(1)', () => {
  // Replaced demos must be gone
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

  // Flagship replacement must exist with strictly relative Pages asset paths
  const html = fs.readFileSync(path.join(ROOT, 'universes.html'), 'utf8');
  assert.ok(html.includes('./src/universesStandalone.js'));
  assert.ok(html.includes('./index.html'));
  assert.ok(html.includes('./elements-lab.html'));
  assert.equal(/src=["']\//.test(html), false, 'universes.html must not contain root-absolute script paths');
  assert.equal(/href=["']\//.test(html), false, 'universes.html must not contain root-absolute href paths');

  // Star Spec anti-hack + zero @workgroup_size(1) serial bottleneck audit across all ULG Universes modules
  for (const rel of [
    'src/demos/ulgUniversesDocs.js',
    'src/demos/ulgUniversesRenderer.js',
    'src/demos/ulgUniversesPhysics.js',
    'src/demos/ulgUniversesDemo.js'
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.equal(src.includes('@workgroup_size(1)'), false, `${rel} must add 0 @workgroup_size(1) kernels`);
    assert.equal(src.includes('phase_mode'), false, `${rel} must not contain discrete phase_mode hacks`);
    assert.equal(src.includes('stepCpuFallback'), false, `${rel} must not contain CPU mirror fallback solvers`);
    assert.equal(src.includes('Math.cos(ang) * pl.a'), false, `${rel} must not contain scripted circular planet orbits`);
  }
});

test('buildStarSystemBodies creates deterministic zero-momentum barycentric N-body initial conditions', () => {
  const a = buildStarSystemBodies({ seed: 4242, starMass: 12.0 });
  const b = buildStarSystemBodies({ seed: 4242, starMass: 12.0 });
  assert.deepEqual(a, b, 'star system ICs must be deterministic for a fixed seed');

  const n = a.length / 8;
  assert.ok(n >= 6);
  let mTot = 0;
  let cx = 0; let cy = 0; let cz = 0;
  let px = 0; let py = 0; let pz = 0;
  for (let i = 0; i < n; i += 1) {
    const o = i * 8;
    const m = a[o + 3];
    assert.ok(m > 0 && Number.isFinite(m));
    mTot += m;
    cx += m * a[o + 0]; cy += m * a[o + 1]; cz += m * a[o + 2];
    px += m * a[o + 4]; py += m * a[o + 5]; pz += m * a[o + 6];
  }
  assert.ok(Math.hypot(cx / mTot, cy / mTot, cz / mTot) < 1e-5, 'system COM must start at barycenter');
  assert.ok(Math.hypot(px, py, pz) < 1e-4, 'system total linear momentum must vanish');

  // Seeded PRNG & physical emission line generator sanity
  const r = mulberry32(12345);
  assert.ok(r() >= 0 && r() < 1);
  const lines = buildEmissionLinesForContext(1, { tempK: 9500 }, null);
  assert.ok(lines.length >= 6);
  assert.ok(lines.every((ln) => ln.wavelengthNm >= 380 && ln.wavelengthNm <= 740 && ln.intensity > 0));
});
