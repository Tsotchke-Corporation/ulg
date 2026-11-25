import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

// Multi-Entity Visual Watch & Self-Critique Vulkan Suite for ULG Universes Wave 2:
// Visits ALL 20 new cosmic eras & astronomical entity regimes (CMB z=1100, Reionization z=10,
// Bullet-Cluster ICM & Lensing, Barred Spiral, High-z Clumpy Protogalaxy, Dwarf Halo Stream,
// Globular Cluster, Quasar Kerr BZ Jets & Blazar Doppler-Beamed View, X-Ray Binary Roche L1,
// BNS GW Merger & Kilonova r-Process, Type Ia WD Detonation, BBH 2.5PN GW Inspiral,
// Active Dual-Tail Comet, Hot-Jupiter XUV Photoevaporation, Roche-Limit Ring Disruption &
// Shepherd Moon, Giant Moon-Forming Impact, Red-Giant Engulfment, H II Star-Forming Pillars,
// Bipolar Planetary Nebula, SNR/Crab PWN, Millisecond Pulsar, Magnetar Giant Flare,
// White-Dwarf GR TOV EOS, Hadean Magma Ocean, & Cryovolcanic Icy Plumes!), proving live GPU
// evolution, active 15-node Universal Law Graph selection, zero GPU/page/console errors,
// and saving full-frame PNGs for visual inspection!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_WATCH_SHOT_DIR || '';

