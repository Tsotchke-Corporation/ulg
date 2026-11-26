// Canonical Scale-Independent Universal Law Graph Orchestrator & Dynamic Activator
// (`src/runtime/universalLawGraph.js`).
//
// Implements ULG's core thesis:
//   - Physical laws are general, first-principles GPU operators — NEVER coded for a
//     specific planet, material, element, or preset.
//   - Every law declares its fundamental physical families (`gravity`, `electromagnetism`,
//     `hydrodynamics`, `thermodynamics`, `rigid-solid-mechanics`, `nuclear-quantum`),
//     its canonical `LAW_ADAPTER_CONTRACT` metadata (`CANONICAL_SS_EPOCH`, zero private
//     spatial grid debt), and a pure `evaluateActivation(physicalState)` predicate.
//   - At any scale across all 40 orders of magnitude (`10^-15 m -> 10^+25 m`), the Universal
//     Law Graph inspects the physical state actually present in the simulation and activates
//     ONLY the laws whose physical preconditions hold — keeping absent laws dormant (`0` cost)!

import {
  LAW_ADAPTER_MODES,
  LAW_FALLBACK_POLICIES,
  LAW_SPATIAL_AUTHORITIES,
  validateLawAdapterDescriptor
} from './sph/lawAdapterContract.js';
import {
  NEBULAR_MHD_LAW_ADAPTER,
  registerNebularMhdSimulationModule
} from './astrophysics/nebularMhdCollapseGpu.js';
import {
  PLANETARY_ATMO_EM_LAW_ADAPTER,
  evaluateFluidElectrodynamicsActivation,
  registerPlanetaryAtmosphereElectricModule
} from './astrophysics/planetaryAtmosphereElectricGpu.js';
import {
  PROTOPLANETARY_ACCRETION_LAW_ADAPTER,
  evaluateProtoplanetaryDiskActivation,
  registerProtoplanetaryDiskSimulationModule
} from './astrophysics/protoplanetaryDiskFormationGpu.js';
import {
  PARTICLE_RIGID_DYNAMICS_LAW_ADAPTER,
  evaluateParticleRigidActivation,
  registerParticleRigidDynamicsModule
} from './sph/particleRigidDynamicsGpu.js';
import {
  COSMO_BARYON_RAD_LAW_ADAPTER,
  evaluateCosmologicalBaryonRadiationActivation,
  registerCosmologicalBaryonRadiationModule
} from './astrophysics/cosmologicalBaryonRadiationGpu.js';
import {
  RELATIVISTIC_COMPACT_LAW_ADAPTER,
  evaluateRelativisticCompactActivation,
  registerRelativisticCompactModule
} from './astrophysics/relativisticCompactObjectGpu.js';
import {
  COMPACT_MAGNETOSPHERE_LAW_ADAPTER,
  evaluateCompactMagnetosphereActivation,
  registerCompactMagnetosphereModule
} from './astrophysics/compactMagnetosphereGpu.js';
import {
  RELATIVISTIC_BINARY_LAW_ADAPTER,
  evaluateRelativisticBinaryActivation,
  registerRelativisticBinaryMergerModule
} from './astrophysics/relativisticBinaryMergerGpu.js';
import {
  RADIATIVE_WIND_LAW_ADAPTER,
  evaluateRadiativeWindActivation,
  registerRadiativePhotoionizationWindModule
} from './astrophysics/radiativePhotoionizationWindGpu.js';
import {
  TIDAL_ROCHE_LAW_ADAPTER,
  evaluateTidalRocheActivation,
  registerTidalRocheDisruptionModule
} from './astrophysics/tidalRocheDisruptionGpu.js';
import {
  PLANETARY_SURFACE_LAW_ADAPTER,
  evaluatePlanetarySurfaceActivation,
  registerPlanetarySurfaceVehiclesModule
} from './astrophysics/planetarySurfaceVehiclesGpu.js';
import {
  PLANETARY_ATMO_3D_CFD_LAW_ADAPTER,
  evaluatePlanetaryAtmo3dCfdActivation,
  registerPlanetaryAtmo3dCfdModule
} from './astrophysics/planetaryAtmosphere3dCfdGpu.js';
import {
  ORGANIC_MOLECULAR_GRAPH_LAW_ADAPTER,
  evaluateOrganicGraphActivation,
  registerOrganicMolecularGraphModule
} from './organic/organicMolecularGraphGpu.js';
import {
  REACTIVE_BOND_ORDER_MD_LAW_ADAPTER,
  evaluateReactiveBondOrderActivation,
  registerReactiveBondOrderMdModule
} from './organic/reactiveBondOrderMdGpu.js';
import {
  ACID_BASE_CATALYSIS_LAW_ADAPTER,
  evaluateAcidBaseCatalysisActivation,
  registerAcidBaseCatalysisModule
} from './organic/acidBaseCatalysisGpu.js';
import {
  AMPHIPHILE_MEMBRANE_LAW_ADAPTER,
  evaluateAmphiphileMembraneActivation,
  registerAmphiphileMembraneModule
} from './biology/amphiphileMembraneGpu.js';
import {
  BIOPOLYMER_FOLDING_LAW_ADAPTER,
  evaluateBiopolymerFoldingActivation,
  registerBiopolymerFoldingModule
} from './biology/biopolymerFoldingGpu.js';
import {
  TEMPLATE_REPLICATION_LAW_ADAPTER,
  evaluateTemplateReplicationActivation,
  registerTemplateReplicationModule
} from './biology/templateReplicationGpu.js';
import {
  MEMBRANE_BIOENERGETICS_LAW_ADAPTER,
  evaluateMembraneBioenergeticsActivation,
  registerMembraneBioenergeticsModule
} from './biology/membraneBioenergeticsGpu.js';
import {
  MORPHOGENESIS_ACTIVE_LAW_ADAPTER,
  evaluateMorphogenesisActiveActivation,
  registerMorphogenesisActiveModule
} from './biology/morphogenesisActiveMatterGpu.js';

