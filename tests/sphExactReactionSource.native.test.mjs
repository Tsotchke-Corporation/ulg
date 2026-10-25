import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const enabled = process.env.ULG_RUN_NATIVE_EXACT_REACTION_SOURCE === '1';
const baseUrl = process.env.ULG_EXACT_REACTION_SOURCE_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/';
const evidencePath = process.env.ULG_EXACT_REACTION_SOURCE_EVIDENCE;
const manifestPath = process.env.ULG_EXACT_REACTION_SOURCE_MANIFEST;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('genuine canonical thermal/mechanics sources drive exact reaction preparation on native WebGPU', {
  skip: !enabled && 'set ULG_RUN_NATIVE_EXACT_REACTION_SOURCE=1 for owned desktop WebGPU', timeout: 300000
}, async () => {
  assert.ok(evidencePath && manifestPath, 'native proof requires explicit evidence and frozen full source manifest');
  const manifest = (await readFile(manifestPath, 'utf8')).trim().split('\n').map(line => {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    assert.ok(match, 'invalid source manifest'); return { sha256: match[1], path: match[2] };
  });
  const verify = async () => {
    for (const source of manifest) assert.equal(hash(await readFile(source.path)), source.sha256, source.path);
  };
  await verify();
  const evidence = { schema: 'ulg.native-exact-reaction-source.v1', started: new Date().toISOString(),
    sources: manifest, headed: true, physicalPublicationAdmitted: false, fullG2Acceptance: false, errors: [] };
  let browser, watchdog, failure;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    // The three arithmetic widths alone take about 133 seconds with the new
    // caloric cases. Allow the twelve genuine source chains their own run time.
    watchdog = setTimeout(() => { failure ??= new Error('Owned exact reaction source browser timeout'); void browser.close(); }, 240000);
    const page = await browser.newPage();
    page.on('pageerror', error => evidence.errors.push(String(error)));
    evidence.console = []; page.on('console', message => {
      const text = message.text(); evidence.console.push({ type: message.type(), text });
      if (message.type() === 'log' && /^exact-.*-progress /.test(text)) console.log(text);
    });
    evidence.setupRetries = [];
    const navigate = async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          await page.goto(new URL('package.json', baseUrl).href, { waitUntil: 'networkidle', timeout: 60000 });
          return;
        } catch (error) {
          if (attempt >= 2 || !/ERR_CERT_VERIFIER_CHANGED|interrupted by another navigation/.test(String(error))) throw error;
          evidence.setupRetries.push(String(error));
        }
      }
    };
    await navigate();
    // Warm the full production import graph before the GPU run; a Vite module
    // discovery reload cannot be counted as an executed numerical experiment.
    for (let attempt = 0; ; attempt++) {
      try {
        await page.evaluate(async () => {
          const old = await import('/tests/fixtures/sphExactMassContinuationNative.js');
          await old.preloadExactMassContinuationNative();
          await import('/tests/fixtures/sphExactReactionSourceNative.js');
          await import('/tests/fixtures/sphExactReactionKineticCapNative.js');
          await import('/tests/fixtures/sphExactExtensiveNative.js');
          await import('/tests/fixtures/sphExactCaloricNative.js');
          await import('/tests/fixtures/sphExactProductEnergyNative.js');
        });
        break;
      } catch (error) {
        if (attempt > 0 || !/Execution context was destroyed|Failed to fetch/.test(String(error))) throw error;
        await navigate();
      }
    }
    evidence.result = await page.evaluate(async () => {
      const source = await import('/tests/fixtures/sphExactReactionSourceNative.js');
      const kinetics = await import('/tests/fixtures/sphExactReactionKineticCapNative.js');
      const extensives = await import('/tests/fixtures/sphExactExtensiveNative.js');
      const caloric = await import('/tests/fixtures/sphExactCaloricNative.js');
      const productEnergy = await import('/tests/fixtures/sphExactProductEnergyNative.js');
      const transformed = await (await fetch('/src/runtime/sph/sphExactMassWgsl.js')).text();
      const formatUrl = [...transformed.matchAll(/from\s+['"]([^'"]+)['"]/g)]
        .map(match => match[1]).find(path => path.split('?')[0].endsWith('/sphExactMassInventory.js'));
      if (!formatUrl) throw new Error('Missing original exact format module');
      const { createSphExactMassFormat } = await import(/* @vite-ignore */ formatUrl);
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return { status: 'no-adapter' };
      const device = await adapter.requestDevice({ requiredLimits: {
        maxStorageBuffersPerShaderStage: Math.min(adapter.limits.maxStorageBuffersPerShaderStage, 16)
      } });
      const errors = []; device.addEventListener('uncapturederror', event => errors.push(event.error.message));
      device.pushErrorScope('validation');
      const result = { status: 'running', adapter: { vendor: adapter.info.vendor, architecture: adapter.info.architecture },
        kinetics: [], extensives: [], caloric: [], productEnergy: [], sources: [], errors, timeline: [] };
      void device.lost.then(info => { result.deviceLost = { reason: info.reason, message: info.message }; });
      try {
        for (const wordCount of [1, 9, 66]) {
          const format = createSphExactMassFormat({ wordCount, quantumExponent: wordCount === 1 ? 0 : wordCount === 66 ? -1074 : -149 });
          result.kinetics.push(await kinetics.runExactReactionKineticCapNative(device, format));
          result.extensives.push(await extensives.runExactExtensiveNative(device, format, {
            onProgress: event => { result.timeline.push(event); console.log('exact-extensive-progress', JSON.stringify(event)); }
          }));
          result.caloric.push(await caloric.runExactCaloricNative(device, format, {
            onProgress: event => { result.timeline.push(event); console.log('exact-caloric-progress', JSON.stringify(event)); }
          }));
          result.productEnergy.push(await productEnergy.runExactProductEnergyNative(device, format, {
            onProgress: event => { result.timeline.push(event); console.log('exact-product-energy-progress', JSON.stringify(event)); }
          }));
        }
        const velocities = [[.25, -.5, .125], [-.375, .25, -.125]];
        for (const options of [{}, { reverse: true }, { dtSeconds: .000000001 }, { wordCount: 66 },
          { velocities, expectedCaloricError: 4194304 },
          { wordCount: 66, reverse: true, velocities, expectedCaloricError: 4194304 },
          { velocities, internalPressureScale: 0 },
          { wordCount: 66, reverse: true, velocities, internalPressureScale: 0 },
          { reverse: true, velocities, internalPressureScale: 0, fixtureOptions: { referenceEnthalpies: { h2: 450003, o2: -949997 } } },
          { velocities, internalPressureScale: 0, fixtureOptions: { reactionInternalEnergyChangeJPerMolExtent: 1234.5 } },
          { wordCount: 66, reverse: true, velocities, internalPressureScale: 0, fixtureOptions: { reactionInternalEnergyChangeJPerMolExtent: -4321.25 } },
          { fixtureOptions: { reactionInternalEnergyChangeJPerMolExtent: 1e9 }, expectedCaloricError: 8388608 }]) {
          result.sources.push(await source.runExactReactionSourceNative(device, { ...options,
            onProgress: event => { result.timeline.push(event); console.log('exact-source-progress', JSON.stringify(event)); } }));
        }
        await device.queue.onSubmittedWorkDone();
        const validation = await device.popErrorScope(); if (validation) errors.push(validation.message);
        result.status = 'completed';
      } catch (error) { result.status = 'failed'; result.failure = String(error.stack ?? error); }
      finally { device.destroy(); }
      return result;
    });
    assert.equal(evidence.result.status, 'completed', JSON.stringify(evidence.result));
    assert.deepEqual(evidence.result.errors, []);
    assert.equal(evidence.result.kinetics.length, 3);
    for (const result of evidence.result.kinetics) assert.equal(result.pass, true, JSON.stringify(result));
    assert.equal(evidence.result.extensives.length, 3);
    for (const result of evidence.result.extensives) assert.equal(result.pass, true, JSON.stringify(result));
    assert.equal(evidence.result.caloric.length, 3);
    for (const result of evidence.result.caloric) assert.equal(result.pass, true, JSON.stringify(result));
    assert.equal(evidence.result.productEnergy.length, 3);
    for (const result of evidence.result.productEnergy) assert.equal(result.pass, true, JSON.stringify(result));
    assert.equal(evidence.result.sources.length, 12);
    for (const result of evidence.result.sources) {
      assert.equal(result.pass, true, JSON.stringify(result));
      assert.equal(result.sourceUnchanged, true);
      assert.equal(result.physicalPublicationAdmitted, false);
      assert.equal(result.g2pInternalPressureScale, result.internalPressureScale,
        'the genuine G2P producer records the requested pressure scale');
      const relaxed = [0, 1].every(row => {
        const m = result.mechanics.slice(row * 32, row * 32 + 20);
        return m.every((value, index) => index === 19 ? value > 0 && Number.isFinite(value)
          : value === ([0, 4, 8, 18].includes(index) ? 1 : 0));
      });
      assert.equal(relaxed, result.expectedCaloricError !== 4194304,
        'actual mechanics distinguish accepted relaxed sources from retained affine/deformation rejection');
      if (result.velocities.some(vector => vector.some(value => value !== 0))) {
        assert.ok(result.rows.some(row => row.extensives.nonzeroMomentumResidual), 'moving sources exercise retained low momentum');
      }
      if (result.fixtureOptions.referenceEnthalpies) {
        assert.deepEqual(result.rows[0].extensives.referenceBits,
          Array.from(new Uint32Array(new Float32Array([450000, -950000]).buffer)),
          'the reversed source case really uses distinct positive/negative reference energies');
      }
    }
    assert.ok(evidence.result.sources.some(result => result.rows.some(row => row.caloric.nonzeroResidual)),
      'accepted graph states retain a nonzero exact caloric endpoint remainder');
    assert.ok(evidence.result.sources.some(result => result.rows.some(row => row.packet.nonzeroComKineticCorrection)),
      'real moving sources exercise the stored-velocity kinetic correction');
    assert.ok(evidence.result.sources.some(result => result.rows.some(row => row.packet.hasNonzeroSpeciesResidual)),
      'actual selected allocations retain nonzero chemical residuals instead of nominal-extent zeroes');
    assert.deepEqual(evidence.errors, []);
  } catch (error) { failure ??= error; evidence.failure = String(error.stack ?? error); }
  finally {
    clearTimeout(watchdog); if (browser) await browser.close(); evidence.browserClosed = true;
    try { await verify(); evidence.sourceUnchanged = true; } catch (error) { failure ??= error; evidence.sourceUnchanged = false; }
    evidence.finished = new Date().toISOString(); evidence.pass = !failure;
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  }
  if (failure) throw failure;
});
