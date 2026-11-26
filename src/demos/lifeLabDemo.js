// Flagship Interactive Controller for ULG Biophysics & Emergent Life Lab (`life-lab.html`)
// (`src/demos/lifeLabDemo.js`).
//
// Pure WebGPU direct rendering (zero Three.js, 1 submit/frame, cameraAutoSpin: false):
//   - Nodes #20-24: amphiphile-membrane-self-assembly@1, biopolymer-folding-catalysis@1,
//     template-replication-evolution@1, chemiosmotic-bioenergetics-electrophysiology@1,
//     and reaction-diffusion-active-matter@1 dynamically orchestrated via Universal Law Graph!

import { createAmphiphileMembraneSessionWebGpu } from '../runtime/biology/amphiphileMembraneGpu.js';
import {
  POLYMER_SEQUENCE_TEMPLATES,
  createBiopolymerFoldingSessionWebGpu
} from '../runtime/biology/biopolymerFoldingGpu.js';
import {
  createTemplateReplicationSessionWebGpu,
  evaluateDuplexMeltingCurve
} from '../runtime/biology/templateReplicationGpu.js';
import {
  createExcitableMembraneSessionWebGpu,
  evaluateChemiosmoticBioenergetics
} from '../runtime/biology/membraneBioenergeticsGpu.js';
import {
  TURING_MORPHOGEN_REGIMES,
  createMorphogenesisActiveSessionWebGpu
} from '../runtime/biology/morphogenesisActiveMatterGpu.js';
import { resolveActiveUniversalLaws } from '../runtime/universalLawGraph.js';
import { GPU_PICK_LAYOUT, createGpuEntityPickerWebGpu } from '../runtime/gpuMath/gpuEntityPickerWebGpu.js';
import { createTargetOrbitControls } from '../runtime/shared/targetOrbitControls.js';
import { createChemBioWebGpuRenderer } from './chemBioWebGpuRenderer.js';
import { LIFE_LAB_ABOUT_ULG, LIFE_MODE_DOCS } from './lifeLabDocs.js';

function layerForMode(modeId) {
  if (modeId === 'lipid-soup' || modeId === 'protocell-vesicle' || modeId === 'lipid-bilayer') return 'membrane';
  if (modeId === 'amphipathic-helix-bundle' || modeId === 'globular-hydrophobic-core' || modeId === 'beta-hairpin-fold') return 'fold';
  if (modeId === 'quasispecies-evolution') return 'evo';
  if (modeId === 'excitable-spiral' || modeId === 'excitable-pulse') return 'hh';
  return 'morph';
}

function drawLinePlot(canvas, { xMin, xMax, yMin, yMax, series = [], vMarker = null, hZero = false, labelX = '' }) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#040910';
  ctx.fillRect(0, 0, w, h);

  const padL = 36; const padR = 10; const padT = 10; const padB = 20;
  const pw = w - padL - padR;
  const ph = h - padT - padB;
  const mapX = (x) => padL + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * pw;
  const mapY = (y) => padT + ph - ((y - yMin) / Math.max(1e-6, yMax - yMin)) * ph;

  ctx.strokeStyle = 'rgba(52,211,153,0.14)';
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
    ctx.strokeStyle = s.color || '#34d399';
    ctx.lineWidth = s.width || 1.9;
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
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, padT + ph); ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = '#8cb2ab';
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillText(yMax.toFixed(1), 2, padT + 7);
  ctx.fillText(yMin.toFixed(1), 2, padT + ph);
  ctx.fillText(labelX || `${xMin}..${xMax}`, padL + pw * 0.28, h - 5);
}

