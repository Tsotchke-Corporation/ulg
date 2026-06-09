// SPH phase demo UI: a full-viewport overlay with the MLS-MPM-style particle renderer, a
// retro-terminal control panel (six wall temperatures + reduced-resolution controls), and live
// status rows. Also exposes a headless API on window.__ulgDemo for e2e/status checks.

import { createSphPhaseScene } from './sphPhaseScene.js';
import { createSphPhaseDemo, particleColors, phaseMassSummary } from '../runtime/sphPhaseDemo.js';
import { computeThermodynamicPreflight, createSphPhaseScenario } from '../runtime/thermoPreflight.js';
import { sphTotals } from '../runtime/sph/sphConservation.js';

const WALL_FACES = ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'];
const ICE_TEMP_K = 233.15;
const IRON_TEMP_K = 1850;

function fmt(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e9) return n.toExponential(2);
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(digits)}k`;
  return n.toFixed(digits);
}

/**
 * Headless demo API attached to window.__ulgDemo (no rendering).
 */
export function createSphPhaseDemoApi() {
  let driver = null;
  const ensure = (options) => {
    if (!driver) driver = createSphPhaseDemo(options);
    return driver;
  };
  return {
    runSphPhaseDemoPreflight(options = {}) {
      return computeThermodynamicPreflight(createSphPhaseScenario(options));
    },
    runSphPhaseDemoStep(options = {}) {
      const d = ensure(options);
      d.step();
      return { totals: d.totals(), phaseMassSummary: d.phaseMassSummary() };
    },
    runSphPhaseDemo(options = {}) {
      const d = createSphPhaseDemo(options);
      const preflight = d.preflight();
      const steps = options.steps ?? 0;
      for (let i = 0; i < steps; i += 1) d.step();
      return {
        preflight,
        counts: d.demo.counts,
        totals: d.totals(),
        phaseMassSummary: d.phaseMassSummary(),
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false
      };
    },
    resetSphPhaseDemo() {
      driver = null;
    }
  };
}

function buildOverlayShell() {
  const overlay = document.createElement('div');
  overlay.id = 'sph-phase-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:50;background:#04070a;display:flex;color:#bfe9d8;font-family:ui-monospace,monospace;';
  overlay.innerHTML = `
    <div id="sph-scene" style="flex:1;min-width:0;position:relative;"></div>
    <aside style="width:340px;border-left:1px solid #14342c;padding:14px;overflow:auto;background:#050b0e;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong style="color:#75f7b4;">SPH PHASE — ice on molten iron</strong>
        <button id="sph-close" type="button" style="background:#14342c;color:#bfe9d8;border:0;padding:4px 8px;cursor:pointer;">close</button>
      </div>
      <p style="opacity:.6;font-size:11px;line-height:1.4;">CPU reference, reduced resolution. Colour is closure-backed, not demo-tuned: incandescent glow from the Planck radiation closure (first-principles from temperature); intrinsic colour from the optical closure (Drude reflectance for iron, Beer–Lambert O–H absorption for water/ice, Rayleigh for air). Heat capacity is first-principles too (equipartition air, Debye iron). Closures are derived, not yet validated against measured optics/EOS. Multi-material EOS / wall heat flux / conduction are P5.</p>
      <div style="margin:8px 0;">
        <button id="sph-preflight" type="button">Preflight</button>
        <button id="sph-play" type="button">Play</button>
        <button id="sph-step" type="button">Step</button>
        <button id="sph-reset" type="button">Reset</button>
      </div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">wall temperatures (K)</div>
      <div id="sph-walls" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:4px 0;"></div>
      <div class="terminal-head"><span>status</span></div>
      <pre id="sph-status" style="white-space:pre-wrap;font-size:12px;line-height:1.5;margin:6px 0;"></pre>
    </aside>
  `;
  return overlay;
}

/**
 * Open the visual SPH phase demo overlay. Returns a close handle.
 */
export function mountSphPhaseDemoOverlay() {
  const overlay = buildOverlayShell();
  document.body.appendChild(overlay);

  const wallsEl = overlay.querySelector('#sph-walls');
  const wallInputs = {};
  for (const face of WALL_FACES) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = face;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(ICE_TEMP_K);
    input.step = '5';
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    wallsEl.appendChild(wrap);
    wallInputs[face] = input;
  }

  const statusEl = overlay.querySelector('#sph-status');
  const sceneContainer = overlay.querySelector('#sph-scene');

  function scenarioFromControls() {
    const wallFaces = {};
    for (const face of WALL_FACES) wallFaces[face] = Number(wallInputs[face].value) || ICE_TEMP_K;
    return createSphPhaseScenario({ wallFaces });
  }

  let driver = createSphPhaseDemo({ scenario: scenarioFromControls() });
  const scene = createSphPhaseScene(sceneContainer, { boxEdgeM: driver.demo.box.edgeM });

  function syncParticles() {
    const colors = particleColors(driver.demo);
    const n = driver.demo.state.particles.length;
    const positionsM = new Float32Array(n * 3);
    const colorsRgb = new Float32Array(n * 3);
    driver.demo.state.particles.forEach((p, i) => {
      positionsM[i * 3] = p.x[0];
      positionsM[i * 3 + 1] = p.x[1];
      positionsM[i * 3 + 2] = p.x[2];
      colorsRgb[i * 3] = colors[i].rgb[0];
      colorsRgb[i * 3 + 1] = colors[i].rgb[1];
      colorsRgb[i * 3 + 2] = colors[i].rgb[2];
    });
    scene.setParticles({ positionsM, colorsRgb });
  }

  function renderStatus() {
    const pre = driver.preflight();
    const totals = sphTotals(driver.demo.state);
    const phase = phaseMassSummary(driver.demo);
    const waterPhases = phase.byMaterialPhase.h2o || {};
    const ledger = pre.energyBudget.wallLedger.map((w) => `  ${w.faceId} ${w.role} ${fmt(w.heatJ)}J`).join('\n');
    const water = Object.entries(waterPhases).map(([ph, m]) => `${ph} ${fmt(m)}kg`).join('  ');
    statusEl.textContent = [
      `preflight        : ${pre.status} (feasible=${pre.feasibility.feasible})`,
      `final phase      : H2O ${pre.feasibility.finalH2oPhase} / Fe ${pre.feasibility.finalFePhase}`,
      `heat to walls    : ${fmt(pre.energyBudget.heatExportedToWallsJ)} J`,
      `masses (kg)      : Fe ${fmt(pre.masses.ironMassKg)}  ice ${fmt(pre.masses.iceMassKg)}  air ${fmt(pre.masses.airMassKg)}`,
      `particles        : Fe ${driver.demo.counts.fe}  H2O ${driver.demo.counts.h2o}  total ${driver.demo.counts.total}`,
      `molecules/macro  : H2O ${fmt(pre.particleResolution.h2o.entitiesPerMacroParticle)}  Fe ${fmt(pre.particleResolution.fe.entitiesPerMacroParticle)}`,
      `water by phase   : ${water || '—'}`,
      `iron solid frac  : ${fmt(phase.ironSolidFraction, 3)}`,
      `total energy     : ${fmt(totals.totalEnergyJ)} J`,
      `momentum |p|     : ${fmt(totals.momentumMagnitudeKgMPerS)} kg·m/s`,
      `per-wall ledger  :\n${ledger}`,
      ``,
      `validation       : scientific=false sph=false phase=false (evidence-only)`
    ].join('\n');
  }

  let playing = false;
  function tick() {
    if (!playing) return;
    for (let i = 0; i < 2; i += 1) driver.step();
    syncParticles();
    renderStatus();
    requestAnimationFrame(tick);
  }

  overlay.querySelector('#sph-preflight').addEventListener('click', renderStatus);
  overlay.querySelector('#sph-step').addEventListener('click', () => { driver.step(); syncParticles(); renderStatus(); });
  overlay.querySelector('#sph-play').addEventListener('click', (e) => {
    playing = !playing;
    e.target.textContent = playing ? 'Pause' : 'Play';
    if (playing) tick();
  });
  overlay.querySelector('#sph-reset').addEventListener('click', () => {
    playing = false;
    overlay.querySelector('#sph-play').textContent = 'Play';
    driver = createSphPhaseDemo({ scenario: scenarioFromControls() });
    syncParticles();
    renderStatus();
  });

  function close() {
    playing = false;
    scene.dispose();
    overlay.remove();
  }
  overlay.querySelector('#sph-close').addEventListener('click', close);

  syncParticles();
  renderStatus();
  return { close, overlay };
}
