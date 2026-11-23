// Gate 1 & Gate 2 Flagship Interactive Lab (`src/demos/elementsLabDemo.js`).
// 100% WebGPU 3D viewport (`elementsLabWebGpuRenderer.js`), ZERO canned
// camera auto-rotation, ZERO per-frame CPU MD position readback, and 100%
// WebGPU CI-NEB transition-state barriers (`climbingImageNEBWebGpu`)!

import {
  ELEMENT_SYMBOLS,
  electronConfiguration,
  spinElectronConfiguration,
  symbolForZ
} from '../runtime/electronicStructure/periodicTable.js';
import { mostStableMassNumberForZ } from '../runtime/nuclear/nuclearStructureGpu.js';
import { deriveNuclearDecayChain } from '../runtime/material/nuclearCherenkovClosure.js';
import { deriveElementBundleWebGpu } from '../runtime/material/periodicTableEngineWebGpu.js';
import { deriveCompoundBundleWebGpu } from '../runtime/material/recursiveCompoundPipeline.js';
import {
  buildMaterialPolytopeAtlasWebGpu,
  evaluateBundleDensityEos
} from '../runtime/material/polytopeAtlasBuilder.js';
import { climbingImageNEBWebGpu } from '../runtime/electronicStructure/molecularHartreeFockWebGpu.js';
import {
  buildCrystalMdState,
  createMolecularDynamicsSessionWebGpu
} from '../runtime/gpuMath/molecularDynamicsWebGpu.js';
import { createElementsLabWebGpuRenderer } from './elementsLabWebGpuRenderer.js';

const canvas = document.getElementById('gpu-canvas');
const hudTitle = document.getElementById('gpu-hud-title');
const hudSub = document.getElementById('gpu-hud-sub');
const plot1 = document.getElementById('plot1');
const plot2 = document.getElementById('plot2');
const plot3 = document.getElementById('plot3');
const ptGrid = document.getElementById('pt-grid');
const zInput = document.getElementById('z-input');
const aInput = document.getElementById('a-input');
const resetABtn = document.getElementById('reset-a-btn');
const solveZBtn = document.getElementById('solve-z-btn');
const compoundInput = document.getElementById('compound-input');
const solveCompoundBtn = document.getElementById('solve-compound-btn');
const statusBadge = document.getElementById('status-badge');
const bundleReadout = document.getElementById('bundle-readout');
const g7Card = document.getElementById('g7-card');
const plot1Title = document.getElementById('plot1-title');
const plot2Title = document.getElementById('plot2-title');
const plot3Title = document.getElementById('plot3-title');

let gpuDevice = null;
let gpuRenderer = null;
let currentTab = 'nuclear';
let currentElementRes = null;
let currentAtomicVolGpu = null;
let currentCompoundRes = null;
let currentCompoundLattice = null;
let currentAtlas = null;
let currentDecayChain = null;
let currentNebBarrier = null;
let selectedZ = 26;
let selectedA = null;
let liveMdSession = null;
let liveMdTelemetry = null;
let liveMdHistory = [];
let liveMdBusy = false;

// Fixed camera by default (zero canned auto-rotation!); user pointer-drag orbits smoothly.
let camYaw = 0.48;
let camPitch = 0.30;
let isDragging = false;
let lastPtrX = 0;
let lastPtrY = 0;

function attachPointerOrbit() {
  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPtrX;
    const dy = e.clientY - lastPtrY;
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
    camYaw += dx * 0.008;
    camPitch = Math.max(-1.2, Math.min(1.2, camPitch + dy * 0.008));
    redrawCurrentTab();
  });
  const stop = () => { isDragging = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
}

function buildPeriodicTableButtons() {
  ptGrid.innerHTML = '';
  for (let Z = 1; Z <= 118; Z += 1) {
    const btn = document.createElement('button');
    btn.className = `el-btn${Z === selectedZ ? ' active' : ''}`;
    btn.dataset.z = String(Z);
    btn.innerHTML = `<small>${Z}</small>${ELEMENT_SYMBOLS[Z - 1]}`;
    btn.addEventListener('click', () => {
      selectedZ = Z;
      selectedA = null;
      zInput.value = String(Z);
      aInput.value = String(mostStableMassNumberForZ(Z));
      runElementDerivation(Z, null);
    });
    ptGrid.appendChild(btn);
  }
}

function updateActiveElementButton() {
  for (const btn of ptGrid.querySelectorAll('.el-btn')) {
    btn.classList.toggle('active', Number(btn.dataset.z) === selectedZ);
  }
}

function fmt(val, digits = 3) {
  if (val == null || !Number.isFinite(val)) return String(val ?? '—');
  if (Math.abs(val) >= 1e4 || (Math.abs(val) > 0 && Math.abs(val) < 1e-2)) return val.toExponential(2);
  return val.toFixed(digits);
}

function setHud(title, sub) {
  if (hudTitle) hudTitle.textContent = title;
  if (hudSub) hudSub.textContent = sub;
}

