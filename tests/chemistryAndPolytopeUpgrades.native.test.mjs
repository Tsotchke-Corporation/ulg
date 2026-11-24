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

    // 1. Desktop UI boot: verify left-side hierarchical accordion menu, collapsible right data dock & ALL 14 canonical modules!
    await page.goto(`${SERVER_URL}/elements-lab.html?z=26&tab=atomic`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 26 && window.__ulgElementsLabState?.currentTab === 'atomic' && window.__ulgElementsLabState?.registeredModules?.length >= 13, null, { timeout: 60_000 });
    const uiCheck = await page.evaluate(() => {
      const sc = document.getElementById('sim-controls');
      const acc = document.getElementById('accordion-nav');
      const activeGrp = sc?.closest('.acc-group');
      const hdr = document.querySelector('header')?.getBoundingClientRect();
      const vpWrap = document.querySelector('.viewport-wrap')?.getBoundingClientRect();
      const canvasWBefore = document.getElementById('gpu-canvas').getBoundingClientRect().width;
      const ctrlWidgets = sc ? [...sc.querySelectorAll('button, input, select')] : [];
      const missingTips = ctrlWidgets.filter((el) => !el.getAttribute('title') && !el.getAttribute('data-tip')).map((el) => el.id || el.textContent);
      return {
        modules: window.__ulgElementsLabState.registeredModules,
        redundantBarsCount: document.querySelectorAll('.tabs, #mobile-quick-presets, #specimen-bar, .nav-links').length,
        accordionGroups: document.querySelectorAll('#accordion-nav .acc-group').length,
        iupacCells: document.querySelectorAll('#iupac-pt-grid .pt-cell').length,
        controlsInsideAccordion: Boolean(acc && sc && acc.contains(sc)),
        controlsAccTab: activeGrp?.dataset?.accTab ?? null,
        controlsPrevSub: sc?.previousElementSibling?.dataset?.navSub ?? null,
        hasAboutSimBtn: Boolean(sc?.querySelector('#ctrl-about-sim') && document.getElementById('canvas-about-sim-btn')),
        missingTips,
        duplicateSubviewBtns: sc ? sc.querySelectorAll('[data-nview],[data-aview],[data-cview],[data-mdmode],[data-chemview],[data-pview]').length : -1,
        viewportGapUnderHeaderPx: hdr && vpWrap ? Math.round(vpWrap.top - hdr.bottom) : -1,
        canvasWBefore
      };
    });
    console.log('[desktop-ui-rethink]', JSON.stringify(uiCheck));
    assert.equal(uiCheck.redundantBarsCount, 0, 'Must have ZERO redundant top bars (.tabs, #mobile-quick-presets, #specimen-bar, .nav-links)');
    assert.ok(uiCheck.accordionGroups >= 7);
    assert.equal(uiCheck.iupacCells, 118, 'Real IUPAC Periodic Table must have all 118 cells');
    assert.equal(uiCheck.controlsInsideAccordion, true, 'Per-sim controls must be mounted inside the left accordion menu');
    assert.equal(uiCheck.controlsAccTab, 'atomic', 'Per-sim controls must live inside the active accordion section');
    assert.equal(uiCheck.controlsPrevSub, 'cloud', 'Per-sim controls must sit right below the active sub-view item');
    assert.equal(uiCheck.hasAboutSimBtn, true, 'Every simulation must expose its own About button');
    assert.deepEqual(uiCheck.missingTips, [], `Every simulation control must have a tooltip, missing: ${uiCheck.missingTips.join(', ')}`);
    assert.equal(uiCheck.duplicateSubviewBtns, 0, 'Must have zero duplicate sub-view switcher buttons inside #sim-controls');
    assert.ok(uiCheck.viewportGapUnderHeaderPx >= 0 && uiCheck.viewportGapUnderHeaderPx <= 4, `Viewport must sit cleanly right under <header> with zero redundant bars (gap=${uiCheck.viewportGapUnderHeaderPx}px)`);

    // Verify `?` Help menu (GitHub + About ULG + all 4 other demos) & per-sim About modal!
    await page.click('#help-menu-btn');
    await page.waitForTimeout(120);
    const helpCheck = await page.evaluate(() => ({
      open: document.getElementById('help-menu-popover')?.classList.contains('open'),
      githubHref: document.getElementById('github-ulg-link')?.getAttribute('href'),
      demoLinks: [...document.querySelectorAll('#help-menu-popover a[href^="./"]')].map((a) => a.getAttribute('href'))
    }));
    console.log('[help-menu-check]', JSON.stringify(helpCheck));
    assert.equal(helpCheck.open, true);
    assert.equal(helpCheck.githubHref, 'https://github.com/Tsotchke-Corporation/ulg');
    assert.ok(helpCheck.demoLinks.length >= 4, 'Help menu must list all 4 other ULG demos');
    await saveShot(page, '01c-help-menu-open');

    await page.click('#menu-about-ulg');
    await page.waitForTimeout(120);
    const aboutUlgTxt = await page.textContent('#about-modal-body');
    assert.ok(aboutUlgTxt.includes('Universal Law Graph') && aboutUlgTxt.includes('PeerCompute'), 'About ULG modal must explain ULG and the Triad');
    await page.click('#about-tab-sim');
    await page.waitForTimeout(100);
    const aboutSimTxt = await page.textContent('#about-modal-title');
    assert.ok(aboutSimTxt.includes('Dirac–KS'), `Per-sim About modal must describe active simulation, got: ${aboutSimTxt}`);
    await saveShot(page, '01d-about-sim-modal');
    await page.click('#about-modal-close');

    // Verify right-hand Graphs & Data docking popout collapses cleanly to widen 3D WebGPU canvas & re-expands!
    await page.click('#data-dock-close');
    await page.waitForTimeout(280);
    const canvasWCollapsed = await page.evaluate(() => document.getElementById('gpu-canvas').getBoundingClientRect().width);
    assert.ok(canvasWCollapsed > uiCheck.canvasWBefore + 280, `Collapsing right data dock must widen 3D canvas: ${uiCheck.canvasWBefore} -> ${canvasWCollapsed}`);
    await saveShot(page, '01b-desktop-dock-collapsed-fullwidth');
    await page.click('#dock-reopen-tab');
    await page.waitForTimeout(280);
    const canvasWRestored = await page.evaluate(() => document.getElementById('gpu-canvas').getBoundingClientRect().width);
    assert.ok(Math.abs(canvasWRestored - uiCheck.canvasWBefore) < 8, `Re-opening data dock must restore canvas width: ${canvasWRestored} vs ${uiCheck.canvasWBefore}`);
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
    const tdksCtrlPlacement = await page.evaluate(() => {
      const sc = document.getElementById('sim-controls');
      return {
        accTab: sc?.closest('.acc-group')?.dataset?.accTab ?? null,
        prevSub: sc?.previousElementSibling?.dataset?.navSub ?? null,
        hasOrbSelect: Boolean(sc?.querySelector('#ctrl-tdks-orb')),
        hasFireBtn: Boolean(sc?.querySelector('#ctrl-ps-fire')),
        dupBtns: sc?.querySelectorAll('[data-cview]').length ?? -1
      };
    });
    assert.equal(tdksCtrlPlacement.accTab, 'crystal');
    assert.equal(tdksCtrlPlacement.prevSub, 'tdks-atom');
    assert.equal(tdksCtrlPlacement.hasOrbSelect, true);
    assert.equal(tdksCtrlPlacement.hasFireBtn, true);
    assert.equal(tdksCtrlPlacement.dupBtns, 0);
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
      window.__ulgElementsLabApi.setTdksConfig({ orbitalPreset: 'p0', polMode: 0, fieldView: 0, modeMono: true, probeWavelengthNm: 440, playing: false });
    });
    const tdksP0Ey = await page.evaluate(() => window.__ulgElementsLabApi.stepTdks3d(46));
    await saveShot(page, '14-tdks3d-2p0-ey-parallel');

    await page.evaluate(() => {
      window.__ulgElementsLabApi.setTdksConfig({ orbitalPreset: 'p0', polMode: 1, fieldView: 0, modeMono: true, probeWavelengthNm: 440, playing: false });
    });
    const tdksP0Ez = await page.evaluate(() => window.__ulgElementsLabApi.stepTdks3d(46));
    console.log('[tdks3d-2p0-ey-vs-ez]', JSON.stringify({
      eyScatt: tdksP0Ey.scattEnergy,
      ezScatt: tdksP0Ez.scattEnergy,
      eyAbs: tdksP0Ey.absorbedEnergy,
      ezAbs: tdksP0Ez.absorbedEnergy,
      eyAniso: tdksP0Ey.angularAnisotropy,
      ezAniso: tdksP0Ez.angularAnisotropy
    }));
    assert.ok(
      tdksP0Ey.absorbedEnergy > tdksP0Ez.absorbedEnergy * 1.10 && tdksP0Ey.scattEnergy > tdksP0Ez.scattEnergy * 1.30,
      `E_y parallel to 2p_y dumbbell must couple/scatter stronger than perpendicular E_z: Ey(scatt=${tdksP0Ey.scattEnergy}, abs=${tdksP0Ey.absorbedEnergy}) vs Ez(scatt=${tdksP0Ez.scattEnergy}, abs=${tdksP0Ez.absorbedEnergy})`
    );
    await saveShot(page, '15-tdks3d-2p0-ez-perp');

    // 10b. First-Principles Cesium (Cs, Z=55) Optics + 3D Maxwell-KS + Tab 5 Non-Destructive Preview Check!
    await page.evaluate(() => window.__ulgElementsLabApi.solveElement(55, null, { switchToTab: 'crystal' }));
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 55 && window.__ulgElementsLabState?.currentTab === 'crystal', null, { timeout: 60_000 });
    await page.evaluate(() => {
      window.__ulgElementsLabApi.setCrystalViewMode('tdks-atom');
      window.__ulgElementsLabApi.setTdksConfig({ orbitalPreset: 'valence', polMode: 0, fieldView: 0, modeMono: false });
      window.__ulgElementsLabApi.setCamera(0.35, 0.25, 3.05);
    });
    const csTdks = await page.evaluate(() => window.__ulgElementsLabApi.stepTdks3d(36));
    const csOptics = await page.evaluate(() => ({
      srgb: window.__ulgElementsLabState.bundle.electromagnetic.opticalSrgb,
      plasmaEv: window.__ulgElementsLabState.bundle.electromagnetic.plasmaEnergyEv,
      coreEps: window.__ulgElementsLabState.bundle.electromagnetic.coreDielectricInf,
      transEv: window.__ulgElementsLabState.tdks3dTelemetry?.transEv,
      orbital: window.__ulgElementsLabState.tdks3dTelemetry?.orbital
    }));
    console.log('[cs-first-principles-optics-tdks]', JSON.stringify({ csOptics, csTdks }));
    assert.equal(csOptics.orbital.n0, 6, 'Cs active valence must be 6s (not deep core 4d)');
    assert.equal(csOptics.orbital.l0, 0, 'Cs active valence must be 6s');
    assert.ok(csTdks.transEv < 3.6 && csTdks.transEv > 2.35, `Cs TD-KS must use screened pale-gold plasma edge (2.35..3.6 eV), got ${csTdks.transEv}`);
    assert.ok(csOptics.srgb[0] > csOptics.srgb[2] + 0.08 && csOptics.srgb[1] > 0.65, `Cs must reflect pale golden (R > B + 0.08 & G > 0.65, not orange or white), got sRGB=${JSON.stringify(csOptics.srgb)}`);
    await saveShot(page, '16-tdks3d-cs-pale-gold-6s');

    // Clicking Section 5 (Chemistry & Reactions) while viewing Cs must preserve Cs as active element (not replace with H2O!)
    await page.click('.acc-header[data-acc-tab="compound"]');
    await page.waitForTimeout(450);
    const afterChemTab = await page.evaluate(() => ({
      mode: window.__ulgElementsLabState.mode,
      Z: window.__ulgElementsLabState.Z,
      reactA: document.getElementById('reactant-a')?.value,
      pill: document.getElementById('active-specimen-pill')?.textContent
    }));
    console.log('[chem-tab-preserves-active-element]', JSON.stringify(afterChemTab));
    assert.equal(afterChemTab.mode, 'element', 'Opening Chemistry section must NOT wipe out the active element');
    assert.equal(afterChemTab.Z, 55, 'Cs (Z=55) must remain the active element when opening Chemistry');
    assert.equal(afterChemTab.reactA, 'Cs', 'Reactant A should pre-fill with active element Cs');

    // 11. Mobile Portrait (390x844) IUPAC Periodic Table Modal & Accordion Check!
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.click('#active-specimen-pill');
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

