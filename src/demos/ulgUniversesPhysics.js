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
  COSMIC_EPOCH_PRESETS,
  evaluateCosmicEpochState,
  evaluateStellarEvolutionaryState
} from '../runtime/astrophysics/cosmicEpochState.js';
import {
  createCosmologicalBaryonRadiationSessionWebGpu
} from '../runtime/astrophysics/cosmologicalBaryonRadiationGpu.js';
import {
  createKerrAccretionJetSessionWebGpu,
  solveRelativisticTovBatchWebGpu
} from '../runtime/astrophysics/relativisticCompactObjectGpu.js';
import {
  createCompactMagnetosphereSessionWebGpu
} from '../runtime/astrophysics/compactMagnetosphereGpu.js';
import {
  createRelativisticBinaryMergerSessionWebGpu
} from '../runtime/astrophysics/relativisticBinaryMergerGpu.js';
import {
  createRadiativePhotoionizationWindSessionWebGpu
} from '../runtime/astrophysics/radiativePhotoionizationWindGpu.js';
import {
  createTidalRocheDisruptionSessionWebGpu
} from '../runtime/astrophysics/tidalRocheDisruptionGpu.js';
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
  createPlanetarySurfaceSessionWebGpu
} from '../runtime/astrophysics/planetarySurfaceVehiclesGpu.js';
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

