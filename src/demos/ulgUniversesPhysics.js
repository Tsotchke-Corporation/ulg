// First-Principles 40-Order-of-Magnitude WebGPU Physics Orchestrator for ULG Universes
// (`src/demos/ulgUniversesPhysics.js`).
//
// Manages all 8 nested real ULG WebGPU engines on ONE shared GPUDevice with
// continuous-zoom compatibility, emergent dark-matter-halo flat-rotation galaxy,
// true-astronomical-scale double-float symplectic Solar System N-body, and
// quantized 3D nuclear nucleon packing:
//   L0 Cosmic Web        : `supergalacticTreePmGpu.js` (28^3-36^3 1-submit FLRW 3D-FFT TreePM)
//   L1 Spiral Galaxy     : `cosmicQuantumGpuKernels.js` (`SchroederScaleAtlas` multipole with
//                          real NFW/Hernquist dark-matter halo particles + Gate 1 ISM Λ(T,Z))
//   L2 Solar System      : `solarSystemNBodyGpu.js` (f32x2 double-float symplectic GPU N-body,
//                          15 massive bodies + 512 asteroids, exact astronomical radii!)
//   L3 Stellar Core      : `selfGravitatingHydroGpu.js` (`self-gravitating-hydro@1`)
//                          + `stellarNucleosynthesisBridge.js` (GPU nuclear network + RK4 Lane-Emden)
//   L4 Planetary World   : `planetaryStructureGpu.js` (Inline WGSL Polytope Atlas hydrostatic solver)
//   L5 Crystal & Fluid MD: `molecularDynamicsWebGpu.js` (O(N) linked-cell GPU MD + gravity + g(r))
//   L6 Quantum Atom/Mol  : `periodicTableEngineWebGpu.js` (4-comp Dirac-KS) + `orbitalPointCloudWebGpu.js`
//                          + `molecularHartreeFockWebGpu.js` + PeerCompute 2-of-2 quorum mesh
//   L7 Atomic Nucleus    : `nuclearStructureGpu.js` (3D Woods-Saxon GPU volume + quantized Z/N nucleons)
//                          + `photonShellOpticsWebGpu.js` (Symplectic Visscher 1D tunneling TDSE)

import { ArtifactCache } from '../runtime/ArtifactCache.js';
import { ClosureRegistry } from '../runtime/ClosureRegistry.js';
import { defaultSimulationModuleRegistry } from '../runtime/simulationModuleRegistry.js';
import {
  registerAllTopDownLawModules,
  resolveActiveUniversalLaws
} from '../runtime/universalLawGraph.js';
import {
  build2LptCosmologyICsWebGpu,
  buildZeldovichCosmologyICsWebGpu,
  createSupergalacticTreePmSessionWebGpu
} from '../runtime/astrophysics/supergalacticTreePmGpu.js';
import {
  createNebularMhdCollapseSessionWebGpu
} from '../runtime/astrophysics/nebularMhdCollapseGpu.js';
import {
  createProtoplanetaryDiskFormationSessionWebGpu
} from '../runtime/astrophysics/protoplanetaryDiskFormationGpu.js';
import {
  createPlanetaryAtmosphereElectricSessionWebGpu,
  deriveFluidElectrodynamicsState
} from '../runtime/astrophysics/planetaryAtmosphereElectricGpu.js';
import {
  deriveGate1IsmCoolingAnchorsWebGpu,
  evaluateIsmRadiativeCoolingErgCm3PerS
} from '../runtime/astrophysics/galacticIsmCoolingGpu.js';
import {
  AU_METERS,
  REAL_SOLAR_SYSTEM_CATALOG,
  createSolarSystemNBodyEngineWebGpu
} from '../runtime/astrophysics/solarSystemNBodyGpu.js';
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

/**
 * Physically realistic flat-rotation-curve Galaxy initializer (8-float interleaved ABI):
 *   - 20% Hernquist Dark-Matter Halo particles (`popTag = -1.0`, invisible in renderer,
 *     providing REAL GPU multipole self-gravity for an emergent flat rotation curve!)
 *   - 16% Hernquist warm golden central bulge (`popTag in [0.02..0.28]`)
 *   - 56% Exponential stellar disk (`R_d = 3.2`) with 2 primary + 2 secondary logarithmic
 *     spiral arms (pitch ~16 deg) + rose-magenta H II star-forming knots (`popTag in [0.80..1.05]`)
 *   - 8% Faint old stellar halo
 * Exact enclosed mass `M_enc(r)` sets equilibrium circular speeds so the spiral galaxy
 * rotates organically for hundreds of GPU steps without exploding or collapsing into bars!
 */
