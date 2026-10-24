import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';

const REQUIRED = ['tests/sphVaporAerosolExchange.native.test.mjs',
  'src/runtime/sph/sphSpatialGasLedgerEosGpu.js', 'src/runtime/sph/sphSpatialGasCaloricAdmission.js',
  'src/runtime/sph/sphVaporAerosolExchangeGpu.js', 'src/runtime/sph/sphVaporAerosolExchangeWgsl.js',
  'ulg-gpu-abi/src/sphVaporAerosolExchange.js', 'src/runtime/sph/sphAerosolParcelGpu.js',
  'src/runtime/material/condensableThermodynamics.js', 'src/runtime/sph/schroederSpatialSuccessorSourceFamily.js'];
const sha = (data) => createHash('sha256').update(data).digest('hex');
async function freeze(path, previous = null) {
  const contents = await readFile(path, 'utf8');
  if (previous !== null) assert.equal(contents, previous, 'source manifest changed');
  const rows = contents.trim().split('\n').map((line) => {
    const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line); assert.ok(match, line);
    return { hash: match[1], path: resolve(match[2]) };
  });
  for (const path of REQUIRED) assert.ok(rows.some((row) => row.path === resolve(path)), path);
  for (const row of rows) assert.equal(sha(await readFile(row.path)), row.hash, row.path);
  return { contents, rows, hash: sha(contents) };
}

