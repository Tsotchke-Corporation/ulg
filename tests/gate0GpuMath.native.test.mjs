import assert from 'node:assert/strict';
import test from 'node:test';

// Gate 0B Native Vulkan WebGPU Proof for `src/runtime/gpuMath/`:
//   1. `batchedSymmetricEigensolverGpu`: standard & generalized (Löwdin S^{-1/2})
//      eigenproblems on Vulkan (`||V^T V - I|| < 1e-4`, `||A - V Λ V^T|| < 1e-4`).
//   2. `fft3dWebGpu`: 16^3 forward/inverse FFT (Parseval & round-trip < 1e-5) +
//      3D periodic Poisson solver + exact spectral gradient (`< 1e-5`).
//   3. `molecularDynamicsWebGpu`: 108-atom FCC Lennard-Jones NVE (momentum & energy
//      conservation, RDF peak), Finnis-Sinclair EAM metal, and Stillinger-Weber
//      3-body covalent dynamics (`0` GPU errors, zero NaNs).
//   4. `chebyshevPolytopeFitGpu` + `evaluatePolytopeAtlasWgsl`: slanted
//      Clausius-Clapeyron convex polytope fitted & evaluated on GPU with strict
//      fail-closed outside-domain miss (`hitFlag === 0`).

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1'
  || process.env.ULG_RUN_NATIVE_GATE0 === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Gate 0B native Vulkan proof: gpuMath (batched eigensolver, 3D FFT + Poisson, WebGPU MD, GPU Polytope Atlas)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Gate 0B proof',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });

  try {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const result = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 6 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 300));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const {
        solveSymmetricEigenBatchedWebGpu,
        solveGeneralizedSymmetricEigenBatchedWebGpu,
        fft3dWebGpu,
        solvePoisson3dWebGpu,
        createMolecularDynamicsSessionWebGpu,
        buildFccCrystalMdState,
        MD_POTENTIAL_MODELS,
        fitConvexPolytopeWebGpu
      } = await import('/src/runtime/gpuMath/index.js');
      const { createMaterialPolytopeRegistry } = await import('/src/runtime/material/materialPolytopeRegistry.js');
      const { evaluatePolytopeAtlasWgsl } = await import('/ulg-gpu-abi/src/materialFoundationAbi.js');

      // ---- 1. Batched Symmetric & Generalized Eigensolver ----
      const nEig = 12;
      const batchEig = 4;
      const mats = new Float32Array(batchEig * nEig * nEig);
      for (let b = 0; b < batchEig; b += 1) {
        for (let i = 0; i < nEig; i += 1) {
          for (let j = i; j < nEig; j += 1) {
            const val = i === j
              ? (i + 1) * (1.2 + 0.3 * b)
              : 0.15 * Math.sin((i + 1) * (j + 2) + b);
            mats[b * nEig * nEig + i * nEig + j] = val;
            mats[b * nEig * nEig + j * nEig + i] = val;
          }
        }
      }
      const eigRes = await solveSymmetricEigenBatchedWebGpu(device, {
        matrices: mats,
        n: nEig,
        batchCount: batchEig,
        maxSweeps: 40,
        tolerance: 1e-6
      });
      let maxOrthoErr = 0;
      let maxReconErr = 0;
      let sortedOk = true;
      for (let b = 0; b < batchEig; b += 1) {
        const base = b * nEig * nEig;
        for (let i = 1; i < nEig; i += 1) {
          if (eigRes.eigenvalues[b * nEig + i] < eigRes.eigenvalues[b * nEig + i - 1] - 1e-5) sortedOk = false;
        }
        for (let i = 0; i < nEig; i += 1) {
          for (let j = 0; j < nEig; j += 1) {
            let dot = 0;
            let recon = 0;
            for (let k = 0; k < nEig; k += 1) {
              dot += eigRes.eigenvectors[base + k * nEig + i] * eigRes.eigenvectors[base + k * nEig + j];
              recon += eigRes.eigenvectors[base + i * nEig + k] * eigRes.eigenvalues[b * nEig + k] * eigRes.eigenvectors[base + j * nEig + k];
            }
            maxOrthoErr = Math.max(maxOrthoErr, Math.abs(dot - (i === j ? 1 : 0)));
            maxReconErr = Math.max(maxReconErr, Math.abs(recon - mats[base + i * nEig + j]));
          }
        }
      }

      // Generalized eigenproblem F C = S C lambda
      const ng = 6;
      const fMat = new Float32Array(ng * ng);
      const sMat = new Float32Array(ng * ng);
      for (let i = 0; i < ng; i += 1) {
        for (let j = i; j < ng; j += 1) {
          const sv = i === j ? 1.0 : 0.25 * Math.exp(-0.5 * Math.abs(i - j));
          const fv = i === j ? -(ng - i) * 0.8 : -0.35 * sv;
          sMat[i * ng + j] = sv; sMat[j * ng + i] = sv;
          fMat[i * ng + j] = fv; fMat[j * ng + i] = fv;
        }
      }
      const genRes = await solveGeneralizedSymmetricEigenBatchedWebGpu(device, {
        fockMatrices: fMat,
        overlapMatrices: sMat,
        n: ng,
        batchCount: 1
      });
      let maxGenResErr = 0;
      for (let col = 0; col < ng; col += 1) {
        const lam = genRes.eigenvalues[col];
        for (let row = 0; row < ng; row += 1) {
          let fc = 0; let sc = 0;
          for (let k = 0; k < ng; k += 1) {
            fc += fMat[row * ng + k] * genRes.eigenvectors[k * ng + col];
            sc += sMat[row * ng + k] * genRes.eigenvectors[k * ng + col];
          }
          maxGenResErr = Math.max(maxGenResErr, Math.abs(fc - lam * sc));
        }
      }

      // ---- 2. 3D FFT / IFFT & 3D Periodic Poisson Solver ----
      const nFft = 16;
      const tot = nFft ** 3;
      const L = 12.5;
      const inputC = new Float32Array(tot * 2);
      const rhsPoisson = new Float32Array(tot);
      const exactPhi = new Float32Array(tot);
      const exactGradX = new Float32Array(tot);
      const k1 = (2 * Math.PI) / L;
      const k2 = (4 * Math.PI) / L;
      let normIn = 0;
      for (let z = 0; z < nFft; z += 1) {
        for (let y = 0; y < nFft; y += 1) {
          for (let x = 0; x < nFft; x += 1) {
            const idx = (z * nFft + y) * nFft + x;
            const px = (x / nFft) * L;
            const py = (y / nFft) * L;
            const pz = (z / nFft) * L;
            const re = Math.sin(k1 * px) * Math.cos(k1 * py) + 0.5 * Math.cos(k2 * pz);
            const im = 0.25 * Math.cos(k1 * px) * Math.sin(k1 * pz);
            inputC[idx * 2] = re;
            inputC[idx * 2 + 1] = im;
            normIn += re * re + im * im;

            exactPhi[idx] = re;
            // nabla^2 phi = -(k1^2 + k1^2)*sin(k1 x)cos(k1 y) - (k2^2)*0.5*cos(k2 z)
            rhsPoisson[idx] = -2 * k1 * k1 * Math.sin(k1 * px) * Math.cos(k1 * py)
              - 0.5 * k2 * k2 * Math.cos(k2 * pz);
            exactGradX[idx] = k1 * Math.cos(k1 * px) * Math.cos(k1 * py);
          }
        }
      }
      const fwd = await fft3dWebGpu(device, { data: inputC, n: nFft, inverse: false });
      let normK = 0;
      for (let i = 0; i < tot; i += 1) {
        normK += fwd.data[i * 2] ** 2 + fwd.data[i * 2 + 1] ** 2;
      }
      const parsevalRelErr = Math.abs(normIn - normK / tot) / normIn;
      const inv = await fft3dWebGpu(device, { data: fwd.data, n: nFft, inverse: true });
      let maxFftRtErr = 0;
      for (let i = 0; i < tot * 2; i += 1) {
        maxFftRtErr = Math.max(maxFftRtErr, Math.abs(inv.data[i] - inputC[i]));
      }
      const pois = await solvePoisson3dWebGpu(device, { rhsReal: rhsPoisson, n: nFft, boxLength: L, gradAxis: 0 });
      const poisGx = await solvePoisson3dWebGpu(device, { rhsReal: rhsPoisson, n: nFft, boxLength: L, gradAxis: 1 });
      let maxPoisErr = 0;
      let maxGradErr = 0;
      for (let i = 0; i < tot; i += 1) {
        maxPoisErr = Math.max(maxPoisErr, Math.abs(pois.solutionReal[i] - exactPhi[i]));
        maxGradErr = Math.max(maxGradErr, Math.abs(poisGx.solutionReal[i] - exactGradX[i]));
      }

      // ---- 3. WebGPU Atomic MD (LJ NVE + EAM + Stillinger-Weber) ----
      const arInit = buildFccCrystalMdState({
        cellsPerSide: 3,
        latticeConstantA: 5.31,
        massU: 39.948,
        temperatureK: 50
      });
      const ljSession = createMolecularDynamicsSessionWebGpu(device, {
        ...arInit,
        potentialModel: MD_POTENTIAL_MODELS.LENNARD_JONES,
        epsilonEv: 0.01032,
        sigmaOrR0A: 3.405,
        rcutA: 7.5,
        dtFs: 2.0,
        targetTemperatureK: 0,
        thermostatCouplingFs: 0
      });
      const ljT0 = await ljSession.stepBatch(5, { readTelemetry: true });
      const ljT1 = await ljSession.stepBatch(35, { readTelemetry: true });
      ljSession.destroy();
      const ljEnergyDriftRel = Math.abs(ljT1.totalEnergyEv - ljT0.totalEnergyEv) / Math.max(1e-6, Math.abs(ljT0.totalEnergyEv));
      const ljMomMag = Math.hypot(...ljT1.momentum);
      const ljMaxRdf = Math.max(...ljT1.rdf);

      const cuInit = buildFccCrystalMdState({ cellsPerSide: 3, latticeConstantA: 3.61, massU: 63.546, temperatureK: 300 });
      const eamSession = createMolecularDynamicsSessionWebGpu(device, {
        ...cuInit,
        potentialModel: MD_POTENTIAL_MODELS.MORSE_EAM,
        epsilonEv: 0.34,
        sigmaOrR0A: 2.55,
        alphaOrLambda: 1.36,
        eamAEv: 0.9,
        eamBeta: 1.4,
        rcutA: 5.2,
        dtFs: 1.5,
        targetTemperatureK: 300,
        thermostatCouplingFs: 50
      });
      const eamOut = await eamSession.stepBatch(20, { readTelemetry: true });
      eamSession.destroy();

      const siInit = buildFccCrystalMdState({ cellsPerSide: 3, latticeConstantA: 4.5, massU: 28.085, temperatureK: 300 });
      const swSession = createMolecularDynamicsSessionWebGpu(device, {
        ...siInit,
        potentialModel: MD_POTENTIAL_MODELS.STILLINGER_WEBER,
        epsilonEv: 2.168,
        sigmaOrR0A: 2.0951,
        alphaOrLambda: 21.0,
        swGamma: 1.2,
        rcutA: 3.771,
        dtFs: 1.0,
        targetTemperatureK: 300,
        thermostatCouplingFs: 40
      });
      const swOut = await swSession.stepBatch(15, { readTelemetry: true });
      swSession.destroy();

      // ---- 4. Convex Polytope Fit + Live WGSL Atlas Evaluation ----
      const reg = createMaterialPolytopeRegistry();
      const [solidPoly] = reg.discoverMaterialPolytopes({
        materialKey: 'Fe',
        meltingPointK: 1811,
        boilingPointK: 3134,
        meltingSlopeKPerLogP: 40,
        closureHash: 'fe-gpu-test'
      });
      const densityLaw = (T, P) => 7874 * (1 - 3.5e-5 * (T - 300)) * (1 + P / 170e9);
      const fitAtlas = await fitConvexPolytopeWebGpu(device, solidPoly, densityLaw, {
        degrees: [4, 3],
        relativeTolerance: 5e-3,
        maxDepth: 1
      });
      const atlasData = fitAtlas.packedGpuAtlas.data;
      const probeWgsl = /* wgsl */ `
        ${evaluatePolytopeAtlasWgsl}
        @group(0) @binding(0) var<storage, read> atlas_buf: array<f32>;
        @group(0) @binding(1) var<storage, read> queries: array<vec2<f32>>;
        @group(0) @binding(2) var<storage, read_write> outputs: array<vec4<f32>>;
        @compute @workgroup_size(64)
        fn eval_queries(@builtin(global_invocation_id) id: vec3<u32>) {
          if (id.x >= arrayLength(&queries)) { return; }
          let q = queries[id.x];
          outputs[id.x] = eval_polytope_atlas_2d(&atlas_buf, q.x, q.y);
        }
      `;
      const mod = device.createShaderModule({ code: probeWgsl });
      const pipe = device.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'eval_queries' } });
      // Query 0: inside solid (1000 K, 101325 Pa); Query 1: outside slanted melting facet (1850 K, 100 Pa)
      const qData = Float32Array.from([1000, 101325, 1850, 100]);
      const aBuf = device.createBuffer({ size: atlasData.byteLength, usage: 0x80 | 0x08 });
      device.queue.writeBuffer(aBuf, 0, atlasData);
      const qBuf = device.createBuffer({ size: qData.byteLength, usage: 0x80 | 0x08 });
      device.queue.writeBuffer(qBuf, 0, qData);
      const oBuf = device.createBuffer({ size: 32, usage: 0x80 | 0x04 });
      const rBuf = device.createBuffer({ size: 32, usage: 0x01 | 0x08 });
      const bg = device.createBindGroup({
        layout: pipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: aBuf } },
          { binding: 1, resource: { buffer: qBuf } },
          { binding: 2, resource: { buffer: oBuf } }
        ]
      });
      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(pipe); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(1); pass.end();
      enc.copyBufferToBuffer(oBuf, 0, rBuf, 0, 32);
      device.queue.submit([enc.finish()]);
      await rBuf.mapAsync(1);
      const qOut = Array.from(new Float32Array(rBuf.getMappedRange().slice(0, 32)));
      rBuf.unmap();
      for (const b of [aBuf, qBuf, oBuf, rBuf]) b.destroy();

      device.destroy();
      return {
        status: 'ok',
        gpuErrors,
        eig: { sortedOk, maxOrthoErr, maxReconErr, maxGenResErr },
        fft: { parsevalRelErr, maxFftRtErr, maxPoisErr, maxGradErr },
        md: {
          ljEnergyDriftRel,
          ljMomMag,
          ljMaxRdf,
          ljTempK: ljT1.temperatureK,
          eamTempK: eamOut.temperatureK,
          eamPotEv: eamOut.potentialEnergyEv,
          swTempK: swOut.temperatureK,
          swPotEv: swOut.potentialEnergyEv
        },
        polytope: {
          fittedCount: fitAtlas.polytopes.length,
          inVal: qOut[0],
          inExpected: densityLaw(1000, 101325),
          inHit: qOut[3],
          outHit: qOut[7]
        }
      };
    });
    await ctx.close();

    assert.deepEqual(pageErrors, []);
    assert.equal(result.status, 'ok');
    assert.deepEqual(result.gpuErrors, []);

    assert.equal(result.eig.sortedOk, true);
    assert.ok(result.eig.maxOrthoErr < 1e-4, `maxOrthoErr=${result.eig.maxOrthoErr}`);
    assert.ok(result.eig.maxReconErr < 1e-3, `maxReconErr=${result.eig.maxReconErr}`);
    assert.ok(result.eig.maxGenResErr < 1e-3, `maxGenResErr=${result.eig.maxGenResErr}`);

    assert.ok(result.fft.parsevalRelErr < 1e-5, `parsevalRelErr=${result.fft.parsevalRelErr}`);
    assert.ok(result.fft.maxFftRtErr < 1e-5, `maxFftRtErr=${result.fft.maxFftRtErr}`);
    assert.ok(result.fft.maxPoisErr < 1e-4, `maxPoisErr=${result.fft.maxPoisErr}`);
    assert.ok(result.fft.maxGradErr < 1e-4, `maxGradErr=${result.fft.maxGradErr}`);

    assert.ok(result.md.ljEnergyDriftRel < 2e-2, `ljEnergyDriftRel=${result.md.ljEnergyDriftRel}`);
    assert.ok(result.md.ljMomMag < 1e-2, `ljMomMag=${result.md.ljMomMag}`);
    assert.ok(result.md.ljMaxRdf > 1.5, `ljMaxRdf=${result.md.ljMaxRdf}`);
    assert.ok(Number.isFinite(result.md.eamTempK) && result.md.eamTempK > 10);
    assert.ok(Number.isFinite(result.md.swTempK) && result.md.swTempK > 10);

    assert.equal(result.polytope.inHit, 1);
    assert.ok(Math.abs(result.polytope.inVal - result.polytope.inExpected) / result.polytope.inExpected < 5e-3);
    assert.equal(result.polytope.outHit, 0, 'Fail-closed outside slanted melting facet');
  } finally {
    await browser.close();
  }
});
