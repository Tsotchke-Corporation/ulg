import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_THERMAL_POTENTIAL === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test(
  'G6 local thermodynamic potential fits solid (Debye multi-sample), liquid, and gas branches on real Vulkan WebGPU with strict phase isolation',
  { skip: !RUN_NATIVE, timeout: 180000 },
  async () => {
    const { chromium } = await import('@playwright/test');
    const wayland = Boolean(process.env.WAYLAND_DISPLAY);
    const browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: !wayland,
      args: [
        '--ignore-certificate-errors',
        '--use-angle=vulkan',
        '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        ...(wayland ? ['--ozone-platform=wayland'] : [])
      ]
    });
    let result;
    try {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const base = 'https://127.0.0.1:5173/';
      await page.route((u) => u.href === base, (route) => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>G6 Multi-Phase GPU</title>'
      }));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      result = await page.evaluate(async () => {
        const { runThermalPotentialMultiPhaseNativeProof } = await import('/tests/fixtures/thermalPotentialMultiPhaseNative.js');
        return runThermalPotentialMultiPhaseNativeProof();
      });
    } finally {
      await browser.close();
    }
    console.log('G6 multi-phase GPU:', JSON.stringify(result));
    assert.equal(result.validation, null);
    assert.deepEqual(result.errors, []);
    assert.equal(result.adopted, true);
    assert.deepEqual(result.before.slice(0, 4), [0, 0, 0, 0]);
    assert.equal(result.after[0], 16, `solid G6 hits=${result.after[0]} (samples=${result.solidSamples})`);
    assert.equal(result.after[1], 16, `liquid G6 hits=${result.after[1]} (samples=${result.liquidSamples})`);
    assert.equal(result.after[2], 16, `gas G6 hits=${result.after[2]} (samples=${result.gasSamples})`);
    assert.equal(result.after[3], 0, 'wrong-phase hits must be zero');
  }
);
