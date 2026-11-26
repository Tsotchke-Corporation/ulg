import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

// Native Vulkan WebGPU Verification & Visual Watch Suite for Planetary Surface View
// (TinyPlanetControls + 6-Wheel Jump-Rocket Mars Rover + Coaxial Atmospheric Drone):
//   1. Mars: Drive Rover across red regolith, fire Jump Rockets (live flame + dust plumes + fuel burn),
//      launch Coaxial Atmospheric Drone (real Ingenuity-regime aero lift > 0), switch 3rd <-> 1st Cam!
//   2. Moon (Airless Vacuum): Prove STRICT Vacuum Null-Lift invariant (`maxAeroLiftN === 0`,
//      `droneFlightCapable === false` — rotors CANNOT fly in vacuum!) AND high low-g lunar rocket jump!
//   3. Earth: Blue Rayleigh sky, Fresnel liquid ocean shoreline, verdant hills + Drone soaring!
//   4. Titan: Dense cryogenic golden haze + effortless Dragonfly Drone flight (`rho > 4 kg/m^3`)!
//   5. Hadean Magma Ocean: Glowing molten lava rivers + basalt crust + Rover jump!
//   6. Jupiter Cloud Deck: Fluid gas giant (`hasSolidCrust === false`) auto-deploys Atmospheric Drone!
//   7. Clean Exit back to L4 Orbital Globe with ZERO GPU / page / console errors!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_SURFACE_SHOT_DIR || '';

