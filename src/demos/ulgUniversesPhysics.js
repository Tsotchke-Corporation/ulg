// First-Principles 40-Order-of-Magnitude WebGPU Physics Orchestrator for ULG Universes
// (`src/demos/ulgUniversesPhysics.js`).
//
// Manages all 8 nested real ULG WebGPU engines on ONE shared GPUDevice with
// seamless parent -> child physical provenance, zero CPU mirror solvers, and
// zero scripted animations:
//   L0 Cosmic Web        : `supergalacticTreePmGpu.js` (1-submit FLRW 3D-FFT TreePM + GPU P(k))
//   L1 Galaxy & SMBH     : `cosmicQuantumGpuKernels.js` (`SchroederScaleAtlas` multipole)
//                          + `galacticIsmCoolingGpu.js` (Gate 1 H/He/C/O Λ(T,Z))
//   L2 Star System       : `cosmicQuantumGpuKernels.js` (Symplectic tiled GPU Velocity-Verlet)
//   L3 Stellar Core      : `selfGravitatingHydroGpu.js` (`self-gravitating-hydro@1`)
//                          + `stellarNucleosynthesisBridge.js` (GPU nuclear network + RK4 Lane-Emden)
//   L4 Planetary Interior: `planetaryStructureGpu.js` (Inline WGSL Polytope Atlas hydrostatic solver)
//   L5 Crystal & Fluid MD: `molecularDynamicsWebGpu.js` (O(N) linked-cell GPU MD + gravity + g(r))
//   L6 Quantum Atom/Mol  : `periodicTableEngineWebGpu.js` (4-comp Dirac-KS) + `orbitalPointCloudWebGpu.js`
//                          + `molecularHartreeFockWebGpu.js` + PeerCompute 2-of-2 quorum mesh
//   L7 Atomic Nucleus    : `nuclearStructureGpu.js` (3D Woods-Saxon GPU volume + B(Z,A))
//                          + `photonShellOpticsWebGpu.js` (Symplectic Visscher 1D tunneling TDSE)

import { ArtifactCache } from '../runtime/ArtifactCache.js';
import { ClosureRegistry } from '../runtime/ClosureRegistry.js';
import {
  buildZeldovichCosmologyICsWebGpu,
  createSupergalacticTreePmSessionWebGpu
} from '../runtime/astrophysics/supergalacticTreePmGpu.js';
import {
  deriveGate1IsmCoolingAnchorsWebGpu,
  evaluateIsmRadiativeCoolingErgCm3PerS
} from '../runtime/astrophysics/galacticIsmCoolingGpu.js';
import {
  buildPlanetaryPolytopeAtlasWebGpu,
  solvePlanetaryInteriorWebGpu
} from '../runtime/astrophysics/planetaryStructureGpu.js';
import {
  evaluateStellarNuclearNetworkWebGpu,
  getGate1StellarBurnConstants,
  solveLaneEmdenPolytropeWebGpu
} from '../runtime/astrophysics/stellarNucleosynthesisBridge.js';
import {
  registerPlasmaFusionClosureArtifact
} from '../runtime/astrophysics/hydrogenStellarClosure.js';
import { createHydrogenNebulaInitialBodies } from '../runtime/astrophysics/nebulaInitialConditions.js';
import { createSelfGravitatingHydroEngine } from '../runtime/sph/selfGravitatingHydroGpu.js';
import {
  createGalacticBodies,
  createResidentScaleAtlasMultipoleNBodyEngine,
  createResidentTiledNBodyEngine
} from './cosmicQuantumGpuKernels.js';
import { deriveElementBundleWebGpu } from '../runtime/material/periodicTableEngineWebGpu.js';
import {
  buildCrystalMdState,
  createMolecularDynamicsSessionWebGpu
} from '../runtime/gpuMath/molecularDynamicsWebGpu.js';
import {
  sampleAtomicOrbitalCloudWebGpu,
  sampleMolecularOrbitalCloudWebGpu
} from '../runtime/electronicStructure/orbitalPointCloudWebGpu.js';
import { solveMoleculeRhfWebGpu } from '../runtime/electronicStructure/molecularHartreeFockWebGpu.js';
import { solveNuclearStructureWebGpu } from '../runtime/nuclear/nuclearStructureGpu.js';
import { createNuclearTunnelingTdseWebGpu } from '../runtime/material/photonShellOpticsWebGpu.js';
import {
  createRelaySignalingTransport,
  startLiveClientDerivationPeerMesh
} from '../services/clientDerivationPeers.js';
import { QUALITY_PRESETS, UNIVERSES_ELEMENT_CHOICES } from './ulgUniversesDocs.js';

export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GALAXY_MORPHOLOGIES = ['disk', 'binary', 'sphere'];
const GALAXY_PREFIXES = ['NGC', 'M', 'IC', 'UGC', 'ARP', 'PGC'];
const PLANET_TEMPLATES = Object.freeze([
  { id: 'terrestrial', label: 'Terrestrial Iron-Silicate World', kind: 1, a: 2.8, mass: 0.00028, radius: 0.34, color0: [0.34, 0.56, 0.32], color1: [0.10, 0.34, 0.72], atm: 0.55, centralP: 360e9, coreZ: 26, mantleZ: 14, surfZ: 29, composition: 'Fe 32% · SiO₂ 48% · H₂O 14% · Cu 6%' },
  { id: 'ocean', label: 'Deep Hydrosphere Ocean World', kind: 1, a: 4.3, mass: 0.00042, radius: 0.42, color0: [0.22, 0.62, 0.54], color1: [0.08, 0.38, 0.86], atm: 0.72, centralP: 420e9, coreZ: 26, mantleZ: 14, surfZ: 8, composition: 'H₂O 34% · SiO₂ 44% · Fe 22%' },
  { id: 'superearth', label: 'High-Z Refractory Super-Earth', kind: 1, a: 1.75, mass: 0.00018, radius: 0.28, color0: [0.68, 0.42, 0.24], color1: [0.36, 0.22, 0.16], atm: 0.24, centralP: 520e9, coreZ: 79, mantleZ: 26, surfZ: 14, composition: 'Fe 46% · SiO₂ 42% · Au/Pt 12%' },
  { id: 'gasgiant', label: 'Ringed Jovian Gas Giant', kind: 2, a: 6.4, mass: 0.0048, radius: 0.68, color0: [0.84, 0.68, 0.46], color1: [0.58, 0.40, 0.26], atm: 0.48, ringed: true, centralP: 280e9, coreZ: 26, mantleZ: 6, surfZ: 1, composition: 'H₂ 75% · He 23% · C/Fe Core 2%' },
  { id: 'iceworld', label: 'Outer Cryogenic Ice Giant', kind: 3, a: 8.6, mass: 0.0014, radius: 0.46, color0: [0.46, 0.76, 0.94], color1: [0.24, 0.46, 0.78], atm: 0.62, centralP: 190e9, coreZ: 14, mantleZ: 8, surfZ: 6, composition: 'H₂O/CH₄ 64% · SiO₂ 26% · Fe 10%' }
]);

