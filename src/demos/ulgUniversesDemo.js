// ULG Universes Interactive 40-Order-of-Magnitude Controller (`src/demos/ulgUniversesDemo.js`).
//
// Coordinates interactive 3D orbit/zoom camera (locked by default: `cameraAutoSpin: false`),
// screen-space 3D target picking, Hyperdrive warp transitions across L0..L7,
// hands-free Autopilot 40-OOM guided tour, live Gate 1 Emission Spectrograph +
// 2D GPU Scientific Plots, optional Retro CRT & Schwarzschild Lensing controls,
// and PeerCompute 2-of-2 quorum derivation mesh.

import { attachWebGpuUncapturedErrorTelemetry } from '../runtime/webgpuDeviceLimits.js';
import {
  QUALITY_PRESETS,
  UNIVERSES_ELEMENT_CHOICES,
  UNIVERSES_SCALES,
  buildAboutScaleHtml,
  buildAboutUlgUniversesHtml
} from './ulgUniversesDocs.js';
import {
  buildEmissionLinesForContext,
  createUlgUniversesPhysics
} from './ulgUniversesPhysics.js';
import { createUlgUniversesRenderer } from './ulgUniversesRenderer.js';

// ---- Pure Linear Algebra for Column-Major WebGPU [0, 1] Perspective Camera ----
function vec3Sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vec3Cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
function vec3Dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vec3Norm(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function mat4PerspectiveWebGpu(fovYRad, aspect, near, far) {
  const f = 1.0 / Math.tan(fovYRad * 0.5);
  const nf = 1.0 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / Math.max(0.25, aspect);
  m[5] = f;
  m[10] = far * nf;
  m[11] = -1.0;
  m[14] = near * far * nf;
  return m;
}

function mat4LookAt(eye, target, upHint) {
  const fwd = vec3Norm(vec3Sub(target, eye));
  const right = vec3Norm(vec3Cross(fwd, upHint));
  const up = vec3Cross(right, fwd);
  const m = new Float32Array(16);
  m[0] = right[0]; m[4] = right[1]; m[8] = right[2]; m[12] = -vec3Dot(right, eye);
  m[1] = up[0];    m[5] = up[1];    m[9] = up[2];    m[13] = -vec3Dot(up, eye);
  m[2] = -fwd[0];  m[6] = -fwd[1];  m[10] = -fwd[2]; m[14] = vec3Dot(fwd, eye);
  m[3] = 0;        m[7] = 0;        m[11] = 0;       m[15] = 1;
  return { mat: m, right, up, fwd };
}

function mat4Mul(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0]
        + a[1 * 4 + r] * b[c * 4 + 1]
        + a[2 * 4 + r] * b[c * 4 + 2]
        + a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function projectWorldToScreen(worldPos, viewProj, cssW, cssH) {
  const x = worldPos[0]; const y = worldPos[1]; const z = worldPos[2];
  const cx = viewProj[0] * x + viewProj[4] * y + viewProj[8] * z + viewProj[12];
  const cy = viewProj[1] * x + viewProj[5] * y + viewProj[9] * z + viewProj[13];
  const cz = viewProj[2] * x + viewProj[6] * y + viewProj[10] * z + viewProj[14];
  const cw = viewProj[3] * x + viewProj[7] * y + viewProj[11] * z + viewProj[15];
  if (cw <= 0.05) return { visible: false, sx: -999, sy: -999, uvX: 0.5, uvY: 0.5, depth: 1 };
  const ndcX = cx / cw;
  const ndcY = cy / cw;
  const ndcZ = cz / cw;
  const uvX = ndcX * 0.5 + 0.5;
  const uvY = 0.5 - ndcY * 0.5;
  return {
    visible: ndcZ >= 0 && ndcZ <= 1 && uvX >= -0.15 && uvX <= 1.15 && uvY >= -0.15 && uvY <= 1.15,
    sx: uvX * cssW,
    sy: uvY * cssH,
    uvX,
    uvY,
    depth: ndcZ,
    w: cw
  };
}

function wavelengthNmToRgb(nm) {
  let r = 0; let g = 0; let b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 740) { r = 1; }
  const edge = nm < 420 ? 0.3 + 0.7 * ((nm - 380) / 40) : (nm > 680 ? 0.3 + 0.7 * ((740 - nm) / 60) : 1);
  return [
    Math.round(Math.max(0, Math.min(1, r * edge)) * 255),
    Math.round(Math.max(0, Math.min(1, g * edge)) * 255),
    Math.round(Math.max(0, Math.min(1, b * edge)) * 255)
  ];
}

