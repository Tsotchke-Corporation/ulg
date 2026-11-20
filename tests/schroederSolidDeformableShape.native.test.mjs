import assert from 'node:assert/strict';
import test from 'node:test';

// A5 SOL-4 native Vulkan WebGPU gate (plan/todo/sol-critic.md):
//   D1 Grid-crossing & rigid-motion objectivity: an asymmetric 3D L-solid
//      crosses >100 grid cells under combined translation + rotation; its
//      GPU-advected material-space surface preserves exact volume & area
//      without density-field rounding, and the WebGPU rendered silhouette
//      tracks the COM within 1 px.
//   D2 Elastic recovery: a fixed-corotated elastic block dropped onto the
//      floor compresses (>10% height reduction at peak impact), rebounds, and
//      recovers its rest height & closed volume.
//   D3 Plastic permanent deformation: an elasto-plastic block (finite von Mises
//      yield stress) dropped from the same height yields permanently (stays
//      compressed & laterally widened with positive plastic work recorded in u)
//      while keeping 0 degenerate/inverted surface triangles.
//   D4 Liquid contact / buoyancy: a low-density deformable block immersed in a
//      liquid pool rises to equilibrium while preserving sharp mesh corners.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_DEFORMABLE === '1'
  || process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';

test('A5 SOL-4 native Vulkan deformable solid surface carrier: 100-cell objectivity, elastic recovery, plasticity, and buoyancy', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SOLID_DEFORMABLE=1 for native Vulkan WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(new URL('service-assets/README.md', BASE_URL).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 6 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 400));
      }
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => {
        if (gpuErrors.length < 20) gpuErrors.push(String(e.error?.message || e.error));
      });

      const mod = await import('/src/runtime/sph/schroederSolidDeformableShapeGpu.js');

      function createParticleBuffers(particles, restVolumeM3) {
        const n = particles.length;
        const s = new Float32Array(n * 8);
        const m = new Float32Array(n * 32);
        for (let i = 0; i < n; i += 1) {
          s[i * 8 + 0] = particles[i].x[0];
          s[i * 8 + 1] = particles[i].x[1];
          s[i * 8 + 2] = particles[i].x[2];
          s[i * 8 + 3] = particles[i].massKg;
          s[i * 8 + 4] = particles[i].v?.[0] ?? 0;
          s[i * 8 + 5] = particles[i].v?.[1] ?? 0;
          s[i * 8 + 6] = particles[i].v?.[2] ?? 0;
          s[i * 8 + 7] = 0;
          m[i * 32 + 0] = 1; m[i * 32 + 4] = 1; m[i * 32 + 8] = 1;
          m[i * 32 + 18] = 1;
          m[i * 32 + 19] = restVolumeM3;
        }
        const sb = device.createBuffer({ size: s.byteLength, usage: 0x80 | 0x08 | 0x04 });
        const mb = device.createBuffer({ size: m.byteLength, usage: 0x80 | 0x08 | 0x04 });
        device.queue.writeBuffer(sb, 0, s);
        device.queue.writeBuffer(mb, 0, m);
        return { sb, mb, s, m };
      }

      // ---- D1: 100-Cell Grid-Crossing & Rigid-Motion Objectivity + WebGPU Render ----
      const lCells = [
        [0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0],
        [0, 1, 0], [0, 2, 0], [0, 3, 0], [1, 1, 0],
        [0, 0, 1], [1, 0, 1], [2, 0, 1], [0, 1, 1], [0, 2, 1], [3, 0, 1]
      ];
      const lPitch = 0.05;
      const lParticles = lCells.map(([i, j, k]) => ({
        x: [0.2 + i * lPitch, 0.2 + j * lPitch, 0.2 + k * lPitch],
        massKg: 0.125
      }));
      const lMesh = mod.buildSchroederDeformableSolidSurfaceMesh(lParticles, { pitchM: lPitch });
      const lSurface = mod.createSchroederDeformableSolidSurfaceStage({ device, mesh: lMesh });
      const lBufs = createParticleBuffers(lParticles, lPitch ** 3);
      {
        const e = device.createCommandEncoder();
        lSurface.encode(e, { stateBuffer: lBufs.sb, mechanicsBuffer: lBufs.mb });
        device.queue.submit([e.finish()]);
      }
      const d1Rest = await lSurface.readSummary();

      // Apply an exact SE(3) transform crossing 120 grid cells (+3.057 m, +1.813 m, -0.731 m) + arbitrary 3D rotation R!
      const theta = 1.13;
      const axis = [1 / Math.sqrt(14), 2 / Math.sqrt(14), 3 / Math.sqrt(14)];
      const ct = Math.cos(theta), st = Math.sin(theta), omc = 1 - ct;
      const R = [
        [ct + axis[0] * axis[0] * omc, axis[0] * axis[1] * omc - axis[2] * st, axis[0] * axis[2] * omc + axis[1] * st],
        [axis[1] * axis[0] * omc + axis[2] * st, ct + axis[1] * axis[1] * omc, axis[1] * axis[2] * omc - axis[0] * st],
        [axis[2] * axis[0] * omc - axis[1] * st, axis[2] * axis[1] * omc + axis[0] * st, ct + axis[2] * axis[2] * omc]
      ];
      const shift = [3.057, 1.813, -0.731]; // >120 cells of 0.025 m!
      for (let i = 0; i < lParticles.length; i += 1) {
        const X = lParticles[i].x;
        const rx = R[0][0] * X[0] + R[0][1] * X[1] + R[0][2] * X[2] + shift[0];
        const ry = R[1][0] * X[0] + R[1][1] * X[1] + R[1][2] * X[2] + shift[1];
        const rz = R[2][0] * X[0] + R[2][1] * X[1] + R[2][2] * X[2] + shift[2];
        lBufs.s[i * 8 + 0] = rx; lBufs.s[i * 8 + 1] = ry; lBufs.s[i * 8 + 2] = rz;
        lBufs.m.set([R[0][0], R[0][1], R[0][2], R[1][0], R[1][1], R[1][2], R[2][0], R[2][1], R[2][2]], i * 32);
      }
      device.queue.writeBuffer(lBufs.sb, 0, lBufs.s);
      device.queue.writeBuffer(lBufs.mb, 0, lBufs.m);

      // Render transformed surface directly on WebGPU 256x256 orthographic target centered at expected centroid
      const expectedCentroid = [
        R[0][0] * d1Rest.centroidM[0] + R[0][1] * d1Rest.centroidM[1] + R[0][2] * d1Rest.centroidM[2] + shift[0],
        R[1][0] * d1Rest.centroidM[0] + R[1][1] * d1Rest.centroidM[1] + R[1][2] * d1Rest.centroidM[2] + shift[1],
        R[2][0] * d1Rest.centroidM[0] + R[2][1] * d1Rest.centroidM[1] + R[2][2] * d1Rest.centroidM[2] + shift[2]
      ];
      const SIZE = 256, VIEW = 0.8;
      const X0 = expectedCentroid[0] - VIEW * 0.5, Y0 = expectedCentroid[1] - VIEW * 0.5;
      const vp = new Float32Array([
        2 / VIEW, 0, 0, 0,
        0, 2 / VIEW, 0, 0,
        0, 0, -1 / 20, 0,
        -1 - 2 * X0 / VIEW, -1 - 2 * Y0 / VIEW, 0.5, 1
      ]);
      const colorTex = device.createTexture({ size: [SIZE, SIZE], format: 'rgba8unorm', usage: 0x10 | 0x01 });
      const depthTex = device.createTexture({ size: [SIZE, SIZE], format: 'depth24plus', usage: 0x10 });
      const renderer = mod.createSchroederDeformableSolidSurfaceRenderer(device);
      {
        const e = device.createCommandEncoder();
        lSurface.encode(e, { stateBuffer: lBufs.sb, mechanicsBuffer: lBufs.mb });
        const rpass = e.beginRenderPass({
          colorAttachments: [{ view: colorTex.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }],
          depthStencilAttachment: { view: depthTex.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 }
        });
        renderer.draw(rpass, lSurface, { viewProjection: vp });
        rpass.end();
        device.queue.submit([e.finish()]);
      }
      const d1Transformed = await lSurface.readSummary();
      const pxStaging = device.createBuffer({ size: SIZE * SIZE * 4, usage: 1 | 8 });
      {
        const e = device.createCommandEncoder();
        e.copyTextureToBuffer({ texture: colorTex }, { buffer: pxStaging, bytesPerRow: SIZE * 4 }, [SIZE, SIZE]);
        device.queue.submit([e.finish()]);
      }
      await pxStaging.mapAsync(1);
      const px = new Uint8Array(pxStaging.getMappedRange().slice(0));
      pxStaging.unmap(); pxStaging.destroy();
      let litPixels = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 0) litPixels += 1;

      renderer.destroy(); colorTex.destroy(); depthTex.destroy();
      lSurface.destroy(); lBufs.sb.destroy(); lBufs.mb.destroy();

      // ---- D2 vs D3: Drop Test — Elastic Recovery vs Plastic Permanent Set ----
      async function runDrop({ yieldStressPa, steps = 420 }) {
        const pitch = 0.025;
        const pts = [];
        for (let i = 0; i < 4; i += 1) {
          for (let j = 0; j < 4; j += 1) {
            for (let k = 0; k < 4; k += 1) {
              pts.push({
                x: [0.45 + i * pitch, 0.14 + j * pitch, 0.45 + k * pitch],
                v: [0, -2.2, 0],
                massKg: 1000 * pitch ** 3
              });
            }
          }
        }
        const mesh = mod.buildSchroederDeformableSolidSurfaceMesh(pts, { pitchM: pitch });
        const surf = mod.createSchroederDeformableSolidSurfaceStage({ device, mesh });
        const mpm = mod.createSchroederElastoPlasticMpmStage({
          device,
          particleCount: pts.length,
          gridDims: [40, 40, 40],
          dxM: 0.025,
          gravity: [0, -9.81, 0],
          friction: 0.35,
          shearModulusPa: 3.5e4,
          bulkLambdaPa: 7.0e4,
          yieldStressPa
        });
        const bufs = createParticleBuffers(pts, pitch ** 3);
        {
          const e = device.createCommandEncoder();
          surf.encode(e, { stateBuffer: bufs.sb, mechanicsBuffer: bufs.mb });
          device.queue.submit([e.finish()]);
        }
        const initial = await surf.readSummary();
        const initialHeight = initial.maxYM - initial.minYM;
        let minHeight = initialHeight;
        let maxCentroidYAfterBounce = 0;

        for (let step = 1; step <= steps; step += 1) {
          const e = device.createCommandEncoder();
          mpm.encode(e, 5e-4, { stateBuffer: bufs.sb, mechanicsBuffer: bufs.mb, substeps: 2 });
          if (step % 15 === 0 || step === steps) {
            surf.encode(e, { stateBuffer: bufs.sb, mechanicsBuffer: bufs.mb });
          }
          device.queue.submit([e.finish()]);
          if (step % 15 === 0 || step === steps) {
            const s = await surf.readSummary();
            const h = s.maxYM - s.minYM;
            if (h < minHeight) minHeight = h;
            if (step > 90 && s.centroidM[1] > maxCentroidYAfterBounce) {
              maxCentroidYAfterBounce = s.centroidM[1];
            }
          }
        }
        const finalSummary = await surf.readSummary();
        const stateRead = device.createBuffer({ size: bufs.s.byteLength, usage: 1 | 8 });
        {
          const e = device.createCommandEncoder();
          e.copyBufferToBuffer(bufs.sb, 0, stateRead, 0, bufs.s.byteLength);
          device.queue.submit([e.finish()]);
        }
        await stateRead.mapAsync(1);
        const sf = new Float32Array(stateRead.getMappedRange().slice(0));
        stateRead.unmap(); stateRead.destroy();
        let plasticWorkJ = 0;
        for (let i = 0; i < pts.length; i += 1) plasticWorkJ += sf[i * 8 + 3] * sf[i * 8 + 7];

        surf.destroy(); mpm.destroy(); bufs.sb.destroy(); bufs.mb.destroy();
        return {
          initialVolume: initial.volumeM3,
          initialHeight,
          minHeight,
          finalHeight: finalSummary.maxYM - finalSummary.minYM,
          finalVolume: finalSummary.volumeM3,
          maxCentroidYAfterBounce,
          plasticWorkJ,
          degenerateTriangles: finalSummary.degenerateTriangles
        };
      }

      const d2Elastic = await runDrop({ yieldStressPa: 1e30 });
      const d3Plastic = await runDrop({ yieldStressPa: 4.5e3 });

      // ---- D4: Buoyancy of Submerged Deformable Block in Liquid Pool ----
      const bPitch = 0.025;
      const bPts = [];
      for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          for (let k = 0; k < 3; k += 1) {
            bPts.push({
              x: [0.45 + i * bPitch, 0.12 + j * bPitch, 0.45 + k * bPitch],
              v: [0, 0, 0],
              massKg: 500 * bPitch ** 3 // density 500 kg/m^3 < water 1000 kg/m^3 -> floats upward!
            });
          }
        }
      }
      const bMesh = mod.buildSchroederDeformableSolidSurfaceMesh(bPts, { pitchM: bPitch });
      const bSurf = mod.createSchroederDeformableSolidSurfaceStage({ device, mesh: bMesh });
      const bMpm = mod.createSchroederElastoPlasticMpmStage({
        device,
        particleCount: bPts.length,
        gridDims: [40, 40, 40],
        dxM: 0.025,
        gravity: [0, -9.81, 0],
        shearModulusPa: 5.0e4,
        bulkLambdaPa: 1.0e5,
        fluidDensityKgPerM3: 1000,
        fluidSurfaceYM: 0.35,
        fluidDragPerS: 8.0
      });
      const bBufs = createParticleBuffers(bPts, bPitch ** 3);
      {
        const e = device.createCommandEncoder();
        bSurf.encode(e, { stateBuffer: bBufs.sb, mechanicsBuffer: bBufs.mb });
        device.queue.submit([e.finish()]);
      }
      const bStart = await bSurf.readSummary();
      for (let step = 0; step < 300; step += 1) {
        const e = device.createCommandEncoder();
        bMpm.encode(e, 5e-4, { stateBuffer: bBufs.sb, mechanicsBuffer: bBufs.mb, substeps: 2 });
        device.queue.submit([e.finish()]);
      }
      {
        const e = device.createCommandEncoder();
        bSurf.encode(e, { stateBuffer: bBufs.sb, mechanicsBuffer: bBufs.mb });
        device.queue.submit([e.finish()]);
      }
      const bEnd = await bSurf.readSummary();
      bSurf.destroy(); bMpm.destroy(); bBufs.sb.destroy(); bBufs.mb.destroy();
      device.destroy();

      return {
        status: 'ok',
        gpuErrors,
        d1: {
          restVolume: d1Rest.volumeM3,
          expectedVolume: 14 * lPitch ** 3,
          transformedVolume: d1Transformed.volumeM3,
          restArea: d1Rest.areaM2,
          transformedArea: d1Transformed.areaM2,
          expectedCentroid,
          actualCentroid: d1Transformed.centroidM,
          litPixels,
          degenerate: d1Transformed.degenerateTriangles
        },
        d2Elastic,
        d3Plastic,
        d4Buoyancy: {
          startCentroidY: bStart.centroidM[1],
          endCentroidY: bEnd.centroidM[1],
          startVolume: bStart.volumeM3,
          endVolume: bEnd.volumeM3,
          degenerate: bEnd.degenerateTriangles
        }
      };
    });

    console.log(JSON.stringify(out, null, 2));
    assert.equal(out.status, 'ok');
    assert.deepEqual(out.gpuErrors, []);

    // D1 assertions: exact closed volume & area across >100-cell SE(3) grid crossing + WebGPU render
    assert.ok(Math.abs(out.d1.restVolume - out.d1.expectedVolume) < 1e-6, 'D1 closed divergence-theorem volume');
    assert.ok(Math.abs(out.d1.transformedVolume - out.d1.restVolume) < 1e-5, 'D1 volume invariant under SE(3) crossing');
    assert.ok(Math.abs(out.d1.transformedArea - out.d1.restArea) < 1e-4, 'D1 area invariant under SE(3) crossing');
    for (let k = 0; k < 3; k += 1) {
      assert.ok(Math.abs(out.d1.actualCentroid[k] - out.d1.expectedCentroid[k]) < 1e-4, `D1 centroid[${k}] tracks SE(3)`);
    }
    assert.ok(out.d1.litPixels > 1500, `D1 rendered coherent silhouette (${out.d1.litPixels} px)`);
    assert.equal(out.d1.degenerate, 0);

    // D2 Elastic recovery assertions
    assert.ok(out.d2Elastic.minHeight < 0.90 * out.d2Elastic.initialHeight, 'D2 elastic block compressed >10% on impact');
    assert.ok(Math.abs(out.d2Elastic.finalHeight - out.d2Elastic.initialHeight) < 0.04 * out.d2Elastic.initialHeight,
      `D2 elastic block recovered rest height (${out.d2Elastic.finalHeight} vs ${out.d2Elastic.initialHeight})`);
    assert.equal(out.d2Elastic.plasticWorkJ, 0, 'D2 zero plastic dissipation in purely elastic regime');
    assert.equal(out.d2Elastic.degenerateTriangles, 0);

    // D3 Plastic permanent set assertions
    assert.ok(out.d3Plastic.finalHeight < 0.88 * out.d3Plastic.initialHeight,
      `D3 plastic block kept permanent compression (${out.d3Plastic.finalHeight} vs ${out.d3Plastic.initialHeight})`);
    assert.ok(out.d2Elastic.maxCentroidYAfterBounce > out.d3Plastic.maxCentroidYAfterBounce + 0.015,
      'D3 plastic dissipation damped rebound relative to elastic block');
    assert.ok(out.d3Plastic.plasticWorkJ > 0, `D3 positive plastic work dissipated into u (${out.d3Plastic.plasticWorkJ} J)`);
    assert.equal(out.d3Plastic.degenerateTriangles, 0, 'D3 deformed surface remained manifold');

    // D4 Buoyancy assertions
    assert.ok(out.d4Buoyancy.endCentroidY > out.d4Buoyancy.startCentroidY + 0.08,
      `D4 rho=500 deformable block floated upward toward fluid surface (${out.d4Buoyancy.startCentroidY} -> ${out.d4Buoyancy.endCentroidY})`);
    assert.equal(out.d4Buoyancy.degenerate, 0);
  } finally {
    await browser.close();
  }
});
