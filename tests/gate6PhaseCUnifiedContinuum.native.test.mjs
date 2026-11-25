import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_ELEMENTS_LAB_BASE_URL || 'https://127.0.0.1:5173/';

test('Gate 6 Phase C: native Vulkan verifies zero-private-grid SS solid-fluid shaders & unilateral solid-liquid tangential slip (conserving momentum + translation invariance)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 to run on native Vulkan WebGPU',
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
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const url = new URL('/__gate6_phase_c_test__', BASE_URL).href;
    await page.route(url, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Gate 6 Phase C</title>' }));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    result = await page.evaluate(async () => {
      const mod = await import('/tests/fixtures/gate6PhaseCUnifiedContinuumNative.js');
      return mod.runGate6PhaseCUnifiedContinuumNative();
    });
  } finally {
    await browser.close();
  }

  assert.equal(result.status, 'ok', `Gate 6 Phase C native Vulkan probe did not execute: ${JSON.stringify(result)}`);
  console.log('[gate6-phase-c-native]', JSON.stringify(result));
  assert.deepEqual(result.compileErrors, []);
  assert.equal(result.validationError, null, result.validationError);
  assert.deepEqual(result.uncapturedErrors, []);

  // Exact linear momentum conservation across ALL 3 axes for every slip case!
  const assertMomentumConserved = (label, c) => {
    const scale = Math.max(
      1.0,
      Math.hypot(c.momentumBefore[0], c.momentumBefore[1], c.momentumBefore[2])
    );
    for (let axis = 0; axis < 3; axis += 1) {
      const err = Math.abs(c.momentumAfter[axis] - c.momentumBefore[axis]) / scale;
      assert.ok(
        err < 1e-3,
        `${label} momentum axis ${axis} drifted: before=${c.momentumBefore[axis]} after=${c.momentumAfter[axis]} relErr=${err}`
      );
    }
  };
  assertMomentumConserved('approaching', result.approaching);
  assertMomentumConserved('shifted', result.shifted);
  assertMomentumConserved('separating', result.separating);

  // Approaching case: mixed nodes detected, unilateral normal contacts resolved, tangential vx > 1.95 m/s preserved (NOT locked to 0!),
  // and liquid normal approach vy damped toward solid normal velocity!
  assert.ok(result.approaching.receipt[0] > 0, 'expected mixed solid-liquid nodes');
  assert.ok(result.approaching.receipt[1] > 0, 'expected unilateral normal contact resolutions');
  assert.ok(result.approaching.meanLiquidVel[0] > 1.95, `tangential slip locked! vx=${result.approaching.meanLiquidVel[0]}`);
  assert.ok(result.approaching.meanLiquidVel[1] > -0.75, `normal impenetrability failed! vy=${result.approaching.meanLiquidVel[1]}`);
  assert.ok(result.approaching.meanSolidVel[1] < -0.01, `solid received no downward reaction! solidVy=${result.approaching.meanSolidVel[1]}`);

  // Translation invariance: off-origin shifted scene produces identical velocities!
  assert.ok(Math.abs(result.approaching.meanLiquidVel[0] - result.shifted.meanLiquidVel[0]) < 1e-4);
  assert.ok(Math.abs(result.approaching.meanLiquidVel[1] - result.shifted.meanLiquidVel[1]) < 1e-4);
  assert.ok(Math.abs(result.approaching.meanSolidVel[1] - result.shifted.meanSolidVel[1]) < 1e-4);

  // Separating case: liquid moving away (+Y) + tangential (+X) experiences ZERO suction and ZERO tangential locking!
  assert.ok(result.separating.receipt[2] > 0, 'expected separated mixed nodes');
  assert.ok(result.separating.meanLiquidVel[0] > 1.999, `separating tangential vx locked: ${result.separating.meanLiquidVel[0]}`);
  assert.ok(result.separating.meanLiquidVel[1] > 0.999, `separating liquid pulled back by artificial suction: vy=${result.separating.meanLiquidVel[1]}`);
  assert.ok(Math.abs(result.separating.meanSolidVel[1]) < 1e-5, `solid spuriously pulled during separation: ${result.separating.meanSolidVel[1]}`);

  // Production live wiring proof: runMlsMpmGpuResidentStep automatically invokes unilateral slip inside the shared fused encoder!
  assert.ok(result.productionStep.executedStepsDelta >= 1, `production resident step did not invoke solid-liquid slip: ${JSON.stringify(result.productionStep)}`);
  assert.equal(result.productionStep.sharedEncoder, true, 'solid-liquid slip must execute inside shared fused encoder (0 extra submits)');
  assert.equal(result.productionStep.lastParticleCount, 12);
  assert.equal(result.productionStep.dispatches, 4);
});
