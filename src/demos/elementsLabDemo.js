// Gate 1 & Gate 2 Flagship Interactive Lab (`src/demos/elementsLabDemo.js`).
// Zero canned animations: every 3D volume, chart, band diagram, MD crystal,
// molecular orbital cloud, and convex (T, log10 P) polytope facet renders
// directly from live WebGPU solver outputs!

import { ELEMENT_SYMBOLS, symbolForZ } from '../runtime/electronicStructure/periodicTable.js';
import { mostStableMassNumberForZ } from '../runtime/nuclear/nuclearStructureGpu.js';
import { deriveNuclearDecayChain } from '../runtime/material/nuclearCherenkovClosure.js';
import { deriveElementBundleWebGpu } from '../runtime/material/periodicTableEngineWebGpu.js';
import { deriveCompoundBundleWebGpu } from '../runtime/material/recursiveCompoundPipeline.js';
import { buildMaterialPolytopeAtlasWebGpu } from '../runtime/material/polytopeAtlasBuilder.js';
import {
  buildFccCrystalMdState,
  createMolecularDynamicsSessionWebGpu
} from '../runtime/gpuMath/molecularDynamicsWebGpu.js';

const canvas = document.getElementById('gpu-canvas');
const plot1 = document.getElementById('plot1');
const plot2 = document.getElementById('plot2');
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

let gpuDevice = null;
let currentTab = 'nuclear';
let currentElementRes = null;
let currentCompoundRes = null;
let currentAtlas = null;
let currentDecayChain = null;
let selectedZ = 26;
let selectedA = null; // null => valley-of-stability A*
let liveMdSession = null;
let liveMdState = null;
let liveMdBusy = false;
let liveMdYaw = 0.45;

// Build clickable 118-element periodic table grid
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

// Render live 2D orthographic slice / ray-accumulated projection of real GPU 3D volume buffers
function drawVolumeSlice(ctx, w, h, volData, dim, channels, title, accentHex) {
  ctx.fillStyle = '#050911';
  ctx.fillRect(0, 0, w, h);
  if (!volData || dim < 4) return;
  const size = Math.min(w, h) * 0.78;
  const ox = (w - size) * 0.5;
  const oy = (h - size) * 0.5;
  const img = ctx.createImageData(dim, dim);
  // Front-to-back volumetric emission integration through Z slices (zero fake animation!)
  for (let y = 0; y < dim; y += 1) {
    for (let x = 0; x < dim; x += 1) {
      let rAcc = 0; let gAcc = 0; let bAcc = 0; let aAcc = 0;
      for (let z = 0; z < dim; z += 1) {
        const idx = (z * dim + y) * dim + x;
        let v0 = 0; let v1 = 0; let v2 = 0; let alpha = 0;
        if (channels === 4) {
          v0 = volData[idx * 4 + 0];
          v1 = volData[idx * 4 + 1];
          v2 = volData[idx * 4 + 2];
          alpha = volData[idx * 4 + 3] * (2.2 / dim);
        } else {
          const v = volData[idx];
          v0 = v; v1 = v * 0.7; v2 = Math.min(1, v * 1.4);
          alpha = v * (2.6 / dim);
        }
        const rem = 1 - aAcc;
        rAcc += rem * v0 * alpha;
        gAcc += rem * v1 * alpha;
        bAcc += rem * v2 * alpha;
        aAcc += rem * alpha;
        if (aAcc > 0.98) break;
      }
      const p = (y * dim + x) * 4;
      img.data[p + 0] = Math.min(255, Math.round(rAcc * 280));
      img.data[p + 1] = Math.min(255, Math.round(gAcc * 280));
      img.data[p + 2] = Math.min(255, Math.round(bAcc * 320));
      img.data[p + 3] = 255;
    }
  }
  const off = document.createElement('canvas');
  off.width = dim; off.height = dim;
  off.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, ox, oy, size, size);

  ctx.fillStyle = accentHex || '#56c2ff';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText(title, 18, 28);
}

function drawPlotLine(cv, xs, ys, { label = '', color = '#56c2ff', yMin = null, yMax = null } = {}) {
  const ctx = cv.getContext('2d');
  const w = cv.width; const h = cv.height;
  ctx.fillStyle = '#070d18';
  ctx.fillRect(0, 0, w, h);
  if (!xs || !ys || xs.length < 2) return;
  const loX = Math.min(...xs); const hiX = Math.max(...xs);
  const loY = yMin != null ? yMin : Math.min(...ys);
  const hiY = yMax != null ? yMax : Math.max(...ys);
  const spanX = Math.max(1e-9, hiX - loX);
  const spanY = Math.max(1e-9, hiY - loY);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < xs.length; i += 1) {
    const px = 28 + ((xs[i] - loX) / spanX) * (w - 42);
    const py = h - 22 - ((ys[i] - loY) / spanY) * (h - 42);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = '#9bb2d4';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText(label, 10, 15);
}