test('native exact EOS vapor/aerosol writer conserves real candidate buffers without kinetic admission', {
  skip: process.env.ULG_RUN_NATIVE_VAPOR_AEROSOL_EXCHANGE !== '1', timeout: 240_000
}, async () => {
  const output = process.env.ULG_VAPOR_AEROSOL_EXCHANGE_EVIDENCE;
  const manifestPath = process.env.ULG_VAPOR_AEROSOL_EXCHANGE_SOURCE_MANIFEST;
  assert.ok(isAbsolute(output || '') && isAbsolute(manifestPath || ''));
  const manifest = await freeze(manifestPath);
  const baseUrl = process.env.ULG_VAPOR_AEROSOL_EXCHANGE_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/';
  assert.equal(new URL(baseUrl).protocol, 'https:');
  const evidence = { schema: 'peercompute.ulg.native-vapor-aerosol-conservative-candidate.v1',
    started: new Date().toISOString(), baseUrl, sourceManifest: { path: manifestPath, sha256: manifest.hash },
    headed: true, desktop: 'Wayland', ignoreHTTPSErrors: false,
    manufacturedModelsAndTransfers: true, realGpuWrites: true,
    kineticAuthorization: false, exchangeIntervalAdmitted: false, outerPublicationAdmitted: false,
    chemistryValidation: false, plumeValidation: false, presetEnrollment: false };
  let browser, watchdog, watchdogClose, failure;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    const owned = browser;
    watchdog = setTimeout(() => {
      failure ??= new Error('Owned vapor/aerosol browser exceeded 210 second watchdog');
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
        const response = await fetch(parent); if (!response.ok) throw new Error('Dependency HTTP ' + response.status);
        const code = await response.text();
        const path = [...code.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)].map((m) => m[1])
          .find((p) => p.split('?')[0].endsWith('/' + file));
        if (!path) throw new Error('Missing dependency: ' + file);
        return new URL(path, new URL(parent, location.href)).href;
      };
      const hierarchyUrl = '/src/runtime/sph/schroederHierarchyGpu.js';
      const stepUrl = await dep(hierarchyUrl, 'sphMlsMpmGpuStep.js');
      const eosUrl = await dep(stepUrl, 'sphSpatialGasLedgerEosGpu.js');
      const caloricUrl = await dep(eosUrl, 'sphSpatialGasCaloricAdmission.js');
      const pairUrl = await dep(eosUrl, 'schroederSpatialSuccessorSourceFamily.js');
      const parcelUrl = await dep(eosUrl, 'sphAerosolParcelGpu.js');
      const [eos, caloric, thermal, pair, parcels, buffers, identity, modelModule, spatial, history, tx,
        topology, stateModule, materials, optics, summary, limits, hierarchy] = await Promise.all([
        import(eosUrl), import(caloricUrl), import(await dep(caloricUrl, 'sphThermalGpuKernel.js')),
        import(pairUrl), import(parcelUrl), import(await dep(eosUrl, 'sphGpuBuffers.js')),
        import(await dep(eosUrl, 'sphGpuDeviceIdentity.js')),
        import(await dep(caloricUrl, 'condensableThermodynamics.js')),
        import(await dep(eosUrl, 'schroederSpatialEpochGpu.js')),
        import(await dep(eosUrl, 'sphResidentProductHistoryGpu.js')),
        import(await dep(pairUrl, 'schroederSpatialEpochTransaction.js')),
        import(await dep(pairUrl, 'schroederSpatialTopologyTransitionGpu.js')),
        import('/src/runtime/sph/sphState.js'), import('/src/runtime/material/materialClosures.js'),
        import('/src/runtime/material/opticalGpuBuffers.js'), import('/src/runtime/sph/sphReactionGpuSummary.js'),
        import('/src/runtime/webgpuDeviceLimits.js'), import(hierarchyUrl)
      ]);
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('Native WebGPU adapter unavailable');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter) || {});
      const errors = [], cases = [], ownedBuffers = [], generations = [], publications = [], retained = [], aerosolFamilies = [];
      const pipelineLabels = [], realCreate = device.createComputePipeline.bind(device);
      device.createComputePipeline = (descriptor) => { pipelineLabels.push(descriptor.label); return realCreate(descriptor); };
      device.addEventListener('uncapturederror', (event) => errors.push(String(event.error?.message || event.error)));
      for (const kind of ['validation', 'internal', 'out-of-memory']) device.pushErrorScope(kind);
      const make = (label, values) => {
        const raw = device.createBuffer({ label, size: values.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
        ownedBuffers.push(raw); const buffer = identity.tagWebGpuBufferDevice(raw, device);
        device.queue.writeBuffer(buffer, 0, values); return buffer;
      };
      const read = async (buffer) => {
        const copy = device.createBuffer({ size: buffer.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        try {
          const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, copy, 0, buffer.size);
          device.queue.submit([encoder.finish()]); await copy.mapAsync(GPUMapMode.READ);
          const data = copy.getMappedRange().slice(0); copy.unmap(); return data;
        } finally { copy.destroy(); }
      };
      const epochsOf = (uploads) => Object.fromEntries(['storageGeneration', 'physicsTick', 'physicsSubstep',
        'positionEpoch', 'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch']
        .map((key) => [key, uploads.sphParticleUpload[key]]));
      const grid = { selectedLevel: 0, gridDims: [9, 9, 9], gridNodeCount: 729, gridShift: 2, gridSpacingM: 1 };
      const occupancy = (uploads, state, thermo) => {
        const sph = uploads.sphParticleUpload, mls = uploads.mlsMpmParticleUpload, count = sph.particleCount;
        const rows = new Float32Array(count * 16);
        for (let i = 0; i < count; i++) {
          const m = state[i * 8 + 3], rho = thermo[i * 12 + 3], v = m / rho;
          rows.set([0, 1, 1, v, v, v, m, rho, thermo[i * 12 + 1], thermo[i * 12],
            thermo[i * 12 + 10], 0, ...state.slice(i * 8, i * 8 + 3), 0], i * 16);
        }
        const assignmentBuffer = make('exchange-fixture-assignment', rows);
        const assignment = { schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
          status: 'schroeder-level-assignment-submitted', bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready',
          particleCount: count, assignmentStrideFloats: 16, assignmentBuffer, assignmentBufferByteLength: assignmentBuffer.size,
          minLevel: 0, maxLevel: 0, chartId: 0, baseGridSpacingM: 1,
          sourceStateBuffer: sph.stateBuffer, sourceStateBufferBorrowed: true, sourceStateBufferByteLength: sph.stateBuffer.size,
          sourceThermoBuffer: sph.thermoBuffer, sourceThermoBufferBorrowed: true, sourceThermoBufferByteLength: sph.thermoBuffer.size,
          sourceIdentityBuffer: sph.identityBuffer, sourceIdentityBufferBorrowed: true, sourceIdentityBufferByteLength: sph.identityBuffer.size,
          sourceMechanicsBuffer: mls.mechanicsBuffer, sourceMechanicsBufferBorrowed: true, sourceMechanicsBufferByteLength: mls.mechanicsBuffer.size,
          ...epochsOf(uploads) };
        const generation = spatial.runSchroederSpatialEpochGenerationWebGpu({ device, levelAssignment: assignment,
          particleCount: count, particleIdentityBuffer: sph.identityBuffer, particleIdentityStrideWords: sph.identityStrideBytes / 4,
          selectedLevel: 0, mechanicsGrid: grid, exactNearCellTreeEnabled: false });
        if (!generation.ready) throw new Error(generation.reason || generation.status);
        generations.push(generation); return { assignment, generation };
      };
      let fatalError = null;
      try {
        for (const config of [
          { name: 'particle-condensation' }, { name: 'particle-evaporation', evaporation: true },
          { name: 'particle-and-product', product: true }, { name: 'independent-gauges', product: true, shifts: [500000, -1000000] },
          { name: 'mass-overdraft', dm: 0.1 }, { name: 'unrepresentable-transfer', dm: 1e-25 },
          { name: 'unrepresentable-evaporation', dm: -1e-25 },
          { name: 'unrepresentable-product-transfer', productOnly: true, dm: 1e-25 },
          { name: 'unrepresentable-subnormal-mass-with-heat', dm: 2 ** -149, onlyHeatProposals: true },
          { name: 'nonexact-rounded-credit', liquidMass: .001, dm: .001955 },
          { name: 'unsupported-affine-energy', affine: true }, { name: 'noncolocated-transfer', offset: true },
          { name: 'missing-surface-model', noSurface: true }, { name: 'overlapping-proposals', overlap: true },
          { name: 'out-of-domain-heat', heat: 1e20 }, { name: 'unadmitted-inert-calorics', omitInert: true },
          { name: 'heat-mixture-graph', heatGraph: true, heatPass: true },
          { name: 'heat-mixture-permuted', heatGraph: true, heatPass: true, reverse: true },
          { name: 'heat-mixture-gauges', heatGraph: true, heatPass: true, shifts: [500000, -1000000] },
          { name: 'heat-exact-cancellation', heatGraph: true, heatPass: true, packets: [2 ** 100, 1, -(2 ** 100)] },
          { name: 'heat-exact-cancellation-permuted', heatGraph: true, heatPass: true, packets: [2 ** 100, -(2 ** 100), 1] },
          { name: 'heat-zero-net', heatGraph: true, heatPass: true, packets: [64, -64] },
          { name: 'heat-sub-ulp', heatGraph: true, packets: [1e-25], numericFailure: true },
          { name: 'heat-subnormal', heatGraph: true, packets: [2 ** -149], numericFailure: true },
          { name: 'heat-unrepresentable-sum', heatGraph: true, packets: [2 ** 24, 1], numericFailure: true },
          { name: 'heat-sum-overflow', heatGraph: true, packets: [2 ** 127, 2 ** 127], numericFailure: true },
          { name: 'heat-noncolocated-inert', heatGraph: true, offsetInert: true },
          { name: 'heat-domain-rejection', heatGraph: true, packets: [1e20] },
          { name: 'heat-mass-overlap', heatGraph: true, overlapMass: true }
        ]) {
          const ordinal = cases.length + 1, shifts = config.shifts || [0, 0], properties = {}, models = {};
          const reference = materials.createReferenceMaterialClosures().h2o.properties;
          for (const [i, material] of ['h2o', 'nh3'].entries()) {
            const Rs = i ? 200 : 100, Cp = i ? 2000 : 4000;
            models[material] = modelModule.createCondensableThermodynamics({
              schema: 'peercompute.ulg.condensable-thermodynamics.v1', energyBasis: 'specific-enthalpy-at-reference-pressure',
              referenceTemperatureK: 300, referencePressurePa: 3000, liquidReferenceEnthalpyJPerKg: -50000 + shifts[i],
              vaporizationReferenceEnthalpyJPerKg: 200000, liquidCpJPerKgK: Cp, vaporCpJPerKgK: Cp,
              liquidDensityKgPerM3: 1000, molarMassKgPerMol: 8.314462618 / Rs, minTemperatureK: 200,
              maxTemperatureK: 450, maxPressurePa: 2000000, provenance: 'manufactured conservative writer model' });
            properties[material] = { ...reference, molarMassKgPerMol: 8.314462618 / Rs,
              phases: reference.phases.map((phase) => ({ ...phase,
                ...(phase.name === 'liquid' ? { cpJPerKgK: Cp, densityKgPerM3: 1000 } : {}),
                ...(phase.name === 'gas' ? { cpJPerKgK: Cp, densityKgPerM3: 3000 / (Rs * 300),
                  bulkModulusPa: null, shearModulusPa: 0, surfaceTensionNPerM: 0 } : {}) })) };
          }
          const uGas = (i, T) => (i ? 90000 : 120000) + shifts[i] + (i ? 1800 : 3900) * (T - 300);
          const uLiquid = (T) => -50003 + shifts[0] + 4000 * (T - 300);
          const state = stateModule.createSphState({ smoothingLengthM: 1, particles: [
            { material: 'h2o', massKg: .01, x: [.25, .25, .25], v: [3, 1, -.5],
              specificInternalEnergyJPerKg: uGas(0, 280), phaseCaloric: { phaseId: 3, phaseFractions: [0, 0, 1, 0] } },
            { material: 'nh3', massKg: .02, x: [config.heatGraph && !config.offsetInert ? .25 : .35, .25, .25], v: [.3, -.1, .2],
              specificInternalEnergyJPerKg: uGas(1, 320), phaseCaloric: { phaseId: 3, phaseFractions: [0, 0, 1, 0] } }
          ] });
          // createSphState intentionally accepts only its minimal state fields;
          // the actual cold packer reads these explicit optional particle data.
          state.particles[0].visualRestParticleRadiusM = .05;
          if (config.affine) state.particles[0].mpmC = [1, 0, 0, 0, 0, 0, 0, 0, 0];
          const options = { materialProperties: properties, condensableThermodynamicsByMaterial: models,
            soundSpeedScale: 1, cflMaxSoundSpeedMPerS: 0, minGasSoundSpeedMPerS: 0 };
          const packed = buffers.buildSphGpuParticleBuffers(state, options), packedMls = buffers.buildMlsMpmGpuParticleBuffers(state, options);
          const sph = buffers.uploadSphGpuParticleBuffers(device, packed), mls = buffers.uploadMlsMpmGpuParticleBuffers(device, packedMls);
          ownedBuffers.push(sph.stateBuffer, sph.thermoBuffer, sph.identityBuffer, mls.mechanicsBuffer);
          const aerosol = parcels.createSphAerosolParcelFamilyWebGpu({ device, capacity: 2,
            provenance: { kind: 'initial-conditions', reference: 'manufactured explicit wet droplets, no default nuclei' },
            parcels: [0, 1].map((i) => ({ slot: i, parcelId: BigInt(i + 1), nucleusPopulationId: BigInt(i + 11),
              physicalMultiplicity: (1n << 40n) + 13n, sourceLineageIndex: 0xffffffff, sourceTopologyEpoch: 0,
              materialId: optics.stableOpticalMaterialId('h2o'), phaseId: 2, massKg: config.liquidMass ?? .02,
              positionM: [config.heatGraph ? .25 : i ? .3 : config.offset ? .251 : .25, .25, .25],
              velocityMPerS: i ? [-.4, .2, .3] : [-2, .5, .25], specificInternalEnergyJPerKg: uLiquid(300),
              temperatureK: 300, condensedDensityKgM3: 1000 })) });
          aerosolFamilies.push(aerosol); sph.aerosolFamily = aerosol;
          const epochs = { storageGeneration: ordinal * 10, physicsTick: 1, physicsSubstep: 0,
            positionEpoch: 1, topologyEpoch: 1, chartEpoch: 0, levelEpoch: 1, supportEpoch: 1 };
          Object.assign(sph, epochs); Object.assign(mls, epochs);
          const cold = { sphParticleUpload: sph, mlsMpmParticleUpload: mls }, coldSs = occupancy(cold, packed.state, packed.thermo);
          const table = thermal.buildSphThermalMaterialTable(properties, options);
          const authority = caloric.createSphSpatialGasCaloricAuthority({ thermalMaterialTable: table,
            condensableThermodynamicsByMaterial: config.omitInert ? { h2o: models.h2o } : models });
          const rows = new Float32Array(5 * 32), M = models.h2o.molarMassKgPerMol;
          rows.set([config.heatGraph ? .25 : .3, .25, .25, .03, optics.stableOpticalMaterialId('h2o'), 0]);
          rows[9] = .03 / M; rows[10] = 1; rows[11] = 3; rows[12] = .01; rows[13] = .02;
          rows[16] = 360; rows[17] = .1; rows[18] = 1; rows[19] = uGas(0, 360);
          rows.set([2, -1, .25, .3], 20); rows[27] = Math.sqrt((1 + 100 / 3900) * 100 * 360);
          rows[28] = 2; rows[30] = 1;
          rows.set(rows.slice(0, 32), 32); rows[32 + 12] = .03; rows[32 + 13] = 0;
          rows.set(rows.slice(0, 32), 64); rows[64 + 3] = .005; rows[64 + 9] = .005 / M;
          rows[64 + 10] = 2; rows[64 + 11] = 2; rows[64 + 12] = .002; rows[64 + 13] = .003;
          rows[64 + 16] = 300; rows[64 + 17] = 1000; rows[64 + 19] = uLiquid(300); rows[64 + 23] = .000005;
          const productBuffer = make('exchange-manufactured-product-history', rows);
          const product = summary.createResidentProductMassHandle({ productEventBuffer: productBuffer, productEventDevice: device,
            productEventBufferRetained: true, productEventBufferByteLength: rows.byteLength, productEventRowCount: 5,
            productEventActiveEventCount: 3, destroyProductEventBuffer: () => productBuffer.destroy() });
          identity.tagResidentProductMassDevice(product, device);
          const countBuffer = make('exchange-manufactured-history-count', history.createResidentProductEventCountControlWords({
            liveRowCount: 3, rowCapacity: 5, rowStrideVec4: 8, generation: ordinal, seal: 0x12200000 + ordinal }));
          history.registerResidentProductEventCountAuthority(product, { device, controlBuffer: countBuffer,
            controlOffsetBytes: 0, rowCapacity: 5, rowStrideFloats: 32, generation: ordinal, seal: 0x12200000 + ordinal });
          const next = { sphParticleUpload: { ...sph, ...epochs, storageGeneration: epochs.storageGeneration + 1, physicsTick: 2,
            stateBuffer: make('exchange-published-state', packed.state), thermoBuffer: make('exchange-published-thermo', packed.thermo) },
          mlsMpmParticleUpload: { ...mls, ...epochs, storageGeneration: epochs.storageGeneration + 1, physicsTick: 2,
            mechanicsBuffer: make('exchange-published-mechanics', packedMls.mechanics) }, residentProductMass: product };
          const transaction = tx.createSchroederSpatialEpochTransaction({ device, generation: coldSs.generation, ...cold, requiredReaderIds: [] });
          const top = await topology.runSchroederSpatialTopologyTransitionWebGpu({ device, generation: coldSs.generation,
            sourceStateBuffer: sph.stateBuffer, successorStateBuffer: next.sphParticleUpload.stateBuffer, successorParticleCount: packed.particleCount });
          topology.applySchroederSpatialTopologyTransitionReceipt(next, top, { generation: coldSs.generation });
          const position = await pair.runSchroederSpatialPositionTransitionWebGpu({ device, generation: coldSs.generation,
            sourceStateBuffer: sph.stateBuffer, successorStateBuffer: next.sphParticleUpload.stateBuffer, successorParticleCount: packed.particleCount });
          pair.applySchroederSpatialPositionTransitionReceipt(next, position, { generation: coldSs.generation });
          const publicationPlan = await pair.prepareSchroederSpatialSuccessorSourceFamilyPublication({
            transaction, generation: coldSs.generation, lookupLevelAssignment: coldSs.assignment,
            nextParticleUploads: next, topologyTransitionReceipt: top, positionTransitionReceipt: position,
            successorLevelAssignmentRunner: ({ sphParticleUpload, mlsMpmParticleUpload }) =>
              hierarchy.runSchroederLevelAssignmentWebGpu({ device, sphParticleState: packed, mlsMpmParticleState: packedMls,
                sphParticleUpload, mlsMpmParticleUpload, baseGridSpacingM: 1, minLevel: 0, maxLevel: 0,
                chartId: 0, retainAssignmentBuffer: true, readbackMode: 'no-full-readback' }) });
          tx.sealSchroederSpatialEpochTransactionReaders(transaction); tx.sealSchroederSpatialEpochTransactionProposals(transaction);
          const commitReceipt = tx.commitSchroederSpatialEpochTransaction(transaction, { nextParticleUploads: next });
          const publication = pair.publishPreparedSchroederSpatialSuccessorSourceFamily(publicationPlan, { commitReceipt });
          if (!publication.published) throw new Error(publication.reason || publication.status);
          const family = publication.sourceFamily;
          publications.push(family);
          const parent = pair.acquireSchroederSpatialSuccessorSourceFamilyLease(family, { device, consumerStage: 'native-exchange' });
          const retirement = pair.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device, reason: 'native retained reader' });
          const assignment = next.schroederSpatialSuccessorLevelAssignment;
          const currentGeneration = spatial.runSchroederSpatialEpochGenerationWebGpu({ device,
            levelAssignment: assignment, particleCount: packed.particleCount, particleIdentityBuffer: sph.identityBuffer,
            particleIdentityStrideWords: sph.identityStrideBytes / 4, selectedLevel: 0, mechanicsGrid: grid, exactNearCellTreeEnabled: false });
          if (!currentGeneration.ready) throw new Error(currentGeneration.reason || currentGeneration.status);
          generations.push(currentGeneration);
          const currentSs = { assignment, generation: currentGeneration };
          const currentTransaction = tx.createSchroederSpatialEpochTransaction({ device,
            generation: currentSs.generation, ...next, aerosolSourceFamilyConsumerLease: parent,
            requiredReaderIds: [] });
          const execution = await eos.runSphSpatialGasLedgerEosRetainedWebGpu({ device, ...next,
            schroederLevelAssignment: currentSs.assignment, schroederSpatialEpochGeneration: currentSs.generation,
            epochIdentity: epochsOf(next), spatialGasGrid: grid, boxMinM: [0, 0, 0], boxMaxM: [4, 4, 4],
            spatialGasCellSizeM: 1, spatialGasSupportVolumeFallbackM3: 0, authenticateParticleProductSource: true,
            sourceFamilyConsumerLease: parent, caloricAuthority: authority, caloricThermalMaterialTable: table });
          retained.push(execution); if (!execution.ready) throw new Error(execution.reason || execution.status);
          const parcelRead = parcels.acquireSphAerosolParcelRead({ family: aerosol, device, expectedGeneration: 0 });
          const sourceBuffers = [next.sphParticleUpload.stateBuffer, next.sphParticleUpload.thermoBuffer,
            next.mlsMpmParticleUpload.mechanicsBuffer, productBuffer, parcelRead.buffer, countBuffer];
          const before = await Promise.all(sourceBuffers.map(read));
          const surfaces = config.noSurface ? {} : { h2o: { schema: 'peercompute.ulg.linear-pure-interface.v1',
            provenance: 'manufactured nonzero surface energy', interceptNPerM: .2, slopeNPerMK: -.0002,
            minTemperatureK: 200, maxTemperatureK: 450 } };
          const materialData = caloric.resolveSphSpatialGasExchangeMaterials(authority, { thermalMaterialTable: table, surfaceModels: surfaces });
          const edge = { gasKind: 0, gasIndex: 0, parcelIndex: 0, materialRow: materialData.materials.indexOf('h2o'),
            deltaMassKg: config.dm ?? (config.evaporation ? -.001 : .001), transportEnthalpyCorrectionJ: 1.25,
            conductiveHeatJ: config.heat ?? -2.5, pressureWorkIntoLiquidJ: -.1 };
          if (config.onlyHeatProposals) Object.assign(edge, { transportEnthalpyCorrectionJ: 0,
            conductiveHeatJ: 1, pressureWorkIntoLiquidJ: 0 });
          if (config.productOnly) { edge.gasKind = 1; edge.parcelIndex = 1; }
          const edges = [edge];
          if (config.product) edges.push({ ...edge, gasKind: 1, gasIndex: 0, parcelIndex: 1, deltaMassKg: .002 });
          if (config.overlap) edges.push({ ...edge, parcelIndex: 1 });
          if (config.heatGraph) {
            const heat = (gasKind, gasIndex, parcelIndex, conductiveHeatJ) => ({
              gasKind, gasIndex, parcelIndex, deltaMassKg: 0, transportEnthalpyCorrectionJ: 0,
              pressureWorkIntoLiquidJ: 0, conductiveHeatJ,
              materialRow: materialData.materials.indexOf(gasKind === 0 && gasIndex === 1 ? 'nh3' : 'h2o')
            });
            edges.splice(0, edges.length, ...(config.packets
              ? config.packets.map((q) => heat(0, 0, 0, q))
              : [heat(0, 0, 0, -64), heat(0, 1, 0, 32), heat(1, 0, 0, 16),
                heat(0, 0, 1, -16), heat(0, 1, 1, 64), heat(1, 0, 1, 32)]));
            if (config.reverse) edges.reverse();
            if (config.overlapMass) edges.push(edge);
          }
          let candidate = null, thrown = null, blockedRelease = null, replayRejected = false, copiedRejected = false;
          try {
            const pending = eos.runSphSpatialVaporAerosolExchangeCandidate(execution, { surfaceModels: surfaces, edges });
            blockedRelease = eos.releaseSphSpatialGasLedgerEosAfterQueue(execution) === false;
            candidate = await pending;
          } catch (error) { thrown = String(error.message); }
          if (candidate?.ready) {
            try { await eos.runSphSpatialVaporAerosolExchangeCandidate(execution, { surfaceModels: surfaces, edges }); }
            catch { replayRejected = true; }
            try { await eos.observeSphSpatialVaporAerosolExchangeCandidate({ ...candidate }); }
            catch { copiedRejected = true; }
          }
          const after = await Promise.all(sourceBuffers.map(read));
          const sourceUnchanged = before.every((value, i) => JSON.stringify([...new Uint8Array(value)]) === JSON.stringify([...new Uint8Array(after[i])]));
          parcels.releaseSphAerosolParcelRead(parcelRead);
          eos.releaseSphSpatialGasLedgerEosAfterQueue(execution); const eosReleased = await execution.releasePromise;
          tx.abortSchroederSpatialEpochTransaction(currentTransaction, 'native conservation-only source read complete');
          const parentRelease = await pair.releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(family, parent,
            { device, after: device.queue.onSubmittedWorkDone() });
          const retired = await retirement;
          // Real candidate allocation survives complete original EOS/family retirement.
          const observed = candidate?.ready ? await eos.observeSphSpatialVaporAerosolExchangeCandidate(candidate) : null;
          const result = observed ? Object.fromEntries(Object.entries(observed)
            .map(([key, value]) => [key, ArrayBuffer.isView(value) ? [...value] : value])) : null;
          const candidateReleased = candidate?.ready ? await eos.releaseSphSpatialVaporAerosolExchangeCandidate(candidate) : null;
          const sourceReleases = [];
          for (const generation of [coldSs.generation, currentSs.generation]) {
            spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device); sourceReleases.push(await generation.releasePromise);
          }
          const coldTransactionReleased = await tx.scheduleSchroederSpatialEpochTransactionRelease(transaction,
            { after: coldSs.generation.releasePromise });
          cases.push({ name: config.name, shifts, edges, heatPass: config.heatPass ?? false,
            numericFailure: config.numericFailure ?? false, sourceUnchanged, eosReleased, parentRelease, retired, sourceReleases,
            blockedRelease, replayRejected, copiedRejected, thrown, candidateReleased, coldTransactionReleased,
            candidate: candidate ? { ready: candidate.ready, status: candidate.status, receipt: candidate.receipt,
              kineticAuthorization: candidate.kineticAuthorization, exchangeIntervalAdmitted: candidate.exchangeIntervalAdmitted,
              outerPublicationAdmitted: candidate.outerPublicationAdmitted } : null,
            before: { state: [...new Float32Array(before[0])], thermo: [...new Float32Array(before[1])],
              mechanics: [...new Float32Array(before[2])], products: [...new Float32Array(before[3])],
              parcels: [...new Uint32Array(before[4])], count: [...new Uint32Array(before[5])] }, result });
        }
      } catch (error) { fatalError = String(error?.stack || error); }
      finally {
        try { await device.queue.onSubmittedWorkDone(); } catch (error) { errors.push(String(error)); }
        for (const execution of retained) if (!execution.released) {
          eos.releaseSphSpatialGasLedgerEosAfterQueue(execution); await execution.releasePromise;
        }
        for (const generation of generations) if (!generation.execution.released) {
          spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device); await generation.releasePromise;
        }
        for (const family of publications) {
          try { pair.retireSchroederSpatialSuccessorSourceFamily(family, { device, reason: 'native cleanup' }); } catch { /* device loss below */ }
        }
        for (const family of aerosolFamilies) parcels.releaseSphAerosolParcelFamily(family);
        for (const buffer of new Set(ownedBuffers)) buffer.destroy();
        for (const kind of ['out-of-memory', 'internal', 'validation']) {
          const error = await device.popErrorScope(); if (error) errors.push(kind + ': ' + error.message);
        }
        device.destroy();
      }
      return { servedSources, cases, errors, fatalError, pipelineLabels };
    }, { sources: REQUIRED.map((path) => ({ path, hash: manifest.rows.find((row) => row.path === resolve(path)).hash })) });
  } catch (error) { failure ??= error; evidence.harnessError = String(error?.stack || error); }
  finally {
    clearTimeout(watchdog); if (watchdogClose) await watchdogClose;
    if (browser) { await browser.close(); evidence.ownedBrowserClosed = !browser.isConnected(); }
    try { await freeze(manifestPath, manifest.contents); evidence.sourceFreezeUnchanged = true; }
    catch (error) { failure ??= error; evidence.sourceFreezeError = String(error); }
    evidence.finished = new Date().toISOString();
    await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (failure) throw failure;
  assert.equal(evidence.ownedBrowserClosed, true);
  assert.equal(evidence.observed.fatalError, null);
  assert.deepEqual(evidence.observed.errors, []);
  assert.equal(evidence.observed.cases.length, 29);
  for (const c of evidence.observed.cases) {
    assert.equal(c.sourceUnchanged, true, c.name);
    assert.equal(c.blockedRelease, true, c.name);
    assert.equal(c.eosReleased, true, c.name);
    assert.equal(c.parentRelease.released, true, c.name);
    assert.equal(c.retired.retired, true, c.name);
    assert.equal(c.coldTransactionReleased, true, c.name);
    assert.ok(c.sourceReleases.every((value) => value === true), c.name);
    if (!c.heatPass && !['particle-condensation', 'particle-evaporation', 'particle-and-product', 'independent-gauges'].includes(c.name)) {
      assert.ok(c.thrown || c.candidate?.ready === false, c.name);
      if (c.numericFailure || c.name.startsWith('unrepresentable-') || c.name === 'nonexact-rounded-credit') {
        assert.equal(c.thrown, null, c.name + ': genuine GPU numeric refusal, not fixture failure');
        assert.ok((c.candidate.receipt.errorBits & (1 << 12)) !== 0, c.name + ': numeric error bit');
      }
      continue;
    }
    assert.equal(c.thrown, null, c.name); assert.equal(c.candidate.ready, true, c.name);
    assert.equal(c.replayRejected, true, c.name); assert.equal(c.copiedRejected, true, c.name);
    assert.equal(c.candidateReleased, true, c.name);
    for (const key of ['kineticAuthorization', 'exchangeIntervalAdmitted', 'outerPublicationAdmitted']) assert.equal(c.candidate[key], false);
    if (c.heatPass) verifyHeatConservation(c); else verifyConservation(c);
  }
  for (const stage of ['initialize', 'apply', 'finalize']) {
    assert.equal(evidence.observed.pipelineLabels.filter((label) => label === 'ulg-' + stage + '_vapor_aerosol_exchange').length,
      1, 'one shared kernel per stage, not a compilation for each material/reaction');
  }
  const ordinary = evidence.observed.cases.find((c) => c.name === 'particle-and-product').result;
  const shifted = evidence.observed.cases.find((c) => c.name === 'independent-gauges').result;
  near(shifted.thermoValues[2], ordinary.thermoValues[2], 'gas gauge invariance', 0, .0005);
  near(shifted.productEventValues[16], ordinary.productEventValues[16], 'product gauge invariance', 0, .0005);
  for (let p = 0; p < 2; p++) near(floats(shifted.parcelWords)[p * 24 + 8], floats(ordinary.parcelWords)[p * 24 + 8],
    'liquid gauge invariance', 0, .0005);
  for (const [left, right] of [['heat-mixture-graph', 'heat-mixture-permuted'],
    ['heat-exact-cancellation', 'heat-exact-cancellation-permuted']]) {
    const a = evidence.observed.cases.find((c) => c.name === left).result;
    const b = evidence.observed.cases.find((c) => c.name === right).result;
    for (const key of ['stateValues', 'thermoValues', 'mechanicsValues', 'productEventValues', 'parcelWords', 'surfaceValues']) {
      assert.deepEqual(a[key], b[key], `${left}: ${key} edge-order invariance`);
    }
  }
});

