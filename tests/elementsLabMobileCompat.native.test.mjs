import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const SERVER_URL = process.env.ULG_DEV_URL || 'https://127.0.0.1:5173';
const SHOT_DIR = process.env.ULG_MOBILE_SHOT_DIR || '';

async function saveShot(page, name) {
  if (!SHOT_DIR) return;
  await fs.mkdir(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}-full.png`), fullPage: false });
  const dataUrl = await page.evaluate(() => window.__ulgElementsLabApi?.captureCanvasDataUrl?.());
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png;base64,')) {
    const buf = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
    await fs.writeFile(path.join(SHOT_DIR, `${name}-gpu.png`), buf);
  }
}

test('Material Physics Lab mobile compatibility: portrait/landscape layout, drawer, touch orbit/pinch, adaptive DPR & portrait WebGPU framing', {
  skip: !RUN_NATIVE && 'set ULG_RUN_NATIVE_WEBGPU=1 to run native Vulkan mobile compatibility suite',
  timeout: 180_000
}, async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--headless=new',
      '--enable-unsafe-webgpu',
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--disable-gpu-sandbox',
      '--ignore-gpu-blocklist'
    ]
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    const pageErrors = [];
    const gpuErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') {
        const txt = m.text();
        if (/webgpu|validation|shader/i.test(txt)) gpuErrors.push(txt);
      }
    });

    await page.goto(`${SERVER_URL}/elements-lab.html?z=26&tab=atomic`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 26 && window.__ulgElementsLabState?.orbitalCloudStats?.pointCount > 0, null, { timeout: 60_000 });
    await page.waitForTimeout(300);

    const layoutPortrait = await page.evaluate(() => {
      const canvas = document.getElementById('gpu-canvas');
      const rect = canvas.getBoundingClientRect();
      const drawerBtn = document.getElementById('mobile-drawer-btn');
      const quickBar = document.getElementById('mobile-quick-presets');
      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        canvasCssW: rect.width,
        canvasCssH: rect.height,
        canvasTop: rect.top,
        canvasBackW: canvas.width,
        canvasBackH: canvas.height,
        drawerBtnVisible: getComputedStyle(drawerBtn).display !== 'none',
        quickBarVisible: getComputedStyle(quickBar).display !== 'none',
        touchAction: getComputedStyle(canvas).touchAction,
        isMobileProfile: window.__ulgElementsLabState.isMobileProfile,
        pointCount: window.__ulgElementsLabState.orbitalCloudStats.pointCount
      };
    });
    console.log('[mobile-portrait-layout]', JSON.stringify(layoutPortrait));

    assert.ok(layoutPortrait.scrollWidth <= layoutPortrait.innerWidth + 2, `horizontal overflow: scrollWidth=${layoutPortrait.scrollWidth} > ${layoutPortrait.innerWidth}`);
    assert.ok(layoutPortrait.canvasCssW >= 380, `canvas crushed horizontally: ${layoutPortrait.canvasCssW}px`);
    assert.ok(layoutPortrait.canvasCssH >= 290, `canvas crushed vertically: ${layoutPortrait.canvasCssH}px`);
    assert.ok(layoutPortrait.canvasTop < 320, `canvas pushed below fold: top=${layoutPortrait.canvasTop}`);
    assert.ok(layoutPortrait.canvasBackW <= Math.ceil(390 * 1.5) + 8, `mobile DPR not capped: backingW=${layoutPortrait.canvasBackW}`);
    assert.equal(layoutPortrait.drawerBtnVisible, true);
    assert.equal(layoutPortrait.quickBarVisible, true);
    assert.equal(layoutPortrait.touchAction, 'none');
    assert.equal(layoutPortrait.isMobileProfile, true);
    assert.equal(layoutPortrait.pointCount, 90000);
    await saveShot(page, '01-mobile-portrait-fe-orbital');

    // Open mobile slide-over drawer, capture, then tap Au Gold Color -> verify drawer auto-closes!
    await page.click('#mobile-drawer-btn');
    await page.waitForTimeout(260);
    const drawerOpened = await page.evaluate(() => document.body.classList.contains('drawer-open'));
    assert.equal(drawerOpened, true, 'drawer must open on tap');
    await saveShot(page, '02-mobile-drawer-open');

    await page.click('#hero-presets [data-hero-z="79"]');
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 79 && window.__ulgElementsLabState?.currentTab === 'crystal', null, { timeout: 60_000 });
    await page.waitForTimeout(250);
    const drawerAutoClosed = await page.evaluate(() => !document.body.classList.contains('drawer-open'));
    assert.equal(drawerAutoClosed, true, 'drawer must auto-close after picking preset');
    await page.evaluate(() => window.__ulgElementsLabApi.stepTdks(40));
    await saveShot(page, '03-mobile-portrait-au-tdks');

    // Verify 1-finger touch orbit + 2-finger pinch-to-zoom + reset button!
    const camBefore = await page.evaluate(() => window.__ulgElementsLabApi.getCamera());
    await page.evaluate(() => {
      const c = document.getElementById('gpu-canvas');
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.5;
      // 1-finger drag right & down
      c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: cx + 70, clientY: cy + 35, bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: cx + 70, clientY: cy + 35, bubbles: true }));
      // 2-finger pinch out (zoom in)
      c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: cx - 30, clientY: cy, bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, pointerType: 'touch', clientX: cx + 30, clientY: cy, bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, pointerType: 'touch', clientX: cx - 75, clientY: cy, bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 3, pointerType: 'touch', clientX: cx + 75, clientY: cy, bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, pointerType: 'touch', clientX: cx - 75, clientY: cy, bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, pointerType: 'touch', clientX: cx + 75, clientY: cy, bubbles: true }));
    });
    const camAfterTouch = await page.evaluate(() => window.__ulgElementsLabApi.getCamera());
    console.log('[mobile-touch-camera]', JSON.stringify({ camBefore, camAfterTouch }));
    assert.ok(Math.abs(camAfterTouch.yaw - camBefore.yaw) > 0.3, '1-finger touch drag must orbit yaw');
    assert.ok(camAfterTouch.dist < camBefore.dist - 0.5, '2-finger pinch-out must zoom in');

    await page.click('#canvas-reset-view-btn');
    const camReset = await page.evaluate(() => window.__ulgElementsLabApi.getCamera());
    assert.ok(Math.abs(camReset.dist - 2.85) < 1e-4, 'reset button must restore camera dist');

    // Switch to 2D Maxwell Slab (Snell) on portrait phone & capture!
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('photon-shell'));
    await page.evaluate(() => window.__ulgElementsLabApi.stepPhotonFdtd(110));
    await saveShot(page, '04-mobile-portrait-au-2d-maxwell');

    // Tap H2O quick chip -> Tab 6 Polytope Atlas -> touch probe!
    await page.click('#mobile-quick-presets [data-hero-compound="H2O"]');
    await page.waitForFunction(() => window.__ulgElementsLabState?.backfedFormula === 'H2O', null, { timeout: 60_000 });
    await page.click('.tab-btn[data-tab="polytope"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const c = document.getElementById('gpu-canvas');
      const r = c.getBoundingClientRect();
      c.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 10, pointerType: 'touch',
        clientX: r.left + r.width * 0.45,
        clientY: r.top + r.height * 0.50,
        bubbles: true
      }));
      c.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 10, pointerType: 'touch',
        clientX: r.left + r.width * 0.45,
        clientY: r.top + r.height * 0.50,
        bubbles: true
      }));
    });
    await page.waitForFunction(() => Boolean(window.__ulgElementsLabState?.polytopeProbe), null, { timeout: 10_000 });
    const touchProbe = await page.evaluate(() => window.__ulgElementsLabState.polytopeProbe);
    console.log('[mobile-polytope-touch-probe]', JSON.stringify(touchProbe));
    assert.equal(touchProbe.hit, true, 'touch tap inside Polytope Atlas must evaluate live GPU cell');
    await saveShot(page, '05-mobile-portrait-h2o-polytope');

    // Rotate to Landscape Phone (844x390) and verify clean resize + zero overflow!
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(250);
    await page.click('.tab-btn[data-tab="crystal"]');
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('photon-shell'));
    await page.waitForTimeout(200);
    const layoutLandscape = await page.evaluate(() => {
      const r = document.getElementById('gpu-canvas').getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        canvasCssW: r.width,
        canvasCssH: r.height
      };
    });
    console.log('[mobile-landscape-layout]', JSON.stringify(layoutLandscape));
    assert.ok(layoutLandscape.scrollWidth <= layoutLandscape.innerWidth + 2, `landscape overflow: ${layoutLandscape.scrollWidth}`);
    assert.ok(layoutLandscape.canvasCssW >= 800 && layoutLandscape.canvasCssH >= 220);
    await saveShot(page, '06-mobile-landscape-h2o-snell');

    assert.deepEqual(pageErrors, [], `unexpected page errors: ${pageErrors.join('; ')}`);
    assert.deepEqual(gpuErrors, [], `unexpected WebGPU errors: ${gpuErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});
