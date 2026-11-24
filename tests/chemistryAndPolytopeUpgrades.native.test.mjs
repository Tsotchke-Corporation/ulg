import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const SERVER_URL = process.env.ULG_DEV_URL || 'https://127.0.0.1:5173';
const SHOT_DIR = process.env.ULG_CHEM_POLY_SHOT_DIR || '';

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

test('Chemistry depth, 3D Multi-Species Crystals, True 3D Convex Polytope Surface, 18-col IUPAC Picker & Left Accordion UI on Vulkan WebGPU', {
  skip: !RUN_NATIVE && 'set ULG_RUN_NATIVE_WEBGPU=1 to run native Vulkan chemistry & polytope suite',
  timeout: 360_000
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

    // 1. Desktop UI boot: verify left-side hierarchical accordion menu & ALL 13 canonical modules!
    await page.goto(`${SERVER_URL}/elements-lab.html?z=26&tab=atomic`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 26 && window.__ulgElementsLabState?.registeredModules?.length >= 13, null, { timeout: 60_000 });
    const uiCheck = await page.evaluate(() => ({
      modules: window.__ulgElementsLabState.registeredModules,
      topTabsDisplay: getComputedStyle(document.querySelector('.tabs')).display,
      accordionGroups: document.querySelectorAll('#accordion-nav .acc-group').length,
      iupacCells: document.querySelectorAll('#iupac-pt-grid .pt-cell').length
    }));
    console.log('[desktop-ui-rethink]', JSON.stringify(uiCheck));
    assert.equal(uiCheck.topTabsDisplay, 'none', 'Desktop must hide legacy top tab bar in favor of left hierarchical accordion');
    assert.ok(uiCheck.accordionGroups >= 7);
    assert.equal(uiCheck.iupacCells, 118, 'Real IUPAC Periodic Table must have all 118 cells');
    for (const k of [
      'molecular-rhf-gpu@1',
      'molecular-reaction-path@1',
      'molecular-vibrations-gpu@1',
      'reactive-chemistry-md@1',
      'quantum-tdks-maxwell3d@1'
    ]) {
      assert.ok(uiCheck.modules.includes(k), `Missing registered canonical module ${k}`);
    }
    await saveShot(page, '01-desktop-accordion-home');

    // 2. Open 18-Column IUPAC Periodic Table Picker Modal, filter, and capture!
    await page.click('#open-pt-btn');
    await page.waitForTimeout(180);
    const modalOpen = await page.evaluate(() => document.getElementById('pt-modal').classList.contains('open'));
    assert.equal(modalOpen, true);
    await saveShot(page, '02-iupac-periodic-table-modal');
    await page.click('#pt-modal-close');

    // 3. Tab 5: 3D H2O Molecule + Wiberg Bonds + Mulliken MEP + Dipole Arrow + Orbital Cloud Overlay
    await page.evaluate(() => window.__ulgElementsLabApi.backfeedCompound('H2O', 'compound'));
    await page.waitForFunction(() => window.__ulgElementsLabState?.formula === 'H2O', null, { timeout: 60_000 });
    await page.evaluate(() => {
      window.__ulgElementsLabApi.setChemViewMode('molecule');
      window.__ulgElementsLabApi.setMoleculeStyle({ colorMode: 1, showDipole: true, showOrbitalOverlay: true });
    });
    await page.waitForTimeout(180);
    const h2oMol = await page.evaluate(() => ({
      bonds: window.__ulgElementsLabState.bundle.atomic.bonds,
      dipole: window.__ulgElementsLabState.bundle.atomic.dipoleDebye,
      dipoleVec: window.__ulgElementsLabState.bundle.atomic.dipoleVecDebye
    }));
    console.log('[chem-h2o-3d-mol]', JSON.stringify(h2oMol));
    assert.ok(h2oMol.bonds.length >= 2 && h2oMol.dipole > 0.8);
    await saveShot(page, '03-h2o-3d-molecule-mep-orbital');

    // 4. Tab 5: CO2 3D Double Bonds (Wiberg order > 1.6!)
    await page.evaluate(() => window.__ulgElementsLabApi.backfeedCompound('CO2', 'compound'));
    await page.waitForFunction(() => window.__ulgElementsLabState?.formula === 'CO2', null, { timeout: 60_000 });
    await page.evaluate(() => {
      window.__ulgElementsLabApi.setChemViewMode('molecule');
      window.__ulgElementsLabApi.setMoleculeStyle({ colorMode: 0, showDipole: true, showOrbitalOverlay: false });
    });
    await page.waitForTimeout(160);
    const co2Mol = await page.evaluate(() => window.__ulgElementsLabState.bundle.atomic.bonds);
    console.log('[chem-co2-double-bonds]', JSON.stringify(co2Mol));
    assert.ok(co2Mol.some((b) => b.kind === 'double' && b.order > 1.6), 'CO2 must detect exact GPU Wiberg double bonds');
    await saveShot(page, '04-co2-double-bonds-3d');

    // 5. Tab 5: Multi-Molecule GPU CI-NEB Reaction Pathway (HCl + NaOH -> NaCl + H2O) at Transition State ‡!
    await page.evaluate(() => window.__ulgElementsLabApi.runReaction('HCl', 'NaOH'));
    await page.waitForFunction(() => window.__ulgElementsLabState?.reactionPathway?.equation?.includes('NaCl'), null, { timeout: 90_000 });
    const rxPath = await page.evaluate(() => window.__ulgElementsLabState.reactionPathway);
    console.log('[chem-hcl-naoh-ci-neb]', JSON.stringify(rxPath));
    assert.ok(rxPath.imageCount >= 5 && rxPath.gpuRhfCalls >= 10 && rxPath.forwardBarrierEv > 0);
    await saveShot(page, '05-hcl-naoh-reaction-ts');

    // 6. Tab 5: Geometry Optimization & GPU Hessian Vibrational Normal Modes (H2O vs D2O Isotope Shift!)
    await page.evaluate(() => window.__ulgElementsLabApi.backfeedCompound('H2O', 'compound'));
    await page.waitForFunction(() => window.__ulgElementsLabState?.formula === 'H2O', null, { timeout: 60_000 });
    await page.evaluate(() => window.__ulgElementsLabApi.setChemViewMode('vibrations'));
    const h2oVibs = await page.evaluate(() => window.__ulgElementsLabApi.runGeometryOptAndVibrations({ deuterated: false }));
    await saveShot(page, '06-h2o-vibrations-ir-raman');
    const d2oVibs = await page.evaluate(() => window.__ulgElementsLabApi.runGeometryOptAndVibrations({ deuterated: true }));
    console.log('[chem-h2o-vs-d2o-vibs]', JSON.stringify({
      h2oZpeEv: h2oVibs.totalZpeEv,
      d2oZpeEv: d2oVibs.totalZpeEv,
      ratio: d2oVibs.totalZpeEv / Math.max(1e-6, h2oVibs.totalZpeEv),
      h2oModes: h2oVibs.modes.map((m) => Math.round(m.freqCm1)),
      d2oModes: d2oVibs.modes.map((m) => Math.round(m.freqCm1))
    }));
    assert.ok(h2oVibs.modes.length === 3, `H2O must have 3 vibrational modes, got ${h2oVibs.modes.length}`);
    assert.ok(d2oVibs.totalZpeEv < h2oVibs.totalZpeEv * 0.80, 'D2O must exhibit real ~1/sqrt(2) isotopic vibrational redshift!');

    // 7. Tab 5: Live 3D WebGPU Reactive Chemistry MD Chamber (Ignition Spark -> Exothermic Conversion & Heating!)
    await page.evaluate(() => window.__ulgElementsLabApi.setChemViewMode('reactive-md'));
    const rxBefore = await page.evaluate(() => window.__ulgElementsLabApi.stepReactiveMd(10, { temperatureK: 280, thermostat: false, catalyst: false }));
    const rxAfter = await page.evaluate(() => window.__ulgElementsLabApi.stepReactiveMd(90, { spark: 3.1, catalyst: true, thermostat: false }));
    console.log('[chem-reactive-md]', JSON.stringify({
      beforeT: rxBefore.temperatureK,
      beforeConv: rxBefore.conversionFrac,
      afterT: rxAfter.temperatureK,
      afterConv: rxAfter.conversionFrac,
      stoichOk: rxAfter.stoichiometryConserved,
      fwd: rxAfter.totalFwdEvents
    }));
    assert.equal(rxAfter.stoichiometryConserved, true, 'Reactive MD must preserve exact 1:1 stoichiometry');
    assert.ok(rxAfter.conversionFrac > rxBefore.conversionFrac + 0.05, `Spark must drive reaction conversion: ${rxBefore.conversionFrac} -> ${rxAfter.conversionFrac}`);
    assert.ok(rxAfter.temperatureK > rxBefore.temperatureK + 80, `Exothermic reaction + spark must raise T: ${rxBefore.temperatureK} -> ${rxAfter.temperatureK}`);
    await saveShot(page, '07-reactive-md-chamber-ignited');

    // 8. Tab 3: Multi-Species 3D Ionic Crystal (NaCl rocksalt-B1 / cscl-B2 with distinct Na+ & Cl- ions + coordination bonds!)
    await page.evaluate(() => window.__ulgElementsLabApi.backfeedCompound('NaCl', 'crystal'));
    await page.waitForFunction(() => window.__ulgElementsLabState?.formula === 'NaCl' && window.__ulgElementsLabState?.currentTab === 'crystal', null, { timeout: 60_000 });
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('lattice'));
    await page.waitForTimeout(180);
    const naclCry = await page.evaluate(() => window.__ulgElementsLabState.multiSpeciesCrystal);
    console.log('[nacl-multispecies-crystal]', JSON.stringify(naclCry));
    assert.ok(naclCry && naclCry.speciesLegend.length === 2 && naclCry.bondCount > 0);
    await saveShot(page, '08-nacl-multispecies-crystal');

    // 9. Tab 6: True 3D Orbitable Convex Polytope Phase Surface (T, P, rho) + Glowing GPU Probe Pin + Residual Error Map!
    await page.evaluate(() => window.__ulgElementsLabApi.backfeedCompound('H2O', 'polytope'));
    await page.waitForFunction(() => window.__ulgElementsLabState?.formula === 'H2O' && window.__ulgElementsLabState?.currentTab === 'polytope', null, { timeout: 60_000 });
    await page.evaluate(() => window.__ulgElementsLabApi.setPolytopeViewMode('3d-surface'));
    const p3dInside = await page.evaluate(() => window.__ulgElementsLabApi.probePolytope(300, 101325));
    await page.waitForTimeout(160);
    assert.equal(p3dInside.hit, true);
    await saveShot(page, '09-h2o-polytope-3d-surface');

    await page.evaluate(() => window.__ulgElementsLabApi.setPolytopeViewMode('residual-map'));
    await page.waitForTimeout(160);
    await saveShot(page, '10-h2o-polytope-residual-map');

    // 10. True 3D Coupled Maxwell-Kohn-Sham (`tdks-atom`): 3D Orbital Geometry & Polarization Coupling Proof!
    await page.evaluate(() => window.__ulgElementsLabApi.solveElement(79, null, { switchToTab: 'crystal' }));
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 79 && window.__ulgElementsLabState?.currentTab === 'crystal', null, { timeout: 60_000 });
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('tdks-atom'));
    // Test A: Au 5d (m=2 cloverleaf) struck by 440nm blue photon wavepacket (front + oblique 3D orbit angle!)
    await page.evaluate(() => {
      window.__ulgElementsLabApi.setTdksConfig({ orbitalPreset: 'd2', polMode: 2, fieldView: 0, modeMono: true, probeWavelengthNm: 440 });
      window.__ulgElementsLabApi.setCamera(0.32, 0.34, 3.05);
    });
    const tdksD2 = await page.evaluate(() => window.__ulgElementsLabApi.stepTdks3d(42));
    console.log('[tdks3d-au-5d2-circ]', JSON.stringify(tdksD2));
    assert.ok(tdksD2.scattEnergy > 0.1, `3D Maxwell-KS must produce real 3D scattered wave energy: ${tdksD2.scattEnergy}`);
    assert.ok(tdksD2.absorbedEnergy > 0.01, `3D Maxwell-KS must transfer energy into orbital lobes: ${tdksD2.absorbedEnergy}`);
    assert.ok(tdksD2.crossPolFraction > 0.02, `3D anisotropic orbital tensor must generate cross-polarized scattering: ${tdksD2.crossPolFraction}`);
    await saveShot(page, '12-tdks3d-au-5d2-cloverleaf');

    // Orbit to steep oblique 3D viewing angle (proves TRUE 3D volume, zero flat 2D quad edge!)
    await page.evaluate(() => window.__ulgElementsLabApi.setCamera(1.05, 0.58, 3.05));
    await page.waitForTimeout(120);
    await saveShot(page, '13-tdks3d-au-5d2-oblique-3d');

    // Test B: Geometry-Polarization Selection Rule Proof on 2p_y (m=0) dumbbell:
    //   E_y (parallel to dumbbell lobes) MUST couple/scatter/absorb stronger than E_z (perpendicular to dumbbell!)
    await page.evaluate(() => {
      window.__ulgElementsLabApi.setCamera(0.28, 0.22, 3.05);
      window.__ulgElementsLabApi.setTdksConfig({ orbitalPreset: 'p0', polMode: 0, fieldView: 0, modeMono: true, probeWavelengthNm: 440 });
    });
    const tdksP0Ey = await page.evaluate(() => window.__ulgElementsLabApi.stepTdks3d(42));
    await saveShot(page, '14-tdks3d-2p0-ey-parallel');

    await page.evaluate(() => {
      window.__ulgElementsLabApi.setTdksConfig({ orbitalPreset: 'p0', polMode: 1, fieldView: 0, modeMono: true, probeWavelengthNm: 440 });
    });
    const tdksP0Ez = await page.evaluate(() => window.__ulgElementsLabApi.stepTdks3d(42));
    console.log('[tdks3d-2p0-ey-vs-ez]', JSON.stringify({
      eyScatt: tdksP0Ey.scattEnergy,
      ezScatt: tdksP0Ez.scattEnergy,
      eyAbs: tdksP0Ey.absorbedEnergy,
      ezAbs: tdksP0Ez.absorbedEnergy,
      eyAniso: tdksP0Ey.angularAnisotropy,
      ezAniso: tdksP0Ez.angularAnisotropy
    }));
    assert.ok(
      tdksP0Ey.absorbedEnergy > tdksP0Ez.absorbedEnergy * 1.15 && tdksP0Ey.scattEnergy > tdksP0Ez.scattEnergy * 1.15,
      `E_y parallel to 2p_y dumbbell must couple/scatter stronger than perpendicular E_z: Ey(scatt=${tdksP0Ey.scattEnergy}, abs=${tdksP0Ey.absorbedEnergy}) vs Ez(scatt=${tdksP0Ez.scattEnergy}, abs=${tdksP0Ez.absorbedEnergy})`
    );
    await saveShot(page, '15-tdks3d-2p0-ez-perp');

    // 11. Mobile Portrait (390x844) IUPAC Periodic Table Modal & Accordion Check!
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.click('#mobile-open-pt-btn');
    await page.waitForTimeout(200);
    const mobCheck = await page.evaluate(() => ({
      modalOpen: document.getElementById('pt-modal').classList.contains('open'),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    }));
    console.log('[mobile-iupac-modal]', JSON.stringify(mobCheck));
    assert.equal(mobCheck.modalOpen, true);
    assert.ok(mobCheck.scrollWidth <= mobCheck.innerWidth + 2, `Mobile overflow: ${mobCheck.scrollWidth} > ${mobCheck.innerWidth}`);
    await saveShot(page, '11-mobile-iupac-periodic-table');
    await page.click('#pt-modal-close');

    assert.deepEqual(pageErrors, [], `unexpected page errors: ${pageErrors.join('; ')}`);
    assert.deepEqual(gpuErrors, [], `unexpected WebGPU errors: ${gpuErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});
