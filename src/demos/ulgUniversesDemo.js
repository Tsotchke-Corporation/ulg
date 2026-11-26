// ULG Universes Continuous 40-Order-of-Magnitude Controller (`src/demos/ulgUniversesDemo.js`).
//
// True continuous logarithmic scale zoom (`log10ViewSpanM` from +25.4 -> -14.8, 40.2 OOM)
// driven directly by mouse wheel, trackpad pinch, continuous scrubber slider, or smooth
// fly-to transitions — with simultaneous multi-scale 3D crossfading and true astronomical
// relative scales (`R_earth / R_sun = 0.00916`, `R_jup / R_sun = 0.1005`) on live WebGPU
// double-float symplectic N-body gravity.

import { attachWebGpuUncapturedErrorTelemetry } from '../runtime/webgpuDeviceLimits.js';
import {
  GPU_PICK_LAYOUT,
  createGpuEntityPickerWebGpu
} from '../runtime/gpuMath/gpuEntityPickerWebGpu.js';
import {
  AU_METERS,
  G_AU_SOLAR_YR,
  REAL_SOLAR_SYSTEM_CATALOG
} from '../runtime/astrophysics/solarSystemNBodyGpu.js';
import {
  LOG10_SPAN_MAX,
  LOG10_SPAN_MIN,
  QUALITY_PRESETS,
  UNIVERSES_ELEMENT_CHOICES,
  UNIVERSES_SCALES,
  buildAboutScaleHtml,
  buildAboutUlgUniversesHtml,
  formatPhysicalSpan
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
  if (cw <= 0.02) return { visible: false, sx: -999, sy: -999, uvX: 0.5, uvY: 0.5, depth: 1 };
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

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / Math.max(1e-6, e1 - e0));
  return t * t * (3 - 2 * t);
}

// Smooth bell weight across [loFadeOut .. loFull .. hiFull .. hiFadeOut]
function bandWeight(x, loOut, loIn, hiIn, hiOut) {
  if (x <= loOut || x >= hiOut) return 0;
  if (x < loIn) return smoothstep(loOut, loIn, x);
  if (x > hiIn) return 1 - smoothstep(hiIn, hiOut, x);
  return 1;
}

