import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_STEFAN_EXACT === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test(
  'exact 2^-149 integer-mass Stefan skin-first shader partitions skin mass bit-for-bit conservatively on real Vulkan WebGPU',
  { skip: !RUN_NATIVE, timeout: 180000 },
  async () => {
    const { chromium } = await import('@playwright/test');
    const wayland = Boolean(process.env.WAYLAND_DISPLAY);
    const browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: !wayland,
      args: [
        '--ignore-certificate-errors',
        '--use-angle=vulkan',
        '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        ...(wayland ? ['--ozone-platform=wayland'] : [])
      ]
    });
    let result;
    try {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const url = 'https://127.0.0.1:5173/__exact_stefan_skin_gpu_test__';
      await page.route(url, (route) => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Exact Stefan Skin GPU</title>'
      }));
      await page.goto(url);
      result = await page.evaluate(async () => {
        const { prepareSphExactPhaseCarrierMass } = await import('/src/runtime/sph/sphExactPhaseCarrierMassGpu.js');
        const { createSphExactMassFormat, encodeSphExactMass } = await import('/ulg-gpu-abi/src/sphExactMassInventory.js');
        const { tagWebGpuBufferDevice } = await import('/src/runtime/sph/sphGpuDeviceIdentity.js');

        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice({
          requiredLimits: { maxStorageBuffersPerShaderStage: 12 }
        });
        const errors = [];
        device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));
        device.pushErrorScope('validation');

        const format = createSphExactMassFormat({ wordCount: 8, quantumExponent: -149 });
        const lineageCapacity = 1;
        const count = 4;
        const liquidRow = 1; // phase lane 1 = liquid (phaseId 2)
        const vaporRow = 2;  // phase lane 2 = gas (phaseId 3)
        const MASS_KG = 1e-4;
        const U_PRE = 1e5;
        const SKIN_J = 50;
        const U_TARGET = 2.6e6;
        const T_STAR = 373.15;
        const EPOCH = 41;
        const FACE_OFFSET = 0.002;

        const sourceMassWords = new Uint32Array(count * format.wordCount);
        const encoded = encodeSphExactMass(MASS_KG, format);
        sourceMassWords.set(encoded, liquidRow * format.wordCount);

        const state = new Float32Array(count * 8);
        const thermo = new Float32Array(count * 12);
        const mechanics = new Float32Array(count * 32);
        state.set([0.5, 0.5, 0.5, MASS_KG, 0.1, 0, 0, U_PRE + SKIN_J / MASS_KG], liquidRow * 8);
        for (let i = 0; i < count; i += 1) {
          const p = i + 1;
          thermo.set([1, p, i === liquidRow ? 300 : 0, 1000, p === 1 ? 1 : 0, p === 2 ? 1 : 0, p === 3 ? 1 : 0, p === 4 ? 1 : 0, 0.005, i === liquidRow ? 1e20 : 0, i === liquidRow ? 1 : 254, 0.002], i * 12);
        }

        const ROW_WORDS = 24;
        const front = new Uint32Array(count * ROW_WORDS);
        const frontF = new Float32Array(front.buffer);
        const r = liquidRow * ROW_WORDS;
        frontF[r + 15] = SKIN_J;
        frontF[r + 16] = U_PRE;
        frontF[r + 17] = U_TARGET;
        frontF[r + 18] = T_STAR;
        front[r + 19] = (EPOCH << 3) | 3; // target phase = 3 (vapor)
        frontF[r + 20] = FACE_OFFSET;

        const owned = [];
        const makeBuf = (label, dataOrSize, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST) => {
          const size = typeof dataOrSize === 'number' ? dataOrSize : dataOrSize.byteLength;
          const b = tagWebGpuBufferDevice(device.createBuffer({ label, size: Math.max(16, size), usage }), device);
          if (typeof dataOrSize !== 'number') device.queue.writeBuffer(b, 0, dataOrSize);
          owned.push(b);
          return b;
        };
        const sourceMassBuffer = makeBuf('src-mass', sourceMassWords);
        const sourceThermoBuffer = makeBuf('src-thermo', thermo);
        const sourceStateBuffer = makeBuf('src-state', state);
        const sourceMechanicsBuffer = makeBuf('src-mech', mechanics);
        const frontBuffer = makeBuf('front', front);
        const skinScratchBuffer = makeBuf('skin-scratch', count * 128);

        const stage = await prepareSphExactPhaseCarrierMass({
          device,
          format,
          lineageCapacity,
          sourceMassBuffer,
          sourceThermoBuffer,
          interfaceFront: { buffer: frontBuffer, epoch: EPOCH, headerWords: 0, rowWords: ROW_WORDS },
          frontBuffer,
          sourceStateBuffer,
          sourceMechanicsBuffer,
          skinScratchBuffer,
          allocate: (desc) => makeBuf(desc.label, desc.size, desc.usage),
          validate: () => {}
        });

        const readMass = makeBuf('read-mass', stage.massBuffer.size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
        const readVal = makeBuf('read-val', 16, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
        const readSkin = makeBuf('read-skin', skinScratchBuffer.size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
        const encoder = device.createCommandEncoder();
        stage.encode(encoder);
        encoder.copyBufferToBuffer(stage.massBuffer, 0, readMass, 0, stage.massBuffer.size);
        encoder.copyBufferToBuffer(stage.validationBuffer, 0, readVal, 0, 16);
        encoder.copyBufferToBuffer(skinScratchBuffer, 0, readSkin, 0, skinScratchBuffer.size);
        device.queue.submit([encoder.finish()]);

        await Promise.all([readMass.mapAsync(GPUMapMode.READ), readVal.mapAsync(GPUMapMode.READ), readSkin.mapAsync(GPUMapMode.READ)]);
        const outMassWords = new Uint32Array(readMass.getMappedRange().slice(0));
        const valWords = new Uint32Array(readVal.getMappedRange().slice(0));
        const skinFloats = new Float32Array(readSkin.getMappedRange().slice(0));
        readMass.unmap(); readVal.unmap(); readSkin.unmap();

        const wordsToBigInt = (arr, rowIdx) => {
          let total = 0n;
          for (let w = format.wordCount - 1; w >= 0; w -= 1) {
            total = (total << 32n) | BigInt(arr[rowIdx * format.wordCount + w]);
          }
          return total;
        };
        const mOrig = wordsToBigInt(sourceMassWords, liquidRow);
        const mRem = wordsToBigInt(outMassWords, liquidRow);
        const mConv = wordsToBigInt(outMassWords, vaporRow);

        const validationError = await device.popErrorScope();
        for (const b of owned) b.destroy();
        device.destroy();

        return {
          errors,
          validationError: validationError ? validationError.message : null,
          skinFrontActive: stage.skinFrontActive,
          controlError: valWords[0],
          exactConserved: (mRem + mConv) === mOrig,
          convFraction: Number(mConv) / Number(mOrig),
          expectedFraction: (SKIN_J / (U_TARGET - U_PRE)) / MASS_KG,
          skinMeta: Array.from(skinFloats.slice(liquidRow * 32, liquidRow * 32 + 12))
        };
      });
    } finally {
      await browser.close();
    }

    assert.deepEqual(result.errors, []);
    assert.equal(result.validationError, null);
    assert.equal(result.skinFrontActive, true);
    assert.equal(result.controlError, 0);
    assert.equal(result.exactConserved, true, '2^-149 integer mass must conserve bit-for-bit across Stefan skin partition!');
    assert.ok(Math.abs(result.convFraction - result.expectedFraction) < 1e-6);
    // Verify exact first-moment balance: m_rem * own_offset + m_conv * conv_offset == 0!
    const [active, tgtPhase, ownU, tgtU, ownOffX, , , ownPhase, convOffX] = result.skinMeta;
    assert.equal(active, 1);
    assert.equal(tgtPhase, 3);
    assert.equal(ownPhase, 2);
    assert.ok(Math.abs(tgtU - 2.6e6) < 1);
    assert.ok(Math.abs(ownU - 1e5) < 10);
    assert.ok(Math.abs(convOffX - 0.002) < 1e-6);
    const firstMomentResidual = (1 - result.convFraction) * ownOffX + result.convFraction * convOffX;
    assert.ok(Math.abs(firstMomentResidual) < 1e-8, `first-moment residual ${firstMomentResidual}`);
  }
);
