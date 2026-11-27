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
  resolveActiveUniversalLaws,
  validateUniversalLawGraphContracts
} from '../runtime/universalLawGraph.js';
import {
  createDynamicSchroederScaleAtlasRuntime
} from '../runtime/sph/schroederSpatialScaleAtlasRuntime.js';
import {
  COSMIC_EPOCH_PRESETS,
  evaluateCosmicEpochState,
  evaluateStellarEvolutionaryState
} from '../runtime/astrophysics/cosmicEpochState.js';
import {
  deriveGalaxyEnvironmentFromCosmicContext,
  deriveStarSystemFromGalacticLocation,
  synthesizeNebularPlanetarySystem
} from '../runtime/astrophysics/causalNebularSystemGenerator.js';
import { resolveStellarRegimeForStarSpec } from '../runtime/astrophysics/starlightAndExoticOptics.js';
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
  createDistributedSpatialPartitioner,
  encodeTileMultipolePayload
} from '../services/distributedSpatialPartitioner.js';
import {
  createNebularMhdCollapseSessionWebGpu
} from '../runtime/astrophysics/nebularMhdCollapseGpu.js';
import {
  createProtoplanetaryDiskFormationSessionWebGpu
} from '../runtime/astrophysics/protoplanetaryDiskFormationGpu.js';
import {
  createNebularSystemCoalescenceSessionWebGpu,
  registerNebularSystemCoalescenceModule,
  runNebularSystemCoalescenceBurstWebGpu
} from '../runtime/astrophysics/nebularSystemCoalescenceGpu.js';
import {
  createPlanetaryGenesisSphSessionWebGpu,
  evaluatePlanetaryGenesisSphActivation,
  registerPlanetaryGenesisSphModule
} from '../runtime/astrophysics/planetaryGenesisSphGpu.js';
import {
  createCosmicLineageRootCache,
  decodeFloat32Quantized,
  encodeFloat32Quantized
} from '../runtime/astrophysics/cosmicLineageRootCache.js';
import {
  createPlanetaryAtmosphereElectricSessionWebGpu,
  deriveFluidElectrodynamicsState
} from '../runtime/astrophysics/planetaryAtmosphereElectricGpu.js';
import {
  createPlanetarySurfaceSessionWebGpu
} from '../runtime/astrophysics/planetarySurfaceVehiclesGpu.js';
import {
  buildCraterTileKey,
  createSurfaceCraterTileStore
} from '../runtime/astrophysics/surfaceCraterTileStore.js';
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
import { createStellarMlsMpmFusionSessionWebGpu } from '../runtime/astrophysics/stellarMlsMpmFusionGpu.js';
import {
  createGalacticParticleMeshEngineWebGpu
} from '../runtime/astrophysics/galacticParticleMeshGpu.js';
import {
  createEmergent3dDynamoFieldWebGpu
} from '../runtime/astrophysics/emergentMhdDynamoGpu.js';
import {
  createResidentScaleAtlasMultipoleNBodyEngine,
  createResidentTiledNBodyEngine
} from './cosmicQuantumGpuKernels.js';
import { deriveElementBundleWebGpu } from '../runtime/material/periodicTableEngineWebGpu.js';
import { deriveCompoundBundleWebGpu } from '../runtime/material/recursiveCompoundPipeline.js';
import {
  getCompoundBundleFromAtlas,
  normalizeChemicalFormula
} from '../runtime/material/canonicalMaterialLookup.js';
import {
  buildCrystalMdState,
  createMolecularDynamicsSessionWebGpu
} from '../runtime/gpuMath/molecularDynamicsWebGpu.js';
import {
  sampleAtomicOrbitalCloudWebGpu,
  sampleMolecularOrbitalCloudWebGpu
} from '../runtime/electronicStructure/orbitalPointCloudWebGpu.js';
import { solveMoleculeRhfWebGpu } from '../runtime/electronicStructure/molecularHartreeFockWebGpu.js';
import {
  mostStableMassNumberForZ,
  solveNuclearStructureWebGpu
} from '../runtime/nuclear/nuclearStructureGpu.js';
import { createNuclearTunnelingTdseWebGpu } from '../runtime/material/photonShellOpticsWebGpu.js';
import {
  createRelaySignalingTransport,
  startLiveClientDerivationPeerMesh
} from '../services/clientDerivationPeers.js';
import {
  buildPeerComputeSimulationProfile
} from '../runtime/astrophysics/peercomputeSimulationScaler.js';
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

