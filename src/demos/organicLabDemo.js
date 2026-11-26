// Flagship Interactive Controller for ULG Organic Chemistry Lab (`organic-lab.html`)
// (`src/demos/organicLabDemo.js`).
//
// Pure WebGPU direct rendering (zero Three.js, 1 submit/frame, cameraAutoSpin: false):
//   - Nodes #17-19: organic-molecular-graph-hybridization@1, reactive-bond-order-md@1,
//     and acid-base-catalysis-kinetics@1 dynamically orchestrated via Universal Law Graph!

import {
  ORGANIC_MOLECULE_INITIAL_CONDITIONS,
  buildOrganicMolecularGraph,
  buildPiOrbitalCloudBufferWebGpu,
  mirrorOrganicMolecularGraph,
  solvePiMolecularOrbitalsWebGpu,
  solveQeqCharges
} from '../runtime/organic/organicMolecularGraphGpu.js';
import { createReactiveBondOrderMdSessionWebGpu } from '../runtime/organic/reactiveBondOrderMdGpu.js';
import {
  createAutocatalyticNetworkSessionWebGpu,
  evaluateAcidBaseEquilibrium
} from '../runtime/organic/acidBaseCatalysisGpu.js';
import { resolveActiveUniversalLaws } from '../runtime/universalLawGraph.js';
import { GPU_PICK_LAYOUT, createGpuEntityPickerWebGpu } from '../runtime/gpuMath/gpuEntityPickerWebGpu.js';
import { createTargetOrbitControls } from '../runtime/shared/targetOrbitControls.js';
import { createChemBioWebGpuRenderer } from './chemBioWebGpuRenderer.js';
import { ORGANIC_LAB_ABOUT_ULG, ORGANIC_MODE_DOCS } from './organicLabDocs.js';

const SPATIAL_MODES = new Set(['frank-chiral', 'belousov-zhabotinsky', 'prebiotic-raf']);

function drawLinePlot(canvas, { xMin, xMax, yMin, yMax, series = [], vMarker = null, hZero = false, labelX = '', labelY = '' }) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#050914';
  ctx.fillRect(0, 0, w, h);

  const padL = 34; const padR = 10; const padT = 10; const padB = 20;
  const pw = w - padL - padR;
  const ph = h - padT - padB;
  const mapX = (x) => padL + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * pw;
  const mapY = (y) => padT + ph - ((y - yMin) / Math.max(1e-6, yMax - yMin)) * ph;

  // Grid lines
  ctx.strokeStyle = 'rgba(124,164,240,0.14)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const gy = padT + (i / 4) * ph;
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
  }
  if (hZero && yMin < 0 && yMax > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    const y0 = mapY(0);
    ctx.beginPath(); ctx.moveTo(padL, y0); ctx.lineTo(w - padR, y0); ctx.stroke();
  }

  for (const s of series) {
    if (!s.pts || s.pts.length < 2) continue;
    ctx.strokeStyle = s.color || '#56c2ff';
    ctx.lineWidth = s.width || 1.8;
    ctx.beginPath();
    for (let i = 0; i < s.pts.length; i += 1) {
      const px = mapX(s.pts[i][0]);
      const py = Math.max(padT, Math.min(padT + ph, mapY(s.pts[i][1])));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  if (vMarker !== null && Number.isFinite(vMarker)) {
    const mx = mapX(vMarker);
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, padT + ph); ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = '#8fa4c4';
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillText(yMax.toFixed(1), 3, padT + 7);
  ctx.fillText(yMin.toFixed(1), 3, padT + ph);
  ctx.fillText(labelX || `${xMin}..${xMax}`, padL + pw * 0.34, h - 5);
  if (labelY) ctx.fillText(labelY, padL + 2, padT + 9);
}

function drawMoLevelPlot(canvas, piRes, selectedMo) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#050914';
  ctx.fillRect(0, 0, w, h);

  if (!piRes || piRes.piAtomCount === 0) {
    ctx.fillStyle = '#8fa4c4';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('Pure sp³ σ-framework (0 π-orbitals)', 34, h * 0.48);
    ctx.fillStyle = '#56c2ff';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('All valence electrons in localized σ-bonds', 28, h * 0.66);
    return;
  }

  const evals = piRes.eigenvaluesEv;
  const occ = piRes.occupancies;
  const eMin = Math.min(-6.5, ...evals) - 0.8;
  const eMax = Math.max(6.5, ...evals) + 0.8;
  const mapY = (e) => 12 + (h - 24) * (1 - (e - eMin) / Math.max(1e-3, eMax - eMin));

  // E = 0 non-bonding reference line
  const y0 = mapY(0);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(32, y0); ctx.lineTo(w - 12, y0); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#64748b';
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillText('α(0)', 4, y0 + 3);

  // Group nearly degenerate levels horizontally so Benzene / Cyclobutadiene show clean side-by-side pairs!
  const groups = [];
  for (let k = 0; k < evals.length; k += 1) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(evals[last[0]] - evals[k]) < 0.08) last.push(k);
    else groups.push([k]);
  }
  for (const g of groups) {
    const y = mapY(evals[g[0]]);
    const segW = Math.min(72, (w - 92) / g.length - 8);
    const totalW = g.length * segW + (g.length - 1) * 10;
    const x0 = 40 + ((w - 84) - totalW) * 0.5;
    g.forEach((moIdx, j) => {
      const lx = x0 + j * (segW + 10);
      const isSel = moIdx === selectedMo;
      const isOcc = occ[moIdx] > 0.05;
      ctx.strokeStyle = isSel ? '#facc15' : (isOcc ? '#56c2ff' : '#f472b6');
      ctx.lineWidth = isSel ? 3.0 : 2.0;
      ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + segW, y); ctx.stroke();

      // Electron spin arrows
      const cx = lx + segW * 0.5;
      ctx.fillStyle = '#e0f2fe';
      ctx.font = '11px ui-monospace, monospace';
      if (occ[moIdx] >= 1.8) ctx.fillText('↑↓', cx - 8, y - 3);
      else if (occ[moIdx] >= 0.8) ctx.fillText('↑', cx - 3, y - 3);
    });
  }

  // Right-side summary badge
  ctx.fillStyle = piRes.isAromatic4nPlus2 ? '#34d399' : '#f472b6';
  ctx.font = 'bold 9.5px ui-monospace, monospace';
  ctx.fillText(piRes.isAromatic4nPlus2 ? '4n+2 AROMATIC' : (piRes.homoLumoGapEv < 0.1 ? '4n DIRADICAL' : 'CONJUGATED'), w - 98, 13);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillText(`ΔE=${piRes.homoLumoGapEv.toFixed(2)}eV`, w - 98, h - 16);
  if (piRes.uvVisLambdaMaxNm > 0) {
    ctx.fillText(`λ=${Math.round(piRes.uvVisLambdaMaxNm)}nm`, w - 98, h - 5);
  }
}

