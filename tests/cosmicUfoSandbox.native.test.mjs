// Native Vulkan Visual & Interactive Sandbox Verification for:
//   1. Iconic 60-ft smooth flying saucer with glowing emerald-green glass bubble across Cosmic Web -> Surface!
//   2. Mountain-scale planetary terrain + 64 faceted 3D rigid-body boulders + Dormant-Zero GPU MLS-MPM (0 dispatches idle!).
//   3. Glowing yellow conical tractor beam (during Rover beam-down & manual tractor boulder lifting!).
//   4. 360-degree rim-emitted Tunable EM Laser (Mid-IR silicate melt / Microwave water boil / Gamma plasma),
//      Rim-Launched Missiles carving persistent craters + active GPU MLS-MPM blast ejecta, & Antimatter Beam!
//   5. Inside-the-Green-Glass-Dome 3D Cockpit View + WebXR / Side-by-Side Stereo VR Preview!
//   6. Seedable URL Share-Link + 2-Tab BroadcastChannel/PeerCompute Multiplayer UFO Presence + Locked 1.0x Timescale
//      + Self-Replicating Von Neumann Probes & Kardashev Index!

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = (process.env.ULG_DEV_URL || process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173').replace(/\/$/, '');
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_UFO_SHOT_DIR || '';

test('Cosmic UFO Perspective, 60ft Emerald-Dome Saucer, Yellow Tractor Beam, Rim EM/Missile/Antimatter Weapons, Dormant-Zero GPU MLS-MPM, Rigid Boulders, Cockpit/XR & 2-Player Multiplayer (Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Cosmic UFO Sandbox suite',
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

  const saveSnap = async (page, name) => {
    const dataUrl = await page.evaluate(() => window.__ulgUniversesDemo.capturePng());
    const buf = Buffer.from(String(dataUrl || '').split(',')[1] || '', 'base64');
    if (name && SHOT_DIR && buf.length > 64) {
      await writeFile(path.join(SHOT_DIR, `${name}.png`), buf);
    }
    return buf;
  };

  const pageErrors = [];
  const consoleErrors = [];
  const report = {};

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1360, height: 820 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });

    // 1. L0 Cosmic Web from UFO perspective!
    await page.goto(`${BASE_URL}/universes.html?level=0&quality=med`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.waitForTimeout(400);
    await saveSnap(page, 'ufo-01-cosmic-web-saucer');

    // 2. Land on Mars -> MUST start from the 60-ft UFO perspective hovering over mountain-scale terrain + 64 rigid boulders!
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setUseSolReference(true);
      await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'mars' });
      for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const marsUfo0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(marsUfo0.surfaceActive, true);
    assert.equal(marsUfo0.surfaceVehicle, 'ufo', 'Landing on a planet must start from the UFO perspective until you beam down a Rover/Drone!');
    assert.equal(marsUfo0.surfaceTelemetry?.ufoDiameterFt, 60.0);
    assert.ok((marsUfo0.surfaceTelemetry?.aliveBoulderCount || 0) >= 30,
      `Expected >= 30 rigid-body boulders on Mars surface (got ${marsUfo0.surfaceTelemetry?.aliveBoulderCount})`);
    // Dormant-Zero performance guarantee: ZERO MLS-MPM compute dispatches before any blast/ablation!
    assert.equal(marsUfo0.surfaceTelemetry?.mpmActive, false, 'GPU MLS-MPM must remain strictly dormant (0 ms) while cruising!');
    assert.equal(marsUfo0.surfaceTelemetry?.mpmDispatches, 0, 'GPU MLS-MPM must execute 0 dispatches while idle!');
    const fIdle = await saveSnap(page, 'ufo-02-mars-60ft-hover-boulders');

    // 3. Activate Yellow Conical Tractor Beam & Beam Down Rover!
    await page.evaluate(async () => {
      window.__ulgUniversesDemo.setTractorBeam(true);
      for (let i = 0; i < 5; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const stTractor = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stTractor.surfaceTelemetry?.tractorActive, true);
    const fTractor = await saveSnap(page, 'ufo-03-yellow-tractor-beam');
    const tractorDiff = comparePhysicalPixelPngFrames(fIdle, fTractor);
    assert.ok(tractorDiff.changedPixelCount > 2500, `Yellow conical tractor beam must render visibly beneath UFO (changed=${tractorDiff.changedPixelCount})`);

    // Beam down Rover -> verify activeVehicle switches to rover with tractor pulse -> switch back to UFO
    await page.evaluate(async () => {
      window.__ulgUniversesDemo.setTractorBeam(false);
      window.__ulgUniversesDemo.setSurfaceVehicle('rover');
      for (let i = 0; i < 4; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const stRover = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stRover.surfaceVehicle, 'rover');
    assert.equal(stRover.surfaceTelemetry?.tractorActive, true, 'Beaming down Rover must activate the yellow conical tractor beam!');
    await page.evaluate(async () => {
      window.__ulgUniversesDemo.setSurfaceVehicle('ufo');
      for (let i = 0; i < 4; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });

    // 4. Fire Tunable Mid-IR EM Laser (10 um, 5 GW) from 360° saucer rim onto Mars silicate crust!
    await page.evaluate(async () => {
      window.__ulgUniversesDemo.setWeaponConfig({ mode: 'laser', log10WavelengthM: -5.0, powerW: 5e9 });
      window.__ulgUniversesDemo.setWeaponFire({ firing: true });
      for (let i = 0; i < 16; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const stLaser = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(stLaser.surfaceTelemetry?.weaponReaction?.reactionOutcome, 'EM Laser must report live compound thermal/photonic reaction');
    assert.ok((stLaser.surfaceTelemetry?.weaponReaction?.tempK || 0) > 600,
      `Mid-IR 5 GW laser must significantly heat Mars crust (got ${stLaser.surfaceTelemetry?.weaponReaction?.tempK} K)`);
    await saveSnap(page, 'ufo-04-em-laser-mid-ir-melt');
    await page.evaluate(() => window.__ulgUniversesDemo.setWeaponFire({ firing: false }));

    // 5. Launch Rim-Mounted Guided Missiles -> Carve Persistent Crater + Activate GPU MLS-MPM Blast Ejecta!
    await page.evaluate(async () => {
      window.__ulgUniversesDemo.launchMissile({});
      for (let i = 0; i < 68; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const stMissile = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok((stMissile.surfaceTelemetry?.totalCratersCarved || 0) >= 1,
      `Rim-launched missile must impact and carve >= 1 persistent crater (got ${stMissile.surfaceTelemetry?.totalCratersCarved})`);
    assert.ok((stMissile.surfaceTelemetry?.mpmDispatches || 0) > 0,
      'Missile detonation must wake the Dormant-Zero GPU MLS-MPM crater blast & ejecta kernel!');
    await saveSnap(page, 'ufo-05-missile-crater-mpm');

    // 6. Fire Antimatter Annihilation Beam (E = 2mc^2)!
    await page.evaluate(async () => {
      window.__ulgUniversesDemo.setWeaponConfig({ mode: 'antimatter' });
      window.__ulgUniversesDemo.setWeaponFire({ firing: true });
      for (let i = 0; i < 8; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const stAm = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stAm.surfaceTelemetry?.weaponReaction?.weapon, 'antimatter');
    assert.ok(String(stAm.surfaceTelemetry?.weaponReaction?.reactionOutcome || '').includes('2mc'));
    await saveSnap(page, 'ufo-06-antimatter-beam');
    await page.evaluate(() => window.__ulgUniversesDemo.setWeaponFire({ firing: false }));

    // 7. Inside-the-Emerald-Green-Glass-Dome 3D Cockpit View + WebXR Stereo VR Preview!
    await page.evaluate(async () => {
      window.__ulgUniversesDemo.toggleCockpit();
      for (let i = 0; i < 4; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const stCockpit = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stCockpit.surfaceCameraMode, 'first-person');
    await saveSnap(page, 'ufo-07-cockpit-view');

    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.toggleXr();
    });
    const stXr = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stXr.xrState.active, true, 'WebXR / Stereo SBS VR mode must activate cleanly');
    await saveSnap(page, 'ufo-08-stereo-xr');
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.toggleXr();
      window.__ulgUniversesDemo.toggleCockpit();
    });

    // 8. Von Neumann Probe + Seedable Share-Link + 2-Tab Multiplayer UFO Presence & Locked 1.0x Timescale!
    const shareUrl = await page.evaluate(() => {
      window.__ulgUniversesDemo.deployVonNeumannProbe();
      window.__ulgUniversesDemo.joinMultiplayerRoom('vulkan-ufo-squad');
      return window.__ulgUniversesDemo.buildShareUrl();
    });
    const stP1Mp = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stP1Mp.timescaleLocked, true, 'Multiplayer room must strictly lock simulation timescale to 1.0x!');
    assert.ok(stP1Mp.kardashev.probeCount >= 1, 'Deployed Von Neumann probe must register in Kardashev state');
    assert.ok(shareUrl.includes('room=vulkan-ufo-squad') && shareUrl.includes('surf=1') && shareUrl.includes('seed='));

    // Open Player 2 directly via the exact generated Seedable Share-Link!
    const page2 = await ctx.newPage();
    page2.on('pageerror', (e) => pageErrors.push(`P2: ${String(e).slice(0, 260)}`));
    await page2.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page2.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });
    await page2.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.ufoMultiplayer?.remotePeerCount || 0) >= 1, null, { timeout: 15_000 });

    const stP2 = await page2.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stP2.surfaceActive, true, 'Opening shared surface URL must automatically drop Player 2 onto the same planet!');
    assert.equal(stP2.timescaleLocked, true, 'Player 2 joining shared room URL must have timescale locked to 1.0x!');
    assert.ok(stP2.ufoMultiplayer.remotePeerCount >= 1, 'Player 2 must see Player 1 UFO live over BroadcastChannel/PeerCompute mesh!');
    await page2.close();

    const finalSt = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(finalSt.gpuErrors.length, 0, `GPU errors: ${finalSt.gpuErrors.join(' | ')}`);
    assert.deepEqual(pageErrors, [], `Uncaught page errors: ${pageErrors.join(' | ')}`);
    assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join(' | ')}`);

    report.cosmicUfoSandbox = {
      ufoDiameterFt: marsUfo0.surfaceTelemetry.ufoDiameterFt,
      initialBoulders: marsUfo0.surfaceTelemetry.aliveBoulderCount,
      idleMpmDispatches: marsUfo0.surfaceTelemetry.mpmDispatches,
      tractorBeamChangedPx: tractorDiff.changedPixelCount,
      laserMidIrTempK: Math.round(stLaser.surfaceTelemetry.weaponReaction.tempK),
      cratersCarved: stMissile.surfaceTelemetry.totalCratersCarved,
      mpmDispatchesAfterBlast: stMissile.surfaceTelemetry.mpmDispatches,
      antimatterWeapon: stAm.surfaceTelemetry.weaponReaction.weapon,
      xrMode: stXr.xrState.mode,
      multiplayerPeersSeen: stP2.ufoMultiplayer.remotePeerCount,
      timescaleLocked: stP2.timescaleLocked,
      kardashevIndex: Number(stP1Mp.kardashev.index.toFixed(3)),
      vonNeumannProbes: stP1Mp.kardashev.probeCount
    };
    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } finally {
    await browser.close();
  }
});
