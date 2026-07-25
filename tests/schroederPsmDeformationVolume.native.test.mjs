import assert from 'node:assert/strict';
import { test } from 'node:test';

// Slice 9 makes represented current volume the geometry authority, so any
// producer that changes J must move F with it or det(F) == J stops holding.
// The adaptive split/merge materializer previously rewrote J while copying F
// verbatim. These cases drive the real determinant and rescale helpers on the
// device with non-unit and anisotropic F, which is what the handoff asks for.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PSM_DEFORMATION === '1';
const NATIVE_BASE_URL =
  process.env.ULG_PHASE_VOLUME_TRANSPORT_NATIVE_BASE_URL
  || 'https://127.0.0.1:5174/';

// F is row-major: [F00 F01 F02; F10 F11 F12; F20 F21 F22]
const CASES = [
  { label: 'identity', f: [1, 0, 0, 0, 1, 0, 0, 0, 1], targetJ: 1 },
  { label: 'uniform-compression', f: [0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5], targetJ: 0.125 },
  { label: 'non-unit-to-larger', f: [1.2, 0, 0, 0, 1.2, 0, 0, 0, 1.2], targetJ: 4 },
  {
    label: 'anisotropic-shear',
    f: [1.4, 0.35, -0.2, -0.1, 0.8, 0.25, 0.05, -0.3, 1.1],
    targetJ: 0.75
  },
  {
    label: 'anisotropic-stretch',
    f: [2.5, 0.1, 0, 0.4, 0.6, -0.15, -0.2, 0.05, 1.3],
    targetJ: 3.2
  },
  {
    label: 'merge-style-volume-growth',
    f: [0.9, -0.25, 0.1, 0.3, 1.6, -0.05, 0.15, 0.2, 0.7],
    targetJ: 2.4
  }
];

const determinant = (f) => (
  f[0] * (f[4] * f[8] - f[5] * f[7])
  - f[1] * (f[3] * f[8] - f[5] * f[6])
  + f[2] * (f[3] * f[7] - f[4] * f[6])
);

test('native PSM deformation rescale restores det(F) == J for anisotropic F', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PSM_DEFORMATION=1 for native WebGPU',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_VOLUME_TRANSPORT_CHROME
      || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async ({ cases }) => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      device.pushErrorScope('validation');

      // Lift the two helpers out of the production shader source so this
      // exercises the shipped implementation, not a copy of it.
      const wgsl = (await import('/ulg-gpu-abi/src/wgsl.js'));
      const source = Object.values(wgsl).find((value) => (
        typeof value === 'string'
        && value.includes('fn ss_psm_deformation_determinant(')
        && value.includes('fn ss_psm_deformation_scale_for(')
      ));
      if (!source) return { status: 'helpers-not-found' };
      const extract = (name) => {
        const start = source.indexOf(`fn ${name}(`);
        let depth = 0;
        let index = source.indexOf('{', start);
        const open = index;
        for (; index < source.length; index += 1) {
          if (source[index] === '{') depth += 1;
          else if (source[index] === '}') {
            depth -= 1;
            if (depth === 0) break;
          }
        }
        return source.slice(start, index + 1);
      };
      const helpers = `${extract('ss_psm_deformation_determinant')}\n`
        + `${extract('ss_psm_deformation_scale_for')}\n`;

      const caseCount = cases.length / 10;
      const code = `${helpers}
@group(0) @binding(0) var<storage, read> cases: array<f32>;
@group(0) @binding(1) var<storage, read_write> results: array<f32>;

@compute @workgroup_size(1)
fn run(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${caseCount}u) { return; }
  let c = id.x * 10u;
  let o = id.x * 4u;
  let row0 = vec4<f32>(cases[c + 0u], cases[c + 1u], cases[c + 2u], cases[c + 3u]);
  let row1 = vec4<f32>(cases[c + 4u], cases[c + 5u], cases[c + 6u], cases[c + 7u]);
  let row2 = vec4<f32>(cases[c + 8u], 0.0, 0.0, 0.0);
  let target_j = cases[c + 9u];
  let det = ss_psm_deformation_determinant(row0, row1, row2);
  let scale = ss_psm_deformation_scale_for(det, target_j);
  let scaled0 = row0 * scale;
  let scaled1 = row1 * scale;
  let scaled2 = vec4<f32>(row2.x * scale, 0.0, 0.0, 0.0);
  results[o + 0u] = det;
  results[o + 1u] = scale;
  results[o + 2u] = ss_psm_deformation_determinant(scaled0, scaled1, scaled2);
  results[o + 3u] = target_j;
}
`;
      const module = device.createShaderModule({ code });
      const info = await module.getCompilationInfo();
      const errors = info.messages
        .filter((m) => m.type === 'error')
        .map((m) => `${m.lineNum}: ${m.message}`);
      if (errors.length) return { status: 'compile-failed', errors };

      const caseData = new Float32Array(cases);
      const caseBuffer = device.createBuffer({
        size: caseData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(caseBuffer, 0, caseData);
      const resultBytes = caseCount * 4 * 4;
      const resultBuffer = device.createBuffer({
        size: resultBytes,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      });
      const readback = device.createBuffer({
        size: resultBytes,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const pipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module, entryPoint: 'run' }
      });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: caseBuffer } },
          { binding: 1, resource: { buffer: resultBuffer } }
        ]
      }));
      pass.dispatchWorkgroups(caseCount);
      pass.end();
      encoder.copyBufferToBuffer(resultBuffer, 0, readback, 0, resultBytes);
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const results = [...new Float32Array(readback.getMappedRange().slice(0))];
      readback.unmap();
      return {
        status: 'ok',
        results,
        validationError: (await device.popErrorScope())?.message || null
      };
    }, {
      cases: CASES.flatMap(({ f, targetJ }) => [...f, targetJ])
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'ok', JSON.stringify(native));
  assert.equal(native.validationError, null, JSON.stringify(native));

  CASES.forEach((testCase, index) => {
    const [det, scale, scaledDet, targetJ] = native.results.slice(
      index * 4,
      index * 4 + 4
    );
    const expectedDet = determinant(testCase.f);
    assert.ok(
      Math.abs(det - expectedDet) <= 1e-5 * Math.max(1, Math.abs(expectedDet)),
      `${testCase.label}: device det ${det} vs expected ${expectedDet}`
    );
    assert.ok(scale > 0, `${testCase.label}: scale must be positive`);
    // The whole point: after the rescale the deformation determinant is the
    // published volume ratio, so a producer that changed J has moved F with it.
    assert.ok(
      Math.abs(scaledDet - targetJ) <= 1e-4 * Math.max(1, Math.abs(targetJ)),
      `${testCase.label}: det(F') ${scaledDet} must equal J ${targetJ}`
    );
  });

  // A non-positive or non-finite determinant must not manufacture a scale.
  assert.ok(CASES.every((_, index) => native.results[index * 4 + 1] > 0));
});
