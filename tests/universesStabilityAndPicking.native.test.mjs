import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

// Native Vulkan Multi-Frame Stability, Emergent GPU 3D MHD B-Fields, & Universal Click-to-Inspect
// Verification & Visual Watch Suite for ULG Universes (`universes.html`):
//   1. L1 Spiral Galaxy (32^3 CIC 3D-FFT PM + Direct SMBH + Velocity-Verlet):
//      Multi-frame evolution t=0 -> t=40 -> t=100 proving rock-solid flat-disk stability
//      (no blowup, no square grid clumping) + live GPU 24^3 α-ω Dynamo B-streamlines +
//      falsifiable B0=0 null limit (exact 0 magnetic energy & 0 streamlines!) + live GPU star click & focus!
//   2. L3 Main-Sequence Star (Stabilized Hydro + Lane-Emden Convective IC):
//      Multi-frame evolution t=0 -> t=40 -> t=100 proving smooth hydrostatic core stability
//      (no grid-cell bouncing) + live GPU 24^3 Stellar Convective Dynamo B-streamlines +
//      falsifiable B0=0 null limit + live GPU plasma parcel click & focus!
//   3. L3 Magnetar & Nebular MHD:
//      Live GPU 24^3 Force-Free/Hall-Twist B(x,y,z) streamlines + persistent GPU plasma parcel click!
//   4. Universal Click-to-Inspect & Zoom across L0 Cosmic Web, L2 Kerr Quasar, L5 MD Atom, & L7 Nucleon!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_DEV_URL || process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_UNIVERSES_STABILITY_SHOT_DIR || '';

