import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_TRIAD === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test(
  'Triad deepening (Eshkol AD Helmholtz/Solid/Transport + MoonLab cold-miss synthesis + PeerCompute A6 adoption + G6 Debye GPU fit) executes accurately on real Vulkan WebGPU',
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
      const page = await browser.newPage({ ignoreHTTPSErrors: true });
      const base = 'https://127.0.0.1:5173/';
      await page.route((u) => u.href === base, (route) => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Triad Closure Deepening GPU</title>'
      }));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      result = await page.evaluate(async () => {
        const { runTriadClosureDeepeningNativeProof } = await import('/tests/fixtures/triadClosureDeepeningNative.js');
        return runTriadClosureDeepeningNativeProof();
      });
    } finally {
      await browser.close();
    }

    console.log('Triad Closure Deepening GPU:', JSON.stringify(result));
    assert.equal(result.validation, null);
    assert.deepEqual(result.errors, []);
    assert.equal(result.adoptedCount, 1);
    assert.equal(result.laneOrdinal, 1);
    assert.equal(result.inBoxOk, 1);
    assert.equal(result.outOfBoxOk, 0);
    assert.ok(result.helmholtzRelErr < 1e-4, `helmholtzRelErr=${result.helmholtzRelErr}`);
    assert.ok(result.entropyRelErr < 1e-4, `entropyRelErr=${result.entropyRelErr}`);
    assert.ok(result.pressureRelErr < 1e-4, `pressureRelErr=${result.pressureRelErr}`);
    assert.ok(result.cvRelErr < 1e-3, `cvRelErr=${result.cvRelErr}`);
    assert.ok(result.ktRelErr < 1e-3, `ktRelErr=${result.ktRelErr}`);
    assert.ok(result.solidPressureRelErr < 1e-3, `solidPressureRelErr=${result.solidPressureRelErr}`);
    assert.ok(result.kRelErr < 1e-4, `kRelErr=${result.kRelErr}`);
    assert.ok(result.muRelErr < 1e-4, `muRelErr=${result.muRelErr}`);
    assert.ok(result.dRelErr < 1e-4, `dRelErr=${result.dRelErr}`);
    assert.equal(result.g6DebyeAdopted, true);
    assert.equal(result.g6DebyeHits, 16);
  }
);