const MOLECULE_SPECS = Object.freeze({
  H2O: Object.freeze({
    formula: 'H₂O',
    name: 'Water (C₂v Bent)',
    atoms: [
      { Z: 8, symbol: 'O', position: [0, 0, 0.22] },
      { Z: 1, symbol: 'H', position: [0, 1.43, -0.88] },
      { Z: 1, symbol: 'H', position: [0, -1.43, -0.88] }
    ]
  }),
  CO: Object.freeze({
    formula: 'CO',
    name: 'Carbon Monoxide (Triple Bond)',
    atoms: [
      { Z: 6, symbol: 'C', position: [0, 0, -1.07] },
      { Z: 8, symbol: 'O', position: [0, 0, 1.07] }
    ]
  }),
  H2: Object.freeze({
    formula: 'H₂',
    name: 'Molecular Hydrogen (H–H)',
    atoms: [
      { Z: 1, symbol: 'H', position: [0, 0, -0.70] },
      { Z: 1, symbol: 'H', position: [0, 0, 0.70] }
    ]
  })
});

export function buildStarSystemBodies({ seed = 101, starMass = 12.0, gravity = 1.0, softening = 0.02 } = {}) {
  const rand = mulberry32(seed);
  const count = 1 + PLANET_TEMPLATES.length;
  const bodies = new Float32Array(count * 8);
  let pxSum = 0; let pySum = 0; let pzSum = 0;
  let mvxSum = 0; let mvySum = 0; let mvzSum = 0;

  for (let i = 0; i < PLANET_TEMPLATES.length; i += 1) {
    const tpl = PLANET_TEMPLATES[i];
    const th = rand() * Math.PI * 2;
    const tilt = (rand() - 0.5) * 0.14;
    const ecc = 0.02 + rand() * 0.06;
    const a = tpl.a * (0.94 + rand() * 0.12);
    const r0 = a * (1 - ecc);
    const x = Math.cos(th) * r0;
    const y = Math.sin(th) * r0 * Math.sin(tilt);
    const z = Math.sin(th) * r0 * Math.cos(tilt);
    const rEff = Math.hypot(r0, softening);
    const vPeri = Math.sqrt((gravity * (starMass + tpl.mass) * (1 + ecc)) / rEff);
    const vx = -Math.sin(th) * vPeri;
    const vy = Math.cos(th) * vPeri * Math.sin(tilt);
    const vz = Math.cos(th) * vPeri * Math.cos(tilt);
    bodies.set([x, y, z, tpl.mass, vx, vy, vz, tpl.radius], (i + 1) * 8);
    pxSum += tpl.mass * x;
    pySum += tpl.mass * y;
    pzSum += tpl.mass * z;
    mvxSum += tpl.mass * vx;
    mvySum += tpl.mass * vy;
    mvzSum += tpl.mass * vz;
  }

  // Exact barycentric recoil on central star -> total P = 0
  bodies.set([
    -pxSum / starMass, -pySum / starMass, -pzSum / starMass, starMass,
    -mvxSum / starMass, -mvySum / starMass, -mvzSum / starMass, 0.92
  ], 0);
  return bodies;
}

export function buildEmissionLinesForContext(level, target, elementBundle) {
  // Returns array of { wavelengthNm, intensity, label } derived from real physical transitions
  if (level >= 5 && elementBundle?.bundle?.electromagnetic?.spectralWavelengthsNm?.length) {
    const wls = elementBundle.bundle.electromagnetic.spectralWavelengthsNm;
    const refl = elementBundle.bundle.electromagnetic.spectralReflectance;
    const lines = [];
    for (let i = 0; i < wls.length; i += 1) {
      lines.push({ wavelengthNm: wls[i], intensity: Math.max(0.15, Math.min(1, refl[i] ?? 0.5)) });
    }
    return lines;
  }
  const tK = Number(target?.tempK || 5778);
  // Real atomic Balmer / He I / O III / Fe II / Na D wavelengths weighted by physical temperature
  const baseLines = [
    { wavelengthNm: 410.2, intensity: tK > 6500 ? 0.85 : 0.35 }, // H-delta
    { wavelengthNm: 434.0, intensity: tK > 5500 ? 0.90 : 0.45 }, // H-gamma
    { wavelengthNm: 486.1, intensity: 0.92 },                    // H-beta
    { wavelengthNm: 495.9, intensity: level <= 1 ? 0.72 : 0.32 }, // [O III]
    { wavelengthNm: 500.7, intensity: level <= 1 ? 0.96 : 0.40 }, // [O III]
    { wavelengthNm: 517.3, intensity: tK < 6500 ? 0.76 : 0.28 }, // Mg b
    { wavelengthNm: 587.6, intensity: tK > 8000 ? 0.95 : 0.42 }, // He I D3
    { wavelengthNm: 589.3, intensity: tK < 5500 ? 0.90 : 0.30 }, // Na I D
    { wavelengthNm: 656.3, intensity: 1.0 }                      // H-alpha
  ];
  return baseLines;
}

