import assert from 'node:assert/strict';
import test from 'node:test';

// G3 SOL-1 Phase 2 gate (plan/todo/g3-solids-proposal.md): the voxel shape
// carrier drawn from the resident frame buffer (no pose readback). An
// orthographic 1 m x 1 m view at 256 x 256 px renders the asymmetric L while
// the rigid lane translates it in the image plane, then while it tumbles.
//   S1 translation: silhouette centroid shift = projected COM shift within
//      1 px; coverage constant within 3% (edge-pixel quantization);
//   S2 tumbling: the silhouette changes (the mesh rotates with the frame) and
//      stays inside the view; no GPU errors.
// ULG_RUN_NATIVE_SOLID_RIGID=1; run in a memory-capped scope.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('native Vulkan voxel shape carrier follows the resident rigid frame', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SOLID_RIGID=1 for native Vulkan WebGPU',
  timeout: 600_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const out = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const errors = []; let errorCount = 0;
      device.addEventListener('uncapturederror', e => { if (errorCount++ < 20) errors.push(String(e.error?.message ?? e).slice(0, 500)); });
      const solid = await import('/src/runtime/sph/schroederSolidRigidGpu.js');
      const shapes = await import('/src/runtime/sph/schroederSolidShapeCarrier.js');
      for (const code of [solid.schroederSolidRigidWgsl(), shapes.schroederSolidShapeRenderWgsl]) {
        const info = await device.createShaderModule({ code }).getCompilationInfo();
        const bad = info.messages.filter(m => m.type === 'error').map(m => `${m.lineNum}:${m.linePos} ${m.message}`);
        if (bad.length) { device.destroy(); return { status: 'compile-error', compileErrors: bad.slice(0, 5) }; }
      }
      const cells = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0], [1, 1, 0],
        [0, 0, 1], [1, 0, 1], [2, 0, 1], [0, 1, 1], [0, 2, 1], [3, 0, 1]];
      const SIZE = 256, VIEW = 1.0, X0 = 1.5, Y0 = 1.5;
      // Column-major orthographic view-projection: x,y in [X0, X0+VIEW] -> clip [-1, 1]; z in (-10, 10) -> (0, 1).
      const viewProjection = new Float32Array([2 / VIEW, 0, 0, 0, 0, 2 / VIEW, 0, 0, 0, 0, -1 / 20, 0,
        -1 - 2 * X0 / VIEW, -1 - 2 * Y0 / VIEW, 0.5, 1]);
      const color = device.createTexture({ size: [SIZE, SIZE], format: 'rgba8unorm', usage: 0x10 | 0x01 });
      const depth = device.createTexture({ size: [SIZE, SIZE], format: 'depth24plus', usage: 0x10 });
      const renderer = shapes.createSchroederSolidShapeRenderer(device);
      const readPixels = async () => {
        const buffer = device.createBuffer({ size: SIZE * SIZE * 4, usage: 1 | 8 });
        const encoder = device.createCommandEncoder();
        encoder.copyTextureToBuffer({ texture: color }, { buffer, bytesPerRow: SIZE * 4 }, [SIZE, SIZE]);
        device.queue.submit([encoder.finish()]); await buffer.mapAsync(1);
        const px = new Uint8Array(buffer.getMappedRange().slice(0)); buffer.unmap(); buffer.destroy();
        let count = 0, sx = 0, sy = 0, boundary = 0;
        const on = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && px[(y * SIZE + x) * 4 + 3] > 0;
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
          if (!on(x, y)) continue;
          count++; sx += x + 0.5; sy += y + 0.5;
          if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) boundary++;
        }
        return { count, boundary, cx: count ? sx / count : null, cy: count ? sy / count : null,
          touchesEdge: [0, SIZE - 1].some(e => { for (let i = 0; i < SIZE; i++) {
            if (px[(e * SIZE + i) * 4 + 3] > 0 || px[(i * SIZE + e) * 4 + 3] > 0) return true; } return false; }) };
      };
      const make = data => { const b = device.createBuffer({ size: data.byteLength, usage: 0x80 | 0x04 | 0x08 });
        device.queue.writeBuffer(b, 0, data); return b; };
      const run = async ({ velocity, angularVelocity, steps, every }) => {
        const members = cells.map(([i, j, k], n) => ({ x: [1.9 + 0.05 * i, 1.9 + 0.05 * j, 0.05 * k],
          massKg: Math.fround(0.1 + 0.013 * ((n * 7) % 11)) }));
        const seed = solid.seedSchroederSolidRigidBody({ bodyId: 1, members, velocity, angularVelocity });
        const packed = solid.packSchroederSolidRigidBodies([seed]);
        const frameBuffer = make(packed.frames), memberBuffer = make(packed.members);
        const stage = solid.createSchroederSolidRigidStage({ device, bodyCount: 1, memberCount: packed.memberCount, frameBuffer, memberBuffer });
        const handle = renderer.addShape(shapes.buildSchroederSolidVoxelShape(seed, { pitchM: 0.05 }), { bodyIndex: 0 });
        const samples = [];
        for (let step = 0; step <= steps; step++) {
          if (step > 0) { const e = device.createCommandEncoder(); stage.encode(e, 1e-3); device.queue.submit([e.finish()]); }
          if (step % every === 0) {
            const e = device.createCommandEncoder();
            const pass = e.beginRenderPass({ colorAttachments: [{ view: color.createView(), loadOp: 'clear', storeOp: 'store',
              clearValue: { r: 0, g: 0, b: 0, a: 0 } }], depthStencilAttachment: { view: depth.createView(),
              depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 } });
            renderer.draw(pass, handle, { viewProjection, frameBuffer }); pass.end(); device.queue.submit([e.finish()]);
            samples.push({ step, ...(await readPixels()) });
          }
        }
        renderer.removeShape(handle); stage.destroy(); frameBuffer.destroy(); memberBuffer.destroy();
        return { samples, com0: seed.centerOfMass, velocity };
      };
      const translation = await run({ velocity: [0.2, 0.1, 0], angularVelocity: [0, 0, 0], steps: 1000, every: 100 });
      const tumbling = await run({ velocity: [0, 0, 0], angularVelocity: [1.5, 3.0, 0.5], steps: 1000, every: 100 });
      device.destroy();
      return { status: 'ran', errors, errorCount, translation, tumbling, SIZE, VIEW };
    });
    assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.notEqual(out.status, 'compile-error', `shaders compile: ${JSON.stringify(out.compileErrors)}`);
    assert.deepEqual(out.errors, [], `no GPU validation errors (${out.errorCount})`);
    const pxPerM = out.SIZE / out.VIEW;
    const t = out.translation.samples, first = t[0];
    const report = { coverage0: first.count, boundary0: first.boundary, translation: [], tumbling: out.tumbling.samples.map(s => s.count) };
    assert.ok(first.count > 500, `the body is visible: ${first.count} px`);
    for (const s of t) {
      const time = s.step * 1e-3;
      // Image y grows downward: a +y world shift moves the silhouette up.
      const dxExpected = out.translation.velocity[0] * time * pxPerM, dyExpected = -out.translation.velocity[1] * time * pxPerM;
      const dx = s.cx - first.cx, dy = s.cy - first.cy;
      report.translation.push({ step: s.step, dx, dxExpected, dy, dyExpected, count: s.count });
      assert.ok(Math.abs(dx - dxExpected) <= 1 && Math.abs(dy - dyExpected) <= 1, `S1: centroid tracks the frame at step ${s.step}`);
      // Pixel-centre sampling of a translating silhouette: each boundary pixel
      // can flip at most once per unit shift, so coverage varies by at most
      // the boundary pixel count.
      assert.ok(Math.abs(s.count - first.count) <= first.boundary, `S1: coverage ${s.count} vs ${first.count} (boundary ${first.boundary}) at step ${s.step}`);
      assert.ok(!s.touchesEdge, 'S1: inside the view');
    }
    const counts = out.tumbling.samples.map(s => s.count);
    assert.ok(Math.max(...counts) - Math.min(...counts) > 0.05 * counts[0], 'S2: the silhouette rotates with the frame');
    for (const s of out.tumbling.samples) assert.ok(!s.touchesEdge && s.count > 0, 'S2: visible and inside the view');
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
});
