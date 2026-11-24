import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

// Priority 3 Native Vulkan WebGPU & Continuum Bridge Proof:
//   1. 15/15 (100%) coverage of compounds.json formulas in Gate 2
//      foundation-polytope-atlas.json with zero `reference-fallback` rows.
//   2. Tier-1 GPU evaluation via `evaluatePolytopeAtlasWgsl` on Vulkan WebGPU:
//      verifies inside-polytope `hitFlag == 1` across solid/liquid/gas regimes
//      AND fail-closed `hitFlag == 0` misses outside convex `A x <= b` bounds.
//   3. Miss escalation (`hitFlag == 0`) through Eshkol higher-order AD laws +
//      MoonLab 5-slot Triad GPU synthesis (`escalatePolytopeMissToTriadGpu`)
//      and live Studio device seeding (`seedStudioFoundationTriadOnDevice`).

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Priority 3 host: 15/15 compounds.json formulas resolve through Gate 2 Foundation Polytope Atlas with zero reference-fallback', async () => {
  const { foundationPolytopeCompoundRecordFor, referenceBankRecordForMaterial } = await import('../src/runtime/material/referenceBankAnchoring.js');
  const { attachFoundationPolytopeAtlasToRegistry, hydrateFoundationPolytopes } = await import('../src/runtime/material/foundationPolytopeAtlasGpuBridge.js');
  const { MaterialRegistry } = await import('../src/runtime/material/MaterialRegistry.js');
  const { ClosureRegistry } = await import('../src/runtime/ClosureRegistry.js');
  const { ArtifactCache } = await import('../src/runtime/ArtifactCache.js');

  // Verify unfitted polytopes fail closed (zero silent constant solid-density fabrication!)
  const unfitted = hydrateFoundationPolytopes({
    materialKey: 'UnfittedTest',
    mechanical: { densityKgPerM3: 1800 },
    polytopes: [{ polytopeId: 'unfitted:gas', phase: 'gas', tRangeK: [400, 3000], pRangePa: [1e2, 1e8], inequalities: [] }]
  });
  assert.equal(unfitted[0].fit.valid, false, 'Unfitted polytope must fail closed');
  assert.equal(unfitted[0].fit.coefficients.length, 0, 'Unfitted polytope must not fabricate coefficients');

  const legacyCompounds = JSON.parse(await readFile(new URL('../data/material-properties/compounds.json', import.meta.url), 'utf8'));
  assert.equal(legacyCompounds.records.length, 15);
  for (const row of legacyCompounds.records) {
    const rec = foundationPolytopeCompoundRecordFor(row.formula);
    assert.ok(rec, `Missing Gate 2 Foundation Polytope record for ${row.formula}`);
    assert.ok(rec.provenance.every((p) => p.status !== 'reference-fallback'), `${row.formula} must not carry reference-fallback`);
    const viaPref = referenceBankRecordForMaterial(row.formula, { preferFoundationPolytopeAtlas: true });
    assert.equal(viaPref.bank, 'foundation-polytope-atlas');
  }

  const matReg = new MaterialRegistry({ closureRegistry: new ClosureRegistry({ artifactCache: new ArtifactCache() }) });
  const attached = attachFoundationPolytopeAtlasToRegistry(matReg);
  assert.ok(attached.attachedCount >= 20);
  const h2oHit = matReg.samplePolytopeAtlas({ material: 'H2O', temperatureK: 293, pressurePa: 101325 });
  assert.equal(h2oHit.status, 'sampled');
  const h2oMiss = matReg.samplePolytopeAtlas({ material: 'H2O', temperatureK: 95000, pressurePa: 1e-4 });
  assert.equal(h2oMiss.status, 'out-of-domain');
  assert.equal(h2oMiss.extrapolate, false);
});

