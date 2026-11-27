import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.ULG_DEV_URL || 'https://127.0.0.1:5173';
const RUN_VULKAN = process.env.ULG_RUN_VULKAN === '1';

const VULKAN_ARGS = [
  '--enable-unsafe-webgpu',
  '--enable-features=Vulkan',
  '--use-gl=angle',
  '--use-angle=vulkan',
  '--enable-gpu-rasterization',
  '--ignore-gpu-blocklist',
  '--no-sandbox'
];

test('Track 1 Vulkan: live compiled Law-IR Tait EOS + live GPU IMEX thermal PCG + Studio air3 live telemetry', {
  skip: !RUN_VULKAN && 'Set ULG_RUN_VULKAN=1 to run headless Vulkan Track 1 verification'
}, async () => {
  const browser = await chromium.launch({ headless: true, args: VULKAN_ARGS });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err?.message || err)));
    await page.goto(`${BASE_URL}/index.html?studio=1&preset=water-realtime&autostart=0`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    // 1A + 1B: Direct Vulkan execution of compiled Law-IR runtime & GPU IMEX thermal bridge
    const gpuReport = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return { ok: false, reason: 'no-webgpu-adapter' };
      const device = await adapter.requestDevice();

      const {
        encodeCompiledLawIrMechanicsIntoPass,
        encodeCompiledLawIrReceiptCopy,
        readCompiledLawIrReceiptAsync,
        getCompiledLawIrLiveStatus
      } = await import('/src/runtime/sph/compiledLawIrLiveRuntime.js');
      const {
        encodeSphImplicitThermalFromSphStep,
        getSphImplicitThermalDeviceExecution
      } = await import('/src/runtime/sph/sphImplicitThermalGpu.js');

      // --- 1A: Compiled Law-IR Tait EOS + zero-gauge cavitation ---
      const particleCount = 64;
      const stride = 32; // MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS = 8 vec4<f32> rows
      const mechInit = new Float32Array(particleCount * stride);
      for (let i = 0; i < particleCount; i += 1) {
        const base = i * stride;
        // row4 (16..19): [..., ..., J, V0]
        mechInit[base + 18] = i % 2 === 0 ? 0.96 : 1.05;
        mechInit[base + 19] = 1e-6;
        // row5 (20..23): [solid_flag, ..., effective_bulk_modulus_pa, ...]
        mechInit[base + 20] = 0.0;
        mechInit[base + 22] = 2.0e6;
        // row6 (24..27): [..., ..., eos_model_id, ...]
        mechInit[base + 26] = 1.0; // taitCondensed
        // row7 (28..31): [resolved_absolute_pressure_pa, ...]
        mechInit[base + 28] = -999.0; // sentinel overwritten by compiled Law-IR shader
      }
      const mechBuf = device.createBuffer({
        size: mechInit.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      const mechRead = device.createBuffer({
        size: mechInit.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(mechBuf, 0, mechInit);

      const enc1 = device.createCommandEncoder();
      const pass1 = enc1.beginComputePass();
      const dispatched = encodeCompiledLawIrMechanicsIntoPass(device, pass1, {
        mechanicsBuffer: mechBuf,
        particleCount,
        generation: 7,
        gamma: 7.0
      });
      pass1.end();
      encodeCompiledLawIrReceiptCopy(device, enc1);
      enc1.copyBufferToBuffer(mechBuf, 0, mechRead, 0, mechInit.byteLength);
      device.queue.submit([enc1.finish()]);

      const lawIrReceipt = await readCompiledLawIrReceiptAsync(device);
      await mechRead.mapAsync(GPUMapMode.READ);
      const mechOut = new Float32Array(mechRead.getMappedRange().slice(0));
      mechRead.unmap();
      const compressedP = mechOut[0 * stride + 28];
      const expandedP = mechOut[1 * stride + 28];
      const lawIrStatus = getCompiledLawIrLiveStatus(device);

      // --- 1B: Live GPU IMEX Thermal PCG on SPH particle buffers at Fo > 20 ---
      const nThermal = 64;
      const stateInit = new Float32Array(nThermal * 8);
      const thermoInit = new Float32Array(nThermal * 12);
      const cp = 400.0;
      const mass = 0.01;
      let initialTotalEnergy = 0;
      for (let i = 0; i < nThermal; i += 1) {
        const ix = i % 4;
        const iy = Math.floor(i / 4) % 4;
        const iz = Math.floor(i / 16) % 4;
        const sb = i * 8;
        const tb = i * 12;
        stateInit[sb + 0] = (ix + 0.5) * 0.025;
        stateInit[sb + 1] = (iy + 0.5) * 0.025;
        stateInit[sb + 2] = (iz + 0.5) * 0.025;
        stateInit[sb + 3] = mass;
        const tempK = ix < 2 ? 1200.0 : 300.0;
        const uSpec = cp * tempK;
        stateInit[sb + 7] = uSpec;
        initialTotalEnergy += mass * uSpec;
        thermoInit[tb + 0] = 0;
        thermoInit[tb + 1] = 0;
        thermoInit[tb + 2] = tempK;
        thermoInit[tb + 3] = 8000;
        thermoInit[tb + 10] = 1; // ready
      }
      const stateBuf = device.createBuffer({
        size: stateInit.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      const thermoBuf = device.createBuffer({
        size: thermoInit.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      const stateRead = device.createBuffer({
        size: stateInit.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      const thermoRead = device.createBuffer({
        size: thermoInit.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(stateBuf, 0, stateInit);
      device.queue.writeBuffer(thermoBuf, 0, thermoInit);

      const enc2 = device.createCommandEncoder();
      const imexResult = encodeSphImplicitThermalFromSphStep(device, enc2, {
        outStateBuffer: stateBuf,
        outThermoBuffer: thermoBuf,
        particleCount: nThermal,
        dtS: 0.25,
        gridSpacingM: 0.025,
        boxDimsM: [0.1, 0.1, 0.1],
        wallRate: 0,
        ambientTemperatureK: 300,
        ambientRadiationExchangeEnabled: false,
        materialConductivityWPerMK: 400,
        materialSpecificHeatJPerKgK: cp,
        maxFourierNumber: 40,
        options: { enabled: true, theta: 1.0, iterations: 24, maxFourierNumber: 40 }
      });
      enc2.copyBufferToBuffer(stateBuf, 0, stateRead, 0, stateInit.byteLength);
      enc2.copyBufferToBuffer(thermoBuf, 0, thermoRead, 0, thermoInit.byteLength);
      device.queue.submit([enc2.finish()]);
      await Promise.all([stateRead.mapAsync(GPUMapMode.READ), thermoRead.mapAsync(GPUMapMode.READ)]);
      const stateOut = new Float32Array(stateRead.getMappedRange().slice(0));
      const thermoOut = new Float32Array(thermoRead.getMappedRange().slice(0));
      stateRead.unmap();
      thermoRead.unmap();

      let finalTotalEnergy = 0;
      let minT = Infinity;
      let maxT = -Infinity;
      let nonFinite = 0;
      for (let i = 0; i < nThermal; i += 1) {
        const u = stateOut[i * 8 + 7];
        const t = thermoOut[i * 12 + 2];
        if (!Number.isFinite(u) || !Number.isFinite(t)) nonFinite += 1;
        finalTotalEnergy += mass * u;
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }
      const imexExec = getSphImplicitThermalDeviceExecution(device);

      mechBuf.destroy();
      mechRead.destroy();
      stateBuf.destroy();
      thermoBuf.destroy();
      stateRead.destroy();
      thermoRead.destroy();
      device.destroy();

      return {
        ok: true,
        dispatched,
        compressedP,
        expandedP,
        lawIrReceipt,
        lawIrStatus,
        imexOk: Boolean(imexResult),
        imexExec,
        initialTotalEnergy,
        finalTotalEnergy,
        energyRelErr: Math.abs(finalTotalEnergy - initialTotalEnergy) / Math.max(1e-12, initialTotalEnergy),
        minT,
        maxT,
        nonFinite
      };
    });

    assert.equal(gpuReport.ok, true, `Vulkan setup failed: ${gpuReport.reason}`);
    assert.equal(gpuReport.dispatched, true);
    const expectedTaitP = (2.0e6 / 7.0) * (Math.pow(1.0 / 0.96, 7.0) - 1.0);
    assert.ok(
      Math.abs(gpuReport.compressedP - expectedTaitP) / expectedTaitP < 1e-4,
      `expected exact Tait pressure ~${expectedTaitP.toFixed(2)}, got ${gpuReport.compressedP}`
    );
    assert.equal(gpuReport.expandedP, 0, `expected zero-gauge cavitation clamp, got ${gpuReport.expandedP}`);
    assert.equal(gpuReport.lawIrReceipt.hits, 64);
    assert.equal(gpuReport.lawIrReceipt.nonFiniteViolations, 0);
    assert.equal(gpuReport.lawIrReceipt.debtCount, 0);
    assert.equal(gpuReport.lawIrStatus.dispatchedOnGpu, true);

    assert.equal(gpuReport.imexOk, true);
    assert.equal(gpuReport.imexExec.dispatchedOnGpu, true);
    assert.equal(gpuReport.imexExec.skewSymmetricFluxConserved, true);
    assert.equal(gpuReport.nonFinite, 0);
    assert.ok(gpuReport.minT > 300.5, `expected cold side to warm via IMEX diffusion, got minT=${gpuReport.minT}`);
    assert.ok(gpuReport.maxT < 1199.5, `expected hot side to cool via IMEX diffusion, got maxT=${gpuReport.maxT}`);
    assert.ok(gpuReport.minT >= 300 - 1e-3 && gpuReport.maxT <= 1200 + 1e-3, 'discrete maximum principle violated');
    assert.ok(gpuReport.energyRelErr < 1e-4, `expected conservative IMEX energy, relErr=${gpuReport.energyRelErr}`);

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
