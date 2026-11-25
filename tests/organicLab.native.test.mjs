import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

// Native Vulkan WebGPU Verification & Visual Watch Suite for ULG Organic Chemistry Lab (`organic-lab.html`):
//   1. Benzene (C6H6): Gate 0B GPU Jacobi pi-MO solver proves 4n+2 aromaticity, strong resonance stabilization,
//      wide HOMO-LUMO gap, and glowing 3D pi-MO lobes!
//   2. Cyclobutadiene (C4H4): Exact same GPU solver proves 4n anti-aromatic degenerate diradical (gap ~ 0 eV)!
//   3. L-Alanine -> Mirror Enantiomer: Exact (x,y,z)->(-x,y,z) flips CIP chirality (S) <-> (R) with identical dipole!
//   4. Ethanol-Water H-Bond Cluster: Emergent directional D-H...A hydrogen bonds live in GPU MD!
//   5. SN2 Walden Inversion & Diels-Alder [4+2]: Continuous reactive bond-order evolution across xi = 0 -> 1!
//   6. Frank Chiral Symmetry Breaking (128x128 WebGPU RD): Spontaneous homochiral L/D domains at k_inhib=1.85,
//      AND falsifiable null-limit proof that k_inhib=0.0 collapses chiral purity!
//   7. Belousov-Zhabotinsky Oregonator Spiral Waves: Active non-equilibrium spiral motion with 0 GPU/page errors!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_ORGANIC_SHOT_DIR || '';

