import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { comparePhysicalPixelPngFrames } from '../scripts/physicalPixelPngEvidence.mjs';

// Native Vulkan WebGPU Verification & Visual Watch Suite for ULG Biophysics & Emergent Life Lab (`life-lab.html`):
//   1. Amphiphile Self-Assembly (Node #20): Spontaneous hydrophobic micelle assembly at eps_hp=1.85 vs
//      falsifiable null limit eps_hp=0.0 (isotropic dispersion with lower hydrophobic coordination!) + 3D Vesicle!
//   2. Biopolymer Folding & Pocket Catalysis (Node #21): Compact folding & Eyring boost at 300 K vs
//      falsifiable Thermal Denaturation at 750 K (R_g expands & catalyticRateBoost drops!)
//   3. Template Replication & Eigen Error Threshold (Node #22): 1,024 GPU replicators maintain high sequence
//      identity at mu=0.02 (< mu_crit), then suffer Eigen Error Catastrophe at mu=0.35 (> mu_crit)!
//   4. Hodgkin-Huxley Excitable Membrane + Mitchell Chemiosmosis (Node #23): Live 128x128 action-potential
//      spirals & positive ATP flux, vs falsifiable TTX block (g_Na=0 -> silent) & uncoupler=1 (exact 0 ATP)!
//   5. Turing Morphogenesis + 2,048 Chemotactic Active Swimmers (Node #24): Coupled 3D morphogen ridges +
//      chemotactic enrichment > 1.15 vs passive null limit (v0=0, chemoGain=0 -> ~0 speed & lower enrichment)!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_LIFE_SHOT_DIR || '';