export const ULG_UNIVERSAL_LAW_GRAPH_SCHEMA = 'peercompute.ulg.universal-law-graph.v1';

export const FUNDAMENTAL_LAW_FAMILIES = Object.freeze({
  GRAVITY: 'gravity',
  ELECTROMAGNETISM: 'electromagnetism',
  HYDRODYNAMICS: 'hydrodynamics',
  THERMODYNAMICS: 'thermodynamics',
  RIGID_SOLID_MECHANICS: 'rigid-solid-mechanics',
  NUCLEAR_QUANTUM: 'nuclear-quantum',
  CHEMICAL_BONDING: 'chemical-bonding',
  SOFT_MATTER_BIOPHYSICS: 'soft-matter-biophysics',
  REACTION_DIFFUSION_ACTIVE: 'reaction-diffusion-active'
});

// Additional top-down canonical Law Adapter descriptors for existing Gate 5 & v2 WebGPU engines
export const FLRW_COSMOLOGY_LAW_ADAPTER = Object.freeze({
  id: 'flrw-treepm-cosmology',
  lawNodeId: 'law:astrophysics-flrw-treepm-cosmology',
  orderConstraint: 'root:cosmological-epoch',
  adapterMode: LAW_ADAPTER_MODES.AGGREGATE_FAR,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['cosmo-particles', 'flrw-scale-factor', 'fft3d-poisson-grid']),
  writes: Object.freeze(['cosmo-particles', 'fft3d-poisson-grid']),
  accumulates: Object.freeze(['cosmo-power-spectrum-pk']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['comoving-mass', 'comoving-linear-momentum']),
  validityDomain: Object.freeze({ aScaleMin: 0.01, aScaleMax: 2.0, comovingBoxMinMpc: 1.0 }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e22, 1e26])
});

