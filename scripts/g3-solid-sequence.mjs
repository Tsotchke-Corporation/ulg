// G3 desktop evidence: the rigid-body visual sequence (rest, fall, contact,
// settle) in the real app, headed. At sim-time checkpoints it pauses, saves a
// screenshot and reads the rigid frame (diagnostic readback), then resumes.
//   node scripts/g3-solid-sequence.mjs <encodedBodies> [extraQuery]
// Output: G3SEQ_OUT_DIR (receipt.json + PNGs). Run memory-capped.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const bodies = process.argv[2];
const extra = process.argv[3] || '&environmentMode=air&sdt=0.001';
const checkpoints = (process.env.G3SEQ_CHECKPOINTS || '0.05,0.4,0.7,0.85,1.0,1.4,2.0').split(',').map(Number);
const outDir = process.env.G3SEQ_OUT_DIR || join(homedir(), '.cache/icc/repos/ulg/g3-solid-sequence');
// G3SEQ_URL replaces the whole page query (e.g. another preset's sequence).
const url = process.env.G3SEQ_URL
  ? new URL(process.env.G3SEQ_URL, 'https://127.0.0.1:5173/').href
  : new URL(`pages.html?scenario=water-cycle&residentAuto=1&bodies=${bodies}${extra}`, 'https://127.0.0.1:5173/').href;
const receipt = { schema: 'peercompute.ulg.g3-solid-sequence.v1', started: new Date().toISOString(), url, samples: [], errors: [] };
const simTime = fps => { const m = /sim t ([\d.]+)s/.exec(fps || ''); return m ? Number(m[1]) : null; };
let browser;
try {
  await mkdir(outDir, { recursive: true });
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: process.env.ULG_HEADED !== '1',
    args: [...(process.env.ULG_HEADED === '1' ? ['--ozone-platform=wayland'] : []), '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const workers = [];
  page.on('worker', worker => workers.push(worker));
  page.on('pageerror', error => receipt.errors.push(String(error).slice(0, 300)));
  const row = () => page.evaluate(() => ({ fps: document.querySelector('#sph-fps')?.textContent ?? '',
    play: document.querySelector('#sph-play')?.textContent?.trim() ?? '',
    rebuild: document.querySelector('#sph-phase-overlay')?.__sphPhaseRebuildWorker?.status ?? null }));
  const readRigid = async () => {
    for (const worker of workers) {
      const value = await Promise.race([worker.evaluate(() => globalThis.__ulgSolidRigidLane?.readFrames?.() ?? null)
        .catch(() => null), new Promise(resolve => setTimeout(() => resolve(null), 15000))]);
      if (value) return value;
    }
    return null;
  };
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  let started = false;
  for (const target of checkpoints) {
    for (let i = 0; i < Number(process.env.G3SEQ_MAX_WAIT_S || 600); i++) {
      await page.waitForTimeout(1000);
      const r = await row();
      // Progress every 30 s; a page that never starts (a transient after
      // source edits) is reloaded once it has had 120 s.
      if (i % 30 === 29) console.log(JSON.stringify({ waiting: target, i, simTimeS: simTime(r.fps), play: r.play, rebuild: r.rebuild }));
      if (!started && i === 120 && r.rebuild !== 'complete') {
        console.log(JSON.stringify({ reload: true, rebuild: r.rebuild }));
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
        i = 0;
      }
      if (r.play === 'Play' && (!started || i > 0)) { await page.locator('#sph-play').click({ timeout: 5000 }).catch(() => {}); started = true; }
      if (simTime(r.fps) >= target) break;
    }
    if ((await row()).play === 'Pause') await page.locator('#sph-play').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const t = simTime((await row()).fps);
    const rigid = await readRigid();
    const f = rigid?.frames ?? [];
    const sample = { target, simTimeS: t, laneSteps: rigid?.steps ?? null,
      com: f.slice(0, 3), mass: f[3], q: f.slice(4, 8), momentum: f.slice(8, 11), angularMomentum: f.slice(12, 15),
      inertia: f.slice(16, 19), speed: f[3] ? Math.hypot(f[8], f[9], f[10]) / f[3] : null,
      alive: rigid?.alive ?? null, aliveMass: rigid?.aliveMass ?? null, memberCount: rigid?.memberCount ?? null,
      thermal: rigid?.thermal ?? null, releaseEnabled: rigid?.releaseEnabled ?? null,
      screenshot: `${outDir}/t${String(target).replace('.', '_')}.png` };
    await page.screenshot({ path: sample.screenshot });
    receipt.samples.push(sample);
    console.log(JSON.stringify({ target, simTimeS: t, laneSteps: sample.laneSteps, comY: sample.com[1], speed: sample.speed,
      alive: sample.alive, memberCount: sample.memberCount, thermal: sample.thermal, releaseEnabled: sample.releaseEnabled }));
  }
} catch (error) {
  receipt.failure = error?.stack || String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  receipt.finished = new Date().toISOString();
  await writeFile(`${outDir}/receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ out: `${outDir}/receipt.json`, failure: receipt.failure?.slice(0, 300), errors: receipt.errors.slice(0, 3) }));
}
