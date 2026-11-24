import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const SERVER_URL = process.env.ULG_DEV_URL || 'https://127.0.0.1:5173';
const SHOT_DIR = process.env.ULG_FIVE_SIMS_SHOT_DIR || '';

async function saveShot(page, name) {
  if (!SHOT_DIR) return;
  await fs.mkdir(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}-full.png`), fullPage: false });
  const dataUrl = await page.evaluate(() => window.__ulgElementsLabApi?.captureCanvasDataUrl?.());
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png;base64,')) {
    const buf = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
    await fs.writeFile(path.join(SHOT_DIR, `${name}-gpu.png`), buf);
  }
}

test('All 5 canonical material-property WebGPU simulations: LLG Magnetism, Drude/BCS Transport, Mechanical/NEMD MD, Stark/Delta-SCF & 3D Fission/Bateman', {
  skip: !RUN_NATIVE && 'set ULG_RUN_NATIVE_WEBGPU=1 to run native Vulkan 5-sim suite',
  timeout: 240_000
}, async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--headless=new',
      '--enable-unsafe-webgpu',
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--disable-gpu-sandbox',
      '--ignore-gpu-blocklist'
    ]
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const pageErrors = [];
    const gpuErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') {
        const txt = m.text();
        console.log('[page-console-error]', txt);
        if (/webgpu|validation|shader/i.test(txt)) gpuErrors.push(txt);
      }
    });

    // 1. SIM 1: 3D Stochastic LLG Spin-Lattice Magnetism (Fe Ferromagnet & Cr Neel Antiferromagnet!)
    await page.goto(`${SERVER_URL}/elements-lab.html?z=26&tab=crystal`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 26 && window.__ulgElementsLabState?.registeredModules?.length >= 9, null, { timeout: 60_000 });
    const regMods = await page.evaluate(() => window.__ulgElementsLabState.registeredModules);
    console.log('[registered-canonical-modules]', JSON.stringify(regMods));
    for (const k of ['spin-lattice-llg@1', 'electron-transport-gpu@1', 'md-mechanical-probe@1', 'md-nemd-transport@1', 'nuclear-fission-ldm@1']) {
      assert.ok(regMods.includes(k), `missing module ${k}`);
    }

    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('spin-llg'));
    const feOrdered = await page.evaluate(() => window.__ulgElementsLabApi.stepSpinLattice(96, { temperatureK: 200, fieldBZTesla: 3.5 }));
    await saveShot(page, '01-fe-spin-llg-ordered');
    const feReversed = await page.evaluate(() => window.__ulgElementsLabApi.stepSpinLattice(140, { temperatureK: 200, fieldBZTesla: -4.2 }));
    const feHot = await page.evaluate(() => window.__ulgElementsLabApi.stepSpinLattice(120, { temperatureK: 2400, fieldBZTesla: 0.0 }));
    await saveShot(page, '02-fe-spin-llg-hot-disorder');
    console.log('[sim1-fe-llg]', JSON.stringify({
      orderedMz: feOrdered.magnetizationZ,
      reversedMz: feReversed.magnetizationZ,
      hotMag: feHot.magnetizationMag,
      hotAlign: feHot.neighborAlign
    }));
    assert.ok(feOrdered.magnetizationZ > 0.70, `Fe ordered M_z=${feOrdered.magnetizationZ}`);
    assert.ok(feReversed.magnetizationZ < -0.50, `Fe field-reversed M_z=${feReversed.magnetizationZ}`);
    assert.ok(feHot.magnetizationMag < 0.55 && feHot.neighborAlign < feOrdered.neighborAlign - 0.2, `Fe hot T>T_C must disorder: mag=${feHot.magnetizationMag}`);

    // Cr (Z=24): Neel Antiferromagnet (J < 0 -> checkerboard staggered order!)
    await page.evaluate(() => window.__ulgElementsLabApi.solveElement(24, null, { switchToTab: 'crystal' }));
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 24, null, { timeout: 45_000 });
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('spin-llg'));
    const crAfm = await page.evaluate(() => window.__ulgElementsLabApi.stepSpinLattice(140, { temperatureK: 20, fieldBZTesla: 0.0 }));
    await saveShot(page, '03-cr-spin-llg-neel-afm');
    console.log('[sim1-cr-afm]', JSON.stringify({
      phase: crAfm.magneticPhase,
      mz: crAfm.magnetizationZ,
      mag: crAfm.magnetizationMag,
      staggered: crAfm.staggeredOrderMag,
      neighborAlign: crAfm.neighborAlign
    }));
    assert.equal(crAfm.magneticPhase, 'antiferromagnetic');
    assert.ok(crAfm.neighborAlign < -0.25 && crAfm.staggeredOrderMag > crAfm.magnetizationMag, `Cr must form antiparallel Neel order: align=${crAfm.neighborAlign}, stag=${crAfm.staggeredOrderMag}`);

    // 2. SIM 2: 3D Drude-Boltzmann & BCS Electron-Phonon Transport (Pb Superconductor & Si Semiconductor!)
    await page.evaluate(() => window.__ulgElementsLabApi.solveElement(82, null, { switchToTab: 'crystal' }));
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 82, null, { timeout: 45_000 });
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('transport'));
    const pbCryo = await page.evaluate(() => window.__ulgElementsLabApi.stepElectronTransport(40, { temperatureK: 1.5, eFieldVPerM: 12000 }));
    await saveShot(page, '04-pb-superconducting-cooper');
    const pbRoom = await page.evaluate(() => window.__ulgElementsLabApi.stepElectronTransport(40, { temperatureK: 300, eFieldVPerM: 12000 }));
    console.log('[sim2-pb-transport]', JSON.stringify({
      cryoSc: pbCryo.isSuperconducting,
      cryoCooper: pbCryo.cooperCount,
      cryoScatter: pbCryo.scatterEvents,
      cryoRho: pbCryo.resistivityGpuOhmM,
      roomSc: pbRoom.isSuperconducting,
      roomScatter: pbRoom.scatterEvents,
      roomSigma: pbRoom.sigmaGpuSPerM
    }));
    if (pbCryo.superconductingTcK > 1.5) {
      assert.equal(pbCryo.isSuperconducting, true, 'Pb below T_c must enter BCS condensate');
      assert.ok(pbCryo.cooperCount > 500 && pbCryo.scatterEvents === 0 && pbCryo.resistivityGpuOhmM === 0);
    }
    assert.equal(pbRoom.isSuperconducting, false);
    assert.ok(pbRoom.scatterEvents > 0 && pbRoom.sigmaGpuSPerM > 1e5);

    await page.evaluate(() => window.__ulgElementsLabApi.solveElement(14, null, { switchToTab: 'crystal' }));
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 14, null, { timeout: 45_000 });
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('transport'));
    const siCold = await page.evaluate(() => window.__ulgElementsLabApi.stepElectronTransport(24, { temperatureK: 80, eFieldVPerM: 12000 }));
    const siHot = await page.evaluate(() => window.__ulgElementsLabApi.stepElectronTransport(24, { temperatureK: 1000, eFieldVPerM: 12000 }));
    await saveShot(page, '05-si-semiconductor-hot');
    console.log('[sim2-si-semi]', JSON.stringify({ coldMobile: siCold.mobileCount, hotMobile: siHot.mobileCount, bandGapEv: siHot.bandGapEv }));
    assert.ok(siHot.mobileCount > siCold.mobileCount, `Heating Si must thermally excite more carriers: cold=${siCold.mobileCount}, hot=${siHot.mobileCount}`);

    // 3 & 4. SIMS 3 & 4: Canonical Mechanical Stress-Strain / Acoustic + NEMD Viscosity / Thermal / Free-Surface (Cu Z=29)
    await page.evaluate(() => window.__ulgElementsLabApi.solveElement(29, null, { switchToTab: 'md' }));
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 29, null, { timeout: 45_000 });

    // Stress-Strain
    await page.evaluate(() => window.__ulgElementsLabApi.setMdMode('strain', 150));
    const mdBase = await page.evaluate(() => window.__ulgElementsLabApi.stepMd(12, { npt: false }));
    const mdComp = await page.evaluate(() => window.__ulgElementsLabApi.stepMd(24, { strainX: -0.04, npt: true }));
    await saveShot(page, '06-cu-md-strain');
    console.log('[sim3-cu-strain]', JSON.stringify({
      basePxx: mdBase.diagPressureGPa[0],
      compPxx: mdComp.diagPressureGPa[0],
      strainX: mdComp.strainX,
      poisson: mdComp.poissonMeasured
    }));
    assert.ok(mdComp.diagPressureGPa[0] > mdBase.diagPressureGPa[0] + 1.0, 'Uniaxial compression must increase compressive GPU stress sigma_xx');

    // Acoustic P-wave
    await page.evaluate(() => window.__ulgElementsLabApi.setMdMode('acoustic', 80));
    const mdAc = await page.evaluate(() => window.__ulgElementsLabApi.stepMd(12, { pulse: 'longitudinal' }));
    await saveShot(page, '07-cu-md-acoustic');
    console.log('[sim3-cu-acoustic]', JSON.stringify({ boxLx: mdAc.boxLengthsA[0], slabVx: Array.from(mdAc.slabVx).map((v) => Number(v.toFixed(3))) }));
    assert.ok(mdAc.boxLengthsA[0] > mdAc.boxLengthsA[1] * 2.0);

    // Couette Shear NEMD Viscosity
    await page.evaluate(() => window.__ulgElementsLabApi.setMdMode('shear', 1600));
    const mdShear = await page.evaluate(() => window.__ulgElementsLabApi.stepMd(40));
    await saveShot(page, '08-cu-md-shear-viscosity');
    console.log('[sim4-cu-shear]', JSON.stringify({ viscosityPaS: mdShear.nemdViscosityPaS, sxyGPa: mdShear.stressOffDiagGPa[0], slabVx: Array.from(mdShear.slabVx).map((v) => Number(v.toFixed(3))) }));
    assert.ok(mdShear.nemdViscosityPaS > 0 && mdShear.slabVx[7] > mdShear.slabVx[0], 'Couette NEMD must establish shear gradient & positive viscosity');

    // Thermal Gradient NEMD
    await page.evaluate(() => window.__ulgElementsLabApi.setMdMode('thermal', 500));
    const mdTherm = await page.evaluate(() => window.__ulgElementsLabApi.stepMd(48));
    await saveShot(page, '09-cu-md-thermal-gradient');
    console.log('[sim4-cu-thermal]', JSON.stringify({ kappa: mdTherm.nemdThermalCondWPerMK, slabT: Array.from(mdTherm.slabTempK).map((t) => Math.round(t)) }));
    assert.ok(mdTherm.slabTempK[0] > mdTherm.slabTempK[4] * 1.15, `Thermal NEMD must maintain hot>cold gradient: ${mdTherm.slabTempK[0]} vs ${mdTherm.slabTempK[4]}`);

    // Free-Surface Vacuum Slab
    await page.evaluate(() => window.__ulgElementsLabApi.setMdMode('surface', 600));
    const mdSurf = await page.evaluate(() => window.__ulgElementsLabApi.stepMd(24));
    await saveShot(page, '10-cu-md-free-surface');
    console.log('[sim4-cu-surface]', JSON.stringify({ boxLz: mdSurf.boxLengthsA[2], gammaNPerM: mdSurf.surfaceTensionNPerM }));
    assert.ok(mdSurf.boxLengthsA[2] > mdSurf.boxLengthsA[0] * 2.2 && Number.isFinite(mdSurf.surfaceTensionNPerM));

    // 5. SIM 5: Atomic Stark Polarization (alpha_0) + Delta-SCF Ionization (Au) & 3D Nuclear Fission + Bateman Decay (U-235)
    await page.evaluate(() => window.__ulgElementsLabApi.solveElement(79, null, { switchToTab: 'atomic' }));
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 79 && window.__ulgElementsLabState?.currentTab === 'atomic', null, { timeout: 45_000 });
    const stark = await page.evaluate(() => window.__ulgElementsLabApi.setStarkField(4.0));
    const dscf = await page.evaluate(() => window.__ulgElementsLabApi.triggerDeltaScfIonize(true));
    await saveShot(page, '11-au-stark-delta-scf');
    console.log('[sim5-au-stark-dscf]', JSON.stringify({ stark, dscf }));
    assert.ok(stark.alpha0Angstrom3 > 0.5 && stark.inducedDipoleDebye > 0.2 && Math.abs(stark.starkMixLambda) > 0.01);
    assert.ok(dscf.ionizationEnergyEv > 3.0 && dscf.ionizationEnergyEv < 25.0, `Au GPU Delta-SCF I_1=${dscf.ionizationEnergyEv} eV`);

    await page.evaluate(() => window.__ulgElementsLabApi.solveElement(92, 235, { switchToTab: 'nuclear' }));
    await page.waitForFunction(() => window.__ulgElementsLabState?.isotope === 'U-235', null, { timeout: 45_000 });
    await page.evaluate(() => window.__ulgElementsLabApi.setNuclearMode('fission', 1.18));
    await page.waitForTimeout(150);
    await saveShot(page, '12-u235-fission-scission');
    await page.evaluate(() => window.__ulgElementsLabApi.setNuclearMode('bateman'));
    await page.waitForTimeout(150);
    const nucState = await page.evaluate(() => ({
      fissionCurve: window.__ulgElementsLabState.fissionCurve,
      batemanCurves: window.__ulgElementsLabState.batemanCurves
    }));
    console.log('[sim5-u235-fission-bateman]', JSON.stringify(nucState));
    assert.ok(nucState.fissionCurve.fissility > 0.7 && nucState.fissionCurve.barrierMeV > 0);
    assert.ok(nucState.batemanCurves >= 3, 'U-235 Bateman decay chain must track >= 3 nuclide populations');
    await saveShot(page, '13-u235-bateman');

    assert.deepEqual(pageErrors, [], `unexpected page errors: ${pageErrors.join('; ')}`);
    assert.deepEqual(gpuErrors, [], `unexpected WebGPU errors: ${gpuErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});
