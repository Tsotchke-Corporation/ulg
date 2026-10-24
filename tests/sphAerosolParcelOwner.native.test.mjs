import assert from 'node:assert/strict';
import { test } from 'node:test';

test('native independent aerosol owner participates in the actual resident inventory summary', {
  skip: process.env.ULG_RUN_NATIVE_AEROSOL_OWNER === '1' ? false : 'set ULG_RUN_NATIVE_AEROSOL_OWNER=1 for desktop WebGPU',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const base = process.env.ULG_AEROSOL_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/';
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let native;
  try {
    const page = await browser.newPage();
    await page.route(new URL(base).href, (route) => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><title>ULG independent aerosol inventory GPU test</title>' }));
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('Native WebGPU adapter unavailable');
      const device = await adapter.requestDevice();
      const errors = [];
      device.addEventListener('uncapturederror', (event) => errors.push(event.error.message));
      device.pushErrorScope('validation'); device.pushErrorScope('internal'); device.pushErrorScope('out-of-memory');
      const abi = await import('/ulg-gpu-abi/src/index.js');
      const summaryUrl = '/src/runtime/sph/sphMlsMpmGpuSummary.js';
      // Use the application's exact transformed dependency. Vite can attach an
      // HMR timestamp; a second bare import would create another private owner
      // WeakMap. That is a harness split identity, not permission to weaken it.
      const summarySource = await (await fetch(summaryUrl)).text();
      const ownerUrl = summarySource.match(/from\s+["']([^"']*\/sphAerosolParcelGpu\.js(?:\?[^"']*)?)["']/)?.[1];
      if (!ownerUrl) throw new Error('Cannot resolve exact resident-summary aerosol dependency');
      const { runMlsMpmResidentSummaryWebGpu: runSummary } = await import(summaryUrl);
      const owner = await import(ownerUrl);
      const resources = [];
      const upload = (label, data) => {
        const buffer = device.createBuffer({ label, size: Math.max(32, data.byteLength),
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
        device.queue.writeBuffer(buffer, 0, data); resources.push(buffer); return buffer;
      };
      const count = 4;
      const state = new Float32Array(count * 8), thermo = new Float32Array(count * 12), mechanics = new Float32Array(count * 32);
      state.set([0, 0, 0, 2, 1, 0, 0, 10], 0);
      state.set([2, 0, 0, 1, 0, 2, 0, 20], 8);
      // Dormant capacity is not physical inventory, even with old poison bytes.
      state.set([999, -999, NaN, 0, 1e10, 1e10, 1e10, NaN], 16);
      thermo.set([9, 2, 300, 1000, 0, 1, 0, 0, 0.1, 1, 1, 0.1]);
      thermo.set([17, 3, 400, 1, 0, 0, 1, 0, 0.1, 1, 1, 0.1], 12);
      for (let i = 0; i < count; i++) { mechanics[i * 32 + 18] = 1; mechanics[i * 32 + 19] = 1; }
      const stateBuffer = upload('aerosol-owner-bulk-state', state), thermoBuffer = upload('aerosol-owner-bulk-thermo', thermo);
      const mechanicsBuffer = upload('aerosol-owner-bulk-mechanics', mechanics);
      const gridBuffer = upload('aerosol-owner-grid', new Float32Array(8));
      const args = {
        device,
        sphParticleState: { schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count, state, thermo },
        mlsMpmParticleState: { schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count, mechanics },
        sphParticleUpload: { status: 'webgpu-uploaded', stateBuffer, thermoBuffer },
        mlsMpmParticleUpload: { status: 'webgpu-uploaded', mechanicsBuffer },
        gridUpdate: { gridNodeCount: 1, gpuResult: { updatedGridBuffer: gridBuffer } },
        g2pReconstruction: { stateBuffer, mechanicsBuffer },
        compactSummaryReadbackClassification: 'final-diagnostic'
      };
      const parcels = [
        { slot: 2, parcelId: 1n, nucleusPopulationId: 10n, physicalMultiplicity: 2n ** 40n + 7n,
          sourceLineageIndex: 0xffffffff, sourceTopologyEpoch: 0, materialId: 9, phaseId: 2,
          positionM: [10, 1, 0], velocityMPerS: [0, 0, 3], massKg: 0.5,
          specificInternalEnergyJPerKg: 30, temperatureK: 320, condensedDensityKgM3: 1000 },
        { slot: 7, parcelId: 2n, nucleusPopulationId: 11n, physicalMultiplicity: 100n,
          sourceLineageIndex: 0xffffffff, sourceTopologyEpoch: 0, materialId: 17, phaseId: 1,
          positionM: [-2, 4, 0], velocityMPerS: [-1, 0, 0], massKg: 0.25,
          specificInternalEnergyJPerKg: -8, temperatureK: 280, condensedDensityKgM3: 2000 }
      ];
      let family;
      try {
        const carrierOnly = await runSummary(args);
        family = owner.createSphAerosolParcelFamilyWebGpu({ device, capacity: 9, parcels,
          provenance: { kind: 'initial-conditions', reference: 'manufactured independent physical population' } });
        const combined = await runSummary({ ...args, sourceAerosolFamily: family, terminalAerosolFamily: family });
        const emptyState = new Float32Array(count * 8), emptyBuffer = upload('aerosol-owner-empty-bulk-state', emptyState);
        const aerosolOnly = await runSummary({ ...args,
          sphParticleState: { ...args.sphParticleState, state: emptyState },
          sphParticleUpload: { ...args.sphParticleUpload, stateBuffer: emptyBuffer },
          g2pReconstruction: { stateBuffer: emptyBuffer, mechanicsBuffer },
          sourceAerosolFamily: family, terminalAerosolFamily: family });
        // Change ONLY carrier positions. The distinct aerosol reservoir keeps
        // its own positions; this is persistence/accounting, not a drag proof.
        const next = state.slice(); next[0] += 1; next[8] += 1;
        const nextBuffer = upload('aerosol-owner-moved-bulk-state', next);
        const secondRead = runSummary({ ...args,
          g2pReconstruction: { stateBuffer: nextBuffer, mechanicsBuffer },
          sourceAerosolFamily: family, terminalAerosolFamily: family });
        // Existing submitted borrows remain valid; no later borrow may start.
        const releaseFirst = owner.releaseSphAerosolParcelFamily(family);
        const second = await secondRead;
        let rejectedReleased = false, rejectedClone = false, rejectedMissing = false;
        try { await runSummary({ ...args, sourceAerosolFamily: family, terminalAerosolFamily: family }); }
        catch (error) { rejectedReleased = /exact live/.test(error.message); }
        try { owner.releaseSphAerosolParcelFamily({ ...family }); }
        catch (error) { rejectedClone = /exact family/.test(error.message); }
        try { await runSummary({ ...args, sourceAerosolFamily: family }); }
        catch (error) { rejectedMissing = /both source and terminal/.test(error.message); }
        await device.queue.onSubmittedWorkDone();
        const scopes = [await device.popErrorScope(), await device.popErrorScope(), await device.popErrorScope()]
          .filter(Boolean).map((error) => error.message);
        const pick = (summary) => ({ status: summary.status, thermalStatus: summary.thermalSummaryStatus,
          sourceMassKg: summary.sourceMassKg, nextMassKg: summary.nextMassKg,
          massDeltaKg: summary.massDeltaKg, phaseMassKg: summary.phaseMassKg, carrierOnlyInventory: summary.carrierOnlyInventory,
          combinedInventory: summary.combinedInventory, sourceMomentum: summary.sourceMomentumKgMPerS,
          nextMomentum: summary.nextMomentumKgMPerS, sourceCenter: summary.sourceCenterOfMassM, nextCenter: summary.nextCenterOfMassM,
          centerDelta: summary.centerOfMassDeltaM, meanTemperature: summary.temperatureMassWeightedMeanK,
          readbackBytes: summary.readbackBytes, readbackCount: summary.readbackCount,
          compactBytes: summary.compactReadbackByteLength, dispatchCount: summary.timing.summaryKernelDispatchCount,
          energyDelta: summary.internalPlusTranslationalKineticEnergyDeltaJ });
        return { carrierOnly: pick(carrierOnly), combined: pick(combined), aerosolOnly: pick(aerosolOnly), second: pick(second),
          releaseFirst, rejectedReleased, rejectedClone, rejectedMissing, errors, scopes,
          adapter: { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture, description: adapter.info?.description } };
      } finally {
        if (family) owner.releaseSphAerosolParcelFamily(family);
        await device.queue.onSubmittedWorkDone(); resources.forEach((buffer) => buffer.destroy()); device.destroy();
      }
    });
  } finally { await browser.close(); }
  assert.deepEqual(native.errors, []); assert.deepEqual(native.scopes, []);
  assert.equal(native.carrierOnly.nextMassKg, 3);
  assert.equal(native.carrierOnly.dispatchCount, 2);
  assert.equal(native.carrierOnly.combinedInventory, undefined);
  assert.equal(native.combined.nextMassKg, 3.75);
  assert.equal(native.combined.massDeltaKg, 0);
  assert.deepEqual(native.combined.phaseMassKg, { solid: 0.25, liquid: 2.5, gas: 1, plasma: 0 });
  assert.deepEqual(native.combined.nextMomentum, [1.75, 2, 1.5]);
  assert.equal(native.combined.carrierOnlyInventory.nextMassKg, 3);
  assert.deepEqual(native.combined.carrierOnlyInventory.nextMomentumKgMPerS, [2, 2, 0]);
  assert.equal(native.combined.meanTemperature, 328);
  assert.equal(native.combined.compactBytes, native.carrierOnly.compactBytes + 320);
  assert.equal(native.combined.dispatchCount, 6);
  assert.equal(native.combined.readbackBytes, native.combined.compactBytes);
  const budget = native.combined.combinedInventory.terminal;
  assert.equal(budget.internalEnergyJ, 53);
  assert.equal(budget.translationalKineticEnergyJ, 5.375);
  assert.equal(budget.internalPlusTranslationalKineticEnergyJ, 58.375);
  assert.equal(budget.physicalMultiplicity, String(2n ** 40n + 107n));
  assert.equal(budget.parcelCount, 2); assert.equal(budget.carrierCount, 2);
  assert.ok(Math.abs(budget.aerosolCondensedVolumeM3 - 0.000625) < 1e-9);
  assert.equal(native.combined.energyDelta, 0);
  assert.equal(native.aerosolOnly.nextMassKg, 0.75);
  assert.equal(native.aerosolOnly.carrierOnlyInventory.nextMassKg, 0);
  // The existing finalize kernel unconditionally writes ready at word19;
  // readiness is not evidence of nonzero carrier mass. Preserve it verbatim.
  assert.equal(native.aerosolOnly.carrierOnlyInventory.status, 'compact-summary-ready');
  assert.equal(native.aerosolOnly.status, 'compact-summary-ready');
  assert.equal(native.aerosolOnly.thermalStatus, 'thermal-phase-summary-ready');
  assert.equal(native.aerosolOnly.combinedInventory.terminal.internalEnergyJ, 13);
  assert.equal(native.aerosolOnly.combinedInventory.terminal.translationalKineticEnergyJ, 2.375);
  assert.equal(native.second.energyDelta, 0);
  assert.ok(Math.abs(native.second.centerDelta[0] - 0.8) < 1e-6);
  assert.deepEqual(native.second.centerDelta.slice(1), [0, 0]);
  assert.equal(native.releaseFirst, true); assert.equal(native.rejectedReleased, true);
  assert.equal(native.rejectedClone, true); assert.equal(native.rejectedMissing, true);
  console.log(JSON.stringify({ evidence: 'actual-resident-summary-plus-independent-aerosol-inventory',
    scope: 'initial-reservoir-and-U-plus-translational-KE-not-phase-transfer-or-plume', adapter: native.adapter,
    combined: native.combined, second: native.second }));
});
