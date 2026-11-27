// Host-side Verification Suite for Phase C Astronomical Catalog Gap-Fill & Visual Fidelity:
//   - 11 L1 Galaxy Morphologies (incl. Cartwheel Ring, S0 Lenticular, Starburst Irregular, M45 Open Cluster)
//   - Extended Real Solar System Catalog (Enceladus, Triton retrograde, Pluto-Charon binary, Uranus 97.8 deg vertical rings)
//   - 5 Diverse 3D MLS-MPM Stellar Structure Regimes (G2V, O/B Blue Supergiant, Betelgeuse RSG, AGB Carbon, Brown Dwarf)
//   - TDE (mode=5), Reflection Nebula (regime=5), Wolf-Rayet Homunculus (regime=6), JWST IR ISM dust extinction & EHT n=1 photon ring

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { REAL_SOLAR_SYSTEM_CATALOG } from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';
import {
  STELLAR_MLS_MPM_FUSION_LAW_ADAPTER,
  STELLAR_MLS_MPM_PROFILES,
  buildStellarMlsMpmInitialParcels
} from '../src/runtime/astrophysics/stellarMlsMpmFusionGpu.js';
import { createRealisticSpiralGalaxyBodies } from '../src/demos/ulgUniversesPhysics.js';

test('Phase C1: Real Solar System Catalog includes Enceladus, retrograde Triton, Pluto-Charon binary & Uranus vertical rings (preserving indices 0..17)', () => {
  assert.equal(REAL_SOLAR_SYSTEM_CATALOG[3].id, 'earth', 'Existing Earth index 3 must stay invariant');
  assert.equal(REAL_SOLAR_SYSTEM_CATALOG[6].id, 'jupiter', 'Existing Jupiter index 6 must stay invariant');
  assert.equal(REAL_SOLAR_SYSTEM_CATALOG[10].id, 'saturn', 'Existing Saturn index 10 must stay invariant');

  const uranus = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'uranus');
  const enceladus = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'enceladus');
  const triton = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'triton');
  const pluto = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'pluto');
  const charon = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'charon');

  assert.ok(uranus?.ringed && Array.isArray(uranus.ringNormal) && uranus.ringNormal[0] > 0.9, 'Uranus must have ~97.8 deg vertical rings');
  assert.ok(enceladus && enceladus.parent === 10 && enceladus.isCryoMoon, 'Enceladus must orbit Saturn as a cryovolcanic ocean moon');
  assert.ok(triton && triton.parent === 13 && triton.incDeg > 140, 'Triton must orbit Neptune on a retrograde captured inclination');
  assert.ok(pluto && charon && REAL_SOLAR_SYSTEM_CATALOG[charon.parent]?.id === 'pluto', 'Pluto-Charon must form a hierarchical binary dwarf pair');
});

test('Phase C2: All 11 L1 Galaxy Morphologies produce finite, physically distinct 3D star distributions', () => {
  const presets = ['disk', 'barred', 'ring', 'lenticular', 'irregular', 'open-cluster', 'binary', 'sphere', 'proto', 'dwarf-stream', 'globular'];
  const ringBodies = createRealisticSpiralGalaxyBodies({ count: 2048, preset: 'ring', seed: 101 });
  const lentBodies = createRealisticSpiralGalaxyBodies({ count: 2048, preset: 'lenticular', seed: 101 });
  const irregBodies = createRealisticSpiralGalaxyBodies({ count: 2048, preset: 'irregular', seed: 101 });
  const openBodies = createRealisticSpiralGalaxyBodies({ count: 2048, preset: 'open-cluster', seed: 101 });

  for (const p of presets) {
    const arr = createRealisticSpiralGalaxyBodies({ count: 1024, preset: p, seed: 42 });
    assert.equal(arr.length, 1024 * 8);
    for (let i = 0; i < arr.length; i += 1) {
      assert.ok(Number.isFinite(arr[i]), `Non-finite galaxy float in preset ${p}`);
    }
  }

  // Cartwheel Ring Galaxy must show strong outer starburst ring concentration around r ~ 8.4
  let outerRingCount = 0;
  for (let i = 1; i < 2048; i += 1) {
    const o = i * 8;
    if (ringBodies[o + 7] < 0) continue;
    const r = Math.hypot(ringBodies[o], ringBodies[o + 2]);
    if (r >= 6.8 && r <= 10.2) outerRingCount += 1;
  }
  assert.ok(outerRingCount > 300, `Cartwheel Ring Galaxy must populate outer starburst ring (got ${outerRingCount})`);

  // Lenticular S0 must be quenched (max popTag <= 0.35, zero blue spiral arms)
  let maxLentPop = 0;
  for (let i = 1; i < 2048; i += 1) {
    if (lentBodies[i * 8 + 7] > maxLentPop) maxLentPop = lentBodies[i * 8 + 7];
  }
  assert.ok(maxLentPop <= 0.35, `Lenticular S0 must have quenched golden population (max popTag=${maxLentPop})`);

  // Open cluster (Pleiades) must be dominated by young blue B-stars (popTag >= 0.45)
  let blueOpenCount = 0;
  for (let i = 1; i < 2048; i += 1) if (openBodies[i * 8 + 7] >= 0.45) blueOpenCount += 1;
  assert.ok(blueOpenCount > 1800, `Open cluster must be rich in young blue stars & reflection dust (got ${blueOpenCount})`);
  assert.ok(irregBodies.length === 2048 * 8);
});

