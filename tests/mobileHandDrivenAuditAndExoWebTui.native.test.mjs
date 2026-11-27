// ExoWebTUI Multi-Window Desktop, Retro UI & Real Mobile Form-Factor Hand-Driving Audit (`U17–U19`).
//
// Hand-drives ULG across:
//   - Desktop (1280x800): Landing Gate -> ExoWebTUI Desktop multi-window opening, tiling,
//     floating drag, minimize/restore, theme sync into embedded WebGPU lab iframes, CRT toggle,
//     and cross-lab window opening.
//   - Mobile Portrait (390x844, touch) & Mobile Landscape (844x390, touch):
//     Landing Gate, ExoWebTUI single-window phone mode & bottom dock, ULG Universes
//     (L0 Cosmic Web, Tools, Guided Tour, EM Sensor, L4 Earth Orbit, Landed Surface + Controls),
//     Continuum Studio, Material Physics Lab, Organic Chemistry Lab, and Bio/Life Lab.
//
// Captures real rendered PNG screenshots when `ULG_CAPTURE_MOBILE_AUDIT=1` so every screen
// can be visually inspected with zero guesswork.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_UNIVERSES_URL || 'https://127.0.0.1:5173';
const CAPTURE_DIR = process.env.ULG_CAPTURE_MOBILE_AUDIT_DIR || null;

async function launchVulkanBrowser() {
  return chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-gl=angle',
      '--use-angle=vulkan',
      '--enable-features=Vulkan',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
      '--renderer-process-limit=2',
      '--no-sandbox'
    ]
  });
}

async function maybeShot(page, name) {
  if (!CAPTURE_DIR) return;
  await fs.mkdir(CAPTURE_DIR, { recursive: true });
  await page.screenshot({ path: path.join(CAPTURE_DIR, name) });
}

async function auditViewportGeometry(page, label) {
  return page.evaluate((lbl) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scrollW = document.documentElement.scrollWidth;
    const clippedButtons = [];
    const tinyButtons = [];
    const visibleInteractives = [...document.querySelectorAll('button, a[href], select')].filter((el) => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    });
    for (const el of visibleInteractives) {
      const r = el.getBoundingClientRect();
      // Ignore buttons inside collapsed/off-screen drawers or horizontal scroll strips
      const inScrollStrip = Boolean(el.closest('#exo-tab-strip, #exo-mobile-dock, .uv-tab-row, .uv-scale-rail, .uv-surf-bar, .uv-surf-pills, #uv-surf-weapon-bar, .mobile-ctx-bar, .mobile-context-row, .tabs'));
      if (!inScrollStrip && (r.right > vw + 4 || r.left < -4)) {
        clippedButtons.push({
          id: el.id || el.className || el.tagName,
          text: (el.textContent || '').trim().slice(0, 32),
          left: Math.round(r.left),
          right: Math.round(r.right),
          vw
        });
      }
      if (vw < 680 && r.height < 24 && r.width < 24) {
        tinyButtons.push({
          id: el.id || el.className || el.tagName,
          text: (el.textContent || '').trim().slice(0, 24),
          w: Math.round(r.width),
          h: Math.round(r.height)
        });
      }
    }
    return {
      label: lbl,
      vw,
      vh,
      scrollW,
      overflowPx: Math.max(0, scrollW - vw),
      retroActive: document.documentElement.dataset.ulgRetro === '1',
      clippedButtons: clippedButtons.slice(0, 8),
      tinyButtons: tinyButtons.slice(0, 8)
    };
  }, label);
}

