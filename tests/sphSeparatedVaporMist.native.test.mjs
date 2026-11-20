// Native Vulkan gate for co-advected wet-vapor condensate on separated plumes:
//   1. When a gas carrier (phase 3) partially condenses onto the liquid-gas
//      plateau while its lineage's liquid carrier (phase 2) is occupied at a
//      distant floor position, phase-carrier transfer preserves mass, first
//      moment, momentum, and total energy while retaining the suspended mist
//      fraction on the rising vapor carrier instead of teleporting it into the
//      distant floor pool.
//   2. When the liquid carrier is co-located within contact reach, the
//      condensate merges into phase 2 as usual.
//   3. The render-field WGSL deposits positive collective Mie scattering
//      optical depth at the rising wet-vapor carrier's headspace cells while
//      excluding its suspended condensate from ordinary marching-cubes blobs.
//
// Run: ULG_RUN_NATIVE_SEPARATED_VAPOR_MIST=1 node --test
//   tests/sphSeparatedVaporMist.native.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SEPARATED_VAPOR_MIST === '1';
const BASE_URL = process.env.ULG_SEPARATED_VAPOR_MIST_BASE_URL || 'https://127.0.0.1:5173/';

test('separated wet-vapor plume retains co-advected mist without floor teleportation and emits plume optical depth', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SEPARATED_VAPOR_MIST=1 to run on native WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    native = await page.evaluate(async () => {
      let adapter = null;
      for (let attempt = 0; attempt < 6 && !adapter; attempt += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 300));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice({
        requiredLimits: { maxStorageBuffersPerShaderStage: 12 }
      });
      device.pushErrorScope('validation');

      const transfer = await import('/src/runtime/sph/sphPhaseCarrierTransferGpu.js');
      const identity = await import('/src/runtime/sph/sphGpuDeviceIdentity.js');
      const abi = await import('/ulg-gpu-abi/src/index.js');
      const mechanicsTableMod = await import('/src/runtime/sph/sphMechanicsMaterialTable.js');
      const renderKernel = await import('/src/runtime/sph/sphRenderGpuKernel.js');

      const lineages = 2;
      const particleCount = lineages * 4;
      const plan = {
        schema: transfer.ULG_SPH_PHASE_CARRIER_PLAN_SCHEMA,
        status: 'phase-lane-capacity-ready',
        lineageCapacity: lineages,
        primaryCapacity: lineages,
        phaseLaneCount: 4,
        phaseLaneStride: lineages,
        companionStart: lineages,
        companionCapacity: lineages * 3,
        particleCapacity: particleCount,
        stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
        phaseCompanionLanesRequired: true
      };

      const U_LIQ = 419_000;
      const U_GAS = 2_676_000;
      const state = new Float32Array(particleCount * 8);
      const thermo = new Float32Array(particleCount * 12);
      const mechanics = new Float32Array(particleCount * 32);

      const initSlot = (index, phaseId, pos, vel, mass, u, fractions, rho, v0) => {
        const live = mass > 0;
        state.set([pos[0], pos[1], pos[2], mass, vel[0], vel[1], vel[2], u], index * 8);
        thermo.set([
          1, phaseId, 373.15, rho,
          fractions[0], fractions[1], fractions[2], fractions[3],
          0.004, live ? mass * 3.34e25 : 0, live ? 1 : 254, live ? Math.cbrt((3 * v0) / (4 * Math.PI)) : 0
        ], index * 12);
        const mb = index * 32;
        mechanics.set([1, 0, 0, 0], mb);
        mechanics.set([0, 1, 0, 0], mb + 4);
        mechanics.set([0, 0, 1, 0], mb + 8);
        mechanics.set([0, 0, 1, v0], mb + 16);
        mechanics.set([0, live ? 1 : 254, 0, 0], mb + 20);
        mechanics.set([0, 0, 1, live ? 1 : 254], mb + 24);
        mechanics.set([101325, 0, 0, mass], mb + 28);
      };

      for (let phase = 1; phase <= 4; phase += 1) {
        for (let l = 0; l < lineages; l += 1) {
          const idx = (phase - 1) * lineages + l;
          initSlot(idx, phase, [0.07, 0.01, 0.07], [0, 0, 0], 0, 0, [0, 0, 0, 0], phase === 3 ? 0.6 : 1000, 1e-8);
        }
      }

      // Lineage 0: floor liquid at y = 0.01 m (0.018 kg) + separated rising wet vapor at y = 0.10 m (0.002 kg, 10% mist).
      const mistFrac = 0.10;
      const wetU = mistFrac * U_LIQ + (1 - mistFrac) * U_GAS;
      initSlot(1 * lineages + 0, 2, [0.07, 0.01, 0.07], [0, 0, 0], 0.018, U_LIQ, [0, 1, 0, 0], 1000, 0.018 / 1000);
      initSlot(2 * lineages + 0, 3, [0.07, 0.10, 0.07], [0, 0.25, 0], 0.002, wetU, [0, mistFrac, 1 - mistFrac, 0], 0.6, 0.002 / 0.6);

      // Lineage 1: co-located liquid and wet vapor at y = 0.01 m (merges into phase 2).
      initSlot(1 * lineages + 1, 2, [0.07, 0.01, 0.07], [0, 0, 0], 0.018, U_LIQ, [0, 1, 0, 0], 1000, 0.018 / 1000);
      initSlot(2 * lineages + 1, 3, [0.07, 0.0105, 0.07], [0, 0, 0], 0.002, wetU, [0, mistFrac, 1 - mistFrac, 0], 0.6, 0.002 / 0.6);

      const upload = (values, label) => {
        const buffer = identity.tagWebGpuBufferDevice(device.createBuffer({
          label,
          size: values.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        }), device);
        device.queue.writeBuffer(buffer, 0, values);
        return buffer;
      };

      const thermalMaterialTable = {
        segments: new Float32Array([
          1, 2, 2, 3,
          U_LIQ, U_GAS, 373.15, 373.15,
          1000, 0.6, 1, 0
        ]),
        records: new Float32Array([1, 0, 1, 1, 0.9, 0, 0, 0])
      };
      const mechanicsMaterialTable = {
        schema: mechanicsTableMod.ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA,
        phaseRecordCount: 2,
        records: new Float32Array([
          1, 2, 1000, 2e6, 0, 0, 45, 1, 0, 1, 0.001, 0.07,
          1, 3, 0.6, 1e5, 0, 0, 450, 1, 0, 1, 0, 0
        ])
      };

      const stateBuf = upload(state, 'svm-state');
      const thermoBuf = upload(thermo, 'svm-thermo');
      const mechBuf = upload(mechanics, 'svm-mech');
      const transferOut = await transfer.runSphPhaseCarrierTransferWebGpu({
        device,
        sphParticleState: {
          schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount,
          phaseCarrierPlan: plan
        },
        mlsMpmParticleState: {
          schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount
        },
        thermalMaterialTable,
        mechanicsMaterialTable,
        phaseCarrierPlan: plan,
        sourceStateBuffer: stateBuf,
        sourceThermoBuffer: thermoBuf,
        sourceMechanicsBuffer: mechBuf,
        readbackMode: 'full-parity-readback'
      });

      // Extract render rows & build render field with collective route on surface 1 and ordinary liquid on surface 0.
      const extracted = renderKernel.extractSphRenderRowsCpu({
        sphParticleState: {
          schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount,
          stateStrideFloats: 8,
          thermoStrideFloats: 12,
          state: transferOut.state,
          thermo: transferOut.thermo
        },
        mlsMpmParticleState: {
          schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount,
          mechanicsStrideFloats: 32,
          mechanics: transferOut.mechanics
        }
      });
      const opticsRows = new Float32Array(particleCount * 8);
      for (let i = 0; i < particleCount; i += 1) {
        opticsRows[i * 8 + 3] = abi.SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked;
      }
      // Ready collective route on phase 2 (condensed companion lane) for lineage 0 and 1.
      for (let l = 0; l < lineages; l += 1) {
        const liqIdx = 1 * lineages + l;
        opticsRows.set([1, 2, 55001, abi.SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready, 0, 0, 0, 0], liqIdx * 8);
      }
      const surfaceTable = renderKernel.buildSphRenderFieldSurfaceTable([
        {
          surfaceKey: 'liq-ordinary',
          materialId: 1,
          phaseId: 2,
          opticalStateId: 0,
          resolution: 16,
          isolation: 10,
          subtract: 2,
          radiusNorm: 0.15,
          colorLinear: [0.2, 0.5, 0.9]
        },
        {
          surfaceKey: 'steam-collective',
          materialId: 1,
          phaseId: 3,
          opticalStateId: 55001,
          resolution: 16,
          isolation: 1,
          subtract: 0.1,
          radiusNorm: 0.15,
          colorLinear: [1, 1, 1]
        }
      ]);

      const renderRowsBuf = upload(extracted.renderRows, 'svm-render-rows');
      const opticsBuf = upload(opticsRows, 'svm-optics-rows');
      const dispersedSidecar = {
        schema: abi.ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA,
        particleCount,
        opticsBuffer: opticsBuf,
        opticsByteLength: opticsRows.byteLength,
        rowStrideFloats: 8
      };
      // Compile & run sphRenderFieldWgsl directly to verify GPU plume optical depth & zero midair bulk liquid.
      const res = 16;
      const totalCells = res ** 3 * 2;
      const fieldOut = device.createBuffer({
        size: totalCells * 8 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      });
      const surfaceBuf = upload(surfaceTable.records, 'svm-surfaces');
      const dummyEvents = upload(new Float32Array(8 * 4), 'svm-events');
      const dummyHistory = upload(new Uint32Array(16), 'svm-hist');
      const paramsArr = new ArrayBuffer(32);
      new Uint32Array(paramsArr, 0, 4).set([particleCount, 2, totalCells, 0]);
      new Float32Array(paramsArr, 16, 3).set([0.05, 0.14, 0]);
      new Uint32Array(paramsArr, 28, 1).set([1]);
      const paramsBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(paramsBuf, 0, paramsArr);
      const gateBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(gateBuf, 0, new Uint32Array(8));

      const wgslMod = await import('/ulg-gpu-abi/src/wgsl.js');
      const module = device.createShaderModule({ code: wgslMod.sphRenderFieldWgsl });
      const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' }
      });
      const bg = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: renderRowsBuf } },
          { binding: 1, resource: { buffer: surfaceBuf } },
          { binding: 2, resource: { buffer: fieldOut } },
          { binding: 3, resource: { buffer: paramsBuf } },
          { binding: 4, resource: { buffer: dummyEvents } },
          { binding: 5, resource: { buffer: dummyHistory } },
          { binding: 6, resource: { buffer: gateBuf } },
          { binding: 7, resource: { buffer: opticsBuf } }
        ]
      });
      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(Math.ceil((res ** 3) / 64), 2, 1);
      pass.end();
      const readBuf = device.createBuffer({ size: totalCells * 8 * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      enc.copyBufferToBuffer(fieldOut, 0, readBuf, 0, totalCells * 8 * 4);
      device.queue.submit([enc.finish()]);
      await readBuf.mapAsync(GPUMapMode.READ);
      const fieldFloats = new Float32Array(readBuf.getMappedRange().slice(0));
      readBuf.unmap();

      let upperBulkLiquidMax = 0;
      let upperCollectiveTauSum = 0;
      const cellsPerSurf = res ** 3;
      for (let z = 0; z < res; z += 1) {
        for (let y = 8; y < res; y += 1) {
          for (let x = 0; x < res; x += 1) {
            const c = x + y * res + z * res * res;
            upperBulkLiquidMax = Math.max(upperBulkLiquidMax, fieldFloats[c * 8]);
            upperCollectiveTauSum += fieldFloats[(cellsPerSurf + c) * 8 + 5];
          }
        }
      }

      const validationError = (await device.popErrorScope())?.message || null;
      device.destroy();
      return {
        status: 'ok',
        validationError,
        transferStatus: transferOut.status,
        outState: Array.from(transferOut.state),
        outThermo: Array.from(transferOut.thermo),
        upperBulkLiquidMax,
        upperCollectiveTauSum,
        dispersedSidecarSchema: dispersedSidecar.schema
      };
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'ok');
  assert.equal(native.validationError, null);
  assert.equal(native.transferStatus, 'phase-carrier-transfer-complete');

  const lineages = 2;
  const liq0 = 1 * lineages + 0;
  const gas0 = 2 * lineages + 0;
  const liq1 = 1 * lineages + 1;
  const gas1 = 2 * lineages + 1;

  // Lineage 0 (separated): floor liquid stays 0.018 kg at y = 0.01 m; rising wet vapor keeps 0.002 kg at y = 0.10 m with [0, 0.10, 0.90, 0].
  assert.ok(Math.abs(native.outState[liq0 * 8 + 3] - 0.018) < 1e-7, 'floor pool mass untouched');
  assert.ok(Math.abs(native.outState[liq0 * 8 + 1] - 0.01) < 1e-7, 'floor pool y untouched');
  assert.ok(Math.abs(native.outState[gas0 * 8 + 3] - 0.002) < 1e-7, 'plume vapor+mist mass conserved');
  assert.ok(Math.abs(native.outState[gas0 * 8 + 1] - 0.10) < 1e-7, 'plume y preserved');
  assert.ok(Math.abs(native.outThermo[gas0 * 12 + 5] - 0.10) < 1e-6, 'plume mist fraction preserved');
  assert.ok(Math.abs(native.outThermo[gas0 * 12 + 6] - 0.90) < 1e-6, 'plume vapor fraction preserved');

  // Lineage 1 (co-located): condensate merges into phase 2 (0.0182 kg) and leaves dry gas (0.0018 kg).
  assert.ok(Math.abs(native.outState[liq1 * 8 + 3] - 0.0182) < 1e-6, 'co-located condensate merges');
  assert.ok(Math.abs(native.outState[gas1 * 8 + 3] - 0.0018) < 1e-6, 'co-located remaining dry vapor');
  assert.ok(Math.abs(native.outThermo[gas1 * 12 + 5] - 0.0) < 1e-6, 'co-located gas becomes dry');
  assert.ok(Math.abs(native.outThermo[gas1 * 12 + 6] - 1.0) < 1e-6, 'co-located gas one-hot');

  // Render field: upper half has zero bulk liquid marching-cubes density and positive collective Mie scattering tau!
  assert.equal(native.upperBulkLiquidMax, 0, 'suspended plume mist excluded from ordinary liquid marching cubes');
  assert.ok(native.upperCollectiveTauSum > 0.1, `expected positive plume optical depth, got ${native.upperCollectiveTauSum}`);
});