export const GALACTIC_MHD_EVOLUTION_LAW_ADAPTER = Object.freeze({
  id: 'galactic-mhd-evolution',
  lawNodeId: 'law:astrophysics-galactic-mhd-evolution',
  orderConstraint: 'after:flrw-treepm-cosmology',
  adapterMode: LAW_ADAPTER_MODES.AGGREGATE_FAR,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['galactic-stars-dm-ism', 'ss-scale-atlas-multipole', 'gate1-ism-cooling-anchors']),
  writes: Object.freeze(['galactic-stars-dm-ism']),
  accumulates: Object.freeze(['galactic-dynamo-telemetry']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['mass', 'linear-momentum', 'angular-momentum']),
  validityDomain: Object.freeze({ minBodies: 64, metallicityNonNegative: true }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e18, 1e22])
});

export const SOLAR_SYSTEM_NBODY_LAW_ADAPTER = Object.freeze({
  id: 'solar-system-nbody',
  lawNodeId: 'law:astrophysics-symplectic-nbody-f32x2',
  orderConstraint: 'after:protoplanetary-accretion',
  adapterMode: LAW_ADAPTER_MODES.AGGREGATE_FAR,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['nbody-f32x2-bodies']),
  writes: Object.freeze(['nbody-f32x2-bodies']),
  accumulates: Object.freeze(['nbody-conservation-ledger']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['mass', 'linear-momentum', 'angular-momentum', 'symplectic-energy']),
  validityDomain: Object.freeze({ doubleFloatProtectedTwoSum: true, maxDtSubYr: 0.00012 }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e7, 1e16])
});

export const STELLAR_HYDRO_FUSION_LAW_ADAPTER = Object.freeze({
  id: 'self-gravitating-hydro-fusion',
  lawNodeId: 'law:astrophysics-stellar-hydro-fusion',
  orderConstraint: 'after:nebular-mhd-collapse',
  adapterMode: LAW_ADAPTER_MODES.AGGREGATE_FAR,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['stellar-hydro-parcels', 'closure-plasma-eos', 'gate1-nuclear-qvalues']),
  writes: Object.freeze(['stellar-hydro-parcels']),
  accumulates: Object.freeze(['stellar-fusion-telemetry']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['mass', 'nucleon-fractions', 'linear-momentum', 'first-law-energy']),
  validityDomain: Object.freeze({ requiresPositiveDensity: true, gate1BetaPlusQValues: true }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e8, 1e17])
});

export const PLANETARY_INTERIOR_POLYTOPE_LAW_ADAPTER = Object.freeze({
  id: 'planetary-interior-polytope',
  lawNodeId: 'law:astrophysics-planetary-hydrostatic-polytope',
  orderConstraint: 'after:solar-system-nbody',
  adapterMode: LAW_ADAPTER_MODES.CELL_LOCAL,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['gate2-polytope-atlas-bank', 'planetary-mass-composition']),
  writes: Object.freeze(['planetary-radial-hydrostatic-profile']),
  accumulates: Object.freeze(['planetary-moi-and-core-radius']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['radial-mass', 'hydrostatic-balance']),
  validityDomain: Object.freeze({ failClosedPolytopeBounds: true, maxPressurePa: 1e12 }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.FAIL_CLOSED,
  scaleRangeM: Object.freeze([1e5, 1e8])
});

/**
 * Canonical Universal Law Graph Nodes spanning all 40 orders of magnitude.
 * Every node activates dynamically purely from physical state presence!
 */
