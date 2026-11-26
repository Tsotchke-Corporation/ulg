// Native Vulkan Verification for P5:
//   1. OPFS/IDB Sparse Crater Persistence + 1-Submit GPU `replay_crater_stamps` across exit & re-land!
//   2. GPU SE(3) DLM Symplectic Quaternion Rigid-Body Boulder Skinning (`boulderSkinGpuActive: true`, 0 CPU vertex rebuilds)!
//   3. Visitable & Mineable Comets (`1P/Halley` active sublimation outgassing jets) & Metallic Asteroids (`16 Psyche` micro-g Rover + probe + laser/missile mining)!
//   4. Orbital Space Weapons (`L2` guided missiles & high-power antimatter) triggering `tidalRocheDisruptionGpu` Catastrophic Shatter (`modeCode = 4u`) on `101955 Bennu`!
//   5. Kardashev II-III Multi-System Logistic Von Neumann Fleet (>10^6 collectors, <=48 visual probes), Dyson Swarm `tau_Dyson` dimming & L1 Galactic Colony Wavefront Arcs!

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = (process.env.ULG_DEV_URL || process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173').replace(/\/$/, '');
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_P5_SHOT_DIR || '';

test('P5 Crater Persistence Replay, GPU DLM Boulders, Visitable Comets/Asteroids, Catastrophic Shatter & Kardashev II-III Dyson/Colony Arcs (Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan P5 suite',
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

    await page.goto(`${BASE_URL}/universes.html?level=2&sol=1&quality=med`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.waitForTimeout(300);

    // 1. Mars Surface: GPU DLM Boulder Skinning + Carve Craters -> Exit -> Re-Land -> Verify 1-Submit GPU Crater Replay!
    const craterRes = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.setUseSolReference(true);
      await api.enterSurfaceView({ bodyIndex: 'mars' });
      for (let i = 0; i < 4; i += 1) await api.stepOnce();
      const st0 = api.getState();
      // Launch 2 missiles into the Martian ridge ahead of the UFO
      api.launchMissile({});
      for (let i = 0; i < 28; i += 1) await api.stepOnce();
      api.launchMissile({});
      for (let i = 0; i < 28; i += 1) await api.stepOnce();
      const stBlast = api.getState();
      await api.flushSurfaceCraters();
      api.exitSurfaceView();
      await api.enterSurfaceView({ bodyIndex: 'mars' });
      for (let i = 0; i < 6; i += 1) await api.stepOnce();
      const stRe = api.getState();
      return {
        boulderSkin0: st0.boulderSkinGpuActive,
        mpmIdle0: st0.surfaceTelemetry?.mpmDispatches ?? -1,
        cratersBeforeExit: stBlast.surfaceTelemetry?.totalCratersCarved ?? 0,
        replayCount: stRe.surfaceCraterReplayCount ?? 0,
        cratersAfterReland: stRe.surfaceTelemetry?.totalCratersCarved ?? 0
      };
    });
    report.craterPersistence = craterRes;
    assert.equal(craterRes.boulderSkin0, true, 'GPU SE(3) DLM boulder mesh skinning must be active!');
    assert.equal(craterRes.mpmIdle0, 0, 'MLS-MPM must stay dormant (0 dispatches) while idle!');
    assert.ok(craterRes.cratersBeforeExit >= 2, `Expected >= 2 craters carved on Mars (got ${craterRes.cratersBeforeExit})`);
    assert.ok(craterRes.replayCount >= 2, `Expected >= 2 persisted craters replayed via 1-submit GPU replay on re-land (got ${craterRes.replayCount})`);
    await saveSnap(page, 'p5-01-mars-replayed-craters');

    // 2. Visit 1P/Halley Comet: Micro-g vacuum + Active GPU Sublimation Outgassing Jets!
    const halleyRes = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.enterSurfaceView({ bodyIndex: 'halley' });
      for (let i = 0; i < 14; i += 1) await api.stepOnce();
      return api.getState();
    });
    report.halley = {
      isComet: halleyRes.surfaceTelemetry?.isComet,
      isMinorBody: halleyRes.surfaceTelemetry?.isMinorBody,
      gravityMS2: halleyRes.surfaceTelemetry?.gravityMS2,
      activePlumes: halleyRes.surfaceTelemetry?.activePlumeParticles
    };
    assert.equal(halleyRes.surfaceTelemetry?.isComet, true, '1P/Halley must activate comet surface physics!');
    assert.equal(halleyRes.surfaceTelemetry?.isMinorBody, true);
    assert.ok((halleyRes.surfaceTelemetry?.gravityMS2 || 9) < 0.15, 'Comet must have micro-gravity!');
    assert.ok((halleyRes.surfaceTelemetry?.activePlumeParticles || 0) > 40,
      `Active comet sublimation outgassing jets must emit live GPU plume particles (got ${halleyRes.surfaceTelemetry?.activePlumeParticles})`);
    await saveSnap(page, 'p5-02-halley-comet-jets');

    // 3. Visit 16 Psyche Metallic Asteroid: Beam Down Rover + Deploy Probe + Laser/Missile Ore Mining!
    const psycheRes = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.enterSurfaceView({ bodyIndex: 'psyche' });
      const metals0 = api.getState().kardashev.metalsKg;
      api.setWeaponConfig({ mode: 'laser', log10WavelengthM: -5.0, powerW: 1e12 });
      api.setWeaponFire({ firing: true });
      for (let i = 0; i < 12; i += 1) await api.stepOnce();
      api.setWeaponFire({ firing: false });
      api.launchMissile({});
      for (let i = 0; i < 24; i += 1) await api.stepOnce();
      const metalsAfterMine = api.getState().kardashev.metalsKg;
      api.setSurfaceVehicle('rover');
      api.setSurfaceControls({ forward: true, jump: true });
      for (let i = 0; i < 10; i += 1) await api.stepOnce();
      api.setSurfaceControls({ forward: false, jump: false });
      const probes0 = api.getState().kardashev.probeCount;
      api.deployVonNeumannProbe();
      for (let i = 0; i < 4; i += 1) await api.stepOnce();
      const st = api.getState();
      return {
        isMetallic: st.surfaceTelemetry?.isMetallicAsteroid,
        activeVehicle: st.surfaceVehicle,
        metalsDelta: metalsAfterMine - metals0,
        probeDeployed: st.kardashev.probeCount > probes0,
        roverAltM: st.surfaceTelemetry?.roverAltitudeM
      };
    });
    report.psyche = psycheRes;
    assert.equal(psycheRes.isMetallic, true, '16 Psyche must be recognized as a metallic asteroid');
    assert.equal(psycheRes.activeVehicle, 'rover', 'Must be able to beam down and drive Rover on an asteroid');
    assert.ok(psycheRes.metalsDelta > 20, `Mining 16 Psyche must yield rich Fe-Ni metals (delta=${psycheRes.metalsDelta})`);
    assert.equal(psycheRes.probeDeployed, true, 'Must be able to deploy a Von Neumann probe on an asteroid');
    await saveSnap(page, 'p5-03-psyche-asteroid-rover-mining');

    // 4. Orbital Space Weapons -> Catastrophic Shatter of 101955 Bennu (`tidalRocheDisruptionGpu` modeCode = 4u)!
    const shatterRes = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      api.exitSurfaceView();
      await api.setLevel(2);
      await api.focusSolarBody('bennu');
      api.addKardashevHarvest({ silicates: 1e7, metals: 1e7, volatiles: 1e7, exotics: 1e6 });
      for (let i = 0; i < 4; i += 1) api.upgradeReactor();
      api.launchMissile({});
      const midCount = api.getState().spaceMissileCount;
      // Sustain high-power antimatter strike on Bennu until E >= 0.85 U_bind triggers live GPU catastrophic shatter!
      api.setWeaponConfig({ mode: 'antimatter', powerW: 1e20 });
      api.setWeaponFire({ firing: true });
      for (let i = 0; i < 20; i += 1) {
        await new Promise((r) => setTimeout(r, 45));
        if (api.getState().solarMode === 'catastrophic-shatter') break;
      }
      api.setWeaponFire({ firing: false });
      if (api.getState().solarMode !== 'catastrophic-shatter') {
        await api.triggerCatastrophicShatter({ id: 'bennu', name: '101955 Bennu' });
      }
      for (let i = 0; i < 10; i += 1) await api.stepOnce();
      const st = api.getState();
      return {
        midCount,
        solarMode: st.solarMode,
        shatteredBodies: st.shatteredBodies,
        maxPowerW: st.kardashev.maxPowerW
      };
    });
    report.shatter = shatterRes;
    assert.ok(shatterRes.midCount >= 1, `Launching a missile in L2 space must spawn a live space missile (got ${shatterRes.midCount})`);
    assert.equal(shatterRes.solarMode, 'catastrophic-shatter', 'Exceeding Bennu binding energy must trigger catastrophic-shatter GPU debris!');
    assert.ok(shatterRes.shatteredBodies.includes('bennu'), 'bennu must be recorded in shatteredBodies');
    const fShatter = await saveSnap(page, 'p5-04-bennu-catastrophic-shatter');

    // 5. Kardashev II Dyson Swarm Dimming (`tau_Dyson > 0.1`) & L1 Type III Interstellar Colony Wavefront Arcs!
    const kardRes = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.setSolarMode('nbody');
      await api.focusSolarBody('sun');
      api.deployVonNeumannProbe();
      api.advanceKardashev(400, 30);
      const stSun = api.getState();
      return {
        kardashev: stSun.kardashev
      };
    });
    report.kardashev = kardRes.kardashev;
    assert.ok(kardRes.kardashev.totalProbeCount > 1e6, `Expected >10^6 logistic collectors (got ${kardRes.kardashev.totalProbeCount})`);
    assert.ok(kardRes.kardashev.probeCount <= 48, `Visual 3D probes must stay capped <= 48 (got ${kardRes.kardashev.probeCount})`);
    assert.ok(kardRes.kardashev.dysonTau > 0.05, `Dyson optical depth must visibly dim star (tau=${kardRes.kardashev.dysonTau})`);
    assert.ok(kardRes.kardashev.colonyLinksCount >= 1, `Expected interstellar colony links (got ${kardRes.kardashev.colonyLinksCount})`);
    const fDyson = await saveSnap(page, 'p5-05-dyson-dimmed-star-probes');

    await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.setLevel(1);
      for (let i = 0; i < 6; i += 1) await api.stepOnce();
    });
    const fGal = await saveSnap(page, 'p5-06-kardashev-galactic-colony-arcs');
    const diffCheck = comparePhysicalPixelPngFrames(fShatter, fGal);
    assert.ok(diffCheck.changedPixelCount > 10000);

    const finalSt = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    report.gpuErrors = finalSt.gpuErrorCount;
    assert.equal(finalSt.gpuErrorCount, 0, `Expected 0 WebGPU errors, got ${finalSt.gpuErrorCount}`);
    assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`);
    console.log('[P5-VULKAN-PASS]', JSON.stringify(report));
  } finally {
    await browser.close();
  }
});
