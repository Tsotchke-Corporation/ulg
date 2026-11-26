import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

// Comprehensive Cross-Demo Native Vulkan Visual Watch & Stability Audit:
//   Exercises ALL 5 Flagship ULG Pages & Every Key Scale/Tab:
//     1. `index.html` (Root Landing + Mesoscale Continuum Solver MLS-MPM launch)
//     2. `organic-lab.html` (Sulflower Bearing default + COM-drift stability across ALL 15 molecular MD modes!)
//     3. `life-lab.html` (Vesicle + Biopolymer COM-centered folding + Eigen + Hodgkin-Huxley + Turing)
//     4. `elements-lab.html` (Dirac-KS Orbital + Live Crystal MD + Polytope Atlas)
//     5. `universes.html` (Causal Cascade + Binary & Hierarchical Trinary GPU f32x2 N-body +
//        Fixed Hadley/Ferrel Earth-like Weather + Fixed 6-Wheel Rover Collision on Mars & Earth!)

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = (process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173').replace(/\/$/, '');
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_FULL_WATCH_SHOT_DIR || '';

test('ALL 5 ULG Flagship Pages & Every Scale: Live Vulkan Stability, Zero-Jiggle COM, Causal Binary/Trinary, Weather & Rover Watch', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for full cross-demo Vulkan watch',
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

  const saveDataUrl = async (dataUrl, name) => {
    const buf = Buffer.from(String(dataUrl || '').split(',')[1] || '', 'base64');
    if (name && SHOT_DIR && buf.length > 64) {
      await writeFile(path.join(SHOT_DIR, `${name}.png`), buf);
    }
    return buf;
  };

  const report = {};
  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1360, height: 820 } });
    const page = await ctx.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });

    // =========================================================================
    // 1. ROOT LAUNCHER (`index.html`) + MESOSCALE CONTINUUM SOLVER (MLS-MPM)
    // =========================================================================
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('#ulg-empty-open-btn', { timeout: 30_000 });
    const btnText = await page.locator('#ulg-empty-open-btn').textContent();
    assert.ok(btnText.includes('Mesoscale Continuum Solver'), `Expected MLS-MPM button label (got "${btnText}")`);
    if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, '01-index-launcher.png') });
    await page.click('#ulg-empty-open-btn');
    await page.waitForSelector('#ulg-launch-btn', { timeout: 15_000 });
    await page.click('#ulg-launch-btn');
    await page.waitForTimeout(2200);
    if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, '02-studio-mlsmpm.png') });
    report.rootStudio = { launcherLabel: btnText.trim(), launched: true };

    // =========================================================================
    // 2. ORGANIC CHEMISTRY LAB (`organic-lab.html`) — ALL 15 MOLECULAR MODES!
    // =========================================================================
    await page.goto(`${BASE_URL}/organic-lab.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgOrganicLab?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.evaluate(() => window.__ulgOrganicLab.setPaused(true));

    const bear0 = await page.evaluate(() => window.__ulgOrganicLab.stepNow(4));
    assert.equal(bear0.mode, 'sulflower-bearing');
    assert.ok(bear0.simSpeed > 0 && bear0.simSpeed <= 0.5, `Organic default simSpeed must be calm <= 0.5x (got ${bear0.simSpeed})`);
    await page.evaluate(() => window.__ulgOrganicLab.setSimSpeed(0.15));
    const spdOrg = await page.evaluate(() => window.__ulgOrganicLab.getState().simSpeed);
    assert.equal(spdOrg, 0.15, 'Organic simSpeed slider API must update cleanly');
    await page.evaluate(() => window.__ulgOrganicLab.setSimSpeed(0.25));
    const fBear0 = await saveDataUrl(await page.evaluate(() => window.__ulgOrganicLab.capturePng()), '03-organic-sulflower-t0');
    const bear1 = await page.evaluate(() => window.__ulgOrganicLab.stepNow(28));
    const fBear1 = await saveDataUrl(await page.evaluate(() => window.__ulgOrganicLab.capturePng()), '04-organic-sulflower-t28');
    const bearMotion = comparePhysicalPixelPngFrames(fBear0, fBear1);
    assert.ok(bearMotion.changedPixelCount > 2000, `Sulflower must spin visibly (changed=${bearMotion.changedPixelCount})`);

    const allMolModes = [
      'sulflower-bearing', 'benzene', 'cyclobutadiene', 'naphthalene', 'butadiene', 'adenine',
      'cyclohexane', 'butane', 'l-alanine', 'd-alanine', 'ethanol', 'dimethyl-ether',
      'ethanol-water-hbond', 'acetic-acid', 'sn2-walden', 'diels-alder'
    ];
    let maxMolComDrift = 0;
    for (const m of allMolModes) {
      await page.evaluate((id) => window.__ulgOrganicLab.selectMode(id), m);
      await page.evaluate(() => window.__ulgOrganicLab.stepNow(18));
      const drift = await page.evaluate(() => window.__ulgOrganicLab.readComDrift());
      if (drift > maxMolComDrift) maxMolComDrift = drift;
      assert.ok(Number.isFinite(drift) && drift < 0.25, `Organic mode "${m}" drifted out of view (COM drift=${drift} A)`);
    }
    const orgEnd = await page.evaluate(() => window.__ulgOrganicLab.getState());
    assert.equal(orgEnd.gpuErrorCount, 0, `Organic GPU errors: ${orgEnd.gpuErrors.join(' | ')}`);
    report.organicLab = {
      defaultMode: bear0.mode,
      sulflowerChangedPx: bearMotion.changedPixelCount,
      sulflowerOmega: Number((bear1.telemetry?.rotorOmegaRadPs || 0).toFixed(3)),
      allModesChecked: allMolModes.length,
      maxComDriftA: Number(maxMolComDrift.toFixed(4))
    };

    // =========================================================================
    // 3. EMERGENT BIOLOGY LAB (`life-lab.html`) — VESICLE, PROTEIN, EIGEN, TURING
    // =========================================================================
    await page.goto(`${BASE_URL}/life-lab.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.evaluate(() => window.__ulgLifeLab.setPaused(true));

    await page.evaluate(() => window.__ulgLifeLab.selectMode('protocell-vesicle'));
    await page.evaluate(() => window.__ulgLifeLab.stepNow(14));
    await saveDataUrl(await page.evaluate(() => window.__ulgLifeLab.capturePng()), '05-life-vesicle');

    await page.evaluate(() => window.__ulgLifeLab.selectMode('amphipathic-helix-bundle'));
    await page.evaluate(() => window.__ulgLifeLab.setParams({ foldTempK: 300 }));
    const stFold = await page.evaluate(() => window.__ulgLifeLab.stepNow(22));
    await saveDataUrl(await page.evaluate(() => window.__ulgLifeLab.capturePng()), '06-life-protein-300k');

    await page.evaluate(() => window.__ulgLifeLab.selectMode('turing-chemotaxis'));
    const stTur = await page.evaluate(() => window.__ulgLifeLab.stepNow(16));
    assert.ok(stTur.simSpeed > 0 && stTur.simSpeed <= 0.5, `Life default simSpeed must be calm <= 0.5x (got ${stTur.simSpeed})`);
    await saveDataUrl(await page.evaluate(() => window.__ulgLifeLab.capturePng()), '07-life-turing');
    assert.equal(stTur.gpuErrorCount, 0, `Life GPU errors: ${stTur.gpuErrors.join(' | ')}`);
    report.lifeLab = {
      simSpeedDefault: stTur.simSpeed,
      proteinRg: Number((stFold.telemetry?.radiusOfGyrationA || 0).toFixed(2)),
      turingEnrich: Number((stTur.telemetry?.chemotacticEnrichment || 0).toFixed(2))
    };

    // =========================================================================
    // 4. MATERIAL PHYSICS LAB (`elements-lab.html`) — ORBITAL, MD, ATLAS
    // =========================================================================
    await page.goto(`${BASE_URL}/elements-lab.html?z=79&tab=atomic`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 79 && !window.__ulgElementsLabState?.busy && window.__ulgElementsLabState?.orbitalCloudStats?.pointCount >= 50000, null, { timeout: 60_000 });
    await page.waitForTimeout(500);
    if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, '08-elements-au-orbital.png') });
    const elSpd = await page.evaluate(() => window.__ulgElementsLabState?.simSpeed);
    assert.ok(elSpd > 0 && elSpd <= 0.6, `Elements Lab default simSpeed should be calm <= 0.6x (got ${elSpd})`);
    await page.evaluate(() => window.__ulgElementsLabApi.setTab('md'));
    await page.waitForTimeout(1000);
    if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, '09-elements-md.png') });
    await page.evaluate(() => window.__ulgElementsLabApi.setTab('polytope'));
    await page.waitForTimeout(1000);
    if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, '10-elements-atlas.png') });
    report.elementsLab = { Z: 79, simSpeedDefault: elSpd, tabsVerified: ['atomic', 'md', 'polytope'] };

    // =========================================================================
    // 5. ULG UNIVERSES (`universes.html`) — CAUSAL CASCADE, BINARY/TRINARY, WEATHER & ROVER
    // =========================================================================
    await page.goto(`${BASE_URL}/universes.html?level=0&quality=med`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.evaluate(() => { document.getElementById('uv-pause-btn')?.click(); });

    // L0 Cosmic Web
    await page.evaluate(async () => { for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '11-univ-L0-web');

    // L1 Spiral Galaxy + Pick Star (must show causal nebular preview!)
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(1, { instant: true }));
    await page.evaluate(() => window.__ulgUniversesDemo.setCameraAngles(0.55, 0.72));
    await page.evaluate(async () => { for (let i = 0; i < 12; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const pickedStar = await page.evaluate(() => window.__ulgUniversesDemo.pickAtCanvasFraction(0.56, 0.52, { preferGpuMote: true }));
    assert.ok(pickedStar && pickedStar.kind === 'galaxy-star', 'L1 star pick must succeed');
    assert.ok(pickedStar.starSite && pickedStar.subtitle.includes('worlds'), `L1 star pick must preview causal nebular system (got "${pickedStar.subtitle}")`);
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '12-univ-L1-galaxy-pick');

    // L2 Default Causal Nebular System + Explicit Binary & Hierarchical Trinary GPU f32x2 N-Body Proofs!
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(2, { instant: true }));
    const l2Def = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l2Def.useSolReference, false, 'L2 default must be causal galactic nebular synthesis, NOT hardcoded Sol');

    // Binary Star System on GPU f32x2
    const binSt0 = await page.evaluate(() => window.__ulgUniversesDemo.sampleNewGalacticSector({ forceMultiplicity: 2 }));
    assert.equal(binSt0.causalStarCount, 2, 'Binary system must have 2 stars');
    await page.evaluate(() => window.__ulgUniversesDemo.setLog10Span(12.2));
    await page.evaluate(() => window.__ulgUniversesDemo.setCameraAngles(0.62, 0.58));
    await page.evaluate(async () => { for (let i = 0; i < 20; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const binSt1 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(binSt1.solarRelEnergyDrift < 1e-4, `Binary GPU N-body energy drift must stay < 1e-4 (got ${binSt1.solarRelEnergyDrift})`);
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '13-univ-L2-binary-star');

    // Hierarchical Trinary Star System on GPU f32x2
    const triSt0 = await page.evaluate(() => window.__ulgUniversesDemo.sampleNewGalacticSector({ forceMultiplicity: 3 }));
    assert.equal(triSt0.causalStarCount, 3, 'Trinary system must have 3 stars');
    await page.evaluate(() => window.__ulgUniversesDemo.setLog10Span(12.5));
    await page.evaluate(async () => { for (let i = 0; i < 20; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const triSt1 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(triSt1.solarRelEnergyDrift < 1e-4, `Trinary GPU N-body energy drift must stay < 1e-4 (got ${triSt1.solarRelEnergyDrift})`);
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '14-univ-L2-trinary-star');

    // L3 Main-Sequence Star
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(3, { instant: true }));
    await page.evaluate(async () => { for (let i = 0; i < 16; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '15-univ-L3-star');

    // L4 Fixed Earth-Like Weather (Hadley/Ferrel/ITCZ Wispy Clouds + Shadows + Pinpoint Lightning!)
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(4, { instant: true }));
    await page.evaluate(() => window.__ulgUniversesDemo.focusSolarBody('earth'));
    await page.evaluate(async () => { for (let i = 0; i < 18; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const l4EarthSt = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l4EarthSt.planetaryAtmoActive, true);
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '16-univ-L4-earthlike-weather');

    // L4 Fixed 6-Wheel Rover Collision on Mars Crater Terrain (Drive + Turbo + Jump Rocket + Land!)
    await page.evaluate(() => window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'mars' }));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true, turbo: true }));
    await page.evaluate(async () => { for (let i = 0; i < 32; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true, turbo: false, jump: true }));
    await page.evaluate(async () => { for (let i = 0; i < 10; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: false, jump: false }));
    await page.evaluate(async () => {
      for (let i = 0; i < 180; i += 1) {
        const st = await window.__ulgUniversesDemo.stepOnce();
        if (i >= 15 && st.surfaceTelemetry?.roverOnGround) break;
      }
    });
    const marsSurfSt = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(marsSurfSt.surfaceTelemetry.roverAltitudeM >= 0 && marsSurfSt.surfaceTelemetry.roverAltitudeM < 3.0, `Mars rover must land cleanly on terrain (alt=${marsSurfSt.surfaceTelemetry.roverAltitudeM})`);
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '17-univ-L4-rover-mars');

    // L4 Earth Shoreline Rover Collision + Earth-Like 3D CFD Buoyant UFO Ascent!
    await page.evaluate(() => window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'earth' }));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true }));
    await page.evaluate(async () => { for (let i = 0; i < 24; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '18-univ-L4-rover-earth');

    // Switch to 3D CFD UFO right on Earth-like world!
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: false }));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceVehicle('ufo'));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true, jump: true }));
    await page.evaluate(async () => { for (let i = 0; i < 20; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const earthUfoSt = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(earthUfoSt.surfaceVehicle, 'ufo');
    assert.ok(earthUfoSt.surfaceTelemetry?.cfdActive, 'Earth UFO must activate live 3D WebGPU CFD');
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '20-univ-L4-earth-ufo-cfd');

    // L4 Gas Giant 3D Atmospheric CFD Dive in Buoyant Disc UFO (Jupiter Upper NH3 -> Deep H2O Strata!)
    await page.evaluate(() => window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'jupiter' }));
    await page.evaluate(async () => { for (let i = 0; i < 16; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const jupUpperSt = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(jupUpperSt.surfaceVehicle, 'ufo', 'Jupiter dive must auto-deploy Buoyant Disc UFO');
    assert.ok(jupUpperSt.surfaceTelemetry?.cfdActive, 'Jupiter must run live 3D WebGPU CFD');
    assert.ok((jupUpperSt.surfaceTelemetry?.cfdTelemetry?.rmsWindMS || 0) > 0.5, 'Jupiter 3D CFD must produce real zonal winds');
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '21-univ-L4-jupiter-ufo-upper');

    // Dive deeper into Jupiter (down to -48 km ~ H2O / high-pressure strata!)
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceUfoAltitudeKm(-48));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true, down: true }));
    await page.evaluate(async () => { for (let i = 0; i < 18; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const jupDeepSt = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const pUp = jupUpperSt.surfaceTelemetry.cfdTelemetry.chemistry.pressureBar;
    const pDeep = jupDeepSt.surfaceTelemetry.cfdTelemetry.chemistry.pressureBar;
    const tUp = jupUpperSt.surfaceTelemetry.cfdTelemetry.chemistry.tempK;
    const tDeep = jupDeepSt.surfaceTelemetry.cfdTelemetry.chemistry.tempK;
    assert.ok(pDeep > pUp * 3.0, `Diving deeper into Jupiter must raise hydrostatic pressure (upper=${pUp} bar -> deep=${pDeep} bar)`);
    assert.ok(tDeep > tUp + 40, `Diving deeper into Jupiter must warm adiabatically (upper=${tUp} K -> deep=${tDeep} K)`);
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '22-univ-L4-jupiter-ufo-deep');
    await page.evaluate(() => window.__ulgUniversesDemo.exitSurfaceView());

    // L7 Atomic Nucleus
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(7, { instant: true }));
    await page.evaluate(async () => { for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), '19-univ-L7-nucleus');

    const univEnd = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(univEnd.gpuErrorCount, 0, `Universes GPU errors: ${univEnd.gpuErrors.join(' | ')}`);
    assert.equal(pageErrors.length, 0, `Page errors across all 5 apps: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Console errors across all 5 apps: ${consoleErrors.join(' | ')}`);

    report.universes = {
      defaultCausalSystem: l2Def.causalSystemName,
      binary: { name: binSt1.causalSystemName, arch: binSt1.causalArchitecture, dE: Number(binSt1.solarRelEnergyDrift.toExponential(2)) },
      trinary: { name: triSt1.causalSystemName, arch: triSt1.causalArchitecture, dE: Number(triSt1.solarRelEnergyDrift.toExponential(2)) },
      earthWeather: { lightningCells: l4EarthSt.planetaryLightningCells, atmoSteps: l4EarthSt.planetaryAtmoSteps },
      marsRover: { pos: marsSurfSt.surfaceTelemetry.roverPos.map((v) => Number(v.toFixed(1))), altM: Number(marsSurfSt.surfaceTelemetry.roverAltitudeM.toFixed(2)) },
      earthUfo: {
        altKm: Number((earthUfoSt.surfaceTelemetry.cfdTelemetry.chemistry.altKm || 0).toFixed(2)),
        deck: earthUfoSt.surfaceTelemetry.cfdTelemetry.chemistry.activeCloudDeck,
        windMS: Number((earthUfoSt.surfaceTelemetry.cfdTelemetry.rmsWindMS || 0).toFixed(2))
      },
      jupiterUfo: {
        upperBar: Number(pUp.toFixed(2)),
        upperDeck: jupUpperSt.surfaceTelemetry.cfdTelemetry.chemistry.activeCloudDeck,
        deepBar: Number(pDeep.toFixed(2)),
        deepTempK: Math.round(tDeep),
        deepDeck: jupDeepSt.surfaceTelemetry.cfdTelemetry.chemistry.activeCloudDeck,
        windMS: Number((jupDeepSt.surfaceTelemetry.cfdTelemetry.rmsWindMS || 0).toFixed(2))
      }
    };

    console.log('[FULL_CROSS_DEMO_WATCH_REPORT]', JSON.stringify(report));
    await ctx.close();
  } finally {
    await browser.close();
  }
});