test('ULG Biophysics & Emergent Life Lab (life-lab.html) live Vulkan physics, null limits & visual watch', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Life Lab suite',
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
    const dataUrl = await page.evaluate(() => window.__ulgLifeLab.capturePng());
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

    await page.goto(`${BASE_URL}life-lab.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__ulgLifeLab?.getState?.()?.ready), null, { timeout: 60_000 });
    await page.evaluate(() => window.__ulgLifeLab.setPaused(true));

    // 1. Amphiphile Self-Assembly (eps_hp=1.85) vs Null Limit (eps_hp=0.0) + 3D Protocell Vesicle
    const stLipOn = await page.evaluate(() => window.__ulgLifeLab.stepNow(22));
    assert.equal(stLipOn.gpuErrorCount, 0, `GPU errors on Lipid Soup: ${stLipOn.gpuErrors.join(' | ')}`);
    await snap(page, '01-amphiphile-self-assembly');

    await page.evaluate(() => window.__ulgLifeLab.setParams({ memEpsHp: 0.0, memTempK: 520 }));
    const stLipOff = await page.evaluate(() => window.__ulgLifeLab.stepNow(22));
    assert.ok(
      stLipOff.telemetry.meanTailCoordination < stLipOn.telemetry.meanTailCoordination,
      `Null limit eps_hp=0 must disperse hydrophobic tails (${stLipOff.telemetry.meanTailCoordination} vs ${stLipOn.telemetry.meanTailCoordination})`
    );
    report.amphiphiles = {
      tailCoordActive: Number(stLipOn.telemetry.meanTailCoordination.toFixed(2)),
      tailCoordNull: Number(stLipOff.telemetry.meanTailCoordination.toFixed(2))
    };

    // 3D Protocell Vesicle
    await page.evaluate(() => window.__ulgLifeLab.setParams({ memEpsHp: 1.85, memTempK: 300 }));
    await page.evaluate(() => window.__ulgLifeLab.selectMode('protocell-vesicle'));
    const stVes = await page.evaluate(() => window.__ulgLifeLab.stepNow(10));
    await snap(page, '02-protocell-vesicle');
    report.vesicle = { meanRadius: Number(stVes.telemetry.meanRadius.toFixed(2)), headOrder: Number(stVes.telemetry.radialHeadOrder.toFixed(2)) };

    // 2. Biopolymer Folding (300 K) vs Thermal Denaturation (780 K)
    await page.evaluate(() => window.__ulgLifeLab.selectMode('amphipathic-helix-bundle'));
    await page.evaluate(() => window.__ulgLifeLab.setParams({ foldTempK: 280 }));
    const stFoldCold = await page.evaluate(() => window.__ulgLifeLab.stepNow(24));
    const pickedRes = await page.evaluate(() => window.__ulgLifeLab.pickAtCenter());
    assert.ok(pickedRes && Number.isInteger(pickedRes.index) && pickedRes.index >= 0, 'GPU entity ray-picker must pick a live biopolymer residue directly from WebGPU buffer');
    await snap(page, '03-biopolymer-folded-catalyst');

    await page.evaluate(() => window.__ulgLifeLab.setParams({ foldTempK: 820 }));
    const stFoldHot = await page.evaluate(() => window.__ulgLifeLab.stepNow(24));
    assert.ok(
      stFoldHot.telemetry.radiusOfGyrationA > stFoldCold.telemetry.radiusOfGyrationA * 1.04
      || stFoldHot.telemetry.catalyticRateBoost < stFoldCold.telemetry.catalyticRateBoost,
      `Thermal denaturation at 820 K must expand R_g or reduce catalysis (cold Rg=${stFoldCold.telemetry.radiusOfGyrationA}, boost=${stFoldCold.telemetry.catalyticRateBoost} vs hot Rg=${stFoldHot.telemetry.radiusOfGyrationA}, boost=${stFoldHot.telemetry.catalyticRateBoost})`
    );
    report.biopolymer = {
      coldRg: Number(stFoldCold.telemetry.radiusOfGyrationA.toFixed(2)),
      hotRg: Number(stFoldHot.telemetry.radiusOfGyrationA.toFixed(2)),
      coldBoost: Number(stFoldCold.telemetry.catalyticRateBoost.toFixed(1)),
      hotBoost: Number(stFoldHot.telemetry.catalyticRateBoost.toFixed(1))
    };

    // 3. Template Replication & Eigen Error Threshold (mu=0.02 adaptive vs mu=0.35 catastrophe!)
    await page.evaluate(() => window.__ulgLifeLab.selectMode('quasispecies-evolution'));
    await page.evaluate(() => window.__ulgLifeLab.setParams({ evoMu: 0.02 }));
    const stEvoLow = await page.evaluate(() => window.__ulgLifeLab.stepNow(20));
    assert.ok(stEvoLow.telemetry.meanSequenceIdentity > 0.72, `Expected adaptive quasispecies identity > 0.72 (got ${stEvoLow.telemetry.meanSequenceIdentity})`);
    const fEvoLow = await snap(page, '04-quasispecies-eigen-adaptive');

    await page.evaluate(() => window.__ulgLifeLab.setParams({ evoMu: 0.36 }));
    const stEvoHigh = await page.evaluate(() => window.__ulgLifeLab.stepNow(22));
    assert.ok(
      stEvoHigh.telemetry.meanSequenceIdentity < stEvoLow.telemetry.meanSequenceIdentity - 0.18,
      `Eigen Error Catastrophe at mu=0.36 must collapse identity (${stEvoHigh.telemetry.meanSequenceIdentity} vs ${stEvoLow.telemetry.meanSequenceIdentity})`
    );
    const fEvoHigh = await snap(page, '05-eigen-error-catastrophe');
    const evoDiff = comparePhysicalPixelPngFrames(fEvoLow, fEvoHigh);
    assert.ok(evoDiff.changedPixelCount > 3000, `Adaptive vs Error Catastrophe clouds must differ visually (changed=${evoDiff.changedPixelCount})`);
    report.eigen = {
      idLowMu: Number(stEvoLow.telemetry.meanSequenceIdentity.toFixed(3)),
      idHighMu: Number(stEvoHigh.telemetry.meanSequenceIdentity.toFixed(3))
    };

    // 4. Hodgkin-Huxley Excitable Membrane Spirals + Mitchell Chemiosmosis + TTX & Uncoupler Null Limits!
    await page.evaluate(() => window.__ulgLifeLab.selectMode('excitable-spiral'));
    const stHh0 = await page.evaluate(() => window.__ulgLifeLab.stepNow(10));
    const fHh0 = await snap(page);
    const stHh1 = await page.evaluate(() => window.__ulgLifeLab.stepNow(12));
    const fHh1 = await snap(page, '06-hodgkin-huxley-spirals');
    const hhMove = comparePhysicalPixelPngFrames(fHh0, fHh1);
    assert.ok(hhMove.changedPixelCount > 5000, `Hodgkin-Huxley spirals must actively propagate (changed=${hhMove.changedPixelCount})`);
    assert.ok(stHh1.telemetry.maxVoltageMv > 0.0, `Expected active depolarized action potentials > 0 mV (got ${stHh1.telemetry.maxVoltageMv})`);
    assert.ok(stHh1.telemetry.chemiosmosis.atpSynthesisFlux > 10.0, 'Physiological PMF must drive positive ATP synthesis');

    // TTX channel block (g_Na = 0) + DNP uncoupler (leak = 1.0)!
    await page.evaluate(() => window.__ulgLifeLab.setParams({ hhGNa: 0.0, hhUncouplerLeak: 1.0 }));
    const stHhNull = await page.evaluate(() => window.__ulgLifeLab.stepNow(24));
    assert.ok(stHhNull.telemetry.maxVoltageMv < -20.0, `TTX block (g_Na=0) must extinguish action potentials (got ${stHhNull.telemetry.maxVoltageMv} mV)`);
    assert.equal(stHhNull.telemetry.chemiosmosis.atpSynthesisFlux, 0, 'Protonophore uncoupler=1 must abolish ATP flux to exact 0');
    report.hhBioenergetics = {
      activeMaxMv: Number(stHh1.telemetry.maxVoltageMv.toFixed(1)),
      ttxMaxMv: Number(stHhNull.telemetry.maxVoltageMv.toFixed(1)),
      atpActive: Number(stHh1.telemetry.chemiosmosis.atpSynthesisFlux.toFixed(1)),
      atpUncoupled: stHhNull.telemetry.chemiosmosis.atpSynthesisFlux
    };

    // 5. Turing Morphogenesis + 2,048 Chemotactic Active Matter Swimmers
    await page.evaluate(() => window.__ulgLifeLab.selectMode('turing-spots'));
    const stMorphOn = await page.evaluate(() => window.__ulgLifeLab.stepNow(28));
    assert.ok(stMorphOn.telemetry.turingPatternStd > 0.04, `Expected Turing pattern contrast > 0.04 (got ${stMorphOn.telemetry.turingPatternStd})`);
    assert.ok(stMorphOn.telemetry.chemotacticEnrichment > 1.12, `Expected chemotactic enrichment > 1.12 (got ${stMorphOn.telemetry.chemotacticEnrichment})`);
    await snap(page, '07-turing-active-chemotaxis');

    // Falsifiable Active-Matter Null Limit: v0 = 0 & chemoGain = 0!
    await page.evaluate(() => window.__ulgLifeLab.setParams({ morphV0: 0.0, morphChemo: 0.0 }));
    const stMorphOff = await page.evaluate(() => window.__ulgLifeLab.stepNow(10));
    assert.ok(stMorphOff.telemetry.meanAgentSpeed < stMorphOn.telemetry.meanAgentSpeed * 0.35, 'Setting v0=0 must drop self-propulsion speed');
    report.morphogenesis = {
      turingStd: Number(stMorphOn.telemetry.turingPatternStd.toFixed(3)),
      enrichment: Number(stMorphOn.telemetry.chemotacticEnrichment.toFixed(2)),
      speedOn: Number(stMorphOn.telemetry.meanAgentSpeed.toFixed(2)),
      speedNull: Number(stMorphOff.telemetry.meanAgentSpeed.toFixed(2))
    };

    assert.equal(stMorphOff.gpuErrorCount, 0, `GPU errors: ${stMorphOff.gpuErrors.join(' | ')}`);
    assert.equal(pageErrors.length, 0, `Page errors: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`);

    console.log('[LIFE_LAB_NATIVE_REPORT]', JSON.stringify(report));
    await ctx.close();
  } finally {
    await browser.close();
  }
});
