import assert from 'node:assert/strict';
import test from 'node:test';

// Priority 1 Native Vulkan WebGPU Proof:
//   1. A4 GPU-native Chebyshev fitting (1-D Tait EOS stiffness + 2-D ideal-gas
//      sound speed) executes entirely on WebGPU with < 1e-5 held-out rel error.
//   2. A3 thermal regional closure GPU consumer (`consume_thermal_regional_radiation`)
//      evaluates ADOPTED homogeneous octants via `rf_eval` and falls back to
//      exact (T/300)^4 on mixed-phase octants with < 1e-4 relative accuracy.
//   3. G4 reaction dormancy with packed `uncertaintyWordOffset` and
//      `writeInvalidProposalOnDormant` writes exact (-1,-1,0,0) invalid rows
//      and [0,1,1,0] zero-work indirect dispatch args when quiescent.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1'
  || process.env.ULG_RUN_NATIVE_PRIORITY1 === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Priority 1 native Vulkan GPU proof: A4 GPU Chebyshev fitter, A3 live thermal consumer, and G4 reaction dormancy uncertainty+indirect', {
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

      const fitMod = await import('/src/runtime/material/responseFunctionFitGpu.js');
      const a3Mod = await import('/src/runtime/sph/sphThermalRegionalClosureGpu.js');
      const rxDormMod = await import('/src/runtime/sph/schroederReactionDormancyGpu.js');

      // 1. A4 GPU-native 1-D Tait stiffness fit on WebGPU
      const rho0 = 1000;
      const c0 = 1480;
      const deg1D = 8;
      const nodes1D = fitMod.chebyshevSampleNodes(900, 1100, deg1D + 1);
      const samples1D = Float32Array.from(nodes1D, (rho) => rho * c0 * c0 * Math.pow(rho / rho0, 6));
      const held1D = [];
      for (let i = 0; i < 11; i += 1) {
        const rho = 905 + i * 19;
        held1D.push(rho, 0, rho * c0 * c0 * Math.pow(rho / rho0, 6), 0);
      }
      const fit1D = await fitMod.fitResponseFunctionWebGpu(device, {
        id: 'tait-stiffness-gpu',
        box: [[900, 1100]],
        degrees: [deg1D],
        nodeSamples: samples1D,
        heldOutSamples: held1D,
        relativeTolerance: 1e-4
      });

      // 2. A4 GPU-native 2-D ideal-gas density(T, P) = P*M / (R*T) fit on WebGPU
      const M = 0.02897;
      const R = 8.314462618;
      const degT = 7;
      const degP = 3;
      const nodesT = fitMod.chebyshevSampleNodes(250, 750, degT + 1);
      const nodesP = fitMod.chebyshevSampleNodes(5e4, 3e5, degP + 1);
      const samples2D = new Float32Array((degT + 1) * (degP + 1));
      for (let i = 0; i <= degT; i += 1) {
        for (let j = 0; j <= degP; j += 1) {
          samples2D[i * (degP + 1) + j] = (nodesP[j] * M) / (R * nodesT[i]);
        }
      }
      const held2D = [];
      for (let i = 0; i < 5; i += 1) {
        for (let j = 0; j < 5; j += 1) {
          const T = 265 + i * 115;
          const P = 6e4 + j * 5.5e4;
          held2D.push(T, P, (P * M) / (R * T), 0);
        }
      }
      const fit2D = await fitMod.fitResponseFunctionWebGpu(device, {
        id: 'ideal-gas-density-gpu',
        box: [[250, 750], [5e4, 3e5]],
        degrees: [degT, degP],
        nodeSamples: samples2D,
        heldOutSamples: held2D,
        relativeTolerance: 1e-4
      });

      // 3. A3 thermal regional closure GPU consumer on homogeneous + mixed octants
      const N = 64;
      const stateData = new Float32Array(N * 8);
      const thermoData = new Float32Array(N * 12);
      for (let i = 0; i < N; i += 1) {
        const homogeneous = i < 32;
        stateData[i * 8 + 0] = homogeneous ? 0.25 : 0.75; // octant 0 vs octant 1
        stateData[i * 8 + 1] = 0.25;
        stateData[i * 8 + 2] = 0.25;
        stateData[i * 8 + 3] = 0.01;
        // Canonical SPH thermo0 = [materialId, phaseId, temperatureK, restDensity]
        thermoData[i * 12 + 0] = 1;
        thermoData[i * 12 + 1] = homogeneous ? 2 : (i % 2 === 0 ? 1 : 2); // octant 0 pure liquid, octant 1 mixed!
        thermoData[i * 12 + 2] = homogeneous ? (300 + (i % 8) * 15) : (350 + (i % 8) * 20);
        thermoData[i * 12 + 3] = 998;
      }
      const stateBuf = device.createBuffer({ size: stateData.byteLength, usage: 0x80 | 0x08 });
      const thermoBuf = device.createBuffer({ size: thermoData.byteLength, usage: 0x80 | 0x08 });
      device.queue.writeBuffer(stateBuf, 0, stateData);
      device.queue.writeBuffer(thermoBuf, 0, thermoData);

      let tick = null;
      for (let sched = 0; sched < 2; sched += 1) {
        const enc = device.createCommandEncoder();
        tick = a3Mod.encodeSphThermalRegionalClosureScheduleTick(device, enc, {
          stateBuffer: stateBuf,
          thermoBuffer: thermoBuf,
          particleCount: N,
          boxDimsM: [1, 1, 1],
          scheduleId: `p1-a3-${sched}`
        });
        device.queue.submit([enc.finish()]);
      }
      const readStats = device.createBuffer({ size: 16, usage: 1 | 8 });
      const readFlux = device.createBuffer({ size: N * 16, usage: 1 | 8 });
      const copyEnc = device.createCommandEncoder();
      copyEnc.copyBufferToBuffer(tick.consumerStatsBuffer, 0, readStats, 0, 16);
      copyEnc.copyBufferToBuffer(tick.radiativeFluxBuffer, 0, readFlux, 0, N * 16);
      device.queue.submit([copyEnc.finish()]);
      await Promise.all([readStats.mapAsync(1), readFlux.mapAsync(1)]);
      const a3Stats = Array.from(new Uint32Array(readStats.getMappedRange().slice(0)));
      const a3Flux = new Float32Array(readFlux.getMappedRange().slice(0));
      readStats.unmap();
      readFlux.unmap();
      readStats.destroy();
      readFlux.destroy();

      let maxFluxRelErr = 0;
      const sigma = 5.670374419e-8;
      const tAmb4 = Math.pow(293.15, 4);
      for (let i = 0; i < N; i += 1) {
        const T = thermoData[i * 12 + 2];
        const expected = 0.9 * sigma * (Math.pow(T, 4) - tAmb4);
        const got = a3Flux[i * 4 + 0];
        const err = Math.abs(got - expected) / Math.max(1.0, Math.abs(expected));
        if (err > maxFluxRelErr) maxFluxRelErr = err;
      }

      // 4. G4 reaction dormancy with packed uncertaintyWordOffset & zero-work indirect args
      const rxStage = rxDormMod.createSchroederReactionDormancyStage({
        device,
        particleCount: 16,
        boxM: [1, 1, 1],
        maximumContactRadiusM: 0.2,
        reactionCount: 1,
        reactionRecordStrideVec4s: 3
      });
      const rxState = new Float32Array(16 * 8);
      const rxThermo = new Float32Array(16 * 12);
      for (let i = 0; i < 16; i += 1) {
        rxState[i * 8 + 0] = 0.5;
        rxState[i * 8 + 1] = 0.5;
        rxState[i * 8 + 2] = 0.5;
        rxState[i * 8 + 3] = 0.01;
        rxThermo[i * 12 + 0] = i < 8 ? 11 : 17; // co-reactants
        rxThermo[i * 12 + 1] = 2;
        rxThermo[i * 12 + 2] = 490; // 10 K below T_act = 500 K
      }
      const rxRec = new Float32Array(12);
      rxRec[0] = 11; rxRec[1] = 17; rxRec[3] = 500; // T_act = 500 K
      rxRec[5] = 0.2; rxRec[8] = 1.0; // enabled
      const uBufData = new Float32Array(32); // offset 16 holds dT = 15 K -> 490+15 >= 500!
      for (let i = 16; i < 32; i += 1) uBufData[i] = 15.0;

      const mkBuf = (arr, usage = 0x80 | 0x08 | 0x04) => {
        const b = device.createBuffer({ size: arr.byteLength, usage });
        device.queue.writeBuffer(b, 0, arr);
        return b;
      };
      const bRxState = mkBuf(rxState);
      const bRxThermo = mkBuf(rxThermo);
      const bRxRec = mkBuf(rxRec);
      const bRxProp = mkBuf(new Float32Array(16 * 4));
      const bRxUnc = mkBuf(uBufData);

      // Run A: no uncertainty -> quiescent ([0, 1, 1, 0]) and invalid proposal (-1,-1,0,0)
      const encA = device.createCommandEncoder();
      rxStage.encode(encA, {
        stateBuffer: bRxState,
        thermoBuffer: bRxThermo,
        reactionRecordBuffer: bRxRec,
        proposalBuffer: bRxProp,
        proposalByteLength: 16 * 16,
        uncertaintyBuffer: null,
        writeInvalidProposalOnDormant: true
      });
      const rCountsA = device.createBuffer({ size: 32, usage: 1 | 8 });
      const rPropA = device.createBuffer({ size: 16 * 16, usage: 1 | 8 });
      encA.copyBufferToBuffer(rxStage.countBuffer, 0, rCountsA, 0, 32);
      encA.copyBufferToBuffer(bRxProp, 0, rPropA, 0, 16 * 16);
      device.queue.submit([encA.finish()]);
      await Promise.all([rCountsA.mapAsync(1), rPropA.mapAsync(1)]);
      const countsA = Array.from(new Uint32Array(rCountsA.getMappedRange().slice(0)));
      const propA0 = Array.from(new Float32Array(rPropA.getMappedRange().slice(0, 16)));
      rCountsA.unmap(); rPropA.unmap(); rCountsA.destroy(); rPropA.destroy();

      // Run B: with packed uncertaintyWordOffset = 16 (dT = 15 K) -> 490+15 >= 500 -> ALL 16 active!
      const encB = device.createCommandEncoder();
      rxStage.encode(encB, {
        stateBuffer: bRxState,
        thermoBuffer: bRxThermo,
        reactionRecordBuffer: bRxRec,
        proposalBuffer: bRxProp,
        proposalByteLength: 16 * 16,
        uncertaintyBuffer: bRxUnc,
        uncertaintyWordOffset: 16,
        writeInvalidProposalOnDormant: true
      });
      const rCountsB = device.createBuffer({ size: 32, usage: 1 | 8 });
      encB.copyBufferToBuffer(rxStage.countBuffer, 0, rCountsB, 0, 32);
      device.queue.submit([encB.finish()]);
      await rCountsB.mapAsync(1);
      const countsB = Array.from(new Uint32Array(rCountsB.getMappedRange().slice(0)));
      rCountsB.unmap(); rCountsB.destroy();

      a3Mod.destroySphThermalRegionalClosureResources(device);
      rxStage.destroy();
      for (const b of [stateBuf, thermoBuf, bRxState, bRxThermo, bRxRec, bRxProp, bRxUnc]) b.destroy();

      return {
        status: 'ok',
        gpuErrors,
        fit1D: { valid: fit1D.valid, maxRelErr: fit1D.maxRelativeError, packedLen: fit1D.packedGpuTable.data.length },
        fit2D: { valid: fit2D.valid, maxRelErr: fit2D.maxRelativeError, packedLen: fit2D.packedGpuTable.data.length },
        a3: { stats: a3Stats, maxFluxRelErr, liveGpuConsumerActive: tick.status.liveGpuConsumerActive },
        rxDormancy: { countsA, propA0, countsB }
      };
    });

    assert.deepEqual(pageErrors, []);
    assert.equal(out.status, 'ok');
    assert.deepEqual(out.gpuErrors, []);
    assert.equal(out.fit1D.valid, true);
    assert.ok(out.fit1D.maxRelErr < 1e-4, `1D GPU Chebyshev relErr=${out.fit1D.maxRelErr}`);
    assert.equal(out.fit2D.valid, true);
    assert.ok(out.fit2D.maxRelErr < 1e-4, `2D GPU Chebyshev relErr=${out.fit2D.maxRelErr}`);
    assert.equal(out.a3.liveGpuConsumerActive, true);
    assert.ok(out.a3.stats[0] >= 32, `expected homogeneous octant A3 rf_eval hits >= 32, got ${out.a3.stats}`);
    assert.ok(out.a3.stats[1] >= 32, `expected mixed-phase octant direct fallbacks >= 32, got ${out.a3.stats}`);
    assert.ok(out.a3.maxFluxRelErr < 1e-3, `A3 consumer flux maxRelErr=${out.a3.maxFluxRelErr}`);
    // Quiescent reaction dormancy: active=0, dormant=16, dispatchX=0!
    assert.equal(out.rxDormancy.countsA[0], 0);
    assert.equal(out.rxDormancy.countsA[1], 16);
    assert.equal(out.rxDormancy.countsA[4], 0);
    assert.deepEqual(out.rxDormancy.propA0, [-1, -1, 0, 0]);
    // Packed uncertainty offset straddles T_act=500 -> all 16 active, dispatchX=1!
    assert.equal(out.rxDormancy.countsB[0], 16);
    assert.equal(out.rxDormancy.countsB[4], 1);
  } finally {
    await browser.close();
  }
});
