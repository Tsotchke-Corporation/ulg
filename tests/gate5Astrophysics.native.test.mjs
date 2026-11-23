import assert from 'node:assert/strict';
import test from 'node:test';

// Gate 5A & 5C Native Vulkan GPU Invariant Proof:
//   - Symplectic Planetary N-body (`runSymplecticPlanetaryNBodyWebGpu`): exact
//     Keplerian energy & angular-momentum conservation (< 1e-3) + strict
//     translation invariance under (+50, -30, +20) shift!
//   - Galactic Dark-Matter + Stars + ISM Gas + Paczyński-Wiita SMBH
//     (`runGalacticIsmWebGpu`): real ISM radiative cooling via Gate 1 atomic
//     lines + strict translation invariance (`< 1e-4`)!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1'
  || process.env.ULG_RUN_NATIVE_GATE5 === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Gate 5A & 5C native Vulkan proof: symplectic planetary N-body & translation-invariant galactic ISM cooling', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan Gate 5A/5C proof',
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

    const res = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 6 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 300));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const { runSymplecticPlanetaryNBodyWebGpu } = await import('/src/runtime/astrophysics/planetaryStructureGpu.js');
      const { runGalacticIsmWebGpu } = await import('/src/runtime/astrophysics/galacticIsmCoolingGpu.js');

      // 1. Two-body + outer planet symplectic Keplerian conservation
      const bodies0 = [
        { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mass: 1.0 },
        { x: 1.0, y: 0, z: 0, vx: 0, vy: 1.0, vz: 0, mass: 1e-4 },
        { x: 0, y: 2.2, z: 0, vx: -1 / Math.sqrt(2.2), vy: 0, vz: 0, mass: 2e-4 }
      ];
      const pStart = await runSymplecticPlanetaryNBodyWebGpu(device, { bodies: bodies0, dt: 0.005, steps: 1 });
      const pEnd = await runSymplecticPlanetaryNBodyWebGpu(device, { bodies: bodies0, dt: 0.005, steps: 400 });
      const eRelErr = Math.abs(pEnd.totalEnergy - pStart.totalEnergy) / Math.abs(pStart.totalEnergy);
      const lRelErr = Math.abs(pEnd.angularMomentum[2] - pStart.angularMomentum[2]) / Math.abs(pStart.angularMomentum[2]);

      // 2. Galactic DM + Star + ISM + SMBH translation invariance & radiative cooling
      const mkGal = (ox, oy, oz) => {
        const list = [{ x: ox, y: oy, z: oz, vx: 0, vy: 0, vz: 0, mass: 5.0, tempK: 0, type: 3 }];
        for (let i = 0; i < 64; i += 1) {
          const ang = (i / 64) * 2 * Math.PI;
          const r = 1.2 + (i % 8) * 0.45;
          const vc = Math.sqrt(5.0 / r);
          const isIsm = i % 2 === 0;
          list.push({
            x: ox + r * Math.cos(ang),
            y: oy + r * Math.sin(ang),
            z: oz + ((i % 5) - 2) * 0.05,
            vx: -vc * Math.sin(ang),
            vy: vc * Math.cos(ang),
            vz: 0,
            mass: 0.02,
            tempK: isIsm ? 25000 : 0,
            type: isIsm ? 2 : 1
          });
        }
        return list;
      };
      const galA = await runGalacticIsmWebGpu(device, { bodies: mkGal(0, 0, 0), dt: 0.01, steps: 20 });
      const galB = await runGalacticIsmWebGpu(device, { bodies: mkGal(50, -30, 20), dt: 0.01, steps: 20 });
      const comShiftErr = Math.hypot(
        (galB.com[0] - 50) - galA.com[0],
        (galB.com[1] + 30) - galA.com[1],
        (galB.com[2] - 20) - galA.com[2]
      );
      const tempDiff = Math.abs(galB.meanIsmTempK - galA.meanIsmTempK);

      device.destroy();
      return {
        status: 'ok',
        gpuErrors,
        planetary: { eRelErr, lRelErr },
        galactic: {
          meanIsmTempK: galA.meanIsmTempK,
          comShiftErr,
          tempDiff
        }
      };
    });
    await ctx.close();

    assert.deepEqual(pageErrors, []);
    assert.equal(res.status, 'ok');
    assert.deepEqual(res.gpuErrors, []);
    assert.ok(res.planetary.eRelErr < 1e-3, `Symplectic E rel err=${res.planetary.eRelErr}`);
    assert.ok(res.planetary.lRelErr < 1e-4, `Symplectic L rel err=${res.planetary.lRelErr}`);
    assert.ok(res.galactic.meanIsmTempK < 24500 && res.galactic.meanIsmTempK > 15, `ISM cooled from 25000 K to ${res.galactic.meanIsmTempK} K`);
    assert.ok(res.galactic.comShiftErr < 1e-3, `Galactic translation invariance err=${res.galactic.comShiftErr}`);
    assert.ok(res.galactic.tempDiff < 1e-2, `Galactic ISM cooling translation invariance err=${res.galactic.tempDiff}`);
  } finally {
    await browser.close();
  }
});