export async function mountLifeLabDemo() {
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

  const canvas = document.getElementById('life-canvas');
  const renderer = createChemBioWebGpuRenderer(device, canvas, { bgStyle: 1 });
  const gpuPicker = createGpuEntityPickerWebGpu(device);
  const plot1 = document.getElementById('plot1');
  const plot2 = document.getElementById('plot2');
  const plot3 = document.getElementById('plot3');
  const el = (id) => document.getElementById(id);
  let pickedEntity = null;

  let currentMode = 'lipid-soup';
  let currentLayer = 'membrane';
  let activeSession = null;

  // Persistent per-layer parameters
  const params = {
    memEpsHp: 1.85,
    memTempK: 300,
    memOsmotic: 0.0,
    foldSeq: POLYMER_SEQUENCE_TEMPLATES['amphipathic-helix-bundle'].sequence,
    foldTempK: 300,
    foldEpsHp: 1.95,
    foldEpsHb: 1.45,
    evoMu: 0.025,
    evoBeta: 2.4,
    evoStrongFrac: 0.50,
    hhGNa: 120.0,
    hhGK: 36.0,
    hhDeltaPsi: 150.0,
    hhDeltaPh: 1.0,
    hhUncouplerLeak: 0.0,
    morphV0: 1.35,
    morphChemo: 2.20,
    morphDiffRatio: 2.00
  };

  let simSpeed = 0.30;
  let stepAccum = 0.0;
  let paused = false;
  let disposed = false;
  let busy = false;
  let frameCount = 0;
  let histA = [];
  let histB = [];
  let histC = [];
  const startTimeMs = performance.now();
  let orbitControls = null;

  function applySimSpeed(next) {
    simSpeed = Math.max(0.05, Math.min(2.0, Math.round((Number(next) || 0.30) * 20) / 20));
    if (el('sl-sim-speed')) el('sl-sim-speed').value = simSpeed.toFixed(2);
    if (el('val-sim-speed')) el('val-sim-speed').textContent = `${simSpeed.toFixed(2)}×`;
    document.querySelectorAll('#speed-preset-row [data-speed]').forEach((b) => {
      b.classList.toggle('active', Math.abs(Number(b.dataset.speed) - simSpeed) < 0.02);
    });
  }

  function refreshCameraForMode(modeId) {
    const layer = layerForMode(modeId);
    let pose;
    if (layer === 'membrane') {
      if (modeId === 'protocell-vesicle') pose = { yaw: 0.55, pitch: 0.35, dist: 17.5, target: [0, 0, 0] };
      else if (modeId === 'lipid-bilayer') pose = { yaw: 0.62, pitch: 0.42, dist: 17.5, target: [0, 0, 0] };
      else pose = { yaw: 0.52, pitch: 0.44, dist: 18.0, target: [0, 0, 0] };
    } else if (layer === 'fold') {
      pose = { yaw: 0.48, pitch: 0.38, dist: 13.5, target: [0, 0, 0] };
    } else if (layer === 'evo') {
      pose = { yaw: 0.55, pitch: 0.52, dist: 16.5, target: [0, 0, 0] };
    } else if (layer === 'hh') {
      pose = { yaw: 0.0, pitch: 1.12, dist: 19.2, target: [0, 0, 0] };
    } else {
      pose = { yaw: 0.42, pitch: 0.88, dist: 21.5, target: [0, 0, 0] };
    }
    if (orbitControls) orbitControls.setPose(pose, { immediate: true, updateHome: true });
    else renderer.setCamera(pose);
  }

  function updatePlotsAndHud() {
    if (!activeSession) return;
    const t = activeSession.getTelemetry();
    const doc = LIFE_MODE_DOCS[currentMode];
    el('st-step').textContent = String(t.stepIndex || 0);
    el('pill-name').textContent = doc?.title?.split('(')[0]?.trim() || currentMode;
    el('pill-tag').textContent = doc?.badge || currentLayer;

    const laws = resolveActiveUniversalLaws({
      amphiphileCount: currentLayer === 'membrane' ? activeSession.lipidCount : 0,
      polymerResidueCount: currentLayer === 'fold' ? activeSession.residueCount : 0,
      replicatorCount: currentLayer === 'evo' ? activeSession.populationCount : 0,
      excitableMembraneActive: currentLayer === 'hh',
      deltaPh: currentLayer === 'hh' ? params.hhDeltaPh : 0,
      gNaMsCm2: currentLayer === 'hh' ? params.hhGNa : 0,
      morphogenesisActive: currentLayer === 'morph',
      activeAgentCount: currentLayer === 'morph' ? activeSession.agentCount : 0
    });
    el('prov-laws').textContent = `${laws.active.length} active (${laws.active.map((l) => l.id.split('-')[0]).join(', ')})`;

    if (currentLayer === 'membrane') {
      el('st-m1-lbl').textContent = 'Tail Coord';
      el('st-m1-val').textContent = t.meanTailCoordination.toFixed(2);
      el('st-m2-lbl').textContent = 'Head Order';
      el('st-m2-val').textContent = t.radialHeadOrder.toFixed(2);
      el('st-m3-lbl').textContent = 'ε_hp';
      el('st-m3-val').textContent = params.memEpsHp.toFixed(2);
      el('prov-tier').textContent = 'Tier-2';
      el('prov-entities').textContent = `${activeSession.lipidCount} amphiphiles (${activeSession.beadCount} beads)`;
      el('prov-inv').textContent = params.memEpsHp < 0.05 ? 'Null limit (ε_hp=0 dispersed)' : `R=${t.meanRadius.toFixed(2)}`;

      el('p1-title').textContent = 'Hydrophobic Tail Coordination';
      el('p1-sub').textContent = `${t.meanTailCoordination.toFixed(2)} nbrs`;
      drawLinePlot(plot1, {
        xMin: 0, xMax: Math.max(20, histA.length), yMin: 0, yMax: Math.max(6, ...histA, 1) * 1.15,
        series: [{ pts: histA.map((v, i) => [i, v]), color: '#facc15', width: 2.1 }],
        labelX: 'MD Trajectory'
      });
      el('p2-title').textContent = 'Radial Head-Tail Order';
      el('p2-sub').textContent = t.radialHeadOrder.toFixed(3);
      drawLinePlot(plot2, {
        xMin: 0, xMax: Math.max(20, histB.length), yMin: -0.4, yMax: 1.0,
        series: [{ pts: histB.map((v, i) => [i, v]), color: '#56c2ff', width: 2.0 }],
        hZero: true, labelX: 'Orientation Order'
      });
      el('p3-title').textContent = 'Self-Assembly vs ε_hp';
      el('p3-sub').textContent = `ε_hp=${params.memEpsHp.toFixed(2)}`;
      drawLinePlot(plot3, {
        xMin: 0, xMax: 3.0, yMin: 0, yMax: 1.0,
        series: [{ pts: Array.from({ length: 31 }, (_, i) => [i * 0.1, 1 - Math.exp(-Math.pow(i * 0.1 / 0.85, 2))]), color: '#34d399', width: 2.0 }],
        vMarker: params.memEpsHp, labelX: 'Hydrophobic Coupling ε_hp'
      });
    } else if (currentLayer === 'fold') {
      el('st-m1-lbl').textContent = 'R_g';
      el('st-m1-val').textContent = `${t.radiusOfGyrationA.toFixed(2)} Å`;
      el('st-m2-lbl').textContent = 'k_cat/k_0';
      el('st-m2-val').textContent = `${t.catalyticRateBoost.toFixed(1)}×`;
      el('st-m3-lbl').textContent = 'H-Contacts';
      el('st-m3-val').textContent = String(t.hydrophobicContacts);
      el('prov-tier').textContent = 'Tier-2';
      el('prov-entities').textContent = `${activeSession.residueCount} residues (H/P/+/-)`;
      el('prov-inv').textContent = `|E_pocket|=${t.pocketFieldNorm.toFixed(2)} · ΔΔG‡=${t.barrierLoweringKjMol.toFixed(1)}`;

      el('p1-title').textContent = 'Folding Funnel R_g(t)';
      el('p1-sub').textContent = `${t.radiusOfGyrationA.toFixed(2)} Å`;
      drawLinePlot(plot1, {
        xMin: 0, xMax: Math.max(20, histA.length), yMin: 1.0, yMax: Math.max(9.0, ...histA) * 1.1,
        series: [{ pts: histA.map((v, i) => [i, v]), color: '#34d399', width: 2.1 }],
        labelX: 'Folding Trajectory'
      });
      el('p2-title').textContent = 'Catalytic Boost log10(k_cat/k_0)';
      el('p2-sub').textContent = `${t.catalyticRateBoost.toFixed(1)}×`;
      drawLinePlot(plot2, {
        xMin: 0, xMax: Math.max(20, histB.length), yMin: 0, yMax: 5.5,
        series: [{ pts: histB.map((v, i) => [i, Math.log10(Math.max(1, v))]), color: '#facc15', width: 2.1 }],
        labelX: 'Eyring Preorganization'
      });
      el('p3-title').textContent = 'Thermal Denaturation Curve';
      el('p3-sub').textContent = `T=${Math.round(params.foldTempK)} K`;
      drawLinePlot(plot3, {
        xMin: 100, xMax: 850, yMin: 0, yMax: 1.05,
        series: [{
          pts: Array.from({ length: 31 }, (_, i) => {
            const tk = 100 + i * 25;
            return [tk, 1 / (1 + Math.exp((tk - 470) / 55))];
          }),
          color: '#fb7185', width: 2.0
        }],
        vMarker: params.foldTempK, labelX: 'Temperature T (K)'
      });
    } else if (currentLayer === 'evo') {
      const melt = evaluateDuplexMeltingCurve({ lengthL: 16, strongPairFraction: params.evoStrongFrac });
      el('st-m1-lbl').textContent = 'Identity';
      el('st-m1-val').textContent = `${(t.meanSequenceIdentity * 100).toFixed(1)}%`;
      el('st-m2-lbl').textContent = 'Quasispecies';
      el('st-m2-val').textContent = `${(t.quasispeciesFraction * 100).toFixed(1)}%`;
      el('st-m3-lbl').textContent = 'T_m';
      el('st-m3-val').textContent = `${melt.meltingTempK.toFixed(1)} K`;
      el('prov-tier').textContent = 'Tier-2';
      el('prov-entities').textContent = `${activeSession.populationCount} GPU replicators`;
      el('prov-inv').textContent = params.evoMu > melt.eigenErrorThresholdMu
        ? `Above Eigen μ_crit (${melt.eigenErrorThresholdMu.toFixed(3)})!`
        : `Adaptive (μ < μ_crit=${melt.eigenErrorThresholdMu.toFixed(3)})`;

      el('p1-title').textContent = 'Duplex Melting θ(T)';
      el('p1-sub').textContent = `T_m=${melt.meltingTempC.toFixed(1)}°C`;
      drawLinePlot(plot1, {
        xMin: 280, xMax: 390, yMin: 0, yMax: 1.05,
        series: [{ pts: melt.curve.map((p) => [p.tempK, p.duplexFraction]), color: '#56c2ff', width: 2.2 }],
        vMarker: melt.meltingTempK, labelX: 'Temperature (K)'
      });
      el('p2-title').textContent = 'Live Sequence Identity';
      el('p2-sub').textContent = `${(t.meanSequenceIdentity * 100).toFixed(1)}%`;
      const idHist = t.fitnessHistory && t.fitnessHistory.length >= 2 ? t.fitnessHistory : histA;
      drawLinePlot(plot2, {
        xMin: 0, xMax: Math.max(20, idHist.length), yMin: 0, yMax: 1.05,
        series: [{ pts: idHist.map((v, i) => [i, v]), color: '#34d399', width: 2.1 }],
        labelX: 'Generations'
      });
      el('p3-title').textContent = 'Eigen Error Threshold μ_crit';
      el('p3-sub').textContent = `μ=${params.evoMu.toFixed(3)}`;
      drawLinePlot(plot3, {
        xMin: 0, xMax: 0.45, yMin: 0.2, yMax: 1.05,
        series: [{
          pts: Array.from({ length: 46 }, (_, i) => {
            const m = i * 0.01;
            const mc = melt.eigenErrorThresholdMu;
            const val = 0.25 + 0.75 / (1 + Math.exp((m - mc) * 32));
            return [m, val];
          }),
          color: '#a78bfa', width: 2.1
        }],
        vMarker: params.evoMu, labelX: 'Mutation Rate μ'
      });
    } else if (currentLayer === 'hh') {
      const chem = evaluateChemiosmoticBioenergetics({
        deltaPsiMv: params.hhDeltaPsi,
        deltaPh: params.hhDeltaPh,
        uncouplerLeak: params.hhUncouplerLeak
      });
      el('st-m1-lbl').textContent = 'Max V_m';
      el('st-m1-val').textContent = `${t.maxVoltageMv.toFixed(1)} mV`;
      el('st-m2-lbl').textContent = 'PMF Δp';
      el('st-m2-val').textContent = `${chem.protonMotiveForceMv.toFixed(1)} mV`;
      el('st-m3-lbl').textContent = 'ATP Flux';
      el('st-m3-val').textContent = `${chem.atpSynthesisFlux.toFixed(1)}`;
      el('prov-tier').textContent = 'Tier-1';
      el('prov-entities').textContent = '128×128 Rush–Larsen HH Grid';
      el('prov-inv').textContent = params.hhGNa < 1 ? 'TTX Blocked (g_Na=0)' : (chem.atpSynthesisFlux === 0 ? 'PMF=0 / Uncoupled (0 ATP)' : 'Excitable + ATP Active');

      el('p1-title').textContent = 'Electrode Action Potential V_m(t)';
      el('p1-sub').textContent = `${t.probeVoltageMv.toFixed(1)} mV`;
      const vt = t.voltageTraceMv && t.voltageTraceMv.length >= 2 ? t.voltageTraceMv : [-65, -65];
      drawLinePlot(plot1, {
        xMin: 0, xMax: Math.max(24, vt.length), yMin: -82, yMax: 48,
        series: [{ pts: vt.map((v, i) => [i, v]), color: '#facc15', width: 2.1 }],
        hZero: true, labelX: 'Membrane Time (ms)'
      });
      el('p2-title').textContent = 'Excitability vs Na⁺ Conductance';
      el('p2-sub').textContent = `g_Na=${Math.round(params.hhGNa)}`;
      drawLinePlot(plot2, {
        xMin: 0, xMax: 180, yMin: -70, yMax: 45,
        series: [{
          pts: Array.from({ length: 37 }, (_, i) => {
            const g = i * 5;
            const pk = g < 35 ? -65 : -65 + 102 * (1 - Math.exp(-(g - 35) / 28));
            return [g, pk];
          }),
          color: '#56c2ff', width: 2.0
        }],
        vMarker: params.hhGNa, hZero: true, labelX: 'g_Na (mS/cm²)'
      });
      el('p3-title').textContent = 'Mitchell Chemiosmotic ATP Flux';
      el('p3-sub').textContent = `J=${chem.atpSynthesisFlux.toFixed(1)}`;
      drawLinePlot(plot3, {
        xMin: 0, xMax: 320, yMin: 0, yMax: 120,
        series: [{
          pts: Array.from({ length: 33 }, (_, i) => {
            const pmf = i * 10;
            const c = evaluateChemiosmoticBioenergetics({ deltaPsiMv: pmf, deltaPh: 0, uncouplerLeak: 0 });
            return [pmf, c.atpSynthesisFlux];
          }),
          color: '#34d399', width: 2.1
        }],
        vMarker: chem.protonMotiveForceMv, labelX: 'Proton-Motive Force Δp (mV)'
      });
    } else {
      el('st-m1-lbl').textContent = 'Turing σ_v';
      el('st-m1-val').textContent = t.turingPatternStd.toFixed(3);
      el('st-m2-lbl').textContent = 'Enrichment';
      el('st-m2-val').textContent = `${t.chemotacticEnrichment.toFixed(2)}×`;
      el('st-m3-lbl').textContent = 'Speed';
      el('st-m3-val').textContent = t.meanAgentSpeed.toFixed(2);
      el('prov-tier').textContent = 'Tier-2';
      el('prov-entities').textContent = `128² Morphogen + ${activeSession.agentCount} Agents`;
      el('prov-inv').textContent = params.morphV0 < 0.05 || params.morphChemo < 0.05 ? 'Null limit (unbiased)' : 'Active chemotactic clustering';

      el('p1-title').textContent = 'Turing Spatial Contrast σ_v(t)';
      el('p1-sub').textContent = t.turingPatternStd.toFixed(3);
      drawLinePlot(plot1, {
        xMin: 0, xMax: Math.max(20, histA.length), yMin: 0, yMax: Math.max(0.22, ...histA) * 1.15,
        series: [{ pts: histA.map((v, i) => [i, v]), color: '#34d399', width: 2.1 }],
        labelX: 'Morphogenesis Time'
      });
      el('p2-title').textContent = 'Chemotactic Colony Enrichment';
      el('p2-sub').textContent = `${t.chemotacticEnrichment.toFixed(2)}×`;
      drawLinePlot(plot2, {
        xMin: 0, xMax: Math.max(20, histB.length), yMin: 0.6, yMax: Math.max(2.4, ...histB) * 1.1,
        series: [{ pts: histB.map((v, i) => [i, v]), color: '#facc15', width: 2.1 }],
        labelX: 'Enrichment (<v>_ag / <v>)'
      });
      el('p3-title').textContent = 'Active Gain Response';
      el('p3-sub').textContent = `gain=${params.morphChemo.toFixed(1)}`;
      drawLinePlot(plot3, {
        xMin: 0, xMax: 4.5, yMin: 0.8, yMax: 2.8,
        series: [{ pts: Array.from({ length: 24 }, (_, i) => [i * 0.2, 1.0 + 1.45 * (1 - Math.exp(-i * 0.14))]), color: '#56c2ff', width: 2.0 }],
        vMarker: params.morphChemo, labelX: 'Chemotaxis Gain'
      });
    }
  }

  async function selectMode(modeId, customSeq = null) {
    currentMode = modeId;
    currentLayer = layerForMode(modeId);
    if (activeSession) { activeSession.dispose(); activeSession = null; }
    pickedEntity = null;
    el('pick-card')?.classList.remove('open');
    if (el('pick-reticle')) el('pick-reticle').style.display = 'none';
    histA = []; histB = []; histC = [];

    document.querySelectorAll('.mode-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === modeId));
    for (const id of ['ctrl-membrane', 'ctrl-fold', 'ctrl-evo', 'ctrl-hh', 'ctrl-morph']) {
      el(id).style.display = id === `ctrl-${currentLayer}` ? 'flex' : 'none';
    }

    const doc = LIFE_MODE_DOCS[modeId];
    el('hud-title').textContent = doc?.title || modeId;
    el('hud-sub').textContent = (doc?.whatYouSee || '').slice(0, 148) + '…';

    if (currentLayer === 'membrane') {
      const initMode = modeId === 'protocell-vesicle' ? 'vesicle' : (modeId === 'lipid-bilayer' ? 'bilayer' : 'soup');
      activeSession = createAmphiphileMembraneSessionWebGpu(device, {
        lipidCount: initMode === 'vesicle' ? 320 : 280,
        initMode,
        epsHp: params.memEpsHp,
        temperatureK: params.memTempK,
        osmoticPressure: params.memOsmotic
      });
      await activeSession.step({ dt: 0.015, substeps: 8, readTelemetry: true });
    } else if (currentLayer === 'fold') {
      const seq = customSeq || POLYMER_SEQUENCE_TEMPLATES[modeId]?.sequence || params.foldSeq;
      params.foldSeq = seq;
      el('inp-seq').value = seq;
      el('val-fold-len').textContent = `${seq.length}-mer`;
      activeSession = createBiopolymerFoldingSessionWebGpu(device, {
        sequence: seq,
        temperatureK: params.foldTempK,
        epsHp: params.foldEpsHp,
        epsHBond: params.foldEpsHb
      });
      await activeSession.step({ dt: 0.014, substeps: 14, readTelemetry: true });
    } else if (currentLayer === 'evo') {
      activeSession = createTemplateReplicationSessionWebGpu(device, {
        populationCount: 1024,
        mutationRateMu: params.evoMu,
        selectionBeta: params.evoBeta
      });
      await activeSession.step({ substeps: 6, readTelemetry: true });
    } else if (currentLayer === 'hh') {
      activeSession = createExcitableMembraneSessionWebGpu(device, {
        width: 128,
        height: 128,
        initMode: modeId === 'excitable-pulse' ? 'pulse' : 'spiral',
        gNa: params.hhGNa,
        gK: params.hhGK,
        deltaPsiMv: params.hhDeltaPsi,
        deltaPh: params.hhDeltaPh,
        uncouplerLeak: params.hhUncouplerLeak
      });
      await activeSession.step({ dt: 0.025, substeps: 16, readTelemetry: true });
    } else {
      const regKey = TURING_MORPHOGEN_REGIMES[modeId] ? modeId : 'turing-spots';
      activeSession = createMorphogenesisActiveSessionWebGpu(device, {
        width: 128,
        height: 128,
        agentCount: 2048,
        regimeId: regKey,
        v0Propel: params.morphV0,
        chemoGain: params.morphChemo
      });
      activeSession.setDiffusionRatio(params.morphDiffRatio);
      await activeSession.step({ substeps: 24, readTelemetry: true });
    }

    refreshCameraForMode(modeId);
    updatePlotsAndHud();
    renderCurrentScene();
  }

  function renderCurrentScene() {
    if (!activeSession) return;
    const timeSec = (performance.now() - startTimeMs) * 0.001;
    if (currentLayer === 'membrane') {
      renderer.renderFrame({
        bioBeadsBuffer: activeSession.getResidentBeadsBuffer(),
        bioBeadCount: activeSession.beadCount,
        bioLinkMode: 2,
        bioLinkCount: activeSession.lipidCount * 2,
        sphereScale: 1.0,
        timeSec
      });
    } else if (currentLayer === 'fold') {
      renderer.renderFrame({
        bioBeadsBuffer: activeSession.getResidentResiduesBuffer(),
        bioBeadCount: activeSession.residueCount,
        bioLinkMode: 1,
        bioLinkCount: Math.max(0, activeSession.residueCount - 1),
        sphereScale: 1.12,
        timeSec
      });
    } else if (currentLayer === 'evo') {
      renderer.renderFrame({
        bioBeadsBuffer: activeSession.getResidentPopulationBuffer(),
        bioBeadCount: activeSession.populationCount,
        bioLinkMode: 0,
        bioLinkCount: 0,
        sphereScale: 1.18,
        timeSec
      });
    } else if (currentLayer === 'hh') {
      renderer.renderFrame({
        fieldBuffer: activeSession.getResidentFieldBuffer(),
        fieldMode: 3,
        fieldW: activeSession.width,
        fieldH: activeSession.height,
        timeSec
      });
    } else {
      // Coupled 3D Turing morphogen heightfield + 2,048 hovering 3D chemotactic agents in ONE GPU pass!
      renderer.renderFrame({
        fieldBuffer: activeSession.getResidentFieldBuffer(),
        fieldMode: 4,
        fieldW: activeSession.width,
        fieldH: activeSession.height,
        bioBeadsBuffer: activeSession.getResidentAgentsBuffer(),
        bioBeadCount: activeSession.agentCount,
        bioLinkMode: 0,
        bioLinkCount: 0,
        sphereScale: 0.95,
        timeSec
      });
    }
  }

  async function stepSimulationOnce({ forceRead = false, useSpeed = true } = {}) {
    if (disposed || busy || !activeSession) return;
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
      let tel = null;
      const dtScale = useSpeed ? Math.max(0.2, Math.min(1.0, spd * 1.4)) : 1.0;
      if (currentLayer === 'membrane') {
        tel = await activeSession.step({ dt: 0.015 * dtScale, substeps: useSpeed ? Math.max(1, Math.round(4 * spd)) : 4, readTelemetry: doRead });
        if (doRead) { histA.push(tel.meanTailCoordination); histB.push(tel.radialHeadOrder); }
      } else if (currentLayer === 'fold') {
        tel = await activeSession.step({ dt: 0.014 * dtScale, substeps: useSpeed ? Math.max(1, Math.round(5 * spd)) : 5, readTelemetry: doRead });
        if (doRead) { histA.push(tel.radiusOfGyrationA); histB.push(tel.catalyticRateBoost); }
      } else if (currentLayer === 'evo') {
        tel = await activeSession.step({ substeps: useSpeed ? Math.max(1, Math.round(2 * spd)) : 2, readTelemetry: doRead });
        if (doRead) { histA.push(tel.meanSequenceIdentity); histB.push(tel.quasispeciesFraction); }
      } else if (currentLayer === 'hh') {
        tel = await activeSession.step({ dt: 0.025 * dtScale, substeps: useSpeed ? Math.max(1, Math.round(10 * spd)) : 10, readTelemetry: doRead });
      } else {
        tel = await activeSession.step({ substeps: useSpeed ? Math.max(1, Math.round(10 * spd)) : 10, readTelemetry: doRead });
        if (doRead) { histA.push(tel.turingPatternStd); histB.push(tel.chemotacticEnrichment); }
      }
      if (histA.length > 96) histA.shift();
      if (histB.length > 96) histB.shift();
      if (doRead) updatePlotsAndHud();
      await refreshTrackedPickedEntity();
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
      title.textContent = LIFE_LAB_ABOUT_ULG.title;
      body.innerHTML = `
        <div class="modal-block"><h4>Overview</h4><p>${LIFE_LAB_ABOUT_ULG.overview}</p></div>
        <div class="modal-block"><h4>Active Universal Law Graph Nodes</h4><ul>${LIFE_LAB_ABOUT_ULG.laws.map((l) => `<li>${l}</li>`).join('')}</ul></div>
        <div class="modal-block"><h4>Falsifiable Null-Limit Proofs</h4><ul>${LIFE_LAB_ABOUT_ULG.falsifiableTests.map((t) => `<li>${t}</li>`).join('')}</ul></div>
      `;
    } else {
      const doc = LIFE_MODE_DOCS[currentMode];
      title.textContent = doc?.title || currentMode;
      body.innerHTML = `
        <div class="modal-block"><h4>What You Are Observing (${doc?.scale || '10⁻⁸ m'})</h4><p>${doc?.whatYouSee || ''}</p></div>
        <div class="modal-block"><h4>Governing Equations</h4><ul>${(doc?.equations || []).map((eq) => `<li><code>${eq}</code></li>`).join('')}</ul></div>
        <div class="modal-block"><h4>Falsifiable Experiments</h4><ul>${(doc?.experiments || []).map((ex) => `<li>${ex}</li>`).join('')}</ul></div>
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

  function getActivePickBufferInfo() {
    if (!activeSession) return null;
    if (currentLayer === 'membrane') return { buffer: activeSession.getResidentBeadsBuffer(), count: activeSession.beadCount, strideFloats: 12 };
    if (currentLayer === 'fold') return { buffer: activeSession.getResidentResiduesBuffer(), count: activeSession.residueCount, strideFloats: 12 };
    if (currentLayer === 'evo') return { buffer: activeSession.getResidentPopulationBuffer(), count: activeSession.populationCount, strideFloats: 12 };
    if (currentLayer === 'morph') return { buffer: activeSession.getResidentAgentsBuffer(), count: activeSession.agentCount, strideFloats: 12 };
    return null;
  }

  let followPickedEntity = false;

  async function refreshTrackedPickedEntity() {
    if (!pickedEntity || pickedEntity.index == null) return;
    const info = getActivePickBufferInfo();
    if (!info || !info.buffer) return;
    const raw = await gpuPicker.readSingleEntity(info.buffer, pickedEntity.index, info.strideFloats);
    if (!raw || !pickedEntity) return;
    const x = raw[0]; const y = raw[1]; const z = raw[2];
    const spd = Math.hypot(raw[4] || 0, raw[5] || 0, raw[6] || 0);
    pickedEntity.pos = [x, y, z];
    if (currentLayer === 'evo') {
      const fit = raw[7] || 0;
      pickedEntity.title = `Replicator #${pickedEntity.index} · Fitness w=${fit.toFixed(3)}`;
      pickedEntity.details = `r_fit=${Math.hypot(x, z).toFixed(2)} · match=${((raw[3] || 0) * 100).toFixed(1)}% · live GPU genome`;
    } else if (currentLayer === 'morph') {
      pickedEntity.details = `Sensed Morphogen v=${(raw[7] || 0).toFixed(3)} · Speed=${spd.toFixed(2)} · θ=${(raw[3] || 0).toFixed(2)} rad`;
    } else {
      pickedEntity.details = `pos=(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) · |v|=${spd.toFixed(2)}`;
    }
    if (followPickedEntity && orbitControls) {
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
    const info = getActivePickBufferInfo();
    if (!info) return null;
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ndcY = 1 - ((clientY - rect.top) / Math.max(1, rect.height)) * 2;
    const hit = await gpuPicker.pickEntity({
      buffer: info.buffer,
      count: info.count,
      strideFloats: info.strideFloats,
      layoutMode: GPU_PICK_LAYOUT.STANDARD,
      viewProj: renderer.getViewProj(),
      clickNdcX: ndcX,
      clickNdcY: ndcY,
      aspect: renderer.getAspect(),
      maxPickNdc: 0.14
    });
    if (!hit) { pickedEntity = null; followPickedEntity = false; updatePickOverlay(); return null; }
    followPickedEntity = false;
    const spd = Math.hypot(hit.vec1[0], hit.vec1[1], hit.vec1[2]);
    let title = `Mote #${hit.index}`;
    let details = `pos=(${hit.vec0[0].toFixed(2)}, ${hit.vec0[1].toFixed(2)}, ${hit.vec0[2].toFixed(2)}) · |v|=${spd.toFixed(2)}`;
    if (currentLayer === 'membrane') {
      const lipId = Math.floor(hit.index / 3);
      const role = hit.index % 3 === 0 ? 'Hydrophilic Head (Polar)' : `Hydrophobic Tail #${hit.index % 3}`;
      title = `Amphiphile #${lipId} · ${role}`;
    } else if (currentLayer === 'fold') {
      const sym = params.foldSeq[hit.index] || 'P';
      const label = sym === 'H' ? 'Hydrophobic (H)' : (sym === '+' ? 'Cationic (+)' : (sym === '-' ? 'Anionic (−)' : 'Polar (P)'));
      title = `Residue #${hit.index + 1} · ${label}`;
    } else if (currentLayer === 'evo') {
      const fit = hit.vec1[3];
      title = `Replicator #${hit.index} · Fitness w=${fit.toFixed(3)}`;
      details = `r_fit=${Math.hypot(hit.vec0[0], hit.vec0[2]).toFixed(2)} · match=${(hit.vec0[3] * 100).toFixed(1)}% · live GPU genome`;
    } else if (currentLayer === 'morph') {
      title = `Active Swimmer #${hit.index}`;
      details = `Sensed Morphogen v=${hit.vec1[3].toFixed(3)} · Speed=${spd.toFixed(2)} · θ=${hit.vec0[3].toFixed(2)} rad`;
    }
    pickedEntity = { index: hit.index, pos: [hit.vec0[0], hit.vec0[1], hit.vec0[2]], title, details };
    updatePickOverlay();
    return pickedEntity;
  }

  // Target-anchored OrbitControls (smooth damping, pan, dolly-to-target, click-to-pick, cameraAutoSpin: false!)
  orbitControls = createTargetOrbitControls(canvas, {
    yaw: 0.52,
    pitch: 0.44,
    dist: 18.0,
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
  el('pick-close')?.addEventListener('click', () => { pickedEntity = null; followPickedEntity = false; updatePickOverlay(); });
  el('pick-zoom')?.addEventListener('click', () => {
    if (!pickedEntity) return;
    followPickedEntity = true;
    orbitControls.focusTarget([...pickedEntity.pos], Math.min(renderer.camera.dist, 5.2));
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

  document.querySelectorAll('.acc-header').forEach((h) => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));
  document.querySelectorAll('.mode-btn').forEach((btn) => btn.addEventListener('click', () => {
    el('life-sidebar').classList.remove('mobile-open');
    selectMode(btn.dataset.mode);
  }));

  // Layer 1 controls
  el('sl-mem-eps').addEventListener('input', (e) => { params.memEpsHp = Number(e.target.value); el('val-mem-eps').textContent = params.memEpsHp.toFixed(2); activeSession?.setHydrophobicCoupling?.(params.memEpsHp); updatePlotsAndHud(); });
  el('sl-mem-temp').addEventListener('input', (e) => { params.memTempK = Number(e.target.value); el('val-mem-temp').textContent = `${Math.round(params.memTempK)} K`; activeSession?.setTemperatureK?.(params.memTempK); });
  el('sl-mem-osm').addEventListener('input', (e) => { params.memOsmotic = Number(e.target.value); el('val-mem-osm').textContent = params.memOsmotic.toFixed(2); activeSession?.setOsmoticPressure?.(params.memOsmotic); });
  el('btn-mem-null').addEventListener('click', () => { params.memEpsHp = 0.0; el('sl-mem-eps').value = '0'; el('val-mem-eps').textContent = '0.00'; activeSession?.setHydrophobicCoupling?.(0.0); updatePlotsAndHud(); });
  el('btn-mem-reset').addEventListener('click', () => { params.memEpsHp = 1.85; params.memTempK = 300; el('sl-mem-eps').value = '1.85'; el('val-mem-eps').textContent = '1.85'; el('sl-mem-temp').value = '300'; el('val-mem-temp').textContent = '300 K'; selectMode(currentMode); });

  // Layer 2 controls
  el('btn-apply-seq').addEventListener('click', () => selectMode(currentMode, el('inp-seq').value.trim().toUpperCase()));
  el('sl-fold-temp').addEventListener('input', (e) => { params.foldTempK = Number(e.target.value); el('val-fold-temp').textContent = `${Math.round(params.foldTempK)} K`; activeSession?.setTemperatureK?.(params.foldTempK); updatePlotsAndHud(); });
  el('sl-fold-eps').addEventListener('input', (e) => { params.foldEpsHp = Number(e.target.value); el('val-fold-eps').textContent = params.foldEpsHp.toFixed(2); activeSession?.setHydrophobicCoupling?.(params.foldEpsHp); });
  el('sl-fold-hb').addEventListener('input', (e) => { params.foldEpsHb = Number(e.target.value); el('val-fold-hb').textContent = params.foldEpsHb.toFixed(2); activeSession?.setHBondStrength?.(params.foldEpsHb); });
  el('btn-fold-denature').addEventListener('click', () => { params.foldTempK = 750; el('sl-fold-temp').value = '750'; el('val-fold-temp').textContent = '750 K'; activeSession?.setTemperatureK?.(750); updatePlotsAndHud(); });
  el('btn-fold-reset').addEventListener('click', () => { params.foldTempK = 300; el('sl-fold-temp').value = '300'; el('val-fold-temp').textContent = '300 K'; selectMode(currentMode); });

  // Layer 3 controls
  el('sl-evo-mu').addEventListener('input', (e) => { params.evoMu = Number(e.target.value); el('val-evo-mu').textContent = params.evoMu.toFixed(3); activeSession?.setMutationRateMu?.(params.evoMu); updatePlotsAndHud(); });
  el('sl-evo-beta').addEventListener('input', (e) => { params.evoBeta = Number(e.target.value); el('val-evo-beta').textContent = params.evoBeta.toFixed(2); activeSession?.setSelectionBeta?.(params.evoBeta); });
  el('sl-evo-fgc').addEventListener('input', (e) => { params.evoStrongFrac = Number(e.target.value); el('val-evo-fgc').textContent = params.evoStrongFrac.toFixed(2); updatePlotsAndHud(); });
  el('btn-evo-cat').addEventListener('click', () => { params.evoMu = 0.35; el('sl-evo-mu').value = '0.35'; el('val-evo-mu').textContent = '0.350'; activeSession?.setMutationRateMu?.(0.35); updatePlotsAndHud(); });
  el('btn-evo-reset').addEventListener('click', () => { params.evoMu = 0.025; el('sl-evo-mu').value = '0.025'; el('val-evo-mu').textContent = '0.025'; selectMode(currentMode); });

  // Layer 4 controls
  el('sl-hh-gna').addEventListener('input', (e) => { params.hhGNa = Number(e.target.value); el('val-hh-gna').textContent = `${Math.round(params.hhGNa)} mS`; activeSession?.setGNa?.(params.hhGNa); updatePlotsAndHud(); });
  el('sl-hh-gk').addEventListener('input', (e) => { params.hhGK = Number(e.target.value); el('val-hh-gk').textContent = `${Math.round(params.hhGK)} mS`; activeSession?.setGK?.(params.hhGK); });
  const pushChem = () => { activeSession?.setChemiosmosis?.({ deltaPsiMv: params.hhDeltaPsi, deltaPh: params.hhDeltaPh, uncouplerLeak: params.hhUncouplerLeak }); updatePlotsAndHud(); };
  el('sl-hh-psi').addEventListener('input', (e) => { params.hhDeltaPsi = Number(e.target.value); el('val-hh-psi').textContent = `${Math.round(params.hhDeltaPsi)} mV`; pushChem(); });
  el('sl-hh-dph').addEventListener('input', (e) => { params.hhDeltaPh = Number(e.target.value); el('val-hh-dph').textContent = params.hhDeltaPh.toFixed(2); pushChem(); });
  el('sl-hh-leak').addEventListener('input', (e) => { params.hhUncouplerLeak = Number(e.target.value); el('val-hh-leak').textContent = params.hhUncouplerLeak.toFixed(2); pushChem(); });
  el('btn-hh-stim').addEventListener('click', () => activeSession?.triggerStimulus?.());
  el('btn-hh-ttx').addEventListener('click', () => { params.hhGNa = 0; el('sl-hh-gna').value = '0'; el('val-hh-gna').textContent = '0 mS'; activeSession?.setGNa?.(0); updatePlotsAndHud(); });
  el('btn-hh-reset').addEventListener('click', () => { params.hhGNa = 120; params.hhUncouplerLeak = 0; el('sl-hh-gna').value = '120'; el('val-hh-gna').textContent = '120 mS'; el('sl-hh-leak').value = '0'; el('val-hh-leak').textContent = '0.00'; selectMode(currentMode); });

  // Layer 5 controls
  el('sl-m-v0').addEventListener('input', (e) => { params.morphV0 = Number(e.target.value); el('val-m-v0').textContent = params.morphV0.toFixed(2); activeSession?.setV0Propel?.(params.morphV0); });
  el('sl-m-chemo').addEventListener('input', (e) => { params.morphChemo = Number(e.target.value); el('val-m-chemo').textContent = params.morphChemo.toFixed(2); activeSession?.setChemoGain?.(params.morphChemo); updatePlotsAndHud(); });
  el('sl-m-ratio').addEventListener('input', (e) => { params.morphDiffRatio = Number(e.target.value); el('val-m-ratio').textContent = params.morphDiffRatio.toFixed(2); activeSession?.setDiffusionRatio?.(params.morphDiffRatio); });
  el('btn-m-null').addEventListener('click', () => { params.morphV0 = 0; params.morphChemo = 0; el('sl-m-v0').value = '0'; el('val-m-v0').textContent = '0.00'; el('sl-m-chemo').value = '0'; el('val-m-chemo').textContent = '0.00'; activeSession?.setV0Propel?.(0); activeSession?.setChemoGain?.(0); updatePlotsAndHud(); });
  el('btn-m-reset').addEventListener('click', () => { params.morphV0 = 1.35; params.morphChemo = 2.20; params.morphDiffRatio = 2.00; el('sl-m-v0').value = '1.35'; el('val-m-v0').textContent = '1.35'; el('sl-m-chemo').value = '2.20'; el('val-m-chemo').textContent = '2.20'; el('sl-m-ratio').value = '2.00'; el('val-m-ratio').textContent = '2.00'; selectMode(currentMode); });

  el('btn-play').addEventListener('click', () => { paused = !paused; el('btn-play').textContent = paused ? '▶ Play' : '⏸ Pause'; });
  el('about-btn').addEventListener('click', () => openAboutModal(false));
  el('menu-about-mode').addEventListener('click', () => { el('help-popover').classList.remove('open'); openAboutModal(false); });
  el('menu-about-lab').addEventListener('click', () => { el('help-popover').classList.remove('open'); openAboutModal(true); });
  el('modal-close').addEventListener('click', () => el('about-modal').classList.remove('open'));
  el('about-modal').addEventListener('click', (e) => { if (e.target === el('about-modal')) el('about-modal').classList.remove('open'); });
  el('help-btn').addEventListener('click', () => el('help-popover').classList.toggle('open'));
  el('toggle-plots-btn').addEventListener('click', () => { el('life-shell').classList.toggle('plots-collapsed'); el('life-dock').classList.toggle('mobile-open'); handleResize(); });
  el('mobile-nav-btn').addEventListener('click', () => el('life-sidebar').classList.toggle('mobile-open'));

  await selectMode('lipid-soup');

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
        layer: currentLayer,
        stepIndex: activeSession?.stepIndex || 0,
        simSpeed,
        camera: orbitControls ? orbitControls.state : { ...renderer.camera },
        params: { ...params },
        telemetry: activeSession?.getTelemetry?.() || null,
        gpuErrorCount: gpuErrors.length,
        gpuErrors: [...gpuErrors],
        cameraAutoSpin: false
      };
    },
    async selectMode(modeId, customSeq = null) { await selectMode(modeId, customSeq); return api.getState(); },
    setParams(patch = {}) {
      Object.assign(params, patch);
      if (currentLayer === 'membrane') {
        if ('memEpsHp' in patch) { el('sl-mem-eps').value = String(params.memEpsHp); el('val-mem-eps').textContent = params.memEpsHp.toFixed(2); activeSession?.setHydrophobicCoupling?.(params.memEpsHp); }
        if ('memTempK' in patch) { el('sl-mem-temp').value = String(params.memTempK); el('val-mem-temp').textContent = `${Math.round(params.memTempK)} K`; activeSession?.setTemperatureK?.(params.memTempK); }
        if ('memOsmotic' in patch) { el('sl-mem-osm').value = String(params.memOsmotic); el('val-mem-osm').textContent = params.memOsmotic.toFixed(2); activeSession?.setOsmoticPressure?.(params.memOsmotic); }
      } else if (currentLayer === 'fold') {
        if ('foldTempK' in patch) { el('sl-fold-temp').value = String(params.foldTempK); el('val-fold-temp').textContent = `${Math.round(params.foldTempK)} K`; activeSession?.setTemperatureK?.(params.foldTempK); }
        if ('foldEpsHp' in patch) activeSession?.setHydrophobicCoupling?.(params.foldEpsHp);
        if ('foldEpsHb' in patch) activeSession?.setHBondStrength?.(params.foldEpsHb);
      } else if (currentLayer === 'evo') {
        if ('evoMu' in patch) { el('sl-evo-mu').value = String(params.evoMu); el('val-evo-mu').textContent = params.evoMu.toFixed(3); activeSession?.setMutationRateMu?.(params.evoMu); }
        if ('evoBeta' in patch) activeSession?.setSelectionBeta?.(params.evoBeta);
      } else if (currentLayer === 'hh') {
        if ('hhGNa' in patch) { el('sl-hh-gna').value = String(params.hhGNa); el('val-hh-gna').textContent = `${Math.round(params.hhGNa)} mS`; activeSession?.setGNa?.(params.hhGNa); }
        if ('hhGK' in patch) activeSession?.setGK?.(params.hhGK);
        if ('hhDeltaPsi' in patch || 'hhDeltaPh' in patch || 'hhUncouplerLeak' in patch) {
          activeSession?.setChemiosmosis?.({ deltaPsiMv: params.hhDeltaPsi, deltaPh: params.hhDeltaPh, uncouplerLeak: params.hhUncouplerLeak });
        }
      } else if (currentLayer === 'morph') {
        if ('morphV0' in patch) { el('sl-m-v0').value = String(params.morphV0); el('val-m-v0').textContent = params.morphV0.toFixed(2); activeSession?.setV0Propel?.(params.morphV0); }
        if ('morphChemo' in patch) { el('sl-m-chemo').value = String(params.morphChemo); el('val-m-chemo').textContent = params.morphChemo.toFixed(2); activeSession?.setChemoGain?.(params.morphChemo); }
        if ('morphDiffRatio' in patch) { el('sl-m-ratio').value = String(params.morphDiffRatio); el('val-m-ratio').textContent = params.morphDiffRatio.toFixed(2); activeSession?.setDiffusionRatio?.(params.morphDiffRatio); }
      }
      updatePlotsAndHud();
    },
    triggerStimulus() { activeSession?.triggerStimulus?.(); },
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
      // Try exact center first, then scan a small cross around center so rings/hollow vesicles pick a live bead cleanly!
      for (const [ox, oy] of [[0.5, 0.5], [0.56, 0.5], [0.44, 0.5], [0.5, 0.44], [0.5, 0.56]]) {
        const hit = await pickAtClientPoint(rect.left + rect.width * ox, rect.top + rect.height * oy);
        if (hit) return hit;
      }
      return null;
    },
    getPickedEntity: () => pickedEntity,
    async stepNow(n = 8) {
      for (let i = 0; i < n; i += 1) {
        while (busy) await new Promise((r) => setTimeout(r, 8));
        await stepSimulationOnce({ forceRead: i === n - 1, useSpeed: false });
      }
      if (pickedEntity) {
        const info = getActivePickBufferInfo();
        if (info) {
          const raw = await gpuPicker.readSingleEntity(info.buffer, pickedEntity.index, info.strideFloats);
          if (raw) {
            pickedEntity.pos = [raw[0], raw[1], raw[2]];
            updatePickOverlay();
          }
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
      activeSession?.dispose();
      gpuPicker.dispose();
      renderer.dispose();
    }
  };
  window.__ulgLifeLab = api;
  return api;
}
