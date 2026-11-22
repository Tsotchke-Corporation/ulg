import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  planSphRenderFieldSpatialGrid,
  sphRenderFieldSpatialParticleBinWgsl,
  sphRenderFieldSpatialEventBinWgsl,
  sphRenderFieldSpatialScanWgsl,
  sphRenderFieldSpatialGatherWgsl,
  sphRenderFieldSpatialGatherMotionWgsl
} from '../src/runtime/sph/sphRenderFieldSpatialGridGpu.js';
import {
  buildSphRenderFieldSurfaceTable,
  buildSphRenderFieldWebGpu,
  SPH_GPU_RENDER_ROW_FLOATS,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
} from '../src/runtime/sph/sphRenderGpuKernel.js';

const require = createRequire(import.meta.url);

function createFakeWebGpuDevice() {
  const createdBuffers = [];
  const dispatches = [];
  const clears = [];
  const device = {
    limits: {
      maxComputeWorkgroupsPerDimension: 65535,
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxStorageBuffersPerShaderStage: 8
    },
    createBuffer(desc) {
      const buf = {
        label: desc.label || '',
        size: desc.size,
        usage: desc.usage,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      createdBuffers.push(buf);
      return buf;
    },
    createShaderModule(desc) {
      return { label: desc.label || '', code: desc.code };
    },
    createBindGroupLayout(desc) {
      return { label: desc.label || '', entries: desc.entries };
    },
    createPipelineLayout(desc) {
      return { label: desc.label || '', bindGroupLayouts: desc.bindGroupLayouts };
    },
    createComputePipeline(desc) {
      return {
        label: desc.label || '',
        getBindGroupLayout() { return { label: 'auto' }; }
      };
    },
    createBindGroup(desc) {
      return { label: desc.label || '', entries: desc.entries };
    },
    createCommandEncoder() {
      return {
        clearBuffer(buffer, offset, size) {
          clears.push({ label: buffer.label, offset, size });
        },
        beginComputePass(desc) {
          let pipe = null;
          return {
            setPipeline(p) { pipe = p; },
            setBindGroup() {},
            dispatchWorkgroups(x, y = 1, z = 1) {
              dispatches.push({ label: desc?.label || pipe?.label || '', x, y, z });
            },
            end() {}
          };
        },
        finish() { return { finished: true }; }
      };
    },
    queue: {
      writeBuffer() {},
      submit() {},
      onSubmittedWorkDone() { return Promise.resolve(); }
    }
  };
  return { device, createdBuffers, dispatches, clears };
}

test('spatial brick grid plan computes exact brick layout and rejects oversized grids cleanly', () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    { surfaceKey: 's0', material: 'H2O', phase: 'liquid', resolution: 13 },
    { surfaceKey: 's1', material: 'Fe', phase: 'liquid', resolution: 48 }
  ]);
  const plan = planSphRenderFieldSpatialGrid({
    device: { limits: { maxComputeWorkgroupsPerDimension: 65535, maxBufferSize: 256e6, maxStorageBufferBindingSize: 128e6, maxStorageBuffersPerShaderStage: 8 } },
    surfaceRecords: surfaceTable.records,
    surfaceCount: surfaceTable.surfaceCount,
    particleCount: 1216,
    productEventCount: 512
  });
  assert.ok(plan);
  assert.equal(plan.surfaceCount, 2);
  // R=13 -> brickDim=4 (64 bricks); R=48 -> brickDim=12 (1728 bricks)
  assert.equal(plan.surfaceBrickInfo[0], 4);
  assert.equal(plan.surfaceBrickInfo[1], 64);
  assert.equal(plan.surfaceBrickInfo[2], 0);
  assert.equal(plan.surfaceBrickInfo[4], 12);
  assert.equal(plan.surfaceBrickInfo[5], 1728);
  assert.equal(plan.surfaceBrickInfo[6], 64);
  assert.equal(plan.totalBricks, 1792);
  assert.equal(plan.maxBricksPerSurface, 1728);
  assert.equal(plan.scanBlockCount, 4);
  assert.equal(plan.hasProductEvents, true);

  // Oversized surface count (>64) cleanly returns null to trigger dense fallback
  const tooMany = planSphRenderFieldSpatialGrid({
    device: { limits: {} },
    surfaceRecords: new Float32Array(65 * 16),
    surfaceCount: 65,
    particleCount: 100
  });
  assert.equal(tooMany, null);
});