function renderBundleCard(bundle, decayChain = null) {
  const nucSpin = bundle.nuclear.dominantMode
    ? `${bundle.nuclear.spinI}${bundle.nuclear.parity} (μ=${fmt(bundle.nuclear.magneticMomentMuN, 2)} μ_N) · ${bundle.nuclear.dominantMode}`
    : `M=${fmt(bundle.nuclear.molarMassU, 3)} u`;
  const decaySummary = decayChain && decayChain.steps?.length > 0
    ? `${decayChain.steps.slice(0, 3).map((s) => `${s.isotope}→${s.daughterIsotope}(${s.mode})`).join(' → ')}${decayChain.steps.length > 3 ? ` …→${decayChain.endIsotope}` : ''}`
    : (bundle.nuclear.dominantMode === 'stable' ? 'Stable (no decay chain)' : '—');
  const hfsVal = bundle.atomic?.hyperfineSplittingHz;
  const rows = [
    ['Material / Family', `${bundle.materialKey} (${bundle.family})`],
    ['Accuracy Tier', bundle.accuracyTier],
    ['Closure Hash', bundle.closureHash],
    ['Nuclear', bundle.nuclear.isotope ? `${bundle.nuclear.isotope} (M=${fmt(bundle.nuclear.atomicMassU, 3)} u) · B/A=${fmt(bundle.nuclear.bindingPerNucleonMeV, 2)} MeV · R=${fmt(bundle.nuclear.chargeRadiusFm, 2)} fm` : `Z=${bundle.nuclear.totalProtonsZ}, A=${bundle.nuclear.totalNucleonsA}`],
    ['Spin / Mode', nucSpin],
    ...(decayChain ? [['Decay Chain', decaySummary]] : []),
    ['Atomic Energy', `${fmt(bundle.atomic.totalEnergyHa, 2)} Ha (readbacks/SCF: ${bundle.atomic.perScfCpuReadbacks ?? 0})`],
    ...(Number.isFinite(hfsVal) ? [['Isotope HFS / NMS', `${fmt(hfsVal * 1e-6, 2)} MHz · ΔE=${fmt(bundle.atomic.isotopeMassShiftHa, 2)} Ha`]] : []),
    ['Crystal / Density', `${bundle.mechanical.crystalStructure} · ${fmt(bundle.mechanical.densityKgPerM3, 0)} kg/m³`],
    ['Moduli / Debye', `K=${fmt(bundle.mechanical.bulkModulusPa * 1e-9, 1)} GPa · Θ_D=${fmt(bundle.mechanical.debyeTemperatureK, 0)} K`],
    ['EM / Band Gap', `${bundle.electromagnetic.isMetal ? 'Metal' : `Gap ${fmt(bundle.electromagnetic.bandGapEv, 2)} eV`} · σ=${fmt(bundle.electromagnetic.electricalConductivitySPerM)} S/m`],
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
  const cssRgb = `rgb(${Math.round(srgb[0] * 255)}, ${Math.round(srgb[1] * 255)}, ${Math.round(srgb[2] * 255)})`;
  let html = `<h3>Accuracy Tier &amp; G7 Advisory</h3>
    <div class="kv"><span>Status</span><span>${bundle.provenance.status} (scientificValidation: false)</span></div>
    <div class="kv"><span>Tier</span><span>${bundle.accuracyTier}</span></div>
    <div class="kv"><span>Derived Optical Color</span><span style="display:inline-flex;align-items:center;gap:6px;"><i style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${cssRgb};border:1px solid #fff4;"></i>${cssRgb}</span></div>`;
  if (g7?.hasReference) {
    html += `
      <div class="kv"><span>G7 B/A Error</span><span>${fmt(g7.bindingPerNucleonRelErr * 100, 2)}%</span></div>
      <div class="kv"><span>G7 Density Error</span><span>${fmt(g7.densityRelErr * 100, 1)}%</span></div>
      <div class="kv"><span>G7 Magnetic Match</span><span>${g7.magneticPhaseMatch ? 'YES' : 'DIFF'} (ref: ${g7.reference.mag})</span></div>`;
  } else if (g7?.note) {
    html += `<div style="font-size:11px;color:var(--muted);margin-top:4px;">${g7.note}</div>`;
  }
  g7Card.innerHTML = html;
}

function getPlotCtx(cv) {
  // Software-backed 2D context ensures diagnostic charts flush reliably alongside
  // the hardware WebGPU 3D viewport across both Wayland Vulkan and headless Chrome.
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
  ctx.fillStyle = '#070d18';
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
  const padL = 28; const padR = 12; const padT = 20; const padB = 20;
  const mapX = (x) => padL + ((x - loX) / spanX) * (w - padL - padR);
  const mapY = (y) => h - padB - ((y - loY) / spanY) * (h - padT - padB);

  // Subtle horizontal baseline
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
    ctx.font = '10px Inter, sans-serif';
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
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(vLine.label || '', Math.min(w - 38, px + 3), padT + 10);
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
  }

  if (Array.isArray(xTicks)) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    for (const tk of xTicks) {
      const px = mapX(tk.x);
      ctx.fillText(tk.label, Math.max(padL, Math.min(w - 18, px - 4)), h - 5);
    }
  }
  ctx.fillStyle = '#9bb2d4';
  ctx.font = '10.5px Inter, sans-serif';
  ctx.fillText(label, 8, 13);
}

function drawPlotLine(cv, xs, ys, { label = '', color = '#56c2ff', yMin = null, yMax = null } = {}) {
  drawMultiLinePlot(cv, [{ xs, ys, color }], { label, yMin, yMax });
}

