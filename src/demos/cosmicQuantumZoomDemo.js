import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { createUlgTaskCapsule, ULG_SERVICE_IDS, ULG_TASK_KINDS } from '../../ulg-gpu-abi/src/serviceContract.js';
import { createSimulationModuleRegistry } from '../runtime/simulationModuleRegistry.js';
import { createZeroCopyResidentBodyPresenter } from '../runtime/residentGpuPresenter.js';
import { createMaterialResolverPipeline } from '../runtime/material/materialResolverPipeline.js';
import {
  QUANTUM_DERIVATION_GENERATOR_FINGERPRINT,
  buildAtomicRadialDensityArtifact,
  buildMaterialDerivationVisualizationBundle,
  buildMolecularChargeDensityArtifact,
  createQuantumDerivationSimulationModule,
  sampleMolecularChargeDensityWebGpu,
  validateDerivationVisualizationBundle
} from '../runtime/electronicStructure/quantumDerivationArtifacts.js';
import { BOHR_TO_M } from '../runtime/electronicStructure/uniformElectronGas.js';
import { climbingImageNEB } from '../runtime/electronicStructure/molecularHartreeFock.js';
import { eshkolHelmholtzProgram } from '../runtime/material/eshkolTriadClosures.js';
import {
  COSMIC_QUANTUM_SCALE_REGIMES,
  createCosmicQuantumScaleBridge
} from '../runtime/sph/cosmicQuantumScaleBridge.js';
import { runSchroederScaleAtlasMultipoleWebGpu } from '../runtime/sph/schroederScaleAtlasMultipoleGpu.js';
import { createSupergalacticTreePmCosmicAdapter } from '../runtime/astrophysics/supergalacticTreePmGpu.js';
import { createMaterialPolytopeRegistry } from '../runtime/material/materialPolytopeRegistry.js';
import { attachWebGpuUncapturedErrorTelemetry } from '../runtime/webgpuDeviceLimits.js';
import {
  createRelaySignalingTransport,
  startLiveClientDerivationPeerMesh
} from '../services/clientDerivationPeers.js';
import {
  VOLUMETRIC_ORBITAL_MODES,
  createVolumetricOrbitalRaymarcher
} from './volumetricOrbitalRaymarcher.js';
import {
  PLANETARY_SYSTEM_SPECS,
  createContinuumSpecimenBodies,
  createCosmicWebBodies,
  createGalacticBodies,
  createPlanetarySystemBodies,
  createResidentBarnesHutNBodyEngine,
  createResidentContinuumDropletEngine,
  createResidentCosmicModuleRegistration,
  createResidentTiledNBodyEngine
} from './cosmicQuantumGpuKernels.js';

const HA_TO_EV = 27.211386245988;

const ATOMIC_CHOICES = Object.freeze([
  { Z: 80, label: 'Hg (Z=80 · Liquid Metal)' },
  { Z: 79, label: 'Au (Z=79 · Gold)' },
  { Z: 47, label: 'Ag (Z=47 · Silver)' },
  { Z: 29, label: 'Cu (Z=29 · Copper)' },
  { Z: 26, label: 'Fe (Z=26 · Iron)' },
  { Z: 35, label: 'Br (Z=35 · Liquid Halogen)' },
  { Z: 31, label: 'Ga (Z=31 · Gallium)' },
  { Z: 17, label: 'Cl (Z=17 · Gas)' },
  { Z: 11, label: 'Na (Z=11 · Sodium)' },
  { Z: 10, label: 'Ne (Z=10 · Neon)' },
  { Z: 6, label: 'C (Z=6 · Carbon)' },
  { Z: 1, label: 'H (Z=1 · Hydrogen)' }
]);

const MOLECULAR_PRESETS = Object.freeze({
  H2O: {
    formula: 'H2O',
    label: 'H₂O (Water)',
    atoms: [
      { Z: 8, position: [0, 0, 0] },
      { Z: 1, position: [1.43, 0, 1.108] },
      { Z: 1, position: [-1.43, 0, 1.108] }
    ]
  },
  H2: {
    formula: 'H2',
    label: 'H₂ (Dihydrogen)',
    atoms: [
      { Z: 1, position: [0, 0, -0.7] },
      { Z: 1, position: [0, 0, 0.7] }
    ]
  },
  CO: {
    formula: 'CO',
    label: 'CO (Carbon Monoxide)',
    atoms: [
      { Z: 6, position: [0, 0, -1.07] },
      { Z: 8, position: [0, 0, 1.07] }
    ]
  },
  HF: {
    formula: 'HF',
    label: 'HF (Hydrogen Fluoride)',
    atoms: [
      { Z: 9, position: [0, 0, -0.18] },
      { Z: 1, position: [0, 0, 1.56] }
    ]
  }
});

const GALAXY_TIERS = Object.freeze({
  '4k-direct': { id: '4k-direct', label: '4K Direct', count: 4096, mode: 'direct' },
  '32k-bh': { id: '32k-bh', label: '32K BH Octree', count: 32768, mode: 'barnes-hut' },
  '65k-bh': { id: '65k-bh', label: '65K BH Octree', count: 65536, mode: 'barnes-hut' }
});

const REGIME_CENTERS_LOG10 = Object.freeze({
  'atomic-orbital': -10.5,
  'molecular-lattice': -8.8,
  'continuum-sph-solids': -0.3,
  'planetary-orbital': 10.6,
  'galactic-nbody': 20.6,
  'supergalactic-cosmic': 26.2
});

const CPK_COLORS = Object.freeze({
  1: 0xe6f2ff,
  6: 0x64748b,
  7: 0x3b82f6,
  8: 0xef4444,
  9: 0x34d399,
  10: 0x38bdf8,
  11: 0xa855f7,
  17: 0x84cc16,
  26: 0xf59e0b,
  29: 0xd97746,
  31: 0x94a3b8,
  35: 0xb91c1c,
  47: 0xe2e8f0,
  79: 0xfacc15,
  80: 0xdbeafe
});

function formatPhysicalSpan(spanM) {
  if (!(spanM > 0) || !Number.isFinite(spanM)) return '—';
  if (spanM < 1e-9) return `${(spanM * 1e12).toFixed(1)} pm (${(spanM / BOHR_TO_M).toFixed(2)} a₀)`;
  if (spanM < 1e-6) return `${(spanM * 1e9).toFixed(2)} nm`;
  if (spanM < 1e-3) return `${(spanM * 1e6).toFixed(1)} µm`;
  if (spanM < 1e3) return `${spanM.toFixed(spanM < 10 ? 2 : 0)} m`;
  if (spanM < 1e9) return `${(spanM / 1e3).toFixed(1)} km`;
  if (spanM < 1e14) return `${(spanM / 1.495978707e11).toFixed(2)} AU`;
  if (spanM < 9.4607e18) return `${(spanM / 9.4607304725808e15).toFixed(2)} ly`;
  if (spanM < 3.0857e22) return `${(spanM / 9.4607304725808e18).toFixed(1)} kly`;
  if (spanM < 9.4607e24) return `${(spanM / 3.085677581491367e22).toFixed(1)} Mpc`;
  return `${(spanM / 9.4607304725808e24).toFixed(1)} Gly`;
}

