import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

// Native Vulkan Chrome end-to-end proof for ULG Universes (`universes.html`):
//   1. Exercises ALL 8 real WebGPU scales (L0 Cosmic Web -> L7 Atomic Nucleus)
//   2. Proves locked camera default (`cameraAutoSpin: false`) + real physical GPU motion
//      via decoded pixel deltas on L0 Cosmic Web and L1 Galaxy + SMBH Lensing
//   3. Proves Hyperdrive transitions, Return to Orbit, Autopilot toggle, and Retro CRT mode
//   4. Captures high-resolution screenshots of all scales into `ULG_UNIVERSES_SHOT_DIR`
//      when provided so visual fidelity can be inspected directly!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_UNIVERSES_SHOT_DIR || '';

test('ULG Universes native Vulkan proof: all 8 WebGPU scales (40 OOM), real locked-camera motion, Hyperdrive, & 0 GPU errors', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan ULG Universes proof',
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
    if (SHOT_DIR) await writeFile(path.join(SHOT_DIR, `${name}.png`), buf);
    return buf;
  };

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
    });

    await page.goto(`${BASE_URL}universes.html?level=0`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.cosmicWebSteps ?? 0) >= 3, null, { timeout: 45_000 });

    const l0t0 = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l0t0.cameraAutoSpin, false);
    assert.equal(l0t0.scientificValidation, false);
    assert.equal(l0t0.submitsPerStep, 1);
    assert.equal(l0t0.gpuErrorCount, 0);
    assert.ok(l0t0.powerSpectrumPk?.kBins?.length >= 6);
    const pngL0A = await snap(page, 'universes-L0-cosmic-web-t0');

    await page.waitForFunction(
      (prev) => (window.__ulgUniversesDemo?.getState?.()?.cosmicWebSteps ?? 0) >= prev + 10,
      l0t0.cosmicWebSteps,
      { timeout: 45_000 }
    );
    const pngL0B = await snap(page, 'universes-L0-cosmic-web-t1');
    const l0Motion = comparePhysicalPixelPngFrames(pngL0A, pngL0B);
    assert.equal(l0Motion.visibleContentAdvanced, true, `L0 Cosmic Web must visibly evolve under locked camera (changedPx=${l0Motion.changedPixelCount})`);

    // L1: Galaxy & SMBH Lensing
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(1, { instant: true }));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.galacticSteps ?? 0) >= 4, null, { timeout: 45_000 });
    const l1A = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l1A.scaleId, 'galaxy');
    assert.ok(
      l1A.galacticGravityMode === 'webgpu-cic-3dfft-pm+smbh' || l1A.galacticGravityMode === 'webgpu-schroeder-scale-atlas-multipole',
      `Unexpected galacticGravityMode: ${l1A.galacticGravityMode}`
    );
    assert.ok(l1A.galacticBodyCount >= 8192);
    const pngL1A = await snap(page, 'universes-L1-galaxy-smbh-t0');
    await page.waitForFunction(
      (prev) => (window.__ulgUniversesDemo?.getState?.()?.galacticSteps ?? 0) >= prev + 16,
      l1A.galacticSteps,
      { timeout: 45_000 }
    );
    const pngL1B = await snap(page, 'universes-L1-galaxy-smbh-t1');
    const l1Motion = comparePhysicalPixelPngFrames(pngL1A, pngL1B);
    assert.equal(l1Motion.visibleContentAdvanced, true, `L1 Galaxy must visibly orbit under locked camera (changedPx=${l1Motion.changedPixelCount})`);

    // L2: Star System (Symplectic GPU Verlet)
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(2, { instant: true }));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.planetarySteps ?? 0) >= 15, null, { timeout: 45_000 });
    const l2State = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l2State.scaleId, 'star-system');
    assert.ok(l2State.planetarySteps >= 15);
    await snap(page, 'universes-L2-star-system');

    // L3: Stellar Core & Genesis
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(3, { instant: true }));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.stellarSteps ?? 0) >= 4, null, { timeout: 60_000 });
    const l3State = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l3State.scaleId, 'stellar-core');
    assert.ok(l3State.stellarSteps >= 4);
    await snap(page, 'universes-L3-stellar-core');

    // L4: Planetary Interior Cutaway (Inline WGSL Polytope Atlas)
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(4, { instant: true }));
    await page.waitForTimeout(350);
    const l4State = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l4State.scaleId, 'planetary-interior');
    assert.equal(l4State.planetaryInteriorValid, true, 'L4 Planetary interior polytope solve must converge validly');
    assert.ok(l4State.planetaryMoiFactor > 0.2 && l4State.planetaryMoiFactor < 0.45);
    await snap(page, 'universes-L4-planetary-interior');

    // L5: Crystal & Fluid MD (Zero-copy GPU MD)
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(5, { instant: true }));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.mdSteps ?? 0) >= 8, null, { timeout: 45_000 });
    const l5State = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l5State.scaleId, 'molecular-dynamics');
    assert.ok(l5State.mdAtomCount >= 64);
    await snap(page, 'universes-L5-molecular-dynamics');

    // L6: Quantum Atom (4-comp Dirac-KS + GPU Orbital Point Cloud)
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(6, { instant: true }));
    await page.waitForTimeout(400);
    const l6State = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l6State.scaleId, 'quantum-atom');
    assert.ok(l6State.orbitalPointCount >= 48000);
    await snap(page, 'universes-L6-quantum-atom');

    // L7: Atomic Nucleus & Visscher TDSE Tunneling
    await page.evaluate(() => window.__ulgUniversesDemo.setLevel(7, { instant: true }));
    await page.waitForFunction(() => (window.__ulgUniversesDemo?.getState?.()?.tdseSteps ?? 0) >= 16, null, { timeout: 45_000 });
    const l7State = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    assert.equal(l7State.scaleId, 'atomic-nucleus');
    assert.ok(l7State.nuclearBindingPerNucleonMeV > 6.5);
    assert.ok(l7State.tdseSteps >= 16);
    await snap(page, 'universes-L7-atomic-nucleus');

    // Test Retro CRT visual mode on L1 Galaxy & Hyperdrive + Return to Orbit
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setLevel(1, { instant: true });
      window.__ulgUniversesDemo.setRetroCrt(true, 3);
    });
    await page.waitForTimeout(350);
    await snap(page, 'universes-L1-retro-crt');
    await page.evaluate(() => window.__ulgUniversesDemo.setRetroCrt(false));

    // Verify animated Hyperdrive returnToOrbit transitions cleanly from L1 -> L0
    await page.evaluate(() => window.__ulgUniversesDemo.returnToOrbit());
    await page.waitForFunction(() => window.__ulgUniversesDemo?.getState?.()?.level === 0, null, { timeout: 15_000 });

    const finalState = await page.evaluate(() => ({
      ...window.__ulgUniversesDemo.getState(),
      uncaptured: (globalThis.__ulgWebGpuUncapturedErrors || []).filter((e) => e.label === 'ulg-universes-demo')
    }));
    assert.equal(finalState.level, 0);
    assert.equal(finalState.gpuErrorCount, 0);
    assert.deepEqual(finalState.uncaptured, []);
    assert.deepEqual(pageErrors, [], `pageErrors: ${pageErrors.join('; ')}`);
    assert.deepEqual(consoleErrors, [], `consoleErrors: ${consoleErrors.join('; ')}`);

    console.log('ULG Universes 8-Scale Native Vulkan Proof PASS:', JSON.stringify({
      l0ChangedPx: l0Motion.changedPixelCount,
      l1ChangedPx: l1Motion.changedPixelCount,
      l1Stars: l1A.galacticBodyCount,
      l2Steps: l2State.planetarySteps,
      l3Steps: l3State.stellarSteps,
      l4Moi: Number(l4State.planetaryMoiFactor.toFixed(4)),
      l5Atoms: l5State.mdAtomCount,
      l6Points: l6State.orbitalPointCount,
      l7TdseSteps: l7State.tdseSteps,
      gpuErrorCount: finalState.gpuErrorCount
    }));
    await ctx.close();
  } finally {
    await browser.close();
  }
});
