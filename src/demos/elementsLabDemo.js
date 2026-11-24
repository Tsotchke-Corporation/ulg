// Flagship Interactive First-Principles Material Physics Lab (`src/demos/elementsLabDemo.js`).
//
// 100% WebGPU live simulations plugged directly into ULG's canonical runtime
// engines (`periodicTableEngineWebGpu`, `recursiveCompoundPipeline`,
// `orbitalPointCloudWebGpu`, `photonShellOpticsWebGpu`, `molecularDynamicsWebGpu`,
// `polytopeAtlasBuilder`, `molecularHartreeFockWebGpu`, `ClosureRegistry`, and
// `defaultSimulationModuleRegistry`) — ZERO fake animations, ZERO per-element
// cheats, ZERO per-frame CPU MD position readbacks, fixed camera by default!

import {
  ELEMENT_SYMBOLS,
  electronConfiguration,
  symbolForZ
} from '../runtime/electronicStructure/periodicTable.js';
import {
  mostStableMassNumberForZ,
  deriveNuclearClosure,
  bohrWheelerFissionCurve,
  buildFissionDeformationVolumeWebGpu,
  registerNuclearFissionSimulationModule
} from '../runtime/nuclear/nuclearStructureGpu.js';
import {
  deriveNuclearDecayChain,
  stepIsotopeInventoryLedger
} from '../runtime/material/nuclearCherenkovClosure.js';
import { deriveElementBundleWebGpu } from '../runtime/material/periodicTableEngineWebGpu.js';
import { solveAtomFullWebGpu } from '../runtime/electronicStructure/radialKohnShamWebGpu.js';
import {
  deriveCompoundBundleWebGpu,
  discoverAndDeriveReactionProductsWebGpu
} from '../runtime/material/recursiveCompoundPipeline.js';
import {
  buildMaterialPolytopeAtlasWebGpu,
  evaluateBundleDensityEos
} from '../runtime/material/polytopeAtlasBuilder.js';
import {
  climbingImageNEBWebGpu,
  solveMoleculeRhfWebGpu
} from '../runtime/electronicStructure/molecularHartreeFockWebGpu.js';
import {
  computeStarkPolarizationState,
  createQuantumBlochPhotonSession,
  registerOrbitalCloudSimulationModule,
  sampleAtomicOrbitalCloudWebGpu,
  sampleDipoleCoupledOrbitalPairWebGpu,
  sampleMolecularOrbitalCloudWebGpu,
  solveDeltaScfIonizationWebGpu
} from '../runtime/electronicStructure/orbitalPointCloudWebGpu.js';
import {
  createNuclearTunnelingTdseWebGpu,
  createPhotonShellOpticsSessionWebGpu,
  registerPhotonShellOpticsClosureArtifact,
  registerPhotonShellSimulationModules
} from '../runtime/material/photonShellOpticsWebGpu.js';
import {
  createSpinLatticeSessionWebGpu,
  registerSpinLatticeClosureArtifact,
  registerSpinLatticeSimulationModule
} from '../runtime/material/spinLatticeMagnetismWebGpu.js';
import {
  createElectronTransportSessionWebGpu,
  registerElectronTransportClosureArtifact,
  registerElectronTransportSimulationModule
} from '../runtime/material/electronTransportWebGpu.js';
import {
  MD_EXPERIMENT_MODES,
  buildCrystalMdState,
  computePhononVdosFromVacf,
  createMolecularDynamicsSessionWebGpu,
  registerMdSimulationModules
} from '../runtime/gpuMath/molecularDynamicsWebGpu.js';
import { ClosureRegistry } from '../runtime/ClosureRegistry.js';
import { defaultSimulationModuleRegistry } from '../runtime/simulationModuleRegistry.js';
import { createElementsLabWebGpuRenderer } from './elementsLabWebGpuRenderer.js';

// Register ALL reusable canonical ULG simulation modules on boot (shared with Studio & Triad!)
try {
  registerOrbitalCloudSimulationModule(defaultSimulationModuleRegistry);
  registerPhotonShellSimulationModules(defaultSimulationModuleRegistry);
  registerSpinLatticeSimulationModule(defaultSimulationModuleRegistry);
  registerElectronTransportSimulationModule(defaultSimulationModuleRegistry);
  registerMdSimulationModules(defaultSimulationModuleRegistry);
  registerNuclearFissionSimulationModule(defaultSimulationModuleRegistry);
} catch {
  // Already registered in hot-reload session
}

// Local content-addressed ClosureRegistry exercising ULG's canonical closure governance
const labClosureStore = new Map();
let labClosureSeq = 0;
const labClosureRegistry = new ClosureRegistry({
  artifactCache: {
    async put(artifact) {
      labClosureSeq += 1;
      const uri = `ulg-lab://closure/${artifact.closureId || 'item'}#${labClosureSeq}`;
      labClosureStore.set(uri, artifact);
      return { uri, hash: artifact.inputHash || String(labClosureSeq) };
    },
    async get(ref) {
      return labClosureStore.get(ref?.uri) || null;
    }
  }
});

// DOM references (ALL legacy IDs preserved for test suite compatibility!)
const canvas = document.getElementById('gpu-canvas');
const hudTitle = document.getElementById('gpu-hud-title');
const hudSub = document.getElementById('gpu-hud-sub');
const overlayBottom = document.getElementById('gpu-overlay-bottom');
const simControls = document.getElementById('sim-controls');
const activeSpecimenPill = document.getElementById('active-specimen-pill');
const specimenHistoryEl = document.getElementById('specimen-history');
const plot1 = document.getElementById('plot1');
const plot2 = document.getElementById('plot2');
const plot3 = document.getElementById('plot3');
const ptGrid = document.getElementById('pt-grid');
const zInput = document.getElementById('z-input');
const aInput = document.getElementById('a-input');
const resetABtn = document.getElementById('reset-a-btn');
const solveZBtn = document.getElementById('solve-z-btn');
const reactantAInput = document.getElementById('reactant-a');
const reactantBInput = document.getElementById('reactant-b');
const runReactionBtn = document.getElementById('run-reaction-btn');
const reactionResultsEl = document.getElementById('reaction-results');
const compoundInput = document.getElementById('compound-input');
const solveCompoundBtn = document.getElementById('solve-compound-btn');
const statusBadge = document.getElementById('status-badge');
const bundleReadout = document.getElementById('bundle-readout');
const g7Card = document.getElementById('g7-card');
const plot1Title = document.getElementById('plot1-title');
const plot2Title = document.getElementById('plot2-title');
const plot3Title = document.getElementById('plot3-title');
const mobileDrawerBtn = document.getElementById('mobile-drawer-btn');
const mobileDrawerClose = document.getElementById('mobile-drawer-close');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const resetViewBtn = document.getElementById('canvas-reset-view-btn');
const webgpuFallbackEl = document.getElementById('webgpu-fallback');
const webgpuFallbackTitle = document.getElementById('webgpu-fallback-title');
const webgpuFallbackMsg = document.getElementById('webgpu-fallback-msg');
const webgpuReloadBtn = document.getElementById('webgpu-reload-btn');

const IS_MOBILE_GPU_PROFILE = typeof window !== 'undefined' && (
  window.matchMedia?.('(pointer: coarse)')?.matches
  || window.innerWidth < 900
  || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
);

function isDrawerMode() {
  return typeof window !== 'undefined' && window.innerWidth < 1120;
}

function setMobileDrawerOpen(open) {
  const next = Boolean(open) && isDrawerMode();
  document.body.classList.toggle('drawer-open', next);
  if (drawerBackdrop) drawerBackdrop.setAttribute('aria-hidden', next ? 'false' : 'true');
}

function showWebGpuFallback(title, msg) {
  if (webgpuFallbackTitle && title) webgpuFallbackTitle.textContent = title;
  if (webgpuFallbackMsg && msg) webgpuFallbackMsg.textContent = msg;
  webgpuFallbackEl?.classList.add('visible');
}

function hideWebGpuFallback() {
  webgpuFallbackEl?.classList.remove('visible');
}

let gpuDevice = null;
let gpuRenderer = null;
let currentTab = 'nuclear';

// Specimen state: can be an Element OR a Backfed Compound across ALL 6 tabs!
let activeSpecimenKind = 'element'; // 'element' | 'compound'
let currentElementRes = null;
let currentAtomicVolGpu = null;
let currentCompoundRes = null;
let currentCompoundNuclearVolGpu = null;
let currentCompoundLattice = null;
let currentReactionRes = null;
let currentAtlas = null;
let currentDecayChain = null;
let currentNebBarrier = null;
let currentNebImageClouds = [];
let selectedZ = 26;
let selectedA = null;
const specimenHistory = [];

// Live WebGPU Physics Simulation Sessions
let liveOrbitalCloud = null;      // Atomic OR Molecular GPU point cloud
let liveMolOrbitalCloud = null;   // Molecular RHF GPU point cloud (Total / HOMO / LUMO)
let liveTdksPairCloud = null;     // 180K-point dipole-coupled (phi0, phi1) GPU quantum basis!
let liveBlochSession = null;      // Real-time Optical Bloch / TD-KS quantum dipole integrator!
let livePhotonSession = null;     // 2D 128x128 Maxwell-ADE-FDTD Bulk Optical Cavity session
let livePhotonTelemetry = null;
let livePhotonBusy = false;
let liveTdseSession = null;       // 1D Symplectic Quantum Tunneling TDSE session
let liveTdseTelemetry = null;
let liveTdseBusy = false;
let liveMdSession = null;         // Zero-copy WebGPU MD session (Elements AND Compounds!)
let liveMdTelemetry = null;
let liveMdHistory = [];
let liveMdVacfHistory = [];
let liveMdStrainHistory = [];
let liveMdBusy = false;
let liveMdConfigMeta = null;

// New Canonical Material-Property GPU Sessions (Sims 1–5!)
let liveSpinSession = null;       // 3D WebGPU Stochastic LLG Spin-Lattice (Magnetism)
let liveSpinTelemetry = null;
let liveSpinHistory = [];         // Hysteresis M(B) / M(T) trace
let liveSpinBusy = false;
let liveTransportSession = null;  // 3D WebGPU Drude-Boltzmann & BCS Transport
let liveTransportTelemetry = null;
let liveTransportHistory = [];
let liveTransportBusy = false;
let liveFissionVolGpu = null;     // 3D WebGPU Bohr-Wheeler Fission Saddle/Scission volume
let liveFissionCurve = null;
let liveBatemanSeries = null;
let liveDeltaScfResult = null;    // Live GPU Delta-SCF Cation Ionization result
let liveStarkState = null;        // Live Static E-Field Stark Polarization state

// Interactive simulation controls state
const uiState = {
  // Tab 1: Nuclear TDSE, Fission Saddle & Bateman Decay
  nuclearViewMode: 'tdse',        // 'tdse' | 'fission' | 'bateman'
  tdsePlaying: true,
  fissionBeta2: 0.0,
  fissionPlaying: false,
  // Tab 2: MoonLab-grade Atomic / Molecular QM + Stark Polarization + Delta-SCF Ionization
  atomicViewMode: 'cloud',        // 'cloud' | 'volume'
  n: 3,
  l: 2,
  m: 0,
  functional: 'pbe',              // 'pbe' | 'lda' | 'bare'
  relativisticSpinOrbit: true,
  starkFieldVPerA: 0.0,
  ionizedCation: false,
  pointCount: IS_MOBILE_GPU_PROFILE ? 90000 : 240000,
  pointSize: IS_MOBILE_GPU_PROFILE ? 0.015 : 0.012,
  opacity: IS_MOBILE_GPU_PROFILE ? 0.30 : 0.24,
  alternateShellColors: true,
  colorMode: 0,                   // 0 = alternating radial shells, 1 = +-psi phase
  shellColorA: '#ffffff',
  shellColorB: '#612bde',
  showGuides: false,
  autoRotate: false,              // Fixed camera by default (cameraAutoSpin: false!)
  cloudSeed: 1,
  molOrbitalMode: 0,              // 0 = Total rho, 1 = HOMO, 2 = LUMO
  // Tab 3: Optics (2D Maxwell Crystal Slab & Single-Atom TD-KS), 3D Bloch, Crystal Cell, Spin-Lattice LLG & Transport
  crystalViewMode: 'photon-shell', // 'photon-shell' | 'bloch' | 'lattice' | 'tdks-atom' | 'spin-llg' | 'transport'
  photonPlaying: true,
  photonModeMono: false,          // false = RGB White Light, true = Single-lambda probe
  probeWavelengthNm: 440,
  spinTempK: 300,
  spinFieldBTesla: 0.5,
  spinSweepB: false,
  spinSweepDir: 1,
  spinPlaying: true,
  transportTempK: 300,
  transportEFieldVPerM: 10000,
  transportPlaying: true,
  // Tab 4: Live WebGPU MD, Mechanical Stress-Strain/Acoustic & NEMD Viscosity/Heat/Surface
  mdMode: 'equilibrium',          // 'equilibrium' | 'strain' | 'acoustic' | 'shear' | 'thermal' | 'surface'
  mdNptBarostat: false,
  mdPlaying: true,
  mdTargetTempK: 300,
  // Tab 5: CI-NEB Reaction Scrubber
  nebImageIdx: 0,
  nebPlaying: false,
  nebLastTickMs: 0,
  // Tab 6: Polytope Atlas Interactive Cursor + Pressure Regime
  polytopeRegime: 'lab',          // 'lab' (10 GPa) | 'planetary' (1 TPa)
  polytopeProbe: null
};

// Fixed camera by default (zero canned auto-rotation unless user explicitly clicks Rotate!)
let camYaw = 0.42;
let camPitch = 0.28;
let camDist = 2.85;
let isDragging = false;
let lastPtrX = 0;
let lastPtrY = 0;

const L_NAMES = ['s', 'p', 'd', 'f', 'g', 'h'];
const NOBLE_GASES = new Set([2, 10, 18, 36, 54, 86, 118]);
const HALOGENS = new Set([9, 17, 35, 53, 85, 117]);
const ALKALIS = new Set([3, 11, 19, 37, 55, 87]);