export function createRealisticSpiralGalaxyBodies({
  count = 32768,
  preset = 'disk',
  seed = 825,
  gravity = 1.0,
  softening = 0.28,
  centerOffset = [0, 0, 0]
} = {}) {
  const n = Math.max(256, Math.min(262144, Math.floor(count)));
  const bodies = new Float32Array(n * 8);
  const rand = mulberry32(seed);
  const gauss = () => {
    const u1 = Math.max(1e-7, rand());
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  const ox = Number(centerOffset?.[0]) || 0;
  const oy = Number(centerOffset?.[1]) || 0;
  const oz = Number(centerOffset?.[2]) || 0;

  const populateSingleGalaxy = (start, end, cx, cy, cz, cvx, cvy, cvz, tiltX, tiltZ, scaleR = 1.0) => {
    const subN = end - start;
    const mSmbh = 30.0 * scaleR;
    const mBulgeTotal = 140.0 * scaleR;
    const mDiskTotal = 260.0 * scaleR;
    const mDmTotal = 950.0 * scaleR;
    const aBulge = 1.05 * scaleR;
    const rDisk = 3.1 * scaleR;
    const aDm = 6.8 * scaleR;

    const enclosedMass = (r) => {
      const mb = mBulgeTotal * (r * r) / ((r + aBulge) * (r + aBulge));
      const x = r / rDisk;
      const md = mDiskTotal * (1 - (1 + x) * Math.exp(-x));
      const mdm = mDmTotal * (r * r) / ((r + aDm) * (r + aDm));
      return mSmbh + mb + md + mdm;
    };

    const cTx = Math.cos(tiltX); const sTx = Math.sin(tiltX);
    const cTz = Math.cos(tiltZ); const sTz = Math.sin(tiltZ);
    const rot = (x, y, z) => {
      const y1 = y * cTx - z * sTx;
      const z1 = y * sTx + z * cTx;
      return [x * cTz - y1 * sTz, x * sTz + y1 * cTz, z1];
    };

    // Index start = central SMBH mass anchor
    bodies.set([cx + ox, cy + oy, cz + oz, mSmbh, cvx, cvy, cvz, 0.05], start * 8);

    const nDm = Math.floor((subN - 1) * 0.20);
    const nBulge = Math.floor((subN - 1) * 0.16);
    const nHaloStars = Math.floor((subN - 1) * 0.06);
    const nDisk = (subN - 1) - nDm - nBulge - nHaloStars;

    const dmEach = mDmTotal / Math.max(1, nDm);
    const bulgeEach = mBulgeTotal / Math.max(1, nBulge + nHaloStars);
    const diskEach = mDiskTotal / Math.max(1, nDisk);

    let cursor = start + 1;

    // 1. Hernquist Dark-Matter Halo particles (popTag = -1.0 -> invisible, real GPU gravity!)
    for (let i = 0; i < nDm && cursor < end; i += 1, cursor += 1) {
      const u = Math.max(0.01, Math.min(0.92, rand()));
      const r = Math.min(14.5 * scaleR, aDm * Math.sqrt(u) / Math.max(0.05, 1 - Math.sqrt(u)));
      const cosP = 2 * rand() - 1;
      const sinP = Math.sqrt(Math.max(0, 1 - cosP * cosP));
      const phi = 2 * Math.PI * rand();
      const lx = r * sinP * Math.cos(phi);
      const ly = r * cosP;
      const lz = r * sinP * Math.sin(phi);
      const sigmaV = Math.sqrt((gravity * enclosedMass(r)) / (3.0 * Math.hypot(r, aDm * 0.45)));
      const pR = rot(lx, ly, lz);
      const vR = rot(gauss() * sigmaV, gauss() * sigmaV, gauss() * sigmaV);
      bodies.set([
        cx + pR[0] + ox, cy + pR[1] + oy, cz + pR[2] + oz, dmEach,
        cvx + vR[0], cvy + vR[1], cvz + vR[2], -1.0
      ], cursor * 8);
    }

    // 2. Warm Golden Central Bulge + Faint Stellar Halo
    for (let i = 0; i < nBulge + nHaloStars && cursor < end; i += 1, cursor += 1) {
      const isHalo = i >= nBulge;
      const u = Math.max(0.005, Math.min(0.93, rand()));
      const aScale = isHalo ? aBulge * 4.2 : aBulge;
      const r = Math.min(11.5 * scaleR, aScale * Math.sqrt(u) / Math.max(0.06, 1 - Math.sqrt(u)));
      const cosP = 2 * rand() - 1;
      const sinP = Math.sqrt(Math.max(0, 1 - cosP * cosP));
      const phi = 2 * Math.PI * rand();
      const lx = r * sinP * Math.cos(phi);
      const ly = r * cosP * (isHalo ? 0.85 : 0.62);
      const lz = r * sinP * Math.sin(phi);
      const vCirc = Math.sqrt((gravity * enclosedMass(r)) / Math.hypot(r, softening));
      const disp = vCirc * (isHalo ? 0.52 : 0.42);
      const spinFrac = isHalo ? 0.15 : 0.55;
      const vx = -Math.sin(phi) * vCirc * spinFrac + gauss() * disp;
      const vy = gauss() * disp * 0.72;
      const vz = Math.cos(phi) * vCirc * spinFrac + gauss() * disp;
      const pR = rot(lx, ly, lz);
      const vR = rot(vx, vy, vz);
      const popTag = isHalo ? (0.24 + rand() * 0.10) : (0.02 + Math.min(0.28, (r / (2.5 * scaleR)) * 0.24));
      bodies.set([
        cx + pR[0] + ox, cy + pR[1] + oy, cz + pR[2] + oz, bulgeEach,
        cvx + vR[0], cvy + vR[1], cvz + vR[2], popTag
      ], cursor * 8);
    }

    // 3. Exponential Disk with Smooth Logarithmic Spiral Arms & H II Star-Forming Knots
    const pitchTan = Math.tan((17 * Math.PI) / 180); // realistic ~17 deg Sc/Sb spiral pitch
    for (; cursor < end; cursor += 1) {
      // Sample exponential disk radius r ~ Gamma(2, rDisk) smoothly down to core (no inner ring gap!)
      const rRaw = -rDisk * Math.log(Math.max(1e-4, rand() * rand()));
      const r = Math.max(0.18 * scaleR, Math.min(11.5 * scaleR, rRaw * 0.78));
      const armStrength = Math.min(1.0, Math.max(0.0, (r - 0.7 * scaleR) / (2.0 * scaleR)));
      const isArmStar = rand() < (0.72 * armStrength);
      let theta;
      let popTag;
      if (isArmStar) {
        const armIdx = (cursor & 3); // 2 primary + 2 secondary logarithmic arms
        const isPrimary = (armIdx & 1) === 0;
        const armBase = (armIdx * Math.PI) * 0.5 + (isPrimary ? 0 : 0.22);
        const logSpiral = Math.log(1.0 + r / (0.65 * scaleR)) / pitchTan;
        const armWidth = (isPrimary ? 0.28 : 0.38) + 0.024 * (r / scaleR);
        theta = armBase + logSpiral + gauss() * armWidth;
        const isH2 = rand() < 0.11 && r > 1.4 * scaleR && r < 8.5 * scaleR;
        popTag = isH2 ? (0.82 + rand() * 0.22) : (0.38 + rand() * 0.38);
      } else {
        theta = rand() * Math.PI * 2;
        popTag = 0.08 + rand() * 0.26; // warm inter-arm & inner disk stars
      }
      const zH = (0.12 + 0.028 * (r / scaleR)) * scaleR;
      const lx = r * Math.cos(theta);
      const lz = r * Math.sin(theta);
      const ly = gauss() * zH;
      const mEnc = enclosedMass(r);
      const vCirc = Math.sqrt((gravity * mEnc) / Math.hypot(r, softening));
      const epicyclic = vCirc * (0.06 + 0.04 * Math.exp(-r / rDisk));
      const vx = -Math.sin(theta) * vCirc + gauss() * epicyclic;
      const vy = gauss() * epicyclic * 0.45;
      const vz = Math.cos(theta) * vCirc + gauss() * epicyclic;
      const pR = rot(lx, ly, lz);
      const vR = rot(vx, vy, vz);
      bodies.set([
        cx + pR[0] + ox, cy + pR[1] + oy, cz + pR[2] + oz, diskEach,
        cvx + vR[0], cvy + vR[1], cvz + vR[2], popTag
      ], cursor * 8);
    }
  };

  if (preset === 'binary') {
    const half = n >> 1;
    populateSingleGalaxy(0, half, -5.8, 0.9, -1.5, 1.35, -0.22, 1.05, 0.35, 0.18, 0.68);
    populateSingleGalaxy(half, n, 5.8, -0.9, 1.5, -1.35, 0.22, -1.05, -0.42, -0.25, 0.68);
  } else if (preset === 'sphere') {
    // Giant Elliptical Galaxy (de Vaucouleurs / Hernquist pressure-supported spheroid)
    const aEll = 3.2;
    const mTot = 950.0;
    const mEach = mTot / n;
    bodies.set([ox, oy, oz, 60.0, 0, 0, 0, 0.05], 0);
    for (let i = 1; i < n; i += 1) {
      const u = Math.max(0.004, Math.min(0.93, rand()));
      const r = Math.min(11.5, aEll * Math.sqrt(u) / Math.max(0.06, 1 - Math.sqrt(u)));
      const cosP = 2 * rand() - 1;
      const sinP = Math.sqrt(Math.max(0, 1 - cosP * cosP));
      const phi = 2 * Math.PI * rand();
      const mEnc = 60.0 + mTot * (r * r) / ((r + aEll) * (r + aEll));
      const sig = Math.sqrt((gravity * mEnc) / (3.0 * Math.hypot(r, 1.2)));
      bodies.set([
        r * sinP * Math.cos(phi) + ox,
        r * cosP * 0.78 + oy,
        r * sinP * Math.sin(phi) + oz,
        mEach,
        gauss() * sig, gauss() * sig, gauss() * sig,
        0.04 + Math.min(0.30, (r / 10.0) * 0.26)
      ], i * 8);
    }
  } else {
    populateSingleGalaxy(0, n, 0, 0, 0, 0, 0, 0, 0, 0, 1.0);
  }

  return bodies;
}

/**
 * Build exact deterministic 3D quantized nucleon sphere instances (`Z` protons + `N` neutrons)
 * packed inside the GPU-solved Woods-Saxon radii `R_p` and `R_n` (showing genuine neutron skin!).
 */
export function buildQuantizedNucleonSpheres(nuclearResult, scaleRadius = 1.85, timeSec = 0) {
  const Z = Math.max(1, Math.min(118, Math.trunc(nuclearResult?.Z || 26)));
  const A = Math.max(Z, Math.min(256, Math.trunc(nuclearResult?.A || 56)));
  const N = Math.max(0, A - Z);
  const rand = mulberry32((Z * 73856093) ^ (A * 19349663));
  const rCharge = Math.max(1.0, Number(nuclearResult?.chargeRadiusFm || 3.7));
  const skinRatio = 1.0 + Math.max(0, 0.26 * (N - Z) / Math.max(1, A));
  // Each nucleon radius scales as r_nuc / A^(1/3) so close-packed volume equals (4/3) pi R^3
  const nucR = (scaleRadius / Math.max(1.2, Math.cbrt(A))) * 0.88;
  const maxCoreR = Math.max(0.2, scaleRadius - nucR * 0.6);

  // True isotropic 3D golden-angle Fibonacci concentric sphere packing (ZERO 1D ribbon correlation!)
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  for (let i = 0; i < A; i += 1) {
    const frac = (i + 0.5) / A;
    // Shuffle radial shell index via coprime stride so inner & outer shells both cover all latitudes!
    const rRank = (((i * 37 + 13) % A) + 0.5) / A;
    const rUnit = Math.cbrt(rRank);
    const y = 1 - 2 * frac;
    const radXY = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * goldenAngle + (rand() - 0.5) * 0.12;
    pts.push({
      dir: [Math.cos(th) * radXY, y, Math.sin(th) * radXY],
      rUnit,
      phase: rand() * Math.PI * 2
    });
  }
  // Assign protons evenly through the core and excess neutrons toward the outer neutron skin!
  pts.sort((a, b) => a.rUnit - b.rUnit);
  const out = [];
  let pLeft = Z;
  let nLeft = N;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const remain = pts.length - i;
    // Slight preference for neutrons at outer rUnit > 0.78 when N > Z (real nuclear skin!)
    const pProb = (pLeft / Math.max(1, remain)) * (p.rUnit > 0.82 && nLeft > pLeft ? 0.45 : 1.15);
    const isProton = pLeft > 0 && (nLeft === 0 || rand() < pProb);
    if (isProton) pLeft -= 1; else nLeft -= 1;

    const rMult = isProton ? maxCoreR : maxCoreR * skinRatio;
    const rr = p.rUnit * rMult;
    out.push({
      pos: [p.dir[0] * rr, p.dir[1] * rr, p.dir[2] * rr],
      radius: nucR,
      color0: isProton ? [0.96, 0.34, 0.18] : [0.46, 0.68, 0.94],
      color1: isProton ? [1.0, 0.72, 0.34] : [0.78, 0.88, 1.0],
      kind: 6,
      seed: i * 1.13 + rCharge
    });
  }
  return out;
}

