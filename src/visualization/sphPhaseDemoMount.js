// SPH phase demo UI: a full-viewport overlay with the MLS-MPM-style particle renderer, a
// retro-terminal control panel (six wall temperatures + reduced-resolution controls), and live
// status rows. Also exposes a headless API on window.__ulgDemo for e2e/status checks.

import { createSphPhaseScene } from './sphPhaseScene.js';
import { ELEMENT_MATERIAL_OPTIONS, MATERIAL_OPTIONS } from './sphMaterialOptions.js';
import { createSphPhaseDemo, particleColors, particleRenderDescriptors, phaseMassSummary, surfaceEmissive } from '../runtime/sphPhaseDemo.js';
import { createSphPhaseScenario } from '../runtime/thermoPreflight.js';
import { sphTotals } from '../runtime/sph/sphConservation.js';
import { buildMlsMpmGpuParticleBuffers, buildSphGpuParticleBuffers } from '../runtime/sph/sphGpuBuffers.js';

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
// Default per-axis container dimensions (m). Cubic by default; each axis editable in the panel.
const BOX_DIM_DEFAULTS_M = { x: 5, y: 5, z: 5 };
// Default particles per block edge: an N-edge block holds N³ particles. Drop block is denser-looking
// at a smaller edge; base block fills a larger footprint.
const DROP_PARTICLE_EDGE_DEFAULT = 3;
const BASE_PARTICLE_EDGE_DEFAULT = 5;
// Default isosurface blob-size multiplier (1 = the auto estimate from particle spacing). Decoupled
// from container size so resizing the box doesn't change how big the rendered blobs look.
const BLOB_SCALE_DEFAULT = 1;
// Default initial temperatures (K): hot drop block (molten iron above its 1811 K liquidus) and cold
// base block (ice at −40 °F). Editable in the panel.
const DROP_TEMP_DEFAULT_K = 1850;
const BASE_TEMP_DEFAULT_K = 233.15;
const RESIDENT_STEPS_PER_SCHEDULE = 2;

