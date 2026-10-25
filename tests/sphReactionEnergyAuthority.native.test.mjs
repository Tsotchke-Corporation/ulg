import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';

const REQUIRED = [
  'tests/sphReactionEnergyAuthority.native.test.mjs', 'tests/sphReactionEnergyAuthority.test.mjs',
  'src/runtime/sph/sphReactionGpuKernel.js', 'src/runtime/sph/sphReactionEnergyAuthority.js',
  'src/runtime/sph/sphReactionGpuSummary.js', 'src/runtime/sph/sphThermalGpuKernel.js',
  'src/runtime/sph/sphGpuBuffers.js', 'src/runtime/sph/sphCondensableParticleInitialization.js',
  'src/runtime/sph/sphCondensableCaloricTable.js', 'src/runtime/material/condensableThermodynamics.js',
  'ulg-gpu-abi/src/wgsl.js', 'ulg-gpu-abi/src/sphReactionEnergyWgsl.js',
  'ulg-gpu-abi/src/sphReactionPairAllocationWgsl.js', 'ulg-gpu-abi/src/index.js'
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function checkManifest(path, previous = null) {
  const text = await readFile(path, 'utf8');
  if (previous !== null) assert.equal(text, previous);
  const rows = text.trim().split('\n').map((line) => {
    const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    assert.ok(match, 'sha256sum manifest required');
    return { hash: match[1], path: match[2] };
  });
  for (const path of REQUIRED) assert.ok(rows.some((r) => resolve(r.path) === resolve(path)), path);
  for (const row of rows) assert.equal(hash(await readFile(resolve(row.path))), row.hash, row.path);
  return { text, rows, hash: hash(text) };
}

test('native reaction reference energy, full unplaced state, no-op gating and retained thermal continuation', {
  skip: process.env.ULG_RUN_NATIVE_REACTION_ENERGY === '1'
    ? false : 'set ULG_RUN_NATIVE_REACTION_ENERGY=1 after source freeze',
  timeout: 180_000
}, async () => {
  const path = process.env.ULG_REACTION_ENERGY_EVIDENCE;
  const manifestPath = process.env.ULG_REACTION_ENERGY_SOURCE_MANIFEST;
  assert.ok(path && isAbsolute(path), 'new absolute evidence path required');
  assert.ok(manifestPath && isAbsolute(manifestPath), 'absolute full source manifest required');
  const manifest = await checkManifest(manifestPath);
  const baseUrl = 'https://fastbox.tail5c077c.ts.net:5173/';
  const evidence = { schema: 'peercompute.ulg.native-reaction-energy-proof.v1',
    started: new Date().toISOString(), baseUrl, headed: true, desktop: 'Wayland',
    browser: '/usr/bin/google-chrome', ignoreHTTPSErrors: false,
    sourceManifest: { path: manifestPath, sha256: manifest.hash },
    scientificValidation: false, presetAdmission: false, fullPlumeValidation: false };
  let browser, watchdog, watchdogClose, failure;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    const owned = browser;
    watchdog = setTimeout(() => {
      failure ??= new Error('Owned reaction-energy browser exceeded 150 second watchdog');
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
        const actual = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
        if (actual !== source.hash) throw new Error('served source differs: ' + source.path);
        servedSources.push(source);
      }
      // Vite timestamps are part of module identity. Resolve the real import
      // edges, including private WeakMap issuers, instead of constructing twins.
      const dependency = async (url, file) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('dependency fetch failed: ' + url);
        const code = await response.text();
        const path = [...code.matchAll(/(?:from\s+|import\(\s*)["']([^"']+)["']/g)]
          .map((m) => m[1]).find((path) => path.split('?')[0].endsWith('/' + file));
        if (!path) throw new Error('missing dependency ' + file);
        return new URL(path, new URL(url, location.href)).href;
      };
      let reactionUrl = new URL('/src/runtime/sph/sphReactionGpuKernel.js', location.href).href;
      // The summary's lazy producer back-edge must resolve to this exact
      // instance too. Vite may timestamp that edge after a source edit.
      const summaryUrl = await dependency(reactionUrl, 'sphReactionGpuSummary.js');
      reactionUrl = await dependency(summaryUrl, 'sphReactionGpuKernel.js');
      const thermalUrl = await dependency(reactionUrl, 'sphThermalGpuKernel.js');
      const bufferUrl = await dependency(reactionUrl, 'sphGpuBuffers.js');
      const initUrl = await dependency(bufferUrl, 'sphCondensableParticleInitialization.js');
      const caloricUrl = await dependency(initUrl, 'sphCondensableCaloricTable.js');
      const modelUrl = await dependency(caloricUrl, 'condensableThermodynamics.js');
      const authorityUrl = await dependency(reactionUrl, 'sphReactionEnergyAuthority.js');
      if (await dependency(authorityUrl, 'sphThermalGpuKernel.js') !== thermalUrl) throw new Error('thermal module identity mismatch');
      const [reaction, thermal, buffers, models, stateModule, limits] = await Promise.all([
        import(reactionUrl), import(thermalUrl), import(bufferUrl), import(modelUrl),
        import('/src/runtime/sph/sphState.js'), import('/src/runtime/webgpuDeviceLimits.js')
      ]);
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('native adapter unavailable');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter) || {});
      const errors = [], runs = [];
      device.addEventListener('uncapturederror', (e) => errors.push(String(e.error?.message || e.error)));
      for (const kind of ['validation', 'internal', 'out-of-memory']) device.pushErrorScope(kind);
      let fatalError = null;
      const read = async (buffer, floats) => {
        const staging = device.createBuffer({ size: floats * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        try {
          const encoder = device.createCommandEncoder();
          encoder.copyBufferToBuffer(buffer, 0, staging, 0, floats * 4);
          device.queue.submit([encoder.finish()]);
          await staging.mapAsync(GPUMapMode.READ);
          return Array.from(new Float32Array(staging.getMappedRange()).slice());
        } finally { staging.unmap(); staging.destroy(); }
      };
      // Deliberately manufactured chemistry/caloric values; no scientific fit.
      const data = {
        h2: ['H2', .002, 6000, 5000, -50_000, 1000],
        o2: ['O2', .032, 1500, 1000, -100_000, 1200],
        h2o: ['H2O', .018, 4000, 2000, -200_000, 900],
        h2o2: ['H2O2', .034, 3000, 3000, -60_000, 1100]
      };
      const R = 8.314462618;
      try {
        for (const config of [
          { name: 'full', masses: [3 / 512, 32 / 512], dt: 0 },
          { name: 'moving-pair', masses: [3 / 512, 32 / 512], dt: 0,
            velocities: [[200, -100, 50], [-20, 30, -15]] },
          { name: 'partial-flux', masses: [.012, .064], dt: .00001 },
          { name: 'representable-remainder', masses: [.006, .06400005], dt: 0 },
          { name: 'invalid-source-temperature', masses: [3 / 512, 32 / 512], dt: 0, invalid: true },
          { name: 'invalid-partner-entity-count', masses: [3 / 512, 32 / 512], dt: 0, invalidEntities: true },
          { name: 'unrepresentable-debit', masses: [3 / 512, 32 / 512], dt: 1e-12 },
          { name: 'outside-product-domain', masses: [3 / 512, 32 / 512], dt: 0, deltaU: -1e9 },
          { name: 'mixed-legacy-physical', masses: [3 / 512, 32 / 512], dt: 0, mixed: true },
          { name: 'repeated-gas-terms', masses: [3 / 512, 32 / 512], dt: 0, repeatedGas: true },
          { name: 'one-free-slot', masses: [3 / 512, 64 / 512], dt: 0 },
          { name: 'single-product', masses: [4 / 512, 32 / 512], dt: 0, singleProduct: true, deltaU: -1440 },
          { name: 'reversed-particles', masses: [3 / 512, 32 / 512], dt: 0, reverse: true },
          { name: 'shifted-U-gauges', masses: [3 / 512, 32 / 512], dt: 0,
            shifts: { h2: 10000, o2: -8000, h2o: 6000, h2o2: -3000 } },
          { name: 'late-invalid-remainder', masses: [3 / 512, 64 / 512], dt: 0, invalidRemainder: true },
          { name: 'cross-workgroup-pairs', masses: [3 / 512, 32 / 512], dt: 0, pairCount: 33, offset: 1 }
        ]) {
          const properties = {}, modelMap = {}, uRef = {};
          for (const [material, [formula, molarMass, liquidCv, vaporCv, liquidU, rho]] of Object.entries(data)) {
            const parameters = { schema: 'peercompute.ulg.condensable-thermodynamics.v1',
              energyBasis: 'specific-enthalpy-at-reference-pressure', referenceTemperatureK: 300,
              referencePressurePa: 3000, liquidReferenceEnthalpyJPerKg: liquidU + (config.shifts?.[material] ?? 0) + 3000 / rho,
              vaporizationReferenceEnthalpyJPerKg: 2e6, liquidCpJPerKgK: liquidCv,
              vaporCpJPerKgK: vaporCv + R / molarMass, liquidDensityKgPerM3: rho, molarMassKgPerMol: molarMass,
              minTemperatureK: 200, maxTemperatureK: 500, maxPressurePa: 2e6,
              provenance: 'independent manufactured native reaction energy ' + material };
            modelMap[material] = models.createCondensableThermodynamics(parameters);
            properties[material] = { formula, molarMassKgPerMol: molarMass, phases: [
              { name: 'liquid', temperatureRange: [0, 400], cpJPerKgK: liquidCv, densityKgPerM3: rho,
                bulkModulusPa: 1e8, shearModulusPa: 0 },
              { name: 'gas', temperatureRange: [400, 1000], cpJPerKgK: parameters.vaporCpJPerKgK,
                densityKgPerM3: 3000 * molarMass / (R * 300), bulkModulusPa: null, shearModulusPa: 0 }
            ], transitions: [{ from: 'liquid', to: 'gas', temperatureK: 400, latentHeatJPerKg: 2e6 }] };
            uRef[material] = liquidU + (config.shifts?.[material] ?? 0) + 3000 / rho + 2e6 - R * 300 / molarMass;
          }
          const legacyRule = { a: 'legacy-h2', b: 'legacy-o2', product: 'legacy-h2o',
            contactRadiusM: .1, activationTemperatureK: 0, specificEnthalpyJPerKg: 0,
            stoichiometry: { reactants: [{ material: 'legacy-h2', coefficient: 2 }, { material: 'legacy-o2', coefficient: 1 }],
              products: [{ material: 'legacy-h2o', coefficient: 2, phase: 'liquid' }],
              atomBalance: { balanced: true }, chargeBalance: { balanced: true } } };
          if (config.mixed) {
            for (const material of ['h2', 'o2', 'h2o']) properties['legacy-' + material] = {
              formula: data[material][0], molarMassKgPerMol: data[material][1],
              phases: [{ name: 'liquid', temperatureRange: [0, 1000], cpJPerKgK: 1000,
                densityKgPerM3: 1000, bulkModulusPa: 1e6, shearModulusPa: 0 }], transitions: [] };
          }
          const options = { materialProperties: properties, condensableThermodynamicsByMaterial: modelMap,
            soundSpeedScale: 1, minGasSoundSpeedMPerS: 0 };
          const particles = Array.from({ length: (config.pairCount ?? 1) * 2 }, (_, index) => {
            const i = index % 2, material = ['h2', 'o2'][i];
            return { material, x: [1 + Math.floor(index / 2) * .25 + i * .02, 1, 1],
              v: config.velocities?.[i] ?? [0, 0, 0], massKg: config.masses[i],
              specificInternalEnergyJPerKg: uRef[material], phaseCaloric: { phaseId: 3, phaseFractions: [0, 0, 1, 0] } };
          });
          if (config.mixed) particles.push(...['h2', 'o2'].map((material, i) => ({ material: 'legacy-' + material,
            x: [2 + i * .02, 1, 1], v: [0, 0, 0], massKg: [4 / 512, 32 / 512][i],
            specificInternalEnergyJPerKg: 300000 })));
          if (config.offset) particles.unshift({ ...particles[0], x: [30, 1, 1] });
          if (config.reverse) particles.reverse();
          const input = stateModule.createSphState({ smoothingLengthM: .1, particles });
          const sph = buffers.buildSphGpuParticleBuffers(input, options);
          const mls = buffers.buildMlsMpmGpuParticleBuffers(input, options);
          if (config.invalid) sph.thermo[2] = NaN;
          if (config.invalidEntities) sph.thermo[21] = NaN;
          if (config.invalidRemainder) mls.mechanics[32 + 22] = NaN;
          const table = thermal.buildSphThermalMaterialTable(properties, options);
          // Controlled closed reaction/thermal continuation: no ambient source.
          for (let i = 4; i < table.records.length; i += 8) table.records[i] = 0;
          const reactants = [{ material: 'h2', coefficient: config.singleProduct ? 2 : 3, phase: 'gas' }, { material: 'o2', coefficient: config.singleProduct ? 1 : 2, phase: 'gas' }];
          const products = [{ material: 'h2o', coefficient: 2, phase: 'liquid' }];
          if (!config.singleProduct) products.push(...(config.repeatedGas
            ? [{ material: 'h2o2', coefficient: .5, phase: 'gas' }, { material: 'h2o2', coefficient: .5, phase: 'gas' }]
            : [{ material: 'h2o2', coefficient: 1, phase: 'gas' }]));
          const reactions = reaction.buildSphReactionTable([{
            a: 'h2', b: 'o2', product: 'h2o', contactRadiusM: .1, activationTemperatureK: 0,
            phaseRequirements: { h2: ['gas'], o2: ['gas'] },
            stoichiometry: { reactants, products, atomBalance: { balanced: true }, chargeBalance: { balanced: true } },
            energyReference: { schema: 'peercompute.ulg.reaction-energy-reference.v1',
              referenceTemperatureK: 300, referencePressurePa: 3000,
              reactionInternalEnergyChangeJPerMolExtent: config.deltaU ?? -2460,
              reactantPhases: reactants.map((t) => ({ material: t.material, coefficient: t.coefficient, phaseId: 3 })),
              productPhases: products.map((t, i) => ({ material: t.material, coefficient: t.coefficient, phaseId: i ? 3 : 2 })),
              source: { kind: 'manufactured-analytic', provenance: 'native closed caloric balance test',
                fingerprint: 'native-reaction-energy-v1', provisional: false, phaseApplicable: true }
            }
          }, ...(config.mixed ? [legacyRule] : [])], { materialProperties: properties, thermalMaterialTable: table, soundSpeedScale: 1, minGasSoundSpeedMPerS: 0 });
          if (config.mixed) {
            let cpuError = null, gpuError = null, allocations = 0;
            try { reaction.runSphReactionStepCpu({ sphParticleState: sph, mlsMpmParticleState: mls,
              reactionTable: reactions, thermalMaterialTable: table, dtSeconds: config.dt }); }
            catch (error) { cpuError = String(error.message); }
            const originalCreate = device.createBuffer;
            device.createBuffer = function(descriptor) { allocations++; return originalCreate.call(this, descriptor); };
            try { await reaction.runSphReactionStepWebGpu({ device, sphParticleState: sph, mlsMpmParticleState: mls,
              reactionTable: reactions, thermalMaterialTable: table, dtSeconds: config.dt, readbackMode: 'no-full-readback' }); }
            catch (error) { gpuError = String(error.message); }
            finally { device.createBuffer = originalCreate; }
            runs.push({ name: config.name, expectedAdmissionRejection: true, cpuError, gpuError, allocations });
            continue;
          }
          const cpu = reaction.runSphReactionStepCpu({ sphParticleState: sph, mlsMpmParticleState: mls,
            reactionTable: reactions, thermalMaterialTable: table, dtSeconds: config.dt });
          let upload, mlsUpload, result;
          let allocationSource = null, allocationCopy = null, allocationDestroyed = 0;
          const createBuffer = device.createBuffer, submit = device.queue.submit;
          // Diagnostic copy follows the actual primary command buffer. It
          // observes the private writer; it supplies no result or acceptance.
          device.createBuffer = function (descriptor) {
            const buffer = createBuffer.call(this, descriptor);
            if (descriptor.label === 'ulg-sph-reaction-pair-allocation') {
              allocationSource = buffer;
              const destroy = buffer.destroy;
              buffer.destroy = function () { allocationDestroyed++; return destroy.call(this); };
            }
            return buffer;
          };
          device.queue.submit = function (commands) {
            const submitted = [...commands];
            if (allocationSource && !allocationCopy) {
              allocationCopy = createBuffer.call(device, { size: allocationSource.size,
                usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
              const encoder = device.createCommandEncoder();
              encoder.copyBufferToBuffer(allocationSource, 0, allocationCopy, 0, allocationSource.size);
              submitted.push(encoder.finish());
            }
            return submit.call(this, submitted);
          };
          const thermalOutputs = [];
          try {
            upload = buffers.uploadSphGpuParticleBuffers(device, sph);
            mlsUpload = buffers.uploadMlsMpmGpuParticleBuffers(device, mls);
            result = await reaction.runSphReactionStepWebGpu({ device, sphParticleState: sph, mlsMpmParticleState: mls,
              sphParticleUpload: upload, mlsMpmParticleUpload: mlsUpload, reactionTable: reactions, thermalMaterialTable: table,
              dtSeconds: config.dt, boxDimsM: [100, 3, 3], retainOutputParticleBuffers: true,
              readbackMode: 'no-full-readback', readCompactReactionSummary: true, readReactionGasSpeciesSummary: true,
              readReactionProductInventory: true, readReactionAtomResidual: true });
            const summary = result.reactionSummary;
            if (!summary?.productEventBuffer) throw new Error('missing resident product event buffer: ' + summary?.reason);
            const observed = { name: config.name, dt: config.dt, backend: result.backend,
              pairCount: config.pairCount ?? 1, offset: config.offset ?? 0, particleCount: sph.particleCount,
              productTermCount: reactions.productTermCount, allocationMode: result.reactionAllocationMode,
              sourcePack: result.sourceParticlePackMode, summaryStatus: summary.status,
              source: { state: Array.from(sph.state), thermo: Array.from(sph.thermo), mechanics: Array.from(mls.mechanics) },
              cpu: { state: Array.from(cpu.state), thermo: Array.from(cpu.thermo), mechanics: Array.from(cpu.mechanics),
                event: cpu.reactionLedger?.events?.[0] ?? null },
              gpu: { state: await read(result.stateBuffer, sph.particleCount * 8), thermo: await read(result.thermoBuffer, sph.particleCount * 12),
                mechanics: await read(result.mechanicsBuffer, sph.particleCount * 32),
                events: await read(summary.productEventBuffer, sph.particleCount * reactions.productTermCount * 32),
                allocation: await read(allocationCopy, allocationCopy.size / 4) },
              inventory: summary.productInventory, gas: summary.gasSpeciesLedger,
              atoms: summary.atomResidualSummary,
              canonicalEventCount: summary.canonicalReactionEventCount, cycles: [] };
            observed.allocationRetired = allocationDestroyed === 1;
            device.createBuffer = createBuffer; device.queue.submit = submit;
            runs.push(observed);
            if (config.name === 'full' || config.invalidRemainder) {
              const parity = await reaction.runSphReactionStepWebGpu({ device, sphParticleState: sph, mlsMpmParticleState: mls,
                sphParticleUpload: upload, mlsMpmParticleUpload: mlsUpload, reactionTable: reactions, thermalMaterialTable: table,
                dtSeconds: config.dt, boxDimsM: [100, 3, 3], retainOutputParticleBuffers: true,
                readbackMode: 'full-parity-readback' });
              try { observed.fullReadback = { state: Array.from(parity.state), thermo: Array.from(parity.thermo),
                mechanics: Array.from(parity.mechanics), allocationMode: parity.reactionAllocationMode }; }
              finally { await parity.destroyOutputParticleBuffers?.(); }
            }
            if (config.name === 'full') {
              let prior = result;
              for (let cycle = 1; cycle <= 2; cycle += 1) {
                const next = await thermal.runSphThermalStepWebGpu({ device, sphParticleState: sph,
                  thermalMaterialTable: table, sourceStateBuffer: prior.stateBuffer, sourceThermoBuffer: prior.thermoBuffer,
                  proposalStateBuffer: prior.stateBuffer, proposalThermoBuffer: prior.thermoBuffer,
                  dtS: .01, wallRate: 0, conductionRate: 0, boxDimsM: [3, 3, 3],
                  retainOutputParticleBuffers: true, readbackMode: 'full-parity-readback' });
                thermalOutputs.push(next);
                observed.cycles.push({ cycle, state: Array.from(next.state), thermo: Array.from(next.thermo),
                  exactPriorGpuBuffersReused: true });
                prior = next;
              }
            }
          } finally {
            device.createBuffer = createBuffer; device.queue.submit = submit;
            await device.queue.onSubmittedWorkDone();
            allocationCopy?.destroy();
            for (const output of thermalOutputs.reverse()) await output.destroyOutputParticleBuffers?.();
            await result?.destroyOutputParticleBuffers?.();
            if (mlsUpload) buffers.destroyMlsMpmGpuParticleBuffers(mlsUpload);
            if (upload) buffers.destroySphGpuParticleBuffers(upload);
          }
        }
      } catch (error) { fatalError = String(error?.stack || error); }
      finally {
        try { await device.queue.onSubmittedWorkDone(); } catch (error) { errors.push(String(error)); }
        for (const kind of ['out-of-memory', 'internal', 'validation']) {
          const error = await device.popErrorScope();
          if (error) errors.push(kind + ': ' + error.message);
        }
        device.destroy();
      }
      return { servedSources, runs, errors, fatalError, adapter: { vendor: adapter.info?.vendor,
        architecture: adapter.info?.architecture, device: adapter.info?.device, description: adapter.info?.description } };
    }, { sources: REQUIRED.map((path) => ({ path, hash: manifest.rows.find((r) => resolve(r.path) === resolve(path)).hash })) });
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
  assert.equal(observed.runs.length, 16);
  const near = (a, b, tolerance, label) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance,
    `${label}: ${a} != ${b} +/- ${tolerance}`);
  for (const run of observed.runs) {
    if (run.expectedAdmissionRejection) {
      assert.equal(run.name, 'mixed-legacy-physical');
      assert.match(run.cpuError, /Phase-specific caloric reaction energy is not yet admitted/);
      assert.match(run.gpuError, /Phase-specific caloric reaction energy is not yet admitted/);
      assert.equal(run.allocations, 0);
      continue;
    }
    assert.equal(run.backend, 'webgpu');
    assert.equal(run.sourcePack, 'gpu-pack-source-buffers');
    assert.equal(run.allocationMode, 'pair-owned-physical-energy');
    assert.equal(run.allocationRetired, true);
    if (run.fullReadback) {
      assert.deepEqual(run.fullReadback.state, run.gpu.state);
      assert.deepEqual(run.fullReadback.thermo, run.gpu.thermo);
      assert.deepEqual(run.fullReadback.mechanics, run.gpu.mechanics);
      assert.equal(run.fullReadback.allocationMode, run.allocationMode);
    }
    const stride = 32 + run.productTermCount * 32;
    const accepted = Array.from({ length: run.particleCount }, (_, i) => run.gpu.allocation[i * stride] === 1);
    const events = [];
    for (let row = 0; row < run.particleCount * run.productTermCount; row += 1) {
      const r = run.gpu.events.slice(row * 32, (row + 1) * 32);
      if (r[18] === 1) {
        events.push(r);
        const pair = r[7], term = r[5];
        assert.equal(accepted[pair], true);
        assert.deepEqual(r, run.gpu.allocation.slice(pair * stride + 32 + term * 32, pair * stride + 32 + term * 32 + 32));
      }
    }
    if (run.name === 'cross-workgroup-pairs') {
      assert.equal(run.particleCount, 67);
      assert.equal(run.canonicalEventCount, 33);
      assert.equal(accepted.filter(Boolean).length, 33);
      assert.equal(accepted[63], true); // This pair writes endpoint 64 from group 0.
      assert.equal(run.gpu.allocation[63 * stride + 1], 64);
      assert.equal(events.length, 66);
      assert.deepEqual(run.gpu.state.slice(0, 8), run.source.state.slice(0, 8));
      for (let pair = 1; pair < 67; pair += 2) {
        const rowEvents = events.filter(row => row[7] === pair);
        assert.equal(rowEvents.length, 2);
        const before = run.source.state[pair * 8 + 3] + run.source.state[(pair + 1) * 8 + 3];
        const after = run.gpu.state[pair * 8 + 3] + run.gpu.state[(pair + 1) * 8 + 3] + rowEvents.reduce((sum, row) => sum + row[13], 0);
        near(after, before, 2e-8, 'cross-group joint mass');
        for (const row of rowEvents) near(row[16], 310, .001, 'cross-group common temperature');
      }
      continue;
    }
    if (run.name === 'late-invalid-remainder') {
      assert.ok(run.cpu.event, 'the original independent endpoint path accepts this pair');
      assert.equal(run.gpu.allocation[16], 2, 'rejection follows both stored endpoint candidates');
    }
    if (!run.cpu.event || run.name === 'late-invalid-remainder') {
      assert.equal(accepted.filter(Boolean).length, 0);
      assert.deepEqual(run.gpu.state, run.source.state, 'no-op preserves exact packed state');
      assert.deepEqual(run.gpu.thermo, run.source.thermo, 'no-op preserves exact packed thermo');
      assert.deepEqual(run.gpu.mechanics, run.source.mechanics, 'no-op preserves exact packed mechanics');
      assert.equal(events.length, 0, 'a rejected reaction does not mint sidecar product mass');
      assert.equal(run.canonicalEventCount, 0);
      for (const record of [...run.inventory.records, ...run.gas.records]) {
        assert.equal(record.massKg, 0);
        assert.equal(record.eventCount, 0);
      }
      assert.ok(run.atoms.records.every((r) => r.eventCount === 0 && r.atomResidualMol === 0));
      continue;
    }
    assert.equal(run.canonicalEventCount, 1);
    assert.equal(accepted.filter(Boolean).length, 1);
    assert.equal(events.length, run.productTermCount);
    const oldMass = run.source.state[3] + run.source.state[11];
    const newMass = run.gpu.state[3] + run.gpu.state[11] + events.reduce((s, r) => s + r[13], 0);
    near(newMass, oldMass, 2e-8, 'GPU joint mass');
    for (let axis = 0; axis < 3; axis += 1) {
      const before = run.source.state[3] * run.source.state[4 + axis] + run.source.state[11] * run.source.state[12 + axis];
      const after = run.gpu.state[3] * run.gpu.state[4 + axis] + run.gpu.state[11] * run.gpu.state[12 + axis]
        + events.reduce((sum, r) => sum + r[13] * r[20 + axis], 0);
      near(after, before, 1e-6, 'GPU joint momentum (f32 mass/velocity packing budget)');
    }
    for (let i = 0; i < 2; i += 1) {
      near(run.gpu.state[i * 8 + 3], run.cpu.state[i * 8 + 3], 2e-8, 'CPU/GPU mass');
      near(run.gpu.state[i * 8 + 7], run.cpu.state[i * 8 + 7], .5, 'CPU/GPU U');
      near(run.gpu.thermo[i * 12 + 2], run.cpu.thermo[i * 12 + 2], .001, 'CPU/GPU T');
      assert.equal(run.gpu.thermo[i * 12 + 1], run.cpu.thermo[i * 12 + 1]);
      near(run.gpu.mechanics[i * 32 + 31], run.gpu.state[i * 8 + 3], 2e-8, 'product/remainder reference mass');
    }
    for (const row of events) {
      const cpu = run.cpu.event.products.find((p) => p.materialId === row[4]);
      assert.ok(cpu);
      near(row[3], cpu.massKg, 2e-8, 'event product mass');
      near(row[19], cpu.specificInternalEnergyJPerKg, .5, 'event product U');
      near(row[16], cpu.temperatureK, .001, 'event product T');
      assert.equal(row[11], cpu.phaseId);
      if (row[11] === 3) {
        // Manufactured H2O2 gas: Cv=3000, M=.034. Use final solved T,
        // not the representative phase-table temperature (700 K).
        const rs = 8.314462618 / .034;
        near(row[27], Math.sqrt((3000 + rs) / 3000 * rs * row[16]), .0002, 'event gas c at actual solved T');
        for (let i = 0; i < 2; i++) {
          if (run.gpu.thermo[i * 12] === row[4] && run.gpu.state[i * 8 + 3] > 0) {
            near(run.gpu.mechanics[i * 32 + 25], row[27], .0002, 'direct and unplaced gas share c(T)');
          }
        }
      }
      if (run.name !== 'repeated-gas-terms') near(row[13], cpu.unplacedMassKg, 2e-8, 'event unplaced mass');
      if (row[13] > 0) assert.ok(row[23] > 0 && Number.isFinite(row[23]), 'unplaced volume');
      // Independent manufactured energy scale: reactants start at reference T,
      // release 2460 J/extent, product heat capacity is 246 J/K/extent.
      const relativeSquared = [0, 1, 2].reduce((sum, a) => sum + (run.source.state[4 + a] - run.source.state[12 + a]) ** 2, 0);
      const relativeEnergyPerExtent = .5 * (.006 * .064 / .070) * relativeSquared;
      near(row[16], 310 + relativeEnergyPerExtent / 246, .001, 'analytic common temperature including inelastic relative KE');
    }
    for (const record of [...run.inventory.records, ...run.gas.records]) {
      const row = events.find(event => event[5] === record.productTermIndex);
      assert.ok(row, 'each ledger row has its exact global product term');
      near(record.massKg, row[3], 1e-8, 'term ledger mass');
      near(record.moles, row[9], 1e-7, 'term ledger moles');
      near(record.visibleMassKg, row[12], 1e-8, 'term direct placement');
      near(record.unplacedMassKg, row[13], 1e-8, 'term residual');
    }
    if (run.name === 'repeated-gas-terms') {
      const gasEvents = events.filter(row => row[10] === 1);
      assert.equal(gasEvents.length, 2);
      assert.notEqual(gasEvents[0][5], gasEvents[1][5]);
      assert.equal(gasEvents[0][13], 0);
      assert.equal(gasEvents[1][12], 0);
      assert.equal(gasEvents[1][13], gasEvents[1][3]);
      near(run.gas.bySpecies.h2o2.massKg, gasEvents.reduce((sum,row) => sum+row[3],0), 1e-8, 'gas terms counted once');
    }
    if (run.name === 'one-free-slot') {
      assert.equal(events[0][13], 0);
      assert.equal(events[1][12], 0);
      assert.ok(run.gpu.state[11] > 0);
    }
    if (run.name === 'partial-flux') {
      assert.ok(run.cpu.event.extentMol > 0 && run.cpu.event.extentMol < 1);
      assert.ok(events.every((r) => r[12] === 0 && r[13] === r[3]), 'all partial products retain full unplaced state');
    }
    if (run.name === 'representable-remainder') assert.ok(run.gpu.state[11] > 0 && run.gpu.state[11] < 1e-7);
    if (run.name === 'full') {
      assert.equal(run.cycles.length, 2);
      assert.ok(events.every((r) => r[13] === 0));
      for (const cycle of run.cycles) {
        assert.equal(cycle.exactPriorGpuBuffersReused, true);
        assert.deepEqual(cycle.state, run.gpu.state, 'closed retained continuation does not rebase U');
        for (let i = 0; i < 2; i += 1) {
          near(cycle.thermo[i * 12 + 2], 310, .001, 'retained phase-specific T');
          assert.equal(cycle.thermo[i * 12 + 1], i ? 3 : 2);
        }
      }
    }
  }
});