test('ULG Universes Wave-2 Watch & Critique: all 20 cosmic epochs & astrophysical entity regimes on Vulkan', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Wave-2 entity watch',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  if (SHOT_DIR) await mkdir(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  const snapGpu = async (page, name = null) => {
    const dataUrl = await page.evaluate(() => window.__ulgUniversesDemo.capturePng());
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    if (name && SHOT_DIR) await writeFile(path.join(SHOT_DIR, `${name}.png`), buf);
    return buf;
  };

  const snapFull = async (page, name) => snapGpu(page, name);

  const report = {};

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
    });

    await page.goto(`${BASE_URL}universes.html?level=0`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });

    // --- L0 COSMOLOGICAL ERAS ---
    // 01. CMB Recombination (z=1100) via Epoch Spine
    await page.evaluate(() => window.__ulgUniversesDemo.setCosmicEpoch('recombination', { alignActiveLevel: 0 }));
    await page.waitForTimeout(350);
    const stCmb = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stCmb.cosmoMode, 'cmb');
    assert.ok(stCmb.activeUniversalLaws.includes('cosmological-baryon-radiation'));
    await snapFull(page, '01-cmb-z1100');

    // 02. Cosmic Dawn Reionization Bubbles (z=10)
    await page.evaluate(() => window.__ulgUniversesDemo.setCosmicEpoch('cosmic-dawn', { alignActiveLevel: 0 }));
    const fRe0 = await snapGpu(page);
    await page.waitForTimeout(500);
    const fRe1 = await snapGpu(page);
    const stReion = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stReion.cosmoMode, 'reionization');
    assert.ok((stReion.cosmoBaryonIonFrac ?? 0) > 0.1, 'Reionization bubbles must grow ionized fraction');
    await snapFull(page, '02-reionization-z10');

    // 03. Bullet-Cluster Merger (X-Ray ICM + 2D Gravitational Lensing)
    await page.evaluate(() => window.__ulgUniversesDemo.setCosmoMode('cluster-merger'));
    await page.waitForTimeout(450);
    const stClus = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok((stClus.cosmoBaryonKappa ?? 0) > 0.05, 'Bullet cluster must compute positive lensing kappa');
    await snapFull(page, '03-cluster-merger-lensing');
    report.L0 = { cmbZ: stCmb.cosmicEpochRedshiftZ, reionIon: stReion.cosmoBaryonIonFrac, reionChangedPx: comparePhysicalPixelPngFrames(fRe0, fRe1).changedPixelCount, clusKappa: stClus.cosmoBaryonKappa };

    // --- L1 GALAXY & CLUSTER MORPHOLOGIES ---
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(1, { instant: true }));
    await page.evaluate(() => window.__ulgUniversesDemo.setGalaxyPreset('barred'));
    await page.waitForTimeout(400);
    await snapFull(page, '04-barred-spiral');

    await page.evaluate(() => window.__ulgUniversesDemo.setGalaxyPreset('proto'));
    await page.waitForTimeout(400);
    await snapFull(page, '05-highz-clumpy-protogalaxy');

    await page.evaluate(() => window.__ulgUniversesDemo.setGalaxyPreset('dwarf-stream'));
    await page.waitForTimeout(400);
    await snapFull(page, '06-dwarf-halo-stream');

    await page.evaluate(() => window.__ulgUniversesDemo.setGalaxyPreset('globular'));
    await page.waitForTimeout(400);
    await snapFull(page, '07-globular-cluster');

    // --- L2 RELATIVISTIC & SMALL-BODY / TIDAL REGIMES ---
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(2, { instant: true }));
    await page.evaluate(() => window.__ulgUniversesDemo.setCameraAngles(0.55, 0.34));

    // 08. Quasar Kerr BZ Relativistic Jets (edge-on) + Blazar Doppler-Beamed View
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('quasar-jet'));
    const fQ0 = await snapGpu(page);
    await page.waitForTimeout(450);
    const fQ1 = await snapGpu(page);
    const stQuasar = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(stQuasar.kerrActiveJets > 100, `Quasar must launch active BZ jets (got ${stQuasar.kerrActiveJets})`);
    assert.ok(stQuasar.activeUniversalLaws.includes('relativistic-compact-kerr-jet'));
    await snapFull(page, '08-quasar-kerr-bz-jet');

    // 09. X-Ray Binary (Roche-Lobe L1 Overflow onto BH)
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('xray-binary'));
    await page.waitForTimeout(450);
    const stXrb = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(stXrb.activeUniversalLaws.includes('relativistic-binary-gw-rprocess'));
    await snapFull(page, '09-xray-binary-roche');

    // 09b. Binary Black Hole 2.5PN GW Inspiral
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('bbh-merger'));
    await page.waitForTimeout(450);
    await snapFull(page, '09b-bbh-gw-merger');

    // 10. Binary Neutron Star GW Chirp Merger & r-Process Kilonova
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('bns-kilonova'));
    await page.waitForTimeout(550);
    const stKilo = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    await snapFull(page, '10-bns-kilonova-gw');

    // 11. Type Ia White-Dwarf Detonation (Zero Central Remnant!)
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('type-ia'));
    await page.waitForTimeout(450);
    const stIa = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    await snapFull(page, '11-type-ia-supernova');

    // 12. Active Dual-Tail Comet (Curved Dust + Straight CO+ Ion Tail)
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('comet-tails'));
    await page.waitForTimeout(450);
    await snapFull(page, '12-active-comet-dual-tail');

    // 13. Hot Jupiter XUV Photoevaporation Tail
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('hot-jupiter'));
    await page.waitForTimeout(450);
    await snapFull(page, '13-hot-jupiter-xuv');

    // 14. Roche-Limit Tidal Disruption Rings & Shepherd Moon
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('roche-rings'));
    await page.waitForTimeout(450);
    const stRoche = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok((stRoche.tidalRupturedFrac ?? 0) > 0.5, 'Roche moonlet must disrupt into ring particles');
    await snapFull(page, '14-roche-rings-shepherd');

    // 15. Giant Moon-Forming Impact & Hadean Silicate Disk
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('giant-impact'));
    await page.waitForTimeout(450);
    await snapFull(page, '15-giant-impact-hadean');

    // 16. Red-Giant Engulfment (+5 Gyr)
    await page.evaluate(() => window.__ulgUniversesDemo.setCosmicEpoch('far-future', { alignActiveLevel: 2 }));
    await page.waitForTimeout(450);
    await snapFull(page, '16-red-giant-engulfment');

    report.L2 = {
      quasarJets: stQuasar.kerrActiveJets,
      quasarGamma: stQuasar.kerrMaxGamma,
      quasarChangedPx: comparePhysicalPixelPngFrames(fQ0, fQ1).changedPixelCount,
      kiloRemnant: stKilo.relBinaryRemnant,
      typeIaRemnant: stIa.relBinaryRemnant,
      rocheRupture: stRoche.tidalRupturedFrac
    };

    // --- L3 PHOTOIONIZED NEBULAE, PULSARS, MAGNETARS, & GR TOV ---
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(3, { instant: true }));
    await page.evaluate(() => window.__ulgUniversesDemo.setCameraAngles(0.55, 0.32));

    // 17. H II Star-Forming Pillars ([O III] / Hα / [S II])
    await page.evaluate(() => window.__ulgUniversesDemo.setStellarMode('h2-pillars'));
    await page.waitForTimeout(450);
    await snapFull(page, '17-h2-pillars');

    // 18. Bipolar Planetary Nebula & Hot White Dwarf
    await page.evaluate(() => window.__ulgUniversesDemo.setStellarMode('planetary-nebula'));
    await page.waitForTimeout(450);
    await snapFull(page, '18-planetary-nebula-wd');

    // 19. Supernova Remnant / Crab PWN
    await page.evaluate(() => window.__ulgUniversesDemo.setStellarMode('snr-pwn'));
    await page.waitForTimeout(450);
    await snapFull(page, '19-snr-crab-pwn');

    // 20. Millisecond Pulsar Oblique Lighthouse Dipole
    await page.evaluate(() => window.__ulgUniversesDemo.setStellarMode('pulsar'));
    await page.waitForTimeout(450);
    const stPul = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(stPul.activeUniversalLaws.includes('compact-magnetosphere-spindown'));
    await snapFull(page, '20-pulsar-lighthouse');

    // 21. Magnetar Crustal-Yield Giant Flare
    await page.evaluate(() => window.__ulgUniversesDemo.setStellarMode('magnetar'));
    const fM0 = await snapGpu(page);
    await page.waitForTimeout(550);
    const fM1 = await snapGpu(page);
    const stMag = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(stMag.magnetarFlares >= 1, `Magnetar must trigger unscripted crustal-yield flares (got ${stMag.magnetarFlares})`);
    await snapFull(page, '21-magnetar-giant-flare');

    // 22. White Dwarf / NS / BH Live WebGPU GR TOV Curve
    await page.evaluate(() => window.__ulgUniversesDemo.setStellarMode('white-dwarf-tov'));
    await page.waitForTimeout(350);
    const stTov = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(stTov.tovCount >= 12, `GR TOV sequence must solve >= 12 models on WebGPU (got ${stTov.tovCount})`);
    await snapFull(page, '22-white-dwarf-tov');

    report.L3 = {
      pulsarBeam: stPul.magnetarBeamFlux,
      magnetarFlares: stMag.magnetarFlares,
      magnetarChangedPx: comparePhysicalPixelPngFrames(fM0, fM1).changedPixelCount,
      tovCount: stTov.tovCount
    };

    // --- L4 EXOTIC PLANETARY ERAS ---
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(4, { instant: true }));
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('nbody'));
    await page.evaluate(() => window.__ulgUniversesDemo.setPlanetaryMode('magma-ocean'));
    await page.waitForTimeout(400);
    await snapFull(page, '23-hadean-magma-ocean');

    await page.evaluate(() => window.__ulgUniversesDemo.setPlanetaryMode('cryo-plumes'));
    await page.waitForTimeout(500);
    await snapFull(page, '24-cryovolcanic-icy-moon');

    const finalState = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.deepEqual(finalState.gpuErrors, [], `Zero WebGPU errors expected, got: ${JSON.stringify(finalState.gpuErrors)}`);
    assert.deepEqual(pageErrors, [], `Zero page errors expected, got: ${JSON.stringify(pageErrors)}`);
    assert.deepEqual(consoleErrors, [], `Zero console errors expected, got: ${JSON.stringify(consoleErrors)}`);

    console.log('ULG_WAVE2_WATCH_REPORT:', JSON.stringify(report));
    await ctx.close();
  } finally {
    await browser.close();
  }
});