test('Planetary Surface View (Jump-Rocket Rover + Atmospheric Drone) live Vulkan physics & visual watch', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan planetary surface suite',
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

  const snapGpu = async (page, name = null) => {
    const dataUrl = await page.evaluate(() => window.__ulgUniversesDemo.capturePng());
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    if (name && SHOT_DIR) await writeFile(path.join(SHOT_DIR, `${name}.png`), buf);
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

    await page.goto(`${BASE_URL}universes.html?level=4`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });

    const stepN = async (n) => {
      const startIdx = await page.evaluate(() => window.__ulgUniversesDemo.getState().surfaceTelemetry?.stepIndex || 0);
      await page.waitForFunction(
        (target) => (window.__ulgUniversesDemo.getState().surfaceTelemetry?.stepIndex || 0) >= target,
        startIdx + n,
        { timeout: 25_000 }
      );
    };

    // --- 1. MARS: UFO-FIRST ENTRY -> TRACTOR-BEAM ROVER DEPLOY + JUMP ROCKETS + COAXIAL DRONE ---
    await page.evaluate(() => window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'mars' }));
    await stepN(4);
    const stMarsUfo = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stMarsUfo.surfaceVehicle, 'ufo', 'All worlds now start in the 60-ft Explorer UFO until Rover/Drone is deployed');
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceVehicle('rover'));
    await stepN(4);
    const stMars0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    if (stMars0.gpuErrorCount > 0 || pageErrors.length > 0 || consoleErrors.length > 0) {
      console.error('[SURFACE_DIAG_ERRORS]', { gpuErrors: stMars0.gpuErrors, pageErrors, consoleErrors });
    }
    assert.equal(stMars0.gpuErrorCount, 0, `GPU errors on Mars surface entry: ${stMars0.gpuErrors.join(' | ')}`);
    assert.equal(stMars0.surfaceActive, true);
    assert.equal(stMars0.surfaceVehicle, 'rover');
    assert.equal(stMars0.surfaceDroneFlightCapable, true);
    assert.ok(stMars0.activeUniversalLaws.includes('planetary-surface-vehicles'));
    const fMars0 = await snapGpu(page);

    // Drive Mars Rover forward!
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true, turbo: true }));
    await stepN(28);
    const fMarsDrive = await snapGpu(page, '01-mars-rover-drive');
    const stMarsDrive = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    const driveDist = Math.hypot(
      stMarsDrive.surfaceTelemetry.roverPos[0] - stMars0.surfaceTelemetry.roverPos[0],
      stMarsDrive.surfaceTelemetry.roverPos[2] - stMars0.surfaceTelemetry.roverPos[2]
    );
    assert.ok(driveDist > 2.0, `Mars Rover must drive forward across terrain (moved ${driveDist.toFixed(2)} m)`);

    // Fire Jump Rockets!
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true, jump: true }));
    await stepN(42);
    const fMarsJump = await snapGpu(page, '02-mars-rover-rocket-jump');
    const stMarsJump = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(stMarsJump.surfaceTelemetry.roverAltitudeM > 1.2, `Mars jump rockets must launch Rover aloft (alt=${stMarsJump.surfaceTelemetry.roverAltitudeM})`);
    assert.ok(stMarsJump.surfaceTelemetry.roverRocketFuel < 0.90, `Jump rockets must consume fuel (fuel=${stMarsJump.surfaceTelemetry.roverRocketFuel})`);
    assert.ok(stMarsJump.surfaceTelemetry.flameParticles > 10, `Rocket exhaust GPU flame particles must ignite (got ${stMarsJump.surfaceTelemetry.flameParticles})`);
    const marsJumpDiff = comparePhysicalPixelPngFrames(fMars0, fMarsJump).changedPixelCount;
    assert.ok(marsJumpDiff > 40000, `Mars rocket jump must produce dramatic live GPU frame motion (${marsJumpDiff} px)`);
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: false, jump: false, turbo: false }));

    // Launch Coaxial Atmospheric Drone on Mars!
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceVehicle('drone'));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true, jump: true }));
    await stepN(36);
    const stMarsDrone = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stMarsDrone.surfaceVehicle, 'drone');
    assert.ok(stMarsDrone.surfaceTelemetry.droneAltitudeM > 2.2, `Mars Drone must ascend via aerodynamic lift (alt=${stMarsDrone.surfaceTelemetry.droneAltitudeM})`);
    assert.ok(stMarsDrone.surfaceTelemetry.droneAeroLiftN > 5.0, `Mars Drone must produce real aerodynamic lift > 5 N (got ${stMarsDrone.surfaceTelemetry.droneAeroLiftN})`);
    await snapGpu(page, '03-mars-drone-flight');

    // Switch to 1st-person TinyPlanetControls camera!
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceCameraMode('first-person'));
    await stepN(4);
    await snapGpu(page, '04-mars-first-person-cam');
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: false, jump: false }));

    report.mars = {
      g: Number(stMars0.surfaceGravityMS2.toFixed(2)),
      rho: Number(stMars0.surfaceAtmoDensityKgM3.toFixed(4)),
      driveDistM: Number(driveDist.toFixed(2)),
      jumpAltM: Number(stMarsJump.surfaceTelemetry.roverAltitudeM.toFixed(2)),
      flameParticles: stMarsJump.surfaceTelemetry.flameParticles,
      droneAltM: Number(stMarsDrone.surfaceTelemetry.droneAltitudeM.toFixed(2)),
      droneLiftN: Number(stMarsDrone.surfaceTelemetry.droneAeroLiftN.toFixed(2)),
      changedPx: marsJumpDiff
    };

    // --- 2. MOON (AIRLESS VACUUM): STRICT 0 N VACUUM NULL-LIFT + HIGH LUNAR ROCKET HOP ---
    await page.evaluate(() => window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'moon' }));
    await stepN(4);
    const stMoon0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stMoon0.surfaceAtmoDensityKgM3, 0, 'Moon must have exact 0 kg/m^3 vacuum density');
    assert.equal(stMoon0.surfaceDroneMaxAeroLiftN, 0, 'Moon vacuum must produce EXACTLY 0 N aero lift');
    assert.equal(stMoon0.surfaceDroneFlightCapable, false, 'Atmospheric Drone MUST NOT fly in lunar vacuum');

    // Verify Drone cannot take off in vacuum even at full throttle!
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceVehicle('drone'));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ jump: true }));
    await stepN(24);
    const stMoonDrone = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stMoonDrone.surfaceTelemetry.droneAeroLiftN, 0, 'Spinning drone rotors in lunar vacuum must yield EXACTLY 0.0 N lift');
    assert.ok(stMoonDrone.surfaceTelemetry.droneAltitudeM < 1.8, `Vacuum drone must fall to ground, not fly (alt=${stMoonDrone.surfaceTelemetry.droneAltitudeM})`);

    // Now switch back to Rover and fire Lunar Jump Rockets (Newton's 3rd Law works in vacuum!)
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ jump: false }));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceVehicle('rover'));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true, jump: true }));
    await stepN(36);
    const stMoonJump = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(stMoonJump.surfaceTelemetry.roverAltitudeM > 2.5, `Lunar jump rockets must bound high in 1.62 m/s^2 gravity (alt=${stMoonJump.surfaceTelemetry.roverAltitudeM})`);
    await snapGpu(page, '05-moon-rover-rocket-jump');
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: false, jump: false }));
    report.moon = {
      g: Number(stMoon0.surfaceGravityMS2.toFixed(2)),
      rho: stMoon0.surfaceAtmoDensityKgM3,
      droneVacuumLiftN: stMoonDrone.surfaceTelemetry.droneAeroLiftN,
      lunarJumpAltM: Number(stMoonJump.surfaceTelemetry.roverAltitudeM.toFixed(2))
    };

    // --- 3. EARTH: BLUE RAYLEIGH SKY + LIQUID OCEAN + DRONE FLIGHT ---
    await page.evaluate(() => window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'earth' }));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceVehicle('drone'));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true, jump: true }));
    await stepN(32);
    const stEarth = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(stEarth.surfaceTelemetry.droneAltitudeM > 3.0);
    await snapGpu(page, '06-earth-surface-ocean-drone');
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: false, jump: false }));
    report.earth = { g: Number(stEarth.surfaceGravityMS2.toFixed(2)), rho: Number(stEarth.surfaceAtmoDensityKgM3.toFixed(3)), droneAltM: Number(stEarth.surfaceTelemetry.droneAltitudeM.toFixed(2)) };

    // --- 4. TITAN: GOLDEN HAZE + DRAGONFLY DRONE ---
    await page.evaluate(() => window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'titan' }));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceVehicle('drone'));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true, jump: true }));
    await stepN(28);
    const stTitan = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.ok(stTitan.surfaceAtmoDensityKgM3 > 4.0);
    await snapGpu(page, '07-titan-drone-haze');
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: false, jump: false }));
    report.titan = { g: Number(stTitan.surfaceGravityMS2.toFixed(2)), rho: Number(stTitan.surfaceAtmoDensityKgM3.toFixed(2)), maxLiftN: Number(stTitan.surfaceDroneMaxAeroLiftN.toFixed(1)) };

    // --- 5. HADEAN MAGMA OCEAN: MOLTEN LAVA CHANNELS + ROVER JUMP ---
    await page.evaluate(() => window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'earth', planetaryModeOverride: 'magma-ocean' }));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceVehicle('rover'));
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: true, jump: true }));
    await stepN(24);
    await snapGpu(page, '08-magma-ocean-rover');
    await page.evaluate(() => window.__ulgUniversesDemo.setSurfaceControls({ forward: false, jump: false }));

    // --- 6. JUPITER 3D ATMOSPHERIC CFD (GAS GIANT -> AUTO BUOYANT DISC UFO!) ---
    await page.evaluate(() => window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'jupiter', planetaryModeOverride: 'standard' }));
    await stepN(16);
    const stJup = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stJup.surfaceVehicle, 'ufo', 'Gas giant without solid crust must auto-deploy Buoyant 3D CFD Research UFO');
    assert.ok(stJup.surfaceTelemetry?.cfdActive, 'Gas giant dive must run live 3D WebGPU Atmospheric CFD');
    await snapGpu(page, '09-jupiter-cfd-ufo');
    report.jupiter = {
      vehicle: stJup.surfaceVehicle,
      g: Number(stJup.surfaceGravityMS2.toFixed(2)),
      deck: stJup.surfaceTelemetry?.cfdTelemetry?.chemistry?.activeCloudDeck,
      windMS: Number((stJup.surfaceTelemetry?.cfdTelemetry?.rmsWindMS || 0).toFixed(2))
    };

    // --- 7. CLEAN EXIT BACK TO L4 ORBITAL VIEW ---
    await page.evaluate(() => window.__ulgUniversesDemo.exitSurfaceView());
    await page.waitForTimeout(250);
    const stExit = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(stExit.surfaceActive, false);
    assert.equal(stExit.activeUniversalLaws.includes('planetary-surface-vehicles'), false, 'Surface law must go dormant on orbital return');
    assert.equal(stExit.gpuErrorCount, 0, `GPU errors: ${stExit.gpuErrors.join('; ')}`);
    assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join('; ')}`);
    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join('; ')}`);

    console.log('[PLANETARY_SURFACE_WATCH_SUMMARY]', JSON.stringify(report));
  } finally {
    await browser.close();
  }
});
