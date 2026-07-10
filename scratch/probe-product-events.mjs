// Stage-1 accounting probe (task #6 item 3): where does unplaced gas product
// mass actually live? Counts per-material particles (state+thermo readback)
// and scans resident state for product-event row counts / unplaced ledger.
// Usage: node scratch/probe-product-events.mjs [drop] [base] [port]
import { chromium } from '/home/cos/projects/ulg/node_modules/playwright/index.mjs';
const drop = process.argv[2] || 'Na';
const base = process.argv[3] || 'h2o';
const port = process.argv[4] || '5186';
const url = `http://127.0.0.1:${port}/?drop=${drop}&base=${base}&dropt=300&baset=293&iceh=0&ironh=1.01&dropn=2&basen=4&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentFuseSequence=1&visualCapture=1&surfaceDraw=native-webgpu-surface-consumer`;
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--ignore-certificate-errors'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto(url);
await page.waitForTimeout(2000);
if (await page.locator('#sph-phase-overlay').count() === 0) await page.locator('#run-sph-phase').click().catch(() => {});
await page.waitForSelector('#sph-phase-overlay', { timeout: 240000 });
for (let sample = 0; sample < 8; sample += 1) {
  await page.waitForTimeout(6000);
  const out = await page.evaluate(async () => {
    const o = document.querySelector('#sph-phase-overlay');
    const steps = o.__mlsMpmResidentSteps || {};
    const fs = steps.finalStep || {};
    const up = (fs.nextParticleUploads || {}).sphParticleUpload || null;
    const device = o.__sphScene?.scene?.userData?.sphResidentSurfaceDrawRenderBridge?.device;
    const read = async (buf) => {
      const staging = device.createBuffer({ size: buf.size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const e = device.createCommandEncoder();
      e.copyBufferToBuffer(buf, 0, staging, 0, buf.size);
      device.queue.submit([e.finish()]);
      await staging.mapAsync(GPUMapMode.READ);
      const a = new Float32Array(staging.getMappedRange().slice(0));
      staging.unmap(); staging.destroy();
      return a;
    };
    if (!up?.stateBuffer || !up.thermoBuffer || !device) return { err: 'no-buffers' };
    const state = await read(up.stateBuffer);
    const thermo = await read(up.thermoBuffer);
    const n = Math.floor(state.length / 8);
    const byId = new Map();
    for (let p = 0; p < n; p += 1) {
      const m = state[p * 8 + 3];
      if (m <= 0) continue;
      const id = Math.round(thermo[p * 12]);
      const b = byId.get(id) || { n: 0, mass: 0, tMax: 0, speedMax: 0 };
      b.n += 1; b.mass += m;
      b.tMax = Math.max(b.tMax, thermo[p * 12 + 2]);
      b.speedMax = Math.max(b.speedMax, Math.hypot(state[p * 8 + 4], state[p * 8 + 5], state[p * 8 + 6]));
      byId.set(id, b);
    }
    // product event handle: scan resident state for row counts + retained buffer
    const rpm = (fs.nextParticleUploads || {}).residentProductMass
      || fs.residentProductMass || steps.residentProductMass || null;
    let eventStats = null;
    if (rpm?.productEventBuffer && device) {
      const rows = await read(rpm.productEventBuffer);
      const stride = (rpm.productEventStrideFloats || 32);
      let live = 0; let unplaced = 0; let placedMass = 0;
      for (let r = 0; r * stride + 19 < rows.length; r += 1) {
        const base = r * stride;
        const status = rows[base + 18]; // row4.z
        const unpl = rows[base + 13];   // row3.y
        if (status === 1 && unpl > 0) { live += 1; unplaced += unpl; }
        placedMass += rows[base + 12] || 0; // row3.x visible
      }
      eventStats = { rowCount: rpm.productEventRowCount ?? Math.floor(rows.length / stride), live, unplacedKg: Number(unplaced.toPrecision(4)) };
    }
    return {
      mats: Array.from(byId.entries()).map(([id, b]) => ({ id, n: b.n, kg: Number(b.mass.toPrecision(4)), tMaxK: Math.round(b.tMax), vMax: Number(b.speedMax.toPrecision(3)) })),
      events: eventStats,
      eventRowCountHandle: rpm?.productEventRowCount ?? null
    };
  });
  console.log(JSON.stringify(out));
}
await browser.close();