function fmt(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e9) return n.toExponential(2);
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(digits)}k`;
  return n.toFixed(digits);
}

function formatMaterialPhaseMasses(byMaterialPhase = {}) {
  return Object.entries(byMaterialPhase)
    .map(([material, phases]) => {
      const phaseText = Object.entries(phases)
        .map(([phase, massKg]) => `${phase} ${fmt(massKg)}kg`)
        .join('/');
      return `${material}:${phaseText}`;
    })
    .join('  ');
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
      return createSphPhaseDemo(options).preflight();
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
      #sph-phase-overlay input, #sph-phase-overlay select { min-height:36px;font-size:16px;box-sizing:border-box; }
      #sph-phase-overlay select { width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c; }
      .sph-material-row { display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px;align-items:center; }
      .sph-picker-button { width:42px;padding:8px 0!important;margin:0!important; }
      .sph-element-picker-overlay { position:fixed;inset:0;z-index:90;background:rgba(2,6,8,.78);display:flex;align-items:center;justify-content:center;padding:14px; }
      .sph-element-picker { width:min(1080px,96vw);max-height:min(760px,92vh);box-sizing:border-box;border:1px solid #1d8b6d;background:#071114;color:#bfe9d8;padding:12px;box-shadow:0 18px 60px rgba(0,0,0,.58);display:flex;flex-direction:column;gap:10px; }
      .sph-picker-head { display:flex;justify-content:space-between;gap:10px;align-items:start; }
      .sph-picker-title { color:#75f7b4;font-weight:700;line-height:1.3; }
      .sph-picker-subtitle { color:#75c7f7;font-size:11px;opacity:.8;margin-top:3px; }
      .sph-picker-search { width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;padding:8px; }
      .sph-element-grid-scroll { overflow:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px; }
      .sph-element-grid { display:grid;grid-template-columns:repeat(18,48px);grid-auto-rows:48px;gap:4px;width:max-content;min-width:100%; }
      #sph-phase-overlay .sph-element-cell { position:relative;margin:0!important;padding:3px!important;min-height:48px;border-radius:4px;background:#0b181d;border-color:#245447;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px; }
      #sph-phase-overlay .sph-element-cell:hover { border-color:#75f7b4;background:#102823; }
      #sph-phase-overlay .sph-element-cell.selected { border-color:#fff2a8;box-shadow:0 0 0 2px rgba(255,242,168,.25); }
      .sph-element-number { font-size:9px;color:#75c7f7;line-height:1; }
      .sph-element-symbol { font-size:15px;font-weight:800;line-height:1; }
      .sph-element-name { font-size:8px;line-height:1;max-width:42px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.86; }
      .sph-cat-alkali { background:#182412!important; }
      .sph-cat-alkaline { background:#202512!important; }
      .sph-cat-transition { background:#112127!important; }
      .sph-cat-post-transition { background:#211c25!important; }
      .sph-cat-metalloid { background:#1e2418!important; }
      .sph-cat-nonmetal { background:#162225!important; }
      .sph-cat-halogen { background:#241b17!important; }
      .sph-cat-lanthanide { background:#1d1d2a!important; }
      .sph-cat-actinide { background:#251b22!important; }
      .sph-picker-legend { display:flex;flex-wrap:wrap;gap:5px;font-size:10px;color:#75c7f7; }
      .sph-legend-chip { border:1px solid #245447;padding:3px 6px;background:#0a1418; }
      #sph-panel { transition:transform .25s ease; }
      #sph-panel.collapsed { transform:translateX(110%); }
      @media (max-width:700px) { #sph-panel { width:min(340px,92vw); } #sph-status { font-size:13px; } .sph-element-grid { grid-template-columns:repeat(18,42px);grid-auto-rows:42px; } #sph-phase-overlay .sph-element-cell { min-height:42px; } .sph-element-name { display:none; } }
    </style>
    <div id="sph-scene" style="position:absolute;inset:0;"></div>
    <button id="sph-toggle" type="button" aria-label="Toggle controls" style="position:absolute;top:12px;left:12px;z-index:60;">☰ menu</button>
    <aside id="sph-panel" style="position:absolute;top:0;right:0;height:100%;width:min(360px,92vw);box-sizing:border-box;border-left:1px solid #14342c;padding:14px;padding-top:56px;overflow:auto;-webkit-overflow-scrolling:touch;background:rgba(5,11,14,0.96);z-index:55;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <strong style="color:#75f7b4;">SPH PHASE — two materials interacting</strong>
        <button id="sph-close" type="button">close</button>
      </div>
      <p style="opacity:.6;font-size:11px;line-height:1.4;">Strict first-principles mode. The demo will not run reference or reduced material constants as physics; missing condensed, liquid, optical, or product closures are reported as blockers.</p>
      <div style="margin:8px 0;display:flex;flex-wrap:wrap;">
        <button id="sph-preflight" type="button">Preflight</button>
        <button id="sph-play" type="button">Play</button>
        <button id="sph-step" type="button">Step</button>
        <button id="sph-reset" type="button">Reset</button>
      </div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">wall temperatures (K)</div>
      <div id="sph-walls" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">materials — auto-applies</div>
      <div id="sph-elements" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">initial temperature (K) — auto-applies</div>
      <div id="sph-temps" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">initial block height (m, bottom face) — auto-applies</div>
      <div id="sph-heights" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">container box size (m, X·Y·Z) — auto-applies</div>
      <div id="sph-box" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">particles per block edge (N → N³ particles) — auto-applies</div>
      <div id="sph-counts" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">isosurface blob size (× — independent of box) — live</div>
      <div id="sph-blob" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0;"></div>
      <div class="terminal-head"><span>status</span></div>
      <pre id="sph-status" style="white-space:pre-wrap;font-size:12px;line-height:1.5;margin:6px 0;"></pre>
    </aside>
  `;
  return overlay;
}

function categoryLabel(category) {
  return String(category || 'element').replace(/-/g, ' ');
}