export const UNIVERSAL_LAW_GRAPH_NODES = Object.freeze([
  Object.freeze({
    id: 'flrw-treepm-cosmology',
    methodKey: 'flrw-treepm-cosmology@1',
    title: 'ΛCDM FLRW 2LPT + 3D-FFT TreePM Cosmology',
    families: Object.freeze([FUNDAMENTAL_LAW_FAMILIES.GRAVITY, FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS]),
    scaleRangeM: Object.freeze([1e22, 1e26]),
    adapter: FLRW_COSMOLOGY_LAW_ADAPTER,
    evaluateActivation(st = {}) {
      const boxMpc = Number(st.comovingBoxMpc) || 0;
      const active = boxMpc >= 1.0 && (Number(st.omegaM) || 0) > 0;
      return { active, reason: active ? 'expanding-comoving-volume-present' : 'sub-cosmological-scale-dormant' };
    }
  }),
  Object.freeze({
    id: 'galactic-mhd-evolution',
    methodKey: 'galactic-mhd-evolution@1',
    title: 'Galactic Scale-Atlas Multipole, ISM Λ(T, Z) Cooling & α–ω Dynamo',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.GRAVITY,
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS
    ]),
    scaleRangeM: Object.freeze([1e18, 1e22]),
    adapter: GALACTIC_MHD_EVOLUTION_LAW_ADAPTER,
    evaluateActivation(st = {}) {
      const nStars = Number(st.galacticBodyCount) || 0;
      const spanM = Number(st.viewSpanM) || 0;
      const active = nStars >= 64 || (spanM >= 1e17 && spanM <= 1e23);
      return { active, reason: active ? 'galactic-halo-disk-present' : 'outside-galactic-regime-dormant' };
    }
  }),
  Object.freeze({
    id: 'nebular-mhd-collapse',
    methodKey: 'nebular-mhd-collapse@1',
    title: '3D Self-Gravitating Resistive MHD Nebular Collapse & Bipolar Jets',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.GRAVITY,
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS
    ]),
    scaleRangeM: Object.freeze([1e13, 1e18]),
    adapter: NEBULAR_MHD_LAW_ADAPTER,
    evaluateActivation(st = {}) {
      const cloudMass = Number(st.nebulaCloudMass) || 0;
      const bMag = Math.abs(Number(st.magneticFieldStrength) || 0);
      const rm = Number(st.magneticReynolds) || 0;
      const active = cloudMass > 0 && (bMag > 0 || rm > 1.0 || Boolean(st.ionizedGasPresent));
      return {
        active,
        lorentzActive: bMag > 1e-6,
        reason: active ? 'magnetized-self-gravitating-cloud-present' : 'no-magnetized-nebula-dormant'
      };
    }
  }),
  Object.freeze({
    id: 'protoplanetary-accretion',
    methodKey: 'protoplanetary-accretion@1',
    title: 'Protoplanetary Disk Gas Drag, Snow-Line Sublimation & Pebble Accretion',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.GRAVITY,
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.RIGID_SOLID_MECHANICS
    ]),
    scaleRangeM: Object.freeze([1e10, 1e14]),
    adapter: PROTOPLANETARY_ACCRETION_LAW_ADAPTER,
    evaluateActivation: evaluateProtoplanetaryDiskActivation
  }),
  Object.freeze({
    id: 'solar-system-nbody',
    methodKey: 'solar-system-nbody@1',
    title: 'Real-Scale Double-Float (f32x2) Symplectic Mutual N-Body Gravity',
    families: Object.freeze([FUNDAMENTAL_LAW_FAMILIES.GRAVITY]),
    scaleRangeM: Object.freeze([1e7, 1e16]),
    adapter: SOLAR_SYSTEM_NBODY_LAW_ADAPTER,
    evaluateActivation(st = {}) {
      const n = Number(st.gravitatingBodyCount) || 0;
      const active = n >= 2;
      return { active, reason: active ? 'multi-body-gravitational-system-present' : 'single-or-zero-body-dormant' };
    }
  }),
  Object.freeze({
    id: 'self-gravitating-hydro-fusion',
    methodKey: 'self-gravitating-hydro@1',
    title: 'Self-Gravitating Compressible Plasma & Gate 1 Thermonuclear Fusion',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.GRAVITY,
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.NUCLEAR_QUANTUM
    ]),
    scaleRangeM: Object.freeze([1e8, 1e17]),
    adapter: STELLAR_HYDRO_FUSION_LAW_ADAPTER,
    evaluateActivation(st = {}) {
      const tCore = Number(st.coreTempK) || 0;
      const massKg = Number(st.bodyMassKg) || 0;
      const active = tCore >= 1e6 || massKg >= 1e28;
      return { active, reason: active ? 'fusion-capable-plasma-core-present' : 'sub-stellar-temperature-dormant' };
    }
  }),
  Object.freeze({
    id: 'planetary-interior-polytope',
    methodKey: 'planetary-interior-polytope@1',
    title: 'Fail-Closed Gate 2 Polytope-Atlas Hydrostatic Interior Equilibrium',
    families: Object.freeze([FUNDAMENTAL_LAW_FAMILIES.GRAVITY, FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS]),
    scaleRangeM: Object.freeze([1e5, 1e8]),
    adapter: PLANETARY_INTERIOR_POLYTOPE_LAW_ADAPTER,
    evaluateActivation(st = {}) {
      const massKg = Number(st.bodyMassKg) || 0;
      const radiusM = Number(st.bodyRadiusM) || 0;
      const active = massKg >= 1e20 && radiusM >= 1e5 && massKg < 1e28;
      return { active, reason: active ? 'self-gravitating-planetary-interior-present' : 'non-hydrostatic-body-dormant' };
    }
  }),
  Object.freeze({
    id: 'planetary-atmosphere-em',
    methodKey: 'planetary-atmosphere-em@1',
    title: 'Spherical Baroclinic Fluid, Particulate Triboelectricity, Paschen Breakdown & Core Geodynamo',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS
    ]),
    scaleRangeM: Object.freeze([1e4, 1e8]),
    adapter: PLANETARY_ATMO_EM_LAW_ADAPTER,
    evaluateActivation(st = {}) {
      const act = evaluateFluidElectrodynamicsActivation(st);
      return {
        active: act.anyActive,
        details: act,
        reason: act.anyActive ? `active:${act.activeLaws.join(',')}` : 'vacuum-nonmagnetized-body-dormant'
      };
    }
  }),
  Object.freeze({
    id: 'particle-rigid-dynamics',
    methodKey: 'particle-rigid-dynamics@1',
    title: 'Particle-Composite SE(3) DLM Symplectic Rigid-Body & Hertz-Mindlin/JKR Contact Dynamics',
    families: Object.freeze([FUNDAMENTAL_LAW_FAMILIES.RIGID_SOLID_MECHANICS, FUNDAMENTAL_LAW_FAMILIES.GRAVITY]),
    scaleRangeM: Object.freeze([1e-3, 1e8]),
    adapter: PARTICLE_RIGID_DYNAMICS_LAW_ADAPTER,
    evaluateActivation: evaluateParticleRigidActivation
  }),
  Object.freeze({
    id: 'cosmological-baryon-radiation',
    methodKey: 'cosmological-baryon-radiation@1',
    title: 'Eisenstein-Hu BAO/CMB Recombination, Reionization Bubbles, ICM X-Ray/SZ & 2D Lensing',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.GRAVITY,
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM
    ]),
    scaleRangeM: Object.freeze([1e21, 1e26]),
    adapter: COSMO_BARYON_RAD_LAW_ADAPTER,
    evaluateActivation: evaluateCosmologicalBaryonRadiationActivation
  }),
  Object.freeze({
    id: 'relativistic-compact-kerr-jet',
    methodKey: 'relativistic-compact-kerr-jet@1',
    title: 'GR TOV Unified Degenerate EOS (WD/NS/BH) & Kerr Blandford-Znajek Relativistic Jets (Quasar/Blazar)',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.GRAVITY,
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM,
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.NUCLEAR_QUANTUM
    ]),
    scaleRangeM: Object.freeze([1e3, 1e22]),
    adapter: RELATIVISTIC_COMPACT_LAW_ADAPTER,
    evaluateActivation: evaluateRelativisticCompactActivation
  }),
  Object.freeze({
    id: 'compact-magnetosphere-spindown',
    methodKey: 'compact-magnetosphere-spindown@1',
    title: 'Force-Free Oblique Dipole Spin-Down, Pulsar Lighthouse Beams & Magnetar Crustal-Yield Giant Flares',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM,
      FUNDAMENTAL_LAW_FAMILIES.RIGID_SOLID_MECHANICS,
      FUNDAMENTAL_LAW_FAMILIES.GRAVITY
    ]),
    scaleRangeM: Object.freeze([1e4, 1e17]),
    adapter: COMPACT_MAGNETOSPHERE_LAW_ADAPTER,
    evaluateActivation: evaluateCompactMagnetosphereActivation
  }),
  Object.freeze({
    id: 'relativistic-binary-gw-rprocess',
    methodKey: 'relativistic-binary-gw-rprocess@1',
    title: '1PN/2.5PN Gravitational-Wave Inspiral Chirp, Roche-Lobe X-Ray Binaries, Type Ia & BNS Kilonova r-Process',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.GRAVITY,
      FUNDAMENTAL_LAW_FAMILIES.NUCLEAR_QUANTUM,
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS
    ]),
    scaleRangeM: Object.freeze([1e4, 1e15]),
    adapter: RELATIVISTIC_BINARY_LAW_ADAPTER,
    evaluateActivation: evaluateRelativisticBinaryActivation
  }),
  Object.freeze({
    id: 'radiative-photoionization-winds',
    methodKey: 'radiative-photoionization-winds@1',
    title: 'Strömgren Photoionization (H II Pillars/Planetary Nebulae/SNR), Stellar Winds, XUV Escape & Dual-Tail Comets',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM,
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS
    ]),
    scaleRangeM: Object.freeze([1e3, 1e20]),
    adapter: RADIATIVE_WIND_LAW_ADAPTER,
    evaluateActivation: evaluateRadiativeWindActivation
  }),
  Object.freeze({
    id: 'tidal-roche-rheology-cryovolcanism',
    methodKey: 'tidal-roche-rheology-cryovolcanism@1',
    title: 'Roche-Limit Cohesive Disruption, Ring Shepherd Moons, Tidal Heating, Cryovolcanism, Magma Oceans & RGB Engulfment',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.GRAVITY,
      FUNDAMENTAL_LAW_FAMILIES.RIGID_SOLID_MECHANICS,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS
    ]),
    scaleRangeM: Object.freeze([1e2, 1e14]),
    adapter: TIDAL_ROCHE_LAW_ADAPTER,
    evaluateActivation: evaluateTidalRocheActivation
  }),
  Object.freeze({
    id: 'planetary-surface-vehicles',
    methodKey: 'planetary-surface-vehicles@1',
    title: 'Planetary Surface Terrain, Rocker-Bogie Rover Jump Rockets, & Actuator-Disk Atmospheric Drone Flight',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.GRAVITY,
      FUNDAMENTAL_LAW_FAMILIES.RIGID_SOLID_MECHANICS,
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS
    ]),
    scaleRangeM: Object.freeze([1e-1, 5e4]),
    adapter: PLANETARY_SURFACE_LAW_ADAPTER,
    evaluateActivation: evaluatePlanetarySurfaceActivation
  }),
  Object.freeze({
    id: 'organic-molecular-graph-hybridization',
    methodKey: 'organic-molecular-graph-hybridization@1',
    title: 'Organic Molecular Graph Hybridization (sp/sp²/sp³), GPU Extended-Hückel π-MOs, QEq Charges & 3D CIP Chirality',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.NUCLEAR_QUANTUM,
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM,
      FUNDAMENTAL_LAW_FAMILIES.CHEMICAL_BONDING
    ]),
    scaleRangeM: Object.freeze([1e-10, 1e-8]),
    adapter: ORGANIC_MOLECULAR_GRAPH_LAW_ADAPTER,
    evaluateActivation: evaluateOrganicGraphActivation
  }),
  Object.freeze({
    id: 'reactive-bond-order-md',
    methodKey: 'reactive-bond-order-md@1',
    title: 'WebGPU Reactive Bond-Order MD, Dihedral Conformations, Directional H-Bonds, SN2 Inversion & Diels-Alder [4+2]',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.CHEMICAL_BONDING,
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS
    ]),
    scaleRangeM: Object.freeze([1e-10, 1e-8]),
    adapter: REACTIVE_BOND_ORDER_MD_LAW_ADAPTER,
    evaluateActivation: evaluateReactiveBondOrderActivation
  }),
  Object.freeze({
    id: 'acid-base-catalysis-kinetics',
    methodKey: 'acid-base-catalysis-kinetics@1',
    title: 'First-Principles Brønsted-Lowry pKa Equilibria, Frank Chiral Symmetry Breaking, BZ Spirals & Prebiotic RAF Networks',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.CHEMICAL_BONDING,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.REACTION_DIFFUSION_ACTIVE
    ]),
    scaleRangeM: Object.freeze([1e-9, 1e-3]),
    adapter: ACID_BASE_CATALYSIS_LAW_ADAPTER,
    evaluateActivation: evaluateAcidBaseCatalysisActivation
  }),
  Object.freeze({
    id: 'amphiphile-membrane-self-assembly',
    methodKey: 'amphiphile-membrane-self-assembly@1',
    title: 'Amphiphile Hydrophobic Self-Assembly, Bilayer Membranes & Osmotic Protocell Vesicles',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.SOFT_MATTER_BIOPHYSICS,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM
    ]),
    scaleRangeM: Object.freeze([1e-9, 1e-6]),
    adapter: AMPHIPHILE_MEMBRANE_LAW_ADAPTER,
    evaluateActivation: evaluateAmphiphileMembraneActivation
  }),
  Object.freeze({
    id: 'biopolymer-folding-catalysis',
    methodKey: 'biopolymer-folding-catalysis@1',
    title: 'Heteropolymer Hydrophobic Collapse, Secondary H-Bond Folding, Thermal Denaturation & Electrostatic Pocket Catalysis',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.SOFT_MATTER_BIOPHYSICS,
      FUNDAMENTAL_LAW_FAMILIES.CHEMICAL_BONDING,
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS
    ]),
    scaleRangeM: Object.freeze([1e-9, 1e-7]),
    adapter: BIOPOLYMER_FOLDING_LAW_ADAPTER,
    evaluateActivation: evaluateBiopolymerFoldingActivation
  }),
  Object.freeze({
    id: 'template-replication-evolution',
    methodKey: 'template-replication-evolution@1',
    title: 'Complementary H-Bond Duplex Melting, Template Replication, Quasispecies Selection & Eigen Error Threshold',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.SOFT_MATTER_BIOPHYSICS,
      FUNDAMENTAL_LAW_FAMILIES.CHEMICAL_BONDING,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS
    ]),
    scaleRangeM: Object.freeze([1e-9, 1e-6]),
    adapter: TEMPLATE_REPLICATION_LAW_ADAPTER,
    evaluateActivation: evaluateTemplateReplicationActivation
  }),
  Object.freeze({
    id: 'chemiosmotic-bioenergetics-electrophysiology',
    methodKey: 'chemiosmotic-bioenergetics-electrophysiology@1',
    title: 'Mitchell Chemiosmotic Proton-Motive Force, ATP Synthesis & Hodgkin-Huxley Excitable Membrane Spiral Waves',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.SOFT_MATTER_BIOPHYSICS,
      FUNDAMENTAL_LAW_FAMILIES.ELECTROMAGNETISM,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.REACTION_DIFFUSION_ACTIVE
    ]),
    scaleRangeM: Object.freeze([1e-8, 1e-2]),
    adapter: MEMBRANE_BIOENERGETICS_LAW_ADAPTER,
    evaluateActivation: evaluateMembraneBioenergeticsActivation
  }),
  Object.freeze({
    id: 'reaction-diffusion-active-matter',
    methodKey: 'reaction-diffusion-active-matter@1',
    title: 'Turing Reaction-Diffusion Morphogenesis & Chemotactic Self-Propelled Active-Matter Colonies',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.REACTION_DIFFUSION_ACTIVE,
      FUNDAMENTAL_LAW_FAMILIES.SOFT_MATTER_BIOPHYSICS,
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS
    ]),
    scaleRangeM: Object.freeze([1e-6, 1e-1]),
    adapter: MORPHOGENESIS_ACTIVE_LAW_ADAPTER,
    evaluateActivation: evaluateMorphogenesisActiveActivation
  }),
  Object.freeze({
    id: 'planetary-atmosphere-3d-cfd',
    methodKey: 'planetary-atmosphere-3d-cfd@1',
    title: '3D Stratified Planetary Atmospheric Navier-Stokes CFD & Multi-Species Condensation Chemistry',
    families: Object.freeze([
      FUNDAMENTAL_LAW_FAMILIES.HYDRODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.THERMODYNAMICS,
      FUNDAMENTAL_LAW_FAMILIES.CHEMICAL_BONDING
    ]),
    scaleRangeM: Object.freeze([1e1, 2e5]),
    adapter: PLANETARY_ATMO_3D_CFD_LAW_ADAPTER,
    evaluateActivation: evaluatePlanetaryAtmo3dCfdActivation
  })
]);