const floats = (words) => [...new Float32Array(new Uint32Array(words).buffer)];
// Independent host oracle: exact signed integer sum of supplied f32 packets.
// It does not duplicate the GPU's limb arithmetic or use its aggregate output.
function exactHeatSum(edges) {
  const word = new Uint32Array(1), f = new Float32Array(word.buffer);
  let units = 0n;
  for (const edge of edges) {
    f[0] = edge.conductiveHeatJ;
    const bits = word[0], exponent = (bits >>> 23) & 255;
    const significand = BigInt((bits & 0x7fffff) | (exponent ? 0x800000 : 0));
    units += (bits >>> 31 ? -significand : significand) << BigInt(Math.max(0, exponent - 1));
  }
  return Number(units) * 2 ** -149;
}

function verifyHeatConservation(c) {
  const b = c.before, r = c.result, old = floats(b.parcels), next = floats(r.parcelWords);
  let energyChange = 0, absolutePackets = 0;
  for (let i = 0; i < 2; i++) {
    const q = -exactHeatSum(c.edges.filter((e) => e.gasKind === 0 && e.gasIndex === i));
    const s = i * 8, t = i * 12, m = i * 32;
    const actual = b.state[s + 3] * (r.stateValues[s + 7] - b.state[s + 7]);
    near(actual, q, c.name + ': actual particle heat', 1e-5, 0);
    energyChange += actual; absolutePackets += Math.abs(q);
    for (let lane = 0; lane < 8; lane++) if (lane !== 7) assert.equal(r.stateValues[s + lane], b.state[s + lane]);
    for (let lane = 0; lane < 12; lane++) if (lane !== 2) assert.equal(r.thermoValues[t + lane], b.thermo[t + lane]);
    for (let lane = 0; lane < 32; lane++) if (lane !== 25) assert.equal(r.mechanicsValues[m + lane], b.mechanics[m + lane]);
    const cv = i ? 1800 : 3900, Rs = i ? 200 : 100;
    near(r.thermoValues[t + 2], b.thermo[t + 2] + q / (b.state[s + 3] * cv), 'actual species temperature', 0, .0005);
    near(r.mechanicsValues[m + 25], Math.sqrt((1 + Rs / cv) * Rs * r.thermoValues[t + 2]), 'heat-updated sound');
    if (!q) assert.equal(r.stateValues[s + 7], b.state[s + 7]);
  }
  const qp = -exactHeatSum(c.edges.filter((e) => e.gasKind === 1));
  const actualProduct = b.products[13] * (r.productEventValues[19] - b.products[19]);
  near(actualProduct, qp, 'actual residual product heat', 1e-5, 0);
  energyChange += actualProduct; absolutePackets += Math.abs(qp);
  assert.equal(r.productEventValues[3], b.products[13]); assert.equal(r.productEventValues[13], b.products[13]);
  near(r.productEventValues[16], b.products[16] + qp / (b.products[13] * 3900), 'product temperature', 0, .0005);
  near(r.productEventValues[27], Math.sqrt((1 + 100 / 3900) * 100 * r.productEventValues[16]), 'product sound');
  for (let lane = 0; lane < 32; lane++) if (![3, 9, 12, 13, 16, 19, 23, 27].includes(lane)) {
    assert.equal(r.productEventValues[lane], b.products[lane]);
  }
  for (let i = 0; i < 2; i++) {
    const p = i * 24, q = exactHeatSum(c.edges.filter((e) => e.parcelIndex === i));
    const actual = old[p + 3] * (next[p + 7] - old[p + 7]);
    near(actual, q, 'actual parcel heat', 1e-5, 0);
    energyChange += actual; absolutePackets += Math.abs(q);
    near(next[p + 8], old[p + 8] + q / (old[p + 3] * 4000), 'parcel temperature', 0, .0005);
    for (let lane = 0; lane < 24; lane++) if (lane !== 7 && lane !== 8) assert.equal(r.parcelWords[p + lane], b.parcels[p + lane]);
    if (!q) assert.equal(r.parcelWords[p + 7], b.parcels[p + 7]);
    assert.equal(r.surfaceValues[i * 4], r.surfaceValues[i * 4 + 2]);
    assert.equal(r.surfaceValues[i * 4 + 1], r.surfaceValues[i * 4 + 3]);
  }
  assert.ok(Math.abs(energyChange) <= 1e-5 * absolutePackets, 'whole graph packet-scaled conservation');
  const live = r.productCountWords[3];
  assert.equal(live, b.count[3]);
  for (let i = 0; i < live * 32; i += 32) {
    assert.equal(r.productEventValues[i + 12], 0);
    assert.equal(r.productEventValues[i + 3], r.productEventValues[i + 13]);
  }
  assert.ok(r.productEventValues.slice(live * 32).every((v) => v === 0));
}
const near = (a, b, label, rel = 2e-5, abs = 2e-7) => assert.ok(Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= abs + rel * Math.max(Math.abs(a), Math.abs(b)), `${label}: ${a} vs ${b}`);
function budget(state, products, parcelWords, surface) {
  const result = { mass: 0, momentum: [0, 0, 0], firstMoment: [0, 0, 0], energy: 0 };
  const add = (m, x, v, u) => {
    if (m === 0) return;
    result.mass += m; result.energy += m * (u + .5 * v.reduce((s, x) => s + x * x, 0));
    for (let i = 0; i < 3; i++) { result.momentum[i] += m * v[i]; result.firstMoment[i] += m * x[i]; }
  };
  for (let i = 0; i < state.length; i += 8) add(state[i + 3], state.slice(i, i + 3), state.slice(i + 4, i + 7), state[i + 7]);
  for (let i = 0; i < products.length; i += 32) add(products[i + 13], products.slice(i, i + 3), products.slice(i + 20, i + 23), products[i + 19]);
  const parcel = floats(parcelWords);
  for (let i = 0; i < parcel.length; i += 24) {
    add(parcel[i + 3], parcel.slice(i, i + 3), parcel.slice(i + 4, i + 7), parcel[i + 7]);
    result.energy += surface[i / 24];
  }
  return result;
}
function verifyConservation(c) {
  const { before: b, result: r } = c;
  const oldParcel = floats(b.parcels), newParcel = floats(r.parcelWords);
  const area = (m, N) => 4 * Math.PI * N * (3 * m / (4 * Math.PI * 1000 * N)) ** (2 / 3);
  const oldSurface = [], newSurface = [];
  for (let p = 0; p < b.parcels.length / 24; p++) {
    const i = p * 24, N = Number(BigInt(b.parcels[i + 14]) + (BigInt(b.parcels[i + 15]) << 32n));
    oldSurface.push(.2 * area(oldParcel[i + 3], N)); newSurface.push(.2 * area(newParcel[i + 3], N));
    near(r.surfaceValues[p * 4], area(oldParcel[i + 3], N), 'old area');
    near(r.surfaceValues[p * 4 + 1], oldSurface[p], 'old surface internal energy');
    near(r.surfaceValues[p * 4 + 2], area(newParcel[i + 3], N), 'new area');
    near(r.surfaceValues[p * 4 + 3], newSurface[p], 'new surface internal energy');
    for (let lane = 12; lane < 24; lane++) assert.equal(r.parcelWords[i + lane], b.parcels[i + lane], 'exact identity/population/provenance');
  }
  const a = budget(b.state, b.products, b.parcels, oldSurface);
  const z = budget(r.stateValues, r.productEventValues, r.parcelWords, newSurface);
  near(z.mass, a.mass, 'total physical mass', 1e-6);
  near(z.energy, a.energy, 'bulk + translational KE + surface energy', 3e-6, .003);
  for (let i = 0; i < 3; i++) {
    near(z.momentum[i], a.momentum[i], 'total momentum', 3e-6);
    near(z.firstMoment[i], a.firstMoment[i], 'total first moment', 3e-6);
  }
  // Nonparticipant inert particle is bitwise unchanged, not heated to the
  // EOS's diagnostic equilibrium temperature.
  assert.deepEqual(r.stateValues.slice(8), b.state.slice(8));
  assert.deepEqual(r.thermoValues.slice(12), b.thermo.slice(12));
  assert.deepEqual(r.mechanicsValues.slice(32), b.mechanics.slice(32));
  for (const e of c.edges) {
    const g = e.gasIndex * (e.gasKind ? 32 : 8), p = e.parcelIndex * 24;
    const mg = e.gasKind ? b.products[g + 13] : b.state[g + 3], ml = oldParcel[p + 3];
    const ug = e.gasKind ? b.products[g + 19] : b.state[g + 7], ul = oldParcel[p + 7];
    const vg = e.gasKind ? b.products.slice(g + 20, g + 23) : b.state.slice(g + 4, g + 7);
    const vl = oldParcel.slice(p + 4, p + 7);
    const actualGasMass = e.gasKind ? r.productEventValues[g + 13] : r.stateValues[g + 3];
    const dm = mg - actualGasMass, d = Math.abs(dm);
    assert.equal(dm, newParcel[p + 3] - ml, 'exact common representable debit/credit');
    assert.ok(dm !== 0 && Math.sign(dm) === Math.sign(e.deltaMassKg));
    near(dm, Math.fround(e.deltaMassKg), 'requested transfer packing budget', 1e-5, 0);
    const receiverMass = dm > 0 ? ml : mg;
    const mix = .5 * d * receiverMass / (receiverMass + d) * vg.reduce((s, v, i) => s + (v - vl[i]) ** 2, 0);
    const donorU = dm > 0 ? ug : ul, q = e.transportEnthalpyCorrectionJ + e.conductiveHeatJ + e.pressureWorkIntoLiquidJ;
    const expectedGasU = (mg * ug - dm * donorU - q + (dm < 0 ? mix : 0)) / (mg - dm);
    const expectedLiquidU = (ml * ul + dm * donorU + q + (dm > 0 ? mix : 0)
      - newSurface[e.parcelIndex] + oldSurface[e.parcelIndex]) / (ml + dm);
    const actualGasU = e.gasKind ? r.productEventValues[g + 19] : r.stateValues[g + 7];
    const actualGasT = e.gasKind ? r.productEventValues[g + 16] : r.thermoValues[e.gasIndex * 12 + 2];
    near(actualGasU, expectedGasU, 'donor-resolved gas energy');
    near(newParcel[p + 7], expectedLiquidU, 'independent liquid energy');
    near(actualGasT, 300 + (expectedGasU - 120000 - c.shifts[0]) / 3900, 'gas caloric inverse');
    near(newParcel[p + 8], 300 + (expectedLiquidU + 50003 - c.shifts[0]) / 4000, 'liquid caloric inverse');
    const actualGasVelocity = e.gasKind ? r.productEventValues.slice(g + 20, g + 23) : r.stateValues.slice(g + 4, g + 7);
    for (let lane = 0; lane < 3; lane++) {
      const donorV = dm > 0 ? vg[lane] : vl[lane];
      near(actualGasVelocity[lane], (mg * vg[lane] - dm * donorV) / (mg - dm), 'gas momentum update');
      near(newParcel[p + 4 + lane], (ml * vl[lane] + dm * donorV) / (ml + dm), 'liquid momentum update');
    }
    const N = Number(BigInt(b.parcels[p + 14]) + (BigInt(b.parcels[p + 15]) << 32n));
    near(newParcel[p + 10], (3 * (ml + dm) / (4 * Math.PI * 1000 * N)) ** (1 / 3), 'physical droplet radius', 2e-5, 0);
    const expectedSoundSpeed = Math.sqrt((1 + 100 / 3900) * 100 * actualGasT);
    if (!e.gasKind) {
      near(r.stateValues[g + 3], mg - dm, 'particle mass debit');
      near(r.mechanicsValues[e.gasIndex * 32 + 19], (mg - dm) / b.thermo[e.gasIndex * 12 + 3], 'rest volume');
      assert.equal(r.mechanicsValues[e.gasIndex * 32 + 28], b.mechanics[e.gasIndex * 32 + 28], 'pressure awaits successor EOS');
      near(r.mechanicsValues[e.gasIndex * 32 + 31], mg - dm, 'phase volume reference mass');
      near(r.mechanicsValues[e.gasIndex * 32 + 25], expectedSoundSpeed, 'gas sound speed');
      near(r.thermoValues[e.gasIndex * 12 + 9], b.thermo[e.gasIndex * 12 + 9] * (mg - dm) / mg, 'represented molecules');
      assert.equal(r.thermoValues[e.gasIndex * 12 + 8], b.thermo[e.gasIndex * 12 + 8], 'chosen smoothing resolution preserved');
      near(r.thermoValues[e.gasIndex * 12 + 11], b.thermo[e.gasIndex * 12 + 11] * ((mg - dm) / mg) ** (1 / 3), 'authored display radius');
    } else {
      near(r.productEventValues[g + 13], mg - dm, 'product residual debit');
      near(r.productEventValues[g + 27], expectedSoundSpeed, 'product sound speed');
    }
    near(newParcel[p + 3], ml + dm, 'liquid mass credit');
  }
  const liveCount = r.productCountWords[3];
  assert.equal(liveCount, b.count[3]);
  assert.equal(r.productCountWords[4], 5);
  assert.notEqual(r.productCountWords[7], b.count[7], 'new logical history seal');
  for (let i = 0; i < liveCount * 32; i += 32) {
    assert.equal(r.productEventValues[i + 12], 0, 'new history is residual-only, not cumulative produced mass');
    near(r.productEventValues[i + 3], r.productEventValues[i + 13], 'residual partition');
  }
  assert.ok(r.productEventValues.slice(liveCount * 32).every((v) => v === 0), 'zero tail');
}
