// Phase E Native Vulkan Headless Visual & Functional QA Suite
// Verifies all 5 Phase E user requests on real WebGPU Vulkan hardware:
//   E1: Exact repro URL (?seed=20261125&epoch=present&span=9.20&sol=0&body=star-1&t=73.6) stays centered (zero yeet, zero [object Object])
//       + Pulsar L3 -> L4 planet orbiting pulsar (exotic pulsar beams rendered!) -> back out preserves pulsar identity!
//   E2: Realistic host-star spectrum & inverse-square distance illumination (Mercury vs Earth vs Pluto pixel luminance!)
//   E3: Orbital Remote-Sensing Biosignature & Mineral/Compound Spectroscopy before landing
//   E4: Global 6-DOF UFO Free-Flight vs Orbit toggle + full X/Y/Z 3D rotation + wide chase zoom-out + Xbox Gamepad
//   E5: Cohesive perspective-aware Unified Command Deck HUD (Scan, EM, Flight, Cargo, Sim — zero overlap!)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_UNIVERSES_URL || 'https://127.0.0.1:5173';
const OUT_DIR = path.resolve(process.cwd(), 'scratch/phaseE_qa');

async function launchVulkanBrowser() {
  return chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=vulkan',
      '--enable-features=Vulkan',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
      '--renderer-process-limit=2',
      '--no-sandbox'
    ]
  });
}

async function waitForDemoReady(page) {
  await page.waitForFunction(
    () => Boolean(window.__ulgUniversesDemo && window.__ulgUniversesDemo.getState?.().ready),
    { timeout: 35000 }
  );
  await page.waitForTimeout(450);
}

async function sampleCenterCanvasLuminance(page) {
  return page.evaluate(() => {
    const c = document.getElementById('uv-canvas');
    if (!c) return 0;
    const dataUrl = window.__ulgUniversesDemo.capturePng();
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const tmp = document.createElement('canvas');
        tmp.width = 256;
        tmp.height = 144;
        const ctx = tmp.getContext('2d');
        ctx.drawImage(img, 0, 0, 256, 144);
        const px = ctx.getImageData(64, 24, 128, 96).data;
        let sum = 0; let brightCnt = 0;
        for (let i = 0; i < px.length; i += 4) {
          const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
          if (lum > 18) { sum += lum; brightCnt += 1; }
        }
        resolve(brightCnt > 10 ? sum / brightCnt : 0);
      };
      img.onerror = () => resolve(0);
      img.src = dataUrl;
    });
  });
}

