// Flagship Interactive Controller for ULG Biophysics & Emergent Life Lab (`life-lab.html`)
// (`src/demos/lifeLabDemo.js`).
//
// Pure WebGPU direct rendering (zero Three.js, 1 submit/frame, cameraAutoSpin: false):
//   - Nodes #20-24: amphiphile-membrane-self-assembly@1, biopolymer-folding-catalysis@1,
//     template-replication-evolution@1, chemiosmotic-bioenergetics-electrophysiology@1,
//     and reaction-diffusion-active-matter@1 dynamically orchestrated via Universal Law Graph!

import { initUlgExoWebTuiBridge } from './ulgExoWebTuiBridge.js';
initUlgExoWebTuiBridge({ labId: 'life', title: 'ULG Biophysics & Life Lab' });
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
import {
  buildPiOrbitalCloudBufferWebGpu,
  solvePiMolecularOrbitalsWebGpu
} from '../runtime/organic/organicMolecularGraphGpu.js';
import { createReactiveBondOrderMdSessionWebGpu } from '../runtime/organic/reactiveBondOrderMdGpu.js';
import { resolveActiveUniversalLaws } from '../runtime/universalLawGraph.js';
import { GPU_PICK_LAYOUT, createGpuEntityPickerWebGpu } from '../runtime/gpuMath/gpuEntityPickerWebGpu.js';
import { createTargetOrbitControls } from '../runtime/shared/targetOrbitControls.js';
import { requestCompatibleWebGpuDevice } from '../runtime/shared/webgpuCompat.js';
import { createChemBioWebGpuRenderer } from './chemBioWebGpuRenderer.js';
import { LIFE_LAB_ABOUT_ULG, LIFE_MODE_DOCS } from './lifeLabDocs.js';
import {
  XENOBIOLOGY_PLANET_PRESETS,
  deriveOrganismTissueLabParameters,
  deriveXenobiologyProfile,
  parseXenobiologyFromSearch
} from '../runtime/biology/xenobiologySynthesizer.js';
import { createVivariumOrganismController } from '../runtime/biology/xenobiologyAnatomyMesh.js';

function triggerLifeDownload(filename, text, mime = 'text/plain;charset=utf-8') {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {}
}

function drawContactMapPlot(canvas, coordsF32, nRes, seqStr = '') {
  if (!canvas) return { contactCount: 0, longRangeContacts: 0, nRes: 0 };
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#040910';
  ctx.fillRect(0, 0, w, h);
  if (!coordsF32 || nRes < 2) {
    ctx.fillStyle = '#8cb2ab';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('Sampling live GPU residue contacts…', 24, h * 0.5);
    return { contactCount: 0, longRangeContacts: 0, nRes: 0 };
  }
  const sz = Math.min(w - 92, h - 14);
  const ox = 16;
  const oy = Math.floor((h - sz) * 0.5);
  const cell = sz / nRes;
  let contactCount = 0;
  let longRangeContacts = 0;
  const cutoffA = 3.8;
  for (let i = 0; i < nRes; i += 1) {
    const xi = coordsF32[i * 12 + 0];
    const yi = coordsF32[i * 12 + 1];
    const zi = coordsF32[i * 12 + 2];
    for (let j = i; j < nRes; j += 1) {
      const dx = xi - coordsF32[j * 12 + 0];
      const dy = yi - coordsF32[j * 12 + 1];
      const dz = zi - coordsF32[j * 12 + 2];
      const d = Math.hypot(dx, dy, dz);
      const sep = j - i;
      if (sep === 0) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      } else if (d < cutoffA) {
        if (sep >= 3) {
          contactCount += 1;
          if (sep >= 6) longRangeContacts += 1;
        }
        const t = Math.max(0, Math.min(1, 1 - d / cutoffA));
        ctx.fillStyle = sep >= 6
          ? `rgba(250, 204, 21, ${(0.45 + 0.55 * t).toFixed(2)})` // Long-range tertiary contact (gold!)
          : (sep >= 3 ? `rgba(52, 211, 153, ${(0.40 + 0.58 * t).toFixed(2)})` : `rgba(86, 194, 255, ${(0.25 + 0.45 * t).toFixed(2)})`);
      } else if (d < cutoffA * 1.55) {
        ctx.fillStyle = 'rgba(30, 58, 92, 0.28)';
      } else {
        continue;
      }
      ctx.fillRect(ox + j * cell, oy + i * cell, Math.max(1.2, cell), Math.max(1.2, cell));
      if (i !== j) ctx.fillRect(ox + i * cell, oy + j * cell, Math.max(1.2, cell), Math.max(1.2, cell));
    }
  }
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox, oy, sz, sz);
  // Right-side contact-map legend
  const lx = ox + sz + 10;
  ctx.font = 'bold 9.5px ui-monospace, monospace';
  ctx.fillStyle = '#34d399';
  ctx.fillText(`N=${nRes} (${seqStr.length || nRes}m)`, lx, oy + 12);
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillStyle = '#facc15';
  ctx.fillText(`■ |i-j|≥6: ${longRangeContacts}`, lx, oy + 32);
  ctx.fillStyle = '#34d399';
  ctx.fillText(`■ Local: ${Math.max(0, contactCount - longRangeContacts)}`, lx, oy + 48);
  ctx.fillStyle = '#8cb2ab';
  ctx.fillText(`r < ${cutoffA.toFixed(1)} Å`, lx, oy + 66);
  ctx.fillText('Live GPU Map', lx, oy + 82);
  return { contactCount, longRangeContacts, nRes };
}