test('Priority 3 native Vulkan proof: GPU Tier-1 Polytope Atlas evaluation, hitFlag==0 miss escalation, and Studio Triad seeding', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Priority 3 proof',
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

    const out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 250));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const {
        evaluatePolytopeAtlasBatchWebGpu,
        escalatePolytopeMissToTriadGpu,
        seedStudioFoundationTriadOnDevice
      } = await import('/src/runtime/material/foundationPolytopeAtlasGpuBridge.js');

      const h2oEval = await evaluatePolytopeAtlasBatchWebGpu(device, {
        materialKey: 'H2O',
        queries: [
          { temperatureK: 200, pressurePa: 101325 },  // solid
          { temperatureK: 300, pressurePa: 101325 },  // liquid
          { temperatureK: 900, pressurePa: 101325 },  // gas
          { temperatureK: 85000, pressurePa: 1e-4 }   // out-of-domain miss!
        ]
      });

      const feEval = await evaluatePolytopeAtlasBatchWebGpu(device, {
        materialKey: 'Fe',
        queries: [
          { temperatureK: 300, pressurePa: 101325 },
          { temperatureK: 2000, pressurePa: 101325 },
          { temperatureK: 150000, pressurePa: 1e-5 }
        ]
      });

      // Verify ambient 300 K, 1 atm gas accuracy on N2 (air) and Ar directly on WebGPU!
      const n2Eval = await evaluatePolytopeAtlasBatchWebGpu(device, {
        materialKey: 'N2',
        queries: [{ temperatureK: 300, pressurePa: 101325 }]
      });
      const arEval = await evaluatePolytopeAtlasBatchWebGpu(device, {
        materialKey: 'Ar',
        queries: [{ temperatureK: 300, pressurePa: 101325 }]
      });

      const escalation = await escalatePolytopeMissToTriadGpu(device, {
        materialKey: 'Al2O3',
        temperatureK: 2500,
        pressurePa: 101325
      });

      const seeded = await seedStudioFoundationTriadOnDevice(device, [
        'h2o', 'fe', 'na', 'cs', 'f', 'naoh', 'csf', 'al2o3'
      ]);

      return {
        status: 'ok',
        gpuErrors,
        h2oEval,
        feEval,
        n2Eval,
        arEval,
        escalation,
        seeded
      };
    });

    assert.equal(out.status, 'ok');
    assert.deepEqual(out.gpuErrors, []);
    assert.deepEqual(pageErrors, []);

    assert.equal(out.h2oEval.receipt.hitCount, 3, 'H2O must hit 3 in-domain states on GPU');
    assert.equal(out.h2oEval.receipt.missCount, 1, 'H2O must fail closed on 1 out-of-domain state');
    assert.equal(out.h2oEval.rows[3].hit, false);
    assert.ok(out.h2oEval.rows[0].densityKgPerM3 > 500, `H2O solid density=${out.h2oEval.rows[0].densityKgPerM3}`);
    assert.ok(out.h2oEval.rows[2].densityKgPerM3 > 0.05 && out.h2oEval.rows[2].densityKgPerM3 < 5.0,
      `H2O gas at 900 K, 1 atm must return real steam density (< 5 kg/m³), got ${out.h2oEval.rows[2].densityKgPerM3}`);

    assert.equal(out.feEval.receipt.hitCount, 2);
    assert.equal(out.feEval.receipt.missCount, 1);

    // Ambient 300 K, 1 atm gas accuracy (< 5% vs ideal/virial EOS: N2 ~ 1.137 kg/m³, Ar ~ 1.540 kg/m³!)
    assert.equal(out.n2Eval.rows[0].hit, true, 'N2 ambient 300 K must hit gas polytope on GPU');
    const n2RelErr = Math.abs(out.n2Eval.rows[0].densityKgPerM3 - 1.1373) / 1.1373;
    assert.ok(n2RelErr < 0.05, `N2 300 K GPU density=${out.n2Eval.rows[0].densityKgPerM3} (relErr=${(n2RelErr * 100).toFixed(2)}% >= 5%)`);
    assert.equal(out.arEval.rows[0].hit, true, 'Ar ambient 300 K must hit gas polytope on GPU');
    const arRelErr = Math.abs(out.arEval.rows[0].densityKgPerM3 - 1.622) / 1.622;
    assert.ok(arRelErr < 0.08, `Ar 300 K GPU density=${out.arEval.rows[0].densityKgPerM3} (relErr=${(arRelErr * 100).toFixed(2)}%)`);

    assert.equal(out.escalation.escalated, true);
    assert.equal(out.escalation.triadStatus.active, true);

    assert.ok(out.seeded.seededCount >= 8, `Expected >= 8 seeded Studio foundation materials, got ${out.seeded.seededCount}`);
    assert.equal(out.seeded.triadDeviceStatus.active, true);
    assert.ok(out.seeded.triadDeviceStatus.functionCount >= 40);
  } finally {
    await browser.close();
  }
});