const GALAXY_MORPHOLOGIES = [
  'disk', 'barred', 'ring', 'lenticular', 'irregular', 'open-cluster',
  'binary', 'sphere', 'proto', 'dwarf-stream', 'globular', 'coalesce'
];
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
  CO2: Object.freeze({
    formula: 'CO₂',
    name: 'Carbon Dioxide (Linear O=C=O)',
    atoms: [
      { Z: 6, symbol: 'C', position: [0, 0, 0] },
      { Z: 8, symbol: 'O', position: [0, 0, 2.19] },
      { Z: 8, symbol: 'O', position: [0, 0, -2.19] }
    ]
  }),
  CH4: Object.freeze({
    formula: 'CH₄',
    name: 'Methane (Tetrahedral T_d)',
    atoms: [
      { Z: 6, symbol: 'C', position: [0, 0, 0] },
      { Z: 1, symbol: 'H', position: [1.19, 1.19, 1.19] },
      { Z: 1, symbol: 'H', position: [1.19, -1.19, -1.19] },
      { Z: 1, symbol: 'H', position: [-1.19, 1.19, -1.19] },
      { Z: 1, symbol: 'H', position: [-1.19, -1.19, 1.19] }
    ]
  }),
  NH3: Object.freeze({
    formula: 'NH₃',
    name: 'Ammonia (Trigonal Pyramidal C₃v)',
    atoms: [
      { Z: 7, symbol: 'N', position: [0, 0.42, 0] },
      { Z: 1, symbol: 'H', position: [1.77, -0.32, 0] },
      { Z: 1, symbol: 'H', position: [-0.885, -0.32, 1.53] },
      { Z: 1, symbol: 'H', position: [-0.885, -0.32, -1.53] }
    ]
  }),
  SiO2: Object.freeze({
    formula: 'SiO₂',
    name: 'Silica Unit (O=Si=O)',
    atoms: [
      { Z: 14, symbol: 'Si', position: [0, 0, 0] },
      { Z: 8, symbol: 'O', position: [0, 0, 2.85] },
      { Z: 8, symbol: 'O', position: [0, 0, -2.85] }
    ]
  }),
  O2: Object.freeze({
    formula: 'O₂',
    name: 'Dioxygen (O=O)',
    atoms: [
      { Z: 8, symbol: 'O', position: [0, 0, -1.14] },
      { Z: 8, symbol: 'O', position: [0, 0, 1.14] }
    ]
  }),
  N2: Object.freeze({
    formula: 'N₂',
    name: 'Dinitrogen (N≡N)',
    atoms: [
      { Z: 7, symbol: 'N', position: [0, 0, -1.04] },
      { Z: 7, symbol: 'N', position: [0, 0, 1.04] }
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
 * Automatic continuous scale-adaptive time dilation across all 40 orders of magnitude!
 * Zooming inward from Cosmic Web (10^25 m) -> Galaxy -> Star System -> Planet -> Surface ->
 * Lattice -> Atom -> Nucleus monotonically slows the physical simulation clock so every
 * regime runs at a natural, readable dynamical cadence!
 */
export function computeScaleAdaptiveTimeDilation(log10SpanM, {
  surfaceActive = false,
  userTimeScale = 1.0
} = {}) {
  const span = Number.isFinite(Number(log10SpanM)) ? Number(log10SpanM) : 24.8;
  const userMul = Math.max(0.1, Math.min(3.0, Number(userTimeScale) || 1.0));
  if (surfaceActive) {
    const sPerS = 1.0 * userMul;
    return Object.freeze({
      factor: 1.0,
      effectiveTimeScale: userMul,
      secondsPerWallSecond: sPerS,
      clockLabel: `${sPerS.toFixed(1)} s/s`
    });
  }

  // Smooth piecewise-log10 physical clock rate (seconds of simulated physics per wall-clock second)
  // and normalized per-scale cadence multiplier (`factor`) that strictly decreases as you zoom in!
  let secondsPerWallSecond;
  let factor;
  if (span >= 22.0) {
    // L0 Cosmic Web (25.4 -> 22.0): ~160 Myr/s -> ~18 Myr/s
    const t = Math.max(0, Math.min(1, (span - 22.0) / 3.4));
    secondsPerWallSecond = Math.pow(10, 14.75 + t * 0.95) * userMul;
    factor = 0.55 + 0.45 * t;
  } else if (span >= 16.2) {
    // L1 Spiral Galaxy (22.0 -> 16.2): ~12 Myr/s -> ~0.35 Myr/s
    const t = Math.max(0, Math.min(1, (span - 16.2) / 5.8));
    secondsPerWallSecond = Math.pow(10, 13.05 + t * 1.55) * userMul;
    factor = 0.28 + 0.72 * Math.pow(t, 0.85);
  } else if (span >= 8.75) {
    // L2 Star System & L3 Star (16.2 -> 8.75): continuous slowing from ~45 d/s (outer 30 AU) -> ~2 hr/s (close planet/moon!)
    const t = Math.max(0, Math.min(1, (span - 8.75) / 7.45));
    secondsPerWallSecond = Math.pow(10, 3.85 + t * 2.75) * userMul;
    factor = 0.14 + 0.86 * Math.pow(t, 1.35);
  } else if (span >= 0.0) {
    // L4 Planetary Orbit & Horizon Approach (8.75 -> 0.0): ~25 min/s -> ~1.5 s/s
    const t = Math.max(0, Math.min(1, span / 8.75));
    secondsPerWallSecond = Math.pow(10, 0.20 + t * 3.0) * userMul;
    factor = 0.22 + 0.58 * t;
  } else if (span >= -9.1) {
    // L5 Molecular/Crystal Lattice: ~15 fs/s (femtoseconds/s)
    const t = Math.max(0, Math.min(1, (span + 9.1) / 9.1));
    secondsPerWallSecond = Math.pow(10, -14.1 + t * 1.2) * userMul;
    factor = 0.45 + 0.25 * t;
  } else if (span >= -12.8) {
    // L6 Quantum Atom: ~12 as/s (attoseconds/s)
    const t = Math.max(0, Math.min(1, (span + 12.8) / 3.7));
    secondsPerWallSecond = Math.pow(10, -17.2 + t * 1.2) * userMul;
    factor = 0.35 + 0.15 * t;
  } else {
    // L7 Atomic Nucleus: ~15 zs/s (zeptoseconds/s)
    secondsPerWallSecond = 1.5e-20 * userMul;
    factor = 0.42;
  }

  let clockLabel;
  const s = secondsPerWallSecond;
  if (s >= 3.15576e13) clockLabel = `${(s / 3.15576e13).toFixed(s >= 3.15576e14 ? 0 : 1)} Myr/s`;
  else if (s >= 3.15576e10) clockLabel = `${(s / 3.15576e10).toFixed(1)} kyr/s`;
  else if (s >= 3.15576e7) clockLabel = `${(s / 3.15576e7).toFixed(2)} yr/s`;
  else if (s >= 86400) clockLabel = `${(s / 86400).toFixed(s >= 864000 ? 0 : 1)} d/s`;
  else if (s >= 3600) clockLabel = `${(s / 3600).toFixed(1)} hr/s`;
  else if (s >= 60) clockLabel = `${(s / 60).toFixed(1)} min/s`;
  else if (s >= 0.05) clockLabel = `${s.toFixed(1)} s/s`;
  else if (s >= 1e-12) clockLabel = `${(s * 1e12).toFixed(1)} ps/s`;
  else if (s >= 1e-15) clockLabel = `${(s * 1e15).toFixed(1)} fs/s`;
  else if (s >= 1e-18) clockLabel = `${(s * 1e18).toFixed(1)} as/s`;
  else clockLabel = `${(s * 1e21).toFixed(1)} zs/s`;

  return Object.freeze({
    factor,
    effectiveTimeScale: factor * userMul,
    secondsPerWallSecond,
    clockLabel
  });
}

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
/**
 * Classify a cosmological L0 halo's physical parameters `(delta, lambda, f_gas, z, seed)`
 * into one of 6 research-grounded galactic collapse initial-condition regimes:
 *   1. Dekel & Birnboim (2006) / Dekel+ (2009) Cold Filamentary Stream Accretion
 *   2. Toomre & Toomre (1972) / Hopkins+ (2009) Major / Minor Merger (incl. Bullseye Ring Impact)
 *   3. Jing & Suto (2002) / Naab+ (2007) Triaxial Multi-Subhalo Violent Relaxation (Elliptical)
 *   4. Mo, Mao & White (1998) / Yurin & Springel (2014 GalIC) High-Spin Disk & Bar/Spiral Instability
 *   5. Low-Overdensity Void Asymmetric Dwarf & Wrapping Tidal Stream Assembly
 *   6. M51-Style Tidal Group Disk + Infalling Dwarf Satellite Perturber
 */
export function describeCosmologicalGalaxyIcRegime(galaxyEnv = null, seed = 825) {
  const rand = mulberry32((Number(seed) ^ 0x51a7c01a) >>> 0);
  const delta = Math.max(0.2, Math.min(10.0, Number(galaxyEnv?.localOverdensity) || (0.5 + rand() * 2.4)));
  const spinL = Math.max(0.006, Math.min(0.18, Number(galaxyEnv?.tidalSpinLambda) || (0.015 + rand() * 0.085)));
  const fGas = Math.max(0.02, Math.min(0.88, Number(galaxyEnv?.gasFraction) || (0.10 + rand() * 0.60)));
  const zRed = Number.isFinite(Number(galaxyEnv?.redshiftZ)) ? Number(galaxyEnv.redshiftZ) : 0.0;
  const morphHint = String(galaxyEnv?.morphology || '');

  // Continuous 3D cosmic tidal-torque orientation vector (unique per halo!)
  const tiltX = (rand() - 0.5) * 1.15;
  const tiltZ = (rand() - 0.5) * 0.95;

  if (zRed >= 1.2 || fGas >= 0.44 || morphHint === 'proto') {
    const nStreams = 3 + (rand() < 0.35 ? 1 : 0);
    return Object.freeze({
      id: 'cold-streams',
      isMerger: false,
      label: `Dekel Cold-Stream Accretion (${nStreams} filaments · f_gas=${fGas.toFixed(2)})`,
      delta, spinL, fGas, zRed, tiltX, tiltZ, nStreams
    });
  }
  if (morphHint === 'ring' || (delta >= 1.60 && (morphHint === 'binary' || rand() < 0.44))) {
    const massRatio = Number((0.28 + rand() * 0.72).toFixed(2));
    const impactParam = morphHint === 'ring'
      ? Number((0.03 + rand() * 0.06).toFixed(2))
      : Number((0.05 + rand() * 0.50).toFixed(2));
    const isBullseye = impactParam < 0.12;
    const isPrograde = rand() < 0.62;
    return Object.freeze({
      id: isBullseye ? 'bullseye-ring-impact' : 'toomre-merger',
      isMerger: true,
      label: isBullseye
        ? `Bullseye Polar Ring Impact (μ=1:${(1 / massRatio).toFixed(1)} · b=${impactParam} R_vir)`
        : `Toomre ${isPrograde ? 'Prograde' : 'Retrograde'} Merger (μ=1:${(1 / massRatio).toFixed(1)} · b=${impactParam} R_vir)`,
      delta, spinL, fGas, zRed, tiltX, tiltZ, massRatio, impactParam, isPrograde
    });
  }
  if ((delta >= 1.75 && spinL < 0.048) || morphHint === 'sphere') {
    const nSubhalos = 4 + Math.floor(rand() * 3);
    const ba = Number((0.64 + rand() * 0.24).toFixed(2));
    const ca = Number((0.46 + rand() * 0.22).toFixed(2));
    return Object.freeze({
      id: 'triaxial-relaxation',
      isMerger: false,
      label: `Triaxial ${nSubhalos}-Subhalo Violent Relaxation (λ=${spinL.toFixed(3)} · b/a=${ba})`,
      delta, spinL, fGas, zRed, tiltX, tiltZ, nSubhalos, ba, ca
    });
  }
  if (delta < 0.72 || morphHint === 'globular' || morphHint === 'dwarf-stream' || morphHint === 'irregular') {
    const nClumps = 5 + Math.floor(rand() * 4);
    return Object.freeze({
      id: 'void-dwarf-assembly',
      isMerger: false,
      label: `Void Asymmetric Dwarf & Tidal Stream (${nClumps} clumps · δ=${delta.toFixed(2)})`,
      delta, spinL, fGas, zRed, tiltX, tiltZ, nClumps
    });
  }
  if (spinL >= 0.050 || morphHint === 'barred' || morphHint === 'disk') {
    const barUnstable = morphHint === 'barred' || (spinL < 0.068 && rand() < 0.45);
    const armMode = barUnstable ? 2 : (2 + Math.floor(rand() * 3));
    return Object.freeze({
      id: barUnstable ? 'mmw-bar-instability' : 'mmw-high-spin-disk',
      isMerger: false,
      label: barUnstable
        ? `MMW / GalIC Bar-Unstable Disk Collapse (λ=${spinL.toFixed(3)} · m=2 bar)`
        : `MMW High-Spin Cooling Disk (λ=${spinL.toFixed(3)} · m=${armMode} spiral mode)`,
      delta, spinL, fGas, zRed, tiltX, tiltZ, armMode, barUnstable
    });
  }
  return Object.freeze({
    id: 'group-tidal-satellite',
    isMerger: false,
    label: `Group Disk + Infalling Satellite Perturber (δ=${delta.toFixed(2)} · λ=${spinL.toFixed(3)})`,
    delta, spinL, fGas, zRed, tiltX, tiltZ, armMode: 2 + (rand() < 0.5 ? 1 : 0)
  });
}

export function createRealisticSpiralGalaxyBodies({
  count = 32768,
  preset = 'disk',
  seed = 825,
  gravity = 1.0,
  softening = 0.65,
  centerOffset = [0, 0, 0],
  galaxyEnv = null,
  dmHaloMass = 2800.0,
  dmScaleRadius = 6.8,
  dmConcentration = 8.8
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
  const dmExtM = Math.max(0, Number(dmHaloMass) || 0);
  const dmExtRs = Math.max(1.5, Number(dmScaleRadius) || 6.8);
  const dmExtC = Math.max(3.0, Number(dmConcentration) || 8.8);
  const dmExtNorm = Math.max(1e-4, Math.log(1 + dmExtC) - dmExtC / (1 + dmExtC));
  const dmExtSoft2 = 1.60 * 1.60;
  const evalExtNfwAccel = (r, mScale = 1.0) => {
    if (dmExtM * mScale <= 1e-4) return 0;
    const rSafe = Math.sqrt(r * r + dmExtSoft2);
    const x = rSafe / dmExtRs;
    const mEnc = (dmExtM * mScale) * Math.max(0, Math.log(1 + x) - x / (1 + x)) / dmExtNorm;
    return (gravity * mEnc * r) / (rSafe * rSafe * rSafe);
  };

  const populateSingleGalaxy = (start, end, cx, cy, cz, cvx, cvy, cvz, tiltX, tiltZ, scaleR = 1.0, dmScale = 1.0) => {
    const subN = end - start;
    // Physically calibrated baryon + dark-matter galaxy matched 1-to-1 to live GPU (SS Multipole + NFW + SMBH):
    const mSmbh = 44.0 * scaleR;
    const mBulgeTotal = 135.0 * scaleR;
    const mDiskTotal = 290.0 * scaleR;
    const mDmTotal = 620.0 * scaleR;
    const aBulge = 1.25 * scaleR;
    const rDisk = 3.2 * scaleR;
    const aDm = 7.2 * scaleR;
    const meshSoft = 0.95 * scaleR;
    const smbhSoft = 0.75 * scaleR;

    const enclosedAccel = (r) => {
      const rSafe = Math.max(0.15 * scaleR, r);
      const aSmbh = (gravity * mSmbh * rSafe) / Math.pow(rSafe * rSafe + smbhSoft * smbhSoft, 1.5);
      const rEff = Math.hypot(rSafe, meshSoft);
      const mb = mBulgeTotal * (rSafe * rSafe) / ((rSafe + aBulge) * (rSafe + aBulge));
      const x = rSafe / rDisk;
      const md = mDiskTotal * (1 - (1 + x) * Math.exp(-x));
      const mdm = mDmTotal * (rSafe * rSafe) / ((rSafe + aDm) * (rSafe + aDm));
      const aMesh = (gravity * (mb + md + mdm) * rSafe) / (rEff * rEff * rEff);
      const aNfw = evalExtNfwAccel(rSafe, dmScale);
      return aSmbh + aMesh + aNfw;
    };
    const vCircAt = (r) => Math.sqrt(Math.max(0, r * enclosedAccel(r)));

    const cTx = Math.cos(tiltX); const sTx = Math.sin(tiltX);
    const cTz = Math.cos(tiltZ); const sTz = Math.sin(tiltZ);
    const rot = (x, y, z) => {
      const y1 = y * cTx - z * sTx;
      const z1 = y * sTx + z * cTx;
      return [x * cTz - y1 * sTz, x * sTz + y1 * cTz, z1];
    };

    // Index start = central SMBH mass anchor
    bodies.set([cx + ox, cy + oy, cz + oz, mSmbh, cvx, cvy, cvz, 0.05], start * 8);

    const nDm = Math.floor((subN - 1) * 0.36);
    const nBulge = Math.floor((subN - 1) * 0.14);
    const nHaloStars = Math.floor((subN - 1) * 0.04);
    const nDisk = (subN - 1) - nDm - nBulge - nHaloStars;

    const dmEach = mDmTotal / Math.max(1, nDm);
    const bulgeEach = mBulgeTotal / Math.max(1, nBulge + nHaloStars);
    const diskEach = mDiskTotal / Math.max(1, nDisk);

    let cursor = start + 1;

    // 1. Hernquist Dark-Matter Halo particles (popTag = -1.0 -> invisible, real GPU gravity!)
    for (let i = 0; i < nDm && cursor < end; i += 1, cursor += 1) {
      const u = Math.max(0.01, Math.min(0.88, rand()));
      const r = Math.min(18.5 * scaleR, aDm * Math.sqrt(u) / Math.max(0.08, 1 - Math.sqrt(u)));
      const cosP = 2 * rand() - 1;
      const sinP = Math.sqrt(Math.max(0, 1 - cosP * cosP));
      const phi = 2 * Math.PI * rand();
      const lx = r * sinP * Math.cos(phi);
      const ly = r * cosP;
      const lz = r * sinP * Math.sin(phi);
      // Jeans isotropic dispersion matched to actual mesh+SMBH potential (virialized 2K + U ~ 0)
      const sigmaV = vCircAt(r) * 0.56;
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
      const u = Math.max(0.005, Math.min(0.92, rand()));
      const aScale = isHalo ? aBulge * 4.0 : aBulge;
      const r = Math.min(11.5 * scaleR, aScale * Math.sqrt(u) / Math.max(0.07, 1 - Math.sqrt(u)));
      const cosP = 2 * rand() - 1;
      const sinP = Math.sqrt(Math.max(0, 1 - cosP * cosP));
      const phi = 2 * Math.PI * rand();
      const lx = r * sinP * Math.cos(phi);
      const ly = r * cosP * (isHalo ? 0.85 : 0.62);
      const lz = r * sinP * Math.sin(phi);
      const vCirc = vCircAt(r);
      const disp = vCirc * (isHalo ? 0.50 : 0.36);
      const spinFrac = isHalo ? 0.18 : 0.62;
      const vx = -Math.sin(phi) * vCirc * spinFrac + gauss() * disp;
      const vy = gauss() * disp * 0.68;
      const vz = Math.cos(phi) * vCirc * spinFrac + gauss() * disp;
      const pR = rot(lx, ly, lz);
      const vR = rot(vx, vy, vz);
      const popTag = isHalo ? (0.24 + rand() * 0.10) : (0.02 + Math.min(0.28, (r / (2.6 * scaleR)) * 0.24));
      bodies.set([
        cx + pR[0] + ox, cy + pR[1] + oy, cz + pR[2] + oz, bulgeEach,
        cvx + vR[0], cvy + vR[1], cvz + vR[2], popTag
      ], cursor * 8);
    }

    // 3. Toomre-Stable Exponential Disk with Smooth Logarithmic Spiral Arms & H II Star-Forming Knots
    const pitchTan = Math.tan((17 * Math.PI) / 180);
    for (; cursor < end; cursor += 1) {
      const rRaw = -rDisk * Math.log(Math.max(1e-4, rand() * rand()));
      const r = Math.max(0.32 * scaleR, Math.min(11.5 * scaleR, rRaw * 0.78));
      const armStrength = Math.min(1.0, Math.max(0.0, (r - 0.75 * scaleR) / (2.0 * scaleR)));
      const isArmStar = rand() < (0.72 * armStrength);
      let theta;
      let popTag;
      if (isArmStar) {
        const armIdx = (cursor & 3);
        const isPrimary = (armIdx & 1) === 0;
        const armBase = (armIdx * Math.PI) * 0.5 + (isPrimary ? 0 : 0.22);
        const logSpiral = Math.log(1.0 + r / (0.65 * scaleR)) / pitchTan;
        const armWidth = (isPrimary ? 0.26 : 0.36) + 0.022 * (r / scaleR);
        theta = armBase + logSpiral + gauss() * armWidth;
        const isH2 = rand() < 0.11 && r > 1.4 * scaleR && r < 8.5 * scaleR;
        popTag = isH2 ? (0.82 + rand() * 0.22) : (0.38 + rand() * 0.38);
      } else {
        theta = rand() * Math.PI * 2;
        popTag = 0.08 + rand() * 0.26;
      }
      const zH = (0.14 + 0.028 * (r / scaleR)) * scaleR;
      const lx = r * Math.cos(theta);
      const lz = r * Math.sin(theta);
      const ly = gauss() * zH;
      const vCirc = vCircAt(r);
      // Asymmetric-drift correction + Toomre Q >= 1.5 radial/vertical epicyclic stability!
      const vAz = vCirc * 0.985;
      const sigR = vCirc * (0.08 + 0.05 * Math.exp(-r / rDisk));
      const sigZ = vCirc * 0.045;
      const vRad = gauss() * sigR;
      const vTan = vAz + gauss() * (sigR * 0.72);
      const vx = Math.cos(theta) * vRad - Math.sin(theta) * vTan;
      const vy = gauss() * sigZ;
      const vz = Math.sin(theta) * vRad + Math.cos(theta) * vTan;
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
    // Bound elliptical Toomre merger orbit matched to mutual (NFW + stellar) halo attraction!
    const sepB = 12.0;
    const mEffPair = Math.max(900, dmExtM * 0.65 + 750);
    const vOrbPair = Math.sqrt((gravity * mEffPair) / sepB) * 0.44;
    const vInPair = vOrbPair * 0.34;
    populateSingleGalaxy(0, half, -5.8, 0.7, -1.6, vInPair, -0.25, vOrbPair, 0.35, 0.18, 0.68, 1.0);
    populateSingleGalaxy(half, n, 5.8, -0.7, 1.6, -vInPair, 0.25, -vOrbPair, -0.42, -0.25, 0.68, 0.85);
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
  } else if (preset === 'ring') {
    // Cartwheel Collisional Ring Galaxy (ESO 350-40): golden central core + inner ring + radial dust/star spokes + blazing outer OB/H II starburst ring!
    const nDm = Math.floor((n - 1) * 0.30);
    const nCore = Math.floor((n - 1) * 0.22);
    const nSpokes = Math.floor((n - 1) * 0.16);
    const nOuter = (n - 1) - nDm - nCore - nSpokes;
    bodies.set([ox, oy, oz, 52.0, 0, 0, 0, 0.05], 0);
    let c = 1;
    for (let i = 0; i < nDm && c < n; i += 1, c += 1) {
      const u = Math.max(0.01, Math.min(0.88, rand()));
      const r = Math.min(18.0, 7.2 * Math.sqrt(u) / Math.max(0.08, 1 - Math.sqrt(u)));
      const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
      const sig = Math.sqrt((gravity * 1100.0) / Math.hypot(r, 1.8)) * 0.52;
      bodies.set([r * sy * Math.cos(th) + ox, r * cy + oy, r * sy * Math.sin(th) + oz, 780.0 / nDm, gauss() * sig, gauss() * sig, gauss() * sig, -1.0], c * 8);
    }
    for (let i = 0; i < nCore && c < n; i += 1, c += 1) {
      const inInnerRing = rand() < 0.45;
      const r = inInnerRing ? (2.0 + gauss() * 0.34) : (Math.pow(rand(), 0.65) * 1.65);
      const th = rand() * Math.PI * 2;
      const vCirc = Math.sqrt((gravity * (52 + 240 * Math.min(1, r / 3.0) + 780 * r * r / ((r + 7.2) ** 2))) / Math.hypot(r, 0.7));
      bodies.set([Math.cos(th) * r + ox, gauss() * 0.24 + oy, Math.sin(th) * r + oz, 160.0 / nCore, -Math.sin(th) * vCirc + gauss() * 0.4, gauss() * 0.2, Math.cos(th) * vCirc + gauss() * 0.4, 0.04 + Math.min(0.28, r * 0.11)], c * 8);
    }
    for (let i = 0; i < nSpokes && c < n; i += 1, c += 1) {
      // 7 sweeping curved radial spokes connecting inner golden hub to outer blue starburst ring!
      const spIdx = i % 7;
      const f = rand();
      const r = 2.1 + f * 6.4;
      const th = (spIdx / 7) * Math.PI * 2 + f * 0.72 + gauss() * 0.09;
      const vCirc = Math.sqrt((gravity * (360 + 780 * r * r / ((r + 7.2) ** 2))) / Math.hypot(r, 0.8));
      bodies.set([Math.cos(th) * r + ox, gauss() * 0.14 + oy, Math.sin(th) * r + oz, 95.0 / nSpokes, -Math.sin(th) * vCirc, gauss() * 0.14, Math.cos(th) * vCirc, 0.18 + f * 0.34], c * 8);
    }
    for (let i = 0; i < nOuter && c < n; i += 1, c += 1) {
      // Blazing expanding collisional outer OB starburst + H II ring (r ~ 8.6)
      const r = 8.4 + gauss() * 0.62;
      const th = rand() * Math.PI * 2;
      const vCirc = Math.sqrt((gravity * (450 + 780 * r * r / ((r + 7.2) ** 2))) / Math.hypot(r, 0.9));
      const isH2 = rand() < 0.24;
      bodies.set([Math.cos(th) * r + ox, gauss() * 0.16 + oy, Math.sin(th) * r + oz, 220.0 / nOuter, -Math.sin(th) * vCirc + Math.cos(th) * 0.35, gauss() * 0.16, Math.cos(th) * vCirc + Math.sin(th) * 0.35, isH2 ? (0.84 + rand() * 0.22) : (0.50 + rand() * 0.26)], c * 8);
    }
  } else if (preset === 'lenticular') {
    // S0 Lenticular Galaxy (Sombrero M104 / NGC 5866): luminous golden-amber bulge + smooth quenched axisymmetric disk + faint outer dust ring!
    populateSingleGalaxy(0, n, 0, 0, 0, 0, 0, 0, 0.26, 0.0, 0.96);
    for (let i = 1; i < n; i += 1) {
      const o = i * 8;
      if (bodies[o + 7] < 0) continue; // preserve DM halo
      const r = Math.hypot(bodies[o] - ox, bodies[o + 2] - oz);
      // Erase spiral-arm density contrast -> smooth axisymmetric S0 golden disk + subtle dust-lane rim
      const th = rand() * Math.PI * 2;
      const vx0 = bodies[o + 4]; const vz0 = bodies[o + 6];
      const vMag = Math.hypot(vx0, vz0);
      bodies[o + 0] = Math.cos(th) * r + ox;
      bodies[o + 2] = Math.sin(th) * r + oz;
      bodies[o + 4] = -Math.sin(th) * vMag;
      bodies[o + 6] = Math.cos(th) * vMag;
      bodies[o + 7] = Math.min(0.32, 0.04 + (r / 11.0) * 0.28); // quenched golden Pop II/K-G stars
    }
  } else if (preset === 'irregular') {
    // Magellanic / M82 Starburst Irregular Galaxy: asymmetric off-center bar, turbulent clumpy OB/H II nurseries & bipolar starburst plumes!
    const nDm = Math.floor((n - 1) * 0.28);
    bodies.set([ox, oy, oz, 18.0, 0, 0, 0, 0.08], 0);
    let c = 1;
    for (let i = 0; i < nDm && c < n; i += 1, c += 1) {
      const u = Math.max(0.01, Math.min(0.88, rand()));
      const r = Math.min(14.0, 5.5 * Math.sqrt(u) / Math.max(0.09, 1 - Math.sqrt(u)));
      const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
      bodies.set([r * sy * Math.cos(th) + ox, r * cy + oy, r * sy * Math.sin(th) + oz, 420.0 / nDm, gauss() * 2.2, gauss() * 2.2, gauss() * 2.2, -1.0], c * 8);
    }
    const knots = [
      [-3.4, 0.2, -1.2], [-1.4, -0.3, 1.3], [0.9, 0.1, -0.8], [3.2, -0.2, 1.5],
      [-5.1, 0.4, 1.8], [4.9, 0.3, -1.9], [-2.0, -0.1, -2.8], [1.9, 0.2, 2.7]
    ];
    for (; c < n; c += 1) {
      const isOutflow = (c % 5) === 0;
      let px; let py; let pz; let pop; let vyAdd = 0;
      if (isOutflow) {
        // Flaring M82 starburst biconical H-alpha superwind filaments (tilted 14 deg, wide feathery cones!)
        const signY = (c & 1) === 0 ? 1 : -1;
        const h = Math.pow(rand(), 0.72) * 5.2;
        const coneR = 0.65 + h * (0.48 + 0.32 * rand());
        const th = rand() * Math.PI * 2;
        px = Math.cos(th) * coneR + signY * h * 0.22 + gauss() * 0.45;
        py = signY * (0.4 + h);
        pz = Math.sin(th) * coneR * 0.78 + gauss() * 0.45;
        pop = 0.80 + rand() * 0.26;
        vyAdd = signY * (1.2 + rand() * 1.4);
      } else {
        const k = knots[c % knots.length];
        const rr = Math.pow(rand(), 0.52) * 2.85;
        const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
        px = k[0] + rr * sy * Math.cos(th) * 1.45;
        py = k[1] + rr * cy * 0.58 + px * 0.12;
        pz = k[2] + rr * sy * Math.sin(th) * 1.05;
        pop = rand() < 0.22 ? (0.80 + rand() * 0.24) : (rand() < 0.62 ? (0.40 + rand() * 0.34) : (0.12 + rand() * 0.22));
      }
      const rC = Math.max(0.5, Math.hypot(px, pz));
      const vRot = Math.sqrt((gravity * 320.0) / Math.hypot(rC, 1.2));
      bodies.set([
        px + ox, py + oy, pz + oz, 260.0 / (n - nDm),
        (-pz / rC) * vRot * 0.65 + gauss() * 1.35,
        vyAdd + gauss() * 0.95,
        (px / rC) * vRot * 0.65 + gauss() * 1.35,
        pop
      ], c * 8);
    }
  } else if (preset === 'open-cluster') {
    // Pleiades (M45) Open Cluster + Sapphire Reflection Dust Veil: loose young blue B-type stars + organic wispy reflection nebulosity!
    const mTot = 240.0;
    const mEach = mTot / n;
    bodies.set([ox, oy, oz, 4.0, 0, 0, 0, 0.66], 0);
    // 7 iconic bright B-star sub-knots surrounded by wispy sapphire dust sheets!
    const sisters = [
      [0.0, 0.2, 0.0], [-2.6, 0.6, -1.4], [2.4, -0.5, -1.7], [-1.8, -0.7, 2.5],
      [3.3, 0.8, 2.0], [-4.1, -0.2, 0.9], [0.9, 1.4, -3.3]
    ];
    for (let i = 1; i < n; i += 1) {
      const sis = sisters[i % sisters.length];
      const isVeil = i > n * 0.32;
      let px; let py; let pz;
      if (isVeil) {
        // Organic elliptical striated blue reflection dust filaments (zero sharp rectangular box corners!)
        const rr = Math.sqrt(rand()) * 7.8;
        const ang = rand() * Math.PI * 2;
        const u = Math.cos(ang) * rr * 1.15;
        const v = Math.sin(ang) * rr * 0.88;
        const strand = Math.sin(u * 0.95 + v * 0.35 + (i % 5)) * 0.85;
        px = u + strand * 0.55;
        py = Math.sin(u * 0.55 + (i % 4)) * 1.25 + gauss() * 0.85;
        pz = v + Math.cos(u * 0.45) * 0.95;
      } else {
        const rr = Math.pow(rand(), 0.72) * 2.2;
        const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
        px = sis[0] + rr * sy * Math.cos(th);
        py = sis[1] + rr * cy;
        pz = sis[2] + rr * sy * Math.sin(th);
      }
      const rMag = Math.max(0.4, Math.hypot(px, py, pz));
      const sig = Math.sqrt((gravity * 160.0) / Math.hypot(rMag, 1.4)) * 0.38;
      bodies.set([
        px + ox, py + oy, pz + oz, mEach,
        gauss() * sig, gauss() * sig, gauss() * sig,
        isVeil ? (0.48 + rand() * 0.24) : (0.64 + rand() * 0.13)
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
  } else if (preset === 'coalesce') {
    // Research-Grounded Cosmological Protogalactic Halo Initial Conditions!
    // Driven strictly by the L0 cosmic halo's (delta, spinLambda, gasFraction, redshiftZ, seed) —
    // ZERO identical template across halos!
    const ic = describeCosmologicalGalaxyIcRegime(galaxyEnv, seed);
    const cTx = Math.cos(ic.tiltX); const sTx = Math.sin(ic.tiltX);
    const cTz = Math.cos(ic.tiltZ); const sTz = Math.sin(ic.tiltZ);
    const rotIc = (x, y, z) => {
      const y1 = y * cTx - z * sTx;
      const z1 = y * sTx + z * cTx;
      return [x * cTz - y1 * sTz, x * sTz + y1 * cTz, z1];
    };

    if (ic.id === 'toomre-merger' || ic.id === 'bullseye-ring-impact') {
      // Toomre & Toomre (1972) / Hopkins+ (2009) Major/Minor Merger OR Bullseye Polar Ring Impact!
      const mu = ic.massRatio || 0.72;
      const n1 = Math.max(256, Math.min(n - 256, Math.floor(n / (1 + mu))));
      const sep = ic.id === 'bullseye-ring-impact' ? 10.5 : (11.2 + rand() * 3.8);
      const bOff = sep * (ic.impactParam || 0.28);
      const vApproach = ic.id === 'bullseye-ring-impact' ? 2.85 : (1.55 + rand() * 0.65);
      const signOrb = ic.isPrograde ? 1.0 : -1.0;
      const rSc1 = 0.76;
      const rSc2 = Math.max(0.42, 0.76 * Math.pow(mu, 0.36));
      if (ic.id === 'bullseye-ring-impact') {
        // Primary flat disk + dense bullet companion plunging vertically through center (Cartwheel genesis!)
        populateSingleGalaxy(0, n1, 0, -1.2, 0, 0, 0.35, 0, ic.tiltX * 0.45, ic.tiltZ * 0.45, rSc1);
        populateSingleGalaxy(n1, n, bOff * 0.6, sep * 0.78, bOff * 0.4, -0.25, -vApproach, -0.15, 1.15, -0.45, rSc2);
      } else {
        // Grazing prograde/retrograde encounter with unique mutual disk tilts!
        const x1 = -sep * 0.5 * (mu / (1 + mu));
        const x2 = sep * 0.5 * (1 / (1 + mu));
        const z1 = -bOff * 0.5;
        const z2 = bOff * 0.5;
        const v1x = vApproach * (mu / (1 + mu));
        const v2x = -vApproach * (1 / (1 + mu));
        const v1z = signOrb * (0.95 + rand() * 0.45) * (mu / (1 + mu));
        const v2z = -signOrb * (0.95 + rand() * 0.45) * (1 / (1 + mu));
        populateSingleGalaxy(0, n1, x1, 0.8, z1, v1x, -0.18, v1z, ic.tiltX, ic.tiltZ, rSc1);
        populateSingleGalaxy(n1, n, x2, -0.8, z2, v2x, 0.18, v2z, -ic.tiltX * 0.8 + 0.55, -ic.tiltZ * 0.7 - 0.35, rSc2);
      }
    } else if (ic.id === 'cold-streams') {
      // Dekel & Birnboim (2006) / Dekel+ (2009): 3-4 narrow cold cosmic-web filaments feeding a clumpy high-z starburst core!
      const nDm = Math.floor((n - 1) * 0.30);
      bodies.set([ox, oy, oz, 28.0, 0, 0, 0, 0.08], 0);
      let c = 1;
      for (let i = 0; i < nDm && c < n; i += 1, c += 1) {
        const u = Math.max(0.01, Math.min(0.88, rand()));
        const r = Math.min(18.5, 7.2 * Math.sqrt(u) / Math.max(0.08, 1 - Math.sqrt(u)));
        const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
        const sig = Math.sqrt((gravity * 860.0) / Math.hypot(r, 1.8)) * 0.50;
        bodies.set([r * sy * Math.cos(th) + ox, r * cy * 0.82 + oy, r * sy * Math.sin(th) + oz, 780.0 / nDm, gauss() * sig, gauss() * sig, gauss() * sig, -1.0], c * 8);
      }
      const nStreams = ic.nStreams || 3;
      const streamDirs = Array.from({ length: nStreams }, (_, sIdx) => {
        const ang = (sIdx / nStreams) * Math.PI * 2 + (rand() - 0.5) * 0.55;
        const elev = (rand() - 0.5) * 0.72;
        return [Math.cos(ang) * Math.cos(elev), Math.sin(elev), Math.sin(ang) * Math.cos(elev)];
      });
      const nBary = n - c;
      const nCore = Math.floor(nBary * 0.24);
      const mEach = 440.0 / Math.max(1, nBary);
      for (let k = 0; c < n; c += 1, k += 1) {
        let lx; let ly; let lz; let lvx; let lvy; let lvz; let pop;
        if (k < nCore) {
          // Luminous central Hernquist proto-bulge / nuclear core anchored at the dark-matter halo center!
          const u = Math.max(0.002, Math.min(0.86, rand()));
          const rCore = Math.min(3.2, 0.92 * Math.sqrt(u) / Math.max(0.12, 1 - Math.sqrt(u)));
          const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
          lx = rCore * sy * Math.cos(th);
          ly = rCore * cy * 0.68;
          lz = rCore * sy * Math.sin(th);
          const vC = Math.sqrt((gravity * 1150.0) / Math.hypot(rCore, 0.85));
          lvx = -Math.sin(th) * vC * 0.58 + gauss() * 1.1;
          lvy = gauss() * 0.95;
          lvz = Math.cos(th) * vC * 0.58 + gauss() * 1.1;
          pop = 0.02 + Math.min(0.24, rCore * 0.08 + rand() * 0.05);
        } else if (rand() < 0.62) {
          const sd = streamDirs[k % nStreams];
          const sDist = 1.6 + Math.pow(rand(), 0.82) * 14.2;
          const tubeR = 0.55 + sDist * 0.075;
          const bOff = 0.65 + ic.spinL * 14.0; // Impact offset delivers real angular momentum from filament torque!
          const tangX = -sd[2]; const tangZ = sd[0];
          const tLen = Math.hypot(tangX, tangZ) || 1;
          lx = sd[0] * sDist + (tangX / tLen) * bOff + gauss() * tubeR;
          ly = sd[1] * sDist + gauss() * tubeR * 0.75;
          lz = sd[2] * sDist + (tangZ / tLen) * bOff + gauss() * tubeR;
          const vIn = Math.sqrt((gravity * 640.0) / Math.hypot(sDist, 2.0)) * 0.78;
          lvx = -sd[0] * vIn + (tangX / tLen) * (vIn * 0.24) + gauss() * 0.45;
          lvy = -sd[1] * vIn + gauss() * 0.40;
          lvz = -sd[2] * vIn + (tangZ / tLen) * (vIn * 0.24) + gauss() * 0.45;
          pop = rand() < 0.42 ? (0.82 + rand() * 0.22) : (0.50 + rand() * 0.30);
        } else {
          // Turbulent Jeans-unstable proto-disk & giant OB clumps at filament intersection
          const rr = 0.5 + Math.pow(rand(), 0.65) * 4.8;
          const th = rand() * Math.PI * 2;
          lx = Math.cos(th) * rr;
          ly = gauss() * (0.65 + 0.14 * rr);
          lz = Math.sin(th) * rr;
          const vC = Math.sqrt((gravity * 820.0) / Math.hypot(rr, 1.0));
          lvx = -Math.sin(th) * vC * 0.68 + gauss() * 1.15;
          lvy = gauss() * 0.95;
          lvz = Math.cos(th) * vC * 0.68 + gauss() * 1.15;
          pop = rand() < 0.35 ? (0.84 + rand() * 0.20) : (0.36 + rand() * 0.38);
        }
        const pR = rotIc(lx, ly, lz);
        const vR = rotIc(lvx, lvy, lvz);
        bodies.set([pR[0] + ox, pR[1] + oy, pR[2] + oz, mEach, vR[0], vR[1], vR[2], pop], c * 8);
      }
    } else if (ic.id === 'triaxial-relaxation') {
      // Jing & Suto (2002) / Naab+ (2007): Low-spin triaxial multi-subhalo violent relaxation around a luminous central elliptical core!
      const nDm = Math.floor((n - 1) * 0.32);
      bodies.set([ox, oy, oz, 72.0, 0, 0, 0, 0.05], 0);
      let c = 1;
      for (let i = 0; i < nDm && c < n; i += 1, c += 1) {
        const u = Math.max(0.01, Math.min(0.88, rand()));
        const r = Math.min(18.0, 7.0 * Math.sqrt(u) / Math.max(0.08, 1 - Math.sqrt(u)));
        const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
        const sig = Math.sqrt((gravity * 1200.0) / Math.hypot(r, 1.8)) * 0.55;
        const pR = rotIc(r * sy * Math.cos(th), r * cy * (ic.ca || 0.62), r * sy * Math.sin(th) * (ic.ba || 0.78));
        bodies.set([pR[0] + ox, pR[1] + oy, pR[2] + oz, 960.0 / nDm, gauss() * sig, gauss() * sig, gauss() * sig, -1.0], c * 8);
      }
      const nSub = ic.nSubhalos || 5;
      const subCenters = Array.from({ length: nSub }, (_, s) => {
        const a = (s / nSub) * Math.PI * 2 + rand() * 0.65;
        const rS = 3.8 + rand() * 5.8;
        const yS = (rand() - 0.5) * 4.2;
        return { pos: [Math.cos(a) * rS, yS, Math.sin(a) * rS], rad: 1.3 + rand() * 1.2 };
      });
      const nBary = n - c;
      const nCore = Math.floor(nBary * 0.32);
      const mEach = 560.0 / Math.max(1, nBary);
      for (let k = 0; c < n; c += 1, k += 1) {
        let lx; let ly; let lz; let lvx; let lvy; let lvz; let pop;
        if (k < nCore) {
          // Dense luminous central Hernquist elliptical core (de Vaucouleurs R^(1/4) profile) at halo center!
          const u = Math.max(0.002, Math.min(0.88, rand()));
          const rc = Math.min(4.8, 1.35 * Math.sqrt(u) / Math.max(0.10, 1 - Math.sqrt(u)));
          const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
          lx = rc * sy * Math.cos(th);
          ly = rc * cy * (ic.ca || 0.65);
          lz = rc * sy * Math.sin(th) * (ic.ba || 0.80);
          const sig = Math.sqrt((gravity * 1350.0) / Math.hypot(rc, 1.1)) * 0.42;
          lvx = gauss() * sig; lvy = gauss() * sig; lvz = gauss() * sig;
          pop = 0.02 + Math.min(0.22, (rc / 4.8) * 0.18 + rand() * 0.04);
        } else {
          const sub = subCenters[k % nSub];
          const u = Math.max(0.005, Math.min(0.90, rand()));
          const rl = Math.min(sub.rad * 2.1, sub.rad * 0.65 * Math.sqrt(u) / Math.max(0.10, 1 - Math.sqrt(u)));
          const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
          lx = sub.pos[0] + rl * sy * Math.cos(th);
          ly = sub.pos[1] + rl * cy * 0.8;
          lz = sub.pos[2] + rl * sy * Math.sin(th);
          const rTot = Math.max(1.0, Math.hypot(lx, ly, lz));
          // Strongly radial sub-virial infall + tiny spin -> violent relaxation merges subhalos into the core!
          const vIn = Math.sqrt((gravity * 1100.0) / Math.hypot(rTot, 1.8)) * 0.44;
          const vSpin = vIn * (0.12 + ic.spinL * 3.5);
          lvx = -(lx / rTot) * vIn - (lz / rTot) * vSpin + gauss() * 1.15;
          lvy = -(ly / rTot) * vIn + gauss() * 1.05;
          lvz = -(lz / rTot) * vIn + (lx / rTot) * vSpin + gauss() * 1.15;
          pop = 0.04 + Math.min(0.32, (rl / (sub.rad * 2.2)) * 0.28 + rand() * 0.08);
        }
        const pR = rotIc(lx, ly, lz);
        const vR = rotIc(lvx, lvy, lvz);
        bodies.set([pR[0] + ox, pR[1] + oy, pR[2] + oz, mEach, vR[0], vR[1], vR[2], pop], c * 8);
      }
    } else if (ic.id === 'void-dwarf-assembly') {
      // Low-overdensity Void Asymmetric Dwarf & Wrapping Satellite Tidal Stream Assembly!
      const nDm = Math.floor((n - 1) * 0.28);
      bodies.set([ox, oy, oz, 24.0, 0, 0, 0, 0.14], 0);
      let c = 1;
      for (let i = 0; i < nDm && c < n; i += 1, c += 1) {
        const u = Math.max(0.01, Math.min(0.88, rand()));
        const r = Math.min(14.5, 5.4 * Math.sqrt(u) / Math.max(0.09, 1 - Math.sqrt(u)));
        const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
        bodies.set([r * sy * Math.cos(th) + ox, r * cy + oy, r * sy * Math.sin(th) + oz, 480.0 / nDm, gauss() * 2.1, gauss() * 2.1, gauss() * 2.1, -1.0], c * 8);
      }
      const nClumps = ic.nClumps || 6;
      const clumps = Array.from({ length: nClumps }, (_, j) => {
        const a = rand() * Math.PI * 2;
        const rr = 1.4 + rand() * 5.2;
        return [Math.cos(a) * rr, (rand() - 0.5) * 2.0, Math.sin(a) * rr];
      });
      const nBary = n - c;
      const nCore = Math.floor(nBary * 0.22);
      const mEach = 280.0 / Math.max(1, nBary);
      for (let k = 0; c < n; c += 1, k += 1) {
        let lx; let ly; let lz; let lvx; let lvy; let lvz; let pop;
        if (k < nCore) {
          const u = Math.max(0.002, Math.min(0.86, rand()));
          const rc = Math.min(2.6, 0.85 * Math.sqrt(u) / Math.max(0.12, 1 - Math.sqrt(u)));
          const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
          lx = rc * sy * Math.cos(th); ly = rc * cy * 0.72; lz = rc * sy * Math.sin(th);
          const vC = Math.sqrt((gravity * 720.0) / Math.hypot(rc, 0.9));
          lvx = -Math.sin(th) * vC * 0.45 + gauss() * 0.95; lvy = gauss() * 0.85; lvz = Math.cos(th) * vC * 0.45 + gauss() * 0.95;
          pop = 0.08 + rand() * 0.24;
        } else if ((k % 4) === 0) {
          // Wrapping tidal accretion arc
          const sf = rand();
          const ang = -0.6 + sf * Math.PI * 1.9;
          const rArc = 6.2 + Math.sin(ang * 1.4) * 2.2;
          lx = Math.cos(ang) * rArc + gauss() * 0.55;
          ly = Math.sin(ang) * rArc * 0.62 + gauss() * 0.55;
          lz = Math.sin(ang + 0.9) * rArc * 0.52 + gauss() * 0.55;
          const vS = Math.sqrt((gravity * 480.0) / Math.max(1.5, Math.hypot(lx, ly, lz)));
          lvx = -Math.sin(ang) * vS * 0.72 + gauss() * 0.4;
          lvy = Math.cos(ang) * vS * 0.45 + gauss() * 0.4;
          lvz = Math.cos(ang + 0.9) * vS * 0.38 + gauss() * 0.4;
          pop = 0.42 + rand() * 0.36;
        } else {
          const cl = clumps[k % nClumps];
          const rr = Math.pow(rand(), 0.55) * 2.4;
          const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
          lx = cl[0] + rr * sy * Math.cos(th);
          ly = cl[1] + rr * cy * 0.72;
          lz = cl[2] + rr * sy * Math.sin(th);
          const rc = Math.max(0.6, Math.hypot(lx, lz));
          const vRot = Math.sqrt((gravity * 300.0) / Math.hypot(rc, 1.4)) * (0.45 + ic.spinL * 4.5);
          lvx = (-lz / rc) * vRot + gauss() * 1.25;
          lvy = gauss() * 0.95;
          lvz = (lx / rc) * vRot + gauss() * 1.25;
          pop = rand() < 0.28 ? (0.82 + rand() * 0.22) : (0.34 + rand() * 0.42);
        }
        const pR = rotIc(lx, ly, lz);
        const vR = rotIc(lvx, lvy, lvz);
        bodies.set([pR[0] + ox, pR[1] + oy, pR[2] + oz, mEach, vR[0], vR[1], vR[2], pop], c * 8);
      }
    } else {
      // Mo, Mao & White (1998) / Yurin & Springel (2014 GalIC) High-Spin Cooling Disk (Bar-Unstable OR Multi-Arm Spiral)
      // OR Group Disk + Infalling Tidal Satellite Perturber (M51-style)!
      const isSat = ic.id === 'group-tidal-satellite';
      const nDm = Math.floor((n - 1) * 0.34);
      const rScaleSpin = Math.max(0.68, Math.min(1.38, 0.58 + ic.spinL * 10.5)); // MMW R_d ~ lambda * R_vir!
      const armM = ic.armMode || 2;
      const twistSign = rand() < 0.5 ? 1.0 : -1.0;
      const pitchK = 0.24 + rand() * 0.36;
      const phase0 = rand() * Math.PI * 2;
      bodies.set([ox, oy, oz, 36.0, 0, 0, 0, 0.06], 0);
      let c = 1;
      for (let i = 0; i < nDm && c < n; i += 1, c += 1) {
        const u = Math.max(0.01, Math.min(0.90, rand()));
        const r = Math.min(18.5, 7.4 * Math.sqrt(u) / Math.max(0.08, 1 - Math.sqrt(u)));
        const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
        const sig = Math.sqrt((gravity * 840.0) / Math.hypot(r, 1.8)) * 0.50;
        bodies.set([r * sy * Math.cos(th) + ox, r * cy + oy, r * sy * Math.sin(th) + oz, 780.0 / nDm, gauss() * sig, gauss() * sig, gauss() * sig, -1.0], c * 8);
      }
      const nBary = n - c;
      const nCore = Math.floor(nBary * 0.22);
      const nSat = isSat ? Math.floor(nBary * 0.14) : 0;
      const satPos = [8.2 * rScaleSpin, 2.1, -3.6 * rScaleSpin];
      const mEach = 440.0 / Math.max(1, nBary);
      for (let k = 0; c < n; c += 1, k += 1) {
        let lx; let ly; let lz; let lvx; let lvy; let lvz; let pop;
        if (k < nCore) {
          // Dense luminous central Hernquist Galactic Bulge / Core!
          const u = Math.max(0.002, Math.min(0.86, rand()));
          const rc = Math.min(3.0 * rScaleSpin, 0.95 * rScaleSpin * Math.sqrt(u) / Math.max(0.11, 1 - Math.sqrt(u)));
          const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
          lx = rc * sy * Math.cos(th); ly = rc * cy * 0.58; lz = rc * sy * Math.sin(th);
          const vC = Math.sqrt((gravity * 1250.0) / Math.hypot(rc, 0.85));
          lvx = -Math.sin(th) * vC * 0.62 * twistSign + gauss() * 0.95;
          lvy = gauss() * 0.78;
          lvz = Math.cos(th) * vC * 0.62 * twistSign + gauss() * 0.95;
          pop = 0.02 + Math.min(0.22, (rc / (3.0 * rScaleSpin)) * 0.18 + rand() * 0.04);
        } else if (k < nCore + nSat) {
          // Infalling M51-style satellite perturber exciting dramatic tidal grand-design arms!
          const rr = Math.pow(rand(), 0.65) * 1.55;
          const cy = 2 * rand() - 1; const sy = Math.sqrt(Math.max(0, 1 - cy * cy)); const th = rand() * Math.PI * 2;
          lx = satPos[0] + rr * sy * Math.cos(th);
          ly = satPos[1] + rr * cy * 0.7;
          lz = satPos[2] + rr * sy * Math.sin(th);
          lvx = -1.65 + gauss() * 0.55;
          lvy = -0.65 + gauss() * 0.45;
          lvz = 3.15 + gauss() * 0.55;
          pop = 0.12 + rand() * 0.28;
        } else {
          const rRaw = (0.9 + Math.pow(rand(), 0.62) * 11.4) * rScaleSpin;
          const th = rand() * Math.PI * 2;
          const mPert = ic.barUnstable
            ? (1.0 + 0.26 * Math.cos(2.0 * (th - phase0)) * Math.exp(-rRaw / (4.8 * rScaleSpin)))
            : (1.0 + 0.20 * Math.cos(armM * (th - phase0) - twistSign * rRaw * pitchK));
          const r = Math.min(14.5, rRaw * mPert);
          const zThick = (ic.barUnstable ? 0.55 : 0.95) * (0.65 + 0.16 * r);
          lx = Math.cos(th) * r;
          ly = (rand() - 0.5) * 2.0 * zThick;
          lz = Math.sin(th) * r;
          const vCirc = Math.sqrt((gravity * (290 + 780 * r * r / ((r + 7.4) ** 2))) / Math.hypot(r, 1.2));
          const vRotFrac = Math.max(0.62, Math.min(0.98, 0.66 + ic.spinL * 4.0));
          const vTan = vCirc * vRotFrac * twistSign;
          const vIn = -vCirc * (ic.barUnstable ? 0.22 : 0.14);
          lvx = Math.cos(th) * vIn - Math.sin(th) * vTan + gauss() * (ic.barUnstable ? 0.42 : 0.58);
          lvy = -ly * 0.22 + gauss() * 0.42;
          lvz = Math.sin(th) * vIn + Math.cos(th) * vTan + gauss() * (ic.barUnstable ? 0.42 : 0.58);
          const isOldBulge = r < 2.2 * rScaleSpin && rand() < 0.58;
          const isNursery = !isOldBulge && rand() < (0.14 + ic.fGas * 0.42);
          pop = isOldBulge ? (0.04 + rand() * 0.22) : (isNursery ? (0.80 + rand() * 0.24) : (0.34 + rand() * 0.42));
        }
        const pR = rotIc(lx, ly, lz);
        const vR = rotIc(lvx, lvy, lvz);
        bodies.set([pR[0] + ox, pR[1] + oy, pR[2] + oz, mEach, vR[0], vR[1], vR[2], pop], c * 8);
      }
    }
  } else {
    populateSingleGalaxy(0, n, 0, 0, 0, 0, 0, 0, 0, 0, 1.0);
  }

  // Exact Center-of-Mass & Zero-Momentum Rest-Frame Initialization across ALL 12 galaxy morphologies:
  // eliminates asymmetric subhalo / merger / random-draw initial COM offset & linear momentum drift!
  {
    let mTot = 0;
    let cx = 0; let cy = 0; let cz = 0;
    let vx = 0; let vy = 0; let vz = 0;
    for (let i = 0; i < n; i += 1) {
      const o = i * 8;
      const m = bodies[o + 3];
      if (m > 0) {
        mTot += m;
        cx += (bodies[o] - ox) * m;
        cy += (bodies[o + 1] - oy) * m;
        cz += (bodies[o + 2] - oz) * m;
        vx += bodies[o + 4] * m;
        vy += bodies[o + 5] * m;
        vz += bodies[o + 6] * m;
      }
    }
    if (mTot > 1e-6) {
      cx /= mTot; cy /= mTot; cz /= mTot;
      vx /= mTot; vy /= mTot; vz /= mTot;
      for (let i = 0; i < n; i += 1) {
        const o = i * 8;
        bodies[o] -= cx;
        bodies[o + 1] -= cy;
        bodies[o + 2] -= cz;
        bodies[o + 4] -= vx;
        bodies[o + 5] -= vy;
        bodies[o + 6] -= vz;
      }
    }
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
  qualityId = 'auto',
  capabilityProfile = null,
  rawCapabilities = null,
  initialElementZ = 26
} = {}) {
  let universeSeed = seed >>> 0;
  let qualityMode = (qualityId === 'auto' || QUALITY_PRESETS[qualityId]) ? qualityId : 'auto';
  const baseCapabilities = rawCapabilities || capabilityProfile?.capabilities || null;
  let activeCapabilityProfile = capabilityProfile
    || buildPeerComputeSimulationProfile(baseCapabilities || {}, { device, qualityMode });
  let quality = QUALITY_PRESETS[activeCapabilityProfile.qualityId] || QUALITY_PRESETS.med;
  const getWorkloads = () => activeCapabilityProfile.workloads;

  const artifactCache = new ArtifactCache();
  const closureRegistry = new ClosureRegistry({ artifactCache });
  // Root-node multiscale cache (Memory + OPFS/IndexedDB + PeerCompute P2P sync) so computed
  // L0 halos, L2 coalesced star systems, and L4 SPH geologies never need redundant re-simulation!
  const rootLineageCache = createCosmicLineageRootCache();
  registerAllTopDownLawModules(defaultSimulationModuleRegistry);
  registerPlanetaryGenesisSphModule(defaultSimulationModuleRegistry);
  registerNebularSystemCoalescenceModule(defaultSimulationModuleRegistry);
  const bundleCache = new Map();
  const planetaryAtlasCache = new Map();

  // Cosmic Epoch Spine (`z = 1100 -> 0 -> +5 Gyr`): second orthogonal physical axis!
  let cosmicEpochId = 'present-day';
  let cosmicEpoch = evaluateCosmicEpochState({ redshiftZ: 0.0, localSystemAgeGyr: 4.57, localStarMassSolar: 1.0 });

  // Full Top-Down Causal Cascade State (L0 Cosmic Web -> L1 Galaxy -> L2 Nebular Star System -> L3/L4 -> L5..L7!)
  let activeGalaxyEnv = deriveGalaxyEnvironmentFromCosmicContext({
    cosmicEpoch,
    regionPosMpc: [0, 0, 0],
    localOverdensity: 1.15,
    seed: universeSeed
  });
  let activeStarSite = { posGal: [4.8, 0.04, 2.1], popTag: 0.52, starIndex: 0 };
  let useSolReference = false;
  let activeCausalSystem = synthesizeNebularPlanetarySystem(
    deriveStarSystemFromGalacticLocation({
      cosmicEpoch,
      galaxyEnv: activeGalaxyEnv,
      starPosGal: activeStarSite.posGal,
      popTag: activeStarSite.popTag,
      starIndex: activeStarSite.starIndex,
      seed: universeSeed
    })
  );
  function getActiveSystemCatalog() {
    if (useSolReference) return REAL_SOLAR_SYSTEM_CATALOG;
    return activeCausalSystem?.catalog?.length ? activeCausalSystem.catalog : REAL_SOLAR_SYSTEM_CATALOG;
  }
  function getDefaultPlanetIndex(cat = getActiveSystemCatalog()) {
    const earthLike = cat.findIndex((b) => b.planetClass === 'earth-like' || b.id === 'earth');
    if (earthLike > 0) return earthLike;
    const firstPlanet = cat.findIndex((b) => !b.isStar && b.kind !== 0);
    return firstPlanet > 0 ? firstPlanet : 0;
  }

  // Level 0: IllustrisTNG / Millennium-Style 2LPT Supergalactic Cosmic Web + Baryon/CMB/Reionization/Cluster-Lensing
  // Live 40-OOM Canonical Schroeder Simulation (`SS`) Multi-Chart Scale Atlas spanning L0 (+82, 10^+25 m) -> L7 (-49, 10^-15 m)!
  const SCHROEDER_SCALE_SPECS = Object.freeze({
    0: { level: 82, label: 'L0-cosmic-web', parentKey: null },
    1: { level: 69, label: 'L1-galactic-halo', parentKey: 0 },
    2: { level: 42, label: 'L2-star-system', parentKey: 1 },
    3: { level: 31, label: 'L3-stellar-core', parentKey: 2 },
    4: { level: 23, label: 'L4-planetary-world', parentKey: 2 },
    surface: { level: 4, label: 'L4-planetary-surface', parentKey: 4 },
    5: { level: -28, label: 'L5-crystal-md', parentKey: 'surface' },
    6: { level: -33, label: 'L6-quantum-atom', parentKey: 5 },
    7: { level: -49, label: 'L7-atomic-nucleus', parentKey: 6 }
  });
  const schroederAtlasRuntime = createDynamicSchroederScaleAtlasRuntime({
    referenceSpacingM: 1.0,
    rootGlobalBaseLevel: 82,
    rootLocalMinLevel: 0,
    rootLocalMaxLevel: 2,
    rootLabel: 'L0-cosmic-web',
    maxActiveCharts: 64,
    minIdleEpochsBeforeRetire: 128
  });
  const schroederChartIds = new Map([[0, 0]]);
  let activeSchroederKey = 0;
  let activeSchroederChartId = 0;
  const lawGraphValidation = validateUniversalLawGraphContracts();

  function ensureSchroederKeyChart(scaleKey) {
    if (schroederChartIds.has(scaleKey)) return schroederChartIds.get(scaleKey);
    const spec = SCHROEDER_SCALE_SPECS[scaleKey] || SCHROEDER_SCALE_SPECS[0];
    const parentId = spec.parentKey != null ? ensureSchroederKeyChart(spec.parentKey) : null;
    // Derive exact physical offset in parent chart units (double-float origin rebasing!)
    let originInParentUnits = [0, 0, 0];
    if (scaleKey === 2) originInParentUnits = [...galaxyFocusPos];
    else if (scaleKey === 4 && solarEngine) {
      const cat = getActiveSystemCatalog();
      const bodySpec = cat[focusedSolarBodyIndex];
      if (bodySpec && Number.isFinite(bodySpec.aAu)) originInParentUnits = [bodySpec.aAu, 0, 0];
    } else if (scaleKey === 'surface' && surfaceLandingSite) {
      const latR = (Number(surfaceLandingSite.latDeg) || 0) * (Math.PI / 180);
      const lonR = (Number(surfaceLandingSite.lonDeg) || 0) * (Math.PI / 180);
      originInParentUnits = [Math.cos(latR) * Math.cos(lonR), Math.sin(latR), Math.cos(latR) * Math.sin(lonR)];
    }
    const res = schroederAtlasRuntime.ensureChartForScaleLevel({
      targetGlobalLevel: spec.level,
      parentChartId: parentId,
      originInParentUnits,
      localSpanLevels: 3,
      label: spec.label
    });
    schroederChartIds.set(scaleKey, res.chartId);
    return res.chartId;
  }

  function syncSchroederScaleChart(activeLevel, log10SpanM = 24.5) {
    const key = (activeLevel === 4 && surfaceActive) ? 'surface' : activeLevel;
    const cid = ensureSchroederKeyChart(key);
    activeSchroederKey = key;
    activeSchroederChartId = cid;
    schroederAtlasRuntime.setChartOccupancy(cid, Math.max(1, Math.round(Math.abs(log10SpanM) * 10)));
    return getSchroederAtlasSnapshot();
  }

  function getSchroederAtlasSnapshot() {
    const snap = schroederAtlasRuntime.snapshotAtlas();
    const activeChart = snap.charts.find((c) => c.chartId === activeSchroederChartId) || snap.charts[0];
    let depth = 0;
    let cur = activeChart;
    while (cur && cur.parentChartId != null && depth < 16) {
      cur = snap.charts.find((c) => c.chartId === cur.parentChartId);
      depth += 1;
    }
    return Object.freeze({
      schema: snap.schema,
      activeKey: activeSchroederKey,
      activeChartId: activeChart?.chartId ?? 0,
      activeChartLabel: activeChart?.label ?? 'L0-cosmic-web',
      activeGlobalLevel: activeChart?.globalBaseLevel ?? 82,
      activeAncestryDepth: depth,
      chartCount: snap.chartCount,
      minGlobalLevel: snap.minGlobalLevel,
      maxGlobalLevel: snap.maxGlobalLevel,
      spanOrdersOfMagnitude: Number((snap.ordersOfMagnitude ?? 0).toFixed(2)),
      doubleFloatOriginHi: activeChart?.originHi ?? [0, 0, 0],
      doubleFloatOriginLo: activeChart?.originLo ?? [0, 0, 0]
    });
  }

  let cosmoMode = 'web'; // 'web' | 'cmb' | 'reionization' | 'cluster-merger'
  let cosmoSession = null;
  let cosmoTelemetry = null;
  let cosmoFirstPk = null;
  let cosmoTargets = [];
  let cosmoFocusMpc = [0, 0, 0];
  let cosmoBigBangMode = false;
  let cosmoBaryonSession = null;
  let cosmoBaryonTelemetry = null;

  // Level 1: Smooth 32^3 CIC 3D-FFT PM Spiral Galaxy + Balanced DM Halo + Live Emergent 3D α-ω Dynamo!
  let galaxyEngine = null;
  let galacticDynamoSession = null;
  let galacticDynamoTelemetry = null;
  let galacticDynamoStreamlines = new Float32Array(0);
  let galacticB0 = 0.30;
  let galaxyPreset = 'disk';
  let galaxyIcRegimeLabel = 'MMW Equilibrium Spiral Disk';
  let galaxyMetallicity = 1.0;
  let ismCoolingAnchors = null;
  let galaxyTargets = [];
  let galaxyFocusPos = [4.8, 0.04, 2.1];
  let galaxyBranch = 'solar-system'; // 'solar-system' | 'smbh-core'
  let showGalacticBField = false;

  // Optional Galactic Core SMBH hypervelocity S-star N-body engine
  let smbhEngine = null;
  let smbhBodies = null;

  // Level 2: Real-Scale Double-Float Symplectic GPU Star System N-Body (Single/Binary/Trinary + Nebular Planets!)
  let solarEngine = null;
  let solarConservation0 = null;
  let solarConservation = null;
  let focusedSolarBodyIndex = getDefaultPlanetIndex();
  let solarMode = 'nbody'; // 'nbody' | 'formation' | 'roche-rings' | 'giant-impact' | 'red-giant' | 'comet-tails' | 'hot-jupiter' | 'quasar-jet' | 'xray-binary' | 'bns-kilonova' | 'type-ia' | 'bbh-merger'
  let protoplanetarySession = null;
  let protoplanetaryTelemetry = null;
  let protoplanetaryGasDrag = true;
  let nebularCoalescenceSession = null;
  let nebularCoalescenceTelemetry = null;
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

  // Level 3: Hydrostatic Main-Sequence Star + Core Fusion + Emergent 3D Stellar Dynamo + Resistive MHD + Remnants!
  let stellarEngine = null;
  let stellarDynamoSession = null;
  let stellarDynamoTelemetry = null;
  let stellarDynamoStreamlines = new Float32Array(0);
  let stellarB0 = 0.36;
  let stellarPreset = 'main-sequence-star';
  let stellarTelemetry = null;
  let stellarNuclearNetwork = null;
  let stellarLaneEmden = null;
  let stellarClosureRef = null;
  let stellarTimeAccel = 2.0;
  let stellarCutaway = false;
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
  let planetaryBodyIndex = getDefaultPlanetIndex();
  let planetaryCutaway = false;
  let planetaryLayersMeta = [];
  let planetaryAtmoState = null;
  let planetaryAtmoSession = null;
  let planetaryAtmoTelemetry = null;
  let planetaryTriboelectric = true;
  let planetaryGenesisSphSession = null;
  let planetaryGenesisSphTelemetry = null;
  let planetaryGenesisLiveForm = false;
  let planetaryCoolingHeat = 0.0; // Continuous post-SPH surface cooling ramp (1.0 incandescent magma -> 0.0 cooled equilibrium world!)
  let planetaryDynamoSession = null;
  let planetaryDynamoTelemetry = null;
  let planetaryDynamoStreamlines = new Float32Array(0);
  let planetarySecularTick = 0;
  let activeGenesisStage = null;
  let lastGenesisEvent = null;
  let lastSupernovaYields = null;
  let cryoPlumeSession = null;

  function getActiveGenesisPublicState() {
    if (!activeGenesisStage) return null;
    const elapsedSec = Math.max(0.1, (Date.now() - (activeGenesisStage.startedMs || Date.now())) / 1000);
    const prog = Math.max(0, Math.min(1, Number(activeGenesisStage.progress) || 0));
    const etaSec = prog > 0.03 ? Math.max(0, Math.round(elapsedSec * (1 - prog) / prog)) : null;
    return Object.freeze({
      level: activeGenesisStage.level,
      stage: activeGenesisStage.stage,
      title: activeGenesisStage.title,
      entityName: activeGenesisStage.entityName,
      detail: activeGenesisStage.detail,
      step: activeGenesisStage.step,
      targetSteps: activeGenesisStage.targetSteps,
      progress: prog,
      etaSec,
      tier: activeCapabilityProfile.tier,
      cacheKey: activeGenesisStage.cacheKey,
      skipLabel: activeGenesisStage.skipLabel || '⏩ Finish Now'
    });
  }

  function buildPlanetSphCacheKey(spec, idx, dimsStr) {
    return rootLineageCache.buildKey('l4-sph-geo-v11-pc-ss', {
      seed: universeSeed,
      epochId: cosmicEpochId,
      systemId: useSolReference ? 'sol' : (activeCausalSystem?.systemId || 'sys'),
      bodyId: spec?.id || `b${idx}`,
      mode: planetaryMode,
      dims: dimsStr
    });
  }

  function buildProvisionalCoalescingSystem(starSys, snowLineAu, rMinStableAu, rMaxStableAu) {
    const stars = Array.isArray(starSys?.stars) && starSys.stars.length
      ? starSys.stars
      : [{ id: 'star-0', name: 'Host Star', massSolar: 1.0, luminositySolar: 1.0, radiusSolar: 1.0, teffK: 5778, spectralClass: 'G2V', color0: [1.0, 0.94, 0.78], color1: [1.0, 0.62, 0.24] }];
    const starCatalog = stars.map((st, sIdx) => ({
      id: st.id || `star-${sIdx}`,
      name: st.name || `${starSys?.systemName || 'Proto-System'} ${sIdx === 0 ? 'A' : 'B'}`,
      subtitle: `${st.spectralClass || 'Main-Sequence'} · Coalescing Protoplanetary Disk (L = ${Number(st.luminositySolar || 1).toFixed(2)} L☉)`,
      isStar: true,
      starIndex: sIdx,
      parent: -1,
      aAu: Number(st.orbitAu) || 0,
      ecc: Number(st.ecc) || 0,
      incDeg: 0,
      massSolar: Number(st.massSolar) || 1.0,
      luminositySolar: Number(st.luminositySolar) || 1.0,
      radiusKm: Math.max(20000, (Number(st.radiusSolar) || 1.0) * 695700),
      tempK: Number(st.teffK) || 5778,
      kind: 0,
      atm: 0,
      color0: Array.isArray(st.color0) ? st.color0 : [1.0, 0.94, 0.78],
      color1: Array.isArray(st.color1) ? st.color1 : [1.0, 0.62, 0.24],
      spectralClass: st.spectralClass || 'G2V',
      composition: `H/He Fusion Star · Nebular Disk Snow Line ${Number(snowLineAu || 2.7).toFixed(2)} AU`
    }));
    return Object.freeze({
      systemId: starSys?.systemId || `proto-${activeStarSite.starIndex ?? 0}`,
      systemName: starSys?.systemName || `Proto-System #${activeStarSite.starIndex ?? 0}`,
      architecture: starSys?.architecture || (stars.length > 1 ? 'binary' : 'single'),
      starSystem: starSys,
      starCount: stars.length,
      planetCount: 0,
      hasEarthLike: false,
      gpuCoalesced: false,
      coalescingLive: true,
      recommendedL3Regime: 'fusion',
      condensationFrontsAu: Object.freeze({
        rSnowLineAu: Number(Number(snowLineAu || 2.7).toFixed(2)),
        rMinStableAu: Number(Number(rMinStableAu || 0.14).toFixed(3)),
        rMaxStableAu: Number(Number(rMaxStableAu || 28.0).toFixed(2)),
        rHzInnerAu: Number((0.95 * Math.sqrt(Math.max(1e-4, stars[0].luminositySolar || 1))).toFixed(2)),
        rHzOuterAu: Number((1.67 * Math.sqrt(Math.max(1e-4, stars[0].luminositySolar || 1))).toFixed(2))
      }),
      catalog: Object.freeze(starCatalog)
    });
  }
  let cryoPlumeTelemetry = null;

  // Planetary Surface View (TinyPlanetControls + 6-Wheel Jump-Rocket Mars Rover + Atmospheric Drone + OPFS Crater Persistence!)
  const craterTileStore = createSurfaceCraterTileStore();
  let surfaceActive = false;
  let surfaceLandingSite = null;
  let surfaceSession = null;
  let surfaceTelemetry = null;
  let surfaceTimeWarp = 1.0;
  let surfaceSimSec = 0.0;
  let surfaceClimate = null;
  let surfaceCraterTileKey = null;
  let surfaceCraterDirty = false;
  let surfaceCraterFlushTimer = null;
  let customSurfaceBodySpec = null;
  const shatteredBodyIds = new Set();
  let shatterOriginBodyName = null;
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
  let activeSampledMaterial = null; // Live geological/atmospheric/asteroid sample propagating down L5 -> Compounds -> L6 -> L7!

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
  let nebularSettleBlend = 0.0;

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

  let cosmoSpatialPartitioner = null;
  let cosmoLocalPeerId = 'local-l0-host';
  let cosmoLocalTileLease = null;

  // ---- L0: 2LPT IllustrisTNG / Millennium-Style Supergalactic Cosmic Web ----
  async function initCosmicWeb({ seedOverride = null, bigBang = false } = {}) {
    if (cosmoSession) {
      cosmoSession.destroy();
      cosmoSession = null;
    }
    cosmoBigBangMode = Boolean(bigBang);
    cosmoFocusMpc = [0, 0, 0];
    const activeSeed = (seedOverride ?? universeSeed) >>> 0;
    const aStart = cosmoBigBangMode ? 0.045 : 0.52;
    const daStep = cosmoBigBangMode ? 0.0085 : 0.0012;
    // Run the periodic FLRW 2LPT + TreePM Cosmic Web at filament-resolving 1,425 Mpc (~4.65 Gly/tile, dx ~ 44 Mpc),
    // tiled seamlessly across the full 28,500 Mpc (93.0 Gly = 8.8e26 m) Observable Universe Lightcone sphere!
    const COSMO_TILE_MPC = 1425.0;
    const OBSERVABLE_UNIVERSE_MPC = 28500.0;
    cosmoLocalPeerId = peerMesh?.peerId ? String(peerMesh.peerId) : `local-l0-${(activeSeed & 0xffff).toString(16)}`;
    cosmoSpatialPartitioner = createDistributedSpatialPartitioner({
      domainId: `ulg-universes-l0-${activeSeed}`,
      boxLength: COSMO_TILE_MPC,
      tileCount: 4,
      leaseTtlMs: 60_000
    });
    cosmoLocalTileLease = cosmoSpatialPartitioner.claimTile(0, cosmoLocalPeerId);
    const w = getWorkloads();
    const gpuIc = await build2LptCosmologyICsWebGpu(device, {
      gridPerSide: w.cosmoGridPerSide,
      fftGridN: w.cosmoFftN,
      boxLengthMpc: COSMO_TILE_MPC,
      aInit: aStart,
      amplitude: cosmoBigBangMode ? 0.28 : 0.44,
      seed: activeSeed
    });
    const nextCosmo = createSupergalacticTreePmSessionWebGpu(device, {
      gridPerSide: w.cosmoGridPerSide,
      pmGridN: w.cosmoFftN,
      boxLengthMpc: COSMO_TILE_MPC,
      aInit: aStart,
      da: daStep,
      initialConditions: gpuIc
    });
    cosmoFirstPk = null;
    const warmSteps = cosmoBigBangMode ? 1 : 4;
    for (let w = 0; w < warmSteps; w += 1) {
      cosmoTelemetry = await nextCosmo.step({ readTelemetry: w === 0 || w === warmSteps - 1 });
      if (w === 0 && cosmoTelemetry?.powerSpectrumPk?.kBins?.length) {
        cosmoFirstPk = {
          kBins: [...cosmoTelemetry.powerSpectrumPk.kBins],
          pkValues: [...cosmoTelemetry.powerSpectrumPk.pkValues]
        };
      }
    }
    cosmoSession = nextCosmo;

    const MORPH_LABELS = {
      disk: 'Grand-Design Spiral (Sc/Sb)',
      barred: 'Barred Spiral (SBb)',
      ring: 'Cartwheel Collisional Ring Galaxy',
      lenticular: 'Lenticular Disk (S0 · Sombrero)',
      irregular: 'Starburst Irregular (Magellanic / M82)',
      'open-cluster': 'Open Cluster + Reflection Veil (M45)',
      binary: 'Interacting Major Merger Pair',
      sphere: 'Cluster-Core Giant Elliptical (E2)',
      proto: 'High-z Clumpy Starburst Protogalaxy',
      'dwarf-stream': 'Void Dwarf & Tidal Stream',
      globular: 'Core-Collapsed Globular Cluster (GC)',
      coalesce: 'Collapsing Protogalactic Halo'
    };

    function buildTargetsFromLiveHalos(liveHalos, seedVal) {
      const rand = mulberry32(seedVal ^ 0x51f15e);
      // Lightcone pitch maps the central periodic box (1,425 Mpc) into the inner super-volume (5,700 Mpc) of the 93 Gly sphere
      const lightconePitchScale = (OBSERVABLE_UNIVERSE_MPC / 5.0) / COSMO_TILE_MPC;
      if (Array.isArray(liveHalos) && liveHalos.length > 0) {
        return liveHalos.map((h, i) => {
          const obsPosMpc = [
            h.posMpc[0] * lightconePitchScale,
            h.posMpc[1] * lightconePitchScale,
            h.posMpc[2] * lightconePitchScale
          ];
          const gEnv = deriveGalaxyEnvironmentFromCosmicContext({
            cosmicEpoch,
            regionPosMpc: obsPosMpc,
            localOverdensity: h.overdensity,
            tidalSpinLambda: h.spinLambda,
            gpuCoalescedHalo: true,
            seed: (seedVal ^ Math.imul(i + 1, 2654435761)) >>> 0
          });
          const morph = gEnv.morphology;
          const prefix = GALAXY_PREFIXES[Math.floor(rand() * GALAXY_PREFIXES.length)];
          const num = 1000 + Math.floor(rand() * 8900);
          const zMet = Number(gEnv.meanMetallicitySolar.toFixed(2));
          const massT = (h.haloMassSolar / 1e12);
          return {
            id: `cluster-${i}`,
            level: 0,
            name: `${prefix}-${num} ${h.overdensity > 2.2 ? 'Node Cluster' : (h.overdensity < 0.7 ? 'Void Halo' : 'Filament Group')}`,
            subtitle: `GPU Halo δ=${h.overdensity.toFixed(2)} · λ=${h.spinLambda.toFixed(3)} · M=${Math.max(0.2, massT).toFixed(2)}×10¹² M☉ · ⏳ Unsimulated`,
            posMpc: obsPosMpc,
            pos: [obsPosMpc[0] * (16.0 / OBSERVABLE_UNIVERSE_MPC), obsPosMpc[1] * (16.0 / OBSERVABLE_UNIVERSE_MPC), obsPosMpc[2] * (16.0 / OBSERVABLE_UNIVERSE_MPC)],
            radius: 1.0,
            overdensity: h.overdensity,
            spinLambda: h.spinLambda,
            gpuCoalescedHalo: true,
            galaxyEnv: gEnv,
            morphology: morph,
            metallicity: zMet,
            massLabel: morph === 'globular'
              ? `${(2.0 + rand() * 6.5).toFixed(1)}×10⁵ M☉`
              : `${Math.max(0.2, massT).toFixed(2)}×10¹² M☉`,
            tempK: morph === 'sphere' || morph === 'globular' ? 4200 + Math.round(rand() * 1200) : 6500 + Math.round(rand() * 4500),
            composition: `FLRW TreePM Halo (δ=${h.overdensity.toFixed(2)}, λ=${h.spinLambda.toFixed(3)}) — Zoom in to collapse galaxy on GPU`,
            nextLevel: 1
          };
        });
      }
      return Array.from({ length: 7 }, (_, i) => {
        const morph = GALAXY_MORPHOLOGIES[i % (GALAXY_MORPHOLOGIES.length - 1)];
        const prefix = GALAXY_PREFIXES[Math.floor(rand() * GALAXY_PREFIXES.length)];
        const num = 1000 + Math.floor(rand() * 8900);
        const spread = i === 0 ? 2200.0 : 9600.0;
        const xMpc = (rand() - 0.5) * 2 * spread;
        const yMpc = (rand() - 0.5) * 1.4 * spread;
        const zMpc = (rand() - 0.5) * 2 * spread;
        const zMet = Number((morph === 'globular' ? 0.08 + rand() * 0.14 : (0.55 + rand() * 1.15)).toFixed(2));
        return {
          id: `cluster-${i}`,
          level: 0,
          name: `${prefix}-${num} ${morph === 'globular' ? 'Halo Cluster' : 'Supercluster'}`,
          subtitle: `${MORPH_LABELS[morph] || 'Spiral Galaxy'} · Z=${zMet} Z☉`,
          posMpc: [xMpc, yMpc, zMpc],
          pos: [xMpc * (16.0 / OBSERVABLE_UNIVERSE_MPC), yMpc * (16.0 / OBSERVABLE_UNIVERSE_MPC), zMpc * (16.0 / OBSERVABLE_UNIVERSE_MPC)],
          radius: 1.0,
          morphology: morph,
          metallicity: zMet,
          massLabel: morph === 'globular' ? `${(2.0 + rand() * 6.5).toFixed(1)}×10⁵ M☉` : `${(1.2 + rand() * 6.5).toFixed(2)}×10¹² M☉`,
          tempK: morph === 'sphere' || morph === 'globular' ? 4200 + Math.round(rand() * 1200) : 6500 + Math.round(rand() * 4500),
          composition: morph === 'globular'
            ? `Ancient Pop II Stars · H 74.8% · He 25.1% · [Fe/H] ≈ -1.6`
            : `DM 84% · H 12% · He 3.8% · Met ${(0.2 * zMet).toFixed(2)}%`,
          nextLevel: 1
        };
      });
    }

    // Check Root Cosmic Lineage Cache first so revisiting/reloading this seed+epoch skips redundant extraction!
    const haloCacheKey = rootLineageCache.buildKey('l0-halos', {
      seed: activeSeed,
      epochId: cosmicEpochId,
      mode: cosmoBigBangMode ? 'bb' : 'web'
    });
    let liveHalos = await rootLineageCache.get(haloCacheKey, { bypassCache: Boolean(bigBang) });
    if (!Array.isArray(liveHalos) || liveHalos.length === 0) {
      try {
        liveHalos = await nextCosmo.extractLiveCosmicHalos({ maxHalos: 7 });
      } catch {
        liveHalos = [];
      }
      if (liveHalos.length > 0) {
        await rootLineageCache.set(haloCacheKey, liveHalos, { persist: true, broadcast: true });
      }
    }
    cosmoTargets = buildTargetsFromLiveHalos(liveHalos, activeSeed);
    // Align root galaxy environment with the #1 coalesced GPU cosmic-web halo!
    if (cosmoTargets[0]?.galaxyEnv) {
      activeGalaxyEnv = cosmoTargets[0].galaxyEnv;
    }
  }

  // ---- L1: Smooth 32^3 CIC 3D-FFT Particle-Mesh Spiral Galaxy + Live Emergent GPU 3D α-ω Dynamo ----
  async function initGalaxy({
    preset = null,
    metallicity = null,
    galaxyEnvOverride = null,
    seedOverride = null,
    observeLive = false,
    bypassCache = false
  } = {}) {
    if (galaxyEnvOverride) {
      activeGalaxyEnv = galaxyEnvOverride;
    } else if (preset || metallicity != null) {
      activeGalaxyEnv = Object.freeze({
        ...activeGalaxyEnv,
        morphology: GALAXY_MORPHOLOGIES.includes(preset) ? preset : activeGalaxyEnv.morphology,
        meanMetallicitySolar: metallicity != null ? Math.max(1e-4, Math.min(3.2, Number(metallicity))) : activeGalaxyEnv.meanMetallicitySolar,
        baseFeH: Math.log10(Math.max(1e-4, metallicity != null ? Number(metallicity) : activeGalaxyEnv.meanMetallicitySolar))
      });
    }
    const regPos = activeGalaxyEnv?.regionPosMpc || [0, 0, 0];
    const galCacheKey = rootLineageCache.buildKey('l1-galaxy', {
      seed: universeSeed,
      epochId: cosmicEpochId,
      galaxyKey: `${Math.round((regPos[0] || 0) / 25)}_${Math.round((regPos[1] || 0) / 25)}_${Math.round((regPos[2] || 0) / 25)}`
    });
    const cachedGal = bypassCache ? null : await rootLineageCache.get(galCacheKey);
    const runLiveCollapse = Boolean(observeLive && !cachedGal && !preset);
    const targetMorphology = GALAXY_MORPHOLOGIES.includes(preset || cachedGal?.morphology || activeGalaxyEnv.morphology)
      ? (preset || cachedGal?.morphology || activeGalaxyEnv.morphology)
      : 'disk';
    galaxyPreset = runLiveCollapse ? 'coalesce' : targetMorphology;
    galaxyMetallicity = Math.max(0.01, Math.min(3.0, Number(metallicity ?? activeGalaxyEnv.meanMetallicitySolar) || 1.0));
    if (galaxyEngine) {
      galaxyEngine.dispose();
      galaxyEngine = null;
    }
    if (galacticDynamoSession) {
      galacticDynamoSession.dispose();
      galacticDynamoSession = null;
    }
    if (!ismCoolingAnchors) {
      ismCoolingAnchors = await deriveGate1IsmCoolingAnchorsWebGpu(device);
    }
    const activeSeed = ((seedOverride ?? (activeGalaxyEnv?.seed || universeSeed)) + 825) >>> 0;
    const w = getWorkloads();
    const icRegime = galaxyPreset === 'coalesce'
      ? describeCosmologicalGalaxyIcRegime(activeGalaxyEnv, activeSeed)
      : null;
    galaxyIcRegimeLabel = icRegime ? icRegime.label : (activeGalaxyEnv?.morphologyLabel || galaxyPreset);
    const deltaHalo = Math.max(0.25, Math.min(4.5, Number(activeGalaxyEnv?.localOverdensity ?? activeGalaxyEnv?.overdensity) || 1.0));
    const dmHaloMass = (galaxyPreset === 'globular' || galaxyPreset === 'open-cluster')
      ? 0.0
      : (galaxyPreset === 'irregular'
        ? 900.0
        : (galaxyPreset === 'binary'
          ? 1850.0
          : (galaxyPreset === 'sphere'
            ? Math.round(2800.0 + deltaHalo * 900.0)
            : Math.round(2400.0 + deltaHalo * 900.0))));
    const dmScaleRadius = galaxyPreset === 'sphere' ? 5.6 : (galaxyPreset === 'irregular' ? 5.2 : 6.8);
    const dmConcentration = galaxyPreset === 'sphere' ? 10.2 : 8.8;
    const dmSecondaryMass = galaxyPreset === 'binary' ? 1580.0 : (icRegime?.isMerger ? dmHaloMass * (icRegime.massRatio || 0.72) : 0.0);

    const bodies0 = createRealisticSpiralGalaxyBodies({
      count: w.galaxyStars,
      preset: galaxyPreset,
      seed: activeSeed,
      galaxyEnv: activeGalaxyEnv,
      dmHaloMass,
      dmScaleRadius,
      dmConcentration
    });

    const tiltToNormal = (tx, tz) => {
      const cTx = Math.cos(tx); const sTx = Math.sin(tx);
      const cTz = Math.cos(tz); const sTz = Math.sin(tz);
      // Matches rot(0, 1, 0): y1 = cTx, z1 = sTx -> [-sTz * cTx, cTz * cTx, sTx]
      return [-sTz * cTx, cTz * cTx, sTx];
    };
    let diskNormal = [0, 1, 0];
    let diskNormalSecondary = [0, 1, 0];
    if (galaxyPreset === 'lenticular') diskNormal = tiltToNormal(0.26, 0.0);
    else if (galaxyPreset === 'proto') diskNormal = tiltToNormal(0.22, -0.14);
    else if (galaxyPreset === 'dwarf-stream') diskNormal = tiltToNormal(0.14, 0.08);
    else if (galaxyPreset === 'binary') {
      diskNormal = tiltToNormal(0.35, 0.18);
      diskNormalSecondary = tiltToNormal(-0.42, -0.25);
    } else if (galaxyPreset === 'coalesce' && icRegime) {
      if (icRegime.id === 'bullseye-ring-impact') {
        diskNormal = tiltToNormal(icRegime.tiltX * 0.45, icRegime.tiltZ * 0.45);
        diskNormalSecondary = tiltToNormal(1.15, -0.45);
      } else {
        diskNormal = tiltToNormal(icRegime.tiltX || 0, icRegime.tiltZ || 0);
        diskNormalSecondary = tiltToNormal(-(icRegime.tiltX || 0) * 0.8 + 0.55, -(icRegime.tiltZ || 0) * 0.7 - 0.35);
      }
    }

    const secondSmbhIdx = galaxyPreset === 'binary'
      ? (w.galaxyStars >> 1)
      : (icRegime?.isMerger
        ? Math.max(256, Math.min(w.galaxyStars - 256, Math.floor(w.galaxyStars / (1 + (icRegime.massRatio || 0.72)))))
        : 0);
    galaxyEngine = createGalacticParticleMeshEngineWebGpu({
      device,
      initialBodies: bodies0,
      gridN: 32,
      boxSize: 36.0,
      secondSmbhIndex: secondSmbhIdx,
      smbhSoftening: 0.75,
      dmHaloMass,
      dmSecondaryMass,
      dmScaleRadius,
      dmConcentration,
      diskNormal,
      diskNormalSecondary,
      label: `ulg-universes-galaxy-ss-nfw-${w.galaxyStars}`
    });
    // Universal 3D GPU equilibrium calibration across ALL 12 galaxy morphologies:
    //   mode 0 = 3D Tilted Toomre Disk (disk, barred, ring, lenticular, proto, dwarf-stream)
    //   mode 1 = 3D Hernquist/King Jeans Spheroid (sphere, globular, open-cluster, irregular)
    //   mode 2 = Bound Sub-Virial Cosmological Collapse (coalesce single)
    //   mode 3 = Dual-Rest-Frame Binary Merger (binary, coalesce merger)
    const calMode = secondSmbhIdx > 0
      ? 3
      : (galaxyPreset === 'coalesce'
        ? 2
        : (['sphere', 'globular', 'open-cluster', 'irregular'].includes(galaxyPreset) ? 1 : 0));
    await galaxyEngine.calibrateEquilibrium({
      gravity: 1.0,
      softening: 0.65,
      virialScale: calMode === 2 ? 0.82 : (calMode === 3 ? 0.98 : 1.0),
      calMode,
      preserveBar: galaxyPreset === 'barred'
    });
    await galaxyEngine.step({ dt: runLiveCollapse ? 0.0044 : 0.0044, substeps: 2, gravity: 1.0, softening: 0.65, readback: false });

    // Coupled live GPU 24^3 3D α-ω Galactic Dynamo driven strictly by live GPU galaxy particle velocities!
    galacticDynamoSession = createEmergent3dDynamoFieldWebGpu(device, {
      gridN: 24,
      boxSize: 26.0,
      strideFloats: 8,
      geometry: 'galactic',
      initialB0: galacticB0,
      alphaAmp: 0.035,
      etaRes: 0.16,
      bSat: 0.85,
      velScale: 0.22,
      label: 'ulg-universes-galactic-dynamo'
    });
    galacticDynamoTelemetry = await galacticDynamoSession.step({
      particleBuffer: galaxyEngine.getResidentBuffer(),
      particleCount: galaxyEngine.count,
      dt: 0.040,
      substeps: runLiveCollapse ? 2 : 8,
      readTelemetry: true,
      readBField: true
    });
    galacticDynamoStreamlines = galacticDynamoSession.buildStreamlines({ worldScale: 1.0, alpha: 0.30 });

    if (runLiveCollapse) {
      const entityName = activeGalaxyEnv?.morphologyLabel || 'Cosmic-Web Halo';
      activeGenesisStage = {
        level: 1,
        stage: 'l1-galaxy-collapse',
        title: `Collapsing Protogalactic Halo (${activeCapabilityProfile.tier.toUpperCase()})`,
        entityName,
        detail: `${galaxyIcRegimeLabel} · SS 3D Multipole + NFW Dark Matter Halo + α–ω Dynamo · ${w.galaxyStars.toLocaleString()} stars+DM`,
        step: 2,
        targetSteps: w.l1TargetSteps,
        progress: 2 / Math.max(1, w.l1TargetSteps),
        cacheKey: galCacheKey,
        skipLabel: '⏩ Settle Galaxy Now',
        startedMs: Date.now(),
        _meta: { targetMorphology, activeSeed, galCacheKey, entityName, icLabel: galaxyIcRegimeLabel }
      };
      lastGenesisEvent = Object.freeze({
        kind: 'genesis-started',
        level: 1,
        stage: 'l1-galaxy-collapse',
        label: entityName,
        source: 'live-gpu',
        timestampMs: Date.now()
      });
    } else {
      if (activeGenesisStage?.level === 1) activeGenesisStage = null;
      if (cachedGal && !bypassCache) {
        lastGenesisEvent = Object.freeze({
          kind: 'cache-hit',
          level: 1,
          stage: 'l1-galaxy-collapse',
          label: cachedGal.morphologyLabel || galaxyPreset,
          source: 'root-cache',
          timestampMs: Date.now()
        });
      } else {
        // Record this collapsed halo galaxy in the Root Cosmic Lineage Cache so L0 knows it has been simulated!
        void rootLineageCache.set(galCacheKey, {
          morphology: galaxyPreset,
          morphologyLabel: activeGalaxyEnv?.morphologyLabel || galaxyPreset,
          meanMetallicitySolar: galaxyMetallicity,
          baseFeH: activeGalaxyEnv?.baseFeH ?? Math.log10(Math.max(1e-4, galaxyMetallicity)),
          gasFraction: activeGalaxyEnv?.gasFraction ?? 0.22,
          starCount: w.galaxyStars
        }, { persist: true, broadcast: true });
      }
    }

    galaxyFocusPos = [4.8, 0.04, 2.1];
    // Only the central SMBH (`Sgr-ULG*` at [0,0,0]) is a stationary galactic landmark;
    // every star in the galaxy is a live, orbiting, GPU-clickable particle (zero fake frozen placeholder stars!).
    galaxyTargets = [
      {
        id: 'smbh-core',
        level: 1,
        branch: 'smbh-core',
        name: 'Galactic Core SMBH (Sgr-ULG*)',
        subtitle: '4.3×10⁶ M☉ Supermassive Black Hole · Click any orbiting star or zoom into Sgr-ULG*',
        pos: [0, 0, 0],
        radius: 1.0,
        isSmbh: true,
        tempK: 28000,
        massLabel: '4.3×10⁶ M☉',
        composition: 'Relativistic Plasma · Hypervelocity S-Stars',
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

  // ---- L2: Real-Scale Double-Float Symplectic WebGPU Star System N-Body (Single/Binary/Trinary + Nebular Planets!) ----
  async function initSolarSystem({
    seedOverride = null,
    starSite = null,
    solReference = null,
    forceMultiplicity = null,
    forceExoticStage = null,
    observeLive = false,
    bypassCache = false
  } = {}) {
    if (solarEngine) {
      solarEngine.dispose();
      solarEngine = null;
    }
    if (activeGenesisStage && activeGenesisStage.level >= 2) {
      activeGenesisStage = null;
    }
    if (typeof solReference === 'boolean') useSolReference = solReference;
    if (starSite) {
      activeStarSite = {
        posGal: starSite.posGal || activeStarSite.posGal,
        popTag: starSite.popTag ?? activeStarSite.popTag,
        starIndex: starSite.starIndex ?? activeStarSite.starIndex,
        forceExoticStage: forceExoticStage ?? starSite.forceExoticStage ?? null
      };
      useSolReference = false;
    }
    const activeSeed = ((seedOverride ?? universeSeed) + 409) >>> 0;
    if (!useSolReference) {
      const starSys = deriveStarSystemFromGalacticLocation({
        cosmicEpoch,
        galaxyEnv: activeGalaxyEnv,
        starPosGal: activeStarSite.posGal,
        popTag: activeStarSite.popTag,
        starIndex: activeStarSite.starIndex,
        seed: activeSeed,
        forceMultiplicity,
        forceExoticStage: forceExoticStage ?? activeStarSite.forceExoticStage ?? null
      });
      // Check Root Cosmic Lineage Cache first; on miss:
      // - Interactive approach/click (`observeLive: true`): run live observable GPU nebular coalescence ON SCREEN!
      // - Programmatic/test path (`observeLive: false`): run 1-submit GPU burst + cache immediately.
      const nebCacheKey = rootLineageCache.buildKey('l2-nebular', {
        seed: activeSeed,
        epochId: cosmicEpochId,
        galaxyKey: activeGalaxyEnv?.seed || 0,
        starKey: `${activeStarSite.starIndex}_${forceMultiplicity || 0}_${forceExoticStage || ''}`
      });
      let gpuDisk = bypassCache ? null : await rootLineageCache.get(nebCacheKey);
      if (!gpuDisk && observeLive && !(forceExoticStage ?? activeStarSite.forceExoticStage)) {
        if (protoplanetarySession) { protoplanetarySession.dispose(); protoplanetarySession = null; }
        if (nebularCoalescenceSession) { nebularCoalescenceSession.dispose(); nebularCoalescenceSession = null; }
        const stars = starSys?.stars || [{ massSolar: 1.0, luminositySolar: 1.0, radiusSolar: 1.0, spectralClass: 'G2V' }];
        const isCircumbinary = starSys?.architecture === 'binary-p-type' || starSys?.architecture === 'hierarchical-trinary';
        const hostMassSolar = isCircumbinary ? (stars[0].massSolar + (stars[1]?.massSolar || 0)) : stars[0].massSolar;
        const hostLumSolar = isCircumbinary ? (stars[0].luminositySolar + (stars[1]?.luminositySolar || 0)) : stars[0].luminositySolar;
        const sqrtL = Math.sqrt(Math.max(1e-4, hostLumSolar));
        const rSilicateAu = Math.max(0.012, 0.085 * sqrtL);
        const rSnowLineAu = Math.max(0.08, 2.70 * sqrtL);
        let rMinStableAu = Math.max(rSilicateAu * 1.15, (stars[0].radiusSolar || 1.0) * 0.00465 * 6.0);
        let rMaxStableAu = Math.min(38.0, Math.max(rSnowLineAu * 4.5, 24.0 * Math.pow(Math.max(0.08, hostMassSolar), 0.78)));
        if (isCircumbinary && starSys?.binaryPair) {
          const m0 = Math.max(0.05, stars[0].massSolar || 0.5);
          const m1 = Math.max(0.05, stars[1]?.massSolar || 0.3);
          const mu = Math.min(m0, m1) / (m0 + m1);
          const eB = Math.max(0, Math.min(0.65, Number(starSys.binaryPair.e) || 0.05));
          const rCritP = (starSys.binaryPair.aAu || 0.2) * (1.60 + 5.10 * eB - 2.22 * eB * eB + 4.12 * mu - 4.27 * eB * mu - 5.09 * mu * mu + 4.61 * eB * eB * mu * mu);
          rMinStableAu = Math.max(rMinStableAu, Math.max((starSys.binaryPair.aAu || 0.2) * 1.85, rCritP) * 1.18);
          rMaxStableAu = Math.max(rMaxStableAu, rMinStableAu * 6.0);
        }
        const neb = starSys?.nebulaEnv || {};
        const w = getWorkloads();
        const pebCount = w.nebularParcels;
        const nextCoalesce = createNebularSystemCoalescenceSessionWebGpu(device, {
          starMassSolar: hostMassSolar,
          starLuminositySolar: hostLumSolar,
          metallicitySolar: neb.metallicitySolar ?? 1.0,
          cToO: neb.cToO ?? 0.55,
          gasFraction: activeGalaxyEnv?.gasFraction ?? 0.24,
          rMinStableAu,
          rMaxStableAu,
          parcelCount: pebCount,
          radialBins: w.nebularRadialBins,
          enableGasDrag: protoplanetaryGasDrag,
          seed: (activeSeed ^ 0x4eb01a) >>> 0,
          label: `ulg-universes-nebular-live-${activeStarSite.starIndex ?? 0}`
        });
        nebularCoalescenceTelemetry = await nextCoalesce.step({ dt: 0.024, substeps: 32, gravityCadence: w.l2GravityCadence || 4, readTelemetry: true, readAnnuli: true });
        nebularCoalescenceSession = nextCoalesce;
        activeCausalSystem = buildProvisionalCoalescingSystem(starSys, nextCoalesce.snowLineAu, rMinStableAu, rMaxStableAu);
        focusedSolarBodyIndex = 0;
        planetaryBodyIndex = 0;
        planetaryResult = null;
        solarMode = 'formation';
        const st0 = stars[0];
        const lumStr = hostLumSolar >= 0.05 ? Number(hostLumSolar).toFixed(2) : Number(hostLumSolar).toExponential(1);
        const specTag = st0.spectralType || st0.spectralClass || st0.classLabel || 'Star';
        const entityName = `${starSys.systemName || `Star #${activeStarSite.starIndex ?? 0}`} (${specTag} · ${lumStr} L☉)`;
        activeGenesisStage = {
          level: 2,
          stage: 'l2-nebular-coalescence',
          title: `Coalescing Star System Nebula (SS Multipole · ${activeCapabilityProfile.tier.toUpperCase()})`,
          entityName,
          detail: `Collapsing protoplanetary disk (${pebCount.toLocaleString()} parcels · Snow Line ${nextCoalesce.snowLineAu.toFixed(2)} AU) — density waves forming (worlds not yet settled)`,
          step: nextCoalesce.stepIndex,
          targetSteps: w.l2TargetSteps,
          progress: Math.min(1, nextCoalesce.stepIndex / Math.max(1, w.l2TargetSteps)),
          cacheKey: nebCacheKey,
          skipLabel: '⏩ Fast-Forward SPH Settling',
          startedMs: Date.now(),
          _meta: { starSys, activeSeed, nebCacheKey }
        };
        nebularSettleBlend = 0.0;
        lastGenesisEvent = Object.freeze({
          kind: 'genesis-started',
          level: 2,
          stage: 'l2-nebular-coalescence',
          label: entityName,
          source: 'live-gpu',
          timestampMs: Date.now()
        });
        return;
      }
      if (gpuDisk) {
        lastGenesisEvent = Object.freeze({
          kind: 'cache-hit',
          level: 2,
          stage: 'l2-nebular-coalescence',
          label: starSys.systemName || `Star #${activeStarSite.starIndex ?? 0}`,
          source: 'root-cache',
          timestampMs: Date.now()
        });
      } else {
        try {
          const w = getWorkloads();
          gpuDisk = await runNebularSystemCoalescenceBurstWebGpu(device, starSys, {
            parcelCount: w.nebularParcels,
            radialBins: w.nebularRadialBins,
            substeps: w.l2BurstSubsteps,
            seedOverride: activeSeed
          });
          if (gpuDisk) {
            await rootLineageCache.set(nebCacheKey, gpuDisk, { persist: true, broadcast: true });
          }
        } catch {
          gpuDisk = null;
        }
      }
      activeCausalSystem = synthesizeNebularPlanetarySystem(starSys, {
        seedOverride: activeSeed,
        gpuCoalescedDisk: gpuDisk
      });
    } else {
      lastGenesisEvent = Object.freeze({
        kind: 'cache-hit',
        level: 2,
        stage: 'l2-nebular-coalescence',
        label: 'Sol Reference System',
        source: 'sol-reference',
        timestampMs: Date.now()
      });
    }
    const cat = getActiveSystemCatalog();
    // Preserve explicit star focus (`focusedSolarBodyIndex === 0`, e.g., flying directly from L0/L1 into L3 Star/MHD!)
    // unless explicitly switching to a brand-new star site or toggling Sol reference.
    const keepStarFocus = focusedSolarBodyIndex === 0 && !starSite && typeof solReference !== 'boolean';
    focusedSolarBodyIndex = keepStarFocus ? 0 : (useSolReference ? 3 : getDefaultPlanetIndex(cat));
    planetaryBodyIndex = keepStarFocus ? getDefaultPlanetIndex(cat) : focusedSolarBodyIndex;
    solarMode = 'nbody';
    solarEngine = createSolarSystemNBodyEngineWebGpu(device, {
      catalog: cat,
      beltZoneAu: useSolReference ? null : activeCausalSystem?.beltZoneAu,
      asteroidCount: quality.solarAsteroids,
      seed: activeSeed,
      label: useSolReference ? 'ulg-universes-sol-reference' : `ulg-universes-causal-${activeCausalSystem?.systemId || 'sys'}`
    });
    await solarEngine.step({ dtSubYr: 0.000035, substeps: 4, readMassive: true });
    solarConservation0 = solarEngine.computeConservationDiagnostics();
    solarConservation = solarConservation0;
    // Reset stale L4 planetary interior if switching star systems so L4 matches the newly derived world!
    if (planetaryResult) {
      planetaryResult = null;
    }
  }

  async function syncStellarRegimeForStar(starSpec = null, { recommendedL3Regime = null, initializeNow = false } = {}) {
    const cat = getActiveSystemCatalog();
    const spec = starSpec
      || (cat[focusedSolarBodyIndex]?.isStar ? cat[focusedSolarBodyIndex] : cat[0])
      || null;
    const rec = recommendedL3Regime ?? (spec?.starIndex === 0 || spec === cat[0] ? activeCausalSystem?.recommendedL3Regime : null);
    const resolved = resolveStellarRegimeForStarSpec(spec, rec);
    const modeChanged = resolved.stellarMode !== stellarMode;
    const presetChanged = resolved.stellarMode === 'fusion' && resolved.stellarPreset !== stellarPreset;
    stellarMode = resolved.stellarMode;
    if (resolved.stellarMode === 'fusion') {
      stellarPreset = resolved.stellarPreset;
    }
    if (initializeNow) {
      if (stellarMode === 'fusion') {
        if (!stellarEngine || presetChanged || modeChanged) {
          await initStellarCore({ preset: stellarPreset });
        }
      } else {
        await setStellarMode(stellarMode);
      }
    }
    return resolved;
  }

  function unloadStarSystemRegimes({ resetModes = true } = {}) {
    // Always cleanly tear down surface session (and invalidate any in-flight enterSurfaceView!)
    exitSurfaceView();
    const disposeSession = (sess) => {
      if (sess && typeof sess.dispose === 'function') {
        try { sess.dispose(); } catch {}
      }
    };
    disposeSession(kerrJetSession); kerrJetSession = null; kerrJetTelemetry = null;
    disposeSession(relBinarySession); relBinarySession = null; relBinaryTelemetry = null; relBinaryMode = null;
    disposeSession(radWindL2Session); radWindL2Session = null; radWindL2Telemetry = null; radWindL2Mode = null;
    disposeSession(tidalRocheSession); tidalRocheSession = null; tidalRocheTelemetry = null; tidalRocheMode = null;
    disposeSession(protoplanetarySession); protoplanetarySession = null; protoplanetaryTelemetry = null;
    disposeSession(nebularCoalescenceSession); nebularCoalescenceSession = null; nebularCoalescenceTelemetry = null;
    disposeSession(nebulaMhdSession); nebulaMhdSession = null; nebulaMhdTelemetry = null; nebulaMhdStreamlines = null;
    disposeSession(radWindL3Session); radWindL3Session = null; radWindL3Telemetry = null; radWindL3Mode = null;
    disposeSession(magnetosphereSession); magnetosphereSession = null; magnetosphereTelemetry = null; magnetosphereMode = null; magnetosphereFieldLines = null;
    disposeSession(planetaryGenesisSphSession); planetaryGenesisSphSession = null; planetaryGenesisSphTelemetry = null; planetaryGenesisLiveForm = false;
    disposeSession(planetaryDynamoSession); planetaryDynamoSession = null; planetaryDynamoTelemetry = null; planetaryDynamoStreamlines = new Float32Array(0);
    disposeSession(cryoPlumeSession); cryoPlumeSession = null; cryoPlumeTelemetry = null;
    disposeSession(smbhEngine); smbhEngine = null; smbhBodies = null;
    planetaryResult = null;
    planetaryAtmoState = null;
    if (activeGenesisStage && activeGenesisStage.level >= 2) {
      activeGenesisStage = null;
    }
    if (resetModes) {
      galaxyBranch = 'solar-system';
      solarMode = 'nbody';
      planetaryMode = 'standard';
      planetaryCutaway = false;
      stellarMode = 'fusion';
    }
  }

  async function selectCausalStarSite({
    posGal,
    popTag = 0.5,
    starIndex = 0,
    forceMultiplicity = null,
    forceExoticStage = null,
    seedOverride = null,
    observeLive = false,
    bypassCache = false
  } = {}) {
    unloadStarSystemRegimes({ resetModes: true });
    activeStarSite = {
      posGal: Array.isArray(posGal) ? [...posGal] : [...activeStarSite.posGal],
      popTag: Number.isFinite(Number(popTag)) ? Number(popTag) : 0.5,
      starIndex: Math.trunc(Number(starIndex) || 0),
      forceExoticStage: forceExoticStage || null
    };
    galaxyFocusPos = [...activeStarSite.posGal];
    useSolReference = false;
    await initSolarSystem({ starSite: activeStarSite, forceMultiplicity, forceExoticStage, seedOverride, observeLive, bypassCache });
    // Cascade primary host star properties cleanly down into L3 stellar regime (preserving Pulsar/Magnetar/BH/WD/Supergiant!)
    const star0 = activeCausalSystem?.catalog?.[0] || activeCausalSystem?.starSystem?.stars?.[0];
    if (star0) {
      await syncStellarRegimeForStar(star0, {
        recommendedL3Regime: activeCausalSystem?.recommendedL3Regime,
        initializeNow: false
      });
    }
    return activeCausalSystem;
  }

  async function sampleNewGalacticSector({ forceMultiplicity = null, observeLive = false } = {}) {
    const nextIdx = (activeStarSite.starIndex || 0) + 1;
    const rRand = mulberry32((universeSeed ^ (nextIdx * 1103515245)) >>> 0);
    const r = 0.8 + Math.pow(rRand(), 0.72) * 8.2;
    const th = rRand() * Math.PI * 2;
    const zH = (rRand() - 0.5) * (r < 2.2 ? 1.4 : 0.42);
    const pop = r < 2.0 ? (0.08 + rRand() * 0.22) : (0.32 + rRand() * 0.65);
    return selectCausalStarSite({
      posGal: [Math.cos(th) * r, zH, Math.sin(th) * r],
      popTag: pop,
      starIndex: nextIdx,
      forceMultiplicity,
      observeLive
    });
  }

  async function setUseSolReference(enabled) {
    unloadStarSystemRegimes({ resetModes: true });
    useSolReference = Boolean(enabled);
    await initSolarSystem({ solReference: useSolReference });
    return getActiveSystemCatalog();
  }

  // ---- L2 Formation Mode: Whole-System GPU Nebular Coalescence + Protoplanetary Accretion Disk ----
  async function initProtoplanetaryDisk({ seedOverride = null } = {}) {
    if (protoplanetarySession) {
      protoplanetarySession.dispose();
      protoplanetarySession = null;
    }
    if (nebularCoalescenceSession) {
      nebularCoalescenceSession.dispose();
      nebularCoalescenceSession = null;
    }
    const activeSeed = ((seedOverride ?? universeSeed) + 773) >>> 0;
    const starSys = activeCausalSystem?.starSystem || null;
    const st0 = starSys?.stars?.[0] || { massSolar: 1.0, luminositySolar: 1.0 };
    const neb = starSys?.nebulaEnv || { metallicitySolar: 1.0, cToO: 0.55 };
    const fronts = activeCausalSystem?.condensationFrontsAu || { rMinStableAu: 0.14, rMaxStableAu: 28.0 };
    const w = getWorkloads();
    const pebCount = w.nebularParcels;
    const nextCoalesce = createNebularSystemCoalescenceSessionWebGpu(device, {
      starMassSolar: st0.massSolar || 1.0,
      starLuminositySolar: st0.luminositySolar || 1.0,
      metallicitySolar: neb.metallicitySolar ?? 1.0,
      cToO: neb.cToO ?? 0.55,
      gasFraction: activeGalaxyEnv?.gasFraction ?? 0.24,
      rMinStableAu: fronts.rMinStableAu || 0.14,
      rMaxStableAu: fronts.rMaxStableAu || 28.0,
      parcelCount: pebCount,
      radialBins: w.nebularRadialBins,
      enableGasDrag: protoplanetaryGasDrag,
      seed: activeSeed,
      label: 'ulg-universes-nebular-coalesce'
    });
    nebularCoalescenceTelemetry = await nextCoalesce.step({ dt: 0.024, substeps: 32, gravityCadence: w.l2GravityCadence || 4, readTelemetry: true, readAnnuli: true });
    nebularCoalescenceSession = nextCoalesce;

    const nextDisk = createProtoplanetaryDiskFormationSessionWebGpu(device, {
      pebbleCount: Math.min(8192, Math.max(1536, Math.round(w.nebularParcels * 0.4))),
      embryoCount: 18,
      starLuminositySolar: st0.luminositySolar || 1.0,
      enableGasDrag: protoplanetaryGasDrag,
      seed: activeSeed,
      label: 'ulg-universes-protoplanetary-disk'
    });
    protoplanetaryTelemetry = await nextDisk.step({ dt: 0.018, substeps: 3, readTelemetry: true });
    protoplanetarySession = nextDisk;
  }

  async function finalizeL1GalaxyGenesisInternal(fastFinish = false) {
    const stage = activeGenesisStage;
    if (!stage || stage.stage !== 'l1-galaxy-collapse') return null;
    const meta = stage._meta || {};
    const w = getWorkloads();
    if (fastFinish && galaxyEngine) {
      let rem = Math.max(0, Math.min(36, (stage.targetSteps || w.l1TargetSteps) - (stage.step || 0)));
      while (rem > 0) {
        const chunk = Math.min(12, rem);
        rem -= chunk;
        await galaxyEngine.step({ dt: 0.0085, substeps: chunk, gravity: 1.0, softening: 0.35, readback: false });
      }
      if (galacticDynamoSession) {
        galacticDynamoTelemetry = await galacticDynamoSession.step({
          particleBuffer: galaxyEngine.getResidentBuffer(),
          particleCount: galaxyEngine.count,
          dt: 0.036,
          substeps: 4,
          readTelemetry: true,
          readBField: true
        });
        galacticDynamoStreamlines = galacticDynamoSession.buildStreamlines({ worldScale: 1.0, alpha: 0.30 });
      }
    }
    const cacheKey = meta.galCacheKey || stage.cacheKey;
    const settledMorph = meta.targetMorphology || activeGalaxyEnv?.morphology || 'disk';
    if (cacheKey) {
      await rootLineageCache.set(cacheKey, {
        morphology: settledMorph,
        morphologyLabel: activeGalaxyEnv?.morphologyLabel || settledMorph,
        meanMetallicitySolar: galaxyMetallicity,
        baseFeH: activeGalaxyEnv?.baseFeH ?? Math.log10(Math.max(1e-4, galaxyMetallicity)),
        gasFraction: activeGalaxyEnv?.gasFraction ?? 0.22,
        starCount: galaxyEngine?.count || w.galaxyStars
      }, { persist: true, broadcast: true });
    }
    activeGenesisStage = null;
    lastGenesisEvent = Object.freeze({
      kind: 'genesis-complete',
      level: 1,
      stage: 'l1-galaxy-collapse',
      label: meta.entityName || activeGalaxyEnv?.morphologyLabel || 'Galaxy',
      detail: `${(galaxyEngine?.count || w.galaxyStars).toLocaleString()} stars collapsed & cached`,
      source: 'live-gpu',
      timestampMs: Date.now()
    });
    return lastGenesisEvent;
  }

  async function finalizeL2NebularGenesisInternal() {
    const stage = activeGenesisStage;
    const meta = stage?.stage === 'l2-nebular-coalescence' ? (stage._meta || {}) : {};
    const w = getWorkloads();
    if (!nebularCoalescenceSession) await initProtoplanetaryDisk();
    const curSteps = nebularCoalescenceSession?.stepIndex || 0;
    const remSub = curSteps < w.l2BurstSubsteps ? Math.max(24, w.l2BurstSubsteps - curSteps) : 8;
    const disk = await nebularCoalescenceSession.coalesceSystemBurst({ substeps: remSub, chunkSize: 96, gravityCadence: 6, dt: 0.024 });
    const activeSeed = meta.activeSeed ?? ((universeSeed + 409) >>> 0);
    const starSys = meta.starSys || activeCausalSystem?.starSystem || deriveStarSystemFromGalacticLocation({
      cosmicEpoch,
      galaxyEnv: activeGalaxyEnv,
      starPosGal: activeStarSite.posGal,
      popTag: activeStarSite.popTag,
      starIndex: activeStarSite.starIndex,
      seed: activeSeed
    });
    const fullDisk = Object.freeze({ ...disk, telemetry: nebularCoalescenceSession.getTelemetry() });
    const nebCacheKey = meta.nebCacheKey || rootLineageCache.buildKey('l2-nebular', {
      seed: activeSeed,
      epochId: cosmicEpochId,
      galaxyKey: activeGalaxyEnv?.seed || 0,
      starKey: `${activeStarSite.starIndex}_0_${activeStarSite.forceExoticStage || ''}`
    });
    await rootLineageCache.set(nebCacheKey, fullDisk, { persist: true, broadcast: true });
    useSolReference = false;
    activeCausalSystem = synthesizeNebularPlanetarySystem(starSys, {
      seedOverride: activeSeed,
      gpuCoalescedDisk: fullDisk
    });
    const cat = getActiveSystemCatalog();
    focusedSolarBodyIndex = getDefaultPlanetIndex(cat);
    planetaryBodyIndex = focusedSolarBodyIndex;
    if (solarEngine) { solarEngine.dispose(); solarEngine = null; }
    solarEngine = createSolarSystemNBodyEngineWebGpu(device, {
      catalog: cat,
      beltZoneAu: activeCausalSystem?.beltZoneAu,
      asteroidCount: quality.solarAsteroids,
      seed: activeSeed,
      label: `ulg-universes-crystallized-${activeCausalSystem?.systemId || 'sys'}`
    });
    await solarEngine.step({ dtSubYr: 0.000035, substeps: 4, readMassive: true });
    solarConservation0 = solarEngine.computeConservationDiagnostics();
    solarConservation = solarConservation0;
    planetaryResult = null;
    solarMode = 'nbody';
    // Keep the settled GPU nebular disk gently photoevaporating over ~6s inside the live N-body view
    // so there is ZERO abrupt visual cut from swirling SPH nebula -> mature orbiting planetary system!
    nebularSettleBlend = 1.0;
    const star0 = activeCausalSystem?.catalog?.[0] || activeCausalSystem?.starSystem?.stars?.[0];
    if (star0) {
      await syncStellarRegimeForStar(star0, {
        recommendedL3Regime: activeCausalSystem?.recommendedL3Regime,
        initializeNow: false
      });
    }
    if (activeGenesisStage?.stage === 'l2-nebular-coalescence') activeGenesisStage = null;
    lastGenesisEvent = Object.freeze({
      kind: 'genesis-complete',
      level: 2,
      stage: 'l2-nebular-coalescence',
      label: activeCausalSystem?.systemName || 'Star System',
      detail: `${activeCausalSystem?.planetCount || 0} worlds crystallized & cached`,
      source: 'live-gpu',
      timestampMs: Date.now()
    });
    return activeCausalSystem;
  }

  async function finalizeL4PlanetarySphGenesisInternal() {
    const stage = activeGenesisStage;
    const meta = stage?.stage === 'l4-planetary-sph' ? (stage._meta || {}) : {};
    const w = getWorkloads();
    if (!planetaryGenesisSphSession) {
      if (activeGenesisStage?.stage === 'l4-planetary-sph') activeGenesisStage = null;
      return null;
    }
    const curSteps = planetaryGenesisSphSession.stepIndex || 0;
    const remSub = curSteps < w.l4BurstSubsteps ? Math.max(6, w.l4BurstSubsteps - curSteps) : 2;
    planetaryGenesisSphTelemetry = await planetaryGenesisSphSession.stepBurst({
      totalSubsteps: remSub,
      chunkSize: 24,
      dt: 0.028,
      erosionPasses: w.sphErosionPasses,
      readTelemetry: true
    });
    const snapF32 = await planetaryGenesisSphSession.exportGeologyMapSnapshot();
    const cat = getActiveSystemCatalog();
    const spec = cat[planetaryBodyIndex] || REAL_SOLAR_SYSTEM_CATALOG[3];
    const sphCacheKey = meta.sphCacheKey || buildPlanetSphCacheKey(
      spec,
      planetaryBodyIndex,
      `${planetaryGenesisSphSession.mapWidth}x${planetaryGenesisSphSession.mapHeight}x${planetaryGenesisSphSession.gridN}`
    );
    if (snapF32) {
      const packedGeo = encodeFloat32Quantized(snapF32, 8000.0);
      if (packedGeo) {
        await rootLineageCache.set(sphCacheKey, {
          packedGeo,
          telemetry: planetaryGenesisSphTelemetry
        }, { persist: true, broadcast: false });
      }
    }
    // Keep a continuous post-formation thermal cooling ramp instead of snapping hot SPH -> cold world in 1 frame!
    // If genesis ran live on screen, surface lava fissures cool & steam condenses smoothly into oceans over ~5-6 seconds.
    const wasLiveForm = Boolean(planetaryGenesisLiveForm);
    planetaryGenesisLiveForm = false;
    planetaryCoolingHeat = wasLiveForm ? Math.max(planetaryCoolingHeat, 0.52) : 0.0;
    if (activeGenesisStage?.stage === 'l4-planetary-sph') activeGenesisStage = null;
    lastGenesisEvent = Object.freeze({
      kind: 'genesis-complete',
      level: 4,
      stage: 'l4-planetary-sph',
      label: meta.specName || spec?.name || 'World',
      detail: `Differentiated (${Math.round(planetaryGenesisSphTelemetry?.geoTimeMyr || 0)} Myr) & cached`,
      source: 'live-gpu',
      timestampMs: Date.now()
    });
    return planetaryGenesisSphTelemetry;
  }

  async function finalizeActiveGenesis() {
    if (!activeGenesisStage) return { finalized: false, stage: null, event: lastGenesisEvent };
    let guard = 0;
    while (busy && guard < 120) {
      guard += 1;
      await new Promise((r) => setTimeout(r, 4));
    }
    if (!activeGenesisStage) return { finalized: true, stage: null, event: lastGenesisEvent };
    const stName = activeGenesisStage.stage;
    busy = true;
    try {
      if (stName === 'l1-galaxy-collapse') await finalizeL1GalaxyGenesisInternal(true);
      else if (stName === 'l2-nebular-coalescence') await finalizeL2NebularGenesisInternal();
      else if (stName === 'l4-planetary-sph') await finalizeL4PlanetarySphGenesisInternal();
      else activeGenesisStage = null;
    } finally {
      busy = false;
    }
    return { finalized: true, stage: stName, event: lastGenesisEvent };
  }

  async function crystallizeCoalescedSystem() {
    let guard = 0;
    while (busy && guard < 120) {
      guard += 1;
      await new Promise((r) => setTimeout(r, 4));
    }
    busy = true;
    try {
      return await finalizeL2NebularGenesisInternal();
    } finally {
      busy = false;
    }
  }

  async function triggerGalaxyCoalescence({ seedOverride = null } = {}) {
    await initGalaxy({ galaxyEnvOverride: activeGalaxyEnv, seedOverride, observeLive: true, bypassCache: true });
    return activeGalaxyEnv;
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

  // Helper: compute live heliocentric sunDir (body -> Sun), 3D orbital velocity unit vector, and r_AU for any comet/planet!
  function computeLiveCometSolarVectors(bodyIdx = planetaryBodyIndex) {
    if (!solarEngine) {
      return { sourceDir: [0.76, 0.24, 0.60], orbVelDir: [-0.62, 0.0, 0.78], sunDistAu: 1.0, sublimationDrive: 1.35 };
    }
    const cat = solarEngine.catalog || getActiveSystemCatalog();
    const safeIdx = Math.max(0, Math.min(cat.length - 1, bodyIdx));
    const bSt = solarEngine.getMassiveBodyState64(safeIdx);
    const sSt = solarEngine.getMassiveBodyState64(0);
    const dx = sSt.posAu[0] - bSt.posAu[0];
    const dy = sSt.posAu[1] - bSt.posAu[1];
    const dz = sSt.posAu[2] - bSt.posAu[2];
    const rAu = Math.max(0.18, Math.hypot(dx, dy, dz));
    const sourceDir = [dx / rAu, dy / rAu, dz / rAu];
    const vx = (bSt.velAuYr?.[0] || 0) - (sSt.velAuYr?.[0] || 0);
    const vy = (bSt.velAuYr?.[1] || 0) - (sSt.velAuYr?.[1] || 0);
    const vz = (bSt.velAuYr?.[2] || 0) - (sSt.velAuYr?.[2] || 0);
    const vLen = Math.hypot(vx, vy, vz);
    const orbVelDir = vLen > 1e-6 ? [vx / vLen, vy / vLen, vz / vLen] : [-sourceDir[2], 0, sourceDir[0]];
    const subl = Math.max(0.65, Math.min(2.6, 1.45 / Math.pow(Math.max(0.35, rAu), 0.55)));
    return { sourceDir, orbVelDir, sunDistAu: rAu, sublimationDrive: subl };
  }

  // ---- L2 Wave-2 Radiative Outflow Regimes: Active Dual-Tail Comet & Hot-Jupiter XUV Photoevaporation ----
  async function initRadiativeWindL2(mode = 'comet-tails', { bodyIndex = null } = {}) {
    const prev = radWindL2Session;
    radWindL2Session = null;
    if (prev) prev.dispose();
    radWindL2Mode = mode;
    const isComet = mode === 'comet-tails';
    const liveVecs = (isComet && bodyIndex != null && solarEngine)
      ? computeLiveCometSolarVectors(bodyIndex)
      : {
        sourceDir: isComet ? [0.76, 0.24, 0.60] : [0.82, 0.14, 0.55],
        orbVelDir: isComet ? [-0.62, 0.0, 0.78] : [-0.55, 0.0, 0.83],
        sunDistAu: isComet ? 1.0 : 0.045,
        sublimationDrive: isComet ? 1.35 : 1.45
      };
    const next = createRadiativePhotoionizationWindSessionWebGpu(device, {
      regime: isComet ? 'comet-dual-tail' : 'hot-jupiter-xuv',
      uvFlux: isComet ? 1.45 : 2.35,
      radBeta: isComet ? 0.95 : 0.72,
      windSpeed: isComet ? 2.25 : 1.95,
      sublimationDrive: liveVecs.sublimationDrive,
      sourceDir: liveVecs.sourceDir,
      orbVelDir: liveVecs.orbVelDir,
      sunDistAu: liveVecs.sunDistAu,
      particleCount: quality.id === 'low' ? 3072 : 5120,
      seed: (universeSeed ^ (isComet ? 0xc03e7 : 0x40710)) >>> 0,
      label: `ulg-universes-radl2-${mode}`
    });
    for (let w = 0; w < 8; w += 1) {
      radWindL2Telemetry = await next.step({
        dt: 0.04,
        substeps: 3,
        sourceDir: liveVecs.sourceDir,
        orbVelDir: liveVecs.orbVelDir,
        sublimationDrive: liveVecs.sublimationDrive,
        sunDistAu: liveVecs.sunDistAu,
        readTelemetry: w === 7
      });
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
      orbitRadiusSim: mode === 'roche-rings' ? 2.35 : (mode === 'tde' ? 3.2 : 2.8),
      rHostSim: mode === 'red-giant' ? 1.85 : (mode === 'tde' ? 1.05 : (mode === 'giant-impact' ? 1.48 : 1.38)),
      rRocheSim: mode === 'tde' ? 5.2 : 3.65,
      gmHost: mode === 'tde' ? 38.0 : 24.0,
      cohesionStrength: 0.55,
      tidalHeatDrive: mode === 'tde' ? 1.85 : 1.25,
      shepherdGm: 0.72,
      particleCount: quality.id === 'low' ? 3072 : 5120,
      seed: (universeSeed ^ (mode.length * 4099)) >>> 0,
      label: `ulg-universes-tidal-${mode}`
    });
    const warm = mode === 'roche-rings' ? 12 : (mode === 'catastrophic-shatter' ? 4 : (mode === 'tde' ? 8 : 6));
    for (let w = 0; w < warm; w += 1) {
      tidalRocheTelemetry = await next.step({ dt: 0.028, substeps: 3, readTelemetry: w === warm - 1 });
    }
    tidalRocheSession = next;
  }

  async function triggerCatastrophicShatter(bodySpec = null, { excessRatio = 1.6 } = {}) {
    const prev = tidalRocheSession;
    tidalRocheSession = null;
    if (prev) prev.dispose();
    const bid = bodySpec?.id || getActiveSystemCatalog()[focusedSolarBodyIndex]?.id || 'asteroid';
    shatteredBodyIds.add(bid);
    shatterOriginBodyName = bodySpec?.name || getActiveSystemCatalog()[focusedSolarBodyIndex]?.name || 'Target Body';
    solarMode = 'catastrophic-shatter';
    tidalRocheMode = 'catastrophic-shatter';
    const next = createTidalRocheDisruptionSessionWebGpu(device, {
      mode: 'catastrophic-shatter',
      orbitRadiusSim: 2.2,
      rHostSim: 1.0,
      rRocheSim: 2.2,
      gmHost: 6.0,
      cohesionStrength: 0.25,
      tidalHeatDrive: Math.max(1.2, Math.min(3.0, 1.55 * excessRatio)),
      shepherdGm: 0.0,
      particleCount: quality.id === 'low' ? 3072 : 5120,
      seed: (universeSeed ^ (bid.length * 8191 + 0x54a77e)) >>> 0,
      label: `ulg-universes-shatter-${bid}`
    });
    for (let w = 0; w < 4; w += 1) {
      tidalRocheTelemetry = await next.step({ dt: 0.026, substeps: 3, readTelemetry: w === 3 });
    }
    tidalRocheSession = next;
    return tidalRocheTelemetry;
  }

  // ---- L3 Wave-2 Photoionized Nebulae: H II Pillars, Planetary Nebula, SNR / Crab PWN ----
  async function initRadiativeWindL3(mode = 'h2-pillars') {
    const prev = radWindL3Session;
    radWindL3Session = null;
    if (prev) prev.dispose();
    radWindL3Mode = mode;
    const next = createRadiativePhotoionizationWindSessionWebGpu(device, {
      regime: mode,
      uvFlux: mode === 'snr-pwn' ? 1.85 : (mode === 'wr-bubble' ? 1.95 : (mode === 'planetary-nebula' ? 1.65 : (mode === 'reflection-nebula' ? 1.55 : 1.48))),
      radBeta: mode === 'wr-bubble' ? 1.35 : (mode === 'snr-pwn' ? 1.0 : 0.88),
      windSpeed: mode === 'snr-pwn' ? 2.15 : (mode === 'wr-bubble' ? 1.95 : (mode === 'planetary-nebula' ? 1.68 : 1.15)),
      bipolarAsymmetry: mode === 'wr-bubble' ? 1.85 : 1.45,
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
    magnetosphereFieldLines = next.buildDipoleFieldLines({ linesPerRing: 16, steps: 32, worldScale: 1.0, alpha: 0.74 });
    magnetosphereSession = next;
  }

  // ---- L3 Wave-2 GR TOV Unified Degenerate EOS (White Dwarf -> Neutron Star -> Black Hole) ----
  async function initWhiteDwarfTovCurve() {
    const samples = [];
    // 16 log-spaced central densities spanning WD (1e8..1e12), unstable gap (1e13..1e15), NS (2e17..5e18), BH (>8e18)
    const logRhos = [8.2, 8.8, 9.4, 10.0, 10.6, 11.3, 12.2, 13.5, 15.0, 17.2, 17.6, 17.9, 18.2, 18.5, 18.8, 19.2];
    for (const lr of logRhos) {
      samples.push({ centralRhoKgM3: Math.pow(10, lr), yElectron: 0.5 });
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

  // ---- L3: Hydrostatic 1st-Gen Pop III / 2nd-Gen Pop II / 3rd-Gen Pop I 3D MLS-MPM Fusion + SS Multipole Gravity ----
  async function initStellarCore({ preset = stellarPreset, seedOverride = null } = {}) {
    const mpmClasses = [
      'pop3-first-gen',
      'pop2-second-gen',
      'main-sequence-star',
      'blue-supergiant',
      'red-supergiant',
      'agb-carbon',
      'brown-dwarf'
    ];
    const allPresets = [...mpmClasses, 'solar-nebula', 'massive-supernova', 'binary-nursery'];
    stellarPreset = allPresets.includes(preset) ? preset : 'main-sequence-star';
    if (stellarEngine) {
      stellarEngine.dispose();
      stellarEngine = null;
    }
    if (stellarDynamoSession) {
      stellarDynamoSession.dispose();
      stellarDynamoSession = null;
    }
    if (!stellarClosureRef) {
      const reg = await registerPlasmaFusionClosureArtifact({ closureRegistry, device });
      stellarClosureRef = reg.ref;
    }
    const activeSeed = ((seedOverride ?? universeSeed) + 1939) >>> 0;
    const w = getWorkloads();
    const isHydrostaticStar = mpmClasses.includes(stellarPreset);
    if (isHydrostaticStar) {
      // Pass 2 / Phase C Deep LOD Exemplar: True 3D GPU MLS-MPM + Canonical SS Scale-Atlas Multipole Stellar Fusion & Convection!
      // Forward the active system host star's continuous physical (massSolar, surfaceTempK, metallicity Z) instead of collapsing all stars to 1 M_sun!
      const hostStarCat = getActiveSystemCatalog()[0] || null;
      const useHostSpec = !useSolReference && hostStarCat && Number.isFinite(Number(hostStarCat.massSolar))
        && (stellarPreset === 'main-sequence-star' || stellarPreset === 'blue-supergiant' || stellarPreset === 'red-supergiant' || stellarPreset === 'brown-dwarf');
      const hostZSolar = Number(activeCausalSystem?.nebulaEnv?.metallicitySolar);
      stellarEngine = createStellarMlsMpmFusionSessionWebGpu(device, {
        count: w.stellarParcels,
        gridN: w.stellarGridN,
        stellarClass: stellarPreset,
        starMassSolar: useHostSpec ? Number(hostStarCat.massSolar) : undefined,
        surfaceTempK: useHostSpec && Number.isFinite(Number(hostStarCat.tempK)) ? Number(hostStarCat.tempK) : undefined,
        xZ0: useHostSpec && Number.isFinite(hostZSolar) ? Math.max(1e-5, Math.min(0.06, 0.014 * hostZSolar)) : undefined,
        boxHalf: 7.5,
        seed: activeSeed,
        label: `ulg-universes-stellar-mpm-${stellarPreset}`
      });
      for (let wStep = 0; wStep < 6; wStep += 1) {
        stellarTelemetry = await stellarEngine.step({
          dt: 0.015,
          timeAccel: stellarTimeAccel,
          readTelemetry: wStep === 5
        });
      }
    } else {
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
        rCellFactor: 0.075,
        softening: 0.25,
        baseLogRho: -16.2,
        refRhoSim: 0.08,
        tScaleK: 7.8e5,
        label: `ulg-universes-stellar-${stellarPreset}`
      });
      stellarTelemetry = await stellarEngine.step({
        dt: 0.015,
        timeAccel: stellarTimeAccel,
        readTelemetry: true
      });
    }
    // Live GPU 24^3 3D Stellar Convective Dynamo driven strictly by live stellar plasma velocities!
    stellarDynamoSession = createEmergent3dDynamoFieldWebGpu(device, {
      gridN: 24,
      boxSize: 16.0,
      strideFloats: 16,
      geometry: 'stellar',
      initialB0: stellarB0,
      alphaAmp: 0.22,
      etaRes: 0.055,
      bSat: 0.95,
      velScale: 0.35,
      label: 'ulg-universes-stellar-dynamo'
    });
    stellarDynamoTelemetry = await stellarDynamoSession.step({
      particleBuffer: stellarEngine.getResidentBuffer(),
      particleCount: stellarEngine.count,
      dt: 0.042,
      substeps: 8,
      readTelemetry: true,
      readBField: true
    });
    stellarDynamoStreamlines = stellarDynamoSession.buildStreamlines({ worldScale: 1.0, alpha: 0.42 });
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

  /**
   * Detonate the currently fused L3 stellar core (e.g. 1st-Gen Pop III -> 2nd-Gen Pop II,
   * or 2nd-Gen Pop II -> 3rd-Gen Pop I), read its REAL GPU-synthesized CNO & α/Fe yields,
   * enrich the local galactic ISM, and launch live L2 GPU Nebular Coalescence for the next generation!
   */
  async function detonateCoreSeedNextGeneration() {
    if (!stellarEngine || typeof stellarEngine.exportSupernovaYields !== 'function') {
      await initStellarCore({ preset: 'pop3-first-gen' });
    }
    const yields = stellarEngine.exportSupernovaYields();
    lastSupernovaYields = yields;
    activeGalaxyEnv = Object.freeze({
      ...activeGalaxyEnv,
      meanMetallicitySolar: yields.metallicitySolar,
      baseFeH: yields.feH,
      baseCO: yields.cToO,
      alphaOverFe: yields.alphaOverFe,
      seededBySupernova: yields
    });
    const nextStarIdx = ((activeStarSite.starIndex || 0) + 1) >>> 0;
    const nextPopTag = yields.nextGeneration === 2 ? 0.14 : 0.62;
    const sys = await selectCausalStarSite({
      posGal: activeStarSite.posGal,
      popTag: nextPopTag,
      starIndex: nextStarIdx,
      observeLive: true,
      bypassCache: true
    });
    if (activeGenesisStage?.stage === 'l2-nebular-coalescence') {
      const genTag = yields.nextGeneration === 2 ? '2nd-Gen Pop II (α-rich)' : '3rd-Gen Pop I (Metal-Rich)';
      activeGenesisStage.title = `Supernova Yields → Coalescing ${genTag} Nebula`;
      activeGenesisStage.detail = `Seeded from Gen-${yields.progenitorGeneration} core (CNO ${(yields.fusedXCNO * 100).toFixed(3)}%, α/Fe ${(yields.fusedXAlphaFe * 100).toFixed(3)}%, [Fe/H]=${yields.feH.toFixed(2)}) · ${activeGenesisStage.detail}`;
    }
    return {
      yields,
      system: sys,
      stage: getActiveGenesisPublicState()
    };
  }

  // ---- L4: Planetary Hydrostatic Interior (Inline WGSL Polytope Atlas) ----
  async function initPlanetaryInterior({ bodyIndex = planetaryBodyIndex, observeLive = false, bypassCache = false } = {}) {
    const cat = getActiveSystemCatalog();
    let idx = Math.max(0, Math.min(cat.length - 1, Math.trunc(Number(bodyIndex) ?? planetaryBodyIndex)));
    if (cat[idx]?.isStar || idx === 0) {
      const alt = getDefaultPlanetIndex(cat);
      if (alt > 0) idx = alt;
    }
    planetaryBodyIndex = idx;
    if (activeGenesisStage?.level === 4) {
      activeGenesisStage = null;
    }
    const spec = cat[idx] || REAL_SOLAR_SYSTEM_CATALOG[3];
    const zCore = spec.coreZ || 26;
    const zMantle = spec.mantleZ || 14;
    const zSurf = spec.surfZ || 29;
    // Propagate planet's derived crust/core elemental identity downward to L5/L6/L7!
    if (!mdSession) mdElementZ = zSurf;
    if (!orbitalCloud) quantumZ = zCore;
    if (!nuclearResult) nuclearZ = zCore;

    const [coreRes, mantleRes, surfRes] = await Promise.all([
      getElementBundle(zCore, { relativistic: true, returnOrbitalWavefunctions: false }),
      getElementBundle(zMantle, { relativistic: true, returnOrbitalWavefunctions: false }),
      getElementBundle(zSurf, { relativistic: true, returnOrbitalWavefunctions: false })
    ]);

    // Dogfood Gate 2 compound bundles from `foundation-polytope-atlas.json` for planetary
    // silicate/water/ice/hydrogen interiors instead of collapsing compounds to monatomic elements!
    const specRadiusM = Math.max(1e5, (Number(spec.radiusKm) || 6371) * 1000);
    const specMassKg = Math.max(1e19, (Number(spec.massSolar) || 3.00349e-6) * 1.98847e30);
    const isGiantInterior = specRadiusM >= 1.6e7 || spec.planetClass === 'gas-giant' || spec.planetClass === 'hot-jupiter' || spec.planetClass === 'ice-giant';
    const isIcyMantle = spec.planetClass === 'ice-giant' || spec.planetClass === 'ocean-world' || spec.planetClass === 'icy-dwarf' || zMantle === 8;
    const preferredMantleFormula = (spec.planetClass === 'gas-giant' || spec.planetClass === 'hot-jupiter' || zMantle === 1)
      ? 'H2'
      : (isIcyMantle ? 'H2O' : (zMantle === 12 ? 'MgO' : (zMantle === 6 ? 'CH4' : (zMantle === 7 ? 'NH3' : 'SiO2'))));
    const preferredCoreFormula = zCore === 1 ? 'H2' : (zCore === 8 ? 'H2O' : (zCore === 14 ? 'SiO2' : null));
    const mantleCompoundBundle = getCompoundBundleFromAtlas(preferredMantleFormula);
    const coreCompoundBundle = preferredCoreFormula ? getCompoundBundleFromAtlas(preferredCoreFormula) : null;
    const coreInteriorBundle = coreCompoundBundle || coreRes.bundle;
    const mantleInteriorBundle = mantleCompoundBundle || mantleRes.bundle;
    const coreMaterialLabel = coreCompoundBundle ? coreCompoundBundle.formula : coreRes.bundle.symbol;
    const mantleMaterialLabel = mantleCompoundBundle ? mantleCompoundBundle.formula : mantleRes.bundle.symbol;

    const getOrBuildAtlas = async (bundle) => {
      const k = `${bundle.materialKey || bundle.symbol || bundle.formula}:planetary:${isGiantInterior ? '8tpa' : '1tpa'}`;
      if (planetaryAtlasCache.has(k)) return planetaryAtlasCache.get(k);
      const atlas = await buildPlanetaryPolytopeAtlasWebGpu(device, bundle, {
        minPressurePa: 1e4,
        maxPressurePa: isGiantInterior ? 8e12 : 2e12,
        maxTemperatureK: isGiantInterior ? 16000 : 12000,
        degrees: [4, 4],
        relativeTolerance: 3e-2,
        maxBisectDepth: 2
      });
      planetaryAtlasCache.set(k, atlas);
      return atlas;
    };

    const [coreAtlas, mantleAtlas] = await Promise.all([
      getOrBuildAtlas(coreInteriorBundle),
      getOrBuildAtlas(mantleInteriorBundle)
    ]);

    const centralP = Math.max(1e8, Math.min(isGiantInterior ? 8e12 : 2e12, Number(spec.centralP) || (isGiantInterior ? 1.5e12 : 360e9)));
    const surfP = Math.max(1e3, Math.min(1e8, Number(spec.surfacePressurePa) || 1e5));
    const coreMassFrac = Number.isFinite(Number(spec.coalescedComposition?.feFrac))
      ? Math.max(0.06, Math.min(0.75, Number(spec.coalescedComposition.feFrac)))
      : (isGiantInterior ? 0.12 : 0.32);
    const coreTempK = isGiantInterior ? 14000 : Math.max(1200, Math.min(12000, Math.round(2800 + Math.pow(specMassKg / 5.972e24, 0.35) * 2400)));
    const mantleTempK = Math.max(400, Math.round(coreTempK * 0.44));
    const maxR = Math.max(3.5e7, specRadiusM * 2.4);
    const adaptiveRadialStepM = Math.min(1.8e5, Math.max(250, Math.round(specRadiusM / 56)));
    planetaryResult = await solvePlanetaryInteriorWebGpu(device, {
      centralPressurePa: centralP,
      surfacePressurePa: surfP,
      radialStepM: adaptiveRadialStepM,
      maxRadiusM: maxR,
      initialMassKg: specMassKg,
      convergePasses: 4,
      maxProfileSamples: 128,
      layers: [
        { name: `${coreMaterialLabel} Core`, massFractionTarget: coreMassFrac, tempK: coreTempK, atlas: coreAtlas },
        { name: `${mantleMaterialLabel} Mantle`, massFractionTarget: Math.max(0.1, 1.0 - coreMassFrac), tempK: mantleTempK, atlas: mantleAtlas }
      ]
    });

    let rCoreNorm = Math.max(0.18, Math.min(0.78, Math.cbrt(coreMassFrac * 0.52)));
    const prof = planetaryResult?.profile || [];
    const totalR = Math.max(1, planetaryResult?.radiusM || specRadiusM);
    for (let i = 0; i < prof.length; i += 1) {
      if ((prof[i].layerIndex ?? 0) >= 1) {
        rCoreNorm = Math.max(0.18, Math.min(0.82, prof[i].radiusM / totalR));
        break;
      }
    }

    planetaryLayersMeta = [
      {
        id: 'layer-core',
        level: 4,
        name: `${spec.name} · ${coreMaterialLabel} Core`,
        subtitle: `Gate 2 Polytope Atlas · P_c = ${(centralP / 1e9).toFixed(0)} GPa · T_c = ${coreTempK.toLocaleString()} K · MoI = ${(planetaryResult?.moiFactor || 0.33).toFixed(3)}`,
        pos: [0.45, 0.35, 0.45],
        radius: 0.7,
        sampleZ: zCore,
        formula: coreMaterialLabel,
        rCoreNorm,
        rMantleNorm: 0.94,
        tempK: coreTempK,
        massLabel: `R = ${spec.radiusKm.toLocaleString()} km`,
        composition: spec.composition,
        nextLevel: 5
      },
      {
        id: 'layer-mantle',
        level: 4,
        name: `${spec.name} · ${mantleMaterialLabel} Mantle`,
        subtitle: `Gate 2 ${mantleMaterialLabel} Polytope Shell · T = ${mantleTempK.toLocaleString()} K`,
        pos: [1.35, 1.05, 1.35],
        radius: 0.7,
        sampleZ: zMantle,
        formula: mantleMaterialLabel,
        rCoreNorm,
        rMantleNorm: 0.94,
        tempK: mantleTempK,
        massLabel: `g = ${(planetaryResult?.surfaceGravityMPerS2 || 9.8).toFixed(2)} m/s²`,
        composition: mantleCompoundBundle ? `${mantleMaterialLabel} Gate 2 Compound Mantle` : `${mantleRes.bundle.symbol} Mantle`,
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
        formula: isIcyMantle ? 'H2O' : (zSurf === 14 ? 'SiO2' : surfRes.bundle.symbol),
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
    const parentSpec = spec.parent >= 0 ? cat[spec.parent] : null;
    const distAu = Math.max(0.15, Number(spec.aAu || parentSpec?.aAu || 1.0));
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

    // 3D Multi-Material WebGPU SPH Planetary/Moon/Asteroid/Comet Genesis (ZERO Perlin Continents!):
    // Runs on EVERY solid-crust body (< 16,000 km) seeded from its GPU-coalesced material fractions!
    if (planetaryGenesisSphSession) {
      planetaryGenesisSphSession.dispose();
      planetaryGenesisSphSession = null;
      planetaryGenesisSphTelemetry = null;
    }
    if (planetaryDynamoSession) {
      planetaryDynamoSession.dispose();
      planetaryDynamoSession = null;
      planetaryDynamoTelemetry = null;
      planetaryDynamoStreamlines = new Float32Array(0);
    }
    planetaryGenesisLiveForm = false;
    planetaryCoolingHeat = 0.0;
    planetarySecularTick = 0;
    const sphAct = evaluatePlanetaryGenesisSphActivation(spec);
    if (sphAct.active) {
      const w = getWorkloads();
      const sphW = w.sphMapWidth;
      const sphH = w.sphMapHeight;
      const sphGridN = w.sphGridN;
      const nextSph = createPlanetaryGenesisSphSessionWebGpu(device, spec, {
        nebulaEnv: useSolReference ? null : activeCausalSystem?.starSystem?.nebulaEnv,
        planetaryAtmoState,
        planetaryMode,
        systemAgeGyr: useSolReference ? 4.57 : (activeCausalSystem?.starSystem?.systemAgeGyr ?? 4.5),
        parcelCount: w.sphParcels,
        gridN: sphGridN,
        mapWidth: sphW,
        mapHeight: sphH,
        targetSteps: observeLive ? w.l4TargetSteps : w.l4BurstSubsteps,
        seed: (universeSeed ^ (idx * 2654435761 + (spec.id?.length || 3) * 131)) >>> 0,
        label: `ulg-universes-sph-genesis-${spec.id || idx}`
      });
      const sphCacheKey = buildPlanetSphCacheKey(spec, idx, `${sphW}x${sphH}x${sphGridN}`);
      const cachedSph = bypassCache ? null : await rootLineageCache.get(sphCacheKey);
      const cachedGeoF32 = cachedSph?.packedGeo ? decodeFloat32Quantized(cachedSph.packedGeo) : null;
      if (cachedGeoF32 && nextSph.hydrateGeologyMapSnapshot(cachedGeoF32, cachedSph.telemetry)) {
        planetaryGenesisSphTelemetry = nextSph.getTelemetry();
        planetaryGenesisLiveForm = false;
        lastGenesisEvent = Object.freeze({
          kind: 'cache-hit',
          level: 4,
          stage: 'l4-planetary-sph',
          label: spec.name || `World #${idx}`,
          source: 'root-cache',
          timestampMs: Date.now()
        });
      } else if (observeLive) {
        // Live Observable 3D GPU SPH + SS Multipole Planetary Differentiation right on screen!
        // Warm-start 12 substeps so the 3D volumetric grid (Fe core + magma mantle) renders richly on frame 1!
        planetaryGenesisSphTelemetry = await nextSph.step({
          dt: 0.028,
          substeps: 12,
          updateSurfaceMap: true,
          erosionPasses: 4,
          readTelemetry: true
        });
        planetaryGenesisLiveForm = true;
        planetaryCoolingHeat = 1.0;
        activeGenesisStage = {
          level: 4,
          stage: 'l4-planetary-sph',
          title: `Differentiating World via 3D SPH + SS Multipole (${activeCapabilityProfile.tier.toUpperCase()})`,
          entityName: spec.name || `World #${idx}`,
          detail: `Era 1: Iron Catastrophe · Core r=${(planetaryGenesisSphTelemetry?.coreMeanR || 0.5).toFixed(2)} · Crust r=${(planetaryGenesisSphTelemetry?.felsicMeanR || 0.7).toFixed(2)} · ${nextSph.parcelCount.toLocaleString()} SPH · ${nextSph.gridN}³ · ${sphW}×${sphH}`,
          step: nextSph.stepIndex,
          targetSteps: w.l4TargetSteps,
          progress: Math.min(1, nextSph.stepIndex / Math.max(1, w.l4TargetSteps)),
          cacheKey: sphCacheKey,
          skipLabel: '⏩ Finish Formation',
          startedMs: Date.now(),
          _meta: { sphCacheKey, bodyIndex: idx, specName: spec.name || `World #${idx}` }
        };
        lastGenesisEvent = Object.freeze({
          kind: 'genesis-started',
          level: 4,
          stage: 'l4-planetary-sph',
          label: spec.name || `World #${idx}`,
          source: 'live-gpu',
          timestampMs: Date.now()
        });
      } else {
        planetaryGenesisSphTelemetry = await nextSph.stepBurst({
          totalSubsteps: w.l4BurstSubsteps,
          chunkSize: 24,
          dt: 0.028,
          erosionPasses: w.sphErosionPasses,
          readTelemetry: true
        });
        const snapF32 = await nextSph.exportGeologyMapSnapshot();
        if (snapF32) {
          const packedGeo = encodeFloat32Quantized(snapF32, 8000.0);
          if (packedGeo) {
            void rootLineageCache.set(sphCacheKey, {
              packedGeo,
              telemetry: planetaryGenesisSphTelemetry
            }, { persist: true, broadcast: false });
          }
        }
      }
      planetaryGenesisSphSession = nextSph;
      // Coupled Live 3D GPU Planetary Geodynamo driven STRICTLY by the live convecting Fe-Ni SPH core!
      // Exact Star Spec null limit: non-conducting/dead cores (`bEqT <= 1e-7`) produce zero magnetic field!
      const bEqT = Number(planetaryAtmoState?.dynamo?.bEquatorialT) || 0;
      const dynActive = Boolean(bEqT > 1e-7 && !nextSph.genesisParams?.isMinorBody);
      const bSeedPlan = dynActive ? Math.max(0.12, Math.min(0.65, Math.sqrt(Math.max(1e-7, bEqT) / 3.0e-5) * 0.34)) : 0.0;
      if (bSeedPlan > 1e-6) {
        const nextPlanDyn = createEmergent3dDynamoFieldWebGpu(device, {
          gridN: 16,
          boxSize: 3.3,
          strideFloats: 16,
          geometry: 'planetary',
          initialB0: bSeedPlan,
          alphaAmp: 0.24 * Math.max(0.35, Math.min(1.6, nextSph.genesisParams?.rotationOmegaNorm || 1.0)),
          etaRes: 0.055,
          bSat: 0.92,
          velScale: 0.65,
          label: `ulg-universes-planetary-geodynamo-${spec.id || idx}`
        });
        planetaryDynamoTelemetry = await nextPlanDyn.step({
          particleBuffer: nextSph.getResidentParcelsBuffer(),
          particleCount: nextSph.parcelCount,
          dt: 0.045,
          substeps: 6,
          readTelemetry: true,
          readBField: true
        });
        planetaryDynamoStreamlines = nextPlanDyn.buildStreamlines({ worldScale: 1.0, alpha: 0.42 });
        planetaryDynamoSession = nextPlanDyn;
      }
    }
    // Zooming into an active Comet triggers live solar-flux sublimation outgassing jets aligned strictly anti-solar!
    if (spec.isComet) {
      await initRadiativeWindL2('comet-tails', { bodyIndex: idx });
    }
  }

  function setPlanetaryGenesisLiveForm(enabled) {
    planetaryGenesisLiveForm = Boolean(enabled);
    if (!planetaryGenesisLiveForm && activeGenesisStage?.stage === 'l4-planetary-sph') {
      activeGenesisStage = null;
    }
    return planetaryGenesisLiveForm;
  }

  async function triggerPlanetSphGenesisReplay() {
    if (!planetaryGenesisSphSession) {
      await initPlanetaryInterior({ bodyIndex: planetaryBodyIndex, observeLive: true, bypassCache: true });
      return planetaryGenesisSphTelemetry;
    }
    const w = getWorkloads();
    const cat = getActiveSystemCatalog();
    const spec = cat[planetaryBodyIndex] || REAL_SOLAR_SYSTEM_CATALOG[3];
    const sphCacheKey = buildPlanetSphCacheKey(
      spec,
      planetaryBodyIndex,
      `${planetaryGenesisSphSession.mapWidth}x${planetaryGenesisSphSession.mapHeight}x${planetaryGenesisSphSession.gridN}`
    );
    planetaryGenesisSphSession.resetToProtoplanet();
    planetaryGenesisLiveForm = true;
    planetaryCoolingHeat = 1.0;
    planetaryGenesisSphTelemetry = await planetaryGenesisSphSession.step({
      dt: 0.028,
      substeps: 12,
      updateSurfaceMap: true,
      erosionPasses: 4,
      readTelemetry: true
    });
    activeGenesisStage = {
      level: 4,
      stage: 'l4-planetary-sph',
      title: `Differentiating World via 3D SPH + SS Multipole (${activeCapabilityProfile.tier.toUpperCase()})`,
      entityName: spec?.name || `World #${planetaryBodyIndex}`,
      detail: `Age ${Math.round(planetaryGenesisSphTelemetry?.geoTimeMyr || 0)} Myr · Core r=${(planetaryGenesisSphTelemetry?.coreMeanR || 0.5).toFixed(2)} · Crust r=${(planetaryGenesisSphTelemetry?.felsicMeanR || 0.7).toFixed(2)} · ${planetaryGenesisSphSession.parcelCount.toLocaleString()} SPH`,
      step: planetaryGenesisSphSession.stepIndex,
      targetSteps: w.l4TargetSteps,
      progress: Math.min(1, planetaryGenesisSphSession.stepIndex / Math.max(1, w.l4TargetSteps)),
      cacheKey: sphCacheKey,
      skipLabel: '⏩ Finish Formation',
      startedMs: Date.now(),
      _meta: { sphCacheKey, bodyIndex: planetaryBodyIndex, specName: spec?.name || `World #${planetaryBodyIndex}` }
    };
    return planetaryGenesisSphTelemetry;
  }

  const compoundMdCache = new Map();

  // ---- L5: Crystal & Fluid Molecular Dynamics ----
  async function initMolecularDynamics({ Z = mdElementZ, formula = null, tempK = null, phasePreset = null, gravity = mdGravity } = {}) {
    mdElementZ = Math.max(1, Math.min(118, Math.trunc(Number(Z) || 26)));
    mdGravity = Boolean(gravity);
    if (mdSession) {
      mdSession.destroy();
      mdSession = null;
    }

    // Dogfood Gate 2 `deriveCompoundBundleWebGpu` whenever a compound formula (e.g. SiO2, H2O,
    // CH4, NH3, CO2, NaCl, FeO, MgO) is sampled from a planet crust/ocean/atmosphere!
    const cleanFormula = normalizeChemicalFormula(formula);
    const isMultiElementCompound = cleanFormula.length >= 2 && (/\d/.test(cleanFormula) || /[A-Z].*[A-Z]/.test(cleanFormula));
    let compoundRes = null;
    if (isMultiElementCompound) {
      try {
        if (compoundMdCache.has(cleanFormula)) {
          compoundRes = compoundMdCache.get(cleanFormula);
        } else {
          compoundRes = await deriveCompoundBundleWebGpu(device, cleanFormula, {
            runLiveMd: false,
            reactionContext: { source: 'ulg-universes-l5-compound-md' }
          });
          compoundMdCache.set(cleanFormula, compoundRes);
        }
      } catch {
        compoundRes = null;
      }
    }

    const c = quality.mdCells;
    if (compoundRes?.visualData?.mdConfig && compoundRes?.bundle) {
      const cfg = compoundRes.visualData.mdConfig;
      const b = compoundRes.bundle;
      const tMelt = Math.max(20, Number(b.thermodynamic.meltingPointK || 300));
      const tBoil = Math.max(tMelt * 1.25 + 10, Number(b.thermodynamic.boilingPointK || tMelt * 2.2));
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
      const init = buildCrystalMdState({
        crystalStructure: cfg.crystalStructure,
        cellsVec: [c, c, c],
        latticeConstantA: Math.max(2.4, Number(cfg.latticeConstantA || 4.0)),
        massU: Math.max(1, Number(cfg.massU || 18)),
        temperatureK: mdTempK
      });
      mdSession = createMolecularDynamicsSessionWebGpu(device, {
        ...init,
        potentialModel: cfg.potentialModel,
        epsilonEv: cfg.epsilonEv,
        sigmaOrR0A: cfg.sigmaOrR0A,
        alphaOrLambda: cfg.alphaOrLambda,
        rcutA: cfg.rcutA,
        eamAEv: cfg.eamAEv,
        eamBeta: cfg.eamBeta,
        swGamma: cfg.swGamma,
        dtFs: cfg.dtFs,
        targetTemperatureK: mdTempK,
        thermostatCouplingFs: 20,
        meltingPointK: tMelt,
        bulkModulusGPa: Math.max(1, Number(b.mechanical?.bulkModulusPa || 20e9) / 1e9),
        cohesiveEnergyEv: Math.max(0.05, Number(b.mechanical?.cohesiveEnergyEv || 1.2)),
        crystalStructure: cfg.crystalStructure,
        gravityEnabled: mdGravity
      });
      mdTelemetry = await mdSession.stepBatch(4, { readTelemetry: true, targetTemperatureK: mdTempK });
      mdRdfHistory = mdTelemetry?.rdf ? Array.from(mdTelemetry.rdf) : [];
      return;
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
      // Dogfood the live GPU-converged RHF AO/MO eigenvectors (`atomOrbitalParams`) directly
      // instead of overwriting them with hardcoded alternating weights!
      const rhfOrb = moleculeRhfResult?.atomOrbitalParams || null;
      let posZeta = rhfOrb?.posZeta || null;
      let weights = rhfOrb?.weights || null;
      let boxHalfBohr = Number(rhfOrb?.boxHalfBohr) || 4.2;
      if (!(posZeta instanceof Float32Array) || !(weights instanceof Float32Array) || posZeta.length < spec.atoms.length * 4) {
        posZeta = new Float32Array(spec.atoms.length * 4);
        weights = new Float32Array(spec.atoms.length * 4);
        for (let i = 0; i < spec.atoms.length; i += 1) {
          const a = spec.atoms[i];
          posZeta.set([a.position[0], a.position[1], a.position[2], a.Z === 1 ? 1.24 : 2.25], i * 4);
          const qMull = Number(moleculeRhfResult?.mullikenCharges?.[i]) || 0;
          weights.set([a.Z, a.Z - qMull, 0.5, 0], i * 4);
        }
      }
      orbitalCloud = sampleMolecularOrbitalCloudWebGpu(device, {
        posZeta,
        weights,
        boxHalfBohr,
        mode: 0,
        pointCount: Math.min(140000, quality.orbitalPoints),
        seed: (universeSeed ^ 0x6a09e667) >>> 0,
        reuseBuffer: orbitalCloud?.pointsBuffer || null
      });
    } else {
      const atom = res.visualData.atom;
      const rGridKs = atom?.radialGrid?.r || atom?.rGrid || null;
      const orbIdx = (atom?.orbitals || []).findIndex((o) => o.n === quantumN && o.l === quantumL);
      const ksOrbWave = orbIdx >= 0
        ? (atom?.orbitalWavefunctions?.[orbIdx] || atom?.orbitals?.[orbIdx]?.u || null)
        : null;
      orbitalCloud = sampleAtomicOrbitalCloudWebGpu(device, {
        Z: quantumZ,
        n: quantumN,
        l: quantumL,
        m: quantumM,
        pointCount: quality.orbitalPoints,
        rGrid: (rGridKs && ksOrbWave && ksOrbWave.length === rGridKs.length) ? rGridKs : null,
        orbitalU: (rGridKs && ksOrbWave && ksOrbWave.length === rGridKs.length) ? ksOrbWave : null,
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
    nuclearA = A != null
      ? Math.max(nuclearZ, Math.trunc(Number(A)))
      : (elChoice?.A || mostStableMassNumberForZ(nuclearZ));
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

  // ---- Per-Frame Real GPU Physics Stepping (with Automatic Scale-Adaptive Time Dilation!) ----
  async function stepActiveRegimes(activeLevel, log10SpanM, timeScale = 1.0) {
    if (busy || disposed) return;
    busy = true;
    const dilation = computeScaleAdaptiveTimeDilation(log10SpanM, {
      surfaceActive: Boolean(surfaceActive && activeLevel === 4),
      userTimeScale: timeScale
    });
    const effScale = dilation.effectiveTimeScale;
    try {
      if (activeLevel === 0) {
        if (cosmoMode !== 'web' && cosmoBaryonSession) {
          cosmoBaryonTelemetry = await cosmoBaryonSession.step({
            dt: (cosmoMode === 'reionization' ? 0.12 : 0.08) * Math.max(0.15, Math.min(2.5, effScale)),
            substeps: 1,
            readTelemetry: true
          });
        } else if (cosmoSession) {
          // Perpetual visible FLRW cosmic expansion through present epoch into dark-energy Λ domination (NEVER dead-stops!)
          const aCur = cosmoSession.getState().aScale;
          const baseDlnA = cosmoBigBangMode ? 0.011 : 0.0016;
          const taper = 1.0 / (1.0 + 0.30 * Math.max(0, aCur - 1.6));
          const daDyn = Math.max(0.00018, aCur * baseDlnA * taper * Math.max(0.15, Math.min(3.0, effScale)));
          cosmoTelemetry = await cosmoSession.step({ daOverride: daDyn, readTelemetry: true });
        }
      } else if (activeLevel === 1 && galaxyEngine) {
        const galEng = galaxyEngine;
        const wL1 = getWorkloads();
        const isLiveGalGenesis = activeGenesisStage?.stage === 'l1-galaxy-collapse';
        const dt = (isLiveGalGenesis ? 0.0048 : 0.0022) * Math.max(0.08, Math.min(3.0, effScale));
        const substeps = isLiveGalGenesis ? Math.max(2, wL1.l1SubstepsPerFrame || 2) : 1;
        await galEng.step({ dt, substeps, gravity: 1.0, softening: 0.65, readback: false });
        const dyn = galacticDynamoSession;
        if (dyn && galEng === galaxyEngine) {
          const readB = (galEng.stepIndex % 4) === 0;
          const nextTel = await dyn.step({
            particleBuffer: galEng.getResidentBuffer(),
            particleCount: galEng.count,
            dt: 0.014 * Math.max(0.12, Math.min(2.2, effScale)),
            substeps: 1,
            readTelemetry: readB,
            readBField: readB
          });
          if (dyn === galacticDynamoSession) {
            galacticDynamoTelemetry = nextTel;
            if (readB) {
              galacticDynamoStreamlines = dyn.buildStreamlines({ worldScale: 1.0, alpha: 0.30 });
            }
          }
        }
        if (isLiveGalGenesis && activeGenesisStage?.stage === 'l1-galaxy-collapse') {
          activeGenesisStage.step = Math.min(activeGenesisStage.targetSteps, (activeGenesisStage.step || 0) + substeps);
          activeGenesisStage.progress = activeGenesisStage.step / Math.max(1, activeGenesisStage.targetSteps);
          const magE = Number(galacticDynamoTelemetry?.magneticEnergy || 0).toFixed(2);
          activeGenesisStage.detail = `Step ${activeGenesisStage.step}/${activeGenesisStage.targetSteps} · ${galEng.count.toLocaleString()} stars collapsing · Dynamo E_B=${magE}`;
          if (activeGenesisStage.step >= activeGenesisStage.targetSteps) {
            await finalizeL1GalaxyGenesisInternal(false);
          }
        }
      } else if (activeLevel === 2) {
        if (galaxyBranch === 'smbh-core' && smbhEngine) {
          smbhBodies = await smbhEngine.step({ dt: 0.008 * Math.max(0.08, Math.min(3.0, effScale)), gravity: 1.0, softening: 0.08, readback: true });
        } else if (solarMode === 'formation' && (nebularCoalescenceSession || protoplanetarySession)) {
          if (nebularCoalescenceSession) {
            const wL2 = getWorkloads();
            const isLiveNebGenesis = activeGenesisStage?.stage === 'l2-nebular-coalescence';
            const nebSub = isLiveNebGenesis
              ? Math.max(6, wL2.l2SubstepsPerFrame || 20)
              : Math.min(10, Math.max(4, Math.floor((wL2.l2SubstepsPerFrame || 16) * 0.5)));
            const gravCad = Math.max(1, wL2.l2GravityCadence || 4);
            const prevStep = nebularCoalescenceSession.stepIndex;
            const nextStepEst = prevStep + nebSub;
            const readAnn = Math.floor(prevStep / 48) !== Math.floor(nextStepEst / 48)
              || (isLiveNebGenesis && nextStepEst >= activeGenesisStage.targetSteps);
            nebularCoalescenceTelemetry = await nebularCoalescenceSession.step({
              dt: 0.024 * Math.max(0.22, Math.min(2.4, effScale)),
              substeps: nebSub,
              gravityCadence: gravCad,
              readTelemetry: true,
              readAnnuli: readAnn
            });
            if (isLiveNebGenesis && activeGenesisStage?.stage === 'l2-nebular-coalescence') {
              activeGenesisStage.step = Math.min(activeGenesisStage.targetSteps, nebularCoalescenceSession.stepIndex);
              activeGenesisStage.progress = activeGenesisStage.step / Math.max(1, activeGenesisStage.targetSteps);
              const d = nebularCoalescenceSession.getCoalescedDisk();
              const t = nebularCoalescenceTelemetry;
              const orbitsEst = ((nebularCoalescenceSession.stepIndex * 0.024) / 0.85).toFixed(1);
              const pFrac = activeGenesisStage.progress;
              const nClumps = d?.bodies?.length || 0;
              const phaseNote = pFrac < 0.28
                ? 'spiral density waves forming (worlds not yet settled)'
                : (pFrac < 0.78
                  ? `${nClumps} proto-clumps accreting & carving gaps (settling)`
                  : `XUV clearing · ${nClumps} planets locking into N-body orbits`);
              activeGenesisStage.detail = `${orbitsEst} orbits (${nebularCoalescenceSession.parcelCount.toLocaleString()} parcels) · ${phaseNote} · Fe ${Math.round((t?.meanFeFrac || 0) * 100)}% / Si ${Math.round((t?.meanSilicateFrac || 0) * 100)}% / Ice ${Math.round((t?.meanVolatileIceFrac || 0) * 100)}%`;
              if (nebularCoalescenceSession.stepIndex >= activeGenesisStage.targetSteps) {
                await finalizeL2NebularGenesisInternal();
              }
            }
          }
          if (protoplanetarySession && solarMode === 'formation') {
            protoplanetaryTelemetry = await protoplanetarySession.step({
              dt: 0.016 * Math.max(0.12, Math.min(2.5, effScale)),
              substeps: 2,
              readTelemetry: true
            });
          }
        } else if (solarMode === 'quasar-jet' && kerrJetSession) {
          kerrJetTelemetry = await kerrJetSession.step({
            dt: 0.028 * Math.max(0.12, Math.min(2.5, effScale)),
            substeps: 2,
            readTelemetry: true
          });
        } else if ((solarMode === 'xray-binary' || solarMode === 'bns-kilonova' || solarMode === 'type-ia' || solarMode === 'bbh-merger') && relBinarySession) {
          relBinaryTelemetry = await relBinarySession.step({
            dt: 0.028 * Math.max(0.12, Math.min(2.5, effScale)),
            substeps: 3,
            readTelemetry: true
          });
        } else if ((solarMode === 'comet-tails' || solarMode === 'hot-jupiter') && radWindL2Session) {
          radWindL2Telemetry = await radWindL2Session.step({
            dt: 0.036 * Math.max(0.12, Math.min(2.5, effScale)),
            substeps: 2,
            readTelemetry: true
          });
        } else if (['roche-rings', 'giant-impact', 'red-giant', 'catastrophic-shatter', 'tde'].includes(solarMode) && tidalRocheSession) {
          tidalRocheTelemetry = await tidalRocheSession.step({
            dt: 0.024 * Math.max(0.12, Math.min(2.5, effScale)),
            substeps: 2,
            readTelemetry: true
          });
        } else if (solarEngine) {
          // Smooth continuous scale-adaptive symplectic time dilation across 7.5 OOM of Solar System zoom!
          const zoomNorm = Math.max(0, Math.min(1, (log10SpanM - 8.75) / 5.2));
          const dtSubYr = (0.000010 + 0.000046 * Math.pow(zoomNorm, 1.45));
          const substeps = Math.max(1, Math.min(48, Math.round((3 + 21 * Math.pow(zoomNorm, 1.25)) * Math.max(0.1, timeScale))));
          await solarEngine.step({ dtSubYr, substeps, readMassive: true });
          solarConservation = solarEngine.computeConservationDiagnostics();
          // Keep active comet anti-solar dual tails continuously integrated in L2 overview too!
          if (radWindL2Session && radWindL2Mode === 'comet-tails' && log10SpanM < 13.8) {
            const catL2 = getActiveSystemCatalog();
            const cometIdx = catL2[focusedSolarBodyIndex]?.isComet
              ? focusedSolarBodyIndex
              : catL2.findIndex((b) => Boolean(b?.isComet));
            if (cometIdx > 0) {
              const cVec = computeLiveCometSolarVectors(cometIdx);
              radWindL2Telemetry = await radWindL2Session.step({
                dt: 0.032 * Math.max(0.15, Math.min(2.2, effScale)),
                substeps: 2,
                sourceDir: cVec.sourceDir,
                orbVelDir: cVec.orbVelDir,
                sublimationDrive: cVec.sublimationDrive,
                sunDistAu: cVec.sunDistAu,
                readTelemetry: false
              });
            }
          }
          // Smooth continuous XUV dissipation of residual nebular gas after settling (ZERO abrupt cut!)
          if (nebularSettleBlend > 0.004 && nebularCoalescenceSession) {
            await nebularCoalescenceSession.step({
              dt: 0.016 * Math.max(0.2, Math.min(1.6, effScale)),
              substeps: 2,
              gravityCadence: 4,
              readTelemetry: false,
              readAnnuli: false
            });
            nebularSettleBlend = Math.max(0.0, nebularSettleBlend - 0.0042);
          }
        }
      } else if (activeLevel === 3) {
        if (stellarMode === 'nebular-mhd' && nebulaMhdSession) {
          const nebMhdRef = nebulaMhdSession;
          const readB = (nebMhdRef.stepIndex % 4) === 0;
          const nextNebTel = await nebMhdRef.step({
            dt: 0.022 * Math.max(0.12, Math.min(2.2, effScale)),
            substeps: 1,
            readTelemetry: true,
            readBFieldForStreamlines: readB
          });
          if (nebMhdRef === nebulaMhdSession && nebulaMhdSession) {
            nebulaMhdTelemetry = nextNebTel;
            if (readB) {
              nebulaMhdStreamlines = nebulaMhdSession.buildMagneticFieldStreamlines({ worldScale: 1.0, alpha: 0.68 });
            }
          }
        } else if (['h2-pillars', 'planetary-nebula', 'snr-pwn', 'reflection-nebula', 'wr-bubble'].includes(stellarMode) && radWindL3Session) {
          radWindL3Telemetry = await radWindL3Session.step({
            dt: 0.032 * Math.max(0.12, Math.min(2.5, effScale)),
            substeps: 2,
            readTelemetry: true
          });
        } else if (stellarMode === 'black-hole' && kerrJetSession) {
          kerrJetTelemetry = await kerrJetSession.step({
            dt: 0.028 * Math.max(0.12, Math.min(2.5, effScale)),
            substeps: 2,
            readTelemetry: true
          });
        } else if ((stellarMode === 'pulsar' || stellarMode === 'magnetar') && magnetosphereSession) {
          const magRef = magnetosphereSession;
          const readMagB = (magRef.stepIndex % 4) === 0;
          const nextMagTel = await magRef.step({
            dt: 0.036 * Math.max(0.12, Math.min(2.5, effScale)),
            substeps: 2,
            readTelemetry: true,
            readBField: readMagB
          });
          if (magRef === magnetosphereSession && magnetosphereSession) {
            magnetosphereTelemetry = nextMagTel;
            if (readMagB) {
              magnetosphereFieldLines = magnetosphereSession.buildDipoleFieldLines({ linesPerRing: 16, steps: 32, worldScale: 1.0, alpha: 0.74 });
            }
          }
        } else if (stellarMode === 'white-dwarf-tov') {
          // Static GR TOV equilibrium curve already solved on WebGPU
        } else if (stellarEngine) {
          const stEng = stellarEngine;
          const wL3 = getWorkloads();
          const stSub = stEng.solver === 'webgpu-3d-mls-mpm-nuclear-fusion'
            ? Math.max(1, wL3.l3SubstepsPerFrame || 2)
            : 1;
          const nextStTel = await stEng.step({
            dt: 0.014 * Math.max(0.12, Math.min(2.5, effScale)),
            substeps: stSub,
            timeAccel: stellarTimeAccel,
            readTelemetry: true
          });
          if (stEng === stellarEngine) {
            stellarTelemetry = nextStTel;
            const stDyn = stellarDynamoSession;
            if (stDyn) {
              const readStB = (stEng.stepIndex % 4) === 0;
              const nextDynTel = await stDyn.step({
                particleBuffer: stEng.getResidentBuffer(),
                particleCount: stEng.count,
                dt: 0.038 * Math.max(0.12, Math.min(2.2, effScale)),
                substeps: 1,
                readTelemetry: readStB,
                readBField: readStB
              });
              if (stDyn === stellarDynamoSession) {
                stellarDynamoTelemetry = nextDynTel;
                if (readStB) {
                  stellarDynamoStreamlines = stDyn.buildStreamlines({ worldScale: 1.0, alpha: 0.42 });
                }
              }
            }
          }
        }
      } else if (activeLevel === 4) {
        if (surfaceActive && surfaceSession) {
          const activeSurf = surfaceSession;
          const dtSurf = 0.020 * Math.max(0.25, Math.min(2.5, timeScale));
          const warpEff = Math.max(1.0, Math.min(1e7, surfaceTimeWarp));
          surfaceSimSec += dtSurf * warpEff;
          // Step live N-body solar system while standing on the surface so sunrises, moons, eclipses & seasons evolve!
          if (solarEngine && planetaryMode !== 'eyeball-locked' && planetaryMode !== 'rogue') {
            const dtYrTotal = (dtSurf * warpEff) / 31557600.0;
            const nSub = Math.max(1, Math.min(8, Math.ceil(dtYrTotal / 0.0004)));
            const dtSubYr = Math.min(0.0006, Math.max(1e-8, dtYrTotal / nSub));
            await solarEngine.step({ dtSubYr, substeps: nSub, readMassive: true });
          }
          // Re-check after awaiting solarEngine in case exitSurfaceView() ran concurrently!
          if (surfaceActive && surfaceSession === activeSurf) {
            surfaceTelemetry = await activeSurf.step({
              dt: dtSurf,
              controls: surfaceControls,
              climate: surfaceClimate,
              readTelemetry: (activeSurf.stepIndex % 4) === 0
            });
          }
        } else {
          let sunDir = planetaryMode === 'eyeball-locked' ? [1.0, 0.0, 0.0] : [0.65, 0.25, 0.70];
          if (planetaryMode === 'cryo-plumes' && cryoPlumeSession) {
            cryoPlumeTelemetry = await cryoPlumeSession.step({
              dt: 0.028 * Math.max(0.12, Math.min(2.5, effScale)),
              substeps: 2,
              readTelemetry: true
            });
          }
          if (solarEngine && planetaryMode !== 'eyeball-locked' && planetaryMode !== 'rogue') {
            // Smooth symplectic orbital cadence in L4 orbit (~18 s per season at 60 FPS, ~185 substeps per lunar orbit)
            // so planetary axial-tilt seasons & moons visibly evolve live without needing manual time-warp!
            await solarEngine.step({ dtSubYr: 0.000055, substeps: Math.max(2, Math.round(4 * Math.max(0.25, effScale))), readMassive: true });
            solarConservation = solarEngine.computeConservationDiagnostics();
            const fSt = solarEngine.getMassiveBodyState64(focusedSolarBodyIndex);
            const sSt = solarEngine.getMassiveBodyState64(0);
            const dx = sSt.posAu[0] - fSt.posAu[0];
            const dy = sSt.posAu[1] - fSt.posAu[1];
            const dz = sSt.posAu[2] - fSt.posAu[2];
            const len = Math.hypot(dx, dy, dz) || 1;
            sunDir = [dx / len, dy / len, dz / len];
          }
          // Continuous Live 3D GPU SPH Planetary Interior & Emergent Core Geodynamo!
          //   - Formation Gear (`planetaryGenesisLiveForm === true`): rapid geologic evolution (6-8 substeps/frame)
          //   - Secular Live Gear (`planetaryGenesisLiveForm === false`): NEVER STOPS — keeps convecting the Fe-Ni core
          //     & silicate mantle at a gentle secular rate (1 substep/frame) driving the live 3D GPU Geodynamo B(x,y,z)!
          let livePlanDynamoScale = null;
          if (planetaryGenesisSphSession) {
            const w = getWorkloads();
            planetarySecularTick += 1;
            if (planetaryGenesisLiveForm) {
              const isLiveSphGenesis = activeGenesisStage?.stage === 'l4-planetary-sph';
              const sphSub = isLiveSphGenesis ? Math.max(2, w.l4SubstepsPerFrame || 6) : 2;
              const prevIdx = planetaryGenesisSphSession.stepIndex;
              const nextIdxEst = prevIdx + sphSub;
              // Update spherical SPH geology map frequently during Era 2-4 so solidifying crust & cooling fissures emerge continuously!
              const mapCadence = Math.max(4, Math.min(16, w.l4MapUpdateCadence || 16));
              const shouldProjectMap = !isLiveSphGenesis
                || Math.floor(prevIdx / mapCadence) !== Math.floor(nextIdxEst / mapCadence)
                || nextIdxEst >= (activeGenesisStage?.targetSteps || 240);
              const liveErosion = shouldProjectMap ? 4 : 0;
              planetaryGenesisSphTelemetry = await planetaryGenesisSphSession.step({
                dt: 0.028 * Math.max(0.30, Math.min(2.2, effScale)),
                substeps: sphSub,
                updateSurfaceMap: shouldProjectMap,
                erosionPasses: liveErosion,
                readTelemetry: isLiveSphGenesis || (nextIdxEst % 8) === 0
              });
              if (isLiveSphGenesis && activeGenesisStage?.stage === 'l4-planetary-sph') {
                activeGenesisStage.step = Math.min(activeGenesisStage.targetSteps, planetaryGenesisSphSession.stepIndex);
                const prog = activeGenesisStage.step / Math.max(1, activeGenesisStage.targetSteps);
                activeGenesisStage.progress = prog;
                // Continuous radiative cooling curve: incandescent magma (1.0) -> solidifying crust (0.65) -> condensing steam/oceans (0.28)
                planetaryCoolingHeat = Math.max(0.18, Math.min(1.0, 1.0 - Math.max(0, (prog - 0.35) / 0.65) * 0.72));
                const eraLabel = prog < 0.25
                  ? 'Era 1: Iron Catastrophe'
                  : (prog < 0.55
                    ? 'Era 2: Mantle Convection & Crust Solidification'
                    : (prog < 0.80 ? 'Era 3: Late Heavy Bombardment & Cooling' : 'Era 4: Steam Rainout & Ocean Erosion'));
                const st = planetaryGenesisSphTelemetry;
                if (st) {
                  activeGenesisStage.detail = `${eraLabel} · ${Math.round(st.geoTimeMyr)} Myr · Core r=${st.coreMeanR.toFixed(2)} · Crust r=${st.felsicMeanR.toFixed(2)} · Diff ${st.differentiationIndex.toFixed(2)} · ${planetaryGenesisSphSession.parcelCount.toLocaleString()} SPH`;
                }
                if (planetaryGenesisSphSession.stepIndex >= activeGenesisStage.targetSteps) {
                  await finalizeL4PlanetarySphGenesisInternal();
                }
              }
            } else {
              // Continuous Secular Live Gear: gentle ongoing outer-core & mantle convection powering live geodynamo!
              // Smoothly cool any remaining post-genesis magma heat down to equilibrium T_eq over ~5-7 seconds (ZERO 1-frame snap!)
              if (planetaryCoolingHeat > 0.002) {
                planetaryCoolingHeat = Math.max(0.0, planetaryCoolingHeat - 0.0028 * Math.max(0.3, Math.min(2.2, effScale)));
              }
              const secSub = Math.max(1, w.l4SecularSubstepsPerFrame || 1);
              planetaryGenesisSphTelemetry = await planetaryGenesisSphSession.step({
                dt: 0.014 * Math.max(0.25, Math.min(2.0, effScale)),
                substeps: secSub,
                updateSurfaceMap: false,
                erosionPasses: 0,
                readTelemetry: (planetarySecularTick % 12) === 0
              });
            }
            const pDyn = planetaryDynamoSession;
            if (pDyn && (planetarySecularTick % 3) === 0) {
              const readPlanB = (planetarySecularTick % 6) === 0;
              const nextPDyn = await pDyn.step({
                particleBuffer: planetaryGenesisSphSession.getResidentParcelsBuffer(),
                particleCount: planetaryGenesisSphSession.parcelCount,
                dt: 0.036 * Math.max(0.20, Math.min(2.0, effScale)),
                substeps: 1,
                readTelemetry: readPlanB,
                readBField: readPlanB
              });
              if (pDyn === planetaryDynamoSession) {
                planetaryDynamoTelemetry = nextPDyn;
                if (readPlanB) {
                  planetaryDynamoStreamlines = pDyn.buildStreamlines({ worldScale: 1.0, alpha: 0.42 });
                }
              }
            }
            if (planetaryDynamoTelemetry && Number.isFinite(planetaryDynamoTelemetry.magneticEnergy)) {
              livePlanDynamoScale = Math.max(0.25, Math.min(1.85, Math.sqrt(Math.max(0.02, planetaryDynamoTelemetry.magneticEnergy) / 0.18)));
            }
          }
          // Dynamically step spherical baroclinic fluid + triboelectric lightning + LIVE GEODYNAMO AURORAE!
          if (planetaryAtmoSession) {
            planetaryAtmoTelemetry = await planetaryAtmoSession.step({
              dtSim: 0.038 * Math.max(0.15, Math.min(2.5, effScale)),
              substeps: 2,
              sunDir,
              dynamoScale: livePlanDynamoScale,
              readTelemetry: true
            });
          }
          // Live Solar-Flux Sublimation Outgassing Jets when orbiting an active Comet — strictly anti-solar & velocity-aligned!
          const focSpecL4 = getActiveSystemCatalog()[planetaryBodyIndex];
          if (focSpecL4?.isComet && radWindL2Session && radWindL2Mode === 'comet-tails') {
            const cVec = computeLiveCometSolarVectors(planetaryBodyIndex);
            radWindL2Telemetry = await radWindL2Session.step({
              dt: 0.034 * Math.max(0.15, Math.min(2.5, effScale)),
              substeps: 2,
              sourceDir: cVec.sourceDir,
              orbVelDir: cVec.orbVelDir,
              sublimationDrive: cVec.sublimationDrive,
              sunDistAu: cVec.sunDistAu,
              readTelemetry: true
            });
          }
        }
      } else if (activeLevel === 5 && mdSession) {
        const steps = Math.max(1, Math.min(6, Math.round(2 * Math.max(0.25, timeScale))));
        mdTelemetry = await mdSession.stepBatch(steps, {
          readTelemetry: true,
          targetTemperatureK: mdTempK,
          nonBlocking: true
        });
        if (mdTelemetry?.rdf) mdRdfHistory = Array.from(mdTelemetry.rdf);
      } else if (activeLevel === 7 && tdseSession) {
        const steps = Math.max(2, Math.min(18, Math.round(6 * Math.max(0.25, timeScale))));
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
    if (level === 2 && (galaxyBranch === 'smbh-core' ? smbhEngine : (solarEngine || (solarMode === 'formation' && nebularCoalescenceSession)))) return;
    if (level === 3) {
      if (stellarMode === 'fusion' && stellarEngine) return;
      if ((stellarMode === 'pulsar' || stellarMode === 'magnetar') && magnetosphereSession && magnetosphereMode === stellarMode) return;
      if (stellarMode === 'black-hole' && kerrJetSession) return;
      if (stellarMode === 'white-dwarf-tov' && tovCurve) return;
      if (stellarMode === 'nebular-mhd' && nebulaMhdSession) return;
      if (['h2-pillars', 'planetary-nebula', 'snr-pwn', 'reflection-nebula', 'wr-bubble'].includes(stellarMode) && radWindL3Session && radWindL3Mode === stellarMode) return;
    }
    let targetPlanetIdx = planetaryBodyIndex;
    if (level === 4) {
      const cat = getActiveSystemCatalog();
      targetPlanetIdx = opts.bodyIndex != null
        ? Math.max(0, Math.min(cat.length - 1, Math.trunc(Number(opts.bodyIndex) || 0)))
        : ((!cat[focusedSolarBodyIndex]?.isStar && focusedSolarBodyIndex > 0) ? focusedSolarBodyIndex : planetaryBodyIndex);
      if (cat[targetPlanetIdx]?.isStar || targetPlanetIdx === 0) {
        const alt = getDefaultPlanetIndex(cat);
        if (alt > 0) targetPlanetIdx = alt;
      }
      if (planetaryResult && planetaryBodyIndex === targetPlanetIdx) return;
    }
    if (level === 5 && mdSession) return;
    if (level === 6 && orbitalCloud) return;
    if (level === 7 && nuclearResult) return;

    const k = level === 2 ? `2:${galaxyBranch}` : (level === 4 ? `4:${targetPlanetIdx}` : String(level));
    if (initInFlight.has(k)) return initInFlight.get(k);
    const p = (async () => {
      if (level === 0) await initCosmicWeb(opts);
      else if (level === 1) await initGalaxy(opts);
      else if (level === 2) {
        if (galaxyBranch === 'smbh-core') await initSmbhCore();
        else await initSolarSystem(opts);
      } else if (level === 3) {
        if (stellarMode !== 'fusion') await setStellarMode(stellarMode);
        else await initStellarCore(opts);
      } else if (level === 4) await initPlanetaryInterior({ ...opts, bodyIndex: targetPlanetIdx });
      else if (level === 5) await initMolecularDynamics(opts);
      else if (level === 6) await initQuantumAtom(opts);
      else if (level === 7) await initAtomicNucleus(opts);
    })();
    initInFlight.set(k, p);
    try { await p; } finally { initInFlight.delete(k); }
  }

  function setQuality(nextId) {
    if (nextId !== 'auto' && !QUALITY_PRESETS[nextId]) return false;
    qualityMode = nextId;
    activeCapabilityProfile = buildPeerComputeSimulationProfile(baseCapabilities || {}, {
      device,
      qualityMode
    });
    quality = QUALITY_PRESETS[activeCapabilityProfile.qualityId] || QUALITY_PRESETS.med;
    return true;
  }
  function setSeed(nextSeed) { universeSeed = (Number(nextSeed) >>> 0) || 1; }
  function setSampledMaterial(sample) {
    activeSampledMaterial = sample ? { ...sample } : null;
    return activeSampledMaterial;
  }

  async function applySampledMaterialToLattice(sample) {
    if (!sample) return null;
    activeSampledMaterial = { ...sample };
    const zUse = Math.max(1, Math.min(118, Math.trunc(Number(sample.primaryZ) || 14)));
    await initMolecularDynamics({
      Z: zUse,
      formula: sample.formula || null,
      phasePreset: sample.phasePreset || 'solid',
      tempK: Number.isFinite(Number(sample.tempK)) ? Number(sample.tempK) : null
    });
    quantumZ = zUse;
    if (sample.moleculeKey && MOLECULE_SPECS[sample.moleculeKey]) {
      quantumMoleculeKey = sample.moleculeKey;
    }
    nuclearZ = zUse;
    return activeSampledMaterial;
  }

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
    // Propagate cosmic epoch causally into L1 Galaxy Environment & L2 Nebular Star System!
    activeGalaxyEnv = deriveGalaxyEnvironmentFromCosmicContext({
      cosmicEpoch,
      regionPosMpc: cosmoTargets[0]?.posMpc || [0, 0, 0],
      localOverdensity: activeGalaxyEnv.localOverdensity || 1.15,
      seed: universeSeed
    });
    if (!useSolReference) {
      const nextStarSys = deriveStarSystemFromGalacticLocation({
        cosmicEpoch,
        galaxyEnv: activeGalaxyEnv,
        starPosGal: activeStarSite.posGal,
        popTag: activeStarSite.popTag,
        starIndex: activeStarSite.starIndex,
        seed: (universeSeed + 409) >>> 0
      });
      activeCausalSystem = synthesizeNebularPlanetarySystem(nextStarSys, {
        seedOverride: (universeSeed + 409) >>> 0,
        gpuCoalescedDisk: nebularAnnuliSnapshot || null
      });
    }
    // Dynamically align the active scale's physical regime to the chosen cosmic epoch (when requested)!
    if (alignActiveLevel === 0) {
      if (cosmicEpoch.eraId === 'recombination') await setCosmoMode('cmb');
      else if (cosmicEpoch.eraId === 'cosmic-dawn') await setCosmoMode('reionization');
      else if (cosmicEpoch.eraId === 'far-future') await setCosmoMode('cluster-merger');
      else await setCosmoMode('web');
    } else if (alignActiveLevel === 1) {
      await initGalaxy({ galaxyEnvOverride: activeGalaxyEnv });
    } else if (alignActiveLevel === 2) {
      if (cosmicEpoch.eraId === 'quasar-peak') await setSolarMode('quasar-jet');
      else if (cosmicEpoch.eraId === 'cosmic-dawn') await setSolarMode('formation');
      else if (cosmicEpoch.eraId === 'far-future') await setSolarMode('red-giant');
      else {
        await initSolarSystem();
        await setSolarMode('nbody');
      }
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
      'nbody', 'formation', 'roche-rings', 'giant-impact', 'red-giant', 'catastrophic-shatter', 'tde',
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
    } else if (['roche-rings', 'giant-impact', 'red-giant', 'catastrophic-shatter', 'tde'].includes(solarMode)) {
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
    const valid = [
      'fusion', 'nebular-mhd', 'h2-pillars', 'planetary-nebula', 'snr-pwn',
      'reflection-nebula', 'wr-bubble', 'pulsar', 'magnetar', 'white-dwarf-tov', 'black-hole'
    ];
    stellarMode = valid.includes(mode) ? mode : 'fusion';
    if (stellarMode === 'nebular-mhd') {
      if (!nebulaMhdSession) await initNebularMhd();
    } else if (['h2-pillars', 'planetary-nebula', 'snr-pwn', 'reflection-nebula', 'wr-bubble'].includes(stellarMode)) {
      if (!radWindL3Session || radWindL3Mode !== stellarMode) await initRadiativeWindL3(stellarMode);
    } else if (stellarMode === 'pulsar' || stellarMode === 'magnetar') {
      if (!magnetosphereSession || magnetosphereMode !== stellarMode) await initCompactMagnetosphere(stellarMode);
    } else if (stellarMode === 'white-dwarf-tov') {
      if (!tovCurve) await initWhiteDwarfTovCurve();
    } else if (stellarMode === 'black-hole') {
      const hostCat0 = getActiveSystemCatalog()[0];
      const bhMass = Number.isFinite(Number(hostCat0?.massSolar)) && Number(hostCat0.massSolar) > 2.2 && Number(hostCat0.massSolar) < 1e4
        ? Number(hostCat0.massSolar)
        : 11.4;
      if (!kerrJetSession || Math.abs((kerrJetSession.massSolar || 0) - bhMass) > bhMass * 0.5) {
        await initKerrQuasarJet({ massSolar: bhMass, spinA: 0.92, eddingtonRatio: 0.18 });
      }
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
      const cat = getActiveSystemCatalog();
      const baseSpec = cat[planetaryBodyIndex] || REAL_SOLAR_SYSTEM_CATALOG[3];
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
  async function setGalacticB0(val) {
    galacticB0 = Math.max(0, Math.min(1.2, Number(val) || 0));
    const dyn = galacticDynamoSession;
    const galEng = galaxyEngine;
    if (dyn && galEng) {
      dyn.resetSeedB(galacticB0);
      const nextTel = await dyn.step({
        particleBuffer: galEng.getResidentBuffer(),
        particleCount: galEng.count,
        dt: 0.045,
        substeps: galacticB0 > 1e-6 ? 8 : 1,
        readTelemetry: true,
        readBField: true
      });
      if (dyn === galacticDynamoSession) {
        galacticDynamoTelemetry = nextTel;
        galacticDynamoStreamlines = dyn.buildStreamlines({ worldScale: 1.0, alpha: 0.44 });
      }
    }
  }
  async function setStellarB0(val) {
    stellarB0 = Math.max(0, Math.min(1.2, Number(val) || 0));
    const stDyn = stellarDynamoSession;
    const stEng = stellarEngine;
    if (stDyn && stEng) {
      stDyn.resetSeedB(stellarB0);
      const nextTel = await stDyn.step({
        particleBuffer: stEng.getResidentBuffer(),
        particleCount: stEng.count,
        dt: 0.042,
        substeps: stellarB0 > 1e-6 ? 8 : 1,
        readTelemetry: true,
        readBField: true
      });
      if (stDyn === stellarDynamoSession) {
        stellarDynamoTelemetry = nextTel;
        stellarDynamoStreamlines = stDyn.buildStreamlines({ worldScale: 1.0, alpha: 0.42 });
      }
    }
  }
  function setCosmoFocusMpc(posMpc) {
    if (Array.isArray(posMpc) && posMpc.length >= 3) {
      cosmoFocusMpc = [Number(posMpc[0]) || 0, Number(posMpc[1]) || 0, Number(posMpc[2]) || 0];
    }
  }
  function setPlanetaryTriboelectric(enabled) {
    planetaryTriboelectric = Boolean(enabled);
    planetaryAtmoSession?.setEnableTriboelectric?.(planetaryTriboelectric);
  }

  async function flushSurfaceCraters() {
    if (surfaceCraterFlushTimer) {
      clearTimeout(surfaceCraterFlushTimer);
      surfaceCraterFlushTimer = null;
    }
    if (!surfaceSession || !surfaceCraterTileKey || !surfaceCraterDirty) return false;
    const stamps = surfaceSession.getCraterStamps?.() || [];
    surfaceCraterDirty = false;
    try {
      await craterTileStore.saveTile(surfaceCraterTileKey, stamps);
      return true;
    } catch {
      return false;
    }
  }

  function scheduleCraterFlush() {
    if (surfaceCraterFlushTimer) return;
    surfaceCraterFlushTimer = setTimeout(() => {
      surfaceCraterFlushTimer = null;
      void flushSurfaceCraters();
    }, 1200);
  }

  let surfaceEnterToken = 0;

  async function enterSurfaceView({
    bodyIndex = planetaryBodyIndex,
    customBodySpec = null,
    planetaryModeOverride = null,
    landingSite = null,
    restoreCheckpoint = null,
    initialVehicle = 'ufo',
    onCraterStamp = null
  } = {}) {
    const myEnterToken = ++surfaceEnterToken;
    await flushSurfaceCraters();
    if (myEnterToken !== surfaceEnterToken) return null;
    let spec = null;
    let idx = bodyIndex;
    let surfAtmoState = planetaryAtmoState;
    if (customBodySpec && typeof customBodySpec === 'object') {
      spec = { isMinorBody: true, ...customBodySpec };
      customSurfaceBodySpec = spec;
      surfAtmoState = { surfacePressurePa: spec.surfacePressurePa || 0, volatileMassFrac: spec.isComet ? 0.55 : 0.02, particulateMassFrac: 0.0 };
    } else {
      customSurfaceBodySpec = null;
      let cat = getActiveSystemCatalog();
      if (typeof idx === 'string') {
        const foundActive = cat.findIndex((b) => b.id === idx);
        if (foundActive >= 0 && !cat[foundActive].isStar) {
          idx = foundActive;
        } else {
          const foundSol = REAL_SOLAR_SYSTEM_CATALOG.findIndex((b) => b.id === idx);
          if (foundSol > 0) {
            useSolReference = true;
            await initSolarSystem({ solReference: true });
            cat = getActiveSystemCatalog();
            idx = foundSol;
          } else {
            idx = planetaryBodyIndex;
          }
        }
      }
      idx = Math.max(0, Math.min(cat.length - 1, Math.trunc(Number(idx) ?? planetaryBodyIndex)));
      if (cat[idx]?.isStar || idx === 0) {
        const alt = getDefaultPlanetIndex(cat);
        if (alt > 0) idx = alt;
      }
      focusedSolarBodyIndex = idx;
      if (planetaryModeOverride) {
        planetaryMode = planetaryModeOverride;
      }
      if (!planetaryResult || planetaryBodyIndex !== idx) {
        await initPlanetaryInterior({ bodyIndex: idx });
      } else if (activeGenesisStage?.stage === 'l4-planetary-sph') {
        await finalizeActiveGenesis();
      }
      if (myEnterToken !== surfaceEnterToken) return null;
      spec = cat[idx] || REAL_SOLAR_SYSTEM_CATALOG[3];
      surfAtmoState = planetaryAtmoState;
    }

    // Load OPFS / IndexedDB persisted sparse crater stamps for 1-submit GPU replay!
    const tileKey = buildCraterTileKey({
      universeSeed,
      systemId: useSolReference ? 'sol' : (activeCausalSystem?.systemName || cosmicEpoch?.id || 'proc'),
      bodyId: spec.id || `body-${idx}`
    });
    const persisted = await craterTileStore.loadTile(tileKey);
    const initialCraterStamps = Array.isArray(persisted)
      ? persisted
      : (Array.isArray(persisted?.stamps) ? persisted.stamps : []);
    surfaceCraterTileKey = tileKey;
    surfaceCraterDirty = false;

    surfaceLandingSite = landingSite || null;
    // Seamless Orbit <-> Surface SPH Geology Patch Extraction!
    // Crop the exact (latDeg, lonDeg) touchdown zone from this body's live 3D GPU SPH geology buffer
    // (or run a fast 1-submit SPH genesis burst for visited custom minor asteroids/comets!)
    let sphSurfacePatch = null;
    if (evaluatePlanetaryGenesisSphActivation(spec).active) {
      let sphSource = (!customSurfaceBodySpec && planetaryGenesisSphSession) ? planetaryGenesisSphSession : null;
      let tempSphSession = null;
      if (!sphSource) {
        tempSphSession = createPlanetaryGenesisSphSessionWebGpu(device, spec, {
          nebulaEnv: useSolReference ? null : activeCausalSystem?.starSystem?.nebulaEnv,
          planetaryAtmoState: surfAtmoState,
          planetaryMode: customSurfaceBodySpec ? 'standard' : planetaryMode,
          systemAgeGyr: useSolReference ? 4.57 : (activeCausalSystem?.starSystem?.systemAgeGyr ?? 4.5),
          parcelCount: 2048,
          mapWidth: 256,
          mapHeight: 128,
          seed: (universeSeed ^ ((Number(idx) || 13) * 7919 + (spec.id?.length || 5) * 997)) >>> 0,
          label: `ulg-surface-sph-patch-${spec.id || idx}`
        });
        await tempSphSession.step({ dt: 0.032, substeps: 32, updateSurfaceMap: true, erosionPasses: 10, readTelemetry: false });
        sphSource = tempSphSession;
      }
      if (myEnterToken === surfaceEnterToken && sphSource) {
        try {
          sphSurfacePatch = await sphSource.extractLocalSurfacePatch({
            latDeg: surfaceLandingSite?.latDeg ?? 32.0,
            lonDeg: surfaceLandingSite?.lonDeg ?? 0.0,
            patchN: 256,
            angularSpanRad: spec.isMinorBody ? 0.56 : 0.34,
            erosionPasses: 40
          });
        } catch {
          sphSurfacePatch = null;
        }
      }
      if (tempSphSession) {
        try { tempSphSession.dispose(); } catch {}
      }
      if (myEnterToken !== surfaceEnterToken) {
        try { sphSurfacePatch?.dispose?.(); } catch {}
        return null;
      }
    }
    const wSurf = getWorkloads();
    const nextSurf = createPlanetarySurfaceSessionWebGpu(device, {
      bodySpec: spec,
      planetaryResult,
      planetaryAtmoState: surfAtmoState,
      planetaryMode: customSurfaceBodySpec ? 'standard' : planetaryMode,
      landingSite: surfaceLandingSite,
      sphSurfacePatch,
      gridN: wSurf.surfaceGridN,
      cellSizeM: 9.5,
      particleCount: wSurf.surfaceParticles,
      seed: (universeSeed ^ ((Number(idx) || 13) * 7919 + (spec.id?.length || 5) * 997 + 0x504face)) >>> 0,
      initialVehicle,
      initialCheckpoint: restoreCheckpoint,
      initialCraterStamps,
      onCraterStamp: (st) => {
        surfaceCraterDirty = true;
        scheduleCraterFlush();
        if (typeof onCraterStamp === 'function') onCraterStamp(st, tileKey);
      },
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
    if (myEnterToken !== surfaceEnterToken) {
      try { nextSurf.dispose(); } catch {}
      return null;
    }
    const prev = surfaceSession;
    surfaceSession = nextSurf;
    surfaceActive = true;
    if (prev) prev.dispose();
    return surfaceTelemetry;
  }

  function exitSurfaceView() {
    surfaceEnterToken += 1;
    void flushSurfaceCraters();
    surfaceActive = false;
    customSurfaceBodySpec = null;
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
  function setSurfaceUfoAltitudeKm(altKm) {
    if (!surfaceSession) return null;
    return surfaceSession.setUfoAltitudeKm?.(altKm) ?? null;
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
  function adjustSurfaceChaseDistance(factor) {
    return surfaceSession?.adjustChaseDistance?.(factor) ?? 1.0;
  }
  function getActiveUniversalLaws(activeLevel, log10SpanM) {
    const viewSpanM = Math.pow(10, log10SpanM);
    const cat = getActiveSystemCatalog();
    const spec = cat[focusedSolarBodyIndex] || cat[getDefaultPlanetIndex(cat)] || REAL_SOLAR_SYSTEM_CATALOG[3];
    const isRelBin = activeLevel === 2 && ['xray-binary', 'bns-kilonova', 'type-ia', 'bbh-merger'].includes(solarMode);
    const isTidalL2 = activeLevel === 2 && ['roche-rings', 'giant-impact', 'red-giant', 'tde'].includes(solarMode);
    const isRadL2 = activeLevel === 2 && ['comet-tails', 'hot-jupiter'].includes(solarMode);
    const isRadL3 = activeLevel === 3 && ['h2-pillars', 'planetary-nebula', 'snr-pwn', 'reflection-nebula', 'wr-bubble'].includes(stellarMode);
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
      surfaceViewActive: surfaceActive,
      // Phase D Complete Universal Law Graph physical state signals (32/32 state-driven nodes!)
      dynamoSeedB0: activeLevel === 1 ? galacticB0 : (activeLevel === 3 && stellarMode === 'fusion' ? stellarB0 : 0),
      stellarCoreActive: activeLevel === 3 && stellarMode === 'fusion',
      centralMassSolar: activeLevel === 3 && stellarMode === 'fusion' ? (stellarEngine?.totalMassSolar || 1.0) : 0,
      hasSolidCrust: surfaceActive ? (surfaceSession?.env?.hasSolidCrust !== false) : (spec.kind !== 2 && spec.kind !== 0),
      hasLiquidOcean: surfaceActive ? Boolean(surfaceSession?.env?.hasLiquidOcean) : Boolean(spec.hasOcean),
      hasExoticOcean: surfaceActive ? Boolean(surfaceSession?.env?.hasExoticOcean) : false,
      seaIceFrac: surfaceActive ? (Number(surfaceClimate?.seaIceFrac) || 0) : 0,
      surfaceDeformationActive: surfaceActive && Boolean(surfaceSession?.getTelemetry?.()?.mpmActive || (surfaceSession?.getTelemetry?.()?.cratersCarved || 0) > 0 || (surfaceSession?.getTelemetry?.()?.aliveBoulders || 0) > 0),
      mpmActive: surfaceActive && Boolean(surfaceSession?.getTelemetry?.()?.mpmActive),
      craterCount: surfaceActive ? (Number(surfaceSession?.getTelemetry?.()?.cratersCarved) || 0) : 0,
      boulderCount: surfaceActive ? (Number(surfaceSession?.getTelemetry?.()?.aliveBoulders) || 0) : 0,
      biosphereViability: surfaceActive
        ? (Number(surfaceSession?.xenobiology?.biosphereViability) || 0)
        : (activeLevel === 4 && Number(spec.surfacePressurePa) >= 500 && Number(spec.tempK) >= 80 && Number(spec.tempK) <= 750 ? 0.5 : 0),
      pressurePa: surfaceActive
        ? (Number(surfaceSession?.env?.pressurePa) || 0)
        : (activeLevel === 4 ? (Number(spec.surfacePressurePa) || 0) : 0),
      tempK: surfaceActive
        ? (Number(surfaceSession?.env?.tempK) || 0)
        : (activeLevel === 4 ? (Number(spec.tempK) || 0) : 0),
      isCryoMoon: activeLevel === 4 && (planetaryMode === 'cryo-plumes' || Boolean(surfaceSession?.env?.isCryoMoon)),
      isMagmaOcean: activeLevel === 4 && (planetaryMode === 'magma-ocean' || Boolean(surfaceSession?.env?.isMagmaOcean))
    };
    return resolveActiveUniversalLaws(physState);
  }
  function setGalaxyBranch(branch, focusPos = null) {
    galaxyBranch = branch === 'smbh-core' ? 'smbh-core' : 'solar-system';
    if (focusPos) galaxyFocusPos = [...focusPos];
  }
  function setFocusedSolarBody(idxOrId) {
    const cat = getActiveSystemCatalog();
    if (typeof idxOrId === 'string') {
      const found = cat.findIndex((b) => b.id === idxOrId);
      if (found >= 0) {
        focusedSolarBodyIndex = found;
        return focusedSolarBodyIndex;
      }
      const foundSol = REAL_SOLAR_SYSTEM_CATALOG.findIndex((b) => b.id === idxOrId);
      if (foundSol >= 0) {
        useSolReference = true;
        focusedSolarBodyIndex = foundSol;
        return focusedSolarBodyIndex;
      }
    } else if (Number.isFinite(Number(idxOrId))) {
      focusedSolarBodyIndex = Math.max(0, Math.min(cat.length - 1, Math.trunc(Number(idxOrId))));
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

  function computeSolarBarycenterAu() {
    if (!solarEngine) return [0, 0, 0];
    const cat = solarEngine.catalog || getActiveSystemCatalog();
    const mCount = Math.min(solarEngine.massiveCount || 0, cat.length);
    let mx = 0;
    let my = 0;
    let mz = 0;
    let mSum = 0;
    for (let i = 0; i < mCount; i += 1) {
      const m = Math.max(0, Number(cat[i]?.massSolar) || 0);
      if (m <= 0) continue;
      const st = solarEngine.getMassiveBodyState64(i);
      mx += st.posAu[0] * m;
      my += st.posAu[1] * m;
      mz += st.posAu[2] * m;
      mSum += m;
    }
    if (mSum <= 0) return [0, 0, 0];
    return [mx / mSum, my / mSum, mz / mSum];
  }

  /**
   * Canonical Solar System reference-frame origin:
   * - Overall solar system view (`L2`, span >= hiSpan): exact Center of Mass (Barycenter) of the system
   *   so clicking fast-orbiting planets/moons/comets NEVER yanks or rotates the reference frame!
   * - Entering orbit around the selected body (`L4` planet / `L3` star) or landing on it (`surfaceActive`):
   *   smoothly transitions to the selected body's exact double-float co-moving orbital frame.
   */
  function getSolarReferenceOriginAu(spanLog10M = 12.6, focusIdxOverride = null, { lockToTarget = false } = {}) {
    if (!solarEngine) {
      return { originAu: [0, 0, 0], barycenterAu: [0, 0, 0], focusPosAu: [0, 0, 0], orbitBlend: 0, frameMode: 'barycenter' };
    }
    const cat = solarEngine.catalog || getActiveSystemCatalog();
    const rawIdx = focusIdxOverride != null ? focusIdxOverride : focusedSolarBodyIndex;
    const safeIdx = Math.max(0, Math.min(cat.length - 1, rawIdx));
    const focusSpec = cat[safeIdx];
    const isStar = Boolean(focusSpec?.isStar) || safeIdx === 0;
    const focusSt = solarEngine.getMassiveBodyState64(safeIdx);
    const barycenterAu = computeSolarBarycenterAu();

    // Scale blend window dynamically to the selected body's orbital distance so zooming IN on outer worlds
    // (Saturn, Jupiter, Uranus, Halley) smoothly glides onto the target instead of letting it fly off-screen!
    const rBodyAu = Math.hypot(
      focusSt.posAu[0] - barycenterAu[0],
      focusSt.posAu[1] - barycenterAu[1],
      focusSt.posAu[2] - barycenterAu[2]
    );
    const dynHi = isStar ? 10.6 : Math.max(10.8, Math.min(13.8, Math.log10(Math.max(0.28, rBodyAu) * AU_METERS * 3.8)));
    const hiSpan = dynHi;
    const loSpan = dynHi - 1.15;
    let orbitBlend = 0.0;
    if (surfaceActive || lockToTarget || spanLog10M <= loSpan) {
      orbitBlend = 1.0;
    } else if (spanLog10M < hiSpan) {
      const t = (hiSpan - spanLog10M) / (hiSpan - loSpan);
      orbitBlend = t * t * (3.0 - 2.0 * t);
    }

    const originAu = orbitBlend <= 0
      ? barycenterAu
      : (orbitBlend >= 1
        ? focusSt.posAu
        : [
          barycenterAu[0] + (focusSt.posAu[0] - barycenterAu[0]) * orbitBlend,
          barycenterAu[1] + (focusSt.posAu[1] - barycenterAu[1]) * orbitBlend,
          barycenterAu[2] + (focusSt.posAu[2] - barycenterAu[2]) * orbitBlend
        ]);
    const frameMode = orbitBlend <= 0 ? 'barycenter' : (orbitBlend >= 1 ? 'body-orbit' : 'orbit-transition');
    return { originAu, barycenterAu, focusPosAu: focusSt.posAu, orbitBlend, frameMode };
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
        rawPosMpc: [...t.posMpc],
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
        rawPos: [...t.pos],
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
          },
          'catastrophic-shatter': {
            name: `Catastrophic Shatter — ${shatterOriginBodyName || 'Disrupted Body'}`,
            subtitle: `Binding Energy Exceeded (E > 0.85 U_bind) · Incandescent Molten-Core & Crustal Debris Field`,
            tempK: 3800,
            composition: 'Vaporized Fe-Ni Core Plasma · Ballistic Silicate & Volatile Fragments'
          },
          tde: {
            name: 'Tidal Disruption Event (TDE · SMBH Spaghettification)',
            subtitle: 'Paczyński–Wiita Apsidal Precession · Super-Eddington Fallback Shock Disk + Unbound Hyperbolic Tail',
            tempK: 1.4e6,
            composition: 'Tidally Shredded H/He Stellar Stream · Relativistic Self-Intersecting Accretion Flare'
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
      if (solarMode === 'formation') {
        const st0 = activeCausalSystem?.catalog?.[0] || activeCausalSystem?.starSystem?.stars?.[0] || null;
        const snowAu = nebularCoalescenceSession?.snowLineAu || protoplanetarySession?.snowLineAu || 2.71;
        const nProto = nebularCoalescenceSession?.getCoalescedDisk?.()?.bodies?.length || 0;
        const nParcels = nebularCoalescenceSession?.parcelCount || protoplanetarySession?.pebbleCount || 3072;
        const nebProg = activeGenesisStage?.stage === 'l2-nebular-coalescence' ? (activeGenesisStage.progress || 0) : 1.0;
        const nebPhaseTxt = nebProg < 0.28
          ? 'spiral density waves collapsing (worlds not yet settled)'
          : `${nProto} proto-clumps condensing & settling`;
        return [{
          id: 'l2-nebular-formation',
          level: 2,
          name: `${activeCausalSystem?.systemName || 'Proto-System'} · Nebular Coalescence`,
          subtitle: `Live WebGPU Disk (${nParcels.toLocaleString()} parcels) · Snow Line ${snowAu.toFixed(2)} AU · ${nebPhaseTxt}`,
          pos: [0, 0, 0],
          radius: 1.5,
          tempK: Number(st0?.tempK || st0?.teffK || 5778),
          massLabel: `${Number(st0?.massSolar || 1.0).toFixed(2)} M☉`,
          composition: `Host Star L=${Number(st0?.luminositySolar || 1.0).toFixed(2)} L☉ · Condensing Fe-Ni, SiO₂, C-SiC, H₂O & CO/CH₄`,
          nextLevel: 2
        }];
      }
      if (!solarEngine) return [];
      const cat = getActiveSystemCatalog();
      const spanM = worldScaleInfo.solarSpanLog10M ?? 12.6;
      const originAu = Array.isArray(worldScaleInfo.solarOriginAu)
        ? worldScaleInfo.solarOriginAu
        : getSolarReferenceOriginAu(spanM).originAu;
      const scaleAuToWorld = worldScaleInfo.solarScaleAuToWorld ?? 1.0;
      return cat.map((spec, idx) => {
        const st = solarEngine.getMassiveBodyState64(idx);
        const relX = (st.posAu[0] - originAu[0]) * scaleAuToWorld;
        const relY = (st.posAu[1] - originAu[1]) * scaleAuToWorld;
        const relZ = (st.posAu[2] - originAu[2]) * scaleAuToWorld;
        const isStarBody = Boolean(spec.isStar) || idx === 0;
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
          massLabel: isStarBody ? `${spec.massSolar.toFixed(2)} M☉` : `${(spec.massSolar / 3.0034896e-6).toFixed(spec.massSolar > 1e-5 ? 1 : 3)} M⊕`,
          composition: spec.composition,
          nextLevel: isStarBody ? 3 : 4
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
          'reflection-nebula': {
            name: 'Reflection Nebula (M45 Pleiades / Iris NGC 7023)',
            subtitle: 'Mie / Rayleigh Forward-Scattered Sapphire Dust Veils (I ∝ λ⁻⁴) Illuminated by Hot B-Stars',
            tempK: 13500,
            composition: 'Sub-Micron Silicate & PAH Dust Sheets · Embedded Young B-Type Stars'
          },
          'wr-bubble': {
            name: 'Wolf–Rayet / Eta Carinae Bipolar Homunculus',
            subtitle: 'Near-Eddington Continuum-Driven Fast Wind Inflating Twin Dusty Lobes & Equatorial Skirt',
            tempK: 36000,
            composition: 'N-Enriched LBV/WR Ejecta · Hot C/O Dust Shells · Shocked Equatorial Torus'
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
      const isMpm = stellarEngine?.solver === 'webgpu-3d-mls-mpm-nuclear-fusion';
      const vConv = Number(stellarTelemetry?.convectiveRmsVel || 0);
      const stGrid = stellarEngine?.gridN || 24;
      const genLbl = stellarTelemetry?.generationLabel || stellarEngine?.generationLabel || '3rd-Gen Pop I';
      const domCh = stellarTelemetry?.dominantChannel || 'pp-chain (4 ¹H → ⁴He)';
      const xCnoPct = ((stellarTelemetry?.meanXCNO ?? 0) * 100).toFixed(3);
      const xAFePct = ((stellarTelemetry?.meanXAlphaFe ?? 0) * 100).toFixed(3);
      return [{
        id: 'stellar-fusion-core',
        level: 3,
        name: isMpm ? `${genLbl} · 3D MLS-MPM Fusion` : 'Thermonuclear Fusion Core',
        subtitle: isMpm
          ? `${stGrid}³ MLS-MPM + SS Multipole · ${domCh} · Q_pp = ${burn.ppThermalMeV.toFixed(2)} MeV · v_conv = ${vConv.toFixed(2)}`
          : `Gate 1 pp/CNO/3α Burn · Q_pp = ${burn.ppThermalMeV.toFixed(2)} MeV`,
        pos: [0, 0, 0],
        radius: 1.8,
        tempK: stellarTelemetry?.coreTempK || 1.5e7,
        massLabel: `${(stellarEngine?.totalMassSolar || 1.0).toFixed(2)} M☉`,
        composition: `H ${((stellarTelemetry?.meanXH ?? 0.72) * 100).toFixed(1)}% · He ${((stellarTelemetry?.meanXHe ?? 0.26) * 100).toFixed(1)}% · CNO ${xCnoPct}% · α/Fe ${xAFePct}%`,
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
      const sm = activeSampledMaterial;
      return [{
        id: 'md-lattice-atom',
        level: 5,
        name: sm ? `${sm.name} · ${sym} Lattice` : `${sym} Representative Lattice`,
        subtitle: sm
          ? `Sampled from ${sm.worldName} (${sm.locationTag}) · ${b?.mechanical?.crystalStructure || 'crystal'} · ${mdSession?.atomCount || 0} GPU atoms`
          : `${b?.mechanical?.crystalStructure || 'crystal'} · ${mdSession?.atomCount || 0} live GPU atoms`,
        pos: [0, 0, 0],
        radius: 1.5,
        sampleZ: mdElementZ,
        tempK: mdTelemetry?.temperatureK || mdTempK,
        massLabel: `m = ${(b?.nuclear?.atomicMassU || 55.8).toFixed(2)} u`,
        composition: sm
          ? `Compounds: ${sm.compounds.slice(0, 3).map((c) => c.formula).join(' · ')} · Phase: ${mdTelemetry?.emergentPhase || mdPhasePreset}`
          : `Phase: ${mdTelemetry?.emergentPhase || mdPhasePreset} · ⟨Z⟩ = ${(mdTelemetry?.meanCoordination || 0).toFixed(2)}`,
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
    try { galacticDynamoSession?.dispose(); } catch {}
    try { smbhEngine?.dispose(); } catch {}
    try { solarEngine?.dispose(); } catch {}
    try { protoplanetarySession?.dispose(); } catch {}
    try { nebularCoalescenceSession?.dispose(); } catch {}
    try { kerrJetSession?.dispose(); } catch {}
    try { relBinarySession?.dispose(); } catch {}
    try { radWindL2Session?.dispose(); } catch {}
    try { tidalRocheSession?.dispose(); } catch {}
    try { stellarEngine?.dispose(); } catch {}
    try { stellarDynamoSession?.dispose(); } catch {}
    try { nebulaMhdSession?.dispose(); } catch {}
    try { radWindL3Session?.dispose(); } catch {}
    try { magnetosphereSession?.dispose(); } catch {}
    try { planetaryAtmoSession?.dispose(); } catch {}
    try { planetaryGenesisSphSession?.dispose(); } catch {}
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
    get busy() { return busy; },
    get quality() { return quality; },
    get qualityMode() { return qualityMode; },
    get capabilityProfile() { return activeCapabilityProfile; },
    get lastSupernovaYields() { return lastSupernovaYields; },
    get cosmicEpochId() { return cosmicEpochId; },
    get cosmicEpoch() { return cosmicEpoch; },
    get activeGalaxyEnv() { return activeGalaxyEnv; },
    get activeStarSite() { return activeStarSite; },
    get activeCausalSystem() { return activeCausalSystem; },
    get activeSampledMaterial() { return activeSampledMaterial; },
    get useSolReference() { return useSolReference; },
    getActiveSystemCatalog,
    getDefaultPlanetIndex,
    selectCausalStarSite,
    syncStellarRegimeForStar,
    sampleNewGalacticSector,
    setUseSolReference,
    deriveGalaxyEnvironmentFromCosmicContext,
    deriveStarSystemFromGalacticLocation,
    synthesizeNebularPlanetarySystem,
    get cosmoMode() { return cosmoMode; },
    get cosmoSession() { return cosmoSession; },
    get cosmoTelemetry() { return cosmoTelemetry; },
    get cosmoBigBangMode() { return cosmoBigBangMode; },
    get cosmoScaleFactorA() { return cosmoSession?.getState?.()?.aScale ?? 1.0; },
    get cosmoFirstPk() { return cosmoFirstPk; },
    get cosmoTargets() { return cosmoTargets; },
    get cosmoFocusMpc() { return cosmoFocusMpc; },
    get cosmoBaryonSession() { return cosmoBaryonSession; },
    get cosmoBaryonTelemetry() { return cosmoBaryonTelemetry; },
    get galaxyEngine() { return galaxyEngine; },
    get galacticDynamoSession() { return galacticDynamoSession; },
    get galacticDynamoTelemetry() { return galacticDynamoTelemetry; },
    get galacticDynamoStreamlines() { return galacticDynamoStreamlines; },
    get galacticB0() { return galacticB0; },
    get galaxyPreset() { return galaxyPreset; },
    get galaxyIcRegimeLabel() { return galaxyIcRegimeLabel; },
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
    get nebularCoalescenceSession() { return nebularCoalescenceSession; },
    get nebularCoalescenceTelemetry() { return nebularCoalescenceTelemetry; },
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
    get stellarDynamoSession() { return stellarDynamoSession; },
    get stellarDynamoTelemetry() { return stellarDynamoTelemetry; },
    get stellarDynamoStreamlines() { return stellarDynamoStreamlines; },
    get stellarB0() { return stellarB0; },
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
    get stellarCutaway() { return stellarCutaway; },
    get planetaryMode() { return planetaryMode; },
    get planetaryResult() { return planetaryResult; },
    get planetaryBodyIndex() { return planetaryBodyIndex; },
    get planetaryCutaway() { return planetaryCutaway; },
    get planetaryAtmoState() { return planetaryAtmoState; },
    get planetaryAtmoSession() { return planetaryAtmoSession; },
    get planetaryAtmoTelemetry() { return planetaryAtmoTelemetry; },
    get planetaryTriboelectric() { return planetaryTriboelectric; },
    get planetaryGenesisSphSession() { return planetaryGenesisSphSession; },
    get planetaryGenesisSphTelemetry() { return planetaryGenesisSphTelemetry; },
    get planetaryGenesisLiveForm() { return planetaryGenesisLiveForm; },
    get planetaryCoolingHeat() { return planetaryCoolingHeat; },
    get galaxyCenterOfMass() { return galaxyEngine?.getCenterOfMass?.() || [0, 0, 0]; },
    get nebulaCenterOfMass() { return nebularCoalescenceSession?.getCenterOfMass?.() || [0, 0, 0]; },
    get planetaryDynamoSession() { return planetaryDynamoSession; },
    get planetaryDynamoTelemetry() { return planetaryDynamoTelemetry; },
    get planetaryDynamoStreamlines() { return planetaryDynamoStreamlines; },
    get activeGenesisStage() { return getActiveGenesisPublicState(); },
    get lastGenesisEvent() { return lastGenesisEvent; },
    get nebularSettleBlend() { return nebularSettleBlend; },
    get cryoPlumeSession() { return cryoPlumeSession; },
    get cryoPlumeTelemetry() { return cryoPlumeTelemetry; },
    get surfaceActive() { return surfaceActive; },
    get surfaceLandingSite() { return surfaceLandingSite; },
    get surfaceSession() { return surfaceSession; },
    get surfaceTelemetry() { return surfaceTelemetry; },
    get surfaceBodySpec() { return customSurfaceBodySpec || getActiveSystemCatalog()[planetaryBodyIndex] || null; },
    get surfaceCraterTileKey() { return surfaceCraterTileKey; },
    get surfaceControls() { return surfaceControls; },
    get surfaceTimeWarp() { return surfaceTimeWarp; },
    get surfaceSimSec() { return surfaceSimSec; },
    get surfaceClimate() { return surfaceClimate; },
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
    detonateCoreSeedNextGeneration,
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
    setSampledMaterial,
    applySampledMaterialToLattice,
    computeScaleAdaptiveTimeDilation,
    setPlanetaryCutaway,
    setPlanetaryTriboelectric,
    setPlanetaryMode,
    setPlanetaryGenesisLiveForm,
    triggerPlanetSphGenesisReplay,
    crystallizeCoalescedSystem,
    triggerGalaxyCoalescence,
    finalizeActiveGenesis,
    getRootLineageCacheStats: () => rootLineageCache.getStats(),
    getSphGeologySnapshot: () => planetaryGenesisSphSession?.getCachedGeologySnapshot?.() || null,
    peekCachedPlanetSph(bodyIndex = planetaryBodyIndex) {
      const cat = getActiveSystemCatalog();
      const spec = cat[bodyIndex];
      if (!spec || spec.isStar || !evaluatePlanetaryGenesisSphActivation(spec).active) return null;
      const w = getWorkloads();
      return rootLineageCache.peek(buildPlanetSphCacheKey(spec, bodyIndex, `${w.sphMapWidth}x${w.sphMapHeight}x${w.sphGridN}`));
    },
    peekCachedStarSystemForSite(starSite = null) {
      if (!starSite) return null;
      const activeSeed = ((universeSeed) + 409) >>> 0;
      const key = rootLineageCache.buildKey('l2-nebular', {
        seed: activeSeed,
        epochId: cosmicEpochId,
        galaxyKey: activeGalaxyEnv?.seed || 0,
        starKey: `${starSite.starIndex ?? 0}_${starSite.forceMultiplicity || 0}_${starSite.forceExoticStage || ''}`
      });
      return rootLineageCache.peek(key);
    },
    peekCachedHaloGalaxy(posMpc = null) {
      if (!Array.isArray(posMpc) || posMpc.length < 3) return null;
      const key = rootLineageCache.buildKey('l1-galaxy', {
        seed: universeSeed,
        epochId: cosmicEpochId,
        galaxyKey: `${Math.round((posMpc[0] || 0) / 25)}_${Math.round((posMpc[1] || 0) / 25)}_${Math.round((posMpc[2] || 0) / 25)}`
      });
      return rootLineageCache.peek(key);
    },
    setRootCachePeerPublisher: (fn) => rootLineageCache.setPeerPublisher(fn),
    ingestRemoteRootCacheEntry: (entry) => rootLineageCache.ingestPeerEntry(entry),
    enterSurfaceView,
    exitSurfaceView,
    unloadStarSystemRegimes,
    flushSurfaceCraters,
    applyRemoteCraterStamp: (st) => surfaceSession?.applyRemoteCraterStamp?.(st) ?? false,
    triggerCatastrophicShatter,
    getShatteredBodyIds: () => [...shatteredBodyIds],
    craterTileStore,
    setSurfaceVehicle,
    setSurfaceUfoAltitudeKm,
    setSurfaceCameraMode,
    setSurfaceControls,
    setSurfaceTimeWarp(w) { surfaceTimeWarp = Math.max(1.0, Math.min(1e7, Number(w) || 1.0)); return surfaceTimeWarp; },
    advanceSurfaceSimSec(deltaSec) { surfaceSimSec += Number(deltaSec) || 0; return surfaceSimSec; },
    setSurfaceClimate(c) { surfaceClimate = c || null; },
    addSurfaceLookDelta,
    adjustSurfaceChaseDistance,
    triggerSurfaceTractorPulse: (dur) => surfaceSession?.triggerTractorPulse?.(dur),
    setSurfaceTractorBeam: (on) => surfaceSession?.setTractorBeam?.(on),
    setSurfaceWeaponConfig: (cfg) => surfaceSession?.setWeaponConfig?.(cfg),
    setSurfaceWeaponFire: (opts) => surfaceSession?.setWeaponFire?.(opts),
    launchSurfaceMissile: (opts) => surfaceSession?.launchMissile?.(opts),
    setSurfaceExternalEntities: (ext) => surfaceSession?.setExternalEntities?.(ext),
    drainSurfaceEvents: () => surfaceSession?.drainPendingEvents?.() || { harvested: { silicates: 0, volatiles: 0, metals: 0, exotics: 0 }, peerHits: [], abductions: [] },
    setStellarTimeAccel,
    setStellarCutaway(enabled) { stellarCutaway = Boolean(enabled); return stellarCutaway; },
    setSolarMode,
    setKerrSpinA,
    setProtoplanetaryGasDrag,
    setStellarMode,
    setNebulaB0,
    setGalacticB0,
    setStellarB0,
    setCosmoFocusMpc,
    setShowGalacticBField,
    setGalaxyBranch,
    setFocusedSolarBody,
    computeSolarBarycenterAu,
    getSolarReferenceOriginAu,
    getActiveUniversalLaws,
    syncSchroederScaleChart,
    getSchroederAtlasSnapshot,
    get lawGraphValidation() { return lawGraphValidation; },
    getTargetsForLevel,
    connectPeerMesh,
    disconnectPeerMesh,
    getPeerMeshState,
    dispatchPeerDerivation,
    getCosmoSpatialPartitionerState() {
      if (!cosmoSpatialPartitioner) return null;
      return Object.freeze({
        schema: cosmoSpatialPartitioner.schema,
        localPeerId: cosmoLocalPeerId,
        localTileClaimed: Boolean(cosmoLocalTileLease?.claimed),
        localTileIndex: cosmoLocalTileLease?.tile?.index ?? null,
        epoch: cosmoSpatialPartitioner.getEpoch(),
        tileCount: cosmoSpatialPartitioner.tiles.length,
        admittedRemoteTiles: cosmoSpatialPartitioner.getAdmittedTileSummaries({ excludePeerId: cosmoLocalPeerId }).length,
        brokerSnapshot: cosmoSpatialPartitioner.broker.snapshot()
      });
    },
    claimCosmoSpatialTile(tileIndex, peerId = cosmoLocalPeerId, opts = {}) {
      if (!cosmoSpatialPartitioner) return Object.freeze({ claimed: false, reason: 'cosmo-uninitialized' });
      return cosmoSpatialPartitioner.claimTile(tileIndex, peerId, opts);
    },
    admitRemoteCosmoTileMultipole({
      tileIndex,
      peerId,
      token,
      summaryEpoch,
      payload = null,
      totalMass = 0,
      com = [0, 0, 0],
      quadrupoleTrace = 0,
      particleCount = 0,
      scaleFactorA = 0,
      stepIndex = 0
    } = {}) {
      if (!cosmoSpatialPartitioner) {
        return Object.freeze({ accepted: false, reason: 'cosmo-uninitialized' });
      }
      const binaryPayload = payload ?? encodeTileMultipolePayload({
        totalMass,
        com,
        quadrupoleTrace,
        particleCount,
        scaleFactorA,
        stepIndex
      });
      const res = cosmoSpatialPartitioner.submitTileMultipoleSummary({
        tileIndex,
        peerId,
        token,
        summaryEpoch: summaryEpoch ?? cosmoSpatialPartitioner.getEpoch(),
        payload: binaryPayload
      });
      if (res.accepted && cosmoSession) {
        const remoteSummaries = cosmoSpatialPartitioner.getAdmittedTileSummaries({ excludePeerId: cosmoLocalPeerId });
        cosmoSession.injectRemoteTileMultipoles(remoteSummaries);
      }
      return res;
    },
    evictCosmoSpatialPeer(peerId, opts = {}) {
      if (!cosmoSpatialPartitioner) return Object.freeze({ tiles: [] });
      const res = cosmoSpatialPartitioner.evictPeer(peerId, opts);
      if (cosmoSession) {
        const remoteSummaries = cosmoSpatialPartitioner.getAdmittedTileSummaries({ excludePeerId: cosmoLocalPeerId });
        cosmoSession.injectRemoteTileMultipoles(remoteSummaries);
      }
      return res;
    },
    dispose
  });
}