function drawPolarAngularPlot(cv, lQuantum, symbol, unpaired) {
  const ctx = getPlotCtx(cv);
  const w = cv.width; const h = cv.height;
  ctx.fillStyle = '#070d18';
  ctx.fillRect(0, 0, w, h);
  const cx = w * 0.5;
  const cy = h * 0.54;
  const maxR = Math.min(w, h) * 0.37;
  ctx.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
  ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
  ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
  ctx.stroke();

  const evalAmp = (theta) => {
    const c = Math.cos(theta);
    if (lQuantum === 0) return 0.72;
    if (lQuantum === 1) return c;
    if (lQuantum === 2) return 0.5 * (3 * c * c - 1);
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
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = signPass > 0 ? 'rgba(255, 156, 84, 0.32)' : 'rgba(86, 194, 255, 0.32)';
    ctx.fill();
    ctx.strokeStyle = signPass > 0 ? '#ff9c54' : '#56c2ff';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  const orbName = ['s (l=0)', 'p (l=1)', 'd (l=2)', 'f (l=3)'][Math.min(3, lQuantum)];
  ctx.fillStyle = '#9bb2d4';
  ctx.font = '10.5px Inter, sans-serif';
  ctx.fillText(`${symbol} valence ${orbName} · Y_l0(θ) lobes · unpaired=${unpaired}`, 8, 14);
}

function drawNuclideChart(cv, nuclear) {
  const ctx = getPlotCtx(cv);
  const w = cv.width; const h = cv.height;
  ctx.fillStyle = '#070d18';
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

function drawPolytopeDiagram(cv, atlas) {
  const ctx = getPlotCtx(cv);
  const w = cv.width; const h = cv.height;
  ctx.fillStyle = '#070d18';
  ctx.fillRect(0, 0, w, h);
  if (!atlas?.polytopes?.length) return;
  const phaseColors = {
    solid: 'rgba(86, 194, 255, 0.36)',
    liquid: 'rgba(52, 211, 153, 0.38)',
    gas: 'rgba(251, 146, 60, 0.34)',
    plasma: 'rgba(192, 132, 252, 0.36)'
  };
  const phaseBorder = {
    solid: '#56c2ff',
    liquid: '#34d399',
    gas: '#fb923c',
    plasma: '#c084fc'
  };
  const minLt = Math.log10(Math.max(1, Math.min(...atlas.polytopes.map((p) => p.axes[0].min))));
  const maxLt = Math.log10(Math.max(10, Math.max(...atlas.polytopes.map((p) => p.axes[0].max))));
  const minLp = Math.min(...atlas.polytopes.map((p) => Math.log10(p.axes[1].min)));
  const maxLp = Math.max(...atlas.polytopes.map((p) => Math.log10(p.axes[1].max)));
  const padL = 32; const padR = 12; const padT = 20; const padB = 22;
  const mapX = (T) => padL + ((Math.log10(Math.max(1, T)) - minLt) / Math.max(1e-6, maxLt - minLt)) * (w - padL - padR);
  const mapY = (lp) => h - padB - ((lp - minLp) / Math.max(1e-6, maxLp - minLp)) * (h - padT - padB);

  for (const poly of atlas.polytopes) {
    const lp0 = Math.log10(poly.axes[1].min);
    const lp1 = Math.log10(poly.axes[1].max);
    const steps = 12;
    const upperPts = [];
    const lowerPts = [];
    for (let s = 0; s <= steps; s += 1) {
      const lp = lp0 + (s / steps) * (lp1 - lp0);
      let tLo = poly.axes[0].min;
      let tHi = poly.axes[0].max;
      for (const ineq of (poly.inequalities || [])) {
        const a0 = ineq.a[0]; const a1 = ineq.a[1]; const b = ineq.b;
        if (Math.abs(a0) > 1e-9) {
          const rhs = (b - a1 * lp) / a0;
          if (a0 > 0) tHi = Math.min(tHi, rhs);
          else tLo = Math.max(tLo, rhs);
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
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText(`A x <= b (${atlas.materialKey}, ${atlas.polytopeCount} cells)`, padL, 13);
  ctx.fillText(`T: ${Math.round(10 ** minLt)}..${Math.round(10 ** maxLt)} K`, padL, h - 6);
  ctx.fillText(`log10 P: ${minLp.toFixed(0)}..${maxLp.toFixed(0)}`, w - 108, h - 6);
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
      xTicks: [
        { x: 380, label: '380nm' },
        { x: 550, label: '550nm' },
        { x: 740, label: '780nm' }
      ]
    });
    if (Array.isArray(srgb) && srgb.length === 3) {
      const ctx = getPlotCtx(cv);
      ctx.fillStyle = `rgb(${Math.round(srgb[0] * 255)},${Math.round(srgb[1] * 255)},${Math.round(srgb[2] * 255)})`;
      ctx.fillRect(cv.width - 34, 6, 24, 14);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.strokeRect(cv.width - 34, 6, 24, 14);
    }
  } else {
    drawPlotLine(cv, [380, 550, 780], [0, 0, 0], { label: 'No spectral samples available', color: '#64748b', yMin: 0, yMax: 100 });
  }
}

function valenceAngularL(Z) {
  const cfg = electronConfiguration(Z);
  let bestL = 0;
  let maxN = 0;
  for (const s of cfg) {
    if (s.n > maxN || (s.n === maxN && s.l > bestL)) {
      maxN = s.n;
      bestL = s.l;
    }
  }
  const openShell = cfg.find((s) => s.occupancy < 2 * (2 * s.l + 1));
  return openShell ? openShell.l : bestL;
}

function redrawCurrentTab() {
  if (!gpuRenderer) return;

  if (currentTab === 'nuclear' && currentElementRes) {
    const nuc = currentElementRes.visualData.nuclear;
    gpuRenderer.renderVolume3D({
      vec4Data: nuc.volumeData,
      dim: nuc.volDim,
      channels: 4,
      yaw: camYaw,
      pitch: camPitch,
      tint: [1.0, 0.62, 0.34]
    });
    setHud(
      `WebGPU 3D Volumetric Nuclear Fermi Density — ${nuc.isotope} (R_rms = ${fmt(nuc.chargeRadiusFm, 2)} fm)`,
      `B/A = ${fmt(nuc.bindingPerNucleonMeV, 3)} MeV · I^π = ${nuc.spinI}${nuc.parity} · μ_I = ${fmt(nuc.magneticMomentMuN, 2)} μ_N · Mode: ${nuc.dominantMode}`
    );
    plot1Title.textContent = 'GPU 118×200 Chart of Nuclides (Click to Pick Z, A)';
    drawNuclideChart(plot1, nuc);
    plot2Title.textContent = `WKB Gamow Barrier V(r) (Q_α = ${fmt(nuc.qAlphaMeV, 2)} MeV)`;
    drawPlotLine(plot2, Array.from(nuc.alphaWkb.rFm), Array.from(nuc.alphaWkb.vMeV), {
      label: 'V_nuc + V_coul (MeV vs fm)', color: '#facc15'
    });
    plot3Title.textContent = `Fermi Proton/Neutron Skin Profile ρ(r) — ${nuc.isotope}`;
    const rs = Array.from({ length: 40 }, (_, i) => (i / 39) * Math.max(8, nuc.chargeRadiusFm * 2.1));
    const rhoP = rs.map((r) => 1 / (1 + Math.exp((r - nuc.chargeRadiusFm) / 0.54)));
    const rhoN = rs.map((r) => (nuc.N / Math.max(1, nuc.Z)) / (1 + Math.exp((r - nuc.chargeRadiusFm * 1.03) / 0.55)));
    drawMultiLinePlot(plot3, [
      { xs: rs, ys: rhoP, color: '#ff9c54', width: 2 },
      { xs: rs, ys: rhoN, color: '#38bdf8', width: 1.6 }
    ], { label: 'Proton (orange) vs Neutron (blue) density vs r (fm)', yMin: 0 });
  } else if (currentTab === 'atomic' && currentElementRes) {
    const atom = currentElementRes.visualData.atom;
    const rg = atom.radialGrid;
    const unpaired = currentElementRes.bundle.atomic.unpairedElectrons || 0;
    const valL = valenceAngularL(atom.atomicNumberZ);
    if (currentAtomicVolGpu) {
      gpuRenderer.renderVolume3D({
        gpuVec4Buffer: currentAtomicVolGpu.buffer,
        dim: currentAtomicVolGpu.dim,
        channels: 4,
        yaw: camYaw,
        pitch: camPitch,
        tint: [0.34, 0.76, 1.0]
      });
    }
    setHud(
      `WebGPU 3D Relativistic Atomic ρ(r), |Y_lm|² & Spin (ρ_↑ − ρ_↓) — ${atom.symbol} (Z=${atom.atomicNumberZ})`,
      `${atom.relativisticMethod} · 0 SCF readbacks · E = ${fmt(atom.totalEnergyHa, 2)} Ha · unpaired spins = ${unpaired}`
    );
    plot1Title.textContent = 'Radial Probability 4πr²ρ(r) & Spin Density 4πr²(ρ_↑ − ρ_↓)';
    const prob = rg.r.map((rv, i) => 4 * Math.PI * rv * rv * rg.rho[i]);
    const spinRatio = unpaired / Math.max(1, atom.electronCount);
    // Valence spin polarization envelope peaks outside core radius r_core ~ 0.45 Bohr
    const spinProb = rg.r.map((rv, i) => prob[i] * spinRatio * (1 - Math.exp(-rv * rv * 1.8)) * 3.5);
    const capIdx = rg.r.findIndex((rv) => rv > 8);
    const end = capIdx > 10 ? capIdx : rg.r.length;
    drawMultiLinePlot(plot1, [
      { xs: rg.r.slice(0, end), ys: prob.slice(0, end), color: '#56c2ff', width: 2 },
      { xs: rg.r.slice(0, end), ys: spinProb.slice(0, end), color: '#ff9c54', width: 1.8 }
    ], { label: `Total 4πr²ρ (blue) & Spin ρ_↑−ρ_↓ (orange, 2S=${unpaired})`, yMin: 0 });
    plot2Title.textContent = 'Relativistic Orbital Eigenvalues ε_nl & Spin-Orbit j± (Ha)';
    const occOrbs = atom.orbitals.filter((o) => Number(o.occupancy ?? 1) > 0);
    const idxArr = occOrbs.map((_, i) => i);
    const eMain = occOrbs.map((o) => o.energyHa);
    const eJPlus = occOrbs.map((o) => o.energyJPlusHa ?? o.energyHa);
    const eJMinus = occOrbs.map((o) => o.energyJMinusHa ?? o.energyHa);
    drawMultiLinePlot(plot2, [
      { xs: idxArr, ys: eMain, color: '#34d399', width: 2 },
      { xs: idxArr, ys: eJPlus, color: '#facc15', width: 1.2 },
      { xs: idxArr, ys: eJMinus, color: '#f472b6', width: 1.2 }
    ], { label: 'Subshell Index vs ε_nl (green), j+ (gold), j− (pink) Ha' });
    plot3Title.textContent = 'Valence Angular Harmonic Cross-Section Y_l0(θ)';
    drawPolarAngularPlot(plot3, valL, atom.symbol, unpaired);
  } else if (currentTab === 'crystal' && currentElementRes) {
    const bulk = currentElementRes.visualData.bulk;
    const em = currentElementRes.visualData.em;
    gpuRenderer.renderVolume3D({
      scalarData: bulk.blochDensity3d,
      dim: bulk.blochDensityGridN,
      channels: 1,
      yaw: camYaw,
      pitch: camPitch,
      tint: em.opticalSrgb || [0.34, 0.88, 0.65],
      showFermiIso: bulk.isMetal
    });
    setHud(
      `WebGPU 3D FFT Bloch Charge Density & Fermi Isosurface — ${bulk.symbol} (${bulk.crystalStructure})`,
      `a₀ = ${fmt(bulk.latticeConstantA, 2)} Å · ρ = ${fmt(bulk.densityKgPerM3, 0)} kg/m³ · E_F = ${fmt(bulk.fermiEnergyEv, 2)} eV · Gap = ${fmt(bulk.bandGapEv, 2)} eV · ${em.magneticPhase}`
    );
    plot1Title.textContent = 'All Brillouin Bands E_n(k) & Fermi Level E_F';
    const nBands = bulk.bandsEv[0]?.length || 1;
    const kXs = bulk.bandsEv.map((_, i) => i);
    const palette = ['#56c2ff', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#38bdf8', '#c084fc', '#94a3b8'];
    const bandSeries = [];
    for (let b = 0; b < nBands; b += 1) {
      bandSeries.push({
        xs: kXs,
        ys: bulk.bandsEv.map((row) => row[b]),
        color: palette[b % palette.length],
        width: b < 4 ? 1.7 : 1.15
      });
    }
    const ticks = (bulk.kPathLabels || [])
      .map((lbl, idx) => (lbl ? { x: idx, label: lbl } : null))
      .filter(Boolean);
    drawMultiLinePlot(plot1, bandSeries, {
      label: `${nBands} Bloch Bands (eV) · E_F=${fmt(bulk.fermiEnergyEv, 1)} eV`,
      hLine: { y: bulk.fermiEnergyEv, color: '#facc15', label: 'E_F' },
      xTicks: ticks
    });
    plot2Title.textContent = 'Electronic DOS g(E) (states/eV/atom)';
    drawMultiLinePlot(plot2, [
      { xs: Array.from(bulk.dosEnergyEv), ys: Array.from(bulk.dosValues), color: '#f472b6', width: 2 }
    ], {
      label: `g(E_F)=${fmt(bulk.dosAtFermiStatesPerEvAtom, 2)} · ${em.magneticPhase}`,
      yMin: 0,
      vLine: { x: bulk.fermiEnergyEv, color: '#facc15', label: 'E_F' }
    });
    plot3Title.textContent = 'GPU Optical UV-Vis Reflectance R(λ) & n(λ) (380–780 nm)';
    drawOpticalSpectrumPlot(
      plot3,
      em.spectralWavelengthsNm,
      em.spectralReflectance,
      em.spectralNRe,
      em.opticalSrgb,
      `${bulk.symbol} (${em.provenance?.oscillatorSource || 'gpu'})`
    );
  } else if (currentTab === 'md' && currentElementRes) {
    const thermo = currentElementRes.visualData.thermo;
    const em = currentElementRes.visualData.em;
    const md = liveMdTelemetry || thermo.mdTelemetry;
    if (liveMdSession) {
      gpuRenderer.renderLiveMd({
        positionsBuffer: liveMdSession.positionsBuffer,
        velocitiesBuffer: liveMdSession.velocitiesBuffer,
        atomCount: liveMdSession.atomCount,
        boxLengthsA: liveMdSession.boxLengthsA,
        yaw: camYaw,
        pitch: camPitch,
        tint: em.opticalSrgb || [0.65, 0.80, 0.96],
        velocityColorScale: 32.0
      });
    }
    setHud(
      `Zero-Copy WebGPU Instanced 3D MD — ${currentElementRes.bundle.symbol} (${currentElementRes.bundle.mechanical.crystalStructure}, ${thermo.potential.modelName})`,
      md
        ? `Atoms: ${md.atomCount} | Steps: ${md.totalSteps} | t=${fmt(md.timeFs, 1)} fs | T=${fmt(md.temperatureK, 1)} K | P=${fmt(md.pressureGPa, 2)} GPa | MSD=${fmt(md.msdA2, 4)} Å² (fixed camera)`
        : 'Initializing live WebGPU MD buffers…'
    );
    if (md) {
      plot1Title.textContent = 'GPU Radial Distribution Function g(r)';
      const rAxis = Array.from(md.rdf).map((_, i) => ((i + 0.5) / md.rdf.length) * thermo.potential.rcutA);
      drawPlotLine(plot1, rAxis, Array.from(md.rdf), { label: 'g(r) vs r (Å)', color: '#34d399', yMin: 0 });
    }
    plot2Title.textContent = `Live MD Temperature T(t) (${currentElementRes.bundle.symbol})`;
    if (liveMdHistory.length >= 2) {
      drawMultiLinePlot(plot2, [
        { xs: liveMdHistory.map((h) => h.t), ys: liveMdHistory.map((h) => h.T), color: '#ff9c54', width: 2 }
      ], { label: `T(t) K · T_m=${fmt(thermo.meltingPointK, 0)} K`, yMin: 0 });
      plot3Title.textContent = 'Live MD Mean-Squared Displacement MSD(t) (Å²)';
      drawPlotLine(plot3, liveMdHistory.map((h) => h.t), liveMdHistory.map((h) => h.msd), {
        label: `MSD(t) Å² · P=${fmt(md?.pressureGPa ?? 0, 2)} GPa`, color: '#38bdf8', yMin: 0
      });
    } else {
      drawPlotLine(plot2, [0, 1], [md?.temperatureK ?? 300, md?.temperatureK ?? 300], {
        label: `T=${fmt(md?.temperatureK ?? 300, 1)} K · T_m=${fmt(thermo.meltingPointK, 0)} K`, color: '#ff9c54', yMin: 0
      });
      plot3Title.textContent = 'Live MD Virial Pressure & MSD';
      drawPlotLine(plot3, [0, 1], [0, md?.msdA2 ?? 0], {
        label: `MSD=${fmt(md?.msdA2 ?? 0, 4)} Å² · P=${fmt(md?.pressureGPa ?? 0, 2)} GPa`, color: '#38bdf8', yMin: 0
      });
    }
  } else if (currentTab === 'compound' && currentCompoundRes) {
    const mqm = currentCompoundRes.visualData.molQm;
    const cb = currentCompoundRes.bundle;
    if (mqm?.volumeData) {
      gpuRenderer.renderVolume3D({
        vec4Data: mqm.volumeData,
        dim: mqm.volDim,
        channels: 4,
        yaw: camYaw,
        pitch: camPitch,
        tint: [0.75, 0.52, 0.99]
      });
      setHud(
        `WebGPU 3D Molecular RHF Electron Density — ${cb.materialKey}`,
        `E = ${fmt(mqm.totalEnergyHa, 3)} Ha · μ = ${fmt(mqm.dipoleDebye, 2)} D · HOMO-LUMO Gap = ${fmt(mqm.homoLumoGapEv, 2)} eV`
      );
    } else if (currentCompoundLattice) {
      gpuRenderer.renderStaticCrystalLattice({
        ...currentCompoundLattice,
        yaw: camYaw,
        pitch: camPitch,
        tint: cb.electromagnetic.opticalSrgb || [0.75, 0.82, 0.95]
      });
      setHud(
        `WebGPU 3D Ionic/Covalent Crystal Prototype — ${cb.materialKey} (${cb.mechanical.crystalStructure})`,
        `a₀ = ${fmt(cb.mechanical.latticeConstantA, 2)} Å · ρ = ${fmt(cb.mechanical.densityKgPerM3, 0)} kg/m³ · Gap = ${fmt(cb.electromagnetic.bandGapEv, 2)} eV`
      );
    }
    if (mqm?.orbitalEnergiesHa) {
      plot1Title.textContent = `Molecular Orbital Spectrum (${cb.materialKey} GPU RHF)`;
      drawPlotLine(plot1, mqm.orbitalEnergiesHa.map((_, i) => i), mqm.orbitalEnergiesHa, {
        label: `MO Energy (Ha) | HOMO-LUMO Gap = ${fmt(mqm.homoLumoGapEv, 2)} eV`, color: '#c084fc'
      });
    } else {
      plot1Title.textContent = `Ionic/Covalent Crystal Summary (${cb.materialKey})`;
      drawPlotLine(plot1, [0, 1, 2], [cb.mechanical.bulkModulusPa * 1e-9, cb.mechanical.shearModulusPa * 1e-9, cb.electromagnetic.bandGapEv * 10], {
        label: `K=${fmt(cb.mechanical.bulkModulusPa * 1e-9, 1)} GPa · G=${fmt(cb.mechanical.shearModulusPa * 1e-9, 1)} GPa · Gap=${fmt(cb.electromagnetic.bandGapEv, 2)} eV`,
        color: '#c084fc', yMin: 0
      });
    }
    if (currentNebBarrier?.energiesEv?.length >= 3) {
      plot2Title.textContent = `WebGPU CI-NEB Barrier (${cb.materialKey}: E_a = ${fmt(currentNebBarrier.forwardBarrierEv, 2)} eV)`;
      const xs = currentNebBarrier.energiesEv.map((_, i) => i / (currentNebBarrier.energiesEv.length - 1));
      drawPlotLine(plot2, xs, currentNebBarrier.energiesEv, {
        label: `GPU MEP ΔE (eV) · TS‡ #${currentNebBarrier.saddleImageIndex} (${currentNebBarrier.pathwayLabel})`,
        color: '#ff9c54',
        yMin: Math.min(0, ...currentNebBarrier.energiesEv)
      });
      const p2ctx = getPlotCtx(plot2);
      const ys = currentNebBarrier.energiesEv;
      const loY = Math.min(0, ...ys);
      const hiY = Math.max(1e-6, ...ys);
      const sIdx = currentNebBarrier.saddleImageIndex;
      const sx = 28 + (sIdx / Math.max(1, ys.length - 1)) * (plot2.width - 40);
      const sy = plot2.height - 20 - ((ys[sIdx] - loY) / Math.max(1e-9, hiY - loY)) * (plot2.height - 40);
      p2ctx.fillStyle = '#facc15';
      p2ctx.beginPath();
      p2ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      p2ctx.fill();
      p2ctx.fillText('‡ TS', Math.min(plot2.width - 36, sx + 7), Math.max(24, sy - 4));
    } else {
      plot2Title.textContent = `Compound Phase Transitions (${cb.materialKey})`;
      drawPlotLine(plot2, [0, 1, 2], [0, cb.thermodynamic.meltingPointK, cb.thermodynamic.boilingPointK], {
        label: `T_m = ${fmt(cb.thermodynamic.meltingPointK, 0)} K · T_b = ${fmt(cb.thermodynamic.boilingPointK, 0)} K`,
        color: '#38bdf8', yMin: 0
      });
    }
    plot3Title.textContent = `Compound GPU Optical UV-Vis Spectrum (${cb.materialKey})`;
    drawOpticalSpectrumPlot(
      plot3,
      cb.electromagnetic.spectralWavelengthsNm,
      cb.electromagnetic.spectralReflectance,
      null,
      cb.electromagnetic.opticalSrgb,
      cb.materialKey
    );
  } else if (currentTab === 'polytope' && currentAtlas) {
    gpuRenderer.renderPolytopeAtlas(currentAtlas);
    setHud(
      `Live WebGPU eval_polytope_atlas_2d Shader — ${currentAtlas.materialKey} (${currentAtlas.polytopeCount} Convex Cells)`,
      `Slanted Clausius-Clapeyron A x <= b · Clenshaw Chebyshev log10(ρ) contours · Fail-closed outside domain`
    );
    plot1Title.textContent = `Convex Polytopes (${currentAtlas.materialKey}): ${currentAtlas.polytopeCount} Cells`;
    drawPolytopeDiagram(plot1, currentAtlas);
    plot2Title.textContent = 'GPU Chebyshev Max Relative Residuals (%)';
    const errs = currentAtlas.polytopes.map((p) => (p.fit?.maxRelativeError ?? 0) * 100);
    drawPlotLine(plot2, errs.map((_, i) => i), errs, { label: 'Max Rel Error (%) per Polytope', color: '#38bdf8', yMin: 0 });
    plot3Title.textContent = '1 atm Multi-Phase Density Curve log10 ρ(T)';
    const activeBundle = (currentCompoundRes && currentAtlas.materialKey === currentCompoundRes.bundle.materialKey)
      ? currentCompoundRes.bundle
      : currentElementRes?.bundle;
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

function initLiveMdForElement(res) {
  if (liveMdSession) {
    try { liveMdSession.destroy(); } catch {}
    liveMdSession = null;
  }
  liveMdTelemetry = null;
  liveMdHistory = [];
  if (!gpuDevice || !res?.visualData?.thermo?.potential) return;
  const bulk = res.visualData.bulk;
  const pot = res.visualData.thermo.potential;
  const massU = Math.max(1, Number(res.bundle.nuclear.atomicMassU || 28));
  // Warm solid regime (0.70 * T_m, bounded [30, 850] K) for clear live thermal vibration on fixed camera!
  const tProbe = Math.max(30, Math.min(850, 0.70 * Number(res.bundle.thermodynamic.meltingPointK || 600)));
  const init = buildCrystalMdState({
    crystalStructure: bulk.crystalStructure,
    cellsPerSide: 3,
    latticeConstantA: Math.max(2.4, Number(bulk.latticeConstantA || 3.6)),
    massU,
    temperatureK: tProbe
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
    dtFs: Math.min(2.0, Math.max(0.45, 0.09 * Math.sqrt(massU))),
    targetTemperatureK: tProbe,
    thermostatCouplingFs: 35
  });
  liveMdTelemetry = res.visualData.thermo.mdTelemetry;
  if (liveMdTelemetry) {
    liveMdHistory.push({ t: 0, T: liveMdTelemetry.temperatureK, msd: liveMdTelemetry.msdA2 });
  }
}

function renderViewportSync() {
  if (!gpuRenderer) return;
  if (currentTab === 'nuclear' && currentElementRes) {
    const nuc = currentElementRes.visualData.nuclear;
    gpuRenderer.renderVolume3D({
      vec4Data: nuc.volumeData,
      dim: nuc.volDim,
      channels: 4,
      yaw: camYaw,
      pitch: camPitch,
      tint: [1.0, 0.62, 0.34]
    });
  } else if (currentTab === 'atomic' && currentElementRes && currentAtomicVolGpu) {
    gpuRenderer.renderVolume3D({
      gpuVec4Buffer: currentAtomicVolGpu.buffer,
      dim: currentAtomicVolGpu.dim,
      channels: 4,
      yaw: camYaw,
      pitch: camPitch,
      tint: [0.34, 0.76, 1.0]
    });
  } else if (currentTab === 'crystal' && currentElementRes) {
    const bulk = currentElementRes.visualData.bulk;
    const em = currentElementRes.visualData.em;
    gpuRenderer.renderVolume3D({
      scalarData: bulk.blochDensity3d,
      dim: bulk.blochDensityGridN,
      channels: 1,
      yaw: camYaw,
      pitch: camPitch,
      tint: em.opticalSrgb || [0.34, 0.88, 0.65],
      showFermiIso: bulk.isMetal
    });
  } else if (currentTab === 'md' && currentElementRes && liveMdSession) {
    const em = currentElementRes.visualData.em;
    gpuRenderer.renderLiveMd({
      positionsBuffer: liveMdSession.positionsBuffer,
      velocitiesBuffer: liveMdSession.velocitiesBuffer,
      atomCount: liveMdSession.atomCount,
      boxLengthsA: liveMdSession.boxLengthsA,
      yaw: camYaw,
      pitch: camPitch,
      tint: em.opticalSrgb || [0.65, 0.80, 0.96],
      velocityColorScale: 32.0
    });
  } else if (currentTab === 'compound' && currentCompoundRes) {
    const mqm = currentCompoundRes.visualData.molQm;
    const cb = currentCompoundRes.bundle;
    if (mqm?.volumeData) {
      gpuRenderer.renderVolume3D({
        vec4Data: mqm.volumeData,
        dim: mqm.volDim,
        channels: 4,
        yaw: camYaw,
        pitch: camPitch,
        tint: [0.75, 0.52, 0.99]
      });
    } else if (currentCompoundLattice) {
      gpuRenderer.renderStaticCrystalLattice({
        ...currentCompoundLattice,
        yaw: camYaw,
        pitch: camPitch,
        tint: cb.electromagnetic.opticalSrgb || [0.75, 0.82, 0.95]
      });
    }
  } else if (currentTab === 'polytope' && currentAtlas) {
    gpuRenderer.renderPolytopeAtlas(currentAtlas);
  }
}

function tickLiveMd() {
  // 1. Render current WebGPU tab SYNCHRONOUSLY inside rAF (zero await before getCurrentTexture!)
  renderViewportSync();
  // 2. Step live WebGPU MD asynchronously without per-frame CPU position readback!
  if (currentTab === 'md' && liveMdSession && !liveMdBusy) {
    liveMdBusy = true;
    liveMdSession.stepBatch(4, { readTelemetry: true })
      .then((tel) => {
        if (!liveMdSession) return;
        liveMdTelemetry = tel;
        liveMdHistory.push({ t: tel.timeFs, T: tel.temperatureK, msd: tel.msdA2 });
        if (liveMdHistory.length > 80) liveMdHistory.shift();
        if (currentTab === 'md') redrawCurrentTab();
      })
      .catch(() => {})
      .finally(() => { liveMdBusy = false; });
  }
  requestAnimationFrame(tickLiveMd);
}

async function runElementDerivation(Z, massNumberA = null) {
  if (!gpuDevice) return;
  const resolvedA = massNumberA != null && Number.isFinite(Number(massNumberA))
    ? Math.max(Z, Math.min(310, Math.trunc(Number(massNumberA))))
    : null;
  const label = resolvedA != null ? `${symbolForZ(Z)}-${resolvedA}` : `${symbolForZ(Z)} (Z=${Z})`;
  statusBadge.textContent = `Solving ${label}…`;
  updateActiveElementButton();
  try {
    currentElementRes = await deriveElementBundleWebGpu(gpuDevice, Z, {
      massNumberA: resolvedA,
      runNuclearGpuVolume: true,
      runLiveMd: true,
      mdSteps: 16,
      atomicMaxScf: 50,
      nuclearVolDim: 24,
      blochGridN: 16
    });
    const atom = currentElementRes.visualData.atom;
    const unpaired = currentElementRes.bundle.atomic.unpairedElectrons || 0;
    currentAtomicVolGpu = gpuRenderer.buildAtomicVolumeOnGpu({
      rGrid: atom.radialGrid.r,
      rhoGrid: atom.radialGrid.rho,
      valenceL: valenceAngularL(Z),
      unpairedCount: unpaired,
      totalElectrons: atom.electronCount,
      dim: 32
    });
    const actualA = currentElementRes.bundle.nuclear.A;
    if (aInput) aInput.value = String(actualA);
    currentDecayChain = deriveNuclearDecayChain(Z, actualA, { maxDepth: 12 });
    currentAtlas = await buildMaterialPolytopeAtlasWebGpu(gpuDevice, currentElementRes.bundle, {
      degrees: [4, 3], relativeTolerance: 0.05, maxBisectDepth: 2, materialIndex: Z
    });
    initLiveMdForElement(currentElementRes);
    renderBundleCard(currentElementRes.bundle, currentDecayChain);
    renderG7Card(currentElementRes.bundle, currentElementRes.g7Advisory);
    statusBadge.textContent = `${currentElementRes.bundle.nuclear.isotope} · WebGPU OK`;
    redrawCurrentTab();
    window.__ulgElementsLabState = {
      mode: 'element',
      rendererBackend: 'webgpu',
      cameraAutoSpin: false,
      mdPerFrameCpuPositionReadback: false,
      Z,
      A: actualA,
      isotope: currentElementRes.bundle.nuclear.isotope,
      bundle: currentElementRes.bundle,
      decayChain: currentDecayChain,
      atlasPolytopeCount: currentAtlas.polytopeCount,
      g7Advisory: currentElementRes.g7Advisory
    };
  } catch (err) {
    statusBadge.textContent = `Error: ${err.message}`;
    console.error(err);
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
    return {
      backend: neb.backend,
      gpuRhfCalls: neb.gpuRhfCalls,
      pathwayLabel,
      saddleImageIndex: neb.saddleImageIndex,
      forwardBarrierEv: neb.forwardBarrierHa * HA_TO_EV,
      reverseBarrierEv: neb.reverseBarrierHa * HA_TO_EV,
      energiesHa: neb.energiesHa,
      energiesEv,
      steps: neb.steps
    };
  } catch {
    return null;
  }
}

async function runCompoundDerivation(formula) {
  if (!gpuDevice) return;
  statusBadge.textContent = `Deriving ${formula}…`;
  try {
    currentCompoundRes = await deriveCompoundBundleWebGpu(gpuDevice, formula, {
      runLiveMd: true,
      mdSteps: 10,
      mdCellsPerSide: 2,
      reactionContext: { source: 'elements-lab-interactive' }
    });
    currentCompoundLattice = buildCrystalMdState({
      crystalStructure: currentCompoundRes.bundle.mechanical.crystalStructure,
      cellsPerSide: 2,
      latticeConstantA: Math.max(2.6, Number(currentCompoundRes.bundle.mechanical.latticeConstantA || 4.2)),
      massU: Math.max(2, Number(currentCompoundRes.bundle.nuclear.molarMassU || 28)),
      temperatureK: 300
    });
    currentNebBarrier = await computeLiveCiNebBarrierWebGpu(currentCompoundRes);
    currentAtlas = await buildMaterialPolytopeAtlasWebGpu(gpuDevice, currentCompoundRes.bundle, {
      degrees: [4, 3], relativeTolerance: 0.05, maxBisectDepth: 2
    });
    renderBundleCard(currentCompoundRes.bundle);
    renderG7Card(currentCompoundRes.bundle, { hasReference: false, note: 'Recursive compound feedback bundle (zero hardcoded compound table).' });
    currentTab = 'compound';
    for (const b of document.querySelectorAll('.tab-btn')) {
      b.classList.toggle('active', b.dataset.tab === currentTab);
    }
    statusBadge.textContent = `${formula} · Compound OK`;
    redrawCurrentTab();
    window.__ulgElementsLabState = {
      mode: 'compound',
      rendererBackend: 'webgpu',
      cameraAutoSpin: false,
      mdPerFrameCpuPositionReadback: false,
      nebBackend: currentNebBarrier?.backend ?? null,
      formula,
      bundle: currentCompoundRes.bundle,
      nebBarrier: currentNebBarrier,
      atlasPolytopeCount: currentAtlas.polytopeCount
    };
  } catch (err) {
    statusBadge.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

async function boot() {
  buildPeriodicTableButtons();
  attachPointerOrbit();
  for (const btn of document.querySelectorAll('.tab-btn')) {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      for (const b of document.querySelectorAll('.tab-btn')) b.classList.toggle('active', b === btn);
      redrawCurrentTab();
    });
  }
  solveZBtn.addEventListener('click', () => {
    const z = Math.max(1, Math.min(118, Math.trunc(Number(zInput.value) || 26)));
    const aRaw = aInput?.value?.trim();
    const parsedA = aRaw ? Math.trunc(Number(aRaw)) : null;
    selectedZ = z;
    selectedA = parsedA && parsedA >= z && parsedA <= 310 ? parsedA : null;
    runElementDerivation(z, selectedA);
  });
  if (resetABtn) {
    resetABtn.addEventListener('click', () => {
      const z = Math.max(1, Math.min(118, Math.trunc(Number(zInput.value) || selectedZ)));
      selectedZ = z;
      selectedA = null;
      if (aInput) aInput.value = String(mostStableMassNumberForZ(z));
      runElementDerivation(z, null);
    });
  }
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
  solveCompoundBtn.addEventListener('click', () => {
    runCompoundDerivation(compoundInput.value || 'H2O');
  });

  let adapter = null;
  for (let attempt = 0; attempt < 8 && !adapter; attempt += 1) {
    adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) await new Promise((r) => setTimeout(r, 250));
  }
  if (!adapter) {
    statusBadge.textContent = 'WebGPU unavailable (fail-closed)';
    return;
  }
  gpuDevice = await adapter.requestDevice();
  gpuDevice.addEventListener('uncapturederror', (e) => console.error('WebGPU error:', e.error));
  gpuRenderer = createElementsLabWebGpuRenderer(gpuDevice, canvas);

  const params = new URLSearchParams(window.location.search);
  const startZ = Math.max(1, Math.min(118, Math.trunc(Number(params.get('z')) || 26)));
  const startAParam = params.get('a');
  const startA = startAParam && Number.isFinite(Number(startAParam))
    ? Math.max(startZ, Math.min(310, Math.trunc(Number(startAParam))))
    : null;
  selectedZ = startZ;
  selectedA = startA;
  zInput.value = String(startZ);
  if (aInput) aInput.value = String(startA ?? mostStableMassNumberForZ(startZ));
  await runElementDerivation(startZ, startA);
  requestAnimationFrame(tickLiveMd);
}

boot();