function buildBoxWireframeLines(halfBox, color = [0.28, 0.72, 0.96, 0.32]) {
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

/**
 * Compute live osculating Keplerian ellipses directly from instantaneous GPU N-body
 * double-precision `(r_rel, v_rel)` around each body's gravitational parent (Sun for planets,
 * host planet for moons!) — zero hardcoded circles, purely instantaneous orbital visualization!
 */
function buildSolarOsculatingOrbitLines(solarEngine, focusPosAu, scaleAuToWorld, log10SpanM, alphaMul = 1.0) {
  if (!solarEngine || alphaMul < 0.02) return [];
  const out = [];
  const segs = 72;
  const cat = solarEngine.catalog || REAL_SOLAR_SYSTEM_CATALOG;
  const mCount = Math.min(solarEngine.massiveCount, cat.length);
  const states = Array.from({ length: mCount }, (_, i) => solarEngine.getMassiveBodyState64(i));

  // Inner binary barycenter helper for circumbinary (`parent === -2`) planets & hierarchical trinary outer star!
  let binComPos = states[0]?.posAu || [0, 0, 0];
  let binComVel = states[0]?.velAuPerYr || [0, 0, 0];
  let binMass = states[0]?.massSolar || 1.0;
  if (mCount >= 2 && (cat[1]?.isStar || cat[1]?.orbitRole === 'binary-companion')) {
    const m0 = states[0].massSolar;
    const m1 = states[1].massSolar;
    binMass = Math.max(1e-12, m0 + m1);
    binComPos = [
      (m0 * states[0].posAu[0] + m1 * states[1].posAu[0]) / binMass,
      (m0 * states[0].posAu[1] + m1 * states[1].posAu[1]) / binMass,
      (m0 * states[0].posAu[2] + m1 * states[1].posAu[2]) / binMass
    ];
    binComVel = [
      (m0 * states[0].velAuPerYr[0] + m1 * states[1].velAuPerYr[0]) / binMass,
      (m0 * states[0].velAuPerYr[1] + m1 * states[1].velAuPerYr[1]) / binMass,
      (m0 * states[0].velAuPerYr[2] + m1 * states[1].velAuPerYr[2]) / binMass
    ];
  }

  for (let i = 1; i < mCount; i += 1) {
    const spec = cat[i];
    const isCircumbinary = spec.parent === -2;
    const pIdx = isCircumbinary ? -2 : (spec.parent >= 0 ? spec.parent : 0);
    const isStarBody = Boolean(spec.isStar);
    const isMoon = !isStarBody && pIdx >= 0 && !cat[pIdx]?.isStar && pIdx > 0;
    // Show moon orbits when zoomed inside ~10^10.6 m; show planet/star orbits across system scale
    if (isMoon && log10SpanM > 10.6) continue;
    if (!isMoon && log10SpanM < 8.4) continue;

    const pPos = isCircumbinary ? binComPos : states[pIdx].posAu;
    const pVel = isCircumbinary ? binComVel : states[pIdx].velAuPerYr;
    const pMass = isCircumbinary ? binMass : states[pIdx].massSolar;
    const bSt = states[i];
    const rx = bSt.posAu[0] - pPos[0];
    const ry = bSt.posAu[1] - pPos[1];
    const rz = bSt.posAu[2] - pPos[2];
    const vx = bSt.velAuPerYr[0] - pVel[0];
    const vy = bSt.velAuPerYr[1] - pVel[1];
    const vz = bSt.velAuPerYr[2] - pVel[2];
    const r = Math.hypot(rx, ry, rz);
    const v2 = vx * vx + vy * vy + vz * vz;
    const mu = G_AU_SOLAR_YR * (pMass + bSt.massSolar);
    if (!(r > 1e-8 && mu > 1e-12)) continue;
    const energy = 0.5 * v2 - mu / r;
    if (energy >= -1e-6) continue;
    const a = -mu / (2 * energy);
    const h = vec3Cross([rx, ry, rz], [vx, vy, vz]);
    const hMag = Math.hypot(h[0], h[1], h[2]);
    if (!(hMag > 1e-10)) continue;
    const hHat = [h[0] / hMag, h[1] / hMag, h[2] / hMag];
    const vxh = vec3Cross([vx, vy, vz], h);
    const eVec = [vxh[0] / mu - rx / r, vxh[1] / mu - ry / r, vxh[2] / mu - rz / r];
    const ecc = Math.min(0.985, Math.hypot(eVec[0], eVec[1], eVec[2]));
    const pHat = ecc > 1e-5 ? [eVec[0] / ecc, eVec[1] / ecc, eVec[2] / ecc] : vec3Norm([rx, ry, rz]);
    const qHat = vec3Cross(hHat, pHat);
    const bSemi = a * Math.sqrt(Math.max(0.01, 1 - ecc * ecc));

    const ox = pPos[0] - focusPosAu[0];
    const oy = pPos[1] - focusPosAu[1];
    const oz = pPos[2] - focusPosAu[2];
    const col = spec.color0 || [0.38, 0.72, 1.0];
    const aLine = (isStarBody ? 0.52 : (isMoon ? 0.34 : (spec.id === 'halley' ? 0.16 : 0.28))) * alphaMul;
    let prev = null;
    for (let s = 0; s <= segs; s += 1) {
      const E = (s / segs) * Math.PI * 2;
      const ca = a * (Math.cos(E) - ecc);
      const sb = bSemi * Math.sin(E);
      const pt = [
        (ox + ca * pHat[0] + sb * qHat[0]) * scaleAuToWorld,
        (oy + ca * pHat[1] + sb * qHat[1]) * scaleAuToWorld,
        (oz + ca * pHat[2] + sb * qHat[2]) * scaleAuToWorld
      ];
      if (prev) {
        out.push(...prev, col[0], col[1], col[2], aLine);
        out.push(...pt, col[0], col[1], col[2], aLine);
      }
      prev = pt;
    }
  }
  return out;
}

/**
 * Determine the primary active scale level (0..7) from the continuous `log10ViewSpanM`
 * and current focus target (`focusedSolarBodyIndex` = 0 -> Sun => L3; planet => L4!).
 */
export function resolvePrimaryLevelFromSpan(log10SpanM, { focusedSolarBodyIndex = 3, galaxyBranch = 'solar-system' } = {}) {
  if (log10SpanM >= 22.3) return 0; // Cosmic Web
  if (log10SpanM >= 16.2) return 1; // Spiral Galaxy
  if (log10SpanM >= 8.75) {
    if (galaxyBranch !== 'smbh-core' && focusedSolarBodyIndex === 0 && log10SpanM <= 9.8) return 3; // Stellar Core!
    return 2; // Real-Scale Solar System (or SMBH Core)
  }
  if (log10SpanM >= -5.6) {
    if (focusedSolarBodyIndex === 0 && log10SpanM >= 7.2) return 3;
    return 4; // Planetary World & Interior
  }
  if (log10SpanM >= -9.1) return 5; // Crystal/Fluid MD
  if (log10SpanM >= -12.8) return 6; // Relativistic Dirac-KS Atom
  return 7; // Atomic Nucleus
}

function idealPlanetaryFramingLog10Span(bodySpec) {
  const rMeters = Math.max(2e5, (Number(bodySpec?.radiusKm) || 6371) * 1000);
  // Frame diameter cleanly (~3.6x radius for bare worlds, ~5.4x when planetary rings extend outward)
  const mult = bodySpec?.ringed ? 5.2 : 3.65;
  return Math.min(8.68, Math.max(6.2, Math.log10(rMeters * mult)));
}

function mapLog10ScaleToInitialSpan(log10Val) {
  return Math.max(LOG10_SPAN_MIN, Math.min(LOG10_SPAN_MAX, Number(log10Val)));
}

export async function mountUlgUniversesDemo() {
  if (!navigator.gpu) throw new Error('navigator.gpu is unavailable in this browser.');
  let adapter = null;
  for (let i = 0; i < 6 && !adapter; i += 1) {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) await new Promise((r) => setTimeout(r, 250));
  }
  if (!adapter) throw new Error('No WebGPU adapter available on this device.');
  const device = await adapter.requestDevice();
  const gpuErrorBucket = [];
  device.addEventListener('uncapturederror', (e) => {
    gpuErrorBucket.push(String(e?.error?.message ?? e));
  });
  attachWebGpuUncapturedErrorTelemetry(device, 'ulg-universes-demo');

  // Parse URL params
  const urlParams = new URLSearchParams(window.location.search);
  const initialZ = Math.max(1, Math.min(118, Number.parseInt(urlParams.get('Z') || urlParams.get('z') || '26', 10) || 26));
  const initialSeed = Number.parseInt(urlParams.get('seed') || '20261125', 10) || 20261125;
  const initialQuality = QUALITY_PRESETS[urlParams.get('quality')] ? urlParams.get('quality') : 'med';

  let log10ViewSpanM = UNIVERSES_SCALES[0].log10SpanM;
  if (urlParams.has('scale')) {
    log10ViewSpanM = mapLog10ScaleToInitialSpan(Number.parseFloat(urlParams.get('scale')) || 24.8);
  } else if (urlParams.has('level')) {
    const reqLvl = Math.max(0, Math.min(7, Number.parseInt(urlParams.get('level'), 10) || 0));
    log10ViewSpanM = UNIVERSES_SCALES[reqLvl].log10SpanM;
  }

  // DOM References
  const canvas = document.getElementById('uv-canvas');
  const reticleCanvas = document.getElementById('uv-reticle-canvas');
  const reticleCtx = reticleCanvas?.getContext('2d');
  const scaleRail = document.getElementById('uv-scale-rail');
  const epochRail = document.getElementById('uv-epoch-rail');
  const zoomSlider = document.getElementById('uv-zoom-slider');
  const zoomReadout = document.getElementById('uv-zoom-readout');
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
  const focusMoteBtn = document.getElementById('uv-focus-mote-btn');
  const surfaceQuickBtn = document.getElementById('uv-surface-quick-btn');
  const returnBtn = document.getElementById('uv-return-btn');
  const engineTag = document.getElementById('uv-engine-tag');
  const breadcrumbEl = document.getElementById('uv-breadcrumb');
  const hintPillEl = document.getElementById('uv-hint-pill');
  const surfaceHudEl = document.getElementById('uv-surface-hud');
  const surfaceTelemetryEl = document.getElementById('uv-surf-telemetry');
  const surfaceChemBarEl = document.getElementById('uv-surf-chem-bar');
  const surfaceJumpBtn = document.getElementById('uv-surf-jump-btn');
  const surfaceDescendBtn = document.getElementById('uv-surf-descend-btn');
  const surfaceVehicleBtn = document.getElementById('uv-surf-vehicle-btn');
  const surfaceCamBtn = document.getElementById('uv-surf-cam-btn');
  const surfaceOrbitBtn = document.getElementById('uv-surf-orbit-btn');
  const touchPadsEl = document.getElementById('uv-touch-pads');
  const joyMoveEl = document.getElementById('uv-joy-move');
  const joyMoveKnob = document.getElementById('uv-joy-move-knob');
  const joyLookEl = document.getElementById('uv-joy-look');
  const joyLookKnob = document.getElementById('uv-joy-look-knob');
  const warpOverlay = document.getElementById('uv-warp-overlay');
  const helpScaleTag = document.getElementById('uv-help-scale-tag');
  const aboutScaleBtn = document.getElementById('uv-about-scale-btn');
  const aboutUlgBtn = document.getElementById('uv-about-ulg-btn');
  const modalBackdrop = document.getElementById('uv-modal-backdrop');
  const modalTitle = document.getElementById('uv-modal-title');
  const modalSub = document.getElementById('uv-modal-sub');
  const modalContent = document.getElementById('uv-modal-content');
  const modalClose = document.getElementById('uv-modal-close');

  const renderer = createUlgUniversesRenderer(device, canvas);
  const entityPicker = createGpuEntityPickerWebGpu(device);
  const physics = createUlgUniversesPhysics(device, {
    seed: initialSeed,
    qualityId: initialQuality,
    initialElementZ: initialZ
  });

  // App State
  let currentLevel = resolvePrimaryLevelFromSpan(log10ViewSpanM, {
    focusedSolarBodyIndex: physics.focusedSolarBodyIndex,
    galaxyBranch: physics.galaxyBranch
  });
  let selectedTargetId = null;
  let hoveredTargetId = null;
  let pickedGpuMote = null;     // Live GPU-picked individual mote (star, asteroid, plasma parcel, atom, nucleon!)
  let moteFocusLocked = false;  // When true, camera tracks pickedGpuMote.worldPos smoothly!
  let camTarget = [0, 0, 0];
  let lastNucleonSpheres = [];
  let moteTrackAccum = 0;
  let running = true;
  let timeScale = 1.0;
  let lensingEnabled = true;
  let showOrbits = true;
  let showTravelPath = true;
  let cameraAutoSpin = urlParams.get('cameraAutoSpin') === '1';
  let retroCrt = urlParams.get('crt') === '1';
  let pixelSize = 3;
  let autopilot = urlParams.get('autopilot') === '1';
  let bigBangFlash = 0;
  let disposed = false;
  let rafId = 0;

  // Smooth Continuous Zoom Flight Target (`null` when resting / manual scrolling)
  let flyTargetLog10 = null;
  let zoomVelocityLog10PerSec = 0;

  // Fixed camera distance in normalized virtual view units (`dist = 18.0`);
  // ALL continuous zooming scales the 3D scene exponentially via `log10ViewSpanM`!
  const camState = {
    yaw: 0.56,
    pitch: 0.42,
    dist: 18.0
  };
  let lastViewProj = new Float32Array(16);
  let lastCssW = window.innerWidth;
  let lastCssH = window.innerHeight;
  let lastWorldScaleInfo = {};

  const pathHistory = ['Cosmic Web', 'Spiral Galaxy', 'Solar System', 'Sun Core', 'Earth', 'Fe Lattice', 'Fe Atom', '⁵⁶Fe Nucleus'];

  if (autoSpinToggle) autoSpinToggle.checked = cameraAutoSpin;
  if (crtToggle) crtToggle.checked = retroCrt;
  if (autopilotBtn && autopilot) {
    autopilotBtn.classList.add('active');
    autopilotBtn.textContent = '⏹ Stop Tour';
  }
  if (qualityGroup) {
    for (const b of qualityGroup.querySelectorAll('[data-quality]')) {
      b.classList.toggle('active', b.dataset.quality === initialQuality);
    }
  }

  // Build clickable 8-rung Scale Rail (smoothly flies `log10ViewSpanM`!)
  if (scaleRail) {
    scaleRail.innerHTML = UNIVERSES_SCALES.map((s) => (
      `<button class="uv-rung-btn" data-level="${s.level}" type="button" title="Smoothly fly continuously to L${s.level}: ${s.name} (${s.exponentLabel})">` +
      `<span class="uv-rung-exp">${s.exponentLabel}</span>` +
      `<span>L${s.level} ${s.shortLabel}</span>` +
      `</button>`
    )).join('');
    for (const btn of scaleRail.querySelectorAll('[data-level]')) {
      btn.addEventListener('click', () => {
        const lvl = Number.parseInt(btn.dataset.level, 10);
        if (Number.isFinite(lvl)) {
          if (physics.surfaceActive) exitSurfaceViewUi();
          autopilot = false;
          autopilotBtn?.classList.remove('active');
          if (autopilotBtn) autopilotBtn.textContent = '▶ Tour';
          if (lvl === 3) physics.setFocusedSolarBody(0);
          else if (lvl === 4) {
            const cat = physics.getActiveSystemCatalog();
            if (cat[physics.focusedSolarBodyIndex]?.isStar || physics.focusedSolarBodyIndex === 0) {
              physics.setFocusedSolarBody(physics.getDefaultPlanetIndex(cat));
            }
          }
          flyToLog10Span(UNIVERSES_SCALES[lvl].log10SpanM);
        }
      });
    }
  }

  // Build clickable 5-Era Cosmic Epoch Rail (orthogonal physical `(z, t_sys)` timeline!)
  function syncEpochChrome() {
    if (!epochRail) return;
    for (const b of epochRail.querySelectorAll('[data-epoch]')) {
      b.classList.toggle('active', b.dataset.epoch === physics.cosmicEpochId);
    }
  }
  if (epochRail) {
    epochRail.innerHTML = physics.COSMIC_EPOCH_PRESETS.map((ep) => (
      `<button class="uv-epoch-btn ${ep.id === physics.cosmicEpochId ? 'active' : ''}" data-epoch="${ep.id}" type="button" title="${ep.summary}">${ep.shortLabel}</button>`
    )).join('');
    for (const btn of epochRail.querySelectorAll('[data-epoch]')) {
      btn.addEventListener('click', async () => {
        await physics.setCosmicEpoch(btn.dataset.epoch, { alignActiveLevel: currentLevel });
        syncEpochChrome();
        selectDefaultTarget();
        renderScaleControls();
        updateInspectorCard();
        renderNow(performance.now());
      });
    }
  }

  // Continuous 40-OOM Scrubber Slider!
  zoomSlider?.addEventListener('input', (e) => {
    if (physics.surfaceActive) exitSurfaceViewUi();
    autopilot = false;
    autopilotBtn?.classList.remove('active');
    if (autopilotBtn) autopilotBtn.textContent = '▶ Tour';
    flyTargetLog10 = null;
    log10ViewSpanM = Math.max(LOG10_SPAN_MIN, Math.min(LOG10_SPAN_MAX, Number(e.target.value)));
    void warmVisibleLevels(log10ViewSpanM);
  });

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

  // ---- Drawers & Modals ----
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
    openModal('About ULG Universes', 'Universal Law Graph · Continuous 40-OOM WebGPU Physics', buildAboutUlgUniversesHtml());
  });
  collapseBtn?.addEventListener('click', () => {
    const collapsed = inspectorEl?.classList.toggle('collapsed');
    if (collapseBtn) collapseBtn.textContent = collapsed ? '+' : '−';
  });

  // ---- Background Pre-Warming of Active & Adjacent Continuous Zoom Regimes ----
  async function warmVisibleLevels(spanLog10) {
    const lvl = resolvePrimaryLevelFromSpan(spanLog10, {
      focusedSolarBodyIndex: physics.focusedSolarBodyIndex,
      galaxyBranch: physics.galaxyBranch
    });
    const toWarm = new Set([lvl]);
    if (spanLog10 >= 20.5) toWarm.add(0);
    if (spanLog10 >= 14.8 && spanLog10 <= 23.5) toWarm.add(1);
    if (spanLog10 >= 6.5 && spanLog10 <= 18.2) toWarm.add(2);
    if (spanLog10 >= 6.8 && spanLog10 <= 10.8 && physics.focusedSolarBodyIndex === 0) toWarm.add(3);
    if (spanLog10 >= -6.2 && spanLog10 <= 9.2 && physics.focusedSolarBodyIndex > 0) toWarm.add(4);
    if (spanLog10 >= -10.0 && spanLog10 <= -4.5) toWarm.add(5);
    if (spanLog10 >= -13.5 && spanLog10 <= -8.4) toWarm.add(6);
    if (spanLog10 <= -11.5) toWarm.add(7);

    const prevNuc = physics.nuclearResult;
    for (const l of toWarm) {
      await physics.ensureLevelInitialized(l);
    }
    if (physics.nuclearResult && physics.nuclearResult !== prevNuc && physics.nuclearResult.volumeData) {
      renderer.uploadNuclearVolume(physics.nuclearResult.volumeData);
    }
  }

  function orientCameraToSunlitPhase(bodyIdx = physics.focusedSolarBodyIndex) {
    if (!physics.solarEngine || bodyIdx <= 0) return;
    const fSt = physics.solarEngine.getMassiveBodyState64(bodyIdx);
    const sSt = physics.solarEngine.getMassiveBodyState64(0);
    const dx = sSt.posAu[0] - fSt.posAu[0];
    const dz = sSt.posAu[2] - fSt.posAu[2];
    const sunYaw = Math.atan2(dx, dz);
    // Position observer at a dramatic ~52 deg gibbous phase angle (~72% sunlit oceans/storms + crisp terminator + ~28% nightside lightning & aurorae!)
    camState.yaw = sunYaw - 0.92;
    camState.pitch = 0.24;
  }

  function flyToLog10Span(targetSpan) {
    flyTargetLog10 = Math.max(LOG10_SPAN_MIN, Math.min(LOG10_SPAN_MAX, Number(targetSpan)));
    void warmVisibleLevels(flyTargetLog10);
  }

  // ---- Scale-Specific Physics Controls inside Sim Drawer ----
  function renderScaleControls() {
    if (!scaleControlsEl) return;
    if (currentLevel === 0) {
      scaleControlsEl.innerHTML = `
        <div class="uv-row">
          <span>Cosmology Regime</span>
          <select id="uv-cosmo-mode">
            <option value="web" ${physics.cosmoMode === 'web' ? 'selected' : ''}>2LPT Cosmic Web (FLRW TreePM)</option>
            <option value="cmb" ${physics.cosmoMode === 'cmb' ? 'selected' : ''}>CMB Recombination (z=1100 BAO ΔT/T)</option>
            <option value="reionization" ${physics.cosmoMode === 'reionization' ? 'selected' : ''}>Cosmic Dawn Reionization Bubbles (z=10)</option>
            <option value="cluster-merger" ${physics.cosmoMode === 'cluster-merger' ? 'selected' : ''}>Bullet-Cluster Merger (X-Ray ICM + Lensing)</option>
          </select>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.35;">${
          physics.cosmoMode === 'cmb'
            ? 'Eisenstein–Hu BAO + Peebles Recombination surface at <code>z = 1100</code> (<code>T_CMB = 3,001 K</code>, <code>r_s ≈ 147 Mpc</code>).'
            : physics.cosmoMode === 'reionization'
              ? 'Pop III UV radiation percolating ionized <code>H II</code> bubbles through the neutral <code>z = 10</code> IGM.'
              : physics.cosmoMode === 'cluster-merger'
                ? 'Shock-heated X-ray ICM gas (magenta-gold) colliding behind collisionless dark-matter lensing halos (blue).'
                : `FLRW 3D-FFT TreePM running <code>${physics.quality.cosmoGridPerSide}³</code> particles on a <code>${physics.quality.cosmoFftN}³</code> periodic FFT mesh.`
        }</div>`;
      scaleControlsEl.querySelector('#uv-cosmo-mode')?.addEventListener('change', async (e) => {
        await physics.setCosmoMode(e.target.value);
        selectDefaultTarget();
        renderScaleControls();
        updateInspectorCard();
        renderNow(performance.now());
      });
    } else if (currentLevel === 1) {
      scaleControlsEl.innerHTML = `
        <div class="uv-row">
          <span>Morphology</span>
          <select id="uv-gal-preset-sel">
            <option value="disk" ${physics.galaxyPreset === 'disk' ? 'selected' : ''}>Grand-Design Spiral (Sc/Sb)</option>
            <option value="barred" ${physics.galaxyPreset === 'barred' ? 'selected' : ''}>Barred Spiral (SBb · Secular m=2 Bar)</option>
            <option value="binary" ${physics.galaxyPreset === 'binary' ? 'selected' : ''}>Interacting Major Merger Pair</option>
            <option value="sphere" ${physics.galaxyPreset === 'sphere' ? 'selected' : ''}>Giant Elliptical Spheroid</option>
            <option value="proto" ${physics.galaxyPreset === 'proto' ? 'selected' : ''}>High-z Clumpy Starburst Protogalaxy</option>
            <option value="dwarf-stream" ${physics.galaxyPreset === 'dwarf-stream' ? 'selected' : ''}>Tidally Disrupted Dwarf &amp; Halo Stream</option>
            <option value="globular" ${physics.galaxyPreset === 'globular' ? 'selected' : ''}>Core-Collapsed Globular Cluster</option>
          </select>
        </div>
        <div class="uv-row">
          <span>Zoom Destination</span>
          <select id="uv-gal-branch">
            <option value="solar-system" ${physics.galaxyBranch === 'solar-system' ? 'selected' : ''}>Solar System (Orion Spur)</option>
            <option value="smbh-core" ${physics.galaxyBranch === 'smbh-core' ? 'selected' : ''}>Galactic Core SMBH (Sgr A*)</option>
          </select>
        </div>
        <div class="uv-row">
          <span>ISM Z/Z☉</span>
          <input id="uv-gal-z-slider" type="range" min="0.1" max="2.5" step="0.1" value="${physics.galaxyMetallicity.toFixed(1)}" />
          <span id="uv-gal-z-val" style="font-family:var(--mono);font-size:11px;">${physics.galaxyMetallicity.toFixed(1)}</span>
        </div>
        <div class="uv-row" title="Seed field B₀ for the live GPU 24³ 3D α–ω galactic dynamo (0 = strictly zero B-field!)">
          <span>Dynamo B₀</span>
          <input id="uv-gal-b0-slider" type="range" min="0.0" max="0.8" step="0.05" value="${physics.galacticB0.toFixed(2)}" />
          <span id="uv-gal-b0-val" style="font-family:var(--mono);font-size:11px;">${physics.galacticB0.toFixed(2)}</span>
        </div>`;
      scaleControlsEl.querySelector('#uv-gal-preset-sel')?.addEventListener('change', async (e) => {
        await physics.initGalaxy({ preset: e.target.value });
        pickedGpuMote = null;
        moteFocusLocked = false;
        selectDefaultTarget();
        renderScaleControls();
        renderNow(performance.now());
      });
      scaleControlsEl.querySelector('#uv-gal-branch')?.addEventListener('change', (e) => {
        const br = e.target.value;
        physics.setGalaxyBranch(br, br === 'smbh-core' ? [0, 0, 0] : [4.8, 0.04, 2.1]);
        void warmVisibleLevels(log10ViewSpanM);
      });
      scaleControlsEl.querySelector('#uv-gal-z-slider')?.addEventListener('input', async (e) => {
        const zMet = Number(e.target.value);
        const vEl = scaleControlsEl.querySelector('#uv-gal-z-val');
        if (vEl) vEl.textContent = zMet.toFixed(1);
        await physics.initGalaxy({ preset: physics.galaxyPreset, metallicity: zMet });
      });
      scaleControlsEl.querySelector('#uv-gal-b0-slider')?.addEventListener('change', async (e) => {
        const b0 = Number(e.target.value);
        const vEl = scaleControlsEl.querySelector('#uv-gal-b0-val');
        if (vEl) vEl.textContent = b0.toFixed(2);
        await physics.setGalacticB0(b0);
        updateInspectorCard();
        renderNow(performance.now());
      });
    } else if (currentLevel === 2) {
      if (physics.galaxyBranch === 'smbh-core') {
        scaleControlsEl.innerHTML = `
          <div style="font-size:11.5px;color:var(--muted);line-height:1.4;">Live GPU N-body hypervelocity S-stars orbiting a <code>4.3×10⁶ M☉</code> Kerr-Schwarzschild SMBH with Doppler-beamed accretion disk &amp; WGSL gravitational lensing.</div>
          <button id="uv-switch-solar-btn" class="uv-btn subtle" type="button" style="justify-content:center;">Switch to Solar System</button>`;
        scaleControlsEl.querySelector('#uv-switch-solar-btn')?.addEventListener('click', async () => {
          physics.setGalaxyBranch('solar-system', [4.8, 0.04, 2.1]);
          await physics.ensureLevelInitialized(2);
          renderScaleControls();
        });
      } else {
        scaleControlsEl.innerHTML = `
          <div class="uv-row">
            <span>System Regime</span>
            <select id="uv-solar-mode-sel">
              <optgroup label="Planetary &amp; Small-Body Systems">
                <option value="nbody" ${physics.solarMode === 'nbody' ? 'selected' : ''}>Real-Scale Solar System (f32x2 N-Body)</option>
                <option value="formation" ${physics.solarMode === 'formation' ? 'selected' : ''}>Protoplanetary Accretion Disk &amp; Snow Line</option>
                <option value="roche-rings" ${physics.solarMode === 'roche-rings' ? 'selected' : ''}>Roche-Limit Ring Disruption &amp; Shepherd Moon</option>
                <option value="giant-impact" ${physics.solarMode === 'giant-impact' ? 'selected' : ''}>Giant Moon-Forming Impact (Hadean Disk)</option>
                <option value="comet-tails" ${physics.solarMode === 'comet-tails' ? 'selected' : ''}>Active Dual-Tail Comet (Dust + CO⁺ Ion)</option>
                <option value="hot-jupiter" ${physics.solarMode === 'hot-jupiter' ? 'selected' : ''}>Hot Jupiter XUV Photoevaporation Tail</option>
                <option value="red-giant" ${physics.solarMode === 'red-giant' ? 'selected' : ''}>Red-Giant Engulfment (+5 Gyr RGB)</option>
              </optgroup>
              <optgroup label="Relativistic &amp; High-Energy Systems">
                <option value="quasar-jet" ${physics.solarMode === 'quasar-jet' ? 'selected' : ''}>Quasar / Blazar Kerr BZ Relativistic Jets</option>
                <option value="xray-binary" ${physics.solarMode === 'xray-binary' ? 'selected' : ''}>X-Ray Binary (Roche L1 Overflow onto BH)</option>
                <option value="bns-kilonova" ${physics.solarMode === 'bns-kilonova' ? 'selected' : ''}>BNS GW Merger &amp; r-Process Kilonova</option>
                <option value="type-ia" ${physics.solarMode === 'type-ia' ? 'selected' : ''}>Type Ia White-Dwarf Detonation (M_Ch)</option>
                <option value="bbh-merger" ${physics.solarMode === 'bbh-merger' ? 'selected' : ''}>Binary Black Hole 2.5PN GW Inspiral</option>
              </optgroup>
            </select>
          </div>
          ${physics.solarMode === 'formation' ? `
            <label class="uv-row" title="Toggle sub-Keplerian Epstein/Stokes gas drag &amp; streaming instability">
              <span>Gas Drag &amp; Drift</span>
              <input id="uv-disk-drag" type="checkbox" ${physics.protoplanetaryGasDrag ? 'checked' : ''} />
            </label>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Live GPU pebbles + DLM composite particle-rigid planetesimals condensing across the <code>${(physics.protoplanetarySession?.snowLineAu || 2.71).toFixed(2)} AU</code> H₂O snow line.</div>
          ` : physics.solarMode === 'quasar-jet' ? `
            <div class="uv-row" title="Dimensionless Kerr spin parameter a* (0 = Schwarzschild, no BZ jet; 0.94 = blazing Blazar jet!)">
              <span>Kerr Spin a*</span>
              <input id="uv-kerr-spin" type="range" min="0.0" max="0.98" step="0.02" value="${physics.kerrSpinA.toFixed(2)}" />
              <span id="uv-kerr-spin-val" style="font-family:var(--mono);font-size:11px;">${physics.kerrSpinA.toFixed(2)}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);line-height:1.35;">Blandford–Znajek power <code>P_BZ ∝ Φ_B² Ω_H²</code>. Drag camera near the jet axis to watch relativistic Doppler beaming turn the Quasar into a blazing Blazar!</div>
          ` : physics.solarMode === 'nbody' ? (() => {
            const cat = physics.getActiveSystemCatalog();
            const cSys = physics.activeCausalSystem;
            const neb = cSys?.starSystem?.nebulaEnv;
            const fronts = cSys?.condensationFrontsAu;
            const archLbl = physics.useSolReference
              ? 'Sol Reference (G2V · 8 Planets)'
              : `${cSys?.systemName || 'System'} · ${cSys?.architecture || 'single'} (${cSys?.starCount || 1}★, ${cSys?.planetCount || 0} planets${cSys?.hasEarthLike ? ', Earth-like!' : ''})`;
            return `
            <div style="font-size:10.5px;color:#cbd5e1;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:6px;padding:6px 7px;line-height:1.35;">
              <div><strong>${archLbl}</strong></div>
              ${!physics.useSolReference && neb ? `<div style="color:var(--muted);margin-top:2px;">Nebula: <code>${neb.nebulaSummary}</code> · Snow <code>${fronts?.rSnowLineAu} AU</code> · HZ <code>${fronts?.rHzInnerAu}–${fronts?.rHzOuterAu} AU</code></div>` : `<div style="color:var(--muted);margin-top:2px;">Reference J2000 Solar System (exact astronomical radii: Earth = 0.00916 R☉).</div>`}
            </div>
            <div class="uv-seg-group">
              <button id="uv-sample-star-btn" class="uv-seg-btn" type="button" title="Sample a new star from the live galaxy and synthesize its nebular planetary system">🎲 New Galactic Star</button>
              <button id="uv-toggle-sol-btn" class="uv-seg-btn ${physics.useSolReference ? 'active' : ''}" type="button" title="Toggle between Causal Galactic Nebular Synthesis and Sol Reference System">${physics.useSolReference ? '🌌 Causal Nebular' : '☀ Sol Reference'}</button>
            </div>
            <div class="uv-row">
              <span>Focus World</span>
              <select id="uv-solar-focus">${cat.map((b, i) => (
                `<option value="${i}" ${i === physics.focusedSolarBodyIndex ? 'selected' : ''}>${b.name}</option>`
              )).join('')}</select>
            </div>`;
          })() : `<div style="font-size:11px;color:var(--muted);line-height:1.35;">Active ULG general-law regime running live on WebGPU — drag to orbit, inspect live telemetry &amp; plots on the right.</div>`}`;
        scaleControlsEl.querySelector('#uv-solar-mode-sel')?.addEventListener('change', async (e) => {
          await physics.setSolarMode(e.target.value);
          selectDefaultTarget();
          renderScaleControls();
          updateInspectorCard();
          renderNow(performance.now());
        });
        scaleControlsEl.querySelector('#uv-sample-star-btn')?.addEventListener('click', async () => {
          await physics.sampleNewGalacticSector();
          selectDefaultTarget();
          syncScaleChrome();
          updateInspectorCard();
          renderNow(performance.now());
        });
        scaleControlsEl.querySelector('#uv-toggle-sol-btn')?.addEventListener('click', async () => {
          await physics.setUseSolReference(!physics.useSolReference);
          selectDefaultTarget();
          syncScaleChrome();
          updateInspectorCard();
          renderNow(performance.now());
        });
        scaleControlsEl.querySelector('#uv-disk-drag')?.addEventListener('change', (e) => {
          physics.setProtoplanetaryGasDrag(e.target.checked);
        });
        scaleControlsEl.querySelector('#uv-kerr-spin')?.addEventListener('change', async (e) => {
          const v = Number(e.target.value);
          const lbl = scaleControlsEl.querySelector('#uv-kerr-spin-val');
          if (lbl) lbl.textContent = v.toFixed(2);
          await physics.setKerrSpinA(v);
          updateInspectorCard();
          renderNow(performance.now());
        });
        scaleControlsEl.querySelector('#uv-solar-focus')?.addEventListener('change', async (e) => {
          const idx = Number(e.target.value);
          const cat = physics.getActiveSystemCatalog();
          physics.setFocusedSolarBody(idx);
          selectedTargetId = cat[idx]?.id || null;
          if (!cat[idx]?.isStar && idx > 0) await physics.initPlanetaryInterior({ bodyIndex: idx });
          updateInspectorCard();
          renderNow(performance.now());
        });
      }
    } else if (currentLevel === 3) {
      scaleControlsEl.innerHTML = `
        <div class="uv-row">
          <span>Stellar / Remnant Regime</span>
          <select id="uv-stellar-mode-sel">
            <option value="fusion" ${physics.stellarMode === 'fusion' ? 'selected' : ''}>Thermonuclear Fusion Core (pp/CNO/3α)</option>
            <option value="nebular-mhd" ${physics.stellarMode === 'nebular-mhd' ? 'selected' : ''}>3D Resistive MHD Nebular Collapse &amp; Jets</option>
            <option value="h2-pillars" ${physics.stellarMode === 'h2-pillars' ? 'selected' : ''}>H II Star-Forming Pillars ([O III]/Hα/[S II])</option>
            <option value="planetary-nebula" ${physics.stellarMode === 'planetary-nebula' ? 'selected' : ''}>Planetary Nebula &amp; Hot White Dwarf</option>
            <option value="snr-pwn" ${physics.stellarMode === 'snr-pwn' ? 'selected' : ''}>Supernova Remnant / Crab PWN</option>
            <option value="pulsar" ${physics.stellarMode === 'pulsar' ? 'selected' : ''}>Millisecond Pulsar (Lighthouse Dipole)</option>
            <option value="magnetar" ${physics.stellarMode === 'magnetar' ? 'selected' : ''}>Magnetar Giant Flare (Hall Crust Yield)</option>
            <option value="white-dwarf-tov" ${physics.stellarMode === 'white-dwarf-tov' ? 'selected' : ''}>White Dwarf / NS / BH (GR TOV EOS)</option>
          </select>
        </div>
        ${physics.stellarMode === 'nebular-mhd' ? `
          <div class="uv-row" title="Initial poloidal magnetic field B₀ threading the rotating molecular cloud (0 = hydro-only, no jets!)">
            <span>Magnetic B₀</span>
            <input id="uv-neb-b0" type="range" min="0.0" max="1.2" step="0.05" value="${physics.nebulaB0.toFixed(2)}" />
            <span id="uv-neb-b0-val" style="font-family:var(--mono);font-size:11px;">${physics.nebulaB0.toFixed(2)}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);line-height:1.35;">3D self-gravitating resistive MHD winding helical B-towers &amp; launching magnetocentrifugal J×B jets.</div>
        ` : physics.stellarMode === 'fusion' ? `
          <div class="uv-seg-group">
            <button class="uv-seg-btn ${physics.stellarPreset === 'main-sequence-star' ? 'active' : ''}" data-st-preset="main-sequence-star" type="button">Active Star</button>
            <button class="uv-seg-btn ${physics.stellarPreset === 'solar-nebula' ? 'active' : ''}" data-st-preset="solar-nebula" type="button">Nebula</button>
            <button class="uv-seg-btn ${physics.stellarPreset === 'massive-supernova' ? 'active' : ''}" data-st-preset="massive-supernova" type="button">18 M☉ SN</button>
            <button class="uv-seg-btn ${physics.stellarPreset === 'binary-nursery' ? 'active' : ''}" data-st-preset="binary-nursery" type="button">Binary</button>
          </div>
          <div class="uv-row">
            <span>Burn Accel</span>
            <input id="uv-st-accel" type="range" min="0.5" max="6.0" step="0.25" value="${physics.stellarTimeAccel}" />
            <span id="uv-st-accel-val" style="font-family:var(--mono);font-size:11px;">${physics.stellarTimeAccel.toFixed(1)}×</span>
          </div>
          <div class="uv-row" title="Seed B₀ for the live GPU 24³ 3D stellar convective dynamo (0 = zero coronal B-field!)">
            <span>Dynamo B₀</span>
            <input id="uv-st-b0" type="range" min="0.0" max="0.9" step="0.05" value="${physics.stellarB0.toFixed(2)}" />
            <span id="uv-st-b0-val" style="font-family:var(--mono);font-size:11px;">${physics.stellarB0.toFixed(2)}</span>
          </div>
        ` : `<div style="font-size:11px;color:var(--muted);line-height:1.35;">Live first-principles GPU regime from ULG’s Universal Law Graph — inspect spectra, TOV M(R), or flare light curve on the right.</div>`}`;
      scaleControlsEl.querySelector('#uv-stellar-mode-sel')?.addEventListener('change', async (e) => {
        await physics.setStellarMode(e.target.value);
        pickedGpuMote = null;
        moteFocusLocked = false;
        selectDefaultTarget();
        renderScaleControls();
        updateInspectorCard();
        renderNow(performance.now());
      });
      scaleControlsEl.querySelector('#uv-neb-b0')?.addEventListener('change', async (e) => {
        const v = Number(e.target.value);
        const lbl = scaleControlsEl.querySelector('#uv-neb-b0-val');
        if (lbl) lbl.textContent = v.toFixed(2);
        await physics.setNebulaB0(v);
      });
      for (const b of scaleControlsEl.querySelectorAll('[data-st-preset]')) {
        b.addEventListener('click', async () => {
          await physics.initStellarCore({ preset: b.dataset.stPreset });
          pickedGpuMote = null;
          moteFocusLocked = false;
          renderScaleControls();
          updateInspectorCard();
          renderNow(performance.now());
        });
      }
      scaleControlsEl.querySelector('#uv-st-accel')?.addEventListener('input', (e) => {
        physics.setStellarTimeAccel(Number(e.target.value));
        const v = scaleControlsEl.querySelector('#uv-st-accel-val');
        if (v) v.textContent = `${physics.stellarTimeAccel.toFixed(1)}×`;
      });
      scaleControlsEl.querySelector('#uv-st-b0')?.addEventListener('change', async (e) => {
        const v = Number(e.target.value);
        const lbl = scaleControlsEl.querySelector('#uv-st-b0-val');
        if (lbl) lbl.textContent = v.toFixed(2);
        await physics.setStellarB0(v);
        updateInspectorCard();
        renderNow(performance.now());
      });
    } else if (currentLevel === 4) {
      const atmoAct = physics.planetaryAtmoState?.activation;
      scaleControlsEl.innerHTML = `
        <div class="uv-row">
          <span>Planetary Regime</span>
          <select id="uv-planetary-mode-sel">
            <option value="standard" ${physics.planetaryMode === 'standard' ? 'selected' : ''}>Solar System Worlds (Live Baroclinic + EM)</option>
            <option value="magma-ocean" ${physics.planetaryMode === 'magma-ocean' ? 'selected' : ''}>Hadean Magma Ocean (Molten Crust)</option>
            <option value="cryo-plumes" ${physics.planetaryMode === 'cryo-plumes' ? 'selected' : ''}>Cryovolcanic Icy Moon (Tidal Plumes)</option>
            <option value="eyeball-locked" ${physics.planetaryMode === 'eyeball-locked' ? 'selected' : ''}>Tidally Locked Eyeball Exoplanet</option>
            <option value="rogue" ${physics.planetaryMode === 'rogue' ? 'selected' : ''}>Rogue Free-Floating Dark World</option>
          </select>
        </div>
        <div class="uv-row">
          <span>World</span>
          <select id="uv-planet-sel">${physics.getActiveSystemCatalog().map((b, i) => (
            b.isStar || i === 0 ? '' : `<option value="${i}" ${i === physics.planetaryBodyIndex ? 'selected' : ''}>${b.name} (${b.radiusKm.toLocaleString()} km)</option>`
          )).join('')}</select>
        </div>
        <label class="uv-row" title="Toggle non-inductive triboelectric dust/cloud charging &amp; GPU Poisson Paschen lightning breakdown">
          <span>Triboelectric Lightning</span>
          <input id="uv-tribo-toggle" type="checkbox" ${physics.planetaryTriboelectric ? 'checked' : ''} ${atmoAct?.triboelectricActive ? '' : 'disabled'} />
        </label>
        <label class="uv-row" title="Slice an octant out of the planet to inspect the live GPU Polytope Atlas hydrostatic core &amp; mantle">
          <span>3D Interior Cutaway</span>
          <input id="uv-cutaway-toggle" type="checkbox" ${physics.planetaryCutaway ? 'checked' : ''} />
        </label>
        <button id="uv-land-surface-btn" class="uv-btn primary" type="button" style="justify-content:center;" title="Land on the live GPU planetary surface with a 6-Wheel Jump-Rocket Rover and Coaxial Atmospheric Drone (Shortcut: L)">${physics.surfaceActive ? '🚀 Launch Back to Orbit (Esc)' : '🚙 Land on Surface (Rover + Drone)'}</button>
        <div style="font-size:10.5px;color:var(--muted);line-height:1.35;">Dynamic Law Graph: <code>${physics.surfaceActive ? 'planetary-surface-vehicles · ' : ''}${atmoAct?.anyActive ? atmoAct.activeLaws.join(' · ') : 'Vacuum body — atmospheric &amp; EM laws dormant (0 dispatches)'}</code></div>`;
      scaleControlsEl.querySelector('#uv-planetary-mode-sel')?.addEventListener('change', async (e) => {
        await physics.setPlanetaryMode(e.target.value);
        if (physics.surfaceActive) {
          await enterSurfaceViewUi({ bodyIndex: physics.planetaryBodyIndex });
        } else {
          selectDefaultTarget();
          renderScaleControls();
          updateInspectorCard();
          renderNow(performance.now());
        }
      });
      scaleControlsEl.querySelector('#uv-planet-sel')?.addEventListener('change', async (e) => {
        const idx = Number(e.target.value);
        physics.setFocusedSolarBody(idx);
        await physics.initPlanetaryInterior({ bodyIndex: idx });
        if (physics.surfaceActive) {
          await enterSurfaceViewUi({ bodyIndex: idx });
        } else {
          const cat = physics.getActiveSystemCatalog();
          log10ViewSpanM = idealPlanetaryFramingLog10Span(cat[idx]);
          orientCameraToSunlitPhase(idx);
          selectDefaultTarget();
          syncScaleChrome();
        }
      });
      scaleControlsEl.querySelector('#uv-land-surface-btn')?.addEventListener('click', async () => {
        if (physics.surfaceActive) exitSurfaceViewUi();
        else await enterSurfaceViewUi({ bodyIndex: physics.planetaryBodyIndex });
      });
      scaleControlsEl.querySelector('#uv-tribo-toggle')?.addEventListener('change', (e) => {
        physics.setPlanetaryTriboelectric(e.target.checked);
      });
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
            <span>Orbital n/l</span>
            <select id="uv-qm-n">${[1, 2, 3, 4, 5, 6].map((v) => `<option value="${v}" ${v === physics.quantumN ? 'selected' : ''}>n=${v}</option>`).join('')}</select>
            <select id="uv-qm-l">${[0, 1, 2, 3].filter((v) => v < physics.quantumN).map((v) => `<option value="${v}" ${v === physics.quantumL ? 'selected' : ''}>${['s', 'p', 'd', 'f'][v]}</option>`).join('')}</select>
          </div>
          <label class="uv-row">
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
    const targets = physics.getTargetsForLevel(currentLevel, lastWorldScaleInfo);
    return targets.find((t) => t.id === selectedTargetId) || targets[0] || null;
  }

  function selectDefaultTarget() {
    const targets = physics.getTargetsForLevel(currentLevel, lastWorldScaleInfo);
    if (currentLevel === 2 && physics.galaxyBranch !== 'smbh-core') {
      const cat = physics.getActiveSystemCatalog();
      selectedTargetId = cat[physics.focusedSolarBodyIndex]?.id || targets[0]?.id || null;
    } else {
      selectedTargetId = targets[0]?.id || null;
    }
  }

  function syncScaleChrome() {
    const sc = UNIVERSES_SCALES[currentLevel];
    if (scaleBadge) scaleBadge.textContent = `10^${log10ViewSpanM.toFixed(1)} m`;
    if (zoomReadout) zoomReadout.textContent = formatPhysicalSpan(log10ViewSpanM);
    if (zoomSlider && document.activeElement !== zoomSlider) {
      zoomSlider.value = log10ViewSpanM.toFixed(2);
    }
    if (helpScaleTag) helpScaleTag.textContent = `L${sc.level}`;
    if (engineTag) engineTag.textContent = sc.engineSchema;
    if (plotTitle) plotTitle.textContent = sc.plotTitle;
    if (diveBtn) diveBtn.textContent = sc.diveButton;
    if (surfaceQuickBtn) {
      surfaceQuickBtn.style.display = (currentLevel === 4 && !physics.surfaceActive) ? 'inline-flex' : 'none';
    }
    if (returnBtn) returnBtn.disabled = currentLevel === 0 && !physics.surfaceActive;
    if (orbitUpBtn) orbitUpBtn.disabled = currentLevel === 0 && !physics.surfaceActive;
    if (scaleRail) {
      for (const b of scaleRail.querySelectorAll('[data-level]')) {
        b.classList.toggle('active', Number(b.dataset.level) === currentLevel);
      }
    }
    if (breadcrumbEl) {
      const cat = physics.getActiveSystemCatalog();
      pathHistory[2] = physics.galaxyBranch === 'smbh-core'
        ? 'Sgr A* SMBH'
        : (physics.useSolReference ? 'Sol Reference' : (physics.activeCausalSystem?.systemName || 'Star System'));
      pathHistory[4] = cat[physics.planetaryBodyIndex]?.name || 'World';
      const trimmed = pathHistory.slice(0, currentLevel + 1);
      breadcrumbEl.innerHTML = trimmed
        .map((seg, i) => (i === trimmed.length - 1 ? `<strong>${seg}</strong>` : seg))
        .join(' › ');
    }
    renderScaleControls();
  }

  // ---- Wire Top / Drawer Controls ----
  async function initiateHyperdrive() {
    const t = getSelectedTarget();
    if (currentLevel === 0 && pickedGpuMote?.kind === 'cosmo-web') {
      const dens = Number(pickedGpuMote.localOverdensity) || 1.2;
      const gEnv = physics.deriveGalaxyEnvironmentFromCosmicContext({
        cosmicEpoch: physics.cosmicEpoch,
        regionPosMpc: pickedGpuMote.rawPos,
        localOverdensity: dens,
        seed: physics.seed
      });
      await physics.initGalaxy({ galaxyEnvOverride: gEnv });
    } else if (currentLevel === 1) {
      if (pickedGpuMote?.kind === 'galaxy-star' && pickedGpuMote.starSite) {
        physics.setGalaxyBranch('solar-system', pickedGpuMote.rawPos);
        await physics.selectCausalStarSite(pickedGpuMote.starSite);
      } else if (t?.branch) {
        physics.setGalaxyBranch(t.branch, t.pos);
        if (t.branch === 'solar-system' && t.starSite) {
          await physics.selectCausalStarSite(t.starSite);
        }
      }
    }
    if (currentLevel === 2 && t?.bodyIndex != null) {
      const cat = physics.getActiveSystemCatalog();
      physics.setFocusedSolarBody(t.bodyIndex);
      if (!cat[t.bodyIndex]?.isStar && t.bodyIndex > 0) await physics.initPlanetaryInterior({ bodyIndex: t.bodyIndex });
    }
    if (currentLevel === 4 && t?.sampleZ) {
      await physics.initMolecularDynamics({ Z: t.sampleZ, phasePreset: 'solid' });
    }
    if (currentLevel === 5 && t?.sampleZ) {
      await physics.initQuantumAtom({ Z: t.sampleZ, mode: 'atom' });
    }
    if (currentLevel === 6 && t?.sampleZ) {
      await physics.initAtomicNucleus({ Z: t.sampleZ });
      if (physics.nuclearResult?.volumeData) renderer.uploadNuclearVolume(physics.nuclearResult.volumeData);
    }
    const nextLvl = t?.nextLevel != null ? t.nextLevel : ((currentLevel + 1) % 8);
    if (nextLvl === 4) {
      const cat = physics.getActiveSystemCatalog();
      if (cat[physics.focusedSolarBodyIndex]?.isStar || physics.focusedSolarBodyIndex === 0) {
        physics.setFocusedSolarBody(physics.getDefaultPlanetIndex(cat));
      }
    }
    flyToLog10Span(UNIVERSES_SCALES[nextLvl].log10SpanM);
  }

  async function returnToOrbit() {
    if (physics.surfaceActive) {
      exitSurfaceViewUi();
      return;
    }
    if (currentLevel <= 0) return;
    flyToLog10Span(UNIVERSES_SCALES[currentLevel - 1].log10SpanM);
  }

  // ---- Planetary Surface & 3D Atmospheric CFD Explorer (Jump-Rocket Rover + Coaxial Drone + Buoyant 3D CFD UFO!) ----
  function cycleSurfaceVehicle() {
    if (!physics.surfaceSession) return;
    const sess = physics.surfaceSession;
    const env = sess.env;
    const cur = sess.activeVehicle;
    const hasCfd = Boolean(sess.cfdProfile);
    let next = cur;
    if (!env.hasSolidCrust) {
      next = cur === 'ufo' ? 'drone' : 'ufo';
    } else if (hasCfd) {
      next = cur === 'rover' ? 'drone' : (cur === 'drone' ? 'ufo' : 'rover');
    } else {
      next = cur === 'drone' ? 'rover' : 'drone';
    }
    physics.setSurfaceVehicle(next);
    syncSurfaceHud();
    renderNow(performance.now());
  }

  function syncSurfaceHud() {
    const active = Boolean(physics.surfaceActive && physics.surfaceSession);
    surfaceHudEl?.classList.toggle('active', active);
    touchPadsEl?.classList.toggle('active', active);
    if (surfaceQuickBtn) {
      const cat = physics.getActiveSystemCatalog();
      const specQ = cat[physics.planetaryBodyIndex] || REAL_SOLAR_SYSTEM_CATALOG[3];
      const isGiant = (Number(specQ?.radiusKm) || 6371) >= 16000;
      surfaceQuickBtn.textContent = isGiant ? '🛸 Dive' : '🚙 Land';
      surfaceQuickBtn.title = isGiant
        ? 'Deploy Buoyant 3D CFD Research UFO into deep planetary atmosphere (L)'
        : 'Land 6-Wheel Rover / Drone / 3D CFD UFO on planetary surface (L)';
      surfaceQuickBtn.style.display = (currentLevel === 4 && !active) ? 'inline-flex' : 'none';
    }
    if (hintPillEl) {
      hintPillEl.style.display = active ? 'none' : '';
    }
    if (!active) return;
    const sess = physics.surfaceSession;
    const tel = physics.surfaceTelemetry || sess.getTelemetry();
    const env = sess.env;
    const isUfo = sess.activeVehicle === 'ufo';
    const isDrone = sess.activeVehicle === 'drone';
    const spec = physics.getActiveSystemCatalog()[physics.planetaryBodyIndex] || REAL_SOLAR_SYSTEM_CATALOG[3];
    const worldName = physics.planetaryMode === 'magma-ocean'
      ? 'Hadean Magma Ocean'
      : (physics.planetaryMode === 'cryo-plumes' ? 'Cryovolcanic Moon' : spec.name);
    const localRho = tel.rhoAtmKgM3 ?? env.rhoAtmKgM3;
    const atmStr = localRho > 1e-4 ? `ρ=${localRho.toFixed(localRho < 0.1 ? 3 : 2)} kg/m³` : '<span class="warn">VACUUM (0 Pa)</span>';
    const cfd = tel.cfdTelemetry;
    const chem = cfd?.chemistry;
    const vehBadge = isUfo ? '🛸 3D CFD UFO' : (isDrone ? '🚁 DRONE' : '🚙 ROVER');
    let vehMetrics;
    if (isUfo && chem) {
      const pStr = chem.pressureBar >= 0.1 ? `${chem.pressureBar.toFixed(2)} bar` : `${(chem.pressureBar * 101.325).toFixed(1)} kPa`;
      const windSpd = cfd?.craftWindSpeedMS || 0;
      vehMetrics = `Alt ${chem.altKm.toFixed(1)} km · <strong>${pStr}</strong> · ${Math.round(chem.tempK)} K · <span class="good">3D Wind ${windSpd.toFixed(1)} m/s</span> · Deck: <strong>${chem.activeCloudDeck}</strong>`;
    } else if (isDrone) {
      vehMetrics = env.droneFlightCapable
        ? `Alt ${(tel.droneAltitudeM || 0).toFixed(1)} m · Spd ${(tel.droneSpeedMS || 0).toFixed(1)} m/s · <span class="good">Lift ${(tel.droneAeroLiftN || 0).toFixed(1)}/${env.maxAeroLiftN.toFixed(1)} N</span>`
        : `Alt ${(tel.droneAltitudeM || 0).toFixed(1)} m · <span class="warn">0.0 N AERO LIFT (VACUUM!)</span>`;
    } else {
      vehMetrics = `Alt ${(tel.roverAltitudeM || 0).toFixed(1)} m · Spd ${(tel.roverSpeedMS || 0).toFixed(1)} m/s · Fuel ${Math.round((tel.roverRocketFuel ?? 1) * 100)}%`;
    }
    if (surfaceTelemetryEl) {
      surfaceTelemetryEl.innerHTML =
        `<span><strong>${vehBadge}</strong> · ${worldName} · g=${env.gravityMS2.toFixed(2)} m/s² · ${atmStr} · ${vehMetrics}</span>`;
    }
    if (surfaceChemBarEl) {
      if (isUfo && chem && chem.species?.length > 0) {
        const spHtml = chem.species.slice(0, 5).map((s) => {
          const pct = s.moleFrac * 100;
          const pctStr = pct >= 1 ? `${pct.toFixed(1)}%` : (pct >= 0.01 ? `${pct.toFixed(2)}%` : `${(pct * 1e4).toFixed(0)} ppm`);
          const condTag = s.condensedFrac > 1e-6 ? ' <span class="warn">(☁)</span>' : '';
          return `<span><strong>${s.id}</strong> ${pctStr}${condTag}</span>`;
        }).join(' · ');
        const cw = cfd?.craftWindMS || [0, 0, 0];
        surfaceChemBarEl.innerHTML = `<span>3D CFD: v=(${cw[0].toFixed(1)}, ${cw[1].toFixed(1)}, ${cw[2].toFixed(1)}) m/s · |ω|=${(cfd?.craftVorticity || 0).toFixed(2)}</span> · ${spHtml}`;
        surfaceChemBarEl.style.display = 'flex';
      } else {
        surfaceChemBarEl.style.display = 'none';
      }
    }
    if (surfaceJumpBtn) {
      surfaceJumpBtn.textContent = isUfo ? '⬆ ASCEND (Space)' : (isDrone ? '⬆ ASCEND (Space)' : '🔥 ROCKET JUMP');
      surfaceJumpBtn.classList.toggle('firing', Boolean(physics.surfaceControls.jump));
    }
    if (surfaceDescendBtn) {
      surfaceDescendBtn.style.display = (isUfo || isDrone) ? 'inline-flex' : 'none';
      surfaceDescendBtn.classList.toggle('active', Boolean(physics.surfaceControls.down));
    }
    if (surfaceVehicleBtn) {
      if (!env.hasSolidCrust) {
        surfaceVehicleBtn.textContent = isUfo ? '🛸 3D CFD UFO (F→Drone)' : '🚁 DRONE (F→UFO)';
      } else if (sess.cfdProfile) {
        surfaceVehicleBtn.textContent = isUfo
          ? '🛸 3D CFD UFO (F→Rover)'
          : (isDrone ? '🚁 DRONE (F→UFO)' : '🚙 ROVER (F→Drone)');
      } else {
        surfaceVehicleBtn.textContent = isDrone ? '🚙 SWITCH ROVER (F)' : '🚁 DEPLOY DRONE (F)';
      }
      surfaceVehicleBtn.classList.toggle('active', isUfo || isDrone);
    }
    if (surfaceCamBtn) {
      surfaceCamBtn.textContent = sess.cameraMode === 'first-person' ? '📷 1ST CAM (V)' : '📷 3RD CAM (V)';
      surfaceCamBtn.classList.toggle('active', sess.cameraMode === 'first-person');
    }
  }

  async function enterSurfaceViewUi({ bodyIndex = null, planetaryModeOverride = null } = {}) {
    autopilot = false;
    autopilotBtn?.classList.remove('active');
    if (autopilotBtn) autopilotBtn.textContent = '▶ Tour';
    flyTargetLog10 = null;
    let idx = bodyIndex;
    if (typeof idx === 'string') {
      const cat = physics.getActiveSystemCatalog();
      const foundActive = cat.findIndex((b) => b.id === idx);
      if (foundActive >= 0 && !cat[foundActive].isStar) {
        idx = foundActive;
      } else {
        const foundSol = REAL_SOLAR_SYSTEM_CATALOG.findIndex((b) => b.id === idx);
        if (foundSol > 0) {
          idx = idx; // Pass string straight to physics.enterSurfaceView so it switches to Sol Reference cleanly!
        } else {
          idx = physics.planetaryBodyIndex;
        }
      }
    } else if (!(idx > 0)) {
      const cat = physics.getActiveSystemCatalog();
      idx = (!cat[physics.focusedSolarBodyIndex]?.isStar && physics.focusedSolarBodyIndex > 0)
        ? physics.focusedSolarBodyIndex
        : physics.getDefaultPlanetIndex(cat);
    }
    currentLevel = 4;
    log10ViewSpanM = 2.0; // ~100 m surface horizon scale!
    await physics.enterSurfaceView({ bodyIndex: idx, planetaryModeOverride });
    selectDefaultTarget();
    syncScaleChrome();
    syncSurfaceHud();
    updateInspectorCard();
    renderNow(performance.now());
    return physics.surfaceTelemetry;
  }

  function exitSurfaceViewUi() {
    if (!physics.surfaceActive) return;
    physics.exitSurfaceView();
    const spec = physics.getActiveSystemCatalog()[physics.planetaryBodyIndex] || REAL_SOLAR_SYSTEM_CATALOG[3];
    currentLevel = 4;
    log10ViewSpanM = idealPlanetaryFramingLog10Span(spec);
    orientCameraToSunlitPhase(physics.planetaryBodyIndex);
    syncScaleChrome();
    syncSurfaceHud();
    updateInspectorCard();
    renderNow(performance.now());
  }

  surfaceQuickBtn?.addEventListener('click', () => {
    void enterSurfaceViewUi({ bodyIndex: physics.planetaryBodyIndex });
  });
  surfaceJumpBtn?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    physics.setSurfaceControls({ jump: true });
    syncSurfaceHud();
  });
  const stopSurfaceJump = () => {
    if (physics.surfaceControls.jump) {
      physics.setSurfaceControls({ jump: false });
      syncSurfaceHud();
    }
  };
  surfaceJumpBtn?.addEventListener('pointerup', stopSurfaceJump);
  surfaceJumpBtn?.addEventListener('pointerleave', stopSurfaceJump);
  surfaceJumpBtn?.addEventListener('pointercancel', stopSurfaceJump);
  surfaceDescendBtn?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    physics.setSurfaceControls({ down: true });
    syncSurfaceHud();
  });
  const stopSurfaceDescend = () => {
    if (physics.surfaceControls.down) {
      physics.setSurfaceControls({ down: false });
      syncSurfaceHud();
    }
  };
  surfaceDescendBtn?.addEventListener('pointerup', stopSurfaceDescend);
  surfaceDescendBtn?.addEventListener('pointerleave', stopSurfaceDescend);
  surfaceDescendBtn?.addEventListener('pointercancel', stopSurfaceDescend);
  surfaceVehicleBtn?.addEventListener('click', () => cycleSurfaceVehicle());
  surfaceCamBtn?.addEventListener('click', () => {
    if (!physics.surfaceSession) return;
    const next = physics.surfaceSession.cameraMode === 'chase' ? 'first-person' : 'chase';
    physics.setSurfaceCameraMode(next);
    syncSurfaceHud();
    renderNow(performance.now());
  });
  surfaceOrbitBtn?.addEventListener('click', () => exitSurfaceViewUi());

  // Touch Dual-Joysticks (modeled on peercompute/demos/planetgen TinyPlanetControls)
  function bindTouchJoystick(padEl, knobEl, onMove) {
    if (!padEl || !knobEl) return;
    let activePid = null;
    const maxR = 36;
    const updateFromEvent = (e) => {
      const rect = padEl.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      knobEl.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
      onMove(dx / maxR, -dy / maxR);
    };
    padEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activePid = e.pointerId;
      padEl.setPointerCapture?.(e.pointerId);
      updateFromEvent(e);
    });
    padEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activePid) return;
      updateFromEvent(e);
    });
    const resetJoy = (e) => {
      if (e.pointerId !== activePid) return;
      activePid = null;
      knobEl.style.transform = 'translate(-50%, -50%)';
      onMove(0, 0);
    };
    padEl.addEventListener('pointerup', resetJoy);
    padEl.addEventListener('pointercancel', resetJoy);
  }
  bindTouchJoystick(joyMoveEl, joyMoveKnob, (nx, ny) => {
    physics.setSurfaceControls({ moveX: nx, moveY: ny });
  });
  bindTouchJoystick(joyLookEl, joyLookKnob, (nx, ny) => {
    physics.addSurfaceLookDelta(-nx * 0.08, -ny * 0.05);
  });

  // Desktop TinyPlanetControls Keyboard Handlers (WASD + Space Jump Rockets + F Drone + V Cam + Esc Orbit!)
  const handleSurfaceKeyDown = (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (!physics.surfaceActive) {
      if (e.code === 'KeyL' && currentLevel === 4 && !e.repeat) {
        void enterSurfaceViewUi({ bodyIndex: physics.planetaryBodyIndex });
      }
      return;
    }
    if (e.code === 'KeyW' || e.code === 'ArrowUp') { physics.setSurfaceControls({ forward: true }); e.preventDefault(); }
    else if (e.code === 'KeyS' || e.code === 'ArrowDown') { physics.setSurfaceControls({ backward: true }); e.preventDefault(); }
    else if (e.code === 'KeyA' || e.code === 'ArrowLeft') { physics.setSurfaceControls({ left: true }); e.preventDefault(); }
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') { physics.setSurfaceControls({ right: true }); e.preventDefault(); }
    else if (e.code === 'Space') { physics.setSurfaceControls({ jump: true }); e.preventDefault(); }
    else if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'KeyC') { physics.setSurfaceControls({ down: true }); }
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { physics.setSurfaceControls({ turbo: true }); }
    else if (e.code === 'KeyQ') { physics.setSurfaceControls({ yawLeft: true }); }
    else if (e.code === 'KeyE') { physics.setSurfaceControls({ yawRight: true }); }
    else if (e.code === 'KeyF' && !e.repeat && physics.surfaceSession) {
      cycleSurfaceVehicle();
    } else if (e.code === 'KeyV' && !e.repeat && physics.surfaceSession) {
      physics.setSurfaceCameraMode(physics.surfaceSession.cameraMode === 'chase' ? 'first-person' : 'chase');
      syncSurfaceHud();
    } else if (e.code === 'Escape') {
      exitSurfaceViewUi();
    }
  };
  const handleSurfaceKeyUp = (e) => {
    if (!physics.surfaceActive) return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') physics.setSurfaceControls({ forward: false });
    else if (e.code === 'KeyS' || e.code === 'ArrowDown') physics.setSurfaceControls({ backward: false });
    else if (e.code === 'KeyA' || e.code === 'ArrowLeft') physics.setSurfaceControls({ left: false });
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') physics.setSurfaceControls({ right: false });
    else if (e.code === 'Space') physics.setSurfaceControls({ jump: false });
    else if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'KeyC') physics.setSurfaceControls({ down: false });
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') physics.setSurfaceControls({ turbo: false });
    else if (e.code === 'KeyQ') physics.setSurfaceControls({ yawLeft: false });
    else if (e.code === 'KeyE') physics.setSurfaceControls({ yawRight: false });
  };
  window.addEventListener('keydown', handleSurfaceKeyDown);
  window.addEventListener('keyup', handleSurfaceKeyUp);

  diveBtn?.addEventListener('click', () => {
    autopilot = false;
    autopilotBtn?.classList.remove('active');
    if (autopilotBtn) autopilotBtn.textContent = '▶ Tour';
    void initiateHyperdrive();
  });
  returnBtn?.addEventListener('click', () => {
    autopilot = false;
    autopilotBtn?.classList.remove('active');
    if (autopilotBtn) autopilotBtn.textContent = '▶ Tour';
    void returnToOrbit();
  });
  orbitUpBtn?.addEventListener('click', () => {
    autopilot = false;
    autopilotBtn?.classList.remove('active');
    if (autopilotBtn) autopilotBtn.textContent = '▶ Tour';
    void returnToOrbit();
  });
  autopilotBtn?.addEventListener('click', () => {
    autopilot = !autopilot;
    autopilotBtn.classList.toggle('active', autopilot);
    autopilotBtn.textContent = autopilot ? '⏹ Stop Tour' : '▶ Tour';
    if (autopilot) flyTargetLog10 = null;
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
    flyTargetLog10 = null;
    log10ViewSpanM = UNIVERSES_SCALES[0].log10SpanM;
    currentLevel = 0;
    selectDefaultTarget();
    syncScaleChrome();
  });
  reseedBtn?.addEventListener('click', async () => {
    bigBangFlash = 0.75;
    physics.setSeed((physics.seed + 7919) >>> 0);
    await physics.initCosmicWeb();
    if (physics.galaxyEngine) await physics.initGalaxy();
    if (physics.solarEngine) await physics.initSolarSystem();
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
        if (currentLevel === 0) await physics.initCosmicWeb();
        else if (currentLevel === 1) await physics.initGalaxy();
        else if (currentLevel === 2 && physics.galaxyBranch !== 'smbh-core') await physics.initSolarSystem();
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
    if (pm.connected) await physics.disconnectPeerMesh();
    else {
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

  // ---- Interactive 3D Pointer Orbit, Continuous Wheel Zoom & Universal GPU Mote Picking ----
  let pointerDown = false;
  let pointerMoved = false;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;

  function getActiveGpuPickDescriptor() {
    const span = log10ViewSpanM;
    if (currentLevel === 0) {
      if (physics.cosmoMode !== 'web' && physics.cosmoBaryonSession) {
        const bScale = (12.2 / Math.max(100, physics.cosmoBaryonSession.boxSizeMpc || 260.0)) * Math.pow(10, Math.max(-0.6, Math.min(1.8, 24.8 - span)));
        return {
          kind: 'cosmo-baryon',
          buffer: physics.cosmoBaryonSession.getResidentTracersBuffer(),
          count: physics.cosmoBaryonSession.tracerCount,
          strideFloats: 16,
          layoutMode: GPU_PICK_LAYOUT.STANDARD,
          worldScale: bScale,
          offsetHi: [0, 0, 0],
          offsetLo: [0, 0, 0],
          skipFirst: 0
        };
      }
      if (physics.cosmoSession) {
        return {
          kind: 'cosmo-web',
          buffer: physics.cosmoSession.particlesBuffer,
          count: physics.cosmoSession.particleCount,
          strideFloats: 8,
          layoutMode: GPU_PICK_LAYOUT.STANDARD,
          worldScale: lastWorldScaleInfo.cosmoScale ?? 0.09,
          offsetHi: lastWorldScaleInfo.cosmoOffset ?? [0, 0, 0],
          offsetLo: [0, 0, 0],
          skipFirst: 0
        };
      }
    } else if (currentLevel === 1 && physics.galaxyEngine) {
      return {
        kind: 'galaxy-star',
        buffer: physics.galaxyEngine.getResidentBuffer(),
        count: physics.galaxyEngine.count,
        strideFloats: 8,
        layoutMode: GPU_PICK_LAYOUT.GALAXY_VISIBLE,
        worldScale: lastWorldScaleInfo.galaxyScale ?? 0.85,
        offsetHi: lastWorldScaleInfo.galaxyOffset ?? [0, 0, 0],
        offsetLo: [0, 0, 0],
        skipFirst: 0
      };
    } else if (currentLevel === 2 && physics.galaxyBranch !== 'smbh-core') {
      if (physics.solarMode === 'formation' && physics.protoplanetarySession) {
        const dScale = 0.92 * Math.pow(10, Math.max(-1.2, Math.min(1.2, 12.6 - span)));
        return {
          kind: 'proto-pebble',
          buffer: physics.protoplanetarySession.getResidentPebblesBuffer(),
          count: physics.protoplanetarySession.pebbleCount,
          strideFloats: 16,
          layoutMode: GPU_PICK_LAYOUT.FLAGGED_LIVE_16F,
          worldScale: dScale,
          offsetHi: [0, 0, 0],
          offsetLo: [0, 0, 0],
          skipFirst: 0
        };
      }
      if (physics.solarMode === 'quasar-jet' && physics.kerrJetSession) {
        const qScale = 0.85 * Math.pow(10, Math.max(-1.0, Math.min(1.2, 12.6 - span)));
        return {
          kind: 'kerr-parcel',
          buffer: physics.kerrJetSession.getResidentParcelsBuffer(),
          count: physics.kerrJetSession.particleCount,
          strideFloats: 16,
          layoutMode: GPU_PICK_LAYOUT.FLAGGED_LIVE_16F,
          worldScale: qScale,
          offsetHi: [0, 0, 0],
          offsetLo: [0, 0, 0],
          skipFirst: 0
        };
      }
      if (['xray-binary', 'bns-kilonova', 'type-ia', 'bbh-merger'].includes(physics.solarMode) && physics.relBinarySession) {
        const bScale = 1.12 * Math.pow(10, Math.max(-1.0, Math.min(1.2, 12.6 - span)));
        return {
          kind: 'relbin-parcel',
          buffer: physics.relBinarySession.getResidentParcelsBuffer(),
          count: physics.relBinarySession.particleCount,
          strideFloats: 16,
          layoutMode: GPU_PICK_LAYOUT.FLAGGED_LIVE_16F,
          worldScale: bScale,
          offsetHi: [0, 0, 0],
          offsetLo: [0, 0, 0],
          skipFirst: 0
        };
      }
      if (['comet-tails', 'hot-jupiter'].includes(physics.solarMode) && physics.radWindL2Session) {
        const rScale = 1.05 * Math.pow(10, Math.max(-1.0, Math.min(1.2, 12.6 - span)));
        return {
          kind: 'radwind-parcel',
          buffer: physics.radWindL2Session.getResidentParcelsBuffer(),
          count: physics.radWindL2Session.particleCount,
          strideFloats: 16,
          layoutMode: GPU_PICK_LAYOUT.FLAGGED_LIVE_16F,
          worldScale: rScale,
          offsetHi: [0, 0, 0],
          offsetLo: [0, 0, 0],
          skipFirst: 0
        };
      }
      if (['roche-rings', 'giant-impact', 'red-giant'].includes(physics.solarMode) && physics.tidalRocheSession) {
        const tScale = 1.06 * Math.pow(10, Math.max(-1.0, Math.min(1.2, 12.6 - span)));
        return {
          kind: 'roche-parcel',
          buffer: physics.tidalRocheSession.getResidentParticlesBuffer(),
          count: physics.tidalRocheSession.particleCount,
          strideFloats: 16,
          layoutMode: GPU_PICK_LAYOUT.FLAGGED_LIVE_16F,
          worldScale: tScale,
          offsetHi: [0, 0, 0],
          offsetLo: [0, 0, 0],
          skipFirst: 0
        };
      }
      if (physics.solarEngine) {
        const focusSt = physics.solarEngine.getMassiveBodyState64(physics.focusedSolarBodyIndex);
        const fHi = [Math.fround(focusSt.posAu[0]), Math.fround(focusSt.posAu[1]), Math.fround(focusSt.posAu[2])];
        const fLo = [Math.fround(focusSt.posAu[0] - fHi[0]), Math.fround(focusSt.posAu[1] - fHi[1]), Math.fround(focusSt.posAu[2] - fHi[2])];
        return {
          kind: 'solar-asteroid',
          buffer: physics.solarEngine.getResidentBuffer(),
          count: physics.solarEngine.totalCount,
          strideFloats: 16,
          layoutMode: GPU_PICK_LAYOUT.SOLAR_DOUBLE_FLOAT,
          worldScale: lastWorldScaleInfo.solarScaleAuToWorld ?? 1.0,
          offsetHi: fHi,
          offsetLo: fLo,
          skipFirst: physics.solarEngine.massiveCount
        };
      }
    } else if (currentLevel === 3) {
      const stScale = 0.92 * Math.pow(10, Math.max(-1.0, Math.min(1.0, 9.2 - span)));
      if (physics.stellarMode === 'nebular-mhd' && physics.nebulaMhdSession) {
        return {
          kind: 'nebula-mhd-parcel',
          buffer: physics.nebulaMhdSession.getResidentTracersBuffer(),
          count: physics.nebulaMhdSession.tracerCount,
          strideFloats: 16,
          layoutMode: GPU_PICK_LAYOUT.STANDARD,
          worldScale: stScale * 1.15,
          offsetHi: [0, 0, 0],
          offsetLo: [0, 0, 0],
          skipFirst: 0
        };
      }
      if (['h2-pillars', 'planetary-nebula', 'snr-pwn'].includes(physics.stellarMode) && physics.radWindL3Session) {
        return {
          kind: 'radwind-parcel',
          buffer: physics.radWindL3Session.getResidentParcelsBuffer(),
          count: physics.radWindL3Session.particleCount,
          strideFloats: 16,
          layoutMode: GPU_PICK_LAYOUT.FLAGGED_LIVE_16F,
          worldScale: stScale * 1.05,
          offsetHi: [0, 0, 0],
          offsetLo: [0, 0, 0],
          skipFirst: 0
        };
      }
      if ((physics.stellarMode === 'pulsar' || physics.stellarMode === 'magnetar') && physics.magnetosphereSession) {
        return {
          kind: 'mag-parcel',
          buffer: physics.magnetosphereSession.getResidentParcelsBuffer(),
          count: physics.magnetosphereSession.particleCount,
          strideFloats: 16,
          layoutMode: GPU_PICK_LAYOUT.FLAGGED_LIVE_16F,
          worldScale: stScale * 1.12,
          offsetHi: [0, 0, 0],
          offsetLo: [0, 0, 0],
          skipFirst: 0
        };
      }
      if (physics.stellarEngine) {
        return {
          kind: 'stellar-hydro-parcel',
          buffer: physics.stellarEngine.getResidentBuffer(),
          count: physics.stellarEngine.count,
          strideFloats: 16,
          layoutMode: GPU_PICK_LAYOUT.STANDARD,
          worldScale: stScale * 0.95,
          offsetHi: [0, 0, 0],
          offsetLo: [0, 0, 0],
          skipFirst: 0
        };
      }
    } else if (currentLevel === 5 && physics.mdSession) {
      const box = physics.mdSession.boxLengthsA;
      const maxDim = Math.max(box[0], box[1], box[2], 6.0);
      const baseScale = 8.4 / maxDim;
      const mdZoomFactor = Math.pow(10, Math.max(-1.2, Math.min(1.4, -8.2 - span)));
      return {
        kind: 'md-atom',
        buffer: physics.mdSession.positionsBuffer,
        velBuffer: physics.mdSession.velocitiesBuffer,
        count: physics.mdSession.atomCount,
        strideFloats: 4,
        layoutMode: GPU_PICK_LAYOUT.MD_PERIODIC_4F,
        worldScale: baseScale * mdZoomFactor,
        offsetHi: [0, 0, 0],
        offsetLo: [box[0] * 0.5, box[1] * 0.5, box[2] * 0.5],
        skipFirst: 0
      };
    }
    return null;
  }

  function decodePickedGpuMote(desc, index, rawFloats) {
    const f = rawFloats;
    const sc = desc.worldScale || 1.0;
    const offHi = desc.offsetHi || [0, 0, 0];
    const offLo = desc.offsetLo || [0, 0, 0];
    let rawPos = [f[0] || 0, f[1] || 0, f[2] || 0];
    let worldPos;
    if (desc.layoutMode === GPU_PICK_LAYOUT.SOLAR_DOUBLE_FLOAT) {
      rawPos = [f[0] + f[4], f[1] + f[5], f[2] + f[6]];
      worldPos = [
        ((f[0] - offHi[0]) + (f[4] - offLo[0])) * sc,
        ((f[1] - offHi[1]) + (f[5] - offLo[1])) * sc,
        ((f[2] - offHi[2]) + (f[6] - offLo[2])) * sc
      ];
    } else if (desc.layoutMode === GPU_PICK_LAYOUT.MD_PERIODIC_4F) {
      worldPos = [(f[0] - offLo[0]) * sc, (f[1] - offLo[1]) * sc, (f[2] - offLo[2]) * sc];
    } else {
      worldPos = [(f[0] - offHi[0]) * sc, (f[1] - offHi[1]) * sc, (f[2] - offHi[2]) * sc];
    }

    if (desc.kind === 'cosmo-web') {
      const vMag = Math.hypot(f[4] || 0, f[5] || 0, f[6] || 0);
      const dens = Math.max(0.1, Number(f[7]) || 1.0);
      const predGal = physics.deriveGalaxyEnvironmentFromCosmicContext({
        cosmicEpoch: physics.cosmicEpoch,
        regionPosMpc: rawPos,
        localOverdensity: dens,
        seed: physics.seed
      });
      return {
        kind: desc.kind, level: currentLevel, index, rawPos, worldPos,
        localOverdensity: dens,
        name: `Cosmic-Web Halo Mote #${index}`,
        subtitle: `${predGal.morphologyLabel} · δ/ρ̄=${dens.toFixed(2)}× · [Fe/H]=${predGal.baseFeH >= 0 ? '+' : ''}${predGal.baseFeH.toFixed(2)}`,
        composition: `Causal Cosmic Context: f_gas=${(predGal.gasFraction * 100).toFixed(0)}% · C/O=${predGal.baseCO.toFixed(2)} · Dive to form this galaxy`,
        tempK: 8500,
        stats: [
          ['Comoving r', `${Math.hypot(...rawPos).toFixed(1)} Mpc`],
          ['Peculiar |v|', `${(vMag * 120).toFixed(0)} km/s`],
          ['Local δ/ρ̄', `${dens.toFixed(2)}×`],
          ['Morphology', predGal.morphology]
        ]
      };
    }
    if (desc.kind === 'cosmo-baryon') {
      const isDm = (f[11] || 0) > 0.5;
      const tK = Number(f[8]) || 3000;
      const xHii = Number(f[9]) || 0;
      const rho = Number(f[7]) || 1.0;
      return {
        kind: desc.kind, level: currentLevel, index, rawPos, worldPos,
        name: `${isDm ? 'Dark-Matter Lensing Halo' : 'Baryon / IGM Parcel'} #${index}`,
        subtitle: `Live GPU Cosmological Tracer · (${rawPos[0].toFixed(1)}, ${rawPos[1].toFixed(1)}, ${rawPos[2].toFixed(1)}) Mpc`,
        composition: isDm ? 'Collisionless CDM Mass Tracer' : `H/He Plasma · x_HII=${(xHii * 100).toFixed(1)}% · T=${tK > 1e5 ? `${(tK / 1e6).toFixed(1)} MK` : `${Math.round(tK)} K`}`,
        tempK: Math.max(2500, Math.min(35000, tK)),
        stats: [
          ['Species', isDm ? 'Dark Matter' : 'Baryon Gas'],
          ['Temp T', tK > 1e5 ? `${(tK / 1e6).toFixed(2)} MK` : `${Math.round(tK)} K`],
          ['Ionized x_HII', `${(xHii * 100).toFixed(1)}%`],
          ['Density ρ', `${rho.toFixed(2)} ρ̄`]
        ]
      };
    }
    if (desc.kind === 'galaxy-star') {
      const pop = Number(f[7]) || 0;
      const rKly = Math.hypot(rawPos[0], rawPos[2]) * 5.2;
      const zKly = rawPos[1] * 5.2;
      const vOrb = Math.hypot(f[4] || 0, f[5] || 0, f[6] || 0);
      const bVec = physics.galacticDynamoSession?.sampleBAt?.(rawPos[0], rawPos[1], rawPos[2]) || [0, 0, 0];
      const bLocal = Math.hypot(bVec[0], bVec[1], bVec[2]);
      const starSite = { posGal: [...rawPos], popTag: pop, starIndex: index };
      const stPreview = physics.deriveStarSystemFromGalacticLocation({
        cosmicEpoch: physics.cosmicEpoch,
        galaxyEnv: physics.activeGalaxyEnv,
        starPosGal: rawPos,
        popTag: pop,
        starIndex: index,
        seed: (physics.seed + 409) >>> 0
      });
      const plPreview = physics.synthesizeNebularPlanetarySystem(stPreview, { seedOverride: (physics.seed + 409) >>> 0 });
      const multLbl = stPreview.multiplicity === 3 ? 'Trinary' : (stPreview.multiplicity === 2 ? 'Binary' : 'Single');
      const specLbl = stPreview.stars.map((s) => s.spectralCode).join('+');
      return {
        kind: desc.kind, level: currentLevel, index, rawPos, worldPos, starSite,
        name: `Star #${index} · ${stPreview.systemName} (${multLbl} ${specLbl})`,
        subtitle: `${stPreview.galacticRegion} · R=${rKly.toFixed(1)} kly · ${plPreview.planetCount} worlds${plPreview.hasEarthLike ? ' (Earth-like!)' : ''}`,
        composition: `Nebula: ${stPreview.nebulaEnv.nebulaSummary} · Click 🎯 Focus or Dive to simulate this system`,
        tempK: stPreview.stars[0].effectiveTempK,
        stats: [
          ['Multiplicity', `${multLbl} (${specLbl})`],
          ['Nebula [Fe/H]', `${stPreview.nebulaEnv.feH >= 0 ? '+' : ''}${stPreview.nebulaEnv.feH.toFixed(2)}`],
          ['Local |B|', `${(bLocal * 12.0).toFixed(2)} μG`],
          ['Orbital |v|', `${(vOrb * 24.5).toFixed(0)} km/s`]
        ]
      };
    }
    if (desc.kind === 'solar-asteroid') {
      const rAu = Math.hypot(rawPos[0], rawPos[1], rawPos[2]);
      const vAuYr = Math.hypot(f[8] || 0, f[9] || 0, f[10] || 0);
      const vKmS = vAuYr * 4.7405;
      const isKbo = (f[11] || 0) > 6.5 || rAu > 12;
      return {
        kind: desc.kind, level: currentLevel, index, rawPos, worldPos,
        name: `${isKbo ? 'Kuiper Belt Object' : 'Main-Belt Asteroid'} #${index}`,
        subtitle: `f32x2 Symplectic N-Body Minor Body · r = ${rAu.toFixed(3)} AU`,
        composition: isKbo ? 'H₂O / CH₄ / N₂ Outer-System Icy Planetesimal' : 'Carbonaceous / Silicate Chondrite Asteroid',
        tempK: Math.max(40, Math.round(280 / Math.sqrt(Math.max(0.2, rAu)))),
        stats: [
          ['Helio r', `${rAu.toFixed(3)} AU`],
          ['Speed |v|', `${vKmS.toFixed(2)} km/s`],
          ['Zone', isKbo ? 'Kuiper Belt' : 'Main Belt'],
          ['GPU Index', `#${index}`]
        ]
      };
    }
    if (desc.kind === 'proto-pebble') {
      const rAu = Math.hypot(rawPos[0], rawPos[1], rawPos[2]);
      const tK = Number(f[8]) || 180;
      const ice = Number(f[9]) || 0;
      return {
        kind: desc.kind, level: currentLevel, index, rawPos, worldPos,
        name: `${ice > 0.5 ? 'Icy Outer' : 'Rocky Silicate'} Pebble #${index}`,
        subtitle: `Epstein/Stokes Gas-Drag Disk Tracer · r = ${rAu.toFixed(2)} AU`,
        composition: ice > 0.5 ? 'Condensed H₂O/CO Ice + Silicate Core (Beyond Snow Line)' : 'Refractory Silicate + Fe-Ni Chondrule Dust',
        tempK: Math.max(50, Math.min(2000, tK)),
        stats: [
          ['Disk r', `${rAu.toFixed(2)} AU`],
          ['Temp T(r)', `${Math.round(tK)} K`],
          ['Ice Frac', `${(ice * 100).toFixed(0)}%`],
          ['Speed |v|', `${Math.hypot(f[4] || 0, f[5] || 0, f[6] || 0).toFixed(2)}`]
        ]
      };
    }
    if (desc.kind === 'stellar-hydro-parcel') {
      const logT = Number(f[8]) || 4.0;
      const logRho = Number(f[9]) || -5.0;
      const tK = Math.pow(10, logT);
      const xH = Number(f[10]) || 0.72;
      const logEps = Number(f[11]) || -30;
      const xIon = Number(f[13]) || 0;
      const xHe = Number(f[14]) || 0.26;
      const xZ = Number(f[15]) || 0.02;
      const bVec = physics.stellarDynamoSession?.sampleBAt?.(rawPos[0], rawPos[1], rawPos[2]) || [0, 0, 0];
      const bLoc = Math.hypot(bVec[0], bVec[1], bVec[2]);
      return {
        kind: desc.kind, level: currentLevel, index, rawPos, worldPos,
        name: `Stellar Plasma Parcel #${index}`,
        subtitle: `self-gravitating-hydro@1 · r = ${Math.hypot(...rawPos).toFixed(2)} · x_ion = ${(xIon * 100).toFixed(0)}%`,
        composition: `H ${(xH * 100).toFixed(1)}% · He ${(xHe * 100).toFixed(1)}% · Z ${(xZ * 100).toFixed(2)}%`,
        tempK: Math.max(2000, Math.min(40000, tK)),
        stats: [
          ['Parcel T', tK >= 1e6 ? `${(tK / 1e6).toFixed(2)} MK` : `${Math.round(tK).toLocaleString()} K`],
          ['log₁₀ ρ', `${logRho.toFixed(2)} kg/m³`],
          ['Fusion ε', logEps > -12 ? `10^${logEps.toFixed(1)} W/kg` : 'Inactive'],
          ['Dynamo |B|', `${bLoc.toFixed(3)} B_sim`]
        ]
      };
    }
    if (desc.kind === 'nebula-mhd-parcel') {
      const bMag = Number(f[7]) || 0;
      const rho = Number(f[11]) || 0;
      const jetV = Number(f[13]) || 0;
      return {
        kind: desc.kind, level: currentLevel, index, rawPos, worldPos,
        name: `MHD Nebula Parcel #${index}`,
        subtitle: `3D Resistive MHD · B = (${(f[8] || 0).toFixed(2)}, ${(f[9] || 0).toFixed(2)}, ${(f[10] || 0).toFixed(2)})`,
        composition: jetV > 0.15 ? 'Magnetocentrifugal (J×B) Bipolar Jet Plasma' : 'Rotating Magnetized Molecular Cloud Gas & Dust',
        tempK: jetV > 0.15 ? 14000 : 4200,
        stats: [
          ['Local |B|', `${bMag.toFixed(3)}`],
          ['Density ρ', `${rho.toFixed(2)}`],
          ['Jet Outflow', `${jetV.toFixed(2)}`],
          ['Speed |v|', `${Math.hypot(f[4] || 0, f[5] || 0, f[6] || 0).toFixed(2)}`]
        ]
      };
    }
    if (desc.kind === 'mag-parcel' || desc.kind === 'kerr-parcel' || desc.kind === 'relbin-parcel') {
      const role = Number(f[3]) || 0;
      const gamma = Math.max(1.0, Number(f[7]) || 1.0);
      const aux = Number(f[9]) || 0;
      const roleLbl = desc.kind === 'mag-parcel'
        ? (role > 1.5 ? 'Reconnection Flare / PWN' : (role > 0.5 ? 'Polar-Cap Open Beam' : 'Closed Magnetosphere Loop'))
        : (desc.kind === 'kerr-parcel'
          ? (role > 0.5 && role < 1.5 ? 'Blandford–Znajek Jet' : 'Novikov–Thorne Disk')
          : (role > 1.5 ? 'r-Process Ejecta' : 'Relativistic Stream'));
      return {
        kind: desc.kind, level: currentLevel, index, rawPos, worldPos,
        name: `${roleLbl} Parcel #${index}`,
        subtitle: `Persistent GPU Plasma Mote · Lorentz Γ = ${gamma.toFixed(2)}×`,
        composition: `Speed |v| = ${Math.hypot(f[4] || 0, f[5] || 0, f[6] || 0).toFixed(2)} · r = ${Math.hypot(...rawPos).toFixed(2)}`,
        tempK: 22000,
        stats: [
          ['Role', roleLbl.slice(0, 14)],
          ['Lorentz Γ', `${gamma.toFixed(2)}×`],
          [desc.kind === 'mag-parcel' ? 'Local |B|' : 'Y_e / Aux', `${aux.toFixed(3)}`],
          ['Emissivity', `${(f[10] || 0).toFixed(2)}`]
        ]
      };
    }
    if (desc.kind === 'radwind-parcel' || desc.kind === 'roche-parcel') {
      const spd = Math.hypot(f[4] || 0, f[5] || 0, f[6] || 0);
      return {
        kind: desc.kind, level: currentLevel, index, rawPos, worldPos,
        name: `${desc.kind === 'radwind-parcel' ? 'Photoionized Nebula/Tail' : 'Tidal Debris/Ring'} Parcel #${index}`,
        subtitle: `Live GPU Parcel · r = ${Math.hypot(...rawPos).toFixed(2)} · |v| = ${spd.toFixed(2)}`,
        composition: desc.kind === 'radwind-parcel'
          ? `Hα=${(f[8] || 0).toFixed(2)} · [O III]=${(f[9] || 0).toFixed(2)} · [S II]=${(f[10] || 0).toFixed(2)}`
          : `Intact=${(f[7] || 0) > 0.5 ? 'Cohesive' : 'Disrupted'} · T_norm=${(f[8] || 0).toFixed(2)}`,
        tempK: 11000,
        stats: [
          ['Radius r', `${Math.hypot(...rawPos).toFixed(2)}`],
          ['Speed |v|', `${spd.toFixed(2)}`],
          [desc.kind === 'radwind-parcel' ? 'Hα / [O III]' : 'Temp Norm', desc.kind === 'radwind-parcel' ? `${(f[8] || 0).toFixed(1)} / ${(f[9] || 0).toFixed(1)}` : `${(f[8] || 0).toFixed(2)}`],
          ['GPU Index', `#${index}`]
        ]
      };
    }
    if (desc.kind === 'md-atom') {
      const b = physics.getCachedElementBundle(physics.mdElementZ, true)?.bundle;
      const sym = b?.symbol || `Z=${physics.mdElementZ}`;
      return {
        kind: desc.kind, level: currentLevel, index, rawPos, worldPos,
        name: `Atom #${index} · ${sym} (Z=${physics.mdElementZ})`,
        subtitle: `Live WebGPU MD Atom · (${rawPos[0].toFixed(2)}, ${rawPos[1].toFixed(2)}, ${rawPos[2].toFixed(2)}) Å`,
        composition: `${b?.mechanical?.crystalStructure || 'lattice'} · m = ${(b?.nuclear?.atomicMassU || 55.8).toFixed(2)} u`,
        tempK: physics.mdTelemetry?.temperatureK || physics.mdTempK,
        stats: [
          ['Element', `${sym} (Z=${physics.mdElementZ})`],
          ['Lattice x,y', `${rawPos[0].toFixed(1)}, ${rawPos[1].toFixed(1)} Å`],
          ['Lattice z', `${rawPos[2].toFixed(2)} Å`],
          ['Bath Temp', `${Math.round(physics.mdTelemetry?.temperatureK || physics.mdTempK)} K`]
        ]
      };
    }
    return {
      kind: desc.kind, level: currentLevel, index, rawPos, worldPos,
      name: `GPU Mote #${index}`,
      subtitle: `Live Resident WebGPU Entity`,
      composition: '',
      tempK: 6000,
      stats: [['Index', `#${index}`], ['X', rawPos[0].toFixed(2)], ['Y', rawPos[1].toFixed(2)], ['Z', rawPos[2].toFixed(2)]]
    };
  }

  function pickTargetAt(clientX, clientY) {
    const targets = physics.getTargetsForLevel(currentLevel, lastWorldScaleInfo);
    let best = null;
    let bestDist = 42;
    for (const t of targets) {
      // Skip generic origin placeholder targets when clicking on rich GPU particle clouds!
      if (currentLevel === 0 && physics.cosmoMode !== 'web') continue;
      if (currentLevel === 2 && !['nbody', 'smbh-core'].includes(physics.solarMode) && physics.galaxyBranch !== 'smbh-core') continue;
      if (currentLevel === 3 || currentLevel === 5) continue;
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

  async function pickAnyEntityAt(clientX, clientY, { preferGpuMote = false } = {}) {
    // 1. At L7 Atomic Nucleus, allow clicking ANY individual quantized proton (p+) or neutron (n0)!
    if (currentLevel === 7 && lastNucleonSpheres.length > 0) {
      let bestNuc = null;
      let bestD = 36;
      for (let i = 0; i < lastNucleonSpheres.length; i += 1) {
        const s = lastNucleonSpheres[i];
        const proj = projectWorldToScreen(s.pos, lastViewProj, lastCssW, lastCssH);
        if (!proj.visible) continue;
        const d = Math.hypot(proj.sx - clientX, proj.sy - clientY);
        if (d < bestD) {
          bestD = d;
          bestNuc = { idx: i, sphere: s };
        }
      }
      if (bestNuc) {
        const isProton = bestNuc.sphere.color0[0] > 0.7;
        const rFm = Math.hypot(...bestNuc.sphere.pos) * (Number(physics.nuclearResult?.chargeRadiusFm || 3.7) / 2.2);
        pickedGpuMote = {
          kind: 'nucleon',
          level: 7,
          index: bestNuc.idx,
          rawPos: [...bestNuc.sphere.pos],
          worldPos: [...bestNuc.sphere.pos],
          name: `${isProton ? 'Proton p⁺' : 'Neutron n⁰'} #${bestNuc.idx + 1} (${physics.nuclearA}${physics.nuclearResult?.isotope?.split('-')[0] || ''})`,
          subtitle: isProton ? 'Valence Quarks u-u-d · Charge +1e · Spin ½' : 'Valence Quarks u-d-d · Charge 0 · Spin ½',
          composition: `Bound inside Woods–Saxon nuclear potential (B/A = ${(physics.nuclearResult?.bindingPerNucleonMeV || 8.79).toFixed(3)} MeV)`,
          tempK: 1e10,
          stats: [
            ['Baryon', isProton ? 'Proton (p⁺)' : 'Neutron (n⁰)'],
            ['Shell r', `${rFm.toFixed(2)} fm`],
            ['Mass', isProton ? '938.27 MeV' : '939.57 MeV'],
            ['Quarks', isProton ? 'u u d' : 'u d d']
          ]
        };
        updateInspectorCard();
        renderNow(performance.now());
        return pickedGpuMote;
      }
    }

    // 2. Check named macro bodies (Planets/Moons on L2, Sgr A* on L1, named Superclusters on L0)
    if (!preferGpuMote) {
      const macroHit = pickTargetAt(clientX, clientY);
      if (macroHit && (currentLevel === 2 || currentLevel === 4 || (currentLevel === 1 && macroHit.isSmbh))) {
        pickedGpuMote = null;
        moteFocusLocked = false;
        selectedTargetId = macroHit.id;
        if (currentLevel === 1 && macroHit.branch) {
          physics.setGalaxyBranch(macroHit.branch, macroHit.pos);
        } else if (currentLevel === 2 && macroHit.bodyIndex != null) {
          physics.setFocusedSolarBody(macroHit.bodyIndex);
          if (macroHit.bodyIndex > 0) void physics.initPlanetaryInterior({ bodyIndex: macroHit.bodyIndex });
        }
        renderScaleControls();
        updateInspectorCard();
        return macroHit;
      }
    }

    // 3. Universal WebGPU Entity Ray-Picker directly on the active scale's live resident GPU buffer!
    const desc = getActiveGpuPickDescriptor();
    if (desc && desc.buffer && desc.count > 0) {
      const ndcX = (clientX / Math.max(1, lastCssW)) * 2 - 1;
      const ndcY = 1 - (clientY / Math.max(1, lastCssH)) * 2;
      const aspect = lastCssW / Math.max(1, lastCssH);
      const hit = await entityPicker.pickEntity({
        buffer: desc.buffer,
        count: desc.count,
        strideFloats: desc.strideFloats,
        layoutMode: desc.layoutMode,
        skipFirst: desc.skipFirst || 0,
        viewProj: lastViewProj,
        clickNdcX: ndcX,
        clickNdcY: ndcY,
        aspect,
        maxPickNdc: 0.14,
        offsetHi: desc.offsetHi,
        offsetLo: desc.offsetLo,
        worldScale: desc.worldScale
      });
      if (hit) {
        const raw = new Float32Array([...hit.vec0, ...hit.vec1, ...hit.vec2, ...hit.vec3]);
        pickedGpuMote = decodePickedGpuMote(desc, hit.index, raw);
        updateInspectorCard();
        renderNow(performance.now());
        return pickedGpuMote;
      }
    }

    // 4. Fallback to macro target if GPU buffer pick found nothing near cursor
    const fallback = pickTargetAt(clientX, clientY);
    if (fallback) {
      pickedGpuMote = null;
      moteFocusLocked = false;
      selectedTargetId = fallback.id;
      if (currentLevel === 1 && fallback.branch) physics.setGalaxyBranch(fallback.branch, fallback.pos);
      renderScaleControls();
      updateInspectorCard();
      return fallback;
    }
    return null;
  }

  async function refreshTrackedPickedMote() {
    if (!pickedGpuMote || pickedGpuMote.level !== currentLevel || pickedGpuMote.kind === 'nucleon') return;
    const desc = getActiveGpuPickDescriptor();
    if (!desc || desc.kind !== pickedGpuMote.kind || !desc.buffer) return;
    const raw = await entityPicker.readSingleEntity(desc.buffer, pickedGpuMote.index, desc.strideFloats);
    if (raw && pickedGpuMote && pickedGpuMote.kind === desc.kind) {
      pickedGpuMote = decodePickedGpuMote(desc, pickedGpuMote.index, raw);
    }
  }

  function focusPickedMote({ zoomIn = false } = {}) {
    if (!pickedGpuMote) return false;
    if (currentLevel === 0 && pickedGpuMote.kind === 'cosmo-web') {
      physics.setCosmoFocusMpc(pickedGpuMote.rawPos);
      moteFocusLocked = true;
      if (zoomIn) flyToLog10Span(Math.max(21.2, log10ViewSpanM - 1.6));
    } else if (currentLevel === 1 && pickedGpuMote.kind === 'galaxy-star') {
      physics.setGalaxyBranch('solar-system', pickedGpuMote.rawPos);
      if (pickedGpuMote.starSite) void physics.selectCausalStarSite(pickedGpuMote.starSite);
      moteFocusLocked = true;
      if (zoomIn) flyToLog10Span(Math.max(17.5, log10ViewSpanM - 1.5));
    } else {
      moteFocusLocked = !moteFocusLocked || zoomIn;
      if (moteFocusLocked) {
        camTarget = [...pickedGpuMote.worldPos];
        if (zoomIn) camState.dist = Math.max(6.5, camState.dist * 0.62);
      } else {
        camTarget = [0, 0, 0];
        camState.dist = 18.0;
      }
    }
    updateInspectorCard();
    renderNow(performance.now());
    return true;
  }

  focusMoteBtn?.addEventListener('click', () => {
    focusPickedMote({ zoomIn: !moteFocusLocked });
  });

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
      if (physics.surfaceActive) {
        physics.addSurfaceLookDelta(-dx * 0.0055, dy * 0.0055);
      } else {
        camState.yaw -= dx * 0.006;
        camState.pitch = Math.max(-1.42, Math.min(1.42, camState.pitch + dy * 0.006));
      }
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (!physics.surfaceActive) {
      const hit = pickTargetAt(e.clientX, e.clientY);
      hoveredTargetId = hit?.id || null;
      canvas.style.cursor = hit ? 'pointer' : 'crosshair';
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (pointerDown && !pointerMoved && !physics.surfaceActive) {
      autopilot = false;
      autopilotBtn?.classList.remove('active');
      if (autopilotBtn) autopilotBtn.textContent = '▶ Tour';
      void pickAnyEntityAt(e.clientX, e.clientY);
    }
    pointerDown = false;
  });
  canvas.addEventListener('dblclick', async (e) => {
    if (physics.surfaceActive) return;
    autopilot = false;
    autopilotBtn?.classList.remove('active');
    if (autopilotBtn) autopilotBtn.textContent = '▶ Tour';
    const picked = await pickAnyEntityAt(e.clientX, e.clientY);
    if (picked && picked === pickedGpuMote) {
      focusPickedMote({ zoomIn: true });
    } else {
      void initiateHyperdrive();
    }
  });

  // TRUE CONTINUOUS 40-ORDER-OF-MAGNITUDE MOUSE-WHEEL ZOOM!
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (physics.surfaceActive) return;
    autopilot = false;
    autopilotBtn?.classList.remove('active');
    if (autopilotBtn) autopilotBtn.textContent = '▶ Tour';
    flyTargetLog10 = null;
    // Scroll up (deltaY < 0) zooms IN (smaller log10SpanM); scroll down zooms OUT
    const deltaLog = Math.max(-0.55, Math.min(0.55, e.deltaY * 0.0024));
    log10ViewSpanM = Math.max(LOG10_SPAN_MIN, Math.min(LOG10_SPAN_MAX, log10ViewSpanM + deltaLog));
    zoomVelocityLog10PerSec = Math.abs(deltaLog) * 10.0;
    void warmVisibleLevels(log10ViewSpanM);
  }, { passive: false });

  // ---- 2D Emission Spectrograph & Live Scientific Plots ----
  function drawSpectrograph(target) {
    if (!specCanvas) return;
    const ctx2 = specCanvas.getContext('2d');
    if (!ctx2) return;
    const w = specCanvas.width;
    const h = specCanvas.height;
    ctx2.fillStyle = '#040812';
    ctx2.fillRect(0, 0, w, h);
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
      if (p0.length === logK.length) drawCurve(logK.map(mx), p0.map(my), 'rgba(148,163,184,0.6)', null, true);
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
      if (['xray-binary', 'bns-kilonova', 'type-ia', 'bbh-merger'].includes(physics.solarMode) && physics.relBinaryTelemetry?.gwStrainHistory?.length) {
        const hist = physics.relBinaryTelemetry.gwStrainHistory;
        if (plotTitle) plotTitle.textContent = '2.5PN GRAVITATIONAL-WAVE STRAIN h_+(t)';
        if (plotMeta) plotMeta.textContent = `f_GW=${(physics.relBinaryTelemetry.gwFrequency || 0).toFixed(2)} · sep=${(physics.relBinaryTelemetry.separation || 0).toFixed(2)}`;
        const hMax = Math.max(0.08, ...hist.map((v) => Math.abs(v)));
        const xs = hist.map((_, i) => 12 + (i / Math.max(1, hist.length - 1)) * (w - 24));
        const ys = hist.map((v) => (h * 0.5) - (v / hMax) * (h * 0.38));
        drawCurve(xs, ys, '#38bdf8', 'rgba(56,189,248,0.14)', false);
      } else if (physics.solarMode === 'quasar-jet' && physics.kerrJetTelemetry) {
        if (plotTitle) plotTitle.textContent = 'NOVIKOV–THORNE DISK T(r) & BZ JET';
        const kt = physics.kerrJetTelemetry;
        if (plotMeta) plotMeta.textContent = `a*=${kt.spinA.toFixed(2)} · r_ISCO=${kt.rIscoRg.toFixed(2)} r_g · Γ=${kt.maxLorentzGamma.toFixed(1)}`;
        const xs = []; const ys = [];
        for (let i = 0; i < 48; i += 1) {
          const rRatio = 1.02 + (i / 47) * 9.0;
          const nt = Math.pow(1 / rRatio, 0.75) * Math.pow(Math.max(0.01, 1 - Math.sqrt(1 / rRatio)), 0.25);
          xs.push(12 + (i / 47) * (w - 24));
          ys.push((h - 12) - Math.min(1, nt * 2.2) * (h - 24));
        }
        drawCurve(xs, ys, '#f472b6', 'rgba(244,114,182,0.20)', false);
      } else {
        if (plotTitle) plotTitle.textContent = UNIVERSES_SCALES[2].plotTitle;
        const c0 = physics.solarConservation0;
        const c1 = physics.solarConservation;
        const dERel = c0 && c1 ? Math.abs(c1.totalEnergy - c0.totalEnergy) / Math.max(1e-12, Math.abs(c0.totalEnergy)) : 0;
        if (plotMeta) plotMeta.textContent = `|ΔE/E₀|=${dERel.toExponential(1)} · ${physics.solarEngine?.totalCount || 0} bodies`;
        const cat = physics.getActiveSystemCatalog();
        const planets = cat.filter((b) => !b.isStar && (b.parent === 0 || b.parent === -2) && b.id !== 'halley');
        const barW = (w - 32) / Math.max(1, planets.length);
        planets.forEach((p, i) => {
          const frac = Math.min(1, Math.log10(Math.max(30, p.tempK)) / 3.3);
          const bh = frac * (h - 28);
          const bx = 16 + i * barW + 2;
          ctx2.fillStyle = `rgb(${Math.round(p.color0[0] * 255)},${Math.round(p.color0[1] * 255)},${Math.round(p.color0[2] * 255)})`;
          ctx2.fillRect(bx, h - 12 - bh, Math.max(6, barW - 6), bh);
          ctx2.fillStyle = '#94a3b8';
          ctx2.font = '8.5px monospace';
          ctx2.fillText(p.name.split(' ').slice(-1)[0].replace(/[()]/g, '').slice(0, 4), bx, h - 14 - bh);
        });
      }
    } else if (currentLevel === 3) {
      if ((physics.stellarMode === 'pulsar' || physics.stellarMode === 'magnetar') && physics.magnetosphereTelemetry?.flareHistory?.length) {
        const hist = physics.magnetosphereTelemetry.flareHistory;
        if (plotTitle) plotTitle.textContent = physics.stellarMode === 'magnetar' ? 'MAGNETAR HALL-YIELD FLARE LIGHT CURVE' : 'PULSAR SPIN-DOWN BEAM FLUX';
        if (plotMeta) plotMeta.textContent = `B=${physics.magnetosphereTelemetry.surfaceBFieldTesla.toExponential(1)} T · Flares=${physics.magnetosphereTelemetry.flareCount}`;
        const fMax = Math.max(0.4, ...hist);
        const xs = hist.map((_, i) => 12 + (i / Math.max(1, hist.length - 1)) * (w - 24));
        const ys = hist.map((v) => (h - 12) - (v / fMax) * (h - 24));
        drawCurve(xs, ys, physics.stellarMode === 'magnetar' ? '#f472b6' : '#38bdf8', 'rgba(244,114,182,0.18)', false);
      } else if (physics.stellarMode === 'white-dwarf-tov' && physics.tovCurve?.length) {
        if (plotTitle) plotTitle.textContent = 'WEBGPU GR TOV MASS–RADIUS M(R) SEQUENCE';
        const pts = physics.tovCurve.filter((p) => p.radiusKm > 1 && p.massSolar > 0.05);
        if (plotMeta) plotMeta.textContent = `${pts.length} GR TOV solutions · WD → NS → BH`;
        const xs = pts.map((p) => 12 + ((Math.log10(p.radiusKm) - 0.8) / 3.6) * (w - 24));
        const ys = pts.map((p) => (h - 12) - Math.min(1, p.massSolar / 3.2) * (h - 24));
        drawCurve(xs, ys, '#34d399', 'rgba(52,211,153,0.18)', false);
      } else {
        if (plotTitle) plotTitle.textContent = UNIVERSES_SCALES[3].plotTitle;
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
      }
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
    const hasMote = Boolean(pickedGpuMote && pickedGpuMote.level === currentLevel);
    const target = hasMote ? pickedGpuMote : getSelectedTarget();
    if (scaleBadge) scaleBadge.textContent = `10^${log10ViewSpanM.toFixed(1)} m`;
    if (zoomReadout) zoomReadout.textContent = formatPhysicalSpan(log10ViewSpanM);
    if (zoomSlider && document.activeElement !== zoomSlider) zoomSlider.value = log10ViewSpanM.toFixed(2);
    if (targetKicker) {
      targetKicker.textContent = hasMote
        ? `GPU MOTE INSPECTOR · L${sc.level} · ${formatPhysicalSpan(log10ViewSpanM)}`
        : `L${sc.level} · ${sc.name.toUpperCase()} · ${formatPhysicalSpan(log10ViewSpanM)}`;
    }
    if (targetName) targetName.textContent = target?.name || sc.name;
    if (targetSub) targetSub.textContent = target?.subtitle || sc.engineSchema;
    if (compText) compText.textContent = target?.composition || '';
    if (specTitle) specTitle.textContent = currentLevel >= 5 ? 'GATE 1 OPTICAL SPECTRUM' : 'EMISSION SPECTROGRAPH';
    if (focusMoteBtn) {
      focusMoteBtn.style.display = hasMote && !physics.surfaceActive ? 'inline-flex' : 'none';
      focusMoteBtn.textContent = moteFocusLocked ? '🎯 Locked' : '🎯 Focus';
      focusMoteBtn.classList.toggle('active', moteFocusLocked);
    }

    let cells = [];
    if (hasMote && Array.isArray(pickedGpuMote.stats) && pickedGpuMote.stats.length) {
      cells = pickedGpuMote.stats;
    } else if (currentLevel === 0) {
      if (physics.cosmoMode !== 'web' && physics.cosmoBaryonTelemetry) {
        const bt = physics.cosmoBaryonTelemetry;
        const tempLabel = bt.redshiftZ > 100
          ? `${bt.cmbTempK.toFixed(0)} K`
          : (bt.maxGasTempK >= 1e5 ? `${(bt.maxGasTempK / 1e6).toFixed(1)} MK` : `${Math.round(bt.maxGasTempK).toLocaleString()} K`);
        cells = [
          ['Redshift z', `${bt.redshiftZ.toFixed(bt.redshiftZ > 100 ? 0 : 2)}`],
          ['T_CMB / Gas', tempLabel],
          ['Ionized x_HII', `${(bt.meanIonizedFraction * 100).toFixed(1)}%`],
          ['Lensing κ_max', `${bt.maxLensingKappa.toFixed(2)}`]
        ];
      } else {
        const ct = physics.cosmoTelemetry;
        cells = [
          ['Scale a(t)', ct ? ct.scaleFactorA.toFixed(3) : '—'],
          ['Redshift z', ct ? ct.redshiftZ.toFixed(2) : '—'],
          ['Density σ', ct ? ct.sigmaDensity.toFixed(3) : '—'],
          ['GPU Submits', ct ? `${ct.submitsPerStep}/step` : '—']
        ];
      }
    } else if (currentLevel === 1) {
      cells = [
        ['GPU Particles', `${(physics.galaxyEngine?.count || 0).toLocaleString()}`],
        ['Morphology', physics.galaxyPreset],
        ['DM Halo', 'NFW / Hernquist'],
        ['GPU Steps', `${physics.galaxyEngine?.stepIndex || 0}`]
      ];
    } else if (currentLevel === 2) {
      if (physics.solarMode === 'formation' && physics.protoplanetaryTelemetry) {
        const pt = physics.protoplanetaryTelemetry;
        cells = [
          ['Snow Line', `${pt.snowLineAu.toFixed(2)} AU`],
          ['Rocky / Icy', `${pt.rockyPebbles} / ${pt.icyPebbles}`],
          ['Accreted', `${pt.accretedPebbles} peb`],
          ['Rigid Bodies', `${pt.rigidBodyCount} (DLM)`]
        ];
      } else if (physics.solarMode === 'quasar-jet' && physics.kerrJetTelemetry) {
        const kt = physics.kerrJetTelemetry;
        cells = [
          ['Kerr Spin a*', kt.spinA.toFixed(2)],
          ['Lorentz Γ_max', `${kt.maxLorentzGamma.toFixed(2)}×`],
          ['r_ISCO / r_g', `${kt.rIscoRg.toFixed(2)}`],
          ['BZ Jet Parcels', `${kt.activeJetParcels}`]
        ];
      } else if (['xray-binary', 'bns-kilonova', 'type-ia', 'bbh-merger'].includes(physics.solarMode) && physics.relBinaryTelemetry) {
        const rt = physics.relBinaryTelemetry;
        cells = [
          ['Separation', rt.merged ? 'MERGED' : rt.separation.toFixed(2)],
          ['GW Strain h_+', rt.gwStrainPlus.toFixed(3)],
          ['Remnant', rt.remnantType.slice(0, 14)],
          ['r-Proc Parcels', `${rt.rProcessEjectaCount}`]
        ];
      } else if (['comet-tails', 'hot-jupiter'].includes(physics.solarMode) && physics.radWindL2Telemetry) {
        const wt = physics.radWindL2Telemetry;
        cells = [
          ['Regime', wt.regime],
          ['Ionized x_HII', `${(wt.meanIonizedFraction * 100).toFixed(1)}%`],
          ['Mean Outflow', `${wt.meanOutflowSpeed.toFixed(2)}`],
          ['Live Parcels', `${wt.activeParcels}`]
        ];
      } else if (['roche-rings', 'giant-impact', 'red-giant'].includes(physics.solarMode) && physics.tidalRocheTelemetry) {
        const tt = physics.tidalRocheTelemetry;
        cells = [
          ['Ruptured', `${(tt.rupturedFraction * 100).toFixed(0)}%`],
          ['Max Strain', tt.maxTidalStrain.toFixed(2)],
          ['Mean Radius', tt.meanRadiusSim.toFixed(2)],
          ['Live Debris', `${tt.activeParticles}`]
        ];
      } else {
        const c1 = physics.solarConservation;
        const cat = physics.getActiveSystemCatalog();
        const spec = cat[physics.focusedSolarBodyIndex] || cat[0];
        const arch = physics.useSolReference ? 'Sol (1★)' : `${physics.activeCausalSystem?.starCount || 1}★ ${physics.activeCausalSystem?.architecture || 'single'}`;
        cells = [
          ['Focus', (spec?.name || 'World').slice(0, 18)],
          ['Architecture', arch],
          ['True Radius', spec ? `${spec.radiusKm.toLocaleString()} km` : '—'],
          ['Sim Time', `${(physics.solarEngine?.simTimeYr || 0).toFixed(3)} yr`]
        ];
        if (c1 && physics.galaxyBranch === 'smbh-core') {
          cells[0] = ['SMBH Mass', '4.3×10⁶ M☉'];
          cells[1] = ['Lensing', lensingEnabled ? 'Active WGSL' : 'OFF'];
        }
      }
    } else if (currentLevel === 3) {
      if (physics.stellarMode === 'nebular-mhd' && physics.nebulaMhdTelemetry) {
        const nt = physics.nebulaMhdTelemetry;
        cells = [
          ['Mag Energy', `${nt.magneticEnergy.toFixed(1)}`],
          ['Toroidal B_φ', `${nt.peakToroidalB.toFixed(3)}`],
          ['Max |B|', `${nt.maxBField.toFixed(3)}`],
          ['|∇·B| GLM', `${nt.meanAbsDivB.toExponential(1)}`]
        ];
      } else if (['h2-pillars', 'planetary-nebula', 'snr-pwn'].includes(physics.stellarMode) && physics.radWindL3Telemetry) {
        const wt = physics.radWindL3Telemetry;
        cells = [
          ['Ionized x_HII', `${(wt.meanIonizedFraction * 100).toFixed(1)}%`],
          ['Outflow Speed', wt.meanOutflowSpeed.toFixed(2)],
          ['Line Flux', wt.meanLineEmission.toFixed(2)],
          ['Live Parcels', `${wt.activeParcels}`]
        ];
      } else if ((physics.stellarMode === 'pulsar' || physics.stellarMode === 'magnetar') && physics.magnetosphereTelemetry) {
        const mt = physics.magnetosphereTelemetry;
        cells = [
          ['Surface B', `${mt.surfaceBFieldTesla.toExponential(1)} T`],
          ['Spin-Down Ė', `${mt.spinDownLumW.toExponential(1)} W`],
          ['Starquakes', `${mt.flareCount} flares`],
          ['Crust Strain', `${(mt.crustStrain * 100).toFixed(0)}%`]
        ];
      } else if (physics.stellarMode === 'white-dwarf-tov' && physics.tovCurve?.length) {
        const wd = physics.tovCurve.find((p) => p.branch === 'white-dwarf') || physics.tovCurve[2];
        const ns = physics.tovCurve.find((p) => p.branch === 'neutron-star') || physics.tovCurve[11];
        cells = [
          ['WD Sample', `${wd.massSolar.toFixed(2)} M☉`],
          ['WD Radius', `${Math.round(wd.radiusKm).toLocaleString()} km`],
          ['NS Sample', `${ns.massSolar.toFixed(2)} M☉`],
          ['NS Radius', `${ns.radiusKm.toFixed(1)} km`]
        ];
      } else {
        const st = physics.stellarTelemetry;
        cells = [
          ['Core Temp', st ? `${(st.coreTempK / 1e6).toFixed(2)} MK` : '—'],
          ['Stage', st?.stage || 'hydro-collapse'],
          ['GPU Steps', `${physics.stellarEngine?.stepIndex || 0}`],
          ['LE n=3 ξ₁', `${(physics.stellarLaneEmden?.solutions?.[1]?.xi1 || 6.9).toFixed(3)}`]
        ];
      }
    } else if (currentLevel === 4) {
      if (physics.surfaceActive && physics.surfaceSession) {
        const st = physics.surfaceTelemetry || physics.surfaceSession.getTelemetry();
        const env = physics.surfaceSession.env;
        cells = [
          ['Surface g', `${env.gravityMS2.toFixed(2)} m/s²`],
          ['Air ρ_atm', env.rhoAtmKgM3 > 1e-4 ? `${env.rhoAtmKgM3.toFixed(3)} kg/m³` : '0 (Vacuum)'],
          ['Rover Alt/Fuel', `${st.roverAltitudeM.toFixed(1)}m / ${Math.round(st.roverRocketFuel * 100)}%`],
          ['Drone Max Lift', env.droneFlightCapable ? `${env.maxAeroLiftN.toFixed(1)} N (OK)` : '0.0 N (Vac)']
        ];
      } else {
        const pr = physics.planetaryResult;
        const at = physics.planetaryAtmoTelemetry;
        const cat = physics.getActiveSystemCatalog();
        const spec = cat[physics.planetaryBodyIndex] || cat[0];
        cells = [
          ['World', (spec?.name || 'World').slice(0, 18)],
          ['MoI I/MR²', pr ? pr.moiFactor.toFixed(4) : '—'],
          ['Lightning', at ? `${at.activeLightningCells} cells` : 'Dormant (Vac)'],
          ['Peak |E|', at ? `${(at.peakElectricFieldVPerM / 1e3).toFixed(0)} kV/m` : '0 kV/m']
        ];
      }
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

  function drawReticles(viewProj) {
    if (!reticleCtx) return;
    reticleCtx.clearRect(0, 0, lastCssW, lastCssH);
    const targets = physics.getTargetsForLevel(currentLevel, lastWorldScaleInfo);
    if (!targets.length) return;
    for (const t of targets) {
      // At outer Solar System scale, keep moon reticles hidden until zoomed in (< 10^10.5 m)
      if (currentLevel === 2 && t.spec?.parent > 0 && log10ViewSpanM > 10.5) continue;
      // Don't draw bracket right over full-screen planet globe at L4
      if (currentLevel === 4 && !physics.planetaryCutaway) continue;
      const p = projectWorldToScreen(t.pos, viewProj, lastCssW, lastCssH);
      if (!p.visible) continue;
      const isSel = t.id === selectedTargetId;
      const isHov = t.id === hoveredTargetId;
      if (!isSel && !isHov && currentLevel >= 3) continue;
      const r = isSel ? 18 : (isHov ? 15 : 8);
      reticleCtx.strokeStyle = isSel ? 'rgba(56, 189, 248, 0.90)' : (isHov ? 'rgba(186, 230, 253, 0.78)' : 'rgba(148, 163, 184, 0.42)');
      reticleCtx.lineWidth = isSel ? 1.6 : 1.0;
      const arm = Math.max(4, r * 0.45);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        reticleCtx.beginPath();
        reticleCtx.moveTo(p.sx + sx * r, p.sy + sy * (r - arm));
        reticleCtx.lineTo(p.sx + sx * r, p.sy + sy * r);
        reticleCtx.lineTo(p.sx + sx * (r - arm), p.sy + sy * r);
        reticleCtx.stroke();
      }
      if (isSel || isHov || (currentLevel === 2 && t.spec?.parent === 0 && log10ViewSpanM > 9.5)) {
        reticleCtx.font = isSel ? '600 11px monospace' : '500 9.5px monospace';
        reticleCtx.fillStyle = isSel ? '#e0f2fe' : 'rgba(203, 213, 225, 0.78)';
        reticleCtx.fillText(t.name, p.sx + r + 6, p.sy + 3.5);
      }
    }
    if (pickedGpuMote && pickedGpuMote.level === currentLevel && pickedGpuMote.worldPos) {
      const mp = projectWorldToScreen(pickedGpuMote.worldPos, viewProj, lastCssW, lastCssH);
      if (mp.visible) {
        const mr = 14;
        reticleCtx.save();
        reticleCtx.strokeStyle = 'rgba(250, 204, 21, 0.96)';
        reticleCtx.lineWidth = 1.9;
        // Crisp rotated diamond + crosshair locked directly onto the live GPU mote!
        reticleCtx.beginPath();
        reticleCtx.moveTo(mp.sx, mp.sy - mr);
        reticleCtx.lineTo(mp.sx + mr, mp.sy);
        reticleCtx.lineTo(mp.sx, mp.sy + mr);
        reticleCtx.lineTo(mp.sx - mr, mp.sy);
        reticleCtx.closePath();
        reticleCtx.stroke();
        reticleCtx.beginPath();
        reticleCtx.arc(mp.sx, mp.sy, 3.0, 0, Math.PI * 2);
        reticleCtx.fillStyle = '#fde047';
        reticleCtx.fill();
        reticleCtx.font = '600 11px monospace';
        reticleCtx.fillStyle = '#fef08a';
        reticleCtx.fillText(pickedGpuMote.name, mp.sx + mr + 7, mp.sy + 3.5);
        reticleCtx.restore();
      }
    }
  }

  // ---- Build Seamless Continuous-Zoom Multi-Scale Scene Payload ----
  function buildContinuousScenePayload(camera, nowSec) {
    const span = log10ViewSpanM;
    const spanMeters = Math.pow(10, span);
    // Visible world-space width at origin for dist=18, fov=48 deg is ~16 world units!
    const WORLD_VIEW_SPAN = 16.0;

    const particleClouds = [];
    const spheres = [];
    const disks = [];
    const lineChunks = [];
    let lightDir = [0.62, 0.55, 0.55];
    let atmoEm = null;
    let mdCloud = null;
    let nuclearVol = null;
    const post = {
      bhUv: [0.5, 0.5],
      bhStrength: 0,
      warpAmount: Math.min(0.65, zoomVelocityLog10PerSec * 0.08),
      flashAmount: bigBangFlash,
      crtEnabled: retroCrt,
      pixelSize,
      timeSec: nowSec
    };

    // 1. L0: 2LPT Cosmic Web OR Cosmological Baryon/Radiation (CMB z=1100 / Reionization z=10 / Bullet-Cluster Lensing)
    const wCosmo = bandWeight(span, 20.8, 22.0, 25.6, 26.0);
    const cosmoFocusRaw = physics.cosmoTargets[0]?.posMpc || [0, 0, 0];
    const cosmoBlend = smoothstep(23.8, 21.8, span);
    const cosmoFocus = [cosmoFocusRaw[0] * cosmoBlend, cosmoFocusRaw[1] * cosmoBlend, cosmoFocusRaw[2] * cosmoBlend];
    const cosmoScale = (WORLD_VIEW_SPAN / 178.0) * Math.pow(10, Math.min(2.6, 24.8 - span));
    lastWorldScaleInfo.cosmoScale = cosmoScale;
    lastWorldScaleInfo.cosmoOffset = cosmoFocus;
    if (wCosmo > 0.01) {
      if (physics.cosmoMode !== 'web' && physics.cosmoBaryonSession && span >= 22.0) {
        const wBay = bandWeight(span, 22.0, 22.7, 25.6, 26.0);
        const bScale = (12.2 / Math.max(100, physics.cosmoBaryonSession.boxSizeMpc || 260.0)) * Math.pow(10, Math.max(-0.6, Math.min(1.8, 24.8 - span)));
        particleClouds.push({
          buffer: physics.cosmoBaryonSession.getResidentTracersBuffer(),
          count: physics.cosmoBaryonSession.tracerCount,
          mode: 10,
          worldScale: bScale,
          pointSize: physics.cosmoMode === 'cmb' ? 0.16 : (physics.cosmoMode === 'cluster-merger' ? 0.12 : 0.145),
          alphaGain: (physics.cosmoMode === 'cmb' ? 0.15 : (physics.cosmoMode === 'cluster-merger' ? 0.18 : 0.28)) * wBay,
          extra1: [0, 0, 0, physics.cosmoBaryonSession.boxSizeMpc || 260.0]
        });
        if (physics.cosmoMode === 'cluster-merger' && lensingEnabled && wBay > 0.25) {
          const projC = projectWorldToScreen([0, 0, 0], camera.viewProj, lastCssW, lastCssH);
          if (projC.visible) {
            post.bhUv = [projC.uvX, projC.uvY];
            post.bhStrength = 0.0009 * wBay;
          }
        }
      } else if (physics.cosmoSession && physics.cosmoMode === 'web') {
        particleClouds.push({
          buffer: physics.cosmoSession.particlesBuffer,
          count: physics.cosmoSession.particleCount,
          mode: 0,
          worldScale: cosmoScale,
          pointSize: Math.max(0.048, Math.min(0.17, 0.068 * Math.pow(10, Math.max(-0.5, Math.min(0.8, 24.8 - span))))),
          alphaGain: 0.44 * wCosmo,
          extra1: [cosmoFocus[0], cosmoFocus[1], cosmoFocus[2], physics.cosmoSession.boxSizeMpc || 200.0]
        });
      }
    }

    // 2. L1: Flat-Rotation Spiral Galaxy (22.8 -> 15.4, HDR golden bulge + crisp fine star sprites!)
    const wGal = bandWeight(span, 15.4, 16.6, 22.0, 22.8);
    const galExp = Math.max(-1.8, Math.min(2.5, 21.0 - span));
    const galScale = Math.pow(10, galExp) * 0.85;
    const galOff = physics.galaxyFocusPos || [4.8, 0.04, 2.1];
    const offBlend = smoothstep(20.6, 18.8, span);
    const effGalOff = [galOff[0] * offBlend, galOff[1] * offBlend, galOff[2] * offBlend];
    lastWorldScaleInfo.galaxyScale = galScale;
    lastWorldScaleInfo.galaxyOffset = effGalOff;
    if (wGal > 0.01 && physics.galaxyEngine) {
      particleClouds.push({
        buffer: physics.galaxyEngine.getResidentBuffer(),
        count: physics.galaxyEngine.count,
        mode: 1,
        worldScale: galScale,
        pointSize: Math.max(0.028, Math.min(0.14, 0.056 * Math.pow(10, Math.max(-1.2, Math.min(0.6, 21.0 - span))))),
        alphaGain: 0.34 * wGal,
        extra1: [effGalOff[0], effGalOff[1], effGalOff[2], 0]
      });
      // 100% EMERGENT 3D GPU α–ω Galactic Dynamo magnetic streamlines traced through live GPU B(x,y,z)!
      // (Zero hardcoded analytic spiral formulas; B₀ = 0 produces 0 streamlines!)
      if (showOrbits && physics.showGalacticBField && physics.galacticDynamoStreamlines?.length >= 14 && span > 18.8) {
        const bFade = wGal * smoothstep(18.8, 20.2, span);
        const rawG = physics.galacticDynamoStreamlines;
        for (let i = 0; i < rawG.length; i += 7) {
          lineChunks.push(
            (rawG[i] - effGalOff[0]) * galScale,
            (rawG[i + 1] - effGalOff[1]) * galScale,
            (rawG[i + 2] - effGalOff[2]) * galScale,
            rawG[i + 3], rawG[i + 4], rawG[i + 5], rawG[i + 6] * bFade
          );
        }
      }
    }

    // 3. L2 / L4: REAL-SCALE DOUBLE-FLOAT SYMPLECTIC SOLAR SYSTEM (17.2 -> 5.2) OR GALACTIC SMBH CORE!
    if (physics.galaxyBranch === 'smbh-core') {
      const wSmbh = bandWeight(span, 9.2, 10.6, 15.8, 17.0);
      if (wSmbh > 0.01) {
        const smbhScale = Math.pow(10, Math.max(-1.4, Math.min(1.4, 12.6 - span)));
        const rBh = 0.72 * smbhScale;
        spheres.push({ pos: [0, 0, 0], radius: rBh, color0: [0, 0, 0], color1: [0, 0, 0], kind: 5 });
        disks.push({
          center: [0, 0, 0],
          rIn: rBh * 1.18,
          normal: [0.08, 0.96, 0.24],
          rOut: rBh * 4.4,
          color: [1.0, 0.85, 0.55],
          kind: 0
        });
        if (physics.smbhBodies) {
          const nS = Math.floor(physics.smbhBodies.length / 8);
          for (let i = 1; i < nS; i += 1) {
            const o = i * 8;
            spheres.push({
              pos: [physics.smbhBodies[o] * smbhScale, physics.smbhBodies[o + 1] * smbhScale, physics.smbhBodies[o + 2] * smbhScale],
              radius: Math.max(0.05, 0.14 * smbhScale),
              color0: [0.68, 0.88, 1.0],
              color1: [0.35, 0.62, 1.0],
              kind: 0
            });
          }
        }
        if (lensingEnabled) {
          const projBh = projectWorldToScreen([0, 0, 0], camera.viewProj, lastCssW, lastCssH);
          if (projBh.visible) {
            post.bhUv = [projBh.uvX, projBh.uvY];
            post.bhStrength = 0.0024 * Math.min(2.2, smbhScale) * wSmbh;
          }
        }
      }
    } else if (physics.solarMode === 'formation' && currentLevel === 2 && physics.protoplanetarySession) {
      // L2 FORMATION MODE: Live Protoplanetary Accretion Disk + Snow Line + DLM Particle-Rigid Planetesimals!
      const wDisk = bandWeight(span, 9.6, 10.6, 15.6, 16.8);
      if (wDisk > 0.01) {
        const dScale = 0.92 * Math.pow(10, Math.max(-1.2, Math.min(1.2, 12.6 - span)));
        particleClouds.push({
          buffer: physics.protoplanetarySession.getResidentPebblesBuffer(),
          count: physics.protoplanetarySession.pebbleCount,
          mode: 6,
          worldScale: dScale,
          pointSize: Math.max(0.036, Math.min(0.13, 0.060 * dScale)),
          alphaGain: 0.52 * wDisk,
          extra1: [0, 0, 0, 0]
        });
        spheres.push(...physics.protoplanetarySession.getEmbryoRenderSpheres(dScale));
        // Radiative H2O Snow Line circle guide (T = 170 K from Gate 2 Polytope!)
        if (showOrbits) {
          const rSnow = physics.protoplanetarySession.snowLineAu * dScale;
          const segs = 72;
          let prev = null;
          for (let s = 0; s <= segs; s += 1) {
            const a = (s / segs) * Math.PI * 2;
            const pt = [Math.cos(a) * rSnow, 0, Math.sin(a) * rSnow];
            if (prev) {
              lineChunks.push(...prev, 0.36, 0.84, 1.0, 0.45 * wDisk);
              lineChunks.push(...pt, 0.36, 0.84, 1.0, 0.45 * wDisk);
            }
            prev = pt;
          }
        }
      }
    } else if (physics.solarMode === 'quasar-jet' && currentLevel === 2 && physics.kerrJetSession) {
      // L2 QUASAR / BLAZAR: Live Kerr BH + Novikov–Thorne Accretion Disk + Blandford–Znajek Doppler-Beamed Jets!
      const wQ = bandWeight(span, 9.6, 10.6, 15.6, 16.8);
      if (wQ > 0.01) {
        const qScale = 0.85 * Math.pow(10, Math.max(-1.0, Math.min(1.2, 12.6 - span)));
        const rH = physics.kerrJetSession.horizonVisualRadius * qScale;
        spheres.push({ pos: [0, 0, 0], radius: rH * 1.05, color0: [0, 0, 0], color1: [0, 0, 0], kind: 5 });
        particleClouds.push({
          buffer: physics.kerrJetSession.getResidentParcelsBuffer(),
          count: physics.kerrJetSession.particleCount,
          mode: 7,
          worldScale: qScale,
          pointSize: Math.max(0.05, Math.min(0.16, 0.095 * qScale)),
          alphaGain: 0.26 * wQ,
          extra1: [0, 0, 0, 0]
        });
        if (lensingEnabled) {
          const projQ = projectWorldToScreen([0, 0, 0], camera.viewProj, lastCssW, lastCssH);
          if (projQ.visible) {
            post.bhUv = [projQ.uvX, projQ.uvY];
            post.bhStrength = 0.0014 * wQ;
          }
        }
      }
    } else if (['xray-binary', 'bns-kilonova', 'type-ia', 'bbh-merger'].includes(physics.solarMode) && currentLevel === 2 && physics.relBinarySession) {
      // L2 RELATIVISTIC BINARY MERGERS: X-Ray Binary / BNS Kilonova r-Process / Type Ia Detonation / BBH GW Chirp!
      const wB = bandWeight(span, 9.6, 10.6, 15.6, 16.8);
      if (wB > 0.01) {
        const bScale = 1.12 * Math.pow(10, Math.max(-1.0, Math.min(1.2, 12.6 - span)));
        spheres.push(...physics.relBinarySession.getRenderSpheres(bScale));
        particleClouds.push({
          buffer: physics.relBinarySession.getResidentParcelsBuffer(),
          count: physics.relBinarySession.particleCount,
          mode: 7,
          worldScale: bScale,
          pointSize: Math.max(0.05, Math.min(0.16, 0.092 * bScale)),
          alphaGain: 0.24 * wB,
          extra1: [0, 0, 0, 0]
        });
        if (lensingEnabled && (physics.solarMode === 'bbh-merger' || physics.solarMode === 'xray-binary')) {
          const projB = projectWorldToScreen([0, 0, 0], camera.viewProj, lastCssW, lastCssH);
          if (projB.visible) {
            post.bhUv = [projB.uvX, projB.uvY];
            post.bhStrength = (physics.solarMode === 'bbh-merger' ? 0.0014 : 0.0007) * wB;
          }
        }
      }
    } else if (['comet-tails', 'hot-jupiter'].includes(physics.solarMode) && currentLevel === 2 && physics.radWindL2Session) {
      // L2 ACTIVE DUAL-TAIL COMET OR HOT-JUPITER XUV PHOTOEVAPORATION!
      const wR = bandWeight(span, 9.6, 10.6, 15.6, 16.8);
      if (wR > 0.01) {
        const rScale = 1.05 * Math.pow(10, Math.max(-1.0, Math.min(1.2, 12.6 - span)));
        const isComet = physics.solarMode === 'comet-tails';
        lightDir = isComet ? [0.76, 0.24, 0.60] : [0.82, 0.14, 0.55];
        spheres.push(isComet
          ? { pos: [0, 0, 0], radius: 0.34 * rScale, color0: [0.82, 0.88, 0.94], color1: [0.42, 0.48, 0.56], kind: 3, atm: 0.28 }
          : { pos: [0, 0, 0], radius: 1.02 * rScale, color0: [1.0, 0.48, 0.16], color1: [0.68, 0.20, 0.08], kind: 2, atm: 0.72 });
        particleClouds.push({
          buffer: physics.radWindL2Session.getResidentParcelsBuffer(),
          count: physics.radWindL2Session.particleCount,
          mode: 8,
          worldScale: rScale,
          pointSize: Math.max(0.05, Math.min(0.15, 0.095 * rScale)),
          alphaGain: 0.25 * wR,
          extra1: [0, 0, 0, 0]
        });
      }
    } else if (['roche-rings', 'giant-impact', 'red-giant'].includes(physics.solarMode) && currentLevel === 2 && physics.tidalRocheSession) {
      // L2 TIDAL ROCHE DISRUPTION RINGS + SHEPHERD MOON / GIANT IMPACT / RED-GIANT ENGULFMENT!
      const wT = bandWeight(span, 9.6, 10.6, 15.6, 16.8);
      if (wT > 0.01) {
        const tScale = 1.06 * Math.pow(10, Math.max(-1.0, Math.min(1.2, 12.6 - span)));
        spheres.push(...physics.tidalRocheSession.getRenderSpheres(tScale));
        particleClouds.push({
          buffer: physics.tidalRocheSession.getResidentParticlesBuffer(),
          count: physics.tidalRocheSession.particleCount,
          mode: 9,
          worldScale: tScale,
          pointSize: Math.max(0.045, Math.min(0.14, 0.078 * tScale)),
          alphaGain: 0.28 * wT,
          extra1: [0, 0, 0, 0]
        });
      }
    } else {
      // REAL-SCALE SOLAR SYSTEM CONTINUOUSLY SPANNING 10^17 m -> 10^5.6 m (Earth/Saturn/Jupiter/Moon!)
      const wSolar = bandWeight(span, 5.4, 6.4, 15.8, 17.2);
      const spanAu = spanMeters / AU_METERS;
      const scaleAuToWorld = WORLD_VIEW_SPAN / Math.max(1e-9, spanAu);
      lastWorldScaleInfo.solarScaleAuToWorld = scaleAuToWorld;

      if (wSolar > 0.01 && physics.solarEngine) {
        const cat = physics.solarEngine.catalog || physics.getActiveSystemCatalog();
        const focusIdx = Math.max(0, Math.min(cat.length - 1, physics.focusedSolarBodyIndex));
        const focusSpec = cat[focusIdx];
        const isFocusStar = Boolean(focusSpec?.isStar) || focusIdx === 0;
        const focusSt = physics.solarEngine.getMassiveBodyState64(focusIdx);
        const sunSt = physics.solarEngine.getMassiveBodyState64(0);
        const fHi = [Math.fround(focusSt.posAu[0]), Math.fround(focusSt.posAu[1]), Math.fround(focusSt.posAu[2])];
        const fLo = [Math.fround(focusSt.posAu[0] - fHi[0]), Math.fround(focusSt.posAu[1] - fHi[1]), Math.fround(focusSt.posAu[2] - fHi[2])];

        // Primary host-star light direction on the focused world (or locked/rogue override at L4!)
        if (!isFocusStar) {
          if (currentLevel === 4 && physics.planetaryMode === 'eyeball-locked') {
            lightDir = [1.0, 0.0, 0.0];
          } else if (currentLevel === 4 && physics.planetaryMode === 'rogue') {
            lightDir = [0.15, 0.96, 0.22];
          } else {
            const dxS = sunSt.posAu[0] - focusSt.posAu[0];
            const dyS = sunSt.posAu[1] - focusSt.posAu[1];
            const dzS = sunSt.posAu[2] - focusSt.posAu[2];
            lightDir = vec3Norm([dxS, dyS, dzS]);
          }
        }

        const meta0 = physics.getTargetsForLevel(4)[0];
        const rCoreNorm = meta0?.rCoreNorm ?? 0.54;
        const rMantleNorm = meta0?.rMantleNorm ?? 0.94;

        // Render ALL massive stars (single, binary, trinary!), planets & moons at 100% TRUE astronomical radii!
        const mLim = Math.min(physics.solarEngine.massiveCount, cat.length);
        for (let i = 0; i < mLim; i += 1) {
          const spec = cat[i];
          const st = physics.solarEngine.getMassiveBodyState64(i);
          const wx = (st.posAu[0] - focusSt.posAu[0]) * scaleAuToWorld;
          const wy = (st.posAu[1] - focusSt.posAu[1]) * scaleAuToWorld;
          const wz = (st.posAu[2] - focusSt.posAu[2]) * scaleAuToWorld;
          if (Math.hypot(wx, wy, wz) > 180 && i !== focusIdx) continue;
          const trueRWorld = st.radiusAu * scaleAuToWorld;
          const bodyIsStar = Boolean(spec.isStar) || i === 0;
          // Hide focused star's opaque photosphere at L3 (`span <= 9.9`) so live 3D MHD / Fusion Plasma shines unobstructed!
          if (i === focusIdx && bodyIsStar && span <= 9.9) continue;

          const isFocusL4 = (i === focusIdx && !bodyIsStar && span < 8.85);
          const isCutPlanet = (isFocusL4 && physics.planetaryCutaway);
          const isMagmaOcean = (isFocusL4 && !isCutPlanet && (physics.planetaryMode === 'magma-ocean' || spec.kind === 7));
          const isCryoMoon = (isFocusL4 && !isCutPlanet && physics.planetaryMode === 'cryo-plumes');
          const isRogue = (isFocusL4 && !isCutPlanet && physics.planetaryMode === 'rogue');
          const sphereIdx = spheres.length;
          spheres.push({
            pos: [wx, wy, wz],
            radius: trueRWorld,
            color0: isMagmaOcean ? [1.0, 0.44, 0.10] : (isCryoMoon ? [0.86, 0.92, 0.98] : (isRogue ? [0.16, 0.24, 0.36] : spec.color0)),
            color1: isMagmaOcean ? [0.22, 0.08, 0.05] : (isCryoMoon ? [0.48, 0.68, 0.86] : (isRogue ? [0.06, 0.10, 0.18] : spec.color1)),
            kind: isCutPlanet ? 4 : (isMagmaOcean ? 7 : (isCryoMoon ? 3 : spec.kind)),
            atm: isMagmaOcean ? 0.55 : (isCryoMoon ? 0.18 : (spec.atm ?? 0.35)),
            rCore: rCoreNorm,
            rMantle: rMantleNorm,
            cutaway: isCutPlanet,
            seed: i * 2.17 + 1.3
          });
          // Bind zero-copy live GPU spherical baroclinic atmosphere + triboelectric lightning + polar aurorae onto the focused world!
          if (isFocusL4 && !isMagmaOcean && !isCryoMoon && physics.planetaryAtmoSession) {
            atmoEm = {
              buffer: physics.planetaryAtmoSession.getResidentEmVisBuffer(),
              width: physics.planetaryAtmoSession.width,
              height: physics.planetaryAtmoSession.height,
              sphereIndex: sphereIdx
            };
          }
          // Supersonic Cryovolcanic Ice Plumes erupting from south pole of the focused icy moon!
          if (isCryoMoon && physics.cryoPlumeSession) {
            const pScale = trueRWorld / 2.35;
            particleClouds.push({
              buffer: physics.cryoPlumeSession.getResidentParticlesBuffer(),
              count: physics.cryoPlumeSession.particleCount,
              mode: 9,
              worldScale: pScale,
              pointSize: Math.max(0.05, 0.085 * pScale),
              alphaGain: 0.34 * wSolar,
              extra1: [0, 0, 0, 0]
            });
          }
          if (spec.ringed && trueRWorld > 0.008) {
            disks.push({
              center: [wx, wy, wz],
              rIn: (spec.ringInnerKm / spec.radiusKm) * trueRWorld,
              normal: [0.16, 0.89, 0.42],
              rOut: (spec.ringOuterKm / spec.radiusKm) * trueRWorld,
              color: [0.88, 0.78, 0.62],
              kind: 1
            });
          }
        }

        // Zero-copy GPU N-body Main Belt & Kuiper Belt asteroids!
        const wAst = bandWeight(span, 10.6, 11.4, 14.5, 16.2);
        if (wAst > 0.01) {
          particleClouds.push({
            buffer: physics.solarEngine.getResidentBuffer(),
            count: physics.solarEngine.totalCount,
            mode: 4,
            worldScale: scaleAuToWorld,
            pointSize: 0.055,
            alphaGain: 0.42 * wAst,
            extra1: [fHi[0], fHi[1], fHi[2], physics.solarEngine.massiveCount],
            extra2: [fLo[0], fLo[1], fLo[2], 0]
          });
        }

        if (showOrbits && span > 8.1) {
          const wOrb = bandWeight(span, 8.1, 8.8, 15.2, 16.4);
          lineChunks.push(...buildSolarOsculatingOrbitLines(physics.solarEngine, focusSt.posAu, scaleAuToWorld, span, wOrb));
        }
      }
    }

    // 4. L3: MHD Nebular Collapse & Bipolar Jets OR Stellar Core Fusion Plasma (`self-gravitating-hydro@1`)
    const wStarCore = (physics.focusedSolarBodyIndex === 0 && physics.galaxyBranch !== 'smbh-core')
      ? bandWeight(span, 7.0, 7.8, 9.7, 10.4)
      : 0;
    if (wStarCore > 0.01) {
      const stScale = 0.92 * Math.pow(10, Math.max(-1.0, Math.min(1.0, 9.2 - span)));
      if (physics.stellarMode === 'nebular-mhd' && physics.nebulaMhdSession) {
        particleClouds.push({
          buffer: physics.nebulaMhdSession.getResidentTracersBuffer(),
          count: physics.nebulaMhdSession.tracerCount,
          mode: 5,
          worldScale: stScale * 1.15,
          pointSize: Math.max(0.06, Math.min(0.24, 0.14 * stScale)),
          alphaGain: 0.56 * wStarCore,
          extra1: [0, 0, 0, 0]
        });
        if (physics.nebulaMhdStreamlines?.length >= 14) {
          // Live 3D magnetic field streamlines traced through GPU B(x,y,z)!
          const rawL = physics.nebulaMhdStreamlines;
          const scL = stScale * 1.15;
          for (let i = 0; i < rawL.length; i += 7) {
            lineChunks.push(rawL[i] * scL, rawL[i + 1] * scL, rawL[i + 2] * scL, rawL[i + 3], rawL[i + 4], rawL[i + 5], rawL[i + 6] * wStarCore);
          }
        }
      } else if (['h2-pillars', 'planetary-nebula', 'snr-pwn'].includes(physics.stellarMode) && physics.radWindL3Session) {
        // L3 PHOTOIONIZED NEBULAE: H II Star-Forming Pillars, Bipolar Planetary Nebula, & SNR / Crab PWN!
        particleClouds.push({
          buffer: physics.radWindL3Session.getResidentParcelsBuffer(),
          count: physics.radWindL3Session.particleCount,
          mode: 8,
          worldScale: stScale * 1.05,
          pointSize: Math.max(0.06, Math.min(0.18, 0.105 * stScale)),
          alphaGain: 0.17 * wStarCore,
          extra1: [0, 0, 0, 0]
        });
        if (physics.stellarMode === 'planetary-nebula') {
          spheres.push({ pos: [0, 0, 0], radius: 0.24 * stScale, color0: [0.76, 0.94, 1.0], color1: [0.42, 0.78, 1.0], kind: 0 });
        } else if (physics.stellarMode === 'snr-pwn') {
          spheres.push({ pos: [0, 0, 0], radius: 0.22 * stScale, color0: [0.62, 0.88, 1.0], color1: [0.85, 0.48, 1.0], kind: 0 });
        } else {
          // Ionizing OB star cluster illuminating H II Pillar tips!
          spheres.push({ pos: [3.6 * stScale, 3.2 * stScale, 2.4 * stScale], radius: 0.30 * stScale, color0: [0.72, 0.90, 1.0], color1: [0.45, 0.72, 1.0], kind: 0 });
        }
      } else if ((physics.stellarMode === 'pulsar' || physics.stellarMode === 'magnetar') && physics.magnetosphereSession) {
        // L3 COMPACT MAGNETOSPHERE: Millisecond Pulsar Lighthouse & Magnetar Hall-Yield Giant Flare!
        const isMag = physics.stellarMode === 'magnetar';
        spheres.push({
          pos: [0, 0, 0],
          radius: 0.44 * stScale,
          color0: isMag ? [1.0, 0.78, 0.96] : [0.72, 0.94, 1.0],
          color1: isMag ? [0.86, 0.32, 0.94] : [0.34, 0.68, 1.0],
          kind: 0
        });
        particleClouds.push({
          buffer: physics.magnetosphereSession.getResidentParcelsBuffer(),
          count: physics.magnetosphereSession.particleCount,
          mode: 7,
          worldScale: stScale * 1.12,
          pointSize: Math.max(0.05, Math.min(0.15, 0.088 * stScale)),
          alphaGain: 0.25 * wStarCore,
          extra1: [0, 0, 0, 0]
        });
        if (physics.magnetosphereFieldLines?.length >= 14) {
          const rawM = physics.magnetosphereFieldLines;
          const scM = stScale * 1.12;
          for (let i = 0; i < rawM.length; i += 7) {
            lineChunks.push(rawM[i] * scM, rawM[i + 1] * scM, rawM[i + 2] * scM, rawM[i + 3], rawM[i + 4], rawM[i + 5], rawM[i + 6] * wStarCore);
          }
        }
      } else if (physics.stellarMode === 'white-dwarf-tov') {
        // L3 GR TOV DEGENERATE WHITE DWARF: Ultradense glowing diamond-sapphire C/O crystal core + degeneracy shells!
        spheres.push({
          pos: [0, 0, 0],
          radius: 2.15 * stScale,
          color0: [0.86, 0.95, 1.0],
          color1: [0.46, 0.74, 1.0],
          kind: 0
        });
        for (let ring = 0; ring < 3; ring += 1) {
          const rr = (2.75 + ring * 0.95) * stScale;
          let prev = null;
          for (let s = 0; s <= 48; s += 1) {
            const a = (s / 48) * Math.PI * 2;
            const tilt = ring * 0.52;
            const pt = [Math.cos(a) * rr, Math.sin(a) * rr * Math.sin(tilt), Math.sin(a) * rr * Math.cos(tilt)];
            if (prev) {
              lineChunks.push(...prev, 0.42, 0.84, 1.0, (0.34 - ring * 0.08) * wStarCore);
              lineChunks.push(...pt, 0.42, 0.84, 1.0, (0.34 - ring * 0.08) * wStarCore);
            }
            prev = pt;
          }
        }
      } else if (physics.stellarEngine) {
        particleClouds.push({
          buffer: physics.stellarEngine.getResidentBuffer(),
          count: physics.stellarEngine.count,
          mode: 2,
          worldScale: stScale * 0.95,
          pointSize: Math.max(0.045, Math.min(0.20, 0.125 * stScale)),
          alphaGain: 0.30 * wStarCore,
          extra1: [0, 0, 0, 0]
        });
        // 100% EMERGENT 3D GPU Stellar Convective Dynamo magnetic streamlines traced through live GPU B(x,y,z)!
        // (Zero hardcoded analytic dipole loops; B₀ = 0 produces 0 streamlines!)
        if (showOrbits && physics.stellarDynamoStreamlines?.length >= 14) {
          const rawS = physics.stellarDynamoStreamlines;
          const scS = stScale * 0.95;
          for (let i = 0; i < rawS.length; i += 7) {
            lineChunks.push(
              rawS[i] * scS,
              rawS[i + 1] * scS,
              rawS[i + 2] * scS,
              rawS[i + 3], rawS[i + 4], rawS[i + 5], rawS[i + 6] * wStarCore
            );
          }
        }
      }
    }

    // 5. L5: Zero-Copy Crystal & Fluid Molecular Dynamics (-5.4 -> -9.6, anchor -8.2)
    const wMd = bandWeight(span, -9.6, -8.9, -6.2, -5.2);
    if (wMd > 0.01 && physics.mdSession) {
      const box = physics.mdSession.boxLengthsA;
      const maxDim = Math.max(box[0], box[1], box[2], 6.0);
      const baseScale = 8.4 / maxDim;
      const mdZoomFactor = Math.pow(10, Math.max(-1.2, Math.min(1.4, -8.2 - span)));
      const worldScale = baseScale * mdZoomFactor;
      const b = physics.getCachedElementBundle(physics.mdElementZ, true)?.bundle;
      const rgb = b?.electromagnetic?.opticalSrgb || [0.76, 0.80, 0.86];
      mdCloud = {
        positionsBuffer: physics.mdSession.positionsBuffer,
        velocitiesBuffer: physics.mdSession.velocitiesBuffer,
        count: physics.mdSession.atomCount,
        halfBox: [box[0] * 0.5, box[1] * 0.5, box[2] * 0.5],
        worldScale,
        radius: Math.max(0.045, Math.min(1.3, (physics.mdSession.rNearestNeighborA || 2.5) * 0.285 * worldScale)),
        baseRgb: rgb,
        alphaFade: wMd,
        idealCoord: physics.mdSession.idealCoordination || 12
      };
      if (showOrbits && wMd > 0.3) {
        lineChunks.push(...buildBoxWireframeLines(
          [box[0] * 0.5 * worldScale, box[1] * 0.5 * worldScale, box[2] * 0.5 * worldScale],
          [0.32, 0.80, 1.0, 0.28 * wMd]
        ));
      }
    }

    // 6. L6: Relativistic 4-Component Dirac-KS Quantum Atom (-8.9 -> -13.2, anchor -10.0)
    const wAtom = bandWeight(span, -13.2, -12.0, -9.4, -8.8);
    if (wAtom > 0.01 && physics.orbitalCloud) {
      const b = physics.getCachedElementBundle(physics.quantumZ, physics.quantumRelativistic)?.bundle;
      const rgb = b?.electromagnetic?.opticalSrgb || [0.22, 0.86, 1.0];
      const atomZoom = Math.pow(10, Math.max(-1.1, Math.min(1.8, -10.0 - span)));
      particleClouds.push({
        buffer: physics.orbitalCloud.pointsBuffer,
        count: physics.orbitalCloud.pointCount,
        mode: 3,
        worldScale: 5.4 * atomZoom,
        pointSize: Math.max(0.025, Math.min(0.14, 0.044 * Math.sqrt(atomZoom))),
        alphaGain: 0.074 * wAtom,
        colorPos: physics.quantumMode === 'atom' ? [0.18, 0.86, 1.0] : [0.26, 0.92, 0.86],
        colorNeg: physics.quantumMode === 'atom' ? [Math.max(0.68, rgb[0]), Math.max(0.48, rgb[1]), Math.min(0.45, rgb[2])] : [1.0, 0.42, 0.62]
      });
      if (physics.quantumMode === 'molecule') {
        const spec = physics.MOLECULE_SPECS[physics.quantumMoleculeKey];
        const scale = (3.8 / 4.2) * atomZoom;
        for (const a of spec.atoms) {
          spheres.push({
            pos: [a.position[0] * scale, a.position[1] * scale, a.position[2] * scale],
            radius: (a.Z === 1 ? 0.22 : 0.36) * atomZoom,
            color0: a.Z === 8 ? [0.95, 0.28, 0.28] : (a.Z === 6 ? [0.45, 0.52, 0.60] : [0.92, 0.96, 1.0]),
            color1: [0.6, 0.8, 1.0],
            kind: 5
          });
        }
      } else if (span > -12.6) {
        spheres.push({
          pos: [0, 0, 0],
          radius: Math.max(0.05, 0.10 * atomZoom),
          color0: [1.0, 0.72, 0.32],
          color1: [1.0, 0.94, 0.72],
          kind: 0
        });
      }
    }

    // 7. L7: Quantized Protons + Neutrons inside Translucent Woods-Saxon Well & Live Visscher TDSE (-12.5 -> -15.2)
    const wNuc = bandWeight(span, -15.5, -14.8, -13.3, -12.4);
    if (wNuc > 0.01 && physics.nuclearResult) {
      const nucZoom = Math.pow(10, Math.max(-1.2, Math.min(0.9, -14.3 - span)));
      const nucleons = physics.buildQuantizedNucleonSpheres(physics.nuclearResult, 2.2 * nucZoom, nowSec);
      lastNucleonSpheres = nucleons;
      spheres.push(...nucleons);
      const td = physics.tdseTelemetry;
      let peakIdx = 20;
      let peakVal = -1;
      if (td?.prob?.length) {
        for (let i = 0; i < td.prob.length; i += 1) {
          if (td.prob[i] > peakVal) { peakVal = td.prob[i]; peakIdx = i; }
        }
      }
      nuclearVol = {
        dim: physics.nuclearResult.volDim || 28,
        boxRadius: 3.8 * nucZoom,
        tdseTunneled: td?.pTunneled || 0,
        tdseCrestNorm: Math.max(0.45, Math.min(0.94, peakIdx / Math.max(1, (td?.prob?.length || 128) - 1))),
        alphaMul: wNuc
      };
    }

    // 8. 3D WebGPU Golden Diamond Selection Beacon around the currently clicked & tracked GPU mote!
    if (pickedGpuMote && pickedGpuMote.worldPos && pickedGpuMote.level === currentLevel) {
      const tp = pickedGpuMote.worldPos;
      const distCam = Math.max(0.4, Math.hypot(camera.pos[0] - tp[0], camera.pos[1] - tp[1], camera.pos[2] - tp[2]));
      const sz = Math.max(0.14, Math.min(2.2, distCam * 0.032));
      const cR = 1.0; const cG = 0.84; const cB = 0.30; const cA = 0.96;
      // 3D Octahedron diamond frame (12 edges) + cardinal crosshair ticks (6 segments)
      const vPx = [tp[0] + sz, tp[1], tp[2]];
      const vNx = [tp[0] - sz, tp[1], tp[2]];
      const vPy = [tp[0], tp[1] + sz, tp[2]];
      const vNy = [tp[0], tp[1] - sz, tp[2]];
      const vPz = [tp[0], tp[1], tp[2] + sz];
      const vNz = [tp[0], tp[1], tp[2] - sz];
      const pushEdge = (a, b, r = cR, g = cG, bl = cB, al = cA) => {
        lineChunks.push(a[0], a[1], a[2], r, g, bl, al, b[0], b[1], b[2], r, g, bl, al);
      };
      pushEdge(vPy, vPx); pushEdge(vPy, vNx); pushEdge(vPy, vPz); pushEdge(vPy, vNz);
      pushEdge(vNy, vPx); pushEdge(vNy, vNx); pushEdge(vNy, vPz); pushEdge(vNy, vNz);
      pushEdge(vPx, vPz); pushEdge(vPz, vNx); pushEdge(vNx, vNz); pushEdge(vNz, vPx);
      const szOut = sz * 1.65;
      pushEdge([tp[0] + sz * 1.15, tp[1], tp[2]], [tp[0] + szOut, tp[1], tp[2]], 0.45, 0.92, 1.0, 0.88);
      pushEdge([tp[0] - sz * 1.15, tp[1], tp[2]], [tp[0] - szOut, tp[1], tp[2]], 0.45, 0.92, 1.0, 0.88);
      pushEdge([tp[0], tp[1] + sz * 1.15, tp[2]], [tp[0], tp[1] + szOut, tp[2]], 0.45, 0.92, 1.0, 0.88);
      pushEdge([tp[0], tp[1] - sz * 1.15, tp[2]], [tp[0], tp[1] - szOut, tp[2]], 0.45, 0.92, 1.0, 0.88);
    }

    return {
      camera,
      particleClouds,
      spheres: spheres.length ? spheres : null,
      atmoEm,
      lightDir,
      mdCloud,
      disks: disks.length ? disks : null,
      lines: lineChunks.length >= 14 ? new Float32Array(lineChunks) : null,
      nuclearVol,
      post
    };
  }

  // ---- Main Render & Continuous-Zoom Loop ----
  let lastFrameMs = performance.now();
  let lastStaticRenderMs = 0;
  let hudTickAccum = 0;
  let fpsAccum = 0;
  let fpsFrames = 0;
  let fpsDisplay = 60;

  function renderNow(nowMs = performance.now()) {
    syncCanvasSize();
    const aspect = canvas.width / Math.max(1, canvas.height);

    // Planetary Surface View (TinyPlanetControls + Jump-Rocket Rover + Atmospheric Drone!)
    if (physics.surfaceActive && physics.surfaceSession) {
      const s = physics.surfaceSession;
      const pose = s.getCameraPose();
      const fovRad = (58 * Math.PI) / 180;
      const proj = mat4PerspectiveWebGpu(fovRad, aspect, 0.15, 420.0);
      const look = mat4LookAt(pose.eye, pose.target, pose.up);
      const viewProj = mat4Mul(proj, look.mat);
      lastViewProj = viewProj;

      const camera = {
        viewProj,
        pos: pose.eye,
        right: look.right,
        up: look.up,
        fwd: look.fwd,
        aspect,
        fovTanHalf: Math.tan(fovRad * 0.5),
        timeSec: nowMs * 0.001,
        level: 4,
        log10SpanM: 2.0
      };
      const surfLightDir = s.env.isRogue
        ? vec3Norm([0.15, 0.96, 0.22])
        : (s.env.isMagmaOcean ? vec3Norm([0.70, 0.28, 0.65]) : vec3Norm([0.58, 0.44, 0.68]));

      const skyEnv = s.getActiveSkyEnv ? s.getActiveSkyEnv() : s.env;
      const surfaceClouds = [{
        buffer: s.getResidentPlumesBuffer(),
        count: s.particleCount,
        mode: 11,
        worldScale: 1.0,
        pointSize: 0.72,
        alphaGain: 0.92,
        extra1: [pose.focusPos[0], 0, pose.focusPos[2], s.env.hasSolidCrust ? (1.0 / (2.0 * s.env.tinyPlanetCurvatureRadiusM)) : 0.0]
      }];
      const cfdMotesBuf = s.getResidentCfdMotesBuffer?.();
      if (cfdMotesBuf && s.cfdMoteCount > 0 && (s.activeVehicle === 'ufo' || !s.env.hasSolidCrust)) {
        surfaceClouds.push({
          buffer: cfdMotesBuf,
          count: s.cfdMoteCount,
          mode: 11,
          worldScale: 1.0,
          pointSize: 1.15,
          alphaGain: 1.0,
          extra1: [pose.focusPos[0], 0, pose.focusPos[2], 0.0]
        });
      }

      renderer.renderFrame({
        camera,
        lightDir: surfLightDir,
        surfaceScene: {
          terrainVertBuf: s.getResidentTerrainVertBuffer(),
          terrainIdxBuf: s.getResidentTerrainIndexBuffer(),
          indexCount: s.indexCount,
          hideTerrain: !s.env.hasSolidCrust,
          vehicleVertBuf: s.getResidentVehicleVertBuffer(),
          vehicleVertCount: s.vehicleVertCount,
          env: skyEnv,
          lightDir: surfLightDir
        },
        particleClouds: surfaceClouds,
        post: {
          bhUv: [0.5, 0.5],
          bhStrength: 0,
          warpAmount: 0,
          flashAmount: bigBangFlash,
          crtEnabled: retroCrt,
          pixelSize,
          timeSec: nowMs * 0.001
        }
      });
      if (reticleCtx) reticleCtx.clearRect(0, 0, lastCssW, lastCssH);
      return;
    }

    if (moteFocusLocked && pickedGpuMote && pickedGpuMote.level === currentLevel && pickedGpuMote.worldPos) {
      camTarget = [
        camTarget[0] + (pickedGpuMote.worldPos[0] - camTarget[0]) * 0.25,
        camTarget[1] + (pickedGpuMote.worldPos[1] - camTarget[1]) * 0.25,
        camTarget[2] + (pickedGpuMote.worldPos[2] - camTarget[2]) * 0.25
      ];
    } else {
      camTarget = [camTarget[0] * 0.82, camTarget[1] * 0.82, camTarget[2] * 0.82];
    }
    const cp = Math.cos(camState.pitch);
    const sp = Math.sin(camState.pitch);
    const cy = Math.cos(camState.yaw);
    const sy = Math.sin(camState.yaw);
    const eye = [
      camTarget[0] + camState.dist * cp * sy,
      camTarget[1] + camState.dist * sp,
      camTarget[2] + camState.dist * cp * cy
    ];
    const fovRad = (48 * Math.PI) / 180;
    const proj = mat4PerspectiveWebGpu(fovRad, aspect, 0.05, 260.0);
    const look = mat4LookAt(eye, camTarget, [0, 1, 0]);
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
      level: currentLevel,
      log10SpanM: log10ViewSpanM
    };

    const scenePayload = buildContinuousScenePayload(camera, nowMs * 0.001);
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

    if (cameraAutoSpin && !pointerDown) camState.yaw += dtSec * 0.22;
    if (bigBangFlash > 0) bigBangFlash = Math.max(0, bigBangFlash - dtSec * 1.45);
    zoomVelocityLog10PerSec = Math.max(0, zoomVelocityLog10PerSec - dtSec * 12.0);

    // Smooth continuous fly-to flight
    if (flyTargetLog10 !== null) {
      const diff = flyTargetLog10 - log10ViewSpanM;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), Math.max(1.2, Math.abs(diff) * 3.4) * dtSec);
      log10ViewSpanM += step;
      zoomVelocityLog10PerSec = Math.abs(step) / Math.max(0.001, dtSec);
      if (Math.abs(flyTargetLog10 - log10ViewSpanM) < 0.015) {
        log10ViewSpanM = flyTargetLog10;
        flyTargetLog10 = null;
      }
      void warmVisibleLevels(log10ViewSpanM);
    }

    // Continuous hands-free Autopilot 40-OOM glide!
    if (autopilot && flyTargetLog10 === null) {
      log10ViewSpanM -= dtSec * 1.15;
      if (log10ViewSpanM <= LOG10_SPAN_MIN + 0.05) {
        log10ViewSpanM = LOG10_SPAN_MAX - 0.3;
      }
      void warmVisibleLevels(log10ViewSpanM);
    }

    // Update primary level cleanly as `log10ViewSpanM` crosses scale thresholds
    const nextLvl = resolvePrimaryLevelFromSpan(log10ViewSpanM, {
      focusedSolarBodyIndex: physics.focusedSolarBodyIndex,
      galaxyBranch: physics.galaxyBranch
    });
    if (nextLvl !== currentLevel) {
      const prevLvl = currentLevel;
      currentLevel = nextLvl;
      pickedGpuMote = null;
      moteFocusLocked = false;
      camTarget = [0, 0, 0];
      camState.dist = 18.0;
      if (currentLevel === 4 && prevLvl !== 4 && !pointerDown) {
        orientCameraToSunlitPhase(physics.focusedSolarBodyIndex);
      }
      selectDefaultTarget();
      syncScaleChrome();
      void warmVisibleLevels(log10ViewSpanM);
    }

    if (running) {
      void physics.stepActiveRegimes(currentLevel, log10ViewSpanM, timeScale);
    }

    moteTrackAccum += dtSec;
    if (moteTrackAccum >= 0.10 && pickedGpuMote && pickedGpuMote.level === currentLevel) {
      moteTrackAccum = 0;
      void refreshTrackedPickedMote();
    }

    const isStaticScale = (currentLevel === 6)
      && !pointerDown && !cameraAutoSpin && flyTargetLog10 === null && !autopilot && bigBangFlash <= 0;
    if (!isStaticScale || (nowMs - lastStaticRenderMs) >= 120) {
      lastStaticRenderMs = nowMs;
      renderNow(nowMs);
    }

    hudTickAccum += dtSec;
    if (hudTickAccum >= 0.18) {
      hudTickAccum = 0;
      if (fpsBadge) fpsBadge.textContent = `${fpsDisplay} FPS · WebGPU`;
      if (physics.surfaceActive) syncSurfaceHud();
      updateInspectorCard();
      updatePeerStatusUi();
    }
  }

  // ---- Initial Boot ----
  warpOverlay?.classList.remove('active');
  await warmVisibleLevels(log10ViewSpanM);
  selectDefaultTarget();
  syncScaleChrome();

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
      const sunSpec = REAL_SOLAR_SYSTEM_CATALOG[0];
      const earthSpec = REAL_SOLAR_SYSTEM_CATALOG[3];
      const jupSpec = REAL_SOLAR_SYSTEM_CATALOG[6];
      const c0 = physics.solarConservation0;
      const c1 = physics.solarConservation;
      return {
        ready: true,
        continuousZoom: true,
        level: currentLevel,
        scaleId: sc.id,
        scaleName: sc.name,
        log10ViewSpanM,
        physicalSpanLabel: formatPhysicalSpan(log10ViewSpanM),
        totalSpanOom: Number((LOG10_SPAN_MAX - LOG10_SPAN_MIN).toFixed(1)),
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
        // Live metrics across all 8 real WebGPU engines + 15-node Universal Law Graph
        cosmicEpochId: physics.cosmicEpochId,
        cosmicEpochRedshiftZ: physics.cosmicEpoch?.redshiftZ ?? 0,
        cosmoMode: physics.cosmoMode,
        cosmoBaryonSteps: physics.cosmoBaryonSession?.stepIndex ?? 0,
        cosmoBaryonIonFrac: physics.cosmoBaryonTelemetry?.meanIonizedFraction ?? null,
        cosmoBaryonXray: physics.cosmoBaryonTelemetry?.meanXrayEmissivity ?? null,
        cosmoBaryonKappa: physics.cosmoBaryonTelemetry?.maxLensingKappa ?? null,
        cosmicWebSteps: cosmoSt?.stepIndex ?? 0,
        scaleFactorA: cosmoSt?.aScale ?? null,
        redshiftZ: cosmoSt?.redshiftZ ?? null,
        submitsPerStep: physics.cosmoTelemetry?.submitsPerStep ?? cosmoSt?.submitsPerStep ?? null,
        sigmaDensity: physics.cosmoTelemetry?.sigmaDensity ?? null,
        powerSpectrumPk: physics.cosmoTelemetry?.powerSpectrumPk ?? null,
        galacticSteps: physics.galaxyEngine?.stepIndex ?? 0,
        galaxyPreset: physics.galaxyPreset,
        galacticBodyCount: physics.galaxyEngine?.count ?? 0,
        galacticGravityMode: physics.galaxyEngine?.gravityMode ?? null,
        galacticDynamoMagEnergy: physics.galacticDynamoTelemetry?.magneticEnergy ?? null,
        galacticDynamoStreamlineFloats: physics.galacticDynamoStreamlines?.length ?? 0,
        galacticB0: physics.galacticB0,
        galaxyBranch: physics.galaxyBranch,
        planetarySteps: physics.solarEngine?.stepIndex ?? 0,
        solarSimTimeYr: physics.solarEngine?.simTimeYr ?? 0,
        solarTotalBodies: physics.solarEngine?.totalCount ?? 0,
        focusedSolarBody: physics.getActiveSystemCatalog()[physics.focusedSolarBodyIndex]?.id ?? 'star-0',
        useSolReference: physics.useSolReference,
        causalSystemName: physics.useSolReference ? 'Sol Reference' : (physics.activeCausalSystem?.systemName ?? null),
        causalArchitecture: physics.useSolReference ? 'single' : (physics.activeCausalSystem?.architecture ?? 'single'),
        causalStarCount: physics.useSolReference ? 1 : (physics.activeCausalSystem?.starCount ?? 1),
        causalPlanetCount: physics.useSolReference ? 8 : (physics.activeCausalSystem?.planetCount ?? 0),
        causalHasEarthLike: physics.useSolReference ? true : Boolean(physics.activeCausalSystem?.hasEarthLike),
        causalFeH: physics.useSolReference ? 0.0 : (physics.activeCausalSystem?.starSystem?.nebulaEnv?.feH ?? 0),
        causalCToO: physics.useSolReference ? 0.55 : (physics.activeCausalSystem?.starSystem?.nebulaEnv?.cToO ?? 0.55),
        earthToSunRadiusRatio: earthSpec.radiusKm / sunSpec.radiusKm,
        jupiterToSunRadiusRatio: jupSpec.radiusKm / sunSpec.radiusKm,
        solarRelEnergyDrift: c0 && c1 ? Math.abs(c1.totalEnergy - c0.totalEnergy) / Math.max(1e-12, Math.abs(c0.totalEnergy)) : null,
        solarRelMomentumError: c1?.relMomentumError ?? null,
        stellarSteps: physics.stellarEngine?.stepIndex ?? 0,
        stellarMode: physics.stellarMode,
        stellarPreset: physics.stellarPreset,
        stellarCoreTempK: physics.stellarTelemetry?.coreTempK ?? null,
        stellarDynamoMagEnergy: physics.stellarDynamoTelemetry?.magneticEnergy ?? null,
        stellarDynamoStreamlineFloats: physics.stellarDynamoStreamlines?.length ?? 0,
        stellarB0: physics.stellarB0,
        magnetosphereStreamlineFloats: physics.magnetosphereFieldLines?.length ?? 0,
        pickedGpuMote: pickedGpuMote ? { kind: pickedGpuMote.kind, index: pickedGpuMote.index, name: pickedGpuMote.name, subtitle: pickedGpuMote.subtitle } : null,
        moteFocusLocked,
        nebulaMhdSteps: physics.nebulaMhdSession?.stepIndex ?? 0,
        nebulaMhdMagneticEnergy: physics.nebulaMhdTelemetry?.magneticEnergy ?? null,
        nebulaMhdPeakToroidalB: physics.nebulaMhdTelemetry?.peakToroidalB ?? null,
        solarMode: physics.solarMode,
        kerrSpinA: physics.kerrSpinA,
        kerrMaxGamma: physics.kerrJetTelemetry?.maxLorentzGamma ?? null,
        kerrActiveJets: physics.kerrJetTelemetry?.activeJetParcels ?? 0,
        relBinaryMerged: physics.relBinaryTelemetry?.merged ?? false,
        relBinaryRemnant: physics.relBinaryTelemetry?.remnantType ?? null,
        relBinaryGwStrain: physics.relBinaryTelemetry?.gwStrainPlus ?? null,
        magnetarFlares: physics.magnetosphereTelemetry?.flareCount ?? 0,
        magnetarBeamFlux: physics.magnetosphereTelemetry?.beamFluxProxy ?? 0,
        tovCount: physics.tovCurve?.length ?? 0,
        tidalRupturedFrac: physics.tidalRocheTelemetry?.rupturedFraction ?? null,
        protoplanetarySteps: physics.protoplanetarySession?.stepIndex ?? 0,
        protoplanetaryAccreted: physics.protoplanetaryTelemetry?.accretedPebbles ?? null,
        planetaryMode: physics.planetaryMode,
        planetaryInteriorValid: Boolean(physics.planetaryResult?.valid),
        planetaryMoiFactor: physics.planetaryResult?.moiFactor ?? null,
        planetaryCutaway: physics.planetaryCutaway,
        planetaryAtmoActive: Boolean(physics.planetaryAtmoSession),
        planetaryAtmoSteps: physics.planetaryAtmoSession?.stepIndex ?? 0,
        planetaryLightningCells: physics.planetaryAtmoTelemetry?.activeLightningCells ?? 0,
        planetaryPeakElectricVPerM: physics.planetaryAtmoTelemetry?.peakElectricFieldVPerM ?? 0,
        surfaceActive: physics.surfaceActive,
        surfaceVehicle: physics.surfaceSession?.activeVehicle ?? null,
        surfaceCameraMode: physics.surfaceSession?.cameraMode ?? null,
        surfaceGravityMS2: physics.surfaceSession?.env?.gravityMS2 ?? null,
        surfaceAtmoDensityKgM3: physics.surfaceSession?.env?.rhoAtmKgM3 ?? null,
        surfaceDroneFlightCapable: physics.surfaceSession?.env?.droneFlightCapable ?? null,
        surfaceDroneMaxAeroLiftN: physics.surfaceSession?.env?.maxAeroLiftN ?? null,
        surfaceTelemetry: physics.surfaceTelemetry ?? null,
        activeUniversalLaws: physics.getActiveUniversalLaws(currentLevel, log10ViewSpanM).active.map((l) => l.id),
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
    async setLog10Span(val) {
      flyTargetLog10 = null;
      log10ViewSpanM = mapLog10ScaleToInitialSpan(val);
      currentLevel = resolvePrimaryLevelFromSpan(log10ViewSpanM, {
        focusedSolarBodyIndex: physics.focusedSolarBodyIndex,
        galaxyBranch: physics.galaxyBranch
      });
      await warmVisibleLevels(log10ViewSpanM);
      selectDefaultTarget();
      syncScaleChrome();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    flyToLog10Span,
    async setLevel(lvl, { instant = true } = {}) {
      const idx = Math.max(0, Math.min(7, Math.trunc(Number(lvl) || 0)));
      const cat = physics.getActiveSystemCatalog();
      if (idx === 3) physics.setFocusedSolarBody(0);
      else if (idx === 4 && (cat[physics.focusedSolarBodyIndex]?.isStar || physics.focusedSolarBodyIndex === 0)) {
        physics.setFocusedSolarBody(physics.getDefaultPlanetIndex(cat));
      }
      if (instant) {
        const res = await this.setLog10Span(UNIVERSES_SCALES[idx].log10SpanM);
        if (idx === 4) {
          orientCameraToSunlitPhase(physics.focusedSolarBodyIndex);
          renderNow(performance.now());
        }
        return res;
      }
      flyToLog10Span(UNIVERSES_SCALES[idx].log10SpanM);
      return this.getState();
    },
    async sampleNewGalacticSector(opts = {}) {
      await physics.sampleNewGalacticSector(opts);
      selectDefaultTarget();
      syncScaleChrome();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async selectCausalStarSite(opts = {}) {
      await physics.selectCausalStarSite(opts);
      selectDefaultTarget();
      syncScaleChrome();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async setUseSolReference(enabled) {
      await physics.setUseSolReference(enabled);
      selectDefaultTarget();
      syncScaleChrome();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async focusSolarBody(idxOrId) {
      const wasSol = physics.useSolReference;
      const idx = physics.setFocusedSolarBody(idxOrId);
      if (physics.useSolReference !== wasSol) {
        await physics.initSolarSystem({ solReference: physics.useSolReference });
        physics.setFocusedSolarBody(idxOrId);
      }
      const cat = physics.getActiveSystemCatalog();
      const safeIdx = Math.max(0, Math.min(cat.length - 1, physics.focusedSolarBodyIndex));
      if (!cat[safeIdx]?.isStar && safeIdx > 0) await physics.initPlanetaryInterior({ bodyIndex: safeIdx });
      if (currentLevel === 4 && !cat[safeIdx]?.isStar && safeIdx > 0) {
        log10ViewSpanM = idealPlanetaryFramingLog10Span(cat[safeIdx]);
        orientCameraToSunlitPhase(safeIdx);
      }
      selectDefaultTarget();
      syncScaleChrome();
      renderNow(performance.now());
      return this.getState();
    },
    async setCosmicEpoch(presetIdOrObj, opts = {}) {
      await physics.setCosmicEpoch(presetIdOrObj, opts);
      syncEpochChrome();
      selectDefaultTarget();
      renderScaleControls();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async setCosmoMode(mode) {
      await physics.setCosmoMode(mode);
      selectDefaultTarget();
      renderScaleControls();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async setGalaxyPreset(preset) {
      await physics.initGalaxy({ preset });
      selectDefaultTarget();
      renderScaleControls();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async setSolarMode(mode) {
      await physics.setSolarMode(mode);
      selectDefaultTarget();
      renderScaleControls();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async setKerrSpinA(val) {
      await physics.setKerrSpinA(val);
      renderScaleControls();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async setStellarMode(mode) {
      await physics.setStellarMode(mode);
      selectDefaultTarget();
      renderScaleControls();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async setPlanetaryMode(mode) {
      await physics.setPlanetaryMode(mode);
      if (mode === 'cryo-plumes' && currentLevel === 4) {
        log10ViewSpanM = Math.max(log10ViewSpanM, 7.56);
        orientCameraToSunlitPhase(physics.focusedSolarBodyIndex);
        camState.pitch = -0.18;
      }
      selectDefaultTarget();
      renderScaleControls();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    setCameraAngles(yaw, pitch) {
      if (Number.isFinite(Number(yaw))) camState.yaw = Number(yaw);
      if (Number.isFinite(Number(pitch))) camState.pitch = Math.max(-1.42, Math.min(1.42, Number(pitch)));
      renderNow(performance.now());
      return this.getState();
    },
    async setNebulaB0(val) {
      await physics.setNebulaB0(val);
      renderScaleControls();
      renderNow(performance.now());
      return this.getState();
    },
    async setGalacticB0(val) {
      await physics.setGalacticB0(val);
      renderScaleControls();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async setStellarB0(val) {
      await physics.setStellarB0(val);
      renderScaleControls();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async setStellarPreset(preset) {
      await physics.initStellarCore({ preset });
      pickedGpuMote = null;
      moteFocusLocked = false;
      renderScaleControls();
      updateInspectorCard();
      renderNow(performance.now());
      return this.getState();
    },
    async pickAtCanvasFraction(fx = 0.5, fy = 0.5, { preferGpuMote = true } = {}) {
      renderNow(performance.now());
      return pickAnyEntityAt(fx * lastCssW, fy * lastCssH, { preferGpuMote });
    },
    focusPickedMote(opts = { zoomIn: true }) {
      return focusPickedMote(opts);
    },
    getPickedMote() {
      return pickedGpuMote;
    },
    async readGalaxyDiagnostics() {
      if (!physics.galaxyEngine) return null;
      const b = await physics.galaxyEngine.readbackBodies();
      const n = Math.floor(b.length / 8);
      let visCount = 0; let sumR = 0; let sumZ2 = 0; let maxR = 0; let escaped = 0;
      for (let i = 1; i < n; i += 1) {
        const o = i * 8;
        if (b[o + 7] < -0.5) continue;
        const r = Math.hypot(b[o], b[o + 2]);
        const z = b[o + 1];
        visCount += 1;
        sumR += r;
        sumZ2 += z * z;
        if (r > maxR) maxR = r;
        if (r > 18.0 || Math.abs(z) > 10.0) escaped += 1;
      }
      return {
        stepIndex: physics.galaxyEngine.stepIndex,
        visibleStars: visCount,
        meanRadius: sumR / Math.max(1, visCount),
        rmsHeightZ: Math.sqrt(sumZ2 / Math.max(1, visCount)),
        maxRadius: maxR,
        escapedFrac: escaped / Math.max(1, visCount)
      };
    },
    async readStellarDiagnostics() {
      if (!physics.stellarEngine) return null;
      const b = await physics.stellarEngine.readbackBodies();
      const n = Math.floor(b.length / 16);
      let sumR = 0; let sumV2 = 0; let maxSpd = 0; let boundCount = 0;
      for (let i = 0; i < n; i += 1) {
        const o = i * 16;
        const r = Math.hypot(b[o], b[o + 1], b[o + 2]);
        const spd = Math.hypot(b[o + 4], b[o + 5], b[o + 6]);
        sumR += r;
        sumV2 += spd * spd;
        if (spd > maxSpd) maxSpd = spd;
        if (r < 6.5) boundCount += 1;
      }
      return {
        stepIndex: physics.stellarEngine.stepIndex,
        count: n,
        meanRadius: sumR / Math.max(1, n),
        rmsSpeed: Math.sqrt(sumV2 / Math.max(1, n)),
        maxSpeed: maxSpd,
        boundFrac: boundCount / Math.max(1, n),
        coreTempK: physics.stellarTelemetry?.coreTempK ?? null
      };
    },
    setPlanetaryTriboelectric(enabled) {
      physics.setPlanetaryTriboelectric(enabled);
      renderScaleControls();
      return this.getState();
    },
    getActiveUniversalLaws() {
      return physics.getActiveUniversalLaws(currentLevel, log10ViewSpanM);
    },
    async setGalaxyBranch(branch) {
      physics.setGalaxyBranch(branch, branch === 'smbh-core' ? [0, 0, 0] : [4.8, 0.04, 2.1]);
      await warmVisibleLevels(log10ViewSpanM);
      syncScaleChrome();
      return this.getState();
    },
    setPlanetaryCutaway(enabled) {
      physics.setPlanetaryCutaway(enabled);
      renderNow(performance.now());
    },
    async enterSurfaceView(opts = {}) {
      await enterSurfaceViewUi(opts);
      return this.getState();
    },
    exitSurfaceView() {
      exitSurfaceViewUi();
      return this.getState();
    },
    setSurfaceVehicle(mode) {
      physics.setSurfaceVehicle(mode);
      syncSurfaceHud();
      renderNow(performance.now());
      return this.getState();
    },
    setSurfaceUfoAltitudeKm(altKm) {
      physics.setSurfaceUfoAltitudeKm(altKm);
      syncSurfaceHud();
      renderNow(performance.now());
      return this.getState();
    },
    setSurfaceCameraMode(mode) {
      physics.setSurfaceCameraMode(mode);
      syncSurfaceHud();
      renderNow(performance.now());
      return this.getState();
    },
    setSurfaceControls(partial = {}) {
      physics.setSurfaceControls(partial);
      syncSurfaceHud();
      return this.getState();
    },
    addSurfaceLookDelta(dYaw, dPitch) {
      physics.addSurfaceLookDelta(dYaw, dPitch);
      renderNow(performance.now());
      return this.getState();
    },
    async setMdPhase(phasePreset) {
      await physics.initMolecularDynamics({ Z: physics.mdElementZ, phasePreset });
      renderScaleControls();
      return this.getState();
    },
    selectTarget(id) {
      const targets = physics.getTargetsForLevel(currentLevel, lastWorldScaleInfo);
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
      return this.setLog10Span(UNIVERSES_SCALES[0].log10SpanM);
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
      await physics.stepActiveRegimes(currentLevel, log10ViewSpanM, timeScale);
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
      window.removeEventListener('keydown', handleSurfaceKeyDown);
      window.removeEventListener('keyup', handleSurfaceKeyUp);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
      entityPicker.dispose();
      physics.dispose();
      renderer.dispose();
    }
  });
}
