#!/usr/bin/env node
// Track 3 Headless Vulkan Visual Audit Screenshot Capture (`scripts/track3-visual-audit-capture.mjs`).
// Captures BOTH full UI page PNGs AND exact raw WebGPU canvas PNGs (`capturePng`/`toDataURL`)
// across all 6 apps, Dark + Paper Light themes, Desktop 1440x900 + Mobile 390x844,
// ExoWebTUI Full PeerCompute Shader Stack, Scale-Invariant Stellar & Small-Body Framing,
// and 1:1 Abducted Organism Surface vs Bio Lab Vivarium!

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = (process.env.ULG_DEV_URL || 'https://127.0.0.1:5173').replace(/\/$/, '');
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const OUT_DIR = process.env.ULG_TRACK3_SHOT_DIR
  || '/home/cos/.gemini/antigravity-cli/brain/f4aafecf-4b28-49bb-8539-d1a054f050c4/scratch/track3-visual-audit';

await mkdir(OUT_DIR, { recursive: true });

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

const report = { outDir: OUT_DIR, shots: [], errors: [] };

async function capturePage(page, name, meta = {}) {
  const filePath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  report.shots.push({ name, filePath, ...meta });
}

async function captureCanvas(page, name, selectorOrFn, meta = {}) {
  const dataUrl = typeof selectorOrFn === 'function'
    ? await page.evaluate(selectorOrFn)
    : await page.evaluate((sel) => {
        const c = document.querySelector(sel);
        return c && typeof c.toDataURL === 'function' ? c.toDataURL('image/png') : '';
      }, selectorOrFn);
  const buf = Buffer.from(String(dataUrl || '').split(',')[1] || '', 'base64');
  const filePath = path.join(OUT_DIR, `${name}.png`);
  if (buf.length > 64) await writeFile(filePath, buf);
  report.shots.push({ name, filePath, bytes: buf.length, ...meta });
}

