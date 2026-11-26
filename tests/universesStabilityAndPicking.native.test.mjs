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
    assert.equal(galSt0.galacticGravityMode, 'webgpu-cic-3dfft-pm+smbh', 'L1 Galaxy must use smooth 32^3 CIC 3D-FFT PM + direct SMBH');
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

    // Universal GPU Star Picking + Focus on L1 Galaxy!
    const pickedStar = await page.evaluate(() => window.__ulgUniversesDemo.pickAtCanvasFraction(0.56, 0.52, { preferGpuMote: true }));
    assert.ok(pickedStar && pickedStar.kind === 'galaxy-star' && pickedStar.index >= 0, `Expected GPU star pick on L1 (got ${JSON.stringify(pickedStar)})`);
    const galInspName = await page.locator('#uv-target-name').textContent();
    assert.ok(galInspName.includes(`Star #${pickedStar.index}`), `Inspector must show picked GPU star name (got "${galInspName}")`);
    const galFocused = await page.evaluate(() => window.__ulgUniversesDemo.focusPickedMote({ zoomIn: false }));
    assert.equal(galFocused, true, 'focusPickedMote must lock onto clicked galaxy star');
    await snap(page, '04-galaxy-picked-star');

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
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(3, { instant: true }));
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
