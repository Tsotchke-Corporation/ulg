import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_ELEMENTS_LAB_BASE_URL || 'https://127.0.0.1:5173/';

test('native Vulkan physical cavitation floor (P_gauge >= 0) & liquid 1->8 / 8->1 dynamic material-volume LOD with exact 2^-149 ledgers', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 to run on native Vulkan WebGPU',
  timeout: 180_000
}, async (t) => {
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
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const url = new URL('/__liquid_cavitation_lod_test__', BASE_URL).href;
    await page.route(url, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Liquid LOD Gate</title>' }));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    result = await page.evaluate(async () => {
      const mod = await import('/tests/fixtures/schroederLiquidLodNative.js');
      return mod.runLiquidCavitationAndLodNative();
    });
  } finally {
    await browser.close();
  }

  if (result.status === 'unsupported') return;
  console.log('[liquid-cavitation-lod]', JSON.stringify(result));
  assert.deepEqual(result.compileErrors, []);
  assert.equal(result.validationError, null, result.validationError);
  assert.deepEqual(result.uncapturedErrors, []);

  // 1. Physical cavitation floor in implicit pressure:
  assert.equal(result.cavitation.cavitationExpanded.maxDelta, 0,
    `Cavitated liquid (J=1.15) must have zero implicit tensile pull (got ${result.cavitation.cavitationExpanded.maxDelta})`);
  assert.ok(result.cavitation.cavitationAtRest.maxDelta > 0.1,
    'Rest liquid (J=1.0) must remain active in implicit pressure solver');
  assert.ok(result.cavitation.cavitationCompressed.maxDelta > result.cavitation.cavitationAtRest.maxDelta * 0.9,
    'Compressed liquid (J=0.96) must keep strong implicit divergence removal');

  // 2. Liquid 1->8 split + 8->1 coarsen + exact 2^-149 integer ledgers + Galilean merge heating + spare reclamation
  for (const [label, lod, expectedComX] of [
    ['centered', result.centeredLod, 4.0],
    ['shifted', result.shiftedLod, 7.7]
  ]) {
    assert.equal(lod.exactMassConserved, true, `${label}: 9-limb 2^-149 mass must be bit-exact across 1->8 & 8->1`);
    assert.equal(lod.exactEnergyConserved, true, `${label}: 9-limb Σ(U-S) energy must be bit-exact across 1->8 & 8->1`);
    assert.equal(lod.splitLiquidCount, 8, `${label}: 1->8 split must populate 8 lane-1 liquid carriers`);
    assert.equal(lod.mergeLiquidCount, 1, `${label}: 8->1 coarsen must consolidate back to 1 lane-1 liquid carrier`);
    assert.equal(lod.freeSparesAfterSplit, 0, `${label}: 1->8 split must allocate all 7 spare lineages`);
    assert.equal(lod.freeSparesAfterMerge, 7, `${label}: 8->1 merge must reclaim all 7 spare lineages`);
    assert.ok(lod.crossPhaseRejectedCount >= 1, `${label}: cross-phase liquid+gas merge must fail closed`);
    assert.ok(lod.postMergeTempK > 300.0005, `${label}: Galilean relative KE on merge must heat liquid (T=${lod.postMergeTempK} K)`);
    assert.ok(Math.abs(lod.postMergeComX - expectedComX) < 1e-4, `${label}: center of mass conserved (${lod.postMergeComX} vs ${expectedComX})`);
    assert.ok(Math.abs(lod.postMergeVelX - 0.25) < 1e-5, `${label}: linear momentum conserved (${lod.postMergeVelX})`);
  }

  // 3. Canonical SS mechanicsFieldView liquid interface detection (zero private grids!)
  assert.equal(result.interfaceDetection.nearSolidRefineRequired, 1,
    'Coarse liquid adjacent to solid iron in canonical SS mechanicsFieldView must request 1->8 refinement');
  assert.equal(result.interfaceDetection.nearSolidReasonMask & 64, 64,
    'Solid-liquid interface refinement must set octet interface bit 64');
  assert.equal(result.interfaceDetection.bulkLiquidRefineRequired, 0,
    'Quiescent pure-liquid interior away from solid/material/gas interfaces must NOT refine');
  t.diagnostic('Physical cavitation floor & generalized liquid 1->8 / 8->1 dynamic material-volume LOD verified on Vulkan');
});