test('buildSphRenderFieldWebGpu with preferSpatialGrid encodes brick binning, multi-block scan, and tiled gather', async () => {
  const { device, dispatches, clears } = createFakeWebGpuDevice();
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    { surfaceKey: 's0', material: 'H2O', phase: 'liquid', resolution: 32 },
    { surfaceKey: 's1', material: 'Fe', phase: 'liquid', resolution: 32 }
  ]);
  const renderRows = new Float32Array(128 * SPH_GPU_RENDER_ROW_FLOATS);
  const productEvents = new Float32Array(64 * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);

  const result = await buildSphRenderFieldWebGpu({
    device,
    renderRows,
    productEventRows: productEvents,
    surfaceTable,
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: false,
    retainMotionFieldBuffer: true,
    preferSpatialGrid: true
  });
  assert.ok(result);
  assert.equal(clears.length, 1);
  assert.equal(clears[0].label, 'ulg-sph-render-field-spatial-grid-u32');
  const labels = dispatches.map((d) => d.label);
  assert.deepEqual(labels, [
    'ulg-sph-render-field-spatial-count-particles',
    'ulg-sph-render-field-spatial-count-events',
    'ulg-sph-render-field-spatial-scan-blocks',
    'ulg-sph-render-field-spatial-scan-totals',
    'ulg-sph-render-field-spatial-add-offsets',
    'ulg-sph-render-field-spatial-scatter-particles',
    'ulg-sph-render-field-spatial-scatter-events',
    'ulg-sph-render-field-spatial-gather'
  ]);
  assert.equal(dispatches.at(-1).x, 512);
  assert.equal(dispatches.at(-1).y, 2);
  result.destroyRenderFieldBuffers();
});