export async function mountOrganicLabDemo() {
  if (!navigator.gpu) throw new Error('WebGPU is not available in this browser.');
  let adapter = null;
  for (let i = 0; i < 6 && !adapter; i += 1) {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) adapter = await navigator.gpu.requestAdapter();
    if (!adapter) await new Promise((r) => setTimeout(r, 250));
  }
  if (!adapter) throw new Error('No WebGPU GPUAdapter available.');
  const device = await adapter.requestDevice();
  const gpuErrors = [];
  device.addEventListener?.('uncapturederror', (ev) => {
    gpuErrors.push(String(ev?.error?.message || ev?.error || 'uncaptured-webgpu-error').slice(0, 240));
  });

  const canvas = document.getElementById('org-canvas');
  const renderer = createChemBioWebGpuRenderer(device, canvas, { bgStyle: 0 });
  const gpuPicker = createGpuEntityPickerWebGpu(device);
  const plot1 = document.getElementById('plot1');
  const plot2 = document.getElementById('plot2');
  const plot3 = document.getElementById('plot3');
  let pickedEntity = null;

  let currentMode = 'sulflower-bearing';
  let currentGraph = null;
  let currentPiRes = null;
  let currentQeq = null;
  let currentAcidBase = null;
  let mdSession = null;
  let rdSession = null;
  let piCloudBuf = null;
  let piCloudCount = 0;

  let temperatureK = 300;
  let dielectricEr = 78.4;
  let pH = 7.0;
  let selectedMoIdx = 0;
  let showPiMo = false;
  let espMode = false;
  let reactProgress = 0.0;
  let bearingTorque = 0.45;
  let autoCycleReaction = true;
  let reactDir = 1;
  let kInhib = 1.85;
  let feedRate = 0.20;
  let simSpeed = 0.25;
  let stepAccum = 0.0;
  let paused = false;
  let disposed = false;
  let busy = false;
  let frameCount = 0;
  let eeHistory = [];
  let purityHistory = [];
  let startTimeMs = performance.now();

  const el = (id) => document.getElementById(id);
  let orbitControls = null;

  function applySimSpeed(next) {
    simSpeed = Math.max(0.05, Math.min(2.0, Math.round((Number(next) || 0.25) * 20) / 20));
    if (el('sl-sim-speed')) el('sl-sim-speed').value = simSpeed.toFixed(2);
    if (el('val-sim-speed')) el('val-sim-speed').textContent = `${simSpeed.toFixed(2)}×`;
    document.querySelectorAll('#speed-preset-row [data-speed]').forEach((b) => {
      b.classList.toggle('active', Math.abs(Number(b.dataset.speed) - simSpeed) < 0.02);
    });
  }

  function refreshCameraForMode(mode) {
    let pose;
    if (SPATIAL_MODES.has(mode)) {
      pose = { yaw: 0.0, pitch: 1.12, dist: 19.2, target: [0, 0, 0] };
    } else if (mode === 'sulflower-bearing') {
      pose = { yaw: 0.0, pitch: 0.16, dist: 29.5, target: [0, 0, 0] };
    } else if (mode === 'naphthalene' || mode === 'adenine' || mode === 'ethanol-water-hbond' || mode === 'diels-alder') {
      pose = { yaw: 0.45, pitch: 0.52, dist: 10.6, target: [0, 0, 0] };
    } else {
      pose = { yaw: 0.48, pitch: 0.46, dist: 8.6, target: [0, 0, 0] };
    }
    if (orbitControls) orbitControls.setPose(pose, { immediate: true, updateHome: true });
    else renderer.setCamera(pose);
  }

  async function rebuildPiCloud() {
    if (!currentGraph || !currentPiRes || currentPiRes.piAtomCount === 0) {
      piCloudCount = 0;
      return;
    }
    const built = buildPiOrbitalCloudBufferWebGpu(device, currentGraph, currentPiRes, {
      moIndex: selectedMoIdx,
      pointCount: 2800,
      reuseBuffer: piCloudBuf
    });
    piCloudBuf = built.pointsBuffer;
    piCloudCount = built.pointCount;
    const lbl = selectedMoIdx === currentPiRes.homoIndex
      ? `MO ${selectedMoIdx} (HOMO)`
      : (selectedMoIdx === currentPiRes.lumoIndex ? `MO ${selectedMoIdx} (LUMO)` : `MO ${selectedMoIdx}`);
    el('val-mo').textContent = lbl;
  }

  function refreshAcidBaseAndPlots() {
    const isSpatial = SPATIAL_MODES.has(currentMode);
    if (!isSpatial && currentGraph) {
      currentQeq = solveQeqCharges(currentGraph, { dielectricEr });
      currentAcidBase = evaluateAcidBaseEquilibrium(currentGraph, { pH, dielectricEr });

      el('p1-title').textContent = 'GPU π-MO Energy Levels';
      el('p1-sub').textContent = currentPiRes?.piAtomCount ? `${currentPiRes.totalPiElectrons}π e⁻` : 'sp³ σ';
      drawMoLevelPlot(plot1, currentPiRes, selectedMoIdx);

      // Plot 2: Bearing Superlubricity V(theta) OR Reaction Barrier Profile OR Dihedral Torsion Profile OR Born Solvation curve
      if (currentGraph.rotorMeta?.kind === 'molecular-bearing') {
        const nRot = currentGraph.rotorMeta.rotorSymmetry || 8;
        const nStat = currentGraph.rotorMeta.statorSymmetry || 11;
        const tel = mdSession?.getTelemetry?.();
        const thetaDeg = (((tel?.rotorThetaRad || 0) * 180) / Math.PI) % 45;
        const thetaWrap = thetaDeg < 0 ? thetaDeg + 45 : thetaDeg;
        el('p2-title').textContent = `Coprime ${nRot}:${nStat} Bearing Potential V(θ)`;
        el('p2-sub').textContent = `ω=${(tel?.rotorOmegaRadPs || 0).toFixed(2)} rad/ps`;
        const coprimePts = [];
        const lockedPts = [];
        for (let i = 0; i <= 90; i += 1) {
          const deg = (i / 90) * 45;
          const rad = (deg * Math.PI) / 180;
          // 8-on-8 commensurate lock-in vs 8-on-11 (88-fold superlubric cancellation!)
          const vLock = 9.2 * (0.5 + 0.5 * Math.cos(nRot * rad));
          const vSuper = 0.42 * (0.5 + 0.5 * Math.cos(nRot * nStat * rad));
          lockedPts.push([deg, vLock]);
          coprimePts.push([deg, vSuper]);
        }
        drawLinePlot(plot2, {
          xMin: 0, xMax: 45, yMin: -0.5, yMax: 11.0,
          series: [
            { pts: lockedPts, color: 'rgba(244,114,182,0.55)', width: 1.4 },
            { pts: coprimePts, color: '#34d399', width: 2.2 }
          ],
          vMarker: thetaWrap, hZero: true, labelX: 'Rotor Angle θ (0..45°)'
        });
      } else if (currentMode === 'sn2-walden' || currentMode === 'diels-alder') {
        el('p2-title').textContent = currentMode === 'sn2-walden' ? 'SN2 Reaction Barrier ΔG(ξ)' : 'Diels–Alder [4+2] Barrier ΔG(ξ)';
        el('p2-sub').textContent = `ξ = ${reactProgress.toFixed(2)}`;
        const pts = [];
        const ea = currentMode === 'sn2-walden' ? 78.0 : 94.0;
        const dgRxn = currentMode === 'sn2-walden' ? -18.0 : -142.0;
        for (let i = 0; i <= 40; i += 1) {
          const x = i / 40;
          const b = 16 * x * x * (1 - x) * (1 - x) * ea + dgRxn * (3 * x * x - 2 * x * x * x);
          pts.push([x, b]);
        }
        drawLinePlot(plot2, {
          xMin: 0, xMax: 1, yMin: Math.min(-30, dgRxn - 15), yMax: ea + 18,
          series: [{ pts, color: '#facc15', width: 2.1 }],
          vMarker: reactProgress, hZero: true, labelX: 'Reaction Coordinate ξ'
        });
      } else if (currentMode === 'butane' || currentMode === 'cyclohexane') {
        el('p2-title').textContent = 'sp³ Torsional Energy V(φ)';
        el('p2-sub').textContent = 'kJ/mol';
        const pts = [];
        for (let deg = -180; deg <= 180; deg += 6) {
          const rad = (deg * Math.PI) / 180;
          const v = 5.4 * (1 + Math.cos(3 * rad)) + 4.8 * (1 + Math.cos(rad)) + 1.9 * Math.exp(-Math.pow(rad / 0.45, 2));
          pts.push([deg, v]);
        }
        drawLinePlot(plot2, {
          xMin: -180, xMax: 180, yMin: 0, yMax: 24,
          series: [{ pts, color: '#34d399', width: 2.0 }],
          labelX: 'Dihedral φ (deg)'
        });
      } else {
        el('p2-title').textContent = 'Born Solvation ΔG_solv(ε_r)';
        el('p2-sub').textContent = `${currentQeq.bornSolvationKjMol.toFixed(1)} kJ/mol`;
        const pts = [];
        for (let er = 1; er <= 80; er += 2) {
          const q = solveQeqCharges(currentGraph, { dielectricEr: er });
          pts.push([er, q.bornSolvationKjMol]);
        }
        const yMin = Math.min(-15, ...pts.map((p) => p[1])) - 4;
        drawLinePlot(plot2, {
          xMin: 1, xMax: 80, yMin, yMax: 2,
          series: [{ pts, color: '#56c2ff', width: 2.0 }],
          vMarker: dielectricEr, hZero: true, labelX: 'Dielectric ε_r'
        });
      }

      // Plot 3: First-principles pH 0..14 Titration Curve Q(pH)
      el('p3-title').textContent = 'Brønsted–Lowry pH Titration';
      const pkaStr = currentAcidBase.sites.length > 0
        ? currentAcidBase.sites.map((s) => `pKa=${s.pKa.toFixed(1)}`).slice(0, 2).join(', ')
        : 'Non-protic';
      el('p3-sub').textContent = pkaStr;
      drawLinePlot(plot3, {
        xMin: 0, xMax: 14, yMin: -1.6, yMax: 1.6,
        series: [{ pts: currentAcidBase.titrationCurve.map((p) => [p.pH, p.netCharge]), color: '#a78bfa', width: 2.2 }],
        vMarker: pH, hZero: true, labelX: 'Solution pH (0..14)'
      });
    } else if (isSpatial && rdSession) {
      const t = rdSession.getTelemetry();
      el('p1-title').textContent = currentMode === 'frank-chiral' ? 'Chiral Purity & Enantiomeric Excess' : 'Autocatalytic Field Activity';
      el('p1-sub').textContent = `ee=${(t.globalEnantiomericExcess * 100).toFixed(1)}%`;
      drawLinePlot(plot1, {
        xMin: 0, xMax: Math.max(20, purityHistory.length), yMin: -1.05, yMax: 1.05,
        series: [
          { pts: purityHistory.map((v, i) => [i, v]), color: '#34d399', width: 2.0 },
          { pts: eeHistory.map((v, i) => [i, v]), color: '#56c2ff', width: 1.8 }
        ],
        hZero: true, labelX: 'Simulation Time'
      });

      el('p2-title').textContent = currentMode === 'frank-chiral' ? 'L (Cyan) vs D (Magenta) Balance' : 'Mean Species Concentrations';
      el('p2-sub').textContent = `L=${t.meanL.toFixed(2)} D=${t.meanD.toFixed(2)}`;
      drawLinePlot(plot2, {
        xMin: 0, xMax: 3.0, yMin: 0, yMax: 1.05,
        series: [{
          pts: Array.from({ length: 31 }, (_, i) => {
            const k = i * 0.1;
            const pur = k < 0.05 ? 0.03 : Math.min(0.98, 0.18 + 0.80 * (1 - Math.exp(-k * 1.45)));
            return [k, pur];
          }),
          color: '#f472b6', width: 2.0
        }],
        vMarker: kInhib, labelX: 'Mutual Antagonism k_inhib'
      });

      el('p3-title').textContent = 'Prebiotic Open-System Flux';
      el('p3-sub').textContent = `Feed=${feedRate.toFixed(2)}`;
      drawLinePlot(plot3, {
        xMin: 0, xMax: 0.45, yMin: 0, yMax: 1.1,
        series: [{
          pts: Array.from({ length: 24 }, (_, i) => {
            const f = (i / 23) * 0.45;
            return [f, Math.min(1, f * 2.4 / (0.12 + f * 1.8))];
          }),
          color: '#facc15', width: 2.0
        }],
        vMarker: feedRate, labelX: 'Feedstock Flux'
      });
    }
  }

  function updateHudAndProvenance() {
    const isSpatial = SPATIAL_MODES.has(currentMode);
    const doc = ORGANIC_MODE_DOCS[currentMode];
    const laws = resolveActiveUniversalLaws({
      organicChemistryActive: !isSpatial,
      organicMdActive: !isSpatial,
      organicAtomCount: currentGraph?.atomCount || 0,
      covalentBondCount: currentGraph?.bondCount || 0,
      dielectricEr,
      acidBaseOrAutocatalysisActive: isSpatial || (currentAcidBase?.sites?.length || 0) > 0
    });
    el('prov-laws').textContent = `${laws.active.length} active (${laws.active.map((l) => l.id.split('-')[0]).join(', ')})`;

    if (!isSpatial && mdSession) {
      const tel = mdSession.getTelemetry();
      const isBearing = currentGraph?.rotorMeta?.kind === 'molecular-bearing';
      el('st-step').textContent = String(tel.stepIndex);
      if (isBearing) {
        el('st-m1-lbl').textContent = 'Rotor ω';
        el('st-m1-val').textContent = `${(tel.rotorOmegaRadPs || 0).toFixed(2)} rad/ps`;
        el('st-m2-lbl').textContent = 'S···O Gap';
        el('st-m2-val').textContent = `${currentGraph.rotorMeta.bearingGapA.toFixed(2)} Å`;
        el('st-m3-lbl').textContent = 'Symmetry';
        el('st-m3-val').textContent = `${currentGraph.rotorMeta.rotorSymmetry}:${currentGraph.rotorMeta.statorSymmetry} Coprime`;
      } else {
        el('st-m1-lbl').textContent = currentPiRes?.piAtomCount ? 'HOMO–LUMO' : 'Temp';
        el('st-m1-val').textContent = currentPiRes?.piAtomCount
          ? `${currentPiRes.homoLumoGapEv.toFixed(2)} eV`
          : `${Math.round(tel.instTempK)} K`;
        el('st-m2-lbl').textContent = currentPiRes?.piAtomCount ? 'Resonance' : 'R_g';
        el('st-m2-val').textContent = currentPiRes?.piAtomCount
          ? `${currentPiRes.resonanceEnergyEv.toFixed(2)} eV`
          : `${tel.radiusOfGyrationA.toFixed(2)} Å`;
        const chiralTxt = currentGraph.chiralCenters.length > 0
          ? currentGraph.chiralCenters.map((c) => `(${c.configuration})`).join(',')
          : 'Achiral';
        el('st-m3-lbl').textContent = currentMode === 'ethanol-water-hbond' ? 'H-Bonds' : 'Chirality';
        el('st-m3-val').textContent = currentMode === 'ethanol-water-hbond' ? String(tel.hBondCount) : chiralTxt;
      }

      const chiralBadge = currentGraph.chiralCenters.length > 0
        ? `Chiral ${currentGraph.chiralCenters.map((c) => `(${c.configuration})`).join(',')}`
        : null;
      el('prov-dipole').textContent = `${currentQeq.dipoleDebye.toFixed(2)} D · Q=${currentAcidBase.netChargeAtPh.toFixed(2)}`;
      el('prov-born').textContent = `${currentQeq.bornSolvationKjMol.toFixed(1)} kJ/mol (ε=${dielectricEr.toFixed(1)})`;
      el('prov-bonds').textContent = `${tel.hBondCount} H-bonds / ${tel.activeBondCount} cov`;
      el('pill-name').textContent = `${ORGANIC_MOLECULE_INITIAL_CONDITIONS[currentMode]?.name || currentMode}`;
      el('pill-tag').textContent = isBearing
        ? `${currentGraph.rotorMeta.rotorSymmetry}:${currentGraph.rotorMeta.statorSymmetry} Superlubric`
        : (currentPiRes?.isAromatic4nPlus2 ? '4n+2 Aromatic' : (chiralBadge || doc?.badge || 'GPU MD'));
    } else if (isSpatial && rdSession) {
      const tel = rdSession.getTelemetry();
      el('st-step').textContent = String(tel.stepIndex);
      el('st-m1-lbl').textContent = 'Chiral Purity';
      el('st-m1-val').textContent = `${(tel.localChiralPurity * 100).toFixed(1)}%`;
      el('st-m2-lbl').textContent = 'Global ee';
      el('st-m2-val').textContent = `${(tel.globalEnantiomericExcess * 100).toFixed(1)}%`;
      el('st-m3-lbl').textContent = 'k_inhib';
      el('st-m3-val').textContent = kInhib.toFixed(2);
      el('prov-dipole').textContent = `L=${tel.meanL.toFixed(3)} · D=${tel.meanD.toFixed(3)}`;
      el('prov-born').textContent = '128×128 WebGPU RD';
      el('prov-bonds').textContent = `feed=${feedRate.toFixed(2)}`;
      el('pill-name').textContent = doc?.title?.split('—')[0]?.trim() || currentMode;
      el('pill-tag').textContent = doc?.badge || '128×128 RD';
    }
  }

  async function selectMode(modeId, customGraph = null) {
    currentMode = modeId;
    const isSpatial = SPATIAL_MODES.has(modeId);
    if (mdSession) { mdSession.dispose(); mdSession = null; }
    if (rdSession) { rdSession.dispose(); rdSession = null; }
    pickedEntity = null;
    el('pick-card')?.classList.remove('open');
    if (el('pick-reticle')) el('pick-reticle').style.display = 'none';
    eeHistory = [];
    purityHistory = [];

    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === modeId);
    });
    el('mol-controls-card').style.display = isSpatial ? 'none' : 'flex';
    el('rd-controls-card').style.display = isSpatial ? 'flex' : 'none';
    el('reaction-ctrl-box').style.display = (modeId === 'sn2-walden' || modeId === 'diels-alder') ? 'flex' : 'none';
    if (el('bearing-ctrl-box')) el('bearing-ctrl-box').style.display = (modeId === 'sulflower-bearing') ? 'flex' : 'none';

    const doc = ORGANIC_MODE_DOCS[modeId];
    el('hud-title').textContent = doc?.title || modeId;
    el('hud-sub').textContent = doc?.whatYouSee?.slice(0, 145) + '…' || '';

    if (!isSpatial) {
      currentGraph = customGraph || buildOrganicMolecularGraph(modeId);
      currentPiRes = await solvePiMolecularOrbitalsWebGpu(device, currentGraph);
      selectedMoIdx = currentPiRes.piAtomCount > 0 ? currentPiRes.homoIndex : 0;
      el('mo-ctrl-box').style.display = currentPiRes.piAtomCount > 0 ? 'flex' : 'none';
      showPiMo = (modeId !== 'sulflower-bearing') && currentPiRes.piAtomCount > 0;
      if (el('chk-pi')) el('chk-pi').checked = showPiMo;
      await rebuildPiCloud();
      reactProgress = 0.0;
      reactDir = 1;
      el('sl-xi').value = '0';
      el('val-xi').textContent = '0.00';
      mdSession = createReactiveBondOrderMdSessionWebGpu(device, {
        graph: currentGraph,
        temperatureK,
        dielectricEr
      });
      if (currentGraph.rotorMeta?.kind === 'molecular-bearing') {
        mdSession.setReactionProgress(bearingTorque);
        if (el('sl-torque')) el('sl-torque').value = bearingTorque.toFixed(2);
        if (el('val-torque')) el('val-torque').textContent = bearingTorque.toFixed(2);
      }
      // Advance a few initial equilibration substeps so telemetry & H-bonds populate immediately
      await mdSession.step({ dt: 0.012, substeps: 6, readTelemetry: true });
    } else {
      currentGraph = null;
      currentPiRes = null;
      piCloudCount = 0;
      rdSession = createAutocatalyticNetworkSessionWebGpu(device, {
        width: 128,
        height: 128,
        mode: modeId,
        kInhib,
        feedRate
      });
      await rdSession.step({ dt: 0.16, substeps: 24, readTelemetry: true });
    }

    refreshCameraForMode(modeId);
    refreshAcidBaseAndPlots();
    updateHudAndProvenance();
    renderCurrentScene();
  }

  function renderCurrentScene() {
    const timeSec = (performance.now() - startTimeMs) * 0.001;
    const isSpatial = SPATIAL_MODES.has(currentMode);
    if (!isSpatial && mdSession) {
      renderer.renderFrame({
        orgAtomsBuffer: mdSession.getResidentAtomsBuffer(),
        orgAtomCount: mdSession.atomCount,
        orgBondsBuffer: mdSession.getResidentBondsBuffer(),
        orgBondCount: mdSession.bondCount,
        piCloudBuffer: piCloudBuf,
        piCloudCount,
        showPiMo: showPiMo && piCloudCount > 0,
        espBlend: espMode ? 0.92 : 0.0,
        sphereScale: 1.0,
        piPointSize: 0.17,
        timeSec
      });
    } else if (isSpatial && rdSession) {
      const fmode = currentMode === 'frank-chiral' ? 0 : (currentMode === 'belousov-zhabotinsky' ? 1 : 2);
      renderer.renderFrame({
        fieldBuffer: rdSession.getResidentFieldBuffer(),
        fieldMode: fmode,
        fieldW: rdSession.width,
        fieldH: rdSession.height,
        timeSec
      });
    }
  }

  async function stepSimulationOnce({ forceRead = false, useSpeed = true } = {}) {
    if (disposed || busy) return;
    busy = true;
    try {
      const spd = useSpeed ? simSpeed : 1.0;
      if (useSpeed && spd < 0.25 && !forceRead) {
        stepAccum += spd * 4.0;
        if (stepAccum < 1.0) {
          renderCurrentScene();
          return;
        }
        stepAccum -= 1.0;
      }
      frameCount += 1;
      const doRead = forceRead || (frameCount % 4 === 0);
      if (mdSession) {
        if ((currentMode === 'sn2-walden' || currentMode === 'diels-alder') && autoCycleReaction) {
          reactProgress += reactDir * 0.0065 * spd;
          if (reactProgress >= 1.0) { reactProgress = 1.0; reactDir = -1; }
          if (reactProgress <= 0.0) { reactProgress = 0.0; reactDir = 1; }
          mdSession.setReactionProgress(reactProgress);
          el('sl-xi').value = reactProgress.toFixed(2);
          el('val-xi').textContent = reactProgress.toFixed(2);
        }
        const effDt = useSpeed ? Math.max(0.0025, Math.min(0.012, 0.012 * Math.min(1.0, spd * 1.45))) : 0.012;
        const effSubsteps = useSpeed ? Math.max(1, Math.round(spd * 2.6)) : 3;
        await mdSession.step({ dt: effDt, substeps: effSubsteps, readTelemetry: doRead });
        if (doRead && (currentMode === 'sn2-walden' || currentMode === 'diels-alder' || currentGraph?.rotorMeta?.kind === 'molecular-bearing')) {
          refreshAcidBaseAndPlots();
        }
      } else if (rdSession) {
        const effSub = useSpeed ? Math.max(1, Math.round(10 * spd)) : 10;
        const tel = await rdSession.step({ dt: 0.16, substeps: effSub, readTelemetry: doRead });
        if (doRead) {
          eeHistory.push(tel.globalEnantiomericExcess);
          purityHistory.push(tel.localChiralPurity);
          if (eeHistory.length > 96) { eeHistory.shift(); purityHistory.shift(); }
          refreshAcidBaseAndPlots();
        }
      }
      if (doRead) updateHudAndProvenance();
      await refreshTrackedPickedAtom();
      renderCurrentScene();
      updatePickOverlay();
    } finally {
      busy = false;
    }
  }

  function openAboutModal(aboutLab = false) {
    const modal = el('about-modal');
    const title = el('modal-title');
    const body = el('modal-body');
    if (aboutLab) {
      title.textContent = ORGANIC_LAB_ABOUT_ULG.title;
      body.innerHTML = `
        <div class="modal-block"><h4>Overview</h4><p>${ORGANIC_LAB_ABOUT_ULG.overview}</p></div>
        <div class="modal-block"><h4>Active Universal Law Graph Nodes</h4><ul>${ORGANIC_LAB_ABOUT_ULG.laws.map((l) => `<li>${l}</li>`).join('')}</ul></div>
        <div class="modal-block"><h4>Falsifiable First-Principles Proofs</h4><ul>${ORGANIC_LAB_ABOUT_ULG.falsifiableTests.map((t) => `<li>${t}</li>`).join('')}</ul></div>
      `;
    } else {
      const doc = ORGANIC_MODE_DOCS[currentMode];
      title.textContent = doc?.title || currentMode;
      body.innerHTML = `
        <div class="modal-block"><h4>What You Are Observing (${doc?.scale || '10⁻¹⁰ m'})</h4><p>${doc?.whatYouSee || ''}</p></div>
        <div class="modal-block"><h4>Governing Equations</h4><ul>${(doc?.equations || []).map((eq) => `<li><code>${eq}</code></li>`).join('')}</ul></div>
        <div class="modal-block"><h4>Try These Experiments</h4><ul>${(doc?.experiments || []).map((ex) => `<li>${ex}</li>`).join('')}</ul></div>
      `;
    }
    modal.classList.add('open');
  }

  // ---- Wire UI Events ----
  const handleResize = () => {
    const rect = canvas.parentElement.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
    renderCurrentScene();
  };
  window.addEventListener('resize', handleResize);
  handleResize();

  let followPickedAtom = false;

  async function refreshTrackedPickedAtom() {
    if (!pickedEntity || pickedEntity.kind !== 'atom' || !mdSession || !currentGraph) return;
    const raw = await gpuPicker.readSingleEntity(mdSession.getResidentAtomsBuffer(), pickedEntity.index, 16);
    if (!raw || !pickedEntity || pickedEntity.kind !== 'atom') return;
    const x = raw[0]; const y = raw[1]; const z = raw[2];
    const q = raw[7];
    const spd = Math.hypot(raw[4], raw[5], raw[6]);
    const a = currentGraph.atoms[pickedEntity.index];
    const chiral = currentGraph.chiralCenters.find((c) => c.atomIndex === pickedEntity.index);
    pickedEntity.pos = [x, y, z];
    pickedEntity.details = `q=${q >= 0 ? '+' : ''}${q.toFixed(3)} e · |v|=${spd.toFixed(2)} · r=(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})${chiral ? ` · Stereocenter (${chiral.configuration})` : ''}`;
    if (followPickedAtom && orbitControls) {
      orbitControls.setPose({ target: [x, y, z] }, { immediate: false });
    }
  }

  function updatePickOverlay() {
    const ret = el('pick-reticle');
    const card = el('pick-card');
    if (!pickedEntity) {
      if (ret) ret.style.display = 'none';
      card?.classList.remove('open');
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const proj = renderer.projectWorld(pickedEntity.pos, rect.width, rect.height);
    if (ret) {
      if (proj.visible) {
        ret.style.display = 'block';
        ret.style.left = `${proj.sx.toFixed(1)}px`;
        ret.style.top = `${proj.sy.toFixed(1)}px`;
      } else {
        ret.style.display = 'none';
      }
    }
    if (card) {
      card.classList.add('open');
      el('pick-title').textContent = pickedEntity.title;
      el('pick-meta').textContent = pickedEntity.details;
    }
  }

  async function pickAtClientPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ndcY = 1 - ((clientY - rect.top) / Math.max(1, rect.height)) * 2;
    if (mdSession && currentGraph) {
      const hit = await gpuPicker.pickEntity({
        buffer: mdSession.getResidentAtomsBuffer(),
        count: mdSession.atomCount,
        strideFloats: 16,
        layoutMode: GPU_PICK_LAYOUT.STANDARD,
        viewProj: renderer.getViewProj(),
        clickNdcX: ndcX,
        clickNdcY: ndcY,
        aspect: renderer.getAspect(),
        maxPickNdc: 0.14
      });
      if (!hit) { pickedEntity = null; followPickedAtom = false; updatePickOverlay(); return null; }
      followPickedAtom = false;
      const a = currentGraph.atoms[hit.index];
      const q = hit.vec1[3];
      const spd = Math.hypot(hit.vec1[0], hit.vec1[1], hit.vec1[2]);
      const chiral = currentGraph.chiralCenters.find((c) => c.atomIndex === hit.index);
      pickedEntity = {
        kind: 'atom',
        index: hit.index,
        pos: [hit.vec0[0], hit.vec0[1], hit.vec0[2]],
        title: `Atom #${hit.index} · ${a?.sym || 'X'} (Z=${Math.round(hit.vec3[3])}) · ${a?.hybridization || 'sp³'}`,
        details: `q=${q >= 0 ? '+' : ''}${q.toFixed(3)} e · |v|=${spd.toFixed(2)} · r=(${hit.vec0[0].toFixed(2)}, ${hit.vec0[1].toFixed(2)}, ${hit.vec0[2].toFixed(2)})${chiral ? ` · Stereocenter (${chiral.configuration})` : ''}`
      };
      updatePickOverlay();
      return pickedEntity;
    }
    return null;
  }

  // Target-anchored OrbitControls (smooth damping, pan, dolly-to-target, click-to-pick, cameraAutoSpin: false!)
  orbitControls = createTargetOrbitControls(canvas, {
    yaw: 0.0,
    pitch: 0.16,
    dist: 29.5,
    target: [0, 0, 0],
    minDist: 2.2,
    maxDist: 48.0,
    enablePan: true,
    enableDamping: true,
    onClick: (cx, cy) => { void pickAtClientPoint(cx, cy); },
    onChange: (pose) => {
      renderer.setCamera(pose);
      renderCurrentScene();
      updatePickOverlay();
    }
  });
  el('pick-close')?.addEventListener('click', () => { pickedEntity = null; followPickedAtom = false; updatePickOverlay(); });
  el('pick-zoom')?.addEventListener('click', () => {
    if (!pickedEntity) return;
    followPickedAtom = true;
    orbitControls.focusTarget([...pickedEntity.pos], Math.min(renderer.camera.dist, 4.2));
  });
  el('sl-sim-speed')?.addEventListener('input', (e) => applySimSpeed(e.target.value));
  document.querySelectorAll('#speed-preset-row [data-speed]').forEach((b) => {
    b.addEventListener('click', () => applySimSpeed(Number(b.dataset.speed)));
  });
  el('btn-step-once')?.addEventListener('click', () => {
    paused = true;
    el('btn-play').textContent = '▶ Play';
    void stepSimulationOnce({ forceRead: true, useSpeed: false });
  });
  applySimSpeed(simSpeed);

  document.querySelectorAll('.acc-header').forEach((hdr) => {
    hdr.addEventListener('click', () => hdr.parentElement.classList.toggle('open'));
  });
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      el('org-sidebar').classList.remove('mobile-open');
      selectMode(btn.dataset.mode);
    });
  });

  el('sl-temp').addEventListener('input', (e) => {
    temperatureK = Number(e.target.value);
    el('val-temp').textContent = `${Math.round(temperatureK)} K`;
    mdSession?.setTemperatureK(temperatureK);
  });
  el('sl-er').addEventListener('input', (e) => {
    dielectricEr = Number(e.target.value);
    el('val-er').textContent = dielectricEr.toFixed(1);
    mdSession?.setDielectricEr(dielectricEr);
    refreshAcidBaseAndPlots();
    updateHudAndProvenance();
  });
  el('sl-ph').addEventListener('input', (e) => {
    pH = Number(e.target.value);
    el('val-ph').textContent = pH.toFixed(1);
    refreshAcidBaseAndPlots();
    updateHudAndProvenance();
  });
  el('sl-torque')?.addEventListener('input', (e) => {
    bearingTorque = Number(e.target.value);
    if (el('val-torque')) el('val-torque').textContent = bearingTorque.toFixed(2);
    if (currentGraph?.rotorMeta?.kind === 'molecular-bearing') {
      mdSession?.setReactionProgress(bearingTorque);
    }
  });
  el('sl-xi').addEventListener('input', (e) => {
    autoCycleReaction = false;
    el('chk-auto-xi').checked = false;
    reactProgress = Number(e.target.value);
    el('val-xi').textContent = reactProgress.toFixed(2);
    mdSession?.setReactionProgress(reactProgress);
    refreshAcidBaseAndPlots();
  });
  el('chk-auto-xi').addEventListener('change', (e) => { autoCycleReaction = e.target.checked; });
  el('chk-pi').addEventListener('change', (e) => { showPiMo = e.target.checked; renderCurrentScene(); });
  el('chk-esp').addEventListener('change', (e) => { espMode = e.target.checked; renderCurrentScene(); });
  el('btn-mo-prev').addEventListener('click', async () => {
    if (!currentPiRes?.piAtomCount) return;
    selectedMoIdx = (selectedMoIdx - 1 + currentPiRes.piAtomCount) % currentPiRes.piAtomCount;
    await rebuildPiCloud();
    refreshAcidBaseAndPlots();
    renderCurrentScene();
  });
  el('btn-mo-next').addEventListener('click', async () => {
    if (!currentPiRes?.piAtomCount) return;
    selectedMoIdx = (selectedMoIdx + 1) % currentPiRes.piAtomCount;
    await rebuildPiCloud();
    refreshAcidBaseAndPlots();
    renderCurrentScene();
  });
  el('btn-mirror').addEventListener('click', async () => {
    if (!currentGraph) return;
    const mirrored = mirrorOrganicMolecularGraph(currentGraph);
    await selectMode(currentMode, mirrored);
  });
  el('btn-play').addEventListener('click', () => {
    paused = !paused;
    el('btn-play').textContent = paused ? '▶ Play' : '⏸ Pause';
    el('btn-rd-play').textContent = paused ? '▶ Play' : '⏸ Pause';
  });
  el('btn-rd-play').addEventListener('click', () => el('btn-play').click());
  el('btn-reset').addEventListener('click', () => selectMode(currentMode));
  el('btn-rd-reset').addEventListener('click', () => selectMode(currentMode));
  el('sl-kinhib').addEventListener('input', (e) => {
    kInhib = Number(e.target.value);
    el('val-kinhib').textContent = kInhib.toFixed(2);
    rdSession?.setKInhib(kInhib);
    refreshAcidBaseAndPlots();
  });
  el('sl-feed').addEventListener('input', (e) => {
    feedRate = Number(e.target.value);
    el('val-feed').textContent = feedRate.toFixed(2);
    rdSession?.setFeedRate(feedRate);
    refreshAcidBaseAndPlots();
  });

  el('about-btn').addEventListener('click', () => openAboutModal(false));
  el('menu-about-mode').addEventListener('click', () => { el('help-popover').classList.remove('open'); openAboutModal(false); });
  el('menu-about-lab').addEventListener('click', () => { el('help-popover').classList.remove('open'); openAboutModal(true); });
  el('modal-close').addEventListener('click', () => el('about-modal').classList.remove('open'));
  el('about-modal').addEventListener('click', (e) => { if (e.target === el('about-modal')) el('about-modal').classList.remove('open'); });
  el('help-btn').addEventListener('click', () => el('help-popover').classList.toggle('open'));
  el('toggle-plots-btn').addEventListener('click', () => {
    el('org-shell').classList.toggle('plots-collapsed');
    el('org-dock').classList.toggle('mobile-open');
    handleResize();
  });
  el('mobile-nav-btn').addEventListener('click', () => el('org-sidebar').classList.toggle('mobile-open'));

  // Boot initial flagship regime: Sulflower Molecular Bearing (C16S8 @ Calix[11]furan)!
  await selectMode('sulflower-bearing');

  let rafId = 0;
  let lastRafMs = performance.now();
  function loop(nowMs = performance.now()) {
    if (disposed) return;
    const dtSec = Math.max(0.004, Math.min(0.05, (nowMs - lastRafMs) * 0.001));
    lastRafMs = nowMs;
    const camMoved = orbitControls?.update(dtSec);
    if (!paused) stepSimulationOnce({ useSpeed: true });
    else if (!camMoved) renderCurrentScene();
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  const api = {
    getState() {
      return {
        ready: true,
        mode: currentMode,
        isSpatial: SPATIAL_MODES.has(currentMode),
        stepIndex: mdSession ? mdSession.stepIndex : (rdSession ? rdSession.stepIndex : 0),
        simSpeed,
        camera: orbitControls ? orbitControls.state : { ...renderer.camera },
        temperatureK,
        dielectricEr,
        pH,
        espMode,
        showPiMo,
        selectedMoIdx,
        reactProgress,
        kInhib,
        feedRate,
        formula: currentGraph?.formula || null,
        chiralCenters: currentGraph?.chiralCenters || [],
        pi: currentPiRes ? {
          piAtomCount: currentPiRes.piAtomCount,
          homoLumoGapEv: currentPiRes.homoLumoGapEv,
          resonanceEnergyEv: currentPiRes.resonanceEnergyEv,
          isAromatic4nPlus2: currentPiRes.isAromatic4nPlus2,
          uvVisLambdaMaxNm: currentPiRes.uvVisLambdaMaxNm
        } : null,
        qeq: currentQeq ? {
          dipoleDebye: currentQeq.dipoleDebye,
          bornSolvationKjMol: currentQeq.bornSolvationKjMol
        } : null,
        acidBase: currentAcidBase ? {
          netChargeAtPh: currentAcidBase.netChargeAtPh,
          sites: currentAcidBase.sites
        } : null,
        telemetry: mdSession ? mdSession.getTelemetry() : (rdSession ? rdSession.getTelemetry() : null),
        gpuErrorCount: gpuErrors.length,
        gpuErrors: [...gpuErrors],
        cameraAutoSpin: false
      };
    },
    async selectMode(id) { await selectMode(id); return api.getState(); },
    setTemperatureK(t) { temperatureK = t; el('sl-temp').value = String(t); el('val-temp').textContent = `${Math.round(t)} K`; mdSession?.setTemperatureK(t); },
    setDielectricEr(er) { dielectricEr = er; el('sl-er').value = String(er); el('val-er').textContent = er.toFixed(1); mdSession?.setDielectricEr(er); refreshAcidBaseAndPlots(); updateHudAndProvenance(); },
    setPh(v) { pH = v; el('sl-ph').value = String(v); el('val-ph').textContent = v.toFixed(1); refreshAcidBaseAndPlots(); updateHudAndProvenance(); },
    setEspMode(v) { espMode = Boolean(v); el('chk-esp').checked = espMode; renderCurrentScene(); },
    setShowPiMo(v) { showPiMo = Boolean(v); el('chk-pi').checked = showPiMo; renderCurrentScene(); },
    async mirrorMolecule() { if (currentGraph) await selectMode(currentMode, mirrorOrganicMolecularGraph(currentGraph)); return api.getState(); },
    setBearingTorque(tau) {
      bearingTorque = Math.max(0, Math.min(1.5, Number(tau) || 0));
      if (el('sl-torque')) el('sl-torque').value = bearingTorque.toFixed(2);
      if (el('val-torque')) el('val-torque').textContent = bearingTorque.toFixed(2);
      if (currentGraph?.rotorMeta?.kind === 'molecular-bearing') mdSession?.setReactionProgress(bearingTorque);
    },
    async readComDrift() {
      if (!mdSession) return 0;
      await mdSession.step({ dt: 0.012, substeps: 1, readTelemetry: true, readPositions: true });
      const arr = mdSession.getLatestAtomsHost();
      const n = mdSession.atomCount;
      let cx = 0; let cy = 0; let cz = 0; let mTot = 0;
      for (let i = 0; i < n; i += 1) {
        const m = 1 / Math.max(1e-4, arr[i * 16 + 3]);
        cx += arr[i * 16 + 0] * m;
        cy += arr[i * 16 + 1] * m;
        cz += arr[i * 16 + 2] * m;
        mTot += m;
      }
      return Math.hypot(cx / Math.max(1e-4, mTot), cy / Math.max(1e-4, mTot), cz / Math.max(1e-4, mTot));
    },
    async readBearingIntegrity() {
      if (!mdSession || !currentGraph || currentGraph.rotorMeta?.kind !== 'molecular-bearing') return null;
      await mdSession.step({ dt: 0.012, substeps: 1, readTelemetry: true, readPositions: true });
      const arr = mdSession.getLatestAtomsHost();
      const n = mdSession.atomCount;
      const rotorCount = currentGraph.rotorMeta.rotorCount || 24;
      let minSR = 999; let maxSR = 0; let maxSOContact = 0; let minSODist = 999; let maxOFlex = 0;
      const sCoords = [];
      const oCoords = [];
      for (let i = 0; i < n; i += 1) {
        const x = arr[i * 16 + 0]; const y = arr[i * 16 + 1]; const z = arr[i * 16 + 2];
        const Z = Math.round(arr[i * 16 + 15]);
        if (i < rotorCount && Z === 16) {
          const r = Math.hypot(x, y, z);
          if (r < minSR) minSR = r;
          if (r > maxSR) maxSR = r;
          sCoords.push([x, y, z]);
        } else if (i >= rotorCount && Z === 8) {
          const init = currentGraph.atoms[i].pos;
          const flex = Math.hypot(x - init[0], y - init[1], z - init[2]);
          if (flex > maxOFlex) maxOFlex = flex;
          oCoords.push([x, y, z]);
        }
      }
      for (const s of sCoords) {
        for (const o of oCoords) {
          const d = Math.hypot(s[0] - o[0], s[1] - o[1], s[2] - o[2]);
          if (d < minSODist) minSODist = d;
          if (d < 3.55) maxSOContact += 1;
        }
      }
      return {
        minSRadiusA: Number(minSR.toFixed(3)),
        maxSRadiusA: Number(maxSR.toFixed(3)),
        minSODistA: Number(minSODist.toFixed(3)),
        activeSOContacts: maxSOContact,
        maxStatorOFlexA: Number(maxOFlex.toFixed(4)),
        activeBondCount: mdSession.getTelemetry()?.activeBondCount || 0
      };
    },
    setReactionProgress(xi, auto = false) {
      autoCycleReaction = Boolean(auto);
      el('chk-auto-xi').checked = autoCycleReaction;
      reactProgress = Math.max(0, Math.min(1, Number(xi) || 0));
      el('sl-xi').value = reactProgress.toFixed(2);
      el('val-xi').textContent = reactProgress.toFixed(2);
      mdSession?.setReactionProgress(reactProgress);
      refreshAcidBaseAndPlots();
    },
    setKInhib(k) { kInhib = k; el('sl-kinhib').value = String(k); el('val-kinhib').textContent = k.toFixed(2); rdSession?.setKInhib(k); refreshAcidBaseAndPlots(); },
    setFeedRate(f) { feedRate = f; el('sl-feed').value = String(f); el('val-feed').textContent = f.toFixed(2); rdSession?.setFeedRate(f); refreshAcidBaseAndPlots(); },
    setSimSpeed(s) { applySimSpeed(s); },
    resetCamera() { orbitControls?.reset({ immediate: true }); renderCurrentScene(); updatePickOverlay(); },
    setPaused(p) { paused = Boolean(p); el('btn-play').textContent = paused ? '▶ Play' : '⏸ Pause'; },
    setCamera(patch) {
      if (orbitControls) orbitControls.setPose(patch, { immediate: true });
      else renderer.setCamera(patch);
      renderCurrentScene();
      updatePickOverlay();
    },
    async pickAtCenter() {
      const rect = canvas.getBoundingClientRect();
      if (currentGraph?.atoms?.[0]) {
        const p = renderer.projectWorld(currentGraph.atoms[0].pos, rect.width, rect.height);
        if (p.visible) return pickAtClientPoint(rect.left + p.sx, rect.top + p.sy);
      }
      return pickAtClientPoint(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5);
    },
    getPickedEntity: () => pickedEntity,
    async stepNow(n = 8) {
      for (let i = 0; i < n; i += 1) {
        while (busy) await new Promise((r) => setTimeout(r, 8));
        await stepSimulationOnce({ forceRead: i === n - 1, useSpeed: false });
      }
      if (pickedEntity && mdSession) {
        const raw = await gpuPicker.readSingleEntity(mdSession.getResidentAtomsBuffer(), pickedEntity.index, 16);
        if (raw) {
          pickedEntity.pos = [raw[0], raw[1], raw[2]];
          updatePickOverlay();
        }
      }
      return api.getState();
    },
    capturePng() {
      renderCurrentScene();
      return canvas.toDataURL('image/png');
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      orbitControls?.dispose();
      mdSession?.dispose();
      rdSession?.dispose();
      gpuPicker.dispose();
      if (piCloudBuf) try { piCloudBuf.destroy(); } catch {}
      renderer.dispose();
    }
  };
  window.__ulgOrganicLab = api;
  return api;
}
