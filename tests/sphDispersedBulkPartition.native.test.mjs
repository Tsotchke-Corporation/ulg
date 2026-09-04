import assert from 'node:assert/strict';
import { test } from 'node:test';

test('native render field partitions dispersed and bulk volume without changing other phases', {
  skip: process.env.ULG_RUN_NATIVE_DISPERSED_BULK_PARTITION === '1'
    ? false : 'set ULG_RUN_NATIVE_DISPERSED_BULK_PARTITION=1 for native WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_NATIVE_CHROME || '/usr/bin/google-chrome',
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  let result;
  try {
    const page = await browser.newPage();
    await page.goto(process.env.ULG_NATIVE_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/', {
      waitUntil: 'domcontentloaded'
    });
    result = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'adapter-unavailable' };
      const device = await adapter.requestDevice();
      const errors = [];
      device.addEventListener('uncapturederror', (event) => errors.push(event.error.message));
      device.pushErrorScope('validation');
      const render = await import('/src/runtime/sph/sphRenderGpuKernel.js');
      const abi = await import('/ulg-gpu-abi/src/index.js');
      const optical = await import('/src/runtime/material/opticalGpuBuffers.js');
      const materialId = optical.stableOpticalMaterialId('h2o');
      const resolution = 4;
      const opticalStateId = 32002;
      const surfaceTable = render.buildSphRenderFieldSurfaceTable([
        ...['liquid', 'gas', 'solid'].map((phase) => ({
          surfaceKey: `ordinary-h2o-${phase}`, material: 'h2o', phase,
          opticalStateId: 0, resolution, isolation: 10, subtract: 2, radiusNorm: 0.25
        })),
        { surfaceKey: 'dispersed-h2o', material: 'h2o', phase: 'gas', opticalStateId,
          resolution, isolation: 10, subtract: 2, radiusNorm: 0.25 }
      ]);
      // Compare two manufactured states ON GPU, not against a CPU solver.
      // Only one fixed 16-byte evidence row is mapped per case.
      const reduction = device.createComputePipeline({
        layout: 'auto',
        compute: {
          entryPoint: 'main',
          module: device.createShaderModule({ code: `
            @group(0) @binding(0) var<storage, read> actual: array<f32>;
            @group(0) @binding(1) var<storage, read> residual: array<f32>;
            @group(0) @binding(2) var<storage, read> baseline: array<f32>;
            @group(0) @binding(3) var<storage, read_write> evidence: array<f32>;
            @compute @workgroup_size(1) fn main() {
              var liquid_error = 0.0; var other_error = 0.0;
              var scattering = 0.0; var liquid_max = 0.0;
              for (var i = 0u; i < 512u; i++) {
                liquid_error = max(liquid_error, abs(actual[i] - residual[i]) / max(1.0, abs(residual[i])));
                other_error = max(other_error, abs(actual[i + 512u] - baseline[i + 512u]));
                other_error = max(other_error, abs(actual[i + 1024u] - baseline[i + 1024u]));
              }
              for (var c = 0u; c < 64u; c++) {
                scattering += actual[1536u + c * 8u + 5u];
                liquid_max = max(liquid_max, actual[c * 8u]);
              }
              evidence[0] = liquid_error; evidence[1] = other_error;
              evidence[2] = scattering; evidence[3] = liquid_max;
            }` })
        }
      });
      const evidence = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      const readback = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      const cases = [];
      try {
        for (const mixed of [false, true]) {
          for (const smear of [0, 0.01]) {
            for (const mass of [0, 2, mixed ? 5 : 10]) {
              const rows = new Float32Array(2 * render.SPH_GPU_RENDER_ROW_FLOATS);
              const moments = new Float32Array(2 * abi.SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS);
              for (let i = 0; i < 2; i++) {
                rows.set([0.25, 0.25, 0.25, 10, materialId, 2, 300, 1000,
                  1, mixed ? 0.25 : 0, 1, 0, 1, 0.1, 1, 0,
                  mixed ? 0.25 : 0, i ? 1 : -1, 0, 0], i * render.SPH_GPU_RENDER_ROW_FLOATS);
                moments.set([materialId, 2, opticalStateId,
                  abi.SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready, mass, mass * 0.125, 0, 0],
                i * abi.SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS);
              }
              const residualRows = rows.slice();
              for (let i = 0; i < 2; i++) residualRows[i * render.SPH_GPU_RENDER_ROW_FLOATS + 9] += mass / 10;
              const options = { device, surfaceTable, fieldPadding: 0, refEdgeM: 1,
                renderSmearDtS: smear, readbackMode: 'no-full-readback', retainFieldRowsBuffer: true };
              const fields = [];
              try {
                fields.push(await render.buildSphRenderFieldWebGpu({ ...options, renderRows: rows, dispersedMediumOpticsRows: moments }));
                fields.push(await render.buildSphRenderFieldWebGpu({ ...options, renderRows: residualRows }));
                fields.push(await render.buildSphRenderFieldWebGpu({ ...options, renderRows: rows }));
                const encoder = device.createCommandEncoder();
                const pass = encoder.beginComputePass();
                pass.setPipeline(reduction);
                pass.setBindGroup(0, device.createBindGroup({
                  layout: reduction.getBindGroupLayout(0),
                  entries: [...fields.map((field, binding) => ({ binding, resource: { buffer: field.fieldRowsBuffer } })),
                    { binding: 3, resource: { buffer: evidence } }]
                }));
                pass.dispatchWorkgroups(1); pass.end();
                encoder.copyBufferToBuffer(evidence, 0, readback, 0, 16);
                device.queue.submit([encoder.finish()]);
                await readback.mapAsync(GPUMapMode.READ);
                const values = Array.from(new Float32Array(readback.getMappedRange()));
                readback.unmap();
                cases.push({ mixed, smear, mass, values,
                  fullReadback: fields.some((field) => field.fullReadbackPerformed) });
              } finally {
                for (const field of fields) field.destroyRenderFieldBuffers({ releaseLeases: true });
              }
            }
          }
        }
        await device.queue.onSubmittedWorkDone();
        const validationError = await device.popErrorScope();
        return { status: 'completed', cases, errors,
          validationError: validationError?.message || null, readbackBytes: cases.length * 16 };
      } finally { evidence.destroy(); readback.destroy(); device.destroy(); }
    });
  } finally { await browser.close(); }
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.errors, []);
  assert.equal(result.validationError, null);
  assert.equal(result.cases.length, 12);
  assert.equal(result.readbackBytes, 192);
  for (const entry of result.cases) {
    assert.equal(entry.fullReadback, false);
    assert.ok(entry.values.every(Number.isFinite), JSON.stringify(entry));
    assert.ok(entry.values[0] < 1e-5, JSON.stringify(entry));
    assert.equal(entry.values[1], 0, 'other phases unchanged');
    assert.equal(entry.values[2], 2 * entry.mass * 0.125 * 16, 'conserved scattering');
    if (entry.mass === (entry.mixed ? 5 : 10)) assert.equal(entry.values[3], 0, 'no bulk duplicate');
  }
});
