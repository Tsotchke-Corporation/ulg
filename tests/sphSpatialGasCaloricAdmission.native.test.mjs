import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';

const REQUIRED = [
  'tests/sphSpatialGasCaloricAdmission.native.test.mjs',
  'src/runtime/sph/sphSpatialGasCaloricAdmission.js',
  'src/runtime/sph/sphSpatialGasLedgerEosGpu.js',
  'src/runtime/sph/schroederSpatialSuccessorSourceFamily.js',
  'src/runtime/sph/sphThermalGpuKernel.js',
  'src/runtime/sph/sphGpuBuffers.js',
  'src/runtime/material/condensableThermodynamics.js'
];
const sha = (value) => createHash('sha256').update(value).digest('hex');
async function freeze(path, prior = null) {
  const text = await readFile(path, 'utf8');
  if (prior != null) assert.equal(text, prior, 'manifest changed');
  const rows = text.trim().split('\n').map((line) => {
    const row = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    assert.ok(row, line);
    return { hash: row[1], path: resolve(row[2]) };
  });
  for (const path of REQUIRED) assert.ok(rows.some((row) => row.path === resolve(path)), path);
  for (const row of rows) assert.equal(sha(await readFile(row.path)), row.hash, row.path);
  return { text, rows, hash: sha(text) };
}