test('U17–U19: ExoWebTUI Multi-Window Desktop, Retro UI & Mobile Hand-Driving Audit (Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan UI & ExoWebTUI verification',
  timeout: 300000
}, async () => {
  const browser = await launchVulkanBrowser();
  const consoleErrors = [];
  const pageErrors = [];
  const auditReport = [];

  const attachErrors = (page, tag) => {
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${tag}] ${m.text()}`); });
    page.on('pageerror', (e) => pageErrors.push(`[${tag}] ${String(e)}`));
  };

  try {
    // =========================================================================
    // 1. DESKTOP (1280x800): LANDING GATE -> EXOWEB TUI MULTI-WINDOW DESKTOP
    // =========================================================================
    {
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: true
      });
      const page = await ctx.newPage();
      attachErrors(page, 'desktop-landing-exotui');

      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#ulg-launch-exowebtui-btn', { timeout: 20000 });
      await page.waitForTimeout(300);

      const landingGeom = await auditViewportGeometry(page, 'desktop-landing');
      auditReport.push(landingGeom);
      assert.equal(landingGeom.retroActive, true, 'Landing page must enable retro workstation theme');
      assert.ok(landingGeom.overflowPx <= 2, `Desktop landing overflow=${landingGeom.overflowPx}`);
      const landingText = await page.textContent('#ulg-empty-state');
      assert.match(landingText, /ExoWebTUI/i, 'Landing page must ask to launch inside ExoWebTUI');
      assert.match(await page.textContent('#ulg-empty-open-btn'), /Mesoscale Continuum Solver/i);
      await maybeShot(page, '01_desktop_landing_gate.png');

      // Click Launch ExoWebTUI Desktop!
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.click('#ulg-launch-exowebtui-btn')
      ]);
      await page.waitForFunction(() => Boolean(window.__ulgExoWebTui?.getState?.()), { timeout: 20000 });
      await page.waitForTimeout(1800);

      const bootDesktop = await page.evaluate(() => ({
        state: window.__ulgExoWebTui.getState(),
        hasTuiCanvas: Boolean(document.querySelector('#exotui-canvas-root canvas')),
        iframeCount: document.querySelectorAll('.exo-win-iframe').length
      }));
      assert.equal(bootDesktop.hasTuiCanvas, true, 'Real @exotui cell canvas must mount on desktop');
      assert.equal(bootDesktop.state.activeWinId, 'universes', 'ULG Universes window should open by default');
      assert.equal(bootDesktop.iframeCount, 1, 'Initial default window must mount its live lab iframe');
      await maybeShot(page, '02_desktop_exowebtui_single.png');

      // Open Start Menu and launch Elements Lab alongside Universes, then TILE both side-by-side!
      await page.click('#exo-start-btn');
      await page.waitForSelector('#exo-start-menu.open [data-menu-lab="elements"]', { timeout: 8000 });
      await maybeShot(page, '03_desktop_exowebtui_start_menu.png');
      await page.click('#exo-start-menu [data-menu-lab="elements"]');
      await page.waitForTimeout(1600);

      // Tile all open lab windows side-by-side
      await page.click('#exo-tile-btn');
      await page.waitForTimeout(900);
      const tiledCheck = await page.evaluate(() => {
        const wins = [...document.querySelectorAll('.exo-win:not(.hidden-win)')].map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.dataset.winId, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        });
        return { state: window.__ulgExoWebTui.getState(), wins };
      });
      assert.equal(tiledCheck.state.layoutMode, 'tiled', 'Tile button must switch desktop to tiled layout');
      assert.equal(tiledCheck.wins.length, 2, 'Two live ULG lab windows must be visible simultaneously');
      const [wA, wB] = tiledCheck.wins.sort((a, b) => a.x - b.x);
      assert.ok(wA.x + wA.w <= wB.x + 2, `Tiled windows must not overlap (A.right=${wA.x + wA.w}, B.left=${wB.x})`);
      await maybeShot(page, '04_desktop_exowebtui_tiled_2labs.png');

      // Switch to Floating, open Console, switch ExoWebTUI Theme to Amber + CRT ON, and verify iframe theme propagation!
      await page.click('#exo-cascade-btn');
      await page.click('#exo-console-btn');
      await page.waitForSelector('[data-exo-theme="amber"]', { timeout: 8000 });
      await page.click('[data-exo-theme="amber"]');
      await page.click('#exo-crt-btn');
      await page.waitForTimeout(600);
      const themeSync = await page.evaluate(() => {
        const ifr = document.querySelector('.exo-win[data-win-id="elements"] iframe');
        const childTheme = ifr?.contentDocument?.documentElement?.dataset?.ulgTheme || null;
        const childCrt = ifr?.contentDocument?.documentElement?.dataset?.ulgCrt || null;
        return {
          parentTheme: window.__ulgExoWebTui.getState().themeId,
          parentCrt: window.__ulgExoWebTui.getState().crtEnabled,
          childTheme,
          childCrt
        };
      });
      assert.equal(themeSync.parentTheme, 'amber', 'ExoWebTUI theme must update to Amber Glass');
      assert.equal(themeSync.parentCrt, true, 'CRT toggle must activate');
      assert.equal(themeSync.childTheme, 'amber', 'Embedded lab iframe must receive live ExoWebTUI theme');
      assert.equal(themeSync.childCrt, '1', 'Embedded lab iframe must receive live CRT toggle');
      await maybeShot(page, '05_desktop_exowebtui_amber_crt.png');

      // Reset theme to section9 and CRT off for clean mobile testing
      await page.click('[data-exo-theme="section9"]');
      await page.click('#exo-crt-btn');

      // Drag console window titlebar and verify position changes
      const beforeDrag = await page.evaluate(() => {
        const r = document.querySelector('.exo-win[data-win-id="console"]').getBoundingClientRect();
        return { x: r.left, y: r.top };
      });
      const tbBox = await page.locator('.exo-win[data-win-id="console"] .exo-win-titlebar').boundingBox();
      await page.mouse.move(tbBox.x + 80, tbBox.y + 12);
      await page.mouse.down();
      await page.mouse.move(tbBox.x + 20, tbBox.y + 72, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(150);
      const afterDrag = await page.evaluate(() => {
        const r = document.querySelector('.exo-win[data-win-id="console"]').getBoundingClientRect();
        return { x: r.left, y: r.top };
      });
      assert.ok(Math.hypot(afterDrag.x - beforeDrag.x, afterDrag.y - beforeDrag.y) >= 25, 'Dragging titlebar must move floating window');

      // Test cross-lab postMessage opening Bio Lab as its own window
      await page.evaluate(() => {
        window.postMessage({ type: 'ulg-exowebtui-open-lab', labId: 'life', href: './life-lab.html?embedded=exowebtui' }, '*');
      });
      await page.waitForTimeout(900);
      const lifeOpen = await page.evaluate(() => window.__ulgExoWebTui.getState().activeWinId);
      assert.equal(lifeOpen, 'life', 'Cross-lab navigation must open Bio Lab in its own ExoWebTUI window');

      await ctx.close();
    }

    // =========================================================================
    // 2. MOBILE PORTRAIT (390x844) HAND-DRIVEN AUDIT ACROSS ALL APPS
    // =========================================================================
    {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        ignoreHTTPSErrors: true
      });
      const page = await ctx.newPage();
      attachErrors(page, 'mobile-portrait');

      // 2A. Landing Gate on 390x844 phone
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#ulg-launch-exowebtui-btn', { timeout: 20000 });
      await page.waitForTimeout(300);
      const mLanding = await auditViewportGeometry(page, 'mobile-390-landing');
      auditReport.push(mLanding);
      assert.ok(mLanding.overflowPx <= 2, `Mobile landing overflow=${mLanding.overflowPx}`);
      assert.equal(mLanding.clippedButtons.length, 0, `Mobile landing clipped buttons: ${JSON.stringify(mLanding.clippedButtons)}`);
      await maybeShot(page, '06_mobile390_landing_gate.png');

      // 2B. ExoWebTUI Desktop in Mobile Phone Single-Window Mode (390x844)
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.tap('#ulg-launch-exowebtui-btn')
      ]);
      await page.waitForFunction(() => Boolean(window.__ulgExoWebTui?.getState?.()), { timeout: 20000 });
      await page.waitForTimeout(1600);
      const mDesktop = await auditViewportGeometry(page, 'mobile-390-exowebtui');
      const mDesktopState = await page.evaluate(() => {
        const win = document.querySelector('.exo-win[data-win-id="universes"]')?.getBoundingClientRect();
        const bar = document.getElementById('exo-topbar')?.getBoundingClientRect();
        const dock = document.getElementById('exo-mobile-dock')?.getBoundingClientRect();
        return {
          mobileMode: window.__ulgExoWebTui.getState().mobile,
          winW: Math.round(win?.width || 0),
          winH: Math.round(win?.height || 0),
          barH: Math.round(bar?.height || 0),
          dockH: Math.round(dock?.height || 0)
        };
      });
      auditReport.push({ ...mDesktop, ...mDesktopState });
      assert.equal(mDesktopState.mobileMode, true, 'ExoWebTUI must auto-enter mobile single-window mode on 390px');
      assert.ok(mDesktop.overflowPx <= 2, `Mobile ExoWebTUI overflow=${mDesktop.overflowPx}`);
      assert.ok(mDesktopState.winH >= 740, `Mobile ExoWebTUI active lab height must be >= 740px (got ${mDesktopState.winH})`);
      await maybeShot(page, '07_mobile390_exowebtui_universes.png');

      // Tap mobile bottom dock to switch to Elements Lab inside ExoWebTUI!
      await page.tap('#exo-mobile-dock [data-dock-lab-id="elements"]');
      await page.waitForTimeout(1400);
      const mSwitched = await page.evaluate(() => window.__ulgExoWebTui.getState().activeWinId);
      assert.equal(mSwitched, 'elements', 'Mobile dock tap must switch active lab window');
      await maybeShot(page, '08_mobile390_exowebtui_elements.png');

      // 2C. Direct Mobile Hand-Driving of ULG Universes (390x844): Cosmic Web -> Tools -> Tour -> EM -> L4 -> Surface
      await page.goto(`${BASE_URL}/universes.html?seed=20261125&sol=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.().ready), { timeout: 35000 });
      await page.waitForTimeout(600);
      const mUvBoot = await auditViewportGeometry(page, 'mobile-390-universes-boot');
      auditReport.push(mUvBoot);
      assert.ok(mUvBoot.overflowPx <= 2, `Mobile Universes boot overflow=${mUvBoot.overflowPx}`);
      await maybeShot(page, '09_mobile390_universes_l0.png');

      // Tap Tools popover + Tour + EM Sensor
      await page.tap('#uv-mobile-tools-btn');
      await page.waitForTimeout(250);
      await maybeShot(page, '10_mobile390_universes_tools.png');
      await page.tap('#uv-autopilot-btn');
      await page.waitForTimeout(550);
      const mUvTour = await auditViewportGeometry(page, 'mobile-390-universes-tour');
      auditReport.push(mUvTour);
      await maybeShot(page, '11_mobile390_universes_tour.png');
      await page.tap('#uv-tour-stop-btn');
      await page.waitForTimeout(200);
      // Close mobile tools popover if still open
      await page.evaluate(() => document.getElementById('uv-topbar')?.classList.remove('mobile-tools-open'));

      // Open EM Sensor tab on mobile bottom Command Deck & check layout
      await page.tap('[data-deck-tab="em"]');
      await page.waitForTimeout(300);
      const mUvEm = await auditViewportGeometry(page, 'mobile-390-universes-em');
      auditReport.push(mUvEm);
      await maybeShot(page, '12_mobile390_universes_em.png');
      await page.evaluate(() => window.__ulgUniversesDemo.setMobileDeckState('collapsed'));
      await page.waitForTimeout(150);

      // Jump to L4 Earth + open peek deck, then Land on Surface!
      await page.evaluate(async () => {
        await window.__ulgUniversesDemo.setLevel(4, { instant: true });
        window.__ulgUniversesDemo.setMobileDeckState('peek');
        await window.__ulgUniversesDemo.stepOnce();
      });
      await page.waitForTimeout(450);
      const mUvL4 = await auditViewportGeometry(page, 'mobile-390-universes-l4-peek');
      auditReport.push(mUvL4);
      await maybeShot(page, '13_mobile390_universes_l4_peek.png');

      await page.evaluate(async () => {
        await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'earth' });
        for (let i = 0; i < 4; i += 1) await window.__ulgUniversesDemo.stepOnce();
      });
      await page.waitForTimeout(550);
      const mUvSurf = await auditViewportGeometry(page, 'mobile-390-universes-surface');
      auditReport.push(mUvSurf);
      await maybeShot(page, '14_mobile390_universes_surface.png');

      // 2D. Continuum Studio Modal on 390x844
      await page.goto(`${BASE_URL}/index.html?studio=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#ulg-empty-open-btn', { timeout: 20000 });
      await page.tap('#ulg-empty-open-btn');
      await page.waitForTimeout(300);
      const mStudio = await auditViewportGeometry(page, 'mobile-390-studio-modal');
      auditReport.push(mStudio);
      assert.ok(mStudio.overflowPx <= 2, `Mobile Studio modal overflow=${mStudio.overflowPx}`);
      await maybeShot(page, '15_mobile390_studio_modal.png');

      // 2E. Elements, Organic & Bio Labs on 390x844
      for (const [slug, url, readyFn] of [
        ['elements', '/elements-lab.html', () => document.querySelectorAll('canvas').length >= 1],
        ['organic', '/organic-lab.html', () => Boolean(window.__ulgOrganicLab)],
        ['life', '/life-lab.html', () => Boolean(window.__ulgLifeLab)]
      ]) {
        await page.goto(`${BASE_URL}${url}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(readyFn, { timeout: 35000 });
        await page.waitForTimeout(700);
        const g = await auditViewportGeometry(page, `mobile-390-${slug}`);
        auditReport.push(g);
        assert.ok(g.overflowPx <= 2, `Mobile ${slug} overflow=${g.overflowPx}`);
        await maybeShot(page, `16_mobile390_${slug}.png`);
      }

      await ctx.close();
    }

    // =========================================================================
    // 3. MOBILE LANDSCAPE (844x390) HAND-DRIVEN AUDIT
    // =========================================================================
    {
      const ctx = await browser.newContext({
        viewport: { width: 844, height: 390 },
        isMobile: true,
        hasTouch: true,
        ignoreHTTPSErrors: true
      });
      const page = await ctx.newPage();
      attachErrors(page, 'mobile-landscape');

      await page.goto(`${BASE_URL}/universes.html?seed=20261125&sol=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.().ready), { timeout: 35000 });
      await page.waitForTimeout(500);
      const lUv = await auditViewportGeometry(page, 'mobile-844x390-universes');
      auditReport.push(lUv);
      assert.ok(lUv.overflowPx <= 2, `Landscape Universes overflow=${lUv.overflowPx}`);
      await maybeShot(page, '17_landscape844_universes.png');

      await page.evaluate(async () => {
        await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'earth' });
        for (let i = 0; i < 3; i += 1) await window.__ulgUniversesDemo.stepOnce();
      });
      await page.waitForTimeout(500);
      const lUvSurf = await auditViewportGeometry(page, 'mobile-844x390-surface');
      auditReport.push(lUvSurf);
      await maybeShot(page, '18_landscape844_surface.png');

      await page.goto(`${BASE_URL}/life-lab.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__ulgLifeLab), { timeout: 35000 });
      await page.waitForTimeout(700);
      const lLife = await auditViewportGeometry(page, 'mobile-844x390-life');
      auditReport.push(lLife);
      assert.ok(lLife.overflowPx <= 2, `Landscape Life Lab overflow=${lLife.overflowPx}`);
      await maybeShot(page, '19_landscape844_life.png');

      await ctx.close();
    }

    console.log('MOBILE_AND_EXOWEB_AUDIT_REPORT=' + JSON.stringify(auditReport, null, 2));
    assert.equal(pageErrors.length, 0, `Uncaught page errors: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});