test('native Vulkan spatial-brick render field matches dense gather across bulk, smear, motion, dispersed optics, product events, and tail resolutions', async (t) => {
  if (process.env.ULG_RUN_NATIVE_WEBGPU_RENDER_SPATIAL !== '1') {
    t.skip('set ULG_RUN_NATIVE_WEBGPU_RENDER_SPATIAL=1 to run native Vulkan parity proof');
    return;
  }
  const { chromium } = require('@playwright/test');
  const baseUrl = process.env.ULG_WEBGPU_RADIX_COUNT_BASE_URL || 'https://127.0.0.1:5173/';
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: false,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
      '--ozone-platform=wayland'
    ]
  });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const report = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return { skipped: true, reason: 'no adapter' };
      const device = await adapter.requestDevice();
      const renderMod = await import('/src/runtime/sph/sphRenderGpuKernel.js');
      const spatialMod = await import('/src/runtime/sph/sphRenderFieldSpatialGridGpu.js');
      const abiMod = await import('/ulg-gpu-abi/src/index.js');
      const DISP_STATUS = abiMod.SPH_DISPERSED_MEDIUM_OPTICS_STATUS;

      // 1. Verify all 5 WGSL modules compile cleanly in Chromium Tint with zero errors
      const shaderChecks = [
        ['particleBin', spatialMod.sphRenderFieldSpatialParticleBinWgsl],
        ['eventBin', spatialMod.sphRenderFieldSpatialEventBinWgsl],
        ['scan', spatialMod.sphRenderFieldSpatialScanWgsl],
        ['gather', spatialMod.sphRenderFieldSpatialGatherWgsl],
        ['gatherMotion', spatialMod.sphRenderFieldSpatialGatherMotionWgsl]
      ];
      const compileErrors = [];
      for (const [name, code] of shaderChecks) {
        const mod = device.createShaderModule({ label: name, code });
        const info = await mod.getCompilationInfo();
        for (const m of info.messages) {
          if (m.type === 'error') compileErrors.push(`${name}:${m.lineNum}:${m.message}`);
        }
      }
      if (compileErrors.length > 0) {
        return { ok: false, compileErrors };
      }

      // Deterministic PRNG
      let seed = 0x12345678;
      const rand = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 0x100000000;
      };

      const readGpuFloats = async (buf, byteLength) => {
        const rb = device.createBuffer({
          size: byteLength,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });
        const enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(buf, 0, rb, 0, byteLength);
        device.queue.submit([enc.finish()]);
        await rb.mapAsync(GPUMapMode.READ);
        const out = new Float32Array(rb.getMappedRange().slice(0));
        rb.unmap();
        rb.destroy();
        return out;
      };

      // Build realistic multi-surface test:
      // - non-multiple-of-4 resolution (13) + 32 (multi-block scan > 512 total bricks!)
      // - bulk liquid, solid, gas, mixed transition phase, variable radii, velocities (triggers smear!)
      // - dispersed optics surface (both direct CIC and wet-vapor companion mist!)
      // - product events
      const phaseStride = 160;
      const particleCount = phaseStride * 4; // 640 particles (4-phase layout)
      const renderRows = new Float32Array(particleCount * renderMod.SPH_GPU_RENDER_ROW_FLOATS);
      const dispersedRows = new Float32Array(particleCount * 8);
      const surfaceTable = renderMod.buildSphRenderFieldSurfaceTable([
        { surfaceKey: 'h2o-liquid', material: 'H2O', phase: 'liquid', resolution: 13, particleRadiusScale: 1.15 },
        { surfaceKey: 'fe-liquid', material: 'Fe', phase: 'liquid', resolution: 32, particleRadiusScale: 1.25 },
        { surfaceKey: 'h2o-gas', material: 'H2O', phase: 'gas', resolution: 17, particleRadiusScale: 1.2 },
        { surfaceKey: 'h2o-mist', material: 'H2O', phase: 'liquid', resolution: 17, opticalStateId: 7 }
      ]);
      const h2oId = surfaceTable.records[0];
      const feId = surfaceTable.records[16];
      const mistOpticalId = surfaceTable.metadata[3].opticalStateId;

      for (let i = 0; i < particleCount; i += 1) {
        const base = i * renderMod.SPH_GPU_RENDER_ROW_FLOATS;
        const lane = Math.floor(i / phaseStride);
        const isH2O = (i % phaseStride) < 100;
        const x = 0.02 + rand() * 0.10;
        const y = 0.02 + rand() * 0.10;
        const z = 0.02 + rand() * 0.10;
        const mass = lane === 3 ? 0.0 : (0.0005 + rand() * 0.002);
        renderRows[base + 0] = x;
        renderRows[base + 1] = y;
        renderRows[base + 2] = z;
        renderRows[base + 3] = mass;
        renderRows[base + 4] = mass > 0 ? (isH2O ? h2oId : feId) : 0;
        renderRows[base + 5] = lane === 0 ? 1 : lane === 1 ? 2 : 3;
        renderRows[base + 6] = 260 + rand() * 1600;
        renderRows[base + 7] = 1000;
        renderRows[base + 8] = 1000;
        // gas_fraction (row2.y) and solid_fraction (row4.x)
        const gasF = lane === 2 ? (0.6 + rand() * 0.3) : (lane === 1 ? rand() * 0.15 : 0);
        const solF = lane === 0 ? 0.85 : (lane === 1 ? rand() * 0.1 : 0);
        renderRows[base + 9] = gasF;
        renderRows[base + 10] = 1;
        renderRows[base + 11] = 0;
        renderRows[base + 12] = 1e-6;
        renderRows[base + 13] = 0.003 + rand() * 0.004; // particle_radius_m
        renderRows[base + 14] = 1.0;
        renderRows[base + 15] = 101325;
        renderRows[base + 16] = solF;
        // Diverging velocities to exercise smear pass 2 and render_motion_field!
        renderRows[base + 17] = (rand() - 0.5) * 4.0;
        renderRows[base + 18] = (rand() - 0.5) * 4.0;
        renderRows[base + 19] = (rand() - 0.5) * 4.0;

        // Populate canonical ready/blocked dispersed optics on liquid companion lane (lane 1)
        const db = i * 8;
        if (lane === 1 && isH2O && (i % 3 === 0)) {
          dispersedRows[db + 0] = h2oId;           // dispersed_material_id
          dispersedRows[db + 1] = 2;               // dispersed_phase_id (liquid)
          dispersedRows[db + 2] = mistOpticalId;   // optical_state_id
          dispersedRows[db + 3] = DISP_STATUS.ready;
          dispersedRows[db + 4] = mass * 0.25;     // dispersed_mass_kg
          dispersedRows[db + 5] = 1.2e-4;          // scattering_cross_section_m2
          dispersedRows[db + 6] = 2.0e-5;          // absorption_cross_section_m2
          dispersedRows[db + 7] = 6.0e-5;          // scattering_asymmetry_cross_section_m2
        } else {
          dispersedRows[db + 3] = DISP_STATUS.blocked;
        }
      }

      const productEventCount = 48;
      const productEvents = new Float32Array(productEventCount * renderMod.SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
      for (let e = 0; e < productEventCount; e += 1) {
        const eb = e * renderMod.SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS;
        productEvents[eb + 0] = 0.03 + rand() * 0.08;
        productEvents[eb + 1] = 0.03 + rand() * 0.08;
        productEvents[eb + 2] = 0.03 + rand() * 0.08;
        productEvents[eb + 3] = 0.001;
        productEvents[eb + 4] = (e % 2 === 0) ? h2oId : feId;
        productEvents[eb + 11] = (e % 2 === 0) ? 3 : 2;
        productEvents[eb + 13] = (e % 5 === 0) ? 0.0 : 0.0005; // unplaced mass
        productEvents[eb + 18] = (e % 7 === 0) ? 0.0 : 1.0;    // status
      }

      const runCase = async ({ preferSpatialGrid, renderSmearDtS, retainMotionFieldBuffer, includeDispersed }) => {
        const res = await renderMod.buildSphRenderFieldWebGpu({
          device,
          renderRows,
          ...(includeDispersed ? { dispersedMediumOpticsRows: dispersedRows } : {}),
          productEventRows: productEvents,
          surfaceTable,
          fieldPadding: 0.22,
          refEdgeM: 0.14,
          renderSmearDtS,
          readbackMode: 'full-parity-readback',
          retainMotionFieldBuffer,
          preferSpatialGrid
        });
        let motion = null;
        if (retainMotionFieldBuffer && res.motionField?.buffer) {
          motion = await readGpuFloats(res.motionField.buffer, res.motionField.byteLength);
        }
        const field = res.fieldRows;
        res.destroyRenderFieldBuffers?.({ force: true, releaseLeases: true });
        res.motionField?.destroy?.();
        return { field, motion };
      };

      const maxDiff = (a, b) => {
        let maxAbs = 0;
        let maxRel = 0;
        let maxScaled = 0;
        let nonzero = 0;
        let worstIdx = -1;
        let worstRelIdx = -1;
        for (let i = 0; i < a.length; i += 1) {
          const av = a[i];
          const bv = b[i];
          if (Math.abs(av) > 0 || Math.abs(bv) > 0) nonzero += 1;
          const d = Math.abs(av - bv);
          const mag = Math.max(Math.abs(av), Math.abs(bv));
          const rel = d / Math.max(1e-6, mag);
          const scaled = d / Math.max(1e-4, mag);
          if (d > maxAbs) { maxAbs = d; worstIdx = i; }
          if (rel > maxRel) { maxRel = rel; worstRelIdx = i; }
          if (scaled > maxScaled) { maxScaled = scaled; }
        }
        return {
          maxAbs,
          maxRel,
          maxScaled,
          nonzero,
          worstIdx,
          aAt: a[worstIdx],
          bAt: b[worstIdx],
          worstRelIdx,
          relAAt: a[worstRelIdx],
          relBAt: b[worstRelIdx]
        };
      };

      const denseNoSmear = await runCase({
        preferSpatialGrid: false,
        renderSmearDtS: 0,
        retainMotionFieldBuffer: true,
        includeDispersed: true
      });
      const spatialNoSmear = await runCase({
        preferSpatialGrid: true,
        renderSmearDtS: 0,
        retainMotionFieldBuffer: true,
        includeDispersed: true
      });
      const noSmearFieldDiff = maxDiff(denseNoSmear.field, spatialNoSmear.field);

      const dense = await runCase({
        preferSpatialGrid: false,
        renderSmearDtS: 0.02,
        retainMotionFieldBuffer: true,
        includeDispersed: true
      });
      const spatial = await runCase({
        preferSpatialGrid: true,
        renderSmearDtS: 0.02,
        retainMotionFieldBuffer: true,
        includeDispersed: true
      });
      const fieldDiff = maxDiff(dense.field, spatial.field);
      const motionDiff = maxDiff(dense.motion, spatial.motion);

      // Performance benchmark on realistic 4864-particle x 6-surface x 48^3 grid
      const perfParticles = 4864;
      const perfRows = new Float32Array(perfParticles * renderMod.SPH_GPU_RENDER_ROW_FLOATS);
      for (let i = 0; i < perfParticles; i += 1) {
        const b = i * renderMod.SPH_GPU_RENDER_ROW_FLOATS;
        const active = i < 1216;
        perfRows[b + 0] = 0.04 + rand() * 0.06;
        perfRows[b + 1] = 0.02 + rand() * 0.06;
        perfRows[b + 2] = 0.04 + rand() * 0.06;
        perfRows[b + 3] = active ? 0.001 : 0.0;
        perfRows[b + 4] = active ? (i < 600 ? h2oId : feId) : 0;
        perfRows[b + 5] = i < 600 ? 1 : 2;
        perfRows[b + 6] = i < 600 ? 250 : 1850;
        perfRows[b + 13] = 0.003;
        perfRows[b + 16] = i < 600 ? 1 : 0;
      }
      const perfTable = renderMod.buildSphRenderFieldSurfaceTable([
        { surfaceKey: 'p0', material: 'H2O', phase: 'solid', resolution: 48, particleRadiusScale: 1.15 },
        { surfaceKey: 'p1', material: 'H2O', phase: 'liquid', resolution: 48, particleRadiusScale: 1.15 },
        { surfaceKey: 'p2', material: 'H2O', phase: 'gas', resolution: 48, particleRadiusScale: 1.15 },
        { surfaceKey: 'p3', material: 'Fe', phase: 'solid', resolution: 48, particleRadiusScale: 1.15 },
        { surfaceKey: 'p4', material: 'Fe', phase: 'liquid', resolution: 48, particleRadiusScale: 1.15 },
        { surfaceKey: 'p5', material: 'Fe', phase: 'gas', resolution: 48, particleRadiusScale: 1.15 }
      ]);
      const timeMode = async (preferSpatialGrid) => {
        // warmup
        const w = await renderMod.buildSphRenderFieldWebGpu({
          device, renderRows: perfRows, surfaceTable: perfTable, refEdgeM: 0.14,
          readbackMode: 'no-full-readback', waitForQueueCompletion: true,
          retainMotionFieldBuffer: true, preferSpatialGrid
        });
        w.destroyRenderFieldBuffers?.({ force: true, releaseLeases: true });
        w.motionField?.destroy?.();
        const t0 = performance.now();
        for (let iter = 0; iter < 3; iter += 1) {
          const r = await renderMod.buildSphRenderFieldWebGpu({
            device, renderRows: perfRows, surfaceTable: perfTable, refEdgeM: 0.14,
            readbackMode: 'no-full-readback', waitForQueueCompletion: true,
            retainMotionFieldBuffer: true, preferSpatialGrid
          });
          r.destroyRenderFieldBuffers?.({ force: true, releaseLeases: true });
          r.motionField?.destroy?.();
        }
        return (performance.now() - t0) / 3;
      };
      const denseMs = await timeMode(false);
      const spatialMs = await timeMode(true);

      return {
        ok: true,
        noSmearFieldDiff,
        fieldDiff,
        motionDiff,
        denseMs: +denseMs.toFixed(2),
        spatialMs: +spatialMs.toFixed(2),
        speedup: +(denseMs / Math.max(0.01, spatialMs)).toFixed(1)
      };
    });

    if (report.skipped) {
      t.skip(report.reason);
      return;
    }
    console.log('Native Vulkan Spatial-Brick Render Field Proof:', report);
    assert.equal(report.ok, true, JSON.stringify(report));
    assert.ok(report.noSmearFieldDiff.nonzero > 1000, `expected populated field: ${JSON.stringify(report.noSmearFieldDiff)}`);
    assert.ok(report.fieldDiff.nonzero > 1000, `expected populated field: ${JSON.stringify(report.fieldDiff)}`);
    assert.ok(report.motionDiff.nonzero > 500, `expected populated motion field: ${JSON.stringify(report.motionDiff)}`);
    assert.ok(
      report.noSmearFieldDiff.maxRel < 1e-4,
      `spatial vs dense no-smear field mismatch: ${JSON.stringify(report.noSmearFieldDiff)}`
    );
    assert.ok(
      report.fieldDiff.maxScaled < 1e-2,
      `spatial vs dense smear field mismatch: ${JSON.stringify(report.fieldDiff)}`
    );
    assert.ok(
      report.motionDiff.maxRel < 1e-4,
      `spatial vs dense motion mismatch: ${JSON.stringify(report.motionDiff)}`
    );
  } finally {
    await browser.close();
  }
});
