import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

// Multi-frame "Sit Through & Watch Every Scale & Every Top-Down Law Play Out" Vulkan Proof
// Captures sequential evolution frames across ALL 8 scales + all new top-down law modes
// (2LPT Cosmic Web, Spiral Galaxy, Real-Scale N-Body + Earth/Moon + Saturn, Protoplanetary
// Accretion Disk + Particle-Rigid Planetesimals, Stellar Fusion, 3D Resistive MHD Nebular
// Collapse & Bipolar Jets, Earth Baroclinic Clouds/Lightning/Aurorae, Mars Dust Storm
// Paschen Discharges, Jupiter Coriolis Bands, Airless Moon Dynamic-Dormancy Proof,
// Solid->Melt MD, 4-comp Dirac-KS Atom, & 3D Quantized Nucleus) into `ULG_WATCH_SHOT_DIR`
// so every frame can be visually inspected and critiqued!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_WATCH_SHOT_DIR || '';

test('ULG Universes Watch & Critique: multi-frame evolution across all 8 scales & dynamic top-down law modes', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan multi-frame watch',
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

  const snap = async (page, name) => {
    const dataUrl = await page.evaluate(() => window.__ulgUniversesDemo.capturePng());
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    if (SHOT_DIR) await writeFile(path.join(SHOT_DIR, `${name}.png`), buf);
    return buf;
  };

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

    // 1. L0: 2LPT Cosmic Web (t0 -> t1)
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.cosmicWebSteps ?? 0) >= 8, null, { timeout: 45_000 });
    const l0t0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fL0a = await snap(page, '01-L0-cosmic-t0');
    await page.waitForFunction((p) => (window.__ulgUniversesDemo?.getState?.()?.cosmicWebSteps ?? 0) >= p + 18, l0t0.cosmicWebSteps, { timeout: 45_000 });
    const l0t1 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fL0b = await snap(page, '02-L0-cosmic-t1');
    const l0Delta = comparePhysicalPixelPngFrames(fL0a, fL0b);
    assert.equal(l0Delta.visibleContentAdvanced, true, 'L0 Cosmic Web must visibly evolve');
    report.L0 = { steps: [l0t0.cosmicWebSteps, l0t1.cosmicWebSteps], changedPx: l0Delta.changedPixelCount, sigma: l0t1.sigmaDensity };

    // 2. Continuous Crossfade L0 -> L1 (`log10Span = 22.1`)
    await page.evaluate(() => window.__ulgUniversesDemo.setLog10Span(22.1));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.galacticSteps ?? 0) >= 4, null, { timeout: 45_000 });
    await snap(page, '03-Xfade-L0-L1');

    // 3. L1: Flat-Rotation Spiral Galaxy (t0 -> t1)
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(1, { instant: true }));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.galacticSteps ?? 0) >= 8, null, { timeout: 45_000 });
    const l1t0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fL1a = await snap(page, '04-L1-galaxy-t0');
    await page.waitForFunction((p) => (window.__ulgUniversesDemo?.getState?.()?.galacticSteps ?? 0) >= p + 24, l1t0.galacticSteps, { timeout: 45_000 });
    const l1t1 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fL1b = await snap(page, '05-L1-galaxy-t1');
    const l1Delta = comparePhysicalPixelPngFrames(fL1a, fL1b);
    assert.equal(l1Delta.visibleContentAdvanced, true, 'L1 Spiral Galaxy must visibly rotate');
    report.L1 = { steps: [l1t0.galacticSteps, l1t1.galacticSteps], changedPx: l1Delta.changedPixelCount };

    // 4. L2A: Real-Scale Double-Float Symplectic Solar System (full, Earth+Moon, Saturn+Rings)
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(2, { instant: true }));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.planetarySteps ?? 0) >= 24, null, { timeout: 45_000 });
    const l2Full = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    await snap(page, '06-L2A-solar-full');

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.focusSolarBody('earth');
      await window.__ulgUniversesDemo.setLog10Span(9.02);
    });
    await page.waitForTimeout(300);
    await snap(page, '07-L2A-earth-moon-closeup');

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setLevel(4, { instant: true });
      await window.__ulgUniversesDemo.focusSolarBody('saturn');
    });
    await page.waitForTimeout(350);
    await snap(page, '08-L2A-saturn-rings');

    // 5. L2B: Protoplanetary Accretion Disk + Snow Line + DLM Particle-Rigid Planetesimals (t0 -> t1)
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setLevel(2, { instant: true });
      await window.__ulgUniversesDemo.setSolarMode('formation');
    });
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.protoplanetarySteps ?? 0) >= 6, null, { timeout: 45_000 });
    const disk0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fDiskA = await snap(page, '09-L2B-disk-t0');
    await page.waitForFunction((p) => (window.__ulgUniversesDemo?.getState?.()?.protoplanetarySteps ?? 0) >= p + 24, disk0.protoplanetarySteps, { timeout: 45_000 });
    const disk1 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fDiskB = await snap(page, '10-L2B-disk-t1');
    const diskDelta = comparePhysicalPixelPngFrames(fDiskA, fDiskB);
    assert.equal(diskDelta.visibleContentAdvanced, true, 'L2B Protoplanetary disk must visibly orbit & accrete');
    report.L2B_disk = { steps: [disk0.protoplanetarySteps, disk1.protoplanetarySteps], accreted: disk1.protoplanetaryAccreted, changedPx: diskDelta.changedPixelCount };
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('nbody'));

    // 6. L3A: Stellar Core Fusion (`self-gravitating-hydro@1` + Coronal Magnetic Loops, t0 -> t1)
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setLevel(3, { instant: true });
      await window.__ulgUniversesDemo.setStellarMode('fusion');
    });
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.stellarSteps ?? 0) >= 5, null, { timeout: 60_000 });
    const st0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fStA = await snap(page, '11-L3A-stellar-fusion-t0');
    await page.waitForFunction((p) => (window.__ulgUniversesDemo?.getState?.()?.stellarSteps ?? 0) >= p + 14, st0.stellarSteps, { timeout: 60_000 });
    const st1 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fStB = await snap(page, '12-L3A-stellar-fusion-t1');
    const stDelta = comparePhysicalPixelPngFrames(fStA, fStB);
    assert.equal(stDelta.visibleContentAdvanced, true, 'L3A Stellar Fusion must visibly evolve');
    report.L3A_fusion = { steps: [st0.stellarSteps, st1.stellarSteps], coreTempK: st1.stellarCoreTempK, changedPx: stDelta.changedPixelCount };

    // 7. L3B: 3D Resistive MHD Nebular Collapse & Bipolar Jets (`B0 = 0.65`, t0 -> t1)
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setStellarMode('nebular-mhd');
      await window.__ulgUniversesDemo.setNebulaB0(0.65);
    });
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.nebulaMhdSteps ?? 0) >= 10, null, { timeout: 60_000 });
    const neb0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fNebA = await snap(page, '13-L3B-nebula-mhd-t0');
    await page.waitForFunction((p) => (window.__ulgUniversesDemo?.getState?.()?.nebulaMhdSteps ?? 0) >= p + 40, neb0.nebulaMhdSteps, { timeout: 60_000 });
    const neb1 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fNebB = await snap(page, '14-L3B-nebula-mhd-t1');
    const nebDelta = comparePhysicalPixelPngFrames(fNebA, fNebB);
    assert.equal(nebDelta.visibleContentAdvanced, true, 'L3B MHD Nebula must visibly collapse & wind B-field');
    report.L3B_mhd = {
      steps: [neb0.nebulaMhdSteps, neb1.nebulaMhdSteps],
      magE: [neb0.nebulaMhdMagneticEnergy, neb1.nebulaMhdMagneticEnergy],
      torB: [neb0.nebulaMhdPeakToroidalB, neb1.nebulaMhdPeakToroidalB],
      changedPx: nebDelta.changedPixelCount
    };

    // 8. L4A: Earth (Sunlit + Live Baroclinic Clouds + Moist Thundercloud Lightning + Polar Aurorae!)
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setLevel(4, { instant: true });
      await window.__ulgUniversesDemo.focusSolarBody('earth');
    });
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.planetaryAtmoSteps ?? 0) >= 12, null, { timeout: 45_000 });
    const earth0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(earth0.planetaryAtmoActive, true);
    const fEarthA = await snap(page, '15-L4A-earth-atmo-em-t0');
    await page.waitForFunction((p) => (window.__ulgUniversesDemo?.getState?.()?.planetaryAtmoSteps ?? 0) >= p + 20, earth0.planetaryAtmoSteps, { timeout: 45_000 });
    const earth1 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fEarthB = await snap(page, '16-L4A-earth-atmo-em-t1');
    const earthDelta = comparePhysicalPixelPngFrames(fEarthA, fEarthB);
    assert.equal(earthDelta.visibleContentAdvanced, true, 'L4A Earth baroclinic clouds/lightning/aurorae must visibly evolve');
    report.L4A_earth = {
      steps: [earth0.planetaryAtmoSteps, earth1.planetaryAtmoSteps],
      lightningCells: earth1.planetaryLightningCells,
      peakE: earth1.planetaryPeakElectricVPerM,
      laws: earth1.activeUniversalLaws,
      changedPx: earthDelta.changedPixelCount
    };

    // 9. L4B: Mars (Live Dust Storm + Low-Pressure CO2 Paschen Discharges!)
    await page.evaluate(() => window.__ulgUniversesDemo.focusSolarBody('mars'));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.planetaryAtmoSteps ?? 0) >= 12, null, { timeout: 45_000 });
    const mars0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(mars0.planetaryAtmoActive, true);
    const fMarsA = await snap(page, '17-L4B-mars-dust-em-t0');
    await page.waitForFunction((p) => (window.__ulgUniversesDemo?.getState?.()?.planetaryAtmoSteps ?? 0) >= p + 20, mars0.planetaryAtmoSteps, { timeout: 45_000 });
    const mars1 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const fMarsB = await snap(page, '18-L4B-mars-dust-em-t1');
    const marsDelta = comparePhysicalPixelPngFrames(fMarsA, fMarsB);
    assert.equal(marsDelta.visibleContentAdvanced, true, 'L4B Mars dust storm & discharges must visibly evolve');
    report.L4B_mars = {
      steps: [mars0.planetaryAtmoSteps, mars1.planetaryAtmoSteps],
      lightningCells: mars1.planetaryLightningCells,
      laws: mars1.activeUniversalLaws,
      changedPx: marsDelta.changedPixelCount
    };

    // 10. L4C: Jupiter (Coriolis Zonal Bands + Geodynamo Aurorae)
    await page.evaluate(() => window.__ulgUniversesDemo.focusSolarBody('jupiter'));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.planetaryAtmoSteps ?? 0) >= 12, null, { timeout: 45_000 });
    const jup1 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    await snap(page, '19-L4C-jupiter-bands');
    report.L4C_jupiter = { span: jup1.log10ViewSpanM, atmoActive: jup1.planetaryAtmoActive, laws: jup1.activeUniversalLaws };

    // 11. L4D: Earth 3D Interior Cutaway (Inline WGSL Polytope Atlas)
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.focusSolarBody('earth');
      window.__ulgUniversesDemo.setPlanetaryCutaway(true);
    });
    await page.waitForTimeout(300);
    await snap(page, '20-L4D-earth-cutaway');
    await page.evaluate(() => window.__ulgUniversesDemo.setPlanetaryCutaway(false));

    // 12. L4E: Moon (Airless Vacuum Body — Dynamic Law Graph keeps Atmosphere & EM Laws Dormant!)
    await page.evaluate(() => window.__ulgUniversesDemo.focusSolarBody('moon'));
    await page.waitForTimeout(350);
    const moonSt = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(moonSt.planetaryAtmoActive, false, 'Airless Moon must keep spherical atmosphere/EM law dormant (0 dispatches)!');
    await snap(page, '21-L4E-moon-vacuum');
    report.L4E_moon = { atmoActive: moonSt.planetaryAtmoActive, laws: moonSt.activeUniversalLaws };

    // 13. L5: Crystal Solid -> Melted Fluid WebGPU MD
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(5, { instant: true }));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.mdSteps ?? 0) >= 8, null, { timeout: 45_000 });
    const fMdSolid = await snap(page, '22-L5-md-solid');
    await page.evaluate(() => window.__ulgUniversesDemo.setMdPhase('melt'));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.mdSteps ?? 0) >= 18, null, { timeout: 45_000 });
    const fMdMelt = await snap(page, '23-L5-md-melt');
    const mdDelta = comparePhysicalPixelPngFrames(fMdSolid, fMdMelt);
    assert.equal(mdDelta.visibleContentAdvanced, true, 'L5 MD solid -> melt transition must visibly evolve');
    report.L5_md = { changedPx: mdDelta.changedPixelCount };

    // 14. L6: Relativistic 4-Component Dirac-KS Atom
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(6, { instant: true }));
    await page.waitForTimeout(450);
    await snap(page, '24-L6-quantum-atom');

    // 15. L7: 3D Quantized Spherical Atomic Nucleus + Live Visscher TDSE
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(7, { instant: true }));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.tdseSteps ?? 0) >= 16, null, { timeout: 45_000 });
    await snap(page, '25-L7-atomic-nucleus');

    const finalSt = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(finalSt.gpuErrorCount, 0, `gpuErrors: ${finalSt.gpuErrors.join('; ')}`);
    assert.deepEqual(pageErrors, [], `pageErrors: ${pageErrors.join('; ')}`);
    assert.deepEqual(consoleErrors, [], `consoleErrors: ${consoleErrors.join('; ')}`);

    console.log('ULG Universes Watch & Critique Report:', JSON.stringify({
      l2EnergyDrift: l2Full.solarRelEnergyDrift,
      l2EarthSunRatio: l2Full.earthToSunRadiusRatio,
      ...report
    }));
    await ctx.close();
  } finally {
    await browser.close();
  }
});
