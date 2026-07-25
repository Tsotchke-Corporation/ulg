// Find which GPU buffers accumulate across resident steps.
//
// Wraps GPUDevice.createBuffer and GPUBuffer.destroy before any page script
// runs, then steps the resident pipeline in batches and reports live buffer
// count and live bytes grouped by label. A label whose live count climbs with
// every batch is the leak; a label that stays flat is being released properly.
//
//   node scratch/probe-gpu-buffer-leak.mjs [--steps 24] [--batches 12] [--off]
//
// --off flips the Slice 9 transport flags off so the same measurement can be
// taken against the pre-Slice-9 behavior for comparison.

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};
const BATCH_STEPS = flag('--steps', 24);
const BATCH_COUNT = flag('--batches', 12);
const SAMPLE_MS = flag('--sampleMs', 5000);
const FLAGS_OFF = args.includes('--off');
const BASE = process.env.ULG_LEAK_BASE_URL || 'https://127.0.0.1:5174';

const on = FLAGS_OFF ? '0' : '1';
const url = `${BASE}/?scenario=water-cycle&mech=mlsmpm`
  + '&wxmin=300&wxmax=300&wzmin=300&wzmax=300&iceh=0&ironh=1.01'
  + '&dropn=3&basen=5&boxx=5&boxy=5&boxz=5'
  + '&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=1&lawv=1&lawst=0'
  + '&blob=1&drop=h2o&base=h2o&dropt=300&baset=300&wymin=400&wymax=200'
  + '&renderer=native-webgpu&renderOwnership=main-thread-renderer'
  + '&surfaceDraw=native-webgpu-surface-consumer'
  + `&ss=1&schroederLevel=${on}&schroederPortableSummary=1`
  + `&schroederActiveNodeIndex=1&schroederTwoLevel=${on}`
  + `&schroederCrossLevelCoupling=${on}&schroederPhaseVolumeMigration=${on}`
  + `&schroederLawQueue=${on}&schroederLawNeighborCandidates=${on}&residentAuto=1`;

const { chromium } = await import('@playwright/test');
const browser = await chromium.launch({
  executablePath: process.env.ULG_LEAK_CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu',
    '--ignore-gpu-blocklist'
  ]
});

const page = await browser.newPage({ ignoreHTTPSErrors: true });

// Patch before any page script runs, so no allocation escapes the tally.
await page.addInitScript(() => {
  const stats = new Map();
  globalThis.__leakWatch = 'ulg-mls-mpm-separation-bins';
  globalThis.__leakStats = stats;
  globalThis.__leakTotals = { created: 0, destroyed: 0 };
  const bump = (label, key, delta) => {
    let row = stats.get(label);
    if (!row) {
      row = { label, created: 0, destroyed: 0, liveBytes: 0, createdBytes: 0 };
      stats.set(label, row);
    }
    row[key] += delta;
    return row;
  };
  const patch = () => {
    if (!globalThis.GPUDevice?.prototype || globalThis.__leakPatched) return;
    globalThis.__leakPatched = true;
    const createBuffer = GPUDevice.prototype.createBuffer;
    GPUDevice.prototype.createBuffer = function patchedCreateBuffer(desc) {
      const buffer = createBuffer.call(this, desc);
      const label = String(desc?.label || '(unlabeled)');
      const size = Number(desc?.size) || 0;
      const row = bump(label, 'created', 1);
      row.liveBytes += size;
      row.createdBytes += size;
      globalThis.__leakTotals.created += 1;
      // Record where the watched label is allocated so the leaking call site
      // can be named instead of guessed.
      if (globalThis.__leakWatch && label === globalThis.__leakWatch) {
        const stack = String(new Error().stack || '')
          .split('\n').slice(2, 8).join(' | ')
          .replace(/https?:\/\/[^\/]+/g, '');
        const m = globalThis.__leakStacks || (globalThis.__leakStacks = new Map());
        m.set(stack, (m.get(stack) || 0) + 1);
      }
      try {
        Object.defineProperty(buffer, '__leakLabel', {
          value: label, enumerable: false
        });
        Object.defineProperty(buffer, '__leakSize', {
          value: size, enumerable: false
        });
      } catch {}
      return buffer;
    };
    const destroy = GPUBuffer.prototype.destroy;
    GPUBuffer.prototype.destroy = function patchedDestroy() {
      if (!this.__leakDead) {
        try {
          Object.defineProperty(this, '__leakDead', {
            value: true, enumerable: false
          });
        } catch {}
        const label = this.__leakLabel || '(unlabeled)';
        const row = bump(label, 'destroyed', 1);
        row.liveBytes -= Number(this.__leakSize) || 0;
        globalThis.__leakTotals.destroyed += 1;
      }
      return destroy.call(this);
    };
  };
  patch();
  // WebGPU globals may not exist at document-start in every configuration.
  const timer = setInterval(() => {
    patch();
    if (globalThis.__leakPatched) clearInterval(timer);
  }, 10);
});

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 160));
});

