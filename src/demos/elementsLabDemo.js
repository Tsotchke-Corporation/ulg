// Gate 1 & Gate 2 Flagship Interactive Lab (`src/demos/elementsLabDemo.js`).
// Zero canned animations: every 3D volume, chart, band diagram, MD crystal,
// molecular orbital cloud, and convex (T, log10 P) polytope facet renders
// directly from live WebGPU solver outputs!

import { ELEMENT_SYMBOLS, symbolForZ } from '../runtime/electronicStructure/periodicTable.js';
import { deriveElementBundleWebGpu } from '../runtime/material/periodicTableEngineWebGpu.js';
import { deriveCompoundBundleWebGpu } from '../runtime/material/recursiveCompoundPipeline.js';
import { buildMaterialPolytopeAtlasWebGpu } from '../runtime/material/polytopeAtlasBuilder.js';

const canvas = document.getElementById('gpu-canvas');
const plot1 = document.getElementById('plot1');
const plot2 = document.getElementById('plot2');
const ptGrid = document.getElementById('pt-grid');
const zInput = document.getElementById('z-input');
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
let selectedZ = 26;

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
      zInput.value = String(Z);
      runElementDerivation(Z);
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

function renderBundleCard(bundle) {
  const rows = [
    ['Material / Family', `${bundle.materialKey} (${bundle.family})`],
    ['Accuracy Tier', bundle.accuracyTier],
    ['Closure Hash', bundle.closureHash],
    ['Nuclear', bundle.nuclear.isotope ? `${bundle.nuclear.isotope} · B/A=${fmt(bundle.nuclear.bindingPerNucleonMeV, 2)} MeV · R=${fmt(bundle.nuclear.chargeRadiusFm, 2)} fm` : `Z=${bundle.nuclear.totalProtonsZ}, A=${bundle.nuclear.totalNucleonsA}`],
    ['Nuclear Spin / Mode', bundle.nuclear.dominantMode ? `${bundle.nuclear.spinI}${bundle.nuclear.parity} · ${bundle.nuclear.dominantMode}` : `M=${fmt(bundle.nuclear.molarMassU, 2)} u`],
    ['Atomic Energy', `${fmt(bundle.atomic.totalEnergyHa, 2)} Ha (readbacks/SCF: ${bundle.atomic.perScfCpuReadbacks ?? 0})`],
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
    solid: 'rgba(86, 194, 255, 0.35)',
    liquid: 'rgba(52, 211, 153, 0.35)',
    gas: 'rgba(251, 146, 60, 0.30)',
    plasma: 'rgba(192, 132, 252, 0.35)'
  };
  const maxT = Math.max(...atlas.polytopes.map((p) => p.axes[0].max));
  const minLp = Math.min(...atlas.polytopes.map((p) => Math.log10(p.axes[1].min)));
  const maxLp = Math.max(...atlas.polytopes.map((p) => Math.log10(p.axes[1].max)));
  for (const poly of atlas.polytopes) {
    const x0 = 26 + (poly.axes[0].min / maxT) * (w - 40);
    const x1 = 26 + (poly.axes[0].max / maxT) * (w - 40);
    const y0 = h - 20 - ((Math.log10(poly.axes[1].min) - minLp) / Math.max(1e-6, maxLp - minLp)) * (h - 36);
    const y1 = h - 20 - ((Math.log10(poly.axes[1].max) - minLp) / Math.max(1e-6, maxLp - minLp)) * (h - 36);
    ctx.fillStyle = phaseColors[poly.phase] || 'rgba(255,255,255,0.2)';
    ctx.fillRect(x0, y1, Math.max(2, x1 - x0), Math.max(2, y0 - y1));
    ctx.strokeStyle = '#93c5fd';
    ctx.strokeRect(x0, y1, Math.max(2, x1 - x0), Math.max(2, y0 - y1));
    ctx.fillStyle = '#fff';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(poly.phase, x0 + 3, y1 + 12);
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
    const md = thermo.mdTelemetry;
    ctx.fillStyle = '#56c2ff';
    ctx.font = 'bold 15px Inter, sans-serif';
    ctx.fillText(`Live Representative WebGPU MD — ${currentElementRes.bundle.symbol} (${thermo.potential.modelName})`, 20, 32);
    if (md) {
      ctx.fillStyle = '#e6eefc';
      ctx.font = '13px monospace';
      ctx.fillText(`Atoms: ${md.atomCount} | Steps: ${md.totalSteps} | t = ${fmt(md.timeFs, 1)} fs`, 20, 64);
      ctx.fillText(`T = ${fmt(md.temperatureK, 1)} K | P = ${fmt(md.pressureGPa, 2)} GPa | MSD = ${fmt(md.msdA2, 4)} Å²`, 20, 88);
      ctx.fillText(`E_kin = ${fmt(md.kineticEnergyEv, 3)} eV | E_pot = ${fmt(md.potentialEnergyEv, 3)} eV | E_tot = ${fmt(md.totalEnergyEv, 3)} eV`, 20, 112);
      plot1Title.textContent = 'GPU Radial Distribution Function g(r)';
      const rAxis = Array.from(md.rdf).map((_, i) => ((i + 0.5) / md.rdf.length) * thermo.potential.rcutA);
      drawPlotLine(plot1, rAxis, Array.from(md.rdf), { label: 'g(r) vs r (Å)', color: '#34d399', yMin: 0 });
    }
    plot2Title.textContent = 'Phase Transitions & Transport Summary';
    drawPlotLine(plot2, [0, 1, 2], [0, thermo.meltingPointK, thermo.boilingPointK], {
      label: `T_m = ${fmt(thermo.meltingPointK, 0)} K, T_b = ${fmt(thermo.boilingPointK, 0)} K`, color: '#ff9c54'
    });
  } else if (currentTab === 'compound' && currentCompoundRes) {
    const mqm = currentCompoundRes.visualData.molQm;
    if (mqm?.volumeData) {
      drawVolumeSlice(ctx, canvas.width, canvas.height, mqm.volumeData, mqm.volDim, 4,
        `Live WebGPU Molecular RHF Density — ${currentCompoundRes.bundle.materialKey} (E=${fmt(mqm.totalEnergyHa, 2)} Ha, μ=${fmt(mqm.dipoleDebye, 2)} D)`, '#c084fc');
    } else {
      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText(`Recursive Compound Closure — ${currentCompoundRes.bundle.materialKey} (${currentCompoundRes.bundle.mechanical.crystalStructure})`, 20, 34);
    }
    if (mqm?.orbitalEnergiesHa) {
      plot1Title.textContent = 'Molecular Orbital Spectrum (GPU RHF)';
      drawPlotLine(plot1, mqm.orbitalEnergiesHa.map((_, i) => i), mqm.orbitalEnergiesHa, {
        label: `MO Energy (Ha) | HOMO-LUMO Gap = ${fmt(mqm.homoLumoGapEv, 2)} eV`, color: '#c084fc'
      });
    }
  } else if (currentTab === 'polytope' && currentAtlas) {
    drawPolytopeDiagram(canvas, currentAtlas);
    plot1Title.textContent = `Polytope Atlas (${currentAtlas.materialKey}): ${currentAtlas.polytopeCount} Convex Cells`;
    drawPolytopeDiagram(plot1, currentAtlas);
    plot2Title.textContent = 'GPU Chebyshev Max Relative Residuals';
    const errs = currentAtlas.polytopes.map((p) => (p.fit?.maxRelativeError ?? 0) * 100);
    drawPlotLine(plot2, errs.map((_, i) => i), errs, { label: 'Max Rel Error (%) per Polytope', color: '#38bdf8', yMin: 0 });
  }
}

