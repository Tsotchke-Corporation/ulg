// Task #11 reaction-violence calibration probe.
// Per sample, buckets every massive particle by materialId:phase and emits
// count, mass, y-extents, temperature mean/max, total internal energy (sum m*u)
// and bulk kinetic energy (sum 0.5*m*|v|^2), plus sim time — enough to answer
// spawn-contact geometry (first sample's extents), reacted-mass-vs-time, and
// energy partition without any CPU-owned hot state (one readback per sample).
// Env: DROP, BASE, DROPT, BASET, DROPN, BASEN, SAMPLES, INTERVAL_MS, PORT.
import { chromium } from '/home/cos/projects/ulg/node_modules/playwright/index.mjs';

const DROP = process.env.DROP ?? 'Na';
const BASE = process.env.BASE ?? 'h2o';
const DROPT = process.env.DROPT ?? '300';
const BASET = process.env.BASET ?? '293';
const DROPN = process.env.DROPN ?? '3';
const BASEN = process.env.BASEN ?? '5';
const SAMPLES = Number(process.env.SAMPLES ?? 12);
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 3000);
const PORT = process.env.PORT ?? '5187';

const PROTO = process.env.PROTO ?? (PORT === '5173' ? 'https' : 'http');
const url = `${PROTO}://127.0.0.1:${PORT}/?drop=${DROP}&base=${BASE}&dropt=${DROPT}&baset=${BASET}`
  + `&iceh=0&ironh=1.01&dropn=${DROPN}&basen=${BASEN}&boxx=4&boxy=4&boxz=4`
  + '&mech=mlsmpm&residentAuto=1&residentFuseSequence=1&visualCapture=1'
  + '&surfaceDraw=native-webgpu-surface-consumer';

const browser = await chromium.launch({
  args: [
    '--enable-unsafe-webgpu',
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--ignore-certificate-errors'
  ]
});
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto(url);
await page.waitForTimeout(2000);
if (await page.locator('#sph-phase-overlay').count() === 0) {
  await page.locator('#run-sph-phase').click().catch(() => {});
}
await page.waitForSelector('#sph-phase-overlay', { timeout: 300000 });

const sample = () => page.evaluate(async () => {
  const o = document.querySelector('#sph-phase-overlay');
  const steps = o?.__mlsMpmResidentSteps || {};
  const fs = steps.finalStep || {};
  const up = (fs.nextParticleUploads || {}).sphParticleUpload || {};
  const device = o?.__sphScene?.scene?.userData?.sphResidentSurfaceDrawRenderBridge?.device;
  if (!up.stateBuffer || !up.thermoBuffer || !device) return null;
  const read = async (buf) => {
    const st = device.createBuffer({ size: buf.size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const e = device.createCommandEncoder();
    e.copyBufferToBuffer(buf, 0, st, 0, buf.size);
    device.queue.submit([e.finish()]);
    await st.mapAsync(GPUMapMode.READ);
    const a = new Float32Array(st.getMappedRange().slice(0));
    st.unmap();
    st.destroy();
    return a;
  };
  const state = await read(up.stateBuffer);
  const thermo = await read(up.thermoBuffer);
  const n = Math.floor(state.length / 8);
  const buckets = new Map();
  for (let p = 0; p < n; p += 1) {
    const m = state[p * 8 + 3];
    if (!(m > 0)) continue;
    const id = Math.round(thermo[p * 12]);
    const phase = Math.round(thermo[p * 12 + 1]);
    const tK = thermo[p * 12 + 2];
    const y = state[p * 8 + 1];
    const u = state[p * 8 + 7];
    const speed2 = state[p * 8 + 4] ** 2 + state[p * 8 + 5] ** 2 + state[p * 8 + 6] ** 2;
    const key = `${id}:ph${phase}`;
    const b = buckets.get(key) || {
      n: 0, mass: 0, yMin: 1e9, yMax: -1e9, tSum: 0, tMax: -1, internalJ: 0, kineticJ: 0
    };
    b.n += 1;
    b.mass += m;
    b.yMin = Math.min(b.yMin, y);
    b.yMax = Math.max(b.yMax, y);
    b.tSum += tK;
    b.tMax = Math.max(b.tMax, tK);
    b.internalJ += m * u;
    b.kineticJ += 0.5 * m * speed2;
    buckets.set(key, b);
  }
  return {
    t: Number((steps.nextSphParticleState?.time ?? 0).toFixed(4)),
    buckets: Array.from(buckets.entries()).map(([key, b]) => ({
      key,
      n: b.n,
      massKg: Number(b.mass.toPrecision(6)),
      yMin: Number(b.yMin.toPrecision(4)),
      yMax: Number(b.yMax.toPrecision(4)),
      tMeanK: Number((b.tSum / b.n).toPrecision(5)),
      tMaxK: Number(b.tMax.toPrecision(5)),
      internalJ: Number(b.internalJ.toPrecision(6)),
      kineticJ: Number(b.kineticJ.toPrecision(6))
    }))
  };
});

// First sample as early as the resident state allows (spawn-geometry answer),
// then the timed series.
for (let tries = 0; tries < 40; tries += 1) {
  const s = await sample();
  if (s) { console.log(JSON.stringify(s)); break; }
  await page.waitForTimeout(500);
}
for (let i = 0; i < SAMPLES; i += 1) {
  await page.waitForTimeout(INTERVAL_MS);
  const s = await sample();
  if (s) console.log(JSON.stringify(s));
}
await browser.close();