function drawNuclideChart(cv, nuclear) {
  const ctx = cv.getContext('2d');
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
  // Highlight selected (N, Z)
  const sx = 12 + (nuclear.N / maxN) * (w - 24);
  const sy = h - 12 - (nuclear.Z / maxZ) * (h - 24);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx - 4, sy - 4, 8, 8);
}

function drawPolytopeDiagram(cv, atlas) {
  const ctx = cv.getContext('2d');
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
  const padL = 42; const padR = 16; const padT = 26; const padB = 28;
  const mapX = (T) => padL + ((Math.log10(Math.max(1, T)) - minLt) / Math.max(1e-6, maxLt - minLt)) * (w - padL - padR);
  const mapY = (lp) => h - padB - ((lp - minLp) / Math.max(1e-6, maxLp - minLp)) * (h - padT - padB);

  // Subtle log-grid & axis labels
  ctx.strokeStyle = 'rgba(148,163,184,0.14)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const gx = padL + (i / 4) * (w - padL - padR);
    ctx.beginPath(); ctx.moveTo(gx, padT); ctx.lineTo(gx, h - padB); ctx.stroke();
    const gy = padT + (i / 4) * (h - padT - padB);
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
  }

  for (const poly of atlas.polytopes) {
    const lp0 = Math.log10(poly.axes[1].min);
    const lp1 = Math.log10(poly.axes[1].max);
    const steps = 12;
    const upperPts = [];
    const lowerPts = [];
    // Sample valid T interval [tLo(lp), tHi(lp)] satisfying all A x <= b half-space inequalities!
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
      ctx.lineWidth = 1.4;
      ctx.stroke();

      const mid = Math.floor(lowerPts.length / 2);
      const cx = 0.5 * (lowerPts[mid][0] + upperPts[mid][0]);
      const cy = 0.5 * (lowerPts[mid][1] + upperPts[mid][1]);
      if (Math.abs(upperPts[mid][0] - lowerPts[mid][0]) > 22) {
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(poly.phase, cx - 16, cy + 4);
      }
    }
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText(`Convex Polytope Atlas (A x <= b, log₁₀ T vs log₁₀ P) — ${atlas.materialKey} (${atlas.polytopeCount} cells)`, padL, 16);
  ctx.fillText(`T: ${Math.round(10 ** minLt)} K → ${Math.round(10 ** maxLt)} K (log scale)`, padL, h - 8);
  ctx.fillText(`log₁₀ P: ${minLp.toFixed(0)}..${maxLp.toFixed(0)}`, w - 125, h - 8);
}

