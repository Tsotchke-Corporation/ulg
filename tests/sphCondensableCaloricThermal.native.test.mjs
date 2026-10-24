import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';

// Explicit, independently chosen synthetic enthalpy reference. This is not a
// water calibration, a nucleation experiment, or preset/plume acceptance.
const RECORD = Object.freeze({
  schema: 'peercompute.ulg.condensable-thermodynamics.v1',
  energyBasis: 'specific-enthalpy-at-reference-pressure',
  referenceTemperatureK: 300, referencePressurePa: 3000,
  liquidReferenceEnthalpyJPerKg: -50_000,
  vaporizationReferenceEnthalpyJPerKg: 200_000,
  liquidCpJPerKgK: 4000, vaporCpJPerKgK: 4000,
  liquidDensityKgPerM3: 1000, molarMassKgPerMol: 8.314462618 / 100,
  minTemperatureK: 200, maxTemperatureK: 450, maxPressurePa: 2_000_000,
  provenance: 'independent synthetic native explicit-phase thermal integration fixture'
});
const ONEHOT = (phase) => [0, phase === 2 ? 1 : 0, phase === 3 ? 1 : 0, 0];
const U = (phase, temperature) => (phase === 2 ? -50_003 : 120_000)
  + (phase === 2 ? 4000 : 3900) * (temperature - 300);