function buildRadialProfileSvg(artifact) {
  const samples = artifact?.radialProfile?.samples || [];
  if (!samples.length) return '';
  const w = 260;
  const h = 76;
  const maxP = Math.max(1e-6, ...samples.map((s) => s.radialProbabilityPerBohr));
  const rMax = Math.max(1e-6, artifact.radialProfile.rMaxBohr);
  const pts = samples.map((s) => {
    const x = (s.rBohr / rMax) * (w - 16) + 8;
    const y = h - 10 - (s.radialProbabilityPerBohr / maxP) * (h - 20);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const r95 = artifact.summary?.containmentRadii?.r95Bohr ?? 0;
  const r95X = Math.min(w - 8, (r95 / rMax) * (w - 16) + 8);
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:76px;display:block;background:rgba(4,12,18,0.72);border-radius:6px;border:1px solid rgba(94,234,212,0.18);">
    <polyline fill="none" stroke="#5eead4" stroke-width="1.8" points="${pts}" />
    <line x1="${r95X.toFixed(1)}" y1="6" x2="${r95X.toFixed(1)}" y2="${h - 8}" stroke="#fbbf24" stroke-dasharray="3,2" stroke-width="1" />
    <text x="8" y="13" fill="#94a3b8" font-size="9" font-family="monospace">4πr²ρ(r) · r95=${r95.toFixed(2)} a₀</text>
  </svg>`;
}

function createStarfieldBackdrop() {
  const count = 900;
  const geo = new THREE.OctahedronGeometry(0.38, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let seed = 424242;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i += 1) {
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const R = 150 + rnd() * 90;
    dummy.position.set(R * s * Math.cos(th), R * u, R * s * Math.sin(th));
    dummy.scale.setScalar(0.45 + rnd() * 0.95);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    const tint = rnd();
    color.setRGB(tint > 0.72 ? 0.95 : 0.68, tint > 0.35 ? 0.88 : 0.74, 1.0);
    mesh.setColorAt(i, color);
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
  grad.addColorStop(0.18, 'rgba(255,248,232,0.78)');
  grad.addColorStop(0.45, 'rgba(255,220,165,0.28)');
  grad.addColorStop(0.75, 'rgba(180,205,255,0.07)');
  grad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createSoftGlowSprite(spriteTex, colorHex, scale, opacity = 0.88) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: spriteTex,
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
 * Mount the standalone 38+ OOM Cosmic ↔ Quantum Continuous-Zoom PeerCompute
 * Demo onto `container`. Features:
 *   - Shared-device `THREE.WebGPURenderer` + Zero-Copy Resident `GPUBuffer` presenter (`0` bytes/frame CPU readback)
 *   - Hierarchical WebGPU Barnes-Hut Octree N-body scaling to 32K-65K+ stars (`eshkols-in-space` ABI)
 *   - Relativistic PBE+KH+SO Quantum -> Continuum live material propagation (liquid Hg, Br, Au, Cu, Ag, Fe, Cl)
 *   - Live GPU cross-chart multipole coupling (`runSchroederScaleAtlasMultipoleWebGpu`) across Planetary/Galactic/Cosmic charts
 */
export async function mountCosmicQuantumZoomDemo(container) {
  const root = document.createElement('div');
  root.id = 'ulg-cosmic-quantum-root';
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:#040811',
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

  // Parse initial URL overrides (?scale=-10.5 or ?regime=galactic-nbody&tier=32k-bh&Z=80)
  const urlParams = new URLSearchParams(window.location.search);
  const rawScaleParam = urlParams.get('scale');
  const parsedScaleParam = rawScaleParam !== null && rawScaleParam.trim() !== '' ? Number(rawScaleParam) : Number.NaN;
  let targetLog10 = Number.isFinite(parsedScaleParam)
    ? parsedScaleParam
    : REGIME_CENTERS_LOG10[urlParams.get('regime')] ?? REGIME_CENTERS_LOG10['galactic-nbody'];
  let currentLog10 = targetLog10;

  let selectedElementZ = Number.parseInt(urlParams.get('Z') || '80', 10) || 80; // Default Hg (Z=80) showcasing relativistic liquid metal!
  let selectedFunctional = urlParams.get('functional') === 'lda' ? 'lda' : 'pbe';
  let selectedOrbitalMode = VOLUMETRIC_ORBITAL_MODES.some((m) => m.id === urlParams.get('orbital'))
    ? urlParams.get('orbital')
    : 'total-density';
  let selectedMoleculeKey = MOLECULAR_PRESETS[urlParams.get('molecule')] ? urlParams.get('molecule') : 'H2O';
  let selectedBasis = urlParams.get('basis') === '6-31g(d)' ? '6-31g(d)' : 'sto-3g';
  let molecularViewMode = 'density';
  let nebModeActive = urlParams.get('neb') === '1';
  let nebReactionXi = 0.5;
  let showPolytopeOverlay = true;
  let galaxyPreset = ['disk', 'binary', 'sphere'].includes(urlParams.get('galaxy')) ? urlParams.get('galaxy') : 'disk';
  let simRunning = urlParams.get('paused') !== '1';
  let tourRunning = urlParams.get('tour') === '1';
  let tourDirection = -1;
  const galaxyGravity = 1.0;
  const galaxyDt = 0.011;
  const hubbleExpansionSpeed = 0.14;
  let peerRelayUrl = (urlParams.get('peerRelay') || '').trim();
  let peerRoomId = (urlParams.get('peerRoom') || 'ulg-cosmic-quantum-mesh-v1').trim();
  let peerRole = ['requester', 'responder', 'observer'].includes(urlParams.get('peerRole'))
    ? urlParams.get('peerRole')
    : 'requester';

  // Acquire shared WebGPU GPUDevice (fail closed when unavailable — zero CPU mirror fallback)
  let gpuDevice = null;
  let gpuAdapterName = 'WebGPU unavailable';
  try {
    const adapter = await navigator.gpu?.requestAdapter?.({ powerPreference: 'high-performance' });
    if (adapter) {
      gpuDevice = await adapter.requestDevice();
      attachWebGpuUncapturedErrorTelemetry(gpuDevice, { label: 'cosmic-quantum-demo' });
      gpuAdapterName = adapter.info?.description || adapter.info?.vendor || 'WebGPU GPU';
    }
  } catch {
    gpuDevice = null;
  }

  if (!gpuDevice || typeof THREE.WebGPURenderer !== 'function') {
    root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;">
        <div style="max-width:460px;padding:20px 24px;border-radius:12px;background:rgba(12,18,32,0.92);border:1px solid rgba(248,113,113,0.45);color:#fecaca;">
          <h2 style="margin:0 0 8px 0;font-size:16px;">WebGPU Required</h2>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#e2e8f0;">
            Cosmic ↔ Quantum executes ULG's GPU-native Barnes-Hut, N-body, continuum micro-SPH, and volumetric raymarching kernels directly on WebGPU. Enable WebGPU in a supported browser to run this simulation.
          </p>
        </div>
      </div>`;
    return null;
  }

  let galaxyTierId = GALAXY_TIERS[urlParams.get('tier')] ? urlParams.get('tier') : '32k-bh';

  const renderer = new THREE.WebGPURenderer({ antialias: true, device: gpuDevice });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x040811, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  await renderer.init();
  const rendererBackend = 'three-webgpu';
  canvasHost.appendChild(renderer.domElement);

  const zeroCopyActive = Boolean(renderer.isWebGPURenderer);

  // Content-addressed Phase 6 WebGPU-derived material resolver pipeline
  const materialPipeline = createMaterialResolverPipeline({ device: gpuDevice });
  let currentElementResolution = null;

  // Optional Phase 11 live PeerCompute WebSocket/WebRTC distributed mesh
  let peerMesh = null;
  let peerMeshState = {
    connected: false,
    role: peerRole,
    relayUrl: peerRelayUrl,
    roomId: peerRoomId,
    remotePeers: 0,
    quorumReady: false,
    dispatches: 0,
    lastResult: null,
    error: null
  };

  async function disconnectPeerMesh() {
    if (!peerMesh) return;
    const prev = peerMesh;
    peerMesh = null;
    try { await prev.stop?.(); } catch { /* ignore */ }
    try { prev.transport?.close?.(); } catch { /* ignore */ }
    peerMeshState = {
      ...peerMeshState,
      connected: false,
      remotePeers: 0,
      quorumReady: false
    };
  }

  async function connectPeerMesh({ relayUrl = peerRelayUrl, roomId = peerRoomId, role = peerRole } = {}) {
    await disconnectPeerMesh();
    peerRelayUrl = String(relayUrl || '').trim();
    peerRoomId = String(roomId || 'ulg-cosmic-quantum-mesh-v1').trim();
    peerRole = ['requester', 'responder', 'observer'].includes(role) ? role : 'requester';
    if (!peerRelayUrl) {
      peerMeshState = { ...peerMeshState, connected: false, relayUrl: '', roomId: peerRoomId, role: peerRole, error: null };
      return peerMeshState;
    }
    try {
      const peerId = `cq-${peerRole}-${Math.random().toString(36).slice(2, 8)}`;
      const taskModuleUrl = new URL('../services/cosmicQuantumPeerTask.js', import.meta.url).href;
      let handle = null;
      let transport = null;
      if (peerRole === 'observer') {
        // Observer role: passive WebSocket room listener tracking live peer presence & traffic
        transport = createRelaySignalingTransport({
          relayUrl: peerRelayUrl,
          roomId: peerRoomId,
          peerId,
          enableWebRtc: false
        });
        const seenPeers = new Set();
        let witnessedMessages = 0;
        let lastWitnessedType = null;
        transport.onMessage((env) => {
          witnessedMessages += 1;
          lastWitnessedType = env?.type || null;
          if (env?.from) seenPeers.add(env.from);
          if (env?.type === 'presence' && env?.alive === false && env?.from) seenPeers.delete(env.from);
          if (env?.type === 'peer-disconnect' && env?.peerId) seenPeers.delete(env.peerId);
          peerMeshState.remotePeers = seenPeers.size;
          peerMeshState.witnessedMessages = witnessedMessages;
          peerMeshState.lastWitnessedType = lastWitnessedType;
        });
        handle = {
          getPeers: () => [...seenPeers],
          getStatus: () => ({
            connected: transport.isConnected(),
            remotePeerCount: seenPeers.size,
            remotePeerIds: [...seenPeers],
            quorumReady: false,
            witnessedMessages,
            lastWitnessedType
          }),
          async stop() { transport.close(); }
        };
      } else {
        // Requester / Responder mesh node: self-discovering live PeerCompute responder + 2-of-2 quorum requester
        const mesh = startLiveClientDerivationPeerMesh({
          relayUrl: peerRelayUrl,
          roomId: peerRoomId,
          peerId,
          enableWebRtc: false,
          taskModuleUrl,
          announceIntervalMs: 120,
          staleMs: 1200,
          timeoutMs: 15000
        });
        transport = mesh.transport;
        handle = {
          mesh,
          getPeers: () => mesh.getStatus().remotePeerIds,
          getStatus: () => mesh.getStatus(),
          getActiveRequester: () => mesh.getActiveRequester(),
          async stop() { mesh.stop(); }
        };
      }
      peerMesh = { transport, handle, peerId, role: peerRole, stop: () => handle?.stop?.() };
      const st0 = handle?.getStatus?.() || {};
      peerMeshState = {
        connected: true,
        role: peerRole,
        relayUrl: peerRelayUrl,
        roomId: peerRoomId,
        peerId,
        remotePeers: st0.remotePeerCount ?? 0,
        remotePeerIds: [...(st0.remotePeerIds || [])],
        quorumReady: Boolean(st0.quorumReady),
        witnessedMessages: st0.witnessedMessages ?? 0,
        lastWitnessedType: st0.lastWitnessedType ?? null,
        dispatches: 0,
        lastResult: null,
        error: null
      };
    } catch (err) {
      peerMeshState = {
        ...peerMeshState,
        connected: false,
        relayUrl: peerRelayUrl,
        roomId: peerRoomId,
        role: peerRole,
        error: err instanceof Error ? err.message : String(err)
      };
    }
    return peerMeshState;
  }

  // Simulation module registry + Cosmic-to-Quantum Scale Bridge
  const moduleRegistry = createSimulationModuleRegistry();
  moduleRegistry.registerModule(createQuantumDerivationSimulationModule());

  let galacticEngine = null;
  let galacticPresenter = null;
  const cosmicWebEngine = createSupergalacticTreePmCosmicAdapter({
    device: gpuDevice,
    particleCount: 4096,
    gridN: 32,
    boxLengthMpc: 18.0,
    aInit: 0.25,
    da: 0.006,
    seed: 1370
  });
  moduleRegistry.registerModule(createResidentCosmicModuleRegistration({
    method: { model: 'cosmology-comoving-nbody', version: 1 },
    engine: cosmicWebEngine,
    scaleRangeM: [1e22, 1e28],
    zeroCopy: zeroCopyActive
  }));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.01, 600);
  let camYaw = 0.56;
  let camPitch = 0.62;
  const camRadius = 15.5;

  const ambientLight = new THREE.AmbientLight(0x9bd3e6, 0.78);
  const keyLight = new THREE.DirectionalLight(0xfff5e0, 1.8);
  keyLight.position.set(14, 18, 12);
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
  rimLight.position.set(-14, -8, -12);
  scene.add(ambientLight, keyLight, rimLight);

  const spriteTex = makeGlowSpriteTexture();
  scene.add(createStarfieldBackdrop());

  const regimeGroups = {};
  for (const r of COSMIC_QUANTUM_SCALE_REGIMES) {
    const g = new THREE.Group();
    g.name = r.id;
    scene.add(g);
    regimeGroups[r.id] = g;
  }

  const instDummy = new THREE.Object3D();
  const instColor = new THREE.Color();

  // ---- 1. Supergalactic / Observable Universe Cosmic Web (10^27 m — Live Gate 5D FLRW 3D-FFT TreePM) ----
  const cosmicGroup = regimeGroups['supergalactic-cosmic'];
  const cosmicPresenter = createZeroCopyResidentBodyPresenter({
    THREE,
    TSL,
    renderer,
    bodyCount: cosmicWebEngine.count,
    strideFloats: cosmicWebEngine.strideFloats,
    palette: 'cosmic-web',
    initialBuffer: cosmicWebEngine.getResidentBuffer()
  });
  cosmicGroup.add(cosmicPresenter.mesh);

  const horizonRing = new THREE.Mesh(
    new THREE.SphereGeometry(11.6, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0x4f46e5, wireframe: true, transparent: true, opacity: 0.11 })
  );
  cosmicGroup.add(horizonRing);

  // ---- 2. Galactic N-Body (10^21 m — Zero-Copy WebGPU Barnes-Hut / Direct) ----
  const galacticGroup = regimeGroups['galactic-nbody'];

  async function rebuildGalacticSimulation({ tierId = galaxyTierId, preset = galaxyPreset } = {}) {
    galaxyTierId = GALAXY_TIERS[tierId] ? tierId : '32k-bh';
    galaxyPreset = ['disk', 'binary', 'sphere'].includes(preset) ? preset : 'disk';
    const tier = GALAXY_TIERS[galaxyTierId];

    if (galacticPresenter) {
      galacticGroup.remove(galacticPresenter.mesh);
      galacticPresenter.dispose();
      galacticPresenter = null;
    }
    if (galacticEngine) {
      moduleRegistry.unregisterModule({ model: 'nbody-gravity', version: 1 });
      galacticEngine.dispose();
      galacticEngine = null;
    }

    const bodies0 = createGalacticBodies({ count: tier.count, preset: galaxyPreset, seed: 825 });
    galacticEngine = tier.mode === 'barnes-hut'
      ? createResidentBarnesHutNBodyEngine({
        device: gpuDevice,
        initialBodies: bodies0,
        mode: 0,
        boxHalf: 16.0,
        theta: 0.65,
        label: `ulg-galactic-bh-${tier.count}`
      })
      : createResidentTiledNBodyEngine({
        device: gpuDevice,
        initialBodies: bodies0,
        mode: 0,
        label: `ulg-galactic-direct-${tier.count}`
      });

    moduleRegistry.registerModule(createResidentCosmicModuleRegistration({
      method: { model: 'nbody-gravity', version: 1 },
      engine: galacticEngine,
      scaleRangeM: [1e6, 1e22],
      zeroCopy: zeroCopyActive
    }));

    galacticPresenter = createZeroCopyResidentBodyPresenter({
      THREE,
      TSL,
      renderer,
      bodyCount: galacticEngine.count,
      palette: 'galactic',
      initialBuffer: galacticEngine.getResidentBuffer()
    });
    galacticGroup.add(galacticPresenter.mesh);
  }
  await rebuildGalacticSimulation();

  const scaleBridge = createCosmicQuantumScaleBridge({ moduleRegistry });

  // Run real ULG GPU cross-chart multipole coupling across Planetary (L=33), Galactic (L=70), Supergalactic (L=90)!
  let crossChartMultipoleReceipt = null;
  if (gpuDevice) {
    try {
      const atlasSnap = scaleBridge.atlasRuntime.snapshotAtlas();
      const ids = scaleBridge.summary().chartByRegimeId;
      const mp = await runSchroederScaleAtlasMultipoleWebGpu(gpuDevice, {
        atlas: atlasSnap,
        particles: [
          // Planetary system (chart #3, ~1 solar mass, 5778 K)
          { chartId: ids['planetary-orbital'], flags: 1, massKg: 1.989e30, temperatureK: 5778, posLocal: [0.0, 0.0, 0.0], effectiveAreaM2: 6.09e18 },
          // Galactic core & halo (chart #4, ~1e11 solar masses)
          { chartId: ids['galactic-nbody'], flags: 1, massKg: 2.0e41, temperatureK: 4200, posLocal: [2.5, 0.2, -1.8], effectiveAreaM2: 1.0e32 },
          // Supergalactic cluster neighbor (chart #5, ~1e15 solar masses)
          { chartId: ids['supergalactic-cosmic'], flags: 1, massKg: 2.0e45, temperatureK: 3000, posLocal: [-4.2, 1.5, 3.1], effectiveAreaM2: 1.0e36 }
        ]
      });
      crossChartMultipoleReceipt = mp.receipt;
    } catch {
      crossChartMultipoleReceipt = null;
    }
  }

  // ---- 3. Planetary / Stellar Orbital System (10^10 m — Live WebGPU Newtonian N-Body!) ----
  const planetaryGroup = regimeGroups['planetary-orbital'];
  const planetaryBodies0 = createPlanetarySystemBodies({ gravity: 1.0, softening: 0.02 });
  const planetaryEngine = createResidentTiledNBodyEngine({
    device: gpuDevice,
    initialBodies: planetaryBodies0,
    mode: 0,
    label: 'ulg-planetary-nbody'
  });
  moduleRegistry.registerModule(createResidentCosmicModuleRegistration({
    method: { model: 'planetary-nbody', version: 1 },
    engine: planetaryEngine,
    scaleRangeM: [1e8, 1e14],
    zeroCopy: false
  }));

  const starPointLight = new THREE.PointLight(0xfff1cc, 95, 48, 1.35);
  planetaryGroup.add(starPointLight);

  const TRAIL_LEN = 180;
  const planetaryRenderBodies = PLANETARY_SYSTEM_SPECS.map((spec, idx) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(spec.radius, spec.isStar ? 32 : 28, spec.isStar ? 24 : 20),
      spec.isStar
        ? new THREE.MeshBasicMaterial({ color: spec.color })
        : new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.38, metalness: 0.12 })
    );
    if (spec.ringed) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(spec.radius * 1.35, spec.radius * 2.2, 56),
        new THREE.MeshBasicMaterial({ color: 0xdfc49f, side: THREE.DoubleSide, transparent: true, opacity: 0.62 })
      );
      ring.rotation.x = Math.PI / 2.35;
      mesh.add(ring);
    }
    const bx = planetaryBodies0[idx * 8 + 0];
    const by = planetaryBodies0[idx * 8 + 1];
    const bz = planetaryBodies0[idx * 8 + 2];
    mesh.position.set(bx, by, bz);
    planetaryGroup.add(mesh);

    let trailLine = null;
    let trailCoords = null;
    let trailCount = 0;
    if (!spec.isStar) {
      trailCoords = new Float32Array(TRAIL_LEN * 3);
      trailCoords[0] = bx; trailCoords[1] = by; trailCoords[2] = bz;
      trailCount = 1;
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailCoords, 3));
      trailGeo.setDrawRange(0, 1);
      trailLine = new THREE.Line(
        trailGeo,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.42 })
      );
      trailLine.frustumCulled = false;
      planetaryGroup.add(trailLine);
    }
    return { spec, idx, mesh, trailLine, trailCoords, trailCount };
  });

  function syncPlanetaryMeshesFromGpu(bodies) {
    for (const body of planetaryRenderBodies) {
      const o = body.idx * 8;
      const x = bodies[o + 0];
      const y = bodies[o + 1];
      const z = bodies[o + 2];
      body.mesh.position.set(x, y, z);
      if (body.spec.isStar) {
        starPointLight.position.set(x, y, z);
      } else if (body.trailCoords && body.trailLine) {
        if (body.trailCount < TRAIL_LEN) {
          const base = body.trailCount * 3;
          body.trailCoords[base] = x;
          body.trailCoords[base + 1] = y;
          body.trailCoords[base + 2] = z;
          body.trailCount += 1;
        } else {
          body.trailCoords.copyWithin(0, 3);
          const base = (TRAIL_LEN - 1) * 3;
          body.trailCoords[base] = x;
          body.trailCoords[base + 1] = y;
          body.trailCoords[base + 2] = z;
        }
        body.trailLine.geometry.setDrawRange(0, body.trailCount);
        body.trailLine.geometry.attributes.position.needsUpdate = true;
      }
    }
  }
  syncPlanetaryMeshesFromGpu(planetaryBodies0);

  // ---- 4. Continuum Matter & Quantum-Derived Eshkol A4 Helmholtz Bridge (10^0 m) ----
  const continuumGroup = regimeGroups['continuum-sph-solids'];
  const continuumDynamicGroup = new THREE.Group();
  continuumGroup.add(continuumDynamicGroup);

  const labCage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(6.4, 6.4, 6.4)),
    new THREE.LineBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.52 })
  );
  continuumGroup.add(labCage);

  let continuumHelmholtzGroup = null;
  let continuumEngine = null;
  let continuumPresenter = null;

  function disposeGroupChildren(group) {
    while (group.children.length > 0) {
      const child = group.children.pop();
      child.traverse?.((node) => {
        if (!node.isSprite) {
          node.geometry?.dispose?.();
        }
        if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose?.());
        else node.material?.dispose?.();
      });
    }
  }

  async function rebuildContinuumFromQuantumElement() {
    if (continuumPresenter) {
      continuumDynamicGroup.remove(continuumPresenter.mesh);
      continuumPresenter.dispose();
      continuumPresenter = null;
    }
    if (continuumEngine) {
      moduleRegistry.unregisterModule({ model: 'continuum-micro-sph', version: 1 });
      continuumEngine.dispose();
      continuumEngine = null;
    }
    disposeGroupChildren(continuumDynamicGroup);
    continuumHelmholtzGroup = null;

    currentElementResolution = await materialPipeline.resolveElement(selectedElementZ, {
      functional: selectedFunctional,
      scalarRelativistic: true,
      includeGasPhase: true,
      gridPointsN: 360
    });
    const p = currentElementResolution.properties;
    const vdw = p.vdwGasProperties;
    const density = p.densityKgPerM3 ?? vdw?.condensedDensityKgPerM3 ?? 1000;
    const bulkPa = p.bulkModulusPa ?? vdw?.bulkModulusPa ?? 2.2e9;
    const meltingPointK = p.meltingPointK ?? vdw?.meltingPointK ?? null;
    const boilingPointK = p.boilingPointK ?? vdw?.boilingPointK ?? null;
    const cohesiveEnergyEv = p.cohesiveEnergyEv ?? null;
    const cp = p.cpJPerKgK ?? 400;
    const [cr, cg, cb] = p.opticalColorSrgb || [0.78, 0.85, 0.92];

    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(5.3, 0.42, 5.3),
      new THREE.MeshStandardMaterial({
        color: 0x1e3a5f,
        emissive: 0x0c243b,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.15,
        transparent: true,
        opacity: 0.52
      })
    );
    pedestal.position.set(0, -1.22, 0);
    const pedestalEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(5.32, 0.44, 5.32)),
      new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.48 })
    );
    pedestalEdges.position.copy(pedestal.position);
    continuumDynamicGroup.add(pedestal, pedestalEdges);

    // Unified continuous constitutive WebGPU micro-SPH engine driven strictly by quantum-derived
    // (bulkModulusPa, meltingPointK, boilingPointK, cohesiveEnergyEv, temperatureK) — zero phase switches!
    const microBodies0 = createContinuumSpecimenBodies({
      count: 1024,
      bulkModulusPa: bulkPa,
      meltingPointK,
      boilingPointK,
      cohesiveEnergyEv,
      temperatureK: 298.15,
      seed: 4201 + selectedElementZ * 17
    });
    continuumEngine = createResidentContinuumDropletEngine({
      device: gpuDevice,
      initialBodies: microBodies0,
      bulkModulusPa: bulkPa,
      meltingPointK,
      boilingPointK,
      cohesiveEnergyEv,
      temperatureK: 298.15,
      label: `ulg-continuum-${p.symbol.toLowerCase()}`
    });
    moduleRegistry.registerModule(createResidentCosmicModuleRegistration({
      method: { model: 'continuum-micro-sph', version: 1 },
      engine: continuumEngine,
      scaleRangeM: [1e-4, 1e2],
      zeroCopy: zeroCopyActive
    }));
    const particleScale = 0.085 + 0.03 * continuumEngine.constitutive.condensedOrder;
    continuumPresenter = createZeroCopyResidentBodyPresenter({
      THREE,
      TSL,
      renderer,
      bodyCount: continuumEngine.count,
      palette: 'continuum-material',
      tintColor: [cr, cg, cb],
      particleScale,
      initialBuffer: continuumEngine.getResidentBuffer()
    });
    continuumDynamicGroup.add(continuumPresenter.mesh);

    // Rebuild 3D Eshkol A4 Helmholtz potential surface a(T, v) from the element's live derived bulk properties!
    const refV = 1 / Math.max(10, density);
    const helmProg = eshkolHelmholtzProgram({
      material: p.symbol.toLowerCase(),
      cvJPerKgK: Math.max(50, cp),
      rSpecificJPerKgK: 8.314462618 / Math.max(1e-3, p.molarMassKgPerMol),
      bulkModulusPa: Math.max(1e7, bulkPa),
      refTemperatureK: 293.15,
      refSpecificVolumeM3PerKg: refV
    });
    const surfGeo = new THREE.PlaneGeometry(5.8, 5.8, 22, 22);
    surfGeo.rotateX(-Math.PI / 2);
    const surfPos = surfGeo.attributes.position;
    let aMin = Infinity;
    let aMax = -Infinity;
    const aVals = new Float64Array(surfPos.count);
    for (let i = 0; i < surfPos.count; i += 1) {
      const u = (surfPos.getX(i) + 2.9) / 5.8;
      const v = (surfPos.getZ(i) + 2.9) / 5.8;
      const T = 180 + u * 420;
      const spV = refV * (0.92 + v * 0.16);
      const val = helmProg.closedForm.a(T, spV);
      aVals[i] = val;
      if (val < aMin) aMin = val;
      if (val > aMax) aMax = val;
    }
    const aSpan = Math.max(1e-6, aMax - aMin);
    for (let i = 0; i < surfPos.count; i += 1) {
      surfPos.setY(i, -2.95 + ((aVals[i] - aMin) / aSpan) * 1.45);
    }
    surfPos.needsUpdate = true;
    surfGeo.computeVertexNormals();
    continuumHelmholtzGroup = new THREE.Group();
    continuumHelmholtzGroup.add(
      new THREE.Mesh(
        surfGeo,
        new THREE.MeshStandardMaterial({
          color: 0x14b8a6,
          emissive: 0x0f766e,
          emissiveIntensity: 0.42,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.34,
          roughness: 0.35
        })
      ),
      new THREE.Mesh(
        surfGeo,
        new THREE.MeshBasicMaterial({ color: 0x5eead4, wireframe: true, transparent: true, opacity: 0.56 })
      )
    );
    continuumDynamicGroup.add(continuumHelmholtzGroup);
  }

  // ---- 5. Molecular 6-31G(d) / STO-3G Charge Density, CI-NEB Path & Polytope Overlay (10^-9 m) ----
  const molecularGroup = regimeGroups['molecular-lattice'];
  const polytopeRegistry = createMaterialPolytopeRegistry();
  let currentMolecularBundle = null;
  let currentMolecularArtifact = null;
  let currentMolecularBackend = 'worker-cpu-derived';
  let cachedNebPath = null;
  let currentPolytopeStatus = 'accepted';
  let currentPolytopeResolution = null;

  function ensureNebReactionPath() {
    if (cachedNebPath) return cachedNebPath;
    // Closed-shell 10-electron first-principles CI-NEB: H2O bent -> linear D_inf_h TS -> inverted H2O
    const reactant = [
      { Z: 8, position: [0, 0, 0] },
      { Z: 1, position: [1.43, 1.108, 0] },
      { Z: 1, position: [-1.43, 1.108, 0] }
    ];
    const product = [
      { Z: 8, position: [0, 0, 0] },
      { Z: 1, position: [1.43, -1.108, 0] },
      { Z: 1, position: [-1.43, -1.108, 0] }
    ];
    cachedNebPath = climbingImageNEB(reactant, product, {
      nImages: 7,
      maxSteps: 14,
      springK: 0.12,
      stepSize: 0.16,
      basis: 'sto-3g'
    });
    return cachedNebPath;
  }

  function buildNebEnergySvg(neb, xi) {
    const energies = neb?.energiesHa || [];
    if (energies.length < 3) return '';
    const w = 260;
    const h = 66;
    const e0 = energies[0];
    const relEv = energies.map((e) => (e - e0) * HA_TO_EV);
    const eMin = Math.min(...relEv);
    const eMax = Math.max(eMin + 0.1, ...relEv);
    const pts = relEv.map((ev, i) => {
      const x = 10 + (i / (relEv.length - 1)) * (w - 20);
      const y = h - 10 - ((ev - eMin) / (eMax - eMin)) * (h - 22);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const curX = 10 + Math.max(0, Math.min(1, xi)) * (w - 20);
    const sadX = 10 + (neb.saddleImageIndex / (relEv.length - 1)) * (w - 20);
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:66px;display:block;background:rgba(4,12,18,0.72);border-radius:6px;border:1px solid rgba(251,191,36,0.28);">
      <polyline fill="none" stroke="#fbbf24" stroke-width="1.8" points="${pts}" />
      <line x1="${sadX.toFixed(1)}" y1="6" x2="${sadX.toFixed(1)}" y2="${h - 8}" stroke="#f87171" stroke-dasharray="2,2" stroke-width="1" />
      <line x1="${curX.toFixed(1)}" y1="6" x2="${curX.toFixed(1)}" y2="${h - 8}" stroke="#34d399" stroke-width="1.5" />
      <text x="8" y="13" fill="#fde68a" font-size="9" font-family="monospace">CI-NEB H₂O Inversion · Ea=${(neb.forwardBarrierHa * HA_TO_EV).toFixed(2)} eV</text>
    </svg>`;
  }

  function interpolateNebAtoms(neb, xi) {
    const imgs = neb.images;
    const clamped = Math.max(0, Math.min(1, xi));
    const scaled = clamped * (imgs.length - 1);
    const i0 = Math.min(imgs.length - 2, Math.floor(scaled));
    const t = scaled - i0;
    return imgs[i0].map((a, idx) => ({
      Z: a.Z,
      position: [
        a.position[0] + t * (imgs[i0 + 1][idx].position[0] - a.position[0]),
        a.position[1] + t * (imgs[i0 + 1][idx].position[1] - a.position[1]),
        a.position[2] + t * (imgs[i0 + 1][idx].position[2] - a.position[2])
      ]
    }));
  }

  async function rebuildMolecularScene() {
    disposeGroupChildren(molecularGroup);
    let activeAtoms;
    let activeFormula;
    let activeBasis = selectedBasis;
    if (nebModeActive) {
      const neb = ensureNebReactionPath();
      activeAtoms = interpolateNebAtoms(neb, nebReactionXi);
      activeFormula = 'H2O';
      activeBasis = 'sto-3g';
      currentPolytopeStatus = (nebReactionXi > 0.35 && nebReactionXi < 0.65) ? 'boundary-saddle' : 'accepted';
    } else {
      const preset = MOLECULAR_PRESETS[selectedMoleculeKey] || MOLECULAR_PRESETS.H2O;
      activeAtoms = preset.atoms;
      activeFormula = preset.formula;
      currentPolytopeStatus = 'accepted';
    }
    const preset = { formula: activeFormula, atoms: activeAtoms };
    const gridDim = activeBasis === '6-31g(d)' ? 16 : 18;
    const built = buildMolecularChargeDensityArtifact(preset.atoms, {
      formula: preset.formula,
      basis: activeBasis,
      gridDim,
      includeUmp2: false,
      includeAnalyticGradient: false,
      includeOrbitals: true
    });
    currentMolecularArtifact = built.artifact;

    // Real MaterialPolytopeRegistry state-domain membership evaluation (fail-closed)
    polytopeRegistry.discoverMaterialPolytopes({
      materialKey: preset.formula,
      family: 'compound',
      meltingPointK: preset.formula === 'H2O' ? 273.15 : 150,
      boilingPointK: preset.formula === 'H2O' ? 373.15 : 300,
      closureHash: `${preset.formula}:${activeBasis}:${nebModeActive ? 'neb' : 'eq'}`
    });
    const probeTempK = nebModeActive ? (298.15 + nebReactionXi * 140.0) : 298.15;
    currentPolytopeResolution = polytopeRegistry.resolveState(preset.formula, {
      temperatureK: probeTempK,
      pressurePa: 101325
    });
    if (!nebModeActive) {
      currentPolytopeStatus = currentPolytopeResolution.status;
    } else if (currentPolytopeResolution.status !== 'accepted') {
      currentPolytopeStatus = 'boundary-saddle';
    }

    // Optional Polytope Validity-Domain wireframe overlay driven by MaterialPolytopeRegistry
    if (showPolytopeOverlay) {
      const polyColor = currentPolytopeStatus === 'accepted' ? 0x34d399 : 0xfbbf24;
      const polyBox = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(6.8, 5.2, 5.2)),
        new THREE.LineBasicMaterial({ color: polyColor, transparent: true, opacity: 0.34 })
      );
      molecularGroup.add(polyBox);
    }

    let activeField = built.densePayloads[built.artifact.grid.payloadHandles.chargeDensity.key];
    currentMolecularBackend = 'worker-cpu-derived';
    if (molecularViewMode === 'density' && gpuDevice) {
      try {
        const gpuRes = await sampleMolecularChargeDensityWebGpu(gpuDevice, {
          basis: built.hf.basis,
          densityMatrix: built.hf.P,
          boundsMinBohr: built.artifact.grid.boundsMinBohr,
          boundsMaxBohr: built.artifact.grid.boundsMaxBohr,
          dimensions: built.artifact.grid.dimensions
        });
        activeField = gpuRes.density;
        currentMolecularBackend = gpuRes.statusBadge;
      } catch {
        currentMolecularBackend = 'worker-cpu-derived';
      }
    } else if (molecularViewMode === 'homo' && built.artifact.grid.payloadHandles.homoOrbital) {
      activeField = built.densePayloads[built.artifact.grid.payloadHandles.homoOrbital.key];
    } else if (molecularViewMode === 'lumo' && built.artifact.grid.payloadHandles.lumoOrbital) {
      activeField = built.densePayloads[built.artifact.grid.payloadHandles.lumoOrbital.key];
    }

    currentMolecularBundle = buildMaterialDerivationVisualizationBundle({
      materialKey: preset.formula.toLowerCase(),
      formula: preset.formula,
      atoms: preset.atoms,
      basis: 'sto-3g',
      functional: selectedFunctional,
      gridDim: 10,
      includeUmp2: false,
      includeQhaClosure: false,
      includeTriadA4Replay: true
    }).bundle;

    const scale = 1.95;
    for (let i = 0; i < preset.atoms.length; i += 1) {
      const a = preset.atoms[i];
      const rad = a.Z === 1 ? 0.42 : 0.72;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(rad, 28, 22),
        new THREE.MeshStandardMaterial({
          color: CPK_COLORS[a.Z] ?? 0x94a3b8,
          emissive: CPK_COLORS[a.Z] ?? 0x475569,
          emissiveIntensity: 0.25,
          roughness: 0.25,
          metalness: 0.22
        })
      );
      mesh.position.set(a.position[0] * scale, a.position[1] * scale, a.position[2] * scale);
      molecularGroup.add(mesh);
    }

    for (const bond of built.artifact.bondDiscoveryTrace.bonds) {
      const pA = new THREE.Vector3(...preset.atoms[bond.atomA].position).multiplyScalar(scale);
      const pB = new THREE.Vector3(...preset.atoms[bond.atomB].position).multiplyScalar(scale);
      const dir = new THREE.Vector3().subVectors(pB, pA);
      const len = dir.length();
      const cylRadius = 0.1 + 0.1 * Math.min(3, bond.mayerBondOrder);
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(cylRadius, cylRadius, len, 20),
        new THREE.MeshStandardMaterial({
          color: 0x99f6e4,
          emissive: 0x14b8a6,
          emissiveIntensity: 0.35,
          roughness: 0.28,
          metalness: 0.2
        })
      );
      cyl.position.copy(pA).add(pB).multiplyScalar(0.5);
      cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      molecularGroup.add(cyl);
    }

    const [nx, ny, nz] = built.artifact.grid.dimensions;
    const minB = built.artifact.grid.boundsMinBohr;
    const step = built.artifact.grid.voxelSpacingBohr;
    let peak = 0;
    for (let i = 0; i < activeField.length; i += 1) {
      const av = Math.abs(activeField[i]);
      if (av > peak) peak = av;
    }
    const thresh = peak * (molecularViewMode === 'density' ? 0.004 : 0.045);
    const activeCells = [];
    const cdf = [];
    let cdfSum = 0;
    let idx = 0;
    for (let iz = 0; iz < nz; iz += 1) {
      for (let iy = 0; iy < ny; iy += 1) {
        for (let ix = 0; ix < nx; ix += 1) {
          const val = activeField[idx++];
          const mag = Math.abs(val);
          if (mag < thresh) continue;
          const weight = Math.pow(mag / Math.max(1e-9, peak), 0.55);
          cdfSum += weight;
          activeCells.push({ ix, iy, iz, val, mag });
          cdf.push(cdfSum);
        }
      }
    }
    if (activeCells.length > 0 && cdfSum > 0) {
      const sampleCount = 2600;
      const cloudMesh = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.075,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        }),
        sampleCount
      );
      cloudMesh.frustumCulled = false;
      let seed = 918273;
      const rnd = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const baseVoxelRad = Math.min(step[0], step[1], step[2]) * scale * 0.34;
      for (let i = 0; i < sampleCount; i += 1) {
        const u = rnd() * cdfSum;
        let lo = 0; let hi = cdf.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (cdf[mid] < u) lo = mid + 1;
          else hi = mid;
        }
        const cell = activeCells[lo];
        const x = (minB[0] + (cell.ix + (rnd() - 0.5)) * step[0]) * scale;
        const y = (minB[1] + (cell.iy + (rnd() - 0.5)) * step[1]) * scale;
        const z = (minB[2] + (cell.iz + (rnd() - 0.5)) * step[2]) * scale;
        const intensity = Math.min(1, Math.pow(cell.mag / Math.max(1e-9, peak), 0.35));
        instDummy.position.set(x, y, z);
        instDummy.scale.setScalar(baseVoxelRad * (0.45 + 0.85 * intensity));
        instDummy.updateMatrix();
        cloudMesh.setMatrixAt(i, instDummy.matrix);
        if (molecularViewMode === 'density') {
          instColor.setRGB(0.10 + 0.52 * intensity, 0.72 + 0.28 * intensity, 1.0);
        } else if (cell.val >= 0) {
          instColor.setRGB(0.12, 0.85 * intensity + 0.15, 1.0);
        } else {
          instColor.setRGB(1.0, 0.28 * intensity + 0.14, 0.52);
        }
        cloudMesh.setColorAt(i, instColor);
      }
      cloudMesh.instanceMatrix.needsUpdate = true;
      if (cloudMesh.instanceColor) cloudMesh.instanceColor.needsUpdate = true;
      molecularGroup.add(cloudMesh);
    }
  }

  // ---- 6. Atomic Schrödinger KS-DFT 3D Volumetric Orbital Raymarcher (10^-11 m) ----
  const atomicGroup = regimeGroups['atomic-orbital'];
  let currentAtomicArtifact = null;
  let currentOrbitalRaymarcher = null;

  function rebuildAtomicScene() {
    if (currentOrbitalRaymarcher) {
      atomicGroup.remove(currentOrbitalRaymarcher.mesh);
      currentOrbitalRaymarcher.dispose();
      currentOrbitalRaymarcher = null;
    }
    disposeGroupChildren(atomicGroup);
    const built = buildAtomicRadialDensityArtifact(selectedElementZ, {
      functional: selectedFunctional,
      scalarRelativistic: true,
      spinOrbit: true,
      gridPointsN: 520,
      cloudGridDim: 16,
      maxGridDim: 24
    });
    currentAtomicArtifact = built.artifact;
    const halfB = built.artifact.orbitalCloudGrid.boundsBohr.max[0];
    const normScale = 4.9 / Math.max(1.5, halfB);

    const nuc = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    const nucGlow = createSoftGlowSprite(spriteTex, 0xfbbf24, 2.4, 0.90);
    atomicGroup.add(nuc, nucGlow);

    const r95Scaled = Math.min(5.0, built.artifact.summary.containmentRadii.r95Bohr * normScale);
    const shellWire = new THREE.Mesh(
      new THREE.SphereGeometry(r95Scaled, 28, 18),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, transparent: true, opacity: 0.16 })
    );
    atomicGroup.add(shellWire);

    currentOrbitalRaymarcher = createVolumetricOrbitalRaymarcher({
      THREE,
      TSL,
      renderer,
      radialSamples: built.artifact.radialProfile.samples || [],
      orbitalWavefunctions: built.artifact.radialProfile.orbitalWavefunctions || null,
      rMaxBohr: built.artifact.radialProfile.rMaxBohr || halfB,
      r95Bohr: built.artifact.summary.containmentRadii.r95Bohr || 2.5,
      modeId: selectedOrbitalMode,
      boxHalfExtent: 5.1,
      dim: 40
    });
    atomicGroup.add(currentOrbitalRaymarcher.mesh);
  }

  // Initial quantum -> continuum -> molecular build (plus auto-connect PeerCompute relay if requested via URL)
  rebuildAtomicScene();
  await rebuildContinuumFromQuantumElement();
  await rebuildMolecularScene();
  if (peerRelayUrl) {
    await connectPeerMesh({ relayUrl: peerRelayUrl, roomId: peerRoomId, role: peerRole });
  }

  // ---- HUD & Interactive Controls ----
  const topBar = document.createElement('div');
  topBar.style.cssText = 'position:absolute;top:14px;left:16px;right:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;pointer-events:none;z-index:10;';
  topBar.innerHTML = `
    <div style="pointer-events:auto;display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:10px;background:rgba(6,14,24,0.82);border:1px solid rgba(94,234,212,0.28);backdrop-filter:blur(10px);">
      <span style="width:9px;height:9px;border-radius:50%;background:#34d399;box-shadow:0 0 10px #34d399;"></span>
      <div>
        <div id="cq-regime-title" style="font-size:13px;font-weight:700;letter-spacing:0.01em;color:#f0fdf4;">Galactic N-Body</div>
        <div id="cq-scale-readout" style="font-size:11px;font-family:monospace;color:#7dd3fc;">10^20.6 m · Chart L=70</div>
      </div>
    </div>
    <div style="pointer-events:auto;display:flex;align-items:center;gap:8px;">
      <button id="cq-tour-btn" type="button" style="padding:7px 12px;border-radius:8px;border:1px solid rgba(94,234,212,0.45);background:rgba(16,42,48,0.88);color:#99f6e4;font-size:12px;font-weight:600;cursor:pointer;">▶ Powers of Ten Tour</button>
      <button id="cq-play-btn" type="button" style="padding:7px 12px;border-radius:8px;border:1px solid rgba(148,163,184,0.35);background:rgba(12,22,34,0.86);color:#e2e8f0;font-size:12px;font-weight:600;cursor:pointer;">⏸ Sim Running</button>
      <a href="./stellar-genesis.html" style="padding:7px 12px;border-radius:8px;border:1px solid rgba(56,189,248,0.45);background:rgba(10,32,52,0.86);color:#bae6fd;font-size:12px;font-weight:600;text-decoration:none;">Stellar Genesis ↗</a>
      <a href="./?preset=iron-ice-quench" style="padding:7px 12px;border-radius:8px;border:1px solid rgba(251,191,36,0.4);background:rgba(36,24,10,0.85);color:#fde68a;font-size:12px;font-weight:600;text-decoration:none;">SPH Lab ↗</a>
    </div>
  `;
  root.appendChild(topBar);

  const sidePanel = document.createElement('aside');
  sidePanel.id = 'cq-inspector';
  sidePanel.style.cssText = 'position:absolute;top:72px;right:16px;width:320px;max-height:calc(100vh - 178px);overflow:auto;padding:14px;border-radius:12px;background:rgba(6,14,24,0.84);border:1px solid rgba(148,186,180,0.24);backdrop-filter:blur(12px);font-size:12px;line-height:1.45;z-index:10;display:flex;flex-direction:column;gap:10px;';
  root.appendChild(sidePanel);

  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = 'position:absolute;left:16px;right:16px;bottom:14px;padding:10px 14px;border-radius:12px;background:rgba(6,14,24,0.86);border:1px solid rgba(94,234,212,0.24);backdrop-filter:blur(10px);z-index:10;display:flex;flex-direction:column;gap:8px;';
  bottomBar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:11px;font-family:monospace;color:#94a3b8;white-space:nowrap;">10⁻¹¹ m</span>
      <input id="cq-zoom-slider" type="range" min="-11.3" max="27.2" step="0.05" value="${currentLog10}" style="flex:1;accent-color:#34d399;cursor:pointer;" />
      <span style="font-size:11px;font-family:monospace;color:#94a3b8;white-space:nowrap;">10²⁷ m (93 Gly)</span>
    </div>
    <div id="cq-regime-pills" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:space-between;"></div>
  `;
  root.appendChild(bottomBar);

  const pillsHost = bottomBar.querySelector('#cq-regime-pills');
  const pillButtons = new Map();
  const pillShortLabels = {
    'atomic-orbital': '10⁻¹¹m Atomic DFT',
    'molecular-lattice': '10⁻⁹m Molecular 6-31G(d)',
    'continuum-sph-solids': '10⁰m Continuum & A4',
    'planetary-orbital': '10¹⁰m Planetary',
    'galactic-nbody': '10²¹m Galactic N-Body',
    'supergalactic-cosmic': '10²⁷m Cosmic Web'
  };
  for (const r of COSMIC_QUANTUM_SCALE_REGIMES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.regimeJump = r.id;
    btn.textContent = pillShortLabels[r.id] || r.id;
    btn.style.cssText = 'flex:1;min-width:128px;padding:5px 8px;border-radius:7px;border:1px solid rgba(148,163,184,0.25);background:rgba(12,24,36,0.75);color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;';
    btn.addEventListener('click', () => {
      tourRunning = false;
      updateTourButton();
      targetLog10 = REGIME_CENTERS_LOG10[r.id];
    });
    pillsHost.appendChild(btn);
    pillButtons.set(r.id, btn);
  }

  const regimeTitleEl = topBar.querySelector('#cq-regime-title');
  const scaleReadoutEl = topBar.querySelector('#cq-scale-readout');
  const tourBtn = topBar.querySelector('#cq-tour-btn');
  const playBtn = topBar.querySelector('#cq-play-btn');
  const zoomSlider = bottomBar.querySelector('#cq-zoom-slider');

  function updateTourButton() {
    tourBtn.textContent = tourRunning ? '⏸ Stop Zoom Tour' : '▶ Powers of Ten Tour';
  }
  function updatePlayButton() {
    playBtn.textContent = simRunning ? '⏸ Sim Running' : '▶ Sim Paused';
  }
  tourBtn.addEventListener('click', () => {
    tourRunning = !tourRunning;
    updateTourButton();
  });
  playBtn.addEventListener('click', () => {
    simRunning = !simRunning;
    updatePlayButton();
  });
  zoomSlider.addEventListener('input', () => {
    tourRunning = false;
    updateTourButton();
    targetLog10 = Number(zoomSlider.value);
  });

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
    const dx = e.clientX - lastPtrX;
    const dy = e.clientY - lastPtrY;
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
    camYaw -= dx * 0.006;
    camPitch = Math.max(-1.25, Math.min(1.25, camPitch + dy * 0.006));
  });
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    tourRunning = false;
    updateTourButton();
    targetLog10 = Math.max(-11.3, Math.min(27.2, targetLog10 + e.deltaY * 0.0035));
  }, { passive: false });

  let lastInspectorRegimeId = null;
  let lastLeaseSummary = null;

  function renderInspectorPanel(camState) {
    const rid = camState.primaryRegime.id;
    const bridgeSum = scaleBridge.summary();
    const atomic = currentAtomicArtifact;
    const mol = currentMolecularArtifact;
    const elProps = currentElementResolution?.properties;
    const bundleVal = currentMolecularBundle
      ? validateDerivationVisualizationBundle(currentMolecularBundle, {
        expectedGeneratorFingerprint: QUANTUM_DERIVATION_GENERATOR_FINGERPRINT,
        strict: true
      })
      : null;

    const mpBadge = crossChartMultipoleReceipt
      ? `<span style="color:#34d399;">${crossChartMultipoleReceipt.verified ? 'PASS' : 'WARN'}</span> (|ΣF|=${crossChartMultipoleReceipt.momentumRelError.toExponential(1)})`
      : 'CPU-only';

    let regimeSpecificHtml = '';
    if (rid === 'atomic-orbital' && atomic) {
      const soOrbitals = atomic.orbitals.filter((o) => o.spinOrbitSplittingHa > 0);
      const soLine = soOrbitals.length > 0
        ? soOrbitals.slice(-2).map((o) => `${o.n}${'spdf'[o.l] || o.l}: ${(o.spinOrbitSplittingHa * HA_TO_EV).toFixed(3)} eV`).join(' · ')
        : 's-shell only (ΔE_SO = 0)';
      const phaseBadge = elProps?.standardPhaseAt298K?.toUpperCase() || '—';
      const orbButtons = VOLUMETRIC_ORBITAL_MODES.map((m) =>
        `<button type="button" data-orbital-mode="${m.id}" style="padding:3px 5px;border-radius:4px;border:1px solid ${selectedOrbitalMode === m.id ? '#34d399' : 'rgba(148,163,184,0.28)'};background:${selectedOrbitalMode === m.id ? 'rgba(52,211,153,0.18)' : '#0b1724'};color:#e2f1ec;font-size:10px;cursor:pointer;">${m.label}</button>`
      ).join('');
      regimeSpecificHtml = `
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#5eead4;margin-bottom:6px;">Schrödinger Relativistic KS-DFT (3D Volumetric)</div>
          <div style="display:flex;gap:6px;margin-bottom:6px;">
            <select id="cq-elem-sel" style="flex:1;padding:4px 6px;border-radius:6px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(94,234,212,0.3);">
              ${ATOMIC_CHOICES.map((c) => `<option value="${c.Z}" ${c.Z === selectedElementZ ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
            <select id="cq-func-sel" style="width:72px;padding:4px 6px;border-radius:6px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(94,234,212,0.3);">
              <option value="pbe" ${selectedFunctional === 'pbe' ? 'selected' : ''}>PBE</option>
              <option value="lda" ${selectedFunctional === 'lda' ? 'selected' : ''}>LDA</option>
            </select>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">${orbButtons}</div>
          ${buildRadialProfileSvg(atomic)}
          <div style="margin-top:6px;font-family:monospace;font-size:11px;color:#cbd5e1;">
            E_tot: ${atomic.summary.totalEnergyHa.toFixed(3)} Ha · ∫ρ=${atomic.summary.integratedElectrons.toFixed(4)}e<br/>
            SO (L·S): ${soLine}<br/>
            Bulk @293K: <span style="color:#6ee7b7;">${phaseBadge}</span> (Tm=${Math.round(elProps?.meltingPointK ?? elProps?.vdwGasProperties?.meltingPointK ?? 0)}K, Tb=${Math.round(elProps?.boilingPointK ?? elProps?.vdwGasProperties?.boilingPointK ?? 0)}K)<br/>
            Volume: <span style="color:#7dd3fc;">${currentOrbitalRaymarcher?.mode || 'fallback'}</span><br/>
            Label: <span style="color:#fde68a;">${currentOrbitalRaymarcher?.provenance || 'radial-atomic-density-reconstruction'}</span>
          </div>
        </div>
      `;
    } else if (rid === 'molecular-lattice' && mol) {
      const bondStr = mol.bondDiscoveryTrace.bonds.map((b) => `B=${b.mayerBondOrder.toFixed(2)} (${(b.distanceM * 1e12).toFixed(0)}pm)`).join(', ');
      const nebSvg = nebModeActive ? buildNebEnergySvg(ensureNebReactionPath(), nebReactionXi) : '';
      regimeSpecificHtml = `
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#5eead4;margin-bottom:6px;">Molecular HF Density, CI-NEB &amp; Polytopes</div>
          <div style="display:flex;gap:6px;margin-bottom:6px;">
            <select id="cq-mol-sel" style="flex:1;padding:4px 6px;border-radius:6px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(94,234,212,0.3);">
              ${Object.values(MOLECULAR_PRESETS).map((m) => `<option value="${m.formula}" ${m.formula === selectedMoleculeKey ? 'selected' : ''}>${m.label}</option>`).join('')}
            </select>
            <select id="cq-basis-sel" style="width:90px;padding:4px 6px;border-radius:6px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(94,234,212,0.3);">
              <option value="sto-3g" ${selectedBasis === 'sto-3g' ? 'selected' : ''}>STO-3G</option>
              <option value="6-31g(d)" ${selectedBasis === '6-31g(d)' ? 'selected' : ''}>6-31G(d)</option>
            </select>
          </div>
          <div style="display:flex;gap:4px;margin-bottom:6px;">
            ${['density', 'homo', 'lumo'].map((m) => `<button type="button" data-mol-view="${m}" style="flex:1;padding:4px;border-radius:5px;border:1px solid ${molecularViewMode === m ? '#34d399' : 'rgba(148,163,184,0.3)'};background:${molecularViewMode === m ? 'rgba(52,211,153,0.18)' : '#0b1724'};color:#e2f1ec;font-size:11px;cursor:pointer;">${m.toUpperCase()}</button>`).join('')}
            <button id="cq-neb-toggle" type="button" style="padding:4px 7px;border-radius:5px;border:1px solid ${nebModeActive ? '#fbbf24' : 'rgba(148,163,184,0.3)'};background:${nebModeActive ? 'rgba(251,191,36,0.2)' : '#0b1724'};color:#fde68a;font-size:11px;cursor:pointer;">CI-NEB</button>
          </div>
          ${nebModeActive ? `
            ${nebSvg}
            <div style="display:flex;align-items:center;gap:6px;margin:6px 0;">
              <span style="font-size:10px;font-family:monospace;color:#fde68a;">ξ=${nebReactionXi.toFixed(2)}</span>
              <input id="cq-neb-slider" type="range" min="0" max="1" step="0.05" value="${nebReactionXi}" style="flex:1;accent-color:#fbbf24;" />
            </div>
          ` : ''}
          <div style="font-family:monospace;font-size:11px;color:#cbd5e1;">
            E_RHF: ${mol.electronicSummary.rhfTotalEnergyHa.toFixed(4)} Ha (${mol.electronicSummary.nBasis} AOs)<br/>
            HOMO-LUMO: ${mol.electronicSummary.homoLumoGapHa != null ? (mol.electronicSummary.homoLumoGapHa * HA_TO_EV).toFixed(2) + ' eV' : '—'}<br/>
            Mayer: ${bondStr || 'none'}<br/>
            Polytope: <span style="color:${currentPolytopeStatus === 'accepted' ? '#34d399' : '#fbbf24'};">${currentPolytopeStatus}</span> · Sampler: <span style="color:#7dd3fc;">${currentMolecularBackend}</span> · Strict: ${bundleVal?.ok ? 'PASS' : 'BLOCKED'}
          </div>
        </div>
      `;
    } else if (rid === 'continuum-sph-solids') {
      const tm = Math.round(elProps?.meltingPointK ?? elProps?.vdwGasProperties?.meltingPointK ?? 0);
      const tb = Math.round(elProps?.boilingPointK ?? elProps?.vdwGasProperties?.boilingPointK ?? 0);
      const rho = Math.round(elProps?.densityKgPerM3 ?? elProps?.vdwGasProperties?.condensedDensityKgPerM3 ?? 0);
      const bGpa = ((elProps?.bulkModulusPa ?? elProps?.vdwGasProperties?.bulkModulusPa ?? 0) / 1e9).toFixed(1);
      const cStats = continuumPresenter?.getStats();
      regimeSpecificHtml = `
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#5eead4;margin-bottom:6px;">Quantum → Live GPU Continuum &amp; Eshkol A4</div>
          <select id="cq-cont-elem-sel" style="width:100%;margin-bottom:6px;padding:4px 6px;border-radius:6px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(94,234,212,0.3);">
            ${ATOMIC_CHOICES.map((c) => `<option value="${c.Z}" ${c.Z === selectedElementZ ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
          <div style="font-family:monospace;font-size:11px;color:#cbd5e1;">
            Element: <span style="color:#fef08a;">${elProps?.symbol || '?'}</span> (${elProps?.bondingClass || 'derived'})<br/>
            Phase @293K: <span style="color:#34d399;font-weight:700;">${(elProps?.standardPhaseAt298K || 'solid').toUpperCase()}</span> · Tm=${tm}K · Tb=${tb}K<br/>
            ρ=${rho.toLocaleString()} kg/m³ · B=${bGpa} GPa<br/>
            Micro-SPH: ${continuumEngine?.count ?? 0} pts · <span style="color:#7dd3fc;">${cStats?.zeroCopy ? 'zero-copy GPU (0 B/frame)' : 'cpu-instanced'}</span><br/>
            Resolver: <span style="color:#6ee7b7;">${currentElementResolution?.derivedBackend || currentElementResolution?.resolverStatus || 'cpu-derived'}</span> (${currentElementResolution?.resolverStatus || 'derived'})
          </div>
        </div>
      `;
    } else if (rid === 'galactic-nbody') {
      const pStats = galacticPresenter?.getStats();
      regimeSpecificHtml = `
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#fbbf24;margin-bottom:6px;">Galactic WebGPU N-Body (Eshkol ABI)</div>
          <div style="display:flex;gap:4px;margin-bottom:5px;">
            ${[['disk', 'Spiral'], ['binary', 'Merger'], ['sphere', 'Globular']].map(([id, lbl]) =>
              `<button type="button" data-galaxy-preset="${id}" style="flex:1;padding:4px;border-radius:5px;border:1px solid ${galaxyPreset === id ? '#fbbf24' : 'rgba(148,163,184,0.3)'};background:${galaxyPreset === id ? 'rgba(251,191,36,0.16)' : '#0b1724'};color:#fef3c7;font-size:11px;cursor:pointer;">${lbl}</button>`
            ).join('')}
          </div>
          <div style="display:flex;gap:4px;margin-bottom:6px;">
            ${Object.values(GALAXY_TIERS).map((t) =>
              `<button type="button" data-galaxy-tier="${t.id}" style="flex:1;padding:3px;border-radius:5px;border:1px solid ${galaxyTierId === t.id ? '#34d399' : 'rgba(148,163,184,0.28)'};background:${galaxyTierId === t.id ? 'rgba(52,211,153,0.16)' : '#0b1724'};color:#d1fae5;font-size:10px;cursor:pointer;">${t.label}</button>`
            ).join('')}
          </div>
          <div style="font-family:monospace;font-size:11px;color:#cbd5e1;">
            Bodies: ${galacticEngine.count.toLocaleString()} · Step: <span id="cq-gal-step">${galacticEngine.stepIndex}</span><br/>
            Solver: <span style="color:#34d399;">${galacticEngine.gravityMode}</span><br/>
            Presenter: <span style="color:#7dd3fc;">${pStats?.zeroCopy ? 'zero-copy GPU (0 B/frame)' : 'cpu-instanced'}</span><br/>
            Lease Epoch: <span id="cq-lease-epoch">${lastLeaseSummary?.resetEpoch ?? 0}</span> · Valid: true
          </div>
        </div>
      `;
    } else if (rid === 'supergalactic-cosmic') {
      const z = Math.max(0, 1 / Math.max(0.05, cosmicWebEngine.scaleFactorA) - 1);
      regimeSpecificHtml = `
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#a5b4fc;margin-bottom:4px;">Observable Universe Comoving Headroom</div>
          <div style="font-family:monospace;font-size:11px;color:#cbd5e1;">
            Horizon: ~93 Gly (8.8×10²⁶ m) · L=90<br/>
            a(t): <span id="cq-cosmo-a">${cosmicWebEngine.scaleFactorA.toFixed(3)}</span> · Redshift z: <span id="cq-cosmo-z">${z.toFixed(2)}</span><br/>
            H(a): ${camState.cosmologyFrame.hubbleParameterPerS.toExponential(2)} s⁻¹<br/>
            Nodes: ${cosmicWebEngine.count.toLocaleString()} · ${cosmicPresenter.zeroCopy ? 'zero-copy GPU' : 'cpu-instanced'}
          </div>
        </div>
      `;
    } else {
      regimeSpecificHtml = `
        <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
          <div style="font-weight:600;color:#7dd3fc;margin-bottom:4px;">Planetary Orbital Chart (L=33)</div>
          <div style="font-family:monospace;font-size:11px;color:#cbd5e1;">
            Live WebGPU Newtonian N-body (${planetaryEngine.count} bodies · step <span id="cq-plan-step">${planetaryEngine.stepIndex}</span>)<br/>
            Coupled via GPU cross-chart multipole to L=70 &amp; L=90
          </div>
        </div>
      `;
    }

    const peerCountNow = typeof peerMesh?.handle?.getPeers === 'function'
      ? peerMesh.handle.getPeers().length
      : peerMeshState.remotePeers;
    peerMeshState.remotePeers = peerCountNow;
    peerMeshState.quorumReady = peerMeshState.connected && peerCountNow >= 2;
    const peerSectionHtml = `
      <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-weight:600;color:#c4b5fd;font-size:11px;">PeerCompute Mesh</span>
          <span id="cq-peer-badge" style="font-family:monospace;font-size:10px;color:${peerMeshState.connected ? '#34d399' : '#94a3b8'};">${peerMeshState.connected ? `${peerMeshState.role} · peers=${peerCountNow}` : 'local-only'}</span>
        </div>
        <div style="display:flex;gap:4px;margin-bottom:4px;">
          <input id="cq-peer-url" type="text" placeholder="ws://127.0.0.1:8787" value="${peerRelayUrl}" style="flex:1;min-width:0;padding:3px 6px;border-radius:5px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(167,139,250,0.3);font-size:10px;font-family:monospace;" />
          <select id="cq-peer-role" style="width:74px;padding:3px;border-radius:5px;background:#0b1724;color:#e2f1ec;border:1px solid rgba(167,139,250,0.3);font-size:10px;">
            <option value="requester" ${peerRole === 'requester' ? 'selected' : ''}>Req</option>
            <option value="responder" ${peerRole === 'responder' ? 'selected' : ''}>Resp</option>
            <option value="observer" ${peerRole === 'observer' ? 'selected' : ''}>Obs</option>
          </select>
          <button id="cq-peer-connect" type="button" style="padding:3px 7px;border-radius:5px;border:1px solid rgba(167,139,250,0.45);background:rgba(76,29,149,0.35);color:#ddd6fe;font-size:10px;cursor:pointer;">${peerMeshState.connected ? 'Off' : 'Join'}</button>
        </div>
      </div>
    `;

    sidePanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;letter-spacing:0.04em;font-size:11px;text-transform:uppercase;color:#94a3b8;">Schroeder Scale Atlas</span>
        <span style="padding:2px 6px;border-radius:4px;background:rgba(52,211,153,0.15);color:#6ee7b7;font-family:monospace;font-size:10px;">${bridgeSum.totalSpanOrdersOfMagnitude.toFixed(1)} OOM</span>
      </div>
      <div style="font-family:monospace;font-size:11px;color:#94a3b8;line-height:1.5;">
        Chart: <span style="color:#e2f1ec;">#${camState.primaryChartId} (L=${camState.primaryRegime.globalBaseLevel})</span> · Active: ${bridgeSum.activeChartCount}<br/>
        Module: <span style="color:#7dd3fc;">${camState.primaryMethodKey}</span><br/>
        Device: <span style="color:#e2f1ec;">${gpuAdapterName.slice(0, 24)} (${rendererBackend})</span><br/>
        Multipole: ${mpBadge}<br/>
        Validation: <span style="color:#fde68a;">scientificValidation=false</span>
      </div>
      ${regimeSpecificHtml}
      ${peerSectionHtml}
    `;

    // Wire dynamic regime controls
    const onElementChange = async (nextZ) => {
      selectedElementZ = nextZ;
      rebuildAtomicScene();
      await rebuildContinuumFromQuantumElement();
      renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
    };
    sidePanel.querySelector('#cq-elem-sel')?.addEventListener('change', (e) => { void onElementChange(Number(e.target.value)); });
    sidePanel.querySelector('#cq-cont-elem-sel')?.addEventListener('change', (e) => { void onElementChange(Number(e.target.value)); });
    sidePanel.querySelector('#cq-func-sel')?.addEventListener('change', async (e) => {
      selectedFunctional = e.target.value;
      rebuildAtomicScene();
      await rebuildContinuumFromQuantumElement();
      renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
    });
    for (const btn of sidePanel.querySelectorAll('[data-orbital-mode]')) {
      btn.addEventListener('click', () => {
        selectedOrbitalMode = btn.dataset.orbitalMode;
        rebuildAtomicScene();
        renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
      });
    }
    sidePanel.querySelector('#cq-mol-sel')?.addEventListener('change', async (e) => {
      nebModeActive = false;
      selectedMoleculeKey = e.target.value;
      await rebuildMolecularScene();
      renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
    });
    sidePanel.querySelector('#cq-basis-sel')?.addEventListener('change', async (e) => {
      selectedBasis = e.target.value;
      await rebuildMolecularScene();
      renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
    });
    for (const btn of sidePanel.querySelectorAll('[data-mol-view]')) {
      btn.addEventListener('click', async () => {
        molecularViewMode = btn.dataset.molView;
        await rebuildMolecularScene();
        renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
      });
    }
    sidePanel.querySelector('#cq-neb-toggle')?.addEventListener('click', async () => {
      nebModeActive = !nebModeActive;
      await rebuildMolecularScene();
      renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
    });
    sidePanel.querySelector('#cq-neb-slider')?.addEventListener('input', async (e) => {
      nebReactionXi = Number(e.target.value);
      await rebuildMolecularScene();
      renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
    });
    sidePanel.querySelector('#cq-peer-connect')?.addEventListener('click', async () => {
      if (peerMeshState.connected) {
        await disconnectPeerMesh();
      } else {
        const nextUrl = sidePanel.querySelector('#cq-peer-url')?.value || '';
        const nextRole = sidePanel.querySelector('#cq-peer-role')?.value || 'requester';
        await connectPeerMesh({ relayUrl: nextUrl, roomId: peerRoomId, role: nextRole });
      }
      renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
    });
    for (const btn of sidePanel.querySelectorAll('[data-galaxy-preset]')) {
      btn.addEventListener('click', async () => {
        await rebuildGalacticSimulation({ tierId: galaxyTierId, preset: btn.dataset.galaxyPreset });
        renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
      });
    }
    for (const btn of sidePanel.querySelectorAll('[data-galaxy-tier]')) {
      btn.addEventListener('click', async () => {
        await rebuildGalacticSimulation({ tierId: btn.dataset.galaxyTier, preset: galaxyPreset });
        renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
      });
    }
  }

  // Zero-copy GPU dispatch via ULG SimulationModuleRegistry
  let gpuStepBusy = false;
  async function stepActiveGpuModules(camState) {
    if (gpuStepBusy) return;
    gpuStepBusy = true;
    try {
      const rid = camState.primaryRegime.id;
      const sec = camState.secondaryRegime?.id;
      if ((rid === 'continuum-sph-solids' || sec === 'continuum-sph-solids') && continuumEngine && continuumPresenter) {
        const cap = createUlgTaskCapsule({
          taskId: `cq-cont-${continuumEngine.stepIndex}`,
          serviceId: ULG_SERVICE_IDS.ulgRuntime,
          taskKind: ULG_TASK_KINDS.simulationStep,
          method: { model: 'continuum-micro-sph', version: 1 },
          input: {
            stepIndex: continuumEngine.stepIndex,
            parameters: { dt: 0.015, gravity: 1.8, readback: !continuumPresenter.zeroCopy }
          }
        });
        const res = await moduleRegistry.dispatchSimulationStepCapsule(cap, { device: gpuDevice });
        lastLeaseSummary = res.leaseSummary;
        continuumPresenter.bindLeaseHandle(res.leaseHandle);
        res.leaseHandle?.release?.();
      }
      if (rid === 'planetary-orbital' || sec === 'planetary-orbital') {
        const cap = createUlgTaskCapsule({
          taskId: `cq-plan-${planetaryEngine.stepIndex}`,
          serviceId: ULG_SERVICE_IDS.ulgRuntime,
          taskKind: ULG_TASK_KINDS.simulationStep,
          method: { model: 'planetary-nbody', version: 1 },
          input: {
            stepIndex: planetaryEngine.stepIndex,
            parameters: { dt: 0.014, gravity: 1.0, softening: 0.02, readback: true }
          }
        });
        const res = await moduleRegistry.dispatchSimulationStepCapsule(cap, { device: gpuDevice });
        lastLeaseSummary = res.leaseSummary;
        syncPlanetaryMeshesFromGpu(planetaryEngine.getBodies());
        res.leaseHandle?.release?.();
      }
      if (rid === 'galactic-nbody' || sec === 'galactic-nbody') {
        const cap = createUlgTaskCapsule({
          taskId: `cq-gal-${galacticEngine.stepIndex}`,
          serviceId: ULG_SERVICE_IDS.ulgRuntime,
          taskKind: ULG_TASK_KINDS.simulationStep,
          method: { model: 'nbody-gravity', version: 1 },
          input: {
            stepIndex: galacticEngine.stepIndex,
            parameters: { dt: galaxyDt, gravity: galaxyGravity, softening: 0.24, readback: !galacticPresenter.zeroCopy }
          }
        });
        const res = await moduleRegistry.dispatchSimulationStepCapsule(cap, { device: gpuDevice });
        lastLeaseSummary = res.leaseSummary;
        if (galacticPresenter.zeroCopy) {
          galacticPresenter.bindLeaseHandle(res.leaseHandle);
        } else {
          galacticPresenter.syncFromCpuBodies(galacticEngine.getBodies());
        }
        res.leaseHandle?.release?.();
      }
      if (rid === 'supergalactic-cosmic' || sec === 'supergalactic-cosmic') {
        const cap = createUlgTaskCapsule({
          taskId: `cq-cosmo-${cosmicWebEngine.stepIndex}`,
          serviceId: ULG_SERVICE_IDS.ulgRuntime,
          taskKind: ULG_TASK_KINDS.simulationStep,
          method: { model: 'cosmology-comoving-nbody', version: 1 },
          input: {
            stepIndex: cosmicWebEngine.stepIndex,
            parameters: { dt: 0.016, gravity: 0.08, softening: 0.85, hubbleRate: hubbleExpansionSpeed, readback: !cosmicPresenter.zeroCopy }
          }
        });
        const res = await moduleRegistry.dispatchSimulationStepCapsule(cap, { device: gpuDevice });
        lastLeaseSummary = res.leaseSummary;
        if (cosmicPresenter.zeroCopy) {
          cosmicPresenter.bindLeaseHandle(res.leaseHandle);
        }
        res.leaseHandle?.release?.();
      }
    } finally {
      gpuStepBusy = false;
    }
  }

  let simClock = 0;
  let rafId = 0;
  let disposed = false;

  function applyContinuousZoomPose() {
    const camState = scaleBridge.evaluateContinuousZoomCamera(currentLog10);
    for (const r of COSMIC_QUANTUM_SCALE_REGIMES) {
      const group = regimeGroups[r.id];
      const center = REGIME_CENTERS_LOG10[r.id];
      const deltaDecades = center - currentLog10;
      const isPrimary = r.id === camState.primaryRegime.id;
      const isSecondary = r.id === camState.secondaryRegime?.id;
      const visible = isPrimary || (isSecondary && Math.abs(deltaDecades) < 1.55);
      group.visible = visible;
      if (visible) {
        const clampedDelta = Math.max(-1.6, Math.min(1.6, deltaDecades));
        group.scale.setScalar(Math.pow(10, clampedDelta * 0.58));
      }
    }

    camera.position.set(
      camRadius * Math.cos(camPitch) * Math.sin(camYaw),
      camRadius * Math.sin(camPitch),
      camRadius * Math.cos(camPitch) * Math.cos(camYaw)
    );
    camera.lookAt(0, 0, 0);

    regimeTitleEl.textContent = camState.primaryRegime.label;
    scaleReadoutEl.textContent = `${formatPhysicalSpan(camState.viewSpanM)} · 10^${currentLog10.toFixed(1)} m · Chart #${camState.primaryChartId} (L=${camState.primaryRegime.globalBaseLevel})`;
    zoomSlider.value = currentLog10.toFixed(2);
    for (const [id, btn] of pillButtons.entries()) {
      const active = id === camState.primaryRegime.id;
      btn.style.borderColor = active ? '#34d399' : 'rgba(148,163,184,0.25)';
      btn.style.background = active ? 'rgba(52,211,153,0.2)' : 'rgba(12,24,36,0.75)';
      btn.style.color = active ? '#ecfdf5' : '#cbd5e1';
    }
    if (lastInspectorRegimeId !== camState.primaryRegime.id) {
      lastInspectorRegimeId = camState.primaryRegime.id;
      renderInspectorPanel(camState);
    } else {
      const planStepEl = sidePanel.querySelector('#cq-plan-step');
      if (planStepEl) planStepEl.textContent = String(planetaryEngine.stepIndex);
      const galStepEl = sidePanel.querySelector('#cq-gal-step');
      if (galStepEl) galStepEl.textContent = String(galacticEngine.stepIndex);
      const leaseEl = sidePanel.querySelector('#cq-lease-epoch');
      if (leaseEl && lastLeaseSummary) leaseEl.textContent = String(lastLeaseSummary.resetEpoch);
      const aEl = sidePanel.querySelector('#cq-cosmo-a');
      if (aEl) aEl.textContent = cosmicWebEngine.scaleFactorA.toFixed(3);
      const zEl = sidePanel.querySelector('#cq-cosmo-z');
      if (zEl) zEl.textContent = Math.max(0, 1 / Math.max(0.05, cosmicWebEngine.scaleFactorA) - 1).toFixed(2);
    }
    return camState;
  }

  function frame() {
    if (disposed) return;
    rafId = requestAnimationFrame(frame);

    if (tourRunning) {
      targetLog10 += tourDirection * 0.055;
      if (targetLog10 <= -11.0) { targetLog10 = -11.0; tourDirection = 1; }
      if (targetLog10 >= 26.8) { targetLog10 = 26.8; tourDirection = -1; }
    }
    currentLog10 += (targetLog10 - currentLog10) * 0.14;
    if (Math.abs(targetLog10 - currentLog10) < 1e-4) currentLog10 = targetLog10;

    if (simRunning) {
      simClock += 0.016;
      if (continuumHelmholtzGroup) continuumHelmholtzGroup.rotation.y -= 0.003;
      molecularGroup.rotation.y += 0.004;
      atomicGroup.rotation.y += 0.005;
    }

    const camState = applyContinuousZoomPose();
    if (simRunning) {
      void stepActiveGpuModules(camState);
    }
    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  const initialCam = applyContinuousZoomPose();
  renderInspectorPanel(initialCam);
  rafId = requestAnimationFrame(frame);

  const api = {
    getState() {
      const cam = scaleBridge.evaluateContinuousZoomCamera(currentLog10);
      const galPresenterStats = galacticPresenter?.getStats() || null;
      return {
        ready: true,
        log10ViewSpanM: currentLog10,
        viewSpanM: cam.viewSpanM,
        primaryRegimeId: cam.primaryRegime.id,
        primaryChartId: cam.primaryChartId,
        primaryMethodKey: cam.primaryMethodKey,
        totalSpanOom: scaleBridge.summary().totalSpanOrdersOfMagnitude,
        gpuBackend: 'webgpu',
        rendererBackend,
        gpuAdapterName,
        planetarySteps: planetaryEngine.stepIndex,
        galacticSteps: galacticEngine.stepIndex,
        galacticBodyCount: galacticEngine.count,
        galacticGravityMode: galacticEngine.gravityMode,
        galacticTierId: galaxyTierId,
        zeroCopyPresenter: Boolean(galPresenterStats?.zeroCopy),
        zeroCopyBoundFrames: galPresenterStats?.zeroCopyBoundFrames ?? 0,
        readbackBytesPerFrame: galPresenterStats?.readbackBytesPerFrame ?? null,
        cosmicWebSteps: cosmicWebEngine.stepIndex,
        cosmicScaleFactorA: cosmicWebEngine.scaleFactorA,
        atomicElementZ: selectedElementZ,
        atomicFunctional: selectedFunctional,
        orbitalModeId: selectedOrbitalMode,
        orbitalRaymarchMode: currentOrbitalRaymarcher?.mode ?? null,
        orbitalProvenance: currentOrbitalRaymarcher?.provenance ?? null,
        continuumElementSymbol: currentElementResolution?.properties?.symbol ?? null,
        continuumElementPhase: currentElementResolution?.properties?.standardPhaseAt298K ?? null,
        continuumElementTmK: currentElementResolution?.properties?.meltingPointK ?? null,
        continuumMicroSphSteps: continuumEngine?.stepIndex ?? 0,
        continuumBodyCount: continuumEngine?.count ?? 0,
        continuumZeroCopy: Boolean(continuumPresenter?.zeroCopy),
        materialResolverBackend: currentElementResolution?.derivedBackend ?? currentElementResolution?.resolverStatus ?? null,
        nebModeActive,
        nebReactionXi,
        nebBarrierEv: cachedNebPath ? cachedNebPath.forwardBarrierHa * HA_TO_EV : null,
        polytopeStatus: currentPolytopeStatus,
        peerMeshState: (() => {
          const live = peerMesh?.handle?.getStatus?.();
          return {
            ...peerMeshState,
            connected: live ? Boolean(live.connected) : peerMeshState.connected,
            remotePeers: live ? live.remotePeerCount : peerMeshState.remotePeers,
            remotePeerIds: live ? [...(live.remotePeerIds || [])] : (peerMeshState.remotePeerIds || []),
            quorumReady: live ? Boolean(live.quorumReady) : peerMeshState.quorumReady,
            witnessedMessages: live?.witnessedMessages ?? peerMeshState.witnessedMessages ?? 0,
            lastWitnessedType: live?.lastWitnessedType ?? peerMeshState.lastWitnessedType ?? null
          };
        })(),
        crossChartMultipoleVerified: Boolean(crossChartMultipoleReceipt?.verified),
        crossChartMultipoleMomentumRelError: crossChartMultipoleReceipt?.momentumRelError ?? null,
        molecularFormula: selectedMoleculeKey,
        molecularBasis: selectedBasis,
        molecularBackend: currentMolecularBackend,
        registeredModules: moduleRegistry.listModules().map((m) => m.methodKey),
        lastLeaseSummary
      };
    },
    setLog10Span(val) {
      tourRunning = false;
      updateTourButton();
      currentLog10 = Math.max(-11.3, Math.min(27.2, Number(val) || 0));
      targetLog10 = currentLog10;
      const cam = applyContinuousZoomPose();
      renderInspectorPanel(cam);
      renderer.render(scene, camera);
      return cam;
    },
    async selectElement(Z, functional = selectedFunctional) {
      selectedElementZ = Z;
      selectedFunctional = functional;
      rebuildAtomicScene();
      await rebuildContinuumFromQuantumElement();
      renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
    },
    selectOrbitalMode(modeId) {
      if (VOLUMETRIC_ORBITAL_MODES.some((m) => m.id === modeId)) {
        selectedOrbitalMode = modeId;
        rebuildAtomicScene();
        renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
        renderer.render(scene, camera);
      }
    },
    async setNebMode(enabled, xi = nebReactionXi) {
      nebModeActive = Boolean(enabled);
      nebReactionXi = Math.max(0, Math.min(1, Number(xi) || 0));
      await rebuildMolecularScene();
      renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
      renderer.render(scene, camera);
    },
    connectPeerMesh,
    async dispatchPeerDerivation(atomicNumberZ = selectedElementZ) {
      const req = peerMesh?.handle?.getActiveRequester?.();
      if (!req || typeof req.submitWithProvenance !== 'function') {
        const err = new Error('Peer mesh 2-of-2 quorum requester is not ready (requires >= 2 live remote responders)');
        err.code = 'ERR_CLIENT_PEER_QUORUM_UNAVAILABLE';
        throw err;
      }
      const taskId = `cq-quorum-${Date.now()}-${peerMeshState.dispatches + 1}`;
      const res = await req.submitWithProvenance(taskId, {
        service: 'cosmic-quantum-material',
        kind: 'material.resolve-element',
        payload: { atomicNumberZ, functional: selectedFunctional }
      });
      peerMeshState.dispatches += 1;
      peerMeshState.lastResult = res;
      return res;
    },
    async selectMolecule(formula, basis = selectedBasis, viewMode = molecularViewMode) {
      nebModeActive = false;
      selectedMoleculeKey = formula;
      selectedBasis = basis;
      molecularViewMode = viewMode;
      await rebuildMolecularScene();
      renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
    },
    async selectGalaxyPreset(preset, tierId = galaxyTierId) {
      await rebuildGalacticSimulation({ tierId, preset });
      renderInspectorPanel(scaleBridge.evaluateContinuousZoomCamera(currentLog10));
    },
    async stepOnce() {
      const cam = scaleBridge.evaluateContinuousZoomCamera(currentLog10);
      await stepActiveGpuModules(cam);
      renderer.render(scene, camera);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      void disconnectPeerMesh();
      currentOrbitalRaymarcher?.dispose?.();
      continuumPresenter?.dispose?.();
      continuumEngine?.dispose?.();
      planetaryEngine?.dispose?.();
      galacticPresenter?.dispose();
      cosmicPresenter?.dispose();
      galacticEngine?.dispose();
      cosmicWebEngine?.dispose();
      renderer.dispose();
    }
  };
  globalThis.__ulgCosmicQuantumDemo = api;
  return api;
}
