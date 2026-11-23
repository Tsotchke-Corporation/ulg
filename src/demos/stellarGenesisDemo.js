import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { createUlgTaskCapsule, ULG_SERVICE_IDS, ULG_TASK_KINDS } from '../../ulg-gpu-abi/src/serviceContract.js';
import { ArtifactCache } from '../runtime/ArtifactCache.js';
import { ClosureRegistry } from '../runtime/ClosureRegistry.js';
import { createSimulationModuleRegistry } from '../runtime/simulationModuleRegistry.js';
import { createZeroCopyResidentBodyPresenter } from '../runtime/residentGpuPresenter.js';
import {
  buildAtomicRadialDensityArtifact,
  buildMolecularChargeDensityArtifact
} from '../runtime/electronicStructure/quantumDerivationArtifacts.js';
import { BOHR_TO_M } from '../runtime/electronicStructure/uniformElectronGas.js';
import { createCosmicQuantumScaleBridge } from '../runtime/sph/cosmicQuantumScaleBridge.js';
import {
  HYDRO_PARTICLE_STRIDE_FLOATS,
  createSelfGravitatingHydroEngine,
  createSelfGravitatingHydroModuleRegistration
} from '../runtime/sph/selfGravitatingHydroGpu.js';
import { registerPlasmaFusionClosureArtifact } from '../runtime/astrophysics/hydrogenStellarClosure.js';
import {
  NEBULA_INITIAL_CONDITIONS,
  createHydrogenNebulaInitialBodies
} from '../runtime/astrophysics/nebulaInitialConditions.js';
import {
  createVolumetricDensityGridRaymarcher,
  createVolumetricOrbitalRaymarcher
} from './volumetricOrbitalRaymarcher.js';

const ZOOM_STOPS = Object.freeze([
  { id: 'quantum-core', log10: -10.8, label: '10⁻¹¹m Quantum H₂ / H' },
  { id: 'stellar-core', log10: 9.2, label: '10⁹m Stellar Core' },
  { id: 'protoplanetary-disk', log10: 12.6, label: '10¹²m Disk & Envelope' },
  { id: 'molecular-nebula', log10: 16.4, label: '10¹⁷m Molecular Nebula' }
]);

const STAGE_BADGE_COLORS = Object.freeze({
  'molecular-nebula': '#a78bfa',
  'larson-core': '#fb923c',
  'h2-dissociation': '#f97316',
  'saha-protostar': '#fbbf24',
  'fusion-ignition': '#fde047',
  'main-sequence': '#fef08a',
  'helium-burning': '#fb7185',
  supernova: '#22d3ee',
  'neutron-star': '#38bdf8',
  'black-hole': '#c084fc'
});

function formatSpanM(spanM) {
  if (!(spanM > 0) || !Number.isFinite(spanM)) return '—';
  if (spanM < 1e-9) return `${(spanM * 1e12).toFixed(1)} pm (${(spanM / BOHR_TO_M).toFixed(2)} a₀)`;
  if (spanM < 1e-6) return `${(spanM * 1e9).toFixed(2)} nm`;
  if (spanM < 1e3) return `${spanM.toFixed(1)} m`;
  if (spanM < 1e9) return `${(spanM / 1e3).toFixed(0)} km`;
  if (spanM < 1e12) return `${(spanM / 6.957e8).toFixed(1)} R☉`;
  if (spanM < 1e15) return `${(spanM / 1.495978707e11).toFixed(1)} AU`;
  return `${(spanM / 9.4607304725808e15).toFixed(2)} ly`;
}

function formatTempK(T) {
  if (!Number.isFinite(T)) return '—';
  if (T < 1e4) return `${Math.round(T).toLocaleString()} K`;
  if (T < 1e6) return `${(T / 1e3).toFixed(1)}×10³ K`;
  if (T < 1e9) return `${(T / 1e6).toFixed(2)} MK`;
  return `${(T / 1e9).toFixed(2)} GK`;
}

function formatSci(v, unit = '') {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return `0${unit ? ' ' + unit : ''}`;
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const mant = v / Math.pow(10, exp);
  return `${mant.toFixed(2)}×10^${exp}${unit ? ' ' + unit : ''}`;
}