const NEGATIVES = Object.freeze([
  { name: 'wrong-solid-phase', phaseId: 1, fractions: [1, 0, 0, 0], energy: 34_200 },
  { name: 'fractional-phase', phaseId: 2.9, fractions: [0, 0, 1, 0], energy: 34_200,
    canonicalRejectionBoundary: 'spatial-source-projection' },
  { name: 'mixed-phase', phaseId: 3, fractions: [0, 0.5, 0.5, 0], energy: 34_200 },
  { name: 'opposite-onehot', phaseId: 3, fractions: [0, 1, 0, 0], energy: 34_200 },
  { name: 'gas-outside-own-domain', phaseId: 3, fractions: [0, 0, 1, 0], energy: -300_000 },
  { name: 'liquid-outside-own-domain', phaseId: 2, fractions: [0, 1, 0, 0], energy: 600_000 }
]);
const REQUIRED_SOURCES = [
  'tests/sphCondensableCaloricThermal.test.mjs',
  'tests/sphCondensableCaloricThermal.native.test.mjs',
  'src/runtime/material/condensableThermodynamics.js',
  'src/runtime/sph/sphCondensableCaloricTable.js',
  'src/runtime/sph/sphThermalGpuKernel.js',
  'src/runtime/sph/schroederSpatialThermalProposalsGpu.js',
  'src/runtime/sph/sphPhaseCarrierTransferGpu.js',
  'src/runtime/sph/sphMechanicsRefreshGpuKernel.js',
  'ulg-gpu-abi/src/wgsl.js'
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function checkManifest(path, originalText = null) {
  const text = await readFile(path, 'utf8');
  if (originalText !== null) assert.equal(text, originalText, 'source manifest itself changed');
  const entries = text.trim().split('\n').map((line) => {
    const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    assert.ok(match, `expected sha256sum source manifest row: ${line}`);
    return { hash: match[1], path: resolve(match[2]) };
  });
  for (const required of REQUIRED_SOURCES) {
    assert.ok(entries.some((entry) => entry.path === resolve(required)),
      `source freeze must cover ${required}`);
  }
  for (const entry of entries) {
    assert.equal(sha(await readFile(entry.path)), entry.hash, `source freeze drift: ${entry.path}`);
  }
  return { text, hash: sha(text), entries };
}

test('native explicit-phase caloric thermal uses live GPU phase/Cv and survives two real closure cycles', {
  skip: process.env.ULG_RUN_NATIVE_CONDENSABLE_CALORIC_THERMAL === '1'
    ? false : 'set ULG_RUN_NATIVE_CONDENSABLE_CALORIC_THERMAL=1 after source freeze',
  timeout: 180_000
}, async () => {
  const evidencePath = process.env.ULG_CONDENSABLE_CALORIC_THERMAL_EVIDENCE;
  const manifestPath = process.env.ULG_CONDENSABLE_CALORIC_THERMAL_SOURCE_MANIFEST;
  assert.ok(evidencePath && isAbsolute(evidencePath), 'new absolute evidence file is required');
  assert.ok(manifestPath && isAbsolute(manifestPath), 'absolute frozen source manifest is required');
  const manifest = await checkManifest(manifestPath);
  const started = new Date().toISOString();
  const baseUrl = process.env.ULG_CONDENSABLE_CALORIC_THERMAL_BASE_URL
    || 'https://fastbox.tail5c077c.ts.net:5173/';
  assert.equal(new URL(baseUrl).protocol, 'https:', 'native WebGPU requires strict HTTPS');
  const evidence = { schema: 'peercompute.ulg.native-condensable-caloric-thermal-proof.v1',
    started, baseUrl, sourceManifest: { path: manifestPath, sha256: manifest.hash },
    inputRecord: RECORD, browser: '/usr/bin/google-chrome', headed: true,
    desktop: 'Wayland', ignoreHTTPSErrors: false, scientificValidation: false,
    presetAdmission: false, nucleationValidation: false, fullPlumeValidation: false };
  let browser = null;
  let failure = null;
  let watchdog = null;
  let watchdogClose = null;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan',
        '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    const ownedBrowser = browser;
    watchdog = setTimeout(() => {
      failure ??= new Error('Owned native browser exceeded the 150 second watchdog');
      evidence.watchdogTimeoutMs = 150_000;
      // node:test cancellation alone does not stop an outstanding GPU await.
      // Close only the browser process created by this test, never user tabs.
      watchdogClose = ownedBrowser.close().then(() => {
        evidence.ownedBrowserClosed = true;
      }).catch((error) => {
        evidence.watchdogCloseError = String(error);
      });
    }, 150_000);
    const page = await browser.newPage({ ignoreHTTPSErrors: false });
    await page.goto(new URL('/package.json', baseUrl).href);
    evidence.observed = await page.evaluate(async ({ record, negatives, frozenSources }) => {
      const servedSources = [];
      for (const source of frozenSources) {
        // Vite's raw import exposes the exact source bytes, not the transformed
        // module. Verify the remote server before allocating a GPU device.
        const url = new URL('/' + source.path + '?raw', location.href).href;
        const raw = (await import(url)).default;
        if (typeof raw !== 'string') throw new Error(`Raw source unavailable: ${source.path}`);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== source.hash) throw new Error(`Served source differs from freeze: ${source.path}`);
        servedSources.push({ path: source.path, sha256: hash, rawSourceUrl: url });
      }
      const urls = {};
      const dependency = async (url, file) => {
        const fetched = await fetch(url);
        if (!fetched.ok) throw new Error(`${url}: HTTP ${fetched.status}`);
        const code = await fetched.text();
        const path = [...code.matchAll(/from\s+["']([^"']+)["']/g)]
          .map((match) => match[1]).find((entry) => entry.split('?')[0].endsWith('/' + file));
        if (!path) throw new Error(`Missing exact transformed dependency ${file} in ${url}`);
        return new URL(path, new URL(url, location.href)).href;
      };
      // Follow the actual thermal root rather than creating cache-busted copies
      // of device/transaction/model modules with private WeakMap identities.
      urls.thermal = new URL('/src/runtime/sph/sphThermalGpuKernel.js', location.href).href;
      urls.caloric = await dependency(urls.thermal, 'sphCondensableCaloricTable.js');
      urls.model = await dependency(urls.caloric, 'condensableThermodynamics.js');
      urls.proposal = await dependency(urls.thermal, 'schroederSpatialThermalProposalsGpu.js');
      urls.spatial = await dependency(urls.thermal, 'schroederSpatialEpochGpu.js');
      urls.transaction = await dependency(urls.proposal, 'schroederSpatialEpochTransaction.js');
      urls.identity = await dependency(urls.thermal, 'sphGpuDeviceIdentity.js');
      urls.transfer = new URL('/src/runtime/sph/sphPhaseCarrierTransferGpu.js', location.href).href;
      urls.refresh = new URL('/src/runtime/sph/sphMechanicsRefreshGpuKernel.js', location.href).href;
      for (const [parent, file, expected] of [
        [urls.proposal, 'sphGpuDeviceIdentity.js', urls.identity],
        [urls.spatial, 'sphGpuDeviceIdentity.js', urls.identity],
        [urls.transfer, 'sphGpuDeviceIdentity.js', urls.identity],
        [urls.refresh, 'sphGpuDeviceIdentity.js', urls.identity],
        [urls.proposal, 'schroederSpatialEpochGpu.js', urls.spatial]
      ]) {
        const actual = await dependency(parent, file);
        if (actual !== expected) throw new Error(`Private source identity mismatch: ${actual} != ${expected}`);
      }
      const [thermal, thermodynamics, proposalModule, spatial, transactionModule, identity,
        transfer, refresh, abi, materials, optics, energyModule, limits] = await Promise.all([
        import(urls.thermal), import(urls.model), import(urls.proposal), import(urls.spatial),
        import(urls.transaction), import(urls.identity), import(urls.transfer), import(urls.refresh),
        import('/ulg-gpu-abi/src/index.js'), import('/src/runtime/material/materialClosures.js'),
        import('/src/runtime/material/opticalGpuBuffers.js'),
        import('/src/runtime/material/thermoState.js'), import('/src/runtime/webgpuDeviceLimits.js')
      ]);
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('native WebGPU adapter unavailable');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter) || {});
      const errors = [];
      device.addEventListener('uncapturederror', (event) => errors.push(String(event.error?.message || event.error)));
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');
      const resources = [];
      const retainedOutputs = [];
      const runs = [];
      let fatalError = null;
      let ordinal = 0;
      const phaseFractions = (phase) => [0, phase === 2 ? 1 : 0, phase === 3 ? 1 : 0, 0];
      const specificEnergy = (phase, temperature) => (phase === 2 ? -50_003 : 120_000)
        + (phase === 2 ? 4000 : 3900) * (temperature - 300);
      const materialId = optics.stableOpticalMaterialId('h2o');
      const properties = { h2o: { ...materials.createReferenceMaterialClosures().h2o.properties } };
      properties.h2o.phases = properties.h2o.phases.map((phase) => ({ ...phase,
        thermalConductivityWPerMK: phase.name === 'gas' ? 0.025 : 0.6,
        thermalConductivityProvenance: { source: 'synthetic native integration fixture', phase: phase.name }
      }));
      const model = thermodynamics.createCondensableThermodynamics(record);
      const noRadiation = (table) => {
        const records = table.records.slice();
        for (let index = 4; index < records.length; index += 8) records[index] = 0;
        return { ...table, records };
      };
      const table = noRadiation(thermal.buildSphThermalMaterialTable(properties, {
        condensableThermodynamicsByMaterial: { h2o: model }
      }));
      const reversedTable = { ...table,
        segments: new Float32Array([...table.segments.slice(12), ...table.segments.slice(0, 12)]),
        segmentMetadata: [...table.segmentMetadata].reverse() };
      const legacyTable = noRadiation(thermal.buildSphThermalMaterialTable(properties));
      const mechanicsTable = {
        schema: 'peercompute.ulg.mls-mpm-mechanics-material-table.v0',
        status: 'mechanics-material-table-ready', phaseRecordCount: 2, recordStrideFloats: 12,
        records: new Float32Array([
          materialId, 2, 1000, 1, 0, 0, 1, 1, 0, 1, 0, 0,
          materialId, 3, 0.1, 1, 0, 0, 1, 2, 0, 1, 0, 0
        ])
      };
      const makeBuffer = (name, values) => {
        const buffer = identity.tagWebGpuBufferDevice(device.createBuffer({ label: name,
          size: Math.max(16, values.byteLength), usage: GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST }), device);
        device.queue.writeBuffer(buffer, 0, values);
        resources.push(buffer);
        return buffer;
      };
      const read = async (buffer, bytes = buffer.size) => {
        const copy = device.createBuffer({ size: bytes,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        try {
          const encoder = device.createCommandEncoder();
          encoder.copyBufferToBuffer(buffer, 0, copy, 0, bytes);
          device.queue.submit([encoder.finish()]);
          await copy.mapAsync(GPUMapMode.READ);
          const result = copy.getMappedRange().slice(0);
          copy.unmap();
          return result;
        } finally { copy.destroy(); }
      };
      const fixture = (name, bodies) => {
        ordinal += 1;
        const capacity = bodies.length;
        const count = capacity * 4;
        const phaseCarrierPlan = { schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
          status: 'phase-lane-capacity-ready', lineageCapacity: capacity, primaryCapacity: capacity,
          phaseLaneCount: 4, phaseLaneStride: capacity, companionStart: capacity,
          companionCapacity: capacity * 3, particleCapacity: count,
          stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex', phaseCompanionLanesRequired: true };
        const state = new Float32Array(count * 8);
        const thermo = new Float32Array(count * 12);
        const mechanics = new Float32Array(count * 32);
        const active = [];
        bodies.forEach((body, lineage) => {
          // Invalid phase fixtures still occupy a declared gas address; they
          // only run thermal rejection, never claim a valid transfer lineage.
          const phase = body.phaseId ?? 3;
          const index = ((phase === 2 ? 2 : 3) - 1) * capacity + lineage;
          active.push(index);
          const temperature = body.temperature ?? 278;
          const energy = body.energy ?? specificEnergy(phase, temperature);
          const density = phase === 2 ? 1000 : 0.1;
          state.set([...(body.position || [2, 2, 2]), 1, 0, 0, 0, energy], index * 8);
          thermo.set([materialId, phase, body.cachedTemperature ?? temperature, density,
            ...(body.fractions || phaseFractions(phase)), 1, 10, 1, 0.1], index * 12);
          mechanics[index * 32] = 1;
          mechanics[index * 32 + 4] = 1;
          mechanics[index * 32 + 8] = 1;
          mechanics.set([1, 1 / density, 0, 1, 1, 0, 0, 1,
            phase === 2 ? 1 : 2, 1, 3000, 0, 0, 1], index * 32 + 18);
        });
        const packed = { schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count,
          smoothingLengthM: 1, phaseCarrierPlan, state, thermo };
        const packedMls = { schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount: count, mechanics };
        const epoch = { storageGeneration: ordinal, physicsTick: ordinal, physicsSubstep: 0,
          positionEpoch: ordinal, topologyEpoch: ordinal, chartEpoch: 1, levelEpoch: 1, supportEpoch: 1 };
        const stateBuffer = makeBuffer(name + '-state', state);
        const thermoBuffer = makeBuffer(name + '-thermo', thermo);
        const mechanicsBuffer = makeBuffer(name + '-mechanics', mechanics);
        const identityBuffer = makeBuffer(name + '-identities',
          Uint32Array.from({ length: count }, (_, index) => index + 1));
        const sphUpload = { schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: 'webgpu-uploaded', particleCount: count, stateBuffer, thermoBuffer, identityBuffer,
          stateBufferByteLength: state.byteLength, thermoBufferByteLength: thermo.byteLength,
          identityBufferByteLength: count * 4, stateStrideBytes: 32, thermoStrideBytes: 48,
          identityStrideBytes: 4, phaseCarrierPlan, ...epoch };
        const mlsUpload = { schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: 'webgpu-uploaded', particleCount: count, mechanicsBuffer,
          mechanicsBufferByteLength: mechanics.byteLength, mechanicsStrideBytes: 128, ...epoch };
        return { name, packed, packedMls, sphUpload, mlsUpload, epoch, active,
          current: { stateBuffer, thermoBuffer, mechanicsBuffer } };
      };

      const thermalRun = async (f, { canonical = false, materialTable = table,
        wall = false, dtS = wall ? 0.1 : 0.001, conductionRate = 0 } = {}) => {
        let generation = null;
        let proposal = null;
        let stage = null;
        let responseUpload = null;
        let assignments = null;
        let submitted = false;
        try {
          if (canonical) {
            assignments = new Float32Array(f.packed.particleCount * 16);
            for (let i = 0; i < f.packed.particleCount; i += 1) {
              const mass = f.packed.state[i * 8 + 3];
              const density = f.packed.thermo[i * 12 + 3];
              const volume = mass > 0 ? mass / density : 0;
              // Production's valid dormant assignment has status1, with exact
              // +0 support/volumes/mass. Preserve every source phase/material,
              // including fractional negative input: that must reject at the
              // spatial boundary, not masquerade as a caloric-only negative.
              assignments.set([0, 1, mass > 0 ? 2 : 0, volume, volume, volume, mass, density,
                f.packed.thermo[i * 12 + 1], f.packed.thermo[i * 12], 1, 0,
                ...f.packed.state.slice(i * 8, i * 8 + 3), 0], i * 16);
            }
            const assignmentBuffer = makeBuffer(f.name + '-assignment', assignments);
            const levelAssignment = { schema: abi.ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
              status: 'schroeder-level-assignment-submitted',
              bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready',
              particleCount: f.packed.particleCount, assignmentStrideFloats: 16,
              assignmentBuffer, assignmentBufferByteLength: assignments.byteLength,
              sourceStateBuffer: f.current.stateBuffer, sourceStateBufferBorrowed: true,
              sourceThermoBuffer: f.current.thermoBuffer, sourceThermoBufferBorrowed: true,
              sourceIdentityBuffer: f.sphUpload.identityBuffer, sourceIdentityBufferBorrowed: true,
              sourceMechanicsBuffer: f.current.mechanicsBuffer, sourceMechanicsBufferBorrowed: true,
              minLevel: 0, maxLevel: 0, chartId: 0, baseGridSpacingM: 1, ...f.epoch };
            generation = spatial.runSchroederSpatialEpochGenerationWebGpu({ device, levelAssignment,
              particleCount: f.packed.particleCount, particleIdentityBuffer: f.sphUpload.identityBuffer,
              particleIdentityStrideWords: 1, mechanicsLevels: [] });
            if (!generation.ready || !generation.selected) {
              throw new Error(`Actual canonical source rejected: ${generation.status}: ${generation.reason}`);
            }
            const consumerSupportProfileIds = Object.fromEntries(proposalModule.SCHROEDER_SPATIAL_THERMAL_CONSUMERS
              .map((consumer) => [consumer.consumerId, consumer.supportProfileId]));
            const transaction = transactionModule.createSchroederSpatialEpochTransaction({ device, generation,
              sphParticleUpload: f.sphUpload, mlsMpmParticleUpload: f.mlsUpload, requiredReaderIds: [],
              enabledConsumerReaderIds: Object.keys(consumerSupportProfileIds), consumerSupportProfileIds });
            responseUpload = thermal.uploadSphThermalResponseGraphBuffers(device, {
              thermalMaterialTable: materialTable });
            proposal = proposalModule.runSchroederSpatialThermalProposalWebGpu({ device, generation,
              schroederSpatialEpochTransaction: transaction, sphParticleState: f.packed,
              sphParticleUpload: f.sphUpload, mlsMpmParticleUpload: f.mlsUpload,
              thermalResponseGraphUpload: responseUpload, dtS, smoothingLengthM: 1, conductionRate });
            if (!proposal.ready) throw new Error(`Actual canonical proposal rejected: ${proposal.status}`);
          }
          stage = thermal.createSphThermalStepWebGpuEncoderStage({ device, sphParticleState: f.packed,
            thermalMaterialTable: materialTable, sphParticleUpload: f.sphUpload,
            sourceStateBuffer: f.current.stateBuffer, sourceThermoBuffer: f.current.thermoBuffer,
            proposalStateBuffer: f.current.stateBuffer, proposalThermoBuffer: f.current.thermoBuffer,
            thermalResponseGraphUpload: responseUpload, wallModel: wall ? undefined : 'adiabatic',
            wallTemperaturesK: wall ? { xMin: 298 } : {}, wallLayerM: wall ? 1 : 0,
            wallRate: wall ? 2600 : 0, dtS, conductionRate, boxDimsM: [4, 4, 4],
            retainOutputParticleBuffers: true, readbackMode: 'full-parity-readback',
            schroederSpatialEpochGeneration: generation, schroederSpatialThermalProposal: proposal });
          const encoder = device.createCommandEncoder({ label: f.name + '-actual-thermal' });
          stage.encode(encoder);
          device.queue.submit([encoder.finish()]);
          submitted = true;
          stage.markSubmittedWork();
          const state = Array.from(new Float32Array(await read(stage.stateBuffer, f.packed.state.byteLength)));
          const thermo = Array.from(new Float32Array(await read(stage.thermoBuffer, f.packed.thermo.byteLength)));
          const derived = proposal ? await read(proposal.thermalDerivedBudgetBuffer, proposal.activeDerivedByteLength) : null;
          const proposalData = proposal ? await read(proposal.proposalBuffer, proposal.activeProposalByteLength) : null;
          const activeSourceWords = generation ? new Uint32Array(await read(
            generation.activeSourceView.activeSourceViewBuffer, generation.activeSourceView.layout.byteLength)) : null;
          const directoryWords = generation ? new Uint32Array(await read(
            generation.execution.directoryBuffer, generation.execution.layout.wordLength * 4)) : null;
          const sourceThermo = Array.from(new Float32Array(await read(
            f.current.thermoBuffer, f.packed.thermo.byteLength)));
          const out = { name: f.name, active: f.active, state, thermo,
            backend: stage.result.backend, neighborLookupMode: stage.result.neighborLookupMode,
            encodedProposalDispatchCount: stage.encodedProposalDispatchCount,
            encodedDispatchCount: stage.encodedDispatchCount,
            sourceStateUnchanged: JSON.stringify(Array.from(new Float32Array(
              await read(f.current.stateBuffer, f.packed.state.byteLength)))) === JSON.stringify(Array.from(f.packed.state)),
            ...(derived ? {
              assignmentRows: Array.from(assignments),
              sourceThermo,
              spatial: {
                activeSourceHeader: Array.from(activeSourceWords.slice(0, 64)),
                directoryHeader: Array.from(directoryWords.slice(0, 48)),
                activeToPhysical: Array.from(activeSourceWords.slice(activeSourceWords[25],
                  activeSourceWords[25] + activeSourceWords[18])),
                physicalToActive: Array.from(activeSourceWords.slice(activeSourceWords[26],
                  activeSourceWords[26] + f.packed.particleCount)),
                physicalToCellPlusOne: Array.from(directoryWords.slice(directoryWords[32],
                  directoryWords[32] + f.packed.particleCount))
              },
              derivedHeader: Array.from(new Uint32Array(derived, 0,
                proposalModule.SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS)),
              derivedRows: f.active.map((index) => Array.from(new Float32Array(derived,
                4 * (proposalModule.SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS + index * 10), 8))),
              proposalRows: f.active.map((index) => Array.from(new Float32Array(proposalData,
                4 * (proposalModule.SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS + index * 4), 4)))
            } : {}) };
          const buffers = { stateBuffer: stage.stateBuffer, thermoBuffer: stage.thermoBuffer,
            mechanicsBuffer: f.current.mechanicsBuffer };
          retainedOutputs.push(stage.result);
          stage.cleanupSubmittedWork();
          return { out, buffers };
        } finally {
          if (submitted) await device.queue.onSubmittedWorkDone();
          if (stage) (submitted ? stage.cleanupSubmittedWork() : stage.cleanupAbortedWork());
          proposal?.releaseAfterCanonicalApplySubmittedWork?.();
          if (generation) {
            spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
            await generation.releasePromise;
          }
          if (responseUpload) thermal.destroySphThermalResponseGraphBuffers(responseUpload);
        }
      };

      try {
        const f = fixture('two-real-zero-heat-cycles', [{ cachedTemperature: 999 }]);
        for (let cycle = 1; cycle <= 2; cycle += 1) {
          const heat = await thermalRun(f);
          const moved = await transfer.runSphPhaseCarrierTransferWebGpu({ device,
            sphParticleState: f.packed, mlsMpmParticleState: f.packedMls,
            thermalMaterialTable: table, mechanicsMaterialTable: mechanicsTable,
            ...{ sourceStateBuffer: heat.buffers.stateBuffer, sourceThermoBuffer: heat.buffers.thermoBuffer,
              sourceMechanicsBuffer: heat.buffers.mechanicsBuffer },
            retainOutputParticleBuffers: true, readbackMode: 'full-parity-readback' });
          retainedOutputs.push(moved);
          const refreshed = await refresh.runMlsMpmMechanicsRefreshWebGpu({ device,
            sphParticleState: f.packed, mlsMpmParticleState: f.packedMls,
            mechanicsMaterialTable: mechanicsTable, sourceStateBuffer: moved.stateBuffer,
            sourceThermoBuffer: moved.thermoBuffer, sourceMechanicsBuffer: moved.mechanicsBuffer,
            retainOutputParticleBuffers: true, readbackMode: 'full-parity-readback' });
          retainedOutputs.push(refreshed);
          runs.push({ ...heat.out, cycle, transferStatus: moved.status,
            invalidLineageCount: moved.invalidLineageCount, transferEvidence: Array.from(moved.evidence),
            transferredState: Array.from(moved.state), transferredThermo: Array.from(moved.thermo),
            refreshStatus: refreshed.authorityValidationStatus,
            refreshFailureCount: refreshed.authorityValidationFailureCount,
            refreshedMechanics: Array.from(refreshed.mechanics),
            exactRetainedNextInput: true });
          // No host reconstruction/rebasing: next thermal consumes exact prior
          // transfer S/T and refresh M buffers. CPU arrays remain stale on purpose.
          f.current = { stateBuffer: moved.stateBuffer, thermoBuffer: moved.thermoBuffer,
            mechanicsBuffer: refreshed.mechanicsBuffer };
        }
        for (const canonical of [false, true]) {
          const route = canonical ? 'canonical' : 'classic';
          const pulse = fixture(route + '-wall-pulse', [{ position: [0.25, 2, 2], cachedTemperature: 999 }]);
          runs.push((await thermalRun(pulse, { canonical, wall: true })).out);
          for (const phaseId of [2, 3]) {
            const overlap = fixture(route + '-overlap-' + phaseId, [{ phaseId, energy: 34_200 }]);
            runs.push((await thermalRun(overlap, { canonical, materialTable: reversedTable })).out);
          }
          for (const negative of negatives) {
            const invalid = fixture(route + '-' + negative.name, [{ ...negative, position: [0.25, 2, 2] }]);
            runs.push((await thermalRun(invalid, { canonical, wall: true })).out);
          }
          for (const reversed of [false, true]) {
            const pair = fixture(route + '-finite-pair-' + (reversed ? 'reversed' : 'ordered'), [
              { temperature: 278, position: [1.5, 2, 2] },
              { temperature: 298, position: [2.5, 2, 2] }
            ]);
            runs.push((await thermalRun(pair, { canonical, dtS: 1000, conductionRate: 1500,
              materialTable: reversed ? reversedTable : table })).out);
          }
          const legacyU = energyModule.specificInternalEnergyJPerKg(properties.h2o, 298);
          const legacy = fixture(route + '-legacy-liquid-unchanged', [{ phaseId: 2, energy: legacyU,
            temperature: 298 }]);
          const legacyRun = (await thermalRun(legacy, { canonical, materialTable: legacyTable })).out;
          runs.push({ ...legacyRun, expectedLegacyU: Math.fround(legacyU) });
        }
      } catch (error) {
        fatalError = `${error?.name || 'Error'}: ${error?.message || error}\n${error?.stack || ''}`;
      } finally {
        try { await device.queue.onSubmittedWorkDone(); } catch (error) { errors.push(String(error)); }
        for (const output of retainedOutputs.reverse()) {
          try { output.destroyOutputParticleBuffers?.(); } catch (error) { errors.push(String(error)); }
        }
        for (const buffer of resources.reverse()) {
          try { buffer.destroy(); } catch (error) { errors.push(String(error)); }
        }
        for (const kind of ['out-of-memory', 'internal', 'validation']) {
          const error = await device.popErrorScope();
          if (error) errors.push(`${kind}: ${error.message}`);
        }
        device.destroy();
      }
      return { status: fatalError ? 'failed' : 'observed', fatalError, errors, moduleUrls: urls, servedSources,
        adapterInfo: { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture,
          device: adapter.info?.device, description: adapter.info?.description }, runs };
    }, { record: RECORD, negatives: NEGATIVES, frozenSources: REQUIRED_SOURCES.map((path) => ({
      path, hash: manifest.entries.find((entry) => entry.path === resolve(path)).hash
    })) });
  } catch (error) {
    failure ??= error;
    evidence.harnessError = `${error?.name || 'Error'}: ${error?.message || error}`;
  } finally {
    clearTimeout(watchdog);
    if (watchdogClose) await watchdogClose;
    if (browser) {
      try { await browser.close(); evidence.ownedBrowserClosed = true; }
      catch (error) { failure ??= error; evidence.browserCloseError = String(error); }
    }
    try { await checkManifest(manifestPath, manifest.text); evidence.sourceFreezeUnchanged = true; }
    catch (error) { failure ??= error; evidence.sourceFreezeError = String(error); }
    evidence.finished = new Date().toISOString();
    // Preserve observations before assertions, including failed native probes.
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (failure) throw failure;
  const observed = evidence.observed;
  assert.equal(observed.fatalError, null);
  assert.deepEqual(observed.errors, []);
  assert.equal(observed.servedSources.length, REQUIRED_SOURCES.length);
  assert.equal(observed.runs.length, 26);
  const near = (actual, expected, tolerance, label) => assert.ok(Number.isFinite(actual)
    && Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected} +/- ${tolerance}`);
  for (const run of observed.runs) {
    assert.equal(run.backend, 'webgpu', run.name);
    assert.ok(run.encodedProposalDispatchCount > 0, run.name + ': real proposal was encoded');
    assert.equal(run.encodedDispatchCount, run.encodedProposalDispatchCount + 1);
    assert.equal(run.sourceStateUnchanged, true, run.name + ': source S was overwritten');
    const negative = NEGATIVES.find((entry) => run.name.endsWith('-' + entry.name));
    if (run.name.startsWith('canonical-')) {
      assert.equal(run.neighborLookupMode, 'canonical-schroeder-spatial-thermal-proposals');
      assert.equal(run.derivedRows.length, run.active.length);
      const { activeSourceHeader: activeSource, directoryHeader: directory } = run.spatial;
      const physicalCount = run.state.length / 8;
      const activeCount = run.active.length;
      assert.equal(activeSource[0], 0x53535631, run.name + ': ActiveSource magic');
      assert.equal(activeSource[1], 1, run.name + ': ActiveSource version');
      assert.equal(directory[0], 0x53534531, run.name + ': directory magic');
      assert.equal(directory[1], 2, run.name + ': actual v2 directory');
      assert.equal(activeSource[16], physicalCount, run.name + ': physical domain');
      assert.equal(activeSource[32], physicalCount, run.name + ': every source classified');
      for (let index = 0; index < physicalCount; index += 1) {
        assert.equal(run.assignmentRows[index * 16 + 8], run.sourceThermo[index * 12 + 1],
          run.name + ': no manufactured assignment phase override');
        assert.equal(run.assignmentRows[index * 16 + 9], run.sourceThermo[index * 12],
          run.name + ': no manufactured assignment material override');
      }
      if (negative?.canonicalRejectionBoundary === 'spatial-source-projection') {
        assert.equal(activeSource[2], 13, run.name + ': fractional phase rejected by spatial source');
        assert.equal(activeSource[21], 1, run.name + ': exactly one structurally invalid source');
        assert.equal(activeSource[18], 0, run.name + ': no admitted active sources');
        assert.equal(activeSource[20], 0, run.name + ': dormant count not published on rejection');
        assert.equal(activeSource[30], 0, run.name + ': no completed spatial publication');
        assert.equal(directory[2] & 4, 4, run.name + ': directory failed closed');
        assert.equal(directory[2] & 2, 0, run.name + ': directory not admitted');
        assert.equal(directory[37], 0, run.name + ': directory publishes no active work');
        assert.equal(run.derivedHeader[5], 2, run.name + ': projection rejected before caloric selection');
        assert.deepEqual(run.derivedHeader.slice(6, 9), [0, 0, 0]);
      } else {
        assert.equal(activeSource[2], 3, run.name + ': real ActiveSource admission required');
        assert.equal(activeSource[18], activeCount);
        assert.equal(activeSource[20], physicalCount - activeCount);
        assert.deepEqual(activeSource.slice(21, 23), [0, 0], run.name + ': no invalid/overflow source');
        assert.deepEqual(activeSource.slice(33, 36), [activeCount, activeCount, activeCount]);
        assert.equal(activeSource[30], activeSource[29], run.name + ': completed exact build');
        assert.ok(activeSource[30] > 0 && activeSource[47] !== 0);
        assert.equal(directory[2], 3, run.name + ': directory admission required');
        assert.deepEqual(directory.slice(23, 25), [0, 0]);
        assert.equal(directory[37], activeCount);
        assert.deepEqual(directory.slice(3, 16), activeSource.slice(3, 16), run.name + ': exact source epoch');
        assert.deepEqual([...run.spatial.activeToPhysical].sort((a, b) => a - b), run.active);
        for (let index = 0; index < physicalCount; index += 1) {
          const ordinal = run.spatial.physicalToActive[index];
          const cell = run.spatial.physicalToCellPlusOne[index];
          if (run.active.includes(index)) {
            assert.ok(ordinal < activeCount && run.spatial.activeToPhysical[ordinal] === index);
            assert.ok(cell > 0 && cell <= directory[18]);
          } else {
            assert.equal(ordinal, 0xffffffff);
            assert.equal(cell, 0);
          }
        }
        assert.equal(run.derivedHeader[5], 1, run.name + ': thermal projection really admitted');
        assert.deepEqual(run.derivedHeader.slice(6, 9), [activeCount, activeCount, activeCount]);
        assert.equal(run.derivedHeader[9], 0, run.name + ': exact physical topology');
        // schroederSpatialThermalProposalsGpu.js: derive rejects selection,
        // then resolve_budget rejects that same carrier's invalid domain and
        // inverse. Both actual GPU passes increment derived header word1.
        assert.equal(run.derivedHeader[1], negative ? 2 : 0,
          run.name + ': caloric rejection is distinct from spatial no-op');
        if (!negative) {
          for (const derivedRow of run.derivedRows) {
            assert.ok(derivedRow[0] > 0 && derivedRow[1] > 0 && derivedRow[2] > 0,
              run.name + ': actual caloric temperature, slope, radius must be produced');
          }
        }
      }
    }
    const i = run.active[0];
    if (negative) {
      assert.equal(run.thermo[i * 12 + 10], 255, run.name + ': must reject, not select legacy');
      assert.equal(run.state[i * 8 + 7], negative.energy, run.name + ': heat rejected');
      assert.equal(run.state[i * 8 + 3], 1, run.name + ': mass copied');
      continue;
    }
    for (const index of run.active) {
      assert.equal(run.thermo[index * 12 + 10], 1, run.name);
      assert.equal(run.state[index * 8 + 3], 1, run.name);
    }
    if (run.cycle) {
      assert.equal(run.transferStatus, 'phase-carrier-transfer-complete');
      assert.equal(run.invalidLineageCount, 0);
      assert.equal(run.refreshStatus, 'mechanics-refresh-authority-accepted');
      assert.equal(run.refreshFailureCount, 0);
      assert.equal(run.exactRetainedNextInput, true);
      assert.deepEqual(run.transferredState, run.state, 'pure gas transfer preserves all S lanes');
      for (let index = 0; index < run.state.length / 8; index += 1) {
        assert.equal(run.transferredState[index * 8 + 3], index === i ? 1 : 0);
      }
      assert.equal(run.state[i * 8 + 7], U(3, 278));
      near(run.thermo[i * 12 + 2], 278, 4e-5, 'cool vapor T');
      near(run.transferredThermo[i * 12 + 2], 278, 4e-5, 'transfer cool vapor T');
      assert.deepEqual(run.transferredThermo.slice(i * 12 + 4, i * 12 + 8), ONEHOT(3));
      assert.equal(run.refreshedMechanics[i * 32 + 31], 1);
      continue;
    }
    if (run.name.includes('wall-pulse')) {
      // Qwall=2600*(298-278)*(1-.25/1)*.1=3900 J for mass1kg.
      near(run.state[i * 8 + 7], U(3, 278) + 3900, 0.05, run.name + ': independent wall Q');
      near(run.thermo[i * 12 + 2], 279, 4e-5, run.name + ': dT=Q/Cv, not Q/Cp');
      assert.equal(run.thermo[i * 12 + 1], 3);
    } else if (run.name.includes('overlap-')) {
      const phase = Number(run.name.at(-1));
      const expected = 300 + (34_200 - U(phase, 300)) / (phase === 2 ? 4000 : 3900);
      assert.equal(run.state[i * 8 + 7], 34_200);
      assert.equal(run.thermo[i * 12 + 1], phase);
      near(run.thermo[i * 12 + 2], expected, 4e-5, run.name + ': phase-qualified inverse');
      assert.deepEqual(run.thermo.slice(i * 12 + 4, i * 12 + 8), ONEHOT(phase));
    } else if (run.name.includes('finite-pair-')) {
      // Equal 1kg spheres at d=1m: A=pi*(r²-d²/4), Q=k*A/d*dT*dt.
      // This is below the independent quarter-equilibration safety limit.
      const r = Math.cbrt(3 / (4 * Math.PI * Math.fround(0.1)));
      const q = 0.025 * Math.PI * (r * r - 0.25) * 20 * 1000;
      assert.ok(q > 0 && q < 0.25 * 20 / (2 / 3900));
      for (const [ordinal, index] of run.active.entries()) {
        const initialT = ordinal === 0 ? 278 : 298;
        const dq = ordinal === 0 ? q : -q;
        near(run.state[index * 8 + 7], U(3, initialT) + dq, 0.05, run.name + ': independent pair Q');
        near(run.thermo[index * 12 + 2], initialT + dq / 3900, 8e-5, run.name + ': pair Cv');
        assert.deepEqual(run.thermo.slice(index * 12 + 4, index * 12 + 8), ONEHOT(3));
        if (run.derivedRows) {
          near(run.derivedRows[ordinal][0], initialT, 4e-5, run.name + ': actual prepass T');
          near(run.derivedRows[ordinal][1], 1 / 3900, 1e-10, run.name + ': actual prepass Cv');
          near(run.derivedRows[ordinal][6], U(3, 278), 0.1, run.name + ': reachable inverse lower');
          near(run.derivedRows[ordinal][7], U(3, 298), 0.1, run.name + ': reachable inverse upper');
          near(run.proposalRows[ordinal][0], dq, 0.05, run.name + ': actual proposal Q');
        }
      }
      near(run.active.reduce((sum, index) => sum + run.state[index * 8 + 7], 0),
        U(3, 278) + U(3, 298), 0.02, run.name + ': pair energy conservation');
    } else {
      assert.ok(run.name.endsWith('legacy-liquid-unchanged'));
      assert.equal(run.state[i * 8 + 7], run.expectedLegacyU);
      assert.equal(run.thermo[i * 12 + 1], 2);
      near(run.thermo[i * 12 + 2], 298, 1e-4, run.name + ': unchanged default legacy ladder');
    }
  }
});
