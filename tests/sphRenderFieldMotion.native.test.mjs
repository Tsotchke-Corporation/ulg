import assert from 'node:assert/strict';
import test from 'node:test';

test('native render-field motion preserves scalar/optical output and exact material-domain velocity moments', {
  skip: process.env.ULG_RUN_NATIVE_RENDER_FIELD_MOTION === '1'
    ? false : 'set ULG_RUN_NATIVE_RENDER_FIELD_MOTION=1',
  timeout: 180_000
}, async (t) => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_RENDER_FIELD_MOTION_CHROME || '/usr/bin/google-chrome',
    headless: false,
    args: ['--ozone-platform=wayland', '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist']
  });
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    // Serve modules from the configured HTTPS origin without starting a demo.
    await page.goto(new URL('/package.json', process.env.ULG_RENDER_FIELD_MOTION_BASE_URL
      || 'https://fastbox.tail5c077c.ts.net:5173/').href);
    result = await page.evaluate(async () => {
      const render = await import('/src/runtime/sph/sphRenderGpuKernel.js');
      const optical = await import('/src/runtime/material/opticalGpuBuffers.js');
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const errors = [];
      const owned = [];
      const fields = [];
      device.addEventListener('uncapturederror', (event) => errors.push(event.error.message));
      device.pushErrorScope('validation');
      let scopeOpen = true;
      try {
        const compilationErrors = [];
        for (const code of [render.sphRenderFieldWgsl, render.sphRenderFieldMotionWgsl]) {
          const module = device.createShaderModule({ code });
          compilationErrors.push(...(await module.getCompilationInfo()).messages
            .filter((message) => message.type === 'error').map((message) => message.message));
        }
        if (compilationErrors.length) return { status: 'compile-failed', compilationErrors };
        const specs = [
          ['h2o', 'liquid', 11, 0], ['Au', 'solid', 12, 0],
          ['h2o', 'liquid', 22, 0], ['h2o', 'gas', 11, 0],
          ['h2o', 'liquid', 33, 0], ['h2o', 'gas', 0, 45001],
          ['h2', 'gas', 0, 0], ['h2o', 'liquid', 44, 0]
        ];
        const surfaceTable = render.buildSphRenderFieldSurfaceTable(specs.map(
          ([material, phase, renderDomainId, opticalStateId], index) => ({
            surfaceKey: `native-motion-${index}`, material, phase, renderDomainId,
            opticalStateId, resolution: 8, isolation: 20, subtract: 5,
            radiusNorm: 0.2, colorLinear: [0.2, 0.4, 0.8]
          })
        ));
        const particleSpecs = [
          ['h2o', 'liquid', 11, [2, -3, 0.5], 4.8],
          ['h2o', 'liquid', 11, [2, -3, 0.5], 5.2],
          ['Au', 'solid', 12, [-1, 4, 2], 5],
          ['h2o', 'liquid', 22, [0, 0, 0], 5],
          ['h2o', 'liquid', 44, [2, 0, 0], 5],
          ['h2o', 'liquid', 44, [-2, 0, 0], 5]
        ];
        const renderRows = new Float32Array(particleSpecs.length * render.SPH_GPU_RENDER_ROW_FLOATS);
        particleSpecs.forEach(([material, phase, domain, velocity, x], index) => {
          renderRows.set([
            x, 5, 5, 1,
            optical.stableOpticalMaterialId(material), optical.GPU_PHASE_IDS[phase], 293.15, 1,
            1000, 0, 1, domain,
            0.001, 0.1, 1, 0,
            phase === 'solid' ? 1 : 0, ...velocity
          ], index * render.SPH_GPU_RENDER_ROW_FLOATS);
        });
        const productEventRows = new Float32Array(render.SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
        productEventRows.set([
          5, 5, 5, 0.05,
          optical.stableOpticalMaterialId('h2'), 1, 0, 0,
          1, 25, 1, optical.GPU_PHASE_IDS.gas,
          0, 0.05, 1, 0.002016,
          360, 0.09, 1, 0
        ]);
        const upload = (values) => {
          const buffer = device.createBuffer({ size: values.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
          device.queue.writeBuffer(buffer, 0, values);
          owned.push(buffer);
          return buffer;
        };
        const expected = upload(new Float32Array([
          2, -3, 0.5, 1, -1, 4, 2, 1, 0, 0, 0, 1, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1
        ]));
        // This is a fixed-size invariant reduction, not a readback of render
        // fields or a CPU reference solver. It compares production GPU outputs
        // on the same device and manufactured constant-velocity identities.
        const reducer = device.createShaderModule({ code: `
@group(0) @binding(0) var<storage, read> legacy: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> with_motion: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> motion: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> unsmeared_motion: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> expected: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> evidence: array<atomic<u32>>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= arrayLength(&motion)) { return; }
  let surface = i / 512u;
  let m = motion[i];
  atomicAdd(&evidence[0u], 1u);
  if (any(bitcast<vec4<u32>>(legacy[i * 2u]) != bitcast<vec4<u32>>(with_motion[i * 2u]))
    || any(bitcast<vec4<u32>>(legacy[i * 2u + 1u]) != bitcast<vec4<u32>>(with_motion[i * 2u + 1u]))) {
    atomicAdd(&evidence[1u], 1u);
  }
  if (any(bitcast<vec4<u32>>(m) != bitcast<vec4<u32>>(unsmeared_motion[i]))) {
    atomicAdd(&evidence[2u], 1u);
  }
  if (any(m != m) || any(abs(m) >= vec4<f32>(3.402823e38)) || m.w < 0.0) {
    atomicAdd(&evidence[3u], 1u);
    return;
  }
  if (m.w > 0.0) {
    atomicAdd(&evidence[8u + surface], 1u);
    if (expected[surface].w == 0.0) { atomicAdd(&evidence[4u], 1u); }
    let error = abs(m.xyz / m.w - expected[surface].xyz);
    if (any(error > vec3<f32>(0.00001) * (vec3<f32>(1.0) + abs(expected[surface].xyz)))) {
      atomicAdd(&evidence[5u], 1u);
    }
  } else if (any(m.xyz != vec3<f32>(0.0))) {
    atomicAdd(&evidence[6u], 1u);
  }
  if (surface == 6u && with_motion[i * 2u].x > 0.0) {
    atomicAdd(&evidence[7u], 1u);
  }
}` });
        const reducerErrors = (await reducer.getCompilationInfo()).messages
          .filter((message) => message.type === 'error').map((message) => message.message);
        if (reducerErrors.length) return { status: 'reducer-compile-failed', reducerErrors };
        const pipeline = device.createComputePipeline({ layout: 'auto',
          compute: { module: reducer, entryPoint: 'main' } });
        const samples = [];
        let unsmearedMotion = null;
        for (const renderSmearDtS of [0, 0.1]) {
          const common = {
            device, renderRows, particleCount: particleSpecs.length, surfaceTable,
            productEventRows, productEventCount: 1, refEdgeM: 10, fieldPadding: 0.22,
            renderSmearDtS, readbackMode: 'no-full-readback',
            retainFieldRowsBuffer: true, waitForQueueCompletion: false
          };
          const legacy = await render.buildSphRenderFieldWebGpu(common);
          fields.push(legacy);
          const withMotion = await render.buildSphRenderFieldWebGpu({
            ...common, retainMotionFieldBuffer: true
          });
          fields.push(withMotion);
          unsmearedMotion ||= withMotion.motionField.buffer;
          const evidence = device.createBuffer({ size: 64,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
          const readback = device.createBuffer({ size: 64,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          owned.push(evidence, readback);
          const inputs = [legacy.fieldRowsBuffer, withMotion.fieldRowsBuffer,
            withMotion.motionField.buffer, unsmearedMotion, expected, evidence];
          const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
            entries: inputs.map((buffer, binding) => ({ binding, resource: { buffer } })) });
          const encoder = device.createCommandEncoder();
          const pass = encoder.beginComputePass();
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, group);
          pass.dispatchWorkgroups(Math.ceil(surfaceTable.totalFieldCells / 64));
          pass.end();
          encoder.copyBufferToBuffer(evidence, 0, readback, 0, 64);
          device.queue.submit([encoder.finish()]);
          await readback.mapAsync(GPUMapMode.READ);
          samples.push({ renderSmearDtS,
            evidence: Array.from(new Uint32Array(readback.getMappedRange())) });
          readback.unmap();
        }
        const scopeError = await device.popErrorScope();
        scopeOpen = false;
        if (scopeError) errors.push(scopeError.message);
        return { status: 'executed', samples, errors, mappedBytesPerCase: 64,
          totalFieldCells: surfaceTable.totalFieldCells };
      } finally {
        if (scopeOpen) await device.popErrorScope();
        for (const field of fields) field.destroyRenderFieldBuffers?.({ force: true, releaseLeases: true });
        for (const buffer of owned) buffer.destroy();
        device.destroy();
      }
    });
  } finally { await browser.close(); }
  assert.equal(result.status, 'executed', JSON.stringify(result));
  assert.deepEqual(result.errors, []);
  assert.equal(result.samples.length, 2);
  for (const sample of result.samples) {
    const words = sample.evidence;
    assert.equal(words[0], result.totalFieldCells);
    assert.deepEqual(words.slice(1, 7), [0, 0, 0, 0, 0, 0], JSON.stringify(sample));
    assert.ok(words[7] > 0, 'product-event-only geometry must actually be present');
    for (const surface of [0, 1, 2, 7]) assert.ok(words[8 + surface] > 0, `surface ${surface}`);
    for (const surface of [3, 4, 5, 6]) assert.equal(words[8 + surface], 0, `surface ${surface}`);
  }
  t.diagnostic(JSON.stringify({ cases: result.samples.length,
    mappedBytesPerCase: result.mappedBytesPerCase, totalFieldCells: result.totalFieldCells }));
});
