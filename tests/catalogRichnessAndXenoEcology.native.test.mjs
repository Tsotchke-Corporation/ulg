// Native Vulkan Hand-Driven Visual QA/QC/LOD Verification Suite for Phase B & Phase C:
//   - Captures real Vulkan WebGPU PNGs of ALL new astronomical catalog additions:
//     L1 Cartwheel Ring, S0 Lenticular, Starburst Irregular, Pleiades M45 Open Cluster;
//     L2 TDE + EHT n=1 Photon Ring, Uranus 97.8 deg vertical rings;
//     L3 Hubble Optical vs JWST IR Pillars of Creation pair (verifying IR dust piercing!),
//        Wolf-Rayet / Eta Carinae Bipolar Homunculus, Reflection Nebula, Betelgeuse RSG & O/B Blue MLS-MPM;
//     Gas Giant Cloud Deck Aero-Gasbag Sky-Leviathans;
//     Bio Lab Interactive Specimen Aquarium (Fauna calm -> Probe + Heat reaction -> Fungus spore burst!).

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = (process.env.ULG_DEV_URL || process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173').replace(/\/$/, '');
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_PHASEC_SHOT_DIR || '';

test('Phase B & C Hand-Driven Astronomical Catalog, JWST IR Dust Piercing, Alien Biospheres & Bio-Lab Aquarium (Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Phase B/C visual verification',
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
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
      '--renderer-process-limit=2'
    ]
  });

  const saveSnap = async (page, name, expr = 'window.__ulgUniversesDemo.capturePng()') => {
    const dataUrl = await page.evaluate(expr);
    const buf = Buffer.from(String(dataUrl || '').split(',')[1] || '', 'base64');
    if (name && SHOT_DIR && buf.length > 64) {
      await writeFile(path.join(SHOT_DIR, `${name}.png`), buf);
    }
    return buf;
  };

  const pageErrors = [];
  const consoleErrors = [];

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1360, height: 820 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });

    // ---- 1. L1 New Galaxy Catalog Morphologies (Cartwheel Ring, S0 Lenticular, Irregular, Open Cluster) ----
    await page.goto(`${BASE_URL}/universes.html?level=1&quality=med`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setGalaxyPreset('ring');
      for (let i = 0; i < 4; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const fRing = await saveSnap(page, 'c01-l1-cartwheel-ring');

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setGalaxyPreset('lenticular');
      for (let i = 0; i < 3; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const fLent = await saveSnap(page, 'c02-l1-lenticular-s0');

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setGalaxyPreset('irregular');
      for (let i = 0; i < 3; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await saveSnap(page, 'c03-l1-starburst-irregular');

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setGalaxyPreset('open-cluster');
      for (let i = 0; i < 3; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await saveSnap(page, 'c04-l1-open-cluster-pleiades');

    assert.ok(comparePhysicalPixelPngFrames(fRing, fLent).changedPixelCount > 25_000,
      'Cartwheel Ring and S0 Lenticular galaxies must render visually distinct morphologies');

    // ---- 2. L2 Tidal Disruption Event (TDE) + EHT n=1 Photon Ring & Uranus Vertical Rings ----
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setLevel(2, { instant: true });
      await window.__ulgUniversesDemo.setSolarMode('tde');
      for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await saveSnap(page, 'c05-l2-tde-smbh-photon-ring');

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setSolarMode('nbody');
      await window.__ulgUniversesDemo.setUseSolReference(true);
      await window.__ulgUniversesDemo.setLevel(4, { instant: true });
      await window.__ulgUniversesDemo.focusSolarBody('uranus');
      for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await saveSnap(page, 'c06-l4-uranus-vertical-rings');

    // ---- 3. L3 Nebulae: Hubble Optical vs JWST IR Pillars of Creation Pair + WR Homunculus + Reflection Nebula ----
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setLevel(3, { instant: true });
      await window.__ulgUniversesDemo.setEmSensorPreset('vis');
      await window.__ulgUniversesDemo.setStellarMode('h2-pillars');
      for (let i = 0; i < 5; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const fPillarsVis = await saveSnap(page, 'c07-l3-pillars-hubble-optical');

    await page.evaluate(() => {
      window.__ulgUniversesDemo.setEmSensorPreset('jwst');
    });
    const fPillarsJwst = await saveSnap(page, 'c08-l3-pillars-jwst-ir');
    const jwstDiff = comparePhysicalPixelPngFrames(fPillarsVis, fPillarsJwst);
    assert.ok(jwstDiff.changedPixelCount > 30_000,
      `Switching Hubble Optical -> JWST IR on H II Pillars must dramatically pierce dust & expose protostars (changed=${jwstDiff.changedPixelCount})`);

    await page.evaluate(async () => {
      window.__ulgUniversesDemo.setEmSensorPreset('vis');
      await window.__ulgUniversesDemo.setStellarMode('wr-bubble');
      for (let i = 0; i < 5; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await saveSnap(page, 'c09-l3-wr-eta-carinae-homunculus');

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setStellarMode('reflection-nebula');
      for (let i = 0; i < 5; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await saveSnap(page, 'c10-l3-reflection-nebula');

    // ---- 4. L3 Diverse 3D MLS-MPM Stellar Fusion Interiors (Betelgeuse RSG & O/B Blue Supergiant) ----
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setStellarPreset('red-supergiant');
      for (let i = 0; i < 5; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const fRsg = await saveSnap(page, 'c11-l3-betelgeuse-rsg-mlsmpm');

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setStellarPreset('blue-supergiant');
      for (let i = 0; i < 5; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const fBlue = await saveSnap(page, 'c12-l3-blue-supergiant-mlsmpm');
    assert.ok(comparePhysicalPixelPngFrames(fRsg, fBlue).changedPixelCount > 15_000,
      'Betelgeuse RSG and O/B Blue Supergiant MLS-MPM interiors must render distinct physical temperatures/spectra');

    // ---- 5. Gas Giant Cloud Deck Alien Biosphere (Aero-Gasbag Sky-Leviathans!) ----
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setUseSolReference(true);
      await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'jupiter', initialVehicle: 'ufo' });
      for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await saveSnap(page, 'c13-surface-jupiter-sky-leviathans');

    const stEndUv = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stEndUv.gpuErrorCount, 0, `Universes GPU errors: ${stEndUv.gpuErrors?.join('; ')}`);

    // ---- 6. Bio Lab Interactive Specimen Aquarium / Vivarium (Fauna Calm -> Probe + Heat -> Fungus Spore Burst!) ----
    await page.goto(`${BASE_URL}/life-lab.html?xeno=1&world=Proxima-b&T=296&P=185000&g=14.8&rho=2.1&solvent=H2O&teff=3150&uv=3.4&mode=organism-overview`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    await page.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.waitForTimeout(350);
    const stViv0 = await page.evaluate(() => window.__ulgLifeLab.getState());
    assert.equal(stViv0.mode, 'organism-overview', 'Bio Lab ?xeno=1 must open Organism Overview aquarium by default');
    assert.equal(stViv0.gpuErrorCount, 0, `Bio Lab GPU errors: ${stViv0.gpuErrors?.join('; ')}`);
    const fVivCalm = await saveSnap(page, 'c14-biolab-vivarium-fauna-calm', 'window.__ulgLifeLab.capturePng()');

    // Interactive Probe + Heat directly on the alien creature!
    const reactRes = await page.evaluate(async () => {
      const r1 = window.__ulgLifeLab.interactVivarium('probe');
      const r2 = window.__ulgLifeLab.interactVivarium('heat');
      await window.__ulgLifeLab.stepNow(8);
      return { r1, r2, state: window.__ulgLifeLab.getState() };
    });
    assert.ok(reactRes.r1?.reactionText?.length > 10, 'Probing creature must trigger reaction');
    assert.ok(reactRes.r2?.localTempK > 315, `Heating creature must raise local tissue temp (got ${reactRes.r2?.localTempK})`);
    const fVivHeat = await saveSnap(page, 'c15-biolab-vivarium-fauna-probed-heated', 'window.__ulgLifeLab.capturePng()');
    assert.ok(comparePhysicalPixelPngFrames(fVivCalm, fVivHeat).changedPixelCount > 8_000,
      'Probing & heating organism in Vivarium must visibly transform posture/beam FX/particles');

    // Switch to alien Fungus & trigger glowing spore cloud eruption!
    await page.evaluate(async () => {
      const st = window.__ulgLifeLab.getState();
      const idx = (st.xenobiology?.species || []).findIndex((s) => s.kingdom === 'fungi');
      if (idx >= 0) await window.__ulgLifeLab.selectVivariumSpecies(idx);
      window.__ulgLifeLab.interactVivarium('probe');
      await window.__ulgLifeLab.stepNow(8);
    });
    await saveSnap(page, 'c16-biolab-vivarium-fungi-spore-burst', 'window.__ulgLifeLab.capturePng()');

    const stEndLife = await page.evaluate(() => window.__ulgLifeLab.getState());
    assert.equal(stEndLife.gpuErrorCount, 0, `Life Lab end GPU errors: ${stEndLife.gpuErrors?.join('; ')}`);
    assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});