console.log(`[leak] flags ${FLAGS_OFF ? 'OFF' : 'ON'}  `
  + `${BATCH_COUNT} batches x ${BATCH_STEPS} steps`);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

// Wait for the scene to expose the resident driver.
await page.waitForFunction(() => {
  const overlay = document.querySelector('#sph-phase-overlay');
  return Boolean(overlay?.__sphScene?.refreshMlsMpmResidentSteps);
}, null, { timeout: 180_000 });

const patched = await page.evaluate(() => Boolean(globalThis.__leakPatched));
if (!patched) {
  console.log('[leak] WARNING: createBuffer was never patched');
}

// The app auto-schedules its own resident steps. Driving refresh directly from
// here needs the full option set the long-horizon probe builds, and calling it
// with a partial set silently no-ops. So just let it run and sample.
const samples = [];
for (let batch = 0; batch < BATCH_COUNT; batch += 1) {
  await new Promise((resolve) => setTimeout(resolve, SAMPLE_MS));
  const sample = await page.evaluate(async ({ batchIndex }) => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const scene = overlay?.__sphScene;
    const error = null;
    const steps = scene?.getMlsMpmResidentSteps?.();
    const rows = [...globalThis.__leakStats.values()]
      .map((r) => ({
        label: r.label,
        live: r.created - r.destroyed,
        liveBytes: r.liveBytes,
        created: r.created
      }))
      .filter((r) => r.live > 0)
      .sort((a, b) => b.liveBytes - a.liveBytes);
    return {
      batchIndex,
      error,
      completedStepCount: steps?.completedStepCount ?? null,
      totals: { ...globalThis.__leakTotals },
      liveTotal: rows.reduce((s, r) => s + r.live, 0),
      liveBytesTotal: rows.reduce((s, r) => s + r.liveBytes, 0),
      rows: rows.slice(0, 40)
    };
  }, { batchIndex: batch });

  samples.push(sample);
  console.log(`[leak] batch ${String(batch).padStart(2)} `
    + `live=${String(sample.liveTotal).padStart(6)} `
    + `liveMiB=${(sample.liveBytesTotal / 1048576).toFixed(1).padStart(9)} `
    + `created=${sample.totals.created} destroyed=${sample.totals.destroyed} `
    + `steps=${sample.completedStepCount}`
    + (sample.error ? `  ERROR ${sample.error}` : ''));
  if (sample.error) break;
}

// Growth per label between the first and last sample.
const first = samples[Math.min(1, samples.length - 1)];
const last = samples[samples.length - 1];
const firstBy = new Map(first.rows.map((r) => [r.label, r]));
const growth = last.rows.map((r) => {
  const before = firstBy.get(r.label) || { live: 0, liveBytes: 0 };
  return {
    label: r.label,
    liveFrom: before.live,
    liveTo: r.live,
    deltaLive: r.live - before.live,
    deltaMiB: (r.liveBytes - before.liveBytes) / 1048576
  };
}).filter((r) => r.deltaLive > 0 || r.deltaMiB > 0.5)
  .sort((a, b) => b.deltaMiB - a.deltaMiB);

console.log(`\n[leak] growth from batch ${first.batchIndex} to ${last.batchIndex}:`);
if (!growth.length) console.log('  (no label grew)');
for (const row of growth.slice(0, 25)) {
  console.log(`  ${row.deltaMiB.toFixed(1).padStart(9)} MiB  `
    + `+${String(row.deltaLive).padStart(5)} live  `
    + `${row.liveFrom} -> ${row.liveTo}  ${row.label}`);
}
const stacks = await page.evaluate(() => [...(globalThis.__leakStacks || new Map())]
  .sort((a, b) => b[1] - a[1]).slice(0, 6));
console.log(`\n[leak] allocation sites for ${'ulg-mls-mpm-separation-bins'}:`);
for (const [stack, count] of stacks) {
  console.log(`  x${String(count).padStart(6)}  ${stack.slice(0, 400)}`);
}

if (errors.length) {
  console.log(`\n[leak] first console errors:`);
  for (const e of errors.slice(0, 5)) console.log('  ', e);
}

await browser.close();