export function createUlgUniversesPhysics(device, {
  seed = 20261125,
  qualityId = 'med',
  initialElementZ = 26
} = {}) {
  let universeSeed = seed >>> 0;
  let quality = QUALITY_PRESETS[qualityId] || QUALITY_PRESETS.med;

  const artifactCache = new ArtifactCache();
  const closureRegistry = new ClosureRegistry({ artifactCache });

  // Cached Gate 1 element bundles (keyed by `${Z}:${A}:${rel}`)
  const bundleCache = new Map();
  // Cached planetary polytope atlases (keyed by materialKey)
  const planetaryAtlasCache = new Map();

  // Level 0: Supergalactic Cosmic Web
  let cosmoSession = null;
  let cosmoTelemetry = null;
  let cosmoFirstPk = null;
  let cosmoTargets = [];

  // Level 1: Galaxy & SMBH
  let galaxyEngine = null;
  let galaxyPreset = 'disk';
  let galaxyMetallicity = 1.0;
  let ismCoolingAnchors = null;
  let galaxyTargets = [];
  let galaxySmbhPos = [0, 0, 0];

  // Level 2: Star System
  let systemEngine = null;
  let systemBodies = null;
  let systemTargets = [];
  let systemOrbitHistory = [];
  let systemStarTempK = 5778;
  let systemStarName = 'Sol-ULG G2V';

  // Level 3: Stellar Core & Genesis
  let stellarEngine = null;
  let stellarPreset = 'solar-nebula';
  let stellarTelemetry = null;
  let stellarNuclearNetwork = null;
  let stellarLaneEmden = null;
  let stellarClosureRef = null;
  let stellarTimeAccel = 2.0;

  // Level 4: Planetary Interior
  let planetaryResult = null;
  let planetaryTemplate = PLANET_TEMPLATES[0];
  let planetaryCutaway = true;
  let planetaryLayersMeta = [];

  // Level 5: Molecular Dynamics
  let mdSession = null;
  let mdTelemetry = null;
  let mdElementZ = initialElementZ;
  let mdTempK = 300;
  let mdGravity = false;
  let mdPhasePreset = 'solid';
  let mdRdfHistory = [];

  // Level 6: Quantum Atom & Molecule
  let quantumZ = initialElementZ;
  let quantumN = 3;
  let quantumL = 2;
  let quantumM = 0;
  let quantumRelativistic = true;
  let quantumMode = 'atom'; // 'atom' | 'molecule'
  let quantumMoleculeKey = 'H2O';
  let orbitalCloud = null;
  let moleculeRhfResult = null;

  // Level 7: Atomic Nucleus & Tunneling
  let nuclearZ = initialElementZ;
  let nuclearA = 56;
  let nuclearResult = null;
  let tdseSession = null;
  let tdseTelemetry = null;

  // PeerCompute Distributed Mesh (supports 3-browser quorum test!)
  let peerMesh = null;
  let peerMeshState = {
    connected: false,
    role: 'requester',
    relayUrl: '',
    roomId: 'ulg-universes-mesh-v1',
    peerId: null,
    remotePeers: 0,
    remotePeerIds: [],
    quorumReady: false,
    witnessedMessages: 0,
    lastWitnessedType: null,
    dispatches: 0,
    lastResult: null,
    error: null
  };

  let busy = false;
  let disposed = false;

  async function getElementBundle(Z, { massNumberA = null, relativistic = true, returnOrbitalWavefunctions = true } = {}) {
    const zSafe = Math.max(1, Math.min(118, Math.trunc(Number(Z) || 26)));
    const key = `${zSafe}:${massNumberA ?? 'std'}:${relativistic ? 1 : 0}:${returnOrbitalWavefunctions ? 1 : 0}`;
    if (bundleCache.has(key)) return bundleCache.get(key);
    const res = await deriveElementBundleWebGpu(device, zSafe, {
      massNumberA,
      temperatureK: 300,
      runNuclearGpuVolume: false,
      runLiveMd: false,
      atomicMaxScf: 44,
      atomicGridPointsN: 192,
      blochGridN: 16,
      scalarRelativistic: relativistic,
      spinOrbit: relativistic,
      returnOrbitalWavefunctions
    });
    bundleCache.set(key, res);
    return res;
  }

  // ---- L0: Supergalactic Cosmic Web ----
  async function initCosmicWeb({ seedOverride = null } = {}) {
    if (cosmoSession) {
      cosmoSession.destroy();
      cosmoSession = null;
    }
    const activeSeed = (seedOverride ?? universeSeed) >>> 0;
    const gpuIc = await buildZeldovichCosmologyICsWebGpu(device, {
      gridPerSide: quality.cosmoGridPerSide,
      fftGridN: quality.cosmoFftN,
      boxLengthMpc: 200,
      aInit: 0.05,
      amplitude: 0.42,
      seed: activeSeed
    });
    cosmoSession = createSupergalacticTreePmSessionWebGpu(device, {
      gridPerSide: quality.cosmoGridPerSide,
      pmGridN: quality.cosmoFftN,
      boxLengthMpc: 200,
      aInit: 0.05,
      da: 0.014,
      initialConditions: gpuIc
    });
    cosmoFirstPk = null;
    cosmoTelemetry = await cosmoSession.step({ readTelemetry: true });
    if (cosmoTelemetry?.powerSpectrumPk?.kBins?.length) {
      cosmoFirstPk = {
        kBins: [...cosmoTelemetry.powerSpectrumPk.kBins],
        pkValues: [...cosmoTelemetry.powerSpectrumPk.pkValues]
      };
    }

    // Build 5 clickable galaxy cluster nodes at seeded filament locations inside the comoving cube
    const rand = mulberry32(activeSeed ^ 0x51f15e);
    cosmoTargets = Array.from({ length: 5 }, (_, i) => {
      const morph = GALAXY_MORPHOLOGIES[i % GALAXY_MORPHOLOGIES.length];
      const prefix = GALAXY_PREFIXES[Math.floor(rand() * GALAXY_PREFIXES.length)];
      const num = 1000 + Math.floor(rand() * 8900);
      const scale = 7.5; // world render scale [-10, 10]
      const x = (rand() - 0.5) * 2 * scale;
      const y = (rand() - 0.5) * 1.4 * scale;
      const z = (rand() - 0.5) * 2 * scale;
      const mass1012 = (0.6 + rand() * 3.8).toFixed(2);
      const zMet = Number((0.4 + rand() * 1.4).toFixed(2));
      return {
        id: `cluster-${i}`,
        level: 0,
        name: `${prefix}-${num} Supercluster`,
        subtitle: `${morph === 'disk' ? 'Grand-Design Spiral' : morph === 'binary' ? 'Colliding Merger Pair' : 'Giant Elliptical'} · Z=${zMet} Z☉`,
        pos: [x, y, z],
        radius: 1.0,
        morphology: morph,
        metallicity: zMet,
        massLabel: `${mass1012}×10¹² M☉`,
        tempK: 6200 + Math.round(rand() * 5000),
        composition: `DM 84% · H 12% · He 3.8% · Met ${(0.2 * zMet).toFixed(2)}%`,
        nextLevel: 1
      };
    });
  }

  // ---- L1: Galaxy & SMBH ----
  async function initGalaxy({ preset = galaxyPreset, metallicity = galaxyMetallicity, seedOverride = null } = {}) {
    galaxyPreset = GALAXY_MORPHOLOGIES.includes(preset) ? preset : 'disk';
    galaxyMetallicity = Math.max(0.1, Math.min(3.0, Number(metallicity) || 1.0));
    if (galaxyEngine) {
      galaxyEngine.dispose();
      galaxyEngine = null;
    }
    if (!ismCoolingAnchors) {
      ismCoolingAnchors = await deriveGate1IsmCoolingAnchorsWebGpu(device);
    }
    const activeSeed = ((seedOverride ?? universeSeed) + 825) >>> 0;
    const bodies0 = createGalacticBodies({
      count: quality.galaxyStars,
      preset: galaxyPreset,
      seed: activeSeed
    });
    galaxySmbhPos = [bodies0[0], bodies0[1], bodies0[2]];
    galaxyEngine = createResidentScaleAtlasMultipoleNBodyEngine({
      device,
      initialBodies: bodies0,
      mode: 0,
      boxHalf: 16.0,
      theta: 0.65,
      label: `ulg-universes-galaxy-${quality.galaxyStars}`
    });
    await galaxyEngine.step({ dt: 0.01, gravity: 1.0, softening: 0.24, readback: false });

    const rand = mulberry32(activeSeed ^ 0x229a1);
    const starCatalog = [
      { id: 'smbh-core', name: 'Sagittarius-ULG* SMBH', subtitle: 'Relativistic Kerr-Schwarzschild Core · Accretion Disk', pos: [...galaxySmbhPos], radius: 1.2, tempK: 28000, massLabel: '4.3×10⁶ M☉', isSmbh: true, starMass: 18.0, composition: 'Relativistic Plasma · H⁺/He²⁺ · Fe Kα', nextLevel: 2 },
      { id: 'star-g2v', name: 'Helios-ULG (G2V)', subtitle: 'Main-Sequence Yellow Dwarf · 5 Planets', pos: [4.2, 0.15, 2.4], radius: 0.75, tempK: 5778, massLabel: '1.00 M☉', starMass: 12.0, composition: 'H 73.5% · He 24.8% · Fe/O/C 1.7%', nextLevel: 2 },
      { id: 'star-ob', name: 'Rigel-ULG (B8Ia)', subtitle: 'Blue Supergiant · CNO Fusion Dominated', pos: [-5.1, -0.2, 3.8], radius: 0.85, tempK: 14500, massLabel: '16.4 M☉', starMass: 22.0, composition: 'H 70% · He 28% · CNO 2.0%', nextLevel: 2 },
      { id: 'star-k2', name: 'Kepler-ULG (K2V)', subtitle: 'Orange Dwarf · Long-Lived Habitable Zone', pos: [2.6, 0.25, -5.4], radius: 0.70, tempK: 4850, massLabel: '0.78 M☉', starMass: 10.5, composition: 'H 74% · He 24.6% · Met 1.4%', nextLevel: 2 },
      { id: 'star-red', name: 'Antares-ULG (M1I)', subtitle: 'Red Supergiant · Triple-Alpha Helium Core', pos: [-3.4, 0.35, -4.2], radius: 0.85, tempK: 3650, massLabel: '11.2 M☉', starMass: 16.0, composition: 'H 62% · He 34% · C/O/Fe 4.0%', nextLevel: 2 }
    ];
    // Perturb star positions gently with seed so Reseed produces fresh geometry
    for (let i = 1; i < starCatalog.length; i += 1) {
      const th = (i / (starCatalog.length - 1)) * Math.PI * 2 + rand() * 0.9;
      const rad = 3.2 + rand() * 4.8;
      starCatalog[i].pos = [Math.cos(th) * rad, (rand() - 0.5) * 0.7, Math.sin(th) * rad];
    }
    galaxyTargets = starCatalog.map((t) => ({ ...t, level: 1 }));
  }

  // ---- L2: Star System ----
  async function initStarSystem({ starTarget = null, seedOverride = null } = {}) {
    if (systemEngine) {
      systemEngine.dispose();
      systemEngine = null;
    }
    const activeSeed = ((seedOverride ?? universeSeed) + 409) >>> 0;
    const starMass = Number(starTarget?.starMass || 12.0);
    systemStarTempK = Number(starTarget?.tempK || 5778);
    systemStarName = starTarget?.name || 'Helios-ULG (G2V)';

    const bodies0 = buildStarSystemBodies({ seed: activeSeed, starMass, gravity: 1.0, softening: 0.02 });
    systemEngine = createResidentTiledNBodyEngine({
      device,
      initialBodies: bodies0,
      mode: 0,
      label: 'ulg-universes-star-system'
    });
    systemBodies = Float32Array.from(bodies0);
    systemOrbitHistory = Array.from({ length: 1 + PLANET_TEMPLATES.length }, () => []);

    const starRgb = systemStarTempK > 10000
      ? [0.68, 0.86, 1.0]
      : (systemStarTempK < 4200 ? [1.0, 0.52, 0.24] : [1.0, 0.92, 0.68]);
    const starRim = systemStarTempK > 10000
      ? [0.35, 0.62, 1.0]
      : [1.0, 0.45, 0.14];

    systemTargets = [
      {
        id: 'host-star',
        level: 2,
        bodyIndex: 0,
        name: systemStarName,
        subtitle: `Host Star · T_eff = ${systemStarTempK.toLocaleString()} K · Click to Dive to Core`,
        pos: [systemBodies[0], systemBodies[1], systemBodies[2]],
        radius: 0.92,
        kind: 0,
        color0: starRgb,
        color1: starRim,
        tempK: systemStarTempK,
        massLabel: `${(starMass / 12.0).toFixed(2)} M☉`,
        composition: starTarget?.composition || 'H 73.5% · He 24.8% · Metals 1.7%',
        nextLevel: 3
      },
      ...PLANET_TEMPLATES.map((tpl, idx) => {
        const bi = idx + 1;
        const o = bi * 8;
        const distAu = Math.hypot(systemBodies[o], systemBodies[o + 1], systemBodies[o + 2]) / 2.8;
        const tEq = Math.round(288 * Math.pow(Math.max(0.25, systemStarTempK / 5778), 1.0) / Math.sqrt(Math.max(0.2, distAu)));
        return {
          id: `planet-${tpl.id}`,
          level: 2,
          bodyIndex: bi,
          template: tpl,
          name: `${systemStarName.split(' ')[0]} ${['b', 'c', 'd', 'e', 'f'][idx]}`,
          subtitle: `${tpl.label} · ${distAu.toFixed(2)} AU`,
          pos: [systemBodies[o], systemBodies[o + 1], systemBodies[o + 2]],
          radius: tpl.radius,
          kind: tpl.kind,
          color0: tpl.color0,
          color1: tpl.color1,
          atm: tpl.atm,
          ringed: Boolean(tpl.ringed),
          tempK: tEq,
          massLabel: tpl.id === 'gasgiant' ? '318 M⊕' : (tpl.id === 'iceworld' ? '16 M⊕' : `${(tpl.mass / 0.00028).toFixed(2)} M⊕`),
          composition: tpl.composition,
          nextLevel: 4
        };
      })
    ];
    await stepStarSystem(1.0);
  }

  // ---- L3: Stellar Core & Genesis ----
  async function initStellarCore({ preset = stellarPreset, seedOverride = null } = {}) {
    stellarPreset = ['solar-nebula', 'massive-supernova', 'binary-nursery'].includes(preset)
      ? preset
      : 'solar-nebula';
    if (stellarEngine) {
      stellarEngine.dispose();
      stellarEngine = null;
    }
    if (!stellarClosureRef) {
      const reg = await registerPlasmaFusionClosureArtifact({ closureRegistry, device });
      stellarClosureRef = reg.ref;
    }
    const activeSeed = ((seedOverride ?? universeSeed) + 1939) >>> 0;
    const bodies0 = createHydrogenNebulaInitialBodies({
      count: quality.stellarParticles,
      preset: stellarPreset,
      seed: activeSeed
    });
    stellarEngine = createSelfGravitatingHydroEngine({
      device,
      initialBodies: bodies0,
      closureRegistry,
      closureRef: stellarClosureRef,
      boxHalf: 14.0,
      label: `ulg-universes-stellar-${stellarPreset}`
    });
    stellarTelemetry = await stellarEngine.step({
      dt: 0.015,
      timeAccel: stellarTimeAccel,
      readTelemetry: true
    });

    // Live WebGPU nuclear reaction rates + RK4 Lane-Emden polytropes
    const [nucNet, le] = await Promise.all([
      evaluateStellarNuclearNetworkWebGpu(device, [
        { rhoKgM3: 1.5e5, temperatureK: 1.5e7, xH: 0.72, xHe: 0.26, xZ: 0.02, dtS: 1e12 },
        { rhoKgM3: 8.0e5, temperatureK: 3.5e7, xH: 0.55, xHe: 0.42, xZ: 0.03, dtS: 1e11 },
        { rhoKgM3: 1.2e8, temperatureK: 1.6e8, xH: 0.0, xHe: 0.96, xZ: 0.04, dtS: 1e10 }
      ]),
      solveLaneEmdenPolytropeWebGpu(device, [1.5, 3.0], { dXi: 0.01, maxXi: 12.0 })
    ]);
    stellarNuclearNetwork = nucNet;
    stellarLaneEmden = le;
  }

  // ---- L4: Planetary Interior & Surface ----
  async function initPlanetaryInterior({ template = planetaryTemplate } = {}) {
    planetaryTemplate = template || PLANET_TEMPLATES[0];
    const zCore = planetaryTemplate.coreZ || 26;
    const zMantle = planetaryTemplate.mantleZ || 14;
    const zSurf = planetaryTemplate.surfZ || 29;

    const [coreRes, mantleRes, surfRes] = await Promise.all([
      getElementBundle(zCore, { relativistic: true, returnOrbitalWavefunctions: false }),
      getElementBundle(zMantle, { relativistic: true, returnOrbitalWavefunctions: false }),
      getElementBundle(zSurf, { relativistic: true, returnOrbitalWavefunctions: false })
    ]);

    const getOrBuildAtlas = async (res) => {
      const k = res.bundle.materialKey || res.bundle.symbol;
      if (planetaryAtlasCache.has(k)) return planetaryAtlasCache.get(k);
      const atlas = await buildPlanetaryPolytopeAtlasWebGpu(device, res.bundle, {
        minPressurePa: 1e4,
        maxPressurePa: 1e12,
        maxTemperatureK: 12000,
        degrees: [4, 4],
        relativeTolerance: 3e-2,
        maxBisectDepth: 2
      });
      planetaryAtlasCache.set(k, atlas);
      return atlas;
    };

    const [coreAtlas, mantleAtlas] = await Promise.all([
      getOrBuildAtlas(coreRes),
      getOrBuildAtlas(mantleRes)
    ]);

    planetaryResult = await solvePlanetaryInteriorWebGpu(device, {
      centralPressurePa: planetaryTemplate.centralP || 360e9,
      surfacePressurePa: 1e5,
      radialStepM: 35000,
      maxRadiusM: 3.5e7,
      convergePasses: 3,
      maxProfileSamples: 128,
      layers: [
        { name: `${coreRes.bundle.symbol} Core`, cumulativeMassFraction: 0.32, temperatureK: 5200, atlas: coreAtlas },
        { name: `${mantleRes.bundle.symbol} Silicate Mantle`, cumulativeMassFraction: 1.0, temperatureK: 2200, atlas: mantleAtlas }
      ]
    });

    // Compute exact normalized layer radii from the GPU-solved radial profile!
    let rCoreNorm = 0.52;
    const prof = planetaryResult?.profile || [];
    const totalR = Math.max(1, planetaryResult?.radiusM || 6.37e6);
    for (let i = 0; i < prof.length; i += 1) {
      if ((prof[i].layerIndex ?? 0) >= 1) {
        rCoreNorm = Math.max(0.22, Math.min(0.78, prof[i].radiusM / totalR));
        break;
      }
    }

    planetaryLayersMeta = [
      {
        id: 'layer-core',
        level: 4,
        name: `${coreRes.bundle.symbol} Metallic Core`,
        subtitle: `High-P Gate 2 Polytope · P_c = ${((planetaryTemplate.centralP || 360e9) / 1e9).toFixed(0)} GPa`,
        pos: [0.45, 0.35, 0.45],
        radius: 0.7,
        sampleZ: zCore,
        rCoreNorm,
        rMantleNorm: 0.94,
        tempK: 5200,
        massLabel: `${((planetaryResult?.massKg || 5.97e24) / 5.9722e24).toFixed(2)} M⊕`,
        composition: `${coreRes.bundle.symbol} Core (r/R = ${rCoreNorm.toFixed(2)}) · MoI = ${(planetaryResult?.moiFactor || 0.33).toFixed(3)}`,
        nextLevel: 5
      },
      {
        id: 'layer-mantle',
        level: 4,
        name: `${mantleRes.bundle.symbol} Silicate Mantle`,
        subtitle: `Compressed Gate 2 Polytope Shell · T = 2,200 K`,
        pos: [1.35, 1.05, 1.35],
        radius: 0.7,
        sampleZ: zMantle,
        rCoreNorm,
        rMantleNorm: 0.94,
        tempK: 2200,
        massLabel: `R = ${(totalR / 1e3).toFixed(0)} km`,
        composition: `${mantleRes.bundle.symbol}/O Mantle · g_surf = ${(planetaryResult?.surfaceGravityMPerS2 || 9.8).toFixed(2)} m/s²`,
        nextLevel: 5
      },
      {
        id: 'layer-surface',
        level: 4,
        name: `${surfRes.bundle.symbol} Surface Crust Specimen`,
        subtitle: `Gate 1 Optical Reflectance · Ready to Sample in MD`,
        pos: [-1.8, 1.4, 1.5],
        radius: 0.7,
        sampleZ: zSurf,
        rCoreNorm,
        rMantleNorm: 0.94,
        tempK: 300,
        massLabel: `v_esc = ${((planetaryResult?.escapeVelocityMPerS || 11186) / 1e3).toFixed(2)} km/s`,
        composition: `${surfRes.bundle.symbol} (${surfRes.bundle.mechanical.crystalStructure}) · T_m = ${Math.round(surfRes.bundle.thermodynamic.meltingPointK)} K`,
        nextLevel: 5
      }
    ];
  }

  // ---- L5: Crystal & Fluid Molecular Dynamics ----
  async function initMolecularDynamics({ Z = mdElementZ, tempK = null, phasePreset = null, gravity = mdGravity } = {}) {
    mdElementZ = Math.max(1, Math.min(118, Math.trunc(Number(Z) || 26)));
    mdGravity = Boolean(gravity);
    if (mdSession) {
      mdSession.destroy();
      mdSession = null;
    }
    const res = await getElementBundle(mdElementZ, { relativistic: true, returnOrbitalWavefunctions: false });
    const bulk = res.visualData.bulk;
    const pot = res.visualData.thermo.potential;
    const b = res.bundle;
    const tMelt = Math.max(20, Number(b.thermodynamic.meltingPointK || 600));
    const tBoil = Math.max(tMelt * 1.4 + 20, Number(b.thermodynamic.boilingPointK || tMelt * 2.4));

    if (phasePreset === 'melt') {
      mdPhasePreset = 'melt';
      mdTempK = Math.round(tMelt * 1.38);
    } else if (phasePreset === 'vapor') {
      mdPhasePreset = 'vapor';
      mdTempK = Math.round(tBoil * 1.35);
    } else if (phasePreset === 'solid') {
      mdPhasePreset = 'solid';
      mdTempK = Math.max(20, Math.round(tMelt * 0.28));
    } else if (tempK != null && Number.isFinite(Number(tempK))) {
      mdTempK = Math.max(15, Math.round(Number(tempK)));
    } else {
      mdPhasePreset = 'solid';
      mdTempK = Math.max(20, Math.round(tMelt * 0.28));
    }

    const massU = Math.max(1, Number(b.nuclear.atomicMassU || 28));
    const dtFs = Math.min(2.0, Math.max(0.45, 0.09 * Math.sqrt(massU)));
    const c = quality.mdCells;
    const init = buildCrystalMdState({
      crystalStructure: bulk.crystalStructure,
      cellsVec: [c, c, c],
      latticeConstantA: Math.max(2.4, Number(bulk.latticeConstantA || 3.6)),
      massU,
      temperatureK: mdTempK
    });
    mdSession = createMolecularDynamicsSessionWebGpu(device, {
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
      targetTemperatureK: mdTempK,
      thermostatCouplingFs: 20,
      meltingPointK: tMelt,
      bulkModulusGPa: Math.max(1, Number(bulk.bulkModulusPa || 40e9) / 1e9),
      cohesiveEnergyEv: Math.max(0.05, Number(bulk.cohesiveEnergyEv || 2.0)),
      crystalStructure: bulk.crystalStructure,
      gravityEnabled: mdGravity
    });
    mdTelemetry = await mdSession.stepBatch(4, { readTelemetry: true, targetTemperatureK: mdTempK });
    mdRdfHistory = mdTelemetry?.rdf ? Array.from(mdTelemetry.rdf) : [];
  }

  // ---- L6: Quantum Atom & Molecule ----
  async function initQuantumAtom({
    Z = quantumZ,
    n = null,
    l = null,
    m = null,
    relativistic = quantumRelativistic,
    mode = quantumMode,
    moleculeKey = quantumMoleculeKey
  } = {}) {
    quantumZ = Math.max(1, Math.min(118, Math.trunc(Number(Z) || 26)));
    quantumRelativistic = Boolean(relativistic);
    quantumMode = mode === 'molecule' ? 'molecule' : 'atom';
    quantumMoleculeKey = MOLECULE_SPECS[moleculeKey] ? moleculeKey : 'H2O';

    const elChoice = UNIVERSES_ELEMENT_CHOICES.find((e) => e.Z === quantumZ);
    if (n != null) quantumN = Math.max(1, Math.min(7, Math.trunc(Number(n))));
    else if (elChoice) quantumN = elChoice.defaultN;
    if (l != null) quantumL = Math.max(0, Math.min(quantumN - 1, Math.trunc(Number(l))));
    else if (elChoice) quantumL = Math.min(quantumN - 1, elChoice.defaultL);
    if (m != null) quantumM = Math.max(-quantumL, Math.min(quantumL, Math.trunc(Number(m))));
    else quantumM = 0;

    const res = await getElementBundle(quantumZ, {
      relativistic: quantumRelativistic,
      returnOrbitalWavefunctions: true
    });

    if (quantumMode === 'molecule') {
      const spec = MOLECULE_SPECS[quantumMoleculeKey];
      moleculeRhfResult = await solveMoleculeRhfWebGpu(device, spec.atoms);
      const posZeta = new Float32Array(spec.atoms.length * 4);
      const weights = new Float32Array(spec.atoms.length * 4);
      for (let i = 0; i < spec.atoms.length; i += 1) {
        const a = spec.atoms[i];
        posZeta.set([a.position[0], a.position[1], a.position[2], a.Z === 1 ? 1.24 : 2.25], i * 4);
        weights.set([a.Z, i % 2 === 0 ? 1.0 : -0.85, i % 2 === 0 ? -0.9 : 1.0, 0], i * 4);
      }
      orbitalCloud = sampleMolecularOrbitalCloudWebGpu(device, {
        posZeta,
        weights,
        boxHalfBohr: 4.2,
        mode: 0,
        pointCount: Math.min(140000, quality.orbitalPoints),
        seed: (universeSeed ^ 0x6a09e667) >>> 0,
        reuseBuffer: orbitalCloud?.pointsBuffer || null
      });
    } else {
      const atom = res.visualData.atom;
      const orbMatch = (atom.orbitals || []).find((o) => o.n === quantumN && o.l === quantumL && o.u?.length);
      orbitalCloud = sampleAtomicOrbitalCloudWebGpu(device, {
        Z: quantumZ,
        n: quantumN,
        l: quantumL,
        m: quantumM,
        pointCount: quality.orbitalPoints,
        rGrid: orbMatch ? atom.rGrid : null,
        orbitalU: orbMatch ? orbMatch.u : null,
        screeningExchange: true,
        relativisticSpinOrbit: quantumRelativistic,
        colorMode: 1,
        seed: (universeSeed ^ (quantumZ * 2654435761)) >>> 0,
        reuseBuffer: orbitalCloud?.pointsBuffer || null
      });
    }
  }

  // ---- L7: Atomic Nucleus & Tunneling ----
  async function initAtomicNucleus({ Z = nuclearZ, A = null } = {}) {
    nuclearZ = Math.max(1, Math.min(118, Math.trunc(Number(Z) || 26)));
    const elChoice = UNIVERSES_ELEMENT_CHOICES.find((e) => e.Z === nuclearZ);
    nuclearA = A != null ? Math.max(nuclearZ, Math.trunc(Number(A))) : (elChoice?.A || Math.round(nuclearZ * 2.15));
    if (tdseSession) {
      tdseSession.destroy();
      tdseSession = null;
    }
    nuclearResult = await solveNuclearStructureWebGpu(device, nuclearZ, nuclearA, {
      volDim: quality.nuclearVolDim
    });
    tdseSession = createNuclearTunnelingTdseWebGpu(device, nuclearResult);
    tdseTelemetry = tdseSession ? await tdseSession.stepBatch(8) : null;
  }

  // ---- Per-Frame Real GPU Physics Stepping ----
  async function stepLevel(level, timeScale = 1.0) {
    if (busy || disposed) return;
    busy = true;
    try {
      if (level === 0 && cosmoSession) {
        cosmoTelemetry = await cosmoSession.step({ readTelemetry: true });
      } else if (level === 1 && galaxyEngine) {
        const dt = 0.012 * Math.max(0.1, Math.min(3.0, timeScale));
        await galaxyEngine.step({ dt, gravity: 1.0, softening: 0.24, readback: false });
      } else if (level === 2 && systemEngine) {
        await stepStarSystem(timeScale);
      } else if (level === 3 && stellarEngine) {
        stellarTelemetry = await stellarEngine.step({
          dt: 0.015 * Math.max(0.2, Math.min(2.5, timeScale)),
          timeAccel: stellarTimeAccel,
          readTelemetry: true
        });
      } else if (level === 5 && mdSession) {
        const steps = Math.max(1, Math.min(8, Math.round(3 * timeScale)));
        mdTelemetry = await mdSession.stepBatch(steps, {
          readTelemetry: true,
          targetTemperatureK: mdTempK,
          nonBlocking: true
        });
        if (mdTelemetry?.rdf) mdRdfHistory = Array.from(mdTelemetry.rdf);
      } else if (level === 7 && tdseSession) {
        const steps = Math.max(2, Math.min(24, Math.round(10 * timeScale)));
        const nextT = await tdseSession.stepBatch(steps, { nonBlocking: true });
        if (nextT) tdseTelemetry = nextT;
      }
    } finally {
      busy = false;
    }
  }

  async function stepStarSystem(timeScale = 1.0) {
    if (!systemEngine) return;
    const dt = 0.014 * Math.max(0.1, Math.min(3.0, timeScale));
    systemBodies = await systemEngine.step({ dt, gravity: 1.0, softening: 0.02, readback: true });
    for (let i = 0; i < systemTargets.length; i += 1) {
      const o = i * 8;
      const p = [systemBodies[o], systemBodies[o + 1], systemBodies[o + 2]];
      systemTargets[i].pos = p;
      const hist = systemOrbitHistory[i];
      if (hist) {
        const last = hist[hist.length - 1];
        if (!last || Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) > 0.14) {
          hist.push(p);
          if (hist.length > 140) hist.shift();
        }
      }
    }
  }

  // ---- PeerCompute Live 2-of-2 Quorum Mesh ----
  async function disconnectPeerMesh() {
    if (!peerMesh) return;
    const prev = peerMesh;
    peerMesh = null;
    try { await prev.stop(); } catch {}
    peerMeshState = {
      ...peerMeshState,
      connected: false,
      remotePeers: 0,
      remotePeerIds: [],
      quorumReady: false,
      error: null
    };
  }

  async function connectPeerMesh({ relayUrl = peerMeshState.relayUrl, roomId = peerMeshState.roomId, role = peerMeshState.role } = {}) {
    await disconnectPeerMesh();
    const cleanRelay = String(relayUrl || '').trim();
    const cleanRoom = String(roomId || 'ulg-universes-mesh-v1').trim();
    const cleanRole = ['requester', 'responder', 'observer'].includes(role) ? role : 'requester';
    if (!cleanRelay) {
      peerMeshState = { ...peerMeshState, connected: false, relayUrl: '', roomId: cleanRoom, role: cleanRole, error: null };
      return peerMeshState;
    }
    try {
      const peerId = `uv-${cleanRole}-${Math.random().toString(36).slice(2, 8)}`;
      const taskModuleUrl = new URL('../services/cosmicQuantumPeerTask.js', import.meta.url).href;
      let handle = null;
      let transport = null;
      if (cleanRole === 'observer') {
        transport = createRelaySignalingTransport({
          relayUrl: cleanRelay,
          roomId: cleanRoom,
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
        const mesh = startLiveClientDerivationPeerMesh({
          relayUrl: cleanRelay,
          roomId: cleanRoom,
          peerId,
          enableWebRtc: false,
          taskModuleUrl,
          announceIntervalMs: 120,
          staleMs: 12000,
          timeoutMs: 30000
        });
        transport = mesh.transport;
        handle = {
          mesh,
          getStatus: () => mesh.getStatus(),
          getActiveRequester: () => mesh.getActiveRequester(),
          async stop() { mesh.stop(); }
        };
      }
      peerMesh = { transport, handle, peerId, role: cleanRole, stop: () => handle?.stop?.() };
      const st0 = handle.getStatus() || {};
      peerMeshState = {
        connected: true,
        role: cleanRole,
        relayUrl: cleanRelay,
        roomId: cleanRoom,
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
        relayUrl: cleanRelay,
        roomId: cleanRoom,
        role: cleanRole,
        error: err instanceof Error ? err.message : String(err)
      };
    }
    return getPeerMeshState();
  }

  function getPeerMeshState() {
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
  }

  async function dispatchPeerDerivation(atomicNumberZ = quantumZ) {
    const req = peerMesh?.handle?.getActiveRequester?.();
    if (!req || typeof req.submitWithProvenance !== 'function') {
      const err = new Error('Peer mesh 2-of-2 quorum requester is not ready (requires >= 2 live remote responders)');
      err.code = 'ERR_CLIENT_PEER_QUORUM_UNAVAILABLE';
      throw err;
    }
    const taskId = `uv-quorum-${Date.now()}-${peerMeshState.dispatches + 1}`;
    const res = await req.submitWithProvenance(taskId, {
      service: 'cosmic-quantum-material',
      kind: 'material.resolve-element',
      payload: { atomicNumberZ, functional: 'pbe' }
    });
    peerMeshState.dispatches += 1;
    peerMeshState.lastResult = res;
    return res;
  }

  async function ensureLevelInitialized(level, opts = {}) {
    if (level === 0 && !cosmoSession) await initCosmicWeb(opts);
    if (level === 1 && !galaxyEngine) await initGalaxy(opts);
    if (level === 2 && !systemEngine) await initStarSystem(opts);
    if (level === 3 && !stellarEngine) await initStellarCore(opts);
    if (level === 4 && !planetaryResult) await initPlanetaryInterior(opts);
    if (level === 5 && !mdSession) await initMolecularDynamics(opts);
    if (level === 6 && !orbitalCloud) await initQuantumAtom(opts);
    if (level === 7 && !nuclearResult) await initAtomicNucleus(opts);
  }

  function setQuality(nextId) {
    if (!QUALITY_PRESETS[nextId]) return false;
    quality = QUALITY_PRESETS[nextId];
    return true;
  }

  function setSeed(nextSeed) {
    universeSeed = (Number(nextSeed) >>> 0) || 1;
  }

  function setMdGravity(enabled) {
    mdGravity = Boolean(enabled);
    if (mdSession && typeof mdSession.setGravity === 'function') {
      mdSession.setGravity(mdGravity);
    }
  }

  function setMdTemp(tempK) {
    mdTempK = Math.max(15, Math.round(Number(tempK) || 300));
  }

  function setPlanetaryCutaway(enabled) {
    planetaryCutaway = Boolean(enabled);
  }

  function setStellarTimeAccel(val) {
    stellarTimeAccel = Math.max(0.4, Math.min(8.0, Number(val) || 2.0));
  }

  function getCachedElementBundle(Z, rel = true) {
    const zSafe = Math.max(1, Math.min(118, Math.trunc(Number(Z) || 26)));
    return bundleCache.get(`${zSafe}:std:${rel ? 1 : 0}:1`)
      || bundleCache.get(`${zSafe}:std:${rel ? 1 : 0}:0`)
      || bundleCache.get(`${zSafe}:std:1:1`)
      || bundleCache.get(`${zSafe}:std:1:0`)
      || null;
  }

  function getTargetsForLevel(level) {
    if (level === 0) return cosmoTargets;
    if (level === 1) return galaxyTargets;
    if (level === 2) return systemTargets;
    if (level === 3) {
      const burn = getGate1StellarBurnConstants();
      return [
        {
          id: 'stellar-fusion-core',
          level: 3,
          name: 'Thermonuclear Fusion Core',
          subtitle: `Gate 1 pp/CNO/3α Burn · Q_pp = ${burn.ppThermalMeV.toFixed(2)} MeV`,
          pos: [0, 0, 0],
          radius: 1.8,
          tempK: stellarTelemetry?.coreTempK || 1.5e7,
          massLabel: `${(stellarEngine?.totalMassSolar || 1.0).toFixed(2)} M☉`,
          composition: `H ${((stellarTelemetry?.meanXH ?? 0.72) * 100).toFixed(1)}% · He ${((stellarTelemetry?.meanXHe ?? 0.26) * 100).toFixed(1)}% · Metals ${((stellarTelemetry?.meanXZ ?? 0.02) * 100).toFixed(1)}%`,
          nextLevel: 4
        },
        {
          id: 'stellar-he-shell',
          level: 3,
          name: 'Synthesized ⁵⁶Fe / ¹²C Ash Parcel',
          subtitle: 'Dive straight to Planetary / Crystal Matter',
          pos: [3.2, 0.8, 1.4],
          radius: 1.2,
          tempK: Math.max(5000, (stellarTelemetry?.coreTempK || 1e7) * 0.08),
          massLabel: `ρ_core = ${(stellarTelemetry?.coreRhoKgM3 || 1e5).toExponential(1)} kg/m³`,
          composition: 'Fe-56 · C-12 · O-16 · Si-28 Nucleosynthesis Yield',
          nextLevel: 4
        }
      ];
    }
    if (level === 4) return planetaryLayersMeta;
    if (level === 5) {
      const b = getCachedElementBundle(mdElementZ, true)?.bundle;
      const sym = b?.symbol || 'Fe';
      return [
        {
          id: 'md-lattice-atom',
          level: 5,
          name: `${sym} Representative Lattice Atom`,
          subtitle: `${b?.mechanical?.crystalStructure || 'crystal'} · ${mdSession?.atomCount || 0} live GPU atoms`,
          pos: [0, 0, 0],
          radius: 1.5,
          sampleZ: mdElementZ,
          tempK: mdTelemetry?.temperatureK || mdTempK,
          massLabel: `m = ${(b?.nuclear?.atomicMassU || 55.8).toFixed(2)} u`,
          composition: `Phase: ${mdTelemetry?.emergentPhase || mdPhasePreset} · ⟨Z⟩ = ${(mdTelemetry?.meanCoordination || 0).toFixed(2)}`,
          nextLevel: 6
        }
      ];
    }
    if (level === 6) {
      const b = getCachedElementBundle(quantumZ, quantumRelativistic)?.bundle;
      const sym = b?.symbol || 'Fe';
      const lNames = ['s', 'p', 'd', 'f', 'g'];
      const orbName = `${quantumN}${lNames[quantumL] || 'd'} (m=${quantumM})`;
      const eHa = Number(b?.atomic?.totalEnergyHa);
      return [
        {
          id: 'quantum-nucleus-core',
          level: 6,
          name: quantumMode === 'molecule' ? `${MOLECULE_SPECS[quantumMoleculeKey].formula} Molecule (RHF)` : `${sym} (Z=${quantumZ}) · ${orbName}`,
          subtitle: quantumMode === 'molecule'
            ? `WebGPU STO-3G RHF · E = ${(Number(moleculeRhfResult?.totalEnergyHa) || 0).toFixed(3)} Ha`
            : `4-Comp Dirac–KS (${quantumRelativistic ? 'Relativistic ON' : 'Non-Rel'}) · ${orbitalCloud?.pointCount?.toLocaleString() || 0} pts`,
          pos: [0, 0, 0],
          radius: 1.2,
          sampleZ: quantumZ,
          tempK: 300,
          massLabel: Number.isFinite(eHa) ? `E = ${eHa.toFixed(1)} Ha` : '—',
          composition: `Z=${quantumZ} · ${b?.atomic?.configurationString || sym} · ${b?.electromagnetic?.magneticPhase || '—'}`,
          nextLevel: 7
        }
      ];
    }
    if (level === 7) {
      const sym = nuclearResult?.isotope?.split('-')[0] || `Z=${nuclearZ}`;
      const ba = Number(nuclearResult?.bindingPerNucleonMeV ?? 8.79);
      const rc = Number(nuclearResult?.chargeRadiusFm ?? 3.7);
      return [
        {
          id: 'nucleus-core',
          level: 7,
          name: `${nuclearA}${sym} Atomic Nucleus`,
          subtitle: `Z=${nuclearZ}, N=${Math.max(0, nuclearA - nuclearZ)} · Woods–Saxon + Visscher TDSE`,
          pos: [0, 0, 0],
          radius: 1.5,
          tempK: 1e10,
          massLabel: `B/A = ${ba.toFixed(3)} MeV`,
          composition: `Protons ${nuclearZ} · Neutrons ${Math.max(0, nuclearA - nuclearZ)} · R_c = ${rc.toFixed(2)} fm`,
          nextLevel: 0
        }
      ];
    }
    return [];
  }

  function dispose() {
    disposed = true;
    void disconnectPeerMesh();
    try { cosmoSession?.destroy(); } catch {}
    try { galaxyEngine?.dispose(); } catch {}
    try { systemEngine?.dispose(); } catch {}
    try { stellarEngine?.dispose(); } catch {}
    try { mdSession?.destroy(); } catch {}
    try { orbitalCloud?.pointsBuffer?.destroy(); } catch {}
    try { tdseSession?.destroy(); } catch {}
  }

  return Object.freeze({
    get seed() { return universeSeed; },
    get quality() { return quality; },
    get cosmoSession() { return cosmoSession; },
    get cosmoTelemetry() { return cosmoTelemetry; },
    get cosmoFirstPk() { return cosmoFirstPk; },
    get galaxyEngine() { return galaxyEngine; },
    get galaxyPreset() { return galaxyPreset; },
    get galaxyMetallicity() { return galaxyMetallicity; },
    get galaxySmbhPos() { return galaxySmbhPos; },
    get ismCoolingAnchors() { return ismCoolingAnchors; },
    get systemEngine() { return systemEngine; },
    get systemBodies() { return systemBodies; },
    get systemOrbitHistory() { return systemOrbitHistory; },
    get systemStarTempK() { return systemStarTempK; },
    get stellarEngine() { return stellarEngine; },
    get stellarPreset() { return stellarPreset; },
    get stellarTelemetry() { return stellarTelemetry; },
    get stellarNuclearNetwork() { return stellarNuclearNetwork; },
    get stellarLaneEmden() { return stellarLaneEmden; },
    get stellarTimeAccel() { return stellarTimeAccel; },
    get planetaryResult() { return planetaryResult; },
    get planetaryTemplate() { return planetaryTemplate; },
    get planetaryCutaway() { return planetaryCutaway; },
    get mdSession() { return mdSession; },
    get mdTelemetry() { return mdTelemetry; },
    get mdElementZ() { return mdElementZ; },
    get mdTempK() { return mdTempK; },
    get mdGravity() { return mdGravity; },
    get mdPhasePreset() { return mdPhasePreset; },
    get mdRdfHistory() { return mdRdfHistory; },
    get quantumZ() { return quantumZ; },
    get quantumN() { return quantumN; },
    get quantumL() { return quantumL; },
    get quantumM() { return quantumM; },
    get quantumRelativistic() { return quantumRelativistic; },
    get quantumMode() { return quantumMode; },
    get quantumMoleculeKey() { return quantumMoleculeKey; },
    get orbitalCloud() { return orbitalCloud; },
    get moleculeRhfResult() { return moleculeRhfResult; },
    get nuclearZ() { return nuclearZ; },
    get nuclearA() { return nuclearA; },
    get nuclearResult() { return nuclearResult; },
    get tdseSession() { return tdseSession; },
    get tdseTelemetry() { return tdseTelemetry; },
    PLANET_TEMPLATES,
    MOLECULE_SPECS,
    evaluateIsmRadiativeCoolingErgCm3PerS,
    getElementBundle,
    getCachedElementBundle,
    ensureLevelInitialized,
    initCosmicWeb,
    initGalaxy,
    initStarSystem,
    initStellarCore,
    initPlanetaryInterior,
    initMolecularDynamics,
    initQuantumAtom,
    initAtomicNucleus,
    stepLevel,
    setQuality,
    setSeed,
    setMdGravity,
    setMdTemp,
    setPlanetaryCutaway,
    setStellarTimeAccel,
    getTargetsForLevel,
    connectPeerMesh,
    disconnectPeerMesh,
    getPeerMeshState,
    dispatchPeerDerivation,
    dispose
  });
}