function hexToRgbArr(hex) {
  const clean = String(hex || '#ffffff').replace('#', '').trim();
  if (clean.length !== 6) return [1, 1, 1];
  const v = Number.parseInt(clean, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

function wavelengthNmToRgb(nm) {
  const w = Math.max(380, Math.min(780, Number(nm) || 550));
  let r = 0; let g = 0; let b = 0;
  if (w < 440) { r = -(w - 440) / 60; b = 1; }
  else if (w < 490) { g = (w - 440) / 50; b = 1; }
  else if (w < 510) { g = 1; b = -(w - 510) / 20; }
  else if (w < 580) { r = (w - 510) / 70; g = 1; }
  else if (w < 645) { r = 1; g = -(w - 645) / 65; }
  else { r = 1; }
  return [Math.max(0.05, r), Math.max(0.05, g), Math.max(0.05, b)];
}

function srgbToCss(rgb) {
  const a = Array.isArray(rgb) && rgb.length === 3 ? rgb : [0.7, 0.75, 0.85];
  return `rgb(${Math.round(Math.max(0, Math.min(1, a[0])) * 255)}, ${Math.round(Math.max(0, Math.min(1, a[1])) * 255)}, ${Math.round(Math.max(0, Math.min(1, a[2])) * 255)})`;
}

function fmt(val, digits = 3) {
  if (val == null || !Number.isFinite(val)) return String(val ?? '—');
  if (Math.abs(val) >= 1e4 || (Math.abs(val) > 0 && Math.abs(val) < 1e-2)) return val.toExponential(2);
  return val.toFixed(digits);
}

function getActiveBundle() {
  if (activeSpecimenKind === 'compound' && currentCompoundRes?.bundle) return currentCompoundRes.bundle;
  return currentElementRes?.bundle || null;
}

function getActiveElectromagnetic() {
  if (activeSpecimenKind === 'compound' && currentCompoundRes?.bundle) {
    return currentCompoundRes.bundle.electromagnetic;
  }
  return currentElementRes?.visualData?.em || currentElementRes?.bundle?.electromagnetic || null;
}

function defaultValenceQuantumNumbers(Z) {
  const cfg = electronConfiguration(Z);
  // Prefer optically active valence d/f subshell (e.g. Au 5d, Ag 4d, Cu 3d, Fe 3d!), else open shell!
  const dVal = [...cfg].reverse().find((s) => s.l === 2 && s.occupancy > 0);
  if (dVal && (dVal.n >= 3)) return { n: dVal.n, l: dVal.l, m: 2 };
  const open = cfg.find((s) => s.occupancy < 2 * (2 * s.l + 1));
  if (open) return { n: open.n, l: open.l, m: open.l >= 2 ? 2 : 0 };
  const last = cfg[cfg.length - 1] || { n: 1, l: 0 };
  return { n: last.n, l: last.l, m: 0 };
}

function chooseDipoleTransitionPair(Z, atomResult) {
  const cfg = electronConfiguration(Z);
  const dSub = [...cfg].reverse().find((s) => s.l === 2 && s.occupancy > 0);
  if (dSub) {
    // d -> p electric-dipole transition (e.g. Au 5d -> 6p, Ag 4d -> 5p, Cu/Fe 3d -> 4p!)
    return { n0: dSub.n, l0: 2, n1: dSub.n + 1, l1: 1, m: 0 };
  }
  const pSub = [...cfg].reverse().find((s) => s.l === 1 && s.occupancy > 0);
  if (pSub) {
    return { n0: pSub.n, l0: 1, n1: pSub.n + 1, l1: 0, m: 0 };
  }
  const last = cfg[cfg.length - 1] || { n: 1, l: 0 };
  return { n0: last.n, l0: 0, n1: Math.max(2, last.n), l1: 1, m: 0 };
}

function setHud(title, sub) {
  if (hudTitle) hudTitle.textContent = title;
  if (hudSub) hudSub.textContent = sub;
}

function setBottomOverlay(html) {
  if (overlayBottom) overlayBottom.innerHTML = html || '';
}

function pushSpecimenHistory(entry) {
  const key = `${entry.kind}:${entry.label}`;
  const existingIdx = specimenHistory.findIndex((x) => `${x.kind}:${x.label}` === key);
  if (existingIdx >= 0) specimenHistory.splice(existingIdx, 1);
  specimenHistory.unshift(entry);
  if (specimenHistory.length > 6) specimenHistory.pop();
  renderSpecimenBar();
}

function renderSpecimenBar() {
  const b = getActiveBundle();
  if (!b) return;
  const srgb = b.electromagnetic?.opticalSrgb || [0.7, 0.78, 0.9];
  const css = srgbToCss(srgb);
  const isComp = activeSpecimenKind === 'compound';
  activeSpecimenPill.className = `specimen-pill${isComp ? ' backfed' : ''}`;
  activeSpecimenPill.innerHTML = `<i class="swatch" style="background:${css};"></i>` +
    (isComp
      ? `<span>BACKFED COMPOUND: ${b.materialKey}</span> <span style="opacity:0.75;font-weight:400;">(${b.mechanical.crystalStructure} · ${b.electromagnetic.isMetal ? 'Metal' : `Gap ${fmt(b.electromagnetic.bandGapEv, 2)} eV`})</span>`
      : `<span>ELEMENT: ${b.nuclear.isotope} (Z=${b.atomicNumber})</span> <span style="opacity:0.75;font-weight:400;">(${b.mechanical.crystalStructure} · ${b.electromagnetic.isMetal ? 'Metal' : `Gap ${fmt(b.electromagnetic.bandGapEv, 2)} eV`})</span>`);

  specimenHistoryEl.innerHTML = specimenHistory.map((h, i) =>
    `<button class="chip${h.kind === 'compound' ? ' react' : ''}" data-hist-idx="${i}">${h.label}</button>`
  ).join('');
  for (const btn of specimenHistoryEl.querySelectorAll('[data-hist-idx]')) {
    btn.addEventListener('click', () => {
      const item = specimenHistory[Number(btn.dataset.histIdx)];
      if (!item) return;
      if (item.kind === 'element') {
        selectedZ = item.Z;
        selectedA = item.A ?? null;
        zInput.value = String(selectedZ);
        if (aInput) aInput.value = String(selectedA ?? mostStableMassNumberForZ(selectedZ));
        runElementDerivation(selectedZ, selectedA);
      } else {
        compoundInput.value = item.formula;
        runCompoundDerivation(item.formula, { backfeedAllTabs: true });
      }
    });
  }
}

// ============================================================================
// Pointer Orbit, Zoom & Interactive Polytope Atlas Probe Cursor
// ============================================================================

async function handlePolytopePointer(e, isClick = false) {
  if (currentTab !== 'polytope' || !currentAtlas || !gpuRenderer) return;
  const rect = canvas.getBoundingClientRect();
  const u = (e.clientX - rect.left) / Math.max(1, rect.width);
  const v = 1.0 - (e.clientY - rect.top) / Math.max(1, rect.height);
  if (u < 0.06 || u > 0.96 || v < 0.08 || v > 0.90) return;
  const fx = (u - 0.06) / 0.90;
  const fy = (v - 0.08) / 0.82;
  const bounds = gpuRenderer.getPolytopeAxisBounds(currentAtlas);
  const logT = bounds.minLt + fx * (bounds.maxLt - bounds.minLt);
  const logP = bounds.minLp + fy * (bounds.maxLp - bounds.minLp);
  const T = 10 ** logT;
  const P = 10 ** logP;
  const res = await gpuRenderer.probePolytopeAtlasOnGpu(currentAtlas, T, P);
  if (!res) return;
  const activeBundle = getActiveBundle();
  const eosRho = (res.hit && activeBundle)
    ? evaluateBundleDensityEos(activeBundle, res.phase, T, P)
    : null;
  const relErrPct = (res.hit && eosRho > 0)
    ? (Math.abs(res.densityKgPerM3 - eosRho) / eosRho) * 100
    : null;
  uiState.polytopeProbe = { ...res, fx, fy, logT, logP, eosRho, relErrPct, locked: isClick };
  if (window.__ulgElementsLabState) {
    window.__ulgElementsLabState.polytopeProbe = uiState.polytopeProbe;
  }
  redrawCurrentTab();
}

function resetCameraView() {
  camYaw = 0.42;
  camPitch = 0.28;
  camDist = 2.85;
  renderViewportSync();
}

function attachCanvasInteractions() {
  let polyHoverPending = false;
  const activePointers = new Map();
  let lastPinchDist = 0;
  let tapStart = null;
  let lastCleanTap = null;

  function pinchDistance() {
    const pts = [...activePointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (currentTab === 'polytope') {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { canvas.setPointerCapture?.(e.pointerId); } catch {}
      handlePolytopePointer(e, true);
      return;
    }

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture?.(e.pointerId); } catch {}
    if (activePointers.size === 1) {
      isDragging = true;
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
      lastPinchDist = 0;
      tapStart = e.pointerType === 'touch'
        ? { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, t: performance.now() }
        : null;
    } else if (activePointers.size >= 2) {
      isDragging = false;
      tapStart = null;
      lastCleanTap = null;
      lastPinchDist = pinchDistance();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (currentTab === 'polytope') {
      if (e.pointerType !== 'mouse' && !activePointers.has(e.pointerId)) return;
      if (!polyHoverPending) {
        polyHoverPending = true;
        handlePolytopePointer(e, activePointers.has(e.pointerId)).finally(() => { polyHoverPending = false; });
      }
      return;
    }
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (tapStart && tapStart.id === e.pointerId && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 10) {
      tapStart.moved = true;
    }

    if (activePointers.size >= 2) {
      const dist = pinchDistance();
      if (lastPinchDist > 4 && dist > 4) {
        const scale = lastPinchDist / dist;
        camDist = Math.max(1.3, Math.min(5.4, camDist * scale));
        renderViewportSync();
      }
      lastPinchDist = dist;
      return;
    }

    if (!isDragging) return;
    const dx = e.clientX - lastPtrX;
    const dy = e.clientY - lastPtrY;
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
    const sens = e.pointerType === 'touch' ? 0.0105 : 0.008;
    camYaw += dx * sens;
    camPitch = Math.max(-1.25, Math.min(1.25, camPitch + dy * sens));
    renderViewportSync();
  });

  const stop = (e) => {
    const wasCleanTap = Boolean(
      tapStart && tapStart.id === e.pointerId && !tapStart.moved && activePointers.size === 1
      && (performance.now() - tapStart.t) < 260
    );
    activePointers.delete(e.pointerId);
    if (activePointers.size === 1) {
      const rem = [...activePointers.values()][0];
      lastPtrX = rem.x;
      lastPtrY = rem.y;
      isDragging = currentTab !== 'polytope';
      lastPinchDist = 0;
    } else {
      isDragging = false;
      lastPinchDist = 0;
      if (wasCleanTap && currentTab !== 'polytope') {
        const now = performance.now();
        if (lastCleanTap && (now - lastCleanTap.t) < 300 && Math.hypot(e.clientX - lastCleanTap.x, e.clientY - lastCleanTap.y) < 32) {
          lastCleanTap = null;
          resetCameraView();
        } else {
          lastCleanTap = { x: e.clientX, y: e.clientY, t: now };
        }
      }
      tapStart = null;
    }
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('dblclick', () => {
    if (currentTab !== 'polytope') resetCameraView();
  });
  canvas.addEventListener('wheel', (e) => {
    if (currentTab === 'polytope') return;
    e.preventDefault();
    camDist = Math.max(1.3, Math.min(5.4, camDist + Math.sign(e.deltaY) * 0.18));
    renderViewportSync();
  }, { passive: false });
  resetViewBtn?.addEventListener('click', () => resetCameraView());
}

function buildPeriodicTableButtons() {
  ptGrid.innerHTML = '';
  for (let Z = 1; Z <= 118; Z += 1) {
    const btn = document.createElement('button');
    let cls = 'el-btn';
    if (NOBLE_GASES.has(Z)) cls += ' noble';
    else if (HALOGENS.has(Z)) cls += ' halogen';
    else if (ALKALIS.has(Z)) cls += ' alkali';
    else if ((Z >= 21 && Z <= 30) || (Z >= 39 && Z <= 48) || (Z >= 72 && Z <= 80)) cls += ' metal-d';
    if (Z === selectedZ && activeSpecimenKind === 'element') cls += ' active';
    btn.className = cls;
    btn.dataset.z = String(Z);
    btn.innerHTML = `<small>${Z}</small>${ELEMENT_SYMBOLS[Z - 1]}`;
    btn.addEventListener('click', () => {
      selectedZ = Z;
      selectedA = null;
      zInput.value = String(Z);
      aInput.value = String(mostStableMassNumberForZ(Z));
      setMobileDrawerOpen(false);
      runElementDerivation(Z, null);
    });
    ptGrid.appendChild(btn);
  }
}

function updateActiveElementButton() {
  for (const btn of ptGrid.querySelectorAll('.el-btn')) {
    btn.classList.toggle('active', activeSpecimenKind === 'element' && Number(btn.dataset.z) === selectedZ);
  }
}

// ============================================================================
// Sidebar Bundle & G7 Readouts
// ============================================================================

function renderBundleCard(bundle, decayChain = null) {
  const nucSpin = bundle.nuclear.dominantMode
    ? `${bundle.nuclear.spinI}${bundle.nuclear.parity} (μ=${fmt(bundle.nuclear.magneticMomentMuN, 2)} μ_N) · ${bundle.nuclear.dominantMode}`
    : `M=${fmt(bundle.nuclear.molarMassU, 3)} u`;
  const decaySummary = decayChain && decayChain.steps?.length > 0
    ? `${decayChain.steps.slice(0, 3).map((s) => `${s.isotope}→${s.daughterIsotope}(${s.mode})`).join(' → ')}${decayChain.steps.length > 3 ? ` …→${decayChain.endIsotope}` : ''}`
    : (bundle.nuclear.dominantMode === 'stable' ? 'Stable (no decay chain)' : '—');
  const hfsVal = bundle.atomic?.hyperfineSplittingHz;
  const oscList = bundle.electromagnetic?.interbandOscillators || [];
  const oscTxt = oscList.length
    ? oscList.slice(0, 2).map((o) => `${o.transitionLabel || 'd→p'} ${fmt(o.energyEv, 2)}eV`).join(', ')
    : (bundle.electromagnetic.isMetal ? 'Drude free-e' : `UV gap ${fmt(bundle.electromagnetic.bandGapEv, 2)}eV`);
  const rows = [
    ['Specimen / Family', `${bundle.materialKey} (${bundle.family})`],
    ['Accuracy Tier', bundle.accuracyTier],
    ['Nuclear', bundle.nuclear.isotope ? `${bundle.nuclear.isotope} (M=${fmt(bundle.nuclear.atomicMassU, 3)} u) · B/A=${fmt(bundle.nuclear.bindingPerNucleonMeV, 2)} MeV · R=${fmt(bundle.nuclear.chargeRadiusFm, 2)} fm` : `Z=${bundle.nuclear.totalProtonsZ}, A=${bundle.nuclear.totalNucleonsA}`],
    ['Spin / Mode', nucSpin],
    ...(decayChain ? [['Decay Chain', decaySummary]] : []),
    ['Quantum Solver', bundle.atomic.totalEnergyHa != null ? `${fmt(bundle.atomic.totalEnergyHa, 2)} Ha (${bundle.atomic.relativisticMethod || 'GPU RHF'})` : 'Ionic/Covalent DFT'],
    ...(Number.isFinite(hfsVal) ? [['Isotope HFS / NMS', `${fmt(hfsVal * 1e-6, 2)} MHz · ΔE=${fmt(bundle.atomic.isotopeMassShiftHa, 2)} Ha`]] : []),
    ['Crystal / Density', `${bundle.mechanical.crystalStructure} · ${fmt(bundle.mechanical.densityKgPerM3, 0)} kg/m³`],
    ['Moduli / Debye', `K=${fmt(bundle.mechanical.bulkModulusPa * 1e-9, 1)} GPa · Θ_D=${fmt(bundle.mechanical.debyeTemperatureK, 0)} K`],
    ['EM / Band Gap', `${bundle.electromagnetic.isMetal ? `Metal (ω_p=${fmt(bundle.electromagnetic.plasmaEnergyEv, 1)} eV)` : `Gap ${fmt(bundle.electromagnetic.bandGapEv, 2)} eV`} · σ=${fmt(bundle.electromagnetic.electricalConductivitySPerM)} S/m`],
    ['Shell Transitions', oscTxt],
    ['Optics (550 nm)', `n=${fmt(bundle.electromagnetic.refractiveIndex550Nm, 2)} · R=${fmt((bundle.electromagnetic.reflectance550Nm ?? 0) * 100, 1)}%`],
    ['Magnetism', `${bundle.electromagnetic.magneticPhase}${bundle.electromagnetic.magneticMomentMuB ? ` (${fmt(bundle.electromagnetic.magneticMomentMuB, 2)} μ_B)` : ''}`],
    ['Melting / Boiling', `${fmt(bundle.thermodynamic.meltingPointK, 1)} K / ${fmt(bundle.thermodynamic.boilingPointK, 1)} K`],
    ['Thermal k / C_p', `${fmt(bundle.thermodynamic.thermalConductivityWPerMK, 2)} W/mK · ${fmt(bundle.thermodynamic.heatCapacityCpJPerKgK, 0)} J/kgK`]
  ];
  bundleReadout.innerHTML = `<h3>5-Domain Bundle (${bundle.materialKey})</h3>` +
    rows.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`).join('');
}

function renderG7Card(bundle, g7) {
  const srgb = bundle.electromagnetic.opticalSrgb || [0.7, 0.75, 0.8];
  const cssRgb = srgbToCss(srgb);
  const fdtdRgb = livePhotonTelemetry?.emergentReflectedSrgb
    ? srgbToCss(livePhotonTelemetry.emergentReflectedSrgb)
    : null;
  let html = `<h3>Accuracy Tier &amp; G7 Advisory</h3>
    <div class="kv"><span>Status</span><span>${bundle.provenance.status} (scientificValidation: false)</span></div>
    <div class="kv"><span>Tier</span><span>${bundle.accuracyTier}</span></div>
    <div class="kv"><span>GPU Optical Color</span><span><i class="swatch" style="background:${cssRgb};"></i> ${cssRgb}</span></div>`;
  if (fdtdRgb) {
    html += `<div class="kv"><span>FDTD Reflected Color</span><span><i class="swatch" style="background:${fdtdRgb};"></i> ${fdtdRgb}</span></div>`;
  }
  if (g7?.hasReference) {
    html += `
      <div class="kv"><span>G7 B/A Error</span><span>${fmt(g7.bindingPerNucleonRelErr * 100, 2)}%</span></div>
      <div class="kv"><span>G7 Density Error</span><span>${fmt(g7.densityRelErr * 100, 1)}%</span></div>
      <div class="kv"><span>G7 Magnetic Match</span><span>${g7.magneticPhaseMatch ? 'YES' : 'DIFF'} (ref: ${g7.reference.mag})</span></div>`;
  } else if (g7?.note) {
    html += `<div style="font-size:10.5px;color:var(--muted);margin-top:4px;">${g7.note}</div>`;
  }
  g7Card.innerHTML = html;
}

// ============================================================================
// 2D Scientific Diagnostic Plots (Software-Backed for Crisp Co-Flush)
// ============================================================================

function getPlotCtx(cv) {
  const rect = cv.getBoundingClientRect();
  if (rect.width >= 120 && rect.height >= 60) {
    const targetW = Math.round(rect.width);
    const targetH = Math.round(rect.height);
    if (Math.abs(cv.width - targetW) > 2 || Math.abs(cv.height - targetH) > 2) {
      cv.width = targetW;
      cv.height = targetH;
    }
  }
  return cv.getContext('2d', { willReadFrequently: true });
}

function drawMultiLinePlot(cv, seriesList, {
  label = '',
  yMin = null,
  yMax = null,
  hLine = null,
  vLine = null,
  xTicks = null
} = {}) {
  const ctx = getPlotCtx(cv);
  const w = cv.width; const h = cv.height;
  ctx.fillStyle = '#060b14';
  ctx.fillRect(0, 0, w, h);
  const valid = seriesList.filter((s) => s.xs?.length >= 2 && s.ys?.length >= 2);
  if (!valid.length) return;
  let loX = Infinity; let hiX = -Infinity;
  let loY = Infinity; let hiY = -Infinity;
  for (const s of valid) {
    for (const x of s.xs) { if (x < loX) loX = x; if (x > hiX) hiX = x; }
    for (const y of s.ys) { if (y < loY) loY = y; if (y > hiY) hiY = y; }
  }
  if (yMin != null) loY = yMin;
  if (yMax != null) hiY = yMax;
  if (hLine != null) { loY = Math.min(loY, hLine.y); hiY = Math.max(hiY, hLine.y); }
  const spanX = Math.max(1e-9, hiX - loX);
  const spanY = Math.max(1e-9, hiY - loY);
  const padL = 26; const padR = 10; const padT = 19; const padB = 18;
  const mapX = (x) => padL + ((x - loX) / spanX) * (w - padL - padR);
  const mapY = (y) => h - padB - ((y - loY) / spanY) * (h - padT - padB);

  ctx.strokeStyle = 'rgba(148,163,184,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, h - padB);
  ctx.lineTo(w - padR, h - padB);
  ctx.stroke();

  if (hLine != null) {
    const py = mapY(hLine.y);
    ctx.save();
    ctx.strokeStyle = hLine.color || '#facc15';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padL, py);
    ctx.lineTo(w - padR, py);
    ctx.stroke();
    ctx.fillStyle = hLine.color || '#facc15';
    ctx.font = '9.5px Inter, sans-serif';
    ctx.fillText(hLine.label || '', w - padR - 46, Math.max(padT + 8, py - 3));
    ctx.restore();
  }
  if (vLine != null) {
    const px = mapX(vLine.x);
    ctx.save();
    ctx.strokeStyle = vLine.color || '#facc15';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px, padT);
    ctx.lineTo(px, h - padB);
    ctx.stroke();
    ctx.fillStyle = vLine.color || '#facc15';
    ctx.font = '9.5px Inter, sans-serif';
    ctx.fillText(vLine.label || '', Math.min(w - 42, px + 3), padT + 10);
    ctx.restore();
  }

  for (const s of valid) {
    ctx.strokeStyle = s.color || '#56c2ff';
    ctx.lineWidth = s.width || 1.75;
    ctx.beginPath();
    for (let i = 0; i < s.xs.length; i += 1) {
      const px = mapX(s.xs[i]);
      const py = mapY(s.ys[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    if (s.fill) {
      ctx.lineTo(mapX(s.xs[s.xs.length - 1]), h - padB);
      ctx.lineTo(mapX(s.xs[0]), h - padB);
      ctx.closePath();
      ctx.fillStyle = s.fill;
      ctx.fill();
    }
  }

  if (Array.isArray(xTicks)) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9.5px Inter, sans-serif';
    for (const tk of xTicks) {
      const px = mapX(tk.x);
      ctx.fillText(tk.label, Math.max(padL, Math.min(w - 22, px - 5)), h - 4);
    }
  }
  ctx.fillStyle = '#a5bce0';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText(label, 8, 13);
}

function drawPlotLine(cv, xs, ys, opts = {}) {
  drawMultiLinePlot(cv, [{ xs, ys, color: opts.color || '#56c2ff', width: opts.width || 1.8 }], opts);
}

function drawNuclideChart(cv, nuclear) {
  const ctx = getPlotCtx(cv);
  const w = cv.width; const h = cv.height;
  ctx.fillStyle = '#060b14';
  ctx.fillRect(0, 0, w, h);
  if (!nuclear?.chartData) return;
  const { maxZ, maxN } = nuclear.chartDims;
  const colors = [null, '#22c55e', '#38bdf8', '#f472b6', '#facc15', '#ef4444'];
  for (let z = 1; z <= maxZ; z += 1) {
    for (let n = 0; n < maxN; n += 1) {
      const mode = Math.round(nuclear.chartData[((z - 1) * maxN + n) * 4 + 3]);
      if (mode <= 0) continue;
      ctx.fillStyle = colors[mode] || '#fff';
      const px = 12 + (n / maxN) * (w - 24);
      const py = h - 12 - (z / maxZ) * (h - 24);
      ctx.fillRect(px, py, 2, 2);
    }
  }
  const sx = 12 + (nuclear.N / maxN) * (w - 24);
  const sy = h - 12 - (nuclear.Z / maxZ) * (h - 24);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx - 4, sy - 4, 8, 8);
}

function drawTdseBarrierPlot(cv, nuclear, tdseTel) {
  if (!tdseTel) {
    drawPlotLine(cv, Array.from(nuclear.alphaWkb.rFm), Array.from(nuclear.alphaWkb.vMeV), {
      label: 'V_nuc + V_coul (MeV vs fm)', color: '#facc15'
    });
    return;
  }
  const rs = Array.from(tdseTel.rGridFm);
  const vs = Array.from(tdseTel.potRawMeV);
  const prob = Array.from(tdseTel.prob);
  const vMax = Math.max(12, ...vs);
  const pMax = Math.max(1e-6, ...prob);
  // Scale |psi(r,t)|^2 clearly onto the potential plot centered at E = qEffMeV!
  const psiScaled = prob.map((p) => tdseTel.qEffMeV + (p / pMax) * (vMax * 0.65));
  drawMultiLinePlot(cv, [
    { xs: rs, ys: vs, color: '#facc15', width: 1.8 },
    { xs: rs, ys: psiScaled, color: '#38bdf8', width: 1.8, fill: 'rgba(56, 189, 248, 0.24)' }
  ], {
    label: `GPU TDSE |ψ(r,t)|² (cyan) vs V(r) (gold) · P_tunnel=${fmt(tdseTel.pTunneled * 100, 2)}%`,
    hLine: { y: tdseTel.qEffMeV, color: '#f472b6', label: `Q=${fmt(tdseTel.qEffMeV, 1)}MeV` }
  });
}

function drawPhotonFdtdBarPlot(cv, tel, labelPrefix = '') {
  const ctx = getPlotCtx(cv);
  const w = cv.width; const h = cv.height;
  ctx.fillStyle = '#060b14';
  ctx.fillRect(0, 0, w, h);
  if (!tel?.channels) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('Stepping Maxwell-ADE-FDTD photon wavepackets on WebGPU…', 10, 68);
    return;
  }
  const chs = tel.channels;
  const labels = ['610nm R', '535nm G', '440nm B', `${Math.round(chs[3].wavelengthNm)}nm`];
  const cols = ['#ef4444', '#22c55e', '#3b82f6', srgbToCss(wavelengthNmToRgb(chs[3].wavelengthNm))];
  const padL = 12; const padB = 22; const padT = 22;
  const barGroupW = (w - padL - 78) / 4;

  ctx.fillStyle = '#a5bce0';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText(`${labelPrefix}Live GPU FDTD: Reflectance R (solid) vs Shell Absorption A (hatch)`, 8, 13);

  for (let i = 0; i < 4; i += 1) {
    const c = chs[i];
    const gx = padL + i * barGroupW;
    const bw = Math.max(12, barGroupW * 0.34);
    const maxH = h - padT - padB;
    const rH = Math.min(1, c.reflectance) * maxH;
    const aH = Math.min(1, c.absorption) * maxH;
    const tH = Math.min(1, c.transmittance) * maxH;

    // Reflectance bar
    ctx.fillStyle = cols[i];
    ctx.fillRect(gx + 3, h - padB - rH, bw, rH);
    // Shell absorption bar (gold/violet)
    ctx.fillStyle = 'rgba(192, 132, 252, 0.85)';
    ctx.fillRect(gx + 5 + bw, h - padB - aH, bw * 0.72, aH);
    // Transmittance thin indicator if dielectric
    if (!tel.isMetal && tH > 1) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx + 3, h - padB - tH, bw, tH);
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText(labels[i], gx + 2, h - 7);
    ctx.fillText(`R${Math.round(c.reflectance * 100)}%`, gx + 2, Math.max(padT + 8, h - padB - rH - 2));
  }

  // Right-side live Emergent Reflected Color Swatch derived purely from FDTD R_R, R_G, R_B!
  const swX = w - 66;
  const swY = 26;
  ctx.fillStyle = srgbToCss(tel.emergentReflectedSrgb);
  ctx.fillRect(swX, swY, 54, 48);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(swX, swY, 54, 48);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '9px Inter, sans-serif';
  ctx.fillText('Emergent', swX + 4, swY + 60);
  ctx.fillText('FDTD RGB', swX + 3, swY + 71);
}

function drawOpticalSpectrumPlot(cv, wavelengthsNm, reflectance, nRe, srgb, materialLabel) {
  if (Array.isArray(wavelengthsNm) && wavelengthsNm.length >= 2 && Array.isArray(reflectance)) {
    const series = [
      { xs: wavelengthsNm, ys: reflectance.map((r) => r * 100), color: '#fbbf24', width: 2.0 }
    ];
    if (Array.isArray(nRe) && nRe.length === wavelengthsNm.length) {
      const maxN = Math.max(1, ...nRe);
      series.push({ xs: wavelengthsNm, ys: nRe.map((n) => (n / maxN) * 80), color: '#38bdf8', width: 1.4 });
    }
    drawMultiLinePlot(cv, series, {
      label: `UV-Vis R(λ)% (gold) & scaled n(λ) (blue) — ${materialLabel}`,
      yMin: 0,
      yMax: 105,
      xTicks: [{ x: 380, label: '380nm' }, { x: 550, label: '550nm' }, { x: 740, label: '780nm' }]
    });
    if (Array.isArray(srgb) && srgb.length === 3) {
      const ctx = getPlotCtx(cv);
      ctx.fillStyle = srgbToCss(srgb);
      ctx.fillRect(cv.width - 34, 6, 24, 13);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.strokeRect(cv.width - 34, 6, 24, 13);
    }
  } else {
    drawPlotLine(cv, [380, 550, 780], [0, 0, 0], { label: 'No spectral samples available', color: '#64748b', yMin: 0, yMax: 100 });
  }
}

function drawPolarAngularPlot(cv, lQuantum, mQuantum, symbol, unpaired) {
  const ctx = getPlotCtx(cv);
  const w = cv.width; const h = cv.height;
  ctx.fillStyle = '#060b14';
  ctx.fillRect(0, 0, w, h);
  const cx = w * 0.5; const cy = h * 0.54; const maxR = Math.min(w, h) * 0.36;
  ctx.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
  ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
  ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
  ctx.stroke();

  const evalAmp = (theta) => {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const ma = Math.abs(mQuantum);
    if (lQuantum === 0) return 0.72;
    if (lQuantum === 1) return ma === 0 ? c : s;
    if (lQuantum === 2) return ma === 0 ? 0.5 * (3 * c * c - 1) : (ma === 1 ? 1.5 * s * c : 0.75 * s * s);
    return 0.5 * c * (5 * c * c - 3);
  };
  for (const signPass of [1, -1]) {
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 180; i += 1) {
      const th = (i / 180) * Math.PI * 2;
      const amp = evalAmp(th);
      const r = (amp * signPass > 0) ? Math.abs(amp) * maxR : 0;
      const px = cx + r * Math.sin(th);
      const py = cy - r * Math.cos(th);
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = signPass > 0 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(97, 43, 222, 0.35)';
    ctx.fill();
    ctx.strokeStyle = signPass > 0 ? '#ffffff' : '#8b5cf6';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.fillStyle = '#a5bce0';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText(`${symbol} · |Y_${lQuantum},${mQuantum}(θ)| polar slice · unpaired=${unpaired}`, 8, 13);
}

function drawPolytopeDiagram(cv, atlas, probe = null) {
  const ctx = getPlotCtx(cv);
  const w = cv.width; const h = cv.height;
  ctx.fillStyle = '#060b14';
  ctx.fillRect(0, 0, w, h);
  if (!atlas?.polytopes?.length) return;
  const phaseColors = {
    solid: 'rgba(86, 194, 255, 0.36)',
    liquid: 'rgba(52, 211, 153, 0.38)',
    gas: 'rgba(251, 146, 60, 0.34)',
    plasma: 'rgba(192, 132, 252, 0.36)'
  };
  const phaseBorder = { solid: '#56c2ff', liquid: '#34d399', gas: '#fb923c', plasma: '#c084fc' };
  const minLt = Math.log10(Math.max(1, Math.min(...atlas.polytopes.map((p) => p.axes[0].min))));
  const maxLt = Math.log10(Math.max(10, Math.max(...atlas.polytopes.map((p) => p.axes[0].max))));
  const minLp = Math.min(...atlas.polytopes.map((p) => Math.log10(p.axes[1].min)));
  const maxLp = Math.max(...atlas.polytopes.map((p) => Math.log10(p.axes[1].max)));
  const padL = 30; const padR = 10; const padT = 18; const padB = 20;
  const mapX = (T) => padL + ((Math.log10(Math.max(1, T)) - minLt) / Math.max(1e-6, maxLt - minLt)) * (w - padL - padR);
  const mapY = (lp) => h - padB - ((lp - minLp) / Math.max(1e-6, maxLp - minLp)) * (h - padT - padB);

  for (const poly of atlas.polytopes) {
    const lp0 = Math.log10(poly.axes[1].min);
    const lp1 = Math.log10(poly.axes[1].max);
    const lowerPts = []; const upperPts = [];
    for (let s = 0; s <= 12; s += 1) {
      const lp = lp0 + (s / 12) * (lp1 - lp0);
      let tLo = poly.axes[0].min; let tHi = poly.axes[0].max;
      for (const ineq of (poly.inequalities || [])) {
        const a0 = ineq.a[0]; const a1 = ineq.a[1]; const b = ineq.b;
        if (Math.abs(a0) > 1e-9) {
          const rhs = (b - a1 * lp) / a0;
          if (a0 > 0) tHi = Math.min(tHi, rhs); else tLo = Math.max(tLo, rhs);
        }
      }
      if (tHi > tLo) {
        lowerPts.push([mapX(tLo), mapY(lp)]);
        upperPts.push([mapX(tHi), mapY(lp)]);
      }
    }
    if (lowerPts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(lowerPts[0][0], lowerPts[0][1]);
      for (const pt of lowerPts) ctx.lineTo(pt[0], pt[1]);
      for (let k = upperPts.length - 1; k >= 0; k -= 1) ctx.lineTo(upperPts[k][0], upperPts[k][1]);
      ctx.closePath();
      ctx.fillStyle = phaseColors[poly.phase] || 'rgba(255,255,255,0.2)';
      ctx.fill();
      ctx.strokeStyle = phaseBorder[poly.phase] || '#93c5fd';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  if (probe) {
    const px = mapX(probe.temperatureK);
    const py = mapY(Math.log10(Math.max(1e-6, probe.pressurePa)));
    ctx.strokeStyle = probe.hit ? '#facc15' : '#f87171';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#a5bce0';
  ctx.font = '9.5px Inter, sans-serif';
  ctx.fillText(`A x <= b (${atlas.materialKey}, ${atlas.polytopeCount} cells)`, padL, 12);
  ctx.fillText(`T: ${Math.round(10 ** minLt)}..${Math.round(10 ** maxLt)} K`, padL, h - 5);
  ctx.fillText(`log10 P: ${minLp.toFixed(0)}..${maxLp.toFixed(0)}`, w - 102, h - 5);
}

// ============================================================================
// GPU Resource Builders (Orbital Cloud, Photon-Shell FDTD, TDSE, Live MD)
// ============================================================================

function rebuildOrbitalPointCloud() {
  if (!gpuDevice) return;
  if (activeSpecimenKind === 'compound' && currentCompoundRes?.visualData?.molQm?.atomOrbitalParams) {
    const params = currentCompoundRes.visualData.molQm.atomOrbitalParams;
    const prevBuf = liveMolOrbitalCloud?.pointsBuffer ?? null;
    liveMolOrbitalCloud = sampleMolecularOrbitalCloudWebGpu(gpuDevice, {
      posZeta: params.posZeta,
      weights: params.weights,
      boxHalfBohr: params.boxHalfBohr,
      mode: uiState.molOrbitalMode,
      pointCount: Math.min(240000, uiState.pointCount),
      seed: uiState.cloudSeed,
      reuseBuffer: prevBuf
    });
    if (prevBuf && prevBuf !== liveMolOrbitalCloud?.pointsBuffer) {
      try { prevBuf.destroy(); } catch {}
    }
    return;
  }

  if (!currentElementRes?.visualData?.atom) return;
  const atom = currentElementRes.visualData.atom;
  uiState.l = Math.max(0, Math.min(uiState.n - 1, uiState.l));
  uiState.m = Math.max(-uiState.l, Math.min(uiState.l, uiState.m));

  // Match ULG's ACTUAL GPU Kohn-Sham radial eigenstate u_{nl}(r) whenever (n, l) was solved!
  let solvedU = null;
  if (Array.isArray(atom.orbitalWavefunctions) && Array.isArray(atom.orbitals)) {
    const orbIdx = atom.orbitals.findIndex((o) => o.n === uiState.n && o.l === uiState.l);
    if (orbIdx >= 0 && atom.orbitalWavefunctions[orbIdx]) {
      solvedU = atom.orbitalWavefunctions[orbIdx];
    }
  }
  const prevBuf = liveOrbitalCloud?.pointsBuffer ?? null;
  liveOrbitalCloud = sampleAtomicOrbitalCloudWebGpu(gpuDevice, {
    Z: atom.atomicNumberZ,
    n: uiState.n,
    l: uiState.l,
    m: uiState.m,
    pointCount: uiState.pointCount,
    rGrid: atom.radialGrid?.r || null,
    orbitalU: solvedU,
    screeningExchange: uiState.functional !== 'bare',
    relativisticSpinOrbit: uiState.relativisticSpinOrbit,
    colorMode: uiState.colorMode,
    seed: uiState.cloudSeed,
    reuseBuffer: prevBuf
  });
  if (prevBuf && prevBuf !== liveOrbitalCloud?.pointsBuffer) {
    try { prevBuf.destroy(); } catch {}
  }

  // Also sample the 180K-point dipole-coupled (phi0, phi1) GPU quantum basis for live TD-KS Photon interaction!
  const pairSpec = chooseDipoleTransitionPair(atom.atomicNumberZ, atom);
  const findU = (nn, ll) => {
    if (!Array.isArray(atom.orbitalWavefunctions) || !Array.isArray(atom.orbitals)) return null;
    const i = atom.orbitals.findIndex((o) => o.n === nn && o.l === ll);
    return i >= 0 ? atom.orbitalWavefunctions[i] : null;
  };
  const prevPos = liveTdksPairCloud?.posBuffer ?? null;
  const prevAmp = liveTdksPairCloud?.ampBuffer ?? null;
  liveTdksPairCloud = sampleDipoleCoupledOrbitalPairWebGpu(gpuDevice, {
    Z: atom.atomicNumberZ,
    n0: pairSpec.n0,
    l0: pairSpec.l0,
    n1: pairSpec.n1,
    l1: pairSpec.l1,
    m: pairSpec.m,
    rGrid: atom.radialGrid?.r || null,
    u0: findU(pairSpec.n0, pairSpec.l0),
    u1: findU(pairSpec.n1, pairSpec.l1),
    pointCount: IS_MOBILE_GPU_PROFILE ? 80000 : 180000,
    screeningExchange: uiState.functional !== 'bare',
    relativisticSpinOrbit: uiState.relativisticSpinOrbit,
    seed: uiState.cloudSeed,
    reusePosBuffer: prevPos,
    reuseAmpBuffer: prevAmp
  });
}

function getShellBufferForPhotonScene() {
  if (activeSpecimenKind === 'compound' && liveMolOrbitalCloud?.pointsBuffer) {
    return liveMolOrbitalCloud;
  }
  return liveOrbitalCloud;
}

function initPhotonShellSessionForActiveSpecimen() {
  if (!gpuDevice) return;
  if (livePhotonSession) {
    try { livePhotonSession.destroy(); } catch {}
    livePhotonSession = null;
  }
  livePhotonTelemetry = null;
  const em = getActiveElectromagnetic();
  if (!em) return;
  liveBlochSession = createQuantumBlochPhotonSession(em, { probeWavelengthNm: uiState.probeWavelengthNm });
  // Step TD-KS wavepacket into active cloud interaction (t = 3.6 fs) so electron cloud is visibly sloshing on frame 1!
  for (let k = 0; k < 45; k += 1) liveBlochSession.stepFs(0.08);

  // For backfed compounds, build a representative 180K-point molecular valence-transition pair cloud too!
  if (activeSpecimenKind === 'compound' && currentCompoundRes) {
    const sites = currentCompoundRes.bundle?.nuclear?.isotopologueSites || [];
    const repZ = sites.reduce((mx, s) => Math.max(mx, s.Z || 1), 8);
    const pairSpec = chooseDipoleTransitionPair(repZ, null);
    liveTdksPairCloud = sampleDipoleCoupledOrbitalPairWebGpu(gpuDevice, {
      Z: repZ,
      n0: pairSpec.n0,
      l0: pairSpec.l0,
      n1: pairSpec.n1,
      l1: pairSpec.l1,
      m: pairSpec.m,
      pointCount: IS_MOBILE_GPU_PROFILE ? 75000 : 160000,
      screeningExchange: true,
      relativisticSpinOrbit: true,
      reusePosBuffer: liveTdksPairCloud?.posBuffer ?? null,
      reuseAmpBuffer: liveTdksPairCloud?.ampBuffer ?? null
    });
  }

  livePhotonSession = createPhotonShellOpticsSessionWebGpu(gpuDevice, em, {
    probeWavelengthNm: uiState.probeWavelengthNm
  });
  // Warm up 120 2D FDTD steps (5 batches of 24) so the oblique Gaussian photon wavepacket is visibly hitting the slab!
  for (let w = 0; w < 5; w += 1) livePhotonSession.stepSync(24);
  livePhotonSession.readTelemetry().then((tel) => {
    if (!tel) return;
    livePhotonTelemetry = tel;
    const b = getActiveBundle();
    if (b) {
      registerPhotonShellOpticsClosureArtifact({
        closureRegistry: labClosureRegistry,
        materialKey: b.materialKey,
        electromagnetic: em,
        telemetry: tel
      }).catch(() => {});
    }
    if (currentTab === 'crystal') redrawCurrentTab();
  }).catch(() => {});
}

function initNuclearTdseForActiveElement() {
  if (!gpuDevice) return;
  if (liveTdseSession) {
    try { liveTdseSession.destroy(); } catch {}
    liveTdseSession = null;
  }
  liveTdseTelemetry = null;
  const nuc = currentElementRes?.visualData?.nuclear;
  if (!nuc) return;
  liveTdseSession = createNuclearTunnelingTdseWebGpu(gpuDevice, nuc);
}

function computeBatemanDecayCurves(decayChain) {
  if (!decayChain?.steps?.length) return null;
  const steps = decayChain.steps;
  const firstHalfLife = Math.max(1e-6, Math.min(1e24, Number(steps[0].halfLifeS) || 1));
  // Build custom channel map from Gate 1 derived chain so arbitrary (Z, A) nuclides step cleanly!
  const chanMap = {};
  for (const s of steps) chanMap[s.isotope] = s;
  const tracked = [steps[0].isotope, steps[0].daughterIsotope];
  if (steps.length >= 2 && !tracked.includes(steps[1].daughterIsotope)) tracked.push(steps[1].daughterIsotope);
  if (decayChain.endIsotope && !tracked.includes(decayChain.endIsotope)) tracked.push(decayChain.endIsotope);

  const nPts = 36;
  const tHalfUnits = [];
  const curves = tracked.map((name) => ({ name, frac: [] }));
  const N0 = 1e6;
  let inv = [{ isotope: steps[0].isotope, A: steps[0].A, atomCount: N0 }];
  const dtStep = (firstHalfLife * 6.0) / (nPts - 1);
  for (let k = 0; k < nPts; k += 1) {
    tHalfUnits.push((k * dtStep) / firstHalfLife);
    for (let c = 0; c < tracked.length; c += 1) {
      const entry = inv.find((e) => e.isotope === tracked[c]);
      curves[c].frac.push((entry?.atomCount || 0) / N0);
    }
    if (k < nPts - 1) {
      const res = stepIsotopeInventoryLedger(inv, dtStep, { channels: chanMap });
      inv = res.nextInventory;
    }
  }
  return { tHalfUnits, firstHalfLifeS: firstHalfLife, curves };
}

function updateNuclearFissionVolume() {
  if (!gpuDevice || activeSpecimenKind !== 'element' || !currentElementRes?.visualData?.nuclear) return;
  const nuc = currentElementRes.visualData.nuclear;
  liveFissionCurve = bohrWheelerFissionCurve(nuc.Z, nuc.A);
  liveFissionVolGpu = buildFissionDeformationVolumeWebGpu(gpuDevice, nuc, {
    beta2: uiState.fissionBeta2,
    dim: IS_MOBILE_GPU_PROFILE ? 24 : 28,
    reuseBuffer: liveFissionVolGpu?.buffer ?? null
  });
}

function updateStarkStateForActiveElement() {
  const activeAtom = (uiState.ionizedCation && liveDeltaScfResult?.cationAtom)
    ? liveDeltaScfResult.cationAtom
    : currentElementRes?.visualData?.atom;
  if (!activeAtom) { liveStarkState = null; return; }
  liveStarkState = computeStarkPolarizationState({
    atomResult: activeAtom,
    eFieldVPerA: uiState.starkFieldVPerA
  });
}

async function toggleDeltaScfIonization(enableCation) {
  if (!gpuDevice || activeSpecimenKind !== 'element' || !currentElementRes?.visualData?.atom) return;
  uiState.ionizedCation = Boolean(enableCation);
  if (uiState.ionizedCation && (!liveDeltaScfResult || liveDeltaScfResult.Z !== selectedZ)) {
    statusBadge.textContent = `Solving ΔSCF ${symbolForZ(selectedZ)}⁺…`;
    const baseAtom = currentElementRes.visualData.atom;
    const nuc = currentElementRes.visualData.nuclear;
    liveDeltaScfResult = await solveDeltaScfIonizationWebGpu(gpuDevice, {
      Z: selectedZ,
      solveAtomFullWebGpu,
      baseConfiguration: electronConfiguration(selectedZ),
      baseAtomResult: baseAtom,
      functional: uiState.functional,
      scalarRelativistic: uiState.relativisticSpinOrbit,
      spinOrbit: uiState.relativisticSpinOrbit,
      nuclearChargeRadiusBohr: nuc?.chargeRadiusBohr,
      nuclearMassU: nuc?.atomicMassU
    });
    statusBadge.textContent = `${symbolForZ(selectedZ)}⁺ I₁=${fmt(liveDeltaScfResult?.ionizationEnergyEv, 2)} eV`;
  }
  // Re-sample 3D orbital point cloud directly from contracted cation (or neutral) GPU KS wavefunction!
  const srcAtom = (uiState.ionizedCation && liveDeltaScfResult?.cationAtom)
    ? liveDeltaScfResult.cationAtom
    : currentElementRes.visualData.atom;
  if (srcAtom) {
    let solvedU = null;
    if (Array.isArray(srcAtom.orbitalWavefunctions) && Array.isArray(srcAtom.orbitals)) {
      const oi = srcAtom.orbitals.findIndex((o) => o.n === uiState.n && o.l === uiState.l);
      if (oi >= 0) solvedU = srcAtom.orbitalWavefunctions[oi];
    }
    const prevBuf = liveOrbitalCloud?.pointsBuffer ?? null;
    liveOrbitalCloud = sampleAtomicOrbitalCloudWebGpu(gpuDevice, {
      Z: uiState.ionizedCation ? srcAtom.atomicNumberZ + 0.65 : srcAtom.atomicNumberZ,
      n: uiState.n,
      l: uiState.l,
      m: uiState.m,
      pointCount: uiState.pointCount,
      rGrid: srcAtom.radialGrid?.r || null,
      orbitalU: solvedU,
      screeningExchange: uiState.functional !== 'bare',
      relativisticSpinOrbit: uiState.relativisticSpinOrbit,
      colorMode: uiState.colorMode,
      seed: uiState.cloudSeed,
      reuseBuffer: prevBuf
    });
  }
  updateStarkStateForActiveElement();
  renderSimControls();
  redrawCurrentTab();
  syncDebugState();
}

function initSpinLatticeForActiveSpecimen() {
  if (!gpuDevice) return;
  if (liveSpinSession) {
    try { liveSpinSession.destroy(); } catch {}
    liveSpinSession = null;
  }
  liveSpinTelemetry = null;
  liveSpinHistory = [];
  const b = getActiveBundle();
  const em = getActiveElectromagnetic();
  if (!b || !em) return;
  const tc = Number(em.curieOrNeelTempK) || 0;
  uiState.spinTempK = (em.magneticPhase === 'ferromagnetic' || em.magneticPhase === 'antiferromagnetic') && tc > 20
    ? Math.max(10, Math.round(tc * 0.45))
    : 300;
  const side = IS_MOBILE_GPU_PROFILE ? 8 : 10;
  liveSpinSession = createSpinLatticeSessionWebGpu(gpuDevice, em, b.mechanical || {}, {
    nx: side, ny: side, nz: side,
    temperatureK: uiState.spinTempK,
    fieldBZTesla: uiState.spinFieldBTesla
  });
  liveSpinSession.stepBatch(18, { readObs: true }).then((tel) => {
    if (!tel) return;
    liveSpinTelemetry = tel;
    liveSpinHistory.push({ B: tel.fieldBZTesla, Mz: tel.magnetizationZ, Mmag: tel.magnetizationMag, Mstag: tel.staggeredOrderMag, T: tel.temperatureK });
    registerSpinLatticeClosureArtifact({
      closureRegistry: labClosureRegistry,
      materialKey: b.materialKey,
      electromagnetic: em,
      mechanical: b.mechanical,
      telemetry: tel
    }).catch(() => {});
    if (currentTab === 'crystal' && uiState.crystalViewMode === 'spin-llg') redrawCurrentTab();
    syncDebugState();
  }).catch(() => {});
}

function initElectronTransportForActiveSpecimen(overrideTempK = null) {
  if (!gpuDevice) return;
  if (liveTransportSession) {
    try { liveTransportSession.destroy(); } catch {}
    liveTransportSession = null;
  }
  liveTransportTelemetry = null;
  liveTransportHistory = [];
  const b = getActiveBundle();
  const em = getActiveElectromagnetic();
  if (!b || !em) return;
  const tc = Number(em.superconductingTcK) || 0;
  if (overrideTempK != null) {
    uiState.transportTempK = Math.max(0.5, Number(overrideTempK));
  } else if (tc > 0.8 && uiState.crystalViewMode === 'transport') {
    uiState.transportTempK = Math.max(0.5, Number((tc * 0.35).toFixed(1)));
  } else {
    uiState.transportTempK = 300;
  }
  liveTransportSession = createElectronTransportSessionWebGpu(gpuDevice, em, b.mechanical || {}, {
    carrierCount: IS_MOBILE_GPU_PROFILE ? 512 : 1024,
    temperatureK: uiState.transportTempK,
    eFieldVPerM: uiState.transportEFieldVPerM
  });
  liveTransportSession.stepBatch(16, { readObs: true }).then((tel) => {
    if (!tel) return;
    liveTransportTelemetry = tel;
    liveTransportHistory.push({ T: tel.temperatureK, drift: tel.meanDriftNorm, scatter: tel.measuredScatterRateFrac, sigma: tel.sigmaGpuSPerM });
    registerElectronTransportClosureArtifact({
      closureRegistry: labClosureRegistry,
      materialKey: b.materialKey,
      electromagnetic: em,
      mechanical: b.mechanical,
      telemetry: tel
    }).catch(() => {});
    if (currentTab === 'crystal' && uiState.crystalViewMode === 'transport') redrawCurrentTab();
    syncDebugState();
  }).catch(() => {});
}

function initLiveMdForActiveSpecimen(overrideTempK = null, overrideMode = null) {
  if (overrideMode) uiState.mdMode = overrideMode;
  if (liveMdSession) {
    try { liveMdSession.destroy(); } catch {}
    liveMdSession = null;
  }
  liveMdTelemetry = null;
  liveMdHistory = [];
  liveMdVacfHistory = [];
  liveMdStrainHistory = [];
  liveMdConfigMeta = null;
  if (!gpuDevice) return;

  const modeKey = uiState.mdMode || 'equilibrium';
  const modeMap = {
    equilibrium: MD_EXPERIMENT_MODES.EQUILIBRIUM,
    strain: MD_EXPERIMENT_MODES.STRAIN,
    acoustic: MD_EXPERIMENT_MODES.ACOUSTIC,
    shear: MD_EXPERIMENT_MODES.SHEAR_NEMD,
    thermal: MD_EXPERIMENT_MODES.THERMAL_NEMD,
    surface: MD_EXPERIMENT_MODES.SURFACE_SLAB
  };
  const modeCode = modeMap[modeKey] ?? MD_EXPERIMENT_MODES.EQUILIBRIUM;
  const cellsVec = modeKey === 'acoustic'
    ? [5, 2, 2]
    : (modeKey === 'thermal' ? [4, 2, 2] : null);
  const vacuumZFactor = modeKey === 'surface' ? 2.5 : 1.0;

  if (activeSpecimenKind === 'compound' && currentCompoundRes?.visualData?.mdConfig) {
    const cfg = currentCompoundRes.visualData.mdConfig;
    const b = currentCompoundRes.bundle;
    const tMelt = Math.max(20, Number(b.thermodynamic.meltingPointK || 300));
    const defaultFrac = modeKey === 'shear' ? 1.25 : (modeKey === 'strain' || modeKey === 'acoustic' ? 0.25 : 0.70);
    const tTarget = overrideTempK ?? Math.max(20, Math.min(2400, defaultFrac * tMelt));
    uiState.mdTargetTempK = Math.round(tTarget);
    const init = buildCrystalMdState({
      crystalStructure: cfg.crystalStructure,
      cellsPerSide: 2,
      cellsVec,
      vacuumZFactor,
      latticeConstantA: cfg.latticeConstantA,
      massU: cfg.massU,
      temperatureK: tTarget
    });
    liveMdSession = createMolecularDynamicsSessionWebGpu(gpuDevice, {
      ...init,
      potentialModel: cfg.potentialModel,
      epsilonEv: cfg.epsilonEv,
      sigmaOrR0A: cfg.sigmaOrR0A,
      alphaOrLambda: cfg.alphaOrLambda,
      rcutA: cfg.rcutA,
      eamAEv: cfg.eamAEv,
      eamBeta: cfg.eamBeta,
      dtFs: cfg.dtFs,
      targetTemperatureK: tTarget,
      thermostatCouplingFs: 35
    });
    liveMdConfigMeta = {
      label: b.materialKey,
      crystalStructure: cfg.crystalStructure,
      modelName: cfg.modelName,
      rcutA: cfg.rcutA,
      dtFs: cfg.dtFs,
      meltingPointK: tMelt
    };
    liveMdTelemetry = currentCompoundRes.visualData.mdTelemetry;
  } else if (currentElementRes?.visualData?.thermo?.potential) {
    const bulk = currentElementRes.visualData.bulk;
    const pot = currentElementRes.visualData.thermo.potential;
    const b = currentElementRes.bundle;
    const massU = Math.max(1, Number(b.nuclear.atomicMassU || 28));
    const tMelt = Math.max(20, Number(b.thermodynamic.meltingPointK || 600));
    const defaultFrac = modeKey === 'shear' ? 1.25 : (modeKey === 'strain' || modeKey === 'acoustic' ? 0.25 : 0.70);
    const tTarget = overrideTempK ?? Math.max(30, Math.min(2200, defaultFrac * tMelt));
    uiState.mdTargetTempK = Math.round(tTarget);
    const dtFs = Math.min(2.0, Math.max(0.45, 0.09 * Math.sqrt(massU)));
    const init = buildCrystalMdState({
      crystalStructure: bulk.crystalStructure,
      cellsPerSide: modeKey === 'surface' ? 2 : 3,
      cellsVec,
      vacuumZFactor,
      latticeConstantA: Math.max(2.4, Number(bulk.latticeConstantA || 3.6)),
      massU,
      temperatureK: tTarget
    });
    liveMdSession = createMolecularDynamicsSessionWebGpu(gpuDevice, {
      ...init,
      potentialModel: pot.potentialModel,
      epsilonEv: pot.epsilonEv,
      sigmaOrR0A: pot.sigmaOrR0A,
      alphaOrLambda: pot.alphaOrLambda,
      rcutA: pot.rcutA,
      eamAEv: pot.eamAEv,
      eamBeta: pot.eamBeta,
      swGamma: pot.swGamma,
      dtFs,
      targetTemperatureK: tTarget,
      thermostatCouplingFs: 35
    });
    liveMdConfigMeta = {
      label: b.nuclear.isotope || b.symbol,
      crystalStructure: bulk.crystalStructure,
      modelName: pot.modelName,
      rcutA: pot.rcutA,
      dtFs,
      meltingPointK: tMelt
    };
    liveMdTelemetry = currentElementRes.visualData.thermo.mdTelemetry;
  }
  if (liveMdSession) {
    liveMdSession.setExperimentMode(modeCode, {
      shearWallVel: modeKey === 'shear' ? 0.14 : 0.0,
      thermalDeltaT: modeKey === 'thermal' ? Math.max(40, Math.round(uiState.mdTargetTempK * 0.40)) : 0.0
    });
    if (modeKey === 'acoustic') {
      liveMdSession.injectAcousticPulse({ polarization: 'longitudinal', amplitude: 0.34 });
    }
  }
  if (liveMdTelemetry) {
    liveMdHistory.push({ t: 0, T: liveMdTelemetry.temperatureK, msd: liveMdTelemetry.msdA2 });
  }
}

// ============================================================================
// Contextual Live Simulation Control Bar (MoonLab-Grade per Tab!)
// ============================================================================

function renderSimControls() {
  if (!simControls) return;
  const b = getActiveBundle();

  if (currentTab === 'nuclear') {
    const isEl = activeSpecimenKind === 'element';
    simControls.innerHTML = `
      <div class="ctrl-group">
        <button class="action${uiState.nuclearViewMode === 'tdse' ? ' active-toggle' : ''}" data-nview="tdse">Fermi + TDSE</button>
        ${isEl ? `<button class="action${uiState.nuclearViewMode === 'fission' ? ' active-toggle' : ''}" data-nview="fission" title="Live 3D GPU Bohr-Wheeler quadrupole/necking liquid-drop fission!">3D Fission Saddle</button>` : ''}
        ${isEl ? `<button class="action${uiState.nuclearViewMode === 'bateman' ? ' active-toggle' : ''}" data-nview="bateman">Bateman Decay</button>` : ''}
      </div>
      ${uiState.nuclearViewMode === 'fission' && isEl ? `
        <div class="ctrl-group">
          <label>β₂=<b id="lbl-fiss-b2">${uiState.fissionBeta2.toFixed(2)}</b></label>
          <input id="ctrl-fiss-b2" type="range" min="0" max="1.35" step="0.03" value="${uiState.fissionBeta2}" style="width:96px;" />
          <button id="ctrl-fiss-play" class="action gold-btn">${uiState.fissionPlaying ? 'Pause' : 'Play Fission'}</button>
          <button id="ctrl-fiss-saddle" class="action">Saddle β*</button>
        </div>` : `
        <div class="ctrl-group">
          <button id="ctrl-tdse-play" class="action">${uiState.tdsePlaying ? 'Pause TDSE' : 'Play TDSE'}</button>
          <button id="ctrl-tdse-reset" class="action">Reset α-Wavepacket</button>
        </div>`}`;
    for (const btn of simControls.querySelectorAll('[data-nview]')) {
      btn.addEventListener('click', () => {
        uiState.nuclearViewMode = btn.dataset.nview;
        if (uiState.nuclearViewMode === 'fission') updateNuclearFissionVolume();
        renderSimControls();
        redrawCurrentTab();
      });
    }
    document.getElementById('ctrl-fiss-b2')?.addEventListener('input', (e) => {
      uiState.fissionBeta2 = Number(e.target.value);
      document.getElementById('lbl-fiss-b2').textContent = uiState.fissionBeta2.toFixed(2);
      updateNuclearFissionVolume();
      redrawCurrentTab();
    });
    document.getElementById('ctrl-fiss-play')?.addEventListener('click', () => {
      uiState.fissionPlaying = !uiState.fissionPlaying;
      renderSimControls();
    });
    document.getElementById('ctrl-fiss-saddle')?.addEventListener('click', () => {
      uiState.fissionBeta2 = liveFissionCurve?.saddleBeta ?? 0.72;
      uiState.fissionPlaying = false;
      updateNuclearFissionVolume();
      renderSimControls();
      redrawCurrentTab();
    });
    document.getElementById('ctrl-tdse-play')?.addEventListener('click', () => {
      uiState.tdsePlaying = !uiState.tdsePlaying;
      renderSimControls();
    });
    document.getElementById('ctrl-tdse-reset')?.addEventListener('click', () => {
      liveTdseSession?.resetWavepacket();
      redrawCurrentTab();
    });
  } else if (currentTab === 'atomic') {
    if (activeSpecimenKind === 'compound' && currentCompoundRes?.visualData?.molQm) {
      simControls.innerHTML = `
        <div class="ctrl-group">
          <label>Molecular Orbital</label>
          <button class="action${uiState.molOrbitalMode === 0 ? ' active-toggle' : ''}" data-mol-mode="0">Total ρ(r)</button>
          <button class="action${uiState.molOrbitalMode === 1 ? ' active-toggle' : ''}" data-mol-mode="1">HOMO</button>
          <button class="action${uiState.molOrbitalMode === 2 ? ' active-toggle' : ''}" data-mol-mode="2">LUMO</button>
        </div>
        <div class="ctrl-group">
          <label>Render</label>
          <button class="action${uiState.atomicViewMode === 'cloud' ? ' active-toggle' : ''}" data-aview="cloud">3D Point Cloud</button>
          <button class="action${uiState.atomicViewMode === 'volume' ? ' active-toggle' : ''}" data-aview="volume">Volumetric</button>
        </div>
        <div class="ctrl-group">
          <label><input id="ctrl-guides" type="checkbox" ${uiState.showGuides ? 'checked' : ''} /> Grid+Axes</label>
          <button id="ctrl-rotate" class="action${uiState.autoRotate ? ' active-toggle' : ''}">${uiState.autoRotate ? 'Pause Rot' : 'Rotate'}</button>
        </div>`;
      for (const btn of simControls.querySelectorAll('[data-mol-mode]')) {
        btn.addEventListener('click', () => {
          uiState.molOrbitalMode = Number(btn.dataset.molMode);
          rebuildOrbitalPointCloud();
          renderSimControls();
          redrawCurrentTab();
        });
      }
    } else {
      const lOpts = Array.from({ length: uiState.n }, (_, i) =>
        `<option value="${i}" ${i === uiState.l ? 'selected' : ''}>l=${i} (${L_NAMES[i] || i})</option>`
      ).join('');
      const mOpts = Array.from({ length: 2 * uiState.l + 1 }, (_, i) => {
        const mv = i - uiState.l;
        return `<option value="${mv}" ${mv === uiState.m ? 'selected' : ''}>m=${mv}</option>`;
      }).join('');
      simControls.innerHTML = `
        <div class="ctrl-group">
          <label>n=<b id="lbl-n">${uiState.n}</b></label>
          <input id="ctrl-n" type="range" min="1" max="7" value="${uiState.n}" style="width:58px;" />
          <select id="ctrl-l">${lOpts}</select>
          <select id="ctrl-m">${mOpts}</select>
          <button id="ctrl-valence" class="action" title="Snap to active atom valence subshell">Valence</button>
          <button id="ctrl-rand-nlm" class="action" title="Random Element + (n, l, m)">Rand</button>
        </div>
        <div class="ctrl-group">
          <label>XC</label>
          <select id="ctrl-xc" title="Re-solve GPU Kohn-Sham with PBE GGA, LDA, or Bare Nucleus">
            <option value="pbe" ${uiState.functional === 'pbe' ? 'selected' : ''}>PBE GGA</option>
            <option value="lda" ${uiState.functional === 'lda' ? 'selected' : ''}>LDA</option>
            <option value="bare" ${uiState.functional === 'bare' ? 'selected' : ''}>Bare Z</option>
          </select>
          <label title="Koelling-Harmon Relativistic + Spin-Orbit (live GPU re-solve!)">
            <input id="ctrl-rel" type="checkbox" ${uiState.relativisticSpinOrbit ? 'checked' : ''} /> Relativistic+SO
          </label>
        </div>
        <div class="ctrl-group">
          <label>Pts <b id="lbl-pts">${Math.round(uiState.pointCount / 1000)}K</b></label>
          <input id="ctrl-pts" type="range" min="50000" max="500000" step="25000" value="${uiState.pointCount}" style="width:66px;" />
          <label>Size</label>
          <input id="ctrl-psize" type="range" min="0.006" max="0.045" step="0.002" value="${uiState.pointSize}" style="width:50px;" />
          <label>Opac</label>
          <input id="ctrl-opac" type="range" min="0.08" max="0.80" step="0.04" value="${uiState.opacity}" style="width:50px;" />
        </div>
        <div class="ctrl-group">
          <select id="ctrl-cmode" title="Shell color alternation mode">
            <option value="0" ${uiState.colorMode === 0 ? 'selected' : ''}>Radial Shells</option>
            <option value="1" ${uiState.colorMode === 1 ? 'selected' : ''}>±ψ Phase</option>
          </select>
          <input id="ctrl-col-a" type="color" value="${uiState.shellColorA}" title="Color A" />
          <input id="ctrl-col-b" type="color" value="${uiState.shellColorB}" title="Color B" />
          <label><input id="ctrl-guides" type="checkbox" ${uiState.showGuides ? 'checked' : ''} /> Grid</label>
          <button class="action${uiState.atomicViewMode === 'cloud' ? ' active-toggle' : ''}" data-aview="cloud">Cloud</button>
          <button class="action${uiState.atomicViewMode === 'volume' ? ' active-toggle' : ''}" data-aview="volume">Vol</button>
          <button id="ctrl-regen" class="action">Resample</button>
          <button id="ctrl-rotate" class="action${uiState.autoRotate ? ' active-toggle' : ''}">${uiState.autoRotate ? 'Pause' : 'Rotate'}</button>
        </div>
        <div class="ctrl-group">
          <label title="Apply static electric field E to measure polarizability alpha_0 & Stark dipole shift">Stark E=<b id="lbl-stark">${uiState.starkFieldVPerA.toFixed(1)}</b> V/Å</label>
          <input id="ctrl-stark" type="range" min="-5" max="5" step="0.5" value="${uiState.starkFieldVPerA}" style="width:76px;" />
          <button id="ctrl-ionize" class="action${uiState.ionizedCation ? ' active-toggle' : ''}" title="Remove 1 valence electron and re-solve GPU Dirac-KS cation (Delta-SCF I_1)">${uiState.ionizedCation ? 'Cation +1 (ΔSCF ON)' : 'Ionize −1e⁻ (ΔSCF)'}</button>
        </div>`;

      document.getElementById('ctrl-n')?.addEventListener('input', (e) => {
        uiState.n = Number(e.target.value);
        uiState.l = Math.min(uiState.l, uiState.n - 1);
        uiState.m = Math.max(-uiState.l, Math.min(uiState.l, uiState.m));
        rebuildOrbitalPointCloud();
        renderSimControls();
        redrawCurrentTab();
      });
      document.getElementById('ctrl-l')?.addEventListener('change', (e) => {
        uiState.l = Number(e.target.value);
        uiState.m = Math.max(-uiState.l, Math.min(uiState.l, uiState.m));
        rebuildOrbitalPointCloud();
        renderSimControls();
        redrawCurrentTab();
      });
      document.getElementById('ctrl-m')?.addEventListener('change', (e) => {
        uiState.m = Number(e.target.value);
        rebuildOrbitalPointCloud();
        redrawCurrentTab();
      });
      document.getElementById('ctrl-valence')?.addEventListener('click', () => {
        const def = defaultValenceQuantumNumbers(selectedZ);
        uiState.n = def.n; uiState.l = def.l; uiState.m = def.m;
        rebuildOrbitalPointCloud();
        renderSimControls();
        redrawCurrentTab();
      });
      document.getElementById('ctrl-rand-nlm')?.addEventListener('click', () => {
        const rz = 1 + Math.floor(Math.random() * 92);
        const rn = 2 + Math.floor(Math.random() * 5);
        const rl = Math.floor(Math.random() * rn);
        const rm = Math.floor(Math.random() * (2 * rl + 1)) - rl;
        selectedZ = rz; selectedA = null;
        zInput.value = String(rz);
        uiState.n = rn; uiState.l = rl; uiState.m = rm;
        runElementDerivation(rz, null, { preserveQuantumNumbers: true });
      });
      document.getElementById('ctrl-xc')?.addEventListener('change', (e) => {
        uiState.functional = e.target.value;
        runElementDerivation(selectedZ, selectedA, { preserveQuantumNumbers: true });
      });
      document.getElementById('ctrl-rel')?.addEventListener('change', (e) => {
        uiState.relativisticSpinOrbit = Boolean(e.target.checked);
        runElementDerivation(selectedZ, selectedA, { preserveQuantumNumbers: true });
      });
      document.getElementById('ctrl-pts')?.addEventListener('change', (e) => {
        uiState.pointCount = Number(e.target.value);
        document.getElementById('lbl-pts').textContent = `${Math.round(uiState.pointCount / 1000)}K`;
        rebuildOrbitalPointCloud();
        redrawCurrentTab();
      });
      document.getElementById('ctrl-psize')?.addEventListener('input', (e) => {
        uiState.pointSize = Number(e.target.value);
        renderViewportSync();
      });
      document.getElementById('ctrl-opac')?.addEventListener('input', (e) => {
        uiState.opacity = Number(e.target.value);
        renderViewportSync();
      });
      document.getElementById('ctrl-cmode')?.addEventListener('change', (e) => {
        uiState.colorMode = Number(e.target.value);
        rebuildOrbitalPointCloud();
        renderViewportSync();
      });
      document.getElementById('ctrl-col-a')?.addEventListener('input', (e) => {
        uiState.shellColorA = e.target.value;
        renderViewportSync();
      });
      document.getElementById('ctrl-col-b')?.addEventListener('input', (e) => {
        uiState.shellColorB = e.target.value;
        renderViewportSync();
      });
      document.getElementById('ctrl-regen')?.addEventListener('click', () => {
        uiState.cloudSeed += 1;
        rebuildOrbitalPointCloud();
        renderViewportSync();
      });
      document.getElementById('ctrl-stark')?.addEventListener('input', (e) => {
        uiState.starkFieldVPerA = Number(e.target.value);
        document.getElementById('lbl-stark').textContent = uiState.starkFieldVPerA.toFixed(1);
        updateStarkStateForActiveElement();
        redrawCurrentTab();
      });
      document.getElementById('ctrl-ionize')?.addEventListener('click', () => {
        toggleDeltaScfIonization(!uiState.ionizedCation);
      });
    }
    for (const btn of simControls.querySelectorAll('[data-aview]')) {
      btn.addEventListener('click', () => {
        uiState.atomicViewMode = btn.dataset.aview;
        renderSimControls();
        redrawCurrentTab();
      });
    }
    document.getElementById('ctrl-guides')?.addEventListener('change', (e) => {
      uiState.showGuides = Boolean(e.target.checked);
      renderViewportSync();
    });
    document.getElementById('ctrl-rotate')?.addEventListener('click', () => {
      uiState.autoRotate = !uiState.autoRotate;
      renderSimControls();
    });
  } else if (currentTab === 'crystal') {
    const isElement = activeSpecimenKind === 'element';
    const em = getActiveElectromagnetic();
    const tcMag = Math.max(100, Math.round(Number(em?.curieOrNeelTempK) || 400));
    const spinTMax = Math.max(1200, Math.round(tcMag * 2.2));
    const tcSup = Number(em?.superconductingTcK) || 0;
    const isOptics = uiState.crystalViewMode === 'tdks-atom' || uiState.crystalViewMode === 'photon-shell';
    const isSpin = uiState.crystalViewMode === 'spin-llg';
    const isTrans = uiState.crystalViewMode === 'transport';

    simControls.innerHTML = `
      <div class="ctrl-group">
        <button class="action${uiState.crystalViewMode === 'photon-shell' ? ' active-toggle' : ''}" data-cview="photon-shell">2D Maxwell Slab (Snell)</button>
        ${isElement ? `<button class="action${uiState.crystalViewMode === 'bloch' ? ' active-toggle' : ''}" data-cview="bloch">3D Bloch + Fermi</button>` : ''}
        <button class="action${uiState.crystalViewMode === 'lattice' ? ' active-toggle' : ''}" data-cview="lattice">Crystal Cell</button>
        <button class="action${uiState.crystalViewMode === 'tdks-atom' ? ' active-toggle' : ''}" data-cview="tdks-atom">Atom TD-KS Cloud↔Photon</button>
        <button class="action${isSpin ? ' active-toggle' : ''}" data-cview="spin-llg" title="3D WebGPU Stochastic LLG Spin-Lattice: ferromagnetism, Curie T_C, hysteresis M(B) & Neel AFM!">3D Spin Lattice (LLG)</button>
        <button class="action${isTrans ? ' active-toggle' : ''}" data-cview="transport" title="3D WebGPU Drude-Boltzmann electron-phonon scattering, semiconductor activation & BCS T_c!">e⁻ Conduction / T_c</button>
      </div>
      ${isOptics ? `
      <div class="ctrl-group">
        <button id="ctrl-ps-rgb" class="action${!uiState.photonModeMono ? ' active-toggle' : ''}">White Light (RGB)</button>
        <button id="ctrl-ps-mono" class="action${uiState.photonModeMono ? ' active-toggle' : ''}">Single λ</button>
        <label>λ=<b id="lbl-lambda">${uiState.probeWavelengthNm}</b>nm</label>
        <input id="ctrl-lambda" type="range" min="380" max="780" step="10" value="${uiState.probeWavelengthNm}" style="width:72px;" />
      </div>
      <div class="ctrl-group">
        <button id="ctrl-ps-fire" class="action gold-btn">Fire Pulse</button>
        <button id="ctrl-ps-play" class="action">${uiState.photonPlaying ? 'Pause' : 'Play'}</button>
        ${isElement ? `<label><input id="ctrl-ps-rel" type="checkbox" ${uiState.relativisticSpinOrbit ? 'checked' : ''} /> Relativistic (Au Color!)</label>` : ''}
      </div>` : ''}
      ${isSpin ? `
      <div class="ctrl-group">
        <label>T=<b id="lbl-spin-t">${Math.round(uiState.spinTempK)}</b>K${tcMag > 0 && em?.curieOrNeelTempK > 0 ? ` (T_c=${Math.round(em.curieOrNeelTempK)}K)` : ''}</label>
        <input id="ctrl-spin-t" type="range" min="10" max="${spinTMax}" step="10" value="${Math.min(spinTMax, Math.round(uiState.spinTempK))}" style="width:88px;" />
        <label>B_z=<b id="lbl-spin-b">${uiState.spinFieldBTesla.toFixed(1)}</b>T</label>
        <input id="ctrl-spin-b" type="range" min="-5" max="5" step="0.2" value="${uiState.spinFieldBTesla}" style="width:82px;" />
      </div>
      <div class="ctrl-group">
        <button id="ctrl-spin-sweep" class="action${uiState.spinSweepB ? ' active-toggle' : ' gold-btn'}">${uiState.spinSweepB ? 'Stop Sweep' : 'Sweep Hysteresis B'}</button>
        <button id="ctrl-spin-hot" class="action">Heat &gt; T_c</button>
        <button id="ctrl-spin-reset" class="action">Randomize</button>
      </div>` : ''}
      ${isTrans ? `
      <div class="ctrl-group">
        <label>T=<b id="lbl-tr-t">${uiState.transportTempK < 20 ? uiState.transportTempK.toFixed(1) : Math.round(uiState.transportTempK)}</b>K${tcSup > 0.1 ? ` (T_c=${tcSup.toFixed(1)}K)` : ''}</label>
        <input id="ctrl-tr-t" type="range" min="1" max="1200" step="1" value="${Math.min(1200, Math.round(uiState.transportTempK))}" style="width:90px;" />
        <label>E=<b id="lbl-tr-e">${(uiState.transportEFieldVPerM / 1e3).toFixed(0)}</b> kV/m</label>
        <input id="ctrl-tr-e" type="range" min="-20000" max="20000" step="2000" value="${uiState.transportEFieldVPerM}" style="width:78px;" />
      </div>
      <div class="ctrl-group">
        ${tcSup > 0.1 ? `<button id="ctrl-tr-cryo" class="action gold-btn">Cryo T&lt;T_c (${Math.max(1, tcSup * 0.35).toFixed(1)}K)</button>` : ''}
        <button class="action" data-tr-t="80">80K</button>
        <button class="action" data-tr-t="300">300K</button>
        <button class="action" data-tr-t="900">900K</button>
        <button id="ctrl-tr-play" class="action">${uiState.transportPlaying ? 'Pause' : 'Play'}</button>
      </div>` : ''}`;

    for (const btn of simControls.querySelectorAll('[data-cview]')) {
      btn.addEventListener('click', () => {
        uiState.crystalViewMode = btn.dataset.cview;
        if (uiState.crystalViewMode === 'spin-llg' && !liveSpinSession) initSpinLatticeForActiveSpecimen();
        if (uiState.crystalViewMode === 'transport' && !liveTransportSession) initElectronTransportForActiveSpecimen();
        renderSimControls();
        redrawCurrentTab();
      });
    }
    document.getElementById('ctrl-spin-t')?.addEventListener('input', (e) => {
      uiState.spinTempK = Number(e.target.value);
      document.getElementById('lbl-spin-t').textContent = String(Math.round(uiState.spinTempK));
    });
    document.getElementById('ctrl-spin-b')?.addEventListener('input', (e) => {
      uiState.spinFieldBTesla = Number(e.target.value);
      uiState.spinSweepB = false;
      document.getElementById('lbl-spin-b').textContent = uiState.spinFieldBTesla.toFixed(1);
    });
    document.getElementById('ctrl-spin-sweep')?.addEventListener('click', () => {
      uiState.spinSweepB = !uiState.spinSweepB;
      if (uiState.spinSweepB) liveSpinHistory = [];
      renderSimControls();
    });
    document.getElementById('ctrl-spin-hot')?.addEventListener('click', () => {
      uiState.spinTempK = Math.min(spinTMax, Math.round(Math.max(600, tcMag * 1.55)));
      uiState.spinFieldBTesla = 0.0;
      uiState.spinSweepB = false;
      renderSimControls();
    });
    document.getElementById('ctrl-spin-reset')?.addEventListener('click', () => {
      liveSpinSession?.resetDomains({ orderedBias: 0.0, initSeed: Math.floor(Math.random() * 1e6) + 1 });
      liveSpinHistory = [];
      redrawCurrentTab();
    });
    document.getElementById('ctrl-tr-t')?.addEventListener('input', (e) => {
      uiState.transportTempK = Number(e.target.value);
      document.getElementById('lbl-tr-t').textContent = String(Math.round(uiState.transportTempK));
    });
    document.getElementById('ctrl-tr-e')?.addEventListener('input', (e) => {
      uiState.transportEFieldVPerM = Number(e.target.value);
      document.getElementById('lbl-tr-e').textContent = (uiState.transportEFieldVPerM / 1e3).toFixed(0);
    });
    document.getElementById('ctrl-tr-cryo')?.addEventListener('click', () => {
      uiState.transportTempK = Math.max(0.5, Number((tcSup * 0.35).toFixed(1)));
      renderSimControls();
    });
    for (const btn of simControls.querySelectorAll('[data-tr-t]')) {
      btn.addEventListener('click', () => {
        uiState.transportTempK = Number(btn.dataset.trT);
        renderSimControls();
      });
    }
    document.getElementById('ctrl-tr-play')?.addEventListener('click', () => {
      uiState.transportPlaying = !uiState.transportPlaying;
      renderSimControls();
    });
    document.getElementById('ctrl-ps-rgb')?.addEventListener('click', () => {
      uiState.photonModeMono = false;
      renderSimControls();
      redrawCurrentTab();
    });
    document.getElementById('ctrl-ps-mono')?.addEventListener('click', () => {
      uiState.photonModeMono = true;
      renderSimControls();
      redrawCurrentTab();
    });
    document.getElementById('ctrl-lambda')?.addEventListener('input', (e) => {
      uiState.probeWavelengthNm = Number(e.target.value);
      document.getElementById('lbl-lambda').textContent = String(uiState.probeWavelengthNm);
      uiState.photonModeMono = true;
      liveBlochSession?.reset(uiState.probeWavelengthNm);
      for (let k = 0; k < 35; k += 1) liveBlochSession?.stepFs(0.08);
      livePhotonSession?.reset(null, { nextProbeWavelengthNm: uiState.probeWavelengthNm });
      livePhotonSession?.stepSync(100);
      renderSimControls();
      redrawCurrentTab();
    });
    document.getElementById('ctrl-ps-fire')?.addEventListener('click', () => {
      liveBlochSession?.reset(uiState.probeWavelengthNm);
      livePhotonSession?.reset(null, { nextProbeWavelengthNm: uiState.probeWavelengthNm });
      livePhotonSession?.stepSync(60);
      uiState.photonPlaying = true;
      renderSimControls();
      redrawCurrentTab();
    });
    document.getElementById('ctrl-ps-play')?.addEventListener('click', () => {
      uiState.photonPlaying = !uiState.photonPlaying;
      renderSimControls();
    });
    document.getElementById('ctrl-ps-rel')?.addEventListener('change', (e) => {
      uiState.relativisticSpinOrbit = Boolean(e.target.checked);
      runElementDerivation(selectedZ, selectedA, { preserveQuantumNumbers: true });
    });
  } else if (currentTab === 'md') {
    const tMelt = Math.max(20, Math.round(liveMdConfigMeta?.meltingPointK || b?.thermodynamic?.meltingPointK || 600));
    const tMax = Math.max(1500, Math.min(8000, Math.round(tMelt * 3.0)));
    const mm = uiState.mdMode;
    simControls.innerHTML = `
      <div class="ctrl-group">
        <button class="action${mm === 'equilibrium' ? ' active-toggle' : ''}" data-mdmode="equilibrium">Equil + Phonons</button>
        <button class="action${mm === 'strain' ? ' active-toggle' : ''}" data-mdmode="strain">Stress–Strain (K,G,ν)</button>
        <button class="action${mm === 'acoustic' ? ' active-toggle' : ''}" data-mdmode="acoustic">Acoustic (v_L,v_T)</button>
        <button class="action${mm === 'shear' ? ' active-toggle' : ''}" data-mdmode="shear">Shear Viscosity (η)</button>
        <button class="action${mm === 'thermal' ? ' active-toggle' : ''}" data-mdmode="thermal">Heat Flow (κ)</button>
        <button class="action${mm === 'surface' ? ' active-toggle' : ''}" data-mdmode="surface">Free Surface (γ)</button>
      </div>
      <div class="ctrl-group">
        <label>T=<b id="lbl-md-t">${uiState.mdTargetTempK}</b>K (T_m=${tMelt}K)</label>
        <input id="ctrl-md-t" type="range" min="15" max="${tMax}" step="10" value="${Math.min(tMax, uiState.mdTargetTempK)}" style="width:92px;" />
        ${mm === 'equilibrium' ? `<label><input id="ctrl-md-npt" type="checkbox" ${uiState.mdNptBarostat ? 'checked' : ''} /> NPT α_V</label>` : ''}
      </div>
      ${mm === 'strain' ? `
      <div class="ctrl-group">
        <button id="ctrl-md-comp" class="action gold-btn">Compress −3%</button>
        <button id="ctrl-md-stretch" class="action">Stretch +3%</button>
        <button id="ctrl-md-shear" class="action">Shear γ_xy +4%</button>
        <button id="ctrl-md-reset" class="action">Reset</button>
      </div>` : mm === 'acoustic' ? `
      <div class="ctrl-group">
        <button id="ctrl-md-pwave" class="action gold-btn">Fire P-Wave (v_L)</button>
        <button id="ctrl-md-swave" class="action">Fire S-Wave (v_T)</button>
        <button id="ctrl-md-reset" class="action">Reset Bar</button>
      </div>` : `
      <div class="ctrl-group">
        <button class="action" data-md-frac="0.30">Solid</button>
        <button class="action gold-btn" data-md-frac="1.20">Melt</button>
        <button class="action" data-md-frac="2.40">Vapor</button>
        <button id="ctrl-md-play" class="action">${uiState.mdPlaying ? 'Pause' : 'Play'}</button>
        <button id="ctrl-md-reset" class="action">Reset</button>
      </div>`}`;

    for (const btn of simControls.querySelectorAll('[data-mdmode]')) {
      btn.addEventListener('click', () => {
        initLiveMdForActiveSpecimen(null, btn.dataset.mdmode);
        renderSimControls();
        redrawCurrentTab();
      });
    }
    document.getElementById('ctrl-md-t')?.addEventListener('input', (e) => {
      uiState.mdTargetTempK = Number(e.target.value);
      document.getElementById('lbl-md-t').textContent = String(uiState.mdTargetTempK);
    });
    document.getElementById('ctrl-md-npt')?.addEventListener('change', (e) => {
      uiState.mdNptBarostat = Boolean(e.target.checked);
    });
    document.getElementById('ctrl-md-comp')?.addEventListener('click', () => {
      liveMdSession?.applyStrain({ strainX: -0.03 });
    });
    document.getElementById('ctrl-md-stretch')?.addEventListener('click', () => {
      liveMdSession?.applyStrain({ strainX: 0.03 });
    });
    document.getElementById('ctrl-md-shear')?.addEventListener('click', () => {
      liveMdSession?.applyStrain({ shearXY: 0.04 });
    });
    document.getElementById('ctrl-md-pwave')?.addEventListener('click', () => {
      liveMdSession?.injectAcousticPulse({ polarization: 'longitudinal', amplitude: 0.36 });
    });
    document.getElementById('ctrl-md-swave')?.addEventListener('click', () => {
      liveMdSession?.injectAcousticPulse({ polarization: 'transverse', amplitude: 0.36 });
    });
    for (const btn of simControls.querySelectorAll('[data-md-frac]')) {
      btn.addEventListener('click', () => {
        const frac = Number(btn.dataset.mdFrac);
        uiState.mdTargetTempK = Math.max(15, Math.min(tMax, Math.round(tMelt * frac)));
        document.getElementById('lbl-md-t').textContent = String(uiState.mdTargetTempK);
        const sl = document.getElementById('ctrl-md-t');
        if (sl) sl.value = String(uiState.mdTargetTempK);
      });
    }
    document.getElementById('ctrl-md-play')?.addEventListener('click', () => {
      uiState.mdPlaying = !uiState.mdPlaying;
      renderSimControls();
    });
    document.getElementById('ctrl-md-reset')?.addEventListener('click', () => {
      initLiveMdForActiveSpecimen(uiState.mdTargetTempK, uiState.mdMode);
      renderSimControls();
      redrawCurrentTab();
    });
  } else if (currentTab === 'compound') {
    const nImgs = currentNebBarrier?.energiesEv?.length || 0;
    const formula = currentCompoundRes?.bundle?.materialKey || compoundInput.value || 'H2O';
    simControls.innerHTML = `
      ${nImgs >= 2 ? `<div class="ctrl-group">
        <label>CI-NEB ξ=<b id="lbl-neb-xi">${(uiState.nebImageIdx / Math.max(1, nImgs - 1)).toFixed(2)}</b> (Img #${uiState.nebImageIdx}/${nImgs - 1}${uiState.nebImageIdx === currentNebBarrier.saddleImageIndex ? ' ‡ TS' : ''})</label>
        <input id="ctrl-neb-xi" type="range" min="0" max="${nImgs - 1}" step="1" value="${uiState.nebImageIdx}" style="width:96px;" />
        <button id="ctrl-neb-play" class="action">${uiState.nebPlaying ? 'Pause MEP' : 'Play Reaction Path'}</button>
      </div>` : ''}
      <div class="ctrl-group">
        <label>Orbital</label>
        <button class="action${uiState.molOrbitalMode === 0 ? ' active-toggle' : ''}" data-c-mol="0">Total ρ</button>
        <button class="action${uiState.molOrbitalMode === 1 ? ' active-toggle' : ''}" data-c-mol="1">HOMO</button>
        <button class="action${uiState.molOrbitalMode === 2 ? ' active-toggle' : ''}" data-c-mol="2">LUMO</button>
      </div>
      ${currentCompoundRes ? `<div class="ctrl-group">
        <button id="ctrl-backfeed-now" class="action gold-btn">Backfeed ${formula} → All Property, Optics, MD &amp; Polytope Sims</button>
      </div>` : ''}`;

    document.getElementById('ctrl-neb-xi')?.addEventListener('input', (e) => {
      uiState.nebImageIdx = Number(e.target.value);
      uiState.nebPlaying = false;
      renderSimControls();
      redrawCurrentTab();
    });
    document.getElementById('ctrl-neb-play')?.addEventListener('click', () => {
      uiState.nebPlaying = !uiState.nebPlaying;
      renderSimControls();
    });
    for (const btn of simControls.querySelectorAll('[data-c-mol]')) {
      btn.addEventListener('click', () => {
        uiState.molOrbitalMode = Number(btn.dataset.cMol);
        rebuildOrbitalPointCloud();
        rebuildNebImageClouds();
        renderSimControls();
        redrawCurrentTab();
      });
    }
    document.getElementById('ctrl-backfeed-now')?.addEventListener('click', () => {
      activateCompoundBackfeed(currentCompoundRes, 'crystal');
    });
  } else if (currentTab === 'polytope') {
    simControls.innerHTML = `
      <div class="ctrl-group">
        <label>Pressure Domain</label>
        <button id="ctrl-poly-lab" class="action${uiState.polytopeRegime === 'lab' ? ' active-toggle' : ''}">Lab (10 GPa)</button>
        <button id="ctrl-poly-plan" class="action${uiState.polytopeRegime === 'planetary' ? ' active-toggle' : ''}">Planetary Core (1 TPa)</button>
      </div>
      <div class="ctrl-group">
        <label>Hover or click anywhere on the GPU phase diagram to run live <code>eval_polytope_atlas_2d</code> (incl. hatched fail-closed outer border!)</label>
      </div>`;
    document.getElementById('ctrl-poly-lab')?.addEventListener('click', () => rebuildPolytopeAtlasForRegime('lab'));
    document.getElementById('ctrl-poly-plan')?.addEventListener('click', () => rebuildPolytopeAtlasForRegime('planetary'));
  }
}

// ============================================================================
// Synchronous WebGPU Viewport Render + Tab Redraw
// ============================================================================

function renderViewportSync() {
  if (!gpuRenderer) return;

  if (currentTab === 'nuclear') {
    if (activeSpecimenKind === 'compound' && currentCompoundNuclearVolGpu) {
      gpuRenderer.renderVolume3D({
        gpuVec4Buffer: currentCompoundNuclearVolGpu.buffer,
        dim: currentCompoundNuclearVolGpu.dim,
        channels: 4,
        yaw: camYaw,
        pitch: camPitch,
        tint: [1.0, 0.58, 0.30]
      });
    } else if (uiState.nuclearViewMode === 'fission' && liveFissionVolGpu) {
      gpuRenderer.renderVolume3D({
        gpuVec4Buffer: liveFissionVolGpu.buffer,
        dim: liveFissionVolGpu.dim,
        channels: 4,
        yaw: camYaw,
        pitch: camPitch,
        tint: [1.0, 0.62, 0.34]
      });
    } else if (currentElementRes?.visualData?.nuclear) {
      const nuc = currentElementRes.visualData.nuclear;
      gpuRenderer.renderVolume3D({
        vec4Data: nuc.volumeData,
        dim: nuc.volDim,
        channels: 4,
        yaw: camYaw,
        pitch: camPitch,
        tint: [1.0, 0.62, 0.34]
      });
    }
  } else if (currentTab === 'atomic') {
    if (activeSpecimenKind === 'compound' && currentCompoundRes?.visualData?.molQm) {
      if (uiState.atomicViewMode === 'cloud' && liveMolOrbitalCloud) {
        gpuRenderer.renderOrbitalPointCloud({
          pointsBuffer: liveMolOrbitalCloud.pointsBuffer,
          pointCount: liveMolOrbitalCloud.pointCount,
          yaw: camYaw,
          pitch: camPitch,
          camDist,
          pointSize: uiState.pointSize * 1.15,
          opacity: Math.min(0.65, uiState.opacity * 1.4),
          alternateShellColors: true,
          colorA: [1.0, 0.65, 0.32],
          colorB: [0.36, 0.72, 1.0],
          showGuides: uiState.showGuides,
          showNucleus: false
        });
      } else {
        const mqm = currentCompoundRes.visualData.molQm;
        gpuRenderer.renderVolume3D({
          vec4Data: mqm.volumeData,
          dim: mqm.volDim,
          channels: 4,
          yaw: camYaw,
          pitch: camPitch,
          tint: [0.75, 0.52, 0.99]
        });
      }
    } else if (activeSpecimenKind === 'compound' && currentCompoundLattice) {
      gpuRenderer.renderStaticCrystalLattice({
        ...currentCompoundLattice,
        yaw: camYaw,
        pitch: camPitch,
        tint: currentCompoundRes?.bundle?.electromagnetic?.opticalSrgb || [0.75, 0.82, 0.95]
      });
    } else if (uiState.atomicViewMode === 'cloud' && liveOrbitalCloud) {
      gpuRenderer.renderOrbitalPointCloud({
        pointsBuffer: liveOrbitalCloud.pointsBuffer,
        pointCount: liveOrbitalCloud.pointCount,
        yaw: camYaw,
        pitch: camPitch,
        camDist,
        pointSize: uiState.pointSize,
        opacity: uiState.opacity,
        alternateShellColors: uiState.alternateShellColors,
        colorA: hexToRgbArr(uiState.shellColorA),
        colorB: hexToRgbArr(uiState.shellColorB),
        showGuides: uiState.showGuides,
        showNucleus: true,
        starkMixLambda: liveStarkState?.starkMixLambda ?? 0,
        eFieldNorm: (uiState.starkFieldVPerA || 0) / 5.0
      });
    } else if (currentAtomicVolGpu) {
      gpuRenderer.renderVolume3D({
        gpuVec4Buffer: currentAtomicVolGpu.buffer,
        dim: currentAtomicVolGpu.dim,
        channels: 4,
        yaw: camYaw,
        pitch: camPitch,
        tint: [0.34, 0.76, 1.0]
      });
    }
  } else if (currentTab === 'crystal') {
    const em = getActiveElectromagnetic();
    if (uiState.crystalViewMode === 'tdks-atom' && liveTdksPairCloud && liveBlochSession) {
      gpuRenderer.renderTdksPhotonCloudScene({
        pairCloud: liveTdksPairCloud,
        blochSession: liveBlochSession,
        yaw: (camYaw - 0.42) * 0.8 + 0.14,
        pitch: Math.max(-0.85, Math.min(0.85, (camPitch - 0.28) * 0.8 + 0.12)),
        camDist,
        modeMono: uiState.photonModeMono,
        probeRgb: wavelengthNmToRgb(uiState.probeWavelengthNm),
        emergentReflSrgb: livePhotonTelemetry?.emergentReflectedSrgb || em?.opticalSrgb || [0.94, 0.86, 0.65],
        pointSize: uiState.pointSize
      });
    } else if (uiState.crystalViewMode === 'photon-shell' && livePhotonSession) {
      const shellCloud = getShellBufferForPhotonScene();
      const maxShellPts = IS_MOBILE_GPU_PROFILE ? 700 : 1800;
      gpuRenderer.renderPhotonShellScene({
        photonSession: livePhotonSession,
        shellPointsBuffer: shellCloud?.pointsBuffer ?? null,
        shellPointCount: Math.min(maxShellPts, shellCloud?.pointCount || maxShellPts),
        yaw: (camYaw - 0.42) * 0.45,
        pitch: Math.max(0.25, Math.min(1.48, 1.08 + (camPitch - 0.28) * 0.6)),
        camDist: Math.max(2.2, Math.min(4.6, camDist + 0.30)),
        modeMono: uiState.photonModeMono,
        probeRgb: wavelengthNmToRgb(uiState.probeWavelengthNm),
        slabTint: em?.opticalSrgb || [0.82, 0.86, 0.94],
        waveGain: 1.05
      });
    } else if (uiState.crystalViewMode === 'spin-llg' && liveSpinSession) {
      gpuRenderer.renderSpinLatticeScene({
        spinsBuffer: liveSpinSession.getActiveSpinsBuffer(),
        dims: liveSpinSession.dims,
        yaw: camYaw,
        pitch: camPitch,
        camDist: Math.max(2.1, Math.min(5.0, camDist + 0.25)),
        fieldBZTesla: uiState.spinFieldBTesla,
        isAntiferro: liveSpinSession.params.magneticPhase === 'antiferromagnetic'
      });
    } else if (uiState.crystalViewMode === 'transport' && liveTransportSession) {
      const trP = liveTransportSession.getParams();
      gpuRenderer.renderElectronTransportScene({
        posBuffer: liveTransportSession.posBuffer,
        velBuffer: liveTransportSession.velBuffer,
        carrierCount: liveTransportSession.carrierCount,
        yaw: camYaw,
        pitch: camPitch,
        camDist,
        eFieldVPerM: uiState.transportEFieldVPerM,
        phononVibAmp: trP.phononVibAmp,
        timeS: performance.now() * 1e-3,
        isSuperconducting: trP.isSuperconducting
      });
    } else if (uiState.crystalViewMode === 'bloch' && activeSpecimenKind === 'element' && currentElementRes?.visualData?.bulk) {
      const bulk = currentElementRes.visualData.bulk;
      gpuRenderer.renderVolume3D({
        scalarData: bulk.blochDensity3d,
        dim: bulk.blochDensityGridN,
        channels: 1,
        yaw: camYaw,
        pitch: camPitch,
        tint: em?.opticalSrgb || [0.34, 0.88, 0.65],
        showFermiIso: bulk.isMetal
      });
    } else if (liveMdSession) {
      gpuRenderer.renderLiveMd({
        positionsBuffer: liveMdSession.positionsBuffer,
        velocitiesBuffer: liveMdSession.velocitiesBuffer,
        atomCount: liveMdSession.atomCount,
        boxLengthsA: liveMdSession.boxLengthsA,
        yaw: camYaw,
        pitch: camPitch,
        tint: em?.opticalSrgb || [0.65, 0.82, 0.96],
        velocityColorScale: 16.0
      });
    }
  } else if (currentTab === 'md' && liveMdSession) {
    const em = getActiveElectromagnetic();
    gpuRenderer.renderLiveMd({
      positionsBuffer: liveMdSession.positionsBuffer,
      velocitiesBuffer: liveMdSession.velocitiesBuffer,
      atomCount: liveMdSession.atomCount,
      boxLengthsA: liveMdSession.boxLengthsA,
      yaw: camYaw,
      pitch: camPitch,
      tint: em?.opticalSrgb || [0.65, 0.80, 0.96],
      velocityColorScale: 32.0
    });
  } else if (currentTab === 'compound' && currentCompoundRes) {
    const nebCloud = currentNebImageClouds[uiState.nebImageIdx] || null;
    if (nebCloud?.pointsBuffer) {
      gpuRenderer.renderOrbitalPointCloud({
        pointsBuffer: nebCloud.pointsBuffer,
        pointCount: nebCloud.pointCount,
        yaw: camYaw,
        pitch: camPitch,
        camDist,
        pointSize: 0.015,
        opacity: 0.34,
        alternateShellColors: true,
        colorA: [1.0, 0.64, 0.30],
        colorB: [0.46, 0.72, 1.0],
        showGuides: uiState.showGuides,
        showNucleus: false
      });
    } else if (liveMolOrbitalCloud?.pointsBuffer) {
      gpuRenderer.renderOrbitalPointCloud({
        pointsBuffer: liveMolOrbitalCloud.pointsBuffer,
        pointCount: liveMolOrbitalCloud.pointCount,
        yaw: camYaw,
        pitch: camPitch,
        camDist,
        pointSize: 0.015,
        opacity: 0.34,
        alternateShellColors: true,
        colorA: [1.0, 0.64, 0.30],
        colorB: [0.46, 0.72, 1.0],
        showGuides: uiState.showGuides,
        showNucleus: false
      });
    } else if (currentCompoundLattice) {
      gpuRenderer.renderStaticCrystalLattice({
        ...currentCompoundLattice,
        yaw: camYaw,
        pitch: camPitch,
        tint: currentCompoundRes.bundle.electromagnetic.opticalSrgb || [0.75, 0.82, 0.95]
      });
    }
  } else if (currentTab === 'polytope' && currentAtlas) {
    gpuRenderer.renderPolytopeAtlas(currentAtlas, uiState.polytopeProbe);
  }
}

function redrawCurrentTab() {
  if (!gpuRenderer) return;
  renderViewportSync();
  setBottomOverlay('');

  if (currentTab === 'nuclear') {
    if (activeSpecimenKind === 'compound' && currentCompoundRes) {
      const cb = currentCompoundRes.bundle;
      const sites = cb.nuclear.isotopologueSites || [];
      setHud(
        `WebGPU 3D Composite Nuclear Fermi Volume — ${cb.materialKey} (Backfed Compound)`,
        `Total Z=${cb.nuclear.totalProtonsZ} · A=${cb.nuclear.totalNucleonsA} · Molar Mass=${fmt(cb.nuclear.molarMassU, 3)} u · ΣB=${fmt(cb.nuclear.totalBindingEnergyMeV, 1)} MeV`
      );
      if (currentElementRes?.visualData?.nuclear) {
        plot1Title.textContent = 'GPU 118×200 Chart of Nuclides (Click Any Isotope)';
        drawNuclideChart(plot1, currentElementRes.visualData.nuclear);
      }
      plot2Title.textContent = `Constituent Nuclei Binding Energy B/A (${cb.materialKey})`;
      const xs = sites.map((_, i) => i);
      const bas = sites.map((s) => deriveNuclearClosure(s.Z, s.A).bindingPerNucleonMeV);
      drawPlotLine(plot2, xs.length >= 2 ? xs : [0, 1], bas.length >= 2 ? bas : [bas[0] || 0, bas[0] || 0], {
        label: `Constituent sites: ${sites.map((s) => `${symbolForZ(s.Z)}-${s.A}`).join(', ')}`, color: '#facc15', yMin: 0
      });
      plot3Title.textContent = `Constituent Nuclear Charge Radii R_rms (fm)`;
      const rads = sites.map((s) => deriveNuclearClosure(s.Z, s.A).chargeRadiusFm);
      drawPlotLine(plot3, xs.length >= 2 ? xs : [0, 1], rads.length >= 2 ? rads : [rads[0] || 0, rads[0] || 0], {
        label: 'Fermi charge radius R_rms (fm) per atomic site', color: '#ff9c54', yMin: 0
      });
    } else if (currentElementRes?.visualData?.nuclear) {
      const nuc = currentElementRes.visualData.nuclear;
      if (uiState.nuclearViewMode === 'fission' && liveFissionCurve) {
        const fc = liveFissionCurve;
        const stage = uiState.fissionBeta2 >= fc.scissionBeta ? 'SCISSION (2 FRAGMENTS)' : (uiState.fissionBeta2 >= fc.saddleBeta * 0.85 ? 'NEAR SADDLE BARRIER' : 'ELONGATING');
        setHud(
          `WebGPU 3D Bohr–Wheeler Nuclear Fission — ${nuc.isotope} (β₂=${uiState.fissionBeta2.toFixed(2)} · ${stage})`,
          `Fissility x=${fmt(fc.fissility, 3)} · Barrier E_f=${fmt(fc.barrierMeV, 2)} MeV (β*=${fmt(fc.saddleBeta, 2)}) · E_surf0=${fmt(fc.eSurf0MeV, 1)} MeV · E_coul0=${fmt(fc.eCoul0MeV, 1)} MeV`
        );
        setBottomOverlay(`<div class="live-meter">Live 3D Liquid-Drop Fission: β₂=${uiState.fissionBeta2.toFixed(2)} · Saddle β*=${fmt(fc.saddleBeta, 2)} · E_f=${fmt(fc.barrierMeV, 2)} MeV · ${stage}</div>`);
        plot1Title.textContent = 'GPU 118×200 Chart of Nuclides (Click to Pick Z, A)';
        drawNuclideChart(plot1, nuc);
        plot2Title.textContent = `Bohr–Wheeler Deformation Barrier ΔE(β₂) — ${nuc.isotope}`;
        drawPlotLine(plot2, Array.from(fc.betas), Array.from(fc.deltaEMeV), {
          label: `ΔE(β₂) MeV · Barrier E_f=${fmt(fc.barrierMeV, 1)} MeV`,
          color: '#fb923c',
          hLine: { y: 0, color: '#64748b', label: '0 MeV' },
          vLine: { x: uiState.fissionBeta2, color: '#38bdf8', label: `β=${uiState.fissionBeta2.toFixed(2)}` }
        });
      } else if (uiState.nuclearViewMode === 'bateman') {
        setHud(
          `Exact Nucleon-Conserving Bateman Decay Kinetics — ${nuc.isotope}`,
          currentDecayChain?.steps?.length
            ? `Chain: ${currentDecayChain.steps.slice(0, 4).map((s) => `${s.isotope}→${s.daughterIsotope}(${s.mode})`).join(' → ')} · Total Q=${fmt(currentDecayChain.totalEnergyMeV, 2)} MeV`
            : `${nuc.isotope} is stable (zero decay flux; try U-235, Co-60, or C-14!)`
        );
        plot1Title.textContent = 'GPU 118×200 Chart of Nuclides (Click to Pick Z, A)';
        drawNuclideChart(plot1, nuc);
        plot2Title.textContent = `Bateman Isotope Populations N_i(t)/N₀ — ${nuc.isotope}`;
        if (liveBatemanSeries?.curves?.length) {
          const cols = ['#facc15', '#38bdf8', '#c084fc', '#34d399'];
          drawMultiLinePlot(
            plot2,
            liveBatemanSeries.curves.map((c, ci) => ({ xs: liveBatemanSeries.tHalfUnits, ys: c.frac, color: cols[ci % cols.length], width: 2 })),
            { label: liveBatemanSeries.curves.map((c) => c.name).join(' → ') + ' vs t / t½', yMin: 0, yMax: 1.05 }
          );
          setBottomOverlay(`<div class="live-meter">Bateman Ledger: ${liveBatemanSeries.curves.map((c) => c.name).join(' → ')} (t½=${fmt(liveBatemanSeries.firstHalfLifeS, 2)} s · ΣA_i N_i exact)</div>`);
        } else {
          drawPlotLine(plot2, [0, 1, 2, 3], [1, 1, 1, 1], { label: `${nuc.isotope} stable (N/N₀ = 1.0)`, color: '#34d399', yMin: 0, yMax: 1.1 });
        }
      } else {
        setHud(
          `WebGPU 3D Volumetric Nuclear Fermi Density — ${nuc.isotope} (R_rms = ${fmt(nuc.chargeRadiusFm, 2)} fm)`,
          `B/A = ${fmt(nuc.bindingPerNucleonMeV, 3)} MeV · I^π = ${nuc.spinI}${nuc.parity} · μ_I = ${fmt(nuc.magneticMomentMuN, 2)} μ_N · Mode: ${nuc.dominantMode}`
        );
        if (liveTdseTelemetry) {
          setBottomOverlay(`<div class="live-meter">Live GPU TDSE (step ${liveTdseTelemetry.stepCount}): P_well=${fmt(liveTdseTelemetry.pInside * 100, 1)}% · P_barrier=${fmt(liveTdseTelemetry.pBarrier * 100, 2)}% · P_tunneled=${fmt(liveTdseTelemetry.pTunneled * 100, 3)}%</div>`);
        }
        plot1Title.textContent = 'GPU 118×200 Chart of Nuclides (Click to Pick Z, A)';
        drawNuclideChart(plot1, nuc);
        plot2Title.textContent = `Live GPU TDSE Tunneling vs WKB Gamow Barrier (Q_α = ${fmt(nuc.qAlphaMeV, 2)} MeV)`;
        drawTdseBarrierPlot(plot2, nuc, liveTdseTelemetry);
      }
      plot3Title.textContent = `Fermi Proton/Neutron Skin Profile ρ(r) — ${nuc.isotope}`;
      const rs = Array.from({ length: 40 }, (_, i) => (i / 39) * Math.max(8, nuc.chargeRadiusFm * 2.1));
      const rhoP = rs.map((r) => 1 / (1 + Math.exp((r - nuc.chargeRadiusFm) / 0.54)));
      const rhoN = rs.map((r) => (nuc.N / Math.max(1, nuc.Z)) / (1 + Math.exp((r - nuc.chargeRadiusFm * 1.03) / 0.55)));
      drawMultiLinePlot(plot3, [
        { xs: rs, ys: rhoP, color: '#ff9c54', width: 2 },
        { xs: rs, ys: rhoN, color: '#38bdf8', width: 1.6 }
      ], { label: 'Proton (orange) vs Neutron (blue) density vs r (fm)', yMin: 0 });
    }
  } else if (currentTab === 'atomic') {
    if (activeSpecimenKind === 'compound' && currentCompoundRes) {
      const cb = currentCompoundRes.bundle;
      const mqm = currentCompoundRes.visualData.molQm;
      const modeName = ['Total Electron Density ρ(r)', 'HOMO Signed Orbital ψ', 'LUMO Signed Orbital ψ'][uiState.molOrbitalMode] || 'Total ρ';
      setHud(
        `WebGPU 3D Molecular RHF ${modeName} — ${cb.materialKey} (Backfed Compound)`,
        mqm
          ? `GPU Löwdin RHF · ${liveMolOrbitalCloud?.pointCount?.toLocaleString() || '0'} GPU samples · E = ${fmt(mqm.totalEnergyHa, 3)} Ha · μ = ${fmt(mqm.dipoleDebye, 2)} D · Gap = ${fmt(mqm.homoLumoGapEv, 2)} eV`
          : `Ionic/Covalent Crystal Prototype (${cb.mechanical.crystalStructure}) · Pauling Ionicity = ${fmt(cb.atomic.paulingIonicity, 2)}`
      );
      if (mqm?.orbitalEnergiesHa) {
        plot1Title.textContent = `GPU Molecular Orbital Spectrum (${cb.materialKey})`;
        drawPlotLine(plot1, mqm.orbitalEnergiesHa.map((_, i) => i), mqm.orbitalEnergiesHa, {
          label: `MO Energy (Ha) · HOMO-LUMO Gap = ${fmt(mqm.homoLumoGapEv, 2)} eV`, color: '#c084fc'
        });
        plot2Title.textContent = `Mulliken Atomic Charges q_i (${cb.materialKey})`;
        const qs = mqm.mullikenCharges || [0, 0];
        drawPlotLine(plot2, qs.map((_, i) => i), qs, {
          label: `Atomic charges (e): ${qs.map((q) => fmt(q, 2)).join(', ')}`, color: '#34d399', hLine: { y: 0, color: '#64748b', label: '0e' }
        });
      }
      plot3Title.textContent = `Derived Optical Dispersion — ${cb.materialKey}`;
      drawOpticalSpectrumPlot(plot3, cb.electromagnetic.spectralWavelengthsNm, cb.electromagnetic.spectralReflectance, cb.electromagnetic.spectralNRe, cb.electromagnetic.opticalSrgb, cb.materialKey);
    } else if (currentElementRes?.visualData?.atom) {
      const atom = currentElementRes.visualData.atom;
      const rg = atom.radialGrid;
      const unpaired = currentElementRes.bundle.atomic.unpairedElectrons || 0;
      const cloudSrc = liveOrbitalCloud?.sourceKind === 'webgpu-kohn-sham-eigenstate'
        ? 'EXACT GPU Kohn–Sham Eigenstate u_nl(r)'
        : 'Slater-KS Screened Associated Laguerre R_nl(r)';
      setHud(
        `WebGPU 3D Schrödinger / Dirac–KS Orbital |ψ_${uiState.n}${L_NAMES[uiState.l] || uiState.l},${uiState.m}|² — ${atom.symbol}${uiState.ionizedCation ? '⁺ (ΔSCF Cation)' : ''} (Z=${atom.atomicNumberZ})`,
        `${liveOrbitalCloud?.pointCount?.toLocaleString() || '0'} GPU samples · ${cloudSrc} · ${atom.relativisticMethod} · E = ${fmt(atom.totalEnergyHa, 2)} Ha`
      );
      const starkTxt = liveStarkState
        ? ` · α₀=${fmt(liveStarkState.alpha0Angstrom3, 2)} Å³ (${fmt(liveStarkState.alpha0Bohr3, 1)} a₀³)${Math.abs(uiState.starkFieldVPerA) > 0.05 ? ` · p=${fmt(liveStarkState.inducedDipoleDebye, 2)} D · ΔE=${fmt(liveStarkState.starkShiftEv * 1e3, 1)} meV` : ''}`
        : '';
      const dscfTxt = uiState.ionizedCation && liveDeltaScfResult
        ? ` · ΔSCF I₁=${fmt(liveDeltaScfResult.ionizationEnergyEv, 2)} eV (−1e⁻ ${liveDeltaScfResult.removedShell})`
        : '';
      setBottomOverlay(`<div class="live-meter">n=${uiState.n}, l=${uiState.l} (${L_NAMES[uiState.l] || uiState.l}), m=${uiState.m} · Nodes=${liveOrbitalCloud?.radialNodeCount ?? (uiState.n - uiState.l - 1)}${starkTxt}${dscfTxt}</div>`);
      plot1Title.textContent = 'Radial Probability 4πr²ρ(r) & Selected Subshell |u_nl(r)|²';
      const prob = rg.r.map((rv, i) => 4 * Math.PI * rv * rv * rg.rho[i]);
      const capIdx = rg.r.findIndex((rv) => rv > Math.max(6, (liveOrbitalCloud?.rExtentBohr || 6) * 1.1));
      const end = capIdx > 12 ? capIdx : rg.r.length;
      const series = [{ xs: rg.r.slice(0, end), ys: prob.slice(0, end), color: '#56c2ff', width: 1.8 }];
      const orbIdx = atom.orbitals.findIndex((o) => o.n === uiState.n && o.l === uiState.l);
      if (orbIdx >= 0 && atom.orbitalWavefunctions?.[orbIdx]) {
        const uArr = atom.orbitalWavefunctions[orbIdx];
        const maxProb = Math.max(1e-5, ...prob.slice(0, end));
        const maxU2 = Math.max(1e-8, ...Array.from(uArr.slice(0, end), (u) => u * u));
        series.push({
          xs: rg.r.slice(0, end),
          ys: Array.from(uArr.slice(0, end), (u) => ((u * u) / maxU2) * maxProb * 0.9),
          color: '#a78bfa',
          width: 2.0
        });
      }
      drawMultiLinePlot(plot1, series, { label: `Total 4πr²ρ (blue) & Active ${uiState.n}${L_NAMES[uiState.l]} |u|² (violet)`, yMin: 0 });
      plot2Title.textContent = 'Relativistic Orbital Eigenvalues ε_nl & Spin-Orbit j± (Ha)';
      const occOrbs = atom.orbitals.filter((o) => Number(o.occupancy ?? 1) > 0);
      const idxArr = occOrbs.map((_, i) => i);
      drawMultiLinePlot(plot2, [
        { xs: idxArr, ys: occOrbs.map((o) => o.energyHa), color: '#34d399', width: 2 },
        { xs: idxArr, ys: occOrbs.map((o) => o.energyJPlusHa ?? o.energyHa), color: '#facc15', width: 1.3 },
        { xs: idxArr, ys: occOrbs.map((o) => o.energyJMinusHa ?? o.energyHa), color: '#f472b6', width: 1.3 }
      ], { label: `Subshell ε_nl (green), j+ (gold), j− (pink) · ${uiState.relativisticSpinOrbit ? 'Rel+SO ON' : 'Non-Rel'}` });
      plot3Title.textContent = `Angular Spherical Harmonic |Y_${uiState.l},${uiState.m}(θ)| Cross-Section`;
      drawPolarAngularPlot(plot3, uiState.l, uiState.m, atom.symbol, unpaired);
    }
  } else if (currentTab === 'crystal') {
    const b = getActiveBundle();
    const em = getActiveElectromagnetic();
    const tel = livePhotonTelemetry;
    if (uiState.crystalViewMode === 'spin-llg' && b) {
      const st = liveSpinTelemetry;
      const ph = st?.magneticPhase || em?.magneticPhase || 'diamagnetic';
      setHud(
        `Live WebGPU 3D Stochastic LLG Spin-Lattice — ${b.materialKey} (${ph.toUpperCase()})`,
        st
          ? `${st.spinCount} GPU spins · J=${fmt(st.exchangeJEv * 1e3, 2)} meV · T=${Math.round(st.temperatureK)} K${st.curieOrNeelTempK > 0 ? ` (T_c=${Math.round(st.curieOrNeelTempK)} K)` : ''} · B_z=${st.fieldBZTesla.toFixed(1)} T · M_z=${fmt(st.magnetizationZ, 3)} · |M_stag|=${fmt(st.staggeredOrderMag, 3)}`
          : 'Stepping 3D sLLG spin lattice on WebGPU…'
      );
      if (st) {
        setBottomOverlay(
          `<div class="live-meter">Phase: <b>${ph.toUpperCase()}</b> · M_z=<b>${fmt(st.magnetizationZ, 3)}</b> · |M|=<b>${fmt(st.magnetizationMag, 3)}</b> · Néel |M_stag|=<b>${fmt(st.staggeredOrderMag, 3)}</b> · ⟨s_i·s_j⟩=${fmt(st.neighborAlign, 3)}</div>`
        );
      }
      plot1Title.textContent = `Live Spin Hysteresis / Field Response M_z(B_z) — ${b.materialKey}`;
      if (liveSpinHistory.length >= 2) {
        drawPlotLine(plot1, liveSpinHistory.map((h) => h.B), liveSpinHistory.map((h) => h.Mz), {
          label: `M_z vs B_z (T) · Sweep B to trace ferromagnetic hysteresis!`,
          color: '#facc15', yMin: -1.05, yMax: 1.05, hLine: { y: 0, color: '#64748b', label: '0' }
        });
        plot2Title.textContent = 'Ferro |M| (gold) vs Néel Antiferro |M_stag| (cyan)';
        const stepsX = liveSpinHistory.map((_, i) => i);
        drawMultiLinePlot(plot2, [
          { xs: stepsX, ys: liveSpinHistory.map((h) => h.Mmag), color: '#facc15', width: 2 },
          { xs: stepsX, ys: liveSpinHistory.map((h) => h.Mstag), color: '#38bdf8', width: 2 }
        ], { label: '|M| vs |M_stag| order parameters (drops to ~0 above T_c!)', yMin: 0, yMax: 1.05 });
      }
    } else if (uiState.crystalViewMode === 'transport' && b) {
      const tr = liveTransportTelemetry;
      const modeLbl = tr?.isSuperconducting
        ? 'SUPERCONDUCTING BCS CONDENSATE (ρ = 0 Ω·m!)'
        : (tr?.isMetal ? 'DRUDE–BLOCH–GRÜNEISEN METAL' : `SEMICONDUCTOR / INSULATOR (E_g=${fmt(em?.bandGapEv, 2)} eV)`);
      setHud(
        `Live WebGPU 3D Electron–Phonon & BCS Transport — ${b.materialKey}`,
        tr
          ? `${modeLbl} · T=${tr.temperatureK < 20 ? tr.temperatureK.toFixed(1) : Math.round(tr.temperatureK)} K · Mobile=${tr.mobileCount}/${tr.carrierCount}${tr.cooperCount > 0 ? ` · Cooper=${tr.cooperCount}` : ''} · Scatters=${tr.scatterEvents}/step`
          : 'Stepping 3D Drude–Boltzmann electron transport on WebGPU…'
      );
      if (tr) {
        const sigTxt = tr.isSuperconducting ? '∞ S/m (ZERO RESISTANCE!)' : `${fmt(tr.sigmaGpuSPerM, 2)} S/m (ρ=${fmt(tr.resistivityGpuOhmM, 2)} Ω·m)`;
        setBottomOverlay(
          `<div class="live-meter">GPU σ(T)=<b>${sigTxt}</b> · Drift ⟨J_x⟩=${fmt(tr.meanDriftNorm, 3)} · Phonon Scatters=${tr.scatterEvents}/step</div>`
        );
      }
      plot1Title.textContent = `Live GPU Carrier Drift & Phonon Scattering — ${b.materialKey}`;
      if (liveTransportHistory.length >= 2) {
        const xs = liveTransportHistory.map((_, i) => i);
        drawMultiLinePlot(plot1, [
          { xs, ys: liveTransportHistory.map((h) => Math.abs(h.drift) * 4), color: '#38bdf8', width: 2 },
          { xs, ys: liveTransportHistory.map((h) => h.scatter), color: '#fb923c', width: 1.8 }
        ], { label: 'Scaled Drift Current (cyan) vs Phonon Scatter Rate (orange)', yMin: 0 });
      }
      plot2Title.textContent = `Conductivity Curve log10 σ(T) (1..1200 K) — ${b.materialKey}`;
      const ts = Array.from({ length: 30 }, (_, i) => 1 + (i / 29) * 1199);
      const lsig = ts.map((T) => {
        const tc = Number(em?.superconductingTcK) || 0;
        if (em?.isMetal && tc > 0.1 && T < tc) return 12;
        const thetaD = Math.max(25, b.mechanical?.debyeTemperatureK || 250);
        const s300 = Math.max(1e-18, em?.electricalConductivitySPerM || 1e6);
        if (em?.isMetal) return Math.log10(Math.max(1, s300 * (300 / Math.max(15, T))));
        const eg = Math.max(0.1, em?.bandGapEv || 2.0);
        return Math.max(-18, Math.min(8, Math.log10(s300) + (eg / (2 * 8.617e-5)) * (1 / 300 - 1 / Math.max(10, T)) / Math.LN10));
      });
      drawPlotLine(plot2, ts, lsig, {
        label: 'log10 σ(T) S/m vs T(K)', color: '#34d399',
        vLine: { x: uiState.transportTempK, color: '#facc15', label: `${Math.round(uiState.transportTempK)}K` }
      });
    } else if ((uiState.crystalViewMode === 'tdks-atom' || uiState.crystalViewMode === 'photon-shell') && b) {
      const chR = tel?.channels?.[0]; const chG = tel?.channels?.[1]; const chB = tel?.channels?.[2]; const chP = tel?.channels?.[3];
      const nLive = chG?.nMeasuredFdtd ?? chP?.nMeasuredFdtd ?? chR?.nMeasuredFdtd;
      const bCh = liveBlochSession?.channels?.[uiState.photonModeMono ? 3 : 2];
      if (uiState.crystalViewMode === 'tdks-atom' && liveTdksPairCloud && liveBlochSession) {
        const gLbl = `${liveTdksPairCloud.n0}${L_NAMES[liveTdksPairCloud.l0] || ''}`;
        const eLbl = `${liveTdksPairCloud.n1}${L_NAMES[liveTdksPairCloud.l1] || ''}`;
        setHud(
          `Live WebGPU TD-KS Electron Cloud |ψ(r,t)|² ↔ Photon Wavepacket — ${b.materialKey} (${gLbl} ↔ ${eLbl})`,
          `${liveTdksPairCloud.pointCount.toLocaleString()} GPU samples · ΔE=${fmt(liveBlochSession.transEv, 2)} eV (${liveBlochSession.transLabel}) · Excited |c_${eLbl}|²=${fmt((bCh?.rho11 || 0) * 100, 1)}% · Dipole d(t)=${fmt(bCh?.dipole || 0, 2)} · t=${fmt(liveBlochSession.getTimeFs(), 2)} fs`
        );
      } else if (tel) {
        const oscTxt = tel.oscillators.filter((o) => o.active).slice(0, 2)
          .map((o) => `${o.label} @ ${fmt(o.energyEv, 2)} eV`).join(' | ') || 'Drude Free-Electron Gas';
        setHud(
          `Live WebGPU 2D (128×128) Maxwell–ADE-FDTD Bulk Optical Cavity — ${b.materialKey}`,
          `${tel.isMetal ? `Drude ω_p=${fmt(tel.plasmaEv, 2)} eV` : `Dielectric Gap=${fmt(b.electromagnetic.bandGapEv, 2)} eV`} · ${oscTxt} · t=${fmt(tel.simTimeFs, 2)} fs`
        );
      }
      if (tel && chR && chG && chB) {
        const hasFdtdRefl = (chR.reflectance + chG.reflectance + chB.reflectance) > 0.04;
        const swatchSrgb = hasFdtdRefl ? tel.emergentReflectedSrgb : (em?.opticalSrgb || tel.analyticReflectedSrgb);
        const emerCss = srgbToCss(swatchSrgb);
        const snellTxt = chG.refractAngleDeg != null ? ` · Snell θ_t=${fmt(chG.refractAngleDeg, 1)}°` : '';
        let nBadge;
        if (uiState.crystalViewMode === 'tdks-atom' && liveBlochSession) {
          const bR = liveBlochSession.channels[0];
          const bG = liveBlochSession.channels[1];
          const bB = liveBlochSession.channels[2];
          nBadge = `TD-KS Shell Excitation |c₁|²: <span style="color:#f87171">610nm=${fmt(bR.rho11 * 100, 1)}%</span> · <span style="color:#4ade80">535nm=${fmt(bG.rho11 * 100, 1)}%</span> · <span style="color:#60a5fa">440nm=${fmt(bB.rho11 * 100, 1)}%</span> | Blue Abs=${fmt(bB.absorbedEnergy, 2)}`;
        } else if (!tel.isMetal) {
          nBadge = `Live 2D FDTD n(λ) = <b>${nLive ? fmt(nLive, 3) : 'propagating…'}</b> (analytic ${fmt(chG.analyticNRe, 2)})${snellTxt} · T=${fmt(chG.transmittance * 100, 1)}%`;
        } else {
          nBadge = `2D FDTD Reflected R: <span style="color:#f87171">610nm=${fmt(chR.reflectance * 100, 1)}%</span> · <span style="color:#4ade80">535nm=${fmt(chG.reflectance * 100, 1)}%</span> · <span style="color:#60a5fa">440nm=${fmt(chB.reflectance * 100, 1)}%</span> | Blue Shell Abs=${fmt(chB.absorption * 100, 1)}%`;
        }
        const swatchLbl = hasFdtdRefl ? 'Emergent FDTD Reflected Color' : 'GPU Optical Reflected Color';
        setBottomOverlay(
          `<div class="live-meter">${nBadge}</div>` +
          `<div class="live-meter"><i class="swatch" style="background:${emerCss};"></i> ${swatchLbl} ${activeSpecimenKind === 'element' ? (uiState.relativisticSpinOrbit ? '(Relativistic ON)' : '(Relativistic OFF)') : '(Backfed Compound)'}</div>`
        );
        plot1Title.textContent = `Live 2D Maxwell–FDTD R(λ) vs Electron-Shell Absorption A(λ)`;
        drawPhotonFdtdBarPlot(plot1, tel, `${b.materialKey} · `);
      }
    } else if (activeSpecimenKind === 'element' && currentElementRes?.visualData?.bulk) {
      const bulk = currentElementRes.visualData.bulk;
      setHud(
        `WebGPU 3D FFT Bloch Charge Density & Fermi Isosurface — ${bulk.symbol} (${bulk.crystalStructure})`,
        `a₀ = ${fmt(bulk.latticeConstantA, 2)} Å · ρ = ${fmt(bulk.densityKgPerM3, 0)} kg/m³ · E_F = ${fmt(bulk.fermiEnergyEv, 2)} eV · Gap = ${fmt(bulk.bandGapEv, 2)} eV · ${em.magneticPhase}`
      );
      plot1Title.textContent = 'All Brillouin Bands E_n(k) & Fermi Level E_F';
      const nBands = bulk.bandsEv[0]?.length || 1;
      const kXs = bulk.bandsEv.map((_, i) => i);
      const palette = ['#56c2ff', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#38bdf8', '#c084fc', '#94a3b8'];
      const bandSeries = Array.from({ length: nBands }, (_, bi) => ({
        xs: kXs, ys: bulk.bandsEv.map((row) => row[bi]), color: palette[bi % palette.length], width: bi < 4 ? 1.7 : 1.15
      }));
      const ticks = (bulk.kPathLabels || []).map((lbl, idx) => (lbl ? { x: idx, label: lbl } : null)).filter(Boolean);
      drawMultiLinePlot(plot1, bandSeries, {
        label: `${nBands} Bloch Bands (eV) · E_F=${fmt(bulk.fermiEnergyEv, 1)} eV`,
        hLine: { y: bulk.fermiEnergyEv, color: '#facc15', label: 'E_F' },
        xTicks: ticks
      });
    } else if (b) {
      setHud(
        `WebGPU 3D Crystal Lattice — ${b.materialKey} (${b.mechanical.crystalStructure})`,
        `a₀ = ${fmt(b.mechanical.latticeConstantA, 2)} Å · ρ = ${fmt(b.mechanical.densityKgPerM3, 0)} kg/m³ · Gap = ${fmt(b.electromagnetic.bandGapEv, 2)} eV`
      );
    }

    if (uiState.crystalViewMode === 'spin-llg' || uiState.crystalViewMode === 'transport') {
      // Plots 1 & 2 already populated by live Spin-LLG / Electron-Transport above!
    } else if (activeSpecimenKind === 'element' && currentElementRes?.visualData?.bulk) {
      const bulk = currentElementRes.visualData.bulk;
      plot2Title.textContent = 'Electronic DOS g(E) & Brillouin Fermi Level';
      drawMultiLinePlot(plot2, [
        { xs: Array.from(bulk.dosEnergyEv), ys: Array.from(bulk.dosValues), color: '#f472b6', width: 2 }
      ], { label: `g(E_F)=${fmt(bulk.dosAtFermiStatesPerEvAtom, 2)} · ${em.magneticPhase}`, yMin: 0, vLine: { x: bulk.fermiEnergyEv, color: '#facc15', label: 'E_F' } });
    } else if (tel) {
      plot2Title.textContent = `FDTD Channel Energy Balance (R + T + A = 1.0)`;
      const xs = tel.channels.map((c) => c.wavelengthNm);
      drawMultiLinePlot(plot2, [
        { xs, ys: tel.channels.map((c) => c.reflectance * 100), color: '#facc15', width: 2 },
        { xs, ys: tel.channels.map((c) => c.transmittance * 100), color: '#38bdf8', width: 2 },
        { xs, ys: tel.channels.map((c) => c.absorption * 100), color: '#c084fc', width: 1.8 }
      ], { label: 'FDTD R% (gold), T% (cyan), Shell Abs% (violet)', yMin: 0, yMax: 105 });
    }
    plot3Title.textContent = 'GPU Optical UV-Vis Reflectance R(λ) & n(λ) (380–780 nm)';
    drawOpticalSpectrumPlot(
      plot3,
      em?.spectralWavelengthsNm,
      em?.spectralReflectance,
      em?.spectralNRe,
      em?.opticalSrgb,
      `${b?.materialKey || ''} (${uiState.relativisticSpinOrbit ? 'Rel' : 'NonRel'})`
    );
  } else if (currentTab === 'md') {
    const b = getActiveBundle();
    const md = liveMdTelemetry;
    const meta = liveMdConfigMeta;
    const mm = uiState.mdMode;
    const modeNames = {
      equilibrium: 'Equilibrium + Phonon VDOS',
      strain: 'Uniaxial/Shear Stress–Strain (K, G, ν)',
      acoustic: 'Acoustic Phonon Wave (v_L, v_T)',
      shear: 'Couette Shear NEMD Viscosity (η)',
      thermal: 'Hot/Cold Slab NEMD Thermal Cond. (κ)',
      surface: 'Free-Surface Vacuum Slab (γ)'
    };
    setHud(
      `Zero-Copy WebGPU MD [${modeNames[mm] || mm}] — ${meta?.label || b?.materialKey || ''} (${meta?.crystalStructure || ''})`,
      md
        ? `Atoms: ${md.atomCount} | t=${fmt(md.timeFs, 1)} fs | T=${fmt(md.temperatureK, 1)} K | P=${fmt(md.pressureGPa, 2)} GPa | V/V₀=${fmt(md.volumeRatio ?? 1, 3)} | MSD=${fmt(md.msdA2, 4)} Å²`
        : 'Initializing live WebGPU MD buffers…'
    );
    if (md) {
      if (mm === 'strain') {
        const pxx = md.diagPressureGPa?.[0] ?? md.pressureGPa;
        const sxy = md.stressOffDiagGPa?.[0] ?? 0;
        const nuTxt = md.poissonMeasured != null ? fmt(md.poissonMeasured, 3) : 'compress to measure';
        setBottomOverlay(`<div class="live-meter">Strain ε_x=${fmt((md.strainX || 0) * 100, 1)}% · γ_xy=${fmt((md.shearXY || 0) * 100, 1)}% · σ_xx=${fmt(pxx, 2)} GPa · σ_xy=${fmt(sxy, 2)} GPa · Live ν=${nuTxt}</div>`);
      } else if (mm === 'shear') {
        const etaMs = md.nemdViscosityPaS != null ? `${fmt(md.nemdViscosityPaS * 1e3, 2)} mPa·s` : 'equilibrating…';
        setBottomOverlay(`<div class="live-meter">Live Couette NEMD: σ_xy=${fmt(md.stressOffDiagGPa?.[0] ?? 0, 3)} GPa · GPU η=<b>${etaMs}</b> (closure ${fmt((b?.thermodynamic?.dynamicViscosityLiquidPaS || 0) * 1e3, 2)} mPa·s)</div>`);
      } else if (mm === 'thermal') {
        const kTxt = md.nemdThermalCondWPerMK != null ? `${fmt(md.nemdThermalCondWPerMK, 1)} W/m·K` : 'building dT/dx…';
        setBottomOverlay(`<div class="live-meter">Live Thermal NEMD: T_hot=${fmt(md.slabTempK?.[0] ?? md.temperatureK, 0)} K → T_cold=${fmt(md.slabTempK?.[4] ?? md.temperatureK, 0)} K · GPU κ_ph=<b>${kTxt}</b></div>`);
      } else if (mm === 'surface') {
        setBottomOverlay(`<div class="live-meter">Free-Surface Vacuum Slab (L_z=${fmt(md.boxLengthsA?.[2] ?? 0, 1)} Å): Kirkwood–Buff GPU γ=<b>${fmt(md.surfaceTensionNPerM ?? 0, 3)} N/m</b> (closure ${fmt(b?.thermodynamic?.surfaceTensionNPerM ?? 0, 3)} N/m)</div>`);
      } else if (mm === 'acoustic') {
        setBottomOverlay(`<div class="live-meter">Acoustic Crystal Bar (L_x=${fmt(md.boxLengthsA?.[0] ?? 0, 1)} Å): DFT v_L=${fmt(b?.mechanical?.soundSpeedLongMPerS ?? 0, 0)} m/s · v_T=${fmt(b?.mechanical?.soundSpeedTransMPerS ?? 0, 0)} m/s</div>`);
      } else if (uiState.mdNptBarostat) {
        setBottomOverlay(`<div class="live-meter">NPT Barostat Active: V/V₀=<b>${fmt(md.volumeRatio ?? 1, 4)}</b> (Thermal Expansion α_V=${fmt((b?.thermodynamic?.thermalExpansionVolPerK || 0) * 1e6, 1)} ppm/K)</div>`);
      }
    }

    if (md?.rdf) {
      plot1Title.textContent = 'GPU Radial Distribution Function g(r) (Order → Melting)';
      const rAxis = Array.from(md.rdf).map((_, i) => ((i + 0.5) / md.rdf.length) * (meta?.rcutA || 5.5));
      drawPlotLine(plot1, rAxis, Array.from(md.rdf), { label: 'g(r) vs r (Å) — sharp peaks=solid, broad=liquid', color: '#34d399', yMin: 0 });
    }
    if (mm === 'shear' && md?.slabVx) {
      plot2Title.textContent = 'Live Couette Shear Velocity Profile v_x(y)';
      drawPlotLine(plot2, [0, 1, 2, 3, 4, 5, 6, 7], Array.from(md.slabVx), {
        label: '8-slab Couette v_x(y) (Å/t₀) across Y', color: '#38bdf8', hLine: { y: 0, color: '#64748b', label: '0' }
      });
    } else if (mm === 'thermal' && md?.slabTempK) {
      plot2Title.textContent = 'Live NEMD Spatial Temperature Gradient T(x)';
      drawPlotLine(plot2, [0, 1, 2, 3, 4, 5, 6, 7], Array.from(md.slabTempK), {
        label: '8-slab T(x) K (Hot slab #0–1 → Cold slab #4–5)', color: '#fb923c', yMin: 0
      });
    } else if (mm === 'acoustic' && md?.slabVx && md?.slabVy) {
      plot2Title.textContent = 'Live Acoustic Wavefront Profile v_x (P) & v_y (S)';
      drawMultiLinePlot(plot2, [
        { xs: [0, 1, 2, 3, 4, 5, 6, 7], ys: Array.from(md.slabVx), color: '#facc15', width: 2 },
        { xs: [0, 1, 2, 3, 4, 5, 6, 7], ys: Array.from(md.slabVy), color: '#38bdf8', width: 2 }
      ], { label: 'P-wave v_x (gold) & S-wave v_y (cyan) across crystal bar', hLine: { y: 0, color: '#64748b', label: '0' } });
    } else if (mm === 'strain' && liveMdStrainHistory.length >= 2) {
      plot2Title.textContent = 'Live GPU Virial Stress vs Strain σ_xx(ε_x)';
      drawPlotLine(plot2, liveMdStrainHistory.map((h) => h.eps * 100), liveMdStrainHistory.map((h) => h.pxx), {
        label: 'σ_xx (GPa) vs ε_x (%) · slope = elastic stiffness', color: '#facc15', hLine: { y: 0, color: '#64748b', label: '0' }
      });
    } else {
      plot2Title.textContent = `Live MD Temperature T(t) (${meta?.label || ''})`;
      if (liveMdHistory.length >= 2) {
        drawMultiLinePlot(plot2, [
          { xs: liveMdHistory.map((h) => h.t), ys: liveMdHistory.map((h) => h.T), color: '#ff9c54', width: 2 }
        ], { label: `T(t) K · T_m=${fmt(meta?.meltingPointK || 600, 0)} K`, yMin: 0, hLine: { y: meta?.meltingPointK || 600, color: '#facc15', label: 'T_m' } });
      }
    }

    if (liveMdVacfHistory.length >= 8 && (mm === 'equilibrium' || mm === 'acoustic')) {
      const spec = computePhononVdosFromVacf(liveMdVacfHistory, (meta?.dtFs || 1.0) * 4, 32);
      plot3Title.textContent = `GPU Phonon Vibrational DOS g(ω) (Peak ${fmt(spec.peakThz, 1)} THz)`;
      drawPlotLine(plot3, Array.from(spec.freqsThz), Array.from(spec.vdos), {
        label: `VACF FFT g(f) vs THz · Θ_D,eff≈${Math.round(spec.effectiveDebyeK)} K`, color: '#c084fc', yMin: 0, yMax: 1.08
      });
    } else if (liveMdHistory.length >= 2) {
      plot3Title.textContent = 'Live MD Mean-Squared Displacement MSD(t) (Å²)';
      drawPlotLine(plot3, liveMdHistory.map((h) => h.t), liveMdHistory.map((h) => h.msd), {
        label: `MSD(t) Å² · Diffusion slope spikes above T_m!`, color: '#38bdf8', yMin: 0
      });
    }
  } else if (currentTab === 'compound' && currentCompoundRes) {
    const mqm = currentCompoundRes.visualData.molQm;
    const cb = currentCompoundRes.bundle;
    const neb = currentNebBarrier;
    const xiTxt = neb ? ` · CI-NEB Image #${uiState.nebImageIdx}/${neb.energiesEv.length - 1} (ΔE=${fmt(neb.energiesEv[uiState.nebImageIdx], 2)} eV${uiState.nebImageIdx === neb.saddleImageIndex ? ' ‡ TS' : ''})` : '';
    setHud(
      mqm
        ? `WebGPU 3D Reactive RHF Orbitals — ${cb.materialKey}${xiTxt}`
        : `WebGPU 3D Ionic/Covalent Crystal — ${cb.materialKey} (${cb.mechanical.crystalStructure})`,
      mqm
        ? `E = ${fmt(mqm.totalEnergyHa, 3)} Ha · μ = ${fmt(mqm.dipoleDebye, 2)} D · HOMO-LUMO Gap = ${fmt(mqm.homoLumoGapEv, 2)} eV · GPU RHF calls=${neb?.gpuRhfCalls ?? 1}`
        : `a₀ = ${fmt(cb.mechanical.latticeConstantA, 2)} Å · ρ = ${fmt(cb.mechanical.densityKgPerM3, 0)} kg/m³ · Gap = ${fmt(cb.electromagnetic.bandGapEv, 2)} eV`
    );
    if (mqm?.orbitalEnergiesHa) {
      plot1Title.textContent = `Molecular Orbital Spectrum (${cb.materialKey} GPU RHF)`;
      drawPlotLine(plot1, mqm.orbitalEnergiesHa.map((_, i) => i), mqm.orbitalEnergiesHa, {
        label: `MO Energy (Ha) | HOMO-LUMO Gap = ${fmt(mqm.homoLumoGapEv, 2)} eV`, color: '#c084fc'
      });
    } else {
      plot1Title.textContent = `Ionic/Covalent Crystal Summary (${cb.materialKey})`;
      drawPlotLine(plot1, [0, 1, 2], [cb.mechanical.bulkModulusPa * 1e-9, cb.mechanical.shearModulusPa * 1e-9, cb.electromagnetic.bandGapEv * 10], {
        label: `K=${fmt(cb.mechanical.bulkModulusPa * 1e-9, 1)} GPa · G=${fmt(cb.mechanical.shearModulusPa * 1e-9, 1)} GPa`,
        color: '#c084fc', yMin: 0
      });
    }
    if (neb?.energiesEv?.length >= 3) {
      plot2Title.textContent = `WebGPU CI-NEB Barrier (${cb.materialKey}: E_a = ${fmt(neb.forwardBarrierEv, 2)} eV)`;
      const xs = neb.energiesEv.map((_, i) => i / (neb.energiesEv.length - 1));
      drawPlotLine(plot2, xs, neb.energiesEv, {
        label: `GPU MEP ΔE (eV) · TS‡ #${neb.saddleImageIndex} (${neb.pathwayLabel})`,
        color: '#ff9c54',
        yMin: Math.min(0, ...neb.energiesEv)
      });
      const p2ctx = getPlotCtx(plot2);
      const ys = neb.energiesEv;
      const loY = Math.min(0, ...ys);
      const hiY = Math.max(1e-6, ...ys);
      const plotDot = (imgIdx, color, lbl) => {
        const sx = 26 + (imgIdx / Math.max(1, ys.length - 1)) * (plot2.width - 36);
        const sy = plot2.height - 18 - ((ys[imgIdx] - loY) / Math.max(1e-9, hiY - loY)) * (plot2.height - 37);
        p2ctx.fillStyle = color;
        p2ctx.beginPath();
        p2ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
        p2ctx.fill();
        if (lbl) p2ctx.fillText(lbl, Math.min(plot2.width - 36, sx + 6), Math.max(22, sy - 4));
      };
      plotDot(neb.saddleImageIndex, '#facc15', '‡ TS');
      plotDot(uiState.nebImageIdx, '#38bdf8', '');
    } else {
      plot2Title.textContent = `Compound Phase Transitions (${cb.materialKey})`;
      drawPlotLine(plot2, [0, 1, 2], [0, cb.thermodynamic.meltingPointK, cb.thermodynamic.boilingPointK], {
        label: `T_m = ${fmt(cb.thermodynamic.meltingPointK, 0)} K · T_b = ${fmt(cb.thermodynamic.boilingPointK, 0)} K`,
        color: '#38bdf8', yMin: 0
      });
    }
    plot3Title.textContent = `Compound GPU Optical UV-Vis Spectrum (${cb.materialKey})`;
    drawOpticalSpectrumPlot(plot3, cb.electromagnetic.spectralWavelengthsNm, cb.electromagnetic.spectralReflectance, cb.electromagnetic.spectralNRe, cb.electromagnetic.opticalSrgb, cb.materialKey);
  } else if (currentTab === 'polytope' && currentAtlas) {
    const p = uiState.polytopeProbe;
    setHud(
      `Live WebGPU eval_polytope_atlas_2d — ${currentAtlas.materialKey} (${currentAtlas.polytopeCount} Convex Cells · ${uiState.polytopeRegime === 'planetary' ? '1 TPa Planetary' : '10 GPa Lab'})`,
      `Slanted Clausius–Clapeyron A x <= b · Clenshaw Chebyshev log10(ρ) contours · Hover/Click to probe GPU`
    );
    if (p) {
      if (p.hit) {
        setBottomOverlay(`<div class="live-meter">GPU Probe (${fmt(p.temperatureK, 1)} K, ${fmt(p.pressurePa * 1e-5, 2)} bar): Phase=<b>${p.phase.toUpperCase()}</b> · ρ_GPU=<b>${fmt(p.densityKgPerM3, 2)} kg/m³</b>${p.eosRho ? ` (EOS ${fmt(p.eosRho, 2)}, err ${fmt(p.relErrPct, 2)}%)` : ''} · margin=${fmt(p.margin, 3)}</div>`);
      } else {
        setBottomOverlay(`<div class="live-meter fail-closed">GPU Probe (${fmt(p.temperatureK, 1)} K, ${fmt(p.pressurePa * 1e-5, 2)} bar): <b>OUT OF DOMAIN (FAIL-CLOSED · hitFlag=0)</b> — triggers Tier-2/3 synthesis, never silent extrapolation!</div>`);
      }
    }
    plot1Title.textContent = `Convex Polytopes (${currentAtlas.materialKey}): ${currentAtlas.polytopeCount} Cells`;
    drawPolytopeDiagram(plot1, currentAtlas, p);
    plot2Title.textContent = 'GPU Chebyshev Max Relative Residuals (%)';
    const errs = currentAtlas.polytopes.map((cell) => (cell.fit?.maxRelativeError ?? 0) * 100);
    drawPlotLine(plot2, errs.map((_, i) => i), errs, { label: 'Max Rel Error (%) per Polytope', color: '#38bdf8', yMin: 0 });
    plot3Title.textContent = '1 atm Multi-Phase Density Curve log10 ρ(T)';
    const activeBundle = getActiveBundle();
    if (activeBundle) {
      const tMelt = activeBundle.thermodynamic.meltingPointK;
      const tBoil = activeBundle.thermodynamic.boilingPointK;
      const ts = Array.from({ length: 32 }, (_, i) => 10 ** (Math.log10(Math.max(5, tMelt * 0.25)) + (i / 31) * (Math.log10(Math.max(tBoil * 3, 5000)) - Math.log10(Math.max(5, tMelt * 0.25)))));
      const lrhos = ts.map((T) => {
        const ph = T < tMelt ? 'solid' : (T < tBoil ? 'liquid' : 'gas');
        return Math.log10(Math.max(1e-5, evaluateBundleDensityEos(activeBundle, ph, T, 101325)));
      });
      drawPlotLine(plot3, ts.map((T) => Math.log10(T)), lrhos, {
        label: 'log10 ρ(kg/m³) vs log10 T(K) at 1 atm (solid→liquid→gas)', color: '#34d399'
      });
    }
  }
}

// ============================================================================
// Continuous Real-Time WebGPU Simulation Loop (Zero Canned Fake Motion!)
// ============================================================================

let frameCounter = 0;
let rafId = null;

function scheduleNextFrame() {
  if (document.hidden || rafId != null) return;
  rafId = requestAnimationFrame(tickSimulationLoop);
}

function tickSimulationLoop(nowMs) {
  rafId = null;
  if (document.hidden) return;
  frameCounter += 1;

  // User-requested optional rotation ONLY when user explicitly clicked Rotate (starts OFF!)
  if (uiState.autoRotate && (currentTab === 'atomic' || currentTab === 'compound')) {
    camYaw += 0.008;
  }

  // 1. Live WebGPU TD-KS Electron-Cloud + 2D Maxwell–ADE-FDTD stepping on Tab 3!
  if (currentTab === 'crystal' && (uiState.crystalViewMode === 'tdks-atom' || uiState.crystalViewMode === 'photon-shell') && uiState.photonPlaying) {
    if (liveBlochSession) {
      liveBlochSession.stepFs(0.065);
    }
    if (livePhotonSession) {
      if (livePhotonSession.getStepIndex() >= 380) {
        livePhotonSession.reset(null, { nextProbeWavelengthNm: uiState.probeWavelengthNm });
        livePhotonSession.stepSync(24);
      } else {
        livePhotonSession.stepSync(3);
      }
      if (!livePhotonBusy && frameCounter % 8 === 0) {
        livePhotonBusy = true;
        livePhotonSession.readTelemetry({ nonBlocking: true }).then((tel) => {
          if (!tel) return;
          livePhotonTelemetry = tel;
          if (window.__ulgElementsLabState) {
            window.__ulgElementsLabState.photonTelemetry = tel;
          }
          const b = getActiveBundle();
          if (b) renderG7Card(b, activeSpecimenKind === 'element' ? currentElementRes?.g7Advisory : { hasReference: false, note: 'Backfed compound live Maxwell–FDTD optics.' });
          if (currentTab === 'crystal') redrawCurrentTab();
        }).catch(() => {}).finally(() => { livePhotonBusy = false; });
      }
    }
  }

  // 1b. Live WebGPU 3D Stochastic LLG Spin-Lattice Magnetism on Tab 3!
  if (currentTab === 'crystal' && uiState.crystalViewMode === 'spin-llg' && liveSpinSession && uiState.spinPlaying && !liveSpinBusy && frameCounter % 2 === 0) {
    if (uiState.spinSweepB) {
      uiState.spinFieldBTesla += uiState.spinSweepDir * 0.16;
      if (uiState.spinFieldBTesla >= 4.8) { uiState.spinFieldBTesla = 4.8; uiState.spinSweepDir = -1; }
      if (uiState.spinFieldBTesla <= -4.8) { uiState.spinFieldBTesla = -4.8; uiState.spinSweepDir = 1; }
      const bLbl = document.getElementById('lbl-spin-b');
      if (bLbl) bLbl.textContent = uiState.spinFieldBTesla.toFixed(1);
    }
    liveSpinBusy = true;
    liveSpinSession.stepBatch(8, {
      temperatureK: uiState.spinTempK,
      fieldBZTesla: uiState.spinFieldBTesla,
      readObs: true,
      nonBlocking: true
    }).then((tel) => {
      if (!tel) return;
      liveSpinTelemetry = tel;
      liveSpinHistory.push({ B: tel.fieldBZTesla, Mz: tel.magnetizationZ, Mmag: tel.magnetizationMag, Mstag: tel.staggeredOrderMag, T: tel.temperatureK });
      if (liveSpinHistory.length > 90) liveSpinHistory.shift();
      if (window.__ulgElementsLabState) window.__ulgElementsLabState.spinTelemetry = tel;
      if (currentTab === 'crystal' && uiState.crystalViewMode === 'spin-llg') redrawCurrentTab();
    }).catch(() => {}).finally(() => { liveSpinBusy = false; });
  }

  // 1c. Live WebGPU 3D Drude-Boltzmann & BCS Electron Transport on Tab 3!
  if (currentTab === 'crystal' && uiState.crystalViewMode === 'transport' && liveTransportSession && uiState.transportPlaying && !liveTransportBusy && frameCounter % 2 === 0) {
    liveTransportBusy = true;
    liveTransportSession.stepBatch(3, {
      temperatureK: uiState.transportTempK,
      eFieldVPerM: uiState.transportEFieldVPerM,
      readObs: true,
      nonBlocking: true
    }).then((tel) => {
      if (!tel) return;
      liveTransportTelemetry = tel;
      liveTransportHistory.push({ T: tel.temperatureK, drift: tel.meanDriftNorm, scatter: tel.measuredScatterRateFrac, sigma: tel.sigmaGpuSPerM });
      if (liveTransportHistory.length > 70) liveTransportHistory.shift();
      if (window.__ulgElementsLabState) window.__ulgElementsLabState.transportTelemetry = tel;
      if (currentTab === 'crystal' && uiState.crystalViewMode === 'transport') redrawCurrentTab();
    }).catch(() => {}).finally(() => { liveTransportBusy = false; });
  }

  // 2. Live WebGPU 1D Symplectic Quantum Tunneling TDSE / 3D Fission Playback on Tab 1!
  if (currentTab === 'nuclear' && activeSpecimenKind === 'element' && uiState.nuclearViewMode === 'fission' && uiState.fissionPlaying && frameCounter % 3 === 0) {
    uiState.fissionBeta2 += 0.025;
    if (uiState.fissionBeta2 > 1.35) uiState.fissionBeta2 = 0.0;
    const fSl = document.getElementById('ctrl-fiss-b2');
    const fLb = document.getElementById('lbl-fiss-b2');
    if (fSl) fSl.value = String(uiState.fissionBeta2);
    if (fLb) fLb.textContent = uiState.fissionBeta2.toFixed(2);
    updateNuclearFissionVolume();
    redrawCurrentTab();
  }
  if (currentTab === 'nuclear' && activeSpecimenKind === 'element' && uiState.nuclearViewMode === 'tdse' && liveTdseSession && uiState.tdsePlaying && !liveTdseBusy && frameCounter % 3 === 0) {
    liveTdseBusy = true;
    liveTdseSession.stepBatch(14, { nonBlocking: true }).then((tel) => {
      if (!tel) return;
      liveTdseTelemetry = tel;
      if (tel.stepCount >= 1400) liveTdseSession.resetWavepacket();
      if (window.__ulgElementsLabState) {
        window.__ulgElementsLabState.tdseTelemetry = {
          stepCount: tel.stepCount,
          pInside: tel.pInside,
          pBarrier: tel.pBarrier,
          pTunneled: tel.pTunneled
        };
      }
      if (currentTab === 'nuclear') redrawCurrentTab();
    }).catch(() => {}).finally(() => { liveTdseBusy = false; });
  }

  // 3. Live WebGPU CI-NEB Reaction Path Playback on Tab 5!
  if (currentTab === 'compound' && uiState.nebPlaying && currentNebBarrier?.energiesEv?.length >= 2) {
    if (nowMs - uiState.nebLastTickMs >= 520) {
      uiState.nebLastTickMs = nowMs;
      uiState.nebImageIdx = (uiState.nebImageIdx + 1) % currentNebBarrier.energiesEv.length;
      renderSimControls();
      redrawCurrentTab();
    }
  }

  // 4. Synchronous WebGPU viewport render (zero await before getCurrentTexture!)
  renderViewportSync();

  // 5. Live Zero-Copy WebGPU Molecular Dynamics stepping on Tab 4 (Elements AND Backfed Compounds!)
  if (currentTab === 'md' && liveMdSession && uiState.mdPlaying && !liveMdBusy) {
    liveMdBusy = true;
    const nptTarget = (uiState.mdMode === 'strain' || (uiState.mdMode === 'equilibrium' && uiState.mdNptBarostat)) ? 0.0 : null;
    liveMdSession.stepBatch(4, {
      readTelemetry: true,
      temperatureK: uiState.mdTargetTempK,
      nptBarostatGPa: nptTarget,
      nonBlocking: true
    })
      .then((tel) => {
        if (!tel || !liveMdSession) return;
        liveMdTelemetry = tel;
        liveMdHistory.push({ t: tel.timeFs, T: tel.temperatureK, msd: tel.msdA2 });
        if (liveMdHistory.length > 80) liveMdHistory.shift();
        liveMdVacfHistory.push(tel.vacf ?? 0);
        if (liveMdVacfHistory.length > 64) liveMdVacfHistory.shift();
        if (uiState.mdMode === 'strain') {
          liveMdStrainHistory.push({ eps: tel.strainX || 0, pxx: tel.diagPressureGPa?.[0] ?? tel.pressureGPa });
          if (liveMdStrainHistory.length > 60) liveMdStrainHistory.shift();
        }
        if (window.__ulgElementsLabState) window.__ulgElementsLabState.mdTelemetry = tel;
        if (currentTab === 'md') redrawCurrentTab();
      })
      .catch(() => {})
      .finally(() => { liveMdBusy = false; });
  }

  scheduleNextFrame();
}

// ============================================================================
// High-Level Derivation, Reaction Discovery & Compound Backfeed Flows
// ============================================================================

async function rebuildPolytopeAtlasForRegime(regime) {
  const b = getActiveBundle();
  if (!gpuDevice || !b) return;
  uiState.polytopeRegime = regime;
  uiState.polytopeProbe = null;
  statusBadge.textContent = `Fitting ${b.materialKey} ${regime} Atlas…`;
  try {
    const pMax = regime === 'planetary' ? 1e12 : 1e10;
    currentAtlas = await buildMaterialPolytopeAtlasWebGpu(gpuDevice, b, {
      degrees: [4, 3],
      relativeTolerance: 0.05,
      maxBisectDepth: 2,
      pressureRangePa: [1e2, pMax],
      materialIndex: b.atomicNumber || 0
    });
    if (window.__ulgElementsLabState) {
      window.__ulgElementsLabState.atlasPolytopeCount = currentAtlas.polytopeCount;
    }
    statusBadge.textContent = `${b.materialKey} · ${regime} Atlas OK`;
    renderSimControls();
    redrawCurrentTab();
  } catch (err) {
    statusBadge.textContent = `Atlas err: ${err.message}`;
  }
}

async function runElementDerivation(Z, massNumberA = null, { preserveQuantumNumbers = false, switchToTab = null } = {}) {
  if (!gpuDevice) return;
  const resolvedA = massNumberA != null && Number.isFinite(Number(massNumberA))
    ? Math.max(Z, Math.min(310, Math.trunc(Number(massNumberA))))
    : null;
  const label = resolvedA != null ? `${symbolForZ(Z)}-${resolvedA}` : `${symbolForZ(Z)} (Z=${Z})`;
  statusBadge.textContent = `Solving ${label}…`;
  activeSpecimenKind = 'element';
  updateActiveElementButton();
  try {
    currentElementRes = await deriveElementBundleWebGpu(gpuDevice, Z, {
      massNumberA: resolvedA,
      runNuclearGpuVolume: true,
      runLiveMd: true,
      mdSteps: 16,
      atomicMaxScf: 50,
      nuclearVolDim: 24,
      blochGridN: 16,
      functional: uiState.functional,
      scalarRelativistic: uiState.relativisticSpinOrbit,
      spinOrbit: uiState.relativisticSpinOrbit,
      returnOrbitalWavefunctions: true
    });
    const atom = currentElementRes.visualData.atom;
    const unpaired = currentElementRes.bundle.atomic.unpairedElectrons || 0;
    if (!preserveQuantumNumbers) {
      const defQ = defaultValenceQuantumNumbers(Z);
      uiState.n = defQ.n;
      uiState.l = defQ.l;
      uiState.m = defQ.m;
    }
    currentAtomicVolGpu = gpuRenderer.buildAtomicVolumeOnGpu({
      rGrid: atom.radialGrid.r,
      rhoGrid: atom.radialGrid.rho,
      valenceL: uiState.l,
      unpairedCount: unpaired,
      totalElectrons: atom.electronCount,
      dim: 32
    });
    uiState.ionizedCation = false;
    liveDeltaScfResult = null;
    updateStarkStateForActiveElement();
    rebuildOrbitalPointCloud();
    initPhotonShellSessionForActiveSpecimen();
    initSpinLatticeForActiveSpecimen();
    initElectronTransportForActiveSpecimen();
    initNuclearTdseForActiveElement();

    const actualA = currentElementRes.bundle.nuclear.A;
    if (aInput) aInput.value = String(actualA);
    currentDecayChain = deriveNuclearDecayChain(Z, actualA, { maxDepth: 12 });
    liveBatemanSeries = computeBatemanDecayCurves(currentDecayChain);
    updateNuclearFissionVolume();
    const pMax = uiState.polytopeRegime === 'planetary' ? 1e12 : 1e10;
    currentAtlas = await buildMaterialPolytopeAtlasWebGpu(gpuDevice, currentElementRes.bundle, {
      degrees: [4, 3], relativeTolerance: 0.05, maxBisectDepth: 2, pressureRangePa: [1e2, pMax], materialIndex: Z
    });
    uiState.polytopeProbe = null;
    initLiveMdForActiveSpecimen();
    renderBundleCard(currentElementRes.bundle, currentDecayChain);
    renderG7Card(currentElementRes.bundle, currentElementRes.g7Advisory);
    pushSpecimenHistory({ kind: 'element', Z, A: actualA, label: currentElementRes.bundle.nuclear.isotope });
    if (switchToTab) setActiveTab(switchToTab);
    else {
      renderSimControls();
      redrawCurrentTab();
    }
    statusBadge.textContent = `${currentElementRes.bundle.nuclear.isotope} · WebGPU OK`;
    syncDebugState();
  } catch (err) {
    statusBadge.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

async function rebuildNebImageClouds() {
  for (const c of currentNebImageClouds) {
    if (c?.pointsBuffer) {
      try { c.pointsBuffer.destroy(); } catch {}
    }
  }
  currentNebImageClouds = [];
  if (!gpuDevice || !currentNebBarrier?.imageOrbitalParams?.length) return;
  for (const params of currentNebBarrier.imageOrbitalParams) {
    const cloud = sampleMolecularOrbitalCloudWebGpu(gpuDevice, {
      posZeta: params.posZeta,
      weights: params.weights,
      boxHalfBohr: params.boxHalfBohr,
      mode: uiState.molOrbitalMode,
      pointCount: IS_MOBILE_GPU_PROFILE ? 50000 : 110000,
      seed: 1
    });
    currentNebImageClouds.push(cloud);
  }
}

async function computeLiveCiNebBarrierWebGpu(compoundRes) {
  const atoms = compoundRes?.visualData?.molQm?.atoms;
  if (!gpuDevice || !Array.isArray(atoms) || atoms.length < 2 || atoms.length > 5) return null;
  if (atoms.some((a) => a.Z > 10)) return null;
  const reactant = atoms.map((a) => ({ Z: a.Z, position: [a.x, a.y, a.z] }));
  let product;
  let pathwayLabel;
  if (atoms.length >= 3) {
    product = atoms.map((a, idx) => (idx === 0
      ? { Z: a.Z, position: [a.x, a.y, a.z] }
      : { Z: a.Z, position: [a.x, -a.y, a.z] }));
    pathwayLabel = 'molecular inversion TS (WebGPU)';
  } else {
    product = atoms.map((a, idx) => (idx === 0
      ? { Z: a.Z, position: [a.x, a.y, a.z] }
      : { Z: a.Z, position: [a.x * 1.85, a.y * 1.85, a.z * 1.85] }));
    pathwayLabel = 'bond stretch MEP (WebGPU)';
  }
  try {
    const neb = await climbingImageNEBWebGpu(gpuDevice, reactant, product, {
      nImages: 5,
      maxSteps: 4,
      stepSize: 0.14,
      climbStartStep: 1,
      basisName: 'sto-3g'
    });
    const e0 = neb.energiesHa[0];
    const HA_TO_EV = 27.211386245988;
    const energiesEv = neb.energiesHa.map((e) => (e - e0) * HA_TO_EV);
    // Solve GPU RHF orbital envelopes at every NEB image so scrubbing ξ: 0 → 1 shows REAL orbital evolution!
    const imageOrbitalParams = [];
    for (const imgAtoms of neb.images) {
      const rhf = await solveMoleculeRhfWebGpu(gpuDevice, imgAtoms, {
        maxScf: 22, volDim: 16, sampleVolume: true
      });
      if (rhf?.atomOrbitalParams) imageOrbitalParams.push(rhf.atomOrbitalParams);
    }
    return {
      backend: neb.backend,
      gpuRhfCalls: neb.gpuRhfCalls + imageOrbitalParams.length,
      pathwayLabel,
      saddleImageIndex: neb.saddleImageIndex,
      forwardBarrierEv: neb.forwardBarrierHa * HA_TO_EV,
      reverseBarrierEv: neb.reverseBarrierHa * HA_TO_EV,
      energiesHa: neb.energiesHa,
      energiesEv,
      steps: neb.steps,
      imageOrbitalParams
    };
  } catch {
    return null;
  }
}

function buildCompositeNuclearForCompound(compoundRes) {
  if (!gpuRenderer || !compoundRes) return null;
  const molAtoms = compoundRes.visualData?.molQm?.atoms;
  const sites = compoundRes.bundle.nuclear.isotopologueSites || [];
  let nuclei = [];
  if (Array.isArray(molAtoms) && molAtoms.length > 0) {
    nuclei = molAtoms.map((a, idx) => {
      const site = sites[idx] || { Z: a.Z, A: mostStableMassNumberForZ(a.Z) };
      const nuc = deriveNuclearClosure(site.Z, site.A);
      return { x: a.x, y: a.y, z: a.z, Z: nuc.Z, N: nuc.N, chargeRadiusFm: nuc.chargeRadiusFm };
    });
  } else {
    // Arrange ionic/covalent formula-unit nuclei symmetrically
    const expanded = [];
    for (const s of sites) {
      const nuc = deriveNuclearClosure(s.Z, s.A);
      for (let k = 0; k < Math.min(4, s.count || 1); k += 1) expanded.push(nuc);
    }
    const n = Math.max(1, expanded.length);
    nuclei = expanded.map((nuc, idx) => {
      const ang = (idx / n) * Math.PI * 2;
      return {
        x: n === 1 ? 0 : Math.cos(ang),
        y: n === 1 ? 0 : Math.sin(ang) * 0.5,
        z: n === 1 ? 0 : Math.sin(ang) * 0.7,
        Z: nuc.Z,
        N: nuc.N,
        chargeRadiusFm: nuc.chargeRadiusFm
      };
    });
  }
  return gpuRenderer.buildCompositeNuclearVolumeOnGpu(nuclei, 24);
}

/**
 * Backfeed ANY derived or reaction-discovered compound directly into ALL 6
 * property, quantum orbital, photon-shell optics, live MD & Polytope Atlas sims!
 */
async function activateCompoundBackfeed(compoundRes, targetTab = 'crystal') {
  if (!gpuDevice || !compoundRes) return;
  currentCompoundRes = compoundRes;
  activeSpecimenKind = 'compound';
  updateActiveElementButton();
  currentCompoundNuclearVolGpu = buildCompositeNuclearForCompound(compoundRes);
  currentCompoundLattice = buildCrystalMdState({
    crystalStructure: compoundRes.bundle.mechanical.crystalStructure,
    cellsPerSide: 2,
    latticeConstantA: Math.max(2.6, Number(compoundRes.bundle.mechanical.latticeConstantA || 4.2)),
    massU: Math.max(2, Number(compoundRes.bundle.nuclear.molarMassU || 28)),
    temperatureK: 300
  });
  rebuildOrbitalPointCloud();
  initPhotonShellSessionForActiveSpecimen();
  initSpinLatticeForActiveSpecimen();
  initElectronTransportForActiveSpecimen();
  initLiveMdForActiveSpecimen();
  const pMax = uiState.polytopeRegime === 'planetary' ? 1e12 : 1e10;
  currentAtlas = await buildMaterialPolytopeAtlasWebGpu(gpuDevice, compoundRes.bundle, {
    degrees: [4, 3], relativeTolerance: 0.05, maxBisectDepth: 2, pressureRangePa: [1e2, pMax]
  });
  uiState.polytopeProbe = null;
  renderBundleCard(compoundRes.bundle);
  renderG7Card(compoundRes.bundle, { hasReference: false, note: 'Backfed compound running live across Nuclear, RHF QM, Maxwell Photon–Shell Optics, WebGPU MD & Polytope Atlas.' });
  pushSpecimenHistory({ kind: 'compound', formula: compoundRes.bundle.materialKey, label: compoundRes.bundle.materialKey });
  setActiveTab(targetTab);
  statusBadge.textContent = `${compoundRes.bundle.materialKey} · Backfed OK`;
  syncDebugState();
}

async function runCompoundDerivation(formula, { backfeedAllTabs = false, switchToTab = 'compound' } = {}) {
  if (!gpuDevice) return;
  statusBadge.textContent = `Deriving ${formula}…`;
  try {
    currentCompoundRes = await deriveCompoundBundleWebGpu(gpuDevice, formula, {
      runLiveMd: true,
      mdSteps: 10,
      mdCellsPerSide: 2,
      reactionContext: { source: 'elements-lab-interactive' }
    });
    currentCompoundNuclearVolGpu = buildCompositeNuclearForCompound(currentCompoundRes);
    currentCompoundLattice = buildCrystalMdState({
      crystalStructure: currentCompoundRes.bundle.mechanical.crystalStructure,
      cellsPerSide: 2,
      latticeConstantA: Math.max(2.6, Number(currentCompoundRes.bundle.mechanical.latticeConstantA || 4.2)),
      massU: Math.max(2, Number(currentCompoundRes.bundle.nuclear.molarMassU || 28)),
      temperatureK: 300
    });
    currentNebBarrier = await computeLiveCiNebBarrierWebGpu(currentCompoundRes);
    uiState.nebImageIdx = currentNebBarrier ? currentNebBarrier.saddleImageIndex : 0;
    await rebuildNebImageClouds();

    activeSpecimenKind = 'compound';
    updateActiveElementButton();
    rebuildOrbitalPointCloud();
    initPhotonShellSessionForActiveSpecimen();
    initSpinLatticeForActiveSpecimen();
    initElectronTransportForActiveSpecimen();
    initLiveMdForActiveSpecimen();

    const pMax = uiState.polytopeRegime === 'planetary' ? 1e12 : 1e10;
    currentAtlas = await buildMaterialPolytopeAtlasWebGpu(gpuDevice, currentCompoundRes.bundle, {
      degrees: [4, 3], relativeTolerance: 0.05, maxBisectDepth: 2, pressureRangePa: [1e2, pMax]
    });
    uiState.polytopeProbe = null;
    renderBundleCard(currentCompoundRes.bundle);
    renderG7Card(currentCompoundRes.bundle, { hasReference: false, note: 'Recursive compound feedback bundle (zero hardcoded compound table).' });
    pushSpecimenHistory({ kind: 'compound', formula: currentCompoundRes.bundle.materialKey, label: currentCompoundRes.bundle.materialKey });
    setActiveTab(backfeedAllTabs ? switchToTab : 'compound');
    statusBadge.textContent = `${formula} · Compound OK`;
    syncDebugState();
  } catch (err) {
    statusBadge.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

async function runReactionCombiner(aRaw, bRaw) {
  if (!gpuDevice) return;
  const a = String(aRaw || '').trim();
  const b = String(bRaw || '').trim();
  if (!a || !b) return;
  statusBadge.textContent = `Reacting ${a} + ${b}…`;
  try {
    const rxn = await discoverAndDeriveReactionProductsWebGpu(gpuDevice, [a, b], {
      runLiveMd: true,
      mdSteps: 10,
      mdCellsPerSide: 2
    });
    currentReactionRes = rxn;
    if (!rxn.derivedProducts.length) {
      reactionResultsEl.innerHTML = `<div class="product-card" style="border-color:rgba(248,113,113,0.45);">No balanced reaction candidate found for <b>${a} + ${b}</b>. Try e.g. Na+H2O, H2+O2, Na+Cl2, Fe+O2, Cs+F2.</div>`;
      statusBadge.textContent = 'No reaction candidate';
      return;
    }
    const cand = rxn.candidates?.[0];
    const dHKj = cand?.energetics?.reactionEnthalpyJPerBalancedEquation != null
      ? `${fmt(cand.energetics.reactionEnthalpyJPerBalancedEquation * 1e-3, 1)} kJ/mol`
      : 'derived';
    let html = `<div class="product-card">
      <div style="font-weight:700;color:#e9d5ff;margin-bottom:3px;">${cand?.equation || `${a} + ${b} → ${rxn.productFormulas.join(' + ')}`}</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">${cand?.familyLabel || 'Stoichiometric discovery'} · ΔH = ${dHKj}</div>`;
    rxn.derivedProducts.forEach((prodRes, idx) => {
      const pb = prodRes.bundle;
      html += `<button class="action backfeed-btn" data-bf-idx="${idx}">Backfeed ${pb.materialKey} (ρ=${fmt(pb.mechanical.densityKgPerM3, 0)} · T_m=${fmt(pb.thermodynamic.meltingPointK, 0)}K · n=${fmt(pb.electromagnetic.refractiveIndex550Nm, 2)}) → All Sims</button>`;
    });
    html += `</div>`;
    reactionResultsEl.innerHTML = html;
    for (const btn of reactionResultsEl.querySelectorAll('[data-bf-idx]')) {
      btn.addEventListener('click', () => {
        const prod = rxn.derivedProducts[Number(btn.dataset.bfIdx)];
        setMobileDrawerOpen(false);
        if (prod) activateCompoundBackfeed(prod, 'crystal');
      });
    }
    // Load the first discovered product into Tab 5 (with CI-NEB) AND let user one-click backfeed any product!
    const primary = rxn.derivedProducts[0];
    compoundInput.value = primary.bundle.materialKey;
    currentCompoundRes = primary;
    currentCompoundNuclearVolGpu = buildCompositeNuclearForCompound(primary);
    currentCompoundLattice = buildCrystalMdState({
      crystalStructure: primary.bundle.mechanical.crystalStructure,
      cellsPerSide: 2,
      latticeConstantA: Math.max(2.6, Number(primary.bundle.mechanical.latticeConstantA || 4.2)),
      massU: Math.max(2, Number(primary.bundle.nuclear.molarMassU || 28)),
      temperatureK: 300
    });
    currentNebBarrier = await computeLiveCiNebBarrierWebGpu(primary);
    uiState.nebImageIdx = currentNebBarrier ? currentNebBarrier.saddleImageIndex : 0;
    await rebuildNebImageClouds();
    activeSpecimenKind = 'compound';
    updateActiveElementButton();
    rebuildOrbitalPointCloud();
    initPhotonShellSessionForActiveSpecimen();
    initSpinLatticeForActiveSpecimen();
    initElectronTransportForActiveSpecimen();
    initLiveMdForActiveSpecimen();
    currentAtlas = await buildMaterialPolytopeAtlasWebGpu(gpuDevice, primary.bundle, {
      degrees: [4, 3], relativeTolerance: 0.05, maxBisectDepth: 2
    });
    renderBundleCard(primary.bundle);
    renderG7Card(primary.bundle, { hasReference: false, note: `Discovered from ${a} + ${b}; click Backfeed to run across all tabs.` });
    pushSpecimenHistory({ kind: 'compound', formula: primary.bundle.materialKey, label: primary.bundle.materialKey });
    setActiveTab('compound');
    statusBadge.textContent = `${a}+${b} → ${rxn.productFormulas.join('+')} OK`;
    syncDebugState();
  } catch (err) {
    statusBadge.textContent = `Reaction err: ${err.message}`;
    console.error(err);
  }
}

function setActiveTab(tabName) {
  currentTab = tabName;
  for (const b of document.querySelectorAll('.tab-btn')) {
    const isAct = b.dataset.tab === tabName;
    b.classList.toggle('active', isAct);
    if (isAct && isDrawerMode()) {
      b.scrollIntoView?.({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }
  renderSimControls();
  redrawCurrentTab();
  syncDebugState();
}

function syncDebugState() {
  const b = getActiveBundle();
  const isComp = activeSpecimenKind === 'compound';
  window.__ulgElementsLabState = {
    mode: isComp ? 'compound' : 'element',
    activeSpecimenKind,
    currentTab,
    rendererBackend: 'webgpu',
    isMobileProfile: IS_MOBILE_GPU_PROFILE,
    camera: { yaw: camYaw, pitch: camPitch, dist: camDist },
    cameraAutoSpin: false,
    mdPerFrameCpuPositionReadback: false,
    Z: isComp ? null : selectedZ,
    A: isComp ? null : (currentElementRes?.bundle?.nuclear?.A ?? selectedA),
    isotope: isComp ? null : (currentElementRes?.bundle?.nuclear?.isotope ?? null),
    formula: isComp ? (currentCompoundRes?.bundle?.materialKey ?? null) : null,
    backfedFormula: isComp ? (currentCompoundRes?.bundle?.materialKey ?? null) : null,
    relativisticSpinOrbit: uiState.relativisticSpinOrbit,
    functional: uiState.functional,
    bundle: b,
    decayChain: currentDecayChain,
    nebBackend: currentNebBarrier?.backend ?? null,
    nebBarrier: currentNebBarrier,
    atlasPolytopeCount: currentAtlas?.polytopeCount ?? 0,
    polytopeProbe: uiState.polytopeProbe,
    photonTelemetry: livePhotonTelemetry,
    spinTelemetry: liveSpinTelemetry,
    transportTelemetry: liveTransportTelemetry,
    mdTelemetry: liveMdTelemetry,
    starkState: liveStarkState,
    deltaScfResult: liveDeltaScfResult ? { ionizationEnergyEv: liveDeltaScfResult.ionizationEnergyEv, removedShell: liveDeltaScfResult.removedShell } : null,
    fissionCurve: liveFissionCurve ? { fissility: liveFissionCurve.fissility, barrierMeV: liveFissionCurve.barrierMeV, saddleBeta: liveFissionCurve.saddleBeta } : null,
    batemanCurves: liveBatemanSeries?.curves?.length ?? 0,
    tdseTelemetry: liveTdseTelemetry
      ? { stepCount: liveTdseTelemetry.stepCount, pInside: liveTdseTelemetry.pInside, pTunneled: liveTdseTelemetry.pTunneled }
      : null,
    orbitalCloudStats: liveOrbitalCloud
      ? { pointCount: liveOrbitalCloud.pointCount, n: liveOrbitalCloud.n, l: liveOrbitalCloud.l, m: liveOrbitalCloud.m, sourceKind: liveOrbitalCloud.sourceKind }
      : null,
    registeredModules: defaultSimulationModuleRegistry.listModules().map((m) => m.methodKey),
    closureCount: labClosureStore.size,
    g7Advisory: isComp ? null : currentElementRes?.g7Advisory
  };
  // Clean programmatic test/verification API (used by headless Vulkan PNG capture!)
  window.__ulgElementsLabApi = {
    setTab: (t) => setActiveTab(t),
    solveElement: (Z, A = null, opts = {}) => {
      selectedZ = Z; selectedA = A;
      zInput.value = String(Z);
      if (aInput) aInput.value = String(A ?? mostStableMassNumberForZ(Z));
      return runElementDerivation(Z, A, opts);
    },
    setRelativistic: (enabled) => {
      uiState.relativisticSpinOrbit = Boolean(enabled);
      return runElementDerivation(selectedZ, selectedA, { preserveQuantumNumbers: true });
    },
    setOrbital: (n, l, m) => {
      uiState.n = n; uiState.l = l; uiState.m = m;
      rebuildOrbitalPointCloud();
      renderSimControls();
      redrawCurrentTab();
    },
    setCrystalViewMode: (mode) => {
      uiState.crystalViewMode = mode;
      renderSimControls();
      redrawCurrentTab();
    },
    stepTdks: (steps = 40) => {
      if (!liveBlochSession) return null;
      for (let i = 0; i < steps; i += 1) liveBlochSession.stepFs(0.065);
      redrawCurrentTab();
      return liveBlochSession.channels.map((c) => ({
        nm: c.wavelengthNm, rho11: c.rho11, dipole: c.dipole, absorbed: c.absorbedEnergy
      }));
    },
    stepPhotonFdtd: async (steps = 220) => {
      if (!livePhotonSession) return null;
      const tel = await livePhotonSession.stepBatch(steps, { readObs: true });
      if (tel) livePhotonTelemetry = tel;
      redrawCurrentTab();
      syncDebugState();
      return tel;
    },
    stepTdse: async (steps = 120) => {
      if (!liveTdseSession) return null;
      const tel = await liveTdseSession.stepBatch(steps);
      if (tel) liveTdseTelemetry = tel;
      redrawCurrentTab();
      syncDebugState();
      return tel;
    },
    runReaction: (a, b) => runReactionCombiner(a, b),
    backfeedCompound: (formula, tab = 'crystal') => runCompoundDerivation(formula, { backfeedAllTabs: true, switchToTab: tab }),
    probePolytope: async (T, P) => {
      if (!currentAtlas || !gpuRenderer) return null;
      const res = await gpuRenderer.probePolytopeAtlasOnGpu(currentAtlas, T, P);
      const bounds = gpuRenderer.getPolytopeAxisBounds(currentAtlas);
      const fx = (Math.log10(Math.max(1, T)) - bounds.minLt) / Math.max(1e-6, bounds.maxLt - bounds.minLt);
      const fy = (Math.log10(Math.max(1e-6, P)) - bounds.minLp) / Math.max(1e-6, bounds.maxLp - bounds.minLp);
      uiState.polytopeProbe = { ...res, fx, fy };
      redrawCurrentTab();
      syncDebugState();
      return res;
    },
    captureCanvasDataUrl: () => new Promise((resolve) => {
      requestAnimationFrame(() => {
        renderViewportSync();
        resolve(canvas.toDataURL('image/png'));
      });
    }),
    getCamera: () => ({ yaw: camYaw, pitch: camPitch, dist: camDist }),
    setNuclearMode: (mode, beta2 = null) => {
      uiState.nuclearViewMode = mode;
      if (beta2 != null) uiState.fissionBeta2 = Number(beta2);
      if (mode === 'fission') updateNuclearFissionVolume();
      renderSimControls();
      redrawCurrentTab();
      syncDebugState();
    },
    setStarkField: (eVPerA) => {
      uiState.starkFieldVPerA = Number(eVPerA) || 0;
      updateStarkStateForActiveElement();
      renderSimControls();
      redrawCurrentTab();
      syncDebugState();
      return liveStarkState;
    },
    triggerDeltaScfIonize: async (enable = true) => {
      await toggleDeltaScfIonization(enable);
      return liveDeltaScfResult ? { ionizationEnergyEv: liveDeltaScfResult.ionizationEnergyEv, removedShell: liveDeltaScfResult.removedShell } : null;
    },
    stepSpinLattice: async (steps = 48, { temperatureK = null, fieldBZTesla = null } = {}) => {
      if (!liveSpinSession) initSpinLatticeForActiveSpecimen();
      if (!liveSpinSession) return null;
      if (temperatureK != null) uiState.spinTempK = temperatureK;
      if (fieldBZTesla != null) uiState.spinFieldBTesla = fieldBZTesla;
      const tel = await liveSpinSession.stepBatch(steps, { temperatureK: uiState.spinTempK, fieldBZTesla: uiState.spinFieldBTesla, readObs: true });
      if (tel) {
        liveSpinTelemetry = tel;
        liveSpinHistory.push({ B: tel.fieldBZTesla, Mz: tel.magnetizationZ, Mmag: tel.magnetizationMag, Mstag: tel.staggeredOrderMag, T: tel.temperatureK });
      }
      redrawCurrentTab();
      syncDebugState();
      return tel;
    },
    stepElectronTransport: async (steps = 32, { temperatureK = null, eFieldVPerM = null } = {}) => {
      if (!liveTransportSession) initElectronTransportForActiveSpecimen(temperatureK);
      if (!liveTransportSession) return null;
      if (temperatureK != null) uiState.transportTempK = temperatureK;
      if (eFieldVPerM != null) uiState.transportEFieldVPerM = eFieldVPerM;
      const tel = await liveTransportSession.stepBatch(steps, { temperatureK: uiState.transportTempK, eFieldVPerM: uiState.transportEFieldVPerM, readObs: true });
      if (tel) {
        liveTransportTelemetry = tel;
        liveTransportHistory.push({ T: tel.temperatureK, drift: tel.meanDriftNorm, scatter: tel.measuredScatterRateFrac, sigma: tel.sigmaGpuSPerM });
      }
      redrawCurrentTab();
      syncDebugState();
      return tel;
    },
    setMdMode: (mode, tempK = null) => {
      initLiveMdForActiveSpecimen(tempK, mode);
      renderSimControls();
      redrawCurrentTab();
      syncDebugState();
    },
    stepMd: async (steps = 16, { strainX = 0, shearXY = 0, pulse = null, npt = false } = {}) => {
      if (!liveMdSession) return null;
      if (strainX || shearXY) liveMdSession.applyStrain({ strainX, shearXY });
      if (pulse) liveMdSession.injectAcousticPulse({ polarization: pulse, amplitude: 0.36 });
      const tel = await liveMdSession.stepBatch(steps, {
        readTelemetry: true,
        temperatureK: uiState.mdTargetTempK,
        nptBarostatGPa: npt ? 0.0 : null
      });
      if (tel) {
        liveMdTelemetry = tel;
        liveMdHistory.push({ t: tel.timeFs, T: tel.temperatureK, msd: tel.msdA2 });
        liveMdVacfHistory.push(tel.vacf ?? 0);
        if (uiState.mdMode === 'strain') liveMdStrainHistory.push({ eps: tel.strainX || 0, pxx: tel.diagPressureGPa?.[0] ?? tel.pressureGPa });
      }
      redrawCurrentTab();
      syncDebugState();
      return tel;
    }
  };
}

// ============================================================================
// Boot Sequence
// ============================================================================

async function boot() {
  buildPeriodicTableButtons();
  attachCanvasInteractions();

  // Mobile slide-over drawer controls & keyboard Escape close
  mobileDrawerBtn?.addEventListener('click', () => setMobileDrawerOpen(!document.body.classList.contains('drawer-open')));
  mobileDrawerClose?.addEventListener('click', () => setMobileDrawerOpen(false));
  drawerBackdrop?.addEventListener('click', () => setMobileDrawerOpen(false));
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') setMobileDrawerOpen(false);
  });
  webgpuReloadBtn?.addEventListener('click', () => window.location.reload());

  for (const btn of document.querySelectorAll('.tab-btn')) {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  }

  // Quick hero showcase presets (sidebar + mobile quick bar!)
  for (const chip of document.querySelectorAll('#hero-presets [data-hero-z], #mobile-quick-presets [data-hero-z]')) {
    chip.addEventListener('click', () => {
      const z = Number(chip.dataset.heroZ);
      const a = chip.dataset.heroA ? Number(chip.dataset.heroA) : null;
      const tab = chip.dataset.heroTab || null;
      const cview = chip.dataset.heroCview || null;
      selectedZ = z; selectedA = a;
      zInput.value = String(z);
      if (aInput) aInput.value = String(a ?? mostStableMassNumberForZ(z));
      if (tab === 'crystal') uiState.crystalViewMode = cview || 'photon-shell';
      if (tab === 'nuclear' && z >= 90) { uiState.nuclearViewMode = 'fission'; uiState.fissionBeta2 = 0.72; }
      setMobileDrawerOpen(false);
      runElementDerivation(z, a, { switchToTab: tab });
    });
  }
  for (const chip of document.querySelectorAll('#hero-presets [data-hero-compound], #mobile-quick-presets [data-hero-compound]')) {
    chip.addEventListener('click', () => {
      const f = chip.dataset.heroCompound;
      const tab = chip.dataset.heroTab || 'crystal';
      compoundInput.value = f;
      if (tab === 'crystal') uiState.crystalViewMode = 'photon-shell';
      setMobileDrawerOpen(false);
      runCompoundDerivation(f, { backfeedAllTabs: true, switchToTab: tab });
    });
  }
  for (const chip of document.querySelectorAll('#hero-presets [data-hero-react], #mobile-quick-presets [data-hero-react]')) {
    chip.addEventListener('click', () => {
      const [a, b] = chip.dataset.heroReact.split('|');
      if (reactantAInput) reactantAInput.value = a;
      if (reactantBInput) reactantBInput.value = b;
      setMobileDrawerOpen(false);
      runReactionCombiner(a, b);
    });
  }
  for (const chip of document.querySelectorAll('#reaction-presets [data-rxn]')) {
    chip.addEventListener('click', () => {
      const [a, b] = chip.dataset.rxn.split('|');
      if (reactantAInput) reactantAInput.value = a;
      if (reactantBInput) reactantBInput.value = b;
      setMobileDrawerOpen(false);
      runReactionCombiner(a, b);
    });
  }

  solveZBtn.addEventListener('click', () => {
    const z = Math.max(1, Math.min(118, Math.trunc(Number(zInput.value) || 26)));
    const aRaw = aInput?.value?.trim();
    const parsedA = aRaw ? Math.trunc(Number(aRaw)) : null;
    selectedZ = z;
    selectedA = parsedA && parsedA >= z && parsedA <= 310 ? parsedA : null;
    setMobileDrawerOpen(false);
    runElementDerivation(z, selectedA);
  });
  resetABtn?.addEventListener('click', () => {
    const z = Math.max(1, Math.min(118, Math.trunc(Number(zInput.value) || selectedZ)));
    selectedZ = z; selectedA = null;
    if (aInput) aInput.value = String(mostStableMassNumberForZ(z));
    setMobileDrawerOpen(false);
    runElementDerivation(z, null);
  });
  runReactionBtn?.addEventListener('click', () => {
    setMobileDrawerOpen(false);
    runReactionCombiner(reactantAInput?.value, reactantBInput?.value);
  });
  solveCompoundBtn.addEventListener('click', () => {
    setMobileDrawerOpen(false);
    runCompoundDerivation(compoundInput.value || 'H2O');
  });

  plot1.style.cursor = 'crosshair';
  plot1.addEventListener('click', (ev) => {
    if (currentTab !== 'nuclear' || !currentElementRes?.visualData?.nuclear?.chartDims) return;
    const rect = plot1.getBoundingClientRect();
    const cx = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * plot1.width;
    const cy = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * plot1.height;
    const { maxZ, maxN } = currentElementRes.visualData.nuclear.chartDims;
    const nClick = Math.round(((cx - 12) / Math.max(1, plot1.width - 24)) * maxN);
    const zClick = Math.round(((plot1.height - 12 - cy) / Math.max(1, plot1.height - 24)) * maxZ);
    if (zClick >= 1 && zClick <= maxZ && nClick >= 0 && nClick < maxN) {
      selectedZ = zClick;
      selectedA = zClick + nClick;
      zInput.value = String(selectedZ);
      if (aInput) aInput.value = String(selectedA);
      runElementDerivation(selectedZ, selectedA);
    }
  });

  let adapter = null;
  if (!navigator.gpu) {
    statusBadge.textContent = 'WebGPU unavailable (fail-closed)';
    showWebGpuFallback(
      'WebGPU Not Supported in This Browser',
      'ULG Material Physics Lab runs live Dirac–KS, TD-KS, 2D Maxwell–FDTD, MD, and Polytope compute shaders on WebGPU. Use Chrome 121+ on Android/Desktop or Safari 26+ on iOS/macOS over HTTPS.'
    );
    return;
  }
  for (let attempt = 0; attempt < 8 && !adapter; attempt += 1) {
    try {
      adapter = await navigator.gpu.requestAdapter(attempt < 4 ? { powerPreference: 'high-performance' } : undefined);
    } catch {
      adapter = null;
    }
    if (!adapter) await new Promise((r) => setTimeout(r, 200));
  }
  if (!adapter) {
    statusBadge.textContent = 'WebGPU adapter unavailable';
    showWebGpuFallback(
      'WebGPU GPU Adapter Unavailable',
      'Your browser exposes navigator.gpu, but no compatible WebGPU hardware adapter was returned. Ensure hardware acceleration / WebGPU is enabled in browser settings and retry.'
    );
    return;
  }
  try {
    gpuDevice = await adapter.requestDevice();
  } catch (err) {
    statusBadge.textContent = 'WebGPU device error';
    showWebGpuFallback('WebGPU Device Initialization Failed', err?.message || String(err));
    return;
  }
  hideWebGpuFallback();
  gpuDevice.addEventListener('uncapturederror', (e) => console.error('WebGPU error:', e.error?.message || String(e.error)));
  gpuDevice.lost?.then((info) => {
    statusBadge.textContent = 'WebGPU context lost';
    showWebGpuFallback(
      'WebGPU Context Paused / Lost',
      `Mobile OS or GPU driver reclaimed the WebGPU device (${info?.reason || 'unknown'}). Tap below to restore live GPU simulations.`
    );
  });
  gpuRenderer = createElementsLabWebGpuRenderer(gpuDevice, canvas);

  // ResizeObserver & orientation change sync for crisp mobile/tablet viewport + 2D plots
  let resizeTimer = null;
  const handleViewportResize = () => {
    if (!isDrawerMode()) setMobileDrawerOpen(false);
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      redrawCurrentTab();
    }, 60);
  };
  if (typeof ResizeObserver === 'function' && canvas.parentElement) {
    new ResizeObserver(handleViewportResize).observe(canvas.parentElement);
  }
  window.addEventListener('resize', handleViewportResize, { passive: true });
  window.addEventListener('orientationchange', handleViewportResize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      redrawCurrentTab();
      scheduleNextFrame();
    }
  });

  const params = new URLSearchParams(window.location.search);
  const startZ = Math.max(1, Math.min(118, Math.trunc(Number(params.get('z')) || 26)));
  const startAParam = params.get('a');
  const startA = startAParam && Number.isFinite(Number(startAParam))
    ? Math.max(startZ, Math.min(310, Math.trunc(Number(startAParam))))
    : null;
  const startTab = params.get('tab');
  selectedZ = startZ;
  selectedA = startA;
  zInput.value = String(startZ);
  if (aInput) aInput.value = String(startA ?? mostStableMassNumberForZ(startZ));
  await runElementDerivation(startZ, startA, { switchToTab: startTab || null });
  scheduleNextFrame();
}

boot();