test('Phase E Native Vulkan Visual & Functional Verification (E1–E5)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Phase E verification',
  timeout: 220000
}, async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await launchVulkanBrowser();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  try {
    // 1. E1: Exact user repro URL — verify centered star core (no yeeting!), valid stage label (no [object Object]!)
    await page.goto(`${BASE_URL}/universes.html?seed=20261125&epoch=present&span=9.20&sol=0&body=star-1&t=73.6`, { waitUntil: 'domcontentloaded' });
    await waitForDemoReady(page);
    for (let i = 0; i < 18; i += 1) {
      await page.evaluate(() => window.__ulgUniversesDemo.stepOnce());
    }
    const reproCheck = await page.evaluate(async () => {
      const d = window.__ulgUniversesDemo;
      const st = d.getState();
      const diag = await d.readStellarDiagnostics();
      const statsText = document.getElementById('uv-stats-grid')?.textContent || '';
      return { st, diag, statsText };
    });
    assert.equal(reproCheck.st.gpuErrorCount, 0, `GPU errors on repro URL: ${JSON.stringify(reproCheck.st.gpuErrors)}`);
    assert.equal(reproCheck.st.level, 3, `Repro URL ?span=9.20&body=star-1 must enter L3 Stellar Core (got L${reproCheck.st.level})`);
    assert.ok(!reproCheck.statsText.includes('[object Object]'), `Inspector must NEVER display [object Object], got: ${reproCheck.statsText}`);
    if (reproCheck.diag) {
      assert.ok(reproCheck.diag.boundFrac >= 0.80, `Star core must remain tightly bound at origin (boundFrac=${reproCheck.diag.boundFrac})`);
      assert.ok(reproCheck.diag.comDist < 0.25, `Star core center-of-mass must stay centered at (0,0,0) with zero yeeting (comDist=${reproCheck.diag.comDist})`);
    }
    await page.screenshot({ path: path.join(OUT_DIR, 'e01_repro_star1_centered.png') });

    // 2. E1: Pulsar system L3 -> L4 Planet Orbiting Pulsar (lighthouse beams rendered!) -> Back out preserves Pulsar!
    const pulsarFlow = await page.evaluate(async () => {
      const d = window.__ulgUniversesDemo;
      await d.selectCausalStarSite({ posGal: [5.2, 0.08, 1.4], popTag: 0.68, starIndex: 777, forceExoticStage: 'neutron-star' });
      await d.setLevel(3, { instant: true });
      for (let i = 0; i < 4; i += 1) await d.stepOnce();
      const stL3 = d.getState();
      return {
        stellarModeL3: stL3.stellarMode,
        planetCount: stL3.causalPlanetCount,
        magFloats: stL3.magnetosphereStreamlineFloats
      };
    });
    assert.equal(pulsarFlow.stellarModeL3, 'pulsar', 'Pulsar causal site must enter L3 pulsar magnetosphere mode');
    assert.ok(pulsarFlow.planetCount >= 2, `Pulsar must synthesize fallback-disk planets, got ${pulsarFlow.planetCount}`);
    await page.screenshot({ path: path.join(OUT_DIR, 'e02_pulsar_l3_core.png') });

    // Enter L4 orbit around a planet orbiting the Pulsar and orient camera so BOTH planet and pulsar beams are visible in orbit!
    const pulsarPlanetCheck = await page.evaluate(async () => {
      const d = window.__ulgUniversesDemo;
      await d.setLevel(4, { instant: true });
      d.orientCameraTowardHostStar();
      await d.stepOnce();
      const stL4 = d.getState();
      const lum = d.getStarIllumination();
      return { level: stL4.level, exoticStage: lum?.exoticStage, starRgb: lum?.rgb };
    });
    assert.equal(pulsarPlanetCheck.level, 4);
    assert.equal(pulsarPlanetCheck.exoticStage, 'neutron-star', 'Planet in pulsar system must receive pulsar starlight');
    assert.ok(pulsarPlanetCheck.starRgb[2] > pulsarPlanetCheck.starRgb[0], 'Pulsar illumination must be cyan-violet');
    await page.screenshot({ path: path.join(OUT_DIR, 'e03_pulsar_planet_orbit.png') });

    // Back out to L3 star — verify pulsar identity is 100% PRESERVED!
    const pulsarBackOut = await page.evaluate(async () => {
      const d = window.__ulgUniversesDemo;
      await d.setLevel(2, { instant: true });
      await d.setLevel(3, { instant: true });
      await d.stepOnce();
      return d.getState();
    });
    assert.equal(pulsarBackOut.stellarMode, 'pulsar', 'Backing out from pulsar planet to host star MUST preserve pulsar mode!');
    await page.screenshot({ path: path.join(OUT_DIR, 'e04_pulsar_backout_preserved.png') });

    // 3. E2 + E3: Realistic Starlight Spectrum & Inverse-Square Distance Illumination (Mercury vs Earth vs Pluto) + Biosignature Scanner
    await page.evaluate(async () => {
      const d = window.__ulgUniversesDemo;
      await d.setUseSolReference(true);
      await d.setLevel(4, { instant: true });
      await d.focusSolarBody('mercury');
      await d.stepOnce();
    });
    const mercLum = await sampleCenterCanvasLuminance(page);
    const mercIllum = await page.evaluate(() => window.__ulgUniversesDemo.getStarIllumination());
    await page.screenshot({ path: path.join(OUT_DIR, 'e05_starlight_mercury_bright.png') });

    await page.evaluate(async () => {
      const d = window.__ulgUniversesDemo;
      await d.focusSolarBody('pluto');
      await d.stepOnce();
    });
    const plutoLum = await sampleCenterCanvasLuminance(page);
    const plutoIllum = await page.evaluate(() => window.__ulgUniversesDemo.getStarIllumination());
    await page.screenshot({ path: path.join(OUT_DIR, 'e06_starlight_pluto_twilight.png') });

    assert.ok(mercIllum.fluxGain > plutoIllum.fluxGain * 3.5, `Mercury flux (${mercIllum.fluxGain}) must far exceed Pluto (${plutoIllum.fluxGain})`);
    assert.ok(mercLum > plutoLum * 1.15, `Mercury rendered luminance (${mercLum.toFixed(1)}) must exceed outer-system Pluto twilight (${plutoLum.toFixed(1)})`);

    // Earth Orbital Remote-Sensing Biosignature + Minerals in Unified Command Deck Scan tab
    const earthBio = await page.evaluate(async () => {
      const d = window.__ulgUniversesDemo;
      await d.focusSolarBody('earth');
      await d.stepOnce();
      return {
        rs: d.getOrbitalRemoteSensing(),
        boxHtml: document.getElementById('uv-remote-sensing-box')?.innerText || ''
      };
    });
    assert.equal(earthBio.rs?.biosignatureLevel, 'strong');
    assert.ok(earthBio.boxHtml.includes('BIOSIGNATURE'), `Orbital remote-sensing box must show biosignature badge, got: ${earthBio.boxHtml}`);
    assert.ok(earthBio.boxHtml.includes('SiO'), `Orbital remote-sensing box must show surface mineral hints, got: ${earthBio.boxHtml}`);
    await page.screenshot({ path: path.join(OUT_DIR, 'e07_earth_biosignature_scanner.png') });

    // 4. E5: Unified Command Deck EM Tab (cleanly docked, zero overlap!)
    await page.locator('#uv-em-sensor-btn').click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, 'e08_command_deck_em_tab.png') });

    // 5. E4 + E5: Global 6-DOF UFO Free-Flight Mode + X/Y/Z Quaternion Rotation + Wide Chase Zoom-Out (12x) + Xbox Gamepad!
    await page.locator('#uv-flight-btn').click();
    const ufoCheck = await page.evaluate(async () => {
      const d = window.__ulgUniversesDemo;
      d.setFlightMode('ufo');
      d.setUfoChaseZoom(8.5);
      // Rotate along ALL 3 axes: X pitch +32 deg, Y yaw +38 deg, Z roll +125 deg!
      d.rotateUfoLocal(0.56, 0.66, 2.18);
      // Inject mock Xbox Gamepad thrust & step 6 frames (~0.48s)!
      const pos0 = [...d.getFlightState().pos];
      d.applyMockGamepad({
        connected: true,
        id: 'Xbox Wireless Controller (STANDARD)',
        axes: [0.0, -0.9, 0.2, 0.0],
        buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
      });
      for (let k = 0; k < 6; k += 1) d.stepUfoSpace(0.08);
      d.applyMockGamepad(null);
      const fs = d.getFlightState();
      const moved = Math.hypot(fs.pos[0] - pos0[0], fs.pos[1] - pos0[1], fs.pos[2] - pos0[2]);
      return { fs, moved };
    });
    assert.equal(ufoCheck.fs.mode, 'ufo');
    assert.ok(ufoCheck.fs.chaseDistMul >= 8.0, 'Chase zoom-out must reach wide panoramic distance');
    assert.ok(Math.abs(ufoCheck.fs.eulerDeg.rollDeg) > 40, `Ship must visibly rotate along Z roll (got ${ufoCheck.fs.eulerDeg.rollDeg} deg)`);
    assert.ok(ufoCheck.moved > 0.5, `Xbox Gamepad thrust must fly saucer in 3D space (moved=${ufoCheck.moved.toFixed(2)})`);
    await page.screenshot({ path: path.join(OUT_DIR, 'e09_flight_tab_ufo_6dof_wayout.png') });

    const finalState = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(finalState.gpuErrorCount, 0, `Final GPU errors: ${JSON.stringify(finalState.gpuErrors)}`);

    // 6. Star-system clean unloading: Black Hole / X-Ray Binary + Deployed Probes + Planet Surface MUST fully unload on exit to L1 & switch to Sol!
    const unloadCheck = await page.evaluate(async () => {
      const d = window.__ulgUniversesDemo;
      d.setFlightMode('orbit');
      await d.selectCausalStarSite({ posGal: [4.2, 0.05, -2.1], popTag: 0.72, starIndex: 888, forceExoticStage: 'stellar-black-hole' });
      await d.setLevel(3, { instant: true });
      await d.setSolarMode('xray-binary');
      d.deployVonNeumannProbe();
      await d.stepOnce();
      const insideBhSys = d.getState();

      // Leave star system back to L1 Galaxy!
      await d.setLevel(1, { instant: true });
      await d.stepOnce();
      const afterLeaveL1 = d.getState();

      // Enter Sol Reference L2 — neither the BH nor the previous system's probes may bleed over!
      await d.setUseSolReference(true);
      await d.setLevel(2, { instant: true });
      await d.stepOnce();
      const inSolL2 = d.getState();
      return { insideBhSys, afterLeaveL1, inSolL2 };
    });
    assert.equal(unloadCheck.insideBhSys.hasActiveBlackHoleSession, true, 'Black hole / XRB system must have active BH session inside system');
    assert.ok(unloadCheck.insideBhSys.visibleProbesInScene >= 1, 'Deployed probe must be visible inside its home star system');
    assert.equal(unloadCheck.afterLeaveL1.hasActiveBlackHoleSession, false, 'Leaving star system to L1 Galaxy MUST dispose BH/XRB sessions');
    assert.equal(unloadCheck.afterLeaveL1.solarMode, 'nbody', 'Leaving star system MUST reset solarMode to nbody');
    assert.equal(unloadCheck.afterLeaveL1.stellarMode, 'fusion', 'Leaving star system MUST reset stellarMode');
    assert.equal(unloadCheck.afterLeaveL1.visibleProbesInScene, 0, 'Leaving star system to L1 Galaxy MUST hide probes');
    assert.equal(unloadCheck.inSolL2.hasActiveBlackHoleSession, false, 'Switching to Sol MUST NOT retain previous system BH session');
    assert.equal(unloadCheck.inSolL2.visibleProbesInScene, 0, 'Switching to Sol MUST NOT show probes deployed in another star system');
    await page.screenshot({ path: path.join(OUT_DIR, 'e10_clean_sol_after_bh_unload.png') });

    // 7. Bio Lab & Organic Chem Lab Accordion Menu integrity (ZERO flexbox-squished pancake bars!)
    const bioPage = await context.newPage();
    bioPage.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[bio] ${m.text()}`); });
    bioPage.on('pageerror', (e) => pageErrors.push(`[bio] ${String(e)}`));
    await bioPage.goto(`${BASE_URL}/life-lab.html?xeno=1&world=Eridani-679+b&tempK=330&solvent=H2SO4&species=Caelibulla+caerulea&plan=aero-gasbag&kingdom=fauna`, { waitUntil: 'domcontentloaded' });
    await bioPage.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.()?.ready), null, { timeout: 45000 });
    await bioPage.waitForTimeout(450);
    const bioAcc = await bioPage.evaluate(() => {
      const grps = [...document.querySelectorAll('#life-sidebar .acc-group')];
      return grps.map((g) => ({
        group: g.dataset.group,
        open: g.classList.contains('open'),
        active: g.classList.contains('active-group'),
        height: Math.round(g.getBoundingClientRect().height),
        headerHeight: Math.round(g.querySelector('.acc-header')?.getBoundingClientRect().height || 0)
      }));
    });
    assert.equal(bioAcc.length, 6, 'Bio Lab must have 6 accordion groups');
    assert.ok(bioAcc.every((g) => g.height >= 28 && g.headerHeight >= 26), `ZERO Bio Lab accordion groups may squish below 28px! Got: ${JSON.stringify(bioAcc)}`);
    assert.equal(bioAcc.find((g) => g.group === 'vivarium')?.open, true, 'Abducted Bio-Aquarium accordion group must auto-open');
    await bioPage.screenshot({ path: path.join(OUT_DIR, 'e11_bio_lab_accordion_clean.png') });
    await bioPage.close();

    const orgPage = await context.newPage();
    orgPage.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[org] ${m.text()}`); });
    orgPage.on('pageerror', (e) => pageErrors.push(`[org] ${String(e)}`));
    await orgPage.goto(`${BASE_URL}/organic-lab.html`, { waitUntil: 'domcontentloaded' });
    await orgPage.waitForFunction(() => Boolean(window.__ulgOrganicLab?.getState?.()?.ready), null, { timeout: 45000 });
    await orgPage.waitForTimeout(450);
    const orgAcc = await orgPage.evaluate(() => {
      const grps = [...document.querySelectorAll('#org-sidebar .acc-group')];
      return grps.map((g) => ({
        group: g.dataset.group,
        open: g.classList.contains('open'),
        active: g.classList.contains('active-group'),
        height: Math.round(g.getBoundingClientRect().height),
        headerHeight: Math.round(g.querySelector('.acc-header')?.getBoundingClientRect().height || 0)
      }));
    });
    assert.equal(orgAcc.length, 5, 'Organic Chem Lab must have 5 accordion groups');
    assert.ok(orgAcc.every((g) => g.height >= 28 && g.headerHeight >= 26), `ZERO Organic Lab accordion groups may squish below 28px! Got: ${JSON.stringify(orgAcc)}`);
    assert.equal(orgAcc.find((g) => g.group === 'nanotech')?.open, true, 'Active Nanotech accordion group must start open');
    await orgPage.screenshot({ path: path.join(OUT_DIR, 'e12_organic_lab_accordion_clean.png') });
    await orgPage.close();

    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join('; ')}`);
    assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});