function drawPhasePortraitPlot(canvas, traceMv = []) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#040910';
  ctx.fillRect(0, 0, w, h);
  const padL = 34; const padR = 10; const padT = 10; const padB = 20;
  const pw = w - padL - padR; const ph = h - padT - padB;
  const mapX = (v) => padL + ((v + 85) / 135) * pw;
  const mapY = (dv) => padT + ph - ((dv + 45) / 90) * ph;
  ctx.strokeStyle = 'rgba(52,211,153,0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(padL, padT, pw, ph);
  ctx.beginPath(); ctx.moveTo(padL, mapY(0)); ctx.lineTo(w - padR, mapY(0)); ctx.stroke();
  if (traceMv.length >= 3) {
    ctx.strokeStyle = '#56c2ff';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    for (let i = 1; i < traceMv.length; i += 1) {
      const v = traceMv[i];
      const dv = Math.max(-44, Math.min(44, (traceMv[i] - traceMv[i - 1]) * 3.0));
      const px = Math.max(padL, Math.min(w - padR, mapX(v)));
      const py = Math.max(padT, Math.min(padT + ph, mapY(dv)));
      if (i === 1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    const lastV = traceMv[traceMv.length - 1];
    const lastDv = Math.max(-44, Math.min(44, (lastV - traceMv[traceMv.length - 2]) * 3.0));
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(mapX(lastV), mapY(lastDv), 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#8cb2ab';
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillText('+dV', 4, padT + 8);
  ctx.fillText('-dV', 4, padT + ph);
  ctx.fillText('HH Phase Portrait: V_m vs dV_m/dt', padL + 16, h - 5);
}

function layerForMode(modeId) {
  if (modeId === 'organism-overview') return 'vivarium';
  if (String(modeId || '').startsWith('bio-mol-')) return 'molecule';
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
  const { device } = await requestCompatibleWebGpuDevice({ label: 'ulg-life-lab' });
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
    molTempK: 288,
    molDielectricEr: 78.4,
    molEspBlend: 0.0,
    molShowPi: true,
    molStyle: 0,
    memEpsHp: 1.85,
    memTempK: 300,
    memOsmotic: 0.0,
    memClipZ: 8.0,
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
  let activeMolMeta = null;
  let activePiResult = null;
  let activePiCloud = null;

  let simSpeed = 0.30;
  let stepAccum = 0.0;
  let paused = false;
  let disposed = false;
  let busy = false;
  let frameCount = 0;
  let histA = [];
  let histB = [];
  let histC = [];
  let csvRows = []; // Recorded live scientist time-series trajectory rows!
  let foldShowContactMap = true;
  let hhShowPhasePortrait = false;
  let lastFoldCoordsF32 = null;
  let lastContactMapStats = { contactCount: 0, longRangeContacts: 0, nRes: 0 };
  let readbackStagingBuf = null;
  let readbackStagingBytes = 0;
  let readbackBusy = false;
  let vivSolidBuf = null;
  let vivGlassBuf = null;
  let vivBeadsBuf = null;
  let vivSolidVertCount = 0;
  let vivGlassVertCount = 0;
  let vivBeadCount = 0;
  let vivTool = 'probe';
  let activeVivariumSpecimen = null;
  let activeOrganPart = null;
  let activeOrganismDerived = null;
  let pendingBiopsyAction = null;
  const startTimeMs = performance.now();
  let orbitControls = null;

  function syncOrganismSourceBanner() {
    const banner = el('organism-source-banner');
    const txt = el('organism-source-text');
    const d = activeOrganismDerived;
    if (!banner || !txt) return;
    if (currentLayer === 'vivarium' || !d) {
      banner.classList.remove('visible');
      return;
    }
    const scaleTag = currentLayer === 'molecule'
      ? (activeMolMeta ? `${activeMolMeta.name} (${activeMolMeta.formula})` : 'Native Molecular Biochemistry')
      : (currentLayer === 'membrane'
        ? d.membraneLabel
        : (currentLayer === 'fold'
          ? d.proteinName
          : (currentLayer === 'evo'
            ? d.genomeLabel
            : (currentLayer === 'hh' ? d.bioenergeticLabel : d.morphLabel))));
    txt.innerHTML = `🧬 <em>${d.speciesName}</em> · ${d.organLabel} <small>(${d.solventFormula} · ${d.baseTempK} K · ${scaleTag})</small>`;
    banner.classList.add('visible');
  }

  function syncParamsFromActiveOrganism({ partId = null, partLabel = null, localTempK = null } = {}) {
    if (!activeXenoProfile) activeXenoProfile = deriveXenobiologyProfile(XENOBIOLOGY_PLANET_PRESETS[0]);
    if (!activeVivariumSpecimen) {
      activeVivariumSpecimen = activeXenoProfile.abductedSpecimen
        || (activeXenoProfile.species || []).find((s) => s.kingdom === 'fauna')
        || (activeXenoProfile.species || [])[0]
        || null;
    }
    if (partId !== null) activeOrganPart = { id: partId, label: partLabel || partId, localTempK };
    const d = deriveOrganismTissueLabParameters(activeVivariumSpecimen, activeXenoProfile, {
      partId: activeOrganPart?.id || null,
      partLabel: activeOrganPart?.label || null,
      localTempK: localTempK ?? activeOrganPart?.localTempK ?? null
    });
    activeOrganismDerived = d;

    params.molTempK = d.baseTempK;
    params.molDielectricEr = d.dielectricEr ?? 78.4;
    params.memTempK = d.memTempK;
    params.memEpsHp = d.memEpsHp;
    params.memOsmotic = d.memOsmotic;
    params.foldSeq = d.foldSeq;
    params.foldTempK = d.foldTempK;
    params.foldEpsHp = d.foldEpsHp;
    params.foldEpsHb = d.foldEpsHb;
    params.evoMu = d.evoMu;
    params.evoBeta = d.evoBeta;
    params.evoStrongFrac = d.evoStrongFrac;
    params.hhGNa = d.hhGNa;
    params.hhGK = d.hhGK;
    params.hhDeltaPsi = d.hhDeltaPsi;
    params.hhDeltaPh = d.hhDeltaPh;
    params.morphV0 = d.morphV0;
    params.morphChemo = d.morphChemo;
    params.morphDiffRatio = d.morphDiffRatio;

    if (el('sl-mol-temp')) { el('sl-mol-temp').value = String(params.molTempK); el('val-mol-temp').textContent = `${Math.round(params.molTempK)} K`; }
    if (el('sl-mol-eps')) { el('sl-mol-eps').value = String(params.molDielectricEr); el('val-mol-eps').textContent = Number(params.molDielectricEr).toFixed(1); }
    if (el('sub-mol-org')) el('sub-mol-org').textContent = `${d.solventFormula} · ε_r=${Number(d.dielectricEr || 78.4).toFixed(1)} · λ_B=${d.bjerrumLengthA || 7} Å`;
    if (el('sl-mem-temp')) { el('sl-mem-temp').value = String(params.memTempK); el('val-mem-temp').textContent = `${Math.round(params.memTempK)} K`; }
    if (el('sl-mem-eps')) { el('sl-mem-eps').value = String(params.memEpsHp); el('val-mem-eps').textContent = params.memEpsHp.toFixed(2); }
    if (el('sl-mem-osm')) { el('sl-mem-osm').value = String(params.memOsmotic); el('val-mem-osm').textContent = params.memOsmotic.toFixed(2); }
    if (el('inp-seq')) { el('inp-seq').value = params.foldSeq; }
    if (el('val-fold-len')) { el('val-fold-len').textContent = `${params.foldSeq.length}-mer`; }
    if (el('sl-fold-temp')) { el('sl-fold-temp').value = String(params.foldTempK); el('val-fold-temp').textContent = `${Math.round(params.foldTempK)} K`; }
    if (el('sl-fold-eps')) { el('sl-fold-eps').value = String(params.foldEpsHp); el('val-fold-eps').textContent = params.foldEpsHp.toFixed(2); }
    if (el('sl-fold-hb')) { el('sl-fold-hb').value = String(params.foldEpsHb); el('val-fold-hb').textContent = params.foldEpsHb.toFixed(2); }
    if (el('sl-evo-mu')) { el('sl-evo-mu').value = String(params.evoMu); el('val-evo-mu').textContent = params.evoMu.toFixed(3); }
    if (el('sl-evo-beta')) { el('sl-evo-beta').value = String(params.evoBeta); el('val-evo-beta').textContent = params.evoBeta.toFixed(2); }
    if (el('sl-evo-fgc')) { el('sl-evo-fgc').value = String(params.evoStrongFrac); el('val-evo-fgc').textContent = params.evoStrongFrac.toFixed(2); }
    if (el('sl-hh-gna')) { el('sl-hh-gna').value = String(params.hhGNa); el('val-hh-gna').textContent = `${Math.round(params.hhGNa)} mS`; }
    if (el('sl-hh-gk')) { el('sl-hh-gk').value = String(params.hhGK); el('val-hh-gk').textContent = `${Math.round(params.hhGK)} mS`; }
    if (el('sl-hh-psi')) { el('sl-hh-psi').value = String(params.hhDeltaPsi); el('val-hh-psi').textContent = `${Math.round(params.hhDeltaPsi)} mV`; }
    if (el('sl-hh-dph')) { el('sl-hh-dph').value = String(params.hhDeltaPh); el('val-hh-dph').textContent = params.hhDeltaPh.toFixed(2); }
    if (el('sl-m-v0')) { el('sl-m-v0').value = String(params.morphV0); el('val-m-v0').textContent = params.morphV0.toFixed(2); }
    if (el('sl-m-chemo')) { el('sl-m-chemo').value = String(params.morphChemo); el('val-m-chemo').textContent = params.morphChemo.toFixed(2); }
    if (el('sl-m-ratio')) { el('sl-m-ratio').value = String(params.morphDiffRatio); el('val-m-ratio').textContent = params.morphDiffRatio.toFixed(2); }

    if (el('sub-viv-org')) el('sub-viv-org').textContent = `${d.speciesName} · ${d.solventFormula} · ${d.baseTempK} K`;
    if (el('sub-mem-org')) el('sub-mem-org').textContent = `${d.membraneLabel} · ε=${d.memEpsHp}`;
    if (el('sub-fold-org')) el('sub-fold-org').textContent = `${d.proteinName} (${d.foldSeq.length}-mer)`;
    if (el('sub-evo-org')) el('sub-evo-org').textContent = `${d.genomeLabel} · μ=${d.evoMu}`;
    if (el('sub-hh-org')) el('sub-hh-org').textContent = `${d.bioenergeticLabel} · g_Na=${d.hhGNa}`;
    if (el('sub-morph-org')) el('sub-morph-org').textContent = `${d.morphLabel} · v₀=${d.morphV0}`;
    if (el('val-viv-organ-src')) el('val-viv-organ-src').textContent = d.organLabel;
    if (el('btn-fold-reset')) el('btn-fold-reset').textContent = `↺ Refold ${Math.round(params.foldTempK)} K`;

    // Dynamically relabel EVERY sub-mode button across Layers 1–5 directly from THIS organism & organ!
    if (d.modeLabels) {
      for (const [mId, meta] of Object.entries(d.modeLabels)) {
        const btn = document.querySelector(`.mode-btn[data-mode="${mId}"]`);
        if (!btn) continue;
        const spEl = btn.querySelector('span');
        const smEl = btn.querySelector('small');
        if (spEl) spEl.textContent = meta.title;
        if (smEl) smEl.textContent = meta.tag;
      }
    }

    syncOrganismSourceBanner();
    return d;
  }

  function ensureVivariumGpuBuffers() {
    if (!vivSolidBuf) {
      vivSolidBuf = device.createBuffer({ label: 'ulg-life-viv-solid', size: 24576 * 48, usage: 0x0020 | 0x0008 });
      vivGlassBuf = device.createBuffer({ label: 'ulg-life-viv-glass', size: 4096 * 48, usage: 0x0020 | 0x0008 });
      vivBeadsBuf = device.createBuffer({ label: 'ulg-life-viv-beads', size: 256 * 48, usage: 0x0080 | 0x0008 });
    }
  }

  function uploadVivariumFrame() {
    if (!activeSession || currentLayer !== 'vivarium') return;
    ensureVivariumGpuBuffers();
    const frame = activeSession.buildFrameBuffers();
    const sCount = Math.min(24576, frame.solidVertCount);
    const gCount = Math.min(4096, frame.glassVertCount);
    const bCount = Math.min(256, frame.beadCount);
    if (sCount > 0) device.queue.writeBuffer(vivSolidBuf, 0, frame.solidF32.subarray(0, sCount * 12));
    if (gCount > 0) device.queue.writeBuffer(vivGlassBuf, 0, frame.glassF32.subarray(0, gCount * 12));
    if (bCount > 0) device.queue.writeBuffer(vivBeadsBuf, 0, frame.beadsF32.subarray(0, bCount * 12));
    vivSolidVertCount = sCount;
    vivGlassVertCount = gCount;
    vivBeadCount = bCount;
  }

  async function readResidentFloats(srcBuf, floatCount) {
    if (!srcBuf || floatCount <= 0 || disposed || readbackBusy) return null;
    const byteLen = Math.ceil((floatCount * 4) / 4) * 4;
    readbackBusy = true;
    try {
      if (!readbackStagingBuf || readbackStagingBytes < byteLen) {
        if (readbackStagingBuf) try { readbackStagingBuf.destroy(); } catch {}
        readbackStagingBytes = Math.max(byteLen, 4096);
        readbackStagingBuf = device.createBuffer({
          label: 'ulg-life-export-readback',
          size: readbackStagingBytes,
          usage: 0x0001 | 0x0008 // MAP_READ | COPY_DST
        });
      }
      if (readbackStagingBuf.mapState !== 'unmapped') return null;
      const enc = device.createCommandEncoder({ label: 'ulg-life-readback' });
      enc.copyBufferToBuffer(srcBuf, 0, readbackStagingBuf, 0, byteLen);
      device.queue.submit([enc.finish()]);
      await readbackStagingBuf.mapAsync(0x0001);
      if (disposed) return null;
      const copy = new Float32Array(readbackStagingBuf.getMappedRange(0, byteLen)).slice();
      try { readbackStagingBuf.unmap(); } catch {}
      return copy;
    } catch {
      return null;
    } finally {
      readbackBusy = false;
    }
  }

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
    if (layer === 'vivarium') {
      pose = { yaw: 0.42, pitch: 0.24, dist: 10.6, target: [0, -0.35, 0] };
    } else if (layer === 'molecule') {
      pose = { yaw: 0.48, pitch: 0.34, dist: 15.6, target: [0, 0, 0] };
    } else if (layer === 'membrane') {
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
    const dOrg = activeOrganismDerived || syncParamsFromActiveOrganism();
    el('st-step').textContent = String(t.stepIndex || 0);
    if (dOrg && currentLayer !== 'vivarium') {
      const mMeta = dOrg.modeLabels?.[currentMode];
      el('pill-name').textContent = `${dOrg.speciesName} · ${mMeta?.title || dOrg.organLabel}`;
      el('pill-tag').textContent = `${dOrg.organLabel} · ${dOrg.solventFormula} ${dOrg.baseTempK} K`;
    } else {
      el('pill-name').textContent = doc?.title?.split('(')[0]?.trim() || currentMode;
      el('pill-tag').textContent = doc?.badge || currentLayer;
    }

    const laws = resolveActiveUniversalLaws({
      organicAtomCount: currentLayer === 'molecule' ? (activeSession.atomCount || 0) : 0,
      covalentBondCount: currentLayer === 'molecule' ? (activeSession.bondCount || 0) : 0,
      amphiphileCount: currentLayer === 'membrane' ? activeSession.lipidCount : 0,
      polymerResidueCount: currentLayer === 'fold' ? activeSession.residueCount : 0,
      replicatorCount: currentLayer === 'evo' ? activeSession.populationCount : 0,
      excitableMembraneActive: currentLayer === 'hh',
      deltaPh: currentLayer === 'hh' ? params.hhDeltaPh : 0,
      gNaMsCm2: currentLayer === 'hh' ? params.hhGNa : 0,
      morphogenesisActive: currentLayer === 'morph',
      activeAgentCount: currentLayer === 'morph' ? activeSession.agentCount : 0
    });
    el('prov-laws').textContent = currentLayer === 'vivarium'
      ? '1 active (xenobiology-ecology)'
      : `${laws.active.length} active (${laws.active.map((l) => l.id.split('-')[0]).join(', ')})`;

    if (currentLayer === 'molecule') {
      const m = activeMolMeta || { name: 'Biomolecule', formula: '—', role: 'Native Chemistry', reason: '' };
      el('pill-name').textContent = `${dOrg?.speciesName || 'Organism'} · ${m.name}`;
      el('pill-tag').textContent = `${m.formula} · ${dOrg?.solventFormula || 'H₂O'} ${Math.round(params.molTempK)} K`;
      el('st-m1-lbl').textContent = 'Formula';
      el('st-m1-val').textContent = m.formula;
      el('st-m2-lbl').textContent = 'Dipole';
      el('st-m2-val').textContent = `${(t.dipoleDebye || 0).toFixed(2)} D`;
      el('st-m3-lbl').textContent = 'H-Bonds';
      el('st-m3-val').textContent = String(t.hBondCount ?? 0);
      el('prov-tier').textContent = 'Tier-1';
      el('prov-entities').textContent = `${activeSession.atomCount} atoms · ${activeSession.bondCount} bonds (QEq + Morse MD)`;
      el('prov-inv').textContent = `ε_r=${Number(params.molDielectricEr).toFixed(1)} · ΔG_Born=${(t.bornSolvationKjMol || 0).toFixed(1)} kJ/mol`;
      if (el('val-mol-formula')) el('val-mol-formula').textContent = m.formula;
      if (el('mol-synthesis-reason')) el('mol-synthesis-reason').textContent = m.reason || m.role;

      const p3AltBtn = el('btn-p3-alt');
      if (p3AltBtn) p3AltBtn.style.display = 'none';
      el('p1-title').textContent = 'Live All-Atom Thermal MD T(t)';
      el('p1-sub').textContent = `${Math.round(t.instTempK || params.molTempK)} K (R_g=${(t.radiusOfGyrationA || 0).toFixed(2)} Å)`;
      drawLinePlot(plot1, {
        xMin: 0, xMax: Math.max(20, histA.length),
        yMin: Math.max(20, params.molTempK * 0.4), yMax: Math.max(params.molTempK * 1.6, ...histA, 150),
        series: [{ pts: histA.map((v, i) => [i, v]), color: '#facc15', width: 2.1 }],
        labelX: 'WebGPU Reactive Bond-Order MD'
      });
      const qs = activeSession.qeq?.charges ? Array.from(activeSession.qeq.charges) : [0, 0];
      el('p2-title').textContent = 'QEq Atomic Partial Charges q_i';
      el('p2-sub').textContent = `max|q|=${(activeSession.qeq?.maxAbsCharge || 0).toFixed(2)}e`;
      drawLinePlot(plot2, {
        xMin: 0, xMax: Math.max(2, qs.length - 1), yMin: -0.95, yMax: 0.95,
        series: [{ pts: qs.map((q, i) => [i, q]), color: '#56c2ff', width: 2.1 }],
        hZero: true, labelX: 'Atom Index i (Rappé–Goddard QEq)'
      });
      if (activePiResult && activePiResult.eigenvaluesEv?.length >= 2) {
        const es = Array.from(activePiResult.eigenvaluesEv);
        el('p3-title').textContent = `GPU Hückel π-MO (${es.length}π)`;
        el('p3-sub').textContent = `Gap ${(activePiResult.homoLumoGapEv || 0).toFixed(2)} eV`;
        drawLinePlot(plot3, {
          xMin: 0, xMax: Math.max(1, es.length - 1),
          yMin: Math.min(-6, ...es) - 0.5, yMax: Math.max(6, ...es) + 0.5,
          series: [{ pts: es.map((ev, i) => [i, ev]), color: '#34d399', width: 2.2 }],
          hZero: true, labelX: 'Orbital Index (eV)'
        });
      } else {
        el('p3-title').textContent = 'Born Solvation vs Dielectric ε_r';
        el('p3-sub').textContent = `ε_r=${Number(params.molDielectricEr).toFixed(1)}`;
        const gBase = Math.min(-1, (t.bornSolvationKjMol || -40) / Math.max(0.05, 1 - 1 / Math.max(1.2, params.molDielectricEr)));
        drawLinePlot(plot3, {
          xMin: 1, xMax: 105, yMin: gBase * 1.05, yMax: 5,
          series: [{ pts: Array.from({ length: 35 }, (_, i) => { const er = 1.2 + i * 3; return [er, gBase * (1 - 1 / er)]; }), color: '#a78bfa', width: 2.0 }],
          vMarker: params.molDielectricEr, hZero: true, labelX: 'Solvent Dielectric ε_r'
        });
      }
    } else if (currentLayer === 'vivarium') {
      const sp = activeSession.specimen || {};
      const prof = activeXenoProfile || deriveXenobiologyProfile(XENOBIOLOGY_PLANET_PRESETS[0]);
      el('pill-name').textContent = `${sp.speciesName || 'Specimen'} · ${prof.worldName}`;
      el('pill-tag').textContent = `${sp.morphClass || sp.bodyPlan || 'Vivarium'}`;
      el('st-m1-lbl').textContent = 'Kleiber';
      el('st-m1-val').textContent = `${t.kleiberWatts} W`;
      el('st-m2-lbl').textContent = 'Tissue T';
      el('st-m2-val').textContent = `${t.localTissueTempK} K`;
      el('st-m3-lbl').textContent = 'Arousal';
      el('st-m3-val').textContent = `${Math.round((t.arousal || 0) * 100)}%`;
      el('prov-tier').textContent = 'Tier-2';
      el('prov-entities').textContent = `${sp.speciesName || 'Organism'} (${sp.kingdom || 'fauna'} · ${sp.xnaAlphabetSize || 4}-base XNA)`;
      el('prov-inv').textContent = `${prof.redox?.metabolicPathway?.split('(')[0]?.trim() || 'Redox'} · ΔG=${sp.deltaGKjMol ?? prof.redox?.deltaGKjMol ?? -478} kJ/mol`;
      if (el('val-viv-kingdom')) el('val-viv-kingdom').textContent = (sp.kingdom || 'fauna').toUpperCase();
      if (el('val-viv-plan')) el('val-viv-plan').textContent = sp.morphClass || sp.bodyPlan || '—';

      const p3AltBtn = el('btn-p3-alt');
      if (p3AltBtn) p3AltBtn.style.display = 'none';
      el('p1-title').textContent = 'Kleiber Metabolism & Arousal';
      el('p1-sub').textContent = `${t.kleiberWatts} W · ${t.heartRateBpm} bpm`;
      drawLinePlot(plot1, {
        xMin: 0, xMax: Math.max(20, histA.length), yMin: 0, yMax: Math.max(40, ...histA, t.kleiberWatts * 1.4) * 1.15,
        series: [
          { pts: histA.map((v, i) => [i, v]), color: '#34d399', width: 2.1 },
          { pts: histB.map((v, i) => [i, v * Math.max(20, t.kleiberWatts)]), color: '#facc15', width: 1.7 }
        ],
        labelX: 'Vivarium Physiology (W / Arousal)'
      });
      el('p2-title').textContent = 'Thermal Survival Envelope';
      el('p2-sub').textContent = `T=${t.localTissueTempK}K (T_den=${t.tDenatureK}K)`;
      const tMinPlot = Math.max(60, Math.min(t.tOptK - 70, t.localTissueTempK - 25));
      const tMaxPlot = Math.max(t.tDenatureK + 40, t.localTissueTempK + 25);
      drawLinePlot(plot2, {
        xMin: tMinPlot, xMax: tMaxPlot, yMin: 0, yMax: 1.15,
        series: [{
          pts: Array.from({ length: 31 }, (_, i) => {
            const tk = tMinPlot + (i / 30) * (tMaxPlot - tMinPlot);
            const sig = 1.0 / (1.0 + Math.exp((tk - t.tDenatureK) / 14.0));
            const cold = Math.exp(-Math.pow(Math.max(0, t.tOptK - tk) / 48.0, 2));
            return [tk, Math.min(1.0, sig * (0.25 + 0.75 * cold))];
          }),
          color: '#fb7185', width: 2.1
        }],
        vMarker: t.localTissueTempK, labelX: 'Tissue Temp (K)'
      });
      const curve = prof.photobiology?.spectralCurve || [];
      el('p3-title').textContent = `Photobiology (λ_edge=${prof.photobiology?.redEdgeNm || 705}nm)`;
      el('p3-sub').textContent = `${prof.photobiology?.zSchemePhotons ?? 2}γ Z-Scheme`;
      drawLinePlot(plot3, {
        xMin: 300, xMax: 1400, yMin: 0, yMax: 1.1,
        series: [
          { pts: curve.map((c) => [c.lamNm, c.fluxNorm]), color: '#facc15', width: 1.8 },
          { pts: curve.map((c) => [c.lamNm, c.absorb]), color: '#34d399', width: 2.2 }
        ],
        vMarker: prof.photobiology?.redEdgeNm || 705, labelX: 'Wavelength λ (nm)'
      });
    } else if (currentLayer === 'membrane') {
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
      const p3AltBtn = el('btn-p3-alt');
      if (p3AltBtn) p3AltBtn.style.display = 'none';
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
      const p3AltBtn = el('btn-p3-alt');
      if (p3AltBtn) {
        p3AltBtn.style.display = 'inline-flex';
        p3AltBtn.textContent = foldShowContactMap ? '📈 Melt' : '🗺 Map';
      }
      if (foldShowContactMap) {
        el('p3-title').textContent = '2D Contact Map';
        lastContactMapStats = drawContactMapPlot(plot3, lastFoldCoordsF32, activeSession.residueCount, params.foldSeq);
        el('p3-sub').textContent = `${lastContactMapStats.contactCount} hits`;
      } else {
        el('p3-title').textContent = `Thermal Melt (T_den=${dOrg?.tDenatureK || 360} K)`;
        el('p3-sub').textContent = `T=${Math.round(params.foldTempK)} K`;
        const tDenPlot = dOrg?.tDenatureK || 360;
        const tPlotMin = Math.max(60, Math.round(tDenPlot - 140));
        const tPlotMax = Math.max(tDenPlot + 180, Math.round(params.foldTempK + 40));
        drawLinePlot(plot3, {
          xMin: tPlotMin, xMax: tPlotMax, yMin: 0, yMax: 1.05,
          series: [{
            pts: Array.from({ length: 31 }, (_, i) => {
              const tk = tPlotMin + (i / 30) * (tPlotMax - tPlotMin);
              return [tk, 1 / (1 + Math.exp((tk - tDenPlot) / Math.max(16, tDenPlot * 0.09)))];
            }),
            color: '#fb7185', width: 2.0
          }],
          vMarker: params.foldTempK, labelX: `${dOrg?.solventFormula || 'H₂O'} Fold Temp (K)`
        });
      }
    } else if (currentLayer === 'evo') {
      const melt = evaluateDuplexMeltingCurve({
        lengthL: 16,
        strongPairFraction: params.evoStrongFrac,
        dHPerPairKj: dOrg?.xnaDhPerPairKj,
        dSPerPairJ: dOrg?.xnaDsPerPairJ,
        alphabetSize: dOrg?.xnaAlphabetSize || 4
      });
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

      el('p1-title').textContent = `${dOrg?.xnaAlphabetSize || 4}-Base XNA Melting θ(T)`;
      el('p1-sub').textContent = `T_m=${melt.meltingTempK.toFixed(1)} K (${melt.meltingTempC.toFixed(1)}°C)`;
      drawLinePlot(plot1, {
        xMin: Math.max(60, Math.round(melt.meltingTempK - 55)),
        xMax: Math.round(melt.meltingTempK + 55),
        yMin: 0, yMax: 1.05,
        series: [{ pts: melt.curve.map((p) => [p.tempK, p.duplexFraction]), color: '#56c2ff', width: 2.2 }],
        vMarker: Math.min(melt.meltingTempK + 50, Math.max(melt.meltingTempK - 50, dOrg?.baseTempK || melt.meltingTempK)),
        labelX: `${dOrg?.speciesName || 'Organism'} XNA Temp (K)`
      });
      el('p2-title').textContent = 'Live Sequence Identity';
      el('p2-sub').textContent = `${(t.meanSequenceIdentity * 100).toFixed(1)}%`;
      const idHist = t.fitnessHistory && t.fitnessHistory.length >= 2 ? t.fitnessHistory : histA;
      drawLinePlot(plot2, {
        xMin: 0, xMax: Math.max(20, idHist.length), yMin: 0, yMax: 1.05,
        series: [{ pts: idHist.map((v, i) => [i, v]), color: '#34d399', width: 2.1 }],
        labelX: 'Generations'
      });
      const p3AltBtn = el('btn-p3-alt');
      if (p3AltBtn) p3AltBtn.style.display = 'none';
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
        temperatureK: dOrg?.baseTempK || 310,
        deltaGCurrencyKjMol: dOrg?.energyCurrencyKjMol || null,
        uncouplerLeak: params.hhUncouplerLeak
      });
      const ions = dOrg?.channelIons || { depolIon: 'Na⁺', repolIon: 'K⁺', eDepolMv: 50, eRepolMv: -77, q10Rate: 1.0 };
      const currShort = String(dOrg?.energyCurrencyName || 'ATP').split(' ')[0];
      el('st-m1-lbl').textContent = 'Max V_m';
      el('st-m1-val').textContent = `${t.maxVoltageMv.toFixed(1)} mV`;
      el('st-m2-lbl').textContent = 'PMF Δp';
      el('st-m2-val').textContent = `${chem.protonMotiveForceMv.toFixed(1)} mV`;
      el('st-m3-lbl').textContent = `${currShort} Flux`;
      el('st-m3-val').textContent = `${chem.atpSynthesisFlux.toFixed(1)}`;
      el('prov-tier').textContent = 'Tier-1';
      el('prov-entities').textContent = `128² ${ions.depolIon}/${ions.repolIon} (${Math.round(dOrg?.baseTempK || 288)} K · Q₁₀=${ions.q10Rate}×)`;
      el('prov-inv').textContent = params.hhGNa < 1 ? 'Blocked (g_depol=0)' : (chem.atpSynthesisFlux === 0 ? 'PMF=0 / Uncoupled (0 flux)' : `${dOrg?.energyCurrencyName || 'ATP'} (${dOrg?.energyCurrencyKjMol || 50} kJ/mol)`);

      el('p1-title').textContent = `${ions.depolIon}/${ions.repolIon} Action Potential V_m(t)`;
      el('p1-sub').textContent = `${t.probeVoltageMv.toFixed(1)} mV`;
      const vt = t.voltageTraceMv && t.voltageTraceMv.length >= 2 ? t.voltageTraceMv : [ions.vRestMv ?? -65, ions.vRestMv ?? -65];
      drawLinePlot(plot1, {
        xMin: 0, xMax: Math.max(24, vt.length),
        yMin: Math.min(-45, (ions.eRepolMv || -77) - 8),
        yMax: Math.max(28, (ions.eDepolMv || 50) + 6),
        series: [{ pts: vt.map((v, i) => [i, v]), color: '#facc15', width: 2.1 }],
        hZero: true, labelX: `Membrane Time (ms · T=${Math.round(dOrg?.baseTempK || 288)}K)`
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
      const p3AltBtn = el('btn-p3-alt');
      if (p3AltBtn) {
        p3AltBtn.style.display = 'inline-flex';
        p3AltBtn.textContent = hhShowPhasePortrait ? '⚡ ATP' : '🔄 Phase';
      }
      if (hhShowPhasePortrait) {
        el('p3-title').textContent = 'HH Phase Portrait';
        el('p3-sub').textContent = `${t.probeVoltageMv.toFixed(1)} mV`;
        drawPhasePortraitPlot(plot3, vt);
      } else {
        el('p3-title').textContent = 'Mitchell ATP Flux';
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
      }
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
      const p3AltBtn = el('btn-p3-alt');
      if (p3AltBtn) p3AltBtn.style.display = 'none';
      el('p3-title').textContent = 'Active Gain Response';
      el('p3-sub').textContent = `gain=${params.morphChemo.toFixed(1)}`;
      drawLinePlot(plot3, {
        xMin: 0, xMax: 4.5, yMin: 0.8, yMax: 2.8,
        series: [{ pts: Array.from({ length: 24 }, (_, i) => [i * 0.2, 1.0 + 1.45 * (1 - Math.exp(-i * 0.14))]), color: '#56c2ff', width: 2.0 }],
        vMarker: params.morphChemo, labelX: 'Chemotaxis Gain'
      });
    }
  }

  let modeSwitchToken = 0;
  async function selectMode(modeId, customSeq = null) {
    const myToken = ++modeSwitchToken;
    while (busy) await new Promise((r) => setTimeout(r, 4));
    if (myToken !== modeSwitchToken || disposed) return;
    currentMode = modeId;
    currentLayer = layerForMode(modeId);
    if (activeSession) { activeSession.dispose?.(); activeSession = null; }
    pickedEntity = null;
    el('pick-card')?.classList.remove('open');
    if (el('pick-reticle')) el('pick-reticle').style.display = 'none';
    histA = []; histB = []; histC = []; csvRows = []; lastFoldCoordsF32 = null;

    document.querySelectorAll('.mode-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === modeId));
    const activeBtnEl = document.querySelector(`.mode-btn[data-mode="${modeId}"]`);
    const activeGrpEl = activeBtnEl?.closest('.acc-group') || null;
    document.querySelectorAll('.acc-group').forEach((grp) => {
      const isAct = grp === activeGrpEl;
      grp.classList.toggle('active-group', isAct);
      grp.classList.toggle('open', isAct);
      grp.querySelector('.acc-header')?.setAttribute('aria-expanded', isAct ? 'true' : 'false');
    });
    for (const id of ['ctrl-vivarium', 'ctrl-molecule', 'ctrl-membrane', 'ctrl-fold', 'ctrl-evo', 'ctrl-hh', 'ctrl-morph']) {
      if (el(id)) el(id).style.display = id === `ctrl-${currentLayer}` ? 'flex' : 'none';
    }

    const doc = LIFE_MODE_DOCS[modeId];
    const dOrg = activeOrganismDerived || syncParamsFromActiveOrganism();
    if (currentLayer === 'vivarium') {
      el('hud-title').textContent = `${dOrg?.speciesName || 'Living Specimen'} · Interactive Bio-Aquarium`;
      el('hud-sub').textContent = `Click any organ on ${dOrg?.speciesName || 'this organism'} (${dOrg?.solventFormula || 'H₂O'}, ${dOrg?.baseTempK || 288} K) to probe, heat, cool, stim, or biopsy into live GPU physics`;
    } else if (currentLayer === 'molecule') {
      const mMeta = dOrg?.molecules?.[modeId] || dOrg?.molecules?.['bio-mol-membrane'];
      el('hud-title').textContent = `${dOrg?.speciesName || 'Organism'} · ${mMeta?.name || 'Native Biomolecule'} (${mMeta?.formula || ''})`;
      el('hud-sub').textContent = `Live WebGPU all-atom reactive MD + QEq charges in ${dOrg?.solventFormula || 'H₂O'} (${Math.round(params.molTempK)} K, ε_r=${Number(params.molDielectricEr).toFixed(1)})`;
    } else if (currentLayer === 'membrane') {
      el('hud-title').textContent = `${dOrg?.speciesName || 'Organism'} · ${dOrg?.membraneLabel || doc?.title || modeId}`;
      el('hud-sub').textContent = `Live GPU amphiphile MD of ${dOrg?.speciesName || 'organism'}'s ${dOrg?.organLabel || 'somatic'} cell membrane (${dOrg?.baseTempK || params.memTempK} K, ${dOrg?.isNonpolar ? 'INVERTED nonpolar core' : (dOrg?.isMonolayer ? 'bipolar monolayer' : 'polar bilayer')})`;
    } else if (currentLayer === 'fold') {
      el('hud-title').textContent = `${dOrg?.speciesName || 'Organism'} · ${dOrg?.proteinName || doc?.title || modeId}`;
      el('hud-sub').textContent = `Live GPU ${dOrg?.isNonpolar ? 'inverted polar-core' : 'hydrophobic-core'} folding (${params.foldSeq.length}-mer @ ${Math.round(params.foldTempK)} K, T_den=${dOrg?.tDenatureK || 360} K, ε_r=${Number(dOrg?.dielectricEr || 78.4).toFixed(1)})`;
    } else if (currentLayer === 'evo') {
      el('hud-title').textContent = `${dOrg?.speciesName || 'Organism'} · ${dOrg?.genomeLabel || doc?.title || modeId}`;
      el('hud-sub').textContent = `1,024-lineage GPU ${dOrg?.xnaAlphabetSize || 4}-base XNA replication & Eigen threshold (T_m=${Math.round(dOrg?.xnaTargetTmK || 330)} K, μ=${params.evoMu.toFixed(3)})`;
    } else if (currentLayer === 'hh') {
      const ions = dOrg?.channelIons || { depolIon: 'Na⁺', repolIon: 'K⁺', eDepolMv: 50, eRepolMv: -77 };
      el('hud-title').textContent = `${dOrg?.speciesName || 'Organism'} · ${ions.depolIon}/${ions.repolIon} & ${dOrg?.energyCurrencyName || 'ATP'}`;
      el('hud-sub').textContent = `128² GPU Nernst (${ions.eRepolMv}..+${ions.eDepolMv} mV, Q₁₀=${ions.q10Rate ?? 1}×) + ${dOrg?.energyCurrencyName || 'ATP'} (${dOrg?.energyCurrencyKjMol || 50} kJ/mol)`;
    } else {
      el('hud-title').textContent = `${dOrg?.speciesName || 'Organism'} · ${dOrg?.morphLabel || doc?.title || modeId}`;
      el('hud-sub').textContent = `128² GPU Turing (F=${dOrg?.turingFeedF || 0.036}, k=${dOrg?.turingKillK || 0.062}) + 2,048 active embryonic cells (v₀=${params.morphV0.toFixed(2)})`;
    }
    syncOrganismSourceBanner();

    const orgSeedStr = `${dOrg?.speciesName || 'earth'}:${dOrg?.organId || 'whole'}:${dOrg?.solvent || 'H2O'}`;
    let organismSeed = 20261125;
    for (let ci = 0; ci < orgSeedStr.length; ci += 1) {
      organismSeed = (Math.imul(organismSeed ^ orgSeedStr.charCodeAt(ci), 2654435761) >>> 0) || 1;
    }

    if (activePiCloud?.buffer) {
      try { activePiCloud.buffer.destroy(); } catch {}
      activePiCloud = null;
    }
    activePiResult = null;
    activeMolMeta = null;

    if (currentLayer === 'molecule') {
      const mMeta = dOrg?.molecules?.[modeId] || dOrg?.molecules?.['bio-mol-membrane'];
      activeMolMeta = mMeta;
      activeSession = createReactiveBondOrderMdSessionWebGpu(device, {
        graph: mMeta.graph,
        temperatureK: params.molTempK,
        dielectricEr: params.molDielectricEr,
        seed: organismSeed,
        label: `ulg-life-mol-${modeId}`
      });
      await activeSession.step({ dt: 0.014, substeps: 6, readTelemetry: true });
      try {
        const piRes = await solvePiMolecularOrbitalsWebGpu(device, mMeta.graph);
        if (piRes && piRes.piAtomCount >= 2 && myToken === modeSwitchToken && !disposed) {
          activePiResult = piRes;
          activePiCloud = buildPiOrbitalCloudBufferWebGpu(device, mMeta.graph, piRes, {
            moIndex: piRes.homoIndex ?? 0,
            pointCount: Math.max(2048, Math.min(8192, piRes.piAtomCount * 400))
          });
        }
      } catch {}
    } else if (currentLayer === 'vivarium') {
      if (!activeXenoProfile) activeXenoProfile = deriveXenobiologyProfile(XENOBIOLOGY_PLANET_PRESETS[0]);
      const prof = activeXenoProfile;
      const cladeList = [];
      if (prof.abductedSpecimen) cladeList.push(prof.abductedSpecimen);
      for (const s of (prof.species || [])) {
        if (!cladeList.some((c) => c.speciesName === s.speciesName)) cladeList.push(s);
      }
      if (!activeVivariumSpecimen || !cladeList.some((c) => c.speciesName === activeVivariumSpecimen.speciesName)) {
        // Prioritize explicitly abducted specimen first; otherwise showcase the world's flagship motile Fauna in the aquarium!
        activeVivariumSpecimen = prof.abductedSpecimen
          || cladeList.find((c) => c.kingdom === 'fauna')
          || cladeList[0]
          || null;
      }
      const sel = el('sel-viv-species');
      if (sel) {
        sel.innerHTML = cladeList.map((s, idx) => {
          const ic = s.kingdom === 'flora' ? '🌿' : (s.kingdom === 'fungi' ? '🍄' : (s.bodyPlan === 'aero-gasbag' ? '🎈' : (s.bodyPlan === 'aquatic-swimmer' ? '🐟' : '🐾')));
          return `<option value="${idx}">${ic} ${s.speciesName} (${s.morphClass})</option>`;
        }).join('');
        const curIdx = Math.max(0, cladeList.findIndex((c) => c.speciesName === activeVivariumSpecimen?.speciesName));
        sel.value = String(curIdx);
      }
      activeSession = createVivariumOrganismController(activeVivariumSpecimen, prof);
      const t0 = activeSession.getTelemetry();
      if (el('sl-viv-temp')) {
        el('sl-viv-temp').value = String(t0.chamberTempK);
        el('val-viv-temp').textContent = `${t0.chamberTempK} K`;
      }
      if (el('viv-anatomy-box')) {
        const sp = activeSession.specimen;
        el('viv-anatomy-box').innerHTML = `<strong><em>${sp.speciesName}</em></strong> (${sp.morphClass})<br/>Solvent: ${prof.solventFormula} · ${sp.xnaAlphabetSize || 4}-base ${sp.xnaBackbone || 'XNA'}<br/>Skeleton: ${sp.skeleton || 'Endoskeleton'}<br/>Click anywhere on the body with <strong>${vivTool.toUpperCase()}</strong>!`;
      }
      if (el('btn-viv-biopsy-jump')) el('btn-viv-biopsy-jump').style.display = 'none';
      pendingBiopsyAction = null;
      activeSession.step(0.02);
      uploadVivariumFrame();
    } else if (currentLayer === 'membrane') {
      const initMode = modeId === 'protocell-vesicle' ? 'vesicle' : (modeId === 'lipid-bilayer' ? 'bilayer' : 'soup');
      activeSession = createAmphiphileMembraneSessionWebGpu(device, {
        lipidCount: initMode === 'vesicle' ? 320 : 280,
        initMode,
        hydrophobicCoupling: params.memEpsHp,
        temperatureK: params.memTempK,
        osmoticPressure: params.memOsmotic,
        solventPolarity: dOrg?.solventPolarity ?? 1.0,
        isMonolayer: Boolean(dOrg?.isMonolayer),
        tRefK: dOrg?.baseTempK ?? 300,
        seed: organismSeed
      });
      await activeSession.step({ dt: 0.015, substeps: 8, readTelemetry: true });
    } else if (currentLayer === 'fold') {
      const seq = customSeq || activeOrganismDerived?.organProteins?.[modeId] || activeOrganismDerived?.foldSeq || POLYMER_SEQUENCE_TEMPLATES[modeId]?.sequence || params.foldSeq;
      params.foldSeq = seq;
      el('inp-seq').value = seq;
      el('val-fold-len').textContent = `${seq.length}-mer`;
      activeSession = createBiopolymerFoldingSessionWebGpu(device, {
        sequence: seq,
        temperatureK: params.foldTempK,
        hydrophobicCoupling: params.foldEpsHp,
        hBondStrength: params.foldEpsHb,
        dielectricEr: dOrg?.dielectricEr ?? 78.4,
        solventPolarity: dOrg?.solventPolarity ?? 1.0,
        tDenatureK: dOrg?.tDenatureK ?? 360,
        tRefK: dOrg?.baseTempK ?? 300,
        seed: organismSeed
      });
      await activeSession.step({ dt: 0.014, substeps: 14, readTelemetry: true });
      lastFoldCoordsF32 = await readResidentFloats(activeSession.getResidentResiduesBuffer(), activeSession.residueCount * 12);
    } else if (currentLayer === 'evo') {
      activeSession = createTemplateReplicationSessionWebGpu(device, {
        populationCount: 1024,
        mutationRateMu: params.evoMu,
        selectionBeta: params.evoBeta,
        temperatureK: dOrg?.baseTempK ?? 310,
        alphabetSize: dOrg?.xnaAlphabetSize ?? 4,
        seed: organismSeed
      });
      await activeSession.step({ substeps: 6, readTelemetry: true });
    } else if (currentLayer === 'hh') {
      const ions = dOrg?.channelIons || {};
      activeSession = createExcitableMembraneSessionWebGpu(device, {
        width: 128,
        height: 128,
        initSpiral: modeId !== 'excitable-pulse',
        gNa: params.hhGNa,
        gK: params.hhGK,
        deltaPsiMv: params.hhDeltaPsi,
        deltaPh: params.hhDeltaPh,
        uncouplerLeak: params.hhUncouplerLeak,
        temperatureK: dOrg?.baseTempK ?? 310,
        deltaGCurrencyKjMol: dOrg?.energyCurrencyKjMol ?? null,
        eDepolMv: ions.eDepolMv ?? 50.0,
        eRepolMv: ions.eRepolMv ?? -77.0,
        eLeakMv: ions.eLeakMv ?? -54.4,
        vRestMv: ions.vRestMv ?? -65.0,
        q10Rate: ions.q10Rate ?? 1.0,
        seed: organismSeed
      });
      await activeSession.step({ dt: 0.025, substeps: 16, readTelemetry: true });
    } else {
      const regKey = TURING_MORPHOGEN_REGIMES[modeId] ? modeId : 'turing-spots';
      activeSession = createMorphogenesisActiveSessionWebGpu(device, {
        width: 128,
        height: 128,
        agentCount: 2048,
        regimeId: regKey,
        feedF: dOrg?.turingFeedF ?? null,
        killK: dOrg?.turingKillK ?? null,
        v0Propel: params.morphV0,
        chemoGain: params.morphChemo,
        seed: organismSeed
      });
      activeSession.setDiffusionRatio(params.morphDiffRatio);
      await activeSession.step({ substeps: 24, readTelemetry: true });
    }

    refreshCameraForMode(modeId);
    updatePlotsAndHud();
    renderCurrentScene();
    syncMobileContextBar();
  }

  function renderCurrentScene() {
    if (!activeSession) return;
    const timeSec = (performance.now() - startTimeMs) * 0.001;
    const dOrg = activeOrganismDerived;
    const pRgb = dOrg?.primaryRgb || [0.22, 0.85, 0.62];
    const sRgb = dOrg?.secondaryRgb || [0.92, 0.68, 0.24];
    const mhRgb = dOrg?.memHeadRgb || pRgb;
    const mtRgb = dOrg?.memTailRgb || sRgb;
    if (currentLayer === 'molecule') {
      renderer.renderFrame({
        orgAtomsBuffer: activeSession.getResidentAtomsBuffer(),
        orgAtomCount: activeSession.atomCount,
        orgBondsBuffer: activeSession.getResidentBondsBuffer(),
        orgBondCount: activeSession.bondCount,
        piCloudBuffer: activePiCloud?.pointsBuffer || null,
        piCloudCount: activePiCloud?.pointCount || 0,
        showPiMo: Boolean(params.molShowPi),
        espBlend: params.molEspBlend,
        style: params.molStyle,
        sphereScale: 1.0,
        timeSec
      });
    } else if (currentLayer === 'vivarium') {
      renderer.renderFrame({
        specimenSolidBuffer: vivSolidBuf,
        specimenSolidVertCount: vivSolidVertCount,
        specimenGlassBuffer: vivGlassBuf,
        specimenGlassVertCount: vivGlassVertCount,
        bioBeadsBuffer: vivBeadsBuf,
        bioBeadCount: vivBeadCount,
        bioLinkMode: 0,
        bioLinkCount: 0,
        sphereScale: 0.72,
        orgTintA: [pRgb[0], pRgb[1], pRgb[2], 0.0],
        orgTintB: [sRgb[0], sRgb[1], sRgb[2], 0.0],
        timeSec
      });
    } else if (currentLayer === 'membrane') {
      const clipVal = Number.isFinite(Number(params.memClipZ)) && Number(params.memClipZ) < 7.8 ? Number(params.memClipZ) : 999.0;
      renderer.renderFrame({
        bioBeadsBuffer: activeSession.getResidentBeadsBuffer(),
        bioBeadCount: activeSession.beadCount,
        bioLinkMode: 2,
        bioLinkCount: activeSession.lipidCount * 2,
        sphereScale: 1.0,
        clipZ: clipVal,
        orgTintA: [mhRgb[0], mhRgb[1], mhRgb[2], 0.58],
        orgTintB: [mtRgb[0], mtRgb[1], mtRgb[2], 0.0],
        timeSec
      });
    } else if (currentLayer === 'fold') {
      renderer.renderFrame({
        bioBeadsBuffer: activeSession.getResidentResiduesBuffer(),
        bioBeadCount: activeSession.residueCount,
        bioLinkMode: 1,
        bioLinkCount: Math.max(0, activeSession.residueCount - 1),
        sphereScale: 1.12,
        orgTintA: [pRgb[0], pRgb[1], pRgb[2], 0.42],
        orgTintB: [sRgb[0], sRgb[1], sRgb[2], 0.0],
        timeSec
      });
    } else if (currentLayer === 'evo') {
      renderer.renderFrame({
        bioBeadsBuffer: activeSession.getResidentPopulationBuffer(),
        bioBeadCount: activeSession.populationCount,
        bioLinkMode: 0,
        bioLinkCount: 0,
        sphereScale: 1.18,
        orgTintA: [pRgb[0], pRgb[1], pRgb[2], 0.55],
        orgTintB: [mhRgb[0], mhRgb[1], mhRgb[2], (dOrg?.xnaAlphabetSize || 4) / 12.0],
        timeSec
      });
    } else if (currentLayer === 'hh') {
      renderer.renderFrame({
        fieldBuffer: activeSession.getResidentFieldBuffer(),
        fieldMode: 3,
        fieldW: activeSession.width,
        fieldH: activeSession.height,
        orgTintA: [pRgb[0], pRgb[1], pRgb[2], 0.72],
        orgTintB: [sRgb[0], sRgb[1], sRgb[2], 0.0],
        timeSec
      });
    } else {
      // Coupled 3D Turing morphogen heightfield + 2,048 hovering 3D chemotactic agents in THIS organism's exact pigmentation!
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
        orgTintA: [pRgb[0], pRgb[1], pRgb[2], 0.90],
        orgTintB: [sRgb[0], sRgb[1], sRgb[2], 0.0],
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
      if (currentLayer === 'molecule') {
        tel = await activeSession.step({ dt: 0.014 * dtScale, substeps: useSpeed ? Math.max(1, Math.round(4 * spd)) : 4, readTelemetry: doRead });
        if (doRead) {
          histA.push(tel.instTempK || params.molTempK);
          histB.push(tel.radiusOfGyrationA || 2.0);
          csvRows.push([tel.stepIndex, (tel.instTempK || 0).toFixed(2), (tel.dipoleDebye || 0).toFixed(3), tel.hBondCount || 0]);
        }
      } else if (currentLayer === 'vivarium') {
        activeSession.step(0.032 * Math.max(0.35, spd * 1.8));
        uploadVivariumFrame();
        tel = activeSession.getTelemetry();
        if (doRead) {
          histA.push(tel.kleiberWatts);
          histB.push(tel.arousal);
          csvRows.push([tel.stepIndex, tel.kleiberWatts, tel.localTissueTempK, tel.arousal]);
        }
      } else if (currentLayer === 'membrane') {
        tel = await activeSession.step({ dt: 0.015 * dtScale, substeps: useSpeed ? Math.max(1, Math.round(4 * spd)) : 4, readTelemetry: doRead });
        if (doRead) {
          histA.push(tel.meanTailCoordination); histB.push(tel.radialHeadOrder);
          csvRows.push([tel.stepIndex, tel.meanTailCoordination.toFixed(4), tel.radialHeadOrder.toFixed(4), tel.meanRadius.toFixed(4)]);
        }
      } else if (currentLayer === 'fold') {
        tel = await activeSession.step({ dt: 0.014 * dtScale, substeps: useSpeed ? Math.max(1, Math.round(5 * spd)) : 5, readTelemetry: doRead });
        if (doRead) {
          histA.push(tel.radiusOfGyrationA); histB.push(tel.catalyticRateBoost);
          csvRows.push([tel.stepIndex, tel.radiusOfGyrationA.toFixed(4), tel.catalyticRateBoost.toFixed(4), tel.hydrophobicContacts]);
          if (foldShowContactMap) {
            lastFoldCoordsF32 = await readResidentFloats(activeSession.getResidentResiduesBuffer(), activeSession.residueCount * 12);
          }
        }
      } else if (currentLayer === 'evo') {
        tel = await activeSession.step({ substeps: useSpeed ? Math.max(1, Math.round(2 * spd)) : 2, readTelemetry: doRead });
        if (doRead) {
          histA.push(tel.meanSequenceIdentity); histB.push(tel.quasispeciesFraction);
          csvRows.push([tel.stepIndex, tel.meanSequenceIdentity.toFixed(4), tel.quasispeciesFraction.toFixed(4), params.evoMu.toFixed(4)]);
        }
      } else if (currentLayer === 'hh') {
        tel = await activeSession.step({ dt: 0.025 * dtScale, substeps: useSpeed ? Math.max(1, Math.round(10 * spd)) : 10, readTelemetry: doRead });
        if (doRead) {
          csvRows.push([tel.stepIndex, tel.probeVoltageMv.toFixed(3), tel.maxVoltageMv.toFixed(3), params.hhGNa.toFixed(1)]);
        }
      } else {
        tel = await activeSession.step({ substeps: useSpeed ? Math.max(1, Math.round(10 * spd)) : 10, readTelemetry: doRead });
        if (doRead) {
          histA.push(tel.turingPatternStd); histB.push(tel.chemotacticEnrichment);
          csvRows.push([tel.stepIndex, tel.turingPatternStd.toFixed(5), tel.chemotacticEnrichment.toFixed(4), tel.meanAgentSpeed.toFixed(4)]);
        }
      }
      if (histA.length > 96) histA.shift();
      if (histB.length > 96) histB.shift();
      if (csvRows.length > 2000) csvRows.shift();
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
    if (currentLayer === 'molecule') return { buffer: activeSession.getResidentAtomsBuffer(), count: activeSession.atomCount, strideFloats: 16 };
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
      const fit = Number(raw[3]) || 0;
      const genU32 = new Uint32Array(new Float32Array([raw[7] || 0]).buffer)[0];
      pickedEntity.title = `Replicator #${pickedEntity.index} · Fitness w=${fit.toFixed(3)}`;
      pickedEntity.details = `r_fit=${Math.hypot(x, z).toFixed(2)} · genome=0x${genU32.toString(16).padStart(8, '0')} · live GPU replicator`;
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

  function handleVivariumPartInteraction(tool, hit, worldPt = null) {
    if (currentLayer !== 'vivarium' || !activeSession) return null;
    const res = activeSession.applyInteraction(tool, hit, worldPt);
    uploadVivariumFrame();
    const t = activeSession.getTelemetry();
    histA.push(t.kleiberWatts);
    histB.push(t.arousal);
    // Immediately synchronize ALL 5 molecular/cellular GPU layers to the clicked anatomical organ & its live temperature!
    const derivedOrgan = syncParamsFromActiveOrganism({
      partId: res.partId,
      partLabel: res.partLabel,
      localTempK: res.localTempK
    });
    if (el('viv-anatomy-box')) {
      el('viv-anatomy-box').innerHTML = `<strong>${res.partLabel}</strong> (${res.localTempK} K)<br/>${res.reactionText}<br/><span style="color:#8cb2ab;">Tissue: ${res.tissue}</span>`;
    }
    const biopsyBtn = el('btn-viv-biopsy-jump');
    if (res.biopsyAction) {
      pendingBiopsyAction = {
        ...res.biopsyAction,
        fasta: derivedOrgan?.foldSeq || res.biopsyAction.fasta
      };
      if (biopsyBtn) {
        biopsyBtn.style.display = 'inline-flex';
        biopsyBtn.textContent = `🔬 ${res.partLabel.split(' ')[0]} → ${res.biopsyAction.layerLabel || 'Tissue Lab'} (${res.localTempK} K)`;
      }
    } else if (res.localTempK >= (t.tDenatureK - 10)) {
      pendingBiopsyAction = {
        partId: res.partId,
        partLabel: res.partLabel,
        targetLayer: 'fold',
        layerLabel: 'Protein Denaturation',
        targetMode: derivedOrgan?.recommendedFoldMode || 'amphipathic-helix-bundle',
        tissueTempK: res.localTempK,
        fasta: derivedOrgan?.foldSeq || activeSession.specimen?.fasta
      };
      if (biopsyBtn) {
        biopsyBtn.style.display = 'inline-flex';
        biopsyBtn.textContent = `🔥 Watch ${res.localTempK} K Denaturation →`;
      }
    }
    pickedEntity = {
      index: null,
      pos: hit?.point || hit?.center || [...activeSession.state.pos],
      title: `${res.partLabel} (${tool.toUpperCase()})`,
      details: `${res.reactionText} · Tissue: ${res.tissue}`
    };
    updatePlotsAndHud();
    renderCurrentScene();
    updatePickOverlay();
    syncMobileContextBar?.(`${res.partLabel}: ${res.reactionText}`);
    return res;
  }

  async function pickAtClientPoint(clientX, clientY) {
    if (currentLayer === 'vivarium' && activeSession) {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const ndcY = 1 - ((clientY - rect.top) / Math.max(1, rect.height)) * 2;
      const ray = renderer.unprojectRay(ndcX, ndcY);
      const hit = activeSession.rayPickPart(ray.origin, ray.dir);
      if (!hit) { pickedEntity = null; updatePickOverlay(); return null; }
      return handleVivariumPartInteraction(vivTool, hit, hit.point);
    }
    if (currentLayer === 'hh') {
      activeSession?.triggerStimulus?.();
      renderCurrentScene();
      return null;
    }
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
    if (currentLayer === 'molecule') {
      const atomInfo = activeMolMeta?.graph?.atoms?.[hit.index];
      const qVal = Number(hit.vec1?.[3] ?? 0);
      title = `Atom #${hit.index + 1} · ${atomInfo?.sym || 'X'} (Z=${atomInfo?.Z || 6}, ${atomInfo?.hybridization || 'sp3'})`;
      details = `QEq q=${qVal >= 0 ? '+' : ''}${qVal.toFixed(3)}e · ${activeMolMeta?.formula || ''} · T=${Math.round(params.molTempK)} K`;
    } else if (currentLayer === 'membrane') {
      const lipId = Math.floor(hit.index / 3);
      const role = hit.index % 3 === 0 ? 'Hydrophilic Head (Polar)' : `Hydrophobic Tail #${hit.index % 3}`;
      title = `Amphiphile #${lipId} · ${role}`;
    } else if (currentLayer === 'fold') {
      const sym = params.foldSeq[hit.index] || 'P';
      const label = sym === 'H' ? 'Hydrophobic (H)' : (sym === '+' ? 'Cationic (+)' : (sym === '-' ? 'Anionic (−)' : 'Polar (P)'));
      title = `Residue #${hit.index + 1} · ${label}`;
    } else if (currentLayer === 'evo') {
      const fit = Number(hit.vec0[3]) || 0;
      const genU32 = new Uint32Array(new Float32Array([hit.vec1[3] || 0]).buffer)[0];
      title = `Replicator #${hit.index} · Fitness w=${fit.toFixed(3)}`;
      details = `r_fit=${Math.hypot(hit.vec0[0], hit.vec0[2]).toFixed(2)} · genome=0x${genU32.toString(16).padStart(8, '0')} · live GPU replicator`;
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

  document.querySelectorAll('.acc-header').forEach((h) => h.addEventListener('click', () => {
    const grp = h.closest('.acc-group');
    if (!grp) return;
    const isNowOpen = grp.classList.toggle('open');
    h.setAttribute('aria-expanded', isNowOpen ? 'true' : 'false');
  }));
  document.querySelectorAll('.mode-btn').forEach((btn) => btn.addEventListener('click', () => {
    closeMobileDrawers();
    selectMode(btn.dataset.mode);
  }));

  function closeMobileDrawers() {
    el('life-sidebar')?.classList.remove('mobile-open');
    el('life-dock')?.classList.remove('mobile-open');
    el('mobile-drawer-backdrop')?.classList.remove('open');
  }

  function syncMobileContextBar(toastMsg = null) {
    const row = el('mobile-context-row');
    const toast = el('mobile-viv-toast');
    if (!row) return;
    if (toast) {
      if (toastMsg && currentLayer === 'vivarium') {
        toast.textContent = toastMsg;
        toast.classList.add('visible');
      } else if (currentLayer !== 'vivarium') {
        toast.classList.remove('visible');
      }
    }
    if (currentLayer === 'vivarium') {
      const tools = [
        ['inspect', '🔍', 'Inspect'],
        ['probe', '👉', 'Probe'],
        ['heat', '🔥', 'Heat'],
        ['cool', '❄️', 'Cool'],
        ['stim', '⚡', 'Stim'],
        ['sample', '💉', 'Biopsy']
      ];
      const biopsyHtml = pendingBiopsyAction
        ? '<button type="button" class="mobile-ctx-btn gold" data-mctx="biopsy-jump">🔬 Tissue →</button>'
        : '';
      row.innerHTML = tools.map(([id, ic, lbl]) => (
        `<button type="button" class="mobile-ctx-btn ${vivTool === id ? 'active' : ''}" data-mctx-viv="${id}" title="${lbl}">${ic} ${lbl}</button>`
      )).join('') + biopsyHtml;
      row.querySelectorAll('[data-mctx-viv]').forEach((b) => {
        b.addEventListener('click', () => setVivToolUi(b.dataset.mctxViv));
      });
      row.querySelector('[data-mctx="biopsy-jump"]')?.addEventListener('click', () => el('btn-viv-biopsy-jump')?.click());
    } else {
      const primaryByLayer = {
        molecule: { id: 'btn-mol-esp', lbl: '⚡ ESP', cls: 'gold' },
        membrane: { id: 'btn-mem-null', lbl: 'ε_hp=0', cls: 'coral' },
        fold: { id: 'btn-fold-denature', lbl: '🔥 Denature', cls: 'coral' },
        evo: { id: 'btn-evo-cat', lbl: '⚠ Error Cat.', cls: 'coral' },
        hh: { id: 'btn-hh-stim', lbl: '⚡ Stim', cls: 'gold' },
        morph: { id: 'btn-m-null', lbl: 'v₀=0', cls: 'coral' }
      };
      const resetByLayer = {
        molecule: 'btn-mol-pi',
        membrane: 'btn-mem-reset',
        fold: 'btn-fold-reset',
        evo: 'btn-evo-reset',
        hh: 'btn-hh-reset',
        morph: 'btn-m-reset'
      };
      const pAct = primaryByLayer[currentLayer] || primaryByLayer.membrane;
      const rId = resetByLayer[currentLayer] || 'btn-mem-reset';
      row.innerHTML = `
        <button type="button" class="mobile-ctx-btn gold" data-mctx="organism">🫧 Organism</button>
        <button type="button" class="mobile-ctx-btn" data-mctx="play">${paused ? '▶ Play' : '⏸ Pause'}</button>
        <button type="button" class="mobile-ctx-btn ${pAct.cls}" data-mctx="primary">${pAct.lbl}</button>
        <button type="button" class="mobile-ctx-btn" data-mctx="reset">↺ Native</button>
        <button type="button" class="mobile-ctx-btn" data-mctx="controls">☰ Lab</button>`;
      row.querySelector('[data-mctx="organism"]')?.addEventListener('click', () => { closeMobileDrawers(); void selectMode('organism-overview'); });
      row.querySelector('[data-mctx="play"]')?.addEventListener('click', () => el('btn-play')?.click());
      row.querySelector('[data-mctx="primary"]')?.addEventListener('click', () => el(pAct.id)?.click());
      row.querySelector('[data-mctx="reset"]')?.addEventListener('click', () => el(rId)?.click());
      row.querySelector('[data-mctx="controls"]')?.addEventListener('click', () => el('mobile-nav-btn')?.click());
    }
  }

  // Layer 0 (Specimen Vivarium / Aquarium) controls
  const setVivToolUi = (tool) => {
    vivTool = tool;
    const labels = { inspect: '🔍 Inspect', probe: '👉 Probe', heat: '🔥 Heat', cool: '❄️ Cool', stim: '⚡ Stim', sample: '💉 Biopsy' };
    if (el('val-viv-tool')) el('val-viv-tool').textContent = labels[tool] || tool;
    document.querySelectorAll('#viv-tool-row [data-viv-tool]').forEach((b) => b.classList.toggle('active', b.dataset.vivTool === tool));
    syncMobileContextBar();
  };
  document.querySelectorAll('#viv-tool-row [data-viv-tool]').forEach((b) => {
    b.addEventListener('click', () => setVivToolUi(b.dataset.vivTool));
  });
  el('sel-viv-species')?.addEventListener('change', () => {
    const prof = activeXenoProfile || deriveXenobiologyProfile(XENOBIOLOGY_PLANET_PRESETS[0]);
    const list = [];
    if (prof.abductedSpecimen) list.push(prof.abductedSpecimen);
    for (const s of (prof.species || [])) if (!list.some((c) => c.speciesName === s.speciesName)) list.push(s);
    const chosen = list[Number(el('sel-viv-species').value) || 0];
    if (chosen) {
      activeVivariumSpecimen = chosen;
      activeOrganPart = null;
      syncParamsFromActiveOrganism();
      void selectMode('organism-overview');
    }
  });
  el('sl-viv-temp')?.addEventListener('input', (e) => {
    const tk = Number(e.target.value);
    if (el('val-viv-temp')) el('val-viv-temp').textContent = `${Math.round(tk)} K`;
    activeSession?.setChamberTempK?.(tk);
    syncParamsFromActiveOrganism({ localTempK: tk });
    updatePlotsAndHud();
  });
  el('btn-viv-reset')?.addEventListener('click', () => {
    activeSession?.reset?.();
    activeOrganPart = null;
    syncParamsFromActiveOrganism();
    uploadVivariumFrame();
    updatePlotsAndHud();
    renderCurrentScene();
  });
  el('btn-back-to-organism')?.addEventListener('click', () => {
    closeMobileDrawers();
    void selectMode('organism-overview');
  });
  document.querySelectorAll('#viv-scale-zoom-row [data-org-zoom]').forEach((b) => {
    b.addEventListener('click', () => {
      const d = activeOrganismDerived || syncParamsFromActiveOrganism();
      const k = b.dataset.orgZoom;
      const modeByKey = {
        molecule: 'bio-mol-membrane',
        membrane: d.recommendedMemMode || 'protocell-vesicle',
        fold: d.recommendedFoldMode || 'amphipathic-helix-bundle',
        evo: 'quasispecies-evolution',
        hh: d.recommendedHhMode || 'excitable-spiral',
        morph: d.recommendedMorphMode || 'turing-spots'
      };
      closeMobileDrawers();
      void selectMode(modeByKey[k] || 'protocell-vesicle', k === 'fold' ? d.foldSeq : null);
    });
  });

  // Layer 0B (Native Environmental Molecular Chemistry) controls
  el('sl-mol-temp')?.addEventListener('input', (e) => {
    params.molTempK = Number(e.target.value);
    if (el('val-mol-temp')) el('val-mol-temp').textContent = `${Math.round(params.molTempK)} K`;
    activeSession?.setTemperatureK?.(params.molTempK);
    updatePlotsAndHud();
  });
  el('sl-mol-eps')?.addEventListener('input', (e) => {
    params.molDielectricEr = Number(e.target.value);
    if (el('val-mol-eps')) el('val-mol-eps').textContent = params.molDielectricEr.toFixed(1);
    activeSession?.setDielectricEr?.(params.molDielectricEr);
    updatePlotsAndHud();
  });
  el('btn-mol-esp')?.addEventListener('click', () => {
    params.molEspBlend = params.molEspBlend > 0.1 ? 0.0 : 0.45;
    el('btn-mol-esp')?.classList.toggle('active', params.molEspBlend > 0.1);
    renderCurrentScene();
  });
  el('btn-mol-pi')?.addEventListener('click', () => {
    params.molShowPi = !params.molShowPi;
    el('btn-mol-pi')?.classList.toggle('active', params.molShowPi);
    renderCurrentScene();
  });
  el('btn-mol-rep')?.addEventListener('click', () => {
    params.molStyle = (params.molStyle + 1) % 3;
    const lbls = ['Ball & Stick', 'CPK vdW', 'Licorice'];
    if (el('btn-mol-rep')) el('btn-mol-rep').textContent = lbls[params.molStyle] || 'Ball & Stick';
    renderCurrentScene();
  });
  el('btn-viv-biopsy-jump')?.addEventListener('click', () => {
    if (!pendingBiopsyAction) return;
    const d = syncParamsFromActiveOrganism({
      partId: pendingBiopsyAction.partId || null,
      partLabel: pendingBiopsyAction.partLabel || null,
      localTempK: pendingBiopsyAction.tissueTempK ?? null
    });
    closeMobileDrawers();
    void selectMode(pendingBiopsyAction.targetMode, pendingBiopsyAction.targetLayer === 'fold' ? (pendingBiopsyAction.fasta || d.foldSeq) : null);
  });

  // Layer 1 controls (reset returns to THIS ORGANISM's native membrane physics!)
  el('sl-mem-eps').addEventListener('input', (e) => { params.memEpsHp = Number(e.target.value); el('val-mem-eps').textContent = params.memEpsHp.toFixed(2); activeSession?.setHydrophobicCoupling?.(params.memEpsHp); updatePlotsAndHud(); });
  el('sl-mem-temp').addEventListener('input', (e) => { params.memTempK = Number(e.target.value); el('val-mem-temp').textContent = `${Math.round(params.memTempK)} K`; activeSession?.setTemperatureK?.(params.memTempK); });
  el('sl-mem-osm').addEventListener('input', (e) => { params.memOsmotic = Number(e.target.value); el('val-mem-osm').textContent = params.memOsmotic.toFixed(2); activeSession?.setOsmoticPressure?.(params.memOsmotic); });
  el('sl-mem-clip')?.addEventListener('input', (e) => {
    params.memClipZ = Number(e.target.value);
    el('val-mem-clip').textContent = params.memClipZ >= 7.8 ? 'Full' : `${params.memClipZ.toFixed(1)} Å`;
    renderCurrentScene();
  });
  el('btn-mem-null').addEventListener('click', () => { params.memEpsHp = 0.0; el('sl-mem-eps').value = '0'; el('val-mem-eps').textContent = '0.00'; activeSession?.setHydrophobicCoupling?.(0.0); updatePlotsAndHud(); });
  el('btn-mem-reset').addEventListener('click', () => {
    syncParamsFromActiveOrganism();
    params.memClipZ = 8.0;
    if (el('sl-mem-clip')) { el('sl-mem-clip').value = '8.0'; el('val-mem-clip').textContent = 'Full'; }
    selectMode(currentMode);
  });

  // Layer 2 controls + 1-click FASTA Motif Presets
  el('btn-apply-seq').addEventListener('click', () => selectMode(currentMode, el('inp-seq').value.trim().toUpperCase()));
  document.querySelectorAll('#fold-preset-row [data-fold-seq]').forEach((b) => {
    b.addEventListener('click', () => {
      const seq = b.dataset.foldSeq;
      if (seq) {
        el('inp-seq').value = seq;
        void selectMode(currentMode, seq);
      }
    });
  });
  el('btn-p3-alt')?.addEventListener('click', async () => {
    if (currentLayer === 'fold') {
      foldShowContactMap = !foldShowContactMap;
      if (foldShowContactMap && activeSession) {
        lastFoldCoordsF32 = await readResidentFloats(activeSession.getResidentResiduesBuffer(), activeSession.residueCount * 12);
      }
    } else if (currentLayer === 'hh') {
      hhShowPhasePortrait = !hhShowPhasePortrait;
    }
    updatePlotsAndHud();
  });

  function buildLifeCsvString() {
    const headerMap = {
      membrane: 'step,mean_tail_coordination,radial_head_order,mean_radius',
      fold: 'step,radius_of_gyration_A,catalytic_rate_boost,hydrophobic_contacts',
      evo: 'step,mean_sequence_identity,quasispecies_fraction,mutation_rate_mu',
      hh: 'step,probe_voltage_mV,max_voltage_mV,g_Na_mS_cm2',
      morph: 'step,turing_pattern_std,chemotactic_enrichment,mean_agent_speed'
    };
    const header = headerMap[currentLayer] || 'step,m1,m2,m3';
    const rows = csvRows.length > 0 ? csvRows.map((r) => r.join(',')) : [`${activeSession?.stepIndex || 0},0,0,0`];
    return `${header}\n${rows.join('\n')}\n`;
  }

  async function buildLifeXyzString() {
    const info = getActivePickBufferInfo();
    if (!info || !info.buffer) return null;
    while (busy) await new Promise((r) => setTimeout(r, 8));
    const arr = await readResidentFloats(info.buffer, info.count * info.strideFloats);
    if (!arr) return null;
    const lines = [
      String(info.count),
      `ULG Life Lab | ${currentMode} (${currentLayer}) | step=${activeSession?.stepIndex || 0}`
    ];
    for (let i = 0; i < info.count; i += 1) {
      let sym = 'C';
      if (currentLayer === 'membrane') sym = (i % 3 === 0) ? 'P' : 'C';
      else if (currentLayer === 'fold') {
        const ch = params.foldSeq[i] || 'P';
        sym = ch === 'H' ? 'C' : (ch === '+' ? 'N' : (ch === '-' ? 'O' : 'S'));
      } else if (currentLayer === 'evo') sym = 'N';
      else if (currentLayer === 'morph') sym = 'O';
      const o = i * info.strideFloats;
      lines.push(`${sym.padEnd(2, ' ')}  ${arr[o].toFixed(6).padStart(11, ' ')}  ${arr[o + 1].toFixed(6).padStart(11, ' ')}  ${arr[o + 2].toFixed(6).padStart(11, ' ')}`);
    }
    return lines.join('\n') + '\n';
  }

  el('btn-export-csv')?.addEventListener('click', () => {
    triggerLifeDownload(`ulg-life-${currentMode}-trajectory.csv`, buildLifeCsvString(), 'text/csv;charset=utf-8');
  });
  el('btn-export-xyz')?.addEventListener('click', async () => {
    const xyz = await buildLifeXyzString();
    if (xyz) triggerLifeDownload(`ulg-life-${currentMode}.xyz`, xyz, 'chemical/x-xyz;charset=utf-8');
  });
  el('sl-fold-temp').addEventListener('input', (e) => { params.foldTempK = Number(e.target.value); el('val-fold-temp').textContent = `${Math.round(params.foldTempK)} K`; activeSession?.setTemperatureK?.(params.foldTempK); updatePlotsAndHud(); });
  el('sl-fold-eps').addEventListener('input', (e) => { params.foldEpsHp = Number(e.target.value); el('val-fold-eps').textContent = params.foldEpsHp.toFixed(2); activeSession?.setHydrophobicCoupling?.(params.foldEpsHp); });
  el('sl-fold-hb').addEventListener('input', (e) => { params.foldEpsHb = Number(e.target.value); el('val-fold-hb').textContent = params.foldEpsHb.toFixed(2); activeSession?.setHBondStrength?.(params.foldEpsHb); });
  el('btn-fold-denature').addEventListener('click', () => { params.foldTempK = 750; el('sl-fold-temp').value = '750'; el('val-fold-temp').textContent = '750 K'; activeSession?.setTemperatureK?.(750); updatePlotsAndHud(); });
  el('btn-fold-reset').addEventListener('click', () => {
    syncParamsFromActiveOrganism();
    selectMode(currentMode, activeOrganismDerived?.foldSeq || null);
  });

  // Layer 3 controls
  el('sl-evo-mu').addEventListener('input', (e) => { params.evoMu = Number(e.target.value); el('val-evo-mu').textContent = params.evoMu.toFixed(3); activeSession?.setMutationRateMu?.(params.evoMu); updatePlotsAndHud(); });
  el('sl-evo-beta').addEventListener('input', (e) => { params.evoBeta = Number(e.target.value); el('val-evo-beta').textContent = params.evoBeta.toFixed(2); activeSession?.setSelectionBeta?.(params.evoBeta); });
  el('sl-evo-fgc').addEventListener('input', (e) => { params.evoStrongFrac = Number(e.target.value); el('val-evo-fgc').textContent = params.evoStrongFrac.toFixed(2); updatePlotsAndHud(); });
  el('btn-evo-cat').addEventListener('click', () => { params.evoMu = 0.35; el('sl-evo-mu').value = '0.35'; el('val-evo-mu').textContent = '0.350'; activeSession?.setMutationRateMu?.(0.35); updatePlotsAndHud(); });
  el('btn-evo-reset').addEventListener('click', () => { syncParamsFromActiveOrganism(); selectMode(currentMode); });

  // Layer 4 controls
  el('sl-hh-gna').addEventListener('input', (e) => { params.hhGNa = Number(e.target.value); el('val-hh-gna').textContent = `${Math.round(params.hhGNa)} mS`; activeSession?.setGNa?.(params.hhGNa); updatePlotsAndHud(); });
  el('sl-hh-gk').addEventListener('input', (e) => { params.hhGK = Number(e.target.value); el('val-hh-gk').textContent = `${Math.round(params.hhGK)} mS`; activeSession?.setGK?.(params.hhGK); });
  const pushChem = () => { activeSession?.setChemiosmosis?.({ deltaPsiMv: params.hhDeltaPsi, deltaPh: params.hhDeltaPh, uncouplerLeak: params.hhUncouplerLeak }); updatePlotsAndHud(); };
  el('sl-hh-psi').addEventListener('input', (e) => { params.hhDeltaPsi = Number(e.target.value); el('val-hh-psi').textContent = `${Math.round(params.hhDeltaPsi)} mV`; pushChem(); });
  el('sl-hh-dph').addEventListener('input', (e) => { params.hhDeltaPh = Number(e.target.value); el('val-hh-dph').textContent = params.hhDeltaPh.toFixed(2); pushChem(); });
  el('sl-hh-leak').addEventListener('input', (e) => { params.hhUncouplerLeak = Number(e.target.value); el('val-hh-leak').textContent = params.hhUncouplerLeak.toFixed(2); pushChem(); });
  el('btn-hh-stim').addEventListener('click', () => activeSession?.triggerStimulus?.());
  el('btn-hh-ttx').addEventListener('click', () => { params.hhGNa = 0; el('sl-hh-gna').value = '0'; el('val-hh-gna').textContent = '0 mS'; activeSession?.setGNa?.(0); updatePlotsAndHud(); });
  el('btn-hh-reset').addEventListener('click', () => { params.hhUncouplerLeak = 0; el('sl-hh-leak').value = '0'; el('val-hh-leak').textContent = '0.00'; syncParamsFromActiveOrganism(); selectMode(currentMode); });

  // Layer 5 controls
  el('sl-m-v0').addEventListener('input', (e) => { params.morphV0 = Number(e.target.value); el('val-m-v0').textContent = params.morphV0.toFixed(2); activeSession?.setV0Propel?.(params.morphV0); });
  el('sl-m-chemo').addEventListener('input', (e) => { params.morphChemo = Number(e.target.value); el('val-m-chemo').textContent = params.morphChemo.toFixed(2); activeSession?.setChemoGain?.(params.morphChemo); updatePlotsAndHud(); });
  el('sl-m-ratio').addEventListener('input', (e) => { params.morphDiffRatio = Number(e.target.value); el('val-m-ratio').textContent = params.morphDiffRatio.toFixed(2); activeSession?.setDiffusionRatio?.(params.morphDiffRatio); });
  el('btn-m-null').addEventListener('click', () => { params.morphV0 = 0; params.morphChemo = 0; el('sl-m-v0').value = '0'; el('val-m-v0').textContent = '0.00'; el('sl-m-chemo').value = '0'; el('val-m-chemo').textContent = '0.00'; activeSession?.setV0Propel?.(0); activeSession?.setChemoGain?.(0); updatePlotsAndHud(); });
  el('btn-m-reset').addEventListener('click', () => { syncParamsFromActiveOrganism(); selectMode(currentMode); });

  el('btn-play').addEventListener('click', () => {
    paused = !paused;
    el('btn-play').textContent = paused ? '▶ Play' : '⏸ Pause';
    syncMobileContextBar();
  });
  el('about-btn').addEventListener('click', () => openAboutModal(false));
  el('menu-about-mode').addEventListener('click', () => { el('help-popover').classList.remove('open'); openAboutModal(false); });
  el('menu-about-lab').addEventListener('click', () => { el('help-popover').classList.remove('open'); openAboutModal(true); });
  el('modal-close').addEventListener('click', () => el('about-modal').classList.remove('open'));
  el('about-modal').addEventListener('click', (e) => { if (e.target === el('about-modal')) el('about-modal').classList.remove('open'); });
  el('help-btn').addEventListener('click', (e) => { e.stopPropagation(); el('help-popover').classList.toggle('open'); });
  document.addEventListener('click', (e) => {
    const pop = el('help-popover');
    if (pop?.classList.contains('open') && !pop.contains(e.target) && e.target !== el('help-btn')) {
      pop.classList.remove('open');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      el('help-popover')?.classList.remove('open');
      el('about-modal')?.classList.remove('open');
      closeMobileDrawers();
    }
  });
  el('toggle-plots-btn').addEventListener('click', () => {
    if (window.innerWidth <= 1020) {
      el('life-sidebar')?.classList.remove('mobile-open');
      const isOpen = el('life-dock')?.classList.toggle('mobile-open');
      el('mobile-drawer-backdrop')?.classList.toggle('open', Boolean(isOpen));
    } else {
      el('life-shell').classList.toggle('plots-collapsed');
    }
    handleResize();
  });
  el('mobile-nav-btn').addEventListener('click', () => {
    el('life-dock')?.classList.remove('mobile-open');
    const isOpen = el('life-sidebar')?.classList.toggle('mobile-open');
    el('mobile-drawer-backdrop')?.classList.toggle('open', Boolean(isOpen));
  });
  el('mobile-drawer-backdrop')?.addEventListener('click', closeMobileDrawers);
  el('mobile-sidebar-close')?.addEventListener('click', closeMobileDrawers);
  el('mobile-dock-close')?.addEventListener('click', closeMobileDrawers);

  let activeXenoProfile = null;
  async function applyXenobiologyProfile(profile, { targetMode = null } = {}) {
    if (!profile) return null;
    activeXenoProfile = profile;
    const lp = profile.labParams || profile.lifeLabParams || {};
    if (Number.isFinite(lp.memTempK)) { params.memTempK = lp.memTempK; if (el('sl-mem-temp')) { el('sl-mem-temp').value = String(params.memTempK); el('val-mem-temp').textContent = `${Math.round(params.memTempK)} K`; } }
    if (Number.isFinite(lp.memEpsHp)) { params.memEpsHp = lp.memEpsHp; if (el('sl-mem-eps')) { el('sl-mem-eps').value = String(params.memEpsHp); el('val-mem-eps').textContent = params.memEpsHp.toFixed(2); } }
    if (Number.isFinite(lp.memOsmotic)) { params.memOsmotic = lp.memOsmotic; if (el('sl-mem-osm')) { el('sl-mem-osm').value = String(params.memOsmotic); el('val-mem-osm').textContent = params.memOsmotic.toFixed(2); } }
    if (Number.isFinite(lp.foldTempK)) { params.foldTempK = lp.foldTempK; if (el('sl-fold-temp')) { el('sl-fold-temp').value = String(params.foldTempK); el('val-fold-temp').textContent = `${Math.round(params.foldTempK)} K`; } }
    if (Number.isFinite(lp.foldEpsHp)) { params.foldEpsHp = lp.foldEpsHp; if (el('sl-fold-eps')) { el('sl-fold-eps').value = String(params.foldEpsHp); el('val-fold-eps').textContent = params.foldEpsHp.toFixed(2); } }
    if (Number.isFinite(lp.foldEpsHb)) { params.foldEpsHb = lp.foldEpsHb; if (el('sl-fold-hb')) { el('sl-fold-hb').value = String(params.foldEpsHb); el('val-fold-hb').textContent = params.foldEpsHb.toFixed(2); } }
    if (lp.foldSeq) params.foldSeq = lp.foldSeq;
    if (Number.isFinite(lp.evoMu)) { params.evoMu = lp.evoMu; if (el('sl-evo-mu')) { el('sl-evo-mu').value = String(params.evoMu); el('val-evo-mu').textContent = params.evoMu.toFixed(3); } }
    if (Number.isFinite(lp.evoBeta)) { params.evoBeta = lp.evoBeta; if (el('sl-evo-beta')) { el('sl-evo-beta').value = String(params.evoBeta); el('val-evo-beta').textContent = params.evoBeta.toFixed(2); } }
    if (Number.isFinite(lp.hhDeltaPsi)) { params.hhDeltaPsi = lp.hhDeltaPsi; if (el('sl-hh-psi')) { el('sl-hh-psi').value = String(params.hhDeltaPsi); el('val-hh-psi').textContent = `${Math.round(params.hhDeltaPsi)} mV`; } }
    if (Number.isFinite(lp.hhDeltaPh)) { params.hhDeltaPh = lp.hhDeltaPh; if (el('sl-hh-dph')) { el('sl-hh-dph').value = String(params.hhDeltaPh); el('val-hh-dph').textContent = params.hhDeltaPh.toFixed(2); } }
    if (Number.isFinite(lp.morphV0)) { params.morphV0 = lp.morphV0; if (el('sl-m-v0')) { el('sl-m-v0').value = String(params.morphV0); el('val-m-v0').textContent = params.morphV0.toFixed(2); } }
    if (Number.isFinite(lp.morphChemo)) { params.morphChemo = lp.morphChemo; if (el('sl-m-chemo')) { el('sl-m-chemo').value = String(params.morphChemo); el('val-m-chemo').textContent = params.morphChemo.toFixed(2); } }
    const tempDispK = Math.round(lp.memTempK ?? profile.tempK ?? 288);
    const abd = profile.abductedSpecimen || null;
    if (el('val-xeno-solvent')) {
      el('val-xeno-solvent').textContent = abd
        ? `🛸 ${abd.speciesName} (${abd.kind}) · ${profile.solventFormula} · ${tempDispK} K`
        : `${profile.solventLabel} · ${tempDispK} K`;
    }
    if (el('xeno-world-summary')) {
      const biosig = (profile.redox?.biosignatures || []).slice(0, 2).join(' · ');
      el('xeno-world-summary').textContent = abd
        ? `🛸 ABDUCTED ${(abd.kingdom || abd.kind || 'fauna').toUpperCase()} (${abd.speciesName} · ${abd.morphClass}) from ${profile.worldName} (${Number(abd.latDeg || 0).toFixed(1)}°, ${Number(abd.lonDeg || 0).toFixed(1)}°) · ${profile.membraneType} · ${profile.xnaAlphabetSize || 4}-base ${profile.xnaBackbone || 'XNA'}`
        : `${profile.worldName}: ${profile.membraneType} · ${(profile.species || []).length} Clades · ${biosig || profile.civStage}`;
    }
    activeVivariumSpecimen = abd || (profile.species || []).find((s) => s.kingdom === 'fauna') || (profile.species || [])[0] || null;
    activeOrganPart = null;
    // Derive ALL 5 biophysical simulation layers directly from this specific living organism!
    const derived = syncParamsFromActiveOrganism();
    const modeToLoad = targetMode || (abd ? 'organism-overview' : (lp.recommendedMode || 'organism-overview'));
    await selectMode(modeToLoad, modeToLoad.includes('fold') || modeToLoad.includes('helix') || modeToLoad.includes('hairpin') ? derived.foldSeq : null);
    if (el('pill-name')) {
      el('pill-name').textContent = abd
        ? `🛸 ${abd.speciesName} · ${profile.worldName}`
        : `${derived.speciesName} · ${profile.worldName}`;
    }
    return profile;
  }

  document.querySelectorAll('#xeno-preset-row [data-xeno-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = XENOBIOLOGY_PLANET_PRESETS.find((p) => p.id === btn.dataset.xenoPreset);
      if (!preset) return;
      document.querySelectorAll('#xeno-preset-row [data-xeno-preset]').forEach((b) => b.classList.toggle('active', b === btn));
      const prof = deriveXenobiologyProfile(preset);
      void applyXenobiologyProfile(prof, { targetMode: preset.recommendedMode });
    });
  });

  const urlXeno = parseXenobiologyFromSearch(window.location.search);
  if (urlXeno?.profile) {
    await applyXenobiologyProfile(urlXeno.profile, { targetMode: urlXeno.mode });
  } else {
    // Always boot directly into a living macroscopic organism in the Bio-Aquarium so
    // every single cellular & molecular simulation examined comes from the organism itself!
    await applyXenobiologyProfile(deriveXenobiologyProfile(XENOBIOLOGY_PLANET_PRESETS[0]), { targetMode: 'organism-overview' });
  }

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
        foldShowContactMap,
        hhShowPhasePortrait,
        contactMapStats: { ...lastContactMapStats },
        xenobiology: activeXenoProfile,
        activeSpecimen: activeVivariumSpecimen,
        organismDerivedParams: activeOrganismDerived,
        csvRowCount: csvRows.length,
        telemetry: activeSession?.getTelemetry?.() || null,
        gpuErrorCount: gpuErrors.length,
        gpuErrors: [...gpuErrors],
        cameraAutoSpin: false
      };
    },
    async applyXenobiologyPreset(presetId) {
      const preset = XENOBIOLOGY_PLANET_PRESETS.find((p) => p.id === presetId);
      if (!preset) return null;
      await applyXenobiologyProfile(deriveXenobiologyProfile(preset), { targetMode: preset.recommendedMode });
      return api.getState();
    },
    setVivariumTool(tool) { setVivToolUi(tool); return vivTool; },
    selectVivariumSpecies(idx) {
      const prof = activeXenoProfile || deriveXenobiologyProfile(XENOBIOLOGY_PLANET_PRESETS[0]);
      const list = [];
      if (prof.abductedSpecimen) list.push(prof.abductedSpecimen);
      for (const s of (prof.species || [])) if (!list.some((c) => c.speciesName === s.speciesName)) list.push(s);
      const chosen = list[Math.max(0, Math.min(list.length - 1, Number(idx) || 0))];
      if (chosen) {
        activeVivariumSpecimen = chosen;
        activeOrganPart = null;
        syncParamsFromActiveOrganism();
        return selectMode('organism-overview').then(() => api.getState());
      }
      return Promise.resolve(api.getState());
    },
    interactVivarium(tool = vivTool, partId = null) {
      if (currentLayer !== 'vivarium' || !activeSession) return null;
      setVivToolUi(tool);
      const partObj = partId ? { id: partId, center: [...activeSession.state.pos], point: [...activeSession.state.pos] } : { id: 'head', center: [...activeSession.state.pos], point: [...activeSession.state.pos] };
      return handleVivariumPartInteraction(tool, partObj, partObj.point);
    },
    async selectMode(modeId, customSeq = null) { await selectMode(modeId, customSeq); return api.getState(); },
    setParams(patch = {}) {
      Object.assign(params, patch);
      if (currentLayer === 'membrane') {
        if ('memEpsHp' in patch) { el('sl-mem-eps').value = String(params.memEpsHp); el('val-mem-eps').textContent = params.memEpsHp.toFixed(2); activeSession?.setHydrophobicCoupling?.(params.memEpsHp); }
        if ('memTempK' in patch) { el('sl-mem-temp').value = String(params.memTempK); el('val-mem-temp').textContent = `${Math.round(params.memTempK)} K`; activeSession?.setTemperatureK?.(params.memTempK); }
        if ('memOsmotic' in patch) { el('sl-mem-osm').value = String(params.memOsmotic); el('val-mem-osm').textContent = params.memOsmotic.toFixed(2); activeSession?.setOsmoticPressure?.(params.memOsmotic); }
        if ('memClipZ' in patch && el('sl-mem-clip')) { el('sl-mem-clip').value = String(params.memClipZ); el('val-mem-clip').textContent = params.memClipZ >= 7.8 ? 'Full' : `${params.memClipZ.toFixed(1)} Å`; renderCurrentScene(); }
      } else if (currentLayer === 'fold') {
        if ('foldTempK' in patch) { el('sl-fold-temp').value = String(params.foldTempK); el('val-fold-temp').textContent = `${Math.round(params.foldTempK)} K`; activeSession?.setTemperatureK?.(params.foldTempK); }
        if ('foldEpsHp' in patch) { el('sl-fold-eps').value = String(params.foldEpsHp); el('val-fold-eps').textContent = params.foldEpsHp.toFixed(2); activeSession?.setHydrophobicCoupling?.(params.foldEpsHp); }
        if ('foldEpsHb' in patch) { el('sl-fold-hb').value = String(params.foldEpsHb); el('val-fold-hb').textContent = params.foldEpsHb.toFixed(2); activeSession?.setHBondStrength?.(params.foldEpsHb); }
      } else if (currentLayer === 'evo') {
        if ('evoMu' in patch) { el('sl-evo-mu').value = String(params.evoMu); el('val-evo-mu').textContent = params.evoMu.toFixed(3); activeSession?.setMutationRateMu?.(params.evoMu); }
        if ('evoBeta' in patch) { el('sl-evo-beta').value = String(params.evoBeta); el('val-evo-beta').textContent = params.evoBeta.toFixed(2); activeSession?.setSelectionBeta?.(params.evoBeta); }
      } else if (currentLayer === 'hh') {
        if ('hhGNa' in patch) { el('sl-hh-gna').value = String(params.hhGNa); el('val-hh-gna').textContent = `${Math.round(params.hhGNa)} mS`; activeSession?.setGNa?.(params.hhGNa); }
        if ('hhGK' in patch) { el('sl-hh-gk').value = String(params.hhGK); el('val-hh-gk').textContent = `${Math.round(params.hhGK)} mS`; activeSession?.setGK?.(params.hhGK); }
        if ('hhDeltaPsi' in patch || 'hhDeltaPh' in patch || 'hhUncouplerLeak' in patch) {
          if ('hhDeltaPsi' in patch) { el('sl-hh-psi').value = String(params.hhDeltaPsi); el('val-hh-psi').textContent = `${Math.round(params.hhDeltaPsi)} mV`; }
          if ('hhDeltaPh' in patch) { el('sl-hh-dph').value = String(params.hhDeltaPh); el('val-hh-dph').textContent = params.hhDeltaPh.toFixed(2); }
          if ('hhUncouplerLeak' in patch) { el('sl-hh-leak').value = String(params.hhUncouplerLeak); el('val-hh-leak').textContent = params.hhUncouplerLeak.toFixed(2); }
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
    exportCsv: () => buildLifeCsvString(),
    exportXyz: () => buildLifeXyzString(),
    getContactMapStats: () => ({ ...lastContactMapStats }),
    async setPlot3AltMode({ foldContactMap, hhPhasePortrait } = {}) {
      if (typeof foldContactMap === 'boolean') foldShowContactMap = foldContactMap;
      if (typeof hhPhasePortrait === 'boolean') hhShowPhasePortrait = hhPhasePortrait;
      if (currentLayer === 'fold' && foldShowContactMap && activeSession) {
        lastFoldCoordsF32 = await readResidentFloats(activeSession.getResidentResiduesBuffer(), activeSession.residueCount * 12);
      }
      updatePlotsAndHud();
      return api.getState();
    },
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
      activeSession?.dispose?.();
      gpuPicker.dispose();
      if (activePiCloud?.buffer) try { activePiCloud.buffer.destroy(); } catch {}
      if (readbackStagingBuf) try { readbackStagingBuf.destroy(); } catch {}
      if (vivSolidBuf) try { vivSolidBuf.destroy(); } catch {}
      if (vivGlassBuf) try { vivGlassBuf.destroy(); } catch {}
      if (vivBeadsBuf) try { vivBeadsBuf.destroy(); } catch {}
      renderer.dispose();
    }
  };
  window.__ulgLifeLab = api;
  return api;
}
