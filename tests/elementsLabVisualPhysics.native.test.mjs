import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = (process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173').replace(/\/$/, '');
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SCREENSHOT_DIR = process.env.ULG_LAB_SHOT_DIR || '';

async function launchHeadlessVulkanChrome() {
  const { chromium } = await import('@playwright/test');
  const env = { ...process.env };
  delete env.DISPLAY;
  delete env.WAYLAND_DISPLAY;
  delete env.XAUTHORITY;
  return chromium.launch({
    executablePath: CHROME,
    headless: true,
    env,
    args: [
      '--headless=new',
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--use-gl=angle',
      '--use-angle=vulkan',
      '--disable-gpu-sandbox',
      '--ignore-gpu-blocklist'
    ]
  });
}

async function saveLabCapture(page, stem) {
  if (!SCREENSHOT_DIR) return;
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const dataUrl = await page.evaluate(() => window.__ulgElementsLabApi.captureCanvasDataUrl());
  const b64 = String(dataUrl || '').replace(/^data:image\/png;base64,/, '');
  if (b64.length > 100) {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, `${stem}-gpu.png`), Buffer.from(b64, 'base64'));
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${stem}-full.png`) });
}

test('Material Physics Lab: MoonLab orbitals, live Maxwell Photon-Shell Gold/Water physics, TDSE, Chemistry CI-NEB & Compound Backfeed on native Vulkan WebGPU', {
  skip: !RUN_NATIVE,
  timeout: 240_000
}, async () => {
  const browser = await launchHeadlessVulkanChrome();
  const pageErrors = [];
  const gpuErrors = [];
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => { console.error('[pageerror]', e.message); pageErrors.push(e.message); });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('[console.error]', msg.text());
        if (msg.text().toLowerCase().includes('webgpu')) gpuErrors.push(msg.text());
      }
    });

    // 1. Load Gold (Au, Z=79) directly on Tab 2 (MoonLab-grade 3D Quantum Orbital Point Cloud!)
    await page.goto(`${BASE_URL}/elements-lab.html?z=79&tab=atomic`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 79 && window.__ulgElementsLabState?.orbitalCloudStats?.pointCount >= 50000, null, { timeout: 60_000 });
    const auOrbState = await page.evaluate(() => ({
      orbital: window.__ulgElementsLabState.orbitalCloudStats,
      modules: window.__ulgElementsLabState.registeredModules,
      cameraAutoSpin: window.__ulgElementsLabState.cameraAutoSpin,
      bundleRel: window.__ulgElementsLabState.bundle.atomic.relativisticMethod,
      oscillators: window.__ulgElementsLabState.bundle.electromagnetic.interbandOscillators,
      srgb: window.__ulgElementsLabState.bundle.electromagnetic.opticalSrgb
    }));
    console.log('[lab-au-orbital]', JSON.stringify(auOrbState));
    assert.equal(auOrbState.cameraAutoSpin, false);
    assert.ok(auOrbState.orbital.pointCount >= 100000);
    assert.equal(auOrbState.orbital.sourceKind, 'webgpu-kohn-sham-eigenstate', 'Au 5d must sample actual GPU Dirac-KS eigenstate!');
    assert.ok(auOrbState.modules.includes('quantum-orbital-cloud@1'));
    assert.ok(auOrbState.modules.includes('quantum-tdks-photon@1'));
    assert.ok(auOrbState.modules.includes('photon-shell-fdtd@1'));
    assert.ok(auOrbState.modules.includes('nuclear-tunneling-tdse@1'));
    await saveLabCapture(page, '01-au-5d-orbital-cloud');

    // Also inspect Fe 5d m=2 MoonLab reference configuration!
    await page.evaluate(async () => {
      await window.__ulgElementsLabApi.solveElement(26, null);
      window.__ulgElementsLabApi.setOrbital(5, 2, 2);
    });
    await saveLabCapture(page, '02-fe-5d-m2-moonlab-cloud');

    // 2. Gold (Au, Z=79) Live TD-KS Single-Atom Electron Cloud <-> Photon Wavepacket + 2D Maxwell Slab: Relativistic ON vs OFF!
    await page.evaluate(async () => {
      await window.__ulgElementsLabApi.solveElement(79, null, { switchToTab: 'crystal' });
    });
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 79 && window.__ulgElementsLabState?.currentTab === 'crystal', null, { timeout: 45_000 });
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('bloch'));
    await saveLabCapture(page, '03a-au-3d-bloch-crystal');
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('tdks-atom'));
    const auTdksRel = await page.evaluate(() => window.__ulgElementsLabApi.stepTdks(28));
    console.log('[lab-au-tdks-rel-ON]', JSON.stringify(auTdksRel));
    await saveLabCapture(page, '03-au-tdks-cloud-photon-rel');

    // Switch to 2D 128x128 Bulk Maxwell-ADE-FDTD Slab view: capture mid-reflection PNG, then finish full pulse integration!
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('photon-shell'));
    await page.evaluate(() => window.__ulgElementsLabApi.stepPhotonFdtd(105));
    await saveLabCapture(page, '04-au-2d-maxwell-slab-rel-gold');
    const auRelTel = await page.evaluate(() => window.__ulgElementsLabApi.stepPhotonFdtd(100));
    console.log('[lab-au-fdtd-rel-ON]', JSON.stringify({
      R_red: auRelTel.channels[0].reflectance,
      R_green: auRelTel.channels[1].reflectance,
      R_blue: auRelTel.channels[2].reflectance,
      A_blue: auRelTel.channels[2].absorption,
      emergentSrgb: auRelTel.emergentReflectedSrgb,
      osc0: auRelTel.oscillators[0]
    }));
    assert.ok(auRelTel.channels[0].reflectance > 0.55, `Au rel ON R_red=${auRelTel.channels[0].reflectance}`);
    assert.ok(
      auRelTel.channels[0].reflectance > auRelTel.channels[2].reflectance + 0.12,
      `Au rel ON must absorb blue relative to red (Gold color!): R_red=${auRelTel.channels[0].reflectance}, R_blue=${auRelTel.channels[2].reflectance}`
    );

    // Toggle Relativistic + Spin-Orbit OFF on Gold -> watch Gold turn SILVERY!
    await page.evaluate(() => window.__ulgElementsLabApi.setRelativistic(false));
    await page.waitForFunction(() => window.__ulgElementsLabState?.relativisticSpinOrbit === false, null, { timeout: 45_000 });
    await page.evaluate(() => window.__ulgElementsLabApi.stepPhotonFdtd(105));
    await saveLabCapture(page, '05-au-2d-maxwell-slab-nonrel-silver');
    const auNonRelTel = await page.evaluate(() => window.__ulgElementsLabApi.stepPhotonFdtd(100));
    console.log('[lab-au-fdtd-rel-OFF]', JSON.stringify({
      R_red: auNonRelTel.channels[0].reflectance,
      R_green: auNonRelTel.channels[1].reflectance,
      R_blue: auNonRelTel.channels[2].reflectance,
      A_blue: auNonRelTel.channels[2].absorption,
      emergentSrgb: auNonRelTel.emergentReflectedSrgb,
      osc0: auNonRelTel.oscillators[0]
    }));
    assert.ok(
      auNonRelTel.channels[2].reflectance > auRelTel.channels[2].reflectance + 0.12,
      `Turning Relativistic OFF on Au must shift 5d->6p to UV and raise R_blue toward silver: nonRel=${auNonRelTel.channels[2].reflectance} vs rel=${auRelTel.channels[2].reflectance}`
    );
    // Restore Relativistic ON
    await page.evaluate(() => window.__ulgElementsLabApi.setRelativistic(true));

    // 3. Uranium-235 Nuclear + Live 1D Symplectic Quantum Tunneling TDSE on Tab 1
    await page.evaluate(() => window.__ulgElementsLabApi.solveElement(92, 235, { switchToTab: 'nuclear' }));
    await page.waitForFunction(() => window.__ulgElementsLabState?.isotope === 'U-235', null, { timeout: 45_000 });
    const tdseTel = await page.evaluate(() => window.__ulgElementsLabApi.stepTdse(160));
    console.log('[lab-u235-tdse]', JSON.stringify({
      stepCount: tdseTel.stepCount,
      pInside: tdseTel.pInside,
      pBarrier: tdseTel.pBarrier,
      pTunneled: tdseTel.pTunneled
    }));
    assert.ok(tdseTel.pInside > 0.1 && Number.isFinite(tdseTel.pTunneled));
    await saveLabCapture(page, '06-u235-nuclear-tdse');

    // 4. Multi-Element Chemistry (`Na + H2O -> NaOH + H2`) + Backfeed `H2O` into 2D Snell Refraction + MD + Polytope!
    await page.evaluate(() => window.__ulgElementsLabApi.runReaction('Na', 'H2O'));
    await page.waitForFunction(() => window.__ulgElementsLabState?.mode === 'compound', null, { timeout: 60_000 });
    await saveLabCapture(page, '07-reaction-na-h2o-products');

    // Backfeed H2O into Tab 3 2D Maxwell-ADE-FDTD -> measure LIVE refractive index n(lambda) & Snell refraction angle!
    await page.evaluate(() => window.__ulgElementsLabApi.backfeedCompound('H2O', 'crystal'));
    await page.waitForFunction(() => window.__ulgElementsLabState?.backfedFormula === 'H2O' && window.__ulgElementsLabState?.currentTab === 'crystal', null, { timeout: 60_000 });
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('photon-shell'));
    await page.evaluate(() => window.__ulgElementsLabApi.stepPhotonFdtd(95));
    await saveLabCapture(page, '08-h2o-2d-snell-refraction');
    const h2oTel = await page.evaluate(() => window.__ulgElementsLabApi.stepPhotonFdtd(105));
    const h2oN = h2oTel.channels[1].nMeasuredFdtd ?? h2oTel.channels[0].nMeasuredFdtd;
    console.log('[lab-h2o-fdtd-refraction]', JSON.stringify({
      nPhaseGreen: h2oTel.channels[1].nPhaseFdtd,
      nSnellGreen: h2oTel.channels[1].nSnellFdtd,
      refractAngleDeg: h2oTel.channels[1].refractAngleDeg,
      analyticN: h2oTel.channels[1].analyticNRe,
      transmittanceGreen: h2oTel.channels[1].transmittance,
      reflectanceGreen: h2oTel.channels[1].reflectance
    }));
    assert.ok(Number.isFinite(h2oN) && h2oN > 1.15 && h2oN < 2.2, `H2O live 2D FDTD measured n=${h2oN}`);

    // Backfed H2O Tab 5 CI-NEB Reactive Orbitals
    await page.evaluate(() => window.__ulgElementsLabApi.setTab('compound'));
    await saveLabCapture(page, '09-h2o-ci-neb-orbital');

    // Backfed H2O Tab 4 Live 3D WebGPU MD
    await page.evaluate(() => window.__ulgElementsLabApi.setTab('md'));
    await page.waitForTimeout(350);
    await saveLabCapture(page, '10-h2o-backfed-md');

    // Backfed H2O Tab 6 Interactive GPU Polytope Atlas Probe (Valid interior + Fail-Closed out-of-domain!)
    await page.evaluate(() => window.__ulgElementsLabApi.setTab('polytope'));
    const insideProbe = await page.evaluate(() => window.__ulgElementsLabApi.probePolytope(300, 101325));
    await saveLabCapture(page, '11-h2o-polytope-inside');
    const outsideProbe = await page.evaluate(() => window.__ulgElementsLabApi.probePolytope(1.0, 1e14));
    await saveLabCapture(page, '12-h2o-polytope-failclosed');
    console.log('[lab-polytope-probes]', JSON.stringify({ insideProbe, outsideProbe }));
    assert.equal(insideProbe.hit, true, '300 K / 1 atm must hit valid polytope cell');
    assert.ok(insideProbe.densityKgPerM3 > 500, `H2O 300K GPU density=${insideProbe.densityKgPerM3}`);
    assert.equal(outsideProbe.hit, false, '1 K / 100 TPa must fail closed');
    assert.equal(outsideProbe.failClosed, true);

    assert.deepEqual(pageErrors, [], `unexpected page errors: ${pageErrors.join('; ')}`);
    assert.deepEqual(gpuErrors, [], `unexpected WebGPU errors: ${gpuErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});