test('native paired retained EOS admits actual cold/thermal gas calorics and residual history', {
  skip: process.env.ULG_RUN_NATIVE_GAS_CALORIC_ADMISSION !== '1', timeout: 240_000
}, async () => {
  const output = process.env.ULG_GAS_CALORIC_ADMISSION_EVIDENCE;
  const manifestPath = process.env.ULG_GAS_CALORIC_ADMISSION_SOURCE_MANIFEST;
  assert.ok(isAbsolute(output || '') && isAbsolute(manifestPath || ''), 'new absolute evidence/manifest paths');
  const manifest = await freeze(manifestPath);
  const baseUrl = process.env.ULG_GAS_CALORIC_ADMISSION_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/';
  assert.equal(new URL(baseUrl).protocol, 'https:');
  const evidence = { schema: 'peercompute.ulg.native-gas-caloric-admission.v1',
    started: new Date().toISOString(), baseUrl, sourceManifest: { path: manifestPath, sha256: manifest.hash },
    headed: true, desktop: 'Wayland', ignoreHTTPSErrors: false,
    sourceScope: 'actual cold packers, thermal/refresh, real SS and published particle/product owner',
    manufacturedProductRows: true, chemistryValidation: false, exchangeIntervalAdmitted: false,
    fullPlumeValidation: false, presetAdmission: false };
  let browser, watchdog, watchdogClose, failure;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    const owned = browser;
    watchdog = setTimeout(() => {
      failure ??= new Error('Owned native browser exceeded 210 second watchdog');
      watchdogClose = owned.close().catch((error) => { evidence.watchdogCloseError = String(error); });
    }, 210_000);
    const page = await browser.newPage({ ignoreHTTPSErrors: false });
    await page.goto(new URL('/package.json', baseUrl).href);
    evidence.observed = await page.evaluate(async ({ sources }) => {
      const servedSources = [];
      for (const source of sources) {
        const raw = (await import('/' + source.path + '?raw')).default;
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        const hash = [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('');
        if (hash !== source.hash) throw new Error('Served source drift: ' + source.path);
        servedSources.push({ ...source, observedHash: hash });
      }
      const dep = async (parent, file) => {
        const response = await fetch(parent);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${parent}`);
        const code = await response.text();
        const path = [...code.matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
          .find((p) => p.split('?')[0].endsWith('/' + file));
        if (!path) throw new Error(`Missing dependency ${file} in ${parent}`);
        return new URL(path, new URL(parent, location.href)).href;
      };
      const eosUrl = '/src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
      const caloricUrl = await dep(eosUrl, 'sphSpatialGasCaloricAdmission.js');
      const thermalUrl = await dep(caloricUrl, 'sphThermalGpuKernel.js');
      const pairUrl = await dep(eosUrl, 'schroederSpatialSuccessorSourceFamily.js');
      const buffersUrl = await dep(eosUrl, 'sphGpuBuffers.js');
      const identityUrl = await dep(eosUrl, 'sphGpuDeviceIdentity.js');
      const modelUrl = await dep(caloricUrl, 'condensableThermodynamics.js');
      const [eos, caloric, thermal, pair, buffers, identity, modelModule, spatial, history, tx, topology,
        stateModule, materials, optics, mechanics, refresh, summary, limits] = await Promise.all([
        import(eosUrl), import(caloricUrl), import(thermalUrl), import(pairUrl), import(buffersUrl), import(identityUrl),
        import(modelUrl), import(await dep(eosUrl, 'schroederSpatialEpochGpu.js')),
        import(await dep(eosUrl, 'sphResidentProductHistoryGpu.js')),
        import(await dep(pairUrl, 'schroederSpatialEpochTransaction.js')),
        import(await dep(pairUrl, 'schroederSpatialTopologyTransitionGpu.js')),
        import('/src/runtime/sph/sphState.js'), import('/src/runtime/material/materialClosures.js'),
        import('/src/runtime/material/opticalGpuBuffers.js'), import('/src/runtime/sph/sphMechanicsMaterialTable.js'),
        import('/src/runtime/sph/sphMechanicsRefreshGpuKernel.js'), import('/src/runtime/sph/sphReactionGpuSummary.js'),
        import('/src/runtime/webgpuDeviceLimits.js')
      ]);
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('Native adapter unavailable');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter) || {});
      const errors = [], cases = [], ownedBuffers = [], outputs = [], generations = [], publications = [], retained = [];
      const allocationLabels = [], pipelineLabels = [];
      const realCreateBuffer = device.createBuffer.bind(device);
      device.createBuffer = (descriptor) => {
        allocationLabels.push(descriptor.label || ''); return realCreateBuffer(descriptor);
      };
      const realCreatePipeline = device.createComputePipeline.bind(device);
      device.createComputePipeline = (descriptor) => {
        pipelineLabels.push(descriptor.label || ''); return realCreatePipeline(descriptor);
      };
      let fatalError = null;
      device.addEventListener('uncapturederror', (event) => errors.push(String(event.error?.message || event.error)));
      for (const kind of ['validation', 'internal', 'out-of-memory']) device.pushErrorScope(kind);
      const makeBuffer = (label, values) => {
        const raw = device.createBuffer({ label, size: values.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
        ownedBuffers.push(raw);
        const buffer = identity.tagWebGpuBufferDevice(raw, device);
        device.queue.writeBuffer(buffer, 0, values);
        return buffer;
      };
      const read = async (buffer) => {
        const copy = device.createBuffer({ size: buffer.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        try {
          const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, copy, 0, buffer.size);
          device.queue.submit([encoder.finish()]); await copy.mapAsync(GPUMapMode.READ);
          const bytes = [...new Uint8Array(copy.getMappedRange())]; copy.unmap(); return bytes;
        } finally { copy.destroy(); }
      };
      const epoch = (uploads) => Object.fromEntries(['storageGeneration', 'physicsTick', 'physicsSubstep',
        'positionEpoch', 'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch']
        .map((key) => [key, uploads.sphParticleUpload[key]]));
      const grid = { selectedLevel: 0, gridDims: [9, 9, 9], gridNodeCount: 729, gridShift: 2, gridSpacingM: 1 };
      const occupancy = (uploads, state, thermo, label) => {
        const count = uploads.sphParticleUpload.particleCount, rows = new Float32Array(count * 16);
        for (let i = 0; i < count; i++) {
          const m = state[i * 8 + 3], rho = thermo[i * 12 + 3], v = m / rho;
          rows.set([0, 1, 1, v, v, v, m, rho, thermo[i * 12 + 1], thermo[i * 12],
            thermo[i * 12 + 10], 0, ...state.slice(i * 8, i * 8 + 3), 0], i * 16);
        }
        const sph = uploads.sphParticleUpload, mls = uploads.mlsMpmParticleUpload;
        const assignmentBuffer = makeBuffer(label + '-assignment', rows);
        const assignment = { schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
          status: 'schroeder-level-assignment-submitted',
          bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready',
          particleCount: count, assignmentStrideFloats: 16, assignmentBuffer,
          assignmentBufferByteLength: assignmentBuffer.size, minLevel: 0, maxLevel: 0,
          chartId: 0, baseGridSpacingM: 1,
          sourceStateBuffer: sph.stateBuffer, sourceStateBufferBorrowed: true, sourceStateBufferByteLength: sph.stateBuffer.size,
          sourceThermoBuffer: sph.thermoBuffer, sourceThermoBufferBorrowed: true, sourceThermoBufferByteLength: sph.thermoBuffer.size,
          sourceIdentityBuffer: sph.identityBuffer, sourceIdentityBufferBorrowed: true, sourceIdentityBufferByteLength: sph.identityBuffer.size,
          sourceMechanicsBuffer: mls.mechanicsBuffer, sourceMechanicsBufferBorrowed: true, sourceMechanicsBufferByteLength: mls.mechanicsBuffer.size,
          ...epoch(uploads) };
        const generation = spatial.runSchroederSpatialEpochGenerationWebGpu({ device,
          levelAssignment: assignment, particleCount: count, particleIdentityBuffer: sph.identityBuffer,
          particleIdentityStrideWords: sph.identityStrideBytes / 4, selectedLevel: 0, mechanicsGrid: grid,
          exactNearCellTreeEnabled: false });
        if (!generation.ready) throw new Error(generation.reason || generation.status);
        generations.push(generation);
        return { generation, assignment };
      };
      try {
        const reference = materials.createReferenceMaterialClosures().h2o.properties;
        for (const config of [
          { name: 'base' }, { name: 'independent-gauges', shifts: [400000, -1000000] },
          { name: 'unknown-member', omitSecondModel: true },
          { name: 'wrong-moles', nFactor: 1.01 }, { name: 'wrong-source-U', uOffset: 10000 },
          { name: 'hidden-invalid-temperature', invalidTemperature: true },
          { name: 'unpaired-cold-source', cold: true }, { name: 'wrong-history-handle', wrongHistory: true },
          { name: 'truncated-particle-prefix', particlePrefix: true },
          { name: 'truncated-product-prefix', productPrefix: true }
        ]) {
          const ordinal = cases.length + 1, shifts = config.shifts || [0, 0];
          const properties = {}, models = {};
          for (const [i, material] of ['h2o', 'nh3'].entries()) {
            const Rs = i ? 200 : 100, Cp = i ? 2000 : 4000;
            models[material] = modelModule.createCondensableThermodynamics({
              schema: 'peercompute.ulg.condensable-thermodynamics.v1',
              energyBasis: 'specific-enthalpy-at-reference-pressure', referenceTemperatureK: 300, referencePressurePa: 3000,
              liquidReferenceEnthalpyJPerKg: -50000 + shifts[i], vaporizationReferenceEnthalpyJPerKg: 200000,
              liquidCpJPerKgK: Cp, vaporCpJPerKgK: Cp, liquidDensityKgPerM3: 1000,
              molarMassKgPerMol: 8.314462618 / Rs, minTemperatureK: 200, maxTemperatureK: 450,
              maxPressurePa: 2000000, provenance: 'manufactured independent two-species caloric integration fixture' });
            properties[material] = { ...reference, molarMassKgPerMol: 8.314462618 / Rs,
              phases: reference.phases.map((phase) => ({ ...phase,
                ...(phase.name === 'liquid' ? { cpJPerKgK: Cp, densityKgPerM3: 1000 } : {}),
                ...(phase.name === 'gas' ? { cpJPerKgK: Cp, densityKgPerM3: 3000 / (Rs * 300) } : {}) })) };
          }
          const U = (i, T) => (i ? 90000 : 120000) + shifts[i] + (i ? 1800 : 3900) * (T - 300);
          const state = stateModule.createSphState({ smoothingLengthM: 1,
            particles: ['h2o', 'nh3'].map((material, i) => ({ material, massKg: i ? .02 : .01,
              x: [.25 + i * .05, .25, .25], v: [0, 0, 0],
              specificInternalEnergyJPerKg: U(i, i ? 320 : 280),
              phaseCaloric: { phaseId: 3, phaseFractions: [0, 0, 1, 0] } })) });
          const options = { materialProperties: properties, condensableThermodynamicsByMaterial: models };
          const packed = buffers.buildSphGpuParticleBuffers(state, options);
          const packedMls = buffers.buildMlsMpmGpuParticleBuffers(state, options);
          const sph = buffers.uploadSphGpuParticleBuffers(device, packed);
          const mls = buffers.uploadMlsMpmGpuParticleBuffers(device, packedMls);
          ownedBuffers.push(sph.stateBuffer, sph.thermoBuffer, sph.identityBuffer, mls.mechanicsBuffer);
          const epochs = { storageGeneration: ordinal * 10, physicsTick: 1, physicsSubstep: 0,
            positionEpoch: 1, topologyEpoch: 1, chartEpoch: 0, levelEpoch: 1, supportEpoch: 1 };
          Object.assign(sph, epochs); Object.assign(mls, epochs);
          const cold = { sphParticleUpload: sph, mlsMpmParticleUpload: mls };
          const coldOccupancy = occupancy(cold, packed.state, packed.thermo, config.name + '-cold');
          const table = thermal.buildSphThermalMaterialTable(properties, options);
          for (let i = 4; i < table.records.length; i += 8) table.records[i] = 0;
          const authority = caloric.createSphSpatialGasCaloricAuthority({ thermalMaterialTable: table,
            condensableThermodynamicsByMaterial: config.omitSecondModel ? { h2o: models.h2o } : models });
          const mechanicsTable = mechanics.buildMlsMpmMechanicsMaterialTable(properties);
          const thermalOutput = await thermal.runSphThermalStepWebGpu({ device, sphParticleState: packed,
            sphParticleUpload: sph, thermalMaterialTable: table, sourceStateBuffer: sph.stateBuffer,
            sourceThermoBuffer: sph.thermoBuffer, proposalStateBuffer: sph.stateBuffer, proposalThermoBuffer: sph.thermoBuffer,
            dtS: .01, wallRate: 0, conductionRate: 0, boxDimsM: [4, 4, 4],
            retainOutputParticleBuffers: true, readbackMode: 'full-parity-readback' });
          outputs.push(thermalOutput);
          const refreshed = await refresh.runMlsMpmMechanicsRefreshWebGpu({ device,
            sphParticleState: packed, mlsMpmParticleState: packedMls, mechanicsMaterialTable: mechanicsTable,
            sourceStateBuffer: thermalOutput.stateBuffer, sourceThermoBuffer: thermalOutput.thermoBuffer,
            sourceMechanicsBuffer: mls.mechanicsBuffer, retainOutputParticleBuffers: true, readbackMode: 'full-parity-readback' });
          outputs.push(refreshed);
          const rows = new Float32Array(64), M = properties.nh3.molarMassKgPerMol;
          rows.set([.3, .25, .25, .03, optics.stableOpticalMaterialId('nh3'), 0], 0);
          rows[9] = .03 / M * (config.nFactor || 1); rows[10] = 1; rows[11] = 3;
          rows[12] = .01; rows[13] = .02; rows[16] = config.invalidTemperature ? NaN : 360;
          rows[17] = .05; rows[18] = 1; rows[19] = U(1, 360) + (config.uOffset || 0); rows[23] = .6;
          // A fully placed historical event must not double count even if its
          // old raw calorics are unavailable. This row has no live residual.
          rows.set(rows.slice(0, 32), 32); rows[32 + 12] = .03; rows[32 + 13] = 0; rows[32 + 19] = NaN;
          const eventBuffer = makeBuffer(config.name + '-manufactured-retained-events', rows);
          const product = summary.createResidentProductMassHandle({ productEventBuffer: eventBuffer,
            productEventBufferRetained: true, productEventBufferByteLength: rows.byteLength,
            productEventRowCount: 2, productEventActiveEventCount: 2,
            destroyProductEventBuffer: () => eventBuffer.destroy() });
          identity.tagResidentProductMassDevice(product, device);
          const control = makeBuffer(config.name + '-event-count', history.createResidentProductEventCountControlWords({
            status: history.SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY, liveRowCount: 2,
            rowCapacity: 2, rowStrideVec4: 8, generation: ordinal, seal: 0x51110000 + ordinal }));
          history.registerResidentProductEventCountAuthority(product, { device, controlBuffer: control,
            controlOffsetBytes: 0, rowCapacity: 2, rowStrideFloats: 32, generation: ordinal, seal: 0x51110000 + ordinal });
          const next = { sphParticleUpload: { ...sph, ...epochs, storageGeneration: epochs.storageGeneration + 1,
            physicsTick: 2, stateBuffer: thermalOutput.stateBuffer, thermoBuffer: thermalOutput.thermoBuffer },
          mlsMpmParticleUpload: { ...mls, ...epochs, storageGeneration: epochs.storageGeneration + 1,
            physicsTick: 2, mechanicsBuffer: refreshed.mechanicsBuffer }, residentProductMass: product };
          // Controlled no-motion publication, not a claimed mechanics step.
          // The receipt, source pair and topology/position inspections are real.
          const transaction = tx.createSchroederSpatialEpochTransaction({ device,
            generation: coldOccupancy.generation, ...cold, requiredReaderIds: [] });
          const top = await topology.runSchroederSpatialTopologyTransitionWebGpu({ device,
            generation: coldOccupancy.generation, sourceStateBuffer: sph.stateBuffer,
            successorStateBuffer: next.sphParticleUpload.stateBuffer, successorParticleCount: packed.particleCount });
          topology.applySchroederSpatialTopologyTransitionReceipt(next, top, { generation: coldOccupancy.generation });
          const position = await pair.runSchroederSpatialPositionTransitionWebGpu({ device,
            generation: coldOccupancy.generation, sourceStateBuffer: sph.stateBuffer,
            successorStateBuffer: next.sphParticleUpload.stateBuffer, successorParticleCount: packed.particleCount });
          pair.applySchroederSpatialPositionTransitionReceipt(next, position, { generation: coldOccupancy.generation });
          tx.sealSchroederSpatialEpochTransactionReaders(transaction); tx.sealSchroederSpatialEpochTransactionProposals(transaction);
          const commitReceipt = tx.commitSchroederSpatialEpochTransaction(transaction, { nextParticleUploads: next });
          const family = pair.createSchroederSpatialSuccessorSourceFamily({ transaction, commitReceipt,
            generation: coldOccupancy.generation, nextParticleUploads: next, topologyTransitionReceipt: top });
          publications.push(family);
          const parent = pair.acquireSchroederSpatialSuccessorSourceFamilyLease(family, { device, consumerStage: 'native-gas-owner' });
          const retirement = pair.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device,
            reason: 'native next-step source consumption' });
          const current = config.cold ? cold : next;
          const currentOccupancy = config.cold ? coldOccupancy
            : occupancy(next, thermalOutput.state, thermalOutput.thermo, config.name + '-published');
          const sourceBuffers = [current.sphParticleUpload.stateBuffer, current.sphParticleUpload.thermoBuffer, eventBuffer];
          const before = await Promise.all(sourceBuffers.map(read));
          const input = { device, ...current, residentProductMass: product,
            schroederLevelAssignment: currentOccupancy.assignment, schroederSpatialEpochGeneration: currentOccupancy.generation,
            epochIdentity: epoch(current), spatialGasGrid: grid, boxMinM: [0, 0, 0], boxMaxM: [4, 4, 4],
            spatialGasCellSizeM: 1, spatialGasSupportVolumeFallbackM3: 0 };
          let baseline = null;
          let baselineCaloricAllocations = null;
          if (config.name === 'base') {
            const legacy = await eos.runSphSpatialGasLedgerEosRetainedWebGpu(input); retained.push(legacy);
            if (!legacy.ready) throw new Error(legacy.reason);
            baseline = await eos.observeSphSpatialGasLedgerEosOracle(legacy);
            baselineCaloricAllocations = allocationLabels.filter((label) => /-caloric-(cells|materials)$/.test(label));
            eos.releaseSphSpatialGasLedgerEosAfterQueue(legacy);
            if (await legacy.releasePromise !== true) throw new Error('Legacy EOS retirement unconfirmed');
          }
          const execution = await eos.runSphSpatialGasLedgerEosRetainedWebGpu({ ...input,
            ...(config.particlePrefix ? { particleCount: 1 } : {}),
            ...(config.productPrefix ? { productEventRowCount: 1 } : {}),
            residentProductMass: config.wrongHistory ? { ...product } : product,
            authenticateParticleProductSource: true, sourceFamilyConsumerLease: config.cold ? null : parent,
            caloricAuthority: authority, caloricThermalMaterialTable: table });
          retained.push(execution);
          const observed = execution.ready ? await eos.observeSphSpatialGasLedgerEosOracle(execution) : null;
          const after = await Promise.all(sourceBuffers.map(read));
          const result = { name: config.name, ready: execution.ready, status: execution.status, reason: execution.reason,
            sourcePaired: execution.particleProductSourcePaired, exchangeIntervalAdmitted: execution.exchangeIntervalAdmitted,
            observed, sourceUnchanged: JSON.stringify(before) === JSON.stringify(after),
            expectedTemperatureK: 280 + 4320 / 111, expectedMoleTemperatureK: 3000 / 9,
            legacyPressureUnchanged: baseline ? JSON.stringify([...baseline.pressureValues]) === JSON.stringify([...observed.pressureValues]) : null,
            baselineCaloricAllocations,
            heldLeasesBeforeEosDrain: pair.schroederSpatialSuccessorSourceFamilyLiveness(family, { device }).leaseCount };
          if (execution.ready) {
            eos.releaseSphSpatialGasLedgerEosAfterQueue(execution);
            result.eosReleaseConfirmed = await execution.releasePromise;
          } else if (execution.cleanupPromise) result.eosReleaseConfirmed = await execution.cleanupPromise;
          result.heldLeasesAfterEosDrain = pair.schroederSpatialSuccessorSourceFamilyLiveness(family, { device }).leaseCount;
          result.parentRelease = await pair.releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(family, parent, { device,
            after: device.queue.onSubmittedWorkDone() });
          result.retirement = await retirement;
          result.finalFamily = pair.schroederSpatialSuccessorSourceFamilyLiveness(family, { device });
          result.sourceGenerationReleases = [];
          for (const generation of new Set([coldOccupancy.generation, currentOccupancy.generation])) {
            if (!generation.execution.released) {
              spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
              result.sourceGenerationReleases.push(await generation.releasePromise);
            }
          }
          cases.push(result);
        }
      } catch (error) { fatalError = String(error?.stack || error); }
      finally {
        try { await device.queue.onSubmittedWorkDone(); } catch (error) { errors.push(String(error)); }
        for (const execution of retained) if (execution.ready && !execution.released && !execution.terminal) {
          eos.releaseSphSpatialGasLedgerEosAfterQueue(execution); await execution.releasePromise;
        }
        for (const generation of generations) if (!generation.execution.released) {
          spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device); await generation.releasePromise;
        }
        for (const family of publications) {
          try { pair.retireSchroederSpatialSuccessorSourceFamily(family, { device, reason: 'native fixture cleanup' }); }
          catch { /* Device loss below is the final owner on failure. */ }
        }
        for (const output of outputs.reverse()) output.destroyOutputParticleBuffers?.();
        for (const buffer of new Set(ownedBuffers)) buffer.destroy();
        for (const kind of ['out-of-memory', 'internal', 'validation']) {
          const error = await device.popErrorScope(); if (error) errors.push(kind + ': ' + error.message);
        }
        device.destroy();
      }
      return { servedSources, cases, errors, fatalError, allocationLabels, pipelineLabels };
    }, { sources: REQUIRED.map((path) => ({ path, hash: manifest.rows.find((row) => row.path === resolve(path)).hash })) });
  } catch (error) { failure ??= error; evidence.harnessError = String(error?.stack || error); }
  finally {
    clearTimeout(watchdog); if (watchdogClose) await watchdogClose;
    if (browser) { await browser.close(); evidence.ownedBrowserClosed = !browser.isConnected(); }
    try { await freeze(manifestPath, manifest.text); evidence.sourceFreezeUnchanged = true; }
    catch (error) { failure ??= error; evidence.sourceFreezeError = String(error); }
    evidence.finished = new Date().toISOString();
    await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (failure) throw failure;
  assert.equal(evidence.ownedBrowserClosed, true);
  const observed = evidence.observed;
  assert.equal(observed.fatalError, null);
  assert.deepEqual(observed.errors, []);
  assert.equal(observed.cases.length, 10);
  for (const result of observed.cases) {
    assert.equal(result.sourceUnchanged, true, result.name);
    assert.equal(result.heldLeasesAfterEosDrain, 1, result.name);
    assert.equal(result.parentRelease.released, true, result.name);
    assert.equal(result.parentRelease.queueFenceSettled, true, result.name);
    assert.equal(result.finalFamily.leaseCount, 0, result.name);
    assert.equal(result.finalFamily.retired, true, result.name);
    assert.equal(result.retirement.retired, true, result.name);
    assert.ok(result.sourceGenerationReleases.every((value) => value === true), result.name);
    if (['unpaired-cold-source', 'wrong-history-handle', 'truncated-particle-prefix',
      'truncated-product-prefix'].includes(result.name)) {
      assert.equal(result.ready, false, result.name); continue;
    }
    assert.equal(result.ready, true, result.name);
    assert.equal(result.eosReleaseConfirmed, true, result.name);
    assert.equal(result.sourcePaired, true, result.name);
    assert.equal(result.exchangeIntervalAdmitted, false);
    assert.equal(result.heldLeasesBeforeEosDrain, 2, result.name);
    assert.equal(result.observed.caloricCells.length, 1, result.name);
    const cell = result.observed.caloricCells[0];
    if (['base', 'independent-gauges'].includes(result.name)) {
      assert.equal(cell.ready, true, result.name);
      assert.ok(Math.abs(cell.equilibriumTemperatureK - result.expectedTemperatureK) < 5e-4,
        JSON.stringify({ name: result.name, cell, expected: result.expectedTemperatureK }));
      assert.ok(Math.abs(cell.equilibriumTemperatureK - result.expectedMoleTemperatureK) > 10);
      assert.ok(Math.abs(cell.heatCapacityJPerK - 111) < 1e-4);
    } else {
      assert.equal(cell.ready, false, result.name);
      assert.equal(cell.statusFlags, { 'unknown-member': 4, 'wrong-moles': 8,
        'wrong-source-U': 16, 'hidden-invalid-temperature': 2 }[result.name], result.name);
    }
  }
  assert.equal(observed.cases[0].legacyPressureUnchanged, true);
  assert.deepEqual(observed.cases[0].baselineCaloricAllocations, []);
  for (const suffix of ['aggregate', 'gradient', 'finalize']) {
    assert.equal(observed.pipelineLabels.filter((label) => label === 'ulg-sph-spatial-gas-ledger-eos-' + suffix).length,
      2, 'one legacy and one material-general caloric variant, not per fixture/model');
  }
});