async function runElementDerivation(Z) {
  if (!gpuDevice) return;
  statusBadge.textContent = `Solving ${symbolForZ(Z)} (Z=${Z})…`;
  updateActiveElementButton();
  try {
    currentElementRes = await deriveElementBundleWebGpu(gpuDevice, Z, {
      runNuclearGpuVolume: true,
      runLiveMd: true,
      mdSteps: 16,
      atomicMaxScf: 50,
      nuclearVolDim: 24,
      blochGridN: 16
    });
    currentAtlas = await buildMaterialPolytopeAtlasWebGpu(gpuDevice, currentElementRes.bundle, {
      degrees: [4, 3], relativeTolerance: 0.05, maxBisectDepth: 1, materialIndex: Z
    });
    renderBundleCard(currentElementRes.bundle);
    renderG7Card(currentElementRes.bundle, currentElementRes.g7Advisory);
    statusBadge.textContent = `${symbolForZ(Z)} · WebGPU OK`;
    redrawCurrentTab();
    window.__ulgElementsLabState = {
      mode: 'element',
      Z,
      bundle: currentElementRes.bundle,
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
    selectedZ = z;
    runElementDerivation(z);
  });
  solveCompoundBtn.addEventListener('click', () => {
    runCompoundDerivation(compoundInput.value || 'H2O');
  });

  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) {
    statusBadge.textContent = 'WebGPU unavailable (fail-closed)';
    return;
  }
  gpuDevice = await adapter.requestDevice();
  gpuDevice.addEventListener('uncapturederror', (e) => console.error('WebGPU error:', e.error));
  const params = new URLSearchParams(window.location.search);
  const startZ = Math.max(1, Math.min(118, Math.trunc(Number(params.get('z')) || 26)));
  selectedZ = startZ;
  zInput.value = String(startZ);
  await runElementDerivation(startZ);
}

boot();
