// Native Vulkan WebGPU Visual & Physics Verification for ULG Universes Upgrades:
//   1. Rescaled parent-scale perspective backgrounds (L0 Cosmic Web behind L1 Galaxy;
//      L1 32K-star Milky Way band from starSite.posGal behind L2 System & L4 Planet + live Host Sun(s)!).
//   2. Clickable / Selectable GPU f32x2 Main-Belt / Kuiper-Belt Asteroids on L2 (golden 3D beacon + Focus + Sample!).
//   3. Automatic scale-adaptive time dilation slowing monotonically as you zoom inward (L0 -> L1 -> L2 -> L4 -> Surface -> L5 -> L6 -> L7).
//   4. Visible Always-On 3D WebGPU Stratified Atmospheric CFD on rocky surfaces (Earth & Mars Rover/Drone — NOT just UFO!)
//      while staying strictly dormant (0 dispatches) in Moon vacuum!
//   5. Planet -> Land/Dive -> Live Local Spatial Sampling Below Craft -> Sampled Lattice (L5) -> Compounds (L6 RHF) -> Elements (L6 Dirac-KS) -> Nucleus (L7)!

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1' || process.env.RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_DEV_URL || process.env.ULG_UNIVERSES_URL || 'https://127.0.0.1:5173';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_UNIVERSES_SHOT_DIR || '';

async function waitReady(page, timeoutMs = 45000) {
  await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.().ready), null, { timeout: timeoutMs });
}

async function saveShot(page, name) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const dataUrl = await page.evaluate(() => window.__ulgUniversesDemo.capturePng());
  const b64 = String(dataUrl || '').replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(b64, 'base64'));
}

