// A1 A/B exactness check for direct vs indirect field-consumer launches: run
// the live route to a lane step at a batch boundary, pause, and fingerprint the
// rigid lane (exact float bits) and the lane's counters.
//   node scripts/a1-ab-check.mjs <mode: direct|indirect> [scenario] [extraQuery]
// A1_TARGET_STEPS (default 320), A1_BASE_URL.
import { chromium } from '@playwright/test';
const mode = process.argv[2] || 'direct';
const scenario = process.argv[3] || 'iron-ice-quench';
const extra = process.argv[4] || '';
const targetSteps = Number(process.env.A1_TARGET_STEPS || 320);
const url = new URL(`pages.html?scenario=${scenario}&residentAuto=1${extra}`, process.env.A1_BASE_URL || 'https://127.0.0.1:5173/').href;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: process.env.ULG_HEADED !== '1',
  args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } })).newPage();
  const workers = [];
  const fingerprintStep = Number(process.env.A1_FINGERPRINT_STEP || 300);
  page.on('worker', (w) => { workers.push(w);
    w.evaluate((step) => { globalThis.__ulgFingerprintStep = step; }, fingerprintStep).catch(() => {});
    if (mode === 'indirect') w.evaluate(() => { globalThis.__ulgForceIndirectFieldConsumers = true; }).catch(() => {}); });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const lane = () => document.querySelector('#sph-phase-overlay')?.__mlsMpmResidentSteps?.workerOwnedResidentLane?.laneCompletedStepTotal ?? 0;
  for (let i = 0; i < 150; i++) {
    await page.waitForTimeout(1000);
    const row = await page.evaluate(() => ({ play: document.querySelector('#sph-play')?.textContent,
      rebuild: document.querySelector('#sph-phase-overlay')?.__sphPhaseRebuildWorker?.status }));
    if (row.rebuild === 'complete' && row.play === 'Play') await page.locator('#sph-play').click({ timeout: 5000 }).catch(() => {});
    if ((await page.evaluate(lane)) > 0) break;
  }
  // Wall time over a fixed simulated interval (steps A1_TIME_FROM..target):
  // the same scene phase in both modes, unlike a fixed wall-clock window.
  const timeFrom = Number(process.env.A1_TIME_FROM || 64);
  let fromAt = null;
  let steps = await page.evaluate(lane);
  while (steps < targetSteps) {
    await page.waitForTimeout(50);
    steps = await page.evaluate(lane);
    if (fromAt == null && steps >= timeFrom) fromAt = { at: Date.now(), steps };
  }
  const interval = fromAt ? { fromSteps: fromAt.steps, toSteps: steps, wallMs: Date.now() - fromAt.at,
    stepsPerS: +(1000 * (steps - fromAt.steps) / (Date.now() - fromAt.at)).toFixed(2) } : null;
  await page.locator('#sph-play').click({ timeout: 5000 }); // pause
  let last = -1;
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); const s = await page.evaluate(lane); if (s === last) break; last = s; }
  const forced = [];
  let rigid = null;
  let laneFingerprint = null;
  for (const w of workers) {
    if (laneFingerprint) break;
    laneFingerprint = await Promise.race([w.evaluate(() => globalThis.__ulgLaneFingerprint?.read?.() ?? null)
      .catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), 15000))]);
  }
  for (const w of workers) {
    try { forced.push(await w.evaluate(() => globalThis.__ulgForceIndirectFieldConsumers === true)); } catch {}
    if (!rigid) {
      rigid = await Promise.race([w.evaluate(() => globalThis.__ulgSolidRigidLane?.readFrames?.() ?? null)
        .catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), 15000))]);
      if (rigid) rigid.fluid = await Promise.race([w.evaluate(() => globalThis.__ulgSolidRigidLane?.readFluidHash?.() ?? null)
        .catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), 15000))]);
      if (rigid) rigid.fingerprint = await Promise.race([w.evaluate(() => globalThis.__ulgSolidRigidLane?.readFingerprint?.() ?? null)
        .catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), 15000))]);
    }
  }
  // Exact fingerprint: every rigid frame float (f32 bits) plus counters.
  const frames = Array.from(rigid?.frames ?? []);
  const f32bits = (x) => { const b = new Float32Array([x]); return new Uint32Array(b.buffer)[0].toString(16); };
  let hash = 0x811c9dc5;
  for (const x of frames) { const word = parseInt(f32bits(x), 16); for (let k = 0; k < 4; k++) { hash ^= (word >>> (8 * k)) & 0xff; hash = Math.imul(hash, 0x01000193) >>> 0; } }
  console.log(JSON.stringify({ mode, laneSteps: last, forcedWorkers: forced.filter(Boolean).length, rigidSteps: rigid?.steps ?? null,
    alive: rigid?.alive ?? null, aliveMass: rigid?.aliveMass ?? null, frameCount: frames.length,
    com: frames.slice(0, 3), momentum: frames.slice(8, 11), frameHash: hash.toString(16), fluid: rigid?.fluid ?? null, fingerprint: rigid?.fingerprint ?? null, laneFingerprint, interval }));
} finally { await browser.close(); }