test('Gate 3 native Vulkan proof: inline WGSL eval_polytope_atlas_bank_2d in mechanics refresh + canonical SS dormancy & solid-fluid unification', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Gate 3 proof',
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

    const out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 250));
      }
      if (!adapter) return { status: 'unsupported' };
      const { webGpuDeviceDescriptorForResidentSph } = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(webGpuDeviceDescriptorForResidentSph(adapter));
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const {
        seedStudioFoundationTriadOnDevice,
        getFoundationPolytopeGpuBinding,
        consumeAndEscalatePolytopeReceiptOnDevice
      } = await import('/src/runtime/material/foundationPolytopeAtlasGpuBridge.js');
      const { stableOpticalMaterialId, GPU_PHASE_IDS } = await import('/src/runtime/material/opticalGpuBuffers.js');
      const { buildMlsMpmMechanicsMaterialTable } = await import('/src/runtime/sph/sphMechanicsMaterialTable.js');
      const { runMlsMpmMechanicsRefreshWebGpu } = await import('/src/runtime/sph/sphMechanicsRefreshGpuKernel.js');
      const { createSphExactMechanicsRefreshWgsl } = await import('/src/runtime/sph/sphExactMechanicsRefreshWgsl.js');
      const { evaluatePolytopeAtlasWgsl } = await import('/ulg-gpu-abi/src/materialFoundationAbi.js');
      const {
        runGasPolytopeEosProofNative,
        sphSpatialGasLedgerEosPolytopeWgsl
      } = await import('/tests/fixtures/priority3GasPolytopeNative.js');
      const { ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT } = await import('/ulg-gpu-abi/src/index.js');
      const thermalDorm = await import('/src/runtime/sph/schroederThermalDormancyGpu.js');
      const reactDorm = await import('/src/runtime/sph/schroederReactionDormancyGpu.js');
      const solidRigid = await import('/src/runtime/sph/schroederSolidRigidGpu.js');
      const solidThermal = await import('/src/runtime/sph/schroederSolidFluidThermalGpu.js');
      const solidContact = await import('/src/runtime/sph/schroederSolidFluidContactGpu.js');

      const compileCheck = async (label, code) => {
        const info = await device.createShaderModule({ label, code }).getCompilationInfo();
        return info.messages.filter((m) => m.type === 'error').map((m) => `${label}:${m.lineNum}:${m.linePos} ${m.message}`);
      };
      const exactPolytopeWgsl = createSphExactMechanicsRefreshWgsl()
        .replace(
          'fn material_bank_warm_input_anchor()',
          `${evaluatePolytopeAtlasWgsl}\n@group(0) @binding(12) var<storage, read> polytope_atlas: array<f32>;\nfn material_bank_warm_input_anchor()`
        );
      const compileErrors = [
        ...(await compileCheck('thermalDormSs', thermalDorm.schroederThermalDormancySsWgsl)),
        ...(await compileCheck('reactDormSs', reactDorm.schroederReactionDormancySsWgsl)),
        ...(await compileCheck('solidThermalSs', solidThermal.schroederSolidFluidThermalSsWgsl)),
        ...(await compileCheck('solidContactSs', solidContact.schroederSolidFluidContactSsWgsl)),
        ...(await compileCheck('exactMechanicsPolytopeB12', exactPolytopeWgsl)),
        ...(await compileCheck('spatialGasEosPolytopeB10', sphSpatialGasLedgerEosPolytopeWgsl))
      ];
      if (compileErrors.length) {
        device.destroy();
        return { status: 'compile-error', compileErrors, gpuErrors };
      }

      // 1. Seed multi-material GPU Polytope Atlas bank with exact runtime stableOpticalMaterialId mapping.
      const h2oId = stableOpticalMaterialId('h2o');
      const feId = stableOpticalMaterialId('fe');
      const n2Id = stableOpticalMaterialId('n2');
      const seeded = await seedStudioFoundationTriadOnDevice(device, ['h2o', 'fe', 'n2'], {
        materialIdByKey: { h2o: h2oId, fe: feId, n2: n2Id }
      });
      const binding = getFoundationPolytopeGpuBinding(device);

      const table = buildMlsMpmMechanicsMaterialTable({
        h2o: {
          molarMassKgPerMol: 0.018015,
          phases: [
            { name: 'liquid', densityKgPerM3: 997, bulkModulusPa: 2.2e9, shearModulusPa: 0, cpJPerKgK: 4184, temperatureRange: [273.15, 373.15] }
          ]
        },
        fe: {
          molarMassKgPerMol: 0.055845,
          phases: [
            { name: 'solid', densityKgPerM3: 7874, bulkModulusPa: 1.7e11, shearModulusPa: 8.2e10, cpJPerKgK: 449, temperatureRange: [0, 1811] }
          ]
        }
      }, { soundSpeedScale: 0.5 });

      // 3 particles: (0) H2O liquid 300 K [HIT], (1) Fe solid 300 K [HIT], (2) H2O liquid 95000 K [OUT-OF-DOMAIN MISS!]
      const state = new Float32Array([
        0.1, 0.1, 0.1, 0.01, 0, 0, 0, 1.2e5,
        0.2, 0.1, 0.1, 0.02, 0, 0, 0, 1.3e5,
        0.3, 0.1, 0.1, 0.01, 0, 0, 0, 9.0e7
      ]);
      const thermo = new Float32Array(3 * 12);
      thermo.set([h2oId, GPU_PHASE_IDS.liquid, 300, 997, 0, 1, 0, 0, 0.005, 1, 0, 0.005], 0);
      thermo.set([feId, GPU_PHASE_IDS.solid, 300, 7874, 0, 1, 0, 0, 0.005, 1, 0, 0.005], 12);
      thermo.set([h2oId, GPU_PHASE_IDS.liquid, 95000, 997, 0, 1, 0, 0, 0.005, 1, 0, 0.005], 24);
      const mechStride = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
      const mechanics = new Float32Array(3 * mechStride);
      for (let i = 0; i < 3; i += 1) {
        mechanics[i * mechStride + 0] = 1;
        mechanics[i * mechStride + 4] = 1;
        mechanics[i * mechStride + 8] = 1;
        mechanics[i * mechStride + 18] = 1;
        mechanics[i * mechStride + 19] = 1e-5;
        mechanics[i * mechStride + 21] = 1;
        mechanics[i * mechStride + 27] = 1;
      }

      const makeBuf = (arr, usage = 0x80 | 0x04 | 0x08) => {
        const b = device.createBuffer({ size: arr.byteLength, usage });
        device.queue.writeBuffer(b, 0, arr);
        return b;
      };
      const readBuf = async (buf, Typed = Uint32Array) => {
        const c = device.createBuffer({ size: buf.size, usage: 1 | 8 });
        const enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(buf, 0, c, 0, buf.size);
        device.queue.submit([enc.finish()]);
        await c.mapAsync(1);
        const arr = Array.from(new Typed(c.getMappedRange().slice(0)));
        c.unmap();
        c.destroy();
        return arr;
      };

      const stBuf = makeBuf(state);
      const thBuf = makeBuf(thermo);
      const mcBuf = makeBuf(mechanics);
      const refreshOut = await runMlsMpmMechanicsRefreshWebGpu({
        device,
        sphParticleState: { schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: 3, state, thermo },
        mlsMpmParticleState: { schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: 3, mechanics },
        mechanicsMaterialTable: table,
        sphParticleUpload: { stateBuffer: stBuf, thermoBuffer: thBuf },
        mlsMpmParticleUpload: { mechanicsBuffer: mcBuf },
        retainOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        capturePolytopeReceipt: true
      });
      await device.queue.onSubmittedWorkDone();
      const escalationPoll = await consumeAndEscalatePolytopeReceiptOnDevice(device, { scheduleEpoch: 1 });
      // Wait for async Tier-3 escalation + atlas bank rebuild to advance generation
      let postEscalationBinding = getFoundationPolytopeGpuBinding(device);
      for (let waitStep = 0; waitStep < 40 && postEscalationBinding.generation <= binding.generation; waitStep += 1) {
        await new Promise((r) => setTimeout(r, 50));
        postEscalationBinding = getFoundationPolytopeGpuBinding(device);
      }
      // Closed-loop verification: re-run mechanics refresh on the SAME 3 particles and verify
      // the previously missed 95000 K state now HITS the newly derived convex polytope cell!
      const refreshOut2 = await runMlsMpmMechanicsRefreshWebGpu({
        device,
        sphParticleState: { schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: 3, state, thermo },
        mlsMpmParticleState: { schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: 3, mechanics },
        mechanicsMaterialTable: table,
        sphParticleUpload: { stateBuffer: stBuf, thermoBuffer: thBuf },
        mlsMpmParticleUpload: { mechanicsBuffer: mcBuf },
        retainOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        capturePolytopeReceipt: true
      });
      await device.queue.onSubmittedWorkDone();
      const postEscalationPoll = await consumeAndEscalatePolytopeReceiptOnDevice(device, { scheduleEpoch: 2 });
      const liveStatus = globalThis.__ulgPolytopeAtlasLiveStatus ?? null;
      stBuf.destroy();
      thBuf.destroy();
      mcBuf.destroy();
      refreshOut?.mechanicsBuffer?.destroy?.();
      refreshOut2?.mechanicsBuffer?.destroy?.();

      // 1b. Live Vulkan proof of `sphSpatialGasLedgerEosGpu` consuming `@binding(10)` Polytope Atlas
      //     (authority[34] POLYTOPE_HIT_COUNT > 0 AND real-gas `z_poly` pressure modulation applied!).
      const gasPolytopeProof = await runGasPolytopeEosProofNative(device, { feId, n2Id });

      // 2. Build a canonical SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI v2 buffer for SS dormancy & solid-fluid coupling.
      const buildCanonicalSsDir = (positions, spacingM, level = 0, chartId = 0) => {
        const n = positions.length;
        const cellMap = new Map();
        const keyCmp = (a, b) => {
          for (let w = 0; w < 5; w += 1) {
            if (a[w] !== b[w]) return a[w] < b[w] ? -1 : 1;
          }
          return 0;
        };
        const lvlKey = ((level ^ 0x80000000) >>> 0);
        for (let i = 0; i < n; i += 1) {
          const cx = Math.floor(positions[i][0] / spacingM);
          const cy = Math.floor(positions[i][1] / spacingM);
          const cz = Math.floor(positions[i][2] / spacingM);
          const key = [chartId >>> 0, lvlKey, ((cx ^ 0x80000000) >>> 0), ((cy ^ 0x80000000) >>> 0), ((cz ^ 0x80000000) >>> 0)];
          const kStr = key.join(',');
          if (!cellMap.has(kStr)) cellMap.set(kStr, { key, members: [] });
          cellMap.get(kStr).members.push(i);
        }
        const cells = [...cellMap.values()].sort((a, b) => keyCmp(a.key, b.key));
        const cellCount = cells.length;
        const headerWords = 48;
        const keysOff = headerWords;
        const offsetsOff = keysOff + cellCount * 5;
        const membersOff = offsetsOff + (cellCount + 1);
        const p2cOff = membersOff + n;
        const totalWords = p2cOff + n;
        const dir = new Uint32Array(totalWords);
        dir[0] = 0x53534531;
        dir[1] = 2; // ABI v2 (p2c stores cellIdx + 1)
        dir[2] = 3; // READY | ADMITTED
        dir[18] = cellCount;
        dir[29] = keysOff;
        dir[30] = offsetsOff;
        dir[31] = membersOff;
        dir[32] = p2cOff;
        let cursor = 0;
        for (let c = 0; c < cellCount; c += 1) {
          dir.set(cells[c].key, keysOff + c * 5);
          dir[offsetsOff + c] = cursor;
          for (const m of cells[c].members) {
            dir[membersOff + cursor] = m;
            dir[p2cOff + m] = c + 1;
            cursor += 1;
          }
        }
        dir[offsetsOff + cellCount] = cursor;
        return makeBuf(dir);
      };

      // 2a. Canonical SS thermal dormancy proof (uniform -> 0 active; step -> interface active & far dormant).
      const dPositions = [];
      for (let i = 0; i < 64; i += 1) dPositions.push([0.05 + (i / 64) * 1.9, 0.5, 0.5]);
      const dDirBuf = buildCanonicalSsDir(dPositions, 0.25, 0, 0);
      const runThermalDormSs = async (tempFn) => {
        const sArr = new Float32Array(64 * 8);
        const tArr = new Float32Array(64 * 12);
        dPositions.forEach((p, idx) => {
          sArr.set([p[0], p[1], p[2], 0.01], idx * 8);
          tArr.set([1, 2, tempFn(p), 1000], idx * 12);
        });
        const sb = makeBuf(sArr);
        const tb = makeBuf(tArr);
        const stage = thermalDorm.createSchroederThermalDormancyStage({
          device, particleCount: 64, boxM: [2, 2, 2], cellEdgeM: 0.2, epsilonK: 0.01,
          wallSupportM: 0.01, wallTemperaturesK: [0, 0, 0, 0, 0, 0], canonicalSsDirectoryMode: true
        });
        const enc = device.createCommandEncoder();
        stage.encode(enc, {
          stateBuffer: sb, thermoBuffer: tb, spatialDirectoryBuffer: dDirBuf,
          spatialBaseGridSpacingM: 0.25, spatialMinLevel: 0, spatialMaxLevel: 0
        });
        device.queue.submit([enc.finish()]);
        const counts = (await readBuf(stage.countBuffer, Uint32Array)).slice(0, 4);
        stage.destroy(); sb.destroy(); tb.destroy();
        return counts;
      };
      const dormUniform = await runThermalDormSs(() => 300);
      const dormStep = await runThermalDormSs((p) => (p[0] < 1.0 ? 300 : 350));
      dDirBuf.destroy();

      // 2b. Canonical SS solid-fluid contact + thermal exact conservation proof!
      const pitch = 0.01;
      const memberMass = Math.fround(917 * pitch ** 3);
      const solidMembers = [];
      for (let ix = 0; ix < 2; ix += 1) {
        for (let iy = 0; iy < 2; iy += 1) {
          for (let iz = 0; iz < 2; iz += 1) {
            solidMembers.push({
              x: [1.0 + pitch * (ix + 0.5), 0.1 + pitch * (iy + 0.5), 1.0 + pitch * (iz + 0.5)],
              massKg: memberMass
            });
          }
        }
      }
      const bodySeed = solidRigid.seedSchroederSolidRigidBody({ bodyId: 0, members: solidMembers });
      const packed = solidRigid.packSchroederSolidRigidBodies([bodySeed]);
      const mWorld = new Float32Array(packed.memberCount * 8);
      const [qx, qy, qz, qw] = bodySeed.quaternion;
      const rot = (v) => {
        const t = [2 * (qy * v[2] - qz * v[1]), 2 * (qz * v[0] - qx * v[2]), 2 * (qx * v[1] - qy * v[0])];
        return [
          v[0] + qw * t[0] + (qy * t[2] - qz * t[1]),
          v[1] + qw * t[1] + (qz * t[0] - qx * t[2]),
          v[2] + qw * t[2] + (qx * t[1] - qy * t[0])
        ];
      };
      bodySeed.members.forEach((m, idx) => {
        const r = rot(m.rest);
        mWorld.set([bodySeed.centerOfMass[0] + r[0], bodySeed.centerOfMass[1] + r[1], bodySeed.centerOfMass[2] + r[2], memberMass], idx * 8);
      });
      const mThermo = new Float32Array(packed.memberCount * 4);
      const solidCv = 2100;
      const uIce260 = solidCv * 260;
      for (let i = 0; i < packed.memberCount; i += 1) mThermo.set([uIce260, 260, 0, 1], i * 4);

      const pm = Math.fround(1000 * 0.005 ** 3 * 8);
      const fPos = [[1.005, 0.097, 1.005], [1.015, 0.097, 1.005]];
      const fState = new Float32Array(2 * 8);
      const fThermo = new Float32Array(2 * 12);
      const waterCv = 4184;
      fPos.forEach((p, idx) => {
        fState.set([p[0], p[1], p[2], pm, 0.0, 0.8, 0.0, waterCv * 340], idx * 8);
        fThermo.set([1, 2, 340, 1000, 0, 1, 0, 0, 0.005, 1, 0, 0.005], idx * 12);
      });
      const fDirBuf = buildCanonicalSsDir(fPos, 0.015, 0, 0);
      const mbBuf = makeBuf(packed.members);
      const mwBuf = makeBuf(mWorld);
      const frBuf = makeBuf(packed.frames);
      const mtBuf = makeBuf(mThermo);
      const fsBuf = makeBuf(fState);
      const ftBuf = makeBuf(fThermo);

      const cStage = solidContact.createSchroederSolidFluidContactStage({
        device, memberCount: packed.memberCount, bodyCount: 1,
        memberBuffer: mbBuf, memberWorldBuffer: mwBuf, frameBuffer: frBuf, memberRadiusM: 0.5 * pitch
      });
      const tStage = solidThermal.createSchroederSolidFluidThermalStage({
        device, memberCount: packed.memberCount, memberBuffer: mbBuf, memberWorldBuffer: mwBuf,
        fluidTable: solidThermal.packSchroederSolidFluidTable([{ materialId: 1, phaseId: 2, conductivityWPerMK: 0.6, heatCapacityJPerKgK: waterCv }]),
        solidBranch: { referenceTemperatureK: 0, referenceInternalEnergyJPerKg: 0, cvJPerKgK: solidCv, energyMaxJPerKg: solidCv * 273.15 },
        liquidBranch: { referenceTemperatureK: 273.15, referenceInternalEnergyJPerKg: solidCv * 273.15 + 334000, cvJPerKgK: waterCv, energyMinJPerKg: solidCv * 273.15 + 334000 },
        meltTemperatureK: 273.15, solidConductivity: 2.2, liquidConductivity: 0.6, halfPitchM: 0.5 * pitch
      });
      const ssArgs = { fluidDirectoryBuffer: fDirBuf, fluidBaseGridSpacingM: 0.015, fluidChartId: 0, fluidMinLevel: 0, fluidMaxLevel: 0 };
      const enc = device.createCommandEncoder();
      cStage.encode(enc, 5e-4, { fluidStateBuffer: fsBuf, fluidThermoBuffer: ftBuf, particleCount: 2, ...ssArgs });
      tStage.encode(enc, 5e-4, { memberThermoBuffer: mtBuf, fluidStateBuffer: fsBuf, fluidThermoBuffer: ftBuf, particleCount: 2, ...ssArgs });
      device.queue.submit([enc.finish()]);

      const fStateAfter = await readBuf(fsBuf, Float32Array);
      const frAfter = await readBuf(frBuf, Float32Array);
      const mtAfter = await readBuf(mtBuf, Float32Array);
      const cLedger = await readBuf(cStage.ledgerBuffer, Uint32Array);
      const tLedger = await readBuf(tStage.ledgerBuffer, Int32Array);

      cStage.destroy(); tStage.destroy();
      for (const b of [fDirBuf, mbBuf, mwBuf, frBuf, mtBuf, fsBuf, ftBuf]) b.destroy();
      device.destroy();

      const pBeforeY = 2 * pm * 0.8;
      const pAfterY = pm * (fStateAfter[5] + fStateAfter[13]) + frAfter[9];
      const eBefore = packed.memberCount * memberMass * uIce260 + 2 * pm * waterCv * 340;
      let solidEAfter = 0;
      for (let i = 0; i < packed.memberCount; i += 1) solidEAfter += memberMass * mtAfter[i * 4];
      const eAfter = solidEAfter + pm * (fStateAfter[7] + fStateAfter[15]);

      return {
        status: 'ok',
        gpuErrors,
        compileErrors,
        maxStorageSlots: device.limits?.maxStorageBuffersPerShaderStage ?? null,
        seededBank: seeded?.polytopeBank ?? null,
        bindingActive: binding?.active ?? false,
        bankMaterialCount: binding?.materialCount ?? 0,
        polytopeAtlasBound: refreshOut?.polytopeAtlasBound ?? false,
        refreshPolytopeGen: refreshOut?.polytopeAtlasGeneration ?? 0,
        escalationPoll,
        postEscalationBinding: {
          generation: postEscalationBinding?.generation ?? 0,
          materialCount: postEscalationBinding?.materialCount ?? 0
        },
        postEscalationPoll,
        gasPolytopeProof,
        liveStatus,
        dormUniform,
        dormStep,
        cLedger,
        tLedger,
        pBeforeY,
        pAfterY,
        eBefore,
        eAfter
      };
    });

    assert.equal(out.status, 'ok', `Gate 3 native proof failed: ${JSON.stringify(out)}`);
    assert.deepEqual(out.compileErrors, []);
    assert.deepEqual(out.gpuErrors, []);
    assert.deepEqual(pageErrors, []);

    // 1. In-shader WGSL Polytope Atlas Bank + schedule-boundary miss escalation + closed-loop rebuilt hit
    assert.equal(out.polytopeAtlasBound, true, `Polytope atlas bank must bind at @binding(8): ${JSON.stringify({ maxStorageSlots: out.maxStorageSlots, seededBank: out.seededBank, bindingActive: out.bindingActive, bankMaterialCount: out.bankMaterialCount })}`);
    assert.ok(out.bankMaterialCount >= 3, `Expected >= 3 materials in packed GPU bank, got ${out.bankMaterialCount}`);
    assert.equal(out.escalationPoll?.hits, 2, `Expected 2 in-domain WGSL polytope hits (H2O + Fe), got ${JSON.stringify(out.escalationPoll)}`);
    assert.equal(out.escalationPoll?.applied, 2, `Expected 2 phase-matched applied WGSL polytope hits (H2O liquid + Fe solid), got ${JSON.stringify(out.escalationPoll)}`);
    assert.equal(out.escalationPoll?.phaseMismatches, 0, `Expected 0 phase mismatches on H2O liquid + Fe solid, got ${JSON.stringify(out.escalationPoll)}`);
    assert.equal(out.escalationPoll?.misses, 1, `Expected 1 out-of-domain WGSL polytope miss (95000 K), got ${JSON.stringify(out.escalationPoll)}`);
    assert.ok(Boolean(out.escalationPoll?.triggeredEscalationKey), `Out-of-domain WGSL miss must trigger async Triad escalation: ${JSON.stringify(out.escalationPoll)}`);
    assert.ok((out.postEscalationBinding?.generation ?? 0) >= 2, `Tier-3 escalation must rebuild resident GPU atlas bank (gen >= 2): ${JSON.stringify(out.postEscalationBinding)}`);
    assert.equal(out.postEscalationPoll?.hits, 3, `Closed-loop post-escalation mechanics refresh must hit all 3 particles (including previously missed 95000 K): ${JSON.stringify(out.postEscalationPoll)}`);
    assert.equal(out.postEscalationPoll?.misses, 0, `Closed-loop post-escalation mechanics refresh must have 0 misses: ${JSON.stringify(out.postEscalationPoll)}`);
    assert.ok((out.postEscalationPoll?.atlasGeneration ?? 0) >= 2, `Closed-loop receipt must report rebuilt atlas generation >= 2: ${JSON.stringify(out.postEscalationPoll)}`);
    assert.ok((out.liveStatus?.cumulativeHits ?? 0) >= 5 && (out.liveStatus?.cumulativeMisses ?? 0) >= 1 && (out.liveStatus?.cumulativeApplied ?? 0) >= 4,
      `Live status must record cumulative hits/applied/misses: ${JSON.stringify(out.liveStatus)}`);

    // 1b. Live Vulkan spatial gas ledger EOS consuming @binding(10) Polytope Atlas (non-ideal z_poly modulation)
    assert.equal(out.gasPolytopeProof?.ready, true, `Spatial gas EOS polytope proof failed: ${JSON.stringify(out.gasPolytopeProof)}`);
    assert.equal(out.gasPolytopeProof?.polytopeHitCount, 1, `Spatial gas EOS must record 1 Polytope Atlas hit in authority[34]: ${JSON.stringify(out.gasPolytopeProof)}`);
    assert.equal(out.gasPolytopeProof?.polytopeMissCount, 0, `Spatial gas EOS must record 0 misses in authority[35]: ${JSON.stringify(out.gasPolytopeProof)}`);
    const zMeasured = out.gasPolytopeProof.pressurePa / Math.max(1, out.gasPolytopeProof.idealPressurePa);
    console.log(
      `[priority3-gas-polytope] pressurePa=${out.gasPolytopeProof.pressurePa.toFixed(2)} idealPressurePa=${out.gasPolytopeProof.idealPressurePa.toFixed(2)} zMeasured=${zMeasured.toFixed(4)} hits=${out.gasPolytopeProof.polytopeHitCount} misses=${out.gasPolytopeProof.polytopeMissCount}`
    );
    assert.ok(zMeasured > 1.25 && zMeasured < 1.45,
      `Spatial gas EOS must consume pa_gas to apply real-gas compressibility z_poly (~1.35 for 1.35x density N2), got z=${zMeasured.toFixed(4)} (${JSON.stringify(out.gasPolytopeProof)})`);

    // 2a. Canonical SS thermal dormancy
    assert.deepEqual(out.dormUniform.slice(0, 3), [0, 64, 64], 'Canonical SS thermal dormancy: uniform field must be 100% dormant');
    assert.ok(out.dormStep[0] > 0 && out.dormStep[1] > 0 && out.dormStep[2] === 64,
      `Canonical SS thermal dormancy step field must partition interface active + far dormant: ${JSON.stringify(out.dormStep)}`);

    // 2b. Canonical SS solid-fluid contact & thermal exact conservation
    assert.ok(out.cLedger[0] >= 2 && out.cLedger[1] === 0, `Canonical SS contact ledger invalid: ${JSON.stringify(out.cLedger)}`);
    assert.ok(Math.abs(out.pAfterY - out.pBeforeY) < 1e-6, `Canonical SS solid-fluid momentum conservation failed: ${out.pBeforeY} -> ${out.pAfterY}`);
    assert.ok(out.tLedger[1] >= 2 && out.tLedger[0] > 0, `Canonical SS thermal coupling must transfer heat into ice: ${JSON.stringify(out.tLedger)}`);
    assert.ok(Math.abs(out.eAfter - out.eBefore) / Math.max(1, Math.abs(out.eBefore)) < 1e-6,
      `Canonical SS solid-fluid energy conservation failed: ${out.eBefore} -> ${out.eAfter}`);
  } finally {
    await browser.close();
  }
});