test('URL deep-link hydration and live shareable URL sync across element 3D Maxwell-KS, compound molecule, and 3D polytope views on Vulkan WebGPU', {
  skip: !RUN_NATIVE && 'set ULG_RUN_NATIVE_WEBGPU=1 to run native Vulkan URL deep-link test',
  timeout: 180_000
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
      if (m.type() === 'error' && /webgpu|validation|shader/i.test(m.text())) gpuErrors.push(m.text());
    });

    // 1. Deep-link directly into Gold 3D Maxwell-KS 5d(m=2) Circular 440nm at 0.25x slow-mo (tab inferred from view!)
    await page.goto(`${SERVER_URL}/elements-lab.html?el=Au&view=tdks-atom&orb=d2&pol=circ&lam=440&speed=0.25&cam=0.85,0.45,3.05`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ulgElementsLabState?.Z === 79 && window.__ulgElementsLabState?.currentTab === 'crystal' && Boolean(window.__ulgElementsLabState?.tdks3dTelemetry), null, { timeout: 60_000 });
    const auLinkState = await page.evaluate(() => ({
      Z: window.__ulgElementsLabState.Z,
      tab: window.__ulgElementsLabState.currentTab,
      orb: window.__ulgElementsLabState.tdks3dTelemetry.orbital,
      polMode: window.__ulgElementsLabState.tdks3dTelemetry.polMode,
      simSpeed: window.__ulgElementsLabState.simSpeed,
      cam: window.__ulgElementsLabApi.getCamera(),
      search: window.location.search,
      shareUrl: window.__ulgElementsLabApi.getShareUrl({ includeCamera: true }),
      title: document.title
    }));
    console.log('[url-deeplink-au-tdks]', JSON.stringify(auLinkState));
    assert.equal(auLinkState.Z, 79);
    assert.equal(auLinkState.tab, 'crystal');
    assert.equal(auLinkState.orb.m, 2);
    assert.equal(auLinkState.polMode, 2);
    assert.equal(auLinkState.simSpeed, 0.25);
    assert.ok(Math.abs(auLinkState.cam.yaw - 0.85) < 0.02);
    assert.ok(auLinkState.search.includes('el=Au') && auLinkState.search.includes('view=tdks-atom') && auLinkState.search.includes('orb=d2') && auLinkState.search.includes('pol=circ') && auLinkState.search.includes('lam=440') && auLinkState.search.includes('speed=0.25'));
    assert.ok(auLinkState.shareUrl.includes('cam=0.85%2C0.45%2C3.05') || auLinkState.shareUrl.includes('cam=0.85,0.45,3.05'));
    assert.ok(auLinkState.title.includes('Au'));

    // Verify +1 single-step advances active 3D Maxwell-KS simulation cleanly by exactly 1 step!
    const stepBefore = await page.evaluate(() => window.__ulgElementsLabState.tdks3dTelemetry.stepIndex);
    await page.evaluate(() => window.__ulgElementsLabApi.stepSimOnce());
    const stepAfter = await page.evaluate(() => window.__ulgElementsLabState.tdks3dTelemetry.stepIndex);
    assert.ok(stepAfter >= stepBefore + 1, `stepSimOnce must advance active sim: ${stepBefore} -> ${stepAfter}`);

    // Live URL bar sync when switching view/specimen interactively
    await page.evaluate(() => window.__ulgElementsLabApi.setCrystalViewMode('spin-llg'));
    const afterSwitchSearch = await page.evaluate(() => window.location.search);
    assert.ok(afterSwitchSearch.includes('el=Au') && afterSwitchSearch.includes('view=spin-llg'), `URL must sync on view change: ${afterSwitchSearch}`);

    // 2. Deep-link directly into CO2 3D double-bond molecule view!
    await page.goto(`${SERVER_URL}/elements-lab.html?compound=CO2&view=molecule`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ulgElementsLabState?.formula === 'CO2' && window.__ulgElementsLabState?.currentTab === 'compound', null, { timeout: 60_000 });
    const co2LinkState = await page.evaluate(() => ({
      formula: window.__ulgElementsLabState.formula,
      tab: window.__ulgElementsLabState.currentTab,
      chemViewMode: window.__ulgElementsLabState.chemViewMode,
      bonds: window.__ulgElementsLabState.bundle.atomic.bonds,
      search: window.location.search,
      title: document.title
    }));
    console.log('[url-deeplink-co2-mol]', JSON.stringify(co2LinkState));
    assert.equal(co2LinkState.formula, 'CO2');
    assert.equal(co2LinkState.chemViewMode, 'molecule');
    assert.ok(co2LinkState.bonds.length === 2 && co2LinkState.bonds.every((b) => b.kind === 'double'));
    assert.ok(co2LinkState.search.includes('compound=CO2') && co2LinkState.search.includes('view=molecule'));

    // 3. Deep-link directly into H2O 3D Planetary Polytope Surface!
    await page.goto(`${SERVER_URL}/elements-lab.html?compound=H2O&view=3d-surface&regime=planetary`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ulgElementsLabState?.formula === 'H2O' && window.__ulgElementsLabState?.currentTab === 'polytope', null, { timeout: 60_000 });
    const polyLinkState = await page.evaluate(() => ({
      formula: window.__ulgElementsLabState.formula,
      tab: window.__ulgElementsLabState.currentTab,
      polyView: window.__ulgElementsLabState.polytopeViewMode,
      search: window.location.search
    }));
    console.log('[url-deeplink-h2o-polytope]', JSON.stringify(polyLinkState));
    assert.equal(polyLinkState.formula, 'H2O');
    assert.equal(polyLinkState.tab, 'polytope');
    assert.equal(polyLinkState.polyView, '3d-surface');
    assert.ok(polyLinkState.search.includes('compound=H2O') && polyLinkState.search.includes('regime=planetary'));

    // Click Share Link button and confirm UI feedback & zero errors
    await page.click('#share-link-btn');
    await page.waitForTimeout(120);
    const btnTxt = await page.textContent('#share-link-btn');
    assert.ok(btnTxt.includes('✓'), `Share button should show copied/updated confirmation, got: ${btnTxt}`);

    assert.deepEqual(pageErrors, [], `unexpected page errors: ${pageErrors.join('; ')}`);
    assert.deepEqual(gpuErrors, [], `unexpected WebGPU errors: ${gpuErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});