function buildGamowWindowSvg(tel) {
  const w = 286;
  const h = 84;
  const T = Math.max(10, tel?.coreTempK || 25);
  const kTKeV = T * 8.617333262e-8;
  const EgKeV = 493.0;
  const peakKeV = tel?.gamowPeakKeV > 0 ? tel.gamowPeakKeV : 1.22 * Math.pow(Math.max(1e-4, T * 1e-6), 2 / 3);
  const active = T >= 1.2e6;

  if (!active) {
    const subLabel = T < 1200
      ? 'Molecular H₂ bound (T ≪ 10⁶ K · zero tunneling)'
      : T < 8000
        ? 'H₂ dissociating (CAS(2,2) D_e) · sub-fusion'
        : 'Saha H⁺ plasma · compressing toward Gamow window';
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:84px;display:block;background:rgba(4,10,20,0.82);border-radius:7px;border:1px solid rgba(148,163,184,0.22);">
      <line x1="12" y1="${h - 14}" x2="${w - 12}" y2="${h - 14}" stroke="rgba(148,163,184,0.3)" stroke-width="1" />
      <path d="M 14 ${h - 15} Q 65 ${h - 58}, 140 ${h - 16} L ${w - 14} ${h - 15}" fill="rgba(251,191,36,0.16)" stroke="#fbbf24" stroke-width="1.3" />
      <path d="M 175 ${h - 15} Q 230 ${h - 24}, ${w - 14} 18" fill="none" stroke="#38bdf8" stroke-dasharray="3,2" stroke-width="1.3" />
      <text x="12" y="14" fill="#cbd5e1" font-size="9.5" font-family="monospace">Gamow Tunneling Window (p + p → ²H + e⁺ + ν)</text>
      <text x="12" y="27" fill="#94a3b8" font-size="8.8" font-family="monospace">${subLabel}</text>
      <text x="12" y="${h - 3}" fill="#64748b" font-size="8" font-family="monospace">Thermal kT=${(kTKeV * 1e3).toFixed(2)} eV · Barrier E_G=493 keV</text>
    </svg>`;
  }

  const eMax = Math.max(18, Math.min(260, peakKeV * 3.1));
  const steps = 48;
  const mbPts = [];
  const tunPts = [];
  const gamVals = [];
  let gamMax = 1e-300;
  for (let i = 1; i <= steps; i += 1) {
    const e = (i / steps) * eMax;
    const x = 12 + (i / steps) * (w - 24);
    const mb = Math.exp(-Math.min(50, e / Math.max(1e-3, kTKeV)));
    const tun = Math.exp(-Math.min(60, Math.sqrt(EgKeV / Math.max(0.05, e))));
    const g = mb * tun;
    if (g > gamMax) gamMax = g;
    gamVals.push({ x, g });
    mbPts.push(`${x.toFixed(1)},${(h - 14 - Math.min(1, mb) * (h - 32)).toFixed(1)}`);
    const tunNorm = Math.pow(Math.min(1, tun / Math.max(1e-20, Math.exp(-Math.sqrt(EgKeV / eMax)))), 0.35);
    tunPts.push(`${x.toFixed(1)},${(h - 14 - tunNorm * (h - 34)).toFixed(1)}`);
  }
  const gamPts = gamVals.map((p) => {
    const yn = Math.max(0, Math.min(1, p.g / Math.max(1e-300, gamMax)));
    return `${p.x.toFixed(1)},${(h - 14 - yn * (h - 34)).toFixed(1)}`;
  }).join(' ');
  const peakX = 12 + Math.min(1, peakKeV / eMax) * (w - 24);

  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:84px;display:block;background:rgba(4,12,22,0.86);border-radius:7px;border:1px solid rgba(52,211,153,0.42);">
    <line x1="12" y1="${h - 14}" x2="${w - 12}" y2="${h - 14}" stroke="rgba(148,163,184,0.28)" stroke-width="1" />
    <polyline fill="none" stroke="#fbbf24" stroke-width="1.2" opacity="0.72" points="${mbPts.join(' ')}" />
    <polyline fill="none" stroke="#38bdf8" stroke-width="1.2" opacity="0.75" points="${tunPts.join(' ')}" />
    <polygon fill="rgba(52,211,153,0.34)" stroke="#34d399" stroke-width="1.8" points="12,${h - 14} ${gamPts} ${w - 12},${h - 14}" />
    <line x1="${peakX.toFixed(1)}" y1="18" x2="${peakX.toFixed(1)}" y2="${h - 14}" stroke="#fef08a" stroke-dasharray="2,2" stroke-width="1.1" />
    <text x="10" y="13" fill="#6ee7b7" font-size="9.5" font-family="monospace">ACTIVE GAMOW PEAK · E₀=${peakKeV.toFixed(1)} keV</text>
    <text x="10" y="${h - 3}" fill="#94a3b8" font-size="8" font-family="monospace">kT=${kTKeV.toFixed(2)} keV · ε=${formatSci(tel.peakEpsNucWPerKg, 'W/kg')}</text>
  </svg>`;
}

function createStarfieldBackdrop() {
  const count = 1100;
  const geo = new THREE.OctahedronGeometry(0.32, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let seed = 88421;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i += 1) {
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const R = 140 + rnd() * 110;
    dummy.position.set(R * s * Math.cos(th), R * u, R * s * Math.sin(th));
    dummy.scale.setScalar(0.35 + rnd() * 0.85);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    const t = rnd();
    col.setRGB(t > 0.7 ? 0.96 : 0.65, t > 0.3 ? 0.84 : 0.72, 1.0);
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/**
 * Mount the Stellar Genesis Multiscale Demo onto `container`.
 * Strictly GPU-native & Star Spec compliant — ZERO scripted props, ZERO origin-pinned
 * sprites, ZERO preset visual hacks, ZERO CPU mirror solver:
 *   - `ClosureRegistry` + `ArtifactCache` (quantum-derived 2D plasma EOS & opacity table)
 *   - `self-gravitating-hydro@1` (`src/runtime/sph/selfGravitatingHydroGpu.js`)
 *   - `createCosmicQuantumScaleBridge` (`src/runtime/sph/cosmicQuantumScaleBridge.js`)
 *   - `createZeroCopyResidentBodyPresenter` (`src/runtime/residentGpuPresenter.js`)
 *   - `createVolumetricOrbitalRaymarcher` + `createVolumetricDensityGridRaymarcher`
 */
export async function mountStellarGenesisDemo(container) {
  const root = document.createElement('div');
  root.id = 'ulg-stellar-genesis-root';
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:#03060f',
    'color:#e2f1ec',
    'font-family:"Inter",system-ui,-apple-system,sans-serif',
    'overflow:hidden',
    'user-select:none'
  ].join(';');
  container.innerHTML = '';
  container.appendChild(root);

  const canvasHost = document.createElement('div');
  canvasHost.style.cssText = 'position:absolute;inset:0;';
  root.appendChild(canvasHost);

  const urlParams = new URLSearchParams(window.location.search);
  let activePresetId = NEBULA_INITIAL_CONDITIONS[urlParams.get('preset')]
    ? urlParams.get('preset')
    : 'solar-nebula';
  const rawZoom = urlParams.get('scale');
  let targetLog10Span = rawZoom !== null && Number.isFinite(Number(rawZoom)) ? Number(rawZoom) : 16.0;
  let currentLog10Span = targetLog10Span;
  let timeScale = Number(urlParams.get('speed')) || 4.0;
  if (!Number.isFinite(timeScale) || timeScale < 0.5 || timeScale > 25) timeScale = 4.0;
  let simRunning = urlParams.get('paused') !== '1';

  // Acquire shared WebGPU GPUDevice (fail closed when unavailable — zero CPU fallback)
  let gpuDevice = null;
  let gpuAdapterName = 'WebGPU unavailable';
  try {
    const adapter = await navigator.gpu?.requestAdapter?.({ powerPreference: 'high-performance' });
    if (adapter) {
      gpuDevice = await adapter.requestDevice();
      gpuAdapterName = adapter.info?.description || adapter.info?.vendor || 'WebGPU GPU';
    }
  } catch {
    gpuDevice = null;
  }

  if (!gpuDevice) {
    root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;">
        <div style="max-width:460px;padding:20px 24px;border-radius:12px;background:rgba(12,18,32,0.92);border:1px solid rgba(248,113,113,0.45);color:#fecaca;">
          <h2 style="margin:0 0 8px 0;font-size:16px;">WebGPU Required</h2>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#e2e8f0;">
            Stellar Genesis executes ULG's GPU-native <code>self-gravitating-hydro@1</code> solver with zero-copy WebGPU presentation. Enable WebGPU in a supported browser to run this simulation.
          </p>
        </div>
      </div>`;
    return null;
  }

  const renderer = new THREE.WebGPURenderer({ antialias: true, device: gpuDevice });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x03060f, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;
  await renderer.init();
  const rendererBackend = 'three-webgpu';
  canvasHost.appendChild(renderer.domElement);

  const zeroCopyActive = Boolean(renderer.isWebGPURenderer);
  const particleCount = 8192;

  // 1. Register quantum-derived 2D plasma EOS & opacity closure in ULG's ClosureRegistry
  const artifactCache = new ArtifactCache();
  const closureRegistry = new ClosureRegistry({ artifactCache });
  const registeredClosure = await registerPlasmaFusionClosureArtifact({ closureRegistry });

  // 2. Instantiate ULG's general GPU-native self-gravitating hydro module (ZERO preset flags!)
  const initialBodies0 = createHydrogenNebulaInitialBodies({
    count: particleCount,
    preset: activePresetId,
    seed: 1939
  });
  const engine = createSelfGravitatingHydroEngine({
    device: gpuDevice,
    initialBodies: initialBodies0,
    eosClosureTable: registeredClosure.table,
    label: 'ulg-stellar-genesis-sgh'
  });

  const moduleRegistry = createSimulationModuleRegistry();
  moduleRegistry.registerModule(createSelfGravitatingHydroModuleRegistration({
    engine,
    zeroCopy: zeroCopyActive
  }));
  const scaleBridge = createCosmicQuantumScaleBridge({ moduleRegistry });

  // ---- 3D Scene Assembly (100% live GPU physics + real derived quantum volumes) ----
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.01, 600);
  let camYaw = 0.55;
  let camPitch = 0.34;

  const ambientLight = new THREE.AmbientLight(0x8bb6d9, 0.72);
  const keyLight = new THREE.DirectionalLight(0xfff4dc, 1.7);
  keyLight.position.set(16, 20, 14);
  scene.add(ambientLight, keyLight);
  scene.add(createStarfieldBackdrop());

  // Group A: Astrophysical Scale Scene (10^17 m -> 10^8 m) — ONLY live GPU particles!
  const astroGroup = new THREE.Group();
  scene.add(astroGroup);

  const presenter = createZeroCopyResidentBodyPresenter({
    THREE,
    TSL,
    renderer,
    bodyCount: engine.count,
    strideFloats: HYDRO_PARTICLE_STRIDE_FLOATS,
    palette: 'blackbody-thermo',
    initialBuffer: engine.getResidentBuffer()
  });
  astroGroup.add(presenter.mesh);

  // Group B: Quantum Hydrogen Microscope (10^-11 m) — genuine derived RHF H2 & KS H volumes!
  const quantumGroup = new THREE.Group();
  quantumGroup.visible = false;
  scene.add(quantumGroup);

  const hArtifact = buildAtomicRadialDensityArtifact(1, {
    functional: 'pbe',
    scalarRelativistic: true,
    spinOrbit: false,
    gridPointsN: 360,
    cloudGridDim: 16,
    maxGridDim: 24
  }).artifact;
  const hOrbitalRaymarcher = createVolumetricOrbitalRaymarcher({
    THREE,
    TSL,
    renderer,
    radialSamples: hArtifact.radialProfile.samples || [],
    rMaxBohr: hArtifact.radialProfile.rMaxBohr || 8.0,
    r95Bohr: hArtifact.summary.containmentRadii.r95Bohr || 3.2,
    modeId: 'total-density',
    boxHalfExtent: 4.8,
    dim: 40
  });
  quantumGroup.add(hOrbitalRaymarcher.mesh);

  const h2Built = buildMolecularChargeDensityArtifact([
    { Z: 1, position: [-0.70, 0, 0] },
    { Z: 1, position: [0.70, 0, 0] }
  ], {
    formula: 'H2',
    basis: '6-31g',
    gridDim: 20
  });
  const h2DensityKey = h2Built.artifact.grid.payloadHandles.chargeDensity.key;
  const h2VolumeRaymarcher = createVolumetricDensityGridRaymarcher({
    THREE,
    TSL,
    renderer,
    densityGrid: h2Built.densePayloads[h2DensityKey],
    dimensions: h2Built.artifact.grid.dimensions,
    boxHalfExtent: 4.8,
    provenance: 'molecular-rhf-h2-charge-density'
  });
  quantumGroup.add(h2VolumeRaymarcher.mesh);

  // ---- HUD & Interactive Controls ----
  const topBar = document.createElement('div');
  topBar.style.cssText = 'position:absolute;top:14px;left:16px;right:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;pointer-events:none;z-index:10;';
  topBar.innerHTML = `
    <div style="pointer-events:auto;display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:10px;background:rgba(5,11,22,0.86);border:1px solid rgba(56,189,248,0.30);backdrop-filter:blur(10px);">
      <span id="sg-stage-dot" style="width:10px;height:10px;border-radius:50%;background:#a78bfa;box-shadow:0 0 12px #a78bfa;"></span>
      <div>
        <div id="sg-stage-title" style="font-size:13px;font-weight:700;letter-spacing:0.01em;color:#f8fafc;">Cold Molecular H₂ Nebula</div>
        <div id="sg-scale-readout" style="font-size:11px;font-family:monospace;color:#7dd3fc;">10^16.0 m · self-gravitating-hydro@1</div>
      </div>
    </div>
    <div style="pointer-events:auto;display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
      ${Object.values(NEBULA_INITIAL_CONDITIONS).map((p) =>
        `<button type="button" data-sg-preset="${p.id}" style="padding:7px 11px;border-radius:8px;border:1px solid ${p.id === activePresetId ? '#38bdf8' : 'rgba(148,163,184,0.3)'};background:${p.id === activePresetId ? 'rgba(14,116,144,0.45)' : 'rgba(10,18,32,0.86)'};color:#f0f9ff;font-size:12px;font-weight:600;cursor:pointer;">${p.shortLabel}</button>`
      ).join('')}
      <button id="sg-speed-btn" type="button" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(52,211,153,0.4);background:rgba(6,40,36,0.84);color:#6ee7b7;font-size:12px;font-weight:600;font-family:monospace;cursor:pointer;">${timeScale}×</button>
      <button id="sg-play-btn" type="button" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(148,163,184,0.35);background:rgba(12,22,34,0.86);color:#e2e8f0;font-size:12px;font-weight:600;cursor:pointer;">${simRunning ? '⏸ Pause' : '▶ Play'}</button>
      <button id="sg-reset-btn" type="button" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(148,163,184,0.35);background:rgba(12,22,34,0.86);color:#cbd5e1;font-size:12px;font-weight:600;cursor:pointer;">↺ Reset</button>
      <a href="./cosmic-quantum.html" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(94,234,212,0.4);background:rgba(14,42,46,0.85);color:#99f6e4;font-size:12px;font-weight:600;text-decoration:none;">Cosmic ↔ Quantum ↗</a>
      <a href="./" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(251,191,36,0.4);background:rgba(38,24,10,0.85);color:#fde68a;font-size:12px;font-weight:600;text-decoration:none;">SPH Lab ↗</a>
    </div>
  `;
  root.appendChild(topBar);

  const sidePanel = document.createElement('aside');
  sidePanel.id = 'sg-inspector';
  sidePanel.style.cssText = 'position:absolute;top:72px;right:16px;width:336px;max-height:calc(100vh - 176px);overflow-x:hidden;overflow-y:auto;word-break:break-word;padding:13px 14px;border-radius:12px;background:rgba(5,11,22,0.86);border:1px solid rgba(148,186,210,0.24);backdrop-filter:blur(12px);font-size:12px;line-height:1.45;z-index:10;display:flex;flex-direction:column;gap:9px;';
  root.appendChild(sidePanel);

  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = 'position:absolute;left:16px;right:16px;bottom:14px;padding:10px 14px;border-radius:12px;background:rgba(5,11,22,0.88);border:1px solid rgba(56,189,248,0.24);backdrop-filter:blur(10px);z-index:10;display:flex;flex-direction:column;gap:8px;';
  bottomBar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:11px;font-family:monospace;color:#94a3b8;white-space:nowrap;">10⁻¹¹ m (H₂ / H)</span>
      <input id="sg-zoom-slider" type="range" min="-11.0" max="16.8" step="0.05" value="${currentLog10Span}" style="flex:1;accent-color:#38bdf8;cursor:pointer;" />
      <span style="font-size:11px;font-family:monospace;color:#94a3b8;white-space:nowrap;">10¹⁷ m (Nebula)</span>
    </div>
    <div id="sg-zoom-pills" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:space-between;"></div>
  `;
  root.appendChild(bottomBar);

  const pillsHost = bottomBar.querySelector('#sg-zoom-pills');
  const zoomButtons = new Map();
  for (const stop of ZOOM_STOPS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.sgZoom = stop.id;
    btn.textContent = stop.label;
    btn.style.cssText = 'flex:1;min-width:130px;padding:5px 8px;border-radius:7px;border:1px solid rgba(148,163,184,0.25);background:rgba(10,20,34,0.78);color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;';
    btn.addEventListener('click', () => { targetLog10Span = stop.log10; });
    pillsHost.appendChild(btn);
    zoomButtons.set(stop.id, btn);
  }

  const stageDotEl = topBar.querySelector('#sg-stage-dot');
  const stageTitleEl = topBar.querySelector('#sg-stage-title');
  const scaleReadoutEl = topBar.querySelector('#sg-scale-readout');
  const speedBtn = topBar.querySelector('#sg-speed-btn');
  const playBtn = topBar.querySelector('#sg-play-btn');
  const resetBtn = topBar.querySelector('#sg-reset-btn');
  const zoomSlider = bottomBar.querySelector('#sg-zoom-slider');

  function highlightPresetButtons() {
    for (const btn of topBar.querySelectorAll('[data-sg-preset]')) {
      const active = btn.dataset.sgPreset === activePresetId;
      btn.style.borderColor = active ? '#38bdf8' : 'rgba(148,163,184,0.3)';
      btn.style.background = active ? 'rgba(14,116,144,0.45)' : 'rgba(10,18,32,0.86)';
    }
  }

  function selectPreset(presetId) {
    if (!NEBULA_INITIAL_CONDITIONS[presetId]) return;
    activePresetId = presetId;
    const nextBodies = createHydrogenNebulaInitialBodies({
      count: engine.count,
      preset: activePresetId,
      seed: 1939
    });
    engine.resetBodies(nextBodies);
    presenter.bindResidentBuffer(engine.getResidentBuffer());
    highlightPresetButtons();
    renderInspectorPanel();
  }

  for (const btn of topBar.querySelectorAll('[data-sg-preset]')) {
    btn.addEventListener('click', () => selectPreset(btn.dataset.sgPreset));
  }
  const SPEED_CYCLE = [1.0, 4.0, 12.0];
  speedBtn.addEventListener('click', () => {
    const idx = SPEED_CYCLE.findIndex((s) => Math.abs(s - timeScale) < 0.25);
    timeScale = SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length];
    speedBtn.textContent = `${timeScale}×`;
  });
  playBtn.addEventListener('click', () => {
    simRunning = !simRunning;
    playBtn.textContent = simRunning ? '⏸ Pause' : '▶ Play';
  });
  resetBtn.addEventListener('click', () => selectPreset(activePresetId));
  zoomSlider.addEventListener('input', () => { targetLog10Span = Number(zoomSlider.value); });

  let dragging = false;
  let lastPtrX = 0;
  let lastPtrY = 0;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    camYaw -= (e.clientX - lastPtrX) * 0.006;
    camPitch = Math.max(-1.25, Math.min(1.25, camPitch + (e.clientY - lastPtrY) * 0.006));
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
  });
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetLog10Span = Math.max(-11.0, Math.min(16.8, targetLog10Span + e.deltaY * 0.004));
  }, { passive: false });

  function renderInspectorPanel() {
    const tel = engine.getTelemetry();
    const q = engine.anchors;
    const cfg = NEBULA_INITIAL_CONDITIONS[activePresetId];
    const camState = scaleBridge.evaluateContinuousZoomCamera(currentLog10Span);
    const pStats = presenter.getStats();
    const stageColor = STAGE_BADGE_COLORS[tel.stage.id] || '#38bdf8';

    stageDotEl.style.background = stageColor;
    stageDotEl.style.boxShadow = `0 0 12px ${stageColor}`;
    stageTitleEl.textContent = tel.stage.label;
    scaleReadoutEl.textContent = `10^${currentLog10Span.toFixed(1)} m (${formatSpanM(Math.pow(10, currentLog10Span))}) · Chart L=${camState.primaryRegime.globalBaseLevel} · ${engine.totalMassSolar.toFixed(1)} M☉`;

    const hPct = Math.max(0, Math.min(100, tel.coreXH * 100));
    const zPct = Math.max(0, Math.min(100 - hPct, tel.coreXZ * 100));
    const hePct = Math.max(0, 100 - hPct - zPct);
    const gammaWarn = tel.coreGammaEff < 4 / 3;

    const remnantHtml = tel.supernovaTriggered
      ? `<div style="padding:6px 8px;border-radius:6px;background:rgba(192,132,252,0.16);border:1px solid rgba(192,132,252,0.45);font-family:monospace;font-size:11px;color:#e9d5ff;">
          <b>REMNANT:</b> ${tel.remnantClass === 'black-hole' ? 'Stellar Black Hole' : 'Neutron Star'} · r_s=${(tel.schwarzschildRadiusM / 1000).toFixed(1)} km · Bounce pts=${tel.nuclearBounceCount}
        </div>`
      : '';

    sidePanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;letter-spacing:0.04em;font-size:11px;text-transform:uppercase;color:#94a3b8;">General ULG Runtime Laws</span>
        <span style="padding:2px 6px;border-radius:4px;background:rgba(56,189,248,0.16);color:#7dd3fc;font-family:monospace;font-size:10px;">${engine.count.toLocaleString()} pts</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;line-height:1.4;">${cfg.description}</div>
      ${remnantHtml}
      <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:7px;font-family:monospace;font-size:11px;color:#cbd5e1;line-height:1.55;">
        <div style="color:#5eead4;font-weight:700;margin-bottom:2px;">Live Emergent Core State</div>
        Core T: <span style="color:${stageColor};font-weight:700;">${formatTempK(tel.coreTempK)}</span> · ρ: ${formatSci(tel.coreRhoKgM3, 'kg/m³')}<br/>
        γ_eff: <span style="color:${gammaWarn ? '#fb923c' : '#6ee7b7'};font-weight:700;">${tel.coreGammaEff.toFixed(2)}${gammaWarn ? ' (<4/3 COLLAPSE)' : ''}</span> · μ=${tel.coreMu.toFixed(2)}<br/>
        Core H₂: ${(tel.coreFH2 * 100).toFixed(1)}% · Ionized H⁺: ${(tel.coreXIonized * 100).toFixed(1)}%<br/>
        Fusing pts: <span style="color:#fde047;">${tel.fusingCount.toLocaleString()}</span> · P_deg/P: ${(tel.corePDegFraction * 100).toFixed(1)}%
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-family:monospace;font-size:10px;color:#94a3b8;margin-bottom:3px;">
          <span>Core Nucleons (Σ=${tel.nucleonSum.toFixed(4)})</span>
          <span>H ${hPct.toFixed(0)}% · He ${hePct.toFixed(0)}% · Z ${zPct.toFixed(0)}%</span>
        </div>
        <div style="height:8px;border-radius:4px;overflow:hidden;display:flex;background:#0f172a;border:1px solid rgba(148,163,184,0.25);">
          <div style="width:${hPct.toFixed(1)}%;background:#38bdf8;"></div>
          <div style="width:${hePct.toFixed(1)}%;background:#fbbf24;"></div>
          <div style="width:${zPct.toFixed(1)}%;background:#c084fc;"></div>
        </div>
      </div>
      ${buildGamowWindowSvg(tel)}
      <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:7px;font-family:monospace;font-size:10.5px;color:#94a3b8;line-height:1.5;">
        <div style="color:#a5b4fc;font-weight:700;margin-bottom:2px;">Composed ULG Subsystems</div>
        Module: <span style="color:#7dd3fc;">self-gravitating-hydro@1</span> (preset-free)<br/>
        ClosureRegistry: <span style="color:#6ee7b7;">${registeredClosure.artifact.closureId}</span><br/>
        Anchors: KS-PBE I_H=${q.hIonizationEv.toFixed(2)} eV · CAS(2,2) D_e=${q.h2DissociationEv.toFixed(2)} eV<br/>
        Presenter: ${pStats.zeroCopy ? 'zero-copy GPU (0 B/frame)' : 'fallback'} · ${rendererBackend} (${gpuAdapterName})<br/>
        Governance: <span style="color:#fde68a;">scientificValidation=false</span>
      </div>
    `;
  }

  function updateVisualsFromPhysics(tel) {
    const quantumBlend = Math.max(0, Math.min(1, (-3.0 - currentLog10Span) / 5.5));
    astroGroup.visible = quantumBlend < 0.96;
    quantumGroup.visible = quantumBlend > 0.04;

    if (astroGroup.visible) {
      const zoomNorm = Math.max(0, Math.min(1, (currentLog10Span - 8.5) / 8.3));
      const camRad = 6.2 + zoomNorm * 16.5;
      camera.position.set(
        Math.cos(camPitch) * Math.sin(camYaw) * camRad,
        Math.sin(camPitch) * camRad,
        Math.cos(camPitch) * Math.cos(camYaw) * camRad
      );
      camera.lookAt(0, 0, 0);
    } else {
      const camRad = 11.2;
      camera.position.set(
        Math.cos(camPitch) * Math.sin(camYaw) * camRad,
        Math.sin(camPitch) * camRad,
        Math.cos(camPitch) * Math.cos(camYaw) * camRad
      );
      camera.lookAt(0, 0, 0);
      // Display genuine quantum volume reflecting live core molecular vs atomic state (zero scripted props!)
      const showMolecularH2 = tel.coreFH2 >= 0.5;
      h2VolumeRaymarcher.mesh.visible = showMolecularH2;
      hOrbitalRaymarcher.mesh.visible = !showMolecularH2;
    }

    let nearest = ZOOM_STOPS[0];
    let bestD = Infinity;
    for (const s of ZOOM_STOPS) {
      const d = Math.abs(s.log10 - currentLog10Span);
      if (d < bestD) { bestD = d; nearest = s; }
    }
    for (const [id, btn] of zoomButtons.entries()) {
      const isAct = id === nearest.id;
      btn.style.borderColor = isAct ? '#38bdf8' : 'rgba(148,163,184,0.25)';
      btn.style.background = isAct ? 'rgba(14,116,144,0.42)' : 'rgba(10,20,34,0.78)';
      btn.style.color = isAct ? '#f0f9ff' : '#cbd5e1';
    }
    zoomSlider.value = String(currentLog10Span.toFixed(2));
  }

  let stepBusy = false;
  async function stepSimulationOnce(overrideAccel = null) {
    if (stepBusy || disposed) return;
    stepBusy = true;
    try {
      const cap = createUlgTaskCapsule({
        taskId: `sgh-${activePresetId}-${engine.stepIndex}`,
        serviceId: ULG_SERVICE_IDS.ulgRuntime,
        taskKind: ULG_TASK_KINDS.simulationStep,
        method: { model: 'self-gravitating-hydro', version: 1 },
        input: {
          stepIndex: engine.stepIndex,
          parameters: {
            dt: 0.018,
            timeAccel: overrideAccel ?? timeScale,
            readTelemetry: (engine.stepIndex % 4 === 0) || overrideAccel !== null
          }
        }
      });
      const res = await moduleRegistry.dispatchSimulationStepCapsule(cap, { device: gpuDevice });
      presenter.bindLeaseHandle(res.leaseHandle);
      res.leaseHandle?.release?.();
    } finally {
      stepBusy = false;
    }
  }

  let rafId = 0;
  let disposed = false;
  let frameCounter = 0;

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  renderInspectorPanel();

  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    currentLog10Span += (targetLog10Span - currentLog10Span) * 0.14;
    if (!dragging) camYaw += 0.0018;

    if (simRunning && !stepBusy) {
      void stepSimulationOnce();
    }

    const tel = engine.getTelemetry();
    updateVisualsFromPhysics(tel);
    if (frameCounter % 10 === 0) {
      renderInspectorPanel();
    }
    frameCounter += 1;
    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(animate);

  const api = {
    getState() {
      return {
        presetId: activePresetId,
        moduleModel: 'self-gravitating-hydro@1',
        closureId: registeredClosure.artifact.closureId,
        backend: engine.backend,
        rendererBackend,
        zeroCopy: presenter.zeroCopy,
        readbackBytesPerFrame: presenter.readbackBytesPerFrame,
        particleCount: engine.count,
        totalMassSolar: engine.totalMassSolar,
        stepIndex: engine.stepIndex,
        simTimeMyr: engine.simTimeMyr,
        log10SpanM: currentLog10Span,
        timeScale,
        simRunning,
        telemetry: engine.getTelemetry(),
        anchors: engine.anchors,
        validation: { scientificValidation: false, fullPhysicsValidation: false }
      };
    },
    selectPreset(id) {
      selectPreset(id);
      return api.getState();
    },
    setLog10Span(v) {
      targetLog10Span = Math.max(-11.0, Math.min(16.8, Number(v)));
      currentLog10Span = targetLog10Span;
      updateVisualsFromPhysics(engine.getTelemetry());
      renderInspectorPanel();
      return api.getState();
    },
    setTimeScale(v) {
      timeScale = Math.max(0.5, Math.min(25, Number(v) || 4.0));
      speedBtn.textContent = `${timeScale}×`;
      return timeScale;
    },
    setPlaying(flag) {
      simRunning = Boolean(flag);
      playBtn.textContent = simRunning ? '⏸ Pause' : '▶ Play';
      return simRunning;
    },
    async stepMany(steps = 40, accel = 6.0) {
      const prevRun = simRunning;
      simRunning = false;
      while (stepBusy) await new Promise((r) => setTimeout(r, 8));
      for (let i = 0; i < steps; i += 1) {
        await stepSimulationOnce(accel);
      }
      simRunning = prevRun;
      const tel = engine.getTelemetry();
      updateVisualsFromPhysics(tel);
      renderInspectorPanel();
      renderer.render(scene, camera);
      return api.getState();
    },
    reset() {
      selectPreset(activePresetId);
      return api.getState();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      presenter.dispose();
      hOrbitalRaymarcher.dispose();
      h2VolumeRaymarcher.dispose();
      engine.dispose();
      renderer.dispose?.();
    }
  };

  globalThis.__ulgStellarGenesisDemo = api;
  return api;
}
