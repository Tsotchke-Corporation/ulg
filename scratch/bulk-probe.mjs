import { chromium } from '@playwright/test';
const extra = process.env.ULG_PROBE_EXTRA || '';
const scenario = process.env.ULG_PROBE_SCENARIO || 'bulk-water';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e?.message || e).slice(0, 300)));
page.on('console', (m) => { { const t = m.text(); if (m.type() === 'error' || t.includes('ulg-fused-diag') || t.includes('ulg-stage') || t.includes('ulg-fv-diag')) errors.push(t.slice(0, 300)); } });
try {
  await page.goto(`https://localhost:5173/?scenario=${scenario}${extra}&probeEpoch=${Date.now()}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => { const b = document.querySelector('#sph-play'); return b && !b.disabled; }, null, { timeout: Number(process.env.ULG_PROBE_STARTUP_MS || 300000) });
} catch (e) {
  let hud = null;
  try {
    hud = await page.evaluate(() => ({
      status: document.querySelector('#sph-status')?.textContent?.slice(0, 200) ?? null,
      hud: document.querySelector('#sph-hud')?.textContent?.slice(0, 200) ?? null,
      body: document.body?.innerText?.slice(0, 400) ?? null
    }));
  } catch {}
  console.log(JSON.stringify({ phase: 'startup-failed', error: String(e).slice(0, 200), hud, errors: errors.slice(0, 8) }));
  await browser.close();
  process.exit(0);
}
const t0 = Date.now();
let prev = null; const commits = [];
while (Date.now() - t0 < Number(process.env.ULG_PROBE_WINDOW_MS || 90000)) {
  const c = await page.evaluate(() => {
    const lane = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane;
    const steps = document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps;
    return {
      committed: lane?.laneCompletedStepTotal ?? 0,
      n: lane?.perStepSummaries?.lastStep?.particleCount ?? null,
      live: steps?.liveParticleCount ?? null,
      lawReceipt: lane?.lawActivationReceipt ?? null,
    };
  });
  if (c.committed !== prev) { commits.push({ t: Date.now() - t0, ...c }); prev = c.committed; }
  await page.waitForTimeout(400);
}
await browser.close();
console.log(JSON.stringify({ phase: 'ok', commits: commits.slice(-30), errors: errors.slice(0, 8) }));
