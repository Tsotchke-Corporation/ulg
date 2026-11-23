import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { createUlgTaskCapsule, ULG_SERVICE_IDS, ULG_TASK_KINDS } from '../../ulg-gpu-abi/src/serviceContract.js';
import { ArtifactCache } from '../runtime/ArtifactCache.js';
import { ClosureRegistry } from '../runtime/ClosureRegistry.js';
import { createSimulationModuleRegistry } from '../runtime/simulationModuleRegistry.js';
import { createZeroCopyResidentBodyPresenter } from '../runtime/residentGpuPresenter.js';
import { buildAtomicRadialDensityArtifact } from '../runtime/electronicStructure/quantumDerivationArtifacts.js';
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
import { createVolumetricOrbitalRaymarcher } from './volumetricOrbitalRaymarcher.js';

const ZOOM_STOPS = Object.freeze([
  { id: 'quantum-core', log10: -10.8, label: '10⁻¹¹m Quantum H₂ / Gamow' },
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

function makeGlowSpriteTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.16, 'rgba(255,248,236,0.85)');
  grad.addColorStop(0.42, 'rgba(255,215,155,0.34)');
  grad.addColorStop(0.75, 'rgba(130,185,255,0.08)');
  grad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createGlowSprite(tex, colorHex, scale, opacity = 0.75) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex,
    color: colorHex,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

/**
 * Mount the Stellar Genesis Multiscale Demo onto `container`.
 * Strictly composes ULG's general reusable runtime modules — ZERO bespoke physics kernels:
 *   - `ClosureRegistry` + `ArtifactCache` (quantum-derived 2D plasma EOS & opacity table)
 *   - `self-gravitating-hydro@1` (`src/runtime/sph/selfGravitatingHydroGpu.js`)
 *   - `createCosmicQuantumScaleBridge` (`src/runtime/sph/cosmicQuantumScaleBridge.js`)
 *   - `createZeroCopyResidentBodyPresenter` (`src/runtime/residentGpuPresenter.js`)
 *   - `createVolumetricOrbitalRaymarcher` (`src/demos/volumetricOrbitalRaymarcher.js`)
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

  // Acquire shared WebGPU GPUDevice
  let gpuDevice = null;
  let gpuAdapterName = 'CPU fallback (WebGPU unavailable)';
  try {
    const adapter = await navigator.gpu?.requestAdapter?.({ powerPreference: 'high-performance' });
    if (adapter) {
      gpuDevice = await adapter.requestDevice();
      gpuAdapterName = adapter.info?.description || adapter.info?.vendor || 'WebGPU GPU';
    }
  } catch {
    gpuDevice = null;
  }

  let renderer = null;
  let rendererBackend = 'three-webgl';
  if (gpuDevice && typeof THREE.WebGPURenderer === 'function') {
    try {
      const wgRenderer = new THREE.WebGPURenderer({ antialias: true, device: gpuDevice });
      wgRenderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      wgRenderer.setSize(window.innerWidth, window.innerHeight);
      wgRenderer.setClearColor(0x03060f, 1);
      wgRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      wgRenderer.toneMappingExposure = 1.24;
      await wgRenderer.init();
      renderer = wgRenderer;
      rendererBackend = 'three-webgpu';
    } catch {
      renderer = null;
    }
  }
  if (!renderer) {
    const THREE_GL = await import('three');
    renderer = new THREE_GL.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x03060f, 1);
    renderer.toneMapping = THREE_GL.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;
    rendererBackend = 'three-webgl';
  }
  canvasHost.appendChild(renderer.domElement);

  const zeroCopyActive = Boolean(gpuDevice && renderer.isWebGPURenderer);
  const particleCount = gpuDevice ? 8192 : 2048;

  // 1. Register quantum-derived 2D plasma EOS & opacity closure in ULG's ClosureRegistry
  const artifactCache = new ArtifactCache();
  const closureRegistry = new ClosureRegistry({ artifactCache });
  const registeredClosure = await registerPlasmaFusionClosureArtifact({ closureRegistry });

  // 2. Instantiate ULG's general self-gravitating hydro runtime module (ZERO preset flags!)
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

  // ---- 3D Scene Assembly ----
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.01, 600);
  let camYaw = 0.55;
  let camPitch = 0.34;

  const ambientLight = new THREE.AmbientLight(0x8bb6d9, 0.72);
  const keyLight = new THREE.DirectionalLight(0xfff4dc, 1.7);
  keyLight.position.set(16, 20, 14);
  scene.add(ambientLight, keyLight);
  scene.add(createStarfieldBackdrop());

  const spriteTex = makeGlowSpriteTexture();

  // Group A: Astrophysical Scale Scene (10^17 m -> 10^8 m) using ULG's general zero-copy presenter!
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
  if (!presenter.zeroCopy) {
    presenter.syncFromCpuBodies(engine.getBodies());
  }

  const primaryStarGlow = createGlowSprite(spriteTex, 0xffd58a, 1.2, 0.05);
  const outerCoronaGlow = createGlowSprite(spriteTex, 0x38bdf8, 2.0, 0.02);
  const binaryGlowLeft = createGlowSprite(spriteTex, 0xffd58a, 1.0, 0.0);
  const binaryGlowRight = createGlowSprite(spriteTex, 0x93c5fd, 1.0, 0.0);
  astroGroup.add(primaryStarGlow, outerCoronaGlow, binaryGlowLeft, binaryGlowRight);

  // Compact Remnant visual indicators (driven purely by observed emergent core collapse!)
  const remnantGroup = new THREE.Group();
  remnantGroup.visible = false;
  const bhHorizonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.56, 36, 26),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  const bhPhotonRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.76, 0.07, 18, 72),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.96 })
  );
  bhPhotonRing.rotation.x = Math.PI * 0.43;
  const bhAccretionDisk = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 2.75, 72),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  bhAccretionDisk.rotation.x = Math.PI * 0.43;
  const snShockShell = createGlowSprite(spriteTex, 0x22d3ee, 6.0, 0.22);
  const snShockRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.018, 12, 96),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  snShockRing.rotation.x = Math.PI * 0.42;
  const snShockRing2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.014, 12, 96),
    new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  snShockRing2.rotation.x = Math.PI * 0.22;
  snShockRing2.rotation.y = Math.PI * 0.28;
  const jetGeo = new THREE.ConeGeometry(0.16, 6.4, 16, 1, true);
  const jetMat = new THREE.MeshBasicMaterial({
    color: 0xa78bfa,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const jetTop = new THREE.Mesh(jetGeo, jetMat);
  jetTop.position.y = 3.5;
  jetTop.rotation.x = Math.PI;
  const jetBot = new THREE.Mesh(jetGeo, jetMat);
  jetBot.position.y = -3.5;
  remnantGroup.add(bhHorizonMesh, bhPhotonRing, bhAccretionDisk, snShockShell, snShockRing, snShockRing2, jetTop, jetBot);
  astroGroup.add(remnantGroup);

  // Group B: Quantum Hydrogen Microscope (10^-11 m) reusing ULG's 3D Volumetric Orbital Raymarcher!
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

  const protonMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xe11d48,
    emissiveIntensity: 0.65,
    roughness: 0.22
  });
  const protonA = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 18), protonMat);
  const protonB = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 18), protonMat);
  protonA.add(createGlowSprite(spriteTex, 0xfb7185, 1.9, 0.85));
  protonB.add(createGlowSprite(spriteTex, 0x38bdf8, 1.9, 0.85));

  const h2BondMat = new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.72 });
  const h2BondCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 16), h2BondMat);
  h2BondCyl.rotation.z = Math.PI / 2;

  const coulombBarrierMat = new THREE.MeshBasicMaterial({ color: 0x34d399, wireframe: true, transparent: true, opacity: 0.0 });
  const coulombBarrierMesh = new THREE.Mesh(new THREE.SphereGeometry(1.55, 24, 16), coulombBarrierMat);
  const fusionFlashGlow = createGlowSprite(spriteTex, 0xfef08a, 3.8, 0.0);
  quantumGroup.add(protonA, protonB, h2BondCyl, coulombBarrierMesh, fusionFlashGlow);

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
      <span style="font-size:11px;font-family:monospace;color:#94a3b8;white-space:nowrap;">10⁻¹¹ m (H₂ / Gamow)</span>
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

  let shockExpandRadius = 1.0;

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
    shockExpandRadius = 1.0;
    if (presenter.zeroCopy) {
      presenter.bindResidentBuffer(engine.getResidentBuffer());
    } else {
      presenter.syncFromCpuBodies(engine.getBodies());
    }
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
        Presenter: ${pStats.zeroCopy ? 'zero-copy GPU (0 B/frame)' : 'cpu-instanced'} · ${rendererBackend}<br/>
        Governance: <span style="color:#fde68a;">scientificValidation=false</span>
      </div>
    `;
  }

  function updateVisualsFromPhysics(tel, tSec) {
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
    }

    const [pr, pg, pb] = tel.photosphereSrgb;
    const heatNorm = Math.max(0, Math.min(1, (tel.coreLogT - 2.4) / 4.8));
    const fuseBoost = tel.fusingCount > 8 ? Math.min(1, Math.log10(1 + tel.fusingCount) / 3.0) : 0;
    const isBinary = activePresetId === 'binary-nursery';

    if (tel.supernovaTriggered) {
      primaryStarGlow.visible = false;
      outerCoronaGlow.visible = true;
      outerCoronaGlow.material.color.setRGB(0.25, 0.85, 1.0);
      outerCoronaGlow.material.opacity = 0.65;
      outerCoronaGlow.scale.setScalar(4.8 + Math.sin(tSec * 4) * 0.25);
      remnantGroup.visible = true;
      bhHorizonMesh.visible = tel.remnantClass === 'black-hole';
      bhPhotonRing.rotation.z = tSec * 1.4;
      bhAccretionDisk.rotation.z = -tSec * 1.9;
      shockExpandRadius = Math.min(11.5, shockExpandRadius + (simRunning ? 0.045 : 0));
      snShockShell.scale.setScalar(shockExpandRadius * 2.1);
      snShockShell.material.opacity = Math.max(0.06, 0.28 * (1 - shockExpandRadius / 16));
      snShockRing.scale.setScalar(shockExpandRadius * 0.94);
      snShockRing.rotation.z = tSec * 0.35;
      snShockRing.material.opacity = Math.max(0.12, 0.52 * (1 - shockExpandRadius / 16));
      snShockRing2.scale.setScalar(shockExpandRadius * 0.78);
      snShockRing2.rotation.z = -tSec * 0.28;
      snShockRing2.material.opacity = Math.max(0.08, 0.38 * (1 - shockExpandRadius / 16));
      binaryGlowLeft.visible = false;
      binaryGlowRight.visible = false;
    } else if (isBinary) {
      remnantGroup.visible = false;
      primaryStarGlow.visible = false;
      outerCoronaGlow.visible = false;
      const orbAngle = tSec * 0.42;
      const sep = 2.4 * Math.max(0.55, 1 - heatNorm * 0.35);
      binaryGlowLeft.visible = heatNorm > 0.12;
      binaryGlowRight.visible = heatNorm > 0.12;
      binaryGlowLeft.position.set(Math.cos(orbAngle) * sep, 0, Math.sin(orbAngle) * sep);
      binaryGlowRight.position.set(-Math.cos(orbAngle) * sep, 0, -Math.sin(orbAngle) * sep);
      const bScale = 1.4 + heatNorm * 3.4 + fuseBoost * 2.2;
      binaryGlowLeft.scale.setScalar(bScale);
      binaryGlowRight.scale.setScalar(bScale * 0.92);
      binaryGlowLeft.material.color.setRGB(pr, pg, pb);
      binaryGlowRight.material.color.setRGB(Math.min(1, pr * 0.85 + 0.15), Math.min(1, pg * 0.92 + 0.08), Math.min(1, pb * 1.1));
      binaryGlowLeft.material.opacity = Math.min(0.92, heatNorm * 0.65 + fuseBoost * 0.4);
      binaryGlowRight.material.opacity = Math.min(0.92, heatNorm * 0.62 + fuseBoost * 0.38);
    } else {
      remnantGroup.visible = false;
      binaryGlowLeft.visible = false;
      binaryGlowRight.visible = false;
      primaryStarGlow.visible = heatNorm > 0.08;
      outerCoronaGlow.visible = heatNorm > 0.25;
      primaryStarGlow.material.color.setRGB(pr, pg, pb);
      primaryStarGlow.material.opacity = Math.min(0.95, 0.05 + heatNorm * 0.62 + fuseBoost * 0.36);
      primaryStarGlow.scale.setScalar(1.3 + heatNorm * 3.2 + fuseBoost * 3.8);
      outerCoronaGlow.material.color.setRGB(pr * 0.8 + 0.2, pg * 0.85 + 0.1, Math.min(1, pb + 0.25));
      outerCoronaGlow.material.opacity = Math.min(0.55, heatNorm * 0.25 + fuseBoost * 0.35);
      outerCoronaGlow.scale.setScalar(3.4 + heatNorm * 4.5 + fuseBoost * 4.8);
    }

    if (quantumGroup.visible) {
      const fH2 = tel.coreFH2;
      const fusing = tel.peakEpsNucWPerKg > 1e-6;
      if (fusing) {
        const cyc = (tSec * 1.85) % 1.0;
        const sep = cyc < 0.72 ? (2.6 * (1 - cyc / 0.72) + 0.22) : (0.22 + ((cyc - 0.72) / 0.28) * 2.4);
        protonA.position.set(-sep, 0, 0);
        protonB.position.set(sep, 0, 0);
        h2BondCyl.visible = false;
        coulombBarrierMat.opacity = 0.28;
        coulombBarrierMesh.rotation.y = tSec * 0.5;
        const flash = cyc > 0.62 && cyc < 0.82 ? Math.sin(((cyc - 0.62) / 0.20) * Math.PI) : 0;
        fusionFlashGlow.material.opacity = flash * 0.95;
        fusionFlashGlow.scale.setScalar(2.4 + flash * 4.2);
        hOrbitalRaymarcher.mesh.scale.setScalar(0.55);
      } else if (fH2 > 0.15) {
        const vib = Math.sin(tSec * 4.2) * 0.12 * (1.2 - fH2);
        const sep = 1.12 + (1 - fH2) * 1.2 + vib;
        protonA.position.set(-sep, 0, 0);
        protonB.position.set(sep, 0, 0);
        h2BondCyl.visible = true;
        h2BondCyl.scale.set(1, sep / 1.1, 1);
        h2BondMat.opacity = Math.max(0.08, fH2 * 0.75);
        coulombBarrierMat.opacity = 0.0;
        fusionFlashGlow.material.opacity = 0.0;
        hOrbitalRaymarcher.mesh.scale.setScalar(1.0);
      } else {
        const drift = 1.8 + Math.sin(tSec * 2.1) * 0.45;
        protonA.position.set(-drift, Math.cos(tSec * 1.7) * 0.4, 0);
        protonB.position.set(drift, -Math.cos(tSec * 1.7) * 0.4, 0);
        h2BondCyl.visible = false;
        coulombBarrierMat.opacity = 0.14;
        fusionFlashGlow.material.opacity = 0.0;
        hOrbitalRaymarcher.mesh.scale.setScalar(0.85);
      }
      quantumGroup.rotation.y = tSec * 0.24;
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
      if (presenter.zeroCopy) {
        presenter.bindLeaseHandle(res.leaseHandle);
      } else {
        presenter.syncFromCpuBodies(engine.getBodies());
      }
      res.leaseHandle?.release?.();
    } finally {
      stepBusy = false;
    }
  }

  let rafId = 0;
  let disposed = false;
  let frameCounter = 0;
  const startTimeMs = performance.now();

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  renderInspectorPanel();

  function animate(nowMs) {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    const tSec = (nowMs - startTimeMs) * 0.001;
    currentLog10Span += (targetLog10Span - currentLog10Span) * 0.14;
    if (!dragging) camYaw += 0.0018;

    if (simRunning && !stepBusy) {
      void stepSimulationOnce();
    }

    const tel = engine.getTelemetry();
    updateVisualsFromPhysics(tel, tSec);
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
      updateVisualsFromPhysics(engine.getTelemetry(), (performance.now() - startTimeMs) * 0.001);
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
      if (tel.supernovaTriggered) shockExpandRadius = Math.max(shockExpandRadius, 5.2);
      updateVisualsFromPhysics(tel, (performance.now() - startTimeMs) * 0.001);
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
      engine.dispose();
      spriteTex.dispose();
      renderer.dispose?.();
    }
  };

  globalThis.__ulgStellarGenesisDemo = api;
  return api;
}
