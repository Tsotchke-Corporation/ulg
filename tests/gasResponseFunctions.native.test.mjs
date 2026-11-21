// Native Vulkan gate for Arch-3 (live A3 regional closure lane inside
// sphImplicitPressureGpu) and Arch-4 (2-D GPU gas response functions over
// (T, P) via responseFunctionGpu / rf_eval).
//
// Run: ULG_RUN_NATIVE_A4_GAS_GPU=1 node --test tests/gasResponseFunctions.native.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_A4_GAS_GPU === '1';
const BASE_URL = process.env.ULG_A4_GAS_GPU_BASE_URL || 'https://127.0.0.1:5173/';

test('A4 2-D gas response GPU evaluator + live A3 implicit pressure regional lane on native WebGPU', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_A4_GAS_GPU=1 to run on native WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  let out;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 5 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 500));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice({
        requiredLimits: {
          maxStorageBuffersPerShaderStage: Math.min(12, adapter.limits.maxStorageBuffersPerShaderStage)
        }
      });
      device.pushErrorScope('validation');

      // 1. A4 2-D GPU gas response evaluation over (T, P).
      const gasMod = await import('/src/runtime/material/gasResponseFunctions.js');
      const materials = {
        n2: {
          molarMassKgPerMol: 0.0280134,
          atomsPerFormula: 2,
          phases: [{ name: 'gas', densityKgPerM3: 1.165, cpJPerKgK: 1040, bulkModulusPa: 1.4e5, temperatureK: 293.15 }]
        },
        h2o: {
          molarMassKgPerMol: 0.01801528,
          atomsPerFormula: 3,
          phases: [{ name: 'gas', densityKgPerM3: 0.59, cpJPerKgK: 2010, bulkModulusPa: 1.33e5, temperatureK: 373.15 }]
        }
      };
      const bundle = gasMod.buildMaterialGasResponseFunctions(materials);
      const evaluator = gasMod.createGasResponseEvaluatorGpu(device, bundle);
      const n2 = bundle.byMaterial.n2;
      const h2o = bundle.byMaterial.h2o;
      const queryRows = [
        [n2.densityIndex, 293.15, 101325, 0],
        [n2.soundSpeedIndex, 293.15, 101325, 0],
        [h2o.densityIndex, 450.0, 220000, 0],
        [h2o.soundSpeedIndex, 450.0, 220000, 0],
        [n2.densityIndex, 100.0, 101325, 0],     // out-of-box low T
        [h2o.soundSpeedIndex, 450.0, 900000, 0] // out-of-box high P
      ];
      const qData = new Float32Array(queryRows.flat());
      const qBuf = device.createBuffer({ size: qData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(qBuf, 0, qData);
      const outBytes = queryRows.length * 8;
      const outBuf = device.createBuffer({ size: outBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      const readBuf = device.createBuffer({ size: outBytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      const enc1 = device.createCommandEncoder();
      evaluator.encodeEvaluate(enc1, { queriesBuffer: qBuf, outputsBuffer: outBuf, queryCount: queryRows.length });
      enc1.copyBufferToBuffer(outBuf, 0, readBuf, 0, outBytes);
      device.queue.submit([enc1.finish()]);
      await readBuf.mapAsync(GPUMapMode.READ);
      const gpuOut = Array.from(new Float32Array(readBuf.getMappedRange().slice(0)));
      readBuf.unmap();
      qBuf.destroy();
      outBuf.destroy();
      readBuf.destroy();
      evaluator.destroy();

      const cpuRef = [
        gasMod.evaluateMaterialGasResponseCpu(bundle, 'n2', 293.15, 101325).densityKgPerM3,
        gasMod.evaluateMaterialGasResponseCpu(bundle, 'n2', 293.15, 101325).soundSpeedMPerS,
        gasMod.evaluateMaterialGasResponseCpu(bundle, 'h2o', 450.0, 220000).densityKgPerM3,
        gasMod.evaluateMaterialGasResponseCpu(bundle, 'h2o', 450.0, 220000).soundSpeedMPerS
      ];

      // 2. Live A3 regional closure lane inside encodeSphImplicitPressureSolve.
      const ip = await import('/src/runtime/sph/sphImplicitPressureGpu.js');
      const h = 0.1, shift = 2, box = [0.7, 0.7, 0.7];
      const dims = box.map((b) => Math.round(b / h) + 5);
      const gridSpec = { gridSpacingM: h, boxDimsM: box, shift, gridDims: dims, gridNodeCount: dims[0] * dims[1] * dims[2] };
      const spacing = h / 2, rho0 = 1000, c = 50, dt = 0.008;
      const positions = [];
      for (let x = 0.2 + spacing / 2; x < 0.5; x += spacing)
        for (let y = 0.2 + spacing / 2; y < 0.5; y += spacing)
          for (let z = 0.2 + spacing / 2; z < 0.5; z += spacing) positions.push([x, y, z]);
      const n = positions.length, vol = spacing ** 3, mass = rho0 * vol;
      const state = new Float32Array(n * 8), thermo = new Float32Array(n * 12), mech = new Float32Array(n * 32);
      positions.forEach((p, i) => {
        state.set([...p, mass], i * 8);
        thermo[i * 12 + 3] = rho0;
        mech.set([0, 0, 1.01, vol], i * 32 + 16);
        mech.set([0, c, 1, 0], i * 32 + 24);
      });
      const grid = new Float32Array(gridSpec.gridNodeCount * 8);
      for (let i = 0; i < gridSpec.gridNodeCount; i += 1) {
        grid[i * 8] = mass;
        grid[i * 8 + 1] = -0.1;
        grid[i * 8 + 7] = 1;
      }
      const upload = (data, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST) => {
        const b = device.createBuffer({ size: data.byteLength, usage });
        device.queue.writeBuffer(b, 0, data);
        return b;
      };
      const buffers = {
        state: upload(state),
        thermo: upload(thermo),
        mech: upload(mech),
        grid: upload(grid, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC)
      };
      const enc2 = device.createCommandEncoder();
      const dispatches = ip.encodeSphImplicitPressureSolve(device, enc2, {
        options: ip.normalizeSphImplicitPressureOptions({ iterations: 12, cflSafety: 3 }),
        stateBuffer: buffers.state,
        thermoBuffer: buffers.thermo,
        mechanicsBuffer: buffers.mech,
        gridBuffer: buffers.grid,
        gridSpec,
        particleCount: n,
        dt,
        regionalSampleOnScheduleBoundary: true,
        scheduleId: 'native-a3-test:0'
      });
      device.queue.submit([enc2.finish()]);
      await device.queue.onSubmittedWorkDone();
      const a3Status = globalThis.__ulgA3RegionalClosureStatus ?? null;
      const hasLane = Boolean(ip.getSphImplicitPressureRegionalClosureLane(device));
      Object.values(buffers).forEach((b) => b.destroy());

      const validation = await device.popErrorScope();
      device.destroy();
      return {
        status: 'ran',
        gpuOut,
        cpuRef,
        dispatches,
        hasLane,
        a3Status,
        validation: validation?.message ?? null
      };
    });
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(out));
  assert.equal(out.status, 'ran');
  assert.equal(out.validation, null, out.validation);
  // In-box A4 2-D GPU queries agree with CPU to < 1e-5 relative error and ok === 1.
  for (let i = 0; i < 4; i += 1) {
    const val = out.gpuOut[i * 2];
    const ok = out.gpuOut[i * 2 + 1];
    assert.equal(ok, 1, `query ${i} should be in-box`);
    const rel = Math.abs(val - out.cpuRef[i]) / out.cpuRef[i];
    assert.ok(rel <= 1e-5, `query ${i} relErr ${rel} (gpu=${val}, cpu=${out.cpuRef[i]})`);
  }
  // Out-of-box A4 2-D GPU queries strictly refuse (ok === 0).
  assert.equal(out.gpuOut[8 + 1], 0, 'out-of-box low T must return ok = 0');
  assert.equal(out.gpuOut[10 + 1], 0, 'out-of-box high P must return ok = 0');

  // Live A3 regional closure lane evaluated and adopted cleanly.
  assert.equal(out.hasLane, true);
  assert.equal(out.a3Status?.active, true);
  assert.equal(out.a3Status?.evaluatedSchedules, 1);
  assert.equal(out.a3Status?.adoptedSchedules, 1);
  assert.ok(out.dispatches > 0);
});
