// SPH phase demo UI: a full-viewport overlay with the MLS-MPM-style particle renderer, a
// retro-terminal control panel (six wall temperatures + reduced-resolution controls), and live
// status rows. Also exposes a headless API on window.__ulgDemo for e2e/status checks.

import { createSphPhaseScene } from './sphPhaseScene.js';
import { createSphPhaseDemo, particleColors, particleRenderMaterials, phaseMassSummary, surfaceEmissive } from '../runtime/sphPhaseDemo.js';
import { computeThermodynamicPreflight, createSphPhaseScenario } from '../runtime/thermoPreflight.js';
import { sphTotals } from '../runtime/sph/sphConservation.js';

const WALL_FACES = ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'];
const ICE_TEMP_K = 233.15;
const IRON_TEMP_K = 1850;
// Default wall reservoir temperature: 50 °F = 283.15 K (a mild room — melts ice, doesn't boil it).
const WALL_DEFAULT_K = 283.15;
// Default starting elevations (m) of each block's bottom face: ice on the floor, iron a clear gap
// above it so the drop is visible. Both editable in the panel.
const ICE_BASE_DEFAULT_M = 0;
const IRON_BASE_DEFAULT_M = 2.5;
// Snug simulation box sized to the content (1 m base block + drop block + steam headroom) instead
// of the old 10 m domain, so the box wireframe frames the sim and the marching-cubes field spends
// its resolution where the material actually is.
const DEMO_BOX_EDGE_M = 5;
// Selectable block materials — the elements/compounds we have full thermodynamic closures for
// (phases, latent heats, EOS). Defaults reproduce the molten-iron-on-ice scenario.
const MATERIAL_OPTIONS = [
  { key: 'fe', label: 'Iron (Fe)' },
  { key: 'h2o', label: 'Water (H₂O)' }
];

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
  // The 3D scene fills the whole overlay; the control panel is a slide-in drawer over it, so the
  // scene stays full-viewport (good for touch orbit) and the menu collapses on small screens.
  overlay.style.cssText = 'position:fixed;inset:0;z-index:50;background:#04070a;color:#bfe9d8;font-family:ui-monospace,monospace;';
  overlay.innerHTML = `
    <style>
      #sph-phase-overlay button { background:#14342c;color:#bfe9d8;border:1px solid #1d8b6d;border-radius:6px;padding:8px 12px;margin:0 4px 4px 0;font:600 13px ui-monospace,monospace;cursor:pointer;min-height:40px;touch-action:manipulation; }
      #sph-phase-overlay button:active { background:#1d8b6d;color:#04070a; }
      #sph-phase-overlay input { min-height:36px;font-size:16px;box-sizing:border-box; }
      #sph-panel { transition:transform .25s ease; }
      #sph-panel.collapsed { transform:translateX(110%); }
      @media (max-width:700px) { #sph-panel { width:min(340px,92vw); } #sph-status { font-size:13px; } }
    </style>
    <div id="sph-scene" style="position:absolute;inset:0;"></div>
    <button id="sph-toggle" type="button" aria-label="Toggle controls" style="position:absolute;top:12px;left:12px;z-index:60;">☰ menu</button>
    <aside id="sph-panel" style="position:absolute;top:0;right:0;height:100%;width:min(360px,92vw);box-sizing:border-box;border-left:1px solid #14342c;padding:14px;padding-top:56px;overflow:auto;-webkit-overflow-scrolling:touch;background:rgba(5,11,14,0.96);z-index:55;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <strong style="color:#75f7b4;">SPH PHASE — molten iron on ice</strong>
        <button id="sph-close" type="button">close</button>
      </div>
      <p style="opacity:.6;font-size:11px;line-height:1.4;">CPU reference, reduced resolution. Colour is closure-backed, not demo-tuned: incandescent glow from the Planck radiation closure (first-principles from temperature); intrinsic colour from the optical closure (Drude reflectance for iron, Beer–Lambert O–H absorption for water/ice, Rayleigh for air). Heat capacity is first-principles too (equipartition air, Debye iron). Closures are derived, not yet validated against measured optics/EOS. Multi-material EOS / wall heat flux / conduction are P5.</p>
      <div style="margin:8px 0;display:flex;flex-wrap:wrap;">
        <button id="sph-preflight" type="button">Preflight</button>
        <button id="sph-play" type="button">Play</button>
        <button id="sph-step" type="button">Step</button>
        <button id="sph-reset" type="button">Reset</button>
      </div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">wall temperatures (K)</div>
      <div id="sph-walls" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">materials — apply with Reset</div>
      <div id="sph-elements" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">initial block height (m, bottom face) — apply with Reset</div>
      <div id="sph-heights" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
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
    input.value = String(WALL_DEFAULT_K);
    input.step = '5';
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    wallsEl.appendChild(wrap);
    wallInputs[face] = input;
  }

  const heightsEl = overlay.querySelector('#sph-heights');
  const heightInputs = {};
  for (const [key, label, value] of [['ice', 'ice base', ICE_BASE_DEFAULT_M], ['iron', 'iron base', IRON_BASE_DEFAULT_M]]) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.step = '0.25';
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    heightsEl.appendChild(wrap);
    heightInputs[key] = input;
  }

  const elementsEl = overlay.querySelector('#sph-elements');
  const elementSelects = {};
  for (const [role, label, def] of [['drop', 'drop block', 'fe'], ['base', 'base block', 'h2o']]) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = label;
    const select = document.createElement('select');
    select.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    for (const opt of MATERIAL_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.key;
      o.textContent = opt.label;
      if (opt.key === def) o.selected = true;
      select.appendChild(o);
    }
    wrap.appendChild(select);
    elementsEl.appendChild(wrap);
    elementSelects[role] = select;
  }

  const statusEl = overlay.querySelector('#sph-status');
  const sceneContainer = overlay.querySelector('#sph-scene');

  function scenarioFromControls() {
    const wallFaces = {};
    for (const face of WALL_FACES) wallFaces[face] = Number(wallInputs[face].value) || WALL_DEFAULT_K;
    return createSphPhaseScenario({ wallFaces, boxEdgeM: DEMO_BOX_EDGE_M });
  }

  function driverOptionsFromControls() {
    const iceBaseHeightM = Number(heightInputs.ice.value);
    const ironBaseHeightM = Number(heightInputs.iron.value);
    return {
      scenario: scenarioFromControls(),
      dropMaterial: elementSelects.drop.value,
      baseMaterial: elementSelects.base.value,
      iceBaseHeightM: Number.isFinite(iceBaseHeightM) ? iceBaseHeightM : ICE_BASE_DEFAULT_M,
      ironBaseHeightM: Number.isFinite(ironBaseHeightM) ? ironBaseHeightM : IRON_BASE_DEFAULT_M
    };
  }

  let driver = createSphPhaseDemo(driverOptionsFromControls());
  const scene = createSphPhaseScene(sceneContainer, { boxEdgeM: driver.demo.box.edgeM });
  overlay.__sphScene = scene;

  function syncParticles() {
    const colors = particleColors(driver.demo);
    const renderMaterials = particleRenderMaterials(driver.demo);
    const n = driver.demo.state.particles.length;
    const positionsM = new Float32Array(n * 3);
    const colorsRgb = new Float32Array(n * 3);
    const materials = new Array(n);
    driver.demo.state.particles.forEach((p, i) => {
      positionsM[i * 3] = p.x[0];
      positionsM[i * 3 + 1] = p.x[1];
      positionsM[i * 3 + 2] = p.x[2];
      colorsRgb[i * 3] = colors[i].rgb[0];
      colorsRgb[i * 3 + 1] = colors[i].rgb[1];
      colorsRgb[i * 3 + 2] = colors[i].rgb[2];
      materials[i] = renderMaterials[i];
    });
    scene.setParticles({ positionsM, colorsRgb, materials, emissiveByMaterial: surfaceEmissive(driver.demo) });
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
      `particles        : ${driver.demo.dropMaterial} ${driver.demo.counts.drop}  ${driver.demo.baseMaterial} ${driver.demo.counts.base}  total ${driver.demo.counts.total}`,
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
    driver.step();
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
    driver = createSphPhaseDemo(driverOptionsFromControls());
    syncParticles();
    renderStatus();
  });

  // Collapsible control drawer. Start collapsed on small/portrait screens so the scene is the
  // first thing visible; the toggle button reveals it.
  const panel = overlay.querySelector('#sph-panel');
  const toggle = overlay.querySelector('#sph-toggle');
  let collapsed = window.innerWidth < 700;
  function applyCollapsed() {
    panel.classList.toggle('collapsed', collapsed);
    toggle.textContent = collapsed ? '☰ menu' : '✕ hide';
    toggle.setAttribute('aria-expanded', String(!collapsed));
  }
  toggle.addEventListener('click', () => { collapsed = !collapsed; applyCollapsed(); });
  applyCollapsed();

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
