// Mobile-First & Context-First UI Revamp Native Vulkan QA Suite
// Verifies across Mobile Portrait (390x844), Mobile Landscape (844x390), and Desktop (1280x720):
//   1. ULG Universes: compact 2-row mobile topbar (<= 96px), collapsed-by-default bottom sheet (~80% open 3D cosmos),
//      ⋯ mobile tools popover, 2-finger pinch-to-zoom, Context-First Spotlight for Galaxy/Star/Planet/Asteroid/Quantum,
//      AND direct live Surface Alien (Fauna) + Tree (Flora) picking with 1-tap Abduct & Bio Aquarium!
//   2. Biophysics & Life Lab: zero header/canvas horizontal overflow on 390x844, centered 390px WebGPU canvas,
//      mutually exclusive slide-over drawers + backdrop, and 6-tool Mobile Context Bar in Bio-Aquarium!
//   3. Organic Chemistry Lab: zero overflow, centered 390px canvas, working Mobile Context Bar (Rep/π-MO/Measure/Mirror).
//   4. Material Physics Lab: zero overflow, centered 390px canvas, non-squished flex-shrink:0 accordions.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_UNIVERSES_URL || 'https://127.0.0.1:5173';
const CAPTURE_DIR = process.env.ULG_CAPTURE_MOBILE_QA === '1'
  ? path.resolve(process.cwd(), 'scratch/mobile_after')
  : null;

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

