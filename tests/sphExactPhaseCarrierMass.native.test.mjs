import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';

test('native phase packet allocation preserves every mass limb and rolls back invalid lineages', {
  skip: process.env.ULG_RUN_NATIVE_PHASE_MASS !== '1', timeout: 240_000
}, async () => {
  const manifestPath = process.env.ULG_PHASE_MASS_SOURCE_MANIFEST;
  const evidencePath = process.env.ULG_PHASE_MASS_EVIDENCE;
  assert.ok(isAbsolute(manifestPath || '') && isAbsolute(evidencePath || ''));
  const manifest = await readFile(manifestPath, 'utf8');
  const hash = value => createHash('sha256').update(value).digest('hex');
  const sources = manifest.trim().split('\n').map(line => {
    const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line); assert.ok(match, line);
    return { hash: match[1], path: resolve(match[2]) };
  });
  for (const path of ['tests/sphExactPhaseCarrierMass.native.test.mjs',
    'tests/fixtures/sphExactPhaseCarrierMassNative.js', 'src/runtime/sph/sphExactPhaseCarrierMassGpu.js',
    'src/runtime/sph/sphExactPhaseCarrierMassWgsl.js', 'src/runtime/sph/sphExactMassWgsl.js']) {
    assert.ok(sources.some(source => source.path === resolve(path)), path);
  }
  const verify = async () => {
    assert.equal(await readFile(manifestPath, 'utf8'), manifest);
    for (const source of sources) assert.equal(hash(await readFile(source.path)), source.hash, source.path);
  };
  await verify();
  const baseUrl = process.env.ULG_PHASE_MASS_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/';
  assert.equal(new URL(baseUrl).protocol, 'https:');
  const evidence = { schema: 'peercompute.ulg.native-exact-phase-mass.v1', started: new Date().toISOString(),
    headed: true, fullG2Acceptance: false, momentumEnergyTransferValidated: false,
    sourceManifest: { path: manifestPath, sha256: hash(manifest) }, results: [] };
  let browser, watchdog;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    const owned = browser;
    watchdog = setTimeout(() => { void owned.close().catch(() => {}); }, 210_000);
    const page = await browser.newPage({ ignoreHTTPSErrors: false });
    await page.route('**/__g2-native-phase', route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><title>Owned G2 phase mass check</title><p>Exact phase-carrier mass conformance</p>' }));
    await page.goto(new URL('/__g2-native-phase', baseUrl).href);
    for (const wordCount of [1, 9, 66]) {
      const result = await page.evaluate(async wordCount => {
        const { runPhaseMassFormatNative } = await import('/tests/fixtures/sphExactPhaseCarrierMassNative.js');
        const adapter = await navigator.gpu.requestAdapter(); if (!adapter) throw Error('No native WebGPU adapter');
        const device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: 6 } });
        const errors = []; device.addEventListener('uncapturederror', event => errors.push(event.error.message));
        try { return { wordCount, vendor: adapter.info.vendor, cases: await runPhaseMassFormatNative(device,
          { wordCount, quantumExponent: wordCount === 66 ? -1074 : -149 }), errors }; }
        catch (error) { throw Error(String(error) + '\n' + errors.join('\n')); }
        finally { device.destroy(); }
      }, wordCount);
      evidence.results.push(result);
      assert.deepEqual(result.errors, []);
      assert.equal(result.cases.length, 17);
      for (const row of result.cases) { assert.equal(row.matches, true, JSON.stringify(row)); assert.equal(row.massConserved, true, row.name); }
    }
    evidence.passed = true;
  } catch (error) { evidence.failure = error.stack ?? String(error); throw error; }
  finally {
    clearTimeout(watchdog); await browser?.close(); evidence.ownedBrowserClosed = true;
    await verify(); evidence.finished = new Date().toISOString();
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  }
});