function drawLiveMdCrystal(ctx, w, h, res, mdState, yaw) {
  const thermo = res.visualData.thermo;
  const md = mdState?.telemetry || thermo.mdTelemetry;
  ctx.fillStyle = '#56c2ff';
  ctx.font = 'bold 15px Inter, sans-serif';
  ctx.fillText(`Live Representative WebGPU MD — ${res.bundle.symbol} (${thermo.potential.modelName})`, 20, 28);
  if (md) {
    ctx.fillStyle = '#e6eefc';
    ctx.font = '12px monospace';
    ctx.fillText(
      `Atoms: ${md.atomCount} | Steps: ${md.totalSteps} | t = ${fmt(md.timeFs, 1)} fs | T = ${fmt(md.temperatureK, 1)} K | P = ${fmt(md.pressureGPa, 2)} GPa | MSD = ${fmt(md.msdA2, 4)} Å²`,
      20, 50
    );
  }
  if (!mdState?.positions || !mdState?.boxL) return;
  const pos = mdState.positions;
  const vel = mdState.velocities;
  const n = pos.length / 4;
  const L = mdState.boxL;
  const half = 0.5 * L;
  const cx = w * 0.5;
  const cy = h * 0.54;
  const scale = Math.min(w, h) * 0.34;
  const cosY = Math.cos(yaw); const sinY = Math.sin(yaw);
  const cosX = Math.cos(0.32); const sinX = Math.sin(0.32);

  // Project live GPU atom coordinates
  const projected = [];
  for (let i = 0; i < n; i += 1) {
    const x = (pos[i * 4] - half) / half;
    const y = (pos[i * 4 + 1] - half) / half;
    const z = (pos[i * 4 + 2] - half) / half;
    const vx = vel[i * 4]; const vy = vel[i * 4 + 1]; const vz = vel[i * 4 + 2];
    const speed = Math.hypot(vx, vy, vz);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX + 3.2;
    const persp = 2.4 / Math.max(0.5, z2);
    projected.push({
      sx: cx + x1 * scale * persp,
      sy: cy - y2 * scale * persp,
      z: z2,
      r: Math.max(3.5, 8.5 * persp),
      speed
    });
  }
  projected.sort((a, b) => b.z - a.z);

  // Draw periodic cell wireframe
  ctx.strokeStyle = 'rgba(86, 194, 255, 0.25)';
  ctx.lineWidth = 1;
  const corners = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const x1 = sx * cosY - sz * sinY;
    const z1 = sx * sinY + sz * cosY;
    const y2 = sy * cosX - z1 * sinX;
    const z2 = sy * sinX + z1 * cosX + 3.2;
    const persp = 2.4 / Math.max(0.5, z2);
    corners.push([cx + x1 * scale * persp, cy - y2 * scale * persp]);
  }
  const edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  for (const [a, b] of edges) {
    ctx.beginPath(); ctx.moveTo(corners[a][0], corners[a][1]); ctx.lineTo(corners[b][0], corners[b][1]); ctx.stroke();
  }

  for (const p of projected) {
    const heat = Math.min(1, p.speed * 40);
    const rCol = Math.round(70 + 185 * heat);
    const gCol = Math.round(170 + 60 * (1 - Math.abs(heat - 0.5)));
    const bCol = Math.round(255 * (1 - 0.7 * heat));
    const grad = ctx.createRadialGradient(p.sx - p.r * 0.3, p.sy - p.r * 0.3, p.r * 0.1, p.sx, p.sy, p.r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, `rgb(${rCol},${gCol},${bCol})`);
    grad.addColorStop(1, `rgba(${Math.round(rCol * 0.3)},${Math.round(gCol * 0.3)},${Math.round(bCol * 0.5)},0.9)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function redrawCurrentTab() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(rect.width));
  canvas.height = Math.max(240, Math.floor(rect.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#050911';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (currentTab === 'nuclear' && currentElementRes) {
    const nuc = currentElementRes.visualData.nuclear;
    drawVolumeSlice(ctx, canvas.width, canvas.height, nuc.volumeData, nuc.volDim, 4,
      `Live WebGPU 3D Fermi Nuclear Density — ${nuc.isotope} (R_rms = ${fmt(nuc.chargeRadiusFm, 2)} fm)`, '#ff9c54');
    plot1Title.textContent = 'GPU 118×200 Chart of Nuclides (N vs Z)';
    drawNuclideChart(plot1, nuc);
    plot2Title.textContent = `WKB Gamow Barrier V(r) (Q_α = ${fmt(nuc.qAlphaMeV, 2)} MeV)`;
    drawPlotLine(plot2, Array.from(nuc.alphaWkb.rFm), Array.from(nuc.alphaWkb.vMeV), {
      label: 'V_nuc + V_coul (MeV vs fm)', color: '#facc15'
    });
  } else if (currentTab === 'atomic' && currentElementRes) {
    const atom = currentElementRes.visualData.atom;
    const rg = atom.radialGrid;
    // Construct 3D slice directly from solved GPU radial density rho(r)
    const dim = 32;
    const vol = new Float32Array(dim ** 3);
    const rMaxPlot = Math.min(10, rg.r[rg.r.length - 1]);
    let peak = 1e-12;
    for (let z = 0; z < dim; z += 1) {
      for (let y = 0; y < dim; y += 1) {
        for (let x = 0; x < dim; x += 1) {
          const rx = ((x + 0.5) / dim * 2 - 1) * rMaxPlot;
          const ry = ((y + 0.5) / dim * 2 - 1) * rMaxPlot;
          const rz = ((z + 0.5) / dim * 2 - 1) * rMaxPlot;
          const rr = Math.hypot(rx, ry, rz);
          let val = 0;
          for (let i = 1; i < rg.r.length; i += 1) {
            if (rg.r[i] >= rr) { val = rg.rho[i]; break; }
          }
          const scaled = Math.pow(Math.max(0, val), 0.35);
          vol[(z * dim + y) * dim + x] = scaled;
          if (scaled > peak) peak = scaled;
        }
      }
    }
    for (let i = 0; i < vol.length; i += 1) vol[i] /= peak;
    drawVolumeSlice(ctx, canvas.width, canvas.height, vol, dim, 1,
      `Live WebGPU Relativistic Atomic ρ(r) — ${atom.symbol} (${atom.relativisticMethod}, 0 SCF readbacks)`, '#56c2ff');
    plot1Title.textContent = 'Radial Probability 4πr²ρ(r) (Log Grid)';
    const prob = rg.r.map((rv, i) => 4 * Math.PI * rv * rv * rg.rho[i]);
    const capIdx = rg.r.findIndex((rv) => rv > 8);
    const end = capIdx > 10 ? capIdx : rg.r.length;
    drawPlotLine(plot1, rg.r.slice(0, end), prob.slice(0, end), { label: '4πr²ρ(r) vs r (Bohr)', color: '#56c2ff' });
    plot2Title.textContent = 'Relativistic Orbital Eigenvalues ε_nl (Ha)';
    drawPlotLine(plot2, atom.orbitals.map((_, i) => i), atom.orbitals.map((o) => o.energyHa), {
      label: 'Subshell Index vs Energy (Ha)', color: '#34d399'
    });
  } else if (currentTab === 'crystal' && currentElementRes) {
    const bulk = currentElementRes.visualData.bulk;
    const em = currentElementRes.visualData.em;
    drawVolumeSlice(ctx, canvas.width, canvas.height, bulk.blochDensity3d, bulk.blochDensityGridN, 1,
      `Live WebGPU 3D FFT Bloch Charge Density — ${bulk.symbol} (${bulk.crystalStructure}, a₀=${fmt(bulk.latticeConstantA, 2)} Å)`, '#34d399');
    plot1Title.textContent = 'Brillouin Band Structure E_n(k) (Γ→X→W→L→Γ)';
    drawPlotLine(plot1, bulk.bandsEv.map((_, i) => i), bulk.bandsEv.map((b) => b[0]), {
      label: `Lowest Bloch Band (E_F = ${fmt(bulk.fermiEnergyEv, 1)} eV, Gap = ${fmt(bulk.bandGapEv, 2)} eV)`, color: '#a78bfa'
    });
    plot2Title.textContent = 'Electronic DOS g(E) (states/eV/atom)';
    drawPlotLine(plot2, Array.from(bulk.dosEnergyEv), Array.from(bulk.dosValues), {
      label: `g(E_F) = ${fmt(bulk.dosAtFermiStatesPerEvAtom, 2)}, ${em.magneticPhase}`, color: '#f472b6'
    });
  } else if (currentTab === 'md' && currentElementRes) {
    const thermo = currentElementRes.visualData.thermo;
    drawLiveMdCrystal(ctx, canvas.width, canvas.height, currentElementRes, liveMdState, liveMdYaw);
    const md = liveMdState?.telemetry || thermo.mdTelemetry;
    if (md) {
      plot1Title.textContent = 'GPU Radial Distribution Function g(r)';
      const rAxis = Array.from(md.rdf).map((_, i) => ((i + 0.5) / md.rdf.length) * thermo.potential.rcutA);
      drawPlotLine(plot1, rAxis, Array.from(md.rdf), { label: 'g(r) vs r (Å)', color: '#34d399', yMin: 0 });
    }
    plot2Title.textContent = `Phase Transitions (${currentElementRes.bundle.symbol})`;
    drawPlotLine(plot2, [0, 1, 2], [0, thermo.meltingPointK, thermo.boilingPointK], {
      label: `T_m = ${fmt(thermo.meltingPointK, 0)} K, T_b = ${fmt(thermo.boilingPointK, 0)} K`, color: '#ff9c54'
    });
  } else if (currentTab === 'compound' && currentCompoundRes) {
    const mqm = currentCompoundRes.visualData.molQm;
    const cb = currentCompoundRes.bundle;
    if (mqm?.volumeData) {
      drawVolumeSlice(ctx, canvas.width, canvas.height, mqm.volumeData, mqm.volDim, 4,
        `Live WebGPU Molecular RHF Density — ${cb.materialKey} (E=${fmt(mqm.totalEnergyHa, 2)} Ha, μ=${fmt(mqm.dipoleDebye, 2)} D)`, '#c084fc');
    } else {
      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText(`Recursive Compound Closure — ${cb.materialKey} (${cb.mechanical.crystalStructure})`, 20, 34);
    }
    if (mqm?.orbitalEnergiesHa) {
      plot1Title.textContent = `Molecular Orbital Spectrum (${cb.materialKey} GPU RHF)`;
      drawPlotLine(plot1, mqm.orbitalEnergiesHa.map((_, i) => i), mqm.orbitalEnergiesHa, {
        label: `MO Energy (Ha) | HOMO-LUMO Gap = ${fmt(mqm.homoLumoGapEv, 2)} eV`, color: '#c084fc'
      });
    }
    plot2Title.textContent = `Derived Compound Phase & Transport (${cb.materialKey})`;
    drawPlotLine(plot2, [0, 1, 2], [0, cb.thermodynamic.meltingPointK, cb.thermodynamic.boilingPointK], {
      label: `T_m = ${fmt(cb.thermodynamic.meltingPointK, 0)} K, T_b = ${fmt(cb.thermodynamic.boilingPointK, 0)} K, ρ = ${fmt(cb.mechanical.densityKgPerM3, 0)} kg/m³`,
      color: '#38bdf8'
    });
  } else if (currentTab === 'polytope' && currentAtlas) {
    drawPolytopeDiagram(canvas, currentAtlas);
    plot1Title.textContent = `Polytope Atlas (${currentAtlas.materialKey}): ${currentAtlas.polytopeCount} Convex Cells`;
    drawPolytopeDiagram(plot1, currentAtlas);
    plot2Title.textContent = 'GPU Chebyshev Max Relative Residuals';
    const errs = currentAtlas.polytopes.map((p) => (p.fit?.maxRelativeError ?? 0) * 100);
    drawPlotLine(plot2, errs.map((_, i) => i), errs, { label: 'Max Rel Error (%) per Polytope', color: '#38bdf8', yMin: 0 });
  }
}

function initLiveMdForElement(res) {
  if (liveMdSession) {
    try { liveMdSession.destroy(); } catch {}
    liveMdSession = null;
  }
  liveMdState = null;
  if (!gpuDevice || !res?.visualData?.thermo?.potential) return;
  const bulk = res.visualData.bulk;
  const pot = res.visualData.thermo.potential;
  const massU = Math.max(1, Number(res.bundle.nuclear.atomicMassU || 28));
  const tProbe = Math.max(20, Math.min(450, 0.5 * Number(res.bundle.thermodynamic.meltingPointK || 600)));
  const init = buildFccCrystalMdState({
    cellsPerSide: 3,
    latticeConstantA: Math.max(2.6, Number(bulk.latticeConstantA || 3.6)),
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
    dtFs: Math.min(2.0, Math.max(0.4, 0.08 * Math.sqrt(massU))),
    targetTemperatureK: tProbe,
    thermostatCouplingFs: 40
  });
  liveMdState = {
    positions: init.positions,
    velocities: init.velocities,
    boxL: init.boxLengthsA[0],
    telemetry: res.visualData.thermo.mdTelemetry
  };
}

function tickLiveMd() {
  if (currentTab === 'md' && liveMdSession && !liveMdBusy) {
    liveMdBusy = true;
    liveMdSession.stepBatch(3, { readTelemetry: true })
      .then(async (tel) => {
        if (!liveMdSession) return;
        const pv = await liveMdSession.readPositionsAndVelocities();
        liveMdYaw += 0.025;
        liveMdState = {
          positions: pv.positions,
          velocities: pv.velocities,
          boxL: liveMdSession.boxLengthsA[0],
          telemetry: tel
        };
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
    const actualA = currentElementRes.bundle.nuclear.A;
    if (aInput) aInput.value = String(actualA);
    currentDecayChain = deriveNuclearDecayChain(Z, actualA, { maxDepth: 12 });
    currentAtlas = await buildMaterialPolytopeAtlasWebGpu(gpuDevice, currentElementRes.bundle, {
      degrees: [4, 3], relativeTolerance: 0.05, maxBisectDepth: 1, materialIndex: Z
    });
    initLiveMdForElement(currentElementRes);
    renderBundleCard(currentElementRes.bundle, currentDecayChain);
    renderG7Card(currentElementRes.bundle, currentElementRes.g7Advisory);
    statusBadge.textContent = `${currentElementRes.bundle.nuclear.isotope} · WebGPU OK`;
    redrawCurrentTab();
    window.__ulgElementsLabState = {
      mode: 'element',
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

async function runCompoundDerivation(formula) {
  if (!gpuDevice) return;
  statusBadge.textContent = `Deriving ${formula}…`;
  try {
    currentCompoundRes = await deriveCompoundBundleWebGpu(gpuDevice, formula, {
      runLiveMd: true,
      mdSteps: 12,
      reactionContext: { source: 'elements-lab-interactive' }
    });
    currentAtlas = await buildMaterialPolytopeAtlasWebGpu(gpuDevice, currentCompoundRes.bundle, {
      degrees: [4, 3], relativeTolerance: 0.05, maxBisectDepth: 1
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
      formula,
      bundle: currentCompoundRes.bundle,
      atlasPolytopeCount: currentAtlas.polytopeCount
    };
  } catch (err) {
    statusBadge.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

async function boot() {
  buildPeriodicTableButtons();
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