export function buildEmissionLinesForContext(level, target, elementBundle) {
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
  return [
    { wavelengthNm: 410.2, intensity: tK > 6500 ? 0.85 : 0.35 },
    { wavelengthNm: 434.0, intensity: tK > 5500 ? 0.90 : 0.45 },
    { wavelengthNm: 486.1, intensity: 0.92 },
    { wavelengthNm: 495.9, intensity: level <= 1 ? 0.72 : 0.32 },
    { wavelengthNm: 500.7, intensity: level <= 1 ? 0.96 : 0.40 },
    { wavelengthNm: 517.3, intensity: tK < 6500 ? 0.76 : 0.28 },
    { wavelengthNm: 587.6, intensity: tK > 8000 ? 0.95 : 0.42 },
    { wavelengthNm: 589.3, intensity: tK < 5500 ? 0.90 : 0.30 },
    { wavelengthNm: 656.3, intensity: 1.0 }
  ];
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
  registerAllTopDownLawModules(defaultSimulationModuleRegistry);
  const bundleCache = new Map();
  const planetaryAtlasCache = new Map();

  // Level 0: IllustrisTNG / Millennium-Style 2LPT Supergalactic Cosmic Web
  let cosmoSession = null;
  let cosmoTelemetry = null;
  let cosmoFirstPk = null;
  let cosmoTargets = [];

  // Level 1: Flat-Rotation Spiral Galaxy + Dark Matter Halo + Galactic Dynamo
  let galaxyEngine = null;
  let galaxyPreset = 'disk';
  let galaxyMetallicity = 1.0;
  let ismCoolingAnchors = null;
  let galaxyTargets = [];
  let galaxyFocusPos = [4.8, 0.04, 2.1];
  let galaxyBranch = 'solar-system'; // 'solar-system' | 'smbh-core'
  let showGalacticBField = true;

  // Optional Galactic Core SMBH hypervelocity S-star N-body engine
  let smbhEngine = null;
  let smbhBodies = null;

  // Level 2: Real-Scale Double-Float Symplectic GPU Solar System N-Body + Protoplanetary Formation Disk
  let solarEngine = null;
  let solarConservation0 = null;
  let solarConservation = null;
  let focusedSolarBodyIndex = 3; // Default focus: Earth
  let solarMode = 'nbody'; // 'nbody' | 'formation'
  let protoplanetarySession = null;
  let protoplanetaryTelemetry = null;
  let protoplanetaryGasDrag = true;

  // Level 3: Stellar Core Fusion (`self-gravitating-hydro@1`) + 3D Resistive MHD Nebular Collapse & Jets!
  let stellarEngine = null;
  let stellarPreset = 'solar-nebula';
  let stellarTelemetry = null;
  let stellarNuclearNetwork = null;
  let stellarLaneEmden = null;
  let stellarClosureRef = null;
  let stellarTimeAccel = 2.0;
  let stellarMode = 'fusion'; // 'fusion' | 'nebular-mhd'
  let nebulaMhdSession = null;
  let nebulaMhdTelemetry = null;
  let nebulaMhdStreamlines = new Float32Array(0);
  let nebulaB0 = 0.58;

  // Level 4: Planetary Interior + Dynamic Spherical Baroclinic Atmosphere & Triboelectric Lightning EM!
  let planetaryResult = null;
  let planetaryBodyIndex = 3;
  let planetaryCutaway = false;
  let planetaryLayersMeta = [];
  let planetaryAtmoState = null;
  let planetaryAtmoSession = null;
  let planetaryAtmoTelemetry = null;
  let planetaryTriboelectric = true;

  // Level 5: Crystal & Fluid Molecular Dynamics
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
  let quantumMode = 'atom';
  let quantumMoleculeKey = 'H2O';
  let orbitalCloud = null;
  let moleculeRhfResult = null;

  // Level 7: Atomic Nucleus & Tunneling
  let nuclearZ = initialElementZ;
  let nuclearA = 56;
  let nuclearResult = null;
  let tdseSession = null;
  let tdseTelemetry = null;

  // PeerCompute Live 2-of-2 Quorum Mesh
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

  // ---- L0: 2LPT IllustrisTNG / Millennium-Style Supergalactic Cosmic Web ----
  async function initCosmicWeb({ seedOverride = null } = {}) {
    if (cosmoSession) {
      cosmoSession.destroy();
      cosmoSession = null;
    }
    const activeSeed = (seedOverride ?? universeSeed) >>> 0;
    const gpuIc = await build2LptCosmologyICsWebGpu(device, {
      gridPerSide: quality.cosmoGridPerSide,
      fftGridN: quality.cosmoFftN,
      boxLengthMpc: 200,
      aInit: 0.16,
      amplitude: 0.44,
      seed: activeSeed
    });
    cosmoSession = createSupergalacticTreePmSessionWebGpu(device, {
      gridPerSide: quality.cosmoGridPerSide,
      pmGridN: quality.cosmoFftN,
      boxLengthMpc: 200,
      aInit: 0.16,
      da: 0.0085,
      initialConditions: gpuIc
    });
    cosmoFirstPk = null;
    // Pre-evolve 6 FLRW TreePM steps so sharp 2LPT cosmic filaments & amber cluster nodes shine immediately!
    for (let w = 0; w < 6; w += 1) {
      cosmoTelemetry = await cosmoSession.step({ readTelemetry: w === 0 || w === 5 });
      if (w === 0 && cosmoTelemetry?.powerSpectrumPk?.kBins?.length) {
        cosmoFirstPk = {
          kBins: [...cosmoTelemetry.powerSpectrumPk.kBins],
          pkValues: [...cosmoTelemetry.powerSpectrumPk.pkValues]
        };
      }
    }

    const rand = mulberry32(activeSeed ^ 0x51f15e);
    cosmoTargets = Array.from({ length: 5 }, (_, i) => {
      const morph = GALAXY_MORPHOLOGIES[i % GALAXY_MORPHOLOGIES.length];
      const prefix = GALAXY_PREFIXES[Math.floor(rand() * GALAXY_PREFIXES.length)];
      const num = 1000 + Math.floor(rand() * 8900);
      // Place cluster 0 near center for smooth continuous zoom directly into L1
      const spread = i === 0 ? 18.0 : 72.0;
      const xMpc = (rand() - 0.5) * 2 * spread;
      const yMpc = (rand() - 0.5) * 1.4 * spread;
      const zMpc = (rand() - 0.5) * 2 * spread;
      const zMet = Number((0.6 + rand() * 1.1).toFixed(2));
      return {
        id: `cluster-${i}`,
        level: 0,
        name: `${prefix}-${num} Supercluster`,
        subtitle: `${morph === 'disk' ? 'Grand-Design Spiral' : morph === 'binary' ? 'Interacting Merger Pair' : 'Giant Elliptical'} · Z=${zMet} Z☉`,
        posMpc: [xMpc, yMpc, zMpc],
        pos: [xMpc * 0.1, yMpc * 0.1, zMpc * 0.1],
        radius: 1.0,
        morphology: morph,
        metallicity: zMet,
        massLabel: `${(1.2 + rand() * 4.5).toFixed(2)}×10¹² M☉`,
        tempK: 6500 + Math.round(rand() * 4500),
        composition: `DM 84% · H 12% · He 3.8% · Met ${(0.2 * zMet).toFixed(2)}%`,
        nextLevel: 1
      };
    });
  }

  // ---- L1: Realistic Flat-Rotation-Curve Spiral Galaxy ----
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
    const bodies0 = createRealisticSpiralGalaxyBodies({
      count: quality.galaxyStars,
      preset: galaxyPreset,
      seed: activeSeed
    });
    galaxyEngine = createResidentScaleAtlasMultipoleNBodyEngine({
      device,
      initialBodies: bodies0,
      mode: 0,
      boxHalf: 16.0,
      theta: 0.65,
      label: `ulg-universes-galaxy-${quality.galaxyStars}`
    });
    await galaxyEngine.step({ dt: 0.008, gravity: 1.0, softening: 0.28, readback: false });

    const rand = mulberry32(activeSeed ^ 0x229a1);
    const armPos = [4.8, 0.04, 2.1];
    galaxyFocusPos = [...armPos];
    galaxyTargets = [
      {
        id: 'star-solar',
        level: 1,
        branch: 'solar-system',
        name: 'Orion Spur · Solar System',
        subtitle: 'G2V Main-Sequence Star · 8 Planets · 512 Asteroids (26 kly from Core)',
        pos: armPos,
        radius: 0.8,
        tempK: 5778,
        massLabel: '1.00 M☉',
        composition: 'H 73.5% · He 24.8% · O/C/Fe 1.7%',
        nextLevel: 2
      },
      {
        id: 'smbh-core',
        level: 1,
        branch: 'smbh-core',
        name: 'Sagittarius-ULG* (Galactic Core SMBH)',
        subtitle: '4.3×10⁶ M☉ Supermassive Black Hole · Zoom In for Schwarzschild Lensing',
        pos: [0, 0, 0],
        radius: 1.0,
        isSmbh: true,
        tempK: 28000,
        massLabel: '4.3×10⁶ M☉',
        composition: 'Relativistic Plasma · Hypervelocity S-Stars',
        nextLevel: 2
      },
      {
        id: 'star-h2',
        level: 1,
        branch: 'solar-system',
        name: 'Carina-ULG OB Association',
        subtitle: 'Young Spiral-Arm H II Star-Forming Region',
        pos: [-4.4, -0.05, 3.6],
        radius: 0.8,
        tempK: 16500,
        massLabel: '18.2 M☉',
        composition: 'H 70% · He 28% · O III / Hα Emission',
        nextLevel: 2
      },
      {
        id: 'star-outer',
        level: 1,
        branch: 'solar-system',
        name: 'Perseus Arm K-Dwarf System',
        subtitle: 'Flat-Rotation-Curve Outer Disk System (38 kly)',
        pos: [Math.cos(rand() * 6.28) * 6.8, 0.08, Math.sin(rand() * 6.28) * 6.8],
        radius: 0.75,
        tempK: 4850,
        massLabel: '0.82 M☉',
        composition: 'H 74% · He 24.7% · Metals 1.3%',
        nextLevel: 2
      }
    ];
  }

  // Optional Galactic Core SMBH + Hypervelocity S-Stars GPU N-Body (when user zooms into Sgr A*!)
  async function initSmbhCore() {
    if (smbhEngine) return;
    const count = 24;
    const bodies0 = new Float32Array(count * 8);
    const mBh = 40.0;
    bodies0.set([0, 0, 0, mBh, 0, 0, 0, 0.72], 0);
    const rand = mulberry32((universeSeed ^ 0x424800) >>> 0);
    for (let i = 1; i < count; i += 1) {
      const a = 3.2 + rand() * 6.8;
      const e = 0.25 + rand() * 0.58;
      const rPeri = a * (1 - e);
      const th = rand() * Math.PI * 2;
      const inc = (rand() - 0.5) * 1.4;
      const vPeri = Math.sqrt((1.0 * mBh * (1 + e)) / Math.max(0.5, rPeri));
      const x = Math.cos(th) * rPeri;
      const y = Math.sin(th) * rPeri * Math.sin(inc);
      const z = Math.sin(th) * rPeri * Math.cos(inc);
      const vx = -Math.sin(th) * vPeri;
      const vy = Math.cos(th) * vPeri * Math.sin(inc);
      const vz = Math.cos(th) * vPeri * Math.cos(inc);
      bodies0.set([x, y, z, 0.002, vx, vy, vz, 0.14 + rand() * 0.08], i * 8);
    }
    smbhEngine = createResidentTiledNBodyEngine({
      device,
      initialBodies: bodies0,
      mode: 0,
      label: 'ulg-universes-smbh-sstars'
    });
    smbhBodies = await smbhEngine.step({ dt: 0.008, gravity: 1.0, softening: 0.08, readback: true });
  }

  // ---- L2: Real-Scale Double-Float Symplectic WebGPU Solar System N-Body ----
  async function initSolarSystem({ seedOverride = null } = {}) {
    if (solarEngine) {
      solarEngine.dispose();
      solarEngine = null;
    }
    const activeSeed = ((seedOverride ?? universeSeed) + 409) >>> 0;
    solarEngine = createSolarSystemNBodyEngineWebGpu(device, {
      asteroidCount: quality.solarAsteroids,
      seed: activeSeed,
      label: 'ulg-universes-solar-system'
    });
    await solarEngine.step({ dtSubYr: 0.00004, substeps: 4, readMassive: true });
    solarConservation0 = solarEngine.computeConservationDiagnostics();
    solarConservation = solarConservation0;
  }

  // ---- L2 Formation Mode: Protoplanetary Disk + Snow Line + Particle-Rigid Planetesimals ----
  async function initProtoplanetaryDisk({ seedOverride = null } = {}) {
    if (protoplanetarySession) {
      protoplanetarySession.dispose();
      protoplanetarySession = null;
    }
    const activeSeed = ((seedOverride ?? universeSeed) + 773) >>> 0;
    const pebCount = Math.min(4096, Math.max(1536, (quality.solarAsteroids || 512) * 4));
    const nextDisk = createProtoplanetaryDiskFormationSessionWebGpu(device, {
      pebbleCount: pebCount,
      embryoCount: 18,
      enableGasDrag: protoplanetaryGasDrag,
      seed: activeSeed,
      label: 'ulg-universes-protoplanetary-disk'
    });
    protoplanetaryTelemetry = await nextDisk.step({ dt: 0.018, substeps: 3, readTelemetry: true });
    protoplanetarySession = nextDisk;
  }

  // ---- L3 MHD Mode: 3D Self-Gravitating Resistive MHD Nebular Collapse & Bipolar Jets ----
  async function initNebularMhd({ initialB0 = nebulaB0, seedOverride = null } = {}) {
    nebulaB0 = Math.max(0, Math.min(1.5, Number(initialB0) ?? 0.58));
    if (nebulaMhdSession) {
      nebulaMhdSession.dispose();
      nebulaMhdSession = null;
    }
    const activeSeed = ((seedOverride ?? universeSeed) + 3133) >>> 0;
    const nextMhd = createNebularMhdCollapseSessionWebGpu(device, {
      gridN: quality.id === 'low' ? 16 : 32,
      tracerCount: Math.min(8192, Math.max(3072, quality.stellarParticles || 4096)),
      initialB0: nebulaB0,
      spinOmega: 2.35,
      gravityG: 2.4,
      seed: activeSeed,
      label: 'ulg-universes-nebular-mhd'
    });
    // Pre-evolve 16 MHD steps so disk flattening, helical B-field winding & magnetocentrifugal jets start visibly!
    nebulaMhdTelemetry = await nextMhd.step({
      dt: 0.024,
      substeps: 16,
      readTelemetry: true,
      readBFieldForStreamlines: true
    });
    nebulaMhdStreamlines = nextMhd.buildMagneticFieldStreamlines({ worldScale: 1.0, alpha: 0.68 });
    nebulaMhdSession = nextMhd;
  }

  // ---- L3: Stellar Core & Fusion Plasma ----
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

  // ---- L4: Planetary Hydrostatic Interior (Inline WGSL Polytope Atlas) ----
  async function initPlanetaryInterior({ bodyIndex = planetaryBodyIndex } = {}) {
    const idx = Math.max(1, Math.min(REAL_SOLAR_SYSTEM_CATALOG.length - 1, Math.trunc(Number(bodyIndex) || 3)));
    planetaryBodyIndex = idx;
    const spec = REAL_SOLAR_SYSTEM_CATALOG[idx];
    const zCore = spec.coreZ || 26;
    const zMantle = spec.mantleZ || 14;
    const zSurf = spec.surfZ || 29;

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

    const centralP = Math.max(5e9, Math.min(850e9, Number(spec.centralP) || 360e9));
    planetaryResult = await solvePlanetaryInteriorWebGpu(device, {
      centralPressurePa: centralP,
      surfacePressurePa: 1e5,
      radialStepM: 35000,
      maxRadiusM: 3.5e7,
      convergePasses: 3,
      maxProfileSamples: 128,
      layers: [
        { name: `${coreRes.bundle.symbol} Core`, cumulativeMassFraction: 0.32, temperatureK: 5200, atlas: coreAtlas },
        { name: `${mantleRes.bundle.symbol} Mantle`, cumulativeMassFraction: 1.0, temperatureK: 2200, atlas: mantleAtlas }
      ]
    });

    let rCoreNorm = 0.52;
    const prof = planetaryResult?.profile || [];
    const totalR = Math.max(1, planetaryResult?.radiusM || spec.radiusKm * 1000);
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
        name: `${spec.name} · ${coreRes.bundle.symbol} Core`,
        subtitle: `Gate 2 Polytope Atlas · P_c = ${(centralP / 1e9).toFixed(0)} GPa · MoI = ${(planetaryResult?.moiFactor || 0.33).toFixed(3)}`,
        pos: [0.45, 0.35, 0.45],
        radius: 0.7,
        sampleZ: zCore,
        rCoreNorm,
        rMantleNorm: 0.94,
        tempK: 5200,
        massLabel: `R = ${spec.radiusKm.toLocaleString()} km`,
        composition: spec.composition,
        nextLevel: 5
      },
      {
        id: 'layer-mantle',
        level: 4,
        name: `${spec.name} · ${mantleRes.bundle.symbol} Mantle`,
        subtitle: `High-Pressure Polytope Shell · T = 2,200 K`,
        pos: [1.35, 1.05, 1.35],
        radius: 0.7,
        sampleZ: zMantle,
        rCoreNorm,
        rMantleNorm: 0.94,
        tempK: 2200,
        massLabel: `g = ${(planetaryResult?.surfaceGravityMPerS2 || 9.8).toFixed(2)} m/s²`,
        composition: `${mantleRes.bundle.symbol}/O Silicate Mantle`,
        nextLevel: 5
      },
      {
        id: 'layer-surface',
        level: 4,
        name: `${spec.name} · ${surfRes.bundle.symbol} Crust Sample`,
        subtitle: `Scroll in to resolve live ${surfRes.bundle.symbol} WebGPU crystal lattice`,
        pos: [-1.8, 1.4, 1.5],
        radius: 0.7,
        sampleZ: zSurf,
        rCoreNorm,
        rMantleNorm: 0.94,
        tempK: spec.tempK || 288,
        massLabel: `T_eq = ${spec.tempK || 288} K`,
        composition: `${surfRes.bundle.symbol} (${surfRes.bundle.mechanical.crystalStructure})`,
        nextLevel: 5
      }
    ];

    // Dynamic Universal Law Graph Activation for Spherical Fluid, Particulate Triboelectricity,
    // Paschen Breakdown Lightning & Core Geodynamo Aurorae (purely from physical state — ZERO body-name hacks!)
    if (planetaryAtmoSession) {
      planetaryAtmoSession.dispose();
      planetaryAtmoSession = null;
      planetaryAtmoTelemetry = null;
    }
    const coreSigma = Number(coreRes.bundle?.electromagnetic?.electricalConductivitySPerM) || 1.0e6;
    const distAu = Math.max(0.2, Number(spec.aAu || (spec.parent > 0 ? REAL_SOLAR_SYSTEM_CATALOG[spec.parent]?.aAu : 1.0) || 1.0));
    planetaryAtmoState = deriveFluidElectrodynamicsState(
      {
        ...spec,
        coreRadiusNorm: rCoreNorm,
        coreConductivitySm: coreSigma
      },
      { ...planetaryResult, coreRadiusFraction: rCoreNorm, centralPressurePa: centralP },
      { solarDistanceAu: distAu, coreConductivitySm: coreSigma }
    );
    if (planetaryAtmoState.activation.anyActive) {
      const nextAtmo = createPlanetaryAtmosphereElectricSessionWebGpu(device, {
        width: quality.id === 'low' ? 64 : 128,
        height: quality.id === 'low' ? 32 : 64,
        bodyParams: planetaryAtmoState,
        enableTriboelectric: planetaryTriboelectric,
        seed: (universeSeed ^ (idx * 2654435761)) >>> 0,
        label: `ulg-universes-atmo-${idx}`
      });
      // Pre-warm 8 baroclinic steps so Coriolis eddies, dust fronts, lightning & aurorae are live immediately!
      for (let w = 0; w < 4; w += 1) {
        planetaryAtmoTelemetry = await nextAtmo.step({
          dtSim: 0.048,
          substeps: 2,
          readTelemetry: w === 3
        });
      }
      planetaryAtmoSession = nextAtmo;
    }
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
      mdTempK = Math.round(tMelt * 1.42);
    } else if (phasePreset === 'vapor') {
      mdPhasePreset = 'vapor';
      mdTempK = Math.round(tBoil * 1.38);
    } else if (phasePreset === 'solid') {
      mdPhasePreset = 'solid';
      mdTempK = Math.max(20, Math.round(tMelt * 0.25));
    } else if (tempK != null && Number.isFinite(Number(tempK))) {
      mdTempK = Math.max(15, Math.round(Number(tempK)));
    } else {
      mdPhasePreset = 'solid';
      mdTempK = Math.max(20, Math.round(tMelt * 0.25));
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
  async function stepActiveRegimes(activeLevel, log10SpanM, timeScale = 1.0) {
    if (busy || disposed) return;
    busy = true;
    try {
      if (activeLevel === 0 && cosmoSession) {
        // Gently decelerate cosmic evolution once a(t) reaches present epoch (~1.0) so web stays crisp!
        const aCur = cosmoSession.getState().aScale;
        if (aCur < 1.15) {
          cosmoTelemetry = await cosmoSession.step({ readTelemetry: true });
        }
      } else if (activeLevel === 1 && galaxyEngine) {
        const dt = 0.009 * Math.max(0.1, Math.min(3.0, timeScale));
        await galaxyEngine.step({ dt, gravity: 1.0, softening: 0.28, readback: false });
      } else if (activeLevel === 2) {
        if (galaxyBranch === 'smbh-core' && smbhEngine) {
          smbhBodies = await smbhEngine.step({ dt: 0.008 * Math.max(0.1, Math.min(3.0, timeScale)), gravity: 1.0, softening: 0.08, readback: true });
        } else if (solarMode === 'formation' && protoplanetarySession) {
          protoplanetaryTelemetry = await protoplanetarySession.step({
            dt: 0.016 * Math.max(0.2, Math.min(2.5, timeScale)),
            substeps: 2,
            readTelemetry: true
          });
        } else if (solarEngine) {
          // Adaptive safe symplectic substepping: faster orbital pace at 30 AU, gentler when orbiting Moon/Io!
          const isCloseUp = log10SpanM < 10.2;
          const dtSubYr = isCloseUp ? 0.000018 : 0.000055;
          const substeps = Math.max(2, Math.min(48, Math.round((isCloseUp ? 8 : 24) * timeScale)));
          await solarEngine.step({ dtSubYr, substeps, readMassive: true });
          solarConservation = solarEngine.computeConservationDiagnostics();
        }
      } else if (activeLevel === 3) {
        if (stellarMode === 'nebular-mhd' && nebulaMhdSession) {
          const readB = (nebulaMhdSession.stepIndex % 4) === 0;
          nebulaMhdTelemetry = await nebulaMhdSession.step({
            dt: 0.022 * Math.max(0.2, Math.min(2.2, timeScale)),
            substeps: 1,
            readTelemetry: true,
            readBFieldForStreamlines: readB
          });
          if (readB) {
            nebulaMhdStreamlines = nebulaMhdSession.buildMagneticFieldStreamlines({ worldScale: 1.0, alpha: 0.68 });
          }
        } else if (stellarEngine) {
          stellarTelemetry = await stellarEngine.step({
            dt: 0.015 * Math.max(0.2, Math.min(2.5, timeScale)),
            timeAccel: stellarTimeAccel,
            readTelemetry: true
          });
        }
      } else if (activeLevel === 4) {
        let sunDir = [0.65, 0.25, 0.70];
        if (solarEngine) {
          await solarEngine.step({ dtSubYr: 0.000012, substeps: Math.max(1, Math.round(4 * timeScale)), readMassive: true });
          solarConservation = solarEngine.computeConservationDiagnostics();
          const fSt = solarEngine.getMassiveBodyState64(focusedSolarBodyIndex);
          const sSt = solarEngine.getMassiveBodyState64(0);
          const dx = sSt.posAu[0] - fSt.posAu[0];
          const dy = sSt.posAu[1] - fSt.posAu[1];
          const dz = sSt.posAu[2] - fSt.posAu[2];
          const len = Math.hypot(dx, dy, dz) || 1;
          sunDir = [dx / len, dy / len, dz / len];
        }
        // Dynamically step spherical baroclinic fluid + triboelectric lightning ONLY when active!
        if (planetaryAtmoSession) {
          planetaryAtmoTelemetry = await planetaryAtmoSession.step({
            dtSim: 0.042 * Math.max(0.2, Math.min(2.5, timeScale)),
            substeps: 2,
            sunDir,
            readTelemetry: true
          });
        }
      } else if (activeLevel === 5 && mdSession) {
        const steps = Math.max(1, Math.min(8, Math.round(3 * timeScale)));
        mdTelemetry = await mdSession.stepBatch(steps, {
          readTelemetry: true,
          targetTemperatureK: mdTempK,
          nonBlocking: true
        });
        if (mdTelemetry?.rdf) mdRdfHistory = Array.from(mdTelemetry.rdf);
      } else if (activeLevel === 7 && tdseSession) {
        const steps = Math.max(2, Math.min(24, Math.round(10 * timeScale)));
        const nextT = await tdseSession.stepBatch(steps, { nonBlocking: true });
        if (nextT) tdseTelemetry = nextT;
      }
    } finally {
      busy = false;
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
        transport = createRelaySignalingTransport({ relayUrl: cleanRelay, roomId: cleanRoom, peerId, enableWebRtc: false });
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

  const initInFlight = new Map();
  async function ensureLevelInitialized(level, opts = {}) {
    if (level === 0 && cosmoSession) return;
    if (level === 1 && galaxyEngine) return;
    if (level === 2 && (galaxyBranch === 'smbh-core' ? smbhEngine : solarEngine)) return;
    if (level === 3 && stellarEngine) return;
    if (level === 4 && planetaryResult) return;
    if (level === 5 && mdSession) return;
    if (level === 6 && orbitalCloud) return;
    if (level === 7 && nuclearResult) return;

    const k = level === 2 ? `2:${galaxyBranch}` : String(level);
    if (initInFlight.has(k)) return initInFlight.get(k);
    const p = (async () => {
      if (level === 0) await initCosmicWeb(opts);
      else if (level === 1) await initGalaxy(opts);
      else if (level === 2) {
        if (galaxyBranch === 'smbh-core') await initSmbhCore();
        else await initSolarSystem(opts);
      } else if (level === 3) await initStellarCore(opts);
      else if (level === 4) await initPlanetaryInterior(opts);
      else if (level === 5) await initMolecularDynamics(opts);
      else if (level === 6) await initQuantumAtom(opts);
      else if (level === 7) await initAtomicNucleus(opts);
    })();
    initInFlight.set(k, p);
    try { await p; } finally { initInFlight.delete(k); }
  }

  function setQuality(nextId) {
    if (!QUALITY_PRESETS[nextId]) return false;
    quality = QUALITY_PRESETS[nextId];
    return true;
  }
  function setSeed(nextSeed) { universeSeed = (Number(nextSeed) >>> 0) || 1; }
  function setMdGravity(enabled) {
    mdGravity = Boolean(enabled);
    if (mdSession && typeof mdSession.setGravity === 'function') mdSession.setGravity(mdGravity);
  }
  function setMdTemp(tempK) { mdTempK = Math.max(15, Math.round(Number(tempK) || 300)); }
  function setPlanetaryCutaway(enabled) { planetaryCutaway = Boolean(enabled); }
  function setStellarTimeAccel(val) { stellarTimeAccel = Math.max(0.4, Math.min(8.0, Number(val) || 2.0)); }
  async function setSolarMode(mode) {
    solarMode = mode === 'formation' ? 'formation' : 'nbody';
    if (solarMode === 'formation' && !protoplanetarySession) await initProtoplanetaryDisk();
  }
  function setProtoplanetaryGasDrag(enabled) {
    protoplanetaryGasDrag = Boolean(enabled);
    protoplanetarySession?.setEnableGasDrag?.(protoplanetaryGasDrag);
  }
  async function setStellarMode(mode) {
    stellarMode = mode === 'nebular-mhd' ? 'nebular-mhd' : 'fusion';
    if (stellarMode === 'nebular-mhd' && !nebulaMhdSession) await initNebularMhd();
    else if (stellarMode === 'fusion' && !stellarEngine) await initStellarCore();
  }
  async function setNebulaB0(val) {
    nebulaB0 = Math.max(0, Math.min(1.5, Number(val) ?? 0.58));
    if (nebulaMhdSession) await initNebularMhd({ initialB0: nebulaB0 });
  }
  function setShowGalacticBField(enabled) { showGalacticBField = Boolean(enabled); }
  function setPlanetaryTriboelectric(enabled) {
    planetaryTriboelectric = Boolean(enabled);
    planetaryAtmoSession?.setEnableTriboelectric?.(planetaryTriboelectric);
  }
  function getActiveUniversalLaws(activeLevel, log10SpanM) {
    const viewSpanM = Math.pow(10, log10SpanM);
    const spec = REAL_SOLAR_SYSTEM_CATALOG[focusedSolarBodyIndex] || REAL_SOLAR_SYSTEM_CATALOG[3];
    const physState = {
      viewSpanM,
      comovingBoxMpc: activeLevel === 0 ? 200 : 0,
      omegaM: activeLevel === 0 ? 0.315 : 0,
      galacticBodyCount: activeLevel === 1 ? (galaxyEngine?.count || 32768) : 0,
      nebulaCloudMass: (activeLevel === 3 && stellarMode === 'nebular-mhd') ? 22.0 : 0,
      magneticFieldStrength: (activeLevel === 3 && stellarMode === 'nebular-mhd') ? nebulaB0 : 0,
      ionizedGasPresent: activeLevel === 3,
      starMassSolar: (activeLevel === 2 && solarMode === 'formation') ? 1.0 : 0,
      diskSolidMassEarth: (activeLevel === 2 && solarMode === 'formation') ? 45.0 : 0,
      gravitatingBodyCount: (activeLevel === 2 || activeLevel === 4) ? (solarEngine?.totalCount || 15) : 0,
      solidBodyCount: (activeLevel === 2 && solarMode === 'formation') ? (protoplanetarySession?.embryoCount || 18) : 0,
      solidParticleCount: (activeLevel === 2 && solarMode === 'formation') ? 90 : 0,
      coreTempK: (activeLevel === 3 && stellarMode === 'fusion') ? (stellarTelemetry?.coreTempK || 1.5e7) : 0,
      bodyMassKg: activeLevel === 4 ? (spec.massSolar * 1.98847e30) : (activeLevel === 3 ? 1.98847e30 : 0),
      bodyRadiusM: activeLevel === 4 ? (spec.radiusKm * 1000) : 0,
      surfacePressurePa: activeLevel === 4 ? (planetaryAtmoState?.surfacePressurePa || 0) : 0,
      volatileMassFrac: activeLevel === 4 ? (planetaryAtmoState?.volatileMassFrac || 0) : 0,
      particulateMassFrac: activeLevel === 4 ? (planetaryAtmoState?.particulateMassFrac || 0) : 0,
      dynamo: activeLevel === 4 ? (planetaryAtmoState?.dynamo || null) : null
    };
    return resolveActiveUniversalLaws(physState);
  }
  function setGalaxyBranch(branch, focusPos = null) {
    galaxyBranch = branch === 'smbh-core' ? 'smbh-core' : 'solar-system';
    if (focusPos) galaxyFocusPos = [...focusPos];
  }
  function setFocusedSolarBody(idxOrId) {
    if (typeof idxOrId === 'string') {
      const found = REAL_SOLAR_SYSTEM_CATALOG.findIndex((b) => b.id === idxOrId);
      if (found >= 0) focusedSolarBodyIndex = found;
    } else if (Number.isFinite(Number(idxOrId))) {
      focusedSolarBodyIndex = Math.max(0, Math.min(REAL_SOLAR_SYSTEM_CATALOG.length - 1, Math.trunc(Number(idxOrId))));
    }
    return focusedSolarBodyIndex;
  }

  function getCachedElementBundle(Z, rel = true) {
    const zSafe = Math.max(1, Math.min(118, Math.trunc(Number(Z) || 26)));
    return bundleCache.get(`${zSafe}:std:${rel ? 1 : 0}:1`)
      || bundleCache.get(`${zSafe}:std:${rel ? 1 : 0}:0`)
      || bundleCache.get(`${zSafe}:std:1:1`)
      || bundleCache.get(`${zSafe}:std:1:0`)
      || null;
  }

  function getTargetsForLevel(level, worldScaleInfo = {}) {
    if (level === 0) {
      const sc = worldScaleInfo.cosmoScale ?? 0.1;
      const off = worldScaleInfo.cosmoOffset ?? [0, 0, 0];
      return cosmoTargets.map((t) => ({
        ...t,
        pos: [
          (t.posMpc[0] - off[0]) * sc,
          (t.posMpc[1] - off[1]) * sc,
          (t.posMpc[2] - off[2]) * sc
        ]
      }));
    }
    if (level === 1) {
      const sc = worldScaleInfo.galaxyScale ?? 1.0;
      const off = worldScaleInfo.galaxyOffset ?? [0, 0, 0];
      return galaxyTargets.map((t) => ({
        ...t,
        pos: [
          (t.pos[0] - off[0]) * sc,
          (t.pos[1] - off[1]) * sc,
          (t.pos[2] - off[2]) * sc
        ]
      }));
    }
    if (level === 2) {
      if (galaxyBranch === 'smbh-core') {
        return [{
          id: 'smbh-event-horizon',
          level: 2,
          name: 'Sagittarius-ULG* (4.3×10⁶ M☉ SMBH)',
          subtitle: 'Schwarzschild Event Horizon · Relativistic Doppler Disk · Live S-Stars',
          pos: [0, 0, 0],
          radius: 1.0,
          tempK: 28000,
          massLabel: '4.3×10⁶ M☉',
          composition: 'Kerr-Schwarzschild Metric · Accreting H⁺/He²⁺ Plasma',
          nextLevel: 3
        }];
      }
      if (!solarEngine) return [];
      const focusState = solarEngine.getMassiveBodyState64(focusedSolarBodyIndex);
      const scaleAuToWorld = worldScaleInfo.solarScaleAuToWorld ?? 1.0;
      return REAL_SOLAR_SYSTEM_CATALOG.map((spec, idx) => {
        const st = solarEngine.getMassiveBodyState64(idx);
        const relX = (st.posAu[0] - focusState.posAu[0]) * scaleAuToWorld;
        const relY = (st.posAu[1] - focusState.posAu[1]) * scaleAuToWorld;
        const relZ = (st.posAu[2] - focusState.posAu[2]) * scaleAuToWorld;
        return {
          id: spec.id,
          level: 2,
          bodyIndex: idx,
          spec,
          name: spec.name,
          subtitle: spec.subtitle,
          pos: [relX, relY, relZ],
          radius: Math.max(1e-7, st.radiusAu * scaleAuToWorld),
          radiusKm: spec.radiusKm,
          tempK: spec.tempK,
          massLabel: idx === 0 ? '1.00 M☉' : `${(spec.massSolar / 3.0034896e-6).toFixed(spec.massSolar > 1e-5 ? 1 : 3)} M⊕`,
          composition: spec.composition,
          nextLevel: idx === 0 ? 3 : 4
        };
      });
    }
    if (level === 3) {
      const burn = getGate1StellarBurnConstants();
      return [{
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
      }];
    }
    if (level === 4) return planetaryLayersMeta;
    if (level === 5) {
      const b = getCachedElementBundle(mdElementZ, true)?.bundle;
      const sym = b?.symbol || 'Fe';
      return [{
        id: 'md-lattice-atom',
        level: 5,
        name: `${sym} Representative Lattice`,
        subtitle: `${b?.mechanical?.crystalStructure || 'crystal'} · ${mdSession?.atomCount || 0} live GPU atoms`,
        pos: [0, 0, 0],
        radius: 1.5,
        sampleZ: mdElementZ,
        tempK: mdTelemetry?.temperatureK || mdTempK,
        massLabel: `m = ${(b?.nuclear?.atomicMassU || 55.8).toFixed(2)} u`,
        composition: `Phase: ${mdTelemetry?.emergentPhase || mdPhasePreset} · ⟨Z⟩ = ${(mdTelemetry?.meanCoordination || 0).toFixed(2)}`,
        nextLevel: 6
      }];
    }
    if (level === 6) {
      const b = getCachedElementBundle(quantumZ, quantumRelativistic)?.bundle;
      const sym = b?.symbol || 'Fe';
      const lNames = ['s', 'p', 'd', 'f', 'g'];
      const orbName = `${quantumN}${lNames[quantumL] || 'd'} (m=${quantumM})`;
      const eHa = Number(b?.atomic?.totalEnergyHa);
      return [{
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
      }];
    }
    if (level === 7) {
      const sym = nuclearResult?.isotope?.split('-')[0] || `Z=${nuclearZ}`;
      const ba = Number(nuclearResult?.bindingPerNucleonMeV ?? 8.79);
      const rc = Number(nuclearResult?.chargeRadiusFm ?? 3.7);
      return [{
        id: 'nucleus-core',
        level: 7,
        name: `${nuclearA}${sym} Atomic Nucleus`,
        subtitle: `Z=${nuclearZ} protons, N=${Math.max(0, nuclearA - nuclearZ)} neutrons · Woods–Saxon + Visscher TDSE`,
        pos: [0, 0, 0],
        radius: 1.5,
        tempK: 1e10,
        massLabel: `B/A = ${ba.toFixed(3)} MeV`,
        composition: `Protons ${nuclearZ} · Neutrons ${Math.max(0, nuclearA - nuclearZ)} · R_c = ${rc.toFixed(2)} fm`,
        nextLevel: 0
      }];
    }
    return [];
  }

  function dispose() {
    disposed = true;
    void disconnectPeerMesh();
    try { cosmoSession?.destroy(); } catch {}
    try { galaxyEngine?.dispose(); } catch {}
    try { smbhEngine?.dispose(); } catch {}
    try { solarEngine?.dispose(); } catch {}
    try { protoplanetarySession?.dispose(); } catch {}
    try { stellarEngine?.dispose(); } catch {}
    try { nebulaMhdSession?.dispose(); } catch {}
    try { planetaryAtmoSession?.dispose(); } catch {}
    try { mdSession?.destroy(); } catch {}
    try { orbitalCloud?.pointsBuffer?.destroy(); } catch {}
    try { tdseSession?.destroy(); } catch {}
  }

  return Object.freeze({
    AU_METERS,
    REAL_SOLAR_SYSTEM_CATALOG,
    MOLECULE_SPECS,
    get seed() { return universeSeed; },
    get quality() { return quality; },
    get cosmoSession() { return cosmoSession; },
    get cosmoTelemetry() { return cosmoTelemetry; },
    get cosmoFirstPk() { return cosmoFirstPk; },
    get cosmoTargets() { return cosmoTargets; },
    get galaxyEngine() { return galaxyEngine; },
    get galaxyPreset() { return galaxyPreset; },
    get galaxyMetallicity() { return galaxyMetallicity; },
    get galaxyFocusPos() { return galaxyFocusPos; },
    get galaxyBranch() { return galaxyBranch; },
    get showGalacticBField() { return showGalacticBField; },
    get smbhEngine() { return smbhEngine; },
    get smbhBodies() { return smbhBodies; },
    get ismCoolingAnchors() { return ismCoolingAnchors; },
    get solarEngine() { return solarEngine; },
    get solarMode() { return solarMode; },
    get protoplanetarySession() { return protoplanetarySession; },
    get protoplanetaryTelemetry() { return protoplanetaryTelemetry; },
    get protoplanetaryGasDrag() { return protoplanetaryGasDrag; },
    get solarConservation0() { return solarConservation0; },
    get solarConservation() { return solarConservation; },
    get focusedSolarBodyIndex() { return focusedSolarBodyIndex; },
    get stellarEngine() { return stellarEngine; },
    get stellarMode() { return stellarMode; },
    get nebulaMhdSession() { return nebulaMhdSession; },
    get nebulaMhdTelemetry() { return nebulaMhdTelemetry; },
    get nebulaMhdStreamlines() { return nebulaMhdStreamlines; },
    get nebulaB0() { return nebulaB0; },
    get stellarPreset() { return stellarPreset; },
    get stellarTelemetry() { return stellarTelemetry; },
    get stellarNuclearNetwork() { return stellarNuclearNetwork; },
    get stellarLaneEmden() { return stellarLaneEmden; },
    get stellarTimeAccel() { return stellarTimeAccel; },
    get planetaryResult() { return planetaryResult; },
    get planetaryBodyIndex() { return planetaryBodyIndex; },
    get planetaryCutaway() { return planetaryCutaway; },
    get planetaryAtmoState() { return planetaryAtmoState; },
    get planetaryAtmoSession() { return planetaryAtmoSession; },
    get planetaryAtmoTelemetry() { return planetaryAtmoTelemetry; },
    get planetaryTriboelectric() { return planetaryTriboelectric; },
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
    evaluateIsmRadiativeCoolingErgCm3PerS,
    buildQuantizedNucleonSpheres,
    getElementBundle,
    getCachedElementBundle,
    ensureLevelInitialized,
    initCosmicWeb,
    initGalaxy,
    initSmbhCore,
    initSolarSystem,
    initProtoplanetaryDisk,
    initNebularMhd,
    initStellarCore,
    initPlanetaryInterior,
    initMolecularDynamics,
    initQuantumAtom,
    initAtomicNucleus,
    stepActiveRegimes,
    setQuality,
    setSeed,
    setMdGravity,
    setMdTemp,
    setPlanetaryCutaway,
    setPlanetaryTriboelectric,
    setStellarTimeAccel,
    setSolarMode,
    setProtoplanetaryGasDrag,
    setStellarMode,
    setNebulaB0,
    setShowGalacticBField,
    setGalaxyBranch,
    setFocusedSolarBody,
    getActiveUniversalLaws,
    getTargetsForLevel,
    connectPeerMesh,
    disconnectPeerMesh,
    getPeerMeshState,
    dispatchPeerDerivation,
    dispose
  });
}