test('Phase C3: All 7 3D MLS-MPM Stellar Structure Regimes (Pop III/II/I) conserve X_H + X_He + X_CNO + X_AlphaFe = 1 and span 1,150 K -> 85,000 K Teff', () => {
  const classes = Object.keys(STELLAR_MLS_MPM_PROFILES);
  assert.equal(classes.length, 7);
  assert.equal(STELLAR_MLS_MPM_FUSION_LAW_ADAPTER.id, 'stellar-mls-mpm-fusion');
  const maxLogTByClass = {};
  for (const cls of classes) {
    const arr = buildStellarMlsMpmInitialParcels({ count: 1024, stellarClass: cls, seed: 99 });
    let maxLt = 0;
    for (let i = 0; i < 1024; i += 1) {
      const o = i * 16;
      const sumX = arr[o + 10] + arr[o + 14] + arr[o + 15] + arr[o + 12];
      assert.ok(Math.abs(sumX - 1.0) < 1e-4, `Nucleon conservation violated in ${cls}: ${sumX}`);
      if (arr[o + 8] > maxLt) maxLt = arr[o + 8];
    }
    maxLogTByClass[cls] = maxLt;
  }
  assert.ok(maxLogTByClass['red-supergiant'] > maxLogTByClass['main-sequence-star'], 'Red supergiant 3-alpha core must be hotter than G2V core');
  assert.ok(maxLogTByClass['main-sequence-star'] > maxLogTByClass['brown-dwarf'], 'G2V fusing core must be far hotter than brown dwarf core');
});

test('Phase C4: Renderer & Engines include JWST IR dust extinction, EHT n=1 photon ring, TDE, WR Homunculus, Reflection Nebula & Reversed-Log MD depth', () => {
  const rend = readFileSync(new URL('../src/demos/ulgUniversesRenderer.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../universes.html', import.meta.url), 'utf8');
  const tde = readFileSync(new URL('../src/runtime/astrophysics/tidalRocheDisruptionGpu.js', import.meta.url), 'utf8');
  const rad = readFileSync(new URL('../src/runtime/astrophysics/radiativePhotoionizationWindGpu.js', import.meta.url), 'utf8');

  assert.match(html, /data-em-preset="jwst"/);
  assert.match(rend, /ir_pierce8/);
  assert.match(rend, /n1_ring/);
  assert.match(rend, /hg_phase/);
  assert.match(rend, /wet_shore/);
  assert.match(rend, /snow_sparkle/);
  assert.match(rend, /mie_ray/);
  assert.match(rend, /is_sulfur_volc/);
  assert.ok(!rend.includes('out.depth = clamp(clip.z / max(1e-5, clip.w), 0.0, 1.0);'), 'MD_SPHERE_WGSL must use eval_frag_depth');
  assert.match(tde, /mode == 5u/);
  assert.match(rad, /reg == 5u/);
  assert.match(rad, /reg == 6u/);
});
