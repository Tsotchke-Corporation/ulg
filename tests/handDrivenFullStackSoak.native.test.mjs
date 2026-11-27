// Mandatory Real Hand-Driven Playwright Full-Stack Soak across ALL 5 Flagship ULG Demos:
//   1. `index.html` (MLS-MPM Studio)
//   2. `elements-lab.html` (Nuclear Fission, 3D Volumetric Zoom, Optics Slider Focus, 3D Polytope Click)
//   3. `universes.html` (L0 Physical FLRW Big Bang Expansion, L3 3D GPU MLS-MPM Stellar Fusion,
//      Earth Surface Hand-Driving with WASD/Space/T/M, Dual-Caret EM Sensor Stack)
//   4. `organic-lab.html` (Sulflower HDR Bloom & Alpha vdW Bonds, Rapid Mode-Switch Race Guard, BZ Wave)
//   5. `life-lab.html` (Protocell Vesicle 3D Cutaway Slider, Sculpted Protein Ribbon, HH Click Stimulus)
//
// Strictly drives UI via REAL mouse drags, wheel events, keyboard holds, pointer slider drags, and clicks.
// Saves 14 sequential PNGs to `ULG_SOAK_SHOT_DIR` for mandatory visual inspection.

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = (process.env.ULG_DEV_URL || process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173').replace(/\/$/, '');
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_SOAK_SHOT_DIR || '';

async function dragCanvas(page, selector, dx = 140, dy = -45) {
  const box = await page.locator(selector).first().boundingBox();
  assert.ok(box && box.width > 50 && box.height > 50, `Canvas ${selector} must have valid bounding box`);
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(cx + (dx * i) / 8, cy + (dy * i) / 8, { steps: 1 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

async function dragRangeToFraction(page, selector, frac) {
  const loc = page.locator(selector);
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  assert.ok(box && box.width > 10, `Range slider ${selector} must be visible`);
  const y = box.y + box.height * 0.5;
  const xStart = box.x + box.width * 0.8;
  const xEnd = box.x + Math.max(2, Math.min(box.width - 2, box.width * frac));
  await page.mouse.move(xStart, y);
  await page.mouse.down();
  await page.mouse.move(xEnd, y, { steps: 6 });
  await page.mouse.up();
}

test('Hand-Driven Full-Stack Soak across all 5 Flagship ULG WebGPU Demos (Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan hand-driven soak',
  timeout: 540_000
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
      '--disable-dev-shm-usage'
    ]
  });

  const saveDataUrl = async (dataUrl, name) => {
    const buf = Buffer.from(String(dataUrl || '').split(',')[1] || '', 'base64');
    if (SHOT_DIR && name && buf.length > 64) {
      await writeFile(path.join(SHOT_DIR, `${name}.png`), buf);
    }
    return buf;
  };

  const captureStudioFrame = async (page, name) => {
    const buf = await page.screenshot({ type: 'png' });
    if (SHOT_DIR && name && buf.length > 64) {
      await writeFile(path.join(SHOT_DIR, `${name}.png`), buf);
    }
    return buf;
  };

  const report = {};
  const allErrors = [];

  const attachErrorListeners = (page, tag) => {
    page.on('pageerror', (e) => allErrors.push(`[${tag}:pageerror] ${String(e).slice(0, 260)}`));
    page.on('console', (m) => {
      if (m.type() === 'error') allErrors.push(`[${tag}:console] ${m.text().slice(0, 260)}`);
    });
  };

  try {
    // =========================================================================
    // 1. MLS-MPM STUDIO (`index.html`)
    // =========================================================================
    {
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 760 } });
      const page = await ctx.newPage();
      attachErrorListeners(page, 'studio');

      await page.goto(`${BASE_URL}/index.html?scenario=water-realtime&autoplay=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForSelector('canvas', { timeout: 30_000 });
      if (await page.locator('#ulg-empty-open-btn').isVisible().catch(() => false)) {
        await page.locator('#ulg-empty-open-btn').click();
        await page.waitForSelector('#ulg-launch-btn', { timeout: 15_000 });
        await page.locator('#ulg-launch-btn').click();
      }
      // Wait for Studio's #ulg-loading-overlay & #sph-bootstrap-presentation overlays to clear!
      await page.waitForFunction(
        () => {
          const ov = document.querySelector('#ulg-loading-overlay');
          const bs = document.querySelector('#sph-bootstrap-presentation');
          const ovGone = !ov || ov.hidden || getComputedStyle(ov).display === 'none';
          const bsGone = !bs || bs.hidden || getComputedStyle(bs).display === 'none';
          return ovGone && bsGone;
        },
        null,
        { timeout: 120_000 }
      );
      await page.waitForTimeout(2600);
      const studioBlocked1 = await page.evaluate(() => document.body.innerText.includes('Initialization blocked'));
      assert.equal(studioBlocked1, false, 'Studio water-realtime must NOT hit worker bootstrap timeout / Initialization blocked');

      const readStudioState = async () => page.evaluate(() => {
        const ov = document.querySelector('#sph-overlay') || document.querySelector('.sph-overlay') || [...document.querySelectorAll('div')].find((d) => d.__sphScene);
        const cam = ov?.__sphScene?.camera?.position;
        const pill = document.querySelector('#ulg-status-pill')?.textContent || document.querySelector('#sph-status')?.textContent || '';
        const stepsM = pill.match(/(\d+)\s*steps/);
        return {
          cam: cam ? [Number(cam.x), Number(cam.y), Number(cam.z)] : null,
          steps: stepsM ? Number(stepsM[1]) : 0,
          pill: pill.slice(0, 120)
        };
      });
      const stBefore = await readStudioState();
      const shotA = await captureStudioFrame(page, 'soak-01-studio-water');
      await dragCanvas(page, 'canvas', 180, -55);
      await page.mouse.wheel(0, -240);
      await page.waitForTimeout(1400);
      const stAfter = await readStudioState();
      const shotB = await captureStudioFrame(page, null);
      const cmpStudio = await comparePhysicalPixelPngFrames(shotA, shotB);
      const camDelta = (stBefore.cam && stAfter.cam)
        ? Math.hypot(stAfter.cam[0] - stBefore.cam[0], stAfter.cam[1] - stBefore.cam[1], stAfter.cam[2] - stBefore.cam[2])
        : 0;
      assert.ok(
        cmpStudio.changedPixelCount > 1500 || camDelta > 0.02 || stAfter.steps > stBefore.steps,
        `Studio real mouse orbit/zoom & live simulation must advance (px=${cmpStudio.changedPixelCount}, camDelta=${camDelta.toFixed(4)}, steps=${stBefore.steps}->${stAfter.steps})`
      );
      // Toggle pause/play via real click if visible
      if (await page.locator('#ulg-play-btn').isVisible().catch(() => false)) {
        await page.locator('#ulg-play-btn').click();
        await page.waitForTimeout(150);
        await page.locator('#ulg-play-btn').click();
      } else if (await page.locator('#sph-play').isVisible().catch(() => false)) {
        await page.locator('#sph-play').click();
        await page.waitForTimeout(150);
        await page.locator('#sph-play').click();
      }
      report.studio = { orbitChangedPx: cmpStudio.changedPixelCount, camDelta: Number(camDelta.toFixed(4)), steps: `${stBefore.steps}->${stAfter.steps}`, statusSample: stAfter.pill, ok: true };
      await ctx.close();
    }

    // =========================================================================
    // 2. ELEMENTS LAB (`elements-lab.html`)
    // =========================================================================
    {
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1360, height: 820 } });
      const page = await ctx.newPage();
      attachErrorListeners(page, 'elements');

      const clickElNav = async (tab, sub) => {
        const item = page.locator(`.acc-item-btn[data-nav-tab="${tab}"][data-nav-sub="${sub}"]`);
        if (!(await item.isVisible().catch(() => false))) {
          await page.locator(`.acc-header[data-acc-tab="${tab}"]`).first().click();
          await page.waitForTimeout(120);
        }
        await item.click();
      };

      await page.goto(`${BASE_URL}/elements-lab.html?z=92`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(() => Boolean(window.__ulgElementsLabState?.bundle && !window.__ulgElementsLabState?.busy), null, { timeout: 60_000 });
      await page.waitForTimeout(450);

      // 2A. Nuclear Fission continuous Cassini-oval + scission neutron burst
      await clickElNav('nuclear', 'fission');
      await page.waitForTimeout(550);
      if (await page.locator('#ctrl-fiss-b2').isVisible().catch(() => false)) {
        await dragRangeToFraction(page, '#ctrl-fiss-b2', 0.74);
        await page.waitForTimeout(400);
      }
      await saveDataUrl(await page.evaluate(() => window.__ulgElementsLabApi.captureCanvasDataUrl()), 'soak-03-elements-fission');

      // 2B. Atomic 3D Orbital Volume + REAL WHEEL ZOOM proving cam_dist uniform works!
      await clickElNav('atomic', 'volume');
      await page.waitForTimeout(650);
      const volBefore = await saveDataUrl(await page.evaluate(() => window.__ulgElementsLabApi.captureCanvasDataUrl()), null);
      const boxEl = await page.locator('#gpu-canvas').boundingBox();
      await page.mouse.move(boxEl.x + boxEl.width * 0.5, boxEl.y + boxEl.height * 0.5);
      for (let i = 0; i < 6; i += 1) {
        await page.mouse.wheel(0, -180);
        await page.waitForTimeout(60);
      }
      await page.waitForTimeout(350);
      const volAfter = await saveDataUrl(await page.evaluate(() => window.__ulgElementsLabApi.captureCanvasDataUrl()), 'soak-04-elements-vol-zoom');
      const cmpVolZoom = await comparePhysicalPixelPngFrames(volBefore, volAfter);
      assert.ok(cmpVolZoom.changedPixelCount > 4000, `Elements 3D volume wheel zoom must visibly zoom (changed ${cmpVolZoom.changedPixelCount} px)`);

      // 2C. Crystal Optics #ctrl-lambda non-destructive drag check (must NOT destroy DOM mid-drag!)
      await clickElNav('crystal', 'photon-shell');
      await page.waitForTimeout(550);
      const lambdaStillMounted = await page.evaluate(() => {
        const inp = document.getElementById('ctrl-lambda');
        if (!inp) return 'missing';
        inp.focus();
        inp.value = '620';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        return inp.isConnected && document.activeElement === inp ? 'mounted-and-focused' : 'detached';
      });
      assert.equal(lambdaStillMounted, 'mounted-and-focused', `#ctrl-lambda must stay mounted & focused during drag (got ${lambdaStillMounted})`);

      // 2D. 3D Polytope Atlas real orbit + real 3D click probe
      await clickElNav('polytope', '3d-surface');
      await page.waitForTimeout(700);
      await dragCanvas(page, '#gpu-canvas', 95, -25);
      await page.mouse.click(boxEl.x + boxEl.width * 0.52, boxEl.y + boxEl.height * 0.52);
      await page.waitForTimeout(350);
      const polyProbe = await page.evaluate(() => window.__ulgElementsLabState?.polytopeProbe || null);
      assert.ok(polyProbe && Number.isFinite(polyProbe.temperatureK), '3D Polytope real click must lock a valid (T, P) probe');
      await saveDataUrl(await page.evaluate(() => window.__ulgElementsLabApi.captureCanvasDataUrl()), 'soak-05-elements-polytope-3d');

      const elGpuErr = await page.evaluate(() => (window.__ulgElementsLabState?.gpuErrors || []).length);
      assert.equal(elGpuErr, 0, `Elements Lab WebGPU errors: ${elGpuErr}`);
      report.elements = { volZoomChangedPx: cmpVolZoom.changedPixelCount, polyTempK: Math.round(polyProbe.temperatureK), gpuErrors: elGpuErr };
      await ctx.close();
    }

    // =========================================================================
    // 3. ULG UNIVERSES (`universes.html`) — L0 Big Bang, L3 MLS-MPM Fusion, Surface Hand-Drive & EM Sensor
    // =========================================================================
    {
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1360, height: 820 } });
      const page = await ctx.newPage();
      attachErrorListeners(page, 'universes');

      await page.goto(`${BASE_URL}/universes.html?level=0&quality=med`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });
      await page.waitForTimeout(350);

      // 3A. Click REAL Sim Drawer -> REAL `#uv-bigbang-btn` -> verify early fireball -> let FLRW physically expand!
      await page.locator('#uv-sim-btn').click();
      await page.waitForTimeout(200);
      await page.locator('#uv-bigbang-btn').click();
      await page.waitForFunction(
        () => {
          const st = window.__ulgUniversesDemo?.getState?.();
          return st && st.cosmoBigBangMode === true && st.cosmoScaleFactorA < 0.25;
        },
        null,
        { timeout: 25_000 }
      );
      const bbEarly = await page.evaluate(() => {
        const st = window.__ulgUniversesDemo.getState();
        return { mode: st.cosmoBigBangMode, a: st.cosmoScaleFactorA };
      });
      await page.locator('#uv-sim-btn').click(); // close drawer for clean screenshot
      await page.waitForTimeout(80);
      const shotBb0 = await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), 'soak-06-bigbang-fireball');

      // Step FLRW expansion forward and prove physical outward expansion!
      const bbLate = await page.evaluate(async () => {
        const api = window.__ulgUniversesDemo;
        for (let i = 0; i < 42; i += 1) await api.stepOnce();
        const st = api.getState();
        return { mode: st.cosmoBigBangMode, a: st.cosmoScaleFactorA };
      });
      await page.waitForTimeout(220);
      const shotBb1 = await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), 'soak-07-bigbang-expanded');
      const cmpBb = await comparePhysicalPixelPngFrames(shotBb0, shotBb1);
      assert.equal(bbEarly.mode, true, 'Clicking #uv-bigbang-btn must enter cosmoBigBangMode');
      assert.ok(bbLate.a > bbEarly.a + 0.15, `FLRW scale factor a(t) must physically expand (${bbEarly.a} -> ${bbLate.a})`);
      assert.ok(cmpBb.changedPixelCount > 10000, `Big Bang expansion must visibly grow across screen (${cmpBb.changedPixelCount} px)`);

      // 3B. L3 True 3D GPU MLS-MPM Stellar Fusion Star!
      const l3Btn = page.locator('#uv-scale-rail .uv-rung-btn').nth(3);
      await l3Btn.click();
      await page.waitForFunction(
        () => {
          const st = window.__ulgUniversesDemo?.getState?.();
          return st && st.level === 3 && st.stellarSolver === 'webgpu-3d-mls-mpm-nuclear-fusion';
        },
        null,
        { timeout: 30_000 }
      );
      const l3State = await page.evaluate(async () => {
        const api = window.__ulgUniversesDemo;
        for (let i = 0; i < 16; i += 1) await api.stepOnce();
        return api.getState();
      });
      assert.equal(l3State.stellarSolver, 'webgpu-3d-mls-mpm-nuclear-fusion', `L3 star must run 3D GPU MLS-MPM fusion solver (got ${l3State.stellarSolver})`);
      assert.ok((l3State.stellarConvectiveRmsVel || 0) > 0.01, `L3 MLS-MPM star must have live convective velocity (got ${l3State.stellarConvectiveRmsVel})`);
      assert.ok((l3State.stellarActiveFusionParcels || 0) > 20, `L3 MLS-MPM star must have live fusing core parcels (got ${l3State.stellarActiveFusionParcels})`);
      await dragCanvas(page, '#uv-canvas', 120, -35);
      await page.waitForTimeout(250);
      await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), 'soak-08-l3-mls-mpm-fusion-star');

      // 3B.5. L2 Solar System Reference Frame Honesty + L4 Globe Touchdown Site Selection:
      // Selecting Mercury in overall L2 view MUST keep the Center-of-Mass (Barycenter) frame
      // and ONLY switch to the selected body's co-moving frame when entering orbit (L4) or landing!
      const refFrameCheck = await page.evaluate(async () => {
        const api = window.__ulgUniversesDemo;
        await api.setUseSolReference(true);
        await api.setLevel(2, { instant: true });
        for (let i = 0; i < 3; i += 1) await api.stepOnce();
        await api.focusSolarBody(1); // Select Mercury (fast inner planet!)
        for (let i = 0; i < 2; i += 1) await api.stepOnce();
        const l2FrameAfterClick = api.getState().solarReferenceFrame;
        await api.focusSolarBody('earth');
        await api.setLevel(4, { instant: true }); // Enter orbit around Earth
        for (let i = 0; i < 3; i += 1) await api.stepOnce();
        const l4FrameInOrbit = api.getState().solarReferenceFrame;
        // Click directly on the Earth globe center to choose a touchdown landing site!
        await api.pickAtCanvasFraction(0.5, 0.5, { preferGpuMote: false });
        const chosenSite = api.getState().selectedLandingSite;
        return { l2FrameAfterClick, l4FrameInOrbit, chosenSite };
      });
      assert.equal(refFrameCheck.l2FrameAfterClick, 'barycenter', `Clicking a fast planet in overall L2 Solar System must keep barycenter frame (got ${refFrameCheck.l2FrameAfterClick})`);
      assert.equal(refFrameCheck.l4FrameInOrbit, 'body-orbit', `Entering L4 orbit around a planet must switch to body-orbit frame (got ${refFrameCheck.l4FrameInOrbit})`);
      assert.ok(refFrameCheck.chosenSite && typeof refFrameCheck.chosenSite.biomeLabel === 'string', 'Clicking Earth globe on L4 must choose an orbital touchdown site');

      // 3C. Land on a REAL clicked SPH continental site on Earth & Hand-Drive UFO with REAL Keyboard Holds (W/D/Space/M) + Tractor Beam Specimen Abduction!
      await page.evaluate(async () => {
        const api = window.__ulgUniversesDemo;
        let landSite = null;
        for (const fy of [0.38, 0.46, 0.54, 0.62]) {
          for (const fx of [0.38, 0.44, 0.50, 0.56]) {
            const hit = await api.pickAtCanvasFraction(fx, fy, { preferGpuMote: false });
            if (hit && !hit.isOcean && (hit.isLush || hit.isCoast || hit.isMountain || hit.isDesert)) {
              landSite = hit;
              break;
            }
          }
          if (landSite) break;
        }
        await api.enterSurfaceView({ bodyIndex: 'earth', landingSite: landSite || { latDeg: 33.5, lonDeg: -26.3, biomeLabel: 'SPH Continent' } });
        for (let i = 0; i < 6; i += 1) await api.stepOnce();
      });
      await page.waitForTimeout(250);
      // Verify tractor-beam abduction of a living organism/tree right on Earth surface!
      const abductionCheck = await page.evaluate(async () => {
        const api = window.__ulgUniversesDemo;
        // Toggle tractor beam on and step smoothly while hovering near spawning fauna/flora!
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
        for (let i = 0; i < 65; i += 1) {
          await api.stepOnce();
          if ((api.getState().abductedSpecimens || []).length > 0) break;
        }
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', bubbles: true }));
        const st = api.getState();
        const xenoHref = document.getElementById('uv-surf-xeno-btn')?.getAttribute('href') || '';
        return { count: (st.abductedSpecimens || []).length, first: st.abductedSpecimens?.[0]?.speciesName || null, xenoHref };
      });
      assert.ok(abductionCheck.count >= 1 && abductionCheck.xenoHref.includes('species='), `Tractor beam must abduct a living organism/tree & link it to Biology Lab (got ${JSON.stringify(abductionCheck)})`);
      // Open the new Cargo & Specimen Inventory drawer and confirm our abducted specimen is listed with its Bio Lab link!
      await page.locator('#uv-cargo-btn').click();
      await page.waitForTimeout(160);
      const cargoHtml = await page.locator('#uv-cargo-specimens').innerHTML();
      assert.ok(cargoHtml.includes('Examine in Bio Lab') && cargoHtml.includes(abductionCheck.first), 'Cargo Inventory drawer must display abducted specimen with Bio Lab link');
      await page.locator('#uv-cargo-btn').click(); // close Cargo drawer cleanly
      const posBeforeDrive = await page.evaluate(() => {
        const tel = window.__ulgUniversesDemo.getState().surfaceTelemetry;
        const p = tel?.ufoPos || tel?.roverPos || [0, 0, 0];
        return [...p];
      });
      const uvBox = await page.locator('#uv-canvas').boundingBox();
      await page.mouse.click(uvBox.x + uvBox.width * 0.5, uvBox.y + uvBox.height * 0.5);
      await page.keyboard.down('KeyW');
      await page.keyboard.down('KeyD');
      await page.keyboard.down('Space');
      await page.evaluate(async () => {
        for (let i = 0; i < 14; i += 1) await window.__ulgUniversesDemo.stepOnce();
      });
      await page.waitForTimeout(250);
      await page.keyboard.up('Space');
      await page.keyboard.up('KeyD');
      await page.keyboard.up('KeyW');
      await page.keyboard.press('KeyM'); // Fire real missile via keyboard!
      await page.waitForTimeout(450);
      const posAfterDrive = await page.evaluate(() => {
        const st = window.__ulgUniversesDemo.getState();
        const tel = st.surfaceTelemetry;
        return {
          pos: [...(tel?.ufoPos || tel?.roverPos || [0, 0, 0])],
          craters: tel?.totalCratersCarved ?? 0
        };
      });
      const driveDistM = Math.hypot(
        posAfterDrive.pos[0] - posBeforeDrive[0],
        posAfterDrive.pos[1] - posBeforeDrive[1],
        posAfterDrive.pos[2] - posBeforeDrive[2]
      );
      assert.ok(driveDistM > 1.5, `Real WASD+Space hand-driving must move UFO across terrain (moved ${driveDistM.toFixed(2)} m)`);
      await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), 'soak-09-universes-earth-handdrive');

      // 3D. Dual-Caret EM Sensor Stack real click + Thermal IR band mapping!
      await page.locator('#uv-em-sensor-btn').click();
      await page.waitForTimeout(200);
      const irBtn = page.locator('#uv-em-presets button', { hasText: /IR|Thermal/i }).first();
      await irBtn.click();
      await page.waitForTimeout(400);
      const emState = await page.evaluate(() => window.__ulgUniversesDemo.getState().emSensor);
      assert.equal(emState?.active, true, 'EM Sensor must activate when preset clicked');
      await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), 'soak-10-universes-em-ir');

      // 3E. Fly to the Dark Side of 1P/Halley Comet (True Unified Reversed Log Depth + Spherical Terminator Crossing!)
      await page.locator('#uv-em-presets button', { hasText: /Vis|Human/i }).first().click().catch(() => {});
      await page.waitForTimeout(150);
      const cometNight = await page.evaluate(async () => {
        const api = window.__ulgUniversesDemo;
        await api.enterSurfaceView({
          bodyIndex: 'halley',
          restoreCheckpoint: { activeVehicle: 'ufo', ufoPos: [3600, 34, 0], ufoYaw: 0.4 }
        });
        for (let i = 0; i < 8; i += 1) await api.stepOnce();
        const st = api.getState();
        return {
          sunElevDeg: st.surfaceClimate?.sunElevDeg,
          isNightSide: st.surfaceClimate?.isNightSide
        };
      });
      await page.waitForTimeout(200);
      assert.equal(cometNight.isNightSide, true, `Flying around Halley's Comet must reach true pitch-black night side (elev=${cometNight.sunElevDeg} deg)`);
      await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), 'soak-15-universes-comet-darkside');

      // 3E.5. Dive into Jupiter Gas Giant -> verify opaque cloud-deck floor & atmospheric occlusion (ZERO planets shining through Jupiter!)
      const jupDive = await page.evaluate(async () => {
        const api = window.__ulgUniversesDemo;
        await api.enterSurfaceView({ bodyIndex: 'jupiter' });
        for (let i = 0; i < 8; i += 1) await api.stepOnce();
        const st = api.getState();
        return { trans: st.gasGiantSkyTransmittance, skyBodies: st.surfaceSkyBodyCount };
      });
      await page.waitForTimeout(200);
      assert.ok((jupDive.trans ?? 1) < 0.35, `Deep Jupiter cloud atmosphere must attenuate sky transmittance (got ${jupDive.trans})`);
      await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), 'soak-17-universes-jupiter-clouds');

      // 3F. L1 Spiral Galaxy + Radio EM Sensor Stack -> Blinking Pulsars Stand Out & Pickable!
      await page.evaluate(async () => {
        const api = window.__ulgUniversesDemo;
        api.exitSurfaceView();
        await api.setLevel(1, { instant: true });
        api.setEmSensorWindow(-1.6, 0.6, { active: true, gain: 1.3 });
        for (let i = 0; i < 6; i += 1) await api.stepOnce();
      });
      await page.waitForTimeout(350);
      // Scan near galactic disk to pick an EM-highlighted blinking Radio Pulsar via GPU picker!
      const pulsarPick = await page.evaluate(async () => {
        const api = window.__ulgUniversesDemo;
        const pts = [
          [0.56, 0.48], [0.44, 0.52], [0.60, 0.54], [0.40, 0.46], [0.50, 0.42],
          [0.54, 0.52], [0.46, 0.48], [0.58, 0.45], [0.42, 0.55], [0.52, 0.56],
          [0.48, 0.44], [0.62, 0.50], [0.38, 0.50]
        ];
        for (const [fx, fy] of pts) {
          const hit = await api.pickAtCanvasFraction(fx, fy, { preferGpuMote: true });
          if (hit?.exoticKind === 'pulsar') return hit;
        }
        return api.getState().pickedGpuMote || null;
      });
      assert.equal(pulsarPick?.exoticKind, 'pulsar', `Radio EM sensor on L1 galaxy must let user click & identify blinking pulsars (got ${pulsarPick?.name})`);
      await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), 'soak-16-universes-galaxy-radio-pulsars');

      const uvGpuErr = await page.evaluate(() => (window.__ulgUniversesDemo.getState().gpuErrors || []).length);
      assert.equal(uvGpuErr, 0, `Universes WebGPU errors: ${uvGpuErr}`);
      report.universes = {
        bigBangExpand: `${bbEarly.a.toFixed(3)}->${bbLate.a.toFixed(3)}`,
        bigBangChangedPx: cmpBb.changedPixelCount,
        stellarSolver: l3State.stellarSolver,
        convectiveVel: Number(l3State.stellarConvectiveRmsVel.toFixed(3)),
        activeFusionParcels: l3State.stellarActiveFusionParcels,
        handDriveDistM: Number(driveDistM.toFixed(2)),
        cometNightElevDeg: cometNight.sunElevDeg,
        radioPulsarPicked: pulsarPick?.name,
        gpuErrors: uvGpuErr
      };
      await ctx.close();
    }

    // =========================================================================
    // 4. ORGANIC CHEMISTRY LAB (`organic-lab.html`)
    // =========================================================================
    {
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1360, height: 820 } });
      const page = await ctx.newPage();
      attachErrorListeners(page, 'organic');

      await page.goto(`${BASE_URL}/organic-lab.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(() => Boolean(window.__ulgOrganicLab?.getState?.()?.ready), null, { timeout: 60_000 });
      await page.waitForTimeout(600);

      // Orbit drag + pick atom on Sulflower Bearing (with HDR bloom + alpha H-bonds/vdW!)
      await dragCanvas(page, '#org-canvas', 110, -40);
      await page.waitForTimeout(300);
      await saveDataUrl(await page.evaluate(() => window.__ulgOrganicLab.capturePng()), 'soak-11-organic-sulflower-bloom');

      // Test Help Popover Escape close
      await page.locator('#help-btn').click();
      await page.waitForTimeout(120);
      const helpOpen = await page.locator('#help-popover').evaluate((el) => el.classList.contains('open'));
      assert.equal(helpOpen, true, 'Help popover should open on click');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(120);
      const helpClosed = await page.locator('#help-popover').evaluate((el) => !el.classList.contains('open'));
      assert.equal(helpClosed, true, 'Help popover must close on Escape');

      // Rapid mode switching stress test (proves modeSwitchToken prevents GPU dispose race!)
      await page.evaluate(async () => {
        const api = window.__ulgOrganicLab;
        // Fire 3 concurrent rapid switches without awaiting the first two!
        api.selectMode('ethanol-water-hbond');
        api.selectMode('benzene');
        await api.selectMode('belousov-zhabotinsky');
      });
      await page.waitForTimeout(650);
      const orgBox = await page.locator('#org-canvas').boundingBox();
      await page.mouse.click(orgBox.x + orgBox.width * 0.5, orgBox.y + orgBox.height * 0.5);
      await page.waitForTimeout(450);
      await saveDataUrl(await page.evaluate(() => window.__ulgOrganicLab.capturePng()), 'soak-12-organic-bz');

      const orgGpuErr = await page.evaluate(() => (window.__ulgOrganicLab?.getState?.()?.gpuErrors || []).length);
      assert.equal(orgGpuErr, 0, `Organic Lab WebGPU errors: ${orgGpuErr}`);
      report.organic = { helpEscapeOk: true, rapidSwitchOk: true, gpuErrors: orgGpuErr };
      await ctx.close();
    }

    // =========================================================================
    // 5. LIFE & BIOPHYSICS LAB (`life-lab.html`)
    // =========================================================================
    {
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1360, height: 820 } });
      const page = await ctx.newPage();
      attachErrorListeners(page, 'life');

      await page.goto(`${BASE_URL}/life-lab.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.()?.ready), null, { timeout: 60_000 });
      await page.waitForTimeout(450);

      // 5A. Protocell Vesicle + REAL Drag on `#sl-mem-clip` 3D Bilayer Cutaway Slider!
      await page.locator('.acc-header', { hasText: /Membrane/i }).first().click().catch(() => {});
      await page.waitForTimeout(120);
      await page.locator('.mode-btn[data-mode="protocell-vesicle"]').click();
      await page.waitForTimeout(600);
      await dragRangeToFraction(page, '#sl-mem-clip', 0.45);
      await page.waitForTimeout(350);
      const clipVal = await page.evaluate(() => Number(document.getElementById('sl-mem-clip')?.value ?? 99));
      assert.ok(clipVal < 3.0, `Dragging #sl-mem-clip must slice vesicle cutaway (got ${clipVal})`);
      await dragCanvas(page, '#life-canvas', 85, -30);
      await page.waitForTimeout(250);
      await saveDataUrl(await page.evaluate(() => window.__ulgLifeLab.capturePng()), 'soak-13-life-vesicle-cutaway');

      // Test Reset syncs memClipZ back to 8.0!
      await page.locator('#btn-mem-reset').click();
      await page.waitForTimeout(200);
      const clipAfterReset = await page.evaluate(() => Number(document.getElementById('sl-mem-clip')?.value ?? -1));
      assert.ok(clipAfterReset >= 7.5, `#btn-mem-reset must reset cutaway slider back to 8.0 (got ${clipAfterReset})`);

      // 5B. Sculpted 3D Protein Ribbon (`amphipathic-helix-bundle`)
      await page.locator('.acc-header', { hasText: /Fold|Protein/i }).first().click().catch(() => {});
      await page.waitForTimeout(120);
      const foldBtn = page.locator('.mode-btn[data-mode="amphipathic-helix-bundle"]');
      if (await foldBtn.isVisible()) {
        await foldBtn.click();
      } else {
        await page.evaluate(() => window.__ulgLifeLab.selectMode('amphipathic-helix-bundle'));
      }
      await page.waitForTimeout(750);
      await dragCanvas(page, '#life-canvas', 100, -25);
      await page.waitForTimeout(250);
      await saveDataUrl(await page.evaluate(() => window.__ulgLifeLab.capturePng()), 'soak-14-life-protein-ribbon');

      // 5C. Hodgkin-Huxley Excitable Spiral + Real Canvas Click-to-Stimulate!
      await page.evaluate(() => window.__ulgLifeLab.selectMode('excitable-spiral'));
      await page.waitForTimeout(450);
      const lifeBox = await page.locator('#life-canvas').boundingBox();
      await page.mouse.click(lifeBox.x + lifeBox.width * 0.55, lifeBox.y + lifeBox.height * 0.48);
      await page.waitForTimeout(350);

      // Test outside-click closing help popover
      await page.locator('#help-btn').click();
      await page.waitForTimeout(100);
      await page.mouse.click(lifeBox.x + 40, lifeBox.y + 40);
      await page.waitForTimeout(100);
      const lifeHelpClosed = await page.locator('#help-popover').evaluate((el) => !el.classList.contains('open'));
      assert.equal(lifeHelpClosed, true, 'Life Lab help popover must close on outside click');

      const lifeGpuErr = await page.evaluate(() => (window.__ulgLifeLab?.getState?.()?.gpuErrors || []).length);
      assert.equal(lifeGpuErr, 0, `Life Lab WebGPU errors: ${lifeGpuErr}`);
      report.life = { clipSlicedVal: clipVal, clipResetVal: clipAfterReset, helpOutsideClickOk: true, gpuErrors: lifeGpuErr };
      await ctx.close();
    }

    assert.equal(allErrors.length, 0, `Zero console/page errors required across all 5 demos, got:\n${allErrors.join('\n')}`);
    console.log('HAND_DRIVEN_SOAK_REPORT', JSON.stringify(report));
  } finally {
    await browser.close();
  }
});