function createPickerSpan(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function openElementPicker({ overlay, select, roleLabel }) {
  overlay.querySelector('.sph-element-picker-overlay')?.remove();

  const pickerOverlay = document.createElement('div');
  pickerOverlay.className = 'sph-element-picker-overlay';

  const picker = document.createElement('section');
  picker.className = 'sph-element-picker';
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-modal', 'true');
  picker.setAttribute('aria-label', `Choose element for ${roleLabel}`);

  const head = document.createElement('div');
  head.className = 'sph-picker-head';
  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'sph-picker-title';
  title.textContent = `periodic table - ${roleLabel}`;
  const subtitle = document.createElement('div');
  subtitle.className = 'sph-picker-subtitle';
  subtitle.textContent = 'Selectable cells resolve through the derived element material closure.';
  titleWrap.append(title, subtitle);
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'close';
  head.append(titleWrap, closeButton);

  const search = document.createElement('input');
  search.className = 'sph-picker-search';
  search.type = 'search';
  search.placeholder = 'filter by name, symbol, or Z';

  const scroll = document.createElement('div');
  scroll.className = 'sph-element-grid-scroll';
  const grid = document.createElement('div');
  grid.className = 'sph-element-grid';
  scroll.appendChild(grid);

  const legend = document.createElement('div');
  legend.className = 'sph-picker-legend';
  const categories = [...new Set(ELEMENT_MATERIAL_OPTIONS.map((option) => option.category))];
  for (const category of categories) {
    const chip = document.createElement('span');
    chip.className = `sph-legend-chip sph-cat-${category}`;
    chip.textContent = categoryLabel(category);
    legend.appendChild(chip);
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeyDown);
    pickerOverlay.remove();
    select.focus();
  };
  function onKeyDown(event) {
    if (event.key === 'Escape') close();
  }

  function renderGrid() {
    const query = search.value.trim().toLowerCase();
    grid.replaceChildren();
    for (const option of ELEMENT_MATERIAL_OPTIONS) {
      const haystack = `${option.name} ${option.symbol} ${option.Z}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `sph-element-cell sph-cat-${option.category}`;
      if (option.key === select.value) cell.classList.add('selected');
      cell.style.gridColumn = String(option.group);
      cell.style.gridRow = String(option.period);
      cell.title = option.label;
      cell.setAttribute('aria-label', option.label);
      cell.append(
        createPickerSpan('sph-element-number', String(option.Z)),
        createPickerSpan('sph-element-symbol', option.symbol),
        createPickerSpan('sph-element-name', option.name)
      );
      cell.addEventListener('click', () => {
        select.value = option.key;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      });
      grid.appendChild(cell);
    }
  }

  closeButton.addEventListener('click', close);
  pickerOverlay.addEventListener('click', (event) => {
    if (event.target === pickerOverlay) close();
  });
  search.addEventListener('input', renderGrid);
  window.addEventListener('keydown', onKeyDown);

  picker.append(head, search, scroll, legend);
  pickerOverlay.appendChild(picker);
  overlay.appendChild(pickerOverlay);
  renderGrid();
  search.focus();
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

  const boxEl = overlay.querySelector('#sph-box');
  const boxInputs = {};
  for (const [key, label, value] of [['x', 'X', BOX_DIM_DEFAULTS_M.x], ['y', 'Y', BOX_DIM_DEFAULTS_M.y], ['z', 'Z', BOX_DIM_DEFAULTS_M.z]]) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.step = '0.5';
    input.min = '1';
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    boxEl.appendChild(wrap);
    boxInputs[key] = input;
  }

  const countsEl = overlay.querySelector('#sph-counts');
  const countInputs = {};
  for (const [key, label, value] of [['drop', 'drop edge', DROP_PARTICLE_EDGE_DEFAULT], ['base', 'base edge', BASE_PARTICLE_EDGE_DEFAULT]]) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.step = '1';
    input.min = '1';
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    countsEl.appendChild(wrap);
    countInputs[key] = input;
  }

  const blobEl = overlay.querySelector('#sph-blob');
  const blobInput = document.createElement('input');
  blobInput.type = 'number';
  blobInput.value = String(BLOB_SCALE_DEFAULT);
  blobInput.step = '0.1';
  blobInput.min = '0.1';
  blobInput.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
  blobEl.appendChild(blobInput);

  const elementsEl = overlay.querySelector('#sph-elements');
  const elementSelects = {};
  for (const [role, label, def] of [['drop', 'drop block', 'fe'], ['base', 'base block', 'h2o']]) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = label;
    const row = document.createElement('div');
    row.className = 'sph-material-row';
    const select = document.createElement('select');
    select.className = 'sph-material-select';
    for (const opt of MATERIAL_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.key;
      o.textContent = opt.label;
      if (opt.key === def) o.selected = true;
      select.appendChild(o);
    }
    const pickerButton = document.createElement('button');
    pickerButton.type = 'button';
    pickerButton.className = 'sph-picker-button';
    pickerButton.textContent = 'PT';
    pickerButton.title = `Open periodic table for ${label}`;
    pickerButton.setAttribute('aria-label', `Open periodic table for ${label}`);
    pickerButton.addEventListener('click', () => openElementPicker({ overlay, select, roleLabel: label }));
    row.append(select, pickerButton);
    wrap.appendChild(row);
    elementsEl.appendChild(wrap);
    elementSelects[role] = select;
  }

  const tempsEl = overlay.querySelector('#sph-temps');
  const tempInputs = {};
  for (const [role, label, def] of [['drop', 'drop block T', DROP_TEMP_DEFAULT_K], ['base', 'base block T', BASE_TEMP_DEFAULT_K]]) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(def);
    input.step = '10';
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    tempsEl.appendChild(wrap);
    tempInputs[role] = input;
  }

  const statusEl = overlay.querySelector('#sph-status');
  const sceneContainer = overlay.querySelector('#sph-scene');

  // URL state: every control is encoded in the location hash so a refresh restores the full setup.
  const urlControls = {
    wxmin: wallInputs.xMin, wxmax: wallInputs.xMax, wymin: wallInputs.yMin, wymax: wallInputs.yMax, wzmin: wallInputs.zMin, wzmax: wallInputs.zMax,
    drop: elementSelects.drop, base: elementSelects.base,
    dropt: tempInputs.drop, baset: tempInputs.base,
    iceh: heightInputs.ice, ironh: heightInputs.iron,
    boxx: boxInputs.x, boxy: boxInputs.y, boxz: boxInputs.z,
    dropn: countInputs.drop, basen: countInputs.base,
    blob: blobInput
  };
  function applyUrlToControls() {
    const q = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    for (const [key, el] of Object.entries(urlControls)) {
      const v = q.get(key);
      if (v != null && v !== '') el.value = v;
    }
  }
  function syncUrlFromControls() {
    const q = new URLSearchParams();
    for (const [key, el] of Object.entries(urlControls)) q.set(key, el.value);
    window.history.replaceState(null, '', `#${q.toString()}`);
  }
  applyUrlToControls(); // restore from the URL before the first build
  syncUrlFromControls(); // and reflect the full current state in the URL

  function boxDimensionsFromControls() {
    const dim = (input, def) => { const v = Number(input.value); return Number.isFinite(v) && v > 0 ? v : def; };
    return [dim(boxInputs.x, BOX_DIM_DEFAULTS_M.x), dim(boxInputs.y, BOX_DIM_DEFAULTS_M.y), dim(boxInputs.z, BOX_DIM_DEFAULTS_M.z)];
  }

  function scenarioFromControls() {
    const wallFaces = {};
    for (const face of WALL_FACES) wallFaces[face] = Number(wallInputs[face].value) || WALL_DEFAULT_K;
    return createSphPhaseScenario({ wallFaces, boxDimensionsM: boxDimensionsFromControls() });
  }

  function driverOptionsFromControls() {
    const iceBaseHeightM = Number(heightInputs.ice.value);
    const ironBaseHeightM = Number(heightInputs.iron.value);
    const dropTemperatureK = Number(tempInputs.drop.value);
    const baseTemperatureK = Number(tempInputs.base.value);
    const dropEdge = Math.round(Number(countInputs.drop.value));
    const baseEdge = Math.round(Number(countInputs.base.value));
    return {
      scenario: scenarioFromControls(),
      dropMaterial: elementSelects.drop.value,
      baseMaterial: elementSelects.base.value,
      dropTemperatureK: Number.isFinite(dropTemperatureK) ? dropTemperatureK : DROP_TEMP_DEFAULT_K,
      baseTemperatureK: Number.isFinite(baseTemperatureK) ? baseTemperatureK : BASE_TEMP_DEFAULT_K,
      iceBaseHeightM: Number.isFinite(iceBaseHeightM) ? iceBaseHeightM : ICE_BASE_DEFAULT_M,
      ironBaseHeightM: Number.isFinite(ironBaseHeightM) ? ironBaseHeightM : IRON_BASE_DEFAULT_M,
      dropParticleEdge: Number.isFinite(dropEdge) && dropEdge >= 1 ? dropEdge : DROP_PARTICLE_EDGE_DEFAULT,
      baseParticleEdge: Number.isFinite(baseEdge) && baseEdge >= 1 ? baseEdge : BASE_PARTICLE_EDGE_DEFAULT
    };
  }

  const blobScaleOf = () => { const v = Number(blobInput.value); return Number.isFinite(v) && v > 0 ? v : BLOB_SCALE_DEFAULT; };
  let blockedError = null;
  let driver = null;
  function createDriverFromControls() {
    try {
      const next = createSphPhaseDemo(driverOptionsFromControls());
      blockedError = null;
      return next;
    } catch (error) {
      blockedError = error;
      return null;
    }
  }
  driver = createDriverFromControls();
  let scene = createSphPhaseScene(sceneContainer, { boxDimsM: driver?.demo.box.dimensionsM ?? boxDimensionsFromControls(), surfaceRadiusScale: blobScaleOf() });
  overlay.__sphScene = scene;
  overlay.__sphDriver = driver;
  overlay.__sphOpticalGpuLookup = scene.getOpticalGpuLookup?.() || null;
  overlay.__sphGpuParticleState = scene.getSphGpuParticleState?.() || null;
  overlay.__sphGpuParticleUpload = scene.getSphGpuParticleUpload?.() || null;
  overlay.__mlsMpmGpuParticleState = scene.getMlsMpmGpuParticleState?.() || null;
  overlay.__mlsMpmGpuParticleUpload = scene.getMlsMpmGpuParticleUpload?.() || null;
  overlay.__mlsMpmMechanicsPrediction = scene.getMlsMpmMechanicsPrediction?.() || null;
  overlay.__mlsMpmP2gGridProjection = scene.getMlsMpmP2gGridProjection?.() || null;
  overlay.__mlsMpmGridUpdate = scene.getMlsMpmGridUpdate?.() || null;
  overlay.__mlsMpmG2pReconstruction = scene.getMlsMpmG2pReconstruction?.() || null;
  overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || null;
  overlay.__mlsMpmResidentSteps = scene.getMlsMpmResidentSteps?.() || null;
  let rebuildTimer = null;
  let pendingOpticalLookupSignature = null;
  let pendingSphGpuParticleUploadSignature = null;
  let pendingMlsMpmGpuParticleUploadSignature = null;
  let pendingMlsMpmMechanicsPredictionSignature = null;
  let pendingMlsMpmP2gGridProjectionSignature = null;
  let pendingMlsMpmGridUpdateSignature = null;
  let pendingMlsMpmG2pReconstructionSignature = null;
  let pendingMlsMpmResidentStepsSignature = null;

  function scheduleOpticalGpuLookupRefresh() {
    const lookupState = scene.getOpticalGpuLookup?.();
    const signature = lookupState?.signature;
    if (!signature) return;
    if (lookupState.execution?.signature === signature || pendingOpticalLookupSignature === signature) return;
    pendingOpticalLookupSignature = signature;
    scene.refreshOpticalGpuLookup?.({ preferWebGpu: true }).then((nextLookupState) => {
      overlay.__sphOpticalGpuLookup = nextLookupState;
    }).catch((error) => {
      overlay.__sphOpticalGpuLookupError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      if (pendingOpticalLookupSignature === signature) pendingOpticalLookupSignature = null;
    });
  }

  function sphGpuParticleSignature(packed) {
    return packed
      ? [packed.particleCount, packed.step, packed.time, packed.state?.byteLength ?? 0, packed.thermo?.byteLength ?? 0].join('|')
      : null;
  }

  function scheduleSphGpuParticleUpload() {
    const packed = scene.getSphGpuParticleState?.();
    const signature = sphGpuParticleSignature(packed);
    if (!signature || pendingSphGpuParticleUploadSignature === signature) return;
    pendingSphGpuParticleUploadSignature = signature;
    scene.refreshSphGpuParticleBuffers?.({ preferWebGpu: true }).then((upload) => {
      overlay.__sphGpuParticleUpload = upload;
    }).catch((error) => {
      overlay.__sphGpuParticleUploadError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      if (pendingSphGpuParticleUploadSignature === signature) pendingSphGpuParticleUploadSignature = null;
    });
  }

  function mlsMpmGpuParticleSignature(packed) {
    return packed
      ? [
        packed.particleCount,
        packed.step,
        packed.time,
        packed.mechanics?.byteLength ?? 0,
        packed.mechanicsDtS ?? 0,
        packed.soundSpeedScale ?? 0,
        packed.minGasSoundSpeedMPerS ?? 0
      ].join('|')
      : null;
  }

  function scheduleMlsMpmGpuParticleUpload() {
    const packed = scene.getMlsMpmGpuParticleState?.();
    const signature = mlsMpmGpuParticleSignature(packed);
    if (!signature || pendingMlsMpmGpuParticleUploadSignature === signature) return;
    pendingMlsMpmGpuParticleUploadSignature = signature;
    scene.refreshMlsMpmGpuParticleBuffers?.({ preferWebGpu: true }).then((upload) => {
      overlay.__mlsMpmGpuParticleUpload = upload;
    }).catch((error) => {
      overlay.__mlsMpmGpuParticleUploadError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      if (pendingMlsMpmGpuParticleUploadSignature === signature) pendingMlsMpmGpuParticleUploadSignature = null;
    });
  }

  function mlsMpmMechanicsPredictionSignature() {
    const sph = scene.getSphGpuParticleState?.();
    const mls = scene.getMlsMpmGpuParticleState?.();
    const sphSignature = sphGpuParticleSignature(sph);
    const mlsSignature = mlsMpmGpuParticleSignature(mls);
    return sphSignature && mlsSignature ? `${sphSignature}|${mlsSignature}` : null;
  }

  function scheduleMlsMpmMechanicsPrediction() {
    const signature = mlsMpmMechanicsPredictionSignature();
    if (!signature || pendingMlsMpmMechanicsPredictionSignature === signature) return;
    pendingMlsMpmMechanicsPredictionSignature = signature;
    scene.refreshMlsMpmMechanicsPrediction?.({ preferWebGpu: true }).then((execution) => {
      overlay.__mlsMpmMechanicsPrediction = execution;
    }).catch((error) => {
      overlay.__mlsMpmMechanicsPredictionError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      if (pendingMlsMpmMechanicsPredictionSignature === signature) pendingMlsMpmMechanicsPredictionSignature = null;
    });
  }

  function mlsMpmP2gGridProjectionSignature() {
    const sph = scene.getSphGpuParticleState?.();
    const mls = scene.getMlsMpmGpuParticleState?.();
    const sphSignature = sphGpuParticleSignature(sph);
    const mlsSignature = mlsMpmGpuParticleSignature(mls);
    return sphSignature && mlsSignature ? `${sphSignature}|${mlsSignature}|${sph?.smoothingLengthM ?? 0}` : null;
  }

  function scheduleMlsMpmP2gGridProjection() {
    const signature = mlsMpmP2gGridProjectionSignature();
    if (!signature || pendingMlsMpmP2gGridProjectionSignature === signature) return;
    pendingMlsMpmP2gGridProjectionSignature = signature;
    scene.refreshMlsMpmP2gGridProjection?.({ preferWebGpu: true }).then((execution) => {
      overlay.__mlsMpmP2gGridProjection = execution;
      scheduleMlsMpmGridUpdate();
    }).catch((error) => {
      overlay.__mlsMpmP2gGridProjectionError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      if (pendingMlsMpmP2gGridProjectionSignature === signature) pendingMlsMpmP2gGridProjectionSignature = null;
    });
  }

  function mlsMpmGridUpdateSignature() {
    const p2g = scene.getMlsMpmP2gGridProjection?.();
    const mls = scene.getMlsMpmGpuParticleState?.();
    if (!p2g?.schema) return null;
    return [
      p2g.signature ?? `${p2g.schema}|${p2g.backend}|${p2g.gridNodeCount}|${p2g.dt ?? 0}`,
      mls?.mechanicsDtS ?? p2g.dt ?? 0,
      (mls?.gravityMPerS2 ?? [0, -9.80665, 0]).join(','),
      mls?.gridCflFactor ?? 0.6
    ].join('|');
  }

  function scheduleMlsMpmGridUpdate() {
    const signature = mlsMpmGridUpdateSignature();
    if (!signature || pendingMlsMpmGridUpdateSignature === signature) return;
    pendingMlsMpmGridUpdateSignature = signature;
    scene.refreshMlsMpmGridUpdate?.({ preferWebGpu: true }).then((execution) => {
      overlay.__mlsMpmGridUpdate = execution;
      scheduleMlsMpmG2pReconstruction();
    }).catch((error) => {
      overlay.__mlsMpmGridUpdateError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      if (pendingMlsMpmGridUpdateSignature === signature) pendingMlsMpmGridUpdateSignature = null;
    });
  }

  function mlsMpmG2pReconstructionSignature() {
    const sph = scene.getSphGpuParticleState?.();
    const mls = scene.getMlsMpmGpuParticleState?.();
    const grid = scene.getMlsMpmGridUpdate?.();
    const sphSignature = sphGpuParticleSignature(sph);
    const mlsSignature = mlsMpmGpuParticleSignature(mls);
    if (!sphSignature || !mlsSignature || !grid?.schema) return null;
    return `${sphSignature}|${mlsSignature}|${grid.signature ?? `${grid.schema}|${grid.backend}|${grid.gridNodeCount}|${grid.dt ?? 0}`}`;
  }

  function scheduleMlsMpmG2pReconstruction() {
    const signature = mlsMpmG2pReconstructionSignature();
    if (!signature || pendingMlsMpmG2pReconstructionSignature === signature) return;
    pendingMlsMpmG2pReconstructionSignature = signature;
    scene.refreshMlsMpmG2pReconstruction?.({ preferWebGpu: true }).then((execution) => {
      overlay.__mlsMpmG2pReconstruction = execution;
    }).catch((error) => {
      overlay.__mlsMpmG2pReconstructionError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      if (pendingMlsMpmG2pReconstructionSignature === signature) pendingMlsMpmG2pReconstructionSignature = null;
    });
  }

  function mlsMpmResidentStepsSignature(stepCount = RESIDENT_STEPS_PER_SCHEDULE) {
    const sph = scene.getSphGpuParticleState?.();
    const mls = scene.getMlsMpmGpuParticleState?.();
    const sphSignature = sphGpuParticleSignature(sph);
    const mlsSignature = mlsMpmGpuParticleSignature(mls);
    if (!sphSignature || !mlsSignature) return null;
    return [
      sphSignature,
      mlsSignature,
      sph?.smoothingLengthM ?? 0,
      mls?.mechanicsDtS ?? 0,
      (mls?.gravityMPerS2 ?? [0, -9.80665, 0]).join(','),
      mls?.gridCflFactor ?? 0.6,
      Math.max(1, Math.round(Number(stepCount) || 1))
    ].join('|');
  }

  function scheduleMlsMpmResidentSteps(stepCount = RESIDENT_STEPS_PER_SCHEDULE) {
    const normalizedStepCount = Math.max(1, Math.round(Number(stepCount) || 1));
    const signature = mlsMpmResidentStepsSignature(normalizedStepCount);
    if (!signature || pendingMlsMpmResidentStepsSignature === signature) return;
    pendingMlsMpmResidentStepsSignature = signature;
    scene.refreshMlsMpmResidentSteps?.({
      preferWebGpu: true,
      stepCount: normalizedStepCount
    }).then((execution) => {
      overlay.__mlsMpmResidentSteps = execution;
      overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || execution?.finalStep || null;
      overlay.__mlsMpmP2gGridProjection = scene.getMlsMpmP2gGridProjection?.() || execution?.finalStep?.p2gGridProjection || null;
      overlay.__mlsMpmGridUpdate = scene.getMlsMpmGridUpdate?.() || execution?.finalStep?.gridUpdate || null;
      overlay.__mlsMpmG2pReconstruction = scene.getMlsMpmG2pReconstruction?.() || execution?.finalStep?.g2pReconstruction || null;
    }).catch((error) => {
      overlay.__mlsMpmResidentStepsError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      if (pendingMlsMpmResidentStepsSignature === signature) pendingMlsMpmResidentStepsSignature = null;
    });
  }

  // Blob size is live: update the scene's surface scale and re-render without a reset.
  blobInput.addEventListener('input', () => { scene.setSurfaceRadiusScale(blobScaleOf()); syncParticles(); });

  function rebuildDemoFromControls() {
    playing = false;
    overlay.querySelector('#sph-play').textContent = 'Play';
    driver = createDriverFromControls();
    // The box dimensions may have changed, so rebuild the scene (its field/wireframe/camera are
    // sized to the box at creation) against the new driver's box.
    scene.dispose();
    scene = createSphPhaseScene(sceneContainer, { boxDimsM: driver?.demo.box.dimensionsM ?? boxDimensionsFromControls(), surfaceRadiusScale: blobScaleOf() });
    overlay.__sphScene = scene;
    overlay.__sphDriver = driver;
    overlay.__sphOpticalGpuLookup = scene.getOpticalGpuLookup?.() || null;
    overlay.__sphGpuParticleState = scene.getSphGpuParticleState?.() || null;
    overlay.__sphGpuParticleUpload = scene.getSphGpuParticleUpload?.() || null;
    overlay.__mlsMpmGpuParticleState = scene.getMlsMpmGpuParticleState?.() || null;
    overlay.__mlsMpmGpuParticleUpload = scene.getMlsMpmGpuParticleUpload?.() || null;
    overlay.__mlsMpmMechanicsPrediction = scene.getMlsMpmMechanicsPrediction?.() || null;
    overlay.__mlsMpmP2gGridProjection = scene.getMlsMpmP2gGridProjection?.() || null;
    overlay.__mlsMpmGridUpdate = scene.getMlsMpmGridUpdate?.() || null;
    overlay.__mlsMpmG2pReconstruction = scene.getMlsMpmG2pReconstruction?.() || null;
    overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || null;
    overlay.__mlsMpmResidentSteps = scene.getMlsMpmResidentSteps?.() || null;
    pendingOpticalLookupSignature = null;
    pendingSphGpuParticleUploadSignature = null;
    pendingMlsMpmGpuParticleUploadSignature = null;
    pendingMlsMpmMechanicsPredictionSignature = null;
    pendingMlsMpmP2gGridProjectionSignature = null;
    pendingMlsMpmGridUpdateSignature = null;
    pendingMlsMpmG2pReconstructionSignature = null;
    pendingMlsMpmResidentStepsSignature = null;
    syncParticles();
    renderStatus();
  }

  function scheduleDemoRebuild() {
    syncUrlFromControls();
    if (rebuildTimer != null) window.clearTimeout(rebuildTimer);
    playing = false;
    overlay.querySelector('#sph-play').textContent = 'Play';
    statusEl.textContent = 'rebuilding material state and derived chemistry...';
    rebuildTimer = window.setTimeout(() => {
      rebuildTimer = null;
      rebuildDemoFromControls();
    }, 0);
  }

  for (const [key, el] of Object.entries(urlControls)) {
    if (key === 'blob') {
      el.addEventListener('change', syncUrlFromControls);
    } else {
      el.addEventListener('change', scheduleDemoRebuild);
    }
  }

  function syncParticles() {
    if (!driver) {
      scene.setParticles({
        positionsM: new Float32Array(0),
        colorsRgb: new Float32Array(0),
        materials: []
      });
      return;
    }
    const colors = particleColors(driver.demo);
    const renderDescriptors = particleRenderDescriptors(driver.demo);
    const sphGpuParticleState = buildSphGpuParticleBuffers(driver.demo.state, {
      materialProperties: driver.demo.materialProperties
    });
    const mlsMpmGpuParticleState = buildMlsMpmGpuParticleBuffers(driver.demo.state, {
      materialProperties: driver.demo.materialProperties
    });
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
      materials[i] = renderDescriptors[i];
    });
    scene.setParticles({
      positionsM,
      colorsRgb,
      materials,
      emissiveByMaterial: surfaceEmissive(driver.demo),
      materialProperties: driver.demo.materialProperties,
      sphGpuParticleState,
      mlsMpmGpuParticleState
    });
    overlay.__sphOpticalGpuLookup = scene.getOpticalGpuLookup?.() || null;
    overlay.__sphGpuParticleState = scene.getSphGpuParticleState?.() || null;
    overlay.__mlsMpmGpuParticleState = scene.getMlsMpmGpuParticleState?.() || null;
    overlay.__mlsMpmGridUpdate = scene.getMlsMpmGridUpdate?.() || null;
    overlay.__mlsMpmG2pReconstruction = scene.getMlsMpmG2pReconstruction?.() || null;
    overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || null;
    overlay.__mlsMpmResidentSteps = scene.getMlsMpmResidentSteps?.() || null;
    scheduleOpticalGpuLookupRefresh();
    scheduleSphGpuParticleUpload();
    scheduleMlsMpmGpuParticleUpload();
    scheduleMlsMpmMechanicsPrediction();
    scheduleMlsMpmResidentSteps();
  }

  function stepDemoForVisualTest(steps = 1) {
    if (!driver) {
      return {
        blocked: true,
        reason: blockedError?.message || 'first-principles material resolution blocked',
        blockers: blockedError?.blockers || []
      };
    }
    const count = Math.max(1, Math.round(Number(steps) || 1));
    for (let i = 0; i < count; i += 1) driver.step();
    syncParticles();
    renderStatus();
    return {
      step: driver.demo.state.step ?? 0,
      time: driver.demo.state.time ?? 0,
      particlesByMaterial: driver.demo.state.particles.reduce((acc, particle) => {
        acc[particle.material] = (acc[particle.material] || 0) + 1;
        return acc;
      }, {})
    };
  }
  overlay.__sphStep = stepDemoForVisualTest;

  function renderStatus() {
    if (!driver) {
      statusEl.textContent = [
        'preflight        : blocked',
        'reason           : first-principles material properties are required',
        `error            : ${blockedError?.message || 'material closure missing'}`,
        `blockers         : ${(blockedError?.blockers || []).join(', ') || 'first-principles-material-closure-not-produced'}`,
        '',
        'validation       : no fixture/reduced material properties consumed'
      ].join('\n');
      return;
    }
    const pre = driver.preflight();
    const totals = sphTotals(driver.demo.state);
    const phase = phaseMassSummary(driver.demo);
    const waterPhases = phase.byMaterialPhase.h2o || {};
    const ledger = pre.energyBudget.wallLedger.map((w) => `  ${w.faceId} ${w.role} ${fmt(w.heatJ)}J`).join('\n');
    const water = Object.entries(waterPhases).map(([ph, m]) => `${ph} ${fmt(m)}kg`).join('  ');
    const materialPhases = formatMaterialPhaseMasses(phase.byMaterialPhase);
    statusEl.textContent = [
      `preflight        : ${pre.status} (feasible=${pre.feasibility.feasible})`,
      `final phase      : H2O ${pre.feasibility.finalH2oPhase} / Fe ${pre.feasibility.finalFePhase}`,
      `heat to walls    : ${fmt(pre.energyBudget.heatExportedToWallsJ)} J`,
      `masses (kg)      : Fe ${fmt(pre.masses.ironMassKg)}  ice ${fmt(pre.masses.iceMassKg)}  air ${fmt(pre.masses.airMassKg)}`,
      `particles        : ${driver.demo.dropMaterial} ${driver.demo.counts.drop}  ${driver.demo.baseMaterial} ${driver.demo.counts.base}  total ${driver.demo.counts.total}`,
      `reaction         : ${driver.demo.reactionNote || '—'}`,
      `material phases  : ${materialPhases || '—'}`,
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
    if (!playing || !driver) return;
    driver.step();
    syncParticles();
    renderStatus();
    requestAnimationFrame(tick);
  }

  overlay.querySelector('#sph-preflight').addEventListener('click', renderStatus);
  overlay.querySelector('#sph-step').addEventListener('click', () => {
    if (!driver) { renderStatus(); return; }
    driver.step(); syncParticles(); renderStatus();
  });
  overlay.querySelector('#sph-play').addEventListener('click', (e) => {
    if (!driver) { playing = false; e.target.textContent = 'Play'; renderStatus(); return; }
    playing = !playing;
    e.target.textContent = playing ? 'Pause' : 'Play';
    if (playing) tick();
  });
  overlay.querySelector('#sph-reset').addEventListener('click', () => {
    syncUrlFromControls();
    rebuildDemoFromControls();
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
    if (rebuildTimer != null) window.clearTimeout(rebuildTimer);
    scene.dispose();
    overlay.remove();
  }
  overlay.querySelector('#sph-close').addEventListener('click', close);

  syncParticles();
  renderStatus();
  return { close, overlay };
}
