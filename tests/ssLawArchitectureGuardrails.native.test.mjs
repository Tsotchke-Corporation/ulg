import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_ELEMENTS_LAB_BASE_URL || 'https://127.0.0.1:5173/';

test('native Vulkan executes generated ABI lane accessors, paired RepresentedVolume WGSL, Law-Descriptor BGL & GpuResourceLeaseScope', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 to run on native Vulkan WebGPU',
  timeout: 120_000
}, async (t) => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const url = new URL('/__ss_law_guardrails_test__', BASE_URL).href;
    await page.route(url, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>SS Law Guardrails</title>' }));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    result = await page.evaluate(async () => {
      const mod = await import('/tests/fixtures/ssLawArchitectureGuardrailsNative.js');
      return mod.runSsLawGuardrailsNative();
    });
  } finally {
    await browser.close();
  }

  if (result.status === 'unsupported') return;
  console.log('[ss-law-guardrails]', JSON.stringify(result));
  assert.deepEqual(result.compileErrors, []);
  assert.equal(result.composedVariantCount, 14);
  assert.deepEqual(result.composedVariantErrors, []);
  assert.ok(result.manifestCount >= 21, `expected >= 21 WGSL variant manifests on device, got ${result.manifestCount}`);
  assert.equal(result.validationError, null, result.validationError);
  assert.deepEqual(result.uncapturedErrors, []);
  assert.equal(result.leaseSnapshot.live, 0);
  assert.equal(result.leaseSnapshot.released, 6);

  // Source RepresentedVolume read by generated WGSL accessors: V0=0.008, J=1.0, Vcur=0.008, valid=1
  assert.ok(Math.abs(result.gpuSourceVolume[0] - 0.008) < 1e-6);
  assert.ok(Math.abs(result.gpuSourceVolume[1] - 1.0) < 1e-6);
  assert.ok(Math.abs(result.gpuSourceVolume[2] - 0.008) < 1e-6);
  assert.equal(result.gpuSourceVolume[3], 1);

  // Retargeted RepresentedVolume matches host constructor to f32 precision and preserves currentVolume=0.008!
  assert.ok(Math.abs(result.gpuRetargetedVolumeAndVisc[0] - result.hostExpectedRetargeted[0]) < 1e-4);
  assert.ok(Math.abs(result.gpuRetargetedVolumeAndVisc[1] - result.hostExpectedRetargeted[1]) < 1e-6);
  assert.ok(Math.abs(result.gpuRetargetedVolumeAndVisc[2] - 0.008) < 1e-6);
  assert.ok(Math.abs(result.gpuRetargetedVolumeAndVisc[3] - 0.001) < 1e-6);
  t.diagnostic('Generated ABI lane accessors, paired RepresentedVolume WGSL, Law-Descriptor BGL, named fragment composer & lease scope verified on Vulkan');
});