/**
 * Evaluate which Universal Law Graph nodes dynamically activate for ANY physical state
 * (strictly state-driven — ZERO preset/planet/material name checks!).
 */
export function resolveActiveUniversalLaws(physicalState = {}) {
  const active = [];
  const dormant = [];
  const activeFamilies = new Set();
  for (const node of UNIVERSAL_LAW_GRAPH_NODES) {
    const verdict = node.evaluateActivation(physicalState);
    if (verdict?.active) {
      active.push(Object.freeze({
        id: node.id,
        methodKey: node.methodKey,
        title: node.title,
        families: node.families,
        reason: verdict.reason || 'active',
        details: verdict.details || null
      }));
      for (const fam of node.families) activeFamilies.add(fam);
    } else {
      dormant.push(Object.freeze({
        id: node.id,
        methodKey: node.methodKey,
        reason: verdict?.reason || 'dormant'
      }));
    }
  }
  return Object.freeze({
    schema: ULG_UNIVERSAL_LAW_GRAPH_SCHEMA,
    active: Object.freeze(active),
    dormant: Object.freeze(dormant),
    activeFamilies: Object.freeze([...activeFamilies])
  });
}

/**
 * Validate every Universal Law Graph adapter against ULG's canonical SS Law Adapter Contract
 * (confirming `0` errors and `0` legacy-private-grid debt!).
 */
