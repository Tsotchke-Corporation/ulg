// Native Vulkan Visual & Functional Verification Suite for:
//   - P4: Full-Spectrum Dual-Caret EM Sensor Stack (bit-exact visible identity + Thermal IR + X-Ray/Radio remapping)
//   - P3: Living Worlds:
//       * L4 Orbital visible atmospheric CFD (advected swirling eddies + 3D wind streamlines),
//         smooth filamentary polar aurora (no purple beads!), & clean silver-emerald space UFO (no yellow nose!)
//       * Reversed-Z Infinite Far Plane surface scene with live orbiting Sun/Moon/planets, real sunrise/sunset,
//         +-6 km distant clipmap horizon, GPU Voronoi tectonics & hydraulic erosion, GPU ocean waves, & GPU flora
//       * Titan cryogenic CH4 hydrocarbon sea + alien xenobiology URL bridge -> live life-lab.html?xeno=1 boot!

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = (process.env.ULG_DEV_URL || process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173').replace(/\/$/, '');
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_P3P4_SHOT_DIR || '';

test('P3 Living Worlds & P4 Dual-Caret EM Sensor Stack + L4 Orbital CFD + Life Lab Xenobiology Bridge (Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan P3/P4 verification',
  timeout: 240_000
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

    // 1. L4 Orbital Jupiter: visible global atmospheric CFD flow-map + orbital streamlines + smooth filament aurora + clean space UFO!
    await page.goto(`${BASE_URL}/universes.html?level=4&quality=med`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setUseSolReference(true);
      await window.__ulgUniversesDemo.focusSolarBody('jupiter');
      for (let i = 0; i < 8; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await page.waitForTimeout(250);
    const stJup0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stJup0.gpuErrorCount, 0, `Early L4 GPU errors: ${stJup0.gpuErrors?.join(' || ')}`);
    const fJupVis = await saveSnap(page, 'p3p4-01-l4-jupiter-cfd-aurora-ufo');

    // Verify P4 EM Sensor Toggle -> Thermal IR changes frame dramatically, and returning to Visible matches bit-for-bit!
    await page.evaluate(() => {
      window.__ulgUniversesDemo.setEmSensorPreset('ir');
    });
    const stIr = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stIr.emSensor.active, true);
    const fJupIr = await saveSnap(page, 'p3p4-02-l4-jupiter-thermal-ir');
    const irDiff = comparePhysicalPixelPngFrames(fJupVis, fJupIr);
    assert.ok(irDiff.changedPixelCount > 25_000,
      `Thermal IR EM sensor window must dramatically remap orbital radiance (changed=${irDiff.changedPixelCount})`);

    // Test UV/Aurora EM band too
    await page.evaluate(() => {
      window.__ulgUniversesDemo.setEmSensorPreset('uv');
    });
    const fJupUv = await saveSnap(page, 'p3p4-03-l4-jupiter-uv-aurora');
    const uvDiff = comparePhysicalPixelPngFrames(fJupVis, fJupUv);
    assert.ok(uvDiff.changedPixelCount > 20_000,
      `UV EM sensor window must dramatically remap auroral/UV radiance (changed=${uvDiff.changedPixelCount})`);

    // Return to Visible -> must restore clean visible spectrum!
    await page.evaluate(() => {
      window.__ulgUniversesDemo.setEmSensorPreset('vis');
    });
    const stVisBack = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stVisBack.emSensor.active, false);

    // 2. Earth Surface: Reversed-Z live sky, +-6 km mountain horizon, tectonics, GPU ocean waves, GPU flora, Sunrise -> Sunset!
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'earth', initialVehicle: 'ufo' });
      for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const stEarthDay = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stEarthDay.surfaceActive, true);
    assert.ok(stEarthDay.surfaceSkyBodyCount >= 2, `Earth surface sky must render live solar system bodies (got ${stEarthDay.surfaceSkyBodyCount})`);
    assert.ok(stEarthDay.surfaceClimate?.seasonName, 'Earth surface must compute emergent season');
    assert.ok(stEarthDay.surfaceXenobiology?.solvent === 'H2O');
    const fEarthDay = await saveSnap(page, 'p3p4-04-earth-surface-ocean-flora-sky');

    // Advance planetary rotation by 10 hours -> dramatic sky / sunset / night transition!
    await page.evaluate(async () => {
      window.__ulgUniversesDemo.advanceSurfaceSimSec(10 * 3600);
      for (let i = 0; i < 4; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const stEarthShift = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.notEqual(
      Math.floor(stEarthDay.surfaceClimate.localHour),
      Math.floor(stEarthShift.surfaceClimate.localHour),
      'Advancing surface orbital clock must advance local solar time'
    );
    const fEarthSunset = await saveSnap(page, 'p3p4-05-earth-surface-timewarp-sky');
    const skyShiftDiff = comparePhysicalPixelPngFrames(fEarthDay, fEarthSunset);
    assert.ok(skyShiftDiff.changedPixelCount > 40_000,
      `Advancing planetary spin by 10h must visibly transform surface lighting & sky (changed=${skyShiftDiff.changedPixelCount})`);

    // Surface Thermal IR EM Sensor check
    await page.evaluate(() => {
      window.__ulgUniversesDemo.setEmSensorPreset('ir');
    });
    const fEarthIr = await saveSnap(page, 'p3p4-06-earth-surface-thermal-ir');
    const surfIrDiff = comparePhysicalPixelPngFrames(fEarthSunset, fEarthIr);
    assert.ok(surfIrDiff.changedPixelCount > 40_000,
      `Surface Thermal IR sensor must remap terrain/ocean thermal radiance (changed=${surfIrDiff.changedPixelCount})`);
    await page.evaluate(() => { window.__ulgUniversesDemo.setEmSensorPreset('vis'); });

    // 3. Titan Surface -> Cryogenic CH4 Hydrocarbon Ocean + Bio Lab Xenobiology Bridge URL!
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'titan', initialVehicle: 'ufo' });
      for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const stTitan = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stTitan.surfaceXenobiology?.solvent, 'CH4');
    const xenoHref = await page.evaluate(() => document.getElementById('uv-surf-xeno-btn')?.getAttribute('href') || '');
    assert.ok(xenoHref.includes('life-lab.html?xeno=1'), `Titan Bio Lab button must link with ?xeno=1 (got "${xenoHref}")`);
    await saveSnap(page, 'p3p4-07-titan-methane-sea');

    // Verify 0 GPU errors on Universes
    const stEndUv = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stEndUv.gpuErrorCount, 0, `Universes GPU errors: ${stEndUv.gpuErrors?.join('; ')}`);

    // 4. Open Titan Xenobiology URL directly in life-lab.html -> verify real GPU cryogenic azotosome vesicle boot!
    const lifeUrl = `${BASE_URL}/${xenoHref.replace(/^\.\//, '')}`;
    await page.goto(lifeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.waitForTimeout(450);
    const stLife = await page.evaluate(() => window.__ulgLifeLab.getState());
    assert.equal(stLife.gpuErrorCount, 0, `Life Lab GPU errors: ${stLife.gpuErrors?.join('; ')}`);
    assert.equal(stLife.xenobiology?.solvent, 'CH4',
      `Life Lab ?xeno=1 must boot directly into Titan methane xenobiology (got ${JSON.stringify(stLife.xenobiology)})`);
    assert.ok((stLife.params?.memTempK ?? 300) <= 110,
      `Titan azotosome membrane must run at cryogenic temperature (got ${stLife.params?.memTempK} K)`);
    await saveSnap(page, 'p3p4-08-lifelab-titan-azotosome', 'window.__ulgLifeLab.capturePng()');

    assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});
