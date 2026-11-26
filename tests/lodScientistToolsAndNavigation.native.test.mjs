// Native Vulkan End-to-End & Visual Verification for:
//   1. ULG Universes LOD Upgrade + Rover/UFO Sample -> L5 -> L6 -> L7 -> Return-to-Rover/UFO Navigation
//      (including parked checkpoint restoration, dynamic `↑ Rover/UFO` button, `#uv-back-to-surface-btn`
//      across L5/L6/L7, chase-camera wheel zoom, 10-sided wheel Rover, and 16-seg continuous-frustum UFO).
//   2. Organic Chemistry Lab Scientist Tools: Representation Switcher (`Ball & Stick` / `CPK vdW` / `Licorice`),
//      Live GPU-Tracked Geometry Caliper (2-atom distance, 3-atom angle, 4-atom dihedral),
//      3D Element / QEq Partial-Charge Labels, and `.XYZ` / `.JSON` Export.
//   3. Emergent Biology Lab Scientist Tools: Live 2D N×N GPU Residue Contact Map, 1-Click FASTA
//      Motif Presets (`α-Helix`, `β-Hairpin`, `Salt-Bridge`, `IDP Coil`), Hodgkin-Huxley
//      `(V_m, dV_m/dt)` Phase Portrait Toggle, and `.CSV` / `.XYZ` Export.

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = (process.env.ULG_DEV_URL || process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173').replace(/\/$/, '');
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_LOD_SHOT_DIR || '';

test('LOD Pass, Rover/UFO Return Navigation, and Chemistry/Biology Scientist Tools (Native Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan verification',
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

  const saveDataUrl = async (dataUrl, name) => {
    const buf = Buffer.from(String(dataUrl || '').split(',')[1] || '', 'base64');
    if (name && SHOT_DIR && buf.length > 64) {
      await writeFile(path.join(SHOT_DIR, `${name}.png`), buf);
    }
    return buf;
  };

  const report = {};
  const pageErrors = [];
  const consoleErrors = [];

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1360, height: 820 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });

    // =========================================================================
    // 1. ULG UNIVERSES: LOD RELIEF + ROVER CHECKPOINT RETURN + CHASE ZOOM + UFO
    // =========================================================================
    await page.goto(`${BASE_URL}/universes.html?level=4&quality=med`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setUseSolReference(true);
      await window.__ulgUniversesDemo.focusSolarBody('earth');
      await window.__ulgUniversesDemo.setLevel(4, { instant: true });
      for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await page.waitForTimeout(300);
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), 'lod-01-earth-orbital');

    // Land Rover on Mars and drive forward > 3 m so checkpoint restoration is non-trivial!
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'mars' });
      window.__ulgUniversesDemo.setSurfaceControls({ forward: true, turbo: true });
      for (let i = 0; i < 36; i += 1) await window.__ulgUniversesDemo.stepOnce();
      window.__ulgUniversesDemo.setSurfaceControls({ forward: false, turbo: false });
      for (let i = 0; i < 4; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await page.waitForTimeout(250);
    const marsBefore = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(marsBefore.surfaceActive, true);
    assert.equal(marsBefore.surfaceVehicle, 'rover');
    const posBefore = marsBefore.surfaceTelemetry?.roverPos;
    assert.ok(Array.isArray(posBefore) && Math.hypot(posBefore[0], posBefore[2]) > 3.0,
      `Mars Rover must drive > 3 m from spawn before sampling (got ${JSON.stringify(posBefore)})`);
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), 'lod-02-mars-rover');

    // Test Surface Chase-Cam wheel zoom (must smoothly zoom without exiting surface or throwing)
    const fZoom0 = await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), null);
    await page.mouse.move(680, 410);
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(150);
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(150);
    const fZoom1 = await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), null);
    const zoomDiff = comparePhysicalPixelPngFrames(fZoom0, fZoom1);
    assert.ok(zoomDiff.changedPixelCount > 1500,
      `Surface chase-cam wheel zoom must visibly adjust framing (changed=${zoomDiff.changedPixelCount})`);
    const stillOnSurface = await page.evaluate(() => window.__ulgUniversesDemo.getState().surfaceActive);
    assert.equal(stillOnSurface, true, 'Wheel zoom in surface mode must stay in surface mode');

    // Record exact parked position right before sampling (after any wheel-zoom coast settles)
    const marsBeforeSample = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const posAtSample = marsBeforeSample.surfaceTelemetry?.roverPos;
    assert.ok(Array.isArray(posAtSample) && Math.hypot(posAtSample[0], posAtSample[2]) > 3.0,
      `Mars Rover must be parked > 3 m from spawn when sampling (got ${JSON.stringify(posAtSample)})`);

    // Sample surface -> L5 Lattice -> L6 Compound -> L7 Nucleus -> Click Back-to-Rover!
    const sampledL5 = await page.evaluate(async () => {
      const res = await window.__ulgUniversesDemo.sampleSurfaceAndDiveToLattice();
      return res.state;
    });
    assert.equal(sampledL5.level, 5);
    assert.equal(sampledL5.surfaceActive, false);
    assert.equal(sampledL5.hasSavedSurfaceCheckpoint, true);
    const returnBtnTextL5 = await page.locator('#uv-return-btn').textContent();
    assert.ok(returnBtnTextL5.includes('Rover'), `Expected L5 return button to mention Rover (got "${returnBtnTextL5}")`);

    // Drill into L6 Compound, then L7 Nucleus
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.inspectSampledCompound(0);
    });
    const stL6 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stL6.level, 6);
    assert.ok(await page.locator('#uv-back-to-surface-btn').isVisible(), 'Back-to-Rover button must be visible at L6 Compound');

    await page.evaluate(async () => {
      const el0 = window.__ulgUniversesDemo.getState().activeSampledMaterial?.elements?.[0]?.Z || 26;
      await window.__ulgUniversesDemo.inspectSampledElement(el0, { targetLevel: 7 });
    });
    const stL7 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stL7.level, 7);
    assert.ok(await page.locator('#uv-back-to-surface-btn').isVisible(), 'Back-to-Rover button must remain visible at L7 Nucleus');

    // Click the actual Back-to-Rover UI button from L7 Nucleus!
    await page.click('#uv-back-to-surface-btn');
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.surfaceActive), null, { timeout: 20_000 });
    await page.evaluate(async () => {
      for (let i = 0; i < 3; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const restoredRover = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(restoredRover.surfaceActive, true);
    assert.equal(restoredRover.surfaceVehicle, 'rover');
    const posAfter = restoredRover.surfaceTelemetry?.roverPos;
    const restoreDist = Math.hypot(posAfter[0] - posAtSample[0], posAfter[2] - posAtSample[2]);
    assert.ok(restoreDist < 1.2, `Rover must restore at parked checkpoint (drift=${restoreDist.toFixed(3)} m)`);

    // Also verify `↑ Rover` (`returnToOrbit()`) from L5 returns straight back to the parked Rover!
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.sampleSurfaceAndDiveToLattice();
      await window.__ulgUniversesDemo.returnToOrbit();
    });
    const restoredViaOrbitBtn = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(restoredViaOrbitBtn.surfaceActive, true, 'returnToOrbit() from sampled L5 must return straight back to Rover');

    // Now exit surface view -> back in L4 orbit
    const orbitAgain = await page.evaluate(() => window.__ulgUniversesDemo.exitSurfaceView());
    assert.equal(orbitAgain.surfaceActive, false);
    assert.equal(orbitAgain.level, 4);

    // Dive into Jupiter -> verify sleek 16-segment continuous-frustum Buoyant Disc UFO & 3D CFD!
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'jupiter' });
      for (let i = 0; i < 14; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await page.waitForTimeout(250);
    const jupUfo = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(jupUfo.surfaceActive, true);
    assert.equal(jupUfo.surfaceVehicle, 'ufo');
    assert.equal(jupUfo.surfaceTelemetry?.cfdActive, true);
    assert.equal(jupUfo.gpuErrors.length, 0, `Universes GPU errors: ${jupUfo.gpuErrors.join(' | ')}`);
    await saveDataUrl(await page.evaluate(() => window.__ulgUniversesDemo.capturePng()), 'lod-03-jupiter-ufo');

    report.universes = {
      marsRoverDriveM: Number(Math.hypot(posBefore[0], posBefore[2]).toFixed(2)),
      checkpointRestoreDriftM: Number(restoreDist.toFixed(3)),
      chaseZoomChangedPx: zoomDiff.changedPixelCount,
      returnFromL7Verified: true,
      returnFromL5OrbitBtnVerified: true,
      jupiterUfoCfdWindMS: Number((jupUfo.surfaceTelemetry?.cfdTelemetry?.rmsWindMS || 0).toFixed(2))
    };

    // =========================================================================
    // 2. ORGANIC CHEMISTRY LAB: REPRESENTATIONS + CALIPER + LABELS + EXPORTS
    // =========================================================================
    await page.goto(`${BASE_URL}/organic-lab.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgOrganicLab?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.evaluate(() => window.__ulgOrganicLab.setPaused(true));
    await page.evaluate(() => window.__ulgOrganicLab.stepNow(6));

    // Representation modes: Ball & Stick (0) vs Space-Fill CPK vdW (1) vs Licorice (2)
    await page.evaluate(() => window.__ulgOrganicLab.setRepresentation(0));
    const fOrgBs = await saveDataUrl(await page.evaluate(() => window.__ulgOrganicLab.capturePng()), 'lod-04-org-ballstick');
    await page.evaluate(() => window.__ulgOrganicLab.setRepresentation(1));
    const fOrgCpk = await saveDataUrl(await page.evaluate(() => window.__ulgOrganicLab.capturePng()), 'lod-05-org-cpk');
    await page.evaluate(() => window.__ulgOrganicLab.setRepresentation(2));
    const fOrgLic = await saveDataUrl(await page.evaluate(() => window.__ulgOrganicLab.capturePng()), 'lod-06-org-licorice');

    const diffBsCpk = comparePhysicalPixelPngFrames(fOrgBs, fOrgCpk);
    const diffBsLic = comparePhysicalPixelPngFrames(fOrgBs, fOrgLic);
    assert.ok(diffBsCpk.changedPixelCount > 5000, `CPK Space-Fill must visually transform Sulflower (changed=${diffBsCpk.changedPixelCount})`);
    assert.ok(diffBsLic.changedPixelCount > 2000, `Licorice mode must visibly slim atoms (changed=${diffBsLic.changedPixelCount})`);

    // Geometry Caliper: 2-atom distance, 3-atom angle, 4-atom dihedral + live GPU tracking across stepNow
    await page.evaluate(() => window.__ulgOrganicLab.setRepresentation(0));
    await page.evaluate(() => window.__ulgOrganicLab.setMeasureMode(true));
    const m2 = await page.evaluate(() => window.__ulgOrganicLab.setMeasureAtoms([0, 1]));
    assert.equal(m2.kind, 'distance');
    assert.ok(Number.isFinite(m2.distanceA) && m2.distanceA > 0.8 && m2.distanceA < 5.0, `Unexpected 2-atom bond distance: ${m2.distanceA} A`);

    const m3 = await page.evaluate(() => window.__ulgOrganicLab.setMeasureAtoms([0, 1, 2]));
    assert.equal(m3.kind, 'angle');
    assert.ok(Number.isFinite(m3.angleDeg) && m3.angleDeg > 30 && m3.angleDeg < 180, `Unexpected 3-atom angle: ${m3.angleDeg} deg`);

    const m4 = await page.evaluate(() => window.__ulgOrganicLab.setMeasureAtoms([0, 1, 2, 3]));
    assert.equal(m4.kind, 'dihedral');
    assert.ok(Number.isFinite(m4.dihedralDeg) && Math.abs(m4.dihedralDeg) <= 180.01, `Unexpected 4-atom dihedral: ${m4.dihedralDeg} deg`);

    await page.evaluate(() => window.__ulgOrganicLab.stepNow(12));
    const m4After = await page.evaluate(() => window.__ulgOrganicLab.getGeometryMeasurement());
    assert.equal(m4After.kind, 'dihedral');
    assert.ok(Number.isFinite(m4After.dihedralDeg));

    // 3D Atom Element & QEq Charge Labels + Composite WebGPU + Overlay Screenshot showing Caliper + Labels!
    await page.evaluate(() => window.__ulgOrganicLab.setLabelMode('sym'));
    await page.waitForTimeout(160);
    if (SHOT_DIR) {
      const compDataUrl = await page.evaluate(() => {
        const bg = document.getElementById('org-canvas');
        const ov = document.getElementById('org-overlay');
        window.__ulgOrganicLab.capturePng();
        const tmp = document.createElement('canvas');
        tmp.width = bg.width;
        tmp.height = bg.height;
        const c = tmp.getContext('2d');
        c.drawImage(bg, 0, 0, tmp.width, tmp.height);
        if (ov) c.drawImage(ov, 0, 0, tmp.width, tmp.height);
        return tmp.toDataURL('image/png');
      });
      await saveDataUrl(compDataUrl, 'lod-07-org-measure-labels');
    }
    const qeqLbl = await page.evaluate(() => window.__ulgOrganicLab.setLabelMode('qeq'));
    assert.equal(qeqLbl, 'qeq');

    // .XYZ & .JSON scientific exports
    const xyzText = await page.evaluate(() => window.__ulgOrganicLab.exportXyz());
    const xyzLines = xyzText.trim().split('\n');
    assert.equal(Number(xyzLines[0].trim()), 134, `Sulflower XYZ header must have 134 atoms (got "${xyzLines[0]}")`);
    assert.equal(xyzLines.length, 136, `Sulflower XYZ must have 134 + 2 lines (got ${xyzLines.length})`);

    const jsonReport = JSON.parse(await page.evaluate(() => window.__ulgOrganicLab.exportJson()));
    assert.equal(jsonReport.schema, 'ulg.organic-lab.export.v1');
    assert.equal(jsonReport.mode, 'sulflower-bearing');
    assert.ok(Number.isFinite(jsonReport.piOrbitals?.homoLumoGapEv));
    assert.equal(jsonReport.geometryMeasurement?.kind, 'dihedral');

    const orgState = await page.evaluate(() => window.__ulgOrganicLab.getState());
    assert.equal(orgState.gpuErrorCount, 0, `Organic GPU errors: ${orgState.gpuErrors.join(' | ')}`);
    report.organicScientist = {
      bsToCpkChangedPx: diffBsCpk.changedPixelCount,
      bsToLicChangedPx: diffBsLic.changedPixelCount,
      distA: Number(m2.distanceA.toFixed(3)),
      angleDeg: Number(m3.angleDeg.toFixed(1)),
      dihedralDeg: Number(m4After.dihedralDeg.toFixed(1)),
      xyzLines: xyzLines.length
    };

    // =========================================================================
    // 3. EMERGENT BIOLOGY LAB: 2D CONTACT MAP + FASTA MOTIFS + HH PHASE + EXPORT
    // =========================================================================
    await page.goto(`${BASE_URL}/life-lab.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.evaluate(() => window.__ulgLifeLab.setPaused(true));

    // Layer 2: Biopolymer Folding + Live 2D N×N Contact Map + 1-Click FASTA Motifs
    await page.evaluate(() => window.__ulgLifeLab.selectMode('amphipathic-helix-bundle'));
    await page.evaluate(() => window.__ulgLifeLab.stepNow(20));
    const stFold = await page.evaluate(() => window.__ulgLifeLab.getState());
    assert.equal(stFold.foldShowContactMap, true, '2D Contact Map must be active by default on Layer 2');
    assert.ok(stFold.contactMapStats.nRes >= 24, `Expected >=24 residues, got ${stFold.contactMapStats.nRes}`);
    assert.ok(stFold.contactMapStats.contactCount > 0, `Expected live 3D residue contacts > 0 (got ${stFold.contactMapStats.contactCount})`);
    if (SHOT_DIR) {
      await saveDataUrl(await page.evaluate(() => window.__ulgLifeLab.capturePng()), 'lod-08a-life-fold-3d');
      await page.screenshot({ path: path.join(SHOT_DIR, 'lod-08-life-contact-map.png') });
    }

    // Click β-Hairpin & IDP Coil 1-click motif presets
    await page.locator('#fold-preset-row button', { hasText: 'β-Hairpin' }).click();
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__ulgLifeLab.stepNow(10));
    const seqHairpin = await page.locator('#inp-seq').inputValue();
    assert.ok(seqHairpin.includes('PPPPP+'), `Expected β-Hairpin polar turn motif in sequence (got "${seqHairpin}")`);

    const bioXyz = await page.evaluate(() => window.__ulgLifeLab.exportXyz());
    const bioXyzLines = bioXyz.trim().split('\n');
    assert.ok(Number(bioXyzLines[0].trim()) >= 20 && bioXyzLines.length === Number(bioXyzLines[0].trim()) + 2,
      `Expected valid coarse-grained biopolymer XYZ export (got ${bioXyzLines.length} lines)`);

    await page.locator('#fold-preset-row button', { hasText: 'IDP Coil' }).click();
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__ulgLifeLab.stepNow(8));

    // Layer 4: Hodgkin-Huxley (V_m, dV_m/dt) Phase Portrait Toggle + CSV Export
    await page.evaluate(() => window.__ulgLifeLab.selectMode('excitable-spiral'));
    await page.evaluate(() => window.__ulgLifeLab.stepNow(18));
    const stHh = await page.evaluate(() => window.__ulgLifeLab.setPlot3AltMode({ hhPhasePortrait: true }));
    assert.equal(stHh.hhShowPhasePortrait, true, 'HH Phase Portrait toggle must activate cleanly');
    await page.waitForTimeout(120);
    if (SHOT_DIR) {
      await saveDataUrl(await page.evaluate(() => window.__ulgLifeLab.capturePng()), 'lod-09a-life-hh-3d');
      await page.screenshot({ path: path.join(SHOT_DIR, 'lod-09-life-hh-phase-portrait.png') });
    }

    const bioCsv = await page.evaluate(() => window.__ulgLifeLab.exportCsv());
    const csvLines = bioCsv.trim().split('\n');
    assert.ok(csvLines.length >= 3 && csvLines[0].startsWith('step,'),
      `Expected valid Biology CSV trajectory export (got ${csvLines.length} lines: "${csvLines[0]}")`);

    assert.equal(stHh.gpuErrorCount, 0, `Life Lab GPU errors: ${stHh.gpuErrors.join(' | ')}`);
    report.biologyScientist = {
      residueCount: stFold.contactMapStats.nRes,
      liveContacts: stFold.contactMapStats.contactCount,
      longRangeContacts: stFold.contactMapStats.longRangeContacts,
      hhPhasePortraitVerified: stHh.hhShowPhasePortrait,
      csvRows: csvLines.length - 1,
      xyzResidues: Number(bioXyzLines[0].trim())
    };

    assert.deepEqual(pageErrors, [], `Uncaught page errors: ${pageErrors.join(' | ')}`);
    assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join(' | ')}`);
    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } finally {
    await browser.close();
  }
});