function buildBoxWireframeLines(halfBox, color = [0.28, 0.72, 0.96, 0.38]) {
  const [hx, hy, hz] = halfBox;
  const c = [
    [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
    [-hx, -hy, hz],  [hx, -hy, hz],  [hx, hy, hz],  [-hx, hy, hz]
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];
  const out = new Float32Array(edges.length * 2 * 7);
  let k = 0;
  for (const [a, b] of edges) {
    out.set([...c[a], ...color], k); k += 7;
    out.set([...c[b], ...color], k); k += 7;
  }
  return out;
}

function buildOsculatingOrbitLines(bodies, targets, gravity = 1.0) {
  if (!bodies || bodies.length < 16) return [];
  const sx = bodies[0]; const sy = bodies[1]; const sz = bodies[2];
  const mStar = bodies[3];
  const svx = bodies[4]; const svy = bodies[5]; const svz = bodies[6];
  const out = [];
  const segs = 64;
  for (let i = 1; i < targets.length; i += 1) {
    const o = i * 8;
    const rx = bodies[o] - sx; const ry = bodies[o + 1] - sy; const rz = bodies[o + 2] - sz;
    const vx = bodies[o + 4] - svx; const vy = bodies[o + 5] - svy; const vz = bodies[o + 6] - svz;
    const r = Math.hypot(rx, ry, rz);
    const v2 = vx * vx + vy * vy + vz * vz;
    const mu = gravity * (mStar + bodies[o + 3]);
    if (!(r > 1e-4 && mu > 1e-4)) continue;
    const energy = 0.5 * v2 - mu / r;
    if (energy >= -1e-4) continue;
    const a = -mu / (2 * energy);
    const h = vec3Cross([rx, ry, rz], [vx, vy, vz]);
    const hMag = Math.hypot(h[0], h[1], h[2]);
    if (!(hMag > 1e-4)) continue;
    const hHat = [h[0] / hMag, h[1] / hMag, h[2] / hMag];
    // Laplace-Runge-Lenz eccentricity vector e = (v x h)/mu - r_hat
    const vxh = vec3Cross([vx, vy, vz], h);
    const eVec = [vxh[0] / mu - rx / r, vxh[1] / mu - ry / r, vxh[2] / mu - rz / r];
    const ecc = Math.min(0.85, Math.hypot(eVec[0], eVec[1], eVec[2]));
    const pHat = ecc > 1e-4
      ? [eVec[0] / ecc, eVec[1] / ecc, eVec[2] / ecc]
      : vec3Norm([rx, ry, rz]);
    const qHat = vec3Cross(hHat, pHat);
    const bSemi = a * Math.sqrt(Math.max(0.05, 1 - ecc * ecc));
    const col = targets[i]?.color0 || [0.38, 0.72, 1.0];
    let prev = null;
    for (let s = 0; s <= segs; s += 1) {
      const E = (s / segs) * Math.PI * 2;
      const ca = a * (Math.cos(E) - ecc);
      const sb = bSemi * Math.sin(E);
      const pt = [
        sx + ca * pHat[0] + sb * qHat[0],
        sy + ca * pHat[1] + sb * qHat[1],
        sz + ca * pHat[2] + sb * qHat[2]
      ];
      if (prev) {
        out.push(...prev, col[0], col[1], col[2], 0.28);
        out.push(...pt, col[0], col[1], col[2], 0.28);
      }
      prev = pt;
    }
  }
  return out;
}

const DEFAULT_CAMERA_BY_LEVEL = Object.freeze([
  { yaw: 0.56, pitch: 0.36, dist: 32.0 }, // L0 Cosmic Web
  { yaw: 0.38, pitch: 0.58, dist: 23.0 }, // L1 Galaxy & SMBH
  { yaw: 0.45, pitch: 0.52, dist: 18.0 }, // L2 Star System
  { yaw: 0.32, pitch: 0.28, dist: 19.0 }, // L3 Stellar Core
  { yaw: 0.72, pitch: 0.44, dist: 8.6 },  // L4 Planetary Cutaway Globe
  { yaw: 0.62, pitch: 0.38, dist: 14.2 }, // L5 Crystal/Fluid MD
  { yaw: 0.48, pitch: 0.30, dist: 9.6 },  // L6 Quantum Atom
  { yaw: 0.55, pitch: 0.32, dist: 7.2 }   // L7 Atomic Nucleus
]);

function mapLog10ScaleToLevel(log10Val) {
  let best = 0;
  let bestDist = Infinity;
  for (const s of UNIVERSES_SCALES) {
    const d = Math.abs(s.log10SpanM - log10Val);
    if (d < bestDist) { bestDist = d; best = s.level; }
  }
  return best;
}

export async function mountUlgUniversesDemo() {
  if (!navigator.gpu) {
    throw new Error('navigator.gpu is unavailable in this browser.');
  }
  let adapter = null;
  for (let i = 0; i < 6 && !adapter; i += 1) {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) await new Promise((r) => setTimeout(r, 250));
  }
  if (!adapter) {
    throw new Error('No WebGPU adapter available on this device.');
  }
  const device = await adapter.requestDevice();
  const gpuErrorBucket = [];
  device.addEventListener('uncapturederror', (e) => {
    gpuErrorBucket.push(String(e?.error?.message ?? e));
  });
  attachWebGpuUncapturedErrorTelemetry(device, 'ulg-universes-demo');

  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const initialZ = Math.max(1, Math.min(118, Number.parseInt(urlParams.get('Z') || urlParams.get('z') || '26', 10) || 26));
  const initialSeed = Number.parseInt(urlParams.get('seed') || '20261125', 10) || 20261125;
  const initialQuality = QUALITY_PRESETS[urlParams.get('quality')] ? urlParams.get('quality') : 'med';
  let initialLevel = 0;
  if (urlParams.has('level')) {
    initialLevel = Math.max(0, Math.min(7, Number.parseInt(urlParams.get('level'), 10) || 0));
  } else if (urlParams.has('scale')) {
    initialLevel = mapLog10ScaleToLevel(Number.parseFloat(urlParams.get('scale')) || 25);
  }

  // DOM References
  const canvas = document.getElementById('uv-canvas');
  const reticleCanvas = document.getElementById('uv-reticle-canvas');
  const reticleCtx = reticleCanvas?.getContext('2d');
  const scaleRail = document.getElementById('uv-scale-rail');
  const statusDot = document.getElementById('uv-status-dot');
  const scaleBadge = document.getElementById('uv-scale-badge');
  const fpsBadge = document.getElementById('uv-fps-badge');
  const autopilotBtn = document.getElementById('uv-autopilot-btn');
  const simBtn = document.getElementById('uv-sim-btn');
  const configBtn = document.getElementById('uv-config-btn');
  const helpBtn = document.getElementById('uv-help-btn');
  const simDrawer = document.getElementById('uv-sim-drawer');
  const configDrawer = document.getElementById('uv-config-drawer');
  const helpDrawer = document.getElementById('uv-help-drawer');
  const pauseBtn = document.getElementById('uv-pause-btn');
  const orbitUpBtn = document.getElementById('uv-orbit-up-btn');
  const timeScaleSlider = document.getElementById('uv-timescale-slider');
  const timeScaleVal = document.getElementById('uv-timescale-val');
  const bigBangBtn = document.getElementById('uv-bigbang-btn');
  const reseedBtn = document.getElementById('uv-reseed-btn');
  const scaleControlsEl = document.getElementById('uv-scale-controls');
  const qualityGroup = document.getElementById('uv-quality-group');
  const lensingToggle = document.getElementById('uv-lensing-toggle');
  const orbitsToggle = document.getElementById('uv-orbits-toggle');
  const travelToggle = document.getElementById('uv-travel-toggle');
  const autoSpinToggle = document.getElementById('uv-autospin-toggle');
  const crtToggle = document.getElementById('uv-crt-toggle');
  const pixelSlider = document.getElementById('uv-pixel-slider');
  const pixelVal = document.getElementById('uv-pixel-val');
  const peerUrlInput = document.getElementById('uv-peer-url');
  const peerRoleSelect = document.getElementById('uv-peer-role');
  const peerConnectBtn = document.getElementById('uv-peer-connect-btn');
  const peerStatusEl = document.getElementById('uv-peer-status');

  const inspectorEl = document.getElementById('uv-inspector');
  const collapseBtn = document.getElementById('uv-collapse-btn');
  const infoQuickBtn = document.getElementById('uv-info-quick-btn');
  const targetKicker = document.getElementById('uv-target-kicker');
  const targetName = document.getElementById('uv-target-name');
  const targetSub = document.getElementById('uv-target-sub');
  const specTitle = document.getElementById('uv-spec-title');
  const compText = document.getElementById('uv-comp-text');
  const specCanvas = document.getElementById('uv-spectrograph-canvas');
  const statsGrid = document.getElementById('uv-stats-grid');
  const plotTitle = document.getElementById('uv-plot-title');
  const plotMeta = document.getElementById('uv-plot-meta');
  const plotCanvas = document.getElementById('uv-plot-canvas');
  const diveBtn = document.getElementById('uv-dive-btn');
  const returnBtn = document.getElementById('uv-return-btn');
  const engineTag = document.getElementById('uv-engine-tag');
  const breadcrumbEl = document.getElementById('uv-breadcrumb');
  const warpOverlay = document.getElementById('uv-warp-overlay');
  const warpKicker = document.getElementById('uv-warp-kicker');
  const warpTitle = document.getElementById('uv-warp-title');
  const warpSub = document.getElementById('uv-warp-sub');
  const helpScaleTag = document.getElementById('uv-help-scale-tag');
  const aboutScaleBtn = document.getElementById('uv-about-scale-btn');
  const aboutUlgBtn = document.getElementById('uv-about-ulg-btn');
  const modalBackdrop = document.getElementById('uv-modal-backdrop');
  const modalTitle = document.getElementById('uv-modal-title');
  const modalSub = document.getElementById('uv-modal-sub');
  const modalContent = document.getElementById('uv-modal-content');
  const modalClose = document.getElementById('uv-modal-close');

  const renderer = createUlgUniversesRenderer(device, canvas);
  const physics = createUlgUniversesPhysics(device, {
    seed: initialSeed,
    qualityId: initialQuality,
    initialElementZ: initialZ
  });

  // App State
  let currentLevel = initialLevel;
  let selectedTargetId = null;
  let hoveredTargetId = null;
  let running = true;
  let timeScale = 1.0;
  let lensingEnabled = true;
  let showOrbits = true;
  let showTravelPath = true;
  let cameraAutoSpin = urlParams.get('cameraAutoSpin') === '1';
  let retroCrt = urlParams.get('crt') === '1';
  let pixelSize = 3;
  let autopilot = urlParams.get('autopilot') === '1';
  let autopilotDwellSec = 0;
  let bigBangFlash = 0;
  let transitionBusy = false;
  let disposed = false;
  let rafId = 0;

  // Breadcrumb path tracking actual selected ancestors across scales
  const pathHistory = ['Cosmic Web'];

  // Orbit Camera State
  const camState = {
    yaw: DEFAULT_CAMERA_BY_LEVEL[initialLevel].yaw,
    pitch: DEFAULT_CAMERA_BY_LEVEL[initialLevel].pitch,
    dist: DEFAULT_CAMERA_BY_LEVEL[initialLevel].dist,
    target: [0, 0, 0]
  };
  let lastViewProj = new Float32Array(16);
  let lastCssW = window.innerWidth;
  let lastCssH = window.innerHeight;

  // Hyperdrive Warp Animation State
  const warp = {
    active: false,
    startMs: 0,
    durationMs: 680,
    amount: 0,
    toLevel: 0,
    swapped: false,
    target: null
  };

  // Sync initial UI toggles
  if (autoSpinToggle) autoSpinToggle.checked = cameraAutoSpin;
  if (crtToggle) crtToggle.checked = retroCrt;
  if (autopilotBtn && autopilot) autopilotBtn.classList.add('active');
  if (qualityGroup) {
    for (const b of qualityGroup.querySelectorAll('[data-quality]')) {
      b.classList.toggle('active', b.dataset.quality === initialQuality);
    }
  }

  // Build clickable 8-rung 40-OOM Scale Rail
  if (scaleRail) {
    scaleRail.innerHTML = UNIVERSES_SCALES.map((s) => (
      `<button class="uv-rung-btn" data-level="${s.level}" type="button" title="Jump to L${s.level}: ${s.name} (${s.exponentLabel})">` +
      `<span class="uv-rung-exp">${s.exponentLabel}</span>` +
      `<span>L${s.level} ${s.shortLabel}</span>` +
      `</button>`
    )).join('');
    for (const btn of scaleRail.querySelectorAll('[data-level]')) {
      btn.addEventListener('click', () => {
        const lvl = Number.parseInt(btn.dataset.level, 10);
        if (Number.isFinite(lvl) && lvl !== currentLevel) {
          autopilot = false;
          autopilotBtn?.classList.remove('active');
          void startHyperdriveToLevel(lvl, null);
        }
      });
    }
  }

  // ---- Responsive Canvas Sizing ----
  function syncCanvasSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    lastCssW = Math.max(320, window.innerWidth);
    lastCssH = Math.max(240, window.innerHeight);
    const pw = Math.max(2, Math.floor(lastCssW * dpr));
    const ph = Math.max(2, Math.floor(lastCssH * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    if (reticleCanvas && (reticleCanvas.width !== lastCssW || reticleCanvas.height !== lastCssH)) {
      reticleCanvas.width = lastCssW;
      reticleCanvas.height = lastCssH;
    }
  }
  syncCanvasSize();
  window.addEventListener('resize', syncCanvasSize);

  // ---- Drawer & Modal Helpers ----
  const ALL_DRAWERS = [
    { el: simDrawer, btn: simBtn },
    { el: configDrawer, btn: configBtn },
    { el: helpDrawer, btn: helpBtn }
  ];
  function toggleDrawer(targetDrawer) {
    for (const d of ALL_DRAWERS) {
      const open = d.el === targetDrawer && !d.el?.classList.contains('open');
      d.el?.classList.toggle('open', open);
      d.btn?.classList.toggle('active', open);
    }
  }
  function closeAllDrawers() {
    for (const d of ALL_DRAWERS) {
      d.el?.classList.remove('open');
      d.btn?.classList.remove('active');
    }
  }
  simBtn?.addEventListener('click', () => toggleDrawer(simDrawer));
  configBtn?.addEventListener('click', () => toggleDrawer(configDrawer));
  helpBtn?.addEventListener('click', () => toggleDrawer(helpDrawer));
  for (const b of document.querySelectorAll('[data-close-drawer]')) {
    b.addEventListener('click', () => closeAllDrawers());
  }

  function openModal(title, sub, html) {
    closeAllDrawers();
    if (modalTitle) modalTitle.textContent = title;
    if (modalSub) modalSub.textContent = sub;
    if (modalContent) modalContent.innerHTML = html;
    modalBackdrop?.classList.add('open');
  }
  modalClose?.addEventListener('click', () => modalBackdrop?.classList.remove('open'));
  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) modalBackdrop.classList.remove('open');
  });
  aboutScaleBtn?.addEventListener('click', () => {
    const sc = UNIVERSES_SCALES[currentLevel];
    openModal(`L${sc.level} · ${sc.name}`, `${sc.exponentLabel} · ${sc.engineSchema}`, buildAboutScaleHtml(sc));
  });
  infoQuickBtn?.addEventListener('click', () => {
    const sc = UNIVERSES_SCALES[currentLevel];
    openModal(`L${sc.level} · ${sc.name}`, `${sc.exponentLabel} · ${sc.engineSchema}`, buildAboutScaleHtml(sc));
  });
  aboutUlgBtn?.addEventListener('click', () => {
    openModal('About ULG Universes', 'Universal Law Graph · 40-Order-of-Magnitude WebGPU Physics', buildAboutUlgUniversesHtml());
  });

  collapseBtn?.addEventListener('click', () => {
    const collapsed = inspectorEl?.classList.toggle('collapsed');
    if (collapseBtn) collapseBtn.textContent = collapsed ? '+' : '−';
  });

  // ---- Scale-Specific Physics Controls inside Sim Drawer ----
  function renderScaleControls() {
    if (!scaleControlsEl) return;
    if (currentLevel === 0) {
      scaleControlsEl.innerHTML =
        `<div style="font-size:11.5px;color:var(--muted);line-height:1.4;">FLRW 3D-FFT TreePM running at <code>${physics.quality.cosmoGridPerSide}³</code> particles on a <code>${physics.quality.cosmoFftN}³</code> periodic FFT mesh. Click any supercluster or trigger Big Bang to re-run from z = 19.</div>`;
    } else if (currentLevel === 1) {
      scaleControlsEl.innerHTML = `
        <div class="uv-row"><span>Morphology</span></div>
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${physics.galaxyPreset === 'disk' ? 'active' : ''}" data-gal-preset="disk" type="button">Spiral</button>
          <button class="uv-seg-btn ${physics.galaxyPreset === 'binary' ? 'active' : ''}" data-gal-preset="binary" type="button">Merger</button>
          <button class="uv-seg-btn ${physics.galaxyPreset === 'sphere' ? 'active' : ''}" data-gal-preset="sphere" type="button">Elliptical</button>
        </div>
        <div class="uv-row">
          <span>ISM Z/Z☉</span>
          <input id="uv-gal-z-slider" type="range" min="0.1" max="2.5" step="0.1" value="${physics.galaxyMetallicity.toFixed(1)}" />
          <span id="uv-gal-z-val" style="font-family:var(--mono);font-size:11px;">${physics.galaxyMetallicity.toFixed(1)}</span>
        </div>`;
      for (const b of scaleControlsEl.querySelectorAll('[data-gal-preset]')) {
        b.addEventListener('click', async () => {
          await physics.initGalaxy({ preset: b.dataset.galPreset });
          selectDefaultTarget();
          renderScaleControls();
        });
      }
      scaleControlsEl.querySelector('#uv-gal-z-slider')?.addEventListener('input', async (e) => {
        const zMet = Number(e.target.value);
        const vEl = scaleControlsEl.querySelector('#uv-gal-z-val');
        if (vEl) vEl.textContent = zMet.toFixed(1);
        await physics.initGalaxy({ preset: physics.galaxyPreset, metallicity: zMet });
      });
    } else if (currentLevel === 2) {
      scaleControlsEl.innerHTML =
        `<div style="font-size:11.5px;color:var(--muted);line-height:1.4;">Live symplectic tiled WebGPU N-body integrating exact barycentric recoil. Pick the host star to dive into its fusion core (L3), or pick any planet to inspect its hydrostatic interior (L4).</div>`;
    } else if (currentLevel === 3) {
      scaleControlsEl.innerHTML = `
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${physics.stellarPreset === 'solar-nebula' ? 'active' : ''}" data-st-preset="solar-nebula" type="button">Solar</button>
          <button class="uv-seg-btn ${physics.stellarPreset === 'massive-supernova' ? 'active' : ''}" data-st-preset="massive-supernova" type="button">Massive</button>
          <button class="uv-seg-btn ${physics.stellarPreset === 'binary-nursery' ? 'active' : ''}" data-st-preset="binary-nursery" type="button">Binary</button>
        </div>
        <div class="uv-row">
          <span>Burn Accel</span>
          <input id="uv-st-accel" type="range" min="0.5" max="6.0" step="0.25" value="${physics.stellarTimeAccel}" />
          <span id="uv-st-accel-val" style="font-family:var(--mono);font-size:11px;">${physics.stellarTimeAccel.toFixed(1)}×</span>
        </div>`;
      for (const b of scaleControlsEl.querySelectorAll('[data-st-preset]')) {
        b.addEventListener('click', async () => {
          await physics.initStellarCore({ preset: b.dataset.stPreset });
          renderScaleControls();
        });
      }
      scaleControlsEl.querySelector('#uv-st-accel')?.addEventListener('input', (e) => {
        physics.setStellarTimeAccel(Number(e.target.value));
        const v = scaleControlsEl.querySelector('#uv-st-accel-val');
        if (v) v.textContent = `${physics.stellarTimeAccel.toFixed(1)}×`;
      });
    } else if (currentLevel === 4) {
      scaleControlsEl.innerHTML = `
        <div class="uv-seg-group">
          ${physics.PLANET_TEMPLATES.slice(0, 4).map((t) => (
            `<button class="uv-seg-btn ${physics.planetaryTemplate.id === t.id ? 'active' : ''}" data-pl-tpl="${t.id}" type="button">${t.id.slice(0, 5)}</button>`
          )).join('')}
        </div>
        <label class="uv-row">
          <span>3D Interior Cutaway</span>
          <input id="uv-cutaway-toggle" type="checkbox" ${physics.planetaryCutaway ? 'checked' : ''} />
        </label>`;
      for (const b of scaleControlsEl.querySelectorAll('[data-pl-tpl]')) {
        b.addEventListener('click', async () => {
          const tpl = physics.PLANET_TEMPLATES.find((p) => p.id === b.dataset.plTpl);
          if (tpl) {
            await physics.initPlanetaryInterior({ template: tpl });
            selectDefaultTarget();
            renderScaleControls();
          }
        });
      }
      scaleControlsEl.querySelector('#uv-cutaway-toggle')?.addEventListener('change', (e) => {
        physics.setPlanetaryCutaway(e.target.checked);
      });
    } else if (currentLevel === 5) {
      scaleControlsEl.innerHTML = `
        <div class="uv-row">
          <span>Element</span>
          <select id="uv-md-el-sel">${UNIVERSES_ELEMENT_CHOICES.map((e) => (
            `<option value="${e.Z}" ${e.Z === physics.mdElementZ ? 'selected' : ''}>${e.sym} · ${e.name}</option>`
          )).join('')}</select>
        </div>
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${physics.mdPhasePreset === 'solid' ? 'active' : ''}" data-md-phase="solid" type="button">Solid</button>
          <button class="uv-seg-btn ${physics.mdPhasePreset === 'melt' ? 'active' : ''}" data-md-phase="melt" type="button">Melt</button>
          <button class="uv-seg-btn ${physics.mdPhasePreset === 'vapor' ? 'active' : ''}" data-md-phase="vapor" type="button">Vapor</button>
        </div>
        <div class="uv-row">
          <span>Temp (K)</span>
          <input id="uv-md-temp" type="range" min="40" max="6000" step="20" value="${Math.min(6000, physics.mdTempK)}" />
          <span id="uv-md-temp-val" style="font-family:var(--mono);font-size:11px;">${physics.mdTempK} K</span>
        </div>
        <label class="uv-row" title="Toggle live downward GPU gravity inside the MD chamber">
          <span>MD Gravity</span>
          <input id="uv-md-grav" type="checkbox" ${physics.mdGravity ? 'checked' : ''} />
        </label>`;
      scaleControlsEl.querySelector('#uv-md-el-sel')?.addEventListener('change', async (e) => {
        await physics.initMolecularDynamics({ Z: Number(e.target.value), phasePreset: 'solid' });
        selectDefaultTarget();
        renderScaleControls();
      });
      for (const b of scaleControlsEl.querySelectorAll('[data-md-phase]')) {
        b.addEventListener('click', async () => {
          await physics.initMolecularDynamics({ Z: physics.mdElementZ, phasePreset: b.dataset.mdPhase });
          renderScaleControls();
        });
      }
      scaleControlsEl.querySelector('#uv-md-temp')?.addEventListener('input', (e) => {
        physics.setMdTemp(Number(e.target.value));
        const v = scaleControlsEl.querySelector('#uv-md-temp-val');
        if (v) v.textContent = `${physics.mdTempK} K`;
      });
      scaleControlsEl.querySelector('#uv-md-grav')?.addEventListener('change', (e) => {
        physics.setMdGravity(e.target.checked);
      });
    } else if (currentLevel === 6) {
      scaleControlsEl.innerHTML = `
        <div class="uv-seg-group">
          <button class="uv-seg-btn ${physics.quantumMode === 'atom' ? 'active' : ''}" data-qm-mode="atom" type="button">Atom (Dirac-KS)</button>
          <button class="uv-seg-btn ${physics.quantumMode === 'molecule' ? 'active' : ''}" data-qm-mode="molecule" type="button">Molecule (RHF)</button>
        </div>
        ${physics.quantumMode === 'atom' ? `
          <div class="uv-row">
            <span>Element</span>
            <select id="uv-qm-el-sel">${UNIVERSES_ELEMENT_CHOICES.map((e) => (
              `<option value="${e.Z}" ${e.Z === physics.quantumZ ? 'selected' : ''}>${e.sym} (Z=${e.Z})</option>`
            )).join('')}</select>
          </div>
          <div class="uv-row">
            <span>Orbital n/l/m</span>
            <select id="uv-qm-n">${[1, 2, 3, 4, 5, 6].map((v) => `<option value="${v}" ${v === physics.quantumN ? 'selected' : ''}>n=${v}</option>`).join('')}</select>
            <select id="uv-qm-l">${[0, 1, 2, 3].filter((v) => v < physics.quantumN).map((v) => `<option value="${v}" ${v === physics.quantumL ? 'selected' : ''}>${['s', 'p', 'd', 'f'][v]}</option>`).join('')}</select>
          </div>
          <label class="uv-row" title="Toggle 4-component relativistic Dirac-KS spin-orbit contraction">
            <span>Relativistic Dirac–KS</span>
            <input id="uv-qm-rel" type="checkbox" ${physics.quantumRelativistic ? 'checked' : ''} />
          </label>
        ` : `
          <div class="uv-seg-group">
            ${Object.keys(physics.MOLECULE_SPECS).map((k) => (
              `<button class="uv-seg-btn ${physics.quantumMoleculeKey === k ? 'active' : ''}" data-mol-key="${k}" type="button">${physics.MOLECULE_SPECS[k].formula}</button>`
            )).join('')}
          </div>
        `}`;
      for (const b of scaleControlsEl.querySelectorAll('[data-qm-mode]')) {
        b.addEventListener('click', async () => {
          await physics.initQuantumAtom({ mode: b.dataset.qmMode });
          selectDefaultTarget();
          renderScaleControls();
        });
      }
      scaleControlsEl.querySelector('#uv-qm-el-sel')?.addEventListener('change', async (e) => {
        await physics.initQuantumAtom({ Z: Number(e.target.value), n: null, l: null, m: 0 });
        selectDefaultTarget();
        renderScaleControls();
      });
      scaleControlsEl.querySelector('#uv-qm-n')?.addEventListener('change', async (e) => {
        const nn = Number(e.target.value);
        await physics.initQuantumAtom({ n: nn, l: Math.min(physics.quantumL, nn - 1), m: 0 });
        renderScaleControls();
      });
      scaleControlsEl.querySelector('#uv-qm-l')?.addEventListener('change', async (e) => {
        await physics.initQuantumAtom({ l: Number(e.target.value), m: 0 });
        renderScaleControls();
      });
      scaleControlsEl.querySelector('#uv-qm-rel')?.addEventListener('change', async (e) => {
        await physics.initQuantumAtom({ relativistic: e.target.checked });
        selectDefaultTarget();
      });
      for (const b of scaleControlsEl.querySelectorAll('[data-mol-key]')) {
        b.addEventListener('click', async () => {
          await physics.initQuantumAtom({ mode: 'molecule', moleculeKey: b.dataset.molKey });
          selectDefaultTarget();
          renderScaleControls();
        });
      }
    } else if (currentLevel === 7) {
      scaleControlsEl.innerHTML = `
        <div class="uv-row">
          <span>Isotope</span>
          <select id="uv-nuc-sel">${UNIVERSES_ELEMENT_CHOICES.map((e) => (
            `<option value="${e.Z}:${e.A}" ${e.Z === physics.nuclearZ ? 'selected' : ''}>${e.A}${e.sym} (Z=${e.Z})</option>`
          )).join('')}</select>
        </div>
        <button id="uv-tdse-reset" class="uv-btn subtle" type="button" style="justify-content:center;">↻ Reset Tunneling Wavepacket</button>`;
      scaleControlsEl.querySelector('#uv-nuc-sel')?.addEventListener('change', async (e) => {
        const [zStr, aStr] = e.target.value.split(':');
        await physics.initAtomicNucleus({ Z: Number(zStr), A: Number(aStr) });
        if (physics.nuclearResult?.volumeData) renderer.uploadNuclearVolume(physics.nuclearResult.volumeData);
        selectDefaultTarget();
      });
      scaleControlsEl.querySelector('#uv-tdse-reset')?.addEventListener('click', () => {
        physics.tdseSession?.resetWavepacket?.();
      });
    }
  }

  function getSelectedTarget() {
    const targets = physics.getTargetsForLevel(currentLevel);
    return targets.find((t) => t.id === selectedTargetId) || targets[0] || null;
  }

  function selectDefaultTarget() {
    const targets = physics.getTargetsForLevel(currentLevel);
    selectedTargetId = targets[0]?.id || null;
  }

  function syncScaleChrome() {
    const sc = UNIVERSES_SCALES[currentLevel];
    if (scaleBadge) scaleBadge.textContent = sc.exponentLabel;
    if (helpScaleTag) helpScaleTag.textContent = `L${sc.level}`;
    if (engineTag) engineTag.textContent = sc.engineSchema;
    if (plotTitle) plotTitle.textContent = sc.plotTitle;
    if (diveBtn) diveBtn.textContent = sc.diveButton;
    if (returnBtn) returnBtn.disabled = currentLevel === 0;
    if (orbitUpBtn) orbitUpBtn.disabled = currentLevel === 0;
    if (scaleRail) {
      for (const b of scaleRail.querySelectorAll('[data-level]')) {
        b.classList.toggle('active', Number(b.dataset.level) === currentLevel);
      }
    }
    if (breadcrumbEl) {
      const trimmed = pathHistory.slice(0, currentLevel + 1);
      breadcrumbEl.innerHTML = trimmed
        .map((seg, i) => (i === trimmed.length - 1 ? `<strong>${seg}</strong>` : seg))
        .join(' › ');
    }
    renderScaleControls();
  }

  // ---- Switch Active Scale (with Parent -> Child Provenance!) ----
  async function activateLevel(nextLevel, targetObj = null) {
    const lvl = Math.max(0, Math.min(7, Math.trunc(Number(nextLevel) || 0)));
    transitionBusy = true;
    statusDot?.classList.add('busy');
    try {
      // Propagate physical context downward from parent target
      if (lvl === 1 && targetObj?.morphology) {
        await physics.initGalaxy({ preset: targetObj.morphology, metallicity: targetObj.metallicity || 1.0 });
        pathHistory[1] = targetObj.name;
      } else if (lvl === 2 && targetObj) {
        await physics.initStarSystem({ starTarget: targetObj });
        pathHistory[2] = targetObj.name;
      } else if (lvl === 3) {
        const preset = (targetObj?.tempK || 5778) > 10000 ? 'massive-supernova' : 'solar-nebula';
        await physics.initStellarCore({ preset });
        pathHistory[3] = targetObj?.name ? `${targetObj.name} Core` : 'Stellar Core';
      } else if (lvl === 4) {
        const tpl = targetObj?.template || physics.planetaryTemplate;
        await physics.initPlanetaryInterior({ template: tpl });
        pathHistory[4] = targetObj?.name || tpl.label;
      } else if (lvl === 5) {
        const zSample = targetObj?.sampleZ || physics.mdElementZ || 26;
        await physics.initMolecularDynamics({ Z: zSample, phasePreset: 'solid' });
        const sym = physics.getCachedElementBundle(zSample)?.bundle?.symbol || `Z=${zSample}`;
        pathHistory[5] = `${sym} Lattice`;
      } else if (lvl === 6) {
        const zSample = targetObj?.sampleZ || physics.mdElementZ || physics.quantumZ || 26;
        await physics.initQuantumAtom({ Z: zSample, mode: 'atom' });
        const sym = physics.getCachedElementBundle(zSample)?.bundle?.symbol || `Z=${zSample}`;
        pathHistory[6] = `${sym} Atom`;
      } else if (lvl === 7) {
        const zSample = targetObj?.sampleZ || physics.quantumZ || 26;
        await physics.initAtomicNucleus({ Z: zSample });
        pathHistory[7] = `${physics.nuclearA}${physics.nuclearResult?.symbol || ''} Nucleus`;
      } else {
        await physics.ensureLevelInitialized(lvl);
      }

      if (lvl === 7 && physics.nuclearResult?.volumeData) {
        renderer.uploadNuclearVolume(physics.nuclearResult.volumeData);
      }

      currentLevel = lvl;
      if (!pathHistory[lvl]) pathHistory[lvl] = UNIVERSES_SCALES[lvl].shortLabel;
      const defCam = DEFAULT_CAMERA_BY_LEVEL[lvl];
      camState.yaw = defCam.yaw;
      camState.pitch = defCam.pitch;
      camState.dist = defCam.dist;
      camState.target = [0, 0, 0];
      selectDefaultTarget();
      syncScaleChrome();
    } finally {
      transitionBusy = false;
      statusDot?.classList.remove('busy');
    }
  }

  async function startHyperdriveToLevel(nextLevel, targetObj = null) {
    if (warp.active || transitionBusy) return;
    const fromSc = UNIVERSES_SCALES[currentLevel];
    const toSc = UNIVERSES_SCALES[nextLevel];
    warp.active = true;
    warp.startMs = performance.now();
    warp.toLevel = nextLevel;
    warp.swapped = false;
    warp.target = targetObj;
    if (warpKicker) warpKicker.textContent = nextLevel > currentLevel ? 'HYPERDRIVE ENGAGED' : 'ASCENDING SCALE LADDER';
    if (warpTitle) warpTitle.textContent = toSc.name.toUpperCase();
    if (warpSub) warpSub.textContent = `${fromSc.exponentLabel} → ${toSc.exponentLabel}`;
    warpOverlay?.classList.add('active');
  }

  async function initiateHyperdrive() {
    const t = getSelectedTarget();
    const nextLvl = t?.nextLevel != null ? t.nextLevel : ((currentLevel + 1) % 8);
    await startHyperdriveToLevel(nextLvl, t);
  }

  async function returnToOrbit() {
    if (currentLevel <= 0) return;
    await startHyperdriveToLevel(currentLevel - 1, null);
  }

  // ---- Wire Top / Drawer Controls ----
  diveBtn?.addEventListener('click', () => {
    autopilot = false;
    autopilotBtn?.classList.remove('active');
    void initiateHyperdrive();
  });
  returnBtn?.addEventListener('click', () => {
    autopilot = false;
    autopilotBtn?.classList.remove('active');
    void returnToOrbit();
  });
  orbitUpBtn?.addEventListener('click', () => {
    autopilot = false;
    autopilotBtn?.classList.remove('active');
    void returnToOrbit();
  });
  autopilotBtn?.addEventListener('click', () => {
    autopilot = !autopilot;
    autopilotDwellSec = 0;
    autopilotBtn.classList.toggle('active', autopilot);
    autopilotBtn.textContent = autopilot ? '⏹ Stop Tour' : '▶ Tour';
  });
  pauseBtn?.addEventListener('click', () => {
    running = !running;
    pauseBtn.textContent = running ? '⏸ Pause' : '▶ Resume';
    statusDot?.classList.toggle('paused', !running);
  });
  timeScaleSlider?.addEventListener('input', (e) => {
    timeScale = Number(e.target.value) || 1.0;
    if (timeScaleVal) timeScaleVal.textContent = `${timeScale.toFixed(1)}×`;
  });
  bigBangBtn?.addEventListener('click', async () => {
    bigBangFlash = 1.0;
    await physics.initCosmicWeb();
    await activateLevel(0);
  });
  reseedBtn?.addEventListener('click', async () => {
    bigBangFlash = 0.75;
    physics.setSeed((physics.seed + 7919) >>> 0);
    await physics.initCosmicWeb();
    if (currentLevel === 1) await physics.initGalaxy();
    else if (currentLevel === 2) await physics.initStarSystem();
    else if (currentLevel === 3) await physics.initStellarCore();
    selectDefaultTarget();
  });
  if (qualityGroup) {
    for (const btn of qualityGroup.querySelectorAll('[data-quality]')) {
      btn.addEventListener('click', async () => {
        const q = btn.dataset.quality;
        if (!physics.setQuality(q)) return;
        for (const other of qualityGroup.querySelectorAll('[data-quality]')) {
          other.classList.toggle('active', other.dataset.quality === q);
        }
        // Rebuild currently active level with new GPU particle count
        if (currentLevel === 0) await physics.initCosmicWeb();
        else if (currentLevel === 1) await physics.initGalaxy();
        else if (currentLevel === 3) await physics.initStellarCore();
        else if (currentLevel === 5) await physics.initMolecularDynamics();
        else if (currentLevel === 6) await physics.initQuantumAtom();
        else if (currentLevel === 7) {
          await physics.initAtomicNucleus();
          if (physics.nuclearResult?.volumeData) renderer.uploadNuclearVolume(physics.nuclearResult.volumeData);
        }
        renderScaleControls();
      });
    }
  }
  lensingToggle?.addEventListener('change', (e) => { lensingEnabled = e.target.checked; });
  orbitsToggle?.addEventListener('change', (e) => { showOrbits = e.target.checked; });
  travelToggle?.addEventListener('change', (e) => { showTravelPath = e.target.checked; });
  autoSpinToggle?.addEventListener('change', (e) => { cameraAutoSpin = e.target.checked; });
  crtToggle?.addEventListener('change', (e) => { retroCrt = e.target.checked; });
  pixelSlider?.addEventListener('input', (e) => {
    pixelSize = Number(e.target.value) || 3;
    if (pixelVal) pixelVal.textContent = `${pixelSize}×`;
  });
  peerConnectBtn?.addEventListener('click', async () => {
    const pm = physics.getPeerMeshState();
    if (pm.connected) {
      await physics.disconnectPeerMesh();
    } else {
      await physics.connectPeerMesh({
        relayUrl: peerUrlInput?.value || '',
        roomId: urlParams.get('peerRoom') || 'ulg-universes-mesh-v1',
        role: peerRoleSelect?.value || 'requester'
      });
    }
    updatePeerStatusUi();
  });

  function updatePeerStatusUi() {
    const pm = physics.getPeerMeshState();
    if (peerConnectBtn) peerConnectBtn.textContent = pm.connected ? 'Leave' : 'Join Mesh';
    if (peerStatusEl) {
      peerStatusEl.textContent = pm.connected
        ? `${pm.role} · ${pm.remotePeers} peers · ${pm.quorumReady ? '2-of-2 QUORUM READY' : 'waiting'}`
        : (pm.error ? `Error: ${pm.error}` : 'Local GPU · 0 remote peers');
    }
  }

  // ---- Interactive 3D Pointer Orbit, Zoom & Target Picking ----
  let pointerDown = false;
  let pointerMoved = false;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;

  function pickTargetAt(clientX, clientY) {
    const targets = physics.getTargetsForLevel(currentLevel);
    let best = null;
    let bestDist = 48;
    for (const t of targets) {
      const proj = projectWorldToScreen(t.pos, lastViewProj, lastCssW, lastCssH);
      if (!proj.visible) continue;
      const d = Math.hypot(proj.sx - clientX, proj.sy - clientY);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    pointerMoved = false;
    downX = e.clientX;
    downY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointerDown) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) pointerMoved = true;
      camState.yaw -= dx * 0.006;
      camState.pitch = Math.max(-1.42, Math.min(1.42, camState.pitch + dy * 0.006));
      lastX = e.clientX;
      lastY = e.clientY;
    } else {
      const hit = pickTargetAt(e.clientX, e.clientY);
      hoveredTargetId = hit?.id || null;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (pointerDown && !pointerMoved) {
      const hit = pickTargetAt(e.clientX, e.clientY);
      if (hit) {
        selectedTargetId = hit.id;
        autopilot = false;
        autopilotBtn?.classList.remove('active');
        if (autopilotBtn) autopilotBtn.textContent = '▶ Tour';
      }
    }
    pointerDown = false;
  });
  canvas.addEventListener('dblclick', (e) => {
    const hit = pickTargetAt(e.clientX, e.clientY);
    if (hit) selectedTargetId = hit.id;
    autopilot = false;
    autopilotBtn?.classList.remove('active');
    void initiateHyperdrive();
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.09 : 0.92;
    camState.dist = Math.max(3.2, Math.min(44.0, camState.dist * factor));
  }, { passive: false });

  // ---- 2D Emission Spectrograph & Live Scientific Plot Renderers ----
  function drawSpectrograph(target) {
    if (!specCanvas) return;
    const ctx2 = specCanvas.getContext('2d');
    if (!ctx2) return;
    const w = specCanvas.width;
    const h = specCanvas.height;
    ctx2.fillStyle = '#040812';
    ctx2.fillRect(0, 0, w, h);

    // Subtle faint continuum spectrum backdrop
    for (let x = 0; x < w; x += 2) {
      const nm = 380 + (x / w) * 340;
      const [r, g, b] = wavelengthNmToRgb(nm);
      ctx2.fillStyle = `rgba(${r},${g},${b},0.16)`;
      ctx2.fillRect(x, 0, 2, h);
    }
    const activeBundle = currentLevel >= 5
      ? physics.getCachedElementBundle(currentLevel === 5 ? physics.mdElementZ : physics.quantumZ, physics.quantumRelativistic)
      : null;
    const lines = buildEmissionLinesForContext(currentLevel, target, activeBundle);
    for (const ln of lines) {
      const x = ((ln.wavelengthNm - 380) / 340) * w;
      if (x < 0 || x > w) continue;
      const [r, g, b] = wavelengthNmToRgb(ln.wavelengthNm);
      const a = Math.max(0.25, Math.min(1, ln.intensity));
      ctx2.fillStyle = `rgba(${r},${g},${b},${a.toFixed(2)})`;
      ctx2.fillRect(x - 1.5, 0, 3, h);
      ctx2.fillStyle = `rgba(255,255,255,${(a * 0.45).toFixed(2)})`;
      ctx2.fillRect(x - 0.5, 2, 1, h - 4);
    }
  }

  function drawScientificPlot() {
    if (!plotCanvas) return;
    const ctx2 = plotCanvas.getContext('2d');
    if (!ctx2) return;
    const w = plotCanvas.width;
    const h = plotCanvas.height;
    ctx2.fillStyle = '#050b16';
    ctx2.fillRect(0, 0, w, h);
    ctx2.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx2.lineWidth = 1;
    ctx2.strokeRect(8, 8, w - 16, h - 18);

    const drawCurve = (xs, ys, color, fillRgba = null, dashed = false) => {
      if (!xs.length) return;
      ctx2.beginPath();
      if (dashed) ctx2.setLineDash([3, 3]);
      for (let i = 0; i < xs.length; i += 1) {
        if (i === 0) ctx2.moveTo(xs[i], ys[i]);
        else ctx2.lineTo(xs[i], ys[i]);
      }
      ctx2.strokeStyle = color;
      ctx2.lineWidth = dashed ? 1.2 : 2.0;
      ctx2.stroke();
      ctx2.setLineDash([]);
      if (fillRgba) {
        ctx2.lineTo(xs[xs.length - 1], h - 10);
        ctx2.lineTo(xs[0], h - 10);
        ctx2.closePath();
        ctx2.fillStyle = fillRgba;
        ctx2.fill();
      }
    };

    if (currentLevel === 0) {
      const pk = physics.cosmoTelemetry?.powerSpectrumPk;
      if (!pk?.kBins?.length) return;
      if (plotMeta) plotMeta.textContent = `D/D₀ = ${(pk.linearGrowthRatio || 1).toFixed(2)}× · ${pk.kBins.length} k-bins`;
      const logK = pk.kBins.map((k) => Math.log10(Math.max(1e-4, k)));
      const logP = pk.pkValues.map((p) => Math.log10(Math.max(1e-6, p)));
      const kMin = Math.min(...logK);
      const kMax = Math.max(kMin + 0.2, ...logK);
      const p0 = physics.cosmoFirstPk?.pkValues?.map((p) => Math.log10(Math.max(1e-6, p))) || [];
      const allP = [...logP, ...p0];
      const pMin = Math.min(...allP) - 0.3;
      const pMax = Math.max(pMin + 1.0, ...allP) + 0.3;
      const mx = (lk) => 12 + ((lk - kMin) / (kMax - kMin)) * (w - 24);
      const my = (lp) => (h - 12) - ((lp - pMin) / (pMax - pMin)) * (h - 24);
      if (p0.length === logK.length) {
        drawCurve(logK.map(mx), p0.map(my), 'rgba(148,163,184,0.6)', null, true);
      }
      drawCurve(logK.map(mx), logP.map(my), '#38bdf8', 'rgba(56,189,248,0.16)', false);
    } else if (currentLevel === 1) {
      if (plotMeta) plotMeta.textContent = `Gate 1 H/He/C/O · Z=${physics.galaxyMetallicity.toFixed(1)} Z☉`;
      const n = 48;
      const xs = []; const ys = [];
      for (let i = 0; i < n; i += 1) {
        const logT = 2.0 + (i / (n - 1)) * 6.0;
        const lam = physics.evaluateIsmRadiativeCoolingErgCm3PerS(Math.pow(10, logT), physics.galaxyMetallicity, physics.ismCoolingAnchors);
        const logL = Math.log10(Math.max(1e-28, lam));
        xs.push(12 + (i / (n - 1)) * (w - 24));
        ys.push((h - 12) - ((logL - (-26.5)) / 5.5) * (h - 24));
      }
      drawCurve(xs, ys.map((y) => Math.max(10, Math.min(h - 12, y))), '#a78bfa', 'rgba(167,139,250,0.18)', false);
    } else if (currentLevel === 2) {
      const targets = physics.getTargetsForLevel(2).slice(1);
      if (plotMeta) plotMeta.textContent = `${targets.length} worlds · Verlet N-body`;
      const barW = (w - 32) / Math.max(1, targets.length);
      targets.forEach((t, i) => {
        const frac = Math.min(1, Math.log10(Math.max(30, t.tempK)) / 3.4);
        const bh = frac * (h - 26);
        const bx = 16 + i * barW + 4;
        ctx2.fillStyle = `rgb(${Math.round(t.color0[0] * 255)},${Math.round(t.color0[1] * 255)},${Math.round(t.color0[2] * 255)})`;
        ctx2.fillRect(bx, h - 12 - bh, Math.max(8, barW - 10), bh);
        ctx2.fillStyle = '#94a3b8';
        ctx2.font = '9px monospace';
        ctx2.fillText(`${t.tempK}K`, bx, h - 15 - bh);
      });
    } else if (currentLevel === 3) {
      const tel = physics.stellarTelemetry;
      const T = Math.max(2e6, tel?.coreTempK || 1.5e7);
      const kTKeV = T * 8.617333262e-8;
      const EgKeV = 493.0;
      const peakKeV = 1.22 * Math.pow(Math.max(1e-2, T * 1e-6), 2 / 3);
      if (plotMeta) plotMeta.textContent = `E₀=${peakKeV.toFixed(1)} keV · LE ξ₁=${(physics.stellarLaneEmden?.solutions?.[1]?.xi1 || 6.9).toFixed(2)}`;
      const eMax = Math.max(20, peakKeV * 3.0);
      const n = 48;
      const xs = []; const mbY = []; const gamRaw = [];
      let gMax = 1e-300;
      for (let i = 1; i <= n; i += 1) {
        const e = (i / n) * eMax;
        const x = 12 + (i / n) * (w - 24);
        const mb = Math.exp(-Math.min(50, e / Math.max(1e-3, kTKeV)));
        const tun = Math.exp(-Math.min(60, Math.sqrt(EgKeV / Math.max(0.05, e))));
        const g = mb * tun;
        if (g > gMax) gMax = g;
        xs.push(x);
        mbY.push((h - 12) - Math.min(1, mb) * (h - 24));
        gamRaw.push(g);
      }
      const gamY = gamRaw.map((g) => (h - 12) - (g / Math.max(1e-300, gMax)) * (h - 24));
      drawCurve(xs, mbY, 'rgba(251,191,36,0.65)', null, true);
      drawCurve(xs, gamY, '#34d399', 'rgba(52,211,153,0.28)', false);
    } else if (currentLevel === 4) {
      const prof = physics.planetaryResult?.profile || [];
      if (!prof.length) return;
      const rMax = Math.max(1, physics.planetaryResult.radiusM || 6.37e6);
      const pMax = Math.max(1e9, prof[0].pressurePa || 360e9);
      const rhoMax = Math.max(2000, ...prof.map((p) => p.densityKgPerM3 || 0));
      if (plotMeta) plotMeta.textContent = `P_c=${(pMax / 1e9).toFixed(0)} GPa · MoI=${(physics.planetaryResult.moiFactor || 0.33).toFixed(3)}`;
      const xs = prof.map((p) => 12 + (p.radiusM / rMax) * (w - 24));
      const pYs = prof.map((p) => (h - 12) - (p.pressurePa / pMax) * (h - 24));
      const rYs = prof.map((p) => (h - 12) - (p.densityKgPerM3 / rhoMax) * (h - 24));
      drawCurve(xs, pYs, '#fb923c', 'rgba(251,146,60,0.16)', false);
      drawCurve(xs, rYs, '#38bdf8', null, false);
    } else if (currentLevel === 5) {
      const rdf = physics.mdRdfHistory;
      if (!rdf?.length) return;
      if (plotMeta) plotMeta.textContent = `Phase: ${physics.mdTelemetry?.emergentPhase || '—'} · ⟨Z⟩=${(physics.mdTelemetry?.meanCoordination || 0).toFixed(1)}`;
      const peak = Math.max(1, ...rdf);
      const xs = rdf.map((_, i) => 12 + (i / (rdf.length - 1)) * (w - 24));
      const ys = rdf.map((v) => (h - 12) - (v / peak) * (h - 24));
      drawCurve(xs, ys, '#34d399', 'rgba(52,211,153,0.22)', false);
    } else if (currentLevel === 6) {
      const res = physics.getCachedElementBundle(physics.quantumZ, physics.quantumRelativistic);
      const atom = res?.visualData?.atom;
      if (!atom?.rGrid?.length || !atom?.rho?.length) return;
      if (plotMeta) plotMeta.textContent = `Dirac–KS ${physics.quantumRelativistic ? 'Rel ON' : 'Rel OFF'} · Z=${physics.quantumZ}`;
      const n = Math.min(120, atom.rGrid.length);
      const vals = [];
      let vmax = 1e-9;
      for (let i = 0; i < n; i += 1) {
        const r = atom.rGrid[i];
        const v = 4 * Math.PI * r * r * Math.max(0, atom.rho[i]);
        if (v > vmax) vmax = v;
        vals.push(v);
      }
      const xs = vals.map((_, i) => 12 + (i / (vals.length - 1)) * (w - 24));
      const ys = vals.map((v) => (h - 12) - (v / vmax) * (h - 24));
      drawCurve(xs, ys, '#38bdf8', 'rgba(56,189,248,0.22)', false);
    } else if (currentLevel === 7) {
      const td = physics.tdseTelemetry;
      if (!td?.prob?.length) return;
      if (plotMeta) plotMeta.textContent = `P_in=${(td.pInside * 100).toFixed(1)}% · P_tun=${(td.pTunneled * 100).toFixed(2)}%`;
      const n = td.prob.length;
      const pMax = Math.max(1e-4, ...td.prob);
      const vMax = Math.max(1, ...td.potRawMeV);
      const xs = Array.from({ length: n }, (_, i) => 12 + (i / (n - 1)) * (w - 24));
      const vYs = Array.from({ length: n }, (_, i) => (h - 12) - Math.max(0, td.potRawMeV[i] / vMax) * (h - 26));
      const pYs = Array.from({ length: n }, (_, i) => (h - 12) - (td.prob[i] / pMax) * (h - 24));
      drawCurve(xs, vYs, 'rgba(251,191,36,0.72)', null, true);
      drawCurve(xs, pYs, '#34d399', 'rgba(52,211,153,0.28)', false);
    }
  }

  function updateInspectorCard() {
    const sc = UNIVERSES_SCALES[currentLevel];
    const target = getSelectedTarget();
    if (targetKicker) targetKicker.textContent = `L${sc.level} · ${sc.name.toUpperCase()} · ${sc.exponentLabel}`;
    if (targetName) targetName.textContent = target?.name || sc.name;
    if (targetSub) targetSub.textContent = target?.subtitle || sc.engineSchema;
    if (compText) compText.textContent = target?.composition || '';
    if (specTitle) specTitle.textContent = currentLevel >= 5 ? 'GATE 1 OPTICAL SPECTRUM' : 'EMISSION SPECTROGRAPH';

    let cells = [];
    if (currentLevel === 0) {
      const ct = physics.cosmoTelemetry;
      cells = [
        ['Scale a(t)', ct ? ct.scaleFactorA.toFixed(3) : '—'],
        ['Redshift z', ct ? ct.redshiftZ.toFixed(2) : '—'],
        ['Density σ', ct ? ct.sigmaDensity.toFixed(3) : '—'],
        ['GPU Submits', ct ? `${ct.submitsPerStep}/step` : '—']
      ];
    } else if (currentLevel === 1) {
      cells = [
        ['GPU Stars', `${(physics.galaxyEngine?.count || 0).toLocaleString()}`],
        ['Gravity', 'SS Scale-Atlas'],
        ['Steps', `${physics.galaxyEngine?.stepIndex || 0}`],
        ['SMBH Lensing', lensingEnabled ? 'Active WGSL' : 'OFF']
      ];
    } else if (currentLevel === 2) {
      cells = [
        ['Target Mass', target?.massLabel || '—'],
        ['T_eq / T_eff', target ? `${target.tempK.toLocaleString()} K` : '—'],
        ['GPU Steps', `${physics.systemEngine?.stepIndex || 0}`],
        ['Integrator', 'Symplectic GPU']
      ];
    } else if (currentLevel === 3) {
      const st = physics.stellarTelemetry;
      cells = [
        ['Core Temp', st ? `${(st.coreTempK / 1e6).toFixed(2)} MK` : '—'],
        ['Stage', st?.stage || 'hydro-collapse'],
        ['GPU Steps', `${physics.stellarEngine?.stepIndex || 0}`],
        ['LE n=3 ξ₁', `${(physics.stellarLaneEmden?.solutions?.[1]?.xi1 || 6.9).toFixed(3)}`]
      ];
    } else if (currentLevel === 4) {
      const pr = physics.planetaryResult;
      cells = [
        ['Radius', pr ? `${(pr.radiusM / 1e3).toFixed(0)} km` : '—'],
        ['Mass', pr ? `${(pr.massKg / 5.9722e24).toFixed(2)} M⊕` : '—'],
        ['MoI I/MR²', pr ? pr.moiFactor.toFixed(4) : '—'],
        ['Polytope', pr?.valid ? 'VALID (Fail-Closed)' : 'OUT-OF-DOMAIN']
      ];
    } else if (currentLevel === 5) {
      const mt = physics.mdTelemetry;
      cells = [
        ['Temp', mt ? `${Math.round(mt.temperatureK)} K` : `${physics.mdTempK} K`],
        ['Pressure', mt ? `${mt.pressureGPa.toFixed(2)} GPa` : '—'],
        ['Coord ⟨Z⟩', mt ? mt.meanCoordination.toFixed(2) : '—'],
        ['Gravity', physics.mdGravity ? 'ON (GPU)' : 'Zero-G']
      ];
    } else if (currentLevel === 6) {
      const b = physics.getCachedElementBundle(physics.quantumZ, physics.quantumRelativistic)?.bundle;
      const rgb = Array.isArray(b?.electromagnetic?.opticalSrgb) ? b.electromagnetic.opticalSrgb : [0.8, 0.85, 0.9];
      const eHa = Number(b?.atomic?.totalEnergyHa);
      cells = [
        ['Samples', `${(physics.orbitalCloud?.pointCount || 0).toLocaleString()} pts`],
        ['Dirac E_tot', Number.isFinite(eHa) ? `${eHa.toFixed(1)} Ha` : '—'],
        ['Magnetic', b?.electromagnetic?.magneticPhase || '—'],
        ['Gate 1 sRGB', `[${rgb.map((v) => Number(v || 0).toFixed(2)).join(',')}]`]
      ];
    } else if (currentLevel === 7) {
      const nr = physics.nuclearResult;
      const td = physics.tdseTelemetry;
      const ba = Number(nr?.bindingPerNucleonMeV);
      const rc = Number(nr?.chargeRadiusFm);
      cells = [
        ['B / A', Number.isFinite(ba) ? `${ba.toFixed(3)} MeV` : '—'],
        ['Radius R_c', Number.isFinite(rc) ? `${rc.toFixed(2)} fm` : '—'],
        ['TDSE Steps', `${td?.stepCount || 0}`],
        ['P_tunneled', td ? `${(td.pTunneled * 100).toFixed(2)}%` : '—']
      ];
    }

    if (statsGrid) {
      statsGrid.innerHTML = cells.map(([k, v]) => (
        `<div class="uv-stat-cell"><div class="uv-stat-k">${k}</div><div class="uv-stat-v">${v}</div></div>`
      )).join('');
    }
    drawSpectrograph(target);
    drawScientificPlot();
  }

  // ---- Draw 2D HUD Target Reticles ----
  function drawReticles(viewProj) {
    if (!reticleCtx) return;
    reticleCtx.clearRect(0, 0, lastCssW, lastCssH);
    const targets = physics.getTargetsForLevel(currentLevel);
    if (!targets.length) return;
    for (const t of targets) {
      const p = projectWorldToScreen(t.pos, viewProj, lastCssW, lastCssH);
      if (!p.visible) continue;
      const isSel = t.id === selectedTargetId;
      const isHov = t.id === hoveredTargetId;
      if (!isSel && !isHov && currentLevel >= 3 && currentLevel !== 4) continue;
      const r = isSel ? 22 : (isHov ? 18 : 11);
      reticleCtx.strokeStyle = isSel ? 'rgba(56, 189, 248, 0.92)' : (isHov ? 'rgba(186, 230, 253, 0.78)' : 'rgba(148, 163, 184, 0.36)');
      reticleCtx.lineWidth = isSel ? 1.8 : 1.1;
      const arm = Math.max(5, r * 0.42);
      // 4 crisp corner brackets
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        reticleCtx.beginPath();
        reticleCtx.moveTo(p.sx + sx * r, p.sy + sy * (r - arm));
        reticleCtx.lineTo(p.sx + sx * r, p.sy + sy * r);
        reticleCtx.lineTo(p.sx + sx * (r - arm), p.sy + sy * r);
        reticleCtx.stroke();
      }
      if (isSel || isHov) {
        reticleCtx.font = '600 11px monospace';
        reticleCtx.fillStyle = isSel ? '#e0f2fe' : '#cbd5e1';
        reticleCtx.fillText(t.name, p.sx + r + 7, p.sy + 4);
      }
    }
  }

  // ---- Build Scene Draw Lists for Current Level ----
  function buildScenePayload(camera, nowSec) {
    const payload = {
      camera,
      particleCloud: null,
      spheres: null,
      lightDir: [0.6, 0.75, 0.55],
      mdCloud: null,
      disks: null,
      lines: null,
      nuclearVol: null,
      post: {
        bhUv: [0.5, 0.5],
        bhStrength: 0,
        warpAmount: warp.amount,
        flashAmount: bigBangFlash,
        crtEnabled: retroCrt,
        pixelSize,
        timeSec: nowSec
      }
    };

    if (currentLevel === 0 && physics.cosmoSession) {
      payload.particleCloud = {
        buffer: physics.cosmoSession.particlesBuffer,
        count: physics.cosmoSession.particleCount,
        mode: 0,
        worldScale: 20.0 / Math.max(1, physics.cosmoSession.boxLengthMpc),
        pointSize: 0.11,
        alphaGain: 0.46
      };
      if (showOrbits) {
        payload.lines = buildBoxWireframeLines([10.0, 10.0, 10.0], [0.24, 0.56, 0.92, 0.25]);
      }
    } else if (currentLevel === 1 && physics.galaxyEngine) {
      payload.particleCloud = {
        buffer: physics.galaxyEngine.getResidentBuffer(),
        count: physics.galaxyEngine.count,
        mode: 1,
        worldScale: 1.0,
        pointSize: 0.095,
        alphaGain: 0.34
      };
      const smbhPos = physics.galaxySmbhPos;
      payload.spheres = [{
        pos: smbhPos,
        radius: 0.58,
        color0: [0.0, 0.0, 0.0],
        color1: [0.0, 0.0, 0.0],
        kind: 5
      }];
      payload.disks = [{
        center: smbhPos,
        rIn: 0.68,
        normal: [0.08, 0.97, 0.22],
        rOut: 2.55,
        color: [1.0, 0.85, 0.55],
        kind: 0
      }];
      if (lensingEnabled) {
        const projBh = projectWorldToScreen(smbhPos, camera.viewProj, lastCssW, lastCssH);
        if (projBh.visible) {
          payload.post.bhUv = [projBh.uvX, projBh.uvY];
          payload.post.bhStrength = 0.0018 * Math.pow(22.0 / Math.max(6.0, camState.dist), 1.2);
        }
      }
    } else if (currentLevel === 2 && physics.systemBodies) {
      const targets = physics.getTargetsForLevel(2);
      const starPos = targets[0]?.pos || [0, 0, 0];
      payload.spheres = targets.map((t, idx) => ({
        pos: t.pos,
        radius: t.radius,
        color0: t.color0,
        kind: t.kind,
        color1: t.color1,
        atm: t.atm ?? 0.35,
        seed: idx * 2.13 + 1.1
      }));
      // Light direction from host star toward selected/first planet
      const sel = getSelectedTarget();
      if (sel && sel.bodyIndex > 0) {
        payload.lightDir = vec3Norm(vec3Sub(starPos, sel.pos));
      }
      const ringed = targets.find((t) => t.ringed);
      if (ringed) {
        payload.disks = [{
          center: ringed.pos,
          rIn: ringed.radius * 1.35,
          normal: [0.18, 0.94, 0.28],
          rOut: ringed.radius * 2.45,
          color: [0.88, 0.78, 0.62],
          kind: 1
        }];
      }
      if (showOrbits || showTravelPath) {
        const lineChunks = [];
        if (showOrbits) {
          lineChunks.push(...buildOsculatingOrbitLines(physics.systemBodies, targets, 1.0));
          for (let i = 1; i < physics.systemOrbitHistory.length; i += 1) {
            const hist = physics.systemOrbitHistory[i];
            if (hist.length < 2) continue;
            const c = targets[i]?.color0 || [0.35, 0.75, 1.0];
            for (let j = 0; j < hist.length - 1; j += 1) {
              const fade = 0.18 + 0.62 * (j / hist.length);
              lineChunks.push(...hist[j], c[0], c[1], c[2], fade);
              lineChunks.push(...hist[j + 1], c[0], c[1], c[2], fade);
            }
          }
        }
        if (showTravelPath && sel && sel.bodyIndex > 0) {
          lineChunks.push(...starPos, 0.22, 0.88, 1.0, 0.55);
          lineChunks.push(...sel.pos, 0.22, 0.88, 1.0, 0.85);
        }
        if (lineChunks.length >= 14) payload.lines = new Float32Array(lineChunks);
      }
    } else if (currentLevel === 3 && physics.stellarEngine) {
      payload.particleCloud = {
        buffer: physics.stellarEngine.getResidentBuffer(),
        count: physics.stellarEngine.count,
        mode: 2,
        worldScale: 0.78,
        pointSize: 0.17,
        alphaGain: 0.44
      };
    } else if (currentLevel === 4) {
      const tpl = physics.planetaryTemplate;
      const meta0 = physics.getTargetsForLevel(4)[0];
      payload.spheres = [{
        pos: [0, 0, 0],
        radius: 3.2,
        color0: tpl.color0,
        kind: 4,
        color1: tpl.color1,
        atm: tpl.atm ?? 0.5,
        rCore: meta0?.rCoreNorm ?? 0.52,
        rMantle: meta0?.rMantleNorm ?? 0.94,
        cutaway: physics.planetaryCutaway,
        seed: 4.2
      }];
      payload.lightDir = [0.65, 0.55, 0.52];
    } else if (currentLevel === 5 && physics.mdSession) {
      const box = physics.mdSession.boxLengthsA;
      const maxDim = Math.max(box[0], box[1], box[2], 6.0);
      const worldScale = 7.2 / maxDim;
      const b = physics.getCachedElementBundle(physics.mdElementZ, true)?.bundle;
      const rgb = b?.electromagnetic?.opticalSrgb || [0.76, 0.80, 0.86];
      payload.mdCloud = {
        positionsBuffer: physics.mdSession.positionsBuffer,
        velocitiesBuffer: physics.mdSession.velocitiesBuffer,
        count: physics.mdSession.atomCount,
        halfBox: [box[0] * 0.5, box[1] * 0.5, box[2] * 0.5],
        worldScale,
        radius: Math.max(0.14, Math.min(0.42, (physics.mdSession.rNearestNeighborA || 2.5) * 0.34 * worldScale)),
        baseRgb: rgb,
        idealCoord: physics.mdSession.idealCoordination || 12
      };
      if (showOrbits) {
        payload.lines = buildBoxWireframeLines(
          [box[0] * 0.5 * worldScale, box[1] * 0.5 * worldScale, box[2] * 0.5 * worldScale],
          [0.32, 0.80, 1.0, 0.42]
        );
      }
    } else if (currentLevel === 6 && physics.orbitalCloud) {
      const b = physics.getCachedElementBundle(physics.quantumZ, physics.quantumRelativistic)?.bundle;
      const rgb = b?.electromagnetic?.opticalSrgb || [0.22, 0.86, 1.0];
      payload.particleCloud = {
        buffer: physics.orbitalCloud.pointsBuffer,
        count: physics.orbitalCloud.pointCount,
        mode: 3,
        worldScale: 3.6,
        pointSize: 0.036,
        alphaGain: 0.068,
        colorPos: physics.quantumMode === 'atom' ? [0.18, 0.86, 1.0] : [0.26, 0.92, 0.86],
        colorNeg: physics.quantumMode === 'atom' ? [Math.max(0.68, rgb[0]), Math.max(0.48, rgb[1]), Math.min(0.45, rgb[2])] : [1.0, 0.42, 0.62]
      };
      if (physics.quantumMode === 'molecule') {
        const spec = physics.MOLECULE_SPECS[physics.quantumMoleculeKey];
        const scale = 3.6 / 4.2;
        payload.spheres = spec.atoms.map((a) => ({
          pos: [a.position[0] * scale, a.position[1] * scale, a.position[2] * scale],
          radius: a.Z === 1 ? 0.22 : 0.36,
          color0: a.Z === 8 ? [0.95, 0.28, 0.28] : (a.Z === 6 ? [0.45, 0.52, 0.60] : [0.92, 0.96, 1.0]),
          color1: [0.6, 0.8, 1.0],
          kind: 5
        }));
      } else {
        // Tiny glowing nucleus pin at center of atom
        payload.spheres = [{
          pos: [0, 0, 0],
          radius: 0.14,
          color0: [1.0, 0.72, 0.32],
          color1: [1.0, 0.94, 0.72],
          kind: 0
        }];
      }
    } else if (currentLevel === 7 && physics.nuclearResult) {
      const td = physics.tdseTelemetry;
      let peakIdx = 20;
      let peakVal = -1;
      if (td?.prob?.length) {
        for (let i = 0; i < td.prob.length; i += 1) {
          if (td.prob[i] > peakVal) { peakVal = td.prob[i]; peakIdx = i; }
        }
      }
      payload.nuclearVol = {
        dim: physics.nuclearResult.volDim || 28,
        boxRadius: 3.2,
        tdseTunneled: td?.pTunneled || 0,
        tdseCrestNorm: Math.max(0.32, Math.min(0.95, peakIdx / Math.max(1, (td?.prob?.length || 128) - 1)))
      };
    }

    return payload;
  }

  // ---- Main Render & Physics Loop ----
  let lastFrameMs = performance.now();
  let lastStaticRenderMs = 0;
  let hudTickAccum = 0;
  let fpsAccum = 0;
  let fpsFrames = 0;
  let fpsDisplay = 60;

  function renderNow(nowMs = performance.now()) {
    syncCanvasSize();
    const cp = Math.cos(camState.pitch);
    const sp = Math.sin(camState.pitch);
    const cy = Math.cos(camState.yaw);
    const sy = Math.sin(camState.yaw);
    const eye = [
      camState.target[0] + camState.dist * cp * sy,
      camState.target[1] + camState.dist * sp,
      camState.target[2] + camState.dist * cp * cy
    ];
    const aspect = canvas.width / Math.max(1, canvas.height);
    const fovRad = (48 * Math.PI) / 180;
    const proj = mat4PerspectiveWebGpu(fovRad, aspect, 0.1, 220.0);
    const look = mat4LookAt(eye, camState.target, [0, 1, 0]);
    const viewProj = mat4Mul(proj, look.mat);
    lastViewProj = viewProj;

    const camera = {
      viewProj,
      pos: eye,
      right: look.right,
      up: look.up,
      fwd: look.fwd,
      aspect,
      fovTanHalf: Math.tan(fovRad * 0.5),
      timeSec: nowMs * 0.001,
      level: currentLevel
    };

    const scenePayload = buildScenePayload(camera, nowMs * 0.001);
    renderer.renderFrame(scenePayload);
    drawReticles(viewProj);
  }

  function frame(nowMs) {
    if (disposed) return;
    rafId = requestAnimationFrame(frame);

    const dtSec = Math.min(0.1, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
    lastFrameMs = nowMs;
    fpsAccum += dtSec;
    fpsFrames += 1;
    if (fpsAccum >= 0.45) {
      fpsDisplay = Math.round(fpsFrames / fpsAccum);
      fpsAccum = 0;
      fpsFrames = 0;
    }

    if (cameraAutoSpin && !pointerDown) {
      camState.yaw += dtSec * 0.22;
    }
    if (bigBangFlash > 0) {
      bigBangFlash = Math.max(0, bigBangFlash - dtSec * 1.45);
    }

    // Hyperdrive transition progression
    if (warp.active) {
      const t = Math.min(1, (nowMs - warp.startMs) / warp.durationMs);
      warp.amount = Math.sin(t * Math.PI);
      if (t >= 0.48 && !warp.swapped) {
        warp.swapped = true;
        void activateLevel(warp.toLevel, warp.target);
      }
      if (t >= 1) {
        warp.active = false;
        warp.amount = 0;
        warpOverlay?.classList.remove('active');
      }
    }

    // Hands-free Autopilot 40-OOM guided tour
    if (autopilot && !warp.active && !transitionBusy) {
      autopilotDwellSec += dtSec;
      if (autopilotDwellSec >= 4.4) {
        autopilotDwellSec = 0;
        void initiateHyperdrive();
      }
    }

    // Advance live WebGPU physics for the active scale
    if (running && !transitionBusy) {
      void physics.stepLevel(currentLevel, timeScale);
    }

    // On static-solution scales (L4 Planetary Cutaway, L6 Dirac-KS Cloud), avoid burning
    // 60 FPS GPU/CPU when camera & transitions are idle; respond instantly to interaction!
    const isStaticScale = (currentLevel === 4 || currentLevel === 6)
      && !pointerDown && !cameraAutoSpin && !warp.active && bigBangFlash <= 0;
    if (!isStaticScale || (nowMs - lastStaticRenderMs) >= 120) {
      lastStaticRenderMs = nowMs;
      renderNow(nowMs);
    }

    hudTickAccum += dtSec;
    if (hudTickAccum >= 0.18) {
      hudTickAccum = 0;
      if (fpsBadge) fpsBadge.textContent = `${fpsDisplay} FPS · WebGPU`;
      updateInspectorCard();
      updatePeerStatusUi();
    }
  }

  // ---- Initial Boot: Initialize Active Level + Optional PeerCompute Relay ----
  await activateLevel(initialLevel);
  const urlPeerRelay = urlParams.get('peerRelay');
  if (urlPeerRelay) {
    if (peerUrlInput) peerUrlInput.value = urlPeerRelay;
    const role = urlParams.get('peerRole') || 'requester';
    if (peerRoleSelect) peerRoleSelect.value = role;
    await physics.connectPeerMesh({
      relayUrl: urlPeerRelay,
      roomId: urlParams.get('peerRoom') || 'ulg-universes-mesh-v1',
      role
    });
    updatePeerStatusUi();
  }
  updateInspectorCard();
  const handleUnload = () => { void physics.disconnectPeerMesh(); };
  window.addEventListener('pagehide', handleUnload);
  window.addEventListener('beforeunload', handleUnload);
  rafId = requestAnimationFrame(frame);

  return Object.freeze({
    getState() {
      const sc = UNIVERSES_SCALES[currentLevel];
      const cosmoSt = physics.cosmoSession?.getState?.() || null;
      return {
        ready: true,
        level: currentLevel,
        scaleId: sc.id,
        scaleName: sc.name,
        log10ViewSpanM: sc.log10SpanM,
        totalSpanOom: 40,
        gpuBackend: 'webgpu',
        cameraAutoSpin,
        running,
        autopilot,
        retroCrt,
        lensingEnabled,
        qualityId: physics.quality.id,
        seed: physics.seed,
        gpuErrorCount: gpuErrorBucket.length,
        gpuErrors: [...gpuErrorBucket],
        scientificValidation: false,
        // Live metrics across all 8 real WebGPU engines
        cosmicWebSteps: cosmoSt?.stepIndex ?? 0,
        scaleFactorA: cosmoSt?.aScale ?? null,
        redshiftZ: cosmoSt?.redshiftZ ?? null,
        submitsPerStep: physics.cosmoTelemetry?.submitsPerStep ?? cosmoSt?.submitsPerStep ?? null,
        sigmaDensity: physics.cosmoTelemetry?.sigmaDensity ?? null,
        powerSpectrumPk: physics.cosmoTelemetry?.powerSpectrumPk ?? null,
        galacticSteps: physics.galaxyEngine?.stepIndex ?? 0,
        galacticBodyCount: physics.galaxyEngine?.count ?? 0,
        galacticGravityMode: physics.galaxyEngine?.gravityMode ?? null,
        planetarySteps: physics.systemEngine?.stepIndex ?? 0,
        stellarSteps: physics.stellarEngine?.stepIndex ?? 0,
        stellarCoreTempK: physics.stellarTelemetry?.coreTempK ?? null,
        planetaryInteriorValid: Boolean(physics.planetaryResult?.valid),
        planetaryMoiFactor: physics.planetaryResult?.moiFactor ?? null,
        mdSteps: physics.mdTelemetry?.totalSteps ?? 0,
        mdAtomCount: physics.mdSession?.atomCount ?? 0,
        mdGravity: physics.mdGravity,
        mdElementZ: physics.mdElementZ,
        quantumZ: physics.quantumZ,
        quantumRelativistic: physics.quantumRelativistic,
        orbitalPointCount: physics.orbitalCloud?.pointCount ?? 0,
        nuclearZ: physics.nuclearZ,
        nuclearA: physics.nuclearA,
        nuclearBindingPerNucleonMeV: physics.nuclearResult?.bindingPerNucleonMeV ?? null,
        tdseSteps: physics.tdseTelemetry?.stepCount ?? 0,
        selectedTarget: getSelectedTarget()?.id ?? null,
        peerMeshState: physics.getPeerMeshState()
      };
    },
    async setLevel(lvl, { instant = true, target = null } = {}) {
      if (instant) {
        await activateLevel(lvl, target);
        updateInspectorCard();
      } else {
        await startHyperdriveToLevel(lvl, target);
      }
      return this.getState();
    },
    selectTarget(id) {
      const targets = physics.getTargetsForLevel(currentLevel);
      if (targets.some((t) => t.id === id)) {
        selectedTargetId = id;
        updateInspectorCard();
        return true;
      }
      return false;
    },
    initiateHyperdrive,
    returnToOrbit,
    setAutopilot(enabled) {
      autopilot = Boolean(enabled);
      autopilotDwellSec = 0;
      autopilotBtn?.classList.toggle('active', autopilot);
      if (autopilotBtn) autopilotBtn.textContent = autopilot ? '⏹ Stop Tour' : '▶ Tour';
    },
    setRetroCrt(enabled, px = pixelSize) {
      retroCrt = Boolean(enabled);
      pixelSize = Math.max(1, Math.min(6, Math.trunc(Number(px) || 3)));
      if (crtToggle) crtToggle.checked = retroCrt;
      if (pixelSlider) pixelSlider.value = String(pixelSize);
      if (pixelVal) pixelVal.textContent = `${pixelSize}×`;
    },
    setCameraAutoSpin(enabled) {
      cameraAutoSpin = Boolean(enabled);
      if (autoSpinToggle) autoSpinToggle.checked = cameraAutoSpin;
    },
    async bigBang() {
      bigBangFlash = 1.0;
      await physics.initCosmicWeb();
      await activateLevel(0);
      return this.getState();
    },
    async reseed(nextSeed = null) {
      physics.setSeed(nextSeed ?? ((physics.seed + 7919) >>> 0));
      await physics.initCosmicWeb();
      return this.getState();
    },
    connectPeerMesh: (opts) => physics.connectPeerMesh(opts),
    disconnectPeerMesh: () => physics.disconnectPeerMesh(),
    dispatchPeerDerivation: (Z) => physics.dispatchPeerDerivation(Z),
    async stepOnce() {
      await physics.stepLevel(currentLevel, timeScale);
      updateInspectorCard();
      return this.getState();
    },
    capturePng() {
      renderNow(performance.now());
      return canvas.toDataURL('image/png');
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncCanvasSize);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
      physics.dispose();
      renderer.dispose();
    }
  });
}
