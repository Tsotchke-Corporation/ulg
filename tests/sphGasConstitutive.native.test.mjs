import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('native shared gas initialization, retained refresh and atomic rejection use actual T', {
  skip: process.env.ULG_RUN_NATIVE_GAS_CONSTITUTIVE !== '1' && 'set ULG_RUN_NATIVE_GAS_CONSTITUTIVE=1 after source freeze',
  timeout: 180_000
}, async () => {
  const output = process.env.ULG_GAS_CONSTITUTIVE_EVIDENCE;
  const manifestPath = process.env.ULG_GAS_CONSTITUTIVE_SOURCE_MANIFEST;
  assert.ok(output && isAbsolute(output) && manifestPath && isAbsolute(manifestPath));
  const manifest = await readFile(manifestPath, 'utf8');
  const rows = manifest.trim().split('\n').map(line => {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line); assert.ok(match);
    return { hash: match[1], path: match[2] };
  });
  assert.ok(rows.length >= 550, 'full runtime/test source freeze');
  const check = async () => {
    assert.equal(await readFile(manifestPath, 'utf8'), manifest);
    for (const row of rows) assert.equal(sha(await readFile(row.path)), row.hash, row.path);
  };
  await check();
  const evidence = { schema: 'ulg.native-gas-constitutive.v1', started: new Date().toISOString(),
    sourceManifest: { path: manifestPath, hash: sha(manifest) }, headed: true,
    scientificValidation: false, plumeValidation: false, errors: [] };
  let browser, watchdog, failure;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    watchdog = setTimeout(() => { failure ??= new Error('owned native browser timeout'); void browser.close(); }, 150_000);
    const page = await browser.newPage({ ignoreHTTPSErrors: false });
    page.on('pageerror', e => evidence.errors.push(String(e)));
    await page.goto('https://fastbox.tail5c077c.ts.net:5173/package.json');
    evidence.result = await page.evaluate(async () => {
      const dependency = async (url, name) => {
        const text = await (await fetch(url)).text();
        const path = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map(m => m[1])
          .find(path => path.split('?')[0].endsWith('/' + name));
        if (!path) throw new Error('missing transformed import ' + name);
        return path;
      };
      // Preserve Vite's private module identities, including after prior HMR.
      await import('/src/runtime/sph/sphThermalGpuKernel.js');
      const refreshUrl = '/src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
      const [refresh, buffers, mechanics, materials, energy, states, limits] = await Promise.all([
        import(refreshUrl), import(await dependency(refreshUrl, 'sphGpuBuffers.js')),
        import(await dependency(refreshUrl, 'sphMechanicsMaterialTable.js')),
        import('/src/runtime/material/materialClosures.js'), import('/src/runtime/material/thermoState.js'),
        import('/src/runtime/sph/sphState.js'), import('/src/runtime/webgpuDeviceLimits.js')
      ]);
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('No native adapter');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter) || {});
      const errors = [], cases = [];
      device.addEventListener('uncapturederror', e => errors.push(e.error.message));
      for (const type of ['validation', 'internal', 'out-of-memory']) device.pushErrorScope(type);
      const materialProperties = { h2o: materials.createReferenceMaterialClosures().h2o.properties };
      const properties = materialProperties.h2o;
      const gas = properties.phases.find(p => p.name === 'gas');
      let fatalError = null;
      try {
        for (const config of [{}, { soundSpeedScale: .25 }, { cflMaxSoundSpeedMPerS: 600, soundSpeedScale: .01 },
          { cflMaxSoundSpeedMPerS: 20, minGasSoundSpeedMPerS: 40 }]) {
          const options = { materialProperties, ...config };
          const pack = temperatures => {
            const state = states.createSphState({ smoothingLengthM: .1, particles: temperatures.map((temperature, i) => ({
              material: 'h2o', massKg: .001, x: [.2 + i * .1, .2, .2], v: [0, 0, 0],
              specificInternalEnergyJPerKg: energy.specificInternalEnergyJPerKg(properties, temperature)
            })) });
            return { sph: buffers.buildSphGpuParticleBuffers(state, options), mls: buffers.buildMlsMpmGpuParticleBuffers(state, options) };
          };
          const cold = pack([400, 800]);
          const table = mechanics.buildMlsMpmMechanicsMaterialTable(materialProperties, config);
          const upload = buffers.uploadSphGpuParticleBuffers(device, cold.sph);
          const mlsUpload = buffers.uploadMlsMpmGpuParticleBuffers(device, cold.mls);
          const outputs = [], runs = [];
          const entry = { config, initialThermo: Array.from(cold.sph.thermo), initialMechanics: Array.from(cold.mls.mechanics), runs };
          try {
            let sourceMechanicsBuffer = mlsUpload.mechanicsBuffer;
            for (const temperatures of [[400, 800], [800, 1600]]) {
              // Manufactured, calorically consistent heating input from actual
              // shared packers; this test does not claim to solve heat transfer.
              const hot = pack(temperatures);
              device.queue.writeBuffer(upload.stateBuffer, 0, hot.sph.state);
              device.queue.writeBuffer(upload.thermoBuffer, 0, hot.sph.thermo);
              const result = await refresh.runMlsMpmMechanicsRefreshWebGpu({ device,
                sphParticleState: cold.sph, mlsMpmParticleState: cold.mls, mechanicsMaterialTable: table,
                sourceStateBuffer: upload.stateBuffer, sourceThermoBuffer: upload.thermoBuffer, sourceMechanicsBuffer,
                retainOutputParticleBuffers: true, readbackMode: 'full-parity-readback' });
              outputs.push(result);
              runs.push({ thermo: Array.from(hot.sph.thermo), mechanics: Array.from(result.mechanics),
                status: result.authorityValidationStatus, failures: result.authorityValidationFailureCount });
              sourceMechanicsBuffer = result.mechanicsBuffer;
            }
            const bad = pack([800, 1600]); bad.sph.thermo[14] = 0;
            device.queue.writeBuffer(upload.thermoBuffer, 0, bad.sph.thermo);
            const rejected = await refresh.runMlsMpmMechanicsRefreshWebGpu({ device,
              sphParticleState: cold.sph, mlsMpmParticleState: cold.mls, mechanicsMaterialTable: table,
              sourceStateBuffer: upload.stateBuffer, sourceThermoBuffer: upload.thermoBuffer, sourceMechanicsBuffer,
              retainOutputParticleBuffers: true, readbackMode: 'full-parity-readback' });
            outputs.push(rejected);
            entry.rejected = { mechanics: Array.from(rejected.mechanics), failures: rejected.authorityValidationFailureCount };
          } finally {
            await device.queue.onSubmittedWorkDone();
            for (const result of outputs.reverse()) result.destroyOutputParticleBuffers?.();
            buffers.destroyMlsMpmGpuParticleBuffers(mlsUpload); buffers.destroySphGpuParticleBuffers(upload);
          }
          cases.push(entry);
        }
      } catch (error) { fatalError = String(error.stack || error); }
      finally {
        await device.queue.onSubmittedWorkDone();
        for (const type of ['out-of-memory', 'internal', 'validation']) {
          const error = await device.popErrorScope(); if (error) errors.push(type + ': ' + error.message);
        }
        device.destroy();
      }
      return { cases, errors, fatalError, gasCp: gas.cpJPerKgK, molarMass: properties.molarMassKgPerMol,
        adapter: { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture, device: adapter.info?.device } };
    });
  } catch (error) { failure ??= error; evidence.error = String(error.stack || error); }
  finally {
    clearTimeout(watchdog);
    if (browser) { await browser.close(); evidence.ownedBrowserClosed = !browser.isConnected(); }
    try { await check(); evidence.sourceFreezeUnchanged = true; } catch (error) { failure ??= error; }
    evidence.finished = new Date().toISOString();
    await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (failure) throw failure;
  assert.equal(evidence.ownedBrowserClosed, true);
  assert.deepEqual(evidence.errors, []);
  const { result } = evidence;
  assert.deepEqual(result.errors, []); assert.equal(result.fatalError, null);
  assert.equal(result.cases.length, 4);
  const rs = 8.314462618 / result.molarMass;
  const gamma = result.gasCp / (result.gasCp - rs);
  for (const entry of result.cases) {
    for (const row of [{ thermo: entry.initialThermo, mechanics: entry.initialMechanics }, ...entry.runs]) {
      for (let i = 0; i < 2; i++) {
        assert.equal(row.thermo[i * 12 + 1], 3, 'actual gas carrier');
        const real = Math.sqrt(gamma * rs * row.thermo[i * 12 + 2]);
        const expected = Math.max(entry.config.cflMaxSoundSpeedMPerS > 0
          ? Math.min(real, entry.config.cflMaxSoundSpeedMPerS) : real * (entry.config.soundSpeedScale ?? 1),
        entry.config.minGasSoundSpeedMPerS ?? 40);
        assert.ok(Math.abs(row.mechanics[i * 32 + 25] - expected) <= expected * 3e-7,
          `actual GPU c=${row.mechanics[i * 32 + 25]}, independent c(T)=${expected}`);
        for (const lane of [26, 31]) assert.equal(row.mechanics[i * 32 + lane], entry.initialMechanics[i * 32 + lane]);
        // Existing refresh recomputes V0=m/rho and J=(J*V0)/newV0 using f32
        // division. Permit four f32 rounding units, not byte identity with a
        // JS-packed division. The rejection check below remains byte-exact.
        for (const lane of [18, 19]) {
          const initial = entry.initialMechanics[i * 32 + lane];
          assert.ok(Math.abs(row.mechanics[i * 32 + lane] - initial) <= Math.abs(initial) * 4 * 2 ** -23);
        }
      }
    }
    for (const run of entry.runs) { assert.equal(run.failures, 0); assert.equal(run.status, 'mechanics-refresh-authority-accepted'); }
    assert.equal(entry.rejected.failures, 1);
    assert.deepEqual(entry.rejected.mechanics, entry.runs[1].mechanics, 'whole output rollback after invalid second gas');
  }
});
