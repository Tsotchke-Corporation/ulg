import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';

const REQUIRED_SOURCES = [
  'tests/sphCondensableParticleInitialization.test.mjs',
  'tests/sphCondensableParticleInitialization.native.test.mjs',
  'tests/fixtures/sphExtendedPhaseCaloric.js',
  'src/runtime/sph/sphState.js',
  'src/runtime/sph/sphGpuBuffers.js',
  'src/runtime/sph/sphCondensableParticleInitialization.js',
  'src/runtime/sph/sphCondensableCaloricTable.js',
  'src/runtime/material/condensableThermodynamics.js',
  'src/runtime/sph/sphThermalGpuKernel.js',
  'src/runtime/sph/sphMechanicsMaterialTable.js',
  'src/runtime/sph/sphMechanicsRefreshGpuKernel.js',
  'ulg-gpu-abi/src/wgsl.js'
];
const sha = (value) => createHash('sha256').update(value).digest('hex');
async function checkManifest(path, previous = null) {
  const text = await readFile(path, 'utf8');
  if (previous != null) assert.equal(text, previous);
  const rows = text.trim().split('\n').map((line) => {
    const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    assert.ok(match, 'sha256sum source manifest required');
    return { hash: match[1], path: match[2] };
  });
  for (const path of REQUIRED_SOURCES) assert.ok(rows.some((row) => resolve(row.path) === resolve(path)), path);
  for (const row of rows) assert.equal(sha(await readFile(resolve(row.path))), row.hash, row.path);
  return { text, rows, hash: sha(text) };
}