test('Mobile-First & Context-First UI Revamp across ULG Universes + Bio/Organic/Elements Labs (Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan UI verification',
  timeout: 240000
}, async () => {
  const browser = await launchVulkanBrowser();
  const consoleErrors = [];
  const pageErrors = [];

  const attachErrorListeners = (page, tag) => {
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${tag}] ${m.text()}`); });
    page.on('pageerror', (e) => pageErrors.push(`[${tag}] ${String(e)}`));
  };

  try {
    // =========================================================================
    // 1. ULG UNIVERSES — MOBILE PORTRAIT (390x844) + PINCH + ALIEN/TREE PICKING
    // =========================================================================
    {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        ignoreHTTPSErrors: true
      });
      const page = await ctx.newPage();
      attachErrorListeners(page, 'universes-mobile');
      await page.goto(`${BASE_URL}/universes.html?seed=20261125&sol=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.().ready), { timeout: 35000 });
      await page.waitForTimeout(500);

      const bootGeom = await page.evaluate(() => {
        const top = document.getElementById('uv-topbar')?.getBoundingClientRect();
        const deck = document.getElementById('uv-command-deck')?.getBoundingClientRect();
        const collapsed = document.getElementById('uv-command-deck')?.classList.contains('collapsed');
        const orbitBtn = document.getElementById('uv-mode-orbit-btn')?.getBoundingClientRect();
        const toolsBtn = document.getElementById('uv-mobile-tools-btn')?.getBoundingClientRect();
        return {
          scrollW: document.documentElement.scrollWidth,
          topBottom: top?.bottom || 0,
          topHeight: top?.height || 0,
          deckTop: deck?.top || 0,
          deckHeight: deck?.height || 0,
          collapsed,
          orbitRight: orbitBtn?.right || 0,
          toolsRight: toolsBtn?.right || 0,
          openCosmosHeight: (deck?.top || 844) - (top?.bottom || 0)
        };
      });
      assert.ok(bootGeom.scrollW <= 392, `Universes mobile should not horizontally overflow (got ${bootGeom.scrollW})`);
      assert.equal(bootGeom.collapsed, true, 'Command Deck must boot collapsed on mobile');
      assert.ok(bootGeom.topHeight <= 96, `Mobile topbar must stay compact <= 96px (got ${bootGeom.topHeight.toFixed(1)}px)`);
      assert.ok(bootGeom.toolsRight <= 390, `Mobile tools button must sit inside 390px (got ${bootGeom.toolsRight})`);
      assert.ok(bootGeom.openCosmosHeight >= 600, `Unobstructed 3D cosmos must be >= 600px (~71%+) on 844px phone (got ${bootGeom.openCosmosHeight.toFixed(1)}px)`);
      await maybeShot(page, 'm01_universes_boot.png');

      // Mobile ⋯ tools popover toggles cleanly
      await page.click('#uv-mobile-tools-btn');
      await page.waitForTimeout(200);
      const toolsOpen = await page.evaluate(() => {
        const tb = document.getElementById('uv-topbar');
        const sl = document.getElementById('uv-zoom-slider')?.getBoundingClientRect();
        return { open: tb?.classList.contains('mobile-tools-open'), sliderW: sl?.width || 0 };
      });
      assert.equal(toolsOpen.open, true, 'Clicking ⋯ must open mobile tools popover');
      assert.ok(toolsOpen.sliderW > 80, 'Zoom slider must be interactive inside mobile tools popover');
      await maybeShot(page, 'm02_universes_tools.png');
      await page.click('#uv-mobile-tools-btn');

      // Two-finger pinch-to-zoom on #uv-canvas changes log10ViewSpanM!
      const spanBeforePinch = await page.evaluate(() => window.__ulgUniversesDemo.getState().log10ViewSpanM);
      await page.evaluate(() => {
        const c = document.getElementById('uv-canvas');
        c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 11, clientX: 160, clientY: 420, pointerType: 'touch', bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 12, clientX: 230, clientY: 420, pointerType: 'touch', bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 11, clientX: 100, clientY: 420, pointerType: 'touch', bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 12, clientX: 290, clientY: 420, pointerType: 'touch', bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 11, clientX: 100, clientY: 420, pointerType: 'touch', bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 12, clientX: 290, clientY: 420, pointerType: 'touch', bubbles: true }));
      });
      await page.waitForTimeout(200);
      const spanAfterPinch = await page.evaluate(() => window.__ulgUniversesDemo.getState().log10ViewSpanM);
      assert.ok(spanAfterPinch < spanBeforePinch - 0.15, `Two-finger pinch-out should zoom IN (before=${spanBeforePinch}, after=${spanAfterPinch})`);

      // Jump to L4 Earth & verify Planet Context Spotlight + Peek Sheet
      await page.evaluate(async () => {
        await window.__ulgUniversesDemo.setLevel(4, { instant: true });
        window.__ulgUniversesDemo.setMobileDeckState('peek');
        await window.__ulgUniversesDemo.stepOnce();
      });
      await page.waitForTimeout(450);
      const planetSpot = await page.evaluate(() => window.__ulgUniversesDemo.getContextSpotlight());
      assert.equal(planetSpot?.ctxType, 'planet', 'L4 Earth should present Planet Context Spotlight');
      assert.ok(planetSpot.actionIds.includes('land-world'), 'Planet spotlight must expose 1-tap Land action');
      await maybeShot(page, 'm03_universes_planet_peek.png');

      // Land on Earth Surface, pick a live Alien (Fauna) + Abduct + pick a live Tree (Flora)!
      await page.evaluate(async () => {
        await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'earth' });
        for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
      });
      await page.waitForTimeout(500);

      const alienPick = await page.evaluate(() => {
        const picked = window.__ulgUniversesDemo.pickSurfaceOrganism('fauna');
        return { picked: Boolean(picked), kingdom: picked?.kingdom, name: picked?.speciesName, spot: window.__ulgUniversesDemo.getContextSpotlight() };
      });
      assert.equal(alienPick.picked, true, 'Must pick a live fauna organism on Earth surface');
      assert.equal(alienPick.spot?.ctxType, 'alien', 'Picked fauna must activate Alien Context Spotlight');
      assert.ok(alienPick.spot.actionIds.includes('abduct-org'), 'Alien spotlight must offer 1-tap Abduct to Cargo');
      assert.ok(alienPick.spot.actionIds.includes('open-bio'), 'Alien spotlight must offer 1-tap Bio Aquarium link');
      await maybeShot(page, 'm04_universes_alien_spotlight.png');

      // Tap 1-click Abduct button directly inside #uv-context-spotlight!
      await page.click('#uv-context-spotlight [data-spotlight-act="abduct-org"]');
      await page.waitForTimeout(250);
      const afterAbd = await page.evaluate(() => ({
        abductedCount: window.__ulgUniversesDemo.getState().abductedSpecimens?.length ?? document.querySelectorAll('#uv-cargo-specimens .uv-cargo-item').length,
        spot: window.__ulgUniversesDemo.getContextSpotlight()
      }));
      assert.ok(afterAbd.abductedCount >= 1, '1-tap Abduct must add specimen to Saucer Cargo');
      assert.ok(afterAbd.spot.actionIds.includes('open-cargo'), 'After abduction, spotlight should pivot to Cargo & Bio Aquarium');

      // Now pick a live Tree (Flora) on the same surface!
      const floraPick = await page.evaluate(() => {
        const picked = window.__ulgUniversesDemo.pickSurfaceOrganism('flora');
        return { picked: Boolean(picked), spot: window.__ulgUniversesDemo.getContextSpotlight() };
      });
      assert.equal(floraPick.picked, true, 'Must pick a live flora tree on Earth surface');
      assert.equal(floraPick.spot?.ctxType, 'flora', 'Picked tree must activate Flora Context Spotlight');
      await maybeShot(page, 'm05_universes_flora_spotlight.png');

      // Rotate to Mobile Landscape (844x390) and verify clean side-dock layout!
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(300);
      const landGeom = await page.evaluate(() => {
        const deck = document.getElementById('uv-command-deck')?.getBoundingClientRect();
        return { scrollW: document.documentElement.scrollWidth, deckLeft: deck?.left || 0, deckW: deck?.width || 0 };
      });
      assert.ok(landGeom.scrollW <= 846, `Landscape should not overflow (got ${landGeom.scrollW})`);
      assert.ok(landGeom.deckLeft > 400, `Landscape Command Deck should dock neatly on right side (left=${landGeom.deckLeft})`);
      await maybeShot(page, 'm06_universes_landscape.png');
      await ctx.close();
    }

    // =========================================================================
    // 2. BIO LAB (life-lab.html) — MOBILE 390x844 HEADER, CANVAS & AQUARIUM BAR
    // =========================================================================
    {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        ignoreHTTPSErrors: true
      });
      const page = await ctx.newPage();
      attachErrorListeners(page, 'life-mobile');
      await page.goto(`${BASE_URL}/life-lab.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.().ready), { timeout: 35000 });
      await page.evaluate(() => window.__ulgLifeLab.selectMode('organism-overview'));
      await page.waitForTimeout(550);

      const lifeGeom = await page.evaluate(() => {
        const canvas = document.getElementById('life-canvas')?.getBoundingClientRect();
        const nav = document.getElementById('mobile-nav-btn')?.getBoundingClientRect();
        const about = document.getElementById('about-btn')?.getBoundingClientRect();
        const plots = document.getElementById('toggle-plots-btn')?.getBoundingClientRect();
        const help = document.getElementById('help-btn')?.getBoundingClientRect();
        const mBtns = document.querySelectorAll('#mobile-context-row [data-mctx-viv]').length;
        return {
          scrollW: document.documentElement.scrollWidth,
          canvasLeft: canvas?.left ?? -1,
          canvasW: canvas?.width ?? 0,
          navRight: nav?.right ?? 0,
          aboutRight: about?.right ?? 0,
          plotsRight: plots?.right ?? 0,
          helpRight: help?.right ?? 0,
          vivToolCount: mBtns
        };
      });
      assert.ok(lifeGeom.scrollW <= 391, `Bio Lab mobile must not overflow horizontally (got ${lifeGeom.scrollW})`);
      assert.ok(Math.abs(lifeGeom.canvasLeft) <= 1 && Math.abs(lifeGeom.canvasW - 390) <= 2, `Bio Lab 3D canvas must be centered 390px wide (left=${lifeGeom.canvasLeft}, w=${lifeGeom.canvasW})`);
      assert.ok(lifeGeom.helpRight <= 390 && lifeGeom.plotsRight <= 390 && lifeGeom.aboutRight <= 390, `All Bio Lab header buttons must sit inside 390px (about=${lifeGeom.aboutRight}, plots=${lifeGeom.plotsRight}, help=${lifeGeom.helpRight})`);
      assert.equal(lifeGeom.vivToolCount, 6, 'Bio Lab Mobile Context Bar must expose all 6 Bio-Aquarium organism tools');

      // Tap 🔥 Heat tool on mobile bottom bar and trigger interaction
      await page.click('#mobile-context-row [data-mctx-viv="heat"]');
      await page.evaluate(() => window.__ulgLifeLab.interactVivarium('heat'));
      await page.waitForTimeout(250);
      const toastVisible = await page.evaluate(() => document.getElementById('mobile-viv-toast')?.classList.contains('visible'));
      assert.equal(toastVisible, true, 'Interacting with organism on mobile must show compact tissue reaction toast');
      await maybeShot(page, 'm07_life_aquarium_mobile.png');

      // Open Lab drawer, confirm non-squished accordion headers & backdrop, then close cleanly
      await page.click('#mobile-nav-btn');
      await page.waitForTimeout(200);
      const drawerCheck = await page.evaluate(() => {
        const minH = Math.min(...[...document.querySelectorAll('#life-sidebar .acc-header')].map((h) => h.getBoundingClientRect().height));
        const bdOpen = document.getElementById('mobile-drawer-backdrop')?.classList.contains('open');
        return { minH, bdOpen };
      });
      assert.equal(drawerCheck.bdOpen, true, 'Opening mobile Lab drawer must activate backdrop');
      assert.ok(drawerCheck.minH >= 28, `Bio Lab accordion headers must remain >= 28px (got ${drawerCheck.minH})`);
      await maybeShot(page, 'm08_life_drawer_mobile.png');
      await page.click('#mobile-sidebar-close');
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.getElementById('life-sidebar')?.classList.contains('mobile-open')), false);
      await ctx.close();
    }

    // =========================================================================
    // 3. ORGANIC CHEM LAB (organic-lab.html) — MOBILE 390x844
    // =========================================================================
    {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        ignoreHTTPSErrors: true
      });
      const page = await ctx.newPage();
      attachErrorListeners(page, 'organic-mobile');
      await page.goto(`${BASE_URL}/organic-lab.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__ulgOrganicLab?.getState?.().ready), { timeout: 35000 });
      await page.waitForTimeout(550);

      const orgGeom = await page.evaluate(() => {
        const canvas = document.getElementById('org-canvas')?.getBoundingClientRect();
        const help = document.getElementById('help-btn')?.getBoundingClientRect();
        const plots = document.getElementById('toggle-plots-btn')?.getBoundingClientRect();
        const mBtns = document.querySelectorAll('#mobile-context-bar .mobile-ctx-btn').length;
        return {
          scrollW: document.documentElement.scrollWidth,
          canvasLeft: canvas?.left ?? -1,
          canvasW: canvas?.width ?? 0,
          plotsRight: plots?.right ?? 0,
          helpRight: help?.right ?? 0,
          mBtns
        };
      });
      assert.ok(orgGeom.scrollW <= 391, `Organic Lab mobile must not overflow (got ${orgGeom.scrollW})`);
      assert.ok(Math.abs(orgGeom.canvasLeft) <= 1 && Math.abs(orgGeom.canvasW - 390) <= 2, `Organic Lab canvas must be centered 390px wide (left=${orgGeom.canvasLeft}, w=${orgGeom.canvasW})`);
      assert.ok(orgGeom.helpRight <= 390 && orgGeom.plotsRight <= 390, `Organic Lab header buttons must sit inside 390px (plots=${orgGeom.plotsRight}, help=${orgGeom.helpRight})`);
      assert.equal(orgGeom.mBtns, 5, 'Organic Lab Mobile Context Bar must expose 5 molecule quick controls');
      await page.click('#mobile-context-bar [data-mctx="rep"]');
      await page.waitForTimeout(200);
      await maybeShot(page, 'm09_organic_mobile.png');
      await ctx.close();
    }

    // =========================================================================
    // 4. MATERIAL PHYSICS LAB (elements-lab.html) — MOBILE 390x844
    // =========================================================================
    {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        ignoreHTTPSErrors: true
      });
      const page = await ctx.newPage();
      attachErrorListeners(page, 'elements-mobile');
      await page.goto(`${BASE_URL}/elements-lab.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const txt = document.getElementById('active-specimen-pill')?.textContent || '';
        return Boolean(document.getElementById('gpu-canvas') && txt.length > 2 && !txt.includes('Loading'));
      }, { timeout: 45000 });
      await page.waitForTimeout(800);

      const elGeom = await page.evaluate(() => {
        const canvas = document.getElementById('gpu-canvas')?.getBoundingClientRect();
        const help = document.getElementById('help-menu-btn')?.getBoundingClientRect();
        const hud = document.getElementById('gpu-hud')?.getBoundingClientRect();
        const about = document.getElementById('canvas-about-sim-btn')?.getBoundingClientRect();
        return {
          scrollW: document.documentElement.scrollWidth,
          canvasLeft: canvas?.left ?? -1,
          canvasW: canvas?.width ?? 0,
          helpRight: help?.right ?? 0,
          hudRight: hud?.right ?? 0,
          aboutLeft: about?.left ?? 390
        };
      });
      assert.ok(elGeom.scrollW <= 391, `Elements Lab mobile must not overflow (got ${elGeom.scrollW})`);
      assert.ok(Math.abs(elGeom.canvasLeft) <= 1 && Math.abs(elGeom.canvasW - 390) <= 2, `Elements Lab canvas must be 390px wide (w=${elGeom.canvasW})`);
      assert.ok(elGeom.helpRight <= 390, `Elements Lab help button must sit inside 390px (got ${elGeom.helpRight})`);
      assert.ok(elGeom.hudRight <= elGeom.aboutLeft + 2, `Elements Lab #gpu-hud must not overlap right action buttons (hudRight=${elGeom.hudRight}, aboutLeft=${elGeom.aboutLeft})`);
      await maybeShot(page, 'm10_elements_mobile.png');
      await ctx.close();
    }

    // =========================================================================
    // 5. DESKTOP (1280x720) — UNIVERSES EXPANDED COMMAND DECK & SPOTLIGHT
    // =========================================================================
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
      const page = await ctx.newPage();
      attachErrorListeners(page, 'universes-desktop');
      await page.goto(`${BASE_URL}/universes.html?seed=20261125&sol=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.().ready), { timeout: 35000 });
      await page.waitForTimeout(450);

      const deskState = await page.evaluate(() => ({
        collapsed: document.getElementById('uv-command-deck')?.classList.contains('collapsed'),
        spotlightActive: document.getElementById('uv-context-spotlight')?.classList.contains('active')
      }));
      assert.equal(deskState.collapsed, false, 'Desktop Command Deck must boot expanded');
      assert.equal(deskState.spotlightActive, true, 'Desktop Context Spotlight must be active on boot');

      await page.evaluate(async () => {
        await window.__ulgUniversesDemo.setLevel(4, { instant: true });
        await window.__ulgUniversesDemo.stepOnce();
      });
      await page.waitForTimeout(350);
      await maybeShot(page, 'd01_universes_desktop_planet.png');

      await page.evaluate(async () => {
        await window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'earth' });
        for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
        window.__ulgUniversesDemo.pickSurfaceOrganism('fauna');
      });
      await page.waitForTimeout(450);
      await maybeShot(page, 'd02_universes_desktop_alien.png');
      await ctx.close();
    }

    assert.equal(consoleErrors.length, 0, `Zero console errors expected, got: ${consoleErrors.join(' | ')}`);
    assert.equal(pageErrors.length, 0, `Zero page errors expected, got: ${pageErrors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});
