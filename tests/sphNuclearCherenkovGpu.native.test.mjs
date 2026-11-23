import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_CHERENKOV === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test('GPU-native Cherenkov & Nuclear Decay: exact 2^-149 energy ledger sum(U-S), live off-center & multi-source centroid tracking, and 3D world-space dielectric volumetric rendering on real Vulkan GPU', {
  skip: !RUN_NATIVE && 'set ULG_RUN_NATIVE_CHERENKOV=1 or ULG_RUN_NATIVE_WEBGPU=1',
  timeout: 120000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--ignore-certificate-errors',
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
      '--enable-webgpu-developer-features'
    ]
  });
  try {
    const page = await browser.newPage();
    const url = 'https://127.0.0.1:5173/__sph_nuclear_cherenkov_gpu_proof__';
    await page.route(url, (route) => route.fulfill({
      contentType: 'text/html',
      body: '<title>GPU-Native Nuclear & Volumetric Cherenkov Proof</title>'
    }));
    await page.goto(url);
    await page.waitForFunction(
      async () => Boolean(await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' })),
      null,
      { timeout: 10000, polling: 250 }
    );

    const result = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message || e.error)));

      const {
        seedSphNuclearCherenkovSources,
        encodeSphNuclearDecayAndCherenkovTick,
        latestSphNuclearCherenkovState,
        clearSphNuclearCherenkovState,
        createSphCherenkovVolumetricRenderer,
        destroySphNuclearCherenkovGpuResources
      } = await import('/src/runtime/sph/sphNuclearCherenkovGpu.js');
      const {
        SPH_EXACT_THERMAL_ENERGY_FORMAT,
        SPH_EXACT_THERMAL_ENERGY_WORDS,
        sphExactThermalEnergyRecordWords
      } = await import('/src/runtime/sph/sphExactThermalEnergyWgsl.js');
      const {
        encodeSphExactMass
      } = await import('/ulg-gpu-abi/src/sphExactMassInventory.js');
      const {
        WORKER_NATIVE_SURFACE_UNIFORM_BYTES
      } = await import('/src/services/workerOwnedNativeSurfaceMaterial.js');

      const readBuffer = async (srcBuf, byteLength) => {
        const staging = device.createBuffer({
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(srcBuf, 0, staging, 0, byteLength);
        device.queue.submit([enc.finish()]);
        await staging.mapAsync(GPUMapMode.READ);
        const copy = new Uint8Array(staging.getMappedRange()).slice();
        staging.unmap();
        staging.destroy();
        return copy.buffer;
      };

      // --- Part 1: GPU decay heating + exact 2^-149 energy ledger + multi-source off-center centroid ---
      const N = 12;
      // Domain 1: dielectric particles (indices 0..3)
      // Domain 2: off-center Co-60 source A around (+0.45, +0.35, -0.25) (indices 4..7)
      // Domain 3: second Co-60 source B around (-0.42, +0.28, +0.30) (indices 8..11)
      const stateInit = new Float32Array(N * 8);
      const idInit = new Uint32Array(N);
      const pA = [
        [0.40, 0.30, -0.20], [0.50, 0.30, -0.20],
        [0.40, 0.40, -0.30], [0.50, 0.40, -0.30]
      ];
      const pB = [
        [-0.47, 0.23, 0.25], [-0.37, 0.23, 0.25],
        [-0.47, 0.33, 0.35], [-0.37, 0.33, 0.35]
      ];
      const massKg = 0.5;
      const u0 = 100000.0;
      for (let i = 0; i < N; i += 1) {
        const pos = i < 4 ? [0, 0.2, 0] : (i < 8 ? pA[i - 4] : pB[i - 8]);
        stateInit.set([pos[0], pos[1], pos[2], massKg, 0, 0, 0, u0], i * 8);
        idInit[i] = i < 4 ? 1 : (i < 8 ? 2 : 3);
      }
      const stateBuffer = device.createBuffer({
        size: stateInit.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      device.queue.writeBuffer(stateBuffer, 0, stateInit);
      const identityBuffer = device.createBuffer({
        size: idInit.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(identityBuffer, 0, idInit);

      const exactWordsTotal = sphExactThermalEnergyRecordWords(N);
      const exactInit = new Uint32Array(exactWordsTotal);
      const uRowWords = encodeSphExactMass(massKg * u0, SPH_EXACT_THERMAL_ENERGY_FORMAT);
      for (let i = 0; i < N; i += 1) {
        exactInit.set(uRowWords, i * SPH_EXACT_THERMAL_ENERGY_WORDS);
      }
      const exactEnergyBuffer = device.createBuffer({
        size: exactInit.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      device.queue.writeBuffer(exactEnergyBuffer, 0, exactInit);

      const nuclearDescriptor = {
        medium: 'sio2-solid',
        refractiveIndex: 1.48,
        sources: [
          {
            bodyId: 'coA', domainId: 2, material: 'Co', materialId: 27,
            isotope: 'Co-60', daughterIsotope: 'Ni-60', mode: 'beta-minus',
            centerM: [0, 0, 0], radiusM: 0.08, massKg: 2.0,
            initialAtomCount: 2e22, lambdaPerS: 4.167e-9, qValueMeV: 2.823,
            localDepositionFraction: 0.55, secondaryElectronMeV: 0.96,
            beta: 0.937, attenuationRangeM: 0.22
          },
          {
            bodyId: 'coB', domainId: 3, material: 'Co', materialId: 27,
            isotope: 'Co-60', daughterIsotope: 'Ni-60', mode: 'beta-minus',
            centerM: [0, 0, 0], radiusM: 0.08, massKg: 2.0,
            initialAtomCount: 2e22, lambdaPerS: 4.167e-9, qValueMeV: 2.823,
            localDepositionFraction: 0.55, secondaryElectronMeV: 0.96,
            beta: 0.937, attenuationRangeM: 0.22
          }
        ]
      };

      // Dormant check first
      assertDormant: {
        const dormantEnc = device.createCommandEncoder();
        const dormantRes = encodeSphNuclearDecayAndCherenkovTick(device, dormantEnc, {
          stateBuffer, identityBuffer, exactEnergyBuffer, particleCount: N, dtS: 1.0,
          nuclearDescriptor: { sources: [] }
        });
        device.queue.submit([dormantEnc.finish()]);
        if (dormantRes !== null) throw new Error('Dormant nuclear tick must return null');
      }

      seedSphNuclearCherenkovSources(device, {
        nuclearDescriptor, stateBuffer, identityBuffer, particleCount: N
      });
      const enc = device.createCommandEncoder();
      const tickSnap = encodeSphNuclearDecayAndCherenkovTick(device, enc, {
        stateBuffer, identityBuffer, exactEnergyBuffer, particleCount: N,
        dtS: 3600.0, nuclearDescriptor
      });
      device.queue.submit([enc.finish()]);
      await device.queue.onSubmittedWorkDone();

      const stateAfter = new Float32Array(await readBuffer(stateBuffer, stateInit.byteLength));
      const exactAfter = new Uint32Array(await readBuffer(exactEnergyBuffer, exactInit.byteLength));
      const gpuState = latestSphNuclearCherenkovState(device);
      const sourcesBuf = new Float32Array(await readBuffer(gpuState.cherenkovSourcesBuffer, (1 + 16 * 2) * 16));

      // Check bit-exact sum(U - S) invariant on exact 2^-149 ledger!
      const W = SPH_EXACT_THERMAL_ENERGY_WORDS;
      const toBigIntSigned = (arr, off) => {
        const sign = arr[off + W - 1] >= 0x80000000;
        let mag = 0n;
        if (!sign) {
          for (let w = 0; w < W; w += 1) mag += BigInt(arr[off + w]) << BigInt(w * 32);
          return mag;
        }
        // two's complement
        const mod = 1n << BigInt(W * 32);
        for (let w = 0; w < W; w += 1) mag += BigInt(arr[off + w]) << BigInt(w * 32);
        return mag - mod;
      };
      let sumInitial = 0n;
      let sumUminusS = 0n;
      let sumS = 0n;
      for (let i = 0; i < N; i += 1) {
        sumInitial += toBigIntSigned(exactInit, i * W);
        const uVal = toBigIntSigned(exactAfter, i * W);
        const sVal = toBigIntSigned(exactAfter, (N + i) * W);
        sumUminusS += (uVal - sVal);
        sumS += sVal;
      }

      const centroidA = [sourcesBuf[4], sourcesBuf[5], sourcesBuf[6]];
      const centroidB = [sourcesBuf[12], sourcesBuf[13], sourcesBuf[14]];
      const dielectricUUnchanged = stateAfter[0 * 8 + 7] === u0;
      const coAHeated = stateAfter[4 * 8 + 7] > u0;
      const coBHeated = stateAfter[8 * 8 + 7] > u0;

      // --- Part 2: Real 3D Volumetric Cherenkov Shader Test (off-center dielectric vs opaque metal vs vacuum vs sub-threshold) ---
      // Render a dielectric slab spanning [-1, 1] x [-1, 1] x [-0.5, +0.5] in orthographic-like view
      // with ONE off-center source at (+0.55, 0.0, 0.0) in NDC-mapped right half of the frame!
      const Wpx = 64;
      const Hpx = 64;
      const colorTex = device.createTexture({
        size: [Wpx, Hpx],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });
      const depthTex = device.createTexture({
        size: [Wpx, Hpx],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
      const backDepthTex = device.createTexture({
        size: [Wpx, Hpx],
        format: 'depth32float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });

      // Front face at z = +0.4, back face at z = -0.4 (camera at z = +2 looking toward -z)
      // Identity VP maps world x,y in [-1, 1] -> NDC x,y in [-1, 1], world z = +0.4 -> clip z = -0.4 (depth 0.3), z = -0.4 -> depth 0.7
      // Use diagonal VP = diag(1, 1, -1, 1) so +z is nearer (smaller depth)!
      const vp = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, -1, 0,
        0, 0, 0, 1
      ]);
      const invVp = new Float32Array(vp);

      // Front quad (2 CCW triangles at z = +0.4, facing +z)
      const frontVerts = new Float32Array([
        -0.9, -0.9, 0.4, 0,
         0.9, -0.9, 0.4, 0,
         0.9,  0.9, 0.4, 0,
        -0.9, -0.9, 0.4, 0,
         0.9,  0.9, 0.4, 0,
        -0.9,  0.9, 0.4, 0
      ]);
      const backVerts = new Float32Array([
        -0.9, -0.9, -0.4, 0,
         0.9,  0.9, -0.4, 0,
         0.9, -0.9, -0.4, 0,
        -0.9, -0.9, -0.4, 0,
        -0.9,  0.9, -0.4, 0,
         0.9,  0.9, -0.4, 0
      ]);
      const posBuf = device.createBuffer({ size: frontVerts.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(posBuf, 0, frontVerts);
      const backPosBuf = device.createBuffer({ size: backVerts.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(backPosBuf, 0, backVerts);
      const normBuf = device.createBuffer({ size: 6 * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(normBuf, 0, new Uint32Array(6).fill(0x80008000));
      const indirectBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(indirectBuf, 0, new Uint32Array([6, 1, 0, 0]));

      // Populate backDepthTex at z = -0.4 -> ndc z = +0.4 -> clip.z*0.5 + 0.5 = 0.7
      const backShader = device.createShaderModule({
        code: `
          @group(0) @binding(0) var<storage, read> verts: array<vec4<f32>>;
          @vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
            let p = verts[i].xyz;
            return vec4<f32>(p.x, p.y, (-p.z) * 0.5 + 0.5, 1.0);
          }
        `
      });
      const backPipe = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: backShader, entryPoint: 'vs' },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });
      const backBg = device.createBindGroup({
        layout: backPipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: backPosBuf } }]
      });

      const cameraUniformBuffer = device.createBuffer({
        size: WORKER_NATIVE_SURFACE_UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const makeCameraUniform = (materialId) => {
        const buf = new ArrayBuffer(WORKER_NATIVE_SURFACE_UNIFORM_BYTES);
        const f = new Float32Array(buf);
        const u = new Uint32Array(buf);
        f.set(vp, 0);
        u[16] = 6; // vertex_count
        u[17] = 4; // source_stride_floats
        u[18] = 0; // surface_index
        u[19] = 2; // triangle_count
        f[20] = materialId; // material_id
        f[21] = 2; // phase_id
        f[22] = 0; // optical_state_id
        f[51] = 1.5; // bounds_radius_m
        f[60] = 0.0; // cam x
        f[61] = 0.0; // cam y
        f[62] = 2.0; // cam z
        f.set(invVp, 64);
        return buf;
      };

      // Optical records:
      //   mat 10: fused silica glass dielectric (ior=1.48, transmission=0.95, metalness=0.0)
      //   mat 20: opaque metallic Co (ior=1.0, transmission=0.0, metalness=1.0)
      //   mat 30: vacuum / gas (ior=1.0, transmission=1.0, metalness=0.0)
      const optRecs = new Float32Array(3 * 6 * 4);
      const writeOpt = (slot, matId, ior, transmission, metalness) => {
        const b = slot * 24;
        optRecs.set([matId, 2, 0, 0], b + 0); // row0: material_id, phase_id
        optRecs.set([0.9, 0.95, 1.0, metalness], b + 4); // row1: rgb, metalness
        optRecs.set([0.05, transmission, 0.04, ior], b + 8); // row2: roughness, transmission, f0, ior
        optRecs.set([0.92, 0.96, 0.99, 2.0], b + 12); // row3: attenuation_linear, attenuation_distance_m
        optRecs.set([0, 0, 0, 0], b + 16); // row4
        optRecs.set([0, 0, 0, 0], b + 20); // row5: blocked=0, state=0
      };
      writeOpt(0, 10, 1.48, 0.95, 0.0);
      writeOpt(1, 20, 1.0, 0.0, 1.0);
      writeOpt(2, 30, 1.0, 1.0, 0.0);
      const opticalRecordsBuffer = device.createBuffer({
        size: optRecs.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(opticalRecordsBuffer, 0, optRecs);

      const renderer = createSphCherenkovVolumetricRenderer(device, {
        colorFormat: 'rgba8unorm',
        depthFormat: 'depth24plus'
      });

      const renderCase = async (materialId, betaVal) => {
        const srcBuf = new Float32Array((1 + 16 * 2) * 4);
        srcBuf[0] = 1.0;
        // Single OFF-CENTER source at x = +0.55, y = 0.0, z = 0.0!
        srcBuf.set([0.55, 0.0, 0.0, 0.08], 4);
        srcBuf.set([betaVal, 0.25, 12.0, 1.0], 8);
        const testSourcesBuf = device.createBuffer({
          size: srcBuf.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(testSourcesBuf, 0, srcBuf);
        device.queue.writeBuffer(cameraUniformBuffer, 0, makeCameraUniform(materialId));

        const rEnc = device.createCommandEncoder();
        const bp = rEnc.beginRenderPass({
          colorAttachments: [],
          depthStencilAttachment: {
            view: backDepthTex.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
          }
        });
        bp.setPipeline(backPipe);
        bp.setBindGroup(0, backBg);
        bp.draw(6);
        bp.end();

        const fp = rEnc.beginRenderPass({
          colorAttachments: [{
            view: colorTex.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store'
          }],
          depthStencilAttachment: {
            view: depthTex.createView(),
            depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store'
          }
        });
        renderer.draw(fp, {
          compactPositionRowsBuffer: posBuf,
          compactNormalRowsBuffer: normBuf,
          drawIndirectRowsBuffer: indirectBuf,
          cameraUniformBuffer,
          opticalRecordsBuffer,
          backDepthView: backDepthTex.createView(),
          cherenkovSourcesBuffer: testSourcesBuf
        });
        fp.end();

        const readTex = device.createBuffer({
          size: Wpx * Hpx * 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        rEnc.copyTextureToBuffer({ texture: colorTex }, { buffer: readTex, bytesPerRow: Wpx * 4 }, [Wpx, Hpx]);
        device.queue.submit([rEnc.finish()]);
        await readTex.mapAsync(GPUMapMode.READ);
        const px = new Uint8Array(readTex.getMappedRange()).slice();
        readTex.unmap();
        readTex.destroy();
        testSourcesBuf.destroy();

        const sample = (x, y) => {
          const i = (y * Wpx + x) * 4;
          return [px[i], px[i + 1], px[i + 2]];
        };
        let nonZero = 0;
        let maxB = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i] > 0 || px[i + 1] > 0 || px[i + 2] > 0) nonZero += 1;
          if (px[i + 2] > maxB) maxB = px[i + 2];
        }
        // x = +0.55 maps to pixel x = Math.round((0.55 * 0.5 + 0.5) * 64) = 50, y = 32
        // x = -0.55 maps to pixel x = 14, y = 32; screen center x = 32, y = 32
        return {
          nonZero,
          maxB,
          atOffCenterSource: sample(50, 32),
          atScreenCenter: sample(32, 32),
          atOppositeSide: sample(14, 32)
        };
      };

      const silicaCo60 = await renderCase(10, 0.937); // SiO2 n=1.48, beta=0.937 > 1/1.48 -> active!
      const silicaTritium = await renderCase(10, 0.14); // H-3 beta=0.14 < 1/1.48 -> 0 pixels!
      const metalCo60 = await renderCase(20, 0.937); // Opaque Co metal -> 0 pixels!
      const vacuumCo60 = await renderCase(30, 0.937); // Vacuum n=1.0 -> 0 pixels!

      renderer.dispose();
      clearSphNuclearCherenkovState(device);
      destroySphNuclearCherenkovGpuResources(device);
      colorTex.destroy(); depthTex.destroy(); backDepthTex.destroy();
      posBuf.destroy(); backPosBuf.destroy(); normBuf.destroy(); indirectBuf.destroy();
      cameraUniformBuffer.destroy(); opticalRecordsBuffer.destroy();
      stateBuffer.destroy(); identityBuffer.destroy(); exactEnergyBuffer.destroy();
      device.destroy();

      return {
        gpuErrors,
        exactEnergySumConservedBitExact: sumUminusS === sumInitial,
        exactSourceEnergyPositive: sumS > 0n,
        dielectricUUnchanged,
        coAHeated,
        coBHeated,
        centroidA,
        centroidB,
        tickDecays: tickSnap.totalDecays,
        tickThermalJ: tickSnap.totalDepositedThermalEnergyJ,
        silicaCo60,
        silicaTritium,
        metalCo60,
        vacuumCo60
      };
    });

    assert.deepEqual(result.gpuErrors, [], `WebGPU errors: ${result.gpuErrors.join('; ')}`);
    assert.equal(result.exactEnergySumConservedBitExact, true, 'Exact 2^-149 ledger sum(U - S) must be bit-invariant across GPU nuclear decay heat deposition');
    assert.equal(result.exactSourceEnergyPositive, true, 'Cumulative exact nuclear source ledger S must increase');
    assert.equal(result.dielectricUUnchanged, true, 'Non-radioactive dielectric particles must not receive direct decay heat');
    assert.equal(result.coAHeated, true, 'Co-60 source A must heat on GPU');
    assert.equal(result.coBHeated, true, 'Co-60 source B must heat on GPU');
    assert.ok(result.tickDecays > 0 && result.tickThermalJ > 0);

    // Off-center multi-source centroid accuracy (< 2 mm)
    assert.ok(Math.abs(result.centroidA[0] - 0.45) < 0.002 && Math.abs(result.centroidA[1] - 0.35) < 0.002 && Math.abs(result.centroidA[2] - (-0.25)) < 0.002,
      `Source A GPU centroid drifted: ${JSON.stringify(result.centroidA)}`);
    assert.ok(Math.abs(result.centroidB[0] - (-0.42)) < 0.002 && Math.abs(result.centroidB[1] - 0.28) < 0.002 && Math.abs(result.centroidB[2] - 0.30) < 0.002,
      `Source B GPU centroid drifted: ${JSON.stringify(result.centroidB)}`);

    // 3D world-space volumetric shader invariants:
    assert.ok(result.silicaCo60.nonZero > 20, `Expected volumetric Cherenkov pixels in fused silica, got ${result.silicaCo60.nonZero}`);
    assert.ok(result.silicaCo60.atOffCenterSource[2] > result.silicaCo60.atOffCenterSource[0],
      `Expected blue-dominant Frank-Tamm color at off-center source, got ${JSON.stringify(result.silicaCo60.atOffCenterSource)}`);
    assert.ok(result.silicaCo60.atOffCenterSource[2] > result.silicaCo60.atScreenCenter[2] + 30,
      `3D Cherenkov glow must peak at off-center 3D source (${JSON.stringify(result.silicaCo60.atOffCenterSource)}), NOT screen center (${JSON.stringify(result.silicaCo60.atScreenCenter)})!`);
    assert.ok(result.silicaCo60.atOffCenterSource[2] > result.silicaCo60.atOppositeSide[2] + 60,
      `Opposite side of slab must attenuate cleanly (${JSON.stringify(result.silicaCo60.atOppositeSide)})`);

    // Strict fail-closed proofs:
    assert.equal(result.silicaTritium.nonZero, 0, 'Sub-threshold H-3 (beta=0.14 < 1/n) must emit 0 Cherenkov pixels');
    assert.equal(result.metalCo60.nonZero, 0, 'Opaque metallic Co surface must emit 0 Cherenkov pixels');
    assert.equal(result.vacuumCo60.nonZero, 0, 'Vacuum (n=1.0) must emit 0 Cherenkov pixels');
  } finally {
    await browser.close();
  }
});