test('native cold particle/mechanics packers preserve explicit phase and U through actual thermal/refresh', {
  skip: process.env.ULG_RUN_NATIVE_CONDENSABLE_INITIALIZATION === '1'
    ? false : 'set ULG_RUN_NATIVE_CONDENSABLE_INITIALIZATION=1 after source freeze',
  timeout: 180_000
}, async () => {
  const path = process.env.ULG_CONDENSABLE_INITIALIZATION_EVIDENCE;
  const manifestPath = process.env.ULG_CONDENSABLE_INITIALIZATION_SOURCE_MANIFEST;
  assert.ok(path && isAbsolute(path), 'new absolute evidence path required');
  assert.ok(manifestPath && isAbsolute(manifestPath), 'absolute full source manifest required');
  const manifest = await checkManifest(manifestPath);
  const baseUrl = 'https://fastbox.tail5c077c.ts.net:5173/';
  const evidence = { schema: 'peercompute.ulg.native-condensable-initialization-proof.v1',
    started: new Date().toISOString(), baseUrl, sourceManifest: { path: manifestPath, sha256: manifest.hash },
    headed: true, desktop: 'Wayland', browser: '/usr/bin/google-chrome', ignoreHTTPSErrors: false,
    scientificValidation: false, presetAdmission: false, fullPlumeValidation: false };
  let browser, watchdog, watchdogClose, failure;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan',
        '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    const owned = browser;
    watchdog = setTimeout(() => {
      failure ??= new Error('Owned native browser exceeded 150 second watchdog');
      watchdogClose = owned.close().catch((error) => { evidence.watchdogCloseError = String(error); });
    }, 150_000);
    const page = await browser.newPage({ ignoreHTTPSErrors: false });
    await page.goto(new URL('/package.json', baseUrl).href);
    evidence.observed = await page.evaluate(async ({ sources }) => {
      const servedSources = [];
      for (const source of sources) {
        const raw = (await import('/' + source.path + '?raw')).default;
        if (typeof raw !== 'string') throw new Error('raw source unavailable: ' + source.path);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== source.hash) throw new Error('served source differs: ' + source.path);
        servedSources.push(source);
      }
      const dependency = async (url, file) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('dependency fetch failed: ' + url);
        const code = await response.text();
        const path = [...code.matchAll(/from\s+["']([^"']+)["']/g)]
          .map((match) => match[1]).find((path) => path.split('?')[0].endsWith('/' + file));
        if (!path) throw new Error('missing exact dependency ' + file);
        return new URL(path, new URL(url, location.href)).href;
      };
      const thermalUrl = new URL('/src/runtime/sph/sphThermalGpuKernel.js', location.href).href;
      const bufferUrl = await dependency(thermalUrl, 'sphGpuBuffers.js');
      const initUrl = await dependency(bufferUrl, 'sphCondensableParticleInitialization.js');
      const caloricUrl = await dependency(initUrl, 'sphCondensableCaloricTable.js');
      if (caloricUrl !== await dependency(thermalUrl, 'sphCondensableCaloricTable.js')) {
        throw new Error('thermal and initializer must share the exact model module instance');
      }
      const modelUrl = await dependency(caloricUrl, 'condensableThermodynamics.js');
      const refreshUrl = new URL('/src/runtime/sph/sphMechanicsRefreshGpuKernel.js', location.href).href;
      if (bufferUrl !== await dependency(refreshUrl, 'sphGpuBuffers.js')) throw new Error('buffer module identity mismatch');
      const mechanicsUrl = await dependency(refreshUrl, 'sphMechanicsMaterialTable.js');
      const [thermal, buffers, thermodynamics, refresh, mechanics, stateModule, materials, energy, limits] =
        await Promise.all([import(thermalUrl), import(bufferUrl), import(modelUrl), import(refreshUrl),
          import(mechanicsUrl), import('/src/runtime/sph/sphState.js'),
          import('/src/runtime/material/materialClosures.js'), import('/src/runtime/material/thermoState.js'),
          import('/src/runtime/webgpuDeviceLimits.js')]);
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('native adapter unavailable');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter) || {});
      const errors = [], outputs = [], runs = [], legacyControl = [], extendedUploads = [];
      const extended = { runs: [] };
      let sphUpload, mlsUpload, fatalError = null, initial;
      device.addEventListener('uncapturederror', (event) => errors.push(String(event.error?.message || event.error)));
      for (const kind of ['validation', 'internal', 'out-of-memory']) device.pushErrorScope(kind);
      try {
        // Deliberately manufactured, not a water calibration. All initial
        // particle/mechanics rows below come from the actual shared packers.
        const model = thermodynamics.createCondensableThermodynamics({
          schema: 'peercompute.ulg.condensable-thermodynamics.v1',
          energyBasis: 'specific-enthalpy-at-reference-pressure',
          referenceTemperatureK: 300, referencePressurePa: 3000,
          liquidReferenceEnthalpyJPerKg: -50_000, vaporizationReferenceEnthalpyJPerKg: 200_000,
          liquidCpJPerKgK: 4000, vaporCpJPerKgK: 4000, liquidDensityKgPerM3: 1000,
          molarMassKgPerMol: 8.314462618 / 100, minTemperatureK: 200,
          maxTemperatureK: 450, maxPressurePa: 2_000_000,
          provenance: 'independent synthetic native cold initialization fixture'
        });
        const reference = materials.createReferenceMaterialClosures();
        const materialProperties = { h2o: { ...reference.h2o.properties, molarMassKgPerMol: 8.314462618 / 100,
          phases: reference.h2o.properties.phases.map((phase) => ({ ...phase,
            ...(phase.name === 'liquid' ? { cpJPerKgK: 4000, densityKgPerM3: 1000 } : {}),
            ...(phase.name === 'gas' ? { cpJPerKgK: 4000, densityKgPerM3: 0.1 } : {})
          })) }, fe: reference.fe.properties };
        const options = { materialProperties, condensableThermodynamicsByMaterial: { h2o: model } };
        const explicit = (phaseId, u, x) => ({ material: 'h2o', massKg: 1, x, v: [0.5, -0.25, 0.125],
          specificInternalEnergyJPerKg: u,
          phaseCaloric: { phaseId, phaseFractions: [0, phaseId === 2 ? 1 : 0, phaseId === 3 ? 1 : 0, 0] } });
        const legacyU = energy.specificInternalEnergyJPerKg(reference.fe.properties, 300);
        // Independent legacy-only execution is the compatibility control.
        // Iron's existing sampled Debye graph is not the exact constructor
        // inverse (about .137 K below 300 K at this U). Retain that observation
        // instead of widening a physical-temperature tolerance or dropping Fe.
        const legacyState = stateModule.createSphState({ smoothingLengthM: 1, particles: [
          { material: 'fe', massKg: 1, x: [2, 2, 2], v: [0, 0, 0], specificInternalEnergyJPerKg: legacyU }
        ] });
        const legacyPacked = buffers.buildSphGpuParticleBuffers(legacyState, {
          materialProperties: { fe: reference.fe.properties }
        });
        const legacyTable = thermal.buildSphThermalMaterialTable({ fe: reference.fe.properties });
        for (let i = 4; i < legacyTable.records.length; i += 8) legacyTable.records[i] = 0;
        let legacyPrior = null;
        for (let cycle = 1; cycle <= 2; cycle += 1) {
          const result = await thermal.runSphThermalStepWebGpu({ device, sphParticleState: legacyPacked,
            thermalMaterialTable: legacyTable,
            sourceStateBuffer: legacyPrior?.stateBuffer, sourceThermoBuffer: legacyPrior?.thermoBuffer,
            proposalStateBuffer: legacyPrior?.stateBuffer, proposalThermoBuffer: legacyPrior?.thermoBuffer,
            wallTemperaturesK: { xMin: 298 }, wallLayerM: 1, wallRate: 2600, dtS: 0.1,
            conductionRate: 0, boxDimsM: [4, 4, 4], retainOutputParticleBuffers: true,
            readbackMode: 'full-parity-readback' });
          outputs.push(result);
          legacyControl.push({ cycle, state: Array.from(result.state), thermo: Array.from(result.thermo),
            temperatureDeviationFrom300K: result.thermo[2] - 300 });
          legacyPrior = result;
        }
        const state = stateModule.createSphState({ smoothingLengthM: 1, particles: [
          explicit(2, -138_003, [2, 1.5, 2]),
          explicit(3, 34_200, [0.25, 2, 2]),
          explicit(2, 34_200, [2, 2.5, 2]),
          { material: 'fe', massKg: 1, x: [2, 2, 2], v: [0, 0, 0], specificInternalEnergyJPerKg: legacyU }
        ] });
        const inputBefore = JSON.stringify(state);
        const packed = buffers.buildSphGpuParticleBuffers(state, options);
        const packedMls = buffers.buildMlsMpmGpuParticleBuffers(state, options);
        initial = { state: Array.from(packed.state), thermo: Array.from(packed.thermo),
          mechanics: Array.from(packedMls.mechanics), sourceUnchanged: JSON.stringify(state) === inputBefore,
          sourceKind: 'createSphState -> shared SPH/MLS packers -> actual upload', legacyU: Math.fround(legacyU) };
        const table = thermal.buildSphThermalMaterialTable(materialProperties, options);
        // Controlled manufactured heat experiment, no ambient radiation.
        for (let i = 4; i < table.records.length; i += 8) table.records[i] = 0;
        const mechanicsTable = mechanics.buildMlsMpmMechanicsMaterialTable(materialProperties);
        sphUpload = buffers.uploadSphGpuParticleBuffers(device, packed);
        mlsUpload = buffers.uploadMlsMpmGpuParticleBuffers(device, packedMls);
        let sourceStateBuffer = sphUpload.stateBuffer, sourceThermoBuffer = sphUpload.thermoBuffer;
        let sourceMechanicsBuffer = mlsUpload.mechanicsBuffer;
        for (let cycle = 1; cycle <= 2; cycle += 1) {
          const result = await thermal.runSphThermalStepWebGpu({ device, sphParticleState: packed,
            sphParticleUpload: sphUpload, thermalMaterialTable: table, sourceStateBuffer, sourceThermoBuffer,
            proposalStateBuffer: sourceStateBuffer, proposalThermoBuffer: sourceThermoBuffer,
            wallTemperaturesK: { xMin: 298 }, wallLayerM: 1, wallRate: 2600, dtS: 0.1,
            conductionRate: 0, boxDimsM: [4, 4, 4], retainOutputParticleBuffers: true,
            readbackMode: 'full-parity-readback' });
          outputs.push(result);
          const refreshed = await refresh.runMlsMpmMechanicsRefreshWebGpu({ device,
            sphParticleState: packed, mlsMpmParticleState: packedMls, mechanicsMaterialTable: mechanicsTable,
            sourceStateBuffer: result.stateBuffer, sourceThermoBuffer: result.thermoBuffer, sourceMechanicsBuffer,
            retainOutputParticleBuffers: true, readbackMode: 'full-parity-readback' });
          outputs.push(refreshed);
          runs.push({ cycle, backend: result.backend, state: Array.from(result.state), thermo: Array.from(result.thermo),
            mechanics: Array.from(refreshed.mechanics), refreshStatus: refreshed.authorityValidationStatus,
            refreshFailureCount: refreshed.authorityValidationFailureCount,
            exactPriorGpuBuffersReused: true });
          sourceStateBuffer = result.stateBuffer; sourceThermoBuffer = result.thermoBuffer;
          sourceMechanicsBuffer = refreshed.mechanicsBuffer;
        }
        const { createExtendedPhaseCaloricFixture } = await import('/tests/fixtures/sphExtendedPhaseCaloric.js');
        const extendedInputs = createExtendedPhaseCaloricFixture(thermodynamics);
        const extendedState = stateModule.createSphState({ smoothingLengthM: 1, particles: extendedInputs.particles });
        const extendedBefore = JSON.stringify(extendedState);
        const extendedPacked = buffers.buildSphGpuParticleBuffers(extendedState, extendedInputs);
        const extendedMls = buffers.buildMlsMpmGpuParticleBuffers(extendedState, extendedInputs);
        extended.initial = { state: [...extendedPacked.state], thermo: [...extendedPacked.thermo],
          mechanics: [...extendedMls.mechanics], sourceUnchanged: JSON.stringify(extendedState) === extendedBefore };
        const extendedTable = thermal.buildSphThermalMaterialTable(extendedInputs.materialProperties, extendedInputs);
        for (let i = 4; i < extendedTable.records.length; i += 8) extendedTable.records[i] = 0;
        const extendedMechanicsTable = mechanics.buildMlsMpmMechanicsMaterialTable(extendedInputs.materialProperties);
        const extendedSphUpload = buffers.uploadSphGpuParticleBuffers(device, extendedPacked);
        const extendedMlsUpload = buffers.uploadMlsMpmGpuParticleBuffers(device, extendedMls);
        extendedUploads.push({ sph: extendedSphUpload, mls: extendedMlsUpload });
        let prior = { stateBuffer: extendedSphUpload.stateBuffer, thermoBuffer: extendedSphUpload.thermoBuffer,
          mechanicsBuffer: extendedMlsUpload.mechanicsBuffer };
        for (let cycle = 1; cycle <= 2; cycle += 1) {
          const result = await thermal.runSphThermalStepWebGpu({ device, sphParticleState: extendedPacked,
            sphParticleUpload: extendedSphUpload, thermalMaterialTable: extendedTable,
            sourceStateBuffer: prior.stateBuffer, sourceThermoBuffer: prior.thermoBuffer,
            proposalStateBuffer: prior.stateBuffer, proposalThermoBuffer: prior.thermoBuffer,
            wallTemperaturesK: { xMin: 320 }, wallLayerM: 1, wallRate: 2000, dtS: 0.1,
            conductionRate: 0, boxDimsM: [4, 4, 4], retainOutputParticleBuffers: true,
            readbackMode: 'full-parity-readback' });
          outputs.push(result);
          const refreshed = await refresh.runMlsMpmMechanicsRefreshWebGpu({ device,
            sphParticleState: extendedPacked, mlsMpmParticleState: extendedMls,
            mechanicsMaterialTable: extendedMechanicsTable,
            sourceStateBuffer: result.stateBuffer, sourceThermoBuffer: result.thermoBuffer,
            sourceMechanicsBuffer: prior.mechanicsBuffer,
            retainOutputParticleBuffers: true, readbackMode: 'full-parity-readback' });
          outputs.push(refreshed);
          extended.runs.push({ cycle, backend: result.backend, state: [...result.state], thermo: [...result.thermo],
            mechanics: [...refreshed.mechanics], refreshStatus: refreshed.authorityValidationStatus,
            refreshFailureCount: refreshed.authorityValidationFailureCount });
          prior = { stateBuffer: result.stateBuffer, thermoBuffer: result.thermoBuffer,
            mechanicsBuffer: refreshed.mechanicsBuffer };
        }
      } catch (error) { fatalError = String(error?.stack || error); }
      finally {
        try { await device.queue.onSubmittedWorkDone(); } catch (error) { errors.push(String(error)); }
        for (const output of outputs.reverse()) output.destroyOutputParticleBuffers?.();
        for (const upload of extendedUploads) {
          buffers.destroyMlsMpmGpuParticleBuffers(upload.mls);
          buffers.destroySphGpuParticleBuffers(upload.sph);
        }
        if (mlsUpload) buffers.destroyMlsMpmGpuParticleBuffers(mlsUpload);
        if (sphUpload) buffers.destroySphGpuParticleBuffers(sphUpload);
        for (const kind of ['out-of-memory', 'internal', 'validation']) {
          const error = await device.popErrorScope();
          if (error) errors.push(kind + ': ' + error.message);
        }
        device.destroy();
      }
      return { servedSources, adapter: { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture,
        device: adapter.info?.device, description: adapter.info?.description },
      initial, runs, legacyControl, extended, errors, fatalError };
    }, { sources: REQUIRED_SOURCES.map((path) => ({ path,
      hash: manifest.rows.find((row) => resolve(row.path) === resolve(path)).hash })) });
  } catch (error) { failure ??= error; evidence.harnessError = String(error?.stack || error); }
  finally {
    clearTimeout(watchdog);
    if (watchdogClose) await watchdogClose;
    if (browser) {
      try { await browser.close(); evidence.ownedBrowserClosed = !browser.isConnected(); }
      catch (error) { failure ??= error; evidence.browserCloseError = String(error); }
    }
    try { await checkManifest(manifestPath, manifest.text); evidence.sourceFreezeUnchanged = true; }
    catch (error) { failure ??= error; evidence.sourceFreezeError = String(error); }
    evidence.finished = new Date().toISOString();
    await writeFile(path, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (failure) throw failure;
  const observed = evidence.observed;
  assert.equal(evidence.ownedBrowserClosed, true);
  assert.equal(observed.fatalError, null);
  assert.deepEqual(observed.errors, []);
  assert.equal(observed.servedSources.length, REQUIRED_SOURCES.length);
  assert.equal(observed.initial.sourceUnchanged, true);
  assert.equal(observed.runs.length, 2);
  assert.equal(observed.legacyControl.length, 2);
  const near = (actual, expected, tolerance) => assert.ok(Number.isFinite(actual)
    && Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} +/- ${tolerance}`);
  const initial = observed.initial;
  assert.equal(initial.state[7], -138_003);
  assert.equal(initial.state[15], 34_200);
  assert.equal(initial.state[23], 34_200);
  near(initial.thermo[2], 278, 4e-5);
  near(initial.thermo[14], 278, 4e-5);
  near(initial.thermo[26], 321.05075, 4e-5);
  near(initial.thermo[38], 300, 1e-4, 'legacy constructor inverse');
  near(initial.mechanics[32 + 25], Math.sqrt(4000 / 3900 * 100 * 278), 4e-5);
  for (const run of [initial, ...observed.runs]) {
    for (let i = 0; i < 3; i += 1) {
      assert.equal(run.state[i * 8 + 3], 1);
      const phase = i === 1 ? 3 : 2;
      assert.equal(run.thermo[i * 12 + 1], phase);
      assert.equal(run.thermo[i * 12 + 10], 1);
      assert.deepEqual(run.thermo.slice(i * 12 + 4, i * 12 + 8), [0, phase === 2 ? 1 : 0, phase === 3 ? 1 : 0, 0]);
      assert.equal(run.thermo[i * 12 + 3], Math.fround(i === 1 ? 0.1 : 1000));
      near(run.mechanics[i * 32 + 19], i === 1 ? 1 / Math.fround(0.1) : 0.001, 1e-6);
      assert.equal(run.mechanics[i * 32 + 21], 1);
      assert.equal(run.mechanics[i * 32 + 27], 1);
      assert.deepEqual(run.state.slice(i * 8 + 4, i * 8 + 7), [0.5, -0.25, 0.125]);
    }
    assert.equal(run.state[7], -138_003);
    assert.equal(run.state[23], 34_200);
    assert.equal(run.state[31], initial.legacyU);
  }
  for (const run of observed.runs) {
    assert.equal(run.backend, 'webgpu');
    assert.equal(run.refreshStatus, 'mechanics-refresh-authority-accepted');
    assert.equal(run.refreshFailureCount, 0);
    const legacy = observed.legacyControl[run.cycle - 1];
    assert.deepEqual(run.state.slice(24, 32), legacy.state, 'legacy Fe state matches un-enrolled GPU control');
    assert.deepEqual(run.thermo.slice(36, 48), legacy.thermo, 'legacy Fe thermo matches un-enrolled GPU control');
    assert.equal(legacy.state[7], initial.legacyU);
    // Q1=2600*(298-278)*.75*.1=3900J, Q2=2600*19*.75*.1=3705J.
    // Independent Cv_v=4000-100, not Cp_v and not a thermal graph oracle.
    near(run.state[15], run.cycle === 1 ? 38_100 : 41_805, 0.05);
    near(run.thermo[14], run.cycle === 1 ? 279 : 279.95, 8e-5);
    assert.equal(run.exactPriorGpuBuffersReused, true);
  }
  assert.equal(observed.extended.initial.sourceUnchanged, true);
  assert.equal(observed.extended.runs.length, 2);
  const phaseIds = [1, 2, 3, 3], cvs = [2000, 4000, 3900, 800];
  // Independent phase U references include the fusion pressure-volume term.
  const referenceU = [-70002.4, -50003, 120000, 100000];
  const expectedU = [-50000, -50000, -50000, 50000];
  for (const [cycle, run] of [observed.extended.initial, ...observed.extended.runs].entries()) {
    if (cycle) {
      assert.equal(run.backend, 'webgpu');
      assert.equal(run.refreshStatus, 'mechanics-refresh-authority-accepted');
      assert.equal(run.refreshFailureCount, 0);
      for (const i of [0, 3]) expectedU[i] += 2000 * (320 - (300 + (expectedU[i] - referenceU[i]) / cvs[i])) * .75 * .1;
    }
    for (const [i, phaseId] of phaseIds.entries()) {
      near(run.state[i * 8 + 7], expectedU[i], .05);
      near(run.thermo[i * 12 + 2], 300 + (expectedU[i] - referenceU[i]) / cvs[i], 8e-5);
      assert.equal(run.thermo[i * 12 + 1], phaseId);
      assert.deepEqual(run.thermo.slice(i * 12 + 4, i * 12 + 8), [1, 2, 3, 4].map((id) => Number(id === phaseId)));
      assert.equal(run.thermo[i * 12 + 10], 1);
      assert.equal(run.state[i * 8 + 3], 1);
      assert.deepEqual(run.state.slice(i * 8 + 4, i * 8 + 7), [.5, -.25, .125]);
    }
  }
});