try {
  // 1. Desktop ExoWebTUI Full PeerCompute 5-Pass Shader Stack + Paper Light Theme
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => report.errors.push(`[desktop-fx] ${e}`));
    await page.goto(`${BASE_URL}/desktop.html?open=universes,console&shaderPreset=full-stack`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgExoWebTui?.getState?.()?.shaderStack?.enabled?.length === 5), null, { timeout: 30_000 });
    await page.waitForTimeout(1600);
    const st = await page.evaluate(() => {
      window.__ulgExoWebTui.degauss();
      return window.__ulgExoWebTui.getState();
    });
    await page.waitForTimeout(160);
    await capturePage(page, '01-desktop-shader-stack', { shaders: st.shaderStack?.enabled, thumpSeq: st.shaderStack?.thumpSeq });

    await page.evaluate(() => {
      window.__ulgExoWebTui.applyShaderPreset('clean');
      window.__ulgExoWebTui.setTheme('paper');
      window.__ulgExoWebTui.openLab('elements');
      window.__ulgExoWebTui.openLab('console');
      window.__ulgExoWebTui.tileAll();
    });
    await page.waitForTimeout(2000);
    await capturePage(page, '02-desktop-paper-light', { theme: 'paper' });
    await ctx.close();
  }

  // 2. Universes: Whole-Star Framing (L3 Sun), Small-Body Framing (Halley 5.5 km), & Abducted Fauna Surface -> Bio Lab!
  let bioHandoffUrl = null;
  let abductedMeta = null;
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => report.errors.push(`[universes] ${e}`));
    await page.goto(`${BASE_URL}/universes.html?level=3&sol=1&quality=med`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setLevel(3, { instant: true });
      for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const stStar = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    await captureCanvas(page, '03-star-canvas', () => window.__ulgUniversesDemo.capturePng(), { level: stStar.level, span: stStar.log10ViewSpanM });

    // Small-body framing: 1P/Halley (5.5 km radius) at L4
    await page.evaluate(async () => {
      await window.__ulgUniversesDemo.setLevel(4, { instant: true });
      await window.__ulgUniversesDemo.focusSolarBody('halley');
      for (let i = 0; i < 6; i += 1) await window.__ulgUniversesDemo.stepOnce();
    });
    const stHalley = await page.evaluate(() => window.__ulgUniversesDemo.getState());
    await captureCanvas(page, '04-halley-canvas', () => window.__ulgUniversesDemo.capturePng(), { body: stHalley.focusedSolarBody, span: stHalley.log10ViewSpanM });

    // Land on Earth, wait for GPU SDF organism bakes, capture surface HUD + surface canvas, abduct fauna & grab Bio Lab URL!
    const abdInfo = await page.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      await api.enterSurfaceView({ bodyIndex: 'earth' });
      for (let i = 0; i < 14; i += 1) await api.stepOnce();
      await new Promise((r) => setTimeout(r, 900));
      for (let i = 0; i < 6; i += 1) await api.stepOnce();
      const orgs = api.getSurfaceOrganisms?.() || [];
      const fauna = orgs.find((o) => o.kingdom === 'fauna' && !o.abducted) || orgs[0] || null;
      return {
        orgCount: orgs.length,
        faunaId: fauna?.id || null,
        faunaName: fauna?.speciesRecord?.speciesName || null,
        faunaKingdom: fauna?.kingdom || null
      };
    });
    await capturePage(page, '05-abducted-organism-surface', abdInfo);
    await captureCanvas(page, '05-surface-canvas', () => window.__ulgUniversesDemo.capturePng(), abdInfo);
    const abdDone = await page.evaluate(async (fid) => {
      const api = window.__ulgUniversesDemo;
      const abd = fid ? api.abductSurfaceOrganism?.(fid) : null;
      for (let i = 0; i < 4; i += 1) await api.stepOnce();
      const link = document.querySelector('#uv-cargo-specimens a[href*="life-lab.html"]')?.getAttribute('href')
        || document.querySelector('#uv-surface-xeno-btn')?.getAttribute('href')
        || null;
      return { abductedName: abd?.speciesName || null, abductedKingdom: abd?.kingdom || null, link };
    }, abdInfo.faunaId);
    abductedMeta = { ...abdInfo, ...abdDone };
    bioHandoffUrl = abdDone.link;
    await ctx.close();
  }

  // 3. Bio Lab Vivarium with EXACT abducted organism URL + Paper Light Theme
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => report.errors.push(`[biolab] ${e}`));
    const targetUrl = bioHandoffUrl
      ? `${BASE_URL}/${bioHandoffUrl.replace(/^\.\//, '')}`
      : `${BASE_URL}/life-lab.html`;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.()?.ready), null, { timeout: 45_000 });
    await page.waitForTimeout(1400);
    const bioSt = await page.evaluate(() => {
      const s = window.__ulgLifeLab.getState();
      return {
        speciesName: s.activeSpecimen?.speciesName,
        kingdom: s.activeSpecimen?.kingdom,
        genomeKingdom: s.activeSpecimen?.developmentalGenome?.kingdom,
        genomeMedium: s.activeSpecimen?.developmentalGenome?.medium,
        gpuErrors: s.gpuErrorCount
      };
    });
    await captureCanvas(page, '06-biolab-abducted-canvas', '#life-canvas', { ...bioSt, sourceAbducted: abductedMeta?.abductedName });

    await page.goto(`${BASE_URL}/life-lab.html?theme=paper`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.()?.ready), null, { timeout: 45_000 });
    await page.waitForTimeout(1200);
    await capturePage(page, '09-biolab-paper-light', { theme: 'paper' });
    await ctx.close();
  }

  // 4. Organic Lab Paper Light Theme (re-verify crisp contrast + PBR canvas)
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => report.errors.push(`[organic] ${e}`));
    await page.goto(`${BASE_URL}/organic-lab.html?theme=paper`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgOrganicLab?.getState?.()?.ready), null, { timeout: 45_000 });
    await page.waitForTimeout(1200);
    await capturePage(page, '08-organic-paper-light', { theme: 'paper' });
    await captureCanvas(page, '08-organic-canvas', '#org-canvas', { theme: 'paper' });
    await ctx.close();
  }

  // 5. Elements Lab Mobile 390x844 (checking #gpu-hud zero overlap!)
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => report.errors.push(`[elements-mobile] ${e}`));
    await page.goto(`${BASE_URL}/elements-lab.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgElementsLabState || window.__ulgElementsLabApi), null, { timeout: 45_000 });
    await page.waitForTimeout(1400);
    const overlapCheck = await page.evaluate(() => {
      const hud = document.getElementById('gpu-hud')?.getBoundingClientRect();
      const reset = document.getElementById('canvas-reset-view-btn')?.getBoundingClientRect();
      const overlap = Boolean(hud && reset && !(hud.right <= reset.left || hud.left >= reset.right || hud.bottom <= reset.top || hud.top >= reset.bottom));
      return {
        hud: hud ? { top: Math.round(hud.top), right: Math.round(hud.right), bottom: Math.round(hud.bottom) } : null,
        reset: reset ? { top: Math.round(reset.top), left: Math.round(reset.left), bottom: Math.round(reset.bottom) } : null,
        overlap
      };
    });
    await capturePage(page, '07-elements-mobile-390', overlapCheck);
    await ctx.close();
  }

  // 6. Continuum Studio (water-realtime)
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => report.errors.push(`[studio] ${e}`));
    await page.goto(`${BASE_URL}/index.html?studio=1&preset=water-realtime`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(3200);
    await capturePage(page, '10-studio-water-realtime', { preset: 'water-realtime' });
    await ctx.close();
  }

  console.log('[TRACK3_VISUAL_AUDIT_REPORT]', JSON.stringify(report, null, 2));
  await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