export function validateUniversalLawGraphContracts() {
  const results = [];
  const errors = [];
  const debt = [];
  for (const node of UNIVERSAL_LAW_GRAPH_NODES) {
    const check = validateLawAdapterDescriptor(node.adapter, { requireExtendedMetadata: true });
    results.push({ id: node.id, valid: check.valid, errors: check.errors, debt: check.debt });
    for (const e of check.errors) errors.push(`${node.id}:${e}`);
    for (const d of check.debt) debt.push(`${node.id}:${d}`);
  }
  return Object.freeze({
    schema: ULG_UNIVERSAL_LAW_GRAPH_SCHEMA,
    valid: errors.length === 0 && debt.length === 0,
    nodeCount: UNIVERSAL_LAW_GRAPH_NODES.length,
    errors: Object.freeze(errors),
    debt: Object.freeze(debt),
    results: Object.freeze(results)
  });
}

/**
 * Register all canonical Top-Down & Particle-Rigid WebGPU simulation modules on
 * ULG's `SimulationModuleRegistry` (`defaultSimulationModuleRegistry`).
 */
export function registerAllTopDownLawModules(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return [];
  const registered = [
    registerNebularMhdSimulationModule(registry),
    registerPlanetaryAtmosphereElectricModule(registry),
    registerProtoplanetaryDiskSimulationModule(registry),
    registerParticleRigidDynamicsModule(registry),
    registerCosmologicalBaryonRadiationModule(registry),
    registerRelativisticCompactModule(registry),
    registerCompactMagnetosphereModule(registry),
    registerRelativisticBinaryMergerModule(registry),
    registerRadiativePhotoionizationWindModule(registry),
    registerTidalRocheDisruptionModule(registry),
    registerPlanetarySurfaceVehiclesModule(registry),
    registerPlanetaryAtmo3dCfdModule(registry),
    registerOrganicMolecularGraphModule(registry),
    registerReactiveBondOrderMdModule(registry),
    registerAcidBaseCatalysisModule(registry),
    registerAmphiphileMembraneModule(registry),
    registerBiopolymerFoldingModule(registry),
    registerTemplateReplicationModule(registry),
    registerMembraneBioenergeticsModule(registry),
    registerMorphogenesisActiveModule(registry)
  ].filter(Boolean);
  return registered;
}