const GALAXY_MORPHOLOGIES = ['disk', 'barred', 'binary', 'sphere', 'proto', 'dwarf-stream', 'globular'];
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
  } else if (preset === 'barred') {
    // Grand-Design Barred Spiral (SBb/SBc): secular m=2 central stellar bar + 2 logarithmic spiral arms from bar tips!
    populateSingleGalaxy(0, n, 0, 0, 0, 0, 0, 0, 0, 0, 1.0);
    const barEnd = Math.floor(n * 0.42);
    for (let i = Math.floor(n * 0.22); i < barEnd; i += 1) {
      const o = i * 8;
      if (bodies[o + 7] < 0) continue; // preserve DM halo
      const xBar = (rand() * 2 - 1) * 3.6;
      const yBar = gauss() * 0.24;
      const zBar = gauss() * (0.48 * Math.sqrt(Math.max(0.15, 1.0 - (xBar / 3.9) ** 2)));
      const rB = Math.hypot(xBar, zBar);
      const omegaBar = 2.65; // pattern speed + streaming along bar
      bodies.set([
        xBar + ox, yBar + oy, zBar + oz, bodies[o + 3] * 1.15,
        -zBar * omegaBar + gauss() * 0.45, gauss() * 0.25, xBar * omegaBar + gauss() * 0.45,
        0.06 + Math.min(0.24, (rB / 3.8) * 0.22)
      ], o);
    }
    // Outer grand-design arms anchored at bar ends (±3.4, 0, 0)
    const pitchTan = Math.tan((19 * Math.PI) / 180);
    for (let i = barEnd; i < n; i += 1) {
      const o = i * 8;
      if (bodies[o + 7] < 0) continue;
      if (rand() < 0.78) {
        const armIdx = i & 1;
        const r = 3.1 + Math.pow(rand(), 0.85) * 7.8;
        const th = armIdx * Math.PI + Math.log(r / 3.0) / pitchTan + gauss() * (0.20 + 0.02 * r);
        const ly = gauss() * (0.12 + 0.025 * r);
        const vCirc = Math.sqrt((gravity * (170 + 260 * (1 - (1 + r / 3.1) * Math.exp(-r / 3.1)) + 950 * r * r / ((r + 6.8) ** 2))) / Math.hypot(r, softening));
        const isH2 = rand() < 0.14;
        bodies.set([
          Math.cos(th) * r + ox, ly + oy, Math.sin(th) * r + oz, bodies[o + 3],
          -Math.sin(th) * vCirc + gauss() * 0.45, gauss() * 0.2, Math.cos(th) * vCirc + gauss() * 0.45,
          isH2 ? (0.85 + rand() * 0.20) : (0.44 + rand() * 0.34)
        ], o);
      }
    }
  } else if (preset === 'proto') {
    // High-z Cosmic Noon Clumpy Starburst Protogalaxy (f_gas ~ 0.65, turbulent thick disk + giant H II clumps!)
    populateSingleGalaxy(0, n, 0, 0, 0, 0, 0, 0, 0.22, -0.14, 0.78);
    const clumpCenters = Array.from({ length: 7 }, (_, c) => {
      const a = (c / 7) * Math.PI * 2 + 0.4;
      const rc = 1.6 + (c % 3) * 1.45;
      return [Math.cos(a) * rc, (rand() - 0.5) * 0.55, Math.sin(a) * rc];
    });
    const clumpStart = Math.floor(n * 0.45);
    for (let i = clumpStart; i < n; i += 1) {
      const o = i * 8;
      if (bodies[o + 7] < 0) continue;
      if (rand() < 0.52) {
        const c = clumpCenters[i % clumpCenters.length];
        const rLoc = Math.pow(rand(), 0.6) * 1.35;
        const th = rand() * Math.PI * 2;
        const cy = 2 * rand() - 1;
        const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
        const px = c[0] + rLoc * sy * Math.cos(th) * 1.25;
        const py = c[1] + rLoc * cy * 0.45;
        const pz = c[2] + rLoc * sy * Math.sin(th) * 0.85;
        const rC = Math.max(0.5, Math.hypot(px, pz));
        const vCirc = Math.sqrt((gravity * 680.0) / Math.hypot(rC, 0.8));
        bodies.set([
          px + ox, py + oy, pz + oz, bodies[o + 3] * 1.2,
          (-pz / rC) * vCirc + gauss() * 1.25, gauss() * 0.95, (px / rC) * vCirc + gauss() * 1.25,
          0.78 + rand() * 0.28 // bright blue OB & rose-magenta starburst H II clumps!
        ], o);
      } else {
        // Thicken & heat rest of turbulent high-z disk
        bodies[o + 1] = bodies[o + 1] * 2.4;
        bodies[o + 7] = Math.min(1.02, bodies[o + 7] + 0.24);
      }
    }
  } else if (preset === 'dwarf-stream') {
    // Host Spiral Galaxy + Tidally Disrupted Dwarf Galaxy & Wrapping Halo Stellar Stream!
    const hostN = Math.floor(n * 0.72);
    populateSingleGalaxy(0, hostN, 0, 0, 0, 0, 0, 0, 0.14, 0.08, 0.82);
    // Dwarf core at (7.4, 2.2, -2.0) + polar tidal stream wrapping over the halo!
    const dwarfCoreN = Math.floor((n - hostN) * 0.30);
    for (let i = hostN; i < n; i += 1) {
      const o = i * 8;
      const k = i - hostN;
      if (k < dwarfCoreN) {
        const rr = Math.cbrt(rand()) * 1.15;
        const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
        const th = rand() * Math.PI * 2;
        bodies.set([
          7.4 + rr * sy * Math.cos(th) + ox,
          2.2 + rr * cy + oy,
          -2.0 + rr * sy * Math.sin(th) + oz,
          45.0 / Math.max(1, dwarfCoreN),
          -1.4 + gauss() * 0.55, 2.4 + gauss() * 0.55, 4.1 + gauss() * 0.55,
          0.52 + rand() * 0.34
        ], o);
      } else {
        // Tidal stream ribbon arching across the polar halo
        const sFrac = (k - dwarfCoreN) / Math.max(1, n - hostN - dwarfCoreN);
        const ang = -0.35 + sFrac * Math.PI * 1.85;
        const rStream = 7.4 + Math.sin(ang * 1.5) * 1.65;
        const spread = 0.25 + 0.42 * sFrac;
        const px = Math.cos(ang) * rStream + gauss() * spread;
        const py = Math.sin(ang) * rStream * 0.72 + gauss() * spread;
        const pz = Math.sin(ang + 0.8) * rStream * 0.58 + gauss() * spread;
        const rMag = Math.max(1.0, Math.hypot(px, py, pz));
        const vS = Math.sqrt((gravity * 1150.0) / rMag);
        bodies.set([
          px + ox, py + oy, pz + oz, 12.0 / Math.max(1, n - hostN - dwarfCoreN),
          (-Math.sin(ang)) * vS * 0.75, Math.cos(ang) * vS * 0.55, Math.cos(ang + 0.8) * vS * 0.42,
          0.34 + rand() * 0.42
        ], o);
      }
    }
  } else if (preset === 'globular') {
    // Dense King-Profile Core-Collapsed Globular Star Cluster (10^5-10^6 ancient golden + blue-straggler stars!)
    const mTot = 520.0;
    const mEach = mTot / n;
    const rCore = 0.65;
    bodies.set([ox, oy, oz, 8.0, 0, 0, 0, 0.12], 0);
    for (let i = 1; i < n; i += 1) {
      // Plummer/King dense core profile with sharp tidal truncation at r_t = 6.8
      const u = Math.max(0.001, Math.min(0.96, rand()));
      const r = Math.min(6.8, rCore / Math.sqrt(Math.pow(u, -2 / 3) - 1));
      const cy = 2 * rand() - 1;
      const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
      const th = rand() * Math.PI * 2;
      const mEnc = 8.0 + mTot * Math.pow(r, 3) / Math.pow(r * r + rCore * rCore, 1.5);
      const sig = Math.sqrt((gravity * mEnc) / (3.0 * Math.hypot(r, 0.45)));
      const isBlueStraggler = r < 1.3 && rand() < 0.08;
      bodies.set([
        r * sy * Math.cos(th) + ox, r * cy + oy, r * sy * Math.sin(th) + oz, mEach,
        gauss() * sig, gauss() * sig, gauss() * sig,
        isBlueStraggler ? (0.68 + rand() * 0.16) : (0.04 + Math.min(0.24, (r / 6.0) * 0.22))
      ], i * 8);
    }
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

  // Cosmic Epoch Spine (`z = 1100 -> 0 -> +5 Gyr`): second orthogonal physical axis!
  let cosmicEpochId = 'present-day';
  let cosmicEpoch = evaluateCosmicEpochState({ redshiftZ: 0.0, localSystemAgeGyr: 4.57, localStarMassSolar: 1.0 });

  // Level 0: IllustrisTNG / Millennium-Style 2LPT Supergalactic Cosmic Web + Baryon/CMB/Reionization/Cluster-Lensing
  let cosmoMode = 'web'; // 'web' | 'cmb' | 'reionization' | 'cluster-merger'
  let cosmoSession = null;
  let cosmoTelemetry = null;
  let cosmoFirstPk = null;
  let cosmoTargets = [];
  let cosmoBaryonSession = null;
  let cosmoBaryonTelemetry = null;

  // Level 1: Flat-Rotation Spiral Galaxy + Dark Matter Halo + Galactic Dynamo (7 emergent morphologies)
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

  // Level 2: Real-Scale Double-Float Symplectic GPU Solar System N-Body + Formation + Small-Body/Tidal + Relativistic Systems
  let solarEngine = null;
  let solarConservation0 = null;
  let solarConservation = null;
  let focusedSolarBodyIndex = 3; // Default focus: Earth
  let solarMode = 'nbody'; // 'nbody' | 'formation' | 'roche-rings' | 'giant-impact' | 'red-giant' | 'comet-tails' | 'hot-jupiter' | 'quasar-jet' | 'xray-binary' | 'bns-kilonova' | 'type-ia' | 'bbh-merger'
  let protoplanetarySession = null;
  let protoplanetaryTelemetry = null;
  let protoplanetaryGasDrag = true;
  let kerrJetSession = null;
  let kerrJetTelemetry = null;
  let kerrSpinA = 0.94;
  let relBinarySession = null;
  let relBinaryTelemetry = null;
  let relBinaryMode = null;
  let radWindL2Session = null;
  let radWindL2Telemetry = null;
  let radWindL2Mode = null;
  let tidalRocheSession = null;
  let tidalRocheTelemetry = null;
  let tidalRocheMode = null;

  // Level 3: Stellar Core Fusion + 3D Resistive MHD + Photoionized Nebulae + Pulsars / Magnetars + GR TOV!
  let stellarEngine = null;
  let stellarPreset = 'solar-nebula';
  let stellarTelemetry = null;
  let stellarNuclearNetwork = null;
  let stellarLaneEmden = null;
  let stellarClosureRef = null;
  let stellarTimeAccel = 2.0;
  let stellarMode = 'fusion'; // 'fusion' | 'nebular-mhd' | 'h2-pillars' | 'planetary-nebula' | 'snr-pwn' | 'pulsar' | 'magnetar' | 'white-dwarf-tov'
  let nebulaMhdSession = null;
  let nebulaMhdTelemetry = null;
  let nebulaMhdStreamlines = new Float32Array(0);
  let nebulaB0 = 0.58;
  let radWindL3Session = null;
  let radWindL3Telemetry = null;
  let radWindL3Mode = null;
  let magnetosphereSession = null;
  let magnetosphereTelemetry = null;
  let magnetosphereMode = null;
  let magnetosphereFieldLines = new Float32Array(0);
  let tovCurve = null;

  // Level 4: Planetary Interior + Dynamic Spherical Baroclinic Atmosphere & EM + Magma Ocean / Cryovolcanism / Eyeball / Rogue!
  let planetaryMode = 'standard'; // 'standard' | 'magma-ocean' | 'cryo-plumes' | 'eyeball-locked' | 'rogue'
  let planetaryResult = null;
  let planetaryBodyIndex = 3;
  let planetaryCutaway = false;
  let planetaryLayersMeta = [];
  let planetaryAtmoState = null;
  let planetaryAtmoSession = null;
  let planetaryAtmoTelemetry = null;
  let planetaryTriboelectric = true;
  let cryoPlumeSession = null;
  let cryoPlumeTelemetry = null;

  // Planetary Surface View (TinyPlanetControls + 6-Wheel Jump-Rocket Mars Rover + Atmospheric Drone!)
  let surfaceActive = false;
  let surfaceSession = null;
  let surfaceTelemetry = null;
  let surfaceControls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    down: false,
    turbo: false,
    yawLeft: false,
    yawRight: false,
    moveX: 0,
    moveY: 0
  };

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
    const prevMhd = nebulaMhdSession;
    nebulaMhdSession = null;
    if (prevMhd) prevMhd.dispose();
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

  // ---- L0 Wave-2 Regimes: CMB Recombination (z=1100), Reionization Bubbles (z=10), Bullet-Cluster ICM & Lensing ----
  async function initCosmoBaryonRegime(mode = cosmoMode) {
    const prev = cosmoBaryonSession;
    cosmoBaryonSession = null;
    if (prev) prev.dispose();
    const isCmb = mode === 'cmb';
    const isReion = mode === 'reionization';
    const isCluster = mode === 'cluster-merger';
    const zVal = isCmb ? 1100.0 : (isReion ? 10.0 : 0.25);
    const nTr = quality.id === 'low' ? 4096 : (quality.id === 'ultra' ? 10240 : 6656);
    const next = createCosmologicalBaryonRadiationSessionWebGpu(device, {
      gridN: quality.id === 'low' ? 16 : 24,
      tracerCount: nTr,
      boxSizeMpc: 260.0,
      redshiftZ: zVal,
      clusterMergerMode: isCluster,
      uvFlux: isReion ? 1.55 : (isCmb ? 0.0 : 0.25),
      gravityG: isCluster ? 1.65 : 1.15,
      seed: (universeSeed ^ (isCmb ? 0x1100 : isReion ? 0x1010 : 0xc105)) >>> 0,
      label: `ulg-universes-cosmo-${mode}`
    });
    const warmSteps = isReion ? 5 : (isCluster ? 4 : 2);
    for (let w = 0; w < warmSteps; w += 1) {
      cosmoBaryonTelemetry = await next.step({ dt: isReion ? 0.14 : 0.09, substeps: 2, readTelemetry: w === warmSteps - 1 });
    }
    cosmoBaryonSession = next;
  }

  // ---- L2 Wave-2 Regimes: Kerr Quasar/Blazar BZ Jet ----
  async function initKerrQuasarJet({ spinA = kerrSpinA } = {}) {
    kerrSpinA = Math.max(-0.99, Math.min(0.99, Number(spinA) ?? 0.94));
    const prev = kerrJetSession;
    kerrJetSession = null;
    if (prev) prev.dispose();
    const nP = quality.id === 'low' ? 4096 : 6656;
    const next = createKerrAccretionJetSessionWebGpu(device, {
      massSolar: 4.5e8,
      spinA: kerrSpinA,
      accretionRateEddington: 0.58,
      magneticFluxNorm: 1.15,
      particleCount: nP,
      seed: (universeSeed ^ 0x90a5a7) >>> 0,
      label: 'ulg-universes-kerr-quasar'
    });
    for (let w = 0; w < 5; w += 1) {
      kerrJetTelemetry = await next.step({ dt: 0.032, substeps: 2, readTelemetry: w === 4 });
    }
    kerrJetSession = next;
  }

  // ---- L2 Wave-2 Regimes: Relativistic Binary Mergers (X-Ray Binary, BNS Kilonova, Type Ia, BBH GW Chirp) ----
  async function initRelativisticBinary(mode = 'bns-kilonova') {
    const prev = relBinarySession;
    relBinarySession = null;
    if (prev) prev.dispose();
    relBinaryMode = mode;
    const nP = quality.id === 'low' ? 3072 : 5120;
    const cfg = mode === 'xray-binary'
      ? { m1Solar: 11.0, m2Solar: 1.8, r1Sim: 0.44, r2Sim: 0.88, separation0: 4.5, eccentricity0: 0.02, cSpeedSim: 24.0, rocheOverflow: true, neutronRich: false, wdCarbonOxygen: false, warm: 8 }
      : mode === 'type-ia'
        ? { m1Solar: 1.38, m2Solar: 0.96, r1Sim: 0.36, r2Sim: 0.42, separation0: 2.25, eccentricity0: 0.05, cSpeedSim: 4.6, rocheOverflow: false, neutronRich: false, wdCarbonOxygen: true, warm: 20 }
        : mode === 'bbh-merger'
          ? { m1Solar: 36.0, m2Solar: 29.0, r1Sim: 0.56, r2Sim: 0.48, separation0: 3.25, eccentricity0: 0.06, cSpeedSim: 5.0, rocheOverflow: false, neutronRich: false, wdCarbonOxygen: false, warm: 8 }
          : { m1Solar: 1.45, m2Solar: 1.32, r1Sim: 0.36, r2Sim: 0.34, separation0: 2.35, eccentricity0: 0.05, cSpeedSim: 4.7, rocheOverflow: false, neutronRich: true, wdCarbonOxygen: false, warm: 22 };
    const next = createRelativisticBinaryMergerSessionWebGpu(device, {
      ...cfg,
      particleCount: nP,
      seed: (universeSeed ^ (mode.length * 9187)) >>> 0,
      label: `ulg-universes-relbin-${mode}`
    });
    for (let w = 0; w < cfg.warm; w += 1) {
      relBinaryTelemetry = await next.step({ dt: 0.032, substeps: 4, readTelemetry: w === cfg.warm - 1 });
    }
    relBinarySession = next;
  }

  // ---- L2 Wave-2 Radiative Outflow Regimes: Active Dual-Tail Comet & Hot-Jupiter XUV Photoevaporation ----
  async function initRadiativeWindL2(mode = 'comet-tails') {
    const prev = radWindL2Session;
    radWindL2Session = null;
    if (prev) prev.dispose();
    radWindL2Mode = mode;
    const isComet = mode === 'comet-tails';
    const next = createRadiativePhotoionizationWindSessionWebGpu(device, {
      regime: isComet ? 'comet-dual-tail' : 'hot-jupiter-xuv',
      uvFlux: isComet ? 1.45 : 2.35,
      radBeta: isComet ? 0.95 : 0.72,
      windSpeed: isComet ? 2.25 : 1.95,
      sublimationDrive: isComet ? 1.35 : 1.45,
      sourceDir: isComet ? [0.76, 0.24, 0.60] : [0.82, 0.14, 0.55],
      particleCount: quality.id === 'low' ? 3072 : 5120,
      seed: (universeSeed ^ (isComet ? 0xc03e7 : 0x40710)) >>> 0,
      label: `ulg-universes-radl2-${mode}`
    });
    for (let w = 0; w < 8; w += 1) {
      radWindL2Telemetry = await next.step({ dt: 0.04, substeps: 3, readTelemetry: w === 7 });
    }
    radWindL2Session = next;
  }

  // ---- L2 Wave-2 Tidal Regimes: Roche-Limit Ring Disruption & Shepherd Moon, Giant Impact, Red-Giant Engulfment ----
  async function initTidalRocheL2(mode = 'roche-rings') {
    const prev = tidalRocheSession;
    tidalRocheSession = null;
    if (prev) prev.dispose();
    tidalRocheMode = mode;
    const apiMode = mode === 'red-giant' ? 'red-giant-engulf' : mode;
    const next = createTidalRocheDisruptionSessionWebGpu(device, {
      mode: apiMode,
      orbitRadiusSim: mode === 'roche-rings' ? 2.35 : 2.8,
      rHostSim: mode === 'red-giant' ? 1.85 : (mode === 'giant-impact' ? 1.48 : 1.38),
      rRocheSim: 3.65,
      gmHost: 24.0,
      cohesionStrength: 0.55,
      tidalHeatDrive: 1.25,
      shepherdGm: 0.72,
      particleCount: quality.id === 'low' ? 3072 : 5120,
      seed: (universeSeed ^ (mode.length * 4099)) >>> 0,
      label: `ulg-universes-tidal-${mode}`
    });
    const warm = mode === 'roche-rings' ? 12 : 6;
    for (let w = 0; w < warm; w += 1) {
      tidalRocheTelemetry = await next.step({ dt: 0.028, substeps: 3, readTelemetry: w === warm - 1 });
    }
    tidalRocheSession = next;
  }

  // ---- L3 Wave-2 Photoionized Nebulae: H II Pillars, Planetary Nebula, SNR / Crab PWN ----
  async function initRadiativeWindL3(mode = 'h2-pillars') {
    const prev = radWindL3Session;
    radWindL3Session = null;
    if (prev) prev.dispose();
    radWindL3Mode = mode;
    const next = createRadiativePhotoionizationWindSessionWebGpu(device, {
      regime: mode,
      uvFlux: mode === 'snr-pwn' ? 1.85 : (mode === 'planetary-nebula' ? 1.65 : 1.48),
      radBeta: mode === 'snr-pwn' ? 1.0 : 0.88,
      windSpeed: mode === 'snr-pwn' ? 2.15 : (mode === 'planetary-nebula' ? 1.68 : 1.15),
      bipolarAsymmetry: 1.45,
      sourceDir: [0.65, 0.58, 0.48],
      particleCount: quality.id === 'low' ? 3584 : 5632,
      seed: (universeSeed ^ (mode.length * 6151)) >>> 0,
      label: `ulg-universes-radl3-${mode}`
    });
    for (let w = 0; w < 6; w += 1) {
      radWindL3Telemetry = await next.step({ dt: 0.036, substeps: 2, readTelemetry: w === 5 });
    }
    radWindL3Session = next;
  }

  // ---- L3 Wave-2 Compact Magnetosphere: Millisecond Pulsar & Magnetar Giant Flare ----
  async function initCompactMagnetosphere(mode = 'magnetar') {
    const prev = magnetosphereSession;
    magnetosphereSession = null;
    if (prev) prev.dispose();
    magnetosphereMode = mode;
    const isMag = mode === 'magnetar';
    const next = createCompactMagnetosphereSessionWebGpu(device, {
      massSolar: isMag ? 1.55 : 1.42,
      radiusM: 12000,
      surfaceBFieldTesla: isMag ? 1.65e11 : 4.2e8,
      spinPeriodS: isMag ? 0.14 : 0.0085,
      obliquityRad: isMag ? 0.56 : 0.74,
      particleCount: quality.id === 'low' ? 3584 : 5632,
      seed: (universeSeed ^ (isMag ? 0x3a6e7 : 0x9015a)) >>> 0,
      label: `ulg-universes-mag-${mode}`
    });
    const warm = isMag ? 8 : 4;
    for (let w = 0; w < warm; w += 1) {
      magnetosphereTelemetry = await next.step({ dt: 0.055, substeps: 3, readTelemetry: w === warm - 1 });
    }
    magnetosphereFieldLines = next.buildDipoleFieldLines({ linesPerRing: 12, steps: 22, worldScale: 1.0, alpha: 0.48 });
    magnetosphereSession = next;
  }

  // ---- L3 Wave-2 GR TOV Unified Degenerate EOS (White Dwarf -> Neutron Star -> Black Hole) ----
  async function initWhiteDwarfTovCurve() {
    const samples = [];
    // 16 log-spaced central densities spanning WD (1e8..1e12), unstable gap (1e13..1e15), NS (2e17..5e18), BH (>8e18)
    const logRhos = [8.2, 8.8, 9.4, 10.0, 10.6, 11.3, 12.2, 13.5, 15.0, 17.2, 17.6, 17.9, 18.2, 18.5, 18.8, 19.2];
    for (const lr of logRhos) {
      samples.push({ centralRhoKgM3: Math.pow(10, lr), ye: 0.5 });
    }
    tovCurve = await solveRelativisticTovBatchWebGpu(device, samples);
  }

  // ---- L4 Wave-2 Cryovolcanic Plumes Session (Enceladus / Europa South-Polar Ice Geysers) ----
  async function initCryoPlumesL4() {
    const prev = cryoPlumeSession;
    cryoPlumeSession = null;
    if (prev) prev.dispose();
    const next = createTidalRocheDisruptionSessionWebGpu(device, {
      mode: 'cryo-plumes',
      rHostSim: 2.35,
      gmHost: 14.0,
      tidalHeatDrive: 1.45,
      particleCount: quality.id === 'low' ? 2560 : 4096,
      seed: (universeSeed ^ 0xc7701ce) >>> 0,
      label: 'ulg-universes-cryo-plumes'
    });
    for (let w = 0; w < 8; w += 1) {
      cryoPlumeTelemetry = await next.step({ dt: 0.032, substeps: 3, readTelemetry: w === 7 });
    }
    cryoPlumeSession = next;
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
      if (activeLevel === 0) {
        if (cosmoMode !== 'web' && cosmoBaryonSession) {
          cosmoBaryonTelemetry = await cosmoBaryonSession.step({
            dt: (cosmoMode === 'reionization' ? 0.12 : 0.08) * Math.max(0.2, Math.min(2.5, timeScale)),
            substeps: 1,
            readTelemetry: true
          });
        } else if (cosmoSession) {
          // Gently decelerate cosmic evolution once a(t) reaches present epoch (~1.0) so web stays crisp!
          const aCur = cosmoSession.getState().aScale;
          if (aCur < 1.15) {
            cosmoTelemetry = await cosmoSession.step({ readTelemetry: true });
          }
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
        } else if (solarMode === 'quasar-jet' && kerrJetSession) {
          kerrJetTelemetry = await kerrJetSession.step({
            dt: 0.028 * Math.max(0.2, Math.min(2.5, timeScale)),
            substeps: 2,
            readTelemetry: true
          });
        } else if ((solarMode === 'xray-binary' || solarMode === 'bns-kilonova' || solarMode === 'type-ia' || solarMode === 'bbh-merger') && relBinarySession) {
          relBinaryTelemetry = await relBinarySession.step({
            dt: 0.028 * Math.max(0.2, Math.min(2.5, timeScale)),
            substeps: 3,
            readTelemetry: true
          });
        } else if ((solarMode === 'comet-tails' || solarMode === 'hot-jupiter') && radWindL2Session) {
          radWindL2Telemetry = await radWindL2Session.step({
            dt: 0.036 * Math.max(0.2, Math.min(2.5, timeScale)),
            substeps: 2,
            readTelemetry: true
          });
        } else if ((solarMode === 'roche-rings' || solarMode === 'giant-impact' || solarMode === 'red-giant') && tidalRocheSession) {
          tidalRocheTelemetry = await tidalRocheSession.step({
            dt: 0.024 * Math.max(0.2, Math.min(2.5, timeScale)),
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
        } else if ((stellarMode === 'h2-pillars' || stellarMode === 'planetary-nebula' || stellarMode === 'snr-pwn') && radWindL3Session) {
          radWindL3Telemetry = await radWindL3Session.step({
            dt: 0.032 * Math.max(0.2, Math.min(2.5, timeScale)),
            substeps: 2,
            readTelemetry: true
          });
        } else if ((stellarMode === 'pulsar' || stellarMode === 'magnetar') && magnetosphereSession) {
          magnetosphereTelemetry = await magnetosphereSession.step({
            dt: 0.036 * Math.max(0.2, Math.min(2.5, timeScale)),
            substeps: 2,
            readTelemetry: true
          });
          magnetosphereFieldLines = magnetosphereSession.buildDipoleFieldLines({ linesPerRing: 12, steps: 20, worldScale: 1.0, alpha: 0.48 });
        } else if (stellarMode === 'white-dwarf-tov') {
          // Static GR TOV equilibrium curve already solved on WebGPU
        } else if (stellarEngine) {
          stellarTelemetry = await stellarEngine.step({
            dt: 0.015 * Math.max(0.2, Math.min(2.5, timeScale)),
            timeAccel: stellarTimeAccel,
            readTelemetry: true
          });
        }
      } else if (activeLevel === 4) {
        if (surfaceActive && surfaceSession) {
          surfaceTelemetry = await surfaceSession.step({
            dt: 0.020 * Math.max(0.25, Math.min(2.5, timeScale)),
            controls: surfaceControls,
            readTelemetry: (surfaceSession.stepIndex % 4) === 0
          });
        } else {
          let sunDir = planetaryMode === 'eyeball-locked' ? [1.0, 0.0, 0.0] : [0.65, 0.25, 0.70];
          if (planetaryMode === 'cryo-plumes' && cryoPlumeSession) {
            cryoPlumeTelemetry = await cryoPlumeSession.step({
              dt: 0.028 * Math.max(0.2, Math.min(2.5, timeScale)),
              substeps: 2,
              readTelemetry: true
            });
          }
          if (solarEngine && planetaryMode !== 'eyeball-locked' && planetaryMode !== 'rogue') {
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
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (!disposed && err?.name !== 'AbortError' && !msg.includes('Buffer was destroyed before mapping')) {
        throw err;
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
  async function setCosmicEpoch(presetIdOrObj, { alignActiveLevel = null } = {}) {
    if (typeof presetIdOrObj === 'string') {
      const found = COSMIC_EPOCH_PRESETS.find((p) => p.id === presetIdOrObj) || COSMIC_EPOCH_PRESETS[3];
      cosmicEpochId = found.id;
      cosmicEpoch = evaluateCosmicEpochState({
        redshiftZ: found.redshiftZ,
        localSystemAgeGyr: found.localSystemAgeGyr,
        localStarMassSolar: 1.0
      });
    } else if (presetIdOrObj && typeof presetIdOrObj === 'object') {
      cosmicEpochId = presetIdOrObj.id || 'custom';
      cosmicEpoch = evaluateCosmicEpochState(presetIdOrObj);
    }
    // Dynamically align the active scale's physical regime to the chosen cosmic epoch (when requested)!
    if (alignActiveLevel === 0) {
      if (cosmicEpoch.eraId === 'recombination') await setCosmoMode('cmb');
      else if (cosmicEpoch.eraId === 'cosmic-dawn') await setCosmoMode('reionization');
      else if (cosmicEpoch.eraId === 'far-future') await setCosmoMode('cluster-merger');
      else await setCosmoMode('web');
    } else if (alignActiveLevel === 1) {
      if (cosmicEpoch.eraId === 'cosmic-dawn' || cosmicEpoch.eraId === 'quasar-peak') await initGalaxy({ preset: 'proto', metallicity: Math.max(0.1, cosmicEpoch.meanMetallicitySolar) });
      else if (cosmicEpoch.eraId === 'far-future') await initGalaxy({ preset: 'sphere', metallicity: 1.4 });
      else await initGalaxy({ preset: 'disk', metallicity: 1.0 });
    } else if (alignActiveLevel === 2) {
      if (cosmicEpoch.eraId === 'quasar-peak') await setSolarMode('quasar-jet');
      else if (cosmicEpoch.eraId === 'cosmic-dawn') await setSolarMode('formation');
      else if (cosmicEpoch.eraId === 'far-future') await setSolarMode('red-giant');
      else await setSolarMode('nbody');
    } else if (alignActiveLevel === 3) {
      if (cosmicEpoch.eraId === 'far-future') await setStellarMode('planetary-nebula');
      else if (cosmicEpoch.eraId === 'cosmic-dawn') await setStellarMode('h2-pillars');
      else if (cosmicEpoch.eraId === 'quasar-peak') await setStellarMode('nebular-mhd');
      else await setStellarMode('fusion');
    } else if (alignActiveLevel === 4) {
      if (cosmicEpoch.eraId === 'quasar-peak') await setPlanetaryMode('magma-ocean');
      else await setPlanetaryMode('standard');
    }
    return cosmicEpoch;
  }

  async function setCosmoMode(mode) {
    const valid = ['web', 'cmb', 'reionization', 'cluster-merger'];
    cosmoMode = valid.includes(mode) ? mode : 'web';
    if (cosmoMode === 'web') {
      if (!cosmoSession) await initCosmicWeb();
    } else {
      await initCosmoBaryonRegime(cosmoMode);
    }
  }

  async function setSolarMode(mode) {
    const valid = [
      'nbody', 'formation', 'roche-rings', 'giant-impact', 'red-giant',
      'comet-tails', 'hot-jupiter', 'quasar-jet', 'xray-binary', 'bns-kilonova', 'type-ia', 'bbh-merger'
    ];
    solarMode = valid.includes(mode) ? mode : 'nbody';
    if (solarMode === 'formation') {
      if (!protoplanetarySession) await initProtoplanetaryDisk();
    } else if (solarMode === 'quasar-jet') {
      if (!kerrJetSession) await initKerrQuasarJet();
    } else if (solarMode === 'xray-binary' || solarMode === 'bns-kilonova' || solarMode === 'type-ia' || solarMode === 'bbh-merger') {
      if (!relBinarySession || relBinaryMode !== solarMode) await initRelativisticBinary(solarMode);
    } else if (solarMode === 'comet-tails' || solarMode === 'hot-jupiter') {
      if (!radWindL2Session || radWindL2Mode !== solarMode) await initRadiativeWindL2(solarMode);
    } else if (solarMode === 'roche-rings' || solarMode === 'giant-impact' || solarMode === 'red-giant') {
      if (!tidalRocheSession || tidalRocheMode !== solarMode) await initTidalRocheL2(solarMode);
    } else if (!solarEngine) {
      await initSolarSystem();
    }
  }
  async function setKerrSpinA(val) {
    kerrSpinA = Math.max(-0.99, Math.min(0.99, Number(val) ?? 0.94));
    if (kerrJetSession) await initKerrQuasarJet({ spinA: kerrSpinA });
  }
  function setProtoplanetaryGasDrag(enabled) {
    protoplanetaryGasDrag = Boolean(enabled);
    protoplanetarySession?.setEnableGasDrag?.(protoplanetaryGasDrag);
  }
  async function setStellarMode(mode) {
    const valid = ['fusion', 'nebular-mhd', 'h2-pillars', 'planetary-nebula', 'snr-pwn', 'pulsar', 'magnetar', 'white-dwarf-tov'];
    stellarMode = valid.includes(mode) ? mode : 'fusion';
    if (stellarMode === 'nebular-mhd') {
      if (!nebulaMhdSession) await initNebularMhd();
    } else if (stellarMode === 'h2-pillars' || stellarMode === 'planetary-nebula' || stellarMode === 'snr-pwn') {
      if (!radWindL3Session || radWindL3Mode !== stellarMode) await initRadiativeWindL3(stellarMode);
    } else if (stellarMode === 'pulsar' || stellarMode === 'magnetar') {
      if (!magnetosphereSession || magnetosphereMode !== stellarMode) await initCompactMagnetosphere(stellarMode);
    } else if (stellarMode === 'white-dwarf-tov') {
      if (!tovCurve) await initWhiteDwarfTovCurve();
    } else if (!stellarEngine) {
      await initStellarCore();
    }
  }
  async function setPlanetaryMode(mode) {
    const valid = ['standard', 'magma-ocean', 'cryo-plumes', 'eyeball-locked', 'rogue'];
    planetaryMode = valid.includes(mode) ? mode : 'standard';
    if (planetaryMode === 'cryo-plumes') {
      if (!cryoPlumeSession) await initCryoPlumesL4();
    } else if (planetaryMode === 'eyeball-locked' || planetaryMode === 'rogue') {
      // Reconfigure planetaryAtmoSession with synchronous tidally-locked OR zero-insolation rogue parameters!
      const prev = planetaryAtmoSession;
      planetaryAtmoSession = null;
      if (prev) prev.dispose();
      const baseSpec = REAL_SOLAR_SYSTEM_CATALOG[planetaryBodyIndex] || REAL_SOLAR_SYSTEM_CATALOG[3];
      const overrideState = deriveFluidElectrodynamicsState(
        {
          ...baseSpec,
          surfacePressurePa: Math.max(1.0e5, Number(baseSpec.surfacePressurePa) || 1.013e5),
          volatileMassFrac: Math.max(0.03, Number(baseSpec.volatileMassFrac) || 0.03),
          particulateMassFrac: Math.max(0.008, Number(baseSpec.particulateMassFrac) || 0.008),
          rotationOmegaRadS: planetaryMode === 'eyeball-locked' ? 1.1e-5 : 8.2e-5,
          coreRadiusNorm: 0.54,
          coreConductivitySm: 1.2e6
        },
        planetaryResult || { coreRadiusFraction: 0.54, centralPressurePa: 360e9 },
        { solarDistanceAu: planetaryMode === 'rogue' ? 500.0 : 0.14, coreConductivitySm: 1.2e6 }
      );
      planetaryAtmoState = overrideState;
      const nextAtmo = createPlanetaryAtmosphereElectricSessionWebGpu(device, {
        width: quality.id === 'low' ? 64 : 128,
        height: quality.id === 'low' ? 32 : 64,
        bodyParams: overrideState,
        enableTriboelectric: planetaryTriboelectric,
        seed: (universeSeed ^ (planetaryMode === 'rogue' ? 0x7060e : 0xe7eba11)) >>> 0,
        label: `ulg-universes-atmo-${planetaryMode}`
      });
      for (let w = 0; w < 4; w += 1) {
        planetaryAtmoTelemetry = await nextAtmo.step({
          dtSim: 0.048,
          substeps: 2,
          sunDir: planetaryMode === 'eyeball-locked' ? [1.0, 0.0, 0.0] : [0.0, 1.0, 0.0],
          readTelemetry: w === 3
        });
      }
      planetaryAtmoSession = nextAtmo;
    } else if (planetaryMode === 'standard') {
      await initPlanetaryInterior({ bodyIndex: planetaryBodyIndex });
    }
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

  async function enterSurfaceView({ bodyIndex = planetaryBodyIndex, planetaryModeOverride = null } = {}) {
    const idx = Math.max(1, Math.min(REAL_SOLAR_SYSTEM_CATALOG.length - 1, Math.trunc(Number(bodyIndex) || planetaryBodyIndex || 3)));
    focusedSolarBodyIndex = idx;
    if (planetaryModeOverride) {
      planetaryMode = planetaryModeOverride;
    }
    if (!planetaryResult || planetaryBodyIndex !== idx) {
      await initPlanetaryInterior({ bodyIndex: idx });
    }
    const spec = REAL_SOLAR_SYSTEM_CATALOG[idx] || REAL_SOLAR_SYSTEM_CATALOG[3];
    const nextSurf = createPlanetarySurfaceSessionWebGpu(device, {
      bodySpec: spec,
      planetaryResult,
      planetaryAtmoState,
      planetaryMode,
      gridN: quality.id === 'low' ? 81 : 129,
      cellSizeM: 2.35,
      particleCount: quality.id === 'low' ? 1024 : 2048,
      seed: (universeSeed ^ (idx * 7919 + 0x504face)) >>> 0,
      label: `ulg-universes-surface-${spec.id}`
    });
    // Reset controls cleanly on landing
    surfaceControls = {
      forward: false, backward: false, left: false, right: false,
      jump: false, down: false, turbo: false, yawLeft: false, yawRight: false,
      moveX: 0, moveY: 0
    };
    // Warm terrain mesh + articulated Rover & Drone geometry immediately before swap!
    surfaceTelemetry = await nextSurf.step({ dt: 0.016, controls: surfaceControls, readTelemetry: false });
    surfaceTelemetry = await nextSurf.step({ dt: 0.016, controls: surfaceControls, readTelemetry: true });
    const prev = surfaceSession;
    surfaceSession = nextSurf;
    surfaceActive = true;
    if (prev) prev.dispose();
    return surfaceTelemetry;
  }

  function exitSurfaceView() {
    surfaceActive = false;
    surfaceControls = {
      forward: false, backward: false, left: false, right: false,
      jump: false, down: false, turbo: false, yawLeft: false, yawRight: false,
      moveX: 0, moveY: 0
    };
    const prev = surfaceSession;
    surfaceSession = null;
    surfaceTelemetry = null;
    if (prev) prev.dispose();
  }

  function setSurfaceVehicle(mode) {
    if (!surfaceSession) return null;
    return surfaceSession.setActiveVehicle(mode);
  }
  function setSurfaceCameraMode(mode) {
    if (!surfaceSession) return null;
    return surfaceSession.setCameraMode(mode);
  }
  function setSurfaceControls(partial = {}) {
    surfaceControls = { ...surfaceControls, ...partial };
  }
  function addSurfaceLookDelta(dYaw, dPitch) {
    surfaceSession?.addLookDelta?.(dYaw, dPitch);
  }
  function getActiveUniversalLaws(activeLevel, log10SpanM) {
    const viewSpanM = Math.pow(10, log10SpanM);
    const spec = REAL_SOLAR_SYSTEM_CATALOG[focusedSolarBodyIndex] || REAL_SOLAR_SYSTEM_CATALOG[3];
    const isRelBin = activeLevel === 2 && ['xray-binary', 'bns-kilonova', 'type-ia', 'bbh-merger'].includes(solarMode);
    const isTidalL2 = activeLevel === 2 && ['roche-rings', 'giant-impact', 'red-giant'].includes(solarMode);
    const isRadL2 = activeLevel === 2 && ['comet-tails', 'hot-jupiter'].includes(solarMode);
    const isRadL3 = activeLevel === 3 && ['h2-pillars', 'planetary-nebula', 'snr-pwn'].includes(stellarMode);
    const isMagL3 = activeLevel === 3 && ['pulsar', 'magnetar'].includes(stellarMode);
    const physState = {
      viewSpanM,
      redshiftZ: cosmicEpoch.redshiftZ,
      comovingBoxMpc: activeLevel === 0 ? 260 : 0,
      omegaM: activeLevel === 0 ? 0.315 : 0,
      baryonFraction: activeLevel === 0 && cosmoMode !== 'web' ? 0.157 : 0,
      clusterMassSolar: activeLevel === 0 && cosmoMode === 'cluster-merger' ? 1.5e15 : 0,
      galacticBodyCount: activeLevel === 1 ? (galaxyEngine?.count || 32768) : 0,
      nebulaCloudMass: (activeLevel === 3 && stellarMode === 'nebular-mhd') ? 22.0 : 0,
      magneticFieldStrength: (activeLevel === 3 && stellarMode === 'nebular-mhd')
        ? nebulaB0
        : (activeLevel === 2 && solarMode === 'quasar-jet' ? 1.15 : 0),
      ionizedGasPresent: activeLevel === 3 && (stellarMode === 'nebular-mhd' || isRadL3),
      starMassSolar: (activeLevel === 2 && solarMode === 'formation') ? 1.0 : 0,
      diskSolidMassEarth: (activeLevel === 2 && solarMode === 'formation') ? 45.0 : 0,
      gravitatingBodyCount: (activeLevel === 2 || activeLevel === 4) ? (isRelBin ? 2 : (solarEngine?.totalCount || 15)) : 0,
      solidBodyCount: (activeLevel === 2 && (solarMode === 'formation' || isTidalL2)) ? 18 : 0,
      solidParticleCount: (activeLevel === 2 && solarMode === 'formation') ? 90 : 0,
      coreTempK: (activeLevel === 3 && stellarMode === 'fusion') ? (stellarTelemetry?.coreTempK || 1.5e7) : 0,
      bodyMassKg: activeLevel === 4 ? (spec.massSolar * 1.98847e30) : (activeLevel === 3 && stellarMode === 'fusion' ? 1.98847e30 : 0),
      bodyRadiusM: activeLevel === 4 ? (spec.radiusKm * 1000) : 0,
      surfacePressurePa: activeLevel === 4 ? (planetaryAtmoState?.surfacePressurePa || 0) : 0,
      volatileMassFrac: activeLevel === 4 ? (planetaryAtmoState?.volatileMassFrac || 0) : 0,
      particulateMassFrac: activeLevel === 4 ? (planetaryAtmoState?.particulateMassFrac || 0) : 0,
      dynamo: activeLevel === 4 ? (planetaryAtmoState?.dynamo || null) : null,
      // Wave-2 Compact/Relativistic/Magnetosphere/GW/Radiative/Tidal state inputs
      compactnessGMOverRc2: (activeLevel === 2 && (solarMode === 'quasar-jet' || isRelBin)) || (activeLevel === 3 && (isMagL3 || stellarMode === 'white-dwarf-tov')) ? 0.25 : 0,
      centralRelativisticMassSolar: (activeLevel === 2 && solarMode === 'quasar-jet') ? 4.5e8 : (isRelBin ? 10.0 : 0),
      accretionRateEddington: (activeLevel === 2 && (solarMode === 'quasar-jet' || solarMode === 'xray-binary')) ? 0.55 : 0,
      kerrSpinA: (activeLevel === 2 && solarMode === 'quasar-jet') ? kerrSpinA : 0,
      surfaceBFieldTesla: isMagL3 ? (stellarMode === 'magnetar' ? 1.65e11 : 4.2e8) : 0,
      compactRadiusM: isMagL3 ? 12000 : 0,
      spinOmegaRadS: isMagL3 ? (stellarMode === 'magnetar' ? 45.0 : 740.0) : 0,
      maxPairwiseVOverC: isRelBin ? 0.22 : 0,
      rocheOverflowPresent: activeLevel === 2 && solarMode === 'xray-binary',
      uvFluxNorm: (isRadL2 || isRadL3) ? 1.5 : 0,
      xuvFluxWPerM2: (activeLevel === 2 && solarMode === 'hot-jupiter') ? 180.0 : 0,
      surfaceTempK: (activeLevel === 2 && solarMode === 'comet-tails') ? 260 : 0,
      sublimationTempK: (activeLevel === 2 && solarMode === 'comet-tails') ? 170 : 1e9,
      maxTidalStrain: (isTidalL2 || (activeLevel === 4 && planetaryMode === 'cryo-plumes')) ? 0.85 : 0,
      maxSurfaceTempK: (activeLevel === 4 && planetaryMode === 'magma-ocean') || (activeLevel === 2 && (solarMode === 'giant-impact' || solarMode === 'red-giant')) ? 2400 : 0,
      surfaceViewActive: surfaceActive
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
      if (cosmoMode === 'cmb') {
        const t = cosmoBaryonTelemetry;
        return [{
          id: 'cmb-recombination',
          level: 0,
          name: 'CMB Last Scattering Surface (z = 1100)',
          subtitle: `t = 380 kyr · T_CMB = ${(t?.cmbTempK || 3001).toFixed(0)} K · Eisenstein–Hu BAO r_s ≈ 147 Mpc`,
          pos: [0, 0, 0],
          radius: 4.5,
          tempK: t?.cmbTempK || 3001,
          massLabel: 'ΔT/T acoustic',
          composition: 'H⁺/e⁻ → Neutral H (Peebles Recombination) · Primordial He 25%',
          nextLevel: 1
        }];
      }
      if (cosmoMode === 'reionization') {
        const t = cosmoBaryonTelemetry;
        return [{
          id: 'cosmic-reionization',
          level: 0,
          name: 'Cosmic Dawn & Reionization Bubbles (z = 10)',
          subtitle: `t = 470 Myr · ⟨x_HII⟩ = ${((t?.meanIonizedFraction || 0.2) * 100).toFixed(1)}% · Pop III UV Percolation`,
          pos: [0, 0, 0],
          radius: 4.0,
          tempK: 20000,
          massLabel: 'Z ≈ 10⁻⁴ Z☉',
          composition: 'Neutral H I Web + Photoionized H II Bubbles · Pop III Halos',
          nextLevel: 1
        }];
      }
      if (cosmoMode === 'cluster-merger') {
        const t = cosmoBaryonTelemetry;
        return [{
          id: 'bullet-cluster-merger',
          level: 0,
          name: 'Galaxy Cluster Merger & Gravitational Lensing',
          subtitle: `ICM T_max = ${((t?.maxGasTempK || 5e7) / 1e6).toFixed(1)} MK · Lensing κ_max = ${(t?.maxLensingKappa || 0.5).toFixed(2)}`,
          pos: [0, 0, 0],
          radius: 4.0,
          tempK: 6e7,
          massLabel: '1.5×10¹⁵ M☉',
          composition: 'Shock-Heated X-Ray ICM Plasma + Offset Dark-Matter Lensing Halos',
          nextLevel: 1
        }];
      }
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
      if (solarMode !== 'nbody' && solarMode !== 'formation') {
        const metaMap = {
          'quasar-jet': {
            name: `Quasar / Blazar Kerr AGN (a* = ${kerrSpinA.toFixed(2)})`,
            subtitle: `4.5×10⁸ M☉ Kerr BH · Blandford–Znajek Jets · Live Camera Doppler Beaming (Γ = ${(kerrJetTelemetry?.maxLorentzGamma || 5.5).toFixed(1)})`,
            tempK: 45000,
            composition: 'Novikov–Thorne Plasma Disk · Relativistic e±/p⁺ BZ Jets · Dusty Torus'
          },
          'xray-binary': {
            name: 'Microquasar X-Ray Binary (Roche L1 Overflow)',
            subtitle: `11 M☉ BH + 1.8 M☉ Donor · Eggleton R_L Stream → Hot X-Ray Accretion Disk`,
            tempK: 28000,
            composition: 'H/He Roche-Lobe Stream · Comptonized X-Ray Corona'
          },
          'bns-kilonova': {
            name: 'Binary Neutron Star Merger & Kilonova',
            subtitle: `1.45 + 1.32 M☉ · 2.5PN GW Chirp · ${relBinaryTelemetry?.merged ? 'r-Process Lanthanide Kilonova Burst!' : 'Relativistic Inspiral'}`,
            tempK: 12000,
            composition: 'Low-Y_e Lanthanide r-Process Ejecta (Au/Pt/U) + Blue Polar Wind'
          },
          'type-ia': {
            name: 'Type Ia Thermonuclear Supernova (M_Ch = 1.44 M☉)',
            subtitle: 'C/O White Dwarf Runaway ¹²C+¹²C Detonation · Zero Central Remnant · ⁵⁶Ni Glow',
            tempK: 18000,
            composition: '⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe · Si / S / Ca Detonation Shell'
          },
          'bbh-merger': {
            name: 'Binary Black Hole 2.5PN GW Inspiral & Ringdown',
            subtitle: '36 + 29 M☉ Kerr BHs · Quadrupole Strain Chirp h_+(t) & Gravitational Lensing',
            tempK: 20000,
            composition: 'Vacuum Kerr Spacetime · Gravitational Radiation Flux'
          },
          'comet-tails': {
            name: 'Active Dual-Tail Comet (Clausius–Clapeyron)',
            subtitle: 'Curved Radiation-Pressure Dust Tail (β) + Straight Solar-Wind CO⁺ Ion Tail',
            tempK: 260,
            composition: 'H₂O / CO / CO₂ Sublimating Ice Nucleus · Silicate Dust · CO⁺ Plasma'
          },
          'hot-jupiter': {
            name: 'Hot Jupiter XUV Atmospheric Photoevaporation',
            subtitle: 'Energy-Limited XUV Escape Tail (Ṁ = ε π R_p³ F_XUV / G M_p)',
            tempK: 1850,
            composition: 'Ionized H/He Escaping Cometary Envelope · Silicate Haze'
          },
          'roche-rings': {
            name: 'Roche-Limit Tidal Disruption & Shepherd-Moon Rings',
            subtitle: `Cohesive Rubble-Pile Rupture (${((tidalRocheTelemetry?.rupturedFraction || 0.7) * 100).toFixed(0)}%) + Resonant Ring Gap`,
            tempK: 140,
            composition: 'Water-Ice & Silicate Ring Particles · Embedded Shepherd Moon'
          },
          'giant-impact': {
            name: 'Giant Moon-Forming Impact & Hadean Disk',
            subtitle: 'Incandescent Magma-Ocean Proto-Earth + Molten Silicate Circumplanetary Disk',
            tempK: 2800,
            composition: 'Molten Fe/MgSiO₃ Silicate Vapor & Re-Accreting Lunar Embryo Disk'
          },
          'red-giant': {
            name: 'Red-Giant Branch Engulfment (+5 Gyr)',
            subtitle: 'Bloated Convective RGB Envelope · Aerodynamic Common-Envelope Drag on Inner Worlds',
            tempK: 3400,
            composition: 'Convective H/He Envelope · Vaporizing Inner Rocky Orbits'
          }
        };
        const m = metaMap[solarMode] || metaMap['quasar-jet'];
        return [{
          id: `l2-${solarMode}`,
          level: 2,
          name: m.name,
          subtitle: m.subtitle,
          pos: [0, 0, 0],
          radius: 1.5,
          tempK: m.tempK,
          composition: m.composition,
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
      if (stellarMode !== 'fusion') {
        const l3Map = {
          'nebular-mhd': {
            name: '3D Resistive MHD Nebular Collapse & Jets',
            subtitle: `∂B/∂t = ∇×(v×B) + η∇²B − ∇ψ · B₀ = ${nebulaB0.toFixed(2)} · Helical J×B Outflow`,
            tempK: 6500,
            composition: 'Magnetized H₂/Dust Molecular Cloud · Helical B-Field Towers'
          },
          'h2-pillars': {
            name: 'H II Star-Forming Pillars (Strömgren Ionization)',
            subtitle: 'Photoevaporative Rocket Ablation · Stratified [O III] / Hα / [S II] Emission',
            tempK: 11000,
            composition: 'Ionized H⁺ (Hα) · Doubly Ionized O²⁺ ([O III]) · Shielded Dense Dust ([S II])'
          },
          'planetary-nebula': {
            name: 'Bipolar Planetary Nebula & Hot White Dwarf',
            subtitle: 'Fast Post-AGB Wind Sweeping Dusty Envelope · 95,000 K Central C/O White Dwarf',
            tempK: 14500,
            composition: 'Inner [O III] Teal Cavity · Outer Hα / [N II] Crimson Shell · C/O Core'
          },
          'snr-pwn': {
            name: 'Supernova Remnant & Crab Pulsar Wind Nebula',
            subtitle: 'Sedov–Taylor Expanding Blastwave + Relativistic Synchrotron Filaments',
            tempK: 22000,
            composition: 'Shocked O/Si/Fe Ejecta · Inner e± Synchrotron PWN · Central NS'
          },
          pulsar: {
            name: 'Millisecond Pulsar Oblique Magnetosphere',
            subtitle: `Spitkovsky Force-Free Dipole (B = 4.2×10⁸ T, P = 8.5 ms) · Twin Lighthouse Beams`,
            tempK: 32000,
            composition: 'Neutron-Degenerate Core · e± Pair-Plasma Open Polar Caps'
          },
          magnetar: {
            name: 'Magnetar Crustal-Yield Giant Flare',
            subtitle: `B = 1.65×10¹¹ T (1.65×10¹⁵ G) · Hall-Drift Twist · ${magnetosphereTelemetry?.flareCount || 0} Unscripted Starquakes`,
            tempK: 48000,
            composition: 'Superconducting Proton/Neutron Interior · Sheared Fe Crust · Reconnection Fireball'
          },
          'white-dwarf-tov': {
            name: 'GR TOV Unified Degenerate EOS (WD → NS → BH)',
            subtitle: 'Live Batched WebGPU RK4 Tolman–Oppenheimer–Volkoff Mass–Radius Sequence',
            tempK: 26000,
            composition: 'Relativistic Fermi–Dirac Electron Degeneracy (M_Ch ≈ 1.44 M☉) → Nuclear Saturation'
          }
        };
        const m = l3Map[stellarMode] || l3Map['nebular-mhd'];
        return [{
          id: `l3-${stellarMode}`,
          level: 3,
          name: m.name,
          subtitle: m.subtitle,
          pos: [0, 0, 0],
          radius: 1.8,
          tempK: m.tempK,
          composition: m.composition,
          nextLevel: 4
        }];
      }
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
    if (level === 4) {
      if (planetaryMode !== 'standard') {
        const l4Map = {
          'magma-ocean': {
            name: 'Hadean Magma Ocean World',
            subtitle: 'Incandescent Molten Silicate Crust (T_surf ≈ 2,400 K) · Outgassing Steam Atmosphere',
            tempK: 2400,
            composition: 'Molten MgSiO₃ Peridotite · Fe-Ni Core Segregation · H₂O/CO₂ Steam'
          },
          'cryo-plumes': {
            name: 'Cryovolcanic Icy Moon (Viscoelastic Tidal Plumes)',
            subtitle: 'Peale–Cassen–Reynolds Tidal Heating Driving Supersonic South-Polar H₂O Geysers',
            tempK: 95,
            composition: 'Water-Ice Lithosphere · Subsurface Brine Ocean · Supersonic H₂O Plumes'
          },
          'eyeball-locked': {
            name: 'Tidally Locked Eyeball Exoplanet',
            subtitle: 'Synchronous 1:1 Spin-Orbit Lock · Substellar Ocean Eye + Terminator Super-Rotation',
            tempK: 295,
            composition: 'Substellar Liquid Ocean · Terminator Convection Belt · Frozen Nightside'
          },
          rogue: {
            name: 'Rogue Free-Floating Dark World',
            subtitle: 'Zero Stellar Insolation · Geothermal Internal Heat + Dark-Sky Triboelectric Storms',
            tempK: 65,
            composition: 'Dense H₂/N₂ Geothermal Atmosphere · Deep Mantle Radiogenic Heating'
          }
        };
        const m = l4Map[planetaryMode];
        if (m) {
          return [{
            id: `l4-${planetaryMode}`,
            level: 4,
            name: m.name,
            subtitle: m.subtitle,
            pos: [0, 0, 0],
            radius: 1.8,
            sampleZ: 26,
            rCoreNorm: planetaryLayersMeta[0]?.rCoreNorm ?? 0.54,
            rMantleNorm: 0.94,
            tempK: m.tempK,
            composition: m.composition,
            nextLevel: 5
          }];
        }
      }
      return planetaryLayersMeta;
    }
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
    try { cosmoBaryonSession?.dispose(); } catch {}
    try { galaxyEngine?.dispose(); } catch {}
    try { smbhEngine?.dispose(); } catch {}
    try { solarEngine?.dispose(); } catch {}
    try { protoplanetarySession?.dispose(); } catch {}
    try { kerrJetSession?.dispose(); } catch {}
    try { relBinarySession?.dispose(); } catch {}
    try { radWindL2Session?.dispose(); } catch {}
    try { tidalRocheSession?.dispose(); } catch {}
    try { stellarEngine?.dispose(); } catch {}
    try { nebulaMhdSession?.dispose(); } catch {}
    try { radWindL3Session?.dispose(); } catch {}
    try { magnetosphereSession?.dispose(); } catch {}
    try { planetaryAtmoSession?.dispose(); } catch {}
    try { cryoPlumeSession?.dispose(); } catch {}
    try { surfaceSession?.dispose(); } catch {}
    try { mdSession?.destroy(); } catch {}
    try { orbitalCloud?.pointsBuffer?.destroy(); } catch {}
    try { tdseSession?.destroy(); } catch {}
  }

  return Object.freeze({
    AU_METERS,
    REAL_SOLAR_SYSTEM_CATALOG,
    MOLECULE_SPECS,
    COSMIC_EPOCH_PRESETS,
    get seed() { return universeSeed; },
    get quality() { return quality; },
    get cosmicEpochId() { return cosmicEpochId; },
    get cosmicEpoch() { return cosmicEpoch; },
    get cosmoMode() { return cosmoMode; },
    get cosmoSession() { return cosmoSession; },
    get cosmoTelemetry() { return cosmoTelemetry; },
    get cosmoFirstPk() { return cosmoFirstPk; },
    get cosmoTargets() { return cosmoTargets; },
    get cosmoBaryonSession() { return cosmoBaryonSession; },
    get cosmoBaryonTelemetry() { return cosmoBaryonTelemetry; },
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
    get kerrJetSession() { return kerrJetSession; },
    get kerrJetTelemetry() { return kerrJetTelemetry; },
    get kerrSpinA() { return kerrSpinA; },
    get relBinarySession() { return relBinarySession; },
    get relBinaryTelemetry() { return relBinaryTelemetry; },
    get relBinaryMode() { return relBinaryMode; },
    get radWindL2Session() { return radWindL2Session; },
    get radWindL2Telemetry() { return radWindL2Telemetry; },
    get tidalRocheSession() { return tidalRocheSession; },
    get tidalRocheTelemetry() { return tidalRocheTelemetry; },
    get solarConservation0() { return solarConservation0; },
    get solarConservation() { return solarConservation; },
    get focusedSolarBodyIndex() { return focusedSolarBodyIndex; },
    get stellarEngine() { return stellarEngine; },
    get stellarMode() { return stellarMode; },
    get nebulaMhdSession() { return nebulaMhdSession; },
    get nebulaMhdTelemetry() { return nebulaMhdTelemetry; },
    get nebulaMhdStreamlines() { return nebulaMhdStreamlines; },
    get nebulaB0() { return nebulaB0; },
    get radWindL3Session() { return radWindL3Session; },
    get radWindL3Telemetry() { return radWindL3Telemetry; },
    get magnetosphereSession() { return magnetosphereSession; },
    get magnetosphereTelemetry() { return magnetosphereTelemetry; },
    get magnetosphereFieldLines() { return magnetosphereFieldLines; },
    get tovCurve() { return tovCurve; },
    get stellarPreset() { return stellarPreset; },
    get stellarTelemetry() { return stellarTelemetry; },
    get stellarNuclearNetwork() { return stellarNuclearNetwork; },
    get stellarLaneEmden() { return stellarLaneEmden; },
    get stellarTimeAccel() { return stellarTimeAccel; },
    get planetaryMode() { return planetaryMode; },
    get planetaryResult() { return planetaryResult; },
    get planetaryBodyIndex() { return planetaryBodyIndex; },
    get planetaryCutaway() { return planetaryCutaway; },
    get planetaryAtmoState() { return planetaryAtmoState; },
    get planetaryAtmoSession() { return planetaryAtmoSession; },
    get planetaryAtmoTelemetry() { return planetaryAtmoTelemetry; },
    get planetaryTriboelectric() { return planetaryTriboelectric; },
    get cryoPlumeSession() { return cryoPlumeSession; },
    get cryoPlumeTelemetry() { return cryoPlumeTelemetry; },
    get surfaceActive() { return surfaceActive; },
    get surfaceSession() { return surfaceSession; },
    get surfaceTelemetry() { return surfaceTelemetry; },
    get surfaceControls() { return surfaceControls; },
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
    evaluateStellarEvolutionaryState,
    buildQuantizedNucleonSpheres,
    getElementBundle,
    getCachedElementBundle,
    ensureLevelInitialized,
    initCosmicWeb,
    initCosmoBaryonRegime,
    initGalaxy,
    initSmbhCore,
    initSolarSystem,
    initProtoplanetaryDisk,
    initKerrQuasarJet,
    initRelativisticBinary,
    initRadiativeWindL2,
    initTidalRocheL2,
    initNebularMhd,
    initRadiativeWindL3,
    initCompactMagnetosphere,
    initWhiteDwarfTovCurve,
    initStellarCore,
    initPlanetaryInterior,
    initCryoPlumesL4,
    initMolecularDynamics,
    initQuantumAtom,
    initAtomicNucleus,
    stepActiveRegimes,
    setCosmicEpoch,
    setCosmoMode,
    setQuality,
    setSeed,
    setMdGravity,
    setMdTemp,
    setPlanetaryCutaway,
    setPlanetaryTriboelectric,
    setPlanetaryMode,
    enterSurfaceView,
    exitSurfaceView,
    setSurfaceVehicle,
    setSurfaceCameraMode,
    setSurfaceControls,
    addSurfaceLookDelta,
    setStellarTimeAccel,
    setSolarMode,
    setKerrSpinA,
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