test('ULG Universes: Parent-Scale Backdrops, Asteroid Picking, Always-On Surface 3D CFD, Scale Time Dilation & Land->Sample->Lattice->Compounds->Elements Hierarchy (Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan visual verification',
  timeout: 240_000
}, async () => {
  const { chromium } = await import('@playwright/test');
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
  const consoleErrors = [];
  const pageErrors = [];
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.goto(`${BASE_URL}/universes.html?level=1&quality=med`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await waitReady(page);
    await page.waitForTimeout(700);

    // 1. L1 Spiral Galaxy with live rescaled L0 Cosmic Web parent background!
    const l1State = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l1State.level, 1);
    assert.equal(l1State.parentBackdropActive, true, 'L1 Galaxy must render live L0 Cosmic Web parent backdrop');
    const l1Clock = l1State.scaleTimeDilation.secondsPerWallSecond;
    await saveShot(page, 'v2_l1_galaxy_with_cosmo_backdrop.png');

    // 2. L2 Star System with live L1 32K-star Milky Way galactic skyband + Clickable GPU Asteroid!
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setUseSolReference(true);
      await window.__ulgUniversesDemo.setLevel(2, { instant: true });
      await window.__ulgUniversesDemo.focusSolarBody(0); // Sun at center so Main Belt forms a crisp ring around center!
      await window.__ulgUniversesDemo.setLog10Span(11.95); // ~6 AU span showing inner planets + Main Belt asteroids clearly
      window.__ulgUniversesDemo.setCameraAngles(0.55, 0.58);
    });
    await page.waitForTimeout(500);
    const l2State = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l2State.level, 2);
    assert.equal(l2State.parentBackdropActive, true, 'L2 Star System must render live L1 Galaxy Milky Way backdrop');
    assert.ok(
      l2State.scaleTimeDilation.secondsPerWallSecond < l1Clock,
      `Time dilation must slow automatically from L1 (${l1State.scaleTimeDilation.clockLabel}) to L2 (${l2State.scaleTimeDilation.clockLabel})`
    );

    // Pick a live GPU Main-Belt Asteroid directly with real click coordinates (WITHOUT preferGpuMote cheat!)
    let pickedAst = null;
    const probeCoords = [
      [0.64, 0.50], [0.36, 0.50], [0.50, 0.34], [0.50, 0.66],
      [0.60, 0.40], [0.40, 0.60], [0.68, 0.54], [0.32, 0.46],
      [0.58, 0.62], [0.42, 0.38]
    ];
    for (const [fx, fy] of probeCoords) {
      const hit = await page.evaluate(async ([x, y]) => {
        const res = await window.__ulgUniversesDemo.pickAtCanvasFraction(x, y, { preferGpuMote: false });
        return res ? { kind: res.kind, name: res.name, subtitle: res.subtitle, sampleZ: res.sampleZ } : null;
      }, [fx, fy]);
      if (hit?.kind === 'solar-asteroid') {
        pickedAst = hit;
        break;
      }
    }
    assert.ok(pickedAst && pickedAst.kind === 'solar-asteroid', `Clicking Main Belt on L2 must select a GPU asteroid! Got ${JSON.stringify(pickedAst)}`);
    await page.waitForTimeout(300);
    await saveShot(page, 'v2_l2_asteroid_selected_with_mw_backdrop.png');

    // 3. L4 Orbital Planet (Earth) with live Milky Way + Host Sun sky perspective -> Hyperdrive MUST land on surface FIRST!
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.focusSolarBody('earth');
      await window.__ulgUniversesDemo.setLevel(4, { instant: true });
    });
    await page.waitForTimeout(500);
    const l4State = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l4State.level, 4);
    assert.equal(l4State.surfaceActive, false);
    assert.equal(l4State.parentBackdropActive, true, 'L4 Planet Orbit must render live parent Galaxy backdrop');
    assert.ok(
      l4State.scaleTimeDilation.secondsPerWallSecond < l2State.scaleTimeDilation.secondsPerWallSecond,
      `Time dilation must slow from L2 (${l2State.scaleTimeDilation.clockLabel}) to L4 (${l4State.scaleTimeDilation.clockLabel})`
    );
    await saveShot(page, 'v2_l4_earth_with_parent_sky.png');

    // Triggering Hyperdrive / Dive from L4 Planet MUST land on the planetary surface (NOT skip to L5!)
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.initiateHyperdrive();
    });
    await page.waitForTimeout(600);
    const surfEarthRover = await page.evaluate(async () => {
      for (let i = 0; i < 10; i += 1) await window.__ulgUniversesDemo.stepOnce();
      return window.__ulgUniversesDemo.getState();
    });
    assert.equal(surfEarthRover.surfaceActive, true, 'Diving from L4 Planet must enter planetary surface view first!');
    assert.equal(surfEarthRover.surfaceVehicle, 'rover');
    assert.equal(surfEarthRover.surfaceTelemetry?.cfdActive, true, '3D WebGPU CFD MUST be active for Earth Rover!');
    assert.ok(
      (surfEarthRover.surfaceTelemetry?.cfdTelemetry?.rmsWindMS ?? 0) > 0.2,
      `Earth Rover 3D CFD must have non-zero live wind, got ${surfEarthRover.surfaceTelemetry?.cfdTelemetry?.rmsWindMS}`
    );
    assert.ok(surfEarthRover.surfaceLocalSample?.id, 'Local surface material directly below Rover must be sampled');
    assert.equal(surfEarthRover.scaleTimeDilation.clockLabel, '1.0 s/s');
    await saveShot(page, 'v2_surface_earth_rover_3d_cfd.png');

    // Also verify Mars Rover has visible always-on 3D CFD AND Moon stays strictly vacuum-dormant!
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'mars' });
      for (let i = 0; i < 12; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    await page.waitForTimeout(350);
    const surfMars = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(surfMars.surfaceTelemetry?.cfdActive, true, '3D WebGPU CFD MUST be active for Mars Rover!');
    await saveShot(page, 'v2_surface_mars_rover_3d_cfd.png');

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'moon' });
      for (let i = 0; i < 4; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const surfMoon = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(surfMoon.surfaceTelemetry?.cfdActive, false, 'Vacuum Moon must keep 3D CFD strictly dormant!');
    assert.equal(surfMoon.surfaceDroneMaxAeroLiftN, 0, 'Vacuum Moon drone lift must remain 0 N!');

    // 4. Sample directly below Mars Rover -> L5 Sampled Lattice -> L6 Compound (RHF) -> L6 Constituent Element (Dirac-KS) -> L7 Nucleus!
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'mars' });
      for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const sampledOut = await page.evaluate(async () => window.__ulgUniversesDemo.sampleSurfaceAndDiveToLattice());
    await page.waitForTimeout(500);
    assert.equal(sampledOut.state.surfaceActive, false);
    assert.equal(sampledOut.state.level, 5, 'Sampling from surface must transition directly to L5 Atomic/Molecular Lattice');
    assert.ok(sampledOut.sample?.compounds?.length >= 2, 'Sampled material must report molecular compounds found');
    assert.ok(sampledOut.sample?.elements?.length >= 2, 'Sampled material must report constituent elements');
    assert.equal(sampledOut.state.mdElementZ, sampledOut.sample.primaryZ);
    assert.ok(
      sampledOut.state.scaleTimeDilation.secondsPerWallSecond < 1e-10,
      `L5 Lattice time dilation must be in fs/s, got ${sampledOut.state.scaleTimeDilation.clockLabel}`
    );
    await saveShot(page, 'v2_l5_sampled_lattice_with_compounds_strip.png');

    // Step from L5 Sampled Lattice -> L6 Compound Molecular Orbitals (RHF)
    const l6Comp = await page.evaluate(async () => window.__ulgUniversesDemo.inspectSampledCompound(0));
    await page.waitForTimeout(450);
    assert.equal(l6Comp.level, 6);
    assert.equal(l6Comp.parentBackdropActive, true, 'L6 Atom/Molecule must show parent L5 Lattice backdrop');
    await saveShot(page, 'v2_l6_sampled_compound_with_lattice_backdrop.png');

    // Step from L6 Compound -> L6 Constituent Element (Dirac-KS) -> L7 Nucleus (with L6 orbital backdrop!)
    const targetElZ = sampledOut.sample.elements[0].Z;
    const l6El = await page.evaluate(async (z) => window.__ulgUniversesDemo.inspectSampledElement(z, { targetLevel: 6 }), targetElZ);
    assert.equal(l6El.level, 6);
    assert.equal(l6El.quantumZ, targetElZ);
    const l7Nuc = await page.evaluate(async (z) => window.__ulgUniversesDemo.inspectSampledElement(z, { targetLevel: 7 }), targetElZ);
    await page.waitForTimeout(450);
    assert.equal(l7Nuc.level, 7);
    assert.equal(l7Nuc.nuclearZ, targetElZ);
    assert.equal(l7Nuc.parentBackdropActive, true, 'L7 Nucleus must show parent L6 Orbital backdrop');
    await saveShot(page, 'v2_l7_sampled_nucleus_with_orbital_backdrop.png');

    assert.equal(l7Nuc.gpuErrorCount, 0, `Unexpected WebGPU errors: ${JSON.stringify(l7Nuc.gpuErrors)}`);
    assert.equal(consoleErrors.length, 0, `Console errors: ${JSON.stringify(consoleErrors)}`);
    assert.equal(pageErrors.length, 0, `Page errors: ${JSON.stringify(pageErrors)}`);
    await context.close();
  } finally {
    await browser.close();
  }
});