test('ULG Universes multi-frame Galaxy/Star stability, emergent GPU 3D MHD B-fields & universal click-to-inspect', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan stability & picking suite',
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

  const snap = async (page, name) => {
    const dataUrl = await page.evaluate(() => window.__ulgUniversesDemo.capturePng());
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    if (name && SHOT_DIR) {
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

    await page.goto(`${BASE_URL.replace(/\/$/, '')}/universes.html?level=1&quality=med`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });
    // Pause auto rAF stepping so we control exact step counts cleanly
    await page.evaluate(() => { document.getElementById('uv-pause-btn')?.click(); });
    await page.evaluate(() => window.__ulgUniversesDemo.setCameraAngles(0.55, 0.72));

    // ---- 1. L1 SPIRAL GALAXY MULTI-FRAME STABILITY + EMERGENT GPU α-ω DYNAMO ----
    const galSt0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(galSt0.galacticGravityMode, 'webgpu-schroeder-scale-atlas-multipole', 'L1 Galaxy must use canonical Schroeder Scale-Atlas 3D multipole + NFW Dark Matter Halo + direct SMBH');
    assert.ok(galSt0.galacticDynamoStreamlineFloats > 200, `Expected emergent galactic dynamo streamlines > 200 floats (got ${galSt0.galacticDynamoStreamlineFloats})`);
    assert.ok(galSt0.galacticDynamoMagEnergy > 0, `Expected positive emergent galactic dynamo energy (got ${galSt0.galacticDynamoMagEnergy})`);
    const galDiag0 = await page.evaluate(() => window.__ulgUniversesDemo.readGalaxyDiagnostics());
    const fGal0 = await snap(page, '01-galaxy-t0');

    // Evolve 40 steps -> capture t=40
    await page.evaluate(async () => { for (let i = 0; i < 40; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const fGal40 = await snap(page, '02-galaxy-t40');

    // Evolve 60 more steps (total 100 steps!) -> capture t=100
    await page.evaluate(async () => { for (let i = 0; i < 60; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const galDiag100 = await page.evaluate(() => window.__ulgUniversesDemo.readGalaxyDiagnostics());
    const fGal100 = await snap(page, '03-galaxy-t100');

    const galMotion = comparePhysicalPixelPngFrames(fGal0, fGal100);
    assert.ok(galMotion.changedPixelCount > 8000, `Galaxy must visibly rotate over 100 steps (changed=${galMotion.changedPixelCount})`);
    const galRadRatio = galDiag100.meanRadius / Math.max(1e-3, galDiag0.meanRadius);
    assert.ok(galRadRatio > 0.72 && galRadRatio < 1.32, `Galaxy radial profile drifted excessively over 100 steps: r0=${galDiag0.meanRadius.toFixed(2)}, r100=${galDiag100.meanRadius.toFixed(2)} (ratio=${galRadRatio.toFixed(2)})`);
    assert.ok(galDiag100.rmsHeightZ < 2.2, `Galaxy disk overheated vertically (rmsHeightZ=${galDiag100.rmsHeightZ.toFixed(2)})`);
    assert.ok(galDiag100.escapedFrac < 0.04, `Too many galaxy stars escaped (${(galDiag100.escapedFrac * 100).toFixed(1)}%)`);

    // Falsifiable Galactic Dynamo Null Limit: B0 = 0 -> exact 0 magnetic energy & 0 streamlines!
    const galNullSt = await page.evaluate(() => window.__ulgUniversesDemo.setGalacticB0(0.0));
    assert.equal(galNullSt.galacticDynamoStreamlineFloats, 0, 'Galactic dynamo B0=0 must produce 0 streamlines');
    assert.ok((galNullSt.galacticDynamoMagEnergy ?? 0) < 1e-6, `Galactic dynamo B0=0 must have 0 magnetic energy (got ${galNullSt.galacticDynamoMagEnergy})`);
    await page.evaluate(() => window.__ulgUniversesDemo.setGalacticB0(0.30));

    // ---- 1B. LONG-HORIZON ALL-12-PRESET GALAXY STABILITY SWEEP (300 STEPS EACH!) ----
    const galaxySweepPresets = [
      'disk', 'barred', 'ring', 'lenticular', 'sphere', 'binary',
      'irregular', 'dwarf-stream', 'globular', 'open-cluster', 'proto', 'coalesce'
    ];
    report.galaxySweep = {};
    for (const gp of galaxySweepPresets) {
      await page.evaluate(async (presetName) => {
        await window.__ulgUniversesDemo.initGalaxyPreset(presetName);
      }, gp);
      const d0 = await page.evaluate(() => window.__ulgUniversesDemo.readGalaxyDiagnostics());
      await page.evaluate(async () => {
        for (let i = 0; i < 300; i += 1) await window.__ulgUniversesDemo.stepOnce();
      });
      const d300 = await page.evaluate(() => window.__ulgUniversesDemo.readGalaxyDiagnostics());
      const ratio3d = d300.meanRadius3d / Math.max(1e-3, d0.meanRadius3d);
      const isDynamic = gp === 'coalesce' || gp === 'binary' || gp === 'irregular';
      const minRatio = isDynamic ? 0.42 : 0.72;
      const maxRatio = isDynamic ? 1.45 : 1.32;
      const maxEsc = gp === 'binary' ? 0.08 : (isDynamic ? 0.05 : 0.035);
      assert.ok(
        ratio3d >= minRatio && ratio3d <= maxRatio,
        `Galaxy "${gp}" unstable over 300 steps: r3d0=${d0.meanRadius3d.toFixed(2)} -> r3d300=${d300.meanRadius3d.toFixed(2)} (ratio=${ratio3d.toFixed(2)})`
      );
      assert.ok(
        d300.escapedFrac < maxEsc,
        `Galaxy "${gp}" ejected too many stars over 300 steps: ${(d300.escapedFrac * 100).toFixed(2)}% (limit ${(maxEsc * 100).toFixed(1)}%)`
      );
      if (gp !== 'binary') {
        assert.ok(d300.comDist < 1.25, `Galaxy "${gp}" COM wandered excessively over 300 steps (comDist=${d300.comDist.toFixed(2)})`);
        assert.ok(d300.smbhDist < 1.60, `Galaxy "${gp}" central core wandered excessively (smbhDist=${d300.smbhDist.toFixed(2)})`);
      }
      if (gp === 'disk' || gp === 'barred' || gp === 'sphere' || gp === 'binary' || gp === 'ring') {
        await snap(page, `03b-galaxy-${gp}-t300`);
      }
      report.galaxySweep[gp] = {
        r0: Number(d0.meanRadius3d.toFixed(2)),
        r300: Number(d300.meanRadius3d.toFixed(2)),
        ratio: Number(ratio3d.toFixed(2)),
        escapedPct: Number((d300.escapedFrac * 100).toFixed(2)),
        comDist: Number(d300.comDist.toFixed(2)),
        smbhDist: Number(d300.smbhDist.toFixed(2))
      };
    }
    // Restore default disk galaxy for picking test
    await page.evaluate(async () => { await window.__ulgUniversesDemo.initGalaxyPreset('disk'); });

    // Universal GPU Star Picking + Real Wheel-Zoom Target Approach on L1 Galaxy (U9)!
    const pickedStar = await page.evaluate(() => window.__ulgUniversesDemo.pickAtCanvasFraction(0.62, 0.46, { preferGpuMote: true }));
    assert.ok(pickedStar && pickedStar.kind === 'galaxy-star' && pickedStar.index >= 0, `Expected GPU star pick on L1 (got ${JSON.stringify(pickedStar)})`);
    const galInspName = await page.locator('#uv-target-name').textContent();
    assert.ok(galInspName.includes(`#${pickedStar.index}`), `Inspector must show picked GPU star index #${pickedStar.index} (got "${galInspName}")`);
    // Smoothly approach the picked off-center star using REAL mouse-wheel zoom events!
    for (let w = 0; w < 14; w += 1) {
      await page.mouse.move(680, 410);
      await page.mouse.wheel(0, -140);
      await page.evaluate(() => new Promise((r) => setTimeout(r, 45)));
      await page.evaluate(() => window.__ulgUniversesDemo.stepOnce());
    }
    const starAfterZoom = await page.evaluate(() => window.__ulgUniversesDemo.getTargetScreenCoords('picked-mote'));
    assert.ok(
      starAfterZoom && starAfterZoom.visible && starAfterZoom.dxCenter < 110,
      `Wheel-zooming toward picked L1 star must smoothly center & approach it (got ${JSON.stringify(starAfterZoom)})`
    );
    await snap(page, '04-galaxy-picked-star-zoomed');

    report.galaxy = {
      gravityMode: galSt0.galacticGravityMode,
      r0: Number(galDiag0.meanRadius.toFixed(2)),
      r100: Number(galDiag100.meanRadius.toFixed(2)),
      rmsZ100: Number(galDiag100.rmsHeightZ.toFixed(2)),
      escapedPct: Number((galDiag100.escapedFrac * 100).toFixed(2)),
      dynamoEnergy: Number(galSt0.galacticDynamoMagEnergy.toFixed(2)),
      dynamoNullEnergy: Number((galNullSt.galacticDynamoMagEnergy || 0).toFixed(4)),
      pickedStar: pickedStar.name
    };

    // ---- 2. L3 HYDROSTATIC MAIN-SEQUENCE STAR STABILITY + EMERGENT GPU STELLAR DYNAMO ----
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setUseSolReference?.(true);
      await window.__ulgUniversesDemo.setLevel(3, { instant: true });
    });
    await page.evaluate(() => window.__ulgUniversesDemo.setCameraAngles(0.52, 0.34));
    const st0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(st0.stellarPreset, 'main-sequence-star', 'L3 default fusion preset must be hydrostatic main-sequence-star');
    assert.ok(st0.stellarDynamoStreamlineFloats > 200, `Expected emergent stellar dynamo streamlines > 200 floats (got ${st0.stellarDynamoStreamlineFloats})`);
    assert.ok(st0.stellarDynamoMagEnergy > 0, `Expected positive emergent stellar dynamo energy (got ${st0.stellarDynamoMagEnergy})`);
    const starDiag0 = await page.evaluate(() => window.__ulgUniversesDemo.readStellarDiagnostics());
    const fStar0 = await snap(page, '05-star-t0');

    await page.evaluate(async () => { for (let i = 0; i < 40; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const fStar40 = await snap(page, '06-star-t40');

    await page.evaluate(async () => { for (let i = 0; i < 60; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const starDiag100 = await page.evaluate(() => window.__ulgUniversesDemo.readStellarDiagnostics());
    const fStar100 = await snap(page, '07-star-t100');

    assert.ok(starDiag100.meanRadius > 1.2 && starDiag100.meanRadius < 5.0, `Star mean radius unstable at t=100 (r=${starDiag100.meanRadius.toFixed(2)})`);
    assert.ok(starDiag100.rmsSpeed < 6.0, `Star particles bouncing violently (rmsSpeed=${starDiag100.rmsSpeed.toFixed(2)})`);
    assert.ok(starDiag100.boundFrac > 0.88, `Star lost too much bound mass (boundFrac=${starDiag100.boundFrac.toFixed(2)})`);
    assert.ok(starDiag100.coreTempK > 5e6, `Main-sequence star core temp must sustain fusion >5 MK (got ${starDiag100.coreTempK})`);

    // Falsifiable Stellar Dynamo Null Limit: B0 = 0 -> exact 0 streamlines & 0 energy!
    const starNullSt = await page.evaluate(() => window.__ulgUniversesDemo.setStellarB0(0.0));
    assert.equal(starNullSt.stellarDynamoStreamlineFloats, 0, 'Stellar dynamo B0=0 must produce 0 streamlines');
    assert.ok((starNullSt.stellarDynamoMagEnergy ?? 0) < 1e-6, 'Stellar dynamo B0=0 must have 0 magnetic energy');
    await page.evaluate(() => window.__ulgUniversesDemo.setStellarB0(0.36));

    // Live GPU Stellar Plasma Parcel Click & Inspect!
    const pickedPlasma = await page.evaluate(() => window.__ulgUniversesDemo.pickAtCanvasFraction(0.51, 0.50, { preferGpuMote: true }));
    assert.ok(pickedPlasma && pickedPlasma.kind === 'stellar-hydro-parcel', `Expected GPU plasma parcel pick on L3 (got ${JSON.stringify(pickedPlasma)})`);
    await snap(page, '08-star-picked-parcel');

    report.star = {
      r0: Number(starDiag0.meanRadius.toFixed(2)),
      r100: Number(starDiag100.meanRadius.toFixed(2)),
      rmsSpd100: Number(starDiag100.rmsSpeed.toFixed(2)),
      boundPct: Number((starDiag100.boundFrac * 100).toFixed(1)),
      coreTempMK: Number((starDiag100.coreTempK / 1e6).toFixed(2)),
      dynamoEnergy: Number(st0.stellarDynamoMagEnergy.toFixed(2)),
      pickedParcel: pickedPlasma.name
    };

    // ---- 3. L3 MAGNETAR (EMERGENT 24^3 FORCE-FREE MHD + PERSISTENT PARCEL PICK) & NEBULAR MHD ----
    await page.evaluate(() => window.__ulgUniversesDemo.setStellarMode('magnetar'));
    await page.evaluate(async () => { for (let i = 0; i < 16; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const magSt = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(magSt.magnetosphereStreamlineFloats > 200, `Expected emergent magnetar 3D B-streamlines > 200 floats (got ${magSt.magnetosphereStreamlineFloats})`);
    const pickedMag = await page.evaluate(() => window.__ulgUniversesDemo.pickAtCanvasFraction(0.52, 0.48, { preferGpuMote: true }));
    assert.ok(pickedMag && pickedMag.kind === 'mag-parcel', `Expected persistent magnetar GPU parcel pick (got ${JSON.stringify(pickedMag)})`);
    await snap(page, '09-magnetar-emergent-mhd');

    await page.evaluate(() => window.__ulgUniversesDemo.setStellarMode('nebular-mhd'));
    await page.evaluate(async () => { for (let i = 0; i < 10; i += 1) await window.__ulgUniversesDemo.stepOnce(); });
    const pickedNeb = await page.evaluate(() => window.__ulgUniversesDemo.pickAtCanvasFraction(0.50, 0.50, { preferGpuMote: true }));
    assert.ok(pickedNeb && pickedNeb.kind === 'nebula-mhd-parcel', `Expected GPU MHD nebula parcel pick (got ${JSON.stringify(pickedNeb)})`);
    await snap(page, '10-nebula-mhd-emergent');

    // ---- 4. UNIVERSAL CLICK-TO-INSPECT ACROSS L0 COSMIC WEB, L2 KERR QUASAR, L5 MD ATOM, & L7 NUCLEON ----
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(0, { instant: true }));
    const pickedCosmo = await page.evaluate(() => window.__ulgUniversesDemo.pickAtCanvasFraction(0.50, 0.50, { preferGpuMote: true }));
    assert.ok(pickedCosmo && pickedCosmo.kind === 'cosmo-web', `Expected L0 cosmic-web GPU mote pick (got ${JSON.stringify(pickedCosmo)})`);
    await snap(page, '11-cosmo-picked-mote');

    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(2, { instant: true }));
    await page.evaluate(() => window.__ulgUniversesDemo.setSolarMode('quasar-jet'));
    const pickedQuasar = await page.evaluate(() => window.__ulgUniversesDemo.pickAtCanvasFraction(0.51, 0.48, { preferGpuMote: true }));
    assert.ok(pickedQuasar && pickedQuasar.kind === 'kerr-parcel', `Expected L2 Kerr Quasar GPU parcel pick (got ${JSON.stringify(pickedQuasar)})`);
    await snap(page, '12-quasar-picked-parcel');

    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(5, { instant: true }));
    const pickedMd = await page.evaluate(() => window.__ulgUniversesDemo.pickAtCanvasFraction(0.50, 0.50, { preferGpuMote: true }));
    assert.ok(pickedMd && pickedMd.kind === 'md-atom', `Expected L5 MD crystal GPU atom pick (got ${JSON.stringify(pickedMd)})`);
    await snap(page, '13-md-picked-atom');

    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(7, { instant: true }));
    const pickedNuc = await page.evaluate(() => window.__ulgUniversesDemo.pickAtCanvasFraction(0.50, 0.50, { preferGpuMote: true }));
    assert.ok(pickedNuc && pickedNuc.kind === 'nucleon', `Expected L7 quantized proton/neutron pick (got ${JSON.stringify(pickedNuc)})`);
    await snap(page, '14-nucleus-picked-nucleon');

    // ---- 5. U13 + U9 PLANET-CLICK RETICLE SYNC & REAL WHEEL-ZOOM TARGET APPROACH ON L2 PLANET (SATURN!) ----
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setUseSolReference?.(true);
      await window.__ulgUniversesDemo.setLevel(2, { instant: true });
      await window.__ulgUniversesDemo.stepOnce();
    });
    const satBefore = await page.evaluate(() => {
      const pre = window.__ulgUniversesDemo.getTargetScreenCoords('saturn');
      window.__ulgUniversesDemo.selectTarget('saturn');
      const t0 = window.__ulgUniversesDemo.getTargetScreenCoords('saturn');
      return { pre, t0 };
    });
    assert.ok(satBefore.pre && satBefore.pre.visible && satBefore.pre.dxCenter > 80, `Saturn should start off-center in barycenter L2 view (got ${JSON.stringify(satBefore.pre)})`);
    // Let the smooth perspective glide run for ~500 ms WITHOUT zooming (U13): reticle MUST glide to dead-center in lockstep with 3D Saturn!
    for (let g = 0; g < 14; g += 1) {
      await page.evaluate(() => new Promise((r) => setTimeout(r, 40)));
      await page.evaluate(() => window.__ulgUniversesDemo.stepOnce());
    }
    const satGlided = await page.evaluate(() => window.__ulgUniversesDemo.getTargetScreenCoords('saturn'));
    assert.ok(
      satGlided && satGlided.visible && satGlided.dxCenter < 22,
      `U13: Clicking Saturn must glide its 2D reticle smoothly to center in lockstep with the shifted 3D perspective (before=${JSON.stringify(satBefore.pre)}, glided=${JSON.stringify(satGlided)})`
    );
    // Mid-flight L2 check (8 wheel ticks: 12.6 -> ~9.9, still at L2!) must keep Saturn dead-center!
    for (let w = 0; w < 8; w += 1) {
      await page.mouse.move(680, 410);
      await page.mouse.wheel(0, -140);
      await page.evaluate(() => new Promise((r) => setTimeout(r, 45)));
      await page.evaluate(() => window.__ulgUniversesDemo.stepOnce());
    }
    const satMid = await page.evaluate(() => ({
      coords: window.__ulgUniversesDemo.getTargetScreenCoords('saturn'),
      st: window.__ulgUniversesDemo.getState()
    }));
    assert.ok(
      satMid.coords && satMid.coords.visible && satMid.coords.dxCenter < 35,
      `Mid-flight wheel-zoom toward L2 Saturn must keep Saturn centered cleanly (before=${JSON.stringify(satBefore.pre)}, mid=${JSON.stringify(satMid.coords)}, span=${satMid.st.log10ViewSpanM})`
    );
    // Continue scrolling IN (8 more ticks) -> arrives seamlessly into L4 Saturn orbit!
    for (let w = 0; w < 8; w += 1) {
      await page.mouse.move(680, 410);
      await page.mouse.wheel(0, -140);
      await page.evaluate(() => new Promise((r) => setTimeout(r, 45)));
      await page.evaluate(() => window.__ulgUniversesDemo.stepOnce());
    }
    const satArrived = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(satArrived.level, 4, `Continued wheel-zoom into Saturn must arrive at L4 (got L${satArrived.level})`);
    assert.equal(satArrived.focusedSolarBody, 'saturn', `Arrived L4 body must still be Saturn (got ${satArrived.focusedSolarBody})`);
    report.zoomTargetApproach = {
      l1StarDxCenter: Number(starAfterZoom.dxCenter.toFixed(1)),
      l2SaturnBeforeDx: satBefore.pre ? Number(satBefore.pre.dxCenter.toFixed(1)) : null,
      l2SaturnGlidedDx: Number(satGlided.dxCenter.toFixed(1)),
      l2SaturnMidDx: Number(satMid.coords.dxCenter.toFixed(1)),
      l2SaturnArrivedLevel: satArrived.level
    };

    // ---- 6. U11 DEFAULT BOOT INSIDE COSMIC WEB + PERPETUAL VISIBLE EXPANSION (NEVER FREEZES AT a=1.15!) ----
    const bootPage = await ctx.newPage();
    bootPage.on('pageerror', (e) => pageErrors.push(`[boot] ${String(e).slice(0, 300)}`));
    bootPage.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[boot] ${m.text().slice(0, 300)}`); });
    await bootPage.goto(`${BASE_URL.replace(/\/$/, '')}/universes.html?quality=med`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await bootPage.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });
    await bootPage.evaluate(() => { document.getElementById('uv-pause-btn')?.click(); });
    const bootSt0 = await bootPage.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(bootSt0.level, 0, 'Default boot must start at L0 Cosmic Web');
    assert.ok(
      bootSt0.log10ViewSpanM >= 25.0 && bootSt0.log10ViewSpanM <= 25.85,
      `Default boot must place camera INSIDE the middle of the Cosmic Web (~25.45), got ${bootSt0.log10ViewSpanM}`
    );
    const fBoot0 = await snap(bootPage, '15-boot-inside-cosmic-web-t0');
    // Step 220 frames at elevated timescale so scale factor expands cleanly past old a=1.15 freeze!
    await bootPage.evaluate(async () => {
      const ts = document.getElementById('uv-timescale-slider');
      if (ts) { ts.value = '3.0'; ts.dispatchEvent(new Event('input', { bubbles: true })); }
      for (let i = 0; i < 220; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const bootSt220 = await bootPage.evaluate(() => window.__ulgUniversesDemo.getState());
    const fBoot220 = await snap(bootPage, '16-boot-cosmic-web-expanded-t220');
    await bootPage.evaluate(async () => {
      for (let i = 0; i < 60; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const bootSt280 = await bootPage.evaluate(() => window.__ulgUniversesDemo.getState());
    const expMotion = comparePhysicalPixelPngFrames(fBoot0, fBoot220);
    assert.ok(bootSt220.cosmoScaleFactorA > 1.18, `Cosmic expansion must NOT freeze at old a=1.15 clamp (got a=${bootSt220.cosmoScaleFactorA})`);
    assert.ok(bootSt280.cosmoScaleFactorA > bootSt220.cosmoScaleFactorA + 0.05, `Cosmic expansion must continue perpetually past a=1.18 (a220=${bootSt220.cosmoScaleFactorA}, a280=${bootSt280.cosmoScaleFactorA})`);
    assert.ok(expMotion.changedPixelCount > 12000, `Cosmic web expansion must visibly expand filaments across viewport (changed=${expMotion.changedPixelCount})`);
    report.cosmicBootAndExpansion = {
      bootSpan: bootSt0.log10ViewSpanM,
      a0: Number(bootSt0.cosmoScaleFactorA.toFixed(3)),
      a220: Number(bootSt220.cosmoScaleFactorA.toFixed(3)),
      a280: Number(bootSt280.cosmoScaleFactorA.toFixed(3)),
      changedPx: expMotion.changedPixelCount
    };
    await bootPage.close();

    const finalSt = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(finalSt.gpuErrorCount, 0, `GPU errors: ${finalSt.gpuErrors.join(' | ')}`);
    assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`);

    report.universalPicking = {
      cosmo: pickedCosmo.name,
      galaxy: pickedStar.name,
      quasar: pickedQuasar.name,
      star: pickedPlasma.name,
      magnetar: pickedMag.name,
      nebulaMhd: pickedNeb.name,
      mdAtom: pickedMd.name,
      nucleon: pickedNuc.name
    };
    console.log('[UNIVERSES_STABILITY_PICKING_REPORT]', JSON.stringify(report));
    await ctx.close();
  } finally {
    await browser.close();
  }
});
