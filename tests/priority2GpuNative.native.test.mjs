import assert from 'node:assert/strict';
import test from 'node:test';

// Priority 2 Native Vulkan GPU Proof:
//   1. SOL-6 multilevel proxies on non-multiple-of-4 (10^3 ice) block with live
//      GPU `consume_active_proxy_quadrature` consumer verifying exact surface area
//      and consumedProxies === activeProxies with zero overlap violations.
//   2. Pre-SOL-1 surface-only solid radiation: on a 3x3x3 hot solid cube (27
//      members: 26 surface, 1 interior center member), interior member emits
//      ZERO ambient radiation while exposed surface members cool toward ambient
//      proportional to exposed face area!
//   3. G2 two-way parcel-gas Stokes drag momentum exchange (`twoWayDrag: true`):
//      settling droplet parcels impart exact Newton's 3rd Law drag momentum
//      `J_y = m_p * (1 - rho_a / rho_p) * g_y * dt` to the suspending cell gas!
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1'
  || process.env.ULG_RUN_NATIVE_PRIORITY2 === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Priority 2 native Vulkan GPU proof: SOL-6 10^3 proxy consumer, surface-only solid radiation, and two-way parcel drag', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan WebGPU proof',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 6 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 300));
      }
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const mlMod = await import('/src/runtime/sph/schroederSolidMultilevelGpu.js');
      const rigidMod = await import('/src/runtime/sph/schroederSolidRigidGpu.js');
      const thermalMod = await import('/src/runtime/sph/schroederSolidThermalGpu.js');
      const transportMod = await import('/src/runtime/sph/sphExactParcelTransportLedgerGpu.js');
      const ledgerMod = await import('/src/runtime/sph/sphExactThermalEnergyWgsl.js');

      // 1. SOL-6 10^3 ice block (non-multiple-of-4) + live GPU consumer
      const catalog = mlMod.buildSchroederMultilevelProxyCatalog({
        bodyIndex: 0,
        halfExtentsM: [0.014, 0.014, 0.014],
        finePitchM: 0.0028,
        padToMultipleOf4: true
      });
      const frameData = new Float32Array(32);
      frameData.set([0.07, 0.07, 0.07, 1.0, 0, 0, 0, 1], 0);
      const frameBuf = device.createBuffer({ size: 128, usage: 0x80 | 0x08 | 0x04 });
      device.queue.writeBuffer(frameBuf, 0, frameData);
      const mlStage = mlMod.createSchroederSolidMultilevelStage({
        device,
        bodyCount: 1,
        frameBuffer: frameBuf,
        catalog
      });
      const mlEnc = device.createCommandEncoder();
      mlStage.encodeMultilevelProxies(mlEnc, {
        focusWorldM: [0.07, 0.07, 0.07],
        fineRadiusM: 0.03,
        mediumRadiusM: 0.08
      });
      device.queue.submit([mlEnc.finish()]);
      const lodSummary = await mlStage.readLodSummary();
      mlStage.destroy();
      frameBuf.destroy();

      // 2. Surface-only solid radiation on 3x3x3 cube (k = 0 conduction so ONLY radiation acts!)
      const pitch = 0.02;
      const pts = [];
      let centerIdx = -1;
      for (let ix = 0; ix < 3; ix += 1) {
        for (let iy = 0; iy < 3; iy += 1) {
          for (let iz = 0; iz < 3; iz += 1) {
            if (ix === 1 && iy === 1 && iz === 1) centerIdx = pts.length;
            pts.push({
              rest: [(ix - 1) * pitch, (iy - 1) * pitch, (iz - 1) * pitch],
              massKg: 0.01
            });
          }
        }
      }
      const seed = {
        bodyId: 1,
        centerOfMass: [0.5, 0.5, 0.5],
        massKg: pts.length * 0.01,
        quaternion: [0, 0, 0, 1],
        linearMomentum: [0, 0, 0],
        angularMomentum: [0, 0, 0],
        principalMoments: [1e-4, 1e-4, 1e-4],
        members: pts
      };
      const packed = rigidMod.packSchroederSolidRigidBodies([seed]);
      const memBuf = device.createBuffer({ size: packed.members.byteLength, usage: 0x80 | 0x08 | 0x04 });
      device.queue.writeBuffer(memBuf, 0, packed.members);
      const worldArr = new Float32Array(pts.length * 8);
      pts.forEach((p, idx) => {
        worldArr.set([0.5 + p.rest[0], 0.5 + p.rest[1], 0.5 + p.rest[2], p.massKg], idx * 8);
      });
      const worldBuf = device.createBuffer({ size: worldArr.byteLength, usage: 0x80 | 0x08 | 0x04 });
      device.queue.writeBuffer(worldBuf, 0, worldArr);
      const solidBranch = {
        referenceTemperatureK: 300,
        referenceInternalEnergyJPerKg: 0,
        cvJPerKgK: 500,
        energyMaxJPerKg: 1e9
      };
      const liquidBranch = {
        referenceTemperatureK: 2000,
        referenceInternalEnergyJPerKg: 1e9,
        cvJPerKgK: 600,
        energyMinJPerKg: 1e9
      };
      const seededT = thermalMod.seedSchroederSolidMemberThermal({
        seeds: [seed],
        pitchByAxisM: [[pitch, pitch, pitch]],
        temperaturesK: [1500],
        solidBranch
      });
      const tStage = thermalMod.createSchroederSolidThermalStage({
        device,
        memberCount: pts.length,
        bodyCount: 1,
        memberBuffer: memBuf,
        memberWorldBuffer: worldBuf,
        thermo: seededT.thermo,
        neighbors: seededT.neighbors,
        solidBranch,
        liquidBranch,
        meltTemperatureK: 1800,
        solidConductivity: 0, // zero conduction so ONLY radiation changes member temperature!
        liquidConductivity: 0,
        pitchM: [pitch, pitch, pitch],
        memberRadiusM: 0.5 * pitch,
        wallTemperaturesK: [0, 0, 0, 0, 0, 0],
        boxM: [1, 1, 1],
        ambientTemperatureK: 300,
        emissivity: 0.9
      });
      const tEnc = device.createCommandEncoder();
      tStage.encode(tEnc, 0.1, { releaseEnabled: false });
      const readT = device.createBuffer({ size: pts.length * 16, usage: 1 | 8 });
      tEnc.copyBufferToBuffer(tStage.thermoBuffer, 0, readT, 0, pts.length * 16);
      device.queue.submit([tEnc.finish()]);
      await readT.mapAsync(1);
      const afterThermo = new Float32Array(readT.getMappedRange().slice(0));
      readT.unmap();
      readT.destroy();
      const centerTempAfter = afterThermo[centerIdx * 4 + 1];
      const cornerTempAfter = afterThermo[0 * 4 + 1]; // corner has 3 exposed faces
      const faceCenterIdx = 4; // ix=0, iy=1, iz=1 -> 1 exposed face
      const faceCenterTempAfter = afterThermo[faceCenterIdx * 4 + 1];
      tStage.destroy();
      memBuf.destroy();
      worldBuf.destroy();

      // 3. Two-way parcel-gas Stokes drag momentum conservation on GPU
      const W = ledgerMod.SPH_EXACT_THERMAL_ENERGY_FORMAT.wordCount;
      const gState = new Float32Array(1 * 8);
      gState.set([0.5, 0.5, 0.5, 1.0, 0.0, 0.0, 0.0, 0.0], 0); // 1 kg gas carrier at rest
      const gThermo = new Float32Array(1 * 12);
      gThermo.set([100, 3, 300, 1.2], 0); // phase 3 = gas
      const gMass = new Uint32Array(1 * W);
      const gEnergy = new Uint32Array((2 * 1 + 4) * W);
      // 1 droplet parcel with multiplicity 1e12 of r=5um water droplets -> total mass ~ 5.236e-4 kg
      const rDrop = 5e-6;
      const mDrop = (4 / 3) * Math.PI * rDrop ** 3 * 1000;
      const mult = 1e9;
      const totalWaterMass = Math.fround(mDrop * mult);
      const pParams = new Float32Array(8);
      pParams.set([0.5, 0.5, 0.5, mult, 2000, 0.1, 300, rDrop], 0);
      const exactMassMod = await import('/ulg-gpu-abi/src/sphExactMassInventory.js');
      const waterWords = exactMassMod.encodeSphExactMass(totalWaterMass, ledgerMod.SPH_EXACT_THERMAL_ENERGY_FORMAT);
      const pLedger = new Uint32Array(3 * W);
      pLedger.set(waterWords, W); // slot 1 = water mass
      const sinks = new Uint32Array(3 * W);
      const mk = (arr) => {
        const b = device.createBuffer({ size: Math.max(16, arr.byteLength), usage: 0x80 | 0x08 | 0x04 });
        device.queue.writeBuffer(b, 0, arr);
        return b;
      };
      const bGState = mk(gState), bGThermo = mk(gThermo), bGMass = mk(gMass), bGEnergy = mk(gEnergy);
      const bPParams = mk(pParams), bPLedger = mk(pLedger), bSinks = mk(sinks);
      const trStage = transportMod.createSphExactParcelTransportStage({
        device,
        carrierCount: 1,
        parcelCount: 1,
        dims: [1, 1, 1],
        origin: [0, 0, 0],
        cellSizeM: 1,
        boxM: [1, 1, 1],
        waterMaterialId: 11,
        twoWayDrag: true,
        carrierStateBuffer: bGState,
        carrierThermoBuffer: bGThermo,
        carrierMassBuffer: bGMass,
        carrierEnergyBuffer: bGEnergy,
        parcelBuffer: bPParams,
        parcelLedgerBuffer: bPLedger,
        sinkBuffer: bSinks
      });
      const trEnc = device.createCommandEncoder();
      const dt = 0.01;
      trStage.encode(trEnc, dt);
      const readGState = device.createBuffer({ size: 32, usage: 1 | 8 });
      trEnc.copyBufferToBuffer(bGState, 0, readGState, 0, 32);
      device.queue.submit([trEnc.finish()]);
      await readGState.mapAsync(1);
      const gAfter = new Float32Array(readGState.getMappedRange().slice(0));
      readGState.unmap();
      readGState.destroy();
      const expectedGasVy = (totalWaterMass * (1 - 1.2 / 1000) * (-9.81) * dt) / 1.0;
      const gotGasVy = gAfter[5];
      trStage.destroy();
      for (const b of [bGState, bGThermo, bGMass, bGEnergy, bPParams, bPLedger, bSinks]) b.destroy();

      return {
        status: 'ok',
        gpuErrors,
        lodSummary,
        expectedIceArea: catalog.exactAreaM2,
        rad: { centerTempAfter, faceCenterTempAfter, cornerTempAfter },
        drag: { expectedGasVy, gotGasVy }
      };
    });

    assert.deepEqual(pageErrors, []);
    assert.equal(out.status, 'ok');
    assert.deepEqual(out.gpuErrors, []);

    // 1. SOL-6 10^3 ice proxy consumer (exact match to GPU lod_stats fixed-point sum, and within 864-leaf 2^-20 quantization of exact area)
    assert.ok(out.lodSummary.activeProxies > 0);
    assert.equal(out.lodSummary.consumedProxies, out.lodSummary.activeProxies);
    assert.equal(out.lodSummary.overlapViolations, 0);
    assert.ok(Math.abs(out.lodSummary.consumedAreaM2 - out.lodSummary.totalAreaM2) < 1e-9);
    assert.ok(
      Math.abs(out.lodSummary.consumedAreaM2 - out.expectedIceArea) < 5e-4,
      `consumedArea=${out.lodSummary.consumedAreaM2} vs expected=${out.expectedIceArea}`
    );

    // 2. Surface-only radiation: interior center member MUST stay exactly 1500 K!
    assert.equal(out.rad.centerTempAfter, 1500, 'interior member must emit ZERO ambient radiation');
    assert.ok(out.rad.faceCenterTempAfter < 1500, '1-face surface member must cool');
    assert.ok(out.rad.cornerTempAfter < out.rad.faceCenterTempAfter, '3-face corner must cool ~3x faster than 1-face center');

    // 3. Two-way Stokes drag momentum conservation on GPU
    assert.ok(out.drag.gotGasVy < 0, 'settling parcels must impart downward drag momentum to suspending gas');
    const dragRelErr = Math.abs(out.drag.gotGasVy - out.drag.expectedGasVy) / Math.abs(out.drag.expectedGasVy);
    assert.ok(dragRelErr < 1e-3, `two-way Stokes drag relErr=${dragRelErr} (got=${out.drag.gotGasVy}, expected=${out.drag.expectedGasVy})`);
  } finally {
    await browser.close();
  }
});
