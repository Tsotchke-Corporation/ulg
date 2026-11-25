#!/usr/bin/env node
// Headless Vulkan sequential visual & physical pixel-motion verification across
// Gate 1-2 (`elements-lab.html`), Gate 5D (`universes.html`), and Gate 4
// ULG Studio (`pages.html` across all 5 active presets).
//
// Uses ULG's decoded pixel-delta engine (`scripts/physicalPixelPngEvidence.mjs`)
// to verify real advancing visual frames + zero page/WebGPU errors.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { comparePhysicalPixelPngFrames } from './physicalPixelPngEvidence.mjs';

const BASE_URL = process.env.ULG_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_CHROME || '/usr/bin/google-chrome';
const OUT_DIR = process.env.ULG_VISUAL_OUT_DIR
  || '/home/cos/.gemini/antigravity-cli/brain/f4aafecf-4b28-49bb-8539-d1a054f050c4/scratch/gate-visuals';

const STUDIO_PRESETS = [
  'water-cycle',
  'iron-ice-quench',
  'sodium-water',
  'cesium-fluorine',
  'water-realtime'
];

async function capturePng(page, filePath) {
  const bytes = await page.screenshot({ type: 'png' });
  await writeFile(filePath, bytes);
  return bytes;
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
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

  const report = {
    schema: 'ulg.gate-visual-motion-verify.v1',
    baseUrl: BASE_URL,
    outDir: OUT_DIR,
    elementsLab: null,
    supergalactic: null,
    studioPresets: {}
  };

  try {
    // ------------------------------------------------------------------
    // 1. Gate 1 & Gate 2: elements-lab.html (6 tabs + live WebGPU MD motion)
    // ------------------------------------------------------------------
    {
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
      await page.goto(`${BASE_URL}elements-lab.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(
        () => window.__ulgElementsLabState?.mode === 'element' && window.__ulgElementsLabState?.Z === 26,
        null,
        { timeout: 60_000 }
      );
      await page.waitForTimeout(500);
      await capturePng(page, path.join(OUT_DIR, 'elements-tab1-nuclear.png'));

      await page.click('[data-tab="atomic"]');
      await page.waitForTimeout(500);
      await capturePng(page, path.join(OUT_DIR, 'elements-tab2-atomic.png'));

      await page.click('[data-tab="crystal"]');
      await page.waitForTimeout(500);
      await capturePng(page, path.join(OUT_DIR, 'elements-tab3-crystal.png'));

      await page.click('[data-tab="md"]');
      await page.waitForTimeout(400);
      const md0 = await capturePng(page, path.join(OUT_DIR, 'elements-tab4-md-t0.png'));
      await page.waitForTimeout(1600);
      const md1 = await capturePng(page, path.join(OUT_DIR, 'elements-tab4-md-t1.png'));
      const mdDelta = comparePhysicalPixelPngFrames(md0, md1);

      await page.click('#solve-compound-btn');
      await page.waitForFunction(
        () => window.__ulgElementsLabState?.mode === 'compound' && window.__ulgElementsLabState?.formula === 'H2O',
        null,
        { timeout: 60_000 }
      );
      await page.click('[data-tab="compound"]');
      await page.waitForTimeout(500);
      await capturePng(page, path.join(OUT_DIR, 'elements-tab5-compound.png'));

      await page.click('[data-tab="polytope"]');
      await page.waitForTimeout(500);
      await capturePng(page, path.join(OUT_DIR, 'elements-tab6-polytope.png'));

      const state = await page.evaluate(() => ({
        mode: window.__ulgElementsLabState?.mode,
        formula: window.__ulgElementsLabState?.formula,
        polytopes: window.__ulgElementsLabState?.atlasPolytopeCount
      }));
      report.elementsLab = {
        ...state,
        pageErrors,
        mdMotion: {
          visibleContentAdvanced: mdDelta.visibleContentAdvanced,
          changedPixelCount: mdDelta.changedPixelCount,
          changedPixelRatio: Number((mdDelta.changedPixelRatio || 0).toFixed(5)),
          maxChannelDelta: mdDelta.maxChannelDelta
        }
      };
      await ctx.close();
    }

    // ------------------------------------------------------------------
    // 2. Gate 5D: universes.html (live FLRW 3D-FFT TreePM cosmic web)
    // ------------------------------------------------------------------
    {
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
      await page.goto(`${BASE_URL}universes.html?level=0`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForFunction(
        () => (window.__ulgUniversesDemo?.getState?.()?.cosmicWebSteps ?? 0) >= 2,
        null,
        { timeout: 45_000 }
      );
      const t0State = await page.evaluate(() => {
        const s = window.__ulgUniversesDemo?.getState?.();
        return { step: s?.cosmicWebSteps, aScale: s?.scaleFactorA, sigma: s?.sigmaDensity };
      });
      const sg0Url = await page.evaluate(() => window.__ulgUniversesDemo.capturePng());
      const sg0 = Buffer.from(sg0Url.split(',')[1], 'base64');
      await writeFile(path.join(OUT_DIR, 'universes-l0-t0.png'), sg0);
      await page.waitForFunction(
        (prevStep) => (window.__ulgUniversesDemo?.getState?.()?.cosmicWebSteps ?? 0) >= prevStep + 14,
        t0State.step,
        { timeout: 45_000 }
      );
      const t1State = await page.evaluate(() => {
        const s = window.__ulgUniversesDemo?.getState?.();
        return { step: s?.cosmicWebSteps, aScale: s?.scaleFactorA, sigma: s?.sigmaDensity };
      });
      const sg1Url = await page.evaluate(() => window.__ulgUniversesDemo.capturePng());
      const sg1 = Buffer.from(sg1Url.split(',')[1], 'base64');
      await writeFile(path.join(OUT_DIR, 'universes-l0-t1.png'), sg1);
      const sgDelta = comparePhysicalPixelPngFrames(sg0, sg1);
      report.supergalactic = {
        t0: t0State,
        t1: t1State,
        pageErrors,
        motion: {
          visibleContentAdvanced: sgDelta.visibleContentAdvanced,
          changedPixelCount: sgDelta.changedPixelCount,
          changedPixelRatio: Number((sgDelta.changedPixelRatio || 0).toFixed(5)),
          maxChannelDelta: sgDelta.maxChannelDelta
        }
      };
      await ctx.close();
    }

    // ------------------------------------------------------------------
    // 3. Gate 4: ULG Studio across ALL 5 active presets
    // ------------------------------------------------------------------
    for (const preset of STUDIO_PRESETS) {
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
      await page.goto(`${BASE_URL}pages.html?preset=${preset}&autoplay=1`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000
      });
      // Wait for Studio rebuild complete (exact selector from step0-baseline-probe.mjs)
      await page.waitForFunction(() => {
        const play = document.querySelector('#sph-play') || document.querySelector('#ulg-play-btn');
        const txt = (play?.textContent || '').trim();
        return Boolean(play && !play.disabled && /^(Play|Pause)$/i.test(txt));
      }, null, { timeout: 90_000 });
      await page.evaluate(() => {
        const btn = document.querySelector('#ulg-play-btn') || document.querySelector('#sph-play');
        if (btn && !btn.disabled && /^\s*play\s*$/i.test(btn.textContent || '')) btn.click();
      });
      // Wait for real simulation steps to advance before capturing t0 -> t1
      await page.waitForFunction(() => {
        const text = document.body?.innerText || '';
        const m = text.match(/sim t\s+([0-9.]+)s/);
        return Boolean(m && Number(m[1]) > 0);
      }, null, { timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const p0 = await capturePng(page, path.join(OUT_DIR, `studio-${preset}-t0.png`));
      const readout0 = await page.evaluate(() =>
        (document.body?.innerText?.match(/presented[^\n]+/)?.[0] ?? '').slice(0, 220)
      );
      await page.waitForTimeout(4500);
      const p1 = await capturePng(page, path.join(OUT_DIR, `studio-${preset}-t1.png`));
      const readout1 = await page.evaluate(() =>
        (document.body?.innerText?.match(/presented[^\n]+/)?.[0] ?? '').slice(0, 220)
      );
      const delta = comparePhysicalPixelPngFrames(p0, p1);
      report.studioPresets[preset] = {
        pageErrors,
        readout0,
        readout1,
        visibleContentAdvanced: delta.visibleContentAdvanced,
        changedPixelCount: delta.changedPixelCount,
        changedPixelRatio: Number((delta.changedPixelRatio || 0).toFixed(5)),
        maxChannelDelta: delta.maxChannelDelta
      };
      await ctx.close();
    }

    await writeFile(path.join(OUT_DIR, 'visual-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exitCode = 1;
});
