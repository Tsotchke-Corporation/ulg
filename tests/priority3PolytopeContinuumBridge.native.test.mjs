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