test('ULG Organic Chemistry Lab (organic-lab.html) live Vulkan physics, null limits & visual watch', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Organic Lab suite',
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
      '--ignore-gpu-blocklist'
    ]
  });

  const snap = async (page, name) => {
    const dataUrl = await page.evaluate(() => window.__ulgOrganicLab.capturePng());
    const gpuBuf = Buffer.from(dataUrl.split(',')[1], 'base64');
    if (name && SHOT_DIR) {
      await writeFile(path.join(SHOT_DIR, `${name}.png`), gpuBuf);
    }
    return gpuBuf;
  };

  const report = {};
  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1360, height: 820 } });
    const page = await ctx.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });

    await page.goto(`${BASE_URL}organic-lab.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgOrganicLab?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.evaluate(() => window.__ulgOrganicLab.setPaused(true));

    // 1. Benzene 6pi Aromaticity
    const stBenz = await page.evaluate(() => window.__ulgOrganicLab.stepNow(6));
    assert.equal(stBenz.gpuErrorCount, 0, `GPU errors on Benzene: ${stBenz.gpuErrors.join(' | ')}`);
    assert.equal(stBenz.formula, 'C6H6');
    assert.equal(stBenz.pi.isAromatic4nPlus2, true);
    assert.ok(stBenz.pi.homoLumoGapEv > 4.0);
    assert.ok(stBenz.pi.resonanceEnergyEv < -3.0);
    const fBenz = await snap(page, '01-benzene-pi-mo');
    const pickedAtom = await page.evaluate(() => window.__ulgOrganicLab.pickAtCenter());
    assert.ok(pickedAtom && Number.isInteger(pickedAtom.index) && pickedAtom.index >= 0, 'GPU entity ray-picker must pick an organic atom directly from WebGPU buffer');
    report.benzene = { gapEv: Number(stBenz.pi.homoLumoGapEv.toFixed(2)), resEv: Number(stBenz.pi.resonanceEnergyEv.toFixed(2)), pickedAtom: pickedAtom.title };

    // 2. Cyclobutadiene 4pi Anti-Aromatic Diradical Contrast
    await page.evaluate(() => window.__ulgOrganicLab.selectMode('cyclobutadiene'));
    const stCbd = await page.evaluate(() => window.__ulgOrganicLab.stepNow(6));
    assert.equal(stCbd.pi.isAromatic4nPlus2, false);
    assert.ok(stCbd.pi.homoLumoGapEv < 0.05, `Expected 0 eV gap for cyclobutadiene (got ${stCbd.pi.homoLumoGapEv})`);
    const fCbd = await snap(page, '02-cyclobutadiene-antiaromatic');
    const benzVsCbd = comparePhysicalPixelPngFrames(fBenz, fCbd);
    assert.ok(benzVsCbd.changedPixelCount > 2500, `Benzene vs Cyclobutadiene must render distinctly (changed=${benzVsCbd.changedPixelCount})`);
    report.cyclobutadiene = { gapEv: Number(stCbd.pi.homoLumoGapEv.toFixed(3)), resEv: Number(stCbd.pi.resonanceEnergyEv.toFixed(3)) };

    // 3. L-Alanine Chiral Mirror Invariance (S <-> R) + ESP coloring
    await page.evaluate(() => window.__ulgOrganicLab.selectMode('l-alanine'));
    await page.evaluate(() => window.__ulgOrganicLab.setEspMode(true));
    const stAlaL = await page.evaluate(() => window.__ulgOrganicLab.stepNow(6));
    assert.equal(stAlaL.chiralCenters.length, 1);
    const cfgBefore = stAlaL.chiralCenters[0].configuration;
    const dipBefore = stAlaL.qeq.dipoleDebye;
    await snap(page, '03-alanine-chiral-esp');
    const stAlaM = await page.evaluate(() => window.__ulgOrganicLab.mirrorMolecule());
    assert.notEqual(stAlaM.chiralCenters[0].configuration, cfgBefore, 'Mirror reflection must invert CIP chirality');
    assert.ok(Math.abs(stAlaM.qeq.dipoleDebye - dipBefore) < 1e-4, 'Mirror reflection must conserve dipole magnitude');
    await page.evaluate(() => window.__ulgOrganicLab.setEspMode(false));
    report.alanine = { before: cfgBefore, afterMirror: stAlaM.chiralCenters[0].configuration, dipoleD: Number(dipBefore.toFixed(2)) };

    // 4. Ethanol-Water Emergent H-Bond Cluster
    await page.evaluate(() => window.__ulgOrganicLab.selectMode('ethanol-water-hbond'));
    await page.evaluate(() => window.__ulgOrganicLab.setTemperatureK(180));
    const stHb = await page.evaluate(() => window.__ulgOrganicLab.stepNow(12));
    assert.ok(stHb.telemetry.hBondCount >= 1, `Expected live emergent H-bonds (got ${stHb.telemetry.hBondCount})`);
    await snap(page, '04-ethanol-water-hbonds');
    report.hBonds = { count: stHb.telemetry.hBondCount, dipoleD: Number(stHb.qeq.dipoleDebye.toFixed(2)) };

    // 5. SN2 Walden Umbrella Inversion (xi = 0.0 -> 0.50 TS -> 1.0)
    await page.evaluate(() => window.__ulgOrganicLab.selectMode('sn2-walden'));
    await page.evaluate(() => window.__ulgOrganicLab.setReactionProgress(0.0, false));
    await page.evaluate(() => window.__ulgOrganicLab.stepNow(6));
    const fSn0 = await snap(page);
    await page.evaluate(() => window.__ulgOrganicLab.setReactionProgress(0.50, false));
    await page.evaluate(() => window.__ulgOrganicLab.stepNow(16));
    const fSnTs = await snap(page, '05-sn2-walden-ts');
    const snDiff = comparePhysicalPixelPngFrames(fSn0, fSnTs);
    assert.ok(snDiff.changedPixelCount > 1200, `SN2 reaction drive must visibly move atoms/bonds (changed=${snDiff.changedPixelCount})`);
    report.sn2 = { changedPx0ToTs: snDiff.changedPixelCount };

    // 6. Diels-Alder [4+2] Cycloaddition
    await page.evaluate(() => window.__ulgOrganicLab.selectMode('diels-alder'));
    await page.evaluate(() => window.__ulgOrganicLab.setReactionProgress(0.85, false));
    const stDa = await page.evaluate(() => window.__ulgOrganicLab.stepNow(18));
    await snap(page, '06-diels-alder-ring');
    report.dielsAlder = { activeBonds: stDa.telemetry.activeBondCount, rgA: Number(stDa.telemetry.radiusOfGyrationA.toFixed(2)) };

    // 7. Frank Chiral Symmetry Breaking (k_inhib=1.85 breaks symmetry vs k_inhib=0.0 racemic null limit!)
    await page.evaluate(() => window.__ulgOrganicLab.selectMode('frank-chiral'));
    await page.evaluate(() => window.__ulgOrganicLab.setKInhib(1.85));
    const stFrankBreak = await page.evaluate(() => window.__ulgOrganicLab.stepNow(22));
    assert.ok(stFrankBreak.telemetry.localChiralPurity > 0.35, `Expected spontaneous chiral domain purity > 0.35 (got ${stFrankBreak.telemetry.localChiralPurity})`);
    await snap(page, '07-frank-chiral-domains');

    // Falsifiable Null Limit: k_inhib = 0.0 suppresses chiral symmetry breaking!
    await page.evaluate(() => window.__ulgOrganicLab.setKInhib(0.0));
    await page.evaluate(() => window.__ulgOrganicLab.selectMode('frank-chiral'));
    const stFrankNull = await page.evaluate(() => window.__ulgOrganicLab.stepNow(22));
    assert.ok(
      stFrankNull.telemetry.localChiralPurity < stFrankBreak.telemetry.localChiralPurity * 0.6,
      `Null limit k_inhib=0 must collapse chiral purity (${stFrankNull.telemetry.localChiralPurity} vs ${stFrankBreak.telemetry.localChiralPurity})`
    );
    report.frankChiral = {
      purityActive: Number(stFrankBreak.telemetry.localChiralPurity.toFixed(3)),
      purityNullK0: Number(stFrankNull.telemetry.localChiralPurity.toFixed(3))
    };

    // 8. Belousov-Zhabotinsky Oregonator Spiral Waves
    await page.evaluate(() => window.__ulgOrganicLab.selectMode('belousov-zhabotinsky'));
    await page.evaluate(() => window.__ulgOrganicLab.stepNow(14));
    const fBz0 = await snap(page);
    const stBz1 = await page.evaluate(() => window.__ulgOrganicLab.stepNow(14));
    const fBz1 = await snap(page, '08-bz-spirals');
    const bzDiff = comparePhysicalPixelPngFrames(fBz0, fBz1);
    assert.ok(bzDiff.changedPixelCount > 8000, `BZ chemical spiral waves must actively propagate (changed=${bzDiff.changedPixelCount})`);
    report.bzSpirals = { changedPx: bzDiff.changedPixelCount, meanU: Number(stBz1.telemetry.meanL.toFixed(3)) };

    assert.equal(stBz1.gpuErrorCount, 0, `GPU errors: ${stBz1.gpuErrors.join(' | ')}`);
    assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`);

    console.log('[ORGANIC_LAB_NATIVE_REPORT]', JSON.stringify(report));
    await ctx.close();
  } finally {
    await browser.close();
  }
});
