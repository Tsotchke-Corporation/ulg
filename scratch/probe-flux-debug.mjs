// Interface-flux debug: raw product-event rows (material/visible/unplaced/
// status) + every nonzero-mass particle bucketed by material incl. sub-kg.
import { chromium } from '/home/cos/projects/ulg/node_modules/playwright/index.mjs';
const port = process.argv[2] || '5188';
const url = `http://127.0.0.1:${port}/?drop=Na&base=h2o&dropt=300&baset=293&iceh=0&ironh=1.01&dropn=2&basen=4&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentFuseSequence=1&visualCapture=1&surfaceDraw=native-webgpu-surface-consumer`;
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--ignore-certificate-errors'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto(url);
await page.waitForTimeout(2000);
if (await page.locator('#sph-phase-overlay').count() === 0) await page.locator('#run-sph-phase').click().catch(() => {});
await page.waitForSelector('#sph-phase-overlay', { timeout: 240000 });
await page.waitForTimeout(12000);
for (let i = 0; i < 3; i += 1) {
  const out = await page.evaluate(async () => {
    const o = document.querySelector('#sph-phase-overlay');
    const steps = o?.__mlsMpmResidentSteps || {};
    const fs = steps.finalStep || steps;
    const up = fs.sphParticleUpload || {};
    const device = up.device || o.__sphScene?.scene?.userData?.sphResidentSurfaceDrawRenderBridge?.device;
    const read = async (buf, bytes) => {
      const staging = device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const e = device.createCommandEncoder();
      e.copyBufferToBuffer(buf, 0, staging, 0, bytes);
      device.queue.submit([e.finish()]);
      await staging.mapAsync(GPUMapMode.READ);
      const a = new Float32Array(staging.getMappedRange().slice(0));
      staging.unmap(); staging.destroy();
      return a;
    };
    const findEvents = (obj, depth) => {
      if (!obj || typeof obj !== 'object' || depth > 5) return null;
      if (obj.productEventBuffer?.size) return obj.productEventBuffer;
      if (obj.buffer?.size && obj.schema?.includes?.('product-event')) return obj.buffer;
      for (const k of Object.keys(obj)) {
        if (!/reaction|event|product|resident|summary|step/i.test(k)) continue;
        try { const f = findEvents(obj[k], depth + 1); if (f) return f; } catch {}
      }
      return null;
    };
    const eventsBuffer = findEvents(fs, 0) || findEvents(o.__sphResidentRenderState, 0);
    const result = { hasEvents: Boolean(eventsBuffer) };
    if (eventsBuffer) {
      const rows = Math.min(Math.floor(eventsBuffer.size / (8 * 16)), 400);
      const a = await read(eventsBuffer, rows * 8 * 16);
      const live = [];
      let unplacedSum = 0;
      let statusCounts = {};
      for (let r = 0; r < rows; r += 1) {
        const b = r * 32;
        const mat = a[b + 4], visible = a[b + 12], unplaced = a[b + 13], status = a[b + 18];
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        const rowMass = a[b + 3];
        unplacedSum += unplaced;
        if (rowMass > 0 && live.length < 8) live.push({ mat, rowMass: rowMass.toPrecision(3), visible: visible.toPrecision(3), unplaced: unplaced.toPrecision(3), status });
      }
      result.rows = rows; result.unplacedSum = unplacedSum; result.statusCounts = statusCounts; result.sample = live;
    }
    if (up.stateBuffer && up.thermoBuffer) {
      const n = up.particleCount || 200;
      const st = await read(up.stateBuffer, n * 8 * 4);
      const th = await read(up.thermoBuffer, n * 12 * 4);
      const byMat = {};
      for (let p = 0; p < n; p += 1) {
        const m = st[p * 8 + 3];
        if (!(m > 0)) continue;
        const id = Math.round(th[p * 12]);
        const b = byMat[id] || { n: 0, kg: 0 };
        b.n += 1; b.kg += m; byMat[id] = b;
      }
      result.mats = Object.entries(byMat).map(([id, b]) => ({ id, n: b.n, kg: Number(b.kg.toPrecision(5)) }));
    }
    return result;
  });
  console.log(JSON.stringify(out));
  await page.waitForTimeout(4000);
}
await browser.close();
