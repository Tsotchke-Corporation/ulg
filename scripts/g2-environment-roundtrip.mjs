// G2 Phase 6 evidence: the Environment UI round trip for ledger nuclei.
//   1. Load water-cycle on the energy-ledger route in humid air with no nuclei.
//   2. In the Atmosphere panel, set "Dry nuclei (per cm³)", then Validate & Apply.
//   3. The location hash must carry the value, and the rebuilt run must step
//      the ledger parcel stage (parcels exist only when nuclei were seeded).
//   4. Reload: the panel must show the value and the parcel stage must run again.
//   5. Set the field back to 0 and apply: the parcel stage must stop
//      (same air, zero-nuclei comparison).
// Screenshots and a JSON receipt go to G2RT_OUT_DIR.
//
//   node scripts/g2-environment-roundtrip.mjs [nucleiPerCm3]
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const nuclei = process.argv[2] || '100';
const outDir = process.env.G2RT_OUT_DIR || join(homedir(), '.cache/icc/repos/ulg/g2-environment-roundtrip');
const base = process.env.G2RT_BASE_URL || 'https://127.0.0.1:5173/';
const url = new URL('pages.html?scenario=water-cycle&residentAuto=1&exactEnergyLedger=1&environmentMode=air'
  + '&environmentHumidityPercent=80&environmentNucleiPerCm3=0&sdt=0.001', base).href;
const receipt = { schema: 'peercompute.ulg.g2-environment-roundtrip.v1', started: new Date().toISOString(), url, nuclei,
  stages: [], errors: [] };

const appRow = () => {
  const overlay = document.querySelector('#sph-phase-overlay');
  return { play: document.querySelector('#sph-play')?.textContent?.trim() ?? null,
    rebuild: overlay?.__sphPhaseRebuildWorker?.status ?? null,
    status: document.querySelector('#sph-status')?.textContent?.trim()?.slice(0, 200) ?? null,
    fps: document.querySelector('#sph-fps')?.textContent ?? '', hasOverlay: Boolean(overlay) };
};
const simTime = fps => { const m = /sim t ([\d.]+)s/.exec(fps); return m ? Number(m[1]) : null; };

let browser;
try {
  await mkdir(outDir, { recursive: true });
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
    args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  let workers = [];
  page.on('worker', worker => workers.push(worker));
  page.on('pageerror', error => receipt.errors.push(String(error).slice(0, 300)));
  const parcelStage = async () => {
    for (const worker of workers) {
      const value = await Promise.race([worker.evaluate(() => globalThis.__ulgLedgerParcelStage ?? null).catch(() => null),
        new Promise(resolve => setTimeout(() => resolve(null), 20_000))]);
      if (value) return value;
    }
    return null;
  };
  // Wait for a rebuild, press Play if needed, and let it step past simTarget.
  // After an in-page Apply the old scene is still stepping, so first require
  // evidence of the rebuild: its status leaves 'complete' or sim time drops.
  const runUntil = async (label, simTarget, { afterApplyFromSimS = null } = {}) => {
    let rebuilt = afterApplyFromSimS == null;
    for (let i = 0; i < 150; i++) {
      await page.waitForTimeout(2000);
      const row = await page.evaluate(appRow);
      const t = simTime(row.fps);
      if (!rebuilt && (row.rebuild !== 'complete' || t < afterApplyFromSimS)) {
        rebuilt = true;
        // Steps the old scene took before the rebuild must not count.
        for (const worker of workers) await worker.evaluate(() => { globalThis.__ulgLedgerParcelStage = null; }).catch(() => {});
      }
      if (!rebuilt) continue;
      if (row.rebuild === 'complete' && row.play === 'Play' && i > 2) {
        await page.locator('#sph-play').click({ timeout: 5000 }).catch(() => {});
      }
      if (row.rebuild === 'complete' && t >= simTarget) break;
    }
    const row = await page.evaluate(appRow);
    const stage = { label, hash: await page.evaluate(() => window.location.hash), simTimeS: simTime(row.fps),
      panelNuclei: await page.evaluate(() => document.querySelector('#sph-environment input[aria-label="Dry nuclei (per cm³)"]')?.value ?? null),
      parcelStage: await parcelStage() };
    await page.screenshot({ path: `${outDir}/${label}.png` });
    receipt.stages.push(stage);
    console.log(JSON.stringify(stage));
    return stage;
  };
  const setNucleiAndApply = async value => {
    await page.evaluate(() => { document.querySelector('#sph-environment').open = true; });
    const input = page.getByLabel('Dry nuclei (per cm³)');
    await input.fill(String(value));
    await input.dispatchEvent('change');
    // The render worker may survive Apply: zero its counters in place.
    for (const worker of workers) await worker.evaluate(() => { globalThis.__ulgLedgerParcelStage = null; }).catch(() => {});
    await page.getByRole('button', { name: 'Validate & Apply' }).click({ timeout: 5000 });
  };

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await runUntil('1-zero-nuclei', 0.05);
  const beforeApply = simTime((await page.evaluate(appRow)).fps);
  await setNucleiAndApply(nuclei);
  const applied = await runUntil('2-ui-applied', 0.05, { afterApplyFromSimS: beforeApply });
  workers = [];
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  const reloaded = await runUntil('3-reloaded', 0.05);
  const beforeClear = simTime((await page.evaluate(appRow)).fps);
  await setNucleiAndApply(0);
  const cleared = await runUntil('4-ui-cleared', 0.05, { afterApplyFromSimS: beforeClear });
  const hashValue = stage => new URLSearchParams(stage.hash.replace(/^#/, '')).get('environmentNucleiPerCm3');
  receipt.verdict = {
    zeroStartNoParcels: !receipt.stages[0].parcelStage?.ran,
    appliedHashCarriesValue: hashValue(applied) === nuclei,
    appliedParcelsStep: applied.parcelStage?.ran > 0,
    reloadPanelShowsValue: reloaded.panelNuclei === nuclei,
    reloadParcelsStep: reloaded.parcelStage?.ran > 0,
    clearedHashZero: hashValue(cleared) === '0',
    clearedNoParcels: !cleared.parcelStage?.ran
  };
  receipt.passed = Object.values(receipt.verdict).every(Boolean);
  if (!receipt.passed) process.exitCode = 1;
} catch (error) {
  receipt.failure = error?.stack || String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  receipt.finished = new Date().toISOString();
  await writeFile(`${outDir}/receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ out: `${outDir}/receipt.json`, verdict: receipt.verdict, passed: receipt.passed,
    failure: receipt.failure?.slice(0, 300), errors: receipt.errors.slice(0, 3) }));
}
