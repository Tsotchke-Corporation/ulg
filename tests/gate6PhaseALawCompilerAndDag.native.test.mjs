import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_ELEMENTS_LAB_BASE_URL || 'https://127.0.0.1:5173/';

function buildEshkolCTaitLawIrJson() {
  const eshkolDir = path.resolve(process.cwd(), '../eshkol');
  const emitterSrc = path.join(eshkolDir, 'lib/backend/vm_wgsl_emitter.c');
  const testSrc = path.join(eshkolDir, 'tests/test_wgsl_emitter.c');
  if (!fs.existsSync(emitterSrc) || !fs.existsSync(testSrc)) return null;
  const tmpBin = path.join(os.tmpdir(), `eshkol_wgsl_native_${process.pid}`);
  try {
    execFileSync('gcc', [
      '-std=c99', '-Wall', '-Wextra', '-Werror',
      `-I${path.join(eshkolDir, 'inc')}`,
      emitterSrc, testSrc, '-lm', '-o', tmpBin
    ], { stdio: 'pipe' });
    return JSON.parse(execFileSync(tmpBin, ['--emit-tait-json'], { encoding: 'utf8' }));
  } finally {
    if (fs.existsSync(tmpBin)) fs.unlinkSync(tmpBin);
  }
}

test('native Vulkan executes Law-IR compiled Tait EOS + AD (JS & Eshkol C emitter), paired RepresentedVolume, Law-DAG scheduler, and upgraded continuum shaders', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 to run on native Vulkan WebGPU',
  timeout: 120_000
}, async () => {
  const eshkolCEmittedLawIr = buildEshkolCTaitLawIrJson();
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
    const url = new URL('/__gate6_phase_a_test__', BASE_URL).href;
    await page.route(url, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Gate 6 Phase A</title>' }));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    result = await page.evaluate(async (cLawIr) => {
      const mod = await import('/tests/fixtures/gate6PhaseALawCompilerNative.js');
      return mod.runGate6PhaseALawCompilerNative({ eshkolCEmittedLawIr: cLawIr });
    }, eshkolCEmittedLawIr);
  } finally {
    await browser.close();
  }

  assert.equal(result.status, 'ok', `Gate 6 Phase A native Vulkan probe did not execute: ${JSON.stringify(result)}`);
  console.log('[gate6-phase-a-native]', JSON.stringify(result));
  assert.equal(result.validationError, null, result.validationError);
  assert.deepEqual(result.uncapturedErrors, []);
  assert.deepEqual(result.implicitPressureErrors, []);
  assert.deepEqual(result.phaseSlotMaterializationErrors, []);
  assert.deepEqual(result.retargetCompileErrors, []);

  const checkTait = (label, tait) => {
    assert.deepEqual(tait.compileErrors, [], `${label} compile errors`);
    // Receipt: 3 hits (J=0.9, 1.0, 1.15) + 1 domainExitHigh (J=5.0)
    assert.equal(tait.receipt[0], 3, `${label} expected 3 envelope hits`);
    assert.equal(tait.receipt[1], 0, `${label} expected 0 domainExitLow`);
    assert.equal(tait.receipt[2], 1, `${label} expected 1 domainExitHigh`);

    const B = 3.04e8;
    const gamma = 7;
    const expP09 = B * ((1 / 0.9) ** gamma - 1);
    const expK09 = B * gamma * (0.9 ** (-gamma));
    assert.ok(Math.abs(tait.samples[0].pressurePa - expP09) / expP09 < 1e-5, `${label} compressed P mismatch`);
    assert.ok(Math.abs(tait.samples[0].bulkModulusPa - expK09) / expK09 < 1e-5, `${label} compressed AD K mismatch`);
    assert.ok(Math.abs(tait.samples[1].pressurePa) < 1e-2, `${label} rest P mismatch`);
    assert.ok(Math.abs(tait.samples[1].bulkModulusPa - B * gamma) / (B * gamma) < 1e-5, `${label} rest AD K mismatch`);
    // Physical cavitation floor: J=1.15 -> P = 0 and K = 0!
    assert.equal(tait.samples[2].pressurePa, 0, `${label} cavitated P must be 0`);
    assert.equal(tait.samples[2].bulkModulusPa, 0, `${label} cavitated K must be 0`);
  };

  checkTait('builtin-js-law-ir', result.builtinTait);
  if (eshkolCEmittedLawIr) {
    assert.ok(result.eshkolCTait != null);
    checkTait('eshkol-c-emitted-law-ir', result.eshkolCTait);
  }

  // Paired RepresentedVolume phase retargeting conserves V_current = 0.008 m^3!
  assert.ok(Math.abs(result.retargetOut.v0 - (8.0 / 0.6)) / (8.0 / 0.6) < 1e-5);
  assert.ok(Math.abs(result.retargetOut.vCurrent - 0.008) < 1e-6);
  assert.equal(result.dagReceipt.leaseSnapshot.live, 0);
  assert.equal(result.dagReceipt.zeroWriteConflicts, true);
  assert.equal(result.dagReceipt.zeroLegacyPrivateGrids, true);
  assert.equal(result.sharedViewIdentityMatched, true);
  assert.ok(result.dagReceipt.hoistedViewBuilds >= 1, `expected hoistedViewBuilds >= 1, got ${result.dagReceipt.hoistedViewBuilds}`);
  assert.ok(result.dagReceipt.hoistedViewReuses >= 1, `expected hoistedViewReuses >= 1, got ${result.dagReceipt.hoistedViewReuses}`);
  assert.ok(result.dagReceipt.validatedStageBindGroups.includes('phase-carrier-transfer'));
});
